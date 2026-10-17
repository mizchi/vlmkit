import assert from "node:assert/strict";
import { describe, it } from "vite-plus/test";
import { PNG } from "pngjs";
import type { JevRequest } from "./jev-client.ts";
import { firstLookScale, locateByDescription, LocateError, refineWindow, type JevAsk } from "./locate.ts";

const png = (width: number, height: number) => new Uint8Array(PNG.sync.write(new PNG({ width, height })));

/** A fake Jev: answers every `box` with `boxes[call]` (fractions of the image it was sent), every `noul` with `noul`. */
function fake(boxes: [number, number, number, number][], noul = 0.95) {
  const sent: { size: { width: number; height: number }; questions: string[] }[] = [];
  const ask: JevAsk = async (req) => {
    const img = Object.values(req.assets ?? {})[0]!;
    const p = PNG.sync.read(Buffer.from(img.bytes));
    sent.push({ size: { width: p.width, height: p.height }, questions: Object.keys(req.questions) });
    const [left, top, right, bottom] = boxes[sent.length - 1]!;
    const answers: Record<string, unknown> = {};
    for (const [k, q] of Object.entries((req as JevRequest).questions)) {
      answers[k] =
        q.type === "box" ? { type: "box", box: { left, top, right, bottom }, confidence: 0.8 } : { type: "noul", noul };
    }
    return {
      model: "fake-jev",
      answers,
      usage: { input_tokens: 1000, output_tokens: 1 },
      latencyMs: 1,
      costUsd: 0.001,
    } as never;
  };
  return { ask, sent };
}

describe("locate", () => {
  it("shows a screenshot as it is when it fits, shrinks a 2x capture, lifts a small one, refuses a strip", () => {
    assert.equal(firstLookScale(1280, 800), 1);
    assert.ok(Math.abs(firstLookScale(2560, 1600)! - 1568 / 2560) < 1e-9);
    assert.equal(firstLookScale(140, 300), 2);
    assert.equal(firstLookScale(2000, 100), null);
  });

  it("pads the first box by its own size, to at least 280px, inside the image", () => {
    const w = refineWindow({ x: 1200, y: 10, width: 60, height: 20 }, { width: 1280, height: 800 });
    assert.ok(w.x2 - w.x1 >= 280 && w.y2 - w.y1 >= 280);
    assert.ok(w.x1 <= 1200 && w.x2 === 1280 && w.y1 === 0);
  });

  it("asks presence and where on the whole image, then where again on the crop, and maps the crop back", async () => {
    // First look: the left quarter of the top tenth. Second: the middle of the crop.
    const { ask, sent } = fake([
      [0.1, 0.1, 0.2, 0.15],
      [0.4, 0.4, 0.6, 0.6],
    ]);
    const r = await locateByDescription(png(1000, 800), 'the "Save" button.', { ask });
    assert.equal(r.found, true);
    assert.equal(r.presence, 0.95);
    assert.deepEqual(r.firstBox, { x: 100, y: 80, width: 100, height: 40 });
    assert.deepEqual(
      sent.map((s) => s.questions),
      [["where", "present"], ["where"]],
    );
    assert.deepEqual(sent[0]!.size, { width: 1000, height: 800 });
    // The crop is the first box padded by its size (x 0..300) and grown to 280px tall (y 0..280 after clamping).
    const win = refineWindow(r.firstBox, { width: 1000, height: 800 });
    const cw = win.x2 - win.x1;
    const ch = win.y2 - win.y1;
    assert.equal(r.refined, true);
    assert.ok(Math.abs(r.box.x - (win.x1 + 0.4 * cw)) < 1e-9 && Math.abs(r.box.width - 0.2 * cw) < 1e-9);
    assert.ok(Math.abs(r.point.y - (win.y1 + 0.5 * ch)) < 1e-9);
    assert.equal(r.calls, 2);
    assert.equal(r.costUsd, 0.002);
    // The crop was magnified: a second look sees the region at least as large as the first did.
    assert.ok(sent[1]!.size.width >= cw && sent[1]!.size.height >= ch);
  });

  it("reports not found below the presence threshold and asks nothing more", async () => {
    const { ask, sent } = fake([[0.1, 0.1, 0.2, 0.2]], 0.02);
    const r = await locateByDescription(png(1280, 800), "the Delete account link", { ask });
    assert.equal(r.found, false);
    assert.equal(r.refined, false);
    assert.equal(sent.length, 1);
  });

  it("skips presence when told to, and maps a 2x capture's box onto its own pixels", async () => {
    const { ask, sent } = fake([
      [0.5, 0.5, 0.75, 0.75],
      [0, 0, 1, 1],
    ]);
    const r = await locateByDescription(png(2560, 1600), "the search field labelled Query", { ask, presence: false });
    assert.equal(r.presence, null);
    assert.equal(r.found, true);
    assert.deepEqual(sent[0]!.questions, ["where"]);
    assert.ok(sent[0]!.size.width <= 1568);
    assert.deepEqual(r.firstBox, { x: 1280, y: 800, width: 640, height: 400 });
  });

  it("refuses an image no scale can show", async () => {
    const { ask } = fake([[0, 0, 1, 1]]);
    await assert.rejects(locateByDescription(png(3000, 100), "x", { ask }), LocateError);
  });
});
