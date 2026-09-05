/**
 * `@mizchi/vlmkit-animation-eval` — the evaluation half of the animation story,
 * on its own so a tool that *produces* animations (`vlmkit-anim`) can depend on
 * the measurement without depending on vlmkit's capture, diff and gate plumbing.
 *
 * `runAnimationEval` opens a page, pauses every Web Animation, seeks each one
 * through deterministic sample points and screenshots, then derives issues:
 * no visible effect, infinite animation, reduced-motion ignored, long settle,
 * uncontrolled motion. `vlmkit check animation` is this report behind the gate
 * runner; `vlmkit-anim eval` is the same report behind the animation tool's CLI.
 *
 * Needs a browser: `playwright` is a required peer.
 */
export {
  computeOscillation,
  computeSettleMs,
  deriveAnimationIssues,
  formatAnimationEvalReport,
  frameDelta,
  restTimeForAnimation,
  runAnimationEval,
  unionBbox,
} from "./animation-eval.ts";
export type {
  AnimationEvalIssue,
  AnimationEvalIssueKind,
  AnimationEvalOptions,
  AnimationEvalReport,
  AnimationFrameStat,
  AnimationTimingSample,
  DeriveIssuesInput,
  EvaluatedAnimation,
  FrameDeltaStat,
  OscillationInfo,
  ReducedMotionRemaining,
} from "./animation-eval.ts";
