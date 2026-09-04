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
import { firstPositional, optionalInt, viewportFlag } from "@mizchi/vlmkit-core/plugin/args.ts";

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
review. \`--frames dir\` writes them as separate files instead.`,
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
  ],
  inputs: [
    { name: "source", placeholder: "html-or-url", kind: "path-or-url", description: "Page to check", positional: 0, required: true },
    { name: "viewport", placeholder: "WxH", kind: "string", description: "Viewport", defaultDescription: "1280x720" },
    { name: "samples", kind: "number", description: "Sample points per animation", defaultDescription: "4" },
    { name: "max-animations", kind: "number", description: "Max animations to frame-evaluate", defaultDescription: "8" },
    { name: "frames", placeholder: "dir", kind: "path", description: "Write each sampled frame PNG into this directory" },
    { name: "strip", placeholder: "file.png", kind: "path", description: "Composite every sampled frame into one image (row per animation)" },
    { name: "strip-max-width", placeholder: "px", kind: "number", description: "Cap the strip width, downscaling to fit", defaultDescription: "1600" },
    { name: "strip-window", placeholder: "ms", kind: "number", description: "Page-timeline span the strip's columns cover", defaultDescription: "when the last finite animation ends" },
    { name: "strip-selector", placeholder: "css", kind: "string", description: "Restrict the strip's rows to animations on elements matching this selector" },
    {
      name: "strip-animated",
      kind: "boolean",
      description: "Write --strip as an animated PNG of the whole page instead of a cropped still sheet",
    },
    { name: "settle-threshold", placeholder: "ms", kind: "number", description: "long-settle threshold", defaultDescription: "3000" },
    { name: "skip-reduced-motion", kind: "boolean", description: "Skip the reduced-motion emulation pass" },
    ...PAGE_LOAD_INPUTS,
  ],
  parse: (argv) => {
    const source = firstPositional(argv, "vlmkit check animation <html-or-url>", ["--samples", "--max-animations", "--settle-threshold", "--frames", "--strip", "--strip-max-width", "--strip-window", "--strip-selector"]);
    const samples = optionalInt(argv, "samples", { min: 1 });
    const maxAnimations = optionalInt(argv, "max-animations", { min: 1 });
    const settleThresholdMs = optionalInt(argv, "settle-threshold", { min: 0 });
    const framesDir = readFlag(argv, "frames");
    const stripPath = readFlag(argv, "strip");
    const stripMaxWidth = optionalInt(argv, "strip-max-width", { min: 1 });
    const stripWindowMs = optionalInt(argv, "strip-window", { min: 1 });
    const stripSelector = readFlag(argv, "strip-selector");
    const stripAnimated = hasFlag(argv, "strip-animated");
    const viewport = viewportFlag(argv);
    return {
      source,
      skipReducedMotion: argv.includes("--skip-reduced-motion"),
      ...(samples !== undefined ? { samples } : {}),
      ...(maxAnimations !== undefined ? { maxAnimations } : {}),
      ...(settleThresholdMs !== undefined ? { settleThresholdMs } : {}),
      ...(framesDir ? { framesDir } : {}),
      ...(stripPath ? { stripPath } : {}),
      ...(stripAnimated ? { stripAnimated } : {}),
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
    `${report.animationCount} animation(s),`
    + ` settle ${report.settleMs === null ? "never" : `${Math.round(report.settleMs)}ms`},`
    + ` reduced-motion ${
      report.reducedMotion
        ? (report.reducedMotion.remainingCount === 0 ? "honored" : "IGNORED")
        : "n/a"
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
