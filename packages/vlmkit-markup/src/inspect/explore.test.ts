import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { formatExploreReport, runExplore } from "./explore.ts";

/**
 * `inspect explore` end to end, in-process.
 *
 * The gate reads the *page's* declaration of what is interactive — a
 * `window.__vrtActions` array or `data-vrt-action` attributes — then for each
 * one: snapshot, invoke, snapshot, diff. So the fixtures below have to declare
 * actions, and they have to declare a spread of them: one that paints, one that
 * is wired but does nothing, one that throws. A page with only working actions
 * cannot tell a real run from one that reported every action as fine.
 *
 * Note what this test does NOT do: set an exit code. `runExplore` used to assign
 * `process.exitCode = 1` under `--strict`, which in a vitest worker fails the
 * whole file rather than the assertion — the defect that writing this found.
 */

const dir = mkdtempSync(join(tmpdir(), "vlmkit-explore-"));

function page(name: string, body: string): string {
  const file = join(dir, `${name}.html`);
  writeFileSync(file, `<!doctype html><meta charset="utf-8"><title>${name}</title>
<style>
  body { margin: 0; font: 16px sans-serif; background: #fff; color: #111; }
  .panel { display: none; height: 200px; background: #2d6cdf; color: #fff; padding: 20px; }
  .panel.open { display: block; }
  button { font: inherit; padding: 8px 16px; margin: 12px; }
  .plain { display: inline-block; padding: 8px 16px; margin: 12px; }
</style>${body}`);
  return file;
}

/** Both declaration mechanisms, and three outcomes across them. */
const declared = page("declared", `
<body>
  <button data-vrt-action="open-panel" id="trigger">Open</button>
  <span class="plain" data-vrt-action="do-nothing">Inert</span>
  <button data-vrt-action="inert-button">Inert button</button>
  <div class="panel" id="panel">Panel content, 200px tall and blue.</div>
  <script>
    document.getElementById("trigger").addEventListener("click", () => {
      document.getElementById("panel").classList.add("open");
    });
    window.__vrtActions = [
      { name: "js-paint", run: () => { document.body.style.background = "#111"; } },
      { name: "js-offscreen", run: () => { document.title = "changed"; } },
      { name: "js-throws", run: () => { throw new Error("deliberate"); } },
    ];
  </script>
</body>`);

/** Declares nothing — the "page has not opted in" path. */
const bare = page("bare", `<body><button>Not declared</button><p>Nothing to explore.</p></body>`);

const byName = (r: Awaited<ReturnType<typeof runExplore>>, name: string) => {
  const found = r.findings.find((f) => f.action.name === name);
  assert.ok(found, `no finding for ${name}`);
  return found;
};

/**
 * Strip the whole SGR sequence, ESC included. `/\[[0-9;]*m/` — the spelling used
 * elsewhere in this repo's tests — leaves the ESC byte behind, which is invisible
 * in a diff and sits exactly where `\s+` is expected to match.
 */
