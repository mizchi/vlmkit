import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_NOISE_PIXELS,
  THRESHOLD_CEILING,
  THRESHOLD_FLOOR,
  buildGalleryHtml,
  buildGatesConfigSnippet,
  componentNameFromClass,
  deriveStoryThreshold,
  discoverStoryCandidates,
  type RawElement,
  type StoryCandidate,
} from "./story-scaffold.ts";

/** Minimal element, so each test only states the fields it is about. */
function element(partial: Partial<RawElement> & { className: string; index: number }): RawElement {
  return {
    depth: 1,
    width: 100,
    height: 40,
    ancestors: [],
    tagName: "div",
    outerHtml: `<div class="${partial.className}"></div>`,
    states: [],
    ...partial,
  };
}

const VIEWPORT = { width: 1280, height: 800 };

describe("deriveStoryThreshold", () => {
  it("is a pixel budget, so the tolerance in pixels does not grow with the component", () => {
    // The whole point. A ratio threshold lets a big component hide a change that
    // the same threshold catches on a small one.
    const button = deriveStoryThreshold(200 * 40);
    const hero = deriveStoryThreshold(1258 * 204);
    assert.ok(hero.threshold < button.threshold, "a larger component must get a tighter ratio");
    // Both admit roughly the same number of pixels, which is the invariant.
    assert.ok(Math.abs(button.threshold * 200 * 40 - DEFAULT_NOISE_PIXELS) < DEFAULT_NOISE_PIXELS);
  });

  it("catches the change a ratio default would miss on a hero", () => {
    // The measured case: a border-radius change on a 1258x204 hero moves ~0.1%
    // of its pixels, which passes check story's 0.5% default.
    const hero = 1258 * 204;
    const realChangeRatio = 0.001;
    assert.ok(realChangeRatio < THRESHOLD_CEILING, "premise: the gate default lets this through");
    assert.ok(
      realChangeRatio > deriveStoryThreshold(hero).threshold,
      "the derived threshold must flag it",
    );
  });

  it("never loosens past the gate's own default", () => {
    // A 20x20 icon: 24px is 6% of it. Deriving 0.06 here would quietly turn the
    // gate off for small components.
    const tiny = deriveStoryThreshold(20 * 20);
    assert.equal(tiny.threshold, THRESHOLD_CEILING);
    assert.match(tiny.reason, /kept the default/);
  });

  it("clamps at a floor, because zero tolerance fails on font hinting", () => {
    const huge = deriveStoryThreshold(4000 * 4000);
    assert.equal(huge.threshold, THRESHOLD_FLOOR);
    assert.match(huge.reason, /renderer-noise floor/);
  });

  it("honours an explicit budget", () => {
    const strict = deriveStoryThreshold(1000 * 1000, { noisePixels: 1000 });
    const loose = deriveStoryThreshold(1000 * 1000, { noisePixels: 4000 });
    assert.ok(loose.threshold > strict.threshold);
  });

  it("does not divide by zero", () => {
    assert.equal(deriveStoryThreshold(0).threshold, THRESHOLD_CEILING);
  });

  it("rounds to two significant figures, so a config holds a budget not a measurement", () => {
    const { threshold } = deriveStoryThreshold(25872);
    assert.equal(threshold, 0.00093);
  });
});

describe("componentNameFromClass", () => {
  it("strips the conventional prefixes", () => {
    assert.equal(componentNameFromClass("c-card"), "Card");
    assert.equal(componentNameFromClass("js-tooltip"), "Tooltip");
  });

  it("keeps multi-word names", () => {
    assert.equal(componentNameFromClass("c-data-table"), "DataTable");
  });

  it("drops BEM modifiers and elements — they are variants, not components", () => {
    assert.equal(componentNameFromClass("btn--ghost"), "Btn");
    assert.equal(componentNameFromClass("card__header"), "Card");
  });

  it("never returns an empty name", () => {
    // A class that is nothing but a prefix falls back to the prefix itself
    // rather than producing an unnameable story.
    assert.equal(componentNameFromClass("c-"), "C");
    assert.ok(componentNameFromClass("-").length > 0);
  });
});

