import type { VrtDiff, VrtSnapshot, DiffRegion, DiffRegionType, DiffReport, ShiftRegion, DiffRegionColor } from "./types.ts";
import { type PngData, cropImage, decodePng, encodePng } from "./png-utils.ts";

// ---- Shared diff pipeline ----

interface PixelDiffResult {
  diffOutput: Uint8Array;
  width: number;
  height: number;
  diffPixels: number;
  totalPixels: number;
  threshold: number;
  resizedBaseline: PngData;
  resizedCurrent: PngData;
}

async function runPixelDiff(
  baselinePath: string,
  screenshotPath: string,
  testId: string,
  opts: { threshold?: number; outputDir?: string; skipHeatmap?: boolean },
): Promise<PixelDiffResult & { heatmapPath?: string }> {
  const pixelmatch = (await import("pixelmatch")).default;
  const baseline = await decodePng(baselinePath);
  const current = await decodePng(screenshotPath);

  let resizedBaseline = baseline;
  let resizedCurrent = current;
  let overflowPixels = 0;

  if (baseline.width !== current.width || baseline.height !== current.height) {
    const commonW = Math.min(baseline.width, current.width);
    const commonH = Math.min(baseline.height, current.height);
    overflowPixels =
      Math.max(baseline.width, current.width) * Math.max(baseline.height, current.height)
      - commonW * commonH;
    resizedBaseline = cropImage(baseline, commonW, commonH);
    resizedCurrent = cropImage(current, commonW, commonH);
  }

  const width = resizedBaseline.width;
  const height = resizedBaseline.height;
  const totalPixels = width * height + overflowPixels;
  const diffOutput = new Uint8Array(width * height * 4);
  const threshold = opts.threshold ?? 0.1;

  const diffPixels = overflowPixels + pixelmatch(
    resizedBaseline.data, resizedCurrent.data, diffOutput, width, height, { threshold },
  );

  let heatmapPath: string | undefined;
  if (opts.outputDir && diffPixels > 0 && !opts.skipHeatmap) {
    const safeName = testId.replace(/[/\\:]/g, "_");
    heatmapPath = `${opts.outputDir}/${safeName}_heatmap.png`;
    await encodePng(heatmapPath, { width, height, data: diffOutput });
  }

  return { diffOutput, width, height, diffPixels, totalPixels, threshold, resizedBaseline, resizedCurrent, heatmapPath };
}

// ---- Public API ----

/**
 * Compare two screenshots pixel-by-pixel and generate a diff heatmap.
 */
export async function compareScreenshots(
  snapshot: VrtSnapshot,
  opts: {
    threshold?: number;
    outputDir?: string;
    skipHeatmap?: boolean;
  } = {}
): Promise<VrtDiff | null> {
  if (!snapshot.baselinePath) return null;

  const r = await runPixelDiff(snapshot.baselinePath, snapshot.screenshotPath, snapshot.testId, opts);
  const regions = detectDiffRegions(r.diffOutput, r.width, r.height);
  attachRegionColorSamples(regions, r.resizedBaseline, r.resizedCurrent);

  return {
    snapshot,
    diffPixels: r.diffPixels,
    totalPixels: r.totalPixels,
    diffRatio: r.diffPixels / r.totalPixels,
    heatmapPath: r.heatmapPath,
    regions,
  };
}

/**
 * Grid-based diff region detection.
 * Splits image into cells and clusters cells exceeding the diff threshold.
 */
