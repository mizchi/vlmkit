import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
  judgeSceneIntegrity,
  parseSceneElements,
  sceneFromTree,
  SCENE_SKIPPED_RULES_WITH_PAINT,
  SCENE_SKIPPED_RULES_WITHOUT_PAINT,
  type SceneNode,
} from "./scene.ts";

/** A HUD panel with one label; `label` overrides the label's paint. */
function hud(panel: Partial<SceneNode>, label: Partial<SceneNode>): SceneNode {
  return {
    name: "hud", x: 0, y: 0, width: 800, height: 600,
    children: [{
      name: "panel", x: 20, y: 20, width: 300, height: 80, ...panel,
      children: [{ name: "label", x: 10, y: 10, width: 200, height: 24, text: "Health 42", ...label }],
    }],
  };
}

const rules = (list: readonly { rule: string }[]) => list.map((r) => r.rule);

describe("judgeSceneIntegrity: contrast from resolved paint", () => {
  it("reports grey-on-grey text the engine drew, from colours alone", () => {
    const report = judgeSceneIntegrity(sceneFromTree(hud({ background: "#555555" }, { color: "#777777" })));
    const finding = report.findings.find((f) => f.kind === "low-contrast-text");
    assert.ok(finding, JSON.stringify(report.findings));
    assert.equal(finding.evidence?.fg, "rgb(119, 119, 119)");
    assert.equal(finding.evidence?.bg, "rgb(85, 85, 85)");
    assert.equal(finding.evidence?.floor, 4.5);
    assert.deepEqual(rules(report.skippedRules), rules(SCENE_SKIPPED_RULES_WITH_PAINT));
  });

  it("calls near-identical colours invisible, a fail", () => {
    const report = judgeSceneIntegrity(sceneFromTree(hud({ background: "#101010" }, { color: "#141414" })));
    assert.ok(report.findings.some((f) => f.kind === "invisible-text" && f.severity === "fail"));
    assert.equal(report.verdict, "defects");
  });

  it("applies the large-text floor from the scene's font size", () => {
    // #949494 on white is 3.03:1 — a failure for body text, a pass for 24px text.
    const body = judgeSceneIntegrity(sceneFromTree(hud({ background: "#ffffff" }, { color: "#949494" })));
    const large = judgeSceneIntegrity(sceneFromTree(hud({ background: "#ffffff" }, { color: "#949494", fontSize: 24 })));
    assert.ok(body.findings.some((f) => f.kind === "low-contrast-text"));
    assert.ok(!large.findings.some((f) => f.kind === "low-contrast-text"));
  });

  it("multiplies opacity down the recorded ancestor chain", () => {
    const report = judgeSceneIntegrity(sceneFromTree(hud({ background: "#ffffff", opacity: 0.3 }, { color: "#000000" })));
    assert.ok(report.findings.some((f) => f.kind === "low-contrast-text"), JSON.stringify(report.findings));
  });

  it("composites a translucent panel over the opaque layer beneath it", () => {
    const tree = hud({ background: "rgba(0, 0, 0, 0.5)" }, { color: "#808080" });
    tree.background = "#ffffff";
    const report = judgeSceneIntegrity(sceneFromTree(tree));
    const finding = report.findings.find((f) => f.kind === "invisible-text" || f.kind === "low-contrast-text");
    assert.equal(finding?.evidence?.bg, "rgb(128, 128, 128)");
  });

  it("refuses, visibly, to guess a background the scene never declared", () => {
    const report = judgeSceneIntegrity(sceneFromTree(hud({}, { color: "#777777" })));
    assert.equal(report.findings.length, 0);
    assert.ok(report.exempted.some((e) => e.kind === "low-contrast-text" && /no opaque `background`/.test(e.reason)));
    assert.ok(report.inertRules.some((r) => r.rule === "low-contrast-text"), JSON.stringify(report.inertRules));
  });

  it("counts text over an image as refused, the way the page counts a gradient", () => {
    const report = judgeSceneIntegrity(sceneFromTree(hud({ backgroundImage: true }, { color: "#777777" })));
    assert.ok(report.exempted.some((e) => /1 text block\(s\) skipped/.test(e.reason)), JSON.stringify(report.exempted));
  });

  it("exempts disabled and shadowed text like the DOM path", () => {
    const report = judgeSceneIntegrity(sceneFromTree(hud({ background: "#555555" }, { color: "#777777", disabled: true })));
    assert.equal(report.findings.length, 0);
    assert.ok(report.exempted.some((e) => /disabled control/.test(e.reason)));
  });

  it("reports exactly what it always did when no element carries paint", () => {
    const report = judgeSceneIntegrity(sceneFromTree(hud({}, {})));
    assert.deepEqual(report.skippedRules, [...SCENE_SKIPPED_RULES_WITHOUT_PAINT]);
    assert.ok(!report.inertRules.some((r) => r.rule === "low-contrast-text"));
  });
});

describe("parseSceneElements", () => {
  it("reads the paint and type fields in either case convention", () => {
    const [element] = parseSceneElements(JSON.stringify([{
      path: "a", tag: "div", top: 0, left: 0, width: 10, height: 10,
      color: "#000", background_image: true, font_size: 12, fontWeight: 700, text_shadow: true,
    }]));
    assert.equal(element!.color, "#000");
    assert.equal(element!.backgroundImage, true);
    assert.equal(element!.fontSize, 12);
    assert.equal(element!.fontWeight, 700);
    assert.equal(element!.textShadow, true);
  });

  it("rejects a colour only a renderer could resolve, naming the field", () => {
    assert.throws(
      () => parseSceneElements([{ path: "a", tag: "div", top: 0, left: 0, width: 1, height: 1, color: "oklch(0.5 0.1 200)" }]),
      /elements\[0\]\.color .*resolved colour/,
    );
  });
});
