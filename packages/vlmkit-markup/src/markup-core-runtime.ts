import { spawnSync } from "node:child_process";
import { describeMoonBitError } from "./markup-core-error.ts";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  ComponentCanvasEvidence,
  ComponentExpressiveMenuEvidence,
  ComponentGoalProfile,
  ComponentGoalStatus,
  ComponentLandingEvidence,
  ComponentScrollportEvidence,
} from "./component/component-goal.ts";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(here, "..");
const repoRoot = resolve(packageRoot, "../..");
const cliPath = join(
  packageRoot,
  "_build/js/debug/build/markup-core-cli/markup-core-cli.js",
);
const apiPath = join(
  packageRoot,
  "_build/js/debug/build/markup-core-api/markup-core-api.js",
);

let built = false;
const runMarkupCoreCache = new Map<string, string>();
const requireGenerated = createRequire(import.meta.url);
const directArgSeparator = "\t";
const directEmptyArg = "__VLMKIT_EMPTY_ARG__";
const injectedDirectModuleKey = "__MIZCHI_VLMKIT_MARKUP_CORE_API__";
let directModule: DirectMarkupCoreModule | undefined;
let directModuleUnavailable = false;
let runtimeBackend: "direct-js" | "spawn" = "spawn";

interface DirectMarkupCoreModule {
  run_markup_core: (command: string, encodedArgs: string) => unknown;
  /** Optional so a stale build without the JSON boundary falls back rather than crashing. */
  run_markup_core_json?: (command: string, payload: string) => unknown;
  markup_core_json_commands?: () => unknown;
}

export function computeComponentGoalStatus(input: {
  goal: string;
  pixelDiffRatio: number;
  landscapeDiffRatio: number;
  pass: ComponentGoalProfile["pass"];
  review: ComponentGoalProfile["review"];
  scrollports?: ComponentScrollportEvidence;
  landing?: ComponentLandingEvidence;
  canvas?: ComponentCanvasEvidence;
  expressiveMenu?: ComponentExpressiveMenuEvidence;
}): ComponentGoalStatus {
  // 36 positional strings became one nested record — the shape this function's
  // caller already held, flattened only because the wire could not carry it. Three
  // arguments disappeared with the flattening: `landing_present`,
  // `expressive_present` and the canvas hook's presence flag each existed to say
  // whether the *following* arguments meant anything, which `Option` says already.
  //
  // `markup-core-goal-status.test.ts` compares this decoder against the positional
  // one over a deterministic sweep, because a mis-wired field here changes a verdict
  // and nothing else would notice.
  const output = callMarkupCoreJson<string>("goal-status", {
    goal: input.goal,
    pixel_diff_ratio: finiteOr(input.pixelDiffRatio),
    landscape_diff_ratio: finiteOr(input.landscapeDiffRatio),
    pass: { landscape: optionalFinite(input.pass.landscape), pixel: optionalFinite(input.pass.pixel) },
    review: { landscape: optionalFinite(input.review.landscape), pixel: optionalFinite(input.review.pixel) },
    scrollports: input.scrollports && {
      total: intOr(input.scrollports.total),
      broken: intOr(input.scrollports.broken),
      empty: intOr(input.scrollports.empty),
      expected: input.scrollports.expected && {
        total: intOr(input.scrollports.expected.total),
        missing: intOr(input.scrollports.expected.missing),
        broken: intOr(input.scrollports.expected.broken),
        empty: intOr(input.scrollports.expected.empty),
      },
    },
    landing: input.landing && {
      hero_visible: Boolean(input.landing.heroVisible),
      primary_cta_visible: Boolean(input.landing.primaryCtaVisible),
      next_section_hint_visible: Boolean(input.landing.nextSectionHintVisible),
      media_slot_visible: Boolean(input.landing.mediaSlotVisible),
    },
    canvas: input.canvas && {
      canvas_count: intOr(input.canvas.canvasCount),
      nonblank: Boolean(input.canvas.nonblank),
      frame_delta: Boolean(input.canvas.frameDelta),
      input_responsive: input.canvas.inputResponsive,
      // Presence of the hook, not its value: the positional form sent "null" when
      // the contract declared no hook and "false" when it declared one that was
      // missing, and those mean different things to the rule.
      state_hook_present: input.canvas.stateHook
        ? input.canvas.stateHookPresent !== false
        : undefined,
      missing_state_fields: intOr(input.canvas.missingStateFields?.length),
    },
    expressive_menu: input.expressiveMenu && {
      composition_layers: intOr(input.expressiveMenu.compositionLayers),
      composition_shapes: intOr(input.expressiveMenu.compositionShapes),
      selected_visible: Boolean(input.expressiveMenu.selectedVisible),
      focusable_item_count: intOr(input.expressiveMenu.focusableItemCount),
      semantic_menu_text: Boolean(input.expressiveMenu.semanticMenuText),
      diagonal_evidence: Boolean(input.expressiveMenu.diagonalEvidence),
      high_contrast: Boolean(input.expressiveMenu.highContrast),
      low_contrast_item_count: intOr(input.expressiveMenu.lowContrastItemCount),
      hover_changed: input.expressiveMenu.hoverChanged,
      focus_visible_changed: input.expressiveMenu.focusVisibleChanged,
    },
  });
  if (output === "pass" || output === "review" || output === "fail") {
    return output;
  }
  throw new Error(`unexpected markup-core status: ${output}`);
}

export interface RunMarkupCoreOptions {
  /**
   * When `false`, the result is not memoized. Use for commands whose
   * args list can be megabytes (e.g. landscape-diff-summary forwards
   * per-cell stats), otherwise the cache turns into a leak.
   */
  cache?: boolean;
}

export function runMarkupCore(args: string[], options?: RunMarkupCoreOptions): string {
  const useCache = options?.cache !== false;
  const cacheKey = useCache ? JSON.stringify(args) : null;
  if (cacheKey !== null) {
    const cached = runMarkupCoreCache.get(cacheKey);
    if (cached !== undefined) return cached;
  }
  let directOutput = runMarkupCoreDirect(args);
  if (directOutput !== undefined) {
    if (cacheKey !== null) runMarkupCoreCache.set(cacheKey, directOutput);
    return directOutput;
  }
  ensureMarkupCoreCli();
  directOutput = runMarkupCoreDirect(args);
  if (directOutput !== undefined) {
    if (cacheKey !== null) runMarkupCoreCache.set(cacheKey, directOutput);
    return directOutput;
  }
  const output = run(process.execPath, [cliPath, ...args]);
  runtimeBackend = "spawn";
  if (cacheKey !== null) runMarkupCoreCache.set(cacheKey, output);
  return output;
}

export function getMarkupCoreRuntimeBackend(): "direct-js" | "spawn" {
  return runtimeBackend;
}

