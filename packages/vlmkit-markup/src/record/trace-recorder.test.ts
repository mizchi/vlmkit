/**
 * A session recorded from the page's own events (as a person's clicks are) on fixtures/record/,
 * compiled to an @playwright/test spec, and run with Playwright's runner: it passes twice on the
 * page it was recorded on, and fails on a mutant whose button adds two items instead of one.
 */
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, it } from "vite-plus/test";
import { compileTrace, type SessionTrace } from "@mizchi/vlmkit-judge/session-trace.ts";
import { runSpec } from "./run-spec.ts";
import { TraceRecorder } from "./trace-recorder.ts";

const repo = join(import.meta.dirname, "../../../..");
const fixture = (name: string) => pathToFileURL(join(repo, "fixtures/record", name)).href;

async function recordSession(): Promise<SessionTrace> {
  const { withBrowser } = await import("@mizchi/vlmkit-core/browser-launch.ts");
  return withBrowser(async (browser) => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(fixture("app.html"));
    const rec = new TraceRecorder(page, { recordedBy: "test" });
    await rec.start();
    await rec.listen();
    const done = async () => {
      await page.waitForTimeout(120);
      await rec.idle();
    };
    await page.getByRole("button", { name: "Menu" }).click();
    await done();
    await page.getByRole("button", { name: "Add to cart" }).click();
    await done();
    await page.getByRole("button", { name: "Add to cart" }).click();
    await done();
    await page.locator("#email").click();
    await page.keyboard.type("a@b.test");
    await page.locator("#plan").selectOption("pro"); // the email field's change fires as focus leaves it
    await done();
    await page.locator("#sub").check();
    await done();
    await page.getByRole("button", { name: "Sign up" }).click();
    await done();
    await page.getByPlaceholder("New item").click();
    await page.keyboard.type("Teapot");
    await page.keyboard.press("Enter");
    await done();
    await page.getByRole("button", { name: "Clear list" }).click();
    await done();
    await page.getByRole("button", { name: "Remove" }).click();
    await done();
    await page.getByRole("link", { name: "Details" }).click();
    await page.waitForURL(/details\.html/);
    await done();
    const trace = await rec.stop();
    await page.close();
    return trace;
  });
}

describe("record a session from the page's events and replay it with @playwright/test", () => {
  it(
    "records each step with what it changed, passes on its page twice, and fails on a mutant",
    { timeout: 240_000 },
    async () => {
      const trace = await recordSession();
      writeFileSync(join(repo, "test-results/record-e2e.trace.json"), JSON.stringify(trace, null, 2)); // to read when it fails
      const actions = trace.steps.map((s) => s.action.action);
      assert.deepEqual(
        actions,
        ["click", "click", "click", "fill", "select", "check", "click", "fill", "press", "click", "click", "click"],
        JSON.stringify(
          trace.steps.map((s) => s.action),
          null,
          1,
        ),
      );
      const kinds = (i: number) => trace.steps[i]!.expect.map((e) => e.kind);
      assert.ok(kinds(0).includes("state") && kinds(0).includes("visible"), `menu: ${kinds(0)}`);
      assert.ok(
        trace.steps[1]!.expect.some((e) => e.kind === "text" && e.value === "1"),
        "the cart shows 1",
      );
      assert.ok(
        trace.steps[2]!.expect.some((e) => e.kind === "text" && e.value === "2"),
        "then 2",
      );
      assert.ok(kinds(6).includes("url") && kinds(6).includes("visible"), `sign up: ${kinds(6)}`);
      assert.ok(kinds(8).includes("visible"), `enter adds an item: ${kinds(8)}`);
      assert.ok(kinds(9).includes("visible") && kinds(9).includes("focused"), `clear opens the dialog: ${kinds(9)}`);
      assert.ok(kinds(10).includes("hidden"), `remove closes it: ${kinds(10)}`);
      assert.ok(kinds(11).includes("url"), `the link navigates: ${kinds(11)}`);
      const clock = JSON.stringify(trace).includes('"#clock"');
      assert.equal(clock, false, "the ticking clock is never an expectation");

      const spec = compileTrace(trace, { title: "shop session" });
      for (const round of [1, 2]) {
        const run = runSpec(spec);
        assert.ok(run.passed, `run ${round}:\n${run.output}`);
      }
      const broken = runSpec(spec.replaceAll("fixtures/record/app.html", "fixtures/record/app--broken.html"));
      assert.equal(broken.passed, false, "the mutant adds two to the cart and must fail");
      assert.match(broken.output, /cart-count|toHaveText/);
    },
  );
});
