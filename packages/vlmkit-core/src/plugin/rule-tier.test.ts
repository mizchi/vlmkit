import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { applyRuleTiers, hiddenByRuleNote, ruleTier, ruleViewFrom } from "./rule-tier.ts";

describe("ruleTier", () => {
  it("an unset rule keeps the severity the finding was EMITTED at", () => {
    // The whole bug this helper exists for. `check integrity` emits `js-error` as a warn after
    // load and a fail during construction, while its rule table says suspect. Reading the
    // table (which is what `RuleView.effective` falls back to) printed
    // `DEFECTS (1 fail, 0 warn)` directly above the runner's `exits 0 — 1 warn(s)`.
    const view = ruleViewFrom({ "other-rule": "off" });
    assert.equal(ruleTier(view, "js-error", "warn"), "warn");
    assert.equal(ruleTier(view, "js-error", "suspect"), "suspect");
  });

  it("an explicit setting wins, in both directions", () => {
    assert.equal(ruleTier(ruleViewFrom({ a: "off" }), "a", "suspect"), "off");
    assert.equal(ruleTier(ruleViewFrom({ a: "info" }), "a", "suspect"), "info");
    assert.equal(ruleTier(ruleViewFrom({ a: "suspect" }), "a", "warn"), "suspect");
  });

  it("no view at all is the emitted severity — a library call applies no settings", () => {
    assert.equal(ruleTier(undefined, "a", "warn"), "warn");
    assert.equal(ruleTier(undefined, "a", "suspect"), "suspect");
  });
});

describe("ruleViewFrom", () => {
  it("separates 'nobody set this' from 'set to the same value the table has'", () => {
    const view = ruleViewFrom({ set: "warn" });
    assert.equal(view.setting("set"), "warn");
    assert.equal(view.setting("unset"), undefined);
    // `effective` still answers for every rule, which is exactly why a formatter must not use
    // it: it cannot tell these two apart.
    assert.equal(view.effective("unset"), "warn");
    assert.equal(ruleViewFrom({}, "suspect").effective("unset"), "suspect");
  });
});

describe("applyRuleTiers", () => {
  const rows = [
    { id: 1, kind: "trap", sev: "suspect" as const },
    { id: 2, kind: "skip-row", sev: "warn" as const },
    { id: 3, kind: "skip-row", sev: "warn" as const },
  ];
  const partition = (settings: Record<string, "off" | "suspect" | "warn" | "info">) =>
    applyRuleTiers(rows, (r) => ({ rule: r.kind, emitted: r.sev }), ruleViewFrom(settings));

  it("drops the rows whose rule is off and counts them by rule", () => {
    const { shown, hiddenByRule } = partition({ "skip-row": "off" });
    assert.deepEqual(shown.map((s) => s.row.id), [1]);
    assert.deepEqual([...hiddenByRule], [["skip-row", 2]]);
  });

  it("carries the re-tuned severity on each surviving row", () => {
    const { shown } = partition({ trap: "info" });
    assert.deepEqual(shown.map((s) => [s.row.id, s.tier]), [[1, "info"], [2, "warn"], [3, "warn"]]);
  });

  it("with no settings, every row keeps its emitted severity and nothing is hidden", () => {
    const { shown, hiddenByRule } = applyRuleTiers(rows, (r) => ({ rule: r.kind, emitted: r.sev }));
    assert.deepEqual(shown.map((s) => s.tier), ["suspect", "warn", "warn"]);
    assert.equal(hiddenByRule.size, 0);
  });
});

describe("hiddenByRuleNote", () => {
  it("is undefined when nothing was hidden, so a formatter cannot print an empty bullet", () => {
    assert.equal(hiddenByRuleNote(new Map()), undefined);
  });

  it("names the total and the per-rule breakdown", () => {
    const note = hiddenByRuleNote(new Map([["a", 2], ["b", 1]]));
    assert.equal(note, "3 finding(s) not shown — rule turned off (a x2, b x1)");
  });
});
