/**
 * A minimal GIF writer: a global palette, an optional loop block, and frames each with its own
 * place on the logical screen and its graphic control extension (delay, disposal, transparent
 * index) or none. Written so the cases ffmpeg composites otherwise than a browser can be built
 * byte for byte (`gifCompositingProblem`); the LZW stream sends a clear code before the table
 * would grow, so every code has the minimum width and no dictionary is kept.
 *
 * Pure: frames in, bytes out.
 */

export interface GifFrame {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  /** Palette index per pixel, row by row, or one index for every pixel. */
  pixels: number | ((x: number, y: number) => number);
  /** Centiseconds; default 10. */
  delayCs?: number;
  /** 0-1 leave it, 2 restore to background, 3 restore to previous. */
  disposal?: number;
  /** A transparent palette index. */
  transparent?: number;
  /** false: no graphic control extension at all. */
  gce?: boolean;
}

export interface GifOptions {
  width: number;
  height: number;
  /** RGB triples; at most 256. */
  palette: readonly (readonly [number, number, number])[];
  /** The logical screen's background colour index. */
  background?: number;
  /** NETSCAPE2.0 loop count (0 forever); none when absent (plays once). */
  loop?: number;
  /** The logical screen's pixel aspect byte (0: none). */
  aspectByte?: number;
  frames: readonly GifFrame[];
}

function lzw(indices: readonly number[], minCodeSize: number): number[] {
  const clear = 1 << minCodeSize;
  const end = clear + 1;
  const width = minCodeSize + 1;
  // Every code is a literal: a clear before the table would need a wider code.
  const every = (1 << minCodeSize) - 2;
  const codes = [clear];
  indices.forEach((v, i) => {
    if (i > 0 && i % every === 0) codes.push(clear);
    codes.push(v);
  });
  codes.push(end);
  const bytes: number[] = [];
  let acc = 0;
  let bits = 0;
  for (const c of codes) {
    acc |= c << bits;
    bits += width;
    while (bits >= 8) {
      bytes.push(acc & 0xff);
      acc >>>= 8;
      bits -= 8;
    }
  }
  if (bits > 0) bytes.push(acc & 0xff);
  const out = [minCodeSize];
  for (let i = 0; i < bytes.length; i += 255) {
    const block = bytes.slice(i, i + 255);
    out.push(block.length, ...block);
  }
  out.push(0);
  return out;
}

const u16 = (v: number) => [v & 0xff, (v >> 8) & 0xff];

export function encodeGif(options: GifOptions): Uint8Array {
  const { width, height, palette } = options;
  let bits = 1;
  while (1 << bits < palette.length) bits++;
  const table: number[] = [];
  for (let i = 0; i < 1 << bits; i++) table.push(...(palette[i] ?? [0, 0, 0]));
  const out: number[] = [
    ...Array.from("GIF89a", (c) => c.charCodeAt(0)),
    ...u16(width),
    ...u16(height),
    0x80 | ((bits - 1) << 4) | (bits - 1),
    options.background ?? 0,
    options.aspectByte ?? 0,
    ...table,
  ];
  if (options.loop !== undefined) {
    out.push(0x21, 0xff, 11, ...Array.from("NETSCAPE2.0", (c) => c.charCodeAt(0)), 3, 1, ...u16(options.loop), 0);
  }
  for (const f of options.frames) {
    if (f.gce !== false) {
      const packed = ((f.disposal ?? 0) << 2) | (f.transparent !== undefined ? 1 : 0);
      out.push(0x21, 0xf9, 4, packed, ...u16(f.delayCs ?? 10), f.transparent ?? 0, 0);
    }
    const x = f.x ?? 0;
    const y = f.y ?? 0;
    const w = f.width ?? width;
    const h = f.height ?? height;
    out.push(0x2c, ...u16(x), ...u16(y), ...u16(w), ...u16(h), 0);
    const paint = f.pixels;
    const px = Array.from({ length: w * h }, (_, i) =>
      typeof paint === "number" ? paint : paint(i % w, Math.floor(i / w)),
    );
    out.push(...lzw(px, Math.max(2, bits)));
  }
  out.push(0x3b);
  return Uint8Array.from(out);
}
