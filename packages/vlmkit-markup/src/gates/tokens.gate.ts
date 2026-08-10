/**
 * `check tokens` as a gate definition. The measurement in
 * `../style/design-tokens.ts` is unchanged except for one extraction: its
 * terminal summary moved out of `runDesignTokens` into
 * `formatDesignTokensReport`, because a measurement function that prints
 * cannot be reused by the MCP server or asserted on in a test.
 *
 * Severities are `warn` by default, on purpose. This gate checks conformance
 * to a scale the *caller* declares, and before the migration it exited zero
 * unless you passed `--strict`. Making a suspect the default would turn every
 * existing CI job red on a value someone chose deliberately. `--strict` is
 * kept and now promotes both rules to `suspect`; the same promotion is
 * available per-project without the flag:
 *
 *   vlmkit.gates.json → "rules": { "check.tokens/scale-violation": "suspect" }
 */

import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { readFlag, readNumber } from "@mizchi/vlmkit-core/arg-reader.ts";
import { UsageError } from "@mizchi/vlmkit-core/cli-error.ts";
import { PAGE_LOAD_INPUTS, type PageLoadOptions, parsePageLoad, pickPageLoad } from "@mizchi/vlmkit-core/page-load.ts";
import { defineGate } from "@mizchi/vlmkit-core/plugin/contract.ts";
import type { Finding } from "@mizchi/vlmkit-core/plugin/contract.ts";
import {
  type DesignTokenConfig,
  type DesignTokensReport,
  formatDesignTokensReport,
  runDesignTokens,
} from "../style/design-tokens.ts";
import { firstPositional, numberListFloat, optionalInt } from "./arg-helpers.ts";

export interface TokensGateOptions extends PageLoadOptions {
  source: string;
  outputDir: string;
  reportPath?: string;
  configPath?: string;
  config: DesignTokenConfig;
  strict: boolean;
}

const TOKENS_VALUE_FLAGS = [
  "--output-dir",
  "--report",
  "--config",
  "--radius-scale",
  "--spacing-scale",
  "--z-scale",
  "--shadow-tiers",
  "--tolerance",
];

