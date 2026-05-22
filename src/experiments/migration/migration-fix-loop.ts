#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { extractCss } from "../css-challenge/css-challenge-core.ts";
import { createLLMProvider } from "@mizchi/vlmkit-ai/llm-client.ts";
import { runMigrationCompare, type MigrationCompareOptions } from "./migration-compare.ts";
import {
  applyMigrationFixToHtml,
  buildBaselineValueIndex,
  buildMigrationFixLoopMultiPrompt,
  buildMigrationFixLoopPrompt,
  correctMigrationFixesWithReport,
  extractCustomPropertyDiffs,
  inlineExternalStylesheets,
  parseMigrationFixMultiResponse,
  parseMigrationFixResponse,
  resolveMigrationFixFromBaselineHtml,
  selectMigrationFixTarget,
  summarizeMigrationReportConvergence,
  shouldIgnoreMigrationRerunError,
  type MigrationCompareReport,
  type MigrationFix,
  type SelectedMigrationFixTarget,
} from "./migration-fix-loop-core.ts";
import { getArg, hasFlag } from "@mizchi/vlmkit-core/cli-args.ts";
import { handleCliError } from "@mizchi/vlmkit-core/cli-error.ts";

const REPORT_PATH = resolve(getArg("report", join(process.cwd(), "test-results", "migration", "migration-report.json")));
const VARIANT_FILTER = getArg("variant");
const OUTPUT_PATH = getArg("output");
const PROMPT_OUT = getArg("prompt-out");
const RESPONSE_FILE = getArg("response-file");
const MANUAL_SELECTOR = getArg("selector");
const MANUAL_PROPERTY = getArg("property");
const MANUAL_VALUE = getArg("value");
const MANUAL_MEDIA = getArg("media", "none");
const DRY_RUN = hasFlag("dry-run");
const NO_RERUN = hasFlag("no-rerun");
const IN_PLACE = hasFlag("in-place");
const PROPOSE_ONLY = hasFlag("propose-only");
const MAX_FIXES = Math.max(1, parseInt(getArg("max-fixes", "1"), 10) || 1);
const PROPOSALS_OUT = getArg("proposals-out");
const SUMMARY_OUT = getArg("summary-out");

