/**
 * `check flash`: WCAG 2.3.1 Three Flashes or Below Threshold, measured over a page's own time.
 *
 * The page is loaded with its clock and every animation held (`openHeldTimeline`), then shot at
 * every 60fps frame of a window — the frames a 60Hz display presents — and the shots are judged by
 * `@mizchi/vlmkit-judge/flash.ts` (per-pixel transitions, 341x256 CSS-px fields, the 21,824 px²
 * limit) and, where that fails, re-counted with motion compensated (`flash-motion.ts`).
 *
 * Or a saved sequence (`frames.json`, vlmkit-frames/1) is judged again with no browser. Whether a
 * pass from it means anything depends on whether every frame was captured, and that is read from
 * the manifest, never assumed: a held-clock sequence of consecutive 60fps frames, every one
 * stable, is complete; anything else can only fail soundly (sampling removes transitions, never
 * adds them), so its pass is reported as undersampled.
 *
 * What the held clock cannot hold is reported, not judged: a `<video>` is paused at load, an
 * animated image runs on the browser's own clock, and pixels that change between two shots of
 * one held instant (a worker, a cross-origin frame) are found by shooting twice. Their pixels are
 * left out of the count, and when they cover more than the limit in some field the verdict is
 * "not judgeable" — never a pass.
 *
 * A failing window is never animated in the output: a strip is one still image, because a
 * flipbook of a failing window is itself a strobe for whoever opens the review.
 */
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import type { Browser, Page } from "playwright";
import { withBrowser } from "@mizchi/vlmkit-core/browser-launch.ts";
import { sourceToUrl } from "@mizchi/vlmkit-core/page-open.ts";
import type { PageLoadOptions } from "@mizchi/vlmkit-core/page-load.ts";
import { sniffImageAnimation } from "@mizchi/vlmkit-core/animated-image.ts";
import { composeFilmstrip } from "@mizchi/vlmkit-core/filmstrip.ts";
import { decodePngBuffer, decodePngPixels, type PngPixels } from "@mizchi/vlmkit-core/png-decode.ts";
import type { PngData } from "@mizchi/vlmkit-core/png-utils.ts";
import { UsageError } from "@mizchi/vlmkit-core/cli-error.ts";
import type { RuleView } from "@mizchi/vlmkit-core/plugin/contract.ts";
import {
  frameSourceFacts,
  frameWriter,
  openHeldTimeline,
  type HeldAnimationTiming,
} from "@mizchi/vlmkit-animation-eval/frames-capture.ts";
import {
  AREA_LIMIT_CSS2,
  bestField,
  createFlashJudge,
  DARKER_BELOW,
  FIELD_CSS,
  FLASH_FORMAT,
  flashFrame,
  LUMINANCE_STEP,
  MAX_TRANSITIONS,
  RED_FLOOR,
  RED_RATIO,
  RED_UV_STEP,
  TRANSITIONS_KEPT,
  WHITE_UV,
  WINDOW_MS,
  type FlashEvaluation,
  type FlashFrame,
  type FlashTrack,
  type FlashTrackResult,
  type FrameBlocks,
} from "@mizchi/vlmkit-judge/flash.ts";
import { classifyFlash, type MotionSegment } from "@mizchi/vlmkit-judge/flash-motion.ts";
import {
  frameTimeMs,
  parseFramesManifest,
  type FramesManifest,
  type UnmeasuredRegion,
} from "@mizchi/vlmkit-judge/frames.ts";
import type { Box } from "@mizchi/vlmkit-judge/storyboard.ts";
import { STYLE_SAMPLING_JS } from "../style/style-sampling.ts";

export const DEFAULT_FLASH_VIEWPORT = { width: 1280, height: 720 } as const;
/** The window a page is swept over, when the caller names none: at least this... */
export const MIN_WINDOW_MS = 2000;
/** ...at least this when something repeats forever or runs by script... */
export const SCRIPT_WINDOW_MS = 3000;
/** ...and never more than this. */
export const MAX_WINDOW_MS = 10_000;
/** One screenshot never takes this long; a page that hangs the compositor is an error, not a wait. */
const SHOT_TIMEOUT_MS = 15_000;
/** Real-time gaps between the probe shots for what the held clock does not hold: no common period. */
const PROBE_GAPS_MS = [37, 53, 80, 120, 170, 240, 300];
/** Every this many frames, a shot that differs is taken again 50ms later (`shoot`'s `verify`). */
const VERIFY_EVERY = 10;
/** Every this many frames, the page is searched again for media added since load. */
const MEDIA_EVERY = 30;

export interface FlashCheckOptions extends PageLoadOptions {
  /** A page (html file or URL), or a `frames.json` to judge again. */
  source: string;
  viewport?: { width: number; height: number };
  /** Page source: the span of page time swept, in ms. */
  windowMs?: number;
  /** Page source: keep the frames and their manifest here. */
  framesDir?: string;
  /** One still image of the worst window's frames, cropped to its field (.png). */
  stripPath?: string;
  /** Exposed for tests: an open browser to use instead of launching one. */
  browser?: Browser;
}

/** What animated over a flash's field at its worst instant (page source only). */
export interface FlashAttribution {
  path: string;
  /** `animation-name`, `transition-property`, or an `el.animate()` id. */
  name: string;
  properties: string[];
  /** Share of the flashing pixels' box the element covers, 0..1. */
  cover: number;
}

export interface FlashWorst {
  /** The window (fromMs, toMs]. */
  fromMs: number;
  toMs: number;
  frame: number;
  /** The most transitions one pixel of the field had in it, and the flashes that makes. */
  transitions: number;
  flashesPerSecond: number;
  areaCss2: number;
  /** Share of the field, 0..1. */
  fieldShare: number;
  field: Box;
  bbox: Box;
  /** That pixel's transition frames: the strip shows these. */
  frames: number[];
  /** The transitions span the window to within one frame gap: one frame either way decides it. */
  knifeEdge: boolean;
}

export interface FlashTrackReport {
  /**
   * `fail`: more than three flashes a second over more than the limit, not explained by motion.
   * `pass`: none — or only flicker that motion explains (`classification: "motion"`).
   * `not-judgeable`: the sampling cannot back a pass, or what could not be measured is larger
   * than the limit; a measured failure is still `fail`.
   */
  verdict: "fail" | "pass" | "not-judgeable";
  /** Present when per-pixel counting failed: what the re-count made of it. */
  classification?: "flash" | "motion";
  reason?: "field" | "residual" | "budget" | "explained";
  worst: FlashWorst | null;
  /** The most transitions any pixel had in any window (16 means 16 or more). */
  peakTransitions: number;
  largestBelowCss2: number;
  /** The most flashing area together with the unmeasured pixels in one field, where the measured alone passed. */
  withUnknownCss2: number;
  failingWindows: number;
  runs: number;
  motion?: MotionSegment[];
  animations?: FlashAttribution[];
}

