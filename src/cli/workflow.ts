#!/usr/bin/env node
/**
 * VRT Workflow CLI
 *
 * CLI for coding agents to run VRT + Semantic verification loops.
 *
 * Commands:
 *   init      -- create baseline (first run or reset)
 *   capture   -- take current state snapshot
 *   verify    -- verify baseline vs snapshot
 *   approve   -- promote current snapshot to baseline
 *   report    -- show latest verification results
 *   graph     -- show dependency graph
 *   affected  -- show change impact scope
 *   introspect / spec-verify -- ui-spec authoring & checking
 *   expect    -- generate expectation.json from current diff
 */

import { execFileSync, type ExecSyncOptions } from "node:child_process";
import { join } from "node:path";
import {
  readFile,
  readdir,
  mkdir,
  cp,
  rm,
} from "node:fs/promises";
import { existsSync } from "node:fs";
import { runVerifyPipeline, type VerifyPaths } from "./workflow/verify.ts";
import { runGraph, runAffected } from "./workflow/graph.ts";
import { runIntrospect, runSpecVerify, runExpect, type SpecPaths } from "./workflow/spec.ts";
import {
  HARNESS_ROOT,
  PROJECT_ROOT,
  BASELINES_DIR,
  SNAPSHOTS_DIR,
  OUTPUT_DIR,
  REPORT_PATH,
  EXPECTATION_PATH,
  SPEC_PATH,
} from "./workflow/paths.ts";
import { resolveCaptureRoutes } from "@mizchi/vlmkit-capture/capture-config.ts";
import { isCliEntry } from "@mizchi/vlmkit-core/plugin/cli-entry.ts";
import type { UnifiedAgentContext } from "@mizchi/vlmkit-core/types.ts";
import { readEnv } from "@mizchi/vlmkit-core/project-config.ts";

const NPX_COMMAND = process.platform === "win32" ? "npx.cmd" : "npx";

const EXEC_OPTS: ExecSyncOptions = {
  cwd: PROJECT_ROOT,
  stdio: "inherit",
  env: {
    ...process.env,
    VLMKIT_OUTPUT_DIR: PROJECT_ROOT,
  },
};

interface WorkflowCaptureOptions {
  configPath?: string;
  baseUrl?: string;
}

function parseCaptureOptions(argv: string[]): WorkflowCaptureOptions {
  const options: WorkflowCaptureOptions = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--config") {
      const value = argv[++i];
      if (!value) throw new Error("Missing value for --config");
      options.configPath = value;
    } else if (arg === "--base-url") {
      const value = argv[++i];
      if (!value) throw new Error("Missing value for --base-url");
      options.baseUrl = value;
    } else if (arg === "--help" || arg === "-h") {
      // ignored here; handled by caller
    } else {
      throw new Error(`Unknown workflow option: ${arg}`);
    }
  }
  return options;
}

function resolveCaptureSpecPath(): string {
  const candidates = [
    join(HARNESS_ROOT, "dist", "e2e", "vrt-capture.spec.mjs"),
    join(HARNESS_ROOT, "e2e", "vrt-capture.spec.ts"),
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error("Missing VRT capture spec. Run `pnpm build` or restore `e2e/vlmkit-capture.spec.ts`.");
  }
  return found;
}

function buildCaptureEnv(mode: "baseline" | "capture", options: WorkflowCaptureOptions) {
  const env: NodeJS.ProcessEnv = { ...EXEC_OPTS.env, VLMKIT_MODE: mode };

  // Resolve config + routes against PROJECT_ROOT (user's working directory),
  // so external projects can drop a vlmkit.config.json next to their app.
  const routeSet = resolveCaptureRoutes({
    cwd: PROJECT_ROOT,
    configPath: options.configPath,
    envConfigPath: readEnv("CONFIG_PATH"),
    envBaseUrl: options.baseUrl ?? readEnv("BASE_URL"),
  });

  if (routeSet.configPath) {
    env.VLMKIT_CONFIG_PATH = routeSet.configPath;
  }
  env.VLMKIT_BASE_URL = routeSet.baseUrl;
  env.VLMKIT_PROJECT_ROOT = PROJECT_ROOT;

  if (routeSet.source === "config" && routeSet.configPath) {
    console.log(`  (using capture config: ${routeSet.configPath})`);
    console.log(`  (routes: ${routeSet.routes.map((r) => r.path).join(", ")})`);
  } else if (routeSet.source === "default") {
    console.log(`  (using default routes — pass --config or create vlmkit.config.json to customize)`);
  }

  return env;
}

