/**
 * array / tree: generators, frame read-back, and the validator's phrasing.
 */
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { checkAnimation, explain } from "./check.ts";
import { compileScene, generateArrayOps } from "./compile/index.ts";
import { EXAMPLES } from "./schema-sheet.ts";
import { sampleFrame, timelineDuration, worldPos } from "./timeline.ts";
import { SCENE_FORMAT, type ArrayScene, type Scene, type TreeScene } from "./types.ts";
import { formatDiagnostics, validateScene } from "./validate.ts";

const errorsOf = (scene: Scene) => checkAnimation(compileScene(scene), scene).filter((d) => d.severity === "error");

describe("array", () => {
  it("binary search narrates lo / hi / mid, ends on the target, and the pointers sit where the meta says", () => {
    const tl = compileScene(EXAMPLES.array);
    assert.equal(tl.meta?.found, 5);
    assert.deepEqual(errorsOf(EXAMPLES.array), []);
    const text = explain(tl);
    assert.match(text, /mid = \(0 \+ 9\) \/ 2 = 4/);
    assert.match(text, /a\[4\] = 16 < 23: the answer is to the right, lo = 5/);
    assert.match(text, /found 23 at index 5/);
    const frame = sampleFrame(tl, timelineDuration(tl));
    assert.equal(frame.get("cell-5-rect")!.fill, "#22c55e");
    // Pointer arrows end over their indices; each pointer has its own lane.
    const slotX = tl.meta?.slotX as number[];
    assert.equal(worldPos(frame, "ptr-lo")[0], slotX[5]);
    assert.equal(worldPos(frame, "ptr-hi")[0], slotX[6]);
    assert.notEqual(worldPos(frame, "ptr-lo")[1], worldPos(frame, "ptr-hi")[1]);
  });

  it("a target that is absent ends with 'not in the array' and no found index; the check catches a wrong found", () => {
    const s: ArrayScene = { ...EXAMPLES.array, target: 24 };
    const tl = compileScene(s);
    assert.equal(tl.meta?.found, undefined);
    assert.match(explain(tl), /24 is not in the array/);
    assert.deepEqual(errorsOf(s), []);
    const wrong: ArrayScene = { format: SCENE_FORMAT, kind: "array", values: [1, 2, 3], target: 3, ops: [{ found: 0 }] };
    const diags = checkAnimation(compileScene(wrong), wrong);
    assert.ok(diags.some((d) => /holds 1, not the target 3/.test(d.message)), formatDiagnostics(diags));
  });

  it("two-pointer-sum and sliding-window generate the expected walks", () => {
    const two = generateArrayOps({ format: SCENE_FORMAT, kind: "array", values: [1, 2, 4, 6, 8, 9, 11], algorithm: "two-pointer-sum", target: 10 });
    assert.deepEqual(two[two.length - 1], { mark: [0, 5], caption: "1 + 9 = 10: found the pair" });
    const win: ArrayScene = { format: SCENE_FORMAT, kind: "array", values: [4, 2, 1, 7, 8, 1, 2, 8, 1, 0], algorithm: "sliding-window", window: 3 };
    const tl = compileScene(win);
    assert.match(explain(tl), /Best window: indices 2–4, sum 16/);
    // The `window: null, ms: 0` beat folds into the mark: no blank step.
    assert.ok((tl.steps ?? []).every((s) => s.caption || s.label), "no uncaptioned, unlabelled step");
    assert.deepEqual(errorsOf(win), []);
    const frame = sampleFrame(tl, timelineDuration(tl));
    assert.equal(frame.get("window")!.opacity, 0);
    for (const i of [2, 3, 4]) assert.equal(frame.get(`cell-${i}-rect`)!.fill, "#22c55e");
  });

  it("explicit ops: swaps are read back by position; validator names the mistakes", () => {
    const s: ArrayScene = {
      format: SCENE_FORMAT,
      kind: "array",
      values: ["a", "b", "c"],
      ops: [{ pointers: { i: 0, j: 2 } }, { swap: [0, 2], caption: "reverse the ends" }, { window: [0, 2] }, { mark: [0, 1, 2] }],
    };
    const tl = compileScene(s);
    assert.deepEqual(tl.meta?.finalOrder, ["c", "b", "a"]);
    assert.deepEqual(errorsOf(s), []);
    const diags = validateScene({ format: SCENE_FORMAT, kind: "array", values: [3, 1, 2], algorithm: "binary-search", target: 2 });
    assert.ok(diags.some((d) => d.path === "values" && /not in ascending order/.test(d.message)), formatDiagnostics(diags));
    const bad = validateScene({ format: SCENE_FORMAT, kind: "array", values: [1, 2], ops: [{ pointers: {} }, { window: [1, 0] }, { found: 5 }] });
    assert.ok(bad.some((d) => d.path === "ops[0].pointers" && /empty/.test(d.message)));
    assert.ok(bad.some((d) => d.path === "ops[1].window" && /ends before it starts/.test(d.message)));
    assert.ok(bad.some((d) => d.path === "ops[2].found" && /out of range/.test(d.message)));
    const none = validateScene({ format: SCENE_FORMAT, kind: "array", values: [1, 2] });
    assert.ok(none.some((d) => d.path === "algorithm"));
  });
});

