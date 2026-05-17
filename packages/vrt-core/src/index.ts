/**
 * @mizchi/vrt-core — VRT diff engine + shared types
 *
 * This barrel re-exports the side-effect-free library API. Modules
 * that launch Playwright or define a CLI entry (a11y-contrast,
 * a11y-touch, a11y-focus-order, element-compare, mask) are NOT
 * re-exported here so consumers that only need types or pure utilities
 * don't pull Playwright into their bundle. Deep-import those directly
 * via `@mizchi/vrt-core/<module>.ts`.
 */
export * from "./types.ts";
export * from "./terminal-colors.ts";
export * from "./cli-args.ts";
export * from "./cli-error.ts";

export * from "./png-diff.ts";
export * from "./png-utils.ts";
export * from "./image-resize.ts";
export * from "./heatmap.ts";
export * from "./heatmap-regions.ts";
export * from "./diff-regions.ts";
export * from "./region-classify.ts";
export * from "./shift-origin.ts";
export * from "./text-rows.ts";
export * from "./grid-ratio.ts";

export * from "./dom-equivalence.ts";
export * from "./dom-position-styles.ts";
export * from "./computed-style-diff.ts";
export * from "./computed-style-capture.ts";

export * from "./a11y-semantic.ts";
export * from "./visual-semantic.ts";
export * from "./quality.ts";
