import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";

let tmp: string;
let manifestPath: string;

const CLI_PATH = new URL("./cli/vlmkit.ts", import.meta.url).pathname;

function cli(...argv: string[]): { stdout: string; stderr: string; status: number } {
  const result = spawnSync(
    "node",
    ["--experimental-strip-types", CLI_PATH, "manifest", ...argv],
    { encoding: "utf-8" },
  );
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    status: result.status ?? 0,
  };
}

describe("vrt manifest CLI", () => {
  before(async () => {
    tmp = await mkdtemp(join(tmpdir(), "vrt-manifest-test-"));
    manifestPath = join(tmp, "approval.json");
  });

  after(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  it("add: creates the manifest with the rule", async () => {
    const r = cli("add", "--selector", ".marquee", "--reason", "animated content", "--path", manifestPath);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /added rule/);
    const raw = JSON.parse(await readFile(manifestPath, "utf-8"));
    assert.equal(raw.rules.length, 1);
    assert.equal(raw.rules[0].selector, ".marquee");
    assert.equal(raw.rules[0].reason, "animated content");
  });

  it("add: encodes tolerance flags into the rule.tolerance object", async () => {
    const r = cli(
      "add", "--selector", ".hero__body",
      "--max-px", "2", "--max-ratio", "0.01",
      "--reason", "AA artifact", "--expires", "2026-09-01",
      "--path", manifestPath,
    );
    assert.equal(r.status, 0);
    const raw = JSON.parse(await readFile(manifestPath, "utf-8"));
    const rule = raw.rules.find((r: { selector: string }) => r.selector === ".hero__body");
    assert.ok(rule, "rule should be present");
    assert.equal(rule.tolerance.pixels, 2);
    assert.equal(rule.tolerance.ratio, 0.01);
    assert.equal(rule.expires, "2026-09-01");
  });

  it("add: refuses a rule with no matcher", () => {
    const r = cli("add", "--reason", "would approve everything", "--path", manifestPath);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /at least one matcher/i);
  });

  it("add: refuses without --reason", () => {
    const r = cli("add", "--selector", ".x", "--path", manifestPath);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /--reason is required/);
  });

  it("add --dry-run: does not write", async () => {
    const before = await readFile(manifestPath, "utf-8");
    const r = cli("add", "--selector", ".dry", "--reason", "noop", "--dry-run", "--path", manifestPath);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /dry-run/);
    const after = await readFile(manifestPath, "utf-8");
    assert.equal(after, before);
  });

  it("rm: removes by selector", async () => {
    const r = cli("rm", ".marquee", "--path", manifestPath);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /removed/);
    const raw = JSON.parse(await readFile(manifestPath, "utf-8"));
    assert.ok(!raw.rules.find((rule: { selector: string }) => rule.selector === ".marquee"));
  });

  it("rm: tolerates --path before the positional argument", async () => {
    cli("add", "--selector", ".x", "--reason", "test-only", "--path", manifestPath);
    const r = cli("rm", "--path", manifestPath, ".x");
    assert.equal(r.status, 0);
    const raw = JSON.parse(await readFile(manifestPath, "utf-8"));
    assert.ok(!raw.rules.find((rule: { selector: string }) => rule.selector === ".x"));
  });

  it("rm: errors on missing target", () => {
    const r = cli("rm", "--path", manifestPath);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /pass an index or selector/);
  });

  it("check: exits 0 when nothing is expired", () => {
    const r = cli("check", "--path", manifestPath);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /healthy/);
  });

  it("check: exits 1 when a rule has expired", async () => {
    // Seed an already-expired rule into a fresh manifest so we don't
    // depend on previous tests' state.
    const expiredPath = join(tmp, "expired.json");
    await writeFile(expiredPath, JSON.stringify({
      rules: [{ selector: ".legacy", reason: "stale", expires: "2020-01-01" }],
    }, null, 2));
    const r = cli("check", "--path", expiredPath);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /EXPIRED/);
    assert.match(r.stdout, /\.legacy/);
  });

  it("list: includes status, matcher, reason, and expires", () => {
    const r = cli("list", "--path", manifestPath);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /Approval manifest/);
    assert.match(r.stdout, /\.hero__body/);
  });

  it("list: graceful when the file does not exist", () => {
    const r = cli("list", "--path", join(tmp, "nonexistent.json"));
    assert.equal(r.status, 0);
    assert.match(r.stdout, /No manifest at/);
  });

  it("help: shows usage when no subcommand given", () => {
    const r = cli();
    assert.equal(r.status, 0);
    assert.match(r.stdout, /vlmkit manifest <command>/);
  });

  it("unknown subcommand: exits non-zero with usage", () => {
    const r = cli("frobnicate");
    assert.equal(r.status, 1);
    assert.match(r.stderr, /Unknown manifest subcommand/);
  });
});

