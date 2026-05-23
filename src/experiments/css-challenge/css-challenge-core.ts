/// <reference lib="dom" />
/**
 * CSS Challenge core logic
 *
 * Shared foundation for css-challenge.ts and css-challenge-bench.ts
 */
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Browser, CDPSession, Page } from "playwright";
import { chromium } from "playwright";
import {
  applyApprovalToVrtDiff,
  filterApprovedPaintTreeChanges,
  inferApprovalChangeType,
  type ApprovalContext,
  type ApprovalManifest,
  type ApprovalRule,
  type ApprovalWarning,
  type PaintTreeApprovalMatch,
} from "../../vrt/snapshot/approval.ts";
import { compareScreenshots } from "@mizchi/vlmkit-core/heatmap.ts";
import { classifyVisualDiff } from "@mizchi/vlmkit-markup/visual-semantic.ts";
import { diffA11yTrees, verifyA11yTree, parsePlaywrightA11ySnapshot } from "@mizchi/vlmkit-core/a11y-semantic.ts";
import { CraterClient, diffPaintTrees, type PaintNode, type PaintTreeChange } from "@mizchi/vlmkit-capture/crater-client.ts";
import {
  filterComputedStyleDiffsByTargets,
  type ComputedStyleTarget,
} from "./css-custom-properties.ts";
import {
  buildInteractionTargetPlans,
  captureEmulatedInteractionStyleSnapshotInDom,
  captureComputedStyleSnapshotForTargetSelectorsInDom,
  buildComputedStyleCaptureJsonExpression,
  ESBUILD_NAME_POLYFILL,
  type ComputedStyleSnapshot,
  collectInteractionTargetPlansInDom,
  computedStyleSnapshotToMap,
  parseComputedStyleSnapshot,
  hasMeaningfulComputedStyleSnapshot,
  mergeComputedStyleSnapshots,
  selectInteractionFallbackPlans,
  TRACKED_PROPERTIES,
  type InteractionTargetPlan,
  waitForInteractionStylesInDom,
} from "@mizchi/vlmkit-core/computed-style-capture.ts";
import { formatPlaywrightLaunchError, isPlaywrightSandboxRestrictionError } from "@mizchi/vlmkit-capture/playwright-launch-error.ts";
import type { A11yNode, VrtSnapshot, VrtDiff, VisualSemanticDiff, A11yDiff } from "@mizchi/vlmkit-core/types.ts";

// ---- Types ----

export interface CssDeclaration {
  index: number;       // line index in full CSS text
  text: string;        // original line text
  property: string;    // e.g. "padding"
  value: string;       // e.g. "12px 24px"
  selector: string;    // containing selector
  mediaCondition: string | null;  // e.g. "(max-width: 768px)" or null
}

export interface CapturedState {
  a11yTree: A11yNode;
  screenshotPath: string;
  visualCaptureSkipped?: boolean;
  computedStyles: Map<string, Record<string, string>>;  // selector → { property: value }
  hoverComputedStyles: Map<string, Record<string, string>>;  // hover-forced computed styles
  paintTree?: PaintNode;  // crater only: internal paint tree
}

/** Computed style diff between two captures */
export interface ComputedStyleDiff {
  selector: string;
  property: string;
  before: string;
  after: string;
}

export function diffComputedStyles(
  baseline: Map<string, Record<string, string>>,
  broken: Map<string, Record<string, string>>,
): ComputedStyleDiff[] {
  const diffs: ComputedStyleDiff[] = [];
  for (const [selector, baseProps] of baseline) {
    const brokenProps = broken.get(selector);
    if (!brokenProps) continue;
    for (const [prop, baseVal] of Object.entries(baseProps)) {
      const brokenVal = brokenProps[prop];
      if (brokenVal !== undefined && brokenVal !== baseVal) {
        diffs.push({ selector, property: prop, before: baseVal, after: brokenVal });
      }
    }
  }
  return diffs;
}

function hasCapturedStyleValues(styles: Record<string, string>): boolean {
  return Object.keys(styles).length > 0 &&
    Object.values(styles).some((value) => value.trim().length > 0);
}

export async function captureCraterForcedStateStyles(
  client: Pick<CraterClient, "getComputedStylesWithState">,
  selectors: string[],
  properties: string[],
): Promise<Map<string, Record<string, string>>> {
  const styles = new Map<string, Record<string, string>>();
  const plans = buildInteractionTargetPlans(selectors);

  // Use the plan's `forcedStates` so the Crater path and Playwright fallback
  // both key off the same pseudo-class list extracted from the original
  // selector. Crater forces all extracted states in one BiDi call.
  for (const plan of plans) {
    if (plan.forcedStates.length === 0) continue;
    const result = await client.getComputedStylesWithState(
      plan.selector,
      plan.forcedStates,
      properties,
    );
    if (!hasCapturedStyleValues(result.forced)) continue;
    styles.set(plan.selector, result.forced);
  }

  return styles;
}

