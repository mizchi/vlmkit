/**
 * Severity by persistence: a defect judged at several instants of a page's motion is tiered by
 * how long it holds, not by having appeared once.
 *
 * A layout judge run in the middle of a transition sees states no user dwells on — a card
 * crossing its neighbour for one frame of a slide-in. Reporting every such instant at full
 * severity makes per-instant judging unusable; reporting none hides the defect a user does
 * see, a label sitting under a panel for half a second. HyperFrames tiers the same way
 * (`applyPersistenceTier`, heygen-com/hyperframes `packages/cli/src/utils/layoutAudit.ts`):
 * one sample is a glimpse, consecutive samples are a state.
 *
 * Pure: samples in, tiered rows out. The caller chooses the instants and the key.
 */

export interface PersistenceSample<F> {
  /** The instant judged, in ms of page time. */
  atMs: number;
  /** Findings at this instant, each with the key that identifies "the same defect" across instants. */
  findings: readonly { key: string; finding: F }[];
}

export type PersistenceTier = "held" | "transient";

export interface PersistenceRow<F> {
  key: string;
  /** The finding as first seen. */
  finding: F;
  tier: PersistenceTier;
  /** Every instant it was seen at, in sample order. */
  seenAtMs: number[];
  /** First and last instant of its longest run of consecutive samples. */
  run: { fromMs: number; toMs: number; samples: number };
}

/**
 * Tier every finding the samples hold, except the ones in `atRest` (already reported by the
 * judge run on the settled page, so the timeline would only repeat them).
 *
 * `held`: present at `minHeldSamples` (default 2) or more CONSECUTIVE instants spanning at
 * least `minHeldMs` (default 200) — a state the page sits in. `transient`: never held that
 * long — a glimpse, reported without weight. Consecutive is by sample index, so the instants a
 * caller picks set the time resolution; a defect seen at the first and last instant but not
 * between is two glimpses, not a state.
 *
 * Both bounds, because either alone was wrong on real pages: instants picked from animation
 * boundaries bunch up (a 120ms end and a 125ms start), and two samples 10ms apart made a
 * solitaire card crossing its neighbour during the deal read as "held". 200ms is about where
 * a state stops being a flicker; HyperFrames' two-samples-on-its-grid comes to ~500ms.
 */
export function tierByPersistence<F>(
  samples: readonly PersistenceSample<F>[],
  atRest: ReadonlySet<string> = new Set(),
  options: { minHeldSamples?: number; minHeldMs?: number } = {},
): PersistenceRow<F>[] {
  const minHeld = Math.max(1, options.minHeldSamples ?? 2);
  const minHeldMs = Math.max(0, options.minHeldMs ?? 200);
  const byKey = new Map<string, { finding: F; indices: number[] }>();
  samples.forEach((sample, index) => {
    const seenHere = new Set<string>();
    for (const { key, finding } of sample.findings) {
      if (atRest.has(key) || seenHere.has(key)) continue;
      seenHere.add(key);
      const entry = byKey.get(key);
      if (entry) entry.indices.push(index);
      else byKey.set(key, { finding, indices: [index] });
    }
  });
  const rows: PersistenceRow<F>[] = [];
  for (const [key, { finding, indices }] of byKey) {
    let best = { from: indices[0]!, to: indices[0]! };
    let from = indices[0]!;
    for (let i = 1; i <= indices.length; i++) {
      if (i < indices.length && indices[i] === indices[i - 1]! + 1) continue;
      const to = indices[i - 1]!;
      if (to - from > best.to - best.from) best = { from, to };
      if (i < indices.length) from = indices[i]!;
    }
    const runSamples = best.to - best.from + 1;
    const spanMs = samples[best.to]!.atMs - samples[best.from]!.atMs;
    rows.push({
      key,
      finding,
      tier: runSamples >= minHeld && spanMs >= minHeldMs ? "held" : "transient",
      seenAtMs: indices.map((i) => samples[i]!.atMs),
      run: { fromMs: samples[best.from]!.atMs, toMs: samples[best.to]!.atMs, samples: runSamples },
    });
  }
  return rows.sort((a, b) => a.run.fromMs - b.run.fromMs || a.key.localeCompare(b.key));
}

/**
 * The instants to judge a page's motion at when the caller names none: each finite
 * animation's start, middle and end on the page timeline, plus 0, deduplicated and capped.
 * Start and end because that is where a transition's extreme states sit; the middle because
 * two elements crossing each other overlap there and nowhere else.
 */
export function timelineInstants(
  animations: readonly { startMs: number; durationMs: number; iterations: number | null }[],
  options: { maxInstants?: number; capMs?: number } = {},
): number[] {
  const cap = options.capMs ?? 5000;
  const max = Math.max(2, options.maxInstants ?? 12);
  const set = new Set<number>([0]);
  for (const a of animations) {
    if (a.durationMs <= 0) continue;
    const span = a.durationMs * (a.iterations === null ? 1 : Math.min(a.iterations, 3));
    for (const t of [a.startMs, a.startMs + span / 2, a.startMs + span - 1]) {
      if (t >= 0 && t <= cap) set.add(Math.round(t));
    }
  }
  let instants = [...set].sort((a, b) => a - b);
  if (instants.length > max) {
    // Evenly thinned, keeping both ends: the first and last instants are the motion's bounds.
    const step = (instants.length - 1) / (max - 1);
    instants = Array.from({ length: max }, (_, i) => instants[Math.round(i * step)]!);
    instants = [...new Set(instants)];
  }
  return instants;
}
