import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { EXAMPLES } from "./schema-sheet.ts";
import { SCENE_FORMAT, TIMELINE_FORMAT } from "./types.ts";
import { closest, formatDiagnostics, hasErrors, validateDocument, validateScene, validateTimeline } from "./validate.ts";

const errors = (diags: ReturnType<typeof validateScene>) => diags.filter((d) => d.severity === "error");

describe("validateScene", () => {
  it("accepts every schema-sheet example without a single diagnostic", () => {
    for (const [kind, ex] of Object.entries(EXAMPLES)) {
      const diags = kind === "timeline" ? validateTimeline(ex) : validateScene(ex);
      assert.deepEqual(diags, [], `${kind}: ${formatDiagnostics(diags)}`);
    }
  });

  it("names the nearest accepted key for a typo, with the full accepted list", () => {
    const diags = validateScene({ ...EXAMPLES["state-machine"], layuot: "lr" });
    const d = errors(diags).find((x) => x.path === "layuot");
    assert.ok(d, formatDiagnostics(diags));
    assert.match(d.message, /unknown key "layuot"/);
    assert.match(d.hint ?? "", /did you mean "layout"\?/);
    assert.match(d.hint ?? "", /accepted keys: .*"trace"/);
  });

  it("names the nearest enum value: shape 'rectangle' → 'rect'", () => {
    const diags = validateScene({ ...EXAMPLES.diagram, nodes: [{ id: "a", shape: "rectangle" }] });
    const d = errors(diags).find((x) => x.path === "nodes[0].shape");
    assert.ok(d);
    assert.match(d.hint ?? "", /did you mean "rect"\?/);
  });

  it("dangling reference: lists the ids that do exist", () => {
    const diags = validateScene({ ...EXAMPLES.diagram, edges: [{ from: "browser", to: "database" }] });
    const d = errors(diags).find((x) => x.path === "edges[0].to");
    assert.ok(d);
    assert.match(d.message, /unknown node "database"/);
    assert.match(d.hint ?? "", /known nodes: "browser", "api", "db"/);
  });

  it("state-machine: an illegal trace event says which events ARE legal from that state", () => {
    const diags = validateScene({ ...EXAMPLES["state-machine"], trace: ["push", "lock"] });
    const d = errors(diags).find((x) => x.path === "trace[1]");
    assert.ok(d, formatDiagnostics(diags));
    assert.match(d.message, /no transition from "open" on "lock"/);
    assert.match(d.hint ?? "", /legal events are "pull"/);
  });

  it("state-machine: two transitions on the same event from one state is an error", () => {
    const sm = EXAMPLES["state-machine"];
    const diags = validateScene({ ...sm, transitions: [...sm.transitions, { from: "closed", to: "locked", on: "push" }] });
    assert.ok(errors(diags).some((d) => d.path === "transitions[3].on" && /already has a transition on "push"/.test(d.message)));
  });

  it("diagram: a flow along a missing edge says how to add it", () => {
    const diags = validateScene({ ...EXAMPLES.diagram, sequence: [{ flow: "browser->db" }] });
    const d = errors(diags).find((x) => x.path === "sequence[0].flow");
    assert.ok(d);
    assert.match(d.message, /no edge between "browser" and "db"/);
    assert.match(d.hint ?? "", /add \{"from": "browser", "to": "db"\}/);
  });

  it("diagram: a step with two actions or none is rejected with the action list", () => {
    const diags = validateScene({ ...EXAMPLES.diagram, sequence: [{ show: "db", hide: "api" }, { caption: "x" }] });
    const e = errors(diags);
    assert.ok(e.some((d) => d.path === "sequence[0]" && /exactly one action key, found "show", "hide"/.test(d.message)));
    assert.ok(e.some((d) => d.path === "sequence[1]" && /found none/.test(d.message)));
  });

  it("sort: out-of-range indices and a missing algorithm/ops are both caught", () => {
    const diags = validateScene({ format: SCENE_FORMAT, kind: "sort", values: [3, 1, 2], ops: [{ swap: [0, 3] }] });
    assert.ok(errors(diags).some((d) => d.path === "ops[0].swap[1]" && /out of range for 3 values/.test(d.message)));
    const none = validateScene({ format: SCENE_FORMAT, kind: "sort", values: [3, 1] });
    assert.ok(errors(none).some((d) => d.path === "algorithm"));
  });

  it("heap: pop must be the literal true", () => {
    const diags = validateScene({ format: SCENE_FORMAT, kind: "heap", ops: [{ pop: 1 }] });
    assert.ok(errors(diags).some((d) => d.path === "ops[0].pop" && /literal true/.test(d.message)));
  });

  it("distributed: self-message and unknown status", () => {
    const diags = validateScene({
      format: SCENE_FORMAT,
      kind: "distributed",
      nodes: ["a", "b"],
      messages: [{ from: "a", to: "a" }],
      events: [{ at: 0, node: "b", status: "crashed" }],
    });
    assert.ok(errors(diags).some((d) => d.path === "messages[0].to" && /to itself/.test(d.message)));
    assert.ok(errors(diags).some((d) => d.path === "events[0].status" && /"down"/.test(d.hint ?? d.message)));
  });

  it("vector: `at` accepts numbers, '<' and signed offsets only", () => {
    const v = EXAMPLES.vector;
    const ok = validateScene({ ...v, timeline: [{ target: "a", to: { x: 1 }, at: "<" }, { target: "a", to: { x: 2 }, at: "+200" }, { target: "a", to: { x: 3 }, at: 50 }] });
    assert.deepEqual(errors(ok), []);
    const bad = validateScene({ ...v, timeline: [{ target: "a", to: { x: 1 }, at: "after" }] });
    assert.ok(errors(bad).some((d) => d.path === "timeline[0].at"));
  });

  it("wrong format string gets the exact expected value in the hint", () => {
    const diags = validateScene({ format: "vlmkit-anim/scene", kind: "sort", values: [1, 2], algorithm: "bubble" });
    assert.ok(errors(diags).some((d) => d.path === "format" && (d.hint ?? "").includes(SCENE_FORMAT)));
  });

  it("validateDocument routes by format and rejects the rest", () => {
    assert.equal(validateDocument(EXAMPLES.sort).layer, "scene");
    assert.equal(validateDocument(EXAMPLES.timeline).layer, "timeline");
    const r = validateDocument({ kind: "sort" });
    assert.equal(r.layer, "unknown");
    assert.ok(hasErrors(r.diagnostics));
  });
});

