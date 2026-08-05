/**
 * `check perf` as a gate definition — the app-side plugin.
 *
 * A third plugin from a third place. `check perf`'s measurement lives in
 * `src/util/perf.ts` rather than in a published package, and the registry does
 * not care: the CLI composes `[markup, capture, app]` exactly the way it would
 * compose a user's plugin. That is the property worth having — no privileged
 * location.
 *
 * BREAKING CHANGE, deliberate and worth stating loudly: this command used to
 * exit **2** for a `needs-improvement` verdict and **1** for `poor`, and only
 * under `--strict`. The shared contract has two outcomes, so exit 2 is gone.
 * The distinction it encoded survives where it belongs — in the findings:
 * `poor` is a suspect (exit 1) and `needs-improvement` is a warn (exit 0). A
 * script branching on exit code 2 needs `--json` and `counts.warn` instead.
 *
 * `--strict` is kept as an accepted no-op: a poor verdict now fails by
 * default, and `--advisory` is the opt-out.
 */

import { join } from "node:path";
import { readFlag } from "@mizchi/vlmkit-core/arg-reader.ts";
import { defineGate, definePlugin } from "@mizchi/vlmkit-core/plugin/contract.ts";
import type { Finding } from "@mizchi/vlmkit-core/plugin/contract.ts";
import { readInt, readPositionals } from "@mizchi/vlmkit-core/arg-reader.ts";
import { UsageError } from "@mizchi/vlmkit-core/cli-error.ts";
import { type PerfOptions, type PerfReport, formatPerfReport, runPerf } from "../util/perf.ts";

/** Web-Vitals thresholds, restated here so the rule docs can name them. */
const THRESHOLDS = {
  cls: { good: 0.1, poor: 0.25 },
  lcp: { good: 2500, poor: 4000 },
  fcp: { good: 1800, poor: 3000 },
} as const;

type MetricKey = keyof typeof THRESHOLDS;

export const perfGate = defineGate<PerfReport, PerfOptions>({
  id: "check.perf",
  command: ["check", "perf"],
  title: "Web Vitals thresholds",
  summary: "Web Vitals thresholds (CLS / LCP / FCP)",
  usage: `Loads the page, observes for --observe ms after networkidle, and reports
Cumulative Layout Shift, Largest Contentful Paint and First Contentful Paint
against the standard Web Vitals thresholds. Names the top layout-shift source,
which is usually the actionable part.

A "poor" verdict fails the command; "needs-improvement" is a warn. (Before
0.9.2 this needed --strict and used exit code 2 for needs-improvement.)`,
  rules: [
    {
      id: "cls-poor",
      title: `Cumulative Layout Shift above ${THRESHOLDS.cls.poor}`,
      severity: "suspect",
      docs: "The report names the element that shifted most.",
    },
    { id: "cls-needs-improvement", title: `CLS above ${THRESHOLDS.cls.good}`, severity: "warn" },
    { id: "lcp-poor", title: `Largest Contentful Paint above ${THRESHOLDS.lcp.poor}ms`, severity: "suspect" },
    { id: "lcp-needs-improvement", title: `LCP above ${THRESHOLDS.lcp.good}ms`, severity: "warn" },
    { id: "fcp-poor", title: `First Contentful Paint above ${THRESHOLDS.fcp.poor}ms`, severity: "suspect" },
    { id: "fcp-needs-improvement", title: `FCP above ${THRESHOLDS.fcp.good}ms`, severity: "warn" },
  ],
  inputs: [
    { name: "source", placeholder: "html-or-url", kind: "path-or-url", description: "Page to measure", positional: 0, required: true },
    { name: "observe", placeholder: "ms", kind: "number", description: "Observation window after networkidle", defaultDescription: "3000" },
    { name: "strict", kind: "boolean", description: "Accepted no-op (a poor verdict already exits 1)" },
    { name: "output-dir", placeholder: "dir", kind: "path", description: "Output directory", defaultDescription: "./test-results/perf" },
    { name: "report", placeholder: "path", kind: "path", description: "Markdown report path" },
  ],
  parse: (argv) => {
    const source = readPositionals(argv, ["--observe", "--output-dir", "--report"])[0];
    if (!source) throw new UsageError("missing required argument. Usage: vlmkit check perf <html-or-url>");
    const observeMs = readInt(argv, "observe", { min: 0 });
    const outputDir = readFlag(argv, "output-dir");
    const reportPath = readFlag(argv, "report");
    return {
      source,
      outputDir: outputDir ?? join(process.cwd(), "test-results", "perf"),
      ...(observeMs !== undefined ? { observeMs } : {}),
      ...(reportPath ? { reportPath } : {}),
    };
  },
  run: (options) => runPerf(options),
  findings: (report): Finding[] => {
    const findings: Finding[] = [];
    const measured: Record<MetricKey, number> = { cls: report.cls, lcp: report.lcp, fcp: report.fcp };
    const unit: Record<MetricKey, string> = { cls: "", lcp: "ms", fcp: "ms" };
    for (const metric of ["cls", "lcp", "fcp"] as const) {
      const verdict = report.verdicts[metric];
      if (verdict === "good") continue;
      const poor = verdict === "poor";
      findings.push({
        rule: `${metric}-${poor ? "poor" : "needs-improvement"}`,
        severity: poor ? "suspect" : "warn",
        message:
          `${metric.toUpperCase()} ${measured[metric]}${unit[metric]} is ${verdict}`
          + ` (good <= ${THRESHOLDS[metric].good}${unit[metric]},`
          + ` poor > ${THRESHOLDS[metric].poor}${unit[metric]})`,
        evidence: { metric, value: measured[metric], verdict },
      });
    }
    // The top shift source is the actionable half of a CLS finding, so it
    // rides along as evidence on that finding rather than as its own row.
    const cls = findings.find((f) => f.rule.startsWith("cls-"));
    if (cls && report.shiftSources.length > 0) {
      cls.evidence = { ...cls.evidence, topShiftSource: report.shiftSources[0] };
    }
    return findings;
  },
  format: formatPerfReport,
  ledger: (report, options) => ({
    tool: "check-perf",
    source: options.source,
    headline: {
      cls: report.cls,
      lcp: report.lcp,
      fcp: report.fcp,
      clsVerdict: report.verdicts.cls,
      lcpVerdict: report.verdicts.lcp,
      fcpVerdict: report.verdicts.fcp,
      report: report.reportPath,
    },
  }),
});

export const appGatesPlugin = definePlugin({
  name: "vlmkit-app",
  gates: [perfGate],
});

export default appGatesPlugin;
