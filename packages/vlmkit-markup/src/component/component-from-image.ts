#!/usr/bin/env node
/**
 * Component-from-screenshot mode.
 *
 * Workflow:
 *   1. Designer / user provides a target PNG (e.g., from Figma export).
 *   2. Agent provides an HTML file (possibly empty scaffold).
 *   3. Tool renders the HTML at the target's viewport dimensions,
 *      pixel-diffs the rendered output against the target, and
 *      surfaces all image-only signals (bbox, palette, heatmap,
 *      text-row) plus an optional multi-state pass.
 *   4. Agent iterates the HTML until the diff converges.
 *
 * Unlike `vrt compare` (migration mode), this scenario:
 *   - has no DOM correspondence — the target is a static PNG.
 *   - runs at a single viewport sized to the target image.
 *   - skips paint-tree, DOM-equivalence, breakpoint-discovery, etc.
 *     — none of them apply when the baseline isn't HTML.
 *   - emits a slim markdown report directly (no separate
 *     diff-for-agent pass needed).
 *
 * Usage:
 *   vlmkit build component <target.png> <current.html>
 *   vlmkit build component <target.png> <current.html> --output report.md
 *   vlmkit build component <target.png> <current.html> --states hover focus-visible
 */
import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import { chromium, type Page } from "playwright";
import { compareScreenshots } from "@mizchi/vlmkit-core/heatmap.ts";
import {
  compareLandscapeFromPngFiles,
  type LandscapeDiffResult,
} from "../landscape-diff.ts";
import {
  extractComponentsFromFile,
  matchComponents,
  type MatchedBbox,
} from "./component-bbox.ts";
import { findHeatmapRegionsFromFile, type HeatmapRegion } from "@mizchi/vlmkit-core/heatmap-regions.ts";
import { annotateHeatmapRegionKinds } from "../heatmap-region-kinds.ts";
import { extractTextRowsFromFile, matchTextRows, computeRowGapDeltas, compareRowTypography, type MatchedTextRow, type RowGapDelta, type TypographyMismatch } from "@mizchi/vlmkit-core/text-rows.ts";
import { extractPaletteFromFile, findDominantBackgroundsFromFile, type PaletteColor, type DominantBackgrounds } from "../style/palette-extract.ts";
import { diffPalettes, type PaletteDiff } from "../style/palette-diff.ts";
import {
  applyForcedPseudoState,
  clearStateMarkers,
  type ForcedPseudoState,
} from "../stress/multi-state.ts";
import {
  buildSemanticDrilldown,
  captureLandmarkRegions,
  captureScrollportRegions,
  describeLandmarkLayoutContract,
  describeScrollportStatus,
  selectNextSemanticDrilldown,
  type LandmarkRegion,
  type SemanticDrilldownEntry,
  type ScrollportRegion,
} from "./semantic-drilldown.ts";
import {
  evaluateComponentGoal,
  listComponentGoals,
  type ComponentGoalEvaluation,
  type ComponentCanvasEvidence,
  type ComponentExpectedScrollportEvidence,
  type ComponentExpressiveMenuEvidence,
  type ComponentLandingEvidence,
  type ComponentScrollportEvidence,
} from "./component-goal.ts";
import {
  type UiExpectedScrollportContract,
} from "../contract/ui-contract.ts";
import {
  isComponentProbeState,
  loadComponentContractPlan,
  mergeComponentProbeStates,
  type ComponentProbeState,
} from "./component-contract-plan.ts";
import { captureCanvasEvidence } from "./component-canvas-evidence.ts";
import type { VrtSnapshot } from "@mizchi/vlmkit-core/types.ts";
import { DIM, RESET, GREEN, RED, YELLOW, BOLD, CYAN } from "@mizchi/vlmkit-core/terminal-colors.ts";
import { handleCliError } from "@mizchi/vlmkit-core/cli-error.ts";

export {
  deriveComponentContractPlan,
  deriveComponentContractRuntime,
  type ComponentContractPlan,
  type ComponentContractRuntime,
  type ComponentProbeState,
} from "./component-contract-plan.ts";

export interface ComponentFromImageOptions {
  targetImagePath: string;
  currentHtmlPath: string;
  outputDir: string;
  /** Markdown report path. Default: `${outputDir}/report.md`. */
  reportPath?: string;
  /** Interaction states to additionally capture. Empty = none. */
  states?: ComponentProbeState[];
  /** Pixelmatch sensitivity (0..1). Default 0.03 (stricter than VRT default). */
  threshold?: number;
  /** Convergence goal used for pass/review/fail reporting. Default: app. */
  goal?: string;
  /** Optional UI Contract JSON. Its screen goal, required states, and expected scrollports can fill omitted CLI flags. */
  contractPath?: string;
  /**
   * Device pixel ratio for capture. Default 1. Use 2 to simulate
   * retina rendering — catches blurry low-res image assets that
   * stretch on high-DPI displays. The target PNG should be captured
   * at the same DPR for the diff to be meaningful.
   */
  deviceScaleFactor?: number;
}

export interface ComponentFromImageReport {
  targetImage: string;
  currentHtml: string;
  viewport: { width: number; height: number };
  diff: {
    diffPixels: number;
    totalPixels: number;
    diffRatio: number;
  };
  landscapeDiff: LandscapeDiffResult;
  goalEvaluation: ComponentGoalEvaluation;
  landmarkRegions: LandmarkRegion[];
  scrollportRegions: ScrollportRegion[];
  landingEvidence?: ComponentLandingEvidence;
  canvasEvidence?: ComponentCanvasEvidence;
  expressiveMenuEvidence?: ComponentExpressiveMenuEvidence;
  semanticDrilldown: SemanticDrilldownEntry[];
  bboxMatches: MatchedBbox[];
  heatmapRegions: HeatmapRegion[];
  textRowMatches: MatchedTextRow[];
  rowGapDeltas: RowGapDelta[];
  typographyMismatches: TypographyMismatch[];
  baselineRowCount: number;
  variantRowCount: number;
  paletteDiff: PaletteDiff & { baseline: PaletteColor[]; variant: PaletteColor[] };
  states?: Array<{
    state: ComponentProbeState;
    forcedCount: number;
    inducedDiffRatio: number;
    /** Pixels with any RGB channel delta ≥ 4 (no perceptual filter). */
    rawInducedDiffRatio: number;
    /** Fraction of diff pixels within 4px of any forced-element bbox perimeter. */
    edgeFraction: number;
    /** Count of diff pixels well inside (not on perimeter of) any forced bbox. */
    interiorPixels: number;
    /** Mean luma at state minus mean luma at default, averaged over forced bbox interiors. Null if no bboxes. Negative = darker on state. */
    lumaDelta: number | null;
    lumaBefore: number | null;
    lumaAfter: number | null;
  }>;
  reportPath: string;
}

export interface DeviceScaleFactorSuggestion {
  deviceScaleFactor: number;
  cssViewport: { width: number; height: number };
  reason: string;
}

interface ExpressiveMenuPixelSample {
  bbox: { x: number; y: number; width: number; height: number };
  color: [number, number, number];
}

interface ExpressiveMenuEvidenceWithSamples extends ComponentExpressiveMenuEvidence {
  menuItemSamples?: ExpressiveMenuPixelSample[];
}

export interface PixelContrastInput {
  bbox: { x: number; y: number; width: number; height: number };
  color: [number, number, number];
  dpr?: number;
}

export interface PixelContrastResult {
  background: [number, number, number] | null;
  contrastRatio: number | null;
  sampledPixels: number;
}

export function sampleContrastFromImage(
  png: PNG,
  input: PixelContrastInput,
): PixelContrastResult {
  const dpr = input.dpr ?? 1;
  const x0 = Math.max(0, Math.floor(input.bbox.x * dpr));
  const y0 = Math.max(0, Math.floor(input.bbox.y * dpr));
  const x1 = Math.min(png.width, Math.ceil((input.bbox.x + input.bbox.width) * dpr));
  const y1 = Math.min(png.height, Math.ceil((input.bbox.y + input.bbox.height) * dpr));
  if (x1 <= x0 || y1 <= y0) {
    return { background: null, contrastRatio: null, sampledPixels: 0 };
  }

  const buckets = new Map<string, { rgb: [number, number, number]; count: number }>();
  const step = Math.max(1, Math.floor(Math.min(x1 - x0, y1 - y0) / 32));
  let sampledPixels = 0;
  for (let y = y0; y < y1; y += step) {
    for (let x = x0; x < x1; x += step) {
      const i = (y * png.width + x) * 4;
      const a = png.data[i + 3] ?? 0;
      if (a < 128) continue;
      const rgb: [number, number, number] = [
        png.data[i] ?? 0,
        png.data[i + 1] ?? 0,
        png.data[i + 2] ?? 0,
      ];
      if (rgbDistance(rgb, input.color) < 35) continue;
      const quantized = quantizeRgb(rgb, 8);
      const key = quantized.join(",");
      const bucket = buckets.get(key);
      if (bucket) bucket.count++;
      else buckets.set(key, { rgb: quantized, count: 1 });
      sampledPixels++;
    }
  }

  let best: { rgb: [number, number, number]; count: number } | undefined;
  for (const bucket of buckets.values()) {
    if (!best || bucket.count > best.count) best = bucket;
  }
  if (!best) {
    return { background: null, contrastRatio: null, sampledPixels };
  }
  return {
    background: best.rgb,
    contrastRatio: contrastRatio(input.color, best.rgb),
    sampledPixels,
  };
}

function quantizeRgb(rgb: [number, number, number], step: number): [number, number, number] {
  return [
    quantizeChannel(rgb[0], step),
    quantizeChannel(rgb[1], step),
    quantizeChannel(rgb[2], step),
  ];
}

function quantizeChannel(value: number, step: number): number {
  return Math.max(0, Math.min(255, Math.round(value / step) * step));
}

