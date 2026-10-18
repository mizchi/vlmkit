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
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { isCliEntry } from "@mizchi/vlmkit-core/plugin/cli-entry.ts";
import { handleCliError } from "@mizchi/vlmkit-core/cli-error.ts";
import { EASING_NAMES, type EasingName } from "@mizchi/vlmkit-judge/motion-path.ts";
import { parseFramesManifest, parseInstants } from "@mizchi/vlmkit-judge/frames.ts";
import type { MotionCheckReport, MotionDom, MotionFrame } from "@mizchi/vlmkit-ai/motion-check.ts";

/** Each selector's element as rendered: border box, opacity through its ancestors, transform scale. */
export async function measureTargets(
  page: import("playwright").Page,
  selectors: readonly string[],
): Promise<(MotionDom | null)[]> {
  return page.evaluate(
    (sels) =>
      sels.map((sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        let opacity = getComputedStyle(el).visibility === "hidden" ? 0 : 1;
        for (let n: Element | null = el; n; n = n.parentElement) opacity *= Number(getComputedStyle(n).opacity);
        const transform = getComputedStyle(el).transform;
        let scale = 1;
        if (transform && transform !== "none") {
          const m = new DOMMatrixReadOnly(transform);
          scale = Math.hypot(m.a, m.b);
        }
        // The element's own animation time (its delay and duration, not the page's): the longest
        // one running on it, as a 0-1 fraction of one iteration. Null when nothing animates it.
        let t: number | null = null;
        let longest = 0;
        for (const a of el.getAnimations()) {
          const c = a.effect?.getComputedTiming();
          const d = Number(c?.duration);
          if (!c || !Number.isFinite(d) || d <= longest || c.localTime === null) continue;
          longest = d;
          const local = Number(c.localTime) - Number(c.delay ?? 0);
          t = Math.min(1, Math.max(0, local / d));
        }
        return { box: { x: r.x, y: r.y, width: r.width, height: r.height }, opacity, scale, t };
      }),
    selectors,
  );
}

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
  absent-at-rest   shown in motion, gone once it stops (unless --exits says it leaves)
  snap-back        back where it started once it stops (fill-mode missing)
  jump             one step far faster than its neighbours (keyframe gap)
  easing-mismatch  the path follows another easing than --expect-easing
  target-static    shown and still from the first frame (warn: not animating?)
  forbid           a statement seen at rest fails; only mid-motion, warns

