/**
 * Responsive layout as properties over a generated viewport space — the pure half of
 * `check responsive`.
 *
 * `check breakpoints` asks whether each media-query boundary is consistent with its
 * neighbours; `check integrity` asks whether the page is broken at three widths. Neither
 * asks the question the demo-site round kept answering by eye: **is there any viewport
 * at which this layout breaks?** 17 of the 96 defects found by looking were "cramped or
 * wrapped at an in-between width" — a masthead at 768px setting 暮 / ら / し a character
 * per line while `check integrity` called 768 clean, four phase cards at 93px each in a
 * 432px article. Those widths are in no list anyone wrote down.
 *
 * So the viewport is a generated input and the layout judges are properties:
 *
 *   - the space is **partitioned by the page's own media queries** (`regimesFromSamples`):
 *     each width regime is a set of conditions that match together, and the generator
 *     visits every regime and both sides of every transition, then draws at random inside
 *     them — boundary-heavy, like QuickCheck's edge cases, but with the boundaries read
 *     off the page rather than guessed;
 *   - a failure is **shrunk** before it is reported (`caseShrinkers`, then the width
 *     interval in the runner), so it says which dimensions it needs;
 *   - the width interval is **anchored to the transitions** (`anchorInterval`): a failure
 *     that begins exactly where a regime switches on and clears 172px later is a
 *     breakpoint set too early, and the fix is a number, not a guess.
 *
 * `judgeStarvedText` is the one new property: text squeezed to a line or two of a word
 * at a time. The others are `check integrity`'s own judges, run per case by the runner.
 *
 * Pure: the browser half (collectors, resize, the oracle) lives in
 * `@mizchi/vlmkit-markup/stress/responsive-pbt.ts`.
 */
import { shrinkAlongLadder, shrinkIntToward, type Rng, type ShrinkCandidates } from "./pbt.ts";

// ---------------------------------------------------------------------------
// The case space

export type ColorScheme = "light" | "dark";
export type ReducedMotion = "no-preference" | "reduce";

/** One generated viewport. Every field is a media-query or layout input. */
export interface ResponsiveCase {
  width: number;
  height: number;
  /** Multiplier on the root font size (1 = the page as authored). */
  textScale: number;
  colorScheme: ColorScheme;
  reducedMotion: ReducedMotion;
}

export interface ResponsiveSpace {
  minWidth: number;
  maxWidth: number;
  minHeight: number;
  maxHeight: number;
  /** The height a failure shrinks toward, and the one most cases use. */
  defaultHeight: number;
  /** Ascending, starting at 1. `[1]` when text scaling is not generated. */
  textScales: number[];
  /** `["light"]` unless the page has a `prefers-color-scheme` query. */
  colorSchemes: ColorScheme[];
  /** `["no-preference"]` unless the page has a `prefers-reduced-motion` query. */
  reducedMotions: ReducedMotion[];
}

/** The simplest point of the space: what every non-width dimension shrinks toward. */
export function baseCase(space: ResponsiveSpace, width: number): ResponsiveCase {
  return {
    width,
    height: space.defaultHeight,
    textScale: space.textScales[0] ?? 1,
    colorScheme: space.colorSchemes[0] ?? "light",
    reducedMotion: space.reducedMotions[0] ?? "no-preference",
  };
}

export function describeCase(c: ResponsiveCase, space?: ResponsiveSpace): string {
  const parts = [`${c.width}x${c.height}`];
  if (c.textScale !== 1) parts.push(`text ${c.textScale}x`);
  if (c.colorScheme !== (space?.colorSchemes[0] ?? "light")) parts.push(c.colorScheme);
  if (c.reducedMotion !== (space?.reducedMotions[0] ?? "no-preference")) parts.push("reduced motion");
  return parts.join(" ");
}

// ---------------------------------------------------------------------------
// Media regimes

/** The media conditions that match at one width (at the default height). */
export interface MediaSample {
  width: number;
  matches: string[];
}

/** `width` is the first width of the new regime: the old one ends at `width - 1`. */
export interface MediaTransition {
  width: number;
  /** Conditions that start matching at `width`. */
  entering: string[];
  /** Conditions that stop matching at `width`. */
  leaving: string[];
}

