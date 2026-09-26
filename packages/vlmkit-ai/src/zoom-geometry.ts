/**
 * The arithmetic of letting a vision model zoom: which size it sees, which pixels a box it
 * names refers to, and how large the magnified crop comes back. Pure — no image bytes here.
 *
 * The technique is the one Anthropic's multimodal cookbook measured (a chart question went from
 * 36/40 wrong to 40/40 right once the model could crop and magnify), taken without anything
 * provider-specific. Its one load-bearing idea: **the caller, not the provider, decides the size
 * the model sees.** Every provider downscales a large image before the model reads it, by rules
 * that differ between providers and change between releases; a box the model names is in *that*
 * image's pixels, and mapping it back needs to know the size exactly. So the image is resized
 * here to fit a budget below any provider's own limit (`fitToBudget`), the model is told its
 * size in pixels, and a box it names is mapped onto the full-resolution original
 * (`viewBoxToOriginal`) — the crop always comes from the original, never from the view.
 */

/** How large an image one message may carry. Providers differ; stay under all of them. */
export interface ImageBudget {
  /** Longest edge, px. */
  maxEdge: number;
  /** Width × height, px². Tile-counting providers bill by area; this bounds the bill too. */
  maxPixels: number;
}

/**
 * 1568px on the long edge and about 1.15 megapixels: the size below which Anthropic documents
 * that it does not resize. Other providers resize by their own rules (OpenAI's high-detail path
 * rescales the short side to 768px; Gemini tiles), and a model reading a resized copy may name
 * boxes in that copy's pixels — which is why the loop also offers normalized coordinates
 * (`coordinates: "normalized"`, 0–1000 on each axis), invariant to any resize. Pass a budget
 * that matches the model you use; nothing here assumes this one.
 */
export const DEFAULT_IMAGE_BUDGET: ImageBudget = { maxEdge: 1568, maxPixels: 1_150_000 };

/**
 * How the model states a box. `pixels`: absolute pixels of the view it was shown (the cookbook's
 * form; exact when the provider does not resize the view again). `normalized`: 0–1000 of the
 * view's width and height, the form several vision models are trained to emit for boxes, and
 * correct whatever size the provider actually showed the model.
 */
export type ZoomCoordinates = "pixels" | "normalized";

/** A box as the model stated it, in the view's pixel space. */
export function toViewBox(box: Box, view: Size, coordinates: ZoomCoordinates): Box {
  if (coordinates === "pixels") return box;
  return {
    x1: (box.x1 / 1000) * view.width,
    y1: (box.y1 / 1000) * view.height,
    x2: (box.x2 / 1000) * view.width,
    y2: (box.y2 / 1000) * view.height,
  };
}

export interface Size {
  width: number;
  height: number;
}

/** A box in some image's pixel space, x2 > x1 and y2 > y1 (half-open: x1 <= x < x2). */
export interface Box {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * The largest aspect-preserving size within the budget, never larger than the input. An image
 * that already fits is returned unchanged, so a small screenshot is shown at 1:1.
 */
export function fitToBudget(size: Size, budget: ImageBudget = DEFAULT_IMAGE_BUDGET): Size {
  const { width, height } = size;
  if (width <= 0 || height <= 0) throw new RangeError(`not an image size: ${width}x${height}`);
  const scale = Math.min(1, budget.maxEdge / Math.max(width, height), Math.sqrt(budget.maxPixels / (width * height)));
  if (scale >= 1) return { width, height };
  return scaled(size, scale);
}

/**
 * The size a crop is magnified to: the largest aspect-preserving size within the budget, even
 * when that means enlarging it — a 60×20 region comes back filling the budget, which is the
 * point. (Magnifying past the original's own pixels adds no detail, but it does make each
 * original pixel several of the model's, which is what lets it read an 8px gap.)
 */
export function zoomSize(crop: Size, budget: ImageBudget = DEFAULT_IMAGE_BUDGET): Size {
  const scale = Math.min(budget.maxEdge / Math.max(crop.width, crop.height), Math.sqrt(budget.maxPixels / (crop.width * crop.height)));
  return scaled(crop, scale);
}

/** Floor with a hair of tolerance: 3000 × (1568 / 3000) is 1567.9999… in floating point, and it means 1568. */
function scaled(size: Size, scale: number): Size {
  return {
    width: Math.max(1, Math.floor(size.width * scale + 1e-6)),
    height: Math.max(1, Math.floor(size.height * scale + 1e-6)),
  };
}

export type BoxProblem = { ok: false; reason: string };

/**
 * Clamp a box the model named to the view it saw, and reject one with no area left. Models
 * name boxes past the edge routinely (x2 = 1600 on a 1568px view); clamping is the honest
 * reading. A box that is empty after clamping is an error the model is told about, so it can
 * try again, rather than a crash.
 */
export function clampBox(box: Box, view: Size): { ok: true; box: Box } | BoxProblem {
  const nums = [box.x1, box.y1, box.x2, box.y2];
  if (!nums.every((n) => Number.isFinite(n))) return { ok: false, reason: "coordinates must be numbers" };
  const clamped = {
    x1: Math.max(0, Math.min(Math.round(box.x1), view.width)),
    y1: Math.max(0, Math.min(Math.round(box.y1), view.height)),
    x2: Math.max(0, Math.min(Math.round(box.x2), view.width)),
    y2: Math.max(0, Math.min(Math.round(box.y2), view.height)),
  };
  if (clamped.x1 >= clamped.x2 || clamped.y1 >= clamped.y2) {
    return { ok: false, reason: `invalid region (need x1 < x2 and y1 < y2 inside the ${view.width}x${view.height} image)` };
  }
  return { ok: true, box: clamped };
}

/**
 * The original's pixels a view box covers. Scales on each axis separately (the view's integer
 * size is not an exact multiple of the original's), rounds outward so a 1px feature on the
 * box's edge is kept, and never returns an empty box.
 */
export function viewBoxToOriginal(box: Box, view: Size, original: Size): Box {
  const sx = original.width / view.width;
  const sy = original.height / view.height;
  const x1 = Math.max(0, Math.floor(box.x1 * sx));
  const y1 = Math.max(0, Math.floor(box.y1 * sy));
  const x2 = Math.min(original.width, Math.max(x1 + 1, Math.ceil(box.x2 * sx)));
  const y2 = Math.min(original.height, Math.max(y1 + 1, Math.ceil(box.y2 * sy)));
  return { x1, y1, x2, y2 };
}
