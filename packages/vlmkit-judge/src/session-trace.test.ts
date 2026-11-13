import assert from "node:assert/strict";
import { describe, it } from "vite-plus/test";
import {
  compileTrace,
  diffObservations,
  locatorSource,
  parseSessionTrace,
  urlPath,
  type ObservedElement,
  type PageObservation,
  type SessionTrace,
} from "./session-trace.ts";

const el = (key: string, over: Partial<ObservedElement> = {}): ObservedElement => ({
  key,
  css: `#${key}`,
  visible: true,
  watched: false,
  interactive: false,
  states: {},
  ...over,
});
const page = (elements: ObservedElement[], over: Partial<PageObservation> = {}): PageObservation => ({
  url: "http://localhost/a",
  elements,
  ...over,
});

describe("diffObservations: what a step changed", () => {
  it("names a toggle's new state, a panel shown, a count changed and the URL", () => {
    const before = page([
      el("btn", { interactive: true, states: { "aria-expanded": "false" } }),
      el("panel", { watched: true, visible: false }),
      el("count", { text: "0" }),
    ]);
    const after = page(
      [
        el("btn", { interactive: true, states: { "aria-expanded": "true" } }),
        el("panel", { watched: true, visible: true }),
        el("count", { text: "1" }),
      ],
      { url: "http://localhost/a#open" },
    );
    assert.deepEqual(
      diffObservations(before, after).map((c) => [c.kind, "element" in c ? c.element.key : c.path]),
      [
        ["url", "/a#open"],
        ["state", "btn"],
        ["visible", "panel"],
        ["text", "count"],
      ],
    );
  });

  it("leaves out what changes between two reads after the step (a clock)", () => {
    const before = page([el("clock", { text: "10:00:00" }), el("count", { text: "0" })]);
    const after = page([el("clock", { text: "10:00:01" }), el("count", { text: "1" })]);
    const again = page([el("clock", { text: "10:00:02" }), el("count", { text: "1" })]);
    assert.deepEqual(
      diffObservations(before, after, again).map((c) => "element" in c && c.element.key),
      ["count"],
    );
  });

  it("a re-rendered element (same path and text, new key) is the same element", () => {
    const before = page([el("a", { css: "ul > li", text: "Milk" })]);
    const after = page([el("b", { css: "ul > li", text: "Milk" })]);
    assert.deepEqual(diffObservations(before, after), []);
  });

  it("an item added is visible, one removed is hidden; the step's own typed value is not an outcome", () => {
    const before = page([el("field", { value: "", interactive: true }), el("old", { text: "Eggs" })]);
    const after = page([el("field", { value: "Milk", interactive: true }), el("new", { text: "Milk" })]);
    assert.deepEqual(
      diffObservations(before, after, after, "field").map((c) => [c.kind, "element" in c && c.element.key]),
      [
        ["visible", "new"],
        ["hidden", "old"],
      ],
    );
  });

  it("focus moved elsewhere by the page is an outcome; focus on the clicked control is not", () => {
    const before = page([el("open"), el("close")], { focused: "open" });
    const after = page([el("open"), el("close")], { focused: "close" });
    assert.deepEqual(
      diffObservations(before, after, after, "open").map((c) => c.kind),
      ["focused"],
    );
    assert.deepEqual(diffObservations(page([el("x")]), page([el("x")], { focused: "x" }), undefined, "x"), []);
  });

  it("urlPath keeps path, query and hash; a file URL keeps its file name", () => {
    assert.equal(urlPath("https://shop.test/cart?x=1#top"), "/cart?x=1#top");
    assert.equal(urlPath("file:///home/u/site/index.html#done"), "index.html#done");
  });
});

