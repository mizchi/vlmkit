import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { judgeSceneCopy, sceneTextVisibility, type SceneElement } from "./scene.ts";

/**
 * `check copy` on a scene no browser drew: a game HUD whose strings the engine reports with
 * the paint it used. The DOM-parity test holds the reason classes to the page; these pin what
 * only a scene does — refuse to assume a white canvas, and say which classes it could run.
 */
const HUD = (overrides: Partial<Record<string, Partial<SceneElement>>> = {}): SceneElement[] => {
  const rows: SceneElement[] = [
    { path: "hud[0]", tag: "hud", top: 0, left: 0, width: 640, height: 360, background: "#101418" },
    { path: "hud[0]>title[0]", tag: "label", top: 16, left: 16, width: 200, height: 24, text: "Start Game", color: "#f0f0f0" },
    { path: "hud[0]>hint[0]", tag: "label", top: 48, left: 16, width: 200, height: 20, text: "Press A to continue", color: "#141a1f" },
    { path: "hud[0]>toast[0]", tag: "label", top: 80, left: 16, width: 200, height: 20, text: "Saved", color: "#f0f0f0", opacity: 0 },
  ];
  return rows.map((row) => ({ ...row, ...(overrides[row.path] ?? {}) }));
};
const byPath = (elements: SceneElement[]) => new Map(elements.map((e) => [e.path, e]));

describe("judgeSceneCopy", () => {
  it("sorts a HUD's strings into seen and unseen with the page's reason classes", () => {
    const report = judgeSceneCopy(HUD(), { source: "hud", manifestLines: ["Start Game", "Press A to continue", "Saved"] });
    assert.deepEqual(report.invisibleLines, [
      { line: "Press A to continue", reason: "camouflage" },
      { line: "Saved", reason: "hidden" },
    ]);
    assert.deepEqual(report.missingLines, []);
    assert.match(report.coverageNotes[0]!, /covers 5 of its 7 reason classes here: zero-size, visually-hidden, hidden, transparent, camouflage\./);
  });

  it("leaves camouflage unjudged when nothing opaque is behind the text, and says so", () => {
    // The page compares against white there. A scene has no default canvas: the same dark
    // hint over an unpainted root is not reported, and the note counts it (the title and the
    // hint; "Saved" is already hidden by its opacity).
    const elements = HUD({ "hud[0]": { background: undefined } });
    assert.equal(sceneTextVisibility(elements[2]!, byPath(elements)), null);
    const report = judgeSceneCopy(elements, { source: "hud", manifestLines: ["Press A to continue"] });
    assert.deepEqual(report.invisibleLines, []);
    assert.ok(report.coverageNotes.some((n) => /2 text element\(s\) carry a colour but nothing opaque behind them/.test(n)), report.coverageNotes.join(" | "));
  });

  it("an image or a text shadow behind the text rescues it, as on the page", () => {
    for (const rescue of [{ "hud[0]": { backgroundImage: true } }, { "hud[0]>hint[0]": { textShadow: true } }]) {
      const elements = HUD(rescue);
      assert.equal(sceneTextVisibility(elements[2]!, byPath(elements)), null, JSON.stringify(rescue));
    }
  });

  it("a clip rect narrower than a glyph is visually-hidden, not visible", () => {
    const elements = HUD({ "hud[0]>title[0]": { clip: { top: 16, left: 16, width: 1, height: 1 } } });
    assert.equal(sceneTextVisibility(elements[1]!, byPath(elements)), "visually-hidden");
  });

  it("names the classes it could not run on a scene without paint", () => {
    const bare = HUD().map(({ color: _c, opacity: _o, background: _b, ...rest }) => rest);
    const note = judgeSceneCopy(bare, { source: "hud" }).coverageNotes[0]!;
    assert.match(note, /covers 2 of its 7 reason classes here: zero-size, visually-hidden\./);
    for (const missing of ["hidden", "transparent", "camouflage", "unpainted", "unreachable"]) {
      assert.match(note, new RegExp(`${missing} \\(needs`), missing);
    }
  });

  it("uses the caller's pixel verdict for unpainted, after the paint classes", () => {
    const report = judgeSceneCopy(HUD(), {
      source: "hud",
      manifestLines: ["Start Game"],
      ink: (element) => (element.path === "hud[0]>title[0]" ? "unpainted" : "painted"),
      inkSource: "frame.png",
    });
    assert.deepEqual(report.invisibleLines, [{ line: "Start Game", reason: "unpainted" }]);
    assert.ok(report.coverageNotes.some((n) => /Ink checked in 1 text bbox\(es\) against frame\.png/.test(n)), report.coverageNotes.join(" | "));
  });
});
