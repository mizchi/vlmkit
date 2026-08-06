/**
 * `check animation` as a gate definition. Measurement code in
 * `../style/animation-eval.ts` is untouched.
 *
 * BEHAVIOR CHANGE, deliberate: like `check motion`, this gate previously
 * exited non-zero only with `--fail-on-suspect`. Under the runner a suspect
 * fails the command and `--advisory` is the opt-out, per `gate-exit.ts`.
 */

import { defineGate } from "@mizchi/vlmkit-core/plugin/contract.ts";
import type { Finding } from "@mizchi/vlmkit-core/plugin/contract.ts";
import { readFlag } from "@mizchi/vlmkit-core/arg-reader.ts";
import {
  type AnimationEvalOptions,
  type AnimationEvalReport,
  formatAnimationEvalReport,
  runAnimationEval,
} from "../style/animation-eval.ts";
import { firstPositional, optionalInt, viewportFlag } from "./arg-helpers.ts";

export const animationGate = defineGate<AnimationEvalReport, AnimationEvalOptions>({
  id: "check.animation",
  command: ["check", "animation"],
  title: "Frame-sampled animation evaluation",
  summary:
    "Frame-sampled animation evaluation (visible effect / settle / reduced-motion behavior)",
  usage: `Frame-sampled animation evaluation: pause every animation, seek through
deterministic sample points, and verify each one visibly moves pixels,
when the page settles, and whether prefers-reduced-motion is honored.`,
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
    { name: "settle-threshold", placeholder: "ms", kind: "number", description: "long-settle threshold", defaultDescription: "3000" },
    { name: "skip-reduced-motion", kind: "boolean", description: "Skip the reduced-motion emulation pass" },
  ],
  parse: (argv) => {
    const source = firstPositional(argv, "vlmkit check animation <html-or-url>", ["--samples", "--max-animations", "--settle-threshold", "--frames"]);
    const samples = optionalInt(argv, "samples", { min: 1 });
    const maxAnimations = optionalInt(argv, "max-animations", { min: 1 });
    const settleThresholdMs = optionalInt(argv, "settle-threshold", { min: 0 });
    const framesDir = readFlag(argv, "frames");
    const viewport = viewportFlag(argv);
    return {
      source,
      skipReducedMotion: argv.includes("--skip-reduced-motion"),
      ...(samples !== undefined ? { samples } : {}),
      ...(maxAnimations !== undefined ? { maxAnimations } : {}),
      ...(settleThresholdMs !== undefined ? { settleThresholdMs } : {}),
      ...(framesDir ? { framesDir } : {}),
      ...(viewport ? { viewport } : {}),
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
