/**
 * Every migrated command, compared against the positional arm it replaced.
 *
 * `markup-core-goal-status.test.ts` does this for one command with hand-built
 * fixtures. That does not scale to a dozen more, and hand-building fixtures is also
 * where the mistakes were: three rounds of them there before the sweep could catch
 * a swapped field. So this generates the sweep from each command's argument spec.
 *
 * ## How it detects a wiring bug
 *
 * A migration's failure mode is a field decoded into the wrong parameter. Two
 * parameters can only be confused when they have the same type, so for each
 * argument the sweep varies **that argument alone** across type-appropriate values
 * while the rest sit at a base. If arguments i and j were exchanged, varying i
 * produces a different result from the reference for at least one value — unless
 * the rule reads them symmetrically, in which case there is nothing to detect.
 *
 * Crucially the value sets **straddle the guards rules actually use**: zero,
 * positive, negative and above-one for numbers, both booleans, present and absent
 * for optionals. That was the lesson from the goal-status test — a swap behind
 * `x > 0` is invisible unless a case sits on each side of it.
 *
 * **The absent cases are compared, not exempted.** An earlier version skipped every
 * disagreement whose label ended `=absent`, on the stated grounds that the
 * positional form "cannot say absent and sends the zero value". That is false for
 * every command here: each one carries an explicit `*_present` argument
 * (`core.mbt:439`, `:676`, `:718`, `:838`, `:901`, `:928`) and `encode` sends it. So
 * the two sides *should* agree on absence, and skipping them exempted the migration's
 * only genuinely new logic — the `is Some(_)` / `unwrap_or` reconstruction in
 * `ui_contract_json.mbt`, which is where a wiring mistake would actually live.
 * Mutating `viewport`'s reconstruction to a constant `true` was caught by no sweep
 * case until the skip came out.
 *
 * ## Scope
 *
 * The reference side is the **positional MoonBit arm**, still present in both
 * dispatch tables. So this compares two decoders over shared rule code; a
 * disagreement is a wiring bug, never a behaviour change. It says nothing about
 * whether the rules are right — they have their own tests.
 */
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
  callMarkupCoreJson,
  computeUiContractMarkerIssueIds,
  computeUiContractPatternEvidenceIssueIds,
  computeUiContractViewportIssueIds,
  runMarkupCore,
} from "./markup-core-runtime.ts";

type ArgKind = "string" | "number" | "int" | "bool" | "list";

interface ArgSpec {
  /** Positional value(s) to try. */
  kind: ArgKind;
  /** JSON field name. */
  field: string;
  /** Values to sweep. Chosen to straddle whatever guard the rule uses. */
  values: readonly (string | number | boolean | readonly string[])[];
  /**
   * A `*_present` companion this argument collapsed into. When set, the JSON side
   * omits the field for the "absent" value and the positional side sends
   * `present=false` plus the zero value.
   */
  optional?: boolean;
  /**
   * A discriminator that gates whether other rules run at all — a `pattern`, a
   * `kind`, a `role`. Its values are CROSSED with every other case rather than
   * varied alone.
   *
   * Without this the sweep is blind in a specific way that took a caught bug to
   * see: single-argument variation holds everything else at a base, and if the base
   * discriminator disables the rules that read the argument under test, no case ever
   * reaches them. `pattern-evidence-issue-ids` has five patterns and its list
   * arguments are only read for four of them; with `pattern: ""` at base, swapping
   * two of those lists changed nothing anywhere.
   */
  cross?: boolean;
}

interface CommandSpec {
  positional: string;
  json: string;
  args: ArgSpec[];
  /** The JSON handler returns an array; the positional arm a pipe-joined string. */
  listResult: true;
}

const STRINGS = ["", "x"] as const;
const BOOLS = [false, true] as const;
/**
 * Zero, positive, negative, and above one — because `> 0` is not the only guard
 * these rules use. `min_overflow < 0`, `duration_ms < 0` and `min_change_ratio < 0
 * || > 1` all reject values a `[0, 2.5]` set never produces, so a swap or a
 * mis-reconstructed presence flag behind one of them stayed invisible: mutating
 * `expected-scrollport`'s presence reconstruction to a constant `true` was caught
 * by nothing until `-1` was in the set.
 */
const NUMBERS = [0, 2.5, -1, 1.5] as const;
const INTS = [0, 3] as const;

const s = (field: string, values: readonly string[] = STRINGS): ArgSpec => ({ kind: "string", field, values });
/** A discriminator: crossed with every case, not varied alone. See `cross`. */
const disc = (field: string, values: readonly string[]): ArgSpec => ({
  kind: "string",
  field,
  values,
  cross: true,
});
const b = (field: string): ArgSpec => ({ kind: "bool", field, values: BOOLS });
const n = (field: string): ArgSpec => ({ kind: "number", field, values: NUMBERS });
const i = (field: string): ArgSpec => ({ kind: "int", field, values: INTS });
/**
 * A list: `"a|b"` on the positional side, `["a","b"]` on the JSON side.
 *
 * Worth sweeping rather than exempting, because the joined form is one of the
 * things the migration fixes — it silently forbade a pipe inside any element.
 */
