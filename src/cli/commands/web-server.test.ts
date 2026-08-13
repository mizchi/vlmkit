import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type GateWebServer, parseGateConfig, shouldReuseExistingServer } from "@mizchi/vlmkit-core/gate-config.ts";
import { formatWebServerPlan, startWebServer, withWebServer } from "./web-server.ts";

const plain = (s: string) => s.replace(/\[[0-9;]*m/g, "");
const json = (value: unknown) => JSON.stringify(value);

const config = (webServer: unknown) =>
  parseGateConfig(json({ webServer, defaults: { gates: ["check integrity"] }, pages: [{ source: "a.html" }] }));

/**
 * A real server, because the whole point of `webServer` is that the readiness
 * probe and the teardown work against a process. `python3 -m http.server` is
 * already required by other suites here and boots in well under a second.
 */
const server = (port: number, over: Partial<GateWebServer> = {}): GateWebServer => {
  const dir = mkdtempSync(join(tmpdir(), "vlmkit-webserver-"));
  writeFileSync(join(dir, "index.html"), "<!doctype html><title>t</title><p>ok");
  return {
    command: `python3 -m http.server ${port}`,
    url: `http://127.0.0.1:${port}/index.html`,
    timeout: 20_000,
    reuseExistingServer: false,
    cwd: dir,
    ...over,
  };
};

const responds = async (url: string): Promise<boolean> => {
  try {
    await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(1500) });
    return true;
  } catch {
    return false;
  }
};

describe("parsing webServer", () => {
  // v6's adopting agent routed around the absence with a HAR recording and named
  // the cost: without that idea you hand-write start / trap kill / poll-for-ready
  // in a shell wrapper, per CI job. Playwright has had this for years.
  it("accepts the Playwright-shaped block", () => {
    const parsed = config({
      command: "npm run dev",
      url: "http://localhost:5173/",
      timeout: 30000,
      reuseExistingServer: false,
      cwd: "app",
      env: { NODE_ENV: "test" },
    });
    assert.deepEqual(parsed.webServer, {
      command: "npm run dev",
      url: "http://localhost:5173/",
      timeout: 30000,
      reuseExistingServer: false,
      cwd: "app",
      env: { NODE_ENV: "test" },
    });
  });

  it("requires url, so \"started\" cannot come to mean \"spawned\"", () => {
    // Without a readiness probe the first gate races the bundler, and a flake
    // there is indistinguishable from a real finding.
    assert.throws(() => config({ command: "npm run dev" }), /url is required/);
    assert.throws(() => config({ command: "npm run dev", url: "localhost:5173" }), /must be http\(s\)/);
  });

  it("requires a command", () => {
    assert.throws(() => config({ url: "http://localhost:5173/" }), /command is required/);
    assert.throws(() => config({ command: "  ", url: "http://localhost:5173/" }), /command is required/);
  });

  it("names the JSON path for a bad field, like every other config defect", () => {
    assert.throws(() => config({ command: "x", url: "http://a/", timeout: -1 }), /timeout must be a positive number/);
    assert.throws(() => config({ command: "x", url: "http://a/", env: { PORT: 3000 } }), /webServer\.env\["PORT"\]/);
    assert.throws(() => config({ command: "x", url: "http://a/", reuseExistingServer: "yes" }), /must be a boolean/);
  });

  it("leaves the field absent when it is not declared", () => {
    assert.equal(parseGateConfig(json({ defaults: { gates: ["check integrity"] }, pages: [{ source: "a.html" }] })).webServer, undefined);
  });
});

describe("shouldReuseExistingServer", () => {
  const base: GateWebServer = { command: "x", url: "http://localhost:1/" };

  it("reuses locally and refuses to in CI, as Playwright's does", () => {
    // Locally the listening port is your own `npm run dev`; in CI it is usually a
    // leaked process from an earlier job, and reusing it gates the wrong build.
    assert.equal(shouldReuseExistingServer(base, {}), true);
    assert.equal(shouldReuseExistingServer(base, { CI: "true" }), false);
  });

  it("lets the config override either way", () => {
    assert.equal(shouldReuseExistingServer({ ...base, reuseExistingServer: false }, {}), false);
    assert.equal(shouldReuseExistingServer({ ...base, reuseExistingServer: true }, { CI: "true" }), true);
  });
});

describe("formatWebServerPlan", () => {
  it("says on `gates list` that a run would start a server", () => {
    const text = plain(formatWebServerPlan({ command: "npm run dev", url: "http://localhost:5173/", reuseExistingServer: false }));
    assert.match(text, /npm run dev/);
    assert.match(text, /http:\/\/localhost:5173\//);
    assert.match(text, /always starts its own/);
    assert.match(text, /timeout 60000ms/);
  });

  it("says when it would adopt a running server instead", () => {
    const text = plain(formatWebServerPlan({ command: "npm run dev", url: "http://localhost:5173/", reuseExistingServer: true }));
    assert.match(text, /reuses a running server/);
  });
});

describe("withWebServer", () => {
  it("has the server serving inside the body and stopped after it", async () => {
    const spec = server(4491);
    let servedDuringBody = false;
    await withWebServer(spec, spec.cwd!, async () => {
      servedDuringBody = await responds(spec.url);
    }, () => {});
    assert.equal(servedDuringBody, true, "the body should run against a serving URL");
    assert.equal(await responds(spec.url), false, "the server should be stopped afterwards");
  });

  it("stops the server when the body throws — a leak would poison the next run", async () => {
    // Worse than the missing feature was: a leaked server is adopted by the next
    // run through reuseExistingServer, silently gating a stale build.
    const spec = server(4492);
    await assert.rejects(
      withWebServer(spec, spec.cwd!, async () => { throw new Error("gate blew up"); }, () => {}),
      /gate blew up/,
    );
    assert.equal(await responds(spec.url), false);
  });

  it("adopts a server that is already listening, and leaves it running", async () => {
    const spec = server(4493);
    const mine = await startWebServer(spec, spec.cwd!, () => {});
    try {
      const adopted = server(4493, { reuseExistingServer: true, cwd: spec.cwd });
      let reused = false;
      await withWebServer(adopted, adopted.cwd!, async () => {
        reused = await responds(adopted.url);
      }, () => {});
      assert.equal(reused, true);
      // It did not start this one, so it must not stop it.
      assert.equal(await responds(spec.url), true);
    } finally {
      await mine.stop();
    }
  });

  it("blames the command, not the timeout, when the server dies before serving", async () => {
    const spec: GateWebServer = {
      command: "exit 3",
      url: "http://127.0.0.1:4494/nothing",
      timeout: 20_000,
      reuseExistingServer: false,
    };
    await assert.rejects(
      withWebServer(spec, tmpdir(), async () => "unreached", () => {}),
      /exited with code 3 before .* responded/,
    );
  });

  it("times out with advice, and takes the process down with it", async () => {
    const spec: GateWebServer = {
      command: "sleep 30",
      url: "http://127.0.0.1:4495/nothing",
      timeout: 1_000,
      reuseExistingServer: false,
    };
    await assert.rejects(
      withWebServer(spec, tmpdir(), async () => "unreached", () => {}),
      /did not serve .* within 1000ms/,
    );
  });

  it("runs the body untouched when no webServer is declared", async () => {
    assert.equal(await withWebServer(undefined, tmpdir(), async () => "ran"), "ran");
  });
});
