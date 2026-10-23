/**
 * Is an animation visually broken? Frames of it, a target described in words, and statements
 * that must not be seen. Jev answers per frame; vlmkit judges the motion.
 *
 * One request per frame, on one image: for each target a `noul` (shown?) and a `box` (where?),
 * and a `noul` per forbidden statement — so a frame costs about what one screenshot does
 * (~3.1k tokens at 1280x800, $0.00013) however many questions it carries.
 *
 * Jev is asked only what it is good at, measured (`docs/reports/2026-10-18-jev-easing.md`):
 * asked for an easing name it was at chance (7/21); asked where the object was in each frame and
 * the curve fitted here, 21/21. So the motion — jumps, snap-backs, a target lost mid-way, the
 * easing — is `judgeMotionPath`'s, from positions and presence, and Jev never names it.
 *
 * Advisory: a model's reading of the pixels. The deterministic motion checks (`check animation`,
 * `check integrity --timeline`) measure; this asks what a person would see in the frames.
 */
import {
  judgeMotionPath,
  type EasingName,
  type OriginName,
  type MotionDirection,
  type MotionPathReport,
  type MotionSample,
  type MotionSegment,
} from "@mizchi/vlmkit-judge/motion-path.ts";
import { askJev, JEV_DEFAULT_MODEL, JEV_IMAGE_LIMITS, jevBoxToPixels, pngImage } from "./jev-client.ts";
import type { JevAnswer, JevClientOptions, JevQuestion } from "./jev-client.ts";
import { claimInstruction } from "./claims.ts";
import type { JevAsk } from "./locate.ts";
import { firstLookScale } from "./locate.ts";
import { regionKindScale, regionKindView, regionKindWindow } from "./region-kind.ts";
import { decodeImage, encodePngImage, resample } from "./zoom-image.ts";

/** A target measured by the page at a frame: border box (frame pixels), rendered opacity, transform scale. */
export interface MotionDom {
  box: { x: number; y: number; width: number; height: number };
  opacity: number;
  scale: number;
  /** Its own animation's progress in time, 0-1 (delay and duration its own), when it has one. */
  t?: number | null;
  /**
   * Share of its box, within the viewport, where it is the topmost thing painted (0-1): what a
   * clip, a cover or a stacking mistake leaves of it. What `jev: false` judges presence from.
   */
  visible?: number;
  /** Why it is not seen, when the page could tell: "clipped by header.topbar (overflow: hidden)…". */
  hiddenBy?: string;
  /** How long its own animation has been active (ms, negative in its delay): when it begins. */
  elapsedMs?: number | null;
  scaleX?: number;
  scaleY?: number;
  durationMs?: number;
  iterations?: number | null;
  /** The share of its box inside the viewport (0-1). */
  onScreen?: number;
  /** Its own opacity, before its ancestors': unchanged while it fades, the fade is theirs. */
  ownOpacity?: number;
  /** The ancestor with the lowest opacity under 1 at this frame. */
  fadeBy?: string;
}

export interface MotionFrame {
  atMs: number;
  png: Uint8Array;
  /** Per target, in order, when the page could measure it (`--selector`); null for one it could not. */
  dom?: (MotionDom | null)[];
}

