/**
 * A gate pointed at an auth-walled route must never report success for the
 * login page it actually measured.
 *
 * Three gates learned this earlier (integrity / copy / design, via
 * `describeRedirect`). The rest were left, and the remaining work was labelled
 * cosmetic. It was not: measured 2026-08-02 against a route that 302s to
 * `/login` without a session,
 *
 *   check breakpoints : status: ok
 *   check scroll      : status: ok
 *   scan scroll       : status: ok
 *   check layout      : VIOLATED "count: expected 2, measured 0"   <- blames the markup
 *   verify flow       : every step fails on "element not found"    <- blames the flow
 *
 * The first three are silent false passes; the last two send the reader to
 * debug markup that is fine. Every one of them named the requested URL as its
 * source while measuring a different page.
 */
import assert from "node:assert/strict";
import { afterAll, beforeAll, describe, it } from "vitest";
import { createServer, type Server } from "node:http";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runBreakpointCheck } from "./stress/breakpoint-check.ts";
import { runFlowVerify } from "./inspect/flow-verify.ts";
import { runIntegrityCheck } from "./inspect/integrity-check.ts";
import { runLayoutVerify } from "./inspect/layout-contract.ts";
import { runScrollBehavior } from "./inspect/scroll-behavior.ts";
import { runScrollScan } from "./inspect/scroll-scan.ts";

/** `/app` redirects to `/login` unless a session cookie is present. */
function startWall(): Promise<{ server: Server; base: string }> {
  const server = createServer((req, res) => {
    if ((req.url ?? "").startsWith("/app") && !(req.headers.cookie ?? "").includes("session=")) {
      res.writeHead(302, { location: "/login" });
      res.end();
      return;
    }
    const login = (req.url ?? "").startsWith("/login");
    res.writeHead(200, { "content-type": "text/html" });
    res.end(login
      ? `<!doctype html><meta charset="utf-8"><title>Sign in</title><body style="font:16px sans-serif;padding:40px"><h1>Sign in</h1><form><input type="password"><button>Sign in</button></form></body>`
      : `<!doctype html><meta charset="utf-8"><title>Dashboard</title><body style="margin:0"><main><div class="card" style="width:1000px">Revenue</div><div class="card" style="width:1000px">Costs</div></main></body>`);
  });
  return new Promise((resolve) => {
    server.listen(0, () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      resolve({ server, base: `http://127.0.0.1:${port}` });
    });
  });
}

describe("gates refuse to pass on a login wall", () => {
  let server: Server;
  let walled = "";

  beforeAll(async () => {
    const started = await startWall();
    server = started.server;
    walled = `${started.base}/app`;
  });
  afterAll(() => server.close());

  const REDIRECT = /redirected: requested \/app but measured .*\/login/;

  it("check integrity reports it as a fail", async () => {
    const report = await runIntegrityCheck({ source: walled, viewports: [{ width: 1280, height: 800 }] });
    const finding = report.findings.find((f) => f.kind === "redirected");
    assert.ok(finding, JSON.stringify(report.findings.map((f) => f.kind)));
    assert.match(finding.message, REDIRECT);
    assert.equal(report.verdict, "defects");
  });

  it("check breakpoints reports a suspect issue rather than status: ok", async () => {
    const report = await runBreakpointCheck({ source: walled });
    const issue = report.issues.find((i) => i.kind === "redirected");
    assert.ok(issue, "expected a redirected issue");
    assert.equal(issue.severity, "suspect");
    assert.match(issue.message, REDIRECT);
  });

  it("check scroll reports a suspect issue", async () => {
    const report = await runScrollBehavior({ source: walled });
    const issue = report.issues.find((i) => i.kind === "redirected");
    assert.ok(issue, "expected a redirected issue");
    assert.equal(issue.severity, "suspect");
  });

  it("scan scroll reports a suspect issue", async () => {
    const report = await runScrollScan({ source: walled });
    const issue = report.issues.find((i) => i.kind === "redirected");
    assert.ok(issue, "expected a redirected issue");
    assert.equal(issue.severity, "suspect");
  });

  it("check layout cannot be done, and says why the rules failed", async () => {
    const report = await runLayoutVerify({
      source: walled,
      contract: { rules: [{ selector: ".card", at: 1280, count: 2 }] },
    });
    assert.equal(report.done, false);
    assert.match(report.redirected ?? "", REDIRECT);
  });

  it("verify flow cannot be done, and says why the steps failed", async () => {
    const dir = mkdtempSync(join(tmpdir(), "auth-wall-flow-"));
    writeFileSync(join(dir, "flow.json"), "{}");
    const report = await runFlowVerify({
      source: walled,
      flow: { steps: [{ label: "open", do: { action: "click", selector: ".card" } }] },
    });
    assert.equal(report.done, false);
    assert.match(report.redirected ?? "", REDIRECT);
  });

  it("the hint points at --storage-state, which the tool actually has", async () => {
    // It used to end "vlmkit cannot inject a session", which stopped being true
    // the day --storage-state landed. A hint that denies a shipped feature sends
    // the reader to the wrong fix.
    const report = await runScrollScan({ source: walled });
    const issue = report.issues.find((i) => i.kind === "redirected")!;
    assert.match(issue.message, /--storage-state/);
    assert.doesNotMatch(issue.message, /cannot inject a session/);
  });
});