async function main() {
  const report = JSON.parse(await readFile(REPORT_PATH, "utf-8")) as MigrationCompareReport;
  const convergence = summarizeMigrationReportConvergence(report);
  const target = selectMigrationFixTarget(report, { variant: VARIANT_FILTER || undefined });
  if (!target) {
    if (convergence.status !== "remaining") {
      console.log(`Report already converged: ${convergence.status}.`);
      process.exit(0);
    }
    console.error("No non-zero migration diff with fix candidates found.");
    process.exit(1);
  }

  const baselinePath = resolveSourcePath(report.dir, report.baseline);
  const variantPath = resolveSourcePath(report.dir, target.variantFile);
  let [baselineHtml, variantHtml] = await Promise.all([
    readFile(baselinePath, "utf-8"),
    readFile(variantPath, "utf-8"),
  ]);
  // Inline `<link rel="stylesheet" href="./local.css">` references so the
  // fix-loop's extractCss + apply pipeline works on a single inline `<style>`
  // block. Absolute / data: / protocol-relative hrefs are left alone.
  baselineHtml = await inlineExternalStylesheets(baselineHtml, dirname(baselinePath));
  variantHtml = await inlineExternalStylesheets(variantHtml, dirname(variantPath));
  const currentCss = extractCss(variantHtml);
  if (!currentCss) {
    console.error(`Could not find any <style> block in ${variantPath} (extractCss expects either <style id="target-css"> or a generic <style>...).`);
    process.exit(1);
  }

  const useMultiMode = PROPOSE_ONLY || MAX_FIXES > 1;
  const baselineIndex = useMultiMode
    ? buildBaselineValueIndex(report, target.variantFile)
    : null;
  const prompt = useMultiMode
    ? buildMigrationFixLoopMultiPrompt({
        baselineFile: basename(baselinePath),
        variantFile: basename(variantPath),
        target,
        currentCss,
        maxFixes: MAX_FIXES,
        baselineValueIndex: baselineIndex ?? undefined,
      })
    : buildMigrationFixLoopPrompt({
        baselineFile: basename(baselinePath),
        variantFile: basename(variantPath),
        target,
        currentCss,
      });

  if (PROMPT_OUT) {
    const promptPath = resolve(PROMPT_OUT);
    await mkdir(dirname(promptPath), { recursive: true });
    await writeFile(promptPath, prompt);
  }

  console.log();
  console.log(`Target: ${target.variantFile} @ ${target.viewport} (${target.viewportWidth}px)`);
  console.log(`Diff: ${(target.diffRatio * 100).toFixed(2)}% / ${target.diffPixels} px`);
  console.log(`Category: ${target.categorySummary}`);
  console.log(`Paint tree: ${target.paintTreeSummary}`);
  console.log(`Current convergence: ${convergence.status}`);

  if (useMultiMode) {
    // Deterministic step: CSS custom properties (e.g. `:root { --black }`)
    // don't appear in the report's computed-style diff (the resolved RGB
    // is what gets recorded), but baseline-vs-variant `:root` differences
    // affect every var() use site. Extract them straight from HTML and
    // prepend to the LLM proposals — no model call needed.
    const cssVarFixes = extractCustomPropertyDiffs(baselineHtml, variantHtml);
    if (cssVarFixes.length > 0) {
      console.log();
      console.log(`CSS variable diffs (deterministic): ${cssVarFixes.length}`);
      for (const fix of cssVarFixes.slice(0, 8)) {
        console.log(`  ! :root { ${fix.property}: ${fix.value}; }`);
      }
      if (cssVarFixes.length > 8) console.log(`  ... +${cssVarFixes.length - 8} more`);
    }
    const llmFixes = await resolveMultiFixes({ baselineHtml, prompt, target });
    const rawFixes = [...cssVarFixes, ...llmFixes];
    // Correct LLM proposals against the report's authoritative baseline
    // values. Prevents value hallucinations like `font: 800 48px/1` when
    // the report only knows specific computed sub-properties.
    const index = baselineIndex ?? buildBaselineValueIndex(report, target.variantFile);
    const correction = correctMigrationFixesWithReport(rawFixes, index, {
      viewport: target.viewport,
      currentCss,
    });
    if (correction.corrections.length > 0) {
      console.log();
      console.log(`Corrected ${correction.corrections.length} proposal value(s) using report baselines:`);
      for (const c of correction.corrections.slice(0, 5)) {
        console.log(`  ~ ${c.selector} { ${c.property} } ${c.from} → ${c.to}`);
      }
      if (correction.corrections.length > 5) {
        console.log(`  ... +${correction.corrections.length - 5} more`);
      }
    }
    const fixes = correction.fixes;
    if (PROPOSE_ONLY) {
      const payload = JSON.stringify({
        report: REPORT_PATH,
        variant: target.variantFile,
        viewport: target.viewport,
        viewportWidth: target.viewportWidth,
        diffRatio: target.diffRatio,
        proposals: fixes,
      }, null, 2);
      if (PROPOSALS_OUT) {
        const out = resolve(PROPOSALS_OUT);
        await mkdir(dirname(out), { recursive: true });
        await writeFile(out, `${payload}\n`);
        console.log();
        console.log(`Proposals: ${out} (${fixes.length} fix${fixes.length === 1 ? "" : "es"})`);
      } else {
        console.log();
        console.log(payload);
      }
      return;
    }

    if (fixes.length === 0) {
      console.log();
      console.log("No concrete fixes could be resolved automatically.");
      process.exit(0);
    }

    let workingHtml = variantHtml;
    const applied: MigrationFix[] = [];
    const skipped: MigrationFix[] = [];
    // Multi-fix lets the LLM propose media-gated fixes for blocks that
    // may not yet exist — allow appending new @media wrappers.
    for (const fix of fixes) {
      const nextHtml = applyMigrationFixToHtml(workingHtml, fix, { appendIfMissing: true });
      if (nextHtml === workingHtml) {
        skipped.push(fix);
        continue;
      }
      workingHtml = nextHtml;
      applied.push(fix);
    }

    console.log();
    console.log(`Multi-fix: ${applied.length}/${fixes.length} applied${skipped.length > 0 ? ` (${skipped.length} skipped — selector not in writable CSS)` : ""}`);
    for (const fix of applied) {
      console.log(`  + ${fix.selector} { ${fix.property}: ${fix.value}; }${fix.mediaCondition ? ` @media ${fix.mediaCondition}` : ""}`);
    }

    if (DRY_RUN || applied.length === 0) {
      if (DRY_RUN) console.log("Dry run: fixes were not written.");
      await writeSummary({
        target,
        proposals: rawFixes,
        corrections: correction.corrections,
        dropped: correction.dropped,
        applied,
        skipped,
        outputPath: null,
      });
      return;
    }

    const outputPath = resolveOutputPath(variantPath);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, workingHtml);
    console.log(`Wrote: ${outputPath}`);

    const afterByViewport = NO_RERUN
      ? null
      : await rerunCompare(report, baselinePath, outputPath);

    await writeSummary({
      target,
      proposals: rawFixes,
      corrections: correction.corrections,
      dropped: correction.dropped,
      applied,
      skipped,
      outputPath,
      afterByViewport,
      beforeByViewport: report.results.map((r) => ({ viewport: r.viewport, diffRatio: r.diffRatio })),
    });
    return;
  }

  // Single-fix path (legacy behaviour).
  const fix = await resolveFix({
    baselineHtml,
    prompt,
    target,
  });

  if (!fix) {
    console.log();
    console.log("No concrete fix could be resolved automatically.");
    if (!PROMPT_OUT) {
      console.log();
      console.log(prompt);
    } else {
      console.log(`Prompt: ${resolve(PROMPT_OUT)}`);
    }
    process.exit(0);
  }

  console.log();
  console.log(`Fix: ${fix.selector} { ${fix.property}: ${fix.value}; }${fix.mediaCondition ? ` @media ${fix.mediaCondition}` : ""}`);

  if (DRY_RUN) {
    console.log("Dry run: fix was not written.");
    return;
  }

  const nextHtml = applyMigrationFixToHtml(variantHtml, fix);
  if (nextHtml === variantHtml) {
    console.error("Resolved fix did not match any writable CSS rule in the current HTML.");
    process.exit(1);
  }

  const outputPath = resolveOutputPath(variantPath);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, nextHtml);
  console.log(`Wrote: ${outputPath}`);

  if (NO_RERUN) return;
  await rerunCompare(report, baselinePath, outputPath);
}

