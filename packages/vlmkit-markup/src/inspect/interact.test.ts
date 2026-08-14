import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { formatInteractReport, runInteract, type Sequence } from "./interact.ts";

/**
 * `inspect interact` end to end, in-process.
 *
 * The gate drives a page through a declared sequence of Playwright actions,
 * screenshots at each `snapshot` step, and diffs consecutive snapshots. So a test
 * is a fixture page plus a sequence, and the interesting sequences are the ones
 * that go wrong: a selector that matches nothing, a step that runs but changes
 * nothing, a sequence with too few snapshots to diff.
 */

const dir = mkdtempSync(join(tmpdir(), "vlmkit-interact-"));

const fixture = join(dir, "page.html");
writeFileSync(fixture, `<!doctype html><meta charset="utf-8"><title>interact</title>
<style>
  body { margin: 0; font: 16px sans-serif; background: #fff; color: #111; }
  .menu { display: none; height: 180px; background: #2d6cdf; color: #fff; padding: 16px; }
  .menu.open { display: block; }
  input, select, button { font: inherit; padding: 8px; margin: 12px; }
  .tall { height: 1400px; background: linear-gradient(#fff, #888); }
</style>
<body>
  <button class="dropdown-trigger" id="trigger">Open menu</button>
  <button class="btn-primary">Save</button>
  <button class="btn-secondary">Cancel</button>
  <div class="menu" id="menu">Menu contents, 180px of blue.</div>
  <input name="email" placeholder="email">
  <select name="plan"><option value="free">Free</option><option value="pro">Pro</option></select>
  <div class="tall"></div>
  <script>
    document.getElementById("trigger").addEventListener("click", () => {
      document.getElementById("menu").classList.add("open");
    });
  </script>
</body>`);

function sequence(name: string, steps: Sequence["steps"], viewport?: Sequence["viewport"]): string {
  const file = join(dir, `${name}.json`);
  writeFileSync(file, JSON.stringify({ ...(viewport ? { viewport } : {}), steps }, null, 2));
  return file;
}

