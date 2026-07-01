#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { handleCliError } from "@mizchi/vlmkit-core/cli-error.ts";

export type MarkupLoopProvider = "anthropic" | "gemini" | "openrouter";
export type MarkupLoopScope = "smoke" | "focused" | "full";

export interface MarkupLoopConfig {
  title: string;
  baseUrl: string;
  scope: MarkupLoopScope;
  provider?: MarkupLoopProvider;
  model?: string;
  maxAttempts: number;
  runtimeGateRuns: number;
  screenshots: boolean;
  requestFile: string;
  observationsFile: string;
  rulesFile: string;
  planFile: string;
  structuredPlanFile: string;
  locatorInventoryFile: string;
  generatedTestFile: string;
  helperImport: string;
  playwrightConfig: string;
  testCommand: string;
  updateSnapshotsCommand: string;
  guardrailContextFile: string;
}

export interface InitMarkupLoopOptions {
  cwd?: string;
  configPath?: string;
  topic?: string;
  title?: string;
  baseUrl?: string;
  provider?: MarkupLoopProvider;
  playwrightConfig?: string;
  force?: boolean;
}

export interface MarkupLoopCommand {
  display: string;
  argv: string[];
}

export interface MarkupLoopCommands {
  plan: MarkupLoopCommand;
  generate: MarkupLoopCommand;
}

export interface MarkupLoopReadiness {
  ok: boolean;
  missing: string[];
  commands: MarkupLoopCommands;
}

const DEFAULT_CONFIG_PATH = ".vlmkit/markup-loop.json";
const LOOP_DIR = ".vlmkit/markup-loop";

export function createDefaultMarkupLoopConfig(options: InitMarkupLoopOptions = {}): MarkupLoopConfig {
  const topic = slugify(options.topic ?? "markup-work");
  const title = options.title ?? "Markup Work Smoke";
  const baseUrl = options.baseUrl ?? "http://localhost:3000";
  const playwrightConfig = options.playwrightConfig ?? "playwright.config.ts";
  const generatedTestFile = `tests/vlmkit/${topic}.spec.ts`;
  const testCommand = `pnpm exec playwright test --config ${playwrightConfig} ${generatedTestFile}`;

  return {
    title,
    baseUrl,
    scope: "smoke",
    provider: options.provider ?? "openrouter",
    maxAttempts: 3,
    runtimeGateRuns: 2,
    screenshots: true,
    requestFile: `${LOOP_DIR}/request.md`,
    observationsFile: `${LOOP_DIR}/observations.json`,
    rulesFile: `${LOOP_DIR}/_generation-rules.md`,
    planFile: `${LOOP_DIR}/plan.md`,
    structuredPlanFile: `${LOOP_DIR}/plan.json`,
    locatorInventoryFile: `${LOOP_DIR}/locators.json`,
    generatedTestFile,
    helperImport: "./support/goto-app",
    playwrightConfig,
    testCommand,
    updateSnapshotsCommand: `${testCommand} --update-snapshots`,
    guardrailContextFile: `${LOOP_DIR}/guardrail-context.md`,
  };
}

export async function initMarkupLoop(options: InitMarkupLoopOptions = {}): Promise<{ config: MarkupLoopConfig; created: string[] }> {
  const cwd = options.cwd ?? process.cwd();
  const configPath = options.configPath ?? DEFAULT_CONFIG_PATH;
  const config = createDefaultMarkupLoopConfig(options);
  const created: string[] = [];

  await writeStarterFile(cwd, configPath, `${JSON.stringify(config, null, 2)}\n`, options.force, created);
  await writeStarterFile(cwd, config.requestFile, renderRequestTemplate(config), options.force, created);
  await writeStarterFile(cwd, config.observationsFile, renderObservationsTemplate(config), options.force, created);
  await writeStarterFile(cwd, config.rulesFile, renderGenerationRules(), options.force, created);
  await writeStarterFile(cwd, `${LOOP_DIR}/AGENT.md`, renderAgentRunbook(config), options.force, created);
  await writeStarterFile(cwd, "tests/vlmkit/support/goto-app.ts", renderGotoAppHelper(config), options.force, created);

  return { config, created };
}

export async function loadMarkupLoopConfig(path = DEFAULT_CONFIG_PATH): Promise<MarkupLoopConfig> {
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw) as MarkupLoopConfig;
}

