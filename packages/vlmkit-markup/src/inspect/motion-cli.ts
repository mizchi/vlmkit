/**
 * `vlmkit inspect motion <page|url|frames.json> --target "<what moves>" --forbid "<statement>"`:
 * is a CSS animation visually broken? The page is loaded with its clock and animations held,
 * shot at instants across its motion and once at rest, and each frame is asked of Jev (TypeSafe;
 * TYPESAFEAI_API_KEY): where the target is, whether it is shown, whether a forbidden statement
 * is. The motion itself — jumps, a snap-back, a target lost mid-way, the easing — is judged here
 * from those answers (`judgeMotionPath`), never asked: named outright, Jev was at chance.
 *
 * Exit 0 nothing fails, 1 a fail, 2 usage. Advisory: a model's reading of the pixels; the
 * deterministic motion checks (`check animation`, `check integrity --timeline`) are what to gate on.
 */
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { isCliEntry } from "@mizchi/vlmkit-core/plugin/cli-entry.ts";
import { handleCliError } from "@mizchi/vlmkit-core/cli-error.ts";
import { EASING_NAMES, type EasingName } from "@mizchi/vlmkit-judge/motion-path.ts";
import { parseFramesManifest, parseInstants } from "@mizchi/vlmkit-judge/frames.ts";
import type { MotionCheckReport } from "@mizchi/vlmkit-ai/motion-check.ts";

/**
 * Asked when no `--forbid` is given. Narrower than the claims round's "text overlapping other
 * text so that it is hard to read", which fired on an open dropdown over a page and on plants
 * covering text (10 of 36); this one caught every planted overlap (9/9) with none of those
 * (0/36), measured on screenshots it was not chosen on (`docs/reports/2026-10-18-jev-motion.md`).
 */
export const DEFAULT_MOTION_FORBID = "two lines of text printed on top of each other, their letters crossing";

export const MOTION_USAGE = `Usage: vlmkit inspect motion <page.html|url|frames.json> --target "<what moves>"... [--forbid "<statement>"]... [options]

Is an animation visually broken? The page's clock is held, the motion shot at
instants and once at rest, and each frame asked of TypeSafe Jev
(TYPESAFEAI_API_KEY) in one request: where the target is, whether it is shown,
whether each forbidden statement is. vlmkit judges the motion from that:

  target-lost      not shown between frames that show it (clipped, covered)
  absent-at-rest   shown in motion, gone once it stops (--exits: meant to)
  snap-back        back where it started once it stops (fill-mode missing)
  jump             one step far faster than its neighbours (keyframe gap)
  easing-mismatch  the path follows another easing than --expect-easing
  forbid           a statement seen at rest fails; only mid-motion, warns

  --target <words>        What moves, as you would point at it ("the blue Saved toast")
  --forbid <statement>    No frame may show it. Default, when none is given:
                          "${DEFAULT_MOTION_FORBID}"
  --no-forbid             Ask no statement (only the targets' motion)
  --expect-easing <name>  ${EASING_NAMES.join(" | ")}
  --exits                 The targets are meant to leave (gone at rest is their end)
  --at <instants>         Frames to shoot (default: 11 across the animations + rest)
  --start <ms> --end <ms> The motion's span, when --at is given or frames.json is read
  --viewport <WxH>        Default 1280x800
  --frames <dir>          Where the frames go (default test-results/inspect-motion)
  --threshold <0-1>       A statement is true at or above this (default 0.5)
  --json                  Print the report as JSON

Exit: 0 nothing fails, 1 a fail, 2 usage error. ~$0.00013 and ~0.2s per frame.
Advisory: gate on check animation / check integrity --timeline.
docs/reports/2026-10-18-jev-motion.md`;

export class MotionUsageError extends Error {}

export interface MotionCliOptions {
  source: string;
  targets: string[];
  forbid: string[];
  expectEasing?: EasingName;
  exits: boolean;
  at?: number[];
  startMs?: number;
  endMs?: number;
  viewport: { width: number; height: number };
  frames: string;
  threshold: number;
  json: boolean;
}

