import {
  computeUiContractAssetIssueIds,
  computeUiContractCanvasHudIssueIds,
  computeUiContractCanvasInputIssueIds,
  computeUiContractCanvasIssueIds,
  computeUiContractCompositionAxisIssueIds,
  computeUiContractCompositionContrastIssueIds,
  computeUiContractCompositionContrastPaletteIssueIds,
  computeUiContractCompositionIssueIds,
  computeUiContractCompositionLayerIssueIds,
  computeUiContractCompositionMotionIssueIds,
  computeUiContractCompositionShapeIssueIds,
  computeUiContractContentItemsIssueIds,
  computeUiContractContentTextIssueIds,
  computeUiContractDecorationMediaIssueIds,
  computeUiContractDecorationPaletteIssueIds,
  computeUiContractDecorationTypographyIssueIds,
  computeUiContractExpectedScrollportIssueIds,
  computeUiContractLayoutIssueIds,
  computeUiContractMarkerIssueIds,
  computeUiContractOptionalRangeIssueIds,
  computeUiContractPatternEvidenceIssueIds,
  computeUiContractRequiredStateIssueIds,
  computeUiContractSlotIssueIds,
  computeUiContractStateIssueIds,
  type MarkupCoreUiContractAssetIssueId,
  type MarkupCoreUiContractCanvasHudIssueId,
  type MarkupCoreUiContractCanvasInputIssueId,
  type MarkupCoreUiContractCanvasIssueId,
  type MarkupCoreUiContractCompositionAxisIssueId,
  type MarkupCoreUiContractCompositionContrastIssueId,
  type MarkupCoreUiContractCompositionContrastPaletteIssueId,
  type MarkupCoreUiContractCompositionIssueId,
  type MarkupCoreUiContractCompositionLayerIssueId,
  type MarkupCoreUiContractCompositionMotionIssueId,
  type MarkupCoreUiContractCompositionShapeIssueId,
  type MarkupCoreUiContractContentItemsIssueId,
  type MarkupCoreUiContractContentTextIssueId,
  type MarkupCoreUiContractDecorationMediaIssueId,
  type MarkupCoreUiContractDecorationPaletteIssueId,
  type MarkupCoreUiContractDecorationTypographyIssueId,
  type MarkupCoreUiContractExpectedScrollportIssueId,
  type MarkupCoreUiContractLayoutIssueId,
  type MarkupCoreUiContractMarkerIssueId,
  type MarkupCoreUiContractPatternEvidenceIssueId,
  type MarkupCoreUiContractRangeIssueId,
  type MarkupCoreUiContractRequiredStateIssueId,
  type MarkupCoreUiContractSlotIssueId,
  type MarkupCoreUiContractStateIssueId,
} from "../markup-core-runtime.ts";

export type UiContractVersion = 1;

export const UI_CONTRACT_PATTERNS = [
  "editorial",
  "landing",
  "app-shell",
  "dashboard",
  "canvas",
  "expressive-menu",
  "mixed",
] as const;

export type UiContractPattern = typeof UI_CONTRACT_PATTERNS[number];

export const UI_CONTRACT_GOALS = [
  "app",
  "layout",
  "pixel",
  "draft",
  "app-shell",
  "landing",
  "canvas",
  "expressive-menu",
] as const;

export type UiContractGoal = typeof UI_CONTRACT_GOALS[number];

export type LandmarkRole =
  | "banner"
  | "navigation"
  | "main"
  | "complementary"
  | "contentinfo"
  | "region"
  | "search"
  | "form";

export interface UiContract {
  version: UiContractVersion;
  screens: UiContractScreen[];
}

export interface UiContractScreen {
  id: string;
  pattern?: UiContractPattern;
  goal?: UiContractGoal;
  sourceOfTruth?: UiSourceOfTruth;
  viewports: UiContractViewport[];
  markers?: UiMarkerContract[];
  states?: UiStateContract[];
  requiredStates?: UiRequiredStateContract[];
  expectedScrollports?: UiExpectedScrollportContract[];
  composition?: UiCompositionContract;
  content?: UiContentContract;
  decoration?: UiDecorationContract;
  assets?: UiAssetContract[];
  canvas?: UiCanvasContract;
  landmarks: UiContractLandmark[];
}

export interface UiContractViewport {
  label: string;
  width: number;
  height: number;
  dpr?: number;
}

export interface UiContractLandmark {
  id: string;
  role: LandmarkRole;
  name: string;
  parentId?: string;
  gridArea?: string;
  slots?: UiSlotContract[];
  repeat?: UiRepeatContract;
  markers?: UiMarkerContract[];
  states?: UiStateContract[];
  composition?: UiCompositionContract;
  content?: UiContentContract;
  decoration?: UiDecorationContract;
  assets?: UiAssetContract[];
  layout: UiLayoutContract;
  responsive?: UiResponsiveRule[];
}

export type UiSourceOfTruth =
  | "semantic-dom"
  | "landmarks"
  | "viewport-shell"
  | "data-hierarchy"
  | "scene-graph"
  | "mixed";

const UI_SOURCE_OF_TRUTHS: readonly UiSourceOfTruth[] = [
  "semantic-dom",
  "landmarks",
  "viewport-shell",
  "data-hierarchy",
  "scene-graph",
  "mixed",
];

export type UiMarkerKind =
  | "primary-cta"
  | "next-section"
  | "media-slot"
  | "hero-title"
  | "scrollport"
  | "selected"
  | "unread"
  | "game-state"
  | "custom";

export interface UiMarkerContract {
  id?: string;
  kind: UiMarkerKind;
  name?: string;
  selector?: string;
  attribute?: string;
  value?: string;
  required?: boolean;
  target?: string;
  notes?: string;
}

export type UiStateKind =
  | "hover"
  | "focus-visible"
  | "selected"
  | "scrolled"
  | "empty"
  | "loading"
  | "error"
  | "playing"
  | "paused"
  | "result";

