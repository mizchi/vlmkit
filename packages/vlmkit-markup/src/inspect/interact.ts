#!/usr/bin/env node
/**
 * Interaction-sequence VRT.
 *
 * Beyond `:hover` and `:focus-visible` (covered by `vrt
 * component-from-image --states`), real UI bugs hide behind scripted
 * sequences: open a dropdown, fill a form, scroll a page, click
 * through a multi-step flow. This tool drives an HTML through a
 * declarative sequence of Playwright actions, captures named
 * snapshots between steps, and pixel-diffs each transition.
 *
 * The agent declares the sequence in JSON:
 *
 *   {
 *     "viewport": { "width": 1280, "height": 720 },
 *     "steps": [
 *       { "action": "snapshot", "name": "default" },
 *       { "action": "click", "selector": ".dropdown-trigger" },
 *       { "action": "snapshot", "name": "menu-open" },
 *       { "action": "type", "selector": "input[name=email]",
 *         "text": "test@example.com" },
 *       { "action": "snapshot", "name": "filled" }
 *     ]
 *   }
 *
 * Outputs:
 *   - One PNG per named snapshot
 *   - Pixel diff between consecutive snapshots ("how much did this
 *     step change?") + heatmap region clusters on each transition
 *   - A markdown report showing the sequence + delta table
 *
 * Motion: a snapshot is a page at rest, so every transition and animation is
 * switched off — unless the sequence has a `frames` step, which records the
 * motion the action right before it started:
 *
 *   { "action": "press", "key": "Escape" },
 *   { "action": "frames", "name": "drawer-close", "everyMs": 50, "forMs": 400 }
 *
 * writes `<output-dir>/drawer-close/0000-t000000.png … 0008-t000400.png` and a
 * `frames.json` (`vlmkit-frames/1`). With a `frames` step the page keeps its
 * motion and it runs as it would for a user (`INTERACTION_HOLD_SCRIPT`): a
 * snapshot first finishes every running animation — `finish()`, so `finished`
 * promises, end events and what the page chains from them all run — and pauses
 * an infinite one at 0. Only the action right before a `frames` step is held:
 * every animation it starts is paused as it begins and seeked to each offset,
 * and finished the same way afterwards. CSS and Web Animations are therefore
 * exact at every offset; anything a script moves runs on the real clock and is
 * wherever it was when the frame was shot (`shotMs`).
 *
 * Usage:
 *   vlmkit inspect interact <html-or-url> --sequence <path-to-sequence.json>
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { type Page } from "playwright";
import { isCliEntry } from "@mizchi/vlmkit-core/plugin/cli-entry.ts";
import { compareScreenshots } from "@mizchi/vlmkit-core/heatmap.ts";
import { findHeatmapRegionsFromFile, type HeatmapRegion } from "@mizchi/vlmkit-core/heatmap-regions.ts";
import { annotateHeatmapRegionKinds } from "../heatmap-region-kinds.ts";
import { healSelector } from "../heal/selector-heal.ts";
import type { VrtSnapshot } from "@mizchi/vlmkit-core/types.ts";
import { handleCliError } from "@mizchi/vlmkit-core/cli-error.ts";
import { DIM, RESET, GREEN, RED, YELLOW, BOLD, CYAN } from "@mizchi/vlmkit-core/terminal-colors.ts";
import { classifyHealTier } from "./selector-heal-calibration.ts";
import { withBrowser } from "@mizchi/vlmkit-core/browser-launch.ts";
import { UsageError } from "@mizchi/vlmkit-core/cli-error.ts";
import {
  captureStable,
  frameSourceFacts,
  frameWriter,
  type FramesWritten,
} from "@mizchi/vlmkit-animation-eval/frames-capture.ts";
import { formatInstant, MAX_FRAMES, parseInstants, type FramesSource } from "@mizchi/vlmkit-judge/frames.ts";

export type SequenceAction =
  | { action: "snapshot"; name: string }
  | { action: "click"; selector: string }
  | { action: "hover"; selector: string }
  | { action: "focus"; selector: string }
  | { action: "blur"; selector: string }
  | { action: "press"; selector?: string; key: string }
  | { action: "type"; selector: string; text: string }
  | { action: "fill"; selector: string; value: string }
  | { action: "select"; selector: string; value: string }
  | { action: "scroll"; selector?: string; x?: number; y?: number }
  | { action: "wait"; ms: number }
  | { action: "waitForSelector"; selector: string }
  | FramesAction;

/**
 * Record what the action right before it set moving: the page at each offset after the action
 * returned. `at` names the offsets (`"0..400/50"`, `[0, 100, 250]`;
 * ms, or `1.5s`, `6f`); otherwise every `everyMs` (default 50) over `forMs` (default 500).
 */
export interface FramesAction {
  action: "frames";
  name: string;
  at?: string | number[];
  everyMs?: number;
  forMs?: number;
}

export interface Sequence {
  viewport?: { width: number; height: number };
  steps: SequenceAction[];
}

export interface InteractOptions {
  source: string;
  sequencePath: string;
  outputDir: string;
  reportPath?: string;
  /** Pixel diff threshold. Default 0.03. */
  threshold?: number;
  /**
   * Run the healer probe on every step with a selector — not only on
   * failures. Catches the typo-matched-the-wrong-element case where a
   * step technically succeeds but acts on the wrong target. Adds one
   * healer DOM scan (~50-200ms) per selector step; expect a 1.5-3×
   * wall-time increase on selector-heavy sequences. Default off.
   */
  healAll?: boolean;
}

export interface SnapshotEntry {
  name: string;
  screenshotPath: string;
  /** Actions executed since the previous snapshot. */
  actionsBefore: SequenceAction[];
}

