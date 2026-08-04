#!/usr/bin/env node
/**
 * Generated-asset gate (`vlmkit check asset`).
 *
 * Deterministic, browser-free PNG checks for image assets that will be
 * slotted into markup — sprites, portraits, hero art — regardless of
 * where the pixels came from (an image-generation model, a designer, a
 * stock crop). Born from S19: the game screen's CSS-blob figures are
 * placeholders for generated character/enemy art, and the swap needs a
 * gate BEFORE the page-level gates (integrity A3 broken-resource, A13
 * occlusion, layout contract) see the asset in situ.
 *
 * Everything is pixel math on the decoded PNG:
 *   1. Slot fit (`--slot WxH`): aspect-ratio mismatch is a suspect
 *      (the slot would letterbox or distort); a source substantially
 *      smaller than the slot is an upscale warn.
 *   2. Background (`--expect-transparent`): the border ring tells the
 *      truth — a sprite meant to sit on the battlefield must be
 *      alpha-transparent at its edges, not matted onto a rectangle.
 *      Matte color is reported when the ring is opaque and uniform.
 *   3. Occupancy: share of non-transparent pixels + content bbox.
 *      Near-empty output (a common generation failure) is a suspect;
 *      full-bleed content under --expect-transparent is a warn.
 *   4. Figure-ground contrast (`--against-bg #rrggbb`): WCAG contrast
 *      of the asset's edge pixels against the backdrop it will sit on.
 *      A silhouette that melts into the background is a warn.
 *   5. Palette harmony (`--page-palette other.png`): share of the
 *      asset's dominant colors that sit near the page's palette
 *      (reuses the `check palette` extractor). Purely informational
 *      plus a low-harmony warn — art direction is a human call.
 *
 * CLI:
 *   vlmkit check asset <asset.png> [--slot WxH] [--expect-transparent]
 *     [--against-bg <#hex>] [--page-palette <png>] [--json] [--fail-on-suspect]
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import { extractPaletteFromFile, extractPaletteFromRgba, type PaletteColor } from "../style/palette-extract.ts";
import { handleCliError } from "@mizchi/vlmkit-core/cli-error.ts";
import { applyGateExit } from "@mizchi/vlmkit-core/gate-exit.ts";
import { appendRunLedger } from "@mizchi/vlmkit-core/run-ledger.ts";
import { BOLD, CYAN, DIM, GREEN, RED, RESET, YELLOW } from "@mizchi/vlmkit-core/terminal-colors.ts";

export type AssetIssueKind =
  | "aspect-mismatch"
  | "upscale"
  | "opaque-background"
  | "near-empty"
  | "full-bleed"
  | "low-figure-ground-contrast"
  | "palette-clash";

export interface AssetIssue {
  kind: AssetIssueKind;
  severity: "warn" | "suspect";
  message: string;
}

export interface AssetCheckReport {
  source: string;
  width: number;
  height: number;
  aspect: number;
  /** "transparent" | "matte" | "opaque-mixed" from the border ring. */
  backgroundKind: "transparent" | "matte" | "opaque-mixed";
  /** Dominant ring color when the ring is opaque. */
  matteColor?: string;
  /** Share of pixels with alpha >= 16. */
  occupancy: number;
  /** Bounding box of non-transparent content (absent when empty). */
  contentBox?: { x: number; y: number; w: number; h: number };
  /** WCAG contrast ratio of edge pixels vs --against-bg (when given). */
  edgeContrast?: number;
  /** Share of asset dominant colors near the page palette (when given). */
  paletteHarmony?: number;
  assetPalette?: PaletteColor[];
  issues: AssetIssue[];
}

const ALPHA_FLOOR = 16;

