#!/usr/bin/env node
/**
 * CSS Recovery Challenge -- Benchmark Runner
 *
 * Runs challenges across multiple seeds, measuring detection and recovery rates.
 * Multi-viewport (desktop + mobile) support. Results accumulated in JSONL.
 *
 * Usage:
 *   npx tsx src/css-challenge-bench.ts [--fixture page] [--trials 20] [--start-seed 1]
 *   npx tsx src/css-challenge-bench.ts --fixture all
 *   npx tsx src/css-challenge-bench.ts --approval approval.json --suggest-approval
 *   npx tsx src/css-challenge-bench.ts --backend prescanner
 *   npx tsx src/css-challenge-bench.ts --trials 30 --no-db
 *   npx tsx src/css-challenge-bench.ts --backend prescanner --no-llm
 *   ANTHROPIC_API_KEY=... npx tsx src/css-challenge-bench.ts --trials 10
 */
import { mkdir, rm, writeFile } from "node:fs/promises";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Browser } from "playwright";
import {
  collectApprovalWarnings,
  loadApprovalManifest,
  suggestApprovalRule,
  type ApprovalManifest,
  type ApprovalRule,
} from "../../vrt/snapshot/approval.ts";
import {
  parseCssDeclarations, removeCssProperty, removeSelectorBlock, groupBySelector, applyCssFix, normalizeValue,
  seededRandom, createBrowser, createCraterClient, capturePageState, capturePageStateCrater, analyzeVrtDiff,
  buildFixPrompt, parseLLMFix, categorizeProperty,
  extractCss, replaceCss,
  type CssDeclaration, type CapturedState, type TrialResult, type RenderBackend, type VrtAnalysis,
} from "./css-challenge-core.ts";
import { isCraterAvailable, type CraterClient } from "@mizchi/vlmkit-capture/crater-client.ts";
import {
  hasAnyBatchPrescanSignal,
  mutationsForPropertyRemoval,
  mutationsForSelectorBlockRemoval,
  runBatchPrescan,
  type BatchPrescanRequest,
} from "@mizchi/vlmkit-capture/batch-prescan.ts";
import {
  classifyDeclaration,
  classifyUndetectedReason,
  isInteractiveSelector,
  isOutOfScope,
  type ViewportDetectionResult,
} from "../detection/detection-classify.ts";
import { appendRecords, type DetectionRecord } from "../detection/detection-db.ts";
import { createLLMProvider } from "@mizchi/vlmkit-ai/llm-client.ts";
import { appendBenchHistory, buildBenchHistoryRecord } from "../benchmark/bench-history.ts";
import {
  CSS_BENCH_OUTPUT_ROOT,
  getCssBenchApprovalSuggestionsPath,
  getCssBenchFixtureOutputDir,
  getCssChallengeFixturePath,
  listCssChallengeFixtureNames,
  normalizeCssChallengeFixtureSelection,
} from "./css-challenge-fixtures.ts";
import {
  buildCustomPropertyUsageIndex,
  collectComputedStyleTrackingProperties,
  findExpectedComputedStyleTargets,
  mergeComputedStyleProperties,
  type ComputedStyleTarget,
} from "./css-custom-properties.ts";
import { TRACKED_PROPERTIES } from "@mizchi/vlmkit-core/computed-style-capture.ts";
import { formatPlaywrightLaunchError, isPlaywrightSandboxRestrictionError } from "@mizchi/vlmkit-capture/playwright-launch-error.ts";
import {
  hasAnyDetectionSignal,
  hasCraterPrescanSignal,
  resolvePrescannerTrial,
  summarizePrescannerTrials,
  type PrescannerTrialResolution,
} from "@mizchi/vlmkit-capture/prescanner.ts";
import { DIM, RESET, GREEN, RED, YELLOW, CYAN, BOLD, hr } from "@mizchi/vlmkit-core/terminal-colors.ts";
import { getRawArgs } from "@mizchi/vlmkit-core/cli-args.ts";
import { hasFlag, readAll, readFlag, readInt } from "@mizchi/vlmkit-core/arg-reader.ts";
import { handleCliError } from "@mizchi/vlmkit-core/cli-error.ts";

// ---- Config ----

type BenchBackend = RenderBackend | "prescanner";
export type ChallengeMode = "property" | "selector";

export interface CssChallengeBenchCliOptions {
  trials: number;
  startSeed: number;
  saveDb: boolean;
  fixtureArgs: string[];
  backend: BenchBackend;
  approvalPath: string;
  strict: boolean;
  suggestApproval: boolean;
  outputRoot: string;
  mode: ChallengeMode;
  enableLlm: boolean;
}

/**
 * A fourth hand-rolled copy of the same reader used to live here, and this one
 * fed the bench's own `trials` / `start-seed`: `--trials abc` became `NaN`
 * trials, i.e. a benchmark reporting numbers from a loop that never ran the
 * requested count. It now goes through `arg-reader`, which rejects that.
 */
export function parseCssChallengeBenchArgs(cliArgs: string[]): CssChallengeBenchCliOptions {
  const str = (name: string, fallback: string): string => readFlag(cliArgs, name) || fallback;
  return {
    trials: readInt(cliArgs, "trials", { min: 1 }) ?? 20,
    startSeed: readInt(cliArgs, "start-seed", { min: 0 }) ?? 1,
    saveDb: !hasFlag(cliArgs, "no-db"),
    fixtureArgs: readAll(cliArgs, "fixture"),
    backend: str("backend", "chromium") as BenchBackend,
    approvalPath: str("approval", ""),
    strict: hasFlag(cliArgs, "strict"),
    suggestApproval: hasFlag(cliArgs, "suggest-approval"),
    outputRoot: str("output-root", CSS_BENCH_OUTPUT_ROOT),
    mode: str("mode", "property") as ChallengeMode,
    enableLlm: !hasFlag(cliArgs, "no-llm"),
  };
}

