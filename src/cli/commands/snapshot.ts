export interface SnapshotFailureOptions {
  failOnDiff?: boolean;
  failOnNewBaseline?: boolean;
  maxDiffRatio?: number;
}

export interface SnapshotFailureResult {
  exitCode: number;
  reasons: string[];
}

export interface SnapshotSummaryEntry {
  label: string;
  viewport: string;
  isNew: boolean;
  diffRatio?: number;
}

export interface SnapshotRouteConfig {
  path: string;
  label?: string;
}

export interface SnapshotConfig {
  baseUrl?: string;
  routes?: SnapshotRouteConfig[];
  outputDir?: string;
  threshold?: number;
  failOnDiff?: boolean;
  failOnNewBaseline?: boolean;
  maxDiffRatio?: number;
  mask?: string[];
}

export interface ParsedSnapshotCliOptions {
  mode: "capture" | "approve" | "fix-prompt" | "stability" | "stability-history" | "flipbook";
  urls: string[];
  labels: string[];
  outputDir: string;
  threshold: number;
  failOnDiff: boolean;
  failOnNewBaseline: boolean;
  maxDiffRatio?: number;
  maskSelectors: string[];
  backend?: string;
  fixPrompt?: {
    format: "markdown" | "json";
    limit?: number;
    minDiffRatio: number;
    outPath?: string;
  };
  stability?: {
    iterations: number;
    failAboveRate?: number;
    fpThreshold: number;
    flipbook?: boolean;
  };
  stabilityHistory?: {
    outPath?: string;
  };
  flipbook?: {
    delayMs: number;
    outDir?: string;
  };
}

