/**
 * Format a migration-compare report into a one-context-window Markdown
 * summary aimed at coding agents.
 *
 * The agent's natural workflow (see `docs/reports/2026-05-12-dogfood-shadcn-luna.md`)
 * is: read the worst-viewport heatmap, then read baseline + current PNGs
 * side-by-side, then write a CSS patch. This module collapses the work into
 * a single Markdown blob that:
 *
 *   - leads with diff %/viewport in a sortable table
 *   - calls out the worst N viewports with absolute paths to their
 *     baseline/current/heatmap PNGs (the agent's Read tool can fetch them)
 *   - aggregates fix candidates with viewport coverage counts
 *   - lists category counts per viewport
 *
 * No fs reads happen here — callers supply the parsed JSON. Image paths in
 * the output are absolute, so the Markdown stays portable.
 */
import { basename, dirname, resolve } from "node:path";

export interface DfaResult {
  variant: string;
  variantFile: string;
  viewport: string;
  diffRatio: number;
  diffPixels: number;
  totalPixels: number;
  dominantCategory?: string;
  categorySummary?: string;
  categoryCounts?: Record<string, number>;
  fixCandidates?: Array<{ selector?: string; property?: string }>;
  shiftRegions?: Array<{ yStart: number; yEnd: number; shift: number; confidence?: number }>;
  globalShift?: number;
  colorSamples?: DfaColorSample[];
}

export interface DfaColorSample {
  x: number;
  y: number;
  width: number;
  height: number;
  baseline: string;
  variant: string;
  distance?: number;
}

export interface DfaCsdEntry {
  selector: string;
  property: string;
  baseline: string;
  variant: string;
}

export interface DfaCsdSummary {
  variantFile: string;
  result: {
    totalDiffs: number;
    byProperty: Array<{ property: string; count: number }>;
    bySelector: Array<{ selector: string; count: number }>;
    entries?: DfaCsdEntry[];
  };
}

export interface DfaCsdPerViewportEntry {
  selector: string;
  property: string;
  viewports: string[];
  samples: Array<{ viewport: string; baseline: string; variant: string }>;
}

export interface DfaCsdPerViewportSummary {
  variantFile: string;
  result: {
    totalDiffs: number;
    byViewport: Array<{ viewport: string; count: number }>;
    bySelectorProperty: DfaCsdPerViewportEntry[];
    universalPairs: string[];
    breakpointGatedPairs: string[];
  };
}

export interface DfaDpEntry {
  path: string;
  tag: string;
  baselineClasses: string;
  variantClasses: string;
  property: string;
  baseline: string;
  variant: string;
  parentDisplayContext?: {
    baselineParent: string;
    variantParent: string;
    isFlexOrGridItem: boolean;
  };
}

export interface DfaDpSummary {
  variantFile: string;
  result: {
    totalDiffs: number;
    pathsOnlyInBaseline: string[];
    pathsOnlyInVariant: string[];
    byProperty: Array<{ property: string; count: number }>;
    byPath: Array<{ path: string; baselineClasses: string; variantClasses: string; count: number }>;
    entries?: DfaDpEntry[];
  };
}

export interface DfaDpPerViewportSummary {
  variantFile: string;
  result: {
    totalDiffs: number;
    verifiedPairs?: string[];
    byViewport: Array<{ viewport: string; count: number }>;
    byPathProperty: Array<{
      path: string;
      property: string;
      baselineClasses: string;
      variantClasses: string;
      viewports: string[];
      samples: Array<{ viewport: string; baseline: string; variant: string; baselineEm?: number; variantEm?: number }>;
      parentDisplayContext?: {
        baselineParent: string;
        variantParent: string;
        isFlexOrGridItem: boolean;
      };
    }>;
  };
}

export interface DfaShiftOrigin {
  bandStart: number;
  bandEnd: number;
  bandShift: number;
  originPath: string;
  originTag: string;
  originBaselineTop: number;
  originVariantTop: number;
  originDeltaY: number;
  originBaselineClasses: string;
  originVariantClasses: string;
  suspectedAxis?: "height" | "margin/padding-above" | "y-position" | "unknown";
}

export interface DfaShiftOriginsSummary {
  variantFile: string;
  perViewport: Array<{
    viewport: string;
    origins: DfaShiftOrigin[];
    unexplainedBands?: Array<{ yStart: number; yEnd: number; shift: number }>;
  }>;
}

export interface DfaGridSuggestion {
  parentPath: string;
  parentTag: string;
  baselineClasses: string;
  variantClasses: string;
  viewport: string;
  baselineWidths: number[];
  variantWidths: number[];
  baselineRatioDecimal: string;
  variantRatioDecimal: string;
  baselineFrSuggestion: string;
}

export interface DfaGridSuggestionsSummary {
  variantFile: string;
  suggestions: DfaGridSuggestion[];
}

export interface DfaReport {
  dir: string;
  baseline: string;
  variants: Array<string | { file?: string }>;
  viewports: Array<{ label: string; width: number; height?: number }>;
  results: DfaResult[];
  computedStyleDiff?: DfaCsdSummary[];
  computedStyleDiffPerViewport?: DfaCsdPerViewportSummary[];
  domPositionDiff?: DfaDpSummary[];
  domPositionDiffPerViewport?: DfaDpPerViewportSummary[];
  shiftOrigins?: DfaShiftOriginsSummary[];
  gridSuggestions?: DfaGridSuggestionsSummary[];
  componentBboxDiffs?: Array<{
    variantFile: string;
    perViewport: Array<{
      viewport: string;
      matches: Array<{
        rank: number;
        baseline: { top: number; left: number; width: number; height: number; area: number; fillColor: string };
        variant: { top: number; left: number; width: number; height: number; area: number; fillColor: string };
        deltaTop: number;
        deltaLeft: number;
        deltaWidth: number;
        deltaHeight: number;
        iou: number;
      }>;
    }>;
  }>;
  componentGeometryProfiles?: Array<{
    variantFile: string;
    profiles: Array<{
      rank: number;
      baselineByViewport: Array<{ viewport: string; width: number; height: number; top: number; left: number }>;
      variantByViewport: Array<{ viewport: string; width: number; height: number; top: number; left: number }>;
      baselineSpread: { width: number; height: number };
      variantSpread: { width: number; height: number };
      responsiveMismatch?: {
        axis: "width" | "height";
        baselineSpread: number;
        variantSpread: number;
        interpretation: string;
      };
    }>;
  }>;
  heatmapRegions?: Array<{
    variantFile: string;
    perViewport: Array<{
      viewport: string;
      regions: Array<{ top: number; left: number; width: number; height: number; area: number }>;
    }>;
  }>;
  textRowShifts?: Array<{
    variantFile: string;
    perViewport: Array<{
      viewport: string;
      baselineRowCount: number;
      variantRowCount: number;
      matches: Array<{
        rank: number;
        baseline: { yCenter: number; yStart: number; yEnd: number; height: number };
        variant: { yCenter: number; yStart: number; yEnd: number; height: number };
        deltaY: number;
      }>;
    }>;
  }>;
  paletteDiffs?: Array<{
    variantFile: string;
    perViewport: Array<{
      viewport: string;
      baseline: Array<{ hex: string; share: number; r: number; g: number; b: number }>;
      variant: Array<{ hex: string; share: number; r: number; g: number; b: number }>;
      diff: {
        matched: Array<{ baseline: { hex: string; share: number }; variant: { hex: string; share: number }; distance: number }>;
        onlyInBaseline: Array<{ hex: string; share: number; nearestNeighborDistance: number }>;
        onlyInVariant: Array<{ hex: string; share: number; nearestNeighborDistance: number }>;
      };
    }>;
  }>;
  stateDiffs?: Array<{
    variantFile: string;
    perState: Array<{
      state: string;
      forcedCount: number;
      affectedElements: string[];
      perViewport: Array<{
        viewport: string;
        defaultDiffRatio: number;
        stateDiffRatio: number;
        hoverInducedDelta: number;
      }>;
    }>;
  }>;
  /** Absolute path of the report file (used to resolve sibling PNGs). */
  reportPath?: string;
}

