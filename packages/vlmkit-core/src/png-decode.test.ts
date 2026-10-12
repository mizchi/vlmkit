import assert from "node:assert/strict";
import { crc32, deflateSync } from "node:zlib";
import { PNG } from "pngjs";
import { describe, test } from "vite-plus/test";
import { decodePngBuffer, decodePngPixels, tableCrc32 } from "./png-decode.ts";

const chunk = (type: string, body: Uint8Array, crc?: number) => {
  const out = Buffer.alloc(12 + body.length);
  out.writeUInt32BE(body.length, 0);
  out.write(type, 4, "latin1");
  out.set(body, 8);
  out.writeUInt32BE(crc ?? crc32(out.subarray(4, 8 + body.length)), 8 + body.length);
  return out;
};

/**
 * An 8-bit RGB PNG put together by hand, so its IHDR can disagree with its data: `rows` rows of
 * filter-0 pixels under an IHDR that says `width` x `height`.
 */
function handmade(
  o: { width?: number; height?: number; rows?: number; ihdrPad?: number; ihdrCrc?: number; before?: Buffer[] } = {},
): Buffer {
  const width = o.width ?? 5;
  const height = o.height ?? 4;
  const ihdr = Buffer.alloc(13 + (o.ihdrPad ?? 0));
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const stride = width * 3;
  const raw = Buffer.alloc((o.rows ?? height) * (1 + stride));
  for (let i = 0; i < raw.length; i++) raw[i] = i % (1 + stride) === 0 ? 0 : (i * 37) & 0xff;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr, o.ihdrCrc),
    ...(o.before ?? []),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", new Uint8Array(0)),
  ]);
}

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

  test("the hand-made file decodes, so each corruption below is the only thing wrong", () => {
    const px = decodePngPixels(handmade());
    assert.deepEqual([px.width, px.height, px.channels, px.data.length], [5, 4, 3, 5 * 4 * 3]);
  });

  test("an IHDR that fails its CRC throws instead of decoding what it now claims", () => {
    // The height edited from 4 to 3 and the CRC left alone: decoded before as a 5x3 image.
    const bytes = handmade();
    bytes.writeUInt32BE(3, 20);
    assert.throws(() => decodePngPixels(bytes), /IHDR fails its CRC/);
    assert.throws(() => decodePngBuffer(bytes), /IHDR fails its CRC/);
  });

  test("an IHDR that is not 13 bytes throws, though pngjs would decode it", () => {
    const bytes = handmade({ ihdrPad: 1 });
    assert.equal(PNG.sync.read(bytes).width, 5, "pngjs reads the first 13 bytes and skips the rest");
    assert.throws(() => decodePngPixels(bytes), /IHDR is 14 bytes, not 13/);
  });

  test("a zero width or height throws, though pngjs would return an empty image", () => {
    assert.equal(PNG.sync.read(handmade({ width: 0 })).width, 0);
    assert.throws(() => decodePngPixels(handmade({ width: 0 })), /0x4 image/);
    assert.throws(() => decodePngPixels(handmade({ height: 0, rows: 4 })), /5x0 image/);
  });

  test("image data that is not exactly the IHDR's size throws, a row too many or too few", () => {
    // One row too many decoded before as the first four. One too few, pngjs reads its last row
    // from memory it never filled: some runs return a 5x4 image, some throw on a filter byte.
    assert.throws(() => decodePngPixels(handmade({ rows: 5 })), /is 80 bytes; its 5x4 IHDR needs 64/);
    assert.throws(() => decodePngPixels(handmade({ rows: 3 })), /is 48 bytes; its 5x4 IHDR needs 64/);
  });

  test("a file cut short throws: before its IEND, or inside a chunk", () => {
    const whole = handmade();
    assert.throws(() => decodePngPixels(whole.subarray(0, whole.length - 12)), /before its IEND/);
    assert.throws(() => decodePngPixels(whole.subarray(0, whole.length - 20)), /before its IEND/);
    assert.throws(() => decodePngPixels(whole.subarray(0, 30)), /inside its IHDR/);
  });

  test("an RGB image with a tRNS colour key goes through pngjs, so the keyed pixels are transparent", () => {
    const src = image(9, 4, false);
    src.data.set([12, 34, 56, 255], 0);
    src.data.set([12, 34, 56, 255], 4 * 17);
    const plain = PNG.sync.write(src, { colorType: 2, inputColorType: 6 });
    const key = Buffer.from([0, 12, 0, 34, 0, 56]); // 16 bits a channel
    const keyed = Buffer.concat([plain.subarray(0, 33), chunk("tRNS", key), plain.subarray(33)]);
    const rgba = decodePngBuffer(keyed);
    assert.equal(rgba.data[3], 0, "the first pixel is the key");
    assert.equal(rgba.data[4 * 17 + 3], 0, "so is pixel 17");
    assert.equal(rgba.data[4 + 3], 255, "the rest stay opaque");
    assert.equal(decodePngPixels(keyed).channels, 4);
    assert.equal(decodePngPixels(plain).channels, 3, "without the key, the fast path");
  });
});

describe("tableCrc32", () => {
  test("is zlib's CRC-32, for a Node without zlib.crc32", () => {
    assert.equal(tableCrc32(Buffer.from("123456789", "latin1")), 0xcbf43926, "the CRC-32 check value");
    assert.equal(tableCrc32(new Uint8Array(0)), 0);
    const bytes = Buffer.from(Array.from({ length: 1000 }, (_, i) => (i * 131) & 0xff));
    assert.equal(tableCrc32(bytes), crc32(bytes));
  });
});
