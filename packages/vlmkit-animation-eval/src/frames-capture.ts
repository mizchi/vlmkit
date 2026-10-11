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
import type { Page } from "playwright";
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

export interface HeldTimeline {
  /** Every animation held so far, timed on the page clock. */
  animations(): Promise<HeldAnimationTiming[]>;
  /** Advance the clock to `t` ms of page time and seek every held animation there. */
  at(t: number): Promise<void>;
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
 * zero-delay work queued during load at virtual 0. Init scripts do not run for `setContent`, so
 * the page has to be navigated to.
 */
export async function openHeldTimeline(page: Page, url: string, options: PageLoadOptions = {}): Promise<HeldTimeline> {
  await page.addInitScript(VIRTUAL_CLOCK_SCRIPT);
  await page.addInitScript(HOLD_TIMELINE_SCRIPT);
  await applyHar(page, options.har);
  await page.goto(url, navigationOptions(options));
  // Network idle and fonts only: the settle's animation and trailing waits run on the page's
  // own timers, which the held clock never fires.
  await settlePage(page, 0, 0);
  const advance = (t: number) =>
    page.evaluate(
      (ms) =>
        (window as unknown as { __vlmkitClock: { advanceTo(ms: number): Promise<number> } }).__vlmkitClock.advanceTo(
          ms,
        ),
      t,
    );
  await advance(0);
  return {
    animations: () =>
      page.evaluate(() =>
        (window as unknown as { __vlmkitTimelineAnimations(): HeldAnimationTiming[] }).__vlmkitTimelineAnimations(),
      ),
    at: async (t) => {
      await advance(t);
      await page.evaluate(
        (ms) => (window as unknown as { __vlmkitSeekTimeline(t: number): void }).__vlmkitSeekTimeline(ms),
        t,
      );
    },
  };
}

/**
 * Screenshot until two consecutive shots are byte-identical, at most `maxShots` (default 3).
 * `stable: false` = they never agreed; the last shot is returned.
 */
export async function captureStable(page: Page, maxShots = 3): Promise<{ png: Buffer; stable: boolean }> {
  let previous = await page.screenshot({ animations: "allow" });
  for (let shot = 1; shot < Math.max(2, maxShots); shot++) {
    const next = await page.screenshot({ animations: "allow" });
    if (next.equals(previous)) return { png: next, stable: true };
    previous = next;
  }
  return { png: previous, stable: false };
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
 * The whole page at each instant of its own time, as a sequence: `openHeldTimeline`, then for
 * each instant `at` + `captureStable`. `instants` defaults to `defaultTimelineInstants`.
 */
export async function captureTimelineFrames(
  page: Page,
  url: string,
  options: PageLoadOptions & { dir: string; tool: string; instants?: readonly number[] },
): Promise<FramesWritten & { instants: number[] }> {
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
  });
  for (const atMs of instants) {
    await timeline.at(atMs);
    const { png, stable } = await captureStable(page);
    await writer.add(png, { atMs, stable });
  }
  return { ...(await writer.finish()), instants };
}