/**
 * The JSON boundary to markup-core. Prefer this for new logic.
 *
 * `runMarkupCore` above encodes tab-separated positional strings, which is why
 * exposing one pure function costs a hand-written encoder here plus an arm in two
 * MoonBit dispatch tables. It also cannot express a record or an array, and with
 * 36 positional arguments in the largest command, two same-typed arguments in the
 * wrong order is a silent behaviour change no compiler on either side can see.
 *
 * Here the argument is one object and MoonBit's `derive(FromJson)` generates the
 * decoder, so a wrong field name or type raises with the field's JSON path.
 *
 * **Absent means omitted, not null.** MoonBit decodes an `Option` field from a
 * missing key; explicit `null` fails with "expected number". `JSON.stringify`
 * already drops `undefined`, but a lot of TypeScript spells absence as `null`, so
 * nulls are stripped here rather than at every call site — otherwise the first
 * caller to write `null` gets a decode error about a field they did supply. An
 * explicitly-null value for a *required* field still fails, just as a missing one
 * would.
 */
export function callMarkupCoreJson<TOut>(command: string, input: unknown): TOut {
  const payload = JSON.stringify(stripAbsent(input));
  const output = runMarkupCoreJsonRaw(command, payload);
  try {
    return JSON.parse(output) as TOut;
  } catch (e) {
    throw new Error(
      `markup-core ${command} returned output that is not JSON: ${JSON.stringify(output.slice(0, 200))}`
      + ` (${e instanceof Error ? e.message : String(e)})`,
    );
  }
}

/**
 * Normalising a value on its way to the JSON boundary.
 *
 * The positional encoders these replaced did this and it was load-bearing, which
 * only became clear after removing them: `doubleArg` mapped anything non-finite to
 * `0`, `intArg` truncated and defaulted to `0`, `boolArg` mapped `undefined` to
 * `false`. Dropping that turned a malformed input from "the rule reports the
 * problem" into "the decoder raises before the rule runs".
 *
 * That matters most where it is worst: `vlmkit contract validate` does
 * `JSON.parse(file) as UiContract` with no runtime schema check, so arbitrary user
 * JSON reaches these wrappers. A contract whose viewport omits `width` used to
 * report `viewport-size-positive`; without these helpers it aborted with
 * `Missing field width`. **The one input a validator has to survive is an invalid
 * document.**
 *
 * Exported because the per-domain wrapper modules (`markup-core-a11y-*`,
 * `markup-core-landscape.ts`, …) each had their own private copy of the old
 * `doubleArg` / `intArg`. Those normalised on the way to a string; on the JSON path
 * the normalisation has to happen before serializing instead, and having six
 * near-identical private copies is how one of them ends up different.
 *
 * This is normalisation, not coercion: a missing number becomes the same `0` the
 * old wire sent, so the rule sees what it always saw and reports what it always
 * reported. Nothing is silently reinterpreted — a string `"1280"` becomes `0` and
 * is reported as non-positive, exactly as before.
 */
