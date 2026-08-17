/**
 * `captureRoutes` — the function that replaced `e2e/vlmkit-capture.spec.ts`.
 *
 * The spec it replaces had no test of its own, and that is most of why it stayed broken for so
 * long: `workflow init` / `workflow capture` were covered by argument-parsing tests, so a wrong
 * filename, a cwd that resolved the wrong `@playwright/test`, and a `catch` that discarded the
 * error all shipped. None of those failure modes exists for a function — but the capture itself
 * still needs a browser, so the interesting half is exercised here against a real server rather
 * than asserted about from the outside.
 *
 * `node:http` rather than a fixture directory: the cases worth pinning are a 404, an empty body
 * and a route that never resolves, and those are properties of a SERVER, not of a file.
 */
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { mkdtempSync, readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, it } from "vitest";
import { captureRoutes, cdpNodesToTree } from "./route-capture.ts";

const dir = mkdtempSync(join(tmpdir(), "vlmkit-route-capture-"));
let server: Server;
let baseUrl: string;

beforeAll(async () => {
  server = createServer((req, res) => {
    const url = req.url ?? "/";
    if (url === "/") {
      res.writeHead(200, { "content-type": "text/html" });
      res.end(`<!doctype html><title>Home</title><main><h1>Home</h1><button>Sign up</button></main>`);
    } else if (url === "/empty") {
      // Served, 200, and renders nothing — the case the spec asserted on with
      // `expect(bodyText.length).toBeGreaterThan(0)` and the callers then swallowed.
      res.writeHead(200, { "content-type": "text/html" });
      res.end(`<!doctype html><title>Empty</title><body></body>`);
    } else {
      res.writeHead(404, { "content-type": "text/html" });
      res.end(`<!doctype html><title>Not found</title><main>404</main>`);
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("captureRoutes", () => {
  it("writes a screenshot and an a11y tree per route", { timeout: 120_000 }, async () => {
    const outputDir = join(dir, "ok");
    const result = await captureRoutes({
      baseUrl,
      routes: [{ name: "home", path: "/", waitFor: "main" }],
      outputDir,
    });
    assert.equal(result.failures.length, 0);
    assert.equal(result.captured.length, 1);
    const entry = result.captured[0]!;
    assert.ok(existsSync(entry.screenshotPath), entry.screenshotPath);
    assert.ok(existsSync(entry.a11yPath), entry.a11yPath);
    assert.equal(entry.screenshotPath, join(outputDir, "home.png"));
    assert.equal(entry.a11yPath, join(outputDir, "home.a11y.json"));
    // One viewport, named. The spec ran under two playwright projects that wrote these same two
    // filenames, so a baseline was nondeterministically 1280x720 or 375x812.
    assert.deepEqual(result.viewport, { width: 1280, height: 720 });
    assert.equal(entry.status, 200);
    assert.ok(entry.textLength > 0);
  });

  it("produces the real CDP tree, not the degraded fallback", { timeout: 120_000 }, async () => {
    // Which source produced the tree is reported because the two are not interchangeable to the
    // commands that diff them: `ariaSnapshot` is a YAML string in one field, and a page that
    // silently degrades to it looks like a page whose whole a11y tree changed.
    const result = await captureRoutes({
      baseUrl, routes: [{ name: "home", path: "/" }], outputDir: join(dir, "cdp"),
    });
    const entry = result.captured[0]!;
    assert.equal(entry.a11ySource, "cdp");
    const tree = JSON.parse(readFileSync(entry.a11yPath, "utf8")) as Record<string, unknown>;
    assert.equal(tree.role, "RootWebArea");
    assert.ok(Array.isArray(tree.children));
    // The heading's `level` is one of the five properties carried over from the spec verbatim;
    // dropping any of them would report every existing baseline as a semantic diff.
    assert.match(JSON.stringify(tree), /"level":\s*1/);
  });

  it("flags a non-2xx capture instead of baselining the error page", { timeout: 120_000 }, async () => {
    // `page.goto` does not throw on 404, so this used to produce a screenshot of the server's
    // error page, an a11y tree of it, and exit 0 — a baseline that then passes forever.
    const result = await captureRoutes({
      baseUrl, routes: [{ name: "admin", path: "/nope" }], outputDir: join(dir, "notok"),
    });
    assert.equal(result.failures.length, 0, "it did capture — the page exists, it is just a 404");
    assert.equal(result.notOk.length, 1);
    assert.equal(result.notOk[0]!.status, 404);
  });

  it("flags a page that renders nothing", { timeout: 120_000 }, async () => {
    const result = await captureRoutes({
      baseUrl, routes: [{ name: "empty", path: "/empty" }], outputDir: join(dir, "blank"),
    });
    assert.equal(result.blank.length, 1);
    assert.equal(result.blank[0]!.textLength, 0);
    assert.equal(result.notOk.length, 0, "200 — the emptiness is the finding, not the status");
  });

  it("records a waitFor that never matched, and captures anyway", { timeout: 120_000 }, async () => {
    const result = await captureRoutes({
      baseUrl,
      routes: [{ name: "home", path: "/", waitFor: "#does-not-exist" }],
      outputDir: join(dir, "waitfor"),
      settleMs: 0,
    });
    assert.equal(result.captured.length, 1, "the screenshot without it is the evidence");
    assert.equal(result.captured[0]!.waitForTimedOut, true);
  });

  it("one unreachable route does not lose the others", { timeout: 120_000 }, async () => {
    // The spec's all-or-nothing subprocess exit is what forced the callers to guess from file
    // counts and print "(some tests had warnings, but captures completed)".
    const result = await captureRoutes({
      baseUrl,
      routes: [
        { name: "home", path: "/" },
        { name: "dead", path: "/" },
        { name: "about", path: "/" },
      ],
      outputDir: join(dir, "partial"),
      settleMs: 0,
    });
    assert.equal(result.captured.length, 3);
    assert.equal(result.failures.length, 0);

    // A port that was listening and is not any more, rather than a literal like `:1` — Chromium
    // refuses its own unsafe-port list before it ever connects, so `:1` tested
    // `ERR_UNSAFE_PORT` and not the case this is about.
    const closed = createServer();
    await new Promise<void>((resolve) => closed.listen(0, "127.0.0.1", resolve));
    const closedAddress = closed.address();
    const closedPort = typeof closedAddress === "object" && closedAddress ? closedAddress.port : 0;
    await new Promise<void>((resolve) => closed.close(() => resolve()));

    const unreachable = await captureRoutes({
      baseUrl: `http://127.0.0.1:${closedPort}`,
      routes: [{ name: "gone", path: "/" }],
      outputDir: join(dir, "unreachable"),
    });
    assert.equal(unreachable.captured.length, 0);
    assert.equal(unreachable.failures.length, 1);
    assert.equal(unreachable.failures[0]!.name, "gone");
    // The real error, unabridged — the line that replaced "Is the server running?".
    assert.match(unreachable.failures[0]!.error, /ERR_CONNECTION_REFUSED|ECONNREFUSED/);
  });
});

describe("cdpNodesToTree", () => {
  const node = (id: string, role: string, name = "", childIds?: string[]) => ({
    nodeId: id, role: { value: role }, name: { value: name }, ...(childIds ? { childIds } : {}),
  });

  it("builds a tree from the flat node list", () => {
    const tree = cdpNodesToTree([
      node("1", "RootWebArea", "Page", ["2"]),
      node("2", "main", "", ["3"]),
      node("3", "heading", "Title"),
    ]) as Record<string, unknown>;
    assert.equal(tree.role, "RootWebArea");
    const main = (tree.children as Record<string, unknown>[])[0]!;
    assert.equal(main.role, "main");
    assert.equal((main.children as Record<string, unknown>[])[0]!.name, "Title");
  });

  it("carries exactly the five properties the old spec carried", () => {
    const tree = cdpNodesToTree([{
      nodeId: "1", role: { value: "checkbox" }, name: { value: "Agree" },
      properties: [
        { name: "checked", value: { value: true } },
        { name: "disabled", value: { value: false } },
        { name: "expanded", value: { value: true } },
        { name: "selected", value: { value: false } },
        { name: "level", value: { value: 2 } },
        // Not carried, deliberately: adding a property here would make every baseline captured
        // by the old path report a semantic diff.
        { name: "focusable", value: { value: true } },
      ],
    }]) as Record<string, unknown>;
    assert.deepEqual(tree, {
      role: "checkbox", name: "Agree", checked: true, disabled: false, expanded: true,
      selected: false, level: 2,
    });
  });

  it("survives a cycle in childIds", () => {
    // The spec had no guard: an id appearing under two parents, or a self-reference, recursed
    // until the stack gave out, and a hung capture is indistinguishable from a slow page.
    const tree = cdpNodesToTree([
      node("1", "RootWebArea", "", ["2"]),
      node("2", "group", "", ["1", "2"]),
    ]) as Record<string, unknown>;
    assert.equal(tree.role, "RootWebArea");
    const group = (tree.children as Record<string, unknown>[])[0]!;
    assert.equal(group.role, "group");
    assert.equal(group.children, undefined, "the cycle back to the root and to itself is cut");
  });

  it("returns an empty document for an empty node list", () => {
    assert.deepEqual(cdpNodesToTree([]), { role: "document", name: "", children: [] });
  });
});
