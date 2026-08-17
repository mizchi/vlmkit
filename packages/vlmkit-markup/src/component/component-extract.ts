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
 * Pairs with `vlmkit build component`: given a full-page
 * screenshot (e.g. a Figma export, competitor mockup, or user-
 * reported bug screenshot), extract the component you want, then
 * feed the cropped PNG to `component-from-image` as the target.
 *
 * Usage:
 *   vlmkit scan component <screenshot.png>
 *     # list components ranked by area
 *
 *   vlmkit scan component <screenshot.png> --crop 0
 *     # crop the largest (rank 0) component to <output-dir>/component-0.png
 *
 *   vlmkit scan component <screenshot.png> --crop-all
 *     # crop every component into separate PNGs
 *
 *   vlmkit scan component <screenshot.png> --at 640,320
 *     # crop the component containing the given (x, y) point
 *
 *   vlmkit scan component <hud.png> --preset game-ui
 *     # low-resolution / high-contrast frames with many small elements
 *     # (see EXTRACT_PRESETS in component-bbox.ts for the measurements)
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import {
  extractComponentsFromFile,
  DEFAULT_MIN_AREA,
  DEFAULT_TOP_N,
  EXTRACT_PRESETS,
  EXTRACT_PRESET_NAMES,
  isExtractPresetName,
  type ComponentBbox,
  type ExtractPresetName,
} from "./component-bbox.ts";
import { classifyRegion } from "../region-classify.ts";
import { handleCliError, UsageError } from "@mizchi/vlmkit-core/cli-error.ts";
import { DIM, RESET, GREEN, BOLD, CYAN } from "@mizchi/vlmkit-core/terminal-colors.ts";

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
  /**
   * Cap on how many components are reported, sorted by area desc. Default
   * inherits from the extractor (8). The single biggest lever on element-dense
   * frames — see `EXTRACT_PRESETS`.
   */
  topN?: number;
  /**
   * Named threshold bundle (`game-ui`). Explicit `minArea` / `topN` win over
   * the preset, so `--preset game-ui --top-n 40` is a legal widening.
   */
  preset?: ExtractPresetName;
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
  /** Thresholds actually applied, after preset resolution. */
  settings: { minArea: number; topN: number; preset?: ExtractPresetName };
  components: ExtractedComponent[];
  /**
   * Present when the frame is small enough that the default thresholds are
   * measurably leaving elements behind. See `probeSmallFrame`.
   */
  smallFrameHint?: SmallFrameHint;
  reportPath: string;
}

export interface SmallFrameHint {
  /** Components the `game-ui` preset finds that the applied settings did not. */
  extraComponents: number;
  /** Filled-pixel area of the largest component the applied `minArea` excluded. */
  largestExcludedArea: number;
  preset: ExtractPresetName;
}

/** `--min-area abc` used to reach the extractor as NaN, which filters everything out. */
function positiveInt(flag: string, raw: string | undefined): number {
  const n = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(n) || n < 1) {
    throw new UsageError(`${flag} expects a positive integer, got "${raw ?? ""}".`);
  }
  return n;
}

function parseArgs(argv: string[]) {
  let outputDir = "";
  let report = "";
  let cropRank: number | undefined;
  let cropAll = false;
  let pointXY: { x: number; y: number } | undefined;
  let cropPadding = 0;
  let minArea: number | undefined;
  let topN: number | undefined;
  let preset: ExtractPresetName | undefined;
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--output-dir") outputDir = argv[++i];
    else if (a === "--report") report = argv[++i];
    else if (a === "--crop") cropRank = parseInt(argv[++i] ?? "0", 10);
    else if (a === "--crop-all") cropAll = true;
    else if (a === "--crop-padding") cropPadding = parseInt(argv[++i] ?? "0", 10);
    else if (a === "--min-area") minArea = positiveInt(a, argv[++i]);
    else if (a === "--top-n") topN = positiveInt(a, argv[++i]);
    else if (a === "--preset") {
      const name = argv[++i] ?? "";
      if (!isExtractPresetName(name)) {
        throw new UsageError(
          `Unknown --preset "${name}". Available: ${EXTRACT_PRESET_NAMES.join(", ")}.`,
        );
      }
      preset = name;
    } else if (a === "--at") {
      const parts = (argv[++i] ?? "").split(",").map((s) => parseInt(s.trim(), 10));
      if (parts.length === 2 && parts.every(Number.isFinite)) {
        pointXY = { x: parts[0]!, y: parts[1]! };
      }
    } else positional.push(a);
  }
  return { positional, outputDir, report, cropRank, cropAll, pointXY, cropPadding, minArea, topN, preset };
}

