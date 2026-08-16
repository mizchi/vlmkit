#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, dirname, extname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { handleCliError } from "@mizchi/vlmkit-core/cli-error.ts";
import { withBrowser } from "@mizchi/vlmkit-core/browser-launch.ts";

export type MarkupLoopProvider = "anthropic" | "gemini" | "openrouter";
export type MarkupLoopScope = "smoke" | "focused" | "full";

export interface MarkupLoopConfig {
  title: string;
  baseUrl: string;
  scope: MarkupLoopScope;
  provider?: MarkupLoopProvider;
  model?: string;
  maxTokens?: number;
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
  maxTokens?: number;
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

export interface MarkupLoopObservation {
  url?: string;
  title?: string;
  roles?: string[];
  labels?: string[];
  testIds?: string[];
  texts?: string[];
  notes?: string[];
}

export interface ObserveMarkupLoopOptions {
  url?: string;
  outputPath?: string;
  waitFor?: string;
  timeoutMs?: number;
  headless?: boolean;
}

export interface ObserveMarkupLoopResult {
  observations: MarkupLoopObservation[];
  outputPath: string;
}

const DEFAULT_CONFIG_PATH = ".vlmkit/markup-loop.json";
const LOOP_DIR = ".vlmkit/markup-loop";
const OBSERVE_SCRIPT = String.raw`(() => {
  const MAX_ITEMS = 40;
  const ROLE_SELECTORS = [
    "[role]",
    "h1,h2,h3,h4,h5,h6",
    "button",
    "a[href]",
    "input",
    "textarea",
    "select",
    "summary",
    "img[alt]",
    "table",
  ].join(",");

  const visible = (element) => {
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.visibility !== "hidden"
      && style.display !== "none"
      && rect.width > 0
      && rect.height > 0;
  };
  const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
  const uniq = (values) => {
    const seen = new Set();
    const out = [];
    for (const value of values.map(clean).filter(Boolean)) {
      if (seen.has(value)) continue;
      seen.add(value);
      out.push(value);
      if (out.length >= MAX_ITEMS) break;
    }
    return out;
  };
  const quoted = (value) => value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const labelledBy = (element) => {
    const ids = clean(element.getAttribute("aria-labelledby")).split(/\s+/).filter(Boolean);
    return clean(ids.map((id) => document.getElementById(id)?.textContent ?? "").join(" "));
  };
  const controlLabel = (element) => {
    if (element.id) {
      const label = document.querySelector("label[for=\"" + CSS.escape(element.id) + "\"]");
      if (label) return clean(label.textContent);
    }
    const wrappingLabel = element.closest("label");
    return clean(wrappingLabel?.textContent ?? "");
  };
  const accessibleName = (element) => clean(element.getAttribute("aria-label"))
    || labelledBy(element)
    || clean(element.getAttribute("alt"))
    || controlLabel(element)
    || clean(element.getAttribute("placeholder"))
    || clean(element.tagName === "INPUT" ? element.getAttribute("value") : "")
    || clean(element.textContent);
  const implicitRole = (element) => {
    const tag = element.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tag)) return "heading";
    if (tag === "button") return "button";
    if (tag === "a" && element.hasAttribute("href")) return "link";
    if (tag === "textarea") return "textbox";
    if (tag === "select") return "combobox";
    if (tag === "summary") return "button";
    if (tag === "table") return "table";
    if (tag === "img") return "img";
    if (tag === "input") {
      const type = clean(element.getAttribute("type") || "text").toLowerCase();
      if (type === "search") return "searchbox";
      if (["button", "submit", "reset"].includes(type)) return "button";
      if (type === "checkbox") return "checkbox";
      if (type === "radio") return "radio";
      if (!["hidden", "file", "image", "range", "color"].includes(type)) return "textbox";
    }
    return "";
  };

  const roleEntries = Array.from(document.querySelectorAll(ROLE_SELECTORS))
    .filter(visible)
    .map((element) => {
      const role = clean(element.getAttribute("role")) || implicitRole(element);
      const name = accessibleName(element);
      return role && name ? role + " \"" + quoted(name) + "\"" : "";
    });
  const labels = [
    ...Array.from(document.querySelectorAll("label")).map((element) => element.textContent),
    ...Array.from(document.querySelectorAll("[aria-label]")).map((element) => element.getAttribute("aria-label")),
    ...Array.from(document.querySelectorAll("input[placeholder],textarea[placeholder]")).map((element) => element.getAttribute("placeholder")),
  ];
  const testIds = Array.from(document.querySelectorAll("[data-testid]"))
    .filter(visible)
    .map((element) => element.getAttribute("data-testid"));
  const texts = [
    ...Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6,p,li,td,th,button,a,[data-testid]"))
      .filter(visible)
      .map((element) => clean(element.textContent))
      .filter((value) => value.length >= 2 && value.length <= 160),
  ];

  return {
    url: window.location.href,
    title: document.title || clean(document.querySelector("h1")?.textContent),
    roles: uniq(roleEntries),
    labels: uniq(labels),
    testIds: uniq(testIds),
    texts: uniq(texts),
  };
})()`;

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
    maxTokens: options.maxTokens ?? 4096,
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
  const configPath = options.configPath ?? DEFAULT_CONFIG_PATH;
  /**
   * An ABSOLUTE `--config` names the project to scaffold, so the harness lands beside it.
   *
   * `init --config /elsewhere/markup-loop.json` used to write the config there and every other
   * file — `request.md`, `observations.json`, the generation rules, `AGENT.md`, the goto-app
   * helper — relative to `process.cwd()`: two halves pointing at different projects, and
   * `doctor` calling the harness incomplete in both. Found by a test that passed a temp-directory
   * config and scattered six files into this repo.
   *
   * Deliberately narrow. A RELATIVE path stays relative to the cwd, because that is what
   * `.vlmkit/markup-loop.json` (the default, and a path with a directory in it) means: the
   * harness belongs at the project root, not inside `.vlmkit/`. A relative path that escapes the
   * cwd (`../other/markup-loop.json`) therefore still scatters — the same gap, one level
   * narrower, and it wants a defined notion of "project root" rather than another special case.
   */
  const cwd = markupLoopRoot(configPath, options.cwd);
  const config = createDefaultMarkupLoopConfig(options);
  const created: string[] = [];

