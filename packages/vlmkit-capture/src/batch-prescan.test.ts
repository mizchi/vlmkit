import { describe, it } from "vitest";
import assert from "node:assert/strict";
import type { CraterCssMutation, PaintNode } from "./crater-client.ts";
import {
  hasAnyBatchPrescanSignal,
  mutationsForPropertyRemoval,
  mutationsForSelectorBlockRemoval,
  runBatchPrescan,
} from "./batch-prescan.ts";

function tree(overrides: Partial<PaintNode> = {}): PaintNode {
  return { tag: "root", x: 0, y: 0, w: 1280, h: 900, ch: [], ...overrides };
}

describe("mutationsForPropertyRemoval", () => {
  it("emits a single remove mutation", () => {
    assert.deepEqual(mutationsForPropertyRemoval(".btn", "padding"), [
      { selector: ".btn", property: "padding", action: "remove" },
    ]);
  });
});

describe("mutationsForSelectorBlockRemoval", () => {
  it("emits one remove mutation per property in the block", () => {
    assert.deepEqual(
      mutationsForSelectorBlockRemoval(".card", ["padding", "border-radius", "background"]),
      [
        { selector: ".card", property: "padding", action: "remove" },
        { selector: ".card", property: "border-radius", action: "remove" },
        { selector: ".card", property: "background", action: "remove" },
      ],
    );
  });
});

describe("runBatchPrescan", () => {
  it("forwards mutations to batchRender and diffs against the baseline tree", async () => {
    const baselineTree = tree({
      ch: [tree({ tag: "div", x: 0, y: 0, w: 100, h: 40 })],
    });
    const callerArgs: Array<{
      baseHtml: string;
      viewport: { width: number; height: number };
      variants: Array<{ id: string; mutations: CraterCssMutation[] }>;
    }> = [];

    const client = {
      async batchRender(baseHtml: string, viewport: { width: number; height: number }, variants: Array<{ id: string; mutations: CraterCssMutation[] }>) {
        callerArgs.push({ baseHtml, viewport, variants });
        return {
          results: [
            { id: "trial-a", paintTree: tree({ ch: [tree({ tag: "div", x: 0, y: 0, w: 100, h: 60 })] }) },
            { id: "trial-b", paintTree: tree({ ch: [tree({ tag: "div", x: 0, y: 0, w: 100, h: 40 })] }) },
          ],
        };
      },
    };

    const results = await runBatchPrescan(
      client,
      "<style>.card{padding:16px}</style><div class='card'>A</div>",
      { width: 1280, height: 900 },
      baselineTree,
      [
        { id: "trial-a", mutations: mutationsForPropertyRemoval(".card", "padding") },
        { id: "trial-b", mutations: mutationsForPropertyRemoval(".card", "color") },
      ],
    );

    assert.equal(results.length, 2);
    assert.equal(results[0]?.id, "trial-a");
    assert.equal(results[0]?.missing, false);
    assert.ok((results[0]?.changes ?? []).some((c) => c.type === "geometry"), "padding removal should change geometry");
    assert.equal(results[1]?.id, "trial-b");
    assert.equal(results[1]?.changes.length, 0, "identical tree → no changes");
    assert.deepEqual(callerArgs[0]?.variants, [
      { id: "trial-a", mutations: [{ selector: ".card", property: "padding", action: "remove" }] },
      { id: "trial-b", mutations: [{ selector: ".card", property: "color", action: "remove" }] },
    ]);
  });

  it("marks variants Crater silently dropped as `missing`", async () => {
    const baselineTree = tree();
    const client = {
      async batchRender() {
        return { results: [{ id: "kept" }] }; // no paintTree field
      },
    };

    const results = await runBatchPrescan(client, "", { width: 800, height: 600 }, baselineTree, [
      { id: "kept", mutations: [{ selector: ".x", property: "color", action: "remove" }] },
    ]);

    assert.equal(results[0]?.missing, true);
    assert.equal(results[0]?.changes.length, 0);
  });

  it("skips variants with no mutations by default", async () => {
    const baselineTree = tree();
    let called = false;
    const client = {
      async batchRender() {
        called = true;
        return { results: [] };
      },
    };

    const results = await runBatchPrescan(client, "", { width: 800, height: 600 }, baselineTree, [
      { id: "noop", mutations: [] },
    ]);

    assert.equal(called, false, "should short-circuit when every variant is empty");
    assert.deepEqual(results, []);
  });
});

describe("hasAnyBatchPrescanSignal", () => {
  it("returns true when at least one variant emitted changes", () => {
    assert.equal(hasAnyBatchPrescanSignal([
      { id: "a", changes: [], missing: false },
      { id: "b", changes: [{ path: "root", type: "geometry", property: "bounds", before: "", after: "" }], missing: false },
    ]), true);
  });

  it("does not count missing variants as a signal", () => {
    assert.equal(hasAnyBatchPrescanSignal([
      { id: "a", changes: [], missing: true },
    ]), false);
  });
});
