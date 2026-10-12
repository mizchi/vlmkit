import assert from "node:assert/strict";
import { describe, test } from "vite-plus/test";
import { frameTimeMs } from "./frames.ts";
import { createRng } from "./pbt.ts";
import {
  buildStoryboard,
  CHANNEL_FLOOR,
  eventKeyframes,
  frameDelta,
  ignoreMask,
  storyboardBrief,
  storyboardSummary,
  type Box,
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
    assert.deepEqual(frameDelta(blank, blank, W, H), { identical: true, over: 0, box: null, maxDelta: 0 });
    const faint = frame([{ ...dot, rgb: [255 - CHANNEL_FLOOR, 255, 255] }]);
    assert.deepEqual(frameDelta(blank, faint, W, H), { identical: false, over: 0, box: null, maxDelta: 8 });
    const shown = frame([{ ...dot, rgb: [255 - CHANNEL_FLOOR - 1, 255, 255] }]);
    assert.deepEqual(frameDelta(blank, shown, W, H), {
      identical: false,
      over: 12,
      box: { x: 5, y: 6, width: 4, height: 3 },
      maxDelta: 9,
    });
  });

  test("a mask hides what is inside it, identity included", () => {
    const mask = new Uint8Array(W * H);
    for (let y = 6; y < 9; y++) mask.fill(1, y * W + 5, y * W + 9);
    assert.equal(frameDelta(blank, frame([dot]), W, H, { mask }).identical, true);
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
    assert.equal(s.events[0]!.endedInMotion, true);
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
    assert.equal(unmasked.events[0]!.endedInMotion, true, "the video swallows the sequence");
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

  test("a still page is read once per frame against the anchor, not once per pair", () => {
    const s = sequence(repeat(blank, 50));
    buildStoryboard(s.entries, s.pixels);
    assert.ok(s.reads() <= 2 * 49, `${s.reads()} reads`);
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
      b.events.map((e) => [e.kind, e.settled?.n, e.to, e.endedInMotion]),
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

  test("a fade keeps its movedAfter through a glitch elsewhere that comes back within the floor", () => {
    const elsewhere: Paint = { x: 30, y: 20, w: 3, h: 3, rgb: [0, 0, 0] };
    const frames = repeat(blank, 5);
    for (let i = 1; i <= 20; i++) frames.push(frame([level(255 - i), ...(frames.length === 7 ? [elsewhere] : [])]));
    frames.push(...repeat(frames.at(-1)!, 10));
    assert.deepEqual(
      story(frames).events.map((e) => [e.kind, e.first.n, e.back?.n, e.settled?.n, e.movedAfter?.n, e.maxStepDelta]),
      [
        ["glitch", 7, 8, undefined, 4, 255],
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
      [["drift", 4, 1]],
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

  test("a picture is one state wherever it recurs: a return within the floor is anchored on the state's frame", () => {
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

  test("an ignored box that is not on whole pixels covers every pixel it touches", () => {
    const mask = ignoreMask(8, 4, [{ x: 0, y: 0.5, width: 2, height: 1 }])!;
    assert.deepEqual(
      [...mask.keys()].filter((i) => mask[i] === 1),
      [0, 1, 8, 9],
    );
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

- E2: pixels were already moving below the floor after 183.33 ms, the last frame identical to S0.
- E2: only 250 ms followed its first frame; a return later than that is not in the sequence.
- E3: the hold it settled in is the sequence's last 33.33 ms, shorter than 100 ms; it may still have been moving.
- E3: only 50 ms followed its first frame; a return later than that is not in the sequence.
`;