function runCaptureSpec(mode: "baseline" | "capture", options: WorkflowCaptureOptions) {
  execFileSync(
    NPX_COMMAND,
    ["playwright", "test", resolveCaptureSpecPath(), "--reporter=list"],
    {
      ...EXEC_OPTS,
      env: buildCaptureEnv(mode, options),
    }
  );
}

// ---- Commands ----

async function init(options: WorkflowCaptureOptions = {}): Promise<number> {
  console.log("=== VRT Init: Creating baselines ===\n");

  await mkdir(BASELINES_DIR, { recursive: true });

  console.log("Running Playwright to capture baseline screenshots + a11y...");
  try {
    runCaptureSpec("baseline", options);
  } catch (e) {
    // Some tests may fail (e.g. title check) but captures still succeed
    const captured = await listFiles(BASELINES_DIR, ".png");
    if (captured.length === 0) {
      console.error("Playwright capture failed. Is the server running?");
      console.error("Start your target app and set VLMKIT_BASE_URL if it is not http://127.0.0.1:4174");
      return 1;
    }
    console.log("  (some tests had warnings, but captures completed)");
  }

  const files = await listFiles(BASELINES_DIR, ".png");
  const a11yFiles = await listFiles(BASELINES_DIR, ".a11y.json");
  console.log(`\nBaselines created: ${files.length} screenshots, ${a11yFiles.length} a11y trees`);
  console.log(`Stored in: ${BASELINES_DIR}`);
  return 0;
}

async function capture(options: WorkflowCaptureOptions = {}): Promise<number> {
  console.log("=== VRT Capture: Taking snapshots ===\n");

  // Clean previous snapshots
  if (existsSync(SNAPSHOTS_DIR)) {
    await rm(SNAPSHOTS_DIR, { recursive: true });
  }
  await mkdir(SNAPSHOTS_DIR, { recursive: true });

  console.log("Running Playwright to capture current state...");
  try {
    runCaptureSpec("capture", options);
  } catch (e) {
    const captured = await listFiles(SNAPSHOTS_DIR, ".png");
    if (captured.length === 0) {
      console.error("Playwright capture failed. Is the server running?");
      console.error("Start your target app and set VLMKIT_BASE_URL if it is not http://127.0.0.1:4174");
      return 1;
    }
    console.log("  (some tests had warnings, but captures completed)");
  }

  const files = await listFiles(SNAPSHOTS_DIR, ".png");
  console.log(`\nSnapshots captured: ${files.length} screenshots`);
  return 0;
}

async function verify(): Promise<number> {
  console.log("=== VRT Verify: Running verification pipeline ===\n");

  const paths: VerifyPaths = {
    projectRoot: PROJECT_ROOT,
    baselinesDir: BASELINES_DIR,
    snapshotsDir: SNAPSHOTS_DIR,
    outputDir: OUTPUT_DIR,
    reportPath: REPORT_PATH,
    expectationPath: EXPECTATION_PATH,
  };

  const result = await runVerifyPipeline(paths);

  if (!result.passed) {
    console.log("\nFAILED — Fix the issues and run `vlmkit workflow capture && vlmkit workflow verify` again.");
    console.log("Details: " + REPORT_PATH);
    return 1;
  }
  if (result.needsReview) {
    console.log("\nWARNING — Some changes need review. Run `vlmkit workflow report` for details.");
    console.log("If changes are intentional, run `vlmkit workflow approve` to update baselines.");
    return 0;
  }
  if (result.vrtDiffs.length === 0 && result.a11yDiffs.length === 0) {
    console.log("\nPASS — No visual or semantic changes detected.");
    return 0;
  }
  console.log("\nPASS — All changes approved.");
  console.log("Run `vlmkit workflow approve` to update baselines.");
  return 0;
}

async function approve(): Promise<number> {
  console.log("=== VRT Approve: Updating baselines ===\n");

  if (!existsSync(SNAPSHOTS_DIR)) {
    console.error("No snapshots found. Run `vlmkit workflow capture` first.");
    return 1;
  }

  // Copy snapshots → baselines
  if (existsSync(BASELINES_DIR)) {
    await rm(BASELINES_DIR, { recursive: true });
  }
  await cp(SNAPSHOTS_DIR, BASELINES_DIR, { recursive: true });

  const files = await listFiles(BASELINES_DIR, ".png");
  console.log(`Baselines updated: ${files.length} screenshots`);
  console.log("New baselines stored in: " + BASELINES_DIR);
  return 0;
}

