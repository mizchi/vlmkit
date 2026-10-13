/**
 * `check flash` as a gate: WCAG 2.3.1 Three Flashes or Below Threshold over a page's own time, or
 * over a saved `frames.json`. Measurement in `../inspect/flash-check.ts`; the arithmetic is the
 * pure `@mizchi/vlmkit-judge/flash.ts` and `flash-motion.ts`.
 */
import { PAGE_LOAD_INPUTS, PAGE_LOAD_VALUE_FLAGS, parsePageLoad } from "@mizchi/vlmkit-core/page-load.ts";
import { defineGate, type Finding } from "@mizchi/vlmkit-core/plugin/contract.ts";
import { readFlag } from "@mizchi/vlmkit-core/arg-reader.ts";
import { firstPositional, viewportFlag } from "@mizchi/vlmkit-core/plugin/args.ts";
import { UsageError } from "@mizchi/vlmkit-core/cli-error.ts";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { parseInstants } from "@mizchi/vlmkit-judge/frames.ts";
import { isVideoFile, MAX_SCAN_FRAMES } from "@mizchi/vlmkit-core/video-decode.ts";
import { COLOR_MATRICES, type SelectionRequest } from "@mizchi/vlmkit-core/video-frames.ts";

const isFramesDir = (source: string): boolean => {
  try {
    return statSync(source).isDirectory() && existsSync(join(source, "frames.json"));
  } catch {
    return false;
  }
};
import {
  flashHeadline,
  flashRate,
  formatFlashReport,
  runFlashCheck,
  type FlashCheckOptions,
  type FlashReport,
  type FlashTrackReport,
} from "../inspect/flash-check.ts";

const where = (t: FlashTrackReport) => {
  const w = t.worst!;
  const on = (t.animations ?? []).map((a) => `${a.path}${a.name ? ` (${a.name}: ${a.properties.join(", ")})` : ""}`);
  return (
    `${w.transitions} transitions (${flashRate(w.transitions)} flashes) in ${(w.fromMs / 1000).toFixed(3)}–${(w.toMs / 1000).toFixed(3)}s` +
    ` over ${w.areaCss2.toLocaleString("en-US")} CSS px², ${Math.round(w.fieldShare * 1000) / 10}% of the 341x256 field at (${w.field.x},${w.field.y});` +
    ` limit 21,824 (25%)${w.knifeEdge ? "; knife edge: one frame either way decides it" : ""}${on.length ? `; over it: ${on.join("; ")}` : ""}`
  );
};

/** The finding's selector: the element covering at least half of the flashing pixels' box, if one does. */
const selectorOf = (t: FlashTrackReport): { selector?: string } => {
  const top = (t.animations ?? []).find((a) => a.cover >= 0.5);
  return top ? { selector: top.path } : {};
};

const UNMEASURED: Record<string, string> = {
  video: "<video> paused (its file can be judged: vlmkit check flash <file>)",
  "animated-image": "animated image (its file can be judged: vlmkit check flash <file>.gif)",
  "unreadable-image": "image whose bytes could not be read (it may animate)",
  uncontrolled: "pixels changing with the clock held",
};

