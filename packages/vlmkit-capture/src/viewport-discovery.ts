/**
 * Viewport Discovery -- discover breakpoints from CSS and generate boundary-check viewports
 *
 * Extracts breakpoints from @media queries and generates viewport lists
 * at boundary +/-1px + random samples within ranges (quickcheck-style).
 */

// ---- Types ----

export interface Breakpoint {
  value: number;          // px
  type: "min-width" | "max-width";
  raw: string;            // e.g. "(min-width: 768px)"
}

export interface ResponsiveBreakpoint {
  axis: "width";
  op: "ge" | "gt" | "le" | "lt";
  valuePx: number;
  raw: string;
  normalized: string;
  guards: string[];
  ruleCount: number;
}

/** Where a viewport candidate originated. */
export type ViewportSource =
  | "standard"
  | "regex-boundary"
  | "regex-sample"
  | "crater-required"
  | "crater-rule-map";

export interface ViewportSpec {
  width: number;
  height: number;
  label: string;
  reason: string;         // why this viewport was chosen
  /**
   * Optional provenance for downstream reports — present when discovery
   * went through `generateViewports` / the Crater discovery path. Older
   * callers that build a plain spec without this field still validate.
   */
  source?: ViewportSource;
}

export interface DiscoveryResult {
  breakpoints: Breakpoint[];
  responsiveBreakpoints: ResponsiveBreakpoint[];
  viewports: ViewportSpec[];
  /**
   * Which backend supplied the viewport list. `"crater"` means the
   * BiDi v0.18.0 viewport intelligence APIs returned a usable set;
   * `"regex"` means the inline-CSS regex discovery did. `"hybrid"`
   * means Crater seeded the list and regex contributed additional
   * widths (or vice versa).
   */
  backend: "regex" | "crater" | "hybrid";
}

type ViewportBreakpoint = Breakpoint | ResponsiveBreakpoint;

// ---- Breakpoint extraction ----

