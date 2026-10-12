/**
 * Whether an image file animates, from its bytes: a GIF with more than one image, a PNG whose
 * `acTL` (before its first `IDAT`) declares two or more frames and that holds two `fcTL` frame
 * controls (APNG), a WebP whose `VP8X` header sets the animation flag and that holds two `ANMF`
 * frames, or an AVIF whose `ftyp` names the image-sequence brand `avis`.
 *
 * An APNG or WebP header is a promise, not the frames: a file whose header says animated and that
 * holds one frame shows one picture and never moves, and reading the header alone called it
 * animated. So the frames are counted. The caller may hand over only the first bytes of a large
 * file (`check flash` reads at most 8MB); when the bytes end before the chunk list does, the
 * header is all there is and it is believed. An image wrongly called animated is a region the
 * report says it did not judge; one wrongly called still is pixels moving on the browser's clock,
 * counted as if the held clock had put them there.
 *
 * An animated image runs on the browser's own clock, which nothing a page's script sees can hold
 * (`requestAnimationFrame`, timers and the animation timeline are what the held clock replaces), so
 * a capture that holds page time still sees it move. `check flash` uses this to say which images
 * it could not measure rather than judging pixels that moved on a clock it did not drive.
 *
 * Pure: bytes in, no I/O.
 */

export type ImageFormat = "gif" | "png" | "webp" | "avif" | "other";

export interface ImageAnimation {
  format: ImageFormat;
  animated: boolean;
}

const ascii = (bytes: Uint8Array, at: number, length: number): string =>
  String.fromCharCode(...bytes.subarray(at, at + length));

const u32 = (bytes: Uint8Array, at: number): number =>
  ((bytes[at]! << 24) | (bytes[at + 1]! << 16) | (bytes[at + 2]! << 8) | bytes[at + 3]!) >>> 0;

/** RIFF sizes are little-endian. */
const u32le = (bytes: Uint8Array, at: number): number =>
  ((bytes[at + 3]! << 24) | (bytes[at + 2]! << 16) | (bytes[at + 1]! << 8) | bytes[at]!) >>> 0;

/** A GIF animates when it holds a second image descriptor. Malformed tails count what was read. */
function gifAnimated(bytes: Uint8Array): boolean {
  let at = 13;
  const lsd = bytes[10] ?? 0;
  if (lsd & 0x80) at += 3 * (1 << ((lsd & 0x07) + 1));
  let images = 0;
  const skipSubBlocks = () => {
    while (at < bytes.length) {
      const size = bytes[at]!;
      at += 1;
      if (size === 0) return;
      at += size;
    }
  };
  while (at < bytes.length) {
    const block = bytes[at]!;
    if (block === 0x3b) break;
    if (block === 0x21) {
      at += 2;
      skipSubBlocks();
    } else if (block === 0x2c) {
      if (++images > 1) return true;
      const packed = bytes[at + 9] ?? 0;
      at += 10;
      if (packed & 0x80) at += 3 * (1 << ((packed & 0x07) + 1));
      at += 1; // LZW minimum code size
      skipSubBlocks();
    } else {
      break;
    }
  }
  return false;
}

/**
 * An APNG declares its frame count in `acTL`, which must come before the first `IDAT`, and each
 * frame has an `fcTL`: the first may sit before the `IDAT` (the default image is frame 0) and the
 * rest after it, so the whole chunk list is walked.
 */
function pngAnimated(bytes: Uint8Array): boolean {
  let at = 8;
  let declared = 0;
  let controls = 0;
  while (at + 8 <= bytes.length) {
    const length = u32(bytes, at);
    const type = ascii(bytes, at + 4, 4);
    if (type === "IEND") return false;
    if (type === "IDAT" && declared < 2) return false;
    if (type === "acTL" && declared === 0) {
      if (at + 12 > bytes.length) return false;
      declared = u32(bytes, at + 8);
      if (declared < 2) return false;
    }
    if (type === "fcTL" && declared >= 2 && ++controls >= 2) return true;
    at += 12 + length;
  }
  // Cut off before IEND: an acTL of two or more frames is the only word on the rest.
  return declared >= 2;
}

/**
 * A WebP animates when its extended header (`VP8X`) sets the animation flag (bit 1) and two
 * `ANMF` frames follow. The chunk list ends where the RIFF size says the file does.
 */
function webpAnimated(bytes: Uint8Array): boolean {
  if (ascii(bytes, 12, 4) !== "VP8X") return false;
  if (((bytes[20] ?? 0) & 0x02) === 0) return false;
  const end = 8 + u32le(bytes, 4);
  let frames = 0;
  for (let at = 12; at < end;) {
    // Cut off inside the chunk list: the flag is the only word on the rest.
    if (at + 8 > bytes.length) return true;
    if (ascii(bytes, at, 4) === "ANMF" && ++frames >= 2) return true;
    const size = u32le(bytes, at + 4);
    at += 8 + size + (size & 1); // a chunk's payload is padded to an even length
  }
  return false;
}

/** An AVIF sequence names `avis` as its major or a compatible brand. */
function avifAnimated(bytes: Uint8Array): boolean {
  const size = u32(bytes, 0);
  for (let at = 8; at + 4 <= Math.min(size, bytes.length); at += 4) {
    if (at === 12) continue; // minor version
    if (ascii(bytes, at, 4) === "avis") return true;
  }
  return false;
}

export function sniffImageAnimation(bytes: Uint8Array): ImageAnimation {
  if (bytes.length >= 13 && (ascii(bytes, 0, 6) === "GIF87a" || ascii(bytes, 0, 6) === "GIF89a")) {
    return { format: "gif", animated: gifAnimated(bytes) };
  }
  if (bytes.length >= 8 && bytes[0] === 0x89 && ascii(bytes, 1, 3) === "PNG") {
    return { format: "png", animated: pngAnimated(bytes) };
  }
  if (bytes.length >= 16 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") {
    return { format: "webp", animated: webpAnimated(bytes) };
  }
  if (bytes.length >= 12 && ascii(bytes, 4, 4) === "ftyp") {
    const brand = ascii(bytes, 8, 4);
    if (brand === "avif" || brand === "avis" || avifAnimated(bytes))
      return { format: "avif", animated: avifAnimated(bytes) };
  }
  return { format: "other", animated: false };
}
