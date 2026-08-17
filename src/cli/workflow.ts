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
  PROJECT_ROOT,
  BASELINES_DIR,
  SNAPSHOTS_DIR,
  OUTPUT_DIR,
  REPORT_PATH,
  EXPECTATION_PATH,
  SPEC_PATH,
} from "./workflow/paths.ts";
import { resolveCaptureRoutes, type CaptureRoute } from "@mizchi/vlmkit-capture/capture-config.ts";
import { captureRoutes, type RouteCaptureResult } from "@mizchi/vlmkit-capture/route-capture.ts";
import { isCliEntry } from "@mizchi/vlmkit-core/plugin/cli-entry.ts";
import type { UnifiedAgentContext } from "@mizchi/vlmkit-core/types.ts";
import { readEnv } from "@mizchi/vlmkit-core/project-config.ts";


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
 * Where `init` and `capture` get their screenshots + a11y trees.
 *
 * Until this change: `npx playwright test e2e/vlmkit-capture.spec.ts`, spawned from
 * `HARNESS_ROOT`. The spec was 135 lines of `goto` / `screenshot` / `getFullAXTree` / write with
 * no fixtures and no snapshot assertions, and being a test file rather than a function is what
 * made "publish `dist/e2e` or retire these two commands" a question at all: `package.json`
 * excludes `!dist/e2e/**` and the sources are unpublished, so an installed vlmkit had no spec
 * and no build could make one.
 *
 * Retiring the commands was the more expensive half of that choice. `verify`, `approve`,
 * `report`, `introspect`, `spec-verify` and `expect` all read the `.a11y.json` sidecars this
 * produces, and nothing else produces them — `vlmkit snapshot` writes multi-viewport PNGs and no
 * a11y trees. Deleting two commands would have orphaned six.
 *
 * So the SPEC is what is retired. `captureRoutes` in `@mizchi/vlmkit-capture/route-capture.ts`
 * does the same work in this process via `withBrowser`, which is what every gate already uses.
 * Gone with it: `resolveCaptureSpecPath`, `captureSpecMissingMessage` (a message about a file
 * that no longer needs to exist), the `npx playwright test` spawn and its `testDir`/filter
 * fragility, the `HARNESS_ROOT` lookup, and the silent overwrite from running one spec under two
 * playwright projects that wrote the same filenames.
 */
interface CaptureTargets {
  baseUrl: string;
  routes: CaptureRoute[];
}

/**
 * Resolve base URL + routes, and say where they came from.
 *
 * No longer builds an environment for a subprocess — the routes are passed straight to
 * `captureRoutes` — but the precedence reporting below is unchanged, and it is the part that
 * had bugs worth keeping fixed.
 */
function resolveCaptureTargets(options: WorkflowCaptureOptions): CaptureTargets {
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

  return { baseUrl: routeSet.baseUrl, routes: routeSet.routes };
}

/**
 * What to print when a capture run produced no screenshots, given what actually went wrong.
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
 * the real cause: the spec lookup was broken, so every run failed there first.
 *
 * The port was hardcoded too, so a config declaring `http://localhost:9999` still got
 * told to check `127.0.0.1:4174`. Two ways of naming a cause nobody had checked.
 *
 * Now that capture runs in-process, the errors are PER ROUTE instead of one subprocess exit
 * string, so this prints each route's own failure. That is the difference between "the app is
 * not running" and "route /admin 404s while the other four are fine".
 */
function reportCaptureFailure(result: RouteCaptureResult, baseUrl: string): void {
  console.error("Capture produced no screenshots.");
  for (const failure of result.failures) {
    console.error(`  ${failure.name} (${failure.url}):`);
    console.error(failure.error.split("\n").map((l) => `    ${l}`).join("\n"));
  }
  // Advice about ONE cause, offered as advice rather than as a diagnosis, naming the URL that
  // was actually resolved.
  console.error(`If the target app is not running at ${baseUrl}, start it or set VLMKIT_BASE_URL.`);
}

/**
 * Report what a capture run produced, including the parts that used to be one vague line.
 *
 * The old path could only count files afterwards, so a route whose `waitFor` never matched, a
 * route that rendered an empty body, and a route that 404'd were all "(some tests had warnings,
 * but captures completed)". Each is a different thing to go and fix.
 */
