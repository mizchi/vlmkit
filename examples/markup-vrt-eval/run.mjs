import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { resolve } from "node:path";
import {
  buildOfflineGeneratedTest,
  buildOfflineLocatorInventory,
  buildOfflineStructuredPlan,
  renderOfflinePlanMarkdown,
} from "./run-offline-fixtures.mjs";
import { buildRepairContext, renderRepairContextMarkdown } from "./repair-context.mjs";
import {
  buildReport,
  evaluateExpectedChange,
  renderHtmlReport,
  renderMarkdown,
} from "./run-report.mjs";
import { buildVlmRegionDiffArgs, summarizeVlmRegionDiff } from "./run-utils.mjs";

const root = process.cwd();
const offline = process.env.MARKUP_EVAL_OFFLINE === "1";
const provider = offline ? "offline" : process.env.PROVIDER ?? "anthropic";
const outRoot = ".vrt/markup-vrt-eval";
const specRoot = `${outRoot}/specs`;
const generatedRoot = `${outRoot}/generated`;
const planPath = `${specRoot}/release-queue.plan.md`;
const structuredPlanPath = `${specRoot}/release-queue.plan.json`;
const locatorsPath = `${specRoot}/release-queue.locators.json`;
const observationsPath = `${specRoot}/release-queue.observations.json`;
const visualContextPath = `${specRoot}/release-queue.visual-context.json`;
const generatedTestPath = `${generatedRoot}/release-queue.spec.ts`;
const repairContextPath = `${outRoot}/repair-context.json`;
const repairContextMarkdownPath = `${outRoot}/repair-context.md`;
const htmlReportPath = `${outRoot}/report.html`;
const vlmRegionDiffPath = `${outRoot}/vlm-region-diff.json`;
const configPath = "examples/markup-vrt-eval/playwright.config.ts";
const requestPath = "examples/markup-vrt-eval/specs/release-queue.request.md";
const rulesPath = "examples/markup-vrt-eval/specs/_generation-rules.md";
const expectedChangePath = "examples/markup-vrt-eval/specs/expected-change.json";
const observeTestPath = "examples/markup-vrt-eval/tests/observe.spec.ts";

await mkdir(specRoot, { recursive: true });
await mkdir(generatedRoot, { recursive: true });

const steps = [];

await timed("observe", [
  "pnpm", "exec", "playwright", "test",
  "--config", configPath,
  observeTestPath,
]);

if (offline) {
  await timedTask("plan-offline", "write offline planner artifacts", async () => {
    await writeFile(planPath, renderOfflinePlanMarkdown());
    await writeFile(structuredPlanPath, JSON.stringify(buildOfflineStructuredPlan(), null, 2) + "\n");
    await writeFile(locatorsPath, JSON.stringify(buildOfflineLocatorInventory(), null, 2) + "\n");
  });
  await timedTask("generate-offline", "write offline generated test", async () => {
    await writeFile(generatedTestPath, buildOfflineGeneratedTest("../../../examples/markup-vrt-eval/support/goto-app"));
  });
  await timed("generate-and-vrt-gate", [
    "pnpm", "exec", "playwright", "test",
    "--config", configPath,
    generatedTestPath,
    "--update-snapshots",
  ]);
} else {
  await timed("plan", [
    "pnpm", "exec", "vlmkit-plan",
    "--title", "Release Queue VRT Smoke",
    "--request-file", requestPath,
    "--observations", observationsPath,
    "--out", planPath,
    "--structured-out", structuredPlanPath,
    "--locator-inventory-out", locatorsPath,
    "--scope", "smoke",
    "--provider", provider,
    "--max-attempts", "3",
  ]);

  await timed("generate-and-vrt-gate", [
    "pnpm", "exec", "vlmkit-generate",
    "--plan", planPath,
    "--rules", rulesPath,
    "--locator-inventory", locatorsPath,
    "--helper-import", "../../../examples/markup-vrt-eval/support/goto-app",
    "--out", generatedTestPath,
    "--provider", provider,
    "--max-attempts", "3",
    "--overwrite",
    "--gate-command", `pnpm exec playwright test --config ${configPath} {testFile} --update-snapshots`,
    "--runtime-gate",
    "--playwright-config", configPath,
    "--runtime-gate-runs", "2",
  ]);
}

const stabilityRuns = [];
for (let i = 1; i <= 2; i++) {
  stabilityRuns.push(await timed(`stability-check-${i}`, [
    "pnpm", "exec", "playwright", "test",
    "--config", configPath,
    generatedTestPath,
  ]));
}

const regression = await timed("visual-regression-check", [
  "pnpm", "exec", "playwright", "test",
  "--config", configPath,
  generatedTestPath,
], {
  MARKUP_EVAL_VARIANT: "regression",
}, { allowFailure: true });