/** Strip the whole SGR sequence, ESC included — a bare `/\[[0-9;]*m/` leaves the ESC byte. */
const plain = (s: string) => s.replace(/\u001b\[[0-9;]*m/g, "");

describe("runInteract", () => {
  it("captures one screenshot per snapshot step and diffs consecutive pairs", async () => {
    const seq = sequence("happy", [
      { action: "snapshot", name: "default" },
      { action: "click", selector: ".dropdown-trigger" },
      { action: "snapshot", name: "menu-open" },
      { action: "fill", selector: "input[name=email]", value: "a@example.com" },
      { action: "snapshot", name: "filled" },
    ]);
    const report = await runInteract({
      source: fixture,
      sequencePath: seq,
      outputDir: join(dir, "out-happy"),
    });
    assert.deepEqual(report.snapshots.map((s) => s.name), ["default", "menu-open", "filled"]);
    // Three snapshots, two transitions: a transition is a pair, not a step.
    assert.deepEqual(report.transitions.map((t) => `${t.from}→${t.to}`), ["default→menu-open", "menu-open→filled"]);
    for (const s of report.snapshots) assert.match(s.screenshotPath, /\.png$/);
    assert.equal(new Set(report.snapshots.map((s) => s.screenshotPath)).size, 3);
    assert.deepEqual(report.stepFailures, [], "every step should have run");

    // Each transition carries the actions that produced it, which is the only way
    // to read a delta as evidence about a particular action.
    assert.deepEqual(report.transitions[0]!.actions.map((a) => a.action), ["click"]);
    assert.deepEqual(report.transitions[1]!.actions.map((a) => a.action), ["fill"]);

    // Both actions are visible ones, so both deltas must be non-zero — a run where
    // the sequence never reached the page would report two zeroes and look tidy.
    assert.ok(report.transitions[0]!.diffRatio > 0.01, `opening a 180px menu should paint: ${report.transitions[0]!.diffRatio}`);
    assert.ok(report.transitions[1]!.diffRatio > 0, `filling an input should paint: ${report.transitions[1]!.diffRatio}`);
    assert.ok(report.transitions[0]!.totalPixels > 0);
  });

  it("records a step that failed instead of only printing it", async () => {
    // The failure used to go to stdout and nowhere else, leaving a transition with a
    // near-zero delta whose own report text explains it as "usually a sign the
    // selector didn't match" — it had the reason and dropped it.
    const seq = sequence("bad-selector", [
      { action: "snapshot", name: "before" },
      { action: "click", selector: ".dropdown-triger" },
      { action: "snapshot", name: "after" },
    ]);
    const report = await runInteract({
      source: fixture,
      sequencePath: seq,
      outputDir: join(dir, "out-bad"),
    });
    assert.equal(report.stepFailures.length, 1);
    const failure = report.stepFailures[0]!;
    assert.equal(failure.stepIndex, 1, "the index is into the sequence's own steps");
    assert.equal(failure.action.action, "click");
    assert.ok(failure.message.length > 0);
    assert.ok(!failure.message.includes("\n"), "one line — the stack is noise in a report");
    // The run continued past the failure, so the second snapshot still exists.
    assert.equal(report.snapshots.length, 2);
    // And the transition is dead, which is now explainable rather than mysterious.
    assert.equal(report.transitions[0]!.diffRatio, 0);

    const md = readFileSync(report.reportPath, "utf-8");
    assert.match(md, /Steps that failed/);
    assert.match(md, /step 1/);
  });

  it("offers healer suggestions for a near-miss selector", async () => {
    // `.dropdown-triger` is one character off a real class, which is the case the
    // healer exists for. It is best-effort, so this asserts the plumbing rather than
    // a particular ranking: when suggestions come back at all, they are shaped.
    const seq = sequence("heal", [
      { action: "snapshot", name: "before" },
      { action: "click", selector: ".dropdown-triger" },
      { action: "snapshot", name: "after" },
    ]);
    const report = await runInteract({
      source: fixture,
      sequencePath: seq,
      outputDir: join(dir, "out-heal"),
    });
    for (const c of report.stepFailures[0]!.suggestions ?? []) {
      assert.ok(c.selector.length > 0);
      assert.ok(c.confidence >= 0 && c.confidence <= 1, `confidence out of range: ${c.confidence}`);
      assert.equal(typeof c.text, "string");
    }
  });

  it("reports a step that ran and changed nothing as a zero delta, not a failure", async () => {
    // The two must stay distinguishable: the selector matches and the step succeeds,
    // it just has no visible effect. Collapsing this into stepFailures would make a
    // working sequence look broken.
    //
    // `blur` on an input that was never focused: the selector matches, `el.blur()`
    // runs, nothing paints. Two things I reached for first and rejected — `hover`
    // paints 0.25% of UA hover styling on the button's own box (not a bug here the
    // way it was in `explore`: an interact sequence is a script, and the pointer it
    // leaves somewhere is part of the state the script built), and `waitForSelector`
    // is deliberately excluded from the dead calculation, since a wait is not
    // supposed to paint.
    const seq = sequence("noop", [
      { action: "snapshot", name: "before" },
      { action: "blur", selector: "input[name=email]" },
      { action: "snapshot", name: "after" },
    ]);
    const report = await runInteract({
      source: fixture,
      sequencePath: seq,
      outputDir: join(dir, "out-noop"),
    });
    assert.deepEqual(report.stepFailures, []);
    const md = readFileSync(report.reportPath, "utf-8");
    assert.doesNotMatch(md, /Steps that failed/);
    assert.match(md, /dead/, "a zero-delta transition is still flagged in the table");
  });

  it("drives the whole action vocabulary without throwing", async () => {
    // Every action shares one `executeStep` switch, and a missing case is a silent
    // no-op rather than a type error only because the union is exhaustive — worth
    // one pass over all of them.
    const seq = sequence("vocab", [
      { action: "snapshot", name: "start" },
      { action: "hover", selector: ".btn-primary" },
      { action: "focus", selector: "input[name=email]" },
      { action: "type", selector: "input[name=email]", text: "hello" },
      { action: "fill", selector: "input[name=email]", value: "replaced@example.com" },
      { action: "press", selector: "input[name=email]", key: "Tab" },
      { action: "select", selector: "select[name=plan]", value: "pro" },
      { action: "blur", selector: "input[name=email]" },
      { action: "waitForSelector", selector: ".btn-primary" },
      { action: "wait", ms: 20 },
      { action: "scroll", y: 300 },
      { action: "press", key: "Escape" },
      { action: "click", selector: ".dropdown-trigger" },
      { action: "snapshot", name: "end" },
    ], { width: 900, height: 600 });
    const report = await runInteract({
      source: fixture,
      sequencePath: seq,
      outputDir: join(dir, "out-vocab"),
    });
    assert.deepEqual(report.stepFailures, [], `an action failed: ${JSON.stringify(report.stepFailures)}`);
    assert.deepEqual(report.viewport, { width: 900, height: 600 }, "the sequence declares the viewport");
    assert.equal(report.transitions.length, 1);
    assert.equal(report.transitions[0]!.actions.length, 12, "every non-snapshot step is attributed");
    assert.ok(report.transitions[0]!.diffRatio > 0, "scrolling 300px alone changes the page");
  });

  it("refuses a sequence with nothing to snapshot", async () => {
    const seq = sequence("no-snapshot", [{ action: "click", selector: ".btn-primary" }]);
    await assert.rejects(
      () => runInteract({ source: fixture, sequencePath: seq, outputDir: join(dir, "out-nosnap") }),
      /at least one `snapshot` step/,
    );
  });

  it("accepts a single snapshot and says there was nothing to diff", async () => {
    // Not an error: one snapshot is a legitimate capture, it just yields no
    // transition. Reporting zero transitions as zero drift would be a false green.
    const seq = sequence("one-snapshot", [{ action: "snapshot", name: "only" }]);
    const report = await runInteract({
      source: fixture,
      sequencePath: seq,
      outputDir: join(dir, "out-one"),
    });
    assert.equal(report.snapshots.length, 1);
    assert.deepEqual(report.transitions, []);
    assert.match(readFileSync(report.reportPath, "utf-8"), /only one snapshot/);
  });

  it("collects heal-all findings only when asked", async () => {
    const steps: Sequence["steps"] = [
      { action: "snapshot", name: "before" },
      { action: "click", selector: ".btn-primary" },
      { action: "snapshot", name: "after" },
    ];
    const off = await runInteract({
      source: fixture,
      sequencePath: sequence("heal-off", steps),
      outputDir: join(dir, "out-heal-off"),
    });
    assert.equal(off.healAllFindings, undefined, "absent, not empty — the probe never ran");

    const on = await runInteract({
      source: fixture,
      sequencePath: sequence("heal-on", steps),
      outputDir: join(dir, "out-heal-on"),
      healAll: true,
    });
    assert.ok(Array.isArray(on.healAllFindings), "present even when it found nothing");
    for (const f of on.healAllFindings!) {
      // `.btn-primary` and `.btn-secondary` are exactly the sibling-overlap case the
      // calibration exists for, so a finding here must carry its tier — a bare "did
      // you mean" on a weak match was the 2026-05-15 dogfood's noise complaint.
      assert.ok(["strong", "weak"].includes(f.tier), `unclassified tier: ${f.tier}`);
      assert.notEqual(f.suggestion.selector, f.originalSelector, "suggesting the input back is not a suggestion");
      assert.equal(f.originalSelector, ".btn-primary");
    }
  });

  it("writes the report where asked and names every snapshot in it", async () => {
    const reportPath = join(dir, "interact-custom.md");
    const report = await runInteract({
      source: fixture,
      sequencePath: sequence("report", [
        { action: "snapshot", name: "a" },
        { action: "click", selector: ".dropdown-trigger" },
        { action: "snapshot", name: "b" },
      ]),
      outputDir: join(dir, "out-report"),
      reportPath,
    });
    assert.equal(report.reportPath, reportPath);
    const md = readFileSync(reportPath, "utf-8");
    assert.match(md, /Interaction-sequence report/);
    assert.match(md, /\*\*a\*\* → \*\*b\*\*/);
    assert.match(md, /click/);
  });
});

describe("formatInteractReport", () => {
  it("names each transition, its delta and any failed step", async () => {
    const report = await runInteract({
      source: fixture,
      sequencePath: sequence("format", [
        { action: "snapshot", name: "before" },
        { action: "click", selector: ".dropdown-triger" },
        { action: "snapshot", name: "mid" },
        { action: "click", selector: ".dropdown-trigger" },
        { action: "snapshot", name: "after" },
      ]),
      outputDir: join(dir, "out-format"),
    });
    const text = plain(formatInteractReport(report, { sequencePath: "seq.json" }));
    assert.match(text, /vlmkit inspect interact/);
    assert.match(text, /sequence: seq\.json/);
    assert.match(text, /captured 3 snapshot\(s\), 2 transition\(s\)/);
    assert.match(text, /step 1 failed \(click `\.dropdown-triger`\)/);
    assert.match(text, /before → mid/);
    assert.match(text, /mid → after/);
  });

  it("prints the heal-all tally only under --heal-all, with the denominator it was given", async () => {
    const report = await runInteract({
      source: fixture,
      sequencePath: sequence("format-heal", [
        { action: "snapshot", name: "before" },
        { action: "click", selector: ".btn-primary" },
        { action: "snapshot", name: "after" },
      ]),
      outputDir: join(dir, "out-format-heal"),
      healAll: true,
    });
    assert.doesNotMatch(plain(formatInteractReport(report)), /heal-all:/);
    assert.match(
      plain(formatInteractReport(report, { healAll: true, selectorStepCount: 1 })),
      /heal-all: \d+ strong \+ \d+ weak suggestion\(s\) across 1 selector step\(s\)/,
    );
  });
});
