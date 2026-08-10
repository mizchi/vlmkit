#!/usr/bin/env node
/**
 * Migration VRT Compare
 *
 * Renders two HTML files at multiple viewports and computes pixel diff.
 * For validating migrations like reset CSS switching, Tailwind -> vanilla CSS, etc.
 *
 * Usage:
 *   npx tsx src/migration-compare.ts before.html after.html
 *   npx tsx src/migration-compare.ts --dir fixtures/migration/reset-css --baseline normalize.html --variants modern-normalize.html destyle.html no-reset.html
 */
import { existsSync } from "node:fs";
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { type Browser } from "playwright";
import {
  collectApprovalWarnings,
  filterApprovedPaintTreeChanges,
  filterApprovedVrtRegions,
  loadApprovalManifest,
} from "../../vrt/snapshot/approval.ts";
import {
  CraterClient,
  DEFAULT_BIDI_URL,
  diffPaintTrees,
  isCraterAvailable,
  type CraterBreakpointDiscoveryDiagnostics,
  type PaintNode,
  type PaintTreeChange,
} from "@mizchi/vlmkit-capture/crater-client.ts";
import { compareScreenshots, generateDiffReport } from "@mizchi/vlmkit-core/heatmap.ts";
import { createScopedVrtDiff, normalizeVrtDiffRegions } from "@mizchi/vlmkit-core/diff-regions.ts";
import { classifyVisualDiff } from "@mizchi/vlmkit-markup/visual-semantic.ts";
import { composeTriptych } from "./triptych.ts";
import {
  DEFAULT_REGION_DIFF_MODEL,
  formatRegionDiffMarkdown,
  runRegionDiffAnalysis,
  type RegionDiffOutput,
  type RegionElementRect,
  type RegionStructuredChange,
  type RunRegionDiffAnalysisOptions,
} from "./vlm-region-diff.ts";
import { loadDesignTokens, snapColor, type DesignTokens } from "./design-md-tokens.ts";
import { generateWireframeFixCandidates, type WireframeFixSuggestion } from "./wireframe-fix-candidates.ts";
import {
  buildMigrationRegionApprovalContexts,
  classifyMigrationVisualChange,
  classifyMigrationDiff,
  type MigrationDiffCategory,
} from "./migration-diff.ts";
import {
  capturePaintTreeForViewport,
  summarizeMigrationPaintTreeChanges,
} from "./migration-paint-tree.ts";
import {
  buildMigrationViewportFixCandidatesFromHtml,
  summarizeMigrationFixCandidates,
  type MigrationFixCandidate,
  type MigrationFixCandidateSummary,
} from "./migration-fix-candidates.ts";
import { summarizeMigrationReportConvergence, type MigrationConvergenceStatus } from "./migration-fix-loop-core.ts";
import {
  extractResponsiveBreakpointsFromHtmlWithStylesheets,
  extractStylesheetHrefsFromHtml,
  generateViewports,
  mergeResponsiveBreakpoints,
  type ResponsiveBreakpoint,
  type ViewportSpec,
} from "@mizchi/vlmkit-capture/viewport-discovery.ts";
import { diagnoseSandboxLaunchFailure, formatPlaywrightLaunchError, isPlaywrightSandboxRestrictionError } from "@mizchi/vlmkit-capture/playwright-launch-error.ts";
import { launchBrowser } from "@mizchi/vlmkit-core/browser-launch.ts";
import type { ShiftRegion, VrtDiff, VrtSnapshot } from "@mizchi/vlmkit-core/types.ts";
import { applyMask, parseMaskSelectors } from "@mizchi/vlmkit-core/mask.ts";
import { DIM, RESET, GREEN, RED, YELLOW, CYAN, BOLD, hr as _hr } from "@mizchi/vlmkit-core/terminal-colors.ts";
import {
  evaluateRenderSanity,
  probeSourceHtml,
  RENDER_PROBE_BROWSER_SCRIPT,
  type FailedRequest,
  type RenderSanityResult,
} from "../../vrt/compare/render-sanity.ts";
import {
  verifyDomEquivalence,
  DOM_FINGERPRINT_BROWSER_SCRIPT,
  type DomFingerprint,
  type DomEquivalenceResult,
} from "@mizchi/vlmkit-core/dom-equivalence.ts";
import { buildComputedStyleCaptureJsonExpression, parseComputedStyleSnapshot } from "@mizchi/vlmkit-core/computed-style-capture.ts";
import { aggregateCsdByViewport, diffComputedStyles, type CsdPerViewportResult, type CsdResult, type ComputedStyleSnapshot } from "@mizchi/vlmkit-core/computed-style-diff.ts";
import { buildAuthoredStyleCaptureJsonExpression, parseAuthoredStyleSnapshot, type AuthoredStyleSnapshot } from "@mizchi/vlmkit-core/authored-style-capture.ts";
import { aggregateAuthoredStyleByViewport, diffAuthoredStyles, type AuthoredStyleDiffResult, type AuthoredStylePerViewportResult } from "@mizchi/vlmkit-core/authored-style-diff.ts";
import {
  diffDomPositionStyles,
  diffPositionStylesAcrossViewports,
  DOM_POSITION_STYLES_BROWSER_SCRIPT,
  parseDomPositionStyles,
  type DpResult,
  type DpPerViewportResult,
  type PositionedElement,
} from "@mizchi/vlmkit-core/dom-position-styles.ts";
import {
  explainShiftAccumulations,
  findShiftOrigins,
  DOM_BBOX_BROWSER_SCRIPT,
  parseBboxes,
  type BboxElement,
  type ShiftAccumulationBreakdown,
  type ShiftOrigin,
} from "@mizchi/vlmkit-markup/shift-origin.ts";
import { findGridSuggestions, type GridSuggestion } from "@mizchi/vlmkit-markup/grid-ratio.ts";
import {
  extractComponentsFromFile,
  matchComponents,
  type MatchedBbox,
} from "@mizchi/vlmkit-markup/component/component-bbox.ts";
import { buildGeometryProfiles, type PerRankGeometry } from "@mizchi/vlmkit-markup/component/component-geometry.ts";
import { findHeatmapRegionsFromFile, type HeatmapRegion } from "@mizchi/vlmkit-core/heatmap-regions.ts";
import {
  extractTextRowsFromFile,
  matchTextRows,
  type MatchedTextRow,
} from "@mizchi/vlmkit-core/text-rows.ts";
import { extractPaletteFromFile, type PaletteColor } from "@mizchi/vlmkit-markup/style/palette-extract.ts";
import { diffPalettes, type PaletteDiff } from "@mizchi/vlmkit-markup/style/palette-diff.ts";
import { handleCliError } from "@mizchi/vlmkit-core/cli-error.ts";
import {
  applyForcedPseudoState,
  clearStateMarkers,
  type ForcedPseudoState,
  type AppliedForcedState,
} from "@mizchi/vlmkit-markup/stress/multi-state.ts";

// ---- Config ----

function getArg(args: string[], name: string, fallback: string): string {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : fallback;
}
function getArgList(args: string[], name: string): string[] {
  const idx = args.indexOf(`--${name}`);
  if (idx < 0) return [];
  const values: string[] = [];
  for (let i = idx + 1; i < args.length && !args[i].startsWith("--"); i++) {
    values.push(args[i]);
  }
  return values;
}
function hasFlag(args: string[], name: string): boolean { return args.includes(`--${name}`); }

interface DomPositionTrimEntry {
  baselineClasses: string;
  variantClasses: string;
  property: string;
}

function domPositionClassPairKey(entry: DomPositionTrimEntry): string {
  return `${entry.baselineClasses}\u0000${entry.variantClasses}\u0000${entry.property}`;
}

export function trimDomPositionEntriesByClassPair<T extends DomPositionTrimEntry>(
  entries: T[],
  limit: number,
): T[] {
  if (limit <= 0) return [];
  if (entries.length <= limit) return entries;

  const groupOrder: string[] = [];
  const groups = new Map<string, T[]>();
  for (const entry of entries) {
    const key = domPositionClassPairKey(entry);
    const group = groups.get(key);
    if (group) {
      group.push(entry);
    } else {
      groupOrder.push(key);
      groups.set(key, [entry]);
    }
  }

  const trimmed: T[] = [];
  for (let depth = 0; trimmed.length < limit; depth++) {
    let added = false;
    for (const key of groupOrder) {
      const entry = groups.get(key)?.[depth];
      if (!entry) continue;
      trimmed.push(entry);
      added = true;
      if (trimmed.length >= limit) break;
    }
    if (!added) break;
  }
  return trimmed;
}

export type BreakpointDiscoveryBackend = "auto" | "regex" | "crater";
export type MigrationRegionDiffFormat = "json" | "markdown" | "both";
export type MigrationRegionDiffAnalyzer = (
  options: RunRegionDiffAnalysisOptions,
) => Promise<RegionDiffOutput>;

function parseDiscoveryBackend(args: string[]): BreakpointDiscoveryBackend {
  const value = getArg(args, "discover-backend", "auto");
  if (value === "auto" || value === "regex" || value === "crater") {
    return value;
  }
  throw new Error(`invalid --discover-backend: ${value}`);
}

function parseRegionDiffFormat(args: string[]): MigrationRegionDiffFormat {
  const value = getArg(args, "region-diff-format", "both");
  if (value === "json" || value === "markdown" || value === "both") {
    return value;
  }
  throw new Error(`invalid --region-diff-format: ${value}`);
}

export interface MigrationCompareOptions {
  dir: string;
  baseline: string;
  variants: string[];
  outputDir: string;
  fixedViewports?: ViewportSpec[];
  autoDiscover: boolean;
  discoverBackend: BreakpointDiscoveryBackend;
  maxViewports: number;
  randomSamples: number;
  approvalPath: string;
  strict: boolean;
  paintTreeUrl: string;
  enablePaintTree: boolean;
  /** URL mode: baseline URL (page.goto instead of setContent) */
  baselineUrl?: string;
  /** URL mode: variant URLs */
  variantUrls?: string[];
  /** Selectors to mask (visibility: hidden) */
  maskSelectors?: string[];
  /** Run baseline render-sanity heuristics (default true). */
  baselineSanityCheck?: boolean;
  /** Exit non-zero when sanity checks fail (default false → warn only). */
  strictBaselineSanity?: boolean;
  /** Run DOM-equivalence preflight (default true). */
  domEquivalenceCheck?: boolean;
  /** Exit non-zero when DOM equivalence checks fail (default false → warn only). */
  strictDomEquivalence?: boolean;
  /** Capture computed-style snapshot for baseline + variants and diff (opt-in, default false). */
  computedStyleDiff?: boolean;
  /** Capture DOM-position-aligned computed styles (handles class renames, opt-in). */
  domPositionDiff?: boolean;
  /**
   * Extract component bounding boxes from captured screenshots and diff
   * them (image-only, no DOM required — see `src/component-bbox.ts`).
   * Default true; pass `--no-component-bbox` to disable.
   */
  componentBboxDiff?: boolean;
  /**
   * Capture additional screenshots with CSS pseudo-classes forced on
   * (`hover`, `focus`, `focus-visible`, `active`). Per-state diff is
   * surfaced alongside the default-state diff. Opt-in via `--states`.
   */
  states?: ForcedPseudoState[];
  /**
   * Emit a `baseline | variant | heatmap` triptych PNG per viewport
   * alongside the existing screenshots. Default true; pass
   * `--no-triptych` to disable.
   */
  triptych?: boolean;
  /**
   * Path to a DESIGN.md (or design-tokens.json) whose front-matter
   * tokens (spacing, colors) are used to snap diff deltas to named
   * tokens — "swap surface-variant → surface-container-high"
   * instead of bare hex pairs. Optional; falls back to raw values
   * when not provided.
   */
  tokensPath?: string;
  /**
   * Path to a previous run's output dir (or diff-report.json
   * directly). When provided, after the main compare a "Since
   * previous run:" section shows per-viewport diff% delta and
   * cross-round sign-flips so an agent on a tight budget can tell
   * whether their last edit moved the loop forward, regressed, or
   * overshot zero.
   */
  againstPreviousPath?: string;
  /**
   * Run the VLM region-diff handoff per changed viewport. Opt-in because
   * it calls OpenRouter and can add latency/cost.
   */
  regionDiff?: boolean;
  /** Which region-diff artifacts to write when `regionDiff` is enabled. */
  regionDiffFormat?: MigrationRegionDiffFormat;
  /** OpenRouter model id for VLM region diff. */
  regionDiffModel?: string;
  /** max_tokens for each VLM region-diff request. */
  regionDiffMaxTokens?: number;
  /** Maximum changed viewports per variant that run VLM region diff. Undefined means no cap. */
  regionDiffMaxViewports?: number;
  /**
   * Optional analyzer hook for offline dogfood/tests. CLI users leave this
   * unset so region diff calls the default OpenRouter-backed analyzer.
   */
  regionDiffAnalyzer?: MigrationRegionDiffAnalyzer;
}

export function parseMigrationCompareArgs(args: string[]): MigrationCompareOptions {
  const variants = getArgList(args, "variants");
  const baselineUrl = getArg(args, "url", "");
  const currentUrl = getArg(args, "current-url", "");
  const variantUrls = getArgList(args, "variant-urls");

  return {
    dir: getArg(args, "dir", "."),
    baseline: getArg(args, "baseline", baselineUrl ? "" : (args[0] ?? "")),
    variants: variants.length > 0 ? variants : (currentUrl ? [] : (args[1] ? [args[1]] : [])),
    // Accept `--output` as an alias for `--output-dir`. Agents reach for
    // `--output` first; the typo'd flag was silently swallowed before.
    outputDir: resolve(getArg(args, "output-dir", getArg(args, "output", join(process.cwd(), "test-results", "migration")))),
    autoDiscover: !hasFlag(args, "no-discover"),
    discoverBackend: parseDiscoveryBackend(args),
    maxViewports: parseInt(getArg(args, "max-viewports", "15"), 10),
    randomSamples: parseInt(getArg(args, "random-samples", "1"), 10),
    approvalPath: getArg(args, "approval", ""),
    strict: hasFlag(args, "strict"),
    paintTreeUrl: getArg(args, "paint-tree-url", DEFAULT_BIDI_URL),
    enablePaintTree: !hasFlag(args, "no-paint-tree"),
    baselineUrl: baselineUrl || undefined,
    variantUrls: currentUrl ? [currentUrl] : (variantUrls.length > 0 ? variantUrls : undefined),
    maskSelectors: parseMaskSelectors(args),
    baselineSanityCheck: !hasFlag(args, "no-baseline-sanity"),
    strictBaselineSanity: hasFlag(args, "strict-baseline-sanity"),
    domEquivalenceCheck: !hasFlag(args, "no-dom-equivalence"),
    strictDomEquivalence: hasFlag(args, "strict-dom-equivalence"),
    // Both Playwright-driven; default on so agents get property-level
    // signals (font-family, padding, gap, etc.) without having to know
    // these flags exist. Opt out with `--no-computed-style` /
    // `--no-dom-position-diff`. Neither depends on Crater BiDi.
    computedStyleDiff: !hasFlag(args, "no-computed-style") && !hasFlag(args, "no-computed-style-diff"),
    domPositionDiff: !hasFlag(args, "no-dom-position-diff") && !hasFlag(args, "no-position-diff"),
    componentBboxDiff: !hasFlag(args, "no-component-bbox"),
    states: parseStatesArg(args),
    triptych: !hasFlag(args, "no-triptych"),
    tokensPath: getArg(args, "tokens", "") || undefined,
    againstPreviousPath: getArg(args, "against-previous", "") || undefined,
    regionDiff: hasFlag(args, "region-diff") || hasFlag(args, "vlm-region-diff"),
    regionDiffFormat: parseRegionDiffFormat(args),
    regionDiffModel: getArg(args, "region-diff-model", DEFAULT_REGION_DIFF_MODEL),
    regionDiffMaxTokens: parseInt(getArg(args, "region-diff-max-tokens", "600"), 10) || 600,
    regionDiffMaxViewports: parseOptionalNonNegativeIntArg(args, "region-diff-max-viewports"),
  };
}

