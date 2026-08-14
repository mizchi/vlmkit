#!/usr/bin/env node
/**
 * Frame-sampled animation evaluator.
 *
 * The behavioral complement of `check motion` (which only scans CSSOM
 * declarations): this drives every animation on the page through a set of
 * deterministic sample points via the Web Animations API — pause, seek
 * `currentTime`, screenshot — and evaluates the *rendered* result:
 *
 *   - does the animation visibly change pixels at all (dead animations:
 *     declared but no visual effect)?
 *   - motion region bbox + per-interval pixel magnitude
 *   - settle time (when does the page stop moving) and infinite
 *     animations that never settle — the VRT-determinism killers,
 *     reported with a ready-to-use `--mask` selector
 *   - `prefers-reduced-motion: reduce` honored *behaviorally* (emulated
 *     re-render, not a CSS-text regex)
 *
 * Seeking a paused timeline instead of racing the wall clock keeps every
 * frame reproducible. Pixels + Playwright only, no VLM.
 *
 * Hover/focus-triggered transitions are out of scope here — `check motion`
 * reports their declarations, `inspect interact` exercises them.
 *
 * Usage:
 *   vlmkit check animation <html-or-url>
 *   vlmkit check animation <html-or-url> --json --frames out/frames
 */
import { mkdir, writeFile } from "node:fs/promises";
import { STABLE_SELECTOR_JS } from "../stable-selector.ts";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { PNG } from "pngjs";
import { BOLD, CYAN, DIM, GREEN, RED, RESET, YELLOW } from "@mizchi/vlmkit-core/terminal-colors.ts";
import { type PageLoadOptions, navigatePage, navigationOptions } from "@mizchi/vlmkit-core/page-load.ts";
import { withBrowser } from "@mizchi/vlmkit-core/browser-launch.ts";
import { UsageError } from "@mizchi/vlmkit-core/cli-error.ts";
import { composeFilmstrip } from "@mizchi/vlmkit-core/filmstrip.ts";
import { cropRegion, encodePng } from "@mizchi/vlmkit-core/png-utils.ts";
import { encodeWebp, imageFormatForPath } from "@mizchi/vlmkit-core/webp.ts";

export interface AnimationTimingSample {
  /** Index into the page's animation list at capture time. */
  index: number;
  /** Best-effort stable selector of the animation's effect target. */
  selector: string;
  type: "css-animation" | "css-transition" | "waapi";
  /** animation-name / transition-property / WAAPI id (best effort). */
  name: string;
  durationMs: number;
  delayMs: number;
  /** null = infinite. */
  iterations: number | null;
  /** Play state as found on the page, captured BEFORE the evaluator pauses it. */
  playState: string;
  /** currentTime as found on the page (ms), captured before pausing. */
  currentTimeMs: number;
  /** animation-direction: normal / reverse / alternate / alternate-reverse. */
  direction: string;
  /**
   * Keyframes end where they start (first and last keyframes equal, with a
   * differing keyframe in between) — one iteration is a full out-and-back
   * sweep even without `alternate`.
   */
  palindromic: boolean;
}

export interface OscillationInfo {
  /** The animation sweeps out and back rather than jumping to restart. */
  oscillating: boolean;
  /** Duration of one visual leg (one extreme to the other), in ms. */
  legMs: number;
}

/**
 * Effective oscillation of one animation. WAAPI folds both `alternate`
 * iterations and palindromic keyframes (0% -> 50% -> 100% retracing) into
 * the same `durationMs xN` shape, so two implementations of "pulse forever"
 * can differ 2x in visual frequency while reporting identical duration —
 * the S5 blind spot (motion brief said "1.2s per leg"; a palindromic 1.2s
 * cycle passed the gate at double speed). `alternate` spends one full
 * iteration per leg; palindromic keyframes complete out-and-back within a
 * single iteration, so each leg is half the duration.
 */
export function computeOscillation(
  t: Pick<AnimationTimingSample, "durationMs" | "direction" | "palindromic">,
): OscillationInfo {
  if (t.direction.startsWith("alternate")) return { oscillating: true, legMs: t.durationMs };
  if (t.palindromic) return { oscillating: true, legMs: t.durationMs / 2 };
  return { oscillating: false, legMs: t.durationMs };
}

export interface FrameDeltaStat {
  changedPixels: number;
  /** changedPixels / total pixels. */
  ratio: number;
  /** Bounding box of changed pixels; null when nothing changed. */
  bbox: { x: number; y: number; width: number; height: number } | null;
}

export interface AnimationFrameStat extends FrameDeltaStat {
  /** Sampled progress through one iteration (0..1]. */
  fraction: number;
}

export interface EvaluatedAnimation extends AnimationTimingSample {
  frames: AnimationFrameStat[];
  /** Any sampled interval moved at least minChangedPixels pixels. */
  visible: boolean;
  /** Union of all frame bboxes; null when the animation never moved. */
  motionBbox: { x: number; y: number; width: number; height: number } | null;
  totalChangedPixels: number;
  maxFrameRatio: number;
}

export interface ReducedMotionRemaining {
  selector: string;
  name: string;
  durationMs: number;
}

export type AnimationEvalIssueKind =
  | "no-visible-effect"
  | "infinite-animation"
  | "reduced-motion-ignored"
  | "long-settle"
  | "uncontrolled-motion";

export interface AnimationEvalIssue {
  kind: AnimationEvalIssueKind;
  severity: "warn" | "suspect";
  message: string;
  selector?: string;
}

