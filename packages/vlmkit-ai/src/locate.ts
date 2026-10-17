/**
 * Find an element on a screenshot from a description ("the Save button"), with no DOM.
 *
 * For apps whose pixels are the only interface: Flutter web paints a canvas, an Android or macOS
 * capture is a frame. One request asks Jev two typed questions about the whole screenshot: a
 * `noul` (is it shown at all?) and a `box` (where?). If it is shown, a second `box` is asked on
 * a magnified crop around the first, and that answer is mapped back to the original's pixels.
 *
 * Measured 2026-10-16 (`docs/reports/2026-10-16-jev-box-bench.md`, 85 named elements on 9
 * fixtures), not to re-learn:
 *
 *   - `box` edges come back at two decimals, so one look is a 12.8px grid on a 1280px image:
 *     89% of box centres on the target, 12px median edge error. The crop takes it to 96% and 5px.
 *   - `box` has no "not found" and its `confidence` does not separate hits from misses (AUROC
 *     0.56), so absence is the `noul`'s job: AUROC 0.98, 0 of 85 decoys accepted at 0.5.
 *   - The `noul` reads text in a field's placeholder as not shown (3 of 3, noul ≤ 0.01) while
 *     `box` still found them. Describe fields by their label, or pass `presence: false`.
 */
import { askJev, JEV_DEFAULT_MODEL, JEV_IMAGE_LIMITS, jevBoxToPixels, pngImage } from "./jev-client.ts";
import type { JevAnswer, JevClientOptions, JevRequest, JevResponse } from "./jev-client.ts";
import { regionKindScale, regionKindView } from "./region-kind.ts";
import { decodeImage, encodePngImage, type RgbaImage } from "./zoom-image.ts";

export interface LocatedBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LocateResult {
  /** `presence >= presenceThreshold`, or always true with `presence: false`. */
  found: boolean;
  /** The `noul` "the screenshot shows …", 0-1. Null when presence was not asked. */
  presence: number | null;
  /** In the original image's pixels: the refined box when refined, else the first look's. */
  box: LocatedBox;
  /** The box's centre, where a click lands. */
  point: { x: number; y: number };
  /** The first look's box, in the original's pixels. */
  firstBox: LocatedBox;
  /** Whether `box` came from the second, magnified look. */
  refined: boolean;
  model: string;
  calls: number;
  costUsd: number;
}

export type JevAsk = <Q extends JevRequest["questions"]>(req: JevRequest<Q>) => Promise<JevResponse<Q>>;

export interface LocateOptions {
  /** Ask presence first and report not-found below the threshold (default true). */
  presence?: boolean;
  /** Default 0.5: at it, 95% of real targets and 0% of decoys were accepted. */
  presenceThreshold?: number;
  /** Ask a second `box` on a magnified crop (default true). */
  refine?: boolean;
  model?: string;
  /** Injected for tests; defaults to `askJev` with `client`. */
  ask?: JevAsk;
  client?: JevClientOptions;
}

type Win = { x1: number; y1: number; x2: number; y2: number };

/**
 * The scale the whole screenshot is shown at: 1 when it already fits Jev's limits, smaller for a
 * capture over 1568px (a 2x screenshot), larger for one under 280px. Null for a strip no scale
 * fits (an edge ratio over 5.6).
 */
export function firstLookScale(width: number, height: number): number | null {
  const L = JEV_IMAGE_LIMITS;
  const limit = Math.min(L.maxEdge / Math.max(width, height), Math.sqrt(L.maxPixels / (width * height)));
  const min = L.minEdge / Math.min(width, height);
  if (min > limit + 1e-9) return null;
  return Math.max(min, Math.min(1, limit));
}

/**
 * The crop for the second look: the first box padded by its own size on each side (at least
 * 16px), grown about its centre to 280px where the image allows, inside the image. The bench's
 * window: padded 1x, the crop held the whole target 87% of the time from one look.
 */
