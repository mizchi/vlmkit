import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
  applySelectorAllowRules,
  parseSelectorAllowRules,
  selectorAllowFilter,
} from "./selector-exemption.ts";

const rules = parseSelectorAllowRules([
  "button#export;the export button is the one primary action",
  "div.card;cards are a deliberate second style",
  "input#serach;typo'd, so it exempts nothing",
]);

describe("selectorAllowFilter", () => {
  it("keeps what no rule names, and lists what one does instead of dropping it", () => {
    const allow = selectorAllowFilter(rules);
    assert.equal(allow.keep("main>button#export"), false);
    assert.equal(allow.keep("section>div.card>h2"), false, "substring: the path only has to contain it");
    assert.equal(allow.keep("main>button#save"), true);
    assert.deepEqual(allow.allowed, [
      { selector: "main>button#export", reason: "the export button is the one primary action" },
      { selector: "section>div.card>h2", reason: "cards are a deliberate second style" },
    ]);
  });

  it("names the rules that matched nothing, as written", () => {
    const allow = selectorAllowFilter(rules);
    allow.keep("main>button#export");
    assert.deepEqual(allow.unused(), [
      "div.card;cards are a deliberate second style",
      "input#serach;typo'd, so it exempts nothing",
    ]);
    // Asked again after more rows, it reflects them: a gate reads it once, at the end.
    allow.keep("div.card>p");
    assert.deepEqual(allow.unused(), ["input#serach;typo'd, so it exempts nothing"]);
  });

  it("matches exactly as applySelectorAllowRules does, since both share one rule", () => {
    const paths = ["main>button#export", "div.card>p", "main>button#save", "aside>div.cards"];
    const allow = selectorAllowFilter(rules);
    const kept = paths.filter((p) => allow.keep(p));
    const applied = applySelectorAllowRules(paths, rules, (p) => p);
    assert.deepEqual(kept, applied.kept);
    assert.deepEqual(allow.unused(), applied.unused.map((r) => r.raw));
  });
});