function luminance(r: number, g: number, b: number): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrastRatio(l1: number, l2: number): number {
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

export function parseHexColor(hex: string): { r: number; g: number; b: number } {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`--against-bg expects #rrggbb, got "${hex}"`);
  const n = parseInt(m[1]!, 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

export interface AnalyzeAssetOptions {
  source: string;
  slot?: { w: number; h: number };
  expectTransparent?: boolean;
  againstBg?: string;
  pagePalette?: PaletteColor[];
}

export function analyzeAssetPng(png: PNG, options: AnalyzeAssetOptions): AssetCheckReport {
  const { width, height, data } = png;
  const issues: AssetIssue[] = [];
  const at = (x: number, y: number) => (y * width + x) * 4;

  // --- border ring (2px) alpha + color ------------------------------------
  const ring: number[] = [];
  const ringDepth = Math.min(2, Math.max(1, Math.floor(Math.min(width, height) / 8)));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const onRing = x < ringDepth || y < ringDepth || x >= width - ringDepth || y >= height - ringDepth;
      if (onRing) ring.push(at(x, y));
    }
  }
  const ringTransparent = ring.filter((i) => data[i + 3]! < ALPHA_FLOOR).length / ring.length;
  let backgroundKind: AssetCheckReport["backgroundKind"];
  let matteColor: string | undefined;
  if (ringTransparent >= 0.95) {
    backgroundKind = "transparent";
  } else {
    const opaque = ring.filter((i) => data[i + 3]! >= ALPHA_FLOOR);
    const mean = { r: 0, g: 0, b: 0 };
    for (const i of opaque) { mean.r += data[i]!; mean.g += data[i + 1]!; mean.b += data[i + 2]!; }
    mean.r /= opaque.length; mean.g /= opaque.length; mean.b /= opaque.length;
    const spread = opaque.reduce((s, i) =>
      s + Math.max(Math.abs(data[i]! - mean.r), Math.abs(data[i + 1]! - mean.g), Math.abs(data[i + 2]! - mean.b)), 0) / opaque.length;
    const hex = (n: number) => Math.round(n).toString(16).padStart(2, "0");
    if (spread <= 12) {
      backgroundKind = "matte";
      matteColor = `#${hex(mean.r)}${hex(mean.g)}${hex(mean.b)}`;
    } else {
      backgroundKind = "opaque-mixed";
    }
  }

  // --- occupancy + content bbox --------------------------------------------
  let occupied = 0;
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[at(x, y) + 3]! >= ALPHA_FLOOR) {
        occupied++;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  const occupancy = occupied / (width * height);
  const contentBox = maxX >= 0 ? { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 } : undefined;

  // --- edge pixels (contour when transparent bg, else ring) -----------------
  let edgeContrast: number | undefined;
  if (options.againstBg) {
    const bg = parseHexColor(options.againstBg);
    const bgLum = luminance(bg.r, bg.g, bg.b);
    const edgeIdx: number[] = [];
    if (backgroundKind === "transparent") {
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const i = at(x, y);
          if (data[i + 3]! < ALPHA_FLOOR) continue;
          if (
            data[at(x - 1, y) + 3]! < ALPHA_FLOOR || data[at(x + 1, y) + 3]! < ALPHA_FLOOR ||
            data[at(x, y - 1) + 3]! < ALPHA_FLOOR || data[at(x, y + 1) + 3]! < ALPHA_FLOOR
          ) edgeIdx.push(i);
        }
      }
    } else {
      edgeIdx.push(...ring.filter((i) => data[i + 3]! >= ALPHA_FLOOR));
    }
    if (edgeIdx.length > 0) {
      const meanLum = edgeIdx.reduce((s, i) => s + luminance(data[i]!, data[i + 1]!, data[i + 2]!), 0) / edgeIdx.length;
      edgeContrast = contrastRatio(meanLum, bgLum);
    }
  }

  // --- palette harmony ------------------------------------------------------
  let paletteHarmony: number | undefined;
  const assetPalette = extractPaletteFromRgba(data, width, height, { topK: 8 });
  if (options.pagePalette && options.pagePalette.length > 0 && assetPalette.length > 0) {
    const near = (a: PaletteColor, b: PaletteColor) =>
      Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2) <= 96;
    const matched = assetPalette.filter((c) => options.pagePalette!.some((p) => near(c, p)));
    paletteHarmony = matched.length / assetPalette.length;
  }

  // --- issues ----------------------------------------------------------------
  if (options.slot) {
    const slotAspect = options.slot.w / options.slot.h;
    const aspect = width / height;
    const rel = Math.abs(aspect - slotAspect) / slotAspect;
    if (rel > 0.05) {
      issues.push({
        kind: "aspect-mismatch",
        severity: "suspect",
        message: `Asset aspect ${aspect.toFixed(3)} (${width}x${height}) differs from the slot's ${slotAspect.toFixed(3)} (${options.slot.w}x${options.slot.h}) by ${(rel * 100).toFixed(1)}% — the slot will letterbox or distort it. Regenerate at the slot's aspect ratio.`,
      });
    }
    if (width * 1.5 <= options.slot.w || height * 1.5 <= options.slot.h) {
      issues.push({
        kind: "upscale",
        severity: "warn",
        message: `Asset ${width}x${height} is well below the ${options.slot.w}x${options.slot.h} slot — it will be upscaled and soften. Regenerate at slot size or larger.`,
      });
    }
  }
  if (options.expectTransparent && backgroundKind !== "transparent") {
    issues.push({
      kind: "opaque-background",
      severity: "suspect",
      message: backgroundKind === "matte"
        ? `Expected a transparent background but the border ring is matted ${matteColor} — the sprite will show as a rectangle on the page. Regenerate with a transparent background (or cut it out).`
        : `Expected a transparent background but the border ring is opaque and mixed (looks like a full scene, not a cut-out sprite).`,
    });
  }
  if (occupancy < 0.05) {
    issues.push({
      kind: "near-empty",
      severity: "suspect",
      message: `Only ${(occupancy * 100).toFixed(1)}% of pixels are non-transparent — the generation likely failed or produced an empty canvas.`,
    });
  } else if (options.expectTransparent && occupancy > 0.98) {
    issues.push({
      kind: "full-bleed",
      severity: "warn",
      message: `Content covers ${(occupancy * 100).toFixed(1)}% of the canvas with no transparent margin — check that this is a cut-out and not a matted scene.`,
    });
  }
  if (edgeContrast !== undefined && edgeContrast < 1.5) {
    issues.push({
      kind: "low-figure-ground-contrast",
      severity: edgeContrast < 1.2 ? "suspect" : "warn",
      message: `Edge pixels contrast ${edgeContrast.toFixed(2)}:1 against the target backdrop ${options.againstBg} — the silhouette will melt into the background. Rim-light the edges or adjust the palette.`,
    });
  }
  if (paletteHarmony !== undefined && paletteHarmony < 0.25) {
    issues.push({
      kind: "palette-clash",
      severity: "warn",
      message: `Only ${(paletteHarmony * 100).toFixed(0)}% of the asset's dominant colors sit near the page palette — likely to clash. Art direction call; regenerate with the page palette in the prompt if unintended.`,
    });
  }

  return {
    source: options.source,
    width,
    height,
    aspect: width / height,
    backgroundKind,
    ...(matteColor ? { matteColor } : {}),
    occupancy,
    ...(contentBox ? { contentBox } : {}),
    ...(edgeContrast !== undefined ? { edgeContrast } : {}),
    ...(paletteHarmony !== undefined ? { paletteHarmony } : {}),
    assetPalette,
    issues,
  };
}

