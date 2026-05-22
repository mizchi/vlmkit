import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  ComponentCanvasEvidence,
  ComponentExpressiveMenuEvidence,
  ComponentGoalProfile,
  ComponentGoalStatus,
  ComponentLandingEvidence,
  ComponentScrollportEvidence,
} from "./component/component-goal.ts";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(here, "..");
const repoRoot = resolve(packageRoot, "../..");
const cliPath = join(
  packageRoot,
  "_build/js/debug/build/markup-core-cli/markup-core-cli.js",
);
const apiPath = join(
  packageRoot,
  "_build/js/debug/build/markup-core-api/markup-core-api.js",
);

let built = false;
const runMarkupCoreCache = new Map<string, string>();
const requireGenerated = createRequire(import.meta.url);
const directArgSeparator = "\t";
const directEmptyArg = "__VLMKIT_EMPTY_ARG__";
let directModule: DirectMarkupCoreModule | undefined;
let directModuleUnavailable = false;
let runtimeBackend: "direct-js" | "spawn" = "spawn";

interface DirectMarkupCoreModule {
  run_markup_core: (command: string, encodedArgs: string) => unknown;
}

export function computeComponentGoalStatus(input: {
  goal: string;
  pixelDiffRatio: number;
  landscapeDiffRatio: number;
  pass: ComponentGoalProfile["pass"];
  review: ComponentGoalProfile["review"];
  scrollports?: ComponentScrollportEvidence;
  landing?: ComponentLandingEvidence;
  canvas?: ComponentCanvasEvidence;
  expressiveMenu?: ComponentExpressiveMenuEvidence;
}): ComponentGoalStatus {
  const output = runMarkupCore([
    "component-goal-status",
    input.goal,
    doubleArg(input.pixelDiffRatio),
    doubleArg(input.landscapeDiffRatio),
    optionalDoubleArg(input.pass.landscape),
    optionalDoubleArg(input.pass.pixel),
    optionalDoubleArg(input.review.landscape),
    optionalDoubleArg(input.review.pixel),
    intArg(input.scrollports?.total),
    intArg(input.scrollports?.broken),
    intArg(input.scrollports?.empty),
    intArg(input.scrollports?.expected?.total),
    intArg(input.scrollports?.expected?.missing),
    intArg(input.scrollports?.expected?.broken),
    intArg(input.scrollports?.expected?.empty),
    boolArg(Boolean(input.landing)),
    boolArg(input.landing?.heroVisible),
    boolArg(input.landing?.primaryCtaVisible),
    boolArg(input.landing?.nextSectionHintVisible),
    boolArg(input.landing?.mediaSlotVisible),
    intArg(input.canvas?.canvasCount),
    boolArg(input.canvas?.nonblank),
    boolArg(input.canvas?.frameDelta),
    optionalBoolArg(input.canvas?.inputResponsive),
    optionalBoolArg(
      input.canvas?.stateHook ? input.canvas.stateHookPresent !== false : undefined,
    ),
    intArg(input.canvas?.missingStateFields?.length),
    boolArg(Boolean(input.expressiveMenu)),
    intArg(input.expressiveMenu?.compositionLayers),
    intArg(input.expressiveMenu?.compositionShapes),
    boolArg(input.expressiveMenu?.selectedVisible),
    intArg(input.expressiveMenu?.focusableItemCount),
    boolArg(input.expressiveMenu?.semanticMenuText),
    boolArg(input.expressiveMenu?.diagonalEvidence),
    boolArg(input.expressiveMenu?.highContrast),
    intArg(input.expressiveMenu?.lowContrastItemCount),
    optionalBoolArg(input.expressiveMenu?.hoverChanged),
    optionalBoolArg(input.expressiveMenu?.focusVisibleChanged),
  ]);
  if (output === "pass" || output === "review" || output === "fail") {
    return output;
  }
  throw new Error(`unexpected markup-core status: ${output}`);
}

export function runMarkupCore(args: string[]): string {
  ensureMarkupCoreCli();
  const cacheKey = JSON.stringify(args);
  const cached = runMarkupCoreCache.get(cacheKey);
  if (cached !== undefined) return cached;
  const directOutput = runMarkupCoreDirect(args);
  if (directOutput !== undefined) {
    runMarkupCoreCache.set(cacheKey, directOutput);
    return directOutput;
  }
  const output = run(process.execPath, [cliPath, ...args]);
  runtimeBackend = "spawn";
  runMarkupCoreCache.set(cacheKey, output);
  return output;
}

export function getMarkupCoreRuntimeBackend(): "direct-js" | "spawn" {
  return runtimeBackend;
}

function runMarkupCoreDirect(args: string[]): string | undefined {
  const command = args[0];
  if (!command) return undefined;
  const encodedArgs = encodeDirectArgs(args.slice(1));
  if (encodedArgs === undefined) return undefined;
  const api = loadMarkupCoreApi();
  if (!api) return undefined;
  runtimeBackend = "direct-js";
  return unwrapMoonBitResult(api.run_markup_core(command, encodedArgs)).trim();
}

function encodeDirectArgs(args: string[]): string | undefined {
  const encoded: string[] = [];
  for (const arg of args) {
    if (arg.includes(directArgSeparator) || arg === directEmptyArg) {
      return undefined;
    }
    encoded.push(arg === "" ? directEmptyArg : arg);
  }
  return encoded.join(directArgSeparator);
}