export interface FlashReport {
  format: typeof FLASH_FORMAT;
  source: {
    kind: "page" | "frames";
    path: string;
    url?: string;
    viewport: { width: number; height: number };
    cssPerPx: number;
    clock: "held" | "wall";
    manifest?: string;
  };
  /** Every number the verdict rests on, printed so a reader sees each assumption. */
  criteria: {
    luminanceStep: number;
    darkerBelow: number;
    transitionsAllowedPerWindow: number;
    window: string;
    redRatio: number;
    redFloor: string;
    redUv: number;
    blackChromaticity: readonly [number, number];
    fieldCss: [number, number];
    areaLimitCss2: number;
    areaSource: string;
    closing: string;
    fineDetail: string;
  };
  sampling: {
    frames: number;
    spanMs: number;
    maxGapMs: number;
    /** Every frame of the span is present (a held-clock 60fps sequence, every capture stable). */
    complete: boolean;
    /** Some one-second window holds the 7 frames a failure needs. */
    judgeable: boolean;
    /** Nothing on the page could move under the held clock: one frame was all there was. */
    still: boolean;
    windowMs: number;
    windowFrom: "option" | "animations" | "default" | "still" | "manifest";
    /** The window the page asked for was longer than the 10s cap: its end was not swept. */
    truncated: boolean;
    unstableFrames: number;
    /** Times the page navigated during the sweep; the frames after are the new document's. */
    navigations: number;
  };
  general: FlashTrackReport;
  red: FlashTrackReport;
  unmeasured: UnmeasuredRegion[];
  /** The most unmeasured CSS px² inside any one field. */
  unmeasuredAreaCss2: number;
  framesManifest?: string;
  strip?: string;
  /** Why `--strip` wrote nothing. */
  stripSkipped?: string;
  timingMs: { capture: number; judge: number; classify: number };
}

/** Pause every `<video>` / `<audio>` from document start: media runs on a clock nothing here holds. */
export const MEDIA_HOLD_SCRIPT = `(() => {
  if (window.__vlmkitMediaHeld) return;
  window.__vlmkitMediaHeld = true;
  const proto = HTMLMediaElement.prototype;
  const pause = proto.pause;
  proto.play = function () { try { pause.call(this); } catch {} return Promise.resolve(); };
  const stop = (event) => { try { if (event.target instanceof HTMLMediaElement) pause.call(event.target); } catch {} };
  document.addEventListener("play", stop, true);
  document.addEventListener("playing", stop, true);
})()`;

/**
 * Everything on the page the held clock does not drive: each `<video>`, and each image, wherever
 * it is drawn from — `<img>`, `input[type=image]`, SVG `<image>`, and every CSS image property of
 * an element and its `::before` / `::after` (backgrounds, border images, list markers, masks,
 * `content`) — including inside open shadow roots. Images are sniffed for animation from their
 * bytes afterwards; this only finds them.
 */
const MEDIA_JS = `(() => {
  ${STYLE_SAMPLING_JS}
  const vw = innerWidth;
  const vh = innerHeight;
  const clip = (r) => {
    const x = Math.max(0, r.left), y = Math.max(0, r.top);
    const x2 = Math.min(vw, r.right), y2 = Math.min(vh, r.bottom);
    if (!(x2 > x && y2 > y)) return null;
    return { x: Math.floor(x), y: Math.floor(y), width: Math.ceil(x2) - Math.floor(x), height: Math.ceil(y2) - Math.floor(y) };
  };
  const shown = (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
  const URL_RE = /url\\(\\s*(?:"([^"]*)"|'([^']*)'|([^)\\s]*))\\s*\\)/g;
  const urls = (value) => {
    const out = [];
    if (!value || value === "none") return out;
    for (const m of value.matchAll(URL_RE)) {
      const raw = m[1] ?? m[2] ?? m[3] ?? "";
      if (!raw) continue;
      try { out.push(new URL(raw, document.baseURI).href); } catch {}
    }
    return out;
  };
  const CSS_IMAGES = ["background-image", "border-image-source", "list-style-image", "mask-image", "-webkit-mask-image", "content"];
  const out = [];
  const seen = new Set();
  const add = (kind, el, src) => {
    const rect = clip(el.getBoundingClientRect());
    if (!rect) return;
    const p = path(el);
    const key = kind + "|" + p + "|" + (src || "");
    if (seen.has(key)) return;
    seen.add(key);
    out.push(src ? { kind, path: p, rect, src } : { kind, path: p, rect });
  };
  const visit = (root) => {
    for (const el of root.querySelectorAll("*")) {
      if (el.shadowRoot) visit(el.shadowRoot);
      if (!shown(el)) continue;
      const tag = el.localName;
      if (tag === "video") { add("video", el); continue; }
      if (tag === "img" && el.currentSrc) add("image", el, el.currentSrc);
      if (tag === "input" && el.type === "image" && el.src) add("image", el, el.src);
      if (tag === "image" && el.namespaceURI === "http://www.w3.org/2000/svg") {
        const href = el.href && el.href.baseVal ? el.href.baseVal : el.getAttribute("href") || el.getAttribute("xlink:href");
        if (href) { try { add("image", el, new URL(href, document.baseURI).href); } catch {} }
      }
      for (const pseudo of [null, "::before", "::after"]) {
        const cs = getComputedStyle(el, pseudo);
        if (pseudo && (cs.content === "none" || cs.content === "normal") && cs.backgroundImage === "none") continue;
        for (const prop of CSS_IMAGES) for (const src of urls(cs.getPropertyValue(prop))) add("image", el, src);
      }
    }
  };
  visit(document);
  return out;
})()`;

/**
 * What animated over the flashing pixels during (fromMs, toMs]: every held animation whose active
 * time meets the window and whose element, seeked to the window's middle, meets `box` (the
 * flashing pixels' box, not the whole field: a spinner elsewhere in the field is a bystander),
 * with the share of the box it covers. Read from the held list, not `document.getAnimations()`:
 * by the end of a sweep a deal's animations have finished, and a page that removes the class on
 * `animationend` has cancelled them.
 */
