/**
 * Worked example 2: a project metric with budgets.
 *
 * `house-gates.ts` is the small case — read a file, match strings, no browser.
 * This is the shape most real house gates take: **render the page, measure some
 * numbers, compare each against a budget the project sets.** If you are adding
 * your own metric, start from this file.
 *
 * It demonstrates the five things the small example does not:
 *
 *   1. **A browser measurement.** Playwright is imported inside `run`, so
 *      declaring this plugin costs nothing until the gate actually runs.
 *   2. **Budgets from two places.** A flag wins over `vlmkit.config.json`,
 *      which wins over the built-in default. Teams want the number in the
 *      repo, not in everyone's shell history.
 *   3. **One rule per metric, with different default severities.** Node count
 *      is a suspect (it is a real performance cliff); nesting depth is a warn
 *      (deep trees are a smell, not a defect). A project flips either with
 *      `--rule` or the `"rules"` block.
 *   4. **`headline`** — the numbers as one line, so `verify markup` and the MCP
 *      server can quote what was measured without re-deriving it.
 *   5. **`evidence`** — the measured value and the budget on every finding, so
 *      an agent reading `--json` can decide how far over it is without parsing
 *      the message.
 *
 * Run it:
 *   vlmkit check dom-budget page.html
 *   vlmkit check dom-budget page.html --max-nodes 800 --max-depth 12
 *   vlmkit check dom-budget page.html --rule check.dom-budget/depth-over-budget=suspect
 *   vlmkit rules check dom-budget
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { readInt, readPositionals } from "@mizchi/vlmkit-core/arg-reader.ts";
import { UsageError } from "@mizchi/vlmkit-core/cli-error.ts";
import { defineGate } from "@mizchi/vlmkit-core/plugin/contract.ts";
import type { Finding } from "@mizchi/vlmkit-core/plugin/contract.ts";
import { BOLD, CYAN, DIM, GREEN, RED, RESET, YELLOW } from "@mizchi/vlmkit-core/terminal-colors.ts";

/** Defaults, deliberately generous. A budget nobody can meet gets disabled. */
const DEFAULT_BUDGET = { maxNodes: 1500, maxDepth: 20, maxStylesheetBytes: 250_000 } as const;

interface Budget {
  maxNodes: number;
  maxDepth: number;
  maxStylesheetBytes: number;
}

interface DomBudgetOptions {
  source: string;
  budget: Budget;
  /** Where each number came from, so the report can say so. */
  origin: Record<keyof Budget, "default" | "config" | "flag">;
}

interface DomBudgetReport {
  source: string;
  budget: Budget;
  origin: DomBudgetOptions["origin"];
  nodes: number;
  depth: number;
  /** The deepest element's path, which is the actionable half of a depth finding. */
  deepestPath: string;
  stylesheetBytes: number;
}

/**
 * Read budgets out of the project's own config. A gate may read whatever it
 * likes from `vlmkit.config.json` under its own key — the loader does not
 * reserve the file, it only reads `"plugins"` from it.
 */
function budgetFromConfig(cwd: string): Partial<Budget> {
  try {
    const raw = JSON.parse(readFileSync(resolve(cwd, "vlmkit.config.json"), "utf-8")) as {
      domBudget?: Partial<Budget>;
    };
    return raw.domBudget ?? {};
  } catch {
    // No config, or not readable. Budgets fall back to the defaults; a gate
    // must not fail because a project declined to configure it.
    return {};
  }
}

/** Runs in the page. Kept as a string so it needs no bundling step. */
const MEASURE = `(() => {
  let deepest = null;
  let depth = 0;
  const walk = (el, d, path) => {
    const here = path + ">" + el.tagName.toLowerCase();
    if (d > depth) { depth = d; deepest = here; }
    for (const child of el.children) walk(child, d + 1, here);
  };
  for (const child of document.body.children) walk(child, 1, "body");
  const stylesheetBytes = [...document.querySelectorAll("style")]
    .reduce((n, el) => n + (el.textContent || "").length, 0);
  return {
    nodes: document.querySelectorAll("*").length,
    depth,
    deepestPath: deepest || "body",
    stylesheetBytes,
  };
})()`;

