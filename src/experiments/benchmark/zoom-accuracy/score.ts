/**
 * Scoring for the zoom accuracy bench: one planted change per case, an answer the model
 * writes as JSON, and a verdict that does not depend on reading prose. Pure — no browser,
 * no network — so the scorer is tested on its own and saved answers can be re-scored.
 *
 * What a case plants is chosen so a single look at a downscaled full-page screenshot can
 * plausibly miss it and a magnified crop cannot: a digit in small text, the colour of a
 * short label, an element nudged 1-6 CSS pixels. A `none` case plants nothing and scores
 * whether the model invents a change.
 */

export type CaseKind = "text" | "color" | "offset" | "none";
export const CASE_KINDS: readonly CaseKind[] = ["text", "color", "offset", "none"];

/** A box in CSS pixels of the captured page. */
export interface CssBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export type Expected =
  | { kind: "text"; oldText: string; newText: string; oldToken: string; newToken: string }
  | { kind: "color"; oldColor: string; newColor: string }
  | { kind: "offset"; dx: number; dy: number }
  | { kind: "none" };

export interface BenchCase {
  id: string;
  fixture: string;
  expected: Expected;
  /** The page as captured, in CSS pixels. */
  page: { width: number; height: number };
  deviceScaleFactor: number;
  /** Bounding box of every pixel that differs between the two captures; null for `none`. */
  diffBox: CssBox | null;
  /** Selector-ish path of the planted element, for reading a report. */
  target?: string;
}

/** The answer format the prompt asks for. Every field is optional because models omit them. */
export interface ModelAnswer {
  changed?: boolean;
  /** Where the change is in the current image, 0-1000 of its width and height. */
  box?: [number, number, number, number];
  kind?: string;
  old?: string;
  new?: string;
}

export interface CaseScore {
  /** The reply held a JSON object with a `changed` field. */
  parsed: boolean;
  /** `changed` matched whether anything was planted. */
  detected: boolean;
  /** The box's centre fell on the change (within LOCATE_SLACK_PX); null for `none` or no box. */
  located: boolean | null;
  /** The value read was right (text / colour / shift); null for `none`. */
  value: boolean | null;
  /** The headline number: detected, and for a planted change, the value right too. */
  correct: boolean;
  /** Why it is wrong, for the report. */
  note?: string;
}

/** CSS px a reported box centre may sit outside the true change and still count as located. */
export const LOCATE_SLACK_PX = 24;
/** Max per-channel error for a colour read to count; text antialiasing lightens small glyphs. */
export const COLOR_TOLERANCE = 48;
/**
 * CSS px a read shift may be off by: none. Shifts are 1-6px, and a 2x capture holds each CSS px
 * as two device px, so an exact read is possible from a magnified crop — which is the question.
 */
export const OFFSET_TOLERANCE_PX = 0;

export function buildPrompt(c: Pick<BenchCase, "page" | "deviceScaleFactor">): string {
  return [
    `Image 0 is the baseline screenshot and Image 1 the current screenshot of the same web page. ` +
      `The page is ${c.page.width}x${c.page.height} CSS pixels, captured at ${c.deviceScaleFactor}x device pixel ratio. ` +
      `At most one element differs between them; it is possible that nothing does.`,
    `Reply with one JSON object and nothing else:`,
    `{"changed": true|false, "box": [x1, y1, x2, y2], "kind": "text"|"color"|"position"|"other"|"none", "old": "...", "new": "..."}`,
    `- box: where the change is in Image 1, as 0-1000 of the image width and height, origin top-left. Omit it if nothing changed.`,
    `- kind "text": old and new are the element's full text before and after.`,
    `- kind "color": old and new are the element's text colour as #rrggbb.`,
    `- kind "position": new is the shift as "dx,dy" in CSS pixels (right and down are positive).`,
  ].join("\n");
}

/** The first balanced JSON object in a reply, with code fences and prose around it tolerated. */
export function parseAnswer(reply: string): ModelAnswer | null {
  for (let start = reply.indexOf("{"); start >= 0; start = reply.indexOf("{", start + 1)) {
    let depth = 0,
      inString = false,
      escaped = false;
    for (let i = start; i < reply.length; i++) {
      const ch = reply[i]!;
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === "\\") escaped = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') inString = true;
      else if (ch === "{") depth++;
      else if (ch === "}" && --depth === 0) {
        try {
          const value = JSON.parse(reply.slice(start, i + 1));
          if (value && typeof value === "object" && !Array.isArray(value)) return normalizeAnswer(value);
        } catch {
          /* not this one; try the next brace */
        }
        break;
      }
    }
  }
  return null;
}