Frames: each span some finite animation runs in is a segment (an entrance, and
after a hold an exit, are two), shot 11 times from its start to just inside its
end (fewer each past 5 segments, 60 at most), plus one frame at rest 300ms after
the last. Easings are fitted, and jumps looked for, inside one segment. Positions
come from frames that surely show the target (presence 0.8+); a box cut by the
viewport's edge is put back from the target's own size. So "travels" is the
measured part of the path and can be shorter than the CSS distance; under 60px
an easing is not fitted, and an --expect-easing there is a warn, not a pass.

  --target <words>        What moves, as you would point at it ("the blue Saved toast")
  --selector <css>        The element the --target in the same position names (repeat in order):
                          its position, opacity and scale are measured from the page, exact,
                          and Jev only says whether it can be seen. Use it whenever the page is
                          yours: look-alike elements (three cards) make a model box the wrong one
  --forbid <statement>    No frame may show it. Default, when none is given:
                          "${DEFAULT_MOTION_FORBID}"
  --no-forbid             Ask no statement (only the targets' motion)
  --expect-easing <name>  ${EASING_NAMES.join(" | ")}; one per segment, comma-separated
                          ("ease-out,ease-in" for an entrance and an exit), or one for all
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
  selectors: string[];
  forbid: string[];
  expectEasing?: EasingName[];
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
  const selectors: string[] = [];
  const forbid: string[] = [];
  let expectEasing: EasingName[] | undefined;
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
        const names = value(a, argv[++i])
          .split(",")
          .map((x) => x.trim());
        const bad = names.filter((e) => !(EASING_NAMES as string[]).includes(e));
        if (bad.length > 0 || names.length === 0) {
          throw new MotionUsageError(
            `--expect-easing takes ${EASING_NAMES.join(", ")} (comma-separated per segment); got ${bad.join(", ")}`,
          );
        }
        expectEasing = names as EasingName[];
        break;
      }
      case "--selector":
        selectors.push(value(a, argv[++i]).trim());
        break;
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
  if (selectors.length > targets.length) {
    throw new MotionUsageError(
      `${selectors.length} --selector for ${targets.length} --target: each selector names the target given in the same position`,
    );
  }
  if (selectors.length > 0 && fromFrames)
    throw new MotionUsageError("--selector measures a live page: give the page, not frames.json");
  if ((fromFrames || at) && endMs === undefined) {
    throw new MotionUsageError(
      `${fromFrames ? "frames.json" : "--at"} needs --end <ms>: where the motion stops, so the frames after it are its rest`,
    );
  }
  return {
    source: positional[0]!,
    targets,
    selectors,
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

/** `n` instants from `startMs` to just inside `endMs` (an instant at the end is already past it), then rest. */
export function motionInstants(startMs: number, endMs: number, n = 11): { motion: number[]; rest: number } {
  const span = endMs - startMs;
  const motion = Array.from({ length: n }, (_, i) =>
    i === n - 1 ? endMs - 1 : startMs + Math.round((span * i) / (n - 1)),
  );
  return { motion: [...new Set(motion)].filter((t) => t >= startMs), rest: endMs + 300 };
}

/** Frames this many at most, across every segment. */
export const MOTION_MAX_FRAMES = 60;

/**
 * The spans the page's finite animations run in, overlapping ones merged (an entrance, then after
 * a hold an exit, are two), and instants across each: 11 per segment, fewer when there are many
 * (at least 5), so a 600ms entrance beside a 2s hold is not sampled by 2 of 11 frames.
 */
export function motionPlan(animations: readonly { startMs: number; durationMs: number; iterations: number | null }[]) {
  const spans = animations
    .filter((a) => a.iterations !== null && a.durationMs > 0)
    .map((a) => ({ startMs: a.startMs, endMs: a.startMs + a.durationMs * (a.iterations ?? 1) }))
    .sort((a, b) => a.startMs - b.startMs);
  const segments: { startMs: number; endMs: number }[] = [];
  for (const s of spans) {
    const last = segments[segments.length - 1];
    if (last && s.startMs <= last.endMs) last.endMs = Math.max(last.endMs, s.endMs);
    else segments.push({ ...s });
  }
  const per = Math.max(5, Math.min(11, Math.floor(MOTION_MAX_FRAMES / Math.max(1, segments.length))));
  const motion = [...new Set(segments.flatMap((g) => motionInstants(g.startMs, g.endMs, per).motion))].sort(
    (a, b) => a - b,
  );
  const endMs = Math.max(...segments.map((g) => g.endMs));
  return { segments, motion, rest: endMs + 300, startMs: segments[0]?.startMs ?? 0, endMs };
}

interface Captured {
  frames: MotionFrame[];
  startMs: number;
  endMs: number;
  segments: { startMs: number; endMs: number }[];
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
      const plan = motionPlan(await timeline.animations());
      if (o.endMs === undefined && plan.segments.length === 0) {
        throw new MotionUsageError(
          "no finite animation on the page to sample: give --at and --end (an infinite one never rests)",
        );
      }
      const given = o.endMs !== undefined;
      const endMs = o.endMs ?? plan.endMs;
      const startMs = o.startMs ?? (given ? 0 : plan.startMs);
      const segments = given ? [{ startMs, endMs }] : plan.segments;
      const instants = o.at
        ? [...new Set(o.at)].sort((a, b) => a - b)
        : given
          ? (() => {
              const m = motionInstants(startMs, endMs);
              return [...m.motion, m.rest];
            })()
          : [...plan.motion, plan.rest];
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
        const frame: MotionFrame = { atMs, png: new Uint8Array(png) };
        if (o.selectors.length > 0) {
          const dom = await measureTargets(page, o.selectors);
          const missing = o.selectors.filter((_, i) => dom[i] === null);
          if (frames.length === 0 && missing.length > 0) {
            throw new MotionUsageError(`--selector matches nothing on the page: ${missing.join(", ")}`);
          }
          frame.dom = [...dom, ...o.targets.slice(o.selectors.length).map(() => null)];
        }
        frames.push(frame);
      }
      const written = await writer.finish();
      return { frames, startMs, endMs, segments, manifest: written.manifest };
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
  const startMs = o.startMs ?? frames[0]?.atMs ?? 0;
  return { frames, startMs, endMs: o.endMs!, segments: [{ startMs, endMs: o.endMs! }], manifest: path };
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
  const fitText = (e: MotionCheckReport["targets"][number]["easing"], broken: boolean) => {
    if (!("best" in e)) return `no easing fit: ${e.skipped}`;
    if (broken) return "no easing named: the path has a jump, so no curve describes it";
    const next = Object.keys(e.errors)
      .filter((k) => k !== e.best)
      .sort((a, b) => e.errors[a as keyof typeof e.errors] - e.errors[b as keyof typeof e.errors])[0];
    const on = e.channel && e.channel !== "position" ? ` in its ${e.channel}` : "";
    if (e.margin >= 1000) return `follows ${e.best}${on} exactly (measured: no other curve comes close)`;
    return `follows ${e.best}${on} (it fits ${e.margin.toFixed(1)}x better than the next-best curve, ${next})`;
  };
  for (const [i, t] of r.targets.entries()) {
    const broken = t.findings.some((f) => f.rule === "jump" || f.rule === "snap-back");
    if (t.segments.length <= 1) {
      lines.push(
        `  target ${JSON.stringify(t.target)}: travels ${Math.round(t.travelPx)}px, ${fitText(t.easing, broken)}`,
      );
    } else {
      lines.push(`  target ${JSON.stringify(t.target)}: ${t.segments.length} segments`);
      for (const g of t.segments) {
        lines.push(
          `    ${Math.round(g.startMs)}..${Math.round(g.endMs)}ms: travels ${Math.round(g.travelPx)}px, ${fitText(g.easing, broken)}`,
        );
      }
    }
    // What was read per frame: presence, and the position judged (· = not shown, ~ = put back from the edge).
    const pos = new Map(t.path.map((p) => [p.atMs, p]));
    lines.push(
      `    frames: ${r.frames
        .map((f) => {
          const p = pos.get(f.atMs);
          const pr = f.targets[i]!.present.toFixed(2);
          return `${Math.round(f.atMs)}ms ${pr}${p ? ` (${Math.round(p.x)},${Math.round(p.y)})${p.edge ? "~" : ""}` : " ·"}`;
        })
        .join(", ")}`,
    );
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
      `  ${f.severity === "fail" ? "FAIL" : "warn"} forbid ${JSON.stringify(f.statement)}: seen ${f.atRest ? "at rest" : "mid-motion only"} (${seen}${f.frames.some((x) => x.uncertain) ? "; ? = within 0.3 of the threshold, look at that frame" : ""})`,
    );
  }
  for (const statement of forbid) {
    if (!r.forbidden.some((f) => f.statement === statement)) {
      lines.push(`  ok   forbid ${JSON.stringify(statement)}: not seen in any frame`);
    }
  }
  lines.push(
    `  ${fails === 0 ? "no fail" : `${fails} fail`}${warns ? `, ${warns} warn` : ""}; ${r.model}, ${r.calls} requests, $${r.costUsd.toFixed(5)} — ${captured.frames[0]?.dom?.some(Boolean) ? "positions measured from the page; whether it can be seen, and the statements, are a model's reading" : "a model's reading of the pixels, not a measurement"}`,
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
    segments: captured.segments,
    threshold: o.threshold,
    exits: o.exits,
    ...(o.expectEasing ? { expectEasing: o.expectEasing.length === 1 ? o.expectEasing[0]! : o.expectEasing } : {}),
  });
  const json = {
    source: o.source,
    frames: captured.manifest,
    startMs: captured.startMs,
    endMs: captured.endMs,
    segments: captured.segments,
    passed: r.passed,
    targets: r.targets,
    forbidden: r.forbidden,
    answers: r.frames,
    model: r.model,
    costUsd: r.costUsd,
  };
  // Kept beside the frames: reading the verdict again must not ask the model again.
  const saved = join(dirname(captured.manifest), "motion-report.json");
  await writeFile(saved, `${JSON.stringify(json, null, 2)}\n`);
  if (o.json) console.log(JSON.stringify(json, null, 2));
  else console.log(`${formatMotionReport(o.source, captured, r, o.forbid)}\n  report: ${saved}`);
  return r.passed ? 0 : 1;
}

if (isCliEntry(import.meta.url, "motion")) {
  runMotionCli(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch(handleCliError);
}