function loadMarkupCoreApi(): DirectMarkupCoreModule | undefined {
  if (directModule) return directModule;
  if (directModuleUnavailable) return undefined;
  try {
    const loaded = requireGenerated(apiPath) as Partial<DirectMarkupCoreModule>;
    if (typeof loaded.run_markup_core === "function") {
      directModule = { run_markup_core: loaded.run_markup_core };
      return directModule;
    }
  } catch {
    directModuleUnavailable = true;
    return undefined;
  }
  directModuleUnavailable = true;
  return undefined;
}

function unwrapMoonBitResult(value: unknown): string {
  if (isMoonBitResult(value)) {
    if (value.$tag === 1) {
      return String(value._0);
    }
    throw new Error(`markup-core direct call failed: ${String(value._0)}`);
  }
  return String(value);
}

function isMoonBitResult(
  value: unknown,
): value is { $tag: 0 | 1; _0: unknown } {
  return (
    typeof value === "object" &&
    value !== null &&
    "$tag" in value &&
    "_0" in value
  );
}

export function isMarkupCoreComponentProbeState(value: string): boolean {
  return runMarkupCore(["is-component-probe-state", value]) === "true";
}

export function isMarkupCoreForcedPseudoState(value: string): boolean {
  return runMarkupCore(["is-forced-pseudo-state", value]) === "true";
}

export function computeComponentProbeStates(requiredStateKinds: string[]): string[] {
  return splitList(runMarkupCore(["component-probe-states", joinList(requiredStateKinds)]));
}

export function mergeMarkupCoreComponentProbeStates(
  explicit: string[] | undefined,
  injected: string[],
): string[] {
  return splitList(
    runMarkupCore([
      "merge-component-probe-states",
      joinList(explicit ?? []),
      joinList(injected),
    ]),
  );
}

export type MarkupCoreScrollTargetSource = "state-targets" | "expected-scrollports" | "none";

export function computeComponentScrollTargetSource(
  requiredStateKinds: string[],
  explicitScrolledTargetCount: number,
): MarkupCoreScrollTargetSource {
  const output = runMarkupCore([
    "component-scroll-target-source",
    joinList(requiredStateKinds),
    intArg(explicitScrolledTargetCount),
  ]);
  if (
    output === "state-targets" ||
    output === "expected-scrollports" ||
    output === "none"
  ) {
    return output;
  }
  throw new Error(`unexpected markup-core scroll target source: ${output}`);
}

export type MarkupCoreSemanticDrilldownReasonId =
  | "coarse-landscape"
  | "local-kinds"
  | "local-pixel";

export interface MarkupCoreSemanticDrilldownPolicy {
  flow: "layout" | "decoration";
  priorityScore: number;
  reasonId: MarkupCoreSemanticDrilldownReasonId;
}

export function computeSemanticDrilldownPolicy(
  layoutScore: number,
  decorationScore: number,
  heatmapKindCount: number,
): MarkupCoreSemanticDrilldownPolicy {
  const output = runMarkupCore([
    "semantic-drilldown-policy",
    doubleArg(layoutScore),
    doubleArg(decorationScore),
    intArg(heatmapKindCount),
  ]);
  const [flow, priorityScore, reasonId] = output.split("|");
  if (flow !== "layout" && flow !== "decoration") {
    throw new Error(`unexpected markup-core semantic flow: ${output}`);
  }
  if (
    reasonId !== "coarse-landscape" &&
    reasonId !== "local-kinds" &&
    reasonId !== "local-pixel"
  ) {
    throw new Error(`unexpected markup-core semantic reason: ${output}`);
  }
  const parsedPriority = Number(priorityScore);
  if (!Number.isFinite(parsedPriority)) {
    throw new Error(`unexpected markup-core semantic priority: ${output}`);
  }
  return {
    flow,
    priorityScore: parsedPriority,
    reasonId,
  };
}

export function selectMarkupCoreSemanticDrilldownIndex(
  entries: {
    flow: "layout" | "decoration";
    priorityScore: number;
    order: number;
  }[],
): number | undefined {
  if (entries.length === 0) return undefined;
  const output = runMarkupCore([
    "semantic-drilldown-select-index",
    joinList(entries.map((entry) => entry.flow)),
    joinList(entries.map((entry) => doubleArg(entry.priorityScore))),
    joinList(entries.map((entry) => intArg(entry.order))),
  ]);
  const index = Number(output);
  if (!Number.isInteger(index)) {
    throw new Error(`unexpected markup-core semantic index: ${output}`);
  }
  return index >= 0 ? index : undefined;
}

export type MarkupCoreUiContractPatternEvidenceIssueId =
  | "landing-marker-primary-cta"
  | "landing-marker-media-slot"
  | "landing-marker-next-section"
  | "app-shell-marker-scrollport"
  | "app-shell-expected-scrollports"
  | "app-shell-state-selected"
  | "app-shell-state-scrolled"
  | "canvas-state-hook"
  | "canvas-state-field-mode"
  | "canvas-state-field-frame"
  | "canvas-state-field-playerX"
  | "canvas-state-field-playerY"
  | "canvas-state-field-score"
  | "canvas-state-field-assetsReady"
  | "expressive-menu-composition"
  | "expressive-menu-state-evidence"
  | "expressive-menu-required-selected"
  | "expressive-menu-required-hover"
  | "expressive-menu-required-focus-visible";

export type MarkupCoreUiContractVersionIssueId =
  "contract-version-unsupported";

export type MarkupCoreUiContractScreenIssueId =
  | "screen-id-required"
  | "screen-pattern-unknown"
  | "screen-goal-unknown"
  | "screen-source-of-truth-unknown";