export function parseMotionArgs(argv: string[]): MotionCliOptions {
  const positional: string[] = [];
  const targets: string[] = [];
  const forbid: string[] = [];
  let expectEasing: EasingName | undefined;
  let at: number[] | undefined;
  let startMs: number | undefined;
  let endMs: number | undefined;
  let viewport = { width: 1280, height: 800 };
  let frames = "test-results/inspect-motion";
  let threshold = 0.5;
  let json = false;
  let exits = false;
  let noForbid = false;
  const value = (flag: string, v: string | undefined) => {
    if (v === undefined || v.startsWith("--")) throw new MotionUsageError(`${flag} needs a value`);
    return v;
  };
  const one = (flag: string, v: string) => {
    const xs = parseInstants(v, flag);
    if (xs.length !== 1) throw new MotionUsageError(`${flag} takes one time, got ${v}`);
    return xs[0]!;
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    switch (a) {
      case "--target":
      case "--forbid": {
        const s = value(a, argv[++i]).trim();
        if (!s) throw new MotionUsageError(`${a} needs words`);
        (a === "--target" ? targets : forbid).push(s);
        break;
      }
      case "--expect-easing": {
        const e = value(a, argv[++i]);
        if (!(EASING_NAMES as string[]).includes(e)) {
          throw new MotionUsageError(`--expect-easing takes ${EASING_NAMES.join(", ")}; got ${e}`);
        }
        expectEasing = e as EasingName;
        break;
      }
      case "--at":
        at = parseInstants(value(a, argv[++i]), a);
        break;
      case "--start":
        startMs = one(a, value(a, argv[++i]));
        break;
      case "--end":
        endMs = one(a, value(a, argv[++i]));
        break;
      case "--viewport": {
        const m = /^(\d+)x(\d+)$/.exec(value(a, argv[++i]));
        if (!m) throw new MotionUsageError(`--viewport takes WxH, got ${argv[i]}`);
        viewport = { width: Number(m[1]), height: Number(m[2]) };
        break;
      }
      case "--frames":
        frames = value(a, argv[++i]);
        break;
      case "--threshold": {
        const n = Number(value(a, argv[++i]));
        if (!Number.isFinite(n) || n <= 0 || n >= 1)
          throw new MotionUsageError(`--threshold takes 0-1, got ${argv[i]}`);
        threshold = n;
        break;
      }
      case "--json":
        json = true;
        break;
      case "--exits":
        exits = true;
        break;
      case "--no-forbid":
        noForbid = true;
        break;
      default:
        if (a.startsWith("--")) throw new MotionUsageError(`unknown option ${a}`);
        positional.push(a);
    }
  }
  if (positional.length !== 1) {
    throw new MotionUsageError(
      `expected one page, URL or frames.json, got ${positional.length}${positional.length > 1 ? ' (quote each description: --target "the blue square")' : ""}`,
    );
  }
  if (noForbid && forbid.length > 0) throw new MotionUsageError("--no-forbid with --forbid: pick one");
  if (!noForbid && forbid.length === 0) forbid.push(DEFAULT_MOTION_FORBID);
  if (targets.length === 0 && noForbid)
    throw new MotionUsageError("nothing to check: give --target, or drop --no-forbid");
  if (expectEasing && targets.length === 0) throw new MotionUsageError("--expect-easing needs a --target to follow");
  const fromFrames = /(^|\/)frames\.json$/.test(positional[0]!);
  if ((fromFrames || at) && endMs === undefined) {
    throw new MotionUsageError(
      `${fromFrames ? "frames.json" : "--at"} needs --end <ms>: where the motion stops, so the frames after it are its rest`,
    );
  }
  return {
    source: positional[0]!,
    targets,
    forbid,
    ...(expectEasing ? { expectEasing } : {}),
    exits,
    ...(at ? { at } : {}),
    ...(startMs !== undefined ? { startMs } : {}),
    ...(endMs !== undefined ? { endMs } : {}),
    viewport,
    frames,
    threshold,
    json,
  };
}