export function buildMarkupLoopCommands(config: MarkupLoopConfig): MarkupLoopCommands {
  const planArgs = [
    "--title", config.title,
    "--request-file", config.requestFile,
    "--observations", config.observationsFile,
    "--out", config.planFile,
    "--structured-out", config.structuredPlanFile,
    "--locator-inventory-out", config.locatorInventoryFile,
    "--scope", config.scope,
    "--max-attempts", String(config.maxAttempts),
  ];
  if (config.provider) planArgs.push("--provider", config.provider);
  if (config.model) planArgs.push("--model", config.model);

  const generateArgs = [
    "--plan", config.planFile,
    "--rules", config.rulesFile,
    "--locator-inventory", config.locatorInventoryFile,
    "--helper-import", config.helperImport,
    "--out", config.generatedTestFile,
    "--max-attempts", String(config.maxAttempts),
    "--overwrite",
    "--gate-command", config.updateSnapshotsCommand,
    "--runtime-gate",
    "--playwright-config", config.playwrightConfig,
    "--runtime-gate-runs", String(config.runtimeGateRuns),
  ];
  if (config.provider) generateArgs.push("--provider", config.provider);
  if (config.model) generateArgs.push("--model", config.model);
  if (!config.screenshots) generateArgs.push("--no-screenshots");

  return {
    plan: { display: formatCommand("vlmkit-plan", planArgs), argv: planArgs },
    generate: { display: formatCommand("vlmkit-generate", generateArgs), argv: generateArgs },
  };
}

export function checkMarkupLoopReadiness(config: MarkupLoopConfig, cwd = process.cwd()): MarkupLoopReadiness {
  const helperFile = resolveHelperFilePath(config);
  const requiredFiles = [
    config.requestFile,
    config.observationsFile,
    config.rulesFile,
    config.playwrightConfig,
    ...(helperFile ? [helperFile] : []),
  ];
  const missing = requiredFiles.filter((path) => !existsSync(resolve(cwd, path)));
  return {
    ok: missing.length === 0,
    missing,
    commands: buildMarkupLoopCommands(config),
  };
}

export async function runMarkupLoop(configPath = DEFAULT_CONFIG_PATH, options: { dryRun?: boolean } = {}): Promise<number> {
  const config = await loadMarkupLoopConfig(configPath);
  const readiness = checkMarkupLoopReadiness(config);
  const commands = readiness.commands;
  if (options.dryRun) {
    console.log(commands.plan.display);
    console.log(commands.generate.display);
    return 0;
  }
  if (!readiness.ok) {
    for (const path of readiness.missing) console.error(`Missing ${path}`);
    return 1;
  }

  const { runPlanCli } = await import("@mizchi/vlmkit-plan/cli");
  const { runGenerateCli } = await import("@mizchi/vlmkit-generate/cli");

  const planCode = await runPlanCli(commands.plan.argv);
  if (planCode !== 0) return planCode;
  return runGenerateCli(commands.generate.argv);
}

async function doctor(configPath = DEFAULT_CONFIG_PATH): Promise<number> {
  if (!existsSync(configPath)) {
    console.error(`Missing ${configPath}. Run: pnpm exec vlmkit markup-loop init`);
    return 1;
  }
  const config = await loadMarkupLoopConfig(configPath);
  const readiness = checkMarkupLoopReadiness(config);
  if (!readiness.ok) {
    for (const path of readiness.missing) console.error(`Missing ${path}`);
    return 1;
  }
  console.log("Markup loop is configured.");
  console.log(readiness.commands.plan.display);
  console.log(readiness.commands.generate.display);
  return 0;
}

async function writeStarterFile(
  cwd: string,
  path: string,
  content: string,
  force = false,
  created: string[],
): Promise<void> {
  const absolute = resolve(cwd, path);
  if (existsSync(absolute) && !force) return;
  await mkdir(dirname(absolute), { recursive: true });
  await writeFile(absolute, content, "utf8");
  created.push(path);
}

function renderRequestTemplate(config: MarkupLoopConfig): string {
  return `# ${config.title}

Describe the one markup workflow the agent should preserve.

Include:
- the user-facing goal
- the primary interaction
- stable text or test ids that must remain asserted
- whether visual screenshot baselines are expected to change
`;
}

function renderObservationsTemplate(config: MarkupLoopConfig): string {
  return `${JSON.stringify([{
    url: config.baseUrl,
    title: "Replace with the observed page title",
    roles: [
      "heading \"Replace with real heading\"",
      "button \"Replace with real button\"",
    ],
    labels: [],
    testIds: [],
    texts: [
      "Replace with exact visible text that should anchor the scenario",
    ],
  }], null, 2)}\n`;
}

function renderGenerationRules(): string {
  return `# Generation Rules

- Use gotoApp(page); never call page.goto(...) directly in generated tests.
- Use only locators from the observed locator inventory unless the UI intentionally changed.
- Prefer role, label, and test id locators.
- Assert semantic state before screenshot assertions.
- Keep a smoke scope to one primary scenario unless the request explicitly asks for more.
- Do not weaken the scenario to make a gate pass.
`;
}