const list = (field: string, values: readonly (readonly string[])[]): ArgSpec => ({
  kind: "list",
  field,
  values,
});

/** A present/value pair on the positional side, one optional field on the JSON side. */
const opt = (field: string, kind: "number" | "bool" = "number"): ArgSpec => ({
  kind,
  field,
  values: kind === "bool" ? BOOLS : NUMBERS,
  optional: true,
});

const COMMANDS: CommandSpec[] = [
  {
    positional: "ui-contract-screen-issue-ids",
    json: "screen-issue-ids",
    args: [s("id"), s("pattern", ["", "landing"]), s("goal", ["", "app"]), s("source_of_truth", ["", "landmarks"])],
    listResult: true,
  },
  {
    positional: "ui-contract-viewport-issue-ids",
    json: "viewport-issue-ids",
    args: [s("label"), b("duplicate_label"), n("width"), n("height"), opt("dpr")],
    listResult: true,
  },
  {
    positional: "ui-contract-landmark-issue-ids",
    json: "landmark-issue-ids",
    args: [s("id"), s("role", ["", "landmark", "banner"]), s("name"), b("parent_id_present"), b("parent_known")],
    listResult: true,
  },
  {
    positional: "ui-contract-marker-issue-ids",
    json: "marker-issue-ids",
    args: [s("kind", ["", "primary-cta"]), b("required"), b("has_selector"), b("has_attribute"), b("has_target")],
    listResult: true,
  },
  {
    positional: "ui-contract-state-issue-ids",
    json: "state-issue-ids",
    args: [s("id"), s("kind", ["", "hover"]), b("required"), b("has_selector"), b("has_trigger")],
    listResult: true,
  },
  {
    positional: "ui-contract-required-state-issue-ids",
    json: "required-state-issue-ids",
    args: [
      s("id"), s("kind", ["", "hover"]), b("required"), b("has_selector"), b("has_trigger"),
      b("duplicate_id"), opt("min_change_ratio"),
    ],
    listResult: true,
  },
  {
    positional: "ui-contract-expected-scrollport-issue-ids",
    json: "expected-scrollport-issue-ids",
    args: [
      s("id"), s("axis", ["", "y"]), b("required"), b("has_selector"), b("has_name"),
      b("has_landmark_id"), b("duplicate_id"), opt("min_overflow"),
    ],
    listResult: true,
  },
  {
    positional: "ui-contract-composition-layer-issue-ids",
    json: "composition-layer-issue-ids",
    args: [s("id"), s("role", ["", "background"]), b("duplicate_id"), opt("z_finite", "bool")],
    listResult: true,
  },
  {
    positional: "ui-contract-composition-shape-issue-ids",
    json: "composition-shape-issue-ids",
    args: [s("id"), s("kind", ["", "sticker"]), b("duplicate_id")],
    listResult: true,
  },
  {
    positional: "ui-contract-composition-motion-issue-ids",
    json: "composition-motion-issue-ids",
    args: [s("id"), s("trigger", ["", "hover"]), s("effect", ["", "pulse"]), b("duplicate_id"), opt("duration_ms")],
    listResult: true,
  },
  {
    positional: "ui-contract-decoration-palette-issue-ids",
    json: "decoration-palette-issue-ids",
    args: [s("role"), s("value", ["", "#fff", "nothex"])],
    listResult: true,
  },
  {
    positional: "ui-contract-pattern-evidence-issue-ids",
    json: "pattern-evidence-issue-ids",
    args: [
      disc("pattern", ["", "landing", "app-shell", "canvas", "expressive-menu"]),
      list("marker_kinds", [[], ["primary-cta"], ["media-slot", "next-section"]]),
      list("required_state_kinds", [[], ["selected"], ["scrolled", "hover"]]),
      list("state_kinds", [[], ["selected"], ["focus-visible"]]),
      i("expected_scrollport_count"),
      b("has_composition"),
      b("has_canvas_state_hook"),
      list("canvas_required_state_fields", [[], ["mode"], ["frame", "score"]]),
    ],
    listResult: true,
  },
  {
    positional: "ui-contract-layout-issue-ids",
    json: "layout-policy-issue-ids",
    args: [
      disc("width_kind", ["", "fluid", "fixed"]),
      // The two present-flags here are separate optionals on the JSON side, so the
      // generic pair handling does not apply; they are sent as their own fields.
      opt("width_min"), opt("width_max"), n("width_value"),
      disc("height_kind", ["", "fixed", "scrollport"]), n("height_value"), n("height_max"),
      disc("display_kind", ["", "grid", "block"]), i("display_columns_count"), i("display_rows_count"),
    ],
    listResult: true,
  },
];