export interface TransitionDelta {
  from: string;
  to: string;
  actions: SequenceAction[];
  diffPixels: number;
  diffRatio: number;
  totalPixels: number;
  heatmapPath?: string;
  heatmapRegions: HeatmapRegion[];
}

/**
 * A "did you mean..." finding from --heal-all on a step that
 * technically succeeded. The originalSelector matched something, but
 * the healer found a higher-confidence sibling that may be what the
 * sequence author actually intended.
 */
export interface HealAllFinding {
  /** Step index in the sequence. */
  stepIndex: number;
  action: SequenceAction;
  originalSelector: string;
  /**
   * Confidence tier. "strong" (≥0.3) is the actionable case — the
   * sibling shares enough class-token signal that the typed selector
   * is likely the wrong one. "weak" (0.1-0.3) is informational only;
   * it's the typical sibling-button overlap that the dogfood
   * (2026-05-15) flagged as noise when labelled "did you mean".
   */
  tier: "strong" | "weak";
  suggestion: {
    selector: string;
    confidence: number;
    text: string;
  };
}

/**
 * A step that threw — a selector that matched nothing, a `select` with no such
 * option, a `waitForSelector` that timed out.
 *
 * These were printed to stdout and then dropped. Everything downstream saw only
 * the consequence: a transition with a near-zero delta, which the report's own
 * prose explains as "the actions had no visible effect — usually a sign the
 * selector didn't match". It had the reason and threw it away, so a `--json`
 * consumer or an agent reading the report could not tell a step that failed from
 * a step that legitimately changed nothing.
 */
export interface StepFailure {
  /** Index into `Sequence.steps`. */
  stepIndex: number;
  action: SequenceAction;
  /** First line of the thrown message; the stack is noise here. */
  message: string;
  /** Present when the failure looked like a selector miss and the healer ran. */
  suggestions?: Array<{ selector: string; confidence: number; text: string }>;
}

/** One `frames` step's sequence. */
export interface FrameSequenceEntry extends FramesWritten {
  name: string;
  stepIndex: number;
  /** ms after the recorded action returned. */
  offsets: number[];
  /** The action right before the step: the one whose motion the frames show. */
  action: SequenceAction;
}

export interface InteractReport {
  source: string;
  viewport: { width: number; height: number };
  /**
   * `disabled`: every transition and animation switched off (no `frames` step). `live`: the
   * page keeps its motion; a snapshot finishes what is running first, and a `frames` step holds
   * the animations its action starts.
   */
  motion: "disabled" | "live";
  snapshots: SnapshotEntry[];
  /** One per `frames` step, in sequence order. */
  frameSequences: FrameSequenceEntry[];
  transitions: TransitionDelta[];
  reportPath: string;
  healAllFindings?: HealAllFinding[];
  /** Steps that threw, in sequence order. Empty when every step ran. */
  stepFailures: StepFailure[];
}

function parseArgs(argv: string[]) {
  let sequence = "";
  let outputDir = "";
  let report = "";
  let threshold = 0.03;
  let healAll = false;
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--sequence") sequence = argv[++i];
    else if (a === "--output-dir") outputDir = argv[++i];
    else if (a === "--report") report = argv[++i];
    else if (a === "--threshold") threshold = parseFloat(argv[++i] ?? "0.03");
    else if (a === "--heal-all") healAll = true;
    else positional.push(a);
  }
  return { positional, sequence, outputDir, report, threshold, healAll };
}

function isUrl(s: string): boolean {
  return /^https?:\/\//.test(s);
}

function summarizeAction(a: SequenceAction): string {
  switch (a.action) {
    case "snapshot":
      return `snapshot "${a.name}"`;
    case "click":
      return `click \`${a.selector}\``;
    case "hover":
      return `hover \`${a.selector}\``;
    case "focus":
      return `focus \`${a.selector}\``;
    case "blur":
      return `blur \`${a.selector}\``;
    case "press":
      return a.selector ? `press "${a.key}" on \`${a.selector}\`` : `press "${a.key}"`;
    case "type":
      return `type "${a.text}" into \`${a.selector}\``;
    case "fill":
      return `fill \`${a.selector}\` = "${a.value}"`;
    case "select":
      return `select \`${a.selector}\` → "${a.value}"`;
    case "scroll":
      return a.selector
        ? `scroll \`${a.selector}\` to (${a.x ?? 0}, ${a.y ?? 0})`
        : `scroll window to (${a.x ?? 0}, ${a.y ?? 0})`;
    case "wait":
      return `wait ${a.ms}ms`;
    case "waitForSelector":
      return `waitFor \`${a.selector}\``;
    case "frames":
      return `frames "${a.name}"`;
  }
}

/**
 * The offsets a `frames` step asks for, checked before any browser starts. Throws a UsageError
 * naming the step.
 */
export function framesOffsets(step: FramesAction, stepIndex: number): number[] {
  const where = `step ${stepIndex} (frames "${step.name}")`;
  if (typeof step.name !== "string" || step.name.trim() === "") {
    throw new UsageError(
      `step ${stepIndex}: a frames step needs a "name" — its frames go in a directory of that name.`,
    );
  }
  if (step.at !== undefined) {
    if (step.everyMs !== undefined || step.forMs !== undefined) {
      throw new UsageError(`${where}: give "at" or "everyMs"/"forMs", not both.`);
    }
    const list = typeof step.at === "string" ? parseInstants(step.at, `${where} "at"`) : step.at;
    if (
      !Array.isArray(list) ||
      list.length === 0 ||
      list.some((t) => typeof t !== "number" || !Number.isFinite(t) || t < 0)
    ) {
      throw new UsageError(`${where}: "at" lists no offsets in ms, e.g. "0..400/50" or [0, 100, 250].`);
    }
    const offsets = [...new Set(list)].sort((a, b) => a - b);
    if (offsets.length > MAX_FRAMES) throw new UsageError(`${where}: more than ${MAX_FRAMES} offsets.`);
    return offsets;
  }
  const every = step.everyMs ?? 50;
  const span = step.forMs ?? 500;
  if (!(typeof every === "number" && every > 0) || !(typeof span === "number" && span >= 0)) {
    throw new UsageError(`${where}: "everyMs" must be > 0 and "forMs" >= 0.`);
  }
  return parseInstants(`0..${span}/${every}`, where);
}