export interface DfaOptions {
  /**
   * How many viewport heatmap triples to highlight (worst-first).
   * Default 1 — the worst viewport.
   */
  maxViewports?: number;
  /**
   * Optional override for the output dir holding the PNGs. Default: the
   * directory of `report.reportPath` if set, else `report.dir`.
   */
  outputDir?: string;
  /** Filter to a single variant by file name (useful when the report has multiple). */
  variant?: string;
  /**
   * If true, include heuristic fix candidates marked ✗ (value already
   * matches baseline). Default false — the agent has no reason to look
   * at unverified rows. Subagent eval surfaced this as noise.
   */
  showUnverified?: boolean;
  /**
   * Previous run's per-viewport diffRatio (from
   * `.vrt/last-diff-for-agent.json` or any callable source). When
   * supplied, the report includes a regression banner if the majority
   * of viewports got worse since the previous run.
   */
  previous?: PreviousRunSummary;
  /**
   * Tuning for the regression detector. Defaults are picked to ignore
   * single-viewport noise (`minViewports >= 2`) and subpixel jitter
   * (`epsilon = 0.005`).
   */
  regression?: {
    epsilon?: number;
    minViewports?: number;
  };
}

/**
 * Per-viewport diffRatio recorded at the end of one diff-for-agent run.
 * The CLI persists this to `.vrt/last-diff-for-agent.json` and the next
 * invocation passes it as `DfaOptions.previous` to drive the regression
 * banner.
 */
export interface PreviousRunSummary {
  /** ISO timestamp of the previous run, if known. */
  timestamp?: string;
  /** Absolute path of the previous migration-report.json. */
  reportPath?: string;
  /** variantFile → viewport label → diffRatio at the previous run. */
  byVariant: Record<string, Record<string, number>>;
}

export interface RegressionFinding {
  regressed: boolean;
  worsenedViewports: Array<{ viewport: string; previous: number; current: number; delta: number }>;
  totalViewports: number;
  threshold: number;
  previousTimestamp?: string;
  previousReportPath?: string;
}

/**
 * Decide whether the current per-viewport diff is a regression vs.
 * the previous run.
 *
 * - "got worse" requires `current > previous + epsilon` (default 0.005
 *   = 0.5% absolute). Filters out subpixel jitter, anti-aliasing
 *   noise, etc.
 * - "regression" requires worsened viewports >= threshold. Default
 *   threshold = `max(2, ceil(total / 2))`. The 2-floor means a single
 *   noisy viewport never triggers the alarm.
 * - Returns `null` when there's no comparable previous data for the
 *   variant — first-run, different variant set, etc.
 */
export function detectRegression(
  results: ReadonlyArray<{ viewport: string; diffRatio: number }>,
  previous: PreviousRunSummary,
  variantFile: string,
  options: { epsilon?: number; minViewports?: number } = {},
): RegressionFinding | null {
  const prevByViewport = previous.byVariant[variantFile];
  if (!prevByViewport) return null;
  const epsilon = options.epsilon ?? 0.005;
  const totalViewports = results.length;
  if (totalViewports === 0) return null;
  const threshold = options.minViewports ?? Math.max(2, Math.ceil(totalViewports / 2));
  const worsened = results
    .filter((r) => {
      const prev = prevByViewport[r.viewport];
      return typeof prev === "number" && r.diffRatio > prev + epsilon;
    })
    .map((r) => {
      const prev = prevByViewport[r.viewport]!;
      return {
        viewport: r.viewport,
        previous: prev,
        current: r.diffRatio,
        delta: r.diffRatio - prev,
      };
    });
  return {
    regressed: worsened.length >= threshold,
    worsenedViewports: worsened,
    totalViewports,
    threshold,
    previousTimestamp: previous.timestamp,
    previousReportPath: previous.reportPath,
  };
}

/**
 * Build the persistable summary for the *current* run. Pair with
 * `detectRegression` on the next invocation.
 */
export function buildPreviousRunSummary(
  report: DfaReport,
  options: { timestamp?: string } = {},
): PreviousRunSummary {
  const byVariant: Record<string, Record<string, number>> = {};
  for (const r of report.results) {
    const variantBucket = byVariant[r.variantFile] ?? (byVariant[r.variantFile] = {});
    variantBucket[r.viewport] = r.diffRatio;
  }
  return {
    timestamp: options.timestamp ?? new Date().toISOString(),
    reportPath: report.reportPath,
    byVariant,
  };
}

interface FixCandidateAggregate {
  selector: string;
  property: string;
  viewports: Set<string>;
}

function aggregateFixCandidates(results: DfaResult[]): FixCandidateAggregate[] {
  const byKey = new Map<string, FixCandidateAggregate>();
  for (const r of results) {
    for (const fc of r.fixCandidates ?? []) {
      const selector = fc.selector ?? "?";
      const property = fc.property ?? "?";
      const key = `${selector}::${property}`;
      const agg = byKey.get(key) ?? { selector, property, viewports: new Set() };
      agg.viewports.add(r.viewport);
      byKey.set(key, agg);
    }
  }
  return [...byKey.values()].sort((a, b) =>
    b.viewports.size - a.viewports.size
    || a.selector.localeCompare(b.selector)
    || a.property.localeCompare(b.property),
  );
}

function aggregateCategoryCounts(results: DfaResult[]): Array<{ category: string; total: number; viewports: number }> {
  const byCategory = new Map<string, { total: number; viewports: number }>();
  for (const r of results) {
    for (const [category, count] of Object.entries(r.categoryCounts ?? {})) {
      if (count === 0) continue;
      const agg = byCategory.get(category) ?? { total: 0, viewports: 0 };
      agg.total += count;
      agg.viewports += 1;
      byCategory.set(category, agg);
    }
  }
  return [...byCategory.entries()]
    .map(([category, v]) => ({ category, total: v.total, viewports: v.viewports }))
    .sort((a, b) => b.total - a.total || a.category.localeCompare(b.category));
}

function viewportImagePaths(
  baselineFile: string,
  variantFile: string,
  viewport: string,
  outputDir: string,
): { baseline: string; current: string; heatmap: string } {
  const baselineName = basename(baselineFile, ".html");
  const variantName = basename(variantFile, ".html");
  return {
    baseline: resolve(outputDir, `${baselineName}-${viewport}.png`),
    current: resolve(outputDir, `${variantName}-${viewport}.png`),
    heatmap: resolve(outputDir, `${variantName}-${viewport}_heatmap.png`),
  };
}

function nearestAnnotation(distance: number): string {
  if (!Number.isFinite(distance)) return "—";
  const d = distance.toFixed(0);
  if (distance <= 30) return `${d} _(near, likely AA)_`;
  if (distance <= 60) return `${d} _(close)_`;
  return `${d}`;
}

function formatPct(ratio: number): string {
  return `${(ratio * 100).toFixed(2)}%`;
}

/**
 * Render a property value alongside its em-equivalent when the property
 * is em-relative. This exposes the case Subagent D flagged: a single
 * `-0.03em` rule applied to N elements with different font-sizes shows
 * up as N different px values; the em column reveals they're one rule.
 */
function formatValueWithEm(value: string, em: number | undefined): string {
  if (em === undefined) return `\`${value}\``;
  return `\`${value}\` _(${em}em)_`;
}

/**
 * Append a flex/grid coercion suffix when a `display`-row's parent is a
 * flex/grid container. CSS blockifies inline children of flex/grid
 * containers, so an `inline-flex` rule can compute as `flex` and look
 * like a delta when it isn't — D's exact complaint.
 */
function displayCoercionSuffix(
  property: string,
  ctx?: { baselineParent: string; variantParent: string; isFlexOrGridItem: boolean },
): string {
  if (property !== "display" || !ctx || !ctx.isFlexOrGridItem) return "";
  const sameParent = ctx.baselineParent === ctx.variantParent;
  return sameParent
    ? ` _(flex/grid item — parent is ${ctx.baselineParent})_`
    : ` _(flex/grid item — baseline parent ${ctx.baselineParent}, variant parent ${ctx.variantParent})_`;
}

/**
 * Build a set of `selector::property` strings that represent *real* deltas,
 * derived from both the computed-style diff (literal selector match) and
 * the DOM-position diff (class-rename-aware). Fix candidates marked ✓ must
 * match one of these exactly.
 */
