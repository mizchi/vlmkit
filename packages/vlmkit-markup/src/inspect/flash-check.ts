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
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import type { Browser, Frame, Page } from "playwright";
import { withBrowser } from "@mizchi/vlmkit-core/browser-launch.ts";
import { sourceToUrl } from "@mizchi/vlmkit-core/page-open.ts";
import type { PageLoadOptions } from "@mizchi/vlmkit-core/page-load.ts";
import { sniffImageAnimation } from "@mizchi/vlmkit-core/animated-image.ts";
import { composeFilmstrip } from "@mizchi/vlmkit-core/filmstrip.ts";
import { decodePngBuffer, decodePngPixels, type PngPixels } from "@mizchi/vlmkit-core/png-decode.ts";
import {
  alive,
  isVideoFile,
  processIdentity,
  scanVideo,
  STALE_UNKNOWN_MS,
  type ScanVideoOptions,
} from "@mizchi/vlmkit-core/video-decode.ts";
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
  formatInstant,
  frameTimeMs,
  parseFramesManifest,
  type FramesClock,
  type FramesManifest,
  type FramesVideo,
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
  /** A page (html file or URL), a `frames.json` to judge again, or a recording (`isVideoFile`). */
  source: string;
  /**
   * Recording source: how it is decoded (with the user's own ffmpeg, `scanVideo`) and how big it is
   * shown. `framesDir` keeps the decoded frames; without it they go to a temporary directory.
   */
  video?: Pick<
    ScanVideoOptions,
    | "selection"
    | "displayWidth"
    | "maxFrames"
    | "stream"
    | "ffmpeg"
    | "ffprobe"
    | "colorMatrix"
    | "colorRange"
    | "background"
  >;
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

/**
 * The history a span is decoded with: the second its first window covers, and two more to warm each
 * pixel's count. A pixel's state at the window's start depends on everything before it (whether
 * the change it is in was already counted), and a count started cold some way back can differ by
 * one transition from the whole recording's (measured: a pixel stepping 0 → 0.06 → 0.12 just
 * before a strobe lost the first step with one second of history). Warmed for two seconds, a
 * difference needs one slow change running through all three, and a verdict decided by one
 * transition says so (`report.history`); a history from the recording's start is exact.
 */
export const SPAN_HISTORY_MS = 3000;

