import { computeComponentGoalStatus } from "../markup-core-runtime.ts";

export const COMPONENT_GOALS = ["app", "layout", "pixel", "draft", "app-shell", "landing", "canvas", "expressive-menu"] as const;

export type ComponentGoal = typeof COMPONENT_GOALS[number];
export type ComponentGoalStatus = "pass" | "review" | "fail";
export type ComponentGoalMetric = "landscape" | "pixel";

export interface ComponentGoalProfile {
  goal: ComponentGoal;
  label: string;
  primaryMetric: ComponentGoalMetric;
  description: string;
  pass: {
    landscape?: number;
    pixel?: number;
  };
  review: {
    landscape?: number;
    pixel?: number;
  };
}

export interface ComponentGoalEvaluation {
  goal: ComponentGoal;
  label: string;
  primaryMetric: ComponentGoalMetric;
  status: ComponentGoalStatus;
  pixelDiffRatio: number;
  landscapeDiffRatio: number;
  pass: ComponentGoalProfile["pass"];
  review: ComponentGoalProfile["review"];
  summary: string;
}

export interface ComponentScrollportEvidence {
  total: number;
  ok: number;
  broken: number;
  empty: number;
  expected?: ComponentExpectedScrollportEvidence;
}

export interface ComponentExpectedScrollportEvidence {
  total: number;
  ok: number;
  missing: number;
  broken: number;
  empty: number;
  missingNames: string[];
  brokenNames: string[];
  emptyNames: string[];
}

export interface ComponentLandingEvidence {
  heroVisible: boolean;
  primaryCtaVisible: boolean;
  nextSectionHintVisible: boolean;
  mediaSlotVisible: boolean;
}

export interface ComponentCanvasEvidence {
  canvasCount: number;
  nonblank: boolean;
  frameDelta: boolean;
  inputResponsive: boolean | null;
  stateHook?: string;
  stateHookPresent?: boolean;
  requiredStateFields?: string[];
  observedStateFields?: string[];
  missingStateFields?: string[];
}

export interface ComponentExpressiveMenuEvidence {
  compositionLayers: number;
  compositionShapes: number;
  selectedVisible: boolean;
  focusableItemCount: number;
  semanticMenuText: boolean;
  diagonalEvidence: boolean;
  highContrast: boolean;
  minMenuContrastRatio: number | null;
  lowContrastItemCount: number;
  contrastSource?: "dom" | "pixel" | "unknown";
  hoverChanged: boolean | null;
  focusVisibleChanged: boolean | null;
}

const GOAL_PROFILES: Record<ComponentGoal, ComponentGoalProfile> = {
  app: {
    goal: "app",
    label: "Practical app",
    primaryMetric: "landscape",
    description: "Usable AI-mock convergence: layout must be close; pixel diff can remain noisy.",
    pass: { landscape: 0.03, pixel: 0.25 },
    review: { landscape: 0.05, pixel: 0.35 },
  },
  layout: {
    goal: "layout",
    label: "Layout first",
    primaryMetric: "landscape",
    description: "Coarse landscape/layout convergence only. Pixel diff is secondary evidence.",
    pass: { landscape: 0.03 },
    review: { landscape: 0.05 },
  },
  pixel: {
    goal: "pixel",
    label: "Pixel reproduction",
    primaryMetric: "pixel",
    description: "Strict screenshot reproduction. Use for Figma exports or deterministic UI states.",
    pass: { pixel: 0.03, landscape: 0.01 },
    review: { pixel: 0.08, landscape: 0.03 },
  },
  draft: {
    goal: "draft",
    label: "Draft mock",
    primaryMetric: "landscape",
    description: "Loose early iteration target. Good for rough prompt/mock exploration.",
    pass: { landscape: 0.06, pixel: 0.35 },
    review: { landscape: 0.08, pixel: 0.45 },
  },
  "app-shell": {
    goal: "app-shell",
    label: "App shell",
    primaryMetric: "landscape",
    description: "Persistent viewport shell convergence with explicit scrollport behavior.",
    pass: { landscape: 0.03 },
    review: { landscape: 0.05 },
  },
  landing: {
    goal: "landing",
    label: "Landing page",
    primaryMetric: "landscape",
    description: "Landing-page convergence with first-viewport hero, CTA, next-section, and media-slot gates.",
    pass: { landscape: 0.03, pixel: 0.30 },
    review: { landscape: 0.05, pixel: 0.40 },
  },
  canvas: {
    goal: "canvas",
    label: "Canvas scene",
    primaryMetric: "landscape",
    description: "Canvas/game convergence with nonblank, frame-delta, and input-response gates.",
    pass: { landscape: 0.06, pixel: 0.35 },
    review: { landscape: 0.08, pixel: 0.45 },
  },
  "expressive-menu": {
    goal: "expressive-menu",
    label: "Expressive menu",
    primaryMetric: "landscape",
    description: "Poster-like menu convergence with semantic menu text, selected state, composition markers, and contrast gates.",
    pass: { landscape: 0.05 },
    review: { landscape: 0.08 },
  },
};

