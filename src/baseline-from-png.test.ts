/**
 * Tests for `baseline pin|verify --from-png / --from-dir`.
 *
 * Real temp dirs and real PNGs throughout (pngjs), because the whole point of
 * the feature is that the bytes on disk are the input — a mocked filesystem
 * would test the mapping table and skip the part that broke for the reporter.
 * The CLI is driven end to end via `baseline-cli.ts` so the alias chain
 * (`baseline pin` → `diff-pr pin`) is covered too.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import { parseDiffPrConfig } from "./diff-pr-config.ts";
import { resolvePngSources } from "./baseline-from-png.ts";

const BASELINE_CLI = resolve(fileURLToPath(import.meta.url), "..", "baseline-cli.ts");
// eslint-disable-next-line no-control-regex
const ANSI = /\x1B\[[0-9;]*m/g;

function runBaseline(args: string[], cwd: string): { stdout: string; stderr: string; status: number } {
  const r = spawnSync(
    process.execPath,
    ["--experimental-strip-types", BASELINE_CLI, ...args],
    { encoding: "utf-8", cwd, env: { ...process.env, NO_COLOR: "1" } },
  );
  return {
    stdout: (r.stdout ?? "").replace(ANSI, ""),
    stderr: (r.stderr ?? "").replace(ANSI, ""),
    status: r.status ?? 1,
  };
}

/**
 * Solid-colour PNG with an optional black rectangle, so a diff ratio can be
 * computed by hand: a 20x20 block in a 100x100 frame is exactly 4%.
 */
async function writePng(
  file: string,
  opts: { width?: number; height?: number; blockSize?: number } = {},
): Promise<void> {
  const width = opts.width ?? 100;
  const height = opts.height ?? 100;
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (width * y + x) << 2;
      const inBlock = opts.blockSize !== undefined && x < opts.blockSize && y < opts.blockSize;
      const v = inBlock ? 0 : 255;
      png.data[i] = v;
      png.data[i + 1] = v;
      png.data[i + 2] = v;
      png.data[i + 3] = 255;
    }
  }
  await mkdir(resolve(file, ".."), { recursive: true });
  await writeFile(file, PNG.sync.write(png));
}

interface ProjectOptions {
  viewports?: string[];
  thresholds?: Record<string, number>;
  routes?: unknown[];
  a11y?: unknown;
}

/** Temp project with a vlmkit.config.json; returns its dir. */
async function makeProject(opts: ProjectOptions = {}): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "vlmkit-frompng-"));
  const config: Record<string, unknown> = {
    baseUrl: "http://localhost:9/",
    baselineDir: "baselines",
    viewports: opts.viewports ?? ["desktop"],
    thresholds: opts.thresholds ?? { desktop: 0.01, mobile: 0.01, wide: 0.01 },
    routes: opts.routes ?? [{ name: "hud", path: "/hud" }, { name: "menu", path: "/menu" }],
  };
  if (opts.a11y) config.a11y = opts.a11y;
  await writeFile(join(dir, "vlmkit.config.json"), JSON.stringify(config, null, 2));
  return dir;
}