const CLI_OPTIONS = parseCssChallengeBenchArgs(getRawArgs());
const TRIALS = CLI_OPTIONS.trials;
const START_SEED = CLI_OPTIONS.startSeed;
const SAVE_DB = CLI_OPTIONS.saveDb;
const FIXTURE_ARGS = CLI_OPTIONS.fixtureArgs;
const BACKEND = CLI_OPTIONS.backend;
const APPROVAL_PATH = CLI_OPTIONS.approvalPath;
const STRICT = CLI_OPTIONS.strict;
const SUGGEST_APPROVAL = CLI_OPTIONS.suggestApproval;
const OUTPUT_ROOT = CLI_OPTIONS.outputRoot;
const MODE = CLI_OPTIONS.mode;
const ENABLE_LLM = CLI_OPTIONS.enableLlm;

const BASE_VIEWPORTS = [
  { width: 1440, height: 900, label: "wide" },
  { width: 1280, height: 900, label: "desktop" },
  { width: 375, height: 812, label: "mobile" },
];

// Dynamically expanded with breakpoint discovery (populated per fixture)
let VIEWPORTS = [...BASE_VIEWPORTS];

interface ViewportAnalysisBundle {
  viewportResults: ViewportDetectionResult[];
  primaryAnalysis: VrtAnalysis | null;
  anyVisual: boolean;
  anyA11y: boolean;
  anyComputed: boolean;
  anyHover: boolean;
  anyPaintTree: boolean;
  maxDiffRatio: number;
  maxDiffPixels: number;
  totalA11yChanges: number;
  detected: boolean;
}

/**
 * Synthesize a metadata-only `ViewportAnalysisBundle` from a paint-tree
 * signal that fired at a single representative viewport via batchRender.
 * Other viewports are emitted as `visualCaptureSkipped: true` so the
 * prescanner summary records them as metadata-only crater wins rather
 * than silent false-negatives.
 */
function buildBatchPrescanBundle(
  viewports: Array<{ width: number; height: number; label: string }>,
  fastViewport: { width: number; height: number; label: string },
  paintTreeDiffCount: number,
): ViewportAnalysisBundle {
  const viewportResults: ViewportDetectionResult[] = viewports.map((vp) => ({
    width: vp.width,
    height: vp.height,
    visualDiffDetected: false,
    visualDiffRatio: 0,
    a11yDiffDetected: false,
    a11yChangeCount: 0,
    computedStyleDiffCount: 0,
    hoverDiffDetected: false,
    paintTreeDiffCount: vp.label === fastViewport.label ? paintTreeDiffCount : 0,
    visualCaptureSkipped: true,
  }));
  return {
    viewportResults,
    primaryAnalysis: null,
    anyVisual: false,
    anyA11y: false,
    anyComputed: false,
    anyHover: false,
    anyPaintTree: true,
    maxDiffRatio: 0,
    maxDiffPixels: 0,
    totalA11yChanges: 0,
    detected: true,
  };
}

async function captureStateForBackend(
  backend: RenderBackend,
  viewport: { width: number; height: number; label: string },
  html: string,
  screenshotPath: string,
  options: {
    browser: Browser | null;
    craterClient: CraterClient | null;
    captureHover: boolean;
    trackedProperties: string[];
    interactionSelectors?: string[];
    skipScreenshot?: boolean;
  },
): Promise<CapturedState> {
  if (backend === "crater") {
    if (!options.craterClient) throw new Error("Crater client is not initialized");
    return capturePageStateCrater(options.craterClient, viewport, html, screenshotPath, {
      trackedProperties: options.trackedProperties,
      captureHover: options.captureHover,
      interactionSelectors: options.interactionSelectors,
      skipScreenshot: options.skipScreenshot,
    });
  }
  if (!options.browser) throw new Error("Chromium browser is not initialized");
  return capturePageState(options.browser, viewport, html, screenshotPath, {
    captureHover: options.captureHover,
    trackedProperties: options.trackedProperties,
    interactionSelectors: options.interactionSelectors,
  });
}

async function analyzeAcrossViewports(
  backend: RenderBackend,
  html: string,
  trialDir: string,
  baselines: Map<string, CapturedState>,
  options: {
    browser: Browser | null;
    craterClient: CraterClient | null;
    captureHover: boolean;
    trackedProperties: string[];
    manifest: ApprovalManifest | null;
    approvalContext: { selector: string; property: string; category: ReturnType<typeof categorizeProperty> };
    expectedComputedStyleTargets: ComputedStyleTarget[];
    strict: boolean;
    skipScreenshot?: boolean;
  },
): Promise<ViewportAnalysisBundle> {
  const viewportResults: ViewportDetectionResult[] = [];
  let anyVisual = false;
  let anyA11y = false;
  let maxDiffRatio = 0;
  let maxDiffPixels = 0;
  let totalA11yChanges = 0;
  let primaryAnalysis: VrtAnalysis | null = null;
  let anyComputed = false;
  let anyHover = false;
  let anyPaintTree = false;
  const interactionSelectors = [...new Set([
    options.approvalContext.selector,
    ...options.expectedComputedStyleTargets.map((target) => target.selector),
  ])];

  for (const viewport of VIEWPORTS) {
    const brokenPath = join(trialDir, `${backend}-broken-${viewport.label}.png`);
    const brokenState = await captureStateForBackend(backend, viewport, html, brokenPath, {
        browser: options.browser,
        craterClient: options.craterClient,
        captureHover: options.captureHover,
        trackedProperties: options.trackedProperties,
        interactionSelectors,
        skipScreenshot: options.skipScreenshot,
      });
    const baseline = baselines.get(viewport.label);
    if (!baseline) throw new Error(`Missing ${backend} baseline for viewport ${viewport.label}`);

    const analysis = await analyzeVrtDiff(baseline, brokenState, trialDir, {
      manifest: options.manifest,
      context: options.approvalContext,
      strict: options.strict,
      expectedComputedStyleTargets: options.expectedComputedStyleTargets,
    }, { skipHeatmap: true });

    const visualDiffDetected = (analysis.vrtDiff?.diffPixels ?? 0) > 0;
    const paintTreeDiffCount = analysis.paintTreeChanges.length;
    // In selector mode, use all computed style diffs (tracked targets filter is unreliable for multi-property deletion)
    const computedStyleDiffCount = MODE === "selector"
      ? analysis.computedStyleDiffs.length
      : (analysis.trackedComputedStyleTargets.length > 0
        ? analysis.referencedComputedStyleDiffs.length
        : analysis.computedStyleDiffs.length);

    const visualCaptureSkipped =
      brokenState.visualCaptureSkipped === true || baseline.visualCaptureSkipped === true;

    viewportResults.push({
      width: viewport.width,
      height: viewport.height,
      visualDiffDetected,
      visualDiffRatio: analysis.vrtDiff?.diffRatio ?? 0,
      a11yDiffDetected: analysis.a11yDiff.changes.length > 0,
      a11yChangeCount: analysis.a11yDiff.changes.length,
      computedStyleDiffCount,
      hoverDiffDetected: analysis.hoverDiffDetected,
      paintTreeDiffCount,
      ...(visualCaptureSkipped ? { visualCaptureSkipped: true } : {}),
    });

    if (visualDiffDetected) anyVisual = true;
    if (analysis.a11yDiff.changes.length > 0) anyA11y = true;
    if (computedStyleDiffCount > 0) anyComputed = true;
    if (analysis.hoverDiffDetected) anyHover = true;
    if (paintTreeDiffCount > 0) anyPaintTree = true;
    if ((analysis.vrtDiff?.diffRatio ?? 0) > maxDiffRatio) maxDiffRatio = analysis.vrtDiff?.diffRatio ?? 0;
    if ((analysis.vrtDiff?.diffPixels ?? 0) > maxDiffPixels) maxDiffPixels = analysis.vrtDiff?.diffPixels ?? 0;
    totalA11yChanges += analysis.a11yDiff.changes.length;

    if (viewport.label === "desktop") {
      primaryAnalysis = analysis;
    }
  }

  return {
    viewportResults,
    primaryAnalysis,
    anyVisual,
    anyA11y,
    anyComputed,
    anyHover,
    anyPaintTree,
    maxDiffRatio,
    maxDiffPixels,
    totalA11yChanges,
    detected: hasAnyDetectionSignal(viewportResults),
  };
}

