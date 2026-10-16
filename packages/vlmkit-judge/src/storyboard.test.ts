import assert from "node:assert/strict";
import { describe, test } from "vite-plus/test";
import { frameTimeMs } from "./frames.ts";
import { createRng } from "./pbt.ts";
import {
  boxMean,
  buildStoryboard,
  CHANNEL_FLOOR,
  eventKeyframes,
  frameDelta,
  ignoreMask,
  LOSSY_NOISE,
  meanFrames,
  storyboardBrief,
  storyboardSummary,
  type Box,
  type NoiseFloor,
  type StoryEvent,
} from "./storyboard.ts";

const W = 40;
const H = 30;
type Rgb = readonly [number, number, number];
interface Paint {
  x: number;
  y: number;
  w: number;
  h: number;
  rgb: Rgb;
}

/** A white W x H frame with `paints` drawn in order. */
function frame(paints: readonly Paint[], bg: Rgb = [255, 255, 255]): Uint8Array {
  const data = new Uint8Array(W * H * 4);
  for (let p = 0; p < W * H; p++) data.set([...bg, 255], p * 4);
  for (const { x, y, w, h, rgb } of paints) {
    for (let yy = Math.max(0, y); yy < Math.min(H, y + h); yy++) {
      for (let xx = Math.max(0, x); xx < Math.min(W, x + w); xx++) data.set([...rgb, 255], (yy * W + xx) * 4);
    }
  }
  return data;
}

/** A sequence of `frames` at 60fps (or `gapMs` apart), with the positions in `unstable` marked so. */
function sequence(frames: readonly Uint8Array[], options: { gapMs?: number; unstable?: readonly number[] } = {}) {
  const entries = frames.map((_, n) => ({
    n,
    atMs: options.gapMs === undefined ? frameTimeMs(n) : n * options.gapMs,
    stable: !(options.unstable ?? []).includes(n),
  }));
  let reads = 0;
  const pixels = {
    width: W,
    height: H,
    pixels: (i: number) => {
      reads++;
      return frames[i]!;
    },
  };
  return { entries, pixels, reads: () => reads };
}

const story = (frames: readonly Uint8Array[], options: Parameters<typeof sequence>[1] = {}, ignore: Box[] = []) => {
  const s = sequence(frames, options);
  return buildStoryboard(s.entries, s.pixels, { ignore });
};

const blank = frame([]);
const dot: Paint = { x: 5, y: 6, w: 4, h: 3, rgb: [0, 0, 0] };
const repeat = (f: Uint8Array, n: number) => Array.from({ length: n }, () => f);

describe("frameDelta", () => {
  test("identical frames, and a change above and below the floor", () => {
    assert.deepEqual(frameDelta(blank, blank, W, H), {
      identical: true,
      over: 0,
      box: null,
      changed: null,
      maxDelta: 0,
    });
    const faint = frame([{ ...dot, rgb: [255 - CHANNEL_FLOOR, 255, 255] }]);
    assert.deepEqual(frameDelta(blank, faint, W, H), {
      identical: false,
      over: 0,
      box: null,
      changed: { x: 5, y: 6, width: 4, height: 3 },
      maxDelta: 8,
    });
    const shown = frame([{ ...dot, rgb: [255 - CHANNEL_FLOOR - 1, 255, 255] }]);
    assert.deepEqual(frameDelta(blank, shown, W, H), {
      identical: false,
      over: 12,
      box: { x: 5, y: 6, width: 4, height: 3 },
      changed: { x: 5, y: 6, width: 4, height: 3 },
      maxDelta: 9,
    });
  });

  test("a mask hides what is inside it, identity included", () => {
    const mask = new Uint8Array(W * H);
    for (let y = 6; y < 9; y++) mask.fill(1, y * W + 5, y * W + 9);
    assert.equal(frameDelta(blank, frame([dot]), W, H, { mask }).identical, true);
  });

  test("a Node Buffer at an odd offset is copied, not viewed from the start of its pool", () => {
    // Buffer#slice is a view, so a copy made with it read the pool from offset 0 for every frame.
    const pool = Buffer.alloc(W * H * 4 * 2 + 2);
    const a = pool.subarray(1, 1 + W * H * 4);
    const b = pool.subarray(2 + W * H * 4, 2 + W * H * 8);
    a.set(blank);
    b.set(frame([dot]));
    assert.equal(frameDelta(a, b, W, H).over, 12);
    assert.equal(frameDelta(a, a, W, H).identical, true);
  });

  test("bytes that are not 4-aligned are compared all the same", () => {
    const shifted = new Uint8Array(W * H * 4 + 1);
    shifted.set(frame([dot]), 1);
    const view = shifted.subarray(1);
    assert.equal(frameDelta(blank, view, W, H).over, 12);
  });
});