/** Long side at or below which `probeSmallFrame` is worth running. */
const SMALL_FRAME_LONG_SIDE = 640;
/** Only advise the preset when it would find at least this many more components. */
const HINT_MIN_EXTRA = 4;

/**
 * Would the `game-ui` preset find materially more on this frame?
 *
 * The defaults cannot be made size-adaptive without mislabelling small page
 * renders (see `EXTRACT_PRESETS`), so instead of silently changing geometry the
 * tool measures the gap and says so. Gated on the long side because that is
 * what separates a game frame from a page screenshot — a full-page shot is tall
 * even when it is narrow (the repo's mobile fixture is 378x3919) — and because
 * the second extraction pass only costs anything on a large image. At 320x240 it
 * is 77k pixels, i.e. free.
 */
async function probeSmallFrame(
  sourcePath: string,
  width: number,
  height: number,
  applied: { minArea: number; topN: number },
  returnedCount: number,
): Promise<SmallFrameHint | undefined> {
  if (Math.max(width, height) > SMALL_FRAME_LONG_SIDE) return undefined;
  const preset = "game-ui" satisfies ExtractPresetName;
  const p = EXTRACT_PRESETS[preset];
  if (applied.minArea <= p.minArea && applied.topN >= p.topN) return undefined;
  const probed = await extractComponentsFromFile(sourcePath, p);
  const extraComponents = probed.length - returnedCount;
  if (extraComponents < HINT_MIN_EXTRA) return undefined;
  const largestExcludedArea = Math.max(
    0,
    ...probed.filter((c) => c.area < applied.minArea).map((c) => c.area),
  );
  return { extraComponents, largestExcludedArea, preset };
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

  // Preset first, explicit flags on top: `--preset game-ui --top-n 40` widens
  // the preset rather than being rejected as a conflict.
  const presetValues = options.preset ? EXTRACT_PRESETS[options.preset] : undefined;
  const settings = {
    minArea: options.minArea ?? presetValues?.minArea ?? DEFAULT_MIN_AREA,
    topN: options.topN ?? presetValues?.topN ?? DEFAULT_TOP_N,
    ...(options.preset ? { preset: options.preset } : {}),
  };
  const rawComponents = await extractComponentsFromFile(sourcePath, {
    minArea: settings.minArea,
    topN: settings.topN,
  });
  const smallFrameHint = await probeSmallFrame(
    sourcePath, sourcePng.width, sourcePng.height, settings, rawComponents.length,
  );

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
    settings,
    components,
    smallFrameHint,
  });
  await writeFile(reportPath, md);

  console.log(`  ${BOLD}${CYAN}vlmkit scan component${RESET}`);
  console.log(`  ${DIM}source: ${sourcePath} (${sourcePng.width}×${sourcePng.height})${RESET}`);
  console.log(`  ${DIM}settings: --min-area ${settings.minArea} --top-n ${settings.topN}${settings.preset ? ` (--preset ${settings.preset})` : ""}${RESET}`);
  console.log(`  ${DIM}found ${components.length} component(s)${RESET}`);
  for (const c of components.slice(0, 8)) {
    const fill = c.dominantColor?.hex ?? "—";
    const kind = c.kind ?? "—";
    const cropped = c.croppedPath ? ` ${GREEN}cropped${RESET} ${DIM}${c.croppedPath}${RESET}` : "";
    console.log(`  ${DIM}#${c.rank}  ${c.bbox.left},${c.bbox.top} ${c.bbox.width}×${c.bbox.height}  fill ${fill}  ${kind}${RESET}${cropped}`);
  }
  if (components.length > 8) console.log(`  ${DIM}…${components.length - 8} more${RESET}`);
  if (smallFrameHint) console.log(`  ${DIM}${smallFrameHintLine(smallFrameHint, settings)}${RESET}`);
  console.log(`  ${DIM}report: ${reportPath}${RESET}`);

  return {
    source: sourcePath,
    imageSize: { width: sourcePng.width, height: sourcePng.height },
    settings,
    components,
    ...(smallFrameHint ? { smallFrameHint } : {}),
    reportPath,
  };
}

function smallFrameHintLine(
  hint: SmallFrameHint,
  settings: { minArea: number; topN: number },
): string {
  const excluded = hint.largestExcludedArea > 0
    ? `; largest region below --min-area ${settings.minArea} is ${hint.largestExcludedArea}px`
    : "";
  return `small frame: --preset ${hint.preset} finds ${hint.extraComponents} more component(s)${excluded}`;
}