function rgbDistance(a: [number, number, number], b: [number, number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function relativeLuma(rgb: [number, number, number]): number {
  const channel = (value: number): number => {
    const normalized = value / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
}

function contrastRatio(a: [number, number, number], b: [number, number, number]): number {
  const high = Math.max(relativeLuma(a), relativeLuma(b));
  const low = Math.min(relativeLuma(a), relativeLuma(b));
  return (high + 0.05) / (low + 0.05);
}

export function suggestDeviceScaleFactorForTarget(
  viewport: { width: number; height: number },
): DeviceScaleFactorSuggestion | undefined {
  if (viewport.height <= viewport.width) return undefined;
  if (viewport.width < 720) return undefined;

  const candidates = [2, 3];
  const commonMobileWidths = [360, 375, 390, 393, 414, 430, 432];
  let best: { dpr: number; cssWidth: number; distance: number } | undefined;
  for (const dpr of candidates) {
    const cssWidth = viewport.width / dpr;
    if (cssWidth < 320 || cssWidth > 520) continue;
    const distance = Math.min(...commonMobileWidths.map((w) => Math.abs(w - cssWidth)));
    if (!best || distance < best.distance) {
      best = { dpr, cssWidth, distance };
    }
  }
  if (!best) return undefined;
  return {
    deviceScaleFactor: best.dpr,
    cssViewport: {
      width: Math.round(viewport.width / best.dpr),
      height: Math.round(viewport.height / best.dpr),
    },
    reason: `portrait target ${viewport.width}×${viewport.height} looks like a ${best.dpr}x mobile mock`,
  };
}

function readAttr(tag: string, name: string): string | undefined {
  const re = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, "i");
  const m = tag.match(re);
  return m?.[1] ?? m?.[2] ?? m?.[3];
}

function isStylesheetLink(tag: string): boolean {
  if (!/^<link\b/i.test(tag)) return false;
  const rel = readAttr(tag, "rel");
  if (!rel) return false;
  return rel.split(/\s+/).some((part) => part.toLowerCase() === "stylesheet");
}

function isLocalStylesheetHref(href: string): boolean {
  if (!href) return false;
  if (href.startsWith("#") || href.startsWith("//")) return false;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/u.test(href)) return false;
  return true;
}

export async function inlineLocalStylesheets(
  html: string,
  htmlPath: string,
): Promise<string> {
  const baseDir = dirname(resolve(htmlPath));
  const linkTags = html.match(/<link\b[^>]*>/gi) ?? [];
  let out = html;

  for (const tag of linkTags) {
    if (!isStylesheetLink(tag)) continue;
    const href = readAttr(tag, "href");
    if (!href || !isLocalStylesheetHref(href)) continue;

    const [pathname] = href.split(/[?#]/u);
    if (!pathname) continue;
    const cssPath = resolve(baseDir, pathname);
    const css = await readFile(cssPath, "utf-8");
    const escapedHref = href.replace(/"/g, "&quot;");
    const styleTag = `<style data-vlmkit-inline-stylesheet="${escapedHref}">\n${css}\n</style>`;
    out = out.replace(tag, styleTag);
  }

  return out;
}

function parseArgs(argv: string[]) {
  const positional: string[] = [];
  const states: ComponentProbeState[] = [];
  let outputDir = "";
  let report = "";
  let contract = "";
  let threshold = 0.03;
  let goal: string | undefined;
  let deviceScaleFactor: number | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--output-dir") outputDir = argv[++i];
    else if (a === "--report") report = argv[++i];
    else if (a === "--contract" || a === "--ui-contract") contract = argv[++i] ?? "";
    else if (a === "--threshold") threshold = parseFloat(argv[++i] ?? "0.03");
    else if (a === "--goal") goal = argv[++i] ?? "app";
    else if (a === "--device-scale-factor" || a === "--dpr") {
      deviceScaleFactor = parseFloat(argv[++i] ?? "1");
    }
    else if (a === "--states") {
      while (i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
        const v = argv[++i];
        if (isComponentProbeState(v)) {
          states.push(v);
        }
      }
    } else {
      positional.push(a);
    }
  }
  return { positional, outputDir, report, contract, threshold, goal, states, deviceScaleFactor };
}

export async function runComponentFromImage(
  options: ComponentFromImageOptions,
): Promise<ComponentFromImageReport> {
  const outputDir = resolve(options.outputDir);
  await mkdir(outputDir, { recursive: true });
  const contractPlan = await loadComponentContractPlan(options.contractPath);
  const effectiveGoal = options.goal ?? contractPlan.goal ?? "app";
  const effectiveStates = mergeComponentProbeStates(options.states, contractPlan.probes.states);

  const targetPath = resolve(options.targetImagePath);
  const targetPng = PNG.sync.read(await readFile(targetPath));
  const viewport = { width: targetPng.width, height: targetPng.height };

  // Copy the target PNG into outputDir so the report's relative-path
  // references all resolve from one place.
  const targetCopyPath = join(outputDir, `target${extname(targetPath)}`);
  await copyFile(targetPath, targetCopyPath);

  const htmlPath = resolve(options.currentHtmlPath);
  const html = await inlineLocalStylesheets(await readFile(htmlPath, "utf-8"), htmlPath);

  console.log(`  ${BOLD}${CYAN}vlmkit build component${RESET}`);
  console.log(`  ${DIM}target:  ${targetPath} (${viewport.width}×${viewport.height})${RESET}`);
  console.log(`  ${DIM}current: ${htmlPath}${RESET}`);

  // When --device-scale-factor is set, the target image dimensions
  // already include the scale (e.g. a 2× target at 1280px wide
  // CSS-px is 2560px wide pixels). Pass the CSS-px viewport so the
  // page lays out at the *intended* dimensions, but render at the
  // higher dpr.
  const dpr = options.deviceScaleFactor ?? 1;
  const dprSuggestion = options.deviceScaleFactor === undefined
    ? suggestDeviceScaleFactorForTarget(viewport)
    : undefined;
  const cssViewport = dpr > 1
    ? { width: Math.round(viewport.width / dpr), height: Math.round(viewport.height / dpr) }
    : viewport;

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: cssViewport,
      deviceScaleFactor: dpr,
    });
    await page.setContent(html, { waitUntil: "networkidle" });
    const landmarkRegions = await captureLandmarkRegions(page, {
      deviceScaleFactor: dpr,
    }).catch(() => []);
    const scrollportRegions = await captureScrollportRegions(page, {
      deviceScaleFactor: dpr,
    }).catch(() => []);
    const landingEvidence = await captureLandingEvidence(page).catch(() => undefined);
    const expressiveMenuEvidence = await captureExpressiveMenuEvidence(page).catch(() => undefined);
    const currentPath = join(outputDir, "current.png");
    // Rest-pose capture: finite animations fast-forwarded, infinite ones at
    // initial state — an entrance animation caught mid-flight poisons the
    // pixel diff (S5-r2 finding, same fix as `build page`).
    await page.screenshot({ path: currentPath, fullPage: false, animations: "disabled" });
    const canvasEvidence = await captureCanvasEvidence(page, contractPlan.expectations.canvas).catch(() => undefined);
    await page.close();

    // Pixel diff against the target.
    const snap: VrtSnapshot = {
      testId: "component",
      testTitle: "component-from-image",
      projectName: "component-from-image",
      screenshotPath: currentPath,
      baselinePath: targetCopyPath,
      status: "changed",
    };
    const diff = await compareScreenshots(snap, {
      outputDir,
      threshold: options.threshold ?? 0.03,
    });
    const diffRatio = diff?.diffRatio ?? 0;
    const diffPixels = diff?.diffPixels ?? 0;
    const totalPixels = diff?.totalPixels ?? (viewport.width * viewport.height);
    const heatmapPath = join(outputDir, "component_heatmap.png");
    const landscapeDiff = await compareLandscapeFromPngFiles(targetCopyPath, currentPath);
    const scrollportEvidence = summarizeScrollportEvidence(scrollportRegions, contractPlan.expectations.scrollports);

    // All image-only signals run identically on both files.
    const [bboxBaseline, bboxVariant] = await Promise.all([
      extractComponentsFromFile(targetCopyPath).catch(() => []),
      extractComponentsFromFile(currentPath).catch(() => []),
    ]);
    const bboxMatches = matchComponents(bboxBaseline, bboxVariant);

    let heatmapRegions: HeatmapRegion[] = [];
    try {
      heatmapRegions = await findHeatmapRegionsFromFile(heatmapPath, {}, targetCopyPath);
      await annotateHeatmapRegionKinds(heatmapRegions, targetCopyPath);
    } catch {
      // Heatmap may be absent when diff is zero.
    }
    const semanticDrilldown = buildSemanticDrilldown({
      landmarks: landmarkRegions,
      landscapeCells: landscapeDiff.topCells,
      heatmapRegions,
    });

    const [targetRows, currentRows] = await Promise.all([
      extractTextRowsFromFile(targetCopyPath).catch(() => []),
      extractTextRowsFromFile(currentPath).catch(() => []),
    ]);
    const textRowMatches = matchTextRows(targetRows, currentRows);
    const rowGapDeltas = computeRowGapDeltas(targetRows, currentRows);
    const typographyMismatches = compareRowTypography(targetRows, currentRows);

    const [targetPalette, currentPalette] = await Promise.all([
      extractPaletteFromFile(targetCopyPath).catch(() => []),
      extractPaletteFromFile(currentPath).catch(() => []),
    ]);
    const paletteDiff = diffPalettes(targetPalette, currentPalette);

    // Explicit outer/inner background pair — subagent dogfood noted
    // this was buried in the "missing palette" list.
    const [targetBg, currentBg] = await Promise.all([
      findDominantBackgroundsFromFile(targetCopyPath).catch(() => undefined),
      findDominantBackgroundsFromFile(currentPath).catch(() => undefined),
    ]);

    // Optional multi-state pass (current side only — we have no
    // baseline HTML to force states on).
    // Raw RGB diff helper — counts any pixel where any channel differs
    // by ≥ minChannelDelta. Bypasses pixelmatch's perceptual/AA filter
    // so we surface the "did anything at all change?" signal that the
    // 0.03 threshold can swallow on subtle hovers. From subagent H
    // dogfood: even with transitions disabled, a clear `:hover` rule
    // can register low under the perceptual threshold; raw diff shows
    // unambiguously when something changed.
    async function countRawDiff(pathA: string, pathB: string, minChannelDelta = 4): Promise<{ ratio: number; pixels: number; total: number }> {
      const [bufA, bufB] = await Promise.all([readFile(pathA), readFile(pathB)]);
      const pA = PNG.sync.read(bufA);
      const pB = PNG.sync.read(bufB);
      const total = (pA.width * pA.height);
      if (pA.data.length !== pB.data.length) return { ratio: 0, pixels: 0, total };
      let count = 0;
      for (let i = 0; i < pA.data.length; i += 4) {
        const dr = Math.abs(pA.data[i]! - pB.data[i]!);
        const dg = Math.abs(pA.data[i + 1]! - pB.data[i + 1]!);
        const db = Math.abs(pA.data[i + 2]! - pB.data[i + 2]!);
        if (dr >= minChannelDelta || dg >= minChannelDelta || db >= minChannelDelta) count++;
      }
      return { ratio: count / total, pixels: count, total };
    }

    /**
     * Classify the state-induced diff pixels by their position
     * relative to the forced-element bboxes. Returns the fraction of
     * diff pixels that lie within `edgeWidth` (px) of any bbox
     * perimeter (= "edge", typically the UA default outline) vs
     * inside the bboxes away from the perimeter (= "interior",
     * typically author background/text/border changes).
     *
     * Subagent H concern: UA-default `:focus-visible` outline alone
     * clears the suspect flag, masking missing author CSS. When
     * edge >> interior, the state is likely UA-only — flag as such.
     */
    /**
     * Mean interior luminance over all forced bboxes, sampled from a
     * given image. Used to detect "wrong-direction" hover: if the
     * variant's hover *lightens* a vibrant button instead of darkening
     * it, the shift goes in a typically-incorrect direction. Subagent
     * H concern: "hover that shifts the wrong way (lighter on light bg)
     * reads as fine because we have no reference for hover state."
     * Surface the direction so the agent can verify visually.
     */
    async function meanInteriorLuma(
      path: string,
      bboxes: Array<{ x: number; y: number; width: number; height: number }>,
    ): Promise<number | null> {
      const buf = await readFile(path);
      const png = PNG.sync.read(buf);
      const w = png.width, h = png.height;
      let sum = 0, n = 0;
      const inset = 4;
      for (const b of bboxes) {
        const x0 = Math.max(0, Math.floor(b.x + inset));
        const x1 = Math.min(w, Math.floor(b.x + b.width - inset));
        const y0 = Math.max(0, Math.floor(b.y + inset));
        const y1 = Math.min(h, Math.floor(b.y + b.height - inset));
        if (x1 <= x0 || y1 <= y0) continue;
        const stepX = Math.max(1, Math.floor((x1 - x0) / 6));
        const stepY = Math.max(1, Math.floor((y1 - y0) / 6));
        for (let y = y0; y < y1; y += stepY) {
          for (let x = x0; x < x1; x += stepX) {
            const i = (y * w + x) * 4;
            if (png.data[i + 3]! === 0) continue;
            sum += 0.299 * png.data[i]! + 0.587 * png.data[i + 1]! + 0.114 * png.data[i + 2]!;
            n++;
          }
        }
      }
      return n > 0 ? sum / n : null;
    }

    async function classifyEdgeVsInterior(
      pathA: string,
      pathB: string,
      bboxes: Array<{ x: number; y: number; width: number; height: number }>,
      edgeWidth = 4,
    ): Promise<{ edgePixels: number; interiorPixels: number; outsidePixels: number; edgeFraction: number }> {
      const [bufA, bufB] = await Promise.all([readFile(pathA), readFile(pathB)]);
      const pA = PNG.sync.read(bufA);
      const pB = PNG.sync.read(bufB);
      if (pA.data.length !== pB.data.length) {
        return { edgePixels: 0, interiorPixels: 0, outsidePixels: 0, edgeFraction: 0 };
      }
      // For each forced bbox, classify a pixel (x,y) as edge if it
      // falls in the band of width `edgeWidth` around the perimeter,
      // interior if it falls deeper inside, outside otherwise.
      // A pixel that is "edge" for one bbox and "interior" for
      // another counts as interior (the stronger signal wins).
      const w = pA.width;
      let edge = 0, interior = 0, outside = 0;
      const dpr = 1;  // assume CSS-px = device-px for screenshots
      for (let i = 0; i < pA.data.length; i += 4) {
        const dr = Math.abs(pA.data[i]! - pB.data[i]!);
        const dg = Math.abs(pA.data[i + 1]! - pB.data[i + 1]!);
        const db = Math.abs(pA.data[i + 2]! - pB.data[i + 2]!);
        if (dr < 4 && dg < 4 && db < 4) continue;
        const px = (i / 4) | 0;
        const x = px % w, y = (px / w) | 0;
        let isInterior = false, isEdge = false;
        for (const b of bboxes) {
          const bx = b.x * dpr, by = b.y * dpr, bw = b.width * dpr, bh = b.height * dpr;
          const insideOuter = x >= bx - edgeWidth && x <= bx + bw + edgeWidth
            && y >= by - edgeWidth && y <= by + bh + edgeWidth;
          if (!insideOuter) continue;
          const insideInner = x >= bx + edgeWidth && x <= bx + bw - edgeWidth
            && y >= by + edgeWidth && y <= by + bh - edgeWidth;
          if (insideInner) { isInterior = true; break; }
          isEdge = true;
        }
        if (isInterior) interior++;
        else if (isEdge) edge++;
        else outside++;
      }
      const total = edge + interior;
      return {
        edgePixels: edge,
        interiorPixels: interior,
        outsidePixels: outside,
        edgeFraction: total > 0 ? edge / total : 0,
      };
    }

    const stateResults: ComponentFromImageReport["states"] = [];
    if (effectiveStates && effectiveStates.length > 0) {
      // Baseline screenshot is the target PNG (already captured). For
      // each state, render the current HTML with the state applied and
      // diff against the *default* current screenshot — surfaces "what
      // the state does to the variant" alongside the default delta.
      for (const state of effectiveStates) {
        const statePage = await browser.newPage({
          viewport: cssViewport,
          deviceScaleFactor: dpr,
        });
        await statePage.setContent(html, { waitUntil: "networkidle" });
        const applied = state === "scrolled"
          ? await applyScrolledState(statePage, contractPlan.probes.scrollTargets)
          : await applyForcedPseudoState(statePage, { state });
        const stateShotPath = join(outputDir, `current-${state}.png`);
        await statePage.screenshot({ path: stateShotPath, fullPage: false });
        if (state !== "scrolled") await clearStateMarkers(statePage).catch(() => {});
        await statePage.close();

        const stateSnap: VrtSnapshot = {
          testId: `component-${state}`,
          testTitle: `component :${state}`,
          projectName: "component-from-image",
          screenshotPath: stateShotPath,
          baselinePath: currentPath,
          status: "changed",
        };
        const stateDiff = await compareScreenshots(stateSnap, {
          outputDir,
          threshold: options.threshold ?? 0.03,
          skipHeatmap: true,
        });
        const raw = await countRawDiff(currentPath, stateShotPath).catch(() => ({ ratio: 0, pixels: 0, total: 0 }));
        const edgeClass = applied.bboxes.length > 0
          ? await classifyEdgeVsInterior(currentPath, stateShotPath, applied.bboxes).catch(() => ({ edgePixels: 0, interiorPixels: 0, outsidePixels: 0, edgeFraction: 0 }))
          : { edgePixels: 0, interiorPixels: 0, outsidePixels: 0, edgeFraction: 0 };
        const [defaultLuma, stateLuma] = applied.bboxes.length > 0
          ? await Promise.all([
            meanInteriorLuma(currentPath, applied.bboxes),
            meanInteriorLuma(stateShotPath, applied.bboxes),
          ])
          : [null, null];
        const lumaDelta = (defaultLuma !== null && stateLuma !== null) ? stateLuma - defaultLuma : null;
        stateResults.push({
          state,
          forcedCount: applied.forcedCount,
          inducedDiffRatio: stateDiff?.diffRatio ?? 0,
          rawInducedDiffRatio: raw.ratio,
          edgeFraction: edgeClass.edgeFraction,
          interiorPixels: edgeClass.interiorPixels,
          lumaDelta,
          lumaBefore: defaultLuma,
          lumaAfter: stateLuma,
        });
      }
    }

    const expressiveMenuGoalEvidence = await enrichExpressiveMenuEvidence(expressiveMenuEvidence, stateResults, currentPath, dpr);
    const goalEvaluation = evaluateComponentGoal({
      goal: effectiveGoal,
      pixelDiffRatio: diffRatio,
      landscapeDiffRatio: landscapeDiff.score,
      scrollports: scrollportEvidence,
      landing: landingEvidence,
      canvas: canvasEvidence,
      expressiveMenu: expressiveMenuGoalEvidence,
    });
    const reportLandingEvidence = goalEvaluation.goal === "landing" ? landingEvidence : undefined;
    const reportCanvasEvidence = goalEvaluation.goal === "canvas" ? canvasEvidence : undefined;
    const reportExpressiveMenuEvidence = goalEvaluation.goal === "expressive-menu" ? expressiveMenuGoalEvidence : undefined;

    const reportPath = options.reportPath ?? join(outputDir, "report.md");
    const markdown = renderReportMarkdown({
      targetImage: targetPath,
      currentHtml: htmlPath,
      viewport,
      diffPixels,
      totalPixels,
      diffRatio,
      landscapeDiff,
      goalEvaluation,
      landmarkRegions,
      scrollportRegions,
      landingEvidence: reportLandingEvidence,
      canvasEvidence: reportCanvasEvidence,
      expressiveMenuEvidence: reportExpressiveMenuEvidence,
      semanticDrilldown,
      heatmapPath: diffPixels > 0 ? heatmapPath : undefined,
      currentPath,
      bboxMatches,
      heatmapRegions,
      textRowMatches,
      rowGapDeltas,
      typographyMismatches,
      baselineRowCount: targetRows.length,
      variantRowCount: currentRows.length,
      paletteDiff,
      targetBg,
      currentBg,
      stateResults,
      dpr,
      dprSuggestion,
    });
    await writeFile(reportPath, markdown);

    const pct = (diffRatio * 100).toFixed(2);
    const icon = goalEvaluation.status === "pass"
      ? `${GREEN}✓${RESET}`
      : goalEvaluation.status === "review"
        ? `${YELLOW}~${RESET}`
        : `${RED}✗${RESET}`;
    console.log(`  ${icon} ${goalEvaluation.summary}`);
    console.log(`  ${DIM}diff: ${pct}% (${diffPixels} px), landscape ${(landscapeDiff.score * 100).toFixed(2)}%${RESET}`);
    if (dprSuggestion) {
      console.log(`  ${YELLOW}!${RESET} ${DIM}${dprSuggestion.reason}; try --dpr ${dprSuggestion.deviceScaleFactor} (${dprSuggestion.cssViewport.width}×${dprSuggestion.cssViewport.height} CSS px)${RESET}`);
    }
    console.log(`  ${DIM}bbox: ${bboxMatches.length}, heatmap: ${heatmapRegions.length}, text-rows ${targetRows.length}/${currentRows.length}, palette missing: ${paletteDiff.onlyInBaseline.length}${RESET}`);
    if (scrollportRegions.length > 0) {
      console.log(`  ${DIM}scrollports: ${formatScrollportEvidence(scrollportEvidence)}${RESET}`);
    }
    if (reportLandingEvidence) {
      console.log(`  ${DIM}landing: ${formatLandingEvidence(reportLandingEvidence)}${RESET}`);
    }
    if (reportCanvasEvidence) {
      console.log(`  ${DIM}canvas: ${formatCanvasEvidence(reportCanvasEvidence)}${RESET}`);
    }
    if (reportExpressiveMenuEvidence) {
      console.log(`  ${DIM}expressive-menu: ${formatExpressiveMenuEvidence(reportExpressiveMenuEvidence)}${RESET}`);
    }
    if (stateResults.length > 0) {
      for (const s of stateResults) {
        console.log(`  ${DIM}${formatProbeState(s.state)} induced ${(s.inducedDiffRatio * 100).toFixed(2)}% (${s.forcedCount} applied)${RESET}`);
      }
    }
    console.log(`  ${DIM}report: ${reportPath}${RESET}`);

    const result = {
      targetImage: targetPath,
      currentHtml: htmlPath,
      viewport,
      diff: { diffPixels, totalPixels, diffRatio },
      landscapeDiff,
      goalEvaluation,
      landmarkRegions,
      scrollportRegions,
      landingEvidence: reportLandingEvidence,
      canvasEvidence: reportCanvasEvidence,
      expressiveMenuEvidence: reportExpressiveMenuEvidence,
      semanticDrilldown,
      bboxMatches,
      heatmapRegions,
      textRowMatches,
      rowGapDeltas,
      typographyMismatches,
      baselineRowCount: targetRows.length,
      variantRowCount: currentRows.length,
      paletteDiff: { ...paletteDiff, baseline: targetPalette, variant: currentPalette },
      states: stateResults,
      reportPath,
    } satisfies ComponentFromImageReport;

    // Machine-readable twin of report.md — agents consume this instead of
    // scraping the Markdown section headers.
    const jsonReportPath = reportPath.endsWith(".md")
      ? `${reportPath.slice(0, -3)}.json`
      : `${reportPath}.json`;
    await writeFile(jsonReportPath, JSON.stringify(result, null, 2));
    console.log(`  ${DIM}report json: ${jsonReportPath}${RESET}`);

    return result;
  } finally {
    await browser.close();
  }
}

