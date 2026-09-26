import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, it } from "vitest";
import { responsiveGate } from "../gates/responsive.gate.ts";
import { withBrowser } from "@mizchi/vlmkit-core/browser-launch.ts";
import {
  runResponsiveCheck,
  runResponsiveOnPage,
  textScaleLadder,
  type ResponsiveOptions,
  type ResponsiveProperty,
  type ResponsiveReport,
} from "./responsive-pbt.ts";

/**
 * The paired-mutant contract of `check responsive`, on `fixtures/responsive-patterns/`:
 * every intact pattern is silent, and every mutant — its pattern plus one change that
 * reproduces a defect the demo sites found — reports that defect, shrunk to the right
 * breakpoint, with the declaration that caused it. Exact interval edges are asserted
 * only where a breakpoint pins them; the other edge depends on text metrics.
 */
const ROOT = resolve(import.meta.dirname, "../../../..");
const FIXTURES = join(ROOT, "fixtures/responsive-patterns");

interface MutantSpec {
  id: string;
  pattern: string;
  args?: string[];
  expect: {
    kind: string;
    anchor?: string;
    lo?: number;
    hi?: number;
    needs?: string;
    causeProperty?: string | string[];
  };
}

const { mutants } = JSON.parse(readFileSync(join(FIXTURES, "mutations.json"), "utf8")) as { mutants: MutantSpec[] };

const options = (path: string, args: string[] = []): ResponsiveOptions =>
  responsiveGate.parse([path, ...args], { cwd: ROOT, argv: [path, ...args], json: true });

describe("fixtures/responsive-patterns: mutants", () => {
  it("are what build.mjs writes from the patterns", async () => {
    const { buildAll } = await import(join(FIXTURES, "build.mjs"));
    for (const { path, html } of buildAll() as { path: string; html: string }[]) {
      assert.equal(readFileSync(path, "utf8"), html, `${path} is stale: run node fixtures/responsive-patterns/build.mjs`);
    }
  });

  for (const m of mutants) {
    it(`${m.id} reports ${m.expect.kind}${m.expect.anchor ? ` (${m.expect.anchor})` : ""}`, async () => {
      const report = await runResponsiveCheck(options(join(FIXTURES, "mutants", `${m.id}.html`), m.args));
      const failure = report.failures.find((f) =>
        f.kind === m.expect.kind
        && (m.expect.anchor === undefined || f.shrunk?.anchor.kind === m.expect.anchor)
        && (m.expect.lo === undefined || f.shrunk?.interval.lo === m.expect.lo)
        && (m.expect.hi === undefined || f.shrunk?.interval.hi === m.expect.hi));
      assert.ok(failure, `expected ${JSON.stringify(m.expect)}; got:\n${summary(report)}`);
      if (m.expect.needs) assert.ok(failure.shrunk?.needs.includes(m.expect.needs as never), `needs ${m.expect.needs}: ${JSON.stringify(failure.shrunk)}`);
      if (m.expect.causeProperty) {
        const wanted = [m.expect.causeProperty].flat();
        const primary = failure.cause?.declarations.map((d) => d.property) ?? [];
        assert.ok(primary.some((p) => wanted.includes(p)), `cause ${JSON.stringify(primary)} not in ${JSON.stringify(wanted)}: ${failure.causeNote ?? ""}`);
      }
      // A mutant anchored at a breakpoint gets its move tried; every such move on this set is sound.
      if (failure.shrunk?.move) assert.equal(failure.shrunk.move.verified, true, JSON.stringify(failure.shrunk.move));
    });
  }
});