/** Positional encoding, matching the wrappers' helpers exactly. */
function encode(spec: ArgSpec, value: string | number | boolean | readonly string[] | undefined): string[] {
  if (spec.optional) {
    // present flag, then the value — the convention the JSON side replaced.
    const present = value !== undefined;
    if (spec.kind === "bool") return [String(present), String(present ? value : false)];
    return [String(present), String(present ? value : 0)];
  }
  if (spec.kind === "list") return [(value as readonly string[]).join("|")];
  return [String(value)];
}

/**
 * `layout-policy-issue-ids` is the one command whose positional form does NOT pair
 * each present-flag with its own value: `width_min` and `width_max` are two flags
 * followed by a single shared `width_value`. Handled explicitly rather than bent
 * into the generic rule, because bending it would have made the generic rule wrong
 * for everything else.
 */
function positionalArgvFor(command: CommandSpec, values: (string | number | boolean | readonly string[] | undefined)[]): string[] {
  if (command.json === "layout-policy-issue-ids") {
    const [widthKind, widthMin, widthMax, widthValue, heightKind, heightValue, heightMax, displayKind, cols, rows] = values;
    return [
      command.positional,
      String(widthKind),
      String(widthMin !== undefined),
      String(widthMax !== undefined),
      String(widthValue),
      String(heightKind),
      String(heightValue),
      String(heightMax),
      String(displayKind),
      String(cols),
      String(rows),
    ];
  }
  return [command.positional, ...command.args.flatMap((spec, index) => encode(spec, values[index]))];
}

function payloadFor(command: CommandSpec, values: (string | number | boolean | readonly string[] | undefined)[]): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  command.args.forEach((spec, index) => {
    const value = values[index];
    if (spec.optional && value === undefined) return; // omitted, not null
    payload[spec.field] = value;
  });
  return payload;
}

/** Base values: the first of each argument's set, with optionals present. */
function baseValues(command: CommandSpec): (string | number | boolean | readonly string[] | undefined)[] {
  return command.args.map((spec) => spec.values[0]);
}

/**
 * One case per (argument, value), plus one per optional argument absent. Varying a
 * single argument at a time is what makes a swap detectable: if i and j were
 * exchanged, the case that varies i differs from the reference.
 */
function casesFor(command: CommandSpec): { label: string; values: (string | number | boolean | readonly string[] | undefined)[] }[] {
  type Values = (string | number | boolean | readonly string[] | undefined)[];
  const out: { label: string; values: Values }[] = [];
  const crossIndexes = command.args.flatMap((spec, index) => (spec.cross ? [index] : []));

  // Every combination of the discriminators. Small by construction — these are the
  // `kind`/`pattern` arguments, a handful of values each.
  let bases: { label: string; values: Values }[] = [{ label: "", values: baseValues(command) }];
  for (const index of crossIndexes) {
    const next: typeof bases = [];
    for (const current of bases) {
      for (const value of command.args[index]!.values) {
        next.push({
          label: `${current.label}${current.label ? " " : ""}${command.args[index]!.field}=${JSON.stringify(value)}`,
          values: current.values.map((v, position) => (position === index ? value : v)),
        });
      }
    }
    bases = next;
  }

  for (const base of bases) {
    out.push({ label: `[${base.label}] base`, values: base.values });
    command.args.forEach((spec, index) => {
      if (spec.cross) return; // already crossed
      for (const value of spec.values) {
        const values = [...base.values];
        values[index] = value;
        out.push({ label: `[${base.label}] ${spec.field}=${JSON.stringify(value)}`, values });
      }
      if (spec.optional) {
        const values = [...base.values];
        values[index] = undefined;
        out.push({ label: `[${base.label}] ${spec.field}=absent`, values });
      }
    });
  }
  return out;
}

describe("migrated commands match their positional arms", { timeout: 240_000 }, () => {
  for (const command of COMMANDS) {
    it(`${command.json} (${casesFor(command).length} cases)`, () => {
      const disagreements: string[] = [];
      const results = new Set<string>();
      for (const { label, values } of casesFor(command)) {
        const reference = runMarkupCore(positionalArgvFor(command, values));
        const migrated = callMarkupCoreJson<string[]>(command.json, payloadFor(command, values));
        const referenceList = reference === "" ? [] : reference.split("|");
        if (JSON.stringify(referenceList) !== JSON.stringify(migrated)) {
          disagreements.push(`${label}: positional=${JSON.stringify(referenceList)} json=${JSON.stringify(migrated)}`);
        }
        results.add(JSON.stringify(migrated));
      }
      assert.deepEqual(disagreements, []);
      // A command whose every case returns the same ids proves nothing about
      // decoding, so require the sweep to have moved the rules.
      assert.ok(results.size >= 2, `${command.json}: every case returned ${[...results][0]}`);
    });
  }
});