async function captureLandingEvidence(page: Page): Promise<ComponentLandingEvidence | undefined> {
  return await page.evaluate(() => {
    const hero = document.querySelector("[data-hero-title], h1");
    const cta = document.querySelector("[data-primary-cta]");
    const next = document.querySelector("[data-next-section]");
    const media = document.querySelector("[data-media-slot]");
    if (!hero && !cta && !next && !media) return undefined;

    function intersectsViewport(el: Element | null): boolean {
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 1
        && rect.height > 1
        && rect.right > 0
        && rect.bottom > 0
        && rect.left < window.innerWidth
        && rect.top < window.innerHeight;
    }

    function fullyInViewport(el: Element | null): boolean {
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 1
        && rect.height > 1
        && rect.left >= 0
        && rect.top >= 0
        && rect.right <= window.innerWidth
        && rect.bottom <= window.innerHeight;
    }

    function mediaSlotVisible(el: Element | null): boolean {
      if (!intersectsViewport(el)) return false;
      const rect = el!.getBoundingClientRect();
      return rect.width >= 160 && rect.height >= 120;
    }

    return {
      heroVisible: intersectsViewport(hero),
      primaryCtaVisible: fullyInViewport(cta),
      nextSectionHintVisible: intersectsViewport(next),
      mediaSlotVisible: mediaSlotVisible(media),
    };
  });
}

