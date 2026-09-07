/**
 * Visual review of a contact sheet by a vision model — or by any reader that
 * can look at a PNG and fill in JSON — and the comparison of that reading
 * against the deterministic layout report.
 *
 * Three pieces, so the same protocol runs with an API key (`vlmkit-anim review
 * --model`), with an agent looking at the sheet (`--answers` its JSON), or with
 * a person:
 *
 *   reviewBrief()   the prompt: what the tiles are, what counts as an issue, the JSON to return
 *   parseAnswers()  the reader's JSON, checked against that shape
 *   scoreReview()   frame-level agreement with `layoutReport`: both flag / only the model / only the geometry
 *
 * The score is per frame, not per element: readers name things in words
 * ("the Batch 2 label sits on box3"), the geometry names node ids, and the
 * question a round asks is whether they see the same frames as broken.
 */

import type { LayoutReport } from "./layout.ts";

export interface ReviewTile {
  index: number;
  step?: number;
  t: number;
  caption?: string;
}

export interface ReviewIssue {
  kind: "overlap" | "clipped" | "crossed" | "offscreen" | "illegible" | "other";
  what: string;
  severity?: "minor" | "major";
}

export interface ReviewFrame {
  frame: number;
  issues: ReviewIssue[];
}

export interface ReviewAnswers {
  frames: ReviewFrame[];
  /** Free text the reader wanted to add. */
  notes?: string;
}

export const REVIEW_KINDS = ["overlap", "clipped", "crossed", "offscreen", "illegible", "other"] as const;

/** The brief a reader gets with the sheet. `tiles` come from the sheet's own labels. */
export function reviewBrief(title: string, tiles: ReviewTile[]): string {
  const list = tiles.map((t) => `- frame ${t.index}${t.step !== undefined ? ` (step ${t.step})` : ""}, ${Math.round(t.t)}ms${t.caption ? `: ${t.caption}` : ""}`).join("\n");
  return `# Visual review: ${title}

The image is a contact sheet: every frame of one explanatory animation, in reading order, each
tile labelled with its frame number, step and time, with the step's caption under it.

Look at each tile and report **layout defects only** — not whether the explanation is good:

- **overlap**: two pieces of text on top of each other, or text under a filled box that is not its own
  (a label on a column header, a readout under an arrow's label, a callout box hiding a cell).
- **clipped**: text cut off at the tile's edge (a title missing its first letters, a caption running out).
- **crossed**: a line or arrow drawn straight through a label, or through a box that is not one of its ends.
- **offscreen**: an arrow, box or label that clearly continues past the edge of the frame.
- **illegible**: text too small or too crowded to read at this size.
- **other**: anything else that looks wrong in the drawing (an arrow pointing at nothing, a line through a box).

Do not report the caption under a tile (it is outside the frame), and do not report the tile borders.
Report each defect once per frame it appears in; if a defect persists across frames, list it for every
frame where it is visible.

Frames on this sheet:
${list}

Return **only** JSON of this shape, one entry per frame (include frames with an empty issues list):

\`\`\`json
{
  "frames": [
    { "frame": 1, "issues": [] },
    { "frame": 7, "issues": [ { "kind": "overlap", "what": "label 'Batch 2' sits on the column header 'box3'", "severity": "minor" } ] }
  ],
  "notes": "optional, anything you were unsure about"
}
\`\`\`
`;
}

/** Tiles as the sheet renders them, from the same sample times. */
export function reviewTiles(tl: { steps?: { t: number; caption?: string }[] }, times: number[]): ReviewTile[] {
  const steps = [...(tl.steps ?? [])].sort((a, b) => a.t - b.t);
  return times.map((t, i) => {
    let stepIndex = -1;
    for (let k = 0; k < steps.length; k++) if (steps[k].t <= t) stepIndex = k;
    const step = stepIndex >= 0 ? steps[stepIndex] : undefined;
    return { index: i + 1, step: step ? stepIndex + 1 : undefined, t, caption: step?.caption };
  });
}

