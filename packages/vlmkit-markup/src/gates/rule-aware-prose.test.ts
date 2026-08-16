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

// ---------------------------------------------------------------------------
// The sixteen gates migrated after the first eight, finishing the set.
//
// Seven of them share a report shape — `issues[]` with a `kind` and a `severity` — and go
// through `../rule-prose.ts`. They are tested individually anyway: what the helper cannot
// guarantee is that each formatter actually routes its own rows and its own "nothing found"
// line through it, and that is the mistake worth catching. The other nine have bespoke shapes
// and their own reasons to get this wrong, listed per describe.
// ---------------------------------------------------------------------------

import { formatCopyCheckReport } from "../inspect/copy-check.ts";
import { formatBreakpointCheckReport } from "../stress/breakpoint-check.ts";
import { formatScrollBehaviorReport } from "../inspect/scroll-behavior.ts";
import { formatScrollScanReport } from "../inspect/scroll-scan.ts";
import { formatMotionDetectionReport } from "../style/motion-detect.ts";
import { formatAnimationEvalReport } from "../style/animation-eval.ts";
import { formatAssetCheckReport } from "../asset/asset-check.ts";
import { formatLayoutReport } from "../inspect/layout-contract.ts";
import { formatStoryVrtReport } from "../component/story-vrt.ts";
import { formatComponentConsistencyReport } from "../component/component-consistency.ts";
import { formatMultiPageConsistencyReport } from "../stress/multi-page-consistency.ts";
import { formatMarkupVerifyReport } from "../verify/markup-verify-report.ts";
import { formatFlowReport } from "../inspect/flow-verify.ts";
import { formatRegionJudgeReport } from "../inspect/region-judge.ts";

describe("check copy", () => {
  const report = {
    source: "p.html", textLength: 120, statesExplored: 0, droppedStates: 0, manifestLines: 2,
    missingLines: ["Sign up"], invisibleLines: [], allowedInvisibleLines: [], revealedLines: [],
    issues: [
      { kind: "copy-missing", severity: "suspect", message: `"Sign up" is not on the page` },
      { kind: "placeholder-text", severity: "suspect", message: "Lorem ipsum at p.intro" },
    ],
  };

  it("off drops the row and the status word follows", () => {
    const off = plain(formatCopyCheckReport(report as never, ruleViewFrom({ "placeholder-text": "off" })));
    assert.match(off, /status: suspect/, "one rule is still on");
    assert.doesNotMatch(off, /Lorem ipsum/);
    assert.match(off, /1 finding\(s\) not shown — rule turned off \(placeholder-text x1\)/);
  });

  it("all rules off says so instead of 'No copy issues detected'", () => {
    const off = plain(formatCopyCheckReport(
      report as never,
      ruleViewFrom({ "placeholder-text": "off", "copy-missing": "off" }),
    ));
    assert.match(off, /status: ok/);
    assert.doesNotMatch(off, /No copy issues detected/, "two issues were measured — that line would be false");
    assert.match(off, /2 finding\(s\) not shown/);
  });
});

describe("check breakpoints", () => {
  const report = {
    source: "p.html", checkedValues: [768], breakpoints: [{ value: 768, samples: [], spikes: [{}], gaps: [], raw: [] }],
    issues: [
      { kind: "boundary-spike", severity: "suspect", message: "height jumps 40px at 768", selector: ".grid" },
      { kind: "sweep-overflow", severity: "warn", message: "overflow 12px at 812" },
    ],
  };

  it("off keeps the per-breakpoint measurement and drops the finding", () => {
    const off = plain(formatBreakpointCheckReport(report as never, ruleViewFrom({ "boundary-spike": "off" })));
    assert.match(off, /768px: 1 spike\(s\)/, "the spike count is measured, not reported — it stays");
    assert.doesNotMatch(off, /height jumps 40px/, "the finding row goes");
    assert.match(off, /1 finding\(s\) not shown — rule turned off \(boundary-spike x1\)/);
  });

  it("with every rule off it does not claim all boundaries consistent", () => {
    const off = plain(formatBreakpointCheckReport(
      report as never,
      ruleViewFrom({ "boundary-spike": "off", "sweep-overflow": "off" }),
    ));
    assert.doesNotMatch(off, /All boundaries consistent/);
    assert.match(off, /2 finding\(s\) not shown/);
  });
});

