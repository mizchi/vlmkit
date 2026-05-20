#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  introspectUiContractFromHtml,
  type UiContractIntrospectionProfile,
} from "@mizchi/vlmkit-markup/contract/introspect-contract.ts";
import {
  validateUiContract,
  type UiContractGoal,
  type UiContractPattern,
  type UiContractViewport,
} from "@mizchi/vlmkit-markup/contract/ui-contract.ts";
import { BOLD, CYAN, DIM, RESET } from "@mizchi/vlmkit-core/terminal-colors.ts";

interface BenchCase {
  name: string;
  input: string;
  pattern: UiContractPattern;
  goal: UiContractGoal;
  viewports: UiContractViewport[];
}

interface BenchRecord {
  case: string;
  round: number;
  totalMs: number;
  browserLaunchMs: number;
  browserCloseMs: number;
  viewportTotalMs: number;
  navigateMs: number;
  landmarkMs: number;
  hintMs: number;
  landmarks: number;
}

const DEFAULT_OUT = join("test-results", "introspect", "benchmark.json");

const CASES: BenchCase[] = [
  {
    name: "app-shell",
    input: "design-runs/patterns-20260520/app-shell/current.html",
    pattern: "app-shell",
    goal: "app-shell",
    viewports: [
      { label: "desktop", width: 1440, height: 900 },
      { label: "mobile", width: 390, height: 844 },
    ],
  },
  {
    name: "expressive-menu",
    input: "design-runs/patterns-20260520/expressive-menu/current.html",
    pattern: "expressive-menu",
    goal: "expressive-menu",
    viewports: [
      { label: "desktop", width: 1440, height: 900 },
      { label: "mobile", width: 390, height: 844 },
    ],
  },
  {
    name: "dashboard",
    input: "design-runs/patterns-20260520/dashboard/current.html",
    pattern: "dashboard",
    goal: "app",
    viewports: [
      { label: "desktop", width: 1440, height: 900 },
      { label: "mobile", width: 390, height: 844 },
    ],
  },
  {
    name: "responsive-stretch",
    input: "design-runs/patterns-20260520/responsive-stretch/current.html",
    pattern: "landing",
    goal: "app",
    viewports: [
      { label: "mobile", width: 390, height: 844 },
      { label: "tablet", width: 768, height: 900 },
      { label: "desktop", width: 1440, height: 900 },
      { label: "wide", width: 1920, height: 1080 },
    ],
  },
  {
    name: "canvas",
    input: "design-runs/patterns-20260520/game/current.html",
    pattern: "canvas",
    goal: "canvas",
    viewports: [
      { label: "desktop", width: 1280, height: 720 },
    ],
  },
];

function parseArgs(argv: string[]): { rounds: number; out: string } {
  let rounds = 3;
  let out = DEFAULT_OUT;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--rounds") rounds = Number(argv[++i] ?? "");
    else if (arg === "--out") out = argv[++i] ?? "";
    else if (arg === "--help" || arg === "-h") {
      console.log("Usage: node src/experiments/benchmark/introspect-bench.ts [--rounds N] [--out path]");
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!Number.isInteger(rounds) || rounds <= 0) {
    throw new Error("--rounds must be a positive integer");
  }
  if (!out) throw new Error("--out is required");
  return { rounds, out };
}

function roundMs(value: number): number {
  return Math.round(value * 10) / 10;
}

function profileToRecord(name: string, round: number, profile: UiContractIntrospectionProfile): BenchRecord {
  return {
    case: name,
    round,
    totalMs: roundMs(profile.totalMs),
    browserLaunchMs: roundMs(profile.browserLaunchMs),
    browserCloseMs: roundMs(profile.browserCloseMs),
    viewportTotalMs: roundMs(sum(profile.viewports.map((viewport) => viewport.totalMs))),
    navigateMs: roundMs(sum(profile.viewports.map((viewport) => viewport.navigateMs))),
    landmarkMs: roundMs(sum(profile.viewports.map((viewport) => viewport.landmarkMs))),
    hintMs: roundMs(sum(profile.viewports.map((viewport) => viewport.hintMs))),
    landmarks: sum(profile.viewports.map((viewport) => viewport.landmarks)),
  };
}

function sum(values: number[]): number {
  return values.reduce((acc, value) => acc + value, 0);
}

function mean(values: number[]): number {
  return values.length > 0 ? sum(values) / values.length : 0;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index]!;
}

function byCase(records: BenchRecord[], name: string): BenchRecord[] {
  return records.filter((record) => record.case === name);
}

function printSummary(records: BenchRecord[]): void {
  console.log();
  console.log(`${BOLD}${CYAN}vlmkit introspect benchmark${RESET}`);
  console.log();
  console.log(`  ${"Case".padEnd(18)} ${"avg".padStart(8)} ${"p95".padStart(8)} ${"launch".padStart(8)} ${"viewports".padStart(10)} ${"goto".padStart(8)} ${"landmark".padStart(9)}`);
  console.log(`  ${"-".repeat(18)} ${"-".repeat(8)} ${"-".repeat(8)} ${"-".repeat(8)} ${"-".repeat(10)} ${"-".repeat(8)} ${"-".repeat(9)}`);
  for (const benchCase of CASES) {
    const rows = byCase(records, benchCase.name);
    console.log(
      `  ${benchCase.name.padEnd(18)}`
      + ` ${formatMs(mean(rows.map((row) => row.totalMs))).padStart(8)}`
      + ` ${formatMs(percentile(rows.map((row) => row.totalMs), 95)).padStart(8)}`
      + ` ${formatMs(mean(rows.map((row) => row.browserLaunchMs))).padStart(8)}`
      + ` ${formatMs(mean(rows.map((row) => row.viewportTotalMs))).padStart(10)}`
      + ` ${formatMs(mean(rows.map((row) => row.navigateMs))).padStart(8)}`
      + ` ${formatMs(mean(rows.map((row) => row.landmarkMs))).padStart(9)}`,
    );
  }
  console.log();
}

function formatMs(value: number): string {
  return `${Math.round(value)}ms`;
}

async function main(argv = process.argv.slice(2)): Promise<void> {
  const args = parseArgs(argv);
  const records: BenchRecord[] = [];
  for (let round = 1; round <= args.rounds; round++) {
    for (const benchCase of CASES) {
      let profile: UiContractIntrospectionProfile | undefined;
      const contract = await introspectUiContractFromHtml({
        input: benchCase.input,
        pattern: benchCase.pattern,
        goal: benchCase.goal,
        viewports: benchCase.viewports,
        onProfile: (next) => {
          profile = next;
        },
      });
      const issues = validateUiContract(contract);
      if (issues.length > 0) {
        const detail = issues.slice(0, 5).map((issue) => `${issue.path}: ${issue.message}`).join("; ");
        throw new Error(`${benchCase.name} produced invalid contract: ${detail}`);
      }
      if (!profile) throw new Error(`${benchCase.name} did not report profile`);
      records.push(profileToRecord(benchCase.name, round, profile));
      console.log(`${DIM}${benchCase.name} round ${round}: ${formatMs(profile.totalMs)}${RESET}`);
    }
  }

  printSummary(records);
  await mkdir(dirname(args.out), { recursive: true });
  await writeFile(args.out, JSON.stringify({ date: new Date().toISOString(), rounds: args.rounds, records }, null, 2));
  console.log(`${DIM}Wrote ${args.out}${RESET}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