export interface UiStateContract {
  id: string;
  kind: UiStateKind;
  selector?: string;
  trigger?: string;
  viewport?: string;
  required?: boolean;
}

export interface UiRequiredStateContract extends UiStateContract {
  minChangeRatio?: number;
}

export type UiScrollAxis = "x" | "y" | "both";

export interface UiExpectedScrollportContract {
  id: string;
  name?: string;
  selector?: string;
  axis?: UiScrollAxis;
  required?: boolean;
  minOverflow?: number;
  landmarkId?: string;
}

export type UiCompositionStyle =
  | "regular"
  | "asymmetric"
  | "poster"
  | "collage"
  | "radial"
  | "layered";

export type UiCompositionAxis =
  | "orthogonal"
  | "diagonal"
  | "radial"
  | "freeform"
  | "layered";

export interface UiCompositionContract {
  style: UiCompositionStyle;
  axes?: UiCompositionAxis[];
  layers?: UiCompositionLayer[];
  shapes?: UiCompositionShape[];
  motion?: UiMotionContract[];
  contrast?: UiContrastContract;
}

export type UiCompositionLayerRole =
  | "background"
  | "content"
  | "accent"
  | "foreground"
  | "scrim";

export interface UiCompositionLayer {
  id: string;
  role: UiCompositionLayerRole;
  target?: string;
  z?: number;
  overlap?: "allowed" | "avoid-text" | "none";
  transform?: string;
}

export type UiCompositionShapeKind =
  | "slash-panel"
  | "sticker"
  | "burst"
  | "cutout"
  | "mask"
  | "frame"
  | "ribbon";

export interface UiCompositionShape {
  id: string;
  kind: UiCompositionShapeKind;
  role?: string;
  target?: string;
  clipPath?: string;
}

export interface UiMotionContract {
  id: string;
  trigger: "hover" | "focus" | "selected" | "route" | "load";
  effect: "slam" | "pulse" | "slide" | "scale" | "flash" | "none";
  durationMs?: number;
  target?: string;
}

export interface UiContrastContract {
  mode: "normal" | "high";
  minRatio?: number;
  palette?: string[];
  textOverAccent?: boolean;
}

export type UiSlotKind =
  | "content"
  | "media"
  | "control"
  | "list"
  | "canvas"
  | "adornment";

export interface UiSlotContract {
  id: string;
  kind: UiSlotKind;
  name?: string;
  marker?: UiMarkerKind;
  gridArea?: string;
  required?: boolean;
}

export interface UiRepeatContract {
  kind: "list" | "grid" | "table" | "feed";
  itemName?: string;
  minItems?: number;
  maxItems?: number;
}

export type UiContentKind = "static" | "list" | "table" | "chart" | "form" | "canvas" | "generated";
export type UiDensity = "sparse" | "normal" | "dense";

export interface UiContentContract {
  kind: UiContentKind;
  density?: UiDensity;
  items?: {
    exact?: number;
    min?: number;
    max?: number;
  };
  text?: {
    minLength?: number;
    maxLength?: number;
    rowCount?: number;
  };
}

export interface UiDecorationContract {
  tokens?: UiTokenRef[];
  typography?: UiTypographyContract[];
  palette?: UiColorContract[];
  radius?: UiTokenRef[];
  shadow?: UiTokenRef[];
  media?: UiMediaTreatment[];
}

export interface UiTokenRef {
  role: string;
  token?: string;
  value?: string | number;
}

export interface UiTypographyContract {
  role: string;
  family?: string;
  size?: number;
  lineHeight?: number;
  weight?: number | string;
  maxLines?: number;
}

export interface UiColorContract {
  role: string;
  token?: string;
  value?: string;
}

export interface UiMediaTreatment {
  slot: string;
  crop?: "contain" | "cover" | "fill" | "none";
  aspectRatio?: string;
  policy?: "replaceable" | "literal" | "generated";
}

export type UiAssetKind = "image" | "svg" | "icon" | "canvas-sprite" | "tilemap" | "procedural" | "video";
export type UiAssetPolicy = "replaceable" | "literal" | "generated" | "procedural";

export interface UiAssetContract {
  id: string;
  kind: UiAssetKind;
  slot?: string;
  policy?: UiAssetPolicy;
  required?: boolean;
}

export interface UiCanvasContract {
  stateHook?: string;
  requiredStateFields?: string[];
  frameDelta?: boolean;
  inputs?: UiCanvasInputContract[];
  hud?: UiCanvasHudContract[];
}

export interface UiCanvasInputContract {
  kind: "keyboard" | "pointer" | "touch" | "gamepad";
  action: string;
  changes?: string[];
}

export interface UiCanvasHudContract {
  id: string;
  text?: string;
  readable?: boolean;
  avoidOverlap?: boolean;
}

export interface UiLayoutContract {
  width: UiWidthPolicy;
  height: UiHeightPolicy;
  display: UiDisplayPolicy;
  scroll: UiScrollPolicy;
}

export type UiWidthPolicy =
  | { kind: "fluid"; min?: number; max?: number }
  | { kind: "fixed"; value: number }
  | { kind: "intrinsic"; max?: number };

export type UiHeightPolicy =
  | { kind: "content"; min?: number; max?: number }
  | { kind: "fixed"; value: number }
  | { kind: "scrollport"; min?: number; max: number };

export type UiDisplayPolicy =
  | { kind: "block" }
  | { kind: "flex"; direction: "row" | "column"; gap?: number }
  | {
      kind: "grid";
      columns: string[];
      rows: string[];
      areas?: string[][];
      gap?: { row?: number; column?: number };
    }
  | { kind: "subgrid"; axis: "rows" | "columns" | "both" };

export interface UiScrollPolicy {
  x: boolean;
  y: boolean;
}

export interface UiResponsiveRule {
  viewport: string;
  width?: UiWidthPolicy;
  height?: UiHeightPolicy;
  display?: UiDisplayPolicy;
  scroll?: UiScrollPolicy;
}