export type MarkupCoreUiContractViewportIssueId =
  | "viewport-label-required"
  | "viewport-label-unique"
  | "viewport-size-positive"
  | "viewport-dpr-positive";

export type MarkupCoreUiContractLandmarkIssueId =
  | "landmark-abstract-role"
  | "landmark-id-required"
  | "landmark-name-required"
  | "landmark-parent-unknown";

export type MarkupCoreUiContractResponsiveRuleIssueId =
  "responsive-rule-viewport-unknown";

export type MarkupCoreUiContractMarkerIssueId =
  | "marker-kind-unknown"
  | "marker-target-required";

export type MarkupCoreUiContractRangeIssueId =
  | "range-min-non-negative"
  | "range-max-non-negative"
  | "range-min-lte-max";

export type MarkupCoreUiContractSlotIssueId = "slot-id-required";

export type MarkupCoreUiContractAssetIssueId = "asset-id-required";

export type MarkupCoreUiContractCanvasIssueId = "canvas-state-hook-required";

export type MarkupCoreUiContractCanvasInputIssueId =
  "canvas-input-action-required";

export type MarkupCoreUiContractCanvasHudIssueId = "canvas-hud-id-required";

export type MarkupCoreUiContractCompositionIssueId =
  "composition-style-unknown";

export type MarkupCoreUiContractCompositionAxisIssueId =
  "composition-axis-unknown";

export type MarkupCoreUiContractCompositionLayerIssueId =
  | "composition-layer-id-required"
  | "composition-layer-id-unique"
  | "composition-layer-role-unknown"
  | "composition-layer-z-finite";

export type MarkupCoreUiContractCompositionShapeIssueId =
  | "composition-shape-id-required"
  | "composition-shape-id-unique"
  | "composition-shape-kind-unknown";

export type MarkupCoreUiContractCompositionMotionIssueId =
  | "motion-id-required"
  | "motion-id-unique"
  | "motion-trigger-unknown"
  | "motion-effect-unknown"
  | "motion-duration-non-negative";

export type MarkupCoreUiContractCompositionContrastIssueId =
  | "contrast-mode-unknown"
  | "contrast-min-ratio-positive";

export type MarkupCoreUiContractCompositionContrastPaletteIssueId =
  "contrast-palette-value-hex";

export type MarkupCoreUiContractDecorationTypographyIssueId =
  | "typography-role-required"
  | "typography-size-positive"
  | "typography-line-height-positive";

export type MarkupCoreUiContractDecorationPaletteIssueId =
  | "palette-role-required"
  | "palette-value-hex";

export type MarkupCoreUiContractDecorationMediaIssueId =
  "media-slot-required";

export type MarkupCoreUiContractContentItemsIssueId =
  "content-items-exact-non-negative";

export type MarkupCoreUiContractContentTextIssueId =
  "content-text-row-count-non-negative";

export type MarkupCoreUiContractLayoutIssueId =
  | "layout-width-fluid-bounds"
  | "layout-width-fixed-positive"
  | "layout-height-fixed-positive"
  | "layout-height-scrollport-max-positive"
  | "layout-grid-columns"
  | "layout-grid-rows";

export type MarkupCoreUiContractStateIssueId =
  | "state-id-required"
  | "state-kind-unknown"
  | "state-target-required";

export type MarkupCoreUiContractRequiredStateIssueId =
  | MarkupCoreUiContractStateIssueId
  | "required-state-id-unique"
  | "required-state-min-change-ratio";

export type MarkupCoreUiContractExpectedScrollportIssueId =
  | "expected-scrollport-id-required"
  | "expected-scrollport-id-unique"
  | "expected-scrollport-axis-unknown"
  | "expected-scrollport-target-required"
  | "expected-scrollport-min-overflow";

export function computeUiContractVersionIssueIds(input: {
  version: number;
}): MarkupCoreUiContractVersionIssueId[] {
  const output = runMarkupCore([
    "ui-contract-version-issue-ids",
    intArg(input.version),
  ]);
  return splitList(output).map((issueId) => {
    if (isMarkupCoreUiContractVersionIssueId(issueId)) {
      return issueId;
    }
    throw new Error(
      `unexpected markup-core UI contract version issue id: ${issueId}`,
    );
  });
}

export function computeUiContractScreenIssueIds(input: {
  id: string;
  pattern?: string;
  goal?: string;
  sourceOfTruth?: string;
}): MarkupCoreUiContractScreenIssueId[] {
  const output = runMarkupCore([
    "ui-contract-screen-issue-ids",
    input.id,
    input.pattern ?? "",
    input.goal ?? "",
    input.sourceOfTruth ?? "",
  ]);
  return splitList(output).map((issueId) => {
    if (isMarkupCoreUiContractScreenIssueId(issueId)) {
      return issueId;
    }
    throw new Error(
      `unexpected markup-core UI contract screen issue id: ${issueId}`,
    );
  });
}

export function computeUiContractViewportIssueIds(input: {
  label: string;
  duplicateLabel: boolean;
  width: number;
  height: number;
  dprPresent: boolean;
  dpr: number;
}): MarkupCoreUiContractViewportIssueId[] {
  const output = runMarkupCore([
    "ui-contract-viewport-issue-ids",
    input.label,
    boolArg(input.duplicateLabel),
    doubleArg(input.width),
    doubleArg(input.height),
    boolArg(input.dprPresent),
    doubleArg(input.dpr),
  ]);
  return splitList(output).map((issueId) => {
    if (isMarkupCoreUiContractViewportIssueId(issueId)) {
      return issueId;
    }
    throw new Error(
      `unexpected markup-core UI contract viewport issue id: ${issueId}`,
    );
  });
}