function parseOptionalNonNegativeIntArg(args: string[], name: string): number | undefined {
  const raw = getArg(args, name, "");
  if (!raw) return undefined;
  if (!/^\d+$/.test(raw)) {
    throw new Error(`invalid --${name}: expected a non-negative integer`);
  }
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`invalid --${name}: expected a non-negative integer`);
  }
  return value;
}

function parseStatesArg(args: string[]): ForcedPseudoState[] | undefined {
  const raw = getArgList(args, "states");
  if (raw.length === 0) return undefined;
  const valid: ForcedPseudoState[] = [];
  for (const s of raw) {
    if (s === "hover" || s === "focus" || s === "active" || s === "focus-visible") {
      valid.push(s);
    } else {
      console.log(`  ${YELLOW}! ignoring unknown --states value: ${s}${RESET}`);
    }
  }
  return valid.length > 0 ? valid : undefined;
}

// Fallback viewports (used when --no-discover)
const STATIC_VIEWPORTS: ViewportSpec[] = [
  { width: 1440, height: 900, label: "wide", reason: "standard" },
  { width: 1280, height: 900, label: "desktop", reason: "standard" },
  { width: 375, height: 812, label: "mobile", reason: "standard" },
];

function hr() { _hr(76); }

/**
 * Render-sanity warnings (failed stylesheet loads, fallback fonts, etc.)
 * mean the pixel diff downstream is suspect. Print them as a loud banner
 * so an agent scanning top-down sees the cause before it sees the
 * (now meaningless) diff numbers.
 *
 * Buried yellow text was being missed by agents per the 2026-05-15
 * design-md scenario report — promoted to a red bordered block here.
 */
function printRenderSanityBanner(side: "baseline" | "variant", sanity: RenderSanityResult): void {
  console.log();
  console.log(`  ${RED}${BOLD}┌─ render sanity (${side}) ─ ${sanity.warnings.length} warning(s) ─${"─".repeat(Math.max(0, 38 - side.length))}${RESET}`);
  for (const w of sanity.warnings) {
    console.log(`  ${RED}│${RESET}  [${w.code}] ${w.message}`);
  }
  if (sanity.failedRequests.length > 0) {
    console.log(`  ${RED}│${RESET}  ${DIM}failed requests (${sanity.failedRequests.length}):${RESET}`);
    for (const req of sanity.failedRequests.slice(0, 5)) {
      console.log(`  ${RED}│${RESET}    ${DIM}- ${req.url} (${req.errorText})${RESET}`);
    }
    if (sanity.failedRequests.length > 5) {
      console.log(`  ${RED}│${RESET}    ${DIM}... ${sanity.failedRequests.length - 5} more${RESET}`);
    }
  }
  console.log(`  ${RED}│${RESET}  ${DIM}Downstream diff numbers may be meaningless until resolved.${RESET}`);
  console.log(`  ${RED}└${"─".repeat(74)}${RESET}`);
  console.log();
}

/**
 * Detect whether two render-sanity results describe the *same* failure
 * on both sides. Symmetric failures (e.g. Google Fonts 404 against
 * baseline + variant in a sandbox) don't actually affect diff
 * comparability — they cancel out — so the red boxed banner is
 * misleading noise. Asymmetric failures still warrant the full
 * banner because the diff numbers are genuinely tainted.
 *
 * Symmetric ⇔ same set of warning codes AND same set of (url,
 * errorText) failed-request pairs.
 */
function isSymmetricSanity(
  baseline: RenderSanityResult | undefined,
  variant: RenderSanityResult | undefined,
): boolean {
  if (!baseline || !variant) return false;
  if (baseline.ok && variant.ok) return false;
  const bWarn = new Set(baseline.warnings.map((w) => w.code));
  const vWarn = new Set(variant.warnings.map((w) => w.code));
  if (bWarn.size !== vWarn.size) return false;
  for (const code of bWarn) if (!vWarn.has(code)) return false;
  const bReq = new Set(baseline.failedRequests.map((r) => `${r.url}::${r.errorText}`));
  const vReq = new Set(variant.failedRequests.map((r) => `${r.url}::${r.errorText}`));
  if (bReq.size !== vReq.size) return false;
  for (const k of bReq) if (!vReq.has(k)) return false;
  return true;
}

/**
 * Single dimmed-yellow line variant of the sanity banner used when
 * baseline + variant warnings are byte-identical. Diff numbers are
 * still affected (text geometry differs from what the spec intended)
 * but they're *consistent* — so an agent can still act on the diff.
 */
function printSymmetricSanityLine(sanity: RenderSanityResult): void {
  console.log();
  const codes = [...new Set(sanity.warnings.map((w) => w.code))].join(", ");
  const reqCount = sanity.failedRequests.length;
  const head = `  ${YELLOW}~ render sanity:${RESET} symmetric ${codes} on both baseline and variant ${DIM}(${reqCount} failed request${reqCount === 1 ? "" : "s"})${RESET}`;
  console.log(head);
  // Show up to 2 representative URLs.
  for (const req of sanity.failedRequests.slice(0, 2)) {
    console.log(`    ${DIM}- ${req.url} (${req.errorText})${RESET}`);
  }
  if (sanity.failedRequests.length > 2) {
    console.log(`    ${DIM}... ${sanity.failedRequests.length - 2} more (symmetric)${RESET}`);
  }
  console.log(`    ${DIM}symmetric failures cancel out in the diff; numbers remain comparable.${RESET}`);
  console.log();
}