export const tokensGate = defineGate<DesignTokensReport, TokensGateOptions>({
  id: "check.tokens",
  command: ["check", "tokens"],
  title: "Design-token scale conformance",
  summary: "Design-token scale conformance (against a scale YOU declare)",
  category: "design-system",
  usage: `Checks every visible element's border-radius, padding, margin, z-index and
box-shadow against the scales you declare, and writes a markdown report
naming the nearest in-scale value for each violation.

Findings are warn-level by default: the scale is your choice, so an
off-scale value is a smell rather than a defect. --strict promotes them to
suspect for one run; "rules" in vlmkit.gates.json does it permanently.`,
  rules: [
    {
      id: "scale-violation",
      title: "Value is off the declared scale",
      severity: "warn",
      docs: "The report names the nearest in-scale value. Promote to suspect to enforce the scale in CI.",
    },
    {
      id: "shadow-tier-excess",
      title: "More distinct box-shadow values than the allowed tier count",
      severity: "warn",
      docs: "Consolidate into named tiers (--shadow-lg etc.) and reference the variables.",
    },
  ],
  inputs: [
    { name: "source", placeholder: "html-or-url", kind: "path-or-url", description: "Page to check", positional: 0, required: true },
    { name: "config", placeholder: "path", kind: "path", description: "JSON config: { radius, spacing, zIndex, shadowTiers, tolerance }" },
    { name: "radius-scale", placeholder: "list", kind: "number-list", description: "Allowed border-radius values", defaultDescription: "0,2,4,6,8,12,16,20,24,32,48,999" },
    { name: "spacing-scale", placeholder: "list", kind: "number-list", description: "Allowed padding/margin values", defaultDescription: "0,2,4,8,12,16,20,24,32,40,48,64,80,96" },
    { name: "z-scale", placeholder: "list", kind: "number-list", description: "Allowed z-index values", defaultDescription: "0,1,10,100,1000,9999" },
    { name: "shadow-tiers", placeholder: "n", kind: "number", description: "Max distinct box-shadow values", defaultDescription: "5" },
    { name: "tolerance", placeholder: "px", kind: "number", description: "Snap tolerance", defaultDescription: "0.5" },
    { name: "strict", kind: "boolean", description: "Treat violations as suspects (exit 1)" },
    { name: "output-dir", placeholder: "dir", kind: "path", description: "Output directory", defaultDescription: "./test-results/design-tokens" },
    { name: "report", placeholder: "path", kind: "path", description: "Markdown report path" },
    ...PAGE_LOAD_INPUTS,
  ],
  parse: (argv) => {
    const source = firstPositional(argv, "vlmkit check tokens <html-or-url>", TOKENS_VALUE_FLAGS);
    const radius = numberListFloat(argv, "radius-scale");
    const spacing = numberListFloat(argv, "spacing-scale");
    const zIndex = numberListFloat(argv, "z-scale");
    const shadowTiers = optionalInt(argv, "shadow-tiers", { min: 1 });
    const tolerance = readNumber(argv, "tolerance", { min: 0 });
    const outputDir = readFlag(argv, "output-dir");
    const reportPath = readFlag(argv, "report");
    const configPath = readFlag(argv, "config");
    for (const [flag, scale] of [["--radius-scale", radius], ["--spacing-scale", spacing], ["--z-scale", zIndex]] as const) {
      if (scale && scale.length === 0) throw new UsageError(`${flag} needs at least one value`);
    }
    return {
      source,
      outputDir: outputDir ?? join(process.cwd(), "test-results", "design-tokens"),
      strict: argv.includes("--strict"),
      config: {
        ...(radius ? { radius } : {}),
        ...(spacing ? { spacing } : {}),
        ...(zIndex ? { zIndex } : {}),
        ...(shadowTiers !== undefined ? { shadowTiers } : {}),
        ...(tolerance !== undefined ? { tolerance } : {}),
      },
      ...(reportPath ? { reportPath } : {}),
      ...(configPath ? { configPath } : {}),
      ...parsePageLoad(argv),
    };
  },
  run: async (options) => {
    // The file config is the base; flags override it key by key, matching the
    // precedence the CLI had.
    const fileConfig = options.configPath
      ? (JSON.parse(await readFile(resolve(options.configPath), "utf-8")) as DesignTokenConfig)
      : undefined;
    return runDesignTokens({
      source: options.source,
      outputDir: options.outputDir,
      ...(options.reportPath ? { reportPath: options.reportPath } : {}),
      config: { ...fileConfig, ...options.config },
      ...pickPageLoad(options),
    });
  },
  findings: (report, options): Finding[] => {
    const severity = options.strict ? "suspect" : "warn";
    const findings: Finding[] = report.violations.map((violation) => ({
      rule: "scale-violation",
      severity,
      message:
        `${violation.property}${violation.side ? ` (${violation.side})` : ""} ${violation.value.toFixed(2)}`
        + ` is off scale — nearest in-scale value is ${violation.nearest}`,
      evidence: { path: violation.path, tag: violation.tag, value: violation.value, nearest: violation.nearest },
    }));
    if (report.shadow.distinctShadows.length > report.shadow.allowedTiers) {
      findings.push({
        rule: "shadow-tier-excess",
        severity,
        message:
          `${report.shadow.distinctShadows.length} distinct box-shadow values`
          + ` (allowed: ${report.shadow.allowedTiers})`,
        evidence: { shadows: report.shadow.distinctShadows },
      });
    }
    return findings;
  },
  format: formatDesignTokensReport,
  ledger: (report, options) => ({
    tool: "check-tokens",
    source: options.source,
    headline: {
      inspected: report.inspectedCount,
      violations: report.violations.length,
      distinctShadows: report.shadow.distinctShadows.length,
      report: report.reportPath,
    },
  }),
});
