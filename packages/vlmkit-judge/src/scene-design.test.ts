import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { designSample, judgeDesignPolicy } from "./design-policy.ts";
import { sceneFromTree, sceneToDesignPolicyInput, type SceneNode } from "./scene.ts";

/**
 * `check design` on a frame no browser drew: a game's pause menu, its buttons declared by
 * `role`. The signature — padding, radius, border, background, font — is the page's, joined
 * by the same `designSample`, so "three buttons in one style and one that drifted" reads the
 * same whichever renderer drew them.
 */
const button = (name: string, y: number, over: Partial<SceneNode> = {}): SceneNode => ({
  name, x: 40, y, width: 240, height: 44, role: "button", text: name,
  padding: [12, 24, 12, 24], radius: 8, border: 0, background: "#3b82f6", fontSize: 16, fontWeight: 600,
  ...over,
});

const menu = (fourth: Partial<SceneNode> = {}): SceneNode => ({
  name: "pause", x: 0, y: 0, width: 320, height: 400, background: "#111827",
  children: [
    { name: "title", x: 40, y: 20, width: 240, height: 40, heading: 1, text: "Paused", fontSize: 28, fontWeight: 700 },
    button("resume", 80),
    button("options", 140),
    button("controls", 200),
    button("quit", 260, fourth),
  ],
});

describe("check design on a scene", () => {
  it("calls four buttons in one style coherent", () => {
    const report = judgeDesignPolicy(sceneToDesignPolicyInput(sceneFromTree(menu())));
    assert.equal(report.verdict, "coherent", JSON.stringify(report.findings));
    const buttons = report.roles.find((r) => r.role === "button");
    assert.equal(buttons?.instances, 4);
  });

  it("reports the one button whose padding and radius drifted", () => {
    const report = judgeDesignPolicy(sceneToDesignPolicyInput(sceneFromTree(menu({ padding: [10, 20, 10, 20], radius: 4 }))));
    const drift = report.findings.filter((f) => f.kind === "component-drift");
    assert.equal(drift.length, 1, JSON.stringify(report.findings));
    assert.equal(report.verdict, "drift");
  });

  it("reads #hex and rgb() backgrounds as one signature", () => {
    const report = judgeDesignPolicy(sceneToDesignPolicyInput(sceneFromTree(menu({ background: "rgb(59, 130, 246)" }))));
    assert.equal(report.verdict, "coherent", JSON.stringify(report.findings));
  });

  it("groups a heading by its level and tallies role-less elements as skipped", () => {
    const input = sceneToDesignPolicyInput(sceneFromTree(menu()));
    assert.ok(input.samples.some((s) => s.role === "h1"));
    assert.equal(input.skipped, 1, "the pause panel has no role");
    assert.deepEqual(input.skippedTags, { pause: 1 });
  });

  it("builds the signature the page used to build in the browser", () => {
    assert.deepEqual(designSample({
      role: "button", selector: "main>button",
      padding: [8, 16, 8, 16], radius: 6, borderWidth: 1, background: "rgb(255, 255, 255)",
      fontSize: 14, fontWeight: "600", textFree: false,
    }), {
      role: "button", selector: "main>button",
      boxSignature: "8|16|8|16|6|1|rgb(255, 255, 255)",
      signature: "8|16|8|16|6|1|rgb(255, 255, 255)|14|600",
      textFree: false,
      described: "padding 8/16/8/16, radius 6, 14px/600, border 1, bg rgb(255, 255, 255)",
    });
  });
});
