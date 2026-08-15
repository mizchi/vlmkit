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
import { join, sep } from "node:path";
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

/**
 * The Playwright spec `init` and `capture` drive.
 *
 * **These names were `vrt-capture.spec.*` and nothing on disk has been called that since
 * the rename.** The file is `e2e/vlmkit-capture.spec.ts` and the build emits
 * `dist/e2e/vlmkit-capture.spec.mjs`, so neither candidate ever matched and both commands
 * failed 100% of the time. The throw below had the right name all along — it says
 * `e2e/vlmkit-capture.spec.ts` — which is the tell that only the two path literals were
 * missed by the rename.
 *
 * It stayed invisible because the callers' `catch (e)` discarded `e` and printed
 * "Playwright capture failed. Is the server running?" instead. A hard, deterministic
 * failure read as an environment problem, so the message sent every reader to check a
 * server that was never contacted. Tests did not catch it either: `workflow-cli.test.ts`
 * covers option parsing and the command table, and a path literal is neither.
 *
 * Packaging: `package.json`'s `files` publishes `dist/**` but excludes `dist/e2e/**`, and
 * the `e2e/` sources are not published either, so an npm-installed vlmkit has no spec at
 * all and no build can produce one. Whether to publish the spec or retire these two
 * commands is still a packaging decision (see TODO.md) — what changed is that the failure
 * now says so, instead of telling an installed user to run a build that cannot help.
 */
/**
 * The spec path **relative to `HARNESS_ROOT`**, because that is what playwright matches.
 *
 * Positional arguments to `playwright test` are filters compared against the collected
 * test files, and collection is driven by the config's `testDir`. An absolute path from
 * another tree matches nothing, which is why an earlier attempt at this fix still got
 * "No tests found" — see `runCaptureSpec` for the cwd half of the same problem.
 *
 * One candidate, not two. The list used to carry `dist/e2e/vlmkit-capture.spec.mjs` as a
 * fallback, and it could only ever hurt: `playwright.config.ts` sets `testDir: "./e2e"`, so
 * the built copy is outside collection and selecting it reports "No tests found" — the
 * obscure failure this whole function exists to replace with a clear one. It is reachable
 * only when the source spec is absent, which is exactly the state that needs the clear
 * message. Playwright transpiles TS itself, so the source candidate needs no build.
 */
function resolveCaptureSpecPath(): string {
  const candidates = [join("e2e", "vlmkit-capture.spec.ts")];
  const found = candidates.find((candidate) => existsSync(join(HARNESS_ROOT, candidate)));
  if (!found) throw new Error(captureSpecMissingMessage(HARNESS_ROOT, candidates));
  return found;
}

/**
 * Why the spec is missing, told apart by where vlmkit is running from.
 *
 * The two cases need opposite advice, and the single message used to give the installed
 * user the checkout's: "Run `pnpm build` (source checkout), or restore
 * `e2e/vlmkit-capture.spec.ts`". Neither half is actionable from `node_modules` — there is
 * no build to run, nothing to restore, and the reason is not local damage but a deliberate
 * `!dist/e2e/**` in the published `files`. So it sent a reader to fix something that is not
 * broken, which is the same failure mode as the "Is the server running?" line above: advice
 * about a cause nobody checked.
 *
 * Exported for the test — reaching this branch for real means an actual `npx playwright
 * test` spawn, and a message is not worth a browser.
 */
export function captureSpecMissingMessage(harnessRoot: string, candidates: string[]): string {
  const installed = harnessRoot.split(sep).includes("node_modules");
  const why = installed
    ? "This is an installed copy of vlmkit, and the published package deliberately omits the\n"
      + "capture spec (`\"!dist/e2e/**\"` in `files`), so no build here can produce it.\n"
      + "`workflow init` and `workflow capture` need a source checkout:\n"
      + "  git clone https://github.com/mizchi/vlmkit && cd vlmkit && pnpm install\n"
      + "Every other command — `vlmkit check *`, `scan *`, `diff *`, `snapshot` — works from\n"
      + "the installed package and needs none of this."
    : "This looks like a source checkout, so the file should be here: restore\n"
      + `\`${candidates[0]}\` (\`git checkout -- ${candidates[0]}\`).`;
  return `Missing the capture spec. Looked under ${harnessRoot} for:\n`
    + candidates.map((c) => `  ${c}\n`).join("")
    + why;
}