describe("resolvePngSources", () => {
  const config = parseDiffPrConfig(JSON.stringify({
    baseUrl: "http://localhost:9/",
    viewports: ["desktop"],
    routes: [{ name: "hud", path: "/hud" }, { name: "form-app", path: "/form" }],
  }), "/proj/vlmkit.config.json");

  it("maps the nested <route>/<viewport>.png layout — the pinned layout round-trips", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vlmkit-map-"));
    try {
      await writePng(join(dir, "hud", "desktop.png"));
      await writePng(join(dir, "form-app", "desktop.png"));
      const sources = await resolvePngSources({
        routes: config.routes,
        viewports: ["desktop"],
        fromDir: dir,
        cwd: dir,
        requireFullCoverage: true,
      });
      assert.deepEqual(
        sources.map((s) => `${s.route.name}/${s.viewport}:${s.matchedAs}`).sort(),
        ["form-app/desktop:nested", "hud/desktop:nested"],
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("matches the flat form against declared names, so a route name containing `-` is not mis-split", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vlmkit-map-"));
    try {
      // "form-app-mobile".split("-") would yield route "form" — matching against
      // the declared cross-product instead is what makes this safe.
      await writePng(join(dir, "hud-mobile.png"));
      await writePng(join(dir, "form-app-mobile.png"));
      const sources = await resolvePngSources({
        routes: config.routes,
        viewports: ["mobile"],
        fromDir: dir,
        cwd: dir,
        requireFullCoverage: true,
      });
      assert.deepEqual(
        sources.map((s) => `${s.route.name}/${s.viewport}:${s.matchedAs}`).sort(),
        ["form-app/mobile:flat", "hud/mobile:flat"],
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("accepts a bare <route>.png only when a single viewport is declared", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vlmkit-map-"));
    try {
      await writePng(join(dir, "hud.png"));
      const single = await resolvePngSources({
        routes: [config.routes[0]],
        viewports: ["desktop"],
        fromDir: dir,
        cwd: dir,
        requireFullCoverage: true,
      });
      assert.equal(single.length, 1);
      assert.equal(single[0].matchedAs, "bare");

      await assert.rejects(
        () => resolvePngSources({
          routes: [config.routes[0]],
          viewports: ["desktop", "mobile"],
          fromDir: dir,
          cwd: dir,
          requireFullCoverage: true,
        }),
        /1 file\(s\) in .* map to no declared route\/viewport pair:\n {2}hud\.png/,
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("rejects two files claiming the same route/viewport pair", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vlmkit-map-"));
    try {
      await writePng(join(dir, "hud-desktop.png"));
      await writePng(join(dir, "hud", "desktop.png"));
      await assert.rejects(
        () => resolvePngSources({
          routes: [config.routes[0]],
          viewports: ["desktop"],
          fromDir: dir,
          cwd: dir,
          requireFullCoverage: true,
        }),
        /two files both map to route `hud` viewport `desktop`/,
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("ignores _history/ so --from-dir <baselineDir> does not re-pin archived PNGs", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vlmkit-map-"));
    try {
      await writePng(join(dir, "hud", "desktop.png"));
      await writePng(join(dir, "hud", "_history", "2026-01-01", "desktop.png"));
      const sources = await resolvePngSources({
        routes: [config.routes[0]],
        viewports: ["desktop"],
        fromDir: dir,
        cwd: dir,
        requireFullCoverage: true,
      });
      assert.equal(sources.length, 1);
      assert.match(sources[0].file, /hud[\\/]desktop\.png$/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("requires --route and --viewport together for an arbitrarily-named single file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vlmkit-map-"));
    try {
      const file = join(dir, "frame_0001.png");
      await writePng(file);
      await assert.rejects(
        () => resolvePngSources({
          routes: config.routes, viewports: ["desktop"], fromPng: file, cwd: dir,
          requireFullCoverage: false,
        }),
        /maps to no declared route\/viewport pair/,
      );
      await assert.rejects(
        () => resolvePngSources({
          routes: config.routes, viewports: ["desktop"], fromPng: file, cwd: dir,
          routeOverride: "hud", requireFullCoverage: false,
        }),
        /--route and --viewport must be given together/,
      );
      const ok = await resolvePngSources({
        routes: config.routes, viewports: ["desktop"], fromPng: file, cwd: dir,
        routeOverride: "hud", viewportOverride: "desktop", requireFullCoverage: false,
      });
      assert.deepEqual(ok.map((s) => [s.route.name, s.viewport, s.matchedAs]), [["hud", "desktop", "explicit"]]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("rejects a file that is not actually a PNG", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vlmkit-map-"));
    try {
      await writeFile(join(dir, "hud.png"), "this is a JPEG really");
      await assert.rejects(
        () => resolvePngSources({
          routes: [config.routes[0]], viewports: ["desktop"], fromDir: dir, cwd: dir,
          requireFullCoverage: true,
        }),
        /is not a PNG \(bad signature\)/,
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("baseline pin --from-dir / --from-png", () => {
  it("copies a dir of PNGs into <baselineDir>/<route>/<viewport>.png", async () => {
    const proj = await makeProject();
    try {
      await writePng(join(proj, "captures", "hud", "desktop.png"));
      await writePng(join(proj, "captures", "menu", "desktop.png"), { blockSize: 20 });
      const r = runBaseline(["pin", "--from-dir", "captures"], proj);
      assert.equal(r.status, 0, r.stdout + r.stderr);
      assert.match(r.stdout, /no browser/);
      assert.ok(existsSync(join(proj, "baselines", "hud", "desktop.png")), "hud baseline written");
      assert.ok(existsSync(join(proj, "baselines", "menu", "desktop.png")), "menu baseline written");
      // Copied byte-for-byte — the pinned baseline IS the supplied frame.
      assert.deepEqual(
        await readFile(join(proj, "baselines", "menu", "desktop.png")),
        await readFile(join(proj, "captures", "menu", "desktop.png")),
      );
    } finally {
      await rm(proj, { recursive: true, force: true });
    }
  });

  it("errors, naming both sides, when a file maps to no declared route", async () => {
    const proj = await makeProject();
    try {
      await writePng(join(proj, "captures", "hud", "desktop.png"));
      await writePng(join(proj, "captures", "menu", "desktop.png"));
      await writePng(join(proj, "captures", "inventory-desktop.png"));
      const r = runBaseline(["pin", "--from-dir", "captures"], proj);
      assert.equal(r.status, 1);
      assert.match(r.stderr, /inventory-desktop\.png/);
      assert.match(r.stderr, /declared routes:\s+hud, menu/);
      assert.match(r.stderr, /declared viewports:\s+desktop/);
      // Nothing pinned: the run aborted rather than pinning the two good files.
      assert.equal(existsSync(join(proj, "baselines")), false);
    } finally {
      await rm(proj, { recursive: true, force: true });
    }
  });

  it("errors when a declared route/viewport pair has no file", async () => {
    const proj = await makeProject({ viewports: ["desktop", "mobile"] });
    try {
      await writePng(join(proj, "captures", "hud", "desktop.png"));
      await writePng(join(proj, "captures", "hud", "mobile.png"));
      await writePng(join(proj, "captures", "menu", "desktop.png"));
      const r = runBaseline(["pin", "--from-dir", "captures"], proj);
      assert.equal(r.status, 1);
      assert.match(r.stderr, /no PNG supplied for 1 declared route\/viewport pair/);
      assert.match(r.stderr, /menu\/mobile/);
      assert.match(r.stderr, /supplied: .*hud\/desktop/);
    } finally {
      await rm(proj, { recursive: true, force: true });
    }
  });

  it("errors when --from-png points at a missing file", async () => {
    const proj = await makeProject();
    try {
      const r = runBaseline(["pin", "--from-png", "captures/nope.png", "--route", "hud", "--viewport", "desktop"], proj);
      assert.equal(r.status, 1);
      assert.match(r.stderr, /--from-png file not found:.*nope\.png/);
    } finally {
      await rm(proj, { recursive: true, force: true });
    }
  });

  it("--from-png pins one pair and leaves sibling viewports alone", async () => {
    const proj = await makeProject({ viewports: ["desktop", "mobile"] });
    try {
      // Pre-existing mobile baseline stands in for an earlier pin.
      await writePng(join(proj, "baselines", "hud", "mobile.png"));
      await writePng(join(proj, "frames", "frame_0001.png"), { blockSize: 10 });
      const r = runBaseline(
        ["pin", "--from-png", "frames/frame_0001.png", "--route", "hud", "--viewport", "desktop"],
        proj,
      );
      assert.equal(r.status, 0, r.stdout + r.stderr);
      assert.ok(existsSync(join(proj, "baselines", "hud", "desktop.png")));
      assert.ok(existsSync(join(proj, "baselines", "hud", "mobile.png")), "sibling viewport survived");
    } finally {
      await rm(proj, { recursive: true, force: true });
    }
  });
});

describe("baseline update --from-dir", () => {
  it("archives the old baselines to _history/ and re-pins from files", async () => {
    // Regression guard: pin used to `rm -r` the whole route dir, which deleted
    // the `_history/<ts>/` archive `update` had just written one step earlier —
    // making the golden refresh irreversible. Applies to the browser path too.
    const proj = await makeProject();
    try {
      await writePng(join(proj, "captures", "hud", "desktop.png"));
      await writePng(join(proj, "captures", "menu", "desktop.png"));
      assert.equal(runBaseline(["pin", "--from-dir", "captures"], proj).status, 0);

      await writePng(join(proj, "next", "hud", "desktop.png"), { blockSize: 20 });
      await writePng(join(proj, "next", "menu", "desktop.png"), { blockSize: 20 });
      const r = runBaseline(["update", "--from-dir", "next"], proj);
      assert.equal(r.status, 0, r.stdout + r.stderr);
      assert.match(r.stdout, /archived 1 PNG\(s\) for hud/);

      // New baseline is the supplied frame…
      assert.deepEqual(
        await readFile(join(proj, "baselines", "hud", "desktop.png")),
        await readFile(join(proj, "next", "hud", "desktop.png")),
      );
      // …and the previous one is still recoverable.
      const historyRoot = join(proj, "baselines", "hud", "_history");
      assert.ok(existsSync(historyRoot), "_history survived the re-pin");
      const stamps = await readdir(historyRoot);
      assert.equal(stamps.length, 1);
      assert.deepEqual(
        await readFile(join(historyRoot, stamps[0], "desktop.png")),
        await readFile(join(proj, "captures", "hud", "desktop.png")),
      );
    } finally {
      await rm(proj, { recursive: true, force: true });
    }
  });
});

describe("baseline verify --from-dir", () => {
  it("diffs supplied PNGs against the pinned baselines and fails over threshold", async () => {
    // Per-route thresholds: hud tolerates 10%, menu tolerates 1%. Both get the
    // same 4% change (a 20x20 block in a 100x100 frame), so the run must pass
    // hud and fail menu — that is the threshold actually being applied, not
    // just carried in the report.
    const proj = await makeProject({
      thresholds: { desktop: 0.01 },
      routes: [
        { name: "hud", path: "/hud", thresholds: { desktop: 0.1 } },
        { name: "menu", path: "/menu" },
      ],
    });
    try {
      await writePng(join(proj, "captures", "hud", "desktop.png"));
      await writePng(join(proj, "captures", "menu", "desktop.png"));
      assert.equal(runBaseline(["pin", "--from-dir", "captures"], proj).status, 0);

      // "Current" render: same frames with a 20x20 regression each.
      await writePng(join(proj, "current", "hud", "desktop.png"), { blockSize: 20 });
      await writePng(join(proj, "current", "menu", "desktop.png"), { blockSize: 20 });
      const r = runBaseline(["verify", "--from-dir", "current", "--output", "run"], proj);
      assert.equal(r.status, 1, r.stdout + r.stderr);
      assert.match(r.stdout, /hud\s+pass\s+desktop=4\.00%/);
      assert.match(r.stdout, /menu\s+FAIL\s+desktop=4\.00%/);

      const md = await readFile(join(proj, "run", "summary.md"), "utf-8");
      assert.match(md, /Status: \*\*FAIL\*\* \(1 of 2 route\(s\)\)/);
      assert.match(md, /Current side: pre-rendered PNGs from `current` \(no browser\)/);
      assert.match(md, /\| `hud` \| desktop \| 4\.00% \| 10\.00% \| ✅ \|/);
      assert.match(md, /\| `menu` \| desktop \| 4\.00% \| 1\.00% \| ❌ \|/);
    } finally {
      await rm(proj, { recursive: true, force: true });
    }
  });

  it("passes when the supplied PNGs are identical to the baselines", async () => {
    const proj = await makeProject();
    try {
      await writePng(join(proj, "captures", "hud", "desktop.png"));
      await writePng(join(proj, "captures", "menu", "desktop.png"));
      assert.equal(runBaseline(["pin", "--from-dir", "captures"], proj).status, 0);
      const r = runBaseline(["verify", "--from-dir", "captures", "--output", "run"], proj);
      assert.equal(r.status, 0, r.stdout + r.stderr);
      assert.match(r.stdout, /PASS/);
    } finally {
      await rm(proj, { recursive: true, force: true });
    }
  });

  it("reports declared browser-only gates as not evaluated instead of passing them", async () => {
    const proj = await makeProject({ a11y: { maxContrastFailures: 0 } });
    try {
      await writePng(join(proj, "captures", "hud", "desktop.png"));
      await writePng(join(proj, "captures", "menu", "desktop.png"));
      assert.equal(runBaseline(["pin", "--from-dir", "captures"], proj).status, 0);
      const r = runBaseline(["verify", "--from-dir", "captures", "--output", "run"], proj);
      assert.equal(r.status, 0, r.stdout + r.stderr);
      assert.match(r.stdout, /warn: skipped \(need a browser\): a11y/);
      const md = await readFile(join(proj, "run", "summary.md"), "utf-8");
      assert.match(md, /\*\*Not evaluated\*\* \(declared in config, needs a live page\): a11y/);
    } finally {
      await rm(proj, { recursive: true, force: true });
    }
  });

  it("--from-png narrows the run to the named pair instead of passing unchecked routes", async () => {
    const proj = await makeProject();
    try {
      await writePng(join(proj, "captures", "hud", "desktop.png"));
      await writePng(join(proj, "captures", "menu", "desktop.png"));
      assert.equal(runBaseline(["pin", "--from-dir", "captures"], proj).status, 0);
      await writePng(join(proj, "frames", "frame_0001.png"), { blockSize: 20 });
      const r = runBaseline(
        ["verify", "--from-png", "frames/frame_0001.png", "--route", "menu", "--viewport", "desktop", "--output", "run"],
        proj,
      );
      assert.equal(r.status, 1, r.stdout + r.stderr);
      assert.match(r.stdout, /warn: 1 of 2 declared route\(s\) checked \(no PNG supplied for: hud\)/);
      // `hud` must not appear as a green row — it was never compared.
      assert.doesNotMatch(r.stdout, /hud\s+pass/);
      const md = await readFile(join(proj, "run", "summary.md"), "utf-8");
      assert.match(md, /\*\*Partial run\*\*: 1 of 2 declared route\(s\) checked/);
      assert.match(md, /\| `menu` \| desktop \| 4\.00% \| 1\.00% \| ❌ \|/);
      assert.doesNotMatch(md, /\| `hud` \|/);
    } finally {
      await rm(proj, { recursive: true, force: true });
    }
  });

  it("errors when --from-dir omits a declared route", async () => {
    const proj = await makeProject();
    try {
      await writePng(join(proj, "captures", "hud", "desktop.png"));
      await writePng(join(proj, "captures", "menu", "desktop.png"));
      assert.equal(runBaseline(["pin", "--from-dir", "captures"], proj).status, 0);
      await rm(join(proj, "captures", "menu"), { recursive: true });
      const r = runBaseline(["verify", "--from-dir", "captures", "--output", "run"], proj);
      assert.equal(r.status, 1);
      assert.match(r.stderr, /no PNG supplied for 1 declared route\/viewport pair/);
      assert.match(r.stderr, /menu\/desktop/);
    } finally {
      await rm(proj, { recursive: true, force: true });
    }
  });
});