export interface AnimationEvalReport {
  source: string;
  viewport: { width: number; height: number };
  animationCount: number;
  evaluated: EvaluatedAnimation[];
  /** Max over finite animations of delay + duration × iterations; null when an infinite animation is present. */
  settleMs: number | null;
  infinite: { selector: string; name: string }[];
  /** Present unless the reduced-motion pass was skipped or there were no animations. */
  reducedMotion?: {
    remainingCount: number;
    remaining: ReducedMotionRemaining[];
  };
  /**
   * Pixel delta between two back-to-back rest captures with every WAAPI
   * animation held still. Present (nonzero) means a motion source the Web
   * Animations API cannot enumerate or pause — a rAF/JS-driven animation,
   * video, or GIF — is moving the page on its own.
   */
  uncontrolledMotion?: FrameDeltaStat;
  issues: AnimationEvalIssue[];
  /** Written sample frames (when --frames was passed). */
  framePaths?: string[];
  /** Written when `stripPath` was given: one image holding every sampled frame. */
  strip?: {
    path: string;
    columns: number;
    rows: number;
    /** Evaluated animations left out because they moved no pixels. */
    omitted: number;
    /** Evaluated animations left out because `--strip-selector` did not match them. */
    outOfScope: number;
    /** Page-timeline span the columns cover, in ms. */
    windowMs: number;
    /** The instant each column was taken at, in ms from the animations' start. */
    times: number[];
    /** Row order, top to bottom. */
    rowSelectors: string[];
  width: number;
    height: number;
  };
}

export interface AnimationEvalOptions extends PageLoadOptions {
  source: string;
  html?: string;
  viewport?: { width: number; height: number };
  /** Sample points per animation iteration (default 4 → 25/50/75/100%). */
  samples?: number;
  /** Max animations to evaluate frame-by-frame (default 8). */
  maxAnimations?: number;
  /** Per-channel tolerance when diffing frames (default 8). */
  tolerance?: number;
  /** Pixel floor below which an animation counts as visually dead (default 12). */
  minChangedPixels?: number;
  /** settleMs above this raises `long-settle` (default 3000). */
  settleThresholdMs?: number;
  /** Duration floor for "still animating" under reduced-motion emulation (default 100ms). */
  reducedMotionDurationFloorMs?: number;
  /** Skip the reduced-motion emulation pass. */
  skipReducedMotion?: boolean;
  /** Write each sampled frame PNG into this directory. */
  framesDir?: string;
  /**
   * Composite every sampled frame into ONE image at this path, one row per
   * animation. `--frames` writes N files a reader has to open in order; this
   * writes the sequence a reader (or a model, which cannot press play) can take
   * in at a glance.
   */
  stripPath?: string;
  /** Cap the strip's width, downscaling frames to fit. Default 1600. */
  stripMaxWidth?: number;
  /**
   * Page-timeline span the strip's columns cover, in ms. Defaults to when the last
   * finite animation ends, so the columns cover the part someone is reviewing rather
   * than an infinite animation's period.
   */
  stripWindowMs?: number;
  /**
   * Restrict the strip's rows to animations whose target matches this CSS selector.
   * The gate still evaluates and reports every animation; this only scopes the image.
   */
  stripSelector?: string;
}

interface RgbaFrame {
  width: number;
  height: number;
  data: Uint8Array;
}

function isUrl(source: string): boolean {
  return /^(https?|file):\/\//.test(source);
}

/**
 * Pixel delta between two same-size RGBA frames: count, ratio, and the
 * bounding box of every pixel whose any channel moved more than tolerance.
 */
