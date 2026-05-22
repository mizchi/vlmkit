import { basename } from "node:path";
import {
  extractCss,
  parseCssDeclarations,
  replaceCss,
} from "../css-challenge/css-challenge-core.ts";
import type { MigrationDiffCategory } from "./migration-diff.ts";
import type { MigrationFixCandidate } from "./migration-fix-candidates.ts";
import { isPlaywrightSandboxRestrictionError } from "@mizchi/vlmkit-capture/playwright-launch-error.ts";
import type { ViewportSpec } from "@mizchi/vlmkit-capture/viewport-discovery.ts";

export interface MigrationCompareReportResult {
  variant: string;
  variantFile?: string;
  viewport: string;
  diffRatio: number;
  diffPixels: number;
  approved?: boolean;
  partiallyApproved?: boolean;
  dominantCategory: MigrationDiffCategory | "none";
  categorySummary: string;
  paintTreeSummary: string;
  paintTreeChangeCount: number;
  fixCandidates: MigrationFixCandidate[];
}

export interface MigrationCompareReport {
  dir?: string;
  baseline: string;
  variants: string[];
  viewports: ViewportSpec[];
  approvalPath?: string;
  strict?: boolean;
  paintTree?: {
    enabled: boolean;
    available: boolean;
    url?: string;
    error?: string;
  };
  /** Per-variant computed-style diff: { selector, property, baseline, variant }. */
  computedStyleDiff?: Array<{
    variantFile: string;
    result?: { entries?: Array<{ selector: string; property: string; baseline: string; variant: string }> };
  }>;
  /** Per-viewport, per-element computed-style diff via DOM-position match. */
  domPositionDiffPerViewport?: Array<{
    variantFile: string;
    result?: { entries?: Array<{ path: string; baselineClasses?: string; variantClasses?: string; property: string; baseline: string; variant: string; viewport: string }> };
  }>;
  results: MigrationCompareReportResult[];
}

export interface MigrationFix {
  selector: string;
  property: string;
  value: string;
  mediaCondition: string | null;
}

export interface SelectedMigrationFixTarget extends MigrationCompareReportResult {
  variantFile: string;
  viewportWidth: number;
}

export type MigrationConvergenceStatus = "clean" | "approved" | "remaining";

export interface MigrationVariantConvergence {
  variant: string;
  totalResults: number;
  cleanResults: number;
  approvedResults: number;
  remainingResults: number;
  status: MigrationConvergenceStatus;
}

export interface MigrationReportConvergence {
  totalResults: number;
  cleanResults: number;
  approvedResults: number;
  remainingResults: number;
  status: MigrationConvergenceStatus;
  variants: MigrationVariantConvergence[];
}

export function selectMigrationFixTarget(
  report: MigrationCompareReport,
  options: { variant?: string } = {},
): SelectedMigrationFixTarget | null {
  const filtered = report.results
    .filter((result) => result.diffPixels > 0)
    .filter((result) => !options.variant || result.variant === options.variant || result.variantFile === options.variant)
    .sort((left, right) => {
      if (right.diffPixels !== left.diffPixels) return right.diffPixels - left.diffPixels;
      if (right.paintTreeChangeCount !== left.paintTreeChangeCount) {
        return right.paintTreeChangeCount - left.paintTreeChangeCount;
      }
      if (right.fixCandidates.length !== left.fixCandidates.length) {
        return right.fixCandidates.length - left.fixCandidates.length;
      }
      return right.diffRatio - left.diffRatio;
    });

  const target = filtered[0];
  if (!target) return null;
  return {
    ...target,
    variantFile: resolveVariantFile(report, target),
    viewportWidth: report.viewports.find((viewport) => viewport.label === target.viewport)?.width ?? 0,
  };
}

export function summarizeMigrationReportConvergence(
  report: MigrationCompareReport,
): MigrationReportConvergence {
  const variants = [...new Set(report.results.map((result) => result.variant))]
    .map((variant) => summarizeMigrationVariantConvergence(
      variant,
      report.results.filter((result) => result.variant === variant),
    ));

  const cleanResults = variants.reduce((sum, variant) => sum + variant.cleanResults, 0);
  const approvedResults = variants.reduce((sum, variant) => sum + variant.approvedResults, 0);
  const remainingResults = variants.reduce((sum, variant) => sum + variant.remainingResults, 0);

  return {
    totalResults: report.results.length,
    cleanResults,
    approvedResults,
    remainingResults,
    status: summarizeConvergenceStatus(cleanResults, approvedResults, remainingResults),
    variants,
  };
}

