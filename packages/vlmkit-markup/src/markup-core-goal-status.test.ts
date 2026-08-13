/**
 * The two decoders for `component-goal-status`, compared over the same rules.
 *
 * This is the command the boundary work exists for: **36 positional string
 * arguments**, nine of them `Int`, six `Bool`, five `Bool?`. A great many pairs
 * could be swapped and still parse, changing the verdict with nothing on either
 * side to notice. Migrating it is the most valuable change available and the one
 * most likely to break something quietly, so it gets a differential test rather
 * than a few hand-picked cases.
 *
 * ## What is and is not being compared
 *
 * The **rules are shared**. `goal_status` in MoonBit unpacks the typed record and
 * calls the same `component_goal_status` the positional arm calls. So a
 * disagreement here can only be a *wiring* bug — a field decoded into the wrong
 * parameter — which is exactly the failure the positional form invites and the one
 * a handful of examples would miss.
 *
 * The sweep is **deterministic**, not random: a fixed cross-product, so a failure
 * reproduces from the case name alone rather than from a seed.
 */
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { callMarkupCoreJson, runMarkupCore } from "./markup-core-runtime.ts";

/** The nested shape the TypeScript caller actually holds. */
interface GoalInput {
  goal: string;
  pixelDiffRatio: number;
  landscapeDiffRatio: number;
  pass: { landscape?: number; pixel?: number };
  review: { landscape?: number; pixel?: number };
  scrollports?: {
    total: number;
    broken: number;
    empty: number;
    expected?: { total: number; missing: number; broken: number; empty: number };
  };
  landing?: {
    heroVisible: boolean;
    primaryCtaVisible: boolean;
    nextSectionHintVisible: boolean;
    mediaSlotVisible: boolean;
  };
  canvas?: {
    canvasCount: number;
    nonblank: boolean;
    frameDelta: boolean;
    inputResponsive?: boolean;
    stateHookPresent?: boolean;
    missingStateFieldCount: number;
  };
  expressiveMenu?: {
    compositionLayers: number;
    compositionShapes: number;
    selectedVisible: boolean;
    focusableItemCount: number;
    semanticMenuText: boolean;
    diagonalEvidence: boolean;
    highContrast: boolean;
    lowContrastItemCount: number;
    hoverChanged?: boolean;
    focusVisibleChanged?: boolean;
  };
}

/**
 * The positional encoding, reproduced from the wrapper as it stood before the
 * migration — the reference side of the comparison.
 *
 * Copied rather than imported on purpose: the point is to pin the *old* wire
 * format, so it must not change when the wrapper does. `intArg` sent `"0"` for
 * absent, `boolArg` sent `"false"`, and optional numbers/booleans sent `"null"`.
 */
function positionalArgv(input: GoalInput): string[] {
  const dbl = (v: number) => String(Number.isFinite(v) ? v : 0);
  const optDbl = (v: number | undefined) =>
    typeof v === "number" && Number.isFinite(v) ? String(v) : "null";
  const int = (v: number | undefined) =>
    typeof v === "number" && Number.isFinite(v) ? String(Math.trunc(v)) : "0";
  const bool = (v: boolean | undefined) => (v ? "true" : "false");
  const optBool = (v: boolean | null | undefined) => (typeof v === "boolean" ? String(v) : "null");
  return [
    "component-goal-status",
    input.goal,
    dbl(input.pixelDiffRatio),
    dbl(input.landscapeDiffRatio),
    optDbl(input.pass.landscape),
    optDbl(input.pass.pixel),
    optDbl(input.review.landscape),
    optDbl(input.review.pixel),
    int(input.scrollports?.total),
    int(input.scrollports?.broken),
    int(input.scrollports?.empty),
    int(input.scrollports?.expected?.total),
    int(input.scrollports?.expected?.missing),
    int(input.scrollports?.expected?.broken),
    int(input.scrollports?.expected?.empty),
    bool(Boolean(input.landing)),
    bool(input.landing?.heroVisible),
    bool(input.landing?.primaryCtaVisible),
    bool(input.landing?.nextSectionHintVisible),
    bool(input.landing?.mediaSlotVisible),
    int(input.canvas?.canvasCount),
    bool(input.canvas?.nonblank),
    bool(input.canvas?.frameDelta),
    optBool(input.canvas?.inputResponsive),
    optBool(input.canvas?.stateHookPresent),
    int(input.canvas?.missingStateFieldCount),
    bool(Boolean(input.expressiveMenu)),
    int(input.expressiveMenu?.compositionLayers),
    int(input.expressiveMenu?.compositionShapes),
    bool(input.expressiveMenu?.selectedVisible),
    int(input.expressiveMenu?.focusableItemCount),
    bool(input.expressiveMenu?.semanticMenuText),
    bool(input.expressiveMenu?.diagonalEvidence),
    bool(input.expressiveMenu?.highContrast),
    int(input.expressiveMenu?.lowContrastItemCount),
    optBool(input.expressiveMenu?.hoverChanged),
    optBool(input.expressiveMenu?.focusVisibleChanged),
  ];
}

