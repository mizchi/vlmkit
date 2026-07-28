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
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PNG } from "pngjs";
import { handleCliError } from "@mizchi/vlmkit-core/cli-error.ts";
import { BOLD, CYAN, DIM, GREEN, RED, RESET, YELLOW } from "@mizchi/vlmkit-core/terminal-colors.ts";

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
}

export interface AnimationEvalOptions {
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
  options: { settleThresholdMs?: number } = {},
): AnimationEvalIssue[] {
  const settleThreshold = options.settleThresholdMs ?? 3000;
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
      message: `${anim.selector} animation \`${anim.name}\` runs forever — the page never settles. For VRT capture, mask it (\`--mask "${anim.selector}"\`) or pause animations before screenshots.`,
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
      message: `${input.reducedMotion.remainingCount} animation(s) still run under \`prefers-reduced-motion: reduce\` emulation` +
        (sample ? ` (e.g. ${sample.selector} \`${sample.name}\` ${sample.durationMs}ms)` : "") +
        " — motion is not reduced for users who requested it.",
    });
  }

  return issues;
}

const COLLECT_ANIMATIONS_SCRIPT = `(() => {
  function stableSelector(el) {
    if (!el || !el.tagName) return "(no target)";
    const id = el.getAttribute && el.getAttribute("id");
    if (id) return "#" + CSS.escape(id);
    const classes = el.classList ? Array.from(el.classList).slice(0, 3) : [];
    if (classes.length > 0) {
      const selector = el.tagName.toLowerCase() + classes.map((c) => "." + CSS.escape(c)).join("");
      if (document.querySelectorAll(selector).length === 1) return selector;
    }
    const parent = el.parentElement;
    if (!parent) return el.tagName.toLowerCase();
    const siblings = Array.from(parent.children).filter((item) => item.tagName === el.tagName);
    return el.tagName.toLowerCase() + ":nth-of-type(" + (siblings.indexOf(el) + 1) + ")";
  }

  const anims = document.getAnimations ? document.getAnimations({ subtree: true }) : [];
  window.__vlmkitAnims = anims;
  return anims.map((anim, index) => {
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
    // Palindrome detection: the first and last keyframes agree on every
    // animated property while some keyframe in between differs — one
    // iteration visually sweeps out and back (same effective motion as
    // alternate, at twice the frequency).
    let palindromic = false;
    try {
      const keyframes = anim.effect && anim.effect.getKeyframes ? anim.effect.getKeyframes() : [];
      if (keyframes.length >= 3) {
        const skip = new Set(["offset", "computedOffset", "easing", "composite"]);
        const first = keyframes[0];
        const last = keyframes[keyframes.length - 1];
        const props = Object.keys(first).filter((k) => !skip.has(k));
        palindromic = props.length > 0
          && props.every((k) => k in last && String(first[k]) === String(last[k]))
          && keyframes.slice(1, -1).some((mid) =>
            props.some((k) => k in mid && String(mid[k]) !== String(first[k]))
          );
      }
    } catch {}
    const ctor = anim.constructor ? anim.constructor.name : "";
    const type = ctor === "CSSAnimation" ? "css-animation" : ctor === "CSSTransition" ? "css-transition" : "waapi";
    const name = anim.animationName || anim.transitionProperty || anim.id || "(anonymous)";
    const target = anim.effect && anim.effect.target ? anim.effect.target : null;
    // Record the author-visible state BEFORE pausing for evaluation — an
    // animation the page itself holds paused is visually static and must
    // not be reported as running/never-settling.
    const playState = anim.playState;
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
  const loadPage = async (p: import("playwright").Page) => {
    if (options.html !== undefined) {
      await p.setContent(options.html, { waitUntil: "networkidle" });
    } else {
      await p.goto(pageUrl!, { waitUntil: "networkidle", timeout: 30000 });
    }
  };

  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport });
    await loadPage(page);

    const timings = await page.evaluate(COLLECT_ANIMATIONS_SCRIPT) as AnimationTimingSample[];
    // Settle / never-settles are about motion the page performs on its own:
    // animations the page itself holds paused (or already finished) are
    // visually static and must not count.
    const runningTimings = timings.filter((t) => t.playState === "running");
    const settleMs = computeSettleMs(runningTimings);
    const infinite = runningTimings
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
    for (const t of timings) await seek(t.index, restTimeForAnimation(t));
    const evaluable = timings.filter((t) => t.durationMs > 0).slice(0, maxAnimations);

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
    for (const timing of evaluable) {
      const frames: AnimationFrameStat[] = [];
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
        const delta = frameDelta(previous, frame, tolerance);
        frames.push({ fraction, ...delta });
        motionBbox = unionBbox(motionBbox, delta.bbox);
        totalChangedPixels += delta.changedPixels;
        maxFrameRatio = Math.max(maxFrameRatio, delta.ratio);
        previous = frame;
      }
      await seek(timing.index, restTimeForAnimation(timing));
      evaluated.push({
        ...timing,
        frames,
        visible: frames.some((f) => f.changedPixels >= minChangedPixels),
        motionBbox,
        totalChangedPixels,
        maxFrameRatio: Number(maxFrameRatio.toFixed(4)),
      });
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
      const rmTimings = await rmPage.evaluate(COLLECT_ANIMATIONS_SCRIPT) as AnimationTimingSample[];
      await rmPage.close();
      const remaining = rmTimings
        .filter((t) => t.playState === "running" && t.durationMs >= durationFloor)
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
      { settleThresholdMs: options.settleThresholdMs },
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
    };
  } finally {
    await browser.close();
  }
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
  lines.push(`settle: ${report.settleMs === null ? "never (infinite animation)" : `${Math.round(report.settleMs)}ms`}`);
  if (report.reducedMotion) {
    lines.push(`reduced-motion: ${report.reducedMotion.remainingCount === 0 ? "honored" : `${report.reducedMotion.remainingCount} animation(s) still running`}`);
  }
  if (report.uncontrolledMotion) {
    const m = report.uncontrolledMotion;
    const where = m.bbox ? ` at (${m.bbox.x},${m.bbox.y}) ${m.bbox.width}x${m.bbox.height}` : "";
    lines.push(`uncontrolled motion: ${m.changedPixels}px${where} (rAF / video / GIF — frame deltas may be contaminated)`);
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
  return lines.join("\n");
}

function printUsage(exitCode: number): never {
  console.log(`Usage: vlmkit check animation <html-or-url> [options]

