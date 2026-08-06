/**
 * The third-party plugin path, end to end through the real CLI.
 *
 * `gate-registry.test.ts` covers composition in-process and
 * `plugin.test.ts` covers loading with an injected importer. Neither proves
 * the thing a plugin author actually cares about: that pointing
 * `vlmkit.config.json` at a module makes `vlmkit <group> <leaf>` work, with
 * the same `--json` envelope, exit code, rule tuning and ledger entry a
 * bundled gate gets.
 *
 * That claim was verified by hand while building the feature, which is exactly
 * the kind of verification that stops being true six months later. So it
 * spawns the CLI against `examples/gate-plugin/house-gates.ts` — the example
 * the docs point readers at, which also means a broken example fails a test
 * instead of a reader's first attempt.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CLI = fileURLToPath(new URL("./vlmkit.ts", import.meta.url));
const REPO_ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const PLUGIN = join(REPO_ROOT, "examples/gate-plugin/house-gates.ts");

/**
 * A project that declares the example plugin. The plugin path is absolute so
 * the fixture does not depend on its own depth relative to the repo, but the
 * *resolution* being relative-to-the-config is covered in `plugin.test.ts`.
 */
function project(css: string): string {
  const dir = mkdtempSync(join(tmpdir(), "vlmkit-plugin-e2e-"));
  writeFileSync(join(dir, "vlmkit.config.json"), JSON.stringify({ plugins: [PLUGIN] }, null, 2));
  writeFileSync(join(dir, "page.html"), `<!doctype html><meta charset="utf-8"><style>${css}</style><h1>hi</h1>`);
  return dir;
}