/**
 * Malformed input, which is where the first version of this file was blind.
 *
 * Every case the sweep above generates is well-formed by construction: no missing
 * fields, no nulls, no wrong types, no non-finite numbers. That is exactly the
 * input space a real regression lived in — the positional encoders normalised all
 * of it (`doubleArg` mapped anything non-finite to `0`, `boolArg` mapped
 * `undefined` to `false`) and the JSON path initially did not, so a contract whose
 * viewport omitted `width` stopped reporting `viewport-size-positive` and started
 * raising `Missing field width`.
 *
 * It matters because of who the caller is: `vlmkit contract validate` does
 * `JSON.parse(file) as UiContract` with no runtime schema check, so arbitrary user
 * JSON reaches these wrappers. **The one input a validator has to survive is an
 * invalid document.** A sweep over well-formed values can never say that.
 *
 * These go through the public wrappers rather than `callMarkupCoreJson`, because the
 * normalisation lives in the wrappers and testing below it would test nothing.
 */
/**
 * The eighteen commands whose JSON form is NESTED, and therefore does not fit the flat
 * `ArgSpec` table above.
 *
 * `{foreground: {r,g,b}, background: {r,g,b}}` is the entire point of migrating
 * `a11y-contrast-evaluate` — six same-typed `Int`s in a row become two named colours —
 * so a harness that could only describe flat payloads would have had to skip exactly the
 * commands that most needed checking. Rather than bend `ArgSpec` into a path language,
 * each command here owns its two encoders and reuses the same case generation. The
 * `layout-policy` special case above set that precedent.
 *
 * `normalize` exists because several of these changed their OUTPUT shape too: the
 * positional arms returned `"4.53|4.5|AA"`, `"cols|rows"`, `"flow|priority|reason"`, and
 * the JSON handlers return records. Comparing them means saying, once and explicitly, how
 * the record maps back to the joined string. That mapping is the migration's claim; if it
 * is wrong, the test says so.
 */
interface NestedCommandSpec {
  positional: string;
  json: string;
  /** Flat, for case generation only — the encoders below place the values. */
  args: ArgSpec[];
  toArgv(values: CaseValues): string[];
  toPayload(values: CaseValues): unknown;
  /** JSON result → the string the positional arm returns. Identity when unchanged. */
  normalize(result: unknown): string;
}

type CaseValues = (string | number | boolean | readonly string[] | undefined)[];

const num = (v: unknown): string => String(Number.isFinite(v as number) ? v : 0);
const int = (v: unknown): string => String(Number.isFinite(v as number) ? Math.trunc(v as number) : 0);
const asIs = (result: unknown): string => String(result);

/** Colour channels sweep across the clamp boundaries the rules actually test. */
const CHANNELS = [0, 128, 255] as const;
const ch = (field: string): ArgSpec => ({ kind: "int", field, values: CHANNELS });

