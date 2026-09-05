/**
 * v9 (concept-introduction round) fixes, each pinned to the writer who hit it:
 * cb — `note` is documented as universal but `distributed` rejected it;
 * cd — a transition's `note` was drawn on the edge and absent from `explain`;
 * cd — a 4266px-wide state machine drew no warning.
 */
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { checkAnimation, explain } from "./check.ts";
import { compileScene } from "./compile/index.ts";
import { SCENE_FORMAT, type DistributedScene, type StateMachineScene } from "./types.ts";
import { formatDiagnostics, validateScene } from "./validate.ts";

describe("distributed: {note} in the message list (cb)", () => {
  const scene: DistributedScene = {
    format: SCENE_FORMAT,
    kind: "distributed",
    nodes: ["client", "server"],
    messages: [
      { from: "client", to: "server", label: "GET" },
      { note: "The server has to wait for the disk" },
      { from: "server", to: "client", label: "200" },
    ],
  };

  it("validates, takes a beat, and delays everything after it", () => {
    assert.deepEqual(validateScene(scene).filter((d) => d.severity === "error"), []);
    const tl = compileScene(scene);
    const times = tl.meta?.messageTimes as [number, number][];
    assert.equal(times.length, 3, "messageTimes stays index-aligned with messages, notes included");
    const [, getLands] = times[0];
    const [noteAt, noteEnds] = times[1];
    const [replyAt] = times[2];
    assert.equal(noteAt, getLands, "the pause starts when everything so far has landed");
    assert.ok(replyAt >= noteEnds, `the reply waits for the pause: ${replyAt} < ${noteEnds}`);
    assert.match(explain(tl), /The server has to wait for the disk/);
    assert.equal(tl.meta?.delivered, 2);
    assert.deepEqual(checkAnimation(tl, scene).filter((d) => d.severity === "error"), []);
  });

  it("is timed like a message: after + delay, and refuses both at and after", () => {
    const anchored: DistributedScene = { ...scene, messages: [scene.messages[0], { note: "…", after: "GET", delay: 300 }, scene.messages[2]] };
    const tl = compileScene(anchored);
    const times = tl.meta?.messageTimes as [number, number][];
    assert.equal(times[1][0], times[0][1] + 300);
    const bad = validateScene({ format: SCENE_FORMAT, kind: "distributed", nodes: ["a", "b"], messages: [{ from: "a", to: "b", label: "x" }, { note: 1, at: 100, after: "x" }] });
    assert.ok(bad.some((d) => d.path === "messages[1].note"), formatDiagnostics(bad));
    assert.ok(bad.some((d) => d.path === "messages[1].after" && /not both/.test(d.message)));
    const unknown = validateScene({ format: SCENE_FORMAT, kind: "distributed", nodes: ["a", "b"], messages: [{ note: "x", caption: "y" }] });
    assert.ok(unknown.some((d) => d.path === "messages[0].caption" && /unknown key/.test(d.message)));
  });
});

describe("state-machine: the transition note reaches the narration (cd)", () => {
  it("appends the note to the generated caption and leaves an authored caption alone", () => {
    const scene: StateMachineScene = {
      format: SCENE_FORMAT,
      kind: "state-machine",
      states: ["closed", "locked"],
      initial: "closed",
      transitions: [{ from: "closed", to: "locked", on: "lock", note: "/ beep" }, { from: "locked", to: "closed", on: "unlock" }],
      trace: ["lock", { on: "unlock", caption: "Back out" }],
    };
    const text = explain(compileScene(scene));
    assert.match(text, /on lock: closed → locked \/ beep/);
    assert.match(text, /Back out/);
    assert.doesNotMatch(text, /on unlock: locked → closed/);
  });
});

describe("a canvas nobody can take in at one glance (cd)", () => {
  it("warns above 2000px on either side and names the levers", () => {
    const long = "a very long state label that pushes the layout wide";
    const scene: StateMachineScene = {
      format: SCENE_FORMAT,
      kind: "state-machine",
      states: Array.from({ length: 6 }, (_, i) => ({ id: `s${i}`, label: `${long} ${i}` })),
      initial: "s0",
      transitions: Array.from({ length: 5 }, (_, i) => ({ from: `s${i}`, to: `s${i + 1}`, on: `e${i}` })),
      trace: ["e0", "e1", "e2", "e3", "e4"],
    };
    const tl = compileScene(scene);
    assert.ok(tl.canvas.width > 2000, `test premise: width ${tl.canvas.width}`);
    const diags = checkAnimation(tl, scene);
    const wide = diags.find((d) => d.path === "canvas");
    assert.ok(wide && wide.severity === "warn" && /shrinks to \d+%/.test(wide.message) && /"tb"/.test(wide.hint ?? ""), formatDiagnostics(diags));
  });
});
