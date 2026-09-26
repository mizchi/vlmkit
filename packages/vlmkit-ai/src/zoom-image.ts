/**
 * The image half of zooming: make the view the model sees, and cut and magnify a region of
 * the original when it asks. PNG in, PNG out, through `pngjs` only, so no native image library
 * is needed — screenshots are what vlmkit feeds a vision model, and they are PNGs.
 *
 * Resampling is a box (area-average) filter when shrinking, which keeps 1px rules visible in
 * the view instead of dropping them between samples, and bilinear when magnifying. Transparent
 * pixels are composited onto white first: a transparent region encoded as black is the classic
 * way a crop "turns dark" in front of a model.
 */
import { PNG } from "pngjs";
import {
  DEFAULT_IMAGE_BUDGET,
  clampBox,
  fitToBudget,
  viewBoxToOriginal,
  zoomSize,
  type Box,
  type ImageBudget,
  type Size,
} from "./zoom-geometry.ts";

export interface RgbaImage {
  width: number;
  height: number;
  /** RGBA, row-major, 4 bytes per pixel, alpha always 255 after decode. */
  data: Uint8Array;
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Decode a PNG and flatten it onto white. Anything else is refused with the reason. */
export function decodeImage(buf: Buffer): RgbaImage {
  if (buf.length < 8 || !buf.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error("zoom reads PNG images only (screenshots); convert JPEG/WebP to PNG first");
  }
  const png = PNG.sync.read(buf);
  const data = new Uint8Array(png.width * png.height * 4);
  for (let i = 0; i < data.length; i += 4) {
    const a = png.data[i + 3]! / 255;
    data[i] = Math.round(png.data[i]! * a + 255 * (1 - a));
    data[i + 1] = Math.round(png.data[i + 1]! * a + 255 * (1 - a));
    data[i + 2] = Math.round(png.data[i + 2]! * a + 255 * (1 - a));
    data[i + 3] = 255;
  }
  return { width: png.width, height: png.height, data };
}

export function encodePngImage(img: RgbaImage): Buffer {
  const png = new PNG({ width: img.width, height: img.height });
  png.data = Buffer.from(img.data.buffer, img.data.byteOffset, img.data.byteLength);
  return PNG.sync.write(png);
}

export function cropImage(img: RgbaImage, box: Box): RgbaImage {
  const width = box.x2 - box.x1;
  const height = box.y2 - box.y1;
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const from = ((box.y1 + y) * img.width + box.x1) * 4;
    data.set(img.data.subarray(from, from + width * 4), y * width * 4);
  }
  return { width, height, data };
}

/** Resize to exactly `size`: area-average on each axis that shrinks, bilinear on one that grows. */
export function resample(img: RgbaImage, size: Size): RgbaImage {
  if (size.width === img.width && size.height === img.height) return img;
  const out = new Uint8Array(size.width * size.height * 4);
  const sx = img.width / size.width;
  const sy = img.height / size.height;
  const px = (x: number, y: number, c: number) => img.data[(y * img.width + x) * 4 + c]!;
  for (let oy = 0; oy < size.height; oy++) {
    for (let ox = 0; ox < size.width; ox++) {
      const o = (oy * size.width + ox) * 4;
      if (sx > 1 || sy > 1) {
        // Box filter over the source rectangle this output pixel covers (weighted at the edges).
        const x0 = ox * sx, x1 = Math.min(img.width, (ox + 1) * sx);
        const y0 = oy * sy, y1 = Math.min(img.height, (oy + 1) * sy);
        const acc = [0, 0, 0];
        let total = 0;
        for (let y = Math.floor(y0); y < Math.ceil(y1); y++) {
          const wy = Math.min(y + 1, y1) - Math.max(y, y0);
          for (let x = Math.floor(x0); x < Math.ceil(x1); x++) {
            const w = wy * (Math.min(x + 1, x1) - Math.max(x, x0));
            if (w <= 0) continue;
            for (let c = 0; c < 3; c++) acc[c]! += px(x, y, c) * w;
            total += w;
          }
        }
        for (let c = 0; c < 3; c++) out[o + c] = Math.round(acc[c]! / total);
      } else {
        // Bilinear between the four nearest source pixels (pixel centres at +0.5).
        const fx = Math.max(0, Math.min(img.width - 1, (ox + 0.5) * sx - 0.5));
        const fy = Math.max(0, Math.min(img.height - 1, (oy + 0.5) * sy - 0.5));
        const x0 = Math.floor(fx), y0 = Math.floor(fy);
        const x1 = Math.min(img.width - 1, x0 + 1), y1 = Math.min(img.height - 1, y0 + 1);
        const tx = fx - x0, ty = fy - y0;
        for (let c = 0; c < 3; c++) {
          const top = px(x0, y0, c) * (1 - tx) + px(x1, y0, c) * tx;
          const bottom = px(x0, y1, c) * (1 - tx) + px(x1, y1, c) * tx;
          out[o + c] = Math.round(top * (1 - ty) + bottom * ty);
        }
      }
      out[o + 3] = 255;
    }
  }
  return { width: size.width, height: size.height, data: out };
}

/** One image as the zoom loop holds it: the full-resolution original and the view the model sees. */
export interface ZoomSource {
  original: RgbaImage;
  view: RgbaImage;
  /** The view, encoded — what is actually sent. */
  viewPng: Buffer;
}

export function prepareZoomSource(png: Buffer, budget: ImageBudget = DEFAULT_IMAGE_BUDGET): ZoomSource {
  const original = decodeImage(png);
  const view = resample(original, fitToBudget(original, budget));
  return { original, view, viewPng: encodePngImage(view) };
}

export type ZoomOutcome =
  | {
    ok: true;
    /** The box in view pixels after clamping. */
    viewBox: Box;
    /** The original's pixels that were cropped. */
    originalBox: Box;
    /** The magnified crop, encoded. */
    png: Buffer;
    size: Size;
    /** What to tell the model alongside the image. */
    text: string;
  }
  | { ok: false; text: string };

/**
 * Crop the original under a view box and magnify it to the budget. The text states both
 * spaces, so the model can place what it sees in the zoom back onto the view it is reasoning
 * about ("…a 180x60px region of the original, returned at 1568x522px").
 */
export function zoomInto(source: ZoomSource, box: Box, budget: ImageBudget = DEFAULT_IMAGE_BUDGET): ZoomOutcome {
  const clamped = clampBox(box, source.view);
  if (!clamped.ok) return { ok: false, text: `Error: ${clamped.reason}` };
  const originalBox = viewBoxToOriginal(clamped.box, source.view, source.original);
  const crop = cropImage(source.original, originalBox);
  const size = zoomSize(crop, budget);
  const zoomed = resample(crop, size);
  const b = clamped.box;
  return {
    ok: true,
    viewBox: b,
    originalBox,
    png: encodePngImage(zoomed),
    size,
    text: `Zoomed into (${b.x1},${b.y1})-(${b.x2},${b.y2}) of the image you see at ${source.view.width}x${source.view.height}px: `
      + `a ${crop.width}x${crop.height}px region of the original, returned magnified to ${size.width}x${size.height}px.`,
  };
}