function detectDiffRegions(
  diffData: Uint8Array,
  width: number,
  height: number,
  cellSize: number = 32
): DiffRegion[] {
  const cols = Math.ceil(width / cellSize);
  const rows = Math.ceil(height / cellSize);
  const grid = new Uint32Array(cols * rows);

  // Count diff pixels per cell
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      // pixelmatch diff: changed = red (R=255,G=0), unchanged = white (R=255,G=255)
      if (diffData[idx + 1] < 128) {
        const col = Math.floor(x / cellSize);
        const row = Math.floor(y / cellSize);
        grid[row * cols + col]++;
      }
    }
  }

  // Merge adjacent diff cells into bounding rectangles
  const visited = new Uint8Array(cols * rows);
  const regions: DiffRegion[] = [];
  const minPixels = 4; // noise threshold

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (visited[i] || grid[i] < minPixels) continue;

      // BFS cluster detection
      let minC = c,
        maxC = c,
        minR = r,
        maxR = r;
      let totalDiff = 0;
      const queue = [i];
      visited[i] = 1;

      while (queue.length > 0) {
        const ci = queue.shift()!;
        const cr = Math.floor(ci / cols);
        const cc = ci % cols;
        totalDiff += grid[ci];
        minC = Math.min(minC, cc);
        maxC = Math.max(maxC, cc);
        minR = Math.min(minR, cr);
        maxR = Math.max(maxR, cr);

        // 4-connected neighbors
        for (const [dr, dc] of [
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1],
        ]) {
          const nr = cr + dr;
          const nc = cc + dc;
          if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
          const ni = nr * cols + nc;
          if (!visited[ni] && grid[ni] >= minPixels) {
            visited[ni] = 1;
            queue.push(ni);
          }
        }
      }

      const regionWidth = (maxC - minC + 1) * cellSize;
      const regionHeight = (maxR - minR + 1) * cellSize;
      regions.push({
        x: minC * cellSize,
        y: minR * cellSize,
        width: regionWidth,
        height: regionHeight,
        diffPixelCount: totalDiff,
        regionType: classifyRegion(regionWidth, regionHeight, width),
      });
    }
  }

  return regions;
}

function attachRegionColorSamples(
  regions: DiffRegion[],
  baseline: PngData,
  current: PngData,
): void {
  for (const region of regions) {
    const baselineColor = sampleRegionColor(baseline, region);
    const currentColor = sampleRegionColor(current, region);
    if (!baselineColor || !currentColor) continue;
    region.colorSample = {
      baseline: baselineColor,
      current: currentColor,
      distance: Math.round(rgbDistance(baselineColor, currentColor)),
    };
  }
}

function sampleRegionColor(image: PngData, region: DiffRegion): DiffRegionColor | undefined {
  const inset = Math.min(2, Math.floor(Math.min(region.width, region.height) / 4));
  const x0 = Math.max(0, region.x + inset);
  const y0 = Math.max(0, region.y + inset);
  const x1 = Math.min(image.width, region.x + region.width - inset);
  const y1 = Math.min(image.height, region.y + region.height - inset);
  if (x1 <= x0 || y1 <= y0) return undefined;

  const stepX = Math.max(1, Math.floor((x1 - x0) / 5));
  const stepY = Math.max(1, Math.floor((y1 - y0) / 5));
  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];
  for (let y = y0; y < y1; y += stepY) {
    for (let x = x0; x < x1; x += stepX) {
      const idx = (y * image.width + x) * 4;
      if (image.data[idx + 3]! === 0) continue;
      rs.push(image.data[idx]!);
      gs.push(image.data[idx + 1]!);
      bs.push(image.data[idx + 2]!);
    }
  }
  if (rs.length === 0) return undefined;
  rs.sort((a, b) => a - b);
  gs.sort((a, b) => a - b);
  bs.sort((a, b) => a - b);
  const mid = rs.length >> 1;
  const r = rs[mid]!;
  const g = gs[mid]!;
  const b = bs[mid]!;
  return { r, g, b, hex: toHex(r, g, b) };
}

