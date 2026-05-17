/**
 * Browser launch abstraction.
 *
 * Lets every consumer pick between launching Chromium locally and connecting
 * to a remote Chrome DevTools Protocol endpoint such as Cloudflare's
 * Browser Run service (https://api.cloudflare.com/client/v4/accounts/<id>/browser-rendering/devtools/browser).
 *
 * The factory only knows how to *open* a Browser. Page/context creation is
 * left to the caller so existing capture code can keep its current
 * `browser.newPage({viewport})` style.
 */
import { chromium, type Browser } from "playwright";

export type CaptureBackendKind = "local" | "cloudflare-cdp";

export interface CaptureBackend {
  readonly kind: CaptureBackendKind;
  /** Human-readable label used in logs. */
  readonly label: string;
  launch(): Promise<Browser>;
  close(browser: Browser): Promise<void>;
}

export interface CloudflareCdpOptions {
  accountId: string;
  apiToken: string;
  /** Override the default CF CDP URL (useful for tests / private deployments). */
  endpoint?: string;
}

export function buildCloudflareCdpUrl(opts: { accountId: string; endpoint?: string }): string {
  if (opts.endpoint && opts.endpoint.length > 0) return opts.endpoint;
  const account = opts.accountId.trim();
  if (account.length === 0) {
    throw new Error("Cloudflare account id is required to build the CDP URL");
  }
  return `wss://api.cloudflare.com/client/v4/accounts/${account}/browser-rendering/devtools/browser`;
}

export function createLocalCapturer(): CaptureBackend {
  return {
    kind: "local",
    label: "local chromium",
    async launch() {
      return chromium.launch();
    },
    async close(browser) {
      await browser.close();
    },
  };
}

export function createCloudflareCdpCapturer(opts: CloudflareCdpOptions): CaptureBackend {
  if (!opts.apiToken || opts.apiToken.trim().length === 0) {
    throw new Error("Cloudflare API token is required for the cloudflare-cdp backend");
  }
  const wsEndpoint = buildCloudflareCdpUrl(opts);
  const headers = { Authorization: `Bearer ${opts.apiToken}` };

  return {
    kind: "cloudflare-cdp",
    label: `cloudflare browser run (${maskAccount(opts.accountId)})`,
    async launch() {
      return chromium.connectOverCDP(wsEndpoint, { headers });
    },
    async close(browser) {
      // For remote browsers, close() releases the WebSocket but does not
      // terminate the CF session — that's managed server-side.
      await browser.close();
    },
  };
}

function maskAccount(id: string): string {
  if (id.length <= 8) return id;
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}

export interface ResolveCaptureBackendOptions {
  /** Value from `--backend` CLI flag (e.g. "local", "cloudflare"). */
  backendFlag?: string;
  env?: NodeJS.ProcessEnv;
}

export interface ResolvedCaptureBackend {
  backend: CaptureBackend;
  source: "flag" | "env" | "default";
}

/**
 * Resolution order:
 *   1. Explicit `--backend` flag
 *   2. `VRT_CAPTURE_BACKEND` env var
 *   3. Default local
 *
 * For the Cloudflare backend, credentials come from env (`CLOUDFLARE_ACCOUNT_ID`
 * + `CLOUDFLARE_API_TOKEN`) regardless of how the backend was selected, so
 * CI configs can stay declarative.
 */
export function resolveCaptureBackend(
  options: ResolveCaptureBackendOptions = {},
): ResolvedCaptureBackend {
  const env = options.env ?? process.env;
  const explicit = options.backendFlag?.trim().toLowerCase();
  const envChoice = env.VRT_CAPTURE_BACKEND?.trim().toLowerCase();

  const choice = explicit || envChoice || "local";
  const source: ResolvedCaptureBackend["source"] = explicit
    ? "flag"
    : envChoice
      ? "env"
      : "default";

  switch (choice) {
    case "local":
    case "chromium":
      return { backend: createLocalCapturer(), source };
    case "cloudflare":
    case "cloudflare-cdp":
    case "browser-run": {
      const accountId = env.CLOUDFLARE_ACCOUNT_ID?.trim();
      const apiToken = env.CLOUDFLARE_API_TOKEN?.trim();
      const endpoint = env.CLOUDFLARE_BROWSER_RUN_ENDPOINT?.trim();
      if (!accountId) {
        throw new Error("CLOUDFLARE_ACCOUNT_ID is required when --backend cloudflare is selected");
      }
      if (!apiToken) {
        throw new Error("CLOUDFLARE_API_TOKEN is required when --backend cloudflare is selected");
      }
      return {
        backend: createCloudflareCdpCapturer({ accountId, apiToken, endpoint }),
        source,
      };
    }
    default:
      throw new Error(`Unknown capture backend: ${choice}`);
  }
}