export interface FlashReport {
  format: typeof FLASH_FORMAT;
  source: {
    kind: "page" | "frames" | "video";
    path: string;
    url?: string;
    viewport: { width: number; height: number };
    cssPerPx: number;
    clock: FramesClock;
    manifest?: string;
    /** A recording's decoding: codec, decoder, colour, which frames. */
    video?: FramesVideo;
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
    /**
     * Every frame of the span is present: a held-clock 60fps sequence, every capture stable, or a
     * recording's frames with none of the stream's left out between the first and the last.
     */
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
    /** A recording's frames that are not all of it: why a pass on them is not backed. */
    partial?: string;
    /** A span decoded with its history: the windows judged end from here. */
    judgedFromMs?: number;
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
  /**
   * A recording whose codec or chroma subsampling moves what is measured (measured: ±3% of the area
   * of an edge, a keyframe cadence that pumps): what that makes of this verdict.
   */
  lossy?: string[];
  /** A span counted from a history that does not reach the recording's start, whose verdict one transition decides. */
  history?: string;
  /**
   * An interlaced recording failing only between the two fields of the same frames: what a
   * field-rate flicker and still fine detail line-doubled (a text slide, PsF) both are.
   */
  fieldDetail?: string[];
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
  // Elements are told apart by identity, kept across scans: a path names siblings alike, and three
  // videos in one grid are three regions.
  const ids = window.__vlmkitMediaIds || (window.__vlmkitMediaIds = new WeakMap());
  const idOf = (el) => {
    let id = ids.get(el);
    if (id === undefined) {
      id = window.__vlmkitMediaNext = (window.__vlmkitMediaNext || 0) + 1;
      ids.set(el, id);
    }
    return id;
  };
  const add = (kind, el, src) => {
    const rect = clip(el.getBoundingClientRect());
    if (!rect) return;
    const id = idOf(el);
    const key = kind + "|" + id + "|" + (src || "");
    if (seen.has(key)) return;
    seen.add(key);
    const p = path(el);
    out.push(src ? { kind, id, path: p, rect, src } : { kind, id, path: p, rect });
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
 * The window to sweep: each finite animation's end; for one that repeats forever, one period past
 * its start and a second more, which holds every one-second window of its cycle (a strobe that
 * begins late is seen flashing for a second, and a 4s ticker loop is not swept for 9s);
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
    if (a.iterations === null) ms = Math.max(ms, SCRIPT_WINDOW_MS, a.startMs + a.durationMs + WINDOW_MS);
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
function frameCounter(cssPerPx: number, masks: readonly Box[], judgeFromMs?: number, margins = false) {
  let judge: ReturnType<typeof createFlashJudge> | null = null;
  const blocks: Array<FrameBlocks | undefined> = [];
  let size = { width: 0, height: 0 };
  return {
    add(k: number, atMs: number, png: PngPixels): void {
      const frame = toFlashFrame(png, cssPerPx, masks);
      if (!judge) {
        size = { width: frame.width, height: frame.height };
        judge = createFlashJudge({
          ...size,
          ...(masks.length > 0 ? { unknown: maskOf(masks, size) } : {}),
          ...(judgeFromMs !== undefined ? { judgeFromMs } : {}),
          ...(margins ? { margins: true } : {}),
        });
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
 * A `data:` URL's body as bytes, as the URL standard reads it: `%XX` is that byte and anything else
 * — a stray `%` in inline SVG's `width='100%'` — is itself; decodeURIComponent threw on it, which
 * made a static background unreadable.
 */
export function dataUrlBytes(src: string): Buffer {
  const comma = src.indexOf(",");
  const meta = src.slice(5, comma);
  const body = src.slice(comma + 1);
  const out: number[] = [];
  for (let i = 0; i < body.length; i++) {
    const c = body.charCodeAt(i);
    if (c === 0x25 && /^[0-9a-f]{2}$/i.test(body.slice(i + 1, i + 3))) {
      out.push(parseInt(body.slice(i + 1, i + 3), 16));
      i += 2;
    } else if (c < 0x80) {
      out.push(c);
    } else {
      // A character past ASCII is its UTF-8 bytes (a surrogate pair is one character).
      const ch = String.fromCodePoint(body.codePointAt(i)!);
      out.push(...Buffer.from(ch, "utf8"));
      i += ch.length - 1;
    }
  }
  const bytes = Buffer.from(out);
  return /;base64$/i.test(meta) ? Buffer.from(bytes.toString("latin1"), "base64") : bytes;
}

/**
 * An image's bytes (the first 8MB), `"missing"` when there are none to draw (a 404, a missing
 * file: nothing is drawn, so nothing animates), or null when they could not be read — which says
 * nothing about whether it animates. Same-origin, CORS and `blob:` images are read by the frame
 * that shows them; others by the browser context's own request, which no page policy blocks.
 */
async function imageBytes(frame: Frame, src: string): Promise<Uint8Array | "missing" | null> {
  try {
    if (src.startsWith("data:")) return dataUrlBytes(src).subarray(0, 8 << 20);
    if (src.startsWith("file:")) {
      try {
        return (await readFile(fileURLToPath(src))).subarray(0, 8 << 20);
      } catch (error) {
        return (error as NodeJS.ErrnoException).code === "ENOENT" ? "missing" : null;
      }
    }
    const b64 = await frame.evaluate(async (url) => {
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
    if (src.startsWith("blob:")) return null;
    const response = await frame.page().context().request.get(src, { timeout: 10_000 });
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
  // Every frame's: an iframe's delayed strobe or pending timer sets the window as the page's would.
  const pending: ClockPending = await timeline.pending();
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
  const frameNo = new Map<Frame, number>();
  const viewport = page.viewportSize() ?? { width: 0, height: 0 };
  // Every frame's media, in the page's coordinates and clipped to the frame that shows it: a
  // video inside an iframe is paused by the same init script and must be reported as one.
  const findMedia = async () => {
    for (const frame of page.frames()) {
      if (frame.isDetached()) continue;
      if (!frameNo.has(frame)) frameNo.set(frame, frameNo.size);
      let box: Box = { x: 0, y: 0, width: viewport.width, height: viewport.height };
      if (frame !== page.mainFrame()) {
        const element = await frame.frameElement().catch(() => null);
        const b = element ? await element.boundingBox().catch(() => null) : null;
        if (!b) continue;
        box = { x: b.x, y: b.y, width: b.width, height: b.height };
      }
      let media: Array<{ kind: "video" | "image"; id: number; path: string; rect: Box; src?: string }>;
      try {
        media = (await frame.evaluate(MEDIA_JS)) as typeof media;
      } catch {
        continue;
      }
      for (const m of media) {
        const key = `${frameNo.get(frame)}|${m.kind}|${m.id}|${m.src ?? ""}`;
        if (known.has(key)) continue;
        const x0 = Math.max(0, box.x, m.rect.x + box.x);
        const y0 = Math.max(0, box.y, m.rect.y + box.y);
        const x1 = Math.min(viewport.width, box.x + box.width, m.rect.x + box.x + m.rect.width);
        const y1 = Math.min(viewport.height, box.y + box.height, m.rect.y + box.y + m.rect.height);
        if (!(x1 > x0 && y1 > y0)) continue;
        known.add(key);
        const rect = {
          x: Math.floor(x0),
          y: Math.floor(y0),
          width: Math.ceil(x1) - Math.floor(x0),
          height: Math.ceil(y1) - Math.floor(y0),
        };
        const where = frame === page.mainFrame() ? m.path : `iframe ${m.path}`;
        if (m.kind === "video") {
          unmeasured.push({ reason: "video", rect, path: where });
          continue;
        }
        let animated = animatedBySrc.get(m.src!);
        if (animated === undefined) {
          const bytes = await imageBytes(frame, m.src!);
          animated = bytes === "missing" ? false : bytes ? sniffImageAnimation(bytes).animated : null;
          animatedBySrc.set(m.src!, animated);
        }
        if (animated === null) unmeasured.push({ reason: "unreadable-image", rect, path: where });
        else if (animated) unmeasured.push({ reason: "animated-image", rect, path: where });
      }
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
  let windowMs = still ? 0 : (options.windowMs ?? chosen.windowMs);
  let truncated = !still && options.windowMs === undefined && chosen.truncated;
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
  let last = Math.round((windowMs * 60) / 1000);
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
    if (k === last && !still && options.windowMs === undefined) {
      // What the page began during the sweep — an animation an animationend or a chained timer
      // started, an interval set up late — sets the window as what was there at load did.
      const more = chooseWindow(await timeline.animations(), scripted, null);
      const now = await timeline.pending();
      let want = more.windowMs;
      if ((now.intervals ?? 0) > (pending.intervals ?? 0)) want = Math.max(want, atMs + 2 * WINDOW_MS);
      const capped = Math.min(MAX_WINDOW_MS, Math.ceil(want / 100) * 100);
      if (capped > windowMs) {
        truncated ||= more.truncated || want > MAX_WINDOW_MS;
        windowMs = capped;
        last = Math.round((windowMs * 60) / 1000);
      }
    }
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
  judgeFromMs?: number,
  margins = false,
): Counted {
  const counter = frameCounter(
    cssPerPx,
    unmeasured.map((u) => u.rect),
    judgeFromMs,
    margins,
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
  sampling: { still: boolean; complete?: boolean },
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
  // A failure needs 7 transitions inside one window, so 7 frames inside one. A recording's frames
  // with none left out (the whole of it, or a span with its history) and fewer than that in every
  // second cannot show a failure at all: their pass is real.
  let judgeable = sampling.still || sampling.complete === true;
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

/**
 * Whether a saved sequence is every frame of its span, each shot stable: every 60fps frame on the
 * held clock, or on the stream clock every frame the recording decodes to between the first and the
 * last kept (consecutive indices). A recording's frames are its whole content, so nothing happened
 * between two consecutive ones that a display could have shown.
 */
export function manifestComplete(manifest: FramesManifest): boolean {
  const frames = manifest.frames;
  if (frames.some((f) => !f.stable)) return false;
  if (manifest.source.clock === "stream") return streamCoverage(manifest).complete;
  if (manifest.source.clock !== "held") return false;
  const n0 = Math.round((frames[0]!.atMs * 60) / 1000);
  return frames.every((f, i) => Math.abs(f.atMs - frameTimeMs(n0 + i)) < 1e-6);
}

export interface StreamCoverage {
  /**
   * Every frame of the recording from the start of the first window judged to the last frame is
   * here: under 7 frames in every second, nothing can fail, so a pass is real.
   */
  complete: boolean;
  /** The whole recording. */
  whole: boolean;
  /** A span decoded with its history: judge only the windows ending inside it. */
  judgeFromMs?: number;
  /**
   * That history reaches back to the recording's first frame, so each pixel is counted as the whole
   * recording counts it. Otherwise it starts cold some seconds before (`SPAN_HISTORY_MS`).
   */
  fromStart?: boolean;
  /** Why it is not complete, for the reader. */
  partial?: string;
}

/**
 * What a stream-clock sequence covers. Its frames are the recording's whole content only when
 * they are every frame the recording shows (consecutive indices, from the first to the last); a
 * span cut out of it misses the second before it, which a window ending in its first second
 * needs — unless it was decoded with that second (`leadInMs`), as `check flash rec.mp4 --from`
 * does. An import without `--every-frame` vouches for nothing: another tool may have thinned it.
 */
export function streamCoverage(manifest: FramesManifest): StreamCoverage {
  const frames = manifest.frames;
  const video = manifest.source.video;
  const consecutive =
    frames.every((f) => f.stable) && frames.every((f, i) => f.index !== undefined && f.index === frames[0]!.index! + i);
  if (!consecutive) {
    return { complete: false, whole: false, partial: "frames of the recording are left out between the ones here" };
  }
  if (video?.damaged) {
    return {
      complete: false,
      whole: false,
      partial: "the demuxer reported corrupt or lost packets, so frames may be missing between the ones here",
    };
  }
  if (video?.decoder === "import" && video.streamFrames === undefined) {
    return {
      complete: false,
      whole: false,
      partial: "imported frames another tool wrote, not marked as every frame (scan video <dir> --every-frame)",
    };
  }
  const first = frames[0]!.index!;
  const last = frames[frames.length - 1]!.index!;
  const whole = first === 0 && video?.streamFrames !== undefined && last === video.streamFrames - 1;
  const selection = video?.selection;
  // A span asked for with its history: only the windows ending at or after its start are judged —
  // the start asked for, not the start of the frame on screen then, whose window can end seconds
  // before it in a held frame (measured: a strobe that stopped before a 3s hold failed a span in it).
  let judgeFromMs: number | undefined;
  if (selection?.kind === "span" && selection.leadInMs !== undefined && selection.fromMs > frames[0]!.atMs + 1e-6) {
    judgeFromMs = selection.fromMs;
  }
  const at = judgeFromMs !== undefined ? { judgeFromMs, fromStart: first === 0 } : {};
  if (whole) return { complete: true, whole: true, ...at };
  if (selection?.kind === "span" && (selection.leadInMs ?? 0) >= WINDOW_MS - 1e-6) {
    return { complete: true, whole: false, ...at };
  }
  if (first === 0) return { complete: true, whole: false, ...at };
  return {
    complete: false,
    whole: false,
    partial: `the frames begin ${Number(frames[0]!.atMs.toFixed(1))}ms into the recording with no second before them, so a window ending in their first second is missing its start (check flash on the recording with --from decodes it)`,
  };
}

/** A saved sequence is judged as it was captured: what only a page sweep reads is refused, not dropped. */
function refusePageFlags(options: FlashCheckOptions): void {
  if (options.windowMs !== undefined || options.framesDir || options.viewport) {
    throw new UsageError(
      "a frames.json is judged as it was captured: --window, --frames and --viewport are for a page",
    );
  }
  if (options.video) {
    throw new UsageError(
      "a frames.json is judged as it was decoded: --from, --to, --display-width and the other recording flags are for the recording itself",
    );
  }
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
  if (/\.json$/i.test(options.source)) {
    refusePageFlags(options);
    return judgeManifest(options);
  }
  if (isVideoFile(options.source)) return judgeVideo(options);
  if (existsSync(options.source) && statSync(options.source).isDirectory()) {
    // A frames directory (scan video's <recording>.frames/): its frames.json, not a file listing in Chromium.
    const manifest = join(options.source, "frames.json");
    if (existsSync(manifest)) {
      refusePageFlags(options);
      return judgeManifest({ ...options, source: manifest });
    }
    throw new UsageError(
      `${options.source} is a directory with no frames.json: to judge frames another tool wrote, import them first (vlmkit scan video ${options.source} --pts <file> --every-frame)`,
    );
  }
  if (options.video) {
    throw new UsageError(
      "--display-width, --from, --to, --stream, --max-frames, --color-matrix, --color-range, --background, --ffmpeg and --ffprobe are for a recording (mp4, webm, mov, mkv, gif, …)",
    );
  }
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

const TEMP_PREFIX = "vlmkit-flash-video-";

/**
 * The temporary frames of earlier runs whose process is gone (interrupted: a signal skips
 * `finally`). Named `<pid>-<identity>-`: a pid of another host or PID namespace reads as dead here,
 * so another identity's directory goes only once it is a day old.
 */
async function sweepStaleTemp(): Promise<void> {
  let names: string[];
  try {
    names = await readdir(tmpdir());
  } catch {
    return;
  }
  const id = processIdentity();
  for (const name of names) {
    const m = name.startsWith(TEMP_PREFIX) ? name.slice(TEMP_PREFIX.length).match(/^(\d+)-(?:([0-9a-f]{8})-)?/) : null;
    if (!m) continue;
    const pid = Number(m[1]);
    const path = join(tmpdir(), name);
    if (m[2] === id) {
      if (pid === process.pid || alive(pid)) continue;
    } else {
      try {
        if (Date.now() - statSync(path).mtimeMs <= STALE_UNKNOWN_MS) continue;
      } catch {
        continue;
      }
    }
    await rm(path, { recursive: true, force: true }).catch(() => undefined);
  }
}

/**
 * Decode a recording with the user's own ffmpeg (`scanVideo`) and judge its frames as a saved
 * sequence: `check flash rec.mp4` is `scan video rec.mp4` then `check flash rec.mp4.frames/frames.json`,
 * the same answer either way.
 */
async function judgeVideo(options: FlashCheckOptions): Promise<FlashReport> {
  if (options.windowMs !== undefined || options.viewport) {
    throw new UsageError(
      "a recording is judged over its own frames: --window and --viewport are for a page (--from / --to choose a span, --display-width how big it plays)",
    );
  }
  const keep = options.framesDir ? resolve(options.framesDir) : null;
  // Named for this process: a run killed mid-decode cannot remove its own, so the next one does.
  if (!keep) await sweepStaleTemp();
  const dir = keep ?? (await mkdtemp(join(tmpdir(), `${TEMP_PREFIX}${process.pid}-${processIdentity()}-`)));
  try {
    const t0 = performance.now();
    // A span is decoded with the seconds before it: a window ending at its start needs that history.
    const video = options.video ?? {};
    const selection =
      video.selection?.kind === "span" ? { ...video.selection, leadInMs: SPAN_HISTORY_MS } : video.selection;
    const scanned = await scanVideo({ file: options.source, out: dir, ...video, ...(selection ? { selection } : {}) });
    const decodeMs = performance.now() - t0;
    const report = await judgeManifest(
      { ...options, source: scanned.manifestPath },
      { kind: "video", path: options.source, keep: keep !== null },
    );
    report.timingMs.capture = Math.round(decodeMs);
    if (keep) report.framesManifest = scanned.manifestPath;
    return report;
  } finally {
    if (!keep) await rm(dir, { recursive: true, force: true });
  }
}

/** Judge a saved `frames.json` again, no browser. */
async function judgeManifest(
  options: FlashCheckOptions,
  as: { kind: "video"; path: string; keep: boolean } | null = null,
): Promise<FlashReport> {
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
  const coverage = manifest.source.clock === "stream" ? streamCoverage(manifest) : null;
  // The sweep's own decisions when it wrote them; an older manifest's still page is inferred.
  const sweep = manifest.source.sweep;
  const still = sweep
    ? sweep.still
    : manifest.source.tool === "check flash" && manifest.frames.length === 1 && complete;
  const t0 = performance.now();
  // A span whose history starts cold measures how far its verdict is from one transition either way.
  const coldHistory = coverage?.judgeFromMs !== undefined && !coverage.fromStart;
  const counted = countFiles(files, times, cssPerPx, unmeasured, coverage?.judgeFromMs, coldHistory);
  const countMs = performance.now() - t0;
  const judged = judge(counted, files, times, cssPerPx, unmeasured, { still, complete: coverage?.complete === true });
  const video = manifest.source.video;
  const report: FlashReport = {
    format: FLASH_FORMAT,
    source: {
      kind: as?.kind ?? "frames",
      path: as?.path ?? options.source,
      url: manifest.source.url,
      // A manifest another tool wrote may leave it out: the frames' own size at its scale.
      viewport: manifest.source.viewport ?? { width: counted.width, height: counted.height },
      cssPerPx,
      clock: manifest.source.clock,
      ...(as === null || as.keep ? { manifest: path } : {}),
      ...(video ? { video } : {}),
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
      ...(coverage?.partial ? { partial: coverage.partial } : {}),
      ...(coverage?.judgeFromMs !== undefined ? { judgedFromMs: coverage.judgeFromMs } : {}),
    },
    general: judged.general,
    red: judged.red,
    unmeasured,
    unmeasuredAreaCss2: judged.unmeasuredAreaCss2,
    timingMs: { capture: 0, judge: Math.round(countMs), classify: Math.round(judged.classifyMs) },
  };
  if (video) {
    const lossy = lossyNotes(video, manifest, report);
    if (lossy.length > 0) report.lossy = lossy;
  }
  if (video?.fields && (judged.general.verdict === "fail" || judged.red.verdict === "fail")) {
    // The frame-rate sequence: each frame's first field (or the frame itself, when not split).
    const keep = manifest.frames.map((f, i) => (f.field === 1 ? -1 : i)).filter((i) => i >= 0);
    if (keep.length < files.length && keep.length > 1) {
      const subFiles = keep.map((i) => files[i]!);
      const subTimes = keep.map((i) => times[i]!);
      const sub = judge(
        countFiles(subFiles, subTimes, cssPerPx, unmeasured, coverage?.judgeFromMs),
        subFiles,
        subTimes,
        cssPerPx,
        unmeasured,
        { still, complete: coverage?.complete === true },
      );
      const notes = (["general", "red"] as const)
        .filter((track) => judged[track].verdict === "fail" && sub[track].verdict !== "fail")
        .map(
          (track) =>
            `${track}: fails only between the two fields of the same frames; judged a frame at a time it does not. A field-rate flicker and still fine detail split into its fields (a text slide, PsF) are the same woven frames, so this fail is not decisive`,
        );
      if (notes.length > 0) report.fieldDetail = notes;
    }
  }
  if (coldHistory) {
    const history = coverage!.judgeFromMs! - times[0]!;
    const limit = report.criteria.areaLimitCss2;
    // By area, not by the peak: a small region strobing ten times beside a large one at seven hid it.
    const byOne = (["general", "red"] as const).filter((track) => {
      const t = report[track];
      const m = counted.result[track].margins;
      if (!m) return false;
      if (t.verdict === "fail") return m.above <= limit;
      return t.classification === undefined && m.below > limit;
    });
    if (byOne.length > 0) {
      report.history = `${byOne.join(" and ")}: decided by one transition, and the span was counted from ${secs(history)} of history, not the recording's start: a pixel in one slow change through all of it can count one transition differently. Judge the whole recording (no --from) for the exact count`;
    }
  }
  if (options.stripPath) {
    const worst = stripTrack(report)?.worst;
    if (worst) {
      writeStrip(resolve(options.stripPath), files, times, worst, cssPerPx);
      report.strip = resolve(options.stripPath);
    } else report.stripSkipped = NO_STRIP;
  }
  return report;
}

/**
 * Whether a pixel format stores chroma at less than full resolution: 4:2:0, 4:2:2, 4:1:1, 4:4:0,
 * the semi-planar nv / p0xx layouts, the packed 4:2:2 ones and Bayer mosaics. 4:4:4, RGB, grey and
 * palettes keep every pixel's colour.
 */
export function chromaSubsampled(pixelFormat: string): boolean {
  if (/^(yuv|yuvj|yuva)4(20|22|11|10|40)/.test(pixelFormat)) return true;
  if (/^(nv1[26]|nv2[01]|nv24|nv42|p01[026]|p2[01]0|p21[06])/.test(pixelFormat))
    return pixelFormat.match(/^nv(24|42)/) === null;
  return /^(yuyv|uyvy|yvyu|uyyvyy|y210|y212|bayer_)/.test(pixelFormat);
}

/** Within this share of the area limit, a lossy or chroma-subsampled recording does not decide the verdict. */
const LOSSY_NEAR = 0.05;
/** More keyframes a second than this, and a lossy codec's re-quantization at each can itself flicker. */
const PUMPING_KEYFRAMES_PER_S = 3;

/**
 * What a lossy or chroma-subsampled recording does to this verdict, measured (scan-video-v1):
 * 4:2:0 alone took the 1px rim off a red/black box's area (21,904 → 21,316 CSS px², fail →
 * pass) and lossy ringing grew a black/white one (+3.3% at crf 45), so an area within 5% of the
 * limit is not decisive; and a two-frame GOP at crf 45 made dense static text fail on its own,
 * so more than 3 keyframes a second is said to be able to pump.
 */
function lossyNotes(
  video: FramesVideo,
  manifest: FramesManifest,
  report: Pick<FlashReport, "general" | "red" | "criteria">,
): string[] {
  const subsampled = video.pixelFormat !== undefined && chromaSubsampled(video.pixelFormat);
  if (video.lossless && !subsampled) return [];
  const why = video.lossless ? `chroma subsampled (${video.pixelFormat})` : `${video.codec}, lossy`;
  const limit = report.criteria.areaLimitCss2;
  const out: string[] = [];
  for (const [name, t] of [
    ["general", report.general],
    ["red", report.red],
  ] as const) {
    const area = t.worst?.areaCss2 ?? t.largestBelowCss2;
    if (area > 0 && Math.abs(area - limit) <= limit * LOSSY_NEAR) {
      out.push(
        `${name}: ${area.toLocaleString("en-US")} CSS px² is within 5% of the 21,824 limit, and the recording is ${why}: codec and subsampling move an edge's area by a few percent either way, so this ${t.verdict} is not decisive`,
      );
    }
  }
  const failing = report.general.verdict === "fail" || report.red.verdict === "fail";
  if (!video.lossless && failing) {
    const frames = manifest.frames;
    const span = (frames[frames.length - 1]!.atMs - frames[0]!.atMs) / 1000;
    const keys = frames.filter((f) => f.key).length;
    if (span >= 1 && keys / span > PUMPING_KEYFRAMES_PER_S) {
      out.push(
        `${(keys / span).toFixed(1)} keyframes a second in a lossy stream: each re-quantizes the picture, and at that cadence the codec can itself flicker fine detail (a two-frame GOP made static text fail at crf 45)`,
      );
    }
  }
  return out;
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
    : `${s.frames} frames over ${(s.spanMs / 1000).toFixed(1)}s${s.complete ? (report.source.clock === "stream" ? ", every recorded frame" : " @60fps, complete") : ", incomplete"}`;
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
  const v = report.source.video;
  const lines = [
    `check flash: ${report.source.path}`,
    flashHeadline(report),
    ...(v
      ? [
          `recording: ${v.codec}${v.decoder === "import" ? "" : v.lossless ? " (lossless)" : " (lossy)"} decoded by ${v.decoder}, shown at ${report.source.viewport.width}x${report.source.viewport.height} CSS px (${Number(report.source.cssPerPx.toFixed(4))} frame px per CSS px: --display-width sets it)${v.color?.assumed.length ? `; ${v.color.assumed.join(" and ")} not tagged, assumed ${v.color.matrix} ${v.color.range === "tv" ? "limited" : "full"} (--color-matrix / --color-range override)` : ""}`,
          ...(v.timing === "browser" && v.loop
            ? [
                `recording: timed as a browser plays it (a frame of 10ms or less is held 100ms), looped ${v.loop.passes} pass(es) of ${v.loop.passMs}ms (plays ${v.loop.plays === null ? "forever" : `${v.loop.plays} time(s)`})`,
              ]
            : []),
          ...(v.hidden
            ? [`recording: ${v.hidden} decoded frame(s) never on screen (sharing a timestamp with the next) left out`]
            : []),
          ...(v.notes ?? []).map((n) => `recording: ${n}`),
          ...(v.decodeErrors?.length
            ? [
                `recording: the decoder reported errors (judged on what it decoded): ${v.decodeErrors.slice(0, 3).join(" | ")}`,
              ]
            : []),
          ...(report.lossy ?? []).map((n) => `recording: ${n}`),
          ...(report.history ? [`recording: ${report.history}`] : []),
          ...(report.fieldDetail ?? []).map((n) => `recording: ${n}`),
        ]
      : []),
    `sampling: ${s.frames} frame(s), ${(s.spanMs / 1000).toFixed(3)}s, largest gap ${s.maxGapMs.toFixed(1)}ms, ${s.complete ? "complete" : `incomplete${s.partial ? ` (${s.partial})` : ""}`}${s.judgedFromMs !== undefined ? `; windows judged from ${secs(s.judgedFromMs)}, the frames before decoded as their history` : ""}${s.unstableFrames ? `, ${s.unstableFrames} unstable` : ""}; window ${formatInstant(s.windowMs)}ms (${s.windowFrom})${s.truncated ? `, cut at the ${MAX_WINDOW_MS / 1000}s cap: the page's later motion was not swept` : ""}${s.navigations ? `; the page navigated ${s.navigations} time(s)` : ""}`,
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