async function executeStep(page: Page, step: SequenceAction): Promise<void> {
  switch (step.action) {
    case "snapshot":
      return; // handled by caller
    case "click":
      await page.click(step.selector, { timeout: 5000 });
      return;
    case "hover":
      await page.hover(step.selector, { timeout: 5000 });
      return;
    case "focus":
      await page.focus(step.selector, { timeout: 5000 });
      return;
    case "blur":
      await page
        .locator(step.selector)
        .first()
        .evaluate((el) => (el as HTMLElement).blur());
      return;
    case "press":
      if (step.selector) {
        await page.press(step.selector, step.key, { timeout: 5000 });
      } else {
        await page.keyboard.press(step.key);
      }
      return;
    case "type":
      await page.type(step.selector, step.text, { timeout: 5000 });
      return;
    case "fill":
      await page.fill(step.selector, step.value, { timeout: 5000 });
      return;
    case "select":
      await page.selectOption(step.selector, step.value, { timeout: 5000 });
      return;
    case "scroll":
      if (step.selector) {
        await page
          .locator(step.selector)
          .first()
          .evaluate(
            (el, pos) => {
              el.scrollTo(pos.x ?? 0, pos.y ?? 0);
            },
            { x: step.x ?? 0, y: step.y ?? 0 },
          );
      } else {
        await page.evaluate(
          (pos) => {
            window.scrollTo(pos.x ?? 0, pos.y ?? 0);
          },
          { x: step.x ?? 0, y: step.y ?? 0 },
        );
      }
      return;
    case "wait":
      await page.waitForTimeout(step.ms);
      return;
    case "waitForSelector":
      await page.waitForSelector(step.selector, { timeout: 5000 });
      return;
    case "frames":
      return; // handled by caller
  }
}

/**
 * The page side of motion when a sequence has `frames` steps: animations run on their own, a
 * snapshot finishes them, and while armed every animation that begins is paused and recorded.
 *
 * Not `HOLD_TIMELINE_SCRIPT`, which holds everything from document start for a page on the held
 * clock. Holding everything here froze a menu an earlier action opened, and the next click inside
 * it timed out; resting by setting `currentTime` left a Web Animation paused at its end, so its
 * `finished` promise never resolved and a dialog that closes on it stayed open.
 */
export const INTERACTION_HOLD_SCRIPT = `(() => {
  if (window.__vlmkitInteract) return;
  let armed = false;
  let windowId = 0;
  const entries = [];
  const heldIn = new WeakMap();
  const ours = new WeakSet();
  // Only an animation that is running: one the page paused (a play-on-class ring, a closed panel
  // held at 0) or cancelled is the page's state, not motion.
  const hold = (anim) => {
    if (!armed || !anim || heldIn.get(anim) === windowId || anim.playState !== "running") return;
    heldIn.set(anim, windowId);
    // When it really began: a CSS animation's animationstart fires after its delay, and its
    // currentTime counts the delay too.
    const current = typeof anim.currentTime === "number" ? anim.currentTime : 0;
    entries.push({ anim, startAt: performance.now() - current });
    ours.add(anim);
    try { anim.pause(); } catch {}
  };
  const onStart = (event) => {
    const target = event.target;
    if (target && target.getAnimations) for (const anim of target.getAnimations()) hold(anim);
  };
  document.addEventListener("animationstart", onStart, true);
  document.addEventListener("transitionrun", onStart, true);
  const nativeAnimate = Element.prototype.animate;
  Element.prototype.animate = function (...args) {
    const anim = nativeAnimate.apply(this, args);
    hold(anim);
    return anim;
  };
  // Also what no event announces: a CSS animation still in its delay, a replayed Animation.
  const sweep = () => {
    if (armed && document.getAnimations) for (const anim of document.getAnimations()) hold(anim);
  };
  window.__vlmkitInteract = {
    arm() { windowId++; entries.length = 0; armed = true; },
    disarm() { armed = false; },
    sweep,
    // Past its end an animation is finished, not paused there: what the page chains from
    // "finished" or an end event runs between frames, as it would for a user.
    seek(t, anchor) {
      sweep();
      for (const e of entries) {
        const state = e.anim.playState;
        if (state === "idle" || state === "finished") continue; // cancelled (a seek would revive it), or done
        const local = Math.max(0, t - Math.max(0, e.startAt - anchor));
        let end = Infinity;
        try { end = e.anim.effect ? e.anim.effect.getComputedTiming().endTime : Infinity; } catch {}
        try {
          if (Number.isFinite(end) && local >= end) { e.anim.finish(); ours.delete(e.anim); }
          else e.anim.currentTime = local;
        } catch {}
      }
    },
    // Every running animation, and every one this script paused: a finite one finished, which
    // resolves its promise and fires its end events; an infinite one paused at 0. Returns how
    // many it finished, so the caller can let what they chain begin and settle again.
    settle() {
      let finished = 0;
      for (const anim of document.getAnimations ? document.getAnimations() : []) {
        const state = anim.playState;
        if (state === "idle" || state === "finished") continue;
        if (state === "paused" && !ours.has(anim)) continue;
        let end = Infinity;
        try { end = anim.effect ? anim.effect.getComputedTiming().endTime : Infinity; } catch {}
        if (Number.isFinite(end) && anim.playbackRate !== 0) {
          try { anim.finish(); finished++; } catch {}
          ours.delete(anim);
        } else if (state !== "paused" || anim.currentTime !== 0) {
          try { anim.pause(); anim.currentTime = 0; ours.add(anim); } catch {}
        }
      }
      return finished;
    },
  };
})()`;