describe("tree", () => {
  it("insert / search / delete / traverse: the final frame is a BST drawing that matches the simulation", () => {
    const s: TreeScene = EXAMPLES.tree;
    const tl = compileScene(s);
    assert.deepEqual(tl.meta?.finalInorder, [1, 4, 6, 8, 10, 14]);
    assert.deepEqual(tl.meta?.deletions, ["two-children"]);
    assert.deepEqual(tl.meta?.searches, [{ value: 6, found: true }]);
    assert.deepEqual(tl.meta?.traversals, [[1, 4, 6, 8, 10, 14]]);
    assert.deepEqual(errorsOf(s), []);
    const frame = sampleFrame(tl, timelineDuration(tl));
    assert.equal(frame.get("v-3")!.opacity, 0, "deleted value is gone");
    // 4 was promoted into 3's place: depth 1, left child of 8.
    const depths = tl.meta?.finalDepths as Record<string, number>;
    assert.equal(depths["4"], 1);
    assert.ok(frame.get("v-4")!.pos[1] < frame.get("v-6")!.pos[1]);
    const text = explain(tl);
    assert.match(text, /Insert 14: start at the root 8\. 14 > 8: go right/);
    assert.match(text, /Found 6 after 3 comparisons/);
    assert.match(text, /inorder: 1, 4, 6, 8, 10, 14/);
    // Edges are drawn under the circles.
    const firstCircle = tl.nodes.findIndex((n) => n.id.startsWith("v-"));
    const lastEdge = tl.nodes.map((n) => n.id).reduce((acc, id, i) => (id.startsWith("edge-") ? i : acc), -1);
    assert.ok(lastEdge < firstCircle, "every edge node precedes the first value node");
  });

  it("leaf and one-child deletes, a missing search, and the three other traversals", () => {
    const s: TreeScene = {
      format: SCENE_FORMAT,
      kind: "tree",
      initial: [5, 2, 8, 1, 9],
      ops: [{ delete: 1 }, { delete: 8, caption: "8 has only 9 below it: 9 moves up" }, { search: 7 }, { traverse: "preorder" }, { traverse: "postorder" }, { traverse: "levelorder" }],
    };
    const tl = compileScene(s);
    assert.deepEqual(tl.meta?.deletions, ["leaf", "one-child"]);
    assert.deepEqual(tl.meta?.finalInorder, [2, 5, 9]);
    assert.deepEqual(tl.meta?.traversals, [[5, 2, 9], [2, 9, 5], [5, 2, 9]]);
    assert.deepEqual(tl.meta?.searches, [{ value: 7, found: false }]);
    assert.match(explain(tl), /9 has no left child: 7 is not in the tree/);
    assert.deepEqual(errorsOf(s), []);
    const frame = sampleFrame(tl, timelineDuration(tl));
    assert.equal((tl.meta?.finalDepths as Record<string, number>)["9"], 1);
    assert.equal(frame.get("v-9")!.pos[1], frame.get("v-2")!.pos[1], "9 moved up to 2's level");
  });

  it("validator warns about a duplicate insert and a delete of an absent value, errors on a bad traversal name", () => {
    const diags = validateScene({ format: SCENE_FORMAT, kind: "tree", initial: [1, 2], ops: [{ insert: 2 }, { delete: 7 }, { traverse: "in-order" }] });
    assert.ok(diags.some((d) => d.severity === "warn" && d.path === "ops[0].insert"), formatDiagnostics(diags));
    assert.ok(diags.some((d) => d.severity === "warn" && d.path === "ops[1].delete"));
    assert.ok(diags.some((d) => d.severity === "error" && d.path === "ops[2].traverse" && /did you mean "inorder"/.test(d.hint ?? "")));
  });
});
