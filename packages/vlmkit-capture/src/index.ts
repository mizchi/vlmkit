/**
 * @mizchi/vlmkit-capture — Playwright + Crater capture infrastructure
 *
 * The barrel re-exports the lightweight modules. `capturer.ts`
 * (Playwright bootstrap) imports Playwright at module top-level and is
 * intentionally NOT in the barrel — deep-import when you need it.
 */

// ---- Capture config (vlmkit.config.json + route resolution) ----
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
  discoverViewportsViaCrater,
  discoverViewportsWithBackend,
  generateViewports,
  extractBreakpoints,
  extractBreakpointsFromHtml,
  extractBreakpointsFromHtmlWithStylesheets,
  extractResponsiveBreakpointsFromHtml,
  extractResponsiveBreakpointsFromHtmlWithStylesheets,
  extractStylesheetHrefsFromHtml,
  toResponsiveBreakpoints,
  mergeResponsiveBreakpoints,
  type Breakpoint,
  type CraterViewportSource,
  type ResponsiveBreakpoint,
  type ViewportSource,
  type ViewportSpec,
  type ViewportOptions,
  type DiscoveryResult,
} from "./viewport-discovery.ts";

// ---- Playwright launch diagnostics ----
export {
  isPlaywrightSandboxRestrictionError,
  formatPlaywrightLaunchError,
} from "./playwright-launch-error.ts";

// ---- Cloudflare Browser Run Quick Actions ----
export {
  buildCloudflareQuickActionEndpoint,
  createCloudflareQuickActionsClient,
  extractCloudflareCrawlRoutes,
  resolveCloudflareQuickActionsConfig,
  type CloudflareCrawlRecord,
  type CloudflareCrawlRecordStatus,
  type CloudflareCrawlRequest,
  type CloudflareCrawlResult,
  type CloudflareCrawlRoute,
  type CloudflareCrawlStartResult,
  type CloudflareQuickAction,
  type CloudflareQuickActionEndpointInput,
  type CloudflareQuickActionsConfig,
  type CloudflareQuickActionsEnv,
  type CloudflareScreenshotRequest,
  type CloudflareScreenshotResult,
} from "./cloudflare-quick-actions.ts";

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
  CRATER_BIDI_URL_ENV,
  CRATER_ROOT_ENV,
  DEFAULT_BIDI_URL,
  VLMKIT_CRATER_BIDI_URL_ENV,
  VLMKIT_CRATER_ROOT_ENV,
  resolveCraterBidiUrl,
  type CraterResponsiveBreakpoint,
  type CraterBreakpointDiscoveryDiagnostics,
  type CraterRuleViewportMapEntry,
  type CraterRuleViewportMap,
  type CraterComputedStyleWithState,
  type CraterCssMutation,
  type CraterCssMutationAction,
  type CraterRenderVariant,
  type CraterBatchRenderResult,
  type CraterBreakpointDiscoveryResult,
  type PaintNode,
  type PaintProps,
} from "./crater-client.ts";
export { isCraterAvailable } from "./crater-client.ts";
export {
  CRATER_WASM_MODULE_ENV,
  createCraterWasmLayoutBackend,
  loadCraterWasmModule,
  normalizeCraterLayoutJson,
  summarizeCraterLayout,
  type CraterBoxRect,
  type CraterLayoutDiagnostics,
  type CraterLayoutNode,
  type CraterLayoutRootBox,
  type CraterWasmLayoutBackend,
  type CraterWasmModule,
  type CraterWasmRenderRequest,
  type CraterWasmRenderResult,
  type CraterWasmViewport,
  type LoadCraterWasmModuleOptions,
} from "./crater-wasm.ts";
export {
  runCraterBidiSmoke,
  formatCraterSmokeReport,
  type CraterSmokeCheck,
  type CraterSmokeClient,
  type CraterSmokeReport,
  type CraterSmokeStatus,
} from "./crater-smoke.ts";

// ---- Detection / paint-tree types ----
export * from "./detection-types.ts";
export { diffPaintTrees } from "./crater-client.ts";

// ---- Batch prescan (Crater v0.18.0 batchRender driver) ----
export {
  hasAnyBatchPrescanSignal,
  mutationsForPropertyRemoval,
  mutationsForSelectorBlockRemoval,
  runBatchPrescan,
  type BatchPrescanOptions,
  type BatchPrescanRequest,
  type BatchPrescanResult,
} from "./batch-prescan.ts";
