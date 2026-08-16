import assert from "node:assert/strict";
import { describe, it } from "vitest";
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

/**
 * `runSmokeTest`'s own contract: reproducibility, the action cap, and what a page it cannot open
 * reports.
 *
 * The a11y-regression case above is the only path this file drove, so the runner's promises to
 * its callers — a seed that reproduces a run, a cap that holds, an unopenable target that returns
 * a verdict instead of throwing — were untested. All three matter because this runner is called
 * from the HTTP API (`src/api/`), where a throw is a 500 and a non-reproducible run is a bug
 * report nobody can act on.
 */
describe("runSmokeTest — reproducibility and limits", () => {
  /** A page with several clickable targets, so the action sequence has choices to make. */
  const html = `<!doctype html><meta charset="utf-8"><title>Widgets</title>
    <main>
      <button id="a">Alpha</button>
      <button id="b">Beta</button>
      <button id="c">Gamma</button>
      <label>Name <input id="n" type="text"></label>
      <label>Note <textarea id="t"></textarea></label>
      <a href="#deep">Jump</a>
    </main>`;

  it("the same seed produces the same action sequence", { timeout: 180_000 }, async () => {
    // The whole reason `seed` exists. Without this, "it failed on step 7" is not a reproduction
    // instruction, and the flake-vs-regression question cannot be answered.
    const run = () => runSmokeTest({ target: { html }, mode: "random", seed: 4242, maxActions: 6 });
    const first = await run();
    const second = await run();
    // Keyed on `action` + `target.name`, which are the fields `SmokeAction` actually has. The
    // first version of this used `a.type` / `a.selector` — neither exists — so every key was
    // `undefined:` and the assertion passed without comparing anything. The different-seed test
    // below is what exposed it: it "failed" because both sequences were equally empty.
    assert.deepEqual(
      first.actions.map((a) => `${a.action}:${a.target.name}`),
      second.actions.map((a) => `${a.action}:${a.target.name}`),
      "same seed, same sequence",
    );
    assert.ok(first.actions.length > 1, "and the sequence being compared is not empty");
    assert.equal(first.meta.seed, 4242, "the seed is echoed so a report can be replayed");
  });

  it("a different seed takes a different path through the same page", { timeout: 180_000 }, async () => {
    // The complement: if every seed produced the same sequence, the seed would be decoration and
    // repeated runs would explore nothing.
    const a = await runSmokeTest({ target: { html }, mode: "random", seed: 1, maxActions: 8 });
    const b = await runSmokeTest({ target: { html }, mode: "random", seed: 99, maxActions: 8 });
    const key = (r: typeof a) => r.actions.map((x) => `${x.action}:${x.target.name}`).join("|");
    assert.ok(a.actions.length > 1 && b.actions.length > 1, "both runs took actions");
    assert.notEqual(key(a), key(b));
  });

  it("honours maxActions", { timeout: 180_000 }, async () => {
    const result = await runSmokeTest({ target: { html }, mode: "random", seed: 7, maxActions: 3 });
    assert.ok(result.actions.length <= 3, `took ${result.actions.length} actions with a cap of 3`);
    assert.equal(result.meta.totalActions, result.actions.length, "the meta count matches the list");
  });

  it("returns a verdict for a target it cannot open, rather than throwing", { timeout: 180_000 }, async () => {
    // Called from the HTTP API, so a throw here is a 500 with a stack instead of a report. A
    // closed port is the realistic version of this: nothing to navigate to.
    const result = await runSmokeTest({
      target: { url: "http://127.0.0.1:9/" },
      mode: "random",
      seed: 1,
      maxActions: 2,
    });
    assert.notEqual(result.status, "pass");
    assert.ok(result.errors.length > 0, "the reason is in the report");
    assert.equal(result.meta.totalErrors, result.errors.length);
  });

  it("records the elapsed time and the mode it ran in", { timeout: 180_000 }, async () => {
    const result = await runSmokeTest({ target: { html }, mode: "random", seed: 3, maxActions: 2 });
    assert.equal(result.meta.mode, "random");
    assert.ok(result.meta.elapsedMs >= 0);
    // Snapshots are what `evaluateA11ySnapshotConsistency` above consumes; a run that returns
    // none silently disables that check.
    assert.ok((result.snapshots?.length ?? 0) > 0, "a11y snapshots are captured per step");
  });
});
