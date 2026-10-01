import { test } from "vitest";
import assert from "node:assert/strict";
import { tierByPersistence, timelineInstants, type PersistenceSample } from "./persistence.ts";

const at = (atMs: number, ...keys: string[]): PersistenceSample<string> => ({
  atMs,
  findings: keys.map((key) => ({ key, finding: `${key}@${atMs}` })),
});

test("one instant is a glimpse; two consecutive instants a state apart are a state", () => {
  const rows = tierByPersistence([at(0), at(100, "a", "b"), at(300, "b"), at(400)]);
  assert.deepEqual(rows.map((r) => [r.key, r.tier]), [["a", "transient"], ["b", "held"]]);
  const b = rows.find((r) => r.key === "b")!;
  assert.deepEqual(b.run, { fromMs: 100, toMs: 300, samples: 2 });
  assert.equal(b.finding, "b@100", "the finding as first seen");
});

test("seen at the first and last instants but not between is two glimpses, not a state", () => {
  const rows = tierByPersistence([at(0, "a"), at(100), at(200, "a")]);
  assert.equal(rows[0]!.tier, "transient");
  assert.deepEqual(rows[0]!.seenAtMs, [0, 200]);
});

test("two instants 10ms apart are still a glimpse: held needs time as well as samples", () => {
  const rows = tierByPersistence([at(250, "a"), at(260, "a"), at(500)]);
  assert.equal(rows[0]!.tier, "transient");
  assert.equal(tierByPersistence([at(250, "a"), at(260, "a")], new Set(), { minHeldMs: 0 })[0]!.tier, "held");
});

test("the longest run is the one reported", () => {
  const rows = tierByPersistence([at(0, "a"), at(1, "a"), at(2), at(3, "a"), at(4, "a"), at(5, "a")]);
  assert.deepEqual(rows[0]!.run, { fromMs: 3, toMs: 5, samples: 3 });
});

test("a defect the settled page already has is left to the settled run", () => {
  const rows = tierByPersistence([at(0, "rest", "moving"), at(100, "rest", "moving")], new Set(["rest"]));
  assert.deepEqual(rows.map((r) => r.key), ["moving"]);
});

test("minHeldSamples raises the bar", () => {
  const samples = [at(0, "a"), at(200, "a"), at(400)];
  assert.equal(tierByPersistence(samples)[0]!.tier, "held");
  assert.equal(tierByPersistence(samples, new Set(), { minHeldSamples: 3 })[0]!.tier, "transient");
});

test("a key repeated within one instant counts once", () => {
  const rows = tierByPersistence([{ atMs: 0, findings: [{ key: "a", finding: "x" }, { key: "a", finding: "y" }] }]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.run.samples, 1);
});

test("timelineInstants: each finite animation's start, middle and end, plus 0", () => {
  assert.deepEqual(timelineInstants([{ startMs: 100, durationMs: 400, iterations: 1 }]), [0, 100, 300, 499]);
});

test("timelineInstants: an infinite animation contributes one iteration; the cap and the count hold", () => {
  assert.deepEqual(timelineInstants([{ startMs: 0, durationMs: 1000, iterations: null }]), [0, 500, 999]);
  assert.deepEqual(timelineInstants([{ startMs: 6000, durationMs: 400, iterations: 1 }]), [0], "past the cap");
  const many = timelineInstants(Array.from({ length: 20 }, (_, i) => ({ startMs: i * 100, durationMs: 50, iterations: 1 })), { maxInstants: 6 });
  assert.ok(many.length <= 6);
  assert.equal(many[0], 0);
  assert.equal(many[many.length - 1], 1949, "both ends kept");
});
