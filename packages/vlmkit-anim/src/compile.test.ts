import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "vitest";
import { animStats, checkAnimation, explain } from "./check.ts";
import { compileScene, generateSortOps, SceneValidationError } from "./compile/index.ts";
import { EXAMPLES } from "./schema-sheet.ts";
import { sampleFrame, timelineDuration, worldPos } from "./timeline.ts";
import { SCENE_FORMAT, type Scene, type SortScene } from "./types.ts";
import { formatDiagnostics, validateTimeline } from "./validate.ts";

const FIXTURES = join(import.meta.dirname!, "..", "fixtures");
const fixtures = (): [string, Scene][] =>
  readdirSync(FIXTURES)
    .filter((f) => f.endsWith(".json"))
    .map((f) => [f, JSON.parse(readFileSync(join(FIXTURES, f), "utf-8")) as Scene]);

describe("compileScene", () => {
  it("every fixture and every schema example compiles to a valid timeline with no semantic errors", () => {
    const all: [string, Scene][] = [...fixtures(), ...Object.entries(EXAMPLES).filter(([k]) => k !== "timeline").map(([k, v]): [string, Scene] => [`example:${k}`, v as Scene])];
    for (const [name, scene] of all) {
      const tl = compileScene(scene);
      assert.deepEqual(validateTimeline(tl), [], `${name} compiled to an invalid timeline`);
      const diags = checkAnimation(tl, scene).filter((d) => d.severity === "error");
      assert.deepEqual(diags, [], `${name}: ${formatDiagnostics(diags)}`);
      assert.ok(timelineDuration(tl) > 0, `${name}: zero duration`);
      assert.ok((tl.steps ?? []).some((s) => s.caption), `${name}: no captions`);
    }
  });

  it("is deterministic: compiling twice gives identical JSON", () => {
    for (const [name, scene] of fixtures()) {
      assert.equal(JSON.stringify(compileScene(scene)), JSON.stringify(compileScene(scene)), name);
    }
  });

  it("rejects an invalid scene with the validator's diagnostics rather than a stack trace", () => {
    assert.throws(
      () => compileScene({ format: SCENE_FORMAT, kind: "sort", values: [1] } as Scene),
      (e: unknown) => e instanceof SceneValidationError && e.diagnostics.some((d) => d.path === "values"),
    );
  });
});

describe("sort", () => {
  const scene = (algorithm: SortScene["algorithm"]): SortScene => ({ format: SCENE_FORMAT, kind: "sort", values: [5, 3, 8, 1, 9, 2], algorithm });

  it("all three algorithms end with the bars in sorted order, read back from the final frame", () => {
    for (const algorithm of ["bubble", "insertion", "selection"] as const) {
      const s = scene(algorithm);
      const tl = compileScene(s);
      const frame = sampleFrame(tl, timelineDuration(tl));
      const order = tl.nodes
        .filter((n) => n.shape === "group")
        .map((n) => ({ x: worldPos(frame, n.id)[0], v: s.values[Number(n.id.slice(4))] }))
        .sort((a, b) => a.x - b.x)
        .map((b) => b.v);
      assert.deepEqual(order, [1, 2, 3, 5, 8, 9], algorithm);
    }
  });

  it("generateSortOps replays to the sorted array", () => {
    for (const algorithm of ["bubble", "insertion", "selection"] as const) {
      const a = [5, 3, 8, 1, 9, 2];
      for (const op of generateSortOps(a, algorithm)) if ("swap" in op) [a[op.swap[0]], a[op.swap[1]]] = [a[op.swap[1]], a[op.swap[0]]];
      assert.deepEqual(a, [1, 2, 3, 5, 8, 9], algorithm);
    }
  });

  it("explicit ops that do not finish the sort fail the semantic check, naming both orders", () => {
    const tl = compileScene({ format: SCENE_FORMAT, kind: "sort", values: [3, 1, 2], ops: [{ swap: [0, 1] }] });
    const diags = checkAnimation(tl, { format: SCENE_FORMAT, kind: "sort", values: [3, 1, 2], ops: [{ swap: [0, 1] }] });
    const e = diags.find((d) => d.severity === "error" && d.path === "ops");
    assert.ok(e, formatDiagnostics(diags));
    assert.match(e.message, /end with 1, 3, 2 but sorted order is 1, 2, 3/);
  });

  it("a bare sort scene is ~100 bytes and expands ~50x into motion", () => {
    const s = scene("bubble");
    const stats = animStats(compileScene(s), s);
    assert.ok(stats.sceneBytes! < 150);
    assert.ok(stats.expansion! > 20, `expansion ${stats.expansion}`);
  });
});