const MEDIA_PATTERN = /@media\s+([^{]+)\{/g;
const WIDTH_PATTERN = /\(\s*(min|max)-width\s*:\s*([\d.]+)(px|rem|em)\s*\)/g;

/** Extract all breakpoints from CSS text */
export function extractBreakpoints(css: string): Breakpoint[] {
  const breakpoints = new Map<string, Breakpoint>(); // dedupe by key

  for (const mediaMatch of css.matchAll(MEDIA_PATTERN)) {
    const condition = mediaMatch[1].trim();
    for (const widthMatch of condition.matchAll(WIDTH_PATTERN)) {
      const type = `${widthMatch[1]}-width` as "min-width" | "max-width";
      let value = parseFloat(widthMatch[2]);
      const unit = widthMatch[3];
      // rem/em → px (assume 16px base)
      if (unit === "rem" || unit === "em") value *= 16;
      value = Math.round(value);

      const key = `${type}:${value}`;
      if (!breakpoints.has(key)) {
        breakpoints.set(key, { value, type, raw: `(${type}: ${value}px)` });
      }
    }
  }

  return [...breakpoints.values()].sort((a, b) => a.value - b.value);
}

function extractInlineStyleCss(html: string): string {
  const styleMatch = html.match(/<style[^>]*>([\s\S]*?)<\/style>/g);
  if (!styleMatch) return "";
  return styleMatch.map((s) => s.replace(/<\/?style[^>]*>/g, "")).join("\n");
}

/** Extract breakpoints from HTML <style> */
export function extractBreakpointsFromHtml(html: string): Breakpoint[] {
  return extractBreakpoints(extractInlineStyleCss(html));
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

export function extractStylesheetHrefsFromHtml(html: string): string[] {
  const linkTags = html.match(/<link\b[^>]*>/gi) ?? [];
  return linkTags
    .filter(isStylesheetLink)
    .map((tag) => readAttr(tag, "href"))
    .filter((href): href is string => !!href);
}

export function extractBreakpointsFromHtmlWithStylesheets(
  html: string,
  stylesheetTexts: string[],
): Breakpoint[] {
  return extractBreakpoints([
    extractInlineStyleCss(html),
    ...stylesheetTexts,
  ].join("\n"));
}

function isResponsiveBreakpoint(
  breakpoint: ViewportBreakpoint,
): breakpoint is ResponsiveBreakpoint {
  return "axis" in breakpoint;
}

function normalizeResponsiveBreakpoint(
  breakpoint: ViewportBreakpoint,
): ResponsiveBreakpoint {
  if (isResponsiveBreakpoint(breakpoint)) {
    const guards = [...new Set(breakpoint.guards)].sort((a, b) => a.localeCompare(b));
    return {
      axis: breakpoint.axis,
      op: breakpoint.op,
      valuePx: breakpoint.valuePx,
      raw: breakpoint.raw,
      normalized: breakpoint.normalized,
      guards,
      ruleCount: breakpoint.ruleCount ?? 1,
    };
  }

  const op = breakpoint.type === "min-width" ? "ge" : "le";
  const operator = op === "ge" ? ">=" : "<=";
  return {
    axis: "width",
    op,
    valuePx: breakpoint.value,
    raw: breakpoint.raw,
    normalized: `(width ${operator} ${breakpoint.value}px)`,
    guards: [],
    ruleCount: 1,
  };
}

function compareResponsiveBreakpoint(
  left: ResponsiveBreakpoint,
  right: ResponsiveBreakpoint,
): number {
  if (left.valuePx !== right.valuePx) return left.valuePx - right.valuePx;
  const order = { lt: 0, le: 1, ge: 2, gt: 3 } as const;
  if (order[left.op] !== order[right.op]) return order[left.op] - order[right.op];
  return left.guards.join("|").localeCompare(right.guards.join("|"));
}

export function toResponsiveBreakpoints(
  breakpoints: ViewportBreakpoint[],
): ResponsiveBreakpoint[] {
  const merged = new Map<string, ResponsiveBreakpoint>();

  for (const breakpoint of breakpoints) {
    const normalized = normalizeResponsiveBreakpoint(breakpoint);
    const key = [
      normalized.axis,
      normalized.op,
      normalized.valuePx,
      normalized.guards.join("&"),
    ].join(":");
    const existing = merged.get(key);
    if (existing) {
      existing.ruleCount += normalized.ruleCount;
      continue;
    }
    merged.set(key, { ...normalized });
  }

  return [...merged.values()].sort(compareResponsiveBreakpoint);
}

export function mergeResponsiveBreakpoints(
  ...collections: ViewportBreakpoint[][]
): ResponsiveBreakpoint[] {
  return toResponsiveBreakpoints(collections.flat());
}

export function extractResponsiveBreakpointsFromHtml(
  html: string,
): ResponsiveBreakpoint[] {
  return toResponsiveBreakpoints(extractBreakpointsFromHtml(html));
}

export function extractResponsiveBreakpointsFromHtmlWithStylesheets(
  html: string,
  stylesheetTexts: string[],
): ResponsiveBreakpoint[] {
  return toResponsiveBreakpoints(
    extractBreakpointsFromHtmlWithStylesheets(html, stylesheetTexts),
  );
}

// ---- Viewport generation ----

export interface ViewportOptions {
  height?: number;              // default: 900
  maxViewports?: number;        // upper limit (cost control)
  randomSamples?: number;       // random samples within range (default: 0)
  seed?: number;                // random seed
  includeStandard?: boolean;    // include standard viewports (375, 1280, 1440) (default: true)
}

const STANDARD_VIEWPORTS: Array<{ width: number; label: string }> = [
  { width: 375, label: "mobile" },
  { width: 1280, label: "desktop" },
  { width: 1440, label: "wide" },
];

/**
 * Generate viewport list from breakpoints (quickcheck-style).
 *
 * For each breakpoint:
 * - boundary +1px: just after breakpoint activates
 * - boundary -1px: just before breakpoint activates
 * - (optional) random samples within range
 */
export function generateViewports(
  breakpoints: ViewportBreakpoint[],
  options: ViewportOptions = {},
): ViewportSpec[] {
  const responsiveBreakpoints = toResponsiveBreakpoints(breakpoints);
  const height = options.height ?? 900;
  const maxViewports = options.maxViewports ?? 20;
  const randomSamples = options.randomSamples ?? 0;
  const includeStandard = options.includeStandard ?? true;
  const seed = options.seed ?? 42;

  const viewportMap = new Map<number, ViewportSpec>();

  function add(width: number, label: string, reason: string, source: ViewportSource) {
    if (width < 320 || width > 2560) return;
    if (!viewportMap.has(width)) {
      viewportMap.set(width, { width, height, label, reason, source });
    }
  }

  // Standard viewports
  if (includeStandard) {
    for (const sv of STANDARD_VIEWPORTS) {
      add(sv.width, sv.label, "standard", "standard");
    }
  }

  // Boundary viewports for each breakpoint
  for (const bp of responsiveBreakpoints) {
    if (bp.op === "ge") {
      add(bp.valuePx - 1, `below-${bp.valuePx}`, `${bp.raw} boundary-below`, "regex-boundary");
      add(bp.valuePx, `at-${bp.valuePx}`, `${bp.raw} boundary-at`, "regex-boundary");
    } else if (bp.op === "gt") {
      add(bp.valuePx, `at-${bp.valuePx}`, `${bp.raw} boundary-at`, "regex-boundary");
      add(bp.valuePx + 1, `above-${bp.valuePx}`, `${bp.raw} boundary-above`, "regex-boundary");
    } else if (bp.op === "le") {
      add(bp.valuePx, `at-${bp.valuePx}`, `${bp.raw} boundary-at`, "regex-boundary");
      add(bp.valuePx + 1, `above-${bp.valuePx}`, `${bp.raw} boundary-above`, "regex-boundary");
    } else {
      add(bp.valuePx - 1, `below-${bp.valuePx}`, `${bp.raw} boundary-below`, "regex-boundary");
      add(bp.valuePx, `at-${bp.valuePx}`, `${bp.raw} boundary-at`, "regex-boundary");
    }
  }

  // Random samples within breakpoint ranges
  if (randomSamples > 0 && responsiveBreakpoints.length > 0) {
    const allWidths = [...new Set(responsiveBreakpoints.map((b) => b.valuePx))].sort((a, b) => a - b);
    const ranges: Array<[number, number]> = [];

    // Build ranges: [320, bp1], [bp1, bp2], ..., [bpN, 1920]
    ranges.push([320, allWidths[0] - 1]);
    for (let i = 0; i < allWidths.length - 1; i++) {
      ranges.push([allWidths[i], allWidths[i + 1] - 1]);
    }
    ranges.push([allWidths[allWidths.length - 1], 1920]);

    let s = seed;
    const rand = () => { s = (s * 1664525 + 1013904223) & 0x7fffffff; return s / 0x7fffffff; };

    for (const [lo, hi] of ranges) {
      if (hi - lo < 2) continue;
      for (let j = 0; j < randomSamples; j++) {
        const w = Math.round(lo + rand() * (hi - lo));
        add(w, `sample-${w}`, `random sample in [${lo}, ${hi}]`, "regex-sample");
      }
    }
  }

  // Sort by width and limit
  const sorted = [...viewportMap.values()].sort((a, b) => a.width - b.width);
  return sorted.slice(0, maxViewports);
}

/**
 * Discover breakpoints from HTML and generate boundary-check viewports.
 */
export function discoverViewports(
  html: string,
  options: ViewportOptions = {},
): DiscoveryResult {
  const breakpoints = extractBreakpointsFromHtml(html);
  const responsiveBreakpoints = toResponsiveBreakpoints(breakpoints);
  const viewports = generateViewports(responsiveBreakpoints, options);
  return { breakpoints, responsiveBreakpoints, viewports, backend: "regex" };
}

// ---- Crater viewport intelligence ----

export interface CraterViewportSource {
  getRequiredTestViewports(): Promise<{ viewports: Array<{ width: number; reason: string }> }>;
  getCssRuleViewportMap?(viewportWidths?: number[]): Promise<{
    rules: Array<{ activeAtWidths?: number[]; inactiveAtWidths?: number[] }>;
  }>;
}

function clampViewport(width: number): boolean {
  return Number.isFinite(width) && width >= 320 && width <= 2560;
}

function buildCraterViewport(
  width: number,
  height: number,
  reason: string,
  source: ViewportSource,
): ViewportSpec | null {
  if (!clampViewport(width)) return null;
  return {
    width,
    height,
    label: `at-${width}`,
    reason,
    source,
  };
}

/**
 * Drive Crater v0.18.0 viewport intelligence (`getRequiredTestViewports`
 * + optional `getCssRuleViewportMap`) to seed the viewport list with
 * breakpoints the renderer itself determined are load-bearing for the
 * current document. Falls back gracefully when either RPC fails.
 */
export async function discoverViewportsViaCrater(
  client: CraterViewportSource,
  options: ViewportOptions = {},
): Promise<{ viewports: ViewportSpec[]; widthsSeen: Set<number> }> {
  const height = options.height ?? 900;
  const widthsSeen = new Set<number>();
  const viewports: ViewportSpec[] = [];

  function pushIfNew(spec: ViewportSpec | null) {
    if (!spec) return;
    if (widthsSeen.has(spec.width)) return;
    widthsSeen.add(spec.width);
    viewports.push(spec);
  }

  try {
    const required = await client.getRequiredTestViewports();
    for (const v of required.viewports ?? []) {
      pushIfNew(buildCraterViewport(v.width, height, v.reason || "crater required", "crater-required"));
    }
  } catch {
    // ignored — the regex fallback will still run from discoverViewportsWithBackend.
  }

  if (client.getCssRuleViewportMap) {
    try {
      const map = await client.getCssRuleViewportMap();
      const extraWidths = new Set<number>();
      for (const rule of map.rules ?? []) {
        for (const w of rule.activeAtWidths ?? []) extraWidths.add(w);
        for (const w of rule.inactiveAtWidths ?? []) extraWidths.add(w);
      }
      for (const width of extraWidths) {
        pushIfNew(buildCraterViewport(width, height, "crater rule/viewport map", "crater-rule-map"));
      }
    } catch {
      // ignored
    }
  }

  return { viewports, widthsSeen };
}

/**
 * Hybrid viewport discovery: prefer Crater v0.18.0 viewport intelligence
 * when available, fall back to regex breakpoints for any widths Crater
 * didn't surface, and tag each viewport with its `source`. The returned
 * `backend` field tells downstream reports which path supplied the list.
 */
export async function discoverViewportsWithBackend(
  html: string,
  options: ViewportOptions & { craterClient?: CraterViewportSource | null } = {},
): Promise<DiscoveryResult> {
  const breakpoints = extractBreakpointsFromHtml(html);
  const responsiveBreakpoints = toResponsiveBreakpoints(breakpoints);
  const regexViewports = generateViewports(responsiveBreakpoints, options);

  const client = options.craterClient ?? null;
  if (!client) {
    return { breakpoints, responsiveBreakpoints, viewports: regexViewports, backend: "regex" };
  }

  const craterResult = await discoverViewportsViaCrater(client, options);
  if (craterResult.viewports.length === 0) {
    return { breakpoints, responsiveBreakpoints, viewports: regexViewports, backend: "regex" };
  }

  // Fold regex output in as fallback, keeping anything Crater didn't already cover.
  const merged: ViewportSpec[] = [...craterResult.viewports];
  let usedFallback = false;
  for (const v of regexViewports) {
    if (craterResult.widthsSeen.has(v.width)) continue;
    merged.push(v);
    if (v.source !== "standard") usedFallback = true;
  }

  const maxViewports = options.maxViewports ?? 20;
  merged.sort((a, b) => a.width - b.width);
  const limited = merged.slice(0, maxViewports);

  return {
    breakpoints,
    responsiveBreakpoints,
    viewports: limited,
    backend: usedFallback ? "hybrid" : "crater",
  };
}
