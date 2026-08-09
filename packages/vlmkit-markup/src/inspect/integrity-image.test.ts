/**
 * Image-only `check integrity` (vlmkit#116).
 *
 * The rules are reused unchanged from `integrity-check.ts`, so what needs testing is the
 * **adapter**: does element-rect input reach each judge in the shape it expects? Three of
 * these tests exist because the first version got that wrong in ways a clean-fixture check
 * would never have surfaced:
 *
 *  - `judgeCollapsedContainers` has no height check of its own; it trusts the caller to have
 *    filtered. Passing every ancestor reported a 360px-tall root as "collapsed" because it
 *    held 40px children.
 *  - `clipX` / `clipY` are the *amounts clipped in px*, not the clip rect's origin. Passing
 *    the origin produced "cuts off 16px" for a label whose only relation to 16 was its
 *    `left`.
 *  - Treating an element's own box as a clip rect reported a label with 90px of text in a
 *    180px box as "cutting off 40px" — the opposite of true. On a canvas, oversized text
 *    overdraws; it does not clip unless a clip rect says so.
 *
 * So the fixtures below are deliberately *broken in specific ways*, and the assertions
 * include what must NOT be reported. A gate that finds nothing on a clean frame proves only
 * that it is quiet.
 */
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  IMAGE_MODE_SKIPPED_RULES,
  parseIntegrityImageElements,
  runImageIntegrityCheck,
} from "./integrity-image.ts";

async function withElements(elements: unknown[]): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "vlmkit-integrity-image-"));
  const path = join(dir, "elements.json");
  await writeFile(path, JSON.stringify({ elements }));
  return path;
}

const ROOT = { path: "hud[0]", tag: "hud", classes: "hud-root", top: 0, left: 0, width: 640, height: 360 };

const kinds = (report: { findings: { kind: string }[] }) => report.findings.map((f) => f.kind);

describe("text collision", () => {
  it("reports two overlapping text blocks", async () => {
    const path = await withElements([
      ROOT,
      { path: "hud[0]>a[0]", tag: "label", classes: "hp", top: 16, left: 16, width: 200, height: 20, text: "HP 9999999/9999999" },
      { path: "hud[0]>a[1]", tag: "label", classes: "mp", top: 20, left: 40, width: 180, height: 20, text: "MP 500/500" },
    ]);
    const report = await runImageIntegrityCheck({ elementsPath: path });
    assert.ok(kinds(report).includes("text-collision"), kinds(report).join(", "));
    assert.equal(report.verdict, "defects");
  });

  it("does not report blocks the caller marked as separate layers", async () => {
    // Game HUDs stack layers on purpose. Without `overlay`, every layered HUD would be a
    // wall of collisions and the feature would be unusable on its intended target.
    const path = await withElements([
      ROOT,
      { path: "hud[0]>a[0]", tag: "label", classes: "hp", top: 16, left: 16, width: 200, height: 20, text: "HP 120/120" },
      { path: "hud[0]>a[1]", tag: "label", classes: "toast", top: 16, left: 16, width: 200, height: 20, text: "Level up!", overlay: true, z_index: 10 },
    ]);
    const report = await runImageIntegrityCheck({ elementsPath: path });
    assert.ok(!kinds(report).includes("text-collision"), kinds(report).join(", "));
  });

  it("is inert, not silently passing, when no element carries text", async () => {
    const path = await withElements([ROOT, { ...ROOT, path: "hud[0]>box[0]", classes: "box", height: 40 }]);
    const report = await runImageIntegrityCheck({ elementsPath: path });
    assert.ok(
      report.inertRules.some((r) => r.rule === "text-collision"),
      "an unevaluated rule must be reported as inert, not counted as passing",
    );
  });
});

describe("text clipped", () => {
  it("reports the amount actually clipped, not a coordinate", async () => {
    const path = await withElements([
      ROOT,
      {
        path: "hud[0]>a[0]", tag: "label", classes: "hp", top: 16, left: 16, width: 200, height: 20,
        text: "HP 9999999/9999999",
        text_measured: { width: 320, height: 18 },
        clip: { top: 16, left: 16, width: 200, height: 20 },
      },
    ]);
    const report = await runImageIntegrityCheck({ elementsPath: path });
    const finding = report.findings.find((f) => f.kind === "text-clipped");
    assert.ok(finding, kinds(report).join(", "));
    // 320 measured - 200 clip = 120. Not 16 (the `left`), which is what the first version
    // reported by passing the rect origin into a field meaning "px clipped".
    assert.match(finding!.message, /120px/);
    assert.equal(finding!.evidence?.clipX, 120);
  });

  it("does not report text that fits its clip rect", async () => {
    const path = await withElements([
      ROOT,
      {
        path: "hud[0]>a[0]", tag: "label", classes: "mp", top: 20, left: 40, width: 180, height: 20,
        text: "MP 500/500",
        text_measured: { width: 90, height: 18 },
        clip: { top: 20, left: 40, width: 180, height: 20 },
      },
    ]);
    const report = await runImageIntegrityCheck({ elementsPath: path });
    assert.ok(!kinds(report).includes("text-clipped"), kinds(report).join(", "));
  });

  it("does not treat oversized text without a clip rect as clipped", async () => {
    // On a canvas that overdraws — a collision or protrusion concern, not a clip. Reporting
    // it as "cut off" would name the wrong repair.
    const path = await withElements([
      ROOT,
      {
        path: "hud[0]>a[0]", tag: "label", classes: "hp", top: 16, left: 16, width: 200, height: 20,
        text: "HP 9999999/9999999",
        text_measured: { width: 320, height: 18 },
      },
    ]);
    const report = await runImageIntegrityCheck({ elementsPath: path });
    assert.ok(!kinds(report).includes("text-clipped"), kinds(report).join(", "));
    assert.ok(report.inertRules.some((r) => r.rule === "text-clipped" && /overdraw/.test(r.reason)));
  });
});

