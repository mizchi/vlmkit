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
import { spawn } from "node:child_process";
import { handleCliError } from "@mizchi/vlmkit-core/cli-error.ts";
import { isCliEntry } from "@mizchi/vlmkit-core/plugin/cli-entry.ts";
import { DIM, RESET, GREEN, RED, YELLOW, BOLD, CYAN } from "@mizchi/vlmkit-core/terminal-colors.ts";

const SKILLS_DIR = ".vrt-skills";

export interface SkillCheck {
  /** Which vlmkit CLI to invoke. */
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
    /** The `tool` field as written in the skill file, legacy alias included. */
    tool: string;
    /** The command tokens actually spawned — `["check","a11y","contrast"]`. */
    command: string[];
    args: string[];
    exitCode: number;
    durationMs: number;
    outputDir: string;
    /** Captured stdout (truncated). */
    stdoutTail: string;
    /**
     * Set when the check never ran. An exit code means nothing until you know the
     * process got as far as measuring something, and both cases exit 1.
     */
    launchFailure?: string;
  }>;
  reportPath: string;
}

/**
 * Pre-0.9 single-token tool names, mapped to the commands that replaced them.
 *
 * This map exists only for skill files written before the rename; it is not a list
 * of what is runnable. There used to be a `KNOWN_TOOLS` set here that was exactly
 * that — a hand-maintained copy of the command table — and it rotted the moment
 * 0.9.0 replaced `a11y-contrast` with `check a11y contrast`. Nothing validated it,
 * so a skill naming a command that no longer existed passed the check and then
 * failed at spawn.
 *
 * Validation is the CLI's job now: an unknown `tool` reaches `vlmkit` and comes
 * back as its own "Unknown command", which cannot disagree with what is actually
 * installed. That is the only table that is always right.
 */
const LEGACY_TOOL_NAMES: Record<string, string> = {
  "a11y-contrast": "check a11y contrast",
  "a11y-touch": "check a11y touch",
  "a11y-focus-order": "check a11y focus",
  "design-tokens": "check tokens",
  "theme-parity": "check theme",
  "i18n-stress": "stress i18n",
  "media-variants": "stress media",
  // `diff browsers`, not `stress cross-browser`: the module lives under
  // `stress/cross-browser.ts` but the command that reaches it is registered in the
  // `diff` group. Guessing from the file path gets this one wrong.
  "cross-browser": "diff browsers",
  "component-consistency": "check drift component",
  "multi-page-consistency": "check drift pages",
  interact: "inspect interact",
  explore: "inspect explore",
  perf: "check perf",
  "component-from-image": "build component",
};

/** The command tokens a `tool` field means. Multi-token gate commands pass through. */
export function toolCommand(tool: string): string[] {
  return (LEGACY_TOOL_NAMES[tool] ?? tool).split(/\s+/).filter(Boolean);
}

/**
 * The `vlmkit` entry to spawn checks through.
 *
 * This used to be the string `"src/vrt.ts"`, resolved against the spawned
 * process's cwd. Two things wrong with it: the file was renamed to
 * `src/cli/vlmkit.ts` in 0.9.0, so every check died with `MODULE_NOT_FOUND` — and
 * even before that it could only work when the cwd happened to be a checkout of
 * this repository, never from an installed package.
 *
 * `delegate` in `cli.ts` records the real entry in `__VLMKIT_CLI_ENTRY__` before
 * importing a leaf, which is exactly this question already answered. `argv[1]` is
 * the fallback for a direct `node src/util/skill.ts` invocation.
 */
function resolveCliEntry(): string {
  const recorded = process.env.__VLMKIT_CLI_ENTRY__;
  if (recorded) return resolve(recorded);
  const invoked = process.argv[1];
  if (invoked) return resolve(invoked);
  throw new Error("cannot locate the vlmkit CLI entry to run checks through");
}

export async function loadSkill(name: string, baseDir = process.cwd()): Promise<Skill> {
  const path = resolve(baseDir, SKILLS_DIR, `${name}.json`);
  const raw = await readFile(path, "utf-8");
  const skill = JSON.parse(raw) as Skill;
  if (!skill.name) skill.name = name;
  if (!Array.isArray(skill.checks)) {
    throw new Error(`skill ${name}: \`checks\` must be an array`);
  }
  return skill;
}

