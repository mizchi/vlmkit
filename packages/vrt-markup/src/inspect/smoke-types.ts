/**
 * Shared types for the a11y-driven smoke test runner.
 *
 * Defined here (rather than in `src/api/api-types.ts`) so that
 * `smoke-runner.ts` doesn't reach across the package boundary.
 * `src/api/api-types.ts` re-exports these for HTTP API consumers.
 */

export interface HtmlSource {
  /** inline HTML */
  html?: string;
  /** URL (fetched server-side) */
  url?: string;
  /** Label (for reports) */
  label?: string;
}

export interface SmokeTestRequest {
  /** Test target */
  target: HtmlSource;
  /** Operation mode */
  mode: "random" | "reasoning";
  /** Max number of actions */
  maxActions?: number;
  /** Random seed (for reproducibility) */
  seed?: number;
  /** Block external navigation */
  blockExternalNavigation?: boolean;
  /** LLM provider (reasoning mode) */
  llmProvider?: string;
  /** Record the session as WebM (Playwright recordVideo). Absolute or relative dir. */
  recordVideo?: { dir: string; widthHint?: number; heightHint?: number };
}

export interface SmokeTestResponse {
  /** Overall verdict */
  status: "pass" | "crash" | "error";
  /** Executed actions */
  actions: SmokeAction[];
  /** Detected errors */
  errors: SmokeError[];
  /** Per-step a11y snapshots */
  snapshots?: A11ySnapshot[];
  meta: SmokeTestMeta;
}

export interface SmokeAction {
  step: number;
  /** Target element */
  target: {
    role: string;
    name: string;
    selector?: string;
  };
  /** Action type */
  action: "click" | "type" | "check" | "uncheck" | "select" | "hover" | "focus";
  /** Input value (for type, select) */
  value?: string;
  /** Post-action result */
  result: "ok" | "error" | "navigation" | "timeout";
  elapsedMs: number;
}

export interface SmokeError {
  step: number;
  type: "console-error" | "uncaught-exception" | "timeout" | "crash" | "a11y-regression";
  message: string;
  stack?: string;
}

export interface A11ySnapshot {
  step: number;
  tree: A11yNodeCompact;
  interactiveCount: number;
  landmarkCount: number;
  issues: string[];
}

export interface A11yNodeCompact {
  role: string;
  name: string;
  children?: A11yNodeCompact[];
}

export interface SmokeTestMeta {
  totalActions: number;
  totalErrors: number;
  elapsedMs: number;
  seed?: number;
  mode: "random" | "reasoning";
  /** Path to the recorded WebM, if --record-video was enabled. */
  videoPath?: string;
}
