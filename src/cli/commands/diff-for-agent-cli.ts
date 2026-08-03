#!/usr/bin/env node
/**
 * `vlmkit diff agent <migration-report.json>` — emit a one-context-window
 * Markdown summary of an existing migration-compare report.
 *
 * Pairs with the dogfood findings in
 * `docs/reports/2026-05-12-dogfood-shadcn-luna.md`: gives an agent the
 * diff table + fix candidates + worst-viewport PNG paths in a single
 * read.
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve, relative} from "node:path";
import { STATE_DIR, resolveStatePath } from "@mizchi/vlmkit-core/legacy-names.ts";
import {
  buildPreviousRunSummary,
  detectRegression,
  formatMigrationReportForAgent,
  type DfaReport,
  type PreviousRunSummary,
} from "../../vrt/compare/diff-for-agent.ts";

// See legacy-names: the run-vs-run comparison is worthless if the rename makes
// it read an absent file and report "no previous run" forever.
const defaultHistoryPath = (): string =>
  relative(process.cwd(), resolveStatePath(process.cwd(), "last-diff-for-agent.json"))
  || `${STATE_DIR}/last-diff-for-agent.json`;

function usage(): string {
  return [
    "Usage:",
    "  vlmkit diff agent <migration-report.json> [--out path] [--max-viewports 1] [--variant working.html] [--show-unverified] [--previous path] [--persist-summary path] [--no-history] [--fail-on-regression]",
    "",
    "Reads an existing migration-compare report (the report.json written by",
    "`vlmkit diff html`) and prints a Markdown summary tailored for coding agents.",
    "",
    "By default, heuristic fix-candidate rows marked ✗ (value already matches",
    "baseline) are hidden — pass --show-unverified to include them.",
    "",
    "Regression detection:",
    "  - On each run the per-viewport diffRatio is written to .vrt/last-diff-for-agent.json",
    "  - On the next run that file is loaded as the comparison baseline",
    "  - If the majority of viewports got worse, a ⚠ REGRESSION banner appears",
    "  - --previous <path>        explicit comparison source",
    "  - --persist-summary <path> override the destination",
    "  - --no-history             skip both load + write (one-shot mode)",
    "  - --fail-on-regression     exit 1 when a regression is detected",
  ].join("\n");
}

interface Args {
  reportPath: string;
  outPath?: string;
  maxViewports: number;
  variant?: string;
  showUnverified: boolean;
  previousPath?: string;
  persistSummaryPath?: string;
  noHistory: boolean;
  failOnRegression: boolean;
}

function parseArgs(argv: string[]): Args {
  const positional: string[] = [];
  let outPath: string | undefined;
  let maxViewports = 1;
  let variant: string | undefined;
  let showUnverified = false;
  let previousPath: string | undefined;
  let persistSummaryPath: string | undefined;
  let noHistory = false;
  let failOnRegression = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    switch (arg) {
      case "--out":
      case "--output": {
        const v = argv[++i];
        if (!v) throw new Error(`Missing value for ${arg}`);
        outPath = v;
        break;
      }
      case "--max-viewports": {
        const v = argv[++i];
        const n = v == null ? NaN : Number(v);
        if (!Number.isFinite(n) || n < 1 || !Number.isInteger(n)) {
          throw new Error("--max-viewports must be a positive integer");
        }
        maxViewports = n;
        break;
      }
      case "--variant": {
        const v = argv[++i];
        if (!v) throw new Error("Missing value for --variant");
        variant = v;
        break;
      }
      case "--show-unverified":
        showUnverified = true;
        break;
      case "--previous": {
        const v = argv[++i];
        if (!v) throw new Error("Missing value for --previous");
        previousPath = v;
        break;
      }
      case "--persist-summary": {
        const v = argv[++i];
        if (!v) throw new Error("Missing value for --persist-summary");
        persistSummaryPath = v;
        break;
      }
      case "--no-history":
        noHistory = true;
        break;
      case "--fail-on-regression":
        failOnRegression = true;
        break;
      case "--help":
      case "-h":
        console.log(usage());
        process.exit(0);
      default:
        if (arg.startsWith("--")) throw new Error(`Unknown option: ${arg}`);
        positional.push(arg);
    }
  }

  if (positional.length !== 1) {
    throw new Error("Pass exactly one migration-report.json path");
  }
  return {
    reportPath: positional[0]!,
    outPath,
    maxViewports,
    variant,
    showUnverified,
    previousPath,
    persistSummaryPath,
    noHistory,
    failOnRegression,
  };
}

async function loadPreviousSummary(path: string): Promise<PreviousRunSummary | undefined> {
  if (!existsSync(path)) return undefined;
  try {
    const raw = await readFile(path, "utf-8");
    const parsed = JSON.parse(raw) as PreviousRunSummary;
    if (parsed && typeof parsed === "object" && parsed.byVariant && typeof parsed.byVariant === "object") {
      return parsed;
    }
    return undefined;
  } catch {
    // Corrupt history file should not break the run.
    return undefined;
  }
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0) {
    console.log(usage());
    process.exit(1);
  }

  const parsed = parseArgs(argv);
  const reportPath = resolve(parsed.reportPath);
  if (!existsSync(reportPath)) {
    throw new Error(`Report not found: ${reportPath}`);
  }

  const raw = await readFile(reportPath, "utf-8");
  const report = JSON.parse(raw) as DfaReport;
  report.reportPath = reportPath;

  // History resolution. Two modes:
  //   --no-history: skip both load + write entirely (CI one-shots).
  //   default:      auto-load + auto-persist .vrt/last-diff-for-agent.json,
  //                 overridable via --previous / --persist-summary.
  const historyPath = parsed.noHistory ? undefined : resolve(parsed.persistSummaryPath ?? defaultHistoryPath());
  const previousPath = parsed.noHistory
    ? undefined
    : resolve(parsed.previousPath ?? parsed.persistSummaryPath ?? defaultHistoryPath());
  const previous = previousPath ? await loadPreviousSummary(previousPath) : undefined;

  const md = formatMigrationReportForAgent(report, {
    maxViewports: parsed.maxViewports,
    variant: parsed.variant,
    showUnverified: parsed.showUnverified,
    previous,
  });

  if (parsed.outPath) {
    const out = resolve(parsed.outPath);
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, md);
    console.error(`Wrote ${out}`);
  } else {
    process.stdout.write(md);
    if (!md.endsWith("\n")) process.stdout.write("\n");
  }

  // Persist the current run for next time.
  if (historyPath) {
    const summary = buildPreviousRunSummary(report);
    await mkdir(dirname(historyPath), { recursive: true });
    await writeFile(historyPath, JSON.stringify(summary, null, 2));
  }

  // Optionally fail when a regression was detected. We re-run the
  // detector here so the exit code matches what the markdown shows.
  if (parsed.failOnRegression && previous) {
    const variantsToCheck = parsed.variant
      ? [parsed.variant]
      : Array.from(new Set(report.results.map((r) => r.variantFile)));
    for (const variantFile of variantsToCheck) {
      const results = report.results.filter((r) => r.variantFile === variantFile);
      const finding = detectRegression(results, previous, variantFile);
      if (finding?.regressed) {
        process.exit(1);
      }
    }
  }
}

if (process.env.__VRT_DISPATCHER_LEAF__ === "diff-for-agent-cli" || (process.argv[1] && (process.argv[1].endsWith("diff-for-agent-cli.ts") || process.argv[1].endsWith("diff-for-agent-cli.mjs")))) {
  main().catch((err) => {
    console.error(String(err?.message ?? err));
    process.exit(1);
  });
}

export { parseArgs, usage };
