import assert from "node:assert/strict";
import { describe, test } from "vite-plus/test";
import { relativeLuminance, srgbChannelToLinear } from "./color.ts";
import {
  AREA_LIMIT_CSS2,
  bestField,
  closeMask,
  createFlashJudge,
  flashFrame,
  meanFlashFrame,
  TRANSITIONS_KEPT,
  type FlashFrame,
} from "./flash.ts";
import { classifyFlash, runSpans, type FlashSequence } from "./flash-motion.ts";
import { frameTimeMs } from "./frames.ts";
import { createRng } from "./pbt.ts";

type Rgb = readonly [number, number, number];
const BLACK: Rgb = [0, 0, 0];
const WHITE: Rgb = [255, 255, 255];

/** Paints one frame: `paint(x, y)` → colour, over `w x h`. */
function rgba(w: number, h: number, paint: (x: number, y: number) => Rgb): Uint8Array {
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b] = paint(x, y);
      const i = (y * w + x) * 4;
      out[i] = r;
      out[i + 1] = g;
      out[i + 2] = b;
      out[i + 3] = 255;
    }
  }
  return out;
}

/**
 * A 60fps sequence of `frames`, each painted by `at(k)`, judged and kept for re-counting. `key(k)`,
 * when given, names frames that are the same picture, so a strobe is painted twice, not 90 times.
 */
function sequence(
  w: number,
  h: number,
  frames: number,
  at: (k: number) => (x: number, y: number) => Rgb,
  key: (k: number) => string | number = (k) => k,
) {
  const cache = new Map<string | number, FlashFrame>();
  const times = Array.from({ length: frames }, (_, k) => frameTimeMs(k));
  const seq: FlashSequence = {
    times,
    frame(k) {
      const id = key(k);
      let f = cache.get(id);
      if (!f) {
        f = flashFrame(rgba(w, h, at(k)), w, h);
        cache.set(id, f);
        if (cache.size > 30) cache.delete(cache.keys().next().value!);
      }
      return f;
    },
  };
  const judge = createFlashJudge({ width: w, height: h });
  for (let k = 0; k < frames; k++) judge.push(k, times[k]!, seq.frame(k));
  return { seq, result: judge.result() };
}

/** On/off at `hz` flashes a second (2·hz transitions), half a frame off the boundary. */
const phase = (k: number, hz: number) => Math.floor(((frameTimeMs(k) + 1000 / 120) * 2 * hz) / 1000) % 2 === 1;

const strobe = (a: Rgb, b: Rgb, hz: number) => (k: number) => () => (phase(k, hz) ? b : a);
/** Frames of a two-state sequence are one of two pictures. */
const twoState = (hz: number) => (k: number) => (phase(k, hz) ? 1 : 0);
const boxStrobe =
  (x0: number, y0: number, bw: number, bh: number, hz: number, on: Rgb = BLACK, off: Rgb = WHITE, bg: Rgb = WHITE) =>
  (k: number) =>
  (x: number, y: number) =>
    x >= x0 && x < x0 + bw && y >= y0 && y < y0 + bh ? (phase(k, hz) ? off : on) : bg;

const grey = (v: number): Rgb => [v, v, v];

describe("color: the linearisation flash shares with contrast", () => {
  test("0.03928 (WCAG 2.0) and 0.04045 (sRGB, WCAG 2.2) pick the same branch for every 8-bit value", () => {
    for (let i = 0; i < 256; i++) {
      const c = i / 255;
      assert.equal(c <= 0.03928, c <= 0.04045, `value ${i}`);
    }
  });

  test("relativeLuminance is the shared curve, unchanged", () => {
    assert.equal(relativeLuminance([255, 255, 255]), 1);
    assert.equal(relativeLuminance([0, 0, 0]), 0);
    const L = relativeLuminance([170, 170, 170]);
    assert.equal(L, srgbChannelToLinear(170));
    assert.ok(Math.abs(L - 0.402) < 0.001);
  });
});