function buildVerifiedPairSet(report: DfaReport, variantFile: string): Set<string> {
  const out = new Set<string>();

  // 1) computed-style — exact (selector, property) pairs.
  const csd = (report.computedStyleDiff ?? []).find((c) => c.variantFile === variantFile);
  if (csd) {
    for (const e of csd.result.entries ?? []) {
      out.add(`${e.selector}::${e.property}`);
    }
  }

  // 2) DOM-position — prefer the pre-built `verifiedPairs` index (untruncated,
  // accurate even when entries/byPathProperty are capped). Fall back to
  // building from samples for back-compat with older reports.
  const perVp = (report.domPositionDiffPerViewport ?? []).find((d) => d.variantFile === variantFile);
  const single = (report.domPositionDiff ?? []).find((d) => d.variantFile === variantFile);

  if (perVp?.result.verifiedPairs && perVp.result.verifiedPairs.length > 0) {
    for (const key of perVp.result.verifiedPairs) out.add(key);
  } else {
    const collect = (variantClasses: string, property: string) => {
      const tokens = variantClasses.split(/\s+/).filter(Boolean);
      for (const cls of tokens) out.add(`.${cls}::${property}`);
      out.add(`::${property}`);
    };
    if (perVp) {
      for (const pp of perVp.result.byPathProperty) collect(pp.variantClasses, pp.property);
    } else if (single) {
      for (const e of single.result.entries ?? []) collect(e.variantClasses, e.property);
    }
  }

  return out;
}

function candidateMatchesVerifiedPair(
  selector: string,
  property: string,
  verifiedPairs: Set<string>,
): boolean {
  // Direct exact match.
  if (verifiedPairs.has(`${selector}::${property}`)) return true;

  // Compound selector like `.luna-actions > .luna-action` — try each token.
  for (const token of selector.split(/[\s>+~,]/)) {
    const trimmed = token.trim();
    if (!trimmed) continue;
    if (verifiedPairs.has(`${trimmed}::${property}`)) return true;
  }
  return false;
}

interface ClassRenamePair {
  baselineClasses: string;
  variantClasses: string;
  pathCount: number;  // distinct DOM positions where this rename appears
  uniqueProperties: number;  // unique properties that differ for this class pair
}

function extractClassRenameMap(report: DfaReport, variantFile: string): ClassRenamePair[] {
  // Prefer per-viewport data (richer); fall back to single-viewport DOM-position diff.
  const perVp = (report.domPositionDiffPerViewport ?? []).find((d) => d.variantFile === variantFile);
  const single = (report.domPositionDiff ?? []).find((d) => d.variantFile === variantFile);

  type Source = { path: string; property: string; baselineClasses: string; variantClasses: string };
  const positions: Source[] = [];

  if (perVp) {
    for (const pp of perVp.result.byPathProperty) {
      positions.push({
        path: pp.path,
        property: pp.property,
        baselineClasses: pp.baselineClasses,
        variantClasses: pp.variantClasses,
      });
    }
  } else if (single) {
    for (const e of single.result.entries ?? []) {
      positions.push({
        path: e.path,
        property: e.property,
        baselineClasses: e.baselineClasses,
        variantClasses: e.variantClasses,
      });
    }
  }

  if (positions.length === 0) return [];

  // Aggregate by (baselineClasses, variantClasses) pair. Subagent D
  // pointed out the previous count inflated by `#instances × #properties`
  // — a class with 4 cards on the page contributed each property 4×.
  // Now we count **unique properties** that differ for this class pair
  // (`uniqueProperties`) alongside the distinct element positions
  // (`pathCount`). Same-class-name entries are skipped.
  const pairs = new Map<string, {
    baselineClasses: string;
    variantClasses: string;
    paths: Set<string>;
    properties: Set<string>;
  }>();
  for (const pos of positions) {
    if (pos.baselineClasses === pos.variantClasses) continue;
    const key = `${pos.baselineClasses} ${pos.variantClasses}`;
    const cur = pairs.get(key) ?? {
      baselineClasses: pos.baselineClasses,
      variantClasses: pos.variantClasses,
      paths: new Set<string>(),
      properties: new Set<string>(),
    };
    cur.paths.add(pos.path);
    cur.properties.add(pos.property);
    pairs.set(key, cur);
  }

  return [...pairs.values()]
    .map((p) => ({
      baselineClasses: p.baselineClasses,
      variantClasses: p.variantClasses,
      pathCount: p.paths.size,
      uniqueProperties: p.properties.size,
    }))
    .sort((a, b) =>
      b.uniqueProperties - a.uniqueProperties
      || b.pathCount - a.pathCount
      || a.baselineClasses.localeCompare(b.baselineClasses),
    );
}

function formatShiftBands(r: DfaResult): string {
  const bands = r.shiftRegions ?? [];
  if (bands.length === 0) {
    return r.globalShift && r.globalShift !== 0
      ? `global ${r.globalShift > 0 ? "+" : ""}${r.globalShift}px`
      : "-";
  }
  // Compact form: "[0–240]:+8 [240–600]:+20"
  return bands
    .map((b) => `[${b.yStart}–${b.yEnd}]:${b.shift > 0 ? "+" : ""}${b.shift}px`)
    .join(" ");
}

interface SectionRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface SectionDiffRow {
  viewport: string;
  section: SectionRect;
  sectionRatio: number;
  totalRatio: number;
  rank: number;
}

function rectIntersectionArea(a: SectionRect, b: SectionRect): number {
  const left = Math.max(a.left, b.left);
  const top = Math.max(a.top, b.top);
  const right = Math.min(a.left + a.width, b.left + b.width);
  const bottom = Math.min(a.top + a.height, b.top + b.height);
  if (right <= left || bottom <= top) return 0;
  return (right - left) * (bottom - top);
}

/**
 * Per-section diff intensity for one viewport.
 *
 * - Sections are the top-N component bboxes (by baseline area). They
 *   come from `component-bbox`, so they survive DOM rewrites.
 * - Diff is approximated as the sum of rectangle intersections between
 *   each section and each heatmap region. This is conservative: it
 *   overcounts when a region only partially fills its bbox, but the
 *   ranking — which is what the agent uses — stays correct.
 * - `sectionRatio` = section_diff_px / section_area_px
 *   `totalRatio`   = section_diff_px / viewport_total_px
 */
export function computeSectionDiffRows(
  bboxesForViewport: { matches: Array<{ baseline: SectionRect; rank: number }> },
  regionsForViewport: ReadonlyArray<SectionRect>,
  viewport: string,
  viewportTotalPixels: number,
  topN: number,
): SectionDiffRow[] {
  if (bboxesForViewport.matches.length === 0) return [];
  const sortedSections = [...bboxesForViewport.matches]
    .sort((a, b) => b.baseline.width * b.baseline.height - a.baseline.width * a.baseline.height)
    .slice(0, topN);

  const rows: SectionDiffRow[] = [];
  for (const match of sortedSections) {
    const section = match.baseline;
    const sectionArea = section.width * section.height;
    if (sectionArea === 0) continue;
    let diffArea = 0;
    for (const region of regionsForViewport) {
      diffArea += rectIntersectionArea(section, region);
    }
    rows.push({
      viewport,
      section,
      sectionRatio: diffArea / sectionArea,
      totalRatio: viewportTotalPixels > 0 ? diffArea / viewportTotalPixels : 0,
      rank: match.rank,
    });
  }
  return rows.sort((a, b) => b.sectionRatio - a.sectionRatio);
}