export interface UiContractIssue {
  path: string;
  message: string;
}

export function validateUiContract(contract: UiContract): UiContractIssue[] {
  const issues: UiContractIssue[] = [];
  if (contract.version !== 1) {
    issues.push({ path: "version", message: "unsupported UI contract version" });
  }
  for (let si = 0; si < contract.screens.length; si++) {
    const screen = contract.screens[si]!;
    const screenPath = `screens[${si}]`;
    if (!screen.id) issues.push({ path: `${screenPath}.id`, message: "screen id is required" });
    if (screen.pattern && !includesString(UI_CONTRACT_PATTERNS, screen.pattern)) {
      issues.push({ path: `${screenPath}.pattern`, message: "unknown UI contract pattern" });
    }
    if (screen.goal && !includesString(UI_CONTRACT_GOALS, screen.goal)) {
      issues.push({ path: `${screenPath}.goal`, message: "unknown UI contract goal" });
    }
    if (screen.sourceOfTruth && !includesString(UI_SOURCE_OF_TRUTHS, screen.sourceOfTruth)) {
      issues.push({ path: `${screenPath}.sourceOfTruth`, message: "unknown source of truth" });
    }
    validateMarkers(screen.markers, `${screenPath}.markers`, issues);
    validateStates(screen.states, `${screenPath}.states`, issues);
    validateRequiredStates(screen.requiredStates, `${screenPath}.requiredStates`, issues);
    validateExpectedScrollports(screen.expectedScrollports, `${screenPath}.expectedScrollports`, issues);
    validateComposition(screen.composition, `${screenPath}.composition`, issues);
    validateContent(screen.content, `${screenPath}.content`, issues);
    validateDecoration(screen.decoration, `${screenPath}.decoration`, issues);
    validateAssets(screen.assets, `${screenPath}.assets`, issues);
    validateCanvas(screen.canvas, `${screenPath}.canvas`, issues);
    const viewportLabels = new Set<string>();
    for (let vi = 0; vi < screen.viewports.length; vi++) {
      const vp = screen.viewports[vi]!;
      const vpPath = `${screenPath}.viewports[${vi}]`;
      if (!vp.label) issues.push({ path: `${vpPath}.label`, message: "viewport label is required" });
      if (viewportLabels.has(vp.label)) issues.push({ path: `${vpPath}.label`, message: "viewport label must be unique" });
      viewportLabels.add(vp.label);
      if (vp.width <= 0 || vp.height <= 0) {
        issues.push({ path: vpPath, message: "viewport width and height must be positive" });
      }
      if (vp.dpr !== undefined && vp.dpr <= 0) {
        issues.push({ path: `${vpPath}.dpr`, message: "viewport dpr must be positive" });
      }
    }
    for (let li = 0; li < screen.landmarks.length; li++) {
      const lm = screen.landmarks[li]!;
      const lmPath = `${screenPath}.landmarks[${li}]`;
      if ((lm.role as string) === "landmark") {
        issues.push({ path: `${lmPath}.role`, message: "abstract landmark role is not allowed; use a concrete landmark role" });
      }
      if (!lm.id) issues.push({ path: `${lmPath}.id`, message: "landmark id is required" });
      if ((lm.role === "region" || lm.role === "form") && !lm.name.trim()) {
        issues.push({ path: `${lmPath}.name`, message: `${lm.role} landmarks require an accessible name` });
      }
      if (lm.parentId && !screen.landmarks.some((candidate) => candidate.id === lm.parentId)) {
        issues.push({ path: `${lmPath}.parentId`, message: "unknown parentId landmark" });
      }
      validateSlots(lm.slots, `${lmPath}.slots`, issues);
      validateRepeat(lm.repeat, `${lmPath}.repeat`, issues);
      validateMarkers(lm.markers, `${lmPath}.markers`, issues);
      validateStates(lm.states, `${lmPath}.states`, issues);
      validateComposition(lm.composition, `${lmPath}.composition`, issues);
      validateContent(lm.content, `${lmPath}.content`, issues);
      validateDecoration(lm.decoration, `${lmPath}.decoration`, issues);
      validateAssets(lm.assets, `${lmPath}.assets`, issues);
      validateLayoutPolicy(
        lm.layout.width,
        lm.layout.height,
        lm.layout.display,
        `${lmPath}.layout`,
        issues,
      );
      for (let ri = 0; ri < (lm.responsive?.length ?? 0); ri++) {
        const rule = lm.responsive![ri]!;
        const rulePath = `${lmPath}.responsive[${ri}]`;
        if (!viewportLabels.has(rule.viewport)) {
          issues.push({ path: `${rulePath}.viewport`, message: "responsive rule references an unknown viewport" });
        }
        validateLayoutPolicy(rule.width, rule.height, rule.display, rulePath, issues);
      }
    }
    validatePatternEvidence(screen, screenPath, issues);
  }
  return issues;
}

function includesString(values: readonly string[], value: string): boolean {
  return values.includes(value);
}

function validateMarkers(
  markers: UiMarkerContract[] | undefined,
  path: string,
  issues: UiContractIssue[],
): void {
  for (let i = 0; i < (markers?.length ?? 0); i++) {
    const marker = markers![i]!;
    const markerPath = `${path}[${i}]`;
    const issueIds = computeUiContractMarkerIssueIds({
      kind: marker.kind,
      required: Boolean(marker.required),
      hasSelector: Boolean(marker.selector),
      hasAttribute: Boolean(marker.attribute),
      hasTarget: Boolean(marker.target),
    });
    for (const issueId of issueIds) {
      issues.push(uiContractMarkerIssue(issueId, markerPath));
    }
  }
}

