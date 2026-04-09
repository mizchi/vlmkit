import { join } from "node:path";

export interface WorkflowCaptureRoute {
  name: string;
  path: string;
  waitFor?: string;
}

export interface WorkflowCaptureConfig {
  baseUrl?: string;
  routes?: WorkflowCaptureRoute[];
  captureSpec?: string;
}

export interface ParsedWorkflowCliOptions {
  baseUrl?: string;
  routes: WorkflowCaptureRoute[];
  captureSpec?: string;
}

export interface WorkflowPaths {
  baselinesDir: string;
  snapshotsDir: string;
  outputDir: string;
  reportPath: string;
  expectationPath: string;
  specPath: string;
}

export const DEFAULT_WORKFLOW_CAPTURE_ROUTES: WorkflowCaptureRoute[] = [
  { name: "home", path: "/", waitFor: "main" },
  { name: "readme", path: "/readme", waitFor: "article" },
  { name: "files", path: "/files", waitFor: "main" },
  { name: "issues", path: "/issues", waitFor: "main" },
  { name: "pulls", path: "/pulls", waitFor: "main" },
];

export function parseWorkflowCaptureConfig(raw: string): WorkflowCaptureConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid workflow config JSON: ${String(error)}`);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Workflow config must be an object");
  }

  const record = parsed as Record<string, unknown>;
  const workflow = record.workflow == null
    ? undefined
    : parseObject(record.workflow, "workflow config workflow must be an object");

  const routesValue = workflow?.routes ?? record.routes;

  return {
    baseUrl: workflow?.baseUrl == null
      ? (record.baseUrl == null ? undefined : parseString(record.baseUrl, "workflow config baseUrl must be a non-empty string"))
      : parseString(workflow.baseUrl, "workflow config workflow.baseUrl must be a non-empty string"),
    routes: routesValue == null ? undefined : parseWorkflowRoutes(routesValue),
    captureSpec: workflow?.captureSpec == null
      ? (record.captureSpec == null ? undefined : parseString(record.captureSpec, "workflow config captureSpec must be a non-empty string"))
      : parseString(workflow.captureSpec, "workflow config workflow.captureSpec must be a non-empty string"),
  };
}

export function parseWorkflowCliArgs(
  cliArgs: string[],
  config: WorkflowCaptureConfig = {},
): ParsedWorkflowCliOptions {
  const routes = config.routes ?? DEFAULT_WORKFLOW_CAPTURE_ROUTES;
  let captureSpec = config.captureSpec;

  for (let i = 0; i < cliArgs.length; i++) {
    const arg = cliArgs[i]!;
    switch (arg) {
      case "--capture-spec": {
        const value = cliArgs[++i];
        if (!value) throw new Error("Missing value for --capture-spec");
        captureSpec = value;
        break;
      }
      case "--config": {
        i++;
        break;
      }
      case "--help":
      case "-h":
        break;
      default:
        if (arg.startsWith("--")) {
          throw new Error(`Unknown option: ${arg}`);
        }
        throw new Error(`Unexpected positional argument: ${arg}`);
    }
  }

  return {
    baseUrl: config.baseUrl,
    routes,
    captureSpec,
  };
}

export function parseWorkflowCaptureEnv(
  env: Record<string, string | undefined>,
): WorkflowCaptureRoute[] {
  const raw = env.VRT_ROUTES_JSON;
  if (!raw) {
    return DEFAULT_WORKFLOW_CAPTURE_ROUTES;
  }
  return parseWorkflowRoutes(JSON.parse(raw));
}

export function resolveWorkflowRouteUrl(route: WorkflowCaptureRoute, baseUrl: string): string {
  if (/^https?:\/\//i.test(route.path)) {
    return route.path;
  }
  return new URL(route.path, baseUrl).toString();
}

export function resolveWorkflowPaths(projectRoot: string): WorkflowPaths {
  return {
    baselinesDir: join(projectRoot, "baselines"),
    snapshotsDir: join(projectRoot, "snapshots"),
    outputDir: join(projectRoot, "output"),
    reportPath: join(projectRoot, "vrt-report.json"),
    expectationPath: join(projectRoot, "expectation.json"),
    specPath: join(projectRoot, "spec.json"),
  };
}

function parseWorkflowRoutes(value: unknown): WorkflowCaptureRoute[] {
  if (!Array.isArray(value)) {
    throw new Error("workflow config routes must be an array");
  }

  return value.map((entry, index) => {
    if (typeof entry === "string" && entry.trim() !== "") {
      return { name: routePathToName(entry), path: entry };
    }
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`workflow config route at index ${index} must be a string or object`);
    }

    const record = entry as Record<string, unknown>;
    const path = parseString(record.path ?? record.url, `workflow config route at index ${index} must have a path`);
    const alias = record.name ?? record.label;
    const waitFor = record.waitFor == null
      ? undefined
      : parseString(record.waitFor, `workflow config route at index ${index} has an invalid waitFor`);

    return waitFor == null
      ? {
          name: alias == null ? routePathToName(path) : parseString(alias, `workflow config route at index ${index} has an invalid name`),
          path,
        }
      : {
          name: alias == null ? routePathToName(path) : parseString(alias, `workflow config route at index ${index} has an invalid name`),
          path,
          waitFor,
        };
  });
}

function parseObject(value: unknown, message: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(message);
  }
  return value as Record<string, unknown>;
}

function parseString(value: unknown, message: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(message);
  }
  return value;
}

function sanitizeLabelPart(value: string): string {
  return value
    .trim()
    .replace(/%/g, "_")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function routePathToName(path: string): string {
  const parsed = new URL(path, "https://vrt.invalid");
  const base = sanitizeLabelPart(parsed.pathname.replace(/\.html$/i, "").replace(/\//g, "_")) || "root";

  const queryPairs = Array.from(parsed.searchParams.entries())
    .map(([key, value]) => [sanitizeLabelPart(key), sanitizeLabelPart(value)] as const)
    .sort(([aKey, aValue], [bKey, bValue]) => aKey.localeCompare(bKey) || aValue.localeCompare(bValue));

  const querySuffix = queryPairs.length > 0
    ? `__query_${queryPairs.map(([key, value]) => `${key}_${value || "empty"}`).join("__")}`
    : "";

  const hashPart = sanitizeLabelPart(parsed.hash.replace(/^#\/?/, ""));
  const hashSuffix = hashPart ? `__hash_${hashPart}` : "";

  return `${base}${querySuffix}${hashSuffix}`;
}