const plain = (s: string): string => s.replace(/\x1b\[[0-9;]*m/g, "");

function run(cwd: string, args: string[]): { stdout: string; stderr: string; status: number | null } {
  const r = spawnSync(process.execPath, ["--experimental-strip-types", CLI, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });
  return { stdout: plain(r.stdout ?? ""), stderr: plain(r.stderr ?? ""), status: r.status };
}

const OFF_BRAND = 'body { font-family: "Comic Sans MS", Inter, sans-serif; }';
const ON_BRAND = "body { font-family: Inter, sans-serif; }";

describe("a project-declared plugin gate", { timeout: 120_000 }, () => {
  it("appears in `vlmkit rules` with its plugin name", () => {
    const { stdout, status } = run(project(ON_BRAND), ["rules"]);
    assert.equal(status, 0);
    assert.match(stdout, /check house-brand\s+2 rule\(s\)\s+check\.house-brand\s+\[house-gates\]/);
  });

  it("lists its rules under `vlmkit rules <gate>`", () => {
    const { stdout, status } = run(project(ON_BRAND), ["rules", "check", "house-brand"]);
    assert.equal(status, 0);
    assert.match(stdout, /forbidden-font/);
    assert.match(stdout, /important-overuse/);
    assert.match(stdout, /--rule check\.house-brand\/<id>=/);
  });

  it("appears in the group help it belongs to", () => {
    const { stdout } = run(project(ON_BRAND), ["check", "--help"]);
    assert.match(stdout, /house-brand\s+Font allowlist/);
  });

  it("dispatches as a command and exits 1 on a suspect", () => {
    const { stdout, status } = run(project(OFF_BRAND), ["check", "house-brand", "page.html"]);
    assert.equal(status, 1);
    assert.match(stdout, /Comic Sans MS/);
  });

  it("exits 0 when the page conforms", () => {
    const { status } = run(project(ON_BRAND), ["check", "house-brand", "page.html"]);
    assert.equal(status, 0);
  });

  it("gets the shared --json envelope, not a plugin-specific shape", () => {
    const { stdout } = run(project(OFF_BRAND), ["check", "house-brand", "page.html", "--json"]);
    const parsed = JSON.parse(stdout) as Record<string, unknown>;
    assert.deepEqual(Object.keys(parsed), [
      "gate",
      "command",
      "verdict",
      "counts",
      "findings",
      "suppressed",
      "retuned",
      "report",
    ]);
    assert.equal(parsed.gate, "check.house-brand");
    assert.equal(parsed.verdict, "fail");
    assert.deepEqual(parsed.counts, { suspect: 1, warn: 0, info: 0 });
  });

  it("gets --advisory: verdict stands, exit code drops", () => {
    const { stdout, status } = run(project(OFF_BRAND), ["check", "house-brand", "page.html", "--json", "--advisory"]);
    assert.equal(status, 0);
    assert.equal((JSON.parse(stdout) as { verdict: string }).verdict, "fail");
  });

  it("gets rule tuning, and reports what was suppressed", () => {
    const { stdout, status } = run(project(OFF_BRAND), [
      "check", "house-brand", "page.html",
      "--rule", "check.house-brand/forbidden-font=off",
    ]);
    assert.equal(status, 0);
    assert.match(stdout, /1 finding\(s\) suppressed by rule settings/);
    assert.match(stdout, /forbidden-font x1/);
  });

  it("rejects a misspelled --rule against the plugin's own rule table", () => {
    // The check is the runner's; the table is the plugin's. Before this test
    // existed the reference simply matched nothing, which is the failure mode
    // rule settings are supposed to remove.
    const { stderr, status } = run(project(OFF_BRAND), [
      "check", "house-brand", "page.html",
      "--rule", "check.house-brand/forbidden-fnt=off",
    ]);
    assert.equal(status, 1);
    assert.match(stderr, /--rule check\.house-brand\/forbidden-fnt: check\.house-brand has no rule "forbidden-fnt"/);
    assert.match(stderr, /Known: forbidden-font, important-overuse/);
  });

  it("takes its own repeatable flag through the gate's parser", () => {
    // `--font` is repeatable and REPLACES the allowlist, so naming every font
    // the page declares passes and naming a subset does not. Asserting both
    // directions is what proves the repeated occurrences arrived — a single
    // `--font a,b` (the comma-joined shape) would fail the first case.
    const full = run(project(OFF_BRAND), [
      "check", "house-brand", "page.html",
      "--font", "Comic Sans MS", "--font", "Inter", "--font", "sans-serif",
    ]);
    assert.equal(full.status, 0, full.stdout);
    const partial = run(project(OFF_BRAND), [
      "check", "house-brand", "page.html", "--font", "Comic Sans MS",
    ]);
    assert.equal(partial.status, 1);
    assert.match(partial.stdout, /allowlist: Comic Sans MS$/m);
  });

  it("surfaces its own usage error as one line", () => {
    const { stderr, status } = run(project(ON_BRAND), ["check", "house-brand"]);
    assert.equal(status, 1);
    assert.match(stderr, /^error: missing required argument/);
  });

  it("writes a run-ledger entry like any bundled gate", () => {
    const dir = project(OFF_BRAND);
    run(dir, ["check", "house-brand", "page.html"]);
    const ledger = join(dir, ".vlmkit", "run-ledger.jsonl");
    assert.ok(existsSync(ledger), "plugin gate wrote no ledger entry");
    const entry = JSON.parse(readFileSync(ledger, "utf-8").trim().split("\n").at(-1)!) as Record<string, unknown>;
    assert.equal(entry.tool, "check-house-brand");
    assert.deepEqual(entry.headline, { offenders: 1, important: 0 });
  });

  it("is validated by `vlmkit gates` like a bundled gate", () => {
    const dir = project(OFF_BRAND);
    writeFileSync(
      join(dir, "vlmkit.gates.json"),
      JSON.stringify({
        defaults: { gates: ["check house-brand"], rules: { "check.house-brand/forbidden-font": "warn" } },
        pages: [{ source: "page.html" }],
      }),
    );
    const listed = run(dir, ["gates", "list"]);
    assert.equal(listed.status, 0);
    assert.match(listed.stdout, /check house-brand --rule check\.house-brand\/forbidden-font=warn/);
  });

  it("has its rule references checked against the plugin's table", () => {
    const dir = project(OFF_BRAND);
    writeFileSync(
      join(dir, "vlmkit.gates.json"),
      JSON.stringify({
        defaults: { gates: ["check house-brand"], rules: { "check.house-brand/no-such-rule": "off" } },
        pages: [{ source: "page.html" }],
      }),
    );
    const { stderr, status } = run(dir, ["gates", "list"]);
    assert.equal(status, 1);
    assert.match(stderr, /has no rule "no-such-rule"/);
    assert.match(stderr, /known: forbidden-font, important-overuse/);
  });

  it("does not load when the config declares no plugins", () => {
    const dir = mkdtempSync(join(tmpdir(), "vlmkit-plugin-e2e-bare-"));
    writeFileSync(join(dir, "page.html"), "<!doctype html><h1>hi</h1>");
    const { stderr, status } = run(dir, ["check", "house-brand", "page.html"]);
    assert.equal(status, 1);
    assert.match(stderr, /Unknown check subcommand: house-brand/);
  });

  it("reports a plugin that cannot be imported, naming the specifier", () => {
    const dir = mkdtempSync(join(tmpdir(), "vlmkit-plugin-e2e-bad-"));
    writeFileSync(join(dir, "vlmkit.config.json"), JSON.stringify({ plugins: ["./missing-plugin.ts"] }));
    const { stderr, status } = run(dir, ["rules"]);
    assert.notEqual(status, 0);
    assert.match(stderr, /failed to load gate plugin "\.\/missing-plugin\.ts"/);
  });
});
