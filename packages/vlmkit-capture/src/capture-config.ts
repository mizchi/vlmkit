/**
 * Capture configuration loader for `vlmkit workflow init|capture`.
 *
 * Allows external projects to drive `e2e/vlmkit-capture.spec.ts` without
 * editing the spec by sourcing routes from `vlmkit.config.json` (or any
 * file pointed at by `--config` / `VLMKIT_CONFIG_PATH`).
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";

export interface CaptureRoute {
  name: string;
  path: string;
  waitFor?: string;
}

export interface CaptureConfig {
  baseUrl?: string;
  routes?: CaptureRoute[];
}

export interface CaptureRouteSet {
  baseUrl: string;
  routes: CaptureRoute[];
  source: "env" | "config" | "default";
  configPath?: string;
}

export const DEFAULT_CAPTURE_BASE_URL = "http://127.0.0.1:4174";

/**
 * Built-in fallback used when no config or env override is provided.
 * Kept for vlmkit's own development workflow; external projects should
 * supply their own routes via `vlmkit.config.json`.
 */
export const DEFAULT_CAPTURE_ROUTES: CaptureRoute[] = [
  { name: "home", path: "/", waitFor: "main" },
  { name: "readme", path: "/readme", waitFor: "article" },
  { name: "files", path: "/files", waitFor: "main" },
  { name: "issues", path: "/issues", waitFor: "main" },
  { name: "pulls", path: "/pulls", waitFor: "main" },
];

export const DEFAULT_CAPTURE_CONFIG_FILE = "vlmkit.config.json";