export interface WidthRegime {
  from: number;
  to: number;
  matches: string[];
}

export interface RegimePartition {
  transitions: MediaTransition[];
  regimes: WidthRegime[];
  /** Adjacent samples more than 1px apart whose match sets differ: a transition no parsed number predicted. The runner bisects these. */
  unresolved: [number, number][];
}

const sameSet = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((x) => b.includes(x));

/**
 * Partition [min, max] by where the matching condition set changes. Samples need not be
 * dense: a change between two samples 1px apart is an exact transition; a change across
 * a wider gap is reported `unresolved` for the caller to bisect and resample.
 */
export function regimesFromSamples(samples: readonly MediaSample[], min: number, max: number): RegimePartition {
  const sorted = [...new Map(samples.map((s) => [s.width, s])).values()]
    .filter((s) => s.width >= min && s.width <= max)
    .sort((a, b) => a.width - b.width);
  const transitions: MediaTransition[] = [];
  const unresolved: [number, number][] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const cur = sorted[i]!;
    if (sameSet(prev.matches, cur.matches)) continue;
    if (cur.width - prev.width === 1) {
      transitions.push({
        width: cur.width,
        entering: cur.matches.filter((m) => !prev.matches.includes(m)),
        leaving: prev.matches.filter((m) => !cur.matches.includes(m)),
      });
    } else {
      unresolved.push([prev.width, cur.width]);
    }
  }
  const matchesAt = (w: number): string[] => {
    let best: MediaSample | undefined;
    for (const s of sorted) if (s.width <= w) best = s;
    return best?.matches ?? sorted[0]?.matches ?? [];
  };
  const edges = [min, ...transitions.map((t) => t.width).filter((w) => w > min && w <= max)];
  const regimes: WidthRegime[] = edges.map((from, i) => ({
    from,
    to: i + 1 < edges.length ? edges[i + 1]! - 1 : max,
    matches: matchesAt(from),
  }));
  return { transitions, regimes, unresolved };
}

/**
 * Candidate transition widths from a condition's own numbers: each length in a width
 * feature, at 16px per em/rem (what a media query's em means), with its neighbours, so
 * `max-width: 767.98px`, `min-width: 48em` and `(width > 700px)` all land a sample on
 * each side of the real edge. Numbers only seed the search; the matched sets decide.
 */
export function widthCandidates(conditions: readonly string[]): number[] {
  const out = new Set<number>();
  for (const cond of conditions) {
    for (const feature of cond.matchAll(/\(([^()]*\bwidth\b[^()]*)\)/gi)) {
      for (const m of feature[1]!.matchAll(/(-?[\d.]+)\s*(px|r?em)\b/gi)) {
        const px = parseFloat(m[1]!) * (m[2]!.toLowerCase() === "px" ? 1 : 16);
        if (!Number.isFinite(px)) continue;
        for (const d of [-1, 0, 1, 2]) out.add(Math.floor(px) + d);
      }
    }
  }
  return [...out].filter((w) => w > 0).sort((a, b) => a - b);
}

/** Same, for height features (`min-height`, `(height < 500px)`, …). */
export function heightCandidates(conditions: readonly string[]): number[] {
  const out = new Set<number>();
  for (const cond of conditions) {
    for (const feature of cond.matchAll(/\(([^()]*\bheight\b[^()]*)\)/gi)) {
      for (const m of feature[1]!.matchAll(/(-?[\d.]+)\s*(px|r?em)\b/gi)) {
        const px = parseFloat(m[1]!) * (m[2]!.toLowerCase() === "px" ? 1 : 16);
        if (!Number.isFinite(px)) continue;
        for (const d of [-1, 0, 1]) out.add(Math.floor(px) + d);
      }
    }
  }
  return [...out].filter((h) => h > 0).sort((a, b) => a - b);
}

/**
 * Media features the generator does not vary, named by the conditions that use them. A
 * regime selected only by `(hover: hover)` was measured as headless Chromium reports it,
 * and the report says so rather than implying it was covered.
 */