  // The absolute case already made `cwd` the config's directory, so re-joining the full path
  // would nest it (`/tmp/x/tmp/x/markup-loop.json`).
  const configTarget = isAbsolute(configPath) ? basename(configPath) : configPath;
  await writeStarterFile(cwd, configTarget, `${JSON.stringify(config, null, 2)}\n`, options.force, created);
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

/**
 * The loop's project root — the directory every path in the config resolves against.
 *
 * ONE definition, because four call sites derived it separately and three got it wrong.
 * `init` was fixed to write the harness beside an absolute `--config`; `doctor`, `run` and
 * `observe` kept resolving against `process.cwd()`, so pointing any of them at a config
 * elsewhere reported *this* directory's missing files, and `observe` wrote its observations
 * into the wrong project. `markup-loop.test.ts` pinned that as a known limitation and named
 * what the fix needed: "room to verify what a project root means for a config given by path".
 *
 * The rule, and why it is not simply `dirname(configPath)`:
 *
 *   absolute `--config /elsewhere/markup-loop.json`  -> `/elsewhere`
 *   relative (including the `.vlmkit/markup-loop.json` default) -> `process.cwd()`
 *
 * A relative path stays relative to the cwd because the default has a directory in it and
 * the harness belongs at the project root, not inside `.vlmkit/`. The remaining gap is a
 * relative path that escapes the cwd (`../other/markup-loop.json`), which still resolves to
 * the cwd — one level narrower than before, and it would need the project root to be
 * discovered (walk up to a marker) rather than derived, which is a different change.
 */
export function markupLoopRoot(configPath: string, explicitCwd?: string): string {
  if (explicitCwd !== undefined) return explicitCwd;
  return isAbsolute(configPath) ? dirname(configPath) : process.cwd();
}

export function buildMarkupLoopCommands(config: MarkupLoopConfig, root = process.cwd()): MarkupLoopCommands {
  /**
   * Config paths, resolved against the loop's root.
   *
   * Left exactly as written when the root IS the process cwd — the default case — so the
   * displayed command stays short and copy-pasteable and every existing expectation of it
   * holds. Absolutized only when the config came from elsewhere, and that is not cosmetic:
   * `runMarkupLoop` hands these argv arrays to `runPlanCli` / `runGenerateCli`
   * **in-process**, where a relative path resolves against the process cwd and would read
   * the wrong request file and write the plan into the wrong project.
   */
  const p = (value: string): string => (root === process.cwd() ? value : resolve(root, value));
  const planArgs = [
    "--title", config.title,
    "--request-file", p(config.requestFile),
    "--observations", p(config.observationsFile),
    "--out", p(config.planFile),
    "--structured-out", p(config.structuredPlanFile),
    "--locator-inventory-out", p(config.locatorInventoryFile),
    "--scope", config.scope,
    "--max-attempts", String(config.maxAttempts),
  ];
  if (config.provider) planArgs.push("--provider", config.provider);
  if (config.model) planArgs.push("--model", config.model);
  if (config.maxTokens) planArgs.push("--max-tokens", String(config.maxTokens));

  const generateArgs = [
    "--plan", p(config.planFile),
    "--rules", p(config.rulesFile),
    "--locator-inventory", p(config.locatorInventoryFile),
    "--helper-import", config.helperImport,
    "--out", p(config.generatedTestFile),
    "--max-attempts", String(config.maxAttempts),
    "--overwrite",
    "--gate-command", config.updateSnapshotsCommand,
    "--runtime-gate",
    "--playwright-config", p(config.playwrightConfig),
    "--runtime-gate-runs", String(config.runtimeGateRuns),
  ];
  if (config.provider) generateArgs.push("--provider", config.provider);
  if (config.model) generateArgs.push("--model", config.model);
  if (config.maxTokens) generateArgs.push("--max-tokens", String(config.maxTokens));
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
    commands: buildMarkupLoopCommands(config, cwd),
  };
}