const NESTED_COMMANDS: NestedCommandSpec[] = [
  {
    positional: "a11y-contrast-evaluate",
    json: "contrast-evaluate",
    args: [
      ch("fr"), ch("fg"), ch("fb"), ch("br"), ch("bg"), ch("bb"),
      { kind: "number", field: "font_size", values: [0, 13, 14, 18, 24] },
      { kind: "int", field: "font_weight", values: [400, 700] },
    ],
    toArgv: (v) => ["a11y-contrast-evaluate", int(v[0]), int(v[1]), int(v[2]), int(v[3]), int(v[4]), int(v[5]), num(v[6]), int(v[7])],
    toPayload: (v) => ({
      foreground: { r: v[0], g: v[1], b: v[2] },
      background: { r: v[3], g: v[4], b: v[5] },
      font_size: v[6],
      font_weight: v[7],
    }),
    normalize: (r) => {
      const o = r as { ratio: number; required_aa: number; level: string };
      // The positional arm formats to 2dp / 1dp before joining; compare on the
      // formatted form rather than asserting the float round-trips exactly.
      return `${o.ratio.toFixed(2)}|${o.required_aa.toFixed(1)}|${o.level}`;
    },
  },
  {
    positional: "a11y-touch-in-cluster",
    json: "touch-in-cluster",
    // Not `n(...)`: every NUMBERS value sits inside the cluster radius, so all 17
    // cases returned "true" and the vacuity assertion caught it. These straddle it.
    args: [
      { kind: "number", field: "ax", values: [0, 5, 200] },
      { kind: "number", field: "ay", values: [0, 5, 200] },
      { kind: "number", field: "bx", values: [0, 5, 200] },
      { kind: "number", field: "by", values: [0, 5, 200] },
    ],
    toArgv: (v) => ["a11y-touch-in-cluster", num(v[0]), num(v[1]), num(v[2]), num(v[3])],
    toPayload: (v) => ({ a: { x: v[0], y: v[1] }, b: { x: v[2], y: v[3] } }),
    normalize: asIs,
  },
  {
    positional: "focus-order-classify",
    json: "focus-order-classify",
    args: [b("same_path"), n("prev_x"), n("prev_y"), n("cur_x"), n("cur_y")],
    toArgv: (v) => ["focus-order-classify", String(v[0]), num(v[1]), num(v[2]), num(v[3]), num(v[4])],
    toPayload: (v) => ({ same_path: v[0], previous: { x: v[1], y: v[2] }, current: { x: v[3], y: v[4] } }),
    normalize: asIs,
  },
  {
    positional: "grid-arrays-close",
    json: "grid-arrays-close",
    args: [
      { kind: "list", field: "a", values: [[], ["10"], ["10", "20"], ["10", "20", "30"]] },
      { kind: "list", field: "b", values: [[], ["10"], ["10", "20.05"], ["10", "99"]] },
      n("tolerance"),
    ],
    // The positional form is CSV, not pipe-joined — a different sub-encoding again.
    toArgv: (v) => ["grid-arrays-close", (v[0] as string[]).join(","), (v[1] as string[]).join(","), num(v[2])],
    toPayload: (v) => ({
      a: (v[0] as string[]).map(Number),
      b: (v[1] as string[]).map(Number),
      tolerance: v[2],
    }),
    normalize: asIs,
  },
  {
    positional: "grid-gcd",
    json: "grid-gcd",
    args: [{ kind: "int", field: "a", values: [0, 1, 24, -36] }, { kind: "int", field: "b", values: [0, 1, 36, -24] }],
    toArgv: (v) => ["grid-gcd", int(v[0]), int(v[1])],
    toPayload: (v) => ({ a: v[0], b: v[1] }),
    normalize: asIs,
  },
  {
    positional: "shift-classify-suspect",
    json: "shift-classify-suspect",
    // Base first, and non-degenerate: with 0 first, both deltas sat at 0 in every case
    // and the rule returned one class throughout.
    args: [
      { kind: "number", field: "abs_height_delta", values: [20, 0, 3, 1.5] },
      { kind: "number", field: "abs_top_delta", values: [3, 0, 20, 1.5] },
    ],
    toArgv: (v) => ["shift-classify-suspect", num(v[0]), num(v[1])],
    toPayload: (v) => ({ abs_height_delta: v[0], abs_top_delta: v[1] }),
    normalize: asIs,
  },
  {
    positional: "quality-error-state-kind",
    json: "quality-error-state-kind",
    args: [
      { kind: "number", field: "red_ratio", values: [0, 0.005, 0.05, 0.5] },
      { kind: "number", field: "yellow_ratio", values: [0, 0.005, 0.05, 0.5] },
    ],
    toArgv: (v) => ["quality-error-state-kind", num(v[0]), num(v[1])],
    toPayload: (v) => ({ red_ratio: v[0], yellow_ratio: v[1] }),
    normalize: asIs,
  },
  {
    positional: "quality-coverage-passed",
    json: "quality-coverage-passed",
    args: [
      { kind: "int", field: "covered", values: [0, 7, 8, 10] },
      { kind: "int", field: "total", values: [0, 10] },
    ],
    toArgv: (v) => ["quality-coverage-passed", int(v[0]), int(v[1])],
    toPayload: (v) => ({ covered: v[0], total: v[1] }),
    normalize: asIs,
  },
  {
    positional: "landscape-cell-score",
    json: "landscape-cell-score",
    args: [n("r1"), n("g1"), n("b1"), n("l1"), n("i1"), n("r2"), n("g2"), n("b2"), n("l2"), n("i2")],
    toArgv: (v) => ["landscape-cell-score", ...v.map(num)],
    toPayload: (v) => ({
      baseline: { r: v[0], g: v[1], b: v[2], l: v[3], ink: v[4] },
      current: { r: v[5], g: v[6], b: v[7], l: v[8], ink: v[9] },
    }),
    normalize: asIs,
  },
  {
    positional: "landscape-cell-hex",
    json: "landscape-cell-hex",
    args: [
      { kind: "number", field: "r", values: [-5, 0, 128, 255, 300] },
      { kind: "number", field: "g", values: [-5, 0, 128, 255, 300] },
      { kind: "number", field: "b", values: [-5, 0, 128, 255, 300] },
    ],
    toArgv: (v) => ["landscape-cell-hex", num(v[0]), num(v[1]), num(v[2])],
    toPayload: (v) => ({ r: v[0], g: v[1], b: v[2] }),
    normalize: asIs,
  },
  {
    positional: "landscape-default-grid",
    json: "landscape-default-grid",
    args: [
      // Non-zero FIRST. The rule returns 0|0 unless both dimensions are positive, and
      // single-argument variation holds the other at the base — so a 0 base made every
      // case return 0|0 and tested nothing.
      { kind: "int", field: "width", values: [1280, 0, 720] },
      { kind: "int", field: "height", values: [720, 0, 1280] },
    ],
    toArgv: (v) => ["landscape-default-grid", int(v[0]), int(v[1])],
    toPayload: (v) => ({ width: v[0], height: v[1] }),
    normalize: (r) => {
      const o = r as { cols: number; rows: number };
      return `${o.cols}|${o.rows}`;
    },
  },
  {
    positional: "visual-classify-region",
    json: "visual-classify-region",
    args: [
      disc("region_type", ["text", "block", "unknown"]),
      { kind: "int", field: "width", values: [0, 20, 100] },
      { kind: "int", field: "height", values: [0, 20, 100] },
      { kind: "int", field: "diff_pixel_count", values: [0, 50, 2000] },
      { kind: "int", field: "total_pixels", values: [0, 2000] },
      { kind: "bool", field: "has_color_sample", values: BOOLS },
      ch("baseline_r"), ch("baseline_g"), ch("baseline_b"),
      ch("current_r"), ch("current_g"), ch("current_b"),
    ],
    toArgv: (v) => ["visual-classify-region", String(v[0]), int(v[1]), int(v[2]), int(v[3]), int(v[4]),
      String(v[5]), int(v[6]), int(v[7]), int(v[8]), int(v[9]), int(v[10]), int(v[11])],
    toPayload: (v) => ({
      region_type: v[0],
      width: v[1],
      height: v[2],
      diff_pixel_count: v[3],
      total_pixels: v[4],
      // `has_color_sample` becomes the presence of the two colours — the reconstruction
      // this migration introduced, so the sweep must cross it with both values.
      ...(v[5]
        ? {
          baseline_color: { r: v[6], g: v[7], b: v[8] },
          current_color: { r: v[9], g: v[10], b: v[11] },
        }
        : {}),
    }),
    normalize: asIs,
  },
  {
    positional: "visual-is-likely-page-surface",
    json: "visual-is-likely-page-surface",
    args: [ch("r"), ch("g"), ch("b")],
    toArgv: (v) => ["visual-is-likely-page-surface", int(v[0]), int(v[1]), int(v[2])],
    toPayload: (v) => ({ r: v[0], g: v[1], b: v[2] }),
    normalize: asIs,
  },
  {
    positional: "region-classify-kind",
    json: "region-classify-kind",
    args: [
      { kind: "int", field: "area", values: [0, 200, 5000] },
      { kind: "number", field: "aspect", values: [0.2, 1, 4.5] },
      { kind: "number", field: "luma_std", values: [0, 20, 60] },
      { kind: "int", field: "color_count", values: [0, 2, 12] },
      { kind: "int", field: "stripe_rows", values: [0, 3] },
    ],
    toArgv: (v) => ["region-classify-kind", int(v[0]), num(v[1]), num(v[2]), int(v[3]), int(v[4])],
    toPayload: (v) => ({ area: v[0], aspect: v[1], luma_std: v[2], color_count: v[3], stripe_rows: v[4] }),
    normalize: asIs,
  },
  {
    positional: "semantic-drilldown-select-index",
    json: "semantic-drilldown-select-index",
    // Three index-correlated parallel arrays became one array of records. The values
    // below keep them the same length, because a length mismatch is the bug the record
    // form makes unrepresentable rather than a behaviour to compare.
    args: [
      // Populated FIRST: with `[]` at base, every single-argument variation had at least
      // one empty array, `Math.min` truncated the candidate list to zero, and the rule
      // never chose anything.
      { kind: "list", field: "flows", values: [["layout", "decoration"], [], ["layout"], ["decoration", "layout"]] },
      { kind: "list", field: "priority_scores", values: [["0.2", "0.9"], [], ["0.2"], ["0.9", "0.2"]] },
      { kind: "list", field: "orders", values: [["1", "0"], [], ["0"], ["0", "1"]] },
    ],
    toArgv: (v) => ["semantic-drilldown-select-index",
      (v[0] as string[]).join("|"), (v[1] as string[]).join("|"), (v[2] as string[]).join("|")],
    toPayload: (v) => {
      const flows = v[0] as string[];
      const scores = v[1] as string[];
      const orders = v[2] as string[];
      const length = Math.min(flows.length, scores.length, orders.length);
      return {
        candidates: Array.from({ length }, (_, i) => ({
          flow: flows[i],
          priority_score: Number(scores[i]),
          order: Number(orders[i]),
        })),
      };
    },
    normalize: asIs,
  },
  {
    positional: "semantic-drilldown-policy",
    json: "semantic-drilldown-policy",
    args: [
      { kind: "number", field: "layout_score", values: [0, 0.3, 0.8] },
      { kind: "number", field: "decoration_score", values: [0, 0.2, 0.9] },
      { kind: "int", field: "heatmap_kind_count", values: [0, 1, 3] },
    ],
    toArgv: (v) => ["semantic-drilldown-policy", num(v[0]), num(v[1]), int(v[2])],
    toPayload: (v) => ({ layout_score: v[0], decoration_score: v[1], heatmap_kind_count: v[2] }),
    normalize: (r) => {
      const o = r as { flow: string; priority_score: number; reason_id: string };
      return `${o.flow}|${o.priority_score}|${o.reason_id}`;
    },
  },
  {
    positional: "merge-component-probe-states",
    json: "merge-component-probe-states",
    args: [
      { kind: "list", field: "explicit", values: [[], ["hover"], ["hover", "focus"]] },
      { kind: "list", field: "injected", values: [[], ["hover"], ["scrolled", "hover"]] },
    ],
    toArgv: (v) => ["merge-component-probe-states", (v[0] as string[]).join("|"), (v[1] as string[]).join("|")],
    toPayload: (v) => ({ explicit: v[0], injected: v[1] }),
    normalize: (r) => (r as string[]).join("|"),
  },
];