const generatedSource = await readFile(generatedTestPath, "utf8");
const plan = await readFile(planPath, "utf8");
const locators = JSON.parse(await readFile(locatorsPath, "utf8"));
const visualContext = JSON.parse(await readFile(visualContextPath, "utf8"));
const expectedChange = JSON.parse(await readFile(expectedChangePath, "utf8"));
const visualRegressionDetected = regression.exitCode !== 0
  && /toHaveScreenshot|Screenshot comparison|screenshot/i.test(`${regression.stdout}\n${regression.stderr}`);
const repairContext = await buildRepairContext({
  root,
  outputDir: `${outRoot}/test-results`,
  playwrightReportPath: `${outRoot}/playwright-report.json`,
  visualContextPath,
  generatedTestPath,
  locatorsPath,
  requestPath,
  planPath,
  rulesPath,
  regression,
});
await writeFile(repairContextPath, JSON.stringify(repairContext, null, 2) + "\n");
await writeFile(repairContextMarkdownPath, renderRepairContextMarkdown(repairContext));
const vlmRegionDiffStatus = await maybeRunVlmRegionDiff(repairContext);
const vlmRegionSummary = vlmRegionDiffStatus === "written"
  ? summarizeVlmRegionDiff(JSON.parse(await readFile(vlmRegionDiffPath, "utf8")))
  : summarizeVlmRegionDiff(null);
const expectedChangeApproval = evaluateExpectedChange(repairContext, expectedChange, visualRegressionDetected);
const report = buildReport({
  provider,
  scenario: "Release Queue blocked filter and detail panel VRT smoke",
  steps,
  generatedSource,
  plan,
  locators,
  visualContext,
  repairContext,
  stabilityRuns,
  visualRegressionDetected,
  expectedChangeApproval,
  vlmRegionSummary,
  vlmRegionDiffStatus,
  artifacts: {
    observationsPath,
    visualContextPath,
    planPath,
    structuredPlanPath,
    locatorsPath,
    generatedTestPath,
    playwrightReport: `${outRoot}/playwright-report.json`,
    repairContextPath,
    repairContextMarkdownPath,
    htmlReportPath,
    vlmRegionDiffPath: vlmRegionDiffStatus === "written" ? vlmRegionDiffPath : null,
  },
});

await writeFile(`${outRoot}/report.json`, JSON.stringify(report, null, 2) + "\n");
await writeFile(`${outRoot}/report.md`, renderMarkdown(report));
await writeFile(htmlReportPath, renderHtmlReport(report, repairContext));
console.log(renderMarkdown(report));

if (report.qualityFailures.length > 0) {
  console.error(`Markup VRT eval failed quality gates:\n- ${report.qualityFailures.join("\n- ")}`);
  process.exitCode = 1;
}

async function timed(name, args, extraEnv = {}, opts = {}) {
  const started = performance.now();
  const result = await run(args, extraEnv);
  const durationMs = Math.round(performance.now() - started);
  steps.push({
    name,
    command: args.join(" "),
    exitCode: result.exitCode,
    durationMs,
  });
  if (result.exitCode !== 0 && !opts.allowFailure) {
    process.stdout.write(result.stdout);
    process.stderr.write(result.stderr);
    throw new Error(`${name} failed with exit code ${result.exitCode}`);
  }
  return result;
}

async function timedTask(name, command, task) {
  const started = performance.now();
  try {
    await task();
    const durationMs = Math.round(performance.now() - started);
    steps.push({ name, command, exitCode: 0, durationMs });
    return { exitCode: 0, stdout: "", stderr: "" };
  } catch (error) {
    const durationMs = Math.round(performance.now() - started);
    steps.push({ name, command, exitCode: 1, durationMs });
    throw error;
  }
}

function run(args, extraEnv) {
  return new Promise((resolveRun) => {
    const [cmd, ...rest] = args;
    const child = spawn(cmd, rest, {
      cwd: root,
      env: { ...process.env, ...extraEnv },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      process.stdout.write(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
      process.stderr.write(chunk);
    });
    child.on("close", (exitCode) => resolveRun({ exitCode: exitCode ?? 1, stdout, stderr }));
  });
}

async function maybeRunVlmRegionDiff(repairContext) {
  if (process.env.MARKUP_EVAL_VLM_REGION_DIFF !== "1") return "skipped";
  if (!process.env.OPENROUTER_API_KEY) return "skipped-no-openrouter-key";
  const baseline = repairContext.artifacts.expectedPng;
  const actual = repairContext.artifacts.actualPng;
  if (!baseline || !actual) return "skipped-missing-vrt-artifacts";
  const result = await timed("vlm-region-diff", buildVlmRegionDiffArgs({
    baseline,
    actual,
    elementsJson: visualContextPath,
    out: vlmRegionDiffPath,
  }), {}, { allowFailure: true });
  return result.exitCode === 0 ? "written" : "failed";
}
