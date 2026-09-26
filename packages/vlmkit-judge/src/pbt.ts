/**
 * Property-based search primitives: a seeded generator and the three shrinkers a
 * counterexample needs before a person can act on it.
 *
 * A generated failure is rarely the one to report. `check responsive` meets a text
 * block starved of width at 813x655 with the text scaled 1.25x; the reader needs to
 * know that the height and the text scale played no part, that every width from 700 to
 * 871 fails the same way, and which one declaration clears it. Those are three different
 * searches, and each one is here, written against an async oracle, so the layer that
 * owns the browser decides what "still fails" means and this one only decides where to
 * look next:
 *
 *   - `shrinkRecord`    QuickCheck's greedy shrink over a record of dimensions: try each
 *                        dimension's simpler values, keep any that still fails, repeat to
 *                        a fixpoint. Says which dimensions were needed.
 *   - `failingInterval` the contiguous run of integers around a failing point, found by
 *                        galloping out and bisecting back. A 1px-exact width range is what
 *                        lets a failure be pinned to a media-query boundary — or shown not
 *                        to touch one.
 *   - `minimizeSubset`  Zeller's ddmin, for "which of these candidate changes are needed":
 *                        the 1-minimal subset of items for which the oracle still holds.
 *
 * Every search takes a budget and says when it ran out, because an oracle here is a
 * browser reflow and a report that silently stopped short reads as a proven minimum.
 *
 * Pure: no DOM, no Node, no clock. The same seed yields the same cases on any machine.
 */

/** A seeded pseudo-random stream. The seed is the bug ID: print it with any failure. */
export interface Rng {
  readonly seed: number;
  /** Uniform in [0, 1). */
  next(): number;
  /** Uniform integer in [lo, hi], both inclusive. */
  int(lo: number, hi: number): number;
  /** True with probability `p`. */
  chance(p: number): boolean;
  pick<T>(items: readonly T[]): T;
}

/**
 * mulberry32: 32 bits of state, passes the usual statistical batteries for this use,
 * and is short enough to reimplement anywhere a failure must be replayed.
 */
export function createRng(seed: number): Rng {
  let state = (Math.trunc(seed) >>> 0) || 0x9e3779b9;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    seed,
    next,
    int: (lo, hi) => {
      const a = Math.ceil(Math.min(lo, hi));
      const b = Math.floor(Math.max(lo, hi));
      return a + Math.floor(next() * (b - a + 1));
    },
    chance: (p) => next() < p,
    pick: <T>(items: readonly T[]): T => {
      if (items.length === 0) throw new RangeError("pick from an empty list");
      return items[Math.floor(next() * items.length)]!;
    },
  };
}

/**
 * Shrink candidates for an integer, simplest first: the target itself, then values
 * halving the distance back toward `value` (QuickCheck's `shrinkIntegral`). Never
 * includes `value`.
 */
export function shrinkIntToward(value: number, target: number): number[] {
  if (value === target) return [];
  const out: number[] = [target];
  let distance = Math.trunc((value - target) / 2);
  while (distance !== 0) {
    const candidate = value - distance;
    if (candidate !== target && !out.includes(candidate)) out.push(candidate);
    distance = Math.trunc(distance / 2);
  }
  return out;
}

/** Shrink candidates for a value drawn from an ordered ladder: every rung before it. */
export function shrinkAlongLadder<T>(value: T, ladder: readonly T[]): T[] {
  const at = ladder.indexOf(value);
  return at <= 0 ? [] : ladder.slice(0, at);
}

export interface ShrinkStep {
  dimension: string;
  from: unknown;
  to: unknown;
}

export interface ShrinkResult<C> {
  value: C;
  /** Adopted steps, in order. A dimension with no step was needed to keep failing. */
  steps: ShrinkStep[];
  /** Oracle calls spent. */
  attempts: number;
  /** True when the budget ran out before a fixpoint: the value is smaller, not minimal. */
  exhausted: boolean;
}

export type ShrinkCandidates<C> = {
  [K in keyof C]?: (value: C[K], current: C) => readonly C[K][];
};

/**
 * Greedy integrated shrinking over a record. For each dimension in declaration order,
 * the first candidate that still fails is adopted and the pass restarts, so earlier
 * dimensions are revisited once later ones have moved. Stops at a fixpoint or when the
 * budget is spent.
 */
export async function shrinkRecord<C extends object>(
  start: C,
  candidates: ShrinkCandidates<C>,
  stillFails: (candidate: C) => Promise<boolean>,
  budget = 64,
): Promise<ShrinkResult<C>> {
  let current = start;
  const steps: ShrinkStep[] = [];
  let attempts = 0;
  const keys = Object.keys(candidates) as (keyof C)[];
  let progressed = true;
  while (progressed) {
    progressed = false;
    for (const key of keys) {
      const shrinker = candidates[key];
      if (!shrinker) continue;
      for (const value of shrinker(current[key], current)) {
        if (Object.is(value, current[key])) continue;
        if (attempts >= budget) return { value: current, steps, attempts, exhausted: true };
        attempts++;
        const next = { ...current, [key]: value } as C;
        if (await stillFails(next)) {
          steps.push({ dimension: String(key), from: current[key], to: value });
          current = next;
          progressed = true;
          break;
        }
      }
      if (progressed) break;
    }
  }
  return { value: current, steps, attempts, exhausted: false };
}