/** 11 instants from the first animation's start to just inside the last one's end, then rest. */
export function motionInstants(startMs: number, endMs: number): { motion: number[]; rest: number } {
  const span = endMs - startMs;
  const motion = Array.from({ length: 11 }, (_, i) => (i === 10 ? endMs - 1 : startMs + Math.round((span * i) / 10)));
  return { motion: [...new Set(motion)].filter((t) => t >= startMs), rest: endMs + 300 };
}

interface Captured {
  frames: { atMs: number; png: Uint8Array }[];
  startMs: number;
  endMs: number;
  manifest: string;
}

async function captureMotion(o: MotionCliOptions): Promise<Captured> {
  const { withBrowser } = await import("@mizchi/vlmkit-core/browser-launch.ts");
  const { sourceToUrl } = await import("@mizchi/vlmkit-core/page-open.ts");
  const { openHeldTimeline, captureStable, frameWriter, frameSourceFacts } =
    await import("@mizchi/vlmkit-animation-eval/frames-capture.ts");
  const url = sourceToUrl(o.source);
  return withBrowser(async (browser) => {
    const page = await browser.newPage({ viewport: o.viewport, deviceScaleFactor: 1 });
    try {
      const timeline = await openHeldTimeline(page, url);
      const finite = (await timeline.animations()).filter((a) => a.iterations !== null && a.durationMs > 0);
      let startMs = o.startMs;
      let endMs = o.endMs;
      if (endMs === undefined) {
        if (finite.length === 0) {
          throw new MotionUsageError(
            "no finite animation on the page to sample: give --at and --end (an infinite one never rests)",
          );
        }
        endMs = Math.max(...finite.map((a) => a.startMs + a.durationMs * (a.iterations ?? 1)));
      }
      startMs ??= finite.length > 0 ? Math.min(...finite.map((a) => a.startMs)) : 0;
      const { motion, rest } = motionInstants(startMs, endMs);
      const instants = o.at ? [...new Set(o.at)].sort((a, b) => a - b) : [...motion, rest];
      const writer = await frameWriter(resolve(o.frames), {
        tool: "inspect motion",
        url,
        viewport: o.viewport,
        ...(await frameSourceFacts(page)),
        clock: "held",
      });
      const frames: Captured["frames"] = [];
      for (const atMs of instants) {
        await timeline.at(atMs);
        const { png, stable } = await captureStable(page);
        await writer.add(png, { atMs, stable, ...(atMs > endMs ? { label: "rest" } : {}) });
        frames.push({ atMs, png: new Uint8Array(png) });
      }
      const written = await writer.finish();
      return { frames, startMs, endMs, manifest: written.manifest };
    } finally {
      await page.close();
    }
  });
}

async function readFrames(o: MotionCliOptions): Promise<Captured> {
  const path = resolve(o.source);
  const manifest = parseFramesManifest(await readFile(path, "utf-8"));
  const frames = await Promise.all(
    manifest.frames.map(async (f) => ({
      atMs: f.atMs,
      png: new Uint8Array(await readFile(join(dirname(path), f.file))),
    })),
  );
  return { frames, startMs: o.startMs ?? frames[0]?.atMs ?? 0, endMs: o.endMs!, manifest: path };
}