function normalizeAnswer(v: Record<string, unknown>): ModelAnswer {
  const out: ModelAnswer = {};
  if (typeof v.changed === "boolean") out.changed = v.changed;
  else if (v.changed === "true" || v.changed === "false") out.changed = v.changed === "true";
  if (Array.isArray(v.box) && v.box.length === 4) {
    const nums = v.box.map(Number);
    if (nums.every(Number.isFinite)) out.box = nums as [number, number, number, number];
  }
  if (typeof v.kind === "string") out.kind = v.kind;
  if (v.old !== undefined && v.old !== null) out.old = String(v.old);
  if (v.new !== undefined && v.new !== null) out.new = String(v.new);
  return out;
}

const squash = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

export function parseHex(s: string | undefined): [number, number, number] | null {
  const m = s?.trim().match(/^#?([0-9a-f]{6}|[0-9a-f]{3})\b/i);
  if (!m) return null;
  const h =
    m[1]!.length === 3
      ? m[1]!
          .split("")
          .map((c) => c + c)
          .join("")
      : m[1]!;
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

export function colorDistance(a: [number, number, number], b: [number, number, number]): number {
  return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));
}

/** "dx,dy", "4, 0", "4px right", "+4 0": the first two signed numbers, missing dy read as 0. */
export function parseShift(s: string | undefined): { dx: number; dy: number } | null {
  if (!s) return null;
  const nums = [...s.matchAll(/[-+]?\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));
  if (nums.length === 0) return null;
  let dx = nums[0]!,
    dy = nums[1] ?? 0;
  if (nums.length === 1 && /\bleft\b/i.test(s)) dx = -Math.abs(dx);
  if (nums.length === 1 && /\b(up|down)\b/i.test(s)) {
    dy = /\bup\b/i.test(s) ? -Math.abs(dx) : Math.abs(dx);
    dx = 0;
  }
  return { dx, dy };
}

function located(c: BenchCase, a: ModelAnswer): boolean | null {
  if (!c.diffBox || !a.box) return null;
  const [x1, y1, x2, y2] = a.box;
  const cx = ((x1 + x2) / 2 / 1000) * c.page.width;
  const cy = ((y1 + y2) / 2 / 1000) * c.page.height;
  const b = c.diffBox;
  return (
    cx >= b.x1 - LOCATE_SLACK_PX &&
    cx <= b.x2 + LOCATE_SLACK_PX &&
    cy >= b.y1 - LOCATE_SLACK_PX &&
    cy <= b.y2 + LOCATE_SLACK_PX
  );
}

function valueRight(e: Expected, a: ModelAnswer): { ok: boolean; note?: string } {
  switch (e.kind) {
    case "text": {
      // The changed token (the run of non-space characters holding the edited digit), not the
      // whole text: a model that transcribes a 30-character label with one unrelated typo but
      // reads the digit right has read what the case is about.
      const got = squash(a.new ?? "");
      const ok = got.includes(squash(e.newToken));
      return ok ? { ok } : { ok, note: `read "${a.new ?? ""}", expected token "${e.newToken}"` };
    }
    case "color": {
      const got = parseHex(a.new);
      const want = parseHex(e.newColor)!;
      if (!got) return { ok: false, note: `no #rrggbb in "${a.new ?? ""}"` };
      const d = colorDistance(got, want);
      return d <= COLOR_TOLERANCE
        ? { ok: true }
        : { ok: false, note: `read ${a.new}, expected ${e.newColor} (off by ${d})` };
    }
    case "offset": {
      const got = parseShift(a.new);
      if (!got) return { ok: false, note: `no shift in "${a.new ?? ""}"` };
      const ok = Math.abs(got.dx - e.dx) <= OFFSET_TOLERANCE_PX && Math.abs(got.dy - e.dy) <= OFFSET_TOLERANCE_PX;
      return ok ? { ok } : { ok, note: `read ${got.dx},${got.dy}, expected ${e.dx},${e.dy}` };
    }
    case "none":
      return { ok: true };
  }
}

