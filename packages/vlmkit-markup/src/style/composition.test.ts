import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
  COLLECT_COMPOSITION,
  formatCompositionReport,
  judgeComposition,
  measureHierarchy,
  measureProximity,
  measureRails,
  measureSeparation,
  parseCompositionAllowRules,
  type CompositionBox,
  type CompositionInput,
} from "./composition.ts";

/** Colour codes out, so an assertion on the prose is not an assertion on the palette. */
const plain = (text: string): string => text.replace(/\u001B\[[0-9;]*m/g, "");

let nextIndex = 0;
/**
 * One box. Defaults are a plain in-flow block that paints no boundary, because
 * that is the shape every proximity assertion needs; a test that cares about a
 * card's border says so.
 */
const box = (over: Partial<CompositionBox> = {}): CompositionBox => ({
  i: nextIndex++,
  parent: -1,
  selector: `div.b${nextIndex}`,
  tag: "div",
  heading: 0,
  x: 0, y: 0, w: 600, h: 20,
  position: "static",
  fontSize: 16, fontWeight: 400,
  bg: "rgba(0, 0, 0, 0)",
  border: 0, radius: 0,
  textLen: 10,
  leaf: true,
  ...over,
});

/** Re-index a hand-written tree so `i` matches array position, as the collector guarantees. */
const tree = (boxes: CompositionBox[]): CompositionBox[] =>
  boxes.map((b, i) => ({ ...b, i }));

const input = (boxes: CompositionBox[], width = 1280): CompositionInput => ({
  boxes: tree(boxes),
  viewport: { width, height: 900 },
});

/**
 * The canonical shape: a stack of sections, each a heading followed by two
 * paragraphs. `gapAbove`/`gapBelow` set the two numbers the rule compares.
 */
function sections(opts: { gapAbove: number; gapBelow: number; count?: number }): CompositionBox[] {
  const { gapAbove, gapBelow, count = 2 } = opts;
  const boxes: CompositionBox[] = [box({ parent: -1, selector: "div.shell", tag: "div", y: 0, h: 2000, textLen: 500, leaf: false })];
  let y = 0;
  for (let s = 0; s < count; s++) {
    y += gapAbove;
    const sectionIndex = boxes.length;
    const sectionTop = y;
    boxes.push(box({ parent: 0, selector: `section.s${s}`, tag: "section", y: sectionTop, h: 0, textLen: 200, leaf: false }));
    // Heading flush with its section, so the boundary above comes from the
    // section's previous sibling — the margin-collapse shape.
    boxes.push(box({
      parent: sectionIndex, selector: `section.s${s}>h2`, tag: "h2", heading: 2,
      y: sectionTop, h: 30, fontSize: 26, textLen: 12,
    }));
    y = sectionTop + 30 + gapBelow;
    boxes.push(box({ parent: sectionIndex, selector: `section.s${s}>p.a`, tag: "p", y, h: 40, textLen: 80 }));
    y += 40 + 10;
    boxes.push(box({ parent: sectionIndex, selector: `section.s${s}>p.b`, tag: "p", y, h: 40, textLen: 80 }));
    y += 40;
    boxes[sectionIndex] = { ...boxes[sectionIndex]!, h: y - sectionTop };
  }
  return boxes;
}

/**
 * A container whose four children sit on two left rails 5px apart — the
 * minimum shape that makes `rail-near-miss` fire, for tests about something
 * else that also need an info row.
 *
 * It brings its OWN container rather than hanging the blocks off `sections()`'s
 * shell, because the rule requires two siblings on the two rails and siblings
 * of the sections join the proximity stack: four blocks at y=0 under the shell
 * silently moved every heading's boundary and took the inversion these tests
 * pair the info row with down to zero judged labels.
 *
 * `at` is where the container lands in the box array, so its children can name
 * it as their parent.
 */
function railSplit(at: number): CompositionBox[] {
  const wide = (x: number, selector: string, y: number) =>
    box({ parent: at, selector, x, w: 800, y, h: 50 });
  return [
    box({ parent: -1, selector: "div.rails", x: 0, w: 1280, y: 3000, h: 400, leaf: false }),
    wide(232, "section.p", 3000), wide(232, "section.q", 3100),
    wide(237, "section.r", 3200), wide(237, "section.s", 3300),
  ];
}

describe("measureProximity", () => {
  it("passes a label that is closer to what it labels than to the block above", () => {
    const { labels } = measureProximity(tree(sections({ gapAbove: 40, gapBelow: 10 })));
    // One judged, not two: the FIRST section's heading has no preceding sibling
    // anywhere up its chain, so nothing could mis-group with it. See
    // "does not judge the first label on the page".
    assert.equal(labels.length, 1);
    assert.equal(labels.filter((l) => l.inverted).length, 0);
    assert.equal(labels[0]!.before, 40);
    assert.equal(labels[0]!.after, 10);
  });

  it("does not judge the first label on the page", () => {
    // Its container's padding-top is not a boundary it could be mis-grouped
    // with — comparing that against the gap below it compares two unlike
    // things. On the live corpus this reported w3c-apg's page title (4.7px of
    // `main` padding vs 27.5px to the body) and nngroup's footer heading.
    const { labels, unjudged } = measureProximity(tree(sections({ gapAbove: 40, gapBelow: 10 })));
    assert.ok(!labels.some((l) => l.selector === "section.s0>h2"));
    assert.ok(unjudged.some((u) => u.selector === "section.s0>h2"));
  });

  it("reports a label that is closer to the block above than to its own content", () => {
    const { labels } = measureProximity(tree(sections({ gapAbove: 12, gapBelow: 44 })));
    const inverted = labels.filter((l) => l.inverted);
    assert.ok(inverted.length >= 1);
    assert.equal(inverted[0]!.before, 12);
    assert.equal(inverted[0]!.after, 44);
  });

  it("names the block the label is being pulled toward", () => {
    const { labels } = measureProximity(tree(sections({ gapAbove: 12, gapBelow: 44 })));
    // The boundary is the PREVIOUS SECTION, reached by climbing out of the
    // heading's own section — the climb this rule exists for.
    assert.match(labels.find((l) => l.inverted)!.boundary, /section\.s0|div\.shell/);
  });

  it("climbs through a wrapper the label is flush with, instead of giving up", () => {
    // Regression: margin collapsing puts an unbounded <section>'s border box
    // exactly on its first heading, so "distance to the parent's top edge" is 0
    // and the ratio test goes vacuous. Declining to judge made
    // fixtures/composition/proximity-broken.html report COMPOSED with zero
    // labels judged, on a page whose every heading had visibly drifted.
    const boxes = tree(sections({ gapAbove: 12, gapBelow: 44 }));
    const { labels } = measureProximity(boxes);
    assert.ok(labels.length > 0, "the flush heading must still be judged");
    // The boundary is the PREVIOUS SECTION, found by climbing out of this
    // heading's own flush section rather than by giving up.
    assert.equal(labels[0]!.before, 12);
    assert.equal(labels[0]!.after, 44);
  });

  it("does not judge a label opening a box that paints its own boundary", () => {
    // A card with a border has already grouped its contents: nothing above the
    // heading is inside the card, so no gap can mis-group it.
    const boxes = tree([
      box({ parent: -1, selector: "div.shell", y: 0, h: 400, leaf: false, textLen: 300 }),
      box({ parent: 0, selector: "div.a", y: 0, h: 100 }),
      box({ parent: 0, selector: "div.card", y: 140, h: 200, border: 1, radius: 12, leaf: false, textLen: 200 }),
      box({ parent: 2, selector: "div.card>h3", tag: "h3", heading: 3, y: 140, h: 24, fontSize: 18, textLen: 8 }),
      box({ parent: 2, selector: "div.card>p", tag: "p", y: 224, h: 60, textLen: 90 }),
      box({ parent: 2, selector: "div.card>p.b", tag: "p", y: 294, h: 40, textLen: 40 }),
    ]);
    const { labels, unjudged } = measureProximity(boxes);
    assert.equal(labels.length, 0);
    assert.equal(unjudged.length, 1);
    assert.match(unjudged[0]!.reason, /nothing above it could be mis-grouped/);
  });

  it("needs both the ratio and the absolute floor", () => {
    // 16 vs 24 is a 1.5x ratio and an 8px difference that nobody perceives as
    // mis-grouping. It was a false positive on fixtures/css-challenge/form-app.html.
    const near = measureProximity(tree(sections({ gapAbove: 16, gapBelow: 23 })));
    assert.equal(near.labels.filter((l) => l.inverted).length, 0, "23 vs 16 is under the 8px floor");
    const far = measureProximity(tree(sections({ gapAbove: 16, gapBelow: 44 })));
    assert.ok(far.labels.some((l) => l.inverted), "44 vs 16 clears both tests");
  });

  it("does not treat a whole card as a label", () => {
    // A label is a box about as tall as its own type; a card is many times
    // taller than its heading. Judging the card is how a 16-vs-24px gap between
    // two cards was reported as a proximity inversion.
    const boxes = tree([
      box({ parent: -1, selector: "div.shell", y: 0, h: 600, leaf: false, textLen: 400 }),
      box({ parent: 0, selector: "div.lead", y: 0, h: 40 }),
      // 190px tall around 18px type — 10x the type, so not a label.
      box({ parent: 0, selector: "div.card", y: 56, h: 190, leaf: false, textLen: 200 }),
      box({ parent: 2, selector: "div.card>h2", tag: "h2", heading: 2, y: 56, h: 24, fontSize: 18, textLen: 10 }),
      box({ parent: 0, selector: "div.tail", y: 340, h: 40 }),
    ]);
    const { labels } = measureProximity(boxes);
    assert.equal(labels.filter((l) => l.selector === "div.card").length, 0);
  });

  it("climbs through a kicker instead of measuring the label against it", () => {
    // The live corpus's biggest false-positive class, 6 of 14 designed pages.
    // web.dev and developer.chrome.com set a 16px breadcrumb 16px above a 48px
    // h1 and the body 32px below it — one title block, read as such because the
    // size contrast (3.0x) settles the grouping, not the gaps.
    const boxes = tree([
      box({ parent: -1, selector: "div.shell", y: 0, h: 600, leaf: false, textLen: 400 }),
      box({ parent: 0, selector: "div.prev", y: 0, h: 100, textLen: 200 }),
      box({ parent: 0, selector: "div.breadcrumb", y: 218, h: 24, fontSize: 16, textLen: 48 }),
      box({ parent: 0, selector: "h1", tag: "h1", heading: 1, y: 258, h: 60, fontSize: 48, textLen: 30 }),
      box({ parent: 0, selector: "p.body", tag: "p", y: 350, h: 80, fontSize: 16, textLen: 300 }),
    ]);
    const { labels } = measureProximity(boxes);
    const h1 = labels.find((l) => l.selector === "h1");
    assert.ok(h1, "the h1 is still judged");
    // Measured above the BREADCRUMB (218 - 100 = 118), not against it (16).
    assert.equal(h1.before, 118);
    assert.equal(h1.inverted, false);
  });

  it("does not treat ordinary body prose as a kicker", () => {
    // The first attempt at the rule above used "short text + smaller font",
    // which absorbed a 74-character paragraph and then measured the gap above
    // THAT — manufacturing `before: 16` on web.dev's
    // h2#monitor_lcp_breakdown_in_javascript where the rendered gaps are 32 and
    // 32. Body text is always smaller than a heading, so only a real step in
    // rank counts: 16px under a 24px h2 is 1.5x and stays a peer.
    const boxes = tree([
      box({ parent: -1, selector: "div.body", y: 0, h: 600, leaf: false, textLen: 500 }),
      box({ parent: 0, selector: "p.a", tag: "p", y: 0, h: 84, fontSize: 16, textLen: 222 }),
      box({ parent: 0, selector: "p.short", tag: "p", y: 100, h: 28, fontSize: 16, textLen: 74 }),
      box({ parent: 0, selector: "h2", tag: "h2", heading: 2, y: 160, h: 32, fontSize: 24, textLen: 35 }),
      box({ parent: 0, selector: "p.next", tag: "p", y: 224, h: 56, fontSize: 16, textLen: 159 }),
    ]);
    const h2 = measureProximity(boxes).labels.find((l) => l.selector === "h2");
    assert.ok(h2);
    assert.equal(h2.before, 32, "measured against the short paragraph, not above it");
    assert.equal(h2.after, 32);
    assert.equal(h2.inverted, false);
  });

  it("does not judge a label flush against the block above it", () => {
    // Zero gap means PAINT is separating the two (a background or a rule), so
    // there is no gap to compare and the ratio goes vacuous — anything is
    // >= 0 * 1.5. nngroup stacks its footer sections edge to edge and reported
    // its "Follow us" heading twice because of it.
    const boxes = tree([
      box({ parent: -1, selector: "footer", y: 0, h: 400, leaf: false, textLen: 300 }),
      box({ parent: 0, selector: "section.nav", y: 0, h: 200, textLen: 200 }),
      box({ parent: 0, selector: "div.bottom", y: 200, h: 120, leaf: false, textLen: 100 }),
      box({ parent: 2, selector: "div.bottom>h2", tag: "h2", heading: 2, y: 200, h: 24, fontSize: 18, textLen: 10 }),
      box({ parent: 2, selector: "div.bottom>ul", y: 256, h: 60, textLen: 80 }),
    ]);
    const { labels, unjudged } = measureProximity(boxes);
    assert.ok(!labels.some((l) => l.selector === "div.bottom>h2"));
    assert.ok(unjudged.some((u) => u.selector === "div.bottom>h2"));
  });

  it("ignores out-of-flow boxes, which make no gaps a reader reads", () => {
    const boxes = tree([
      ...sections({ gapAbove: 40, gapBelow: 10 }),
      box({ parent: 0, selector: "div.toast", position: "fixed", y: 5, h: 60 }),
    ]);
    const { labels } = measureProximity(boxes);
    assert.equal(labels.filter((l) => l.inverted).length, 0);
  });
});

describe("measureRails", () => {
  /**
   * A block under the page shell. Every rail box is a CHILD of something on a
   * real page, and the rule now requires two of them to be siblings, so a
   * `parent: -1` box is no longer a usable fixture — the parentless form was
   * this suite's shape before the live-corpus round and it tested a case the
   * gate never sees.
   */
  const wide = (x: number, w: number, selector: string, parent = 0) =>
    box({ parent, selector, x, w, y: 0, h: 50 });
  /** `div.shell` at index 0, so children can name it as their parent. */
  const shell = (...kids: CompositionBox[]) =>
    tree([box({ parent: -1, selector: "div.shell", x: 0, w: 1280, h: 2000, leaf: false }), ...kids]);

  it("reports two rails a few pixels apart", () => {
    const rails = measureRails(shell(
      wide(232, 800, "section.a"), wide(232, 800, "section.b"),
      wide(237, 800, "section.c"), wide(237, 800, "section.d"),
    ), 1280);
    const left = rails.near.filter((n) => n.axis === "left");
    assert.equal(left.length, 1);
    assert.equal(left[0]!.delta, 5);
    assert.equal(left[0]!.users, 2);
    // The row has to name the container whose children disagree, because that
    // is the only thing that makes the two edges comparable.
    assert.equal(left[0]!.via, "div.shell");
    assert.equal(left[0]!.siblingOnA, "section.a");
  });

  it("ignores a 1px split, which is rounding of fractional layout", () => {
    // landing-product renders rails at 78 and 79, and at 1201 and 1202. A12
    // excludes sub-2px for the same reason.
    assert.equal(measureRails(shell(
      wide(78, 800, "section.a"), wide(78, 800, "section.b"),
      wide(79, 800, "section.c"), wide(79, 800, "section.d"),
    ), 1280).near.length, 0);
  });

  it("ignores a clearly deliberate indent", () => {
    assert.equal(measureRails(shell(
      wide(100, 800, "section.a"), wide(100, 800, "section.b"),
      wide(140, 700, "section.c"), wide(140, 700, "section.d"),
    ), 1280).near.filter((n) => n.axis === "left").length, 0);
  });

  it("needs two blocks on a rail before calling it one", () => {
    // One stray block must not invent a phantom rail to compare against.
    assert.equal(measureRails(shell(
      wide(232, 800, "section.a"), wide(232, 800, "section.b"),
      wide(237, 800, "section.stray"),
    ), 1280).near.length, 0);
  });

  it("ignores boxes too narrow to carry the page's rail", () => {
    assert.equal(measureRails(shell(
      wide(232, 800, "section.a"), wide(232, 800, "section.b"),
      box({ parent: 0, selector: "span.badge", x: 237, w: 40, y: 0, h: 20 }),
      box({ parent: 0, selector: "span.badge2", x: 237, w: 40, y: 0, h: 20 }),
    ), 1280).near.length, 0);
  });

  // The four classes the live corpus turned up. Every current firing on 14
  // professionally designed pages was one of these, and all four are silent
  // now: 46 findings to 0 with all three alignment mutants still firing.
  // docs/reports/2026-09-23-composition-rail-classification-v3.md

  it("does not compare rails from two unrelated containers", () => {
    // css-tricks: a 462px sidebar column against the 1032px article body;
    // smashing: a 761px header nav against a 512px article card. Different
    // containers, thousands of pixels apart vertically. Their left edges were
    // never meant to agree, so a 7px difference claims nothing.
    const boxes = tree([
      box({ parent: -1, selector: "div.page", x: 0, w: 1280, h: 4000, leaf: false }),
      box({ parent: -1, selector: "main.article", x: 0, w: 1280, h: 2000, leaf: false }),
      box({ parent: -1, selector: "aside.rail", x: 0, w: 1280, h: 2000, leaf: false }),
      box({ parent: 1, selector: "main.article>ul", x: 129, w: 1032, y: 100, h: 100 }),
      box({ parent: 1, selector: "main.article>div", x: 129, w: 1032, y: 300, h: 100 }),
      box({ parent: 2, selector: "aside.rail>details", x: 136, w: 462, y: 2400, h: 100 }),
      box({ parent: 2, selector: "aside.rail>p", x: 136, w: 462, y: 2600, h: 100 }),
    ]);
    assert.equal(measureRails(boxes, 1280).near.filter((n) => n.axis === "left").length, 0);
  });

  it("does not report a block against its own ancestor's edge", () => {
    // Hacker News nests a 1070.4px table inside a 1074.4px one (cellpadding);
    // Wikipedia runs td 631.4 -> div 629.4 -> ul 622.3 through a navbox, which
    // was 16 of its 21 findings. The delta is the ancestor's own padding, which
    // is by design — an ancestor and its descendant have different containing
    // blocks, so the same edge was never available to both.
    const boxes = tree([
      box({ parent: -1, selector: "div.page", x: 0, w: 1280, h: 2000, leaf: false }),
      box({ parent: 0, selector: "table#outer", x: 103, w: 1074, y: 0, h: 600, leaf: false }),
      box({ parent: 0, selector: "table#outer2", x: 103, w: 1074, y: 700, h: 600, leaf: false }),
      box({ parent: 1, selector: "table#outer>tbody", x: 105, w: 1070, y: 0, h: 600, leaf: false }),
      box({ parent: 2, selector: "table#outer2>tbody", x: 105, w: 1070, y: 700, h: 600, leaf: false }),
    ]);
    assert.equal(measureRails(boxes, 1280).near.length, 0);
  });

  it("still reports a nested block indented from its own siblings", () => {
    // The mirror image of the case above, and the reason the fix is siblinghood
    // rather than "exclude ancestor/descendant pairs": that intuitive form of
    // the fix silences this too. `.subsection` is 5px off the rail its own
    // siblings h2 and p sit on, which is a real stray indent.
    const boxes = tree([
      box({ parent: -1, selector: "div.shell", x: 0, w: 1280, h: 2000, leaf: false }),
      box({ parent: 0, selector: "div.shell>section", x: 232, w: 816, h: 900, leaf: false }),
      box({ parent: 1, selector: "section>h2", x: 232, w: 816, y: 0, h: 30, heading: 2 }),
      box({ parent: 1, selector: "section>p", x: 232, w: 816, y: 60, h: 40 }),
      box({ parent: 1, selector: "section>div.subsection", x: 237, w: 816, y: 200, h: 200, leaf: false }),
      box({ parent: 1, selector: "section>div.subsection2", x: 237, w: 816, y: 500, h: 200, leaf: false }),
    ]);
    const near = measureRails(boxes, 1280).near.filter((n) => n.axis === "left");
    assert.equal(near.length, 1);
    assert.equal(near[0]!.delta, 5);
    assert.equal(near[0]!.via, "div.shell>section");
  });

  it("does not treat two boxes with no recorded parent as siblings", () => {
    // MDN's skip links (`ul.a11y-menu>li>a`, 1261px wide inset 2px inside the
    // 1265px full-bleed rail) report parent -1, and so do the page-layout divs
    // — the collector records -1 when no ancestor was kept as a box. Reading
    // that as "same parent" left these 4 findings standing on mdn and mdn-learn
    // after every other class was gone.
    const boxes = tree([
      box({ parent: -1, selector: "div.page-layout__banner", x: 0, w: 1265, y: 0, h: 50 }),
      box({ parent: -1, selector: "div.page-layout__main", x: 0, w: 1265, y: 100, h: 50 }),
      box({ parent: -1, selector: "ul.a11y-menu>li>a", x: 2, w: 1261, y: 0, h: 20 }),
      box({ parent: -1, selector: "ul.a11y-menu>li>a2", x: 2, w: 1261, y: 20, h: 20 }),
    ]);
    assert.equal(measureRails(boxes, 1280).near.length, 0);
  });
});

describe("measureHierarchy", () => {
  const heading = (level: number, fontSize: number, fontWeight = 700) =>
    box({ parent: -1, selector: `h${level}`, tag: `h${level}`, heading: level, fontSize, fontWeight, textLen: 10 });
  const body = (fontSize = 15, fontWeight = 400, n = 5) =>
    Array.from({ length: n }, (_, i) => box({ parent: -1, selector: `p.${i}`, tag: "p", fontSize, fontWeight, textLen: 80 }));

  it("passes a real step at every declared level", () => {
    const h = measureHierarchy(tree([heading(1, 40), heading(2, 26), heading(3, 18), ...body()]));
    assert.equal(h.flat.length, 0);
    assert.equal(h.levels.length, 3);
    assert.equal(h.range, 40 / 15 === 2.6666666666666665 ? 2.67 : h.range);
  });

  it("reports two declared levels that render at one size and weight", () => {
    const h = measureHierarchy(tree([heading(2, 18), heading(3, 18), ...body()]));
    assert.equal(h.flat.length, 1);
    assert.equal(h.flat[0]!.pair, "h2/h3");
    assert.equal(h.flat[0]!.sizes, "18/18");
  });

  it("accepts weight as the distinction when the sizes match", () => {
    // A same-size pair at different weights is a rendered hierarchy, so
    // reporting it would be a false positive.
    const h = measureHierarchy(tree([heading(2, 18, 700), heading(3, 18, 400), ...body()]));
    assert.equal(h.flat.length, 0);
  });

  it("takes the largest instance of a level, not the last", () => {
    // A small h2 in a footer must not decide what h2 means on a page whose
    // section heads are 28px.
    const h = measureHierarchy(tree([heading(2, 28), heading(2, 15), heading(3, 18), ...body()]));
    assert.equal(h.flat.length, 0);
    assert.equal(h.levels.find((l) => l.level === 2)!.fontSize, 28);
  });

  it("measures the body size from text leaves, not from wrappers", () => {
    const boxes = tree([
      box({ parent: -1, selector: "div.wrap", fontSize: 99, textLen: 400, leaf: false }),
      ...body(15, 400, 6).map((b) => ({ ...b, parent: 0 })),
    ]);
    assert.equal(measureHierarchy(boxes).bodyFontSize, 15);
  });
});

describe("judgeComposition", () => {
  it("returns composed for an intact stack", () => {
    const report = judgeComposition(input(sections({ gapAbove: 40, gapBelow: 10 })));
    assert.equal(report.verdict, "composed");
    assert.deepEqual(report.findings, []);
  });

  it("returns unbalanced with a proximity finding for an inverted stack", () => {
    const report = judgeComposition(input(sections({ gapAbove: 12, gapBelow: 44 })));
    assert.equal(report.verdict, "unbalanced");
    assert.ok(report.findings.some((f) => f.kind === "proximity-inversion" && f.severity === "warn"));
  });

  it("keeps a rail near-miss off the verdict", () => {
    // Info-level by measurement: a 5px split is at the edge of perceptibility,
    // and a per-element padding change reports through it too.
    const stack = sections({ gapAbove: 40, gapBelow: 10 });
    const report = judgeComposition(input([...stack, ...railSplit(stack.length)]));
    assert.ok(report.findings.some((f) => f.kind === "rail-near-miss" && f.severity === "info"));
    assert.equal(report.verdict, "composed");
  });

  it("reports no-type-contrast only when neither size nor weight emphasizes anything", () => {
    const flat = judgeComposition(input([
      box({ parent: -1, selector: "h1", tag: "h1", heading: 1, fontSize: 15, fontWeight: 400, textLen: 10 }),
      ...Array.from({ length: 5 }, (_, i) =>
        box({ parent: -1, selector: `p.${i}`, tag: "p", fontSize: 15, fontWeight: 400, textLen: 80 })),
    ]));
    assert.ok(flat.findings.some((f) => f.kind === "no-type-contrast"));

    // form-app's shape: 18px/700 titles over 14px/400 body is a 1.29x size
    // ratio, under the floor, on a page whose hierarchy is perfectly legible.
    const boldOnly = judgeComposition(input([
      box({ parent: -1, selector: "h2", tag: "h2", heading: 2, fontSize: 18, fontWeight: 700, textLen: 10 }),
      ...Array.from({ length: 5 }, (_, i) =>
        box({ parent: -1, selector: `p.${i}`, tag: "p", fontSize: 14, fontWeight: 400, textLen: 80 })),
    ]));
    assert.equal(boldOnly.findings.filter((f) => f.kind === "no-type-contrast").length, 0);
  });

  it("does not report no-type-contrast on a page that declares no heading", () => {
    // danluu.com is a date-and-link index, every row 16px/400 by design, and it
    // was the one live-corpus page this rule fired on. "Nothing reads as the
    // most important" describes a list correctly rather than finding a defect
    // in it; the page has to CLAIM a hierarchy before failing to render one.
    const rows = Array.from({ length: 8 }, (_, i) =>
      box({ parent: -1, selector: `a.row${i}`, tag: "a", fontSize: 16, fontWeight: 400, textLen: 40 }));
    const report = judgeComposition(input(rows));
    assert.equal(report.hierarchy.levels.length, 0);
    assert.equal(report.findings.filter((f) => f.kind === "no-type-contrast").length, 0);

    // …and still fires once a heading is declared and rendered at body scale.
    const withHeading = judgeComposition(input([
      box({ parent: -1, selector: "h1", tag: "h1", heading: 1, fontSize: 16, fontWeight: 400, textLen: 20 }),
      ...rows,
    ]));
    assert.equal(withHeading.findings.filter((f) => f.kind === "no-type-contrast").length, 1);
  });

  it("says so rather than passing when nothing could be measured", () => {
    const report = judgeComposition(input([
      box({ parent: -1, selector: "span.only", w: 40, h: 20, textLen: 3 }),
    ]));
    assert.equal(report.verdict, "not-judged");
    assert.ok(report.findings.some((f) => f.kind === "nothing-judged"));
    // And it must not ALSO claim the page has no type contrast: one span
    // trivially has none, which is noise rather than a finding.
    assert.equal(report.findings.filter((f) => f.kind === "no-type-contrast").length, 0);
  });

  it("caps the proximity rows and says how many more there are", () => {
    const report = judgeComposition(input(sections({ gapAbove: 12, gapBelow: 44, count: 9 })));
    const rows = report.findings.filter((f) => f.kind === "proximity-inversion");
    assert.equal(rows.length, 6, "five named rows plus one summary");
    assert.match(rows.at(-1)!.message, /and \d+ more label\(s\)/);
  });

  it("takes an allowed row out of the verdict and still lists it", () => {
    const boxes = sections({ gapAbove: 12, gapBelow: 44 });
    const report = judgeComposition(input(boxes), { allow: ["section.s1>h2;the lede heading is deliberately isolated"] });
    assert.ok(report.allowed.length >= 1);
    assert.equal(report.allowed[0]!.reason, "the lede heading is deliberately isolated");
    assert.ok(!report.findings.some((f) => f.selector === "section.s1>h2"));
  });

  it("reports an allow rule that matched nothing", () => {
    const report = judgeComposition(input(sections({ gapAbove: 12, gapBelow: 44 })), {
      allow: [".does-not-exist;stale"],
    });
    assert.deepEqual(report.unusedAllow, [".does-not-exist;stale"]);
  });
});

describe("measureSeparation", () => {
  it("measures group gaps against in-group gaps", () => {
    const sep = measureSeparation(tree(sections({ gapAbove: 40, gapBelow: 10 })));
    assert.equal(sep.inter, 40, "the gap between two sections");
    assert.equal(sep.intra, 10, "the gap under a heading, inside its section");
    assert.ok(sep.samples > 0);
  });
});

describe("formatCompositionReport", () => {
  const report = (boxes: CompositionBox[], over = {}) => ({
    source: "page.html",
    ...judgeComposition(input(boxes)),
    ...over,
  });

  it("prints the coverage the verdict rests on", () => {
    const text = plain(formatCompositionReport(report(sections({ gapAbove: 40, gapBelow: 10 }))));
    assert.match(text, /verdict: COMPOSED/);
    assert.match(text, /measured: \d+ label\(s\), \d+ heading level\(s\)/);
  });

  it("labels the separation ratio as context rather than a verdict", () => {
    // The number looks gateable and the study showed it is not, so the prose
    // has to say so where it is printed.
    const text = plain(formatCompositionReport(report(sections({ gapAbove: 40, gapBelow: 10 }))));
    assert.match(text, /Context only/);
  });

  it("separates informational rows from the ones that carry the verdict", () => {
    const stack = sections({ gapAbove: 12, gapBelow: 44 });
    const text = plain(formatCompositionReport(report([...stack, ...railSplit(stack.length)])));
    assert.match(text, /Findings/);
    assert.match(text, /Informational .*does not carry the verdict/);
  });

  it("does not claim a clean page when every finding's rule is off", () => {
    // The drift was found and silenced, so "all read consistently" would be
    // false — the one line a reader quotes back. Same property `check design`
    // has for its own suppressed findings.
    const allOff = { effective: () => "off" as const, setting: () => "off" as const };
    const text = plain(formatCompositionReport(report(sections({ gapAbove: 12, gapBelow: 44 })), allOff));
    assert.doesNotMatch(text, /read consistently/);
    assert.match(text, /every finding's rule is off/);
  });
});

describe("parseCompositionAllowRules", () => {
  it("requires a reason", () => {
    assert.throws(() => parseCompositionAllowRules(["section.hero>h2"]));
  });

  it("refuses a bare wildcard", () => {
    assert.throws(() => parseCompositionAllowRules(["*;everything"]));
  });
});

describe("COLLECT_COMPOSITION", () => {
  it("is a self-contained expression with no imports", () => {
    // It is `page.evaluate`d as a string, so anything it references must be in
    // the page. This is the same property `rules.test.ts` enforces for the
    // other collectors.
    assert.match(COLLECT_COMPOSITION.trim(), /^\(\(\) => \{/);
    assert.doesNotMatch(COLLECT_COMPOSITION, /\brequire\(|\bimport\b/);
  });

  it("skips display:contents, which has no box to group with", () => {
    assert.match(COLLECT_COMPOSITION, /display === "contents"/);
  });
});
