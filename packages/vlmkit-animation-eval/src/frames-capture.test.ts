import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Page } from "playwright";
import { test } from "vite-plus/test";
import { parseFramesManifest } from "@mizchi/vlmkit-judge/frames.ts";
import { captureStable, defaultTimelineInstants, frameWriter } from "./frames-capture.ts";

/** A page whose screenshots are `shots`, in order (the last one repeats). */
const pageShooting = (shots: string[]) => {
  let taken = 0;
  return {
    taken: () => taken,
    page: {
      screenshot: async () => Buffer.from(shots[Math.min(taken++, shots.length - 1)]!),
    } as unknown as Page,
  };
};

test("captureStable: two equal shots in a row are the frame", async () => {
  const stub = pageShooting(["a", "a"]);
  assert.deepEqual(await captureStable(stub.page), { png: Buffer.from("a"), stable: true });
  assert.equal(stub.taken(), 2);
});

test("captureStable: a first shot taken before the seek landed is discarded", async () => {
  const stub = pageShooting(["early", "b", "b"]);
  assert.deepEqual(await captureStable(stub.page), { png: Buffer.from("b"), stable: true });
  assert.equal(stub.taken(), 3);
});

test("captureStable: three shots that never agree are written as unstable, the last one kept", async () => {
  const stub = pageShooting(["a", "b", "c", "d"]);
  assert.deepEqual(await captureStable(stub.page), { png: Buffer.from("c"), stable: false });
  assert.equal(stub.taken(), 3, "at most three");
});

test("captureStable: with a clock, `at` is when the returned picture was first on screen", async () => {
  const readings = [10, 20, 30];
  const agreeing = pageShooting(["early", "b", "b"]);
  let i = 0;
  const clock = async () => readings[i++]!;
  assert.equal((await captureStable(agreeing.page, { clock })).at, 20, "the first of the agreeing pair");
  i = 0;
  const moving = pageShooting(["a", "b", "c"]);
  assert.deepEqual(await captureStable(moving.page, { clock }), { png: Buffer.from("c"), stable: false, at: 30 });
});

test("frameWriter: numbered files, a manifest, and a previous run's frames cleared first", async () => {
  const dir = await mkdtemp(join(tmpdir(), "vlmkit-frame-writer-"));
  // A longer earlier run, and a file of the user's that is not a frame.
  await writeFile(join(dir, "0007-t000700.png"), "stale");
  await writeFile(join(dir, "frames.json"), "{}");
  await writeFile(join(dir, "notes.png"), "mine");
  const source = {
    tool: "test",
    url: "file:///x.html",
    viewport: { width: 4, height: 4 },
    deviceScaleFactor: 1,
    clock: "held" as const,
  };
  const writer = await frameWriter(dir, source);
  await writer.add(Buffer.from("f0"), { atMs: 0, stable: true });
  await writer.add(Buffer.from("f1"), { atMs: 1000 / 60, stable: false, label: "rest" });
  const written = await writer.finish();
  assert.deepEqual((await readdir(dir)).sort(), ["0000-t000000.png", "0001-t000017.png", "frames.json", "notes.png"]);
  assert.equal(written.count, 2);
  assert.equal(written.unstable, 1);
  assert.deepEqual(written.files, [join(dir, "0000-t000000.png"), join(dir, "0001-t000017.png")]);
  const manifest = parseFramesManifest(await readFile(written.manifest, "utf8"));
  assert.deepEqual(manifest.source, source);
  assert.deepEqual(manifest.frames, [
    { n: 0, file: "0000-t000000.png", atMs: 0, stable: true },
    { n: 1, file: "0001-t000017.png", atMs: 1000 / 60, stable: false, label: "rest" },
  ]);
});

test("defaultTimelineInstants: each finite animation's start, middle and end, plus the coarse grid", () => {
  assert.deepEqual(defaultTimelineInstants([]), [0, 250, 500, 1000, 2000]);
  assert.deepEqual(
    defaultTimelineInstants([{ startMs: 100, durationMs: 300, iterations: 1 }]),
    [0, 100, 250, 399, 500, 1000, 2000],
  );
});