// ---- Main ----

async function runFixtureBenchmark(fixture: string) {
  const fixturePath = getCssChallengeFixturePath(fixture);
  const tmpDir = getCssBenchFixtureOutputDir(fixture, OUTPUT_ROOT);
  await mkdir(tmpDir, { recursive: true });

  const htmlRaw = await readFile(fixturePath, "utf-8");
  const originalCss = extractCss(htmlRaw);
  if (!originalCss) { console.error("CSS not found"); process.exit(1); }

  const declarations = parseCssDeclarations(originalCss);
  const selectorBlocks = groupBySelector(declarations);
  const customPropertyUsage = buildCustomPropertyUsageIndex(declarations);

  // Spin up Crater early when we'll be using it, so viewport discovery can
  // call its v0.18.0 intelligence APIs against the loaded baseline.
  let craterClient: CraterClient | null = null;
  if (BACKEND === "crater" || BACKEND === "prescanner") {
    if (!await isCraterAvailable()) {
      console.log(`  ${RED}Crater BiDi server not available at ws://127.0.0.1:9222${RESET}`);
      console.log(`  ${DIM}Start it: cd ~/ghq/github.com/mizchi/crater && just build-bidi && just start-bidi-with-font${RESET}`);
      process.exit(1);
    }
    craterClient = await createCraterClient();
    // Load the baseline HTML at a representative width so the viewport
    // intelligence APIs see real CSS rules and matching elements.
    await craterClient.setViewport(1280, 900);
    await craterClient.setContent(htmlRaw);
  }

  // Discover breakpoints and expand viewports. When Crater is available,
  // prefer its v0.18.0 viewport intelligence (`getRequiredTestViewports` +
  // `getCssRuleViewportMap`) and fall back to regex for any widths Crater
  // didn't surface.
  const { discoverViewportsWithBackend } = await import("@mizchi/vlmkit-capture/viewport-discovery.ts");
  const discovery = await discoverViewportsWithBackend(htmlRaw, {
    maxViewports: 10,
    randomSamples: 0,
    includeStandard: false,
    craterClient: craterClient ?? undefined,
  });
  const existingWidths = new Set(BASE_VIEWPORTS.map((v) => v.width));
  const extraViewports = discovery.viewports
    .filter((v) => !existingWidths.has(v.width))
    .map((v) => ({ width: v.width, height: 900, label: v.label }));
  VIEWPORTS = [...BASE_VIEWPORTS, ...extraViewports];
  if (extraViewports.length > 0) {
    console.log(
      `  ${DIM}Breakpoint discovery (${discovery.backend}): +${extraViewports.length} viewport(s): ${extraViewports.map((v) => `${v.label}(${v.width})`).join(", ")}${RESET}`,
    );
  }
  const trackedProperties = mergeComputedStyleProperties(
    TRACKED_PROPERTIES,
    collectComputedStyleTrackingProperties(declarations),
  );
  const interactionSelectors = [...new Set(
    declarations
      .map((declaration) => declaration.selector)
      .filter(isInteractiveSelector),
  )];
  const llm = ENABLE_LLM ? createLLMProvider({ throwIfMissing: false }) : null;
  const approvalManifest = APPROVAL_PATH ? await loadApprovalManifest(APPROVAL_PATH) : null;
  const approvalWarnings = approvalManifest ? collectApprovalWarnings(approvalManifest) : [];

  console.log();
  console.log(`${BOLD}${CYAN}╔═══════════════════════════════════════════════════════════════════════════╗${RESET}`);
  console.log(`${BOLD}${CYAN}║  CSS Recovery Challenge — Benchmark                                     ║${RESET}`);
  console.log(`${BOLD}${CYAN}╚═══════════════════════════════════════════════════════════════════════════╝${RESET}`);
  console.log(`  ${DIM}Fixture: ${fixture} | Mode: ${MODE} | Trials: ${TRIALS} | Declarations: ${declarations.length} | Selectors: ${selectorBlocks.length}${RESET}`);
  console.log(`  ${DIM}Backend: ${BACKEND} | Viewports: ${VIEWPORTS.map((v) => `${v.label}(${v.width}x${v.height})`).join(", ")}${RESET}`);
  console.log(`  ${DIM}LLM: ${llm ? "enabled" : "disabled"} | DB: ${SAVE_DB ? "enabled" : "disabled"}${RESET}`);
  if (approvalManifest) {
    console.log(`  ${DIM}Approval: ${APPROVAL_PATH}${STRICT ? " (strict mode: ignored)" : ""}${RESET}`);
    for (const warning of approvalWarnings) {
      console.log(`  ${YELLOW}! ${warning.message}${RESET}`);
    }
  }
  if (SUGGEST_APPROVAL) {
    console.log(`  ${DIM}Approval suggestions: enabled${RESET}`);
  }
  console.log();

  let browser: Browser | null = null;
  const chromiumBaselines = new Map<string, CapturedState>();
  const craterBaselines = new Map<string, CapturedState>();

  async function ensureChromiumResources(): Promise<{ browser: Browser; baselines: Map<string, CapturedState> }> {
    if (!browser) {
      ({ browser } = await createBrowser());
    }
    for (const viewport of VIEWPORTS) {
      if (chromiumBaselines.has(viewport.label)) continue;
      const path = join(tmpDir, `baseline-chromium-${viewport.label}.png`);
      chromiumBaselines.set(
        viewport.label,
        await capturePageState(browser, viewport, htmlRaw, path, {
          captureHover: true,
          trackedProperties,
          interactionSelectors,
        }),
      );
    }
    return { browser, baselines: chromiumBaselines };
  }

  if (BACKEND === "chromium") {
    await ensureChromiumResources();
  }
  if ((BACKEND === "crater" || BACKEND === "prescanner") && craterClient) {
    for (const viewport of VIEWPORTS) {
      const path = join(tmpDir, `baseline-crater-${viewport.label}.png`);
      craterBaselines.set(
        viewport.label,
        await capturePageStateCrater(craterClient, viewport, htmlRaw, path, {
          trackedProperties,
          captureHover: interactionSelectors.length > 0,
          interactionSelectors,
          skipScreenshot: BACKEND === "prescanner",
        }),
      );
    }
  }

  const results: TrialResult[] = [];
  const dbRecords: DetectionRecord[] = [];
  const approvalSuggestions: ApprovalRule[] = [];
  const prescannerResolutions: PrescannerTrialResolution[] = [];
  const runId = new Date().toISOString();
  const startTime = Date.now();

  const shuffledProps = shuffleWithSeed(declarations, START_SEED);
  const shuffledBlocks = shuffleWithSeed(selectorBlocks, START_SEED);

  // ---- Optional multi-trial batchRender pre-pass ----
  //
  // `VLMKIT_BATCH_PRESCAN=1`  → single-trial fast path (handled inline)
  // `VLMKIT_BATCH_PRESCAN=K`  → pre-render K trials per Crater call and
  //                            short-circuit the per-viewport loop on
  //                            paint-tree signal. K=0 disables.
  //
  // The pre-pass renders ALL trials at the representative viewport in
  // chunks of K, so the speedup is roughly N × (per-viewport setContent
  // time) per detected trial. Silent trials still fall through to the
  // existing crater capture so computed-style / forced-state can fire.
  const batchPrescanEnv = process.env.VLMKIT_BATCH_PRESCAN;
  const batchPrescanSize = batchPrescanEnv === undefined
    ? 0
    : Math.max(0, Number.parseInt(batchPrescanEnv, 10) || 0);
  const batchPrescanResults = new Map<number, ReturnType<typeof buildBatchPrescanBundle>>();
  let batchPrescanRepresentativeViewport: typeof VIEWPORTS[number] | null = null;
  if (
    batchPrescanSize >= 1
    && BACKEND === "prescanner"
    && craterClient
    && craterBaselines.size > 0
  ) {
    batchPrescanRepresentativeViewport = VIEWPORTS[Math.floor(VIEWPORTS.length / 2)];
    const baseline = craterBaselines.get(batchPrescanRepresentativeViewport.label);
    if (baseline?.paintTree && batchPrescanSize >= 2) {
      // Build trial plans for every trial so we can chunk-batch them.
      type TrialPlan = {
        seed: number;
        request: BatchPrescanRequest;
      };
      const plans: TrialPlan[] = [];
      for (let i = 0; i < TRIALS; i++) {
        const seed = START_SEED + i;
        let selector: string;
        let propertyNames: string[];
        if (MODE === "selector") {
          const block = shuffledBlocks[i % shuffledBlocks.length];
          selector = block.declarations[0]?.selector ?? "";
          propertyNames = block.declarations.map((d) => d.property);
        } else {
          const decl = shuffledProps[i % shuffledProps.length];
          selector = decl.selector;
          propertyNames = [decl.property];
        }
        if (!selector || propertyNames.length === 0) continue;
        const mutations = propertyNames.length === 1
          ? mutationsForPropertyRemoval(selector, propertyNames[0])
          : mutationsForSelectorBlockRemoval(selector, propertyNames);
        plans.push({ seed, request: { id: `trial-${seed}`, mutations } });
      }

      const fastViewport = batchPrescanRepresentativeViewport;
      console.log(
        `  ${DIM}Batch prescan: ${plans.length} trial(s) in chunks of ${batchPrescanSize} @ ${fastViewport.label}(${fastViewport.width})${RESET}`,
      );
      const batchStart = Date.now();
      let chunksRun = 0;
      let signalsFound = 0;
      try {
        for (let offset = 0; offset < plans.length; offset += batchPrescanSize) {
          const chunk = plans.slice(offset, offset + batchPrescanSize);
          const batch = await runBatchPrescan(
            craterClient,
            htmlRaw,
            { width: fastViewport.width, height: fastViewport.height },
            baseline.paintTree,
            chunk.map((p) => p.request),
          );
          chunksRun++;
          for (let j = 0; j < chunk.length; j++) {
            const plan = chunk[j];
            const result = batch[j];
            if (!result || result.missing || result.changes.length === 0) continue;
            const bundle = buildBatchPrescanBundle(VIEWPORTS, fastViewport, result.changes.length);
            batchPrescanResults.set(plan.seed, bundle);
            signalsFound++;
          }
        }
        const elapsedMs = Date.now() - batchStart;
        console.log(
          `  ${DIM}Batch prescan: ${signalsFound}/${plans.length} trials short-circuited (${chunksRun} chunk(s), ${elapsedMs}ms)${RESET}`,
        );
      } catch (error) {
        console.log(
          `  ${YELLOW}Batch prescan failed, falling back per trial: ${error instanceof Error ? error.message : String(error)}${RESET}`,
        );
        batchPrescanResults.clear();
      }
    }
  }

  for (let i = 0; i < TRIALS; i++) {
    const seed = START_SEED + i;

    // Select what to remove based on mode
    let removed: CssDeclaration;
    let brokenCss: string;
    let trialLabel: string;

    if (MODE === "selector") {
      const block = shuffledBlocks[i % shuffledBlocks.length];
      removed = block.declarations[0]; // Use first declaration for classification
      brokenCss = removeSelectorBlock(originalCss, block);
      trialLabel = `${block.selector} { ${block.declarations.length} props }`;
    } else {
      removed = shuffledProps[i % shuffledProps.length];
      brokenCss = removeCssProperty(originalCss, removed);
      trialLabel = `${removed.selector} { ${removed.property} }`;
    }

    const trialDir = join(tmpDir, `trial-${seed}`);
    await mkdir(trialDir, { recursive: true });

    process.stdout.write(`  [${String(i + 1).padStart(3)}/${TRIALS}] seed=${seed} ${trialLabel} ... `);
    const brokenHtml = replaceCss(htmlRaw, originalCss, brokenCss);
    const classified = classifyDeclaration(removed.selector, removed.mediaCondition);
    const approvalContext = {
      selector: removed.selector,
      property: removed.property,
      category: categorizeProperty(removed.property),
    } as const;
    // In selector mode, track computed styles for ALL declarations in the block
    const removedDeclarations = MODE === "selector"
      ? (shuffledBlocks[i % shuffledBlocks.length]?.declarations ?? [removed])
      : [removed];
    const expectedComputedStyleTargets = removedDeclarations.flatMap(
      (d) => findExpectedComputedStyleTargets(d, customPropertyUsage),
    );
    const captureHover = classified.isInteractive ||
      expectedComputedStyleTargets.some((target) => isInteractiveSelector(target.selector));

    let analysisBundle: ViewportAnalysisBundle;
    let prescannerResolution: PrescannerTrialResolution | null = null;

    if (BACKEND === "prescanner") {
      // batchRender fast-path. Two modes share a single result store:
      //   - K=1 → render this trial only, inline
      //   - K>=2 → consult the pre-pass map populated above
      // Either way, a non-empty paint-tree diff at the representative
      // viewport synthesizes a metadata-only bundle covering every
      // viewport and short-circuits the per-viewport setContent loop.
      let batchSignalBundle: ViewportAnalysisBundle | null = batchPrescanResults.get(seed) ?? null;
      if (
        !batchSignalBundle
        && batchPrescanSize === 1
        && craterClient
        && craterBaselines.size > 0
      ) {
        const fastViewport = VIEWPORTS[Math.floor(VIEWPORTS.length / 2)];
        const baseline = craterBaselines.get(fastViewport.label);
        if (baseline?.paintTree) {
          const mutations = MODE === "selector"
            ? mutationsForSelectorBlockRemoval(
              removed.selector,
              removedDeclarations.map((d) => d.property),
            )
            : mutationsForPropertyRemoval(removed.selector, removed.property);
          const request: BatchPrescanRequest = { id: `trial-${seed}`, mutations };
          try {
            const batch = await runBatchPrescan(
              craterClient,
              htmlRaw,
              { width: fastViewport.width, height: fastViewport.height },
              baseline.paintTree,
              [request],
            );
            if (hasAnyBatchPrescanSignal(batch)) {
              batchSignalBundle = buildBatchPrescanBundle(VIEWPORTS, fastViewport, batch[0]!.changes.length);
            }
          } catch { /* fall through to per-viewport capture */ }
        }
      }

      const craterBundle = batchSignalBundle
        ?? await analyzeAcrossViewports("crater", brokenHtml, trialDir, craterBaselines, {
          browser: null,
          craterClient,
          captureHover,
          trackedProperties,
          manifest: approvalManifest,
          approvalContext,
          expectedComputedStyleTargets,
          strict: STRICT,
          skipScreenshot: true,
        });

      if (hasCraterPrescanSignal(craterBundle.viewportResults)) {
        prescannerResolution = resolvePrescannerTrial(craterBundle.viewportResults, craterBundle.viewportResults);
        analysisBundle = craterBundle;
      } else {
        const chromiumResources = await ensureChromiumResources();
        const chromiumBundle = await analyzeAcrossViewports("chromium", brokenHtml, trialDir, chromiumResources.baselines, {
          browser: chromiumResources.browser,
          craterClient: null,
          captureHover,
          trackedProperties,
          manifest: approvalManifest,
          approvalContext,
          expectedComputedStyleTargets,
          strict: STRICT,
        });
        prescannerResolution = resolvePrescannerTrial(craterBundle.viewportResults, chromiumBundle.viewportResults);
        analysisBundle = chromiumBundle;
      }

      prescannerResolutions.push(prescannerResolution);
    } else {
      const activeBackend = BACKEND;
      const baselines = activeBackend === "crater" ? craterBaselines : (await ensureChromiumResources()).baselines;
      analysisBundle = await analyzeAcrossViewports(activeBackend, brokenHtml, trialDir, baselines, {
        browser,
        craterClient,
        captureHover,
        trackedProperties,
        manifest: approvalManifest,
        approvalContext,
        expectedComputedStyleTargets,
        strict: STRICT,
      });
    }

    const vpResults = analysisBundle.viewportResults;
    const primaryAnalysis = analysisBundle.primaryAnalysis;
    const anyVisual = analysisBundle.anyVisual;
    const anyA11y = analysisBundle.anyA11y;
    const anyComputed = analysisBundle.anyComputed;
    const anyHover = analysisBundle.anyHover;
    const anyPaintTree = analysisBundle.anyPaintTree;
    const maxDiffRatio = analysisBundle.maxDiffRatio;
    const maxDiffPixels = analysisBundle.maxDiffPixels;
    const totalA11yChanges = analysisBundle.totalA11yChanges;
    const detected = prescannerResolution?.finalDetected ?? analysisBundle.detected;

    const result: TrialResult = {
      seed,
      removed,
      visualDiffDetected: anyVisual,
      visualDiffRatio: maxDiffRatio,
      visualChangeTypes: primaryAnalysis?.visualSemantic?.changes.map((c) => c.type) ?? [],
      a11yDiffDetected: anyA11y,
      a11yChangeCount: totalA11yChanges,
      newA11yIssues: primaryAnalysis ? Math.max(0, primaryAnalysis.brokenIssueCount - primaryAnalysis.baselineIssueCount) : 0,
      llmAttempted: false,
      llmFixParsed: false,
      selectorMatch: false,
      propertyMatch: false,
      valueMatch: false,
      exactMatch: false,
      pixelPerfect: false,
      nearPerfect: false,
      fixedDiffRatio: -1,
      attempts: 0,
      llmMs: 0,
      fallbackUsed: prescannerResolution?.fallbackUsed ?? false,
      resolvedBy: prescannerResolution?.resolvedBy ?? (BACKEND === "chromium" ? "chromium" : "crater"),
    };

    // LLM fix attempt (desktop viewport)
    if (llm && primaryAnalysis) {
      result.llmAttempted = true;
      const prompt = buildFixPrompt(primaryAnalysis.fullReport, brokenCss);
      const llmStart = Date.now();
      try {
        const response = await llm.complete(prompt);
        result.llmMs = Date.now() - llmStart;
        const fix = parseLLMFix(response);
        result.attempts = 1;
        if (fix) {
          result.llmFixParsed = true;
          result.selectorMatch = fix.selector === removed.selector;
          result.propertyMatch = fix.property === removed.property;
          result.valueMatch = normalizeValue(fix.value) === normalizeValue(removed.value);
          result.exactMatch = result.selectorMatch && result.propertyMatch && result.valueMatch;

          const fixedCss = applyCssFix(brokenCss, fix);
          const fixedHtml = replaceCss(htmlRaw, originalCss, fixedCss);
          const fixedPath = join(trialDir, "fixed.png");
          const chromiumResources = await ensureChromiumResources();
          const desktopVp = VIEWPORTS[0];
          await capturePageState(chromiumResources.browser, desktopVp, fixedHtml, fixedPath, {
            trackedProperties,
          });
          const { compareScreenshots } = await import("@mizchi/vlmkit-core/heatmap.ts");
          const fixedDiff = await compareScreenshots({
            testId: "page", testTitle: "page", projectName: "css-challenge",
            screenshotPath: fixedPath,
            baselinePath: chromiumResources.baselines.get("desktop")!.screenshotPath,
            status: "changed",
          }, { outputDir: trialDir });
          result.fixedDiffRatio = fixedDiff?.diffRatio ?? 0;
          result.pixelPerfect = result.fixedDiffRatio === 0;
          result.nearPerfect = result.fixedDiffRatio < 0.01;
        }
      } catch {
        result.llmMs = Date.now() - llmStart;
      }
    }

    results.push(result);

    if (SUGGEST_APPROVAL && primaryAnalysis) {
      approvalSuggestions.push(suggestApprovalRule({
        selector: removed.selector,
        property: removed.property,
        category: approvalContext.category,
        maxDiffPixels,
        maxDiffRatio,
        paintTreeChanges: primaryAnalysis.paintTreeChanges,
      }));
    }

    // Build detection record
    const undetectedReason = detected
      ? null
      : classifyUndetectedReason(removed.selector, removed.property, removed.value, removed.mediaCondition, vpResults);

    dbRecords.push({
      runId,
      fixture,
      backend: BACKEND,
      fallbackUsed: result.fallbackUsed,
      backendResolvedBy: result.resolvedBy,
      selector: removed.selector,
      property: removed.property,
      value: removed.value,
      category: categorizeProperty(removed.property),
      selectorType: classified.selectorType,
      isInteractive: classified.isInteractive,
      mediaCondition: removed.mediaCondition,
      viewports: vpResults,
      detected,
      undetectedReason,
    });

    // Status line
    const status: string[] = [];
    if (prescannerResolution) {
      if (prescannerResolution.resolvedBy === "crater") status.push(`${CYAN}prescan${RESET}`);
      else if (prescannerResolution.resolvedBy === "chromium") status.push(`${YELLOW}fallback${RESET}`);
      else status.push(`${YELLOW}fallback-pass${RESET}`);
    }
    for (const vr of vpResults) {
      const label = vr.width >= 1440 ? "W" : vr.width > 500 ? "D" : "M";
      if (vr.visualDiffDetected) status.push(`${label}:${(vr.visualDiffRatio * 100).toFixed(0)}%`);
      else status.push(`${label}:-`);
    }
    if (result.a11yDiffDetected) status.push(`a11y:${result.a11yChangeCount}`);
    if (anyComputed && !anyVisual) status.push(`${CYAN}css-diff${RESET}`);
    if (anyHover && !anyVisual) status.push(`${CYAN}hover${RESET}`);
    if (anyPaintTree && !anyVisual) status.push(`${CYAN}paint-tree${RESET}`);
    if (primaryAnalysis && (primaryAnalysis.approvedVisualRules.length > 0 || primaryAnalysis.approvedPaintTreeMatches.length > 0)) {
      status.push(`${CYAN}approved${RESET}`);
    }
    if (!detected) status.push(`${RED}silent${RESET}${undetectedReason ? `(${undetectedReason})` : ""}`);
    if (result.llmAttempted) {
      if (result.exactMatch) status.push(`${GREEN}exact${RESET}`);
      else if (result.pixelPerfect) status.push(`${GREEN}pixel-ok${RESET}`);
      else if (result.selectorMatch) status.push(`${YELLOW}partial${RESET}`);
      else status.push(`${RED}miss${RESET}`);
    }
    console.log(status.join(" | "));

    await rm(trialDir, { recursive: true, force: true }).catch(() => {});
  }

  // Cleanup resources
  if (craterClient != null) {
    await (craterClient as CraterClient).close();
  }
  if (browser != null) {
    await (browser as Browser).close();
  }
  const elapsedMs = Date.now() - startTime;
  const elapsed = (elapsedMs / 1000).toFixed(1);

  // ============================================================
  // Report
  // ============================================================
  console.log();
  hr();
  console.log();
  console.log(`  ${BOLD}${CYAN}Benchmark Results${RESET}  ${DIM}(${TRIALS} trials, ${elapsed}s, ${VIEWPORTS.length} viewports)${RESET}`);
  console.log();

  // Detection metrics
  const visualDetected = results.filter((r) => r.visualDiffDetected).length;
  const a11yDetected = results.filter((r) => r.a11yDiffDetected).length;
  const eitherDetected = dbRecords.filter((r) => r.detected).length;
  const neitherDetected = dbRecords.filter((r) => !r.detected).length;

  const computedDetected = dbRecords.filter((r) => r.viewports.some((v) => v.computedStyleDiffCount > 0)).length;
  const hoverDetected = dbRecords.filter((r) => r.viewports.some((v) => v.hoverDiffDetected)).length;
  const paintTreeDetected = dbRecords.filter((r) => r.viewports.some((v) => v.paintTreeDiffCount > 0)).length;
  const prescannerSummary = BACKEND === "prescanner"
    ? summarizePrescannerTrials(prescannerResolutions)
    : null;

  console.log(`  ${BOLD}Detection${RESET}`);
  console.log(`    Visual diff:           ${fmtRate(visualDetected, TRIALS)}`);
  console.log(`    Computed style diff:   ${fmtRate(computedDetected, TRIALS)}`);
  console.log(`    Hover diff:            ${fmtRate(hoverDetected, TRIALS)}`);
  if (paintTreeDetected > 0 || BACKEND === "crater" || BACKEND === "prescanner") {
    console.log(`    Paint tree diff:       ${fmtRate(paintTreeDetected, TRIALS)}`);
  }
  console.log(`    A11y diff:             ${fmtRate(a11yDetected, TRIALS)}`);
  console.log(`    ${BOLD}Any signal:${RESET}            ${fmtRate(eitherDetected, TRIALS)}`);
  console.log(`    Undetected (silent):   ${fmtRate(neitherDetected, TRIALS, true)}`);
  if (prescannerSummary) {
    console.log();
    console.log(`  ${BOLD}Prescanner${RESET}`);
    console.log(`    Resolved by crater:    ${fmtRate(prescannerSummary.craterResolved, prescannerSummary.total)}`);
    if (prescannerSummary.metadataOnly > 0) {
      console.log(`    ${DIM}└─ metadata-only:    ${fmtRate(prescannerSummary.metadataOnly, prescannerSummary.craterResolved)} (no PNG captured)${RESET}`);
    }
    const bySignal = prescannerSummary.craterBySignal;
    if (prescannerSummary.craterResolved > 0) {
      const signalParts = [
        bySignal.paintTree ? `paint-tree ${bySignal.paintTree}` : null,
        bySignal.computedStyle ? `computed-style ${bySignal.computedStyle}` : null,
        bySignal.forcedState ? `forced-state ${bySignal.forcedState}` : null,
        bySignal.visual ? `visual ${bySignal.visual}` : null,
      ].filter((part): part is string => part !== null);
      if (signalParts.length > 0) {
        console.log(`    ${DIM}└─ first signal:     ${signalParts.join(" | ")}${RESET}`);
      }
    }
    console.log(`    Chromium fallback:     ${fmtRate(prescannerSummary.chromiumFallbacks, prescannerSummary.total, true)}`);
    console.log(`    Fallback detected:     ${fmtRate(prescannerSummary.chromiumDetected, prescannerSummary.total)}`);
    console.log(`    Fallback pass:         ${fmtRate(prescannerSummary.passedAfterFallback, prescannerSummary.total, true)}`);
  }

  // Scoped rate (excluding animation)
  const scoped = dbRecords.filter((r) => !isOutOfScope(r.property));
  const scopedDetected = scoped.filter((r) => r.detected).length;
  if (scoped.length < dbRecords.length) {
    const outOfScope = dbRecords.length - scoped.length;
    console.log(`    ${DIM}(excl. animation: ${fmtRate(scopedDetected, scoped.length)} | ${outOfScope} animation skipped)${RESET}`);
  }
  console.log();

  // Viewport comparison — when visual is skipped (prescanner / metadata-only),
  // accept paint-tree / computed-style / forced-state signals so the table does
  // not read as a silent false-negative.
  const viewportDetected = (v: ViewportDetectionResult | undefined): boolean => {
    if (!v) return false;
    if (v.visualDiffDetected || v.a11yDiffDetected) return true;
    if (v.visualCaptureSkipped) {
      return v.paintTreeDiffCount > 0 || v.computedStyleDiffCount > 0 || v.hoverDiffDetected;
    }
    return false;
  };
  const metadataOnlyViewport = dbRecords.some((r) => r.viewports.some((v) => v.visualCaptureSkipped));
  const viewportHeader = metadataOnlyViewport ? "Detection by Viewport (metadata-only)" : "Detection by Viewport";
  console.log(`  ${BOLD}${viewportHeader}${RESET}`);
  for (const vp of VIEWPORTS) {
    const vpIdx = VIEWPORTS.indexOf(vp);
    const vpDetected = dbRecords.filter((r) => viewportDetected(r.viewports[vpIdx])).length;
    console.log(`    ${vp.label.padEnd(10)} ${fmtRate(vpDetected, TRIALS)}`);
  }
  const multiOnly = dbRecords.filter((r) => {
    const desktopVp = r.viewports.find((v) => v.width > 1000);
    const mobileVp = r.viewports.find((v) => v.width <= 500);
    const desktopDetected = viewportDetected(desktopVp);
    const mobileDetected = viewportDetected(mobileVp);
    return r.detected && (!desktopDetected || !mobileDetected);
  }).length;
  console.log(`    ${DIM}multi-viewport bonus: ${multiOnly} additional detection(s)${RESET}`);
  console.log();

  // By category
  const categories = new Map<string, typeof dbRecords>();
  for (const r of dbRecords) {
    if (!categories.has(r.category)) categories.set(r.category, []);
    categories.get(r.category)!.push(r);
  }
  console.log(`  ${BOLD}Detection by Property Category${RESET}`);
  console.log(`    ${"Category".padEnd(14)} ${"Count".padStart(5)}  ${"Detect".padStart(8)}  ${"Silent".padStart(8)}`);
  for (const [cat, recs] of [...categories.entries()].sort((a, b) => b[1].length - a[1].length)) {
    const det = recs.filter((r) => r.detected).length;
    const silent = recs.filter((r) => !r.detected).length;
    console.log(`    ${cat.padEnd(14)} ${String(recs.length).padStart(5)}  ${fmtRateCompact(det, recs.length).padStart(8)}  ${fmtRateCompact(silent, recs.length, true).padStart(8)}`);
  }
  console.log();

  // Undetected reasons
  const reasonCounts = new Map<string, number>();
  for (const r of dbRecords) {
    if (!r.detected && r.undetectedReason) {
      reasonCounts.set(r.undetectedReason, (reasonCounts.get(r.undetectedReason) ?? 0) + 1);
    }
  }
  if (reasonCounts.size > 0) {
    console.log(`  ${BOLD}${YELLOW}Undetected Reasons${RESET}`);
    for (const [reason, count] of [...reasonCounts.entries()].sort((a, b) => b[1] - a[1])) {
      const examples = dbRecords.filter((r) => r.undetectedReason === reason).slice(0, 2);
      console.log(`    ${reason.padEnd(20)} ${String(count).padStart(3)}  ${DIM}${examples.map((e) => `${e.selector}{${e.property}}`).join(", ")}${RESET}`);
    }
    console.log();
  }

  // LLM recovery
  if (llm) {
    const attempted = results.filter((r) => r.llmAttempted);
    const exact = attempted.filter((r) => r.exactMatch);
    const pixelOk = attempted.filter((r) => r.pixelPerfect);
    const nearOk = attempted.filter((r) => r.nearPerfect);
    console.log(`  ${BOLD}LLM Recovery${RESET}`);
    console.log(`    Exact match:         ${fmtRate(exact.length, attempted.length)}`);
    console.log(`    Pixel-perfect fix:   ${fmtRate(pixelOk.length, attempted.length)}`);
    console.log(`    Near-perfect (<1%):  ${fmtRate(nearOk.length, attempted.length)}`);
    console.log();
  }

  // Persist to DB
  if (SAVE_DB) {
    await appendRecords(dbRecords);
    await appendBenchHistory([
      buildBenchHistoryRecord({
        runId,
        fixture,
        backend: BACKEND,
        trials: TRIALS,
        startSeed: START_SEED,
        elapsedMs,
        llmEnabled: !!llm,
        approvalPath: APPROVAL_PATH || undefined,
        strict: STRICT,
        suggestApproval: SUGGEST_APPROVAL,
        visualDetected,
        computedDetected,
        hoverDetected,
        paintTreeDetected,
        a11yDetected,
        eitherDetected,
        neitherDetected,
        prescanner: prescannerSummary,
      }),
    ]);
    console.log(`  ${DIM}DB: ${dbRecords.length} records appended${RESET}`);
    console.log(`  ${DIM}Bench history: appended${RESET}`);
  }

  if (SUGGEST_APPROVAL) {
    const suggestionPath = getCssBenchApprovalSuggestionsPath(fixture, OUTPUT_ROOT);
    await writeFile(suggestionPath, JSON.stringify({ rules: approvalSuggestions }, null, 2));
    console.log(`  ${DIM}Approval suggestions: ${suggestionPath}${RESET}`);
  }

  // JSON report
  const reportPath = join(tmpDir, "bench-report.json");
  const report = {
    meta: {
      fixture,
      trials: TRIALS,
      startSeed: START_SEED,
      elapsed,
      viewports: VIEWPORTS,
      llmEnabled: !!llm,
      totalDeclarations: declarations.length,
      approvalPath: APPROVAL_PATH || undefined,
      strict: STRICT,
      suggestApproval: SUGGEST_APPROVAL,
      approvalWarnings,
      prescanner: prescannerSummary,
    },
    detection: { visualDetected, a11yDetected, eitherDetected, neitherDetected, rate: eitherDetected / TRIALS },
    trials: dbRecords,
  };
  await writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(`  ${DIM}Report: ${reportPath}${RESET}`);
  console.log();
}

