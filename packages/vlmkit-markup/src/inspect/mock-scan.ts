#!/usr/bin/env node
/**
 * Mock-image intake for markup work.
 *
 * The auto-markup / dynamic-markup loops assume @1x targets whose pixel
 * width IS the CSS viewport width. Real inputs rarely arrive that way:
 * Figma exports and macOS screenshots are @2x/@3x, and the design width
 * is implicit. Feeding a 2560px-wide retina export to `verify markup`
 * renders the attempt at a 2560px viewport and nothing converges.
 *
 * `scan mock` closes the gap deterministically:
 *
 *   - infers the device-pixel scale by matching width/scale against a
 *     table of common CSS viewport widths (override: --scale / --width)
 *   - writes a normalized @1x PNG (--out) via box-filter downscale
 *     (integer scales; average of the s×s block, so a nearest-neighbor
 *     2x upscale round-trips losslessly)
 *   - runs component extraction on the normalized image and reports
 *     whether the mock is extraction-friendly (a photo-heavy mock that
 *     crests into hundreds of components needs section-by-section work
 *     via `build component`, not the page loop)
 *
 * Deterministic: pixels only, no VLM.
 *
 * CLI:
 *   vlmkit scan mock <image.png> [--out normalized.png] [--scale N | --width N] [--json]
 */
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import { handleCliError } from "@mizchi/vlmkit-core/cli-error.ts";
import { appendRunLedger } from "@mizchi/vlmkit-core/run-ledger.ts";
import { BOLD, CYAN, DIM, GREEN, RESET, YELLOW } from "@mizchi/vlmkit-core/terminal-colors.ts";
import { extractComponentsFromRgba } from "../component/component-bbox.ts";
import { dominantPageColor } from "../component/page-compose.ts";

/**
 * Common CSS viewport widths (device-independent px). Sources: default
 * design-tool frames and mainstream device viewports. Used to score
 * scale hypotheses — a 2560px image whose /2 lands on 1280 is almost
 * certainly a 2x export.
 */
export const COMMON_CSS_WIDTHS = [
  320, 360, 375, 390, 393, 412, 414, 428, 440,
  768, 800, 810, 834, 900,
  1024, 1080, 1152, 1280, 1366, 1440, 1512, 1536, 1680, 1728, 1920,
];

export interface ScaleCandidate {
  scale: number;
  cssWidth: number;
  /** Why this candidate exists. */
  reason: string;
}

/**
 * Rank scale hypotheses for an image width. Integer scales only (1, 2,
 * 3); 1.5x displays exist but produce non-integer CSS px for most
 * widths — pass --width to force those. When both 1x and 2x land on
 * table widths (e.g. 1536 and 768), both candidates are returned and
 * the CALLER decides; we default to the LARGEST matching scale because
 * design exports are more commonly @2x than 1536px-wide @1x frames —
 * the report always prints the alternatives.
 */
export function inferScaleCandidates(imageWidth: number): ScaleCandidate[] {
  const candidates: ScaleCandidate[] = [];
  for (const scale of [3, 2, 1]) {
    if (imageWidth % scale !== 0) continue;
    const cssWidth = imageWidth / scale;
    if (COMMON_CSS_WIDTHS.includes(cssWidth)) {
      candidates.push({
        scale,
        cssWidth,
        reason: scale === 1
          ? `${cssWidth}px is a common CSS viewport width`
          : `${imageWidth} / ${scale} = ${cssWidth}px, a common CSS viewport width`,
      });
    }
  }
  if (candidates.length === 0) {
    candidates.push({ scale: 1, cssWidth: imageWidth, reason: "no common-width match; assuming @1x (override with --scale or --width)" });
  }
  return candidates;
}

/**
 * Box-filter integer downscale: each output pixel is the average of the
 * s×s source block. Chosen over nearest-neighbor because @2x exports
 * carry antialiased text whose alternate rows/columns nearest would
 * simply drop, and averaging inverts a nearest 2x upscale exactly.
 */
