/**
 * `@mizchi/vlmkit-markup/rules` — the deterministic layer, on its own.
 *
 * Every gate in this package is the same two halves:
 *
 * ```
 *   COLLECT_x  →  samples  →  judgeX / analyzeX  →  findings
 *   (a string   (plain JSON,  (a pure function of  (rule id +
 *    to eval     structurally  the samples: no      severity +
 *    in a page)  typed)        I/O, no browser)     message)
 * ```
 *
 * That split has been the architecture from the start and was never *declared*,
 * so both halves were reachable only by deep-importing the file a gate happens to
 * live in — `@mizchi/vlmkit-markup/inspect/integrity-check.ts` for the contrast
 * judge, `style/design-policy.ts` for the reuse judge. A consumer had to know the
 * internal layout, and nothing stopped a later commit from moving it.
 *
 * This module is the declaration. What it buys:
 *
 *   - **Use a rule without this toolkit's driver.** Have a Playwright `Page`, a
 *     Puppeteer one, a CDP session, or a jsdom tree of your own? `page.evaluate`
 *     the `COLLECT_*` string, hand the result to the judge, and you have the same
 *     findings `vlmkit` reports, from your own harness.
 *   - **Test a rule without a browser.** The judges are pure, so a project can
 *     assert on its own fixtures in microseconds. This is how this repo's own
 *     ~2650 tests cover 125 rules while starting a browser only where a
 *     measurement genuinely needs one.
 *   - **Reuse a rule inside a plugin gate.** A house gate that wants "the reuse
 *     metric, but per design-system layer" calls `judgeDesignPolicy` rather than
 *     reimplementing an average nobody would get identical.
 *
 * Purity is enforced, not asserted: `rules.test.ts` imports this module and
 * fails if `playwright` reaches the module registry.
 *
 * The three things that are NOT here, deliberately:
 *
 *   - `run*` functions (`runDesignPolicyCheck`, `runA11yTouch`, …). They own a
 *     browser and a filesystem. Import those from their own modules.
 *   - The gate definitions. Those are `defineGate` declarations; a consumer
 *     composing gates wants `@mizchi/vlmkit-core/plugin`.
 *   - `format*` functions. Prose is the gate's, and a library consumer wants the
 *     findings.
 */

// ---------------------------------------------------------------------------
// Exemptions — the shared `<selector>;<reason>` form
//
// Three properties every exemption in this repo has: a reason is required, an
// exempted finding is still LISTED rather than subtracted, and a rule that
// matched nothing is reported. A consumer applying these to its own findings
// gets the same auditability the gates have.

export {
  applySelectorAllowRules,
  parseSelectorAllowRules,
  selectorAllowHelp,
} from "./inspect/selector-exemption.ts";
export type {
  AppliedSelectorAllow,
  SelectorAllowRule,
  SelectorExemption,
} from "./inspect/selector-exemption.ts";

// `check integrity`'s richer form, which carries a rule kind and a viewport
// because that gate has 19 rules and measures at three widths.
export {
  ALLOW_HELP,
  applyAllowRules,
  parseAllowRules,
  ruleMatches,
} from "./inspect/integrity-exemption.ts";
export type { AppliedExemptions, IntegrityAllowRule } from "./inspect/integrity-exemption.ts";

// ---------------------------------------------------------------------------
// check design — component-style reuse
//
// The metric is `instances / distinct styles`, an AVERAGE, which is why
// `--min-reuse` cannot rescue a small role with one deliberate variant and
// `--allow` exists instead. `judgeDesignPolicy` returns `verdict: "not-judged"`
// when no role had enough instances: a role too small to judge must not read as
// a coherent one.

export { COLLECT_DESIGN_SAMPLES, buildDesignSampleScript, judgeDesignPolicy, parseDesignAllowRules } from "./style/design-policy.ts";
export type {
  DesignFinding,
  DesignFindingKind,
  DesignPolicyInput,
  DesignPolicyReport,
  DesignSample,
  DesignSpacingSample,
} from "./style/design-policy.ts";

