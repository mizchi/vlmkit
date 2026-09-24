import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
  controlBoundary,
  judgeColorRoles,
  linkCue,
  type ColorRolesInput,
  type ControlSample,
  type LinkSample,
} from "./color-roles.ts";

/**
 * The ratios `check color` reports, computed from resolved colours. They used to be
 * computed inside the page; `check color --json` on fifteen pages (fixtures and demo sites,
 * 17 controls and ~200 links between them) was byte-identical before and after the move.
 * These tests pin the arithmetic itself, from the judge's side.
 */
const control = (over: Partial<ControlSample> = {}): ControlSample => ({
  selector: "form>input#email", tag: "input",
  on: [255, 255, 255], fill: null, borders: [],
  hasShadow: false, hasOutline: false,
  ...over,
});

const link = (over: Partial<LinkSample> = {}): LinkSample => ({
  selector: "p>a", flow: "p", proseChars: 80,
  link: [17, 69, 196, 1], body: [22, 35, 58, 1], behind: [255, 255, 255],
  underlined: false, weightStep: 0, hasFill: false, hasBorder: false,
  ...over,
});

const base: ColorRolesInput = {
  palette: { surfaces: [], ink: [], marks: [] }, baseHex: "#ffffff", interactiveInk: [],
  controls: [], controlsSkipped: [], links: [], unreadable: [], boxes: 10,
  viewport: { width: 800, height: 600 },
};

describe("controlBoundary", () => {
  it("measures a border against the surface behind the field", () => {
    const measured = controlBoundary(control({ borders: [[0x6b, 0x72, 0x80, 1]] }));
    assert.equal(measured.borderHex, "#6b7280");
    assert.equal(measured.borderRatio, 4.83);
    assert.equal(measured.best, 4.83);
    assert.equal(measured.onHex, "#ffffff");
  });

  it("composites a translucent fill before measuring it", () => {
    const measured = controlBoundary(control({ fill: [0, 0, 0, 0.1] }));
    assert.equal(measured.fillHex, "#000000");
    assert.equal(measured.fillRatio, 1.25); // 229.5 grey: (1 + 0.05) / (0.7874 + 0.05)
  });

  it("keeps the first border on a tie, the order the page's loop used", () => {
    const measured = controlBoundary(control({ borders: [[0, 0, 0, 1], [0, 0, 0, 1]] }));
    assert.equal(measured.borderHex, "#000000");
    assert.equal(measured.best, 21);
  });

  it("is 0 with neither fill nor border — the invisible field", () => {
    assert.equal(controlBoundary(control()).best, 0);
  });
});

describe("linkCue", () => {
  it("compares the two inks, each composited over the surface", () => {
    const cue = linkCue(link());
    assert.equal(cue.linkHex, "#1145c4");
    assert.equal(cue.bodyHex, "#16233a");
    assert.equal(cue.sameInk, false);
    assert.ok(cue.vsBody !== null && cue.vsBody < 3, String(cue.vsBody));
  });

  it("refuses to measure over a background image", () => {
    assert.equal(linkCue(link({ behind: null })).vsBody, null);
  });

  it("names a link in the body colour as the same ink", () => {
    assert.equal(linkCue(link({ link: [22, 35, 58, 1] })).sameInk, true);
  });
});

describe("judgeColorRoles input shapes", () => {
  it("judges resolved samples and reports measured rows", () => {
    const report = judgeColorRoles({ ...base, controls: [control()], links: [link()] });
    assert.equal(report.controls[0]!.best, 0);
    assert.ok("vsBody" in report.links[0]!);
    assert.ok(report.findings.some((f) => f.kind === "control-boundary-invisible"));
    assert.ok(report.findings.some((f) => f.kind === "color-only-link"));
  });

  it("still judges a snapshot saved before the ratios moved, identically", () => {
    const fromSamples = judgeColorRoles({ ...base, controls: [control()], links: [link()] });
    const fromMeasured = judgeColorRoles({ ...base, controls: fromSamples.controls, links: fromSamples.links });
    assert.deepEqual(fromMeasured, fromSamples);
  });
});
