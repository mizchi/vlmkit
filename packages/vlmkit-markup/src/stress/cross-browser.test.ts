import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { engineInstallCommand, parityShortfall } from "./cross-browser.ts";

describe("engineInstallCommand", () => {
  // `diff browsers` is the only launch site in the repo that launches firefox
  // and webkit, so it is the one that most needed the issue-#112 fix: its advice
  // used to be `npx playwright install <engine>`, which resolves the *project's*
  // playwright rather than the one this module imported.
  it("targets the resolved playwright's own CLI, not npx", () => {
    const command = engineInstallCommand("firefox");
    assert.match(command, /playwright[/\\]cli\.js install firefox$/);
    assert.doesNotMatch(command, /^npx /);
  });

  it("passes several engines to one invocation", () => {
    assert.match(engineInstallCommand("firefox", "webkit"), /cli\.js install firefox webkit$/);
  });

  it("names every engine when called with none", () => {
    assert.match(engineInstallCommand(), /cli\.js install chromium firefox webkit$/);
  });
});

/**
 * "Fewer than two engines rendered" used to be one verdict for two unrelated situations.
 *
 * The condition was `usable < 2` and it never asked how many engines were *wanted*, in two
 * places — the terminal summary and the markdown report. So a caller who narrowed
 * `--engines` got told they were under-configured. Measured:
 * `vlmkit diff browsers a.html --engines chromium` printed `✓ chromium`, no `✗` anywhere,
 * then "Only 1 engine(s) usable — Install missing engines with playwright install firefox
 * webkit", and exited non-zero for doing exactly what it was told.
 */
describe("parityShortfall", () => {
  it("says nothing when two or more engines rendered", () => {
    assert.equal(parityShortfall(3, 3), null);
    assert.equal(parityShortfall(3, 2), null, "two is enough for a comparison");
    assert.equal(parityShortfall(2, 2), null);
  });

  it("does not fail the run when the caller asked for one engine", () => {
    // The defect. Nothing is missing here, so nothing is wrong.
    const s = parityShortfall(1, 1);
    assert.equal(s?.kind, "narrowed");
    assert.equal(s?.failsRun, false);
    assert.match(s!.message, /single engine was requested/);
    assert.doesNotMatch(s!.message, /install/i, "there is nothing to install");
  });

  it("fails the run when engines were expected and are missing", () => {
    // The case the branch was written for: an under-configured CI runner must not pass a
    // parity gate silently.
    const s = parityShortfall(3, 1);
    assert.equal(s?.kind, "missing-engines");
    assert.equal(s?.failsRun, true);
    assert.match(s!.message, /only 1 of 3 engine\(s\) usable/);
  });

  it("counts zero usable as missing engines, not as a narrow request", () => {
    // `requested >= 2` decides, so a run where every engine failed still reads as missing.
    const s = parityShortfall(3, 0);
    assert.equal(s?.kind, "missing-engines");
    assert.equal(s?.failsRun, true);
  });

  it("still reports a shortfall for a single request, so the report cannot imply parity", () => {
    // Both branches must return something: "no comparison happened" is the one status a
    // reader must never mistake for "compared and fine".
    for (const [requested, usable] of [[1, 1], [1, 0], [3, 1]] as const) {
      assert.notEqual(parityShortfall(requested, usable), null, `${requested}/${usable}`);
    }
  });
});