export function boxDownscale(
  src: { data: Uint8Array; width: number; height: number },
  scale: number,
): { data: Uint8Array; width: number; height: number } {
  if (!Number.isInteger(scale) || scale < 1) throw new Error(`Integer scale required, got ${scale}`);
  if (scale === 1) return src;
  const width = Math.floor(src.width / scale);
  const height = Math.floor(src.height / scale);
  const out = new Uint8Array(width * height * 4);
  const n = scale * scale;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const si = ((y * scale + dy) * src.width + (x * scale + dx)) * 4;
          r += src.data[si]!;
          g += src.data[si + 1]!;
          b += src.data[si + 2]!;
          a += src.data[si + 3]!;
        }
      }
      const di = (y * width + x) * 4;
      out[di] = Math.round(r / n);
      out[di + 1] = Math.round(g / n);
      out[di + 2] = Math.round(b / n);
      out[di + 3] = Math.round(a / n);
    }
  }
  return { data: out, width, height };
}

export interface MockScanReport {
  source: string;
  imageWidth: number;
  imageHeight: number;
  candidates: ScaleCandidate[];
  chosen: ScaleCandidate;
  scaleSource: "flag" | "width-flag" | "inferred";
  normalized: { width: number; height: number; out?: string };
  /** Extraction sanity on the normalized image. */
  extraction: {
    componentCount: number;
    dominantBackground: string;
    friendly: boolean;
  };
  advice: string[];
}

export interface MockScanOptions {
  source: string;
  out?: string;
  scale?: number;
  width?: number;
}

/** Components above this suggest a photo-heavy / noisy mock. */
const FRIENDLY_COMPONENT_CEILING = 24;

export async function runMockScan(options: MockScanOptions): Promise<MockScanReport> {
  const buf = await readFile(options.source);
  const png = PNG.sync.read(buf);
  const src = {
    data: new Uint8Array(png.data.buffer, png.data.byteOffset, png.data.byteLength),
    width: png.width,
    height: png.height,
  };

  const candidates = inferScaleCandidates(png.width);
  let chosen: ScaleCandidate;
  let scaleSource: MockScanReport["scaleSource"];
  if (options.scale !== undefined) {
    chosen = { scale: options.scale, cssWidth: Math.floor(png.width / options.scale), reason: "--scale flag" };
    scaleSource = "flag";
  } else if (options.width !== undefined) {
    const scale = png.width / options.width;
    if (!Number.isInteger(scale)) {
      throw new Error(
        `--width ${options.width} implies a non-integer scale (${png.width}/${options.width} = ${scale.toFixed(3)}); integer scales only — export the mock at @1x/@2x/@3x or crop to a multiple.`,
      );
    }
    chosen = { scale, cssWidth: options.width, reason: "--width flag" };
    scaleSource = "width-flag";
  } else {
    chosen = candidates[0]!;
    scaleSource = "inferred";
  }
  if (!Number.isInteger(chosen.scale) || chosen.scale < 1) {
    throw new Error(`Scale must be a positive integer, got ${chosen.scale}`);
  }

  const normalized = boxDownscale(src, chosen.scale);
  if (options.out) {
    const outPng = new PNG({ width: normalized.width, height: normalized.height });
    outPng.data = Buffer.from(normalized.data.buffer, normalized.data.byteOffset, normalized.data.byteLength);
    await writeFile(options.out, PNG.sync.write(outPng));
  }

  const background = dominantPageColor(normalized);
  const components = extractComponentsFromRgba(normalized.data, normalized.width, normalized.height, { background });
  const friendly = components.length <= FRIENDLY_COMPONENT_CEILING;

  const advice: string[] = [];
  if (scaleSource === "inferred" && candidates.length > 1) {
    advice.push(
      `Scale is ambiguous (${candidates.map((c) => `@${c.scale}x -> ${c.cssWidth}px`).join(", ")}); defaulted to @${chosen.scale}x. Pass --scale or --width if the design width is known.`,
    );
  }
  if (!friendly) {
    advice.push(
      `Extraction found ${components.length} components — the mock is likely photo-heavy or dense. Prefer section-by-section work: crop regions and drive each with \`build component\`; use the page loop only for the skeleton.`,
    );
  }
  if (!options.out) {
    advice.push("No --out given — pass one to write the normalized @1x PNG that `verify markup --target` should use.");
  }

  const report: MockScanReport = {
    source: options.source,
    imageWidth: png.width,
    imageHeight: png.height,
    candidates,
    chosen,
    scaleSource,
    normalized: { width: normalized.width, height: normalized.height, ...(options.out ? { out: options.out } : {}) },
    extraction: {
      componentCount: components.length,
      dominantBackground: `rgb(${background[0]},${background[1]},${background[2]})`,
      friendly,
    },
    advice,
  };
  appendRunLedger({
    tool: "scan-mock",
    source: options.source,
    ...(options.out ? { target: options.out } : {}),
    headline: {
      scale: chosen.scale,
      cssWidth: chosen.cssWidth,
      components: components.length,
      friendly,
    },
  });
  return report;
}

