/**
 * A session recorded from the page's own events (as a person's clicks are) on fixtures/record/,
 * compiled to an @playwright/test spec, and run with Playwright's runner: it passes twice on the
 * page it was recorded on, and fails on a mutant whose button adds two items instead of one.
 */
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
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
      mkdirSync(join(repo, "test-results"), { recursive: true });
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

  it(
    "native open state, a multiple select, contenteditable, a held modifier, a field still focused at stop, and ids across a navigation",
    { timeout: 240_000 },
    async () => {
      const { withBrowser } = await import("@mizchi/vlmkit-core/browser-launch.ts");
      const trace = await withBrowser(async (browser) => {
        const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
        await page.goto(fixture("widgets.html"));
        const rec = new TraceRecorder(page, { recordedBy: "test" });
        await rec.start();
        await rec.listen();
        const done = async () => {
          await page.waitForTimeout(120);
          await rec.idle();
        };
        await page.getByText("More", { exact: true }).click();
        await done();
        await page.locator("#toppings").selectOption(["a", "c"]);
        await done();
        await page.locator("#notes").click();
        await page.keyboard.type("Glaze twice");
        await page.locator("#second").click();
        await done();
        await page.keyboard.press("Shift+Tab");
        await done();
        await page.getByRole("link", { name: "Next page" }).click();
        await page.waitForURL(/widgets-next\.html/);
        await done();
        await page.getByRole("button", { name: "Go" }).click();
        await done();
        await page.waitForTimeout(1600); // a navigation within 1.5s of an event is taken as that event's
        const back = page.waitForURL(/widgets\.html/);
        await page.goBack();
        await back;
        await page.waitForTimeout(1600);
        await page.locator("#last").click();
        await page.keyboard.type("fin");
        const t = await rec.stop(); // the field is still focused
        await page.close();
        return t;
      });
      mkdirSync(join(repo, "test-results"), { recursive: true });
      writeFileSync(join(repo, "test-results/record-widgets.trace.json"), JSON.stringify(trace, null, 2));
      const steps = trace.steps.map((s) => s.action);
      const find = (pred: (a: (typeof steps)[number]) => boolean, what: string) => {
        const i = steps.findIndex(pred);
        assert.ok(i >= 0, `${what}: ${JSON.stringify(steps, null, 1)}`);
        return trace.steps[i]!;
      };
      const opened = find((a) => a.action === "click" && a.target.describe.includes("More"), "details click");
      assert.ok(
        opened.expect.some((e) => e.kind === "state" && e.attr === "open" && e.value === "true"),
        `details opened: ${JSON.stringify(opened.expect)}`,
      );
      find((a) => a.action === "select" && JSON.stringify(a.value) === '["a","c"]', "both selected values");
      find((a) => a.action === "fill" && a.value === "Glaze twice", "contenteditable typed");
      find((a) => a.action === "press" && a.key === "Shift+Tab", "the held modifier");
      const go = find((a) => a.action === "click" && a.target.describe.includes("Go"), "a click after a navigation");
      assert.ok(
        go.expect.some((e) => e.kind === "text" && e.value === "went"),
        `the click on the next page is its own step: ${JSON.stringify(go.expect)}`,
      );
      find((a) => a.action === "fill" && a.value === "fin", "the field still focused at stop");

      const spec = compileTrace(trace, { title: "widgets session" });
      const run = runSpec(spec);
      assert.ok(run.passed, `${spec}\n${run.output}`);
    },
  );

  it("a window closed while a field holds an edit counts that edit as lost", { timeout: 60_000 }, async () => {
    const { withBrowser } = await import("@mizchi/vlmkit-core/browser-launch.ts");
    const lost = await withBrowser(async (browser) => {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      await page.goto(fixture("widgets.html"));
      const rec = new TraceRecorder(page, { recordedBy: "test" });
      await rec.start();
      await rec.listen();
      await page.locator("#last").click();
      await page.keyboard.type("gone");
      await page.close(); // at once: the page sent "typing" on the first input, before type() returned
      await rec.stop();
      return rec.lostSteps;
    });
    assert.equal(lost, 1);
  });

  it("a field the page clears on Enter, then typed in again, records the new edit", { timeout: 60_000 }, async () => {
    const { withBrowser } = await import("@mizchi/vlmkit-core/browser-launch.ts");
    const trace = await withBrowser(async (browser) => {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      await page.goto(fixture("app.html"));
      const rec = new TraceRecorder(page, { recordedBy: "test" });
      await rec.start();
      await rec.listen();
      await page.getByPlaceholder("New item").click();
      await page.keyboard.type("Teapot");
      await page.keyboard.press("Enter"); // the page adds the item and clears the field, focus stays
      await page.waitForTimeout(120);
      await rec.idle();
      await page.keyboard.type("b");
      const t = await rec.stop();
      await page.close();
      return t;
    });
    const fills = trace.steps.flatMap((s) => (s.action.action === "fill" ? [s.action.value] : []));
    assert.deepEqual(fills, ["Teapot", "b"], JSON.stringify(trace.steps.map((s) => s.action)));
  });
});
