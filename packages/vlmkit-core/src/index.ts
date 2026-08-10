/**
 * @mizchi/vlmkit-core — VRT diff engine + shared types
 *
 * This barrel is the curated public API. Anything not re-exported here
 * is internal — either a browser-context helper (designed to run inside
 * `page.evaluate(...)`), a CLI helper, or a low-level parser. Those
 * remain accessible via deep import (`@mizchi/vlmkit-core/<module>.ts`)
 * but aren't part of the stable surface.
 *
 * Naming groups (informal):
 *
 *   - `compareScreenshots`, `runPngDiff`, `generateDiffReport`
 *     → top-level diff entry points.
 *   - `find{HeatmapRegions,ShiftOrigins,GridSuggestions}`,
 *     `detect{BandShifts,Whiteout,EmptyContent}`
 *     → detectors that return structured findings.
 *   - `diff{A11yTrees,ComputedStyles,DomPositionStyles}`,
 *     `classify{Region,VisualDiff}`, `verifyDomEquivalence`
 *     → structural comparisons.
 *   - `extractTextRows*`, `matchTextRows`, `compareRowTypography`
 *     → typography / text-row primitives.
 *   - `{decode,encode,crop,resize}Png*`, `getImageDimensions`
 *     → image-IO helpers.
 *   - `INTERACTIVE_ROLES`, `LANDMARK_ROLES`, `RESOLUTION_PRESETS`,
 *     `TRACKED_PROPERTIES` → public config constants.
 *   - `runQualityChecks`
 *     → end-to-end quality gate.
 *
 * Modules NOT in the barrel (deep import only):
 *   - terminal-colors, cli-args, cli-error — CLI helpers
 *   - element-compare, mask — require Playwright at module load
 *   - a11y-contrast, a11y-touch, a11y-focus-order — CLI entries
 *   - browser-script string constants & `*InDom` helpers
 */

// ---- Types (open re-export — types don't pollute the value namespace) ----
export * from "./types.ts";

// ---- Image diff ----
export {
  compareScreenshots,
  detectBandShifts,
  generateDiffReport,
  parseIgnoreRegionSpec,
  detectWhiteout,
  detectEmptyContent,
} from "./heatmap.ts";
export { findHeatmapRegionsFromFile, findHeatmapRegionsFromRgba } from "./heatmap-regions.ts";
export {
  createScopedVrtDiff,
  normalizeVrtDiffRegions,
  normalizeVrtDiffRegionPixels,
} from "./diff-regions.ts";

// ---- Layout / typography ----
export {
  extractTextRowsFromFile,
  extractTextRowsFromRgba,
  matchTextRows,
  compareRowTypography,
  computeRowGapDeltas,
} from "./text-rows.ts";

// ---- PNG IO ----
export {
  cropImage,
  decodePng,
  encodePng,
} from "./png-utils.ts";
export {
  resizePngBuffer,
  resolveResolutionForViewport,
  getImageDimensions,
} from "./image-resize.ts";

// ---- DOM diff ----
export {
  verifyDomEquivalence,
} from "./dom-equivalence.ts";
export {
  diffDomPositionStyles,
  diffPositionStylesAcrossViewports,
} from "./dom-position-styles.ts";
export { diffComputedStyles } from "./computed-style-diff.ts";
export {
  diffAuthoredStyles,
  aggregateAuthoredStyleByViewport,
} from "./authored-style-diff.ts";

// ---- A11y diff ----
export {
  diffA11yTrees,
  parsePlaywrightA11ySnapshot,
  verifyA11yTree,
  INTERACTIVE_ROLES,
  LANDMARK_ROLES,
} from "./a11y-semantic.ts";

// ---- Public config constants ----
export { RESOLUTION_PRESETS } from "./image-resize.ts";
export { TRACKED_PROPERTIES } from "./computed-style-capture.ts";
export { AUTHORED_PROPERTIES } from "./authored-style-capture.ts";
