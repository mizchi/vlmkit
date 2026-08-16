import assert from "node:assert/strict";
import { afterAll, afterEach, beforeAll, describe, it, vi } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { UnifiedAgentContext } from "@mizchi/vlmkit-core/types.ts";

/**
 * `vlmkit workflow` against a fixture project root.
 *
 * Two things had to change before this file could exist, and both are recorded in
 * `workflow.ts`: ten `process.exit()` calls (which in a vitest worker end the file,
 * not the assertion) and a `runWorkflowCli` that returned `Promise<void>` while
 * actually deciding the process's fate.
 *
 * What is still NOT tested here: a *successful* `init` / `capture`, which shells out to
 * `npx playwright test`. Spawning a browser suite from a unit test is the wrong trade.
 *
 * "Their argument parsing is covered instead" is what this said, and it was not enough —
 * both commands were dead for every invocation and the argument tests stayed green
 * throughout. Everything about them that does NOT need a browser is covered now, in
 * `capture preflight` below: the spec-path literals, playwright's `testDir`, the config
 * error paths, and the `VLMKIT_CAPTURE_ROUTES` wiring.
 *
 * `PROJECT_ROOT` is resolved from `VLMKIT_PROJECT_ROOT` at module load, so each
 * case sets the env var and re-imports through `vi.resetModules()`. That is the
 * cost of module-level path constants — worth naming rather than working around
 * silently.
 */

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), "..", "..", "..");
const root = mkdtempSync(join(tmpdir(), "vlmkit-workflow-"));

let lines: string[] = [];
const realLog = console.log;
const realError = console.error;
beforeAll(() => {
  console.log = (...a: unknown[]) => { lines.push(a.map(String).join(" ")); };
  console.error = (...a: unknown[]) => { lines.push(a.map(String).join(" ")); };
});
afterAll(() => { console.log = realLog; console.error = realError; });
afterEach(() => { delete process.env.VLMKIT_PROJECT_ROOT; });

