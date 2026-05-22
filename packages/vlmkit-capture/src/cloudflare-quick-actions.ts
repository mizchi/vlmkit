export type CloudflareQuickAction = "screenshot" | "crawl";

export interface CloudflareQuickActionsConfig {
  accountId: string;
  apiToken: string;
  apiBase?: string;
  fetch?: typeof fetch;
}

export interface CloudflareQuickActionsEnv {
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;
  CLOUDFLARE_BROWSER_RENDERING_API_BASE?: string;
}

export interface CloudflareQuickActionEndpointInput {
  accountId: string;
  action: CloudflareQuickAction;
  jobId?: string;
  apiBase?: string;
}

export interface CloudflareScreenshotRequest {
  url?: string;
  html?: string;
  viewport?: {
    width: number;
    height: number;
    deviceScaleFactor?: number;
  };
  screenshotOptions?: {
    fullPage?: boolean;
    omitBackground?: boolean;
    type?: "png" | "jpeg" | "webp";
    quality?: number;
    clip?: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  };
  selector?: string;
  gotoOptions?: Record<string, unknown>;
  authenticate?: Record<string, unknown>;
  cookies?: unknown[];
  setExtraHTTPHeaders?: Record<string, string>;
  addScriptTag?: Array<Record<string, unknown>>;
  addStyleTag?: Array<Record<string, unknown>>;
  userAgent?: string;
}

export interface CloudflareScreenshotResult {
  bytes: ArrayBuffer;
  contentType: string;
  browserMsUsed?: number;
}

export interface CloudflareCrawlRequest {
  url: string;
  limit?: number;
  depth?: number;
  formats?: Array<"html" | "markdown" | "json">;
  render?: boolean;
  maxAge?: number;
  options?: {
    includePatterns?: string[];
    excludePatterns?: string[];
    includeExternalLinks?: boolean;
    includeSubdomains?: boolean;
  };
  gotoOptions?: Record<string, unknown>;
  authenticate?: Record<string, unknown>;
  cookies?: unknown[];
  setExtraHTTPHeaders?: Record<string, string>;
  rejectResourceTypes?: string[];
}

export interface CloudflareCrawlStartResult {
  jobId: string;
}

export type CloudflareCrawlRecordStatus =
  | "queued"
  | "errored"
  | "completed"
  | "disallowed"
  | "skipped"
  | "cancelled";

export interface CloudflareCrawlRecord {
  url: string;
  status: CloudflareCrawlRecordStatus;
  metadata?: {
    status?: number;
    url?: string;
    title?: string;
  };
  html?: string;
  markdown?: string;
  json?: unknown;
}

export interface CloudflareCrawlResult {
  id: string;
  status: string;
  browserSecondsUsed?: number;
  total?: number;
  finished?: number;
  records: CloudflareCrawlRecord[];
}

export interface CloudflareCrawlRoute {
  url: string;
  path: string;
  title?: string;
}

export interface ExtractCloudflareCrawlRoutesOptions {
  baseUrl?: string;
}

export function buildCloudflareQuickActionEndpoint(input: CloudflareQuickActionEndpointInput): string {
  const apiBase = (input.apiBase ?? "https://api.cloudflare.com/client/v4").replace(/\/$/u, "");
  const account = encodeURIComponent(input.accountId);
  const action = input.action;
  const base = `${apiBase}/accounts/${account}/browser-rendering/${action}`;
  return input.jobId ? `${base}/${encodeURIComponent(input.jobId)}` : base;
}

export function resolveCloudflareQuickActionsConfig(
  env: CloudflareQuickActionsEnv = process.env,
): CloudflareQuickActionsConfig {
  const accountId = env.CLOUDFLARE_ACCOUNT_ID?.trim();
  if (!accountId) {
    throw new Error("CLOUDFLARE_ACCOUNT_ID is required for Cloudflare Quick Actions");
  }
  const apiToken = env.CLOUDFLARE_API_TOKEN?.trim();
  if (!apiToken) {
    throw new Error("CLOUDFLARE_API_TOKEN is required for Cloudflare Quick Actions");
  }
  return {
    accountId,
    apiToken,
    apiBase: env.CLOUDFLARE_BROWSER_RENDERING_API_BASE?.trim() || undefined,
  };
}

