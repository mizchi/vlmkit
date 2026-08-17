import assert from "node:assert/strict";
import { describe, it } from "vitest";
import type { IntegrityFinding } from "./integrity-check.ts";
import {
  applyAllowRules,
  parseAllowRule,
  parseAllowRules,
  ruleMatches,
} from "./integrity-exemption.ts";

const finding = (over: Partial<IntegrityFinding> = {}): IntegrityFinding => ({
  kind: "near-misalignment",
  severity: "warn",
  viewport: 1280,
  selector: "main>div.card>button.btn-b",
  message: "off by 2px",
  ...over,
});

describe("parseAllowRule", () => {
  it("parses kind, selector, viewport and reason", () => {
    assert.deepEqual(parseAllowRule("text-collision@.kicker@1280;deliberate pull-up"), {
      kind: "text-collision",
      selector: ".kicker",
      viewport: 1280,
      reason: "deliberate pull-up",
      raw: "text-collision@.kicker@1280;deliberate pull-up",
    });
  });

  it("accepts a selector containing an ID", () => {
    // `#` was the original reason delimiter, which split at the selector's own
    // `#` and silently produced an empty selector — a far broader exemption than
    // the one written.
    const rule = parseAllowRule("text-collision@#refund;the labels are meant to graze");
    assert.equal(rule.selector, "#refund");
    assert.equal(rule.reason, "the labels are meant to graze");
  });

  it("keeps later semicolons in the reason", () => {
    assert.equal(parseAllowRule("invisible-text@.sr;a; b; c").reason, "a; b; c");
  });

  it("treats kind-only as every selector and viewport", () => {
    const rule = parseAllowRule("low-contrast-text;brand grey signed off");
    assert.equal(rule.selector, undefined);
    assert.equal(rule.viewport, undefined);
  });

  it("requires a reason, and points at the right delimiter", () => {
    assert.throws(() => parseAllowRule("text-collision@.kicker"), /needs a reason/);
    assert.throws(
      () => parseAllowRule("text-collision@#refund#because"),
      /separated by ";", not "#"/,
    );
    assert.throws(() => parseAllowRule("text-collision;   "), /reason is empty/);
  });

  it("rejects an unknown kind rather than silencing nothing", () => {
    // A typo that quietly exempts nothing is the worst outcome for a
    // suppression flag: it looks applied and changes nothing.
    assert.throws(() => parseAllowRule("low-contrast-txt;typo"), /unknown finding kind "low-contrast-txt"/);
    assert.throws(() => parseAllowRule("low-contrast-txt;typo"), /Valid kinds: .*low-contrast-text/);
  });

  it("refuses to exempt the kinds that mean the page is broken", () => {
    for (const kind of ["js-error", "degenerate-render", "unstyled-page", "redirected"]) {
      assert.throws(
        () => parseAllowRule(`${kind};too noisy`),
        /cannot exempt/,
        `expected ${kind} to be non-exemptable`,
      );
    }
  });

  it("skips blank specs in a list", () => {
    assert.equal(parseAllowRules(["", "  ", "text-collision;r"]).length, 1);
  });
});

describe("ruleMatches", () => {
  const rule = parseAllowRule("near-misalignment@.btn-b@1280;optical");

  it("matches on kind, selector substring and viewport", () => {
    assert.equal(ruleMatches(rule, finding()), true);
  });

  it("does not match a different kind, selector or viewport", () => {
    assert.equal(ruleMatches(rule, finding({ kind: "text-collision" })), false);
    assert.equal(ruleMatches(rule, finding({ selector: "main>button.btn-c" })), false);
    assert.equal(ruleMatches(rule, finding({ viewport: 375 })), false);
  });

  it("matches every viewport when none is given", () => {
    const anyViewport = parseAllowRule("near-misalignment@.btn-b;optical");
    assert.equal(ruleMatches(anyViewport, finding({ viewport: 375 })), true);
  });

  it("matches by substring, so an added ancestor class does not break it", () => {
    const anySelector = parseAllowRule("near-misalignment@.btn-b;optical");
    assert.equal(ruleMatches(anySelector, finding({ selector: "main>div.card.new>button.btn-b" })), true);
  });

  it("never matches a selector-scoped rule against a finding with no selector", () => {
    assert.equal(ruleMatches(rule, finding({ selector: undefined })), false);
  });
});

describe("applyAllowRules", () => {
  it("moves a matched finding into exempted, with the reason attached", () => {
    const rules = parseAllowRules(["near-misalignment@.btn-b;icon is optically centred"]);
    const result = applyAllowRules([finding(), finding({ selector: "main>button.btn-c" })], rules);
    assert.equal(result.findings.length, 1);
    assert.equal(result.findings[0]!.selector, "main>button.btn-c");
    assert.equal(result.exempted.length, 1);
    assert.match(result.exempted[0]!.reason, /^user exemption \(near-misalignment@\.btn-b\): icon is optically/);
    // The suppression stays in the report rather than vanishing.
    assert.equal(result.exempted[0]!.kind, "near-misalignment");
    assert.equal(result.exempted[0]!.viewport, 1280);
  });

  it("reports a rule that matched nothing", () => {
    const rules = parseAllowRules(["text-collision@.gone;covered a defect that is now fixed"]);
    const result = applyAllowRules([finding()], rules);
    assert.equal(result.findings.length, 1);
    assert.deepEqual(result.unusedRules.map((r) => r.raw), ["text-collision@.gone;covered a defect that is now fixed"]);
  });

  it("counts a rule as used once, however many findings it covers", () => {
    const rules = parseAllowRules(["near-misalignment;grid is optical"]);
    const result = applyAllowRules([finding(), finding({ viewport: 375 })], rules);
    assert.equal(result.exempted.length, 2);
    assert.deepEqual(result.unusedRules, []);
  });

  it("is a no-op with no rules, and does not alias the input", () => {
    const input = [finding()];
    const result = applyAllowRules(input, []);
    assert.deepEqual(result.findings, input);
    assert.notEqual(result.findings, input);
    assert.deepEqual(result.exempted, []);
  });

  it("can exempt a fail-severity finding, which is the point", () => {
    // An accepted `fail` flips the verdict — that is what the flag is for, and
    // why it is listed in the report instead of being dropped.
    const rules = parseAllowRules(["text-collision@#refund;the labels are meant to graze"]);
    const result = applyAllowRules(
      [finding({ kind: "text-collision", severity: "fail", selector: "#total x #refund" })],
      rules,
    );
    assert.deepEqual(result.findings, []);
    assert.equal(result.exempted.length, 1);
  });
});
