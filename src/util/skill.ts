#!/usr/bin/env node
/**
 * Skill playbooks for the vlmkit toolkit.
 *
 * Adopts the per-domain skill pattern from browser-use/browser-harness:
 * accumulate repeated per-page or per-component configuration as
 * data files under `.vrt-skills/`, then run multiple checks against
 * a single target with one command.
 *
 * Skill format (JSON, .vrt-skills/<name>.json):
 *
 *   {
 *     "name": "pricing-card",
 *     "description": "Pricing card across all pages",
 *     "selector": ".pricing-card",
 *     "viewport": { "width": 1280, "height": 720 },
 *     "checks": [
 *       { "tool": "a11y-contrast" },
 *       { "tool": "a11y-touch", "level": "AA" },
 *       { "tool": "design-tokens", "strict": true },
 *       { "tool": "theme-parity" },
 *       { "tool": "media-variants", "variants": ["forced-colors", "rtl"] },
 *       { "tool": "component-consistency", "selector": ".pricing-card" }
 *     ]
 *   }
 *
 * Usage:
 *   vlmkit skill list                     List skills in .vrt-skills/
 *   vlmkit skill show <name>              Print the skill file
 *   vlmkit skill init <name>              Create a starter skill file
 *   vlmkit skill run <name> --against <html|url>
 *                                      Execute every check in the skill
 *                                      against the target.
 */
import { readFile, writeFile, readdir, mkdir, stat } from "node:fs/promises";
import { join, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { handleCliError } from "@mizchi/vlmkit-core/cli-error.ts";
import { DIM, RESET, GREEN, RED, YELLOW, BOLD, CYAN } from "@mizchi/vlmkit-core/terminal-colors.ts";

const SKILLS_DIR = ".vrt-skills";

export interface SkillCheck {
  /** Which vrt CLI to invoke. */
  tool: string;
  /** Pass-through options. Keys map to CLI flags (`level` → `--level`). */
  [key: string]: unknown;
}

export interface Skill {
  name: string;
  description?: string;
  /** Optional default selector — checks that take `--selector` use this. */
  selector?: string;
  /** Default viewport — passed via `--viewport` when supported. */
  viewport?: { width: number; height: number };
  checks: SkillCheck[];
}

export interface SkillRunResult {
  skill: string;
  target: string;
  outputDir: string;
  results: Array<{
    tool: string;
    args: string[];
    exitCode: number;
    durationMs: number;
    outputDir: string;
    /** Captured stdout (truncated). */
    stdoutTail: string;
  }>;
  reportPath: string;
}

const KNOWN_TOOLS = new Set([
  "a11y-contrast",
  "a11y-touch",
  "a11y-focus-order",
  "design-tokens",
  "theme-parity",
  "i18n-stress",
  "media-variants",
  "cross-browser",
  "component-consistency",
  "multi-page-consistency",
  "interact",
  "explore",
  "perf",
  "component-from-image",
]);

async function loadSkill(name: string, baseDir = process.cwd()): Promise<Skill> {
  const path = resolve(baseDir, SKILLS_DIR, `${name}.json`);
  const raw = await readFile(path, "utf-8");
  const skill = JSON.parse(raw) as Skill;
  if (!skill.name) skill.name = name;
  if (!Array.isArray(skill.checks)) {
    throw new Error(`skill ${name}: \`checks\` must be an array`);
  }
  return skill;
}

async function listSkills(baseDir = process.cwd()): Promise<string[]> {
  const dir = resolve(baseDir, SKILLS_DIR);
  try {
    const entries = await readdir(dir);
    return entries
      .filter((e) => e.endsWith(".json"))
      .map((e) => e.slice(0, -".json".length))
      .sort();
  } catch (e) {
    if ((e as { code?: string }).code === "ENOENT") return [];
    throw e;
  }
}

function checkToFlags(check: SkillCheck, defaults: { selector?: string }): string[] {
  const args: string[] = [];
  for (const [key, value] of Object.entries(check)) {
    if (key === "tool") continue;
    if (value === undefined || value === null) continue;
    if (key === "strict" && value === true) { args.push("--strict"); continue; }
    if (key === "allowSkipped" && value === true) { args.push("--allow-skipped"); continue; }
    // Camel-case → kebab-case for the flag name.
    const flag = "--" + key.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());
    if (Array.isArray(value)) {
      args.push(flag, value.join(","));
    } else if (typeof value === "boolean") {
      if (value) args.push(flag);
    } else {
      args.push(flag, String(value));
    }
  }
  // Inherit default selector when the tool needs one and the check
  // didn't override it.
  if (defaults.selector && !args.includes("--selector")
    && (check.tool === "component-consistency" || check.tool === "multi-page-consistency")) {
    args.push("--selector", defaults.selector);
  }
  return args;
}

