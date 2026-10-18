/**
 * Frames at chosen instants: the page loaded with its clock and animations held, moved to an
 * instant of its own time, captured, and written as a `vlmkit-frames/1` sequence.
 *
 * One copy of the hold / advance / seek loop for every caller: `check integrity --timeline`
 * judges at each instant, `check animation --frames` captures at each one, and `inspect interact`
 * writes its `frames` steps through the same writer. Before this the loop lived inside
 * integrity's timeline, and a second caller would have been a second copy of it.
 *
 * A capture is taken until two consecutive shots agree, at most three. On the held clock the
 * seek is synchronous but the compositor is not: `check animation` measured a capture landing
 * before a seek was applied in 2 runs of 30. Two equal shots rule that out. Three that never
 * agree mean something moves that nothing here holds — a `<video>`, an animated image, a worker
 * — and the frame is written with `stable: false` instead of being passed off as the instant.
 */
import { mkdir, readdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Frame, Page } from "playwright";
import { applyHar, settlePage } from "@mizchi/vlmkit-core/page-open.ts";
import { navigationOptions, type PageLoadOptions } from "@mizchi/vlmkit-core/page-load.ts";
import {
  FRAMES_FORMAT,
  frameFileName,
  type FrameEntry,
  type FramesManifest,
  type FramesSource,
} from "@mizchi/vlmkit-judge/frames.ts";
import { timelineInstants } from "@mizchi/vlmkit-judge/persistence.ts";
import { HOLD_TIMELINE_SCRIPT, VIRTUAL_CLOCK_SCRIPT } from "./virtual-clock.ts";

export interface HeldAnimationTiming {
  /** When it starts on the page timeline, delay included. */
  startMs: number;
  durationMs: number;
  /** null = infinite. */
  iterations: number | null;
}

/** What the held clocks still have to run (`VIRTUAL_CLOCK_SCRIPT`'s `pending()`), over every frame. */
export interface HeldPending {
  /** Timers still to fire. */
  timers: number;
  /** Queued `requestAnimationFrame` callbacks. */
  frames: number;
  /** How many of the timers repeat. */
  intervals: number;
  /** The pages' `vlmkit:seek` listeners on their windows. */
  seekListeners: number;
  /** The latest one-shot timer's due time on the sweep's clock, or null when there is none. */
  latestTimerMs: number | null;
}

export interface HeldTimeline {
  /** Every animation held so far in every frame, timed on the sweep's clock. */
  animations(): Promise<HeldAnimationTiming[]>;
  /** What every frame's held clock still has to run, summed; the latest one-shot on the sweep's clock. */
  pending(): Promise<HeldPending>;
  /** Advance the clock to `t` ms of page time and seek every held animation there, in every frame. */
  at(t: number): Promise<void>;
  /** How many times the page has moved to a new document since it was opened. */
  navigations(): number;
}

/** More navigations than this during one sweep and `at` throws. */
export const MAX_SWEEP_NAVIGATIONS = 5;
/** How long a document the page navigates to may take to commit and to load; and a frame to answer. */
const NAVIGATION_WAIT_MS = 10_000;
// Not "Target page ... has been closed": a page that closed itself is not coming back.
const NAVIGATED = /Execution context was destroyed|navigat|Cannot find context/i;

type ClockPending = Omit<HeldPending, "intervals" | "seekListeners"> & { intervals?: number; seekListeners?: number };

type HeldWindow = Window & {
  __vlmkitClock?: {
    advanceTo(ms: number): Promise<number>;
    takeLeftAt?(): number | null;
    pending?(): ClockPending;
    rendered?(maxMs?: number): Promise<boolean>;
  };
  __vlmkitSeekTimeline?(t: number): number | void;
  __vlmkitTimelineAnimations?(): HeldAnimationTiming[];
};

/**
 * A frame's document as the sweep keeps it: its `performance.timeOrigin`, and the sweep instant
 * its own time 0 is at. At sweep instant `t` it is put at `t - offset` of its own time.
 */
type FrameClock = { origin: number; offset: number };

type FrameStep = { fresh: true } | { noClock: true } | { clock: FrameClock; leftAt: number | null };

