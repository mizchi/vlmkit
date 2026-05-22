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
  /**
   * When true, no PNG was captured for this viewport (metadata-only path).
   * `visualDiffDetected` will be `false` because there was nothing to diff —
   * this flag exists so downstream summaries can avoid reporting it as a
   * silent false-negative.
   */
  visualCaptureSkipped?: boolean;
}
