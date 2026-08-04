#!/usr/bin/env node
/**
 * Stage-2 fix synthesis for the markup loop (issue #88, item 1).
 *
 * The measured motivation: selector attribution alone halves rounds for
 * a model that can reason about the residual (S9 replay, Sonnet 6→3)
 * but does NOT rescue a model that cannot (S9-fresh, Haiku stalled on
 * the identical three points with correct attributions in hand). This
 * command externalizes that reasoning step: a Stage-2 LLM turns the
 * attributed kickback + computed styles into concrete CSS overrides,
 * and a deterministic gate decides whether they stay.
 *
 * Architecture is lifted from the proven css-challenge fix-loop:
 *   1. context pack  — kickback lines (with attributions, kind tags,
 *      near-miss/grouping caveats), computed styles of every attributed
 *      selector, and the attempt's own CSS
 *   2. proposal      — injectable `propose` function; the CLI wires it
 *      to vlmkit-ai's LLMProvider. Structured JSON out, leniently
 *      parsed, hard-capped.
 *   3. apply         — one `<style data-vlmkit-autofix="N">` override
 *      block per accepted round. Rollback = remove the block; the
 *      original markup is never edited.
 *   4. gate          — re-run `verify markup`; REGRESSED (or flat with
 *      no pixel-diff gain) rolls the block back. Two consecutive
 *      rollbacks stop the loop (the qwen3-coder lesson: the gate
 *      absorbs over-correction, but a proposer that keeps regressing
 *      will not converge — stop paying it).
 *
 * Works against a copy by default (`<attempt>.autofix.html`); the
 * original file is only touched with --in-place.
 *
 * CLI:
 *   vlmkit heal markup <attempt.html> --target <png> [--target ...]
 *     [--max-rounds 4] [--in-place] [--dry-run] [--json]
 */
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { handleCliError } from "@mizchi/vlmkit-core/cli-error.ts";
import { appendRunLedger } from "@mizchi/vlmkit-core/run-ledger.ts";
import { settlePage } from "@mizchi/vlmkit-core/page-open.ts";
import { BOLD, CYAN, DIM, GREEN, RED, RESET, YELLOW } from "@mizchi/vlmkit-core/terminal-colors.ts";
import {
  computeTrend,
  runMarkupVerify,
  type MarkupVerifyReport,
  type VerifyTrendPoint,
} from "./markup-verify.ts";

// ---------------------------------------------------------------------------
// Fix proposals

export interface FixProposal {
  selector: string;
  /** CSS declarations, e.g. { "background": "#0b1220", "padding-bottom": "50px" }. */
  declarations: Record<string, string>;
  /** Short reason, echoed into the report. */
  note?: string;
}

export interface SelectorStyles {
  selector: string;
  /** Computed-style subset of the first matching element; null if no match. */
  styles: Record<string, string> | null;
}

export interface ProposeContext {
  kickback: string[];
  selectorStyles: SelectorStyles[];
  /** The attempt's own <style> text (capped). */
  css: string;
  targetSize: { width: number; height: number };
  renderedHeight: number;
  round: number;
}

export type ProposeFixes = (context: ProposeContext) => Promise<FixProposal[]>;

/** Rules per round beyond this are dropped (loudly, in the report). */
const MAX_RULES_PER_ROUND = 12;
const MAX_CSS_CONTEXT_CHARS = 24_000;

/**
 * Lenient JSON extraction: accepts a bare array, a `{"fixes": [...]}`
 * wrapper, or either of those inside a ```json fence / surrounding
 * prose. Anything unparseable yields [] — an empty proposal ends the
 * loop instead of crashing it.
 */