export function buildMigrationFixLoopPrompt(input: {
  baselineFile: string;
  variantFile: string;
  target: SelectedMigrationFixTarget;
  currentCss: string;
}): string {
  const candidateLines = input.target.fixCandidates.length === 0
    ? ["(no heuristic candidates)"]
    : input.target.fixCandidates.slice(0, 5).map((candidate, index) => {
      const mediaSuffix = candidate.mediaCondition ? ` @media ${candidate.mediaCondition}` : "";
      return `${index + 1}. ${candidate.selector} { ${candidate.property}: ${candidate.value}; }${mediaSuffix} [score=${candidate.score}; ${candidate.reasoning}]`;
    });

  return `You are fixing a CSS migration regression.

Baseline file: ${input.baselineFile}
Current file: ${input.variantFile}
Viewport: ${input.target.viewport} (${input.target.viewportWidth}px)
Diff ratio: ${(input.target.diffRatio * 100).toFixed(2)}%
Diff pixels: ${input.target.diffPixels}
Dominant category: ${input.target.dominantCategory}
Category summary: ${input.target.categorySummary}
Paint tree summary: ${input.target.paintTreeSummary}

Top fix candidates:
${candidateLines.join("\n")}

Current CSS:
\`\`\`css
${input.currentCss}
\`\`\`

Task:
Return exactly one CSS declaration change for the current stylesheet that is most likely to reduce this regression.
Prefer one of the candidate selectors/properties when possible.
If the fix should apply only inside a media query, return the matching media condition.

Respond in this EXACT format:
SELECTOR: <css selector>
PROPERTY: <css property>
VALUE: <css value>
MEDIA: <media condition or none>`;
}

export function parseMigrationFixResponse(response: string): MigrationFix | null {
  const selectorMatch = response.match(/SELECTOR:\s*(.+)/);
  const propertyMatch = response.match(/PROPERTY:\s*(.+)/);
  const valueMatch = response.match(/VALUE:\s*(.+)/);
  if (!selectorMatch || !propertyMatch || !valueMatch) return null;
  const mediaMatch = response.match(/MEDIA:\s*(.+)/);
  const mediaValue = mediaMatch?.[1]?.trim() ?? "none";
  return {
    selector: selectorMatch[1].trim(),
    property: propertyMatch[1].trim(),
    value: valueMatch[1].trim(),
    mediaCondition: mediaValue === "none" ? null : mediaValue,
  };
}

/**
 * Multi-fix prompt for `migration-fix-loop --max-fixes N`. Same context as
 * the single-fix prompt but asks for up to N JSON-shaped fix proposals,
 * which lets the LLM emit every high-confidence universal pair the diff
 * report surfaced rather than one declaration per round-trip.
 */