export function computeUiContractLandmarkIssueIds(input: {
  id: string;
  role: string;
  name: string;
  parentIdPresent: boolean;
  parentKnown: boolean;
}): MarkupCoreUiContractLandmarkIssueId[] {
  const output = runMarkupCore([
    "ui-contract-landmark-issue-ids",
    input.id,
    input.role,
    input.name,
    boolArg(input.parentIdPresent),
    boolArg(input.parentKnown),
  ]);
  return splitList(output).map((issueId) => {
    if (isMarkupCoreUiContractLandmarkIssueId(issueId)) {
      return issueId;
    }
    throw new Error(
      `unexpected markup-core UI contract landmark issue id: ${issueId}`,
    );
  });
}

export function computeUiContractResponsiveRuleIssueIds(input: {
  viewportKnown: boolean;
}): MarkupCoreUiContractResponsiveRuleIssueId[] {
  const output = runMarkupCore([
    "ui-contract-responsive-rule-issue-ids",
    boolArg(input.viewportKnown),
  ]);
  return splitList(output).map((issueId) => {
    if (isMarkupCoreUiContractResponsiveRuleIssueId(issueId)) {
      return issueId;
    }
    throw new Error(
      `unexpected markup-core UI contract responsive rule issue id: ${issueId}`,
    );
  });
}

export function computeUiContractPatternEvidenceIssueIds(input: {
  pattern: string | undefined;
  markerKinds: string[];
  requiredStateKinds: string[];
  stateKinds: string[];
  expectedScrollportCount: number;
  hasComposition: boolean;
  hasCanvasStateHook: boolean;
  canvasRequiredStateFields: string[];
}): MarkupCoreUiContractPatternEvidenceIssueId[] {
  const output = runMarkupCore([
    "ui-contract-pattern-evidence-issue-ids",
    input.pattern ?? "",
    joinList(input.markerKinds),
    joinList(input.requiredStateKinds),
    joinList(input.stateKinds),
    intArg(input.expectedScrollportCount),
    boolArg(input.hasComposition),
    boolArg(input.hasCanvasStateHook),
    joinList(input.canvasRequiredStateFields),
  ]);
  return splitList(output).map((issueId) => {
    if (isMarkupCoreUiContractPatternEvidenceIssueId(issueId)) {
      return issueId;
    }
    throw new Error(`unexpected markup-core UI contract issue id: ${issueId}`);
  });
}

export function computeUiContractMarkerIssueIds(input: {
  kind: string;
  required: boolean;
  hasSelector: boolean;
  hasAttribute: boolean;
  hasTarget: boolean;
}): MarkupCoreUiContractMarkerIssueId[] {
  const output = runMarkupCore([
    "ui-contract-marker-issue-ids",
    input.kind,
    boolArg(input.required),
    boolArg(input.hasSelector),
    boolArg(input.hasAttribute),
    boolArg(input.hasTarget),
  ]);
  return splitList(output).map((issueId) => {
    if (isMarkupCoreUiContractMarkerIssueId(issueId)) {
      return issueId;
    }
    throw new Error(`unexpected markup-core UI contract marker issue id: ${issueId}`);
  });
}

export function computeUiContractOptionalRangeIssueIds(input: {
  min?: number;
  max?: number;
}): MarkupCoreUiContractRangeIssueId[] {
  const output = runMarkupCore([
    "ui-contract-optional-range-issue-ids",
    boolArg(input.min !== undefined),
    doubleArg(input.min ?? 0),
    boolArg(input.max !== undefined),
    doubleArg(input.max ?? 0),
  ]);
  return splitList(output).map((issueId) => {
    if (isMarkupCoreUiContractRangeIssueId(issueId)) {
      return issueId;
    }
    throw new Error(`unexpected markup-core UI contract range issue id: ${issueId}`);
  });
}

export function computeUiContractSlotIssueIds(input: {
  id: string;
}): MarkupCoreUiContractSlotIssueId[] {
  const output = runMarkupCore(["ui-contract-slot-issue-ids", input.id]);
  return splitList(output).map((issueId) => {
    if (isMarkupCoreUiContractSlotIssueId(issueId)) {
      return issueId;
    }
    throw new Error(`unexpected markup-core UI contract slot issue id: ${issueId}`);
  });
}

export function computeUiContractAssetIssueIds(input: {
  id: string;
}): MarkupCoreUiContractAssetIssueId[] {
  const output = runMarkupCore(["ui-contract-asset-issue-ids", input.id]);
  return splitList(output).map((issueId) => {
    if (isMarkupCoreUiContractAssetIssueId(issueId)) {
      return issueId;
    }
    throw new Error(`unexpected markup-core UI contract asset issue id: ${issueId}`);
  });
}

export function computeUiContractCanvasIssueIds(input: {
  hasStateHook: boolean;
  requiredStateFieldCount: number;
}): MarkupCoreUiContractCanvasIssueId[] {
  const output = runMarkupCore([
    "ui-contract-canvas-issue-ids",
    boolArg(input.hasStateHook),
    intArg(input.requiredStateFieldCount),
  ]);
  return splitList(output).map((issueId) => {
    if (isMarkupCoreUiContractCanvasIssueId(issueId)) {
      return issueId;
    }
    throw new Error(`unexpected markup-core UI contract canvas issue id: ${issueId}`);
  });
}

