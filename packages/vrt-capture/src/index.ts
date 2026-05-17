/**
 * @mizchi/vrt-capture — Playwright + Crater capture infrastructure
 *
 * `capturer.ts` imports Playwright at module top-level; consumers that
 * only need viewport/config helpers should deep-import to avoid the
 * Playwright dependency. The barrel re-exports the lightweight modules.
 */
export * from "./capture-config.ts";
export * from "./viewport-discovery.ts";
export * from "./crater-client.ts";
export * from "./detection-types.ts";
export * from "./playwright-analyzer.ts";
export * from "./playwright-launch-error.ts";
export * from "./prescanner.ts";