describe("nested-payload commands match their positional arms", { timeout: 300_000 }, () => {
  it("covers every nested command the JSON boundary claims", async () => {
    const { markupCoreJsonCommands } = await import("./markup-core-runtime.ts");
    const covered = new Set([
      ...COMMANDS.map((c) => c.json),
      ...NESTED_COMMANDS.map((c) => c.json),
    ]);
    // `landscape-diff-summary` has its own test: its positional twin takes a
    // sub-encoded stat blob and returns a "mismatch|..." sentinel instead of raising,
    // so the two are not comparable case-for-case. See below.
    const exempt = new Set(["interaction-issues", "goal-status", "landscape-diff-summary"]);
    const uncovered = markupCoreJsonCommands().filter((name) => !covered.has(name) && !exempt.has(name));
    assert.deepEqual(uncovered, [], `migrated with no differential coverage: ${uncovered.join(", ")}`);
  });

  for (const command of NESTED_COMMANDS) {
    const cases = casesFor(command as unknown as CommandSpec);
    it(`${command.json} (${cases.length} cases)`, () => {
      const disagreements: string[] = [];
      const results = new Set<string>();
      for (const { label, values } of cases) {
        const reference = runMarkupCore(command.toArgv(values));
        const migrated = callMarkupCoreJson<unknown>(command.json, command.toPayload(values));
        const normalized = command.normalize(migrated);
        if (reference !== normalized) {
          disagreements.push(`${label}: positional=${JSON.stringify(reference)} json=${JSON.stringify(normalized)}`);
        }
        results.add(normalized);
      }
      assert.deepEqual(disagreements, []);
      assert.ok(results.size >= 2, `${command.json}: every case returned ${[...results][0]}`);
    });
  }
});

