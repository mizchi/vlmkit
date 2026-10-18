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
  type MotionPathReport,
  type MotionSample,
} from "@mizchi/vlmkit-judge/motion-path.ts";
import { askJev, JEV_DEFAULT_MODEL, JEV_IMAGE_LIMITS, jevBoxToPixels, pngImage } from "./jev-client.ts";
import type { JevAnswer, JevClientOptions, JevQuestion } from "./jev-client.ts";
import { claimInstruction } from "./claims.ts";
import type { JevAsk } from "./locate.ts";
import { firstLookScale } from "./locate.ts";
import { decodeImage, encodePngImage, resample } from "./zoom-image.ts";

export interface MotionFrame {
  atMs: number;
  png: Uint8Array;
}

export interface MotionCheckOptions {
  /** What moves, in words, as a person would point at it: "the blue 'Saved' toast". */
  targets: readonly string[];
  /** Statements no frame may show: "text overlapping other text so that it is hard to read". */
  forbid?: readonly string[];
  /** The motion runs over [startMs, endMs]; frames after `endMs` show it at rest. */
  startMs: number;
  endMs: number;
  /** The targets are meant to leave by the end (a dismissed toast): gone at rest is not a fail. */
  exits?: boolean;
  /** The timing function the author meant; fails `easing-mismatch` when the path follows another. */
  expectEasing?: EasingName;
  /** A statement is true at or above this (default 0.5). */
  threshold?: number;
  /** Within this of the threshold an answer is `uncertain` (default 0.3). */
  uncertainBand?: number;
  model?: string;
  ask?: JevAsk;
  client?: JevClientOptions;
  /** Requests in flight at once (default 4). */
  concurrency?: number;
}

export interface MotionFrameAnswer {
  atMs: number;
  rest: boolean;
  targets: { present: number; box: { x: number; y: number; width: number; height: number } }[];
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

  const answers = await pool(frames, options.concurrency ?? 4, async (frame): Promise<MotionFrameAnswer> => {
    const img = decodeImage(Buffer.from(frame.png));
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

  const targets = options.targets.map((target, i) => {
    const samples: MotionSample[] = answers.map((f) => ({
      atMs: f.atMs,
      present: f.targets[i]!.present,
      box: f.targets[i]!.box,
    }));
    return {
      target,
      ...judgeMotionPath(samples, {
        startMs: options.startMs,
        endMs: options.endMs,
        presenceThreshold: threshold,
        ...(options.exits ? { exits: true } : {}),
        ...(options.expectEasing ? { expectEasing: options.expectEasing } : {}),
      }),
    };
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
  return { frames: answers, targets, forbidden, passed, model: served, calls: frames.length, costUsd, inputTokens };
}