const attributionJs = (fromMs: number, toMs: number, box: Box) => `(() => {
  ${STYLE_SAMPLING_JS}
  const fromMs = ${JSON.stringify(fromMs)};
  const toMs = ${JSON.stringify(toMs)};
  const box = ${JSON.stringify(box)};
  if (window.__vlmkitSeekTimeline) window.__vlmkitSeekTimeline((fromMs + toMs) / 2);
  const held = (window.__vlmkitTimeline || []).map((h) => ({ anim: h.anim, startAt: h.startAt }));
  const out = [];
  const seen = new Set();
  const skip = new Set(["offset", "easing", "composite", "computedOffset"]);
  const area = box.width * box.height;
  for (const { anim, startAt } of held) {
    const el = anim.effect && anim.effect.target;
    if (!el || !el.getBoundingClientRect) continue;
    let timing = {};
    try { timing = anim.effect.getComputedTiming(); } catch {}
    const start = startAt + (timing.delay || 0);
    const end = typeof timing.activeDuration === "number" ? start + timing.activeDuration : Infinity;
    if (!(start < toMs && end > fromMs)) continue;
    const r = el.getBoundingClientRect();
    const w = Math.min(r.right, box.x + box.width) - Math.max(r.left, box.x);
    const h = Math.min(r.bottom, box.y + box.height) - Math.max(r.top, box.y);
    if (!(w > 0 && h > 0)) continue;
    let properties = [];
    try {
      properties = [...new Set(anim.effect.getKeyframes().flatMap((k) => Object.keys(k).filter((p) => !skip.has(p))))];
    } catch {}
    const name = anim.animationName || anim.transitionProperty || anim.id || "";
    const key = path(el) + "|" + name;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ path: path(el), name, properties, cover: area > 0 ? Math.round(((w * h) / area) * 1000) / 1000 : 0 });
  }
  out.sort((a, b) => b.cover - a.cover);
  return out.slice(0, 8);
})()`;

/**
 * The window to sweep: each finite animation's end; for one that repeats forever, a second past
 * its start and two periods more (a strobe that begins late is still seen flashing for a second);
 * for timers still pending at load, two seconds past the latest; and 3s at least for what repeats
 * or runs by script. Capped at 10s, and `truncated` says when the page asked for more.
 */
export function chooseWindow(
  held: readonly HeldAnimationTiming[],
  scripted: boolean,
  latestTimerMs: number | null = null,
): { windowMs: number; truncated: boolean } {
  let ms = MIN_WINDOW_MS;
  for (const a of held) {
    if (a.iterations === null) ms = Math.max(ms, SCRIPT_WINDOW_MS, a.startMs + WINDOW_MS + 2 * a.durationMs);
    else ms = Math.max(ms, a.startMs + a.durationMs * a.iterations);
  }
  if (scripted) ms = Math.max(ms, SCRIPT_WINDOW_MS);
  if (latestTimerMs !== null) ms = Math.max(ms, latestTimerMs + 2 * WINDOW_MS);
  const rounded = Math.ceil(ms / 100) * 100;
  return { windowMs: Math.min(MAX_WINDOW_MS, rounded), truncated: rounded > MAX_WINDOW_MS };
}

const decode = (buffer: Uint8Array): PngData => decodePngBuffer(buffer);

/** The box (device px) where two shots differ, or null. */
function differs(a: Buffer, b: Buffer): Box | null {
  const pa = decode(a);
  const pb = decode(b);
  if (pa.width !== pb.width || pa.height !== pb.height) return { x: 0, y: 0, width: pa.width, height: pa.height };
  let x0 = pa.width;
  let y0 = pa.height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < pa.height; y++) {
    for (let x = 0; x < pa.width; x++) {
      const i = (y * pa.width + x) * 4;
      if (pa.data[i] === pb.data[i] && pa.data[i + 1] === pb.data[i + 1] && pa.data[i + 2] === pb.data[i + 2]) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

const scaleBox = (b: Box, s: number): Box => {
  const x = Math.floor(b.x / s);
  const y = Math.floor(b.y / s);
  return { x, y, width: Math.ceil((b.x + b.width) / s) - x, height: Math.ceil((b.y + b.height) / s) - y };
};

/**
 * The frame at the instant just set. A shot that differs from the previous frame is the new
 * instant: what a capture that lands before the compositor applies a seek returns is the frame
 * before, unchanged. A shot equal to it is taken again until two agree, at most three; three that
 * never agree are something moving that nothing here holds, and where they differed is returned
 * (device px). With `verify`, a shot that differs is taken again 50ms later as well: something
 * that moves in real time makes every frame differ, so without a second look every one of them
 * would be taken as page time.
 */
async function shoot(
  take: () => Promise<Buffer>,
  before: Buffer | null,
  verify = false,
): Promise<{ png: Buffer; stable: boolean; moved: Box | null }> {
  const first = await take();
  if (before && !first.equals(before)) {
    if (!verify) return { png: first, stable: true, moved: null };
    await new Promise((r) => setTimeout(r, 50));
    const again = await take();
    if (again.equals(first)) return { png: first, stable: true, moved: null };
    return { png: again, stable: false, moved: differs(first, again) };
  }
  let previous = first;
  for (let shot = 1; shot < 3; shot++) {
    const next = await take();
    if (next.equals(previous)) return { png: next, stable: true, moved: null };
    if (shot === 2) return { png: next, stable: false, moved: differs(previous, next) };
    previous = next;
  }
  return { png: previous, stable: false, moved: null };
}

/**
 * Frames counted as they come: masked, at CSS resolution, into the judge; their block sums kept.
 * The masked pixels are the judge's unknown ones, so what flashes beside them is measured with them.
 */
function frameCounter(cssPerPx: number, masks: readonly Box[]) {
  let judge: ReturnType<typeof createFlashJudge> | null = null;
  const blocks: Array<FrameBlocks | undefined> = [];
  let size = { width: 0, height: 0 };
  return {
    add(k: number, atMs: number, png: PngPixels): void {
      const frame = toFlashFrame(png, cssPerPx, masks);
      if (!judge) {
        size = { width: frame.width, height: frame.height };
        judge = createFlashJudge({ ...size, ...(masks.length > 0 ? { unknown: maskOf(masks, size) } : {}) });
      }
      judge.push(k, atMs, frame);
      blocks[k] = frame.blocks;
    },
    finish() {
      if (!judge) throw new Error("check flash: no frame was counted");
      return { result: judge.result(), blocks, ...size };
    },
  };
}

/**
 * The viewport as a PNG. On Chromium, straight from the protocol with `optimizeForSpeed`: the
 * encoder then filters every row by "up" only, which halved both the capture (93 → 40ms at
 * 1280x720) and the decode, and 181 frames are shot for a three-second window. The caret is hidden
 * as Playwright's own screenshot hides it, so a focused field's blink is not read as a flash.
 */
async function screenshotter(page: Page): Promise<() => Promise<Buffer>> {
  await page
    .addStyleTag({ content: "*, *::before, *::after { caret-color: transparent !important; }" })
    .catch(() => undefined);
  const bounded = <T>(work: Promise<T>): Promise<T> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const late = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`check flash: a screenshot took more than ${SHOT_TIMEOUT_MS}ms`)),
        SHOT_TIMEOUT_MS,
      );
    });
    return Promise.race([work, late]).finally(() => clearTimeout(timer));
  };
  try {
    const cdp = await page.context().newCDPSession(page);
    return async () =>
      Buffer.from(
        (
          (await bounded(cdp.send("Page.captureScreenshot", { format: "png", optimizeForSpeed: true }))) as {
            data: string;
          }
        ).data,
        "base64",
      );
  } catch {
    return () => bounded(page.screenshot({ animations: "allow" }));
  }
}

