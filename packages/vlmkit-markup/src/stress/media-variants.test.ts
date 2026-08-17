import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ALL_VARIANTS, formatMediaVariantsReport, runMediaVariants } from "./media-variants.ts";

/**
 * `stress media` end to end, in-process.
 *
 * The gate renders the page once normally and then once per media variant —
 * forced colours, reduced motion, print, RTL, 200% zoom — and reports how much
 * each one moved. Like `check theme`, none of it is checkable from a pure
 * function: the measurement IS "what did the browser do differently under this
 * emulation".
 */

const dir = mkdtempSync(join(tmpdir(), "vlmkit-media-"));

function page(name: string, body: string): string {
  const file = join(dir, `${name}.html`);
  writeFileSync(file, `<!doctype html><meta charset="utf-8"><title>${name}</title>${body}`);
  return file;
}

/** A page that responds to each variant, so every delta is non-trivial. */
const responsive = page("responsive", `
<style>
  body { margin: 0; font: 16px sans-serif; background: #fff; color: #111; }
  .box { margin: 20px; padding: 40px; background: #2d6cdf; color: #fff; }
  .spin { width: 60px; height: 60px; background: #d93; animation: spin 2s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .spin { animation: none; background: #333; } }
  @media print { .box { background: #000; } .spin { display: none; } }
</style>
<body>
  <div class="box">Primary surface</div>
  <div class="spin"></div>
  <p>Body copy that reflows when the direction flips, with enough words to move.</p>
</body>`);

describe("runMediaVariants", () => {
  it("captures a baseline plus one screenshot per requested variant", async () => {
    const report = await runMediaVariants({
      source: responsive,
      outputDir: join(dir, "out-all"),
      variants: ["reduced-motion", "print"],
    });
    assert.equal(report.variants.length, 2);
    assert.match(report.defaultScreenshot, /\.png$/);
    for (const v of report.variants) {
      assert.match(v.screenshotPath, /\.png$/);
      assert.notEqual(v.screenshotPath, report.defaultScreenshot, "each variant needs its own image");
      assert.ok(v.totalPixels > 0, "a variant with no pixels measured nothing");
      assert.ok(["ok", "suspect", "warn", "skip"].includes(v.verdict));
      assert.ok(v.note.length > 0, "every row carries a note, so a verdict is never bare");
    }
  });

  it("sees print and reduced-motion actually change the page", async () => {
    // Both are declared in the fixture's CSS, so a zero delta here would mean the
    // emulation never reached the page — the failure mode that makes this gate
    // report a clean bill of health for a page it never stressed.
    const report = await runMediaVariants({
      source: responsive,
      outputDir: join(dir, "out-change"),
      variants: ["print", "reduced-motion"],
    });
    for (const v of report.variants) {
      assert.ok(v.deltaRatio > 0, `${v.variant} should move a page that styles it, got ${v.deltaRatio}`);
      assert.ok(v.deltaPixels > 0);
      assert.ok(v.deltaRatio <= 1, "a ratio above 1 would mean more changed pixels than pixels");
    }
  });

  it("defaults to every variant when none is named", async () => {
    const report = await runMediaVariants({ source: responsive, outputDir: join(dir, "out-default") });
    assert.deepEqual(report.variants.map((v) => v.variant).sort(), [...ALL_VARIANTS].sort());
  });

  it("honours the viewport, and zoom-200 is measured against it", async () => {
    const report = await runMediaVariants({
      source: responsive,
      outputDir: join(dir, "out-viewport"),
      viewport: { width: 800, height: 600 },
      variants: ["zoom-200"],
    });
    assert.deepEqual(report.viewport, { width: 800, height: 600 });
    // 200% zoom halves the CSS viewport, so a page with any block content reflows.
    assert.ok(report.variants[0]!.deltaRatio > 0);
  });

  it("--threshold is per-pixel SENSITIVITY, so it moves the delta itself", async () => {
    // Worth pinning because the name reads like a pass line, and it is not: the
    // value goes to pixelmatch as its colour-distance tolerance, where a SMALLER
    // number means more sensitive and therefore more changed pixels. Reading it as
    // "the ratio above which this fails" gets the direction backwards — I wrote the
    // first version of this test that way and it asserted the two runs would
    // measure the same thing.
    const sensitive = await runMediaVariants({
      source: responsive,
      outputDir: join(dir, "out-sensitive"),
      variants: ["print"],
      threshold: 0.0001,
    });
    const tolerant = await runMediaVariants({
      source: responsive,
      outputDir: join(dir, "out-tolerant"),
      variants: ["print"],
      threshold: 0.99,
    });
    assert.ok(
      sensitive.variants[0]!.deltaRatio > tolerant.variants[0]!.deltaRatio,
      `a smaller threshold must find at least as much change:`
      + ` sensitive=${sensitive.variants[0]!.deltaRatio} tolerant=${tolerant.variants[0]!.deltaRatio}`,
    );
    // And a tolerance of 0.99 accepts almost any colour distance, so a page that
    // visibly changes measures as unchanged. That is the flag doing its job, not a bug.
    assert.equal(tolerant.variants[0]!.deltaRatio, 0);
  });
});

describe("formatMediaVariantsReport", () => {
  it("names every variant with its delta, so a reader sees what was stressed", async () => {
    const report = await runMediaVariants({
      source: responsive,
      outputDir: join(dir, "out-format"),
      variants: ["print", "rtl"],
    });
    const text = formatMediaVariantsReport(report).replace(/\[[0-9;]*m/g, "");
    assert.match(text, /vlmkit stress media/);
    assert.match(text, /print/);
    assert.match(text, /rtl/);
  });
});