export function applyApprovalsToAnalysisSignals(
  vrtDiff: VrtDiff | null,
  paintTreeChanges: PaintTreeChange[],
  options: AnalysisApprovalOptions = {},
): AppliedAnalysisApprovals {
  if (!options.manifest) {
    return {
      vrtDiff,
      paintTreeChanges,
      approvalWarnings: [],
      approvedVisualRules: [],
      approvedPaintTreeMatches: [],
    };
  }

  const context = options.context ?? {};
  const resolvedChangeType = context.changeType ?? (
    context.property ? inferApprovalChangeType(context.property, context.category) : undefined
  );

  const visualApproval = vrtDiff
    ? applyApprovalToVrtDiff(
      vrtDiff,
      options.manifest,
      { ...context, changeType: resolvedChangeType },
      { strict: options.strict },
    )
    : null;

  const paintApproval = filterApprovedPaintTreeChanges(
    paintTreeChanges,
    options.manifest,
    context,
    { strict: options.strict },
  );

  return {
    vrtDiff: visualApproval?.diff ?? vrtDiff,
    paintTreeChanges: paintApproval.remainingChanges,
    approvalWarnings: dedupeApprovalWarnings([
      ...(visualApproval?.warnings ?? []),
      ...paintApproval.warnings,
    ]),
    approvedVisualRules: visualApproval?.matchedRules ?? [],
    approvedPaintTreeMatches: paintApproval.matches,
  };
}

export interface VrtAnalysis {
  vrtDiff: VrtDiff | null;
  visualSemantic: VisualSemanticDiff | null;
  a11yDiff: A11yDiff;
  baselineIssueCount: number;
  brokenIssueCount: number;
  computedStyleDiffs: ComputedStyleDiff[];
  referencedComputedStyleDiffs: ComputedStyleDiff[];
  referencedHoverStyleDiffs: ComputedStyleDiff[];
  trackedComputedStyleTargets: ComputedStyleTarget[];
  hoverDiffDetected: boolean;
  paintTreeChanges: PaintTreeChange[];
  approvalWarnings: ApprovalWarning[];
  approvedVisualRules: ApprovalRule[];
  approvedPaintTreeMatches: PaintTreeApprovalMatch[];
  visualReport: string;
  a11yReport: string;
  fullReport: string;
}

export interface AnalysisApprovalOptions {
  manifest?: ApprovalManifest | null;
  context?: ApprovalContext;
  strict?: boolean;
  expectedComputedStyleTargets?: ComputedStyleTarget[];
}

export interface AppliedAnalysisApprovals {
  vrtDiff: VrtDiff | null;
  paintTreeChanges: PaintTreeChange[];
  approvalWarnings: ApprovalWarning[];
  approvedVisualRules: ApprovalRule[];
  approvedPaintTreeMatches: PaintTreeApprovalMatch[];
}

export interface TrialResult {
  seed: number;
  removed: CssDeclaration;
  // Detection
  visualDiffDetected: boolean;
  visualDiffRatio: number;
  visualChangeTypes: string[];
  a11yDiffDetected: boolean;
  a11yChangeCount: number;
  newA11yIssues: number;
  // LLM recovery (if attempted)
  llmAttempted: boolean;
  llmFixParsed: boolean;
  selectorMatch: boolean;
  propertyMatch: boolean;
  valueMatch: boolean;
  exactMatch: boolean;
  pixelPerfect: boolean;
  nearPerfect: boolean;
  fixedDiffRatio: number;
  attempts: number;
  llmMs: number;
  fallbackUsed?: boolean;
  resolvedBy?: "chromium" | "crater" | "none";
}

// ---- CSS Parsing ----

export function parseCssDeclarations(css: string): CssDeclaration[] {
  const lines = css.split("\n");
  const declarations: CssDeclaration[] = [];
  let currentMedia: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("/*") || trimmed.startsWith("//")) continue;

    // Track @media blocks
    const mediaMatch = trimmed.match(/^@media\s+(.+?)\s*\{$/);
    if (mediaMatch) {
      currentMedia = mediaMatch[1];
      continue;
    }
    if (trimmed === "}" && currentMedia !== null) {
      currentMedia = null;
      continue;
    }
    if (trimmed.startsWith("@") || trimmed === "}") continue;

    const oneLineMatch = trimmed.match(/^([^{]+)\{([^}]+)\}\s*$/);
    if (oneLineMatch) {
      const selector = oneLineMatch[1].trim();
      const body = oneLineMatch[2].trim();
      const props = body.split(";").filter((s) => s.trim());
      for (const prop of props) {
        const propMatch = prop.trim().match(/^([\w-]+)\s*:\s*(.+?)\s*$/);
        if (propMatch) {
          declarations.push({
            index: i,
            text: line,
            property: propMatch[1],
            value: propMatch[2],
            selector,
            mediaCondition: currentMedia,
          });
        }
      }
    }
  }

  return declarations;
}