function uiContractMarkerIssue(
  issueId: MarkupCoreUiContractMarkerIssueId,
  path: string,
): UiContractIssue {
  switch (issueId) {
    case "marker-kind-unknown":
      return { path: `${path}.kind`, message: "unknown marker kind" };
    case "marker-target-required":
      return { path, message: "required marker must declare selector, attribute, or target" };
  }
}

function validateStates(
  states: UiStateContract[] | undefined,
  path: string,
  issues: UiContractIssue[],
): void {
  for (let i = 0; i < (states?.length ?? 0); i++) {
    validateStateContract(states![i]!, `${path}[${i}]`, issues);
  }
}

function validateStateContract(
  state: UiStateContract,
  path: string,
  issues: UiContractIssue[],
): void {
  const issueIds = computeUiContractStateIssueIds({
    id: state.id,
    kind: state.kind,
    required: Boolean(state.required),
    hasSelector: Boolean(state.selector),
    hasTrigger: Boolean(state.trigger),
  });
  for (const issueId of issueIds) {
    issues.push(uiContractStateIssue(issueId, path));
  }
}

function validateRequiredStates(
  states: UiRequiredStateContract[] | undefined,
  path: string,
  issues: UiContractIssue[],
): void {
  const ids = new Set<string>();
  for (let i = 0; i < (states?.length ?? 0); i++) {
    const state = states![i]!;
    const statePath = `${path}[${i}]`;
    const duplicateId = Boolean(state.id && ids.has(state.id));
    const issueIds = computeUiContractRequiredStateIssueIds({
      id: state.id,
      kind: state.kind,
      required: Boolean(state.required),
      hasSelector: Boolean(state.selector),
      hasTrigger: Boolean(state.trigger),
      duplicateId,
      minChangeRatioPresent: state.minChangeRatio !== undefined,
      minChangeRatio: state.minChangeRatio ?? 0,
    });
    for (const issueId of issueIds) {
      issues.push(uiContractRequiredStateIssue(issueId, statePath));
    }
    if (state.id) {
      ids.add(state.id);
    }
  }
}

function validateExpectedScrollports(
  scrollports: UiExpectedScrollportContract[] | undefined,
  path: string,
  issues: UiContractIssue[],
): void {
  const ids = new Set<string>();
  for (let i = 0; i < (scrollports?.length ?? 0); i++) {
    const scrollport = scrollports![i]!;
    const scrollportPath = `${path}[${i}]`;
    const duplicateId = Boolean(scrollport.id && ids.has(scrollport.id));
    const issueIds = computeUiContractExpectedScrollportIssueIds({
      id: scrollport.id,
      axis: scrollport.axis ?? "",
      required: Boolean(scrollport.required),
      hasSelector: Boolean(scrollport.selector),
      hasName: Boolean(scrollport.name),
      hasLandmarkId: Boolean(scrollport.landmarkId),
      duplicateId,
      minOverflowPresent: scrollport.minOverflow !== undefined,
      minOverflow: scrollport.minOverflow ?? 0,
    });
    for (const issueId of issueIds) {
      issues.push(uiContractExpectedScrollportIssue(issueId, scrollportPath));
    }
    if (scrollport.id) {
      ids.add(scrollport.id);
    }
  }
}

function uiContractStateIssue(
  issueId: MarkupCoreUiContractStateIssueId,
  path: string,
): UiContractIssue {
  switch (issueId) {
    case "state-id-required":
      return { path: `${path}.id`, message: "state id is required" };
    case "state-kind-unknown":
      return { path: `${path}.kind`, message: "unknown state kind" };
    case "state-target-required":
      return { path, message: "required state must declare selector or trigger" };
  }
}

function uiContractRequiredStateIssue(
  issueId: MarkupCoreUiContractRequiredStateIssueId,
  path: string,
): UiContractIssue {
  switch (issueId) {
    case "required-state-id-unique":
      return { path: `${path}.id`, message: "required state id must be unique" };
    case "required-state-min-change-ratio":
      return { path: `${path}.minChangeRatio`, message: "required state minChangeRatio must be between 0 and 1" };
    default:
      return uiContractStateIssue(issueId, path);
  }
}

function uiContractExpectedScrollportIssue(
  issueId: MarkupCoreUiContractExpectedScrollportIssueId,
  path: string,
): UiContractIssue {
  switch (issueId) {
    case "expected-scrollport-id-required":
      return { path: `${path}.id`, message: "expected scrollport id is required" };
    case "expected-scrollport-id-unique":
      return { path: `${path}.id`, message: "expected scrollport id must be unique" };
    case "expected-scrollport-axis-unknown":
      return { path: `${path}.axis`, message: "unknown expected scrollport axis" };
    case "expected-scrollport-target-required":
      return { path, message: "required expected scrollport must declare selector, name, or landmarkId" };
    case "expected-scrollport-min-overflow":
      return { path: `${path}.minOverflow`, message: "expected scrollport minOverflow must be non-negative" };
  }
}

function validateSlots(
  slots: UiSlotContract[] | undefined,
  path: string,
  issues: UiContractIssue[],
): void {
  for (let i = 0; i < (slots?.length ?? 0); i++) {
    const slot = slots![i]!;
    const slotPath = `${path}[${i}]`;
    const issueIds = computeUiContractSlotIssueIds({ id: slot.id });
    for (const issueId of issueIds) {
      issues.push(uiContractSlotIssue(issueId, slotPath));
    }
  }
}

function uiContractSlotIssue(
  issueId: MarkupCoreUiContractSlotIssueId,
  path: string,
): UiContractIssue {
  switch (issueId) {
    case "slot-id-required":
      return { path: `${path}.id`, message: "slot id is required" };
  }
}

function validateRepeat(
  repeat: UiRepeatContract | undefined,
  path: string,
  issues: UiContractIssue[],
): void {
  if (!repeat) return;
  validateOptionalRange(repeat.minItems, repeat.maxItems, path, issues);
}