describe("check responsive: replay and determinism", () => {
  const orphan = join(FIXTURES, "mutants", "pricing--orphan-width.html");

  it("finds a one-pixel orphan width that uniform sampling would almost never draw", async () => {
    const report = await runResponsiveCheck({ ...options(orphan), runs: 12 });
    const overflow = report.failures.find((f) => f.kind === "page-overflow-x");
    assert.deepEqual([overflow?.shrunk?.interval.lo, overflow?.shrunk?.interval.hi], [768, 768]);
    assert.deepEqual(report.transitions.map((t) => t.width), [768, 769, 1100]);
  });

  it("replays one case from a reproduce line without generating or shrinking", async () => {
    const report = await runResponsiveCheck(options(orphan, ["--width", "768"]));
    assert.equal(report.cases, 1);
    assert.equal(report.replay?.width, 768);
    assert.equal(report.failures[0]?.kind, "page-overflow-x");
    assert.equal(report.failures[0]?.shrunk, undefined);
    const clean = await runResponsiveCheck(options(orphan, ["--width", "767"]));
    assert.equal(clean.failures.length, 0);
  });

  it("generates the same cases for the same seed", async () => {
    const page = join(FIXTURES, "patterns", "sidebar-layout.html");
    const a = await runResponsiveCheck({ ...options(page, ["--seed", "7", "--runs", "15"]), noCause: true });
    const b = await runResponsiveCheck({ ...options(page, ["--seed", "7", "--runs", "15"]), noCause: true });
    assert.deepEqual(a.regimes.map((r) => r.cases), b.regimes.map((r) => r.cases));
    assert.equal(a.cases, 15);
  });
});

describe("check responsive as a library: a caller's own property", () => {
  it("generates, shrinks and anchors a property the gate does not ship", async () => {
    // "The table of contents is showing" — true from 1200px up on the sidebar pattern. A
    // stand-in for a project rule (a sticky bar taller than a third of the screen, a CTA
    // below the fold) that only the project can state.
    const tocShown: ResponsiveProperty = {
      kinds: ["toc-shown"],
      measure: async (page) => {
        const shown = await page.evaluate(() => getComputedStyle(document.querySelector(".toc")!).display !== "none");
        return shown ? [{ kind: "toc-shown", severity: "warn", selector: "aside.toc", targets: ["aside.toc"], message: "the contents column is showing" }] : [];
      },
    };
    const report = await withBrowser(async (browser) => {
      const page = await browser.newPage();
      await page.goto(`file://${join(FIXTURES, "patterns", "sidebar-layout.html")}`);
      return await runResponsiveOnPage(page, { source: "sidebar-layout.html", runs: 20, properties: [tocShown] });
    });
    assert.deepEqual(report.properties, ["toc-shown"]);
    const failure = report.failures[0];
    assert.equal(failure?.kind, "toc-shown");
    assert.deepEqual([failure?.shrunk?.interval.lo, failure?.shrunk?.interval.hi], [1200, 1440]);
    assert.equal(failure?.shrunk?.anchor.kind, "whole-regime");
    assert.equal(failure?.shrunk?.move, undefined, "a failure reaching the widest width has no move to try");
    // The cause search overrides layout declarations; `display` is not one, so it says so rather than guessing.
    assert.ok(failure?.cause === undefined);
  });
});

describe("check responsive: argument parsing", () => {
  it("turns --width into a replay that pins the other dimensions given", () => {
    const o = options("page.html", ["--width", "390", "--height", "700", "--text-scale", "1.5", "--color-scheme", "dark"]);
    assert.deepEqual(o.replay, { width: 390, height: 700, textScale: 1.5, colorScheme: "dark" });
    assert.equal(o.textScale, undefined, "in a replay --text-scale is the case, not the ladder's top");
  });

  it("refuses a pinned colour scheme with nothing to pin it to", () => {
    assert.throws(() => options("page.html", ["--color-scheme", "dark"]), /--width/);
  });

  it("builds the text-scale ladder from its top rung", () => {
    assert.deepEqual(textScaleLadder(undefined), [1]);
    assert.deepEqual(textScaleLadder(2), [1, 1.25, 1.5, 1.75, 2]);
    assert.deepEqual(textScaleLadder(1.4), [1, 1.25, 1.4]);
  });
});

function summary(report: ResponsiveReport): string {
  return report.failures.map((f) =>
    `  ${f.kind} ${f.selectors[0]} ${f.shrunk ? `${f.shrunk.interval.lo}-${f.shrunk.interval.hi} ${f.shrunk.anchor.kind}` : "(unshrunk)"} cause=${f.cause?.declarations.map((d) => d.property).join("+") ?? f.causeNote}`,
  ).join("\n") || "  (no failures)";
}
