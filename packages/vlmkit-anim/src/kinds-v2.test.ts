/**
 * matrix / graph / chart: the compilers' semantics read back from frames, the
 * generators' correctness, and the validator's phrasing for the mistakes a
 * writer makes first.
 */
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { checkAnimation, explain } from "./check.ts";
import { compileScene, generateGraphOps, niceMax, SceneValidationError } from "./compile/index.ts";
import { EXAMPLES } from "./schema-sheet.ts";
import { sampleFrame, timelineDuration, worldPos } from "./timeline.ts";
import { SCENE_FORMAT, type GraphScene, type MatrixScene, type Scene, type ChartScene } from "./types.ts";
import { formatDiagnostics, validateScene } from "./validate.ts";

const errorsOf = (scene: Scene) => checkAnimation(compileScene(scene), scene).filter((d) => d.severity === "error");

describe("matrix", () => {
  it("fills the DP table: the final frame reads the computed values by position", () => {
    const tl = compileScene(EXAMPLES.matrix);
    assert.deepEqual(tl.meta?.finalCells, [["0", "1", "2", "3"], ["1", "0", "1", "2"], ["2", "1", "1", "2"], ["3", "2", "2", "1"]]);
    assert.deepEqual(errorsOf(EXAMPLES.matrix), []);
    const frame = sampleFrame(tl, timelineDuration(tl));
    assert.equal(frame.get("cell-3-3")!.text, "1");
    assert.equal(frame.get("cell-3-3")!.fill, "#22c55e", "marked cell is the ok colour");
    assert.equal(sampleFrame(tl, 0).get("cell-1-1")!.text, "", "empty until set");
  });

  it("swapping rows moves whole rows (and their labels); swapping columns moves every cell in them", () => {
    const s: MatrixScene = {
      format: SCENE_FORMAT,
      kind: "matrix",
      rowLabels: ["r0", "r1", "r2"],
      colLabels: ["a", "b"],
      cells: [[1, 2], [3, 4], [5, 6]],
      ops: [{ swap: { rows: [0, 2] }, caption: "pivot" }, { swap: { cols: [0, 1] } }, { set: { cell: [0, 0], value: 9 } }],
    };
    const tl = compileScene(s);
    assert.deepEqual(tl.meta?.finalCells, [["9", "5"], ["4", "3"], ["2", "1"]]);
    assert.deepEqual(tl.meta?.rowOrder, [2, 1, 0]);
    assert.deepEqual(errorsOf(s), []);
    const frame = sampleFrame(tl, timelineDuration(tl));
    // Original cell (2, 1) = 6 now sits at slot [0, 0] and reads 9 (the set targets the slot).
    const slots = tl.meta?.slots as { x: number[]; y: number[] };
    const [x, y] = worldPos(frame, "cell-2-1");
    assert.ok(Math.abs(x - slots.x[0]) < 1 && Math.abs(y - slots.y[0]) < 1);
    assert.equal(frame.get("cell-2-1")!.text, "9");
    const captions = (tl.steps ?? []).map((st) => st.caption);
    assert.ok(captions.includes("pivot") && captions.includes("Swap columns a and b"));
  });

  it("validator: ragged rows, out-of-range references, and a malformed target are named with the fix", () => {
    const diags = validateScene({
      format: SCENE_FORMAT,
      kind: "matrix",
      cells: [[1, 2], [3]],
      ops: [{ set: { cell: [5, 0], value: 1 } }, { highlight: { rows: 1 } }, { swap: { rows: [0, 0, 1] } }],
    });
    const paths = diags.map((d) => d.path);
    assert.ok(paths.includes("cells[1]"), formatDiagnostics(diags));
    assert.ok(diags.some((d) => d.path === "ops[0].set.cell[0]" && /out of range/.test(d.message)));
    assert.ok(diags.some((d) => d.path === "ops[1].highlight.rows" && /did you mean "row"/.test(d.hint ?? "")));
    assert.ok(diags.some((d) => d.path === "ops[2].swap.rows" && /two indices/.test(d.message)));
  });
});