export async function listSkills(baseDir = process.cwd()): Promise<string[]> {
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

/**
 * A check's non-`tool` keys become CLI flags: camelCase → kebab-case, arrays joined
 * with commas, `true` becoming a bare flag. Exported because the mapping is the
 * whole contract of a skill file and is otherwise only observable by spawning.
 */
export function checkToFlags(check: SkillCheck, defaults: { selector?: string }): string[] {
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

/** The argv `vlmkit` would be invoked with for one check. Pure, so it is assertable. */
export function checkArgv(
  tool: string, target: string, args: string[], outputDir: string,
): string[] {
  const command = toolCommand(tool);
  // `check drift pages` takes its pages through repeatable --urls / --files, not a
  // positional, so handing it the target as one would look like a stray argument.
  const positional = command.join(" ") === "check drift pages" ? [] : [target];
  return [...command, ...positional, ...args, "--output-dir", outputDir];
}

/**
 * One check's status, for the terminal, the markdown table, and the run's exit code alike.
 *
 * Three call sites read `exitCode` directly and two of them special-cased `=== 2` as
 * "warned". That stopped being true when `gate-exit.ts` unified the contract to two
 * outcomes — `docs/design/gate-plugin-architecture.md`: "The shared contract has two
 * outcomes … a script branching on exit code 2 must read `counts.warn` from `--json`
 * instead" — and `check perf` was migrated off it. What still emitted 2 afterwards were a
 * `png-diff` usage error and `diff browsers` on a narrowed engine list, so the warn branch
 * only ever fired for things that were not warnings.
 *
 * Measured, before the fix, on a skill declaring `{"tool": "diff png",
 * "ignore-region": "0,300,640"}` — a malformed value: the terminal printed
 * `! diff png exit 2`, the report row read `⚠ 2`, and `skill run` itself exited 2. A bad
 * value in the skill file, reported as a warning.
 *
 * Warns reach a caller through `--json` `counts.warn`, not through the exit code. So here:
 * anything non-zero from a check that ran is a failure, and "did not run" stays its own
 * third state — that distinction is real and was added deliberately.
 */
export function checkStatus(r: { exitCode: number; launchFailure?: string }): "did-not-run" | "pass" | "fail" {
  if (r.launchFailure) return "did-not-run";
  return r.exitCode === 0 ? "pass" : "fail";
}

interface CheckOutcome {
  exitCode: number;
  durationMs: number;
  stdoutTail: string;
  /** Set when the check never ran, as opposed to running and reporting a problem. */
  launchFailure?: string;
}

/**
 * A check's exit code means nothing until you know the check ran.
 *
 * The old version reported `exit 1` for a spawn that died in Node's module
 * resolution, and put the tail of the stack trace in the report's "last 8 lines of
 * stdout" column — so a runner that could not start anything rendered as two
 * failing checks. That is a report lying about what it measured, which is worse
 * than no report.
 */
async function runOneCheck(
  tool: string, target: string, args: string[], outputDir: string,
): Promise<CheckOutcome> {
  const start = Date.now();
  const entry = resolveCliEntry();
  const finalArgs = [
    // TypeScript sources need the loader flag; a built `.mjs` must not get it.
    ...(entry.endsWith(".ts") ? ["--experimental-strip-types"] : []),
    entry,
    ...checkArgv(tool, target, args, outputDir),
  ];
  return await new Promise((res) => {
    const proc = spawn(process.execPath, finalArgs, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    proc.stdout.on("data", (d) => { stdout += d.toString(); });
    proc.stderr.on("data", (d) => { stdout += d.toString(); });
    proc.on("error", (e) => {
      res({
        exitCode: 1, durationMs: Date.now() - start, stdoutTail: String(e.message),
        launchFailure: `could not spawn ${process.execPath}: ${e.message}`,
      });
    });
    proc.on("close", (code) => {
      const tail = stdout.split("\n").slice(-8).join("\n");
      const outcome: CheckOutcome = {
        exitCode: code ?? 0, durationMs: Date.now() - start, stdoutTail: tail,
      };
      const launchFailure = diagnoseLaunchFailure(tool, stdout);
      if (launchFailure) outcome.launchFailure = launchFailure;
      res(outcome);
    });
  });
}

/**
 * Did the check fail, or did it never start? Read off the CLI's own output, since
 * both cases exit 1.
 */
export function diagnoseLaunchFailure(tool: string, stdout: string): string | undefined {
  if (/Unknown command:/.test(stdout)) {
    const canonical = LEGACY_TOOL_NAMES[tool];
    return `\`${tool}\` is not a vlmkit command`
      + (canonical ? ` (did you mean \`${canonical}\`?)` : "")
      + " — run `vlmkit --help` for the command list";
  }
  if (/MODULE_NOT_FOUND|Cannot find module/.test(stdout)) {
    return "the vlmkit CLI entry could not be loaded — this is a vlmkit bug, not a finding about the target";
  }
  return undefined;
}

/** @param cwd where `.vrt-skills/` is looked for. An argument, not a `process.chdir`. */
export async function runSkill(
  name: string, target: string, outputBase: string, options: { cwd?: string } = {},
): Promise<SkillRunResult> {
  const skill = await loadSkill(name, options.cwd);
  const outputDir = resolve(outputBase, `skill-${skill.name}`);
  await mkdir(outputDir, { recursive: true });

  console.log(`  ${BOLD}${CYAN}vlmkit skill run ${name}${RESET}`);
  console.log(`  ${DIM}target: ${target}${RESET}`);
  console.log(`  ${DIM}${skill.checks.length} check(s):${RESET}`);

  const results: SkillRunResult["results"] = [];
  for (const check of skill.checks) {
    const args = checkToFlags(check, { selector: skill.selector });
    // Keyed on the tool as written, so `check a11y contrast` and its legacy alias
    // do not collide in one directory when a file uses both.
    const subdir = join(outputDir, check.tool.replace(/[^a-z0-9._-]+/gi, "-"));
    const r = await runOneCheck(check.tool, target, args, subdir);
    results.push({ tool: check.tool, command: toolCommand(check.tool), args, ...r, outputDir: subdir });
    const status = checkStatus(r);
    const icon = status === "did-not-run" ? `${YELLOW}?${RESET}`
      : status === "pass" ? `${GREEN}✓${RESET}`
      : `${RED}✗${RESET}`;
    const detail = r.launchFailure
      ? `did not run — ${r.launchFailure}`
      : `exit ${r.exitCode}  ${(r.durationMs / 1000).toFixed(1)}s`;
    console.log(`  ${icon} ${check.tool.padEnd(24)} ${DIM}${detail}${RESET}`);
  }

  const reportPath = join(outputDir, "report.md");
  const md = renderSkillReport(skill, target, results);
  await writeFile(reportPath, md);
  console.log(`  ${DIM}report: ${reportPath}${RESET}`);

  return { skill: skill.name, target, outputDir, results, reportPath };
}

export function renderSkillReport(skill: Skill, target: string, results: SkillRunResult["results"]): string {
  const lines: string[] = [];
  lines.push(`# Skill: ${skill.name}`);
  lines.push("");
  if (skill.description) lines.push(skill.description, "");
  lines.push(`Target: \`${target}\``);
  const ranCount = results.filter((r) => !r.launchFailure).length;
  lines.push(ranCount === results.length
    ? `Checks: **${results.length}**`
    : `Checks: **${ranCount}** of ${results.length} ran`);
  lines.push("");
  // Checks that never started come first and are never given an exit code, because
  // an exit code here reads as a verdict about the target. The old table rendered a
  // runner that could not launch anything as two failing checks, with a Node
  // module-resolution stack trace in the stdout column.
  const didNotRun = results.filter((r) => r.launchFailure);
  const ran = results.filter((r) => !r.launchFailure);
  if (didNotRun.length > 0) {
    lines.push(`## ${didNotRun.length} check(s) did not run`);
    lines.push("");
    lines.push("Nothing below was measured, so it is not a finding about the target.");
    lines.push("");
    for (const r of didNotRun) {
      lines.push(`- \`${r.tool}\` — ${r.launchFailure}`);
    }
    lines.push("");
  }
  lines.push("| Check | Command | Exit | Duration | Report |");
  lines.push("|---|---|---|---|---|");
  for (const r of ran) {
    const icon = checkStatus(r) === "pass" ? "✓" : "✗";
    const dur = (r.durationMs / 1000).toFixed(1) + "s";
    // The check's own args, not just its verb. The column read `vlmkit diff browsers` for a
    // check declared as `diff browsers --engines chromium`, so the one line a reader would
    // copy to reproduce the run was not the run.
    const invocation = ["vlmkit", ...r.command, ...r.args].join(" ");
    lines.push(`| \`${r.tool}\` | \`${invocation}\` | ${icon} ${r.exitCode} | ${dur} | \`${join(r.outputDir, "report.md")}\` |`);
  }
  if (ran.length === 0) {
    lines.push("| _(none ran)_ | | | | |");
  }
  lines.push("");
  lines.push("## Per-check tail (last 8 lines of stdout)");
  lines.push("");
  for (const r of ran) {
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
  // Remembered BEFORE the erase. Blanking argv is what routes `--help` to the usage
  // branch, and it is also what made `--help` indistinguishable from "you forgot the
  // arguments" — so the usage branch exited 1 either way. Asking for help is a request
  // that succeeded.
  const askedForHelp = argv[0] === "--help" || argv[0] === "-h";
  if (askedForHelp) argv = [];
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
    // `sub ? 0 : 1` was the intent and it could never fire: the erase above cleared argv,
    // so `sub` was always undefined when help had been asked for. `askedForHelp` is the
    // value that line wanted.
    process.exit(askedForHelp || sub ? 0 : 1);
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
    // A check that never ran is a failure of the run, not a pass. Reporting 0 here
    // would make a skill whose every tool name is stale look green.
    const couldNotRun = result.results.some((r) => checkStatus(r) === "did-not-run");
    const hadFail = result.results.some((r) => checkStatus(r) === "fail");
    if (couldNotRun || hadFail) process.exitCode = 1;
    return;
  }
  console.error(`error: unknown subcommand: ${sub}`);
  process.exit(1);
}

if (isCliEntry(import.meta.url, "skill")) {
  main().catch(handleCliError);
}