export function parseFixProposals(text: string): FixProposal[] {
  const candidates: string[] = [];
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) candidates.push(fenced[1]!);
  candidates.push(text);
  const firstBracket = text.search(/[[{]/);
  if (firstBracket >= 0) candidates.push(text.slice(firstBracket));

  for (const c of candidates) {
    try {
      const parsed = JSON.parse(c.trim()) as unknown;
      const list = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === "object" && Array.isArray((parsed as { fixes?: unknown }).fixes)
        ? (parsed as { fixes: unknown[] }).fixes
        : null;
      if (!list) continue;
      const fixes: FixProposal[] = [];
      for (const item of list) {
        if (!item || typeof item !== "object") continue;
        const { selector, declarations, note } = item as Record<string, unknown>;
        if (typeof selector !== "string" || !selector.trim()) continue;
        if (!declarations || typeof declarations !== "object" || Array.isArray(declarations)) continue;
        const decls: Record<string, string> = {};
        for (const [prop, value] of Object.entries(declarations as Record<string, unknown>)) {
          if (typeof value === "string" || typeof value === "number") {
            decls[prop] = String(value);
          }
        }
        if (Object.keys(decls).length === 0) continue;
        fixes.push({
          selector: selector.trim(),
          declarations: decls,
          ...(typeof note === "string" ? { note } : {}),
        });
      }
      if (fixes.length > 0) return fixes;
    } catch {
      // try the next candidate
    }
  }
  return [];
}

// ---------------------------------------------------------------------------
// Override-block apply / rollback

const BLOCK_ATTR = "data-vlmkit-autofix";

function sanitizeCssToken(value: string): string {
  // A hostile/hallucinated value must not be able to close the style
  // element or smuggle markup.
  return value.replace(/<\s*\/?\s*style/gi, "").replace(/[<>]/g, "");
}

export function serializeFixBlock(fixes: FixProposal[], round: number): string {
  const rules = fixes.map((f) => {
    const body = Object.entries(f.declarations)
      .map(([prop, value]) => `  ${sanitizeCssToken(prop)}: ${sanitizeCssToken(value)};`)
      .join("\n");
    return `${sanitizeCssToken(f.selector)} {\n${body}\n}`;
  });
  return `<style ${BLOCK_ATTR}="${round}">\n${rules.join("\n")}\n</style>`;
}

export function applyFixBlock(html: string, fixes: FixProposal[], round: number): string {
  const block = serializeFixBlock(fixes, round);
  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, `${block}\n</head>`);
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${block}\n</body>`);
  return html + "\n" + block + "\n";
}

export function removeFixBlock(html: string, round: number): string {
  const re = new RegExp(`<style ${BLOCK_ATTR}="${round}">[\\s\\S]*?</style>\\n?`, "i");
  return html.replace(re, "");
}

// ---------------------------------------------------------------------------
// Context pack

/** Selectors named by kickback attributions, deduped, in order. */
export function extractKickbackSelectors(kickback: string[]): string[] {
  const out: string[] = [];
  for (const line of kickback) {
    for (const m of line.matchAll(/\[(?:rendered by|target box falls in your|the gap sits above) `([^`]+)`\]/g)) {
      const sel = m[1]!;
      if (!out.includes(sel)) out.push(sel);
    }
  }
  return out;
}

const COMPUTED_SUBSET = [
  "display", "position", "top", "right", "bottom", "left",
  "width", "height",
  "margin-top", "margin-right", "margin-bottom", "margin-left",
  "padding-top", "padding-right", "padding-bottom", "padding-left",
  "gap", "flex-direction", "align-items", "justify-content",
  "font-size", "line-height", "font-weight", "letter-spacing",
  "color", "background-color", "border-top-width", "border-bottom-width",
  "overflow", "overflow-x", "z-index", "box-sizing",
];

export async function captureComputedStyles(
  attemptPath: string,
  selectors: string[],
  viewport: { width: number; height: number },
): Promise<SelectorStyles[]> {
  if (selectors.length === 0) return [];
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport });
    await page.goto(pathToFileURL(resolve(attemptPath)).href, { waitUntil: "load" });
    // Computed styles are read via `page.evaluate`, which does not auto-wait:
    // a selector whose element renders after `load` came back `styles: null`,
    // indistinguishable from a selector that genuinely does not exist.
    await settlePage(page);
    const result = await page.evaluate(
      ({ sels, props }: { sels: string[]; props: string[] }) =>
        sels.map((selector) => {
          const el = document.querySelector(selector);
          if (!el) return { selector, styles: null };
          const cs = getComputedStyle(el);
          const styles: Record<string, string> = {};
          for (const p of props) styles[p] = cs.getPropertyValue(p);
          return { selector, styles };
        }),
      { sels: selectors, props: COMPUTED_SUBSET },
    );
    return result as SelectorStyles[];
  } finally {
    await browser.close();
  }
}

export function extractStyleText(html: string): string {
  const matches = [...html.matchAll(/<style(?![^>]*data-vlmkit-autofix)[^>]*>([\s\S]*?)<\/style>/gi)];
  const text = matches.map((m) => m[1]!).join("\n");
  return text.length > MAX_CSS_CONTEXT_CHARS
    ? text.slice(0, MAX_CSS_CONTEXT_CHARS) + "\n/* ...truncated... */"
    : text;
}