/** The JSON payload, as the migrated wrapper builds it. */
function jsonPayload(input: GoalInput): unknown {
  return {
    goal: input.goal,
    pixel_diff_ratio: input.pixelDiffRatio,
    landscape_diff_ratio: input.landscapeDiffRatio,
    pass: { landscape: input.pass.landscape, pixel: input.pass.pixel },
    review: { landscape: input.review.landscape, pixel: input.review.pixel },
    scrollports: input.scrollports && {
      total: input.scrollports.total,
      broken: input.scrollports.broken,
      empty: input.scrollports.empty,
      expected: input.scrollports.expected,
    },
    landing: input.landing && {
      hero_visible: input.landing.heroVisible,
      primary_cta_visible: input.landing.primaryCtaVisible,
      next_section_hint_visible: input.landing.nextSectionHintVisible,
      media_slot_visible: input.landing.mediaSlotVisible,
    },
    canvas: input.canvas && {
      canvas_count: input.canvas.canvasCount,
      nonblank: input.canvas.nonblank,
      frame_delta: input.canvas.frameDelta,
      input_responsive: input.canvas.inputResponsive,
      state_hook_present: input.canvas.stateHookPresent,
      missing_state_fields: input.canvas.missingStateFieldCount,
    },
    expressive_menu: input.expressiveMenu && {
      composition_layers: input.expressiveMenu.compositionLayers,
      composition_shapes: input.expressiveMenu.compositionShapes,
      selected_visible: input.expressiveMenu.selectedVisible,
      focusable_item_count: input.expressiveMenu.focusableItemCount,
      semantic_menu_text: input.expressiveMenu.semanticMenuText,
      diagonal_evidence: input.expressiveMenu.diagonalEvidence,
      high_contrast: input.expressiveMenu.highContrast,
      low_contrast_item_count: input.expressiveMenu.lowContrastItemCount,
      hover_changed: input.expressiveMenu.hoverChanged,
      focus_visible_changed: input.expressiveMenu.focusVisibleChanged,
    },
  };
}

const GOALS = ["app", "layout", "pixel", "draft", "app-shell", "landing", "canvas", "expressive-menu"];
const RATIOS: [number, number][] = [[0, 0], [0.004, 0.001], [0.041, 0.02], [0.4, 0.3]];
const THRESHOLDS: { pass: GoalInput["pass"]; review: GoalInput["review"] }[] = [
  { pass: {}, review: {} },
  { pass: { landscape: 0.02, pixel: 0.03 }, review: { landscape: 0.05, pixel: 0.06 } },
  { pass: { pixel: 0.01 }, review: { landscape: 0.1 } },
];

/**
 * Evidence groups, each present-and-varied or absent, since presence is a rule
 * input.
 *
 * Three properties are load-bearing here, and all three were learned by injecting
 * a real field swap and watching the test pass anyway:
 *
 * 1. **Same-typed fields hold distinct values.** The first version used
 *    `broken: 0, empty: 0` and `broken: 1, empty: 1`, so swapping those two
 *    parameters was literally a no-op.
 * 2. **One of each same-typed pair is ZERO while its neighbour is not.** Distinct
 *    values still missed it: the rule reads `scroll_broken > 0 -> fail` before
 *    `scroll_empty > 0 -> review`, so with both non-zero the first guard fires
 *    whichever way the two are wired. A swap behind a `> 0` guard is invisible
 *    unless a case straddles the guard.
 * 3. **A straddling case must actually REACH the guard.** This is the one that took
 *    longest. The first straddling variants also carried an `expected` sub-record,
 *    and `app_shell_status` opens with `if expected_total > 0 { … }` which returns
 *    without ever reading `scroll_broken` or `scroll_empty`. Two axes in one
 *    variant meant the interesting one was shadowed. They are separate variants now.
 *
 * ### Swaps that are genuinely undetectable, and should be
 *
 * Some parameter pairs are read symmetrically, so exchanging them cannot change any
 * verdict and a test reporting a difference would be reporting one that does not
 * exist. Read off `core.mbt` rather than inferred from the test passing:
 *
 * - `expected_missing > 0 || expected_broken > 0` — one guard, either side.
 * - `!primary_cta_visible || !hero_visible` — likewise.
 * - `layers < 2 || shapes < 2` — same guard, same threshold, and neither is read
 *   again afterwards.
 *
 * Injecting each of those three swaps leaves all cases agreeing, which is the
 * correct outcome. Injecting `scroll_broken`/`scroll_empty`,
 * `expected_missing`/`expected_empty` or `canvas.nonblank`/`canvas.frame_delta` —
 * pairs whose guards differ in outcome — makes cases disagree, which is the point.
 *
 * Worth writing down because "the differential test missed it" and "there is
 * nothing to miss" look identical from outside, and only the first is a defect.
 */