export function computeUiContractCanvasInputIssueIds(input: {
  action: string;
}): MarkupCoreUiContractCanvasInputIssueId[] {
  const output = runMarkupCore([
    "ui-contract-canvas-input-issue-ids",
    input.action,
  ]);
  return splitList(output).map((issueId) => {
    if (isMarkupCoreUiContractCanvasInputIssueId(issueId)) {
      return issueId;
    }
    throw new Error(`unexpected markup-core UI contract canvas input issue id: ${issueId}`);
  });
}

export function computeUiContractCanvasHudIssueIds(input: {
  id: string;
}): MarkupCoreUiContractCanvasHudIssueId[] {
  const output = runMarkupCore(["ui-contract-canvas-hud-issue-ids", input.id]);
  return splitList(output).map((issueId) => {
    if (isMarkupCoreUiContractCanvasHudIssueId(issueId)) {
      return issueId;
    }
    throw new Error(`unexpected markup-core UI contract canvas HUD issue id: ${issueId}`);
  });
}

export function computeUiContractCompositionIssueIds(input: {
  style: string;
}): MarkupCoreUiContractCompositionIssueId[] {
  const output = runMarkupCore([
    "ui-contract-composition-issue-ids",
    input.style,
  ]);
  return splitList(output).map((issueId) => {
    if (isMarkupCoreUiContractCompositionIssueId(issueId)) {
      return issueId;
    }
    throw new Error(`unexpected markup-core UI contract composition issue id: ${issueId}`);
  });
}

export function computeUiContractCompositionAxisIssueIds(input: {
  axis: string;
}): MarkupCoreUiContractCompositionAxisIssueId[] {
  const output = runMarkupCore([
    "ui-contract-composition-axis-issue-ids",
    input.axis,
  ]);
  return splitList(output).map((issueId) => {
    if (isMarkupCoreUiContractCompositionAxisIssueId(issueId)) {
      return issueId;
    }
    throw new Error(`unexpected markup-core UI contract composition axis issue id: ${issueId}`);
  });
}

export function computeUiContractCompositionLayerIssueIds(input: {
  id: string;
  role: string;
  duplicateId: boolean;
  zPresent: boolean;
  zFinite: boolean;
}): MarkupCoreUiContractCompositionLayerIssueId[] {
  const output = runMarkupCore([
    "ui-contract-composition-layer-issue-ids",
    input.id,
    input.role,
    boolArg(input.duplicateId),
    boolArg(input.zPresent),
    boolArg(input.zFinite),
  ]);
  return splitList(output).map((issueId) => {
    if (isMarkupCoreUiContractCompositionLayerIssueId(issueId)) {
      return issueId;
    }
    throw new Error(`unexpected markup-core UI contract composition layer issue id: ${issueId}`);
  });
}

export function computeUiContractCompositionShapeIssueIds(input: {
  id: string;
  kind: string;
  duplicateId: boolean;
}): MarkupCoreUiContractCompositionShapeIssueId[] {
  const output = runMarkupCore([
    "ui-contract-composition-shape-issue-ids",
    input.id,
    input.kind,
    boolArg(input.duplicateId),
  ]);
  return splitList(output).map((issueId) => {
    if (isMarkupCoreUiContractCompositionShapeIssueId(issueId)) {
      return issueId;
    }
    throw new Error(`unexpected markup-core UI contract composition shape issue id: ${issueId}`);
  });
}

export function computeUiContractCompositionMotionIssueIds(input: {
  id: string;
  trigger: string;
  effect: string;
  duplicateId: boolean;
  durationPresent: boolean;
  durationMs: number;
}): MarkupCoreUiContractCompositionMotionIssueId[] {
  const output = runMarkupCore([
    "ui-contract-composition-motion-issue-ids",
    input.id,
    input.trigger,
    input.effect,
    boolArg(input.duplicateId),
    boolArg(input.durationPresent),
    doubleArg(input.durationMs),
  ]);
  return splitList(output).map((issueId) => {
    if (isMarkupCoreUiContractCompositionMotionIssueId(issueId)) {
      return issueId;
    }
    throw new Error(`unexpected markup-core UI contract composition motion issue id: ${issueId}`);
  });
}

export function computeUiContractCompositionContrastIssueIds(input: {
  mode: string;
  minRatioPresent: boolean;
  minRatio: number;
}): MarkupCoreUiContractCompositionContrastIssueId[] {
  const output = runMarkupCore([
    "ui-contract-composition-contrast-issue-ids",
    input.mode,
    boolArg(input.minRatioPresent),
    doubleArg(input.minRatio),
  ]);
  return splitList(output).map((issueId) => {
    if (isMarkupCoreUiContractCompositionContrastIssueId(issueId)) {
      return issueId;
    }
    throw new Error(`unexpected markup-core UI contract composition contrast issue id: ${issueId}`);
  });
}

export function computeUiContractCompositionContrastPaletteIssueIds(input: {
  value: string;
}): MarkupCoreUiContractCompositionContrastPaletteIssueId[] {
  const output = runMarkupCore([
    "ui-contract-composition-contrast-palette-issue-ids",
    input.value,
  ]);
  return splitList(output).map((issueId) => {
    if (isMarkupCoreUiContractCompositionContrastPaletteIssueId(issueId)) {
      return issueId;
    }
    throw new Error(`unexpected markup-core UI contract composition contrast palette issue id: ${issueId}`);
  });
}

export function computeUiContractDecorationTypographyIssueIds(input: {
  role: string;
  size?: number;
  lineHeight?: number;
}): MarkupCoreUiContractDecorationTypographyIssueId[] {
  const output = runMarkupCore([
    "ui-contract-decoration-typography-issue-ids",
    input.role,
    boolArg(input.size !== undefined),
    doubleArg(input.size ?? 0),
    boolArg(input.lineHeight !== undefined),
    doubleArg(input.lineHeight ?? 0),
  ]);
  return splitList(output).map((issueId) => {
    if (isMarkupCoreUiContractDecorationTypographyIssueId(issueId)) {
      return issueId;
    }
    throw new Error(`unexpected markup-core UI contract decoration typography issue id: ${issueId}`);
  });
}

