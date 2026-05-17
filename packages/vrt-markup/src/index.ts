/**
 * @mizchi/vrt-markup — VLM-driven markup tooling
 *
 * Most modules in this package double as CLI commands and import
 * Playwright at module top-level. The barrel re-exports only the
 * dependency-light library API (geometry helpers, palette utilities,
 * dep-graph / introspect / fix-prompt). CLI / Playwright-heavy modules
 * remain accessible via deep import.
 */
export * from "./component/component-geometry.ts";
export * from "./component/component-bbox.ts";

export * from "./style/palette-diff.ts";
export * from "./style/palette-extract.ts";

export * from "./inspect/dep-graph.ts";
export * from "./inspect/introspect.ts";

export * from "./heal/fix-prompt.ts";
