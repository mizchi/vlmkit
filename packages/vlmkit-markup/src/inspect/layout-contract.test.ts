import assert from "node:assert";
import { test, describe } from "node:test";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import {
  evaluateLayoutRule,
  modalRowSize,
  runLayoutVerify,
  type LayoutRect,
} from "./layout-contract.ts";

const REPO_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
const STRESS = join(REPO_ROOT, "fixtures/auto-markup-proof/creative/attempt-stress.html");

const rect = (left: number, top: number, width = 100, height = 60): LayoutRect => ({ left, top, width, height });

describe("pure evaluation", () => {
  test("modalRowSize clusters tops within 8px and returns the modal row size", () => {
    // 2x2 grid (second row 2px jittered) -> modal 2.
    assert.equal(modalRowSize([rect(0, 100), rect(120, 102), rect(0, 300), rect(120, 305)]), 2);
    // Single column -> 1; single row of 4 -> 4; empty -> 0.
    assert.equal(modalRowSize([rect(0, 0), rect(0, 100), rect(0, 200)]), 1);
    assert.equal(modalRowSize([rect(0, 0), rect(100, 0), rect(200, 4), rect(300, 0)]), 4);
    assert.equal(modalRowSize([]), 0);
  });

  test("width/tolerance, fullWidth, count, visible, above, perRow checks", () => {
    const width = evaluateLayoutRule({ selector: ".s", at: 1280, width: 260 }, { viewport: 1280, rects: [rect(0, 0, 260.4)] });
    assert.equal(width.passed, true);
    const widthOff = evaluateLayoutRule({ selector: ".s", at: 1280, width: 260 }, { viewport: 1280, rects: [rect(0, 0, 300)] });
    assert.equal(widthOff.passed, false);
    assert.equal(widthOff.checks[0]!.measured, "300px");

    assert.equal(evaluateLayoutRule({ selector: ".s", at: 768, fullWidth: true }, { viewport: 768, rects: [rect(0, 0, 768)] }).passed, true);
    assert.equal(evaluateLayoutRule({ selector: ".s", at: 768, fullWidth: true }, { viewport: 768, rects: [rect(0, 0, 400)] }).passed, false);

    assert.equal(evaluateLayoutRule({ selector: ".c", at: 375, count: 4, visible: true }, { viewport: 375, rects: [rect(0, 0), rect(0, 100), rect(0, 200), rect(0, 300)] }).passed, true);
    assert.equal(evaluateLayoutRule({ selector: "#x", at: 375, visible: false }, { viewport: 375, rects: [] }).passed, true);

    const above = evaluateLayoutRule({ selector: ".sb", at: 768, above: "main" },
      { viewport: 768, rects: [rect(0, 0, 768, 200)], aboveRects: [rect(0, 210, 768, 900)] });
    assert.equal(above.passed, true);
    const notAbove = evaluateLayoutRule({ selector: ".sb", at: 768, above: "main" },
      { viewport: 768, rects: [rect(0, 0, 768, 400)], aboveRects: [rect(0, 210, 768, 900)] });
    assert.equal(notAbove.passed, false);

    assert.equal(evaluateLayoutRule({ selector: ".cell", at: 768, perRow: 2 },
      { viewport: 768, rects: [rect(0, 0), rect(120, 0), rect(0, 100), rect(120, 100)] }).passed, true);

    // A rule with no assertion fields is itself a contract error.
    assert.equal(evaluateLayoutRule({ selector: ".s", at: 1280 }, { viewport: 1280, rects: [rect(0, 0)] }).passed, false);
  });
});

describe("integration on the S14a-stress attempt", () => {
  test("the brief's structural requirements pass as a contract; a wrong width fails with the measured value", { timeout: 240_000 }, async () => {
    const report = await runLayoutVerify({
      source: STRESS,
      contract: {
        rules: [
          { selector: ".sidebar", at: 1280, width: 260 },
          { selector: ".stat-cell", at: 1280, perRow: 4 },
          { selector: ".stat-cell", at: 768, perRow: 2 },
          { selector: ".stat-cell", at: 375, perRow: 1 },
          { selector: ".sidebar", at: 768, fullWidth: true, above: "main" },
          { selector: ".stat-cell", at: 375, count: 4 },
        ],
      },
    });
    assert.equal(report.done, true,
      JSON.stringify(report.results.filter((r) => !r.passed).map((r) => ({ rule: r.rule, checks: r.checks })), null, 1));

    const broken = await runLayoutVerify({
      source: STRESS,
      contract: { rules: [{ selector: ".sidebar", at: 1280, width: 300 }] },
    });
    assert.equal(broken.done, false);
    assert.equal(broken.results[0]!.checks[0]!.measured, "260px");
  });
});