async function captureExpressiveMenuEvidence(page: Page): Promise<ExpressiveMenuEvidenceWithSamples | undefined> {
  return await page.evaluate(() => {
    const layers = Array.from(document.querySelectorAll("[data-composition-layer]"));
    const shapes = Array.from(document.querySelectorAll("[data-shape]"));
    const selected = document.querySelector("[data-selected=\"true\"], [aria-current=\"page\"], .is-selected");
    const menuItems = Array.from(document.querySelectorAll("nav button, nav a, [role=\"menuitem\"], [data-menu-item]"));
    if (layers.length === 0 && shapes.length === 0 && menuItems.length === 0 && !selected) return undefined;

    function visibleText(el: Element): string {
      return (el.textContent ?? "").replace(/\s+/g, " ").trim();
    }

    function isVisible(el: Element | null): boolean {
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.width > 1
        && rect.height > 1
        && style.visibility !== "hidden"
        && style.display !== "none";
    }

    function parseRgb(value: string): [number, number, number] | undefined {
      const parsed = parseRgba(value);
      return parsed ? [parsed[0], parsed[1], parsed[2]] : undefined;
    }

    function parseRgba(value: string): [number, number, number, number] | undefined {
      const match = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?/i);
      if (!match) return undefined;
      return [Number(match[1]), Number(match[2]), Number(match[3]), match[4] === undefined ? 1 : Number(match[4])];
    }

    function effectiveBackground(el: Element): [number, number, number] | undefined {
      let cursor: Element | null = el;
      while (cursor) {
        const rgba = parseRgba(getComputedStyle(cursor).backgroundColor);
        if (rgba && rgba[3] > 0.01) return [rgba[0], rgba[1], rgba[2]];
        cursor = cursor.parentElement;
      }
      const bodyBg = parseRgba(getComputedStyle(document.body).backgroundColor);
      return bodyBg ? [bodyBg[0], bodyBg[1], bodyBg[2]] : undefined;
    }

    function channel(value: number): number {
      const normalized = value / 255;
      return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    }

    function luma(rgb: [number, number, number]): number {
      return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
    }

    function contrastRatio(a: [number, number, number], b: [number, number, number]): number {
      const high = Math.max(luma(a), luma(b));
      const low = Math.min(luma(a), luma(b));
      return (high + 0.05) / (low + 0.05);
    }

    const contrastTargets = [
      selected,
      ...menuItems.slice(0, 6),
      document.querySelector("[data-accent=\"red\"]"),
    ].filter((el): el is Element => !!el);
    const menuContrastRatios = menuItems.filter(isVisible).map((el) => {
      const style = getComputedStyle(el);
      const color = parseRgb(style.color);
      const bg = effectiveBackground(el);
      return color && bg ? contrastRatio(color, bg) : 0;
    });
    const minMenuContrastRatio = menuContrastRatios.length > 0
      ? Math.min(...menuContrastRatios)
      : null;
    const lowContrastItemCount = menuContrastRatios.filter((ratio) => ratio < 4.5).length;
    const highContrast = menuContrastRatios.length > 0
      ? lowContrastItemCount === 0
      : contrastTargets.some((el) => {
        const style = getComputedStyle(el);
        const color = parseRgb(style.color);
        const bg = effectiveBackground(el);
        return !!color && !!bg && contrastRatio(color, bg) >= 4.5;
      });
    const menuItemSamples = menuItems.filter(isVisible).map((el) => {
      const style = getComputedStyle(el);
      const color = parseRgb(style.color);
      if (!color) return undefined;
      const rect = el.getBoundingClientRect();
      return {
        bbox: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        color,
      };
    }).filter((item): item is { bbox: { x: number; y: number; width: number; height: number }; color: [number, number, number] } => !!item);
    const diagonalEvidence = [...layers, ...shapes].some((el) => {
      const style = getComputedStyle(el);
      return style.transform !== "none" || style.clipPath !== "none";
    });

    return {
      compositionLayers: layers.length,
      compositionShapes: shapes.length,
      selectedVisible: isVisible(selected),
      focusableItemCount: menuItems.filter(isVisible).length,
      semanticMenuText: menuItems.some((el) => visibleText(el).length >= 2),
      diagonalEvidence,
      highContrast,
      minMenuContrastRatio: minMenuContrastRatio !== null ? Number(minMenuContrastRatio.toFixed(2)) : null,
      lowContrastItemCount,
      contrastSource: "dom",
      menuItemSamples,
      hoverChanged: null,
      focusVisibleChanged: null,
    };
  });
}

async function enrichExpressiveMenuEvidence(
  evidence: ExpressiveMenuEvidenceWithSamples | undefined,
  stateResults: NonNullable<ComponentFromImageReport["states"]>,
  currentPath: string,
  dpr: number,
): Promise<ComponentExpressiveMenuEvidence | undefined> {
  if (!evidence) return undefined;
  const pixelContrast = await sampleMenuItemContrasts(currentPath, evidence.menuItemSamples, dpr).catch(() => undefined);
  return {
    ...evidence,
    ...(pixelContrast ?? {}),
    hoverChanged: stateChanged(stateResults, "hover"),
    focusVisibleChanged: stateChanged(stateResults, "focus-visible"),
  };
}

async function sampleMenuItemContrasts(
  currentPath: string,
  samples: ExpressiveMenuPixelSample[] | undefined,
  dpr: number,
): Promise<Pick<ComponentExpressiveMenuEvidence, "highContrast" | "minMenuContrastRatio" | "lowContrastItemCount" | "contrastSource"> | undefined> {
  if (!samples || samples.length === 0) return undefined;
  const png = PNG.sync.read(await readFile(currentPath));
  const ratios = samples
    .map((sample) => sampleContrastFromImage(png, { ...sample, dpr }).contrastRatio)
    .filter((ratio): ratio is number => ratio !== null && Number.isFinite(ratio));
  if (ratios.length === 0) return undefined;
  const minMenuContrastRatio = Math.min(...ratios);
  const lowContrastItemCount = ratios.filter((ratio) => ratio < 4.5).length;
  return {
    highContrast: lowContrastItemCount === 0,
    minMenuContrastRatio: Number(minMenuContrastRatio.toFixed(2)),
    lowContrastItemCount,
    contrastSource: "pixel",
  };
}

function stateChanged(
  stateResults: NonNullable<ComponentFromImageReport["states"]>,
  state: ForcedPseudoState,
): boolean | null {
  const result = stateResults.find((item) => item.state === state);
  if (!result || result.forcedCount === 0) return null;
  return result.inducedDiffRatio >= 0.001 || result.rawInducedDiffRatio >= 0.001;
}

