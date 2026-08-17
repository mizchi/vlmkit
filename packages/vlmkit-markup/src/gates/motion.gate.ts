/**
 * `check motion` as a gate definition. Measurement code in
 * `../style/motion-detect.ts` is untouched.
 *
 * BEHAVIOR CHANGE, deliberate: this gate previously exited non-zero only
 * when the caller passed `--fail-on-suspect`. `gate-exit.ts` documents the
 * opposite contract — "a suspect fails the command", with `--fail-on-suspect`
 * kept as an accepted no-op and `--advisory` as the opt-out — and every
 * other migrated gate already behaved that way. `check motion` was one of
 * the stragglers whose default was the dangerous one: printing a defect and
 * exiting 0. Under the runner it now fails on a suspect, and
 * `--fail-on-suspect` keeps parsing for the scripts that pass it.
 */

import { PAGE_LOAD_INPUTS, parsePageLoad } from "@mizchi/vlmkit-core/page-load.ts";
import { defineGate } from "@mizchi/vlmkit-core/plugin/contract.ts";
import type { Finding } from "@mizchi/vlmkit-core/plugin/contract.ts";
import {
  type MotionDetectionOptions,
  type MotionDetectionReport,
  formatMotionDetectionReport,
  runMotionDetection,
} from "../style/motion-detect.ts";
import { firstPositional, optionalInt } from "@mizchi/vlmkit-core/plugin/args.ts";

export const motionGate = defineGate<MotionDetectionReport, MotionDetectionOptions>({
  id: "check.motion",
  command: ["check", "motion"],
  title: "CSS motion detection",
  summary: "CSS motion detection (animation / transition / reduced-motion)",
  category: "behavior",
  usage: `Static motion inventory: which elements declare animations or
transitions, which animations are actually running, and whether the page
honors prefers-reduced-motion. (Frame-sampled behavior — does the motion
have a visible effect, does it settle — is \`vlmkit check animation\`.)`,
  rules: [
    {
      id: "missing-reduced-motion",
      title: "Page animates but declares no prefers-reduced-motion rule",
      severity: "suspect",
      docs: "Raised only when every stylesheet was readable. When one was not, `unreadable-stylesheet` is raised instead.",
    },
    {
      id: "unreadable-stylesheet",
      title: "No prefers-reduced-motion rule in the CSS this gate could read, and a stylesheet it could not",
      severity: "warn",
      docs: `A warn rather than a suspect because absence is unproven. Reading \`cssRules\` of a linked
stylesheet throws SecurityError for a file:// document, so the caller re-reads it from disk or over
the context's own client; anything still unreadable lands here. \`check animation\` measures the
behaviour under emulation and does not depend on CSS text.`,
    },
    {
      id: "running-animation",
      title: "Animation still running at measurement time",
      severity: "warn",
      docs: "Non-settling motion makes every downstream pixel diff nondeterministic.",
    },
  ],
  inputs: [
    { name: "source", placeholder: "html-or-url", kind: "path-or-url", description: "Page to check", positional: 0, required: true },
    { name: "max-samples", kind: "number", description: "Max motion elements to sample", defaultDescription: "100" },
    ...PAGE_LOAD_INPUTS,
  ],
  parse: (argv) => {
    const source = firstPositional(argv, "vlmkit check motion <html-or-url>");
    const maxSamples = optionalInt(argv, "max-samples", { min: 1 });
    return { source, ...(maxSamples !== undefined ? { maxSamples } : {}), ...parsePageLoad(argv) };
  },
  run: (options) => runMotionDetection(options),
  findings: (report): Finding[] =>
    report.issues.map((issue) => ({
      rule: issue.kind,
      severity: issue.severity,
      message: issue.message,
      ...(issue.selector ? { selector: issue.selector } : {}),
    })),
  format: formatMotionDetectionReport,
  headline: (report) =>
    `running ${report.runningAnimationCount},`
    + ` reduced-motion rule ${report.hasReducedMotionRule ? "yes" : "no"}`,
  ledger: (report, options) => ({
    tool: "check-motion",
    source: options.source,
    headline: {
      activeAnimations: report.activeAnimationCount,
      running: report.runningAnimationCount,
      issues: report.issues.length,
    },
  }),
});