/** Parse a reader's JSON (a fenced block is tolerated). Throws with a reason a reader can act on. */
export function parseAnswers(text: string): ReviewAnswers {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (fenced ? fenced[1] : text).trim();
  let raw: unknown;
  try {
    raw = JSON.parse(body);
  } catch (e) {
    throw new Error(`review answers are not JSON: ${(e as Error).message}`);
  }
  if (typeof raw !== "object" || raw === null || !Array.isArray((raw as { frames?: unknown }).frames)) {
    throw new Error('review answers need {"frames": [...]}');
  }
  const frames = ((raw as { frames: unknown[] }).frames).map((f, i) => {
    if (typeof f !== "object" || f === null) throw new Error(`frames[${i}] is not an object`);
    const fr = f as { frame?: unknown; issues?: unknown };
    if (typeof fr.frame !== "number") throw new Error(`frames[${i}].frame must be a number`);
    const issues = Array.isArray(fr.issues) ? fr.issues : [];
    return {
      frame: fr.frame,
      issues: issues.map((it, j) => {
        const is = (it ?? {}) as { kind?: unknown; what?: unknown; severity?: unknown };
        const kind = REVIEW_KINDS.includes(is.kind as (typeof REVIEW_KINDS)[number]) ? (is.kind as ReviewIssue["kind"]) : "other";
        if (typeof is.what !== "string") throw new Error(`frames[${i}].issues[${j}].what must be a string`);
        const severity: ReviewIssue["severity"] = is.severity === "major" || is.severity === "minor" ? is.severity : undefined;
        const issue: ReviewIssue = { kind, what: is.what, ...(severity ? { severity } : {}) };
        return issue;
      }),
    };
  });
  const notes = typeof (raw as { notes?: unknown }).notes === "string" ? (raw as { notes: string }).notes : undefined;
  return { frames, ...(notes ? { notes } : {}) };
}

export interface ReviewScoreFrame {
  frame: number;
  geometry: number;
  reader: number;
  /** both | reader-only | geometry-only | neither */
  agreement: "both" | "reader-only" | "geometry-only" | "neither";
}

export interface ReviewScore {
  frames: ReviewScoreFrame[];
  totals: {
    frames: number;
    both: number;
    readerOnly: number;
    geometryOnly: number;
    neither: number;
    /** Of the frames the geometry flags, how many the reader also flagged. */
    recall: number;
    /** Of the frames the reader flags, how many the geometry also flagged. */
    precision: number;
    readerIssues: number;
    geometryIssues: number;
  };
}

/** Frame-level agreement between the geometry and a reader. Frames the reader did not mention count as clean. */
export function scoreReview(report: LayoutReport, answers: ReviewAnswers): ReviewScore {
  const byFrame = new Map(answers.frames.map((f) => [f.frame, f.issues.length]));
  const frames: ReviewScoreFrame[] = report.frames.map((f) => {
    const geometry = f.issues.length;
    const reader = byFrame.get(f.index) ?? 0;
    const agreement = geometry && reader ? "both" : reader ? "reader-only" : geometry ? "geometry-only" : "neither";
    return { frame: f.index, geometry, reader, agreement };
  });
  const both = frames.filter((f) => f.agreement === "both").length;
  const readerOnly = frames.filter((f) => f.agreement === "reader-only").length;
  const geometryOnly = frames.filter((f) => f.agreement === "geometry-only").length;
  const neither = frames.filter((f) => f.agreement === "neither").length;
  const r = (n: number, d: number) => (d ? Math.round((n / d) * 100) / 100 : 1);
  return {
    frames,
    totals: {
      frames: frames.length,
      both,
      readerOnly,
      geometryOnly,
      neither,
      recall: r(both, both + geometryOnly),
      precision: r(both, both + readerOnly),
      readerIssues: answers.frames.reduce((s, f) => s + f.issues.length, 0),
      geometryIssues: report.frames.reduce((s, f) => s + f.issues.length, 0),
    },
  };
}

export function formatScore(score: ReviewScore, report: LayoutReport, answers: ReviewAnswers): string {
  const lines = ["| frame | geometry | reader | agreement |", "|---|---|---|---|"];
  for (const f of score.frames) {
    const g = report.frames[f.frame - 1]?.issues.map((i) => `${i.kind}: ${i.texts.filter(Boolean).map((t) => `"${t}"`).join(" on ")}`).join("; ") || "—";
    const rd = answers.frames.find((a) => a.frame === f.frame)?.issues.map((i) => `${i.kind}: ${i.what}`).join("; ") || "—";
    lines.push(`| ${f.frame} | ${g} | ${rd} | ${f.agreement} |`);
  }
  const t = score.totals;
  lines.push("");
  lines.push(
    `${t.frames} frames · both ${t.both} · reader only ${t.readerOnly} · geometry only ${t.geometryOnly} · neither ${t.neither} · ` +
      `recall ${t.recall} (of the geometry's flagged frames, the reader saw) · precision ${t.precision} (of the reader's, the geometry agrees) · ` +
      `${t.readerIssues} reader issue(s) vs ${t.geometryIssues} geometry issue(s)`,
  );
  if (answers.notes) lines.push("", `notes: ${answers.notes}`);
  return lines.join("\n");
}