/** CSS selector block (groups declarations on the same line) */
export interface CssSelectorBlock {
  selector: string;
  index: number;           // line index
  text: string;            // original line text
  declarations: CssDeclaration[];
  mediaCondition: string | null;
}

/** Group declarations by selector block */
export function groupBySelector(declarations: CssDeclaration[]): CssSelectorBlock[] {
  const map = new Map<string, CssSelectorBlock>();
  for (const d of declarations) {
    const key = `${d.index}:${d.selector}`;
    let block = map.get(key);
    if (!block) {
      block = { selector: d.selector, index: d.index, text: d.text, declarations: [], mediaCondition: d.mediaCondition };
      map.set(key, block);
    }
    block.declarations.push(d);
  }
  return [...map.values()];
}

/** Remove an entire selector block from CSS */
export function removeSelectorBlock(css: string, block: CssSelectorBlock): string {
  const lines = css.split("\n");
  lines[block.index] = "";
  return lines.join("\n");
}

export function removeCssProperty(css: string, declaration: CssDeclaration): string {
  const lines = css.split("\n");
  const line = lines[declaration.index];
  const propPattern = new RegExp(
    `\\s*${escapeRegex(declaration.property)}\\s*:\\s*${escapeRegex(declaration.value)}\\s*;?`,
  );
  lines[declaration.index] = line.replace(propPattern, "");
  return lines.join("\n");
}

export function applyCssFix(css: string, fix: { selector: string; property: string; value: string }): string {
  const lines = css.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    const oneLineMatch = trimmed.match(/^([^{]+)\{([^}]+)\}\s*$/);
    if (oneLineMatch) {
      const selector = oneLineMatch[1].trim();
      if (selector === fix.selector) {
        const body = oneLineMatch[2].trim();
        const newBody = `${body} ${fix.property}: ${fix.value};`;
        lines[i] = `${selector} { ${newBody} }`;
        return lines.join("\n");
      }
    }
  }
  return css;
}

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function normalizeValue(v: string): string {
  return v.replace(/\s+/g, " ").replace(/;$/, "").trim();
}

// ---- Random ----

export function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

// ---- Render backends ----

export type RenderBackend = "chromium" | "crater";

export async function createBrowser(viewport = { width: 1280, height: 900 }): Promise<{ browser: Browser; viewport: { width: number; height: number } }> {
  let browser: Browser;
  try {
    browser = await chromium.launch();
  } catch (error) {
    if (isPlaywrightSandboxRestrictionError(error)) {
      throw new Error(formatPlaywrightLaunchError(error, { commandHint: "in your local terminal or in CI" }));
    }
    throw error;
  }
  return { browser, viewport };
}

export async function createCraterClient(): Promise<CraterClient> {
  const client = new CraterClient();
  await client.connect();
  return client;
}

