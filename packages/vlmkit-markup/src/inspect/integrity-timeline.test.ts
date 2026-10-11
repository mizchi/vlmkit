/**
 * `check integrity --timeline` on `fixtures/integrity-timeline/`: one opaque card and one
 * label, the card's motion the only difference between pages. Ground truth is the keyframes —
 * `held.html` parks the card over the label from 20% to 80% of 1s, `transient.html` crosses it
 * between 45% and 55%, `clean.html` moves below it, `at-rest.html` ends on it, and
 * `script.html` does the held motion from a rAF loop instead of CSS. Two more for contrast:
 * `fade-in.html` (text fading in — the animation, not a defect) and `background-late.html`
 * (white text at full opacity whose dark background arrives at 480-800ms). `late-exit.html`
 * covers the label with a toast that stays still until it is dismissed at 10s.
 */
import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { runIntegrityCheck } from "./integrity-check.ts";

const fixture = (name: string) => join(import.meta.dirname, "../../../../fixtures/integrity-timeline", `${name}.html`);
const run = (name: string, at?: number[]) =>
  runIntegrityCheck({ source: fixture(name), viewports: [{ width: 1280, height: 800 }], timeline: at ? { at } : {} });

test(
  "a card held over the label mid-motion is a held finding at its rule's severity",
  { timeout: 120_000 },
  async () => {
    const report = await run("held");
    assert.equal(report.verdict, "defects");
    const f = report.findings.find((x) => x.kind === "occluded-text");
    assert.ok(f, JSON.stringify(report.findings.map((x) => x.kind)));
    assert.equal(f!.severity, "fail");
    assert.match(f!.message, /^While the page moves \(held 250-500ms/);
    assert.deepEqual((f!.evidence?.timeline as { run: unknown }).run, { fromMs: 250, toMs: 500, samples: 2 });
    assert.equal(report.timeline?.held, 1);
  },
);

test(
  "a card crossing the label for a moment is transient and leaves the verdict clean",
  { timeout: 120_000 },
  async () => {
    const report = await run("transient");
    assert.equal(report.verdict, "clean");
    assert.deepEqual(
      report.timeline?.transient.map((r) => [r.finding.kind, r.seenAtMs]),
      [["occluded-text", [500]]],
    );
  },
);

test("motion that crosses nothing reports nothing", { timeout: 120_000 }, async () => {
  const report = await run("clean");
  assert.equal(report.verdict, "clean");
  assert.equal(report.timeline?.held, 0);
  assert.deepEqual(report.timeline?.transient, []);
});

test("a defect the page ends in is the settled run's, not repeated per instant", { timeout: 120_000 }, async () => {
  const report = await run("at-rest");
  const occluded = report.findings.filter((x) => x.kind === "occluded-text");
  assert.equal(occluded.length, 1);
  assert.doesNotMatch(occluded[0]!.message, /While the page moves/);
  assert.equal(report.timeline?.held, 0);
});

test(
  "a toast that covers the label until 10s is a resting defect, not one that is gone once the page stops",
  { timeout: 120_000 },
  async () => {
    // The exit begins after every sampled instant, so it did not move the page that was sampled.
    // Taking its end as the rest instant put rest at 10301ms with the toast gone, and the
    // settled run's finding read as motion that clears.
    const report = await run("late-exit");
    const occluded = report.findings.filter((x) => x.kind === "occluded-text");
    assert.equal(occluded.length, 1, JSON.stringify(report.findings.map((x) => [x.kind, x.message])));
    assert.doesNotMatch(occluded[0]!.message, /While the page moves|absent once it stops/);
    assert.equal(occluded[0]!.severity, "fail");
  },
);

test(
  "script-driven motion: the wall-clock sweep's mid-motion reading is re-tiered by the held timeline",
  { timeout: 120_000 },
  async () => {
    const report = await run("script");
    const f = report.findings.find((x) => x.kind === "occluded-text");
    assert.ok(f);
    assert.match(f!.message, /While the page moves .*absent once it stops; the settled run measured it mid-motion/);
  },
);

test(
  "--timeline-at names the instants; one sample inside the hold is only a glimpse",
  { timeout: 120_000 },
  async () => {
    const report = await run("held", [0, 400, 1000]);
    assert.deepEqual(report.timeline?.instants, [{ viewport: 1280, atMs: [0, 400, 1000] }]);
    assert.equal(report.verdict, "clean", "held for 200-800ms, but only one named instant falls inside");
    assert.deepEqual(
      report.timeline?.transient.map((r) => r.seenAtMs),
      [[400]],
    );
  },
);

test(
  "without --timeline the report has no timeline and a mid-motion defect is invisible",
  { timeout: 120_000 },
  async () => {
    const report = await runIntegrityCheck({ source: fixture("held"), viewports: [{ width: 1280, height: 800 }] });
    assert.equal(report.timeline, undefined);
    assert.equal(report.verdict, "clean");
  },
);

test(
  "text fading in is not low contrast: mid-motion contrast is judged at full opacity only",
  { timeout: 120_000 },
  async () => {
    // Before the filter, six of the eight dogfood-animation pages flipped to `defects` on their
    // entrance fades alone.
    const report = await run("fade-in");
    assert.equal(report.verdict, "clean");
    assert.deepEqual(
      report.timeline?.transient.map((r) => r.finding.kind),
      [],
    );
  },
);

test("white text at full opacity on a background that has not arrived yet is held", { timeout: 120_000 }, async () => {
  const report = await run("background-late");
  const f = report.findings.find((x) => x.kind === "invisible-text");
  assert.ok(f, JSON.stringify(report.findings.map((x) => x.kind)));
  assert.match(f!.message, /^While the page moves \(held 0-/);
});

test(
  "instants that end mid-motion still judge 'absent once it stops' against the page after its motion",
  { timeout: 120_000 },
  async () => {
    // The last named instant is 500ms, while the card is still over the label. Taking that as
    // "at rest" dropped the defect: rest is a separate instant past every animation's end.
    const report = await run("held", [0, 250, 500]);
    assert.equal(report.verdict, "defects");
    assert.match(report.findings.find((x) => x.kind === "occluded-text")!.message, /held 250-500ms/);
  },
);

test("--frames writes the page at each instant judged and at rest, per width", { timeout: 120_000 }, async () => {
  const { mkdtemp, readFile } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { PNG } = await import("pngjs");
  const { parseFramesManifest } = await import("@mizchi/vlmkit-judge/frames.ts");
  const dir = await mkdtemp(join(tmpdir(), "vlmkit-tl-frames-"));
  const report = await runIntegrityCheck({
    source: fixture("held"),
    viewports: [{ width: 1280, height: 800 }],
    timeline: { at: [0, 250], frames: dir },
  });
  const [written] = report.timeline?.frames ?? [];
  assert.equal(written?.viewport, 1280);
  assert.equal(written?.count, 3);
  const manifest = parseFramesManifest(await readFile(join(dir, "1280", "frames.json"), "utf8"));
  assert.equal(manifest.source.tool, "check integrity --timeline");
  // Rest is past 2s and past the card's 1s animation: 2001.
  assert.deepEqual(
    manifest.frames.map((f) => [f.file, f.atMs, f.label ?? null, f.stable]),
    [
      ["0000-t000000.png", 0, null, true],
      ["0001-t000250.png", 250, null, true],
      ["0002-t002001.png", 2001, "rest", true],
    ],
  );
  // The card (220px wide from x=24, y 40-120) at its keyframes: 0, then 330px along, then 720px.
  const blueAt = async (file: string, x: number) => {
    const png = PNG.sync.read(await readFile(join(dir, "1280", file)));
    const i = (100 * png.width + x) * 4;
    return png.data[i]! < 80 && png.data[i + 2]! > 150;
  };
  assert.deepEqual(
    await Promise.all(["0000-t000000.png", "0001-t000250.png", "0002-t002001.png"].map((f) => blueAt(f, 100))),
    [true, false, false],
  );
  assert.equal(await blueAt("0001-t000250.png", 400), true, "over the label at 250ms: what was judged held");
  assert.equal(await blueAt("0002-t002001.png", 800), true);
});