export function computeUiContractDecorationPaletteIssueIds(input: {
  role: string;
  value?: string;
}): MarkupCoreUiContractDecorationPaletteIssueId[] {
  const output = runMarkupCore([
    "ui-contract-decoration-palette-issue-ids",
    input.role,
    input.value ?? "",
  ]);
  return splitList(output).map((issueId) => {
    if (isMarkupCoreUiContractDecorationPaletteIssueId(issueId)) {
      return issueId;
    }
    throw new Error(`unexpected markup-core UI contract decoration palette issue id: ${issueId}`);
  });
}

export function computeUiContractDecorationMediaIssueIds(input: {
  slot: string;
}): MarkupCoreUiContractDecorationMediaIssueId[] {
  const output = runMarkupCore([
    "ui-contract-decoration-media-issue-ids",
    input.slot,
  ]);
  return splitList(output).map((issueId) => {
    if (isMarkupCoreUiContractDecorationMediaIssueId(issueId)) {
      return issueId;
    }
    throw new Error(`unexpected markup-core UI contract decoration media issue id: ${issueId}`);
  });
}

export function computeUiContractContentItemsIssueIds(input: {
  exact?: number;
}): MarkupCoreUiContractContentItemsIssueId[] {
  const output = runMarkupCore([
    "ui-contract-content-items-issue-ids",
    boolArg(input.exact !== undefined),
    doubleArg(input.exact ?? 0),
  ]);
  return splitList(output).map((issueId) => {
    if (isMarkupCoreUiContractContentItemsIssueId(issueId)) {
      return issueId;
    }
    throw new Error(`unexpected markup-core UI contract content items issue id: ${issueId}`);
  });
}

export function computeUiContractContentTextIssueIds(input: {
  rowCount?: number;
}): MarkupCoreUiContractContentTextIssueId[] {
  const output = runMarkupCore([
    "ui-contract-content-text-issue-ids",
    boolArg(input.rowCount !== undefined),
    doubleArg(input.rowCount ?? 0),
  ]);
  return splitList(output).map((issueId) => {
    if (isMarkupCoreUiContractContentTextIssueId(issueId)) {
      return issueId;
    }
    throw new Error(`unexpected markup-core UI contract content text issue id: ${issueId}`);
  });
}

export function computeUiContractLayoutIssueIds(input: {
  widthKind?: string;
  widthMinPresent?: boolean;
  widthMaxPresent?: boolean;
  widthValue?: number;
  heightKind?: string;
  heightValue?: number;
  heightMax?: number;
  displayKind?: string;
  displayColumnsCount?: number;
  displayRowsCount?: number;
}): MarkupCoreUiContractLayoutIssueId[] {
  const output = runMarkupCore([
    "ui-contract-layout-issue-ids",
    input.widthKind ?? "",
    boolArg(input.widthMinPresent),
    boolArg(input.widthMaxPresent),
    doubleArg(input.widthValue ?? 0),
    input.heightKind ?? "",
    doubleArg(input.heightValue ?? 0),
    doubleArg(input.heightMax ?? 0),
    input.displayKind ?? "",
    intArg(input.displayColumnsCount),
    intArg(input.displayRowsCount),
  ]);
  return splitList(output).map((issueId) => {
    if (isMarkupCoreUiContractLayoutIssueId(issueId)) {
      return issueId;
    }
    throw new Error(`unexpected markup-core UI contract layout issue id: ${issueId}`);
  });
}

export function computeUiContractStateIssueIds(input: {
  id: string;
  kind: string;
  required: boolean;
  hasSelector: boolean;
  hasTrigger: boolean;
}): MarkupCoreUiContractStateIssueId[] {
  const output = runMarkupCore([
    "ui-contract-state-issue-ids",
    input.id,
    input.kind,
    boolArg(input.required),
    boolArg(input.hasSelector),
    boolArg(input.hasTrigger),
  ]);
  return splitList(output).map((issueId) => {
    if (isMarkupCoreUiContractStateIssueId(issueId)) {
      return issueId;
    }
    throw new Error(`unexpected markup-core UI contract state issue id: ${issueId}`);
  });
}

export function computeUiContractRequiredStateIssueIds(input: {
  id: string;
  kind: string;
  required: boolean;
  hasSelector: boolean;
  hasTrigger: boolean;
  duplicateId: boolean;
  minChangeRatioPresent: boolean;
  minChangeRatio: number;
}): MarkupCoreUiContractRequiredStateIssueId[] {
  const output = runMarkupCore([
    "ui-contract-required-state-issue-ids",
    input.id,
    input.kind,
    boolArg(input.required),
    boolArg(input.hasSelector),
    boolArg(input.hasTrigger),
    boolArg(input.duplicateId),
    boolArg(input.minChangeRatioPresent),
    doubleArg(input.minChangeRatio),
  ]);
  return splitList(output).map((issueId) => {
    if (isMarkupCoreUiContractRequiredStateIssueId(issueId)) {
      return issueId;
    }
    throw new Error(`unexpected markup-core UI contract required state issue id: ${issueId}`);
  });
}