describe("check scroll", () => {
  const report = {
    source: "p.html", pageScrolled: 500, stickyFixed: [], engagedSticky: 0, snaps: [],
    issues: [{ kind: "sticky-not-sticking", severity: "suspect", message: "moved with the page", selector: "header" }],
  };

  it("re-tuned to warn re-labels rather than silencing", () => {
    const warn = plain(formatScrollBehaviorReport(report as never, ruleViewFrom({ "sticky-not-sticking": "warn" })));
    assert.match(warn, /status: warn/);
    assert.match(warn, /! sticky-not-sticking header: moved with the page \[sticky-not-sticking re-tuned to warn\]/);
  });
});

describe("scan scroll", () => {
  const report = {
    source: "p.html", page: { viewportWidth: 1280, viewportHeight: 720, scrollWidth: 1400, scrollHeight: 2000, horizontalOverflow: 120, verticalScroll: 1280 },
    containers: [], deadScrollports: [], clipped: [], expectedScrollports: [],
    issues: [{ kind: "page-overflow-x", severity: "suspect", message: "page scrolls 120px sideways", selector: ".hero" }],
  };

  it("off keeps the measured overflow number in the page line", () => {
    const off = plain(formatScrollScanReport(report as never, ruleViewFrom({ "page-overflow-x": "off" })));
    assert.match(off, /horizontal overflow 120px/, "120px was measured either way");
    assert.match(off, /status: ok/);
    assert.doesNotMatch(off, /No scroll issues detected/);
    assert.match(off, /1 finding\(s\) not shown — rule turned off \(page-overflow-x x1\)/);
  });
});

describe("check motion", () => {
  const report = {
    source: "p.html", sampleCount: 3, activeAnimationCount: 4, activeTransitionCount: 1,
    runningAnimationCount: 4, pausedAnimationCount: 0, hasReducedMotionRule: false, samples: [],
    issues: [
      { kind: "missing-reduced-motion", severity: "suspect", message: "no reduce rule" },
      { kind: "running-animation", severity: "warn", message: "fadeIn is running", selector: ".card" },
    ],
  };

  it("off drops one row and keeps the other, counts intact", () => {
    const off = plain(formatMotionDetectionReport(report as never, ruleViewFrom({ "running-animation": "off" })));
    assert.match(off, /running animations: 4/, "the animation count is a measurement");
    assert.match(off, /x missing-reduced-motion/);
    assert.doesNotMatch(off, /fadeIn is running/);
    assert.match(off, /1 finding\(s\) not shown — rule turned off \(running-animation x1\)/);
  });
});

describe("check animation", () => {
  const report = {
    source: "p.html", viewport: { width: 1280, height: 720 }, animationCount: 4, evaluated: [], infinite: [],
    settleMs: 4500, reducedMotion: { remainingCount: 2 },
    issues: [
      { kind: "long-settle", severity: "warn", message: "4500ms to settle" },
      { kind: "reduced-motion-ignored", severity: "suspect", message: "2 still running", selector: ".card" },
    ],
  };

  it("stops tagging a status line with a rule that is no longer reporting", () => {
    // The status block's `[long-settle]` tag is the trap here: the number is still measured, so
    // the line stays, but pointing it at an off rule sends the reader to a rule that says
    // nothing. Reported by a dogfood agent as the reason those lines were unreadable.
    const off = plain(formatAnimationEvalReport(report as never, ruleViewFrom({ "long-settle": "off" })));
    assert.match(off, /settle: 4500ms/, "the settle time is a measurement");
    assert.doesNotMatch(off, /\[long-settle\]/, "but nothing claims a live rule carries it");
    assert.match(off, /reduced-motion: 2 animation\(s\) still running \[reduced-motion-ignored\]/, "the other tag stays");
  });

  it("unset is unchanged from before the migration", () => {
    const bare = plain(formatAnimationEvalReport(report as never));
    assert.equal(plain(formatAnimationEvalReport(report as never, ruleViewFrom({}))), bare);
    assert.match(bare, /settle: 4500ms \[long-settle\]/);
  });
});

describe("check asset", () => {
  const report = {
    source: "hero.png", width: 1200, height: 630, aspect: 1.905, backgroundKind: "opaque",
    occupancy: 0.42, issues: [{ kind: "opaque-background", severity: "suspect", message: "no alpha channel" }],
  };

  it("off keeps the measured background kind", () => {
    const off = plain(formatAssetCheckReport(report as never, ruleViewFrom({ "opaque-background": "off" })));
    assert.match(off, /background: opaque/);
    assert.match(off, /status: ok/);
    assert.match(off, /1 finding\(s\) not shown/);
  });
});

