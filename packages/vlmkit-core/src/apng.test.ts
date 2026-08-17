/**
 * The APNG encoder, checked at the byte level — because that is where its only risk is.
 *
 * A wrong CRC, a chunk in the wrong order, or a broken fcTL/fdAT sequence produces a file that
 * looks fine in a hex dump and is rejected on load. Two of these tests decode the result with
 * `pngjs`, which is the strongest offline evidence available that a real decoder accepts it: pngjs
 * knows nothing about APNG, so it validates the signature, IHDR and frame-0 IDAT and must ignore
 * the animation chunks — exactly what a non-APNG viewer does.
 */
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { ApngFrameMismatchError, encodeApng, readApngChunks } from "./apng.ts";
import type { PngData } from "./png-utils.ts";

/** A solid-colour frame, so a decoded pixel is checkable against the input. */
function frame(width: number, height: number, rgba: [number, number, number, number]): PngData {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = rgba[0];
    data[i + 1] = rgba[1];
    data[i + 2] = rgba[2];
    data[i + 3] = rgba[3];
  }
  return { width, height, data };
}

const RED = frame(8, 6, [220, 40, 40, 255]);
const GREEN = frame(8, 6, [40, 200, 90, 255]);
const BLUE = frame(8, 6, [50, 90, 220, 255]);

