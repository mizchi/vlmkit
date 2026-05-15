#!/usr/bin/env node
/**
 * `vrt manifest` — author and inspect the approval manifest that
 * `vrt compare` already honors. The manifest format (#22's
 * `approval.json`) supports per-selector, per-property, and per-region
 * tolerance overrides plus an `expires` field, but until this CLI
 * existed there was no way to author entries except by hand-editing
 * JSON.
 *
 * Subcommands:
 *   vrt manifest list   [--path approval.json]
 *   vrt manifest add    --reason "..." [other selectors] [--path ...]
 *   vrt manifest rm     <index | selector> [--path ...]
 *   vrt manifest check  [--path ...]    (warns expired rules)
 *
 * The schema honored is the one validated by `validateApprovalManifest`
 * in `src/approval.ts`; this CLI is a thin facade so the consumer
 * pipeline doesn't see new fields.
 */

import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  type ApprovalManifest,
  type ApprovalRule,
  type ApprovalTolerance,
  mergeApprovalManifest,
  parseApprovalManifest,
  validateApprovalManifest,
} from "./approval.ts";
import { BOLD, CYAN, DIM, GREEN, RED, RESET, YELLOW } from "./terminal-colors.ts";

const DEFAULT_MANIFEST_PATH = "approval.json";

function getArg(args: string[], name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  if (idx < 0 || idx === args.length - 1) return undefined;
  const next = args[idx + 1];
  if (next.startsWith("--")) return undefined;
  return next;
}

function hasFlag(args: string[], name: string): boolean {
  return args.includes(`--${name}`);
}

async function loadManifestOrEmpty(path: string): Promise<ApprovalManifest> {
  if (!existsSync(path)) return { rules: [] };
  const raw = await readFile(path, "utf-8");
  if (!raw.trim()) return { rules: [] };
  return parseApprovalManifest(raw);
}

async function writeManifest(path: string, manifest: ApprovalManifest): Promise<void> {
  // Re-validate before write so a programming bug here doesn't corrupt
  // the file. Throws with a clear message if malformed.
  validateApprovalManifest(manifest);
  await writeFile(path, JSON.stringify(manifest, null, 2) + "\n");
}

function isExpired(rule: ApprovalRule, now: Date = new Date()): boolean {
  if (!rule.expires) return false;
  return now.getTime() > Date.parse(rule.expires);
}

function describeMatcher(rule: ApprovalRule): string {
  const parts: string[] = [];
  if (rule.selector) parts.push(`selector="${rule.selector}"`);
  if (rule.property) parts.push(`property="${rule.property}"`);
  if (rule.category) parts.push(`category=${rule.category}`);
  if (rule.changeType) parts.push(`changeType=${rule.changeType}`);
  return parts.length > 0 ? parts.join(" ") : "(no matcher — applies to all)";
}

function describeTolerance(tol: ApprovalTolerance | undefined): string {
  if (!tol) return "";
  const parts: string[] = [];
  if (tol.pixels !== undefined) parts.push(`pixels≤${tol.pixels}`);
  if (tol.ratio !== undefined) parts.push(`ratio≤${(tol.ratio * 100).toFixed(2)}%`);
  if (tol.geometryDelta !== undefined) parts.push(`geomΔ≤${tol.geometryDelta}px`);
  if (tol.colorDelta !== undefined) parts.push(`colorΔ≤${tol.colorDelta}`);
  return parts.length > 0 ? `tolerance: ${parts.join(", ")}` : "";
}

