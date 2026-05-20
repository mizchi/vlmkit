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

const UI_MARKER_KINDS: readonly UiMarkerKind[] = [
  "primary-cta",
  "next-section",
  "media-slot",
  "hero-title",
  "scrollport",
  "selected",
  "unread",
  "game-state",
  "custom",
];

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

const UI_STATE_KINDS: readonly UiStateKind[] = [
  "hover",
  "focus-visible",
  "selected",
  "scrolled",
  "empty",
  "loading",
  "error",
  "playing",
  "paused",
  "result",
];

export interface UiStateContract {
  id: string;
  kind: UiStateKind;
  selector?: string;
  trigger?: string;
  viewport?: string;
  required?: boolean;
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
      validateWidthPolicy(lm.layout.width, `${lmPath}.layout.width`, issues);
      validateHeightPolicy(lm.layout.height, `${lmPath}.layout.height`, issues);
      validateDisplayPolicy(lm.layout.display, `${lmPath}.layout.display`, issues);
      for (let ri = 0; ri < (lm.responsive?.length ?? 0); ri++) {
        const rule = lm.responsive![ri]!;
        const rulePath = `${lmPath}.responsive[${ri}]`;
        if (!viewportLabels.has(rule.viewport)) {
          issues.push({ path: `${rulePath}.viewport`, message: "responsive rule references an unknown viewport" });
        }
        if (rule.width) validateWidthPolicy(rule.width, `${rulePath}.width`, issues);
        if (rule.height) validateHeightPolicy(rule.height, `${rulePath}.height`, issues);
        if (rule.display) validateDisplayPolicy(rule.display, `${rulePath}.display`, issues);
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
    if (!includesString(UI_MARKER_KINDS, marker.kind)) {
      issues.push({ path: `${markerPath}.kind`, message: "unknown marker kind" });
    }
    if (marker.required && !marker.selector && !marker.attribute && !marker.target) {
      issues.push({ path: markerPath, message: "required marker must declare selector, attribute, or target" });
    }
  }
}