export function parseCaptureConfig(raw: string): CaptureConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid capture config JSON: ${String(error)}`);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Capture config must be an object");
  }

  const record = parsed as Record<string, unknown>;

  // `capture.routes` is preferred so it coexists cleanly with snapshot `routes`.
  const captureSection = record.capture;
  const routesSource = pickRoutesSource(captureSection, record.routes);
  const routes = routesSource === undefined ? undefined : parseCaptureRoutes(routesSource);

  // `capture.baseUrl` is read for the same reason, and it was NOT: `routes` was accepted in
  // both places while `baseUrl` was only ever read at the top level, so the natural config
  // — both keys inside `capture`, next to each other — took the routes and silently fell
  // back to the default URL. Found by writing that config while checking something else:
  // the capture ran against 127.0.0.1:4174 with `capture.baseUrl` pointing elsewhere, and
  // nothing said so. An ignored input reported as accepted.
  const innerBaseUrl = pickCaptureKey(captureSection, "baseUrl");
  const baseUrlSource = innerBaseUrl ? innerBaseUrl.value : record.baseUrl;
  const baseUrl = baseUrlSource == null
    ? undefined
    : parseNonEmptyString(baseUrlSource, "capture config baseUrl must be a non-empty string");

  return { baseUrl, routes };
}

function pickRoutesSource(captureSection: unknown, topLevelRoutes: unknown): unknown {
  const inner = pickCaptureKey(captureSection, "routes");
  return inner ? inner.value : topLevelRoutes;
}

/**
 * One key out of the `capture` block, wrapped, or `undefined` when the block or the key is
 * absent.
 *
 * Wrapped rather than returned bare so a present-but-`null` value stays distinguishable
 * from an absent one: `"capture": { "routes": null }` must keep reaching
 * `parseCaptureRoutes` and failing loudly, instead of falling through to the top level and
 * being ignored.
 */
function pickCaptureKey(captureSection: unknown, key: string): { value: unknown } | undefined {
  if (captureSection === undefined || captureSection === null) return undefined;
  if (typeof captureSection !== "object" || Array.isArray(captureSection)) {
    throw new Error("capture config `capture` must be an object");
  }
  const record = captureSection as Record<string, unknown>;
  if (!(key in record) || record[key] === undefined) return undefined;
  return { value: record[key] };
}

function parseCaptureRoutes(value: unknown): CaptureRoute[] {
  if (!Array.isArray(value)) {
    throw new Error("capture config routes must be an array");
  }

  return value.map((entry, index) => parseCaptureRoute(entry, index));
}

function parseCaptureRoute(entry: unknown, index: number): CaptureRoute {
  if (typeof entry === "string") {
    const path = entry.trim();
    if (!path) {
      throw new Error(`capture config route at index ${index} must be a non-empty string`);
    }
    return { name: routeNameFromPath(path), path };
  }

  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    throw new Error(`capture config route at index ${index} must be a string or object`);
  }

  const record = entry as Record<string, unknown>;
  const pathValue = record.path ?? record.url;
  const path = parseNonEmptyString(pathValue, `capture config route at index ${index} must have a path`);

  const nameRaw = record.name ?? record.label;
  const name = nameRaw === undefined
    ? routeNameFromPath(path)
    : parseNonEmptyString(nameRaw, `capture config route at index ${index} has an invalid name`);

  const waitForRaw = record.waitFor ?? record.wait_for;
  const route: CaptureRoute = { name, path };
  if (waitForRaw !== undefined) {
    route.waitFor = parseNonEmptyString(
      waitForRaw,
      `capture config route at index ${index} has an invalid waitFor`,
    );
  }
  return route;
}

export function routeNameFromPath(path: string): string {
  const trimmed = path.split("?")[0]!.split("#")[0]!;
  const cleaned = trimmed.replace(/^\/+|\/+$/g, "");
  if (!cleaned) return "home";
  const safe = cleaned.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase();
  return safe || "home";
}

export interface LoadCaptureConfigOptions {
  configPath?: string;
  cwd?: string;
  envRoutes?: string;
  envBaseUrl?: string;
  envConfigPath?: string;
}

/**
 * Resolve the route set to use for a capture run.
 *
 * Precedence (highest first):
 *   1. `VLMKIT_CAPTURE_ROUTES` env var (JSON-encoded array)
 *   2. Explicit config path (CLI / `VLMKIT_CONFIG_PATH`)
 *   3. `vlmkit.config.json` discovered in `cwd`
 *   4. Built-in defaults
 */
export function resolveCaptureRoutes(options: LoadCaptureConfigOptions = {}): CaptureRouteSet {
  const cwd = options.cwd ?? process.cwd();
  const envBaseUrl = options.envBaseUrl?.trim();

  const envRoutes = options.envRoutes;
  if (envRoutes && envRoutes.trim().length > 0) {
    const routes = parseCaptureRoutes(JSON.parse(envRoutes));
    return {
      baseUrl: envBaseUrl || DEFAULT_CAPTURE_BASE_URL,
      routes,
      source: "env",
    };
  }

  const configPath = resolveConfigPath(options.configPath, options.envConfigPath, cwd);
  if (configPath) {
    const raw = readFileSync(configPath, "utf-8");
    const config = parseCaptureConfig(raw);
    const routes = config.routes ?? DEFAULT_CAPTURE_ROUTES;
    return {
      baseUrl: envBaseUrl || config.baseUrl || DEFAULT_CAPTURE_BASE_URL,
      routes,
      source: "config",
      configPath,
    };
  }

  return {
    baseUrl: envBaseUrl || DEFAULT_CAPTURE_BASE_URL,
    routes: DEFAULT_CAPTURE_ROUTES,
    source: "default",
  };
}

function resolveConfigPath(
  explicit: string | undefined,
  fromEnv: string | undefined,
  cwd: string,
): string | undefined {
  const candidate = explicit ?? fromEnv;
  if (candidate && candidate.trim().length > 0) {
    const absolute = isAbsolute(candidate) ? candidate : resolve(cwd, candidate);
    if (!existsSync(absolute)) {
      throw new Error(`Capture config not found: ${absolute}`);
    }
    return absolute;
  }

  const defaultPath = resolve(cwd, DEFAULT_CAPTURE_CONFIG_FILE);
  return existsSync(defaultPath) ? defaultPath : undefined;
}

function parseNonEmptyString(value: unknown, message: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(message);
  }
  return value;
}

/**
 * Helper for unit tests / non-Playwright callers: read & normalize a file.
 */
export function loadCaptureConfigFromFile(configPath: string): CaptureConfig {
  if (!existsSync(configPath)) {
    throw new Error(`Capture config not found: ${configPath}`);
  }
  return parseCaptureConfig(readFileSync(configPath, "utf-8"));
}

export function captureConfigDir(configPath: string): string {
  return dirname(configPath);
}