async function cmdList(args: string[]): Promise<void> {
  const path = resolve(getArg(args, "path") ?? DEFAULT_MANIFEST_PATH);
  if (!existsSync(path)) {
    console.log(`${DIM}No manifest at ${path}${RESET}`);
    return;
  }
  const manifest = await loadManifestOrEmpty(path);
  if (manifest.rules.length === 0) {
    console.log(`${DIM}Manifest ${path} has no rules${RESET}`);
    return;
  }
  const now = new Date();
  console.log(`${BOLD}${CYAN}Approval manifest${RESET}  ${DIM}${path}${RESET}`);
  console.log(`${DIM}  ${manifest.rules.length} rule(s)${RESET}`);
  console.log();
  for (let i = 0; i < manifest.rules.length; i++) {
    const rule = manifest.rules[i];
    const expired = isExpired(rule, now);
    const status = expired ? `${RED}EXPIRED${RESET}` : `${GREEN}active${RESET}`;
    console.log(`  ${BOLD}[${i}]${RESET} ${status}  ${describeMatcher(rule)}`);
    console.log(`      reason: ${rule.reason}`);
    const tol = describeTolerance(rule.tolerance);
    if (tol) console.log(`      ${DIM}${tol}${RESET}`);
    if (rule.expires) {
      const tag = expired ? RED : DIM;
      console.log(`      ${tag}expires: ${rule.expires}${RESET}`);
    }
    if (rule.issue) console.log(`      ${DIM}issue: ${rule.issue}${RESET}`);
  }
}

async function cmdAdd(args: string[]): Promise<void> {
  const path = resolve(getArg(args, "path") ?? DEFAULT_MANIFEST_PATH);

  const reason = getArg(args, "reason");
  if (!reason) {
    console.error(`${RED}error:${RESET} --reason is required`);
    console.error(`Hint: explain WHY the deviation is acceptable, not what it is.`);
    process.exit(1);
  }

  const selector = getArg(args, "selector");
  const property = getArg(args, "property");
  const category = getArg(args, "category");
  const changeType = getArg(args, "change-type");

  const tolerance: ApprovalTolerance = {};
  const maxPx = getArg(args, "max-px");
  if (maxPx) tolerance.pixels = Number(maxPx);
  const maxRatio = getArg(args, "max-ratio");
  if (maxRatio) tolerance.ratio = Number(maxRatio);
  const geomDelta = getArg(args, "geometry-delta");
  if (geomDelta) tolerance.geometryDelta = Number(geomDelta);
  const colorDelta = getArg(args, "color-delta");
  if (colorDelta) tolerance.colorDelta = Number(colorDelta);

  const expires = getArg(args, "expires");
  const issue = getArg(args, "issue");

  const rule: ApprovalRule = { reason };
  if (selector) rule.selector = selector;
  if (property) rule.property = property;
  if (category) rule.category = category as ApprovalRule["category"];
  if (changeType) rule.changeType = changeType;
  if (Object.keys(tolerance).length > 0) rule.tolerance = tolerance;
  if (expires) rule.expires = expires;
  if (issue) rule.issue = issue;

  if (!selector && !property && !category && !changeType) {
    console.error(`${RED}error:${RESET} at least one matcher is required ` +
      `(--selector, --property, --category, --change-type)`);
    console.error(`A rule with no matcher would approve every diff — refusing.`);
    process.exit(1);
  }

  if (hasFlag(args, "dry-run")) {
    console.log(`${DIM}--dry-run: would add to ${path}:${RESET}`);
    console.log(JSON.stringify(rule, null, 2));
    return;
  }

  const existing = await loadManifestOrEmpty(path);
  const merged = mergeApprovalManifest(existing, [rule]);
  await writeManifest(path, merged);
  console.log(`${GREEN}✓${RESET} added rule to ${path} ` +
    `${DIM}(${merged.rules.length} total)${RESET}`);
  console.log(`  ${describeMatcher(rule)}`);
  console.log(`  reason: ${reason}`);
  if (expires) console.log(`  ${DIM}expires: ${expires}${RESET}`);
}