function urlToLabel(url: string): string {
  try {
    const u = new URL(url);
    return (u.pathname.replace(/\//g, "_").replace(/^_|_$/g, "") || "root").replace(/\.html$/, "");
  } catch {
    return "page";
  }
}

type PaintTreeChangeType = PaintTreeChange["type"];

interface PaintTreeStatus {
  enabled: boolean;
  available: boolean;
  url?: string;
  error?: string;
}

interface BreakpointDiscoveryStatus {
  requestedBackend: BreakpointDiscoveryBackend;
  backendUsed: "regex" | "crater";
  fallbackReason?: string;
  breakpoints: ResponsiveBreakpoint[];
  diagnostics?: BreakpointDiscoveryDiagnosticsSummary;
}

export interface BreakpointDiscoveryDocumentInput {
  label: string;
  html: string;
  htmlPath?: string;
}

export interface BreakpointDiscoveryDocumentDiagnostics extends CraterBreakpointDiscoveryDiagnostics {
  label: string;
}

export interface BreakpointDiscoveryDiagnosticsSummary {
  documents: BreakpointDiscoveryDocumentDiagnostics[];
  totals: CraterBreakpointDiscoveryDiagnostics;
}

export interface BreakpointDiscoveryClient {
  connect(): Promise<void>;
  close(): Promise<void>;
  setContent(html: string): Promise<void>;
  getResponsiveBreakpoints(options?: {
    mode?: "live-inline" | "html-inline";
    axis?: "width";
    includeDiagnostics?: boolean;
  }): Promise<{
    breakpoints: ResponsiveBreakpoint[];
    diagnostics?: CraterBreakpointDiscoveryDiagnostics;
  }>;
}

export interface MigrationCompareResult {
  variant: string;
  variantFile: string;
  viewport: string;
  diffRatio: number;
  diffPixels: number;
  totalPixels: number;
  rawDiffRatio: number;
  rawDiffPixels: number;
  rawDominantCategory: MigrationDiffCategory | "none";
  rawCategorySummary: string;
  rawCategoryCounts: Record<MigrationDiffCategory, number>;
  approved: boolean;
  partiallyApproved: boolean;
  approvedPixels: number;
  approvalReasons: string[];
  dominantCategory: MigrationDiffCategory | "none";
  categorySummary: string;
  categoryCounts: Record<MigrationDiffCategory, number>;
  rawPaintTreeChangeCount: number;
  rawPaintTreeSummary: string;
  rawPaintTreeCounts: Record<PaintTreeChangeType, number>;
  paintTreeChangeCount: number;
  paintTreeSummary: string;
  paintTreeCounts: Record<PaintTreeChangeType, number>;
  approvedPaintTreeCount: number;
  approvedPaintTreeReasons: string[];
  fixCandidates: MigrationFixCandidate[];
  /** Per-band vertical shift offsets (null if no shift detected). */
  shiftRegions?: Array<{ yStart: number; yEnd: number; shift: number; confidence?: number }>;
  /** Global vertical shift in pixels (0 if no shift). */
  globalShift?: number;
  colorSamples?: MigrationColorSample[];
}

export interface MigrationColorSample {
  x: number;
  y: number;
  width: number;
  height: number;
  baseline: string;
  variant: string;
  distance?: number;
}

export interface MigrationRegionDiffChangeSummary {
  selector: string | null;
  selectorHint: string;
  selectorConfidence?: "high" | "medium" | "low";
  property: string;
  from: string | null;
  to: string | null;
  averageChannelDelta: number | null;
  bbox: RegionStructuredChange["bbox"];
  confidence: "high" | "medium" | "low";
  /** True when the measured bbox pixels refuted the VLM's claim (drafts 06/09). */
  refuted?: boolean;
}

export interface MigrationRegionDiffViewportReport {
  viewport: string;
  jsonPath?: string;
  markdownPath?: string;
  verdict?: RegionDiffOutput["verdict"];
  summary?: string;
  changeCount: number;
  changes: MigrationRegionDiffChangeSummary[];
  error?: string;
}

export interface MigrationRegionDiffSkippedViewport {
  viewport: string;
  diffRatio: number;
  diffPixels: number;
  reason: "region-diff-max-viewports";
}

export interface MigrationCompareReport {
  dir: string;
  baseline: string;
  variants: string[];
  viewports: ViewportSpec[];
  breakpointDiscovery?: BreakpointDiscoveryStatus;
  approvalPath?: string;
  strict: boolean;
  approvalWarnings: Awaited<ReturnType<typeof collectApprovalWarnings>>;
  paintTree: PaintTreeStatus;
  baselineSanity?: RenderSanityResult;
  domEquivalence?: Array<{
    variantFile: string;
    result: DomEquivalenceResult;
  }>;
  computedStyleDiff?: Array<{
    variantFile: string;
    result: CsdResult;
  }>;
  /**
   * Per-viewport CSD: each (selector, property) pair is rolled up with
   * the viewports it differs on, plus universal vs. breakpoint-gated
   * sets so consumers can split base rules from `@media`-gated ones.
   */
  computedStyleDiffPerViewport?: Array<{
    variantFile: string;
    result: CsdPerViewportResult;
  }>;
  /**
   * Authored-style diff. Same shape as `computedStyleDiff` but captured
   * via CSSOM (`document.styleSheets.cssRules`) instead of
   * `getComputedStyle`. Catches grid-template-* / flex / transform diffs
   * that the computed channel can't surface without corrupting the fr→px
   * resolution.
   */
  authoredStyleDiff?: Array<{
    variantFile: string;
    result: AuthoredStyleDiffResult;
  }>;
  authoredStyleDiffPerViewport?: Array<{
    variantFile: string;
    result: AuthoredStylePerViewportResult;
  }>;
  domPositionDiff?: Array<{
    variantFile: string;
    result: DpResult;
  }>;
  /** Cross-viewport DOM-position diff: surfaces media-query-gated deltas. */
  domPositionDiffPerViewport?: Array<{
    variantFile: string;
    result: DpPerViewportResult;
  }>;
  /** Per-viewport shift-origin diagnostics (which element causes each band's shift). */
  shiftOrigins?: Array<{
    variantFile: string;
    perViewport: Array<{
      viewport: string;
      origins: ShiftOrigin[];
      /** Bands the pixel-shift detector reported but for which no DOM-level Δy was found.
       *  Usually a pixelmatch cross-correlation artifact (phantom shift). */
      unexplainedBands?: ShiftRegion[];
    }>;
  }>;
  /** Per-band upstream height-delta accumulation grouped by class pair. */
  shiftAccumulations?: Array<{
    variantFile: string;
    perViewport: Array<{
      viewport: string;
      breakdowns: ShiftAccumulationBreakdown[];
    }>;
  }>;
  /** Per-viewport grid-template-columns suggestions (children widths differ). */
  gridSuggestions?: Array<{
    variantFile: string;
    suggestions: GridSuggestion[];
  }>;
  /**
   * Per-viewport component bbox diff — pure image analysis of the
   * captured screenshots (no DOM correspondence required). Useful for
   * wireframe / from-screenshot scenarios where baseline and variant
   * may not share DOM tree shape.
   */
  componentBboxDiffs?: Array<{
    variantFile: string;
    perViewport: Array<{ viewport: string; matches: MatchedBbox[] }>;
  }>;
  /**
   * Cross-viewport geometry profiles derived from componentBboxDiffs.
   * Surfaces responsive-mismatch flags ("baseline width spreads 837px
   * across viewports; variant 0px → variant missing responsive rule").
   */
  componentGeometryProfiles?: Array<{
    variantFile: string;
    profiles: PerRankGeometry[];
  }>;
  /**
   * Per-viewport connected-component clusters of pixelmatch hot pixels in
   * `*_heatmap.png`. Localizes "where in the image the diff actually is"
   * even when baseline and variant share no DOM.
   */
  heatmapRegions?: Array<{
    variantFile: string;
    perViewport: Array<{ viewport: string; regions: HeatmapRegion[] }>;
  }>;
  /**
   * Per-viewport text-row Δy. Pairs dark luminance bands by order
   * (top-to-bottom) between baseline and variant; surfaces rows whose
   * y-coordinate shifted. Works without DOM correspondence — useful
   * for the wireframe scenario where bbox matching fails on
   * structurally-divergent pages.
   */
  textRowShifts?: Array<{
    variantFile: string;
    perViewport: Array<{
      viewport: string;
      matches: MatchedTextRow[];
      baselineRowCount: number;
      variantRowCount: number;
    }>;
  }>;
  /**
   * Per-viewport palette diff. Surfaces "the agent used #3B82F6 where
   * design tokens say #2563EB" — hard-coded literals slipping into a
   * tokenized design system. Worst case: 16-color top-K × N viewports
   * per variant, kept small enough not to bloat the report.
   */
  paletteDiffs?: Array<{
    variantFile: string;
    perViewport: Array<{
      viewport: string;
      baseline: PaletteColor[];
      variant: PaletteColor[];
      diff: PaletteDiff;
    }>;
  }>;
  /**
   * Per-state (`:hover`, `:focus`, ...) diff between baseline and
   * variant. Captures the page with each pseudo-class forced on all
   * interactive elements via CDP `CSS.forcePseudoState`, then runs
   * the standard pixelmatch comparison.
   *
   * Catches "agent forgot to wire up :hover styles" — a class of bug
   * the default-state VRT can't see because both sides render
   * identically when no interactions happen.
   */
  stateDiffs?: Array<{
    variantFile: string;
    perState: Array<{
      state: ForcedPseudoState;
      forcedCount: number;
      affectedElements: string[];
      perViewport: Array<{
        viewport: string;
        defaultDiffRatio: number;
        stateDiffRatio: number;
        /** stateDiffRatio − defaultDiffRatio (how much *worse* the diff gets in this state). */
        hoverInducedDelta: number;
      }>;
    }>;
  }>;
  /**
   * Optional VLM region-diff handoff artifacts generated by
   * `--region-diff`. The full JSON/Markdown files live next to the
   * screenshots; this report stores small per-viewport summaries plus
   * paths so downstream agents can load only the relevant artifact.
   */
  regionDiffs?: Array<{
    variantFile: string;
    maxViewports?: number;
    perViewport: MigrationRegionDiffViewportReport[];
    skippedViewports?: MigrationRegionDiffSkippedViewport[];
  }>;
  /**
   * Wireframe-mode fix suggestions emitted by
   * `generateWireframeFixCandidates`. Persisted to the JSON report so
   * `vlmkit watch` can compute "newly introduced vs resolved" deltas
   * between rounds without re-deriving them.
   */
  wireframeFixSuggestions?: Array<{
    variantFile: string;
    suggestions: WireframeFixSuggestion[];
  }>;
  results: MigrationCompareResult[];
  reportPath: string;
}

export function summarizeMigrationRegionDiffOutput(
  viewport: string,
  output: RegionDiffOutput,
  paths: { jsonPath?: string; markdownPath?: string },
): MigrationRegionDiffViewportReport {
  return {
    viewport,
    ...paths,
    verdict: output.verdict,
    summary: output.summary,
    changeCount: output.changes.length,
    changes: output.changes.map((change) => ({
      selector: change.selector,
      selectorHint: change.selectorHint,
      ...(change.selectorConfidence ? { selectorConfidence: change.selectorConfidence } : {}),
      property: change.property,
      from: change.from,
      to: change.to,
      averageChannelDelta: change.delta.averageChannelDelta,
      bbox: change.bbox,
      confidence: change.confidence,
      ...(change.verification?.refuted ? { refuted: true } : {}),
    })),
  };
}

async function writeMigrationRegionDiffArtifacts(options: {
  baselinePath: string;
  variantPath: string;
  elements: RegionElementRect[];
  outputDir: string;
  variantName: string;
  viewport: string;
  format: MigrationRegionDiffFormat;
  model: string;
  maxTokens: number;
  analyzer: MigrationRegionDiffAnalyzer;
}): Promise<MigrationRegionDiffViewportReport> {
  const output = await options.analyzer({
    baseline: options.baselinePath,
    variant: options.variantPath,
    elements: options.elements,
    model: options.model,
    maxTokens: options.maxTokens,
  });
  const baseName = `${options.variantName}-${options.viewport}-region-diff`;
  const jsonPath = options.format === "json" || options.format === "both"
    ? join(options.outputDir, `${baseName}.json`)
    : undefined;
  const markdownPath = options.format === "markdown" || options.format === "both"
    ? join(options.outputDir, `${baseName}.md`)
    : undefined;

  if (jsonPath) {
    await writeFile(jsonPath, JSON.stringify(output, null, 2) + "\n");
  }
  if (markdownPath) {
    await writeFile(markdownPath, formatRegionDiffMarkdown(output));
  }
  return summarizeMigrationRegionDiffOutput(options.viewport, output, { jsonPath, markdownPath });
}

// ---- Main ----

async function main(cliArgs = process.argv.slice(2)) {
  const options = parseMigrationCompareArgs(cliArgs);
  const hasFileInput = options.baseline && options.variants.length > 0;
  const hasUrlInput = options.baselineUrl && options.variantUrls && options.variantUrls.length > 0;
  if (!hasFileInput && !hasUrlInput) {
    console.log(`Usage: vlmkit diff html <before.html> <after.html>`);
    console.log(`       vlmkit diff html --dir <dir> --baseline <file> --variants <file1> <file2> ...`);
    console.log(`       vlmkit diff html --url <baseline-url> --current-url <current-url>`);
    console.log(`       vlmkit diff html --url <baseline-url> --variant-urls <url1> <url2> ...`);
    console.log();
    console.log(`Options: [--output-dir path] [--approval approval.json] [--strict]`);
    console.log(`         [--discover-backend auto|regex|crater] [--no-paint-tree] [--no-discover]`);
    console.log(`         [--region-diff] [--region-diff-format json|markdown|both] [--region-diff-max-viewports n]`);
    process.exit(1);
  }
  await runMigrationCompare(options);
}

export async function runMigrationCompare(options: MigrationCompareOptions): Promise<MigrationCompareReport> {
  const {
    dir,
    baseline,
    variants,
    outputDir,
    autoDiscover,
    discoverBackend,
    maxViewports,
    randomSamples,
    approvalPath,
    strict,
    paintTreeUrl,
    enablePaintTree,
  } = options;
  const regionDiffEnabled = options.regionDiff ?? false;
  const regionDiffFormat = options.regionDiffFormat ?? "both";
  const regionDiffModel = options.regionDiffModel ?? DEFAULT_REGION_DIFF_MODEL;
  const regionDiffMaxTokens = options.regionDiffMaxTokens ?? 600;
  const regionDiffMaxViewports = options.regionDiffMaxViewports;
  const regionDiffAnalyzer = options.regionDiffAnalyzer ?? runRegionDiffAnalysis;

  await mkdir(outputDir, { recursive: true });

  // Optional DESIGN.md token source. Loaded once; fed to the
  // wireframe-mode fix-candidate generator and (later) palette diff
  // reverse-lookup. Failure to load is non-fatal — we just skip the
  // token-snapping and surface a single warning.
  let designTokens: DesignTokens | undefined;
  if (options.tokensPath) {
    try {
      designTokens = await loadDesignTokens(options.tokensPath);
      console.log(`  ${DIM}Tokens: ${designTokens.colors.size} colors, ${designTokens.spacing.length} spacing, ${designTokens.rounded.size} rounded loaded from ${options.tokensPath}${RESET}`);
    } catch (error) {
      console.log(`  ${YELLOW}Failed to load --tokens ${options.tokensPath}: ${String(error)}${RESET}`);
    }
  }

  const isUrlMode = !!options.baselineUrl;
  let baselineHtml: string;
  let baselineName: string;
  // File-mode: rendering goes through `page.goto(file://...)` so that
  // relative `<link>` / `<script>` hrefs resolve. `setContent` had no base
  // URL, which caused unstyled renders on both sides and a false 0% diff.
  let baselineFileUrl: string | undefined;

  if (isUrlMode) {
    // URL mode: defer HTML capture to after browser launch
    baselineHtml = ""; // will be filled after page.goto()
    baselineName = urlToLabel(options.baselineUrl!);
  } else {
    const baselinePath = resolve(dir, baseline);
    baselineHtml = await readFile(baselinePath, "utf-8");
    baselineName = basename(baseline, ".html");
    baselineFileUrl = pathToFileURL(baselinePath).href;
  }

  // Build variant sources + disambiguate basename collisions BEFORE the
  // baseline rendering loop so that on-disk screenshot paths use the
  // disambiguated names. Otherwise baseline screenshots get written under
  // the colliding name first, then the variant overwrites them — producing
  // a false 0% diff of the variant against itself.
  const variantSources: Array<{ label: string; url: string; file: string; fileUrl?: string }> = isUrlMode
    ? (options.variantUrls ?? []).map((url) => ({ label: urlToLabel(url), url, file: "" }))
    : variants.map((f) => {
        const p = resolve(dir, f);
        return { label: basename(f, ".html"), url: "", file: f, fileUrl: pathToFileURL(p).href };
      });

  if (!isUrlMode) {
    const labelCount = new Map<string, number>();
    const bump = (k: string) => labelCount.set(k, (labelCount.get(k) ?? 0) + 1);
    bump(baselineName);
    for (const v of variantSources) bump(v.label);
    const parentTag = (p: string) => basename(dirname(resolve(dir, p))) || "root";
    if ((labelCount.get(baselineName) ?? 0) > 1) {
      baselineName = `${parentTag(baseline)}__${baselineName}`;
    }
    const seen = new Set<string>([baselineName]);
    for (const v of variantSources) {
      if (seen.has(v.label)) v.label = `${parentTag(v.file)}__${v.label}`;
      seen.add(v.label);
    }
  }
  const resolvedApprovalPath = await resolveApprovalPath(dir, approvalPath);
  const approvalManifest = resolvedApprovalPath ? await loadApprovalManifest(resolvedApprovalPath) : null;
  const approvalWarnings = approvalManifest ? collectApprovalWarnings(approvalManifest) : [];
  const baselinePaintTrees = new Map<string, PaintNode>();
  const paintTreeStatus: PaintTreeStatus = {
    enabled: enablePaintTree,
    available: false,
    url: enablePaintTree ? paintTreeUrl : undefined,
  };
  let breakpointDiscoveryStatus: BreakpointDiscoveryStatus | undefined;

  // Auto-discover breakpoints from all HTML files
  let VIEWPORTS: ViewportSpec[];
  if (options.fixedViewports && options.fixedViewports.length > 0) {
    VIEWPORTS = options.fixedViewports;
  } else if (autoDiscover && !isUrlMode) {
    const allHtmls: BreakpointDiscoveryDocumentInput[] = [
      { label: "baseline", html: baselineHtml, htmlPath: resolve(dir, baseline) },
    ];
    for (const v of variants) {
      const htmlPath = resolve(dir, v);
      allHtmls.push({
        label: `variant:${v}`,
        html: await readFile(htmlPath, "utf-8"),
        htmlPath,
      });
    }
    breakpointDiscoveryStatus = await discoverResponsiveBreakpointsForHtmlDocuments(
      allHtmls,
      discoverBackend,
      paintTreeUrl,
    );
    VIEWPORTS = generateViewports(breakpointDiscoveryStatus.breakpoints, {
      maxViewports,
      randomSamples,
    });

    console.log();
    console.log(`  ${DIM}Breakpoint discovery: ${breakpointDiscoveryStatus.backendUsed}${RESET}`);
    if (breakpointDiscoveryStatus.fallbackReason) {
      console.log(`  ${YELLOW}! ${breakpointDiscoveryStatus.fallbackReason}${RESET}`);
    }
    if (breakpointDiscoveryStatus.breakpoints.length > 0) {
      console.log();
      console.log(`  ${DIM}Discovered breakpoints: ${breakpointDiscoveryStatus.breakpoints.map(formatResponsiveBreakpoint).join(", ")}${RESET}`);
    }
  } else {
    VIEWPORTS = STATIC_VIEWPORTS;
  }

  console.log();
  console.log(`${BOLD}${CYAN}╔═══════════════════════════════════════════════════════════════════════════╗${RESET}`);
  console.log(`${BOLD}${CYAN}║  Migration VRT Compare                                                  ║${RESET}`);
  console.log(`${BOLD}${CYAN}╚═══════════════════════════════════════════════════════════════════════════╝${RESET}`);
  console.log(`  ${DIM}Baseline: ${isUrlMode ? options.baselineUrl : baseline}${RESET}`);
  console.log(`  ${DIM}Variants: ${isUrlMode ? (options.variantUrls ?? []).join(", ") : variants.join(", ")}${RESET}`);
  console.log(`  ${DIM}Viewports (${VIEWPORTS.length}): ${VIEWPORTS.map((v) => `${v.label}(${v.width})`).join(", ")}${RESET}`);
  if (resolvedApprovalPath) {
    console.log(`  ${DIM}Approval: ${resolvedApprovalPath}${strict ? " (strict mode: ignored)" : ""}${RESET}`);
    for (const warning of approvalWarnings) {
      console.log(`  ${YELLOW}! ${warning.message}${RESET}`);
    }
  }
  if (options.maskSelectors?.length) {
    console.log(`  ${DIM}Mask: ${options.maskSelectors.join(", ")}${RESET}`);
  }
  if (!enablePaintTree) {
    console.log(`  ${DIM}Paint tree: disabled${RESET}`);
  } else if (paintTreeStatus.error) {
    console.log(`  ${DIM}Paint tree: unavailable (${paintTreeStatus.error}) — using Playwright computed-style + DOM-position fallback${RESET}`);
  }
  console.log();
  let browser: Browser | null = null;
  let paintTreeClient: CraterClient | null = null;
  const disablePaintTree = async (message: string) => {
    paintTreeStatus.available = false;
    paintTreeStatus.error = message;
    baselinePaintTrees.clear();
    if (paintTreeClient) {
      await paintTreeClient.close();
      paintTreeClient = null;
    }
  };

  try {
    // The sandbox diagnosis now travels with the launch instead of being copied
    // around it: `diagnoseSandboxLaunchFailure` declines anything that is not the
    // Codex/macOS case, so core's missing-browser message still applies and an
    // unrecognized failure is rethrown untouched.
    browser = await launchBrowser({ diagnose: diagnoseSandboxLaunchFailure });
    const baselineScreenshots = new Map<string, string>();

    if (enablePaintTree) {
      const available = await isCraterAvailable(paintTreeUrl);
      if (!available) {
        paintTreeStatus.error = `Crater BiDi unavailable at ${paintTreeUrl}`;
      } else {
        try {
          paintTreeClient = new CraterClient(paintTreeUrl);
          await paintTreeClient.connect();
          paintTreeStatus.available = true;
        } catch (error) {
          paintTreeStatus.error = `Failed to connect to Crater BiDi: ${String(error)}`;
          paintTreeClient = null;
        }
      }
    }

    if (paintTreeStatus.available) {
      console.log(`  ${DIM}Paint tree: enabled via ${paintTreeUrl}${RESET}`);
      console.log();
    } else if (enablePaintTree && paintTreeStatus.error) {
      console.log(`  ${DIM}Paint tree: unavailable (${paintTreeStatus.error}) — using Playwright computed-style + DOM-position fallback${RESET}`);
      console.log();
    }

    // Capture baseline at all viewports
    let baselineSanity: RenderSanityResult | undefined;
    let baselineDomFingerprint: DomFingerprint | undefined;
    let baselineComputedStyles: ComputedStyleSnapshot | undefined;
    const baselineComputedStylesByVp = new Map<string, ComputedStyleSnapshot>();
    let baselineAuthoredStyles: AuthoredStyleSnapshot | undefined;
    const baselineAuthoredStylesByVp = new Map<string, AuthoredStyleSnapshot>();
    let baselineDomPositionStyles: PositionedElement[] | undefined;
    const baselineDomPositionByVp = new Map<string, PositionedElement[]>();
    const baselineBboxesByVp = new Map<string, BboxElement[]>();
    const domEnabled = options.domEquivalenceCheck ?? true;
    const csdEnabled = options.computedStyleDiff ?? false;
    const dpEnabled = options.domPositionDiff ?? false;
    const variantBboxEnabled = dpEnabled || regionDiffEnabled;
    for (const [vpIndex, vp] of VIEWPORTS.entries()) {
      const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });

      // Only probe sanity on the first viewport — the inputs are deterministic
      // per fixture and there's no reason to repeat the check N times.
      const sanityEnabled = options.baselineSanityCheck ?? true;
      const shouldProbe = sanityEnabled && vpIndex === 0;
      const failedRequests: FailedRequest[] = [];
      const onFailed = (req: import("playwright").Request) => {
        failedRequests.push({
          url: req.url(),
          errorText: req.failure()?.errorText ?? "unknown failure",
        });
      };
      if (shouldProbe) page.on("requestfailed", onFailed);

      if (isUrlMode) {
        await page.goto(options.baselineUrl!, { waitUntil: "networkidle", timeout: 30000 });
        if (!baselineHtml) {
          baselineHtml = await page.content();
        }
      } else if (baselineFileUrl) {
        await page.goto(baselineFileUrl, { waitUntil: "networkidle", timeout: 30000 });
      } else {
        await page.setContent(baselineHtml, { waitUntil: "networkidle" });
      }
      if (options.maskSelectors?.length) await applyMask(page, options.maskSelectors);
      const path = join(outputDir, `${baselineName}-${vp.label}.png`);
      await page.screenshot({ path, fullPage: true });
      baselineScreenshots.set(vp.label, path);

      if (shouldProbe) {
        try {
          const browserProbe = await page.evaluate(RENDER_PROBE_BROWSER_SCRIPT) as {
            bodyFontFamily: string;
            styleSheetCount: number;
            hasClassAttributes: boolean;
          };
          const sourceProbe = probeSourceHtml(baselineHtml);
          baselineSanity = evaluateRenderSanity({
            failedRequests,
            probe: { ...browserProbe, ...sourceProbe },
          });
        } catch (error) {
          // Probe failure should not block the run — record an empty result.
          baselineSanity = { ok: true, warnings: [], failedRequests };
          console.log(`  ${YELLOW}Baseline sanity probe error: ${String(error)}${RESET}`);
        }
        page.off("requestfailed", onFailed);

        // Baseline banner is now deferred to the per-variant loop so
        // we can detect symmetric-with-variant failures and downgrade
        // the boxed red banner to a single dimmed line. Asymmetric
        // and one-sided baseline failures still get the full banner
        // from the variant-loop branch.
      }

      // Capture baseline DOM fingerprint once (first viewport).
      if (domEnabled && vpIndex === 0) {
        try {
          baselineDomFingerprint = await page.evaluate(DOM_FINGERPRINT_BROWSER_SCRIPT) as DomFingerprint;
        } catch (error) {
          console.log(`  ${YELLOW}Baseline DOM fingerprint error: ${String(error)}${RESET}`);
        }
      }

      // Capture baseline computed-style snapshot at every viewport so
      // we can flag breakpoint-gated rules. Closes #21 — single-sample
      // CSD without viewport tag made subagents apply mobile fixes to
      // desktop and vice-versa. `baselineComputedStyles` (the legacy
      // single-snapshot field) keeps pointing at the first-viewport
      // capture for any consumer that only knows the old shape.
      if (csdEnabled) {
        try {
          const raw = await page.evaluate(buildComputedStyleCaptureJsonExpression());
          const snapshot = parseComputedStyleSnapshot(raw) as ComputedStyleSnapshot;
          baselineComputedStylesByVp.set(vp.label, snapshot);
          if (vpIndex === 0) baselineComputedStyles = snapshot;
        } catch (error) {
          console.log(`  ${YELLOW}Baseline computed-style capture error (${vp.label}): ${String(error)}${RESET}`);
        }
        try {
          const raw = await page.evaluate(buildAuthoredStyleCaptureJsonExpression());
          const snapshot = parseAuthoredStyleSnapshot(raw);
          baselineAuthoredStylesByVp.set(vp.label, snapshot);
          if (vpIndex === 0) baselineAuthoredStyles = snapshot;
        } catch (error) {
          console.log(`  ${YELLOW}Baseline authored-style capture error (${vp.label}): ${String(error)}${RESET}`);
        }
      }

      // Capture baseline DOM-position styles per viewport.
      if (dpEnabled) {
        try {
          const raw = await page.evaluate(DOM_POSITION_STYLES_BROWSER_SCRIPT);
          const captured = parseDomPositionStyles(raw);
          baselineDomPositionByVp.set(vp.label, captured);
          // Preserve the single-viewport snapshot for the legacy `domPositionDiff` field.
          if (vpIndex === 0) baselineDomPositionStyles = captured;
        } catch (error) {
          console.log(`  ${YELLOW}Baseline DOM-position capture error (${vp.label}): ${String(error)}${RESET}`);
        }
        try {
          const rawBbox = await page.evaluate(DOM_BBOX_BROWSER_SCRIPT);
          baselineBboxesByVp.set(vp.label, parseBboxes(rawBbox));
        } catch (error) {
          console.log(`  ${YELLOW}Baseline bbox capture error (${vp.label}): ${String(error)}${RESET}`);
        }
      }

      await page.close();

      if (paintTreeClient) {
        try {
          baselinePaintTrees.set(
            vp.label,
            await capturePaintTreeForViewport(
              paintTreeClient,
              { width: vp.width, height: vp.height },
              baselineHtml,
            ),
          );
        } catch (error) {
          await disablePaintTree(`Failed to capture baseline paint tree at ${vp.label}: ${String(error)}`);
        }
      }
    }

    // Compare each variant
    const results: MigrationCompareResult[] = [];

    const domEquivalenceReports: Array<{ variantFile: string; result: DomEquivalenceResult }> = [];
    const computedStyleDiffReports: Array<{ variantFile: string; result: CsdResult }> = [];
    const computedStyleDiffPerViewportReports: Array<{ variantFile: string; result: CsdPerViewportResult }> = [];
    const authoredStyleDiffReports: Array<{ variantFile: string; result: AuthoredStyleDiffResult }> = [];
    const authoredStyleDiffPerViewportReports: Array<{ variantFile: string; result: AuthoredStylePerViewportResult }> = [];
    const domPositionDiffReports: Array<{ variantFile: string; result: DpResult }> = [];
    const domPositionDiffPerViewportReports: Array<{ variantFile: string; result: DpPerViewportResult }> = [];
    const shiftOriginsReports: Array<{ variantFile: string; perViewport: Array<{ viewport: string; origins: ShiftOrigin[]; unexplainedBands?: ShiftRegion[] }> }> = [];
    const shiftAccumulationsReports: Array<{ variantFile: string; perViewport: Array<{ viewport: string; breakdowns: ShiftAccumulationBreakdown[] }> }> = [];
    const gridSuggestionsReports: Array<{ variantFile: string; suggestions: GridSuggestion[] }> = [];
    const componentBboxReports: Array<{ variantFile: string; perViewport: Array<{ viewport: string; matches: MatchedBbox[] }> }> = [];
    const componentGeometryReports: Array<{ variantFile: string; profiles: PerRankGeometry[] }> = [];
    const heatmapRegionsReports: Array<{ variantFile: string; perViewport: Array<{ viewport: string; regions: HeatmapRegion[] }> }> = [];
    const textRowShiftsReports: Array<{
      variantFile: string;
      perViewport: Array<{ viewport: string; matches: MatchedTextRow[]; baselineRowCount: number; variantRowCount: number }>;
    }> = [];
    const paletteDiffsReports: Array<{
      variantFile: string;
      perViewport: Array<{ viewport: string; baseline: PaletteColor[]; variant: PaletteColor[]; diff: PaletteDiff }>;
    }> = [];
    const regionDiffReports: Array<{
      variantFile: string;
      maxViewports?: number;
      perViewport: MigrationRegionDiffViewportReport[];
      skippedViewports?: MigrationRegionDiffSkippedViewport[];
    }> = [];
    const wireframeFixReports: Array<{ variantFile: string; suggestions: WireframeFixSuggestion[] }> = [];
    const stateDiffsReports: Array<{
      variantFile: string;
      perState: Array<{
        state: ForcedPseudoState;
        forcedCount: number;
        affectedElements: string[];
        perViewport: Array<{ viewport: string; defaultDiffRatio: number; stateDiffRatio: number; hoverInducedDelta: number }>;
      }>;
    }> = [];
    for (const variant of variantSources) {
      let variantHtml: string;
      const variantName = variant.label;
      const regionDiffPerViewport: MigrationRegionDiffViewportReport[] = [];
      const regionDiffSkippedViewports: MigrationRegionDiffSkippedViewport[] = [];
      const regionDiffCandidates: Array<{
        viewport: string;
        baselinePath: string;
        variantPath: string;
        elements: RegionElementRect[];
        diffRatio: number;
        diffPixels: number;
        order: number;
      }> = [];

      if (variant.url) {
        variantHtml = ""; // captured via goto
      } else {
        const variantPath = resolve(dir, variant.file);
        variantHtml = await readFile(variantPath, "utf-8");
      }

      console.log(`  ${BOLD}${variantName}${RESET} vs ${baselineName}`);

      let variantDomFingerprint: DomFingerprint | undefined;
      let variantComputedStyles: ComputedStyleSnapshot | undefined;
      const variantComputedStylesByVp = new Map<string, ComputedStyleSnapshot>();
      let variantAuthoredStyles: AuthoredStyleSnapshot | undefined;
      const variantAuthoredStylesByVp = new Map<string, AuthoredStyleSnapshot>();
      let variantDomPositionStyles: PositionedElement[] | undefined;
      const variantDomPositionByVp = new Map<string, PositionedElement[]>();
      const variantBboxesByVp = new Map<string, BboxElement[]>();
      const shiftRegionsByVp = new Map<string, ShiftRegion[]>();
      const triptychPaths = new Map<string, string>();
      let variantSanity: RenderSanityResult | undefined;
      for (const [vpIndex, vp] of VIEWPORTS.entries()) {
        const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });

        // Variant render-sanity: register a failed-request listener on the
        // first viewport so we can warn about variant-side stylesheet 404s
        // and font fallbacks. Before this, only baseline was checked, which
        // missed render-breakage on the variant side (e.g. webfont fallback
        // on the variant that the baseline happened to load correctly).
        const variantSanityEnabled = (options.baselineSanityCheck ?? true) && vpIndex === 0;
        const variantFailedRequests: FailedRequest[] = [];
        const onVariantFailed = (req: import("playwright").Request) => {
          variantFailedRequests.push({
            url: req.url(),
            errorText: req.failure()?.errorText ?? "unknown failure",
          });
        };
        if (variantSanityEnabled) page.on("requestfailed", onVariantFailed);

        if (variant.url) {
          await page.goto(variant.url, { waitUntil: "networkidle", timeout: 30000 });
          if (!variantHtml) variantHtml = await page.content();
        } else if (variant.fileUrl) {
          await page.goto(variant.fileUrl, { waitUntil: "networkidle", timeout: 30000 });
        } else {
          await page.setContent(variantHtml, { waitUntil: "networkidle" });
        }
        if (options.maskSelectors?.length) await applyMask(page, options.maskSelectors);

        if (variantSanityEnabled) {
          try {
            const browserProbe = await page.evaluate(RENDER_PROBE_BROWSER_SCRIPT) as {
              bodyFontFamily: string;
              styleSheetCount: number;
              hasClassAttributes: boolean;
            };
            const sourceProbe = probeSourceHtml(variantHtml);
            variantSanity = evaluateRenderSanity({
              failedRequests: variantFailedRequests,
              probe: { ...browserProbe, ...sourceProbe },
            });
          } catch (error) {
            variantSanity = { ok: true, warnings: [], failedRequests: variantFailedRequests };
            console.log(`  ${YELLOW}Variant sanity probe error (${variantName}): ${String(error)}${RESET}`);
          }
          page.off("requestfailed", onVariantFailed);

          // Combined sanity rendering: symmetric failures fold into
          // a single dimmed-yellow line; asymmetric ones each get
          // their own red banner. Closes #32 — agent-d called out
          // that the boxed banner for the Google-Fonts-404-on-both-
          // sides case was misleading noise because the diff stays
          // comparable when both sides fall back identically.
          const baselineBad = !!(baselineSanity && !baselineSanity.ok);
          const variantBad = !!(variantSanity && !variantSanity.ok);
          if (baselineBad && variantBad && isSymmetricSanity(baselineSanity, variantSanity)) {
            printSymmetricSanityLine(baselineSanity!);
          } else {
            if (baselineBad) printRenderSanityBanner("baseline", baselineSanity!);
            if (variantBad) printRenderSanityBanner("variant", variantSanity!);
          }
        }

        if (domEnabled && vpIndex === 0 && !variantDomFingerprint) {
          try {
            variantDomFingerprint = await page.evaluate(DOM_FINGERPRINT_BROWSER_SCRIPT) as DomFingerprint;
          } catch (error) {
            console.log(`  ${YELLOW}Variant DOM fingerprint error (${variantName}): ${String(error)}${RESET}`);
          }
        }
        if (csdEnabled) {
          try {
            const raw = await page.evaluate(buildComputedStyleCaptureJsonExpression());
            const snapshot = parseComputedStyleSnapshot(raw) as ComputedStyleSnapshot;
            variantComputedStylesByVp.set(vp.label, snapshot);
            if (vpIndex === 0 && !variantComputedStyles) variantComputedStyles = snapshot;
          } catch (error) {
            console.log(`  ${YELLOW}Variant computed-style capture error (${variantName} / ${vp.label}): ${String(error)}${RESET}`);
          }
          try {
            const raw = await page.evaluate(buildAuthoredStyleCaptureJsonExpression());
            const snapshot = parseAuthoredStyleSnapshot(raw);
            variantAuthoredStylesByVp.set(vp.label, snapshot);
            if (vpIndex === 0 && !variantAuthoredStyles) variantAuthoredStyles = snapshot;
          } catch (error) {
            console.log(`  ${YELLOW}Variant authored-style capture error (${variantName} / ${vp.label}): ${String(error)}${RESET}`);
          }
        }
        if (dpEnabled) {
          try {
            const raw = await page.evaluate(DOM_POSITION_STYLES_BROWSER_SCRIPT);
            const captured = parseDomPositionStyles(raw);
            variantDomPositionByVp.set(vp.label, captured);
            if (vpIndex === 0) variantDomPositionStyles = captured;
          } catch (error) {
            console.log(`  ${YELLOW}Variant DOM-position capture error (${variantName} / ${vp.label}): ${String(error)}${RESET}`);
          }
        }
        if (variantBboxEnabled) {
          try {
            const rawBbox = await page.evaluate(DOM_BBOX_BROWSER_SCRIPT);
            variantBboxesByVp.set(vp.label, parseBboxes(rawBbox));
          } catch (error) {
            console.log(`  ${YELLOW}Variant bbox capture error (${variantName} / ${vp.label}): ${String(error)}${RESET}`);
          }
        }

        const variantScreenshotPath = join(outputDir, `${variantName}-${vp.label}.png`);
        await page.screenshot({ path: variantScreenshotPath, fullPage: true });
        await page.close();

        const snap: VrtSnapshot = {
          testId: `${variantName}-${vp.label}`,
          testTitle: `${variantName} ${vp.label}`,
          projectName: "migration",
          screenshotPath: variantScreenshotPath,
          baselinePath: baselineScreenshots.get(vp.label)!,
          status: "changed",
        };
        const diff = await compareScreenshots(snap, { outputDir });
        const rawDiffRatio = diff?.diffRatio ?? 0;
        const rawDiffPixels = diff?.diffPixels ?? 0;

        // Emit `baseline | variant | heatmap` triptych so an agent can
        // read all three panels in one file. No-op for zero-diff
        // viewports (no heatmap → composeTriptych returns undefined).
        if ((options.triptych ?? true) && rawDiffRatio > 0) {
          const triptychPath = join(outputDir, `${variantName}-${vp.label}-triptych.png`);
          const baselinePngPath = baselineScreenshots.get(vp.label)!;
          const heatmapPngPath = join(outputDir, `${variantName}-${vp.label}_heatmap.png`);
          try {
            const written = await composeTriptych(browser, {
              baselinePath: baselinePngPath,
              variantPath: variantScreenshotPath,
              heatmapPath: heatmapPngPath,
              outputPath: triptychPath,
            });
            if (written) triptychPaths.set(`${variantName}-${vp.label}`, written);
          } catch (error) {
            console.log(`  ${YELLOW}Triptych compose error (${variantName} / ${vp.label}): ${String(error)}${RESET}`);
          }
        }

        // Shift detection
        const diffReport = rawDiffRatio > 0
          ? await generateDiffReport(snap, { outputDir, detectShift: true, skipHeatmap: true })
          : null;
        const rawClassification = classifyMigrationDiff(diff);
        const approved = diff && approvalManifest
          ? filterApprovedVrtRegions(
            diff,
            approvalManifest,
            buildMigrationRegionApprovalContexts(diff),
            { strict, viewport: vp.label },
          )
          : null;
        const finalDiff = approved?.diff ?? diff;
        const diffRatio = finalDiff?.diffRatio ?? 0;
        const diffPixels = finalDiff?.diffPixels ?? 0;
        const totalPixels = finalDiff?.totalPixels ?? 0;
        const classification = classifyMigrationDiff(finalDiff);
        const colorSamples = extractMigrationColorSamples(finalDiff);
        const approvedPixels = rawDiffPixels - diffPixels;
        const approvalReasons = approved?.matchedRules.map((rule) => rule.reason) ?? [];
        const partiallyApproved = !approved?.approved && approvedPixels > 0;

        let rawPaintTreeChanges: PaintTreeChange[] = [];
        let filteredPaintTreeChanges: PaintTreeChange[] = [];
        let approvedPaintTreeCount = 0;
        let approvedPaintTreeReasons: string[] = [];
        if (paintTreeClient && baselinePaintTrees.has(vp.label)) {
          try {
            const variantPaintTree = await capturePaintTreeForViewport(
              paintTreeClient,
              { width: vp.width, height: vp.height },
              variantHtml,
            );
            rawPaintTreeChanges = diffPaintTrees(
              baselinePaintTrees.get(vp.label)!,
              variantPaintTree,
            );
            const approvedPaintTree = approvalManifest
              ? filterApprovedPaintTreeChanges(rawPaintTreeChanges, approvalManifest, {}, { strict })
              : null;
            filteredPaintTreeChanges = approvedPaintTree?.remainingChanges ?? rawPaintTreeChanges;
            approvedPaintTreeCount = approvedPaintTree?.approvedChanges.length ?? 0;
            approvedPaintTreeReasons = [...new Set(
              approvedPaintTree?.matches.map((match) => match.rule.reason) ?? [],
            )];
          } catch (error) {
            await disablePaintTree(`Failed to capture paint tree at ${vp.label}: ${String(error)}`);
          }
        }
        const rawPaintTreeSummary = summarizeMigrationPaintTreeChanges(rawPaintTreeChanges);
        const finalPaintTreeSummary = summarizeMigrationPaintTreeChanges(filteredPaintTreeChanges);
        const fixCandidates = diffRatio > 0
          ? buildMigrationViewportFixCandidatesFromHtml(variantHtml, {
            viewportWidth: vp.width,
            dominantCategory: classification.dominantCategory,
            categorySummary: classification.summary,
            paintTreeChanges: filteredPaintTreeChanges,
          })
          : [];

        results.push({
          variant: variantName,
          variantFile: variant.url || variant.file,
          viewport: vp.label,
          diffRatio,
          diffPixels,
          totalPixels,
          rawDiffRatio,
          rawDiffPixels,
          rawDominantCategory: rawClassification.dominantCategory,
          rawCategorySummary: rawClassification.summary,
          rawCategoryCounts: rawClassification.counts,
          approved: approved?.approved ?? false,
          partiallyApproved,
          approvedPixels,
          approvalReasons,
          dominantCategory: classification.dominantCategory,
          categorySummary: classification.summary,
          categoryCounts: classification.counts,
          rawPaintTreeChangeCount: rawPaintTreeSummary.totalChanges,
          rawPaintTreeSummary: rawPaintTreeSummary.summary,
          rawPaintTreeCounts: rawPaintTreeSummary.counts,
          paintTreeChangeCount: finalPaintTreeSummary.totalChanges,
          paintTreeSummary: finalPaintTreeSummary.summary,
          paintTreeCounts: finalPaintTreeSummary.counts,
          approvedPaintTreeCount,
          approvedPaintTreeReasons,
          fixCandidates,
          shiftRegions: diffReport?.shiftRegions && diffReport.shiftRegions.length > 0
            ? diffReport.shiftRegions
            : undefined,
          globalShift: diffReport?.globalShift && diffReport.globalShift !== 0
            ? diffReport.globalShift
            : undefined,
          colorSamples: colorSamples.length > 0 ? colorSamples : undefined,
        });
        if (diffReport?.shiftRegions && diffReport.shiftRegions.length > 0) {
          shiftRegionsByVp.set(vp.label, diffReport.shiftRegions);
        }

        if (regionDiffEnabled && diffRatio > 0) {
          regionDiffCandidates.push({
            viewport: vp.label,
            baselinePath: baselineScreenshots.get(vp.label)!,
            variantPath: variantScreenshotPath,
            elements: variantBboxesByVp.get(vp.label) ?? [],
            diffRatio,
            diffPixels,
            order: vpIndex,
          });
        }

        const pct = (diffRatio * 100).toFixed(1);
        const icon = approved?.approved
          ? `${CYAN}=${RESET}`
          : diffRatio === 0
            ? `${GREEN}✓${RESET}`
            : diffRatio < 0.01
              ? `${YELLOW}~${RESET}`
              : `${RED}✗${RESET}`;
        process.stdout.write(`    ${icon} ${vp.label.padEnd(12)} ${pct}%`);
        if (approved?.approved) {
          process.stdout.write(` ${DIM}(approved from ${(rawDiffRatio * 100).toFixed(1)}%, ${rawDiffPixels} px)${RESET}`);
        } else if (partiallyApproved) {
          process.stdout.write(` ${DIM}(approved ${approvedPixels} px, ${diffPixels} px remain)${RESET}`);
        } else if (diffRatio > 0) {
          process.stdout.write(` ${DIM}(${diffPixels} px)${RESET}`);
        }
        if (approved?.approved && rawClassification.summary !== "no changes") {
          process.stdout.write(` ${DIM}[${rawClassification.summary}]${RESET}`);
        } else if (diffRatio > 0 && classification.summary !== "no changes") {
          process.stdout.write(` ${DIM}[${classification.summary}]${RESET}`);
        }
        if (rawPaintTreeSummary.totalChanges > 0) {
          const paintTreeDisplay = approvedPaintTreeCount > 0 && finalPaintTreeSummary.totalChanges === 0
            ? `PT approved ${approvedPaintTreeCount}`
            : finalPaintTreeSummary.summary;
          process.stdout.write(` ${DIM}{${paintTreeDisplay}}${RESET}`);
        }
        if (fixCandidates.length > 0) {
          const topCandidate = fixCandidates[0];
          process.stdout.write(` ${DIM}<${topCandidate.selector} { ${topCandidate.property} }>${RESET}`);
        }
        if (diffReport && diffReport.globalShift !== 0) {
          const compPct = (diffReport.compensatedDiffCount / diffReport.totalPixels * 100).toFixed(1);
          process.stdout.write(` ${DIM}[shift ${diffReport.globalShift > 0 ? "+" : ""}${diffReport.globalShift}px → ${compPct}%]${RESET}`);
        }
        console.log();
      }

      if (regionDiffCandidates.length > 0) {
        const orderedRegionDiffCandidates = regionDiffMaxViewports === undefined
          ? regionDiffCandidates
          : [...regionDiffCandidates]
            .sort((left, right) => {
              if (right.diffRatio !== left.diffRatio) return right.diffRatio - left.diffRatio;
              if (right.diffPixels !== left.diffPixels) return right.diffPixels - left.diffPixels;
              return left.order - right.order;
            });
        const selectedRegionDiffCandidates = regionDiffMaxViewports === undefined
          ? orderedRegionDiffCandidates
          : orderedRegionDiffCandidates.slice(0, regionDiffMaxViewports);
        if (regionDiffMaxViewports !== undefined) {
          for (const candidate of orderedRegionDiffCandidates.slice(regionDiffMaxViewports)) {
            regionDiffSkippedViewports.push({
              viewport: candidate.viewport,
              diffRatio: candidate.diffRatio,
              diffPixels: candidate.diffPixels,
              reason: "region-diff-max-viewports",
            });
          }
        }
        for (const candidate of selectedRegionDiffCandidates) {
          try {
            const regionSummary = await writeMigrationRegionDiffArtifacts({
              baselinePath: candidate.baselinePath,
              variantPath: candidate.variantPath,
              elements: candidate.elements,
              outputDir,
              variantName,
              viewport: candidate.viewport,
              format: regionDiffFormat,
              model: regionDiffModel,
              maxTokens: regionDiffMaxTokens,
              analyzer: regionDiffAnalyzer,
            });
            regionDiffPerViewport.push(regionSummary);
          } catch (error) {
            const message = String(error);
            regionDiffPerViewport.push({
              viewport: candidate.viewport,
              changeCount: 0,
              changes: [],
              error: message,
            });
            console.log(`  ${YELLOW}Region diff handoff error (${variantName} / ${candidate.viewport}): ${message}${RESET}`);
          }
        }
      }

      if (regionDiffPerViewport.length > 0 || regionDiffSkippedViewports.length > 0) {
        regionDiffReports.push({
          variantFile: variant.url || variant.file,
          maxViewports: regionDiffMaxViewports,
          perViewport: regionDiffPerViewport,
          skippedViewports: regionDiffSkippedViewports.length > 0
            ? regionDiffSkippedViewports
            : undefined,
        });
        const okCount = regionDiffPerViewport.filter((entry) => !entry.error).length;
        const skippedText = regionDiffSkippedViewports.length > 0
          ? `, skipped ${regionDiffSkippedViewports.length} by cap`
          : "";
        console.log(`  ${DIM}Region diff handoff: ${okCount}/${regionDiffPerViewport.length} viewport artifact(s)${skippedText}${RESET}`);
      }

      // DOM-equivalence preflight comparison (variant-side completion)
      if (domEnabled && baselineDomFingerprint && variantDomFingerprint) {
        const variantFileLabel = variant.url || variant.file;
        const result = verifyDomEquivalence(baselineDomFingerprint, variantDomFingerprint);
        domEquivalenceReports.push({ variantFile: variantFileLabel, result });
        if (!result.ok) {
          console.log(`  ${YELLOW}DOM equivalence warnings for ${variantName}:${RESET}`);
          for (const w of result.warnings) {
            console.log(`    ${YELLOW}- [${w.code}] ${w.message}${RESET}`);
          }
          console.log();
        }
      }

      // DOM-position-aligned diff (opt-in via --dom-position-diff)
      if (dpEnabled && baselineDomPositionStyles && variantDomPositionStyles) {
        const variantFileLabel = variant.url || variant.file;
        const result = diffDomPositionStyles(baselineDomPositionStyles, variantDomPositionStyles);
        const trimmedResult = {
          ...result,
          entries: trimDomPositionEntriesByClassPair(result.entries, 200),
        };
        domPositionDiffReports.push({ variantFile: variantFileLabel, result: trimmedResult });
        if (result.totalDiffs > 0) {
          const topProps = result.byProperty.slice(0, 5)
            .map((p) => `${p.property}(${p.count})`)
            .join(", ");
          console.log(`  ${DIM}DOM-position diff: ${result.totalDiffs} tuples across ${result.byPath.length} paths. ` +
            `Top properties: ${topProps}${RESET}`);
        }
      }

      // Per-viewport DOM-position diff (surfaces media-query-gated deltas)
      if (dpEnabled && baselineDomPositionByVp.size > 0 && variantDomPositionByVp.size > 0) {
        const variantFileLabel = variant.url || variant.file;
        const perVp = diffPositionStylesAcrossViewports(baselineDomPositionByVp, variantDomPositionByVp);
        // Cap entries (used as a rolled-up backup) and byPathProperty
        // (the actual signal source for diff-for-agent) so
        // diff-report.json stays under ~1 MB even with many
        // viewports.
        const trimmedPerVp = {
          ...perVp,
          entries: trimDomPositionEntriesByClassPair(
            perVp.entries,
            200,
          ),
          byPathProperty: perVp.byPathProperty.slice(0, 200),
        };
        domPositionDiffPerViewportReports.push({ variantFile: variantFileLabel, result: trimmedPerVp });
        // Shift-origin diagnostics: which element causes each band's shift?
        if (baselineBboxesByVp.size > 0 && variantBboxesByVp.size > 0 && shiftRegionsByVp.size > 0) {
          const perViewport: Array<{ viewport: string; origins: ShiftOrigin[]; unexplainedBands?: ShiftRegion[] }> = [];
          const accumulationPerViewport: Array<{ viewport: string; breakdowns: ShiftAccumulationBreakdown[] }> = [];
          for (const [vpLabel, bands] of shiftRegionsByVp) {
            const baselineBboxes = baselineBboxesByVp.get(vpLabel);
            const variantBboxes = variantBboxesByVp.get(vpLabel);
            if (!baselineBboxes || !variantBboxes) continue;
            const origins = findShiftOrigins(baselineBboxes, variantBboxes, bands, { perBandLimit: 2 });
            const breakdowns = explainShiftAccumulations(baselineBboxes, variantBboxes, bands, {
              maxGroups: 6,
            });
            const explainedBandKeys = new Set(origins.map((o) => `${o.bandStart}-${o.bandEnd}-${o.bandShift}`));
            const unexplainedBands = bands.filter(
              (b) => !explainedBandKeys.has(`${b.yStart}-${b.yEnd}-${b.shift}`),
            );
            if (origins.length > 0 || unexplainedBands.length > 0) {
              perViewport.push({
                viewport: vpLabel,
                origins,
                unexplainedBands: unexplainedBands.length > 0 ? unexplainedBands : undefined,
              });
            }
            if (breakdowns.length > 0) {
              accumulationPerViewport.push({ viewport: vpLabel, breakdowns });
            }
          }
          if (perViewport.length > 0) {
            shiftOriginsReports.push({ variantFile: variantFileLabel, perViewport });
            const totalOrigins = perViewport.reduce((s, v) => s + v.origins.length, 0);
            console.log(`  ${DIM}Shift origins: ${totalOrigins} explanation(s) across ${perViewport.length} viewport(s)${RESET}`);
          }
          if (accumulationPerViewport.length > 0) {
            shiftAccumulationsReports.push({ variantFile: variantFileLabel, perViewport: accumulationPerViewport });
          }

          // Grid `fr`-ratio suggestions (one set per viewport, then merged
          // and capped). Subagent D's exact wish-list complaint: "I had
          // to compute the implied fr ratio by hand."
          const gridSuggestions: GridSuggestion[] = [];
          for (const [vpLabel, baselineBboxes] of baselineBboxesByVp) {
            const variantBboxes = variantBboxesByVp.get(vpLabel);
            if (!variantBboxes) continue;
            gridSuggestions.push(...findGridSuggestions(baselineBboxes, variantBboxes, vpLabel));
          }
          if (gridSuggestions.length > 0) {
            // Dedupe identical suggestions across viewports (same parent +
            // same widths => same suggestion). Keep the largest-gap row
            // per (parentPath, viewport) pair.
            const seen = new Set<string>();
            const deduped: GridSuggestion[] = [];
            for (const g of gridSuggestions) {
              const key = `${g.parentPath}::${g.viewport}`;
              if (seen.has(key)) continue;
              seen.add(key);
              deduped.push(g);
            }
            gridSuggestionsReports.push({
              variantFile: variantFileLabel,
              suggestions: deduped.slice(0, 30),
            });
            console.log(`  ${DIM}Grid suggestions: ${deduped.length} container(s) with non-uniform child widths${RESET}`);
          }
        }

        if (perVp.totalDiffs > 0) {
          const breakpointGated = perVp.byPathProperty.filter((pp) => pp.viewports.length < baselineDomPositionByVp.size).length;
          console.log(`  ${DIM}Per-viewport DOM-position diff: ${perVp.totalDiffs} tuples, ` +
            `${perVp.byPathProperty.length} unique (path, property) pairs, ` +
            `${breakpointGated} appear only on a subset of viewports (media-query-gated)${RESET}`);
        }
      }

      // Computed-style diff (opt-in via --computed-style)
      if (csdEnabled && baselineComputedStyles && variantComputedStyles) {
        const variantFileLabel = variant.url || variant.file;
        const result = diffComputedStyles(baselineComputedStyles, variantComputedStyles);
        // Trim entries to keep diff-report.json size sane while still
      // surfacing the top diffs to diff-for-agent.
      const trimmedResult = { ...result, entries: result.entries.slice(0, 100) };
      computedStyleDiffReports.push({ variantFile: variantFileLabel, result: trimmedResult });
        if (result.totalDiffs > 0) {
          const topProps = result.byProperty.slice(0, 5)
            .map((p) => `${p.property}(${p.count})`)
            .join(", ");
          console.log(`  ${DIM}Computed-style diff: ${result.totalDiffs} (selector, prop) ` +
            `tuples. Top properties: ${topProps}${RESET}`);
        }

        // Per-viewport CSD: diff each viewport pair, then aggregate to
        // surface universal vs. breakpoint-gated (selector, property)
        // pairs. Quiet when there are no per-viewport captures (e.g.
        // first-run hiccup) — the legacy single-snapshot diff above
        // still carries that case.
        if (baselineComputedStylesByVp.size > 0 && variantComputedStylesByVp.size > 0) {
          const perViewportDiffs: Array<{ viewport: string; result: CsdResult }> = [];
          for (const vp of VIEWPORTS) {
            const baselineSnap = baselineComputedStylesByVp.get(vp.label);
            const variantSnap = variantComputedStylesByVp.get(vp.label);
            if (!baselineSnap || !variantSnap) continue;
            perViewportDiffs.push({
              viewport: vp.label,
              result: diffComputedStyles(baselineSnap, variantSnap),
            });
          }
          if (perViewportDiffs.length > 0) {
            const perViewportResult = aggregateCsdByViewport(perViewportDiffs);
            // Cap bySelectorProperty to keep diff-report.json under
            // budget on fixtures with many tiny per-element diffs.
            const trimmedPerViewport: CsdPerViewportResult = {
              ...perViewportResult,
              bySelectorProperty: perViewportResult.bySelectorProperty.slice(0, 200),
            };
            computedStyleDiffPerViewportReports.push({
              variantFile: variantFileLabel,
              result: trimmedPerViewport,
            });
            if (perViewportResult.totalDiffs > 0) {
              console.log(`  ${DIM}Per-viewport CSD: ${perViewportResult.bySelectorProperty.length} unique pairs ` +
                `(${perViewportResult.universalPairs.length} universal, ` +
                `${perViewportResult.breakpointGatedPairs.length} breakpoint-gated)${RESET}`);
            }
          }
        }
      }

      // Authored-style diff. Same opt-in as computed-style: piggybacks on
      // --no-computed-style so callers don't need a second flag. The
      // captured CSSOM walks are cheap (already same-origin), and the
      // diff is only emitted when there is something to report.
      if (csdEnabled && baselineAuthoredStyles && variantAuthoredStyles) {
        const variantFileLabel = variant.url || variant.file;
        const result = diffAuthoredStyles(baselineAuthoredStyles, variantAuthoredStyles);
        const trimmedResult = { ...result, entries: result.entries.slice(0, 100) };
        authoredStyleDiffReports.push({ variantFile: variantFileLabel, result: trimmedResult });
        if (result.totalDiffs > 0) {
          const topProps = result.byProperty.slice(0, 5)
            .map((p) => `${p.property}(${p.count})`)
            .join(", ");
          console.log(`  ${DIM}Authored-style diff: ${result.totalDiffs} (selector, prop) ` +
            `tuples. Top properties: ${topProps}${RESET}`);
        }

        if (baselineAuthoredStylesByVp.size > 0 && variantAuthoredStylesByVp.size > 0) {
          const perViewportDiffs: Array<{ viewport: string; result: AuthoredStyleDiffResult }> = [];
          for (const vp of VIEWPORTS) {
            const baselineSnap = baselineAuthoredStylesByVp.get(vp.label);
            const variantSnap = variantAuthoredStylesByVp.get(vp.label);
            if (!baselineSnap || !variantSnap) continue;
            perViewportDiffs.push({
              viewport: vp.label,
              result: diffAuthoredStyles(baselineSnap, variantSnap),
            });
          }
          if (perViewportDiffs.length > 0) {
            const perViewportResult = aggregateAuthoredStyleByViewport(perViewportDiffs);
            const trimmedPerViewport: AuthoredStylePerViewportResult = {
              ...perViewportResult,
              bySelectorProperty: perViewportResult.bySelectorProperty.slice(0, 200),
            };
            authoredStyleDiffPerViewportReports.push({
              variantFile: variantFileLabel,
              result: trimmedPerViewport,
            });
            if (perViewportResult.totalDiffs > 0) {
              console.log(`  ${DIM}Per-viewport authored-style: ${perViewportResult.bySelectorProperty.length} unique pairs ` +
                `(${perViewportResult.universalPairs.length} universal, ` +
                `${perViewportResult.breakpointGatedPairs.length} breakpoint-gated)${RESET}`);
            }
          }
        }
      }

      // Image-only component bbox diff. Doesn't depend on DOM
      // correspondence — works on the rendered PNGs directly. Wireframe
      // / from-screenshot scenario (see Subagent F): when the agent's
      // DOM differs from the reference, the bbox of "the card" /
      // "the button row" remains comparable across pages.
      if (options.componentBboxDiff !== false) {
        const variantFileLabel = variant.url || variant.file;
        const perViewport: Array<{ viewport: string; matches: MatchedBbox[] }> = [];
        // Full (unfiltered) per-viewport matches used to build
        // cross-viewport geometry profiles below. We can't use the
        // filtered `perViewport` list because geometry analysis cares
        // about the shared baseline+variant geometry of *every* matched
        // component (including ones with zero delta on a given viewport
        // but differing on another).
        const perViewportFull: Array<{ viewport: string; matches: MatchedBbox[] }> = [];
        const perViewportHeatmap: Array<{ viewport: string; regions: HeatmapRegion[] }> = [];
        const perViewportTextRows: Array<{
          viewport: string; matches: MatchedTextRow[]; baselineRowCount: number; variantRowCount: number;
        }> = [];
        const perViewportPalette: Array<{
          viewport: string; baseline: PaletteColor[]; variant: PaletteColor[]; diff: PaletteDiff;
        }> = [];
        for (const vp of VIEWPORTS) {
          const baselinePngPath = join(outputDir, `${baselineName}-${vp.label}.png`);
          const variantPngPath = join(outputDir, `${variantName}-${vp.label}.png`);
          try {
            const [baselineComps, variantComps] = await Promise.all([
              extractComponentsFromFile(baselinePngPath),
              extractComponentsFromFile(variantPngPath),
            ]);
            const matches = matchComponents(baselineComps, variantComps);
            perViewportFull.push({ viewport: vp.label, matches });
            // Only keep matches where at least one axis differs by > 1px
            // (anything smaller is subpixel rounding, not actionable).
            const meaningful = matches.filter((m) =>
              Math.abs(m.deltaTop) > 1 || Math.abs(m.deltaLeft) > 1
              || Math.abs(m.deltaWidth) > 1 || Math.abs(m.deltaHeight) > 1,
            );
            if (meaningful.length > 0) {
              perViewport.push({ viewport: vp.label, matches: meaningful.slice(0, 5) });
            }
          } catch {
            // PNG missing / decode failure — skip silently.
          }

          // Heatmap region clustering (CC labelling on pixelmatch
          // hot-red pixels). Falls through silently when the heatmap
          // PNG doesn't exist (zero-diff viewport or skipHeatmap=true).
          const heatmapPath = join(outputDir, `${variantName}-${vp.label}_heatmap.png`);
          try {
            const regions = await findHeatmapRegionsFromFile(heatmapPath);
            if (regions.length > 0) {
              perViewportHeatmap.push({ viewport: vp.label, regions });
            }
          } catch {
            // No heatmap (viewport had zero diff) or decode failure — skip.
          }

          // Text-row y-position extraction. Pairs dark luminance bands
          // by ordered index between baseline and variant — works
          // without DOM correspondence, useful when component bbox
          // matching fails (the wireframe-with-divergent-DOM case).
          try {
            const [baselineRows, variantRows] = await Promise.all([
              extractTextRowsFromFile(baselinePngPath),
              extractTextRowsFromFile(variantPngPath),
            ]);
            const matches = matchTextRows(baselineRows, variantRows);
            const countMismatch = baselineRows.length !== variantRows.length
              && (baselineRows.length > 0 || variantRows.length > 0);
            if (matches.length > 0 || countMismatch) {
              perViewportTextRows.push({
                viewport: vp.label,
                matches: matches.slice(0, 12),
                baselineRowCount: baselineRows.length,
                variantRowCount: variantRows.length,
              });
            }
          } catch {
            // PNG missing or decode failure — skip silently.
          }

          // Palette extraction + diff. Surfaces hard-coded color
          // literals slipping past tokenized design systems. Only
          // record when the diff has actionable rows (something
          // only-in-baseline or only-in-variant).
          try {
            const [baselinePalette, variantPalette] = await Promise.all([
              extractPaletteFromFile(baselinePngPath),
              extractPaletteFromFile(variantPngPath),
            ]);
            const paletteDiff = diffPalettes(baselinePalette, variantPalette);
            if (paletteDiff.onlyInBaseline.length > 0 || paletteDiff.onlyInVariant.length > 0) {
              perViewportPalette.push({
                viewport: vp.label,
                baseline: baselinePalette,
                variant: variantPalette,
                diff: paletteDiff,
              });
            }
          } catch {
            // PNG missing or decode failure — skip silently.
          }
        }
        if (perViewport.length > 0) {
          componentBboxReports.push({ variantFile: variantFileLabel, perViewport });
          const total = perViewport.reduce((s, v) => s + v.matches.length, 0);
          console.log(`  ${DIM}Component bbox diff: ${total} component delta(s) across ${perViewport.length} viewport(s)${RESET}`);
        }
        // Cross-viewport geometry profiles (wireframe-mode: detect
        // responsive mismatches like "baseline card shrinks 18px on
        // mobile but variant doesn't"). Requires at least two viewports
        // to have anything meaningful to say.
        if (perViewportFull.length >= 2) {
          const profiles = buildGeometryProfiles(perViewportFull);
          const flagged = profiles.filter((p) => p.responsiveMismatch !== undefined);
          if (flagged.length > 0) {
            componentGeometryReports.push({
              variantFile: variantFileLabel,
              profiles: flagged.slice(0, 8),
            });
            console.log(`  ${DIM}Responsive geometry mismatch: ${flagged.length} component(s) flagged${RESET}`);
          }
        }
        if (perViewportHeatmap.length > 0) {
          heatmapRegionsReports.push({ variantFile: variantFileLabel, perViewport: perViewportHeatmap });
          const total = perViewportHeatmap.reduce((s, v) => s + v.regions.length, 0);
          console.log(`  ${DIM}Heatmap regions: ${total} cluster(s) across ${perViewportHeatmap.length} viewport(s)${RESET}`);
        }
        if (perViewportTextRows.length > 0) {
          textRowShiftsReports.push({ variantFile: variantFileLabel, perViewport: perViewportTextRows });
          const total = perViewportTextRows.reduce((s, v) => s + v.matches.length, 0);
          console.log(`  ${DIM}Text-row shifts: ${total} row(s) with Δy across ${perViewportTextRows.length} viewport(s)${RESET}`);
        }
        if (perViewportPalette.length > 0) {
          paletteDiffsReports.push({ variantFile: variantFileLabel, perViewport: perViewportPalette });
          const totalMissing = perViewportPalette.reduce((s, v) => s + v.diff.onlyInBaseline.length, 0);
          const totalExtra = perViewportPalette.reduce((s, v) => s + v.diff.onlyInVariant.length, 0);
          console.log(`  ${DIM}Palette diff: ${totalMissing} missing color(s), ${totalExtra} extra color(s) across ${perViewportPalette.length} viewport(s)${RESET}`);

          // Reverse-resolve each unmatched hex against the DESIGN.md
          // color tokens so the agent sees "swap surface-variant →
          // surface-container-high" instead of two bare hex strings.
          if (designTokens && designTokens.colors.size > 0) {
            const swapsByVp = new Map<string, Array<{ from?: string; to?: string; baselineHex: string; variantHex: string; deltaE: number }>>();
            for (const vp of perViewportPalette) {
              // Pair each missing baseline color with the closest
              // remaining variant extra (same Euclidean RGB threshold
              // as `diffPalettes`'s pairing pass would use). We just
              // want a candidate rename surface here.
              const extras = [...vp.diff.onlyInVariant];
              const pairs: Array<{ from?: string; to?: string; baselineHex: string; variantHex: string; deltaE: number }> = [];
              for (const miss of vp.diff.onlyInBaseline) {
                let bestIdx = -1;
                let bestDist = Infinity;
                for (let i = 0; i < extras.length; i++) {
                  const dr = miss.r - extras[i].r, dg = miss.g - extras[i].g, db = miss.b - extras[i].b;
                  const d = Math.sqrt(dr * dr + dg * dg + db * db);
                  if (d < bestDist) { bestDist = d; bestIdx = i; }
                }
                if (bestIdx < 0) continue;
                const extra = extras.splice(bestIdx, 1)[0];
                const fromTok = snapColor(designTokens, miss.hex);
                const toTok = snapColor(designTokens, extra.hex);
                if (!fromTok && !toTok) continue;
                pairs.push({
                  from: fromTok?.name,
                  to: toTok?.name,
                  baselineHex: miss.hex,
                  variantHex: extra.hex,
                  deltaE: bestDist,
                });
              }
              if (pairs.length > 0) swapsByVp.set(vp.viewport, pairs);
            }
            for (const [vp, pairs] of swapsByVp) {
              for (const p of pairs.slice(0, 4)) {
                // Aligned with the candidate-row convention
                // (current → target): the variant's token is what
                // the agent currently uses; the baseline's token is
                // the target they should switch to. Agent-f v6:
                // before this alignment the swap line read in the
                // opposite direction from candidate rows, which
                // was inconsistent.
                const nowTok = p.to ?? `${p.variantHex}`;
                const targetTok = p.from ?? `${p.baselineHex}`;
                if (p.from && p.to && p.from !== p.to) {
                  console.log(`    ${CYAN}swap${RESET} ${nowTok} (now) → ${targetTok} (target) ${DIM}(${p.variantHex} → ${p.baselineHex}, ${vp})${RESET}`);
                } else if (p.from || p.to) {
                  console.log(`    ${DIM}near${RESET} ${nowTok} (now) ↔ ${targetTok} (target) ${DIM}(${p.variantHex} ↔ ${p.baselineHex}, ${vp})${RESET}`);
                }
              }
            }

            // Also surface lone unmatched colors with their nearest
            // token, even when no pair was formed. Helps when a variant
            // has an extra color the baseline never uses (e.g. an
            // accidental fallback fill) — the agent gets "extra
            // #f59e0b ≈ primary-container".
            const paired = new Set<string>();
            for (const pairs of swapsByVp.values()) {
              for (const p of pairs) {
                paired.add(`miss:${p.baselineHex}`);
                paired.add(`extra:${p.variantHex}`);
              }
            }
            for (const vp of perViewportPalette) {
              for (const miss of vp.diff.onlyInBaseline) {
                if (paired.has(`miss:${miss.hex}`)) continue;
                const tok = snapColor(designTokens, miss.hex);
                if (tok) {
                  console.log(`    ${DIM}miss${RESET} ${miss.hex} ≈ ${tok.name} ${DIM}(ΔE ${tok.deltaE.toFixed(1)}, ${vp.viewport})${RESET}`);
                }
              }
              for (const extra of vp.diff.onlyInVariant) {
                if (paired.has(`extra:${extra.hex}`)) continue;
                const tok = snapColor(designTokens, extra.hex);
                if (tok) {
                  console.log(`    ${DIM}extra${RESET} ${extra.hex} ≈ ${tok.name} ${DIM}(ΔE ${tok.deltaE.toFixed(1)}, ${vp.viewport})${RESET}`);
                }
              }
            }
          }
        }

        // Wireframe-mode fix candidates: synthesize "try N px (token X)"
        // suggestions from image-only signals (bbox + text-row deltas)
        // when DOM correspondence is missing. The existing CSS-declaration
        // candidate generator returns empty in this mode (it expected an
        // inline <style id="target-css"> block and a hot paint-tree).
        // Pull this variant's DOM-position-diff entries (when the
        // capture succeeded) so the wireframe generator can name a
        // candidate selector for each suggestion. Falls through
        // silently when DOM correspondence is missing — the
        // generator handles undefined.
        const dpForVariant = domPositionDiffPerViewportReports
          .find((r) => r.variantFile === variantFileLabel)
          ?.result.entries;

        const wireframeSuggestions: WireframeFixSuggestion[] = generateWireframeFixCandidates({
          bboxByViewport: perViewport,
          textRowsByViewport: perViewportTextRows.map((r) => ({
            viewport: r.viewport,
            matches: r.matches,
            // Pass total dark-band counts so the [REFLOW] detector
            // can spot text-wrap on the narrow viewport.
            baselineRowCount: r.baselineRowCount,
            variantRowCount: r.variantRowCount,
          })),
          tokens: designTokens,
          // Authoritative viewport set so subset detection works even
          // when a viewport had zero meaningful bbox/text-row deltas
          // (e.g. desktop/wide at <0.5% diff produce no perViewport
          // entries; mobile-only deltas would otherwise look "scope:
          // all" rather than "subset"). Closes the agent-d round-3
          // bug where [SUBSET] tags silently disappeared as desktop
          // converged.
          allViewports: VIEWPORTS.map((vp) => vp.label),
          domPositionEntries: dpForVariant,
        });
        if (wireframeSuggestions.length > 0) {
          wireframeFixReports.push({ variantFile: variantFileLabel, suggestions: wireframeSuggestions });
          // Sort: isHighImpact first (agent-e v5: the single
          // biggest-win row was getting buried under DIVERGENT
          // rows of smaller magnitudes). Then scope priority,
          // then magnitude.
          const sorted = [...wireframeSuggestions].sort((a, b) => {
            // STRUCTURAL leads everything — it diagnoses the
            // local-minima trap before agents start typing.
            // REFLOW also leads — it warns against spacing-fix
            // attempts on a typographic-cascade problem.
            const aLead = a.scope === "structural" || a.scope === "reflow";
            const bLead = b.scope === "structural" || b.scope === "reflow";
            if (aLead !== bLead) return aLead ? -1 : 1;
            if (!!b.isHighImpact !== !!a.isHighImpact) return (b.isHighImpact ? 1 : 0) - (a.isHighImpact ? 1 : 0);
            const scopeRank = (s: typeof a.scope) =>
              s === "structural" ? -2
              : s === "reflow" ? -1
              : s === "divergent" ? 0
              : s === "magnitude-divergent" ? 1
              : s === "subset" ? 2
              : 3;
            if (scopeRank(a.scope) !== scopeRank(b.scope)) return scopeRank(a.scope) - scopeRank(b.scope);
            return 0;
          });
          const top = sorted.slice(0, 5);
          console.log(`  ${CYAN}Wireframe fix suggestions (${wireframeSuggestions.length}, top ${top.length}):${RESET}`);
          for (const s of top) {
            const conf = s.confidence === "high" ? GREEN : s.confidence === "medium" ? YELLOW : DIM;
            // Divergent suggestions get a magenta "DIVERGENT" prefix so
            // they can't be missed; subset gets a subtle "SUBSET" tag.
            const scopeTag = s.scope === "structural"
              ? ` ${BOLD}\x1b[35m[STRUCTURAL]${RESET}`
              : s.scope === "reflow"
                ? ` ${BOLD}\x1b[33m[REFLOW]${RESET}`
                : s.scope === "divergent"
                  ? ` ${BOLD}${RED}[DIVERGENT]${RESET}`
                  : s.scope === "magnitude-divergent"
                    ? ` ${BOLD}${CYAN}[MAG-DIVERGENT]${RESET}`
                    : s.scope === "subset"
                      ? ` ${YELLOW}[SUBSET]${RESET}`
                      : "";
            const impactTag = s.isHighImpact
              ? ` ${BOLD}${GREEN}[HIGH-IMPACT]${RESET}`
              : "";
            console.log(`    ${conf}[${s.confidence}]${RESET}${impactTag}${scopeTag} ${s.evidence}`);
            console.log(`      ${DIM}→ ${s.suggestion}${RESET}`);
            if (s.candidates && s.candidates.length > 0) {
              // Group candidates by selector so the agent sees the rule
              // first and the per-property diff under it.
              const bySel = new Map<string, typeof s.candidates>();
              for (const c of s.candidates) {
                const arr = bySel.get(c.selector) ?? [];
                arr.push(c);
                bySel.set(c.selector, arr);
              }
              for (const [sel, rows] of bySel) {
                // Arrow direction is "current → target" — the agent
                // edits FROM what they have TO what the baseline has.
                // Backwards rendering misled agent-e (v5).
                const anyCascades = rows.some((r) => r.cascades);
                const propList = [...new Set(rows.map((r) => `${r.property}: ${r.current} (now) → ${r.target} (target)`))].join("; ");
                // F2: cascade hint — when the property is a box-size
                // property (height / margin-bottom / etc.), changing
                // it pushes downstream siblings. Without this hint
                // agent-f thought the candidate was a "non-sequitur"
                // — connected to a different rank's suggestion.
                const cascadeHint = anyCascades ? ` ${YELLOW}[cascades to siblings]${RESET}` : "";
                console.log(`      ${CYAN}candidate:${RESET} ${BOLD}${sel}${RESET} ${DIM}(${propList})${RESET}${cascadeHint}`);
              }
            }
          }
        }
      }

      if (triptychPaths.size > 0) {
        console.log(`  ${DIM}Triptych: ${triptychPaths.size} viewport(s) → ${outputDir}/${variantName}-<viewport>-triptych.png (baseline | variant | heatmap)${RESET}`);
      }

      // Multi-state capture (opt-in via --states hover focus ...).
      // For each requested pseudo-class, re-render baseline + variant
      // with that state forced on all interactive elements, then diff.
      // Surfaces "agent forgot to wire up :hover styles" — a class of
      // bug the default-state VRT can't catch because both sides look
      // identical without an interaction.
      if (options.states && options.states.length > 0) {
        const variantFileLabel = variant.url || variant.file;
        const perState: Array<{
          state: ForcedPseudoState;
          forcedCount: number;
          affectedElements: string[];
          perViewport: Array<{ viewport: string; defaultDiffRatio: number; stateDiffRatio: number; hoverInducedDelta: number }>;
        }> = [];

        for (const state of options.states) {
          const perViewport: Array<{ viewport: string; defaultDiffRatio: number; stateDiffRatio: number; hoverInducedDelta: number }> = [];
          let aggregateForcedCount = 0;
          let aggregateAffected: string[] = [];

          for (const vp of VIEWPORTS) {
            // Baseline page in forced state.
            const baselinePage = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
            if (isUrlMode) {
              await baselinePage.goto(options.baselineUrl!, { waitUntil: "networkidle", timeout: 30000 });
            } else if (baselineFileUrl) {
              await baselinePage.goto(baselineFileUrl, { waitUntil: "networkidle", timeout: 30000 });
            } else {
              await baselinePage.setContent(baselineHtml, { waitUntil: "networkidle" });
            }
            if (options.maskSelectors?.length) await applyMask(baselinePage, options.maskSelectors);
            let baselineApplied: AppliedForcedState;
            try {
              baselineApplied = await applyForcedPseudoState(baselinePage, { state });
            } catch (error) {
              console.log(`  ${YELLOW}State capture failed (baseline / ${state} / ${vp.label}): ${String(error)}${RESET}`);
              await baselinePage.close();
              continue;
            }
            const baselineStatePath = join(outputDir, `${baselineName}-${vp.label}-${state}.png`);
            await baselinePage.screenshot({ path: baselineStatePath, fullPage: true });
            await clearStateMarkers(baselinePage).catch(() => {});
            await baselinePage.close();

            // Variant page in forced state.
            const variantPage = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
            if (variant.url) {
              await variantPage.goto(variant.url, { waitUntil: "networkidle", timeout: 30000 });
            } else if (variant.fileUrl) {
              await variantPage.goto(variant.fileUrl, { waitUntil: "networkidle", timeout: 30000 });
            } else {
              await variantPage.setContent(variantHtml, { waitUntil: "networkidle" });
            }
            if (options.maskSelectors?.length) await applyMask(variantPage, options.maskSelectors);
            let variantApplied: AppliedForcedState;
            try {
              variantApplied = await applyForcedPseudoState(variantPage, { state });
            } catch (error) {
              console.log(`  ${YELLOW}State capture failed (variant / ${state} / ${vp.label}): ${String(error)}${RESET}`);
              await variantPage.close();
              continue;
            }
            const variantStatePath = join(outputDir, `${variantName}-${vp.label}-${state}.png`);
            await variantPage.screenshot({ path: variantStatePath, fullPage: true });
            await clearStateMarkers(variantPage).catch(() => {});
            await variantPage.close();

            aggregateForcedCount = Math.max(aggregateForcedCount, baselineApplied.forcedCount);
            if (aggregateAffected.length === 0) aggregateAffected = baselineApplied.affectedElements;

            // Diff the forced-state pair.
            const stateSnap: VrtSnapshot = {
              testId: `${variantName}-${vp.label}-${state}`,
              testTitle: `${variantName} ${vp.label} :${state}`,
              projectName: "migration-state",
              screenshotPath: variantStatePath,
              baselinePath: baselineStatePath,
              status: "changed",
            };
            // Use a stricter threshold than the default (0.1). Hover/
            // focus color changes are subtle (Δ ~10-30 per channel on
            // the dark/light-blue dimming pair); the 0.1 luminance
            // threshold filters them out entirely. 0.03 picks up real
            // pseudo-state effects while still rejecting subpixel AA.
            const stateDiff = await compareScreenshots(stateSnap, { outputDir, skipHeatmap: true, threshold: 0.03 } as Parameters<typeof compareScreenshots>[1]);
            const stateRatio = stateDiff?.diffRatio ?? 0;
            // Pull the default-state ratio out of the results array.
            const defaultResult = results.find((r) => r.variant === variantName && r.viewport === vp.label);
            const defaultRatio = defaultResult?.diffRatio ?? 0;
            perViewport.push({
              viewport: vp.label,
              defaultDiffRatio: defaultRatio,
              stateDiffRatio: stateRatio,
              hoverInducedDelta: stateRatio - defaultRatio,
            });
          }

          if (perViewport.length > 0) {
            perState.push({
              state,
              forcedCount: aggregateForcedCount,
              affectedElements: aggregateAffected,
              perViewport,
            });
            const inducedMax = Math.max(...perViewport.map((p) => p.hoverInducedDelta));
            const inducedDisplay = (inducedMax * 100).toFixed(2);
            console.log(`  ${DIM}:${state} state diff: max ${inducedDisplay}% induced delta across ${perViewport.length} viewport(s) (${aggregateForcedCount} forced element(s))${RESET}`);
          }
        }

        if (perState.length > 0) {
          stateDiffsReports.push({ variantFile: variantFileLabel, perState });
        }
      }

      console.log();
    }

    // Summary table
    hr();
    console.log();
    console.log(`  ${BOLD}Summary${RESET}`);
    console.log();

    // Matrix: variant × viewport
    const vpLabels = VIEWPORTS.map((v) => v.label);
    const columnWidth = 13;
    const header = "  " + "Variant".padEnd(20) + vpLabels.map((l) => l.padStart(columnWidth)).join("");
    console.log(header);

    const variantNames = [...new Set(results.map((r) => r.variant))];
    for (const v of variantNames) {
      let line = "  " + v.padEnd(20);
      let allZero = true;
      for (const vp of vpLabels) {
        const r = results.find((r) => r.variant === v && r.viewport === vp);
        const pct = r ? (r.diffRatio * 100).toFixed(1) + "%" : "n/a";
        const color = !r ? DIM : r.approved ? CYAN : r.diffRatio === 0 ? GREEN : r.diffRatio < 0.01 ? YELLOW : RED;
        line += `${color}${pct.padStart(columnWidth)}${RESET}`;
        if (r && r.diffRatio > 0) allZero = false;
      }
      if (allZero) line += `  ${GREEN}PASS${RESET}`;
      console.log(line);
    }
    console.log();

    console.log(`  ${BOLD}Diff Categories${RESET}`);
    for (const variant of variantNames) {
      const variantResults = results.filter((result) => result.variant === variant);
      const aggregatedCounts = aggregateMigrationCategoryCounts(variantResults);
      const categorySummary = formatMigrationCategorySummary(aggregatedCounts);
      console.log(`    ${variant.padEnd(18)} ${categorySummary}`);
    }
    console.log();

    if (enablePaintTree) {
      console.log(`  ${BOLD}Paint Tree${RESET}`);
      if (!paintTreeStatus.available) {
        console.log(`    ${DIM}${paintTreeStatus.error ?? "unavailable"}${RESET}`);
      } else {
        for (const variant of variantNames) {
          const variantResults = results.filter((result) => result.variant === variant);
          const aggregatedCounts = aggregatePaintTreeCounts(variantResults);
          const paintTreeSummary = formatPaintTreeCountSummary(aggregatedCounts);
          console.log(`    ${variant.padEnd(18)} ${paintTreeSummary}`);
        }
      }
      console.log();
    }

    console.log(`  ${BOLD}Fix Candidates${RESET}`);
    for (const variant of variantNames) {
      const variantResults = results.filter((result) => result.variant === variant);
      const candidates = summarizeMigrationFixCandidates(variantResults.map((result) => result.fixCandidates));
      if (candidates.length === 0) {
        console.log(`    ${variant.padEnd(18)} no suggestions`);
        continue;
      }
      console.log(`    ${variant.padEnd(18)} ${formatMigrationFixCandidateSummary(candidates)}`);
    }
    console.log();

    // Save the canonical JSON report.
    const reportPath = join(outputDir, "diff-report.json");
    const report: MigrationCompareReport = {
      dir,
      baseline,
      variants,
      viewports: VIEWPORTS,
      breakpointDiscovery: breakpointDiscoveryStatus,
      approvalPath: resolvedApprovalPath || undefined,
      strict,
      approvalWarnings,
      paintTree: paintTreeStatus,
      baselineSanity,
      domEquivalence: domEquivalenceReports.length > 0 ? domEquivalenceReports : undefined,
      computedStyleDiff: computedStyleDiffReports.length > 0 ? computedStyleDiffReports : undefined,
      computedStyleDiffPerViewport: computedStyleDiffPerViewportReports.length > 0 ? computedStyleDiffPerViewportReports : undefined,
      authoredStyleDiff: authoredStyleDiffReports.length > 0 ? authoredStyleDiffReports : undefined,
      authoredStyleDiffPerViewport: authoredStyleDiffPerViewportReports.length > 0 ? authoredStyleDiffPerViewportReports : undefined,
      domPositionDiff: domPositionDiffReports.length > 0 ? domPositionDiffReports : undefined,
      domPositionDiffPerViewport: domPositionDiffPerViewportReports.length > 0
        ? domPositionDiffPerViewportReports
        : undefined,
      shiftOrigins: shiftOriginsReports.length > 0 ? shiftOriginsReports : undefined,
      shiftAccumulations: shiftAccumulationsReports.length > 0 ? shiftAccumulationsReports : undefined,
      gridSuggestions: gridSuggestionsReports.length > 0 ? gridSuggestionsReports : undefined,
      componentBboxDiffs: componentBboxReports.length > 0 ? componentBboxReports : undefined,
      componentGeometryProfiles: componentGeometryReports.length > 0 ? componentGeometryReports : undefined,
      heatmapRegions: heatmapRegionsReports.length > 0 ? heatmapRegionsReports : undefined,
      textRowShifts: textRowShiftsReports.length > 0 ? textRowShiftsReports : undefined,
      paletteDiffs: paletteDiffsReports.length > 0 ? paletteDiffsReports : undefined,
      stateDiffs: stateDiffsReports.length > 0 ? stateDiffsReports : undefined,
      regionDiffs: regionDiffReports.length > 0 ? regionDiffReports : undefined,
      wireframeFixSuggestions: wireframeFixReports.length > 0 ? wireframeFixReports : undefined,
      results,
      reportPath,
    };
    const convergence = summarizeMigrationReportConvergence(report);
    const reportJson = JSON.stringify(report, null, 2);
    await writeFile(reportPath, reportJson);
    console.log(`  ${BOLD}Convergence${RESET}`);
    for (const variant of convergence.variants) {
      console.log(`    ${variant.variant.padEnd(18)} ${formatMigrationConvergenceSummary(variant.status, variant)}`);
    }
    console.log();
    console.log(`  ${DIM}Report: ${reportPath}${RESET}`);
    console.log();

    // --against-previous <dir-or-json>: surface a "since previous
    // run" section so an agent on a tight budget can tell whether
    // the last edit moved forward, regressed, or overshot zero
    // (G1 from the agent-e v5 validation). Reuses watch.ts's
    // diffWatchRuns + zero-crossing detector.
    if (options.againstPreviousPath) {
      try {
        const { diffWatchRuns, formatWatchDelta, summarizeReport } = await import("../../watch.ts");
        // Accept a direct .json path or resolve the canonical report in a run directory.
        let prevPath = options.againstPreviousPath;
        if (!prevPath.endsWith(".json")) {
          prevPath = join(options.againstPreviousPath, "diff-report.json");
        }
        const prevRaw = await readFile(prevPath, "utf-8");
        const prevReport = JSON.parse(prevRaw) as MigrationCompareReport;
        const prev = summarizeReport(prevReport);
        const curr = summarizeReport(report);
        const delta = diffWatchRuns(prev, curr);
        console.log(formatWatchDelta(delta, false));
        console.log();
      } catch (err) {
        console.log(`  ${YELLOW}--against-previous failed: ${String(err)}${RESET}`);
        console.log();
      }
    }

    if (options.strictDomEquivalence) {
      const failing = domEquivalenceReports.filter((d) => !d.result.ok);
      if (failing.length > 0) {
        const total = failing.reduce((s, d) => s + d.result.warnings.length, 0);
        throw new Error(
          `DOM equivalence check failed (${total} warning(s) across ${failing.length} variant(s)). ` +
          `See report at ${reportPath}.`,
        );
      }
    }

    if (options.strictBaselineSanity && baselineSanity && !baselineSanity.ok) {
      throw new Error(
        `Baseline render sanity check failed (${baselineSanity.warnings.length} warning(s)). ` +
        `See report at ${reportPath}.`,
      );
    }

    return report;
  } finally {
    await browser?.close();
    await paintTreeClient?.close();
  }
}