async function applyScrolledState(
  page: Page,
  targets: UiExpectedScrollportContract[],
): Promise<{
  state: "scrolled";
  forcedCount: number;
  skippedCount: number;
  affectedElements: string[];
  bboxes: Array<{ x: number; y: number; width: number; height: number }>;
}> {
  return await page.evaluate((rawTargets) => {
    type Target = {
      id?: string;
      name?: string;
      selector?: string;
      axis?: "x" | "y" | "both";
    };
    const targets = rawTargets as Target[];
    const selectors = targets.length > 0
      ? targets.flatMap((target) => target.selector ? [target.selector] : target.name ? [`[data-scrollport="${target.name}"]`] : [])
      : ["[data-scrollport], [data-vlmkit-scrollport], [data-ui-scrollport], [data-scroll-region]"];
    const elements: Element[] = [];
    const seen = new Set<Element>();
    for (const selector of selectors) {
      try {
        for (const el of Array.from(document.querySelectorAll(selector))) {
          if (!seen.has(el)) {
            seen.add(el);
            elements.push(el);
          }
        }
      } catch {
        // Ignore invalid selectors from draft contracts.
      }
    }

    let forcedCount = 0;
    const affectedElements: string[] = [];
    const bboxes: Array<{ x: number; y: number; width: number; height: number }> = [];
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i] as HTMLElement;
      const target = targets.find((candidate) =>
        candidate.selector ? matchesSelector(el, candidate.selector) : candidate.name ? scrollportName(el) === candidate.name : false
      );
      const axis = target?.axis ?? "y";
      const beforeTop = el.scrollTop;
      const beforeLeft = el.scrollLeft;
      const maxTop = Math.max(0, el.scrollHeight - el.clientHeight);
      const maxLeft = Math.max(0, el.scrollWidth - el.clientWidth);
      if ((axis === "y" || axis === "both") && maxTop > 0) {
        el.scrollTop = Math.max(1, Math.round(maxTop * 0.6));
      }
      if ((axis === "x" || axis === "both") && maxLeft > 0) {
        el.scrollLeft = Math.max(1, Math.round(maxLeft * 0.6));
      }
      if (el.scrollTop !== beforeTop || el.scrollLeft !== beforeLeft) {
        forcedCount++;
        const rect = el.getBoundingClientRect();
        bboxes.push({ x: rect.x, y: rect.y, width: rect.width, height: rect.height });
        const label = scrollportName(el) || el.id || el.tagName.toLowerCase();
        affectedElements.push(label);
      }
    }
    return {
      state: "scrolled" as const,
      forcedCount,
      skippedCount: 0,
      affectedElements: affectedElements.slice(0, 12),
      bboxes,
    };

    function matchesSelector(el: Element, selector: string): boolean {
      try {
        return el.matches(selector);
      } catch {
        return false;
      }
    }

    function scrollportName(el: Element): string {
      return el.getAttribute("data-scrollport")
        || el.getAttribute("data-vlmkit-scrollport")
        || el.getAttribute("data-ui-scrollport")
        || el.getAttribute("data-scroll-region")
        || "";
    }
  }, targets);
}

export function summarizeScrollportEvidence(
  regions: ScrollportRegion[],
  expectedScrollports: UiExpectedScrollportContract[] = [],
): ComponentScrollportEvidence {
  const evidence: ComponentScrollportEvidence = {
    total: regions.length,
    ok: 0,
    broken: 0,
    empty: 0,
  };
  for (const region of regions) {
    const status = describeScrollportStatus(region).status;
    evidence[status]++;
  }
  if (expectedScrollports.length > 0) {
    evidence.expected = summarizeExpectedScrollports(regions, expectedScrollports);
  }
  return evidence;
}

function formatScrollportEvidence(evidence: ComponentScrollportEvidence): string {
  const parts = [`${evidence.ok}/${evidence.total} ok`];
  if (evidence.broken > 0) parts.push(`${evidence.broken} broken`);
  if (evidence.empty > 0) parts.push(`${evidence.empty} empty`);
  if (evidence.expected && evidence.expected.total > 0) {
    parts.push(`expected ${evidence.expected.ok}/${evidence.expected.total} ok`);
    if (evidence.expected.missing > 0) parts.push(`${evidence.expected.missing} expected missing`);
    if (evidence.expected.broken > 0) parts.push(`${evidence.expected.broken} expected broken`);
    if (evidence.expected.empty > 0) parts.push(`${evidence.expected.empty} expected empty`);
  }
  return parts.join(", ");
}

function summarizeExpectedScrollports(
  regions: ScrollportRegion[],
  expectedScrollports: UiExpectedScrollportContract[],
): ComponentExpectedScrollportEvidence {
  const evidence: ComponentExpectedScrollportEvidence = {
    total: expectedScrollports.length,
    ok: 0,
    missing: 0,
    broken: 0,
    empty: 0,
    missingNames: [],
    brokenNames: [],
    emptyNames: [],
  };

  for (let i = 0; i < expectedScrollports.length; i++) {
    const expected = expectedScrollports[i]!;
    const label = expectedScrollportLabel(expected, i);
    const region = regions.find((candidate) => matchesExpectedScrollport(candidate, expected));
    if (!region) {
      evidence.missing++;
      evidence.missingNames.push(label);
      continue;
    }
    const status = expectedScrollportStatus(region, expected);
    if (status === "ok") evidence.ok++;
    else if (status === "broken") {
      evidence.broken++;
      evidence.brokenNames.push(label);
    } else {
      evidence.empty++;
      evidence.emptyNames.push(label);
    }
  }

  return evidence;
}

function matchesExpectedScrollport(region: ScrollportRegion, expected: UiExpectedScrollportContract): boolean {
  const candidates = new Set<string>();
  if (expected.name) candidates.add(expected.name);
  if (expected.id) candidates.add(expected.id);
  const selectorName = scrollportNameFromSelector(expected.selector);
  if (selectorName) candidates.add(selectorName);
  return candidates.has(region.name);
}

function expectedScrollportStatus(
  region: ScrollportRegion,
  expected: UiExpectedScrollportContract,
): "ok" | "broken" | "empty" {
  const status = describeScrollportStatus(region);
  if (status.status !== "ok") return status.status;
  if (!expected.axis) return "ok";
  if (expected.axis === "x") return status.scroll === "x" || status.scroll === "xy" ? "ok" : "broken";
  if (expected.axis === "y") return status.scroll === "y" || status.scroll === "xy" ? "ok" : "broken";
  return status.scroll === "xy" ? "ok" : "broken";
}

function expectedScrollportLabel(expected: UiExpectedScrollportContract, index: number): string {
  return expected.name ?? expected.id ?? scrollportNameFromSelector(expected.selector) ?? `expected-${index + 1}`;
}

function scrollportNameFromSelector(selector: string | undefined): string | undefined {
  if (!selector) return undefined;
  const match = selector.match(/\bdata-(?:vlmkit-scrollport|ui-scrollport|scroll-region|scrollport)\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\]\s]+))/u);
  return match?.[1] ?? match?.[2] ?? match?.[3];
}

function formatLandingEvidence(evidence: ComponentLandingEvidence): string {
  const parts = [
    evidence.heroVisible ? "hero ok" : "hero missing",
    evidence.primaryCtaVisible ? "CTA ok" : "CTA missing",
    evidence.nextSectionHintVisible ? "next hint ok" : "next hint missing",
    evidence.mediaSlotVisible ? "media slot ok" : "media slot missing",
  ];
  return parts.join(", ");
}

function formatCanvasEvidence(evidence: ComponentCanvasEvidence): string {
  const input = evidence.inputResponsive === true
    ? "input ok"
    : evidence.inputResponsive === false
      ? "input missing"
      : "input unknown";
  const stateHook = evidence.stateHook
    ? evidence.stateHookPresent === false
      ? `state hook missing: ${evidence.stateHook}`
      : `state hook ok: ${evidence.stateHook}`
    : undefined;
  const stateFields = formatCanvasStateFields(evidence);
  const parts = [
    evidence.nonblank ? "nonblank ok" : "blank",
    evidence.frameDelta ? "frame delta ok" : "frame delta missing",
    input,
    stateHook,
    stateFields,
  ].filter((part): part is string => part !== undefined);
  return parts.join(", ");
}

function formatCanvasStateFields(evidence: ComponentCanvasEvidence): string | undefined {
  if (evidence.missingStateFields && evidence.missingStateFields.length > 0) {
    return `state fields missing: ${evidence.missingStateFields.join("/")}`;
  }
  if (evidence.requiredStateFields && evidence.requiredStateFields.length > 0) {
    return `state fields ok: ${evidence.requiredStateFields.join("/")}`;
  }
  if (evidence.observedStateFields && evidence.observedStateFields.length > 0) {
    return `state fields observed: ${evidence.observedStateFields.join("/")}`;
  }
  return undefined;
}

function mdCodeList(values: string[]): string {
  return values.map((value) => `\`${value.replaceAll("`", "\\`")}\``).join(", ");
}

function formatExpressiveMenuEvidence(evidence: ComponentExpressiveMenuEvidence): string {
  const parts = [
    evidence.selectedVisible ? "selected ok" : "selected missing",
    evidence.semanticMenuText ? "menu text ok" : "menu text missing",
    `items ${evidence.focusableItemCount}`,
    `composition ${evidence.compositionLayers}/${evidence.compositionShapes}`,
    evidence.diagonalEvidence ? "diagonal ok" : "diagonal missing",
    evidence.highContrast ? "contrast ok" : "contrast missing",
    `contrast min ${formatContrastRatio(evidence.minMenuContrastRatio)}`,
    `${evidence.lowContrastItemCount} low contrast`,
    formatStateSummary("hover", evidence.hoverChanged),
    formatStateSummary("focus", evidence.focusVisibleChanged),
  ];
  return parts.join(", ");
}

function formatStateSummary(label: string, value: boolean | null): string {
  if (value === true) return `${label} changed`;
  if (value === false) return `${label} inert`;
  return `${label} unprobed`;
}

function formatOptionalGate(value: boolean | null): string {
  if (value === true) return "ok";
  if (value === false) return "missing";
  return "not probed";
}