/**
 * An image's bytes (the first 8MB), `"missing"` when there are none to draw (a 404, a missing
 * file: nothing is drawn, so nothing animates), or null when they could not be read — which says
 * nothing about whether it animates. Same-origin and CORS images are read by the page; others by
 * the browser context's own request, which no page policy blocks.
 */
async function imageBytes(page: Page, src: string): Promise<Uint8Array | "missing" | null> {
  try {
    if (src.startsWith("data:")) {
      const comma = src.indexOf(",");
      const meta = src.slice(5, comma);
      const body = src.slice(comma + 1);
      return meta.endsWith(";base64") ? Buffer.from(body, "base64") : Buffer.from(decodeURIComponent(body), "latin1");
    }
    if (src.startsWith("file:")) {
      try {
        return (await readFile(fileURLToPath(src))).subarray(0, 8 << 20);
      } catch (error) {
        return (error as NodeJS.ErrnoException).code === "ENOENT" ? "missing" : null;
      }
    }
    if (src.startsWith("blob:")) return null;
    const b64 = await page.evaluate(async (url) => {
      try {
        const response = await fetch(url);
        if (response.status === 404 || response.status === 410) return "missing";
        if (!response.ok) return null;
        const bytes = new Uint8Array(await response.arrayBuffer()).subarray(0, 8 << 20);
        let s = "";
        for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        return btoa(s);
      } catch {
        return null;
      }
    }, src);
    if (b64 === "missing") return "missing";
    if (b64 !== null) return Buffer.from(b64, "base64");
    const response = await page.context().request.get(src, { timeout: 10_000 });
    if (response.status() === 404 || response.status() === 410) return "missing";
    if (!response.ok()) return null;
    return (await response.body()).subarray(0, 8 << 20);
  } catch {
    return null;
  }
}

interface Captured {
  dir: string;
  manifest: FramesManifest;
  files: string[];
  times: number[];
  cssPerPx: number;
  windowMs: number;
  windowFrom: FlashReport["sampling"]["windowFrom"];
  truncated: boolean;
  still: boolean;
  navigations: number;
  url: string;
}

/** What the held clock had queued once the page loaded (`VIRTUAL_CLOCK_SCRIPT`'s `pending()`). */
interface ClockPending {
  timers: number;
  frames: number;
  intervals?: number;
  seekListeners?: number;
  latestTimerMs?: number | null;
}

/** Load, find what cannot be held, and shoot every 60fps frame of the window into `dir`. */
async function sweepPage(
  page: Page,
  options: FlashCheckOptions,
  dir: string,
): Promise<Captured & { unmeasured: UnmeasuredRegion[]; counted: Counted }> {
  const url = sourceToUrl(options.source);
  await page.addInitScript(MEDIA_HOLD_SCRIPT);
  const timeline = await openHeldTimeline(page, url, options);
  await timeline.at(0);
  const held = await timeline.animations();
  const pending = (await page.evaluate(() =>
    (window as unknown as { __vlmkitClock: { pending(): unknown } }).__vlmkitClock.pending(),
  )) as ClockPending;
  // A page that draws only when told the time (`vlmkit:seek`) moves under the held clock too.
  const scripted = pending.timers > 0 || pending.frames > 0 || (pending.seekListeners ?? 0) > 0;
  const take = await screenshotter(page);
  // Nothing can move under the held clock, so one frame is all there is — unless a window was
  // asked for, or the page has frames of its own (each holds its own clock and animations).
  const framed = page.frames().length > 1;
  const still = held.length === 0 && !scripted && !framed && options.windowMs === undefined;
  const facts = await frameSourceFacts(page);
  const dpr = facts.deviceScaleFactor;

  // What the held clock does not hold: media, found at load and again during the sweep (a page
  // can add a video at any time), and an image whose bytes cannot be read is not assumed still.
  const unmeasured: UnmeasuredRegion[] = [];
  const known = new Set<string>();
  const animatedBySrc = new Map<string, boolean | null>();
  const findMedia = async () => {
    let media: Array<{ kind: "video" | "image"; path: string; rect: Box; src?: string }>;
    try {
      media = (await page.evaluate(MEDIA_JS)) as typeof media;
    } catch {
      return;
    }
    for (const m of media) {
      const key = `${m.kind}|${m.path}|${m.src ?? ""}`;
      if (known.has(key)) continue;
      known.add(key);
      if (m.kind === "video") {
        unmeasured.push({ reason: "video", rect: m.rect, path: m.path });
        continue;
      }
      let animated = animatedBySrc.get(m.src!);
      if (animated === undefined) {
        const bytes = await imageBytes(page, m.src!);
        animated = bytes === "missing" ? false : bytes ? sniffImageAnimation(bytes).animated : null;
        animatedBySrc.set(m.src!, animated);
      }
      if (animated === null) unmeasured.push({ reason: "unreadable-image", rect: m.rect, path: m.path });
      else if (animated) unmeasured.push({ reason: "animated-image", rect: m.rect, path: m.path });
    }
  };
  await findMedia();
  // Pixels that change while nothing is advanced: shots a beat apart in real time, at gaps with
  // no common period over about a second, so a strobe of any one rate cannot land in step with them.
  let probe = await take();
  for (const gap of PROBE_GAPS_MS) {
    await new Promise((r) => setTimeout(r, gap));
    const next = await take();
    const moved = differs(probe, next);
    if (moved) unmeasured.push({ reason: "uncontrolled", rect: scaleBox(moved, dpr) });
    probe = next;
  }

  const chosen = chooseWindow(held, scripted, pending.latestTimerMs ?? null);
  const windowMs = still ? 0 : (options.windowMs ?? chosen.windowMs);
  const truncated = !still && options.windowMs === undefined && chosen.truncated;
  const windowFrom: Captured["windowFrom"] = still
    ? "still"
    : options.windowMs !== undefined
      ? "option"
      : held.length > 0
        ? "animations"
        : "default";
  const writer = await frameWriter(dir, {
    tool: "check flash",
    url,
    viewport: page.viewportSize() ?? { width: 0, height: 0 },
    ...facts,
    clock: "held",
  });
  const last = Math.round((windowMs * 60) / 1000);
  const files: string[] = [];
  const times: number[] = [];
  // Counted while shooting, with what was found unmeasured before the sweep painted out; a region
  // found during it means counting again from the files, so every frame is judged the same way.
  const before = mergeUncontrolled(unmeasured);
  const counter = frameCounter(
    dpr,
    before.map((u) => u.rect),
  );
  let previous: Buffer | null = null;
  for (let k = 0; k <= last; k++) {
    const atMs = frameTimeMs(k);
    if (k > 0) await timeline.at(atMs);
    const shot = await shoot(take, previous, k > 0 && k % VERIFY_EVERY === 0);
    previous = shot.png;
    if (shot.moved) unmeasured.push({ reason: "uncontrolled", rect: scaleBox(shot.moved, dpr) });
    files.push(await writer.add(shot.png, { atMs, stable: shot.stable }));
    times.push(atMs);
    counter.add(k, atMs, decodePngPixels(shot.png));
    if (k > 0 && k % MEDIA_EVERY === 0) await findMedia();
  }
  await findMedia();
  const written = await writer.finish();
  const merged = mergeUncontrolled(unmeasured);
  const counted =
    JSON.stringify(merged) === JSON.stringify(before) ? counter.finish() : countFiles(files, times, dpr, merged);
  const manifest = JSON.parse(await readFile(written.manifest, "utf8")) as FramesManifest;
  // What the sweep decided, so the saved sequence is judged again the same way.
  manifest.source.sweep = {
    still,
    windowMs,
    windowFrom: windowFrom as "option" | "animations" | "default" | "still",
    truncated,
  };
  if (merged.length > 0) manifest.source.unmeasured = merged;
  await writeFile(written.manifest, `${JSON.stringify(manifest, null, 2)}\n`);
  return {
    dir,
    manifest,
    files,
    times,
    cssPerPx: dpr,
    windowMs,
    windowFrom,
    truncated,
    still,
    navigations: timeline.navigations(),
    url,
    unmeasured: merged,
    counted,
  };
}