function findings(report: FlashReport): Finding[] {
  const out: Finding[] = [];
  for (const [track, rule, label] of [
    ["general", "general-flash", "luminance"],
    ["red", "red-flash", "saturated-red"],
  ] as const) {
    const t = report[track];
    if (t.verdict === "fail" && t.worst) {
      const nearLimit = report.lossy?.some((n) => n.startsWith(`${track}:`));
      out.push({
        rule,
        severity: "suspect",
        message: `${label} flashing: ${where(t)}${nearLimit ? "; a lossy or subsampled recording within 5% of the limit: not decisive" : ""}`,
        ...selectorOf(t),
        evidence: { track, worst: t.worst, reason: t.reason, motion: t.motion, animations: t.animations },
      });
    } else if (t.classification === "motion" && t.worst) {
      const v = t.motion?.find((m) => m.velocity)?.velocity;
      out.push({
        rule: "motion-flicker",
        severity: "warn",
        message: `${label} flicker that motion explains${v ? ` (moving ${Math.round(Math.hypot(v.x, v.y))} px/s)` : ""}: ${where(t)}`,
        ...selectorOf(t),
        evidence: { track, worst: t.worst, motion: t.motion, animations: t.animations },
      });
    }
  }
  const s = report.sampling;
  if (!s.judgeable) {
    out.push({
      rule: "flash-unjudgeable",
      severity: "suspect",
      message: `no one-second window holds the 7 frames a failure needs (${s.frames} frames, largest gap ${s.maxGapMs.toFixed(1)}ms): nothing can be said either way`,
    });
  } else if (!s.complete && report.general.verdict === "pass" && report.red.verdict === "pass") {
    out.push({
      rule: "flash-undersampled",
      severity: "warn",
      message: s.partial
        ? `pass on part of a recording: ${s.partial}, so the pass is not backed`
        : `pass on an incomplete sequence (largest gap ${s.maxGapMs.toFixed(1)}ms${s.unstableFrames ? `, ${s.unstableFrames} unstable frame(s)` : ""}): a state shorter than the gap can be missed, so the pass is not backed`,
    });
  } else if (s.truncated && report.general.verdict === "pass" && report.red.verdict === "pass") {
    out.push({
      rule: "flash-undersampled",
      severity: "warn",
      message: `pass on the first ${(s.windowMs / 1000).toFixed(1)}s only: the page's motion runs past the 10s cap, and what comes after it was not swept (--window up to 60s sweeps more)`,
    });
  }
  const limit = report.criteria.areaLimitCss2;
  // Over the limit alone, or together with the flashing beside it: either way no pass is possible.
  const together = Math.max(report.general.withUnknownCss2 ?? 0, report.red.withUnknownCss2 ?? 0);
  for (const u of report.unmeasured) {
    const large = report.unmeasuredAreaCss2 > limit || together > limit;
    out.push({
      rule: "flash-unmeasured",
      severity: large ? "suspect" : "info",
      message: `${UNMEASURED[u.reason] ?? u.reason}, ${u.rect.width}x${u.rect.height} at (${u.rect.x},${u.rect.y}): not judged${large ? (report.unmeasuredAreaCss2 > limit ? `; ${report.unmeasuredAreaCss2.toLocaleString("en-US")} CSS px² of one field unmeasured, over the 21,824 limit, so no pass is possible` : `; with the flashing beside it, ${together.toLocaleString("en-US")} CSS px² of one field, over the 21,824 limit, so no pass is possible`) : ""}`,
      ...(u.path ? { selector: u.path } : {}),
      evidence: { ...u },
    });
  }
  return out;
}

/** One time in the frames' grammar (1500, 1.5s, 00:01.500). */
function oneTime(argv: readonly string[], flag: string): number | undefined {
  const raw = readFlag(argv, flag);
  if (raw === undefined) return undefined;
  const parsed = parseInstants(raw, `--${flag}`);
  if (parsed.length !== 1) throw new UsageError(`--${flag} takes one time, e.g. --${flag} 1.5s`);
  return parsed[0]!;
}

function wholeFlag(
  argv: readonly string[],
  flag: string,
  min: number,
  max = Number.MAX_SAFE_INTEGER,
): number | undefined {
  const raw = readFlag(argv, flag);
  if (raw === undefined) return undefined;
  if (!/^\d+$/.test(raw) || Number(raw) < min || Number(raw) > max) {
    throw new UsageError(
      `--${flag} expects a whole number from ${min}${max < Number.MAX_SAFE_INTEGER ? ` to ${max}` : ""}, got "${raw}"`,
    );
  }
  return Number(raw);
}