const trace: SessionTrace = {
  format: "vlmkit-trace/1",
  source: { recordedBy: "vlmkit record", url: "http://localhost:3000/shop" },
  start: { url: "http://localhost:3000/shop", viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" },
  steps: [
    {
      action: {
        action: "click",
        target: { locators: [{ by: "role", role: "button", name: "Add to cart" }], describe: 'button "Add to cart"' },
      },
      expect: [
        {
          kind: "text",
          target: { locators: [{ by: "testid", value: "cart-count" }], describe: "cart count" },
          value: "1",
        },
      ],
    },
    {
      action: {
        action: "fill",
        target: { locators: [{ by: "label", value: "Coupon" }], describe: 'textbox "Coupon"' },
        value: 'SAVE"10',
      },
      expect: [{ kind: "url", path: "/shop?coupon=1" }],
    },
  ],
};

describe("compileTrace: a trace as an @playwright/test spec", () => {
  it("writes each action with its best locator and each observed change as an expect", () => {
    const src = compileTrace(trace, { title: "add to cart" });
    assert.match(src, /import \{ expect, test \} from "@playwright\/test";/);
    assert.match(src, /test\.use\(\{ viewport: \{ width: 1280, height: 800 \}, reducedMotion: "reduce" \}\);/);
    assert.match(src, /await page\.goto\("http:\/\/localhost:3000\/shop"\);/);
    assert.match(src, /page\.getByRole\("button", \{ name: "Add to cart", exact: true \}\)\.click\(\);/);
    assert.match(src, /expect\(page\.getByTestId\("cart-count"\)\)\.toHaveText\("1"\);/);
    assert.match(src, /page\.getByLabel\("Coupon", \{ exact: true \}\)\.fill\("SAVE\\"10"\);/);
    assert.match(src, /toHaveURL\(\/\\\/shop\\\?coupon=1\$\/\);/);
    assert.equal(compileTrace(trace, { title: "add to cart" }), src, "deterministic");
  });

  it("--base-url writes URLs under it as paths, for the project's baseURL", () => {
    assert.match(compileTrace(trace, { baseUrl: "http://localhost:3000" }), /await page\.goto\("\/shop"\);/);
  });

  it("every locator kind", () => {
    const t = (locators: never) => locatorSource({ locators, describe: "x" });
    assert.equal(t([{ by: "css", value: "main > p" }] as never), 'page.locator("main > p")');
    assert.equal(
      t([{ by: "placeholder", value: "Search" }] as never),
      'page.getByPlaceholder("Search", { exact: true })',
    );
    assert.equal(t([{ by: "text", value: "Done" }] as never), 'page.getByText("Done", { exact: true })');
  });

  it("parseSessionTrace refuses what is not a trace, by name", () => {
    assert.throws(() => parseSessionTrace("{}", "t.json"), /not a session trace/);
    assert.throws(
      () =>
        parseSessionTrace(JSON.stringify({ ...trace, steps: [{ action: { action: "click" }, expect: [] }] }), "t.json"),
      /step 1: click has no target locator/,
    );
    assert.equal(parseSessionTrace(JSON.stringify(trace), "t.json").steps.length, 2);
  });

  it("no trace value runs as code: a viewport must be numbers, and a line break cannot end a comment", () => {
    const viewport = { width: "1}); process.exit(1); ({a:1" as never, height: 800 };
    assert.throws(
      () => parseSessionTrace(JSON.stringify({ ...trace, start: { ...trace.start, viewport } }), "t.json"),
      /viewport needs whole-number width and height/,
    );
    const hostile: SessionTrace = {
      ...trace,
      source: { recordedBy: "x\nprocess.exit(1)", url: "http://a/\u2028process.exit(2)" },
      steps: [{ action: { action: "press", key: "Enter\r\nprocess.exit(3)" }, expect: [] }],
    };
    const src = compileTrace(hostile, { tracePath: "t.json\nprocess.exit(4)" });
    for (const line of src.split(/\r\n|[\n\r\u2028\u2029]/))
      if (line.includes("process.exit")) assert.match(line.trim(), /^\/\/|^await page\.keyboard\.press\(/, line);
  });
});

describe("diffObservations says each outcome once", () => {
  it("a dialog shown, not each line in it; a count, not the sentence around it; no old page after a navigation", () => {
    const before = page([
      el("d1-dlg", { watched: true, visible: false }),
      el("d1-btn", { within: "d1-dlg", visible: false, interactive: true }),
      el("d1-p", { css: "main > p", text: "Cart: 0" }),
      el("d1-n", { css: "main > p > span", text: "0" }),
    ]);
    const after = page([
      el("d1-dlg", { watched: true, visible: true }),
      el("d1-btn", { within: "d1-dlg", visible: true, interactive: true }),
      el("d1-p", { css: "main > p", text: "Cart: 1" }),
      el("d1-n", { css: "main > p > span", text: "1" }),
    ]);
    assert.deepEqual(
      diffObservations(before, after).map((c) => "element" in c && c.element.key),
      ["d1-dlg", "d1-n"],
    );
    const next = page([el("d2-h", { text: "Details", watched: false })], { url: "http://localhost/details" });
    assert.deepEqual(
      diffObservations(after, next).map((c) => c.kind),
      ["url", "visible"],
    );
  });
});
