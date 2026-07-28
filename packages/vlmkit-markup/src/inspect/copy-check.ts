#!/usr/bin/env node
/**
 * Copy fidelity gate.
 *
 * "Placeholder text is a bug" is a ground rule of the markup skills, but it
 * had no detector — text truth lived only in the target pixels and the
 * verifier's eyes. This closes it with two checks:
 *
 *   1. Placeholder scan (always on): lorem-ipsum and template-filler
 *      phrases in the rendered page text are suspects.
 *   2. Manifest check (opt-in, `--manifest copy.md`): every non-empty
 *      line of the manifest must appear in the rendered text. The
 *      manifest is the copy twin of the motion brief — a small text
 *      carrier for truth a screenshot can't transport reliably (exact
 *      spellings, punctuation, casing).
 *
 * Whitespace is normalized on both sides; comparison is case-sensitive
 * (casing is spec in copy). Deterministic: DOM text only, no VLM.
 *
 * CLI:
 *   vlmkit check copy <html-or-url> [--manifest <file>] [--json]
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { handleCliError } from "@mizchi/vlmkit-core/cli-error.ts";
import { appendRunLedger } from "@mizchi/vlmkit-core/run-ledger.ts";
import { BOLD, CYAN, DIM, GREEN, RED, RESET, YELLOW } from "@mizchi/vlmkit-core/terminal-colors.ts";

export type CopyIssueKind = "placeholder-text" | "copy-missing";

export interface CopyIssue {
  kind: CopyIssueKind;
  severity: "warn" | "suspect";
  message: string;
}

export interface CopyCheckReport {
  source: string;
  textLength: number;
  manifestLines: number;
  missingLines: string[];
  placeholders: string[];
  issues: CopyIssue[];
}

const PLACEHOLDER_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /lorem ipsum/i, label: "lorem ipsum" },
  { pattern: /dolor sit amet/i, label: "dolor sit amet" },
  { pattern: /placeholder/i, label: "placeholder" },
  { pattern: /\bTODO\b/, label: "TODO" },
  { pattern: /\bTBD\b/, label: "TBD" },
  { pattern: /\bFIXME\b/, label: "FIXME" },
  { pattern: /your (?:text|copy|content|title|heading) here/i, label: "your ... here" },
  { pattern: /insert .{0,20}(?:text|copy|content) /i, label: "insert ... text" },
];

export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Manifest lines: non-empty lines with markdown list/heading markers
 * stripped. Comment lines (starting with `#` followed by a space… no —
 * headings use that) are kept as content once the marker is removed.
 */
export function parseCopyManifest(raw: string): string[] {
  return raw
    .split("\n")
    .map((line) => line.replace(/^\s*(?:[-*+]\s+|#{1,6}\s+|\d+\.\s+)/, "").trim())
    .filter((line) => line.length > 0);
}

export function analyzeCopy(input: {
  source: string;
  pageText: string;
  manifestLines?: string[];
}): CopyCheckReport {
  const normalized = normalizeWhitespace(input.pageText);
  const issues: CopyIssue[] = [];

  const placeholders: string[] = [];
  for (const { pattern, label } of PLACEHOLDER_PATTERNS) {
    const m = normalized.match(pattern);
    if (m) {
      placeholders.push(label);
      const at = Math.max(0, m.index! - 30);
      issues.push({
        kind: "placeholder-text",
        severity: "suspect",
        message: `Placeholder "${label}" found in rendered text: "…${normalized.slice(at, m.index! + m[0].length + 30)}…" — replace with the real copy from the target.`,
      });
    }
  }

  const manifestLines = input.manifestLines ?? [];
  const missingLines: string[] = [];
  for (const line of manifestLines) {
    if (!normalized.includes(normalizeWhitespace(line))) {
      missingLines.push(line);
      issues.push({
        kind: "copy-missing",
        severity: "suspect",
        message: `Manifest line not found in rendered text: "${line}" (comparison is whitespace-normalized, case-sensitive).`,
      });
    }
  }

  return {
    source: input.source,
    textLength: normalized.length,
    manifestLines: manifestLines.length,
    missingLines,
    placeholders,
    issues,
  };
}

export interface CopyCheckOptions {
  source: string;
  html?: string;
  manifestPath?: string;
  viewport?: { width: number; height: number };
}

function isUrl(source: string): boolean {
  return /^(https?|file):\/\//.test(source);
}

export async function runCopyCheck(options: CopyCheckOptions): Promise<CopyCheckReport> {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: options.viewport ?? { width: 1280, height: 720 } });
    if (options.html !== undefined) {
      await page.setContent(options.html, { waitUntil: "networkidle" });
    } else if (isUrl(options.source)) {
      await page.goto(options.source, { waitUntil: "networkidle", timeout: 30000 });
    } else {
      await page.goto(pathToFileURL(resolve(options.source)).href, { waitUntil: "networkidle", timeout: 30000 });
    }
    const pageText = await page.evaluate("document.body ? document.body.innerText : \"\"") as string;
    await page.close();

    const manifestLines = options.manifestPath
      ? parseCopyManifest(await readFile(options.manifestPath, "utf8"))
      : undefined;
    const report = analyzeCopy({
      source: options.source,
      pageText,
      ...(manifestLines ? { manifestLines } : {}),
    });
    appendRunLedger({
      tool: "check-copy",
      source: options.source,
      ...(options.manifestPath ? { target: options.manifestPath } : {}),
      headline: {
        missing: report.missingLines.length,
        placeholders: report.placeholders.length,
        manifestLines: report.manifestLines,
      },
    });
    return report;
  } finally {
    await browser.close();
  }
}

