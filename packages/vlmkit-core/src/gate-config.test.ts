import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  type GateConfig,
  gateMatches,
  parseGateConfig,
  resolveGatePlan,
  resolveSuppression,
  summarizeSuppressions,
} from "./gate-config.ts";

const NOW = new Date("2026-08-02T12:00:00Z");

const json = (value: unknown) => JSON.stringify(value);

describe("parseGateConfig", () => {
  it("accepts a minimal config", () => {
    const config = parseGateConfig(json({
      defaults: { gates: ["check integrity"] },
      pages: [{ source: "index.html" }],
    }));
    assert.deepEqual(config.pages, [{ id: "index.html", source: "index.html" }]);
    assert.deepEqual(config.defaults?.gates, ["check integrity"]);
  });

  it("defaults a page id to its source, and keeps ids unique", () => {
    const config = parseGateConfig(json({
      pages: [{ source: "a.html", gates: ["check integrity"] }, { id: "b", source: "b.html", gates: ["check design"] }],
    }));
    assert.deepEqual(config.pages.map((p) => p.id), ["a.html", "b"]);
    assert.throws(
      () => parseGateConfig(json({ pages: [{ id: "x", source: "a.html", gates: ["g"] }, { id: "x", source: "b.html", gates: ["g"] }] })),
      /duplicate page id "x"/,
    );
  });

  it("rejects a suppression with no reason", () => {
    // A flag records what was silenced but not why, which is exactly the state
    // that gets re-approved a year later without anyone knowing what it was for.
    assert.throws(
      () => parseGateConfig(json({
        pages: [{
          source: "a.html",
          gates: ["check copy"],
          suppressions: [{ gate: "check copy", flag: "--allow-invisible hidden" }],
        }],
      })),
      /pages\[0\]\.suppressions\[0\]: reason is required/,
    );
  });

  it("rejects a malformed or impossible expiry", () => {
    const withExpiry = (expires: string) => json({
      pages: [{
        source: "a.html",
        gates: ["check copy"],
        suppressions: [{ gate: "check copy", flag: "--x", reason: "r", expires }],
      }],
    });
    assert.throws(() => parseGateConfig(withExpiry("soon")), /expires must be YYYY-MM-DD/);
    assert.throws(() => parseGateConfig(withExpiry("2026-13-45")), /not a real date/);
    assert.doesNotThrow(() => parseGateConfig(withExpiry("2026-12-01")));
  });

  it("refuses a page with no gates from any source", () => {
    assert.throws(
      () => parseGateConfig(json({ pages: [{ source: "a.html" }] })),
      /pages\[0\]: no gates/,
    );
  });

  it("refuses an empty page list rather than running nothing", () => {
    assert.throws(() => parseGateConfig(json({ pages: [] })), /pages: is empty/);
  });

  it("names the JSON path in every structural error", () => {
    assert.throws(() => parseGateConfig("{"), /not valid JSON/);
    assert.throws(() => parseGateConfig(json({ pages: "routes" })), /pages: must be an array/);
    assert.throws(() => parseGateConfig(json({ pages: [{ gates: ["g"] }] })), /pages\[0\]: source is required/);
    assert.throws(
      () => parseGateConfig(json({ pages: [{ source: "a.html", gates: ["ok", ""] }] })),
      /pages\[0\]\.gates\[1\]: must be a non-empty string/,
    );
  });
});

describe("gateMatches", () => {
  it("matches on whole tokens, not substrings", () => {
    assert.equal(gateMatches("check copy --manifest x.txt", "check copy"), true);
    assert.equal(gateMatches("check copy", "check"), true);
    assert.equal(gateMatches("check copyright", "check copy"), false);
    assert.equal(gateMatches("check copy", "check copy --manifest x.txt"), false);
    assert.equal(gateMatches("check design", "check copy"), false);
  });
});

describe("resolveSuppression", () => {
  it("treats the expiry day itself as still valid", () => {
    assert.equal(resolveSuppression({ gate: "g", flag: "-f", reason: "r", expires: "2026-08-02" }, "p", NOW).status, "active");
    assert.equal(resolveSuppression({ gate: "g", flag: "-f", reason: "r", expires: "2026-08-01" }, "p", NOW).status, "expired");
  });

  it("reports days left, negative when overdue", () => {
    assert.equal(resolveSuppression({ gate: "g", flag: "-f", reason: "r", expires: "2026-08-12" }, "p", NOW).daysLeft, 10);
    assert.equal(resolveSuppression({ gate: "g", flag: "-f", reason: "r", expires: "2026-07-28" }, "p", NOW).daysLeft, -5);
  });

  it("calls a missing expiry permanent rather than active", () => {
    const r = resolveSuppression({ gate: "g", flag: "-f", reason: "r" }, "p", NOW);
    assert.equal(r.status, "permanent");
    assert.equal(r.daysLeft, null);
  });
});