function validateComposition(
  composition: UiCompositionContract | undefined,
  path: string,
  issues: UiContractIssue[],
): void {
  if (!composition) return;
  for (const issueId of computeUiContractCompositionIssueIds({ style: composition.style })) {
    issues.push(uiContractCompositionIssue(issueId, path));
  }
  for (let i = 0; i < (composition.axes?.length ?? 0); i++) {
    const axis = composition.axes![i]!;
    const axisPath = `${path}.axes[${i}]`;
    for (const issueId of computeUiContractCompositionAxisIssueIds({ axis })) {
      issues.push(uiContractCompositionAxisIssue(issueId, axisPath));
    }
  }
  const layerIds = new Set<string>();
  for (let i = 0; i < (composition.layers?.length ?? 0); i++) {
    const layer = composition.layers![i]!;
    const layerPath = `${path}.layers[${i}]`;
    const duplicateId = Boolean(layer.id && layerIds.has(layer.id));
    const issueIds = computeUiContractCompositionLayerIssueIds({
      id: layer.id,
      role: layer.role,
      duplicateId,
      zPresent: layer.z !== undefined,
      zFinite: Number.isFinite(layer.z),
    });
    for (const issueId of issueIds) {
      issues.push(uiContractCompositionLayerIssue(issueId, layerPath));
    }
    if (layer.id) {
      layerIds.add(layer.id);
    }
  }
  const shapeIds = new Set<string>();
  for (let i = 0; i < (composition.shapes?.length ?? 0); i++) {
    const shape = composition.shapes![i]!;
    const shapePath = `${path}.shapes[${i}]`;
    const duplicateId = Boolean(shape.id && shapeIds.has(shape.id));
    const issueIds = computeUiContractCompositionShapeIssueIds({
      id: shape.id,
      kind: shape.kind,
      duplicateId,
    });
    for (const issueId of issueIds) {
      issues.push(uiContractCompositionShapeIssue(issueId, shapePath));
    }
    if (shape.id) {
      shapeIds.add(shape.id);
    }
  }
  const motionIds = new Set<string>();
  for (let i = 0; i < (composition.motion?.length ?? 0); i++) {
    const motion = composition.motion![i]!;
    const motionPath = `${path}.motion[${i}]`;
    const duplicateId = Boolean(motion.id && motionIds.has(motion.id));
    const issueIds = computeUiContractCompositionMotionIssueIds({
      id: motion.id,
      trigger: motion.trigger,
      effect: motion.effect,
      duplicateId,
      durationPresent: motion.durationMs !== undefined,
      durationMs: motion.durationMs ?? 0,
    });
    for (const issueId of issueIds) {
      issues.push(uiContractCompositionMotionIssue(issueId, motionPath));
    }
    if (motion.id) {
      motionIds.add(motion.id);
    }
  }
  if (composition.contrast) {
    const contrastPath = `${path}.contrast`;
    const issueIds = computeUiContractCompositionContrastIssueIds({
      mode: composition.contrast.mode,
      minRatioPresent: composition.contrast.minRatio !== undefined,
      minRatio: composition.contrast.minRatio ?? 0,
    });
    for (const issueId of issueIds) {
      issues.push(uiContractCompositionContrastIssue(issueId, contrastPath));
    }
    for (let i = 0; i < (composition.contrast.palette?.length ?? 0); i++) {
      const value = composition.contrast.palette![i]!;
      const palettePath = `${contrastPath}.palette[${i}]`;
      const paletteIssueIds = computeUiContractCompositionContrastPaletteIssueIds({ value });
      for (const issueId of paletteIssueIds) {
        issues.push(uiContractCompositionContrastPaletteIssue(issueId, palettePath));
      }
    }
  }
}

function uiContractCompositionIssue(
  issueId: MarkupCoreUiContractCompositionIssueId,
  path: string,
): UiContractIssue {
  switch (issueId) {
    case "composition-style-unknown":
      return { path: `${path}.style`, message: "unknown composition style" };
  }
}

function uiContractCompositionAxisIssue(
  issueId: MarkupCoreUiContractCompositionAxisIssueId,
  path: string,
): UiContractIssue {
  switch (issueId) {
    case "composition-axis-unknown":
      return { path, message: "unknown composition axis" };
  }
}

function uiContractCompositionLayerIssue(
  issueId: MarkupCoreUiContractCompositionLayerIssueId,
  path: string,
): UiContractIssue {
  switch (issueId) {
    case "composition-layer-id-required":
      return { path: `${path}.id`, message: "composition layer id is required" };
    case "composition-layer-id-unique":
      return { path: `${path}.id`, message: "composition layer id must be unique" };
    case "composition-layer-role-unknown":
      return { path: `${path}.role`, message: "unknown composition layer role" };
    case "composition-layer-z-finite":
      return { path: `${path}.z`, message: "composition layer z must be finite" };
  }
}

function uiContractCompositionShapeIssue(
  issueId: MarkupCoreUiContractCompositionShapeIssueId,
  path: string,
): UiContractIssue {
  switch (issueId) {
    case "composition-shape-id-required":
      return { path: `${path}.id`, message: "composition shape id is required" };
    case "composition-shape-id-unique":
      return { path: `${path}.id`, message: "composition shape id must be unique" };
    case "composition-shape-kind-unknown":
      return { path: `${path}.kind`, message: "unknown composition shape kind" };
  }
}

function uiContractCompositionMotionIssue(
  issueId: MarkupCoreUiContractCompositionMotionIssueId,
  path: string,
): UiContractIssue {
  switch (issueId) {
    case "motion-id-required":
      return { path: `${path}.id`, message: "motion id is required" };
    case "motion-id-unique":
      return { path: `${path}.id`, message: "motion id must be unique" };
    case "motion-trigger-unknown":
      return { path: `${path}.trigger`, message: "unknown motion trigger" };
    case "motion-effect-unknown":
      return { path: `${path}.effect`, message: "unknown motion effect" };
    case "motion-duration-non-negative":
      return { path: `${path}.durationMs`, message: "durationMs must be non-negative" };
  }
}

