/**
 * `check crater` as a gate definition, owned by the package that owns the
 * Crater client.
 *
 * This is the second built-in plugin, and it exists to keep the composition
 * story honest: gate definitions live next to their measurement code, not in
 * one central catalog, so `vlmkit-capture` contributes its gate the same way a
 * third party would. If the registry could only be fed from one package, the
 * "core never imports a gate" rule would be decoration.
 *
 * `parseCraterSmokeArgs` is intentionally left in `../crater-smoke.ts`: it is
 * covered by that module's tests and reads `resolveCraterBidiUrl` from the
 * environment, which is behaviour worth keeping tested on its own.
 */

import { defineGate, definePlugin } from "@mizchi/vlmkit-core/plugin/contract.ts";
import type { Finding } from "@mizchi/vlmkit-core/plugin/contract.ts";
import {
  type CraterSmokeOptions,
  type CraterSmokeReport,
  formatCraterSmokeReport,
  parseCraterSmokeArgs,
  runCraterBidiSmoke,
} from "../crater-smoke.ts";

/** The gate needs `requireAvailable` at verdict time, not just at run time. */
export interface CraterGateOptions extends CraterSmokeOptions {
  requireAvailable: boolean;
}

export const craterGate = defineGate<CraterSmokeReport, CraterGateOptions>({
  id: "check.crater",
  command: ["check", "crater"],
  title: "Crater BiDi backend smoke check",
  summary: "Crater BiDi backend smoke check",
  category: "infrastructure",
  usage: `Exercises the Crater BiDi backend end to end: connect, navigate,
screenshot, and (with --deep) the heavier v0.18.0 APIs.

An unreachable Crater is reported as SKIP, not as a failure — the backend is
optional, so a machine without it must not fail the suite. Pass --require in
the CI job that is supposed to have Crater running.`,
  rules: [
    { id: "check-failed", title: "A Crater smoke check failed", severity: "suspect" },
    {
      id: "unavailable",
      title: "Crater is not reachable",
      severity: "info",
      docs: "Info by default because the backend is optional; --require promotes it to a failure.",
    },
  ],
  inputs: [
    { name: "url", placeholder: "ws-url", kind: "string", description: "Crater BiDi URL", defaultDescription: "ws://127.0.0.1:9222 or VLMKIT_CRATER_BIDI_URL" },
    { name: "require", kind: "boolean", description: "Fail if Crater is unavailable" },
    { name: "deep", kind: "boolean", description: "Exercise heavier v0.18.0 APIs (batchRender)" },
  ],
  parse: (argv) => {
    const args = parseCraterSmokeArgs([...argv]);
    return { url: args.url, requireAvailable: args.requireAvailable, deep: args.deep };
  },
  run: (options) => runCraterBidiSmoke(options),
  findings: (report: CraterSmokeReport, options: CraterGateOptions): Finding[] => {
    const findings: Finding[] = [];
    for (const check of report.checks) {
      if (check.status !== "fail") continue;
      findings.push({
        rule: "check-failed",
        severity: "suspect",
        message: `${check.name}: ${check.message}`,
        evidence: { elapsedMs: check.elapsedMs },
      });
    }
    if (report.status === "skip") {
      // `--require` is exactly the request to treat this as a failure, which
      // is why `findings` gets the options: the flag decides the severity.
      findings.push({
        rule: "unavailable",
        severity: options.requireAvailable ? "suspect" : "info",
        message: `Crater not reachable at ${report.url}`
          + (options.requireAvailable ? " (--require)" : " — checks were skipped."),
      });
    }
    return findings;
  },
  format: formatCraterSmokeReport,
  ledger: (report) => ({
    tool: "check-crater",
    source: report.url,
    headline: {
      status: report.status,
      checks: report.checks.length,
      failed: report.checks.filter((c) => c.status === "fail").length,
      elapsedMs: report.elapsedMs,
    },
  }),
});

export const captureGatesPlugin = definePlugin({
  name: "@mizchi/vlmkit-capture",
  gates: [craterGate],
});

export default captureGatesPlugin;