describe("heap", () => {
  it("pops come out in order and the final tree is a heap", () => {
    const s: Scene = { format: SCENE_FORMAT, kind: "heap", ops: [{ push: 5 }, { push: 3 }, { push: 8 }, { push: 1 }, { push: 4 }, { pop: true }, { pop: true }, { pop: true }] };
    const tl = compileScene(s);
    assert.deepEqual(tl.meta?.popped, [1, 3, 4]);
    assert.deepEqual(checkAnimation(tl, s).filter((d) => d.severity === "error"), []);
  });

  it("max-heap flips the comparison", () => {
    const s: Scene = { format: SCENE_FORMAT, kind: "heap", type: "max", ops: [{ push: 1 }, { push: 9 }, { push: 4 }, { pop: true }] };
    const tl = compileScene(s);
    assert.deepEqual(tl.meta?.popped, [9]);
    assert.ok(explain(tl).includes("9 > parent 1: swap up"));
  });

  it("an `initial` that is not a heap is an error with the fix in the hint", () => {
    const s: Scene = { format: SCENE_FORMAT, kind: "heap", initial: [5, 3], ops: [{ pop: true }] };
    const diags = checkAnimation(compileScene(s), s);
    const e = diags.find((d) => d.path === "initial[1]");
    assert.ok(e);
    assert.match(e.hint ?? "", /push the values through "ops"/);
  });
});

describe("state-machine", () => {
  it("walks the trace: visited states and one captioned step per event", () => {
    const tl = compileScene(EXAMPLES["state-machine"]);
    assert.deepEqual(tl.meta?.visited, ["closed", "open", "closed", "locked"]);
    const captions = (tl.steps ?? []).map((s) => s.caption);
    assert.ok(captions.includes("on push: closed → open"));
    assert.ok(captions.some((c) => /final state "locked"/.test(c ?? "")));
  });

  it("goto shows an alternative path after the main one and silences the untaken-path warning", () => {
    const s: Scene = {
      format: SCENE_FORMAT,
      kind: "state-machine",
      states: ["a", "b", "c", { id: "d", final: true }],
      initial: "a",
      transitions: [
        { from: "a", to: "b", on: "x" },
        { from: "b", to: "d", on: "y" },
        { from: "a", to: "c", on: "z" },
        { from: "c", to: "d", on: "y" },
      ],
      trace: ["x", "y", { goto: "a", caption: "The other path: z first" }, "z", { on: "y", caption: "and it also ends in d" }],
    };
    const tl = compileScene(s);
    assert.deepEqual(tl.meta?.visited, ["a", "b", "d", "a", "c", "d"]);
    const captions = (tl.steps ?? []).map((x) => x.caption);
    assert.ok(captions.includes("The other path: z first"));
    assert.ok(captions.includes("and it also ends in d"));
    assert.deepEqual(checkAnimation(tl, s).filter((d) => /never/.test(d.message)), []);
    // Without the second leg, both untaken pieces are named and the hint offers goto.
    const half: Scene = { ...s, trace: ["x", "y"] };
    const diags = checkAnimation(compileScene(half), half);
    assert.ok(diags.some((d) => d.path === "states(c)" && /goto/.test(d.hint ?? "")), formatDiagnostics(diags));
  });

  it("warns about unreachable states", () => {
    const s: Scene = { ...EXAMPLES["state-machine"], states: [...EXAMPLES["state-machine"].states, "limbo"] };
    const diags = checkAnimation(compileScene(s), s);
    assert.ok(diags.some((d) => d.severity === "warn" && /"limbo" is unreachable/.test(d.message)));
  });

  it("the active state is the accent colour only while current", () => {
    const tl = compileScene(EXAMPLES["state-machine"]);
    // Right after "push" (closed → open) settles, open is lit and closed is not.
    const push = (tl.steps ?? []).find((s) => s.label === "push")!;
    const pull = (tl.steps ?? []).find((s) => s.label === "pull")!;
    const frame = sampleFrame(tl, pull.t - 1);
    assert.equal(frame.get("state-open")!.fill, "#f59e0b");
    assert.equal(frame.get("state-closed")!.fill, "#ffffff");
    assert.notEqual(push.t, pull.t);
    // Before anything fires, only the initial state is lit — a `set` at t>0 must not bleed backwards.
    const start = sampleFrame(tl, 0);
    assert.equal(start.get("state-closed")!.fill, "#f59e0b");
    assert.equal(start.get("state-locked")!.fill, "#ffffff");
  });
});