export function buildFixPrompt(context: ProposeContext): string {
  const styleLines = context.selectorStyles.map((s) =>
    s.styles
      ? `${s.selector}:\n${Object.entries(s.styles).filter(([, v]) => v).map(([p, v]) => `  ${p}: ${v}`).join("\n")}`
      : `${s.selector}: (no matching element)`
  ).join("\n\n");
  return `You are a CSS repair engine for a pixel-verified markup loop. A deterministic verifier compared the rendered attempt against a target screenshot (${context.targetSize.width}x${context.targetSize.height}; the attempt currently renders ${context.renderedHeight}px tall) and produced the residual list below. Propose the SMALLEST set of CSS override rules that fixes the FIRST problems in the list.

Rules of the game:
- Residual lines are ordered by priority. ROOT-CAUSE lines first; items below them are usually debris of that defect.
- Bracketed notes are trustworthy machine measurements: [rendered by \`sel\`] names the element that renders a residual; [target box falls in your \`sel\`] names where a missing element belongs; [near-miss: ...] means move, don't add/remove; [size-delta caveat: ...] means do NOT resize from the literal number; a [text] extra is NEVER fixed by hiding or deleting text.
- A page-height error is unclosed vertical spacing — fix gaps top-down.
- \`position: fixed\` elements paint ONCE in a full-page screenshot at their first-viewport position; gap lines touching such an element are distorted — fix the element's own size/position, not those gaps.
- Overrides are appended AFTER the existing stylesheet, so equal-specificity rules win by order. Prefer adjusting existing selectors' properties over inventing new structure. You cannot add/remove HTML elements — CSS only (::before/::after are allowed for genuinely missing decorative boxes like dividers).
- At most ${MAX_RULES_PER_ROUND} rules. Fewer, targeted rules beat broad rewrites — every rule you emit is applied together and reverted together.

Residuals (verifier kickback):
${context.kickback.map((k) => `- ${k}`).join("\n")}

Computed styles of the attributed selectors (at ${context.targetSize.width}px viewport):
${styleLines || "(none captured)"}

The attempt's current CSS:
\`\`\`css
${context.css}
\`\`\`

Respond with ONLY a JSON array of fixes, no prose:
[{"selector": ".hero", "declarations": {"padding-bottom": "50px"}, "note": "opens gap #1->#2 by 20px"}]`;
}

// ---------------------------------------------------------------------------
// The loop

export interface AutofixRound {
  round: number;
  proposed: FixProposal[];
  outcome: "accepted" | "rolled-back" | "no-proposal";
  trendDirection?: "improved" | "regressed" | "flat";
  pixelDiffBefore: number;
  pixelDiffAfter?: number;
  residualsBefore: number;
  residualsAfter?: number;
}

export interface AutofixReport {
  attempt: string;
  workingFile: string;
  done: boolean;
  stopReason: "done" | "max-rounds" | "no-proposal" | "consecutive-rollbacks";
  rounds: AutofixRound[];
  finalVerify: MarkupVerifyReport;
}

export interface MarkupAutofixOptions {
  attempt: string;
  targets: string[];
  propose: ProposeFixes;
  maxRounds?: number;
  /** Operate on the attempt file itself instead of a `.autofix.html` copy. */
  inPlace?: boolean;
  /** Progress line sink (CLI wires console.log). */
  log?: (line: string) => void;
}

function verdictPoint(report: MarkupVerifyReport): VerifyTrendPoint {
  return {
    targetsPassed: report.targets.filter((t) => t.pass).length,
    residuals: report.targets.reduce(
      (sum, t) => sum + t.missingBlocking + t.extraBlocking + t.orderViolations,
      0,
    ),
  };
}

function totalPixelDiff(report: MarkupVerifyReport): number {
  return report.targets.reduce((sum, t) => sum + t.pixelDiffRatio, 0);
}

