import assert from "node:assert/strict";
import { PNG } from "pngjs";
import { describe, test } from "vite-plus/test";
import { sniffImageAnimation } from "./animated-image.ts";
import { encodeApng } from "./apng.ts";

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

const actl = (frames: number) => {
  const body = Buffer.alloc(8);
  body.writeUInt32BE(frames, 0);
  return chunk("acTL", body);
};

/** A 2x2 frame of one grey level. */
const frame = (level: number) => ({ width: 2, height: 2, data: new Uint8Array(16).fill(level) });

/** A RIFF chunk: FourCC, little-endian size, payload padded to an even length. */
const riffChunk = (type: string, body: Buffer) => {
  const out = Buffer.alloc(8 + body.length + (body.length & 1));
  out.write(type, 0, "latin1");
  out.writeUInt32LE(body.length, 4);
  body.copy(out, 8);
  return out;
};

const riffHeader = (size: number) => {
  const out = Buffer.from("RIFF\0\0\0\0WEBP", "latin1");
  out.writeUInt32LE(size, 4);
  return out;
};

/** An extended WebP: VP8X with these flags (animation is bit 1), then the chunks, its RIFF size right. */
function webp(flags: number, chunks: Buffer[]): Buffer {
  const vp8x = Buffer.alloc(10);
  vp8x[0] = flags;
  const body = Buffer.concat([riffChunk("VP8X", vp8x), ...chunks]);
  return Buffer.concat([riffHeader(4 + body.length), body]);
}

const anim = riffChunk("ANIM", Buffer.alloc(6));

describe("sniffImageAnimation", () => {
  test("a GIF with two images animates; with one it does not", () => {
    assert.deepEqual(sniffImageAnimation(TWO_FRAMES), { format: "gif", animated: true });
    assert.deepEqual(sniffImageAnimation(firstFrameOnly(TWO_FRAMES)), { format: "gif", animated: false });
  });

  test("a PNG with no acTL, an acTL of one frame, or one after its IDAT does not animate", () => {
    const still = PNG.sync.write(new PNG({ width: 1, height: 1 }));
    assert.deepEqual(sniffImageAnimation(still), { format: "png", animated: false });
    const ihdrEnd = 8 + 25;
    const one = Buffer.concat([still.subarray(0, ihdrEnd), actl(1), still.subarray(ihdrEnd)]);
    assert.equal(sniffImageAnimation(one).animated, false);
    const iend = still.length - 12;
    const late = Buffer.concat([still.subarray(0, iend), actl(2), still.subarray(iend)]);
    assert.equal(sniffImageAnimation(late).animated, false, "an acTL after the IDAT is not an APNG's");
  });

  test("an APNG animates when it holds two frames, not when its acTL alone says so", () => {
    const two = Buffer.from(encodeApng([frame(0), frame(255)]));
    assert.deepEqual(sniffImageAnimation(two), { format: "png", animated: true });
    assert.equal(sniffImageAnimation(Buffer.from(encodeApng([frame(0)]))).animated, false, "an acTL of 1");
    // The one-frame file's acTL rewritten to promise 2: one picture that never moves, read as animated before.
    const single = Buffer.from(encodeApng([frame(0)]));
    const at = single.indexOf("acTL", 8, "latin1") - 4;
    const promised = Buffer.concat([single.subarray(0, at), actl(2), single.subarray(at + 20)]);
    assert.equal(promised.indexOf("fcTL", 0, "latin1") > 0, true, "it still holds its one fcTL");
    assert.deepEqual(sniffImageAnimation(promised), { format: "png", animated: false });
    // Only the acTL, no fcTL at all.
    const ihdrEnd = 8 + 25;
    const still = PNG.sync.write(new PNG({ width: 1, height: 1 }));
    const bare = Buffer.concat([still.subarray(0, ihdrEnd), actl(2), still.subarray(ihdrEnd)]);
    assert.equal(sniffImageAnimation(bare).animated, false, "an acTL of 2 and no frame controls");
  });

  test("an APNG cut off before its second frame is believed: its acTL is all there is", () => {
    const two = Buffer.from(encodeApng([frame(0), frame(255)]));
    const secondControl = two.lastIndexOf("fcTL", two.length, "latin1") - 4;
    assert.equal(sniffImageAnimation(two.subarray(0, secondControl)).animated, true, "ends between chunks");
    assert.equal(sniffImageAnimation(two.subarray(0, secondControl - 5)).animated, true, "ends inside the IDAT");
    const one = Buffer.from(encodeApng([frame(0)]));
    assert.equal(sniffImageAnimation(one.subarray(0, one.length - 20)).animated, false, "an acTL of 1, cut off");
  });

  test("a WebP animates when VP8X sets the animation flag and two ANMF frames follow", () => {
    const anmf = riffChunk("ANMF", Buffer.alloc(17)); // odd: padded to 18
    const iccp = riffChunk("ICCP", Buffer.alloc(5));
    assert.deepEqual(sniffImageAnimation(webp(0x02, [anim, anmf, anmf])), { format: "webp", animated: true });
    assert.deepEqual(sniffImageAnimation(webp(0x22, [iccp, anim, anmf, anmf])), { format: "webp", animated: true });
    assert.deepEqual(sniffImageAnimation(webp(0x10, [riffChunk("VP8L", Buffer.alloc(5))])), {
      format: "webp",
      animated: false,
    });
    assert.equal(sniffImageAnimation(webp(0x00, [anim, anmf, anmf])).animated, false, "frames without the flag");
    const simple = Buffer.concat([riffHeader(4 + 10), riffChunk("VP8 ", Buffer.alloc(2))]);
    assert.deepEqual(sniffImageAnimation(simple), { format: "webp", animated: false });
  });

  test("a WebP whose flag promises animation over one ANMF frame does not animate", () => {
    // Read as animated before: the flag was all that was read.
    const anmf = riffChunk("ANMF", Buffer.alloc(16));
    assert.deepEqual(sniffImageAnimation(webp(0x02, [anim, anmf])), { format: "webp", animated: false });
    assert.equal(sniffImageAnimation(webp(0x02, [])).animated, false, "the flag and no frames");
  });

  test("a WebP cut off inside its chunk list is believed: the flag is all there is", () => {
    const anmf = riffChunk("ANMF", Buffer.alloc(1000));
    const whole = webp(0x02, [anim, anmf, anmf]);
    const firstFrame = 12 + 18 + 14; // RIFF header, VP8X, ANIM
    assert.equal(whole.toString("latin1", firstFrame, firstFrame + 4), "ANMF");
    assert.equal(sniffImageAnimation(whole.subarray(0, firstFrame + 100)).animated, true, "inside the first frame");
    assert.equal(sniffImageAnimation(whole.subarray(0, firstFrame)).animated, true, "between chunks");
    const still = webp(0x00, [anim, anmf, anmf]);
    assert.equal(sniffImageAnimation(still.subarray(0, firstFrame + 100)).animated, false, "no flag, cut off");
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