describe("encodeApng", () => {
  it("emits the chunk order the spec requires", () => {
    const bytes = encodeApng([RED, GREEN, BLUE]);
    assert.deepEqual(
      readApngChunks(bytes).map((c) => c.type),
      ["IHDR", "acTL", "fcTL", "IDAT", "fcTL", "fdAT", "fcTL", "fdAT", "IEND"],
    );
  });

  it("shares one sequence counter between fcTL and fdAT", () => {
    // The detail hand-rolled encoders get wrong. Two counters would give
    // fcTL 0,1,2 / fdAT 0,1 and a viewer rejects the whole file rather than dropping a frame.
    const chunks = readApngChunks(encodeApng([RED, GREEN, BLUE]));
    assert.deepEqual(
      chunks.filter((c) => c.sequence !== undefined).map((c) => `${c.type}:${c.sequence}`),
      ["fcTL:0", "fcTL:1", "fdAT:2", "fcTL:3", "fdAT:4"],
    );
  });

  it("starts with a valid PNG signature and a truecolour-alpha IHDR", () => {
    const bytes = encodeApng([RED]);
    assert.deepEqual([...bytes.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    // IHDR payload starts at 16: width, height, then depth 8 / colour type 6.
    const view = new DataView(bytes.buffer, bytes.byteOffset);
    assert.equal(view.getUint32(16), 8, "width");
    assert.equal(view.getUint32(20), 6, "height");
    assert.equal(bytes[24], 8, "bit depth");
    assert.equal(bytes[25], 6, "colour type 6 = RGBA");
  });

  it("a decoder that knows nothing about APNG still reads frame 0", async () => {
    // What makes the fallback real: a viewer without APNG support shows the first frame instead of
    // a broken image, so the file is usable as a still.
    const { PNG } = await import("pngjs");
    const decoded = PNG.sync.read(Buffer.from(encodeApng([RED, GREEN, BLUE])));
    assert.equal(decoded.width, 8);
    assert.equal(decoded.height, 6);
    assert.deepEqual([decoded.data[0], decoded.data[1], decoded.data[2], decoded.data[3]], [220, 40, 40, 255],
      "frame 0's pixels, not a later frame's");
  });

  it("round-trips a single frame as an ordinary PNG", async () => {
    const { PNG } = await import("pngjs");
    const decoded = PNG.sync.read(Buffer.from(encodeApng([GREEN], { loops: 1 })));
    assert.deepEqual([decoded.data[0], decoded.data[1], decoded.data[2]], [40, 200, 90]);
  });

  it("writes the delay as milliseconds over a 1000 denominator", () => {
    const bytes = encodeApng([RED, GREEN], { delayMs: 250 });
    const chunks = readApngChunks(bytes);
    const view = new DataView(bytes.buffer, bytes.byteOffset);
    // The first fcTL payload is at a fixed offset — signature (8) + IHDR chunk (25) + acTL chunk
    // (20) + fcTL's own 8-byte header — and inside it the delay follows
    // 4 sequence + 4 width + 4 height + 4 x + 4 y.
    const firstFctlPayload = 8 + 25 + 20 + 8;
    assert.equal(view.getUint16(firstFctlPayload + 20), 250, "delay numerator is the ms value");
    assert.equal(view.getUint16(firstFctlPayload + 22), 1000, "denominator");
    assert.equal(chunks[2]!.type, "fcTL");
  });

  it("per-frame delays override the uniform one, and fall back to it", () => {
    // An animation sampled at 0/100/600ms has to play on that timeline; a uniform delay
    // misrepresents when the motion actually happened.
    const bytes = encodeApng([RED, GREEN, BLUE], { delayMs: 200, delaysMs: [50, 400] });
    const view = new DataView(bytes.buffer, bytes.byteOffset);
    const base = 8 + 25 + 20 + 8;
    assert.equal(view.getUint16(base + 20), 50, "frame 0 from delaysMs");
    // Later fcTLs are found by walking, since fdAT lengths vary with the frame's compressibility.
    const delays: number[] = [];
    let offset = 8;
    while (offset + 8 <= bytes.length) {
      const length = view.getUint32(offset);
      const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
      if (type === "fcTL") delays.push(view.getUint16(offset + 8 + 20));
      offset += 12 + length;
    }
    assert.deepEqual(delays, [50, 400, 200], "third frame falls back to delayMs");
  });

  it("clamps a delay past the 16-bit field instead of wrapping it", () => {
    // A wrapped delay turns a 70-second pause into 4ms, which reads as a corrupt animation.
    const bytes = encodeApng([RED], { delayMs: 70_000 });
    const view = new DataView(bytes.buffer, bytes.byteOffset);
    assert.equal(view.getUint16(8 + 25 + 20 + 8 + 20), 65535);
  });

  it("loops forever by default and honours an explicit count", () => {
    const view = (bytes: Uint8Array) => new DataView(bytes.buffer, bytes.byteOffset);
    // acTL payload sits after signature + IHDR chunk (25 bytes) + 8 bytes of acTL header.
    const actlPayload = 8 + 25 + 8;
    assert.equal(view(encodeApng([RED])).getUint32(actlPayload + 4), 0, "0 = forever");
    assert.equal(view(encodeApng([RED], { loops: 3 })).getUint32(actlPayload + 4), 3);
    assert.equal(view(encodeApng([RED, GREEN])).getUint32(actlPayload), 2, "frame count");
  });

  it("refuses frames of different sizes, naming both", () => {
    // APNG can place a smaller frame at an offset. Doing that silently would let a mis-sized frame
    // animate in a corner of the canvas instead of failing.
    assert.throws(
      () => encodeApng([RED, frame(4, 6, [0, 0, 0, 255])]),
      (err: unknown) => {
        assert.ok(err instanceof ApngFrameMismatchError);
        assert.match((err as Error).message, /frame 1 is 4x6, frame 0 is 8x6/);
        return true;
      },
    );
  });

  it("refuses a frame with too few bytes for its own dimensions", () => {
    assert.throws(
      () => encodeApng([{ width: 8, height: 6, data: new Uint8Array(10) }]),
      /carries 10 bytes, 192 needed/,
    );
  });

  it("refuses an empty frame list", () => {
    assert.throws(() => encodeApng([]), /at least one frame/);
  });
});

describe("readApngChunks", () => {
  it("rejects a file whose CRC was tampered with", () => {
    // The check that makes the other tests meaningful: without CRC validation, `readApngChunks`
    // would happily walk a file no viewer would load.
    const bytes = encodeApng([RED, GREEN]);
    const corrupted = new Uint8Array(bytes);
    corrupted[30] ^= 0xff;
    assert.throws(() => readApngChunks(corrupted), /bad CRC/);
  });
});