describe("validateTimeline", () => {
  it("keyframes out of order, unknown prop, and short duration are errors", () => {
    const tl = {
      format: TIMELINE_FORMAT,
      canvas: { width: 100, height: 100 },
      duration: 100,
      nodes: [{ id: "a", shape: "circle", r: 5 }],
      tracks: [{ target: "a", prop: "position", keyframes: [{ t: 500, value: [0, 0] }, { t: 200, value: [1, 1] }] }],
    };
    const e = errors(validateTimeline(tl));
    assert.ok(e.some((d) => d.path === "tracks[0].prop" && /did you mean "pos"/.test(d.hint ?? "")));
    assert.ok(e.some((d) => d.path === "tracks[0].keyframes[1].t" && /ascending/.test(d.message)));
    assert.ok(e.some((d) => d.path === "duration" && /shorter than the last keyframe/.test(d.message)));
  });

  it("shape-specific requirements are phrased as what to add", () => {
    const tl = { format: TIMELINE_FORMAT, canvas: { width: 10, height: 10 }, nodes: [{ id: "r", shape: "rect" }, { id: "l", shape: "arrow" }], tracks: [] };
    const e = errors(validateTimeline(tl));
    assert.ok(e.some((d) => d.path === "nodes[0].size" && /rect needs "size"/.test(d.message)));
    assert.ok(e.some((d) => d.path === "nodes[1].points" && /arrow needs "points"/.test(d.message)));
  });
});

describe("closest", () => {
  it("suggests only plausible typos", () => {
    assert.equal(closest("rectangle", ["rect", "circle"]), "rect");
    assert.equal(closest("layuot", ["layout", "nodes"]), "layout");
    assert.equal(closest("zzzzzzzz", ["layout", "nodes"]), undefined);
  });
});
