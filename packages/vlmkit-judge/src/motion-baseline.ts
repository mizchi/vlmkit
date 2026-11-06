/**
 * What a passing `inspect motion` run measured, kept so a later run can be held to it
 * (`inspect motion --baseline <file>`, issue #214).
 *
 * `snapshot` and `check story` hold a page's pixels at rest. Nothing held its motion: once an
 * agent's animation passed, a later edit could change its duration, curve, pivot or direction and
 * every rule would still pass, because the rules judge a motion against itself and against the
 * `--expect-*` flags given, not against what was approved. A baseline is that approval: the
 * numbers each target's line reports, and a comparison that names what moved past a tolerance.
 *
 * Tolerances are what the measurement can tell apart, not taste: one 60fps frame for a time,
 * 2px for a place (`--selector` boxes are exact; a `--track` match is to a tenth of a pixel), 2°
 * for a turn, 5% for a travel, and an easing only when both runs name their curve clearly (the fit
 * ahead of the next curve by 1.5x or more — the threshold `easing-unchecked` uses).
 *
 * Pure: reports in, a summary or a list of changes out.
 */
import type { MotionPathReport } from "./motion-path.ts";

export const MOTION_BASELINE_FORMAT = "vlmkit-motion-baseline/1";

/** One target's motion as approved. Absent fields were not measured for it. */
export interface MotionBaselineTarget {
  target: string;
  startsAtMs?: number;
  durationMs?: number;
  /** Null: it repeats forever. */
  iterations?: number | null;
  travelPx: number;
  /** The first segment's way. */
  direction?: string;
  /** The first segment's fitted curve, and how far ahead of the next one it is. */
  easing?: { name: string; margin: number };
  /** The point a scale keeps still, as a share of the box (null: that axis does not scale). */
  origin?: { fx: number | null; fy: number | null; name: string | null };
  /** The point a change of size keeps still. */
  growsFrom?: { fx: number | null; fy: number | null; name: string | null };
  /** The point a turn keeps still, as a share of the box. */
  pivot?: { fx: number | null; fy: number | null; name: string | null };
  turnDeg?: number;
  /** Its centre at rest (the last frame measured). */
  rest?: { x: number; y: number };
}

export interface MotionBaseline {
  format: typeof MOTION_BASELINE_FORMAT;
  /** The page, as it was named when the baseline was written. */
  source: string;
  /** The `--expect-*` flags of that run, for the reader: a baseline does not re-check them. */
  expected: string[];
  targets: MotionBaselineTarget[];
}

export interface MotionBaselineChange {
  target: string;
  /** What changed, one phrase each: "runs 250ms → 400ms". */
  changes: string[];
}

/** Ahead of the next curve by this much, a fitted easing is a name worth holding. */
export const BASELINE_EASING_MARGIN = 1.5;
const FRAME_MS = 1000 / 60;
const PLACE_PX = 2;
const TURN_DEG = 2;
const SHARE = 0.05;

const round = (v: number, k = 10) => Math.round(v * k) / k;

/** The numbers each target's line reports, as a baseline keeps them. */
export function summarizeMotion(targets: readonly (MotionPathReport & { target: string })[]): MotionBaselineTarget[] {
  return targets.map((t) => {
    const first = t.segments[0];
    const rest = [...t.path].reverse().find((p) => p.rest) ?? t.path.at(-1);
    const point = (o: { fx: number | null; fy: number | null; name?: string | null } | undefined) =>
      o
        ? {
            fx: o.fx === null ? null : round(o.fx, 1000),
            fy: o.fy === null ? null : round(o.fy, 1000),
            name: o.name ?? null,
          }
        : undefined;
    const origin = point(t.segments.find((g) => g.origin)?.origin);
    const growsFrom = point(t.growsFrom);
    const pivot = point(t.pivot);
    return {
      target: t.target,
      ...(t.startsAtMs !== undefined ? { startsAtMs: round(t.startsAtMs) } : {}),
      ...(t.durationMs !== undefined ? { durationMs: round(t.durationMs) } : {}),
      ...(t.iterations !== undefined ? { iterations: t.iterations } : {}),
      travelPx: round(t.travelPx),
      ...(first?.direction ? { direction: first.direction.way } : {}),
      ...("best" in t.easing ? { easing: { name: t.easing.best, margin: round(t.easing.margin, 100) } } : {}),
      ...(origin ? { origin } : {}),
      ...(growsFrom ? { growsFrom } : {}),
      ...(pivot ? { pivot } : {}),
      ...(t.turn ? { turnDeg: round(t.turn.deg) } : {}),
      ...(rest ? { rest: { x: round(rest.x), y: round(rest.y) } } : {}),
    };
  });
}