// ---------------------------------------------------------------------------
// check integrity — is the page broken on its own terms
//
// Nine judges rather than one, because each reads a different collected shape
// and a caller may want only some. `judgeTextContrast` groups by colour pair
// plus the applicable floor (WCAG size-aware: 4.5:1, or 3:1 for large text),
// because that is the shape of the fix — one CSS declaration.

export {
  COLLECT_CLIP_CANDIDATES,
  COLLECT_COLLAPSE_CANDIDATES,
  COLLECT_INTEGRITY_TEXT,
  COLLECT_OCCLUSIONS,
  COLLECT_RESOURCES,
  judgeAlignment,
  judgeClippedText,
  judgeCollapsedContainers,
  judgeNetworkFailures,
  judgeProtrusions,
  judgeRender,
  judgeResources,
  judgeTextContrast,
  judgeUnstyled,
} from "./inspect/integrity-check.ts";
export type {
  IntegrityFinding,
  IntegrityFindingKind,
  IntegrityReport,
} from "./inspect/integrity-check.ts";

// ---------------------------------------------------------------------------
// a11y — contrast and touch targets
//
// `evaluateA11yContrast` is the size-aware WCAG decision on one pair; the
// `analyze*` functions are the per-page sweeps. `analyzeA11yTouchSamples` keys
// its dedupe on path PLUS position, because a generated CSS path is shared by
// identical siblings — keying on the path alone collapsed a toolbar into one
// element and left cluster detection with nothing to compare against.

export { A11Y_CONTRAST_SAMPLE_SCRIPT, analyzeA11yContrastSamples } from "./a11y-contrast.ts";
export type { A11yContrastRawSample, ContrastFinding } from "./a11y-contrast.ts";
export { evaluateA11yContrast } from "./markup-core-a11y-contrast.ts";
export { A11Y_TOUCH_SAMPLE_SCRIPT, analyzeA11yTouchSamples } from "./a11y-touch.ts";
export type { A11yTouchRawSample, TouchTargetFinding, WcagTouchLevel } from "./a11y-touch.ts";
export { requiredTouchSide, touchTargetBelowRequired, touchTargetInCluster } from "./markup-core-a11y-touch.ts";

// ---------------------------------------------------------------------------
// scroll, handlers, interactions, motion, animation, breakpoints, copy
//
// The same shape throughout. `deriveHandlerIssues` reports a page that presents
// controls and registers no handlers — which needs `visibleControls` on the
// surface, the denominator that made "zero handlers" interpretable.

export { COLLECT_SCROLL_SCRIPT, analyzeScrollSamples } from "./inspect/scroll-scan.ts";
export type { ScrollScanInput, ScrollScanIssue, ScrollScanReport } from "./inspect/scroll-scan.ts";

export { COLLECT_SURFACE_SCRIPT, deriveHandlerIssues } from "./inspect/handler-map.ts";
export type { HandlerIssue, HandlerSurface, HandlerSurfaceEntry } from "./inspect/handler-map.ts";

// `DISCOVER_SCRIPT` stamps the interactive elements the handler cross-check reads,
// so the two travel together even though they live in different modules.
export { DISCOVER_SCRIPT, deriveInteractionIssues } from "./inspect/interaction-map.ts";
export type { InteractionIssue, InteractionMapResult } from "./inspect/interaction-map.ts";

export { analyzeMotionSamples } from "./style/motion-detect.ts";
export type { MotionDetectionInput, MotionDetectionReport } from "./style/motion-detect.ts";

export { deriveAnimationIssues } from "./style/animation-eval.ts";

export { analyzeBoundary, deriveBreakpointIssues, deriveSweepIssues } from "./stress/breakpoint-check.ts";
export type { BreakpointCheckIssue } from "./stress/breakpoint-check.ts";

export { COLLECT_RAW_TEXT, COLLECT_TEXT_VISIBILITY, COLLECT_VISIBLE_TEXT, analyzeCopy } from "./inspect/copy-check.ts";
export { COLLECT_TEXT_BLOCKS } from "./inspect/copy-target.ts";
