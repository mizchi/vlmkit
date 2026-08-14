import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { UsageError } from "@mizchi/vlmkit-core/cli-error.ts";
import {
  formatMultiPageConsistencyReport,
  runMultiPageConsistency,
} from "./multi-page-consistency.ts";
import { driftPagesGate } from "../gates/drift.gate.ts";

/**
 * `check drift pages` end to end, in-process.
 *
 * The gate crops one selector out of N pages and diffs each against the first.
 * Nothing about it is checkable from a pure function: the measurement IS "does
 * the same selector paint the same pixels on every route", so the fixtures below
 * are pages that agree and pages that deliberately do not.
 *
 * Two fixtures minimum per assertion, because the failure that matters here is
 * the silent one — a run where the crop never reached the page, or where the
 * comparator compared an image against itself, reports 0% and reads as a clean
 * design system.
 */

const dir = mkdtempSync(join(tmpdir(), "vlmkit-drift-pages-"));

/** Every fixture shares this footer markup; only the CSS below it varies. */
const FOOTER = `
<body>
  <main><p>Route-specific content that must not be in the crop.</p></main>
  <footer class="footer">
    <span>© 2026 Example</span>
    <nav><a href="/a">About</a> <a href="/b">Terms</a></nav>
  </footer>
</body>`;

function page(name: string, footerCss: string, body = FOOTER): string {
  const file = join(dir, `${name}.html`);
  writeFileSync(
    file,
    `<!doctype html><meta charset="utf-8"><title>${name}</title>
<style>
  body { margin: 0; font: 16px/1.5 sans-serif; background: #fff; color: #111; }
  main { height: 120px; }
  .footer { padding: 24px; background: #f2f4f8; color: #333; display: flex; gap: 16px; ${footerCss} }
</style>${body}`,
  );
  return file;
}

/** The reference, and a second route styled identically. */
const routeA = page("route-a", "");
const routeB = page("route-b", "");
/** Same selector, different padding and background — the drift this gate exists for. */
const routeDrifted = page("route-drifted", "padding: 40px; background: #ffe8d0;");
/** No `.footer` at all — the component vanished on this route. */
const routeMissing = page("route-missing", "", `<body><main><p>No footer here.</p></main></body>`);

describe("runMultiPageConsistency", () => {
  it("treats the first page as reference and reports one delta per candidate", async () => {
    const report = await runMultiPageConsistency({
      selector: ".footer",
      files: [routeA, routeB, routeDrifted],
      outputDir: join(dir, "out-basic"),
    });
    assert.equal(report.reference, "route-a.html");
    assert.equal(report.pages.length, 3);
    // N pages, N-1 deltas: the reference is not compared with itself.
    assert.equal(report.deltas.length, 2);
    for (const p of report.pages) {
      assert.ok(p.matched, `${p.label} should have matched .footer`);
      assert.ok(p.bbox.width > 0 && p.bbox.height > 0, "a zero bbox means nothing was cropped");
      assert.match(p.screenshotPath, /\.png$/);
    }
    // Each page gets its own crop; sharing one path would make every diff zero.
    const shots = new Set(report.pages.map((p) => p.screenshotPath));
    assert.equal(shots.size, 3);
  });

  it("measures ~0 for a route that matches and a real delta for one that drifted", async () => {
    // Both directions in one run, because either alone is satisfied by a broken
    // measurement: all-zero passes the first, all-nonzero passes the second.
    const report = await runMultiPageConsistency({
      selector: ".footer",
      files: [routeA, routeB, routeDrifted],
      outputDir: join(dir, "out-delta"),
    });
    const [same, drifted] = report.deltas;
    assert.equal(same!.candidate, "route-b.html");
    assert.equal(same!.diffRatio, 0, "identically styled routes must measure exactly 0");
    assert.equal(drifted!.candidate, "route-drifted.html");
    assert.ok(drifted!.diffRatio > 0.01, `drifted route should differ, got ${drifted!.diffRatio}`);
    // The bbox delta is read from the live DOM, not from the crops. 24px to 40px
    // padding is +32px in height only: a block-level footer's `width: auto` is
    // solved against the containing block, so the extra padding eats into the
    // content box instead of widening the element. (I asserted +32 in both axes
    // first, which is the content-box arithmetic applied to the wrong axis.)
    assert.equal(drifted!.bboxDeltas.height, 32);
    assert.equal(drifted!.bboxDeltas.width, 0, "a block element's outer width is fixed by its container");
    assert.equal(same!.bboxDeltas.width, 0);
    assert.equal(same!.bboxDeltas.height, 0);
  });

  it("crops the selector, not the viewport", async () => {
    // `main` is 120px tall and differs in copy between fixtures. If the crop were
    // the whole page instead of the element box, route-b would report a delta from
    // content the gate was never asked about.
    const report = await runMultiPageConsistency({
      selector: ".footer",
      files: [routeA, routeB],
      outputDir: join(dir, "out-crop"),
      viewport: { width: 900, height: 700 },
    });
    for (const p of report.pages) {
      assert.ok(p.bbox.height < 200, `crop should be the footer box, got ${p.bbox.height}px tall`);
      assert.ok(p.bbox.y >= 120, "the footer sits below main, so its crop starts there");
    }
    assert.equal(report.deltas[0]!.diffRatio, 0);
  });

  it("--pixel-tolerance is the comparator's sensitivity, and --threshold does not move the measurement", async () => {
    // The two were one flag until a dogfood run found that raising it moved the
    // measurement as well as the bar. Pinned so they cannot be merged again.
    const base = { selector: ".footer", files: [routeA, routeDrifted] };
    const tight = await runMultiPageConsistency({ ...base, outputDir: join(dir, "out-tight"), pixelTolerance: 0.0001 });
    const loose = await runMultiPageConsistency({ ...base, outputDir: join(dir, "out-loose"), pixelTolerance: 0.99 });
    assert.ok(
      tight.deltas[0]!.diffRatio > loose.deltas[0]!.diffRatio,
      `smaller tolerance must find at least as much change:`
      + ` tight=${tight.deltas[0]!.diffRatio} loose=${loose.deltas[0]!.diffRatio}`,
    );
    const lowBar = await runMultiPageConsistency({ ...base, outputDir: join(dir, "out-bar-low"), threshold: 0.001 });
    const highBar = await runMultiPageConsistency({ ...base, outputDir: join(dir, "out-bar-high"), threshold: 0.9 });
    assert.equal(
      lowBar.deltas[0]!.diffRatio, highBar.deltas[0]!.diffRatio,
      "--threshold is a pass line applied to findings; it must not change what was measured",
    );
  });

  it("refuses a run it cannot compare against, rather than reporting no drift", async () => {
    await assert.rejects(
      () => runMultiPageConsistency({ selector: "", files: [routeA, routeB], outputDir: join(dir, "out-nosel") }),
      (e: unknown) => e instanceof UsageError && /--selector/.test((e as Error).message),
    );
    await assert.rejects(
      () => runMultiPageConsistency({ selector: ".footer", files: [routeA], outputDir: join(dir, "out-one") }),
      (e: unknown) => e instanceof UsageError && /at least two/.test((e as Error).message),
    );
    // A reference page with no match has nothing to compare the others to. Falling
    // back to the second page would silently change what "reference" means.
    await assert.rejects(
      () => runMultiPageConsistency({
        selector: ".footer",
        files: [routeMissing, routeA],
        outputDir: join(dir, "out-noref"),
      }),
      (e: unknown) => e instanceof UsageError && /did not match on the reference page/.test((e as Error).message),
    );
  });

  it("records a candidate page where the selector is missing", async () => {
    const report = await runMultiPageConsistency({
      selector: ".footer",
      files: [routeA, routeMissing],
      outputDir: join(dir, "out-missing"),
    });
    assert.equal(report.pages[1]!.matched, false);
    assert.ok(Number.isNaN(report.deltas[0]!.diffRatio), "an uncomparable page has no ratio, not a ratio of 0");
  });

  it("writes a report naming every page and its crop", async () => {
    const reportPath = join(dir, "custom-report.md");
    const report = await runMultiPageConsistency({
      selector: ".footer",
      files: [routeA, routeDrifted, routeMissing],
      outputDir: join(dir, "out-report"),
      reportPath,
    });
    assert.equal(report.reportPath, reportPath);
    const md = readFileSync(reportPath, "utf-8");
    assert.match(md, /Multi-page consistency report/);
    for (const p of report.pages) assert.ok(md.includes(p.label), `${p.label} missing from report`);
    // The missing-selector row must say so rather than print a number.
    assert.match(md, /selector missing/);
  });
});