async function cmdRm(args: string[]): Promise<void> {
  const path = resolve(getArg(args, "path") ?? DEFAULT_MANIFEST_PATH);
  // First positional (anything not starting with `--` and not the value
  // of a preceding `--flag`).
  let target: string | undefined;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith("--")) { i++; continue; } // skip --flag value pair
    target = a;
    break;
  }
  if (!target) {
    console.error(`${RED}error:${RESET} pass an index or selector`);
    console.error(`Usage: vrt manifest rm <index | selector>`);
    process.exit(1);
  }
  const manifest = await loadManifestOrEmpty(path);
  if (manifest.rules.length === 0) {
    console.log(`${DIM}No rules in ${path}${RESET}`);
    return;
  }

  let removeIdx = -1;
  if (/^\d+$/.test(target)) {
    removeIdx = Number(target);
  } else {
    removeIdx = manifest.rules.findIndex((r) => r.selector === target);
  }
  if (removeIdx < 0 || removeIdx >= manifest.rules.length) {
    console.error(`${RED}error:${RESET} no rule at ${target}`);
    process.exit(1);
  }

  const removed = manifest.rules.splice(removeIdx, 1)[0];
  if (hasFlag(args, "dry-run")) {
    console.log(`${DIM}--dry-run: would remove:${RESET}`);
    console.log(`  [${removeIdx}] ${describeMatcher(removed)}`);
    return;
  }
  await writeManifest(path, manifest);
  console.log(`${GREEN}✓${RESET} removed rule [${removeIdx}] from ${path} ` +
    `${DIM}(${manifest.rules.length} remaining)${RESET}`);
  console.log(`  ${describeMatcher(removed)}`);
}

async function cmdCheck(args: string[]): Promise<void> {
  const path = resolve(getArg(args, "path") ?? DEFAULT_MANIFEST_PATH);
  if (!existsSync(path)) {
    console.log(`${DIM}No manifest at ${path}${RESET}`);
    return;
  }
  const manifest = await loadManifestOrEmpty(path);
  const now = new Date();
  const soonMs = 1000 * 60 * 60 * 24 * 14; // 14 days
  let expired = 0;
  let soon = 0;
  for (let i = 0; i < manifest.rules.length; i++) {
    const rule = manifest.rules[i];
    if (!rule.expires) continue;
    const t = Date.parse(rule.expires);
    if (t < now.getTime()) {
      console.log(`  ${RED}EXPIRED${RESET} [${i}] ${describeMatcher(rule)} — expired ${rule.expires}`);
      expired++;
    } else if (t - now.getTime() < soonMs) {
      console.log(`  ${YELLOW}expiring${RESET} [${i}] ${describeMatcher(rule)} — expires ${rule.expires}`);
      soon++;
    }
  }
  if (expired === 0 && soon === 0) {
    console.log(`${GREEN}✓${RESET} all rules in ${path} are healthy`);
    return;
  }
  console.log();
  console.log(`${DIM}${expired} expired, ${soon} expiring within 14 days${RESET}`);
  if (expired > 0) process.exit(1);
}

function formatUsage(): string {
  return `vrt manifest <command>

Subcommands:
  list   [--path approval.json]
                              List rules with status (active / expired)
  add    --reason "..." [--selector <sel>] [--property <p>]
         [--category <c>] [--change-type <t>]
         [--max-px N] [--max-ratio N] [--geometry-delta N] [--color-delta N]
         [--expires YYYY-MM-DD] [--issue <url>] [--path approval.json]
         [--dry-run]
                              Author an approval rule
  rm     <index | selector> [--path approval.json] [--dry-run]
                              Remove a rule
  check  [--path approval.json]
                              Warn on expired / soon-to-expire rules
                              (non-zero exit on expired)

Examples:
  vrt manifest add --selector .marquee --reason "animated content; intentionally dynamic"
  vrt manifest add --selector .hero__body --max-px 2 --reason "sub-pixel AA artifact" --expires 2026-09-01
  vrt manifest list
  vrt manifest check        # CI hook: fail build if rules expired`;
}

async function main(argv = process.argv.slice(2)) {
  const command = argv[0];
  if (!command || command === "help" || command === "--help" || command === "-h") {
    console.log(formatUsage());
    return;
  }
  const rest = argv.slice(1);
  switch (command) {
    case "list":
      await cmdList(rest);
      return;
    case "add":
      await cmdAdd(rest);
      return;
    case "rm":
      await cmdRm(rest);
      return;
    case "check":
      await cmdCheck(rest);
      return;
    default:
      console.error(`Unknown manifest subcommand: ${command}\n`);
      console.error(formatUsage());
      process.exit(1);
  }
}

const isCliEntry = process.argv[1]
  && new URL(import.meta.url).pathname === process.argv[1];
if (isCliEntry) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

export { main };
