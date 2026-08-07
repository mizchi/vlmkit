/**
 * PNG I/O utilities
 *
 * Low-level PNG decode/encode using pngjs.
 * Used by heatmap.ts and other modules that need raw pixel data.
 */
import { readFile, writeFile } from "node:fs/promises";

export interface PngData {
  width: number;
  height: number;
  data: Uint8Array;
}

/**
 * How far two images differ in *magnitude*, independent of any perceptual
 * threshold.
 *
 * A pixel-diff ratio answers "how many pixels changed enough to count", and a
 * comparator with a perceptual threshold can legitimately answer *none* while
 * every pixel in the image has moved. Measured on a 1258x203 hero whose
 * background gradient went from a blue tint to a purple one: 246,914 of 256,632
 * pixels differed, by at most 8/255 per channel, and pixelmatch scored the diff
 * at 0.0%. A gate that reports only the ratio cannot distinguish that from an
 * identical render, which is the difference between a caught regression and a
 * silent one.
 *
 * Alpha is deliberately excluded. A screenshot of an opaque element is fully
 * opaque, so an alpha delta here would mean the two images were cropped
 * differently — a size mismatch, not a colour change, and one the caller should
 * see as such rather than folded into a colour statistic.
 */
export interface ChangeMagnitude {
  /** Pixels with any non-zero channel delta, however small. */
  changedPixels: number;
  totalPixels: number;
  /** Fraction of pixels that moved at all. 1.0 means the whole box shifted. */
  changedFraction: number;
  /** Largest single-channel delta anywhere, 0-255. */
  maxChannelDelta: number;
  /** Mean per-pixel max-channel delta over the whole image, 0-255. */
  meanChannelDelta: number;
}

export function measureChangeMagnitude(a: PngData, b: PngData): ChangeMagnitude {
  // Compare only the overlapping box. Differently-sized images are a real case
  // (a reflow changed the component's height) and throwing here would turn a
  // finding into a crash.
  const width = Math.min(a.width, b.width);
  const height = Math.min(a.height, b.height);
  let changedPixels = 0;
  let sum = 0;
  let maxChannelDelta = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const ia = (y * a.width + x) * 4;
      const ib = (y * b.width + x) * 4;
      const delta = Math.max(
        Math.abs(a.data[ia]! - b.data[ib]!),
        Math.abs(a.data[ia + 1]! - b.data[ib + 1]!),
        Math.abs(a.data[ia + 2]! - b.data[ib + 2]!),
      );
      if (delta > 0) changedPixels += 1;
      if (delta > maxChannelDelta) maxChannelDelta = delta;
      sum += delta;
    }
  }
  const totalPixels = width * height;
  return {
    changedPixels,
    totalPixels,
    changedFraction: totalPixels === 0 ? 0 : changedPixels / totalPixels,
    maxChannelDelta,
    meanChannelDelta: totalPixels === 0 ? 0 : sum / totalPixels,
  };
}

/**
 * Crop or pad an image to the target dimensions.
 * Only handles the common region; overflow is zero-filled.
 */
export function cropImage(img: PngData, w: number, h: number): PngData {
  if (img.width === w && img.height === h) return img;
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    const srcOffset = y * img.width * 4;
    const dstOffset = y * w * 4;
    data.set(img.data.subarray(srcOffset, srcOffset + w * 4), dstOffset);
  }
  return { width: w, height: h, data };
}

/**
 * Crop an arbitrary rectangle out of an image.
 *
 * Unlike {@link cropImage} (which only clips the top-left common region),
 * this extracts a region at an arbitrary (x, y) offset. The rectangle is
 * clamped to the image bounds, so the returned crop may be smaller than
 * requested when the region overruns an edge (or off the top-left).
 */
export function cropRegion(
  img: PngData,
  x: number,
  y: number,
  w: number,
  h: number,
): PngData {
  const x0 = Math.max(0, Math.min(Math.floor(x), img.width));
  const y0 = Math.max(0, Math.min(Math.floor(y), img.height));
  const x1 = Math.max(x0, Math.min(Math.floor(x + w), img.width));
  const y1 = Math.max(y0, Math.min(Math.floor(y + h), img.height));
  const cw = x1 - x0;
  const ch = y1 - y0;
  const data = new Uint8Array(cw * ch * 4);
  for (let row = 0; row < ch; row++) {
    const srcOffset = ((y0 + row) * img.width + x0) * 4;
    const dstOffset = row * cw * 4;
    data.set(img.data.subarray(srcOffset, srcOffset + cw * 4), dstOffset);
  }
  return { width: cw, height: ch, data };
}

/**
 * Read a PNG file and return RGBA pixel data.
 */
export async function decodePng(path: string): Promise<PngData> {
  const { PNG } = await import("pngjs");
  const buffer = await readFile(path);
  const png = PNG.sync.read(buffer);
  return {
    width: png.width,
    height: png.height,
    data: new Uint8Array(png.data.buffer, png.data.byteOffset, png.data.byteLength),
  };
}

/**
 * Write RGBA pixel data to a PNG file.
 */
export async function encodePng(
  path: string,
  data: PngData
): Promise<void> {
  const { PNG } = await import("pngjs");
  const png = new PNG({ width: data.width, height: data.height });
  Buffer.from(data.data.buffer, data.data.byteOffset, data.data.byteLength).copy(png.data);
  const buffer = PNG.sync.write(png);
  await writeFile(path, buffer);
}
