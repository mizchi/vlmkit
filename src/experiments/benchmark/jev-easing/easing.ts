/**
 * The easing side of the Jev easing bench, pure: the candidate timing functions as CSS defines
 * them, and the fit that names the one a sampled position curve follows.
 */

export const EASINGS = {
  linear: "linear",
  ease: "ease",
  "ease-in": "ease-in",
  "ease-out": "ease-out",
  "ease-in-out": "ease-in-out",
  steps: "steps(4, end)",
  overshoot: "cubic-bezier(0.34, 1.56, 0.64, 1)",
} as const;
export type EasingName = keyof typeof EASINGS;
export const EASING_NAMES = Object.keys(EASINGS) as EasingName[];

const BEZIER: Partial<Record<EasingName, [number, number, number, number]>> = {
  linear: [0, 0, 1, 1],
  ease: [0.25, 0.1, 0.25, 1],
  "ease-in": [0.42, 0, 1, 1],
  "ease-out": [0, 0, 0.58, 1],
  "ease-in-out": [0.42, 0, 0.58, 1],
  overshoot: [0.34, 1.56, 0.64, 1],
};

/** y at x on the cubic Bézier through (0,0), (x1,y1), (x2,y2), (1,1), x solved by bisection. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number, x: number): number {
  const at = (a: number, b: number, t: number) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (at(x1, x2, mid) < x) lo = mid;
    else hi = mid;
  }
  return at(y1, y2, (lo + hi) / 2);
}

/** Progress (0 at the start, 1 at the end) of a named easing at time fraction t. */
export function easingAt(name: EasingName, t: number): number {
  if (name === "steps") return t >= 1 ? 1 : Math.floor(t * 4 + 1e-9) / 4;
  const b = BEZIER[name]!;
  return cubicBezier(b[0], b[1], b[2], b[3], t);
}

/**
 * Name the easing a sampled curve follows: positions at evenly spaced times from start to end,
 * normalised by the first and last, compared with every candidate by squared error.
 */
export function fitEasing(positions: number[]): { best: EasingName; errors: Record<EasingName, number> } {
  const n = positions.length - 1;
  const span = positions[n]! - positions[0]!;
  const p = positions.map((v) => (span === 0 ? 0 : (v - positions[0]!) / span));
  const errors = Object.fromEntries(
    EASING_NAMES.map((e) => [e, p.reduce((s, v, i) => s + (v - easingAt(e, i / n)) ** 2, 0)]),
  ) as Record<EasingName, number>;
  const best = EASING_NAMES.reduce((a, b) => (errors[b] < errors[a] ? b : a));
  return { best, errors };
}