function uiContractCompositionContrastIssue(
  issueId: MarkupCoreUiContractCompositionContrastIssueId,
  path: string,
): UiContractIssue {
  switch (issueId) {
    case "contrast-mode-unknown":
      return { path: `${path}.mode`, message: "unknown contrast mode" };
    case "contrast-min-ratio-positive":
      return { path: `${path}.minRatio`, message: "contrast minRatio must be positive" };
  }
}

function uiContractCompositionContrastPaletteIssue(
  issueId: MarkupCoreUiContractCompositionContrastPaletteIssueId,
  path: string,
): UiContractIssue {
  switch (issueId) {
    case "contrast-palette-value-hex":
      return { path, message: "composition contrast palette value must be a hex color" };
  }
}

function validateContent(
  content: UiContentContract | undefined,
  path: string,
  issues: UiContractIssue[],
): void {
  if (!content) return;
  if (content.items) {
    validateOptionalRange(content.items.min, content.items.max, `${path}.items`, issues);
    const issueIds = computeUiContractContentItemsIssueIds({
      exact: content.items.exact,
    });
    for (const issueId of issueIds) {
      issues.push(uiContractContentItemsIssue(issueId, `${path}.items`));
    }
  }
  if (content.text) {
    validateOptionalRange(content.text.minLength, content.text.maxLength, `${path}.text`, issues);
    const issueIds = computeUiContractContentTextIssueIds({
      rowCount: content.text.rowCount,
    });
    for (const issueId of issueIds) {
      issues.push(uiContractContentTextIssue(issueId, `${path}.text`));
    }
  }
}

function uiContractContentItemsIssue(
  issueId: MarkupCoreUiContractContentItemsIssueId,
  path: string,
): UiContractIssue {
  switch (issueId) {
    case "content-items-exact-non-negative":
      return { path: `${path}.exact`, message: "exact must be non-negative" };
  }
}

function uiContractContentTextIssue(
  issueId: MarkupCoreUiContractContentTextIssueId,
  path: string,
): UiContractIssue {
  switch (issueId) {
    case "content-text-row-count-non-negative":
      return { path: `${path}.rowCount`, message: "rowCount must be non-negative" };
  }
}

function validateOptionalRange(
  min: number | undefined,
  max: number | undefined,
  path: string,
  issues: UiContractIssue[],
): void {
  const issueIds = computeUiContractOptionalRangeIssueIds({ min, max });
  for (const issueId of issueIds) {
    issues.push(uiContractRangeIssue(issueId, path));
  }
}

function uiContractRangeIssue(
  issueId: MarkupCoreUiContractRangeIssueId,
  path: string,
): UiContractIssue {
  switch (issueId) {
    case "range-min-non-negative":
      return { path: `${path}.min`, message: "min must be non-negative" };
    case "range-max-non-negative":
      return { path: `${path}.max`, message: "max must be non-negative" };
    case "range-min-lte-max":
      return { path, message: "min cannot exceed max" };
  }
}

function validateDecoration(
  decoration: UiDecorationContract | undefined,
  path: string,
  issues: UiContractIssue[],
): void {
  if (!decoration) return;
  for (let i = 0; i < (decoration.typography?.length ?? 0); i++) {
    const typo = decoration.typography![i]!;
    const typoPath = `${path}.typography[${i}]`;
    const issueIds = computeUiContractDecorationTypographyIssueIds({
      role: typo.role,
      size: typo.size,
      lineHeight: typo.lineHeight,
    });
    for (const issueId of issueIds) {
      issues.push(uiContractDecorationTypographyIssue(issueId, typoPath));
    }
  }
  for (let i = 0; i < (decoration.palette?.length ?? 0); i++) {
    const color = decoration.palette![i]!;
    const colorPath = `${path}.palette[${i}]`;
    const issueIds = computeUiContractDecorationPaletteIssueIds({
      role: color.role,
      value: color.value,
    });
    for (const issueId of issueIds) {
      issues.push(uiContractDecorationPaletteIssue(issueId, colorPath));
    }
  }
  for (let i = 0; i < (decoration.media?.length ?? 0); i++) {
    const media = decoration.media![i]!;
    const mediaPath = `${path}.media[${i}]`;
    const issueIds = computeUiContractDecorationMediaIssueIds({ slot: media.slot });
    for (const issueId of issueIds) {
      issues.push(uiContractDecorationMediaIssue(issueId, mediaPath));
    }
  }
}

function uiContractDecorationTypographyIssue(
  issueId: MarkupCoreUiContractDecorationTypographyIssueId,
  path: string,
): UiContractIssue {
  switch (issueId) {
    case "typography-role-required":
      return { path: `${path}.role`, message: "typography role is required" };
    case "typography-size-positive":
      return { path: `${path}.size`, message: "typography size must be positive" };
    case "typography-line-height-positive":
      return { path: `${path}.lineHeight`, message: "lineHeight must be positive" };
  }
}

function uiContractDecorationPaletteIssue(
  issueId: MarkupCoreUiContractDecorationPaletteIssueId,
  path: string,
): UiContractIssue {
  switch (issueId) {
    case "palette-role-required":
      return { path: `${path}.role`, message: "palette role is required" };
    case "palette-value-hex":
      return { path: `${path}.value`, message: "palette value must be a hex color" };
  }
}

function uiContractDecorationMediaIssue(
  issueId: MarkupCoreUiContractDecorationMediaIssueId,
  path: string,
): UiContractIssue {
  switch (issueId) {
    case "media-slot-required":
      return { path: `${path}.slot`, message: "media treatment slot is required" };
  }
}

function validateAssets(
  assets: UiAssetContract[] | undefined,
  path: string,
  issues: UiContractIssue[],
): void {
  for (let i = 0; i < (assets?.length ?? 0); i++) {
    const asset = assets![i]!;
    const assetPath = `${path}[${i}]`;
    const issueIds = computeUiContractAssetIssueIds({ id: asset.id });
    for (const issueId of issueIds) {
      issues.push(uiContractAssetIssue(issueId, assetPath));
    }
  }
}

