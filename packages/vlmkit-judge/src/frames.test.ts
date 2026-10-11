import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import {
  FRAMES_FORMAT,
  frameFileName,
  frameTimeMs,
  parseFramesManifest,
  parseInstants,
  playbackDelays,
  thinEvenly,
} from "./frames.ts";
import { timelineInstants } from "./persistence.ts";

test("frameFileName: position first and zero-padded, so a glob sorts in sequence order", () => {
  assert.equal(frameFileName(0, 0), "0000-t000000.png");
  assert.equal(frameFileName(6, 100), "0006-t000100.png");
  assert.equal(frameFileName(1, frameTimeMs(1)), "0001-t000017.png", "the name rounds; frames.json keeps 16.67");
  const names = [10, 2, 1].map((n) => frameFileName(n, n * 50));
  assert.deepEqual([...names].sort(), [frameFileName(1, 50), frameFileName(2, 100), frameFileName(10, 500)]);
});

test("parseInstants: bare numbers are ms, and every unit lands on the same instant", () => {
  assert.deepEqual(parseInstants("0,150,300", "--at"), [0, 150, 300]);
  assert.deepEqual(parseInstants("1500ms", "--at"), [1500]);
  assert.deepEqual(parseInstants("1.5s", "--at"), [1500], "not parseInt's 1");
  assert.deepEqual(parseInstants("00:01.500", "--at"), [1500]);
  assert.deepEqual(parseInstants("1:00:01.5", "--at"), [3_601_500]);
  assert.deepEqual(parseInstants("6f", "--at"), [100]);
  assert.deepEqual(parseInstants("1f", "--at"), [1000 / 60], "a fractional instant is kept");
  assert.deepEqual(parseInstants("150.5", "--at"), [150.5]);
});

test("parseInstants: sorted and deduplicated across forms", () => {
  assert.deepEqual(parseInstants("300, 0.15s,150,6f,0", "--at"), [0, 100, 150, 300]);
  assert.deepEqual(parseInstants("", "--at"), []);
});

test("parseInstants: a range is start + i * step, end included when a step lands on it", () => {
  assert.deepEqual(parseInstants("0..1s/250ms", "--at"), [0, 250, 500, 750, 1000]);
  assert.deepEqual(parseInstants("0..1s/300ms", "--at"), [0, 300, 600, 900]);
  assert.deepEqual(parseInstants("0..0.3s/0.1s", "--at"), [0, 100, 200, 300]);
  assert.deepEqual(parseInstants("100..100/10", "--at"), [100]);
});

test("parseInstants: a range in frames is computed in frames, so each value is exactly frame n", () => {
  const got = parseInstants("0f..60f/1f", "--at");
  assert.equal(got.length, 61);
  got.forEach((ms, n) => assert.equal(ms, frameTimeMs(n), `frame ${n}`));
  // Summing the step drifts: the 6th sum of 1000 / 60 is 100.00000000000001, above the boundary
  // the held clock compares against. Computed, it is exactly 100.
  assert.equal(got[6], 100);
});

test("parseInstants: a range stepped in frames from a bare start is computed in frames", () => {
  // `0` is frame 0, so `0..1s/5f` is frames 0, 5, 10 … and not 0 + i * 83.333…, whose 5th value
  // (416.66666666666663) sits below frame 25 — the held clock would run 24 frames for it.
  parseInstants("0..1s/5f", "--at").forEach((ms, i) => assert.equal(ms, frameTimeMs(5 * i), `value ${i}`));
  assert.equal(parseInstants("0..10f/1f,5f,10f", "--at").length, 11, "the same frame written two ways is one instant");
  assert.equal(parseInstants("0..1s/1f", "--at")[15], 250);
});

test("parseInstants: decimal seconds land on the whole ms they name", () => {
  // 16.15 * 1000 is 16149.999999999998: before frame 969, and before a timer due at 16150.
  assert.deepEqual(parseInstants("16.15s", "--at"), [16150]);
  assert.deepEqual(parseInstants("00:16.150", "--at"), [16150]);
  assert.deepEqual(parseInstants("16150,16.15s,00:16.150", "--at"), [16150]);
  assert.deepEqual(parseInstants("1.001s,32.05s", "--at"), [1001, 32050]);
  for (let ms = 0; ms <= 60_000; ms += 50) {
    assert.deepEqual(parseInstants(`${ms / 1000}s`, "--at"), [ms], `${ms / 1000}s`);
  }
});