/** The recording flags, or undefined when none is given. */
function videoFlags(argv: readonly string[]): FlashCheckOptions["video"] | undefined {
  const from = oneTime(argv, "from");
  const to = oneTime(argv, "to");
  if (from !== undefined && to !== undefined && to < from) throw new UsageError("--to is before --from");
  const displayWidth = wholeFlag(argv, "display-width", 1);
  const maxFrames = wholeFlag(argv, "max-frames", 1, MAX_SCAN_FRAMES);
  const stream = wholeFlag(argv, "stream", 0);
  const ffmpeg = readFlag(argv, "ffmpeg");
  const ffprobe = readFlag(argv, "ffprobe");
  const colorMatrix = readFlag(argv, "color-matrix");
  if (colorMatrix !== undefined && !COLOR_MATRICES.includes(colorMatrix)) {
    throw new UsageError(`--color-matrix is one of ${COLOR_MATRICES.join(", ")} (got ${colorMatrix})`);
  }
  const background = readFlag(argv, "background");
  if (background !== undefined && background !== "white" && background !== "black") {
    throw new UsageError(`--background is white or black, got ${background}`);
  }
  const colorRange = readFlag(argv, "color-range");
  if (colorRange !== undefined && colorRange !== "tv" && colorRange !== "pc") {
    throw new UsageError(`--color-range is tv (limited) or pc (full), got ${colorRange}`);
  }
  // No --to is to the end: a video's last frame, a looping image's first pass and a second past --from.
  const selection: SelectionRequest | undefined =
    from !== undefined || to !== undefined
      ? { kind: "span", fromMs: from ?? 0, ...(to !== undefined ? { toMs: to } : {}) }
      : undefined;
  const out = {
    ...(selection ? { selection } : {}),
    ...(displayWidth !== undefined ? { displayWidth } : {}),
    ...(maxFrames !== undefined ? { maxFrames } : {}),
    ...(stream !== undefined ? { stream } : {}),
    ...(ffmpeg !== undefined ? { ffmpeg } : {}),
    ...(ffprobe !== undefined ? { ffprobe } : {}),
    ...(colorMatrix !== undefined ? { colorMatrix } : {}),
    ...(colorRange !== undefined ? { colorRange: colorRange as "tv" | "pc" } : {}),
    ...(background !== undefined ? { background: background as "white" | "black" } : {}),
  };
  return Object.keys(out).length > 0 ? out : undefined;
}