/**
 * `landscape-diff-summary`, which needs its own comparison for two reasons.
 *
 * **Its input carried a second positional encoding.** `baseline_stats` was one string
 * holding `"r,g,b,l,ink|r,g,b,l,ink|…"` — five positional fields per cell, comma
 * delimited, inside a pipe-delimited list, inside a tab-delimited argument list, parsed
 * by an `idx == 0 / 1 / 2 / 3 / 4` chain. So the generic table's `toArgv` / `toPayload`
 * pair is not a re-ordering here, it is a whole encoder, and the cases have to be built
 * from cell records rather than from scalar sweeps.
 *
 * **Its error path changed deliberately.** The positional arm returns
 * `"mismatch|<total>|<base>|<curr>"` — a success-shaped string a caller must sniff — with
 * a comment saying it does so "rather than raising, so the FFI surface stays string-only".
 * The JSON handler raises. That is the one intended behaviour difference in this batch, so
 * it is asserted rather than swept: agreement on well-formed input, and a raise where the
 * old form returned a sentinel.
 */
describe("landscape-diff-summary matches its positional arm", { timeout: 120_000 }, () => {
  interface Cell { r: number; g: number; b: number; l: number; ink: number }

  const encodeStats = (cells: Cell[]): string =>
    cells.map((c) => [c.r, c.g, c.b, c.l, c.ink].join(",")).join("|");

  /** Deterministic cells; `seed` shifts them so baseline and current differ per case. */
  const cellsFor = (count: number, seed: number): Cell[] =>
    Array.from({ length: count }, (_, i) => ({
      r: (i * 37 + seed * 11) % 256,
      g: (i * 53 + seed * 29) % 256,
      b: (i * 71 + seed * 17) % 256,
      l: (i * 43 + seed * 23) % 256,
      ink: ((i * 13 + seed * 7) % 100) / 100,
    }));

  const GRIDS = [
    { cols: 1, rows: 1 },
    { cols: 2, rows: 1 },
    { cols: 4, rows: 4 },
    { cols: 3, rows: 5 },
  ];
  const THRESHOLDS = [0, 0.05, 0.5, 1];
  const TOP_NS = [0, 1, 3, 100];

  it("agrees on mean, similarity, changed, total and the top-cell list", () => {
    const disagreements: string[] = [];
    let compared = 0;
    for (const { cols, rows } of GRIDS) {
      for (const threshold of THRESHOLDS) {
        for (const topN of TOP_NS) {
          const total = cols * rows;
          const baseline = cellsFor(total, 1);
          const current = cellsFor(total, 5);
          const reference = runMarkupCore([
            "landscape-diff-summary",
            String(cols), String(rows), String(threshold), String(topN),
            encodeStats(baseline), encodeStats(current),
          ], { cache: false });
          const migrated = callMarkupCoreJson<{
            mean: number; similarity: number; changed: number; total: number;
            top: { index: number; score: number }[];
          }>("landscape-diff-summary", {
            cols, rows, changed_threshold: threshold, top_n: topN, baseline, current,
          });
          // Rebuild the joined form the positional arm returns. Stated here rather than
          // hidden in a helper, because this mapping IS the migration's output claim.
          const normalized = [
            String(migrated.mean),
            String(migrated.similarity),
            String(migrated.changed),
            String(migrated.total),
            ...migrated.top.map((cell) => `${cell.index}:${cell.score}`),
          ].join("|");
          compared++;
          if (reference !== normalized) {
            disagreements.push(
              `${cols}x${rows} threshold=${threshold} top=${topN}: positional=${reference} json=${normalized}`,
            );
          }
        }
      }
    }
    assert.deepEqual(disagreements, []);
    assert.equal(compared, GRIDS.length * THRESHOLDS.length * TOP_NS.length);
  });

  it("raises on a cell-count mismatch where the positional arm returned a sentinel", () => {
    const short = cellsFor(3, 1);
    const reference = runMarkupCore([
      "landscape-diff-summary", "2", "2", "0.1", "2",
      encodeStats(short), encodeStats(cellsFor(4, 2)),
    ], { cache: false });
    // The old contract: an error delivered as data, in the same shape as a result.
    assert.match(reference, /^mismatch\|4\|3\|4$/);

    assert.throws(
      () => callMarkupCoreJson("landscape-diff-summary", {
        cols: 2, rows: 2, changed_threshold: 0.1, top_n: 2,
        baseline: short, current: cellsFor(4, 2),
      }),
      /cell count mismatch: expected 4 \(2x2\), baseline has 3, current has 4/,
      "the raise must name the counts — the sentinel's only virtue was carrying them",
    );
  });

  it("returns the empty-grid result for a zero-cell grid, as the positional arm does", () => {
    const reference = runMarkupCore([
      "landscape-diff-summary", "0", "0", "0.1", "2", "", "",
    ], { cache: false });
    assert.equal(reference, "1|0|0|0");
    const migrated = callMarkupCoreJson<{ mean: number; similarity: number; changed: number; total: number }>(
      "landscape-diff-summary",
      { cols: 0, rows: 0, changed_threshold: 0.1, top_n: 2, baseline: [], current: [] },
    );
    assert.deepEqual(migrated, { mean: 1, similarity: 0, changed: 0, total: 0, top: [] });
  });
});