test("parseInstants: a step too small to move the value is refused, not looped on", () => {
  assert.throws(() => parseInstants("1000000..1000001/0.0000000000000000001", "--at"), /zero step/);
  assert.throws(() => parseInstants("1000000..1000001/0.000001", "--at"), /more than 1000 instants/);
});

test("parseInstants: refuses what is not a time, naming the flag", () => {
  for (const bad of ["abc", "-100", "1.5f", "00:61", "1:60:00", "10px", "1..2", "5..1/1", "0..1s/0"]) {
    assert.throws(() => parseInstants(bad, "--timeline-at"), /--timeline-at/, bad);
  }
  assert.throws(() => parseInstants("1..2", "--at"), /needs a step/);
});

test("parseInstants: a range past the cap is refused, not truncated", () => {
  assert.throws(() => parseInstants("0..10s/1ms", "--at"), /more than 1000 instants/);
  assert.equal(parseInstants("0..10s/1ms", "--at", { max: 20_000 }).length, 10_001, "a caller can raise it");
});

test("thinEvenly: keeps both ends; returns everything when under the cap", () => {
  assert.deepEqual(thinEvenly([1, 2, 3], 5), [1, 2, 3]);
  assert.deepEqual(thinEvenly([0, 1, 2, 3, 4, 5, 6, 7, 8], 3), [0, 4, 8]);
  assert.deepEqual(thinEvenly([0, 1, 2], 1), [0]);
});

test("thinEvenly: the same instants timelineInstants thinned inline before it was extracted", () => {
  // The formula as it was written in persistence.ts, kept here as the reference.
  const before = (instants: number[], max: number) => {
    if (instants.length <= max) return instants;
    const step = (instants.length - 1) / (max - 1);
    return [...new Set(Array.from({ length: max }, (_, i) => instants[Math.round(i * step)]!))];
  };
  for (let length = 0; length <= 60; length++) {
    for (let max = 2; max <= 15; max++) {
      const values = Array.from({ length }, (_, i) => i * 37);
      assert.deepEqual(thinEvenly(values, max), before(values, max), `length ${length}, max ${max}`);
    }
  }
  const many = Array.from({ length: 20 }, (_, i) => ({ startMs: i * 100, durationMs: 90, iterations: 1 }));
  const got = timelineInstants(many, { maxInstants: 12 });
  assert.ok(got.length <= 12 && got[0] === 0 && got.at(-1) === 1989, got.join(","));
});

test("playbackDelays: the real gaps, and the last frame holds for their average", () => {
  assert.deepEqual(playbackDelays([0, 150, 400]), [150, 250, 200]);
  assert.deepEqual(playbackDelays([0]), [200]);
  const sixty = playbackDelays(Array.from({ length: 61 }, (_, n) => frameTimeMs(n)));
  assert.equal(
    sixty.slice(0, -1).reduce((a, b) => a + b, 0),
    1000,
    "16.67ms frames play for a second, not 60 x 17",
  );
});

test("parseFramesManifest: reads a manifest and refuses a broken one", () => {
  const good = {
    format: FRAMES_FORMAT,
    source: {
      tool: "check animation",
      url: "file:///x.html",
      viewport: { width: 10, height: 10 },
      deviceScaleFactor: 1,
      clock: "held",
    },
    frames: [{ n: 0, file: "0000-t000000.png", atMs: 0, stable: true }],
  };
  assert.equal(parseFramesManifest(JSON.stringify(good)).frames.length, 1);
  assert.throws(() => parseFramesManifest("{"), /not a frames manifest/);
  assert.throws(() => parseFramesManifest(JSON.stringify({ ...good, format: "x" })), /expected "format"/);
  assert.throws(() => parseFramesManifest(JSON.stringify({ ...good, frames: [] })), /no frames/);
  assert.throws(
    () => parseFramesManifest(JSON.stringify({ ...good, frames: [{ n: 0, file: "a.png" }] })),
    /numeric "atMs"/,
  );
  for (const file of [
    "../a.png",
    "/etc/a.png",
    "x/../../a.png",
    "C:/a.png",
    "D:\\a.png",
    "\\\\host\\share\\a.png",
    "\\a.png",
    "x\\..\\..\\a.png",
  ]) {
    assert.throws(
      () => parseFramesManifest(JSON.stringify({ ...good, frames: [{ n: 0, file, atMs: 0, stable: true }] })),
      /outside the manifest's directory/,
      file,
    );
  }
});