async function report(): Promise<number> {
  if (!existsSync(REPORT_PATH)) {
    console.error("No report found. Run `vlmkit workflow verify` first.");
    return 1;
  }

  const raw = await readFile(REPORT_PATH, "utf-8");
  const ctx: UnifiedAgentContext = JSON.parse(raw);

  // Rebuild human-readable report
  console.log("# VRT + Semantic Verification Report\n");
  console.log(`Intent: ${ctx.intent.summary} (${ctx.intent.changeType})\n`);

  if (ctx.crossValidations.length > 0) {
    console.log("## Cross-Validation Results");
    for (const cv of ctx.crossValidations) {
      console.log(`  [${cv.recommendation.toUpperCase()}] ${cv.testId}`);
      console.log(`    ${cv.reasoning}\n`);
    }
  }

  const failed = ctx.qualityChecks.filter((c) => !c.passed);
  if (failed.length > 0) {
    console.log("## Quality Issues");
    for (const c of failed) {
      console.log(`  [${c.severity}] ${c.check}: ${c.details}`);
    }
    console.log();
  }

  if (ctx.verdicts.length > 0) {
    console.log("## Verdicts");
    for (const v of ctx.verdicts) {
      console.log(`  [${v.decision.toUpperCase()}] ${v.snapshotId}`);
      console.log(`    ${v.reasoning}`);
      console.log(`    confidence: ${(v.confidence * 100).toFixed(0)}%\n`);
    }
  }
  return 0;
}

// ---- Helpers ----

async function listFiles(dir: string, suffix: string): Promise<string[]> {
  try {
    const entries = await readdir(dir);
    return entries.filter((e) => e.endsWith(suffix));
  } catch {
    return [];
  }
}

// ---- Main ----

function specPaths(): SpecPaths {
  return {
    projectRoot: PROJECT_ROOT,
    baselinesDir: BASELINES_DIR,
    snapshotsDir: SNAPSHOTS_DIR,
    specPath: SPEC_PATH,
    expectationPath: EXPECTATION_PATH,
  };
}

/**
 * Each handler returns its exit code, or nothing when it has no failing case.
 *
 * Ten `process.exit()` calls lived in these commands until v7. That made the
 * module untestable — `process.exit` in a vitest worker takes the whole file with
 * it — and it made `runWorkflowCli` a liar: it returned `Promise<void>` while
 * actually deciding the process's fate. The exit code belongs to whoever owns the
 * process, which is the guard at the bottom of this file or `cli.ts`.
 */
const commands: Record<string, (argv: string[]) => Promise<number | void>> = {
  init: (argv) => init(parseCaptureOptions(argv)),
  capture: (argv) => capture(parseCaptureOptions(argv)),
  verify: () => verify(),
  approve: () => approve(),
  report: () => report(),
  graph: () => runGraph(PROJECT_ROOT),
  affected: () => runAffected(PROJECT_ROOT),
  introspect: () => runIntrospect(specPaths()),
  "spec-verify": () => runSpecVerify(specPaths()),
  expect: () => runExpect(specPaths()),
};

function formatWorkflowUsage(): string {
  return `vlmkit workflow <command>

Commands:
  init [--config <path>] [--base-url <url>]
               Create baseline screenshots + a11y trees
  capture [--config <path>] [--base-url <url>]
               Take current snapshots
  verify       Compare snapshots against baselines
  approve      Promote current snapshots to new baselines
  report       Show the latest verification report
  graph        Display dependency graph
  affected     Show components affected by current changes
  introspect   Generate spec.json from current a11y snapshots
  spec-verify  Verify spec.json invariants against current state
  expect       Auto-generate expectation.json from baseline vs snapshot diff

Capture config (vlmkit.config.json):
  {
    "baseUrl": "http://localhost:3000",
    "capture": {
      "routes": [
        { "name": "home", "path": "/", "waitFor": "main" },
        { "name": "about", "path": "/about" }
      ]
    }
  }

Routes can also be supplied via env vars:
  VLMKIT_CONFIG_PATH    Path to capture config file
  VLMKIT_BASE_URL       Override the base URL
  VLMKIT_CAPTURE_ROUTES JSON-encoded array of routes`;
}

/** @returns the exit code. 0 unless a command reported a failure. */
export async function runWorkflowCli(argv = process.argv.slice(2)): Promise<number> {
  const command = argv[0];
  if (!command || command === "help" || command === "--help" || command === "-h") {
    console.log(formatWorkflowUsage());
    return 0;
  }

  const handler = commands[command];
  if (!handler) {
    console.error(`Unknown workflow command: ${command}\n`);
    console.error(formatWorkflowUsage());
    return 1;
  }

  return (await handler(argv.slice(1))) ?? 0;
}

// `isCliEntry` rather than the `new URL(import.meta.url).pathname === process.argv[1]`
// this used to carry: that spelling compares an unresolved argv against a URL path, so
// `node ./src/cli/workflow.ts` did not match and the command silently did nothing.
if (isCliEntry(import.meta.url)) {
  runWorkflowCli()
    .then((code) => { process.exitCode = code; })
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    });
}
