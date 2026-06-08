import { mkdir, readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { compareScreenshots } from "@mizchi/vlmkit-core/heatmap.ts";
import { readPngDimensions } from "@mizchi/vlmkit-core/image-resize.ts";
import { classifyVisualDiff } from "./visual-semantic.ts";
import {
  captureRegionElementsFromHtml,
  matchRegionBboxToElement,
  parseRegionElementsJson,
  parseRegionElementsViewport,
  type RegionElementRect,
  type RegionElementsViewport,
} from "./region-selector-match.ts";
import type { DiffRegion, VrtSnapshot } from "@mizchi/vlmkit-core/types.ts";

export interface PngDiffCliOptions {
  baselinePath: string;
  currentPath: string;
  outputDir: string;
  threshold: number;
  skipHeatmap: boolean;
  json: boolean;
  /** Path to a DOM bbox JSON; attach selector candidates to regions. */
  elementsJson?: string;
  /** URL or HTML file; capture DOM bboxes live (requires Playwright). */
  elementsHtml?: string;
  /** Viewport for --elements-html (defaults to the current PNG size). */
  elementsViewport?: RegionElementsViewport;
  /** Directory to write one baseline/current/diff crop triple per region. */
  cropRegions?: string;
}

export interface PngDiffRegionCrop {
  index: number;
  bbox: { x: number; y: number; width: number; height: number };
  baseline: string;
  current: string;
  diff: string;
}

class PngDiffCliError extends Error {
  readonly exitCode: number;

  constructor(message: string, exitCode: number) {
    super(message);
    this.exitCode = exitCode;
  }
}

export function formatPngDiffUsage(): string {
  return `vrt png-diff <baseline.png> <current.png>

Compare two existing PNG screenshots without launching Playwright.

Options:
  --output-dir <path>   Directory for generated heatmaps (default: test-results/png-diff)
  --threshold <0-1>     pixelmatch threshold (default: 0.1)
  --no-heatmap          Skip heatmap generation
  --json                Print JSON instead of a human-readable summary
  --elements-html <path-or-url>
                        Capture DOM bboxes from the live page and attach a
                        deterministic selector candidate to each diff region
                        (no VLM, no API key)
  --elements-json <path>
                        Same, from a pre-captured DOM bbox JSON
  --elements-viewport <WxH>
                        Viewport for --elements-html (default: current PNG size)
  --crop-regions <dir>  Write a baseline/current/diff crop triple per region
                        into <dir> for direct inspection (no VLM)`;
}

export function parsePngDiffArgs(args: string[]): PngDiffCliOptions {
  const positional: string[] = [];
  let outputDir = join(process.cwd(), "test-results", "png-diff");
  let threshold = 0.1;
  let skipHeatmap = false;
  let json = false;
  let elementsJson: string | undefined;
  let elementsHtml: string | undefined;
  let elementsViewport: RegionElementsViewport | undefined;
  let cropRegions: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    switch (arg) {
      case "--crop-regions": {
        const value = args[++i];
        if (!value) throw new PngDiffCliError(`Missing value for ${arg}\n\n${formatPngDiffUsage()}`, 1);
        cropRegions = value;
        break;
      }
      case "--elements-json": {
        const value = args[++i];
        if (!value) throw new PngDiffCliError(`Missing value for ${arg}\n\n${formatPngDiffUsage()}`, 1);
        elementsJson = value;
        break;
      }
      case "--elements-html": {
        const value = args[++i];
        if (!value) throw new PngDiffCliError(`Missing value for ${arg}\n\n${formatPngDiffUsage()}`, 1);
        elementsHtml = value;
        break;
      }
      case "--elements-viewport": {
        const value = args[++i];
        if (!value) throw new PngDiffCliError(`Missing value for ${arg}\n\n${formatPngDiffUsage()}`, 1);
        elementsViewport = parseRegionElementsViewport(value);
        break;
      }
      case "--help":
      case "-h":
        throw new PngDiffCliError(formatPngDiffUsage(), 0);
      case "--output":
      case "--output-dir": {
        const value = args[++i];
        if (!value) throw new PngDiffCliError(`Missing value for ${arg}\n\n${formatPngDiffUsage()}`, 1);
        outputDir = value;
        break;
      }
      case "--threshold": {
        const value = args[++i];
        const parsed = value ? Number(value) : Number.NaN;
        if (!value || !Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
          throw new PngDiffCliError(`Invalid --threshold value: ${value ?? ""}\n\n${formatPngDiffUsage()}`, 1);
        }
        threshold = parsed;
        break;
      }
      case "--no-heatmap":
        skipHeatmap = true;
        break;
      case "--json":
        json = true;
        break;
      default:
        if (arg.startsWith("--")) {
          throw new PngDiffCliError(`Unknown option: ${arg}\n\n${formatPngDiffUsage()}`, 1);
        }
        positional.push(arg);
        break;
    }
  }

  if (positional.length !== 2) {
    throw new PngDiffCliError(formatPngDiffUsage(), 1);
  }

  const [baselinePath, currentPath] = positional;
  return {
    baselinePath,
    currentPath,
    outputDir,
    threshold,
    skipHeatmap,
    json,
    ...(elementsJson ? { elementsJson } : {}),
    ...(elementsHtml ? { elementsHtml } : {}),
    ...(elementsViewport ? { elementsViewport } : {}),
    ...(cropRegions ? { cropRegions } : {}),
  };
}

