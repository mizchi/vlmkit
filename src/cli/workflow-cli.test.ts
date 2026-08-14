import assert from "node:assert/strict";
import { afterAll, afterEach, beforeAll, describe, it, vi } from "vitest";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { UnifiedAgentContext } from "@mizchi/vlmkit-core/types.ts";

/**
 * `vlmkit workflow` against a fixture project root.
 *
 * Two things had to change before this file could exist, and both are recorded in
 * `workflow.ts`: ten `process.exit()` calls (which in a vitest worker end the file,
 * not the assertion) and a `runWorkflowCli` that returned `Promise<void>` while
 * actually deciding the process's fate.
 *
 * What is still NOT tested here: `init` and `capture`, which shell out to
 * `npx playwright test`. Spawning a browser suite from a unit test is the wrong
 * trade; their argument parsing is covered instead.
 *
 * `PROJECT_ROOT` is resolved from `VLMKIT_PROJECT_ROOT` at module load, so each
 * case sets the env var and re-imports through `vi.resetModules()`. That is the
 * cost of module-level path constants — worth naming rather than working around
 * silently.
 */

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
