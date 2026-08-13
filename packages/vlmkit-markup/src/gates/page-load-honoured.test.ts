/**
 * The flags reach the browser — proved against a server that behaves like the
 * app in issue #112, not against a mock.
 *
 * The page here does what the reported React + MapLibre dev server did:
 *
 *   - serves its shell immediately, so `domcontentloaded` fires at once;
 *   - renders its real content ~250ms later, from script (so a gate that reads
 *     at DCL without settling would see the placeholder);
 *   - fires one `fetch()` the server never answers, so `networkidle` never
 *     arrives and any gate hardcoding `waitUntil: "networkidle"` fails with
 *     `Timeout 30000ms exceeded`.
 *
 * Each case therefore asserts two things at once, which is what makes it a real
 * regression guard: the default path still times out (so the fixture is doing
 * its job), and `--wait-until domcontentloaded` both completes AND measures the
 * settled DOM. A gate that accepted the flag and ignored it fails the first
 * assertion; a gate that honoured it but skipped the settle fails the second.
 *
 * Deliberately a representative sample rather than all 18 gates: one per
 * threading mechanism (measurement-module `navigatePage`, `openSource` +
 * `pickPageLoad`, `load`-default + `settlePage`, and a gate whose `run`
 * re-assembles its options around a config file). Each case launches Chromium
 * twice, so covering all 18 would cost minutes to re-prove one mechanism.
 */
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, it } from "vitest";
import type { AnyGateDefinition } from "@mizchi/vlmkit-core/plugin/contract.ts";
import { a11yTouchGate, breakpointsGate, handlersGate, layoutGate } from "./index.ts";

const RENDER_DELAY_MS = 250;

/** Shell now, content after RENDER_DELAY_MS, and one request that never answers. */
const HTML = `<!doctype html><meta charset="utf-8"><title>Live map</title>
<style>body{margin:0;font:16px system-ui,sans-serif}#root{padding:24px}
.card{width:320px;border:1px solid #ccc;padding:12px;margin:0 0 8px}
button{font:inherit;padding:14px 18px}
@media (max-width: 700px) { .card { width: 100% } }</style>
<body><div id="root"><p>Loading…</p></div>
<script>
fetch('/never-answers').catch(() => {});
setTimeout(() => {
  document.getElementById('root').innerHTML =
    '<div class="card">Layer A</div><div class="card">Layer B</div>'
    + '<button id="fit">Fit bounds</button>';
  document.getElementById('fit').addEventListener('click', () => {});
}, ${RENDER_DELAY_MS});
</script>`;

const ctx = { cwd: process.cwd(), argv: [] as string[], json: false };

/** Drive a gate the way the CLI does: its own `parse`, then its own `run`. */
async function runGate(gate: AnyGateDefinition, argv: string[]): Promise<unknown> {
  return gate.run(gate.parse(argv, ctx), ctx);
}

/**
 * True when the failure is the navigation timeout, not something unrelated — and
 * when it explains itself.
 *
 * This used to match Playwright's raw `Timeout 1500ms exceeded`. Two dogfood agents
 * called that message a dead end (it names neither the milestone waited on nor the
 * request still open), so `browser-launch.ts` now replaces it at the launch. Matching
 * the enriched shape here is what proves the replacement reaches gate code paths and
 * not just a unit test: these cases drive real gates through their own parse/run.
 */
function isNavigationTimeout(error: unknown): boolean {
  const message = String((error as Error)?.message ?? error);
  if (!/page load timed out after \d+ms waiting for `\w+`/.test(message)) return false;
  // The way out has to travel with the failure. `networkidle` is what every one of
  // these cases waits on, so the relaxation advice must be present.
  return /--wait-until load/.test(message) && /--har/.test(message);
}