export interface AssetCheckOptions {
  source: string;
  slot?: { w: number; h: number };
  expectTransparent?: boolean;
  againstBg?: string;
  pagePalettePath?: string;
}

export async function runAssetCheck(options: AssetCheckOptions): Promise<AssetCheckReport> {
  const png = PNG.sync.read(await readFile(options.source) as Buffer);
  // Accent colors matter for harmony (a sprite usually matches the page's
  // accents, not its background washes), and accents sit far down the share
  // ranking — the S19 page's oranges ranked 19th-22nd. Extract generously.
  const pagePalette = options.pagePalettePath
    ? await extractPaletteFromFile(options.pagePalettePath, { topK: 24, minShare: 0.001 })
    : undefined;
  const report = analyzeAssetPng(png, {
    source: options.source,
    ...(options.slot ? { slot: options.slot } : {}),
    ...(options.expectTransparent ? { expectTransparent: true } : {}),
    ...(options.againstBg ? { againstBg: options.againstBg } : {}),
    ...(pagePalette ? { pagePalette } : {}),
  });
  appendRunLedger({
    tool: "asset-check",
    source: options.source,
    headline: {
      background: report.backgroundKind,
      occupancy: Number(report.occupancy.toFixed(3)),
      suspects: report.issues.filter((i) => i.severity === "suspect").length,
      warns: report.issues.filter((i) => i.severity === "warn").length,
    },
  });
  return report;
}