function renderAgentRunbook(config: MarkupLoopConfig): string {
  return `# VLMKit Markup Loop

This directory is the handoff contract for markup agents.

## Loop

1. Start the app at ${config.baseUrl}.
2. Update ${config.requestFile} with the requested markup change or workflow.
3. Use Playwright Test Agents or manual Playwright inspection to refresh ${config.observationsFile}. Do not invent locators.
4. Run \`pnpm exec vlmkit markup-loop doctor\`.
5. Run \`pnpm exec vlmkit markup-loop run\`.
6. If generation or VRT fails, inspect ${config.planFile}, ${config.locatorInventoryFile}, and Playwright artifacts before editing app code.

## Guardrails

- Do not weaken the generated scenario just to pass a gate.
- Do not remove the primary interaction from the request.
- Do not use out-of-inventory locators without first updating observations.
- When visual change is intentional, update baselines through the generated gate command.

Useful dry run:

\`\`\`sh
pnpm exec vlmkit markup-loop run --dry-run
\`\`\`
`;
}

function renderGotoAppHelper(config: MarkupLoopConfig): string {
  return `import type { Page } from "@playwright/test";

export async function gotoApp(page: Page) {
  const baseUrl = process.env.VLMKIT_MARKUP_BASE_URL
    ?? process.env.PLAYWRIGHT_BASE_URL
    ?? ${JSON.stringify(config.baseUrl)};
  await page.goto(baseUrl);
}
`;
}

function formatCommand(command: string, args: string[]): string {
  return [command, ...args].map(shellQuote).join(" ");
}

function shellQuote(value: string): string {
  if (/^[A-Za-z0-9_./:=@-]+$/.test(value)) return value;
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

function slugify(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "markup-work";
}

function resolveHelperFilePath(config: MarkupLoopConfig): string | null {
  if (!config.helperImport.startsWith(".")) return null;
  const base = join(dirname(config.generatedTestFile), config.helperImport);
  return extname(base) ? base : `${base}.ts`;
}

function parseProvider(value: string): MarkupLoopProvider {
  if (value === "anthropic" || value === "gemini" || value === "openrouter") return value;
  throw new Error(`Invalid provider: ${value}`);
}

function usage(): string {
  return `vlmkit markup-loop <command>

Commands:
  init [--topic <slug>] [--title <title>] [--base-url <url>] [--provider <name>]
       Create .vlmkit/markup-loop files and a gotoApp helper
  doctor [--config <path>]
       Check that required loop files exist and print planned commands
  run [--config <path>] [--dry-run]
       Run planner + generator + runtime/VRT gates

The loop expects Playwright Test Agents or manual Playwright inspection to
refresh .vlmkit/markup-loop/observations.json before generation.`;
}

export async function runMarkupLoopCli(argv = process.argv.slice(2)): Promise<number> {
  const command = argv[0];
  if (!command || command === "help" || command === "--help" || command === "-h") {
    console.log(usage());
    return command ? 0 : 1;
  }
  const rest = argv.slice(1);
  if (command === "init") {
    const options = parseInitArgs(rest);
    const result = await initMarkupLoop(options);
    for (const path of result.created) console.log(`created ${path}`);
    if (result.created.length === 0) console.log("markup loop files already exist");
    return 0;
  }
  if (command === "doctor") {
    const { configPath } = parseCommonArgs(rest);
    return doctor(configPath);
  }
  if (command === "run") {
    const { configPath, dryRun } = parseRunArgs(rest);
    return runMarkupLoop(configPath, { dryRun });
  }
  console.error(`Unknown markup-loop command: ${command}`);
  console.error(usage());
  return 1;
}

function parseCommonArgs(argv: string[]): { configPath: string } {
  let configPath = DEFAULT_CONFIG_PATH;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--config") {
      configPath = requiredValue(argv, ++i, arg);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return { configPath };
}

function parseRunArgs(argv: string[]): { configPath: string; dryRun: boolean } {
  let configPath = DEFAULT_CONFIG_PATH;
  let dryRun = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--config") {
      configPath = requiredValue(argv, ++i, arg);
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return { configPath, dryRun };
}

function parseInitArgs(argv: string[]): InitMarkupLoopOptions {
  const options: InitMarkupLoopOptions = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--config") options.configPath = requiredValue(argv, ++i, arg);
    else if (arg === "--topic") options.topic = requiredValue(argv, ++i, arg);
    else if (arg === "--title") options.title = requiredValue(argv, ++i, arg);
    else if (arg === "--base-url") options.baseUrl = requiredValue(argv, ++i, arg);
    else if (arg === "--provider") options.provider = parseProvider(requiredValue(argv, ++i, arg));
    else if (arg === "--playwright-config") options.playwrightConfig = requiredValue(argv, ++i, arg);
    else if (arg === "--force") options.force = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function requiredValue(argv: string[], index: number, flag: string): string {
  const value = argv[index];
  if (!value) throw new Error(`Missing value for ${flag}`);
  return value;
}

const isCliEntry = process.env.__VRT_DISPATCHER_LEAF__ === "markup-loop"
  || (process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false);

if (isCliEntry) {
  runMarkupLoopCli()
    .then((code) => {
      process.exitCode = code;
    })
    .catch(handleCliError);
}
