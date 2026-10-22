/**
 * `check animation` as a gate definition. Measurement code in
 * `../style/animation-eval.ts` is untouched.
 *
 * BEHAVIOR CHANGE, deliberate: like `check motion`, this gate previously
 * exited non-zero only with `--fail-on-suspect`. Under the runner a suspect
 * fails the command and `--advisory` is the opt-out, per `gate-exit.ts`.
 */

import { PAGE_LOAD_INPUTS, parsePageLoad } from "@mizchi/vlmkit-core/page-load.ts";
import { defineGate } from "@mizchi/vlmkit-core/plugin/contract.ts";
import type { Finding } from "@mizchi/vlmkit-core/plugin/contract.ts";
import { hasFlag, readFlag } from "@mizchi/vlmkit-core/arg-reader.ts";
import {
  type AnimationEvalOptions,
  type AnimationEvalReport,
  formatAnimationEvalReport,
  runAnimationEval,
} from "@mizchi/vlmkit-animation-eval/animation-eval.ts";
import { firstPositional, instantList, optionalInt, viewportFlag } from "@mizchi/vlmkit-core/plugin/args.ts";
import { UsageError } from "@mizchi/vlmkit-core/cli-error.ts";

export const animationGate = defineGate<AnimationEvalReport, AnimationEvalOptions>({
  id: "check.animation",
  command: ["check", "animation"],
  title: "Frame-sampled animation evaluation",
  summary:
    "Frame-sampled animation evaluation (visible effect / settle / reduced-motion), and a filmstrip image with --strip",
  category: "behavior",
  usage: `Frame-sampled animation evaluation: pause every animation, seek through
deterministic sample points, and verify each one visibly moves pixels,
when the page settles, and whether prefers-reduced-motion is honored.

\`--strip out.png --strip-animated\` writes an animated PNG of the whole page over
the same timeline: it keeps the spatial arrangement the cropped sheet cannot show,
and plays in a browser or a GitHub comment. Needs no extra dependency.

\`--strip out.png\` (or \`.webp\`) writes the sampled frames as ONE image, a row per
animation, cropped to the motion each one produced — the form to paste into a
review.

\`--frames dir\` writes the viewport, uncropped, at instants of the page's own time, as numbered
PNGs (0000-t000000.png, 0001-t000150.png, ...) plus frames.json (vlmkit-frames/1),
which \`snapshot strip --manifest\` turns into a sheet or an animated PNG. The
page clock and every animation are held for them, with or without
\`--virtual-time\`. \`--at\` picks the instants, for --frames and for the strip's
columns: \`--at 0,150,300\`, \`--at 0..1s/100ms\`, \`--at 1.5s\`, \`--at 6f\` (frame
6 of the 60fps clock). Without it, frames are taken at each animation's start,
middle and end plus 0/250/500/1000/2000ms. The frames are --viewport's size (1280x800 unless
given, as check integrity and inspect motion): pass the target's before diffing a frame against it.
\`--frames-reduced-motion\` captures them with prefers-reduced-motion: reduce emulated,
to look at what that visitor gets.

\`--virtual-time\` holds the page clock — requestAnimationFrame, performance.now,
Date, setTimeout, setInterval — from document start and advances it itself, so
script-driven motion (a rAF loop, a GSAP ticker, a canvas, a timer carousel) is
sampled like an animation instead of reported as \`uncontrolled-motion\`, and
stops contaminating the WAAPI frames. What still moves with the clock held is
video, an animated image or a worker. A page can also draw on demand: it gets a
\`vlmkit:seek\` event with \`detail.timeMs\` and \`detail.waitUntil(promise)\`.`,
  rules: [
    {
      id: "no-visible-effect",
      title: "Animation moves no pixels across its sample points",
      severity: "suspect",
      docs: "A declared animation that changes nothing is either dead or animating an invisible element.",
    },
    {
      id: "reduced-motion-ignored",
      title: "Motion still runs under prefers-reduced-motion",
      severity: "suspect",
    },
    { id: "infinite-animation", title: "Animation never ends", severity: "warn" },
    {
      id: "long-settle",
      title: "Page takes longer than the settle threshold to go still",
      severity: "warn",
      docs: "Every downstream pixel diff is nondeterministic until the page settles.",
    },
    { id: "uncontrolled-motion", title: "Motion outside the animation API's control", severity: "warn" },
    {
      id: "seek-ineffective",
      title: "Seeking an animation did not control what was captured",
      severity: "suspect",
      docs: "The page cancelled or replaced the animation, or replaying a sample did not reproduce its frame — its pixels are not a measurement of it, so it is reported neither visible nor dead.",
    },
    {
      id: "undefined-keyframes",
      title: "animation-name names no @keyframes",
      severity: "suspect",
      docs: "Nothing runs under a name with no @keyframes. Checked on the page and under prefers-reduced-motion: reduce, where a misnamed rule meant to hide or settle something silently does nothing (and reduced motion would otherwise read as honoured).",
    },
    {
      id: "motion-mostly-hidden",
      title: "An animation moved only a small part of its element",
      severity: "warn",
      docs: "Its motion region covered under a quarter of the element's own box at rest, so most of the element is likely clipped (an ancestor's overflow) or covered (a stacking context). `inspect motion --selector` names which.",
    },
    {
      id: "unknown-transition-property",
      title: "transition-property names no CSS property",
      severity: "suspect",
      docs: "A misspelt property (`widht`) computes as itself and its transition never runs: the property it meant changes in one frame, and with no animation on the page nothing else reports it.",
    },
    {
      id: "reduced-motion-hides",
      title: "Under reduced motion an element rests hidden or out of place",
      severity: "suspect",
      docs: "Seen at rest without prefers-reduced-motion and at opacity 0 (or 8px+ from its place) at rest with it: `animation: none` in the reduce rule removed the animation and the fill that held its end state, so its base style (opacity 0, a start transform) shows. The preference is honoured and the content is gone.",
    },
    {
      id: "delayed-entrance",
      title: "An element is held unseen through a long animation-delay",
      severity: "warn",
      docs: "Its first keyframe hides it (opacity 0, visibility hidden), its fill is backwards or both, and its delay is 1000ms or more: the page is on screen and it is not. Intended for a late toast; a lag for anything meant to appear with the page.",
    },
    {
      id: "clock-motion-unsettled",
      title: "Script-driven motion still changing at the end of the virtual-time window",
      severity: "warn",
      docs: "Only with --virtual-time: a requestAnimationFrame / timer loop that never stops, measured on the held page clock.",
    },
  ],
  inputs: [
    {
      name: "source",
      placeholder: "html-or-url",
      kind: "path-or-url",
      description: "Page to check",
      positional: 0,
      required: true,
    },
    { name: "viewport", placeholder: "WxH", kind: "string", description: "Viewport", defaultDescription: "1280x800" },
    { name: "samples", kind: "number", description: "Sample points per animation", defaultDescription: "4" },
    {
      name: "max-animations",
      kind: "number",
      description: "Max animations to frame-evaluate",
      defaultDescription: "8",
    },
    {
      name: "frames",
      placeholder: "dir",
      kind: "path",
      description:
        "Write the viewport, uncropped, at each instant (--at) as numbered PNGs + frames.json (vlmkit-frames/1), clock and animations held",
    },
    {
      name: "frames-reduced-motion",
      kind: "boolean",
      description: "Capture --frames with prefers-reduced-motion: reduce emulated (what that visitor sees)",
    },
    {
      name: "at",
      placeholder: "instants",
      kind: "number-list",
      description:
        "Instants of page time for --frames and the strip's columns (ms; on the CLI also 1.5s, 6f, 0..1s/100ms)",
      defaultDescription:
        "frames: each animation's start/middle/end + 0,250,500,1000,2000; strip: its window split evenly",
    },
    {
      name: "strip",
      placeholder: "file.png",
      kind: "path",
      description: "Composite every sampled frame into one image (row per animation)",
    },
    {
      name: "strip-max-width",
      placeholder: "px",
      kind: "number",
      description: "Cap the strip width, downscaling to fit",
      defaultDescription: "1600",
    },
    {
      name: "strip-window",
      placeholder: "ms",
      kind: "number",
      description: "Page-timeline span the strip's columns cover",
      defaultDescription: "when the last finite animation ends",
    },
    {
      name: "strip-selector",
      placeholder: "css",
      kind: "string",
      description: "Restrict the strip's rows to animations on elements matching this selector",
    },
    {
      name: "strip-animated",
      kind: "boolean",
      description: "Write --strip as an animated PNG of the whole page instead of a cropped still sheet",
    },
    {
      name: "settle-threshold",
      placeholder: "ms",
      kind: "number",
      description: "long-settle threshold",
      defaultDescription: "3000",
    },
    { name: "skip-reduced-motion", kind: "boolean", description: "Skip the reduced-motion emulation pass" },
    {
      name: "virtual-time",
      kind: "boolean",
      description:
        "Hold the page clock (rAF, performance.now, Date, timers) and drive it, so script-driven motion is measured instead of reported as uncontrolled",
    },
    {
      name: "clock-window",
      placeholder: "ms",
      kind: "number",
      description: "Virtual-time span to sample script-driven motion over (--virtual-time)",
      defaultDescription: "2000",
    },
    ...PAGE_LOAD_INPUTS,
  ],
  parse: (argv) => {
    const source = firstPositional(argv, "vlmkit check animation <html-or-url>", [
      "--samples",
      "--max-animations",
      "--settle-threshold",
      "--frames",
      "--strip",
      "--strip-max-width",
      "--strip-window",
      "--strip-selector",
      "--clock-window",
      "--at",
    ]);
    const samples = optionalInt(argv, "samples", { min: 1 });
    const maxAnimations = optionalInt(argv, "max-animations", { min: 1 });
    const settleThresholdMs = optionalInt(argv, "settle-threshold", { min: 0 });
    const framesDir = readFlag(argv, "frames");
    const stripPath = readFlag(argv, "strip");
    const stripMaxWidth = optionalInt(argv, "strip-max-width", { min: 1 });
    const stripWindowMs = optionalInt(argv, "strip-window", { min: 1 });
    const stripSelector = readFlag(argv, "strip-selector");
    const stripAnimated = hasFlag(argv, "strip-animated");
    const virtualTime = hasFlag(argv, "virtual-time");
    const clockWindowMs = optionalInt(argv, "clock-window", { min: 1 });
    const framesReducedMotion = hasFlag(argv, "frames-reduced-motion");
    if (framesReducedMotion && !framesDir) {
      throw new UsageError("--frames-reduced-motion sets how --frames are captured; add --frames <dir>.");
    }
    const at = instantList(argv, "at");
    if (at !== undefined) {
      if (at.length === 0) throw new UsageError("--at names no instant, e.g. --at 0,150,300");
      if (!framesDir && !stripPath) {
        throw new UsageError("--at picks the instants for --frames and --strip; add one of them.");
      }
      if (stripWindowMs !== undefined) {
        throw new UsageError("--at names the strip's columns, so --strip-window has nothing left to set.");
      }
    }
    const viewport = viewportFlag(argv);
    return {
      source,
      skipReducedMotion: argv.includes("--skip-reduced-motion"),
      ...(samples !== undefined ? { samples } : {}),
      ...(maxAnimations !== undefined ? { maxAnimations } : {}),
      ...(settleThresholdMs !== undefined ? { settleThresholdMs } : {}),
      ...(framesDir ? { framesDir } : {}),
      ...(framesReducedMotion ? { framesReducedMotion } : {}),
      ...(at ? { at } : {}),
      ...(stripPath ? { stripPath } : {}),
      ...(stripAnimated ? { stripAnimated } : {}),
      ...(virtualTime ? { virtualTime } : {}),
      ...(clockWindowMs !== undefined ? { clockWindowMs } : {}),
      ...(stripMaxWidth !== undefined ? { stripMaxWidth } : {}),
      ...(stripWindowMs !== undefined ? { stripWindowMs } : {}),
      ...(stripSelector ? { stripSelector } : {}),
      ...(viewport ? { viewport } : {}),
      ...parsePageLoad(argv),
    };
  },
  run: (options) => runAnimationEval(options),
  findings: (report): Finding[] =>
    report.issues.map((issue) => ({
      rule: issue.kind,
      severity: issue.severity,
      message: issue.message,
      ...(issue.selector ? { selector: issue.selector } : {}),
    })),
  format: formatAnimationEvalReport,
  headline: (report) =>
    `${report.animationCount} animation(s),` +
    ` settle ${report.settleMs === null ? "never" : `${Math.round(report.settleMs)}ms`},` +
    ` reduced-motion ${
      report.reducedMotion ? (report.reducedMotion.remainingCount === 0 ? "honored" : "IGNORED") : "n/a"
    }`,
  ledger: (report, options) => ({
    tool: "check-animation",
    source: options.source,
    headline: {
      animations: report.animationCount,
      settleMs: report.settleMs,
      issues: report.issues.length,
    },
  }),
});