export const domBudgetGate = defineGate<DomBudgetReport, DomBudgetOptions>({
  id: "check.dom-budget",
  command: ["check", "dom-budget"],
  title: "DOM size budget",
  summary: "Node count, nesting depth and inline-stylesheet weight against project budgets",
  category: "design-system",
  usage: `Renders the page and measures three numbers against budgets you set:
total element count, maximum nesting depth, and inline <style> weight.

Budgets resolve flag > vlmkit.config.json > default:

  { "domBudget": { "maxNodes": 900, "maxDepth": 14 } }

Node count over budget is a suspect; depth and stylesheet weight are warns.
Change any of that with --rule or the "rules" block — see
docs/authoring-gates.md.`,
  rules: [
    {
      id: "nodes-over-budget",
      title: "Element count above the node budget",
      severity: "suspect",
      docs: "Large DOMs cost layout and memory on every interaction, not just at load.",
    },
    {
      id: "depth-over-budget",
      title: "Nesting deeper than the depth budget",
      severity: "warn",
      docs: "A smell rather than a defect — promote it if your project treats depth as a hard rule.",
    },
    {
      id: "stylesheet-over-budget",
      title: "Inline <style> weight above the budget",
      severity: "warn",
      docs: "Only counts inline styles; linked stylesheets are the bundler's business.",
    },
  ],
  inputs: [
    {
      name: "source",
      placeholder: "html-or-url",
      kind: "path-or-url",
      description: "Page to measure",
      positional: 0,
      required: true,
    },
    { name: "max-nodes", placeholder: "n", kind: "number", description: "Element-count budget", defaultDescription: String(DEFAULT_BUDGET.maxNodes) },
    { name: "max-depth", placeholder: "n", kind: "number", description: "Nesting-depth budget", defaultDescription: String(DEFAULT_BUDGET.maxDepth) },
    { name: "max-style-bytes", placeholder: "n", kind: "number", description: "Inline-stylesheet byte budget", defaultDescription: String(DEFAULT_BUDGET.maxStylesheetBytes) },
  ],
  parse: (argv, ctx) => {
    const source = readPositionals(argv, ["--max-nodes", "--max-depth", "--max-style-bytes"])[0];
    if (!source) {
      throw new UsageError("missing required argument. Usage: vlmkit check dom-budget <html-or-url>");
    }
    // `readInt` refuses a missing value and a value that is another flag, so
    // `--max-nodes --json` is an error rather than NaN.
    const flags = {
      maxNodes: readInt(argv, "max-nodes", { min: 1 }),
      maxDepth: readInt(argv, "max-depth", { min: 1 }),
      maxStylesheetBytes: readInt(argv, "max-style-bytes", { min: 0 }),
    };
    const config = budgetFromConfig(ctx.cwd);
    const budget = { ...DEFAULT_BUDGET } as Budget;
    const origin = { maxNodes: "default", maxDepth: "default", maxStylesheetBytes: "default" } as DomBudgetOptions["origin"];
    for (const key of ["maxNodes", "maxDepth", "maxStylesheetBytes"] as const) {
      if (config[key] !== undefined) {
        budget[key] = config[key]!;
        origin[key] = "config";
      }
      if (flags[key] !== undefined) {
        budget[key] = flags[key]!;
        origin[key] = "flag";
      }
    }
    return { source, budget, origin };
  },
  run: async ({ source, budget, origin }) => {
    // Imported here, not at module scope: declaring this plugin should not
    // load Playwright for someone running `vlmkit rules`.
    const { chromium } = await import("playwright");
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      const url = /^(https?|file):\/\//.test(source) ? source : pathToFileURL(resolve(source)).href;
      await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
      const measured = await page.evaluate(MEASURE) as Omit<DomBudgetReport, "source" | "budget" | "origin">;
      return { source, budget, origin, ...measured };
    } finally {
      await browser.close();
    }
  },
  findings: (report): Finding[] => {
    const findings: Finding[] = [];
    const over = (
      rule: string,
      severity: Finding["severity"],
      label: string,
      value: number,
      budget: number,
      extra: Record<string, unknown> = {},
    ) => {
      if (value <= budget) return;
      findings.push({
        rule,
        severity,
        message: `${label} ${value} is over the budget of ${budget} (+${value - budget})`,
        // The numbers travel structurally too, so a client does not parse prose
        // to find out how far over it is.
        evidence: { value, budget, over: value - budget, ...extra },
      });
    };
    over("nodes-over-budget", "suspect", "element count", report.nodes, report.budget.maxNodes);
    over("depth-over-budget", "warn", "nesting depth", report.depth, report.budget.maxDepth, {
      deepestPath: report.deepestPath,
    });
    over(
      "stylesheet-over-budget",
      "warn",
      "inline stylesheet bytes",
      report.stylesheetBytes,
      report.budget.maxStylesheetBytes,
    );
    return findings;
  },
  format: (report) => {
    const row = (label: string, value: number, budget: number, key: keyof Budget) => {
      const icon = value <= budget ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
      // Saying where a budget came from is what stops the argument about
      // whether it was ever configured.
      return `  ${icon} ${label.padEnd(22)} ${String(value).padStart(7)} / ${String(budget).padStart(7)}`
        + `  ${DIM}(${report.origin[key]})${RESET}`;
    };
    const lines = [
      `${BOLD}${CYAN}vlmkit check dom-budget${RESET}`,
      `${DIM}source: ${report.source}${RESET}`,
      "",
      row("elements", report.nodes, report.budget.maxNodes, "maxNodes"),
      row("nesting depth", report.depth, report.budget.maxDepth, "maxDepth"),
      row("inline style bytes", report.stylesheetBytes, report.budget.maxStylesheetBytes, "maxStylesheetBytes"),
    ];
    if (report.depth > report.budget.maxDepth) {
      lines.push("", `  ${YELLOW}deepest:${RESET} ${DIM}${report.deepestPath}${RESET}`);
    }
    return lines.join("\n");
  },
  headline: (report) =>
    `${report.nodes} nodes, depth ${report.depth}, ${report.stylesheetBytes}B inline CSS`,
  ledger: (report) => ({
    tool: "check-dom-budget",
    source: report.source,
    headline: {
      nodes: report.nodes,
      depth: report.depth,
      stylesheetBytes: report.stylesheetBytes,
      maxNodes: report.budget.maxNodes,
    },
  }),
});