function validateStates(
  states: UiStateContract[] | undefined,
  path: string,
  issues: UiContractIssue[],
): void {
  for (let i = 0; i < (states?.length ?? 0); i++) {
    const state = states![i]!;
    const statePath = `${path}[${i}]`;
    if (!state.id) issues.push({ path: `${statePath}.id`, message: "state id is required" });
    if (!includesString(UI_STATE_KINDS, state.kind)) {
      issues.push({ path: `${statePath}.kind`, message: "unknown state kind" });
    }
    if (state.required && !state.selector && !state.trigger) {
      issues.push({ path: statePath, message: "required state must declare selector or trigger" });
    }
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
    if (!slot.id) issues.push({ path: `${slotPath}.id`, message: "slot id is required" });
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
  for (let i = 0; i < (composition.layers?.length ?? 0); i++) {
    const layer = composition.layers![i]!;
    const layerPath = `${path}.layers[${i}]`;
    if (!layer.id) issues.push({ path: `${layerPath}.id`, message: "composition layer id is required" });
    if (layer.z !== undefined && !Number.isFinite(layer.z)) {
      issues.push({ path: `${layerPath}.z`, message: "composition layer z must be finite" });
    }
  }
  for (let i = 0; i < (composition.shapes?.length ?? 0); i++) {
    const shape = composition.shapes![i]!;
    const shapePath = `${path}.shapes[${i}]`;
    if (!shape.id) issues.push({ path: `${shapePath}.id`, message: "composition shape id is required" });
  }
  for (let i = 0; i < (composition.motion?.length ?? 0); i++) {
    const motion = composition.motion![i]!;
    const motionPath = `${path}.motion[${i}]`;
    if (!motion.id) issues.push({ path: `${motionPath}.id`, message: "motion id is required" });
    if (motion.durationMs !== undefined && motion.durationMs < 0) {
      issues.push({ path: `${motionPath}.durationMs`, message: "durationMs must be non-negative" });
    }
  }
  if (composition.contrast) {
    const contrastPath = `${path}.contrast`;
    if (composition.contrast.minRatio !== undefined && composition.contrast.minRatio <= 0) {
      issues.push({ path: `${contrastPath}.minRatio`, message: "contrast minRatio must be positive" });
    }
    for (let i = 0; i < (composition.contrast.palette?.length ?? 0); i++) {
      const value = composition.contrast.palette![i]!;
      if (!isHexColor(value)) {
        issues.push({ path: `${contrastPath}.palette[${i}]`, message: "composition contrast palette value must be a hex color" });
      }
    }
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
    if (content.items.exact !== undefined && content.items.exact < 0) {
      issues.push({ path: `${path}.items.exact`, message: "exact must be non-negative" });
    }
  }
  if (content.text) {
    validateOptionalRange(content.text.minLength, content.text.maxLength, `${path}.text`, issues);
    if (content.text.rowCount !== undefined && content.text.rowCount < 0) {
      issues.push({ path: `${path}.text.rowCount`, message: "rowCount must be non-negative" });
    }
  }
}

function validateOptionalRange(
  min: number | undefined,
  max: number | undefined,
  path: string,
  issues: UiContractIssue[],
): void {
  if (min !== undefined && min < 0) issues.push({ path: `${path}.min`, message: "min must be non-negative" });
  if (max !== undefined && max < 0) issues.push({ path: `${path}.max`, message: "max must be non-negative" });
  if (min !== undefined && max !== undefined && min > max) {
    issues.push({ path, message: "min cannot exceed max" });
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
    if (!typo.role) issues.push({ path: `${typoPath}.role`, message: "typography role is required" });
    if (typo.size !== undefined && typo.size <= 0) issues.push({ path: `${typoPath}.size`, message: "typography size must be positive" });
    if (typo.lineHeight !== undefined && typo.lineHeight <= 0) issues.push({ path: `${typoPath}.lineHeight`, message: "lineHeight must be positive" });
  }
  for (let i = 0; i < (decoration.palette?.length ?? 0); i++) {
    const color = decoration.palette![i]!;
    const colorPath = `${path}.palette[${i}]`;
    if (!color.role) issues.push({ path: `${colorPath}.role`, message: "palette role is required" });
    if (color.value && !isHexColor(color.value)) {
      issues.push({ path: `${colorPath}.value`, message: "palette value must be a hex color" });
    }
  }
  for (let i = 0; i < (decoration.media?.length ?? 0); i++) {
    const media = decoration.media![i]!;
    if (!media.slot) issues.push({ path: `${path}.media[${i}].slot`, message: "media treatment slot is required" });
  }
}

function isHexColor(value: string): boolean {
  return /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/iu.test(value);
}

function validateAssets(
  assets: UiAssetContract[] | undefined,
  path: string,
  issues: UiContractIssue[],
): void {
  for (let i = 0; i < (assets?.length ?? 0); i++) {
    const asset = assets![i]!;
    if (!asset.id) issues.push({ path: `${path}[${i}].id`, message: "asset id is required" });
  }
}

function validateCanvas(
  canvas: UiCanvasContract | undefined,
  path: string,
  issues: UiContractIssue[],
): void {
  if (!canvas) return;
  if ((canvas.requiredStateFields?.length ?? 0) > 0 && !canvas.stateHook) {
    issues.push({ path: `${path}.stateHook`, message: "canvas stateHook is required when requiredStateFields are declared" });
  }
  for (let i = 0; i < (canvas.inputs?.length ?? 0); i++) {
    const input = canvas.inputs![i]!;
    if (!input.action) issues.push({ path: `${path}.inputs[${i}].action`, message: "canvas input action is required" });
  }
  for (let i = 0; i < (canvas.hud?.length ?? 0); i++) {
    const hud = canvas.hud![i]!;
    if (!hud.id) issues.push({ path: `${path}.hud[${i}].id`, message: "canvas HUD id is required" });
  }
}

function validatePatternEvidence(
  screen: UiContractScreen,
  screenPath: string,
  issues: UiContractIssue[],
): void {
  const pattern = screen.pattern ?? screen.goal;
  const markerKinds = new Set(collectMarkers(screen).map((marker) => marker.kind));
  if (pattern === "landing") {
    for (const kind of ["primary-cta", "media-slot", "next-section"] as const) {
      if (!markerKinds.has(kind)) {
        issues.push({ path: `${screenPath}.markers`, message: `landing contracts should include ${kind} marker evidence` });
      }
    }
  }
  if (pattern === "app-shell" && !markerKinds.has("scrollport")) {
    issues.push({ path: `${screenPath}.markers`, message: "app-shell contracts should include scrollport marker evidence" });
  }
  if (pattern === "canvas") {
    const required = ["mode", "frame", "playerX", "playerY", "score", "assetsReady"];
    const fields = new Set(screen.canvas?.requiredStateFields ?? []);
    if (!screen.canvas?.stateHook) {
      issues.push({ path: `${screenPath}.canvas.stateHook`, message: "canvas contracts should include a stateHook" });
    }
    for (const field of required) {
      if (!fields.has(field)) {
        issues.push({ path: `${screenPath}.canvas.requiredStateFields`, message: `canvas contracts should include ${field} state field` });
      }
    }
  }
  if (pattern === "expressive-menu") {
    if (!screen.composition) {
      issues.push({ path: `${screenPath}.composition`, message: "expressive-menu contracts should include composition metadata" });
    }
    const hasStateEvidence = (screen.states ?? []).some((state) =>
      state.kind === "selected" || state.kind === "focus-visible"
    ) || markerKinds.has("selected");
    if (!hasStateEvidence) {
      issues.push({ path: `${screenPath}.states`, message: "expressive-menu contracts should include selected or focus-visible state evidence" });
    }
  }
}

function collectMarkers(screen: UiContractScreen): UiMarkerContract[] {
  return [
    ...(screen.markers ?? []),
    ...screen.landmarks.flatMap((landmark) => landmark.markers ?? []),
  ];
}

function validateWidthPolicy(
  width: UiWidthPolicy,
  path: string,
  issues: UiContractIssue[],
): void {
  if (width.kind === "fluid" && width.min === undefined && width.max === undefined) {
    issues.push({ path, message: "fluid width must declare min or max" });
  }
  if (width.kind === "fixed" && width.value <= 0) {
    issues.push({ path, message: "fixed width must be positive" });
  }
}

function validateHeightPolicy(
  height: UiHeightPolicy,
  path: string,
  issues: UiContractIssue[],
): void {
  if (height.kind === "fixed" && height.value <= 0) {
    issues.push({ path, message: "fixed height must be positive" });
  }
  if (height.kind === "scrollport" && height.max <= 0) {
    issues.push({ path, message: "scrollport height must declare a positive max" });
  }
}

function validateDisplayPolicy(
  display: UiDisplayPolicy,
  path: string,
  issues: UiContractIssue[],
): void {
  if (display.kind === "grid") {
    if (display.columns.length === 0) {
      issues.push({ path: `${path}.columns`, message: "grid display requires at least one column track" });
    }
    if (display.rows.length === 0) {
      issues.push({ path: `${path}.rows`, message: "grid display requires at least one row track" });
    }
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