export function unvariedFeatures(conditions: readonly string[]): { feature: string; conditions: string[] }[] {
  const VARIED = /^(min-|max-)?(width|height|aspect-ratio|orientation|prefers-color-scheme|prefers-reduced-motion)$/;
  const byFeature = new Map<string, string[]>();
  for (const cond of conditions) {
    for (const m of cond.matchAll(/\(\s*([a-z-]+)\s*(?::|[<>=]|\))/gi)) {
      const feature = m[1]!.toLowerCase();
      if (VARIED.test(feature)) continue;
      const list = byFeature.get(feature) ?? [];
      if (!list.includes(cond)) list.push(cond);
      byFeature.set(feature, list);
    }
    // Range syntax with the value first: (400px <= width) names `width`, which is varied.
  }
  return [...byFeature.entries()].map(([feature, list]) => ({ feature, conditions: list }));
}

// ---------------------------------------------------------------------------
// Generation

/**
 * The cases every run starts with, before any randomness: both sides of every width
 * transition and both ends of the range, at the base point of the other dimensions. A
 * 1px off-by-one is invisible to uniform sampling (one width in ~1100) and certain here.
 */
export function edgeCases(space: ResponsiveSpace, transitions: readonly MediaTransition[]): ResponsiveCase[] {
  const widths = new Set<number>([space.minWidth, space.maxWidth]);
  for (const t of transitions) {
    if (t.width - 1 >= space.minWidth) widths.add(t.width - 1);
    if (t.width <= space.maxWidth) widths.add(t.width);
  }
  return [...widths].sort((a, b) => a - b).map((w) => baseCase(space, w));
}

/**
 * One random case. Regimes are visited round-robin by `index` so a narrow regime gets as
 * many cases as a wide one; a quarter of the widths land on a regime edge. Half the cases
 * keep the default height and every other dimension is at its base value half the time,
 * so most failures arrive already attributable to width alone.
 */
export function generateCase(
  rng: Rng,
  space: ResponsiveSpace,
  regimes: readonly WidthRegime[],
  index: number,
  heightEdges: readonly number[] = [],
): ResponsiveCase {
  const regime = regimes.length > 0
    ? regimes[index % regimes.length]!
    : { from: space.minWidth, to: space.maxWidth, matches: [] };
  const width = rng.chance(0.25)
    ? rng.pick([regime.from, Math.min(regime.to, regime.from + 1), Math.max(regime.from, regime.to - 1), regime.to])
    : rng.int(regime.from, regime.to);
  let height = space.defaultHeight;
  if (rng.chance(0.5)) {
    const edges = heightEdges.filter((h) => h >= space.minHeight && h <= space.maxHeight);
    height = edges.length > 0 && rng.chance(0.3) ? rng.pick(edges) : rng.int(space.minHeight, space.maxHeight);
  }
  const textScale = space.textScales.length > 1 && rng.chance(0.5) ? rng.pick(space.textScales.slice(1)) : space.textScales[0] ?? 1;
  const colorScheme = space.colorSchemes.length > 1 && rng.chance(0.5) ? space.colorSchemes[1]! : space.colorSchemes[0] ?? "light";
  const reducedMotion = space.reducedMotions.length > 1 && rng.chance(0.5)
    ? space.reducedMotions[1]!
    : space.reducedMotions[0] ?? "no-preference";
  return { width, height, textScale, colorScheme, reducedMotion };
}

/**
 * Shrinkers for every dimension except width: each moves toward the base case. Width is
 * shrunk differently — to the exact interval it fails over — because "the smallest
 * failing width" is not what anyone fixes; the edges of the failing range are.
 */
export function caseShrinkers(space: ResponsiveSpace): ShrinkCandidates<ResponsiveCase> {
  return {
    colorScheme: (v) => (v === space.colorSchemes[0] ? [] : [space.colorSchemes[0] ?? "light"]),
    reducedMotion: (v) => (v === space.reducedMotions[0] ? [] : [space.reducedMotions[0] ?? "no-preference"]),
    textScale: (v) => shrinkAlongLadder(v, space.textScales),
    height: (v) => shrinkIntToward(v, space.defaultHeight),
  };
}

// ---------------------------------------------------------------------------
// Findings and their grouping