Frame-sampled animation evaluation: pause every animation, seek through
deterministic sample points, and verify each one visibly moves pixels,
when the page settles, and whether prefers-reduced-motion is honored.

Options:
  --json                    Print JSON report
  --viewport <WxH>          Viewport (default: 1280x720)
  --samples <n>             Sample points per animation (default: 4)
  --max-animations <n>      Max animations to frame-evaluate (default: 8)
  --frames <dir>            Write each sampled frame PNG into <dir>
  --settle-threshold <ms>   long-settle threshold (default: 3000)
  --skip-reduced-motion     Skip the reduced-motion emulation pass
  --fail-on-suspect         Exit non-zero when suspect issues are found`);
  process.exit(exitCode);
}

function parseArgs(argv: string[]) {
  let json = false;
  let failOnSuspect = false;
  let skipReducedMotion = false;
  let samples: number | undefined;
  let maxAnimations: number | undefined;
  let settleThresholdMs: number | undefined;
  let framesDir: string | undefined;
  let viewport: { width: number; height: number } | undefined;
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--help" || arg === "-h" || arg === "help") printUsage(0);
    else if (arg === "--json") json = true;
    else if (arg === "--fail-on-suspect") failOnSuspect = true;
    else if (arg === "--skip-reduced-motion") skipReducedMotion = true;
    else if (arg === "--samples") samples = Number.parseInt(argv[++i] ?? "4", 10);
    else if (arg === "--max-animations") maxAnimations = Number.parseInt(argv[++i] ?? "8", 10);
    else if (arg === "--settle-threshold") settleThresholdMs = Number.parseInt(argv[++i] ?? "3000", 10);
    else if (arg === "--frames") framesDir = argv[++i];
    else if (arg === "--viewport") {
      const m = (argv[++i] ?? "").match(/^(\d+)x(\d+)$/);
      if (!m) printUsage(1);
      viewport = { width: Number(m[1]), height: Number(m[2]) };
    } else positional.push(arg);
  }
  if (positional.length === 0) printUsage(1);
  return {
    source: positional[0]!,
    json,
    failOnSuspect,
    skipReducedMotion,
    samples,
    maxAnimations,
    settleThresholdMs,
    framesDir,
    viewport,
  };
}

async function main(argv = process.argv.slice(2)): Promise<void> {
  const parsed = parseArgs(argv);
  const report = await runAnimationEval({
    source: parsed.source,
    skipReducedMotion: parsed.skipReducedMotion,
    ...(parsed.samples !== undefined ? { samples: parsed.samples } : {}),
    ...(parsed.maxAnimations !== undefined ? { maxAnimations: parsed.maxAnimations } : {}),
    ...(parsed.settleThresholdMs !== undefined ? { settleThresholdMs: parsed.settleThresholdMs } : {}),
    ...(parsed.framesDir ? { framesDir: parsed.framesDir } : {}),
    ...(parsed.viewport ? { viewport: parsed.viewport } : {}),
  });
  if (parsed.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatAnimationEvalReport(report));
  }
  if (parsed.failOnSuspect && report.issues.some((issue) => issue.severity === "suspect")) {
    process.exit(1);
  }
}

const isCliEntry = process.env.__VRT_DISPATCHER_LEAF__ === "animation-eval" ||
  (process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false);
if (isCliEntry) {
  main().catch(handleCliError);
}
