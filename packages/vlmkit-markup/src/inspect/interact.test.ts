import assert from "node:assert/strict";
import { describe, it } from "vite-plus/test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PNG } from "pngjs";
import { formatInteractReport, runInteract, runInteractCli, type Sequence } from "./interact.ts";

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
writeFileSync(
  fixture,
  `<!doctype html><meta charset="utf-8"><title>interact</title>
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
</body>`,
);

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
    assert.deepEqual(
      report.snapshots.map((s) => s.name),
      ["default", "menu-open", "filled"],
    );
    // Three snapshots, two transitions: a transition is a pair, not a step.
    assert.deepEqual(
      report.transitions.map((t) => `${t.from}→${t.to}`),
      ["default→menu-open", "menu-open→filled"],
    );
    for (const s of report.snapshots) assert.match(s.screenshotPath, /\.png$/);
    assert.equal(new Set(report.snapshots.map((s) => s.screenshotPath)).size, 3);
    assert.deepEqual(report.stepFailures, [], "every step should have run");

    // Each transition carries the actions that produced it, which is the only way
    // to read a delta as evidence about a particular action.
    assert.deepEqual(
      report.transitions[0]!.actions.map((a) => a.action),
      ["click"],
    );
    assert.deepEqual(
      report.transitions[1]!.actions.map((a) => a.action),
      ["fill"],
    );

    // Both actions are visible ones, so both deltas must be non-zero — a run where
    // the sequence never reached the page would report two zeroes and look tidy.
    assert.ok(
      report.transitions[0]!.diffRatio > 0.01,
      `opening a 180px menu should paint: ${report.transitions[0]!.diffRatio}`,
    );
    assert.ok(
      report.transitions[1]!.diffRatio > 0,
      `filling an input should paint: ${report.transitions[1]!.diffRatio}`,
    );
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
    const seq = sequence(
      "vocab",
      [
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
      ],
      { width: 900, height: 600 },
    );
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
      /at least one `snapshot` or `frames` step/,
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