export type ResponsivePropertyKind =
  | "page-overflow-x"
  | "clipped-content"
  | "text-collision"
  | "text-clipped"
  | "container-protrusion"
  | "occluded-text"
  | "collapsed-container"
  | "text-starved";

export interface ResponsiveFinding {
  /** A built-in property, or a caller's own (the runner accepts custom properties). */
  kind: ResponsivePropertyKind | (string & {});
  /** fail = the layout is broken at this case; warn = cramped or suspicious. */
  severity: "fail" | "warn";
  selector?: string;
  /** Elements the finding is about, as stable selectors, for the cause search. */
  targets: string[];
  message: string;
  evidence?: Record<string, unknown>;
}

/**
 * What "the same failure" means while shrinking: the property and the element. Page
 * overflow is one failure whatever element is blamed at each width — the blamed element
 * changes as the page narrows, the defect does not.
 */
export function failureKey(f: Pick<ResponsiveFinding, "kind" | "selector">): string {
  return f.kind === "page-overflow-x" ? f.kind : `${f.kind}|${f.selector ?? ""}`;
}

export interface CaseOutcome {
  index: number;
  case: ResponsiveCase;
  findings: ResponsiveFinding[];
}

export interface FailureGroup {
  kind: ResponsiveFinding["kind"];
  severity: "fail" | "warn";
  /** The finding shrunk on behalf of the group (the first key's first sighting). */
  representative: ResponsiveFinding;
  /** Every failure key in the group: same property, failing in exactly the same cases. */
  keys: string[];
  /** Selectors of every member, representative first. */
  selectors: string[];
  /** Indexes of the cases the group failed in. */
  cases: number[];
}

/**
 * Collapse findings that fail in exactly the same cases into one group. Five nav links
 * starved together are one defect in the row that holds them, and shrinking each would
 * spend five times the budget to print the same interval five times.
 */
export function groupFailures(outcomes: readonly CaseOutcome[]): FailureGroup[] {
  const byKey = new Map<string, { finding: ResponsiveFinding; cases: number[] }>();
  for (const o of outcomes) {
    for (const f of o.findings) {
      const key = failureKey(f);
      const entry = byKey.get(key);
      if (entry) {
        if (!entry.cases.includes(o.index)) entry.cases.push(o.index);
        if (f.severity === "fail") entry.finding = entry.finding.severity === "fail" ? entry.finding : f;
      } else {
        byKey.set(key, { finding: f, cases: [o.index] });
      }
    }
  }
  const groups = new Map<string, FailureGroup>();
  for (const [key, { finding, cases }] of byKey) {
    const signature = `${finding.kind}#${cases.join(",")}`;
    const group = groups.get(signature);
    const selector = finding.selector ?? "(page)";
    if (group) {
      group.keys.push(key);
      if (!group.selectors.includes(selector)) group.selectors.push(selector);
      if (finding.severity === "fail") group.severity = "fail";
    } else {
      groups.set(signature, {
        kind: finding.kind,
        severity: finding.severity,
        representative: finding,
        keys: [key],
        selectors: [selector],
        cases: [...cases],
      });
    }
  }
  return [...groups.values()].sort((a, b) =>
    (a.severity === b.severity ? 0 : a.severity === "fail" ? -1 : 1)
    || b.cases.length - a.cases.length
    || b.keys.length - a.keys.length);
}

// ---------------------------------------------------------------------------
// Anchoring a failing interval to the page's breakpoints

export type AnchorKind =
  | "every-width"
  | "whole-regime"
  | "starts-at-breakpoint"
  | "ends-at-breakpoint"
  | "inside-regime";

export interface FailureAnchor {
  kind: AnchorKind;
  /** The transition the failure begins at, when it begins at one. */
  startsAt?: MediaTransition;
  /** The transition that clears it (`hi + 1`), when one does. */
  clearedAt?: MediaTransition;
  diagnosis: string;
  /** A concrete change, when the evidence supports one. */
  suggestion?: string;
}

function transitionName(t: MediaTransition): string {
  if (t.entering[0]) return `${t.entering[0]} switches on`;
  if (t.leaving[0]) return `${t.leaving[0]} switches off`;
  return "a media condition changes";
}

