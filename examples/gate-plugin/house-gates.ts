/**
 * Worked example: a project-local gate plugin.
 *
 * Point `vlmkit.config.json` at it and the gate becomes a first-class
 * command — `vlmkit check house-brand page.html` — with the same `--json`
 * envelope, the same `--advisory` exit-code contract, the same `--rule`
 * tuning, the same run-ledger entry and the same `vlmkit.gates.json`
 * validation as the bundled gates:
 *
 *   { "plugins": ["./examples/gate-plugin/house-gates.ts"] }
 *
 * Then:
 *
 *   vlmkit rules                                  # the gate is listed
 *   vlmkit rules check house-brand                # its two rules
 *   vlmkit check house-brand page.html            # run it
 *   vlmkit check house-brand page.html --rule check.house-brand/forbidden-font=warn
 *
 * The rule this checks is deliberately trivial — a brand-font allowlist over
 * the raw HTML — because the point of the example is the plugin boundary, not
 * the measurement. A real gate would open the page (Playwright is a peer
 * dependency, dynamic-imported inside `run` so declaring the plugin stays
 * cheap) and measure the DOM.
 */

import { readFile } from "node:fs/promises";
import {
  UsageError,
  defineGate,
  definePlugin,
  readAll,
  readPositionals,
} from "@mizchi/vlmkit-core/plugin";
import type { Finding } from "@mizchi/vlmkit-core/plugin";

interface HouseBrandOptions {
  source: string;
  allowedFonts: string[];
}

interface HouseBrandReport {
  source: string;
  declaredFonts: string[];
  allowedFonts: string[];
  offenders: { font: string; line: number }[];
  /** `!important` count — a house style rule, reported but never blocking. */
  importantCount: number;
}

const DEFAULT_FONTS = ["Inter", "IBM Plex Sans", "ui-sans-serif", "system-ui", "sans-serif", "monospace"];

/** Extracted so a unit test can cover the judgment without touching the disk. */
export function analyzeHouseBrand(
  source: string,
  css: string,
  allowedFonts: readonly string[],
): HouseBrandReport {
  const lines = css.split("\n");
  const declaredFonts: string[] = [];
  const offenders: { font: string; line: number }[] = [];
  lines.forEach((text, index) => {
    const match = text.match(/font-family:\s*([^;}]+)/i);
    if (!match) return;
    for (const raw of match[1]!.split(",")) {
      const font = raw.trim().replace(/^["']|["']$/g, "");
      if (!font) continue;
      if (!declaredFonts.includes(font)) declaredFonts.push(font);
      if (!allowedFonts.some((allowed) => allowed.toLowerCase() === font.toLowerCase())) {
        offenders.push({ font, line: index + 1 });
      }
    }
  });
  return {
    source,
    declaredFonts,
    allowedFonts: [...allowedFonts],
    offenders,
    importantCount: (css.match(/!important/g) ?? []).length,
  };
}

export const houseBrandGate = defineGate<HouseBrandReport, HouseBrandOptions>({
  id: "check.house-brand",
  command: ["check", "house-brand"],
  title: "House brand conformance",
  summary: "Font allowlist + !important budget for this project's house style",
  // Which of the five kinds of question this answers. `vlmkit rules` groups by
  // this, so a gate that declares none lands under "other" — correct but
  // unhelpful to whoever is deciding what to run.
  category: "design-system",
  usage: `Fails when a page declares a font-family outside the house allowlist.
Reports \`!important\` usage as an advisory count.

This is the worked plugin example from examples/gate-plugin/.`,
  rules: [
    {
      id: "forbidden-font",
      title: "font-family outside the house allowlist",
      severity: "suspect",
      docs: `Allowlist defaults to ${DEFAULT_FONTS.join(", ")}; override with --font.`,
    },
    {
      id: "important-overuse",
      title: "More than ten !important declarations",
      severity: "warn",
      docs: "A house-style smell, never a defect — hence warn, which never fails the command.",
    },
  ],
  inputs: [
    { name: "source", placeholder: "html-or-css", kind: "path", description: "File to scan", positional: 0, required: true },
    {
      name: "font",
      kind: "string",
      description: "Allowed font family, repeatable",
      repeatable: true,
      defaultDescription: DEFAULT_FONTS.join(", "),
    },
  ],
  parse: (argv) => {
    const source = readPositionals(argv, ["--font"])[0];
    if (!source) throw new UsageError("missing required argument. Usage: vlmkit check house-brand <html-or-css>");
    const fonts = readAll(argv, "font");
    return { source, allowedFonts: fonts.length > 0 ? fonts : DEFAULT_FONTS };
  },
  run: async (options) =>
    analyzeHouseBrand(options.source, await readFile(options.source, "utf-8"), options.allowedFonts),
  findings: (report): Finding[] => {
    const findings: Finding[] = report.offenders.map((o) => ({
      rule: "forbidden-font",
      severity: "suspect",
      message: `"${o.font}" is not in the house allowlist (line ${o.line})`,
    }));
    if (report.importantCount > 10) {
      findings.push({
        rule: "important-overuse",
        severity: "warn",
        message: `${report.importantCount} !important declarations`,
      });
    }
    return findings;
  },
  format: (report) => {
    const lines = [`vlmkit check house-brand`, `source: ${report.source}`, ""];
    lines.push(`fonts declared: ${report.declaredFonts.join(", ") || "none"}`);
    lines.push(`allowlist: ${report.allowedFonts.join(", ")}`);
    lines.push(`!important: ${report.importantCount}`);
    if (report.offenders.length === 0) {
      lines.push("", "All declared fonts are on the allowlist.");
    } else {
      lines.push("", "Off-brand fonts:");
      for (const o of report.offenders) lines.push(`  x line ${o.line}: ${o.font}`);
    }
    return lines.join("\n");
  },
  ledger: (report) => ({
    tool: "check-house-brand",
    source: report.source,
    headline: { offenders: report.offenders.length, important: report.importantCount },
  }),
});

export default definePlugin({
  name: "house-gates",
  version: "1.0.0",
  gates: [houseBrandGate],
});
