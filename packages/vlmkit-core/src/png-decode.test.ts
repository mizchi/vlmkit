import assert from "node:assert/strict";
import { PNG } from "pngjs";
import { describe, test } from "vite-plus/test";
import { decodePngBuffer, decodePngPixels } from "./png-decode.ts";

/** An image with every kind of neighbour difference the five filters predict from. */
function image(width: number, height: number, alpha: boolean): PNG {
  const png = new PNG({ width, height, colorType: alpha ? 6 : 2, inputColorType: 6 });
  let s = 7;
  for (let i = 0; i < png.data.length; i++) {
    s = (s * 1103515245 + 12345) >>> 0;
    png.data[i] = i % 4 === 3 && !alpha ? 255 : (s >>> 16) & 0xff;
  }
  return png;
}

describe("decodePngPixels", () => {
  for (const alpha of [false, true]) {
    for (const filterType of [0, 1, 2, 3, 4, -1]) {
      test(`${alpha ? "RGBA" : "RGB"}, filter ${filterType === -1 ? "adaptive" : filterType}: the bytes pngjs wrote`, () => {
        const src = image(37, 23, alpha);
        const bytes = PNG.sync.write(src, { colorType: alpha ? 6 : 2, inputColorType: 6, filterType });
        const rgba = decodePngBuffer(bytes);
        assert.equal(rgba.width, 37);
        assert.equal(rgba.height, 23);
        assert.deepEqual(Buffer.from(rgba.data), Buffer.from(src.data));
        const px = decodePngPixels(bytes);
        assert.equal(px.channels, alpha ? 4 : 3);
        for (let p = 0; p < 37 * 23; p++) {
          for (let c = 0; c < px.channels; c++) assert.equal(px.data[p * px.channels + c], src.data[p * 4 + c]);
        }
      });
    }
  }

  test("anything else goes through pngjs", () => {
    const grey = new PNG({ width: 3, height: 2, colorType: 0, inputColorType: 6 });
    grey.data.fill(255);
    const px = decodePngPixels(PNG.sync.write(grey, { colorType: 0, inputColorType: 6 }));
    assert.equal(px.channels, 4);
    assert.equal(px.data.length, 3 * 2 * 4);
    assert.deepEqual([...px.data.subarray(0, 4)], [255, 255, 255, 255]);
  });

  test("refuses what is not a PNG", () => {
    assert.throws(() => decodePngPixels(Buffer.from("GIF89a")), /not a PNG/);
  });
});
