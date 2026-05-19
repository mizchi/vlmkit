#!/usr/bin/env node
/**
 * `vrt compare-runs <a.json> <b.json>` — pairwise diff of two
 * migration-compare reports. Validates "the patch did what I expected"
 * across two iterations.
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { formatCompareRunsMarkdown, type CrReport } from "../../vrt/compare/compare-runs.ts";

function usage(): string {
  return [
    "Usage:",
    "  vrt compare-runs <a-migration-report.json> <b-migration-report.json> [--out path] [--label-a name] [--label-b name]",
    "",
    "Diffs two migration-compare reports and prints per-viewport delta",
    "(IMPROVED / REGRESSED / UNCHANGED / ADDED / REMOVED) sorted by",
    "absolute movement.",
  ].join("\n");
}

interface Args {
  a: string;
  b: string;
  outPath?: string;
  labelA?: string;
  labelB?: string;
}

function parseArgs(argv: string[]): Args {
  const positional: string[] = [];
  let outPath: string | undefined;
  let labelA: string | undefined;
  let labelB: string | undefined;

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
      case "--label-a": {
        const v = argv[++i];
        if (!v) throw new Error("Missing value for --label-a");
        labelA = v;
        break;
      }
      case "--label-b": {
        const v = argv[++i];
        if (!v) throw new Error("Missing value for --label-b");
        labelB = v;
        break;
      }
      case "--help":
      case "-h":
        console.log(usage());
        process.exit(0);
      default:
        if (arg.startsWith("--")) throw new Error(`Unknown option: ${arg}`);
        positional.push(arg);
    }
  }

  if (positional.length !== 2) {
    throw new Error("Pass exactly two migration-report.json paths (A then B)");
  }
  return { a: positional[0]!, b: positional[1]!, outPath, labelA, labelB };
}

async function loadReport(path: string): Promise<CrReport> {
  const abs = resolve(path);
  if (!existsSync(abs)) {
    throw new Error(`Report not found: ${abs}`);
  }
  return JSON.parse(await readFile(abs, "utf-8")) as CrReport;
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0) {
    console.log(usage());
    process.exit(1);
  }

  const parsed = parseArgs(argv);
  const [a, b] = await Promise.all([loadReport(parsed.a), loadReport(parsed.b)]);

  const md = formatCompareRunsMarkdown(a, b, {
    labelA: parsed.labelA ?? basename(parsed.a),
    labelB: parsed.labelB ?? basename(parsed.b),
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

if (process.env.__VRT_DISPATCHER_LEAF__ === "compare-runs-cli" || (process.argv[1] && (process.argv[1].endsWith("compare-runs-cli.ts") || process.argv[1].endsWith("compare-runs-cli.mjs")))) {
  main().catch((err) => {
    console.error(String(err?.message ?? err));
    process.exit(1);
  });
}

export { parseArgs, usage };