describe("flash judge: the general track's known answers", () => {
  const W = 400;
  const H = 300;
  const FIELD = 341 * 256;
  for (const [hz, fails, most] of [
    [2.5, false, 5],
    [3, false, 6],
    [3.5, true, 7],
    [4, true, 8],
    [10, true, TRANSITIONS_KEPT],
  ] as const) {
    test(`a full-field black/white strobe at ${hz} Hz ${fails ? "fails" : "passes"} (${most} transitions at most)`, () => {
      const { result } = sequence(W, H, 120, strobe(BLACK, WHITE, hz), twoState(hz));
      assert.equal(result.general.failing.length > 0, fails);
      assert.equal(result.general.peak.transitions, most);
      if (fails) {
        assert.equal(result.general.worst!.area, FIELD);
        assert.equal(result.general.failing[0]!.area, FIELD);
        assert.equal(result.general.runs.length, 1, "one strobe is one run");
      } else {
        assert.equal(result.general.worst, null, "no pixel flashed more than three times a second");
      }
      assert.equal(result.red.peak.transitions, 0, "black/white is not red");
    });
  }

  test("exactly three flashes a second passes: the window is half-open", () => {
    const { result } = sequence(W, H, 180, strobe(BLACK, WHITE, 3), twoState(3));
    assert.equal(result.general.failing.length, 0);
    assert.equal(result.general.peak.transitions, 6);
  });

  for (const [bw, bh, x0, y0, area] of [
    [144, 148, 40, 40, 21_312],
    [146, 146, 41, 41, 21_316],
    [148, 148, 40, 40, 21_904],
    [148, 148, 41, 43, 21_904],
  ] as const) {
    const fails = area > AREA_LIMIT_CSS2;
    test(`a ${bw}x${bh} box at (${x0},${y0}) is exactly ${area} CSS px² and ${fails ? "fails" : "passes"}`, () => {
      const { result } = sequence(W, H, 90, boxStrobe(x0, y0, bw, bh, 4), twoState(4));
      assert.equal(result.general.worst!.area, area);
      assert.equal(result.general.failing.length > 0, fails);
      assert.equal(result.general.largestBelow, fails ? 0 : area);
      assert.deepEqual(result.general.worst!.bbox, { x: x0, y: y0, width: bw, height: bh });
    });
  }

  test("grey pairs: ΔL 0.089 passes, ΔL 0.107 fails", () => {
    assert.equal(sequence(W, H, 90, strobe(grey(0xaa), grey(0xba), 5), twoState(5)).result.general.failing.length, 0);
    assert.ok(sequence(W, H, 90, strobe(grey(0xaa), grey(0xbd), 5), twoState(5)).result.general.failing.length > 0);
  });

  test("a light pair whose darker state is 0.847 passes however often it flips", () => {
    const { result } = sequence(W, H, 90, strobe(grey(0xed), WHITE, 10), twoState(10));
    assert.equal(result.general.failing.length, 0);
    assert.equal(result.general.peak.transitions, 0);
  });

  // A 200x200 dither is 40,000 px²; closing leaves out the two corners its own pattern leaves open.
  test("a 1px dither that turns white flashes as its region, not its changed half (39,998 → fail)", () => {
    const dither = (k: number) => (x: number, y: number) =>
      x >= 20 && x < 220 && y >= 20 && y < 220 && !phase(k, 4) && (x + y) % 2 === 0 ? BLACK : WHITE;
    const { result } = sequence(W, H, 90, dither, (k) => (phase(k, 4) ? 1 : 0));
    assert.equal(result.general.worst!.area, 39_998);
    assert.ok(result.general.failing.length > 0);
  });

  test("a 2px inverting checkerboard is reported: WCAG's 0.1° exemption is not applied", () => {
    const checker = (k: number) => (x: number, y: number) =>
      (Math.floor(x / 2) + Math.floor(y / 2) + (phase(k, 10) ? 1 : 0)) % 2 === 0 ? BLACK : WHITE;
    const { result } = sequence(W, H, 60, checker, twoState(10));
    assert.equal(result.general.worst!.area, FIELD);
  });

  test("four quadrants lit in turn, once a second each, pass: no place flashes three times", () => {
    const quads = (k: number) => (x: number, y: number) => {
      const q = (x < W / 2 ? 0 : 1) + (y < H / 2 ? 0 : 2);
      const t = (frameTimeMs(k) + 1000 / 120 - q * 250) % 1000;
      return t >= 0 && t < 125 ? WHITE : BLACK;
    };
    const { result } = sequence(W, H, 180, quads);
    assert.equal(result.general.failing.length, 0);
    assert.equal(result.general.peak.transitions, 2);
  });

  test("an area under the limit is measured as one over it is: closed, inside its field", () => {
    // A 147x147 1px dither: half its pixels change; odd-sized, all four corners are set, so closed it is the whole 21,609 px².
    const dither = (k: number) => (x: number, y: number) =>
      x >= 20 && x < 167 && y >= 20 && y < 167 && !phase(k, 4) && (x + y) % 2 === 0 ? BLACK : WHITE;
    const { result } = sequence(W, H, 90, dither, (k) => (phase(k, 4) ? 1 : 0));
    assert.equal(result.general.failing.length, 0);
    assert.equal(result.general.worst!.area, 147 * 147);
    assert.equal(result.general.largestBelow, 147 * 147);
  });

  test("the worst window's field holds what flashes, even when the flashes are far apart", () => {
    const w = 800;
    const blinkers = (k: number) => (x: number, y: number) =>
      (x < 20 || x >= 780) && y >= 100 && y < 120 && phase(k, 4) ? WHITE : BLACK;
    const { result } = sequence(w, H, 90, blinkers, (k) => (phase(k, 4) ? 1 : 0));
    const worst = result.general.worst!;
    assert.equal(worst.area, 400);
    assert.ok(worst.maxTransitions >= 7);
    assert.ok(worst.bbox.width > 0);
  });

  test("of windows over the same area, the worst is the one with the most transitions", () => {
    const { result } = sequence(W, H, 90, strobe(BLACK, WHITE, 4), twoState(4));
    assert.equal(result.general.worst!.maxTransitions, 8);
  });

  test("pixels nothing measured count as flashing beside what does: together over the limit is no pass", () => {
    const unknown = new Uint8Array(W * H);
    for (let y = 0; y < 150; y++) for (let x = 150; x < 300; x++) unknown[y * W + x] = 1;
    const judge = createFlashJudge({ width: W, height: H, unknown });
    const paint = boxStrobe(0, 0, 140, 140, 4);
    const frames = [flashFrame(rgba(W, H, paint(0)), W, H), flashFrame(rgba(W, H, paint(8)), W, H)];
    for (let k = 0; k < 90; k++) judge.push(k, frameTimeMs(k), frames[phase(k, 4) ? 1 : 0]!);
    const r = judge.result().general;
    assert.equal(r.failing.length, 0);
    assert.equal(r.largestBelow, 140 * 140);
    assert.equal(r.withUnknown, 140 * 140 + 150 * 150 - 0);
  });

  test("a static frame never evaluates", () => {
    const { result } = sequence(
      W,
      H,
      30,
      () => (x) => (x < 100 ? BLACK : WHITE),
      () => 0,
    );
    assert.equal(result.general.worst, null);
    assert.equal(result.general.peak.transitions, 0);
    assert.equal(result.red.worst, null);
    assert.equal(result.frames, 30);
  });

  test("the worst pixel's transition frames are the window's, in order", () => {
    const { result } = sequence(W, H, 90, strobe(BLACK, WHITE, 4), twoState(4));
    const ev = result.general.failing[0]!;
    assert.equal(ev.pixel.frames.length, ev.maxTransitions);
    assert.deepEqual(
      ev.pixel.frames,
      [...ev.pixel.frames].sort((a, b) => a - b),
    );
    assert.equal(ev.pixel.frames.at(-1), ev.frame);
    assert.ok(frameTimeMs(ev.frame) - frameTimeMs(ev.pixel.frames[0]!) < 1000);
  });
});