interface RenderInput {
  targetImage: string;
  currentHtml: string;
  viewport: { width: number; height: number };
  diffPixels: number;
  totalPixels: number;
  diffRatio: number;
  landscapeDiff: LandscapeDiffResult;
  goalEvaluation: ComponentGoalEvaluation;
  landmarkRegions: LandmarkRegion[];
  scrollportRegions: ScrollportRegion[];
  landingEvidence?: ComponentLandingEvidence;
  canvasEvidence?: ComponentCanvasEvidence;
  expressiveMenuEvidence?: ComponentExpressiveMenuEvidence;
  semanticDrilldown: SemanticDrilldownEntry[];
  heatmapPath?: string;
  currentPath: string;
  bboxMatches: MatchedBbox[];
  heatmapRegions: HeatmapRegion[];
  textRowMatches: MatchedTextRow[];
  rowGapDeltas: RowGapDelta[];
  typographyMismatches: TypographyMismatch[];
  baselineRowCount: number;
  variantRowCount: number;
  paletteDiff: PaletteDiff;
  targetBg?: DominantBackgrounds;
  currentBg?: DominantBackgrounds;
  stateResults: NonNullable<ComponentFromImageReport["states"]>;
  dpr: number;
  dprSuggestion?: DeviceScaleFactorSuggestion;
}

