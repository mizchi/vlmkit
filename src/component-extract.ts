#!/usr/bin/env node
/**
 * Component extraction from a page screenshot.
 *
 * A pure image-processing tool that finds the major non-background
 * components in a screenshot (via the connected-component bbox
 * extractor from src/component-bbox.ts), annotates each with its
 * dominant color + content-kind classification, and optionally
 * crops a selected one to a standalone PNG.
 *
 * Pairs with `vrt component-from-image`: given a full-page
 * screenshot (e.g. a Figma export, competitor mockup, or user-
 * reported bug screenshot), extract the component you want, then
 * feed the cropped PNG to `component-from-image` as the target.
 *
 * Usage:
 *   vrt component-extract <screenshot.png>
 *     # list components ranked by area
 *
 *   vrt component-extract <screenshot.png> --crop 0
 *     # crop the largest (rank 0) component to <output-dir>/component-0.png
 *
 *   vrt component-extract <screenshot.png> --crop-all
 *     # crop every component into separate PNGs
 *
 *   vrt component-extract <screenshot.png> --at 640,320
 *     # crop the component containing the given (x, y) point
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import { extractComponentsFromFile, type ComponentBbox } from "./component-bbox.ts";
import { classifyRegion } from "./region-classify.ts";
import { handleCliError } from "./cli-error.ts";
import { DIM, RESET, GREEN, BOLD, CYAN } from "./terminal-colors.ts";

export interface ComponentExtractOptions {
  source: string;
  outputDir: string;
  reportPath?: string;
  /** Crop a specific rank to <name>.png. */
  cropRank?: number;
  /** Crop every detected component. */
  cropAll?: boolean;
  /** Crop the component whose bbox contains (x, y). */
  pointXY?: { x: number; y: number };
  /** Padding in px to expand each crop bbox. Default 0. */
  cropPadding?: number;
  /** Minimum area for a component to be reported. Default inherits from extractor. */
  minArea?: number;
}

export interface ExtractedComponent {
  rank: number;
  bbox: { top: number; left: number; width: number; height: number; area: number };
  dominantColor?: { hex: string; r: number; g: number; b: number };
  kind?: "text" | "filled-rect" | "icon" | "image" | "unknown";
  kindConfidence?: number;
  /** Path to the cropped PNG if crop was requested. */
  croppedPath?: string;
}

export interface ComponentExtractReport {
  source: string;
  imageSize: { width: number; height: number };
  components: ExtractedComponent[];
  reportPath: string;
}

function parseArgs(argv: string[]) {
  let outputDir = "";
  let report = "";
  let cropRank: number | undefined;
  let cropAll = false;
  let pointXY: { x: number; y: number } | undefined;
  let cropPadding = 0;
  let minArea: number | undefined;
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--output-dir") outputDir = argv[++i];
    else if (a === "--report") report = argv[++i];
    else if (a === "--crop") cropRank = parseInt(argv[++i] ?? "0", 10);
    else if (a === "--crop-all") cropAll = true;
    else if (a === "--crop-padding") cropPadding = parseInt(argv[++i] ?? "0", 10);
    else if (a === "--min-area") minArea = parseInt(argv[++i] ?? "0", 10);
    else if (a === "--at") {
      const parts = (argv[++i] ?? "").split(",").map((s) => parseInt(s.trim(), 10));
      if (parts.length === 2 && parts.every(Number.isFinite)) {
        pointXY = { x: parts[0]!, y: parts[1]! };
      }
    } else positional.push(a);
  }
  return { positional, outputDir, report, cropRank, cropAll, pointXY, cropPadding, minArea };
}

function findContainingRank(components: ComponentBbox[], x: number, y: number): number | undefined {
  // Find the smallest component whose bbox contains the point — the
  // most specific / inner element. Larger containers also match, but
  // the user usually wants the innermost.
  let bestRank: number | undefined;
  let bestArea = Infinity;
  for (let i = 0; i < components.length; i++) {
    const c = components[i]!;
    if (x >= c.left && x < c.left + c.width && y >= c.top && y < c.top + c.height) {
      const area = c.width * c.height;
      if (area < bestArea) { bestArea = area; bestRank = i; }
    }
  }
  return bestRank;
}