/**
 * `uncontrolled` boxes that touch (within 8px) as one — one unheld thing seen at different moments —
 * and boxes apart kept apart: two small spinners at opposite corners are two small regions, not
 * one viewport-wide one. Media regions are kept as they are.
 */
export function mergeUncontrolled(regions: readonly UnmeasuredRegion[]): UnmeasuredRegion[] {
  const out = regions.filter((r) => r.reason !== "uncontrolled");
  let boxes = regions.filter((r) => r.reason === "uncontrolled").map((r) => r.rect);
  const near = (a: Box, b: Box) =>
    a.x - 8 < b.x + b.width && b.x - 8 < a.x + a.width && a.y - 8 < b.y + b.height && b.y - 8 < a.y + a.height;
  for (let merged = true; merged;) {
    merged = false;
    for (let i = 0; i < boxes.length && !merged; i++) {
      for (let j = i + 1; j < boxes.length && !merged; j++) {
        if (!near(boxes[i]!, boxes[j]!)) continue;
        const a = boxes[i]!;
        const b = boxes[j]!;
        const x = Math.min(a.x, b.x);
        const y = Math.min(a.y, b.y);
        const union = {
          x,
          y,
          width: Math.max(a.x + a.width, b.x + b.width) - x,
          height: Math.max(a.y + a.height, b.y + b.height) - y,
        };
        boxes = [...boxes.filter((_, k) => k !== i && k !== j), union];
        merged = true;
      }
    }
  }
  boxes.sort((a, b) => a.y - b.y || a.x - b.x);
  return [...out, ...boxes.map((rect) => ({ reason: "uncontrolled" as const, rect }))];
}

/** CSS-px boxes as a frame-sized mask, 1 inside any. */
function maskOf(boxes: readonly Box[], size: { width: number; height: number }): Uint8Array {
  const mask = new Uint8Array(size.width * size.height);
  for (const b of boxes) {
    const x0 = Math.max(0, b.x);
    const x1 = Math.min(size.width, b.x + b.width);
    for (let y = Math.max(0, b.y); y < Math.min(size.height, b.y + b.height); y++) {
      if (x1 > x0) mask.fill(1, y * size.width + x0, y * size.width + x1);
    }
  }
  return mask;
}

/** A decoded frame with its unmeasured pixels painted out, at CSS resolution. */
function toFlashFrame(png: PngPixels, cssPerPx: number, masks: readonly Box[]): FlashFrame {
  const c = png.channels;
  for (const m of masks) {
    const x0 = Math.max(0, Math.floor(m.x * cssPerPx));
    const y0 = Math.max(0, Math.floor(m.y * cssPerPx));
    const x1 = Math.min(png.width, Math.ceil((m.x + m.width) * cssPerPx));
    const y1 = Math.min(png.height, Math.ceil((m.y + m.height) * cssPerPx));
    for (let y = y0; y < y1; y++) png.data.fill(0, (y * png.width + x0) * c, (y * png.width + x1) * c);
  }
  return flashFrame(png.data, png.width, png.height, cssPerPx, c);
}

type Counted = ReturnType<ReturnType<typeof frameCounter>["finish"]>;

/** Count a sequence from its files. */
function countFiles(
  files: readonly string[],
  times: readonly number[],
  cssPerPx: number,
  unmeasured: readonly UnmeasuredRegion[],
): Counted {
  const counter = frameCounter(
    cssPerPx,
    unmeasured.map((u) => u.rect),
  );
  files.forEach((file, k) => counter.add(k, times[k]!, decodePngPixels(readFileSync(file))));
  return counter.finish();
}

/** Frames by index, decoded on demand, a few kept: what the motion re-count reads. */
function frameSequence(
  files: readonly string[],
  times: readonly number[],
  cssPerPx: number,
  masks: readonly Box[],
  blocks: ReadonlyArray<FrameBlocks | undefined>,
) {
  const cache = new Map<number, FlashFrame>();
  return {
    times,
    blocks: (k: number) => blocks[k],
    frame(k: number): FlashFrame {
      const hit = cache.get(k);
      if (hit) return hit;
      const f = toFlashFrame(decodePngPixels(readFileSync(files[k]!)), cssPerPx, masks);
      cache.set(k, f);
      if (cache.size > 4) cache.delete(cache.keys().next().value!);
      return f;
    },
  };
}

function worstOf(
  ev: FlashEvaluation | null,
  times: readonly number[],
  maxGapMs: number,
  fieldArea: number,
): FlashWorst | null {
  if (!ev) return null;
  const first = ev.pixel.frames[0];
  const span = first === undefined ? 0 : times[ev.frame]! - times[first]!;
  return {
    fromMs: ev.atMs - WINDOW_MS,
    toMs: ev.atMs,
    frame: ev.frame,
    transitions: ev.maxTransitions,
    flashesPerSecond: ev.maxTransitions / 2,
    areaCss2: ev.area,
    fieldShare: Math.round((ev.area / fieldArea) * 10000) / 10000,
    field: ev.field,
    bbox: ev.bbox,
    frames: ev.pixel.frames,
    knifeEdge: ev.maxTransitions === MAX_TRANSITIONS + 1 && span >= WINDOW_MS - maxGapMs - 1e-6,
  };
}