export function formatAssetCheckReport(report: AssetCheckReport): string {
  const lines: string[] = [];
  const status = report.issues.some((i) => i.severity === "suspect") ? "suspect"
    : report.issues.length > 0 ? "warn"
    : "ok";
  lines.push(`${BOLD}${CYAN}vlmkit check asset${RESET}`);
  lines.push(`${DIM}source: ${report.source}${RESET}`);
  lines.push("");
  lines.push(`status: ${status}`);
  lines.push(`size: ${report.width}x${report.height} (aspect ${report.aspect.toFixed(3)})`);
  lines.push(`background: ${report.backgroundKind}${report.matteColor ? ` (${report.matteColor})` : ""}`);
  lines.push(`occupancy: ${(report.occupancy * 100).toFixed(1)}%${report.contentBox ? ` — content ${report.contentBox.w}x${report.contentBox.h} at (${report.contentBox.x},${report.contentBox.y})` : ""}`);
  if (report.edgeContrast !== undefined) lines.push(`figure-ground contrast: ${report.edgeContrast.toFixed(2)}:1`);
  if (report.paletteHarmony !== undefined) lines.push(`palette harmony: ${(report.paletteHarmony * 100).toFixed(0)}% of dominant colors near the page palette`);
  if (report.issues.length > 0) {
    lines.push("");
    lines.push("Issues:");
    for (const issue of report.issues) {
      const icon = issue.severity === "suspect" ? `${RED}x${RESET}` : `${YELLOW}!${RESET}`;
      lines.push(`  ${icon} ${issue.kind}: ${issue.message}`);
    }
  } else {
    lines.push("");
    lines.push(`${GREEN}No asset issues detected.${RESET}`);
  }
  return lines.join("\n");
}

function printUsage(exitCode: number): never {
  console.log(`Usage: vlmkit check asset <asset.png> [options]

Deterministic PNG gate for image assets headed into markup slots
(generated sprites/portraits/hero art): slot aspect fit, transparent
vs matted background (border-ring measurement), occupancy + content
bbox, figure-ground contrast against the target backdrop, and palette
harmony vs a page screenshot. Browser-free pixel math — run it BEFORE
swapping the asset in; after the swap, check integrity / check layout
gate the page itself.

Options:
  --slot <WxH>            Target slot size, e.g. 220x300 (aspect + upscale checks)
  --expect-transparent    The asset must be a cut-out (transparent border ring)
  --against-bg <#rrggbb>  Backdrop the asset will sit on (silhouette contrast check)
  --page-palette <png>    Page screenshot to check palette harmony against
  --json                  Print JSON report
  --advisory              Print findings but exit 0 (default: a suspect exits 1)`);
  process.exit(exitCode);
}

async function main(argv = process.argv.slice(2)): Promise<void> {
  if (argv.includes("--help") || argv.includes("-h")) printUsage(0);
  let slot: { w: number; h: number } | undefined;
  let expectTransparent = false;
  let againstBg: string | undefined;
  let pagePalettePath: string | undefined;
  let json = false;
  let advisory = false;
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--slot") {
      const m = /^(\d+)x(\d+)$/.exec(argv[++i] ?? "");
      if (!m) { console.error("--slot expects WxH, e.g. 220x300"); process.exit(1); }
      slot = { w: Number(m[1]), h: Number(m[2]) };
    } else if (arg === "--expect-transparent") expectTransparent = true;
    else if (arg === "--against-bg") againstBg = argv[++i]!;
    else if (arg === "--page-palette") pagePalettePath = argv[++i]!;
    else if (arg === "--json") json = true;
    else if (arg === "--fail-on-suspect") { /* accepted no-op: suspects already fail */ }
    else if (arg === "--advisory") advisory = true;
    else if (!arg.startsWith("-")) positional.push(arg);
  }
  if (positional.length === 0) printUsage(1);

  const report = await runAssetCheck({
    source: positional[0]!,
    ...(slot ? { slot } : {}),
    ...(expectTransparent ? { expectTransparent: true } : {}),
    ...(againstBg ? { againstBg } : {}),
    ...(pagePalettePath ? { pagePalettePath } : {}),
  });
  if (json) console.log(JSON.stringify(report, null, 2));
  else console.log(formatAssetCheckReport(report));
  applyGateExit(report.issues.some((i) => i.severity === "suspect"), { advisory });
}

const isCliEntry = process.env.__VLMKIT_DISPATCHER_LEAF__ === "asset-check" ||
  (process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false);
if (isCliEntry) {
  main().catch(handleCliError);
}
