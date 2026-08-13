import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { formatThemeParityReport, runThemeParity } from "./theme-parity.ts";

/**
 * `check theme` end to end, in-process, against local files.
 *
 * This gate had no test at all, which is a gap of a particular kind: it renders
 * the page TWICE — once with `prefers-color-scheme: light` and once dark — and
 * compares. Nothing about that is checkable from a pure function, because the
 * whole measurement is "did the second render differ from the first", and both
 * renders come from a browser.
 *
 * The two fixtures below are the two answers the gate exists to distinguish: a
 * page that honours the media query, and one that ignores it.
 */

const dir = mkdtempSync(join(tmpdir(), "vlmkit-theme-"));

function page(name: string, body: string): string {
  const file = join(dir, `${name}.html`);
  writeFileSync(file, `<!doctype html><meta charset="utf-8"><title>${name}</title>${body}`);
  return file;
}

/** Honours the toggle: every surface flips. */
const themed = page("themed", `
<style>
  :root { --bg: #ffffff; --fg: #111111; --card: #f2f2f2; }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #0d1117; --fg: #f0f6fc; --card: #161b22; }
  }
  body { margin: 0; background: var(--bg); color: var(--fg); font: 16px sans-serif; }
  .card { background: var(--card); margin: 24px; padding: 32px; }
</style>
<body><div class="card"><h1>Themed</h1><p>Everything here follows the scheme.</p></div></body>`);

/** Ignores the toggle entirely: the dark render is identical to the light one. */
const unthemed = page("unthemed", `
<style>
  body { margin: 0; background: #ffffff; color: #111111; font: 16px sans-serif; }
  .card { background: #f2f2f2; margin: 24px; padding: 32px; }
</style>
<body><div class="card"><h1>Unthemed</h1><p>No media query anywhere.</p></div></body>`);

describe("runThemeParity", () => {
  it("measures a real difference on a page that honours prefers-color-scheme", async () => {
    const report = await runThemeParity({ htmlPath: themed, outputDir: join(dir, "out-themed") });
    assert.ok(
      report.themePixelDelta > 0.2,
      `a fully themed page should differ substantially between schemes, got ${report.themePixelDelta}`,
    );
    // Both renders are kept, because the delta alone is not reviewable — a human
    // asked to confirm a theme regression needs the two images.
    assert.match(report.lightScreenshot, /\.png$/);
    assert.match(report.darkScreenshot, /\.png$/);
    assert.notEqual(report.lightScreenshot, report.darkScreenshot);
    assert.match(report.reportPath, /\.md$/);
  });

  it("reports ~zero delta and unthemed regions on a page that ignores the query", async () => {
    // The defect this gate is for: a project ships a dark-mode toggle and some
    // surfaces never respond. With no media query at all, every matched region is
    // unthemed and the delta is zero.
    const report = await runThemeParity({ htmlPath: unthemed, outputDir: join(dir, "out-unthemed") });
    assert.ok(report.themePixelDelta < 0.001, `expected no difference, got ${report.themePixelDelta}`);
    assert.ok(report.totalMatched > 0, "the page has regions to match");
    assert.equal(report.unthemed.length, report.totalMatched, "none of them changed");
  });

  it("names each unthemed region with the fill that did not change", async () => {
    const report = await runThemeParity({ htmlPath: unthemed, outputDir: join(dir, "out-fills") });
    const first = report.unthemed[0]!;
    assert.ok(first.bbox.width > 0 && first.bbox.height > 0);
    // The hex is what makes it actionable: it is the value to go and theme.
    assert.match(first.lightFill.hex, /^#[0-9a-f]{6}$/);
    assert.equal(typeof first.rank, "number");
  });

  it("honours the viewport, since a theme can be responsive", async () => {
    const report = await runThemeParity({
      htmlPath: themed,
      outputDir: join(dir, "out-mobile"),
      viewport: { width: 375, height: 600 },
    });
    assert.deepEqual(report.viewport, { width: 375, height: 600 });
  });

  it("treats near-identical colours as unchanged, per --unchanged-color-threshold", async () => {
    // A page whose dark scheme moves #ffffff to #fefefe has not themed anything a
    // human can see. The threshold is what stops the gate reporting that as parity.
    const almost = page("almost", `
<style>
  :root { --bg: #ffffff; }
  @media (prefers-color-scheme: dark) { :root { --bg: #fdfdfd; } }
  body { margin: 0; background: var(--bg); }
  .card { background: #f2f2f2; margin: 24px; padding: 32px; }
</style>
<body><div class="card">Almost</div></body>`);
    const strict = await runThemeParity({
      htmlPath: almost,
      outputDir: join(dir, "out-strict"),
      unchangedColorThreshold: 1,
    });
    const lenient = await runThemeParity({
      htmlPath: almost,
      outputDir: join(dir, "out-lenient"),
      unchangedColorThreshold: 64,
    });
    assert.ok(
      lenient.unthemed.length >= strict.unthemed.length,
      "a larger threshold calls more regions unchanged, never fewer",
    );
  });
});

describe("formatThemeParityReport", () => {
  it("leads with the delta as a percentage and names the unthemed count", async () => {
    const report = await runThemeParity({ htmlPath: unthemed, outputDir: join(dir, "out-format") });
    const text = formatThemeParityReport(report).replace(/\[[0-9;]*m/g, "");
    assert.match(text, /vlmkit check theme/);
    assert.match(text, /\d+\.\d%/, "the delta is a percentage, not a ratio");
    assert.match(text, new RegExp(String(report.unthemed.length)));
  });
});
