/**
 * A storyboard over a lossless frame sequence (`vlmkit-frames/1`): where the frames hold still,
 * where they depart from what they held, how long for, over which pixels, and whether they come
 * back. Every time, count and box here is read from the pixels. Nothing here says what a change
 * *is* — that is left to whoever looks at the keyframes it picks (`storyboardBrief`).
 *
 * Segmentation is relative to an anchor: the frame of the state the page is in — frame 0 for the
 * first, the first frame of the hold a change settled in for each new one, and, when a change
 * lands within the floor of an earlier state's frame, the first such state's own frame again. A
 * deviation runs from the first frame that differs from the anchor to the first frame that
 * matches it again. (Within the floor is not transitive, so equal bytes can still carry two ids:
 * a picture reached with no event keeps the state it drifted from.)
 *
 * - **glitch**: the deviation lasts one frame and comes back.
 * - **transient**: it lasts more than one frame and comes back within `TRANSIENT_MS` of its first
 *   frame, whatever it held in between (a toast that slides in, stays and leaves is one).
 * - **change**: it does not come back within that window. It ends at the first hold of
 *   `SETTLE_MS` (frames byte-identical to each other): the next state, a new one or an earlier
 *   one it is within the floor of, whose frame is the anchor from then on.
 * - **drift**: a change no frame-to-frame step of which, inside its box, crosses the floor — a
 *   fade too slow to see from one frame to the next.
 *
 * So k blinks are k events, and the frames between them, back at the anchor, are none. A merge-
 * then-split segmentation was rejected in the design round: two 100ms blinks merged into one span
 * with no event, and the gaps between blinks were reported as transients.
 *
 * "Differs" is a channel moving by more than `CHANNEL_FLOOR` (8 of 255) in at least one pixel.
 * The input is lossless — the held clock's captures, two shots that agree — so a still page is
 * byte-identical frame to frame and the floor only has to absorb a sub-floor fade, which the
 * anchor (not the previous frame) accumulates until it shows. No lossy source is accepted, so
 * there is no noise ladder here; a decoded video needs one before it can come in.
 */
import { formatInstant, frameTimeMs, type FrameEntry, type FramesSource } from "./frames.ts";
import { UsageError } from "./errors.ts";

export const STORYBOARD_FORMAT = "vlmkit-storyboard/1";
/** A pixel differs when one of its channels moves by more than this (0-255). */
export const CHANNEL_FLOOR = 8;
/** A departure that comes back within this many ms of its first frame is one event. */
export const TRANSIENT_MS = 5000;
/** A change ends at the first run of byte-identical frames lasting this long. */
export const SETTLE_MS = 100;
/**
 * Durations are differences of instants, and instants on the 60fps grid are binary fractions:
 * frame 10 minus frame 4 is 99.99999999999999, so a 100ms hold of seven frames read as too short.
 * A comparison within this of its bound is on it, as `parseInstants` snaps.
 */
const EPSILON_MS = 1e-6;

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Frame `i`'s pixels, RGBA, `width * height * 4` bytes. Called more than once per frame. */
export interface FramePixels {
  width: number;
  height: number;
  pixels(i: number): Uint8Array;
}

export interface FrameDelta {
  /** No byte differs (outside the ignored boxes). */
  identical: boolean;
  /** Pixels one of whose channels moved by more than the floor. */
  over: number;
  /** Their bounding box; null when there are none. */
  box: Box | null;
  /** The largest channel delta of any pixel, 0-255. */
  maxDelta: number;
}

/**
 * One byte per pixel, 1 inside any of `boxes`: pixels no comparison looks at. A box that does not
 * sit on whole pixels covers every pixel it touches.
 */