function renderReport(r: Omit<ComponentExtractReport, "reportPath">): string {
  const lines: string[] = [];
  lines.push("# Component extraction");
  lines.push("");
  lines.push(`Source: \`${r.source}\` (${r.imageSize.width}×${r.imageSize.height})`);
  lines.push("");
  lines.push(`Settings: \`--min-area ${r.settings.minArea} --top-n ${r.settings.topN}\`` +
    (r.settings.preset ? ` (\`--preset ${r.settings.preset}\`)` : ""));
  lines.push("");
  if (r.components.length === 0) {
    lines.push("## No components detected");
    lines.push("");
    lines.push("Either the image has no foreground content the connected-component " +
      "extractor recognizes, or every detected region was below the `--min-area` " +
      "threshold.");
    if (r.smallFrameHint) lines.push("", ...smallFrameHintSection(r.smallFrameHint, r.settings));
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
  if (r.smallFrameHint) lines.push(...smallFrameHintSection(r.smallFrameHint, r.settings), "");
  lines.push("## Suggested next step");
  lines.push("");
  lines.push("1. Visually verify the rank → component mapping (open the source PNG, " +
    "compare against the bbox column).");
  lines.push("2. Crop the component you want as a target: `vlmkit scan component " +
    "<src> --crop <rank>` (or `--at x,y` to crop by point).");
  lines.push("3. Feed the cropped PNG to `vlmkit build component <cropped> <your.html>` " +
    "to iterate against just that component.");
  lines.push("");
  return lines.join("\n");
}

export function smallFrameHintSection(
  hint: SmallFrameHint,
  settings: { minArea: number; topN: number },
): string[] {
  const p = EXTRACT_PRESETS[hint.preset];
  const lines = [
    `## Small frame — \`--preset ${hint.preset}\` finds ${hint.extraComponents} more`,
    "",
    `This frame is small enough that the default thresholds are the limit, not the ` +
    `image. \`--preset ${hint.preset}\` (\`--min-area ${p.minArea} --top-n ${p.topN}\`) ` +
    `returns ${hint.extraComponents} component(s) beyond the ${settings.minArea}/${settings.topN} ` +
    `run above.`,
  ];
  if (hint.largestExcludedArea > 0) {
    lines.push("", `The largest region excluded by \`--min-area ${settings.minArea}\` fills ` +
      `${hint.largestExcludedArea}px — for reference, a 12×12 HUD icon fills 144px and a ` +
      `10×10 one fills 100px.`);
  }
  lines.push("", "Ignore this if the frame is a page render rather than a game/pixel-art " +
    "frame: at page scale the extra components are usually individual glyphs.");
  return lines;
}

async function main(argv = process.argv.slice(2)) {
  // Remembered BEFORE the erase. Blanking argv is what routes `--help` to the usage
  // branch, and it is also what made `--help` indistinguishable from "you forgot the
  // arguments" — so the usage branch exited 1 either way. Asking for help is a request
  // that succeeded.
  const askedForHelp = argv[0] === "--help" || argv[0] === "-h";
  if (askedForHelp) argv = [];
  const { positional, outputDir, report, cropRank, cropAll, pointXY, cropPadding, minArea, topN, preset } = parseArgs(argv);
  if (positional.length === 0) {
    console.log("Usage: vlmkit scan component <screenshot.png> [options]");
    console.log("Options:");
    console.log("  --crop <rank>           Crop the rank-N component (e.g. --crop 0)");
    console.log("  --crop-all              Crop every detected component");
    console.log("  --at <x>,<y>            Crop the component containing the point");
    console.log("  --crop-padding <px>     Expand each crop bbox by N pixels (default 0)");
    console.log(`  --min-area <px>         Minimum filled area per component (default ${DEFAULT_MIN_AREA})`);
    console.log(`  --top-n <n>             Cap on reported components (default ${DEFAULT_TOP_N});`);
    console.log("                          the binding limit on element-dense frames");
    console.log(`  --preset <name>         Threshold bundle: ${EXTRACT_PRESET_NAMES.join(", ")}.`);
    console.log(`                          game-ui = --min-area ${EXTRACT_PRESETS["game-ui"].minArea} --top-n ${EXTRACT_PRESETS["game-ui"].topN},`);
    console.log("                          for low-resolution / high-contrast frames");
    console.log("  --output-dir <dir>      Default: ./test-results/component-extract");
    console.log("  --report <path>         Markdown report path");
    // 0 when help was asked for, 1 when the arguments are simply missing. Same two
    // lines of usage, two different answers to "did this invocation succeed".
    process.exit(askedForHelp ? 0 : 1);
  }
  await runComponentExtract({
    source: positional[0]!,
    outputDir: outputDir || join(process.cwd(), "test-results", "component-extract"),
    reportPath: report || undefined,
    cropRank, cropAll, pointXY, cropPadding, minArea, topN, preset,
  });
}

const isCliEntry = process.env.__VLMKIT_DISPATCHER_LEAF__ === "component-extract" || (process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false);
if (isCliEntry) {
  main().catch(handleCliError);
}