async function writeSummary(input: {
  target: SelectedMigrationFixTarget;
  proposals: MigrationFix[];
  corrections: Array<{ selector: string; property: string; from: string; to: string }>;
  dropped: Array<{ selector: string; property: string; reason: string }>;
  applied: MigrationFix[];
  skipped: MigrationFix[];
  outputPath: string | null;
  beforeByViewport?: Array<{ viewport: string; diffRatio: number }>;
  afterByViewport?: Array<{ viewport: string; diffRatio: number }> | null;
}): Promise<void> {
  if (!SUMMARY_OUT) return;
  const out = resolve(SUMMARY_OUT);
  await mkdir(dirname(out), { recursive: true });
  const payload: Record<string, unknown> = {
    target: {
      variantFile: input.target.variantFile,
      viewport: input.target.viewport,
      viewportWidth: input.target.viewportWidth,
      diffRatio: input.target.diffRatio,
      diffPixels: input.target.diffPixels,
      dominantCategory: input.target.dominantCategory,
    },
    counts: {
      proposed: input.proposals.length,
      corrected: input.corrections.length,
      dropped: input.dropped.length,
      applied: input.applied.length,
      skipped: input.skipped.length,
    },
    applied: input.applied,
    skipped: input.skipped,
    corrections: input.corrections,
    dropped: input.dropped,
    proposals: input.proposals,
    outputPath: input.outputPath,
  };
  if (input.beforeByViewport) payload.beforeByViewport = input.beforeByViewport;
  if (input.afterByViewport) payload.afterByViewport = input.afterByViewport;
  await writeFile(out, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`Summary: ${out}`);
}