const FAKE_REPORT = {
  wireframeFixSuggestions: [
    {
      variantFile: "v.html",
      suggestions: [
        {
          evidence: "component rank=0: Δtop +1px on mobile",
          suggestion: "...",
          viewports: ["mobile"],
          confidence: "low",
          deltaPx: 1,
          scope: "subset",
          candidates: [
            { selector: ".hero__body", property: "padding-top",
              baselineValue: "24px", variantValue: "25px", viewport: "mobile" },
          ],
        },
        {
          evidence: "component rank=1: Δtop +24px on desktop",
          suggestion: "...",
          viewports: ["desktop"],
          confidence: "high",
          deltaPx: 24,
          scope: "subset",
          candidates: [
            { selector: ".profile", property: "margin-top",
              baselineValue: "0px", variantValue: "24px", viewport: "desktop" },
          ],
        },
        {
          evidence: "component rank=2: Δtop +1px on mobile (no DP candidate)",
          suggestion: "...",
          viewports: ["mobile"],
          confidence: "low",
          deltaPx: 1,
          scope: "subset",
          candidates: [],
        },
      ],
    },
  ],
};

describe("vrt manifest add --from-run", () => {
  let runDir: string;
  let manifestPathFromRun: string;

  before(async () => {
    runDir = await mkdtemp(join(tmpdir(), "vrt-manifest-fromrun-"));
    await writeFile(join(runDir, "migration-report.json"), JSON.stringify(FAKE_REPORT, null, 2));
    manifestPathFromRun = join(runDir, "manifest.json");
  });

  after(async () => {
    await rm(runDir, { recursive: true, force: true });
  });

  it("default filter (low ∧ |Δ|≤2) auto-acknowledges sub-pixel suggestions with candidates", async () => {
    const r = cli("add", "--from-run", runDir, "--reason", "AA jitter",
      "--expires", "2026-08-15", "--path", manifestPathFromRun);
    assert.equal(r.status, 0);
    const m = JSON.parse(await readFile(manifestPathFromRun, "utf-8"));
    // suggestion 1: low + 1px + has candidate → added
    // suggestion 2: high + 24px → filtered out by default
    // suggestion 3: low + 1px + no candidate → skipped
    assert.equal(m.rules.length, 1);
    assert.equal(m.rules[0].selector, ".hero__body");
    assert.equal(m.rules[0].property, "padding-top");
    assert.equal(m.rules[0].tolerance.pixels, 2);
    assert.equal(m.rules[0].expires, "2026-08-15");
    assert.match(m.rules[0].reason, /AA jitter/);
    assert.match(r.stdout, /Skipped 1/);
  });

  it("--top N broadens to the first N suggestions regardless of confidence", async () => {
    const fresh = join(runDir, "top.json");
    const r = cli("add", "--from-run", runDir, "--top", "2",
      "--reason", "acknowledged", "--path", fresh);
    assert.equal(r.status, 0);
    const m = JSON.parse(await readFile(fresh, "utf-8"));
    assert.equal(m.rules.length, 2);
    assert.ok(m.rules.find((r: { selector: string }) => r.selector === ".profile"));
  });

  it("--dry-run does not write the manifest", async () => {
    const fresh = join(runDir, "dry.json");
    const r = cli("add", "--from-run", runDir, "--top", "1", "--dry-run",
      "--reason", "noop", "--path", fresh);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /dry-run/);
    assert.throws(() => readFileSyncOrEmpty(fresh));
  });

  it("errors when migration-report.json is missing", () => {
    const r = cli("add", "--from-run", "/nonexistent/path",
      "--path", manifestPathFromRun);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /no migration-report\.json/);
  });
});

function readFileSyncOrEmpty(path: string): string {
  return require("node:fs").readFileSync(path, "utf-8");
}