export function listComponentGoals(): ComponentGoal[] {
  return [...COMPONENT_GOALS];
}

export function normalizeComponentGoal(goal: string | undefined): ComponentGoal {
  return COMPONENT_GOALS.includes(goal as ComponentGoal) ? goal as ComponentGoal : "app";
}

export function getComponentGoalProfile(goal: string | undefined): ComponentGoalProfile {
  return GOAL_PROFILES[normalizeComponentGoal(goal)];
}

export function evaluateComponentGoal(input: {
  goal?: string;
  pixelDiffRatio: number;
  landscapeDiffRatio: number;
  scrollports?: ComponentScrollportEvidence;
  landing?: ComponentLandingEvidence;
  canvas?: ComponentCanvasEvidence;
  expressiveMenu?: ComponentExpressiveMenuEvidence;
}): ComponentGoalEvaluation {
  const profile = getComponentGoalProfile(input.goal);
  const status = computeComponentGoalStatus({
    goal: profile.goal,
    pixelDiffRatio: input.pixelDiffRatio,
    landscapeDiffRatio: input.landscapeDiffRatio,
    pass: profile.pass,
    review: profile.review,
    scrollports: input.scrollports,
    landing: input.landing,
    canvas: input.canvas,
    expressiveMenu: input.expressiveMenu,
  });
  return {
    goal: profile.goal,
    label: profile.label,
    primaryMetric: profile.primaryMetric,
    status,
    pixelDiffRatio: input.pixelDiffRatio,
    landscapeDiffRatio: input.landscapeDiffRatio,
    pass: profile.pass,
    review: profile.review,
    summary: summarizeEvaluation(profile, status, input),
  };
}

function summarizeEvaluation(
  profile: ComponentGoalProfile,
  status: ComponentGoalStatus,
  input: {
    pixelDiffRatio: number;
    landscapeDiffRatio: number;
    scrollports?: ComponentScrollportEvidence;
    landing?: ComponentLandingEvidence;
    canvas?: ComponentCanvasEvidence;
    expressiveMenu?: ComponentExpressiveMenuEvidence;
  },
): string {
  const target = status === "pass" ? profile.pass : profile.review;
  const clauses: string[] = [];
  if (target.landscape !== undefined) {
    clauses.push(`landscape ${formatPct(input.landscapeDiffRatio)} <= ${formatPct(target.landscape)}`);
  }
  if (target.pixel !== undefined) {
    clauses.push(`pixel ${formatPct(input.pixelDiffRatio)} <= ${formatPct(target.pixel)}`);
  }
  if (profile.goal === "app-shell") {
    clauses.push(summarizeScrollports(input.scrollports));
  }
  if (profile.goal === "landing") {
    clauses.push(summarizeLanding(input.landing));
  }
  if (profile.goal === "canvas") {
    clauses.push(summarizeCanvas(input.canvas));
  }
  if (profile.goal === "expressive-menu") {
    clauses.push(summarizeExpressiveMenu(input.expressiveMenu));
  }
  const suffix = clauses.length > 0 ? `: ${clauses.join(", ")}` : "";
  return `${profile.label} ${status}${suffix}`;
}

