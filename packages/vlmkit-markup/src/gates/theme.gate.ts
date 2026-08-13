/**
 * `check theme` as a gate definition. As with `check tokens`, the only change
 * to `../style/theme-parity.ts` is that its terminal summary moved out of
 * `runThemeParity` into `formatThemeParityReport`.
 *
 * Both rules default to `warn`: before the migration this command had no exit
 * logic at all — it always exited 0. Defaulting to `suspect` would newly fail
 * every CI job that runs it. The rules make enforcement one line away:
 *
 *   "rules": { "check.theme/unthemed-component": "suspect" }
 */

import { join } from "node:path";
import { readFlag, readNumber } from "@mizchi/vlmkit-core/arg-reader.ts";
import { PAGE_LOAD_INPUTS, parsePageLoad } from "@mizchi/vlmkit-core/page-load.ts";
import { defineGate } from "@mizchi/vlmkit-core/plugin/contract.ts";
import type { Finding } from "@mizchi/vlmkit-core/plugin/contract.ts";
import {
  THEME_INERT_DELTA,
  type ThemeParityOptions,
  type ThemeParityReport,
  formatThemeParityReport,
  runThemeParity,
} from "../style/theme-parity.ts";
import { firstPositional } from "@mizchi/vlmkit-core/plugin/args.ts";

const THEME_VALUE_FLAGS = ["--output-dir", "--report", "--threshold"];

export const themeGate = defineGate<ThemeParityReport, ThemeParityOptions>({
  id: "check.theme",
  command: ["check", "theme"],
  title: "Theme parity",
  summary: "Theme parity (hard-coded color scan in dark mode)",
  category: "design-system",
  usage: `Renders the page twice — prefers-color-scheme light and dark — and
reports components whose dominant fill did not change. Those carry
hard-coded colors instead of theme variables, which is the classic
dark-mode regression. Also reports the overall theme pixel delta, so a
page with no dark-mode styles at all is visible as such.

Findings are warn-level by default (this command previously never failed);
promote them in vlmkit.gates.json to gate CI on theme parity.`,
  rules: [
    {
      id: "unthemed-component",
      title: "Component fill is identical in light and dark mode",
      severity: "warn",
      docs: "Tune the RGB-distance floor with --threshold rather than disabling the rule.",
    },
    {
      id: "theme-inert",
      title: "Page barely responds to the color-scheme toggle",
      severity: "warn",
      docs: `Fewer than ${THEME_INERT_DELTA * 100}% of pixels changed — usually no dark-mode styles at all.`,
    },
  ],
  inputs: [
    { name: "source", placeholder: "html-or-url", kind: "path-or-url", description: "Page to render in both schemes", positional: 0, required: true },
    { name: "output-dir", placeholder: "dir", kind: "path", description: "Screenshot output directory", defaultDescription: "./test-results/theme-parity" },
    { name: "report", placeholder: "path", kind: "path", description: "Markdown report path" },
    {
      name: "threshold",
      placeholder: "n",
      kind: "number",
      description: "RGB distance below which a fill counts as unchanged",
      defaultDescription: "16",
    },
    ...PAGE_LOAD_INPUTS,
  ],
  parse: (argv) => {
    const htmlPath = firstPositional(argv, "vlmkit check theme <html-or-url>", THEME_VALUE_FLAGS);
    const outputDir = readFlag(argv, "output-dir");
    const reportPath = readFlag(argv, "report");
    const threshold = readNumber(argv, "threshold", { min: 0 });
    return {
      htmlPath,
      outputDir: outputDir ?? join(process.cwd(), "test-results", "theme-parity"),
      ...(reportPath ? { reportPath } : {}),
      ...(threshold !== undefined ? { unchangedColorThreshold: threshold } : {}),
      ...parsePageLoad(argv),
    };
  },
  run: (options) => runThemeParity(options),
  findings: (report): Finding[] => {
    const findings: Finding[] = report.unthemed.map((u) => ({
      rule: "unthemed-component",
      severity: "warn",
      message:
        `component #${u.rank} at ${u.bbox.left},${u.bbox.top} ${u.bbox.width}x${u.bbox.height}`
        + ` keeps fill ${u.lightFill.hex} in both themes (delta ${u.fillDelta.toFixed(1)})`,
      evidence: { bbox: u.bbox, lightFill: u.lightFill.hex, darkFill: u.darkFill.hex, fillDelta: u.fillDelta },
    }));
    if (report.themePixelDelta < THEME_INERT_DELTA) {
      findings.push({
        rule: "theme-inert",
        severity: "warn",
        message:
          `only ${(report.themePixelDelta * 100).toFixed(1)}% of pixels changed between light and dark`
          + ` — the page may have no prefers-color-scheme styles at all`,
        evidence: { themePixelDelta: report.themePixelDelta },
      });
    }
    return findings;
  },
  format: formatThemeParityReport,
  ledger: (report, options) => ({
    tool: "check-theme",
    source: options.htmlPath,
    headline: {
      themePixelDelta: Number(report.themePixelDelta.toFixed(4)),
      unthemed: report.unthemed.length,
      matched: report.totalMatched,
      report: report.reportPath,
    },
  }),
});
