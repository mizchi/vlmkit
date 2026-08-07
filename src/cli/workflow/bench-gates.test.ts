/**
 * The bench's judgment, without launching 270 browsers.
 *
 * Two things here are worth testing and one is not. The timings are not — they
 * are whatever the machine does. What matters is (a) which gates the bench
 * decides it can run, because that is derived from the contract rather than from
 * a list, and (b) the attribution and formatting math, because those are the
 * numbers a reader will act on and both were wrong in the first draft: the
 * per-rule `findings` column counted *runs* rather than findings, and
 * `attributedMs` summed across runs so it scaled with `--repeat` and could not
 * be compared to the gate median printed beside it.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { UsageError } from "@mizchi/vlmkit-core/cli-error.ts";
import { defineGate } from "@mizchi/vlmkit-core/plugin/contract.ts";
import type { BenchGatesReport } from "./bench-gates.ts";
import {
  formatBenchGates,
  formatBenchGatesMarkdown,
  isBenchable,
  parseBenchGatesArgs,
} from "./bench-gates.ts";
import { loadGateRegistry, resetGateRegistryCache } from "../gate-registry.ts";

const stub = (inputs: Parameters<typeof defineGate>[0]["inputs"]) =>
  defineGate<unknown, unknown>({
    id: "check.stub",
    command: ["check", "stub"],
    title: "stub",
    summary: "a stub gate used to test input classification",
    rules: [{ id: "r", title: "r", severity: "warn" }],
    inputs,
    parse: () => ({}),
    run: () => ({}),
    findings: () => [],
    format: () => "",
  });

describe("which gates the bench can run", () => {
  it("accepts a gate whose positional is a page and needs nothing else", () => {
    assert.equal(
      isBenchable(stub([
        { name: "source", placeholder: "html-or-url", kind: "path-or-url", description: "Page", positional: 0, required: true },
        { name: "viewports", kind: "number-list", description: "Widths" },
      ])),
      true,
    );
  });

  it("rejects a gate with another required input", () => {
    assert.equal(
      isBenchable(stub([
        { name: "source", placeholder: "html-or-url", kind: "path-or-url", description: "Page", positional: 0, required: true },
        { name: "target", kind: "path", description: "Target image", required: true },
      ])),
      false,
    );
  });

  it("rejects a gate whose positional is a file rather than a page", () => {
    // `check asset` takes a PNG. Feeding it HTML failed inside the PNG decoder
    // with "unrecognised content at end of stream", which reads like a broken
    // fixture rather than a gate that was never applicable.
    assert.equal(
      isBenchable(stub([
        { name: "source", placeholder: "asset.png", kind: "path", description: "Asset PNG", positional: 0, required: true },
      ])),
      false,
    );
  });

  it("rejects a gate with no positional at all", () => {
    assert.equal(isBenchable(stub([{ name: "url", kind: "string", description: "Crater URL" }])), false);
  });

  it("selects 18 of the 27 built-ins, and every one of them takes a page", async () => {
    // The count is a canary: a new gate that takes a page should join the bench
    // by existing, and one that does not must not be dragged in.
    resetGateRegistryCache();
    const registry = await loadGateRegistry({ builtinsOnly: true });
    const benchable = registry.list().filter(({ gate }) => isBenchable(gate));
    assert.equal(benchable.length, 18, benchable.map(({ gate }) => gate.id).join(", "));
    for (const { gate } of benchable) {
      const positional = (gate.inputs ?? []).find((i) => i.positional === 0);
      assert.equal(positional?.kind, "path-or-url", `${gate.id} positional is not a page`);
    }
    // And the excluded ones are excluded for a stated reason, not by accident.
    const excluded = registry.list().filter(({ gate }) => !isBenchable(gate)).map(({ gate }) => gate.id);
    assert.deepEqual(excluded.sort(), [
      "check.asset",
      "check.crater",
      "check.drift.component",
      "check.drift.pages",
      "check.equivalence",
      "check.layout",
      "check.story",
      "verify.flow",
      "verify.markup",
    ]);
  });
});

describe("bench argument parsing", () => {
  it("requires at least one source", () => {
    assert.throws(() => parseBenchGatesArgs(["--repeat", "3"]), UsageError);
  });

  it("does not read a flag value as a source", () => {
    const options = parseBenchGatesArgs(["--repeat", "5", "page.html", "--gate", "check scroll"]);
    assert.deepEqual(options.sources, ["page.html"]);
    assert.equal(options.repeat, 5);
    assert.deepEqual(options.gates, ["check scroll"]);
  });

  it("rejects an unknown category by name, listing the real ones", () => {
    assert.throws(
      () => parseBenchGatesArgs(["page.html", "--category", "accessibility"]),
      /unknown category "accessibility".*correctness/s,
    );
  });

  it("defaults to 3 repeats and text output", () => {
    const options = parseBenchGatesArgs(["page.html"]);
    assert.equal(options.repeat, 3);
    assert.equal(options.format, "text");
    assert.equal(options.probeSuppression, false);
  });
});

/** A report shaped like a real one, with numbers chosen so the math is checkable. */
const REPORT: BenchGatesReport = {
  sources: ["a.html", "b.html"],
  repeat: 2,
  gates: [
    {
      command: "check interactions",
      gateId: "check.interactions",
      category: "behavior",
      plugin: "@mizchi/vlmkit-markup",
      runs: 4,
      medianTotalMs: 6420,
      minTotalMs: 2753,
      maxTotalMs: 13705,
      medianRunMs: 6400,
      runSharePct: 99.7,
      medianFindingsMs: 0.12,
      medianFindings: 5,
      rulesDeclared: 15,
      rulesFired: 3,
      msPerFinding: 1280,
    },
    {
      command: "check copy",
      gateId: "check.copy",
      category: "correctness",
      plugin: "@mizchi/vlmkit-markup",
      runs: 4,
      medianTotalMs: 673,
      minTotalMs: 639,
      maxTotalMs: 770,
      medianRunMs: 670,
      runSharePct: 99.6,
      medianFindingsMs: 0.02,
      medianFindings: 0,
      rulesDeclared: 5,
      rulesFired: 0,
      msPerFinding: null,
    },
  ],
  rules: [
    {
      gateId: "check.interactions",
      rule: "inert-control",
      declaredSeverity: "warn",
      firedRuns: 4,
      totalRuns: 4,
      findings: 4.4,
      attributedMs: 5157,
      msPerFinding: 1172,
    },
    {
      gateId: "check.copy",
      rule: "placeholder-text",
      declaredSeverity: "suspect",
      firedRuns: 0,
      totalRuns: 4,
      findings: 0,
      attributedMs: 0,
      msPerFinding: null,
    },
  ],
  totals: {
    gates: 2,
    benchedRuns: 8,
    wallMs: 28372,
    measurementMs: 7070,
    projectionMs: 0.14,
    rulesDeclared: 20,
    rulesNeverFired: 1,
  },
  suppressionProbe: {
    command: "check interactions",
    allRulesOnMs: 7403,
    allRulesOffMs: 7432,
    deltaMs: 29,
    deltaPct: 0.4,
  },
};

