/**
 * A PNG decoder for the one shape a browser screenshot has — 8-bit RGB or RGBA, not interlaced —
 * in a tight loop over typed arrays, falling back to pngjs for anything else.
 *
 * Why: `check flash` decodes every 60fps frame of a sweep, 181 frames for a 3-second window at
 * 1280x720, and pngjs's generic unfilter and bitmapper took 19 of the 24 seconds of judging one.
 * The inflate is zlib's either way; only the unfilter and the copy to RGBA are done here.
 *
 * Pixels come back only for a file whose header and data agree. Before either decoder sees it,
 * the IHDR must be the first chunk, exactly 13 bytes, of a non-zero size and pass its CRC, and
 * every chunk must lie inside the file up to an IEND. On the fast path the inflated data must
 * then be exactly `height * (1 + width * channels)` bytes; zlib's own adler-32 vouches for the
 * IDAT bytes, so their CRCs are not recomputed. A file that breaks one of these throws instead of
 * going to pngjs, because pngjs 7 does not refuse all of them: measured, it decodes a 14-byte
 * IHDR and a zero width without a word, and reads the last row of a stream one row short from
 * memory it never filled (some runs return the image, some throw on a filter byte). What is only
 * not the fast path's shape (another depth or colour type, interlacing, a `tRNS` colour key) goes
 * to pngjs.
 */
import * as zlib from "node:zlib";
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

let crcTable: Uint32Array | undefined;

/**
 * CRC-32 (ISO 3309, the one PNG chunks carry), by a 256-entry table. Only for a Node without
 * `zlib.crc32` (before 22.2 / 20.15); exported so a test holds it to zlib's.
 */
export function tableCrc32(bytes: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = crcTable[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const nativeCrc32 = (zlib as { crc32?: (data: Uint8Array) => number }).crc32;
const crc32 = (bytes: Uint8Array): number => (nativeCrc32 ? nativeCrc32(bytes) >>> 0 : tableCrc32(bytes));

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
  // IHDR: length, type, 13 bytes of data, then the CRC over type + data.
  if (buffer.length < 33) throw new Error("PNG is truncated inside its IHDR chunk");
  if (String.fromCharCode(...buffer.subarray(12, 16)) !== "IHDR") throw new Error("PNG does not begin with IHDR");
  if (view.getUint32(8) !== 13) throw new Error(`PNG IHDR is ${view.getUint32(8)} bytes, not 13`);
  if (crc32(buffer.subarray(12, 29)) !== view.getUint32(29)) throw new Error("PNG IHDR fails its CRC");
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  if (width === 0 || height === 0) throw new Error(`PNG IHDR gives a ${width}x${height} image`);
  const depth = buffer[24]!;
  const colour = buffer[25]!;
  const method = buffer[26]! | buffer[27]!; // compression and filter method: PNG defines only 0 for each
  const interlace = buffer[28]!;

  let at = 33;
  let ended = false;
  let keyed = false;
  const idat: Uint8Array[] = [];
  while (at + 12 <= buffer.length) {
    const length = view.getUint32(at);
    if (at + 12 + length > buffer.length) break;
    const type = String.fromCharCode(buffer[at + 4]!, buffer[at + 5]!, buffer[at + 6]!, buffer[at + 7]!);
    if (type === "IDAT") {
      idat.push(buffer.subarray(at + 8, at + 8 + length));
    } else if (type === "IEND") {
      ended = true;
      break;
    } else if (type === "tRNS") {
      keyed = true;
    }
    at += 12 + length;
  }
  if (!ended) throw new Error("PNG is truncated: it ends before its IEND chunk");
  if (idat.length === 0) throw new Error("PNG has no image data");

  const channels = colour === 6 ? 4 : colour === 2 ? 3 : 0;
  // A colour key (tRNS on RGB) makes the keyed pixels transparent, which only pngjs applies.
  if (depth !== 8 || channels === 0 || method !== 0 || interlace !== 0 || keyed) {
    return { ...viaPngjs(buffer), channels: 4 };
  }
  const inflated = zlib.inflateSync(idat.length === 1 ? idat[0]! : Buffer.concat(idat));
  const raw = new Uint8Array(inflated.buffer, inflated.byteOffset, inflated.byteLength);
  const stride = width * channels;
  const expected = (stride + 1) * height;
  if (raw.length !== expected) {
    throw new Error(`PNG data is ${raw.length} bytes; its ${width}x${height} IHDR needs ${expected}`);
  }
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