/**
 * One instant in one frame, run in the page: the clock advanced to `target - offset`, every held
 * animation seeked there, and the page time the document began to leave at, if it did. `known` is
 * the frame's document as the sweep last put it. In the main frame another document answers
 * `fresh` before anything is advanced (a navigation that committed between two instants), since
 * advancing it to the old document's time would start it late; the caller then decides its offset.
 * In any other frame a document not seen before (an iframe inserted or navigated since) begins at
 * this instant: its offset is `target`, so it is put at its own 0, and its first seconds are not
 * run in one step.
 *
 * A seek that ended an animation is followed by the browser's next rendering, where its finish
 * event is dispatched (its finished promise resolved within the seek), then seeked again: what the
 * page starts there can end before the instant too. At most 16 such stages in one instant.
 */
const stepFrame = async ({
  target,
  known,
  main,
}: {
  target: number;
  known: FrameClock | null;
  main: boolean;
}): Promise<FrameStep> => {
  const origin = performance.timeOrigin;
  if (main && known !== null && known.origin !== origin) return { fresh: true };
  const w = window as unknown as HeldWindow;
  const clock = w.__vlmkitClock;
  if (!clock) return { noClock: true };
  const offset = known !== null && known.origin === origin ? known.offset : target;
  const ms = target - offset;
  await clock.advanceTo(ms);
  const seek = () => Number(w.__vlmkitSeekTimeline ? w.__vlmkitSeekTimeline(ms) : 0) || 0;
  for (let ended = seek(), round = 0; ended > 0 && round < 16; round++) {
    if (clock.rendered) await clock.rendered();
    ended = seek();
  }
  return { clock: { origin, offset }, leftAt: clock.takeLeftAt ? clock.takeLeftAt() : null };
};

type FrameRead =
  | { fresh: true }
  | { unknown: true }
  | { animations: HeldAnimationTiming[]; pending: ClockPending | null };

/** A frame's held list and pending work, when its document is the one `known` describes. */
const readFrame = ({ known, main }: { known: FrameClock | null; main: boolean }): FrameRead | null => {
  if (known === null || known.origin !== performance.timeOrigin) return main ? { fresh: true } : { unknown: true };
  const w = window as unknown as HeldWindow;
  if (!w.__vlmkitClock) return null;
  return {
    animations: w.__vlmkitTimelineAnimations ? w.__vlmkitTimelineAnimations() : [],
    pending: w.__vlmkitClock.pending ? w.__vlmkitClock.pending() : null,
  };
};

/** `promise`, or undefined once `ms` have passed. */
function within<T>(promise: Promise<T>, ms: number): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(undefined), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/** Instants added to the animation-derived ones, so script-driven motion is sampled too. */
export const COARSE_GRID_MS = [0, 250, 500, 1000, 2000];

/**
 * The instants to look at a page's motion at when the caller names none: each finite
 * animation's start, middle and end (`timelineInstants`), plus a coarse grid for what moves
 * by script.
 */
export function defaultTimelineInstants(held: readonly HeldAnimationTiming[]): number[] {
  return [...new Set([...timelineInstants(held), ...COARSE_GRID_MS])].sort((a, b) => a - b);
}

/**
 * Load `url` into `page` with the page clock held from document start (`VIRTUAL_CLOCK_SCRIPT`)
 * and every animation held from the instant it begins (`HOLD_TIMELINE_SCRIPT`), and run the
 * zero-delay work queued during load at virtual 0, with everything held by then put at 0. Init
 * scripts do not run for `setContent`, so the page has to be navigated to.
 *
 * Every frame of the page is advanced and seeked at each instant: init scripts run in every
 * frame, so each iframe has a clock of its own, and before this one held only the main frame's
 * (an iframe's rAF loop and CSS animations sat at 0 for the whole sweep). Each frame's document
 * keeps its own offset: the sweep instant it was first seen at, so an iframe inserted at 1000ms
 * starts at its own 0 there instead of being advanced 1000ms in one step (which ran a strobe's
 * every toggle at once), and one that navigates starts again at the instant its new document is
 * first seen. A frame that detaches, has no clock, or does not answer within 10s is skipped.
 * `animations()` and `pending()` read every frame, each on the sweep's clock; a document they find
 * that no instant has reached yet is put at its own 0 first, at the sweep's present instant.
 *
 * A page may navigate during the sweep (a splash that forwards itself, a timer that follows a
 * link): the new document's clock starts at 0, and the page time it began at becomes its offset
 * — at `t` it is advanced to `t - offset`. That time is read from the old document's
 * `beforeunload` (`takeLeftAt`) when the step that navigated returned; when the old document was
 * destroyed under the step instead, it is the instant being reached, late by at most that step.
 * More than `MAX_SWEEP_NAVIGATIONS` navigations throw.
 */