/** The most CSS px² of `regions` inside any one field of a `width x height` frame. */
function unmeasuredArea(regions: readonly UnmeasuredRegion[], width: number, height: number): number {
  if (regions.length === 0) return 0;
  const mask = new Uint8Array(width * height);
  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  for (const { rect } of regions) {
    const ax = Math.max(0, rect.x);
    const ay = Math.max(0, rect.y);
    const bx = Math.min(width, rect.x + rect.width);
    const by = Math.min(height, rect.y + rect.height);
    for (let y = ay; y < by; y++) mask.fill(1, y * width + ax, y * width + bx);
    if (bx > ax && by > ay) {
      x0 = Math.min(x0, ax);
      y0 = Math.min(y0, ay);
      x1 = Math.max(x1, bx - 1);
      y1 = Math.max(y1, by - 1);
    }
  }
  if (x1 < 0) return 0;
  const fw = Math.min(FIELD_CSS.width, width);
  const fh = Math.min(FIELD_CSS.height, height);
  return bestField(mask, width, height, fw, fh, x0, y0, x1, y1).area;
}

/** A still sheet of the worst window: the frame before its first transition, then each transition. */
function writeStrip(
  path: string,
  files: readonly string[],
  times: readonly number[],
  worst: FlashWorst,
  cssPerPx: number,
): void {
  const picks = [...new Set([Math.max(0, (worst.frames[0] ?? worst.frame) - 1), ...worst.frames])].slice(0, 8);
  const f = worst.field;
  const cells: PngData[] = [];
  for (const k of picks) {
    const png = decode(readFileSync(files[k]!));
    const x0 = Math.floor(f.x * cssPerPx);
    const y0 = Math.floor(f.y * cssPerPx);
    const w = Math.min(png.width - x0, Math.ceil(f.width * cssPerPx));
    const h = Math.min(png.height - y0, Math.ceil(f.height * cssPerPx));
    const data = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++)
      data.set(png.data.subarray(((y0 + y) * png.width + x0) * 4, ((y0 + y) * png.width + x0 + w) * 4), y * w * 4);
    cells.push({ width: w, height: h, data });
  }
  const sheet = composeFilmstrip(cells, {
    columns: Math.min(4, cells.length),
    cellLabels: picks.map((k) => `t=${(times[k]! / 1000).toFixed(3)}s #${k}`),
    maxWidth: 1600,
  });
  const png = new PNG({ width: sheet.width, height: sheet.height });
  png.data = Buffer.from(sheet.data);
  writeFileSync(path, PNG.sync.write(png));
}

/** The criteria block: the same on every report. */
function criteria(): FlashReport["criteria"] {
  return {
    luminanceStep: LUMINANCE_STEP,
    darkerBelow: DARKER_BELOW,
    transitionsAllowedPerWindow: MAX_TRANSITIONS,
    window: "(t − 1s, t], every frame a transition ended on",
    redRatio: RED_RATIO,
    redFloor: `(R − G − B) > ${RED_FLOOR.toFixed(4)} on linear channels (IRIS's (R−G−B)·320 > 20)`,
    redUv: RED_UV_STEP,
    blackChromaticity: WHITE_UV,
    fieldCss: [FIELD_CSS.width, FIELD_CSS.height],
    areaLimitCss2: AREA_LIMIT_CSS2,
    areaSource:
      "25% of the 341x256 CSS px field: G176's 21,824 sq px (the Understanding text's 87,296 is the whole field)",
    closing: "3x3 closing of the flashing pixels before the area is measured (a dither counts as its region)",
    fineDetail: "WCAG's 0.1° exception for fine balanced patterns is not applied: such patterns are reported",
  };
}

const trackOf = (
  result: FlashTrackResult,
  times: readonly number[],
  maxGapMs: number,
  fieldArea: number,
): FlashTrackReport => ({
  verdict: "pass",
  worst: worstOf(result.worst, times, maxGapMs, fieldArea),
  peakTransitions: result.peak.transitions,
  largestBelowCss2: result.largestBelow,
  withUnknownCss2: result.withUnknown,
  failingWindows: result.failingWindows,
  runs: result.runs.length,
});

/** Settle a counted sequence: classify the failing tracks, decide each verdict. */
function judge(
  counted: Counted,
  files: readonly string[],
  times: readonly number[],
  cssPerPx: number,
  unmeasured: readonly UnmeasuredRegion[],
  sampling: { still: boolean },
): {
  general: FlashTrackReport;
  red: FlashTrackReport;
  judgeable: boolean;
  maxGapMs: number;
  unmeasuredAreaCss2: number;
  classifyMs: number;
} {
  const t0 = performance.now();
  const { result, width, height } = counted;
  const seq = frameSequence(
    files,
    times,
    cssPerPx,
    unmeasured.map((u) => u.rect),
    counted.blocks,
  );
  const maxGapMs = times.slice(1).reduce((m, t, i) => Math.max(m, t - times[i]!), 0);
  // A failure needs 7 transitions inside one window, so 7 frames inside one.
  let judgeable = sampling.still;
  for (let k = MAX_TRANSITIONS; k < times.length && !judgeable; k++) {
    if (times[k]! - times[k - MAX_TRANSITIONS]! < WINDOW_MS - 1e-6) judgeable = true;
  }
  const fieldArea = result.field.width * result.field.height;
  const unmeasuredAreaCss2 = unmeasuredArea(unmeasured, width, height);
  const tracks = {} as Record<FlashTrack, FlashTrackReport>;
  for (const track of ["general", "red"] as const) {
    const r = trackOf(result[track], times, maxGapMs, fieldArea);
    if (result[track].runs.length > 0) {
      const verdict = classifyFlash(seq, track, result[track].runs);
      r.classification = verdict.classification;
      r.reason = verdict.reason;
      r.motion = verdict.segments;
      if (verdict.classification === "flash") r.verdict = "fail";
    }
    // What was not measured, alone or with what flashed beside it, could be over the limit: no pass.
    const unknown = unmeasuredAreaCss2 > AREA_LIMIT_CSS2 || r.withUnknownCss2 > AREA_LIMIT_CSS2;
    if (r.verdict !== "fail" && (!judgeable || unknown)) r.verdict = "not-judgeable";
    tracks[track] = r;
  }
  return { ...tracks, judgeable, maxGapMs, unmeasuredAreaCss2, classifyMs: performance.now() - t0 };
}

