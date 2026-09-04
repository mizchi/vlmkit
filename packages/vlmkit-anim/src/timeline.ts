/**
 * Headless evaluation of a Timeline: what every node looks like at time `t`.
 *
 * This is the same arithmetic the browser runtime delegates to the Web
 * Animations API, re-implemented so a frame can be rendered without a browser
 * (`render-svg.ts`) and so semantic checks can ask "where is node X at step
 * 3?" (`check.ts`). Easings follow the CSS spec, so a sampled frame matches
 * what `<vlm-anim>` paints at the same `currentTime` up to rounding.
 */

import type { Easing, Keyframe, Timeline, TimelineNode, TrackProp, TrackValue, Vec2 } from "./types.ts";

// ---------------------------------------------------------------------------
// Easing
// ---------------------------------------------------------------------------

const BEZIERS: Record<string, [number, number, number, number]> = {
  ease: [0.25, 0.1, 0.25, 1],
  "ease-in": [0.42, 0, 1, 1],
  "ease-out": [0, 0, 0.58, 1],
  "ease-in-out": [0.42, 0, 0.58, 1],
};

/** Solve x(t) = x for a CSS cubic-bezier and return y. Newton + bisection fallback. */
function cubicBezier(p1x: number, p1y: number, p2x: number, p2y: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const cx = 3 * p1x;
  const bx = 3 * (p2x - p1x) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * p1y;
  const by = 3 * (p2y - p1y) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  let t = x;
  for (let i = 0; i < 8; i++) {
    const err = sampleX(t) - x;
    if (Math.abs(err) < 1e-6) return sampleY(t);
    const d = slopeX(t);
    if (Math.abs(d) < 1e-6) break;
    t -= err / d;
  }
  let lo = 0;
  let hi = 1;
  t = x;
  while (hi - lo > 1e-6) {
    if (sampleX(t) < x) lo = t;
    else hi = t;
    t = (lo + hi) / 2;
  }
  return sampleY(t);
}

export function ease(name: Easing | undefined, p: number): number {
  const e = name ?? "ease-in-out";
  if (e === "linear") return p;
  if (e === "step-end") return p >= 1 ? 1 : 0;
  if (e === "step-start") return p > 0 ? 1 : 0;
  const named = BEZIERS[e];
  if (named) return cubicBezier(...named, p);
  const m = /^cubic-bezier\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)$/.exec(e);
  if (m) return cubicBezier(Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4]), p);
  return p;
}

// ---------------------------------------------------------------------------
// Interpolation
// ---------------------------------------------------------------------------

function parseColor(c: string): [number, number, number, number] | null {
  const s = c.trim().toLowerCase();
  const hex = /^#([0-9a-f]{3,8})$/.exec(s);
  if (hex) {
    let h = hex[1];
    if (h.length === 3 || h.length === 4) h = [...h].map((ch) => ch + ch).join("");
    if (h.length === 6) h += "ff";
    if (h.length !== 8) return null;
    const n = parseInt(h, 16);
    return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, (n & 255) / 255];
  }
  const rgb = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(s);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3]), rgb[4] === undefined ? 1 : Number(rgb[4])];
  const NAMED: Record<string, string> = {
    white: "#ffffff", black: "#000000", red: "#ff0000", green: "#008000", blue: "#0000ff", gray: "#808080",
    grey: "#808080", orange: "#ffa500", yellow: "#ffff00", none: "#00000000", transparent: "#00000000",
  };
  return NAMED[s] ? parseColor(NAMED[s]) : null;
}

