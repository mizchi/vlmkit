import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
  applyDriftAllowRules,
  parseDriftAllowRule,
  parseDriftAllowRules,
  propertyMatches,
} from "./drift-exemption.ts";

/**
 * Three dogfood agents asked for this in three different ways, and the third named
 * it exactly: "drift lists intentional (colour) and unintentional (geometry) drift in
 * one undifferentiated list — I found no way to bless expected properties."
 */
describe("parseDriftAllowRule", () => {
  it("takes a property, an optional selector, and a required reason", () => {
    const rule = parseDriftAllowRule("background-color@.card--featured;variant accent");
    assert.equal(rule.property, "background-color");
    assert.equal(rule.selector, ".card--featured");
    assert.equal(rule.reason, "variant accent");
    assert.equal(rule.raw, "background-color@.card--featured;variant accent");
  });

  it("applies to every instance when no selector is given", () => {
    assert.equal(parseDriftAllowRule("box-shadow;elevation varies by slot").selector, undefined);
  });

  it("refuses a rule with no reason, and says why", () => {
    assert.throws(
      () => parseDriftAllowRule("background-color@.card--featured"),
      /needs a reason.*cannot be reviewed/s,
    );
  });

  it("names the `;` trap when the spec contains an ID selector", () => {
    // `#` was the obvious delimiter and it silently truncates an ID selector, which
    // is why `check integrity --allow` uses `;` — the same lesson, stated again.
    assert.throws(
      () => parseDriftAllowRule("color@#featured"),
      /separated by ";", not "#"/,
    );
  });

  it("refuses a bare `*`, which is the rule switch wearing a disguise", () => {
    assert.throws(() => parseDriftAllowRule("*;everything"), /--rule instance-drift=off/);
  });

  it("skips blank specs rather than failing on them", () => {
    assert.equal(parseDriftAllowRules(["", "  ", "color;why"]).length, 1);
  });
});

describe("propertyMatches", () => {
  it("matches exactly without a wildcard", () => {
    assert.equal(propertyMatches("padding-top", "padding-top"), true);
    assert.equal(propertyMatches("padding-top", "padding-left"), false);
  });

  it("covers a family with `*`, anchored at both ends", () => {
    // A variant differing in colour differs in four border properties; making the
    // author type all four is how an escape hatch goes unused.
    assert.equal(propertyMatches("padding-*", "padding-left"), true);
    assert.equal(propertyMatches("border-*-color", "border-top-color"), true);
    assert.equal(propertyMatches("border-*-color", "border-top-width"), false);
    // Anchored: a pattern must not match a longer property that merely starts with it.
    assert.equal(propertyMatches("color", "border-top-color"), false);
  });
});

describe("applyDriftAllowRules", () => {
  const deltas = [
    { property: "padding-top", reference: "16px", candidate: "30px" },
    { property: "background-color", reference: "rgb(255,255,255)", candidate: "rgb(238,243,255)" },
    { property: "border-top-color", reference: "rgb(51,51,51)", candidate: "rgb(34,85,204)" },
  ];

  it("keeps the unintentional difference and exempts the declared ones", () => {
    // The whole point: an exemption for the intentional colour must not hide the
    // geometry mistake sitting next to it.
    const applied = applyDriftAllowRules(deltas, "article.card.card--featured", parseDriftAllowRules([
      "background-color@.card--featured;variant accent",
      "border-*-color@.card--featured;variant accent",
    ]));
    assert.deepEqual(applied.styleDeltas.map((d) => d.property), ["padding-top"]);
    assert.equal(applied.exempted.length, 2);
    // The reason travels with it, so a reader can disagree with the decision.
    assert.match(applied.exempted[0]!.reason, /user exemption \(background-color@\.card--featured\): variant accent/);
  });

  it("does not apply a scoped rule to a different instance", () => {
    const applied = applyDriftAllowRules(deltas, "article.card", parseDriftAllowRules([
      "background-color@.card--featured;variant accent",
    ]));
    assert.equal(applied.styleDeltas.length, 3, "the plain card gets no exemption");
    assert.deepEqual(applied.usedRaw, [], "and the rule did not fire here");
  });

  it("reports which rules fired, so an unused one can be surfaced", () => {
    const applied = applyDriftAllowRules(deltas, "article.card.card--featured", parseDriftAllowRules([
      "background-color@.card--featured;variant accent",
      "font-size@.card--featured;stale",
    ]));
    assert.deepEqual(applied.usedRaw, ["background-color@.card--featured;variant accent"]);
  });

  it("is a no-op with no rules", () => {
    const applied = applyDriftAllowRules(deltas, "article.card", []);
    assert.equal(applied.styleDeltas.length, 3);
    assert.deepEqual(applied.exempted, []);
  });
});