type InteractWindow = Window & {
  __vlmkitInteract?: {
    arm(): void;
    disarm(): void;
    sweep(): void;
    seek(t: number, anchor: number): void;
    settle(): number;
  };
};

/**
 * The script on the current document. It is also an init script, so a navigation brings it
 * along; a page loaded with `setContent` gets it here, and so does one the init script missed.
 */
async function ensureHold(page: Page): Promise<void> {
  if (!(await page.evaluate(() => Boolean((window as unknown as InteractWindow).__vlmkitInteract)))) {
    await page.evaluate(INTERACTION_HOLD_SCRIPT);
  }
}

/** Two rendering updates: end events dispatch, and what the page starts from them begins. */
const twoFrames = (page: Page) =>
  page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))));

/**
 * Finish what is running until nothing more starts: a stage the page begins on the previous
 * one's `animationend` is finished too, rather than caught at its first frame. Bounded.
 */
async function settleMotion(page: Page): Promise<void> {
  await ensureHold(page);
  for (let round = 0; round < 10; round++) {
    const finished = await page.evaluate(() => (window as unknown as InteractWindow).__vlmkitInteract!.settle());
    await twoFrames(page);
    if (finished === 0) return;
  }
}

/**
 * One `frames` step, after its action ran armed: the animations it started, at each offset.
 *
 * Offset 0 is two rendering updates after the action returned: an animation the action starts
 * begins in the update after it, which is also when its events fire. Every animation that has
 * begun by then is at 0 at offset 0; one a timer starts later sits at the real time it began.
 * Before each frame the page has lived at least that long, so a timer due by then has run.
 */
async function recordFrames(
  page: Page,
  options: { dir: string; offsets: readonly number[]; source: FramesSource },
): Promise<FramesWritten> {
  await ensureHold(page);
  const anchor = await page.evaluate(
    () =>
      new Promise<number>((done) =>
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            try {
              // Swept now, not at the first frame: a CSS animation in its delay has fired no
              // animationstart yet.
              (window as unknown as InteractWindow).__vlmkitInteract?.sweep();
            } finally {
              done(performance.now());
            }
          }),
        ),
      ),
  );
  const writer = await frameWriter(options.dir, options.source);
  const clock = () => page.evaluate((a) => performance.now() - a, anchor);
  for (const atMs of options.offsets) {
    const elapsed = await clock();
    if (elapsed < atMs) await page.waitForTimeout(Math.ceil(atMs - elapsed));
    await page.evaluate(([t, a]) => (window as unknown as InteractWindow).__vlmkitInteract?.seek(t, a), [
      atMs,
      anchor,
    ] as const);
    const { png, stable, at } = await captureStable(page, { clock });
    await writer.add(png, { atMs, stable, shotMs: Math.round(at ?? 0) });
  }
  return writer.finish();
}