export function computeUiContractExpectedScrollportIssueIds(input: {
  id: string;
  axis: string;
  required: boolean;
  hasSelector: boolean;
  hasName: boolean;
  hasLandmarkId: boolean;
  duplicateId: boolean;
  minOverflowPresent: boolean;
  minOverflow: number;
}): MarkupCoreUiContractExpectedScrollportIssueId[] {
  const output = runMarkupCore([
    "ui-contract-expected-scrollport-issue-ids",
    input.id,
    input.axis,
    boolArg(input.required),
    boolArg(input.hasSelector),
    boolArg(input.hasName),
    boolArg(input.hasLandmarkId),
    boolArg(input.duplicateId),
    boolArg(input.minOverflowPresent),
    doubleArg(input.minOverflow),
  ]);
  return splitList(output).map((issueId) => {
    if (isMarkupCoreUiContractExpectedScrollportIssueId(issueId)) {
      return issueId;
    }
    throw new Error(`unexpected markup-core UI contract expected scrollport issue id: ${issueId}`);
  });
}

function isMarkupCoreUiContractPatternEvidenceIssueId(
  issueId: string,
): issueId is MarkupCoreUiContractPatternEvidenceIssueId {
  return (
    issueId === "landing-marker-primary-cta" ||
    issueId === "landing-marker-media-slot" ||
    issueId === "landing-marker-next-section" ||
    issueId === "app-shell-marker-scrollport" ||
    issueId === "app-shell-expected-scrollports" ||
    issueId === "app-shell-state-selected" ||
    issueId === "app-shell-state-scrolled" ||
    issueId === "canvas-state-hook" ||
    issueId === "canvas-state-field-mode" ||
    issueId === "canvas-state-field-frame" ||
    issueId === "canvas-state-field-playerX" ||
    issueId === "canvas-state-field-playerY" ||
    issueId === "canvas-state-field-score" ||
    issueId === "canvas-state-field-assetsReady" ||
    issueId === "expressive-menu-composition" ||
    issueId === "expressive-menu-state-evidence" ||
    issueId === "expressive-menu-required-selected" ||
    issueId === "expressive-menu-required-hover" ||
    issueId === "expressive-menu-required-focus-visible"
  );
}

function isMarkupCoreUiContractVersionIssueId(
  issueId: string,
): issueId is MarkupCoreUiContractVersionIssueId {
  return issueId === "contract-version-unsupported";
}

function isMarkupCoreUiContractScreenIssueId(
  issueId: string,
): issueId is MarkupCoreUiContractScreenIssueId {
  return (
    issueId === "screen-id-required" ||
    issueId === "screen-pattern-unknown" ||
    issueId === "screen-goal-unknown" ||
    issueId === "screen-source-of-truth-unknown"
  );
}

function isMarkupCoreUiContractViewportIssueId(
  issueId: string,
): issueId is MarkupCoreUiContractViewportIssueId {
  return (
    issueId === "viewport-label-required" ||
    issueId === "viewport-label-unique" ||
    issueId === "viewport-size-positive" ||
    issueId === "viewport-dpr-positive"
  );
}

function isMarkupCoreUiContractLandmarkIssueId(
  issueId: string,
): issueId is MarkupCoreUiContractLandmarkIssueId {
  return (
    issueId === "landmark-abstract-role" ||
    issueId === "landmark-id-required" ||
    issueId === "landmark-name-required" ||
    issueId === "landmark-parent-unknown"
  );
}

function isMarkupCoreUiContractResponsiveRuleIssueId(
  issueId: string,
): issueId is MarkupCoreUiContractResponsiveRuleIssueId {
  return issueId === "responsive-rule-viewport-unknown";
}

function isMarkupCoreUiContractLayoutIssueId(
  issueId: string,
): issueId is MarkupCoreUiContractLayoutIssueId {
  return (
    issueId === "layout-width-fluid-bounds" ||
    issueId === "layout-width-fixed-positive" ||
    issueId === "layout-height-fixed-positive" ||
    issueId === "layout-height-scrollport-max-positive" ||
    issueId === "layout-grid-columns" ||
    issueId === "layout-grid-rows"
  );
}

function isMarkupCoreUiContractMarkerIssueId(
  issueId: string,
): issueId is MarkupCoreUiContractMarkerIssueId {
  return (
    issueId === "marker-kind-unknown" ||
    issueId === "marker-target-required"
  );
}

function isMarkupCoreUiContractRangeIssueId(
  issueId: string,
): issueId is MarkupCoreUiContractRangeIssueId {
  return (
    issueId === "range-min-non-negative" ||
    issueId === "range-max-non-negative" ||
    issueId === "range-min-lte-max"
  );
}

function isMarkupCoreUiContractSlotIssueId(
  issueId: string,
): issueId is MarkupCoreUiContractSlotIssueId {
  return issueId === "slot-id-required";
}

function isMarkupCoreUiContractAssetIssueId(
  issueId: string,
): issueId is MarkupCoreUiContractAssetIssueId {
  return issueId === "asset-id-required";
}

function isMarkupCoreUiContractCanvasIssueId(
  issueId: string,
): issueId is MarkupCoreUiContractCanvasIssueId {
  return issueId === "canvas-state-hook-required";
}

function isMarkupCoreUiContractCanvasInputIssueId(
  issueId: string,
): issueId is MarkupCoreUiContractCanvasInputIssueId {
  return issueId === "canvas-input-action-required";
}

function isMarkupCoreUiContractCanvasHudIssueId(
  issueId: string,
): issueId is MarkupCoreUiContractCanvasHudIssueId {
  return issueId === "canvas-hud-id-required";
}