describe("migrated wrappers survive malformed input", { timeout: 240_000 }, () => {
  const viewport = (width: unknown) =>
    computeUiContractViewportIssueIds({
      label: "d",
      duplicateLabel: false,
      width: width as number,
      height: 800,
      dprPresent: false,
      dpr: 0,
    });

  it("reports the issue instead of raising when a number is missing or unusable", () => {
    // Each of these used to abort the whole validation run.
    for (const [label, value] of [
      ["omitted", undefined],
      ["null", null],
      ["a string", "1280"],
      ["NaN", Number.NaN],
      ["Infinity", Number.POSITIVE_INFINITY],
    ] as const) {
      assert.deepEqual(
        viewport(value),
        ["viewport-size-positive"],
        `width ${label} must report the issue, not raise`,
      );
    }
  });

  it("still distinguishes a usable number, so the normalisation is not blanket", () => {
    assert.deepEqual(viewport(0), ["viewport-size-positive"]);
    assert.deepEqual(viewport(1280), []);
  });

  it("treats a missing boolean as false, as the old wire did", () => {
    assert.deepEqual(
      computeUiContractMarkerIssueIds({
        kind: "primary-cta",
        required: true,
        hasSelector: undefined as unknown as boolean,
        hasAttribute: undefined as unknown as boolean,
        hasTarget: undefined as unknown as boolean,
      }),
      ["marker-target-required"],
    );
  });

  it("drops a non-string inside a list field", () => {
    // `stripAbsent` walks object properties, so a null INSIDE an array survived to
    // be rejected by MoonBit's `Array[String]`. The old path joined on "|" and
    // MoonBit's split dropped the empty segment, so `[null, "mode"]` arrived as
    // `["mode"]` — reachable through a contract's `canvas.requiredStateFields`,
    // which nothing validates elementwise.
    const issues = computeUiContractPatternEvidenceIssueIds({
      pattern: "canvas",
      markerKinds: [],
      requiredStateKinds: [],
      stateKinds: [],
      expectedScrollportCount: 0,
      hasComposition: false,
      hasCanvasStateHook: false,
      canvasRequiredStateFields: [null as unknown as string, "mode"],
    });
    // "mode" survived the filter, so its issue is absent while the others fire.
    assert.ok(!issues.includes("canvas-state-field-mode"), issues.join(", "));
    assert.ok(issues.includes("canvas-state-field-frame"), issues.join(", "));
  });

  it("agrees with the positional arm on every malformed case", () => {
    // The differential property, applied to the inputs the generated sweep cannot
    // produce. The positional argv is what the old encoders would have emitted.
    for (const value of [undefined, null, "1280", Number.NaN]) {
      assert.deepEqual(
        viewport(value),
        runMarkupCore(["ui-contract-viewport-issue-ids", "d", "false", "0", "800", "false", "0"])
          .split("|")
          .filter(Boolean),
      );
    }
  });
});