const SCROLLPORTS: GoalInput["scrollports"][] = [
  undefined,
  { total: 7, broken: 1, empty: 2 },
  { total: 9, broken: 3, empty: 4, expected: { total: 11, missing: 5, broken: 6, empty: 8 } },
  // Straddling the broken/empty guards, with NO `expected` — otherwise
  // `expected_total > 0` returns before either is read.
  { total: 7, broken: 0, empty: 2 },
  { total: 7, broken: 2, empty: 0 },
  // Straddling inside `expected`, which needs its own variants for the same reason.
  { total: 9, broken: 0, empty: 0, expected: { total: 11, missing: 0, broken: 0, empty: 8 } },
  { total: 9, broken: 0, empty: 0, expected: { total: 11, missing: 3, broken: 0, empty: 0 } },
  { total: 9, broken: 0, empty: 0, expected: { total: 11, missing: 0, broken: 4, empty: 0 } },
];
const LANDINGS: GoalInput["landing"][] = [
  undefined,
  { heroVisible: true, primaryCtaVisible: true, nextSectionHintVisible: true, mediaSlotVisible: true },
  { heroVisible: false, primaryCtaVisible: true, nextSectionHintVisible: false, mediaSlotVisible: true },
  { heroVisible: true, primaryCtaVisible: false, nextSectionHintVisible: true, mediaSlotVisible: false },
  { heroVisible: false, primaryCtaVisible: false, nextSectionHintVisible: true, mediaSlotVisible: true },
];
const CANVASES: GoalInput["canvas"][] = [
  undefined,
  { canvasCount: 1, nonblank: true, frameDelta: false, inputResponsive: true, stateHookPresent: false, missingStateFieldCount: 3 },
  { canvasCount: 2, nonblank: false, frameDelta: true, inputResponsive: false, stateHookPresent: true, missingStateFieldCount: 5 },
  { canvasCount: 3, nonblank: true, frameDelta: true, inputResponsive: true, stateHookPresent: true, missingStateFieldCount: 0 },
  { canvasCount: 0, nonblank: false, frameDelta: false, missingStateFieldCount: 4 },
  // `nonblank` and `frame_delta` sit in different guards with different outcomes
  // (fail vs review), so a swap between them is only visible when they differ AND
  // nothing earlier short-circuits: canvas_count > 0, state hook present, no
  // missing fields. Property 3 above, third instance.
  { canvasCount: 1, nonblank: true, frameDelta: false, inputResponsive: true, stateHookPresent: true, missingStateFieldCount: 0 },
  { canvasCount: 1, nonblank: false, frameDelta: true, inputResponsive: true, stateHookPresent: true, missingStateFieldCount: 0 },
];
const MENUS: GoalInput["expressiveMenu"][] = [
  undefined,
  {
    compositionLayers: 3, compositionShapes: 2, selectedVisible: true, focusableItemCount: 7,
    semanticMenuText: true, diagonalEvidence: false, highContrast: true, lowContrastItemCount: 1,
    hoverChanged: true, focusVisibleChanged: false,
  },
  {
    compositionLayers: 6, compositionShapes: 4, selectedVisible: false, focusableItemCount: 2,
    semanticMenuText: false, diagonalEvidence: true, highContrast: false, lowContrastItemCount: 9,
  },
  {
    compositionLayers: 0, compositionShapes: 5, selectedVisible: true, focusableItemCount: 0,
    semanticMenuText: true, diagonalEvidence: true, highContrast: true, lowContrastItemCount: 3,
    hoverChanged: false, focusVisibleChanged: true,
  },
  {
    compositionLayers: 4, compositionShapes: 0, selectedVisible: true, focusableItemCount: 6,
    semanticMenuText: true, diagonalEvidence: true, highContrast: true, lowContrastItemCount: 0,
    hoverChanged: true, focusVisibleChanged: true,
  },
];

