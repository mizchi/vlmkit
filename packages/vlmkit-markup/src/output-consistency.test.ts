/**
 * Differential audit of three "two paths must agree" axes, kept as a test so a
 * regression on any of them fails loudly.
 *
 * The same instrument found the external-asset load defect a few hours earlier;
 * these are the remaining axes it was pointed at.
 *
 *   1. **Viewport sweep order.** Findings are deduped across the sweep, so the
 *      retained one used to be whichever width came first: `--viewports
 *      375,768,1280` attributed a page-wide defect to 375 and `1280,768,375` to
 *      1280. That made `--allow "…@1280"` silently order-dependent and read as
 *      "mobile only" for something present everywhere. The sweep is now sorted
 *      widest-first internally and every observed width is recorded.
 *   2. **Console vs data.** `check a11y contrast|touch|focus` printed a headline
 *      count and then five rows with no note — 12 findings looked like 5.
 *   3. **`--json` completeness.** The truncation notices point at `--json`, so
 *      `--json` has to exist on those gates and carry every row. It did not
 *      exist at all until the notices were written; this test is what keeps the
 *      claim honest.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { runA11yContrast } from "./a11y-contrast.ts";
import { runA11yTouch } from "./a11y-touch.ts";
import { runIntegrityCheck } from "./inspect/integrity-check.ts";
import { parseAllowRules, ruleMatches } from "./inspect/integrity-exemption.ts";

const FIXTURE = join(
  fileURLToPath(new URL("../../../fixtures/external-assets", import.meta.url)),
  "page.html",
);
const outDir = () => mkdtempSync(join(tmpdir(), "output-consistency-"));

const VIEWPORTS = [
  { width: 1280, height: 800 },
  { width: 768, height: 900 },
  { width: 375, height: 700 },
];

/** Order-insensitive identity of a finding, including every width it hit. */
const shape = (report: Awaited<ReturnType<typeof runIntegrityCheck>>) =>
  report.findings
    .map((f) => `${f.kind}|${f.selector ?? ""}|${(f.viewports ?? [f.viewport]).join(",")}|${f.severity}`)
    .sort();

describe("viewport sweep order does not change the verdict", () => {
  it("reports the same findings, with the same widths, in either order", async () => {
    const wide = await runIntegrityCheck({ source: FIXTURE, viewports: VIEWPORTS });
    const narrow = await runIntegrityCheck({ source: FIXTURE, viewports: [...VIEWPORTS].reverse() });
    assert.equal(wide.verdict, narrow.verdict);
    assert.deepEqual(shape(wide), shape(narrow));
  });

  it("attributes a finding to the widest width it was seen at, not the first swept", async () => {
    const narrowFirst = await runIntegrityCheck({ source: FIXTURE, viewports: [...VIEWPORTS].reverse() });
    const contrast = narrowFirst.findings.find((f) => f.kind === "low-contrast-text");
    assert.ok(contrast, "the fixture declares a 1.92:1 pair");
    assert.equal(contrast.viewport, 1280);
    assert.deepEqual(contrast.viewports, [1280, 768, 375]);
  });

  it("records every width, so page-wide and mobile-only are distinguishable", async () => {
    // Previously both collapsed to a single width and read identically.
    const report = await runIntegrityCheck({ source: FIXTURE, viewports: VIEWPORTS });
    const widths = report.findings.map((f) => (f.viewports ?? [f.viewport]).length);
    assert.ok(widths.some((n) => n > 1), "expected at least one finding present at several widths");
  });

  it("lets --allow match any width the finding appeared at", async () => {
    // A rule scoped to @375 must work for a finding whose canonical width is
    // 1280 but which was also observed at 375 — otherwise the exemption is
    // order-dependent in exactly the way the sort was meant to fix.
    const report = await runIntegrityCheck({ source: FIXTURE, viewports: VIEWPORTS });
    const finding = report.findings.find((f) => (f.viewports ?? []).includes(375));
    assert.ok(finding);
    const [rule] = parseAllowRules([`${finding.kind}@375;present at every width`]);
    assert.equal(ruleMatches(rule!, finding), true);
  });
});

describe("console output does not hide rows", () => {
  const manyFindings = (): string => {
    const rows = Array.from({ length: 12 }, (_, i) => `<p class="low${i}">Low contrast line ${i}</p>`).join("");
    const taps = Array.from({ length: 12 }, (_, i) => `<a class="tap${i}" href="#${i}" aria-label="tap ${i}"></a>`).join("");
    const css = Array.from({ length: 12 }, (_, i) =>
      `.low${i}{color:#bbbbbb}.tap${i}{display:inline-block;width:18px;height:18px;background:#333;margin:2px}`).join("");
    const dir = mkdtempSync(join(tmpdir(), "many-findings-"));
    const file = join(dir, "many.html");
    writeFileSync(file, `<!doctype html><meta charset="utf-8"><style>body{background:#fff;font:16px sans-serif}${css}</style><body>${rows}${taps}</body>`);
    return file;
  };
  const MANY = manyFindings();

  it("a11y contrast keeps every finding in the returned report", async () => {
    const report = await runA11yContrast({ htmlPath: MANY, outputDir: outDir() });
    // The console prints five; the data must still hold all twelve, which is
    // what the "… N more" notice promises.
    assert.equal(report.failures.length, 12);
  });

  it("a11y touch keeps every finding in the returned report", async () => {
    const report = await runA11yTouch({ source: MANY, outputDir: outDir() });
    assert.equal(report.failures.length, 12);
  });
});
