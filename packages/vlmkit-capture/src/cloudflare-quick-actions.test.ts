import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCloudflareQuickActionEndpoint,
  createCloudflareQuickActionsClient,
  extractCloudflareCrawlRoutes,
  resolveCloudflareQuickActionsConfig,
} from "./cloudflare-quick-actions.ts";

describe("Cloudflare Quick Actions", () => {
  it("builds Browser Run REST endpoints", () => {
    assert.equal(
      buildCloudflareQuickActionEndpoint({
        accountId: "abc123",
        action: "screenshot",
      }),
      "https://api.cloudflare.com/client/v4/accounts/abc123/browser-rendering/screenshot",
    );
    assert.equal(
      buildCloudflareQuickActionEndpoint({
        accountId: "abc123",
        action: "crawl",
        jobId: "job-1",
      }),
      "https://api.cloudflare.com/client/v4/accounts/abc123/browser-rendering/crawl/job-1",
    );
  });

  it("resolves credentials from environment", () => {
    const resolved = resolveCloudflareQuickActionsConfig({
      CLOUDFLARE_ACCOUNT_ID: "account",
      CLOUDFLARE_API_TOKEN: "token",
    });

    assert.equal(resolved.accountId, "account");
    assert.equal(resolved.apiToken, "token");
  });

  it("rejects missing credentials", () => {
    assert.throws(
      () => resolveCloudflareQuickActionsConfig({}),
      /CLOUDFLARE_ACCOUNT_ID/,
    );
  });

  it("posts screenshot requests and returns binary metadata", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const client = createCloudflareQuickActionsClient({
      accountId: "account",
      apiToken: "token",
      fetch: async (url, init) => {
        calls.push({ url: String(url), init: init ?? {} });
        return new Response(new Uint8Array([1, 2, 3]), {
          headers: {
            "content-type": "image/png",
            "x-browser-ms-used": "42",
          },
        });
      },
    });

    const result = await client.screenshot({
      url: "https://example.com",
      viewport: { width: 1280, height: 720 },
      screenshotOptions: { fullPage: true },
    });

    assert.equal(calls[0]?.url, "https://api.cloudflare.com/client/v4/accounts/account/browser-rendering/screenshot");
    assert.equal(calls[0]?.init.method, "POST");
    assert.equal((calls[0]?.init.headers as Record<string, string>).Authorization, "Bearer token");
    assert.deepEqual(new Uint8Array(result.bytes), new Uint8Array([1, 2, 3]));
    assert.equal(result.contentType, "image/png");
    assert.equal(result.browserMsUsed, 42);
  });

  it("starts crawl jobs and extracts route candidates from crawl records", async () => {
    const client = createCloudflareQuickActionsClient({
      accountId: "account",
      apiToken: "token",
      fetch: async () => Response.json({ result: "job-1" }),
    });

    const started = await client.startCrawl({
      url: "https://example.com/docs",
      limit: 10,
      depth: 2,
      render: false,
      formats: ["html"],
    });

    assert.equal(started.jobId, "job-1");

    const routes = extractCloudflareCrawlRoutes({
      id: "job-1",
      status: "completed",
      total: 3,
      finished: 3,
      records: [
        { url: "https://example.com/docs", status: "completed", metadata: { status: 200, url: "https://example.com/docs", title: "Docs" } },
        { url: "https://example.com/docs/api#hash", status: "completed", metadata: { status: 200, url: "https://example.com/docs/api#hash" } },
        { url: "https://external.example.net/", status: "completed", metadata: { status: 200, url: "https://external.example.net/" } },
      ],
    }, {
      baseUrl: "https://example.com",
    });

    assert.deepEqual(routes, [
      { url: "https://example.com/docs", path: "/docs", title: "Docs" },
      { url: "https://example.com/docs/api#hash", path: "/docs/api" },
    ]);
  });
});
