#!/usr/bin/env node
/**
 * Crater BiDi smoke check.
 *
 * Verifies the minimum backend contract used by vlmkit:
 * connection, viewport/content load, PNG capture, paint tree capture,
 * computed-style capture, and responsive breakpoint discovery.
 */
import { resolve } from "node:path";
import { BOLD, CYAN, DIM, GREEN, RED, RESET, YELLOW } from "@mizchi/vlmkit-core/terminal-colors.ts";
import {
  CraterClient,
  DEFAULT_BIDI_URL,
  isCraterAvailable,
  resolveCraterBidiUrl,
} from "./crater-client.ts";

export interface CraterSmokeClient {
  connect(): Promise<void>;
  close(): Promise<void>;
  setViewport(width: number, height: number): Promise<void>;
  setContent(html: string): Promise<void>;
  capturePng(): Promise<{ png: Buffer; width: number; height: number }>;
  capturePaintTree(): Promise<unknown>;
  captureComputedStyles?(properties: string[]): Promise<Map<string, Record<string, string>>>;
  getResponsiveBreakpoints?(options?: {
    mode?: "live-inline" | "html-inline";
    axis?: "width";
    includeDiagnostics?: boolean;
  }): Promise<{ breakpoints: unknown[] }>;
  getRequiredTestViewports?(): Promise<{ viewports: Array<{ width: number; reason: string }> }>;
  getCssRuleViewportMap?(viewportWidths?: number[]): Promise<{ rules: unknown[] }>;
  getComputedStylesWithState?(
    selector: string,
    forcedStates: string[],
    properties: string[],
  ): Promise<{ normal: Record<string, string>; forced: Record<string, string>; diff: Array<{ property: string; normal: string; forced: string }> }>;
  batchRender?(
    baseHtml: string,
    viewport: { width: number; height: number },
    variants: Array<{ id: string; mutations: Array<{ selector: string; property: string; action?: "remove" | { override: string } }> }>,
  ): Promise<{ results: Array<{ id: string; paintTree?: unknown }> }>;
}

export type CraterSmokeStatus = "pass" | "skip" | "fail";

export interface CraterSmokeCheck {
  name: string;
  status: CraterSmokeStatus;
  elapsedMs: number;
  message: string;
}

export interface CraterSmokeReport {
  status: CraterSmokeStatus;
  url: string;
  checks: CraterSmokeCheck[];
  elapsedMs: number;
}

export interface CraterSmokeOptions {
  url?: string;
  html?: string;
  viewport?: { width: number; height: number };
  requireAvailable?: boolean;
  /**
   * When true, also exercises rendering-heavy v0.18.0 APIs (batchRender).
   * Metadata-only v0.18.0 checks (`getRequiredTestViewports`,
   * `getCssRuleViewportMap`, `getComputedStylesWithState`) always run when the
   * client exposes them — they are cheap RPC round-trips.
   */
  deep?: boolean;
  isAvailable?: (url: string) => Promise<boolean>;
  createClient?: (url: string) => CraterSmokeClient;
}

const DEFAULT_HTML = `<!doctype html>
<html>
  <head>
    <style>
      body { margin: 0; font-family: system-ui; }
      main { display: grid; grid-template-columns: 1fr auto; gap: 16px; padding: 24px; }
      button { padding: 10px 14px; border-radius: 8px; background: #2563eb; color: white; border: 0; }
      button:hover { background: #1d4ed8; text-decoration: underline; }
      @media (min-width: 700px) { main { max-width: 680px; } }
    </style>
  </head>
  <body>
    <main><h1>Crater smoke</h1><button>OK</button></main>
  </body>
</html>`;

function now(): number {
  return Date.now();
}

function makeCheck(
  name: string,
  status: CraterSmokeStatus,
  start: number,
  message: string,
): CraterSmokeCheck {
  return { name, status, elapsedMs: now() - start, message };
}

function reportStatus(checks: CraterSmokeCheck[]): CraterSmokeStatus {
  if (checks.some((check) => check.status === "fail")) return "fail";
  if (checks.some((check) => check.status === "skip")) return "skip";
  return "pass";
}

function assertPaintTree(tree: unknown): void {
  if (!tree || typeof tree !== "object") {
    throw new Error("paint tree is empty");
  }
}