function summarizeScrollports(scrollports: ComponentScrollportEvidence | undefined): string {
  if (!scrollports) return "no explicit scrollports";
  if (scrollports.total === 0 && (!scrollports.expected || scrollports.expected.total === 0)) {
    return "no explicit scrollports";
  }
  const parts = [`scrollports ${scrollports.ok}/${scrollports.total} ok`];
  if (scrollports.broken > 0) parts.push(`${scrollports.broken} broken`);
  if (scrollports.empty > 0) parts.push(`${scrollports.empty} empty`);
  if (scrollports.expected && scrollports.expected.total > 0) {
    parts.push(`expected ${scrollports.expected.ok}/${scrollports.expected.total} ok`);
    if (scrollports.expected.missing > 0) {
      parts.push(`${scrollports.expected.missing} expected missing: ${scrollports.expected.missingNames.join("/")}`);
    }
    if (scrollports.expected.broken > 0) {
      parts.push(`${scrollports.expected.broken} expected broken: ${scrollports.expected.brokenNames.join("/")}`);
    }
    if (scrollports.expected.empty > 0) {
      parts.push(`${scrollports.expected.empty} expected empty: ${scrollports.expected.emptyNames.join("/")}`);
    }
  }
  return parts.join(", ");
}

function summarizeLanding(landing: ComponentLandingEvidence | undefined): string {
  if (!landing) return "no landing evidence";
  const parts = [
    landing.heroVisible ? "hero ok" : "hero missing",
    landing.primaryCtaVisible ? "CTA ok" : "CTA missing",
    landing.nextSectionHintVisible ? "next hint ok" : "next hint missing",
    landing.mediaSlotVisible ? "media slot ok" : "media slot missing",
  ];
  return `landing ${parts.join(", ")}`;
}

function summarizeCanvas(canvas: ComponentCanvasEvidence | undefined): string {
  if (!canvas || canvas.canvasCount === 0) return "no canvas evidence";
  const input = canvas.inputResponsive === true
    ? "input ok"
    : canvas.inputResponsive === false
      ? "input missing"
      : "input unknown";
  const stateHook = canvas.stateHook
    ? canvas.stateHookPresent === false
      ? `state hook missing: ${canvas.stateHook}`
      : `state hook ok: ${canvas.stateHook}`
    : undefined;
  const stateFields = canvas.missingStateFields && canvas.missingStateFields.length > 0
    ? `state fields missing: ${canvas.missingStateFields.join("/")}`
    : canvas.requiredStateFields && canvas.requiredStateFields.length > 0
      ? `state fields ok: ${canvas.requiredStateFields.join("/")}`
      : canvas.observedStateFields && canvas.observedStateFields.length > 0
        ? `state fields observed: ${canvas.observedStateFields.join("/")}`
        : undefined;
  const parts = [
    canvas.nonblank ? "nonblank ok" : "blank",
    canvas.frameDelta ? "frame delta ok" : "frame delta missing",
    input,
    stateHook,
    stateFields,
  ].filter((part): part is string => part !== undefined);
  return `canvas ${parts.join(", ")}`;
}

function summarizeExpressiveMenu(expressiveMenu: ComponentExpressiveMenuEvidence | undefined): string {
  if (!expressiveMenu) return "no expressive menu evidence";
  const parts = [
    expressiveMenu.selectedVisible ? "selected ok" : "selected missing",
    expressiveMenu.semanticMenuText ? "menu text ok" : "menu text missing",
    `items ${expressiveMenu.focusableItemCount}`,
    `composition ${expressiveMenu.compositionLayers} layers/${expressiveMenu.compositionShapes} shapes`,
    expressiveMenu.diagonalEvidence ? "diagonal ok" : "diagonal missing",
    contrastSummary(expressiveMenu),
    summarizeInteractionState("hover", expressiveMenu.hoverChanged),
    summarizeInteractionState("focus", expressiveMenu.focusVisibleChanged),
  ];
  return `expressive ${parts.join(", ")}`;
}

function contrastSummary(expressiveMenu: ComponentExpressiveMenuEvidence): string {
  const min = expressiveMenu.minMenuContrastRatio === null
    ? "contrast min unknown"
    : `contrast min ${expressiveMenu.minMenuContrastRatio.toFixed(2)}`;
  const low = expressiveMenu.lowContrastItemCount > 0
    ? `${expressiveMenu.lowContrastItemCount} low contrast`
    : "0 low contrast";
  const status = expressiveMenu.highContrast && expressiveMenu.lowContrastItemCount === 0
    ? "contrast ok"
    : "contrast missing";
  return `${status}, ${min}, ${low}`;
}

function summarizeInteractionState(label: string, changed: boolean | null): string {
  if (changed === true) return `${label} changed`;
  if (changed === false) return `${label} inert`;
  return "state probes missing";
}

export function formatPct(ratio: number): string {
  return `${(ratio * 100).toFixed(2)}%`;
}
