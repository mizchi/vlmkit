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
  /** An APNG's `acTL` num_frames: the frames a browser plays, whatever number of `fcTL` follow. */
  declaredFrames?: number;
  /** A GIF's logical screen and each image's place and compositing, which ffmpeg composites otherwise than a browser. */
  gif?: { screen: { width: number; height: number }; globalTable: boolean; images: GifImage[] };
}

export interface GifImage {
  x: number;
  y: number;
  width: number;
  height: number;
  /** The graphic control extension's disposal method: 0-1 leave it, 2 restore to background, 3 restore to previous. */
  disposal: number;
  /** It has a transparent colour index. */
  transparent: boolean;
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
  const screen = { width: u16le(bytes, 6), height: u16le(bytes, 8) };
  const images: GifImage[] = [];
  const storedMs: number[] = [];
  let pendingDelay = 0;
  let pendingDisposal = 0;
  let pendingTransparent = false;
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
        pendingDisposal = (blocks[0][0]! >> 2) & 0x07;
        pendingTransparent = (blocks[0][0]! & 0x01) === 1;
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
      images.push({
        x: u16le(bytes, at + 1),
        y: u16le(bytes, at + 3),
        width: u16le(bytes, at + 5),
        height: u16le(bytes, at + 7),
        disposal: pendingDisposal,
        transparent: pendingTransparent,
      });
      pendingDelay = 0;
      pendingDisposal = 0;
      pendingTransparent = false;
      const packed = bytes[at + 9] ?? 0;
      at += 10;
      if (packed & 0x80) at += 3 * (1 << ((packed & 0x07) + 1));
      at += 1; // LZW minimum code size
      subBlocks();
    } else {
      break;
    }
  }
  return { format: "gif", storedMs, plays, gif: { screen, globalTable: (lsd & 0x80) !== 0, images } };
}

/**
 * Where ffmpeg 6.1's GIF decoder composites otherwise than Chromium (measured,
 * `docs/reports/2026-10-13-scan-video-v1.md`), or null. ffmpeg's background is the global colour
 * table's background entry, opaque, wherever a browser leaves the canvas transparent — but only
 * when the GIF has a global table and the image it fills under has no transparent index; otherwise
 * it fills with its transparent colour, as a browser does (measured: those decode pixel for pixel
 * as Chromium shows them). So refused: a first image larger than the logical screen (a browser grows
 * the canvas, ffmpeg crops); one that does not cover it, opaque, under a global table; a frame
 * disposed to background, opaque, under a global table, that the next image does not paint over
 * opaquely; and one restored to previous where what is restored holds that fill (ffmpeg saved it,
 * a browser restores the cleared canvas). Frame 0 of every pass is drawn on a cleared canvas in both.
 */
export function gifCompositingProblem(timing: ImageTiming): string | null {
  const gif = timing.gif;
  if (!gif || gif.images.length === 0) return null;
  const { screen, images, globalTable } = gif;
  const first = images[0]!;
  if (first.x + first.width > screen.width || first.y + first.height > screen.height) {
    return `its first image (${first.width}x${first.height} at ${first.x},${first.y}) reaches past the ${screen.width}x${screen.height} logical screen: a browser grows the canvas to it, ffmpeg crops it`;
  }
  if (!globalTable) return null;
  const covered = first.x === 0 && first.y === 0 && first.width >= screen.width && first.height >= screen.height;
  if (!covered && !first.transparent) {
    return `its first image (${first.width}x${first.height} at ${first.x},${first.y}) does not cover the ${screen.width}x${screen.height} logical screen and has no transparent colour: a browser leaves the rest transparent, ffmpeg paints it the background colour`;
  }
  const paintsOver = (b: GifImage, a: GifImage) =>
    !b.transparent && b.x <= a.x && b.y <= a.y && b.x + b.width >= a.x + a.width && b.y + b.height >= a.y + a.height;
  const screenRect: GifImage = { x: 0, y: 0, ...screen, disposal: 0, transparent: false };
  // Whether ffmpeg's canvas, as image i is drawn on it, still holds its opaque background fill
  // anywhere: the keyframe's under an opaque first image (which paints over all of it, the check
  // above saw to that), and an opaque frame's disposal to background, until an opaque image
  // paints over the whole screen. A sprite restored to previous over a first frame restores that
  // frame's pixels in ffmpeg as in a browser (measured, pixel for pixel), so it is no fill.
  let fillBefore = !first.transparent;
  for (let i = 0; i + 1 < images.length; i++) {
    const a = images[i]!;
    const b = images[i + 1]!;
    if (a.disposal === 2 && !a.transparent && !paintsOver(b, a)) {
      return `image ${i} is disposed to background with no transparent colour, and image ${i + 1} does not paint over all of it opaquely: a browser clears it to transparent, ffmpeg fills it with the background colour`;
    }
    if (a.disposal === 3 && fillBefore && !paintsOver(b, a)) {
      return `image ${i} is restored to the canvas before it, which ffmpeg filled with the background colour, and image ${i + 1} does not paint over all of it opaquely: a browser restores a transparent canvas`;
    }
    // The canvas as image i + 1 is drawn: image i drawn (an opaque whole screen covers any fill), then disposed.
    const afterDraw = fillBefore && !paintsOver(a, screenRect);
    fillBefore = a.disposal === 3 ? fillBefore : a.disposal === 2 && !a.transparent ? true : afterDraw;
  }
  return null;
}

/**
 * An APNG's frames: one per `fcTL`, delay_num / delay_den seconds (a 0 denominator is 100) in
 * whole ms, as Chromium holds it. Plays: `acTL`'s num_plays, 0 forever; its num_frames is how many
 * of them a browser plays.
 */
function apngTiming(bytes: Uint8Array): ImageTiming | null {
  let at = 8;
  let plays: number | null | undefined;
  let declaredFrames = 0;
  const storedMs: number[] = [];
  while (at + 8 <= bytes.length) {
    const length = u32(bytes, at);
    const type = ascii(bytes, at + 4, 4);
    const data = at + 8;
    if (type === "IEND") break;
    if (type === "acTL" && length >= 8 && plays === undefined) {
      declaredFrames = u32(bytes, data);
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
  return plays === undefined ? null : { format: "apng", storedMs, plays, declaredFrames };
}

/** The timing of an animated GIF or APNG, or null for anything else (a still PNG, a video). */
export function imageTiming(bytes: Uint8Array): ImageTiming | null {
  if (bytes.length >= 13 && (ascii(bytes, 0, 6) === "GIF87a" || ascii(bytes, 0, 6) === "GIF89a")) {
    return gifTiming(bytes);
  }
  if (bytes.length >= 8 && bytes[0] === 0x89 && ascii(bytes, 1, 3) === "PNG") return apngTiming(bytes);
  return null;
}
