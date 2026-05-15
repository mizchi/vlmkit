import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { buildMarkdownSummary } from "./diff-pr.ts";
import { parseDiffPrConfig } from "./diff-pr-config.ts";

const CLI_PATH = new URL("./vrt.ts", import.meta.url).pathname;
function cli(cwd: string, ...argv: string[]): { stdout: string; stderr: string; status: number } {
  const r = spawnSync(
    "node",
    ["--experimental-strip-types", CLI_PATH, "diff-pr", ...argv],
    { encoding: "utf-8", cwd },
  );
  return { stdout: r.stdout ?? "", stderr: r.stderr ?? "", status: r.status ?? 0 };
}

const config = parseDiffPrConfig(JSON.stringify({
  baseUrl: "http://localhost:3000",
  thresholds: { mobile: 0.01, desktop: 0.005, wide: 0.005 },
  routes: [
    "/",
    { name: "admin", path: "/admin", thresholds: { mobile: 0.03, desktop: 0.02, wide: 0.02 } },
  ],
}), "/example/vrt.config.json");

describe("buildMarkdownSummary", () => {
  it("declares PASS when every route is within threshold", () => {
    const md = buildMarkdownSummary(config, [
      {
        route: config.routes[0],
        viewports: [
          { viewport: "mobile", diffRatio: 0.001, diffPixels: 5, totalPixels: 5000, threshold: 0.01, pass: true },
        ],
        failed: false,
      },
    ]);
    assert.match(md, /Status: \*\*PASS\*\*/);
    assert.match(md, /✅/);
    assert.doesNotMatch(md, /❌/);
    assert.doesNotMatch(md, /Worst offenders/);
  });

  it("declares FAIL with route count when any route is over threshold", () => {
    const md = buildMarkdownSummary(config, [
      {
        route: config.routes[0],
        viewports: [
          { viewport: "mobile", diffRatio: 0.05, diffPixels: 250, totalPixels: 5000, threshold: 0.01, pass: false },
          { viewport: "desktop", diffRatio: 0.001, diffPixels: 5, totalPixels: 5000, threshold: 0.005, pass: true },
        ],
        failed: true,
      },
      {
        route: config.routes[1],
        viewports: [
          { viewport: "mobile", diffRatio: 0.005, diffPixels: 25, totalPixels: 5000, threshold: 0.03, pass: true },
        ],
        failed: false,
      },
    ]);
    assert.match(md, /Status: \*\*FAIL\*\* \(1 of 2 route\(s\)\)/);
    assert.match(md, /Worst offenders/);
    assert.match(md, /\/ mobile: 5\.00%/);
  });

  it("handles routes with no result (missing baseline) gracefully", () => {
    const md = buildMarkdownSummary(config, [
      {
        route: config.routes[0],
        viewports: [],
        failed: true,
        error: "no baseline at /tmp/.vrt/baselines/home",
      },
    ]);
    assert.match(md, /no baseline at/);
    assert.match(md, /Status: \*\*FAIL\*\*/);
  });

  it("ranks worst offenders by (diff - threshold) overage", () => {
    const md = buildMarkdownSummary(config, [
      {
        route: config.routes[0],
        viewports: [
          { viewport: "mobile", diffRatio: 0.015, diffPixels: 1, totalPixels: 1, threshold: 0.01, pass: false },
        ],
        failed: true,
      },
      {
        route: config.routes[1],
        viewports: [
          { viewport: "mobile", diffRatio: 0.04, diffPixels: 1, totalPixels: 1, threshold: 0.03, pass: false },
          { viewport: "wide", diffRatio: 0.5, diffPixels: 1, totalPixels: 1, threshold: 0.02, pass: false },
        ],
        failed: true,
      },
    ]);
    // wide is 0.48 over threshold; that should be first.
    const offenderIdx = md.indexOf("## Worst offenders");
    const tail = md.slice(offenderIdx);
    const firstLine = tail.split("\n").find((l) => l.startsWith("- "))!;
    assert.match(firstLine, /admin.*wide.*50\.00%/);
  });
});