describe("containment, derived from the path", () => {
  it("reports a child protruding past its nearest recorded ancestor", async () => {
    const path = await withElements([
      ROOT,
      { path: "hud[0]>badge[0]", tag: "badge", classes: "badge", top: 330, left: 600, width: 120, height: 40 },
    ]);
    const report = await runImageIntegrityCheck({ elementsPath: path });
    assert.ok(kinds(report).includes("container-protrusion"), kinds(report).join(", "));
  });

  it("skips a level when the intermediate element was not recorded", async () => {
    // The DOM capture only records elements that carry a class or are semantic, so a path
    // can reference an ancestor that is absent. Falling back to the nearest recorded one is
    // what makes this usable on real captures.
    const path = await withElements([
      ROOT,
      { path: "hud[0]>wrap[0]>deep[0]>badge[0]", tag: "badge", classes: "badge", top: 330, left: 600, width: 120, height: 40 },
    ]);
    const report = await runImageIntegrityCheck({ elementsPath: path });
    assert.ok(kinds(report).includes("container-protrusion"), kinds(report).join(", "));
  });

  it("reports a zero-height container holding tall children", async () => {
    const path = await withElements([
      ROOT,
      { path: "hud[0]>panel[0]", tag: "panel", classes: "empty-panel", top: 100, left: 100, width: 200, height: 0 },
      { path: "hud[0]>panel[0]>item[0]", tag: "item", classes: "item", top: 100, left: 100, width: 180, height: 60 },
    ]);
    const report = await runImageIntegrityCheck({ elementsPath: path });
    assert.ok(kinds(report).includes("collapsed-container"), kinds(report).join(", "));
  });

  it("does NOT call a tall container collapsed just because its children are shorter", async () => {
    // The regression that made the first run report 3 collapses on a 9-element HUD, two of
    // them nonsense: `judgeCollapsedContainers` reports every candidate it is given.
    const path = await withElements([
      ROOT,
      { path: "hud[0]>row[0]", tag: "row", classes: "btn-row", top: 260, left: 40, width: 560, height: 40 },
      { path: "hud[0]>row[0]>button[0]", tag: "button", classes: "btn-a", top: 264, left: 40, width: 100, height: 32 },
    ]);
    const report = await runImageIntegrityCheck({ elementsPath: path });
    assert.deepEqual(
      kinds(report).filter((k) => k === "collapsed-container"),
      [],
      "a 360px root and a 40px row are not collapsed containers",
    );
  });
});

describe("near-misalignment", () => {
  it("reports siblings a few px off a shared edge", async () => {
    const path = await withElements([
      ROOT,
      { path: "hud[0]>row[0]", tag: "row", classes: "row", top: 260, left: 40, width: 560, height: 40 },
      { path: "hud[0]>row[0]>b[0]", tag: "button", classes: "b1", top: 264, left: 40, width: 100, height: 32 },
      { path: "hud[0]>row[0]>b[1]", tag: "button", classes: "b2", top: 267, left: 160, width: 100, height: 32 },
      { path: "hud[0]>row[0]>b[2]", tag: "button", classes: "b3", top: 264, left: 280, width: 100, height: 32 },
    ]);
    const report = await runImageIntegrityCheck({ elementsPath: path });
    assert.ok(kinds(report).includes("near-misalignment"), kinds(report).join(", "));
  });
});

describe("coverage is reported, not implied", () => {
  it("names every rule it could not evaluate", async () => {
    const path = await withElements([ROOT]);
    const report = await runImageIntegrityCheck({ elementsPath: path });
    assert.equal(report.verdict, "clean");
    assert.equal(report.skippedRules.length, IMAGE_MODE_SKIPPED_RULES.length);
    // The specific danger: a clean verdict over a third of the rules reading as a clean
    // verdict over all of them. Every skipped rule carries a reason so the gap is auditable
    // rather than a number to shrug at.
    assert.ok(report.skippedRules.every((r) => r.reason.length > 10), JSON.stringify(report.skippedRules));
    for (const needsDom of ["low-contrast-text", "occluded-text", "js-error"]) {
      assert.ok(report.skippedRules.some((r) => r.rule === needsDom), `${needsDom} must be listed`);
    }
  });
});

describe("parsing", () => {
  it("accepts a bare array and both field-name conventions", () => {
    // The caller writes this JSON from a non-JS language; rejecting `text_measured` would
    // be a gratuitous obstacle.
    const parsed = parseIntegrityImageElements(JSON.stringify([
      { path: "a[0]", tag: "a", top: 0, left: 0, width: 10, height: 10, text_measured: { width: 5, height: 5 }, aria_hidden: true, z_index: 3 },
    ]));
    assert.equal(parsed.length, 1);
    assert.deepEqual(parsed[0]!.textMeasured, { width: 5, height: 5 });
    assert.equal(parsed[0]!.ariaHidden, true);
    assert.equal(parsed[0]!.zIndex, 3);
  });

  it("throws on a row missing geometry instead of dropping it", () => {
    // Silently skipping an unplaceable row would make a typo look like a clean frame — the
    // same failure mode the coverage reporting above exists to prevent.
    assert.throws(
      () => parseIntegrityImageElements(JSON.stringify([{ path: "a[0]", tag: "a", top: 0, left: 0 }])),
      /needs path\/top\/left\/width\/height/,
    );
  });

  it("rejects input that is neither an array nor {elements}", () => {
    assert.throws(() => parseIntegrityImageElements(JSON.stringify({ nodes: [] })), /must be an array/);
  });
});