function aggregateMigrationCategoryCounts(
  results: Array<{ categoryCounts: Record<MigrationDiffCategory, number> }>,
): Record<MigrationDiffCategory, number> {
  const counts = createMigrationCategoryCounts();
  for (const result of results) {
    counts["layout-shift"] += result.categoryCounts["layout-shift"];
    counts["color-change"] += result.categoryCounts["color-change"];
    counts.spacing += result.categoryCounts.spacing;
    counts.typography += result.categoryCounts.typography;
    counts.other += result.categoryCounts.other;
  }
  return counts;
}

function createMigrationCategoryCounts(): Record<MigrationDiffCategory, number> {
  return {
    "layout-shift": 0,
    "color-change": 0,
    spacing: 0,
    typography: 0,
    other: 0,
  };
}

function formatMigrationCategorySummary(
  counts: Record<MigrationDiffCategory, number>,
): string {
  const entries = (Object.entries(counts) as Array<[MigrationDiffCategory, number]>)
    .filter((entry) => entry[1] > 0)
    .map(([category, count]) => `${count} ${category}`);
  return entries.join(", ") || "no changes";
}

function aggregatePaintTreeCounts(
  results: Array<{ paintTreeCounts: Record<PaintTreeChangeType, number> }>,
): Record<PaintTreeChangeType, number> {
  const counts = createPaintTreeCounts();
  for (const result of results) {
    counts.geometry += result.paintTreeCounts.geometry;
    counts.paint += result.paintTreeCounts.paint;
    counts.text += result.paintTreeCounts.text;
    counts.added += result.paintTreeCounts.added;
    counts.removed += result.paintTreeCounts.removed;
  }
  return counts;
}