const plain = (s: string) => s.replace(/\u001b\[[0-9;]*m/g, "");

describe("runExplore", () => {
  it("discovers actions from both mechanisms, without double-counting", async () => {
    const report = await runExplore({ source: declared, outputDir: join(dir, "out-discover") });
    assert.deepEqual(
      report.actions.map((a) => a.name).sort(),
      ["do-nothing", "inert-button", "js-offscreen", "js-paint", "js-throws", "open-panel"],
    );
    // `window.__vrtActions` is read first and wins on a name collision, so origin
    // is not cosmetic — it says which declaration the runner actually invoked.
    const origins = new Map(report.actions.map((a) => [a.name, a.origin]));
    assert.equal(origins.get("open-panel"), "data-vrt-action");
    assert.equal(origins.get("js-paint"), "window.__vrtActions");
    // Attribute actions carry the selector the runner will click.
    const attr = report.actions.find((a) => a.name === "open-panel")!;
    assert.equal(attr.selector, "#trigger", "an element with an id gets an id selector");
    assert.equal(report.findings.length, report.actions.length, "every discovered action is invoked");
  });

  it("separates an action that paints from one that is wired but silent", async () => {
    const report = await runExplore({
      source: declared,
      outputDir: join(dir, "out-delta"),
      strictTiming: true,
    });
    // 200px of blue appearing is well past any floor.
    const paints = byName(report, "open-panel");
    assert.ok(paints.executed);
    assert.ok(paints.diffRatio > report.silentFloor, `open-panel should paint, got ${paints.diffRatio}`);
    assert.ok(paints.diffPixels > 0);

    // Declared, clicked, no handler — the dead action this gate exists to name.
    const inert = byName(report, "do-nothing");
    assert.ok(inert.executed, "a click on a real element succeeds even with no handler");
    assert.equal(inert.diffRatio, 0);
    assert.equal(inert.mutationCount, 0, "0 mutations is what makes it *silent* rather than off-screen");

    // Mutated the document but painted nothing: distinguishable only because
    // --strict-timing counts mutations. Folding this into "dead" would report a
    // working handler as unwired.
    const offscreen = byName(report, "js-offscreen");
    assert.equal(offscreen.diffRatio, 0);
    assert.ok(offscreen.mutationCount! > 0, "a title change is a DOM mutation with no pixels");
  });

  it("does not attribute a leftover hover highlight to the next action", async () => {
    // The virtual mouse is a property of the page, not the document, so it survives
    // the `setContent` that resets state between actions. Until v7, action N's
    // baseline still carried the hover highlight left on whatever element action N-1
    // had clicked, and the un-hover was measured as action N's delta.
    //
    // The fixture makes this visible three ways at once: the inert `<span>` measured
    // 0.28% with its changed region sitting on the *button clicked before it*, the
    // inert `<button>` measured 0.42% from the mouse merely arriving, and
    // open-panel's heatmap carried a second region over the trigger it had left.
    const report = await runExplore({
      source: declared,
      outputDir: join(dir, "out-hover"),
      strictTiming: true,
    });

    // An inert button is dead, and the mouse arriving on it is not a change.
    const inertButton = byName(report, "inert-button");
    assert.ok(inertButton.executed);
    assert.equal(inertButton.diffRatio, 0, "hovering the target before the baseline removes the hover-in");
    assert.equal(inertButton.mutationCount, 0);

    // And the action that DID paint is credited only with what it painted: one
    // region, the panel. A second region over the trigger button would be the
    // pointer leaving, not the handler.
    const painted = byName(report, "open-panel");
    assert.equal(painted.heatmapRegions.length, 1, `expected only the panel, got ${JSON.stringify(painted.heatmapRegions.map((r) => [r.left, r.top, r.width, r.height]))}`);
    assert.ok(painted.heatmapRegions[0]!.top >= 50, "the panel sits below the controls");

    // A focus ring is deliberately NOT suppressed — it is a real consequence of the
    // click. It simply does not arise here: Chromium does not match `:focus-visible`
    // on a mouse click, so a plain button paints nothing on being clicked.
    assert.equal(report.silentFloor, 0.001, "the floor is a constant, not --threshold");
  });

  it("records an action that threw without abandoning the rest", async () => {
    const report = await runExplore({ source: declared, outputDir: join(dir, "out-throw") });
    const threw = byName(report, "js-throws");
    assert.equal(threw.executed, false);
    assert.match(threw.error ?? "", /deliberate/);
    // The run continued: the throwing action is not the last one alphabetically,
    // and every other action still has a finding.
    assert.equal(report.findings.length, 6);
    assert.ok(byName(report, "open-panel").executed);
  });

  it("counts dead, silent and failed actions instead of setting an exit code", async () => {
    // `runExplore` is a measurement; the process's exit code belongs to whoever
    // owns the process. It assigned `process.exitCode = 1` directly until v7, which
    // meant a --strict run inside any other program silently poisoned that
    // program's exit status.
    const report = await runExplore({
      source: declared,
      outputDir: join(dir, "out-counts"),
      strictTiming: true,
    });
    assert.equal(report.failedActions, 1, "js-throws");
    // Two elements are declared and unwired, and neither paints anything now that
    // the pointer no longer leaks between actions.
    assert.equal(report.silentHandlers, 2, "do-nothing and inert-button: 0 mutations, 0 pixels");
    // Those two plus js-offscreen, which mutated the DOM but painted nothing.
    // js-throws never ran, so it is failed rather than dead.
    assert.equal(report.deadActions, 3);
    assert.equal(process.exitCode, undefined, "a measurement must not touch the process's exit code");
  });

  it("does not count mutation data it was not asked to collect", async () => {
    const report = await runExplore({ source: declared, outputDir: join(dir, "out-nomut") });
    assert.equal(report.strictTiming, false);
    for (const f of report.findings) {
      assert.equal(f.mutationCount, undefined, "the observer is only installed under --strict-timing");
    }
    // Without mutation counts nothing can be called *silent*; dead is still known.
    assert.equal(report.silentHandlers, 0);
    assert.equal(report.deadActions, 3);
  });

  it("reports a page that declared nothing as declaring nothing", async () => {
    // Not an error and not a pass: the page has not opted in, and saying "0 dead
    // actions" about it would read as a clean bill of health.
    const report = await runExplore({ source: bare, outputDir: join(dir, "out-bare") });
    assert.deepEqual(report.actions, []);
    assert.deepEqual(report.findings, []);
    const md = readFileSync(report.reportPath, "utf-8");
    assert.match(md, /No declared actions found/);
    // The report has to show how to opt in, or the reader is left with a blank.
    assert.match(md, /data-vrt-action/);
    assert.match(md, /__vrtActions/);
    assert.match(plain(formatExploreReport(report)), /no declared actions/);
  });

  it("resets the page between actions, so one action's effect is not another's baseline", async () => {
    // Every action is measured from a freshly loaded page. Without the reset,
    // open-panel's 200px of blue would still be on screen when do-nothing is
    // measured, and do-nothing's before/after would match anyway — the dead action
    // would still read as dead, but for the wrong reason, and any action ordered
    // after a page-wide change would report a delta it did not cause.
    const report = await runExplore({ source: declared, outputDir: join(dir, "out-reset") });
    // js-paint blackens the whole body. Alphabetically it is invoked before
    // js-throws and after do-nothing in declaration order, so if state leaked, the
    // actions following it would show a body-sized delta.
    const painted = byName(report, "js-paint");
    assert.ok(painted.diffRatio > 0.5, `a full-page background change should be most of the page, got ${painted.diffRatio}`);
    assert.equal(byName(report, "js-offscreen").diffRatio, 0, "a leaked black body would show here");
  });

  it("honours the viewport and writes a report to the requested path", async () => {
    const reportPath = join(dir, "explore-custom.md");
    const report = await runExplore({
      source: declared,
      outputDir: join(dir, "out-viewport"),
      reportPath,
      viewport: { width: 800, height: 600 },
    });
    assert.deepEqual(report.viewport, { width: 800, height: 600 });
    assert.equal(report.reportPath, reportPath);
    const md = readFileSync(reportPath, "utf-8");
    assert.match(md, /800×600/);
    for (const a of report.actions) assert.ok(md.includes(a.name), `${a.name} missing from report`);
  });
});

describe("formatExploreReport", () => {
  it("names every action with its delta and its failure reason", async () => {
    const report = await runExplore({
      source: declared,
      outputDir: join(dir, "out-format"),
      strictTiming: true,
    });
    const text = plain(formatExploreReport(report));
    assert.match(text, /vlmkit inspect explore/);
    assert.match(text, /discovered 6 action\(s\)/);
    assert.match(text, /open-panel\s+Δ \d+\.\d+%/);
    assert.match(text, /js-throws\s+failed: .*deliberate/);
    assert.match(text, /do-nothing.*silent handler/);
    assert.match(text, /inert-button.*silent handler/);
  });
});
