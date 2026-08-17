import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { classify, runTest } from "./runner.ts";

describe("classify", () => {
  it("detects locator failures", () => {
    assert.equal(classify("locator resolved to 0 elements"), "locator");
    assert.equal(classify('getByRole("button") ... waiting for'), "locator");
  });
  it("detects timeouts", () => {
    assert.equal(classify("Timeout 5000ms exceeded"), "timeout");
  });
  it("detects vlmkit diff failures", () => {
    assert.equal(classify("Error: Screenshot comparison failed"), "vrt-diff");
    assert.equal(classify("toHaveScreenshot() ... 1234 pixels differ"), "vrt-diff");
  });
  it("falls back to other", () => {
    assert.equal(classify("some other error"), "other");
  });
});

describe("runTest", () => {
  it("reports ok for a passing command", async () => {
    const r = await runTest('node -e "process.exit(0)"', process.cwd());
    assert.equal(r.ok, true);
  });
  it("reports not-ok for a failing command and captures output", async () => {
    const r = await runTest('node -e "console.error(\'boom\'); process.exit(1)"', process.cwd());
    assert.equal(r.ok, false);
    assert.match(r.stderr + r.stdout, /boom/);
  });
});