describe("graph", () => {
  const g: GraphScene = EXAMPLES.graph;

  it("dijkstra visits every node in distance order and paints the shortest path", () => {
    const tl = compileScene(g);
    assert.deepEqual(tl.meta?.visited, ["A", "C", "B", "D", "E"]);
    assert.deepEqual(tl.meta?.path, ["A", "C", "B", "D", "E"]);
    assert.deepEqual(tl.meta?.labels, { A: "0", B: "3", C: "1", D: "4", E: "7" });
    assert.deepEqual(errorsOf(g), []);
    const frame = sampleFrame(tl, timelineDuration(tl));
    for (const id of ["A", "B", "C", "D", "E"]) assert.equal(frame.get(`node-${id}`)!.fill, "#22c55e", `${id} ends visited`);
    assert.equal(frame.get("token")!.opacity, 0);
    assert.match(explain(tl), /C → B: 1 \+ 2 = 3 < 4, improve/);
    // The relaxation label lands inside the explore beat, not as a step of its own.
    assert.ok(!(tl.steps ?? []).some((s) => s.caption === "B: 3"));
  });

  it("bfs labels depths and skips seen nodes; dfs backtracks; directed edges are one-way", () => {
    const base: GraphScene = { format: SCENE_FORMAT, kind: "graph", nodes: ["a", "b", "c", "d"], edges: [["a", "b"], ["a", "c"], ["b", "d"], ["c", "d"]], algorithm: "bfs", start: "a" };
    const bfs = compileScene(base);
    assert.deepEqual(bfs.meta?.visited, ["a", "b", "c", "d"]);
    assert.deepEqual(bfs.meta?.labels, { a: "0", b: "1", c: "1", d: "2" });
    const dfs = compileScene({ ...base, algorithm: "dfs" });
    assert.deepEqual(dfs.meta?.visited, ["a", "b", "d", "c"]);
    assert.ok(explain(dfs).includes("no unvisited neighbours: back to"));
    const directed: GraphScene = { ...base, directed: true, edges: [["a", "b"], ["c", "a"]] };
    const ops = generateGraphOps(directed);
    assert.deepEqual(ops.filter((o) => "visit" in o).map((o) => (o as { visit: string }).visit), ["a", "b"], "c is upstream of a and never reached");
    const diags = checkAnimation(compileScene(directed), directed);
    assert.ok(diags.some((d) => d.path === "nodes(c)" && /not reachable/.test(d.message)), formatDiagnostics(diags));
  });

  it("validator: explore along a missing or reversed edge, a disconnected path, and algorithm-or-ops", () => {
    const diags = validateScene({
      format: SCENE_FORMAT,
      kind: "graph",
      nodes: ["a", "b", "c"],
      directed: true,
      edges: [["a", "b"]],
      ops: [{ explore: "b->a" }, { explore: "a->c" }, { path: ["a", "b", "c"] }],
    });
    assert.ok(diags.some((d) => d.path === "ops[0].explore" && /graph is directed/.test(d.message) && /"a->b"/.test(d.hint ?? "")), formatDiagnostics(diags));
    assert.ok(diags.some((d) => d.path === "ops[1].explore" && /no edge between/.test(d.message)));
    assert.ok(diags.some((d) => d.path === "ops[2].path[2]" && /not connected/.test(d.message)));
    const none = validateScene({ format: SCENE_FORMAT, kind: "graph", nodes: ["a"], edges: [] });
    assert.ok(none.some((d) => d.path === "algorithm" && /bfs \| dfs \| dijkstra/.test(d.message)));
    assert.throws(() => compileScene({ format: SCENE_FORMAT, kind: "graph", nodes: ["a", "b"], edges: [["a", "b"]], algorithm: "dijkstra", start: "z" } as Scene), SceneValidationError);
  });
});

describe("chart", () => {
  it("bars end at their value's share of the axis; the axis top is a round number", () => {
    const c: ChartScene = EXAMPLES.chart;
    const tl = compileScene(c);
    assert.equal(tl.meta?.yMax, 300);
    assert.deepEqual(errorsOf(c), []);
    const frame = sampleFrame(tl, timelineDuration(tl));
    const plotH = tl.meta?.plotH as number;
    assert.ok(Math.abs(frame.get("bar-before-2")!.size![1] - (260 / 300) * plotH) < 0.5);
    // Before "after" is revealed its bars have zero height.
    const reveal = (tl.steps ?? []).find((s) => s.caption?.startsWith("After"))!;
    assert.equal(sampleFrame(tl, reveal.t).get("bar-after-0")!.size![1], 0);
    // Highlighting ap dims the other categories.
    assert.ok(frame.get("bar-before-0")!.opacity < 0.5 && frame.get("bar-before-2")!.opacity === 1);
    assert.deepEqual(tl.meta?.revealed, ["before", "after"]);
  });

  it("set moves a bar; a series never revealed is warned about; line charts draw in and refuse set", () => {
    const s: ChartScene = {
      format: SCENE_FORMAT,
      kind: "chart",
      categories: ["q1", "q2"],
      series: [{ id: "a", values: [10, 20] }, { id: "ghost", values: [1, 1] }],
      sequence: [{ reveal: "a" }, { set: { series: "a", index: 0, value: 30 } }],
    };
    const tl = compileScene(s);
    assert.deepEqual((tl.meta?.finalValues as Record<string, number[]>).a, [30, 20]);
    const diags = checkAnimation(tl, s);
    assert.deepEqual(diags.filter((d) => d.severity === "error"), [], formatDiagnostics(diags));
    assert.ok(diags.some((d) => d.path === "series(ghost)" && /never revealed/.test(d.message)));
    assert.match(explain(tl), /q1 \(a\): 10 → 30/);
    const line: ChartScene = { ...s, type: "line", series: [{ id: "a", values: [10, 20] }] };
    const bad = validateScene({ ...line, sequence: [{ set: { series: "a", index: 0, value: 30 } }] });
    assert.ok(bad.some((d) => d.path === "sequence[0].set" && /line chart/.test(d.message)), formatDiagnostics(bad));
    const lineTl = compileScene({ ...line, sequence: undefined });
    const end = sampleFrame(lineTl, timelineDuration(lineTl));
    assert.equal(end.get("seg-a-1")!.dash, 1);
    assert.equal(sampleFrame(lineTl, 0).get("seg-a-1")!.dash, 0);
  });

  it("niceMax climbs a 1-1.5-2-2.5-3-4-5-6-8-10 ladder", () => {
    assert.deepEqual([286, 7, 0.4, 1000, 1001].map(niceMax), [300, 8, 0.4, 1000, 1500]);
  });
});
