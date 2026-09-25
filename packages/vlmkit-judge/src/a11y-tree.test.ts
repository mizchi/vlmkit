import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
  A11Y_TREE_FORMAT,
  judgeUnlabelledControls,
  judgeUnreachableContent,
  measurePixelContrast,
  parseA11yTree,
  type A11yNode,
  type A11yTree,
  type RgbaFrame,
} from "./a11y-tree.ts";

const tree = (nodes: A11yNode[], extra: Partial<A11yTree> = {}): A11yTree => ({
  format: A11Y_TREE_FORMAT,
  viewport: { width: 375, height: 812 },
  nodes,
  ...extra,
});

const node = (path: string, role: string, name: string | undefined, rect: [number, number, number, number], more: Partial<A11yNode> = {}): A11yNode => ({
  path,
  role,
  ...(name !== undefined ? { name } : {}),
  rect: { left: rect[0], top: rect[1], width: rect[2], height: rect[3] },
  ...more,
});

/** A frame filled with `bg`, and `ink` rectangles standing in for glyphs. */
function frame(width: number, height: number, bg: number[], inks: Array<{ rect: [number, number, number, number]; color: number[] }>): RgbaFrame {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) data.set([bg[0]!, bg[1]!, bg[2]!, 255], i * 4);
  for (const { rect: [x, y, w, h], color } of inks) {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) data.set([color[0]!, color[1]!, color[2]!, 255], (yy * width + xx) * 4);
  }
  return { width, height, data };
}

describe("parseA11yTree", () => {
  it("refuses a file that is not a tree, by name", () => {
    assert.throws(() => parseA11yTree({ elements: [] }), /not an accessibility tree .*vlmkit scan a11y/);
    assert.throws(() => parseA11yTree("{"), /not an accessibility tree/);
  });

  it("names the node that is malformed", () => {
    assert.throws(() => parseA11yTree(tree([node("a[0]", "button", "OK", [0, 0, 10, 10]), node("a[0]", "text", "x", [0, 0, 1, 1])])), /nodes\[1\]: path "a\[0\]" is not unique/);
    assert.throws(() => parseA11yTree({ ...tree([]), nodes: [{ path: "a[0]", role: "button" }] }), /nodes\[0\] \(a\[0\]\) needs `rect`/);
    assert.throws(() => parseA11yTree({ ...tree([]), viewport: { width: 0, height: 1 } }), /viewport/);
  });
});

describe("judgeUnlabelledControls", () => {
  it("reports an operable node with no name — disabled too — and not its value or a hidden one", () => {
    const t = tree([
      node("r[0]", "group", undefined, [0, 0, 375, 812]),
      node("r[0]>n[0]", "button", "Start", [0, 0, 80, 40]),
      node("r[0]>n[1]", "textfield", undefined, [0, 50, 200, 40], { value: "1234" }),
      node("r[0]>n[2]", "button", "  ", [0, 100, 40, 40]),
      node("r[0]>n[3]", "button", undefined, [0, 150, 40, 40], { states: { disabled: true } }),
      node("r[0]>n[4]", "group", undefined, [0, 200, 40, 40], { states: { hidden: true } }),
      node("r[0]>n[4]>n[0]", "button", undefined, [0, 200, 40, 40]),
      // A platform role vlmkit has no name for, which the tree says can be tapped.
      node("r[0]>n[5]", "flt-tappable", undefined, [0, 250, 40, 40], { actions: ["tap"] }),
      // A tappable row named by the button inside it (name from content) is not silent.
      node("r[0]>n[6]", "group", undefined, [0, 300, 375, 35], { actions: ["tap"] }),
      node("r[0]>n[6]>n[0]", "button", "Place in Top", [8, 305, 80, 20]),
    ]);
    assert.deepEqual(judgeUnlabelledControls(t).map((f) => f.path), ["r[0]>n[1]", "r[0]>n[2]", "r[0]>n[3]", "r[0]>n[5]"]);
  });
});