function createPaintTreeCounts(): Record<PaintTreeChangeType, number> {
  return {
    geometry: 0,
    paint: 0,
    text: 0,
    added: 0,
    removed: 0,
  };
}

function formatPaintTreeCountSummary(
  counts: Record<PaintTreeChangeType, number>,
): string {
  const entries = (Object.entries(counts) as Array<[PaintTreeChangeType, number]>)
    .filter((entry) => entry[1] > 0)
    .map(([type, count]) => `${count} ${type}`);
  return entries.join(", ") || "no changes";
}

function formatMigrationFixCandidateSummary(
  candidates: MigrationFixCandidateSummary[],
): string {
  return candidates
    .slice(0, 3)
    .map((candidate) => `${candidate.occurrences}x ${candidate.selector} { ${candidate.property} }`)
    .join(", ");
}

function formatMigrationConvergenceSummary(
  status: MigrationConvergenceStatus,
  summary: {
    totalResults: number;
    cleanResults: number;
    approvedResults: number;
    remainingResults: number;
  },
): string {
  if (status === "clean") {
    return `${GREEN}clean${RESET} (${summary.cleanResults}/${summary.totalResults})`;
  }
  if (status === "approved") {
    return `${CYAN}approved${RESET} (${summary.approvedResults} approved, ${summary.cleanResults} clean)`;
  }
  return `${YELLOW}remaining${RESET} (${summary.remainingResults}/${summary.totalResults} unresolved)`;
}

