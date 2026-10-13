/**
 * How an animated GIF or APNG plays in a browser: each frame's delay as stored, how many times
 * the animation plays, and the delays a browser actually holds.
 *
 * Measured on Chromium 141 and 149 (`docs/reports/2026-10-13-scan-video-v1.md`): a frame of 10ms
 * or less is held 100ms, in a GIF and an APNG alike; longer delays play as stored. ffmpeg times
 * them otherwise — a GIF's 1cs frame plays for 10ms, an APNG's 0 delay for 1/15s — and decodes one
 * pass, where a browser loops. A two-frame black/white GIF looping at 100ms a frame is five
 * flashes a second on screen and one transition in a single decoded pass.
 *
 * Pure: bytes in, no I/O.
 */

export interface ImageTiming {
  format: "gif" | "apng";
  /** Each frame's delay as stored, in ms (a GIF's centiseconds x 10; an APNG's delay_num / delay_den). */
  storedMs: number[];
  /** How many times the animation plays; `null` is forever. */
  plays: number | null;
}

/** What Chromium holds a frame for: 10ms or less is 100ms. */
export const browserDelayMs = (storedMs: number): number => (storedMs <= 10 ? 100 : storedMs);

const ascii = (bytes: Uint8Array, at: number, length: number): string =>
  String.fromCharCode(...bytes.subarray(at, at + length));

const u32 = (bytes: Uint8Array, at: number): number =>
  ((bytes[at]! << 24) | (bytes[at + 1]! << 16) | (bytes[at + 2]! << 8) | bytes[at + 3]!) >>> 0;
const u16 = (bytes: Uint8Array, at: number): number => (bytes[at]! << 8) | bytes[at + 1]!;
const u16le = (bytes: Uint8Array, at: number): number => bytes[at]! | (bytes[at + 1]! << 8);

/**
 * A GIF's frames: one per image descriptor, its delay from the graphic control extension before it
 * (none: 0). Plays: once with no NETSCAPE2.0 (or ANIMEXTS1.0) block, forever when its loop count
 * is 0, else loop count + 1 (the first play and the repeats).
 */
function gifTiming(bytes: Uint8Array): ImageTiming {
  let at = 13;
  const lsd = bytes[10] ?? 0;
  if (lsd & 0x80) at += 3 * (1 << ((lsd & 0x07) + 1));
  const storedMs: number[] = [];
  let pendingDelay = 0;
  let plays: number | null = 1;
  const subBlocks = (): Uint8Array[] => {
    const out: Uint8Array[] = [];
    while (at < bytes.length) {
      const size = bytes[at]!;
      at += 1;
      if (size === 0) break;
      out.push(bytes.subarray(at, at + size));
      at += size;
    }
    return out;
  };
  while (at < bytes.length) {
    const block = bytes[at]!;
    if (block === 0x3b) break;
    if (block === 0x21) {
      const label = bytes[at + 1];
      at += 2;
      const blocks = subBlocks();
      if (label === 0xf9 && blocks[0] && blocks[0].length >= 4) {
        pendingDelay = u16le(blocks[0], 1) * 10;
      } else if (
        label === 0xff &&
        blocks[0] &&
        // Chromium reads ANIMEXTS1.0 as the same loop block (measured: loop 0 plays forever).
        (ascii(blocks[0], 0, 11) === "NETSCAPE2.0" || ascii(blocks[0], 0, 11) === "ANIMEXTS1.0")
      ) {
        const data = blocks[1];
        if (data && data.length >= 3 && data[0] === 1) {
          const loops = u16le(data, 1);
          plays = loops === 0 ? null : loops + 1;
        }
      }
    } else if (block === 0x2c) {
      storedMs.push(pendingDelay);
      pendingDelay = 0;
      const packed = bytes[at + 9] ?? 0;
      at += 10;
      if (packed & 0x80) at += 3 * (1 << ((packed & 0x07) + 1));
      at += 1; // LZW minimum code size
      subBlocks();
    } else {
      break;
    }
  }
  return { format: "gif", storedMs, plays };
}

/**
 * An APNG's frames: one per `fcTL`, delay_num / delay_den seconds (a 0 denominator is 100) in
 * whole ms, as Chromium holds it. Plays: `acTL`'s num_plays, 0 forever.
 */
function apngTiming(bytes: Uint8Array): ImageTiming | null {
  let at = 8;
  let plays: number | null | undefined;
  const storedMs: number[] = [];
  while (at + 8 <= bytes.length) {
    const length = u32(bytes, at);
    const type = ascii(bytes, at + 4, 4);
    const data = at + 8;
    if (type === "IEND") break;
    if (type === "acTL" && length >= 8 && plays === undefined) {
      const n = u32(bytes, data + 4);
      plays = n === 0 ? null : n;
    }
    if (type === "fcTL" && length >= 26) {
      const num = u16(bytes, data + 20);
      const den = u16(bytes, data + 22) || 100;
      // Chromium holds a frame for its delay in whole ms, and clamps that integer: 1/95s is 10ms.
      storedMs.push(Math.floor((num * 1000) / den));
    }
    at += 12 + length;
  }
  return plays === undefined ? null : { format: "apng", storedMs, plays };
}

/** The timing of an animated GIF or APNG, or null for anything else (a still PNG, a video). */
export function imageTiming(bytes: Uint8Array): ImageTiming | null {
  if (bytes.length >= 13 && (ascii(bytes, 0, 6) === "GIF87a" || ascii(bytes, 0, 6) === "GIF89a")) {
    return gifTiming(bytes);
  }
  if (bytes.length >= 8 && bytes[0] === 0x89 && ascii(bytes, 1, 3) === "PNG") return apngTiming(bytes);
  return null;
}