export function createCloudflareQuickActionsClient(config: CloudflareQuickActionsConfig) {
  const fetchImpl = config.fetch ?? fetch;
  const headers = {
    Authorization: `Bearer ${config.apiToken}`,
    "Content-Type": "application/json",
  };

  async function post(action: CloudflareQuickAction, body: unknown): Promise<Response> {
    const response = await fetchImpl(buildCloudflareQuickActionEndpoint({
      accountId: config.accountId,
      action,
      apiBase: config.apiBase,
    }), {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`Cloudflare ${action} failed: ${response.status} ${await response.text()}`);
    }
    return response;
  }

  return {
    async screenshot(input: CloudflareScreenshotRequest): Promise<CloudflareScreenshotResult> {
      if (!input.url && !input.html) {
        throw new Error("Cloudflare screenshot requires url or html");
      }
      const response = await post("screenshot", input);
      const browserMsHeader = response.headers.get("x-browser-ms-used");
      return {
        bytes: await response.arrayBuffer(),
        contentType: response.headers.get("content-type") ?? "image/png",
        browserMsUsed: browserMsHeader ? Number(browserMsHeader) : undefined,
      };
    },

    async startCrawl(input: CloudflareCrawlRequest): Promise<CloudflareCrawlStartResult> {
      const response = await post("crawl", input);
      const parsed = await response.json() as unknown;
      return {
        jobId: normalizeCrawlJobId(parsed),
      };
    },

    async getCrawlResult(jobId: string): Promise<CloudflareCrawlResult> {
      const response = await fetchImpl(buildCloudflareQuickActionEndpoint({
        accountId: config.accountId,
        action: "crawl",
        jobId,
        apiBase: config.apiBase,
      }), {
        method: "GET",
        headers: { Authorization: `Bearer ${config.apiToken}` },
      });
      if (!response.ok) {
        throw new Error(`Cloudflare crawl result failed: ${response.status} ${await response.text()}`);
      }
      const parsed = await response.json() as unknown;
      return normalizeCrawlResult(parsed);
    },
  };
}

export function extractCloudflareCrawlRoutes(
  result: CloudflareCrawlResult,
  options: ExtractCloudflareCrawlRoutesOptions = {},
): CloudflareCrawlRoute[] {
  const base = options.baseUrl ? new URL(options.baseUrl) : undefined;
  const seen = new Set<string>();
  const routes: CloudflareCrawlRoute[] = [];
  for (const record of result.records) {
    if (record.status !== "completed") continue;
    const rawUrl = record.metadata?.url ?? record.url;
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      continue;
    }
    if (base && parsed.origin !== base.origin) continue;
    const path = parsed.pathname + parsed.search;
    if (seen.has(path)) continue;
    seen.add(path);
    const route: CloudflareCrawlRoute = {
      url: rawUrl,
      path,
    };
    if (record.metadata?.title) route.title = record.metadata.title;
    routes.push(route);
  }
  return routes;
}

function normalizeCrawlJobId(parsed: unknown): string {
  if (typeof parsed === "string") return parsed;
  if (isRecord(parsed)) {
    if (typeof parsed.result === "string") return parsed.result;
    if (isRecord(parsed.result) && typeof parsed.result.id === "string") return parsed.result.id;
    if (typeof parsed.id === "string") return parsed.id;
  }
  throw new Error("Cloudflare crawl response did not include a job id");
}

function normalizeCrawlResult(parsed: unknown): CloudflareCrawlResult {
  const value = isRecord(parsed) && isRecord(parsed.result) ? parsed.result : parsed;
  if (!isRecord(value)) {
    throw new Error("Cloudflare crawl result must be an object");
  }
  return {
    id: readString(value, "id"),
    status: readString(value, "status"),
    browserSecondsUsed: readNumber(value, "browserSecondsUsed"),
    total: readNumber(value, "total"),
    finished: readNumber(value, "finished"),
    records: Array.isArray(value.records)
      ? value.records.filter(isRecord).map(normalizeCrawlRecord)
      : [],
  };
}

function normalizeCrawlRecord(value: Record<string, unknown>): CloudflareCrawlRecord {
  return {
    url: readString(value, "url"),
    status: readString(value, "status") as CloudflareCrawlRecordStatus,
    metadata: isRecord(value.metadata)
      ? {
        status: readNumber(value.metadata, "status"),
        url: readOptionalString(value.metadata, "url"),
        title: readOptionalString(value.metadata, "title"),
      }
      : undefined,
    html: readOptionalString(value, "html"),
    markdown: readOptionalString(value, "markdown"),
    json: value.json,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === "string" ? value : "";
}

function readOptionalString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

function readNumber(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  return typeof value === "number" ? value : undefined;
}