describe("resolveGatePlan", () => {
  const config: GateConfig = parseGateConfig(json({
    defaults: { gates: ["check integrity", "check design"] },
    pages: [
      {
        id: "checkout",
        source: "checkout.html",
        extraGates: ["check copy --manifest copy.txt"],
        suppressions: [{
          gate: "check copy",
          flag: "--allow-invisible visually-hidden",
          reason: "skip link is assistive-tech only",
          owner: "web-platform",
          expires: "2026-12-01",
        }],
      },
      { id: "game", source: "game.html", gates: ["check design"], suppressions: [{
        gate: "check design",
        flag: "--min-reuse 2",
        reason: "zones intentionally differ",
        expires: "2026-07-01",
      }] },
    ],
  }));

  it("expands defaults plus extras, in order", () => {
    const plan = resolveGatePlan(config, { now: NOW });
    assert.deepEqual(plan.jobs.filter((j) => j.pageId === "checkout").map((j) => j.baseGate), [
      "check integrity",
      "check design",
      "check copy --manifest copy.txt",
    ]);
  });

  it("appends an active suppression's flag to the matching gate only", () => {
    const plan = resolveGatePlan(config, { now: NOW });
    const copy = plan.jobs.find((j) => j.baseGate.startsWith("check copy"))!;
    assert.equal(copy.gate, "check copy --manifest copy.txt --allow-invisible visually-hidden");
    assert.equal(copy.appliedSuppressions.length, 1);
    const integrity = plan.jobs.find((j) => j.baseGate === "check integrity")!;
    assert.equal(integrity.gate, "check integrity");
    assert.deepEqual(integrity.appliedSuppressions, []);
  });

  it("does NOT apply an expired suppression — the gate goes back to failing", () => {
    // An expiry that keeps working after it passes is a comment, not a deadline.
    const plan = resolveGatePlan(config, { now: NOW });
    const game = plan.jobs.find((j) => j.pageId === "game")!;
    assert.equal(game.gate, "check design");
    assert.deepEqual(game.appliedSuppressions, []);
    assert.equal(plan.expired.length, 1);
    assert.equal(plan.expired[0]!.scope, "game");
  });

  it("applies the same suppression once it is renewed", () => {
    const plan = resolveGatePlan(config, { now: new Date("2026-06-01T00:00:00Z") });
    assert.equal(plan.jobs.find((j) => j.pageId === "game")!.gate, "check design --min-reuse 2");
    assert.deepEqual(plan.expired, []);
  });

  it("applies default-scope suppressions to every page", () => {
    const shared = parseGateConfig(json({
      defaults: {
        gates: ["check copy --manifest c.txt"],
        suppressions: [{ gate: "check copy", flag: "--allow-invisible visually-hidden", reason: "sr-only nav" }],
      },
      pages: [{ id: "a", source: "a.html" }, { id: "b", source: "b.html" }],
    }));
    const plan = resolveGatePlan(shared, { now: NOW });
    assert.equal(plan.jobs.length, 2);
    assert.ok(plan.jobs.every((j) => j.gate.endsWith("--allow-invisible visually-hidden")));
    assert.equal(plan.suppressions.length, 1);
    assert.equal(plan.suppressions[0]!.scope, "defaults");
  });

  it("filters pages with --only by id or source substring", () => {
    assert.deepEqual(
      [...new Set(resolveGatePlan(config, { now: NOW, only: ["game"] }).jobs.map((j) => j.pageId))],
      ["game"],
    );
    assert.deepEqual(
      [...new Set(resolveGatePlan(config, { now: NOW, only: ["checkout.html"] }).jobs.map((j) => j.pageId))],
      ["checkout"],
    );
    assert.deepEqual(resolveGatePlan(config, { now: NOW, only: ["nope"] }).jobs, []);
  });

  it("inventories suppressions from filtered-out pages too", () => {
    // The inventory is of the config, not of this run: narrowing to one page
    // must not hide what is silenced elsewhere.
    const plan = resolveGatePlan(config, { now: NOW, only: ["checkout"] });
    assert.equal(plan.suppressions.length, 2);
    assert.equal(plan.expired.length, 1);
  });
});

describe("summarizeSuppressions", () => {
  const rows = [
    { gate: "a", flag: "-1", reason: "r", expires: "2026-07-01" },
    { gate: "b", flag: "-2", reason: "r", expires: "2026-08-10", owner: "team" },
    { gate: "c", flag: "-3", reason: "r", expires: "2027-01-01", owner: "team" },
    { gate: "d", flag: "-4", reason: "r" },
  ].map((s) => resolveSuppression(s, "p", NOW));

  it("counts each status, plus unowned and expiring-soon", () => {
    const summary = summarizeSuppressions(rows, 30);
    assert.equal(summary.expired, 1);
    assert.equal(summary.active, 2);
    assert.equal(summary.permanent, 1);
    assert.equal(summary.expiringSoon, 1); // 2026-08-10 is 8 days out
    assert.equal(summary.unowned, 1); // the permanent one; the expired is excluded
  });

  it("sorts expired first, then soonest expiry", () => {
    assert.deepEqual(summarizeSuppressions(rows).rows.map((r) => r.gate), ["a", "b", "c", "d"]);
  });
});
