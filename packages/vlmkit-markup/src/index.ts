/**
 * @mizchi/vlmkit-markup — VLM-driven markup tooling
 *
 * Most modules in this package double as CLI commands and import
 * Playwright at module top-level. The barrel exposes only the
 * dependency-light library API (geometry helpers, palette utilities,
 * dep-graph / introspect / fix-prompt). CLI / Playwright-heavy modules
 * remain deep-importable.
 */

// ---- Component geometry / bbox ----
export {
  buildGeometryProfiles,
  type PerRankGeometry,
  type FindGeometryMismatchesOptions,
} from "./component/component-geometry.ts";
export {
  extractComponentsFromRgba,
  extractComponentsFromFile,
  matchComponents,
  type ComponentBbox,
  type MatchedBbox,
  type ExtractComponentsOptions,
  type MatchComponentsOptions,
} from "./component/component-bbox.ts";
export {
  buildSemanticDrilldown,
  describeLandmarkLayoutContract,
  normalizeLandmarkRole,
  selectNextSemanticDrilldown,
  type LandmarkLayoutContract,
  type LandmarkLayoutSummary,
  type LandmarkRegion,
  type LandmarkRole,
  type SemanticDrilldownEntry,
  type SemanticDrilldownInput,
} from "./component/semantic-drilldown.ts";

// ---- Palette ----
export {
  extractPaletteFromRgba,
  extractPaletteFromFile,
  findDominantBackgrounds,
  findDominantBackgroundsFromFile,
  type PaletteColor,
  type ExtractPaletteOptions,
  type DominantBackgrounds,
} from "./style/palette-extract.ts";
export {
  diffPalettes,
  type PaletteMatch,
  type PaletteDiff,
  type UnmatchedPaletteColor,
  type DiffPaletteOptions,
} from "./style/palette-diff.ts";

// ---- Dep graph (project structure) ----
export {
  buildDepGraph,
  findAffectedComponents,
  graphStats,
} from "./inspect/dep-graph.ts";

// ---- UI Contract IR ----
export {
  summarizeUiContractLandmark,
  validateUiContract,
  type LandmarkRole as UiContractLandmarkRole,
  type UiContract,
  type UiContractIssue,
  type UiContractLandmark,
  type UiContractScreen,
  type UiContractVersion,
  type UiContractViewport,
  type UiDisplayPolicy,
  type UiHeightPolicy,
  type UiLayoutContract,
  type UiResponsiveRule,
  type UiScrollPolicy,
  type UiWidthPolicy,
} from "./contract/ui-contract.ts";

// ---- Introspect / spec verify ----
export {
  introspect,
  introspectToSpec,
  verifySpec,
  type SpecVerifyResult,
  type SpecPageResult,
  type CheckedInvariant,
} from "./inspect/introspect.ts";

// ---- Heal / fix prompt ----
export {
  extractSnapshotFixTasks,
  formatSnapshotFixPromptMarkdown,
  formatSnapshotFixPromptJson,
  type SnapshotReport,
  type SnapshotReportResult,
  type SnapshotFixTask,
  type SnapshotFixTaskPaths,
  type ExtractFixTasksOptions,
  type FormatPromptOptions,
} from "./heal/fix-prompt.ts";
