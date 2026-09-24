import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { judgeComposition } from "./composition.ts";
import { sceneFromTree, sceneToCompositionInput, type SceneNode } from "./scene.ts";

/**
 * The composition judge on a snapshot no browser produced: a game's menu as a scene
 * graph, positions local to the parent, the way an engine stores them.
 *
 * This is the claim the package split rests on, run end to end through the library's own
 * adapters: `sceneFromTree` flattens the graph into the scene contract, and
 * `sceneToCompositionInput` hands it to the same judge `vlmkit check composition` uses.
 */

/** A settings menu: a section per group, each a title over two labelled sliders. */
function menu(gapAbove: number, gapBelow: number): SceneNode {
  const section = (name: string, title: string, y: number): SceneNode => ({
    name, x: 40, y, width: 600, height: 30 + gapBelow + 40 + 10 + 40,
    children: [
      { name: "title", x: 0, y: 0, width: 600, height: 30, text: title, fontSize: 26, heading: 2 },
      { name: "slider", x: 0, y: 30 + gapBelow, width: 600, height: 40, text: "Master volume" },
      { name: "slider", x: 0, y: 30 + gapBelow + 50, width: 600, height: 40, text: "Effects volume" },
    ],
  });
  const first = section("audio", "Audio", gapAbove);
  const secondY = gapAbove + first.height + gapAbove;
  return { name: "menu", x: 0, y: 0, width: 1280, height: 900, children: [first, section("video", "Video", secondY)] };
}

const viewport = { width: 1280, height: 720 };

describe("sceneFromTree", () => {
  it("turns local positions into frame positions and names same-named siblings apart", () => {
    const elements = sceneFromTree(menu(40, 10));
    const byPath = new Map(elements.map((e) => [e.path, e]));
    assert.ok(byPath.has("menu[0]>audio[0]>slider[1]"), [...byPath.keys()].join("\n"));
    const second = byPath.get("menu[0]>video[0]>title[0]")!;
    assert.equal(second.left, 40);
    assert.equal(second.top, 40 + 130 + 40);
    assert.equal(second.tag, "title");
  });
});

describe("composition judge on a non-DOM scene graph", () => {
  it("passes a menu whose titles sit with the sliders they label", () => {
    const report = judgeComposition(sceneToCompositionInput(sceneFromTree(menu(40, 10)), viewport));
    assert.equal(report.findings.filter((f) => f.kind === "proximity-inversion").length, 0);
    assert.equal(report.labels.length, 1, "the second title is judged; the first has nothing above it");
  });

  it("reports a title that drifted toward the section above it", () => {
    const report = judgeComposition(sceneToCompositionInput(sceneFromTree(menu(10, 40)), viewport));
    const inverted = report.findings.filter((f) => f.kind === "proximity-inversion");
    assert.equal(inverted.length, 1);
    assert.equal(inverted[0]!.selector, "menu[0]>video[0]>title[0]");
    assert.equal(report.verdict, "unbalanced");
  });

  it("honours an exemption written against the scene path", () => {
    const report = judgeComposition(
      sceneToCompositionInput(sceneFromTree(menu(10, 40)), viewport),
      { allow: ["video[0]>title;the video group is deliberately set apart"] },
    );
    assert.equal(report.findings.filter((f) => f.kind === "proximity-inversion").length, 0);
    assert.deepEqual(report.allowed.map((a) => a.selector), ["menu[0]>video[0]>title[0]"]);
  });

  it("compares backgrounds as colours, not as the strings a scene spelled them with", () => {
    // A section filled in the menu's own colour paints no boundary, so its title's gaps are
    // still judged; one in a different colour groups its contents itself. The judge compares
    // the page's computed-style strings, so `#1b1f24` under `rgb(27, 31, 36)` has to reach it
    // as one colour — spelled two ways, it read as a painted panel and hid the inversion.
    const painted = (menuBg: string, sectionBg: string) => sceneFromTree(menu(10, 40)).map((e) => (
      e.path === "menu[0]" ? { ...e, background: menuBg }
        : /^menu\[0\]>\w+\[0\]$/.test(e.path) ? { ...e, background: sectionBg }
          : e
    ));
    const inversions = (elements: ReturnType<typeof painted>) =>
      judgeComposition(sceneToCompositionInput(elements, viewport)).findings.filter((f) => f.kind === "proximity-inversion").length;
    assert.equal(inversions(painted("rgb(27, 31, 36)", "#1b1f24")), 1, "same colour, two spellings");
    assert.equal(inversions(painted("#000", "#1b1f24")), 0, "a panel in its own colour is its own group");
  });
});