describe("--wait-until / --timeout reach the browser on a never-idle page", () => {
  let server: Server;
  let url = "";
  let outDir = "";

  beforeAll(async () => {
    server = createServer((req, res) => {
      // The hang: no response, no end. This is the third-party request that
      // kept the reported app from ever reaching network idle.
      if (req.url === "/never-answers") return;
      res.writeHead(200, { "content-type": "text/html", "cache-control": "no-store" });
      res.end(HTML);
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    url = `http://127.0.0.1:${(server.address() as { port: number }).port}/`;
    outDir = mkdtempSync(join(tmpdir(), "page-load-honoured-"));
  });

  afterAll(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("check breakpoints: navigatePage inside the measurement module", { timeout: 120_000 }, async () => {
    await assert.rejects(
      () => runGate(breakpointsGate, [url, "--timeout", "1500", "--breakpoints", "700"]),
      isNavigationTimeout,
      "the fixture no longer hangs, so this case proves nothing",
    );
    const report = await runGate(breakpointsGate, [
      url,
      "--timeout", "1500",
      "--wait-until", "domcontentloaded",
      "--breakpoints", "700",
    ]) as { checkedValues: number[] };
    assert.deepEqual(report.checkedValues, [700]);
  });

  it("check a11y touch: openSource + pickPageLoad", { timeout: 120_000 }, async () => {
    await assert.rejects(
      () => runGate(a11yTouchGate, [url, "--timeout", "1500", "--output-dir", join(outDir, "touch-a")]),
      isNavigationTimeout,
    );
    const report = await runGate(a11yTouchGate, [
      url,
      "--timeout", "1500",
      "--wait-until", "domcontentloaded",
      "--output-dir", join(outDir, "touch-b"),
    ]) as { inspectedCount: number };
    // The button only exists after RENDER_DELAY_MS. Zero here would mean the
    // flag was honoured but the settle was skipped — a pass that measured the
    // placeholder, which is worse than the timeout it replaced.
    assert.ok(report.inspectedCount >= 1, `inspected ${report.inspectedCount} targets`);
  });

  it("scan handlers: the load-default gates keep their milestone and still take the flags", { timeout: 120_000 }, async () => {
    // This gate navigates at `load` and settles afterwards, so it survives the
    // never-idle page WITHOUT any flag — that is why the default must not have
    // been levelled to networkidle. It still honours a lowered milestone.
    type Report = { surface: { totalRegistrations: number } };
    const dflt = await runGate(handlersGate, [url]) as Report;
    assert.ok(dflt.surface.totalRegistrations >= 1, "the load-default path regressed");

    const lowered = await runGate(handlersGate, [
      url,
      "--timeout", "1500",
      "--wait-until", "domcontentloaded",
    ]) as Report;
    assert.ok(
      lowered.surface.totalRegistrations >= 1,
      "the click handler is registered after the delayed render, so 0 means the settle was skipped",
    );
  });

  it("check layout: a gate whose run() re-assembles its options around a config file", { timeout: 120_000 }, async () => {
    const contract = join(outDir, "contract.json");
    writeFileSync(contract, JSON.stringify({ rules: [{ selector: ".card", at: 1280, count: 2 }] }));
    await assert.rejects(
      () => runGate(layoutGate, [url, "--contract", contract, "--timeout", "1500"]),
      isNavigationTimeout,
    );
    const report = await runGate(layoutGate, [
      url,
      "--contract", contract,
      "--timeout", "1500",
      "--wait-until", "domcontentloaded",
    ]) as { done: boolean; results: { checks: { measured: string }[] }[] };
    // `count .card == 2` is the assertion `verify flow` used to fail on a
    // client-rendered page for want of a settle (see settle-consistency.test.ts).
    assert.equal(report.results[0]?.checks[0]?.measured, "2");
    assert.equal(report.done, true);
  });
});

describe("--har replays a recording after the server is gone", () => {
  it("check breakpoints gates a URL whose backing server has been shut down", { timeout: 120_000 }, async () => {
    const server = createServer((_req, res) => {
      res.writeHead(200, { "content-type": "text/html", "cache-control": "no-store" });
      res.end(`<!doctype html><meta charset="utf-8"><title>Recorded</title>
<style>body{margin:0}.card{width:320px}@media (max-width: 700px){.card{width:100%}}</style>
<body><div class="card">Recorded layer</div>`);
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const url = `http://127.0.0.1:${(server.address() as { port: number }).port}/`;
    const har = join(mkdtempSync(join(tmpdir(), "page-load-har-")), "recording.har");

    const { chromium } = await import("playwright");
    const browser = await chromium.launch();
    const recordingContext = await browser.newContext({ recordHar: { path: har } });
    await (await recordingContext.newPage()).goto(url, { waitUntil: "load" });
    await recordingContext.close();
    await browser.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));

    // Without the HAR this is ERR_CONNECTION_REFUSED: the port is closed.
    await assert.rejects(() => runGate(breakpointsGate, [url, "--timeout", "3000", "--breakpoints", "700"]));

    const report = await runGate(breakpointsGate, [
      url,
      "--har", har,
      "--wait-until", "load",
      "--timeout", "5000",
      "--breakpoints", "700",
    ]) as { checkedValues: number[]; source: string };
    assert.deepEqual(report.checkedValues, [700]);
    assert.equal(report.source, url);
  });
});
