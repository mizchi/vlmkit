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
import { mkdir, readFile, rename, rm, readdir, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  findConfigPath,
  loadDiffPrConfig,
  type DiffPrConfig,
} from "./diff-pr-config.ts";
import {
  buildApprovalRuleFromInput,
  mergeApprovalManifest,
  parseApprovalManifest,
  type ApprovalManifest,
  type ApprovalRegionMatch,
  type ApprovalRuleKind,
} from "./vrt/snapshot/approval.ts";
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

/**
 * Move a route's current baseline PNGs into `_history/<timestamp>/` so a
 * re-pin (`vrt baseline update`) is reversible. Returns the number of files
 * archived. Pure file IO — no Playwright — so it is unit-testable.
 */
export async function archiveRouteBaselines(
  routeDir: string,
  timestamp: string,
): Promise<number> {
  if (!existsSync(routeDir)) return 0;
  const pngs = (await readdir(routeDir)).filter((f) => f.endsWith(".png"));
  if (pngs.length === 0) return 0;
  const historyDir = join(routeDir, "_history", timestamp);
  await mkdir(historyDir, { recursive: true });
  for (const png of pngs) {
    await rename(join(routeDir, png), join(historyDir, png));
  }
  return pngs.length;
}

function archiveTimestamp(): string {
  // ISO without separators that break path segments on any OS.
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function cmdUpdate(args: string[]): Promise<number> {
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
  const routes = targets.length > 0
    ? config.routes.filter((r) => targets.includes(r.name))
    : config.routes;
  if (targets.length > 0) {
    const unknown = targets.filter((t) => !config.routes.some((r) => r.name === t));
    if (unknown.length > 0) {
      console.error(`${RED}error:${RESET} unknown route(s): ${unknown.join(", ")}`);
      console.error(`Known routes: ${config.routes.map((r) => r.name).join(", ")}`);
      return 1;
    }
  }

  const baselineRoot = resolve(configBaseDirFor(config), config.baselineDir);
  const ts = archiveTimestamp();
  let archivedRoutes = 0;
  for (const route of routes) {
    const archived = await archiveRouteBaselines(join(baselineRoot, route.name), ts);
    if (archived > 0) {
      archivedRoutes++;
      console.log(`  ${DIM}archived ${archived} PNG(s) for ${route.name} → _history/${ts}/${RESET}`);
    }
  }
  console.log(`${DIM}Archived previous baselines for ${archivedRoutes} route(s); re-pinning…${RESET}`);
  console.log();

  // Re-pin via the diff-pr pin path (the same capture machinery `pin` uses).
  const { main: diffPrMain } = await import("./diff-pr.ts");
  await diffPrMain(["pin", ...targets, ...(getArg(args, "config") ? ["--config", getArg(args, "config")!] : [])]);
  return 0;
}

function approvalKind(value: string | undefined): ApprovalRuleKind | undefined {
  return value as ApprovalRuleKind | undefined;
}

/**
 * Parse `--region "x=120,y=80,w=200,h=40,viewport=mobile[,tol=8]"` into an
 * ApprovalRegionMatch. Accepts both `w`/`width` and `h`/`height`.
 */
function parseRegionArg(value: string): ApprovalRegionMatch {
  const fields = new Map<string, string>();
  for (const pair of value.split(",")) {
    const [k, v] = pair.split("=");
    if (k && v !== undefined) fields.set(k.trim().toLowerCase(), v.trim());
  }
  const num = (keys: string[], label: string): number => {
    for (const k of keys) {
      const v = fields.get(k);
      if (v !== undefined) {
        const n = Number(v);
        if (!Number.isFinite(n)) throw new Error(`approve: --region ${label} must be a number`);
        return n;
      }
    }
    throw new Error(`approve: --region is missing ${label} (expected x=,y=,w=,h=)`);
  };
  const region: ApprovalRegionMatch = {
    x: num(["x"], "x"),
    y: num(["y"], "y"),
    width: num(["w", "width"], "w"),
    height: num(["h", "height"], "h"),
  };
  const viewport = fields.get("viewport");
  if (viewport) region.viewport = viewport;
  const tol = fields.get("tol") ?? fields.get("tolerance");
  if (tol !== undefined) region.tolerance = Number(tol);
  return region;
}

async function cmdApprove(args: string[]): Promise<number> {
  const selector = getArg(args, "selector");
  const regionRaw = getArg(args, "region");
  const reason = getArg(args, "reason");
  if ((!selector && !regionRaw) || !reason) {
    console.error(`${RED}error:${RESET} a --selector or --region, plus --reason, are required`);
    console.error(`\n  vrt baseline approve (--selector <css> | --region "x=,y=,w=,h=[,viewport=]") --reason <text> [--max-px N] [--max-ratio R] [--expires YYYY-MM-DD] [--acknowledged-by name] [--kind visual] [--manifest approval.json] [--dry-run]`);
    return 1;
  }
  const maxPxRaw = getArg(args, "max-px");
  const maxRatioRaw = getArg(args, "max-ratio");
  const dryRun = args.includes("--dry-run");
  const manifestPath = resolve(getArg(args, "manifest") ?? "approval.json");

  let rule;
  try {
    rule = buildApprovalRuleFromInput({
      ...(selector ? { selector } : {}),
      ...(regionRaw ? { region: parseRegionArg(regionRaw) } : {}),
      reason,
      ...(maxPxRaw !== undefined ? { maxPx: Number(maxPxRaw) } : {}),
      ...(maxRatioRaw !== undefined ? { maxRatio: Number(maxRatioRaw) } : {}),
      ...(getArg(args, "expires") ? { expires: getArg(args, "expires")! } : {}),
      ...(getArg(args, "acknowledged-by") ? { acknowledgedBy: getArg(args, "acknowledged-by")! } : {}),
      ...(getArg(args, "kind") ? { kind: approvalKind(getArg(args, "kind")) } : {}),
      createdAt: new Date().toISOString().slice(0, 10),
    });
  } catch (error) {
    console.error(`${RED}error:${RESET} ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }

  let existing: ApprovalManifest = { rules: [] };
  if (existsSync(manifestPath)) {
    try {
      existing = parseApprovalManifest(await readFile(manifestPath, "utf-8"));
    } catch (error) {
      console.error(`${RED}error:${RESET} could not read ${manifestPath}: ${error instanceof Error ? error.message : String(error)}`);
      return 1;
    }
  }
  const merged = mergeApprovalManifest(existing, [rule]);
  const json = JSON.stringify(merged, null, 2) + "\n";

  if (dryRun) {
    console.log(`${BOLD}${CYAN}vrt baseline approve${RESET} ${DIM}(dry-run — ${manifestPath})${RESET}`);
    console.log(json);
    return 0;
  }

  await writeFile(manifestPath, json);
  const label = selector ?? `region ${regionRaw}`;
  console.log(`  ${GREEN}✓${RESET} approved ${CYAN}${label}${RESET} in ${manifestPath} (${merged.rules.length} rule(s) total)`);
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
  update  [route...] [--config vrt.config.json]
                              Archive current baselines to _history/<ts>/
                              and re-pin (reversible golden refresh).
  list    [--config vrt.config.json]
                              Show all pinned baselines.
  rm      <route...>          Remove one or more routes' baselines.
  approve (--selector <css> | --region "x=,y=,w=,h=[,viewport=]")
          --reason <text>
          [--max-px N] [--max-ratio R] [--expires YYYY-MM-DD]
          [--acknowledged-by name] [--kind visual] [--manifest approval.json]
          [--dry-run]
                              Author an approval.json rule the diff gate
                              honors. Scope by DOM selector or by a bbox zone
                              (any diff inside it is accepted; audit fields
                              recorded).

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
    case "update":
      process.exitCode = await cmdUpdate(rest);
      return;
    case "list":
      process.exitCode = await cmdList(rest);
      return;
    case "rm":
      process.exitCode = await cmdRm(rest);
      return;
    case "approve":
      process.exitCode = await cmdApprove(rest);
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