export function frameDelta(a: RgbaFrame, b: RgbaFrame, tolerance = 8): FrameDeltaStat {
  if (a.width !== b.width || a.height !== b.height) {
    throw new Error(`frameDelta: size mismatch ${a.width}x${a.height} vs ${b.width}x${b.height}`);
  }
  let changed = 0;
  let minX = a.width, minY = a.height, maxX = -1, maxY = -1;
  for (let y = 0; y < a.height; y++) {
    for (let x = 0; x < a.width; x++) {
      const i = (y * a.width + x) * 4;
      if (
        Math.abs(a.data[i]! - b.data[i]!) > tolerance
        || Math.abs(a.data[i + 1]! - b.data[i + 1]!) > tolerance
        || Math.abs(a.data[i + 2]! - b.data[i + 2]!) > tolerance
      ) {
        changed++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  const total = a.width * a.height;
  return {
    changedPixels: changed,
    ratio: total > 0 ? changed / total : 0,
    bbox: changed > 0
      ? { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
      : null,
  };
}

/**
 * Rest-pose time for an animation: page-paused/finished animations stay at
 * their author-chosen currentTime (their true resting appearance); running
 * finite animations seek past their end (settled appearance); running
 * infinite ones hold at 0.
 */
export function restTimeForAnimation(t: AnimationTimingSample): number {
  if (t.playState !== "running") return t.currentTimeMs;
  return t.iterations === null ? 0 : t.delayMs + t.durationMs * t.iterations;
}

export function unionBbox(
  a: { x: number; y: number; width: number; height: number } | null,
  b: { x: number; y: number; width: number; height: number } | null,
): { x: number; y: number; width: number; height: number } | null {
  if (!a) return b;
  if (!b) return a;
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  };
}

/** Max over finite animations of delay + duration × iterations; null when any animation is infinite. */
export function computeSettleMs(animations: AnimationTimingSample[]): number | null {
  let settle = 0;
  for (const anim of animations) {
    if (anim.iterations === null) return null;
    settle = Math.max(settle, anim.delayMs + anim.durationMs * anim.iterations);
  }
  return settle;
}

export interface DeriveIssuesInput {
  evaluated: EvaluatedAnimation[];
  settleMs: number | null;
  infinite: { selector: string; name: string }[];
  reducedMotion?: { remainingCount: number; remaining: ReducedMotionRemaining[] };
  uncontrolledMotion?: FrameDeltaStat;
}

export function deriveAnimationIssues(
  input: DeriveIssuesInput,
  options: { settleThresholdMs?: number; reducedMotionDurationFloorMs?: number } = {},
): AnimationEvalIssue[] {
  const settleThreshold = options.settleThresholdMs ?? 3000;
  // Quoted in the reduced-motion remedy, so the number the caller is told to get under
  // is the number the gate actually measures against.
  const durationFloor = options.reducedMotionDurationFloorMs ?? 100;
  const issues: AnimationEvalIssue[] = [];

  for (const anim of input.evaluated) {
    if (!anim.visible) {
      issues.push({
        kind: "no-visible-effect",
        severity: "suspect",
        selector: anim.selector,
        message: `${anim.selector} animation \`${anim.name}\` (${anim.durationMs}ms) produced no visible pixel change at any sampled frame — dead animation or animated property has no rendered effect.`,
      });
    }
  }

  for (const anim of input.infinite) {
    issues.push({
      kind: "infinite-animation",
      severity: "warn",
      selector: anim.selector,
      // Both original suggestions changed the *harness*, which is the one thing a
      // "fix the page" task is not allowed to do. A dogfood agent put it plainly:
      // "the report was 'it never holds still long enough to screenshot' — so the
      // finding's own advice is the one thing I was not allowed to do. It never
      // mentions the CSS-level option (bound the iteration count), which is what I
      // did." The page-side fix goes first now; the harness ones stay for the case
      // where the animation is meant to run forever.
      message: `${anim.selector} animation \`${anim.name}\` runs forever — the page never settles.`
        + ` To fix the page, give it a bounded \`animation-iteration-count\` (or stop it once its work is done).`
        + ` If it is meant to run forever, the capture side has to absorb it instead:`
        + ` mask it with \`vlmkit snapshot <url> --mask "${anim.selector}"\` (that flag belongs to \`snapshot\` / \`diff html\`, not to this gate)`
        + ` or pause animations before screenshots.`,
    });
  }

  if (input.settleMs !== null && input.settleMs > settleThreshold) {
    issues.push({
      kind: "long-settle",
      severity: "warn",
      message: `Page keeps animating for ${Math.round(input.settleMs)}ms after load (threshold ${settleThreshold}ms) — captures inside this window are nondeterministic.`,
    });
  }

  if (input.uncontrolledMotion) {
    const m = input.uncontrolledMotion;
    const where = m.bbox ? ` at (${m.bbox.x},${m.bbox.y}) ${m.bbox.width}x${m.bbox.height}` : "";
    issues.push({
      kind: "uncontrolled-motion",
      severity: "warn",
      message: `The page moved between two back-to-back captures with every WAAPI animation held still (${m.changedPixels}px${where}) — a rAF/JS-driven animation, video, or GIF the Web Animations API cannot enumerate or pause. Per-animation frame deltas overlapping this region may be contaminated (a dead animation can read as visible), the page never settles for VRT, and reduced-motion emulation does not affect it. Mask the region or stub the ticker for capture.`,
    });
  }

  if (input.reducedMotion && input.reducedMotion.remainingCount > 0) {
    const sample = input.reducedMotion.remaining[0];
    issues.push({
      kind: "reduced-motion-ignored",
      severity: "suspect",
      ...(sample ? { selector: sample.selector } : {}),
      // Names every animation it can and says what would satisfy it. A dogfood agent:
      // "`reduced-motion-ignored` is attributed to an arbitrary element
      // (`h1:nth-of-type(1)`, 'e.g.') for a page-wide problem, and never says what would
      // satisfy it — I guessed a global media query." The guess was right; it should not
      // have been a guess.
      message: `${input.reducedMotion.remainingCount} animation(s) still run under \`prefers-reduced-motion: reduce\` emulation: `
        + `${input.reducedMotion.remaining.slice(0, 4).map((r) => `${r.selector} \`${r.name}\` ${Math.round(r.durationMs)}ms`).join(", ")}`
        + `${input.reducedMotion.remaining.length > 4 ? `, and ${input.reducedMotion.remaining.length - 4} more` : ""}`
        + ` — motion is not reduced for users who requested it.`
        + ` Add \`@media (prefers-reduced-motion: reduce)\` and either set \`animation: none\` on them`
        + ` or shorten each duration below ${durationFloor}ms.`,
    });
  }

  return issues;
}

/**
 * Shared browser-side helpers. Kept as one string used by both scripts below,
 * because a recorded animation and a live one must be described identically or
 * the dedupe between them silently fails.
 */
const ANIMATION_HELPERS_JS = `
  ${STABLE_SELECTOR_JS}

  function describeTiming(anim) {
    let timing = { duration: 0, delay: 0, iterations: 1, direction: "normal" };
    try {
      const computed = anim.effect && anim.effect.getComputedTiming ? anim.effect.getComputedTiming() : null;
      if (computed) {
        timing = {
          duration: typeof computed.duration === "number" ? computed.duration : 0,
          delay: computed.delay || 0,
          iterations: computed.iterations,
          direction: computed.direction || "normal",
        };
      }
    } catch {}
    return timing;
  }

  // Palindrome detection: the first and last keyframes agree on every
  // animated property while some keyframe in between differs — one
  // iteration visually sweeps out and back (same effective motion as
  // alternate, at twice the frequency).
  function isPalindromic(anim) {
    try {
      const keyframes = anim.effect && anim.effect.getKeyframes ? anim.effect.getKeyframes() : [];
      if (keyframes.length < 3) return false;
      const skip = new Set(["offset", "computedOffset", "easing", "composite"]);
      const first = keyframes[0];
      const last = keyframes[keyframes.length - 1];
      const props = Object.keys(first).filter((k) => !skip.has(k));
      return props.length > 0
        && props.every((k) => k in last && String(first[k]) === String(last[k]))
        && keyframes.slice(1, -1).some((mid) =>
          props.some((k) => k in mid && String(mid[k]) !== String(first[k]))
        );
    } catch {}
    return false;
  }

  function animationKind(anim) {
    const ctor = anim.constructor ? anim.constructor.name : "";
    return ctor === "CSSAnimation" ? "css-animation" : ctor === "CSSTransition" ? "css-transition" : "waapi";
  }

  function animationName(anim) {
    return anim.animationName || anim.transitionProperty || anim.id || "(anonymous)";
  }
`;

/**
 * Record every animation as it STARTS, before the page's own scripts run.
 *
 * `document.getAnimations()` only reports animations that still exist, and a
 * finished CSS animation with no `fill` mode — `animation: fadeIn 0.3s ease-out`,
 * the ordinary spelling for an entrance animation — is removed outright. Watched
 * on this repo's own `fixtures/css-challenge/dashboard.html` (four `.stat-card`
 * fade-ins, 300ms, delays to 150ms), polling from navigation start:
 *
 *   47ms:4  151ms:4  255ms:4  358ms:3  462ms:1  564ms:0  668ms:0  771ms:0
 *
 * The collector runs at ~765ms, so it saw **zero animations** on a page with
 * four, and reported `animationCount 0`, `settle 0ms` and no reduced-motion
 * finding. `fill: forwards` stayed at 1 for the whole window, which is why the
 * defect hid: every fixture written to test this gate used `forwards`.
 *
 * `animationstart` fires once per animation per iteration-zero and bubbles to
 * the document, and the Animation object is alive when it does — so the timing
 * can be read then and survives the object's removal. Animations still live at
 * collection time are deduped against these records by (selector, name).
 */
const RECORD_ANIMATION_STARTS_SCRIPT = `(() => {
${ANIMATION_HELPERS_JS}
  const started = [];
  window.__vlmkitStarted = started;
  // Held here as well as recorded. A finite animation is otherwise gone from
  // document.getAnimations() by the time the evaluator looks, and a record alone
  // cannot be seeked -- so the strip showed one animation of five, and the four it
  // dropped were the ones under review. Pausing at the start keeps every animation
  // alive and seekable; the author's own play state is read BEFORE the pause, which
  // is what keeps "the page paused this" distinguishable from "we paused it".
  window.__vlmkitHeld = [];
  const record = (event) => {
    const target = event.target;
    if (!target || !target.getAnimations) return;
    for (const anim of target.getAnimations()) {
      const name = animationName(anim);
      if (event.animationName !== undefined && name !== event.animationName) continue;
      const timing = describeTiming(anim);
      const authorPlayState = anim.playState;
      started.push({
        selector: stableSelector(anim.effect && anim.effect.target ? anim.effect.target : target),
        type: animationKind(anim),
        name,
        durationMs: timing.duration,
        delayMs: timing.delay,
        iterations: Number.isFinite(timing.iterations) ? timing.iterations : null,
        direction: timing.direction || "normal",
        palindromic: isPalindromic(anim),
        authorPlayState,
      });
      window.__vlmkitHeld.push(anim);
      anim.pause();
      return;
    }
  };
  document.addEventListener("animationstart", record, true);
  document.addEventListener("transitionstart", record, true);
})()`;

const COLLECT_ANIMATIONS_SCRIPT = `(() => {
${ANIMATION_HELPERS_JS}
  const anims = document.getAnimations ? document.getAnimations({ subtree: true }) : [];
  window.__vlmkitAnims = anims;
  return anims.map((anim, index) => {
    const timing = describeTiming(anim);
    const palindromic = isPalindromic(anim);
    const type = animationKind(anim);
    const name = animationName(anim);
    const target = anim.effect && anim.effect.target ? anim.effect.target : null;
    // Record the author-visible state BEFORE pausing for evaluation — an
    // animation the page itself holds paused is visually static and must
    // not be reported as running/never-settling.
    //
    // The init script may already have paused this one at animationstart, in which
    // case the live playState is ours and useless. It stashed the author's state
    // alongside; prefer that. Without this every animation would read "paused" and
    // the settle / never-settles / reduced-motion answers would all invert.
    const held = (window.__vlmkitStarted || []).find((r) =>
      r.name === name && r.selector === stableSelector(target));
    const playState = held ? held.authorPlayState : anim.playState;
    const currentTimeMs = typeof anim.currentTime === "number" ? anim.currentTime : 0;
    anim.pause();
    return {
      index,
      selector: stableSelector(target),
      type,
      name,
      durationMs: timing.duration,
      delayMs: timing.delay,
      iterations: Number.isFinite(timing.iterations) ? timing.iterations : null,
      playState,
      currentTimeMs,
      direction: timing.direction || "normal",
      palindromic,
    };
  });
})()`;

function pngFromBuffer(buffer: Buffer): RgbaFrame {
  const png = PNG.sync.read(buffer);
  return {
    width: png.width,
    height: png.height,
    data: new Uint8Array(png.data.buffer, png.data.byteOffset, png.data.byteLength),
  };
}

/**
 * Every animation the page ran: the ones still live at this instant, plus the ones
 * that started and were already removed.
 *
 * A recorded-but-gone animation gets `index: -1` — there is no `Animation` object
 * left to seek, so it cannot be frame-sampled — and `playState: "finished"`,
 * which is what it is. It still counts for `animationCount`, `settleMs`,
 * `infinite` and the reduced-motion verdict, all of which are questions about
 * what the page did rather than about what it is doing right now.
 *
 * Deduped on (selector, name): the same animation appears in both sets when it is
 * long enough to still be running, and `animationstart` also fires for each
 * animation of a multi-name shorthand.
 */
async function collectAnimations(page: import("playwright").Page): Promise<AnimationTimingSample[]> {
  const live = await page.evaluate(COLLECT_ANIMATIONS_SCRIPT) as AnimationTimingSample[];
  const started = await page.evaluate(
    "window.__vlmkitStarted || []",
  ) as Omit<AnimationTimingSample, "index" | "playState" | "currentTimeMs">[];
  const seen = new Set(live.map((t) => `${t.selector}\u0000${t.name}`));
  const finished: AnimationTimingSample[] = [];
  for (const record of started) {
    const key = `${record.selector}\u0000${record.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    finished.push({
      ...record,
      index: -1,
      playState: "finished",
      // Its rest pose is its end, which is where it already sits.
      currentTimeMs: record.delayMs + record.durationMs * (record.iterations ?? 1),
    });
  }
  return [...live, ...finished];
}

export async function runAnimationEval(options: AnimationEvalOptions): Promise<AnimationEvalReport> {
  const viewport = options.viewport ?? { width: 1280, height: 720 };
  const samples = Math.max(1, options.samples ?? 4);
  const maxAnimations = options.maxAnimations ?? 8;
  const tolerance = options.tolerance ?? 8;
  const minChangedPixels = options.minChangedPixels ?? 12;

  // Navigate local files via their file: URL so relative stylesheets,
  // scripts, and images resolve — setContent would give the document an
  // about:blank base URL and evaluate an unstyled page.
  const pageUrl = options.html !== undefined
    ? undefined
    : isUrl(options.source) ? options.source : pathToFileURL(resolve(options.source)).href;
  // Both passes (normal + reduced-motion emulation) go through this, so
  // --timeout / --wait-until / --har apply to both. Loading the two under
  // different rules would make the reduced-motion comparison meaningless.
  const loadPage = async (p: import("playwright").Page) => {
    // Before anything the document does: an animation with no `fill` mode is
    // removed from `getAnimations()` the moment it finishes, so it has to be
    // caught as it starts. See RECORD_ANIMATION_STARTS_SCRIPT.
    await p.addInitScript(RECORD_ANIMATION_STARTS_SCRIPT);
    if (options.html !== undefined) {
      await p.setContent(options.html, navigationOptions(options));
    } else {
      await navigatePage(p, pageUrl!, options);
    }
  };

  return await withBrowser(async (browser) => {
    const page = await browser.newPage({ viewport });
    await loadPage(page);

    const timings = await collectAnimations(page);
    // Settle / never-settles are about motion the page performs on its own, so a
    // paused animation does not count. `finished` used to be excluded here too,
    // on the reasoning that it is "visually static" — which quietly made the
    // whole report a race against page-load timing.
    //
    // `playState` is sampled once, at whatever instant the collector runs.
    // Measured on a bare local file: `goto` returns at ~509ms and the settle
    // finishes at ~765ms, so an animation shorter than that has already
    // completed before anything is read. Four identical runs of one fixture
    // disagreed with each other (`#dead` came back `running` three times and
    // `finished` once).
    //
    // `computeSettleMs` computes `delay + duration x iterations` — a duration
    // measured from the animation's own start, i.e. from load. Feeding it a set
    // filtered by "is it still moving right now" mixed two different clocks.
    // From-load is also the number a caller can use: a VRT harness waits from
    // load, never from an arbitrary instant in the middle of one.
    const selfDriven = timings.filter((t) => t.playState !== "paused" && t.playState !== "idle");
    const settleMs = computeSettleMs(selfDriven);
    const infinite = selfDriven
      .filter((t) => t.iterations === null)
      .map((t) => ({ selector: t.selector, name: t.name }));

    const seek = async (index: number, timeMs: number) => {
      await page.evaluate(
        ([i, t]) => {
          const anim = (window as unknown as { __vlmkitAnims?: Animation[] }).__vlmkitAnims?.[i as number];
          if (anim) anim.currentTime = t as number;
        },
        [index, timeMs] as const,
      );
    };

    const framePaths: string[] = [];
    if (options.framesDir) await mkdir(options.framesDir, { recursive: true });
    const shot = async (label: string): Promise<RgbaFrame> => {
      const buffer = await page.screenshot({ animations: "allow" });
      if (options.framesDir) {
        const path = join(options.framesDir, `${label}.png`);
        await writeFile(path, buffer);
        framePaths.push(path);
      }
      return pngFromBuffer(buffer);
    };

    // Rest pose as the shared baseline: running finite animations seeked past
    // their end (their settled appearance — fill:none falls back to natural
    // style, fill:forwards keeps the last keyframe), running infinite ones
    // held at 0, page-paused/finished ones left at their author-chosen time.
    // Seeking everything to 0 instead would put entrance animations at their
    // *start* keyframe (often `opacity: 0`), hiding descendant animations
    // under evaluation behind a transparent ancestor.
    for (const t of timings) if (t.index >= 0) await seek(t.index, restTimeForAnimation(t));
    // `index >= 0`: a recorded-but-removed animation has no object to seek, so it
    // cannot be frame-sampled. The formatter already prints
    // `animations: N (evaluated M, ...)`, so the difference stays visible rather
    // than reading as if every animation had been checked.
    //
    // Known limitation, and the honest bound on this fix: which animations are
    // still live at this instant is timing-dependent, so `evaluated` — and with it
    // `no-visible-effect` — varies run to run on a page of short `fill: none`
    // animations (dashboard.html reports `evaluated 0` or `1` across runs while
    // `animationCount` now stays at 4). Everything derived from declared timing is
    // stable; only the pixel-sampled half is not. Making that half deterministic
    // means holding animations at their start instead of merely recording them,
    // which would erase the author-vs-us distinction in `playState` that
    // `restTimeForAnimation` depends on — a redesign, not a filter change.
    const evaluable = timings.filter((t) => t.index >= 0 && t.durationMs > 0).slice(0, maxAnimations);

    // Two back-to-back rest captures with nothing seeked in between: the
    // second becomes the evaluation baseline, and their delta exposes motion
    // sources the WAAPI cannot hold still — rAF/JS-driven animations, video,
    // GIFs. Those keep moving through every sampled frame, so they both
    // contaminate per-animation deltas and defeat VRT determinism, even on
    // pages that declare no CSS/WAAPI animation at all.
    const restProbe = await shot("rest");
    const baseline = await shot("rest-recheck");
    const restDelta = frameDelta(restProbe, baseline, tolerance);
    const uncontrolledMotion = restDelta.changedPixels >= minChangedPixels ? restDelta : undefined;

    const evaluated: EvaluatedAnimation[] = [];
    // Grouped per animation, not one flat list: each row is cropped to its own
    // motion bbox below, and composing needs the rows still separable.
    const stripRows: RgbaFrame[][] = [];
    for (const timing of evaluable) {
      const frames: AnimationFrameStat[] = [];
      const rowFrames: RgbaFrame[] = [];
      let previous = baseline;
      let motionBbox: EvaluatedAnimation["motionBbox"] = null;
      let totalChangedPixels = 0;
      let maxFrameRatio = 0;
      for (let s = 1; s <= samples; s++) {
        const fraction = s / samples;
        // Stay 1ms inside the iteration end: seeking exactly to the end
        // finishes the animation and (fill: none) snaps the start state.
        const timeMs = timing.delayMs + Math.min(timing.durationMs * fraction, timing.durationMs - 1);
        await seek(timing.index, Math.max(timing.delayMs, timeMs));
        const frame = await shot(`anim-${timing.index}-${Math.round(fraction * 100)}`);
        if (options.stripPath) rowFrames.push(frame);
        const delta = frameDelta(previous, frame, tolerance);
        frames.push({ fraction, ...delta });
        motionBbox = unionBbox(motionBbox, delta.bbox);
        totalChangedPixels += delta.changedPixels;
        maxFrameRatio = Math.max(maxFrameRatio, delta.ratio);
        previous = frame;
      }
      await seek(timing.index, restTimeForAnimation(timing));
      if (options.stripPath && rowFrames.length > 0) stripRows.push(rowFrames);
      evaluated.push({
        ...timing,
        frames,
        visible: frames.some((f) => f.changedPixels >= minChangedPixels),
        motionBbox,
        totalChangedPixels,
        maxFrameRatio: Number(maxFrameRatio.toFixed(4)),
      });
    }
    let strip: AnimationEvalReport["strip"];
    if (options.stripPath && evaluated.some((a) => a.motionBbox)) {
      // The strip is sampled on ONE shared clock, unlike the per-animation
      // evaluation above. That is not a detail — a dogfood agent asked to show a
      // reviewer the card entrance wrote:
      //
      //   "each row is sampled over its *own* 0->1 progress and cropped to its own
      //    element, so the 0/60/120ms stagger is invisible and the image reads as
      //    'all three cards animate simultaneously' — wrong on exactly the property
      //    under review."
      //
      // Per-animation progress is the right axis for "does this animation move
      // pixels", which is what `evaluated` answers. It is the wrong axis for "what
      // does this look like over time", which is what an image for a reviewer is
      // for. So: pick sample instants on the page's own timeline, seek EVERY
      // animation to each instant, and take one screenshot per column.
      //
      // Cheaper too: `samples` screenshots instead of `samples x animations`.
      // Scoped rows, because a sheet made for a reviewer should hold the thing under
      // review. The same agent: "No flag to scope the strip to one animation or
      // selector. I expected `--selector .card` or `--only`; neither exists. So row 4
      // is six 34px spinners plus a ~90px dead grey band [...] ~20% of the sheet is
      // noise." `--max-animations` is not the answer and they said why: it truncates
      // in document order, which on that page starts with a dead `h1` keyframe.
      const wanted = options.stripSelector;
      // Matched in the page against each animation's own effect target, not against
      // the reported selector string: `stableSelector` emits whatever is unique
      // (`article:nth-of-type(1)` for one card, `article.card.card--featured` for
      // another), so string matching would hit some rows and miss their siblings.
      const matched = wanted === undefined ? null : new Set(await page.evaluate((selector) => {
        const anims = (window as unknown as { __vlmkitAnims?: Animation[] }).__vlmkitAnims ?? [];
        const hits: number[] = [];
        anims.forEach((anim, index) => {
          const target = (anim.effect as KeyframeEffect | null)?.target as Element | null;
          if (target && target.matches(selector)) hits.push(index);
        });
        return hits;
      }, wanted));
      const rows = evaluated.filter((a) => a.motionBbox && (matched === null || matched.has(a.index)));
      if (matched !== null && rows.length === 0) {
        throw new UsageError(
          `--strip-selector \`${wanted}\` matched no animated element.`
          + ` Animated elements on this page: ${evaluated.map((a) => a.selector).join(", ")}`,
        );
      }
      // When anything finite runs, the window is when the last of those ends — not
      // one iteration of the slowest animation on the page.
      //
      // "One iteration of the slowest" was the first attempt, and a dogfood agent
      // showed it picks the wrong clock in the ordinary case: "the default
      // `--strip-window` is actively misleading here. 'One iteration of the slowest
      // animation' picks the *infinite spinner*, so the default sheet spends 75% of
      // its columns on a settled page." Measured on that fixture: the infinite
      // spinner is 900ms while every finite animation ends by 400ms, so five of six
      // columns showed a page that had stopped moving.
      //
      // A permanent animation has no interesting instant, so it does not get to set
      // the timebase for the entrance animations someone is reviewing. Only when
      // *everything* is infinite does one iteration of the longest become the window,
      // because then there is nothing else to go on.
      // Over `rows`, not `evaluated`: the window has to be about the animations the
      // sheet actually shows. v2 fixed an infinite animation setting the timebase; v3
      // found the same mistake one level in — a *dead* finite animation still setting
      // it. The gate printed "h1 `bump` (400ms) produced no visible pixel change" and
      // then used that 400ms as the window, while the three rows it drew ended at 250,
      // 310 and 370ms, so the last column was a duplicate of the settled state and the
      // agent computed 370 out of the CSS by hand: "Window = when the last *selected,
      // visible* animation ends is information it has and did not use."
      const finiteEnds = rows
        .filter((a) => a.iterations !== null)
        .map((a) => a.delayMs + a.durationMs * (a.iterations ?? 1));
      const windowMs = options.stripWindowMs
        ?? (finiteEnds.length > 0
          ? Math.max(1, ...finiteEnds)
          : Math.max(1, ...rows.map((a) => a.delayMs + a.durationMs)));
      const times = Array.from({ length: samples }, (_, i) => Math.round((windowMs * (i + 1)) / samples));

      const PAD = 8;
      const columns: RgbaFrame[] = [];
      for (const timeMs of times) {
        // Every animation to the same instant. Clamped 1ms inside its own end so a
        // `fill: none` animation does not snap back to its start keyframe, and left
        // at its delay while it has not begun — which is what makes the stagger show.
        for (const anim of evaluated) {
          if (anim.index < 0) continue;
          const end = anim.iterations === null
            ? timeMs
            : Math.min(timeMs, anim.delayMs + anim.durationMs * anim.iterations - 1);
          await seek(anim.index, Math.max(anim.delayMs, end));
        }
        columns.push(await shot(`t-${timeMs}ms`));
      }

      // Crop each row out of those shared frames. Every cell in a row shares ONE
      // rect: cropping per cell would re-centre the element and subtract the motion
      // the row exists to show, the same reason `composeFilmstrip` aligns top-left.
      // Row-major, so `columns: samples` puts one animation per row.
      const cells = rows.flatMap((anim) => {
        const bbox = anim.motionBbox!;
        return columns.map((frame) => cropRegion(
          frame,
          Math.max(0, bbox.x - PAD),
          Math.max(0, bbox.y - PAD),
          bbox.width + PAD * 2,
          bbox.height + PAD * 2,
        ));
      });

      // Labels in the image, because the terminal does not travel with it. v1 found
      // this ("no labels at all — no row selector, no time per cell; that data is
      // terminal-only") and v4's evidence agent named it the one thing left to change:
      // "this artifact is *not* a baseline — it is an attachment whose whole job is to
      // be read by a human out of context." Column labels are the shared-clock times,
      // which is the axis the whole sheet is read along.
      const sheet = composeFilmstrip(cells, {
        columns: samples,
        maxWidth: options.stripMaxWidth ?? 1600,
        columnLabels: times.map((t) => `${t}ms`),
        rowLabels: rows.map((anim) => `${anim.selector} ${anim.name}`),
      });
      await mkdir(dirname(resolve(options.stripPath)), { recursive: true });
      // `--strip strip.webp` encodes WebP; the extension is the whole switch.
      if (imageFormatForPath(options.stripPath) === "webp") {
        await writeFile(resolve(options.stripPath), await encodeWebp(sheet));
      } else {
        await encodePng(resolve(options.stripPath), sheet);
      }
      strip = {
        path: resolve(options.stripPath),
        columns: sheet.layout.columns,
        rows: sheet.layout.rows,
        // Counted by reason, not lumped together. `omitted: evaluated.length -
        // rows.length` called a row dropped by `--strip-selector` a no-visible-effect,
        // which is a false statement of the same kind this whole line exists to avoid.
        omitted: evaluated.filter((a) => !a.motionBbox
          && (matched === null || matched.has(a.index))).length,
        outOfScope: matched === null ? 0 : evaluated.filter((a) => !matched.has(a.index)).length,
        windowMs,
        times,
        rowSelectors: rows.map((a) => a.selector),
        width: sheet.width,
        height: sheet.height,
      };
    }

    await page.close();

    // Behavioral reduced-motion pass: emulate and re-render, then count the
    // animations that still run with a non-trivial duration. Duration-zero
    // tricks (`animation-duration: 0.01ms`) count as honored.
    let reducedMotion: AnimationEvalReport["reducedMotion"];
    if (!options.skipReducedMotion && timings.length > 0) {
      const durationFloor = options.reducedMotionDurationFloorMs ?? 100;
      const rmPage = await browser.newPage({ viewport });
      await rmPage.emulateMedia({ reducedMotion: "reduce" });
      await loadPage(rmPage);
      const rmTimings = await collectAnimations(rmPage);
      await rmPage.close();
      // Not `playState === "running"`. The question here is not "is it moving at
      // this instant" but "did this page run motion for someone who asked for
      // none", and an animation that has already finished ran. Requiring
      // `running` made this — the gate's most consequential finding — blind to
      // every animation shorter than the page-load settle, which is to say blind
      // to entrance animations, the most common kind. Measured before the fix, on
      // a page with one `slide` animation and no `prefers-reduced-motion` rule
      // anywhere:
      //
      //   150ms / 200ms / 400ms  ->  exit 0, "No animation issues detected"
      //   800ms and above        ->  exit 1, reduced-motion-ignored
      //
      // The cutoff is not a threshold anyone chose; it is the ~765ms the collector
      // happens to run at. The 200ms animation still reported `durationMs: 200`
      // and `currentTime: 200` under emulation — the page plainly ignored the
      // preference and the evidence was in hand when it was discarded.
      const remaining = rmTimings
        .filter((t) => t.playState !== "paused" && t.playState !== "idle" && t.durationMs >= durationFloor)
        .map((t) => ({ selector: t.selector, name: t.name, durationMs: t.durationMs }));
      reducedMotion = { remainingCount: remaining.length, remaining };
    }

    const issues = deriveAnimationIssues(
      {
        evaluated,
        settleMs,
        infinite,
        ...(reducedMotion ? { reducedMotion } : {}),
        ...(uncontrolledMotion ? { uncontrolledMotion } : {}),
      },
      {
        settleThresholdMs: options.settleThresholdMs,
        reducedMotionDurationFloorMs: options.reducedMotionDurationFloorMs,
      },
    );

    return {
      source: options.source,
      viewport,
      animationCount: timings.length,
      evaluated,
      settleMs,
      infinite,
      ...(reducedMotion ? { reducedMotion } : {}),
      ...(uncontrolledMotion ? { uncontrolledMotion } : {}),
      issues,
      ...(framePaths.length > 0 ? { framePaths } : {}),
      ...(strip ? { strip } : {}),
    };
  });
}