async function resolveElements(
  options: PngDiffCliOptions,
  currentSize: { width: number; height: number },
): Promise<RegionElementRect[] | null> {
  if (options.elementsJson) {
    return parseRegionElementsJson(await readFile(options.elementsJson, "utf-8"));
  }
  if (options.elementsHtml) {
    return captureRegionElementsFromHtml(
      options.elementsHtml,
      options.elementsViewport ?? currentSize,
    );
  }
  return null;
}

function attachSelectorCandidates(regions: DiffRegion[], elements: RegionElementRect[]): void {
  for (const region of regions) {
    const match = matchRegionBboxToElement(
      { left: region.x, top: region.y, width: region.width, height: region.height },
      elements,
    );
    if (!match) continue;
    region.selectorCandidate = {
      selector: match.selector,
      confidence: match.confidence,
      path: match.evidence.path,
      tag: match.evidence.tag,
      regionCoverage: match.evidence.regionCoverage,
      elementCoverage: match.evidence.elementCoverage,
    };
  }
}

export async function runPngDiff(options: PngDiffCliOptions) {
  if (!options.skipHeatmap) {
    await mkdir(options.outputDir, { recursive: true });
  }

  const snapshot: VrtSnapshot = {
    testId: basename(options.currentPath, ".png") || "png-diff",
    testTitle: basename(options.currentPath),
    projectName: "vrt",
    screenshotPath: options.currentPath,
    baselinePath: options.baselinePath,
    status: "changed",
  };

  const diff = await compareScreenshots(snapshot, {
    outputDir: options.skipHeatmap ? undefined : options.outputDir,
    skipHeatmap: options.skipHeatmap,
    threshold: options.threshold,
  });
  if (!diff) {
    throw new Error("PNG diff requires both baseline and current screenshot paths");
  }

  const [baselineBuf, currentBuf] = await Promise.all([
    readFile(options.baselinePath),
    readFile(options.currentPath),
  ]);
  const baselineSize = readPngDimensions(baselineBuf);
  const currentSize = readPngDimensions(currentBuf);
  const sizeDelta = {
    width: currentSize.width - baselineSize.width,
    height: currentSize.height - baselineSize.height,
  };

  const elements = await resolveElements(options, currentSize);
  if (elements && elements.length > 0) {
    attachSelectorCandidates(diff.regions, elements);
  }

  const semantic = classifyVisualDiff(diff);

  let crops: PngDiffRegionCrop[] | undefined;
  if (options.cropRegions) {
    crops = await writeRegionCrops(options, diff.regions, diff.heatmapPath);
  }

  return { diff, semantic, baselineSize, currentSize, sizeDelta, crops };
}

/**
 * Write a baseline/current/diff crop triple per region so an agent can
 * inspect each region on a tall capture without hand-rolling a pngjs
 * cropper (A/B v1 draft 05). A small margin is added around each bbox for
 * context; the diff crop is taken from the heatmap when one was generated.
 */
async function writeRegionCrops(
  options: PngDiffCliOptions,
  regions: DiffRegion[],
  heatmapPath: string | undefined,
): Promise<PngDiffRegionCrop[]> {
  const dir = options.cropRegions!;
  await mkdir(dir, { recursive: true });

  const { decodePng, encodePng, cropRegion } = await import("@mizchi/vlmkit-core/png-utils.ts");
  const [baseline, current, heatmap] = await Promise.all([
    decodePng(options.baselinePath),
    decodePng(options.currentPath),
    heatmapPath ? decodePng(heatmapPath) : Promise.resolve(undefined),
  ]);

  const MARGIN = 8;
  const crops: PngDiffRegionCrop[] = [];
  for (let i = 0; i < regions.length; i++) {
    const r = regions[i]!;
    const x = r.x - MARGIN;
    const y = r.y - MARGIN;
    const w = r.width + MARGIN * 2;
    const h = r.height + MARGIN * 2;
    const tag = `region-${String(i).padStart(2, "0")}`;
    const baselineFile = join(dir, `${tag}-baseline.png`);
    const currentFile = join(dir, `${tag}-current.png`);
    const diffFile = join(dir, `${tag}-diff.png`);
    await encodePng(baselineFile, cropRegion(baseline, x, y, w, h));
    await encodePng(currentFile, cropRegion(current, x, y, w, h));
    // Fall back to the current crop when no heatmap was generated, so the
    // triple is always complete and the manifest paths always resolve.
    await encodePng(diffFile, cropRegion(heatmap ?? current, x, y, w, h));
    crops.push({
      index: i,
      bbox: { x: r.x, y: r.y, width: r.width, height: r.height },
      baseline: baselineFile,
      current: currentFile,
      diff: diffFile,
    });
  }
  return crops;
}