function mixColor(a: string, b: string, p: number): string {
  const ca = parseColor(a);
  const cb = parseColor(b);
  if (!ca || !cb) return p < 0.5 ? a : b;
  const ch = (i: number) => Math.round(ca[i] + (cb[i] - ca[i]) * p);
  const alpha = ca[3] + (cb[3] - ca[3]) * p;
  if (alpha >= 0.999) return `#${[ch(0), ch(1), ch(2)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
  return `rgba(${ch(0)}, ${ch(1)}, ${ch(2)}, ${Math.round(alpha * 1000) / 1000})`;
}

export function lerpValue(prop: TrackProp, a: TrackValue, b: TrackValue, p: number): TrackValue {
  if (prop === "text") return p >= 1 ? b : a;
  if (prop === "fill" || prop === "stroke" || prop === "color") return mixColor(String(a), String(b), p);
  if (Array.isArray(a) && Array.isArray(b)) return [a[0] + (b[0] - a[0]) * p, a[1] + (b[1] - a[1]) * p];
  if (typeof a === "number" && typeof b === "number") return a + (b - a) * p;
  return p >= 1 ? b : a;
}

/** Value of a keyframe list at `t`, holding the first/last value outside its span. */
export function sampleKeyframes(prop: TrackProp, keyframes: Keyframe[], t: number): TrackValue {
  if (keyframes.length === 0) throw new Error("empty keyframes");
  if (t <= keyframes[0].t) return keyframes[0].value;
  const last = keyframes[keyframes.length - 1];
  if (t >= last.t) return last.value;
  for (let i = 1; i < keyframes.length; i++) {
    const k = keyframes[i];
    if (t <= k.t) {
      const prev = keyframes[i - 1];
      const span = k.t - prev.t;
      const p = span <= 0 ? 1 : ease(k.easing, (t - prev.t) / span);
      return lerpValue(prop, prev.value, k.value, p);
    }
  }
  return last.value;
}

// ---------------------------------------------------------------------------
// Frame sampling
// ---------------------------------------------------------------------------

/** A node's attributes at one instant: initial attributes with every track applied. */
export type NodeState = TimelineNode & { pos: Vec2; opacity: number; scale: number; rotate: number; dash: number };

export function timelineDuration(tl: Timeline): number {
  if (typeof tl.duration === "number") return tl.duration;
  let end = 0;
  for (const tr of tl.tracks) for (const k of tr.keyframes) end = Math.max(end, k.t);
  for (const s of tl.steps ?? []) end = Math.max(end, s.t);
  return end;
}

export function sampleFrame(tl: Timeline, t: number): Map<string, NodeState> {
  const out = new Map<string, NodeState>();
  for (const n of tl.nodes) {
    out.set(n.id, {
      ...n,
      pos: n.pos ?? [0, 0],
      opacity: n.opacity ?? 1,
      scale: n.scale ?? 1,
      rotate: n.rotate ?? 0,
      dash: n.dash ?? 1,
    });
  }
  for (const tr of tl.tracks) {
    const node = out.get(tr.target);
    if (!node) continue;
    const v = sampleKeyframes(tr.prop, tr.keyframes, t);
    // Tracks are validated against node ids and prop names before sampling; the
    // cast records that `prop` selects a field of the same value type.
    (node as unknown as Record<string, TrackValue>)[tr.prop] = v;
  }
  return out;
}

/** The step whose `t` is the latest at or before `t`. */
export function currentStep(tl: Timeline, t: number): { index: number; t: number; label?: string; caption?: string } | undefined {
  const steps = tl.steps ?? [];
  let found: number | undefined;
  for (let i = 0; i < steps.length; i++) if (steps[i].t <= t + 1e-9) found = i;
  return found === undefined ? undefined : { index: found, ...steps[found] };
}

/**
 * The caption in force at `t`: a step without a caption keeps the previous
 * one showing, so an uncaptioned marker (an "end" chapter, a pause) never
 * blanks the narration.
 */
export function currentCaption(tl: Timeline, t: number): string | undefined {
  let found: string | undefined;
  for (const s of tl.steps ?? []) if (s.t <= t + 1e-9 && s.caption) found = s.caption;
  return found;
}

/** World-space translation of a node, folding in `group` parents. */
export function worldPos(frame: Map<string, NodeState>, id: string): Vec2 {
  let x = 0;
  let y = 0;
  let cur: NodeState | undefined = frame.get(id);
  let guard = 0;
  while (cur && guard++ < 64) {
    x += cur.pos[0];
    y += cur.pos[1];
    cur = cur.parent ? frame.get(cur.parent) : undefined;
  }
  return [x, y];
}