describe("flash judge: the red track", () => {
  const W = 400;
  const H = 300;
  test("saturated red against grey of equal luminance: general passes, red fails", () => {
    const { result } = sequence(W, H, 90, strobe([255, 0, 0], grey(0x7f), 4), twoState(4));
    assert.equal(result.general.failing.length, 0);
    assert.ok(result.red.failing.length > 0);
  });

  test("red against black fails on both tracks", () => {
    const { result } = sequence(W, H, 90, strobe([255, 0, 0], BLACK, 4), twoState(4));
    assert.ok(result.general.failing.length > 0);
    assert.ok(result.red.failing.length > 0);
  });

  test("near-black tints are below the red floor and pass", () => {
    for (const [a, b] of [
      [BLACK, [1, 0, 0]],
      [BLACK, [2, 0, 0]],
      [
        [1, 0, 0],
        [0, 1, 0],
      ],
      [
        [5, 0, 0],
        [5, 5, 5],
      ],
    ] as const) {
      const { result } = sequence(W, H, 60, strobe(a, b, 5), twoState(5));
      assert.equal(result.red.peak.transitions, 0, `${a} ↔ ${b}`);
      assert.equal(result.general.peak.transitions, 0, `${a} ↔ ${b}`);
    }
  });

  test("a red pulse that fades in and out (black ↔ #a00000) fails red: the fade's first frame is not yet saturated", () => {
    // Linear in sRGB over 3 frames each way at ~4.6 Hz: black, #350000, #6a0000, #a00000, #6a0000, #350000.
    const ramp = [0, 0x35, 0x6a, 0xa0, 0x6a, 0x35];
    const { result } = sequence(
      W,
      H,
      120,
      (k) => () => [ramp[(k + 1) % ramp.length]!, 0, 0],
      (k) => (k + 1) % ramp.length,
    );
    assert.ok(result.red.failing.length > 0, JSON.stringify(result.red.peak));
    assert.equal(result.general.failing.length, 0, "the luminance step is under 0.1");
  });

  test("red against white, slowly, passes", () => {
    const { result } = sequence(W, H, 120, strobe([255, 0, 0], WHITE, 2), twoState(2));
    assert.equal(result.red.failing.length, 0);
    assert.equal(result.general.failing.length, 0);
  });
});