export function scoreAnswer(c: BenchCase, reply: string): CaseScore {
  const a = parseAnswer(reply);
  if (!a || a.changed === undefined) {
    return {
      parsed: false,
      detected: false,
      located: null,
      value: c.expected.kind === "none" ? null : false,
      correct: false,
      note: "no JSON answer with `changed`",
    };
  }
  const planted = c.expected.kind !== "none";
  const detected = a.changed === planted;
  if (!planted) {
    return {
      parsed: true,
      detected,
      located: null,
      value: null,
      correct: detected,
      ...(detected ? {} : { note: "reported a change where none was planted" }),
    };
  }
  const loc = located(c, a);
  if (!detected)
    return { parsed: true, detected, located: loc, value: false, correct: false, note: "missed the change" };
  const v = valueRight(c.expected, a);
  return { parsed: true, detected, located: loc, value: v.ok, correct: v.ok, ...(v.note ? { note: v.note } : {}) };
}

export interface ArmSummary {
  cases: number;
  correct: number;
  parsed: number;
  detected: number;
  /** Of the planted cases that reported a box. */
  located: number;
  locatable: number;
  byKind: Record<CaseKind, { cases: number; correct: number }>;
}

export function summarize(rows: readonly { case: BenchCase; score: CaseScore }[]): ArmSummary {
  const byKind = Object.fromEntries(CASE_KINDS.map((k) => [k, { cases: 0, correct: 0 }])) as ArmSummary["byKind"];
  const s: ArmSummary = { cases: 0, correct: 0, parsed: 0, detected: 0, located: 0, locatable: 0, byKind };
  for (const { case: c, score } of rows) {
    s.cases++;
    if (score.correct) s.correct++;
    if (score.parsed) s.parsed++;
    if (score.detected) s.detected++;
    if (score.located !== null) {
      s.locatable++;
      if (score.located) s.located++;
    }
    byKind[c.expected.kind].cases++;
    if (score.correct) byKind[c.expected.kind].correct++;
  }
  return s;
}

/**
 * The paired comparison that matters for "does zoom help": on the same cases, how many the
 * zoom arm got right that the single look got wrong, and the reverse. With n cases a raw
 * difference in accuracy hides whether zoom fixed some and broke others.
 */
export function pairedFlips(
  single: readonly CaseScore[],
  zoom: readonly CaseScore[],
): { fixed: number; broke: number; bothRight: number; bothWrong: number } {
  const out = { fixed: 0, broke: 0, bothRight: 0, bothWrong: 0 };
  for (let i = 0; i < Math.min(single.length, zoom.length); i++) {
    const a = single[i]!.correct,
      b = zoom[i]!.correct;
    if (!a && b) out.fixed++;
    else if (a && !b) out.broke++;
    else if (a && b) out.bothRight++;
    else out.bothWrong++;
  }
  return out;
}

/**
 * Exact two-sided sign test (McNemar's exact form) on the discordant pairs: the probability of
 * a split at least this lopsided if zoom made no difference. Small benches get a number that
 * says how little a 3-to-1 split means.
 */
export function signTestP(fixed: number, broke: number): number {
  const n = fixed + broke;
  if (n === 0) return 1;
  const k = Math.min(fixed, broke);
  let tail = 0;
  let coef = 1; // C(n, 0)
  for (let i = 0; i <= k; i++) {
    tail += coef;
    coef = (coef * (n - i)) / (i + 1);
  }
  return Math.min(1, (2 * tail) / 2 ** n);
}

/**
 * The reply a perfect reader would write for a case, from its ground truth. `--self-check`
 * scores it (and a reader that always says "unchanged") on the case set it just built: the
 * oracle must score every case and the blind reader exactly the `none` cases, or the scorer
 * or a case is wrong — which is worth knowing before a model's number is read.
 */
export function oracleReply(c: BenchCase): string {
  const e = c.expected;
  if (e.kind === "none") return JSON.stringify({ changed: false, kind: "none" });
  const b = c.diffBox!;
  const box = [b.x1 / c.page.width, b.y1 / c.page.height, b.x2 / c.page.width, b.y2 / c.page.height].map((v) =>
    Math.round(v * 1000),
  );
  const body =
    e.kind === "text"
      ? { kind: "text", old: e.oldText, new: e.newText }
      : e.kind === "color"
        ? { kind: "color", old: e.oldColor, new: e.newColor }
        : { kind: "position", new: `${e.dx},${e.dy}` };
  return JSON.stringify({ changed: true, box, ...body });
}