async function main() {
  const availableFixtures = await listCssChallengeFixtureNames();
  const fixtures = normalizeCssChallengeFixtureSelection(FIXTURE_ARGS, availableFixtures);

  for (const fixture of fixtures) {
    await runFixtureBenchmark(fixture);
  }
}

function shuffleWithSeed<T>(arr: T[], seed: number): T[] {
  const result = [...arr];
  const rand = seededRandom(seed);
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function fmtRate(count: number, total: number, inverse = false): string {
  const pct = ((count / total) * 100).toFixed(1);
  const color = inverse
    ? (count === 0 ? GREEN : count <= total * 0.1 ? YELLOW : RED)
    : (count === total ? GREEN : count >= total * 0.9 ? YELLOW : count >= total * 0.5 ? YELLOW : RED);
  return `${color}${count}/${total}${RESET} ${DIM}(${pct}%)${RESET}`;
}

function fmtRateCompact(count: number, total: number, inverse = false): string {
  const pct = ((count / total) * 100).toFixed(0);
  const color = inverse
    ? (count === 0 ? GREEN : RED)
    : (count === total ? GREEN : count >= total * 0.5 ? YELLOW : RED);
  return `${color}${pct}%${RESET}`;
}

const isCliEntry = process.env.__VRT_DISPATCHER_LEAF__ === "css-challenge-bench" || (process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false);
if (isCliEntry) {
  main().catch((error) => {
    if (isPlaywrightSandboxRestrictionError(error)) {
      console.error(formatPlaywrightLaunchError(error, { commandHint: "in your local terminal or in CI" }));
      process.exit(1);
    }
    handleCliError(error);
  });
}