async function resolveApprovalPath(dir: string, explicitPath: string): Promise<string | null> {
  if (explicitPath) return explicitPath;
  const candidate = join(dir, "approval.json");
  try {
    await access(candidate);
    return candidate;
  } catch {
    return null;
  }
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    unique.push(value);
  }
  return unique;
}

function extractMigrationColorSamples(diff: VrtDiff | null): MigrationColorSample[] {
  if (!diff || diff.regions.length === 0) return [];
  const normalizedDiff: VrtDiff = {
    ...diff,
    regions: normalizeVrtDiffRegions(diff),
  };
  const samples: MigrationColorSample[] = [];
  for (const region of normalizedDiff.regions) {
    if (!region.colorSample) continue;
    const regionDiff = createScopedVrtDiff(normalizedDiff, region);
    const change = classifyVisualDiff(regionDiff).changes[0];
    if (!change || classifyMigrationVisualChange(change, regionDiff) !== "color-change") continue;
    samples.push({
      x: region.x,
      y: region.y,
      width: region.width,
      height: region.height,
      baseline: region.colorSample.baseline.hex,
      variant: region.colorSample.current.hex,
      distance: region.colorSample.distance,
    });
  }
  return samples;
}

export function summarizeBreakpointDiscoveryDiagnostics(
  documents: Array<{
    label: string;
    diagnostics: CraterBreakpointDiscoveryDiagnostics | undefined;
  }>,
): BreakpointDiscoveryDiagnosticsSummary | undefined {
  const entries: BreakpointDiscoveryDocumentDiagnostics[] = documents.flatMap(({ label, diagnostics }) => (
    diagnostics ? [{ label, ...diagnostics }] : []
  ));
  if (entries.length === 0) return undefined;

  return {
    documents: entries,
    totals: {
      stylesheetCount: entries.reduce((sum, entry) => sum + entry.stylesheetCount, 0),
      ruleCount: entries.reduce((sum, entry) => sum + entry.ruleCount, 0),
      externalStylesheetLinks: uniqueStrings(
        entries.flatMap((entry) => entry.externalStylesheetLinks),
      ),
      ignoredQueries: uniqueStrings(entries.flatMap((entry) => entry.ignoredQueries)),
      unsupportedQueries: uniqueStrings(
        entries.flatMap((entry) => entry.unsupportedQueries),
      ),
    },
  };
}

