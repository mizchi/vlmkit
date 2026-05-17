/**
 * Capture-level detection result shared across capture backends
 * (Playwright, Crater BiDi) and downstream detection classifiers.
 */

export interface ViewportDetectionResult {
  width: number;
  height: number;
  visualDiffDetected: boolean;
  visualDiffRatio: number;
  a11yDiffDetected: boolean;
  a11yChangeCount: number;
  computedStyleDiffCount: number;
  hoverDiffDetected: boolean;
  paintTreeDiffCount: number;
}
