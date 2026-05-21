import { spawnSync } from "node:child_process";
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

let built = false;

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
  return run(process.execPath, [cliPath, ...args]);
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