function buildCaptureEnv(mode: "baseline" | "capture", options: WorkflowCaptureOptions) {
  const env: NodeJS.ProcessEnv = { ...EXEC_OPTS.env, VLMKIT_MODE: mode };

  // Resolve config + routes against PROJECT_ROOT (user's working directory),
  // so external projects can drop a vlmkit.config.json next to their app.
  const envRoutes = readEnv("CAPTURE_ROUTES");
  const routeSet = resolveCaptureRoutes({
    cwd: PROJECT_ROOT,
    configPath: options.configPath,
    envConfigPath: readEnv("CONFIG_PATH"),
    envBaseUrl: options.baseUrl ?? readEnv("BASE_URL"),
    // `envRoutes` was not passed at all, so `VLMKIT_CAPTURE_ROUTES` — documented as the
    // HIGHEST-precedence route source in `vlmkit workflow --help` and in
    // docs/cli-reference.md — was read by nobody and silently ignored. The unit test at
    // capture-config.test.ts:127 passes `envRoutes` straight into `resolveCaptureRoutes`,
    // so it proved the function worked while the wiring did not exist.
    envRoutes,
  });

  if (routeSet.configPath) {
    env.VLMKIT_CONFIG_PATH = routeSet.configPath;
  }
  env.VLMKIT_BASE_URL = routeSet.baseUrl;
  env.VLMKIT_PROJECT_ROOT = PROJECT_ROOT;

  if (routeSet.source === "env") {
    console.log(`  (routes from VLMKIT_CAPTURE_ROUTES: ${routeSet.routes.map((r) => r.path).join(", ")})`);
    // An env var outranking a flag the user typed is the documented precedence, but it
    // must not be silent — that is an explicit request quietly not honoured.
    if (options.configPath || readEnv("CONFIG_PATH")) {
      console.log(`  (VLMKIT_CAPTURE_ROUTES takes precedence — the config file's routes were NOT used;`
        + ` unset it to use --config)`);
    }
  } else if (routeSet.source === "config" && routeSet.configPath) {
    console.log(`  (using capture config: ${routeSet.configPath})`);
    console.log(`  (routes: ${routeSet.routes.map((r) => r.path).join(", ")})`);
  } else if (routeSet.source === "default") {
    console.log(`  (using default routes — pass --config or create vlmkit.config.json to customize)`);
  }

  return env;
}

/**
 * What to print when a capture run produced no PNGs, given what actually went wrong.
 *
 * `init` and `capture` each carried a byte-identical pair of `console.error` lines that
 * read the caught error not at all:
 *
 *     console.error("Playwright capture failed. Is the server running?");
 *     console.error("Start your target app and set VLMKIT_BASE_URL if it is not http://127.0.0.1:4174");
 *
 * Measured with four unrelated causes — a `--config` path that does not exist, a config
 * file containing invalid JSON, malformed `VLMKIT_CAPTURE_ROUTES`, and a correct config
 * with no server — all four printed those two lines verbatim, and none of the four was
 * the real cause: the spec lookup above was broken, so every run failed there first.
 *
 * The port was hardcoded too, so a config declaring `http://localhost:9999` still got
 * told to check `127.0.0.1:4174`. Two ways of naming a cause nobody had checked.
 */
