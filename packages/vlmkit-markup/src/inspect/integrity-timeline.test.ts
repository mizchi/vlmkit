/**
 * `check integrity --timeline` on `fixtures/integrity-timeline/`: one opaque card and one
 * label, the card's motion the only difference between pages. Ground truth is the keyframes —
 * `held.html` parks the card over the label from 20% to 80% of 1s, `transient.html` crosses it
 * between 45% and 55%, `clean.html` moves below it, `at-rest.html` ends on it, and
 * `script.html` does the held motion from a rAF loop instead of CSS. Two more for contrast:
 * `fade-in.html` (text fading in — the animation, not a defect) and `background-late.html`
 * (white text at full opacity whose dark background arrives at 480-800ms).
 */
import { test } from "vitest";
import assert from "node:assert/strict";
import { join } from "node:path";
import { runIntegrityCheck } from "./integrity-check.ts";

const fixture = (name: string) => join(import.meta.dirname, "../../../../fixtures/integrity-timeline", `${name}.html`);
const run = (name: string, at?: number[]) =>
  runIntegrityCheck({ source: fixture(name), viewports: [{ width: 1280, height: 800 }], timeline: at ? { at } : {} });

test("a card held over the label mid-motion is a held finding at its rule's severity", { timeout: 120_000 }, async () => {
  const report = await run("held");
  assert.equal(report.verdict, "defects");
  const f = report.findings.find((x) => x.kind === "occluded-text");
  assert.ok(f, JSON.stringify(report.findings.map((x) => x.kind)));
  assert.equal(f!.severity, "fail");
  assert.match(f!.message, /^While the page moves \(held 250-500ms/);
  assert.deepEqual((f!.evidence?.timeline as { run: unknown }).run, { fromMs: 250, toMs: 500, samples: 2 });
  assert.equal(report.timeline?.held, 1);
});

test("a card crossing the label for a moment is transient and leaves the verdict clean", { timeout: 120_000 }, async () => {
  const report = await run("transient");
  assert.equal(report.verdict, "clean");
  assert.deepEqual(report.timeline?.transient.map((r) => [r.finding.kind, r.seenAtMs]), [["occluded-text", [500]]]);
});

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

test("script-driven motion: the wall-clock sweep's mid-motion reading is re-tiered by the held timeline", { timeout: 120_000 }, async () => {
  const report = await run("script");
  const f = report.findings.find((x) => x.kind === "occluded-text");
  assert.ok(f);
  assert.match(f!.message, /While the page moves .*absent once it stops; the settled run measured it mid-motion/);
});

test("--timeline-at names the instants; one sample inside the hold is only a glimpse", { timeout: 120_000 }, async () => {
  const report = await run("held", [0, 400, 1000]);
  assert.deepEqual(report.timeline?.instants, [{ viewport: 1280, atMs: [0, 400, 1000] }]);
  assert.equal(report.verdict, "clean", "held for 200-800ms, but only one named instant falls inside");
  assert.deepEqual(report.timeline?.transient.map((r) => r.seenAtMs), [[400]]);
});

test("without --timeline the report has no timeline and a mid-motion defect is invisible", { timeout: 120_000 }, async () => {
  const report = await runIntegrityCheck({ source: fixture("held"), viewports: [{ width: 1280, height: 800 }] });
  assert.equal(report.timeline, undefined);
  assert.equal(report.verdict, "clean");
});

test("text fading in is not low contrast: mid-motion contrast is judged at full opacity only", { timeout: 120_000 }, async () => {
  // Before the filter, six of the eight dogfood-animation pages flipped to `defects` on their
  // entrance fades alone.
  const report = await run("fade-in");
  assert.equal(report.verdict, "clean");
  assert.deepEqual(report.timeline?.transient.map((r) => r.finding.kind), []);
});

test("white text at full opacity on a background that has not arrived yet is held", { timeout: 120_000 }, async () => {
  const report = await run("background-late");
  const f = report.findings.find((x) => x.kind === "invisible-text");
  assert.ok(f, JSON.stringify(report.findings.map((x) => x.kind)));
  assert.match(f!.message, /^While the page moves \(held 0-/);
});

test("instants that end mid-motion still judge 'absent once it stops' against the page after its motion", { timeout: 120_000 }, async () => {
  // The last named instant is 500ms, while the card is still over the label. Taking that as
  // "at rest" dropped the defect: rest is a separate instant past every animation's end.
  const report = await run("held", [0, 250, 500]);
  assert.equal(report.verdict, "defects");
  assert.match(report.findings.find((x) => x.kind === "occluded-text")!.message, /held 250-500ms/);
});
