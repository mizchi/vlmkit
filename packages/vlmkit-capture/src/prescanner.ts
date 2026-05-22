import type { ViewportDetectionResult } from "./detection-types.ts";

export type PrescannerResolvedBy = "crater" | "chromium" | "none";

/** Which Crater metadata signal first fired for a trial resolved by crater. */
export type PrescannerCraterSignal =
  | "paint-tree"
  | "computed-style"
  | "forced-state"
  | "visual"
  | "none";

export interface PrescannerTrialResolution {
  craterDetected: boolean;
  fallbackUsed: boolean;
  finalDetected: boolean;
  resolvedBy: PrescannerResolvedBy;
  /** Whether the crater path skipped PNG capture entirely (metadata-only). */
  metadataOnly: boolean;
  /** First crater signal type that fired (paint-tree wins over computed-style → forced-state → visual). */
  craterSignal: PrescannerCraterSignal;
}

export interface PrescannerTrialSummary {
  total: number;
  detected: number;
  craterResolved: number;
  chromiumFallbacks: number;
  chromiumDetected: number;
  passedAfterFallback: number;
  /** Trials resolved by crater that never captured a PNG (metadata-only detection). */
  metadataOnly: number;
  /** Per-signal breakdown of crater-resolved trials. */
  craterBySignal: {
    paintTree: number;
    computedStyle: number;
    forcedState: number;
    visual: number;
  };
}

export function hasCraterPrescanSignal(viewports: ViewportDetectionResult[]): boolean {
  return viewports.some((viewport) =>
    viewport.visualDiffDetected ||
    viewport.computedStyleDiffCount > 0 ||
    viewport.hoverDiffDetected ||
    viewport.paintTreeDiffCount > 0
  );
}

export function hasAnyDetectionSignal(viewports: ViewportDetectionResult[]): boolean {
  return viewports.some((viewport) =>
    viewport.visualDiffDetected ||
    viewport.a11yDiffDetected ||
    viewport.computedStyleDiffCount > 0 ||
    viewport.hoverDiffDetected ||
    viewport.paintTreeDiffCount > 0,
  );
}

/** Classify the first crater signal that fired. */
function classifyCraterSignal(viewports: ViewportDetectionResult[]): PrescannerCraterSignal {
  if (viewports.some((v) => v.paintTreeDiffCount > 0)) return "paint-tree";
  if (viewports.some((v) => v.computedStyleDiffCount > 0)) return "computed-style";
  if (viewports.some((v) => v.hoverDiffDetected)) return "forced-state";
  if (viewports.some((v) => v.visualDiffDetected)) return "visual";
  return "none";
}

/** True when every viewport in the crater capture skipped its PNG. */
function isMetadataOnly(viewports: ViewportDetectionResult[]): boolean {
  if (viewports.length === 0) return false;
  return viewports.every((v) => v.visualCaptureSkipped === true);
}

export function resolvePrescannerTrial(
  craterViewports: ViewportDetectionResult[],
  chromiumViewports: ViewportDetectionResult[] = [],
): PrescannerTrialResolution {
  const craterDetected = hasCraterPrescanSignal(craterViewports);
  const metadataOnly = isMetadataOnly(craterViewports);
  if (craterDetected) {
    return {
      craterDetected: true,
      fallbackUsed: false,
      finalDetected: true,
      resolvedBy: "crater",
      metadataOnly,
      craterSignal: classifyCraterSignal(craterViewports),
    };
  }

  const chromiumDetected = hasAnyDetectionSignal(chromiumViewports);
  return {
    craterDetected: false,
    fallbackUsed: true,
    finalDetected: chromiumDetected,
    resolvedBy: chromiumDetected ? "chromium" : "none",
    metadataOnly,
    craterSignal: "none",
  };
}

export function summarizePrescannerTrials(
  resolutions: PrescannerTrialResolution[],
): PrescannerTrialSummary {
  const craterResolved = resolutions.filter((r) => r.resolvedBy === "crater");
  return {
    total: resolutions.length,
    detected: resolutions.filter((resolution) => resolution.finalDetected).length,
    craterResolved: craterResolved.length,
    chromiumFallbacks: resolutions.filter((resolution) => resolution.fallbackUsed).length,
    chromiumDetected: resolutions.filter((resolution) => resolution.resolvedBy === "chromium").length,
    passedAfterFallback: resolutions.filter((resolution) => resolution.resolvedBy === "none").length,
    metadataOnly: craterResolved.filter((r) => r.metadataOnly).length,
    craterBySignal: {
      paintTree: craterResolved.filter((r) => r.craterSignal === "paint-tree").length,
      computedStyle: craterResolved.filter((r) => r.craterSignal === "computed-style").length,
      forcedState: craterResolved.filter((r) => r.craterSignal === "forced-state").length,
      visual: craterResolved.filter((r) => r.craterSignal === "visual").length,
    },
  };
}
