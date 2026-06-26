import { describe, it } from "node:test";
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
});