function uiContractAssetIssue(
  issueId: MarkupCoreUiContractAssetIssueId,
  path: string,
): UiContractIssue {
  switch (issueId) {
    case "asset-id-required":
      return { path: `${path}.id`, message: "asset id is required" };
  }
}

function validateCanvas(
  canvas: UiCanvasContract | undefined,
  path: string,
  issues: UiContractIssue[],
): void {
  if (!canvas) return;
  const issueIds = computeUiContractCanvasIssueIds({
    hasStateHook: Boolean(canvas.stateHook),
    requiredStateFieldCount: canvas.requiredStateFields?.length ?? 0,
  });
  for (const issueId of issueIds) {
    issues.push(uiContractCanvasIssue(issueId, path));
  }
  for (let i = 0; i < (canvas.inputs?.length ?? 0); i++) {
    const input = canvas.inputs![i]!;
    const inputPath = `${path}.inputs[${i}]`;
    const inputIssueIds = computeUiContractCanvasInputIssueIds({ action: input.action });
    for (const issueId of inputIssueIds) {
      issues.push(uiContractCanvasInputIssue(issueId, inputPath));
    }
  }
  for (let i = 0; i < (canvas.hud?.length ?? 0); i++) {
    const hud = canvas.hud![i]!;
    const hudPath = `${path}.hud[${i}]`;
    const hudIssueIds = computeUiContractCanvasHudIssueIds({ id: hud.id });
    for (const issueId of hudIssueIds) {
      issues.push(uiContractCanvasHudIssue(issueId, hudPath));
    }
  }
}

function uiContractCanvasIssue(
  issueId: MarkupCoreUiContractCanvasIssueId,
  path: string,
): UiContractIssue {
  switch (issueId) {
    case "canvas-state-hook-required":
      return { path: `${path}.stateHook`, message: "canvas stateHook is required when requiredStateFields are declared" };
  }
}

function uiContractCanvasInputIssue(
  issueId: MarkupCoreUiContractCanvasInputIssueId,
  path: string,
): UiContractIssue {
  switch (issueId) {
    case "canvas-input-action-required":
      return { path: `${path}.action`, message: "canvas input action is required" };
  }
}

function uiContractCanvasHudIssue(
  issueId: MarkupCoreUiContractCanvasHudIssueId,
  path: string,
): UiContractIssue {
  switch (issueId) {
    case "canvas-hud-id-required":
      return { path: `${path}.id`, message: "canvas HUD id is required" };
  }
}

function validatePatternEvidence(
  screen: UiContractScreen,
  screenPath: string,
  issues: UiContractIssue[],
): void {
  const markerKinds = collectMarkers(screen).map((marker) => marker.kind);
  const requiredStateKinds = [
    ...(screen.states ?? []).filter((state) => state.required).map((state) => state.kind),
    ...(screen.requiredStates ?? []).map((state) => state.kind),
  ];
  const issueIds = computeUiContractPatternEvidenceIssueIds({
    pattern: screen.pattern ?? screen.goal,
    markerKinds,
    requiredStateKinds,
    stateKinds: (screen.states ?? []).map((state) => state.kind),
    expectedScrollportCount: screen.expectedScrollports?.length ?? 0,
    hasComposition: Boolean(screen.composition),
    hasCanvasStateHook: Boolean(screen.canvas?.stateHook),
    canvasRequiredStateFields: screen.canvas?.requiredStateFields ?? [],
  });
  for (const issueId of issueIds) {
    issues.push(uiContractPatternEvidenceIssue(issueId, screenPath));
  }
}

function uiContractPatternEvidenceIssue(
  issueId: MarkupCoreUiContractPatternEvidenceIssueId,
  screenPath: string,
): UiContractIssue {
  switch (issueId) {
    case "landing-marker-primary-cta":
      return { path: `${screenPath}.markers`, message: "landing contracts should include primary-cta marker evidence" };
    case "landing-marker-media-slot":
      return { path: `${screenPath}.markers`, message: "landing contracts should include media-slot marker evidence" };
    case "landing-marker-next-section":
      return { path: `${screenPath}.markers`, message: "landing contracts should include next-section marker evidence" };
    case "app-shell-marker-scrollport":
      return { path: `${screenPath}.markers`, message: "app-shell contracts should include scrollport marker evidence" };
    case "app-shell-expected-scrollports":
      return { path: `${screenPath}.expectedScrollports`, message: "app-shell contracts should declare expectedScrollports" };
    case "app-shell-state-selected":
      return { path: `${screenPath}.requiredStates`, message: "app-shell contracts should require a selected state" };
    case "app-shell-state-scrolled":
      return { path: `${screenPath}.requiredStates`, message: "app-shell contracts should require a scrolled state" };
    case "canvas-state-hook":
      return { path: `${screenPath}.canvas.stateHook`, message: "canvas contracts should include a stateHook" };
    case "canvas-state-field-mode":
      return { path: `${screenPath}.canvas.requiredStateFields`, message: "canvas contracts should include mode state field" };
    case "canvas-state-field-frame":
      return { path: `${screenPath}.canvas.requiredStateFields`, message: "canvas contracts should include frame state field" };
    case "canvas-state-field-playerX":
      return { path: `${screenPath}.canvas.requiredStateFields`, message: "canvas contracts should include playerX state field" };
    case "canvas-state-field-playerY":
      return { path: `${screenPath}.canvas.requiredStateFields`, message: "canvas contracts should include playerY state field" };
    case "canvas-state-field-score":
      return { path: `${screenPath}.canvas.requiredStateFields`, message: "canvas contracts should include score state field" };
    case "canvas-state-field-assetsReady":
      return { path: `${screenPath}.canvas.requiredStateFields`, message: "canvas contracts should include assetsReady state field" };
    case "expressive-menu-composition":
      return { path: `${screenPath}.composition`, message: "expressive-menu contracts should include composition metadata" };
    case "expressive-menu-state-evidence":
      return { path: `${screenPath}.states`, message: "expressive-menu contracts should include selected or focus-visible state evidence" };
    case "expressive-menu-required-selected":
      return { path: `${screenPath}.requiredStates`, message: "expressive-menu contracts should require selected state" };
    case "expressive-menu-required-hover":
      return { path: `${screenPath}.requiredStates`, message: "expressive-menu contracts should require hover state" };
    case "expressive-menu-required-focus-visible":
      return { path: `${screenPath}.requiredStates`, message: "expressive-menu contracts should require focus-visible state" };
  }
}

