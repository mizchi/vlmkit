import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { judgeColorRoles } from "./color-roles.ts";
import { parseSceneElements, sceneFromTree, sceneToColorRolesInput, type SceneNode } from "./scene.ts";

/**
 * `check color` on a frame no browser drew: a game's options screen, as a scene graph.
 * The roles a DOM infers from tags are declared, and the colours are the ones the engine
 * paints with; everything after that is the same judge the page path uses.
 */
function options(field: Partial<SceneNode>, link: Partial<SceneNode>, panel: Partial<SceneNode> = {}): SceneNode {
  return {
    name: "screen", x: 0, y: 0, width: 800, height: 600, background: "#1b1f24",
    children: [{
      name: "panel", x: 40, y: 40, width: 500, height: 300, background: "#262b33", ...panel,
      children: [
        { name: "name", x: 20, y: 20, width: 300, height: 32, role: "field", tag: "input", color: "#e8eaed", border: 1, borderColor: "#2e343d", ...field },
        {
          name: "help", x: 20, y: 80, width: 460, height: 60, color: "#c9ced6",
          text: "Your name is shown to other players in the lobby and on the leaderboard.",
          children: [
            { name: "more", x: 300, y: 20, width: 80, height: 20, role: "link", color: "#9aa7ff", text: "more", ...link },
            { name: "more", x: 390, y: 20, width: 60, height: 20, role: "link", color: "#9aa7ff", text: "rules", ...link },
          ],
        },
      ],
    }],
  };
}

const judge = (tree: SceneNode, allow?: string[]) =>
  judgeColorRoles(sceneToColorRolesInput(sceneFromTree(tree), { width: 800, height: 600 }), { source: "scene.json", allow });

const kinds = (report: ReturnType<typeof judge>) => report.findings.map((f) => f.kind);

describe("check color on a scene", () => {
  it("reports a text field whose border disappears into the panel (WCAG 1.4.11)", () => {
    const report = judge(options({}, { underline: true }));
    assert.ok(kinds(report).includes("control-boundary-invisible"), kinds(report).join(", "));
    const control = report.controls[0]!;
    assert.equal(control.selector, "screen[0]>panel[0]>name[0]");
    assert.equal(control.onHex, "#262b33");
    assert.ok(control.best < 3, String(control.best));
  });

  it("passes the same field once its border is drawn at contrast", () => {
    const report = judge(options({ borderColor: "#8a93a3" }, { underline: true }));
    assert.ok(!kinds(report).includes("control-boundary-invisible"), kinds(report).join(", "));
  });

  it("counts a shadow or an outline as the field's edge", () => {
    assert.ok(!kinds(judge(options({ outline: true }, { underline: true }))).includes("control-boundary-invisible"));
  });

  it("reports a link marked off from its sentence by colour alone (WCAG 1.4.1)", () => {
    const report = judge(options({ borderColor: "#8a93a3" }, {}));
    assert.ok(kinds(report).includes("color-only-link"), kinds(report).join(", "));
    assert.equal(report.links[0]!.flow, "screen[0]>panel[0]>help[0]");
  });

  it("accepts an underline as the non-colour cue", () => {
    assert.ok(!kinds(judge(options({ borderColor: "#8a93a3" }, { underline: true }))).includes("color-only-link"));
  });

  // The link ink is the most-used interactive ink that is not the body ink; with two links
  // against one field it is the links', as it would be on the page.
  it("names the palette by role from what the engine paints", () => {
    const report = judge(options({}, { underline: true }));
    assert.equal(report.base?.hex, "#1b1f24", "largest surface");
    assert.equal(report.linkInk?.hex, "#9aa7ff");
  });

  it("refuses a field with nothing opaque behind it, rather than assuming white", () => {
    const tree = options({}, { underline: true }, { background: undefined });
    delete tree.background;
    const report = judge(tree);
    assert.equal(report.controls.length, 0);
    assert.match(report.controlsSkipped[0]!.reason, /no opaque background/);
  });

  it("honours --allow written against the scene path", () => {
    const report = judge(options({}, { underline: true }), ["panel[0]>name;the field is framed by the panel art"]);
    assert.ok(!kinds(report).includes("control-boundary-invisible"));
    assert.deepEqual(report.allowed.map((a) => a.selector), ["screen[0]>panel[0]>name[0]"]);
  });
});

describe("parsing the colour fields", () => {
  it("reads role and the edge fields in either case convention", () => {
    const [element] = parseSceneElements([{
      path: "a", tag: "input", top: 0, left: 0, width: 10, height: 10,
      role: "field", border_color: "#fff", shadow: true, underline: true,
    }]);
    assert.equal(element!.role, "field");
    assert.equal(element!.borderColor, "#fff");
    assert.equal(element!.shadow, true);
  });

  it("rejects a role no rule reads, naming the ones that exist", () => {
    assert.throws(
      () => parseSceneElements([{ path: "a", tag: "x", top: 0, left: 0, width: 1, height: 1, role: "checkbox" }]),
      /field, link and button/,
    );
  });
});
