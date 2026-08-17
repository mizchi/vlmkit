import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, it } from "vitest";
import { buildMarkdownSummary } from "./diff-pr.ts";
import { parseDiffPrConfig } from "./diff-pr-config.ts";

const CLI_PATH = new URL("./cli/vlmkit.ts", import.meta.url).pathname;
function cli(cwd: string, ...argv: string[]): { stdout: string; stderr: string; status: number } {
  const r = spawnSync(
    "node",
    ["--experimental-strip-types", CLI_PATH, "diff-pr", ...argv],
    { encoding: "utf-8", cwd },
  );
  // Strip ANSI so regex assertions can match content without
  // accounting for color codes between meaningful tokens.
  // eslint-disable-next-line no-control-regex
  const ANSI = /\x1B\[[0-9;]*m/g;
  return {
    stdout: (r.stdout ?? "").replace(ANSI, ""),
    stderr: (r.stderr ?? "").replace(ANSI, ""),
    status: r.status ?? 0,
  };
}

const config = parseDiffPrConfig(JSON.stringify({
  baseUrl: "http://localhost:3000",
  thresholds: { mobile: 0.01, desktop: 0.005, wide: 0.005 },
  routes: [
    "/",
    { name: "admin", path: "/admin", thresholds: { mobile: 0.03, desktop: 0.02, wide: 0.02 } },
  ],
}), "/example/vlmkit.config.json");

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
        error: "no baseline at /tmp/.vlmkit/baselines/home",
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

describe("vlmkit diff-pr pin <route>...", () => {
  let cwd: string;

  beforeAll(async () => {
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
      baselineDir: ".vlmkit/baselines",
      routes: [
        { name: "home", url: `file://${join(cwd, "pages", "home.html")}` },
        { name: "about", url: `file://${join(cwd, "pages", "about.html")}` },
      ],
    };
    await writeFile(join(cwd, "vlmkit.config.json"), JSON.stringify(cfg, null, 2));
    // Seed both baselines.
    const r = cli(cwd, "pin");
    assert.equal(r.status, 0, `seed pin failed: ${r.stderr}`);
  });

  afterAll(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  it("with no positional args refreshes every route (sanity baseline)", async () => {
    const before = await readFile(join(cwd, ".vlmkit/baselines/about/mobile.png"));
    const r = cli(cwd, "pin");
    assert.equal(r.status, 0);
    const after = await readFile(join(cwd, ".vlmkit/baselines/about/mobile.png"));
    assert.equal(after.length, before.length); // same content → identical PNG bytes
  });

  it("with a positional route refreshes only that route", async () => {
    const aboutBefore = await readFile(join(cwd, ".vlmkit/baselines/about/mobile.png"));
    // Modify home.html so the new pin produces different bytes.
    await writeFile(
      join(cwd, "pages", "home.html"),
      "<!doctype html><html><body style='margin:0;padding:48px;background:#f9f9ff;font:18px sans-serif'><h1>Home modified</h1></body></html>",
    );
    const homeBeforePin = await readFile(join(cwd, ".vlmkit/baselines/home/mobile.png"));
    const r = cli(cwd, "pin", "home");
    assert.equal(r.status, 0);
    assert.match(r.stdout, /pinning 1 of 2 route\(s\) \(home\)/);
    const homeAfter = await readFile(join(cwd, ".vlmkit/baselines/home/mobile.png"));
    const aboutAfter = await readFile(join(cwd, ".vlmkit/baselines/about/mobile.png"));
    assert.ok(!homeBeforePin.equals(homeAfter), "home baseline should have changed");
    assert.ok(aboutBefore.equals(aboutAfter), "about baseline should be untouched");
  });

  it("errors on unknown route name without touching any baseline", async () => {
    const aboutBefore = await readFile(join(cwd, ".vlmkit/baselines/about/mobile.png"));
    const r = cli(cwd, "pin", "frobnicate");
    assert.equal(r.status, 1);
    assert.match(r.stderr, /unknown route\(s\): frobnicate/);
    assert.match(r.stderr, /Known routes: home, about/);
    const aboutAfter = await readFile(join(cwd, ".vlmkit/baselines/about/mobile.png"));
    assert.ok(aboutBefore.equals(aboutAfter));
  });
});

describe("vlmkit diff-pr a11y gate", () => {
  let cwd: string;

  beforeAll(async () => {
    cwd = await mkdtemp(join(tmpdir(), "vrt-diff-pr-a11y-"));
    await mkdir(join(cwd, "pages"), { recursive: true });
    // Good: high contrast + big buttons + DOM-order Tab.
    await writeFile(join(cwd, "pages", "good.html"),
      `<!doctype html><html><head><style>
        body { margin: 0; padding: 24px; background: #fff; color: #111; font: 16px sans-serif; }
        button { background: #1a73e8; color: #fff; font: 700 16px sans-serif;
          padding: 16px 28px; min-width: 64px; min-height: 44px;
          border: none; border-radius: 8px; margin: 8px; }
      </style></head><body>
      <h1>Accessible page</h1><p>Body text reads cleanly.</p>
      <button>One</button><button>Two</button>
      </body></html>`);
    // Bad: muted text, and a row of tiny buttons.
    //
    // TWO adjacent buttons, not one. A single isolated tiny button satisfies WCAG 2.5.8's
    // spacing exception — a 24px circle centered on it hits nothing — so it stopped being a
    // touch failure when the exceptions landed in 0.11.0, and this test's whole subject is
    // a route that exceeds the touch budget. Adjacent controls are the case the criterion
    // is actually aimed at.
    await writeFile(join(cwd, "pages", "bad.html"),
      `<!doctype html><html><head><style>
        body { margin: 0; padding: 24px; background: #fff; color: #999; font: 14px sans-serif; }
        button { background: #ccc; color: #999; font: 11px sans-serif;
          padding: 1px 4px; min-width: 0; border: none; margin: 0; }
      </style></head><body>
      <h1>Low contrast heading</h1>
      <p>Muted body text.</p>
      <button>x</button><button>y</button>
      </body></html>`);
    const cfg = {
      thresholds: { mobile: 0.5, desktop: 0.5, wide: 0.5 },
      baselineDir: ".vlmkit/baselines",
      approvalPath: "./approval.json",
      a11y: {
        level: "AA",
        maxContrastFailures: 0,
        maxTouchFailures: 0,
        maxFocusOrderFailures: 0,
      },
      routes: [
        { name: "good", url: `file://${join(cwd, "pages", "good.html")}` },
        { name: "bad", url: `file://${join(cwd, "pages", "bad.html")}` },
      ],
    };
    await writeFile(join(cwd, "vlmkit.config.json"), JSON.stringify(cfg, null, 2));
    const r = cli(cwd, "pin");
    assert.equal(r.status, 0, `pin failed: ${r.stderr}`);
  });

  afterAll(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  it("fails on a11y violations that exceed the per-check budget", () => {
    const r = cli(cwd);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /good\s+pass.*\[a11y c=0\/t=0/);
    // t=2: both tiny buttons. Neither is spacing-exempt, because their 24px circles
    // intersect each other — see the fixture comment.
    assert.match(r.stdout, /bad\s+FAIL.*\[a11y c=3\/t=2/);
    assert.match(r.stdout, /FAIL — at least one route over threshold/);
  });

  it("approval-manifest suppression flips bad route to pass", async () => {
    const manifestPath = join(cwd, "approval.json");
    await writeFile(manifestPath, JSON.stringify({
      rules: [
        { kind: "a11y-contrast", selector: "button", reason: "decorative button" },
        { kind: "a11y-contrast", selector: "h1", reason: "branded muted heading" },
        { kind: "a11y-contrast", selector: "p", reason: "secondary body text" },
        { kind: "a11y-touch", selector: "button", reason: "tiny dismiss" },
      ],
    }, null, 2));
    const r = cli(cwd);
    assert.equal(r.status, 0, `expected pass with suppression: ${r.stdout}\n${r.stderr}`);
    assert.match(r.stdout, /good\s+pass.*\[a11y c=0\/t=0/);
    assert.match(r.stdout, /bad\s+pass.*\[a11y c=0\/t=0/);
  });

  it("expired manifest rules don't suppress findings", async () => {
    const manifestPath = join(cwd, "approval.json");
    await writeFile(manifestPath, JSON.stringify({
      rules: [
        { kind: "a11y-contrast", selector: "button",
          reason: "decorative", expires: "2020-01-01" },
        { kind: "a11y-contrast", selector: "h1",
          reason: "branded", expires: "2020-01-01" },
        { kind: "a11y-contrast", selector: "p",
          reason: "secondary", expires: "2020-01-01" },
        { kind: "a11y-touch", selector: "button",
          reason: "tiny", expires: "2020-01-01" },
      ],
    }, null, 2));
    const r = cli(cwd);
    assert.equal(r.status, 1, `expected fail with expired rules: ${r.stdout}\n${r.stderr}`);
    assert.match(r.stdout, /bad\s+FAIL/);
  });
});

describe("vlmkit diff-pr post", () => {
  let cwd: string;
  let summaryPath: string;

  beforeAll(async () => {
    cwd = await mkdtemp(join(tmpdir(), "vrt-diff-pr-post-"));
    summaryPath = join(cwd, ".vlmkit/runs/diff-pr/summary.md");
    await mkdir(join(cwd, ".vlmkit/runs/diff-pr"), { recursive: true });
    await writeFile(summaryPath, "# vlmkit diff-pr summary\n\nStatus: **PASS**\n");
  });

  afterAll(async () => {
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
    //
    // `CI: ""` here and in the three cases below is not incidental. The fallback's exit
    // code depends on `CI`, and these spawns inherit `process.env` — which carries
    // `CI=1` on a GitHub runner, so without this they would assert the local behaviour
    // while running under the CI behaviour, and flip red on a runner only.
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
          env: { ...process.env, CI: "", PATH: `${stubDir}:${process.env.PATH ?? ""}` },
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

  it("fails instead of falling back silently when CI is set", async () => {
    // The same run as above, one environment variable apart. Printing markdown for a
    // human to paste is the job done at a terminal; in CI nobody reads it, so a green
    // step tells the reviewer the summary reached the PR when it did not.
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
          env: { ...process.env, CI: "1", PATH: `${stubDir}:${process.env.PATH ?? ""}` },
        },
      );
      assert.equal(r.status, 1, `an unposted comment must not exit 0 in CI:\n${r.stdout}`);
      // eslint-disable-next-line no-control-regex
      const stderr = (r.stderr ?? "").replace(/\x1B\[[0-9;]*m/g, "");
      assert.match(stderr, /not posted/);
      assert.match(stderr, /no comment was added to owner\/repo#42/);
      assert.match(stderr, /GH_TOKEN \/ GITHUB_TOKEN/, "the message has to say how to fix it");
      // The markdown is still printed — failing the step must not also lose the content.
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
        { encoding: "utf-8", cwd, env: { ...process.env, CI: "", PATH: `${stubDir}:${process.env.PATH ?? ""}` } },
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
        { encoding: "utf-8", cwd, env: { ...process.env, CI: "", PATH: `${stubDir}:${process.env.PATH ?? ""}` } },
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
        { encoding: "utf-8", cwd, env: { ...process.env, CI: "", PATH: `${stubDir}:${process.env.PATH ?? ""}` } },
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

describe("a declared viewport with no baseline", () => {
  let cwd: string;

  /**
   * The worst thing a CI gate can do. `if (!existsSync(baselinePath)) continue;` skipped
   * an unpinned viewport, and `perVp.some((v) => !v.pass)` is `false` for an empty array,
   * so the route reported pass having compared nothing.
   *
   * Measured before the fix on exactly this setup: two declared viewports, `mobile`
   * pinned and `desktop` not, the current `desktop` render 100% different from what a
   * baseline would have held — output `home pass mobile=0.00%`, `PASS`, exit 0, with
   * `desktop` not mentioned anywhere. With a stray PNG under a label no longer in
   * `viewports`, ZERO pixels were compared and it still said pass.
   */
  beforeAll(async () => {
    cwd = await mkdtemp(join(tmpdir(), "vrt-diff-pr-unpinned-"));
    await mkdir(join(cwd, "pages"), { recursive: true });
    await writeFile(
      join(cwd, "pages", "home.html"),
      "<!doctype html><html><body style='margin:0;background:#0a0;height:400px'></body></html>",
    );
    await writeFile(join(cwd, "vlmkit.config.json"), JSON.stringify({
      viewports: ["mobile", "desktop"],
      thresholds: { mobile: 0.01, desktop: 0.01 },
      baselineDir: ".vlmkit/baselines",
      routes: [{ name: "home", url: `file://${join(cwd, "pages", "home.html")}` }],
    }, null, 2));
    const pin = cli(cwd, "pin");
    assert.equal(pin.status, 0, `seed pin failed: ${pin.stderr}`);
  });

  afterAll(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  it("fails the run, names the viewport, and does not call it a breach", async () => {
    await rm(join(cwd, ".vlmkit/baselines/home/desktop.png"));
    const r = cli(cwd, "--output", "out-one");
    assert.equal(r.status, 1, `should fail with an unpinned viewport:\n${r.stdout}`);
    assert.match(r.stdout, /not compared: desktop/);
    assert.match(r.stdout, /declared viewport\(s\) had no baseline/);
    // The viewport that IS pinned still reports its delta, so the run is not just an error.
    assert.match(r.stdout, /mobile=/);

    const md = await readFile(join(cwd, "out-one", "summary.md"), "utf-8");
    assert.match(md, /Status: \*\*FAIL\*\*/);
    assert.match(md, /## Not compared — no baseline/);
    assert.match(md, /- `home`: desktop/);
    // A row per declared viewport, so counting rows matches the config.
    assert.match(md, /\| `home` \| desktop \| — \| — \| ❌ not compared: no baseline \|/);
    assert.match(md, /\| `home` \| mobile \|/);
    // And it is NOT listed as a pixel breach, because nothing was measured.
    assert.doesNotMatch(md, /Worst offenders/);
  });

  it("fails when nothing is comparable at all, rather than passing on zero comparisons", async () => {
    // A stray PNG under a label that is no longer in `viewports` — a renamed viewport.
    // The existing `pinned.length === 0` check does not catch this, because the directory
    // is not empty.
    await rm(join(cwd, ".vlmkit/baselines/home"), { recursive: true, force: true });
    await mkdir(join(cwd, ".vlmkit/baselines/home"), { recursive: true });
    await writeFile(join(cwd, ".vlmkit/baselines/home/tablet.png"), Buffer.from(
      "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6300010000050001"
      + "0d0a2db40000000049454e44ae426082", "hex",
    ));
    const r = cli(cwd, "--output", "out-none");
    assert.equal(r.status, 1, `zero comparisons must not pass:\n${r.stdout}`);
    assert.match(r.stdout, /not compared: mobile, desktop/);

    const md = await readFile(join(cwd, "out-none", "summary.md"), "utf-8");
    assert.match(md, /- `home`: mobile, desktop/);
  });

  it("still passes when every declared viewport is pinned and matches", async () => {
    // The control. A fix that makes everything fail is not a fix.
    await rm(join(cwd, ".vlmkit/baselines"), { recursive: true, force: true });
    const pin = cli(cwd, "pin");
    assert.equal(pin.status, 0, pin.stderr);
    const r = cli(cwd, "--output", "out-ok");
    assert.equal(r.status, 0, `a fully pinned run must pass:\n${r.stdout}`);
    assert.match(r.stdout, /PASS/);
    assert.doesNotMatch(r.stdout, /not compared/);
    const md = await readFile(join(cwd, "out-ok", "summary.md"), "utf-8");
    assert.doesNotMatch(md, /Not compared/);
  });
});

describe("a waitFor selector that never matches", () => {
  let cwd: string;

  /**
   * `waitFor` exists so the gate does not measure a pre-render state, and the wait was
   * `.catch(() => {})` — so a selector that never became visible was indistinguishable
   * from one that did, in both `pin` and the gate run.
   *
   * Measured on this fixture with the selector misspelled `.app-rooot`: `pin` took 12.3s
   * where the correct selector takes 2.1s (ten of those spent silently waiting) and then
   * wrote a baseline anyway, and the gate reported `app pass desktop=0.00%` / `PASS` /
   * exit 0. Nothing said the declared condition never held. `page-open.ts`'s `settlePage`
   * docstring records three earlier instances of the same class — a green gate on a page
   * that never rendered.
   *
   * It throws now, which both call sites already handle correctly, and the throw lands
   * before the screenshot: a baseline is never pinned from a page that did not reach its
   * declared ready state. A poisoned baseline is worse than a missing one, because every
   * later run agrees with it.
   */
  beforeAll(async () => {
    cwd = await mkdtemp(join(tmpdir(), "vrt-diff-pr-waitfor-"));
    await mkdir(join(cwd, "pages"), { recursive: true });
    // Client-rendered: a placeholder first, the real view a tick later. Without the wait
    // this is exactly the page that gets measured too early.
    await writeFile(
      join(cwd, "pages", "app.html"),
      "<!doctype html><html><head><style>body{margin:0}#root{height:400px;background:#eee}"
      + ".card{height:120px;background:#c00}</style></head><body><div id=\"root\">Loading…</div>"
      + "<script>setTimeout(() => { document.getElementById('root').innerHTML = "
      + "'<div class=\"app-root\"><div class=\"card\"></div></div>'; }, 300);</script></body></html>",
    );
    await writeFile(join(cwd, "vlmkit.config.json"), JSON.stringify({
      viewports: ["desktop"],
      thresholds: { desktop: 0.01 },
      baselineDir: ".vlmkit/baselines",
      routes: [{ name: "app", url: `file://${join(cwd, "pages", "app.html")}`, waitFor: ".app-root" }],
    }, null, 2));
    const pin = cli(cwd, "pin");
    assert.equal(pin.status, 0, `a matching waitFor must pin cleanly: ${pin.stdout}${pin.stderr}`);
  });

  afterAll(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  it("fails the pin and writes no baseline, rather than pinning a placeholder", async () => {
    await rm(join(cwd, ".vlmkit/baselines"), { recursive: true, force: true });
    await writeFile(join(cwd, "vlmkit.config.json"), JSON.stringify({
      viewports: ["desktop"],
      thresholds: { desktop: 0.01 },
      baselineDir: ".vlmkit/baselines",
      routes: [{ name: "app", url: `file://${join(cwd, "pages", "app.html")}`, waitFor: ".app-rooot" }],
    }, null, 2));

    const pin = cli(cwd, "pin");
    assert.equal(pin.status, 1, `an unmet waitFor must fail the pin:\n${pin.stdout}`);
    assert.match(pin.stdout, /waitFor selector never became visible within 10s: \.app-rooot/);
    assert.match(pin.stdout, /nothing pinned/);
    assert.match(pin.stderr, /baseline\(s\) were not written: app\/desktop/);
    // No PNG, so the next run reports "not compared" rather than agreeing with a
    // baseline captured before the page rendered.
    const files = await readdir(join(cwd, ".vlmkit/baselines/app")).catch(() => []);
    assert.deepEqual(files.filter((f) => f.endsWith(".png")), []);
  });

  it("fails the gate run and reports it as a render error, not a 100% breach", async () => {
    // Pin with the right selector, then break it, so the baseline is good and only the
    // current side fails. `diffRatio: 1` in the catch is there to force the failure —
    // reporting it as `100.00%` under "Worst offenders" sent the reader to look at
    // screenshots for a config typo.
    await writeFile(join(cwd, "vlmkit.config.json"), JSON.stringify({
      viewports: ["desktop"],
      thresholds: { desktop: 0.01 },
      baselineDir: ".vlmkit/baselines",
      routes: [{ name: "app", url: `file://${join(cwd, "pages", "app.html")}`, waitFor: ".app-root" }],
    }, null, 2));
    assert.equal(cli(cwd, "pin").status, 0);
    await writeFile(join(cwd, "vlmkit.config.json"), JSON.stringify({
      viewports: ["desktop"],
      thresholds: { desktop: 0.01 },
      baselineDir: ".vlmkit/baselines",
      routes: [{ name: "app", url: `file://${join(cwd, "pages", "app.html")}`, waitFor: ".app-rooot" }],
    }, null, 2));

    const r = cli(cwd, "--output", "out-wait");
    assert.equal(r.status, 1, `an unmet waitFor must fail the run:\n${r.stdout}`);
    // The terminal line goes through `String(err)` so it carries the `Error: ` prefix;
    // the markdown cell uses `err.message` and does not.
    assert.match(r.stdout, /render error: Error: waitFor selector never became visible/);
    assert.match(r.stdout, /desktop=error/);
    assert.doesNotMatch(r.stdout, /desktop=100\.00%/, "zero compared pixels is not a 100% diff");

    const md = await readFile(join(cwd, "out-wait", "summary.md"), "utf-8");
    assert.match(md, /\| `app` \| desktop \| — \| 1\.00% \| ❌ render error: waitFor selector/);
    assert.doesNotMatch(md, /Worst offenders/, "a viewport that never rendered is not an offender");
    assert.doesNotMatch(md, /100\.00%/);
  });

  it("passes when the selector matches, and does not burn the timeout doing it", async () => {
    // The control, and the other half of the cost: the swallowed wait spent a silent 10s
    // per viewport. Asserted well under that rather than at a tight number, because this
    // is a browser launch on shared CI — what is being ruled out is "waited out the
    // timeout and carried on", not a performance target.
    await writeFile(join(cwd, "vlmkit.config.json"), JSON.stringify({
      viewports: ["desktop"],
      thresholds: { desktop: 0.01 },
      baselineDir: ".vlmkit/baselines",
      routes: [{ name: "app", url: `file://${join(cwd, "pages", "app.html")}`, waitFor: ".app-root" }],
    }, null, 2));
    const started = Date.now();
    const pin = cli(cwd, "pin");
    const elapsed = Date.now() - started;
    assert.equal(pin.status, 0, `a matching waitFor must pin:\n${pin.stdout}`);
    assert.match(pin.stdout, /ok \(1\/1 viewport\(s\)\)/);
    assert.match(pin.stdout, /Baselines pinned/);
    assert.ok(elapsed < 9000, `pinning took ${elapsed}ms — that is the 10s wait being waited out`);

    const r = cli(cwd, "--output", "out-ok");
    assert.equal(r.status, 0, `a settled page must pass:\n${r.stdout}`);
    assert.match(r.stdout, /desktop=0\.00%/);
  });
});

describe("a declared policy whose run throws", () => {
  let cwd: string;

  /**
   * The same false green as the unpinned viewport above, one level up: the media-variants
   * and cross-browser blocks caught their error, logged a yellow line, and left the
   * result `undefined` — and `undefined` reads as "not declared":
   *
   *     const mvFailed = mediaVariantsResult ? !mediaVariantsResult.pass : false;
   *
   * Measured before the fix on exactly this setup — `mediaVariants` declared, a regular
   * file sitting where the gate's output directory goes so `mkdir` throws EEXIST: the
   * route printed `home pass desktop=0.00%`, the run printed `PASS`, it exited 0, and
   * `summary.md` was byte-identical to a run where the policy had passed. The artifact
   * that gets pasted into the PR did not name media-variants at all.
   *
   * The EEXIST collision is a stand-in for the real trigger — a browser that will not
   * launch on a minimal CI runner, which is the case the cross-browser block's own
   * comment anticipates. What is under test is the verdict, not the cause.
   */
  beforeAll(async () => {
    cwd = await mkdtemp(join(tmpdir(), "vrt-diff-pr-policy-error-"));
    await mkdir(join(cwd, "pages"), { recursive: true });
    await writeFile(
      join(cwd, "pages", "home.html"),
      "<!doctype html><html><body style='margin:0;background:#0a0;height:400px'></body></html>",
    );
    await writeFile(join(cwd, "vlmkit.config.json"), JSON.stringify({
      viewports: ["desktop"],
      thresholds: { desktop: 0.01 },
      baselineDir: ".vlmkit/baselines",
      // One variant, so the run is quick; `print` needs no extra engine.
      mediaVariants: { variants: ["print"], maxSuspects: 5, maxWarns: 5 },
      routes: [{ name: "home", url: `file://${join(cwd, "pages", "home.html")}` }],
    }, null, 2));
    const pin = cli(cwd, "pin");
    assert.equal(pin.status, 0, `seed pin failed: ${pin.stderr}`);
  });

  afterAll(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  it("fails the run and names the policy, in the terminal and in the markdown", async () => {
    // A file where the gate wants a directory.
    await mkdir(join(cwd, "out-err", "home"), { recursive: true });
    await writeFile(join(cwd, "out-err", "home", "media-variants"), "not a directory\n");

    const r = cli(cwd, "--output", "out-err");
    assert.equal(r.status, 1, `an errored policy must not pass:\n${r.stdout}`);
    assert.match(r.stdout, /not evaluated: media-variants \(errored\)/);
    assert.match(r.stdout, /declared policy run\(s\) errored and produced no verdict/);
    // The pixel comparison still happened and still reports, so this is not a hard abort.
    assert.match(r.stdout, /desktop=0\.00%/);

    const md = await readFile(join(cwd, "out-err", "summary.md"), "utf-8");
    assert.match(md, /Status: \*\*FAIL\*\*/);
    assert.match(md, /## Not evaluated — the policy errored/);
    assert.match(md, /- `home` — \*\*media-variants\*\*: .*EEXIST/);
    // Not a pixel breach and not a media-variant verdict: there is no verdict.
    assert.doesNotMatch(md, /Worst offenders/);
    assert.doesNotMatch(md, /## Media-variant failures/);
  });

  it("still passes when the policy runs, so the fix does not just fail everything", async () => {
    // The control. `maxWarns: 5` above is deliberately loose — what is asserted is that a
    // policy which *produced a verdict* is not caught by the new branch.
    const r = cli(cwd, "--output", "out-ok");
    assert.equal(r.status, 0, `a run whose policy completed must pass:\n${r.stdout}`);
    assert.match(r.stdout, /\[mv suspect=/, "the policy must actually have run");
    assert.doesNotMatch(r.stdout, /not evaluated/);
    const md = await readFile(join(cwd, "out-ok", "summary.md"), "utf-8");
    assert.doesNotMatch(md, /Not evaluated — the policy errored/);
  });
});

describe("a malformed flag", () => {
  let cwd: string;

  /**
   * `diff-pr` and `baseline-cli` each had their own `getArg`:
   *
   *     const i = args.indexOf(`--${name}`);
   *     if (i < 0 || i === args.length - 1) return undefined;
   *     const v = args[i + 1];
   *     return v.startsWith("--") ? undefined : v;
   *
   * which returns `undefined` for BOTH "flag absent" and "flag present but valueless" —
   * so a malformed flag was indistinguishable from an omitted one and the command
   * proceeded on its default. Measured: `diff-pr --from-dir cur --output` (no value)
   * wrote its summary to `.vlmkit/runs/diff-pr/summary.md` and exited 0. In CI that is
   * `--output "$UNSET_VAR"` putting the artifact where nobody looks.
   *
   * Core's `readFlag` already distinguished the two and throws. Both copies now use it,
   * which also removes the duplication.
   */
  beforeAll(async () => {
    cwd = await mkdtemp(join(tmpdir(), "vrt-diff-pr-flags-"));
    await mkdir(join(cwd, "pages"), { recursive: true });
    await writeFile(
      join(cwd, "pages", "home.html"),
      "<!doctype html><html><body style='margin:0;background:#0a0;height:200px'></body></html>",
    );
    await writeFile(join(cwd, "vlmkit.config.json"), JSON.stringify({
      viewports: ["mobile"],
      thresholds: { mobile: 0.01 },
      baselineDir: ".vlmkit/baselines",
      routes: [{ name: "home", url: `file://${join(cwd, "pages", "home.html")}` }],
    }, null, 2));
    assert.equal(cli(cwd, "pin").status, 0);
  });

  afterAll(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  it("names the flag instead of falling back to a default", () => {
    const r = cli(cwd, "--output");
    assert.equal(r.status, 1, `a valueless --output must not be ignored:\n${r.stdout}${r.stderr}`);
    assert.match(`${r.stdout}${r.stderr}`, /--output needs a value/);
  });

  it("says which flag it found instead, when the value is the next flag", () => {
    // `--from-dir` carries a real value here, so `--output` is the only malformed flag.
    // Pairing it with a second valueless flag reports whichever the code reads first
    // (`--config` is read before `--output`), which is correct and not what this pins.
    const r = cli(cwd, "--output", "--from-dir", "cur");
    assert.equal(r.status, 1);
    assert.match(`${r.stdout}${r.stderr}`, /--output needs a value, got the next flag --from-dir/);
  });

  it("reports a usage error as one line, with no stack trace", () => {
    // The guard used to be `console.error(err)`, which prints the whole Error. The
    // message already names the flag and the fix.
    const r = cli(cwd, "--output");
    const out = `${r.stdout}${r.stderr}`;
    assert.doesNotMatch(out, /at .*diff-pr/, `a stack trace buries the message:\n${out}`);
    assert.ok(out.trim().split("\n").length <= 2, `expected one line, got:\n${out}`);
  });

  it("still accepts a well-formed run", () => {
    const r = cli(cwd, "--output", "out-ok");
    assert.equal(r.status, 0, `${r.stdout}${r.stderr}`);
    assert.match(r.stdout, /out-ok/);
  });
});
