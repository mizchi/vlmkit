/**
 * `check perf` takes two of the three page-load flags, and the third is refused
 * rather than ignored.
 *
 * `--timeout` / `--wait-until` matter here for the same reason as everywhere
 * else — a dev server that never reaches network idle made the gate unusable
 * (issue #112). `--har` is refused: HAR replay serves every response off local
 * disk, so TTFB / LCP / FCP would report disk-read times. A gate silently
 * measuring the wrong thing is worse than a gate that says no.
 */
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, it } from "vitest";
import { UsageError } from "@mizchi/vlmkit-core/cli-error.ts";
import { perfGate } from "./perf.gate.ts";

const ctx = { cwd: process.cwd(), argv: [] as string[], json: false };

describe("check perf page-load flags", () => {
  let server: Server;
  let url = "";
  let outDir = "";

  beforeAll(async () => {
    server = createServer((req, res) => {
      if (req.url === "/never-answers") return; // the request that never settles
      res.writeHead(200, { "content-type": "text/html", "cache-control": "no-store" });
      res.end(`<!doctype html><meta charset="utf-8"><title>Vitals</title>
<style>body{margin:0}main{padding:24px}</style>
<body><main><h1>Shell</h1></main>
<script>fetch('/never-answers').catch(() => {});</script>`);
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    url = `http://127.0.0.1:${(server.address() as { port: number }).port}/`;
    outDir = mkdtempSync(join(tmpdir(), "perf-page-load-"));
  });

  afterAll(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("refuses --har with a reason instead of accepting and ignoring it", () => {
    assert.throws(
      () => perfGate.parse([url, "--har", "rec.har"], ctx),
      (e: Error) => e instanceof UsageError && /disk reads/.test(e.message),
    );
  });

  it("honours --timeout and --wait-until on a page that never goes idle", { timeout: 120_000 }, async () => {
    const argv = (extra: string[]) => [
      url,
      "--observe", "0",
      "--output-dir", join(outDir, extra.length ? "lowered" : "default"),
      "--timeout", "1500",
      ...extra,
    ];
    // Default milestone: the never-answered fetch keeps networkidle away, so the
    // 1500ms navigation timeout fires. If --timeout were dropped this would
    // instead sit for 30s and the test would time out — which is also a failure,
    // just a slower one.
    // The message shape is the enriched one from `browser-launch.ts`, which names the
    // milestone and the flag that ends the wait — Playwright's bare `Timeout 1500ms
    // exceeded` was reported as a dead end by two dogfood agents. Asserting the
    // enriched form keeps this gate covered by that fix rather than pinning the old
    // wording it replaced.
    await assert.rejects(
      async () => perfGate.run(perfGate.parse(argv([]), ctx), ctx),
      (e: Error) => /page load timed out after 1500ms waiting for `networkidle`/.test(e.message)
        && /--wait-until load/.test(e.message),
    );
    const report = await perfGate.run(
      perfGate.parse(argv(["--wait-until", "domcontentloaded"]), ctx),
      ctx,
    ) as { verdicts: { cls: string } };
    assert.ok(report.verdicts.cls, "the run completed and produced a CLS verdict");
  });
});