export async function runMarkupAutofix(options: MarkupAutofixOptions): Promise<AutofixReport> {
  const maxRounds = options.maxRounds ?? 4;
  const log = options.log ?? (() => {});
  const workingFile = options.inPlace
    ? options.attempt
    : options.attempt.replace(/\.html?$/i, "") + ".autofix.html";
  if (!options.inPlace) copyFileSync(options.attempt, workingFile);

  const rounds: AutofixRound[] = [];
  let verify = await runMarkupVerify({ attempt: workingFile, targets: options.targets });
  let stopReason: AutofixReport["stopReason"] = "max-rounds";
  let consecutiveRollbacks = 0;

  for (let round = 1; round <= maxRounds && !verify.done; round++) {
    const before = verdictPoint(verify);
    const pixelBefore = totalPixelDiff(verify);
    const html = readFileSync(workingFile, "utf8");
    const selectors = extractKickbackSelectors(verify.kickback);
    const context: ProposeContext = {
      kickback: verify.kickback,
      selectorStyles: await captureComputedStyles(
        workingFile,
        selectors,
        { width: verify.targets[0]?.width ?? 1280, height: Math.min(verify.targets[0]?.height ?? 800, 4000) },
      ),
      css: extractStyleText(html),
      targetSize: { width: verify.targets[0]?.width ?? 1280, height: verify.targets[0]?.height ?? 0 },
      renderedHeight: verify.targets[0]?.renderedHeight ?? 0,
      round,
    };

    let proposed = await options.propose(context);
    if (proposed.length > MAX_RULES_PER_ROUND) {
      log(`${YELLOW}round ${round}: proposal capped ${proposed.length} -> ${MAX_RULES_PER_ROUND} rules${RESET}`);
      proposed = proposed.slice(0, MAX_RULES_PER_ROUND);
    }
    if (proposed.length === 0) {
      rounds.push({ round, proposed, outcome: "no-proposal", pixelDiffBefore: pixelBefore, residualsBefore: before.residuals });
      stopReason = "no-proposal";
      break;
    }

    writeFileSync(workingFile, applyFixBlock(html, proposed, round));
    const verifyAfter = await runMarkupVerify({ attempt: workingFile, targets: options.targets });
    const after = verdictPoint(verifyAfter);
    const pixelAfter = totalPixelDiff(verifyAfter);
    const direction = computeTrend(before, after).direction;
    const accept = direction === "improved"
      || (direction === "flat" && pixelAfter < pixelBefore - 0.0005);

    rounds.push({
      round,
      proposed,
      outcome: accept ? "accepted" : "rolled-back",
      trendDirection: direction,
      pixelDiffBefore: pixelBefore,
      pixelDiffAfter: pixelAfter,
      residualsBefore: before.residuals,
      residualsAfter: after.residuals,
    });

    if (accept) {
      consecutiveRollbacks = 0;
      verify = verifyAfter;
      log(`${GREEN}round ${round}: accepted${RESET} (${direction}, residuals ${before.residuals} -> ${after.residuals}, diff ${(pixelBefore * 100).toFixed(2)}% -> ${(pixelAfter * 100).toFixed(2)}%)`);
    } else {
      writeFileSync(workingFile, html);
      consecutiveRollbacks++;
      log(`${RED}round ${round}: rolled back${RESET} (${direction}, residuals ${before.residuals} -> ${after.residuals}, diff ${(pixelBefore * 100).toFixed(2)}% -> ${(pixelAfter * 100).toFixed(2)}%)`);
      if (consecutiveRollbacks >= 2) {
        stopReason = "consecutive-rollbacks";
        break;
      }
    }
  }

  if (verify.done) stopReason = "done";
  const report: AutofixReport = {
    attempt: options.attempt,
    workingFile,
    done: verify.done,
    stopReason,
    rounds,
    finalVerify: verify,
  };
  appendRunLedger({
    tool: "markup-autofix",
    source: options.attempt,
    target: options.targets.join(","),
    headline: {
      done: report.done,
      stopReason,
      rounds: rounds.length,
      accepted: rounds.filter((r) => r.outcome === "accepted").length,
      rolledBack: rounds.filter((r) => r.outcome === "rolled-back").length,
    },
  });
  return report;
}

// ---------------------------------------------------------------------------
// CLI

export function formatAutofixReport(report: AutofixReport): string {
  const lines: string[] = [];
  lines.push(`${BOLD}${CYAN}vlmkit heal markup${RESET}`);
  lines.push(`${DIM}attempt: ${report.attempt}${RESET}`);
  if (report.workingFile !== report.attempt) lines.push(`${DIM}output:  ${report.workingFile}${RESET}`);
  lines.push("");
  for (const r of report.rounds) {
    const head = r.outcome === "accepted"
      ? `${GREEN}accepted${RESET}`
      : r.outcome === "rolled-back"
      ? `${RED}rolled back${RESET}`
      : `${YELLOW}no proposal${RESET}`;
    lines.push(`round ${r.round}: ${head}${r.trendDirection ? ` (${r.trendDirection})` : ""} — ${r.proposed.length} rule(s)`);
    for (const f of r.proposed) {
      lines.push(`  ${DIM}${f.selector} { ${Object.entries(f.declarations).map(([p, v]) => `${p}: ${v}`).join("; ")} }${f.note ? ` — ${f.note}` : ""}${RESET}`);
    }
  }
  lines.push("");
  lines.push(`verdict: ${report.done ? `${GREEN}DONE${RESET}` : `${RED}NOT DONE${RESET}`} (${report.stopReason})`);
  if (!report.done && report.finalVerify.kickback.length > 0) {
    lines.push("");
    lines.push(`${BOLD}Remaining kickback:${RESET}`);
    for (const k of report.finalVerify.kickback) lines.push(`  * ${k}`);
  }
  return lines.join("\n");
}