export interface IntervalResult {
  /** Lowest failing integer found contiguous with the start. */
  lo: number;
  /** Highest failing integer found contiguous with the start. */
  hi: number;
  /** True when `lo` is the search minimum: the failure may continue below it. */
  atMin: boolean;
  /** True when `hi` is the search maximum. */
  atMax: boolean;
  attempts: number;
  exhausted: boolean;
}

/**
 * The run of failing integers around `at`, which must fail. Gallops outward (1, 2, 4,
 * … steps) until a passing point or the bound, then bisects between the last failure
 * and the first pass, so each edge costs O(log distance) oracle calls and is exact to 1.
 *
 * Contiguity is assumed between probes, not proven: a pass pocket narrower than the
 * gallop's stride can be stepped over. The caller reports failures seen outside the
 * interval separately rather than trusting it to be the only one.
 */
export async function failingInterval(
  at: number,
  min: number,
  max: number,
  fails: (x: number) => Promise<boolean>,
  budget = 48,
): Promise<IntervalResult> {
  let attempts = 0;
  let exhausted = false;
  const probe = async (x: number): Promise<boolean | null> => {
    if (attempts >= budget) {
      exhausted = true;
      return null;
    }
    attempts++;
    return await fails(x);
  };

  const edge = async (direction: -1 | 1): Promise<{ edge: number; atBound: boolean }> => {
    const bound = direction < 0 ? min : max;
    let lastFail = at;
    let firstPass: number | null = null;
    let stride = 1;
    while (firstPass === null) {
      if (lastFail === bound) return { edge: bound, atBound: true };
      const x = direction < 0 ? Math.max(bound, lastFail - stride) : Math.min(bound, lastFail + stride);
      const result = await probe(x);
      if (result === null) return { edge: lastFail, atBound: false };
      if (result) {
        lastFail = x;
        stride *= 2;
      } else {
        firstPass = x;
      }
    }
    // Bisect the open gap between lastFail and firstPass.
    let failing = lastFail;
    let passing = firstPass;
    while (Math.abs(passing - failing) > 1) {
      const mid = Math.trunc((failing + passing) / 2);
      const result = await probe(mid);
      if (result === null) break;
      if (result) failing = mid;
      else passing = mid;
    }
    return { edge: failing, atBound: false };
  };

  const low = await edge(-1);
  const high = await edge(1);
  return { lo: low.edge, hi: high.edge, atMin: low.atBound, atMax: high.atBound, attempts, exhausted };
}

/**
 * The smallest `x` in (lo, hi] whose oracle disagrees with `lo`'s, given that `hi`'s
 * does. Used to pin a media-query transition that no parsed number predicted.
 */
export async function bisectChange(
  lo: number,
  hi: number,
  sameAsLo: (x: number) => Promise<boolean>,
): Promise<number> {
  let same = lo;
  let changed = hi;
  while (changed - same > 1) {
    const mid = Math.trunc((same + changed) / 2);
    if (await sameAsLo(mid)) same = mid;
    else changed = mid;
  }
  return changed;
}

export interface SubsetResult<T> {
  subset: T[];
  attempts: number;
  /** False when the budget ran out: the subset still holds, but may not be 1-minimal. */
  complete: boolean;
}

/**
 * ddmin (Zeller & Hildebrandt 2002): given that `holds(items)` is true, return a
 * 1-minimal subset for which it is still true — removing any single remaining item
 * makes it false. Returns `null` when the full set does not hold (nothing to minimize).
 *
 * `holds` is whatever outcome the caller is isolating; `check responsive` asks "does
 * overriding exactly these declarations clear the failure", so the result is the
 * smallest set of declarations that explains it.
 */
export async function minimizeSubset<T>(
  items: readonly T[],
  holds: (subset: T[]) => Promise<boolean>,
  budget = 64,
): Promise<SubsetResult<T> | null> {
  let attempts = 1;
  if (!(await holds([...items]))) return null;
  let current = [...items];
  let granularity = 2;
  const test = async (subset: T[]): Promise<boolean | null> => {
    if (attempts >= budget) return null;
    attempts++;
    return await holds(subset);
  };
  while (current.length >= 2) {
    const chunks = split(current, granularity);
    let reduced = false;
    // Try each chunk alone, then each complement.
    for (const chunk of chunks) {
      const result = await test(chunk);
      if (result === null) return { subset: current, attempts, complete: false };
      if (result) {
        current = chunk;
        granularity = 2;
        reduced = true;
        break;
      }
    }
    if (!reduced && granularity > 2) {
      for (let i = 0; i < chunks.length; i++) {
        const complement = chunks.filter((_, j) => j !== i).flat();
        const result = await test(complement);
        if (result === null) return { subset: current, attempts, complete: false };
        if (result) {
          current = complement;
          granularity = Math.max(granularity - 1, 2);
          reduced = true;
          break;
        }
      }
    }
    if (!reduced) {
      if (granularity >= current.length) break;
      granularity = Math.min(granularity * 2, current.length);
    }
  }
  return { subset: current, attempts, complete: true };
}

function split<T>(items: T[], parts: number): T[][] {
  const out: T[][] = [];
  const size = items.length / parts;
  for (let i = 0; i < parts; i++) {
    const chunk = items.slice(Math.round(i * size), Math.round((i + 1) * size));
    if (chunk.length > 0) out.push(chunk);
  }
  return out;
}