export function renderReportMarkdown(r: RenderInput): string {
  const lines: string[] = [];
  lines.push("# Component-from-image report");
  lines.push("");
  lines.push(`Target:  \`${r.targetImage}\` (${r.viewport.width}×${r.viewport.height})`);
  lines.push(`Current: \`${r.currentHtml}\``);
  if (r.dpr > 1) {
    lines.push(`Capture: DPR ${r.dpr} (${Math.round(r.viewport.width / r.dpr)}×${Math.round(r.viewport.height / r.dpr)} CSS px)`);
  }
  if (r.dprSuggestion) {
    lines.push(`DPR hint: ${r.dprSuggestion.reason}; try \`--dpr ${r.dprSuggestion.deviceScaleFactor}\` ` +
      `to render at ${r.dprSuggestion.cssViewport.width}×${r.dprSuggestion.cssViewport.height} CSS px.`);
  }
  lines.push("");
  const pct = (r.diffRatio * 100).toFixed(2);
  lines.push(`**Pixel diff**: ${pct}% (${r.diffPixels} of ${r.totalPixels} pixels)`);
  lines.push("");
  lines.push(`**Landscape diff**: ${(r.landscapeDiff.score * 100).toFixed(2)}% coarse ` +
    `(${(r.landscapeDiff.similarity * 100).toFixed(2)}% similarity, ` +
    `${r.landscapeDiff.changedCells}/${r.landscapeDiff.totalCells} changed cells, ` +
    `${r.landscapeDiff.grid.cols}×${r.landscapeDiff.grid.rows} grid)`);
  lines.push("");
  lines.push(`**Goal**: \`${r.goalEvaluation.goal}\` (${r.goalEvaluation.label}) — ` +
    `**${r.goalEvaluation.status}**`);
  lines.push("");
  lines.push(r.goalEvaluation.summary);
  lines.push("");
  if (r.heatmapPath) {
    lines.push("- Target:   `" + r.targetImage + "`");
    lines.push("- Current:  `" + r.currentPath + "`");
    lines.push("- Heatmap:  `" + r.heatmapPath + "`");
    lines.push("");
  }

  if (r.landscapeDiff.topCells.length > 0) {
    lines.push("## Landscape cell diff");
    lines.push("");
    lines.push("Coarse grid comparison of average color + ink density. Use this " +
      "before pixel-perfect work: it answers whether the large page regions " +
      "land in roughly the same places.");
    lines.push("");
    lines.push("| Cell | Box | Score | Target | Current |");
    lines.push("|---|---|---:|---|---|");
    for (const c of r.landscapeDiff.topCells) {
      lines.push(`| r${c.row} c${c.col} | ${c.x},${c.y} ${c.width}×${c.height} | ` +
        `${(c.score * 100).toFixed(1)}% | \`${c.baseline.hex}\` ink ${c.baseline.ink.toFixed(2)} | ` +
        `\`${c.current.hex}\` ink ${c.current.ink.toFixed(2)} |`);
    }
    lines.push("");
  }

  if (r.semanticDrilldown.length > 0) {
    lines.push("## Landmark drilldown");
    lines.push("");
    lines.push("Current DOM landmarks are used as semantic lenses over the visual " +
      "diff. This follows ARIA landmark practice: concrete roles such as " +
      "`banner`, `navigation`, `main`, `complementary`, `contentinfo`, " +
      "`region`, `search`, and named `form` are used; `role=\"landmark\"` " +
      "itself is ignored.");
    lines.push("");
    lines.push("The lanes are intentionally separate. Run the layout lane first " +
      "until section placement is stable, then use the decoration lane for " +
      "paint, media, and local text details.");
    lines.push("");
    const renderDrilldownRows = (rows: SemanticDrilldownEntry[], flow: "layout" | "decoration") => {
      const title = flow === "layout" ? "Layout lane" : "Decoration lane";
      const next = flow === "layout"
        ? "fix landmark geometry / spacing / section placement"
        : "fix colors / media / text styling after layout stabilizes";
      lines.push(`### ${title}`);
      lines.push("");
      if (rows.length === 0) {
        lines.push(`No ${flow} rows detected.`);
        lines.push("");
        return;
      }
      lines.push("| Priority | Landmark | Box | Width | Height | Scroll | Grid | Layout | Decoration | Evidence | Next |");
      lines.push("|---:|---|---|---|---|---|---|---:|---:|---|---|");
      for (const row of rows.slice(0, 8)) {
        const lm = row.landmark;
        const name = lm.name ? ` "${lm.name}"` : "";
        const box = `${lm.bbox.left},${lm.bbox.top} ${lm.bbox.width}×${lm.bbox.height}`;
        const contract = lm.layout ? describeLandmarkLayoutContract(lm.layout) : undefined;
        const evidence = `${row.landscapeCells.length} landscape cell(s), ` +
          `${row.heatmapRegions.length} heatmap region(s)`;
        lines.push(`| ${(row.priorityScore * 100).toFixed(1)} | ` +
          `\`${lm.role}${name}\` | ${box} | ` +
          `${contract?.width ?? "—"} | ${contract?.height ?? "—"} | ` +
          `${contract?.scroll ?? "—"} | ${contract?.grid ?? "—"} | ` +
          `${(row.layoutScore * 100).toFixed(1)}% | ` +
          `${(row.decorationScore * 100).toFixed(1)}% | ${evidence} | ${next} |`);
      }
      lines.push("");
    };
    const layoutRows = r.semanticDrilldown.filter((row) => row.flow === "layout");
    const decorationRows = r.semanticDrilldown.filter((row) => row.flow === "decoration");
    renderDrilldownRows(layoutRows, "layout");
    renderDrilldownRows(decorationRows, "decoration");
  } else if (r.landmarkRegions.length === 0) {
    lines.push("## Landmark drilldown");
    lines.push("");
    lines.push("No current DOM landmarks were detected. Add semantic wrappers " +
      "such as `<header>`, `<nav>`, `<main>`, `<aside>`, `<footer>`, " +
      "or named `<section>` regions before relying on visual drilldown.");
    lines.push("");
  }

  if (r.scrollportRegions.length > 0) {
    lines.push("## Scrollport inspector");
    lines.push("");
    lines.push("Explicit scrollport candidates from `data-scrollport`, " +
      "`data-vlmkit-scrollport`, `data-ui-scrollport`, or " +
      "`data-scroll-region`. This is separate from visual matching: an app " +
      "shell can pass landscape diff while the actual scroll container is wrong.");
    lines.push("");
    lines.push("| Status | Name | Box | Overflow | Client | Scroll | Reason |");
    lines.push("|---|---|---|---|---|---|---|");
    for (const region of r.scrollportRegions.slice(0, 12)) {
      const status = describeScrollportStatus(region);
      const box = `${region.bbox.left},${region.bbox.top} ${region.bbox.width}×${region.bbox.height}`;
      const overflow = `${region.overflowX}/${region.overflowY}`;
      const client = `${region.clientWidth}×${region.clientHeight}`;
      const scroll = `${region.scrollWidth}×${region.scrollHeight}`;
      lines.push(`| ${status.status} | \`${region.name}\` | ${box} | ` +
        `${overflow} | ${client} | ${scroll} | ${status.reason} |`);
    }
    lines.push("");
  }

  if (r.landingEvidence) {
    lines.push("## Landing inspector");
    lines.push("");
    lines.push("Current DOM evidence for landing-page first-viewport gates. Use " +
      "`data-primary-cta`, `data-next-section`, and `data-media-slot` to make " +
      "the intended regions explicit.");
    lines.push("");
    lines.push("| Gate | Status |");
    lines.push("|---|---|");
    lines.push(`| Hero visible | ${r.landingEvidence.heroVisible ? "ok" : "missing"} |`);
    lines.push(`| Primary CTA visible | ${r.landingEvidence.primaryCtaVisible ? "ok" : "missing"} |`);
    lines.push(`| Next section hint visible | ${r.landingEvidence.nextSectionHintVisible ? "ok" : "missing"} |`);
    lines.push(`| Media slot visible | ${r.landingEvidence.mediaSlotVisible ? "ok" : "missing"} |`);
    lines.push("");
  }

  if (r.canvasEvidence) {
    lines.push("## Canvas inspector");
    lines.push("");
    lines.push("Current DOM canvas evidence for interactive/game-like surfaces. " +
      "This checks the rendered canvas, a short frame delta, and optional " +
      "`window.__gameState` response to `ArrowRight`.");
    lines.push("");
    lines.push("| Gate | Status |");
    lines.push("|---|---|");
    lines.push(`| Canvas count | ${r.canvasEvidence.canvasCount} |`);
    lines.push(`| Nonblank canvas | ${r.canvasEvidence.nonblank ? "ok" : "blank"} |`);
    lines.push(`| Frame delta | ${r.canvasEvidence.frameDelta ? "ok" : "missing"} |`);
    const input = r.canvasEvidence.inputResponsive === true
      ? "ok"
      : r.canvasEvidence.inputResponsive === false
        ? "missing"
        : "unknown";
    lines.push(`| Input response | ${input} |`);
    if (r.canvasEvidence.stateHook) {
      const hookStatus = r.canvasEvidence.stateHookPresent === false ? "missing" : "ok";
      lines.push(`| State hook | ${hookStatus}: \`${r.canvasEvidence.stateHook}\` |`);
    }
    if (r.canvasEvidence.requiredStateFields && r.canvasEvidence.requiredStateFields.length > 0) {
      const fieldStatus = r.canvasEvidence.missingStateFields && r.canvasEvidence.missingStateFields.length > 0
        ? `missing: ${mdCodeList(r.canvasEvidence.missingStateFields)}`
        : `ok: ${mdCodeList(r.canvasEvidence.requiredStateFields)}`;
      lines.push(`| Required state fields | ${fieldStatus} |`);
    } else if (r.canvasEvidence.observedStateFields && r.canvasEvidence.observedStateFields.length > 0) {
      lines.push(`| Observed state fields | ${mdCodeList(r.canvasEvidence.observedStateFields)} |`);
    }
    lines.push("");
  }

  if (r.expressiveMenuEvidence) {
    lines.push("## Expressive menu inspector");
    lines.push("");
    lines.push("Current DOM evidence for poster-like menu surfaces. This checks " +
      "semantic menu text and explicit composition metadata instead of asking " +
      "pixel diff to reproduce every slash, sticker, and overlap exactly.");
    lines.push("");
    lines.push("| Gate | Status |");
    lines.push("|---|---|");
    lines.push(`| Selected state visible | ${r.expressiveMenuEvidence.selectedVisible ? "ok" : "missing"} |`);
    lines.push(`| Focusable menu items | ${r.expressiveMenuEvidence.focusableItemCount} |`);
    lines.push(`| Semantic menu text | ${r.expressiveMenuEvidence.semanticMenuText ? "ok" : "missing"} |`);
    lines.push(`| Composition layers | ${r.expressiveMenuEvidence.compositionLayers} |`);
    lines.push(`| Composition shapes | ${r.expressiveMenuEvidence.compositionShapes} |`);
    lines.push(`| Diagonal / layered evidence | ${r.expressiveMenuEvidence.diagonalEvidence ? "ok" : "missing"} |`);
    lines.push(`| High contrast | ${r.expressiveMenuEvidence.highContrast ? "ok" : "missing"} |`);
    lines.push(`| Minimum menu contrast | ${formatContrastRatio(r.expressiveMenuEvidence.minMenuContrastRatio)} |`);
    lines.push(`| Low-contrast menu items | ${r.expressiveMenuEvidence.lowContrastItemCount} |`);
    lines.push(`| Contrast source | ${r.expressiveMenuEvidence.contrastSource ?? "unknown"} |`);
    lines.push(`| Hover state changes | ${formatOptionalGate(r.expressiveMenuEvidence.hoverChanged)} |`);
    lines.push(`| Focus-visible state changes | ${formatOptionalGate(r.expressiveMenuEvidence.focusVisibleChanged)} |`);
    lines.push("");
  }

  const meaningfulBboxes = r.bboxMatches.filter((m) =>
    Math.abs(m.deltaTop) > 1 || Math.abs(m.deltaLeft) > 1
    || Math.abs(m.deltaWidth) > 1 || Math.abs(m.deltaHeight) > 1,
  );
  if (meaningfulBboxes.length > 0) {
    lines.push("## Component bbox diff");
    lines.push("");
    lines.push("Largest non-background regions, matched by area-rank between " +
      "target and current. Δ shows position / size differences.");
    lines.push("");
    lines.push("| Rank | Target bbox | Current bbox | Δ top / left / W / H | IoU |");
    lines.push("|---|---|---|---|---|");
    for (const m of meaningfulBboxes.slice(0, 8)) {
      const t = `${m.baseline.left},${m.baseline.top} ${m.baseline.width}×${m.baseline.height}`;
      const c = `${m.variant.left},${m.variant.top} ${m.variant.width}×${m.variant.height}`;
      const sign = (n: number) => (n > 0 ? `+${n}` : `${n}`);
      lines.push(`| #${m.rank} | ${t} | ${c} | ${sign(m.deltaTop)} / ${sign(m.deltaLeft)} / ${sign(m.deltaWidth)} / ${sign(m.deltaHeight)} | ${m.iou} |`);
    }
    lines.push("");
  }

  if (r.heatmapRegions.length > 0) {
    lines.push("## Heatmap region clusters");
    lines.push("");
    lines.push("Each cluster is a contiguous run of differing pixels. `Fill` is " +
      "the dominant color sampled from the target inside the region. `Kind` " +
      "is a pixel-only content-type guess (text / filled-rect / icon / image).");
    lines.push("");
    lines.push("| Top-Left | Size | Hot pixels | Fill | Kind |");
    lines.push("|---|---|---|---|---|");
    for (const reg of r.heatmapRegions.slice(0, 8)) {
      const fill = reg.dominantColor ? `\`${reg.dominantColor.hex}\`` : "—";
      const kind = reg.kind ? `\`${reg.kind}\`${reg.kindConfidence !== undefined && reg.kindConfidence < 0.6 ? "?" : ""}` : "—";
      lines.push(`| ${reg.left},${reg.top} | ${reg.width}×${reg.height} | ${reg.area} | ${fill} | ${kind} |`);
    }
    lines.push("");
  }

  if (r.baselineRowCount !== r.variantRowCount || r.textRowMatches.length > 0) {
    lines.push("## Text-row Δy");
    lines.push("");
    lines.push(`Target has ${r.baselineRowCount} text rows; current has ${r.variantRowCount}.`);
    if (r.baselineRowCount !== r.variantRowCount) {
      lines.push("");
      lines.push("**Count mismatch** — current is missing rows of content " +
        "(or has spurious extras). Add the missing elements before tweaking CSS.");
    }
    if (r.textRowMatches.length > 0) {
      lines.push("");
      lines.push("| Rank | Target y | Current y | Δy |");
      lines.push("|---|---|---|---|");
      for (const m of r.textRowMatches.slice(0, 12)) {
        const signed = m.deltaY > 0 ? `+${m.deltaY}` : `${m.deltaY}`;
        lines.push(`| #${m.rank} | ${m.baseline.yCenter} | ${m.variant.yCenter} | ${signed}px |`);
      }
    }
    if (r.typographyMismatches.length > 0) {
      lines.push("");
      lines.push("**Typography mismatches** — per-row font-size / weight " +
        "estimated from band height and ink density. Estimates are " +
        "heuristic (snapped to nearest UI bucket); large jumps " +
        "(e.g. 16px → 24px, regular → bold) are reliable.");
      lines.push("");
      lines.push("| Rank | Target | Current | Kind |");
      lines.push("|---|---|---|---|");
      for (const m of r.typographyMismatches.slice(0, 12)) {
        const tgt = `${m.baselineFontSize ?? "?"}px ${m.baselineWeight ?? "?"}`;
        const cur = `${m.variantFontSize ?? "?"}px ${m.variantWeight ?? "?"}`;
        lines.push(`| #${m.rank} | ${tgt} | ${cur} | ${m.kind} |`);
      }
    }
    if (r.rowGapDeltas.length > 0) {
      lines.push("");
      lines.push("**Spacing fixes** — per-gap delta between consecutive text rows. " +
        "The fix is on the *preceding* element: if the gap above row #N is +6px, " +
        "reduce that element's `margin-bottom` (or its container's `gap` value) by ~6px.");
      lines.push("");
      lines.push("| Above → Below | Target gap | Current gap | Δgap | Suggested fix |");
      lines.push("|---|---|---|---|---|");
      for (const g of r.rowGapDeltas.slice(0, 12)) {
        const signed = g.delta > 0 ? `+${g.delta}` : `${g.delta}`;
        const fix = g.delta > 0
          ? `reduce preceding element's bottom space by ${g.delta}px`
          : `add ${Math.abs(g.delta)}px to preceding element's bottom space`;
        lines.push(`| #${g.aboveRank} → #${g.belowRank} | ${g.baselineGap}px | ${g.variantGap}px | ${signed}px | ${fix} |`);
      }
    }
    lines.push("");
  }

  if (r.targetBg) {
    lines.push("## Backgrounds");
    lines.push("");
    lines.push("Direct samples of the page bg (image perimeter) and inner bg " +
      "(central rectangle) — start here when setting `body` and content " +
      "container background colors.");
    lines.push("");
    lines.push("| Layer | Target | Current |");
    lines.push("|---|---|---|");
    const currOuter = r.currentBg ? `\`${r.currentBg.outer.hex}\`` : "—";
    const currInner = r.currentBg ? `\`${r.currentBg.inner.hex}\`` : "—";
    lines.push(`| outer (page) | \`${r.targetBg.outer.hex}\` | ${currOuter} |`);
    if (!r.targetBg.same) {
      lines.push(`| inner (content) | \`${r.targetBg.inner.hex}\` | ${currInner} |`);
    } else {
      lines.push("");
      lines.push("_(target outer and inner are the same; page is a single solid background.)_");
    }
    lines.push("");
  }

  if (r.paletteDiff.onlyInBaseline.length > 0 || r.paletteDiff.onlyInVariant.length > 0) {
    lines.push("## Palette diff");
    lines.push("");
    lines.push("`Nearest` column: Euclidean RGB distance to the closest color on " +
      "the other side. ≤ 30 = likely AA / quantization noise; > 60 = real palette gap.");
    lines.push("");
    lines.push("| Side | Color | Share | Nearest |");
    lines.push("|---|---|---|---|");
    const fmtNear = (d: number) => {
      if (!Number.isFinite(d)) return "—";
      const v = d.toFixed(0);
      if (d <= 30) return `${v} (near, likely AA)`;
      if (d <= 60) return `${v} (close)`;
      return v;
    };
    for (const c of r.paletteDiff.onlyInBaseline.slice(0, 8)) {
      lines.push(`| missing | \`${c.hex}\` | ${(c.share * 100).toFixed(1)}% | ${fmtNear(c.nearestNeighborDistance)} |`);
    }
    for (const c of r.paletteDiff.onlyInVariant.slice(0, 8)) {
      lines.push(`| extra | \`${c.hex}\` | ${(c.share * 100).toFixed(1)}% | ${fmtNear(c.nearestNeighborDistance)} |`);
    }
    lines.push("");
  }

  if (r.stateResults.length > 0) {
    lines.push("## State diff");
    lines.push("");
    lines.push("Each row: current HTML rendered with the named state applied, " +
      "diffed against the default render. Pseudo-classes are forced on " +
      "interactive elements; `scrolled` scrolls contract-targeted scrollports.");
    lines.push("");
    lines.push("- **Perceptual %**: pixelmatch at threshold 0.03 — what the eye " +
      "would notice. Filters anti-aliasing and subpixel jitter.");
    lines.push("- **Raw %**: any pixel where any RGB channel changed by ≥ 4. " +
      "Catches subtle hover effects (Δ10/channel shifts) that the perceptual " +
      "filter swallows.");
    lines.push("- **Edge %**: of all diff pixels, fraction within 4px of any " +
      "applied target bbox perimeter. High = outline-only change (likely UA default focus " +
      "ring); low = interior fill/text changed (author CSS).");
    lines.push("- **ΔLuma**: change in mean interior luminance of the applied " +
      "elements (state minus default). Negative = elements got darker; positive = " +
      "lighter. Typical `:hover` darkens (−5 to −30); a *large positive ΔLuma* on " +
      "an already-light state is a wrong-direction-shift suspect.");
    lines.push("- **Note**: `suspect` when both diff metrics are essentially zero. " +
      "`ua-likely` when only the outline changed and the interior is untouched " +
      "(catches missing author `:focus-visible` rules that the UA default hides). " +
      "`direction?` when ΔLuma > +15 on a state that conventionally darkens.");
    lines.push("");
    lines.push("| State | Perceptual % | Raw % | Edge % | ΔLuma | Applied | Note |");
    lines.push("|---|---|---|---|---|---|---|");
    for (const s of r.stateResults) {
      const perceptZero = s.inducedDiffRatio < 0.0005;
      const rawZero = s.rawInducedDiffRatio < 0.0005;
      const uaLikely = s.forcedCount > 0 && !rawZero
        && s.edgeFraction > 0.85 && s.interiorPixels < 50;
      // Wrong-direction heuristic: hover/active are conventionally
      // darkening states. If they lighten by > 15 luma units on a
      // styled state (rawZero false), flag for verification. focus
      // and focus-visible may legitimately lighten via outline, so
      // skip them.
      const wrongDir = !rawZero
        && !uaLikely
        && (s.state === "hover" || s.state === "active")
        && s.lumaDelta !== null && s.lumaDelta > 15
        && s.lumaBefore !== null && s.lumaBefore > 160;
      const note = s.forcedCount > 0 && perceptZero && rawZero
        ? "**suspect** — state did not change rendering"
        : s.forcedCount > 0 && perceptZero && !rawZero
          ? "_subtle_ — only raw-pixel diff registers (check below the perceptual threshold)"
          : uaLikely
            ? "**ua-likely** — only the perimeter changed; author rule likely missing"
            : wrongDir
              ? `**direction?** — \`:${s.state}\` lightened by ${s.lumaDelta!.toFixed(0)} luma; verify this matches the intended hover direction`
              : "";
      const edgePct = s.edgeFraction > 0 ? (s.edgeFraction * 100).toFixed(0) + "%" : "—";
      const luma = s.lumaDelta === null
        ? "—"
        : (s.lumaDelta > 0 ? `+${s.lumaDelta.toFixed(1)}` : s.lumaDelta.toFixed(1));
      lines.push(`| \`${formatProbeState(s.state)}\` | ${(s.inducedDiffRatio * 100).toFixed(2)}% | ${(s.rawInducedDiffRatio * 100).toFixed(2)}% | ${edgePct} | ${luma} | ${s.forcedCount} | ${note} |`);
    }
    lines.push("");
  }

  // Suggested CSS patch — aggregates all actionable signals into one
  // paste-ready code block. Each line is either a hint comment or a
  // ready-to-paste declaration; the agent reads top-down.
  const cssHints: string[] = [];
  if (r.targetBg && r.currentBg) {
    if (r.targetBg.outer.hex.toLowerCase() !== r.currentBg.outer.hex.toLowerCase()) {
      cssHints.push(`body { background: ${r.targetBg.outer.hex}; }`);
    }
    if (!r.targetBg.same && r.targetBg.inner.hex.toLowerCase() !== r.currentBg.inner.hex.toLowerCase()) {
      cssHints.push(`/* content container should use background: ${r.targetBg.inner.hex} */`);
    }
  }
  if (r.baselineRowCount !== r.variantRowCount) {
    const diff = r.baselineRowCount - r.variantRowCount;
    cssHints.push(`/* HTML: ${diff > 0 ? "add" : "remove"} ${Math.abs(diff)} row(s) of content — target has ${r.baselineRowCount}, current has ${r.variantRowCount} */`);
  }
  for (const m of r.typographyMismatches.slice(0, 6)) {
    const props: string[] = [];
    if (m.baselineFontSize !== m.variantFontSize) props.push(`font-size: ${m.baselineFontSize}px`);
    if (m.baselineWeight !== m.variantWeight) {
      const weightMap: Record<string, string> = { light: "300", regular: "400", medium: "500", bold: "700" };
      const v = weightMap[m.baselineWeight ?? "regular"] ?? "400";
      props.push(`font-weight: ${v}`);
    }
    if (props.length > 0) {
      cssHints.push(`/* row #${m.rank}: ${props.join("; ")}; */`);
    }
  }
  for (const g of r.rowGapDeltas.slice(0, 6)) {
    const dir = g.delta > 0 ? "reduce" : "add";
    const amt = Math.abs(g.delta);
    cssHints.push(`/* row #${g.aboveRank}: ${dir} margin-bottom by ~${amt}px (target gap ${g.baselineGap}, current ${g.variantGap}) */`);
  }
  for (const reg of r.heatmapRegions.slice(0, 6)) {
    if (!reg.dominantColor || !reg.kind) continue;
    if (reg.kind === "filled-rect") {
      cssHints.push(`/* region ${reg.left},${reg.top} ${reg.width}×${reg.height}: background: ${reg.dominantColor.hex} */`);
    } else if (reg.kind === "text") {
      cssHints.push(`/* region ${reg.left},${reg.top} ${reg.width}×${reg.height}: color: ${reg.dominantColor.hex} (text) */`);
    } else if (reg.kind === "icon") {
      cssHints.push(`/* region ${reg.left},${reg.top} ${reg.width}×${reg.height}: icon — fill: ${reg.dominantColor.hex} */`);
    }
  }
  if (cssHints.length > 0) {
    lines.push("## Suggested CSS patch");
    lines.push("");
    lines.push("Aggregated from every actionable signal above. Each line is " +
      "either a paste-ready declaration or a `/* hint */` describing the " +
      "delta. Selectors are intentionally omitted (the tool can't see your " +
      "DOM); apply each declaration to whichever element matches the " +
      "described region or row.");
    lines.push("");
    lines.push("```css");
    for (const h of cssHints) lines.push(h);
    lines.push("```");
    lines.push("");
  }

  lines.push("## Suggested next step");
  lines.push("");
  const topDrilldown = selectNextSemanticDrilldown(r.semanticDrilldown);
  if (topDrilldown?.flow === "layout") {
    const lm = topDrilldown.landmark;
    const name = lm.name ? ` "${lm.name}"` : "";
    lines.push(`1. Start with the \`${lm.role}${name}\` landmark. Its coarse ` +
      "landscape cells changed, so fix section geometry, spacing, and " +
      "placement before chasing local colors.");
  } else if (topDrilldown?.flow === "decoration") {
    const lm = topDrilldown.landmark;
    const name = lm.name ? ` "${lm.name}"` : "";
    lines.push(`1. Start with decoration inside the \`${lm.role}${name}\` ` +
      "landmark. The coarse layout is relatively stable; fix local " +
      "paint, media, and text details.");
  } else if (r.baselineRowCount > r.variantRowCount) {
    lines.push("1. The current rendering is missing text rows — add the missing " +
      "HTML elements first. Bbox / palette tables tell you what styling they need.");
  } else {
    lines.push("1. Open the target and current PNGs side-by-side. Use the heatmap " +
      "region table to localize diff areas.");
  }
  lines.push("2. Cross-check the palette table — missing colors are the design tokens " +
    "the current rendering doesn't have (paste the hex values into your CSS).");
  lines.push("3. If bbox deltas are large, the current element's dimensions don't " +
    "match the target — adjust `width` / `padding` / `font-size` until they converge.");
  lines.push("4. Re-run `vlmkit build component` and check that diff %, bbox " +
    "deltas, heatmap regions, palette deltas all shrink toward zero.");
  lines.push("");
  return lines.join("\n");
}