/**
 * Rewrite a condition whose boundary is at `from` so that it is at `to`. The boundary
 * number is `from` itself (`min-width: 700px`, `width >= 700px`) or `from - 1`
 * (`max-width: 699px`, `width > 699px`); em/rem lengths are converted at 16px. Returns
 * null when no length in the condition sits on the boundary.
 */
export function moveCondition(condition: string, from: number, to: number): string | null {
  const delta = to - from;
  let moved = false;
  const text = condition.replace(/(-?[\d.]+)\s*(px|r?em)\b/gi, (whole, num: string, unit: string) => {
    const scale = unit.toLowerCase() === "px" ? 1 : 16;
    const px = parseFloat(num) * scale;
    const floor = Math.floor(px);
    if (floor !== from && floor !== from - 1 && Math.ceil(px) !== from) return whole;
    moved = true;
    const next = (px + delta) / scale;
    return `${Number.isInteger(next) ? next : Number(next.toFixed(4))}${unit}`;
  });
  return moved ? text : null;
}

/**
 * Where a failing width interval [lo, hi] sits relative to the page's transitions, and
 * what that implies:
 *
 *   - begins exactly at a transition and clears inside the next regime: the regime
 *     switched on too early — its layout needs `hi + 1`px;
 *   - clears exactly at a transition but begins inside the regime below: the layout
 *     below is kept too long — switch at `lo`px;
 *   - both, or the whole range: the layout that regime selects never fits;
 *   - neither: a size that does not follow the viewport, inside one regime.
 */
export function anchorInterval(
  lo: number,
  hi: number,
  transitions: readonly MediaTransition[],
  min: number,
  max: number,
): FailureAnchor {
  const startsAt = lo > min ? transitions.find((t) => t.width === lo) : undefined;
  const clearedAt = hi < max ? transitions.find((t) => t.width === hi + 1) : undefined;
  const range = lo === hi ? `${lo}px` : `${lo}-${hi}px`;

  if (lo === min && hi === max) {
    return {
      kind: "every-width",
      diagnosis: `fails at every width tested (${min}-${max}px): not a breakpoint defect — the page is broken at any size`,
    };
  }
  if (startsAt && clearedAt) {
    return {
      kind: "whole-regime",
      startsAt,
      clearedAt,
      diagnosis: `fails for exactly the regime ${range}: from where ${transitionName(startsAt)} to where ${transitionName(clearedAt)} — the layout this regime selects does not fit anywhere in it`,
      suggestion: `fix the layout the ${range} regime selects, or remove the regime so a neighbour's layout covers it`,
    };
  }
  if (startsAt && hi === max) {
    return {
      kind: "whole-regime",
      startsAt,
      diagnosis: `fails from the ${lo}px breakpoint (${transitionName(startsAt)}) to the widest width tested (${max}px) — the layout this regime selects does not fit anywhere it was measured`,
      suggestion: `fix the layout the regime from ${lo}px selects; no breakpoint move can clear a failure that reaches the widest width`,
    };
  }
  if (startsAt) {
    const moved = [...startsAt.entering, ...startsAt.leaving]
      .map((c) => ({ c, next: moveCondition(c, lo, hi + 1) }))
      .find((x) => x.next !== null);
    return {
      kind: "starts-at-breakpoint",
      startsAt,
      diagnosis: `starts exactly at the ${lo}px breakpoint (${transitionName(startsAt)}) and clears at ${hi + 1}px with no breakpoint there — the layout switched on at ${lo}px needs ${hi + 1}px`,
      suggestion: moved
        ? `move the breakpoint from ${lo}px to ${hi + 1}px: ${moved.c} → ${moved.next}; or make the ${lo}px layout fit from ${lo}px`
        : `move the ${lo}px breakpoint to ${hi + 1}px, or make the layout it selects fit from ${lo}px`,
    };
  }
  if (clearedAt) {
    if (lo === min) {
      return {
        kind: "ends-at-breakpoint",
        clearedAt,
        diagnosis: `fails at every width below the ${hi + 1}px breakpoint (${transitionName(clearedAt)}) — the narrow layout never fits`,
        suggestion: `fix the layout used below ${hi + 1}px; moving the breakpoint cannot help, the failure reaches the narrowest width tested`,
      };
    }
    const moved = [...clearedAt.entering, ...clearedAt.leaving]
      .map((c) => ({ c, next: moveCondition(c, hi + 1, lo) }))
      .find((x) => x.next !== null);
    return {
      kind: "ends-at-breakpoint",
      clearedAt,
      diagnosis: `fails from ${lo}px up to the ${hi + 1}px breakpoint (${transitionName(clearedAt)}), which clears it — the layout below ${hi + 1}px is kept ${hi + 1 - lo}px too long`,
      suggestion: moved
        ? `move the breakpoint from ${hi + 1}px down to ${lo}px: ${moved.c} → ${moved.next}; or make the narrower layout fit up to ${hi}px`
        : `move the ${hi + 1}px breakpoint down to ${lo}px, or make the narrower layout fit up to ${hi}px`,
    };
  }
  return {
    kind: "inside-regime",
    diagnosis: lo === min
      ? `fails at every width from ${min}px up to ${hi}px and no breakpoint bounds it — something keeps a size the viewport cannot give it`
      : hi === max
        ? `fails from ${lo}px to the widest width tested and no breakpoint bounds it`
        : `fails at ${range}, inside one regime — no breakpoint begins or ends it, so the cause is a size that does not follow the viewport (a fixed width, nowrap, a min-content floor)`,
  };
}

