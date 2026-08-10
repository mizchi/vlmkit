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
 * Unlike `vlmkit diff html` (migration mode), this scenario:
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
import { type Page } from "playwright";
import { withBrowser } from "@mizchi/vlmkit-core/browser-launch.ts";

/**
 * Seek every WAAPI-visible animation to its rest pose: running finite
 * animations past their end (settled appearance), running infinite ones to
 * 0, page-paused/finished ones left at their author-chosen time — the same
 * policy as `check animation`'s baseline. Screenshot-level
 * `animations: "disabled"` only stabilizes the captured image; DOM reads
 * (landmark / scrollport bboxes) need the page itself held at rest.
 */
const REST_POSE_SCRIPT = `(() => {
  if (!document.getAnimations) return;
  for (const anim of document.getAnimations({ subtree: true })) {
    try {
      if (anim.playState !== "running") continue;
      anim.pause();
      const t = anim.effect && anim.effect.getComputedTiming ? anim.effect.getComputedTiming() : null;
      const iterations = t && Number.isFinite(t.iterations) ? t.iterations : null;
      anim.currentTime = iterations === null
        ? 0
        : (Number(t.delay) || 0) + (Number(t.duration) || 0) * iterations;
    } catch {}
  }
})()`;
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
// The Markdown rendering and its summaries live in `component-report-format.ts`:
// pure, and previously untestable without a browser because they shared this file
// with the Playwright orchestrator below. Re-exported because callers and tests
// already resolve them through this module.
import {
  formatCanvasEvidence,
  formatExpressiveMenuEvidence,
  formatLandingEvidence,
  formatProbeState,
  formatScrollportEvidence,
  renderReportMarkdown,
  summarizeScrollportEvidence,
} from "./component-report-format.ts";
export { renderReportMarkdown, summarizeScrollportEvidence };
export type { RenderInput } from "./component-report-format.ts";
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

  return await withBrowser(async (browser) => {
    const page = await browser.newPage({
      viewport: cssViewport,
      deviceScaleFactor: dpr,
    });
    await page.setContent(html, { waitUntil: "networkidle" });
    // Rest-pose seek BEFORE any evidence collection: landmark/scrollport
    // bboxes are DOM reads, so a mid-flight entrance transform would skew
    // them even though the screenshot itself is captured with
    // animations: "disabled".
    await page.evaluate(REST_POSE_SCRIPT).catch(() => {});
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
        // Same rest-pose policy as the default current.png capture: without
        // it, entrance/infinite animation progress on this freshly loaded
        // page is attributed to the forced state, inflating the induced
        // diff (and masking a genuinely missing state rule).
        await statePage.evaluate(REST_POSE_SCRIPT).catch(() => {});
        const applied = state === "scrolled"
          ? await applyScrolledState(statePage, contractPlan.probes.scrollTargets)
          : await applyForcedPseudoState(statePage, { state });
        const stateShotPath = join(outputDir, `current-${state}.png`);
        await statePage.screenshot({ path: stateShotPath, fullPage: false, animations: "disabled" });
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
  });
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

const isCliEntry = process.env.__VLMKIT_DISPATCHER_LEAF__ === "component-from-image" || (process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false);
if (isCliEntry) {
  main().catch(handleCliError);
}
