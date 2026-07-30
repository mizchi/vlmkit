import assert from "node:assert";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { runFlowVerify, type Flow } from "./flow-verify.ts";

const REPO_ROOT = fileURLToPath(new URL("../../../..", import.meta.url));
const FIXTURE = join(REPO_ROOT, "fixtures/auto-markup-proof/interactive/reference.html");

test("verify flow: a satisfied disclosure + switch flow reaches DONE", { timeout: 120_000 }, async () => {
  const flow: Flow = {
    steps: [
      { label: "open shipping", do: { action: "click", selector: "#shipping-toggle" },
        expect: [
          { assert: "attr", selector: "#shipping-toggle", name: "aria-expanded", equals: "true" },
          { assert: "visible", selector: "#shipping-panel" },
        ] },
      { label: "toggle marketing switch", do: { action: "click", selector: "#marketing-switch" },
        expect: [{ assert: "attr", selector: "#marketing-switch", name: "aria-checked", equals: "true" }] },
    ],
  };
  const report = await runFlowVerify({ source: FIXTURE, flow });
  assert.equal(report.done, true);
  assert.equal(report.passed, 2);
});

test("verify flow: an unmet post-condition FAILS and stops at that step", { timeout: 120_000 }, async () => {
  const flow: Flow = {
    steps: [
      { label: "wrong expectation", do: { action: "click", selector: "#shipping-toggle" },
        expect: [{ assert: "attr", selector: "#shipping-toggle", name: "aria-expanded", equals: "false" }] },
      { label: "never reached", do: { action: "click", selector: "#marketing-switch" } },
    ],
  };
  const report = await runFlowVerify({ source: FIXTURE, flow });
  assert.equal(report.done, false);
  assert.equal(report.steps.length, 1); // stopped at the first failure
  assert.equal(report.steps[0]!.assertions[0]!.passed, false);
  assert.equal(report.steps[0]!.assertions[0]!.actual, "true"); // it actually expanded
});

test("verify flow: focused / text / count assertions", { timeout: 120_000 }, async () => {
  const flow: Flow = {
    steps: [
      { do: { action: "focus", selector: "#shipping-toggle" }, expect: [{ assert: "focused", selector: "#shipping-toggle" }] },
      { do: { action: "wait", ms: 1 }, expect: [
        { assert: "text", selector: "#shipping-toggle", contains: "Shipping" },
        { assert: "count", selector: '[role="tab"]', equals: 3 },
      ] },
    ],
  };
  const report = await runFlowVerify({ source: FIXTURE, flow });
  assert.equal(report.done, true);
});