function reportCaptureOutcome(result: RouteCaptureResult): void {
  for (const failure of result.failures) {
    console.log(`  ! ${failure.name}: ${failure.error.split("\n")[0]}`);
  }
  for (const entry of result.captured) {
    if (entry.waitForTimedOut) {
      console.log(`  ! ${entry.name}: waitFor never matched — captured without it`);
    }
  }
  for (const entry of result.notOk) {
    // Loud, because this is the one that quietly poisons a baseline: `page.goto` does not throw
    // on 4xx, so a mistyped route captures the error page and every later `verify` compares
    // against it.
    console.log(`  ! ${entry.name}: HTTP ${entry.status} from ${entry.url}`
      + ` — the capture is of the server's error page`);
  }
  for (const entry of result.blank) {
    // The spec asserted on this with `expect(bodyText.length).toBeGreaterThan(0)`, which failed
    // the test and then got swallowed by the callers' file-count check.
    console.log(`  ! ${entry.name}: page rendered no text — the screenshot is of an empty body`);
  }
  const degraded = result.captured.filter((c) => c.a11ySource !== "cdp");
  if (degraded.length > 0) {
    // Silently degrading mattered: an `ariaSnapshot` string and a real tree are not
    // interchangeable to the commands that diff them.
    console.log(`  ! ${degraded.length} route(s) fell back from the CDP a11y tree`
      + ` (${degraded.map((d) => `${d.name}:${d.a11ySource}`).join(", ")})`);
  }
}

// ---- Commands ----

/**
 * `init` and `capture` differ in one thing — where the files land — so they share this.
 *
 * They were two 30-line bodies that differed by a directory and two strings, and both carried
 * the same file-count guessing. `capture` additionally wipes its directory first, which `init`
 * must not do: a baseline directory is the thing you are keeping.
 */
async function runCapture(
  mode: "baseline" | "capture",
  outputDir: string,
  options: WorkflowCaptureOptions,
): Promise<number> {
  let targets: CaptureTargets;
  try {
    // Resolved before touching the browser, so a bad `--config` path, invalid JSON in the config
    // file, or malformed `VLMKIT_CAPTURE_ROUTES` is reported as what it is. All three used to
    // surface as "Is the server running?".
    targets = resolveCaptureTargets(options);
  } catch (err) {
    console.error(`Capture config error: ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  }

  console.log(`Capturing ${targets.routes.length} route(s) from ${targets.baseUrl} …`);
  let result: RouteCaptureResult;
  try {
    result = await captureRoutes({ baseUrl: targets.baseUrl, routes: targets.routes, outputDir });
  } catch (err) {
    // Only a whole-browser failure reaches here — per-route errors are collected. Launch
    // failures are the one case where nothing about the routes is knowable.
    console.error(`Capture could not start a browser: ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  }

  reportCaptureOutcome(result);
  if (result.captured.length === 0) {
    reportCaptureFailure(result, targets.baseUrl);
    return 1;
  }
  const label = mode === "baseline" ? "Baselines created" : "Snapshots captured";
  console.log(`\n${label}: ${result.captured.length} screenshot(s), `
    + `${result.captured.length} a11y tree(s) at ${result.viewport.width}x${result.viewport.height}`);
  console.log(`Stored in: ${outputDir}`);
  // A partial run is a failure of the routes that failed, not of the command: the usable
  // baselines are on disk and named. The exit code says something went wrong so CI notices.
  //
  // A non-2xx route counts. Capturing a 404 page and exiting 0 is how a baseline becomes a
  // picture of an error message that then passes forever.
  return result.failures.length > 0 || result.notOk.length > 0 ? 1 : 0;
}

async function init(options: WorkflowCaptureOptions = {}): Promise<number> {
  console.log("=== VRT Init: Creating baselines ===\n");
  await mkdir(BASELINES_DIR, { recursive: true });
  return runCapture("baseline", BASELINES_DIR, options);
}

async function capture(options: WorkflowCaptureOptions = {}): Promise<number> {
  console.log("=== VRT Capture: Taking snapshots ===\n");
  // Cleaned, so a route removed from the config stops being compared against its baseline
  // instead of silently reporting yesterday's pixels.
  if (existsSync(SNAPSHOTS_DIR)) {
    await rm(SNAPSHOTS_DIR, { recursive: true });
  }
  await mkdir(SNAPSHOTS_DIR, { recursive: true });
  return runCapture("capture", SNAPSHOTS_DIR, options);
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