export async function openHeldTimeline(page: Page, url: string, options: PageLoadOptions = {}): Promise<HeldTimeline> {
  await page.addInitScript(VIRTUAL_CLOCK_SCRIPT);
  await page.addInitScript(HOLD_TIMELINE_SCRIPT);
  await applyHar(page, options.har);
  await page.goto(url, navigationOptions(options));
  // Network idle and fonts only: the settle's animation and trailing waits run on the page's
  // own timers, which the held clock never fires.
  await settlePage(page, 0, 0);

  let offset = 0;
  let navigations = 0;
  // The document being swept: its timeOrigin (null until read), whether it has been put at its
  // own 0 yet, and the instant it was last put at.
  let origin: number | null = null;
  let opened = false;
  let lastAt = 0;
  // A frame that did not answer within the wait is not waited on again.
  const stalled = new WeakSet<Frame>();
  // Every other frame's document as the sweep last put it; a new document resets it.
  const clocks = new WeakMap<Frame, FrameClock>();
  const others = () => page.frames().filter((frame) => frame !== page.mainFrame() && !stalled.has(frame));

  /** Put one frame that is not the main one at sweep instant `target`; its clock, if it answered. */
  const stepOther = async (frame: Frame, target: number): Promise<FrameClock | undefined> => {
    try {
      const answered = await within(
        frame.evaluate(stepFrame, { target, known: clocks.get(frame) ?? null, main: false }),
        NAVIGATION_WAIT_MS,
      );
      if (answered === undefined) stalled.add(frame);
      else if ("clock" in answered) {
        clocks.set(frame, answered.clock);
        return answered.clock;
      }
    } catch {
      // Detached, or between documents: its next instant reaches it.
    }
    return undefined;
  };

  type Outcome = { kind: "ok" } | { kind: "left"; at: number } | { kind: "fresh" } | { kind: "destroyed" };
  // The main frame first, and its answer decides; then every other frame at once. Not all of them
  // together: when the main frame answers fresh, a new document's iframes would already have been
  // advanced to the old document's time, and a held clock does not go back.
  const put = async (target: number): Promise<Outcome> => {
    try {
      if (origin === null) origin = await page.evaluate(() => performance.timeOrigin);
      const step = await page.mainFrame().evaluate(stepFrame, { target, known: { origin, offset }, main: true });
      if ("fresh" in step) return { kind: "fresh" };
      if ("noClock" in step) throw new Error(`openHeldTimeline: the page has no held clock (${page.url()})`);
      lastAt = target;
      await Promise.all(others().map((frame) => stepOther(frame, target)));
      return step.leftAt === null ? { kind: "ok" } : { kind: "left", at: offset + step.leftAt };
    } catch (error) {
      if (!NAVIGATED.test(String(error))) throw error;
      return { kind: "destroyed" };
    }
  };

  // Did a navigation the page began commit? A 204, a download or a cancelled beforeunload never does.
  const committed = async (): Promise<boolean> => {
    const deadline = Date.now() + NAVIGATION_WAIT_MS;
    while (Date.now() < deadline) {
      try {
        const now = await within(
          page.evaluate(() => performance.timeOrigin),
          deadline - Date.now(),
        );
        if (now !== undefined && now !== origin) return true;
      } catch (error) {
        if (!NAVIGATED.test(String(error))) throw error;
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    return false;
  };

  const navigated = async (at: number) => {
    navigations += 1;
    if (navigations > MAX_SWEEP_NAVIGATIONS) {
      throw new Error(`page navigated more than ${MAX_SWEEP_NAVIGATIONS} times during the sweep`);
    }
    offset = at;
    lastAt = at;
    origin = null;
    opened = false;
    await page.waitForLoadState("load", { timeout: NAVIGATION_WAIT_MS }).catch(() => {});
    await settlePage(page, 0, 0);
  };

  const at = async (t: number): Promise<void> => {
    for (;;) {
      // A new document is put at its own 0 first, so what it began during its load is held there.
      const opening = !opened;
      const target = opening ? offset : t;
      const outcome = await put(target);
      if (outcome.kind === "fresh") {
        await navigated(lastAt);
        continue;
      }
      if (outcome.kind === "destroyed") {
        await navigated(target);
        continue;
      }
      if (outcome.kind === "left" && (await committed())) {
        await navigated(outcome.at);
        continue;
      }
      opened = true;
      if (!opening || target === t) return;
    }
  };

  type Read = { offset: number; animations: HeldAnimationTiming[]; pending: ClockPending | null };
  /** One frame that is not the main one, read; a document no instant has reached yet is put at its 0 first. */
  const readOther = async (frame: Frame): Promise<Read | null> => {
    for (let attempt = 0; attempt < 2; attempt++) {
      let read: FrameRead | null | undefined;
      try {
        read = await within(
          frame.evaluate(readFrame, { known: clocks.get(frame) ?? null, main: false }),
          NAVIGATION_WAIT_MS,
        );
      } catch {
        return null;
      }
      if (read === undefined) stalled.add(frame);
      if (!read || "fresh" in read) return null;
      if ("unknown" in read) {
        // It appeared since the last instant: at its own 0 now, where the sweep is.
        if (!(await stepOther(frame, lastAt))) return null;
        continue;
      }
      return { offset: clocks.get(frame)!.offset, ...read };
    }
    return null;
  };
  /** Every frame's held list and pending work, the main frame first, each with its offset. */
  const readAll = async (): Promise<Read[]> => {
    for (;;) {
      let main: FrameRead | null = { fresh: true };
      try {
        main = await page
          .mainFrame()
          .evaluate(readFrame, { known: origin === null ? null : { origin, offset }, main: true });
      } catch (error) {
        if (!NAVIGATED.test(String(error))) throw error;
      }
      if (main && ("fresh" in main || "unknown" in main)) {
        // The page moved to another document since the last instant: open it where the sweep is.
        await at(lastAt);
        continue;
      }
      const rest = await Promise.all(others().map(readOther));
      return [
        { offset, animations: main?.animations ?? [], pending: main?.pending ?? null },
        ...rest.filter((r): r is Read => r !== null),
      ];
    }
  };

  await at(0);
  return {
    animations: async () =>
      (await readAll()).flatMap((r) => r.animations.map((a) => ({ ...a, startMs: a.startMs + r.offset }))),
    pending: async () => {
      const total: HeldPending = { timers: 0, frames: 0, intervals: 0, seekListeners: 0, latestTimerMs: null };
      for (const { offset: frameOffset, pending } of await readAll()) {
        if (!pending) continue;
        total.timers += pending.timers;
        total.frames += pending.frames;
        total.intervals += pending.intervals ?? 0;
        total.seekListeners += pending.seekListeners ?? 0;
        if (pending.latestTimerMs !== null && pending.latestTimerMs !== undefined) {
          const due = pending.latestTimerMs + frameOffset;
          total.latestTimerMs = total.latestTimerMs === null ? due : Math.max(total.latestTimerMs, due);
        }
      }
      return total;
    },
    at,
    navigations: () => navigations,
  };
}

/**
 * Screenshot until two consecutive shots are byte-identical, at most `maxShots` (default 3).
 * `stable: false` = they never agreed; the last shot is returned.
 *
 * `clock`, when given, is read just before each shot, and `at` is its reading for the picture
 * returned — the first of an agreeing pair (the page showed it from then), or the last shot when
 * none agreed. A reading taken before the call would be early by every shot it took.
 */
export async function captureStable(
  page: Page,
  options: { maxShots?: number; clock?: () => Promise<number> } = {},
): Promise<{ png: Buffer; stable: boolean; at?: number }> {
  const shoot = async () => {
    const at = options.clock ? await options.clock() : undefined;
    return { at, png: await page.screenshot({ animations: "allow" }) };
  };
  const stamp = (at: number | undefined) => (at === undefined ? {} : { at });
  let previous = await shoot();
  for (let shot = 1; shot < Math.max(2, options.maxShots ?? 3); shot++) {
    const next = await shoot();
    if (next.png.equals(previous.png)) return { png: next.png, stable: true, ...stamp(previous.at) };
    previous = next;
  }
  return { png: previous.png, stable: false, ...stamp(previous.at) };
}

/** What a sequence's writer reports once it is done. */
export interface FramesWritten {
  dir: string;
  /** `frames.json`, absolute. */
  manifest: string;
  count: number;
  /** Frames whose captures never agreed. */
  unstable: number;
  /** Every frame file, absolute, in sequence order. */
  files: string[];
}

/** `chromium 141.0.7390.37`, device pixel ratio: the facts a frame's pixels depend on. */
export async function frameSourceFacts(page: Page): Promise<Pick<FramesSource, "browser" | "deviceScaleFactor">> {
  const browser = page.context().browser();
  const deviceScaleFactor = await page.evaluate(() => window.devicePixelRatio);
  return {
    deviceScaleFactor,
    ...(browser ? { browser: `${browser.browserType().name()} ${browser.version()}` } : {}),
  };
}

/** A frame file this writer would have written: `0006-t000100.png`. */
const FRAME_FILE = /^\d{4,}-t\d{6,}\.png$/;

/**
 * Write a sequence into `dir`: each frame as it is added, `frames.json` at `finish`. Frames a
 * previous run left there (files named like a frame, and `frames.json`) are removed first, so
 * a glob of the directory is always one sequence; nothing else in it is touched.
 */
export async function frameWriter(dir: string, source: FramesSource) {
  await mkdir(dir, { recursive: true });
  for (const name of await readdir(dir)) {
    if (FRAME_FILE.test(name) || name === "frames.json") await unlink(join(dir, name));
  }
  const frames: FrameEntry[] = [];
  return {
    async add(png: Buffer, entry: Omit<FrameEntry, "n" | "file">): Promise<string> {
      const n = frames.length;
      const file = frameFileName(n, entry.atMs);
      await writeFile(join(dir, file), png);
      frames.push({ n, file, ...entry });
      return join(dir, file);
    },
    async finish(): Promise<FramesWritten> {
      const manifest: FramesManifest = { format: FRAMES_FORMAT, source, frames };
      const path = join(dir, "frames.json");
      await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`);
      return {
        dir,
        manifest: path,
        count: frames.length,
        unstable: frames.filter((f) => !f.stable).length,
        files: frames.map((f) => join(dir, f.file)),
      };
    },
  };
}

/**
 * The viewport, uncropped, at each instant of its own time, as a sequence: `openHeldTimeline`, then for
 * each instant `at` + `captureStable`. `instants` defaults to `defaultTimelineInstants`.
 */
export async function captureTimelineFrames(
  page: Page,
  url: string,
  options: PageLoadOptions & { dir: string; tool: string; instants?: readonly number[]; reducedMotion?: boolean },
): Promise<FramesWritten & { instants: number[] }> {
  // Before load, so the page's first style already matches `(prefers-reduced-motion: reduce)`.
  if (options.reducedMotion) await page.emulateMedia({ reducedMotion: "reduce" });
  const timeline = await openHeldTimeline(page, url, options);
  const instants =
    options.instants && options.instants.length > 0
      ? [...new Set(options.instants)].sort((a, b) => a - b)
      : defaultTimelineInstants(await timeline.animations());
  const writer = await frameWriter(options.dir, {
    tool: options.tool,
    url,
    viewport: page.viewportSize() ?? { width: 0, height: 0 },
    ...(await frameSourceFacts(page)),
    clock: "held",
    ...(options.reducedMotion ? { reducedMotion: true } : {}),
  });
  for (const atMs of instants) {
    await timeline.at(atMs);
    const { png, stable } = await captureStable(page);
    await writer.add(png, { atMs, stable });
  }
  return { ...(await writer.finish()), instants };
}
