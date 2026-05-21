import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { ForcedPseudoState } from "../stress/multi-state.ts";
import {
  computeComponentProbeStates,
  computeComponentScrollTargetSource,
  isMarkupCoreComponentProbeState,
  isMarkupCoreForcedPseudoState,
  mergeMarkupCoreComponentProbeStates,
} from "../markup-core-runtime.ts";
import {
  validateUiContract,
  type UiCanvasContract,
  type UiContract,
  type UiContractScreen,
  type UiExpectedScrollportContract,
} from "../contract/ui-contract.ts";

export type ComponentProbeState = ForcedPseudoState | "scrolled";

export interface ComponentContractPlan {
  goal?: string;
  /** Actions that the component runner should apply before collecting evidence. */
  probes: ComponentProbePlan;
  /** Contract expectations that goal evaluation should enforce. */
  expectations: ComponentExpectationPlan;
}

export interface ComponentProbePlan {
  states: ComponentProbeState[];
  scrollTargets: UiExpectedScrollportContract[];
}

export interface ComponentExpectationPlan {
  scrollports: UiExpectedScrollportContract[];
  canvas?: UiCanvasContract;
}

export type ComponentContractRuntime = ComponentContractPlan;

export function emptyComponentContractPlan(): ComponentContractPlan {
  return {
    probes: { states: [], scrollTargets: [] },
    expectations: { scrollports: [] },
  };
}

export function deriveComponentContractPlan(contract: UiContract): ComponentContractPlan {
  const screen = contract.screens[0];
  if (!screen) return emptyComponentContractPlan();
  return deriveComponentPlanFromScreen(screen);
}

/** @deprecated Use deriveComponentContractPlan. */
export const deriveComponentContractRuntime = deriveComponentContractPlan;

export async function loadComponentContractPlan(path: string | undefined): Promise<ComponentContractPlan> {
  if (!path) return emptyComponentContractPlan();
  const contractPath = resolve(path);
  const contract = JSON.parse(await readFile(contractPath, "utf-8")) as UiContract;
  const issues = validateUiContract(contract);
  if (issues.length > 0) {
    const details = issues.slice(0, 5).map((issue) => `${issue.path}: ${issue.message}`).join("; ");
    throw new Error(`Invalid UI Contract: ${details}`);
  }
  return deriveComponentContractPlan(contract);
}

export function mergeComponentProbeStates(
  explicit: ComponentProbeState[] | undefined,
  injected: ComponentProbeState[],
): ComponentProbeState[] | undefined {
  const states = mergeMarkupCoreComponentProbeStates(explicit, injected) as ComponentProbeState[];
  return states.length > 0 ? states : undefined;
}

export function isComponentProbeState(value: string): value is ComponentProbeState {
  return isMarkupCoreComponentProbeState(value);
}

export function isForcedPseudoState(value: string): value is ForcedPseudoState {
  return isMarkupCoreForcedPseudoState(value);
}

function deriveComponentPlanFromScreen(screen: UiContractScreen): ComponentContractPlan {
  return {
    goal: screen.goal ?? screen.pattern,
    probes: {
      states: requiredProbeStates(screen),
      scrollTargets: requiredScrollTargets(screen),
    },
    expectations: {
      scrollports: screen.expectedScrollports ?? [],
      canvas: screen.canvas,
    },
  };
}

function requiredProbeStates(screen: UiContractScreen): ComponentProbeState[] {
  return computeComponentProbeStates((screen.requiredStates ?? []).map((state) => state.kind)) as ComponentProbeState[];
}

function requiredScrollTargets(screen: UiContractScreen): UiExpectedScrollportContract[] {
  const stateTargets = (screen.requiredStates ?? [])
    .filter((state) => state.kind === "scrolled")
    .map((state): UiExpectedScrollportContract => ({
      id: state.id,
      selector: state.selector,
      required: state.required,
      axis: "y",
    }))
    .filter((target) => target.selector || target.id);
  const source = computeComponentScrollTargetSource(
    (screen.requiredStates ?? []).map((state) => state.kind),
    stateTargets.length,
  );
  if (source === "state-targets") return stateTargets;
  if (source === "expected-scrollports") return screen.expectedScrollports ?? [];
  return [];
}
