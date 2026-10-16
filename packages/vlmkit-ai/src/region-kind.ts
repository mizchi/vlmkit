/**
 * Name what changed in a pixel-diff region: text, colour, position, or presence.
 *
 * The pixel diff has already found WHERE, deterministically. This asks Jev only WHAT, on both
 * captures cut to the region and magnified, as one typed `choice`. The split is the point. In
 * `diff region` (deprecated) a VLM was asked for the regions and the values too, and fabricated
 * both. Here the region and every value (shift, colours) stay the pixels', and the label is one
 * that a person can check against the crop.
 *
 * Measured 2026-10-16 (`docs/reports/2026-10-16-jev-box-bench.md`, and the end-to-end round on
 * real `diff png` regions in `…-jev-region-kind.md`). Do not take a shift's direction from here:
 * Jev got it 8/16 on the crop, and `region.shift` measures it.
 */
import {
  askJev,
  JEV_DEFAULT_MODEL,
  JEV_IMAGE_LIMITS,
  pngImage,
  type JevClientOptions,
  type JevResponse,
} from "./jev-client.ts";
import { cropImage, encodePngImage, resample, type RgbaImage } from "./zoom-image.ts";

export type RegionKindLabel = "text" | "color" | "position" | "presence";

/** The options as Jev reads them. Changing a description changes the measured accuracy: re-run the bench. */
export const REGION_KIND_OPTIONS: Record<RegionKindLabel, string> = {
  text: "A character or word of text is different",
  color: "A colour is different (text, fill or border); the shapes are the same",
  position: "Something moved: the same content sits a few pixels away from where it was",
  presence: "Something appeared or disappeared: content is in one image and missing from the other",
};

export const REGION_KIND_QUESTION = "How does `current` differ from `baseline`?";

/**
 * Below this confidence a label is marked `uncertain`: look at the crop before acting on it.
 * Measured on real `diff png` regions (2026-10-16): every wrong label was below it (7 of 7),
 * and 59 of 64 right ones were at or above it. A `choice`'s confidence carries signal here,
 * unlike a `box`'s (AUROC 0.56 in the grounding bench).
 */
export const REGION_KIND_SURE = 0.6;

export interface RegionKind {
  label: RegionKindLabel;
  confidence: number;
  /** `confidence < REGION_KIND_SURE`. Shift-only regions of 1-2px are the usual case (read as colour). */
  uncertain: boolean;
  probabilities: Record<string, number>;
  model: string;
}

export interface RegionBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A half-open box in image pixels. */
interface Win {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * The window both captures are cut to. The region is padded by half its size on each side
 * (at least 16px), then grown about its centre to Jev's 280px minimum where the image allows.
 * It is snapped to whole pixels inside the image.
 */
export function regionKindWindow(region: RegionBox, image: { width: number; height: number }): Win {
  const grow = (lo: number, size: number, limit: number) => {
    const pad = Math.max(16, size * 0.5);
    let a = lo - pad;
    let z = lo + size + pad;
    const need = Math.max(0, JEV_IMAGE_LIMITS.minEdge - (z - a));
    a -= need / 2;
    z += need / 2;
    if (a < 0) [a, z] = [0, z - a];
    if (z > limit) [a, z] = [Math.max(0, a - (z - limit)), limit];
    return [Math.max(0, Math.floor(a)), Math.min(limit, Math.ceil(z))] as const;
  };
  const [x1, x2] = grow(region.x, region.width, image.width);
  const [y1, y2] = grow(region.y, region.height, image.height);
  return { x1, y1, x2, y2 };
}

/**
 * How much to magnify a window: up to 4x (the bench's setting) within Jev's limits, and at least
 * enough to lift a short edge to 280px, past 4x if a small image needs it. Null when no scale
 * fits both edges: a strip longer than 1568 / 280 = 5.6 times its width.
 */
export function regionKindScale(width: number, height: number): number | null {
  const L = JEV_IMAGE_LIMITS;
  const limit = Math.min(L.maxEdge / Math.max(width, height), Math.sqrt(L.maxPixels / (width * height)));
  const min = L.minEdge / Math.min(width, height);
  if (min > limit + 1e-9) return null;
  return Math.max(min, Math.min(4, limit));
}

/** The view Jev gets of one capture: the window cropped and resampled, with edges clamped into the limits. */
export function regionKindView(img: RgbaImage, win: Win, scale: number): RgbaImage {
  const L = JEV_IMAGE_LIMITS;
  const crop = cropImage(img, win);
  const size = (n: number) => Math.min(L.maxEdge, Math.max(L.minEdge, Math.round(n * scale)));
  return resample(crop, { width: size(crop.width), height: size(crop.height) });
}

export type AskRegionKind = (baseline: Uint8Array, current: Uint8Array) => Promise<RegionKind>;

/** The real call: one `choice` over both views. Inject another `AskRegionKind` in tests. */
export function jevRegionKindAsker(
  options: JevClientOptions & { model?: string; onResponse?: (r: JevResponse) => void } = {},
): AskRegionKind {
  return async (baseline, current) => {
    const r = await askJev(
      {
        model: options.model ?? JEV_DEFAULT_MODEL,
        state: { baseline: "BASE", current: "CUR" },
        assets: { BASE: pngImage(baseline), CUR: pngImage(current) },
        questions: {
          kind: { type: "choice", instructions: REGION_KIND_QUESTION, criteria: { ...REGION_KIND_OPTIONS } },
        },
      },
      options,
    );
    options.onResponse?.(r);
    const a = r.answers.kind;
    return {
      label: a.choice as RegionKindLabel,
      confidence: a.confidence,
      uncertain: a.confidence < REGION_KIND_SURE,
      probabilities: a.probabilities,
      model: r.model,
    };
  };
}

export type RegionKindOutcome = { kind: RegionKind } | { skipped: string };

/**
 * Label each region, in input order. Regions are asked in parallel (`concurrency`, default 4),
 * one request each: a request holding several regions' crops would pass Jev's 64k context.
 * One region that fails is reported with its reason and leaves the others labelled.
 */
export async function labelRegionKinds(
  baseline: RgbaImage,
  current: RgbaImage,
  regions: readonly RegionBox[],
  ask: AskRegionKind,
  concurrency = 4,
): Promise<RegionKindOutcome[]> {
  if (baseline.width !== current.width || baseline.height !== current.height) {
    // A window means the same pixels in both only when the captures share a size; after a
    // reflow the same window shows different content and "what changed" is not one region's.
    return regions.map(() => ({
      skipped: `capture sizes differ (${baseline.width}x${baseline.height} vs ${current.width}x${current.height})`,
    }));
  }
  const out: RegionKindOutcome[] = new Array(regions.length);
  let next = 0;
  const worker = async () => {
    while (next < regions.length) {
      const i = next++;
      const win = regionKindWindow(regions[i]!, baseline);
      const scale = regionKindScale(win.x2 - win.x1, win.y2 - win.y1);
      if (scale === null) {
        out[i] = { skipped: `window ${win.x2 - win.x1}x${win.y2 - win.y1} cannot fit Jev's 280-1568px edges` };
        continue;
      }
      try {
        const kind = await ask(
          encodePngImage(regionKindView(baseline, win, scale)),
          encodePngImage(regionKindView(current, win, scale)),
        );
        out[i] = { kind };
      } catch (error) {
        out[i] = { skipped: (error as Error).message.slice(0, 300) };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, regions.length) }, worker));
  return out;
}