function sanitizeLabelPart(value: string): string {
  return value
    .trim()
    .replace(/%/g, "_")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function defaultPort(protocol: string): string {
  if (protocol === "https:") return "443";
  return "80";
}

export function urlToSnapshotLabel(url: string): string {
  try {
    const parsed = new URL(url);
    const path = sanitizeLabelPart(parsed.pathname.replace(/\.html$/i, "").replace(/\//g, "_")) || "root";
    const base = sanitizeLabelPart(parsed.hostname) || "page";
    const port = parsed.port || defaultPort(parsed.protocol);

    const queryPairs = Array.from(parsed.searchParams.entries())
      .map(([key, value]) => [sanitizeLabelPart(key), sanitizeLabelPart(value)] as const)
      .sort(([aKey, aValue], [bKey, bValue]) => aKey.localeCompare(bKey) || aValue.localeCompare(bValue));

    const querySuffix = queryPairs.length > 0
      ? `__query_${queryPairs.map(([key, value]) => `${key}_${value || "empty"}`).join("__")}`
      : "";

    const hashPart = sanitizeLabelPart(parsed.hash.replace(/^#\/?/, ""));
    const hashSuffix = hashPart ? `__hash_${hashPart}` : "";

    return `${base}_${port}_${path}${querySuffix}${hashSuffix}`;
  } catch {
    return "page";
  }
}

export function resolveSnapshotLabels(urls: string[], explicitLabels: string[]): string[] {
  if (explicitLabels.length === 0) {
    return urls.map((url) => urlToSnapshotLabel(url));
  }

  if (urls.length === 1 && explicitLabels.length === 1) {
    return explicitLabels;
  }

  if (explicitLabels.length !== urls.length) {
    throw new Error("--label must be provided either once for a single URL or once per URL");
  }

  return explicitLabels;
}

export function parseSnapshotConfig(raw: string): SnapshotConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid snapshot config JSON: ${String(error)}`);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Snapshot config must be an object");
  }

  const record = parsed as Record<string, unknown>;
  const routes = record.routes == null ? undefined : parseSnapshotRoutes(record.routes);
  const mask = record.mask == null ? undefined : parseStringArray(record.mask, "snapshot config mask must be a string array");
  const threshold = record.threshold == null ? undefined : parseRatio(record.threshold, "snapshot config threshold must be between 0 and 1");
  const maxDiffRatio = record.maxDiffRatio == null
    ? undefined
    : parseNonNegativeNumber(record.maxDiffRatio, "snapshot config maxDiffRatio must be a non-negative number");

  return {
    baseUrl: record.baseUrl == null ? undefined : parseString(record.baseUrl, "snapshot config baseUrl must be a non-empty string"),
    routes,
    outputDir: record.outputDir == null ? undefined : parseString(record.outputDir, "snapshot config outputDir must be a non-empty string"),
    threshold,
    failOnDiff: record.failOnDiff == null ? undefined : parseBoolean(record.failOnDiff, "snapshot config failOnDiff must be a boolean"),
    failOnNewBaseline: record.failOnNewBaseline == null
      ? undefined
      : parseBoolean(record.failOnNewBaseline, "snapshot config failOnNewBaseline must be a boolean"),
    maxDiffRatio,
    mask,
  };
}

export function parseSnapshotCliArgs(
  cliArgs: string[],
  config: SnapshotConfig = {},
  cwd = process.cwd(),
): ParsedSnapshotCliOptions {
  const positional: string[] = [];
  const explicitLabels: string[] = [];
  const maskSelectors: string[] = [];
  let outputDir = config.outputDir ?? `${cwd}/test-results/snapshots`;
  let threshold = config.threshold ?? 0.1;
  let failOnDiff = config.failOnDiff ?? false;
  let failOnNewBaseline = config.failOnNewBaseline ?? false;
  let maxDiffRatio = config.maxDiffRatio;
  let fixFormat: "markdown" | "json" = "markdown";
  let fixLimit: number | undefined;
  let fixMinDiffRatio = 0;
  let fixOutPath: string | undefined;
  let stabilityIterations = 3;
  let stabilityFailAboveRate: number | undefined;
  let stabilityFpThreshold = 0;
  let stabilityFlipbook = false;
  let flipbookDelayMs = 700;
  let flipbookOutDir: string | undefined;
  let backend: string | undefined;

  for (let i = 0; i < cliArgs.length; i++) {
    const arg = cliArgs[i]!;
    switch (arg) {
      case "--output":
      case "--output-dir": {
        const value = cliArgs[++i];
        if (!value) throw new Error(`Missing value for ${arg}`);
        outputDir = value;
        break;
      }
      case "--label": {
        const value = cliArgs[++i];
        if (!value) throw new Error("Missing value for --label");
        explicitLabels.push(value);
        break;
      }
      case "--threshold": {
        const value = cliArgs[++i];
        threshold = parseRatio(value == null ? value : Number(value), "Invalid --threshold value");
        break;
      }
      case "--fail-on-diff":
        failOnDiff = true;
        break;
      case "--fail-on-new-baseline":
        failOnNewBaseline = true;
        break;
      case "--max-diff-ratio": {
        const value = cliArgs[++i];
        maxDiffRatio = parseNonNegativeNumber(value == null ? value : Number(value), "Invalid --max-diff-ratio value");
        break;
      }
      case "--mask": {
        const value = cliArgs[++i];
        if (!value) throw new Error("Missing value for --mask");
        for (const selector of value.split(",")) {
          const trimmed = selector.trim();
          if (trimmed) maskSelectors.push(trimmed);
        }
        break;
      }
      case "--config": {
        i++;
        break;
      }
      case "--format": {
        const value = cliArgs[++i];
        if (value !== "markdown" && value !== "json") {
          throw new Error("--format must be either 'markdown' or 'json'");
        }
        fixFormat = value;
        break;
      }
      case "--limit": {
        const value = cliArgs[++i];
        const parsedLimit = value == null ? NaN : Number(value);
        if (!Number.isFinite(parsedLimit) || parsedLimit <= 0 || !Number.isInteger(parsedLimit)) {
          throw new Error("--limit must be a positive integer");
        }
        fixLimit = parsedLimit;
        break;
      }
      case "--min-diff": {
        const value = cliArgs[++i];
        fixMinDiffRatio = parseRatio(value == null ? value : Number(value), "Invalid --min-diff value");
        break;
      }
      case "--out": {
        const value = cliArgs[++i];
        if (!value) throw new Error("Missing value for --out");
        fixOutPath = value;
        break;
      }
      case "--iterations": {
        const value = cliArgs[++i];
        const parsedIter = value == null ? NaN : Number(value);
        if (!Number.isFinite(parsedIter) || parsedIter < 2 || !Number.isInteger(parsedIter)) {
          throw new Error("--iterations must be an integer >= 2");
        }
        stabilityIterations = parsedIter;
        break;
      }
      case "--fail-above-rate": {
        const value = cliArgs[++i];
        stabilityFailAboveRate = parseRatio(
          value == null ? value : Number(value),
          "Invalid --fail-above-rate value (must be between 0 and 1)",
        );
        break;
      }
      case "--fp-threshold": {
        const value = cliArgs[++i];
        stabilityFpThreshold = parseRatio(
          value == null ? value : Number(value),
          "Invalid --fp-threshold value (must be between 0 and 1)",
        );
        break;
      }
      case "--backend": {
        const value = cliArgs[++i];
        if (!value) throw new Error("Missing value for --backend");
        backend = value;
        break;
      }
      case "--flipbook":
        stabilityFlipbook = true;
        break;
      case "--delay": {
        const value = cliArgs[++i];
        const n = value == null ? NaN : Number(value);
        if (!Number.isFinite(n) || n < 50) throw new Error("Invalid --delay value (must be >= 50)");
        flipbookDelayMs = n;
        break;
      }
      case "--flipbook-out": {
        const value = cliArgs[++i];
        if (!value) throw new Error("Missing value for --flipbook-out");
        flipbookOutDir = value;
        break;
      }
      case "--help":
      case "-h":
        break;
      default:
        if (arg.startsWith("--")) {
          throw new Error(`Unknown option: ${arg}`);
        }
        positional.push(arg);
        break;
    }
  }

  if (positional[0] === "approve") {
    if (positional.length > 1) {
      throw new Error("`vrt snapshot approve` does not accept positional URLs");
    }
    return {
      mode: "approve",
      urls: [],
      labels: explicitLabels,
      outputDir,
      threshold,
      failOnDiff,
      failOnNewBaseline,
      maxDiffRatio,
      maskSelectors: maskSelectors.length > 0 ? maskSelectors : (config.mask ?? []),
      backend,
    };
  }

  if (positional[0] === "stability") {
    const stabilityUrls = positional.slice(1);
    const configuredStabilityUrls = stabilityUrls.length > 0
      ? stabilityUrls
      : resolveSnapshotConfigUrls(config);
    const stabilityLabels = explicitLabels.length > 0
      ? resolveSnapshotLabels(configuredStabilityUrls, explicitLabels)
      : configuredStabilityUrls.map((url, index) =>
          (stabilityUrls.length === 0 ? (config.routes ?? [])[index]?.label : undefined)
            ?? urlToSnapshotLabel(url));

    return {
      mode: "stability",
      urls: configuredStabilityUrls,
      labels: stabilityLabels,
      outputDir,
      threshold,
      failOnDiff,
      failOnNewBaseline,
      maxDiffRatio,
      maskSelectors: maskSelectors.length > 0 ? maskSelectors : (config.mask ?? []),
      stability: {
        iterations: stabilityIterations,
        failAboveRate: stabilityFailAboveRate,
        fpThreshold: stabilityFpThreshold,
        flipbook: stabilityFlipbook,
      },
      backend,
    };
  }

  if (positional[0] === "stability-history") {
    const reportPaths = positional.slice(1);
    if (reportPaths.length === 0) {
      throw new Error("`vrt snapshot stability-history` requires one or more stability-report.json paths");
    }
    return {
      mode: "stability-history",
      urls: reportPaths,
      labels: explicitLabels,
      outputDir,
      threshold,
      failOnDiff,
      failOnNewBaseline,
      maxDiffRatio,
      maskSelectors: maskSelectors.length > 0 ? maskSelectors : (config.mask ?? []),
      stabilityHistory: {
        outPath: fixOutPath,
      },
      backend,
    };
  }

  if (positional[0] === "flipbook") {
    if (positional.length > 1) {
      throw new Error("`vrt snapshot flipbook` does not accept positional URLs");
    }
    return {
      mode: "flipbook",
      urls: [],
      labels: explicitLabels,
      outputDir,
      threshold,
      failOnDiff,
      failOnNewBaseline,
      maxDiffRatio,
      maskSelectors: maskSelectors.length > 0 ? maskSelectors : (config.mask ?? []),
      flipbook: {
        delayMs: flipbookDelayMs,
        outDir: flipbookOutDir,
      },
      backend,
    };
  }

  if (positional[0] === "fix-prompt") {
    if (positional.length > 1) {
      throw new Error("`vrt snapshot fix-prompt` does not accept positional URLs");
    }
    return {
      mode: "fix-prompt",
      urls: [],
      labels: explicitLabels,
      outputDir,
      threshold,
      failOnDiff,
      failOnNewBaseline,
      maxDiffRatio,
      maskSelectors: maskSelectors.length > 0 ? maskSelectors : (config.mask ?? []),
      fixPrompt: {
        format: fixFormat,
        limit: fixLimit,
        minDiffRatio: fixMinDiffRatio,
        outPath: fixOutPath,
      },
    };
  }

  const configuredUrls = positional.length > 0
    ? positional
    : resolveSnapshotConfigUrls(config);

  const configuredLabels = positional.length > 0
    ? []
    : (config.routes ?? []).map((route) => route.label);

  const labels = explicitLabels.length > 0
    ? resolveSnapshotLabels(configuredUrls, explicitLabels)
    : configuredUrls.map((url, index) => configuredLabels[index] ?? urlToSnapshotLabel(url));

  return {
    mode: "capture",
    urls: configuredUrls,
    labels,
    outputDir,
    threshold,
    failOnDiff,
    failOnNewBaseline,
    maxDiffRatio,
    maskSelectors: maskSelectors.length > 0 ? maskSelectors : (config.mask ?? []),
    backend,
  };
}

export function determineSnapshotExitCode(
  results: SnapshotSummaryEntry[],
  options: SnapshotFailureOptions,
): SnapshotFailureResult {
  const reasons: string[] = [];

  if (options.failOnNewBaseline && results.some((result) => result.isNew)) {
    reasons.push("New baseline detected while --fail-on-new-baseline is enabled");
  }

  if (options.failOnDiff && results.some((result) => !result.isNew && (result.diffRatio ?? 0) > 0)) {
    reasons.push("Diff detected while --fail-on-diff is enabled");
  }

  if (options.maxDiffRatio !== undefined) {
    const exceeded = results.find((result) => !result.isNew && (result.diffRatio ?? 0) > options.maxDiffRatio!);
    if (exceeded) {
      reasons.push(
        `Max diff ratio exceeded: ${exceeded.label} ${exceeded.viewport} is ${((exceeded.diffRatio ?? 0) * 100).toFixed(2)}%`,
      );
    }
  }

  return {
    exitCode: reasons.length > 0 ? 1 : 0,
    reasons,
  };
}

function parseSnapshotRoutes(value: unknown): SnapshotRouteConfig[] {
  if (!Array.isArray(value)) {
    throw new Error("snapshot config routes must be an array");
  }

  return value.map((entry, index) => {
    if (typeof entry === "string" && entry.trim() !== "") {
      return { path: entry };
    }
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`snapshot config route at index ${index} must be a string or object`);
    }
    const record = entry as Record<string, unknown>;
    const path = record.path ?? record.url;
    return {
      path: parseString(path, `snapshot config route at index ${index} must have a path`),
      label: record.label == null ? undefined : parseString(record.label, `snapshot config route at index ${index} has an invalid label`),
    };
  });
}

function resolveSnapshotConfigUrls(config: SnapshotConfig): string[] {
  const routes = config.routes ?? [];
  return routes.map((route) => {
    if (/^https?:\/\//i.test(route.path)) {
      return route.path;
    }
    if (!config.baseUrl) {
      throw new Error("baseUrl is required when snapshot routes are relative");
    }
    return new URL(route.path, config.baseUrl).toString();
  });
}

function parseString(value: unknown, message: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(message);
  }
  return value;
}

function parseBoolean(value: unknown, message: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(message);
  }
  return value;
}

function parseStringArray(value: unknown, message: string): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string" || entry.trim() === "")) {
    throw new Error(message);
  }
  return value;
}

function parseRatio(value: unknown, message: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(message);
  }
  return value;
}

function parseNonNegativeNumber(value: unknown, message: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(message);
  }
  return value;
}