export async function capturePageState(
  browser: Browser,
  viewport: { width: number; height: number },
  html: string,
  screenshotPath: string,
  options?: { captureHover?: boolean; trackedProperties?: string[]; interactionSelectors?: string[] },
): Promise<CapturedState> {
  const page = await browser.newPage({ viewport });
  await page.setContent(html, { waitUntil: "networkidle" });
  await page.screenshot({ path: screenshotPath, fullPage: true });
  const trackedProperties = options?.trackedProperties ?? TRACKED_PROPERTIES;

  // Capture computed styles for styled elements + semantic tags
  const computedStyles = new Map<string, Record<string, string>>();
  try {
    // Use JSON-based expression to avoid __name transpilation issue in page.evaluate
    const expr = buildComputedStyleCaptureJsonExpression(trackedProperties);
    const jsonStr = await page.evaluate(expr) as string;
    const snapshot = parseComputedStyleSnapshot(JSON.parse(jsonStr));
    for (const [selector, props] of computedStyleSnapshotToMap(snapshot)) {
      computedStyles.set(selector, props);
    }
  } catch (e) {
    if (process.env.DEBUG_VRT) console.error("[capturePageState] computed style error:", e);
  }

  // Capture hover styles by temporarily activating :hover rules
  // Strategy: inject a <style> that converts :hover rules to always-active versions,
  // then capture computed styles, then remove the injected style.
  const hoverComputedStyles = new Map<string, Record<string, string>>();
  if (options?.captureHover) {
    try {
      const interactionPlansExpr = `(function(){ ${ESBUILD_NAME_POLYFILL} return (${collectInteractionTargetPlansInDom.toString()})(); })()`;
      const interactionPlans = await page.evaluate(interactionPlansExpr) as InteractionTargetPlan[];
      const expectedInteractionPlans = buildInteractionTargetPlans(options.interactionSelectors ?? []);
      const hoverExpr = `(function(){ ${ESBUILD_NAME_POLYFILL} return (${captureEmulatedInteractionStyleSnapshotInDom.toString()})(${JSON.stringify(trackedProperties)}); })()`;
      const emulatedHoverStyles = await page.evaluate(hoverExpr) as ComputedStyleSnapshot;
      const fallbackPlans = dedupeInteractionPlans([
        ...expectedInteractionPlans,
        ...selectInteractionFallbackPlans(
        interactionPlans,
        hasMeaningfulComputedStyleSnapshot(emulatedHoverStyles),
        ),
      ]).slice(0, 8);
      const fallbackHoverStyles = fallbackPlans.length > 0
        ? await capturePlaywrightInteractionFallbackSnapshot(page, fallbackPlans, trackedProperties)
        : {};
      // Fallback (CDP) result wins over emulated values — CDP forces the
      // pseudo-state and reads the real computed value, while emulation
      // rewrites CSS rules and is unreliable when the rule body is empty
      // (e.g. `.btn-cart:hover { }` after a property-mode removal).
      const mergedHoverStyles = mergeComputedStyleSnapshots(emulatedHoverStyles, fallbackHoverStyles);
      for (const [sel, props] of Object.entries(mergedHoverStyles)) {
        hoverComputedStyles.set(sel, props);
      }
    } catch { /* ignore */ }
  }

  // Capture a11y tree via CDP
  let a11yTree: A11yNode = { role: "document", name: "", children: [] };
  try {
    const client = await page.context().newCDPSession(page);
    const result = await client.send("Accessibility.getFullAXTree");
    a11yTree = cdpNodesToTree(result.nodes) as A11yNode;
    await client.detach();
  } catch {
    // Fallback
  }
  await page.close();

  return { a11yTree, screenshotPath, computedStyles, hoverComputedStyles };
}

