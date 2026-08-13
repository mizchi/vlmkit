import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
  buildCloudflareCdpUrl,
  createCloudflareCdpCapturer,
  resolveCaptureBackend,
} from "./capturer.ts";

describe("buildCloudflareCdpUrl", () => {
  it("builds the default URL from an account id", () => {
    assert.equal(
      buildCloudflareCdpUrl({ accountId: "abc123" }),
      "wss://api.cloudflare.com/client/v4/accounts/abc123/browser-rendering/devtools/browser",
    );
  });

  it("uses the override endpoint when supplied", () => {
    assert.equal(
      buildCloudflareCdpUrl({ accountId: "abc123", endpoint: "wss://example.test/ws" }),
      "wss://example.test/ws",
    );
  });

  it("rejects empty account ids when no override is given", () => {
    assert.throws(() => buildCloudflareCdpUrl({ accountId: "" }), /account id is required/i);
    assert.throws(() => buildCloudflareCdpUrl({ accountId: "   " }), /account id is required/i);
  });
});

describe("createCloudflareCdpCapturer", () => {
  it("rejects empty API tokens at construction time", () => {
    assert.throws(
      () => createCloudflareCdpCapturer({ accountId: "abc", apiToken: "" }),
      /API token is required/i,
    );
  });

  it("produces a backend tagged cloudflare-cdp", () => {
    const cap = createCloudflareCdpCapturer({ accountId: "1234abcd", apiToken: "tok" });
    assert.equal(cap.kind, "cloudflare-cdp");
    assert.match(cap.label, /cloudflare browser run/);
  });

  it("masks long account ids in the label", () => {
    const cap = createCloudflareCdpCapturer({
      accountId: "abcd1234efgh5678",
      apiToken: "tok",
    });
    assert.match(cap.label, /abcd…5678/);
  });
});

describe("resolveCaptureBackend", () => {
  it("defaults to local when no flag or env is set", () => {
    const r = resolveCaptureBackend({ env: {} });
    assert.equal(r.backend.kind, "local");
    assert.equal(r.source, "default");
  });

  it("honors the --backend flag (cloudflare)", () => {
    const r = resolveCaptureBackend({
      backendFlag: "cloudflare",
      env: { CLOUDFLARE_ACCOUNT_ID: "abc", CLOUDFLARE_API_TOKEN: "tok" },
    });
    assert.equal(r.backend.kind, "cloudflare-cdp");
    assert.equal(r.source, "flag");
  });

  it("accepts cloudflare-cdp and browser-run as aliases", () => {
    for (const alias of ["cloudflare-cdp", "browser-run"]) {
      const r = resolveCaptureBackend({
        backendFlag: alias,
        env: { CLOUDFLARE_ACCOUNT_ID: "abc", CLOUDFLARE_API_TOKEN: "tok" },
      });
      assert.equal(r.backend.kind, "cloudflare-cdp", `alias ${alias}`);
    }
  });

  it("falls back to VLMKIT_CAPTURE_BACKEND env var", () => {
    const r = resolveCaptureBackend({
      env: {
        VLMKIT_CAPTURE_BACKEND: "cloudflare",
        CLOUDFLARE_ACCOUNT_ID: "abc",
        CLOUDFLARE_API_TOKEN: "tok",
      },
    });
    assert.equal(r.backend.kind, "cloudflare-cdp");
    assert.equal(r.source, "env");
  });

  it("throws a clear error when CF credentials are missing", () => {
    assert.throws(
      () => resolveCaptureBackend({ backendFlag: "cloudflare", env: {} }),
      /CLOUDFLARE_ACCOUNT_ID/,
    );
    assert.throws(
      () => resolveCaptureBackend({
        backendFlag: "cloudflare",
        env: { CLOUDFLARE_ACCOUNT_ID: "abc" },
      }),
      /CLOUDFLARE_API_TOKEN/,
    );
  });

  it("rejects unknown backend names", () => {
    assert.throws(
      () => resolveCaptureBackend({ backendFlag: "firefox" }),
      /Unknown capture backend/,
    );
  });

  it("ignores case in flag and env values", () => {
    const r = resolveCaptureBackend({
      backendFlag: "Cloudflare",
      env: { CLOUDFLARE_ACCOUNT_ID: "abc", CLOUDFLARE_API_TOKEN: "tok" },
    });
    assert.equal(r.backend.kind, "cloudflare-cdp");
  });
});