async function cropToFile(
  sourcePng: PNG, bbox: { left: number; top: number; width: number; height: number },
  outputPath: string, padding = 0,
): Promise<void> {
  const x0 = Math.max(0, bbox.left - padding);
  const y0 = Math.max(0, bbox.top - padding);
  const x1 = Math.min(sourcePng.width, bbox.left + bbox.width + padding);
  const y1 = Math.min(sourcePng.height, bbox.top + bbox.height + padding);
  const w = x1 - x0;
  const h = y1 - y0;
  const out = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) {
    const srcRow = ((y0 + y) * sourcePng.width + x0) * 4;
    const dstRow = (y * w) * 4;
    sourcePng.data.copy(out.data, dstRow, srcRow, srcRow + w * 4);
  }
  await writeFile(outputPath, PNG.sync.write(out));
}

export async function runComponentExtract(
  options: ComponentExtractOptions,
): Promise<ComponentExtractReport> {
  const outputDir = resolve(options.outputDir);
  await mkdir(outputDir, { recursive: true });
  const sourcePath = resolve(options.source);
  const sourceBuf = await readFile(sourcePath);
  const sourcePng = PNG.sync.read(sourceBuf);

  const rawComponents = await extractComponentsFromFile(sourcePath, {
    minArea: options.minArea,
  });

  // Determine which rank(s) to crop.
  const ranksToCrop = new Set<number>();
  if (options.cropAll) {
    for (let i = 0; i < rawComponents.length; i++) ranksToCrop.add(i);
  } else {
    if (typeof options.cropRank === "number") ranksToCrop.add(options.cropRank);
    if (options.pointXY) {
      const r = findContainingRank(rawComponents, options.pointXY.x, options.pointXY.y);
      if (r !== undefined) ranksToCrop.add(r);
    }
  }

  const components: ExtractedComponent[] = [];
  const baseName = basename(sourcePath, extname(sourcePath));
  for (let i = 0; i < rawComponents.length; i++) {
    const c = rawComponents[i]!;
    const bbox = { top: c.top, left: c.left, width: c.width, height: c.height, area: c.area };
    const cls = classifyRegion(sourcePng.data, sourcePng.width, sourcePng.height, bbox);
    const fill = c.fillColor; // already provided by extractor
    const ext: ExtractedComponent = {
      rank: i,
      bbox,
      kind: cls.kind,
      kindConfidence: Number(cls.confidence.toFixed(2)),
    };
    // The component-bbox extractor's `fillColor` is a CSS rgb() string;
    // parse to hex for consistency with the rest of the toolkit.
    const rgbMatch = fill && fill.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (rgbMatch) {
      const r = parseInt(rgbMatch[1]!, 10);
      const g = parseInt(rgbMatch[2]!, 10);
      const b = parseInt(rgbMatch[3]!, 10);
      const hex = "#" + [r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("");
      ext.dominantColor = { hex, r, g, b };
    }
    if (ranksToCrop.has(i)) {
      const cropPath = join(outputDir, `${baseName}-component-${i}.png`);
      await cropToFile(sourcePng, bbox, cropPath, options.cropPadding ?? 0);
      ext.croppedPath = cropPath;
    }
    components.push(ext);
  }

  const reportPath = options.reportPath ?? join(outputDir, "report.md");
  const md = renderReport({
    source: sourcePath,
    imageSize: { width: sourcePng.width, height: sourcePng.height },
    components,
  });
  await writeFile(reportPath, md);

  console.log(`  ${BOLD}${CYAN}vrt component-extract${RESET}`);
  console.log(`  ${DIM}source: ${sourcePath} (${sourcePng.width}×${sourcePng.height})${RESET}`);
  console.log(`  ${DIM}found ${components.length} component(s)${RESET}`);
  for (const c of components.slice(0, 8)) {
    const fill = c.dominantColor?.hex ?? "—";
    const kind = c.kind ?? "—";
    const cropped = c.croppedPath ? ` ${GREEN}cropped${RESET} ${DIM}${c.croppedPath}${RESET}` : "";
    console.log(`  ${DIM}#${c.rank}  ${c.bbox.left},${c.bbox.top} ${c.bbox.width}×${c.bbox.height}  fill ${fill}  ${kind}${RESET}${cropped}`);
  }
  if (components.length > 8) console.log(`  ${DIM}…${components.length - 8} more${RESET}`);
  console.log(`  ${DIM}report: ${reportPath}${RESET}`);

  return {
    source: sourcePath,
    imageSize: { width: sourcePng.width, height: sourcePng.height },
    components, reportPath,
  };
}

function renderReport(r: Omit<ComponentExtractReport, "reportPath">): string {
  const lines: string[] = [];
  lines.push("# Component extraction");
  lines.push("");
  lines.push(`Source: \`${r.source}\` (${r.imageSize.width}×${r.imageSize.height})`);
  lines.push("");
  if (r.components.length === 0) {
    lines.push("## No components detected");
    lines.push("");
    lines.push("Either the image has no foreground content the connected-component " +
      "extractor recognizes, or every detected region was below the `--min-area` " +
      "threshold.");
    return lines.join("\n");
  }
  lines.push(`Detected **${r.components.length}** component(s), ranked by area.`);
  lines.push("");
  lines.push("| Rank | Bbox | Fill | Kind | Cropped to |");
  lines.push("|---|---|---|---|---|");
  for (const c of r.components.slice(0, 30)) {
    const bb = `${c.bbox.left},${c.bbox.top} ${c.bbox.width}×${c.bbox.height}`;
    const fill = c.dominantColor ? `\`${c.dominantColor.hex}\`` : "—";
    const kind = c.kind ? `\`${c.kind}\`${c.kindConfidence !== undefined && c.kindConfidence < 0.6 ? "?" : ""}` : "—";
    const cropped = c.croppedPath ? `\`${c.croppedPath}\`` : "—";
    lines.push(`| #${c.rank} | ${bb} | ${fill} | ${kind} | ${cropped} |`);
  }
  if (r.components.length > 30) lines.push(`| _…${r.components.length - 30} more_ | | | | |`);
  lines.push("");
  lines.push("## Suggested next step");
  lines.push("");
  lines.push("1. Visually verify the rank → component mapping (open the source PNG, " +
    "compare against the bbox column).");
  lines.push("2. Crop the component you want as a target: `vrt component-extract " +
    "<src> --crop <rank>` (or `--at x,y` to crop by point).");
  lines.push("3. Feed the cropped PNG to `vrt component-from-image <cropped> <your.html>` " +
    "to iterate against just that component.");
  lines.push("");
  return lines.join("\n");
}

async function main(argv = process.argv.slice(2)) {
  const { positional, outputDir, report, cropRank, cropAll, pointXY, cropPadding, minArea } = parseArgs(argv);
  if (positional.length === 0) {
    console.log("Usage: vrt component-extract <screenshot.png> [options]");
    console.log("Options:");
    console.log("  --crop <rank>           Crop the rank-N component (e.g. --crop 0)");
    console.log("  --crop-all              Crop every detected component");
    console.log("  --at <x>,<y>            Crop the component containing the point");
    console.log("  --crop-padding <px>     Expand each crop bbox by N pixels (default 0)");
    console.log("  --min-area <px>         Minimum area for a component to be reported");
    console.log("  --output-dir <dir>      Default: ./test-results/component-extract");
    console.log("  --report <path>         Markdown report path");
    process.exit(1);
  }
  await runComponentExtract({
    source: positional[0]!,
    outputDir: outputDir || join(process.cwd(), "test-results", "component-extract"),
    reportPath: report || undefined,
    cropRank, cropAll, pointXY, cropPadding, minArea,
  });
}

const isCliEntry = process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;
if (isCliEntry) {
  main().catch(handleCliError);
}