describe("flash judge: input", () => {
  test("device pixels are averaged in linear light into CSS pixels", () => {
    // 2x: a black/white 1px checker of device pixels is one mid-grey CSS pixel of linear 0.5.
    const dev = rgba(4, 4, (x, y) => ((x + y) % 2 === 0 ? BLACK : WHITE));
    const f = flashFrame(dev, 4, 4, 2);
    assert.equal(f.width, 2);
    assert.equal(f.height, 2);
    for (const L of f.lum) assert.ok(Math.abs(L - 0.5) < 1e-9);
  });

  test("frames must be in order, of the judged size and in time order", () => {
    const judge = createFlashJudge({ width: 2, height: 2 });
    const f = flashFrame(
      rgba(2, 2, () => WHITE),
      2,
      2,
    );
    assert.throws(() => judge.push(1, 0, f), /pushed after/);
    judge.push(0, 0, f);
    assert.throws(() => judge.push(1, 0, f), /time order/);
    assert.throws(
      () =>
        judge.push(
          1,
          10,
          flashFrame(
            rgba(3, 2, () => WHITE),
            3,
            2,
          ),
        ),
      /expected 2x2/,
    );
  });

  test("the mean of a box is of light: black and white average to linear 0.5, not to white's chromaticity", () => {
    const f = flashFrame(
      rgba(2, 1, (x) => (x === 0 ? BLACK : [255, 0, 0])),
      2,
      1,
    );
    const m = meanFlashFrame(f, { x: 0, y: 0, width: 2, height: 1 });
    assert.ok(Math.abs(m.lum[0]! - 0.2126 / 2) < 1e-6);
    assert.equal(m.sat[0], 1, "half-intensity red is still saturated red");
  });
});