// ---------------------------------------------------------------------------
// text-starved: the property the eye kept finding

/** One text block as the collector measured it at one case. */
export interface StarvedTextSample {
  selector: string;
  /** The text, collapsed and clipped for the message. */
  text: string;
  /** Characters of text (code points, whitespace collapsed). */
  chars: number;
  /** Line boxes the text occupies. */
  lines: number;
  /** Lines the author asked for: `<br>`s + 1, or preserved newlines + 1. */
  authoredLines: number;
  /** Inline size available to the text: the content box. */
  contentWidth: number;
  fontSize: number;
  /** A short Latin/Greek/Cyrillic word the layout broke across two lines, when one was found. */
  brokenWord?: string;
}

/** Under this many ems, even two lines are a word or two apiece. */
export const STARVED_EM = 4;
/** Under this many ems, three or more lines are starved. */
export const STARVED_EM_MULTILINE = 6;
/**
 * At or above this size text is display type, and a headline set in short lines in a
 * narrow column is a typographic choice: the magazine's 42px title in four lines of five
 * characters at 1000px (2026-09-26 corpus). Display type is held to `STARVED_EM` only.
 */
export const STARVED_DISPLAY_PX = 24;
/** A broken word at most this long could have fit in any box that was not starved. */
export const STARVED_BROKEN_WORD_MAX = 15;

/**
 * Text squeezed until it wraps every word or two — or every character, in Japanese: a
 * flex or grid item shrunk to min-content, a column the layout left 90px, a breakpoint
 * switched on before the row fits. Found by eye 17 times on the demo sites and by no
 * gate; `text-clipped` and `container-protrusion` see nothing, because nothing overflows.
 *
 * Fires on a block that wraps (more lines than the author asked for) and is either
 * narrower than 4em, or (below display size) narrower than 6em over three or more lines, or has broken a word
 * of 15 characters or fewer across a line (a Latin word, which only breaks inside when
 * `overflow-wrap` lets a starved box force it). Warn-level: cramped, not unreadable.
 */
