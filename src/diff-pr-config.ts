/**
 * Config loader for `vrt diff-pr` — extends the existing
 * `vrt.config.json` shape (parsed by capture-config.ts for the
 * workflow path) with policy-layer fields:
 *
 *   - thresholds: per-viewport `maxDiffRatio` allowed
 *   - per-route threshold overrides
 *   - tokens path (default --tokens arg for compare)
 *   - approvalPath (default approval.json)
 *   - baselineDir (where pinned PNGs live)
 *
 * Backward-compatible: a vrt.config that the workflow already uses
 * remains valid here; the new fields are all optional.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";

export interface DiffPrRoute {
  name: string;
  /** URL or file path. */
  url: string;
  /** Optional per-route threshold override (per-viewport ratio). */
  thresholds?: Record<string, number>;
  /** Optional waitFor selector (parity with capture config). */
  waitFor?: string;
  /** Per-route override of the project-level a11y policy. */
  a11y?: A11yPolicy;
}

export interface A11yPolicy {
  /** "AA" → 24×24 touch targets / 4.5:1 contrast; "AAA" → 44×44 / 7:1. */
  level?: "AA" | "AAA";
  /** Max contrast failures allowed per route+viewport. Default 0. */
  maxContrastFailures?: number;
  /** Max touch-target failures allowed per route+viewport. Default 0. */
  maxTouchFailures?: number;
  /** Max focus-order findings (trap / reverse / skip-row) per route+viewport. Default 0. */
  maxFocusOrderFailures?: number;
  /** Toggle individual checks. All default on when `a11y` is declared. */
  contrast?: boolean;
  touch?: boolean;
  /**
   * Focus-order check runs Tab cycling and is slower (~1-2s per route+
   * viewport). Default OFF to keep CI fast; opt in with `"focusOrder":
   * true`. The check mutates page focus state, so it runs after the
   * pixel screenshot capture.
   */
  focusOrder?: boolean;
}

export interface DiffPrConfig {
  baseUrl?: string;
  routes: DiffPrRoute[];
  viewports?: string[];
  thresholds: Record<string, number>;
  tokens?: string;
  approvalPath?: string;
  baselineDir: string;
  /**
   * When present, `vrt diff-pr` runs the contrast + touch a11y
   * checks per route+viewport and fails on threshold breach. Omit
   * to skip a11y entirely (purely visual gate).
   */
  a11y?: A11yPolicy;
  /** Resolved path of the file the config was loaded from (diag only). */
  configPath?: string;
}

const DEFAULT_THRESHOLDS: Record<string, number> = {
  mobile: 0.01,
  desktop: 0.005,
  wide: 0.005,
};
const DEFAULT_BASELINE_DIR = ".vrt/baselines";