describe("judgeUnreachableContent", () => {
  it("reports content below the fold with nothing that scrolls, once per container", () => {
    const log = Array.from({ length: 5 }, (_, i) => node(`r[0]>log[0]>t[${i}]`, "text", `draw: ${i}`, [16, 540 + i * 20, 200, 18]));
    const t = tree([
      node("r[0]", "group", undefined, [0, 0, 375, 900]),
      node("r[0]>log[0]", "list", undefined, [0, 520, 375, 120]),
      ...log,
    ], { viewport: { width: 375, height: 568 } });
    const findings = judgeUnreachableContent(t);
    assert.equal(findings.length, 1);
    assert.equal(findings[0]!.container, "r[0]>log[0]");
    assert.equal(findings[0]!.first.name, "draw: 1"); // draw: 0 ends at 558, inside the 568 fold
    assert.equal(findings[0]!.count, 4);
    assert.deepEqual(findings[0]!.beyond, ["bottom"]);
  });

  it("is silent when an ancestor scrolls, by role or by action", () => {
    const inner = node("r[0]>s[0]>t[0]", "text", "far down", [0, 2000, 100, 20]);
    assert.deepEqual(judgeUnreachableContent(tree([node("r[0]", "group", undefined, [0, 0, 375, 812]), node("r[0]>s[0]", "scrollview", undefined, [0, 0, 375, 812]), inner])), []);
    assert.deepEqual(judgeUnreachableContent(tree([node("r[0]", "group", undefined, [0, 0, 375, 812], { actions: ["scroll"] }), node("r[0]>s[0]", "group", undefined, [0, 0, 375, 812]), inner])), []);
  });

  it("does not count a descendant of an out-of-reach node again, and ignores unnamed decoration and a 1px overhang", () => {
    const t = tree([
      node("r[0]", "button", "Wide", [-40, 0, 100, 40]),
      node("r[0]>t[0]", "text", "Wide", [-40, 0, 100, 40]),
      node("d[0]", "group", undefined, [0, 900, 100, 100]),
      node("e[0]", "text", "edge", [0, 790, 100, 22.5]),
    ]);
    const findings = judgeUnreachableContent(t);
    assert.equal(findings.length, 1);
    assert.equal(findings[0]!.first.path, "r[0]");
    assert.equal(findings[0]!.count, 1);
    assert.deepEqual(findings[0]!.beyond, ["left"]);
  });
});

