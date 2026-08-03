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
import type { UnifiedAgentContext } from "@mizchi/vlmkit-core/types.ts";
import { readEnv } from "@mizchi/vlmkit-core/legacy-names.ts";

const NPX_COMMAND = process.platform === "win32" ? "npx.cmd" : "npx";

const EXEC_OPTS: ExecSyncOptions = {
  cwd: PROJECT_ROOT,
  stdio: "inherit",
  env: {
    ...process.env,
    VRT_OUTPUT_DIR: PROJECT_ROOT,
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
  const env: NodeJS.ProcessEnv = { ...EXEC_OPTS.env, VRT_MODE: mode };

  // Resolve config + routes against PROJECT_ROOT (user's working directory),
  // so external projects can drop a vrt.config.json next to their app.
  const routeSet = resolveCaptureRoutes({
    cwd: PROJECT_ROOT,
    configPath: options.configPath,
    envConfigPath: readEnv("CONFIG_PATH"),
    envBaseUrl: options.baseUrl ?? readEnv("BASE_URL"),
  });

  if (routeSet.configPath) {
    env.VRT_CONFIG_PATH = routeSet.configPath;
  }
  env.VRT_BASE_URL = routeSet.baseUrl;
  env.VRT_PROJECT_ROOT = PROJECT_ROOT;

  if (routeSet.source === "config" && routeSet.configPath) {
    console.log(`  (using capture config: ${routeSet.configPath})`);
    console.log(`  (routes: ${routeSet.routes.map((r) => r.path).join(", ")})`);
  } else if (routeSet.source === "default") {
    console.log(`  (using default vrt routes — pass --config or create vrt.config.json to customize)`);
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

async function init(options: WorkflowCaptureOptions = {}) {
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
      console.error("Start your target app and set VRT_BASE_URL if it is not http://127.0.0.1:4174");
      process.exit(1);
    }
    console.log("  (some tests had warnings, but captures completed)");
  }

  const files = await listFiles(BASELINES_DIR, ".png");
  const a11yFiles = await listFiles(BASELINES_DIR, ".a11y.json");
  console.log(`\nBaselines created: ${files.length} screenshots, ${a11yFiles.length} a11y trees`);
  console.log(`Stored in: ${BASELINES_DIR}`);
}

async function capture(options: WorkflowCaptureOptions = {}) {
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
      console.error("Start your target app and set VRT_BASE_URL if it is not http://127.0.0.1:4174");
      process.exit(1);
    }
    console.log("  (some tests had warnings, but captures completed)");
  }

  const files = await listFiles(SNAPSHOTS_DIR, ".png");
  console.log(`\nSnapshots captured: ${files.length} screenshots`);
}

async function verify() {
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
    process.exit(1);
  } else if (result.needsReview) {
    console.log("\nWARNING — Some changes need review. Run `vlmkit workflow report` for details.");
    console.log("If changes are intentional, run `vlmkit workflow approve` to update baselines.");
    process.exit(0);
  } else if (result.vrtDiffs.length === 0 && result.a11yDiffs.length === 0) {
    console.log("\nPASS — No visual or semantic changes detected.");
    process.exit(0);
  } else {
    console.log("\nPASS — All changes approved.");
    console.log("Run `vlmkit workflow approve` to update baselines.");
    process.exit(0);
  }
}

async function approve() {
  console.log("=== VRT Approve: Updating baselines ===\n");

  if (!existsSync(SNAPSHOTS_DIR)) {
    console.error("No snapshots found. Run `vlmkit workflow capture` first.");
    process.exit(1);
  }

  // Copy snapshots → baselines
  if (existsSync(BASELINES_DIR)) {
    await rm(BASELINES_DIR, { recursive: true });
  }
  await cp(SNAPSHOTS_DIR, BASELINES_DIR, { recursive: true });

  const files = await listFiles(BASELINES_DIR, ".png");
  console.log(`Baselines updated: ${files.length} screenshots`);
  console.log("New baselines stored in: " + BASELINES_DIR);
}

async function report() {
  if (!existsSync(REPORT_PATH)) {
    console.error("No report found. Run `vlmkit workflow verify` first.");
    process.exit(1);
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

const commands: Record<string, (argv: string[]) => Promise<void>> = {
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

Capture config (vrt.config.json):
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
  VRT_CONFIG_PATH   Path to capture config file
  VRT_BASE_URL      Override the base URL
  VRT_CAPTURE_ROUTES JSON-encoded array of routes`;
}

export async function runWorkflowCli(argv = process.argv.slice(2)) {
  const command = argv[0];
  if (!command || command === "help" || command === "--help" || command === "-h") {
    console.log(formatWorkflowUsage());
    return;
  }

  const handler = commands[command];
  if (!handler) {
    console.error(`Unknown workflow command: ${command}\n`);
    console.error(formatWorkflowUsage());
    process.exit(1);
  }

  await handler(argv.slice(1));
}

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  runWorkflowCli().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