const ms = (v: number) => `${Math.round(v)}ms`;
const px = (v: number) => `${Math.round(v)}px`;
const pointText = (o: { fx: number | null; fy: number | null; name: string | null }) =>
  o.name ??
  `(${o.fx === null ? "-" : `${Math.round(o.fx * 100)}%`}, ${o.fy === null ? "-" : `${Math.round(o.fy * 100)}%`} of its box)`;
const runsText = (v: number | null | undefined) => (v === null ? "forever" : `x${v}`);

function pointMoved(
  a: { fx: number | null; fy: number | null } | undefined,
  b: { fx: number | null; fy: number | null } | undefined,
): boolean {
  if (!a || !b) return false;
  const axis = (x: number | null, y: number | null) =>
    (x === null) !== (y === null) || (x !== null && Math.abs(x - y!) > SHARE);
  return axis(a.fx, b.fx) || axis(a.fy, b.fy);
}

/**
 * What changed for each target since the baseline, past the tolerances. A target in one and not
 * the other is a change of its own; targets are matched by name, in order.
 */
export function compareMotionBaseline(
  baseline: readonly MotionBaselineTarget[],
  current: readonly MotionBaselineTarget[],
): MotionBaselineChange[] {
  const out: MotionBaselineChange[] = [];
  const used = new Set<number>();
  for (const now of current) {
    const k = baseline.findIndex((b, i) => !used.has(i) && b.target === now.target);
    if (k < 0) {
      out.push({
        target: now.target,
        changes: ["not in the baseline: write it again with --update-baseline if it is new"],
      });
      continue;
    }
    used.add(k);
    const was = baseline[k]!;
    const changes: string[] = [];
    if (
      was.startsAtMs !== undefined &&
      now.startsAtMs !== undefined &&
      Math.abs(was.startsAtMs - now.startsAtMs) > FRAME_MS
    )
      changes.push(`begins at ${ms(was.startsAtMs)} → ${ms(now.startsAtMs)}`);
    if (
      was.durationMs !== undefined &&
      now.durationMs !== undefined &&
      Math.abs(was.durationMs - now.durationMs) > FRAME_MS
    )
      changes.push(`runs ${ms(was.durationMs)} → ${ms(now.durationMs)}`);
    if (was.iterations !== undefined && now.iterations !== undefined && was.iterations !== now.iterations)
      changes.push(`runs ${runsText(was.iterations)} → ${runsText(now.iterations)}`);
    if (Math.abs(was.travelPx - now.travelPx) > Math.max(PLACE_PX, SHARE * was.travelPx))
      changes.push(`travels ${px(was.travelPx)} → ${px(now.travelPx)}`);
    if (was.direction && now.direction && was.direction !== now.direction)
      changes.push(`moves ${was.direction} → ${now.direction}`);
    else if (was.direction && !now.direction && now.travelPx < PLACE_PX)
      changes.push(`moves ${was.direction} → does not move`);
    if (
      was.easing &&
      now.easing &&
      was.easing.name !== now.easing.name &&
      was.easing.margin >= BASELINE_EASING_MARGIN &&
      now.easing.margin >= BASELINE_EASING_MARGIN
    )
      changes.push(`follows ${was.easing.name} → ${now.easing.name}`);
    for (const [label, a, b] of [
      ["scales about", was.origin, now.origin],
      ["grows from", was.growsFrom, now.growsFrom],
      ["turns about", was.pivot, now.pivot],
    ] as const)
      if (pointMoved(a, b)) changes.push(`${label} ${pointText(a!)} → ${pointText(b!)}`);
    if (was.turnDeg !== undefined || now.turnDeg !== undefined) {
      const a = was.turnDeg ?? 0;
      const b = now.turnDeg ?? 0;
      if (Math.abs(a - b) > TURN_DEG) changes.push(`turns ${Math.round(a)}° → ${Math.round(b)}°`);
    }
    if (was.rest && now.rest && Math.hypot(was.rest.x - now.rest.x, was.rest.y - now.rest.y) > PLACE_PX)
      changes.push(
        `rests at (${Math.round(was.rest.x)},${Math.round(was.rest.y)}) → (${Math.round(now.rest.x)},${Math.round(now.rest.y)})`,
      );
    if (changes.length > 0) out.push({ target: now.target, changes });
  }
  for (const [i, b] of baseline.entries())
    if (!used.has(i)) out.push({ target: b.target, changes: ["in the baseline, not measured in this run"] });
  return out;
}

/** Read a baseline file's text, refusing anything else by name. */
export function parseMotionBaseline(text: string, path: string): MotionBaseline {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(`--baseline ${path}: not JSON (${(error as Error).message})`);
  }
  const record = parsed as Partial<MotionBaseline> | null;
  if (!record || record.format !== MOTION_BASELINE_FORMAT || !Array.isArray(record.targets))
    throw new Error(
      `--baseline ${path} is not a motion baseline (format ${JSON.stringify(record?.format ?? null)}; expected "${MOTION_BASELINE_FORMAT}")`,
    );
  return record as MotionBaseline;
}