function toHex(r: number, g: number, b: number): string {
  const hex = (value: number) => value.toString(16).padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

function rgbDistance(a: DiffRegionColor, b: DiffRegionColor): number {
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}

/**
 * Classify a diff region based on its shape relative to the image width.
 * - "edge": thin lines (height <= 2 or width <= 2)
 * - "shift": wide horizontal bands (width/height > 3 and width > 80% image width)
 * - "content": localized changes
 */
function classifyRegion(regionWidth: number, regionHeight: number, imageWidth: number): DiffRegionType {
  if (regionHeight <= 2 || regionWidth <= 2) return "edge";
  if (regionWidth / regionHeight > 3 && regionWidth > imageWidth * 0.8) return "shift";
  return "content";
}

/**
 * Compute luminance profile (average brightness per row).
 */
function luminanceProfile(data: Uint8Array, width: number, height: number): Float64Array {
  const profile = new Float64Array(height);
  for (let y = 0; y < height; y++) {
    let sum = 0;
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      sum += 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
    }
    profile[y] = sum / width;
  }
  return profile;
}

/**
 * Detect global vertical shift between two images using cross-correlation.
 * Returns the offset in pixels (positive = img2 shifted down).
 */
function detectGlobalShift(
  baseline: { data: Uint8Array; width: number; height: number },
  current: { data: Uint8Array; width: number; height: number },
  maxShift?: number,
): number {
  const height = Math.min(baseline.height, current.height);
  const width = Math.min(baseline.width, current.width);
  const limit = maxShift ?? Math.min(Math.floor(height / 4), 500);

  const profile1 = luminanceProfile(baseline.data, width, height);
  const profile2 = luminanceProfile(current.data, width, height);

  let bestOffset = 0;
  let bestCorr = -Infinity;

  for (let offset = -limit; offset <= limit; offset++) {
    let sum = 0;
    let count = 0;
    for (let y = 0; y < height; y++) {
      const y2 = y + offset;
      if (y2 >= 0 && y2 < height) {
        sum += profile1[y] * profile2[y2];
        count++;
      }
    }
    const corr = count > 0 ? sum / count : 0;
    if (corr > bestCorr) {
      bestCorr = corr;
      bestOffset = offset;
    }
  }
  return bestOffset;
}

/**
 * Per-band shift detection — split the image into horizontal bands and run
 * the same cross-correlation per band. Lets us report "section A shifted
 * +8px, section B shifted +20px" instead of a single global average that
 * loses localization.
 *
 * Bands with low luminance variance (e.g. a flat white footer) are dropped
 * because cross-correlation can't lock onto them and the result is noise.
 *
 * Exported for unit testing.
 */
export function detectBandShifts(
  baseline: { data: Uint8Array; width: number; height: number },
  current: { data: Uint8Array; width: number; height: number },
  options: { bandHeight?: number; minConfidence?: number; maxShift?: number } = {},
): ShiftRegion[] {
  const height = Math.min(baseline.height, current.height);
  const width = Math.min(baseline.width, current.width);
  const bandHeight = Math.max(50, options.bandHeight ?? 240);
  const minConfidence = options.minConfidence ?? 0.02;
  const limit = options.maxShift ?? Math.min(Math.floor(bandHeight / 2), 400);

  if (height < bandHeight * 2) return [];

  const profile1 = luminanceProfile(baseline.data, width, height);
  const profile2 = luminanceProfile(current.data, width, height);

  const regions: ShiftRegion[] = [];
  const bandCount = Math.floor(height / bandHeight);
  for (let b = 0; b < bandCount; b++) {
    const yStart = b * bandHeight;
    const yEnd = b === bandCount - 1 ? height : yStart + bandHeight;

    // Variance check — flat bands have no signal.
    let mean = 0;
    for (let y = yStart; y < yEnd; y++) mean += profile1[y]!;
    mean /= (yEnd - yStart);
    let variance = 0;
    for (let y = yStart; y < yEnd; y++) {
      const d = profile1[y]! - mean;
      variance += d * d;
    }
    variance /= (yEnd - yStart);
    if (variance < 5) continue; // empirically: flat background

    // Mean-subtract both profiles so the cross-correlation magnitude scales
    // with actual structure rather than background brightness.
    let mean2 = 0;
    for (let y = yStart; y < yEnd; y++) mean2 += profile2[y]!;
    mean2 /= (yEnd - yStart);

    let bestOffset = 0;
    let bestCorr = -Infinity;
    let secondBestCorr = -Infinity;
    let zeroOffsetCorr = 0;
    for (let offset = -limit; offset <= limit; offset++) {
      let sum = 0;
      let count = 0;
      for (let y = yStart; y < yEnd; y++) {
        const y2 = y + offset;
        if (y2 >= 0 && y2 < height) {
          sum += (profile1[y]! - mean) * (profile2[y2]! - mean2);
          count++;
        }
      }
      const corr = count > 0 ? sum / count : 0;
      if (offset === 0) zeroOffsetCorr = corr;
      if (corr > bestCorr) {
        secondBestCorr = bestCorr;
        bestCorr = corr;
        bestOffset = offset;
      } else if (corr > secondBestCorr) {
        secondBestCorr = corr;
      }
    }

    // Confidence = peak sharpness relative to the second-best alignment.
    // A clean shift has best ≫ second-best; noise has best ≈ second-best.
    const confidence = bestCorr > 0 && secondBestCorr > 0
      ? Math.min(1, Math.max(0, (bestCorr - secondBestCorr) / bestCorr))
      : 0;

    if (bestOffset !== 0 && bestCorr > zeroOffsetCorr && confidence >= minConfidence) {
      regions.push({ yStart, yEnd, shift: bestOffset, confidence: Number(confidence.toFixed(3)) });
    }
  }

  return regions;
}