describe("closeMask and bestField", () => {
  test("closing fills a 1px dither and keeps a solid region's edge", () => {
    const w = 20;
    const h = 20;
    const dither = new Uint8Array(w * h);
    for (let y = 5; y < 15; y++) for (let x = 5; x < 15; x++) if ((x + y) % 2 === 0) dither[y * w + x] = 1;
    const closed = closeMask(dither, w, h, 5, 5, 14, 14);
    let n = 0;
    for (const v of closed) n += v;
    assert.equal(n, 98, "all but the two corners the pattern itself leaves open");
    const solid = new Uint8Array(w * h);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) solid[y * w + x] = 1;
    const kept = closeMask(solid, w, h, 0, 0, 7, 7);
    assert.deepEqual([...kept], [...solid]);
  });

  test("the field slides to wherever it holds the most", () => {
    const w = 30;
    const h = 10;
    const mask = new Uint8Array(w * h);
    for (let x = 0; x < 5; x++) mask[2 * w + x] = 1;
    for (let x = 20; x < 30; x++) for (let y = 0; y < 3; y++) mask[y * w + x] = 1;
    const best = bestField(mask, w, h, 10, 10, 0, 0, 29, 2);
    assert.equal(best.area, 30);
    assert.deepEqual(best.field, { x: 20, y: 0, width: 10, height: 10 });
  });
});

/** Dark marks on white, at random, with no period: something to read as it moves. One mark per `per` px². */
function texture(seed: number, w: number, h: number, per = 60): Uint8Array {
  const rng = createRng(seed).next;
  const ink = new Uint8Array(w * h);
  for (let i = 0; i < (w * h) / per; i++) {
    const x0 = Math.floor(rng() * w);
    const y0 = Math.floor(rng() * h);
    const mw = 2 + Math.floor(rng() * 6);
    const mh = 6 + Math.floor(rng() * 14);
    for (let y = y0; y < Math.min(h, y0 + mh); y++) for (let x = x0; x < Math.min(w, x0 + mw); x++) ink[y * w + x] = 1;
  }
  return ink;
}