export function formatCopyCheckReport(report: CopyCheckReport): string {
  const lines: string[] = [];
  const status = report.issues.some((i) => i.severity === "suspect") ? "suspect"
    : report.issues.length > 0 ? "warn"
    : "ok";
  lines.push(`${BOLD}${CYAN}vlmkit check copy${RESET}`);
  lines.push(`${DIM}source: ${report.source}${RESET}`);
  lines.push("");
  lines.push(`status: ${status}`);
  lines.push(`rendered text: ${report.textLength} chars`);
  if (report.manifestLines > 0) {
    lines.push(`manifest: ${report.manifestLines} line(s), missing ${report.missingLines.length}`);
  } else {
    lines.push(`manifest: none (placeholder scan only — pass --manifest for full copy verification)`);
  }
  if (report.issues.length > 0) {
    lines.push("");
    lines.push("Issues:");
    for (const issue of report.issues) {
      const icon = issue.severity === "suspect" ? `${RED}x${RESET}` : `${YELLOW}!${RESET}`;
      lines.push(`  ${icon} ${issue.kind}: ${issue.message}`);
    }
  } else {
    lines.push("");
    lines.push(`${GREEN}No copy issues detected.${RESET}`);
  }
  return lines.join("\n");
}

function printUsage(exitCode: number): never {
  console.log(`Usage: vlmkit check copy <html-or-url> [options]

Copy fidelity gate: placeholder-text scan (always on) plus optional
manifest verification (every manifest line must appear in the rendered
page text; whitespace-normalized, case-sensitive).

Options:
  --manifest <file>   Copy manifest (plain text / markdown; one required line per row)
  --json              Print JSON report
  --fail-on-suspect   Exit non-zero when suspect issues are found`);
  process.exit(exitCode);
}

async function main(argv = process.argv.slice(2)): Promise<void> {
  if (argv.includes("--help") || argv.includes("-h")) printUsage(0);
  let manifestPath: string | undefined;
  let json = false;
  let failOnSuspect = false;
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--manifest") manifestPath = argv[++i]!;
    else if (arg === "--json") json = true;
    else if (arg === "--fail-on-suspect") failOnSuspect = true;
    else if (!arg.startsWith("-")) positional.push(arg);
  }
  if (positional.length === 0) printUsage(1);
  const report = await runCopyCheck({ source: positional[0]!, ...(manifestPath ? { manifestPath } : {}) });
  if (json) console.log(JSON.stringify(report, null, 2));
  else console.log(formatCopyCheckReport(report));
  if (failOnSuspect && report.issues.some((i) => i.severity === "suspect")) process.exit(1);
}

const isCliEntry = process.env.__VRT_DISPATCHER_LEAF__ === "copy-check" ||
  (process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false);
if (isCliEntry) {
  main().catch(handleCliError);
}