describe("measurePixelContrast", () => {
  const white = [255, 255, 255];

  it("measures the ink against the most common colour, at the WCAG floors (#777 fails, #767676 passes)", () => {
    const f = frame(200, 60, white, [
      { rect: [10, 10, 60, 13], color: [0x77, 0x77, 0x77] },
      { rect: [110, 10, 60, 13], color: [0x76, 0x76, 0x76] },
    ]);
    const t = tree([
      node("a[0]", "text", "Game Mode", [0, 5, 100, 25]),
      node("b[0]", "text", "Seed", [100, 5, 100, 25]),
    ], { viewport: { width: 200, height: 60 } });
    const report = measurePixelContrast(t, f);
    assert.deepEqual(report.samples.map((s) => [s.name, s.ratio, s.floor]), [["Game Mode", 4.47, 4.5], ["Seed", 4.54, 4.5]]);
    assert.deepEqual(report.failures.map((s) => s.name), ["Game Mode"]);
    assert.deepEqual(report.samples[0]!.background, [255, 255, 255]);
    assert.equal(report.samples[0]!.textSizeFrom, "measured");
  });

  it("gives large text 3:1 — from the declared size, or from the inked line height, scaled", () => {
    // #949494 on white is 3.03:1: under 4.5, over 3.
    const grey = [0x94, 0x94, 0x94];
    const tall = frame(600, 240, white, [{ rect: [30, 30, 300, 69], color: grey }]); // 23 units at scale 3
    const short = frame(600, 240, white, [{ rect: [30, 30, 300, 39], color: grey }]); // 13 units
    const t = (more: Partial<A11yNode> = {}) =>
      tree([node("h[0]", "heading", "Result", [0, 0, 200, 40], more)], { viewport: { width: 200, height: 80 } });
    const measuredTall = measurePixelContrast(t(), tall).samples[0]!;
    assert.equal(measuredTall.textSize, 25.6);
    assert.equal(measuredTall.floor, 3);
    assert.equal(measurePixelContrast(t(), short).samples[0]!.floor, 4.5);
    // Declared wins over measured, in both directions.
    assert.equal(measurePixelContrast(t({ textSize: 14 }), tall).samples[0]!.floor, 4.5);
    const bold = measurePixelContrast(t({ textSize: 19, fontWeight: 700 }), short).samples[0]!;
    assert.deepEqual([bold.floor, bold.textSizeFrom], [3, "declared"]);
  });

  it("skips disabled, off-frame and ink-less nodes, and measures a repeated name once, at the innermost node", () => {
    const f = frame(100, 100, white, [{ rect: [10, 10, 30, 12], color: [0xaa, 0xaa, 0xaa] }]);
    const t = tree([
      node("b[0]", "button", "Next", [0, 0, 50, 30]),
      node("b[0]>t[0]", "text", "Next", [5, 5, 40, 20]),
      node("c[0]", "button", "Commit", [0, 40, 50, 30], { states: { disabled: true } }),
      node("d[0]", "text", "Below", [0, 200, 50, 20]),
      node("e[0]", "text", "Blank", [60, 60, 30, 30]),
    ], { viewport: { width: 100, height: 100 } });
    const report = measurePixelContrast(t, f);
    assert.deepEqual(report.samples.map((s) => s.path), ["b[0]>t[0]"]);
    assert.deepEqual(report.skipped.map((s) => [s.name, s.reason]), [["Commit", "disabled"], ["Below", "outside-frame"], ["Blank", "no-ink"]]);
  });

  it("reads a chip's label, not its outline: the outline is neither the ink nor the text height", () => {
    // A 114x32 chip with a black 1px outline and #949494 text 13 rows tall (3.03:1).
    const outline = (x: number, y: number, w: number, h: number) => [
      { rect: [x, y, w, 1] as [number, number, number, number], color: [0, 0, 0] },
      { rect: [x, y + h - 1, w, 1] as [number, number, number, number], color: [0, 0, 0] },
      { rect: [x, y, 1, h] as [number, number, number, number], color: [0, 0, 0] },
      { rect: [x + w - 1, y, 1, h] as [number, number, number, number], color: [0, 0, 0] },
    ];
    const f = frame(140, 40, white, [...outline(10, 4, 114, 32), { rect: [40, 13, 50, 13], color: [0x94, 0x94, 0x94] }]);
    const t = tree([node("c[0]", "button", "Deuces", [10, 4, 114, 32])], { viewport: { width: 140, height: 40 } });
    const sample = measurePixelContrast(t, f).samples[0]!;
    assert.deepEqual(sample.ink, [0x94, 0x94, 0x94]);
    assert.equal(sample.textSize, 14.4); // 13 inked rows / 0.9, not the outline's 32
    assert.equal(sample.floor, 4.5);
    assert.equal(sample.ratio, 3.03);
  });

  it("keeps a glyph that fills a tight text rect, and drops an underline", () => {
    // A "7" exactly the rect's width — a 2px bar joined to a stem, 13 of the rect's 20 rows —
    // and a 1px black underline below it, which is more contrasting and must not be the ink.
    const red = [0xf4, 0x43, 0x36];
    const f = frame(30, 20, white, [
      { rect: [0, 3, 15, 2], color: red },
      { rect: [12, 3, 2, 13], color: red },
      { rect: [0, 18, 15, 1], color: [0, 0, 0] },
    ]);
    const t = tree([node("a[0]", "text", "7♥", [0, 0, 15, 20])], { viewport: { width: 30, height: 20 } });
    const sample = measurePixelContrast(t, f).samples[0]!;
    assert.deepEqual([sample.ink, sample.ratio], [[0xf4, 0x43, 0x36], 3.68]);
  });

  it("finds very faint text rather than calling it blank", () => {
    const f = frame(60, 30, white, [{ rect: [5, 8, 40, 12], color: [0xee, 0xee, 0xee] }]);
    const t = tree([node("a[0]", "text", "faint", [0, 0, 60, 30])], { viewport: { width: 60, height: 30 } });
    const report = measurePixelContrast(t, f);
    assert.deepEqual(report.failures.map((s) => [s.name, s.ratio]), [["faint", 1.16]]);
  });

  it("does not take one stray anti-aliased pixel for the ink", () => {
    const f = frame(50, 30, white, [
      { rect: [5, 5, 20, 12], color: [0x99, 0x99, 0x99] },
      { rect: [40, 20, 1, 1], color: [0, 0, 0] },
    ]);
    const t = tree([node("a[0]", "text", "Hint", [0, 0, 50, 30])], { viewport: { width: 50, height: 30 } });
    assert.deepEqual(measurePixelContrast(t, f).samples[0]!.ink, [0x99, 0x99, 0x99]);
  });
});