export function formatMockScanReport(report: MockScanReport): string {
  const lines: string[] = [];
  lines.push(`${BOLD}${CYAN}vlmkit scan mock${RESET}`);
  lines.push(`${DIM}source: ${report.source}${RESET}`);
  lines.push("");
  lines.push(`image: ${report.imageWidth}x${report.imageHeight}px`);
  lines.push(`scale: @${report.chosen.scale}x (${report.scaleSource}) — ${report.chosen.reason}`);
  if (report.candidates.length > 1) {
    lines.push(`${DIM}candidates: ${report.candidates.map((c) => `@${c.scale}x->${c.cssWidth}px`).join(", ")}${RESET}`);
  }
  lines.push(`normalized: ${report.normalized.width}x${report.normalized.height}px (CSS px)${report.normalized.out ? ` -> ${report.normalized.out}` : ""}`);
  lines.push(
    `extraction: ${report.extraction.componentCount} component(s), background ${report.extraction.dominantBackground} — ${report.extraction.friendly ? `${GREEN}extraction-friendly${RESET}` : `${YELLOW}noisy${RESET}`}`,
  );
  if (report.advice.length > 0) {
    lines.push("");
    lines.push("Advice:");
    for (const a of report.advice) lines.push(`  ${YELLOW}!${RESET} ${a}`);
  }
  lines.push("");
  lines.push(`Next: vlmkit verify markup <attempt.html> --target ${report.normalized.out ?? "<normalized.png>"}`);
  return lines.join("\n");
}

function printUsage(exitCode: number): never {
  console.log(`Usage: vlmkit scan mock <image.png> [options]

Mock-image intake: infer the device-pixel scale, write a normalized
@1x PNG for the markup loop, and report whether the mock is
extraction-friendly.

Options:
  --out <png>     Write the normalized @1x image here
  --scale <n>     Force the device-pixel scale (integer)
  --width <px>    Design width in CSS px (scale = image width / this)
  --json          Print JSON report`);
  process.exit(exitCode);
}

async function main(argv = process.argv.slice(2)): Promise<void> {
  if (argv.includes("--help") || argv.includes("-h")) printUsage(0);
  let out: string | undefined;
  let scale: number | undefined;
  let width: number | undefined;
  let json = false;
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--out") out = argv[++i]!;
    else if (arg === "--scale") scale = Number(argv[++i]);
    else if (arg === "--width") width = Number(argv[++i]);
    else if (arg === "--json") json = true;
    else if (!arg.startsWith("-")) positional.push(arg);
  }
  if (positional.length === 0) printUsage(1);
  const report = await runMockScan({
    source: positional[0]!,
    ...(out ? { out } : {}),
    ...(scale !== undefined ? { scale } : {}),
    ...(width !== undefined ? { width } : {}),
  });
  if (json) console.log(JSON.stringify(report, null, 2));
  else console.log(formatMockScanReport(report));
}

const isCliEntry = process.env.__VRT_DISPATCHER_LEAF__ === "mock-scan" ||
  (process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false);
if (isCliEntry) {
  main().catch(handleCliError);
}