describe("check layout", () => {
  const report = {
    source: "p.html", done: false, passed: 1, total: 2,
    results: [
      { rule: { selector: ".card" }, viewport: 1280, passed: false, checks: [{ name: "perRow", expected: "3", measured: "2", passed: false }] },
      { rule: { selector: ".hero" }, viewport: 1280, passed: true, checks: [{ name: "visible", expected: "true", passed: true }] },
    ],
  };

  it("recomputes the verdict when every failing check's rule is off", () => {
    // A contract gate's verdict is the loudest line it prints, and `VIOLATED` over the runner's
    // `exits 0` is the contradiction this migration exists to remove.
    const off = plain(formatLayoutReport(report as never, ruleViewFrom({ "per-row": "off" })));
    assert.match(off, /verdict: SATISFIED \(1\/2 rules\)/, "passed/total stay as measured");
    assert.match(off, /- perRow: expected 3, measured 2 — NOT reported \(per-row off\)/, "the row keeps its measurement");
    assert.match(off, /1 failing check\(s\) not reported — rule turned off \(per-row x1\)/);
  });

  it("unset still reports the violation", () => {
    const bare = plain(formatLayoutReport(report as never));
    assert.match(bare, /verdict: VIOLATED \(1\/2 rules\)/);
    assert.match(bare, /✗ perRow: expected 3, measured 2/);
  });
});

describe("check story", () => {
  const report = {
    gallery: "g.html", viewport: { width: 800, height: 600 }, threshold: 0.01, storyPixels: 0, pagePixels: 0,
    results: [
      { story: "Button/Primary", outcome: "changed", width: 88, height: 36, diffRatio: 0.04, diffPixels: 120, totalPixels: 3168 },
      { story: "Card/Default", outcome: "new-baseline", width: 274, height: 88, baselinePath: "b.png" },
    ],
  };

  it("off leaves the story row and its percentage, without the failure marker", () => {
    const off = plain(formatStoryVrtReport(report as never, ruleViewFrom({ "story-drift": "off" })));
    assert.match(off, /- Button\/Primary/, "the row is this component's whole result — it stays");
    assert.match(off, /4\.00% diff/, "and so does the number");
    assert.doesNotMatch(off, /✗ Button/);
    assert.match(off, /1 story result\(s\) measured and NOT reported — rule turned off \(story-drift x1\)/);
  });

  it("new-baseline off stops the yellow + on a baseline-writing run", () => {
    // `--update-baseline` on a project that turned this off used to print a warning per story
    // under an exit 0 — a warning about the thing the operator asked for.
    const off = plain(formatStoryVrtReport(report as never, ruleViewFrom({ "new-baseline": "off" })));
    assert.match(off, /- Card\/Default/);
    assert.match(off, /✗ Button\/Primary/, "the drift is untouched");
  });
});

