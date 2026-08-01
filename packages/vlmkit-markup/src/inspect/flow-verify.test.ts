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

test("verify flow: force click reaches an aria-disabled control (does-nothing assertion)", { timeout: 120_000 }, async () => {
  const { mkdtemp, rm, writeFile } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const dir = await mkdtemp(join(tmpdir(), "flow-force-"));
  try {
    const page = join(dir, "page.html");
    await writeFile(page, `<!doctype html><body>
      <p id="counter">0</p>
      <button id="locked" aria-disabled="true">Locked</button>
      <script>
        document.getElementById("locked").addEventListener("click", (e) => {
          if (e.currentTarget.getAttribute("aria-disabled") === "true") return;
          document.getElementById("counter").textContent = "1";
        });
      </script></body>`);
    // Without force, Playwright's actionability refuses aria-disabled clicks.
    const strict = await runFlowVerify({ source: page, flow: {
      steps: [{ do: { action: "click", selector: "#locked" }, expect: [] }],
    } });
    assert.equal(strict.done, false);
    assert.ok(strict.steps[0]!.actionError);
    // With force, the click lands and the does-nothing post-condition holds.
    const forced = await runFlowVerify({ source: page, flow: {
      steps: [{
        do: { action: "click", selector: "#locked", force: true },
        expect: [{ assert: "text", selector: "#counter", contains: "0" }],
      }],
    } });
    assert.equal(forced.done, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