export async function runPngDiffCli(cliArgs = process.argv.slice(2)) {
  try {
    const options = parsePngDiffArgs(cliArgs);
    const result = await runPngDiff(options);
    const output = {
      status: result.diff.diffPixels === 0 ? "pass" : "changed",
      baselinePath: options.baselinePath,
      currentPath: options.currentPath,
      baselineSize: result.baselineSize,
      currentSize: result.currentSize,
      sizeDelta: result.sizeDelta,
      diffPixels: result.diff.diffPixels,
      totalPixels: result.diff.totalPixels,
      diffRatio: result.diff.diffRatio,
      regions: result.diff.regions,
      heatmapPath: result.diff.heatmapPath,
      summary: result.semantic.summary,
      changes: result.semantic.changes,
      ...(result.crops ? { crops: result.crops } : {}),
    };

    if (options.json) {
      console.log(JSON.stringify(output, null, 2));
      return;
    }

    console.log("PNG Diff");
    console.log(`  baseline: ${output.baselinePath}`);
    console.log(`  current:  ${output.currentPath}`);
    console.log(
      `  size:     baseline ${output.baselineSize.width}x${output.baselineSize.height}` +
      ` / current ${output.currentSize.width}x${output.currentSize.height}` +
      (output.sizeDelta.width !== 0 || output.sizeDelta.height !== 0
        ? ` (Δ ${formatSizeDelta(output.sizeDelta.width)}w ${formatSizeDelta(output.sizeDelta.height)}h)`
        : ""),
    );
    if (output.sizeDelta.height !== 0) {
      console.log(
        `  note:     height differs by ${formatSizeDelta(output.sizeDelta.height)}px — content reflow likely (an element gained or lost vertical space)`,
      );
    }
    console.log(`  diff:     ${(output.diffRatio * 100).toFixed(2)}% (${output.diffPixels} / ${output.totalPixels} px)`);
    console.log(`  regions:  ${output.regions.length}`);
    if (output.regions.length > 0) {
      for (const region of output.regions.slice(0, 15)) {
        const type = region.regionType ? ` [${region.regionType}]` : "";
        const color = region.colorSample && region.colorSample.baseline.hex !== region.colorSample.current.hex
          ? ` ${region.colorSample.baseline.hex} -> ${region.colorSample.current.hex}`
          : "";
        const shift = region.shift && (region.shift.dx !== 0 || region.shift.dy !== 0)
          ? ` shift(${region.shift.dx >= 0 ? "+" : ""}${region.shift.dx},${region.shift.dy >= 0 ? "+" : ""}${region.shift.dy})`
          : "";
        console.log(`    (${region.x},${region.y}) ${region.width}x${region.height}${type}${color}${shift}`);
      }
      if (output.regions.length > 15) {
        console.log(`    … ${output.regions.length - 15} more (use --json for all)`);
      }
    }
    const withSelectors = output.regions.filter((r) => r.selectorCandidate);
    if (withSelectors.length > 0) {
      console.log("  selectors:");
      for (const region of withSelectors.slice(0, 10)) {
        const c = region.selectorCandidate!;
        console.log(
          `    (${region.x},${region.y}) ${region.width}x${region.height} -> ${c.selector} (${c.confidence}, coverage ${c.regionCoverage})`,
        );
      }
    }
    console.log(`  summary:  ${output.summary}`);
    if (output.heatmapPath) {
      console.log(`  heatmap:  ${output.heatmapPath}`);
    }
    if (result.crops && result.crops.length > 0) {
      console.log(`  crops:    ${result.crops.length} region triple(s) in ${options.cropRegions}`);
    }
  } catch (error) {
    if (error instanceof PngDiffCliError) {
      if (error.exitCode === 0) {
        console.log(error.message);
      } else {
        console.error(error.message);
      }
      process.exit(error.exitCode);
    }
    throw error;
  }
}

function formatSizeDelta(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

if (process.env.__VRT_DISPATCHER_LEAF__ === "png-diff" || process.argv[1]?.endsWith("png-diff.ts")) {
  runPngDiffCli().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