/** Whether a saved sequence is every 60fps frame of its span on the held clock, each shot stable. */
export function manifestComplete(manifest: FramesManifest): boolean {
  if (manifest.source.clock !== "held") return false;
  const frames = manifest.frames;
  if (frames.some((f) => !f.stable)) return false;
  const n0 = Math.round((frames[0]!.atMs * 60) / 1000);
  return frames.every((f, i) => Math.abs(f.atMs - frameTimeMs(n0 + i)) < 1e-6);
}

/** The track whose window the strip shows: a failing one, else one motion excused, else any that flashed. */
function stripTrack(report: Pick<FlashReport, "general" | "red">): FlashTrackReport | null {
  const tracks = [report.general, report.red].filter((t) => t.worst);
  return (
    tracks.find((t) => t.verdict === "fail") ?? tracks.find((t) => t.classification === "motion") ?? tracks[0] ?? null
  );
}

const NO_STRIP = "nothing flashed more than three times in any second, so there is no window to show";

export async function runFlashCheck(options: FlashCheckOptions): Promise<FlashReport> {
  if (options.stripPath && !/\.png$/i.test(options.stripPath)) {
    throw new UsageError("--strip writes one still PNG (never an animation of a failing window): name it .png");
  }
  if (/\.json$/i.test(options.source)) return judgeManifest(options);
  if (options.windowMs !== undefined && (options.windowMs < WINDOW_MS || options.windowMs > 60_000)) {
    throw new UsageError(
      "--window is the page time to sweep, 1000 to 60000 ms: a failure is more than six transitions within one second",
    );
  }
  const viewport = options.viewport ?? DEFAULT_FLASH_VIEWPORT;
  if (!(viewport.width >= 1 && viewport.height >= 1)) {
    throw new UsageError(`--viewport must be at least 1x1 (got ${viewport.width}x${viewport.height})`);
  }
  const run = async (browser: Browser) => {
    const keep = options.framesDir ? resolve(options.framesDir) : null;
    const dir = keep ?? (await mkdtemp(join(tmpdir(), "vlmkit-flash-")));
    let page: Page | null = null;
    try {
      page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
      const t0 = performance.now();
      const captured = await sweepPage(page, options, dir);
      const capture = performance.now() - t0;
      const unstableFrames = captured.manifest.frames.filter((f) => !f.stable).length;
      const complete = unstableFrames === 0;
      const judged = judge(captured.counted, captured.files, captured.times, captured.cssPerPx, captured.unmeasured, {
        still: captured.still,
      });
      // What animated over each failing (or motion-excused) track's flashing pixels, at its worst instant.
      for (const track of ["general", "red"] as const) {
        const r = judged[track];
        if (!r.worst || r.classification === undefined) continue;
        try {
          r.animations = (await page.evaluate(
            attributionJs(r.worst.fromMs, r.worst.toMs, r.worst.bbox),
          )) as FlashAttribution[];
        } catch {
          // A page that navigated away has no held list to read.
        }
      }
      const report: FlashReport = {
        format: FLASH_FORMAT,
        source: {
          kind: "page",
          path: options.source,
          url: captured.url,
          viewport,
          cssPerPx: captured.cssPerPx,
          clock: "held",
          ...(keep ? { manifest: join(keep, "frames.json") } : {}),
        },
        criteria: criteria(),
        sampling: {
          frames: captured.files.length,
          spanMs: captured.times[captured.times.length - 1]! - captured.times[0]!,
          maxGapMs: judged.maxGapMs,
          complete,
          judgeable: judged.judgeable,
          still: captured.still,
          windowMs: captured.windowMs,
          windowFrom: captured.windowFrom,
          truncated: captured.truncated,
          unstableFrames,
          navigations: captured.navigations,
        },
        general: judged.general,
        red: judged.red,
        unmeasured: captured.unmeasured,
        unmeasuredAreaCss2: judged.unmeasuredAreaCss2,
        ...(keep ? { framesManifest: join(keep, "frames.json") } : {}),
        // Counting runs inside the capture loop, so its time is in `capture`.
        timingMs: { capture: Math.round(capture), judge: 0, classify: Math.round(judged.classifyMs) },
      };
      if (options.stripPath) {
        const worst = stripTrack(report)?.worst;
        if (worst) {
          writeStrip(resolve(options.stripPath), captured.files, captured.times, worst, captured.cssPerPx);
          report.strip = resolve(options.stripPath);
        } else report.stripSkipped = NO_STRIP;
      }
      return report;
    } finally {
      await page?.close().catch(() => undefined);
      if (!keep) await rm(dir, { recursive: true, force: true });
    }
  };
  return options.browser ? run(options.browser) : withBrowser(run);
}

/** Judge a saved `frames.json` again, no browser. */
async function judgeManifest(options: FlashCheckOptions): Promise<FlashReport> {
  const path = resolve(options.source);
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch {
    throw new UsageError(`frames manifest not found: ${options.source}`);
  }
  const manifest = parseFramesManifest(text);
  const dir = dirname(path);
  const files = manifest.frames.map((f) => join(dir, f.file));
  const times = manifest.frames.map((f) => f.atMs);
  for (let i = 1; i < times.length; i++) {
    if (!(times[i]! > times[i - 1]!))
      throw new UsageError(`frames manifest: frame ${i} is not later than frame ${i - 1}`);
  }
  const cssPerPx = manifest.source.deviceScaleFactor || 1;
  const unmeasured = manifest.source.unmeasured ?? [];
  const complete = manifestComplete(manifest);
  // The sweep's own decisions when it wrote them; an older manifest's still page is inferred.
  const sweep = manifest.source.sweep;
  const still = sweep
    ? sweep.still
    : manifest.source.tool === "check flash" && manifest.frames.length === 1 && complete;
  const t0 = performance.now();
  const counted = countFiles(files, times, cssPerPx, unmeasured);
  const countMs = performance.now() - t0;
  const judged = judge(counted, files, times, cssPerPx, unmeasured, { still });
  const report: FlashReport = {
    format: FLASH_FORMAT,
    source: {
      kind: "frames",
      path: options.source,
      url: manifest.source.url,
      viewport: manifest.source.viewport,
      cssPerPx,
      clock: manifest.source.clock,
      manifest: path,
    },
    criteria: criteria(),
    sampling: {
      frames: files.length,
      spanMs: times[times.length - 1]! - times[0]!,
      maxGapMs: judged.maxGapMs,
      complete,
      judgeable: judged.judgeable,
      still,
      windowMs: sweep ? sweep.windowMs : times[times.length - 1]! - times[0]!,
      windowFrom: "manifest",
      truncated: sweep?.truncated ?? false,
      unstableFrames: manifest.frames.filter((f) => !f.stable).length,
      navigations: 0,
    },
    general: judged.general,
    red: judged.red,
    unmeasured,
    unmeasuredAreaCss2: judged.unmeasuredAreaCss2,
    timingMs: { capture: 0, judge: Math.round(countMs), classify: Math.round(judged.classifyMs) },
  };
  if (options.stripPath) {
    const worst = stripTrack(report)?.worst;
    if (worst) {
      writeStrip(resolve(options.stripPath), files, times, worst, cssPerPx);
      report.strip = resolve(options.stripPath);
    } else report.stripSkipped = NO_STRIP;
  }
  return report;
}

