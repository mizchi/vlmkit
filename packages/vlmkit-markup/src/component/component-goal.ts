export const COMPONENT_GOALS = ["app", "layout", "pixel", "draft"] as const;

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
}): ComponentGoalEvaluation {
  const profile = getComponentGoalProfile(input.goal);
  const status = passesAll(profile.pass, input)
    ? "pass"
    : passesAll(profile.review, input)
      ? "review"
      : "fail";
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
  input: { pixelDiffRatio: number; landscapeDiffRatio: number },
): string {
  const target = status === "pass" ? profile.pass : profile.review;
  const clauses: string[] = [];
  if (target.landscape !== undefined) {
    clauses.push(`landscape ${formatPct(input.landscapeDiffRatio)} <= ${formatPct(target.landscape)}`);
  }
  if (target.pixel !== undefined) {
    clauses.push(`pixel ${formatPct(input.pixelDiffRatio)} <= ${formatPct(target.pixel)}`);
  }
  const suffix = clauses.length > 0 ? `: ${clauses.join(", ")}` : "";
  return `${profile.label} ${status}${suffix}`;
}

export function formatPct(ratio: number): string {
  return `${(ratio * 100).toFixed(2)}%`;
}