const output = () => lines.join("\n").replace(/\[[0-9;]*m/g, "");

/** Fresh module graph, so `PROJECT_ROOT` picks up `projectRoot`. */
async function loadCli(projectRoot: string) {
  process.env.VLMKIT_PROJECT_ROOT = projectRoot;
  vi.resetModules();
  lines = [];
  const mod = await import("./workflow.ts");
  return mod.runWorkflowCli;
}

describe("runWorkflowCli", () => {
  it("prints usage for no command, help, --help and -h — all exit 0", async () => {
    for (const argv of [[], ["help"], ["--help"], ["-h"]]) {
      const run = await loadCli(root);
      assert.equal(await run(argv), 0, `${JSON.stringify(argv)} should exit 0`);
      const text = output();
      assert.match(text, /vlmkit workflow <command>/);
      // Every command in the table has to appear, or the usage is a trap.
      for (const cmd of ["init", "capture", "verify", "approve", "report", "graph", "affected", "introspect", "spec-verify", "expect"]) {
        assert.ok(text.includes(cmd), `usage omits ${cmd}`);
      }
    }
  });

  it("exits 1 on an unknown command and shows usage on stderr", async () => {
    const run = await loadCli(root);
    assert.equal(await run(["frobnicate"]), 1);
    assert.match(output(), /Unknown workflow command: frobnicate/);
    assert.match(output(), /vlmkit workflow <command>/, "the usage follows the error, not just the error");
  });

  it("exits 1 when approve has no snapshots to promote", async () => {
    // An empty project root: no snapshots/ directory at all.
    const empty = mkdtempSync(join(tmpdir(), "vlmkit-wf-empty-"));
    const run = await loadCli(empty);
    assert.equal(await run(["approve"]), 1);
    assert.match(output(), /No snapshots found/);
  });

  it("promotes snapshots to baselines and counts what it copied", async () => {
    const project = mkdtempSync(join(tmpdir(), "vlmkit-wf-approve-"));
    mkdirSync(join(project, "snapshots"), { recursive: true });
    // Minimal 1x1 PNG bytes; `approve` copies files and counts `.png`, it does not
    // decode them.
    const png = Buffer.from(
      "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6300010000050001"
      + "0d0a2db40000000049454e44ae426082", "hex",
    );
    writeFileSync(join(project, "snapshots", "home.png"), png);
    writeFileSync(join(project, "snapshots", "about.png"), png);
    writeFileSync(join(project, "snapshots", "home.a11y.json"), "{}");

    const run = await loadCli(project);
    assert.equal(await run(["approve"]), 0);
    assert.match(output(), /Baselines updated: 2 screenshots/);
    // The a11y tree travelled with them: approve copies the directory, and a
    // baseline without its a11y snapshot makes the next verify a false pass.
    const { existsSync } = await import("node:fs");
    assert.ok(existsSync(join(project, "baselines", "home.a11y.json")));
  });

  it("exits 1 when report has no report to show", async () => {
    const empty = mkdtempSync(join(tmpdir(), "vlmkit-wf-noreport-"));
    const run = await loadCli(empty);
    assert.equal(await run(["report"]), 1);
    assert.match(output(), /No report found/);
  });

  it("renders a report from the context on disk", async () => {
    const project = mkdtempSync(join(tmpdir(), "vlmkit-wf-report-"));
    const ctx: UnifiedAgentContext = {
      intent: { summary: "restyle the header", changeType: "visual-only", confidence: 0.9, evidence: [] },
      crossValidations: [
        { testId: "home", recommendation: "review", reasoning: "header moved 12px", visualChanged: true, a11yChanged: false, agreement: "visual-only" },
      ],
      qualityChecks: [
        { check: "contrast", passed: false, severity: "warning", details: "3.9:1 on .subtitle" },
        { check: "focus-order", passed: true, severity: "info", details: "unchanged" },
      ],
      verdicts: [
        { snapshotId: "home", decision: "approve", reasoning: "matches the intent", confidence: 0.82 },
      ],
    } as unknown as UnifiedAgentContext;
    writeFileSync(join(project, "vrt-report.json"), JSON.stringify(ctx));

    const run = await loadCli(project);
    assert.equal(await run(["report"]), 0);
    const text = output();
    assert.match(text, /VRT \+ Semantic Verification Report/);
    assert.match(text, /restyle the header \(visual-only\)/);
    assert.match(text, /\[REVIEW\] home/);
    assert.match(text, /header moved 12px/);
    // Only the failing quality check is listed; a passing one is not an issue.
    assert.match(text, /\[warning\] contrast: 3\.9:1 on \.subtitle/);
    assert.doesNotMatch(text, /focus-order/);
    assert.match(text, /\[APPROVE\] home/);
    assert.match(text, /confidence: 82%/);
  });

  it("rejects an unknown flag rather than ignoring it", async () => {
    // A silently-dropped flag is worse than an error: the run looks like it honoured
    // a --base-url it never read.
    const run = await loadCli(root);
    await assert.rejects(() => run(["capture", "--base-yrl", "http://x"]), /Unknown workflow option: --base-yrl/);
  });

  it("rejects a value-taking flag with no value", async () => {
    const run = await loadCli(root);
    await assert.rejects(() => run(["capture", "--config"]), /Missing value for --config/);
    const run2 = await loadCli(root);
    await assert.rejects(() => run2(["init", "--base-url"]), /Missing value for --base-url/);
  });
});

/**
 * The half of `init` / `capture` that needs no browser.
 *
 * Both commands were dead for a long time — every invocation failed — and stayed dead because
 * the only thing testing them was argument parsing. Four defects: a wrong spec filename
 * (`vrt-capture.spec.*`, a name nothing has had since the rename), a candidate order preferring
 * `dist/e2e/**` which sits outside playwright's `testDir`, a cwd of the user's project so
 * neither the config nor `@playwright/test` resolved, and a `catch (e)` that discarded `e` and
 * printed "Is the server running?" for all of it.
 *
 * **All four were consequences of capture being a spawned test file.** It is a function now
 * (`@mizchi/vlmkit-capture/route-capture.ts`), so there is no filename to get wrong, no
 * `testDir` to fall outside of, no cwd to resolve a config from and no subprocess exit string to
 * misread. The tests that pinned those four are gone with the mechanism; what replaces them is
 * the assertion that the mechanism has not come back.
 */
describe("capture preflight (no browser)", () => {
  it("nothing spawns a playwright test run any more", () => {
    // The retirement, as an assertion. `dist/e2e` packaging was an open question for months
    // *because* capture was a spec file: `package.json` excludes `!dist/e2e/**`, the sources are
    // unpublished, so an installed vlmkit could not run these two commands at all. A regression
    // here would silently restore that, since the source checkout this repo runs in is exactly
    // the environment where a spawned spec still works.
    const source = readFileSync(resolve(REPO_ROOT, "src/cli/workflow.ts"), "utf8");
    assert.doesNotMatch(source, /playwright["']?,?\s*["']test["']/, "no `playwright test` spawn");
    // Code-shaped, not any mention: the docstring in that file explains the retired mechanism
    // on purpose, and a test that forbids naming history forces the explanation out of the file.
    assert.doesNotMatch(source, /join\("e2e"|"e2e\/vlmkit-capture/, "no spec path literal");
    assert.doesNotMatch(source, /execFileSync|execSync|spawnSync/, "capture runs in-process");
    assert.match(source, /captureRoutes\(/, "and it calls the function instead");
  });

  it("the published package carries everything init and capture need", () => {
    // The other half: with no spec file, `files` needs no exclusion for one, and the build needs
    // no entry for one. If either comes back, the command is source-checkout-only again.
    const pkg = JSON.parse(readFileSync(resolve(REPO_ROOT, "package.json"), "utf8")) as
      { files: string[]; scripts: Record<string, string> };
    assert.ok(!pkg.files.some((f) => f.includes("e2e")),
      `files still mentions e2e: ${JSON.stringify(pkg.files)}`);
    const build = readFileSync(resolve(REPO_ROOT, "tsdown.config.ts"), "utf8");
    assert.doesNotMatch(build, /e2e\//, "the build no longer emits a capture spec");
  });

  it("names a bad --config as a config error, not as a missing server", async () => {
    // Measured before the fix: a nonexistent --config, a config containing invalid JSON,
    // malformed VLMKIT_CAPTURE_ROUTES and a correct config with no server ALL printed
    // "Playwright capture failed. Is the server running?" plus a hardcoded
    // http://127.0.0.1:4174 — four causes, one message, and none of them the real one.
    const run = await loadCli(root);
    assert.equal(await run(["capture", "--config", join(root, "nope.json")]), 1);
    const text = output();
    assert.match(text, /Capture config error: Capture config not found:.*nope\.json/);
    assert.doesNotMatch(text, /Is the server running/);
    assert.doesNotMatch(text, /127\.0\.0\.1:4174/, "the port must come from the resolved config, not a literal");
  });

  it("names invalid JSON in the config as invalid JSON", async () => {
    const dir = mkdtempSync(join(tmpdir(), "vlmkit-workflow-badjson-"));
    writeFileSync(join(dir, "broken.json"), "{ this is not json");
    const run = await loadCli(dir);
    assert.equal(await run(["capture", "--config", join(dir, "broken.json")]), 1);
    assert.match(output(), /Capture config error: Invalid capture config JSON/);
  });

  it("reads VLMKIT_CAPTURE_ROUTES, and says so when it outranks a --config", async () => {
    // `buildCaptureEnv` never passed `envRoutes`, so this variable — documented as the
    // highest-precedence route source in `vlmkit workflow --help` and in
    // docs/cli-reference.md — was read by nobody. `capture-config.test.ts` proved the
    // function honoured it by passing it straight in, which is why the missing wiring was
    // invisible: the unit test tested the function, not the feature.
    const dir = mkdtempSync(join(tmpdir(), "vlmkit-workflow-envroutes-"));
    writeFileSync(join(dir, "side.json"), JSON.stringify({ routes: [{ name: "c", path: "/from-config" }] }));
    process.env.VLMKIT_CAPTURE_ROUTES = JSON.stringify([{ name: "e", path: "/from-env" }]);
    try {
      const run = await loadCli(dir);
      await run(["capture", "--config", join(dir, "side.json")]);
      const text = output();
      assert.match(text, /routes from VLMKIT_CAPTURE_ROUTES: \/from-env/);
      // An env var outranking a flag the user typed is the documented precedence, but it
      // must not be silent.
      assert.match(text, /VLMKIT_CAPTURE_ROUTES takes precedence/);
      assert.doesNotMatch(text, /\/from-config/, "the config's routes were not used and must not be reported");
    } finally {
      delete process.env.VLMKIT_CAPTURE_ROUTES;
    }
  });
});