export async function runInteract(options: InteractOptions): Promise<InteractReport> {
  const outputDir = resolve(options.outputDir);
  await mkdir(outputDir, { recursive: true });

  const sequenceText = await readFile(resolve(options.sequencePath), "utf-8");
  const sequence: Sequence = JSON.parse(sequenceText);
  const viewport = sequence.viewport ?? { width: 1280, height: 720 };
  const threshold = options.threshold ?? 0.03;

  // Sanity check: something to capture.
  const snapshotSteps = sequence.steps.filter((s) => s.action === "snapshot");
  const framesSteps = sequence.steps.flatMap((s, i) => (s.action === "frames" ? [{ step: s, index: i }] : []));
  if (snapshotSteps.length === 0 && framesSteps.length === 0) {
    throw new Error("Sequence must contain at least one `snapshot` or `frames` step.");
  }
  // Offsets, names and placement checked before the browser starts: a typo fails in milliseconds.
  const offsetsByStep = new Map(framesSteps.map(({ step, index }) => [index, framesOffsets(step, index)]));
  // Compared case-folded (a macOS volume is case-insensitive) and against everything else this
  // run writes into the output directory.
  const taken = new Set([
    "report.md",
    ...snapshotSteps.map((s) => `${(s as { name: string }).name.replace(/[^a-z0-9._-]+/gi, "_")}.png`.toLowerCase()),
  ]);
  for (const { step, index } of framesSteps) {
    const dirName = step.name.replace(/[^a-z0-9._-]+/gi, "_");
    if (!/[a-z0-9]/i.test(dirName)) {
      throw new UsageError(`step ${index}: frames name "${step.name}" names no directory; use letters or digits.`);
    }
    if (taken.has(dirName.toLowerCase())) {
      throw new UsageError(
        `step ${index}: frames "${step.name}" would write to "${dirName}/", which this run already uses.`,
      );
    }
    taken.add(dirName.toLowerCase());
    const before = sequence.steps[index - 1];
    if (!before || before.action === "snapshot" || before.action === "frames") {
      throw new UsageError(
        `step ${index}: a frames step records the action right before it, and step ${index - 1} is ${before ? `a ${before.action} step` : "nothing"}.`,
      );
    }
  }
  const motion = framesSteps.length > 0 ? "live" : "disabled";

  const snapshots: SnapshotEntry[] = [];
  const frameSequences: FrameSequenceEntry[] = [];
  const healAllFindings: HealAllFinding[] = [];
  const stepFailures: StepFailure[] = [];
  let pendingActions: SequenceAction[] = [];
  await withBrowser(async (browser) => {
    const page = await browser.newPage({ viewport });
    // Registered before the load so a navigation later in the sequence keeps it; `setContent`
    // runs no init script, so the first document gets it below.
    if (motion === "live") await page.addInitScript(INTERACTION_HOLD_SCRIPT);
    if (isUrl(options.source)) {
      await page.goto(options.source, { waitUntil: "networkidle", timeout: 30000 });
    } else {
      const html = await readFile(resolve(options.source), "utf-8");
      await page.setContent(html, { waitUntil: "networkidle" });
    }
    if (motion === "disabled") {
      await page.addStyleTag({
        content: `*, *::before, *::after { transition: none !important; animation: none !important; }`,
      });
    } else {
      await ensureHold(page);
    }
    const facts = motion === "live" ? await frameSourceFacts(page) : undefined;

    for (let stepIndex = 0; stepIndex < sequence.steps.length; stepIndex++) {
      const step = sequence.steps[stepIndex]!;
      if (step.action === "snapshot") {
        if (motion === "live") await settleMotion(page);
        const safeName = step.name.replace(/[^a-z0-9._-]+/gi, "_");
        const screenshotPath = join(outputDir, `${safeName}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: false });
        snapshots.push({
          name: step.name,
          screenshotPath,
          actionsBefore: pendingActions.slice(),
        });
        pendingActions = [];
      } else if (step.action === "frames") {
        const offsets = offsetsByStep.get(stepIndex)!;
        const written = await recordFrames(page, {
          dir: join(outputDir, step.name.replace(/[^a-z0-9._-]+/gi, "_")),
          offsets,
          source: {
            tool: "inspect interact",
            url: isUrl(options.source) ? options.source : resolve(options.source),
            viewport,
            ...facts!,
            clock: "wall",
            step: step.name,
          },
        });
        frameSequences.push({
          ...written,
          name: step.name,
          stepIndex,
          offsets,
          action: sequence.steps[stepIndex - 1]!,
        });
        // What the action started, finished like everything else; then nothing more is held.
        await settleMotion(page);
        await page.evaluate(() => (window as unknown as InteractWindow).__vlmkitInteract?.disarm());
      } else {
        // The action a frames step records: the page settled first, so the frames hold only
        // what this action starts, and every animation that begins from here is held.
        if (motion === "live" && sequence.steps[stepIndex + 1]?.action === "frames") {
          await settleMotion(page);
          await page.evaluate(() => (window as unknown as InteractWindow).__vlmkitInteract!.arm());
        }
        let stepFailed = false;
        try {
          await executeStep(page, step);
        } catch (error) {
          stepFailed = true;
          const msg = String(error instanceof Error ? error.message : error);
          const failure: StepFailure = {
            stepIndex,
            action: step,
            message: msg.split("\n")[0]!,
          };
          // Self-healing: when the failure is a selector miss, ask
          // the healer for plausible alternatives. From the
          // browser-harness pattern + WebMCP extract — tell the
          // agent what to fix, don't just fail silently.
          const failedSelector = (step as { selector?: string }).selector;
          const isSelectorMiss =
            failedSelector &&
            (/Timeout.*exceeded/i.test(msg) || /no element matched/i.test(msg) || /strict mode violation/i.test(msg));
          if (isSelectorMiss) {
            try {
              const candidates = await healSelector(page, failedSelector, { maxCandidates: 3 });
              if (candidates.length > 0) {
                failure.suggestions = candidates.map((c) => ({
                  selector: c.selector,
                  confidence: c.confidence,
                  text: c.text,
                }));
              }
            } catch {
              /* healer failure is non-fatal */
            }
          }
          stepFailures.push(failure);
        }
        // --heal-all: probe successful selector steps for higher-
        // confidence siblings. Catches the typo-but-still-matches case
        // (e.g. `.btn-primary` was typed when the prose meant
        // `.btn-secondary`) that the failure-only healer can't see.
        const successSelector = !stepFailed ? (step as { selector?: string }).selector : undefined;
        if (options.healAll && successSelector) {
          try {
            const candidates = await healSelector(page, successSelector, {
              maxCandidates: 1,
              exclude: successSelector,
            });
            // The corpus-calibrated strong tier is deliberately conservative:
            // a 30% suggestion selected the wrong sibling. See docs/knowledge.md.
            const top = candidates[0];
            if (top) {
              const tier = classifyHealTier(top.confidence);
              if (tier !== "none") {
                healAllFindings.push({
                  stepIndex,
                  action: step,
                  originalSelector: successSelector,
                  tier,
                  suggestion: { selector: top.selector, confidence: top.confidence, text: top.text },
                });
              }
            }
          } catch {
            /* healer failure is non-fatal */
          }
        }
        pendingActions.push(step);
      }
    }
    await page.close();
  });

  // Pixel-diff consecutive snapshots. Each transition surfaces the
  // delta induced by the actions between them.
  const transitions: TransitionDelta[] = [];
  for (let i = 1; i < snapshots.length; i++) {
    const prev = snapshots[i - 1]!;
    const cur = snapshots[i]!;
    const snap: VrtSnapshot = {
      testId: `transition-${i}`,
      testTitle: `${prev.name} → ${cur.name}`,
      projectName: "interact",
      screenshotPath: cur.screenshotPath,
      baselinePath: prev.screenshotPath,
      status: "changed",
    };
    const diff = await compareScreenshots(snap, { outputDir, threshold });
    const heatmapPath = join(outputDir, `transition-${i}_heatmap.png`);
    let heatmapRegions: HeatmapRegion[] = [];
    try {
      heatmapRegions = await findHeatmapRegionsFromFile(heatmapPath, {}, cur.screenshotPath);
      await annotateHeatmapRegionKinds(heatmapRegions, cur.screenshotPath);
    } catch {
      // No heatmap (zero diff).
    }
    transitions.push({
      from: prev.name,
      to: cur.name,
      actions: cur.actionsBefore,
      diffPixels: diff?.diffPixels ?? 0,
      diffRatio: diff?.diffRatio ?? 0,
      totalPixels: diff?.totalPixels ?? 0,
      heatmapPath: diff?.diffPixels && diff.diffPixels > 0 ? heatmapPath : undefined,
      heatmapRegions,
    });
  }

  const reportPath = options.reportPath ?? join(outputDir, "report.md");
  const md = renderReport({
    source: options.source,
    viewport,
    motion,
    snapshots,
    frameSequences,
    transitions,
    stepFailures,
    healAllFindings: options.healAll ? healAllFindings : undefined,
  });
  await writeFile(reportPath, md);

  return {
    source: options.source,
    viewport,
    motion,
    snapshots,
    frameSequences,
    transitions,
    reportPath,
    stepFailures,
    healAllFindings: options.healAll ? healAllFindings : undefined,
  };
}

/**
 * The terminal summary. Extracted from `runInteract` for the reason every gate's
 * `format` is separate from its `run`: a measurement that prints cannot be
 * composed, and the step-failure lines in particular were printed *during* the
 * run, interleaved with nothing and recoverable by no one.
 *
 * @param sequenceStepCount how many steps the sequence declared, for the
 *   `--heal-all` denominator. Not on the report, because a report is what was
 *   measured and this is what was asked for.
 */
export function formatInteractReport(
  report: InteractReport,
  options: { sequencePath?: string; healAll?: boolean; selectorStepCount?: number } = {},
): string {
  const lines: string[] = [];
  lines.push(`  ${BOLD}${CYAN}vlmkit inspect interact${RESET}`);
  lines.push(
    `  ${DIM}source: ${report.source}${options.sequencePath ? `  sequence: ${options.sequencePath}` : ""}${RESET}`,
  );
  lines.push(
    `  ${DIM}captured ${report.snapshots.length} snapshot(s), ${report.transitions.length} transition(s)` +
      `${report.frameSequences && report.frameSequences.length > 0 ? `, ${report.frameSequences.length} frame sequence(s); motion live, finished before each snapshot` : ""}${RESET}`,
  );
  for (const f of report.stepFailures) {
    lines.push(`  ${YELLOW}step ${f.stepIndex} failed (${summarizeAction(f.action)}): ${f.message}${RESET}`);
    for (const c of f.suggestions ?? []) {
      lines.push(
        `      ${DIM}${(c.confidence * 100).toFixed(0).padStart(3)}%  \`${c.selector}\`  ${c.text ? `"${c.text}"` : ""}${RESET}`,
      );
    }
  }
  for (const t of report.transitions) {
    const pct = (t.diffRatio * 100).toFixed(2);
    const icon = t.diffRatio === 0 ? `${YELLOW}~${RESET}` : `${GREEN}✓${RESET}`;
    const summary = t.actions.map(summarizeAction).join(", ");
    lines.push(`  ${icon} ${t.from} → ${t.to}  ${pct.padStart(6)}%  ${DIM}${summary}${RESET}`);
  }
  for (const f of report.frameSequences ?? []) {
    lines.push(
      `  ${CYAN}▸${RESET} frames "${f.name}": ${f.count} at ${f.offsets.map(formatInstant).join("/")}ms after` +
        ` ${summarizeAction(f.action)}  ${DIM}${f.manifest}${RESET}`,
    );
    if (f.unstable > 0) {
      lines.push(
        `    ${YELLOW}${f.unstable} frame(s) never captured the same twice: script-driven motion, on the real clock${RESET}`,
      );
    }
  }
  if (options.healAll) {
    const findings = report.healAllFindings ?? [];
    const strongCount = findings.filter((f) => f.tier === "strong").length;
    const weakCount = findings.length - strongCount;
    lines.push(
      `  ${DIM}heal-all: ${strongCount} strong + ${weakCount} weak suggestion(s) across ${options.selectorStepCount ?? 0} selector step(s)${RESET}`,
    );
  }
  lines.push(`  ${DIM}report: ${report.reportPath}${RESET}`);
  return lines.join("\n");
}

function renderReport(r: Omit<InteractReport, "reportPath">): string {
  const lines: string[] = [];
  lines.push("# Interaction-sequence report");
  lines.push("");
  lines.push(`Source: \`${r.source}\` at ${r.viewport.width}×${r.viewport.height}`);
  lines.push(`Captured **${r.snapshots.length}** snapshot(s), ${r.transitions.length} transition(s).`);
  lines.push("");
  lines.push("## Snapshots");
  lines.push("");
  for (const s of r.snapshots) {
    lines.push(`- **${s.name}** — \`${s.screenshotPath}\``);
  }
  lines.push("");
  if (r.motion === "live") {
    lines.push(
      "Motion was left running, not disabled, because the sequence has `frames` steps. Before each " +
        "snapshot every running animation was finished (an infinite one paused at 0), so a snapshot " +
        "is the page at rest; the action before each `frames` step had its animations held.",
    );
    lines.push("");
  }
  if (r.frameSequences.length > 0) {
    lines.push("## Frame sequences");
    lines.push("");
    lines.push(
      "Offsets are ms after the action before the step returned. CSS transitions and " +
        "animations are seeked to each offset, so those frames are exact; script-driven motion " +
        "runs on the real clock (`shotMs` in `frames.json` says when each frame was shot).",
    );
    lines.push("");
    for (const f of r.frameSequences) {
      const after = summarizeAction(f.action);
      lines.push(
        `- **${f.name}** — ${f.count} frame(s) at ${f.offsets.map(formatInstant).join(" / ")}ms after ${after}: \`${f.manifest}\`` +
          (f.unstable > 0 ? ` — ${f.unstable} never captured the same twice` : ""),
      );
    }
    lines.push("");
  }

  // Before the transitions, because a failed step is the reason a transition is
  // dead, and reading them the other way round means guessing.
  if (r.stepFailures.length > 0) {
    lines.push("## Steps that failed");
    lines.push("");
    lines.push(
      "These steps threw and were skipped. Any transition spanning one of them " +
        "measured a page the sequence never finished setting up, so read its delta as " +
        "incomplete rather than as a finding.",
    );
    lines.push("");
    for (const f of r.stepFailures) {
      lines.push(`- **step ${f.stepIndex}** — ${summarizeAction(f.action)}`);
      lines.push(`  - \`${f.message}\``);
      for (const c of f.suggestions ?? []) {
        lines.push(
          `  - did you mean \`${c.selector}\`? _(${(c.confidence * 100).toFixed(0)}% confidence${c.text ? `, "${c.text}"` : ""})_`,
        );
      }
    }
    lines.push("");
  }

  lines.push("## Transitions (delta per step group)");
  lines.push("");
  if (r.transitions.length === 0) {
    lines.push("_No transitions to report — sequence had only one snapshot._");
  } else {
    lines.push(
      "Each transition shows the actions executed between two snapshots " +
        "and the pixel diff they induced. A near-zero delta means the actions had " +
        "no visible effect — usually a sign the selector didn't match, or the " +
        "click hit a no-op.",
    );
    lines.push("");
    lines.push("| From → To | Actions | Pixel diff | Regions | Note |");
    lines.push("|---|---|---|---|---|");
    for (const t of r.transitions) {
      const acts =
        t.actions.length === 0
          ? "_(nothing)_"
          : t.actions.map((a) => `\`${summarizeAction(a).replace(/\|/g, "\\|")}\``).join("<br>");
      // "dead" = non-snapshot actions executed but no visible change.
      // Subagent dogfood: "0% on hover caught a real bug — surface it
      // prominently per-row, not only in the next-step section."
      const nonSnapshotActions = t.actions.filter(
        (a) => a.action !== "wait" && a.action !== "waitForSelector" && a.action !== "snapshot",
      );
      const dead = nonSnapshotActions.length > 0 && t.diffRatio < 0.001;
      const note = dead ? "**dead** — actions had no visible effect (selector miss? no-op?)" : "";
      lines.push(
        `| **${t.from}** → **${t.to}** | ${acts} | ${(t.diffRatio * 100).toFixed(2)}% (${t.diffPixels} px) | ${t.heatmapRegions.length} | ${note} |`,
      );
    }
    lines.push("");

    // Surface the largest changes per transition.
    const surface = r.transitions.filter((t) => t.heatmapRegions.length > 0);
    if (surface.length > 0) {
      lines.push("## Heatmap regions per transition");
      lines.push("");
      for (const t of surface) {
        lines.push(`### ${t.from} → ${t.to} — ${(t.diffRatio * 100).toFixed(2)}% diff`);
        lines.push("");
        lines.push("| Top-Left | Size | Hot pixels | Fill | Kind |");
        lines.push("|---|---|---|---|---|");
        for (const reg of t.heatmapRegions.slice(0, 5)) {
          const fill = reg.dominantColor ? `\`${reg.dominantColor.hex}\`` : "—";
          const kind = reg.kind ? `\`${reg.kind}\`` : "—";
          lines.push(`| ${reg.left},${reg.top} | ${reg.width}×${reg.height} | ${reg.area} | ${fill} | ${kind} |`);
        }
        lines.push("");
      }
    }
  }

  if (r.healAllFindings !== undefined) {
    lines.push("## Heal-all: did-you-mean suggestions");
    lines.push("");
    if (r.healAllFindings.length === 0) {
      lines.push(
        "`--heal-all` enabled. No higher-confidence sibling found for any successful selector step — the selectors look unambiguous.",
      );
    } else {
      const strongCount = r.healAllFindings.filter((f) => f.tier === "strong").length;
      const weakCount = r.healAllFindings.length - strongCount;
      lines.push(
        `\`--heal-all\` enabled. ${strongCount} strong + ${weakCount} weak suggestion(s). ` +
          "Each step below succeeded technically, but the healer found a sibling element with overlapping class-token signal. " +
          "**Strong** tier (≥30% confidence) is the typo-the-wrong-element case worth investigating; " +
          "**weak** tier (10-30%) is the sibling-button-style overlap that's mostly informational.",
      );
      lines.push("");
      lines.push("| Step | Tier | Action | Used selector | Did you mean? | Confidence |");
      lines.push("|---|---|---|---|---|---|");
      for (const f of r.healAllFindings) {
        const summary = summarizeAction(f.action).replace(/\|/g, "\\|");
        const text = f.suggestion.text ? ` _(${f.suggestion.text.replace(/\|/g, "\\|")})_` : "";
        const tierCell = f.tier === "strong" ? "**strong**" : "_weak_";
        lines.push(
          `| ${f.stepIndex} | ${tierCell} | \`${summary}\` | \`${f.originalSelector}\` | \`${f.suggestion.selector}\`${text} | ${(f.suggestion.confidence * 100).toFixed(0)}% |`,
        );
      }
      lines.push("");
      lines.push(
        "**Remediation**: if a strong suggestion is correct, edit the step in your sequence JSON to use the suggested selector. " +
          "If all suggestions are false positives, re-run without `--heal-all` to silence them (default behavior is failure-only healing).",
      );
    }
    lines.push("");
  }

  lines.push("## Suggested next step");
  lines.push("");
  const zeroDeltas = r.transitions.filter((t) => t.diffRatio < 0.001 && t.actions.length > 0);
  if (zeroDeltas.length > 0) {
    lines.push(
      `${zeroDeltas.length} transition(s) induced essentially zero pixel change — likely a no-op or selector miss:`,
    );
    lines.push("");
    for (const t of zeroDeltas) {
      lines.push(`- **${t.from} → ${t.to}**: ${t.actions.map(summarizeAction).join(", ")}`);
    }
    lines.push("");
    lines.push(
      "Verify each: open the source HTML, confirm the selector matches a real " +
        "element, and confirm the action is supposed to be visible (e.g., `click` on a " +
        "submit button without server response will show no visible change in static HTML).",
    );
  } else {
    lines.push(
      "Every action produced visible change. If a transition surfaces an " +
        "*unexpected* region in the Fill / Kind columns above (e.g., wrong color, " +
        "wrong element type), inspect the source CSS for that element.",
    );
  }
  lines.push("");
  return lines.join("\n");
}

/**
 * The command. Returns its exit code rather than assigning `process.exitCode`,
 * and prints via `formatInteractReport` rather than from inside the measurement.
 *
 * @param cwd resolved against for the default output directory — an argument,
 *   because `process.chdir` is process-wide.
 */
export async function runInteractCli(cliArgs: readonly string[], options: { cwd?: string } = {}): Promise<number> {
  const argv = [...cliArgs];
  // `--help` is a request that was satisfied; missing arguments are an error. Both
  // printed the same usage and both exited 1, so `vlmkit inspect interact --help`
  // failed in any `&&` chain or CI help check.
  const askedForHelp = argv[0] === "--help" || argv[0] === "-h";
  const { positional, sequence, outputDir, report, threshold, healAll } = parseArgs(askedForHelp ? [] : argv);
  if (askedForHelp || positional.length === 0 || !sequence) {
    console.log("Usage: vlmkit inspect interact <html-or-url> --sequence <path.json> [options]");
    console.log("Options:");
    console.log("  --sequence <path>   JSON file describing the action sequence.");
    console.log("  --output-dir <dir>  Default: ./test-results/interact");
    console.log("  --report <path>     Markdown report path");
    console.log("  --threshold <0..1>  Pixel diff threshold (default: 0.03)");
    console.log("  --heal-all          Run the healer probe on every selector step,");
    console.log('                      not only on failures. Surfaces "did you mean?"');
    console.log("                      siblings for steps that technically succeed —");
    console.log("                      catches the typo-matched-the-wrong-element case.");
    console.log("                      Adds one DOM scan per selector step (expect a");
    console.log("                      1.5-3x wall-time increase on selector-heavy seqs).");
    console.log("");
    console.log("Sequence schema:");
    console.log('  { "viewport": { "width": 1280, "height": 720 },');
    console.log('    "steps": [');
    console.log('      { "action": "snapshot", "name": "default" },');
    console.log('      { "action": "click", "selector": ".btn" },');
    console.log('      { "action": "snapshot", "name": "after-click" } ] }');
    console.log("");
    console.log(
      "Actions: snapshot | frames | click | hover | focus | blur | press | type | fill | select | scroll | wait | waitForSelector",
    );
    console.log("");
    console.log("Action arguments:");
    console.log("  snapshot         { name: string }");
    console.log('  frames           { name: string, at?: "0..400/50" | number[], everyMs?: 50, forMs?: 500 }');
    console.log(
      "                   // the motion the action right before it started, as <output-dir>/<name>/0000-t000000.png",
    );
    console.log(
      "                   // ... + frames.json (vlmkit-frames/1). With one, motion runs instead of being disabled,",
    );
    console.log("                   // and each snapshot first finishes what is running.");
    console.log("  click | hover    { selector: string }");
    console.log("  focus | blur     { selector: string }");
    console.log('  press            { selector?: string, key: string }   // e.g. "Enter", "Escape", "Tab"');
    console.log("  type             { selector: string, text: string }   // appends text");
    console.log("  fill             { selector: string, value: string }  // replaces value");
    console.log("  select           { selector: string, value: string }  // <select>");
    console.log("  scroll           { selector?: string, x?: number, y?: number }");
    console.log("  wait             { ms: number }");
    console.log("  waitForSelector  { selector: string }");
    return askedForHelp ? 0 : 1;
  }
  const result = await runInteract({
    source: positional[0]!,
    sequencePath: sequence,
    outputDir: outputDir || join(options.cwd ?? process.cwd(), "test-results", "interact"),
    reportPath: report || undefined,
    threshold,
    healAll,
  });
  const selectorStepCount = (await readSequenceSteps(sequence)).filter((s) => "selector" in s && s.selector).length;
  console.log(formatInteractReport(result, { sequencePath: sequence, healAll, selectorStepCount }));
  return 0;
}

/** Re-read for the `--heal-all` denominator only; `runInteract` owns the real parse. */
async function readSequenceSteps(sequencePath: string): Promise<SequenceAction[]> {
  try {
    const parsed = JSON.parse(await readFile(resolve(sequencePath), "utf-8")) as Sequence;
    return parsed.steps ?? [];
  } catch {
    return [];
  }
}

if (isCliEntry(import.meta.url, "interact")) {
  runInteractCli(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch(handleCliError);
}