async function rerunCompare(
  report: MigrationCompareReport,
  baselinePath: string,
  outputPath: string,
): Promise<Array<{ viewport: string; diffRatio: number }> | null> {
  const rerunOptions = buildRerunOptions(report, baselinePath, outputPath);
  console.log();
  console.log(`Rerun: in-process migration compare (${basename(baselinePath)} vs ${basename(outputPath)})`);
  try {
    const rerunReport = await runMigrationCompare(rerunOptions);
    const rerunConvergence = summarizeMigrationReportConvergence(rerunReport);
    console.log(`Convergence after rerun: ${rerunConvergence.status}`);
    const perViewport = rerunReport.results.map((r) => ({
      viewport: r.viewport,
      diffRatio: r.diffRatio,
    }));
    // Render a compact per-viewport summary so the operator sees the
    // before/after delta without grepping logs.
    const before = new Map(report.results.map((r) => [r.viewport, r.diffRatio]));
    console.log();
    console.log("Per-viewport diff (before → after):");
    for (const after of perViewport) {
      const b = before.get(after.viewport) ?? 0;
      const delta = after.diffRatio - b;
      const arrow = delta < -0.003 ? "↓" : delta > 0.003 ? "↑" : "≈";
      console.log(`  ${after.viewport.padEnd(12)} ${(b * 100).toFixed(2)}% → ${(after.diffRatio * 100).toFixed(2)}%  ${arrow}`);
    }
    return perViewport;
  } catch (error) {
    if (!shouldIgnoreMigrationRerunError(error)) throw error;
    console.log("Rerun skipped: Playwright browser launch is blocked in the current sandbox.");
    return null;
  }
}

async function resolveMultiFixes(input: {
  baselineHtml: string;
  prompt: string;
  target: SelectedMigrationFixTarget;
}): Promise<MigrationFix[]> {
  if (MANUAL_SELECTOR && MANUAL_PROPERTY && MANUAL_VALUE) {
    return [{
      selector: MANUAL_SELECTOR,
      property: MANUAL_PROPERTY,
      value: MANUAL_VALUE,
      mediaCondition: MANUAL_MEDIA === "none" ? null : MANUAL_MEDIA,
    }];
  }
  if (RESPONSE_FILE) {
    const raw = await readFile(resolve(RESPONSE_FILE), "utf-8");
    const parsedMulti = parseMigrationFixMultiResponse(raw);
    if (parsedMulti.length > 0) return parsedMulti;
    const single = parseMigrationFixResponse(raw);
    return single ? [single] : [];
  }
  const llm = createLLMProvider({ throwIfMissing: false });
  if (!llm || DRY_RUN) return [];
  const response = await llm.complete(input.prompt);
  return parseMigrationFixMultiResponse(response);
}

async function resolveFix(input: {
  baselineHtml: string;
  prompt: string;
  target: SelectedMigrationFixTarget;
}): Promise<MigrationFix | null> {
  if (MANUAL_SELECTOR && MANUAL_PROPERTY && MANUAL_VALUE) {
    return {
      selector: MANUAL_SELECTOR,
      property: MANUAL_PROPERTY,
      value: MANUAL_VALUE,
      mediaCondition: MANUAL_MEDIA === "none" ? null : MANUAL_MEDIA,
    };
  }

  if (RESPONSE_FILE) {
    return parseMigrationFixResponse(await readFile(resolve(RESPONSE_FILE), "utf-8"));
  }

  for (const candidate of input.target.fixCandidates) {
    const fix = resolveMigrationFixFromBaselineHtml(input.baselineHtml, candidate);
    if (fix) return fix;
  }

  const llm = createLLMProvider({ throwIfMissing: false });
  if (!llm || DRY_RUN) return null;
  const response = await llm.complete(input.prompt);
  return parseMigrationFixResponse(response);
}

function resolveSourcePath(dir: string | undefined, file: string): string {
  if (file.startsWith("/")) return file;
  return resolve(dir ?? ".", file);
}

function resolveOutputPath(variantPath: string): string {
  if (IN_PLACE) return variantPath;
  if (OUTPUT_PATH) return resolve(OUTPUT_PATH);
  const extension = variantPath.endsWith(".html") ? ".html" : "";
  const stem = extension ? basename(variantPath, extension) : basename(variantPath);
  return join(dirname(variantPath), `${stem}.fixloop${extension || ".html"}`);
}

function buildRerunOptions(
  report: MigrationCompareReport,
  baselinePath: string,
  variantPath: string,
): MigrationCompareOptions {
  return {
    dir: ".",
    baseline: baselinePath,
    variants: [variantPath],
    outputDir: join(process.cwd(), "test-results", "migration"),
    fixedViewports: report.viewports,
    autoDiscover: false,
    discoverBackend: "auto",
    maxViewports: report.viewports.length,
    randomSamples: 0,
    approvalPath: report.approvalPath ? resolveSourcePath(report.dir, report.approvalPath) : "",
    strict: report.strict ?? false,
    paintTreeUrl: report.paintTree?.url ?? "ws://127.0.0.1:9222",
    enablePaintTree: report.paintTree?.enabled ?? true,
  };
}

main().catch(handleCliError);