export function formatMotionReport(
  source: string,
  captured: Captured,
  r: MotionCheckReport,
  forbid: readonly string[] = [],
): string {
  const lines: string[] = [];
  const restCount = captured.frames.filter((f) => f.atMs > captured.endMs).length;
  lines.push(
    `inspect motion: ${source} — ${captured.frames.length - restCount} frames over ${Math.round(captured.startMs)}..${Math.round(captured.endMs)}ms + ${restCount} at rest (${captured.manifest})`,
  );
  let fails = 0;
  let warns = 0;
  for (const t of r.targets) {
    const broken = t.findings.some((f) => f.rule === "jump" || f.rule === "snap-back");
    let fit: string;
    if (!("best" in t.easing)) fit = `no easing fit: ${t.easing.skipped}`;
    else if (broken) fit = "no easing named: the path has a jump, so no curve describes it";
    else {
      const errors = t.easing.errors;
      const next = Object.keys(errors)
        .filter((k) => k !== (t.easing as { best: string }).best)
        .sort((a, b) => errors[a as keyof typeof errors] - errors[b as keyof typeof errors])[0];
      fit = `follows ${t.easing.best} (it fits ${t.easing.margin.toFixed(1)}x better than the next-best curve, ${next})`;
    }
    lines.push(`  target ${JSON.stringify(t.target)}: travels ${Math.round(t.travelPx)}px, ${fit}`);
    for (const f of t.findings) {
      if (f.severity === "fail") fails++;
      else warns++;
      lines.push(`    ${f.severity === "fail" ? "FAIL" : "warn"} ${f.rule} at ${Math.round(f.atMs)}ms: ${f.message}`);
    }
  }
  for (const f of r.forbidden) {
    if (f.severity === "fail") fails++;
    else warns++;
    const seen = f.frames
      .map((x) => `${Math.round(x.atMs)}ms ${x.noul.toFixed(2)}${x.uncertain ? "?" : ""}`)
      .join(", ");
    lines.push(
      `  ${f.severity === "fail" ? "FAIL" : "warn"} forbid ${JSON.stringify(f.statement)}: seen ${f.atRest ? "at rest" : "mid-motion only"} (${seen})`,
    );
  }
  for (const statement of forbid) {
    if (!r.forbidden.some((f) => f.statement === statement)) {
      lines.push(`  ok   forbid ${JSON.stringify(statement)}: not seen in any frame`);
    }
  }
  lines.push(
    `  ${fails === 0 ? "no fail" : `${fails} fail`}${warns ? `, ${warns} warn` : ""}; ${r.model}, ${r.calls} requests, $${r.costUsd.toFixed(5)} — a model's reading of the pixels, not a measurement`,
  );
  lines.push(
    `  look at the frames: vlmkit snapshot strip --manifest ${captured.manifest} --max-frames 6 --columns 3 --out ${join(dirname(captured.manifest), "strip.png")}`,
  );
  return lines.join("\n");
}

export async function runMotionCli(argv: string[]): Promise<number> {
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(MOTION_USAGE);
    return 0;
  }
  let o: MotionCliOptions;
  try {
    o = parseMotionArgs(argv);
  } catch (e) {
    if (!(e instanceof MotionUsageError) && !(e instanceof Error && e.name === "UsageError")) throw e;
    console.error(`error: ${(e as Error).message}\n\n${MOTION_USAGE}`);
    return 2;
  }
  // Refused before a browser starts: without a key nothing could answer.
  if (!process.env.TYPESAFEAI_API_KEY && !process.env.TYPESAFE_API_KEY) {
    console.error("error: inspect motion asks TypeSafe Jev and needs TYPESAFEAI_API_KEY (console.typesafe.ai/keys).");
    return 2;
  }
  let captured: Captured;
  try {
    captured = /(^|\/)frames\.json$/.test(o.source) ? await readFrames(o) : await captureMotion(o);
  } catch (e) {
    if (!(e instanceof MotionUsageError)) throw e;
    console.error(`error: ${e.message}`);
    return 2;
  }
  const { checkMotionFrames } = await import("@mizchi/vlmkit-ai/motion-check.ts");
  const r = await checkMotionFrames(captured.frames, {
    targets: o.targets,
    forbid: o.forbid,
    startMs: captured.startMs,
    endMs: captured.endMs,
    threshold: o.threshold,
    exits: o.exits,
    ...(o.expectEasing ? { expectEasing: o.expectEasing } : {}),
  });
  if (o.json) {
    console.log(
      JSON.stringify(
        {
          source: o.source,
          frames: captured.manifest,
          startMs: captured.startMs,
          endMs: captured.endMs,
          passed: r.passed,
          targets: r.targets,
          forbidden: r.forbidden,
          answers: r.frames,
          model: r.model,
          costUsd: r.costUsd,
        },
        null,
        2,
      ),
    );
  } else {
    console.log(formatMotionReport(o.source, captured, r, o.forbid));
  }
  return r.passed ? 0 : 1;
}

if (isCliEntry(import.meta.url, "motion")) {
  runMotionCli(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch(handleCliError);
}