export function finiteOr(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/** Like `finiteOr`, but absent stays absent — for fields typed `Double?` in MoonBit. */
function optionalFinite(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/** `intArg`'s truncation, kept because MoonBit's `Int` would reject a fraction. */
export function intOr(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : fallback;
}

/** `boolArg`: anything not a boolean was `false` on the wire. */
export function flag(value: unknown): boolean {
  return value === true;
}

/**
 * A string array with non-strings dropped.
 *
 * The old path joined on `|` and MoonBit's `split_list` discarded empty segments,
 * so `[null, "mode"]` arrived as `["mode"]`. `stripAbsent` cannot do this: it walks
 * object properties, and a `null` *inside* an array survives to be rejected by
 * `Array[String]`. Reachable through a contract's `canvas.requiredStateFields`,
 * which nothing validates elementwise.
 */
function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

/** Recursively drop `null` / `undefined`, so absence reaches MoonBit as omission. */
function stripAbsent(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripAbsent);
  if (value === null || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (item === null || item === undefined) continue;
    out[key] = stripAbsent(item);
  }
  return out;
}

/**
 * Same two-backend fallback as `runMarkupCore`: the direct JS module when it
 * loads, a build-then-retry, then the spawned CLI. Both backends dispatch through
 * one table in `markup-core`, so they cannot disagree about a command.
 *
 * Not cached, unlike the positional path. That cache is keyed on the argument
 * array and these payloads can be large, so caching them would grow a map that
 * nothing evicts for calls that are already sub-millisecond.
 */
function runMarkupCoreJsonRaw(command: string, payload: string): string {
  const direct = () => {
    const api = loadMarkupCoreApi();
    if (!api?.run_markup_core_json) return undefined;
    runtimeBackend = "direct-js";
    return unwrapMoonBitResult(api.run_markup_core_json(command, payload)).trim();
  };
  const first = direct();
  if (first !== undefined) return first;
  ensureMarkupCoreCli();
  const second = direct();
  if (second !== undefined) return second;
  runtimeBackend = "spawn";
  return run(process.execPath, [cliPath, "--json", command, payload]).trim();
}

/** Commands the MoonBit side accepts, for a test that the two views agree. */
export function markupCoreJsonCommands(): string[] {
  const api = loadMarkupCoreApi();
  if (!api?.markup_core_json_commands) {
    ensureMarkupCoreCli();
  }
  const loaded = loadMarkupCoreApi();
  if (!loaded?.markup_core_json_commands) {
    throw new Error("markup-core JSON API is unavailable; run `moon build` in packages/vlmkit-markup");
  }
  return JSON.parse(unwrapMoonBitResult(loaded.markup_core_json_commands()).trim()) as string[];
}

function runMarkupCoreDirect(args: string[]): string | undefined {
  const command = args[0];
  if (!command) return undefined;
  const encodedArgs = encodeDirectArgs(args.slice(1));
  if (encodedArgs === undefined) return undefined;
  const api = loadMarkupCoreApi();
  if (!api) return undefined;
  runtimeBackend = "direct-js";
  return unwrapMoonBitResult(api.run_markup_core(command, encodedArgs)).trim();
}

function encodeDirectArgs(args: string[]): string | undefined {
  const encoded: string[] = [];
  for (const arg of args) {
    if (arg.includes(directArgSeparator) || arg === directEmptyArg) {
      return undefined;
    }
    encoded.push(arg === "" ? directEmptyArg : arg);
  }
  return encoded.join(directArgSeparator);
}

/**
 * Copy the entry points we know about, rather than holding the whole generated
 * module.
 *
 * This used to inline `{ run_markup_core }`, which silently dropped every other
 * export — so the JSON boundary's functions were invisible and every JSON call
 * fell through to spawning the CLI while appearing to work. Listing the names is
 * what keeps that from recurring unnoticed: a new export has to be added here, and
 * `markup-core-json.test.ts` asserts the direct backend is the one actually used.
 */
function pickDirectApi(source: Partial<DirectMarkupCoreModule>): DirectMarkupCoreModule {
  return {
    run_markup_core: source.run_markup_core!,
    ...(typeof source.run_markup_core_json === "function"
      ? { run_markup_core_json: source.run_markup_core_json }
      : {}),
    ...(typeof source.markup_core_json_commands === "function"
      ? { markup_core_json_commands: source.markup_core_json_commands }
      : {}),
  };
}

function loadMarkupCoreApi(): DirectMarkupCoreModule | undefined {
  if (directModule) return directModule;
  const injected = (
    globalThis as typeof globalThis & {
      [injectedDirectModuleKey]?: Partial<DirectMarkupCoreModule>;
    }
  )[injectedDirectModuleKey];
  if (typeof injected?.run_markup_core === "function") {
    directModule = pickDirectApi(injected);
    return directModule;
  }
  if (directModuleUnavailable) return undefined;
  try {
    const loaded = requireGenerated(apiPath) as Partial<DirectMarkupCoreModule>;
    if (typeof loaded.run_markup_core === "function") {
      directModule = pickDirectApi(loaded);
      return directModule;
    }
  } catch {
    directModuleUnavailable = true;
    return undefined;
  }
  directModuleUnavailable = true;
  return undefined;
}

function unwrapMoonBitResult(value: unknown): string {
  if (isMoonBitResult(value)) {
    if (value.$tag === 1) {
      return String(value._0);
    }
    // `String(value._0)` was `[object Object]` for every error MoonBit's stdlib
    // raises, which meant the JSON boundary's whole selling point — a decode error
    // that names the field — was invisible on the default backend.
    throw new Error(
      `markup-core direct call failed: ${describeMoonBitError(value._0) ?? String(value._0)}`,
    );
  }
  return String(value);
}

function isMoonBitResult(
  value: unknown,
): value is { $tag: 0 | 1; _0: unknown } {
  return (
    typeof value === "object" &&
    value !== null &&
    "$tag" in value &&
    "_0" in value
  );
}

export function isMarkupCoreComponentProbeState(value: string): boolean {
  return runMarkupCore(["is-component-probe-state", value]) === "true";
}

export function isMarkupCoreForcedPseudoState(value: string): boolean {
  return runMarkupCore(["is-forced-pseudo-state", value]) === "true";
}

export function computeComponentProbeStates(requiredStateKinds: string[]): string[] {
  return splitList(runMarkupCore(["component-probe-states", joinList(requiredStateKinds)]));
}

export function mergeMarkupCoreComponentProbeStates(
  explicit: string[] | undefined,
  injected: string[],
): string[] {
  return splitList(
    runMarkupCore([
      "merge-component-probe-states",
      joinList(explicit ?? []),
      joinList(injected),
    ]),
  );
}

export type MarkupCoreScrollTargetSource = "state-targets" | "expected-scrollports" | "none";

export function computeComponentScrollTargetSource(
  requiredStateKinds: string[],
  explicitScrolledTargetCount: number,
): MarkupCoreScrollTargetSource {
  const output = runMarkupCore([
    "component-scroll-target-source",
    joinList(requiredStateKinds),
    intArg(explicitScrolledTargetCount),
  ]);
  if (
    output === "state-targets" ||
    output === "expected-scrollports" ||
    output === "none"
  ) {
    return output;
  }
  throw new Error(`unexpected markup-core scroll target source: ${output}`);
}

export type MarkupCoreSemanticDrilldownReasonId =
  | "coarse-landscape"
  | "local-kinds"
  | "local-pixel";

export interface MarkupCoreSemanticDrilldownPolicy {
  flow: "layout" | "decoration";
  priorityScore: number;
  reasonId: MarkupCoreSemanticDrilldownReasonId;
}

export function computeSemanticDrilldownPolicy(
  layoutScore: number,
  decorationScore: number,
  heatmapKindCount: number,
): MarkupCoreSemanticDrilldownPolicy {
  const output = runMarkupCore([
    "semantic-drilldown-policy",
    doubleArg(layoutScore),
    doubleArg(decorationScore),
    intArg(heatmapKindCount),
  ]);
  const [flow, priorityScore, reasonId] = output.split("|");
  if (flow !== "layout" && flow !== "decoration") {
    throw new Error(`unexpected markup-core semantic flow: ${output}`);
  }
  if (
    reasonId !== "coarse-landscape" &&
    reasonId !== "local-kinds" &&
    reasonId !== "local-pixel"
  ) {
    throw new Error(`unexpected markup-core semantic reason: ${output}`);
  }
  const parsedPriority = Number(priorityScore);
  if (!Number.isFinite(parsedPriority)) {
    throw new Error(`unexpected markup-core semantic priority: ${output}`);
  }
  return {
    flow,
    priorityScore: parsedPriority,
    reasonId,
  };
}

export function selectMarkupCoreSemanticDrilldownIndex(
  entries: {
    flow: "layout" | "decoration";
    priorityScore: number;
    order: number;
  }[],
): number | undefined {
  if (entries.length === 0) return undefined;
  const output = runMarkupCore([
    "semantic-drilldown-select-index",
    joinList(entries.map((entry) => entry.flow)),
    joinList(entries.map((entry) => doubleArg(entry.priorityScore))),
    joinList(entries.map((entry) => intArg(entry.order))),
  ]);
  const index = Number(output);
  if (!Number.isInteger(index)) {
    throw new Error(`unexpected markup-core semantic index: ${output}`);
  }
  return index >= 0 ? index : undefined;
}

export type MarkupCoreUiContractPatternEvidenceIssueId =
  | "landing-marker-primary-cta"
  | "landing-marker-media-slot"
  | "landing-marker-next-section"
  | "app-shell-marker-scrollport"
  | "app-shell-expected-scrollports"
  | "app-shell-state-selected"
  | "app-shell-state-scrolled"
  | "canvas-state-hook"
  | "canvas-state-field-mode"
  | "canvas-state-field-frame"
  | "canvas-state-field-playerX"
  | "canvas-state-field-playerY"
  | "canvas-state-field-score"
  | "canvas-state-field-assetsReady"
  | "expressive-menu-composition"
  | "expressive-menu-state-evidence"
  | "expressive-menu-required-selected"
  | "expressive-menu-required-hover"
  | "expressive-menu-required-focus-visible";

export type MarkupCoreUiContractVersionIssueId =
  "contract-version-unsupported";

export type MarkupCoreUiContractScreenIssueId =
  | "screen-id-required"
  | "screen-pattern-unknown"
  | "screen-goal-unknown"
  | "screen-source-of-truth-unknown";

export type MarkupCoreUiContractViewportIssueId =
  | "viewport-label-required"
  | "viewport-label-unique"
  | "viewport-size-positive"
  | "viewport-dpr-positive";

export type MarkupCoreUiContractLandmarkIssueId =
  | "landmark-abstract-role"
  | "landmark-id-required"
  | "landmark-name-required"
  | "landmark-parent-unknown";

export type MarkupCoreUiContractResponsiveRuleIssueId =
  "responsive-rule-viewport-unknown";

export type MarkupCoreUiContractMarkerIssueId =
  | "marker-kind-unknown"
  | "marker-target-required";

export type MarkupCoreUiContractRangeIssueId =
  | "range-min-non-negative"
  | "range-max-non-negative"
  | "range-min-lte-max";

export type MarkupCoreUiContractSlotIssueId = "slot-id-required";

export type MarkupCoreUiContractAssetIssueId = "asset-id-required";

export type MarkupCoreUiContractCanvasIssueId = "canvas-state-hook-required";

export type MarkupCoreUiContractCanvasInputIssueId =
  "canvas-input-action-required";

export type MarkupCoreUiContractCanvasHudIssueId = "canvas-hud-id-required";

export type MarkupCoreUiContractCompositionIssueId =
  "composition-style-unknown";

export type MarkupCoreUiContractCompositionAxisIssueId =
  "composition-axis-unknown";

export type MarkupCoreUiContractCompositionLayerIssueId =
  | "composition-layer-id-required"
  | "composition-layer-id-unique"
  | "composition-layer-role-unknown"
  | "composition-layer-z-finite";

export type MarkupCoreUiContractCompositionShapeIssueId =
  | "composition-shape-id-required"
  | "composition-shape-id-unique"
  | "composition-shape-kind-unknown";

export type MarkupCoreUiContractCompositionMotionIssueId =
  | "motion-id-required"
  | "motion-id-unique"
  | "motion-trigger-unknown"
  | "motion-effect-unknown"
  | "motion-duration-non-negative";

export type MarkupCoreUiContractCompositionContrastIssueId =
  | "contrast-mode-unknown"
  | "contrast-min-ratio-positive";

export type MarkupCoreUiContractCompositionContrastPaletteIssueId =
  "contrast-palette-value-hex";

export type MarkupCoreUiContractDecorationTypographyIssueId =
  | "typography-role-required"
  | "typography-size-positive"
  | "typography-line-height-positive";

export type MarkupCoreUiContractDecorationPaletteIssueId =
  | "palette-role-required"
  | "palette-value-hex";

export type MarkupCoreUiContractDecorationMediaIssueId =
  "media-slot-required";

export type MarkupCoreUiContractContentItemsIssueId =
  "content-items-exact-non-negative";

export type MarkupCoreUiContractContentTextIssueId =
  "content-text-row-count-non-negative";

export type MarkupCoreUiContractLayoutIssueId =
  | "layout-width-fluid-bounds"
  | "layout-width-fixed-positive"
  | "layout-height-fixed-positive"
  | "layout-height-scrollport-max-positive"
  | "layout-grid-columns"
  | "layout-grid-rows";

export type MarkupCoreUiContractStateIssueId =
  | "state-id-required"
  | "state-kind-unknown"
  | "state-target-required";

export type MarkupCoreUiContractRequiredStateIssueId =
  | MarkupCoreUiContractStateIssueId
  | "required-state-id-unique"
  | "required-state-min-change-ratio";

export type MarkupCoreUiContractExpectedScrollportIssueId =
  | "expected-scrollport-id-required"
  | "expected-scrollport-id-unique"
  | "expected-scrollport-axis-unknown"
  | "expected-scrollport-target-required"
  | "expected-scrollport-min-overflow";

export function computeUiContractVersionIssueIds(input: {
  version: number;
}): MarkupCoreUiContractVersionIssueId[] {
  const output = runMarkupCore([
    "ui-contract-version-issue-ids",
    intArg(input.version),
  ]);
  return splitList(output).map((issueId) => {
    if (isMarkupCoreUiContractVersionIssueId(issueId)) {
      return issueId;
    }
    throw new Error(
      `unexpected markup-core UI contract version issue id: ${issueId}`,
    );
  });
}

export function computeUiContractScreenIssueIds(input: {
  id: string;
  pattern?: string;
  goal?: string;
  sourceOfTruth?: string;
}): MarkupCoreUiContractScreenIssueId[] {
  const issueIds = callMarkupCoreJson<string[]>("screen-issue-ids", {
    id: input.id,
    pattern: input.pattern ?? "",
    goal: input.goal ?? "",
    source_of_truth: input.sourceOfTruth ?? "",
  });
  return issueIds.map((issueId) => {
    if (isMarkupCoreUiContractScreenIssueId(issueId)) {
      return issueId;
    }
    throw new Error(
      `unexpected markup-core UI contract screen issue id: ${issueId}`,
    );
  });
}

export function computeUiContractViewportIssueIds(input: {
  label: string;
  duplicateLabel: boolean;
  width: number;
  height: number;
  dprPresent: boolean;
  dpr: number;
}): MarkupCoreUiContractViewportIssueId[] {
  const issueIds = callMarkupCoreJson<string[]>("viewport-issue-ids", {
    label: input.label,
    duplicate_label: flag(input.duplicateLabel),
    width: finiteOr(input.width),
    height: finiteOr(input.height),
    // The present/value pair collapses: absent is absent, not 0.
    dpr: input.dprPresent ? finiteOr(input.dpr) : undefined,
  });
  return issueIds.map((issueId) => {
    if (isMarkupCoreUiContractViewportIssueId(issueId)) {
      return issueId;
    }
    throw new Error(
      `unexpected markup-core UI contract viewport issue id: ${issueId}`,
    );
  });
}

export function computeUiContractLandmarkIssueIds(input: {
  id: string;
  role: string;
  name: string;
  parentIdPresent: boolean;
  parentKnown: boolean;
}): MarkupCoreUiContractLandmarkIssueId[] {
  const issueIds = callMarkupCoreJson<string[]>("landmark-issue-ids", {
    id: input.id,
    role: input.role,
    name: input.name,
    parent_id_present: flag(input.parentIdPresent),
    parent_known: flag(input.parentKnown),
  });
  return issueIds.map((issueId) => {
    if (isMarkupCoreUiContractLandmarkIssueId(issueId)) {
      return issueId;
    }
    throw new Error(
      `unexpected markup-core UI contract landmark issue id: ${issueId}`,
    );
  });
}

export function computeUiContractResponsiveRuleIssueIds(input: {
  viewportKnown: boolean;
}): MarkupCoreUiContractResponsiveRuleIssueId[] {
  const output = runMarkupCore([
    "ui-contract-responsive-rule-issue-ids",
    boolArg(input.viewportKnown),
  ]);
  return splitList(output).map((issueId) => {
    if (isMarkupCoreUiContractResponsiveRuleIssueId(issueId)) {
      return issueId;
    }
    throw new Error(
      `unexpected markup-core UI contract responsive rule issue id: ${issueId}`,
    );
  });
}

export function computeUiContractPatternEvidenceIssueIds(input: {
  pattern: string | undefined;
  markerKinds: string[];
  requiredStateKinds: string[];
  stateKinds: string[];
  expectedScrollportCount: number;
  hasComposition: boolean;
  hasCanvasStateHook: boolean;
  canvasRequiredStateFields: string[];
}): MarkupCoreUiContractPatternEvidenceIssueId[] {
  const issueIds = callMarkupCoreJson<string[]>("pattern-evidence-issue-ids", {
    pattern: input.pattern ?? "",
    // Arrays, not a pipe-joined string: no element can now break the encoding.
    marker_kinds: stringList(input.markerKinds),
    required_state_kinds: stringList(input.requiredStateKinds),
    state_kinds: stringList(input.stateKinds),
    expected_scrollport_count: intOr(input.expectedScrollportCount),
    has_composition: flag(input.hasComposition),
    has_canvas_state_hook: flag(input.hasCanvasStateHook),
    canvas_required_state_fields: stringList(input.canvasRequiredStateFields),
  });
  return issueIds.map((issueId) => {
    if (isMarkupCoreUiContractPatternEvidenceIssueId(issueId)) {
      return issueId;
    }
    throw new Error(`unexpected markup-core UI contract issue id: ${issueId}`);
  });
}

export function computeUiContractMarkerIssueIds(input: {
  kind: string;
  required: boolean;
  hasSelector: boolean;
  hasAttribute: boolean;
  hasTarget: boolean;
}): MarkupCoreUiContractMarkerIssueId[] {
  const issueIds = callMarkupCoreJson<string[]>("marker-issue-ids", {
    kind: input.kind,
    required: flag(input.required),
    has_selector: flag(input.hasSelector),
    has_attribute: flag(input.hasAttribute),
    has_target: flag(input.hasTarget),
  });
  return issueIds.map((issueId) => {
    if (isMarkupCoreUiContractMarkerIssueId(issueId)) {
      return issueId;
    }
    throw new Error(`unexpected markup-core UI contract marker issue id: ${issueId}`);
  });
}

export function computeUiContractOptionalRangeIssueIds(input: {
  min?: number;
  max?: number;
}): MarkupCoreUiContractRangeIssueId[] {
  const output = runMarkupCore([
    "ui-contract-optional-range-issue-ids",
    boolArg(input.min !== undefined),
    doubleArg(input.min ?? 0),
    boolArg(input.max !== undefined),
    doubleArg(input.max ?? 0),
  ]);
  return splitList(output).map((issueId) => {
    if (isMarkupCoreUiContractRangeIssueId(issueId)) {
      return issueId;
    }
    throw new Error(`unexpected markup-core UI contract range issue id: ${issueId}`);
  });
}

export function computeUiContractSlotIssueIds(input: {
  id: string;
}): MarkupCoreUiContractSlotIssueId[] {
  const output = runMarkupCore(["ui-contract-slot-issue-ids", input.id]);
  return splitList(output).map((issueId) => {
    if (isMarkupCoreUiContractSlotIssueId(issueId)) {
      return issueId;
    }
    throw new Error(`unexpected markup-core UI contract slot issue id: ${issueId}`);
  });
}

export function computeUiContractAssetIssueIds(input: {
  id: string;
}): MarkupCoreUiContractAssetIssueId[] {
  const output = runMarkupCore(["ui-contract-asset-issue-ids", input.id]);
  return splitList(output).map((issueId) => {
    if (isMarkupCoreUiContractAssetIssueId(issueId)) {
      return issueId;
    }
    throw new Error(`unexpected markup-core UI contract asset issue id: ${issueId}`);
  });
}

export function computeUiContractCanvasIssueIds(input: {
  hasStateHook: boolean;
  requiredStateFieldCount: number;
}): MarkupCoreUiContractCanvasIssueId[] {
  const output = runMarkupCore([
    "ui-contract-canvas-issue-ids",
    boolArg(input.hasStateHook),
    intArg(input.requiredStateFieldCount),
  ]);
  return splitList(output).map((issueId) => {
    if (isMarkupCoreUiContractCanvasIssueId(issueId)) {
      return issueId;
    }
    throw new Error(`unexpected markup-core UI contract canvas issue id: ${issueId}`);
  });
}

export function computeUiContractCanvasInputIssueIds(input: {
  action: string;
}): MarkupCoreUiContractCanvasInputIssueId[] {
  const output = runMarkupCore([
    "ui-contract-canvas-input-issue-ids",
    input.action,
  ]);
  return splitList(output).map((issueId) => {
    if (isMarkupCoreUiContractCanvasInputIssueId(issueId)) {
      return issueId;
    }
    throw new Error(`unexpected markup-core UI contract canvas input issue id: ${issueId}`);
  });
}

export function computeUiContractCanvasHudIssueIds(input: {
  id: string;
}): MarkupCoreUiContractCanvasHudIssueId[] {
  const output = runMarkupCore(["ui-contract-canvas-hud-issue-ids", input.id]);
  return splitList(output).map((issueId) => {
    if (isMarkupCoreUiContractCanvasHudIssueId(issueId)) {
      return issueId;
    }
    throw new Error(`unexpected markup-core UI contract canvas HUD issue id: ${issueId}`);
  });
}

export function computeUiContractCompositionIssueIds(input: {
  style: string;
}): MarkupCoreUiContractCompositionIssueId[] {
  const output = runMarkupCore([
    "ui-contract-composition-issue-ids",
    input.style,
  ]);
  return splitList(output).map((issueId) => {
    if (isMarkupCoreUiContractCompositionIssueId(issueId)) {
      return issueId;
    }
    throw new Error(`unexpected markup-core UI contract composition issue id: ${issueId}`);
  });
}

export function computeUiContractCompositionAxisIssueIds(input: {
  axis: string;
}): MarkupCoreUiContractCompositionAxisIssueId[] {
  const output = runMarkupCore([
    "ui-contract-composition-axis-issue-ids",
    input.axis,
  ]);
  return splitList(output).map((issueId) => {
    if (isMarkupCoreUiContractCompositionAxisIssueId(issueId)) {
      return issueId;
    }
    throw new Error(`unexpected markup-core UI contract composition axis issue id: ${issueId}`);
  });
}

export function computeUiContractCompositionLayerIssueIds(input: {
  id: string;
  role: string;
  duplicateId: boolean;
  zPresent: boolean;
  zFinite: boolean;
}): MarkupCoreUiContractCompositionLayerIssueId[] {
  const issueIds = callMarkupCoreJson<string[]>("composition-layer-issue-ids", {
    id: input.id,
    role: input.role,
    duplicate_id: flag(input.duplicateId),
    // Absent means no z declared at all; `false` means one was and is not finite.
    z_finite: input.zPresent ? flag(input.zFinite) : undefined,
  });
  return issueIds.map((issueId) => {
    if (isMarkupCoreUiContractCompositionLayerIssueId(issueId)) {
      return issueId;
    }
    throw new Error(`unexpected markup-core UI contract composition layer issue id: ${issueId}`);
  });
}

export function computeUiContractCompositionShapeIssueIds(input: {
  id: string;
  kind: string;
  duplicateId: boolean;
}): MarkupCoreUiContractCompositionShapeIssueId[] {
  const issueIds = callMarkupCoreJson<string[]>("composition-shape-issue-ids", {
    id: input.id,
    kind: input.kind,
    duplicate_id: flag(input.duplicateId),
  });
  return issueIds.map((issueId) => {
    if (isMarkupCoreUiContractCompositionShapeIssueId(issueId)) {
      return issueId;
    }
    throw new Error(`unexpected markup-core UI contract composition shape issue id: ${issueId}`);
  });
}

export function computeUiContractCompositionMotionIssueIds(input: {
  id: string;
  trigger: string;
  effect: string;
  duplicateId: boolean;
  durationPresent: boolean;
  durationMs: number;
}): MarkupCoreUiContractCompositionMotionIssueId[] {
  const issueIds = callMarkupCoreJson<string[]>("composition-motion-issue-ids", {
    id: input.id,
    trigger: input.trigger,
    effect: input.effect,
    duplicate_id: flag(input.duplicateId),
    duration_ms: input.durationPresent ? finiteOr(input.durationMs) : undefined,
  });
  return issueIds.map((issueId) => {
    if (isMarkupCoreUiContractCompositionMotionIssueId(issueId)) {
      return issueId;
    }
    throw new Error(`unexpected markup-core UI contract composition motion issue id: ${issueId}`);
  });
}

export function computeUiContractCompositionContrastIssueIds(input: {
  mode: string;
  minRatioPresent: boolean;
  minRatio: number;
}): MarkupCoreUiContractCompositionContrastIssueId[] {
  const output = runMarkupCore([
    "ui-contract-composition-contrast-issue-ids",
    input.mode,
    boolArg(input.minRatioPresent),
    doubleArg(input.minRatio),
  ]);
  return splitList(output).map((issueId) => {
    if (isMarkupCoreUiContractCompositionContrastIssueId(issueId)) {
      return issueId;
    }
    throw new Error(`unexpected markup-core UI contract composition contrast issue id: ${issueId}`);
  });
}

export function computeUiContractCompositionContrastPaletteIssueIds(input: {
  value: string;
}): MarkupCoreUiContractCompositionContrastPaletteIssueId[] {
  const output = runMarkupCore([
    "ui-contract-composition-contrast-palette-issue-ids",
    input.value,
  ]);
  return splitList(output).map((issueId) => {
    if (isMarkupCoreUiContractCompositionContrastPaletteIssueId(issueId)) {
      return issueId;
    }
    throw new Error(`unexpected markup-core UI contract composition contrast palette issue id: ${issueId}`);
  });
}

export function computeUiContractDecorationTypographyIssueIds(input: {
  role: string;
  size?: number;
  lineHeight?: number;
}): MarkupCoreUiContractDecorationTypographyIssueId[] {
  const output = runMarkupCore([
    "ui-contract-decoration-typography-issue-ids",
    input.role,
    boolArg(input.size !== undefined),
    doubleArg(input.size ?? 0),
    boolArg(input.lineHeight !== undefined),
    doubleArg(input.lineHeight ?? 0),
  ]);
  return splitList(output).map((issueId) => {
    if (isMarkupCoreUiContractDecorationTypographyIssueId(issueId)) {
      return issueId;
    }
    throw new Error(`unexpected markup-core UI contract decoration typography issue id: ${issueId}`);
  });
}

export function computeUiContractDecorationPaletteIssueIds(input: {
  role: string;
  value?: string;
}): MarkupCoreUiContractDecorationPaletteIssueId[] {
  const issueIds = callMarkupCoreJson<string[]>("decoration-palette-issue-ids", {
    role: input.role,
    value: input.value,
  });
  return issueIds.map((issueId) => {
    if (isMarkupCoreUiContractDecorationPaletteIssueId(issueId)) {
      return issueId;
    }
    throw new Error(`unexpected markup-core UI contract decoration palette issue id: ${issueId}`);
  });
}

export function computeUiContractDecorationMediaIssueIds(input: {
  slot: string;
}): MarkupCoreUiContractDecorationMediaIssueId[] {
  const output = runMarkupCore([
    "ui-contract-decoration-media-issue-ids",
    input.slot,
  ]);
  return splitList(output).map((issueId) => {
    if (isMarkupCoreUiContractDecorationMediaIssueId(issueId)) {
      return issueId;
    }
    throw new Error(`unexpected markup-core UI contract decoration media issue id: ${issueId}`);
  });
}

export function computeUiContractContentItemsIssueIds(input: {
  exact?: number;
}): MarkupCoreUiContractContentItemsIssueId[] {
  const output = runMarkupCore([
    "ui-contract-content-items-issue-ids",
    boolArg(input.exact !== undefined),
    doubleArg(input.exact ?? 0),
  ]);
  return splitList(output).map((issueId) => {
    if (isMarkupCoreUiContractContentItemsIssueId(issueId)) {
      return issueId;
    }
    throw new Error(`unexpected markup-core UI contract content items issue id: ${issueId}`);
  });
}

export function computeUiContractContentTextIssueIds(input: {
  rowCount?: number;
}): MarkupCoreUiContractContentTextIssueId[] {
  const output = runMarkupCore([
    "ui-contract-content-text-issue-ids",
    boolArg(input.rowCount !== undefined),
    doubleArg(input.rowCount ?? 0),
  ]);
  return splitList(output).map((issueId) => {
    if (isMarkupCoreUiContractContentTextIssueId(issueId)) {
      return issueId;
    }
    throw new Error(`unexpected markup-core UI contract content text issue id: ${issueId}`);
  });
}

export function computeUiContractLayoutIssueIds(input: {
  widthKind?: string;
  widthMinPresent?: boolean;
  widthMaxPresent?: boolean;
  widthValue?: number;
  heightKind?: string;
  heightValue?: number;
  heightMax?: number;
  displayKind?: string;
  displayColumnsCount?: number;
  displayRowsCount?: number;
}): MarkupCoreUiContractLayoutIssueId[] {
  // First caller on the JSON boundary. Ten positional strings became one record,
  // and the two "present?" + "value" argument pairs the positional form needed
  // collapsed into optional fields — so "unspecified" and "zero" are no longer the
  // same thing on the wire, which they were when an absent width became `0`.
  const issueIds = callMarkupCoreJson<string[]>("layout-policy-issue-ids", {
    width_kind: input.widthKind ?? "",
    width_min: input.widthMinPresent ? 1 : undefined,
    width_max: input.widthMaxPresent ? 1 : undefined,
    width_value: optionalFinite(input.widthValue),
    height_kind: input.heightKind ?? "",
    height_value: optionalFinite(input.heightValue),
    height_max: optionalFinite(input.heightMax),
    display_kind: input.displayKind ?? "",
    display_columns_count: intOr(input.displayColumnsCount),
    display_rows_count: intOr(input.displayRowsCount),
  });
  return issueIds.map((issueId) => {
    if (isMarkupCoreUiContractLayoutIssueId(issueId)) {
      return issueId;
    }
    throw new Error(`unexpected markup-core UI contract layout issue id: ${issueId}`);
  });
}

export function computeUiContractStateIssueIds(input: {
  id: string;
  kind: string;
  required: boolean;
  hasSelector: boolean;
  hasTrigger: boolean;
}): MarkupCoreUiContractStateIssueId[] {
  const issueIds = callMarkupCoreJson<string[]>("state-issue-ids", {
    id: input.id,
    kind: input.kind,
    required: flag(input.required),
    has_selector: flag(input.hasSelector),
    has_trigger: flag(input.hasTrigger),
  });
  return issueIds.map((issueId) => {
    if (isMarkupCoreUiContractStateIssueId(issueId)) {
      return issueId;
    }
    throw new Error(`unexpected markup-core UI contract state issue id: ${issueId}`);
  });
}

export function computeUiContractRequiredStateIssueIds(input: {
  id: string;
  kind: string;
  required: boolean;
  hasSelector: boolean;
  hasTrigger: boolean;
  duplicateId: boolean;
  minChangeRatioPresent: boolean;
  minChangeRatio: number;
}): MarkupCoreUiContractRequiredStateIssueId[] {
  const issueIds = callMarkupCoreJson<string[]>("required-state-issue-ids", {
    id: input.id,
    kind: input.kind,
    required: flag(input.required),
    has_selector: flag(input.hasSelector),
    has_trigger: flag(input.hasTrigger),
    duplicate_id: flag(input.duplicateId),
    min_change_ratio: input.minChangeRatioPresent ? finiteOr(input.minChangeRatio) : undefined,
  });
  return issueIds.map((issueId) => {
    if (isMarkupCoreUiContractRequiredStateIssueId(issueId)) {
      return issueId;
    }
    throw new Error(`unexpected markup-core UI contract required state issue id: ${issueId}`);
  });
}

export function computeUiContractExpectedScrollportIssueIds(input: {
  id: string;
  axis: string;
  required: boolean;
  hasSelector: boolean;
  hasName: boolean;
  hasLandmarkId: boolean;
  duplicateId: boolean;
  minOverflowPresent: boolean;
  minOverflow: number;
}): MarkupCoreUiContractExpectedScrollportIssueId[] {
  const issueIds = callMarkupCoreJson<string[]>("expected-scrollport-issue-ids", {
    id: input.id,
    axis: input.axis,
    required: flag(input.required),
    has_selector: flag(input.hasSelector),
    has_name: flag(input.hasName),
    has_landmark_id: flag(input.hasLandmarkId),
    duplicate_id: flag(input.duplicateId),
    min_overflow: input.minOverflowPresent ? finiteOr(input.minOverflow) : undefined,
  });
  return issueIds.map((issueId) => {
    if (isMarkupCoreUiContractExpectedScrollportIssueId(issueId)) {
      return issueId;
    }
    throw new Error(`unexpected markup-core UI contract expected scrollport issue id: ${issueId}`);
  });
}

function isMarkupCoreUiContractPatternEvidenceIssueId(
  issueId: string,
): issueId is MarkupCoreUiContractPatternEvidenceIssueId {
  return (
    issueId === "landing-marker-primary-cta" ||
    issueId === "landing-marker-media-slot" ||
    issueId === "landing-marker-next-section" ||
    issueId === "app-shell-marker-scrollport" ||
    issueId === "app-shell-expected-scrollports" ||
    issueId === "app-shell-state-selected" ||
    issueId === "app-shell-state-scrolled" ||
    issueId === "canvas-state-hook" ||
    issueId === "canvas-state-field-mode" ||
    issueId === "canvas-state-field-frame" ||
    issueId === "canvas-state-field-playerX" ||
    issueId === "canvas-state-field-playerY" ||
    issueId === "canvas-state-field-score" ||
    issueId === "canvas-state-field-assetsReady" ||
    issueId === "expressive-menu-composition" ||
    issueId === "expressive-menu-state-evidence" ||
    issueId === "expressive-menu-required-selected" ||
    issueId === "expressive-menu-required-hover" ||
    issueId === "expressive-menu-required-focus-visible"
  );
}

function isMarkupCoreUiContractVersionIssueId(
  issueId: string,
): issueId is MarkupCoreUiContractVersionIssueId {
  return issueId === "contract-version-unsupported";
}

function isMarkupCoreUiContractScreenIssueId(
  issueId: string,
): issueId is MarkupCoreUiContractScreenIssueId {
  return (
    issueId === "screen-id-required" ||
    issueId === "screen-pattern-unknown" ||
    issueId === "screen-goal-unknown" ||
    issueId === "screen-source-of-truth-unknown"
  );
}

function isMarkupCoreUiContractViewportIssueId(
  issueId: string,
): issueId is MarkupCoreUiContractViewportIssueId {
  return (
    issueId === "viewport-label-required" ||
    issueId === "viewport-label-unique" ||
    issueId === "viewport-size-positive" ||
    issueId === "viewport-dpr-positive"
  );
}

function isMarkupCoreUiContractLandmarkIssueId(
  issueId: string,
): issueId is MarkupCoreUiContractLandmarkIssueId {
  return (
    issueId === "landmark-abstract-role" ||
    issueId === "landmark-id-required" ||
    issueId === "landmark-name-required" ||
    issueId === "landmark-parent-unknown"
  );
}

function isMarkupCoreUiContractResponsiveRuleIssueId(
  issueId: string,
): issueId is MarkupCoreUiContractResponsiveRuleIssueId {
  return issueId === "responsive-rule-viewport-unknown";
}

function isMarkupCoreUiContractLayoutIssueId(
  issueId: string,
): issueId is MarkupCoreUiContractLayoutIssueId {
  return (
    issueId === "layout-width-fluid-bounds" ||
    issueId === "layout-width-fixed-positive" ||
    issueId === "layout-height-fixed-positive" ||
    issueId === "layout-height-scrollport-max-positive" ||
    issueId === "layout-grid-columns" ||
    issueId === "layout-grid-rows"
  );
}

function isMarkupCoreUiContractMarkerIssueId(
  issueId: string,
): issueId is MarkupCoreUiContractMarkerIssueId {
  return (
    issueId === "marker-kind-unknown" ||
    issueId === "marker-target-required"
  );
}

function isMarkupCoreUiContractRangeIssueId(
  issueId: string,
): issueId is MarkupCoreUiContractRangeIssueId {
  return (
    issueId === "range-min-non-negative" ||
    issueId === "range-max-non-negative" ||
    issueId === "range-min-lte-max"
  );
}

function isMarkupCoreUiContractSlotIssueId(
  issueId: string,
): issueId is MarkupCoreUiContractSlotIssueId {
  return issueId === "slot-id-required";
}

function isMarkupCoreUiContractAssetIssueId(
  issueId: string,
): issueId is MarkupCoreUiContractAssetIssueId {
  return issueId === "asset-id-required";
}

function isMarkupCoreUiContractCanvasIssueId(
  issueId: string,
): issueId is MarkupCoreUiContractCanvasIssueId {
  return issueId === "canvas-state-hook-required";
}

function isMarkupCoreUiContractCanvasInputIssueId(
  issueId: string,
): issueId is MarkupCoreUiContractCanvasInputIssueId {
  return issueId === "canvas-input-action-required";
}

function isMarkupCoreUiContractCanvasHudIssueId(
  issueId: string,
): issueId is MarkupCoreUiContractCanvasHudIssueId {
  return issueId === "canvas-hud-id-required";
}

function isMarkupCoreUiContractCompositionIssueId(
  issueId: string,
): issueId is MarkupCoreUiContractCompositionIssueId {
  return issueId === "composition-style-unknown";
}

function isMarkupCoreUiContractCompositionAxisIssueId(
  issueId: string,
): issueId is MarkupCoreUiContractCompositionAxisIssueId {
  return issueId === "composition-axis-unknown";
}

function isMarkupCoreUiContractCompositionLayerIssueId(
  issueId: string,
): issueId is MarkupCoreUiContractCompositionLayerIssueId {
  return (
    issueId === "composition-layer-id-required" ||
    issueId === "composition-layer-id-unique" ||
    issueId === "composition-layer-role-unknown" ||
    issueId === "composition-layer-z-finite"
  );
}

function isMarkupCoreUiContractCompositionShapeIssueId(
  issueId: string,
): issueId is MarkupCoreUiContractCompositionShapeIssueId {
  return (
    issueId === "composition-shape-id-required" ||
    issueId === "composition-shape-id-unique" ||
    issueId === "composition-shape-kind-unknown"
  );
}

function isMarkupCoreUiContractCompositionMotionIssueId(
  issueId: string,
): issueId is MarkupCoreUiContractCompositionMotionIssueId {
  return (
    issueId === "motion-id-required" ||
    issueId === "motion-id-unique" ||
    issueId === "motion-trigger-unknown" ||
    issueId === "motion-effect-unknown" ||
    issueId === "motion-duration-non-negative"
  );
}

function isMarkupCoreUiContractCompositionContrastIssueId(
  issueId: string,
): issueId is MarkupCoreUiContractCompositionContrastIssueId {
  return (
    issueId === "contrast-mode-unknown" ||
    issueId === "contrast-min-ratio-positive"
  );
}

function isMarkupCoreUiContractCompositionContrastPaletteIssueId(
  issueId: string,
): issueId is MarkupCoreUiContractCompositionContrastPaletteIssueId {
  return issueId === "contrast-palette-value-hex";
}

function isMarkupCoreUiContractDecorationTypographyIssueId(
  issueId: string,
): issueId is MarkupCoreUiContractDecorationTypographyIssueId {
  return (
    issueId === "typography-role-required" ||
    issueId === "typography-size-positive" ||
    issueId === "typography-line-height-positive"
  );
}

function isMarkupCoreUiContractDecorationPaletteIssueId(
  issueId: string,
): issueId is MarkupCoreUiContractDecorationPaletteIssueId {
  return (
    issueId === "palette-role-required" ||
    issueId === "palette-value-hex"
  );
}

function isMarkupCoreUiContractDecorationMediaIssueId(
  issueId: string,
): issueId is MarkupCoreUiContractDecorationMediaIssueId {
  return issueId === "media-slot-required";
}

function isMarkupCoreUiContractContentItemsIssueId(
  issueId: string,
): issueId is MarkupCoreUiContractContentItemsIssueId {
  return issueId === "content-items-exact-non-negative";
}

function isMarkupCoreUiContractContentTextIssueId(
  issueId: string,
): issueId is MarkupCoreUiContractContentTextIssueId {
  return issueId === "content-text-row-count-non-negative";
}

function isMarkupCoreUiContractStateIssueId(
  issueId: string,
): issueId is MarkupCoreUiContractStateIssueId {
  return (
    issueId === "state-id-required" ||
    issueId === "state-kind-unknown" ||
    issueId === "state-target-required"
  );
}

function isMarkupCoreUiContractRequiredStateIssueId(
  issueId: string,
): issueId is MarkupCoreUiContractRequiredStateIssueId {
  return (
    isMarkupCoreUiContractStateIssueId(issueId) ||
    issueId === "required-state-id-unique" ||
    issueId === "required-state-min-change-ratio"
  );
}

function isMarkupCoreUiContractExpectedScrollportIssueId(
  issueId: string,
): issueId is MarkupCoreUiContractExpectedScrollportIssueId {
  return (
    issueId === "expected-scrollport-id-required" ||
    issueId === "expected-scrollport-id-unique" ||
    issueId === "expected-scrollport-axis-unknown" ||
    issueId === "expected-scrollport-target-required" ||
    issueId === "expected-scrollport-min-overflow"
  );
}

export function ensureMarkupCoreCli(): void {
  if (built) return;
  run("moon", [
    "-C",
    packageRoot,
    "build",
    "markup-core",
    "markup-core-api",
    "markup-core-cli",
    "--target",
    "js",
  ]);
  built = true;
  directModuleUnavailable = false;
}

function doubleArg(value: number): string {
  return String(Number.isFinite(value) ? value : 0);
}

function intArg(value: number | undefined): string {
  return typeof value === "number" && Number.isFinite(value)
    ? String(Math.trunc(value))
    : "0";
}

function boolArg(value: boolean | undefined): string {
  return value ? "true" : "false";
}

function joinList(values: string[]): string {
  return values.join("|");
}

function splitList(value: string): string[] {
  return value.length > 0 ? value.split("|") : [];
}

function run(command: string, args: string[]): string {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
  });
  if (result.error) {
    const enoent = (result.error as NodeJS.ErrnoException).code === "ENOENT";
    const hint = enoent && command === "moon"
      ? "\nThe MoonBit `moon` CLI is not on PATH. If installed, add ~/.moon/bin to PATH; otherwise install it: curl -fsSL https://cli.moonbitlang.com/install/unix.sh | bash"
      : "";
    throw new Error(
      `${command} ${args.join(" ")} failed: ${result.error.message}${hint}`,
    );
  }
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join("\n");
    throw new Error(
      `${command} ${args.join(" ")} failed with ${result.status}\n${detail}`,
    );
  }
  return result.stdout.trim();
}