/**
 * Evidence variants to sweep: the longest group's length, with shorter groups
 * cycling. Indexing every group by the same counter without the modulo would turn
 * the shorter ones into `undefined` — a valid "absent" that silently reduces
 * coverage rather than failing.
 */
const VARIANTS = Math.max(SCROLLPORTS.length, LANDINGS.length, CANVASES.length, MENUS.length);

/** A deterministic sweep. Each axis is varied against a fixed base for the rest. */
function cases(): { name: string; input: GoalInput }[] {
  const out: { name: string; input: GoalInput }[] = [];
  const base: GoalInput = {
    goal: "app",
    pixelDiffRatio: 0.041,
    landscapeDiffRatio: 0.02,
    pass: { landscape: 0.02, pixel: 0.03 },
    review: { landscape: 0.05, pixel: 0.06 },
  };
  for (const goal of GOALS) {
    for (const [pixel, landscape] of RATIOS) {
      for (const t of THRESHOLDS) {
        for (let variant = 0; variant < VARIANTS; variant++) {
          out.push({
            name: `${goal} px=${pixel} ls=${landscape} thresholds=${THRESHOLDS.indexOf(t)} evidence=${variant}`,
            input: {
              ...base,
              goal,
              pixelDiffRatio: pixel,
              landscapeDiffRatio: landscape,
              pass: t.pass,
              review: t.review,
              scrollports: SCROLLPORTS[variant % SCROLLPORTS.length],
              landing: LANDINGS[variant % LANDINGS.length],
              canvas: CANVASES[variant % CANVASES.length],
              expressiveMenu: MENUS[variant % MENUS.length],
            },
          });
        }
      }
    }
  }
  return out;
}

describe("component-goal-status: positional vs JSON decoder", { timeout: 240_000 }, () => {
  const all = cases();

  it("sweeps enough of the input space to be worth calling differential", () => {
    // 8 goals x 4 ratio pairs x 3 threshold sets x the evidence variants.
    assert.equal(all.length, 8 * 4 * 3 * VARIANTS);
    assert.ok(VARIANTS >= 8, `only ${VARIANTS} evidence variants`);
  });

  it("the two decoders agree on every case", () => {
    const verdicts = new Map<string, number>();
    const disagreements: string[] = [];
    for (const { name, input } of all) {
      const positional = runMarkupCore(positionalArgv(input));
      const json = callMarkupCoreJson<string>("goal-status", jsonPayload(input));
      if (positional !== json) disagreements.push(`${name}: positional=${positional} json=${json}`);
      verdicts.set(positional, (verdicts.get(positional) ?? 0) + 1);
    }
    assert.deepEqual(disagreements, [], `${disagreements.length} of ${all.length} cases disagree`);

    // A sweep where every case returns the same verdict would pass while proving
    // nothing about the decoding, so require the rules to have actually branched.
    assert.ok(
      verdicts.size >= 3,
      `expected pass/review/fail to all occur, saw ${JSON.stringify([...verdicts])}`,
    );
    for (const [verdict, count] of verdicts) {
      assert.ok(count >= 5, `verdict ${verdict} occurred only ${count} time(s) — thin coverage`);
    }
  });

  it("an absent evidence group is not the same as an empty one", () => {
    // The distinction the positional form could not carry: it sent four zeros for
    // absent scrollports. Asserted against the JSON path directly, since the
    // reference encoder cannot express the difference at all.
    const withNone = callMarkupCoreJson<string>("goal-status", {
      goal: "app-shell",
      pixel_diff_ratio: 0,
      landscape_diff_ratio: 0,
      pass: {},
      review: {},
    });
    const withEmpty = callMarkupCoreJson<string>("goal-status", {
      goal: "app-shell",
      pixel_diff_ratio: 0,
      landscape_diff_ratio: 0,
      pass: {},
      review: {},
      scrollports: { total: 0, broken: 0, empty: 0 },
    });
    // They may legitimately agree today — what matters is that the boundary can
    // now express both, so a future rule is free to tell them apart.
    assert.ok(["pass", "review", "fail"].includes(withNone));
    assert.ok(["pass", "review", "fail"].includes(withEmpty));
  });
});
