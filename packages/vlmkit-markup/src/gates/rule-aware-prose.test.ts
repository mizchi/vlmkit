/**
 * Eight formatters, one property: with a rule turned off, the prose stops reporting it.
 *
 * Before this, `--rule x=off` changed the exit code and nothing on the screen. The runner
 * printed `N finding(s) suppressed by rule settings` under a report that still listed all N and
 * still counted them on its own status line, so the two halves of one screen disagreed and the
 * runner had to disclaim the top half. `src/cli/gate-registry.test.ts` tracks which gates have
 * been migrated; this file checks that each migration actually did the thing.
 *
 * The reports are minimal literals rather than real runs: what is under test is the projection
 * from a report plus settings to prose, and a browser adds nothing to that. `as never` casts
 * follow the idiom in `integrity-check.test.ts` — a formatter reads a handful of fields, and
 * writing out every field of eight report types would obscure which ones matter.
 */
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { ruleViewFrom } from "@mizchi/vlmkit-core/plugin/rule-tier.ts";
import { formatA11yContrastReport } from "../a11y-contrast.ts";
import { formatA11yTouchReport } from "../a11y-touch.ts";
import { formatFocusOrderReport } from "../a11y-focus-order.ts";
import { formatDesignTokensReport } from "../style/design-tokens.ts";
import { formatThemeParityReport } from "../style/theme-parity.ts";
import { formatDesignReport } from "../style/design-policy.ts";
import { formatI18nStressReport } from "../stress/i18n-stress.ts";
import { formatMediaVariantsReport } from "../stress/media-variants.ts";

