/**
 * @mizchi/vlmkit-capture — Playwright + Crater capture infrastructure
 *
 * The barrel re-exports the lightweight modules. `capturer.ts`
 * (Playwright bootstrap) imports Playwright at module top-level and is
 * intentionally NOT in the barrel — deep-import when you need it.
 */

// ---- Capture config (vrt.config.json + route resolution) ----
export {
  parseCaptureConfig,
  resolveCaptureRoutes,
  loadCaptureConfigFromFile,
  captureConfigDir,
  routeNameFromPath,
  DEFAULT_CAPTURE_BASE_URL,
  DEFAULT_CAPTURE_ROUTES,
  DEFAULT_CAPTURE_CONFIG_FILE,
  type CaptureRoute,
  type CaptureConfig,
  type CaptureRouteSet,
  type LoadCaptureConfigOptions,
} from "./capture-config.ts";

// ---- Viewport / breakpoint discovery ----
export {
  discoverViewports,
  generateViewports,
  extractBreakpoints,
  extractBreakpointsFromHtml,
  extractResponsiveBreakpointsFromHtml,
  toResponsiveBreakpoints,
  mergeResponsiveBreakpoints,
  type Breakpoint,
  type ResponsiveBreakpoint,
  type ViewportSpec,
  type ViewportOptions,
  type DiscoveryResult,
} from "./viewport-discovery.ts";

// ---- Playwright launch diagnostics ----
export {
  isPlaywrightSandboxRestrictionError,
  formatPlaywrightLaunchError,
} from "./playwright-launch-error.ts";

// ---- Playwright report analyzer ----
export {
  analyzeReport,
  collectScreenshots,
  formatStats,
  type AnalyzedReport,
  type FailedTest,
  type ReportStats,
} from "./playwright-analyzer.ts";

// ---- Prescanner (signal aggregator) ----
export {
  hasAnyDetectionSignal,
  hasCraterPrescanSignal,
  resolvePrescannerTrial,
  summarizePrescannerTrials,
  type PrescannerResolvedBy,
  type PrescannerTrialResolution,
  type PrescannerTrialSummary,
} from "./prescanner.ts";

// ---- Crater client (Bidi protocol) ----
export {
  CraterClient,
  DEFAULT_BIDI_URL,
  type CraterResponsiveBreakpoint,
  type CraterBreakpointDiscoveryDiagnostics,
  type CraterRuleViewportMapEntry,
  type CraterRuleViewportMap,
  type CraterComputedStyleWithState,
  type CraterBatchRenderResult,
  type CraterBreakpointDiscoveryResult,
  type PaintNode,
  type PaintProps,
} from "./crater-client.ts";
export { isCraterAvailable } from "./crater-client.ts";

// ---- Detection / paint-tree types ----
export * from "./detection-types.ts";
export { diffPaintTrees } from "./crater-client.ts";