describe("driftPagesGate", () => {
  const gateFindings = async (over: Record<string, unknown> = {}) => {
    const options = {
      selector: ".footer",
      threshold: 0.01,
      outputDir: join(dir, "out-gate"),
      ...over,
    } as Parameters<typeof driftPagesGate.run>[0];
    const report = await driftPagesGate.run(options, {} as never);
    return { report, findings: driftPagesGate.findings!(report, options) };
  };

  it("reports the drifted route and stays quiet about the matching one", async () => {
    const { findings } = await gateFindings({ files: [routeA, routeB, routeDrifted] });
    assert.equal(findings.length, 1);
    assert.equal(findings[0]!.rule, "page-drift");
    assert.match(findings[0]!.message, /route-drifted\.html/);
    assert.equal(findings[0]!.selector, ".footer");
  });

  it("reports a route where the selector vanished", async () => {
    // The worst possible drift — the shared component is not on the page at all —
    // used to be the one case that passed. `NaN > threshold` is false, so the
    // missing row produced no finding and the gate exited 0 with a report whose
    // markdown said "selector missing". Every rule id must be declared, so a
    // finding for it is also a rule.
    const { findings } = await gateFindings({
      files: [routeA, routeMissing],
      outputDir: join(dir, "out-gate-missing"),
    });
    assert.equal(findings.length, 1);
    assert.equal(findings[0]!.rule, "selector-missing");
    assert.match(findings[0]!.message, /route-missing\.html/);
    assert.ok(
      driftPagesGate.rules.some((r) => r.id === "selector-missing"),
      "a finding's rule must be declared or the runner rejects it as a gate bug",
    );
  });

  it("honours --threshold as the pass line", async () => {
    const files = [routeA, routeDrifted];
    const lenient = await gateFindings({ files, threshold: 0.99, outputDir: join(dir, "out-gate-lenient") });
    assert.equal(lenient.findings.length, 0, "a pass line above the measured ratio passes");
    const strict = await gateFindings({ files, threshold: 0, outputDir: join(dir, "out-gate-strict") });
    assert.equal(strict.findings.length, 1);
  });
});

describe("formatMultiPageConsistencyReport", () => {
  it("names each candidate with its ratio, and says n/a where there is none", async () => {
    const report = await runMultiPageConsistency({
      selector: ".footer",
      files: [routeA, routeDrifted, routeMissing],
      outputDir: join(dir, "out-format"),
    });
    const text = formatMultiPageConsistencyReport(report).replace(/\[[0-9;]*m/g, "");
    assert.match(text, /vlmkit check drift pages/);
    assert.match(text, /selector: \.footer/);
    assert.match(text, /reference: route-a\.html/);
    assert.match(text, /route-drifted\.html\s+\d+\.\d+%/);
    assert.match(text, /route-missing\.html\s+n\/a/);
  });
});