export async function runCraterBidiSmoke(
  options: CraterSmokeOptions = {},
): Promise<CraterSmokeReport> {
  const url = options.url ?? DEFAULT_BIDI_URL;
  const requireAvailable = options.requireAvailable ?? false;
  const start = now();
  const checks: CraterSmokeCheck[] = [];
  const available = await (options.isAvailable ?? isCraterAvailable)(url);
  if (!available) {
    checks.push(makeCheck(
      "availability",
      requireAvailable ? "fail" : "skip",
      start,
      `Crater BiDi is not available at ${url}`,
    ));
    return { status: reportStatus(checks), url, checks, elapsedMs: now() - start };
  }

  const client = (options.createClient ?? ((u: string) => new CraterClient(u)))(url);
  let connected = false;
  async function runCheck(name: string, fn: () => Promise<string>): Promise<boolean> {
    const checkStart = now();
    try {
      const message = await fn();
      checks.push(makeCheck(name, "pass", checkStart, message));
      return true;
    } catch (error) {
      checks.push(makeCheck(name, "fail", checkStart, String(error)));
      return false;
    }
  }

  try {
    connected = await runCheck("connect", async () => {
      await client.connect();
      return "connected";
    });
    if (!connected) return { status: "fail", url, checks, elapsedMs: now() - start };

    const viewport = options.viewport ?? { width: 800, height: 480 };
    if (!await runCheck("load", async () => {
      await client.setViewport(viewport.width, viewport.height);
      await client.setContent(options.html ?? DEFAULT_HTML);
      return `loaded ${viewport.width}x${viewport.height}`;
    })) {
      return { status: "fail", url, checks, elapsedMs: now() - start };
    }

    if (!await runCheck("capture-png", async () => {
      const result = await client.capturePng();
      if (result.width <= 0 || result.height <= 0 || result.png.length === 0) {
        throw new Error("PNG capture returned empty data");
      }
      return `captured ${result.width}x${result.height}, ${result.png.length} bytes`;
    })) {
      return { status: "fail", url, checks, elapsedMs: now() - start };
    }

    if (!await runCheck("paint-tree", async () => {
      assertPaintTree(await client.capturePaintTree());
      return "paint tree captured";
    })) {
      return { status: "fail", url, checks, elapsedMs: now() - start };
    }

    if (client.captureComputedStyles) {
      if (!await runCheck("computed-styles", async () => {
        const styles = await client.captureComputedStyles!(["display", "color", "background-color"]);
        return `computed styles captured (${styles.size} selector(s))`;
      })) {
        return { status: "fail", url, checks, elapsedMs: now() - start };
      }
    }

    if (client.getResponsiveBreakpoints) {
      if (!await runCheck("responsive-breakpoints", async () => {
        const result = await client.getResponsiveBreakpoints!({
          mode: "live-inline",
          axis: "width",
          includeDiagnostics: true,
        });
        return `breakpoint API returned ${result.breakpoints.length} breakpoint(s)`;
      })) {
        return { status: "fail", url, checks, elapsedMs: now() - start };
      }
    }

    if (client.getRequiredTestViewports) {
      if (!await runCheck("required-test-viewports", async () => {
        const result = await client.getRequiredTestViewports!();
        return `viewport intelligence returned ${result.viewports.length} viewport(s)`;
      })) {
        return { status: "fail", url, checks, elapsedMs: now() - start };
      }
    }

    if (client.getCssRuleViewportMap) {
      if (!await runCheck("css-rule-viewport-map", async () => {
        const result = await client.getCssRuleViewportMap!();
        return `rule/viewport map returned ${result.rules.length} rule(s)`;
      })) {
        return { status: "fail", url, checks, elapsedMs: now() - start };
      }
    }

    if (client.getComputedStylesWithState) {
      if (!await runCheck("computed-styles-with-state", async () => {
        const result = await client.getComputedStylesWithState!(
          "button",
          ["hover"],
          ["background-color", "text-decoration"],
        );
        const diffCount = result.diff?.length ?? 0;
        return `forced-state API returned ${diffCount} diff(s)`;
      })) {
        return { status: "fail", url, checks, elapsedMs: now() - start };
      }
    }

    if (options.deep && client.batchRender) {
      if (!await runCheck("batch-render", async () => {
        const result = await client.batchRender!(
          options.html ?? DEFAULT_HTML,
          options.viewport ?? viewport,
          [{
            id: "no-op",
            mutations: [{ selector: "button", property: "color", action: { override: "white" } }],
          }],
        );
        return `batch render returned ${result.results.length} variant(s)`;
      })) {
        return { status: "fail", url, checks, elapsedMs: now() - start };
      }
    }
  } finally {
    if (connected) {
      const closeStart = now();
      try {
        await client.close();
        checks.push(makeCheck("close", "pass", closeStart, "closed"));
      } catch (error) {
        checks.push(makeCheck("close", "fail", closeStart, String(error)));
      }
    }
  }

  return { status: reportStatus(checks), url, checks, elapsedMs: now() - start };
}

export function formatCraterSmokeReport(report: CraterSmokeReport): string {
  const lines: string[] = [];
  const color = report.status === "pass" ? GREEN : report.status === "skip" ? YELLOW : RED;
  lines.push(`${BOLD}${CYAN}vlmkit check crater${RESET}`);
  lines.push(`${DIM}url: ${report.url}${RESET}`);
  lines.push("");
  lines.push(`status: ${color}${report.status}${RESET}`);
  for (const check of report.checks) {
    const icon = check.status === "pass" ? `${GREEN}PASS${RESET}`
      : check.status === "skip" ? `${YELLOW}SKIP${RESET}`
      : `${RED}FAIL${RESET}`;
    lines.push(`  ${icon} ${check.name.padEnd(22)} ${String(check.elapsedMs).padStart(5)}ms  ${DIM}${check.message}${RESET}`);
  }
  lines.push(`${DIM}elapsed: ${report.elapsedMs}ms${RESET}`);
  return lines.join("\n");
}

/**
 * Read this gate's own flags. `--help` and `--json` are no longer handled
 * here: the core gate runner owns both, and a parser that called
 * `process.exit(0)` for help could not be used by anything but a CLI.
 */
export function parseCraterSmokeArgs(
  argv: readonly string[],
  env: NodeJS.ProcessEnv | Partial<NodeJS.ProcessEnv> = process.env,
): { url: string; requireAvailable: boolean; deep: boolean } {
  let url = resolveCraterBidiUrl({ env });
  let requireAvailable = false;
  let deep = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--url") url = argv[++i] ?? DEFAULT_BIDI_URL;
    else if (arg === "--require") requireAvailable = true;
    else if (arg === "--deep") deep = true;
  }
  return { url, requireAvailable, deep };
}

/**
 * CLI entry removed: this module is measurement code now, not a command.
 * `check crater` is declared in `./gates/crater.gate.ts` and driven by the core runner
 * (`@mizchi/vlmkit-core/plugin/runner.ts`), which owns argument parsing,
 * `--json`, `--advisory`, the run ledger and the exit code.
 */