function dedupeInteractionPlans(
  plans: InteractionTargetPlan[],
): InteractionTargetPlan[] {
  const deduped: InteractionTargetPlan[] = [];
  const seen = new Set<string>();
  for (const plan of plans) {
    const key = `${plan.interaction}\u0000${plan.normalizedSelector}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(plan);
  }
  return deduped;
}

/**
 * Drive forced pseudo-states (`:hover`, `:focus`, `:focus-visible`,
 * `:focus-within`, `:active`) via CDP `CSS.forcePseudoState` and capture the
 * computed styles for each plan's normalized selector. CDP gives us
 * deterministic activation that user-action emulation (`page.hover`,
 * `element.focus()`) can't match — `.focus()` never triggers
 * `:focus-visible`, and there's no DOM API for `:active` at all.
 *
 * Each plan's `forcedStates` carries the exact set of pseudo classes
 * extracted from the original selector, so a `.btn:hover:active` rule
 * forces both `hover` and `active` in one round.
 */
function planSpecificity(plan: InteractionTargetPlan): number {
  // More chained classes / ids in the normalizedSelector = more specific.
  // Used to ensure that when multiple plans target overlapping elements
  // (e.g. `.btn-cart` and `.btn` both match the same `<button class="btn
  // btn-cart">`), the snapshot keeps the value captured under the more
  // specific plan rather than letting the broader plan's forced-state
  // capture overwrite it.
  return (
    (plan.normalizedSelector.match(/\./g)?.length ?? 0) * 10
    + (plan.normalizedSelector.match(/#/g)?.length ?? 0) * 100
    + plan.normalizedSelector.length
  );
}

async function capturePlaywrightInteractionFallbackSnapshot(
  page: Page,
  plans: InteractionTargetPlan[],
  trackedProperties: string[],
): Promise<ComputedStyleSnapshot> {
  if (plans.length === 0) return {};
  // Sort by specificity descending so first-write-wins below keeps the
  // most-specific plan's forced-state value.
  plans = [...plans].sort((a, b) => planSpecificity(b) - planSpecificity(a));

  // Disable transitions / animations BEFORE forcing the pseudo-state. Without
  // this, the captured computed style is the mid-transition interpolation
  // (e.g. `rgb(37, 98, 234)` instead of the final `var(--accent-hover) =
  // rgb(29, 78, 216)`), which collapses to the default value and produces a
  // false "hover diff is 0" signal. The same fix is documented in
  // vlmkit-markup/src/stress/multi-state.ts.
  let transitionStyleTag: Awaited<ReturnType<Page["addStyleTag"]>> | null = null;
  try {
    transitionStyleTag = await page.addStyleTag({
      content: `*, *::before, *::after { transition: none !important; animation: none !important; }`,
    });
  } catch { /* page may be detached; CDP path still works without */ }

  let cdp: CDPSession | null = null;
  try {
    cdp = await page.context().newCDPSession(page);
  } catch {
    if (transitionStyleTag) {
      try { await transitionStyleTag.evaluate((el) => { (el as HTMLElement).remove(); }); } catch { /* ignore */ }
    }
    return {};
  }

  const snapshots: ComputedStyleSnapshot[] = [];
  try {
    await cdp.send("DOM.enable");
    await cdp.send("CSS.enable");
    const { root } = await cdp.send("DOM.getDocument", { depth: -1, pierce: true });

    for (const plan of plans) {
      const forcedNodeIds: number[] = [];
      try {
        const { nodeIds } = await cdp.send("DOM.querySelectorAll", {
          nodeId: root.nodeId,
          selector: plan.normalizedSelector,
        });
        if (nodeIds.length === 0) continue;

        for (const nodeId of nodeIds) {
          try {
            await cdp.send("CSS.forcePseudoState", {
              nodeId,
              forcedPseudoClasses: plan.forcedStates,
            });
            forcedNodeIds.push(nodeId);
          } catch {
            // forcePseudoState rejects detached / pseudo-element nodes.
          }
        }
        if (forcedNodeIds.length === 0) continue;

        await page.evaluate(`(function(){ ${ESBUILD_NAME_POLYFILL} return (${waitForInteractionStylesInDom.toString()})(); })()`);
        const targetExpr = `(function(){ ${ESBUILD_NAME_POLYFILL} return (${captureComputedStyleSnapshotForTargetSelectorsInDom.toString()})(${JSON.stringify({ props: trackedProperties, selectors: [plan.normalizedSelector] })}); })()`;
        snapshots.push(await page.evaluate(targetExpr) as ComputedStyleSnapshot);
      } catch {
        // ignore per-plan failures
      } finally {
        // Clear forced state on this batch before moving on so the next plan's
        // computed-style read isn't polluted.
        for (const nodeId of forcedNodeIds) {
          try {
            await cdp.send("CSS.forcePseudoState", {
              nodeId,
              forcedPseudoClasses: [],
            });
          } catch { /* ignore */ }
        }
      }
    }
  } finally {
    try { await cdp.detach(); } catch { /* ignore */ }
    if (transitionStyleTag) {
      try { await transitionStyleTag.evaluate((el) => { (el as HTMLElement).remove(); }); } catch { /* ignore */ }
    }
  }

  // First-write-wins merge: plans are already sorted by specificity desc, so
  // the most specific match for each element key is preserved.
  const accumulated: ComputedStyleSnapshot = {};
  for (const snapshot of snapshots) {
    for (const [key, value] of Object.entries(snapshot)) {
      if (key in accumulated) continue;
      accumulated[key] = value;
    }
  }
  return accumulated;
}

/** Capture via Crater BiDi backend */
export async function capturePageStateCrater(
  client: CraterClient,
  viewport: { width: number; height: number },
  html: string,
  screenshotPath: string,
  options?: {
    trackedProperties?: string[];
    captureHover?: boolean;
    interactionSelectors?: string[];
    skipScreenshot?: boolean;
  },
): Promise<CapturedState> {
  await client.setViewport(viewport.width, viewport.height);
  await client.setContent(html);
  const trackedProperties = options?.trackedProperties ?? TRACKED_PROPERTIES;

  // PNG screenshot (capturePaintData -> PNG conversion)
  if (!options?.skipScreenshot) {
    const { png } = await client.capturePng();
    await writeFile(screenshotPath, png);
  }

  // Paint tree -- crater-specific advantage
  let paintTree: PaintNode | undefined;
  try {
    paintTree = await client.capturePaintTree();
  } catch { /* ignore */ }

  // a11y tree -- crater returns empty (future support)
  const a11yTree: A11yNode = { role: "document", name: "", children: [] };

  let computedStyles = new Map<string, Record<string, string>>();
  try {
    computedStyles = await client.captureComputedStyles(trackedProperties);
  } catch { /* ignore */ }
  let hoverComputedStyles = new Map<string, Record<string, string>>();
  if (options?.captureHover && options.interactionSelectors?.length) {
    try {
      hoverComputedStyles = await captureCraterForcedStateStyles(
        client,
        options.interactionSelectors,
        trackedProperties,
      );
    } catch { /* ignore */ }
  }

  return {
    a11yTree,
    screenshotPath,
    visualCaptureSkipped: options?.skipScreenshot,
    computedStyles,
    hoverComputedStyles,
    paintTree,
  };
}

function cdpNodesToTree(nodes: Array<{
  nodeId: string;
  role?: { value?: string };
  name?: { value?: string };
  properties?: Array<{ name: string; value: { value?: unknown } }>;
  childIds?: string[];
}>): unknown {
  if (!nodes || nodes.length === 0) return { role: "document", name: "", children: [] };

  const nodeMap = new Map<string, Record<string, unknown>>();
  const childMap = new Map<string, string[]>();

  for (const node of nodes) {
    const props: Record<string, unknown> = {};
    if (node.properties) {
      for (const p of node.properties) props[p.name] = p.value?.value;
    }
    const treeNode: Record<string, unknown> = {
      role: node.role?.value ?? "none",
      name: node.name?.value ?? "",
    };
    if (props.checked !== undefined) treeNode.checked = props.checked;
    if (props.disabled !== undefined) treeNode.disabled = props.disabled;
    if (props.expanded !== undefined) treeNode.expanded = props.expanded;
    if (props.level !== undefined) treeNode.level = props.level;
    nodeMap.set(node.nodeId, treeNode);
    if (node.childIds) childMap.set(node.nodeId, node.childIds);
  }

  function buildTree(nodeId: string): Record<string, unknown> | null {
    const node = nodeMap.get(nodeId);
    if (!node) return null;
    const childIds = childMap.get(nodeId) ?? [];
    const children = childIds.map(buildTree).filter((c): c is Record<string, unknown> => c !== null);
    if (children.length > 0) node.children = children;
    return node;
  }

  return buildTree(nodes[0].nodeId) ?? { role: "document", name: "", children: [] };
}

// ---- VRT Analysis ----

export async function analyzeVrtDiff(
  baselineState: CapturedState,
  brokenState: CapturedState,
  outputDir: string,
  approvalOptions: AnalysisApprovalOptions = {},
  options?: { skipHeatmap?: boolean },
): Promise<VrtAnalysis> {
  const vrtSnap: VrtSnapshot = {
    testId: "page", testTitle: "page", projectName: "css-challenge",
    screenshotPath: brokenState.screenshotPath,
    baselinePath: baselineState.screenshotPath,
    status: "changed",
  };
  const visualCaptureSkipped = baselineState.visualCaptureSkipped || brokenState.visualCaptureSkipped;
  const rawVrtDiff = visualCaptureSkipped
    ? null
    : await compareScreenshots(vrtSnap, { outputDir, skipHeatmap: options?.skipHeatmap });

  let visualSemantic: VisualSemanticDiff | null = null;
  let visualReport = "";
  const computedStyleDiffs = diffComputedStyles(baselineState.computedStyles, brokenState.computedStyles);
  const trackedComputedStyleTargets = approvalOptions.expectedComputedStyleTargets ?? [];
  const referencedComputedStyleDiffs = filterComputedStyleDiffsByTargets(
    computedStyleDiffs,
    trackedComputedStyleTargets,
  );

  // Hover diff (computed style based)
  const hoverStyleDiffs = diffComputedStyles(baselineState.hoverComputedStyles, brokenState.hoverComputedStyles);
  const referencedHoverStyleDiffs = filterComputedStyleDiffsByTargets(
    hoverStyleDiffs,
    trackedComputedStyleTargets,
  );
  const hoverDiffDetected = trackedComputedStyleTargets.length > 0
    ? referencedHoverStyleDiffs.length > 0
    : hoverStyleDiffs.length > 0;

  // Paint tree diff (crater only)
  let rawPaintTreeChanges: PaintTreeChange[] = [];
  if (baselineState.paintTree && brokenState.paintTree) {
    rawPaintTreeChanges = diffPaintTrees(baselineState.paintTree, brokenState.paintTree);
  }

  const approvals = applyApprovalsToAnalysisSignals(rawVrtDiff, rawPaintTreeChanges, approvalOptions);
  const vrtDiff = approvals.vrtDiff;
  const paintTreeChanges = approvals.paintTreeChanges;

  if (vrtDiff && vrtDiff.diffPixels > 0) {
    visualSemantic = classifyVisualDiff(vrtDiff);
    visualReport = `Visual diff: ${(vrtDiff.diffRatio * 100).toFixed(1)}% pixels changed\n` +
      `Regions: ${vrtDiff.regions.map((r) => `(${r.x},${r.y} ${r.width}x${r.height})`).join(", ")}\n` +
      `Semantic: ${visualSemantic.summary}\n` +
      visualSemantic.changes.map((c) => `  - [${c.type}] ${c.description}`).join("\n");
  } else if (approvals.approvedVisualRules.length > 0) {
    visualReport = `Visual diff approved by manifest: ${approvals.approvedVisualRules.map((rule) => rule.reason).join("; ")}`;
  } else if (visualCaptureSkipped) {
    visualReport = "Visual diff skipped for metadata-only capture.";
  } else {
    visualReport = "No visual diff detected — the removed CSS line had no visible effect at this viewport size.";
  }

  const a11yDiff = diffA11yTrees(
    parsePlaywrightA11ySnapshot("page", "page", baselineState.a11yTree as any),
    parsePlaywrightA11ySnapshot("page", "page", brokenState.a11yTree as any),
  );

  const baselineIssueCount = verifyA11yTree(baselineState.a11yTree).length;
  const brokenIssueCount = verifyA11yTree(brokenState.a11yTree).length;

  let a11yReport = "";
  if (a11yDiff.changes.length > 0) {
    a11yReport = `A11y changes: ${a11yDiff.changes.length}\n` +
      a11yDiff.changes.map((c) => `  - [${c.type}] ${c.description}`).join("\n");
  } else {
    a11yReport = "No a11y tree changes detected.";
  }
  if (brokenIssueCount > baselineIssueCount) {
    a11yReport += `\nNew a11y quality issues: ${brokenIssueCount - baselineIssueCount}`;
  }

  let computedReport = "";
  if (trackedComputedStyleTargets.length > 0) {
    const trackedLines = trackedComputedStyleTargets
      .slice(0, 10)
      .map((target) => `  - ${target.selector} { ${target.property} } via ${target.viaCustomProperties.join(" → ")}`)
      .join("\n");
    computedReport = `\nTracked var() targets: ${trackedComputedStyleTargets.length}\n${trackedLines}`;

    if (referencedComputedStyleDiffs.length > 0) {
      computedReport += `\nReferenced computed style changes: ${referencedComputedStyleDiffs.length}\n` +
        referencedComputedStyleDiffs
          .slice(0, 10)
          .map((d) => `  - ${d.selector} { ${d.property}: ${d.before} → ${d.after} }`)
          .join("\n");
    } else {
      computedReport += "\nReferenced computed style changes: 0";
    }

    if (referencedHoverStyleDiffs.length > 0) {
      computedReport += `\nReferenced hover style changes: ${referencedHoverStyleDiffs.length}\n` +
        referencedHoverStyleDiffs
          .slice(0, 10)
          .map((d) => `  - ${d.selector} { ${d.property}: ${d.before} → ${d.after} }`)
          .join("\n");
    }

    if (computedStyleDiffs.length > referencedComputedStyleDiffs.length) {
      computedReport += `\nTotal computed style changes: ${computedStyleDiffs.length}`;
    }
  } else if (computedStyleDiffs.length > 0) {
    computedReport = `\nComputed style changes: ${computedStyleDiffs.length}\n` +
      computedStyleDiffs.slice(0, 10).map((d) => `  - ${d.selector} { ${d.property}: ${d.before} → ${d.after} }`).join("\n");
  }

  let paintTreeReport = "";
  if (paintTreeChanges.length > 0) {
    paintTreeReport = `\nPaint tree changes: ${paintTreeChanges.length}\n` +
      paintTreeChanges.slice(0, 10).map((c) => `  - [${c.type}] ${c.path} ${c.property ?? ""}: ${c.before ?? ""} → ${c.after ?? ""}`).join("\n");
  } else if (approvals.approvedPaintTreeMatches.length > 0) {
    const reasons = [...new Set(approvals.approvedPaintTreeMatches.map((match) => match.rule.reason))];
    paintTreeReport = `\nPaint tree changes approved: ${approvals.approvedPaintTreeMatches.length}\n` +
      reasons.map((reason) => `  - ${reason}`).join("\n");
  }

  let approvalReport = "";
  if (approvals.approvalWarnings.length > 0) {
    approvalReport = `\nApproval warnings:\n` +
      approvals.approvalWarnings.map((warning) => `  - ${warning.message}`).join("\n");
  }

  const fullReport = `${visualReport}\n\n${a11yReport}${computedReport}${paintTreeReport}${approvalReport}`;

  return {
    vrtDiff,
    visualSemantic,
    a11yDiff,
    baselineIssueCount,
    brokenIssueCount,
    computedStyleDiffs,
    referencedComputedStyleDiffs,
    referencedHoverStyleDiffs,
    trackedComputedStyleTargets,
    hoverDiffDetected,
    paintTreeChanges,
    approvalWarnings: approvals.approvalWarnings,
    approvedVisualRules: approvals.approvedVisualRules,
    approvedPaintTreeMatches: approvals.approvedPaintTreeMatches,
    visualReport,
    a11yReport,
    fullReport,
  };
}

// ---- LLM ----

export function buildFixPrompt(vrtReport: string, fullCss: string): string {
  return `You are debugging a CSS regression. One CSS property declaration was removed from a stylesheet, causing a visual regression.

## VRT Diagnosis Report
${vrtReport}

## Current CSS (with the missing line)
\`\`\`css
${fullCss}
\`\`\`

## Task
Identify which CSS property declaration was removed and provide the exact fix.

Respond in this EXACT format (no other text):
SELECTOR: <the CSS selector>
PROPERTY: <the CSS property name>
VALUE: <the CSS value>

For example:
SELECTOR: .header
PROPERTY: padding
VALUE: 12px 24px`;
}

export function parseLLMFix(response: string): { selector: string; property: string; value: string } | null {
  const selectorMatch = response.match(/SELECTOR:\s*(.+)/);
  const propertyMatch = response.match(/PROPERTY:\s*(.+)/);
  const valueMatch = response.match(/VALUE:\s*(.+)/);
  if (!selectorMatch || !propertyMatch || !valueMatch) return null;
  return {
    selector: selectorMatch[1].trim(),
    property: propertyMatch[1].trim(),
    value: valueMatch[1].trim(),
  };
}

// ---- HTML helpers ----

export const HTML_PATH = join(import.meta.dirname!, "..", "..", "..", "fixtures", "css-challenge", "page.html");

/**
 * Extract the CSS body used by the css-challenge / migration fix-loop
 * pipelines. Prefers an explicit `<style id="target-css">` block (used
 * by the css-challenge fixtures). For arbitrary HTML — e.g. the
 * `design-runs/` patterns and any external project — fall back to the
 * first `<style>` element, regardless of id. Returns `null` only when
 * there is no inline `<style>` block at all.
 */
export function extractCss(html: string): string | null {
  const explicit = html.match(/<style[^>]*id=["']target-css["'][^>]*>([\s\S]*?)<\/style>/i);
  if (explicit) return explicit[1];
  const generic = html.match(/<style\b[^>]*>([\s\S]*?)<\/style>/i);
  return generic ? generic[1] : null;
}

export function replaceCss(html: string, originalCss: string, newCss: string): string {
  return html.replace(originalCss, newCss);
}

// ---- Property categorization ----

const LAYOUT_PROPS = new Set([
  "display", "flex", "flex-direction", "flex-wrap", "flex-shrink", "flex-grow",
  "align-items", "justify-content", "gap", "grid-template-columns", "grid-template-rows",
  "position", "top", "right", "bottom", "left", "float", "clear", "overflow", "overflow-x", "overflow-y",
]);
const SPACING_PROPS = new Set([
  "margin", "margin-top", "margin-right", "margin-bottom", "margin-left",
  "padding", "padding-top", "padding-right", "padding-bottom", "padding-left",
]);
const SIZING_PROPS = new Set([
  "width", "height", "max-width", "max-height", "min-width", "min-height",
  "line-height",
]);
const VISUAL_PROPS = new Set([
  "background", "background-color", "background-image",
  "color", "opacity",
  "border", "border-top", "border-right", "border-bottom", "border-left",
  "border-color", "border-radius", "border-spacing",
  "box-shadow", "text-shadow",
  "outline",
]);
const TYPO_PROPS = new Set([
  "font-family", "font-size", "font-weight", "font-style",
  "text-align", "text-decoration", "text-transform", "text-indent",
  "letter-spacing", "word-spacing", "white-space",
]);

const ANIMATION_PROPS = new Set([
  "animation", "animation-name", "animation-duration", "animation-delay",
  "animation-timing-function", "animation-iteration-count", "animation-direction",
  "animation-fill-mode", "animation-play-state",
  "transition", "transition-property", "transition-duration", "transition-delay",
  "transition-timing-function",
]);

const TRANSFORM_PROPS = new Set([
  "transform", "transform-origin", "translate", "rotate", "scale",
  "filter", "backdrop-filter", "clip-path", "mask",
]);

export type PropertyCategory = "layout" | "spacing" | "sizing" | "visual" | "typography" | "animation" | "transform" | "other";

export function categorizeProperty(property: string): PropertyCategory {
  if (LAYOUT_PROPS.has(property)) return "layout";
  if (SPACING_PROPS.has(property)) return "spacing";
  if (SIZING_PROPS.has(property)) return "sizing";
  if (VISUAL_PROPS.has(property)) return "visual";
  if (TYPO_PROPS.has(property)) return "typography";
  if (ANIMATION_PROPS.has(property)) return "animation";
  if (TRANSFORM_PROPS.has(property)) return "transform";
  return "other";
}

function dedupeApprovalWarnings(warnings: ApprovalWarning[]): ApprovalWarning[] {
  const seen = new Set<string>();
  return warnings.filter((warning) => {
    const key = `${warning.message}:${warning.rule.reason}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