export function parseDiffPrConfig(raw: string, configPath?: string): DiffPrConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid vrt.config JSON: ${String(error)}`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("vrt.config must be an object");
  }
  const obj = parsed as Record<string, unknown>;
  const baseUrl = asOptionalString(obj.baseUrl, "baseUrl");
  const viewports = asOptionalStringArray(obj.viewports, "viewports");
  const tokens = asOptionalString(obj.tokens, "tokens");
  const approvalPath = asOptionalString(obj.approvalPath, "approvalPath");
  const baselineDir = asOptionalString(obj.baselineDir, "baselineDir") ?? DEFAULT_BASELINE_DIR;
  const thresholds = parseThresholds(obj.thresholds);

  // Accept routes at top level or under capture.routes for parity
  // with the existing workflow config shape.
  const captureSection = obj.capture && typeof obj.capture === "object" && !Array.isArray(obj.capture)
    ? obj.capture as Record<string, unknown>
    : null;
  const rawRoutes = captureSection?.routes ?? obj.routes;
  if (!Array.isArray(rawRoutes)) {
    throw new Error("vrt.config must declare `routes` (top-level or under `capture`)");
  }
  if (rawRoutes.length === 0) {
    throw new Error("vrt.config.routes must declare at least one route");
  }
  const routes = rawRoutes.map((r, i) => parseRoute(r, i, baseUrl));

  return {
    baseUrl,
    routes,
    viewports,
    thresholds: { ...DEFAULT_THRESHOLDS, ...thresholds },
    tokens,
    approvalPath,
    baselineDir,
    a11y: parseA11yPolicy(obj.a11y, "a11y"),
    configPath,
  };
}

function parseA11yPolicy(value: unknown, label: string): A11yPolicy | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  const r = value as Record<string, unknown>;
  const level = asOptionalString(r.level, `${label}.level`);
  if (level !== undefined && level !== "AA" && level !== "AAA") {
    throw new Error(`${label}.level must be "AA" or "AAA"`);
  }
  const num = (v: unknown, k: string) => {
    if (v === undefined || v === null) return undefined;
    if (typeof v !== "number" || Number.isNaN(v) || v < 0) {
      throw new Error(`${label}.${k} must be a non-negative number`);
    }
    return v;
  };
  const bool = (v: unknown, k: string) => {
    if (v === undefined || v === null) return undefined;
    if (typeof v !== "boolean") throw new Error(`${label}.${k} must be boolean`);
    return v;
  };
  return {
    level: level as A11yPolicy["level"],
    maxContrastFailures: num(r.maxContrastFailures, "maxContrastFailures"),
    maxTouchFailures: num(r.maxTouchFailures, "maxTouchFailures"),
    maxFocusOrderFailures: num(r.maxFocusOrderFailures, "maxFocusOrderFailures"),
    contrast: bool(r.contrast, "contrast"),
    touch: bool(r.touch, "touch"),
    focusOrder: bool(r.focusOrder, "focusOrder"),
  };
}

/** Resolve effective a11y policy for a route by merging route over project. */
export function resolveA11yPolicy(config: DiffPrConfig, route: DiffPrRoute): A11yPolicy | undefined {
  if (!config.a11y && !route.a11y) return undefined;
  return {
    level: route.a11y?.level ?? config.a11y?.level ?? "AA",
    maxContrastFailures: route.a11y?.maxContrastFailures ?? config.a11y?.maxContrastFailures ?? 0,
    maxTouchFailures: route.a11y?.maxTouchFailures ?? config.a11y?.maxTouchFailures ?? 0,
    maxFocusOrderFailures: route.a11y?.maxFocusOrderFailures ?? config.a11y?.maxFocusOrderFailures ?? 0,
    contrast: route.a11y?.contrast ?? config.a11y?.contrast ?? true,
    touch: route.a11y?.touch ?? config.a11y?.touch ?? true,
    focusOrder: route.a11y?.focusOrder ?? config.a11y?.focusOrder ?? false,
  };
}

function parseThresholds(value: unknown): Record<string, number> {
  if (value === undefined || value === null) return {};
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error("thresholds must be an object");
  }
  const out: Record<string, number> = {};
  for (const [vp, n] of Object.entries(value as Record<string, unknown>)) {
    if (typeof n !== "number" || Number.isNaN(n)) {
      throw new Error(`thresholds.${vp} must be a number`);
    }
    out[vp] = n;
  }
  return out;
}

function parseRoute(value: unknown, index: number, baseUrl: string | undefined): DiffPrRoute {
  if (typeof value === "string") {
    const url = hasScheme(value) ? value : (baseUrl ? joinUrl(baseUrl, value) : value);
    return { name: routeNameFromUrl(url), url };
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`routes[${index}] must be a string or object`);
  }
  const r = value as Record<string, unknown>;
  // Path-or-url support (mirror capture-config semantics).
  const urlField = r.url ?? r.path;
  const path = asRequiredString(urlField, `routes[${index}] must have url or path`);
  // Treat scheme-prefixed values (http://, https://, file://) as
  // already-absolute. Bare leading-slash paths get joined to baseUrl.
  const fullUrl = hasScheme(path) ? path : (baseUrl ? joinUrl(baseUrl, path) : path);
  const name = asOptionalString(r.name, `routes[${index}].name`) ?? routeNameFromUrl(fullUrl);
  const waitFor = asOptionalString(r.waitFor ?? r.wait_for, `routes[${index}].waitFor`);
  const thresholds = parseThresholds(r.thresholds);
  const a11y = parseA11yPolicy(r.a11y, `routes[${index}].a11y`);
  return {
    name,
    url: fullUrl,
    waitFor,
    thresholds: Object.keys(thresholds).length > 0 ? thresholds : undefined,
    a11y,
  };
}

function hasScheme(s: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(s);
}

function joinUrl(base: string, path: string): string {
  if (hasScheme(path)) return path;
  const trimmedBase = base.replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${trimmedBase}${normalizedPath}`;
}

function routeNameFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const cleaned = u.pathname.replace(/^\/+|\/+$/g, "");
    if (!cleaned) return "home";
    return cleaned.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase() || "home";
  } catch {
    return url.split("/").filter(Boolean).pop()?.replace(/[^a-zA-Z0-9]+/g, "_").toLowerCase() || "route";
  }
}

function asOptionalString(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") throw new Error(`${label} must be a string`);
  return value.trim() === "" ? undefined : value;
}

function asRequiredString(value: unknown, label: string): string {
  const s = asOptionalString(value, label);
  if (!s) throw new Error(label);
  return s;
}

function asOptionalStringArray(value: unknown, label: string): string[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value.map((s, i) => {
    if (typeof s !== "string") throw new Error(`${label}[${i}] must be a string`);
    return s;
  });
}

/**
 * Resolve the threshold to apply for a given route+viewport. Route-
 * level threshold wins over project-level. Default is the project-
 * level value (which itself has built-in defaults).
 */
export function resolveThreshold(config: DiffPrConfig, route: DiffPrRoute, viewport: string): number {
  return route.thresholds?.[viewport] ?? config.thresholds[viewport] ?? 0.01;
}

export function findConfigPath(cwd: string, explicit?: string): string | undefined {
  if (explicit) {
    const abs = isAbsolute(explicit) ? explicit : resolve(cwd, explicit);
    if (!existsSync(abs)) throw new Error(`vrt.config not found: ${abs}`);
    return abs;
  }
  const candidate = resolve(cwd, "vrt.config.json");
  return existsSync(candidate) ? candidate : undefined;
}

export function loadDiffPrConfig(configPath: string): DiffPrConfig {
  return parseDiffPrConfig(readFileSync(configPath, "utf-8"), configPath);
}

export function configBaseDir(config: DiffPrConfig): string {
  return config.configPath ? dirname(config.configPath) : process.cwd();
}