/**
 * Count diff pixels after compensating for vertical shift.
 */
function compensatedDiffCount(
  baselineData: Uint8Array,
  currentData: Uint8Array,
  width: number,
  height: number,
  shift: number,
  threshold: number,
): number {
  let count = 0;
  for (let y = 0; y < height; y++) {
    const y2 = y + shift;
    if (y2 < 0 || y2 >= height) {
      count += width;
      continue;
    }
    for (let x = 0; x < width; x++) {
      const idx1 = (y * width + x) * 4;
      const idx2 = (y2 * width + x) * 4;
      const dr = Math.abs(baselineData[idx1] - currentData[idx2]);
      const dg = Math.abs(baselineData[idx1 + 1] - currentData[idx2 + 1]);
      const db = Math.abs(baselineData[idx1 + 2] - currentData[idx2 + 2]);
      if ((dr + dg + db) / 3 > threshold * 255) count++;
    }
  }
  return count;
}

/**
 * Generate a compact 10x10 ASCII heatmap of diff distribution.
 */
function generateCompact(
  diffData: Uint8Array,
  width: number,
  height: number,
  diffPixels: number,
  totalPixels: number,
  regions: DiffRegion[],
): string {
  const gridSize = 10;
  const cellW = Math.ceil(width / gridSize);
  const cellH = Math.ceil(height / gridSize);
  const grid: number[][] = Array.from({ length: gridSize }, () => new Array(gridSize).fill(0));

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      // pixelmatch diff output: changed pixels are red (R=255,G=0,B=0),
      // unchanged pixels are white (R=255,G=255,B=255). Check G channel.
      if (diffData[idx + 1] < 128) {
        const gx = Math.min(Math.floor(x / cellW), gridSize - 1);
        const gy = Math.min(Math.floor(y / cellH), gridSize - 1);
        grid[gy][gx]++;
      }
    }
  }

  const matchPct = ((1 - diffPixels / totalPixels) * 100).toFixed(0);
  const lines = [`diff:${diffPixels}/${totalPixels}(${matchPct}%match)`];
  const cellTotal = cellW * cellH;
  for (let gy = 0; gy < gridSize; gy++) {
    lines.push(grid[gy].map((v) => (v > cellTotal * 0.05 ? "X" : ".")).join(""));
  }
  if (regions.length > 0) {
    const regionStrs = regions.map((r) => `${r.regionType || "content"}:${r.x},${r.y},${r.width}x${r.height}`);
    lines.push(`regions:${regionStrs.join(";")}`);
  }
  return lines.join("\n");
}