export async function discoverResponsiveBreakpointsForHtmlDocuments(
  htmlDocuments: BreakpointDiscoveryDocumentInput[],
  backend: BreakpointDiscoveryBackend,
  craterUrl: string,
  createClient: (url: string) => BreakpointDiscoveryClient = (url) => new CraterClient(url),
): Promise<BreakpointDiscoveryStatus> {
  const regexCollections = await Promise.all(
    htmlDocuments.map(async (document) =>
      extractResponsiveBreakpointsFromHtmlWithStylesheets(
        document.html,
        await readLocalStylesheetTextsForBreakpointDiscovery(document),
      ),
    ),
  );
  const regexBreakpoints = mergeResponsiveBreakpoints(...regexCollections);

  if (backend === "regex") {
    return {
      requestedBackend: backend,
      backendUsed: "regex",
      breakpoints: regexBreakpoints,
    };
  }

  try {
    const client = createClient(craterUrl);
    await client.connect();
    try {
      const craterCollections: ResponsiveBreakpoint[][] = [];
      const diagnosticsEntries: Array<{
        label: string;
        diagnostics: CraterBreakpointDiscoveryDiagnostics | undefined;
      }> = [];
      for (const { label, html } of htmlDocuments) {
        await client.setContent(html);
        const result = await client.getResponsiveBreakpoints({
          mode: "live-inline",
          axis: "width",
          includeDiagnostics: true,
        });
        craterCollections.push(result.breakpoints);
        diagnosticsEntries.push({ label, diagnostics: result.diagnostics });
      }
      return {
        requestedBackend: backend,
        backendUsed: "crater",
        breakpoints: mergeResponsiveBreakpoints(...craterCollections, regexBreakpoints),
        diagnostics: summarizeBreakpointDiscoveryDiagnostics(diagnosticsEntries),
      };
    } finally {
      await client.close();
    }
  } catch (error) {
    if (backend === "crater") {
      throw new Error(`Crater breakpoint discovery failed: ${String(error)}`);
    }
    return {
      requestedBackend: backend,
      backendUsed: "regex",
      fallbackReason: `Crater breakpoint discovery unavailable, falling back to regex: ${String(error)}`,
      breakpoints: regexBreakpoints,
    };
  }
}