export function refineWindow(box: LocatedBox, image: { width: number; height: number }): Win {
  const grow = (lo: number, size: number, limit: number) => {
    const pad = Math.max(16, size);
    let a = lo - pad;
    let z = lo + size + pad;
    const need = Math.max(0, JEV_IMAGE_LIMITS.minEdge - (z - a));
    a -= need / 2;
    z += need / 2;
    if (a < 0) [a, z] = [0, z - a];
    if (z > limit) [a, z] = [Math.max(0, a - (z - limit)), limit];
    return [Math.max(0, Math.floor(a)), Math.min(limit, Math.ceil(z))] as const;
  };
  const [x1, x2] = grow(box.x, box.width, image.width);
  const [y1, y2] = grow(box.y, box.height, image.height);
  return { x1, y1, x2, y2 };
}

const toBox = (p: { x1: number; y1: number; x2: number; y2: number }): LocatedBox => ({
  x: p.x1,
  y: p.y1,
  width: p.x2 - p.x1,
  height: p.y2 - p.y1,
});

function view(img: RgbaImage, win: Win, scale: number): Uint8Array {
  return encodePngImage(regionKindView(img, win, scale));
}

export class LocateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LocateError";
  }
}

/** Locate `description` on a PNG screenshot. `description` names one thing: "the Save button". */
export async function locateByDescription(
  png: Uint8Array,
  description: string,
  options: LocateOptions = {},
): Promise<LocateResult> {
  const ask: JevAsk = options.ask ?? ((req) => askJev(req, options.client));
  const model = options.model ?? JEV_DEFAULT_MODEL;
  const img = decodeImage(Buffer.from(png));
  const whole: Win = { x1: 0, y1: 0, x2: img.width, y2: img.height };
  const s1 = firstLookScale(img.width, img.height);
  if (s1 === null) {
    throw new LocateError(
      `${img.width}x${img.height} cannot be shown within Jev's 280-1568px edges at any scale: crop it to the part to search`,
    );
  }
  const askPresence = options.presence ?? true;
  const what = description.trim().replace(/[.\s]+$/, "");
  let calls = 0;
  let costUsd = 0;

  const first = await ask({
    model,
    state: { screenshot: "SHOT" },
    assets: { SHOT: pngImage(s1 === 1 ? png : view(img, whole, s1)) },
    questions: {
      where: { type: "box", instructions: `${what} in \`screenshot\`.` },
      ...(askPresence ? { present: { type: "noul", instructions: `\`screenshot\` shows ${what}.` } } : {}),
    },
  });
  calls++;
  costUsd += first.costUsd;
  const answers = first.answers as Record<string, JevAnswer>;
  const where = answers.where as Extract<JevAnswer, { type: "box" }>;
  const firstBox = toBox(jevBoxToPixels(where.box, img.width, img.height));
  const presence = askPresence ? (answers.present as Extract<JevAnswer, { type: "noul" }>).noul : null;
  const found = presence === null || presence >= (options.presenceThreshold ?? 0.5);

  let box = firstBox;
  let refined = false;
  if (found && (options.refine ?? true)) {
    const win = refineWindow(firstBox, img);
    const s2 = regionKindScale(win.x2 - win.x1, win.y2 - win.y1);
    if (s2 !== null) {
      const second = await ask({
        model,
        state: { crop: "CROP" },
        assets: { CROP: pngImage(view(img, win, s2)) },
        questions: { where: { type: "box", instructions: `${what} in \`crop\`.` } },
      });
      calls++;
      costUsd += second.costUsd;
      const b = (second.answers as Record<string, JevAnswer>).where as Extract<JevAnswer, { type: "box" }>;
      const p = jevBoxToPixels(b.box, win.x2 - win.x1, win.y2 - win.y1);
      box = toBox({ x1: win.x1 + p.x1, y1: win.y1 + p.y1, x2: win.x1 + p.x2, y2: win.y1 + p.y2 });
      refined = true;
    }
  }
  return {
    found,
    presence,
    box,
    point: { x: box.x + box.width / 2, y: box.y + box.height / 2 },
    firstBox,
    refined,
    model: first.model,
    calls,
    costUsd,
  };
}