describe("distributed", () => {
  it("two messages sent at the same instant share a step and both captions survive", () => {
    const s: Scene = {
      format: SCENE_FORMAT,
      kind: "distributed",
      nodes: ["a", "b", "c"],
      messages: [
        { from: "a", to: "b", label: "vote?", at: 0 },
        { from: "a", to: "c", label: "vote?", at: 0, lost: true, caption: "the request to c is lost" },
      ],
    };
    const tl = compileScene(s);
    const first = (tl.steps ?? []).find((x) => x.t === 0)!;
    assert.match(first.caption ?? "", /a → b: vote\? · the request to c is lost/);
  });

  it("`after` anchors follow a latency change; an absolute event that drifts mid-flight is warned about", () => {
    const base: Extract<Scene, { kind: "distributed" }> = {
      format: SCENE_FORMAT,
      kind: "distributed",
      stepMs: 500,
      nodes: ["client", "primary", "replica"],
      messages: [
        { from: "client", to: "primary", label: "write" },
        { from: "primary", to: "replica", label: "replicate" },
        { from: "replica", to: "primary", label: "ack" },
        { from: "primary", to: "client", label: "ok" },
      ],
      events: [{ after: "ok", node: "primary", status: "down" }],
    };
    const before = compileScene(base);
    assert.deepEqual(before.meta?.eventTimes, [2000]);
    const slow: typeof base = { ...base, messages: base.messages.map((m) => (m.label === "ack" ? { ...m, latency: 1700 } : m)) };
    const after = compileScene(slow);
    assert.deepEqual(after.meta?.eventTimes, [3200], "the crash moved with the message it is anchored to");
    assert.deepEqual(checkAnimation(after, slow).filter((d) => d.severity !== "warn" || /flight|down since/.test(d.message)), []);
    // The same edit with an absolute event: the crash now lands while "ok" is in the air, and primary sends after dying.
    const absolute: typeof base = { ...slow, events: [{ at: 2000, node: "primary", status: "down" }] };
    const diags = checkAnimation(compileScene(absolute), absolute);
    assert.ok(diags.some((d) => d.path === "events[0].at" && /in flight/.test(d.message) && /"after": "ack"/.test(d.hint ?? "")), formatDiagnostics(diags));
    const later: typeof base = { ...slow, events: [{ at: 1500, node: "primary", status: "down" }] };
    const d2 = checkAnimation(compileScene(later), later);
    assert.ok(d2.some((d) => d.path === "messages[3]" && /has been down since/.test(d.message)), formatDiagnostics(d2));
  });

  it("messages default to sequential timing and a message into a down node warns unless lost", () => {
    const s: Scene = {
      format: SCENE_FORMAT,
      kind: "distributed",
      stepMs: 500,
      nodes: ["a", "b"],
      messages: [{ from: "a", to: "b" }, { from: "a", to: "b" }],
      events: [{ at: 600, node: "b", status: "down" }],
    };
    const tl = compileScene(s);
    const steps = (tl.steps ?? []).filter((x) => x.caption?.startsWith("a → b")).map((x) => x.t);
    assert.deepEqual(steps, [0, 500]);
    const diags = checkAnimation(tl, s);
    assert.ok(diags.some((d) => d.path === "messages[1]" && /down when this message lands/.test(d.message)));
  });
});

describe("diagram", () => {
  it("hidden nodes appear on show, and a hidden node no step shows is warned about", () => {
    const tl = compileScene(EXAMPLES.diagram);
    const show = (tl.steps ?? []).find((s) => s.caption === "The API needs the database")!;
    assert.equal(sampleFrame(tl, show.t - 1).get("db")!.opacity, 0);
    assert.equal(sampleFrame(tl, timelineDuration(tl)).get("db")!.opacity, 1);
    const s: Scene = { ...EXAMPLES.diagram, sequence: [{ flow: "browser->api" }] };
    assert.ok(checkAnimation(compileScene(s), s).some((d) => /"db" is hidden and no step shows it/.test(d.message)));
  });
});

describe("vector", () => {
  it("`<` runs with the previous tween, `x` fills `y` from the current position, text is discrete", () => {
    const tl = compileScene(EXAMPLES.vector);
    const a = tl.tracks.find((t) => t.target === "a" && t.prop === "pos")!;
    const b = tl.tracks.find((t) => t.target === "b" && t.prop === "pos")!;
    assert.deepEqual(a.keyframes[a.keyframes.length - 1].value, [360, 60]);
    assert.equal(b.keyframes.find((k) => k.t === 800)?.t, 800, "b's tween ends with a's because of at: '<'");
    const fade = tl.tracks.filter((t) => t.prop === "opacity");
    assert.equal(fade.length, 2);
    for (const f of fade) assert.equal(f.keyframes[f.keyframes.length - 1].t, 800 + 200 + 400);
  });
});