function isLocalStylesheetHref(href: string): boolean {
  if (!href) return false;
  if (href.startsWith("#") || href.startsWith("//")) return false;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/u.test(href)) return false;
  return true;
}

async function readLocalStylesheetTextsForBreakpointDiscovery(
  document: BreakpointDiscoveryDocumentInput,
): Promise<string[]> {
  if (!document.htmlPath) return [];
  const baseDir = dirname(resolve(document.htmlPath));
  const texts: string[] = [];
  for (const href of extractStylesheetHrefsFromHtml(document.html)) {
    if (!isLocalStylesheetHref(href)) continue;
    const [pathname] = href.split(/[?#]/u);
    if (!pathname) continue;
    try {
      texts.push(await readFile(resolve(baseDir, pathname), "utf-8"));
    } catch {
      // Broken or generated stylesheet links should not disable inline fallback.
    }
  }
  return texts;
}

function formatResponsiveBreakpoint(breakpoint: ResponsiveBreakpoint): string {
  const opLabel = {
    ge: ">=",
    gt: ">",
    le: "<=",
    lt: "<",
  }[breakpoint.op];
  return `width${opLabel}${breakpoint.valuePx}px`;
}

const isCliEntry = process.env.__VLMKIT_DISPATCHER_LEAF__ === "migration-compare" || (process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false);

if (isCliEntry) {
  main().catch((error) => {
    if (isPlaywrightSandboxRestrictionError(error)) {
      console.error(formatPlaywrightLaunchError(error, { commandHint: "in your local terminal or in CI" }));
      process.exit(1);
    }
    handleCliError(error);
  });
}