export async function runMarkupLoop(configPath = DEFAULT_CONFIG_PATH, options: { dryRun?: boolean } = {}): Promise<number> {
  const config = await loadMarkupLoopConfig(configPath);
  const readiness = checkMarkupLoopReadiness(config, markupLoopRoot(configPath));
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

export async function observeMarkupLoop(
  configPath = DEFAULT_CONFIG_PATH,
  options: ObserveMarkupLoopOptions = {},
): Promise<ObserveMarkupLoopResult> {
  const config = await loadMarkupLoopConfig(configPath);
  const observation = await captureMarkupObservation(options.url ?? config.baseUrl, options);
  // Against the loop's root, not the process cwd: `observe --config /elsewhere/x.json` used to
  // write its observations HERE, leaving the config's own harness untouched. An explicit
  // `--output` stays the caller's word and is honoured as given.
  //
  // Left as written when the root IS the cwd, same rule as the command paths: the returned
  // `outputPath` is printed and asserted on, and absolutizing the default case would turn
  // `.vlmkit/markup-loop/observations.json` into a machine-specific line for no gain.
  const root = markupLoopRoot(configPath);
  const outputPath = options.outputPath
    ?? (root === process.cwd() ? config.observationsFile : resolve(root, config.observationsFile));
  const observations = [observation];
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(observations, null, 2)}\n`, "utf8");
  return { observations, outputPath };
}

export async function captureMarkupObservation(url: string, options: ObserveMarkupLoopOptions = {}): Promise<MarkupLoopObservation> {
  const timeout = options.timeoutMs ?? 15_000;
  return await withBrowser(async (browser) => {
    const page = await browser.newPage();
    page.setDefaultTimeout(timeout);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout });
    if (options.waitFor) await page.waitForSelector(options.waitFor, { timeout });
    try {
      await page.waitForLoadState("networkidle", { timeout: Math.min(timeout, 3_000) });
    } catch {
      // SPAs often keep connections open; DOM observations are still useful after domcontentloaded.
    }
    return await page.evaluate(OBSERVE_SCRIPT) as MarkupLoopObservation;
  }, { launch: { headless: options.headless ?? true } });
}

async function doctor(configPath = DEFAULT_CONFIG_PATH): Promise<number> {
  if (!existsSync(configPath)) {
    console.error(`Missing ${configPath}. Run: pnpm exec vlmkit markup-loop init`);
    return 1;
  }
  const config = await loadMarkupLoopConfig(configPath);
  const readiness = checkMarkupLoopReadiness(config, markupLoopRoot(configPath));
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
3. Run \`pnpm exec vlmkit markup-loop observe\` to refresh ${config.observationsFile}; use Playwright Test Agents first for multi-step flows. Do not invent locators.
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
  observe [--config <path>] [--url <url>] [--out <path>] [--wait-for <selector>]
       Capture real UI roles, labels, test ids, and text into observations.json
  doctor [--config <path>]
       Check that required loop files exist and print planned commands
  run [--config <path>] [--dry-run]
       Run planner + generator + runtime/VRT gates

The loop expects observations.json to be refreshed before generation.`;
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
  if (command === "observe") {
    const { configPath, options } = parseObserveArgs(rest);
    const result = await observeMarkupLoop(configPath, options);
    console.log(`observed ${result.observations[0]?.url ?? options.url ?? "page"}`);
    console.log(`wrote ${result.outputPath}`);
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

function parseObserveArgs(argv: string[]): { configPath: string; options: ObserveMarkupLoopOptions } {
  let configPath = DEFAULT_CONFIG_PATH;
  const options: ObserveMarkupLoopOptions = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--config") configPath = requiredValue(argv, ++i, arg);
    else if (arg === "--url") options.url = requiredValue(argv, ++i, arg);
    else if (arg === "--out") options.outputPath = requiredValue(argv, ++i, arg);
    else if (arg === "--wait-for") options.waitFor = requiredValue(argv, ++i, arg);
    else if (arg === "--timeout") options.timeoutMs = parsePositiveInt(requiredValue(argv, ++i, arg), arg);
    else if (arg === "--headed") options.headless = false;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return { configPath, options };
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
    else if (arg === "--max-tokens") options.maxTokens = parsePositiveInt(requiredValue(argv, ++i, arg), arg);
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

function parsePositiveInt(value: string, flag: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${flag} must be a positive integer`);
  return parsed;
}

const isCliEntry = process.env.__VLMKIT_DISPATCHER_LEAF__ === "markup-loop"
  || (process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false);

if (isCliEntry) {
  runMarkupLoopCli()
    .then((code) => {
      process.exitCode = code;
    })
    .catch(handleCliError);
}