const pct = (share: number) => `${Math.round(share * 1000) / 10}%`;
const secs = (ms: number) => `${(ms / 1000).toFixed(3)}s`;

/** Flashes a second from a transition count; the per-pixel record keeps 16, so 16 reads "8+". */
export const flashRate = (transitions: number): string =>
  transitions >= TRANSITIONS_KEPT ? `${TRANSITIONS_KEPT / 2}+` : (transitions / 2).toFixed(1);

function trackLine(name: string, t: FlashTrackReport): string {
  const w = t.worst;
  if (t.verdict === "fail" && w) {
    return `${name} FAIL ${flashRate(w.transitions)} flashes/s at its worst, over ${pct(w.fieldShare)} of a field`;
  }
  if (t.verdict === "not-judgeable") return `${name} NOT JUDGEABLE`;
  if (t.classification === "motion") return `${name} pass (motion flicker)`;
  return `${name} pass`;
}

export function flashHeadline(report: FlashReport): string {
  const s = report.sampling;
  const sampling = s.still
    ? "still: nothing moves under the held clock"
    : `${s.frames} frames over ${(s.spanMs / 1000).toFixed(1)}s${s.complete ? " @60fps, complete" : ", incomplete"}`;
  return `${trackLine("general", report.general)} | ${trackLine("red", report.red)} | ${sampling}`;
}

function describeTrack(name: "general" | "red", t: FlashTrackReport, limit: number, rules?: RuleView): string[] {
  const lines: string[] = [];
  const w = t.worst;
  // The rule that carries this verdict, so the prose and the exit code say the same thing.
  const rule = t.verdict === "fail" ? `${name}-flash` : t.classification === "motion" ? "motion-flicker" : null;
  const tag = rule ? (rules?.setting(rule) === "off" ? ` [${rule} is off: not reported]` : ` [${rule}]`) : "";
  lines.push(
    `${name}: ${t.verdict}${t.classification ? ` (${t.classification}${t.reason ? `: ${t.reason}` : ""})` : ""}${tag}`,
  );
  if (w) {
    lines.push(
      `  worst window ${secs(w.fromMs)}–${secs(w.toMs)}: ${w.transitions} transitions (${flashRate(w.transitions)} flashes) over ${w.areaCss2.toLocaleString("en-US")} CSS px², ${pct(w.fieldShare)} of the field at (${w.field.x},${w.field.y}); limit ${limit.toLocaleString("en-US")}${w.knifeEdge ? " — knife edge: one frame either way decides it" : ""}`,
    );
  } else {
    lines.push(
      `  most transitions at one pixel in any second: ${t.peakTransitions} (a failure needs ${MAX_TRANSITIONS + 1})`,
    );
  }
  if (t.largestBelowCss2 > 0)
    lines.push(`  largest flashing area under the limit: ${t.largestBelowCss2.toLocaleString("en-US")} CSS px²`);
  if (t.withUnknownCss2 > limit)
    lines.push(
      `  with the unmeasured pixels beside it: ${t.withUnknownCss2.toLocaleString("en-US")} CSS px² in one field, over the limit, so no pass`,
    );
  for (const seg of t.motion ?? []) {
    const span = `${secs(seg.fromMs + 1000)}–${secs(seg.toMs)}`;
    if (seg.skipped) {
      lines.push(`  ${span} not re-counted: past the re-count's frame budget, so not excused`);
    } else if (seg.residualArea === null) {
      lines.push(
        `  re-counted ${span}: a failing field's mean colour makes ${seg.fieldTransitions} transitions in a second — a strobe, whatever moves in front of it`,
      );
    } else {
      const v = seg.velocity ? `, moving ${Math.hypot(seg.velocity.x, seg.velocity.y).toFixed(0)} px/s` : "";
      lines.push(
        `  re-counted ${span}: field mean ${seg.fieldTransitions} transitions; ${seg.residualArea.toLocaleString("en-US")} CSS px² still flashing after motion compensation, ${pct(seg.explainedShare ?? 0)} of changed steps explained${v}`,
      );
    }
  }
  for (const a of t.animations ?? [])
    lines.push(`  over it: ${a.path}${a.name ? ` (${a.name})` : ""} animating ${a.properties.join(", ") || "?"}`);
  return lines;
}

export function formatFlashReport(report: FlashReport, rules?: RuleView): string {
  const s = report.sampling;
  const lines = [
    `check flash: ${report.source.path}`,
    flashHeadline(report),
    `sampling: ${s.frames} frame(s), ${(s.spanMs / 1000).toFixed(3)}s, largest gap ${s.maxGapMs.toFixed(1)}ms, ${s.complete ? "complete" : "incomplete"}${s.unstableFrames ? `, ${s.unstableFrames} unstable` : ""}; window ${s.windowMs}ms (${s.windowFrom})${s.truncated ? `, cut at the ${MAX_WINDOW_MS / 1000}s cap: the page's later motion was not swept` : ""}${s.navigations ? `; the page navigated ${s.navigations} time(s)` : ""}`,
    ...describeTrack("general", report.general, report.criteria.areaLimitCss2, rules),
    ...describeTrack("red", report.red, report.criteria.areaLimitCss2, rules),
  ];
  for (const u of report.unmeasured) {
    lines.push(
      `unmeasured: ${u.reason} ${u.rect.width}x${u.rect.height} at (${u.rect.x},${u.rect.y})${u.path ? ` ${u.path}` : ""}`,
    );
  }
  if (report.unmeasured.length > 0) {
    lines.push(
      `  ${report.unmeasuredAreaCss2.toLocaleString("en-US")} CSS px² unmeasured in one field (limit ${report.criteria.areaLimitCss2.toLocaleString("en-US")})`,
    );
  }
  if (report.framesManifest) lines.push(`frames: ${report.framesManifest}`);
  if (report.strip) lines.push(`strip: ${report.strip}`);
  if (report.stripSkipped) lines.push(`strip: not written — ${report.stripSkipped}`);
  lines.push('A pass is "no flash measured under these criteria", not a certification.');
  return lines.join("\n");
}