function collectMarkers(screen: UiContractScreen): UiMarkerContract[] {
  return [
    ...(screen.markers ?? []),
    ...screen.landmarks.flatMap((landmark) => landmark.markers ?? []),
  ];
}

function validateLayoutPolicy(
  width: UiWidthPolicy | undefined,
  height: UiHeightPolicy | undefined,
  display: UiDisplayPolicy | undefined,
  path: string,
  issues: UiContractIssue[],
): void {
  const issueIds = computeUiContractLayoutIssueIds({
    widthKind: width?.kind,
    widthMinPresent: width?.kind === "fluid" && width.min !== undefined,
    widthMaxPresent: width?.kind === "fluid" && width.max !== undefined,
    widthValue: width?.kind === "fixed" ? width.value : 0,
    heightKind: height?.kind,
    heightValue: height?.kind === "fixed" ? height.value : 0,
    heightMax: height?.kind === "scrollport" ? height.max : 0,
    displayKind: display?.kind,
    displayColumnsCount: display?.kind === "grid" ? display.columns.length : 0,
    displayRowsCount: display?.kind === "grid" ? display.rows.length : 0,
  });
  for (const issueId of issueIds) {
    issues.push(uiContractLayoutIssue(issueId, path));
  }
}

function uiContractLayoutIssue(
  issueId: MarkupCoreUiContractLayoutIssueId,
  path: string,
): UiContractIssue {
  switch (issueId) {
    case "layout-width-fluid-bounds":
      return { path: `${path}.width`, message: "fluid width must declare min or max" };
    case "layout-width-fixed-positive":
      return { path: `${path}.width`, message: "fixed width must be positive" };
    case "layout-height-fixed-positive":
      return { path: `${path}.height`, message: "fixed height must be positive" };
    case "layout-height-scrollport-max-positive":
      return { path: `${path}.height`, message: "scrollport height must declare a positive max" };
    case "layout-grid-columns":
      return { path: `${path}.display.columns`, message: "grid display requires at least one column track" };
    case "layout-grid-rows":
      return { path: `${path}.display.rows`, message: "grid display requires at least one row track" };
  }
}

export function summarizeUiContractLandmark(landmark: UiContractLandmark): string {
  const details = [
    summarizeWidth(landmark.layout.width),
    summarizeHeight(landmark.layout.height),
    summarizeScroll(landmark.layout.scroll),
    summarizeDisplay(landmark.layout.display),
  ].filter(Boolean).join(", ");
  return `${landmark.role} "${landmark.name}": ${details}`;
}

export function summarizeUiContractScreen(screen: UiContractScreen): string {
  const parts = [
    `screen ${screen.id}`,
    screen.pattern ? `pattern ${screen.pattern}` : "",
    screen.goal ? `goal ${screen.goal}` : "",
    screen.sourceOfTruth ? `source ${screen.sourceOfTruth}` : "",
    `viewports ${screen.viewports.length}`,
    `landmarks ${screen.landmarks.length}`,
    screen.markers?.length ? `markers ${screen.markers.length}` : "",
    screen.states?.length ? `states ${screen.states.length}` : "",
    screen.requiredStates?.length ? `required states ${screen.requiredStates.length}` : "",
    screen.expectedScrollports?.length ? `expected scrollports ${screen.expectedScrollports.length}` : "",
    screen.composition ? `composition ${screen.composition.style}` : "",
    screen.assets?.length ? `assets ${screen.assets.length}` : "",
    screen.canvas ? "canvas" : "",
  ].filter(Boolean);
  return parts.join(", ");
}

function summarizeWidth(width: UiWidthPolicy): string {
  switch (width.kind) {
    case "fixed":
      return `fixed ${width.value}px`;
    case "intrinsic":
      return width.max ? `intrinsic max ${width.max}px` : "intrinsic";
    case "fluid": {
      if (width.min !== undefined && width.max !== undefined) return `fluid ${width.min}px..${width.max}px`;
      if (width.min !== undefined) return `fluid min ${width.min}px`;
      if (width.max !== undefined) return `fluid max ${width.max}px`;
      return "fluid unbounded";
    }
  }
}

function summarizeHeight(height: UiHeightPolicy): string {
  switch (height.kind) {
    case "fixed":
      return `fixed-height ${height.value}px`;
    case "content":
      if (height.max !== undefined) return `content max ${height.max}px`;
      if (height.min !== undefined) return `content min ${height.min}px`;
      return "content";
    case "scrollport":
      return `scrollport max ${height.max}px`;
  }
}

function summarizeScroll(scroll: UiScrollPolicy): string {
  if (scroll.x && scroll.y) return "scroll-xy";
  if (scroll.x) return "scroll-x";
  if (scroll.y) return "scroll-y";
  return "no-scroll";
}

function summarizeDisplay(display: UiDisplayPolicy): string {
  switch (display.kind) {
    case "block":
      return "block";
    case "flex":
      return `flex ${display.direction}`;
    case "grid":
      return `grid ${display.columns.length}x${display.rows.length}`;
    case "subgrid":
      return `subgrid ${display.axis}`;
  }
}
