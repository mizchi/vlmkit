#!/usr/bin/env node
/**
 * `vrt baseline` — unified baseline surface that dispatches to the
 * appropriate underlying flow.
 *
 * Two flows coexist intentionally:
 *
 *   - `vrt diff-pr` is the CI gate for an external project. Uses
 *     direct Playwright per route + per-route thresholds + manifest
 *     suppression. Baselines live at
 *     `<baselineDir>/<route>/<viewport>.png`.
 *
 *   - `vrt workflow` is vrt's own e2e dogfood harness. Uses a
 *     Playwright spec (`e2e/vlmkit-capture.spec.ts`) + bulk approval.
 *     Baselines live at `<VRT_ROOT>/baselines/*.png`.
 *
 * `vrt baseline` is the canonical name for the diff-pr flow —
 * the one external projects should pick first. The legacy
 * `vrt workflow {init,capture,verify,approve}` and `vrt diff-pr
 * {pin,run,post}` surfaces continue to work; this command is a
 * mnemonic alias.
 *
 * Subcommands:
 *   vrt baseline pin [route...] [--config vrt.config.json]
 *     Capture / refresh baseline PNGs for declared routes. Equivalent
 *     to `vrt diff-pr pin`.
 *
 *   vrt baseline verify [--config vrt.config.json] [--output <dir>]
 *                       [--against-previous <dir>]
 *     Diff current rendering against pinned baselines + a11y +
 *     media-variants gates. Equivalent to `vrt diff-pr`.
 *
 *   vrt baseline post --pr <ref> [--summary <path>] [--marker <id>]
 *     Post a previously-generated summary.md as a PR comment.
 *     Equivalent to `vrt diff-pr post`.
 *
 *   vrt baseline list [--config vrt.config.json]
 *     Show all pinned baselines, last-modified timestamp, and which
 *     route they correspond to.
 *
 *   vrt baseline rm <route> [--config vrt.config.json]
 *     Remove a single route's baselines.
 *
 * Internal-dogfood note: `vrt workflow` (legacy) still works and is
 * the right call inside this repository for end-to-end testing of
 * vrt itself. It uses a Playwright spec + bulk approval.
 */

import { existsSync } from "node:fs";
import { rm, readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  findConfigPath,
  loadDiffPrConfig,
  type DiffPrConfig,
} from "./diff-pr-config.ts";
import { BOLD, CYAN, DIM, GREEN, RED, RESET, YELLOW } from "@mizchi/vlmkit-core/terminal-colors.ts";

function getArg(args: string[], name: string): string | undefined {
  const i = args.indexOf(`--${name}`);
  if (i < 0 || i === args.length - 1) return undefined;
  const v = args[i + 1];
  return v.startsWith("--") ? undefined : v;
}

function configBaseDirFor(config: DiffPrConfig): string {
  return config.configPath ? resolve(config.configPath, "..") : process.cwd();
}

async function cmdList(args: string[]): Promise<number> {
  const cwd = process.cwd();
  const configPath = findConfigPath(cwd, getArg(args, "config"));
  if (!configPath) {
    console.error(`${RED}error:${RESET} no vrt.config.json found (and --config not given)`);
    return 1;
  }
  const config = loadDiffPrConfig(configPath);
  const baselineRoot = resolve(configBaseDirFor(config), config.baselineDir);
  console.log(`${BOLD}${CYAN}vrt baseline list${RESET}  ${DIM}${configPath}${RESET}`);
  console.log(`${DIM}  ${baselineRoot}${RESET}`);
  console.log();
  if (!existsSync(baselineRoot)) {
    console.log(`  ${DIM}(no baselines yet — run \`vrt baseline pin\`)${RESET}`);
    return 0;
  }
  for (const route of config.routes) {
    const dir = join(baselineRoot, route.name);
    if (!existsSync(dir)) {
      console.log(`  ${YELLOW}${route.name.padEnd(20)}${RESET} ${DIM}no baseline${RESET}`);
      continue;
    }
    const files = (await readdir(dir)).filter((f) => f.endsWith(".png"));
    if (files.length === 0) {
      console.log(`  ${YELLOW}${route.name.padEnd(20)}${RESET} ${DIM}(empty dir)${RESET}`);
      continue;
    }
    const stats = await Promise.all(files.map((f) => stat(join(dir, f))));
    const newest = Math.max(...stats.map((s) => s.mtimeMs));
    const age = new Date(newest).toISOString().slice(0, 19).replace("T", " ");
    const vps = files.map((f) => f.replace(/\.png$/, "")).join(", ");
    console.log(`  ${GREEN}${route.name.padEnd(20)}${RESET} ${vps.padEnd(28)} ${DIM}last pinned ${age}${RESET}`);
  }
  return 0;
}

