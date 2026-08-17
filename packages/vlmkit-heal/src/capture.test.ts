import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findErrorContext, findActualScreenshot } from "./capture.ts";

describe("capture", () => {
  it("finds error-context.md in a PARENT test-results dir (not just cwd)", () => {
    const pkg = mkdtempSync(join(tmpdir(), "heal-cap-"));
    const fixtures = join(pkg, "fixtures");
    mkdirSync(fixtures, { recursive: true });
    // Playwright wrote the artifact one level up from the cwd (fixtures).
    const out = join(pkg, "test-results", "x-chromium");
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, "error-context.md"), '# Page snapshot\n- button "Submit"');

    const ctx = findErrorContext(fixtures);
    assert.ok(ctx?.includes('button "Submit"'), "should locate the parent-dir snapshot");
  });

  it("returns undefined when no artifacts exist", () => {
    const empty = mkdtempSync(join(tmpdir(), "heal-cap-empty-"));
    assert.equal(findActualScreenshot(empty), undefined);
    assert.equal(findErrorContext(empty), undefined);
  });

  it("auto-detects a non-default outputDir (e.g. Playwright's e2e-results)", () => {
    const cwd = mkdtempSync(join(tmpdir(), "heal-cap-e2e-"));
    const out = join(cwd, "e2e-results", "t-chromium");
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, "error-context.md"), '# Page snapshot\n- navigation "Map controls"');
    // No outputDir arg: should still find it by trying common names.
    assert.ok(findErrorContext(cwd)?.includes('"Map controls"'));
  });

  it("honors an explicit outputDir name", () => {
    const cwd = mkdtempSync(join(tmpdir(), "heal-cap-custom-"));
    const out = join(cwd, "pw-out", "t-chromium");
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, "error-context.md"), "# Page snapshot\n- button");
    assert.equal(findErrorContext(cwd), undefined); // not a known name
    assert.ok(findErrorContext(cwd, "pw-out")?.includes("Page snapshot"));
  });
});