export const flashGate = defineGate<FlashReport, FlashCheckOptions>({
  id: "check.flash",
  command: ["check", "flash"],
  title: "WCAG 2.3.1 flashing, over the page's own time",
  summary: "WCAG 2.3.1 Three Flashes: per-pixel transitions at every 60fps frame of page time, motion told apart",
  category: "behavior",
  usage: `WCAG 2.3.1 Three Flashes or Below Threshold, measured.

The page is loaded with its clock held (requestAnimationFrame, timers, Date and
every animation) and shot at every 60fps frame of a window of its own time —
the frames a 60Hz display presents. At each pixel, relative luminance moving
0.1 or more between a peak and a valley with the darker state below 0.80 is a
transition, and so is a move of more than 0.2 in u′v′ to or from a saturated
red. More than six transitions in any second, (t − 1s, t], is more than three
flashes. That over more than 21,824 CSS px² (25% of a 341x256 field, G176)
inside any field is a failure.

Per-pixel counting is literal, and every moving high-contrast detail flickers at
each pixel it crosses, so a failing stretch is re-counted with motion
compensated: what a block match reproduces is not counted. Flicker motion
explains is \`motion-flicker\` (warn); a field whose mean colour strobes is a
flash whatever moves in front of it.

A \`<video>\` is paused, an animated image (an \`<img>\`, a CSS background, a
mask, a pseudo-element's content) runs on the browser's own clock, an image whose
bytes cannot be read may animate, and pixels that change between two shots of
one held instant are not judged: they are reported, and when they — alone, or
with what flashes beside them — cover more than the limit in one field, the
verdict is "not judgeable", never a pass.

A recording (mp4, webm, mov, mkv, gif, …) is decoded with YOUR ffmpeg and
ffprobe (vlmkit ships no decoder; --ffmpeg or VLMKIT_FFMPEG point at them) and
every frame it holds is judged at its own presentation time — the same as
\`vlmkit scan video\` then \`check flash <dir>/frames.json\`. Its area is in CSS
px: one frame pixel per CSS px unless \`--display-width px\` says how wide it
plays; \`--from\` / \`--to\` judge the windows ending in a span, counted from the 3s
before it (no \`--to\` is to the end).

\`--window ms\` (default from the page's animations and timers, 2-10s; 1-60s when
given) sets the span swept;
\`--frames dir\` keeps the frames and their vlmkit-frames/1 manifest, and
\`check flash dir/frames.json\` judges them again with no browser. \`--strip
out.png\` writes ONE still image of the worst window — never an animation: a
flipbook of a failing window is itself a strobe for whoever opens it.

A pass is "no flash measured under these criteria", not a certification.`,
  rules: [
    {
      id: "general-flash",
      title: "More than three luminance flashes a second over more than 25% of a field",
      severity: "suspect",
    },
    {
      id: "red-flash",
      title: "More than three saturated-red flashes a second over more than 25% of a field",
      severity: "suspect",
    },
    {
      id: "motion-flicker",
      title: "Per-pixel flicker over the limit that motion explains",
      severity: "warn",
      docs: "Scrolling text or a sliding carousel flickers at every pixel it crosses; an eye that tracks it sees no flash. Set it to suspect to treat that as a failure.",
    },
    {
      id: "flash-unmeasured",
      title: "Media or pixels the held clock cannot hold",
      severity: "suspect",
      docs: "suspect when they cover more than the limit in one field (no pass is possible), info otherwise.",
    },
    {
      id: "flash-unjudgeable",
      title: "No one-second window holds the 7 frames a failure needs",
      severity: "suspect",
    },
    {
      id: "flash-undersampled",
      title: "A pass on a sequence that is missing frames",
      severity: "warn",
      docs: "Sampling can only remove transitions, so a failure on it stands; its pass does not.",
    },
  ],
  inputs: [
    {
      name: "source",
      placeholder: "html-or-url-or-frames.json-or-video",
      kind: "path-or-url",
      description: "Page to check, a frames.json (vlmkit-frames/1) to judge again, or a recording",
      positional: 0,
      required: true,
    },
    { name: "viewport", placeholder: "WxH", kind: "string", description: "Viewport", defaultDescription: "1280x720" },
    {
      name: "window",
      placeholder: "ms",
      kind: "string",
      description: "Page time to sweep (ms; also 2.5s)",
      defaultDescription: "each finite animation's end, 3s for what repeats or runs by script; 2s to 10s",
    },
    {
      name: "frames",
      placeholder: "dir",
      kind: "path",
      description: "Keep every frame as PNGs + frames.json (vlmkit-frames/1)",
    },
    {
      name: "strip",
      placeholder: "file.png",
      kind: "path",
      description: "One still image of the worst window's transitions, cropped to its field",
    },
    {
      name: "display-width",
      placeholder: "px",
      kind: "string",
      description: "Recording: the width it plays at, in CSS px",
      defaultDescription: "one frame pixel per CSS px",
    },
    { name: "from", placeholder: "t", kind: "string", description: "Recording: judge from this time (1.5s, 1500)" },
    { name: "to", placeholder: "t", kind: "string", description: "Recording: judge up to this time" },
    {
      name: "max-frames",
      placeholder: "n",
      kind: "string",
      description: "Recording: refuse more frames than this",
      defaultDescription: "3600",
    },
    { name: "stream", placeholder: "index", kind: "string", description: "Recording: which video stream" },
    {
      name: "color-matrix",
      placeholder: "m",
      kind: "string",
      description: "Recording: the YUV matrix (bt601, bt709, bt2020, …)",
      defaultDescription: "the stream's tag, else bt601",
    },
    {
      name: "background",
      placeholder: "white|black",
      kind: "string",
      description: "Recording: what transparent pixels are composited over",
      defaultDescription: "white",
    },
    {
      name: "color-range",
      placeholder: "tv|pc",
      kind: "string",
      description: "Recording: limited (tv) or full (pc) range",
      defaultDescription: "the stream's tag, else tv",
    },
    {
      name: "ffmpeg",
      placeholder: "path",
      kind: "path",
      description: "Recording: your ffmpeg",
      defaultDescription: "VLMKIT_FFMPEG, else ffmpeg on PATH",
    },
    {
      name: "ffprobe",
      placeholder: "path",
      kind: "path",
      description: "Recording: your ffprobe",
      defaultDescription: "VLMKIT_FFPROBE, else beside --ffmpeg, else on PATH",
    },
    ...PAGE_LOAD_INPUTS,
  ],
  parse: (argv) => {
    const source = firstPositional(argv, "vlmkit check flash <html-or-url | frames.json | recording>", [
      "--window",
      "--frames",
      "--strip",
      "--display-width",
      "--from",
      "--to",
      "--max-frames",
      "--stream",
      "--ffmpeg",
      "--ffprobe",
      "--color-matrix",
      "--color-range",
      "--background",
      ...PAGE_LOAD_VALUE_FLAGS,
    ]);
    const rawWindow = readFlag(argv, "window");
    let windowMs: number | undefined;
    if (rawWindow !== undefined) {
      const parsed = parseInstants(rawWindow, "--window");
      if (parsed.length !== 1 || parsed[0]! <= 0)
        throw new UsageError("--window takes one span, e.g. --window 5000 or --window 5s");
      windowMs = parsed[0]!;
      if (windowMs < 1000 || windowMs > 60_000)
        throw new UsageError(
          "--window is 1s to 60s of page time: a failure is more than six transitions within one second",
        );
    }
    const framesDir = readFlag(argv, "frames");
    const stripPath = readFlag(argv, "strip");
    const viewport = viewportFlag(argv);
    if (viewport && (viewport.width < 1 || viewport.height < 1))
      throw new UsageError(`--viewport must be at least 1x1 (got ${viewport.width}x${viewport.height})`);
    // A frames.json, or a frames directory (scan video's <recording>.frames/), judged by its frames.json.
    const fromFrames = /\.json$/i.test(source) || isFramesDir(source);
    if (fromFrames && (windowMs !== undefined || framesDir || viewport)) {
      throw new UsageError(
        "a frames.json is judged as it was captured: --window, --frames and --viewport are for a page",
      );
    }
    const video = videoFlags(argv);
    if (video && !isVideoFile(source)) {
      throw new UsageError(
        `--display-width, --from, --to, --max-frames, --stream, --color-matrix, --color-range, --background, --ffmpeg and --ffprobe are for a recording (mp4, webm, mov, mkv, gif, …), not ${source}`,
      );
    }
    if (isVideoFile(source) && (windowMs !== undefined || viewport)) {
      throw new UsageError(
        "a recording is judged over its own frames: --window and --viewport are for a page (--from / --to choose a span, --display-width how wide it plays)",
      );
    }
    return {
      source,
      ...(video ? { video } : {}),
      ...(windowMs !== undefined ? { windowMs } : {}),
      ...(framesDir ? { framesDir } : {}),
      ...(stripPath ? { stripPath } : {}),
      ...(viewport ? { viewport } : {}),
      ...parsePageLoad(argv),
    };
  },
  run: (options) => runFlashCheck(options),
  findings,
  format: formatFlashReport,
  headline: flashHeadline,
  ledger: (report, options) => ({
    tool: "check-flash",
    source: options.source,
    headline: {
      general: report.general.verdict,
      red: report.red.verdict,
      frames: report.sampling.frames,
      worstFieldShare: Math.max(report.general.worst?.fieldShare ?? 0, report.red.worst?.fieldShare ?? 0),
    },
  }),
});
