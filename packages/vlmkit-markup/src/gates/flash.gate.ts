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
import { parseInstants } from "@mizchi/vlmkit-judge/frames.ts";
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

const selectorOf = (t: FlashTrackReport): { selector?: string } =>
  t.animations && t.animations.length === 1 ? { selector: t.animations[0]!.path } : {};

function findings(report: FlashReport): Finding[] {
  const out: Finding[] = [];
  for (const [track, rule, label] of [
    ["general", "general-flash", "luminance"],
    ["red", "red-flash", "saturated-red"],
  ] as const) {
    const t = report[track];
    if (t.verdict === "fail" && t.worst) {
      out.push({
        rule,
        severity: "suspect",
        message: `${label} flashing: ${where(t)}`,
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
      message: `pass on an incomplete sequence (largest gap ${s.maxGapMs.toFixed(1)}ms${s.unstableFrames ? `, ${s.unstableFrames} unstable frame(s)` : ""}): a state shorter than the gap can be missed, so the pass is not backed`,
    });
  }
  for (const u of report.unmeasured) {
    const large = report.unmeasuredAreaCss2 > report.criteria.areaLimitCss2;
    out.push({
      rule: "flash-unmeasured",
      severity: large ? "suspect" : "info",
      message: `${u.reason === "video" ? "<video> paused" : u.reason === "animated-image" ? "animated image" : "pixels changing with the clock held"}, ${u.rect.width}x${u.rect.height} at (${u.rect.x},${u.rect.y}): not judged${large ? `; ${report.unmeasuredAreaCss2.toLocaleString("en-US")} CSS px² of one field unmeasured, over the 21,824 limit, so no pass is possible` : ""}`,
      ...(u.path ? { selector: u.path } : {}),
      evidence: { ...u },
    });
  }
  return out;
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

A \`<video>\` is paused, an animated image runs on the browser's own clock, and
pixels that change between two shots of one held instant are not judged: they
are reported, and over the limit in one field they make the verdict "not
judgeable", never a pass.

\`--window ms\` (default from the page's animations, 2-10s) sets the span swept;
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
      placeholder: "html-or-url-or-frames.json",
      kind: "path-or-url",
      description: "Page to check, or a frames.json (vlmkit-frames/1) to judge again",
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
    ...PAGE_LOAD_INPUTS,
  ],
  parse: (argv) => {
    const source = firstPositional(argv, "vlmkit check flash <html-or-url | frames.json>", [
      "--window",
      "--frames",
      "--strip",
      ...PAGE_LOAD_VALUE_FLAGS,
    ]);
    const rawWindow = readFlag(argv, "window");
    let windowMs: number | undefined;
    if (rawWindow !== undefined) {
      const parsed = parseInstants(rawWindow, "--window");
      if (parsed.length !== 1 || parsed[0]! <= 0)
        throw new UsageError("--window takes one span, e.g. --window 5000 or --window 5s");
      windowMs = parsed[0]!;
    }
    const framesDir = readFlag(argv, "frames");
    const stripPath = readFlag(argv, "strip");
    const viewport = viewportFlag(argv);
    const fromFrames = /\.json$/i.test(source);
    if (fromFrames && (windowMs !== undefined || framesDir || viewport)) {
      throw new UsageError(
        "a frames.json is judged as it was captured: --window, --frames and --viewport are for a page",
      );
    }
    return {
      source,
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
