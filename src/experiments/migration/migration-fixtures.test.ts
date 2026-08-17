import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { discoverViewports } from "@mizchi/vlmkit-capture/viewport-discovery.ts";
import { parseMigrationBlindManifest, selectMigrationBlindScenario } from "./migration-blind.ts";

const MIGRATION_DIR = join(import.meta.dirname!, "..", "..", "..", "fixtures", "migration");

describe("migration fixture inventory", () => {
  it("includes the planned phase-1 fixture directories", async () => {
    const entries = await readdir(MIGRATION_DIR, { withFileTypes: true });
    const directories = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b));

    assert.deepEqual(directories, [
      "region-diff-handoff",
      "reset-css",
      "shadcn-to-luna",
      "tailwind-to-vanilla",
    ]);
  });
});

describe("region-diff-handoff dogfood fixture", () => {
  it("keeps the DOM stable while changing the primary CTA paint", async () => {
    const beforeHtml = await readFile(join(MIGRATION_DIR, "region-diff-handoff", "before.html"), "utf-8");
    const afterHtml = await readFile(join(MIGRATION_DIR, "region-diff-handoff", "after.html"), "utf-8");

    assert.match(beforeHtml, /<main class="launch-panel">/);
    assert.match(afterHtml, /<main class="launch-panel">/);
    assert.match(beforeHtml, /<button class="cta" type="button">Start review<\/button>/);
    assert.match(afterHtml, /<button class="cta" type="button">Start review<\/button>/);
    assert.match(beforeHtml, /\.cta\s*\{[^}]*background:\s*#2d69ec/s);
    assert.match(afterHtml, /\.cta\s*\{[^}]*background:\s*#f04b4b/s);
  });
});

describe("tailwind-to-vanilla breakpoint discovery", () => {
  it("covers 768px and 1024px boundaries", async () => {
    const html = await readFile(join(MIGRATION_DIR, "tailwind-to-vanilla", "after.html"), "utf-8");
    const result = discoverViewports(html, { includeStandard: false, randomSamples: 0 });
    const widths = result.viewports.map((viewport) => viewport.width);

    assert.ok(widths.includes(767), "should include 768px boundary below");
    assert.ok(widths.includes(768), "should include 768px boundary at");
    assert.ok(widths.includes(1023), "should include 1024px boundary below");
    assert.ok(widths.includes(1024), "should include 1024px boundary at");
  });
});

describe("shadcn-to-luna fixture", () => {
  it("provides before/after HTML with target styles for migration compare", async () => {
    const beforeHtml = await readFile(join(MIGRATION_DIR, "shadcn-to-luna", "before.html"), "utf-8");
    const afterHtml = await readFile(join(MIGRATION_DIR, "shadcn-to-luna", "after.html"), "utf-8");
    const blindHtml = await readFile(join(MIGRATION_DIR, "shadcn-to-luna", "after-blind.html"), "utf-8");

    assert.match(beforeHtml, /<style id="target-css">/);
    assert.match(afterHtml, /<style id="target-css">/);
    assert.match(blindHtml, /<style id="target-css">/);
    assert.match(beforeHtml, /Command Center/);
    assert.match(afterHtml, /Command Center/);
    assert.match(blindHtml, /Command Center/);
    assert.match(beforeHtml, /Review dialog/);
    assert.match(afterHtml, /Review dialog/);
    assert.match(blindHtml, /Review dialog/);
  });
});

describe("blind migration scenarios", () => {
  it("declares reproducible reset-css and shadcn blind scenarios", async () => {
    const raw = await readFile(join(MIGRATION_DIR, "blind-scenarios.json"), "utf-8");
    const manifest = parseMigrationBlindManifest(raw);

    const resetScenario = selectMigrationBlindScenario(manifest, "reset-css-modern-normalize");
    const shadcnScenario = selectMigrationBlindScenario(manifest, "shadcn-to-luna");

    assert.ok(resetScenario);
    assert.ok(shadcnScenario);
    assert.equal(resetScenario?.blindTarget, "modern-normalize-blind.html");
    assert.equal(shadcnScenario?.blindTarget, "after-blind.html");
    assert.equal(resetScenario?.successCriteria.maxRounds, 3);
    assert.equal(shadcnScenario?.successCriteria.maxDiffRatio, 0.01);
  });
});
