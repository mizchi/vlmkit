/**
 * `check css`: CSS the browser accepted as text and then ignored — the judgement half.
 *
 * Ported from veriss (its rule catalog §1 and §2, a static analysis with a grammar of its own),
 * but decided by the browser that renders the page: the collector reads each declaration's
 * `parsedOk` from the DevTools protocol, and evaluates every `@media` atom with `matchMedia`.
 * Nothing here re-derives CSS validity; it classifies and words what the browser said.
 *
 * - `dropped-declaration`        a declaration the browser threw away (unknown property, or a
 *                                value its grammar rejects: `calc(100%-10px)`, `width: 100`, …);
 * - `vendor-declaration-dropped` the same for a vendor-prefixed property or value, which is
 *                                usually a fallback written for another engine (info);
 * - `unknown-media-feature`      an `@media` whose feature (or value) the browser does not know:
 *                                it is false for everyone, and so is its negation;
 * - `never-matching-media`       an `@media` conjunction whose width bounds leave no viewport.
 *
 * Pure: no DOM, no Node built-ins (`purity.test.ts`).
 */

export type CssCheckRule =
  | "dropped-declaration"
  | "vendor-declaration-dropped"
  | "unknown-media-feature"
  | "never-matching-media";

export interface CssCheckFinding {
  rule: CssCheckRule;
  severity: "suspect" | "warn" | "info";
  selector?: string;
  sheet: string;
  line?: number;
  message: string;
}

/** One authored declaration the browser did not parse, once per rule (however many elements it matched). */
export interface DeclarationSample {
  selector: string;
  property: string;
  value: string;
  /** Where it is written: a file name, or `<style> in page.html`. */
  sheet: string;
  /** 1-based line in that file, when the protocol gave a range. */
  line?: number;
  /** Whether the browser knows the property name at all. */
  propertyKnown: boolean;
  /** For an unknown property: the nearest property the browser does know. */
  suggest?: string | null;
  /** How many inspected elements the rule matched. */
  elements: number;
}

/** One `@media` rule's condition, with the first atom the browser could not evaluate (or null). */
export interface MediaSample {
  condition: string;
  sheet: string;
  line?: number;
  unknownAtom: string | null;
}

/**
 * Media features a browser knows, for a "did you mean". The list only suggests: whether a
 * feature is unknown is the browser's call (`MEDIA_ATOM_PROBE_JS`), never this list's.
 */
export const KNOWN_MEDIA_FEATURES = [
  "prefers-reduced-motion",
  "prefers-color-scheme",
  "prefers-contrast",
  "prefers-reduced-transparency",
  "prefers-reduced-data",
  "forced-colors",
  "hover",
  "any-hover",
  "pointer",
  "any-pointer",
  "orientation",
  "min-width",
  "max-width",
  "width",
  "min-height",
  "max-height",
  "height",
  "aspect-ratio",
  "min-aspect-ratio",
  "max-aspect-ratio",
  "resolution",
  "min-resolution",
  "max-resolution",
  "color-gamut",
  "dynamic-range",
  "display-mode",
  "scripting",
  "inverted-colors",
  "update",
  "overflow-block",
  "overflow-inline",
  "monochrome",
  "color",
  "color-index",
  "grid",
] as const;

const editDistance = (a: string, b: string): number => {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cur = row[j]!;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
  }
  return row[b.length]!;
};

/** The candidate within 3 edits of `word` (the nearest; the first on a tie), or null. */
export function nearestWord(word: string, candidates: readonly string[]): string | null {
  let best: string | null = null;
  let bestDistance = Infinity;
  for (const c of candidates) {
    const d = editDistance(word, c);
    if (d < bestDistance) {
      bestDistance = d;
      best = c;
    }
  }
  return bestDistance <= 3 ? best : null;
}

export const nearestMediaFeature = (feature: string): string | null => nearestWord(feature, KNOWN_MEDIA_FEATURES);