export function buildMigrationFixLoopMultiPrompt(input: {
  baselineFile: string;
  variantFile: string;
  target: SelectedMigrationFixTarget;
  currentCss: string;
  maxFixes: number;
  /** Authoritative baseline values from the diff report, used to ground LLM proposals. */
  baselineValueIndex?: BaselineValueIndex;
}): string {
  const candidateLines = input.target.fixCandidates.length === 0
    ? ["(no heuristic candidates)"]
    : input.target.fixCandidates.slice(0, 12).map((candidate, index) => {
      const mediaSuffix = candidate.mediaCondition ? ` @media ${candidate.mediaCondition}` : "";
      return `${index + 1}. ${candidate.selector} { ${candidate.property}: ${candidate.value}; }${mediaSuffix} [score=${candidate.score}; ${candidate.reasoning}]`;
    });

  // Pull report-grounded "baseline value table" rows so the LLM never has
  // to hallucinate a value — it can copy verbatim from the table when the
  // (selector, property) pair already has a recorded baseline.
  //
  // Filter out dom-position pseudo-selectors (`.page>header[1]`,
  // `>nav[1]`, etc.) — the report generates those when an element has
  // no class, but they aren't valid CSS selectors a fix can target.
  const isAuthoredCssSelector = (selector: string): boolean => {
    if (!selector) return false;
    if (/[>\[\]]/.test(selector)) return false; // child combinator + bracket = path-style
    if (/^\.[A-Za-z][\w-]*(\.[A-Za-z][\w-]*)*$/.test(selector)) return true; // .class or .class.class
    if (/^#[A-Za-z][\w-]*$/.test(selector)) return true; // #id
    if (/^[a-zA-Z][\w-]*$/.test(selector)) return true; // tag
    return false;
  };

  // Properties that are typically authored vs. computed-layout byproducts.
  // We only present authored-style properties in the prompt table because
  // values like `.page { height: 1334.41px }` come from the layout pass,
  // not the stylesheet — hard-coding them overconstrains the page.
  const AUTHORED_PROPERTIES = new Set([
    "color", "background-color", "border-color",
    "border-top-color", "border-right-color", "border-bottom-color", "border-left-color",
    "background", "border", "outline-color", "fill",
    "padding", "padding-top", "padding-right", "padding-bottom", "padding-left",
    "margin", "margin-top", "margin-right", "margin-bottom", "margin-left",
    "gap", "row-gap", "column-gap",
    "font-size", "font-weight", "font-family", "line-height", "letter-spacing",
    "text-align", "text-transform", "text-decoration",
    "border-radius", "border-width", "border-style",
    "opacity", "visibility", "display", "flex-direction", "justify-content", "align-items",
    "box-shadow",
    // Grid / layout structural properties — pixel-explicit but typically
    // hand-authored (e.g. `grid-template-columns: 72px 268px minmax(0, 1fr)`).
    "grid-template-columns", "grid-template-rows", "grid-template-areas",
    "grid-auto-columns", "grid-auto-rows", "grid-auto-flow",
    "grid-column", "grid-row", "grid-column-start", "grid-row-start",
    "flex", "flex-basis", "flex-grow", "flex-shrink", "flex-wrap",
    "aspect-ratio", "place-items", "place-content", "place-self",
    "align-content", "align-self", "justify-self", "justify-items",
  ]);
  const isAuthoredProperty = (property: string): boolean => AUTHORED_PROPERTIES.has(property);

  const reportTableLines: string[] = [];
  if (input.baselineValueIndex) {
    const variantMap = input.baselineValueIndex.variantValues;
    // Collect global rows (one entry per (selector, property) that has the
    // SAME baseline value at every recorded viewport — safe to apply
    // universally without media gating). Annotate with the variant value
    // so the LLM can self-filter pairs where variant already matches
    // baseline (those are no-ops).
    type Row = { selector: string; property: string; baseline: string; variant: string | null };
    const rows: Row[] = [];
    for (const [key, baseline] of input.baselineValueIndex.global) {
      const sep = key.lastIndexOf(" ");
      const selector = key.slice(0, sep);
      const property = key.slice(sep + 1);
      if (!isAuthoredCssSelector(selector)) continue;
      if (!isAuthoredProperty(property)) continue;
      const variant = variantMap.get(key) ?? null;
      if (variant !== null && variant === baseline) continue; // already in sync
      rows.push({ selector, property, baseline, variant });
    }
    // Viewport-variant pairs — different baseline values across viewports.
    // List them separately so the LLM knows they need explicit media
    // conditions instead of being applied universally.
    type VariantRow = { selector: string; property: string; values: string[] };
    const variantRows: VariantRow[] = [];
    for (const [key, values] of input.baselineValueIndex.viewportVariant) {
      const sep = key.lastIndexOf(" ");
      const selector = key.slice(0, sep);
      const property = key.slice(sep + 1);
      if (!isAuthoredCssSelector(selector)) continue;
      if (!isAuthoredProperty(property)) continue;
      variantRows.push({ selector, property, values: [...values] });
    }
    const top = rows.slice(0, 24);
    if (top.length > 0) {
      reportTableLines.push("");
      reportTableLines.push(`Report-authoritative baseline values (${top.length} of ${rows.length} authored-property pairs):`);
      for (const r of top) {
        const variantSuffix = r.variant !== null ? ` (variant=\`${r.variant}\`)` : "";
        reportTableLines.push(`  ${r.selector} { ${r.property} } → baseline=\`${r.baseline}\`${variantSuffix}`);
      }
      reportTableLines.push("Rules: (a) copy the baseline value VERBATIM when proposing a fix; (b) only use real CSS selectors (no `.parent>tag[1]` path syntax); (c) only target authored properties — never computed layout dimensions like \`height: 1334.41px\`; (d) if `variant` already equals `baseline`, skip — that pair is already in sync.");
    }
    if (variantRows.length > 0) {
      const topVariant = variantRows.slice(0, 12);
      reportTableLines.push("");
      reportTableLines.push(`Viewport-variant pairs (${topVariant.length} of ${variantRows.length} — same selector/property has DIFFERENT baselines per viewport):`);
      for (const v of topVariant) {
        reportTableLines.push(`  ${v.selector} { ${v.property} } → values=${v.values.map((x) => `\`${x}\``).join(" | ")}`);
      }
      reportTableLines.push("These MUST be media-gated. Setting `mediaCondition: null` for a viewport-variant pair will be REJECTED by the apply step — fix one viewport at a time with the matching media condition.");
    }
  }

  return `You are fixing a CSS migration regression.

Baseline file: ${input.baselineFile}
Current file: ${input.variantFile}
Viewport: ${input.target.viewport} (${input.target.viewportWidth}px)
Diff ratio: ${(input.target.diffRatio * 100).toFixed(2)}%
Diff pixels: ${input.target.diffPixels}
Dominant category: ${input.target.dominantCategory}
Category summary: ${input.target.categorySummary}
Paint tree summary: ${input.target.paintTreeSummary}

Top fix candidates:
${candidateLines.join("\n")}
${reportTableLines.join("\n")}

Current CSS:
\`\`\`css
${input.currentCss}
\`\`\`

Task:
Return up to ${input.maxFixes} high-confidence CSS declaration changes that together would reduce this regression. Prefer (selector, property) pairs that appear in the "Report-authoritative baseline values" table above — those have a known correct value you can copy verbatim. Avoid inventing new structural changes when a value-only fix is available.

Viewport gating (CRITICAL):
- The target viewport above (\`${input.target.viewport}\`, ${input.target.viewportWidth}px) is the WORST viewport — the other viewports may render correctly.
- If a fix is only meaningful at \`${input.target.viewport}\` (e.g. a layout change for ${input.target.viewportWidth <= 600 ? "mobile" : input.target.viewportWidth <= 1100 ? "desktop" : "wide"} only), wrap it in an appropriate media condition.
- Use \`"mediaCondition": "(max-width: 700px)"\` for mobile-only, \`"(min-width: 980px)"\` for desktop, \`"(min-width: 1200px)"\` for wide. Use \`null\` ONLY for true universal pairs that should apply everywhere.
- A base-CSS change that fixes mobile but breaks desktop is worse than no change.

Output VALID JSON with this exact shape — no prose, no markdown fences:
{
  "fixes": [
    { "selector": "<css selector>", "property": "<css property>", "value": "<css value>", "mediaCondition": null | "<media condition>" }
  ]
}`;
}

/**
 * Index of authoritative baseline (target) values from the migration
 * report, keyed by `${selector} ${property}` and optionally
 * `${selector} ${property} ${viewport}`. Used to correct LLM
 * proposals whose `value` field hallucinated a literal — the report
 * already knows what the target rendered, so we swap the LLM's
 * proposal-value for the reported baseline.
 */
export interface BaselineValueIndex {
  /** `(selector, property)` → universal baseline value (same at every viewport that recorded it). */
  global: Map<string, string>;
  /** `(selector, property, viewport)` → per-viewport baseline value. */
  byViewport: Map<string, string>;
  /**
   * `(selector, property)` pairs where different viewports recorded
   * different baseline values. These MUST NOT be applied universally —
   * either gate them with the matching media condition or drop them.
   * Maps to the set of distinct values observed (for debugging).
   */
  viewportVariant: Map<string, Set<string>>;
  /**
   * `(selector, property)` → variant-side value (the value currently
   * rendered, before any fix). Used to detect no-op proposals where the
   * LLM/heuristic suggests a value that's already matching the variant.
   */
  variantValues: Map<string, string>;
}

function classListToSelectors(classList: string | undefined): string[] {
  if (!classList) return [];
  const tokens = classList.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];
  const selectors: string[] = [];
  // Each single class
  for (const t of tokens) selectors.push(`.${t}`);
  // Joined combo (matches the snapshot-key shape used elsewhere)
  if (tokens.length > 1) selectors.push(`.${tokens.join(".")}`);
  return selectors;
}

export function buildBaselineValueIndex(
  report: MigrationCompareReport,
  variantFile?: string,
): BaselineValueIndex {
  // First pass: collect every observed (selector, property, viewport)
  // tuple and aggregate distinct values per (selector, property).
  const byViewport = new Map<string, string>();
  const observed = new Map<string, Set<string>>();
  const variantValues = new Map<string, string>();
  const observeValue = (key: string, value: string) => {
    let set = observed.get(key);
    if (!set) {
      set = new Set();
      observed.set(key, set);
    }
    set.add(value);
  };
  const observeVariant = (key: string, value: string) => {
    if (!variantValues.has(key)) variantValues.set(key, value);
  };
  const csd = report.computedStyleDiff ?? [];
  for (const block of csd) {
    if (variantFile && block.variantFile !== variantFile) continue;
    for (const e of block.result?.entries ?? []) {
      const key = `${e.selector} ${e.property}`;
      observeValue(key, e.baseline);
      observeVariant(key, e.variant);
    }
  }
  const dpv = report.domPositionDiffPerViewport ?? [];
  for (const block of dpv) {
    if (variantFile && block.variantFile !== variantFile) continue;
    for (const e of block.result?.entries ?? []) {
      const selectors = [
        ...classListToSelectors(e.baselineClasses),
        ...classListToSelectors(e.variantClasses),
      ];
      for (const sel of selectors) {
        const key = `${sel} ${e.property}`;
        observeValue(key, e.baseline);
        observeVariant(key, e.variant);
        byViewport.set(`${key} ${e.viewport}`, e.baseline);
      }
    }
  }

  // Second pass: promote single-value pairs to `global` (safe to apply
  // universally); collect multi-value pairs into `viewportVariant` so
  // callers can either gate them with media conditions or skip them.
  const global = new Map<string, string>();
  const viewportVariant = new Map<string, Set<string>>();
  for (const [key, values] of observed) {
    if (values.size === 1) {
      global.set(key, values.values().next().value as string);
    } else {
      viewportVariant.set(key, values);
    }
  }
  return { global, byViewport, viewportVariant, variantValues };
}

export interface CorrectionResult {
  fixes: MigrationFix[];
  corrections: Array<{ selector: string; property: string; from: string; to: string }>;
  dropped: Array<{ selector: string; property: string; reason: string }>;
}

/**
 * Walk LLM-proposed fixes and, when the report carries an authoritative
 * baseline value for the (selector, property) pair, override the LLM's
 * `value` with the reported baseline. Returns the corrected list plus a
 * trail of {from, to} entries so the caller can log what was swapped.
 *
 * Goal: protect against LLM hallucinations like `font: 800 48px/1
 * Georgia, serif` when the report only knows specific computed
 * sub-properties.
 */
function isAuthoredCssSelectorForFix(selector: string): boolean {
  if (!selector) return false;
  // Path-style selectors from the report (`.parent>tag[1]`, `>nav[1]`,
  // `body[0]>div[0]`, etc.) are diagnostic identifiers, not writable CSS.
  if (/[>\[\]]/.test(selector)) return false;
  return true;
}

const COMPUTED_LAYOUT_PROPERTIES = new Set([
  "width", "height", "min-width", "min-height", "max-width", "max-height",
  "top", "right", "bottom", "left",
]);

function isAuthoredCssPropertyForFix(property: string): boolean {
  if (!property) return false;
  // Computed-layout dimensions (width/height/etc.) carry sub-pixel rendered
  // values that aren't valid authored CSS. Allow them only when paired with
  // a baseline that looks token-shaped (handled at the value-check layer).
  if (COMPUTED_LAYOUT_PROPERTIES.has(property)) return false;
  return true;
}

/**
 * Read the current value of `(selector, property)` from a CSS source.
 * Returns null when the rule doesn't exist at the matching media scope.
 */
export function readExistingCssValue(
  css: string,
  fix: Pick<MigrationFix, "selector" | "property" | "mediaCondition">,
): string | null {
  const blocks = scanCssBlocks(css);
  const target = normalizeSelectorWhitespace(fix.selector);
  const escaped = fix.property.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
  const declRe = new RegExp(`(?:^|[\\s;])${escaped}\\s*:\\s*([^;}]+)`, "i");
  for (const block of blocks) {
    if (normalizeSelectorWhitespace(block.selector) !== target) continue;
    if ((block.mediaCondition ?? null) !== fix.mediaCondition) continue;
    const body = css.slice(block.bodyStart, block.bodyEnd);
    const m = declRe.exec(body);
    if (m) return m[1].trim();
  }
  return null;
}

export function correctMigrationFixesWithReport(
  fixes: MigrationFix[],
  index: BaselineValueIndex,
  options: { viewport?: string; currentCss?: string } = {},
): CorrectionResult {
  const corrections: CorrectionResult["corrections"] = [];
  const dropped: CorrectionResult["dropped"] = [];
  const out: MigrationFix[] = [];
  for (let fix of fixes) {
    if (!fix.selector || !fix.property || !fix.value) {
      dropped.push({ selector: fix.selector, property: fix.property, reason: "missing field" });
      continue;
    }
    if (!isAuthoredCssSelectorForFix(fix.selector)) {
      dropped.push({ selector: fix.selector, property: fix.property, reason: "path-style selector (not writable CSS)" });
      continue;
    }
    if (!isAuthoredCssPropertyForFix(fix.property)) {
      dropped.push({ selector: fix.selector, property: fix.property, reason: "computed-layout property (e.g. height/width) is not a stable authored value" });
      continue;
    }
    const globalKey = `${fix.selector} ${fix.property}`;
    // Viewport-variant pairs (same selector/property but different baselines
    // across viewports) MUST NOT be applied universally — that's the
    // expressive-menu regression pattern. Require a media condition.
    if (!fix.mediaCondition && index.viewportVariant.has(globalKey)) {
      dropped.push({
        selector: fix.selector,
        property: fix.property,
        reason: "viewport-variant baseline (different value per viewport) requires media gating",
      });
      continue;
    }
    const viewportKey = options.viewport ? `${globalKey} ${options.viewport}` : null;
    const baseline = (viewportKey && index.byViewport.get(viewportKey)) ?? index.global.get(globalKey);
    if (baseline && baseline !== fix.value) {
      corrections.push({ selector: fix.selector, property: fix.property, from: fix.value, to: baseline });
      // Use the corrected value for the rest of the no-op check below.
      fix = { ...fix, value: baseline };
    }
    // No-op pre-filter: if the proposed value already matches what's in
    // currentCss, applying it is wasted apply-step work (and confuses the
    // "skipped — selector not in writable CSS" count). Drop it.
    if (options.currentCss) {
      const existing = readExistingCssValue(options.currentCss, fix);
      if (existing !== null && existing === fix.value) {
        dropped.push({
          selector: fix.selector,
          property: fix.property,
          reason: "value already matches current CSS — no-op",
        });
        continue;
      }
    }
    out.push(fix);
  }
  return { fixes: out, corrections, dropped };
}

export function parseMigrationFixMultiResponse(response: string): MigrationFix[] {
  const stripped = response.replace(/^[\s\S]*?({[\s\S]*})[\s\S]*$/, "$1");
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    return [];
  }
  if (!parsed || typeof parsed !== "object") return [];
  const fixesRaw = (parsed as { fixes?: unknown }).fixes;
  if (!Array.isArray(fixesRaw)) return [];
  const fixes: MigrationFix[] = [];
  for (const entry of fixesRaw) {
    if (!entry || typeof entry !== "object") continue;
    const item = entry as Record<string, unknown>;
    const selector = typeof item.selector === "string" ? item.selector.trim() : "";
    const property = typeof item.property === "string" ? item.property.trim() : "";
    const value = typeof item.value === "string" ? item.value.trim() : "";
    if (!selector || !property || !value) continue;
    let mediaCondition: string | null = null;
    const rawMedia = item.mediaCondition;
    if (typeof rawMedia === "string") {
      const trimmed = rawMedia.trim();
      mediaCondition = (trimmed === "" || trimmed.toLowerCase() === "none") ? null : trimmed;
    }
    fixes.push({ selector, property, value, mediaCondition });
  }
  return fixes;
}

/**
 * Extract custom-property declarations from every `:root { ... }` (or
 * `html { ... }`) block in the stylesheet. Returns `Map<--name, value>`.
 * Only the first declaration wins per variable — matches CSS cascade
 * order (later wins) by scanning right-to-left.
 */
export function extractCustomProperties(css: string): Map<string, string> {
  const out = new Map<string, string>();
  const rootBlocks: string[] = [];
  // Match `:root` or `html` selector followed by a brace-balanced body.
  // No leading boundary requirement: blocks back-to-back (`} :root {`) are
  // picked up by allowing the regex to continue past the previous match.
  const blockRe = /(?<![\w-])(?::root|html)\s*\{([\s\S]*?)\}/g;
  let match: RegExpExecArray | null;
  while ((match = blockRe.exec(css)) !== null) {
    rootBlocks.push(match[1]);
  }
  // Walk in document order; later declarations win.
  for (const body of rootBlocks) {
    for (const decl of body.split(";")) {
      const m = decl.match(/^\s*(--[A-Za-z_][\w-]*)\s*:\s*([^;]+)\s*$/);
      if (!m) continue;
      out.set(m[1].trim(), m[2].trim());
    }
  }
  return out;
}

/**
 * Compute the `:root` custom-property diff between baseline and variant
 * HTML. Each differing variable becomes a deterministic `MigrationFix`
 * the apply step can write directly — the LLM never has to "discover"
 * the mismatch because the report's computed-style diff doesn't surface
 * CSS variables (the resolved RGB values appear instead).
 */
export function extractCustomPropertyDiffs(
  baselineHtml: string,
  variantHtml: string,
): MigrationFix[] {
  const baselineCss = extractCss(baselineHtml);
  const variantCss = extractCss(variantHtml);
  if (!baselineCss || !variantCss) return [];
  const baseVars = extractCustomProperties(baselineCss);
  const variantVars = extractCustomProperties(variantCss);
  const fixes: MigrationFix[] = [];
  for (const [name, baseValue] of baseVars) {
    const variantValue = variantVars.get(name);
    if (variantValue === undefined) continue;
    if (variantValue === baseValue) continue;
    fixes.push({
      selector: ":root",
      property: name,
      value: baseValue,
      mediaCondition: null,
    });
  }
  return fixes;
}

export function resolveMigrationFixFromBaselineHtml(
  baselineHtml: string,
  candidate: Pick<MigrationFixCandidate, "selector" | "property" | "mediaCondition">,
): MigrationFix | null {
  const css = extractCss(baselineHtml);
  if (!css) return null;
  const declaration = parseCssDeclarations(css).find((entry) =>
    entry.selector === candidate.selector
    && entry.property === candidate.property
    && entry.mediaCondition === candidate.mediaCondition
  );
  if (!declaration) return null;
  return {
    selector: declaration.selector,
    property: declaration.property,
    value: declaration.value,
    mediaCondition: declaration.mediaCondition,
  };
}

export interface ApplyMigrationFixOptions {
  /**
   * When true, append a brand-new declaration block (or `@media` wrapper)
   * if the (selector, mediaCondition) pair is not already in the stylesheet.
   * Used by the multi-fix path where the LLM may legitimately propose
   * media-gated fixes for which no existing block exists yet.
   */
  appendIfMissing?: boolean;
}

export function applyMigrationFixToHtml(
  html: string,
  fix: MigrationFix,
  options: ApplyMigrationFixOptions = {},
): string {
  const css = extractCss(html);
  if (!css) return html;
  const nextCss = applyMigrationFixToCss(css, fix, options);
  return nextCss === css ? html : replaceCss(html, css, nextCss);
}

/** Collapse internal whitespace + combinator padding so `.a  >  b` and `.a > b` compare equal. */
function normalizeSelectorWhitespace(selector: string): string {
  return selector
    .replace(/\s+/g, " ")
    .replace(/\s*([>+~,])\s*/g, "$1")
    .replace(/,/g, ", ")
    .trim();
}

/**
 * A single style block discovered by `scanCssBlocks` — covers both
 * single-line and multi-line rules at the top level and inside
 * `@media` wrappers.
 */
interface CssBlock {
  selector: string;
  /** Body slice between `{` and `}` (exclusive on both sides). */
  bodyStart: number;
  bodyEnd: number;
  /** Full block slice, `${selector}{...}` inclusive. */
  blockStart: number;
  blockEnd: number;
  mediaCondition: string | null;
}

/**
 * Tokenize the CSS into selector blocks. Handles top-level rules and
 * one level of `@media` nesting. Strings and `/* ... *​/` comments are
 * skipped so braces inside them don't confuse the depth counter.
 */
function scanCssBlocks(css: string): CssBlock[] {
  const blocks: CssBlock[] = [];
  const len = css.length;
  let i = 0;
  let depth = 0;
  let mediaStack: Array<{ condition: string; closeAt: number | null }> = [];
  let selectorStart = -1;

  while (i < len) {
    const ch = css[i];
    // Skip comments
    if (ch === "/" && css[i + 1] === "*") {
      const end = css.indexOf("*/", i + 2);
      i = end === -1 ? len : end + 2;
      continue;
    }
    // Skip strings
    if (ch === '"' || ch === "'") {
      const quote = ch;
      i++;
      while (i < len && css[i] !== quote) {
        if (css[i] === "\\") i += 2;
        else i++;
      }
      i++;
      continue;
    }
    if (ch === "{") {
      // Determine which selector this `{` opens.
      const headRaw = css.slice(selectorStart < 0 ? 0 : selectorStart, i);
      const head = headRaw.trim();
      selectorStart = -1;
      if (depth === 0 && head.startsWith("@media")) {
        // Open a media wrapper. Track its closing brace.
        const condition = head.replace(/^@media\s+/, "").trim();
        mediaStack.push({ condition, closeAt: null });
        depth++;
        i++;
        continue;
      }
      // Otherwise this is a rule. Find matching closing brace.
      const blockStart = headRaw.length === 0 ? i : i - headRaw.length;
      const bodyStart = i + 1;
      let inner = 1;
      let j = i + 1;
      while (j < len && inner > 0) {
        const c = css[j];
        if (c === "/" && css[j + 1] === "*") {
          const end = css.indexOf("*/", j + 2);
          j = end === -1 ? len : end + 2;
          continue;
        }
        if (c === '"' || c === "'") {
          const q = c;
          j++;
          while (j < len && css[j] !== q) {
            if (css[j] === "\\") j += 2;
            else j++;
          }
          j++;
          continue;
        }
        if (c === "{") inner++;
        else if (c === "}") inner--;
        j++;
      }
      const bodyEnd = j - 1;
      const blockEnd = j;
      const mediaCondition = mediaStack.length > 0
        ? mediaStack[mediaStack.length - 1]!.condition
        : null;
      blocks.push({
        selector: head,
        bodyStart,
        bodyEnd,
        blockStart,
        blockEnd,
        mediaCondition,
      });
      i = j;
      continue;
    }
    if (ch === "}") {
      // Closing a media wrapper.
      depth--;
      mediaStack.pop();
      i++;
      continue;
    }
    if (selectorStart < 0 && ch !== "\n" && ch !== " " && ch !== "\t" && ch !== "\r") {
      selectorStart = i;
    }
    i++;
  }
  return blocks;
}

export function applyMigrationFixToCss(
  css: string,
  fix: MigrationFix,
  options: ApplyMigrationFixOptions = {},
): string {
  const targetSelector = normalizeSelectorWhitespace(fix.selector);
  const blocks = scanCssBlocks(css);

  for (const block of blocks) {
    if (normalizeSelectorWhitespace(block.selector) !== targetSelector) continue;
    if ((block.mediaCondition ?? null) !== fix.mediaCondition) continue;

    const body = css.slice(block.bodyStart, block.bodyEnd);
    const updatedBody = upsertDeclarationMultiline(body, fix.property, fix.value);
    if (updatedBody === body) return css; // no-op (value already matches)
    return css.slice(0, block.bodyStart) + updatedBody + css.slice(block.bodyEnd);
  }

  if (!options.appendIfMissing) return css;

  // No existing matching rule — append a new block at the end.
  const declaration = `${fix.selector} { ${fix.property}: ${fix.value}; }`;
  const appended = fix.mediaCondition
    ? `${css.replace(/\s*$/, "")}\n@media ${fix.mediaCondition} {\n  ${declaration}\n}\n`
    : `${css.replace(/\s*$/, "")}\n${declaration}\n`;
  return appended;
}

/**
 * Upsert a single declaration into a CSS block body, preserving the
 * surrounding whitespace / line structure. Works for both single-line
 * (`padding: 16px; color: red`) and multi-line bodies where each
 * declaration sits on its own indented line.
 */
function upsertDeclarationMultiline(body: string, property: string, value: string): string {
  // Find existing property declaration.
  // Match: optional whitespace, property, ws, `:`, ws, value (until `;` or end-of-block).
  const escaped = property.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
  const re = new RegExp(`(^|[\\s;])(${escaped})\\s*:\\s*([^;}]*)`, "i");
  const match = re.exec(body);
  if (match) {
    const start = match.index + match[1].length;
    const propEnd = start + match[2].length;
    // Find end of the value (next `;` or end of body).
    let valueEnd = body.length;
    for (let k = propEnd; k < body.length; k++) {
      const ch = body[k];
      if (ch === ";") { valueEnd = k; break; }
    }
    // The value slice from `:` to `;`.
    const colonIdx = body.indexOf(":", propEnd);
    if (colonIdx === -1 || colonIdx > valueEnd) return body;
    const currentValue = body.slice(colonIdx + 1, valueEnd).trim();
    if (currentValue === value) return body; // no-op
    return body.slice(0, colonIdx + 1) + ` ${value}` + body.slice(valueEnd);
  }

  // Property not present — insert before the closing brace context.
  // If the body is single-line (no leading newline before content),
  // append `; <property>: <value>` to the trimmed body.
  const trailingWsMatch = body.match(/(\s*)$/);
  const trailing = trailingWsMatch?.[1] ?? "";
  const core = body.slice(0, body.length - trailing.length);
  // Detect indent of the last non-empty declaration line for multi-line bodies.
  const lines = core.split("\n");
  if (lines.length >= 2) {
    // Multi-line body: append a new indented declaration.
    const indent = lines[lines.length - 1].match(/^\s*/)?.[0]
      ?? lines.find((l) => l.trim())?.match(/^\s*/)?.[0]
      ?? "  ";
    const needsSemicolon = !core.trimEnd().endsWith(";") && core.trim().length > 0;
    const prefix = needsSemicolon ? ";" : "";
    return `${core}${prefix}\n${indent}${property}: ${value};${trailing}`;
  }
  // Single-line body.
  const trimmedCore = core.trim();
  if (trimmedCore.length === 0) return `${property}: ${value};`;
  const needsSemi = !trimmedCore.endsWith(";");
  return `${needsSemi ? `${core}; ` : `${core} `}${property}: ${value};${trailing}`;
}

export function shouldIgnoreMigrationRerunError(error: unknown): boolean {
  return isPlaywrightSandboxRestrictionError(error);
}

function summarizeMigrationVariantConvergence(
  variant: string,
  results: MigrationCompareReportResult[],
): MigrationVariantConvergence {
  const cleanResults = results.filter((result) => result.diffPixels === 0 && !result.approved).length;
  const approvedResults = results.filter((result) => result.diffPixels === 0 && !!result.approved).length;
  const remainingResults = results.filter((result) => result.diffPixels > 0 || result.partiallyApproved).length;
  return {
    variant,
    totalResults: results.length,
    cleanResults,
    approvedResults,
    remainingResults,
    status: summarizeConvergenceStatus(cleanResults, approvedResults, remainingResults),
  };
}

function summarizeConvergenceStatus(
  cleanResults: number,
  approvedResults: number,
  remainingResults: number,
): MigrationConvergenceStatus {
  if (remainingResults > 0) return "remaining";
  if (approvedResults > 0) return "approved";
  return cleanResults > 0 ? "clean" : "remaining";
}

function resolveVariantFile(
  report: MigrationCompareReport,
  result: MigrationCompareReportResult,
): string {
  if (result.variantFile) return result.variantFile;
  return report.variants.find((variantFile) => basename(variantFile, ".html") === result.variant) ?? result.variant;
}

function upsertDeclaration(body: string, property: string, value: string): string {
  const declarations = body
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean);
  let replaced = false;
  const nextDeclarations = declarations.map((entry) => {
    const [entryProperty] = entry.split(":");
    if (entryProperty?.trim() !== property) return entry;
    replaced = true;
    return `${property}: ${value}`;
  });
  if (!replaced) {
    nextDeclarations.push(`${property}: ${value}`);
  }
  return `${nextDeclarations.join("; ")};`;
}