describe("buildStoryboard: the planted cases", () => {
  test("a still sequence has no event and one state", () => {
    const s = story(repeat(blank, 20));
    assert.deepEqual(s.events, []);
    assert.deepEqual(
      s.states.map((st) => st.id),
      ["S0"],
    );
    assert.deepEqual(s.timeline, [{ state: "S0", from: { n: 0, atMs: 0 }, to: { n: 19, atMs: frameTimeMs(19) } }]);
  });

  test("one frame off is a glitch, timed between the frames around it", () => {
    const frames = repeat(blank, 20);
    frames[10] = frame([dot]);
    const [e, ...rest] = story(frames).events;
    assert.equal(rest.length, 0);
    assert.equal(e!.kind, "glitch");
    assert.equal(e!.movedAfter, undefined, "nothing moved below the floor first");
    assert.deepEqual([e!.before.n, e!.first.n, e!.last!.n, e!.back!.n], [9, 10, 10, 11]);
    assert.equal(e!.frames, 1);
    assert.deepEqual(e!.box, { x: 5, y: 6, width: 4, height: 3 });
    assert.deepEqual(e!.peak, { n: 10, atMs: frameTimeMs(10), over: 12 });
    assert.equal(e!.from, "S0");
    assert.equal(e!.to, "S0");
  });

  test("k blinks are k events, for every k in 2-5 and every on / off length in 1-3", () => {
    const on = frame([dot]);
    for (let k = 2; k <= 5; k++) {
      for (let onFrames = 1; onFrames <= 3; onFrames++) {
        for (let offFrames = 1; offFrames <= 3; offFrames++) {
          const frames = repeat(blank, 5);
          const firsts: number[] = [];
          for (let b = 0; b < k; b++) {
            firsts.push(frames.length);
            frames.push(...repeat(on, onFrames));
            if (b < k - 1) frames.push(...repeat(blank, offFrames));
          }
          frames.push(...repeat(blank, 5));
          const label = `k ${k}, on ${onFrames}, off ${offFrames}`;
          const events = story(frames).events;
          assert.equal(events.length, k, label);
          assert.deepEqual(
            events.map((e) => e.first.n),
            firsts,
            label,
          );
          for (const e of events) {
            assert.equal(e.frames, onFrames, label);
            assert.equal(e.kind, onFrames === 1 ? "glitch" : "transient", label);
          }
        }
      }
    }
  });

  test("a slow fade is a drift, with the frames it moved below the floor named", () => {
    // From frame 5 the box darkens one level a frame for 20 frames, then holds.
    const frames = repeat(blank, 5);
    for (let i = 1; i <= 20; i++) frames.push(frame([{ ...dot, rgb: [255 - i, 255 - i, 255 - i] }]));
    frames.push(...repeat(frames.at(-1)!, 12));
    const s = story(frames);
    assert.equal(s.events.length, 1);
    const e = s.events[0]!;
    assert.equal(e.kind, "drift");
    // Level 255 - 9 is the first over the floor of 8: frame 5 + 8.
    assert.equal(e.first.n, 13);
    assert.equal(e.before.n, 12);
    assert.equal(e.movedAfter?.n, 4, "the last frame identical to S0");
    assert.equal(e.settled?.n, 24, "the first frame of the hold");
    assert.equal(e.maxStepDelta, 1);
    assert.deepEqual(
      s.states.map((st) => st.id),
      ["S0", "S1"],
    );
  });

  test("a move that settles is a change to a new state; one that comes back after 5s is a second change", () => {
    const moved = (x: number) => frame([{ ...dot, x }]);
    const frames = [...repeat(moved(5), 10)];
    for (let x = 6; x <= 10; x++) frames.push(moved(x));
    frames.push(...repeat(moved(10), 60)); // 6s at 100ms
    for (let x = 9; x >= 5; x--) frames.push(moved(x));
    frames.push(...repeat(moved(5), 10));
    const s = story(frames, { gapMs: 100 });
    assert.deepEqual(
      s.events.map((e) => [e.kind, e.from, e.to, e.first.n, e.settled?.n]),
      [
        ["change", "S0", "S1", 10, 14],
        ["change", "S1", "S0", 75, 79],
      ],
    );
    assert.deepEqual(s.events[0]!.box, { x: 5, y: 6, width: 9, height: 3 });
    assert.equal(s.states[0]!.visits, 2, "back to S0 is a second visit");
  });

  test("a departure that holds and comes back within 5s is one transient", () => {
    const toast = frame([{ x: 20, y: 20, w: 15, h: 6, rgb: [30, 30, 30] }]);
    const frames = [...repeat(blank, 5), ...repeat(toast, 30), ...repeat(blank, 5)]; // 3s at 100ms
    const s = story(frames, { gapMs: 100 });
    assert.deepEqual(
      s.events.map((e) => [e.kind, e.first.atMs, e.last?.atMs, e.back?.atMs, e.frames]),
      [["transient", 500, 3400, 3500, 30]],
    );
    assert.deepEqual(
      s.states.map((st) => st.id),
      ["S0"],
    );
  });

  test("a plateau shorter than the hold does not split a change", () => {
    const moved = (x: number) => frame([{ ...dot, x }]);
    const frames = [...repeat(moved(0), 5), moved(2), moved(4), moved(4), moved(4), moved(6), moved(8)];
    frames.push(...repeat(moved(8), 10));
    const s = story(frames);
    assert.equal(s.events.length, 1, JSON.stringify(s.events.map((e) => [e.kind, e.first.n])));
    assert.equal(s.events[0]!.settled?.n, 10);
    assert.equal(s.events[0]!.frames, 6);
  });

  test("motion to the last frame never settles, and the timeline ends in the event", () => {
    const frames = [...repeat(blank, 5), ...Array.from({ length: 10 }, (_, i) => frame([{ ...dot, x: i * 2 }]))];
    const s = story(frames);
    assert.equal(s.events.length, 1);
    assert.equal(s.events[0]!.noHold, true);
    assert.equal(s.events[0]!.to, undefined);
    assert.equal(s.events[0]!.frames, 10);
    assert.deepEqual(s.timeline.at(-1), {
      event: "E1",
      from: { n: 5, atMs: frameTimeMs(5) },
      to: { n: 14, atMs: frameTimeMs(14) },
    });
  });

  test("an ignored box (a playing video) does not hide a glitch elsewhere", () => {
    const video = (i: number): Paint => ({ x: 30, y: 0, w: 10, h: 10, rgb: [i * 12, 0, 0] });
    const frames = Array.from({ length: 20 }, (_, i) => frame([video(i), ...(i === 12 ? [dot] : [])]));
    const unmasked = story(frames);
    assert.equal(unmasked.events[0]!.noHold, true, "the video swallows the sequence");
    const masked = story(frames, {}, [{ x: 30, y: 0, width: 10, height: 10 }]);
    assert.deepEqual(
      masked.events.map((e) => [e.kind, e.first.n]),
      [["glitch", 12]],
    );
    assert.deepEqual(masked.rules.ignore, [{ x: 30, y: 0, width: 10, height: 10 }]);
  });

  test("frames whose capture never agreed are counted, per event and in all", () => {
    const frames = repeat(blank, 10);
    frames[4] = frame([dot]);
    const s = story(frames, { unstable: [4, 7] });
    assert.deepEqual(s.frames.unstable, [4, 7]);
    assert.equal(s.events[0]!.unstable, 1);
  });

  test("frames out of time order are refused", () => {
    const s = sequence(repeat(blank, 3));
    s.entries[2]!.atMs = 0;
    assert.throws(() => buildStoryboard(s.entries, s.pixels), /time order/);
  });

  test("a still page is decoded once per frame through a small cache", () => {
    const frames = repeat(blank, 50).map((f) => f.slice());
    const cache = new Map<number, Uint8Array>();
    let decoded = 0;
    const pixels = {
      width: W,
      height: H,
      pixels: (i: number) => {
        const hit = cache.get(i);
        if (hit) {
          cache.delete(i);
          cache.set(i, hit);
          return hit;
        }
        decoded++;
        cache.set(i, frames[i]!);
        if (cache.size > 8) cache.delete(cache.keys().next().value!);
        return frames[i]!;
      },
    };
    buildStoryboard(
      frames.map((_, n) => ({ n, atMs: frameTimeMs(n), stable: true })),
      pixels,
    );
    assert.equal(decoded, 50);
  });
});