/**
 * In-page JavaScript defining `unknownMediaAtom(condition)`: the first parenthesised atom of a
 * media condition the browser cannot evaluate, or null. Chromium keeps an unknown feature's text
 * and evaluates it as false, and its negation as false too; a known feature (and value) matches
 * exactly one of `(f)` and `not (f)`. Shared by `check animation` and `check css`.
 */
export const MEDIA_ATOM_PROBE_JS = `
  const unknownMediaAtom = (cond) => {
    for (const m of String(cond).matchAll(/\\(([^()]+)\\)/g)) {
      const atom = "(" + m[1] + ")";
      if (!window.matchMedia(atom).matches && !window.matchMedia("not " + atom).matches) return m[1].trim();
    }
    return null;
  };`;

/** A vendor prefix on the property or in the value: written for an engine, often on purpose for another one. */
export function isVendorDeclaration(property: string, value: string): boolean {
  const prefix = /^-(?:webkit|moz|ms|o|khtml)-/i;
  return prefix.test(property) || /(?:^|[\s,(])-(?:webkit|moz|ms|o|khtml)-/i.test(value);
}

const lengthPx = (n: number, unit: string): number | null =>
  unit === "px" ? n : unit === "em" || unit === "rem" ? n * 16 : null;

/**
 * The viewport widths a media condition allows, when it is a plain conjunction (`and` only, with
 * an optional `screen` / `all` type); null otherwise — a list, `or`, `not`, another media type, or
 * a width in a unit other than px / em / rem. Atoms on other features are ignored: when the
 * width bounds alone leave nothing, the conjunction is empty whatever they say. `em` in a media
 * query is the initial font size (16px), never the page's.
 */
export function mediaWidthRange(
  condition: string,
): { min: number; minOpen: boolean; max: number; maxOpen: boolean; empty: boolean } | null {
  const text = condition.trim().toLowerCase().replace(/\s+/g, " ");
  if (!text || text.includes(",") || /\b(?:or|not)\b/.test(text)) return null;
  let min = 0;
  let minOpen = false;
  let max = Infinity;
  let maxOpen = false;
  const lower = (v: number, open: boolean) => {
    if (v > min || (v === min && open)) [min, minOpen] = [v, open];
  };
  const upper = (v: number, open: boolean) => {
    if (v < max || (v === max && open)) [max, maxOpen] = [v, open];
  };
  const NUM = String.raw`(-?\d*\.?\d+)\s*(px|em|rem)`;
  for (const raw of text.split(/ and /)) {
    const part = raw.trim().replace(/^only /, "");
    if (part === "screen" || part === "all") continue;
    const atom = /^\((.*)\)$/.exec(part);
    if (!atom) return null; // a media type other than screen / all (print, …): not this rule's question
    const body = atom[1]!.trim();
    const legacy = new RegExp(`^(min|max)-width\\s*:\\s*${NUM}$`).exec(body);
    if (legacy) {
      const px = lengthPx(Number(legacy[2]), legacy[3]!);
      if (px === null) return null;
      legacy[1] === "min" ? lower(px, false) : upper(px, false);
      continue;
    }
    const one = new RegExp(`^width\\s*(<=|>=|<|>|=)\\s*${NUM}$`).exec(body);
    const flipped = new RegExp(`^${NUM}\\s*(<=|>=|<|>|=)\\s*width$`).exec(body);
    const both = new RegExp(`^${NUM}\\s*(<=|<)\\s*width\\s*(<=|<)\\s*${NUM}$`).exec(body);
    const apply = (op: string, px: number) => {
      if (op === ">=") lower(px, false);
      else if (op === ">") lower(px, true);
      else if (op === "<=") upper(px, false);
      else if (op === "<") upper(px, true);
      else (lower(px, false), upper(px, false));
    };
    const flip: Record<string, string> = { "<": ">", ">": "<", "<=": ">=", ">=": "<=", "=": "=" };
    if (one) {
      const px = lengthPx(Number(one[2]), one[3]!);
      if (px === null) return null;
      apply(one[1]!, px);
    } else if (flipped) {
      const px = lengthPx(Number(flipped[1]), flipped[2]!);
      if (px === null) return null;
      apply(flip[flipped[3]!]!, px);
    } else if (both) {
      const a = lengthPx(Number(both[1]), both[2]!);
      const b = lengthPx(Number(both[5]), both[6]!);
      if (a === null || b === null) return null;
      apply(both[3] === "<" ? ">" : ">=", a);
      apply(both[4]!, b);
    } else if (/(^|[^-])\bwidth\b/.test(body) && !/-width/.test(body)) {
      return null; // a width test this parser does not read: say nothing rather than guess
    }
  }
  const empty = min > max || (min === max && (minOpen || maxOpen));
  return { min, minOpen, max, maxOpen, empty };
}

const where = (sheet: string, line?: number) => (line === undefined ? sheet : `${sheet}:${line}`);

export function judgeCssCheck(input: {
  declarations: readonly DeclarationSample[];
  media: readonly MediaSample[];
}): CssCheckFinding[] {
  const out: CssCheckFinding[] = [];
  for (const d of input.declarations) {
    const at = where(d.sheet, d.line);
    const decl = `\`${d.property}: ${d.value}\``;
    if (isVendorDeclaration(d.property, d.value)) {
      out.push({
        rule: "vendor-declaration-dropped",
        severity: "info",
        selector: d.selector,
        sheet: d.sheet,
        ...(d.line !== undefined ? { line: d.line } : {}),
        message: `${d.selector} ${decl} (${at}) is not understood by this browser and was dropped; a vendor-prefixed fallback for another engine is usually meant that way`,
      });
      continue;
    }
    const why = d.propertyKnown
      ? `the value does not parse for \`${d.property}\`, so the browser drops the whole declaration and the previous value stays`
      : `\`${d.property}\` is an unknown property${d.suggest ? ` — did you mean \`${d.suggest}\`?` : ""}`;
    out.push({
      rule: "dropped-declaration",
      severity: "suspect",
      selector: d.selector,
      sheet: d.sheet,
      ...(d.line !== undefined ? { line: d.line } : {}),
      message: `${d.selector} ${decl} (${at}) is ignored: ${why}${d.elements > 1 ? ` (the rule matches ${d.elements} elements)` : ""}`,
    });
  }
  for (const m of input.media) {
    const at = where(m.sheet, m.line);
    const base = {
      selector: `@media ${m.condition}`,
      sheet: m.sheet,
      ...(m.line !== undefined ? { line: m.line } : {}),
    };
    if (m.unknownAtom !== null) {
      const feature = (/^\s*([a-z-]+)/i.exec(m.unknownAtom) ?? [])[1] ?? "";
      const suggest = feature ? nearestMediaFeature(feature) : null;
      out.push({
        rule: "unknown-media-feature",
        severity: "suspect",
        ...base,
        message: `@media ${m.condition} (${at}) never matches: the browser does not know \`(${m.unknownAtom})\`${feature ? ` — the feature \`${feature}\` or its value` : ""}, so the query is false for everyone and its rules never apply${suggest && suggest !== feature ? ` — did you mean \`${suggest}\`?` : ""}`,
      });
      continue;
    }
    const range = mediaWidthRange(m.condition);
    if (range?.empty)
      out.push({
        rule: "never-matching-media",
        severity: "suspect",
        ...base,
        message: `@media ${m.condition} (${at}) matches no viewport: its width must be ${range.minOpen ? ">" : ">="} ${range.min}px and ${range.maxOpen ? "<" : "<="} ${range.max}px at once — the bounds are swapped or overlap the wrong way`,
      });
  }
  return out;
}
