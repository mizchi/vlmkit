import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runOutputDir } from "./arg-helpers.ts";

describe("runOutputDir", () => {
  it("gives two sources two directories, so one run cannot overwrite the other", () => {
    // Measured before this existed: `check a11y contrast` on two pages in a row wrote
    // `report.md` AND `page.png` into one folder, so the second silently replaced the
    // first. Same clobber v2 found in `check drift component` and fixed for drift only.
    const a = runOutputDir("a11y-contrast", "fixtures/page.html");
    const b = runOutputDir("a11y-contrast", "fixtures/dashboard.html");
    assert.notEqual(a, b);
    assert.match(a, /a11y-contrast[/\\]page-[0-9a-f]{8}$/);
    assert.match(b, /a11y-contrast[/\\]dashboard-[0-9a-f]{8}$/);
  });

  it("is stable across runs, so a re-run overwrites its own previous report", () => {
    // The point is not uniqueness per invocation — a caller comparing two runs of the
    // same check wants the same path both times.
    assert.equal(runOutputDir("g", "a.html"), runOutputDir("g", "a.html"));
  });

  it("separates two discriminators on one source", () => {
    // Two selectors on one page are two different runs; drift passes its --selector.
    assert.notEqual(
      runOutputDir("component-consistency", "a.html", ".card"),
      runOutputDir("component-consistency", "a.html", ".card:not(.card--featured)"),
    );
  });

  it("distinguishes two sources that share a basename", () => {
    // The readable half collides; the hash is what keeps them apart.
    const a = runOutputDir("g", "en/index.html");
    const b = runOutputDir("g", "ja/index.html");
    assert.notEqual(a, b);
    assert.match(a, /index-[0-9a-f]{8}$/);
  });

  it("keeps a URL source out of the path, since it is not a path component", () => {
    const dir = runOutputDir("g", "http://localhost:5173/app?x=1");
    assert.doesNotMatch(dir, /https?:/);
    assert.doesNotMatch(dir, /[?]/);
  });
});