function printUsage(exitCode: number): never {
  console.log(`Usage: vlmkit heal markup <attempt.html> --target <png> [--target <png> ...] [options]

Stage-2 fix synthesis: an LLM turns the attributed verify-markup
kickback + computed styles into CSS override blocks; a deterministic
trend gate accepts or rolls back each round. The original file is not
modified unless --in-place is given (default output: <attempt>.autofix.html).

Requires an LLM API key (VLMKIT_LLM_PROVIDER / GEMINI_API_KEY / OPENROUTER_API_KEY /
ANTHROPIC_API_KEY — see vlmkit-ai llm-client). Use --dry-run without one.

Options:
  --target <png>     Target screenshot (repeatable)
  --max-rounds <n>   Proposal rounds (default 4)
  --in-place         Patch the attempt file itself
  --dry-run          Print the round-1 context pack + prompt, call nothing
  --json             Print JSON report`);
  process.exit(exitCode);
}

async function main(argv = process.argv.slice(2)): Promise<void> {
  if (argv.includes("--help") || argv.includes("-h")) printUsage(0);
  const targets: string[] = [];
  let maxRounds = 4;
  let inPlace = false;
  let dryRun = false;
  let json = false;
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--target") targets.push(argv[++i]!);
    else if (arg === "--max-rounds") maxRounds = Number(argv[++i]!);
    else if (arg === "--in-place") inPlace = true;
    else if (arg === "--dry-run") dryRun = true;
    else if (arg === "--json") json = true;
    else if (!arg.startsWith("-")) positional.push(arg);
  }
  const attempt = positional[0];
  if (!attempt || targets.length === 0) printUsage(1);
  if (!existsSync(attempt)) throw new Error(`Attempt not found: ${attempt}`);
  for (const t of targets) if (!existsSync(t)) throw new Error(`Target not found: ${t}`);

  if (dryRun) {
    const verify = await runMarkupVerify({ attempt, targets });
    if (verify.done) {
      console.log(`${GREEN}Already DONE — nothing to fix.${RESET}`);
      return;
    }
    const selectors = extractKickbackSelectors(verify.kickback);
    const html = readFileSync(attempt, "utf8");
    const context: ProposeContext = {
      kickback: verify.kickback,
      selectorStyles: await captureComputedStyles(attempt, selectors, {
        width: verify.targets[0]?.width ?? 1280,
        height: Math.min(verify.targets[0]?.height ?? 800, 4000),
      }),
      css: extractStyleText(html),
      targetSize: { width: verify.targets[0]?.width ?? 1280, height: verify.targets[0]?.height ?? 0 },
      renderedHeight: verify.targets[0]?.renderedHeight ?? 0,
      round: 1,
    };
    console.log(buildFixPrompt(context));
    return;
  }

  const { createLLMProvider } = await import("@mizchi/vlmkit-ai/llm-client.ts");
  const llm = createLLMProvider({ throwIfMissing: false });
  if (!llm) {
    console.error(`${RED}No LLM API key configured.${RESET} Set GEMINI_API_KEY / OPENROUTER_API_KEY / ANTHROPIC_API_KEY (see VLMKIT_LLM_PROVIDER), or use --dry-run to inspect the context pack.`);
    process.exit(1);
  }
  const propose: ProposeFixes = async (context) => parseFixProposals(await llm.complete(buildFixPrompt(context)));

  const report = await runMarkupAutofix({
    attempt,
    targets,
    propose,
    maxRounds,
    inPlace,
    log: (line) => console.log(line),
  });
  if (json) console.log(JSON.stringify(report, null, 2));
  else console.log(formatAutofixReport(report));
  if (!report.done) process.exit(1);
}

const isCliEntry = process.env.__VLMKIT_DISPATCHER_LEAF__ === "markup-autofix" ||
  (process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false);
if (isCliEntry) {
  main().catch(handleCliError);
}