const plain = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");

describe("bench output", () => {
  it("states that per-rule cost is an allocation, not a measurement", () => {
    // The single most misreadable number in the report. If this sentence ever
    // disappears, a reader will take `attributed/run` for an isolated timing and
    // conclude that pruning rules saves that much time.
    for (const text of [plain(formatBenchGates(REPORT)), formatBenchGatesMarkdown(REPORT)]) {
      assert.match(text, /allocation of a\s+shared cost, not an isolated timing/);
      assert.match(text, /not separately executed/);
    }
  });

  it("reports the suppression probe as noise, with the reason", () => {
    for (const text of [plain(formatBenchGates(REPORT)), formatBenchGatesMarkdown(REPORT)]) {
      assert.match(text, /0\.4%/);
      assert.match(text, /(noise|Noise)/);
      assert.match(text, /AFTER the|after\*\* the/);
    }
  });

  it("keeps a gate that found nothing on the table rather than dropping it", () => {
    // A gate at zero findings is a budget line, and hiding it would make the
    // total unexplainable.
    const text = plain(formatBenchGates(REPORT));
    assert.match(text, /check copy/);
    assert.match(text, /0\/5/);
  });

  it("names never-fired rules and refuses to call them dead weight", () => {
    for (const text of [plain(formatBenchGates(REPORT)), formatBenchGatesMarkdown(REPORT)]) {
      assert.match(text, /1 of 20 rules never fired|never fired \(1 of 20\)/);
      assert.match(text, /defect class/);
    }
    assert.match(formatBenchGatesMarkdown(REPORT), /check\.copy\/placeholder-text/);
  });

  it("emits markdown tables with aligned column counts", () => {
    // A row with the wrong cell count renders as broken markdown on GitHub,
    // which is invisible in a terminal and obvious in the published report.
    const md = formatBenchGatesMarkdown(REPORT);
    for (const block of md.split("\n\n")) {
      const rows = block.split("\n").filter((line) => line.startsWith("|"));
      if (rows.length < 2) continue;
      const width = rows[0]!.split("|").length;
      for (const row of rows) {
        assert.equal(row.split("|").length, width, `ragged table row: ${row}`);
      }
    }
  });

  it("shows an errored gate as an error row instead of a fake zero", () => {
    const withError: BenchGatesReport = {
      ...REPORT,
      gates: [{ ...REPORT.gates[1]!, error: "unrecognised content at end of stream" }],
    };
    const text = plain(formatBenchGates(withError));
    assert.match(text, /error/);
    assert.doesNotMatch(text, /\b0ms\b/, "an errored gate must not report 0ms as if it were fast");
  });
});
