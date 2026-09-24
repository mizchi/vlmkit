import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { judgeComposition, type CompositionBox, type CompositionInput } from "./composition.ts";

/**
 * The composition judge on a snapshot no browser produced: a game's menu as a
 * scene graph, positions local to the parent, the way an engine stores them.
 *
 * This is the claim the split rests on, run end to end. The judge reads boxes,
 * font sizes and a parent index; where they came from is the collector's
 * business. The adapter below is deliberately in the test, not the package: a
 * general scene model is its own design question (transforms, anchors, text
 * measurement), and this proves the judge does not stand in its way.
 */
interface SceneNode {
  name: string;
  kind: "panel" | "text" | "slider";
  /** Local to the parent, as an engine stores it. */
  x: number;
  y: number;
  w: number;
  h: number;
  text?: string;
  fontSize?: number;
  /** A title's rank in the menu, 1 = most important. */
  titleLevel?: number;
  children?: SceneNode[];
}

function sceneToComposition(root: SceneNode, viewport: { width: number; height: number }): CompositionInput {
  const boxes: CompositionBox[] = [];
  const walk = (node: SceneNode, parent: number, ox: number, oy: number, path: string): boolean => {
    const i = boxes.length;
    const x = ox + node.x;
    const y = oy + node.y;
    const selector = path ? `${path}>${node.name}` : node.name;
    boxes.push({
      i, parent, selector, tag: node.kind,
      heading: node.titleLevel ?? 0,
      x, y, w: node.w, h: node.h,
      position: "static",
      fontSize: node.fontSize ?? 16, fontWeight: 400,
      bg: "transparent", border: 0, radius: 0,
      textLen: 0, leaf: false,
    });
    let descendantText = false;
    for (const child of node.children ?? []) descendantText = walk(child, i, x, y, selector) || descendantText;
    const own = node.text?.length ?? 0;
    boxes[i] = { ...boxes[i]!, textLen: own + (descendantText ? 1 : 0), leaf: own > 0 && !descendantText };
    return own > 0 || descendantText;
  };
  walk(root, -1, 0, 0, "");
  return { boxes, viewport };
}

/** A settings menu: a section per group, each a title over two labelled sliders. */
function menu(gapAbove: number, gapBelow: number): SceneNode {
  const section = (name: string, title: string, y: number): SceneNode => ({
    name, kind: "panel", x: 40, y, w: 600, h: 30 + gapBelow + 40 + 10 + 40,
    children: [
      { name: "title", kind: "text", x: 0, y: 0, w: 600, h: 30, text: title, fontSize: 26, titleLevel: 2 },
      { name: "volume", kind: "slider", x: 0, y: 30 + gapBelow, w: 600, h: 40, text: "Master volume" },
      { name: "effects", kind: "slider", x: 0, y: 30 + gapBelow + 50, w: 600, h: 40, text: "Effects volume" },
    ],
  });
  const first = section("audio", "Audio", gapAbove);
  const secondY = gapAbove + first.h + gapAbove;
  return {
    name: "menu", kind: "panel", x: 0, y: 0, w: 1280, h: 900,
    children: [first, section("video", "Video", secondY)],
  };
}

describe("composition judge on a non-DOM scene graph", () => {
  it("passes a menu whose titles sit with the sliders they label", () => {
    const report = judgeComposition(sceneToComposition(menu(40, 10), { width: 1280, height: 720 }));
    assert.equal(report.findings.filter((f) => f.kind === "proximity-inversion").length, 0);
    assert.equal(report.labels.length, 1, "the second title is judged; the first has nothing above it");
  });

  it("reports a title that drifted toward the section above it", () => {
    const report = judgeComposition(sceneToComposition(menu(10, 40), { width: 1280, height: 720 }));
    const inverted = report.findings.filter((f) => f.kind === "proximity-inversion");
    assert.equal(inverted.length, 1);
    assert.equal(inverted[0]!.selector, "menu>video>title");
    assert.equal(report.verdict, "unbalanced");
  });

  it("honours an exemption written against the scene path", () => {
    const report = judgeComposition(
      sceneToComposition(menu(10, 40), { width: 1280, height: 720 }),
      { allow: ["video>title;the video group is deliberately set apart"] },
    );
    assert.equal(report.findings.filter((f) => f.kind === "proximity-inversion").length, 0);
    assert.deepEqual(report.allowed.map((a) => a.selector), ["menu>video>title"]);
  });
});