describe("discoverStoryCandidates", () => {
  it("groups a BEM modifier as a variant of one component, not a second component", () => {
    const found = discoverStoryCandidates(
      [
        element({ className: "btn", index: 0 }),
        element({ className: "btn btn--ghost", index: 1 }),
      ],
      { viewport: VIEWPORT },
    );
    assert.deepEqual(found.map((c) => c.id), ["components/Btn/Default", "components/Btn/Ghost"]);
    // Both must share one selector, or a heal/diff pass on the component looks
    // at two different things.
    assert.deepEqual([...new Set(found.map((c) => c.selector))], [".btn"]);
  });

  it("turns a DOM state attribute into its own story", () => {
    // The "a story per named state" half of the handoff, derived rather than
    // remembered.
    const found = discoverStoryCandidates(
      [
        element({ className: "btn", index: 0 }),
        element({ className: "btn", index: 1, states: ["disabled"] }),
      ],
      { viewport: VIEWPORT },
    );
    assert.deepEqual(found.map((c) => c.variant).sort(), ["Default", "Disabled"]);
  });

  it("picks the shallowest instance as the exemplar", () => {
    // A nested repeat of a component is not the component.
    const found = discoverStoryCandidates(
      [
        element({ className: "c-card", index: 0, depth: 5, width: 50, outerHtml: "<nested/>" }),
        element({ className: "c-card", index: 1, depth: 2, width: 300, outerHtml: "<outer/>" }),
      ],
      { viewport: VIEWPORT },
    );
    assert.equal(found.length, 1);
    assert.equal(found[0]!.html, "<outer/>");
    assert.equal(found[0]!.instances, 2);
  });

  it("skips zero-sized elements, which cannot be screenshotted", () => {
    const found = discoverStoryCandidates(
      [element({ className: "c-hidden", index: 0, width: 0, height: 0 })],
      { viewport: VIEWPORT },
    );
    assert.deepEqual(found, []);
  });

  it("rejects a block larger than the viewport as page furniture", () => {
    const found = discoverStoryCandidates(
      [element({ className: "c-page", index: 0, width: 1280, height: 3000 })],
      { viewport: VIEWPORT },
    );
    assert.equal(found[0]!.recommended, false);
    assert.match(found[0]!.notes.join(" "), /page furniture/);
  });

  it("rejects a wrapper whose box is its only child's box", () => {
    // The measured case from the fixture: `.row` wraps `.c-hero` and has the
    // same box, so its baseline is a byte-identical duplicate that also reports
    // the hero's changes as its own.
    const found = discoverStoryCandidates(
      [
        element({
          className: "row",
          index: 0,
          depth: 1,
          width: 1216,
          height: 203,
          outerHtml: "<div class=row><div class=c-hero></div></div>",
        }),
        element({
          className: "c-hero",
          index: 1,
          depth: 2,
          width: 1216,
          height: 203,
          ancestors: [0],
          outerHtml: "<div class=c-hero></div>",
        }),
      ],
      { viewport: VIEWPORT },
    );
    const row = found.find((c) => c.component === "Row")!;
    const hero = found.find((c) => c.component === "Hero")!;
    assert.equal(row.recommended, false);
    assert.match(row.notes.join(" "), /same box as Hero/);
    assert.equal(hero.recommended, true, "the component itself must survive");
  });

  it("keeps a wrapper that is genuinely bigger than what it contains", () => {
    const found = discoverStoryCandidates(
      [
        element({ className: "c-toolbar", index: 0, depth: 1, width: 400, height: 60 }),
        element({ className: "c-avatar", index: 1, depth: 2, width: 40, height: 40, ancestors: [0] }),
      ],
      { viewport: VIEWPORT },
    );
    assert.equal(found.find((c) => c.component === "Toolbar")!.recommended, true);
  });

  it("attributes containment by element identity, not by markup", () => {
    // Two instances of a component can have byte-identical outerHTML; matching
    // on the HTML would credit containment to whichever was found first.
    const identical = "<span class=c-badge>New</span>";
    const found = discoverStoryCandidates(
      [
        element({ className: "c-panel", index: 0, depth: 1, width: 400, height: 200 }),
        element({ className: "c-badge", index: 1, depth: 2, width: 40, height: 20, ancestors: [0], outerHtml: identical }),
        element({ className: "c-badge", index: 2, depth: 2, width: 40, height: 20, ancestors: [0], outerHtml: identical }),
      ],
      { viewport: VIEWPORT },
    );
    assert.deepEqual(found.find((c) => c.component === "Panel")!.contains, ["Badge"]);
  });

  it("demotes a block that wraps three or more candidates", () => {
    const children = [1, 2, 3].map((index) =>
      element({ className: `c-child${index}`, index, depth: 2, width: 40, height: 20, ancestors: [0] })
    );
    const found = discoverStoryCandidates(
      [element({ className: "c-shell", index: 0, depth: 1, width: 500, height: 300 }), ...children],
      { viewport: VIEWPORT },
    );
    const shell = found.find((c) => c.component === "Shell")!;
    assert.equal(shell.recommended, false);
    assert.match(shell.notes.join(" "), /would report their changes too/);
  });

  it("restricts to --selector when given, and does not renumber ids", () => {
    const found = discoverStoryCandidates(
      [
        element({ className: "c-card", index: 0 }),
        element({ className: "c-alert", index: 1 }),
      ],
      { viewport: VIEWPORT, selectors: [".c-card"] },
    );
    assert.deepEqual(found.map((c) => c.id), ["components/Card/Default"]);
  });

  it("honours a story id prefix", () => {
    const found = discoverStoryCandidates([element({ className: "c-card", index: 0 })], {
      viewport: VIEWPORT,
      prefix: "src/ui",
    });
    assert.equal(found[0]!.id, "src/ui/Card/Default");
  });
});

