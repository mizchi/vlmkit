import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { UsageError } from "@mizchi/vlmkit-core/cli-error.ts";
import { parseArgs } from "./record-har-cli.ts";

describe("snapshot record-har args", () => {
  it("defaults to the milestone --har exists for, not networkidle", () => {
    // The whole reason `--har` was added is a page that never reaches network idle,
    // so defaulting the RECORDER to `networkidle` would hang on exactly the pages
    // that need a recording.
    const args = parseArgs(["http://localhost:5173/"]);
    assert.equal(args.waitUntil, "load");
    assert.equal(args.out, "app.har");
    assert.equal(args.content, "embed");
    // Late XHR is the common case for a dashboard; a recording without the metrics
    // call is stale before it is written.
    assert.ok(args.settleMs > 0);
  });

  it("reads the flags", () => {
    const args = parseArgs([
      "http://localhost:5173/app",
      "--out", "fixtures/app.har",
      "--wait-until", "domcontentloaded",
      "--timeout", "9000",
      "--settle", "0",
      "--no-content",
    ]);
    assert.deepEqual(
      { ...args },
      {
        url: "http://localhost:5173/app",
        out: "fixtures/app.har",
        waitUntil: "domcontentloaded",
        timeout: 9000,
        settleMs: 0,
        content: "omit",
      },
    );
  });

  it("refuses a local file, which has no network to pin", () => {
    assert.throws(() => parseArgs(["page.html"]), (e: Error) =>
      e instanceof UsageError && /no network to pin/.test(e.message));
  });

  it("refuses a wait state Playwright does not have, rather than passing it through", () => {
    assert.throws(
      () => parseArgs(["http://localhost:1/", "--wait-until", "settled"]),
      (e: Error) => e instanceof UsageError && /must be one of/.test(e.message),
    );
  });

  it("requires a URL", () => {
    assert.throws(() => parseArgs([]), UsageError);
    assert.throws(() => parseArgs(["--out", "x.har"]), UsageError);
  });
});