describe("flash motion: flicker motion explains is told apart from flashing", () => {
  const W = 400;
  const H = 300;
  const TW = 3000;
  const ink = texture(7, TW, H);
  const at = (x: number, y: number) => (ink[y * TW + (((x % TW) + TW) % TW)] ? BLACK : WHITE);

  const judged = (frames: number, paint: (k: number) => (x: number, y: number) => Rgb, w = W, h = H) => {
    const { seq, result } = sequence(w, h, frames, paint);
    return {
      result,
      general: result.general.runs.length > 0 ? classifyFlash(seq, "general", result.general.runs) : null,
    };
  };

  test("text scrolling 5px a frame fails per pixel and is motion", () => {
    const { result, general } = judged(90, (k) => (x, y) => at(x + 5 * k, y));
    assert.ok(result.general.failing.length > 0, "per-pixel counting alone reports it");
    assert.equal(general!.classification, "motion");
    assert.equal(general!.reason, "explained");
    assert.ok(general!.segments.every((s) => (s.residualArea ?? 0) <= AREA_LIMIT_CSS2));
    assert.deepEqual(general!.segments[0]!.velocity, { x: -300, y: 0 });
  });

  test("text scrolling 2.5px a frame (antialiased) is motion", () => {
    // Box-filtered over the half pixel it moves, as a renderer blends an edge between pixels.
    const blended = (k: number) => (x: number, y: number) => {
      const s = 2.5 * k;
      const i = Math.floor(s);
      const f = s - i;
      const a = at(x + i, y)[0];
      const b = at(x + i + 1, y)[0];
      return grey(Math.round(a * (1 - f) + b * f));
    };
    const { result, general } = judged(90, blended);
    assert.ok(result.general.failing.length > 0);
    assert.equal(general!.classification, "motion");
  });

  test("a carousel slide (fast, eased, then resting) is motion", () => {
    const offset = (k: number) => {
      const t = Math.min(1, (k % 40) / 18);
      return Math.round(1024 * (Math.floor(k / 40) + t * t * (3 - 2 * t)));
    };
    const { result, general } = judged(90, (k) => (x, y) => at(x + offset(k), y));
    if (result.general.failing.length > 0) assert.equal(general!.classification, "motion");
  });

  test("a box teleporting back and forth at 5 Hz is a flash", () => {
    const { general } = judged(90, (k) => (x, y) => {
      const x0 = phase(k, 5) ? 220 : 0;
      return x >= x0 && x < x0 + 170 && y >= 20 && y < 280 ? WHITE : BLACK;
    });
    assert.equal(general!.classification, "flash");
  });

  test("a textured panel teleporting back and forth is a flash, though each jump matches", () => {
    const { general } = judged(90, (k) => (x, y) => at(x + (phase(k, 5) ? 40 : 0), y));
    assert.equal(general!.classification, "flash");
  });

  test("a full-field strobe behind a scrolling ticker is a flash", () => {
    for (const hz of [4, 5, 10]) {
      const { general } = judged(90, (k) => (x, y) => {
        const bg = phase(k, hz) ? WHITE : BLACK;
        return y >= 40 && y < 74 && ink[(y - 40) * TW + ((x + 5 * k) % TW)] ? grey(0x80) : bg;
      });
      assert.equal(general!.classification, "flash", `${hz} Hz`);
      assert.equal(general!.reason, "field", `${hz} Hz`);
    }
  });

  test("a light strobe (ΔL 0.1, darker 0.7) behind scrolling text is a flash: the step is small, not motion", () => {
    // sRGB 218 is L 0.701, 232 is L 0.807: about the smallest general transition near white. The
    // text is 60% ink, so the field's mean steps 0.04 and only the tracked content can tell. It
    // moves 2px a frame: content carries the history it gathered in view, and at 5px a frame
    // through a 400px frame no content is in view long enough for a field of it to hold seven.
    const { general } = judged(
      90,
      (k) => (x, y) => (ink[y * TW + ((x + 2 * k) % TW)] ? grey(0x60) : phase(k, 4) ? grey(232) : grey(218)),
    );
    assert.equal(general!.classification, "flash");
    assert.equal(general!.reason, "residual");
  });

  test("a background pulsing smoothly at 4 Hz behind scrolling text is a flash: small steps add up on the content", () => {
    // sRGB 192 ↔ 224 (L 0.53 ↔ 0.75) as a sine: no frame's step is near 0.1, and the field's
    // mean moves less than 0.1 under 60% ink.
    const { general } = judged(90, (k) => {
      const bg = Math.round(208 + 16 * Math.sin((2 * Math.PI * 4 * frameTimeMs(k)) / 1000));
      return (x, y) => (ink[y * TW + ((x + 2 * k) % TW)] ? grey(0x60) : grey(bg));
    });
    assert.equal(general!.classification, "flash");
    assert.equal(general!.reason, "residual");
  });

  /** Box-filtered over the part of a pixel the content has moved, as a renderer blends an edge. */
  const subpixel = (speed: number, bg: (k: number) => number) => (k: number) => {
    const s = speed * k;
    const i = Math.floor(s);
    const f = s - i;
    const b = bg(k);
    return (x: number, y: number) => {
      const a = ink[y * TW + ((x + i) % TW)] ? 0x60 : b;
      const c = ink[y * TW + ((x + i + 1) % TW)] ? 0x60 : b;
      return grey(Math.round(a * (1 - f) + c * f));
    };
  };

  for (const [speed, w] of [
    [2.5, 600],
    [1.5, W],
  ] as const) {
    test(`the light strobe behind text moving ${speed}px a frame (antialiased) is a flash: a step toward the darker level is not motion because ink is beside it`, () => {
      // Under the range of the two source pixels, a blended pixel's step toward the darker level
      // lay inside [ink, background] and was explained: residual 1,553 at 2.5px, 1,631 at 1.5px.
      // Against the predictions, 24,451 and 24,165. 600px wide at 2.5px a frame: through 400px
      // only content left of x = 250 has been in view a second, and it reads 20,001.
      const { general } = judged(
        90,
        subpixel(speed, (k) => (phase(k, 4) ? 232 : 218)),
        w,
      );
      assert.equal(general!.classification, "flash");
      assert.equal(general!.reason, "residual");
    });
  }

  test("the smooth 4 Hz pulse behind text moving 2.5px a frame (antialiased) is a flash", () => {
    // Residual 1,555 under the range of the source pixels, 27,468 against the predictions.
    const { general } = judged(
      90,
      subpixel(2.5, (k) => Math.round(208 + 16 * Math.sin((2 * Math.PI * 4 * frameTimeMs(k)) / 1000))),
    );
    assert.equal(general!.classification, "flash");
    assert.equal(general!.reason, "residual");
  });

  test("a light strobe at 6 Hz behind text that steps 4px every 15 frames is a flash: the steps it took in place stay with the place", () => {
    // Each step moves the content and its history with it, trimmed to the step that showed it:
    // the in-place transitions before it were lost, and the residual was 0. The place keeps
    // them: 27,232.
    const toggles = (k: number) => k > 0 && phase(k, 6) !== phase(k - 1, 6);
    const moves: number[] = [];
    for (let k = 15; k < 120; k += 15) {
      let m = k;
      while (toggles(m)) m++;
      moves.push(m);
    }
    const { general } = judged(120, (k) => {
      const o = 4 * moves.filter((m) => m <= k).length;
      return (x, y) => (ink[y * TW + ((x + o) % TW)] ? grey(0x60) : phase(k, 6) ? grey(232) : grey(218));
    });
    assert.equal(general!.classification, "flash");
    assert.equal(general!.reason, "residual");
  });

  test("a stationary strobe box that text scrolls through at 4px a frame is a flash: the place flashes, not the text", () => {
    // 160x200 (32,000 px²) of background 149 ↔ 203 at 4 Hz behind sparse text. Each strobe step
    // was taken by the text in front of it and carried out of the box, and no text is in the box
    // long enough to hold seven: residual 1,874. The place now keeps them: 23,920. With two and a
    // half times the ink (one mark per 240 px²) each pixel of the box is behind ink at about one
    // step in five, seven of a second's eight hold at about half of them, and it reads 16,522:
    // per pixel, what the ink hides did not flash there.
    const w = 700;
    const h = 260;
    const tw = 4000;
    const sparse = texture(7, tw, h, 600);
    const { general } = judged(
      120,
      (k) => (x, y) => {
        if (sparse[y * tw + ((x + 4 * k) % tw)]) return grey(140);
        return x >= 270 && x < 430 && y >= 30 && y < 230 && phase(k, 4) ? grey(203) : grey(149);
      },
      w,
      h,
    );
    assert.equal(general!.classification, "flash");
    assert.equal(general!.reason, "residual");
  });

  test("a textured panel shaking around a 20px square at 16 jumps a second is a flash: a quarter turn is a reversal", () => {
    // Each jump turns 90° from the last, and the gate counted only turns past it: motion,
    // residual 0. Counted, the shake is untrusted throughout: 81,116.
    const th = 600;
    const tall = texture(7, TW, th);
    const path = [
      [0, 0],
      [20, 0],
      [20, 20],
      [0, 20],
    ] as const;
    const { general } = judged(90, (k) => {
      const [ox, oy] = path[Math.floor(((frameTimeMs(k) + 1000 / 120) * 16) / 1000) % 4]!;
      return (x, y) => (tall[(y + oy + 50) * TW + x + ox + 50] ? BLACK : WHITE);
    });
    assert.equal(general!.classification, "flash");
  });

  test("a box whose fill toggles while it drifts slowly is a flash", () => {
    const { general } = judged(90, (k) => (x, y) => {
      const x0 = 20 + Math.floor((k * 4) / 60);
      return x >= x0 && x < x0 + 300 && y >= 0 && y < 300 && phase(k, 4) ? WHITE : BLACK;
    });
    assert.equal(general!.classification, "flash");
  });

  test("stripes inverting at 10 Hz are a flash, though every frame is the last one moved by a stripe", () => {
    const { general } = judged(
      60,
      (k) => (x) => ((Math.floor(x / 40) + (phase(k, 10) ? 1 : 0)) % 2 === 0 ? BLACK : WHITE),
    );
    assert.equal(general!.classification, "flash");
  });

  test("stripes scrolling by half their period each frame are a flash: counterphase has no direction", () => {
    // 20px stripes, a 40px period, 20px a frame: each frame is the last one inverted.
    const { general } = judged(60, (k) => (x) => (Math.floor((x + 20 * k) / 20) % 2 === 0 ? BLACK : WHITE));
    assert.equal(general!.classification, "flash");
  });

  test("8px stripes inverting at 10 Hz are a flash: a half-period shift matches both ways and has no direction", () => {
    const { general } = judged(
      60,
      (k) => (x) => ((Math.floor(x / 8) + (phase(k, 10) ? 1 : 0)) % 2 === 0 ? BLACK : WHITE),
    );
    assert.equal(general!.classification, "flash");
  });

  test("a textured panel teleporting 40px back and forth at 5 Hz while it drifts is a flash", () => {
    const { general } = judged(90, (k) => (x, y) => at(x + (phase(k, 5) ? 40 : 0) + k, y));
    assert.equal(general!.classification, "flash");
  });

  test("a textured panel shaking 20px back and forth at 5 Hz is a flash: each jump is short, but it reverses", () => {
    const { general } = judged(90, (k) => (x, y) => at(x + (phase(k, 5) ? 20 : 0), y));
    assert.equal(general!.classification, "flash");
  });

  test("texture moving 6px a frame that inverts at 4 Hz is a flash: the motion is real, so is the step", () => {
    const { general } = judged(90, (k) => (x, y) => {
      const c = at(x + 6 * k, y);
      return phase(k, 4) ? (c === BLACK ? WHITE : BLACK) : c;
    });
    assert.equal(general!.classification, "flash");
  });

  test("a strobe beside scrolling text is a flash: motion elsewhere excuses nothing", () => {
    const { general } = judged(90, (k) => (x, y) => {
      if (x >= 200 && y >= 100 && y < 260) return phase(k, 4) ? WHITE : BLACK;
      return at(x + 5 * k, y);
    });
    assert.equal(general!.classification, "flash");
  });

  test("runs are re-counted whole, from a second and a lead before each, merged where they meet", () => {
    const box = { x: 0, y: 0, width: 1, height: 1 };
    const run = (from: number, to: number) => ({ from, to, area: 30_000, field: box, region: box, windows: [] });
    const times = Array.from({ length: 600 }, (_, k) => frameTimeMs(k));
    const spans = runSpans(times, [run(200, 260), run(80, 120), run(300, 590)]);
    assert.deepEqual(
      spans.map((s) => [s.k0, s.k1, s.runs.length]),
      [
        [5, 120, 1],
        [125, 590, 2],
      ],
    );
  });
});
