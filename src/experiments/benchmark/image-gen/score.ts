/**
 * The image-generation bench's evaluation file and what is computed from it. Pure: the runner
 * writes the file, a scorer fills in the verdicts, and this reads it back.
 *
 * Verdicts are given by looking at the images (a person, or an agent's own vision), because what
 * the bench asks — does this picture say what the brief says — has no pixel metric. So the file
 * keeps who scored it, and the report says so.
 */
import { BRIEFS, briefHash, type Brief } from "./briefs.ts";

export const EVALUATION_SCHEMA = "vlmkit-image-gen-eval/1";

export type Verdict = "pass" | "partial" | "fail";

export interface Run {
  model: string;
  brief: string;
  costUsd: number | null;
  latencyMs: number;
  /** Image file name, relative to the evaluation's directory. */
  file?: string;
  error?: string;
}

export interface Score {
  model: string;
  brief: string;
  /** null until scored. */
  verdict: Verdict | null;
  note: string;
}

export interface Evaluation {
  schema: typeof EVALUATION_SCHEMA;
  date: string;
  /** Who gave the verdicts, e.g. "coding agent's own vision, by eye on the contact sheets". */
  scorer: string;
  briefs: Record<string, string>;
  runs: Run[];
  scores: Score[];
}

const POINTS: Record<Verdict, number> = { pass: 1, partial: 0.5, fail: 0 };
const MARK: Record<Verdict, string> = { pass: "✓", partial: "△", fail: "✗" };

export function newEvaluation(date: string, runs: Run[], briefs: Brief[] = BRIEFS): Evaluation {
  return {
    schema: EVALUATION_SCHEMA,
    date,
    scorer: "",
    briefs: Object.fromEntries(briefs.map((b) => [b.id, briefHash(b)])),
    runs,
    scores: runs.filter((r) => r.file).map((r) => ({ model: r.model, brief: r.brief, verdict: null, note: "" })),
  };
}

/** Everything that makes an evaluation unfit to rank models by, as sentences. Empty = usable. */
export function problems(ev: Evaluation, briefs: Brief[] = BRIEFS): string[] {
  const out: string[] = [];
  if (ev.schema !== EVALUATION_SCHEMA) out.push(`schema is ${ev.schema}, expected ${EVALUATION_SCHEMA}`);
  if (!ev.scorer.trim()) out.push("no scorer recorded");
  for (const [id, hash] of Object.entries(ev.briefs)) {
    const brief = briefs.find((b) => b.id === id);
    if (!brief) out.push(`brief ${id} no longer exists`);
    else if (briefHash(brief) !== hash)
      out.push(`brief ${id} changed since this evaluation (${hash} → ${briefHash(brief)}): re-run it`);
  }
  for (const r of ev.runs.filter((r) => r.file)) {
    const s = ev.scores.find((s) => s.model === r.model && s.brief === r.brief);
    if (!s || s.verdict === null) out.push(`${r.model} × ${r.brief} is not scored`);
    else if (s.verdict !== "pass" && !s.note.trim())
      out.push(`${r.model} × ${r.brief} is ${s.verdict} with no note saying why`);
  }
  for (const s of ev.scores) {
    if (!ev.runs.some((r) => r.file && r.model === s.model && r.brief === s.brief))
      out.push(`score for ${s.model} × ${s.brief} has no image`);
  }
  return out;
}

export interface Row {
  model: string;
  verdicts: Record<string, Score | undefined>;
  points: number;
  of: number;
  cost: [number, number] | null;
  latencyMs: [number, number];
  errors: string[];
}

const range = (xs: number[]): [number, number] => [Math.min(...xs), Math.max(...xs)];

/** One row per model, best first: points, then the cheaper worst-case image, then the faster. */
export function summarize(ev: Evaluation): Row[] {
  const models = [...new Set(ev.runs.map((r) => r.model))];
  const rows = models.map((model): Row => {
    const runs = ev.runs.filter((r) => r.model === model);
    const ok = runs.filter((r) => r.file);
    const verdicts = Object.fromEntries(
      Object.keys(ev.briefs).map((b) => [b, ev.scores.find((s) => s.model === model && s.brief === b)]),
    );
    const scored = Object.values(verdicts).filter((s): s is Score => !!s?.verdict);
    const costs = ok.map((r) => r.costUsd).filter((c): c is number => typeof c === "number");
    return {
      model,
      verdicts,
      points: scored.reduce((a, s) => a + POINTS[s.verdict!], 0),
      of: Object.keys(ev.briefs).length,
      cost: costs.length ? range(costs) : null,
      latencyMs: ok.length ? range(ok.map((r) => r.latencyMs)) : [0, 0],
      errors: runs.filter((r) => r.error).map((r) => `${r.brief}: ${r.error}`),
    };
  });
  return rows.sort(
    (a, b) =>
      b.points - a.points || (a.cost?.[1] ?? Infinity) - (b.cost?.[1] ?? Infinity) || a.latencyMs[1] - b.latencyMs[1],
  );
}

const money = (r: [number, number] | null) => {
  if (!r) return "?";
  const [a, b] = r.map((x) => x.toFixed(3));
  return a === b ? a : `${a}–${b}`;
};
const secs = (r: [number, number]) => {
  const [a, b] = r.map((ms) => Math.round(ms / 1000));
  return a === b ? `${a}s` : `${a}–${b}s`;
};

export function renderMarkdown(ev: Evaluation): string {
  const briefs = Object.keys(ev.briefs);
  const rows = summarize(ev);
  const cell = (s: Score | undefined) => (s?.verdict ? `${MARK[s.verdict]}${s.note ? ` ${s.note}` : ""}` : "—");
  const lines = [
    `| Model | ${briefs.join(" | ")} | score | $/image | time |`,
    `|---|${briefs.map(() => "---").join("|")}|---|---|---|`,
    ...rows.map((r) =>
      r.errors.length && !r.cost
        ? `| ${r.model} | ${briefs.map(() => "—").join(" | ")} | — | — | ${r.errors[0].slice(0, 80)} |`
        : `| ${r.model} | ${briefs.map((b) => cell(r.verdicts[b])).join(" | ")} | ${r.points}/${r.of} | ${money(r.cost)} | ${secs(r.latencyMs)} |`,
    ),
  ];
  const total = ev.runs.reduce((a, r) => a + (r.costUsd ?? 0), 0);
  return `${lines.join("\n")}\n\nScored by ${ev.scorer || "nobody yet"} on ${ev.date}. ${ev.runs.filter((r) => r.file).length} images, $${total.toFixed(2)}.\n`;
}