export interface MotionCheckOptions {
  /** What moves, in words, as a person would point at it: "the blue 'Saved' toast". */
  targets: readonly string[];
  /** Statements no frame may show: "text overlapping other text so that it is hard to read". */
  forbid?: readonly string[];
  /** The motion runs over [startMs, endMs]; frames after `endMs` show it at rest. */
  startMs: number;
  endMs: number;
  /** Spans some animation runs in (entrance, exit…): each is fitted and searched for jumps alone. */
  segments?: readonly MotionSegment[];
  /** The targets are meant to leave by the end (a dismissed toast): gone at rest is not a fail. */
  exits?: boolean;
  /** Per target in order: this one is meant to leave (a flip card's front face, turned away). */
  exitsFor?: readonly boolean[];
  /** The timing function the author meant, for every segment or per segment in order. */
  expectEasing?: EasingName | readonly EasingName[];
  /** Per target, in order, overriding `expectEasing` for that target (cards ease-out, a bar ease-in-out). */
  targetEasing?: readonly (EasingName | readonly EasingName[] | undefined)[];
  /** The point a scale grows from: every target's, or per target in order. */
  expectOrigin?: OriginName | readonly (OriginName | undefined)[];
  /** When each target's own animation begins (page ms), per target in order. */
  expectStartMs?: readonly (number | undefined)[];
  /**
   * Consecutive targets begin this far apart (ms), in the order given: each one's start is the
   * first target's (or its --expect-start) plus k times this.
   */
  expectStaggerMs?: number;
  /** How long one run takes (ms) and how many runs (null: infinite): one for all, or per target. */
  expectDurationMs?: readonly number[];
  expectIterations?: readonly (number | null)[];
  /** Which way each target's first segment moves: one for all, or per target. */
  expectDirection?: readonly MotionDirection[];
  /** Every target's centre must not move: only its size and opacity change. */
  expectStill?: boolean;
  /** Per target in order: this one's centre must not move. */
  expectStillFor?: readonly boolean[];
  /** Animations that change layout on the page ("div.notice animates margin-top"). */
  layoutMovers?: readonly string[];
  /** A statement is true at or above this (default 0.5). */
  threshold?: number;
  /** Within this of the threshold an answer is `uncertain` (default 0.3). */
  uncertainBand?: number;
  model?: string;
  /**
   * Ask Jev (default true). False judges from the page alone: every frame must carry every
   * target's `dom` (`--selector`), presence is its `visible` share, and no statement is asked.
   */
  jev?: boolean;
  ask?: JevAsk;
  client?: JevClientOptions;
  /**
   * Ask each target's box a second time on a magnified crop of the region it moves through
   * (default true): a first look's edges are 1% steps, 12.8px on a 1280px frame, which is a jump's
   * size on a short travel; magnified, they were ~5px in the jev-box bench. One more request per
   * frame that shows a target.
   */
  refine?: boolean;
  /** Requests in flight at once (default 4). */
  concurrency?: number;
}

export interface MotionFrameAnswer {
  atMs: number;
  rest: boolean;
  targets: {
    present: number;
    box: { x: number; y: number; width: number; height: number };
    refined?: boolean;
    /** Its box coincides with another target's in this frame: one of them is the wrong element. */
    unsure?: boolean;
  }[];
  forbid: number[];
}

export interface ForbidFinding {
  statement: string;
  /** Fail when it is seen once the motion stops, warn when only mid-motion. */
  severity: "fail" | "warn";
  /** Frames that show it, with Jev's noul. */
  frames: { atMs: number; noul: number; uncertain: boolean }[];
  atRest: boolean;
}

export interface MotionCheckReport {
  frames: MotionFrameAnswer[];
  targets: (MotionPathReport & { target: string })[];
  forbidden: ForbidFinding[];
  /** No fail finding on any target and no forbidden statement seen at rest. */
  passed: boolean;
  model: string;
  calls: number;
  costUsd: number;
  inputTokens: number;
}

async function pool<T, R>(items: readonly T[], n: number, f: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await f(items[i]!);
      }
    }),
  );
  return out;
}