async function cmdRm(args: string[]): Promise<number> {
  const cwd = process.cwd();
  const configPath = findConfigPath(cwd, getArg(args, "config"));
  if (!configPath) {
    console.error(`${RED}error:${RESET} no vrt.config.json found (and --config not given)`);
    return 1;
  }
  const config = loadDiffPrConfig(configPath);
  const positional = args.filter((a) => !a.startsWith("--"));
  const flaggedValues = new Set<string>();
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--") && i + 1 < args.length && !args[i + 1].startsWith("--")) {
      flaggedValues.add(args[i + 1]);
    }
  }
  const targets = positional.filter((p) => !flaggedValues.has(p));
  if (targets.length === 0) {
    console.error(`${RED}error:${RESET} pass route name(s) to remove`);
    console.error(`Known routes: ${config.routes.map((r) => r.name).join(", ")}`);
    return 1;
  }
  const unknown = targets.filter((t) => !config.routes.some((r) => r.name === t));
  if (unknown.length > 0) {
    console.error(`${RED}error:${RESET} unknown route(s): ${unknown.join(", ")}`);
    console.error(`Known routes: ${config.routes.map((r) => r.name).join(", ")}`);
    return 1;
  }
  const baselineRoot = resolve(configBaseDirFor(config), config.baselineDir);
  let removed = 0;
  for (const t of targets) {
    const dir = join(baselineRoot, t);
    if (existsSync(dir)) {
      await rm(dir, { recursive: true });
      console.log(`  ${GREEN}✓${RESET} removed ${dir}`);
      removed++;
    } else {
      console.log(`  ${DIM}- ${t}: no baseline to remove${RESET}`);
    }
  }
  console.log();
  console.log(`${DIM}Removed ${removed} of ${targets.length} requested baseline(s).${RESET}`);
  return 0;
}

function formatUsage(): string {
  return `vrt baseline <command>

Subcommands:
  pin     [route...] [--config vrt.config.json]
                              Capture / refresh baseline PNGs for
                              declared routes. Alias for \`vrt diff-pr pin\`.
  verify  [--config vrt.config.json] [--output <dir>]
                              Diff current rendering against pinned
                              baselines. Alias for \`vrt diff-pr\`.
  post    --pr <ref>          Post the most recent summary.md to a PR.
                              Alias for \`vrt diff-pr post\`.
  list    [--config vrt.config.json]
                              Show all pinned baselines.
  rm      <route...>          Remove one or more routes' baselines.

\`vrt workflow {init,capture,verify,approve}\` is the legacy vrt-
internal dogfood path (uses a Playwright spec + bulk approval).
\`vrt baseline\` is the canonical surface for external projects.`;
}

async function main(argv = process.argv.slice(2)): Promise<void> {
  const command = argv[0];
  if (!command || command === "help" || command === "--help" || command === "-h") {
    console.log(formatUsage());
    return;
  }
  const rest = argv.slice(1);
  // pin / verify / post route to the existing diff-pr CLI module.
  // We reuse the same code path so future changes to diff-pr land
  // here automatically.
  switch (command) {
    case "pin":
    case "verify":
    case "post": {
      const { main: diffPrMain } = await import("./diff-pr.ts");
      // Map verify → diff-pr's no-subcommand form.
      const mapped = command === "verify" ? rest : [command, ...rest];
      await diffPrMain(mapped);
      return;
    }
    case "list":
      process.exitCode = await cmdList(rest);
      return;
    case "rm":
      process.exitCode = await cmdRm(rest);
      return;
    default:
      console.error(`Unknown baseline subcommand: ${command}\n`);
      console.error(formatUsage());
      process.exit(1);
  }
}

const isCliEntry = process.env.__VRT_DISPATCHER_LEAF__ === "baseline-cli" || (process.argv[1]
  && new URL(import.meta.url).pathname === process.argv[1]);
if (isCliEntry) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

export { main };
