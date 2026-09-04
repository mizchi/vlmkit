/**
 * stack / queue / list: contents read back from the final frame, the
 * narration of the edge cases, and the validator's phrasing.
 */
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { checkAnimation, explain } from "./check.ts";
import { compileScene } from "./compile/index.ts";
import { EXAMPLES } from "./schema-sheet.ts";
import { sampleFrame, timelineDuration } from "./timeline.ts";
import { SCENE_FORMAT, type ListScene, type QueueScene, type Scene, type StackScene } from "./types.ts";
import { formatDiagnostics, validateScene } from "./validate.ts";

const errorsOf = (scene: Scene) => checkAnimation(compileScene(scene), scene).filter((d) => d.severity === "error");

describe("stack", () => {
  it("LIFO: pops come out in reverse push order; the final frame is empty; overflow is refused and warned", () => {
    const tl = compileScene(EXAMPLES.stack);
    assert.deepEqual(tl.meta?.removed, ["[", "("]);
    assert.deepEqual(tl.meta?.finalContents, []);
    assert.deepEqual(errorsOf(EXAMPLES.stack), []);
    const frame = sampleFrame(tl, timelineDuration(tl));
    assert.ok(tl.nodes.filter((n) => n.id.startsWith("v-")).every((n) => frame.get(n.id)!.opacity < 0.5));
    const full: StackScene = { format: SCENE_FORMAT, kind: "stack", capacity: 2, initial: [1, 2], ops: [{ push: 3 }, { pop: true }, { pop: true }, { pop: true }, { pop: true }] };
    const diags = checkAnimation(compileScene(full), full);
    assert.ok(diags.some((d) => d.severity === "warn" && /refused/.test(d.message)), formatDiagnostics(diags));
    assert.deepEqual(errorsOf(full), []);
    assert.match(explain(compileScene(full)), /pop on an empty stack: nothing to remove/);
  });
});

describe("queue", () => {
  it("FIFO: dequeues come out in enqueue order and the rest shift to the front", () => {
    const q: QueueScene = EXAMPLES.queue;
    const tl = compileScene(q);
    assert.deepEqual(tl.meta?.removed, ["report.pdf", "photo.png"]);
    assert.deepEqual(tl.meta?.finalContents, ["memo.txt"]);
    assert.deepEqual(checkAnimation(tl, q).filter((d) => d.severity !== "warn" || !/never|still/.test(d.message)).filter((d) => d.severity === "error"), []);
    assert.deepEqual(checkAnimation(tl, q).filter((d) => d.severity === "warn"), [], "no no-op tracks");
    const frame = sampleFrame(tl, timelineDuration(tl));
    const slots = tl.meta?.slots as [number, number][];
    const memo = tl.nodes.find((n) => n.text === "memo.txt")!;
    assert.deepEqual(frame.get(memo.id)!.pos, slots[0], "the remaining job moved to the front slot");
    assert.match(explain(tl), /peek → photo.png: the front, left in place/);
  });

  it("validator: a stack op in a queue is named with the right verb", () => {
    const diags = validateScene({ format: SCENE_FORMAT, kind: "queue", ops: [{ push: 1 }, { dequeue: 1 }] });
    assert.ok(diags.some((d) => d.path === "ops[0].push" && /a queue uses "enqueue"/.test(d.message)), formatDiagnostics(diags));
    assert.ok(diags.some((d) => d.path === "ops[1].dequeue" && /literal true/.test(d.message)));
  });
});

describe("list", () => {
  it("insert / remove / find / reverse: the final order is read back by x with one arrow per link", () => {
    const l: ListScene = EXAMPLES.list;
    const tl = compileScene(l);
    assert.deepEqual(tl.meta?.finalOrder, [9, 5, 3, 1]);
    assert.deepEqual(tl.meta?.finds, [{ value: 9, hops: 3, found: true }]);
    assert.deepEqual(errorsOf(l), []);
    const text = explain(tl);
    assert.match(text, /Insert 5 after 3: 3 will point to 5, and 5 to 7/);
    assert.match(text, /Remove 7: 5 now points to 9/);
    assert.match(text, /9 = 9: found it after 3 hops/);
    assert.match(text, /List: 9 → 5 → 3 → 1 → ∅/);
    const frame = sampleFrame(tl, timelineDuration(tl));
    const arrows = tl.nodes.filter((n) => /^arr-\d+$/.test(n.id)).filter((n) => frame.get(n.id)!.opacity > 0.5).length;
    assert.equal(arrows, 3);
  });

  it("a find that misses and an insert after a missing value are narrated; the check warns about the miss", () => {
    const l: ListScene = { format: SCENE_FORMAT, kind: "list", initial: ["a", "b"], ops: [{ find: "z" }, { insert: { value: "c", after: "q" } }, { insert: { value: "c" } }, { remove: "a" }] };
    const tl = compileScene(l);
    assert.deepEqual(tl.meta?.finalOrder, ["b", "c"]);
    const diags = checkAnimation(tl, l);
    assert.ok(diags.some((d) => d.severity === "warn" && /find z/.test(d.message)), formatDiagnostics(diags));
    assert.deepEqual(diags.filter((d) => d.severity === "error"), []);
    assert.match(explain(tl), /Reached ∅ after 2 hops: z is not in the list/);
    assert.match(explain(tl), /q is not in the list, nothing inserted/);
    assert.match(explain(tl), /Remove a: b becomes the head/);
    const bad = validateScene({ format: SCENE_FORMAT, kind: "list", ops: [{ insert: { value: 1, at: 0, after: 2 } }, { reverse: "yes" }] });
    assert.ok(bad.some((d) => d.path === "ops[0].insert" && /not both/.test(d.message)));
    assert.ok(bad.some((d) => d.path === "ops[1].reverse"));
  });
});