export function formatMigrationReportForAgent(
  report: DfaReport,
  options: DfaOptions = {},
): string {
  const outputDir = options.outputDir
    ?? (report.reportPath ? dirname(report.reportPath) : report.dir);
  const maxViewports = Math.max(1, options.maxViewports ?? 1);

  const filtered = options.variant
    ? report.results.filter((r) => r.variantFile === options.variant || r.variant === options.variant)
    : report.results;

  if (filtered.length === 0) {
    return options.variant
      ? `# VRT diff (for agent)\n\n_No results for variant "${options.variant}"._\n`
      : `# VRT diff (for agent)\n\n_Empty report._\n`;
  }

  // Group by variant for the diff table, but keep one variant focus.
  const byVariant = new Map<string, DfaResult[]>();
  for (const r of filtered) {
    const k = r.variantFile;
    const list = byVariant.get(k);
    if (list) list.push(r); else byVariant.set(k, [r]);
  }

  const lines: string[] = [];
  lines.push("# VRT diff (for agent)");
  lines.push("");
  lines.push(`Baseline: \`${report.baseline}\``);
  lines.push(`Variants: ${[...byVariant.keys()].map((v) => `\`${v}\``).join(", ")}`);
  lines.push("");

  for (const [variantFile, results] of byVariant) {
    const sorted = [...results].sort((a, b) => b.diffRatio - a.diffRatio);
    const allZero = sorted.every((r) => r.diffRatio === 0);

    lines.push(`## ${variantFile}`);
    lines.push("");

    // Check if any non-default-state signal has data — these fire
    // even when the default screenshot diff is 0% (e.g. broken hover
    // styles render identically by default but diverge under
    // interaction). Don't early-exit in that case.
    const hasStateSignal = (report.stateDiffs ?? [])
      .find((s) => s.variantFile === variantFile)?.perState
      .some((ps) => ps.perViewport.some((vp) => Math.abs(vp.hoverInducedDelta) > 0.001)) ?? false;

    if (allZero && !hasStateSignal) {
      lines.push("**PASS** — 0.00% diff on every viewport. Nothing to fix.");
      lines.push("");
      continue;
    }
    if (allZero && hasStateSignal) {
      lines.push("Default-state diff is **0.00%** on every viewport, but " +
        "forced-state (`:hover` / `:focus` etc.) diff is non-zero — see the " +
        "**Forced-state diff** section below. This pattern usually means the " +
        "variant forgot to wire up interaction-state styles.");
      lines.push("");
    }

    // Regression alarm — fires when the majority of viewports got
    // worse since the previous run. See the 2026-05-12 subagent eval:
    // both subagents wasted an iteration on a regression that needed
    // manual reverting. The threshold floor of 2 viewports prevents a
    // single noisy viewport from triggering the alarm.
    if (options.previous) {
      const finding = detectRegression(sorted, options.previous, variantFile, options.regression);
      if (finding?.regressed) {
        lines.push("### ⚠ REGRESSION");
        lines.push("");
        lines.push(`**${finding.worsenedViewports.length} of ${finding.totalViewports} viewports got worse since the previous run** ` +
          `(threshold ≥ ${finding.threshold}). Consider reverting the last patch and re-running.`);
        lines.push("");
        lines.push("| Viewport | Previous | Current | Δ |");
        lines.push("|---|---|---|---|");
        for (const w of finding.worsenedViewports) {
          const deltaPct = `+${(w.delta * 100).toFixed(2)}%`;
          lines.push(`| \`${w.viewport}\` | ${(w.previous * 100).toFixed(2)}% | ${(w.current * 100).toFixed(2)}% | ${deltaPct} |`);
        }
        if (finding.previousReportPath) {
          lines.push("");
          lines.push(`Previous report: \`${finding.previousReportPath}\``);
        }
        lines.push("");
      }
    }

    // Class-rename map at the top — subagent C called this "the single
    // most valuable artifact." Surface it before the diff tables.
    const renameMapEntries = extractClassRenameMap(report, variantFile);
    if (renameMapEntries.length > 0) {
      lines.push("### Class-rename map");
      lines.push("");
      lines.push("Inferred from DOM positions where the same tag in baseline " +
        "and variant carries different `class` attributes. Read this first — " +
        "it's the rename glossary the rest of the report assumes.");
      lines.push("");
      lines.push("| Baseline class | Variant class | Element positions | Unique properties differ |");
      lines.push("|---|---|---|---|");
      for (const e of renameMapEntries.slice(0, 25)) {
        const bcls = e.baselineClasses || "_(none)_";
        const vcls = e.variantClasses || "_(none)_";
        lines.push(`| \`${bcls}\` | \`${vcls}\` | ${e.pathCount} | ${e.uniqueProperties} |`);
      }
      if (renameMapEntries.length > 25) {
        lines.push(`| _…${renameMapEntries.length - 25} more pairs_ | | | |`);
      }
      lines.push("");
    }

    lines.push("### Diff by viewport (worst first)");
    lines.push("");
    lines.push("| Viewport | Diff | Dominant category | Categories | Shift bands |");
    lines.push("|---|---|---|---|---|");
    for (const r of sorted) {
      const cat = r.dominantCategory ?? "-";
      const summary = r.categorySummary ?? "-";
      const bands = formatShiftBands(r);
      lines.push(`| \`${r.viewport}\` | ${formatPct(r.diffRatio)} | ${cat} | ${summary} | ${bands} |`);
    }
    lines.push("");

    // Hoisted to triage position (right after the viewport summary) so
    // an agent reading top-down sees the highest-signal table first.
    // The vrt-visual-diff skill names this as the canonical
    // start-here triage table.
    const csdPerVpSummary = (report.computedStyleDiffPerViewport ?? []).find((c) => c.variantFile === variantFile);
    if (csdPerVpSummary && csdPerVpSummary.result.totalDiffs > 0) {
      lines.push("### Verified deltas (computed-style) × viewport (catches breakpoint-gated rules)");
      lines.push("");
      lines.push("Each (selector, property) is captured at every snapshot viewport. " +
        "*Universal* pairs differ on every viewport — fix the base rule. " +
        "*Breakpoint-gated* pairs differ only on a subset — almost always a missing " +
        "or wrong `@media` rule. Without this split, mobile-only deltas were getting " +
        "patched into the desktop rule and vice-versa.");
      lines.push("");
      lines.push(`Total: **${csdPerVpSummary.result.totalDiffs}** (selector, property, viewport) tuples ` +
        `across ${csdPerVpSummary.result.byViewport.length} viewports ` +
        `(${csdPerVpSummary.result.universalPairs.length} universal pair(s), ` +
        `${csdPerVpSummary.result.breakpointGatedPairs.length} breakpoint-gated pair(s)).`);
      lines.push("");

      const universalRows = csdPerVpSummary.result.bySelectorProperty.filter(
        (e) => e.viewports.length === csdPerVpSummary.result.byViewport.length,
      );
      if (universalRows.length > 0) {
        lines.push("#### Universal pairs (every viewport — fix the base rule)");
        lines.push("");
        lines.push("| Selector | Property | Baseline | Variant |");
        lines.push("|---|---|---|---|");
        for (const row of universalRows.slice(0, 15)) {
          // All viewports agree, so pick the first sample for the displayed value.
          const sample = row.samples[0]!;
          lines.push(`| \`${row.selector}\` | \`${row.property}\` | \`${sample.baseline}\` | \`${sample.variant}\` |`);
        }
        if (universalRows.length > 15) {
          lines.push(`| _…${universalRows.length - 15} more universal pairs_ | | | |`);
        }
        lines.push("");
      }

      const gatedRows = csdPerVpSummary.result.bySelectorProperty.filter(
        (e) => e.viewports.length < csdPerVpSummary.result.byViewport.length,
      );
      if (gatedRows.length > 0) {
        lines.push("#### Breakpoint-gated pairs (missing or wrong `@media` rule)");
        lines.push("");
        lines.push("| Selector | Property | Affected viewports | Sample (viewport: baseline → variant) |");
        lines.push("|---|---|---|---|");
        for (const row of gatedRows.slice(0, 15)) {
          const vps = row.viewports.join(", ");
          const sampleText = row.samples
            .slice(0, 3)
            .map((s) => `\`${s.viewport}\`: \`${s.baseline}\` → \`${s.variant}\``)
            .join("; ");
          const moreSamples = row.samples.length > 3 ? ` (+${row.samples.length - 3} more)` : "";
          lines.push(`| \`${row.selector}\` | \`${row.property}\` | ${vps} | ${sampleText}${moreSamples} |`);
        }
        if (gatedRows.length > 15) {
          lines.push(`| _…${gatedRows.length - 15} more breakpoint-gated pairs_ | | | |`);
        }
        lines.push("");
      }
    }

    const bboxSummary = (report.componentBboxDiffs ?? []).find((c) => c.variantFile === variantFile);
    const sectionHeatmapSummary = (report.heatmapRegions ?? []).find((h) => h.variantFile === variantFile);
    if (bboxSummary && sectionHeatmapSummary && bboxSummary.perViewport.length > 0) {
      const sectionRows: SectionDiffRow[] = [];
      for (const vp of bboxSummary.perViewport) {
        const heatmapVp = sectionHeatmapSummary.perViewport.find((h) => h.viewport === vp.viewport);
        if (!heatmapVp || heatmapVp.regions.length === 0) continue;
        const viewportResult = results.find((r) => r.viewport === vp.viewport);
        const viewportTotalPixels = viewportResult?.totalPixels ?? 0;
        sectionRows.push(
          ...computeSectionDiffRows(vp, heatmapVp.regions, vp.viewport, viewportTotalPixels, 5),
        );
      }
      if (sectionRows.length > 0) {
        lines.push("### Per-section diffRatio (heatmap × component-bbox)");
        lines.push("");
        lines.push("For each viewport, the top-5 component bboxes (by baseline area) are " +
          "intersected with the heatmap regions. `Section %` is diff_area_inside_section / " +
          "section_area (= how concentrated the change is within this section). " +
          "`Total %` is diff_area_inside_section / viewport_total (= this section's " +
          "contribution to the overall viewport diff). The single highest `Section %` " +
          "row across all viewports is marked ⚠ — fix that one first.");
        lines.push("");
        lines.push("| Viewport | Rank | Section (top,left WxH) | Section % | Total % | Worst |");
        lines.push("|---|---|---|---|---|---|");
        const worst = sectionRows.reduce<SectionDiffRow | null>(
          (acc, cur) => (acc === null || cur.sectionRatio > acc.sectionRatio ? cur : acc),
          null,
        );
        for (const row of sectionRows) {
          const s = row.section;
          const sectionPct = `${(row.sectionRatio * 100).toFixed(2)}%`;
          const totalPct = `${(row.totalRatio * 100).toFixed(3)}%`;
          const badge = row === worst ? "⚠" : "";
          lines.push(
            `| \`${row.viewport}\` | #${row.rank} | ${s.left},${s.top} ${s.width}×${s.height} | ${sectionPct} | ${totalPct} | ${badge} |`,
          );
        }
        lines.push("");
      }
    }

    if (bboxSummary && bboxSummary.perViewport.length > 0) {
      lines.push("### Component bbox diff (image-only — works without DOM correspondence)");
      lines.push("");
      lines.push("Largest non-background regions in each viewport's screenshot, " +
        "matched by rank-after-sort-by-area between baseline and variant. " +
        "Survives DOM rewrites — useful when the agent invented a different " +
        "tag tree than the reference. `iou` is intersection-over-union ∈ [0,1] " +
        "(higher = more overlap).");
      lines.push("");
      lines.push("| Viewport | Rank | Baseline bbox | Variant bbox | Δ top / left / W / H | IoU |");
      lines.push("|---|---|---|---|---|---|");
      for (const vp of bboxSummary.perViewport) {
        for (const m of vp.matches) {
          const b = `${m.baseline.left},${m.baseline.top} ${m.baseline.width}×${m.baseline.height}`;
          const v = `${m.variant.left},${m.variant.top} ${m.variant.width}×${m.variant.height}`;
          const sign = (n: number) => (n > 0 ? `+${n}` : `${n}`);
          const delta = `${sign(m.deltaTop)} / ${sign(m.deltaLeft)} / ${sign(m.deltaWidth)} / ${sign(m.deltaHeight)}`;
          lines.push(`| \`${vp.viewport}\` | #${m.rank} | ${b} | ${v} | ${delta} | ${m.iou} |`);
        }
      }
      lines.push("");
    }

    const geometrySummary = (report.componentGeometryProfiles ?? []).find((g) => g.variantFile === variantFile);
    if (geometrySummary && geometrySummary.profiles.length > 0) {
      lines.push("### Cross-viewport geometry profile (responsive mismatch)");
      lines.push("");
      lines.push("For each matched component (by area-rank), this is how its width / " +
        "height moves across viewports on the baseline vs. on the variant. A " +
        "large spread on one side and ~0 on the other means one side adapts " +
        "to viewport width and the other doesn't — typical CSS bugs are " +
        "missing `max-width`, missing `@media` rule, or a hard-coded pixel " +
        "size where the baseline uses fluid units.");
      lines.push("");
      lines.push("| Rank | Baseline width spread | Variant width spread | Baseline height spread | Variant height spread | Interpretation |");
      lines.push("|---|---|---|---|---|---|");
      for (const p of geometrySummary.profiles) {
        const interp = p.responsiveMismatch?.interpretation ?? "-";
        lines.push(`| #${p.rank} | ${p.baselineSpread.width}px | ${p.variantSpread.width}px | ${p.baselineSpread.height}px | ${p.variantSpread.height}px | ${interp} |`);
      }
      lines.push("");
    }

    const textRowsSummary = (report.textRowShifts ?? []).find((t) => t.variantFile === variantFile);
    if (textRowsSummary && textRowsSummary.perViewport.length > 0) {
      lines.push("### Text-row Δy (luminance-band peaks paired by order)");
      lines.push("");
      lines.push("Dark horizontal bands in the rendered PNG, paired top-to-bottom " +
        "with the variant's bands. When the *count* matches but y-positions don't, " +
        "the variant has the right content but wrong vertical spacing somewhere " +
        "above. When the count differs, the variant is missing (or has extra) " +
        "rows of content. No DOM correspondence required.");
      lines.push("");
      lines.push("| Viewport | Bands B / V | Rank | Baseline y | Variant y | Δy |");
      lines.push("|---|---|---|---|---|---|");
      for (const vp of textRowsSummary.perViewport) {
        const countCol = `${vp.baselineRowCount} / ${vp.variantRowCount}`;
        if (vp.matches.length === 0) {
          // Count mismatch but no rank-aligned matches survived (often
          // because one side has 0 rows). Emit a single summary row.
          lines.push(`| \`${vp.viewport}\` | ${countCol} | _(count mismatch — no paired rows)_ | — | — | — |`);
          continue;
        }
        for (const m of vp.matches) {
          const signed = m.deltaY > 0 ? `+${m.deltaY}` : `${m.deltaY}`;
          lines.push(`| \`${vp.viewport}\` | ${countCol} | #${m.rank} | ${m.baseline.yCenter} | ${m.variant.yCenter} | ${signed}px |`);
        }
      }
      lines.push("");
    }

    const heatmapSummary = (report.heatmapRegions ?? []).find((h) => h.variantFile === variantFile);
    if (heatmapSummary && heatmapSummary.perViewport.length > 0) {
      lines.push("### Heatmap region clusters (where the diff actually is)");
      lines.push("");
      lines.push("Connected hot-pixel clusters in `*_heatmap.png`. Each row is a " +
        "rectangular bounding box around one cluster of pixelmatch-flagged " +
        "pixels, sorted by hot-pixel count. Use these to localize diffs " +
        "horizontally (per-band shift only gives vertical bands).");
      lines.push("");
      lines.push("| Viewport | Top-Left | Size | Hot pixels |");
      lines.push("|---|---|---|---|");
      for (const vp of heatmapSummary.perViewport) {
        for (const r of vp.regions.slice(0, 5)) {
          lines.push(`| \`${vp.viewport}\` | ${r.left},${r.top} | ${r.width}×${r.height} | ${r.area} |`);
        }
      }
      lines.push("");
    }

    const stateSummary = (report.stateDiffs ?? []).find((s) => s.variantFile === variantFile);
    if (stateSummary && stateSummary.perState.length > 0) {
      lines.push("### Forced-state diff (`:hover` / `:focus` etc.)");
      lines.push("");
      lines.push("Each interactive element on the page is forced into the named " +
        "pseudo-state via CDP `CSS.forcePseudoState` and the page is " +
        "re-screenshot. Compare to the *default-state* diff: if the **induced " +
        "delta** is large, the variant renders identically by default but the " +
        "two diverge under interaction — usually means the agent forgot to " +
        "wire up `:hover` / `:focus-visible` / etc. rules.");
      lines.push("");
      lines.push("| State | Viewport | Default diff | State diff | Induced delta | Forced elements |");
      lines.push("|---|---|---|---|---|---|");
      for (const s of stateSummary.perState) {
        for (const vp of s.perViewport) {
          const induced = (vp.hoverInducedDelta * 100).toFixed(2);
          const inducedSigned = vp.hoverInducedDelta > 0 ? `+${induced}%` : `${induced}%`;
          lines.push(`| \`:${s.state}\` | \`${vp.viewport}\` | ${(vp.defaultDiffRatio * 100).toFixed(2)}% | ${(vp.stateDiffRatio * 100).toFixed(2)}% | ${inducedSigned} | ${s.forcedCount} |`);
        }
      }
      lines.push("");
      const sampleAffected = stateSummary.perState[0]?.affectedElements ?? [];
      if (sampleAffected.length > 0) {
        lines.push(`Sample of forced elements: ${sampleAffected.map((s) => `\`${s}\``).join(", ")}.`);
        lines.push("");
      }
    }

    const paletteSummary = (report.paletteDiffs ?? []).find((p) => p.variantFile === variantFile);
    if (paletteSummary && paletteSummary.perViewport.length > 0) {
      lines.push("### Palette diff (design-token compliance)");
      lines.push("");
      lines.push("Dominant colors extracted from each viewport's rendered PNG, " +
        "stride-sampled and quantized to 5-bit-per-channel buckets. " +
        "*Missing* = colors visible in the baseline target but not the variant " +
        "(agent forgot a color); *Extra* = colors present in the variant but " +
        "not the target (agent used a hard-coded literal instead of the token). " +
        "Near-neighbor matches (RGB distance ≤ 12) are treated as the same color.");
      lines.push("");
      lines.push("| Viewport | Side | Color | Share | Nearest |");
      lines.push("|---|---|---|---|---|");
      for (const vp of paletteSummary.perViewport) {
        for (const c of vp.diff.onlyInBaseline.slice(0, 6)) {
          const pct = (c.share * 100).toFixed(1);
          // Surface near-neighbor distance — a "near miss" with
          // distance ≈ 12-30 is usually an AA / quantization artifact,
          // not a real palette gap. Helps the agent dismiss noise once
          // overall diff is low.
          const near = nearestAnnotation(c.nearestNeighborDistance);
          lines.push(`| \`${vp.viewport}\` | missing | \`${c.hex}\` | ${pct}% | ${near} |`);
        }
        for (const c of vp.diff.onlyInVariant.slice(0, 6)) {
          const pct = (c.share * 100).toFixed(1);
          const near = nearestAnnotation(c.nearestNeighborDistance);
          lines.push(`| \`${vp.viewport}\` | extra | \`${c.hex}\` | ${pct}% | ${near} |`);
        }
      }
      lines.push("");
    }

    const shiftOriginsSummary = (report.shiftOrigins ?? []).find((s) => s.variantFile === variantFile);
    if (shiftOriginsSummary && shiftOriginsSummary.perViewport.length > 0) {
      lines.push("### Shift-origin diagnostics (what's causing the per-band Δy)");
      lines.push("");
      lines.push("For each per-band Δy reported in the diff table above, the " +
        "*first element whose y-coordinate diverges* between baseline and " +
        "variant — i.e. the local origin of the shift. Subsequent elements " +
        "below this one inherit the same Δy.");
      lines.push("");
      const hasOrigins = shiftOriginsSummary.perViewport.some((v) => v.origins.length > 0);
      if (hasOrigins) {
        lines.push("| Viewport | Band (y) | Δy | Origin position | Baseline class | Variant class | Origin Δtop | Suspect |");
        lines.push("|---|---|---|---|---|---|---|---|");
        for (const vp of shiftOriginsSummary.perViewport) {
          for (const o of vp.origins) {
            const bcls = o.originBaselineClasses || "_(none)_";
            const vcls = o.originVariantClasses || "_(none)_";
            const signedShift = o.bandShift > 0 ? `+${o.bandShift}` : `${o.bandShift}`;
            const signedDelta = o.originDeltaY > 0 ? `+${o.originDeltaY}` : `${o.originDeltaY}`;
            lines.push(
              `| \`${vp.viewport}\` | ${o.bandStart}–${o.bandEnd} | ${signedShift}px | ` +
              `\`${o.originPath}\` | \`${bcls}\` | \`${vcls}\` | ${signedDelta}px | ${o.suspectedAxis ?? "?"} |`,
            );
          }
        }
        lines.push("");
        lines.push("Suspect column: `height` = the origin element's own height " +
          "differs (its `padding`, `line-height`, or content sizing is the " +
          "root cause); `margin/padding-above` = same height but its top " +
          "moved (a parent's padding or a previous sibling's height/margin " +
          "is responsible).");
        lines.push("");
      }

      // Bands that pixelmatch reported but no element-level Δy explains.
      // Almost always a cross-correlation artifact (repeated patterns,
      // subpixel font-metric differences, etc.) — not an actual layout shift.
      const phantomBands: Array<{ viewport: string; band: { yStart: number; yEnd: number; shift: number } }> = [];
      for (const vp of shiftOriginsSummary.perViewport) {
        for (const b of vp.unexplainedBands ?? []) {
          phantomBands.push({ viewport: vp.viewport, band: b });
        }
      }
      if (phantomBands.length > 0) {
        lines.push(`> **Phantom shifts**: ${phantomBands.length} band(s) reported by the pixel-shift detector ` +
          "have no DOM-level Δy explanation. These are almost always pixelmatch " +
          "cross-correlation artifacts (repeated patterns, subpixel font-metric " +
          "differences) — *not* a real layout shift. Treat as noise unless the " +
          "viewport's overall diff % is also high.");
        lines.push("");
        lines.push("| Viewport | Band (y) | Reported shift |");
        lines.push("|---|---|---|");
        for (const p of phantomBands) {
          const signed = p.band.shift > 0 ? `+${p.band.shift}` : `${p.band.shift}`;
          lines.push(`| \`${p.viewport}\` | ${p.band.yStart}–${p.band.yEnd} | ${signed}px |`);
        }
        lines.push("");
      }
    }

    const gridSummary = (report.gridSuggestions ?? []).find((g) => g.variantFile === variantFile);
    if (gridSummary && gridSummary.suggestions.length > 0) {
      lines.push("### Grid `fr`-ratio suggestions");
      lines.push("");
      lines.push("Container elements whose direct children have a non-uniform width " +
        "distribution that differs between baseline and variant. The baseline " +
        "ratio is shown alongside an integer `fr` approximation — paste straight " +
        "into `grid-template-columns:`.");
      lines.push("");
      lines.push("| Parent | Viewport | Baseline widths (px) | Variant widths (px) | Baseline ratio | Suggested `grid-template-columns` |");
      lines.push("|---|---|---|---|---|---|");
      for (const s of gridSummary.suggestions.slice(0, 15)) {
        const bcls = s.baselineClasses || "_(none)_";
        const vcls = s.variantClasses || "_(none)_";
        const baselineW = s.baselineWidths.map((w) => Math.round(w)).join(" / ");
        const variantW = s.variantWidths.map((w) => Math.round(w)).join(" / ");
        lines.push(
          `| \`${bcls}\` → \`${vcls}\` (\`${s.parentPath}\`) | \`${s.viewport}\` | ${baselineW} | ${variantW} | ${s.baselineRatioDecimal} | \`${s.baselineFrSuggestion}\` |`,
        );
      }
      if (gridSummary.suggestions.length > 15) {
        lines.push(`| _…${gridSummary.suggestions.length - 15} more containers_ | | | | | |`);
      }
      lines.push("");
    }

    const categoryAgg = aggregateCategoryCounts(results);
    if (categoryAgg.length > 0) {
      lines.push("### Category totals across viewports");
      lines.push("");
      for (const c of categoryAgg) {
        lines.push(`- **${c.category}** — ${c.total} change(s) across ${c.viewports} viewport(s)`);
      }
      lines.push("");
    }

    const colorSamples = results.flatMap((r) =>
      (r.colorSamples ?? []).map((sample) => ({ viewport: r.viewport, ...sample })),
    );
    if (colorSamples.length > 0) {
      lines.push("### Color-change samples");
      lines.push("");
      lines.push("Sampled baseline/current colors for dense color-change regions. Use these as concrete paint-token hints before guessing from the PNG.");
      lines.push("");
      lines.push("| Viewport | Region | Baseline | Current | RGB distance |");
      lines.push("|---|---|---|---|---|");
      for (const sample of colorSamples.slice(0, 12)) {
        const region = `${sample.x},${sample.y} ${sample.width}x${sample.height}`;
        const distance = sample.distance === undefined ? "-" : String(sample.distance);
        lines.push(`| \`${sample.viewport}\` | \`${region}\` | \`${sample.baseline}\` | \`${sample.variant}\` | ${distance} |`);
      }
      if (colorSamples.length > 12) {
        lines.push(`| _…${colorSamples.length - 12} more_ | | | | |`);
      }
      lines.push("");
    }

    const csdSummary = (report.computedStyleDiff ?? []).find((c) => c.variantFile === variantFile);
    // Build a strict "(selector, property)" verification set instead of
    // the looser "property name appears anywhere" check that previously
    // marked unchanged-but-flagged candidates as ✓.
    const verifiedPairs = buildVerifiedPairSet(report, variantFile);
    const verificationAvailable = csdSummary !== undefined || verifiedPairs.size > 0;

    const fixCandidates = aggregateFixCandidates(results);
    const showUnverified = options.showUnverified ?? false;
    if (fixCandidates.length > 0) {
      // Sort: verified ✓ first, then by viewport count desc.
      const annotated = fixCandidates.map((fc) => ({
        fc,
        verified: verificationAvailable
          ? candidateMatchesVerifiedPair(fc.selector, fc.property, verifiedPairs)
          : null,
      }));
      annotated.sort((a, b) => {
        if (a.verified !== b.verified) {
          if (a.verified === true) return -1;
          if (b.verified === true) return 1;
        }
        return b.fc.viewports.size - a.fc.viewports.size;
      });
      // When verification data is available, drop ✗ rows by default —
      // they're rules whose computed value already matches baseline, so
      // the agent has no reason to look at them. `--show-unverified`
      // restores them for debugging.
      const displayed = verificationAvailable && !showUnverified
        ? annotated.filter((a) => a.verified === true)
        : annotated;
      const hiddenCount = annotated.length - displayed.length;

      if (displayed.length > 0) {
        lines.push(verificationAvailable
          ? "### Heuristic fix candidates (collapsed across viewports — ✓ verified)"
          : "### Heuristic fix candidates (collapsed across viewports)");
        lines.push("");
        lines.push("> The tool flags `selector { property }` pairs whose declaration " +
          "matches each viewport's dominant category. These are *hints*; trust your " +
          "eyes (or the verified computed-style section below) for the real delta.");
        lines.push("");
        if (verificationAvailable) {
          lines.push("| Selector | Property | Viewports | Verified? |");
          lines.push("|---|---|---|---|");
        } else {
          lines.push("| Selector | Property | Viewports |");
          lines.push("|---|---|---|");
        }
        for (const { fc, verified } of displayed.slice(0, 12)) {
          const marker = verified === true ? "✓" : verified === false ? "✗" : null;
          if (marker !== null) {
            lines.push(`| \`${fc.selector}\` | \`${fc.property}\` | ${fc.viewports.size} | ${marker} |`);
          } else {
            lines.push(`| \`${fc.selector}\` | \`${fc.property}\` | ${fc.viewports.size} |`);
          }
        }
        if (verificationAvailable && !showUnverified && hiddenCount > 0) {
          lines.push("");
          lines.push(`_${hiddenCount} unverified candidate(s) hidden. Pass \`--show-unverified\` to see them._`);
        }
        lines.push("");
      } else if (verificationAvailable && !showUnverified && annotated.length > 0) {
        lines.push("### Heuristic fix candidates");
        lines.push("");
        lines.push(`_All ${annotated.length} heuristic candidate(s) for this run are unverified (computed value matches baseline). The diff is elsewhere — see the verified-deltas sections below. Pass \`--show-unverified\` to see the unverified rows anyway._`);
        lines.push("");
      }
    }

    lines.push(`### Worst-diff viewport${maxViewports === 1 ? "" : "s"} (open these PNGs side-by-side)`);
    lines.push("");
    const worst = sorted.slice(0, maxViewports);
    for (const r of worst) {
      const paths = viewportImagePaths(report.baseline, variantFile, r.viewport, outputDir);
      lines.push(`#### \`${r.viewport}\` — ${formatPct(r.diffRatio)}`);
      lines.push("");
      lines.push(`- Baseline: \`${paths.baseline}\``);
      lines.push(`- Current : \`${paths.current}\``);
      lines.push(`- Heatmap : \`${paths.heatmap}\``);
      lines.push("");
    }

    const dpPvSummary = (report.domPositionDiffPerViewport ?? []).find((d) => d.variantFile === variantFile);
    if (dpPvSummary && dpPvSummary.result.totalDiffs > 0) {
      lines.push("### Verified deltas by DOM position × viewport (catches media-query gaps)");
      lines.push("");
      const viewportCount = dpPvSummary.result.byViewport.length;
      const pairs = dpPvSummary.result.byPathProperty;
      const universal = pairs.filter((p) => p.viewports.length === viewportCount).length;
      const gated = pairs.length - universal;
      lines.push(`Total: **${dpPvSummary.result.totalDiffs}** tuples across **${viewportCount}** viewport(s).` +
        ` ${universal} (path, property) pair(s) differ on *every* viewport (most likely a base CSS rule);` +
        ` **${gated}** differ on only a subset (likely media-query-gated).`);
      lines.push("");

      lines.push("#### Universal deltas (apply on every viewport — fix the base rule)");
      lines.push("");
      // Cap at 30 (was 20) — increases the chance that interesting
      // properties like letter-spacing / line-height (with em annotations)
      // appear in the rendered table instead of being pushed past the cap
      // by the more numerous border-color / padding rows.
      const universalAll = pairs.filter((p) => p.viewports.length === viewportCount);
      const universalPairs = universalAll.slice(0, 30);
      const hiddenUniversal = universalAll.length - universalPairs.length;
      if (universalPairs.length > 0) {
        lines.push("| Position | Baseline class | Variant class | Property | Baseline | Variant |");
        lines.push("|---|---|---|---|---|---|");
        for (const pp of universalPairs) {
          const sample = pp.samples[0]!;
          const bcls = pp.baselineClasses || "_(none)_";
          const vcls = pp.variantClasses || "_(none)_";
          const ctxSuffix = displayCoercionSuffix(pp.property, pp.parentDisplayContext);
          const baselineLabel = formatValueWithEm(sample.baseline, sample.baselineEm);
          const variantLabel = formatValueWithEm(sample.variant, sample.variantEm) + ctxSuffix;
          lines.push(`| \`${pp.path}\` | \`${bcls}\` | \`${vcls}\` | \`${pp.property}\` | ${baselineLabel} | ${variantLabel} |`);
        }
      } else {
        lines.push("_(none)_");
      }
      if (hiddenUniversal > 0) {
        lines.push("");
        lines.push(`_…${hiddenUniversal} more universal pair(s) below the top 30. See ` +
          "`domPositionDiffPerViewport.byPathProperty` in the JSON report._");
      }
      lines.push("");

      // Em-relative properties get a dedicated sub-section — they're
      // important (one `em` rule manifests as N different px values across
      // elements with different font-sizes) but tend to sort below the
      // top-30 universal cap, dominated by border/padding rows.
      const EM_PROPS = new Set(["letter-spacing", "word-spacing", "line-height"]);
      const emPairs = pairs.filter((p) => EM_PROPS.has(p.property)).slice(0, 15);
      if (emPairs.length > 0) {
        lines.push("#### Em-relative properties (one `em` rule may produce different px values per element)");
        lines.push("");
        lines.push("Check whether the px values, normalized to em via each " +
          "element's own font-size, all agree — if they do, the source is a " +
          "single em-form rule covering multiple elements.");
        lines.push("");
        lines.push("| Position | Class (baseline → variant) | Property | Baseline | Variant |");
        lines.push("|---|---|---|---|---|");
        for (const pp of emPairs) {
          const sample = pp.samples[0]!;
          const bcls = pp.baselineClasses || "_(none)_";
          const vcls = pp.variantClasses || "_(none)_";
          const baselineLabel = formatValueWithEm(sample.baseline, sample.baselineEm);
          const variantLabel = formatValueWithEm(sample.variant, sample.variantEm);
          lines.push(`| \`${pp.path}\` | \`${bcls}\` → \`${vcls}\` | \`${pp.property}\` | ${baselineLabel} | ${variantLabel} |`);
        }
        lines.push("");
      }

      if (gated > 0) {
        lines.push("#### Breakpoint-gated deltas (likely a missing / wrong `@media` rule)");
        lines.push("");
        const gatedPairs = pairs.filter((p) => p.viewports.length < viewportCount).slice(0, 20);
        lines.push("| Position | Baseline class | Variant class | Property | Affected viewports | Sample baseline → variant |");
        lines.push("|---|---|---|---|---|---|");
        for (const pp of gatedPairs) {
          const bcls = pp.baselineClasses || "_(none)_";
          const vcls = pp.variantClasses || "_(none)_";
          const vps = pp.viewports.join(", ");
          // Show the first sample's values; samples may differ across viewports.
          const sample = pp.samples[0]!;
          const ctxSuffix = displayCoercionSuffix(pp.property, pp.parentDisplayContext);
          const baselineLabel = formatValueWithEm(sample.baseline, sample.baselineEm);
          const variantLabel = formatValueWithEm(sample.variant, sample.variantEm);
          lines.push(`| \`${pp.path}\` | \`${bcls}\` | \`${vcls}\` | \`${pp.property}\` | ${vps} | ${baselineLabel} → ${variantLabel}${ctxSuffix} |`);
        }
        lines.push("");
      }

      if (dpPvSummary.result.byViewport.length > 0) {
        lines.push("Per-viewport totals (worst first):");
        for (const v of dpPvSummary.result.byViewport.slice(0, 8)) {
          lines.push(`- \`${v.viewport}\` — ${v.count} tuple(s)`);
        }
        lines.push("");
      }
    }

    const dpSummary = (report.domPositionDiff ?? []).find((d) => d.variantFile === variantFile);
    if (dpSummary && dpSummary.result.totalDiffs > 0) {
      lines.push("### Verified deltas by DOM position (class-rename-aware)");
      lines.push("");
      lines.push(`Total tuples: **${dpSummary.result.totalDiffs}** across ${dpSummary.result.byPath.length} ` +
        "element position(s). Each row pairs the same tree position in baseline vs variant — " +
        "robust to class renames (`.card` → `.luna-panel`).");
      lines.push("");
      const dpEntries = dpSummary.result.entries ?? [];
      if (dpEntries.length > 0) {
        lines.push("| Position | Baseline class | Variant class | Property | Baseline | Variant |");
        lines.push("|---|---|---|---|---|---|");
        for (const e of dpEntries.slice(0, 25)) {
          const bcls = e.baselineClasses || "_(none)_";
          const vcls = e.variantClasses || "_(none)_";
          const ctxSuffix = displayCoercionSuffix(e.property, e.parentDisplayContext);
          lines.push(`| \`${e.path}\` | \`${bcls}\` | \`${vcls}\` | \`${e.property}\` | \`${e.baseline}\` | \`${e.variant}\`${ctxSuffix} |`);
        }
        if (dpEntries.length > 25) {
          lines.push(`| _…${dpEntries.length - 25} more rows_ | | | | | |`);
        }
        lines.push("");
      }
      const topPaths = dpSummary.result.byPath.slice(0, 8);
      if (topPaths.length > 0) {
        lines.push("Top positions (most divergent elements):");
        for (const p of topPaths) {
          const bcls = p.baselineClasses || "(none)";
          const vcls = p.variantClasses || "(none)";
          lines.push(`- \`${p.path}\` — baseline \`${bcls}\` vs variant \`${vcls}\` — ${p.count} property change(s)`);
        }
        lines.push("");
      }
      if (dpSummary.result.pathsOnlyInBaseline.length > 0 || dpSummary.result.pathsOnlyInVariant.length > 0) {
        lines.push(`_Structural drift_: ${dpSummary.result.pathsOnlyInBaseline.length} path(s) only in baseline, ` +
          `${dpSummary.result.pathsOnlyInVariant.length} only in variant.`);
        lines.push("");
      }
    }

    if (csdSummary && csdSummary.result.totalDiffs > 0) {
      lines.push("### Verified deltas (computed-style)");
      lines.push("");
      lines.push(`Total differing (selector, property) tuples: **${csdSummary.result.totalDiffs}**. ` +
        "Each row is a real computed-style mismatch (the baseline rendered with one value, " +
        "the variant with another) — trust this section over the heuristic candidates above.");
      lines.push("");
      const entries = csdSummary.result.entries ?? [];
      if (entries.length > 0) {
        lines.push("| Selector | Property | Baseline | Variant |");
        lines.push("|---|---|---|---|");
        for (const e of entries.slice(0, 15)) {
          lines.push(`| \`${e.selector}\` | \`${e.property}\` | \`${e.baseline}\` | \`${e.variant}\` |`);
        }
        if (entries.length > 15) {
          lines.push(`| _…${entries.length - 15} more rows_ | | | |`);
        }
        lines.push("");
      }
      const topProps = csdSummary.result.byProperty.slice(0, 8);
      if (topProps.length > 0) {
        lines.push("Top properties:");
        for (const p of topProps) {
          lines.push(`- \`${p.property}\` — ${p.count} selector(s)`);
        }
        lines.push("");
      }
      const topSelectors = csdSummary.result.bySelector.slice(0, 8);
      if (topSelectors.length > 0) {
        lines.push("Top selectors:");
        for (const s of topSelectors) {
          lines.push(`- \`${s.selector}\` — ${s.count} property change(s)`);
        }
        lines.push("");
      }
    }

    // Scenario detector. The current "Suggested next step" wording
    // assumes the migration scenario (read PNGs → cross-check fix
    // candidates → write CSS patch). Subagent F's eval showed that
    // when DOM trees diverge — the wireframe / from-screenshot case —
    // those steps yield empty results and the agent regresses to ad-hoc
    // pngjs probes. Detect which signal family is non-empty and pick
    // the corresponding playbook.
    const hasDomSignal =
      (dpSummary?.result.totalDiffs ?? 0) > 0 ||
      (csdSummary?.result.totalDiffs ?? 0) > 0 ||
      (csdPerVpSummary?.result.totalDiffs ?? 0) > 0 ||
      fixCandidates.length > 0;
    const hasWireframeSignal =
      (bboxSummary?.perViewport.length ?? 0) > 0 ||
      (geometrySummary?.profiles.length ?? 0) > 0 ||
      (heatmapSummary?.perViewport.length ?? 0) > 0 ||
      (textRowsSummary?.perViewport.length ?? 0) > 0 ||
      (paletteSummary?.perViewport.length ?? 0) > 0;
    const wireframeMode = !hasDomSignal && hasWireframeSignal;

    lines.push("### Suggested next step");
    lines.push("");
    if (wireframeMode) {
      lines.push("_Wireframe / from-screenshot mode detected: no DOM correspondence " +
        "between baseline and variant — DOM-position-diff, computed-style-diff, " +
        "and fix-candidate sections are empty. Use the image-only signals._");
      lines.push("");
      lines.push("1. Open the heatmap PNG and locate each region cluster from the " +
        "table above — these are the *only* areas the variant differs from the " +
        "target. Diffs outside those rectangles can be ignored.");
      lines.push("2. For each cluster, match it to a baseline component bbox " +
        "(top/left/size). The Δ column tells you whether the variant element is " +
        "too small / too big / displaced.");
      lines.push("3. Cross-check the cross-viewport geometry table: if a row has " +
        "large baseline spread and ~0 variant spread, you're missing a responsive " +
        "rule (typically `max-width`, `width: 100%`, or an `@media` block) — " +
        "not a fixed-pixel correction.");
      lines.push("4. If the text-row table shows a count mismatch (e.g. baseline " +
        "has 6 bands, variant has 4), you're missing rows of content — add the " +
        "missing HTML elements before tweaking CSS.");
      lines.push("5. Write the missing HTML elements first (the bbox table tells " +
        "you their target dimensions), then the CSS rules. Re-run `vrt compare` " +
        "and check that bbox deltas + heatmap regions + text-row Δy all shrink " +
        "toward zero.");
    } else {
      lines.push("1. Read baseline + current PNGs side-by-side and enumerate visible deltas " +
        "(font / colors / spacing / radius / shadow / gradient / typography).");
      lines.push("2. Cross-check against the fix-candidate table — it identifies *which* " +
        "selectors differ but may name the wrong property; trust your eyes for the " +
        "actual property.");
      lines.push("3. Write one CSS patch covering the deltas, re-run `vrt compare`, " +
        "and check that the dominant category count drops to zero on every viewport.");
    }
    lines.push("");
  }

  return lines.join("\n");
}
