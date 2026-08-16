/**
 * `check perf`'s prose under rule settings.
 *
 * App-side, because this gate is declared in `src/gates/perf.gate.ts` rather than in either
 * package — `packages/vlmkit-markup/src/gates/rule-aware-prose.test.ts` covers the twenty-five
 * there and `packages/vlmkit-capture/src/crater-smoke-prose.test.ts` the one in capture.
 *
 * Two rules per metric (`cls-poor` and `cls-needs-improvement`), so the rule id is the metric
 * plus the verdict. A project that gates on LCP and merely watches CLS turns `cls-poor` off, and
 * the number must still print: a Web Vital that stops being displayed because it stopped being
 * enforced is a monitoring regression dressed as a config change.
 */
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { ruleViewFrom } from "@mizchi/vlmkit-core/plugin/rule-tier.ts";
import { formatPerfReport } from "./perf.ts";

/** `\x1b` explicitly: a pattern that drops it leaves the escape byte behind and every match misses. */
const plain = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");

describe("check perf", () => {
  const report = {
    source: "p.html", observeMs: 3000, viewport: { width: 1280, height: 720 },
    cls: 0.31, lcp: 4600, fcp: 1200, ttfb: 90,
    verdicts: { cls: "poor", lcp: "needs-improvement", fcp: "good" },
    shiftSources: [], reportPath: "r.md",
  };

  it("off keeps the number and drops only the grade", () => {
    const off = plain(formatPerfReport(report as never, ruleViewFrom({ "cls-poor": "off" })));
    assert.match(off, /- CLS {4}0\.31/, "the value is the measurement");
    assert.match(off, /1 metric\(s\) measured and NOT reported — rule turned off \(cls-poor\)/);
    assert.match(off, /! LCP/, "the other metric's grade is untouched");
  });

  it("names the metric-plus-verdict rule, not the metric", () => {
    // `cls-needs-improvement` off must not silence a `poor` CLS: they are separate rules
    // precisely so a project can watch the warning tier without accepting the failing one.
    const off = plain(formatPerfReport(report as never, ruleViewFrom({ "cls-needs-improvement": "off" })));
    assert.match(off, /✗ CLS/, "still graded poor");
    assert.doesNotMatch(off, /NOT reported/);
  });

  it("unset is unchanged", () => {
    const bare = plain(formatPerfReport(report as never));
    assert.equal(plain(formatPerfReport(report as never, ruleViewFrom({}))), bare);
    assert.match(bare, /✗ CLS/);
    assert.match(bare, /! LCP/);
    assert.match(bare, /✓ FCP/);
  });
});