function formatContrastRatio(value: number | null): string {
  return value === null ? "unknown" : value.toFixed(2);
}

function formatProbeState(state: ComponentProbeState): string {
  return state === "scrolled" ? "scrolled" : `:${state}`;
}

async function main(argv = process.argv.slice(2)) {
  const showHelp = argv[0] === "--help" || argv[0] === "-h";
  if (showHelp) argv = [];
  const { positional, outputDir, report, contract, threshold, goal, states, deviceScaleFactor } = parseArgs(argv);
  if (positional.length < 2) {
    console.log("Usage: vlmkit build component <target.png> <current.html> [options]");
    console.log("Options:");
    console.log("  --output-dir <dir>              Output directory (default: ./test-results/component)");
    console.log("  --report <path>                 Markdown report path (default: <output-dir>/report.md)");
    console.log("  --contract <ui.contract.json>   Inject goal, required states, and expected scrollports");
    console.log("  --threshold <0..1>              Pixelmatch sensitivity (default: 0.03)");
    console.log(`  --goal <${listComponentGoals().join("|")}>      Convergence goal (default: app)`);
    console.log("  --states hover focus-visible scrolled …");
    console.log("                                   Capture additional state diffs");
    console.log("  --device-scale-factor, --dpr <n>");
    console.log("                                   Render at higher DPR (e.g. 2 for retina simulation)");
    console.log("                                  Target PNG must be captured at the same DPR.");
    if (showHelp) return;
    process.exit(1);
  }
  await runComponentFromImage({
    targetImagePath: positional[0]!,
    currentHtmlPath: positional[1]!,
    outputDir: outputDir || join(process.cwd(), "test-results", "component"),
    reportPath: report || undefined,
    contractPath: contract || undefined,
    threshold,
    goal,
    states: states.length > 0 ? states : undefined,
    deviceScaleFactor,
  });
}

const isCliEntry = process.env.__VRT_DISPATCHER_LEAF__ === "component-from-image" || (process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false);
if (isCliEntry) {
  main().catch(handleCliError);
}
