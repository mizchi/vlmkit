/**
 * A PNG decoder for the one shape a browser screenshot has — 8-bit RGB or RGBA, not interlaced —
 * in a tight loop over typed arrays, falling back to pngjs for anything else.
 *
 * Why: `check flash` decodes every 60fps frame of a sweep, 181 frames for a 3-second window at
 * 1280x720, and pngjs's generic unfilter and bitmapper took 19 of the 24 seconds of judging one.
 * The inflate is zlib's either way; only the unfilter and the copy to RGBA are done here.
 */
import { inflateSync } from "node:zlib";
import { PNG } from "pngjs";
import type { PngData } from "./png-utils.ts";

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Decoded pixels as they were stored: 3 (RGB) or 4 (RGBA) bytes a pixel, rows packed. */
export interface PngPixels {
  width: number;
  height: number;
  channels: 3 | 4;
  data: Uint8Array;
}

/** A PNG as RGBA. */
export function decodePngBuffer(buffer: Uint8Array): PngData {
  const px = decodePngPixels(buffer);
  if (px.channels === 4) return { width: px.width, height: px.height, data: px.data };
  const out = new Uint8Array(px.width * px.height * 4);
  for (let p = 0, i = 0; i < px.data.length; p += 4, i += 3) {
    out[p] = px.data[i]!;
    out[p + 1] = px.data[i + 1]!;
    out[p + 2] = px.data[i + 2]!;
    out[p + 3] = 255;
  }
  return { width: px.width, height: px.height, data: out };
}

/** A PNG's pixels without widening RGB to RGBA: a screenshot is RGB, and the copy is a third of the decode. */
export function decodePngPixels(buffer: Uint8Array): PngPixels {
  for (let i = 0; i < 8; i++) if (buffer[i] !== SIGNATURE[i]) throw new Error("not a PNG");
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  let at = 8;
  let width = 0;
  let height = 0;
  let depth = 0;
  let colour = 0;
  let interlace = 0;
  const idat: Uint8Array[] = [];
  while (at + 8 <= buffer.length) {
    const length = view.getUint32(at);
    const type = String.fromCharCode(buffer[at + 4]!, buffer[at + 5]!, buffer[at + 6]!, buffer[at + 7]!);
    const body = buffer.subarray(at + 8, at + 8 + length);
    if (type === "IHDR") {
      width = view.getUint32(at + 8);
      height = view.getUint32(at + 12);
      depth = body[8]!;
      colour = body[9]!;
      interlace = body[12]!;
    } else if (type === "IDAT") {
      idat.push(body);
    } else if (type === "IEND") {
      break;
    }
    at += 12 + length;
  }
  const channels = colour === 6 ? 4 : colour === 2 ? 3 : 0;
  if (depth !== 8 || channels === 0 || interlace !== 0) return { ...viaPngjs(buffer), channels: 4 };
  const inflated = inflateSync(idat.length === 1 ? idat[0]! : Buffer.concat(idat));
  const raw = new Uint8Array(inflated.buffer, inflated.byteOffset, inflated.byteLength);
  const stride = width * channels;
  if (raw.length < (stride + 1) * height) throw new Error("PNG data is truncated");
  const out = new Uint8Array(width * height * channels);
  // The current row is unfiltered in place in `raw`; the row above is the previous one there.
  const zero = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]!;
    const cur = y * (stride + 1) + 1;
    const up = y === 0 ? -1 : cur - (stride + 1);
    const above = up < 0 ? zero : raw;
    const ua = up < 0 ? 0 : up;
    const c = channels;
    if (filter === 1) {
      for (let i = c; i < stride; i++) raw[cur + i] = (raw[cur + i]! + raw[cur + i - c]!) & 0xff;
    } else if (filter === 2) {
      for (let i = 0; i < stride; i++) raw[cur + i] = (raw[cur + i]! + above[ua + i]!) & 0xff;
    } else if (filter === 3) {
      for (let i = 0; i < c; i++) raw[cur + i] = (raw[cur + i]! + (above[ua + i]! >> 1)) & 0xff;
      for (let i = c; i < stride; i++)
        raw[cur + i] = (raw[cur + i]! + ((raw[cur + i - c]! + above[ua + i]!) >> 1)) & 0xff;
    } else if (filter === 4) {
      for (let i = 0; i < c; i++) raw[cur + i] = (raw[cur + i]! + above[ua + i]!) & 0xff;
      for (let i = c; i < stride; i++) {
        const a = raw[cur + i - c]!;
        const b = above[ua + i]!;
        const d = above[ua + i - c]!;
        const pa = b > d ? b - d : d - b;
        const pb = a > d ? a - d : d - a;
        const pc0 = a + b - d - d;
        const pc = pc0 < 0 ? -pc0 : pc0;
        raw[cur + i] = (raw[cur + i]! + (pa <= pb && pa <= pc ? a : pb <= pc ? b : d)) & 0xff;
      }
    } else if (filter !== 0) {
      throw new Error(`PNG row ${y} has filter ${filter}`);
    }
    out.set(raw.subarray(cur, cur + stride), y * stride);
  }
  return { width, height, channels, data: out };
}

function viaPngjs(buffer: Uint8Array): PngData {
  const png = PNG.sync.read(Buffer.from(buffer.buffer, buffer.byteOffset, buffer.byteLength));
  return {
    width: png.width,
    height: png.height,
    data: new Uint8Array(png.data.buffer, png.data.byteOffset, png.data.byteLength),
  };
}