describe("runInteractCli", () => {
  it("exits 0 for --help and 1 for missing arguments", async () => {
    // Both printed the same usage and both returned 1, so
    // `vlmkit inspect interact --help` failed in any `&&` chain or CI help check. A
    // request that was satisfied is not an error.
    assert.equal(await runInteractCli(["--help"]), 0);
    assert.equal(await runInteractCli(["-h"]), 0);
    assert.equal(await runInteractCli([]), 1, "no source and no sequence is an error");
    assert.equal(await runInteractCli([fixture]), 1, "a source with no --sequence is an error");
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

/**
 * `frames` steps: the motion an action starts, as a `vlmkit-frames/1` sequence. The fixture's
 * drawer closes with a 220ms linear transform transition and hides itself on `transitionend`
 * (the docs D17 shape); a timer shows a toast 250ms after the key, fading in over 100ms.
 */
describe("runInteract frames steps", () => {
  const drawer = join(dir, "drawer.html");
  writeFileSync(
    drawer,
    `<!doctype html><meta charset="utf-8"><style>
  body { margin: 0; background: #fff; }
  #drawer { position: fixed; left: 0; top: 0; width: 200px; height: 100%; background: #2255cc; transition: transform 220ms linear; }
  #drawer.closed { transform: translateX(-200px); }
  #marker { position: fixed; left: 400px; top: 20px; width: 60px; height: 60px; background: #e0a000; display: none; }
  #toast { position: fixed; left: 400px; top: 200px; width: 120px; height: 40px; background: #119944; animation: pop 100ms linear 1 both; }
  @keyframes pop { from { opacity: 0; } to { opacity: 1; } }
</style>
<div id="drawer"></div><div id="marker"></div>
<script>
  const drawer = document.getElementById("drawer");
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    drawer.classList.add("closed");
    setTimeout(() => { const t = document.createElement("div"); t.id = "toast"; document.body.append(t); }, 250);
  });
  drawer.addEventListener("transitionend", () => { drawer.hidden = true; document.getElementById("marker").style.display = "block"; });
</script>`,
  );
  const viewport = { width: 640, height: 400 };
  const blueWidth = (file: string) => {
    const png = PNG.sync.read(readFileSync(file));
    let x = 0;
    while (x < png.width && png.data[(300 * png.width + x) * 4 + 2]! > 150 && png.data[(300 * png.width + x) * 4]! < 80)
      x++;
    return x;
  };
  const pixel = (file: string, x: number, y: number) => {
    const png = PNG.sync.read(readFileSync(file));
    const i = (y * png.width + x) * 4;
    return [png.data[i], png.data[i + 1], png.data[i + 2]];
  };

  it("seeks the transition an action started to each offset after it", async () => {
    const out = join(dir, "out-frames");
    const report = await runInteract({
      source: drawer,
      sequencePath: sequence(
        "frames",
        [
          { action: "snapshot", name: "open" },
          { action: "press", key: "Escape" },
          { action: "frames", name: "close", at: "0..400/50" },
          { action: "snapshot", name: "closed" },
        ],
        viewport,
      ),
      outputDir: out,
    });
    assert.equal(report.motion, "live");
    const [seq] = report.frameSequences;
    assert.equal(seq?.name, "close");
    assert.deepEqual(seq?.offsets, [0, 50, 100, 150, 200, 250, 300, 350, 400]);
    assert.deepEqual(seq?.action, { action: "press", key: "Escape" });
    // translateX(-200px * t / 220): the drawer's visible width is 200 - that, frame by frame —
    // to the pixel, give or take the antialiased edge. A frame one 60fps tick late is 15px off.
    const widths = seq!.files.slice(0, 5).map(blueWidth);
    [0, 50, 100, 150, 200].forEach((t, i) => {
      const expected = 200 - (200 * t) / 220;
      assert.ok(
        Math.abs(widths[i]! - expected) <= 1,
        `at ${t}ms: ${widths[i]}px visible, expected ${expected.toFixed(1)}`,
      );
    });
    // Seeking the paused transition past its end fires transitionend: the page's own handler ran.
    assert.deepEqual(pixel(seq!.files[4]!, 410, 30), [255, 255, 255], "no marker before the end");
    assert.deepEqual(pixel(seq!.files[5]!, 410, 30), [0xe0, 0xa0, 0x00], "transitionend has fired by 250ms");
    // The toast is the timer's, on the real clock: not there at 0, fully in by 400ms (its timer is
    // 250ms after the key and its fade 100ms; the 0ms frame is shot a few ms after the key).
    assert.deepEqual(pixel(seq!.files[8]!, 410, 210), [0x11, 0x99, 0x44]);
    assert.deepEqual(pixel(seq!.files[0]!, 410, 210), [255, 255, 255], "not before its timer");

    const manifest = JSON.parse(readFileSync(join(out, "close", "frames.json"), "utf8"));
    assert.equal(manifest.format, "vlmkit-frames/1");
    assert.equal(manifest.source.clock, "wall");
    assert.equal(manifest.source.step, "close");
    assert.equal(manifest.frames.length, 9);
    for (const f of manifest.frames) {
      assert.ok(f.shotMs >= f.atMs, `frame at ${f.atMs}ms shot at ${f.shotMs}ms: never before its offset`);
    }
    // The snapshots are the page at rest either side of the motion.
    assert.equal(blueWidth(report.snapshots[0]!.screenshotPath), 200);
    assert.equal(blueWidth(report.snapshots[1]!.screenshotPath), 0);
    const md = readFileSync(report.reportPath, "utf8");
    assert.match(md, /## Frame sequences/);
    assert.match(md, /\*\*close\*\* — 9 frame\(s\) at 0 \/ 50 \/ .* \/ 400ms after press "Escape"/);
    assert.match(plain(formatInteractReport(report)), /frames "close": 9 at 0\/50\/100/);
  });

  it("everyMs / forMs default to 50ms over 500ms, and a frames-only sequence is enough", async () => {
    const report = await runInteract({
      source: drawer,
      sequencePath: sequence(
        "frames-default",
        [
          { action: "press", key: "Escape" },
          { action: "frames", name: "close" },
        ],
        viewport,
      ),
      outputDir: join(dir, "out-frames-default"),
    });
    assert.equal(report.snapshots.length, 0);
    assert.equal(report.frameSequences[0]?.count, 11);
  });

  it("a sequence without frames steps still switches motion off", async () => {
    const report = await runInteract({
      source: drawer,
      sequencePath: sequence(
        "frames-none",
        [
          { action: "snapshot", name: "open" },
          { action: "press", key: "Escape" },
          { action: "snapshot", name: "closed" },
        ],
        viewport,
      ),
      outputDir: join(dir, "out-frames-none"),
    });
    assert.equal(report.motion, "disabled");
    assert.deepEqual(report.frameSequences, []);
    // `transition: none`: the class lands at once, no transitionend, so the drawer is moved, not hidden.
    assert.equal(blueWidth(report.snapshots[1]!.screenshotPath), 0);
  });

  it("checks frames steps before any browser starts", async () => {
    const run = (steps: Sequence["steps"]) =>
      runInteract({ source: drawer, sequencePath: sequence("frames-bad", steps), outputDir: join(dir, "out-bad") });
    const key = { action: "press", key: "x" } as const;
    await assert.rejects(run([key, { action: "frames", name: "" }]), /needs a "name"/);
    await assert.rejects(run([key, { action: "frames", name: "a", at: "0..1s", everyMs: 10 }]), /not both/);
    await assert.rejects(run([key, { action: "frames", name: "a", at: "0..1s" }]), /needs a step/);
    await assert.rejects(run([key, { action: "frames", name: "a", at: [] }]), /lists no offsets/);
    await assert.rejects(run([key, { action: "frames", name: "a", everyMs: 0 }]), /"everyMs" must be > 0/);
    const many = Array.from({ length: 1001 }, (_, i) => i);
    await assert.rejects(run([key, { action: "frames", name: "a", at: many }]), /more than 1000 offsets/);
    // One directory per name: case-folded, and never one the run writes anything else to.
    await assert.rejects(
      run([key, { action: "frames", name: "Open" }, key, { action: "frames", name: "open" }]),
      /already uses/,
    );
    await assert.rejects(
      run([{ action: "snapshot", name: "s" }, key, { action: "frames", name: "s.png" }]),
      /already uses/,
    );
    await assert.rejects(run([key, { action: "frames", name: "report.md" }]), /already uses/);
    for (const name of ["..", ".", "  "]) {
      await assert.rejects(run([key, { action: "frames", name }]), /names no directory|needs a "name"/, name);
    }
    // It records the action right before it.
    await assert.rejects(run([{ action: "frames", name: "a" }]), /records the action right before it/);
    await assert.rejects(
      run([
        { action: "snapshot", name: "s" },
        { action: "frames", name: "a" },
      ]),
      /is a snapshot step/,
    );
  });
});

/**
 * The page behaviours a `frames` step must not change, each from the round that reviewed the
 * first version (which held every animation from load and rested by setting `currentTime`).
 */
describe("runInteract with frames steps leaves the page's own motion logic working", () => {
  const page = (name: string, body: string) => {
    const file = join(dir, `${name}.html`);
    writeFileSync(file, `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#fff}</style>${body}`);
    return file;
  };
  const rgb = (file: string, x: number, y: number) => {
    const png = PNG.sync.read(readFileSync(file));
    const i = (y * png.width + x) * 4;
    return [png.data[i], png.data[i + 1], png.data[i + 2]];
  };
  const run = (source: string, name: string, steps: Sequence["steps"]) =>
    runInteract({
      source,
      sequencePath: sequence(name, steps, { width: 400, height: 200 }),
      outputDir: join(dir, `out-${name}`),
    });
  const tail: Sequence["steps"] = [
    { action: "press", key: "x" },
    { action: "frames", name: "f", at: [0] },
  ];

  it("a later action can use what an earlier action set moving", async () => {
    // A menu sliding in over 300ms holds the next click's target. Held from its first frame, the
    // click inside it timed out.
    const source = page(
      "menu",
      `<style>#m{position:fixed;left:0;top:40px;width:200px;height:100px;background:#2255cc;transform:translateX(-300px);transition:transform 300ms}
       #m.open{transform:none} #item{margin:20px}</style>
       <button id="op">menu</button><div id="m"><button id="item">item</button></div>
       <script>op.onclick=()=>m.classList.add("open"); item.onclick=()=>document.body.style.background="#ffcc00";</script>`,
    );
    const report = await run(source, "menu", [
      { action: "click", selector: "#op" },
      { action: "click", selector: "#item" },
      { action: "snapshot", name: "s" },
      ...tail,
    ]);
    assert.deepEqual(report.stepFailures, []);
    assert.deepEqual(rgb(report.snapshots[0]!.screenshotPath, 300, 180), [0xff, 0xcc, 0x00], "the click landed");
  });

  it("a Web Animation's finished promise resolves, at a snapshot and inside a frames window", async () => {
    // `el.animate(...).finished.then(hide)`: rested by a seek it stayed paused at its end, so the
    // dialog never closed.
    const source = page(
      "finished",
      `<style>#d{position:fixed;left:0;top:0;width:100px;height:100px;background:#00a000}</style>
       <div id="d"></div><button id="cl" style="position:fixed;left:200px;top:0">close</button>
       <script>cl.onclick=()=>d.animate([{opacity:1},{opacity:0}],200).finished.then(()=>d.hidden=true);</script>`,
    );
    const snap = await run(source, "finished-snap", [
      { action: "click", selector: "#cl" },
      { action: "snapshot", name: "s" },
      ...tail,
    ]);
    assert.deepEqual(rgb(snap.snapshots[0]!.screenshotPath, 50, 50), [255, 255, 255]);
    const frames = await run(source, "finished-frames", [
      { action: "click", selector: "#cl" },
      { action: "frames", name: "f", at: [0, 100, 300] },
    ]);
    const files = frames.frameSequences[0]!.files;
    assert.deepEqual(rgb(files[0]!, 50, 50), [0, 0xa0, 0], "opaque at 0");
    assert.deepEqual(rgb(files[2]!, 50, 50), [255, 255, 255], "hidden once past its end, by the page's own handler");
  });

  it("an animation the page cancelled stays cancelled", async () => {
    const source = page(
      "cancel",
      `<style>#b{width:100px;height:100px;background:#0000ff}</style><div id="b"></div>
       <button id="a">a</button><button id="c">c</button>
       <script>let an; a.onclick=()=>{an=b.animate([{background:"red"}],{duration:200,fill:"forwards"})}; c.onclick=()=>an.cancel();</script>`,
    );
    const report = await run(source, "cancel", [
      { action: "click", selector: "#a" },
      { action: "snapshot", name: "s1" },
      { action: "click", selector: "#c" },
      { action: "snapshot", name: "s2" },
      ...tail,
    ]);
    assert.deepEqual(rgb(report.snapshots[0]!.screenshotPath, 50, 50), [255, 0, 0]);
    assert.deepEqual(rgb(report.snapshots[1]!.screenshotPath, 50, 50), [0, 0, 255], "not revived by the next snapshot");
  });

  it("a stage the page starts on the previous one's animationend is finished before the snapshot", async () => {
    const source = page(
      "chain",
      `<style>#k{width:100px;height:100px;background:#0000ff}
       @keyframes mv{to{margin-left:200px}} @keyframes rd{to{background:#ff0000}}
       .s1{animation:mv 300ms forwards} .s1.s2{animation:mv 300ms forwards, rd 300ms forwards}</style>
       <div id="k"></div><button id="go">go</button>
       <script>go.onclick=()=>k.classList.add("s1"); k.addEventListener("animationend",(e)=>{if(e.animationName==="mv")k.classList.add("s2")});</script>`,
    );
    const report = await run(source, "chain", [
      { action: "click", selector: "#go" },
      { action: "snapshot", name: "s1" },
      { action: "snapshot", name: "s2" },
      ...tail,
    ]);
    assert.deepEqual(rgb(report.snapshots[0]!.screenshotPath, 250, 50), [255, 0, 0], "both stages at rest");
    assert.equal(
      report.transitions[0]!.diffPixels,
      0,
      "two snapshots with no action between them are the same picture",
    );
  });

  it("an animation the page itself paused is left where the page put it", async () => {
    const source = page(
      "paused",
      `<style>@keyframes grow{to{width:200px}} #r{height:50px;width:0;background:#ff0000;animation:grow 1s linear forwards paused}</style><div id="r"></div>`,
    );
    const report = await run(source, "paused", [{ action: "snapshot", name: "s" }, ...tail]);
    assert.deepEqual(rgb(report.snapshots[0]!.screenshotPath, 100, 25), [255, 255, 255]);
  });

  it("an Animation the page replays is held and seeked like a new one", async () => {
    const source = page(
      "replay",
      `<style>#p{position:fixed;left:0;top:0;width:200px;height:100px;background:#2255cc}</style><div id="p"></div><button id="t" style="position:fixed;top:150px">t</button>
       <script>const a=p.animate([{transform:"translateX(-200px)"},{transform:"none"}],{duration:400,fill:"both"}); a.pause();
       t.onclick=()=>{a.currentTime=0;a.play();};</script>`,
    );
    const report = await run(source, "replay", [
      { action: "snapshot", name: "load" },
      { action: "click", selector: "#t" },
      { action: "frames", name: "open", at: "0..400/100" },
    ]);
    const seq = report.frameSequences[0]!;
    const width = (file: string) => {
      const png = PNG.sync.read(readFileSync(file));
      let x = 0;
      while (x < png.width && png.data[(50 * png.width + x) * 4]! < 80) x++;
      return x;
    };
    seq.files.forEach((f, i) => assert.ok(Math.abs(width(f) - 50 * i) <= 1, `at ${100 * i}ms: ${width(f)}px`));
    assert.equal(seq.unstable, 0);
  });

  it("an animation a timer starts with a delay sits at the real time it began, the delay counted once", async () => {
    const source = page(
      "delay",
      `<style>@keyframes sl{to{margin-left:400px}} #q{width:20px;height:20px;background:#ff0000} #q.go{animation:sl 400ms linear 300ms forwards}</style>
       <div id="q"></div><script>document.addEventListener("keydown",()=>setTimeout(()=>q.classList.add("go"),100));</script>`,
    );
    const report = await run(source, "delay", [
      { action: "press", key: "Escape" },
      { action: "frames", name: "d", at: [0, 650, 1000] },
    ]);
    const left = (file: string) => {
      const png = PNG.sync.read(readFileSync(file));
      let x = 0;
      while (
        x < png.width &&
        !(png.data[(10 * png.width + x) * 4]! > 200 && png.data[(10 * png.width + x) * 4 + 1]! < 80)
      )
        x++;
      return x;
    };
    const [, mid, end] = report.frameSequences[0]!.files.map(left);
    // Begun ~70-100ms after offset 0 (the timer is real time), so 650ms is ~250-280ms into the slide.
    assert.ok(mid! >= 200 && mid! <= 340, `650ms: ${mid}px`);
    assert.equal(end, 400, "finished by 1000ms");
  });

  it("survives a navigation", async () => {
    const { createServer } = await import("node:http");
    const pages: Record<string, string> = {
      "/a.html": `<!doctype html><a id="go" href="/b.html">b</a>`,
      "/b.html": `<!doctype html><style>@keyframes f{from{opacity:0}} p{animation:f 200ms}</style><p>b</p><button id="x">x</button>`,
    };
    const server = createServer((req, res) => {
      res.writeHead(200, { "content-type": "text/html" });
      res.end(pages[req.url ?? ""] ?? "");
    });
    await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
    try {
      const { port } = server.address() as { port: number };
      const report = await runInteract({
        source: `http://127.0.0.1:${port}/a.html`,
        sequencePath: sequence("nav", [
          { action: "snapshot", name: "a" },
          { action: "click", selector: "#go" },
          { action: "waitForSelector", selector: "p" },
          { action: "snapshot", name: "b" },
          { action: "click", selector: "#x" },
          { action: "frames", name: "f", at: [0, 100] },
        ]),
        outputDir: join(dir, "out-nav"),
      });
      assert.deepEqual(report.stepFailures, []);
      assert.equal(report.snapshots.length, 2);
      assert.equal(report.frameSequences[0]?.count, 2);
    } finally {
      server.close();
    }
  });
});

/** The second review round: shadow roots, scroll timelines, rates, loops, navigations. */
describe("runInteract frames steps on harder pages", () => {
  const page = (name: string, body: string) => {
    const file = join(dir, `${name}.html`);
    writeFileSync(file, `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#fff}</style>${body}`);
    return file;
  };
  const rgb = (file: string, x: number, y: number) => {
    const png = PNG.sync.read(readFileSync(file));
    const i = (y * png.width + x) * 4;
    return [png.data[i], png.data[i + 1], png.data[i + 2]];
  };
  /** Width of the run of `color`-ish pixels from x=0 on row y. */
  const runWidth = (file: string, y: number, isColor: (r: number, g: number, b: number) => boolean) => {
    const png = PNG.sync.read(readFileSync(file));
    let x = 0;
    while (
      x < png.width &&
      isColor(
        png.data[(y * png.width + x) * 4]!,
        png.data[(y * png.width + x) * 4 + 1]!,
        png.data[(y * png.width + x) * 4 + 2]!,
      )
    )
      x++;
    return x;
  };
  const blue = (r: number, _g: number, b: number) => r < 80 && b > 150;
  const run = (source: string, name: string, steps: Sequence["steps"], viewport = { width: 500, height: 200 }) =>
    runInteract({ source, sequencePath: sequence(name, steps, viewport), outputDir: join(dir, `out2-${name}`) });
  const tail: Sequence["steps"] = [
    { action: "press", key: "x" },
    { action: "frames", name: "f", at: [0] },
  ];
  const near = (got: number[], want: number[], tolerance = 2) =>
    assert.ok(
      got.length === want.length && got.every((g, i) => Math.abs(g - want[i]!) <= tolerance),
      `got ${got.join(",")}, want ${want.join(",")}`,
    );

  it("a component's own el.animate() in a shadow root is finished, and its finished handler runs", async () => {
    const source = page(
      "shadow-waapi",
      `<x-panel></x-panel><script>
       customElements.define("x-panel", class extends HTMLElement { constructor() { super();
         const root = this.attachShadow({ mode: "open" });
         root.innerHTML = '<button id="c" style="position:fixed;left:400px;top:0">c</button><div id="p" style="width:300px;height:100px;background:#2255cc"></div>';
         const p = root.getElementById("p");
         root.getElementById("c").onclick = () => p.animate([{ width: "300px" }, { width: "0px" }], { duration: 400 })
           .finished.then(() => { p.hidden = true; document.body.style.background = "#ffcc00"; });
       } });</script>`,
    );
    const report = await run(source, "shadow-waapi", [
      { action: "click", selector: "x-panel >> #c" },
      { action: "frames", name: "f", at: [0, 100] },
      { action: "wait", ms: 200 },
      { action: "snapshot", name: "s" },
    ]);
    assert.deepEqual(report.stepFailures, []);
    assert.deepEqual(rgb(report.snapshots[0]!.screenshotPath, 50, 50), [0xff, 0xcc, 0x00]);
  });

  it("a CSS transition in a shadow root is held and seeked", async () => {
    const source = page(
      "shadow-css",
      `<x-drawer></x-drawer><script>
       customElements.define("x-drawer", class extends HTMLElement { constructor() { super();
         const root = this.attachShadow({ mode: "open" });
         root.innerHTML = '<style>#d{width:0;height:100px;background:#2255cc;transition:width 400ms linear}#d.open{width:400px}</style><button id="o" style="position:fixed;left:450px;top:150px">o</button><div id="d"></div>';
         root.getElementById("o").onclick = () => root.getElementById("d").classList.add("open");
       } });</script>`,
    );
    const report = await run(source, "shadow-css", [
      { action: "click", selector: "x-drawer >> #o" },
      { action: "frames", name: "f", at: "0..400/100" },
    ]);
    const seq = report.frameSequences[0]!;
    near(
      seq.files.map((f) => runWidth(f, 50, blue)),
      [0, 100, 200, 300, 400],
    );
    assert.equal(seq.unstable, 0);
  });

  it("a scroll-driven animation is not paused, so it follows the scroll", async () => {
    const source = page(
      "scroll-timeline",
      `<style>@keyframes grow{to{width:200px}} #bar{position:fixed;top:0;left:0;height:20px;width:0;background:#00a000;animation:grow linear both;animation-timeline:scroll(root)}</style>
       <div id="bar"></div><div style="height:2000px"></div>`,
    );
    // A snapshot before the scroll settles the page; pausing the bar there froze it at 0.
    const report = await run(source, "scroll-timeline", [
      { action: "snapshot", name: "top" },
      { action: "scroll", y: 1800 },
      { action: "snapshot", name: "s" },
      ...tail,
    ]);
    assert.deepEqual(rgb(report.snapshots[1]!.screenshotPath, 150, 10), [0, 0xa0, 0], "the bar is full at the bottom");
  });

  it("reverse() and playbackRate are positioned at the animation's own rate", async () => {
    const source = page(
      "rates",
      `<div id="p" style="width:0;height:100px;background:#2255cc"></div>
       <button id="op" style="position:fixed;left:450px;top:120px">o</button><button id="cl" style="position:fixed;left:450px;top:150px">c</button><button id="fast" style="position:fixed;left:400px;top:150px">f</button>
       <script>let a; op.onclick=()=>{a=p.animate([{width:"0px"},{width:"200px"}],{duration:400,fill:"both"})};
       cl.onclick=()=>a.reverse(); fast.onclick=()=>{const b=p.animate([{width:"0px"},{width:"200px"}],{duration:400,fill:"both"}); b.playbackRate=2;};</script>`,
    );
    const reversed = await run(source, "rates-reverse", [
      { action: "click", selector: "#op" },
      { action: "snapshot", name: "open" },
      { action: "click", selector: "#cl" },
      { action: "frames", name: "close", at: "0..400/100" },
    ]);
    near(
      reversed.frameSequences[0]!.files.map((f) => runWidth(f, 50, blue)),
      [200, 150, 100, 50, 0],
    );
    const fast = await run(source, "rates-fast", [
      { action: "click", selector: "#fast" },
      { action: "frames", name: "f", at: "0..400/100" },
    ]);
    near(
      fast.frameSequences[0]!.files.map((f) => runWidth(f, 50, blue)),
      [0, 100, 200, 200, 200],
    );
  });

  it("an earlier click on a target that bounces forever still lands", async () => {
    const source = page(
      "bounce",
      `<style>@keyframes b{0%,100%{transform:translateY(0)}50%{transform:translateY(-25px)}} #cta{margin:60px;animation:b 1s infinite}
       #panel{display:none;width:100px;height:40px;background:#00a000} #panel.on{display:block}</style>
       <button id="cta">go</button><div id="panel"></div><button id="k">k</button>
       <script>cta.onclick=()=>panel.classList.add("on")</script>`,
    );
    const report = await run(source, "bounce", [
      { action: "click", selector: "#cta" },
      { action: "snapshot", name: "s" },
      { action: "click", selector: "#k" },
      { action: "frames", name: "f", at: [0] },
    ]);
    assert.deepEqual(report.stepFailures, []);
    assert.deepEqual(rgb(report.snapshots[0]!.screenshotPath, 50, 160), [0, 0xa0, 0], "the panel the click opens");
  });

  it("an animation the recorded action creates and pauses at once is the page's: not seeked, not finished", async () => {
    const source = page(
      "scrubber",
      `<div id="p" style="width:400px;height:100px;background:#2255cc"></div><button id="mk" style="position:fixed;left:450px;top:150px">m</button>
       <script>mk.onclick=()=>{const a=p.animate([{width:"0px"},{width:"400px"}],{duration:400,fill:"both"}); a.pause(); a.currentTime=100;}</script>`,
    );
    const report = await run(source, "scrubber", [
      { action: "click", selector: "#mk" },
      { action: "frames", name: "f", at: "0..400/200" },
      { action: "snapshot", name: "s" },
    ]);
    near(
      report.frameSequences[0]!.files.map((f) => runWidth(f, 50, blue)),
      [100, 100, 100],
    );
    near([runWidth(report.snapshots[0]!.screenshotPath, 50, blue)], [100]);
  });

  it("a stage the page chains on a held animation's end starts at that end", async () => {
    const source = page(
      "chain-held",
      `<style>@keyframes a1{to{opacity:.5}} @keyframes sl{from{width:0}to{width:400px}}
       #k{width:0;height:100px;background:#2255cc} #k.s1{width:0;animation:a1 250ms linear forwards} #k.s2{animation:sl 400ms linear forwards}</style>
       <div id="k"></div><button id="go" style="position:fixed;left:450px;top:150px">g</button>
       <script>go.onclick=()=>k.classList.add("s1"); k.addEventListener("animationend",(e)=>{if(e.animationName==="a1"){k.classList.remove("s1");k.classList.add("s2")}});</script>`,
    );
    const report = await run(source, "chain-held", [
      { action: "click", selector: "#go" },
      { action: "frames", name: "f", at: [300, 400, 500, 600] },
    ]);
    // Stage two starts at 250ms: 50 / 150 / 250 / 350ms into its 400ms slide.
    near(
      report.frameSequences[0]!.files.map((f) => runWidth(f, 50, blue)),
      [50, 150, 250, 350],
      3,
    );
  });

  it("says so when the page cancels or retargets a held animation mid-window", async () => {
    const source = page(
      "retarget",
      `<style>#t{width:0;height:100px;background:#2255cc;transition:width 400ms linear} #t.on{width:400px}</style>
       <div id="t"></div><button id="o" style="position:fixed;left:450px;top:150px">o</button>
       <script>o.onclick=()=>{t.classList.add("on"); setTimeout(()=>t.classList.remove("on"),200)}</script>`,
    );
    const report = await run(source, "retarget", [
      { action: "click", selector: "#o" },
      { action: "frames", name: "f", at: "0..600/100" },
    ]);
    assert.ok(report.frameSequences[0]!.cancelled >= 1, "the retargeted transition is counted");
    assert.match(readFileSync(report.reportPath, "utf8"), /cancelled or replaced by the page mid-window/);
  });

  it("a loop that restarts itself from its own end is paused at its start for a snapshot", async () => {
    const source = page(
      "loop",
      `<div id="p" style="height:100px;background:#2255cc"></div>
       <script>const a=p.animate([{width:"400px"},{width:"0px"}],{duration:2000}); a.onfinish=()=>a.play();</script>`,
    );
    const report = await run(source, "loop", [
      { action: "snapshot", name: "s1" },
      { action: "snapshot", name: "s2" },
      ...tail,
    ]);
    near([runWidth(report.snapshots[0]!.screenshotPath, 50, blue)], [400]);
    assert.equal(report.transitions[0]!.diffPixels, 0);
  });

  it("a frames-only sequence's report does not claim snapshots or visible change", async () => {
    const report = await run(page("nothing", "<p>x</p>"), "frames-only-report", [
      { action: "click", selector: "#nope" },
      { action: "frames", name: "f", at: [0] },
    ]);
    const md = readFileSync(report.reportPath, "utf8");
    assert.doesNotMatch(md, /only one snapshot|Every action produced visible change/);
    assert.match(md, /No snapshot steps/);
  });

  describe("navigations", () => {
    const pages: Record<string, string> = {
      "/a.html": `<!doctype html><body style="margin:0"><a id="link" href="/b.html">b</a>
        <button id="later" onclick="setTimeout(()=>location.href='/b.html',120)">later</button></body>`,
      "/b.html": `<!doctype html><style>body{margin:0}@keyframes in{from{width:0}to{width:400px}} #e{height:100px;background:#2255cc;width:400px;animation:in 400ms linear}</style><div id="e"></div><button id="x">x</button>`,
    };
    const serve = async () => {
      const { createServer } = await import("node:http");
      const server = createServer((req, res) => {
        // b.html arrives 150ms late, so a navigation lands in the middle of whatever runs.
        setTimeout(
          () => {
            res.writeHead(200, { "content-type": "text/html" });
            res.end(pages[req.url ?? ""] ?? "");
          },
          req.url === "/b.html" ? 150 : 0,
        );
      });
      await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
      return {
        server,
        url: (path: string) => `http://127.0.0.1:${(server.address() as { port: number }).port}${path}`,
      };
    };

    it("a navigation in the middle of a frames window neither aborts the run nor bends its clock", async () => {
      const { server, url } = await serve();
      try {
        const report = await runInteract({
          source: url("/a.html"),
          sequencePath: sequence("nav-mid", [
            { action: "click", selector: "#later" },
            { action: "frames", name: "f", at: "0..600/50" },
            { action: "snapshot", name: "after" },
          ]),
          outputDir: join(dir, "out2-nav-mid"),
        });
        const seq = report.frameSequences[0]!;
        assert.equal(seq.count, 13);
        assert.notEqual(seq.navigatedAtMs, undefined);
        const manifest = JSON.parse(readFileSync(seq.manifest, "utf8"));
        for (const f of manifest.frames) assert.ok(f.shotMs >= f.atMs, `frame at ${f.atMs}ms shot at ${f.shotMs}ms`);
        assert.equal(report.snapshots.length, 1);
      } finally {
        server.close();
      }
    });

    it("the next page's entrance after a recorded link click is held, on the same clock", async () => {
      const { server, url } = await serve();
      try {
        const report = await runInteract({
          source: url("/a.html"),
          sequencePath: sequence("nav-link", [
            { action: "click", selector: "#link" },
            { action: "frames", name: "f", at: "0..800/100" },
          ]),
          outputDir: join(dir, "out2-nav-link"),
        });
        const seq = report.frameSequences[0]!;
        assert.equal(seq.navigatedAtMs, 0, "the action itself navigated");
        assert.equal(seq.unstable, 0, "held, not running on the real clock");
        const widths = seq.files.map((f) => runWidth(f, 50, blue));
        assert.ok(
          widths.every((w, i) => i === 0 || w >= widths[i - 1]!),
          `never backwards: ${widths.join(",")}`,
        );
        assert.equal(widths.at(-1), 400);
        assert.ok(
          widths.some((w) => w > 0 && w < 400),
          `the entrance is caught mid-way: ${widths.join(",")}`,
        );
      } finally {
        server.close();
      }
    });
  });
});