describe("buildGalleryHtml", () => {
  const story = (partial: Partial<StoryCandidate> = {}): StoryCandidate => ({
    id: "components/Card/Default",
    component: "Card",
    variant: "Default",
    selector: ".c-card",
    html: "<div class=\"c-card\">hi</div>",
    width: 294,
    height: 88,
    instances: 1,
    threshold: 0.00093,
    thresholdReason: "budget",
    contains: [],
    recommended: true,
    notes: [],
    ...partial,
  });

  it("implements both halves of the gallery contract", () => {
    const html = buildGalleryHtml({ stories: [story()], css: ".c-card{color:red}" });
    assert.match(html, /window\.mount = async/);
    assert.match(html, /window\.unmount = async/);
    assert.match(html, /id="root"/);
  });

  it("inlines the captured CSS", () => {
    const html = buildGalleryHtml({ stories: [story()], css: ".c-card{color:red}" });
    assert.match(html, /\.c-card\{color:red\}/);
  });

  it("survives markup containing a closing script tag", () => {
    // Captured markup is exactly where a </script> shows up, and an unescaped
    // one ends the gallery's own script element.
    const html = buildGalleryHtml({
      stories: [story({ html: "<div><script>x</script></div>" })],
      css: "",
    });
    const body = html.slice(html.indexOf("const STORIES"));
    assert.ok(!body.slice(0, body.indexOf("\n")).includes("</script>"), "must not close the script early");
    assert.match(html, /\\u003c/);
  });

  it("pins each story to the width it had in the page", () => {
    // Otherwise a fluid component's box — and the threshold derived from it —
    // moves with whatever viewport the checker runs at.
    const html = buildGalleryHtml({ stories: [story({ width: 1216 })], css: "" });
    assert.match(html, /root\.style\.width = entry\.width \+ "px"/);
    assert.match(html, /"width":1216/);
  });

  it("emits a base href so relative asset URLs still resolve", () => {
    const html = buildGalleryHtml({
      stories: [story()],
      css: "",
      baseHref: "file:///tmp/site/index.html",
    });
    assert.match(html, /<base href="file:\/\/\/tmp\/site\/index\.html">/);
  });

  it("omits the base element when there is no source to anchor to", () => {
    assert.doesNotMatch(buildGalleryHtml({ stories: [story()], css: "" }), /<base /);
  });

  it("says plainly that props are ignored", () => {
    // The tradeoff of capturing markup instead of rendering components. A reader
    // who passes --props deserves to find out here rather than from a baseline
    // that never changes.
    assert.match(buildGalleryHtml({ stories: [story()], css: "" }), /accepted and ignored/);
  });
});

describe("buildGatesConfigSnippet", () => {
  it("gives every story its own invocation, because the thresholds differ", () => {
    const stories: StoryCandidate[] = [
      {
        id: "components/Button/Default",
        component: "Button",
        variant: "Default",
        selector: ".btn",
        html: "",
        width: 88,
        height: 36,
        instances: 2,
        threshold: 0.005,
        thresholdReason: "",
        contains: [],
        recommended: true,
        notes: [],
      },
      {
        id: "components/Hero/Default",
        component: "Hero",
        variant: "Default",
        selector: ".c-hero",
        html: "",
        width: 1216,
        height: 203,
        instances: 1,
        threshold: 0.0002,
        thresholdReason: "",
        contains: [],
        recommended: true,
        notes: [],
      },
    ];
    const snippet = buildGatesConfigSnippet(stories, "http://localhost:3000/gallery.html");
    assert.equal(snippet.pages.length, 2);
    assert.match(snippet.pages[0]!.gates[0]!, /--threshold 0\.005$/);
    assert.match(snippet.pages[1]!.gates[0]!, /--threshold 0\.0002$/);
    // `source` is the story id, because that is what the gate takes positionally.
    assert.equal(snippet.pages[1]!.source, "components/Hero/Default");
  });
});
