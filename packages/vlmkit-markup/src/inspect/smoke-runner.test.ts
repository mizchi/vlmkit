import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { A11ySnapshot } from "./smoke-types.ts";
import {
  annotateA11ySnapshotConsistency,
  evaluateA11ySnapshotConsistency,
  runSmokeTest,
} from "./smoke-runner.ts";

function snapshot(
  step: number,
  interactiveCount: number,
  landmarkCount: number,
  childRoles: string[] = ["banner", "main", "button"],
): A11ySnapshot {
  return {
    step,
    interactiveCount,
    landmarkCount,
    issues: [],
    tree: {
      role: "document",
      name: "",
      children: childRoles.map((role) => ({ role, name: role })),
    },
  };
}

describe("evaluateA11ySnapshotConsistency", () => {
  it("does not flag ordinary count changes after interactions", () => {
    const errors = evaluateA11ySnapshotConsistency([
      snapshot(0, 4, 3),
      snapshot(1, 2, 2, ["banner", "main", "button"]),
    ]);

    assert.deepEqual(errors, []);
  });

  it("flags a post-action a11y tree that loses all interactive targets", () => {
    const errors = evaluateA11ySnapshotConsistency([
      snapshot(0, 3, 2),
      snapshot(1, 0, 2, ["banner", "main"]),
    ]);

    assert.equal(errors.length, 1);
    assert.equal(errors[0]?.type, "a11y-regression");
    assert.equal(errors[0]?.step, 1);
    assert.match(errors[0]?.message ?? "", /interactive targets disappeared/);
  });

  it("annotates the affected snapshot with consistency issues", () => {
    const snapshots = [
      snapshot(0, 2, 2),
      snapshot(1, 0, 0, []),
    ];

    const errors = annotateA11ySnapshotConsistency(snapshots);

    assert.equal(errors.length, 1);
    assert.match(errors[0]?.message ?? "", /landmarks disappeared/);
    assert.match(snapshots[1]?.issues.join("\n") ?? "", /a11y tree became empty/);
    assert.match(snapshots[1]?.issues.join("\n") ?? "", /interactive targets disappeared/);
  });

  it("reports a11y-regression errors from the smoke runner", async () => {
    const result = await runSmokeTest({
      target: {
        html: `<!doctype html>
          <main>
            <button onclick="document.body.innerHTML='<main><p>Done</p></main>'">
              Destroy
            </button>
          </main>`,
      },
      mode: "random",
      maxActions: 1,
      seed: 1,
    });

    assert.equal(result.status, "error");
    assert.equal(result.errors.filter((error) => error.type === "a11y-regression").length, 1);
    assert.ok(result.errors.some((error) => error.type === "a11y-regression"));
    assert.ok(result.snapshots?.some((snap) =>
      snap.issues.some((issue) => issue.includes("interactive targets disappeared"))
    ));
  });
});