function reportCaptureFailure(err: unknown, baseUrl: string | undefined): void {
  const message = err instanceof Error ? err.message : String(err);
  console.error("Capture produced no screenshots.");
  // The real error first and unabridged. It is the only line that is always true.
  console.error(message.split("\n").map((l) => `  ${l}`).join("\n"));
  // The server hint is advice about ONE cause, so it is offered as advice rather than as
  // a diagnosis, and it names the URL that was actually resolved.
  if (baseUrl) {
    console.error(`If the target app is not running at ${baseUrl}, start it or set VLMKIT_BASE_URL.`);
  }
}

/**
 * Run the capture spec **from `HARNESS_ROOT`**, not from the user's project.
 *
 * This used to inherit `EXEC_OPTS.cwd = PROJECT_ROOT`, and every part of playwright's
 * setup is resolved from cwd, so running in an external project meant:
 *
 *   - no `playwright.config.ts` there, so `testDir` defaulted to that directory and the
 *     spec was not collected — "No tests found";
 *   - and once a config was pointed at explicitly, `npx` resolved a *different*
 *     `@playwright/test` than the one the spec imports — "Playwright Test did not expect
 *     test.describe() to be called here … two different versions of @playwright/test".
 *
 * Running in HARNESS_ROOT settles config, testDir, and the module instance together.
 * Nothing about the user's project is lost by it: the spec already takes the project's
 * routes, base URL and output directory from `VLMKIT_CONFIG_PATH` / `VLMKIT_BASE_URL` /
 * `VLMKIT_PROJECT_ROOT` / `VLMKIT_OUTPUT_DIR`, which `buildCaptureEnv` sets. Verified —
 * with an external config declaring one route at `http://localhost:9999`, playwright
 * collected 2 tests (desktop + mobile) and failed only on `ERR_CONNECTION_REFUSED` at
 * `http://localhost:9999/a`, which is the failure the old message had always claimed.
 */
function runCaptureSpec(env: NodeJS.ProcessEnv) {
  execFileSync(
    NPX_COMMAND,
    ["playwright", "test", resolveCaptureSpecPath(), "--reporter=list"],
    { ...EXEC_OPTS, cwd: HARNESS_ROOT, env },
  );
}

/**
 * Resolve the capture environment ahead of the run, so a bad config is reported as a bad
 * config.
 *
 * It used to be built inside `runCaptureSpec`'s argument list, i.e. inside the callers'
 * `try` — so `Capture config not found: …`, a `JSON.parse` failure on the config file, and
 * malformed `VLMKIT_CAPTURE_ROUTES` all came back out as "Is the server running?". Doing
 * it out here also makes the resolved base URL available to the failure message, which
 * used to name a hardcoded port.
 */
function prepareCaptureEnv(
  mode: "baseline" | "capture",
  options: WorkflowCaptureOptions,
): { env: NodeJS.ProcessEnv } | { error: string } {
  try {
    return { env: buildCaptureEnv(mode, options) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// ---- Commands ----

async function init(options: WorkflowCaptureOptions = {}): Promise<number> {
  console.log("=== VRT Init: Creating baselines ===\n");

  await mkdir(BASELINES_DIR, { recursive: true });

  const prepared = prepareCaptureEnv("baseline", options);
  if ("error" in prepared) {
    console.error(`Capture config error: ${prepared.error}`);
    return 1;
  }

  console.log("Running Playwright to capture baseline screenshots + a11y...");
  try {
    runCaptureSpec(prepared.env);
  } catch (e) {
    // Some tests may fail (e.g. title check) but captures still succeed
    const captured = await listFiles(BASELINES_DIR, ".png");
    if (captured.length === 0) {
      reportCaptureFailure(e, prepared.env.VLMKIT_BASE_URL);
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

  const prepared = prepareCaptureEnv("capture", options);
  if ("error" in prepared) {
    console.error(`Capture config error: ${prepared.error}`);
    return 1;
  }

  console.log("Running Playwright to capture current state...");
  try {
    runCaptureSpec(prepared.env);
  } catch (e) {
    const captured = await listFiles(SNAPSHOTS_DIR, ".png");
    if (captured.length === 0) {
      reportCaptureFailure(e, prepared.env.VLMKIT_BASE_URL);
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