export function formatAnimationEvalReport(report: AnimationEvalReport): string {
  const lines: string[] = [];
  const status = report.issues.some((issue) => issue.severity === "suspect") ? "suspect"
    : report.issues.length > 0 ? "warn"
    : "ok";
  lines.push(`${BOLD}${CYAN}vlmkit check animation${RESET}`);
  lines.push(`${DIM}source: ${report.source} (${report.viewport.width}x${report.viewport.height})${RESET}`);
  lines.push("");
  lines.push(`status: ${status}`);
  lines.push(`animations: ${report.animationCount} (evaluated ${report.evaluated.length}, infinite ${report.infinite.length})`);
  // The status block reads like the most important part of the output, so a line in
  // it that carries no rule id sends the reader hunting. A dogfood agent: "`settle:
  // never` and `reduced-motion: …` are status lines, not findings. They read like the
  // most important facts in the output but carry no rule id, no severity, and no
  // remedy of their own. I had to scroll to the `Issues:` block and re-derive which
  // status line mapped to which rule." Each line now names the rule that carries it —
  // and says so explicitly when nothing does, which is the `settle: never` case
  // (`long-settle` compares a number, and there is no number when it is infinite).
  const firedKinds = new Set(report.issues.map((issue) => issue.kind));
  const ruleTag = (kind: AnimationEvalIssueKind) => firedKinds.has(kind) ? ` ${DIM}[${kind}]${RESET}` : "";
  if (report.settleMs === null) {
    lines.push(
      `settle: never (infinite animation)`
      + (firedKinds.has("infinite-animation")
        ? ` ${DIM}[infinite-animation]${RESET}`
        : ` ${DIM}(no rule covers this — \`long-settle\` needs a settle time to compare)${RESET}`),
    );
  } else {
    lines.push(`settle: ${Math.round(report.settleMs)}ms${ruleTag("long-settle")}`);
  }
  if (report.reducedMotion) {
    lines.push(
      report.reducedMotion.remainingCount === 0
        ? `reduced-motion: honored`
        : `reduced-motion: ${report.reducedMotion.remainingCount} animation(s) still running${ruleTag("reduced-motion-ignored")}`,
    );
  }
  if (report.uncontrolledMotion) {
    const m = report.uncontrolledMotion;
    const where = m.bbox ? ` at (${m.bbox.x},${m.bbox.y}) ${m.bbox.width}x${m.bbox.height}` : "";
    lines.push(`uncontrolled motion: ${m.changedPixels}px${where} (rAF / video / GIF — frame deltas may be contaminated)${ruleTag("uncontrolled-motion")}`);
  }
  if (report.evaluated.length > 0) {
    lines.push("");
    lines.push("Evaluated animations:");
    for (const anim of report.evaluated) {
      const bbox = anim.motionBbox
        ? `(${anim.motionBbox.x},${anim.motionBbox.y}) ${anim.motionBbox.width}x${anim.motionBbox.height}`
        : "none";
      const visibility = anim.visible ? `${GREEN}visible${RESET}` : `${RED}no visible effect${RESET}`;
      const osc = computeOscillation(anim);
      // The leg annotation is what makes "1.2s per leg" briefs mechanically
      // checkable — duration alone hides a 2x frequency difference between
      // `alternate` and palindromic-keyframe implementations.
      const oscLabel = osc.oscillating
        ? ` (${anim.direction.startsWith("alternate") ? anim.direction : "palindromic keyframes"}, leg ${Math.round(osc.legMs)}ms)`
        : "";
      lines.push(
        `  - ${anim.selector} \`${anim.name}\` ${Math.round(anim.durationMs)}ms x${anim.iterations ?? "∞"}${oscLabel}: ${visibility}, motion region ${bbox}, peak frame delta ${(anim.maxFrameRatio * 100).toFixed(2)}%`,
      );
    }
  }
  if (report.issues.length > 0) {
    lines.push("");
    lines.push("Issues:");
    for (const issue of report.issues) {
      const icon = issue.severity === "suspect" ? `${RED}x${RESET}` : `${YELLOW}!${RESET}`;
      const selector = issue.selector ? ` ${issue.selector}` : "";
      lines.push(`  ${icon} ${issue.kind}${selector}: ${issue.message}`);
    }
  } else {
    lines.push("");
    lines.push(`${GREEN}No animation issues detected.${RESET}`);
  }
  if (report.framePaths && report.framePaths.length > 0) {
    lines.push("");
    lines.push(`Frames: ${report.framePaths.length} written`);
  }
  if (report.strip) {
    const s = report.strip;
    lines.push("");
    // The column count is the reading instruction: without it a 3x4 sheet could
    // be four animations of three samples just as easily as three of four.
    // The omission is named, not silent: a dogfood agent got a strip of 1 animation
    // out of 5 with "no finding, no warning, no hint" and called that the real bug.
    lines.push(
      `Strip: ${s.path} (${s.width}x${s.height}, ${s.rows} animation(s) x ${s.columns} sample(s)`
      + `${s.omitted > 0 ? `; ${s.omitted} omitted as no-visible-effect` : ""}`
      + `${s.outOfScope > 0 ? `; ${s.outOfScope} outside --strip-selector` : ""})`,
    );
    // A caption, because the image carries no text and the same agent said so:
    // "no labels at all — no row selector, no time per cell; that data is
    // terminal-only." Labels are not drawn into the sheet on purpose — that would
    // make the output depend on font rendering, which is the class of
    // platform-dependent pixel this toolkit exists to catch. So it is emitted in the
    // form a reviewer actually needs it: next to the image, ready to paste.
    lines.push(`${DIM}  caption: columns are ${s.times.map((ms) => `${ms}ms`).join(" / ")}`
      + ` on the page timeline (window ${s.windowMs}ms, one shared clock);`
      + ` rows top to bottom are ${s.rowSelectors.join(", ")}${RESET}`);
  }
  return lines.join("\n");
}

/**
 * CLI entry removed: this module is measurement code now, not a command.
 * `check animation` is declared in `../gates/animation.gate.ts` and driven by the core runner
 * (`@mizchi/vlmkit-core/plugin/runner.ts`), which owns argument parsing,
 * `--json`, `--advisory`, the run ledger and the exit code.
 */
