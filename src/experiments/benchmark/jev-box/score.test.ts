import assert from "node:assert/strict";
import { describe, it } from "vite-plus/test";
import { describe as describeTarget } from "./cases.ts";
import { expectedDirection } from "./jev-box.ts";
import { auroc, edgeResolution, iou, padBox, refineWindow, scoreBox, sizeBucket, summarizeBoxes } from "./score.ts";

describe("jev-box score", () => {
  it("scores IoU, a click on the centre, and cover", () => {
    const truth = { x1: 100, y1: 100, x2: 200, y2: 140 };
    assert.equal(iou(truth, truth), 1);
    assert.equal(iou(truth, { x1: 300, y1: 300, x2: 310, y2: 310 }), 0);
    const s = scoreBox({ x1: 90, y1: 95, x2: 190, y2: 145 }, truth);
    assert.equal(s.clickHit, true);
    assert.equal(s.covers, false);
    assert.equal(s.edgeErrorPx, (10 + 5 + 10 + 5) / 4);
    assert.equal(scoreBox({ x1: 90, y1: 90, x2: 210, y2: 150 }, truth).covers, true);
    assert.equal(scoreBox({ x1: 200, y1: 100, x2: 260, y2: 140 }, truth).clickHit, false);
  });

  it("refines on a window that holds the first box and meets the minimum edge, inside the image", () => {
    const w = refineWindow({ x1: 1250, y1: 10, x2: 1270, y2: 30 }, 1280, 800, 280);
    assert.ok(w.x2 - w.x1 >= 280 && w.y2 - w.y1 >= 280);
    assert.ok(w.x1 >= 0 && w.y1 >= 0 && w.x2 <= 1280 && w.y2 <= 800);
    assert.ok(w.x1 <= 1250 && w.x2 >= 1270 && w.y1 <= 10 && w.y2 >= 30);
    assert.deepEqual(padBox({ x1: 0, y1: 0, x2: 10, y2: 10 }, 1, 4, 15, 15), { x1: 0, y1: 0, x2: 15, y2: 15 });
  });

  it("measures AUROC with ties as half, and the edge step Jev answered in", () => {
    assert.equal(
      auroc([
        { score: 0.9, positive: true },
        { score: 0.1, positive: false },
      ]),
      1,
    );
    assert.equal(
      auroc([
        { score: 0.5, positive: true },
        { score: 0.5, positive: false },
      ]),
      0.5,
    );
    assert.equal(auroc([{ score: 1, positive: true }]), null);
    assert.equal(edgeResolution([0.13, 0.16, 0.02, 0.09, 0.14]), 0.01);
  });

  it("buckets by the shorter edge and summarises", () => {
    assert.equal(sizeBucket({ x1: 0, y1: 0, x2: 200, y2: 12 }), "tiny");
    assert.equal(sizeBucket({ x1: 0, y1: 0, x2: 200, y2: 24 }), "small");
    assert.equal(sizeBucket({ x1: 0, y1: 0, x2: 200, y2: 100 }), "large");
    const t = { x1: 0, y1: 0, x2: 10, y2: 10 };
    const sum = summarizeBoxes([scoreBox(t, t), scoreBox({ x1: 20, y1: 20, x2: 30, y2: 30 }, t)]);
    assert.equal(sum.n, 2);
    assert.equal(sum.clickHit, 0.5);
    assert.equal(sum.meanIou, 0.5);
  });

  it("words targets and shift directions as asked", () => {
    assert.equal(describeTarget("link", "Issues"), 'the "Issues" link');
    assert.match(describeTarget("text field", "Search"), /placeholder reads "Search"/);
    assert.equal(expectedDirection(0, -3), "up");
    assert.equal(expectedDirection(4, 0), "right");
    assert.equal(expectedDirection(2, 2), "diagonal");
  });
});
