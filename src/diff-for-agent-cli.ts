#!/usr/bin/env node
/**
 * `vrt diff-for-agent <migration-report.json>` — emit a one-context-window
 * Markdown summary of an existing migration-compare report.
 *
 * Pairs with the dogfood findings in
 * `docs/reports/2026-05-12-dogfood-shadcn-luna.md`: gives an agent the
 * diff table + fix candidates + worst-viewport PNG paths in a single
 * read.
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { formatMigrationReportForAgent, type DfaReport } from "./diff-for-agent.ts";

function usage(): string {
  return [
    "Usage:",
    "  vrt diff-for-agent <migration-report.json> [--out path] [--max-viewports 1] [--variant working.html] [--show-unverified]",
    "",
    "Reads an existing migration-compare report (the report.json written by",
    "`vrt compare`) and prints a Markdown summary tailored for coding agents.",
    "",
    "By default, heuristic fix-candidate rows marked ✗ (value already matches",
    "baseline) are hidden — pass --show-unverified to include them.",
  ].join("\n");
}

interface Args {
  reportPath: string;
  outPath?: string;
  maxViewports: number;
  variant?: string;
  showUnverified: boolean;
}

function parseArgs(argv: string[]): Args {
  const positional: string[] = [];
  let outPath: string | undefined;
  let maxViewports = 1;
  let variant: string | undefined;
  let showUnverified = false;

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
  return { reportPath: positional[0]!, outPath, maxViewports, variant, showUnverified };
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

  const md = formatMigrationReportForAgent(report, {
    maxViewports: parsed.maxViewports,
    variant: parsed.variant,
    showUnverified: parsed.showUnverified,
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
}

if (process.argv[1] && (process.argv[1].endsWith("diff-for-agent-cli.ts") || process.argv[1].endsWith("diff-for-agent-cli.mjs"))) {
  main().catch((err) => {
    console.error(String(err?.message ?? err));
    process.exit(1);
  });
}

export { parseArgs, usage };