async function runOneCheck(
  tool: string, target: string, args: string[], outputDir: string,
): Promise<{ exitCode: number; durationMs: number; stdoutTail: string }> {
  const start = Date.now();
  return await new Promise((res) => {
    // multi-page-consistency takes URLs/files via flags, not positional;
    // every other tool takes the target as the first positional arg.
    const positional = tool === "multi-page-consistency" ? [] : [target];
    const finalArgs = [
      "--experimental-strip-types",
      "src/vrt.ts", tool,
      ...positional, ...args,
      "--output-dir", outputDir,
    ];
    const proc = spawn(process.execPath, finalArgs, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    proc.stdout.on("data", (d) => { stdout += d.toString(); });
    proc.stderr.on("data", (d) => { stdout += d.toString(); });
    proc.on("close", (code) => {
      const tail = stdout.split("\n").slice(-8).join("\n");
      res({ exitCode: code ?? 0, durationMs: Date.now() - start, stdoutTail: tail });
    });
  });
}

export async function runSkill(
  name: string, target: string, outputBase: string,
): Promise<SkillRunResult> {
  const skill = await loadSkill(name);
  const outputDir = resolve(outputBase, `skill-${skill.name}`);
  await mkdir(outputDir, { recursive: true });

  console.log(`  ${BOLD}${CYAN}vlmkit skill run ${name}${RESET}`);
  console.log(`  ${DIM}target: ${target}${RESET}`);
  console.log(`  ${DIM}${skill.checks.length} check(s):${RESET}`);

  const results: SkillRunResult["results"] = [];
  for (const check of skill.checks) {
    if (!KNOWN_TOOLS.has(check.tool)) {
      console.log(`  ${YELLOW}!${RESET} unknown tool: ${check.tool} — skipping`);
      continue;
    }
    const args = checkToFlags(check, { selector: skill.selector });
    const subdir = join(outputDir, check.tool);
    const r = await runOneCheck(check.tool, target, args, subdir);
    results.push({ tool: check.tool, args, ...r, outputDir: subdir });
    const icon = r.exitCode === 0 ? `${GREEN}✓${RESET}`
      : r.exitCode === 2 ? `${YELLOW}!${RESET}`
      : `${RED}✗${RESET}`;
    console.log(`  ${icon} ${check.tool.padEnd(24)} ${DIM}exit ${r.exitCode}  ${(r.durationMs / 1000).toFixed(1)}s${RESET}`);
  }

  const reportPath = join(outputDir, "report.md");
  const md = renderSkillReport(skill, target, results);
  await writeFile(reportPath, md);
  console.log(`  ${DIM}report: ${reportPath}${RESET}`);

  return { skill: skill.name, target, outputDir, results, reportPath };
}

function renderSkillReport(skill: Skill, target: string, results: SkillRunResult["results"]): string {
  const lines: string[] = [];
  lines.push(`# Skill: ${skill.name}`);
  lines.push("");
  if (skill.description) lines.push(skill.description, "");
  lines.push(`Target: \`${target}\``);
  lines.push(`Checks: **${results.length}**`);
  lines.push("");
  lines.push("| Check | Exit | Duration | Report |");
  lines.push("|---|---|---|---|");
  for (const r of results) {
    const icon = r.exitCode === 0 ? "✓" : r.exitCode === 2 ? "⚠" : "✗";
    const dur = (r.durationMs / 1000).toFixed(1) + "s";
    lines.push(`| \`${r.tool}\` | ${icon} ${r.exitCode} | ${dur} | \`${join(r.outputDir, "report.md")}\` |`);
  }
  lines.push("");
  lines.push("## Per-check tail (last 8 lines of stdout)");
  lines.push("");
  for (const r of results) {
    lines.push(`### ${r.tool}`);
    lines.push("");
    lines.push("```");
    lines.push(r.stdoutTail);
    lines.push("```");
    lines.push("");
  }
  return lines.join("\n");
}

async function commandList() {
  const skills = await listSkills();
  if (skills.length === 0) {
    console.log(`${DIM}No skills found in ./${SKILLS_DIR}/.${RESET}`);
    console.log(`Create one with: vlmkit skill init <name>`);
    return;
  }
  console.log(`Skills in ${SKILLS_DIR}/:`);
  for (const name of skills) {
    const skill = await loadSkill(name).catch(() => null);
    const desc = skill?.description ? ` — ${skill.description}` : "";
    const n = skill?.checks.length ?? "?";
    console.log(`  ${name}  ${DIM}(${n} check(s))${desc}${RESET}`);
  }
}

async function commandShow(name: string) {
  const path = resolve(process.cwd(), SKILLS_DIR, `${name}.json`);
  console.log(await readFile(path, "utf-8"));
}

async function commandInit(name: string) {
  const dir = resolve(process.cwd(), SKILLS_DIR);
  await mkdir(dir, { recursive: true });
  const path = resolve(dir, `${name}.json`);
  try {
    await stat(path);
    console.error(`error: ${path} already exists`);
    process.exit(1);
  } catch { /* not exists; proceed */ }
  const template: Skill = {
    name,
    description: `Checks for ${name}`,
    selector: `.${name}`,
    viewport: { width: 1280, height: 720 },
    checks: [
      { tool: "a11y-contrast" },
      { tool: "a11y-touch", level: "AAA" },
      { tool: "theme-parity" },
    ],
  };
  await writeFile(path, JSON.stringify(template, null, 2) + "\n");
  console.log(`${GREEN}✓${RESET} created ${path}`);
}

async function main(argv = process.argv.slice(2)) {
  if (argv[0] === "--help" || argv[0] === "-h") argv = [];
  const sub = argv[0];
  const rest = argv.slice(1);
  if (!sub || sub === "--help" || sub === "-h") {
    console.log("Usage: vlmkit skill <command>");
    console.log("");
    console.log("Commands:");
    console.log("  list                            List skills in .vrt-skills/");
    console.log("  show <name>                     Print the skill file");
    console.log("  init <name>                     Create a starter skill file");
    console.log("  run <name> --against <target>   Execute every check in the skill");
    console.log("");
    console.log("Skill files live at .vrt-skills/<name>.json and declare a list of");
    console.log("checks (vlmkit commands + their flags) to run against a target.");
    process.exit(sub ? 0 : 1);
  }
  if (sub === "list") { await commandList(); return; }
  if (sub === "show") {
    if (!rest[0]) { console.error("error: skill name required"); process.exit(1); }
    await commandShow(rest[0]); return;
  }
  if (sub === "init") {
    if (!rest[0]) { console.error("error: skill name required"); process.exit(1); }
    await commandInit(rest[0]); return;
  }
  if (sub === "run") {
    const name = rest[0];
    if (!name) { console.error("error: skill name required"); process.exit(1); }
    let target = "";
    let outputBase = join(process.cwd(), "test-results");
    for (let i = 1; i < rest.length; i++) {
      const a = rest[i];
      if (a === "--against") target = rest[++i] ?? "";
      else if (a === "--output-dir") outputBase = rest[++i] ?? outputBase;
    }
    if (!target) { console.error("error: --against <target> required"); process.exit(1); }
    const result = await runSkill(name, target, outputBase);
    // Aggregate exit code: 1 if any check failed, 2 if any warned.
    const hadFail = result.results.some((r) => r.exitCode === 1);
    const hadWarn = result.results.some((r) => r.exitCode === 2);
    if (hadFail) process.exitCode = 1;
    else if (hadWarn) process.exitCode = 2;
    return;
  }
  console.error(`error: unknown subcommand: ${sub}`);
  process.exit(1);
}

const isCliEntry = process.env.__VRT_DISPATCHER_LEAF__ === "skill" || (process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false);
if (isCliEntry) {
  main().catch(handleCliError);
}
