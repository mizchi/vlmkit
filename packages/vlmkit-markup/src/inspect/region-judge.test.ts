import assert from "node:assert";
import { test } from "vitest";
import { PNG } from "pngjs";
import {
  buildPairImage,
  CONTRADICT_CEILING,
  judgeOutcome,
  measureRegionDelta,
  parseRegionSpec,
  parseVlmAnswer,
  REFUTE_FLOOR,
} from "./region-judge.ts";

function solid(width: number, height: number, rgb: [number, number, number]): PNG {
  const png = new PNG({ width, height });
  for (let i = 0; i < width * height; i++) {
    png.data[i * 4] = rgb[0];
    png.data[i * 4 + 1] = rgb[1];
    png.data[i * 4 + 2] = rgb[2];
    png.data[i * 4 + 3] = 0xff;
  }
  return png;
}

test("parseRegionSpec accepts x,y,WxH / x,y,w,h / kickback (x,y) WxH", () => {
  assert.deepEqual(parseRegionSpec("505,865,98x15"), { left: 505, top: 865, width: 98, height: 15 });
  assert.deepEqual(parseRegionSpec("0, 243, 1280, 1"), { left: 0, top: 243, width: 1280, height: 1 });
  assert.deepEqual(parseRegionSpec("(1195,720) 64x65"), { left: 1195, top: 720, width: 64, height: 65 });
  assert.throws(() => parseRegionSpec("nonsense"));
});

test("measureRegionDelta: zero on identical, exact on uniform shift, clamped at edges", () => {
  const a = solid(50, 40, [100, 100, 100]);
  const b = solid(50, 40, [100, 100, 100]);
  const region = { left: 10, top: 10, width: 20, height: 20 };
  assert.equal(measureRegionDelta(a, b, region), 0);
  const c = solid(50, 40, [110, 100, 90]);
  // per-channel deltas 10, 0, 10 -> mean 20/3
  assert.ok(Math.abs(measureRegionDelta(a, c, region) - 20 / 3) < 1e-9);
  // out-of-bounds region contributes nothing instead of crashing
  assert.equal(measureRegionDelta(a, b, { left: 45, top: 35, width: 20, height: 20 }), 0);
});

test("buildPairImage stacks A above B with a gray separator", () => {
  const a = solid(60, 40, [200, 0, 0]);
  const b = solid(60, 40, [0, 0, 200]);
  const pair = buildPairImage(a, b, { left: 10, top: 10, width: 20, height: 10 }, 4);
  // crop = 20+8 pad wide, 10+8 tall
  assert.equal(pair.width, 28);
  assert.equal(pair.height, 18 + 8 + 18);
  const px = (x: number, y: number) => [pair.data[(y * pair.width + x) * 4], pair.data[(y * pair.width + x) * 4 + 1], pair.data[(y * pair.width + x) * 4 + 2]];
  assert.deepEqual(px(5, 5), [200, 0, 0]);
  assert.deepEqual(px(5, 18 + 3), [0x80, 0x80, 0x80]);
  assert.deepEqual(px(5, 18 + 8 + 5), [0, 0, 200]);
});

test("parseVlmAnswer forced-choice extraction", () => {
  assert.equal(parseVlmAnswer("SAME — antialiasing only."), "same");
  assert.equal(parseVlmAnswer("different: the word 'guide' wraps to the next line in B"), "different");
  assert.equal(parseVlmAnswer("I think they look similar."), "unparseable");
});

test("judgeOutcome cross-checks vision against the measurement", () => {
  // agreement
  assert.equal(judgeOutcome("same", 0.5), "same");
  assert.equal(judgeOutcome("different", 12), "different");
  // hallucinated difference: below the refutation floor
  assert.equal(judgeOutcome("different", REFUTE_FLOOR - 1), "refuted");
  // missed difference: above the contradiction ceiling
  assert.equal(judgeOutcome("same", CONTRADICT_CEILING + 5), "contradicted");
  // no parseable answer -> a human owns it
  assert.equal(judgeOutcome("unparseable", 12), "pending-review");
});