export function judgeStarvedText(samples: readonly StarvedTextSample[], maxFindings = 12): ResponsiveFinding[] {
  const findings: ResponsiveFinding[] = [];
  for (const s of samples) {
    if (s.fontSize <= 0 || s.contentWidth <= 0) continue;
    if (s.lines < 2 || s.lines <= s.authoredLines) continue;
    const em = s.contentWidth / s.fontSize;
    const brokenShort = s.brokenWord !== undefined && Array.from(s.brokenWord).length <= STARVED_BROKEN_WORD_MAX;
    const display = s.fontSize >= STARVED_DISPLAY_PX;
    const starved = em < STARVED_EM || (!display && em < STARVED_EM_MULTILINE && s.lines >= 3) || brokenShort;
    if (!starved) continue;
    if (findings.length >= maxFindings) break;
    const perLine = s.chars / s.lines;
    const why = brokenShort
      ? `breaks "${s.brokenWord}" across two lines`
      : `wraps into ${s.lines} lines of ~${perLine < 10 ? perLine.toFixed(1) : Math.round(perLine)} characters`;
    findings.push({
      kind: "text-starved",
      severity: "warn",
      selector: s.selector,
      targets: [s.selector],
      message: `"${s.text}" (${s.selector}) ${why} in a box ${Math.round(s.contentWidth)}px (${em.toFixed(1)}em) wide — squeezed below what its text needs; give the item room (let the row wrap, drop a column, or move the breakpoint).`,
      evidence: {
        lines: s.lines,
        chars: s.chars,
        contentWidth: Math.round(s.contentWidth),
        em: Number(em.toFixed(2)),
        ...(s.brokenWord !== undefined ? { brokenWord: s.brokenWord } : {}),
      },
    });
  }
  return findings;
}

/**
 * A failure that fails at every width only once the text is scaled (or the viewport is
 * short) is not "broken at any size": say which dimension it needs, and what that points at.
 */
export function qualifyAnchor(
  anchor: FailureAnchor,
  needs: readonly { dimension: string; value: unknown }[],
): FailureAnchor {
  if (needs.length === 0) return anchor;
  const at = needs.map((n) => `${n.dimension} ${String(n.value)}`).join(", ");
  const hint = needs.some((n) => n.dimension === "textScale")
    ? "something is sized in px around text sized in rem/em"
    : needs.some((n) => n.dimension === "height")
      ? "something is sized to the viewport's height (vh) around content that is not"
      : "the layout depends on a media feature, not only on width";
  if (anchor.kind === "every-width") {
    return { ...anchor, diagnosis: `fails at every width tested once ${at} — not a breakpoint defect: ${hint}` };
  }
  return { ...anchor, diagnosis: `${anchor.diagnosis} (only with ${at}: ${hint})` };
}

/**
 * The condition rewrites a suggestion implies: every condition at the anchoring
 * transition whose boundary number moves (both sides of a `max-width: 699px` /
 * `min-width: 700px` pair move together, or the fix would open a gap). Empty when the
 * anchor suggests no move.
 */
export function breakpointMoves(anchor: FailureAnchor, lo: number, hi: number, min: number): { from: string; to: string }[] {
  const plan = anchor.kind === "starts-at-breakpoint" && anchor.startsAt
    ? { t: anchor.startsAt, from: lo, to: hi + 1 }
    : anchor.kind === "ends-at-breakpoint" && anchor.clearedAt && lo > min
      ? { t: anchor.clearedAt, from: hi + 1, to: lo }
      : null;
  if (!plan) return [];
  const out: { from: string; to: string }[] = [];
  for (const cond of [...plan.t.entering, ...plan.t.leaving]) {
    const to = moveCondition(cond, plan.from, plan.to);
    if (to !== null && !out.some((m) => m.from === cond)) out.push({ from: cond, to });
  }
  return out;
}

/** One declaration a cause search can override. The browser half fills these in. */
export interface CauseCandidate {
  element: string;
  role: "target" | "ancestor" | "sibling" | "descendant";
  property: string;
  value: string;
  override: string;
  rule: string;
  /** Enclosing conditions, `@container …` included. */
  media: string[];
  sheet: string;
}

const STRUCTURAL = new Set([
  "grid-template-columns", "flex-wrap", "white-space", "text-wrap", "text-wrap-mode",
  "min-width", "min-inline-size", "width", "inline-size", "flex-basis", "flex", "flex-shrink",
  "max-width", "max-inline-size", "height", "block-size", "max-height", "max-block-size",
  "transform", "translate", "left", "right", "inset-inline-start", "inset-inline-end",
]);