/** ESC included: `/\[[0-9;]*m/` leaves the escape byte behind and every match then misses. */
const plain = (s: string) => s.replace(/\[[0-9;]*m/g, "");

describe("check a11y touch", () => {
  const report = {
    source: "p.html", level: "AAA", required: 44, viewport: { width: 1280, height: 720 },
    screenshot: "s.png", inspectedCount: 3, reportPath: "r.md",
    failures: [
      { path: "a.one", bbox: { width: 30, height: 14 }, minSide: 14, required: 44, text: "Terms" },
      { path: "a.two", bbox: { width: 20, height: 14 }, minSide: 14, required: 44, text: "Docs" },
    ],
  };

  it("off keeps the measured count and drops the rows", () => {
    const off = plain(formatA11yTouchReport(report as never, ruleViewFrom({ "target-undersized": "off" })));
    assert.match(off, /2 undersized target\(s\) measured and NOT reported/);
    assert.doesNotMatch(off, /a\.one/, "the rows go");
    assert.doesNotMatch(off, /✗/, "and so does the failure marker");
  });

  it("re-tuned to warn says so instead of printing a failure", () => {
    const warn = plain(formatA11yTouchReport(report as never, ruleViewFrom({ "target-undersized": "warn" })));
    assert.match(warn, /! 2 undersized target\(s\) \[target-undersized re-tuned to warn\]/);
    assert.match(warn, /a\.one/, "the rows stay — a demotion is not a silencing");
  });

  it("unset is unchanged from before the migration", () => {
    const bare = plain(formatA11yTouchReport(report as never));
    const unset = plain(formatA11yTouchReport(report as never, ruleViewFrom({})));
    assert.equal(unset, bare);
    assert.match(bare, /✗ 2 undersized target\(s\)/);
  });
});

describe("check a11y contrast", () => {
  const report = {
    html: "p.html", totalText: 9, screenshot: "s.png", reportPath: "r.md",
    failures: [{ path: "p.hint", ratio: 2.8, requiredAA: 4.5, foreground: { hex: "#999" }, background: { hex: "#fff" }, text: "Hi" }],
  };

  it("off reports the measurement and no failure", () => {
    const off = plain(formatA11yContrastReport(report as never, ruleViewFrom({ "contrast-below-aa": "off" })));
    assert.match(off, /1 contrast failure\(s\) measured and NOT reported/);
    assert.doesNotMatch(off, /p\.hint/);
  });
});

describe("check a11y focus", () => {
  const report = {
    source: "p.html", viewport: { width: 1280, height: 720 }, screenshot: "s.png", reportPath: "r.md",
    steps: [{}, {}, {}],
    findings: [
      { kind: "reverse", fromIndex: 1, toIndex: 2, message: "moved up" },
      { kind: "skip-row", fromIndex: 2, toIndex: 3, message: "jumped down" },
    ],
  };

  it("turning one of three rules off leaves the others counted", () => {
    const off = plain(formatFocusOrderReport(report as never, ruleViewFrom({ "skip-row": "off" })));
    assert.match(off, /✗ 1 finding\(s\)/);
    assert.match(off, /1 finding\(s\) not shown — rule turned off \(skip-row x1\)/);
    assert.doesNotMatch(off, /jumped down/);
    assert.match(off, /moved up/);
  });

  it("with only warn-level findings left, the marker is a warning, not a failure", () => {
    const off = plain(formatFocusOrderReport(report as never, ruleViewFrom({ reverse: "off" })));
    assert.match(off, /! 1 finding\(s\)/);
  });
});

describe("check tokens", () => {
  const base = {
    source: "p.html", viewport: { width: 1280, height: 720 }, config: {}, inspectedCount: 12, reportPath: "r.md",
    violations: [
      { property: "padding", path: "div.a", tag: "div", value: 7, nearest: 8 },
      { property: "padding", path: "div.b", tag: "div", value: 9, nearest: 8 },
    ],
    shadow: { distinctShadows: ["a", "b", "c"], allowedTiers: 2 },
  };

  it("one rule off leaves the other reporting", () => {
    const off = plain(formatDesignTokensReport(base as never, ruleViewFrom({ "scale-violation": "off" })));
    assert.match(off, /1 finding\(s\)/);
    assert.match(off, /2 finding\(s\) not shown — rule turned off \(scale-violation x2\)/);
    assert.doesNotMatch(off, /padding/);
    assert.match(off, /box-shadow/, "the shadow rule is still on");
  });

  it("warn-level findings print a warning marker, matching the exit code", () => {
    // Not a red ✗: these are warns by default, and the runner prints `exits 0 — N warn(s)`
    // right underneath. The previous formatter printed ✗ for any finding at all.
    assert.match(plain(formatDesignTokensReport(base as never)), /! 3 finding\(s\)/);
  });

  it("--strict marks them as failures, because that is the severity they were emitted at", () => {
    // The rule TABLE says warn either way, so a formatter reading the table would print a
    // warning over an exit 1. `report.strict` is echoed by the gate for exactly this line.
    assert.match(plain(formatDesignTokensReport({ ...base, strict: true } as never)), /✗ 3 finding\(s\)/);
  });
});

describe("check theme", () => {
  const report = {
    html: "p.html", viewport: { width: 1280, height: 900 }, lightScreenshot: "l.png", darkScreenshot: "d.png",
    themePixelDelta: 0.001, totalMatched: 4, reportPath: "r.md",
    unthemed: [{ rank: 1, bbox: { left: 0, top: 0, width: 10, height: 10 }, lightFill: { hex: "#fff" }, darkFill: { hex: "#fff" }, fillDelta: 0 }],
  };

  it("each of its two rules can be silenced without touching the other", () => {
    const noUnthemed = plain(formatThemeParityReport(report as never, ruleViewFrom({ "unthemed-component": "off" })));
    assert.match(noUnthemed, /unthemed components: 1 of 4 — measured and NOT reported/);
    assert.match(noUnthemed, /! theme pixel delta/, "the inert warning is untouched");

    const noInert = plain(formatThemeParityReport(report as never, ruleViewFrom({ "theme-inert": "off" })));
    assert.match(noInert, /theme pixel delta: 0.1% .*reported as a reading only/);
    // `!`, not `✗`: both of this gate's rules are warns, and the runner prints
    // `exits 0 — N warn(s)` under it. The old formatter hardcoded red here.
    assert.match(noInert, /! unthemed components/, "and this one still reports");
  });
});

describe("stress i18n", () => {
  const wrap = { path: "div.a", tag: "div", text: "x", kind: "vertical-wrap", before: { width: 10, height: 10, clientWidth: 10, scrollWidth: 10 }, after: { width: 10, height: 20, clientWidth: 10, scrollWidth: 10 } };
  const report = { html: "p.html", inflateFactor: 1.4, beforeScreenshot: "b.png", afterScreenshot: "a.png", totalInspected: 20, reportPath: "r.md", overflowing: [wrap, { ...wrap, path: "div.b" }] };

  it("the rule people actually turn off empties the list and says why", () => {
    const off = plain(formatI18nStressReport(report as never, ruleViewFrom({ "vertical-wrap": "off" })));
    assert.match(off, /✓ 0 overflow \/ wrap issue\(s\)/);
    assert.match(off, /2 finding\(s\) not shown — rule turned off \(vertical-wrap x2\)/);
    assert.doesNotMatch(off, /div\.a/);
  });

  it("wraps alone are a warning, not a failure", () => {
    assert.match(plain(formatI18nStressReport(report as never)), /! 2 overflow/);
  });
});

describe("stress media", () => {
  const report = {
    source: "p.html", viewport: { width: 1280, height: 720 }, defaultScreenshot: "d.png", reportPath: "r.md",
    variants: [
      { variant: "print", screenshotPath: "p.png", deltaRatio: 0, deltaPixels: 0, totalPixels: 1, verdict: "warn", note: "no print rule" },
      { variant: "rtl", screenshotPath: "r.png", deltaRatio: 0.07, deltaPixels: 1, totalPixels: 1, verdict: "suspect", note: "physical props" },
    ],
  };

  it("keeps every variant's row — the delta is a measurement — and drops only the grade", () => {
    const off = plain(formatMediaVariantsReport(report as never, ruleViewFrom({ "variant-ignored": "off" })));
    assert.match(off, /print/, "the row survives");
    assert.match(off, /- print/, "with a neutral marker");
    assert.match(off, /no longer graded — rule turned off \(variant-ignored x1\)/);
    assert.match(off, /✗ rtl/, "the other variant is untouched");
  });
});

describe("check design", () => {
  const report = {
    source: "p.html", verdict: "drift", findings: [{ kind: "component-drift", severity: "warn", role: "button", message: "2 styles" }],
    roles: [], spacingValues: 3, excludedElements: 0, exclusions: [], judgedElements: 4, skipped: 1, statefulSkipped: 0,
    skippedTags: [], textFreeSamples: 0, textFreeFolded: 0, thresholds: { minReuse: 3, minInstances: 3 },
  };

  it("does not claim 'no design drift detected' for drift it was told not to report", () => {
    const off = plain(formatDesignReport(report as never, ruleViewFrom({ "component-drift": "off" })));
    assert.match(off, /No design drift reported — every finding's rule is off/);
    assert.doesNotMatch(off, /No design drift detected/, "that sentence would be false here");
    assert.match(off, /the verdict word above predates the settings/, "and DRIFT still prints, explained");
  });

  it("with no settings it still reports the drift", () => {
    const bare = plain(formatDesignReport(report as never));
    assert.match(bare, /\[component-drift\] button: 2 styles/);
    assert.match(bare, /verdict: DRIFT \(1 finding\(s\)\)/);
  });
});
