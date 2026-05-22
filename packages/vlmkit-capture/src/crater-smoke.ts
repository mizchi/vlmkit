#!/usr/bin/env node
/**
 * Crater BiDi smoke check.
 *
 * Verifies the minimum backend contract used by vlmkit:
 * connection, viewport/content load, PNG capture, paint tree capture,
 * computed-style capture, and responsive breakpoint discovery.
 */
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { handleCliError } from "@mizchi/vlmkit-core/cli-error.ts";
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

function printUsage(exitCode: number): never {
  console.log("Usage: vlmkit check crater [options]");
  console.log("Options:");
  console.log("  --url <ws-url>       Crater BiDi URL (default: ws://127.0.0.1:9222)");
  console.log("  --require            Fail if Crater is unavailable");
  console.log("  --json               Print JSON report");
  process.exit(exitCode);
}

export function parseCraterSmokeArgs(
  argv: string[],
  env: NodeJS.ProcessEnv | Partial<NodeJS.ProcessEnv> = process.env,
) {
  let url = resolveCraterBidiUrl({ env });
  let requireAvailable = false;
  let json = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h" || arg === "help") printUsage(0);
    else if (arg === "--url") url = argv[++i] ?? DEFAULT_BIDI_URL;
    else if (arg === "--require") requireAvailable = true;
    else if (arg === "--json") json = true;
  }
  return { url, requireAvailable, json };
}

async function main(argv = process.argv.slice(2)): Promise<void> {
  const args = parseCraterSmokeArgs(argv);
  const report = await runCraterBidiSmoke({
    url: args.url,
    requireAvailable: args.requireAvailable,
  });
  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatCraterSmokeReport(report));
  }
  if (report.status === "fail" || (args.requireAvailable && report.status === "skip")) {
    process.exit(1);
  }
}

const isCliEntry = process.env.__VRT_DISPATCHER_LEAF__ === "crater-smoke" ||
  (process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false);
if (isCliEntry) {
  main().catch(handleCliError);
}
