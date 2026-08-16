/**
 * The load-mechanism gate: a gate that takes an HTML file must resolve that
 * file's relative assets.
 *
 * `fixtures/external-assets/` declares every one of its defects in `style.css`,
 * never in `page.html`. A gate that loads the markup with
 * `page.setContent(await readFile(file))` gets a document whose base URL is
 * `about:blank`, so the stylesheet never loads and the gate measures unstyled
 * markup.
 *
 * Measured before the fix (2026-08-02):
 *
 *   check a11y contrast : 0 failures external / 1 inlined
 *   check a11y touch    : missed the 20x20 target entirely (it gets its size
 *                         from CSS) AND reported three compliant buttons as
 *                         failures at their unstyled sizes — inverted, not just
 *                         incomplete
 *   check tokens        : 12 padding violations external / 9 inlined
 *   stress i18n         : card height 21->86 external / 95->185 inlined
 *
 * The assertion here is differential, not absolute: run each gate on the
 * fixture and on a twin whose CSS is inlined, and require the same verdict. A
 * threshold change can move both numbers without breaking the test, but a gate
 * that stops resolving assets breaks it immediately.
 */
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { runA11yContrast } from "./a11y-contrast.ts";
import { runA11yTouch } from "./a11y-touch.ts";
import { runDesignTokens } from "./style/design-tokens.ts";
import { runI18nStress } from "./stress/i18n-stress.ts";

// Resolved from this file, not the cwd: `pnpm --filter` runs the suite with the
// package as cwd, and a cwd-relative path made the whole suite error out while
// the summary still printed "0 fail".
const FIXTURE_DIR = fileURLToPath(new URL("../../../fixtures/external-assets", import.meta.url));
const EXTERNAL = join(FIXTURE_DIR, "page.html");

/** Same document, CSS moved from the external file into a `<style>` block. */
const inlinedTwin = (): string => {
  const css = readFileSync(join(FIXTURE_DIR, "style.css"), "utf-8");
  const html = readFileSync(EXTERNAL, "utf-8")
    .replace('<link rel="stylesheet" href="style.css">', `<style>\n${css}\n</style>`);
  const dir = mkdtempSync(join(tmpdir(), "inlined-twin-"));
  const file = join(dir, "page.html");
  writeFileSync(file, html);
  return file;
};

const outDir = () => mkdtempSync(join(tmpdir(), "ext-assets-out-"));

describe("gates resolve a file's relative assets", () => {
  const INLINED = inlinedTwin();

  it("check a11y contrast sees CSS-declared contrast failures", async () => {
    const external = await runA11yContrast({ htmlPath: EXTERNAL, outputDir: outDir() });
    const inlined = await runA11yContrast({ htmlPath: INLINED, outputDir: outDir() });
    assert.equal(external.failures.length, inlined.failures.length);
    assert.ok(external.failures.length >= 1, "the fixture declares a 1.92:1 pair in style.css");
    assert.deepEqual(
      external.failures.map((f) => `${f.path}:${f.ratio}`).sort(),
      inlined.failures.map((f) => `${f.path}:${f.ratio}`).sort(),
    );
  });

  it("check a11y touch sees an element whose size comes from CSS", async () => {
    const external = await runA11yTouch({ source: EXTERNAL, outputDir: outDir() });
    const inlined = await runA11yTouch({ source: INLINED, outputDir: outDir() });
    assert.equal(external.inspectedCount, inlined.inspectedCount);
    // Every target the gate MEASURED as undersized, whether or not a WCAG exception
    // excused it. This test is about the stylesheet being resolved — the 20x20 anchor is
    // inline with no intrinsic size until CSS applies, so an unstyled load does not even
    // see it as a target — and it must not also depend on the verdict: the anchor is
    // isolated, so 2.5.8's spacing exception legitimately excuses it at the AA default.
    const measured = (r: typeof external) => [...r.failures, ...(r.wcagExempt ?? [])];
    assert.ok(
      measured(external).some((f) => f.path.includes("tiny-tap")),
      `expected the CSS-sized tap target, got ${JSON.stringify(measured(external).map((f) => f.path))}`,
    );
    assert.deepEqual(
      measured(external).map((f) => `${f.path}:${f.minSide}`).sort(),
      measured(inlined).map((f) => `${f.path}:${f.minSide}`).sort(),
    );
  });

  it("check tokens audits the values the page actually renders", async () => {
    const external = await runDesignTokens({ source: EXTERNAL, outputDir: outDir() });
    const inlined = await runDesignTokens({ source: INLINED, outputDir: outDir() });
    assert.equal(external.inspectedCount, inlined.inspectedCount);
    assert.equal(external.violations.length, inlined.violations.length);
  });

  it("stress i18n inflates the styled layout, not an unstyled one", async () => {
    const external = await runI18nStress({ htmlPath: EXTERNAL, outputDir: outDir() });
    const inlined = await runI18nStress({ htmlPath: INLINED, outputDir: outDir() });
    assert.equal(external.totalInspected, inlined.totalInspected);
    assert.equal(external.overflowing.length, inlined.overflowing.length);
    // Same element, same measured heights — the geometry the gate judged used to
    // be a different document's (card 21->86 unstyled vs 95->185 styled).
    assert.deepEqual(
      external.overflowing.map((o) => `${o.path}:${o.kind}:${o.before.height}->${o.after.height}`),
      inlined.overflowing.map((o) => `${o.path}:${o.kind}:${o.before.height}->${o.after.height}`),
    );
  });
});