describe("check drift component", () => {
  const report = {
    html: "p.html", selector: ".card", instanceCount: 3, referenceIndex: 0, allowRuleCount: 0, instances: [],
    reportPath: "r.md",
    deltas: [
      { candidateIndex: 1, diffRatio: 0.047, bboxDeltas: { width: 0, height: 0 }, styleDeltas: [{ property: "padding-top", reference: "20px", candidate: "12px" }], exemptedStyleDeltas: [], paletteOnlyInCand: 0, paletteOnlyInRef: 0 },
      { candidateIndex: 2, diffRatio: 0.002, bboxDeltas: { width: 0, height: 0 }, styleDeltas: [], exemptedStyleDeltas: [], paletteOnlyInCand: 0, paletteOnlyInRef: 0 },
    ],
  };

  it("off neutralizes the marker and keeps the property list", () => {
    const off = plain(formatComponentConsistencyReport(report as never, ruleViewFrom({ "instance-drift": "off" })));
    assert.match(off, /- instance #1/);
    assert.match(off, /padding-top: 20px → 12px/, "the properties are the actionable part and stay");
    assert.match(off, /1 instance\(s\) measured and NOT reported — rule turned off \(instance-drift x1\)/);
    assert.match(off, /~ instance #2/, "an info-severity row under a different rule is untouched");
  });
});

describe("check drift pages", () => {
  const report = {
    selector: "header", reference: "index.html", reportPath: "r.md",
    deltas: [
      { candidate: "about.html", diffRatio: 0.08, bboxDeltas: { width: 0, height: 0 }, paletteOnlyInCand: 0, paletteOnlyInRef: 0, heatmapRegions: 1 },
      { candidate: "blog.html", diffRatio: Number.NaN, bboxDeltas: { width: 0, height: 0 }, paletteOnlyInCand: 0, paletteOnlyInRef: 0, heatmapRegions: 0 },
    ],
  };

  it("separates page-drift from selector-missing, as the gate's findings do", () => {
    const off = plain(formatMultiPageConsistencyReport(report as never, ruleViewFrom({ "page-drift": "off" })));
    assert.match(off, /- about\.html\s+8\.00%/, "measured, not reported");
    assert.match(off, /! blog\.html\s+n\/a/, "the missing selector is a different rule and still warns");
    assert.match(off, /1 page\(s\) measured and NOT reported — rule turned off \(page-drift x1\)/);
  });
});

describe("verify markup", () => {
  const report = {
    attempt: 2, done: false, kickback: ["fix the gap"], trend: undefined,
    targets: [{ target: "t.png", width: 1280, height: 800, pass: false, matched: 4, missing: 1, missingBlocking: 1, extra: 0, extraBlocking: 0, orderViolations: 0, gapDeltas: 0, pixelDiffRatio: 0.03, renderedHeight: 900 }],
    gates: [{ gate: "check integrity", gateId: "check.integrity", suspects: 2, warns: 0, summary: "2 defects" }],
  };

  it("does not print NOT DONE when every rule behind the residuals is off", () => {
    const off = plain(formatMarkupVerifyReport(
      report as never,
      ruleViewFrom({ "target-failed": "off", "gate-suspect": "off" }),
    ));
    assert.match(off, /verdict: DONE \(residuals remain, but every rule covering them is off\)/);
    assert.match(off, /fail — NOT reported/, "the target row still says it failed the measurement");
    assert.match(off, /suspect x2 — NOT reported/);
    assert.match(off, /rule\(s\) turned off for this run: target-failed, gate-suspect/);
  });

  it("one rule off is not enough — the other still holds the verdict", () => {
    const off = plain(formatMarkupVerifyReport(report as never, ruleViewFrom({ "target-failed": "off" })));
    assert.match(off, /verdict: NOT DONE/);
    assert.match(off, /suspect x2/);
  });
});

describe("verify flow", () => {
  const report = {
    source: "p.html", done: false, passed: 1, total: 2,
    steps: [
      { index: 0, label: "open", passed: true, assertions: [] },
      { index: 1, label: "submit", passed: false, assertions: [{ passed: false, assert: { assert: "text", selector: ".toast", contains: "Saved" }, actual: "" }] },
    ],
  };

  it("step-failed off keeps the step count and drops the failure claim", () => {
    const off = plain(formatFlowReport(report as never, ruleViewFrom({ "step-failed": "off" })));
    assert.match(off, /verdict: DONE \(1\/2 steps\) \(step-failed off/);
    assert.match(off, /- step 2: submit/, "the step is still listed");
  });

  it("unset reports the failure", () => {
    assert.match(plain(formatFlowReport(report as never)), /verdict: FAILED \(1\/2 steps\)/);
  });
});

describe("check equivalence", () => {
  const report = {
    source: "a.html", target: "b.png",
    verdicts: [
      { outcome: "different", region: { left: 0, top: 0, width: 100, height: 50 }, measuredDelta: 12.4, pairImage: "p1.png" },
      { outcome: "pending-review", region: { left: 0, top: 60, width: 100, height: 50 }, measuredDelta: 4.1, pairImage: "p2.png" },
    ],
  };

  it("pending-review off drops the ACTION REQUIRED block it would otherwise demand", () => {
    // Turning it off is the statement "unjudged regions are acceptable here", so a block
    // demanding a human reader is asking for work the project declined.
    const off = plain(formatRegionJudgeReport(report as never, ruleViewFrom({ "pending-review": "off" })));
    assert.doesNotMatch(off, /ACTION REQUIRED/);
    assert.match(off, /PENDING-REVIEW.*NOT reported \(pending-review off\)/);
    assert.match(off, /DIFFERENT/, "the other verdict is untouched");
  });

  it("unset asks for the reader", () => {
    assert.match(plain(formatRegionJudgeReport(report as never)), /ACTION REQUIRED — keyless mode:/);
  });
});
