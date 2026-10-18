import assert from "node:assert/strict";
import { describe, it } from "vite-plus/test";
import { PNG } from "pngjs";
import { checkMotionFrames } from "./motion-check.ts";
import type { JevAsk } from "./locate.ts";

const png = (width: number, height: number) => new Uint8Array(PNG.sync.write(new PNG({ width, height })));

/**
 * Plays a target moving across a 1280x800 frame: `x(atMs)` is its left edge in px (null = not
 * shown), and `forbid(atMs)` the noul of every forbidden statement. Frames are told apart by a
 * `atMs` the caller keys by frame order.
 */
function play(x: (atMs: number) => number | null, forbid: (atMs: number) => number, times: number[]) {
  let n = 0;
  const sent: string[][] = [];
  const ask: JevAsk = async (req) => {
    const atMs = times[n++]!;
    sent.push(Object.keys(req.questions));
    const left = x(atMs);
    const answers: Record<string, unknown> = {};
    for (const k of Object.keys(req.questions)) {
      if (k.startsWith("p")) answers[k] = { type: "noul", noul: left === null ? 0.02 : 0.97 };
      if (k.startsWith("b"))
        answers[k] = {
          type: "box",
          box: { left: (left ?? 0) / 1280, right: ((left ?? 0) + 48) / 1280, top: 0.2, bottom: 0.26 },
          confidence: 0.5,
        };
      if (k.startsWith("f")) answers[k] = { type: "noul", noul: forbid(atMs) };
    }
    return {
      model: "fake-jev",
      answers,
      usage: { input_tokens: 3100, output_tokens: 3 },
      latencyMs: 1,
      costUsd: 0.00013,
    } as never;
  };
  return { ask, sent };
}

const TIMES = [...Array.from({ length: 10 }, (_, i) => i * 100), 999, 1300];
const frames = TIMES.map((atMs) => ({ atMs, png: png(1280, 800) }));
const linear = (t: number) => 40 + 0.48 * Math.min(t, 1000);

describe("checkMotionFrames", () => {
  it("asks every target and statement of a frame in one request, and passes an intact motion", async () => {
    const { ask, sent } = play(linear, () => 0.05, TIMES);
    const r = await checkMotionFrames(frames, {
      targets: ["the blue square"],
      forbid: ["text overlapping other text"],
      startMs: 0,
      endMs: 1000,
      expectEasing: "linear",
      ask,
      concurrency: 1,
    });
    assert.equal(sent.length, TIMES.length);
    assert.deepEqual(sent[0], ["p0", "b0", "f0"]);
    assert.equal(r.passed, true, JSON.stringify(r.targets[0]!.findings));
    assert.equal("best" in r.targets[0]!.easing && r.targets[0]!.easing.best, "linear");
    assert.ok(Math.abs(r.costUsd - 0.00013 * TIMES.length) < 1e-12);
  });

  it("fails a snap-back and a statement seen at rest; only warns one seen mid-motion", async () => {
    const snap = (t: number) => (t > 1000 ? 40 : linear(t));
    const { ask } = play(snap, (t) => (t === 500 ? 0.9 : t > 1000 ? 0.8 : 0.05), TIMES);
    const r = await checkMotionFrames(frames, {
      targets: ["the blue square"],
      forbid: ["text overlapping other text", "a loading spinner"],
      startMs: 0,
      endMs: 1000,
      ask,
      concurrency: 1,
    });
    assert.equal(r.passed, false);
    assert.deepEqual(
      r.targets[0]!.findings.map((f) => f.rule),
      ["snap-back"],
    );
    assert.equal(r.forbidden[0]!.severity, "fail");
    assert.deepEqual(
      r.forbidden[0]!.frames.map((f) => f.atMs),
      [500, 1300],
    );
  });

  it("warns, without failing, a statement seen only mid-motion", async () => {
    const { ask } = play(linear, (t) => (t === 500 ? 0.9 : 0.05), TIMES);
    const r = await checkMotionFrames(frames, {
      targets: [],
      forbid: ["text overlapping other text"],
      startMs: 0,
      endMs: 1000,
      ask,
      concurrency: 1,
    });
    assert.equal(r.passed, true);
    assert.equal(r.forbidden[0]!.severity, "warn");
  });

  it("refuses nothing to check", async () => {
    const { ask } = play(linear, () => 0, TIMES);
    await assert.rejects(checkMotionFrames(frames, { targets: [], startMs: 0, endMs: 1000, ask }), /nothing to check/);
  });
});
