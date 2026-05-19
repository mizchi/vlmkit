export const COMPONENT_GOALS = ["app", "layout", "pixel", "draft", "app-shell", "landing"] as const;

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
}

export interface ComponentLandingEvidence {
  heroVisible: boolean;
  primaryCtaVisible: boolean;
  nextSectionHintVisible: boolean;
  mediaSlotVisible: boolean;
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
}): ComponentGoalEvaluation {
  const profile = getComponentGoalProfile(input.goal);
  const thresholdStatus: ComponentGoalStatus = passesAll(profile.pass, input)
    ? "pass"
    : passesAll(profile.review, input)
      ? "review"
      : "fail";
  const status = applyPatternGates(profile, thresholdStatus, input);
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

function applyPatternGates(
  profile: ComponentGoalProfile,
  status: ComponentGoalStatus,
  input: {
    scrollports?: ComponentScrollportEvidence;
    landing?: ComponentLandingEvidence;
  },
): ComponentGoalStatus {
  if (profile.goal === "app-shell") {
    const scrollports = input.scrollports;
    if (!scrollports || scrollports.total === 0) {
      return status === "pass" ? "review" : status;
    }
    if (scrollports.broken > 0) return "fail";
    if (scrollports.empty > 0 && status === "pass") return "review";
    return status;
  }

  if (profile.goal === "landing") {
    const landing = input.landing;
    if (!landing) return status === "pass" ? "review" : status;
    if (!landing.primaryCtaVisible) return "fail";
    if (!landing.heroVisible) return "fail";
    if ((!landing.nextSectionHintVisible || !landing.mediaSlotVisible) && status === "pass") {
      return "review";
    }
  }

  return status;
}

function passesAll(
  limits: ComponentGoalProfile["pass"],
  input: { pixelDiffRatio: number; landscapeDiffRatio: number },
): boolean {
  if (limits.landscape !== undefined && input.landscapeDiffRatio > limits.landscape) {
    return false;
  }
  if (limits.pixel !== undefined && input.pixelDiffRatio > limits.pixel) {
    return false;
  }
  return true;
}

function summarizeEvaluation(
  profile: ComponentGoalProfile,
  status: ComponentGoalStatus,
  input: {
    pixelDiffRatio: number;
    landscapeDiffRatio: number;
    scrollports?: ComponentScrollportEvidence;
    landing?: ComponentLandingEvidence;
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
  const suffix = clauses.length > 0 ? `: ${clauses.join(", ")}` : "";
  return `${profile.label} ${status}${suffix}`;
}

function summarizeScrollports(scrollports: ComponentScrollportEvidence | undefined): string {
  if (!scrollports || scrollports.total === 0) return "no explicit scrollports";
  const parts = [`scrollports ${scrollports.ok}/${scrollports.total} ok`];
  if (scrollports.broken > 0) parts.push(`${scrollports.broken} broken`);
  if (scrollports.empty > 0) parts.push(`${scrollports.empty} empty`);
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

export function formatPct(ratio: number): string {
  return `${(ratio * 100).toFixed(2)}%`;
}