/**
 * Generate a comprehensive diff report including clustering, shift detection,
 * and region classification. Compatible with mizchi/pixelmatch 0.5.0 DiffReport format.
 */
export async function generateDiffReport(
  snapshot: VrtSnapshot,
  opts: {
    threshold?: number;
    outputDir?: string;
    skipHeatmap?: boolean;
    detectShift?: boolean;
  } = {},
): Promise<DiffReport | null> {
  if (!snapshot.baselinePath) return null;

  const r = await runPixelDiff(snapshot.baselinePath, snapshot.screenshotPath, snapshot.testId, opts);
  const regions = detectDiffRegions(r.diffOutput, r.width, r.height);

  // Shift detection
  let globalShift = 0;
  let shiftRegions: ShiftRegion[] = [];
  let compensated = r.diffPixels;

  if (opts.detectShift !== false && r.height > 4) {
    globalShift = detectGlobalShift(r.resizedBaseline, r.resizedCurrent);
    if (globalShift !== 0) {
      compensated = compensatedDiffCount(
        r.resizedBaseline.data, r.resizedCurrent.data,
        r.width, r.height, globalShift, r.threshold,
      );
      // Prefer per-band shifts when they reveal locally-varying offsets.
      // Falls back to the global single-band region if no band locks on.
      const bands = detectBandShifts(r.resizedBaseline, r.resizedCurrent);
      shiftRegions = bands.length > 0
        ? bands
        : [{ yStart: 0, yEnd: r.height, shift: globalShift }];
    }
  }

  const shiftOnly = regions.length > 0 && regions.every((rg) => rg.regionType === "shift" || rg.regionType === "edge");
  const contentChangeCount = regions.filter((rg) => rg.regionType === "content").length;
  const compact = generateCompact(r.diffOutput, r.width, r.height, r.diffPixels, r.totalPixels, regions);

  return {
    diffPixels: r.diffPixels,
    totalPixels: r.totalPixels,
    diffRatio: r.diffPixels / r.totalPixels,
    regions,
    shiftOnly,
    contentChangeCount,
    globalShift,
    shiftRegions,
    compensatedDiffCount: compensated,
    compact,
  };
}

/**
 * Whiteout detection: checks if most of the image is white (or a single color).
 */
export function detectWhiteout(
  data: PngData,
  opts: { threshold?: number } = {}
): { isWhiteout: boolean; whiteRatio: number } {
  const threshold = opts.threshold ?? 0.95;
  const { width, height, data: pixels } = data;
  const total = width * height;
  let whiteCount = 0;

  for (let i = 0; i < total; i++) {
    const offset = i * 4;
    const r = pixels[offset];
    const g = pixels[offset + 1];
    const b = pixels[offset + 2];
    // Treat (250+, 250+, 250+) as white
    if (r >= 250 && g >= 250 && b >= 250) {
      whiteCount++;
    }
  }

  const whiteRatio = whiteCount / total;
  return { isWhiteout: whiteRatio >= threshold, whiteRatio };
}

/**
 * Empty content detection: checks if the image has low entropy.
 */
export function detectEmptyContent(
  data: PngData,
  opts: { threshold?: number } = {}
): { isEmpty: boolean; uniqueColors: number } {
  const threshold = opts.threshold ?? 8;
  const colorSet = new Set<number>();
  const { width, height, data: pixels } = data;
  const total = width * height;

  // Sampling with stride (full scan is too expensive)
  const stride = Math.max(1, Math.floor(total / 10000));
  for (let i = 0; i < total; i += stride) {
    const offset = i * 4;
    const color =
      (pixels[offset] << 16) | (pixels[offset + 1] << 8) | pixels[offset + 2];
    colorSet.add(color);
  }

  return {
    isEmpty: colorSet.size <= threshold,
    uniqueColors: colorSet.size,
  };
}