export function ignoreMask(width: number, height: number, boxes: readonly Box[]): Uint8Array | null {
  if (boxes.length === 0) return null;
  const mask = new Uint8Array(width * height);
  for (const b of boxes) {
    const x0 = Math.max(0, Math.floor(b.x));
    const y0 = Math.max(0, Math.floor(b.y));
    const x1 = Math.min(width, Math.ceil(b.x + b.width));
    const y1 = Math.min(height, Math.ceil(b.y + b.height));
    for (let y = y0; y < y1; y++) mask.fill(1, y * width + x0, y * width + Math.max(x0, x1));
  }
  return mask;
}

/** A 32-bit view for the equal-word fast path; copied when the bytes are not 4-aligned. */
function words(bytes: Uint8Array): Uint32Array {
  if (bytes.byteOffset % 4 === 0) return new Uint32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength >> 2);
  return new Uint32Array(bytes.slice().buffer);
}

/** How `b` differs from `a`, pixel by pixel. */
export function frameDelta(
  a: Uint8Array,
  b: Uint8Array,
  width: number,
  height: number,
  options: { floor?: number; mask?: Uint8Array | null } = {},
): FrameDelta {
  const size = width * height;
  if (a.length !== size * 4 || b.length !== size * 4) {
    throw new Error(`frameDelta: expected ${size * 4} bytes per frame, got ${a.length} and ${b.length}`);
  }
  const floor = options.floor ?? CHANNEL_FLOOR;
  const mask = options.mask ?? null;
  const wa = words(a);
  const wb = words(b);
  let identical = true;
  let over = 0;
  let maxDelta = 0;
  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  for (let p = 0; p < size; p++) {
    if (wa[p] === wb[p] || (mask !== null && mask[p] === 1)) continue;
    identical = false;
    const i = p << 2;
    const d = Math.max(
      Math.abs(a[i]! - b[i]!),
      Math.abs(a[i + 1]! - b[i + 1]!),
      Math.abs(a[i + 2]! - b[i + 2]!),
      Math.abs(a[i + 3]! - b[i + 3]!),
    );
    if (d > maxDelta) maxDelta = d;
    if (d <= floor) continue;
    over++;
    const y = (p / width) | 0;
    const x = p - y * width;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  const box = over === 0 ? null : { x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
  return { identical, over, box, maxDelta };
}

/** The smallest box holding both; either may be null. */
export function unionBox(a: Box | null, b: Box | null): Box | null {
  if (a === null) return b;
  if (b === null) return a;
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  };
}

export type StoryKind = "glitch" | "transient" | "change" | "drift";

/** A frame of the sequence: its position and the instant it shows. */
export interface FrameRef {
  n: number;
  atMs: number;
}

export interface StoryEvent {
  /** `E1`, `E2` … in sequence order. */
  id: string;
  kind: StoryKind;
  /** The state it departed from. */
  from: string;
  /** The state it ended in: `from` again for a glitch or transient; absent when it never settled. */
  to?: string;
  /** The last frame that still showed `from`: the event began after it. */
  before: FrameRef;
  /**
   * The last frame whose pixels inside the event's box were byte-identical to `from`'s frame, when
   * it is earlier than `before`: the event's own pixels were already moving below the floor from
   * just after it (a fade that had not yet shown). Movement elsewhere does not count.
   */
  movedAfter?: FrameRef;
  /** The first frame that differs from `from` by more than the floor. */
  first: FrameRef;
  /**
   * glitch / transient: the last frame that differed. A change that never reached a hold: the
   * sequence's last frame, which is all there is to see of where it was going.
   */
  last?: FrameRef;
  /** glitch / transient: the first frame within the floor of `from` again. */
  back?: FrameRef;
  /**
   * change / drift: the first frame of the hold the motion ended in — the next state. The motion
   * stopped after the frame before it.
   */
  settled?: FrameRef;
  /**
   * change / drift: no hold by the last frame — it differs from the frame before it. What came
   * after is not in the sequence: on a sparse one (a rest instant two seconds on) the page may well
   * have been still by then.
   */
  noHold?: true;
  /**
   * change / drift: how long after `first` the sequence went on, up to `TRANSIENT_MS`: a return
   * later than this is not in the sequence. Below `TRANSIENT_MS` only when the sequence ended first.
   */
  watchedMs?: number;
  /** Frames from `first` to `last` (returns) or to `settled` (changes; the last frame if none). */
  frames: number;
  /** The frame differing from `from` in the most pixels (the earliest of equals), and how many. */
  peak: FrameRef & { over: number };
  /** Every pixel any of its frames moved over the floor from `from`'s frame, as one box. */
  box: Box;
  /**
   * The largest channel delta between two consecutive frames, inside its box, to its last frame,
   * from `movedAfter` — or from the frame the visit's previous event came back at, when that is
   * later — or else from the step into it: how visible one frame's step of it was. Movement
   * elsewhere on the page does not count, so a sub-floor wiggle beside a fade cannot make it a change.
   */
  maxStepDelta: number;
  /** Its frames whose capture never agreed: motion the capture did not hold. */
  unstable: number;
}

export interface StoryState {
  /** `S0` is frame 0's; a change that lands within the floor of an earlier state's frame is that state. */
  id: string;
  /**
   * The frame the state was first settled in. Every comparison against the state uses it, on every
   * visit: it is the anchor while the page is in the state.
   */
  frame: FrameRef;
  /** How many times the sequence was in it: a change back to it is another visit. */
  visits: number;
}

export type TimelineSpan =
  | { state: string; from: FrameRef; to: FrameRef }
  | { event: string; from: FrameRef; to: FrameRef };

export interface Sampling {
  /** Smallest and largest gap between consecutive frames, ms; 0 for a single frame. */
  minGapMs: number;
  maxGapMs: number;
  /** Every gap is one 60fps frame: on the held clock, every frame the page rendered. */
  everyFrame: boolean;
}

export interface Storyboard {
  format: typeof STORYBOARD_FORMAT;
  frames: {
    count: number;
    width: number;
    height: number;
    fromMs: number;
    toMs: number;
    sampling: Sampling;
    /** Positions of frames whose capture never agreed. */
    unstable: number[];
  };
  rules: { channelFloor: number; transientMs: number; settleMs: number; ignore: Box[] };
  states: StoryState[];
  events: StoryEvent[];
  timeline: TimelineSpan[];
}

export interface StoryboardOptions {
  floor?: number;
  transientMs?: number;
  settleMs?: number;
  /** Boxes, in the frames' pixels, no comparison looks at: a video, a clock the capture cannot hold. */
  ignore?: readonly Box[];
}

/** The gaps between consecutive instants. */
export function sampling(atMs: readonly number[]): Sampling {
  if (atMs.length < 2) return { minGapMs: 0, maxGapMs: 0, everyFrame: false };
  const gaps = atMs.slice(1).map((t, i) => t - atMs[i]!);
  return {
    minGapMs: Math.min(...gaps),
    maxGapMs: Math.max(...gaps),
    everyFrame: gaps.every((g) => Math.abs(g - frameTimeMs(1)) < 1e-6),
  };
}

/**
 * Segment a sequence. `entries` are the manifest's frames in order (strictly increasing `atMs`),
 * `pixels` reads each one; the frames must all be `pixels.width x pixels.height`.
 */
export function buildStoryboard(
  entries: readonly Pick<FrameEntry, "n" | "atMs" | "stable">[],
  pixels: FramePixels,
  options: StoryboardOptions = {},
): Storyboard {
  const floor = options.floor ?? CHANNEL_FLOOR;
  const transientMs = options.transientMs ?? TRANSIENT_MS;
  const settleMs = options.settleMs ?? SETTLE_MS;
  const ignore = [...(options.ignore ?? [])];
  const count = entries.length;
  if (count === 0) throw new UsageError("a storyboard needs at least one frame");
  entries.forEach((e, i) => {
    if (i > 0 && !(e.atMs > entries[i - 1]!.atMs)) {
      throw new UsageError(
        `frames must be in time order: frame ${i} is at ${formatInstant(e.atMs)}ms, after ${formatInstant(entries[i - 1]!.atMs)}ms`,
      );
    }
  });
  const { width, height } = pixels;
  const mask = ignoreMask(width, height, ignore);
  const delta = (i: number, j: number) =>
    frameDelta(pixels.pixels(i), pixels.pixels(j), width, height, { floor, mask });
  const ref = (i: number): FrameRef => ({ n: i, atMs: entries[i]!.atMs });

  // Frame j against frame j-1: independent of the anchor, so computed once.
  const steps: (FrameDelta | undefined)[] = [];
  const step = (j: number): FrameDelta => (steps[j] ??= delta(j - 1, j));
  // Frame j against the anchor, recomputed only when the anchor moves. A frame identical to the
  // one before it differs from the anchor exactly as that one did.
  let anchor = 0;
  let vs: (FrameDelta | undefined)[] = [];
  const vsAnchor = (j: number): FrameDelta => {
    const known = vs[j];
    if (known) return known;
    const prior = vs[j - 1];
    const d =
      j === anchor
        ? { identical: true, over: 0, box: null, maxDelta: 0 }
        : prior && steps[j]?.identical
          ? prior
          : delta(anchor, j);
    vs[j] = d;
    return d;
  };
  const reanchor = (k: number) => {
    anchor = k;
    vs = [];
  };

  const states: StoryState[] = [{ id: "S0", frame: ref(0), visits: 1 }];
  const events: StoryEvent[] = [];
  const timeline: TimelineSpan[] = [];
  let state = "S0";
  let spanStart = 0;

  /** The first k >= s whose frames stay byte-identical for `settleMs`, or to the last frame. */
  const settleFrom = (s: number): number => {
    for (let k = s; k < count - 1; k++) {
      let m = k;
      while (m + 1 < count && step(m + 1).identical) {
        m++;
        if (entries[m]!.atMs - entries[k]!.atMs >= settleMs - EPSILON_MS) return k;
      }
      if (m === count - 1 && m > k) return k;
      k = m;
    }
    return -1;
  };

  /** Which state frame k is: an earlier one it is within the floor of, or a new one. */
  const stateOf = (k: number): string => {
    for (const st of states) {
      if (delta(st.frame.n, k).over === 0) {
        st.visits++;
        return st.id;
      }
    }
    const id = `S${states.length}`;
    states.push({ id, frame: ref(k), visits: 1 });
    return id;
  };

  /** Box, peak and unstable count over frames [from, to] against the anchor. */
  const measure = (from: number, to: number) => {
    let box: Box | null = null;
    let peak = from;
    let unstable = 0;
    for (let m = from; m <= to; m++) {
      const d = vsAnchor(m);
      box = unionBox(box, d.box);
      if (d.over > vsAnchor(peak).over) peak = m;
      if (entries[m]!.stable === false) unstable++;
    }
    return { box: box!, peak: { ...ref(peak), over: vsAnchor(peak).over }, unstable };
  };
  /** The largest channel delta inside `box` between consecutive frames over the steps (from, to]. */
  const stepMax = (from: number, to: number, box: Box): number => {
    let max = 0;
    for (let m = from + 1; m <= to; m++) {
      const st = step(m);
      // Inside the box a step is never larger than across the frame.
      if (st.identical || st.maxDelta <= max) continue;
      const a = pixels.pixels(m - 1);
      const b = pixels.pixels(m);
      for (let y = box.y; y < box.y + box.height; y++) {
        for (let p = y * width + box.x, end = p + box.width; p < end; p++) {
          if (mask !== null && mask[p] === 1) continue;
          const i = p << 2;
          const d = Math.max(
            Math.abs(a[i]! - b[i]!),
            Math.abs(a[i + 1]! - b[i + 1]!),
            Math.abs(a[i + 2]! - b[i + 2]!),
            Math.abs(a[i + 3]! - b[i + 3]!),
          );
          if (d > max) max = d;
        }
      }
    }
    return max;
  };

  /** Frame m's pixels inside `box` (ignored ones aside) are the anchor's, byte for byte. */
  const sameInBox = (m: number, box: Box): boolean => {
    if (m === anchor || vsAnchor(m).identical) return true;
    const a = words(pixels.pixels(anchor));
    const b = words(pixels.pixels(m));
    for (let y = box.y; y < box.y + box.height; y++) {
      for (let p = y * width + box.x, end = p + box.width; p < end; p++) {
        if (a[p] !== b[p] && (mask === null || mask[p] !== 1)) return false;
      }
    }
    return true;
  };
  /**
   * Where an event's own pixels last showed the state exactly: the last frame of this visit before
   * `s` that is byte-identical to the anchor inside `box`, or -1. Inside the box, not across the
   * frame: a fade elsewhere, or a residue another event left within the floor, is not this event's.
   */
  const lastSameInBox = (s: number, box: Box): number => {
    for (let m = s - 1; m >= visitStart; m--) if (sameInBox(m, box)) return m;
    return -1;
  };
  /** `movedAfter` when its pixels moved below the floor first, and where the steps are counted from. */
  const leadIn = (s: number, box: Box) => {
    const same = lastSameInBox(s, box);
    return {
      movedAfter: same >= 0 && same < s - 1 ? ref(same) : undefined,
      // From there, but never from inside an earlier event of the visit; the step into it always.
      stepFrom: same >= 0 ? Math.max(same, spanStart) : s - 1,
    };
  };

  let visitStart = 0;
  let j = 1;
  while (j < count) {
    const d = vsAnchor(j);
    if (d.over === 0) {
      j++;
      continue;
    }
    const s = j;
    timeline.push({ state, from: ref(spanStart), to: ref(s - 1) });
    const id = `E${events.length + 1}`;

    let back = -1;
    for (let m = s + 1; m < count && entries[m]!.atMs - entries[s]!.atMs <= transientMs + EPSILON_MS; m++) {
      // The step first: it does not depend on the anchor, so when this window is scanned again
      // after a change re-anchors, a frame identical to the one before it is answered without
      // decoding either — the cache holds a few dozen frames and the window is 300 at 60fps.
      step(m);
      if (vsAnchor(m).over === 0) {
        back = m;
        break;
      }
    }
    if (back !== -1) {
      const frames = back - s;
      const m = measure(s, back - 1);
      const { movedAfter, stepFrom } = leadIn(s, m.box);
      events.push({
        id,
        kind: frames === 1 ? "glitch" : "transient",
        from: state,
        to: state,
        before: ref(s - 1),
        ...(movedAfter ? { movedAfter } : {}),
        first: ref(s),
        last: ref(back - 1),
        back: ref(back),
        frames,
        ...m,
        maxStepDelta: stepMax(stepFrom, back, m.box),
      });
      timeline.push({ event: id, from: ref(s), to: ref(back - 1) });
      spanStart = back;
      j = back + 1;
      continue;
    }

    const settled = settleFrom(s);
    const end = settled === -1 ? count - 1 : settled;
    const m = measure(s, end);
    const { movedAfter, stepFrom } = leadIn(s, m.box);
    const maxStepDelta = stepMax(stepFrom, end, m.box);
    const watchedMs = Math.min(transientMs, entries[count - 1]!.atMs - entries[s]!.atMs);
    const event: StoryEvent = {
      id,
      kind: maxStepDelta <= floor ? "drift" : "change",
      from: state,
      before: ref(s - 1),
      ...(movedAfter ? { movedAfter } : {}),
      first: ref(s),
      frames: end - s + 1,
      watchedMs,
      ...m,
      maxStepDelta,
    };
    if (settled === -1) {
      events.push({ ...event, last: ref(count - 1), noHold: true });
      timeline.push({ event: id, from: ref(s), to: ref(count - 1) });
      spanStart = -1;
      break;
    }
    const to = stateOf(settled);
    events.push({ ...event, to, settled: ref(settled) });
    timeline.push({ event: id, from: ref(s), to: ref(settled) });
    state = to;
    // The anchor is the state's own frame, on a return to an earlier state too: anchored on the
    // hold instead, a hold within the floor of S0's frame was S0 once and a new state the next
    // time, and a fade measured from the hold called "identical to S0" a frame that was not.
    reanchor(states.find((st) => st.id === to)!.frame.n);
    spanStart = settled;
    visitStart = settled;
    j = settled + 1;
  }
  if (spanStart !== -1) timeline.push({ state, from: ref(spanStart), to: ref(count - 1) });

  return {
    format: STORYBOARD_FORMAT,
    frames: {
      count,
      width,
      height,
      fromMs: entries[0]!.atMs,
      toMs: entries[count - 1]!.atMs,
      sampling: sampling(entries.map((e) => e.atMs)),
      unstable: entries.flatMap((e, i) => (e.stable === false ? [i] : [])),
    },
    rules: { channelFloor: floor, transientMs, settleMs, ignore },
    states,
    events,
    timeline,
  };
}

export type KeyframeRole = "before" | "first" | "peak" | "last" | "back" | "settled";

/**
 * The frames that show an event, in order, each once: the state before it, its first frame, its
 * peak, and its last frame and the one back (a return) or the hold it settled in (a change).
 * Frames that coincide are one keyframe with both roles.
 */
export function eventKeyframes(event: StoryEvent): { roles: KeyframeRole[]; frame: FrameRef }[] {
  const named: [KeyframeRole, FrameRef | undefined][] = [
    ["before", event.before],
    ["first", event.first],
    ["peak", event.peak],
    ["last", event.last],
    ["back", event.back],
    ["settled", event.settled],
  ];
  const out: { roles: KeyframeRole[]; frame: FrameRef }[] = [];
  for (const [role, frame] of named) {
    if (!frame) continue;
    const same = out.find((k) => k.frame.n === frame.n);
    if (same) same.roles.push(role);
    else out.push({ roles: [role], frame: { n: frame.n, atMs: frame.atMs } });
  }
  return out.sort((a, b) => a.frame.n - b.frame.n);
}

const ms = (t: number): string => `${formatInstant(t)}`;
export const boxText = (b: Box): string => `${b.x},${b.y} ${b.width}x${b.height}`;

/** When it began: between the last frame that showed the state and the first that did not. */
export function beganText(e: StoryEvent): string {
  return `${ms(e.before.atMs)} – ${ms(e.first.atMs)}`;
}

/** When it ended, as an interval between two frames, or why it has none. */
export function endedText(e: StoryEvent, entries: readonly Pick<FrameEntry, "atMs">[]): string {
  if (e.back && e.last) return `${ms(e.last.atMs)} – ${ms(e.back.atMs)}`;
  if (e.settled) {
    const stillAfter = e.settled.n > 0 ? entries[e.settled.n - 1]!.atMs : e.settled.atMs;
    return `${ms(stillAfter)} – ${ms(e.settled.atMs)}`;
  }
  return "no hold by the last frame";
}

function samplingText(story: Storyboard): string {
  const s = story.frames.sampling;
  if (story.frames.count === 1) return "1 frame";
  if (s.everyFrame) return "every 60 fps frame";
  return s.minGapMs === s.maxGapMs ? `every ${ms(s.minGapMs)} ms` : `${ms(s.minGapMs)} to ${ms(s.maxGapMs)} ms apart`;
}

function sourceLine(source: FramesSource): string {
  return [
    source.tool + (source.step ? ` (step ${source.step})` : ""),
    source.url,
    `${source.viewport.width}x${source.viewport.height} viewport at ${source.deviceScaleFactor}x`,
    ...(source.browser ? [source.browser] : []),
    `${source.clock} clock`,
  ].join(" · ");
}

/**
 * `SUMMARY.md`. Every value in it is read from the storyboard, which is read from the frames, so
 * the same frames give the same bytes — no output path, no wall time, no host name.
 */
export function storyboardSummary(
  story: Storyboard,
  source: FramesSource,
  entries: readonly Pick<FrameEntry, "atMs">[],
): string {
  const f = story.frames;
  const r = story.rules;
  const lines: string[] = [
    "# Storyboard",
    "",
    sourceLine(source),
    "",
    `${f.count} frame${f.count === 1 ? "" : "s"} of ${f.width}x${f.height} px from ${ms(f.fromMs)} to ${ms(f.toMs)} ms, ${samplingText(story)}.`,
    `A pixel differs when one of its channels moves by more than ${r.channelFloor} of 255. A departure from the state that comes back within ${ms(r.transientMs)} ms is one event (a glitch when it lasts one frame, a transient otherwise); one that does not is a change, which ends at the first ${ms(r.settleMs)} ms of identical frames (a drift when no step between two frames, inside its box, crosses the floor).`,
    ...(r.ignore.length > 0 ? [`Not compared: ${r.ignore.map(boxText).join("; ")} px.`] : []),
    "",
    "## Events",
    "",
  ];
  if (story.events.length === 0) {
    lines.push(`None: every frame is within the floor of frame 0 (${story.states[0]!.id}).`);
  } else {
    lines.push(
      "| Event | Kind | Began (ms) | Ended (ms) | Frames | Box (px) | Peak | States |",
      "|---|---|---|---|---|---|---|---|",
    );
    for (const e of story.events) {
      lines.push(
        `| ${e.id} | ${e.kind} | ${beganText(e)} | ${endedText(e, entries)} | ${e.frames} | ${boxText(e.box)} | ${e.peak.over} px at ${ms(e.peak.atMs)} | ${e.from} → ${e.to ?? "?"} |`,
      );
    }
    lines.push(
      "",
      "Began: between the last frame that showed the state and the first that did not. Ended: between the last frame that differed and the first back (glitch, transient), or between the last frame that moved and the first of the hold (change, drift). Box: every pixel the event moved over the floor, in the frames' pixels.",
    );
  }
  lines.push("", "## States", "", "| State | Frame | Visits |", "|---|---|---|");
  for (const s of story.states) lines.push(`| ${s.id} | ${ms(s.frame.atMs)} ms (n ${s.frame.n}) | ${s.visits} |`);
  lines.push(
    "",
    "## Timeline",
    "",
    story.timeline
      .map((span) => {
        const when = span.from.n === span.to.n ? ms(span.from.atMs) : `${ms(span.from.atMs)}–${ms(span.to.atMs)}`;
        return `${"state" in span ? span.state : span.event} ${when}`;
      })
      .join(" · "),
  );

  const notes: string[] = [];
  if (f.unstable.length > 0) {
    notes.push(
      `Frame${f.unstable.length === 1 ? "" : "s"} n ${f.unstable.join(", ")}: captured three times without two agreeing — motion the capture did not hold (a video, an animated image, a worker${source.clock === "wall" ? ", a script on the real clock" : ""}).`,
    );
  }
  for (const e of story.events) {
    if (e.movedAfter) {
      notes.push(
        `${e.id}: its pixels were already moving below the floor after ${ms(e.movedAfter.atMs)} ms, the last frame in which they were exactly ${e.from}'s.`,
      );
    }
    if (e.noHold) {
      notes.push(
        `${e.id} reached no hold: the last frame (${ms(f.toMs)} ms) differs from the one before it, and what came after is not in the sequence.`,
      );
    }
    if (e.settled && f.toMs - e.settled.atMs < r.settleMs - EPSILON_MS) {
      notes.push(
        `${e.id}: the hold it settled in is the sequence's last ${ms(f.toMs - e.settled.atMs)} ms, shorter than ${ms(r.settleMs)} ms; it may still have been moving.`,
      );
    }
    if (!e.noHold && e.watchedMs !== undefined && e.watchedMs < r.transientMs - EPSILON_MS) {
      notes.push(
        `${e.id}: only ${ms(e.watchedMs)} ms followed its first frame; a return later than that is not in the sequence.`,
      );
    }
    if (e.unstable > 0) notes.push(`${e.id}: ${e.unstable} of its frames never captured the same twice.`);
  }
  if (f.count > 1 && !f.sampling.everyFrame) {
    notes.push(
      `Frames up to ${ms(f.sampling.maxGapMs)} ms apart: something shorter than a gap can fall between two frames and not appear, and a glitch is one frame of the sequence, not one rendered frame.`,
    );
  } else if (f.sampling.everyFrame && source.clock === "wall") {
    notes.push(
      "Frames are 60 fps apart on the real clock: a script's frames are where it was when each was shot, not every frame it rendered.",
    );
  }
  if (notes.length > 0) lines.push("", "## Notes", "", ...notes.map((n) => `- ${n}`));
  return lines.join("\n") + "\n";
}

/** A keyframe as the brief lists it: the file it was written to, its roles, its instant. */
export interface BriefImage {
  file: string;
  roles: KeyframeRole[];
  atMs: number;
  /** A crop of the event's box, magnified `zoom` times. */
  crop?: { file: string; zoom: number; box: Box };
}

/**
 * `narrate/BRIEF.md`: the events, their measured facts, and the pictures of each, for the agent's
 * own vision to say what changed. It asks for words, not a verdict, and nothing reads the answer
 * back — a narrative gate stays off until a bench shows narration adds something the table does not.
 */
export function storyboardBrief(
  story: Storyboard,
  images: ReadonlyMap<string, readonly BriefImage[]>,
  shown: number,
): string {
  const lines = [
    "# Narrate this storyboard",
    "",
    "The events below were measured from the pixels: their times, frame counts and boxes are measurements.",
    "Do not change them or estimate others. What they cannot say is what each change *is*, which is your part.",
    "",
    "For each event, open its pictures with your image-reading tool. A `crop` file is the event's box cut from",
    "that frame at full resolution and magnified; the full frames show where it sits.",
    "",
    "Write `NARRATION.md` in this directory, one line per event starting with its id, saying what the page",
    'shows changing — `E2: a toast reading "Saved" appears at the bottom right and leaves`. When you cannot',
    "tell, write `E2: unclear` and why. Describe only what the pictures show.",
  ];
  if (story.events.length === 0) lines.push("", "There are no events: every frame is within the floor of frame 0.");
  if (shown < story.events.length) {
    lines.push("", `This brief has the first ${shown} of ${story.events.length} events; SUMMARY.md lists them all.`);
  }
  for (const e of story.events.slice(0, shown)) {
    const span = e.back ? `${e.frames} frame${e.frames === 1 ? "" : "s"}` : `${e.frames} frames to a hold`;
    lines.push(
      "",
      `## ${e.id} — ${e.kind}, ${e.from} → ${e.to ?? "?"}, first at ${ms(e.first.atMs)} ms, ${e.noHold ? "no hold by the last frame" : span}, box ${boxText(e.box)} px`,
      "",
    );
    for (const img of images.get(e.id) ?? []) {
      lines.push(`- \`${img.file}\` — ${img.roles.join(" + ")}, ${ms(img.atMs)} ms`);
      if (img.crop) lines.push(`  - \`${img.crop.file}\` — the box with a margin, magnified ${img.crop.zoom}x`);
    }
  }
  return lines.join("\n") + "\n";
}
