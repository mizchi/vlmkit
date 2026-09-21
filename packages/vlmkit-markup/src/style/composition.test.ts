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

describe("measureProximity", () => {
  it("passes a label that is closer to what it labels than to the block above", () => {
    const { labels } = measureProximity(tree(sections({ gapAbove: 40, gapBelow: 10 })));
    assert.ok(labels.length >= 2, `expected labels, got ${labels.length}`);
    assert.equal(labels.filter((l) => l.inverted).length, 0);
    assert.equal(labels[0]!.before, 40);
    assert.equal(labels[0]!.after, 10);
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
    const { labels, unjudged } = measureProximity(boxes);
    assert.ok(labels.length > 0, "the flush heading must still be judged");
    assert.equal(unjudged.length, 0);
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
    assert.match(unjudged[0]!.reason, /paints its own group edge/);
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
  const wide = (x: number, w: number, selector: string) =>
    box({ parent: -1, selector, x, w, y: 0, h: 50 });

  it("reports two rails a few pixels apart", () => {
    const boxes = tree([
      wide(232, 800, "section.a"), wide(232, 800, "section.b"),
      wide(237, 800, "section.c"), wide(237, 800, "section.d"),
    ]);
    const rails = measureRails(boxes, 1280);
    const left = rails.near.filter((n) => n.axis === "left");
    assert.equal(left.length, 1);
    assert.equal(left[0]!.delta, 5);
    assert.equal(left[0]!.users, 2);
  });

  it("ignores a 1px split, which is rounding of fractional layout", () => {
    // landing-product renders rails at 78 and 79, and at 1201 and 1202. A12
    // excludes sub-2px for the same reason.
    const boxes = tree([
      wide(78, 800, "section.a"), wide(78, 800, "section.b"),
      wide(79, 800, "section.c"), wide(79, 800, "section.d"),
    ]);
    assert.equal(measureRails(boxes, 1280).near.length, 0);
  });

  it("ignores a clearly deliberate indent", () => {
    const boxes = tree([
      wide(100, 800, "section.a"), wide(100, 800, "section.b"),
      wide(140, 700, "section.c"), wide(140, 700, "section.d"),
    ]);
    assert.equal(measureRails(boxes, 1280).near.filter((n) => n.axis === "left").length, 0);
  });

  it("needs two blocks on a rail before calling it one", () => {
    // One stray block must not invent a phantom rail to compare against.
    const boxes = tree([
      wide(232, 800, "section.a"), wide(232, 800, "section.b"),
      wide(237, 800, "section.stray"),
    ]);
    assert.equal(measureRails(boxes, 1280).near.length, 0);
  });

  it("ignores boxes too narrow to carry the page's rail", () => {
    const boxes = tree([
      wide(232, 800, "section.a"), wide(232, 800, "section.b"),
      box({ parent: -1, selector: "span.badge", x: 237, w: 40, y: 0, h: 20 }),
      box({ parent: -1, selector: "span.badge2", x: 237, w: 40, y: 0, h: 20 }),
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
    const wide = (x: number, selector: string) => box({ parent: -1, selector, x, w: 800, y: 0, h: 50 });
    const report = judgeComposition(input([
      ...sections({ gapAbove: 40, gapBelow: 10 }),
      wide(232, "section.p"), wide(232, "section.q"), wide(237, "section.r"), wide(237, "section.s"),
    ]));
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
    const report = judgeComposition(input(boxes), { allow: ["section.s0>h2;the lede heading is deliberately isolated"] });
    assert.ok(report.allowed.length >= 1);
    assert.equal(report.allowed[0]!.reason, "the lede heading is deliberately isolated");
    assert.ok(!report.findings.some((f) => f.selector === "section.s0>h2"));
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
    const wide = (x: number, selector: string) => box({ parent: -1, selector, x, w: 800, y: 0, h: 50 });
    const text = plain(formatCompositionReport(report([
      ...sections({ gapAbove: 12, gapBelow: 44 }),
      wide(232, "section.p"), wide(232, "section.q"), wide(237, "section.r"), wide(237, "section.s"),
    ])));
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
