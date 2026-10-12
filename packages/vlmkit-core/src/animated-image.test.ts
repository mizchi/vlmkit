import assert from "node:assert/strict";
import { PNG } from "pngjs";
import { describe, test } from "vite-plus/test";
import { sniffImageAnimation } from "./animated-image.ts";

/** The two-frame GIF of fixtures/flash/animated-gif.html (black, then white, 100ms each). */
const TWO_FRAMES = Buffer.from(
  "R0lGODlhAgACAIAAAAAAAP///yH/C05FVFNDQVBFMi4wAwEAAAAh+QQACgAAACwAAAAAAgACAAACBARBEAUAIfkEAAoAAAAsAAAAAAIAAgAAAgQMwzAFADs=",
  "base64",
);

/** The same GIF cut after its first image: a still GIF. */
function firstFrameOnly(gif: Buffer): Buffer {
  const second = gif.indexOf(Buffer.from([0x21, 0xf9]), gif.indexOf(Buffer.from([0x2c])));
  return Buffer.concat([gif.subarray(0, second), Buffer.from([0x3b])]);
}

const chunk = (type: string, body: Buffer) => {
  const out = Buffer.alloc(12 + body.length);
  out.writeUInt32BE(body.length, 0);
  out.write(type, 4, "latin1");
  body.copy(out, 8);
  return out; // CRC left zero: the sniffer does not read it
};

describe("sniffImageAnimation", () => {
  test("a GIF with two images animates; with one it does not", () => {
    assert.deepEqual(sniffImageAnimation(TWO_FRAMES), { format: "gif", animated: true });
    assert.deepEqual(sniffImageAnimation(firstFrameOnly(TWO_FRAMES)), { format: "gif", animated: false });
  });

  test("a PNG animates only with an acTL of more than one frame before its first IDAT", () => {
    const still = PNG.sync.write(new PNG({ width: 1, height: 1 }));
    assert.deepEqual(sniffImageAnimation(still), { format: "png", animated: false });
    const ihdrEnd = 8 + 25;
    const actl = (frames: number) => {
      const body = Buffer.alloc(8);
      body.writeUInt32BE(frames, 0);
      return chunk("acTL", body);
    };
    const apng = Buffer.concat([still.subarray(0, ihdrEnd), actl(2), still.subarray(ihdrEnd)]);
    assert.deepEqual(sniffImageAnimation(apng), { format: "png", animated: true });
    const one = Buffer.concat([still.subarray(0, ihdrEnd), actl(1), still.subarray(ihdrEnd)]);
    assert.equal(sniffImageAnimation(one).animated, false);
  });

  test("a WebP animates when VP8X sets the animation flag", () => {
    // RIFF, size, WEBP, then the VP8X chunk: its size, then the flags byte (animation is bit 1).
    const animated = Buffer.concat([
      Buffer.from("RIFF\0\0\0\0WEBPVP8X", "latin1"),
      Buffer.from([10, 0, 0, 0, 0x02, 0, 0, 0]),
    ]);
    const still = Buffer.concat([
      Buffer.from("RIFF\0\0\0\0WEBPVP8X", "latin1"),
      Buffer.from([10, 0, 0, 0, 0x10, 0, 0, 0]),
    ]);
    assert.deepEqual(sniffImageAnimation(animated), { format: "webp", animated: true });
    assert.deepEqual(sniffImageAnimation(still), { format: "webp", animated: false });
  });

  test("an AVIF sequence names the avis brand", () => {
    const ftyp = (brands: string[]) => {
      const body = Buffer.from(["avif", "\0\0\0\0", ...brands].join(""), "latin1");
      const out = Buffer.alloc(8 + body.length);
      out.writeUInt32BE(8 + body.length, 0);
      out.write("ftyp", 4, "latin1");
      body.copy(out, 8);
      return out;
    };
    assert.deepEqual(sniffImageAnimation(ftyp(["mif1", "avis"])), { format: "avif", animated: true });
    assert.deepEqual(sniffImageAnimation(ftyp(["mif1", "miaf"])), { format: "avif", animated: false });
  });

  test("anything else is other, and does not animate", () => {
    assert.deepEqual(sniffImageAnimation(Buffer.from("<svg/>")), { format: "other", animated: false });
    assert.deepEqual(sniffImageAnimation(Buffer.alloc(0)), { format: "other", animated: false });
  });
});