describe("vrt diff-pr pin <route>...", () => {
  let cwd: string;

  before(async () => {
    cwd = await mkdtemp(join(tmpdir(), "vrt-diff-pr-pin-"));
    await mkdir(join(cwd, "pages"), { recursive: true });
    await writeFile(
      join(cwd, "pages", "home.html"),
      "<!doctype html><html><body style='margin:0;padding:24px;background:#f9f9ff;font:18px sans-serif'><h1>Home</h1></body></html>",
    );
    await writeFile(
      join(cwd, "pages", "about.html"),
      "<!doctype html><html><body style='margin:0;padding:24px;background:#fff;font:18px sans-serif'><h1>About</h1></body></html>",
    );
    const cfg = {
      thresholds: { mobile: 0.005, desktop: 0.002, wide: 0.002 },
      baselineDir: ".vrt/baselines",
      routes: [
        { name: "home", url: `file://${join(cwd, "pages", "home.html")}` },
        { name: "about", url: `file://${join(cwd, "pages", "about.html")}` },
      ],
    };
    await writeFile(join(cwd, "vrt.config.json"), JSON.stringify(cfg, null, 2));
    // Seed both baselines.
    const r = cli(cwd, "pin");
    assert.equal(r.status, 0, `seed pin failed: ${r.stderr}`);
  });

  after(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  it("with no positional args refreshes every route (sanity baseline)", async () => {
    const before = await readFile(join(cwd, ".vrt/baselines/about/mobile.png"));
    const r = cli(cwd, "pin");
    assert.equal(r.status, 0);
    const after = await readFile(join(cwd, ".vrt/baselines/about/mobile.png"));
    assert.equal(after.length, before.length); // same content → identical PNG bytes
  });

  it("with a positional route refreshes only that route", async () => {
    const aboutBefore = await readFile(join(cwd, ".vrt/baselines/about/mobile.png"));
    // Modify home.html so the new pin produces different bytes.
    await writeFile(
      join(cwd, "pages", "home.html"),
      "<!doctype html><html><body style='margin:0;padding:48px;background:#f9f9ff;font:18px sans-serif'><h1>Home modified</h1></body></html>",
    );
    const homeBeforePin = await readFile(join(cwd, ".vrt/baselines/home/mobile.png"));
    const r = cli(cwd, "pin", "home");
    assert.equal(r.status, 0);
    assert.match(r.stdout, /pinning 1 of 2 route\(s\) \(home\)/);
    const homeAfter = await readFile(join(cwd, ".vrt/baselines/home/mobile.png"));
    const aboutAfter = await readFile(join(cwd, ".vrt/baselines/about/mobile.png"));
    assert.ok(!homeBeforePin.equals(homeAfter), "home baseline should have changed");
    assert.ok(aboutBefore.equals(aboutAfter), "about baseline should be untouched");
  });

  it("errors on unknown route name without touching any baseline", async () => {
    const aboutBefore = await readFile(join(cwd, ".vrt/baselines/about/mobile.png"));
    const r = cli(cwd, "pin", "frobnicate");
    assert.equal(r.status, 1);
    assert.match(r.stderr, /unknown route\(s\): frobnicate/);
    assert.match(r.stderr, /Known routes: home, about/);
    const aboutAfter = await readFile(join(cwd, ".vrt/baselines/about/mobile.png"));
    assert.ok(aboutBefore.equals(aboutAfter));
  });
});

describe("vrt diff-pr post", () => {
  let cwd: string;
  let summaryPath: string;

  before(async () => {
    cwd = await mkdtemp(join(tmpdir(), "vrt-diff-pr-post-"));
    summaryPath = join(cwd, ".vrt/runs/diff-pr/summary.md");
    await mkdir(join(cwd, ".vrt/runs/diff-pr"), { recursive: true });
    await writeFile(summaryPath, "# vrt diff-pr summary\n\nStatus: **PASS**\n");
  });

  after(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  it("requires --pr <ref>", () => {
    const r = cli(cwd, "post");
    assert.equal(r.status, 1);
    assert.match(r.stderr, /--pr <ref> is required/);
  });

  it("errors when the summary is missing", () => {
    const r = cli(cwd, "post", "--pr", "owner/repo#42", "--summary", join(cwd, "missing.md"));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /no summary/);
  });

  it("falls back to printing the markdown when gh is not on PATH", async () => {
    // Force the fallback path by prepending a tmp dir whose `gh`
    // script exits non-zero. `gh --version` then returns ≠ 0, so
    // `ghAvailable()` returns false and the printer fires.
    const stubDir = await mkdtemp(join(tmpdir(), "vrt-diff-pr-post-stub-"));
    const stub = join(stubDir, "gh");
    await writeFile(stub, "#!/bin/sh\nexit 1\n");
    spawnSync("chmod", ["+x", stub]);
    try {
      const r = spawnSync(
        "node",
        ["--experimental-strip-types", CLI_PATH, "diff-pr", "post", "--pr", "owner/repo#42"],
        {
          encoding: "utf-8",
          cwd,
          env: { ...process.env, PATH: `${stubDir}:${process.env.PATH ?? ""}` },
        },
      );
      assert.equal(r.status, 0);
      assert.match(r.stdout, /gh CLI not available/);
      assert.match(r.stdout, /<!-- vrt-diff-pr-summary -->/);
      assert.match(r.stdout, /Status: \*\*PASS\*\*/);
    } finally {
      await rm(stubDir, { recursive: true, force: true });
    }
  });

  it("decorates the body with the marker comment", async () => {
    const stubDir = await mkdtemp(join(tmpdir(), "vrt-diff-pr-post-stub-"));
    const stub = join(stubDir, "gh");
    await writeFile(stub, "#!/bin/sh\nexit 1\n");
    spawnSync("chmod", ["+x", stub]);
    try {
      const r = spawnSync(
        "node",
        ["--experimental-strip-types", CLI_PATH, "diff-pr", "post", "--pr", "owner/repo#42"],
        { encoding: "utf-8", cwd, env: { ...process.env, PATH: `${stubDir}:${process.env.PATH ?? ""}` } },
      );
      assert.equal(r.status, 0);
      const posted = await readFile(`${summaryPath}.posted.md`, "utf-8");
      assert.ok(posted.startsWith("<!-- vrt-diff-pr-summary -->"));
    } finally {
      await rm(stubDir, { recursive: true, force: true });
    }
  });

  it("honors a custom --marker for overwrite identification", async () => {
    const stubDir = await mkdtemp(join(tmpdir(), "vrt-diff-pr-post-stub-"));
    const stub = join(stubDir, "gh");
    await writeFile(stub, "#!/bin/sh\nexit 1\n");
    spawnSync("chmod", ["+x", stub]);
    try {
      const r = spawnSync(
        "node",
        [
          "--experimental-strip-types", CLI_PATH, "diff-pr", "post",
          "--pr", "owner/repo#42", "--marker", "vrt-ui-team-staging",
        ],
        { encoding: "utf-8", cwd, env: { ...process.env, PATH: `${stubDir}:${process.env.PATH ?? ""}` } },
      );
      assert.equal(r.status, 0);
      assert.match(r.stdout, /Marker: +vrt-ui-team-staging/);
    } finally {
      await rm(stubDir, { recursive: true, force: true });
    }
  });

  it("invokes gh pr comment when gh succeeds (stubbed)", async () => {
    const stubDir = await mkdtemp(join(tmpdir(), "vrt-diff-pr-post-stub-"));
    const stub = join(stubDir, "gh");
    const log = join(stubDir, "calls.log");
    await writeFile(
      stub,
      `#!/bin/sh\nif [ "$1" = "--version" ]; then echo "gh 0.0-stub"; exit 0; fi\nprintf '%s\\n' "$@" >> ${log}\nexit 0\n`,
    );
    spawnSync("chmod", ["+x", stub]);
    try {
      const r = spawnSync(
        "node",
        ["--experimental-strip-types", CLI_PATH, "diff-pr", "post", "--pr", "owner/repo#42"],
        { encoding: "utf-8", cwd, env: { ...process.env, PATH: `${stubDir}:${process.env.PATH ?? ""}` } },
      );
      assert.equal(r.status, 0);
      assert.match(r.stdout, /posted summary to PR owner\/repo#42/);
      const calls = await readFile(log, "utf-8");
      assert.match(calls, /^pr$/m);
      assert.match(calls, /^comment$/m);
      assert.match(calls, /^owner\/repo#42$/m);
      assert.match(calls, /^--body-file$/m);
    } finally {
      await rm(stubDir, { recursive: true, force: true });
    }
  });
});
