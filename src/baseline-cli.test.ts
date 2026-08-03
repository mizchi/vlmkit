import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { archiveRouteBaselines } from "./baseline-cli.ts";

const BASELINE_CLI = resolve(fileURLToPath(import.meta.url), "..", "baseline-cli.ts");

function runBaseline(args: string[], cwd: string): { stdout: string; stderr: string; status: number } {
  const r = spawnSync(
    process.execPath,
    ["--experimental-strip-types", BASELINE_CLI, ...args],
    { encoding: "utf-8", cwd, env: { ...process.env, NO_COLOR: "1" } },
  );
  return { stdout: r.stdout ?? "", stderr: r.stderr ?? "", status: r.status ?? 1 };
}

describe("archiveRouteBaselines", () => {
  it("moves existing PNGs into _history/<timestamp>/ and returns the count", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vlmkit-archive-"));
    try {
      const routeDir = join(dir, "home");
      await mkdir(routeDir, { recursive: true });
      await writeFile(join(routeDir, "desktop.png"), "a");
      await writeFile(join(routeDir, "mobile.png"), "b");

      const n = await archiveRouteBaselines(routeDir, "2026-06-08T00-00-00-000Z");
      assert.equal(n, 2);
      assert.ok(existsSync(join(routeDir, "_history", "2026-06-08T00-00-00-000Z", "desktop.png")));
      assert.ok(existsSync(join(routeDir, "_history", "2026-06-08T00-00-00-000Z", "mobile.png")));
      // Originals moved, not copied.
      assert.ok(!existsSync(join(routeDir, "desktop.png")));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("is a no-op for a route with no baselines", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vlmkit-archive-"));
    try {
      const n = await archiveRouteBaselines(join(dir, "missing"), "ts");
      assert.equal(n, 0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("vlmkit baseline approve", () => {
  it("writes a selector approval rule with audit fields", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vlmkit-approve-"));
    try {
      const r = runBaseline(
        [
          "approve",
          "--selector", ".hero__body",
          "--reason", "sub-pixel AA",
          "--max-px", "2",
          "--expires", "2026-08-15",
          "--acknowledged-by", "mizchi",
        ],
        dir,
      );
      assert.equal(r.status, 0, r.stderr);
      const manifest = JSON.parse(await readFile(join(dir, "approval.json"), "utf-8"));
      assert.equal(manifest.rules.length, 1);
      assert.equal(manifest.rules[0].selector, ".hero__body");
      assert.equal(manifest.rules[0].tolerance.pixels, 2);
      assert.equal(manifest.rules[0].acknowledgedBy, "mizchi");
      assert.equal(manifest.rules[0].expires, "2026-08-15");
      assert.ok(manifest.rules[0].createdAt);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("--dry-run prints the manifest without writing", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vlmkit-approve-"));
    try {
      const r = runBaseline(
        ["approve", "--selector", ".x", "--reason", "r", "--dry-run"],
        dir,
      );
      assert.equal(r.status, 0, r.stderr);
      assert.match(r.stdout, /dry-run/);
      assert.match(r.stdout, /"selector": "\.x"/);
      assert.ok(!existsSync(join(dir, "approval.json")));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("appends to an existing manifest", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vlmkit-approve-"));
    try {
      await writeFile(
        join(dir, "approval.json"),
        JSON.stringify({ rules: [{ selector: ".old", reason: "existing" }] }),
      );
      const r = runBaseline(["approve", "--selector", ".new", "--reason", "fresh"], dir);
      assert.equal(r.status, 0, r.stderr);
      const manifest = JSON.parse(await readFile(join(dir, "approval.json"), "utf-8"));
      assert.equal(manifest.rules.length, 2);
      assert.deepEqual(manifest.rules.map((x: { selector: string }) => x.selector).sort(), [".new", ".old"]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("writes a region-bbox approval rule", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vlmkit-approve-"));
    try {
      const r = runBaseline(
        [
          "approve",
          "--region", "x=120,y=80,w=200,h=40,viewport=mobile",
          "--reason", "marquee; intentionally dynamic",
        ],
        dir,
      );
      assert.equal(r.status, 0, r.stderr);
      const manifest = JSON.parse(await readFile(join(dir, "approval.json"), "utf-8"));
      assert.deepEqual(manifest.rules[0].region, {
        x: 120, y: 80, width: 200, height: 40, viewport: "mobile",
      });
      assert.equal(manifest.rules[0].selector, undefined);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("errors without --selector / --region", () => {
    const r = runBaseline(["approve", "--reason", "r"], tmpdir());
    assert.equal(r.status, 1);
    assert.match(r.stderr, /--selector or --region/);
  });
});