describe("buildStoryboard: the boundaries", () => {
  const level = (v: number, at: Paint = dot): Paint => ({ ...at, rgb: [v, v, v] });
  const grey: Rgb = [128, 128, 128];

  test("the 5000ms window is measured from the first frame, and its end is inclusive", () => {
    const on = frame([dot]);
    const back = (onFrames: number) => [...repeat(blank, 248), ...repeat(on, onFrames), ...repeat(blank, 12)];
    // frame 548 - frame 248 is 5000.000000000001ms: on the bound, so back in time.
    assert.deepEqual(
      story(back(300)).events.map((e) => [e.kind, e.first.n, e.back?.n]),
      [["transient", 248, 548]],
    );
    assert.deepEqual(
      story(back(301)).events.map((e) => [e.kind, e.from, e.to]),
      [
        ["change", "S0", "S1"],
        ["change", "S1", "S0"],
      ],
    );
    // At 100ms: away for 50 frames is back 5000ms after the first frame, 5100ms after `before`.
    const sparse = story([...repeat(blank, 5), ...repeat(on, 50), ...repeat(blank, 5)], { gapMs: 100 });
    assert.deepEqual(
      sparse.events.map((e) => [e.kind, e.back?.n]),
      [["transient", 55]],
    );
  });

  test("a hold under 100ms does not settle a change, and one of 100ms does", () => {
    const moved = (x: number) => frame([{ ...dot, x }]);
    // 60fps: a six-frame plateau is 83.33ms.
    const a = story([...repeat(moved(0), 5), moved(2), ...repeat(moved(4), 6), moved(6), ...repeat(moved(8), 10)]);
    assert.deepEqual(
      a.events.map((e) => [e.kind, e.first.n, e.settled?.n, e.frames]),
      [["change", 5, 13, 9]],
    );
    // 10ms apart: a 90ms plateau runs on; a 100ms hold settles, and the next move is a new event.
    const b = story(
      [
        ...repeat(moved(0), 5),
        moved(2),
        ...repeat(moved(4), 10),
        moved(6),
        ...repeat(moved(8), 11),
        moved(10),
        ...repeat(moved(12), 12),
      ],
      { gapMs: 10 },
    );
    assert.deepEqual(
      b.events.map((e) => [e.first.n, e.settled?.n]),
      [
        [5, 17],
        [28, 29],
      ],
    );
  });

  test("a hold that reaches the last frame settles a change, and says how short it was", () => {
    const moved = (x: number) => frame([{ ...dot, x }]);
    const s = sequence([...repeat(moved(0), 5), moved(2), ...repeat(moved(4), 3)]);
    const b = buildStoryboard(s.entries, s.pixels);
    assert.deepEqual(
      b.events.map((e) => [e.kind, e.settled?.n, e.to, e.noHold]),
      [["change", 6, "S1", undefined]],
    );
    const md = storyboardSummary(
      b,
      { tool: "t", url: "u", viewport: { width: W, height: H }, deviceScaleFactor: 1, clock: "held" },
      s.entries,
    );
    assert.match(md, /E1: the hold it settled in is the sequence's last 33\.33 ms, shorter than 100 ms/);
  });

  test("drift and change meet at the floor: steps of 8 drift, steps of 9 change", () => {
    const fade = (step: number) => [
      ...repeat(blank, 5),
      ...Array.from({ length: 10 }, (_, i) => frame([level(255 - step * (i + 1))])),
      ...repeat(frame([level(255 - step * 10)]), 10),
    ];
    const by8 = story(fade(8)).events;
    assert.deepEqual(
      by8.map((e) => [e.kind, e.first.n, e.before.n, e.movedAfter?.n, e.maxStepDelta]),
      [["drift", 6, 5, 4, 8]],
    );
    const by9 = story(fade(9)).events;
    assert.deepEqual(
      by9.map((e) => [e.kind, e.first.n, e.movedAfter, e.maxStepDelta]),
      [["change", 5, undefined, 9]],
    );
    // A creep below the floor, then a jump: a change, and the jump is its step.
    const creep = [
      ...repeat(blank, 5),
      ...Array.from({ length: 7 }, (_, i) => frame([level(254 - i)])),
      ...repeat(frame([level(0)]), 10),
    ];
    assert.deepEqual(
      story(creep).events.map((e) => [e.kind, e.first.n, e.movedAfter?.n, e.maxStepDelta]),
      [["change", 12, 4, 248]],
    );
  });

  test("a fade keeps its movedAfter through a glitch elsewhere, which has none of its own", () => {
    const elsewhere: Paint = { x: 30, y: 20, w: 3, h: 3, rgb: [0, 0, 0] };
    const frames = repeat(blank, 5);
    for (let i = 1; i <= 20; i++) frames.push(frame([level(255 - i), ...(frames.length === 7 ? [elsewhere] : [])]));
    frames.push(...repeat(frames.at(-1)!, 10));
    assert.deepEqual(
      story(frames).events.map((e) => [e.kind, e.first.n, e.back?.n, e.settled?.n, e.movedAfter?.n, e.maxStepDelta]),
      [
        ["glitch", 7, 8, undefined, undefined, 255],
        ["drift", 13, undefined, 24, 4, 1],
      ],
    );
  });

  test("a wiggle below the floor elsewhere does not make a fade a change; a jump on its own pixels does", () => {
    const side: Paint = { x: 30, y: 20, w: 2, h: 2, rgb: grey };
    const frames = repeat(frame([], grey), 5);
    frames.push(frame([{ ...side, rgb: [135, 135, 135] }], grey));
    const wiggled = { ...side, rgb: [121, 121, 121] as Rgb };
    frames.push(frame([wiggled], grey));
    for (let i = 1; i <= 15; i++) frames.push(frame([wiggled, level(128 + i)], grey));
    frames.push(...repeat(frames.at(-1)!, 10));
    assert.deepEqual(
      story(frames).events.map((e) => [e.kind, e.movedAfter?.n, e.maxStepDelta]),
      // Frame 6 is the last in which the fade's own pixels were still S0's: the wiggle is not them.
      [["drift", 6, 1]],
    );
    const own = [
      ...repeat(frame([], grey), 5),
      frame([level(121)], grey),
      frame([level(135)], grey),
      ...repeat(frame([level(137)], grey), 10),
    ];
    assert.deepEqual(
      story(own).events.map((e) => [e.kind, e.first.n, e.movedAfter?.n, e.maxStepDelta]),
      [["change", 7, 4, 14]],
    );
  });

  test("a change into the floor of an earlier state's frame is that state, anchored on its frame", () => {
    const at = (v: number, n: number) => repeat(frame([level(v)]), n);
    const s = story([...at(100, 5), ...at(200, 60), ...at(106, 60), ...at(112, 60), ...at(200, 60), ...at(112, 10)], {
      gapMs: 100,
    });
    assert.deepEqual(
      s.events.map((e) => [e.kind, e.from, e.to, e.first.n, e.settled?.n]),
      [
        ["change", "S0", "S1", 5, 5],
        ["change", "S1", "S0", 65, 65],
        ["drift", "S0", "S2", 125, 125],
        ["change", "S2", "S1", 185, 185],
        ["change", "S1", "S2", 245, 245],
      ],
    );
    assert.deepEqual(
      s.states.map((st) => [st.id, st.frame.n, st.visits]),
      [
        ["S0", 0, 2],
        ["S1", 5, 2],
        ["S2", 125, 2],
      ],
    );
    // 106 is within the floor of S0's frame but not identical to it: no frame after the return
    // is "identical to S0", so the drift at 125 names none.
    assert.equal(s.events[2]!.movedAfter, undefined);
  });

  test("a glitch on a fade's own pixels: the fade's steps are counted from after the glitch came back", () => {
    const frames = repeat(blank, 5);
    for (let f = 5; f <= 24; f++) frames.push(frame([level(f === 7 ? 0 : 255 - (f - 4))]));
    frames.push(...repeat(frames.at(-1)!, 10));
    assert.deepEqual(
      story(frames).events.map((e) => [e.kind, e.first.n, e.back?.n, e.settled?.n, e.movedAfter?.n, e.maxStepDelta]),
      [
        ["glitch", 7, 8, undefined, 4, 253],
        ["drift", 13, undefined, 24, 4, 1],
      ],
    );
  });

  test("movedAfter is the event's own pixels: a residue another event left elsewhere is not it", () => {
    const toast: Paint = { x: 0, y: 0, w: 4, h: 4, rgb: [0, 0, 0] };
    const residue: Paint = { ...toast, rgb: [252, 252, 252] };
    const glitch: Paint = { x: 30, y: 0, w: 4, h: 4, rgb: [0, 0, 0] };
    const frames = [...repeat(blank, 10), ...repeat(frame([toast]), 5), ...repeat(frame([residue]), 25)];
    frames.push(frame([residue, glitch]), ...repeat(frame([residue]), 20));
    assert.deepEqual(
      story(frames, { gapMs: 100 }).events.map((e) => [e.kind, e.first.n, e.movedAfter?.n]),
      [
        ["transient", 10, undefined],
        ["glitch", 40, undefined],
      ],
    );
  });

  test("a step on the box's last column or row counts; an ignored pixel inside the box does not", () => {
    const region: Paint = { x: 5, y: 6, w: 4, h: 3, rgb: [0, 0, 0] };
    const fade = (dip?: Paint) => {
      const frames = repeat(blank, 5);
      for (let f = 5; f <= 24; f++) {
        const v = 255 - (f - 4);
        frames.push(
          frame([
            { ...region, rgb: [v, v, v] },
            ...(dip && f === 15 ? [{ ...dip, rgb: [v - 20, v - 20, v - 20] as Rgb }] : []),
          ]),
        );
      }
      frames.push(...repeat(frames.at(-1)!, 10));
      return frames;
    };
    const kindOf = (frames: Uint8Array[], ignore: Box[] = []) =>
      story(frames, {}, ignore).events.map((e) => [e.kind, e.maxStepDelta]);
    assert.deepEqual(kindOf(fade()), [["drift", 1]]);
    assert.deepEqual(kindOf(fade({ x: 8, y: 6, w: 1, h: 3, rgb: [0, 0, 0] })), [["change", 21]], "the last column");
    assert.deepEqual(kindOf(fade({ x: 5, y: 8, w: 4, h: 1, rgb: [0, 0, 0] })), [["change", 21]], "the last row");
    // A pixel inside the fade, ignored, flickering black and white every frame.
    const flicker = fade().map((f, i) => {
      const g = f.slice();
      const at = (7 * W + 6) * 4;
      g.fill(i % 2 === 0 ? 0 : 255, at, at + 3);
      return g;
    });
    assert.deepEqual(kindOf(flicker, [{ x: 6, y: 7, width: 1, height: 1 }]), [["drift", 1]]);
  });

  test("an ignored box that is not on whole pixels covers every pixel it touches", () => {
    const on = (mask: Uint8Array) => [...mask.keys()].filter((i) => mask[i] === 1);
    // Both near edges round down and both far edges up: a 1x1 box at (0.5, 0.5) touches four pixels.
    assert.deepEqual(on(ignoreMask(8, 4, [{ x: 0.5, y: 0.5, width: 1, height: 1 }])!), [0, 1, 8, 9]);
    assert.deepEqual(on(ignoreMask(8, 4, [{ x: 0, y: 0.5, width: 2, height: 1 }])!), [0, 1, 8, 9]);
  });

  test("after a change, the 5s look-ahead is re-scanned without decoding its still frames again", () => {
    // 400 frames at 60fps, a mark moving to a new place every 60 frames and never back: six changes,
    // each scanning 300 frames ahead. Read through an 8-frame cache, as the CLI reads files.
    const frames = Array.from({ length: 400 }, (_, i) => frame([{ ...dot, x: Math.floor(i / 60) * 5 }]));
    const cache = new Map<number, Uint8Array>();
    let decoded = 0;
    const pixels = {
      width: W,
      height: H,
      pixels: (i: number) => {
        const hit = cache.get(i);
        if (hit) {
          cache.delete(i);
          cache.set(i, hit);
          return hit;
        }
        decoded++;
        cache.set(i, frames[i]!);
        if (cache.size > 8) cache.delete(cache.keys().next().value!);
        return frames[i]!;
      },
    };
    const entries = frames.map((_, n) => ({ n, atMs: frameTimeMs(n), stable: true }));
    assert.equal(buildStoryboard(entries, pixels).events.length, 6);
    assert.ok(decoded < 500, `${decoded} decodes for 400 frames`);
  });

  test("movedAfter: an ignored pixel inside the box never counts, and the box's last row and column do", () => {
    const wiggle: Paint = { x: 30, y: 20, w: 1, h: 1, rgb: [250, 250, 250] };
    const region: Paint = { x: 5, y: 6, w: 4, h: 3, rgb: [0, 0, 0] };
    // A fade on the region from frame 5; a sub-floor wiggle elsewhere from frame 1, so no frame
    // after 0 is identical across the frame; and the given paint from frame `from`.
    const fade = (extra: (f: number) => Paint[]) => {
      const frames = [blank];
      for (let f = 1; f <= 30; f++) {
        const v = f >= 5 ? Math.max(235, 255 - (f - 4)) : 255;
        // The extra paint under the fade, so the fade covers it once it starts.
        frames.push(frame([wiggle, ...extra(f), ...(f >= 5 ? [{ ...region, rgb: [v, v, v] as Rgb }] : [])]));
      }
      frames.push(...repeat(frames.at(-1)!, 10));
      return frames;
    };
    // The ignored pixel is painted over the fade, black on every frame from 1.
    const ignoredFrames = fade(() => []).map((f, i) => {
      if (i === 0) return f;
      const g = f.slice();
      g.fill(0, (7 * W + 6) * 4, (7 * W + 6) * 4 + 3);
      return g;
    });
    const ignored = ignoredFrames;
    assert.deepEqual(
      story(ignored, {}, [{ x: 6, y: 7, width: 1, height: 1 }]).events.map((e) => e.movedAfter?.n),
      [4],
    );
    // Two more wiggles on either side of the box, so what changed spans it and its bytes are compared.
    const spanning = ignoredFrames.map((f, i) => {
      if (i === 0) return f;
      const g = f.slice();
      for (const [x, y] of [
        [3, 5],
        [10, 10],
      ] as const)
        g.fill(250, (y * W + x) * 4, (y * W + x) * 4 + 3);
      return g;
    });
    assert.deepEqual(
      story(spanning, {}, [{ x: 6, y: 7, width: 1, height: 1 }]).events.map((e) => e.movedAfter?.n),
      [4],
    );
    const lastRow = fade((f) => (f >= 2 ? [{ x: 5, y: 8, w: 4, h: 1, rgb: [254, 254, 254] }] : []));
    assert.deepEqual(
      story(lastRow).events.map((e) => e.movedAfter?.n),
      [1],
    );
    const lastColumn = fade((f) => (f >= 2 ? [{ x: 8, y: 6, w: 1, h: 3, rgb: [254, 254, 254] }] : []));
    assert.deepEqual(
      story(lastColumn).events.map((e) => e.movedAfter?.n),
      [1],
    );
  });

  test("a note says what happened to an event's pixels after they were last the state's", () => {
    const toast: Paint = { x: 0, y: 0, w: 4, h: 4, rgb: [0, 0, 0] };
    // A toast leaves a residue within the floor; a second toast on the same pixels follows.
    const residue = frame([{ ...toast, rgb: [252, 252, 252] }]);
    const s = sequence(
      [
        ...repeat(blank, 10),
        ...repeat(frame([toast]), 5),
        ...repeat(residue, 10),
        ...repeat(frame([toast]), 5),
        ...repeat(residue, 5),
      ],
      {
        gapMs: 100,
      },
    );
    const b = buildStoryboard(s.entries, s.pixels);
    assert.deepEqual(
      b.events.map((e) => [e.id, e.kind, e.movedAfter?.n]),
      [
        ["E1", "transient", undefined],
        ["E2", "transient", 9],
      ],
    );
    const md = storyboardSummary(
      b,
      { tool: "t", url: "u", viewport: { width: W, height: H }, deviceScaleFactor: 1, clock: "held" },
      s.entries,
    );
    assert.match(md, /E2: its pixels were last exactly S0's at 900 ms, before E1 moved them\./);
    assert.doesNotMatch(md, /E2: .*moved below the floor/);
  });

  test("a blink repeating over a pixel held a level off the anchor does not re-decode the visit for every blink", () => {
    // 600 frames: frame 0 white, then one pixel inside the blink's box at 254 for good (and, in the
    // second run, another far outside it), and a 3-frame blink every 50 frames.
    const blinkBox: Paint = { x: 20, y: 10, w: 6, h: 6, rgb: [0, 0, 0] };
    const build = (outside: boolean, inside = true) =>
      Array.from({ length: 600 }, (_, i) =>
        i === 0
          ? blank
          : frame([
              ...(inside ? [{ x: 21, y: 11, w: 1, h: 1, rgb: [254, 254, 254] as Rgb }] : []),
              ...(outside ? [{ x: 39, y: 29, w: 1, h: 1, rgb: [i % 2 ? 250 : 252, 250, 250] as Rgb }] : []),
              ...(i % 50 >= 10 && i % 50 < 13 ? [blinkBox] : []),
            ]),
      );
    for (const [outside, inside, bound] of [
      // Between blinks the frames are a hold: its answer is carried, not decoded again.
      [false, true, 1.3],
      // Every frame differs from the last: each is decoded once more, for the search, and no more.
      [true, true, 2.5],
      // Noise only outside the box: no back-search frame needs decoding at all.
      [true, false, 1.2],
    ] as const) {
      const frames = build(outside, inside);
      const cache = new Map<number, Uint8Array>();
      let decoded = 0;
      const pixels = {
        width: W,
        height: H,
        pixels: (i: number) => {
          const hit = cache.get(i);
          if (hit) {
            cache.delete(i);
            cache.set(i, hit);
            return hit;
          }
          decoded++;
          cache.set(i, frames[i]!);
          if (cache.size > 8) cache.delete(cache.keys().next().value!);
          return frames[i]!;
        },
      };
      const entries = frames.map((_, n) => ({ n, atMs: frameTimeMs(n), stable: true }));
      const events = buildStoryboard(entries, pixels).events;
      assert.equal(events.length, 12, `outside ${outside}`);
      assert.ok(
        events.every((e) => e.movedAfter?.n === (inside ? 0 : undefined)),
        `outside ${outside} inside ${inside}`,
      );
      // Linear: about two decodes a frame at most. Re-searching the visit for every blink was ~seven.
      assert.ok(decoded < bound * 600, `${decoded} decodes for 600 frames (outside ${outside}, inside ${inside})`);
    }
  });

  test("the summary notes only what happened", () => {
    const frames = repeat(blank, 8);
    frames[3] = frame([dot]);
    const s = sequence(frames);
    const md = storyboardSummary(
      buildStoryboard(s.entries, s.pixels),
      { tool: "t", url: "u", viewport: { width: W, height: H }, deviceScaleFactor: 1, clock: "held" },
      s.entries,
    );
    assert.doesNotMatch(md, /## Notes/, "a plain glitch on every frame of a held clock needs none");
  });
});

describe("storyboardSummary: one sequence, every section, byte for byte", () => {
  test("a glitch, a drift and a change that settles in the last frames", () => {
    const moved = (x: number) => frame([{ ...dot, x, rgb: [0, 0, 0] }]);
    const faint = (v: number): Paint => ({ x: 20, y: 18, w: 6, h: 4, rgb: [v, v, v] });
    const frames = repeat(moved(5), 12);
    frames[3] = frame([
      { ...dot, x: 5 },
      { x: 30, y: 2, w: 4, h: 4, rgb: [200, 0, 0] },
    ]);
    for (let i = 1; i <= 12; i++) frames.push(frame([{ ...dot, x: 5 }, faint(255 - i)]));
    frames.push(...repeat(frames.at(-1)!, 8));
    frames.push(frame([{ ...dot, x: 7 }, faint(243)]), ...repeat(frame([{ ...dot, x: 9 }, faint(243)]), 3));
    const s = sequence(frames);
    const md = storyboardSummary(
      buildStoryboard(s.entries, s.pixels),
      {
        tool: "check animation",
        url: "file:///page.html",
        viewport: { width: W, height: H },
        deviceScaleFactor: 1,
        browser: "chromium 141",
        clock: "held",
      },
      s.entries,
    );
    assert.equal(md, GOLDEN_SUMMARY);
  });
});

describe("eventKeyframes", () => {
  test("a glitch is before, the frame, and back; coinciding roles are one keyframe", () => {
    const frames = repeat(blank, 8);
    frames[3] = frame([dot]);
    const [e] = story(frames).events;
    assert.deepEqual(
      eventKeyframes(e!).map((k) => [k.frame.n, k.roles.join("+")]),
      [
        [2, "before"],
        [3, "first+peak+last"],
        [4, "back"],
      ],
    );
  });
});

/**
 * Random planted sequences: still spans, glitches, transients and changes in any order, each in a
 * colour of its own, and every event must come back exactly as planted.
 */
describe("buildStoryboard: planted at random", () => {
  interface Planted {
    kind: "glitch" | "transient" | "change";
    first: number;
    back?: number;
    settled?: number;
    box: Box;
  }

  function plant(seed: number) {
    const rng = createRng(seed);
    const kept: Paint[] = [];
    const frames: Uint8Array[] = [];
    const planted: Planted[] = [];
    let colour = 0;
    const nextColour = (): Rgb => {
      colour++;
      return [(colour * 37) % 200, (colour * 71) % 200, (colour * 113) % 200];
    };
    const still = (n: number) => {
      for (let i = 0; i < n; i++) frames.push(frame(kept));
    };
    still(rng.int(1, 6));
    const events = rng.int(0, 6);
    for (let e = 0; e < events; e++) {
      const w = rng.int(2, 8);
      const h = rng.int(2, 6);
      // Room for a transient's 11px slide or a change's 5px move: a box that leaves the canvas is not
      // planted any more.
      const x = rng.int(0, W - w - 12);
      const y = rng.int(0, H - h);
      const rgb = nextColour();
      const kind = rng.pick(["glitch", "transient", "change"] as const);
      const first = frames.length;
      if (kind === "glitch") {
        frames.push(frame([...kept, { x, y, w, h, rgb }]));
        planted.push({ kind, first, back: first + 1, box: { x, y, width: w, height: h } });
        still(rng.int(1, 4));
      } else if (kind === "transient") {
        const length = rng.int(2, 12);
        const slide = rng.int(0, 1);
        for (let i = 0; i < length; i++) frames.push(frame([...kept, { x: x + i * slide, y, w, h, rgb }]));
        planted.push({
          kind,
          first,
          back: first + length,
          box: { x, y, width: w + (length - 1) * slide, height: h },
        });
        still(rng.int(1, 4));
      } else {
        const steps = rng.int(1, 6);
        for (let i = 0; i < steps; i++) frames.push(frame([...kept, { x: x + i, y, w, h, rgb }]));
        kept.push({ x: x + steps - 1, y, w, h, rgb });
        planted.push({ kind, first, settled: first + steps - 1, box: { x, y, width: w + steps - 1, height: h } });
        // The hold the change settles in: at least 100ms at 60fps.
        still(rng.int(6, 10));
      }
    }
    still(8);
    return { frames, planted };
  }

  test("200 seeds: every planted event recovered, nothing else", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const { frames, planted } = plant(seed);
      const got = story(frames).events.map((e: StoryEvent) => ({
        kind: e.kind,
        first: e.first.n,
        ...(e.back ? { back: e.back.n } : {}),
        ...(e.settled ? { settled: e.settled.n } : {}),
        ...(e.movedAfter ? { movedAfter: e.movedAfter.n } : {}),
        peak: e.peak.n,
        box: e.box,
      }));
      // Every planted frame covers the same number of pixels, so the peak is the earliest: the
      // first. Nothing moves below the floor, so no event has a movedAfter.
      assert.deepEqual(
        got,
        planted.map((p) => ({ ...p, peak: p.first })),
        `seed ${seed}`,
      );
    }
  });

  test("SUMMARY.md and the brief are functions of the frames: two builds, the same bytes", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const { frames } = plant(seed);
      const source = {
        tool: "check animation",
        url: "file:///page.html",
        viewport: { width: W, height: H },
        deviceScaleFactor: 1,
        clock: "held" as const,
      };
      const a = sequence(frames);
      const b = sequence(frames.map((f) => f.slice()));
      const sa = buildStoryboard(a.entries, a.pixels);
      const sb = buildStoryboard(b.entries, b.pixels);
      assert.deepEqual(sa, sb, `seed ${seed}`);
      const summary = storyboardSummary(sa, source, a.entries);
      assert.equal(summary, storyboardSummary(sb, source, b.entries), `seed ${seed}`);
      assert.doesNotMatch(summary, /undefined|NaN|\[object/, `seed ${seed}`);
      const brief = storyboardBrief(sa, new Map(), sa.events.length);
      assert.doesNotMatch(brief, /undefined|NaN|\[object/, `seed ${seed}`);
      for (const e of sa.events) assert.match(summary, new RegExp(`\\| ${e.id} \\| ${e.kind} \\|`), `seed ${seed}`);
    }
  });
});

describe("storyboardSummary", () => {
  const source = {
    tool: "inspect interact",
    url: "file:///drawer.html",
    viewport: { width: W, height: H },
    deviceScaleFactor: 2,
    browser: "chromium 141",
    clock: "wall" as const,
    step: "close",
  };

  test("a glitch row, the state, the timeline and the sampling note", () => {
    const frames = repeat(blank, 6);
    frames[2] = frame([dot]);
    const s = sequence(frames, { gapMs: 50 });
    const md = storyboardSummary(buildStoryboard(s.entries, s.pixels), source, s.entries);
    assert.match(
      md,
      /inspect interact \(step close\) · file:\/\/\/drawer\.html · 40x30 viewport at 2x · chromium 141 · wall clock/,
    );
    assert.match(md, /6 frames of 40x30 px from 0 to 250 ms, every 50 ms\./);
    assert.match(md, /\| E1 \| glitch \| 50 – 100 \| 100 – 150 \| 1 \| 5,6 4x3 \| 12 px at 100 \| S0 → S0 \|/);
    assert.match(md, /S0 0–50 · E1 100 · S0 150–250/);
    assert.match(md, /Frames up to 50 ms apart/);
  });

  test("no events, said in words", () => {
    const s = sequence(repeat(blank, 3));
    assert.match(
      storyboardSummary(buildStoryboard(s.entries, s.pixels), source, s.entries),
      /None: every frame is within the floor of frame 0/,
    );
  });
});

/** Read by eye once (every value checked against the frames above), then pinned. */
const GOLDEN_SUMMARY = `# Storyboard

check animation · file:///page.html · 40x30 viewport at 1x · chromium 141 · held clock

36 frames of 40x30 px from 0 to 583.33 ms, every 60 fps frame.
A pixel differs when one of its channels moves by more than 8 of 255. A departure from the state that comes back within 5000 ms is one event (a glitch when it lasts one frame, a transient otherwise); one that does not is a change, which ends at the first 100 ms of identical frames (a drift when no step between two frames, inside its box, crosses the floor).

## Events

| Event | Kind | Began (ms) | Ended (ms) | Frames | Box (px) | Peak | States |
|---|---|---|---|---|---|---|---|
| E1 | glitch | 33.33 – 50 | 50 – 66.67 | 1 | 30,2 4x4 | 16 px at 50 | S0 → S0 |
| E2 | drift | 316.67 – 333.33 | 366.67 – 383.33 | 4 | 20,18 6x4 | 24 px at 333.33 | S0 → S1 |
| E3 | change | 516.67 – 533.33 | 533.33 – 550 | 2 | 5,6 8x3 | 24 px at 550 | S1 → S2 |

Began: between the last frame that showed the state and the first that did not. Ended: between the last frame that differed and the first back (glitch, transient), or between the last frame that moved and the first of the hold (change, drift). Box: every pixel the event moved over the floor, in the frames' pixels.

## States

| State | Frame | Visits |
|---|---|---|
| S0 | 0 ms (n 0) | 1 |
| S1 | 383.33 ms (n 23) | 1 |
| S2 | 550 ms (n 33) | 1 |

## Timeline

S0 0–33.33 · E1 50 · S0 66.67–316.67 · E2 333.33–383.33 · S1 383.33–516.67 · E3 533.33–550 · S2 550–583.33

## Notes

- E2: its pixels were last exactly S0's at 183.33 ms, and moved below the floor until it showed.
- E2: only 250 ms followed its first frame; a return later than that is not in the sequence.
- E3: the hold it settled in is the sequence's last 33.33 ms, shorter than 100 ms; it may still have been moving.
- E3: only 50 ms followed its first frame; a return later than that is not in the sequence.
`;

/** `f` with every channel of every pixel moved by a seeded value in [-amp, amp], clamped. */
function noisy(f: Uint8Array, seed: number, amp: number): Uint8Array {
  const rng = createRng(seed);
  const out = new Uint8Array(f);
  for (let i = 0; i < out.length; i++) {
    if (i % 4 === 3) continue;
    out[i] = Math.max(0, Math.min(255, out[i]! + Math.round((rng.next() * 2 - 1) * amp)));
  }
  return out;
}

const GREY: Rgb = [180, 180, 180];

/**
 * `f` as another GOP might encode it: every pixel moved by `amp`, up in four columns and down in
 * the next four, so 3x3 means move by `amp` and 8x8 block means not at all — ringing, at its most
 * regular. On a grey frame, so nothing clamps.
 */
const requant = (f: Uint8Array, amp: number) =>
  f.map((v, i) => {
    if (i % 4 === 3) return v;
    const x = (i >> 2) % W;
    return Math.max(0, Math.min(255, v + (Math.floor(x / 4) % 2 === 0 ? amp : -amp)));
  });

const lossyStory = (
  frames: readonly Uint8Array[],
  noise: NoiseFloor = LOSSY_NOISE,
  keys: readonly number[] = [],
  ignore: Box[] = [],
) => {
  const s = sequence(frames);
  const entries = s.entries.map((e) => ({ ...e, key: keys.includes(e.n) }));
  return buildStoryboard(entries, s.pixels, { noise, ignore });
};

describe("the noise band (lossy recordings)", () => {
  test("boxMean: each channel the rounded mean of the neighbourhood inside the frame", () => {
    const one = frame([{ x: 10, y: 10, w: 1, h: 1, rgb: [0, 0, 0] }]);
    assert.equal(boxMean(one, W, H, 0), one, "radius 0 is the frame itself");
    const mean = boxMean(one, W, H, 1);
    const at = (x: number, y: number) => mean[(y * W + x) * 4]!;
    assert.equal(at(10, 10), Math.round((255 * 8) / 9));
    assert.equal(at(11, 11), Math.round((255 * 8) / 9), "a neighbour shares the dark pixel's window");
    assert.equal(at(12, 12), 255, "two away it does not");
    assert.equal(mean[(10 * W + 10) * 4 + 3], 255, "alpha is averaged too");
    // A corner pixel's window is the four pixels of the frame around it.
    const corner = frame([{ x: 0, y: 0, w: 1, h: 1, rgb: [0, 0, 0] }]);
    assert.equal(boxMean(corner, W, H, 1)[0], Math.round((255 * 3) / 4));
    // A larger radius than the frame: every pixel is the mean of the whole frame.
    const tiny = new Uint8Array([0, 0, 0, 255, 255, 255, 255, 255]);
    assert.deepEqual([...boxMean(tiny, 2, 1, 5)], [128, 128, 128, 255, 128, 128, 128, 255]);
  });

  test("meanFrames: computed once per frame while it is kept", () => {
    const s = sequence([blank, frame([dot])]);
    const means = meanFrames(s.pixels, 1, 1);
    means.pixels(0);
    means.pixels(0);
    assert.equal(s.reads(), 1, "the second read is the kept mean");
    means.pixels(1);
    means.pixels(0);
    assert.equal(s.reads(), 3, "a capacity of one evicts frame 0 for frame 1");
  });

  test("frameDelta with still: deltas inside the band are no difference", () => {
    const by = (d: number) => frame([{ ...dot, rgb: [255 - d, 255, 255] }]);
    assert.deepEqual(frameDelta(blank, by(10), W, H, { still: 10, floor: 20 }), {
      identical: true,
      over: 0,
      box: null,
      changed: null,
      maxDelta: 10,
    });
    const mid = frameDelta(blank, by(15), W, H, { still: 10, floor: 20 });
    assert.equal(mid.identical, false);
    assert.equal(mid.over, 0, "between the band and the floor: moving, not differing");
    assert.deepEqual(mid.changed, { x: 5, y: 6, width: 4, height: 3 });
    const over = frameDelta(blank, by(21), W, H, { still: 10, floor: 20 });
    assert.equal(over.over, 12);
    assert.deepEqual(over.box, { x: 5, y: 6, width: 4, height: 3 });
  });

  test("ignoreMask grows each box for means, inside the frame", () => {
    const mask = ignoreMask(W, H, [{ x: 0, y: 2, width: 3, height: 2 }], 1)!;
    const rows = Array.from({ length: 6 }, (_, y) => [...mask.subarray(y * W, y * W + 6)].join(""));
    assert.deepEqual(rows, ["000000", "111100", "111100", "111100", "111100", "000000"]);
  });

  test("a still picture under codec-sized noise is no event; compared exactly, every frame is one", () => {
    const base = frame([dot, { x: 20, y: 10, w: 12, h: 8, rgb: [40, 90, 200] }]);
    const frames = Array.from({ length: 40 }, (_, n) => noisy(base, n + 1, 20));
    assert.deepEqual(lossyStory(frames).events, []);
    assert.ok(story(frames).events.length > 0, "the exact comparison calls the noise events");
  });

  test("a glitch and a change under noise are where they were planted, their boxes as drawn", () => {
    const base = frame([]);
    const box: Paint = { x: 14, y: 9, w: 7, h: 5, rgb: [20, 20, 20] };
    const frames = Array.from({ length: 50 }, (_, n) => noisy(n === 12 || n >= 30 ? frame([box]) : base, 100 + n, 16));
    const events = lossyStory(frames).events;
    assert.deepEqual(
      events.map((e) => [e.kind, e.first.n, e.back?.n ?? e.settled?.n]),
      [
        ["glitch", 12, 13],
        ["change", 30, 30],
      ],
    );
    for (const e of events) assert.deepEqual(e.box, { x: 14, y: 9, width: 7, height: 5 }, e.id);
  });

  test("a 1px line: the means find it, the decoded pixels draw it", () => {
    const line: Paint = { x: 10, y: 4, w: 1, h: 12, rgb: [0, 0, 0] };
    const frames = [...repeat(blank, 10), ...repeat(frame([line]), 20)];
    const [e] = lossyStory(frames).events;
    assert.deepEqual(e!.box, { x: 10, y: 4, width: 1, height: 12 });
  });

  test("a hold is measured from its first frame, so a ramp below the band is not still", () => {
    // 10 levels a frame for 12 frames: every step is inside the band (24), the ramp is 120.
    const level = (n: number) =>
      frame([
        { x: 8, y: 8, w: 16, h: 12, rgb: Array(3).fill(255 - 10 * Math.min(12, Math.max(0, n - 5))) as unknown as Rgb },
      ]);
    const frames = Array.from({ length: 40 }, (_, n) => level(n));
    const [e, ...rest] = lossyStory(frames).events;
    assert.equal(rest.length, 0);
    assert.equal(e!.first.n, 9, "past the floor (32) at 40 levels, frame 9");
    assert.equal(e!.settled!.n, 17, "the hold begins where the ramp stops, not at the first quiet step");
    assert.equal(e!.kind, "drift", "no step crosses the floor");
  });

  test("a keyframe that re-quantizes a still picture is read again, not an event", () => {
    const base = frame([dot], GREY);
    const frames = [...repeat(base, 10), ...repeat(requant(base, 50), 30)];
    const s = lossyStory(frames, LOSSY_NOISE, [0, 10]);
    assert.deepEqual(s.events, []);
    assert.deepEqual(s.reread, [{ n: 10, atMs: frameTimeMs(10), state: "S0", as: "keyframe" }]);
    // The same step on a frame that is not a keyframe is a change: its means move by 50.
    assert.deepEqual(
      lossyStory(frames, LOSSY_NOISE, [0]).events.map((e) => [e.kind, e.first.n]),
      [["change", 10]],
    );
    // Without a keyframe band keyframes are frames.
    const { keyframe: _, ...noBand } = LOSSY_NOISE;
    assert.equal(lossyStory(frames, noBand, [0, 10]).events.length, 1);
    assert.equal(lossyStory(frames, noBand, [0, 10]).reread, undefined);
    // A keyframe that moves means past the pixel band (96) is a change even when the blocks hold.
    assert.equal(
      lossyStory([...repeat(base, 10), ...repeat(requant(base, 100), 30)], LOSSY_NOISE, [0, 10]).events.length,
      1,
    );
  });

  test("the limit: a small change landing on a keyframe whose noise is spread is read again with it", () => {
    const base = frame([], GREY);
    const mark = (f: Uint8Array) => {
      const out = new Uint8Array(f);
      for (let y = 10; y < 15; y++) for (let x = 20; x < 23; x++) out.set([110, 110, 110, 255], (y * W + x) * 4);
      return out;
    };
    // Keyframe 10 re-encodes everything (±50, spread) and a 3x5 mark appears with it: within both
    // bands, so it is the keyframe's re-quantization, and SUMMARY.md lists the frame read again.
    const s = lossyStory([...repeat(base, 10), ...repeat(mark(requant(base, 50)), 30)], LOSSY_NOISE, [0, 10]);
    assert.deepEqual(s.events, []);
    assert.deepEqual(
      s.reread?.map((r) => [r.n, r.as]),
      [[10, "keyframe"]],
    );
    // On a keyframe that re-encodes nothing visibly, the same mark is a change.
    const quiet = lossyStory([...repeat(base, 10), ...repeat(mark(base), 30)], LOSSY_NOISE, [0, 10]);
    assert.deepEqual(
      quiet.events.map((e) => [e.kind, e.first.n]),
      [["change", 10]],
    );
  });

  test("a keyframe at the sequence's end is read again on the frames there are", () => {
    const base = frame([dot], GREY);
    const frames = [...repeat(base, 20), requant(base, 50), requant(base, 50)];
    const s = lossyStory(frames, LOSSY_NOISE, [0, 20]);
    assert.deepEqual(s.events, []);
    assert.deepEqual(
      s.reread?.map((r) => r.n),
      [20],
    );
  });

  test("a change that lands on a keyframe is still a change, past the floor and moving its blocks", () => {
    const frames = [...repeat(blank, 10), ...repeat(frame([{ ...dot, rgb: [0, 0, 0] }]), 30)];
    const s = lossyStory(frames, LOSSY_NOISE, [0, 10]);
    assert.deepEqual(
      s.events.map((e) => [e.kind, e.first.n]),
      [["change", 10]],
    );
    assert.deepEqual(s.reread, []);
    // A region 40 levels darker for a second (between the floor and the old keyframe band of 48),
    // its onset on a keyframe: its blocks move by 40, so it is not a re-quantization.
    const dim = frame([{ x: 8, y: 6, w: 20, h: 10, rgb: [140, 140, 140] }], GREY);
    const toast = lossyStory(
      [...repeat(frame([], GREY), 10), ...repeat(dim, 30), ...repeat(frame([], GREY), 20)],
      LOSSY_NOISE,
      [0, 10],
    );
    assert.deepEqual(
      toast.events.map((e) => [e.kind, e.first.n, e.back?.n]),
      [["transient", 10, 40]],
    );
    assert.deepEqual(
      toast.states.map((st) => st.id),
      ["S0"],
    );
  });

  test("a fade already moving below the floor is not read again where it crosses on a keyframe", () => {
    // A panel 1 level a frame darker from frame 7; its means pass the floor at frame 40, a keyframe.
    const level = (n: number) =>
      frame(
        [{ x: 4, y: 4, w: 30, h: 20, rgb: Array(3).fill(180 - Math.max(0, Math.min(60, n - 7))) as unknown as Rgb }],
        GREY,
      );
    const frames = Array.from({ length: 80 }, (_, n) => level(n));
    const keys = [0, 10, 20, 30, 40, 50, 60, 70];
    const s = lossyStory(frames, LOSSY_NOISE, keys);
    assert.equal(s.events.length, 1, JSON.stringify(s.events.map((e) => [e.kind, e.first.n])));
    assert.equal(s.events[0]!.kind, "drift");
    assert.ok(!(s.reread ?? []).some((r) => r.n === 40), "not read again on the crossing keyframe");
  });

  test("a toast fading in from a keyframe is one transient and leaves no state behind", () => {
    const base = frame([], GREY);
    const toast = (a: number) =>
      frame([{ x: 10, y: 8, w: 20, h: 10, rgb: Array(3).fill(Math.round(180 - 150 * a)) as unknown as Rgb }], GREY);
    const frames = [
      ...repeat(base, 20),
      ...Array.from({ length: 8 }, (_, i) => toast((i + 1) / 8)),
      ...repeat(toast(1), 30),
      ...Array.from({ length: 8 }, (_, i) => toast(1 - (i + 1) / 8)),
      ...repeat(base, 30),
    ];
    const s = lossyStory(frames, LOSSY_NOISE, [0, 20, 40, 60, 80]);
    assert.deepEqual(
      s.events.map((e) => e.kind),
      ["transient"],
    );
    assert.deepEqual(
      s.states.map((st) => st.id),
      ["S0"],
    );
  });

  test("a keyframe inside a transient: the page after it is the state re-quantized, a return", () => {
    const base = frame([], GREY);
    const toast = (f: Uint8Array) => {
      const out = new Uint8Array(f);
      for (let y = 20; y < 26; y++) for (let x = 20; x < 32; x++) out.set([30, 30, 30, 255], (y * W + x) * 4);
      return out;
    };
    const after = requant(base, 50);
    // The toast from 10 to 30; keyframe 20 re-quantizes everything under and around it.
    const frames = [...repeat(base, 10), ...repeat(toast(base), 10), ...repeat(toast(after), 10), ...repeat(after, 30)];
    const s = lossyStory(frames, LOSSY_NOISE, [0, 20]);
    assert.deepEqual(
      s.events.map((e) => [e.kind, e.first.n, e.back?.n]),
      [["transient", 10, 30]],
    );
    assert.deepEqual(
      s.states.map((st) => st.id),
      ["S0"],
    );
    assert.deepEqual(s.reread, [{ n: 30, atMs: frameTimeMs(30), state: "S0", as: "return" }]);
  });

  test("a caret still on after a keyframe is not a return: it is nearer itself than the state", () => {
    const base = frame([], GREY);
    const caret = (f: Uint8Array) => {
      const out = new Uint8Array(f);
      for (let y = 6; y < 20; y++) out.set([0, 0, 0, 255], (y * W + 13) * 4);
      return out;
    };
    const after = requant(base, 50);
    const frames = [...repeat(base, 20), ...repeat(caret(base), 10), ...repeat(caret(after), 16), ...repeat(after, 30)];
    const s = lossyStory(frames, LOSSY_NOISE, [0, 30]);
    assert.deepEqual(
      s.events.map((e) => [e.kind, e.first.n, e.back?.n]),
      [["transient", 20, 46]],
    );
    assert.deepEqual(
      s.states.map((st) => st.id),
      ["S0"],
    );
  });

  test("a small change that settles in a later GOP is a new state, not the old one re-quantized", () => {
    const base = frame([], GREY);
    const mark = (f: Uint8Array) => {
      const out = new Uint8Array(f);
      for (let y = 10; y < 15; y++) for (let x = 20; x < 23; x++) out.set([40, 40, 40, 255], (y * W + x) * 4);
      return out;
    };
    const after = requant(base, 50);
    const frames = [...repeat(base, 25), ...repeat(after, 5), ...repeat(mark(after), 40)];
    const s = lossyStory(frames, LOSSY_NOISE, [0, 25]);
    assert.deepEqual(
      s.events.map((e) => [e.kind, e.first.n, e.from, e.to]),
      [["change", 30, "S0", "S1"]],
    );
    assert.deepEqual(
      s.reread?.map((r) => [r.n, r.as]),
      [[25, "keyframe"]],
    );
  });

  test("a return to a state in another GOP is that state, read again, never a new one", () => {
    const base = frame([], GREY);
    const panel = (f: Uint8Array) => {
      const out = new Uint8Array(f);
      for (let y = 10; y < 18; y++) for (let x = 10; x < 26; x++) out.set([20, 20, 20, 255], (y * W + x) * 4);
      return out;
    };
    // GOP A as drawn, B re-quantized, then A again; a panel open from 20 for 7s, closed at 450.
    const frames = [
      ...repeat(base, 10),
      ...repeat(requant(base, 50), 10),
      ...repeat(panel(requant(base, 50)), 10),
      ...repeat(panel(base), 420),
      ...repeat(base, 30),
    ];
    const s = lossyStory(frames, LOSSY_NOISE, [0, 10, 30]);
    assert.deepEqual(
      s.events.map((e) => [e.kind, e.from, e.to]),
      [
        ["change", "S0", "S1"],
        ["change", "S1", "S0"],
      ],
    );
    assert.deepEqual(
      s.states.map((st) => st.id),
      ["S0", "S1"],
    );
  });

  test("a fade slower than the band per hold is one drift, not a run of holds", () => {
    for (const perFrame of [1.7, 4]) {
      const level = (n: number) =>
        frame([
          {
            x: 4,
            y: 4,
            w: 30,
            h: 20,
            rgb: Array(3).fill(Math.round(255 - Math.min(100, Math.max(0, n - 10) * perFrame))) as unknown as Rgb,
          },
        ]);
      const frames = Array.from({ length: 120 }, (_, n) => level(n));
      const s = lossyStory(frames);
      assert.equal(
        s.events.length,
        1,
        `${perFrame}/frame: ${JSON.stringify(s.events.map((e) => [e.kind, e.first.n, e.settled?.n]))}`,
      );
      assert.equal(s.events[0]!.kind, "drift");
      // The last levels of a fade (within the hold's region band of 3) are its end.
      const end = 10 + Math.ceil(100 / perFrame);
      assert.ok(
        s.events[0]!.settled!.n >= end - 2,
        `settles where the fade stops (${perFrame}/frame): ${s.events[0]!.settled!.n} for ${end}`,
      );
    }
  });

  test("an instant change a codec smears over four frames is a change, not a drift", () => {
    // Steps of 16 (inside the band of 24) four frames in a row: 64 in 67ms.
    const level = (n: number) =>
      frame([
        { x: 8, y: 8, w: 12, h: 10, rgb: Array(3).fill(255 - 16 * Math.min(4, Math.max(0, n - 9))) as unknown as Rgb },
      ]);
    const [e, ...rest] = lossyStory(Array.from({ length: 40 }, (_, n) => level(n))).events;
    assert.equal(rest.length, 0);
    assert.equal(e!.kind, "change");
  });

  test("boxes and counts beside an ignored box are drawn from the decoded pixels it does not cover", () => {
    const line = (x: number) => frame([{ x, y: 4, w: 1, h: 14, rgb: [0, 0, 0] }]);
    const frames = [...repeat(blank, 10), ...repeat(line(20), 20)];
    const [e] = lossyStory(frames, LOSSY_NOISE, [], [{ x: 10, y: 2, width: 10, height: 20 }]).events;
    assert.deepEqual(e!.box, { x: 20, y: 4, width: 1, height: 14 });
    assert.equal(e!.peak.over, 14, "the peak counts the pixels its box is drawn from");
  });

  test("an ignored box is grown by the radius, so a clock beside a still picture is no event", () => {
    const clock = (n: number) => frame([{ x: 30, y: 2, w: 6, h: 4, rgb: n % 2 ? [0, 0, 0] : [120, 120, 120] }]);
    const frames = Array.from({ length: 30 }, (_, n) => clock(Math.floor(n / 5)));
    assert.deepEqual(lossyStory(frames, LOSSY_NOISE, [], [{ x: 30, y: 2, width: 6, height: 4 }]).events, []);
  });

  test("a band it cannot use is refused", () => {
    const s = sequence([blank]);
    for (const [noise, re] of [
      [{ radius: 1, still: 32, floor: 32 }, /still \(32\) must be below its floor/],
      [
        { radius: 1, still: 8, floor: 32, keyframe: { block: 24, pixel: 32 } },
        /keyframe pixel band must be a whole number above the floor/,
      ],
      [
        { radius: 1, still: 8, floor: 32, keyframe: { block: -1, pixel: 96 } },
        /keyframe block band must be a whole number/,
      ],
      [{ radius: 1, still: 8, floor: 32, holdMean: 9 }, /holdMean must be a whole number 0 to still \(8\)/],
      [{ radius: -1, still: 8, floor: 32 }, /radius must be a whole number/],
      [{ radius: 1, still: 8.5, floor: 32 }, /still must be a whole number/],
    ] as const) {
      assert.throws(() => buildStoryboard(s.entries, s.pixels, { noise }), re);
    }
  });

  test("SUMMARY.md states the band and every frame it read again", () => {
    const base = frame([dot], GREY);
    const frames = [...repeat(base, 10), ...repeat(requant(base, 50), 10)];
    const st = lossyStory(frames, LOSSY_NOISE, [0, 10]);
    const source = {
      tool: "scan video",
      url: "file:///rec.mp4",
      viewport: { width: W, height: H },
      deviceScaleFactor: 1,
      clock: "stream" as const,
      video: { file: "rec.mp4", decoder: "ffmpeg", codec: "h264", lossless: false },
    };
    const entries = frames.map((_, n) => ({ atMs: frameTimeMs(n), index: n, key: n === 0 || n === 10 }));
    const md = storyboardSummary(st, source as never, entries);
    assert.match(
      md,
      /Compared as the mean of each pixel's 3x3 neighbourhood, through a noise band: a pixel differs when a channel of its mean moves by more than 32 of 255, and frames show one picture while every mean stays within 24 of the first of them and the mean over a change's box within 3\./,
    );
    assert.match(md, /None: every frame is within the floor of S0's picture, read again at 1 frame\./);
    assert.match(
      md,
      /Read again at 166\.67 ms \(n 10, S0, a keyframe\): the picture there differed from the state's only as a codec re-quantizes one — no 8x8 block's mean moved by more than 24, no 3x3 mean by more than 96/,
    );
    assert.match(
      md,
      /Decoded from h264, a lossy codec, compared through the noise band: what the codec does to a still picture stays inside it/,
    );
    // Radius 0 compares the decoded pixels; the sentence says so.
    const raw = buildStoryboard(sequence(frames).entries, sequence(frames).pixels, {
      noise: { radius: 0, still: 8, floor: 32 },
    });
    assert.match(
      storyboardSummary(raw, source as never, entries),
      /Compared pixel by pixel as decoded, through a noise band/,
    );
  });
});
