/**
 * The story-VRT loop, driven end to end against a real gallery in a real
 * browser.
 *
 * The parse-level checks live in `../gates/gates.test.ts` with the other gates'.
 * What needs a browser is the claim the feature exists for: that mounting one
 * story and screenshotting its root produces a small diff, that a change to one
 * component does not make its neighbour report, and that the
 * baseline → compare → approve loop actually closes. None of that is observable
 * without running it.
 *
 * It copies `examples/story-gallery/index.html` rather than writing its own
 * gallery, for two reasons: the example is what the docs tell readers to start
 * from, so a broken example fails a test here instead of a reader's first
 * attempt; and copying to a temp dir keeps baseline PNGs out of the checkout.
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";
import { type StoryVrtOptions, runStoryVrt, storySlug } from "./story-vrt.ts";

const here = dirname(fileURLToPath(import.meta.url));
const EXAMPLE = resolve(here, "../../../../examples/story-gallery/index.html");

describe("storySlug", () => {
  it("keeps the id readable while making it a safe path segment", () => {
    assert.equal(storySlug("components/Button/Primary"), "components-Button-Primary");
    assert.equal(storySlug("Button/Primary"), "Button-Primary");
  });

  it("never returns an empty segment", () => {
    // A slug of "" would write the baseline into the parent directory and make
    // two stories collide there.
    assert.equal(storySlug("///"), "story");
    assert.equal(storySlug(""), "story");
  });
});

describe("the shipped example gallery", () => {
  it("exists and implements the contract's two entry points", () => {
    assert.ok(existsSync(EXAMPLE), `${EXAMPLE} is missing`);
    const html = readFileSync(EXAMPLE, "utf8");
    assert.match(html, /window\.mount\s*=/, "gallery must define window.mount");
    assert.match(html, /window\.unmount\s*=/, "gallery must define window.unmount");
    assert.match(html, /id="root"/, "the contract renders into #root");
  });

  it("is byte-identical to the copy the component-vrt skill ships", () => {
    // The same gallery lives in two places for two reasons: `examples/` is a
    // runnable project, and the skill's `assets/` is what an agent copies into a
    // consumer repo. Only the example is exercised by the browser tests below,
    // so without this the skill's copy could rot into a broken template while
    // every test stayed green.
    const asset = resolve(here, "../../../../.claude/skills/component-vrt/assets/gallery.vanilla.html");
    assert.ok(existsSync(asset), `${asset} is missing`);
    assert.equal(
      readFileSync(asset, "utf8"),
      readFileSync(EXAMPLE, "utf8"),
      "the skill's gallery.vanilla.html has drifted from examples/story-gallery/index.html"
        + " — copy the example over it, then run `pnpm sync:skills`",
    );
  });
});

describe("story VRT against a real gallery", { timeout: 240_000 }, () => {
  let dir: string;
  let gallery: string;

  const options = (overrides: Partial<StoryVrtOptions> = {}): StoryVrtOptions => ({
    gallery,
    stories: ["components/Button/Primary"],
    viewport: { width: 800, height: 600 },
    threshold: 0.005,
    updateBaseline: false,
    outputDir: join(dir, "baselines"),
    root: "#root",
    settleMs: 0,
    ...overrides,
  });

  before(() => {
    dir = mkdtempSync(join(tmpdir(), "vlmkit-story-"));
    cpSync(EXAMPLE, join(dir, "index.html"));
    gallery = pathToFileURL(join(dir, "index.html")).href;
  });

  after(() => rmSync(dir, { recursive: true, force: true }));

  it("captures the component, not the viewport", async () => {
    const report = await runStoryVrt(options({ stories: ["components/Button/Primary", "Card/Default"] }));
    assert.deepEqual(report.results.map((r) => r.outcome), ["new-baseline", "new-baseline"]);

    // The whole point of the feature, asserted rather than claimed: a button is
    // a few thousand pixels, an 800x600 viewport is 480,000.
    const [button, card] = report.results;
    assert.ok(button!.width! < 200 && button!.height! < 60, `button was ${button!.width}x${button!.height}`);
    assert.ok(card!.width! > button!.width!, "the card should be wider than the button");
    assert.ok(
      report.storyPixels * 20 < report.pagePixels,
      `expected >20x smaller, got ${report.pagePixels / report.storyPixels}x`,
    );
  });

  it("reports unchanged on a second run, then drift after an edit — without cascading", async () => {
    // Baselines from the previous case are reused deliberately: the sequence IS
    // the loop being tested.
    const clean = await runStoryVrt(options({ stories: ["components/Button/Primary", "Card/Default"] }));
    assert.deepEqual(clean.results.map((r) => r.outcome), ["unchanged", "unchanged"]);

    // Change only the button's padding.
    const html = readFileSync(join(dir, "index.html"), "utf8");
    writeFileSync(join(dir, "index.html"), html.replace("padding: 10px 18px;", "padding: 14px 18px;"));

    const dirty = await runStoryVrt(options({ stories: ["components/Button/Primary", "Card/Default"] }));
    const [button, card] = dirty.results;
    assert.equal(button!.outcome, "changed");
    assert.ok(button!.diffRatio! > 0.005, `diffRatio was ${button!.diffRatio}`);
    // No cascade. This is what a full-page diff cannot give you: the component
    // that did not change reports clean even though the stylesheet did change.
    assert.equal(card!.outcome, "unchanged", "an unrelated story must not report drift");
    assert.ok((button!.regions ?? []).length > 0, "a drifting story should name at least one region");
  });

  it("closes the loop with --update-baseline", async () => {
    const updated = await runStoryVrt(options({ updateBaseline: true }));
    assert.equal(updated.results[0]!.outcome, "updated");
    const after = await runStoryVrt(options());
    assert.equal(after.results[0]!.outcome, "unchanged");
  });

  it("reports a rejected mount as its own outcome, carrying the gallery's message", async () => {
    // Not a pass and not a drift: nothing was measured. The gallery's rejection
    // message is the actionable part, so it has to survive to the report.
    const report = await runStoryVrt(options({ stories: ["components/Button/Primry"] }));
    assert.equal(report.results[0]!.outcome, "mount-failed");
    assert.match(report.results[0]!.error!, /unknown story/);
    assert.equal(report.results[0]!.width, undefined, "nothing should be reported as measured");
  });

  it("says so when the page is not a gallery at all", async () => {
    writeFileSync(join(dir, "bare.html"), '<!doctype html><div id="root"></div>');
    const report = await runStoryVrt(options({
      gallery: pathToFileURL(join(dir, "bare.html")).href,
      stories: ["anything"],
    }));
    assert.equal(report.results[0]!.outcome, "mount-failed");
    assert.match(report.results[0]!.error!, /does not define window\.mount/);
  });

  it("passes props through to the story", async () => {
    // Same story, different props, so a props-driven size change proves the
    // props actually reached the component rather than being dropped.
    const short = await runStoryVrt(options({
      stories: ["components/Button/Ghost"],
      props: { title: "OK" },
      updateBaseline: true,
    }));
    const long = await runStoryVrt(options({
      stories: ["components/Button/Ghost"],
      props: { title: "A considerably longer label" },
      updateBaseline: true,
    }));
    assert.ok(
      long.results[0]!.width! > short.results[0]!.width!,
      `expected the longer label to render wider: ${short.results[0]!.width} vs ${long.results[0]!.width}`,
    );
  });
});