/** A rough px reading of the size a declaration forces, for ordering only. */
function forcedPx(value: string): number {
  let best = 0;
  for (const m of value.matchAll(/(-?[\d.]+)(px|r?em|vw|vh|ch)\b/gi)) {
    const n = Math.abs(parseFloat(m[1]!));
    const unit = m[2]!.toLowerCase();
    const px = unit === "px" ? n : unit === "vw" || unit === "vh" ? n * 8 : unit === "ch" ? n * 8 : n * 16;
    best = Math.max(best, px);
  }
  const repeat = /repeat\(\s*(\d+)/i.exec(value);
  if (repeat) best = Math.max(best, Number(repeat[1]) * 100);
  return best;
}

/**
 * Order cause candidates so the first single declaration that clears a failure is the
 * one a person would change: declarations switched on by the transition the failure is
 * anchored to (or by a container query, when no media transition anchors it) first; then
 * sizing and wrapping before spacing — `padding: 0` clears nearly any squeeze and names
 * nothing; then the larger forced size; then the element itself before its relatives.
 */
export function rankCauseCandidates<T extends CauseCandidate>(candidates: readonly T[], anchor: FailureAnchor | undefined): T[] {
  const anchorConditions = new Set([
    ...(anchor?.startsAt ? [...anchor.startsAt.entering, ...anchor.startsAt.leaving] : []),
    ...(anchor?.clearedAt ? [...anchor.clearedAt.entering, ...anchor.clearedAt.leaving] : []),
  ]);
  const roleOrder = { target: 0, descendant: 1, sibling: 2, ancestor: 3 } as const;
  const tier = (c: T): number => {
    if (c.media.some((m) => anchorConditions.has(m))) return 0;
    if (anchorConditions.size === 0 && c.media.some((m) => m.startsWith("@container"))) return 0;
    return STRUCTURAL.has(c.property) ? 1 : 2;
  };
  return [...candidates].sort((a, b) =>
    tier(a) - tier(b)
    || (STRUCTURAL.has(a.property) ? 0 : 1) - (STRUCTURAL.has(b.property) ? 0 : 1)
    || forcedPx(b.value) - forcedPx(a.value)
    || roleOrder[a.role] - roleOrder[b.role]);
}

const NEUTRAL_OVERRIDES: Readonly<Record<string, string>> = {
  "width": "auto", "inline-size": "auto", "min-width": "auto", "min-inline-size": "auto",
  "max-width": "none", "max-inline-size": "none",
  "height": "auto", "block-size": "auto", "max-height": "none", "max-block-size": "none",
  "flex": "0 1 auto", "flex-basis": "auto", "flex-shrink": "1", "flex-wrap": "wrap",
  "white-space": "normal", "text-wrap": "wrap", "text-wrap-mode": "wrap",
  "grid-template-columns": "none",
  "gap": "0", "column-gap": "0",
  "padding": "0", "padding-left": "0", "padding-right": "0", "padding-inline": "0",
  "padding-inline-start": "0", "padding-inline-end": "0",
  "margin-left": "0", "margin-right": "0", "margin-inline": "0", "margin-inline-start": "0", "margin-inline-end": "0",
  "left": "auto", "right": "auto", "inset-inline-start": "auto", "inset-inline-end": "auto",
  "transform": "none", "translate": "none",
  "letter-spacing": "normal", "word-spacing": "normal",
};

/**
 * The value that neutralises a declaration for the cause search, or null when the
 * property is not one that sizes or places a box, or the value already is neutral. A
 * value is "neutral" when overriding it could not change the layout: `auto`, `0`,
 * `normal`, `flex-shrink: 1`, `flex-wrap: wrap`, `white-space: normal`, …
 */
export function neutralOverride(property: string, value: string): string | null {
  const override = NEUTRAL_OVERRIDES[property];
  if (override === undefined) return null;
  const v = value.trim().toLowerCase().replace(/\s*!important$/, "");
  if (/^(auto|initial|unset|revert|revert-layer|inherit|normal|none|0|0px|0%)$/.test(v)) return null;
  if (property === "flex-shrink" && v === "1") return null;
  if (property === "flex-wrap" && v !== "nowrap") return null;
  if (property === "white-space" && !/^(nowrap|pre)$/.test(v)) return null;
  if ((property === "text-wrap" || property === "text-wrap-mode") && v !== "nowrap") return null;
  if (property === "flex" && /^(0 1 auto|1|1 1 0%|auto)$/.test(v)) return null;
  return override;
}
