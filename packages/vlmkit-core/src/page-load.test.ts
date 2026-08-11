/**
 * The shared page-load options, tested at the seam where they are *honoured*
 * rather than where they are parsed.
 *
 * Parsing tests alone are what let a flag exist and do nothing: `parse` returns
 * `{ timeout: 1234 }`, the gate declares `--timeout` in `--help`, and the
 * measurement module still calls `page.goto(url, { timeout: 30000 })`. So the
 * assertions below record the arguments actually handed to Playwright — a fake
 * `Page` is enough, and it keeps these tests browser-free and fast.
 */
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import type { Page } from "playwright";
import { UsageError } from "./cli-error.ts";
import {
  DEFAULT_PAGE_LOAD_TIMEOUT_MS,
  PAGE_LOAD_INPUTS,
  navigatePage,
  navigationOptions,
  parsePageLoad,
  pickPageLoad,
} from "./page-load.ts";

interface Recorded {
  goto: { url: string; options: unknown }[];
  har: { path: string; options: unknown }[];
  loadStates: string[];
}

/** The three calls `navigatePage` can make, and nothing else. */
function fakePage(): { page: Page; recorded: Recorded } {
  const recorded: Recorded = { goto: [], har: [], loadStates: [] };
  const page = {
    goto: async (url: string, options: unknown) => {
      recorded.goto.push({ url, options });
      return null;
    },
    routeFromHAR: async (path: string, options: unknown) => {
      recorded.har.push({ path, options });
    },
    waitForLoadState: async (state: string) => {
      recorded.loadStates.push(state);
    },
    evaluate: async () => undefined,
    waitForTimeout: async () => undefined,
  } as unknown as Page;
  return { page, recorded };
}

describe("parsePageLoad", () => {
  it("reads all three flags", () => {
    assert.deepEqual(
      parsePageLoad(["page.html", "--timeout", "90000", "--wait-until", "domcontentloaded", "--har", "rec.har"]),
      { timeout: 90000, waitUntil: "domcontentloaded", har: "rec.har" },
    );
  });

  it("returns absent keys, not undefined values", () => {
    // Spreading the result must never clobber a gate's own default with
    // `undefined` — `{...{timeout: undefined}}` does exactly that.
    const parsed = parsePageLoad(["page.html"]);
    assert.deepEqual(Object.keys(parsed), []);
  });

  it("rejects a wait state Playwright does not have", () => {
    assert.throws(
      () => parsePageLoad(["page.html", "--wait-until", "idle"]),
      (e: Error) => e instanceof UsageError && /must be one of domcontentloaded, load, networkidle/.test(e.message),
    );
  });

  it("rejects a non-numeric or zero timeout instead of producing NaN", () => {
    assert.throws(() => parsePageLoad(["page.html", "--timeout", "soon"]), UsageError);
    assert.throws(() => parsePageLoad(["page.html", "--timeout", "0"]), UsageError);
  });

  it("declares exactly the three inputs, with wait-until closed to real states", () => {
    assert.deepEqual(PAGE_LOAD_INPUTS.map((i) => i.name), ["timeout", "wait-until", "har"]);
    const waitUntil = PAGE_LOAD_INPUTS.find((i) => i.name === "wait-until")!;
    assert.deepEqual([...waitUntil.choices!], ["domcontentloaded", "load", "networkidle"]);
  });
});

describe("navigationOptions", () => {
  it("keeps the historical defaults when nothing was passed", () => {
    assert.deepEqual(navigationOptions({}), {
      waitUntil: "networkidle",
      timeout: DEFAULT_PAGE_LOAD_TIMEOUT_MS,
    });
  });

  it("honours a call site's own default milestone", () => {
    // `check interactions` / `scan handlers` / `verify flow` navigate at `load`
    // and settle afterwards. A single global default would have silently moved
    // them to networkidle — the state they were deliberately not using.
    assert.equal(navigationOptions({}, "load").waitUntil, "load");
    assert.equal(navigationOptions({ waitUntil: "domcontentloaded" }, "load").waitUntil, "domcontentloaded");
  });
});

describe("pickPageLoad", () => {
  it("carries the three keys and drops everything else", () => {
    assert.deepEqual(
      pickPageLoad({ timeout: 5, waitUntil: "load", har: "a.har", ...{ outputDir: "x" } } as never),
      { waitUntil: "load", timeout: 5, har: "a.har" },
    );
  });
});

describe("navigatePage reaches the browser call", () => {
  it("passes the caller's timeout and wait state to goto", async () => {
    const { page, recorded } = fakePage();
    await navigatePage(page, "http://localhost:5173/", { timeout: 90000, waitUntil: "domcontentloaded" });
    assert.deepEqual(recorded.goto, [{
      url: "http://localhost:5173/",
      options: { waitUntil: "domcontentloaded", timeout: 90000 },
    }]);
  });

  it("defaults to networkidle / 30s when the caller passed nothing", async () => {
    const { page, recorded } = fakePage();
    await navigatePage(page, "file:///tmp/page.html");
    assert.deepEqual(recorded.goto[0]!.options, { waitUntil: "networkidle", timeout: 30000 });
  });

  it("installs HAR replay before navigating, aborting un-recorded requests", async () => {
    // Order matters: routeFromHAR after goto would let the document request
    // itself escape to the network, which is the request that hangs.
    const { page, recorded } = fakePage();
    await navigatePage(page, "http://localhost:5173/", { har: "rec.har" });
    assert.deepEqual(recorded.har, [{ path: resolve("rec.har"), options: { notFound: "abort" } }]);
    assert.equal(recorded.goto.length, 1);
  });

  it("does not touch routeFromHAR when no HAR was given", async () => {
    const { page, recorded } = fakePage();
    await navigatePage(page, "file:///tmp/page.html", { timeout: 1000 });
    assert.deepEqual(recorded.har, []);
  });

  it("settles after a relaxed milestone, and not after the default one", async () => {
    // `--wait-until domcontentloaded` without a settle hands the gate the
    // pre-render DOM, which it then reports as a defect in the page. With the
    // default milestone nothing extra runs, so adopting the helper changes no
    // timings for existing callers.
    const relaxed = fakePage();
    await navigatePage(relaxed.page, "http://x/", { waitUntil: "domcontentloaded" });
    assert.deepEqual(relaxed.recorded.loadStates, ["networkidle"]);

    const dflt = fakePage();
    await navigatePage(dflt.page, "http://x/");
    assert.deepEqual(dflt.recorded.loadStates, []);
  });
});