function isMarkupCoreUiContractCompositionIssueId(
  issueId: string,
): issueId is MarkupCoreUiContractCompositionIssueId {
  return issueId === "composition-style-unknown";
}

function isMarkupCoreUiContractCompositionAxisIssueId(
  issueId: string,
): issueId is MarkupCoreUiContractCompositionAxisIssueId {
  return issueId === "composition-axis-unknown";
}

function isMarkupCoreUiContractCompositionLayerIssueId(
  issueId: string,
): issueId is MarkupCoreUiContractCompositionLayerIssueId {
  return (
    issueId === "composition-layer-id-required" ||
    issueId === "composition-layer-id-unique" ||
    issueId === "composition-layer-role-unknown" ||
    issueId === "composition-layer-z-finite"
  );
}

function isMarkupCoreUiContractCompositionShapeIssueId(
  issueId: string,
): issueId is MarkupCoreUiContractCompositionShapeIssueId {
  return (
    issueId === "composition-shape-id-required" ||
    issueId === "composition-shape-id-unique" ||
    issueId === "composition-shape-kind-unknown"
  );
}

function isMarkupCoreUiContractCompositionMotionIssueId(
  issueId: string,
): issueId is MarkupCoreUiContractCompositionMotionIssueId {
  return (
    issueId === "motion-id-required" ||
    issueId === "motion-id-unique" ||
    issueId === "motion-trigger-unknown" ||
    issueId === "motion-effect-unknown" ||
    issueId === "motion-duration-non-negative"
  );
}

function isMarkupCoreUiContractCompositionContrastIssueId(
  issueId: string,
): issueId is MarkupCoreUiContractCompositionContrastIssueId {
  return (
    issueId === "contrast-mode-unknown" ||
    issueId === "contrast-min-ratio-positive"
  );
}

function isMarkupCoreUiContractCompositionContrastPaletteIssueId(
  issueId: string,
): issueId is MarkupCoreUiContractCompositionContrastPaletteIssueId {
  return issueId === "contrast-palette-value-hex";
}

function isMarkupCoreUiContractDecorationTypographyIssueId(
  issueId: string,
): issueId is MarkupCoreUiContractDecorationTypographyIssueId {
  return (
    issueId === "typography-role-required" ||
    issueId === "typography-size-positive" ||
    issueId === "typography-line-height-positive"
  );
}

function isMarkupCoreUiContractDecorationPaletteIssueId(
  issueId: string,
): issueId is MarkupCoreUiContractDecorationPaletteIssueId {
  return (
    issueId === "palette-role-required" ||
    issueId === "palette-value-hex"
  );
}

function isMarkupCoreUiContractDecorationMediaIssueId(
  issueId: string,
): issueId is MarkupCoreUiContractDecorationMediaIssueId {
  return issueId === "media-slot-required";
}

function isMarkupCoreUiContractContentItemsIssueId(
  issueId: string,
): issueId is MarkupCoreUiContractContentItemsIssueId {
  return issueId === "content-items-exact-non-negative";
}

function isMarkupCoreUiContractContentTextIssueId(
  issueId: string,
): issueId is MarkupCoreUiContractContentTextIssueId {
  return issueId === "content-text-row-count-non-negative";
}

function isMarkupCoreUiContractStateIssueId(
  issueId: string,
): issueId is MarkupCoreUiContractStateIssueId {
  return (
    issueId === "state-id-required" ||
    issueId === "state-kind-unknown" ||
    issueId === "state-target-required"
  );
}

function isMarkupCoreUiContractRequiredStateIssueId(
  issueId: string,
): issueId is MarkupCoreUiContractRequiredStateIssueId {
  return (
    isMarkupCoreUiContractStateIssueId(issueId) ||
    issueId === "required-state-id-unique" ||
    issueId === "required-state-min-change-ratio"
  );
}

function isMarkupCoreUiContractExpectedScrollportIssueId(
  issueId: string,
): issueId is MarkupCoreUiContractExpectedScrollportIssueId {
  return (
    issueId === "expected-scrollport-id-required" ||
    issueId === "expected-scrollport-id-unique" ||
    issueId === "expected-scrollport-axis-unknown" ||
    issueId === "expected-scrollport-target-required" ||
    issueId === "expected-scrollport-min-overflow"
  );
}

export function ensureMarkupCoreCli(): void {
  if (built) return;
  run("moon", [
    "-C",
    packageRoot,
    "build",
    "markup-core",
    "markup-core-api",
    "markup-core-cli",
    "--target",
    "js",
  ]);
  built = true;
}

function doubleArg(value: number): string {
  return String(Number.isFinite(value) ? value : 0);
}

function optionalDoubleArg(value: number | undefined): string {
  return typeof value === "number" && Number.isFinite(value)
    ? String(value)
    : "null";
}

function intArg(value: number | undefined): string {
  return typeof value === "number" && Number.isFinite(value)
    ? String(Math.trunc(value))
    : "0";
}

function boolArg(value: boolean | undefined): string {
  return value ? "true" : "false";
}

function optionalBoolArg(value: boolean | null | undefined): string {
  return typeof value === "boolean" ? String(value) : "null";
}

function joinList(values: string[]): string {
  return values.join("|");
}

function splitList(value: string): string[] {
  return value.length > 0 ? value.split("|") : [];
}

function run(command: string, args: string[]): string {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
  });
  if (result.error) {
    throw new Error(
      `${command} ${args.join(" ")} failed: ${result.error.message}`,
    );
  }
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join("\n");
    throw new Error(
      `${command} ${args.join(" ")} failed with ${result.status}\n${detail}`,
    );
  }
  return result.stdout.trim();
}
