/**
 * `@mizchi/vlmkit-animation-eval` — animation measurement on its own, so a caller
 * can depend on it without vlmkit's capture, diff and gate plumbing.
 *
 * `runAnimationEval` opens a page, pauses every Web Animation, seeks each one
 * through deterministic sample points and screenshots, then derives issues:
 * no visible effect, infinite animation, reduced-motion ignored, long settle,
 * uncontrolled motion. `vlmkit check animation` is this report behind the gate
 * runner.
 *
 * Needs a browser: `playwright` is a required peer.
 */
export {
  clockSettledAt,
  computeOscillation,
  computeSettleMs,
  deriveAnimationIssues,
  formatAnimationEvalReport,
  frameDelta,
  restTimeForAnimation,
  runAnimationEval,
  unionBbox,
} from "./animation-eval.ts";
export { HOLD_TIMELINE_SCRIPT, VIRTUAL_CLOCK_SCRIPT } from "./virtual-clock.ts";
export type {
  AnimationEvalIssue,
  AnimationEvalIssueKind,
  AnimationEvalOptions,
  AnimationEvalReport,
  AnimationFrameStat,
  AnimationTimingSample,
  ClockMotion,
  DeriveIssuesInput,
  EvaluatedAnimation,
  FrameDeltaStat,
  OscillationInfo,
  ReducedMotionRemaining,
  SeekIneffective,
} from "./animation-eval.ts";