export async function checkMotionFrames(
  frames: readonly MotionFrame[],
  options: MotionCheckOptions,
): Promise<MotionCheckReport> {
  if (frames.length === 0) throw new Error("no frames to check");
  if (options.targets.length === 0 && (options.forbid ?? []).length === 0) {
    throw new Error("nothing to check: give a target or a forbidden statement");
  }
  const ask: JevAsk = options.ask ?? ((req) => askJev(req, options.client));
  const threshold = options.threshold ?? 0.5;
  const band = options.uncertainBand ?? 0.3;
  const forbid = options.forbid ?? [];
  const model = options.model ?? JEV_DEFAULT_MODEL;
  let costUsd = 0;
  let inputTokens = 0;
  let served = model;
  let frameSize: { width: number; height: number } | undefined;
  let calls = 0;

  if (options.jev === false) {
    if (forbid.length > 0) throw new Error("a forbidden statement can only be asked of Jev (jev: true)");
    const missing = options.targets.findIndex((_, i) => !frames.every((f) => f.dom?.[i]));
    if (missing >= 0)
      throw new Error(`without Jev every target needs the page's measurement: ${options.targets[missing]}`);
  }
  const answers =
    options.jev === false
      ? frames.map((frame): MotionFrameAnswer => {
          const img = decodeImage(Buffer.from(frame.png));
          frameSize ??= { width: img.width, height: img.height };
          return {
            atMs: frame.atMs,
            rest: frame.atMs > options.endMs,
            targets: options.targets.map((_, i) => {
              const d = frame.dom![i]!;
              return { present: d.opacity < 0.05 ? 0 : (d.visible ?? 1), box: d.box };
            }),
            forbid: [],
          };
        })
      : await askFrames();
  async function askFrames() {
    return pool(frames, options.concurrency ?? 4, async (frame): Promise<MotionFrameAnswer> => {
      const img = decodeImage(Buffer.from(frame.png));
      frameSize ??= { width: img.width, height: img.height };
      const scale = firstLookScale(img.width, img.height);
      if (scale === null) {
        throw new Error(
          `a ${img.width}x${img.height} frame cannot be shown within Jev's ${JEV_IMAGE_LIMITS.minEdge}-${JEV_IMAGE_LIMITS.maxEdge}px edges`,
        );
      }
      const shown =
        scale === 1
          ? frame.png
          : encodePngImage(
              resample(img, { width: Math.round(img.width * scale), height: Math.round(img.height * scale) }),
            );
      const questions: Record<string, JevQuestion> = {};
      options.targets.forEach((t, i) => {
        questions[`p${i}`] = { type: "noul", instructions: claimInstruction(t) };
        questions[`b${i}`] = { type: "box", instructions: `${t.trim().replace(/[.\s]+$/, "")} in \`screenshot\`` };
      });
      forbid.forEach((f, i) => {
        questions[`f${i}`] = { type: "noul", instructions: claimInstruction(f) };
      });
      const r = await ask({ model, state: { screenshot: "SHOT" }, assets: { SHOT: pngImage(shown) }, questions });
      calls++;
      costUsd += r.costUsd;
      inputTokens += r.usage.input_tokens;
      served = r.model;
      const a = r.answers as Record<string, JevAnswer>;
      const noul = (k: string) => (a[k] as Extract<JevAnswer, { type: "noul" }>).noul;
      return {
        atMs: frame.atMs,
        rest: frame.atMs > options.endMs,
        targets: options.targets.map((_, i) => {
          // Edges are fractions of the image, so the original's size maps them back.
          const b = jevBoxToPixels((a[`b${i}`] as Extract<JevAnswer, { type: "box" }>).box, img.width, img.height);
          return { present: noul(`p${i}`), box: { x: b.x1, y: b.y1, width: b.x2 - b.x1, height: b.y2 - b.y1 } };
        }),
        forbid: forbid.map((_, i) => noul(`f${i}`)),
      };
    });
  }

  // Second look: each target's box again, on the region it moves through, cut from the original
  // and magnified. The same window for every frame, so positions stay on one grid.
  if (options.jev !== false && options.refine !== false && frameSize) {
    const size = frameSize;
    for (const [i, target] of options.targets.entries()) {
      if (frames.every((f) => f.dom?.[i])) continue;
      const seen = answers.filter((f) => f.targets[i]!.present >= threshold);
      if (seen.length === 0) continue;
      const x1 = Math.min(...seen.map((f) => f.targets[i]!.box.x));
      const y1 = Math.min(...seen.map((f) => f.targets[i]!.box.y));
      const x2 = Math.max(...seen.map((f) => f.targets[i]!.box.x + f.targets[i]!.box.width));
      const y2 = Math.max(...seen.map((f) => f.targets[i]!.box.y + f.targets[i]!.box.height));
      const win = regionKindWindow({ x: x1, y: y1, width: x2 - x1, height: y2 - y1 }, size);
      const scale = regionKindScale(win.x2 - win.x1, win.y2 - win.y1);
      // Not magnified at all: the first look already saw it at full size.
      if (scale === null || scale <= 1.05) continue;
      const byTime = new Map(frames.map((f) => [f.atMs, f]));
      await pool(seen, options.concurrency ?? 4, async (f) => {
        const view = regionKindView(decodeImage(Buffer.from(byTime.get(f.atMs)!.png)), win, scale);
        const r = await ask({
          model,
          state: { screenshot: "SHOT" },
          assets: { SHOT: pngImage(encodePngImage(view)) },
          questions: { b: { type: "box", instructions: `${target.trim().replace(/[.\s]+$/, "")} in \`screenshot\`` } },
        });
        calls++;
        costUsd += r.costUsd;
        inputTokens += r.usage.input_tokens;
        const b = (r.answers as Record<string, JevAnswer>).b as Extract<JevAnswer, { type: "box" }>;
        // The view is the whole window resampled, so its fractions are the window's.
        const w = win.x2 - win.x1;
        const h = win.y2 - win.y1;
        f.targets[i]!.box = {
          x: win.x1 + b.box.left * w,
          y: win.y1 + b.box.top * h,
          width: (b.box.right - b.box.left) * w,
          height: (b.box.bottom - b.box.top) * h,
        };
        f.targets[i]!.refined = true;
      });
    }
  }

  // Two targets boxed on the same spot: one of them is the wrong element (look-alike cards).
  const iou = (a: MotionFrameAnswer["targets"][number]["box"], b: MotionFrameAnswer["targets"][number]["box"]) => {
    const w = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
    const h = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
    const inter = w * h;
    return inter / Math.max(1e-9, a.width * a.height + b.width * b.height - inter);
  };
  for (const f of answers) {
    for (let i = 0; i < f.targets.length; i++) {
      for (let j = i + 1; j < f.targets.length; j++) {
        const [a, b] = [f.targets[i]!, f.targets[j]!];
        if (a.present >= threshold && b.present >= threshold && iou(a.box, b.box) > 0.5) a.unsure = b.unsure = true;
      }
    }
  }
  const domAt = new Map(frames.map((f) => [f.atMs, f.dom]));

  // One value is every target's; several are the targets' in order.
  const perTarget = <T>(xs: readonly T[] | undefined, i: number): T | undefined =>
    xs === undefined ? undefined : xs.length === 1 ? xs[0] : xs[i];
  const originFor = (i: number) =>
    typeof options.expectOrigin === "string" ? options.expectOrigin : options.expectOrigin?.[i];
  // A stagger is relative to the first target: its own expected start if given, else where it
  // was measured to begin (judged once the first target is).
  let staggerFrom: number | undefined = options.expectStartMs?.[0];
  const startFor = (i: number) =>
    options.expectStartMs?.[i] ??
    (options.expectStaggerMs !== undefined && i > 0 && staggerFrom !== undefined
      ? staggerFrom + i * options.expectStaggerMs
      : undefined);
  const targets = options.targets.map((target, i) => {
    const measured = frames.every((f) => f.dom?.[i]);
    const samples: MotionSample[] = answers.map((f) => ({
      atMs: f.atMs,
      present: f.targets[i]!.present,
      box: f.targets[i]!.box,
      ...(measured ? { dom: domAt.get(f.atMs)![i]! } : f.targets[i]!.unsure ? { unsure: true } : {}),
    }));
    const judged = {
      target,
      ...judgeMotionPath(samples, {
        startMs: options.startMs,
        endMs: options.endMs,
        ...(options.segments ? { segments: options.segments } : {}),
        ...(frameSize ? { frame: frameSize } : {}),
        presenceThreshold: threshold,
        ...(options.exits || options.exitsFor?.[i] ? { exits: true } : {}),
        ...((options.targetEasing?.[i] ?? options.expectEasing)
          ? { expectEasing: (options.targetEasing?.[i] ?? options.expectEasing)! }
          : {}),
        ...(originFor(i) ? { expectOrigin: originFor(i)! } : {}),
        ...(startFor(i) !== undefined ? { expectStartMs: startFor(i)! } : {}),
        ...(perTarget(options.expectDurationMs, i) !== undefined
          ? { expectDurationMs: perTarget(options.expectDurationMs, i)! }
          : {}),
        ...(perTarget(options.expectDirection, i) !== undefined
          ? { expectDirection: perTarget(options.expectDirection, i)! }
          : {}),
        ...(perTarget(options.expectIterations, i) !== undefined
          ? { expectIterations: perTarget(options.expectIterations, i)! }
          : {}),
        ...(options.expectStill || options.expectStillFor?.[i] ? { expectStill: true } : {}),
        ...(options.layoutMovers ? { layoutMovers: options.layoutMovers } : {}),
      }),
    };
    if (i === 0) staggerFrom ??= judged.startsAtMs;
    return judged;
  });

  const forbidden: ForbidFinding[] = [];
  forbid.forEach((statement, i) => {
    const seen = answers
      .filter((f) => f.forbid[i]! >= threshold)
      .map((f) => ({ atMs: f.atMs, noul: f.forbid[i]!, uncertain: Math.abs(f.forbid[i]! - threshold) < band }));
    if (seen.length === 0) return;
    const atRest = answers.some((f) => f.rest && f.forbid[i]! >= threshold);
    forbidden.push({ statement, severity: atRest ? "fail" : "warn", frames: seen, atRest });
  });

  const passed =
    targets.every((t) => t.findings.every((f) => f.severity !== "fail")) &&
    forbidden.every((f) => f.severity !== "fail");
  return {
    frames: answers,
    targets,
    forbidden,
    passed,
    model: options.jev === false ? "none (measured from the page)" : served,
    calls,
    costUsd,
    inputTokens,
  };
}
