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
 * Crucially the value sets **straddle the guards rules actually use**: `0` and
 * non-zero for numbers, both booleans, present and absent for optionals. That was
 * the lesson from the goal-status test — a swap behind `x > 0` is invisible unless
 * a case sits on each side of it, and the reference implementation cannot express
 * "absent" at all, so absence is checked separately.
 *
 * ## Scope
 *
 * The reference side is the **positional MoonBit arm**, still present in both
 * dispatch tables. So this compares two decoders over shared rule code; a
 * disagreement is a wiring bug, never a behaviour change. It says nothing about
 * whether the rules are right — they have their own tests.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { callMarkupCoreJson, runMarkupCore } from "./markup-core-runtime.ts";

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
/** Zero and non-zero, because `> 0` is the guard these rules almost always use. */
const NUMBERS = [0, 2.5] as const;
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
  it("covers every command the JSON boundary claims, except the two with no positional twin", async () => {
    // `interaction-issues` is new logic with no positional arm, and `goal-status`
    // has its own dedicated differential test. Everything else must be here, or a
    // migration could land with no comparison at all.
    const { markupCoreJsonCommands } = await import("./markup-core-runtime.ts");
    const covered = new Set(COMMANDS.map((c) => c.json));
    const exempt = new Set(["interaction-issues", "goal-status"]);
    const uncovered = markupCoreJsonCommands().filter((name) => !covered.has(name) && !exempt.has(name));
    assert.deepEqual(uncovered, [], `migrated with no differential coverage: ${uncovered.join(", ")}`);
  });

  for (const command of COMMANDS) {
    it(`${command.json} (${casesFor(command).length} cases)`, () => {
      const disagreements: string[] = [];
      const results = new Set<string>();
      for (const { label, values } of casesFor(command)) {
        const reference = runMarkupCore(positionalArgvFor(command, values));
        const migrated = callMarkupCoreJson<string[]>(command.json, payloadFor(command, values));
        const referenceList = reference === "" ? [] : reference.split("|");
        if (JSON.stringify(referenceList) !== JSON.stringify(migrated)) {
          // An absent optional legitimately differs: the positional form cannot say
          // "absent" and sends the zero value, so a rule that distinguishes them
          // SHOULD disagree. That is the improvement, not a bug.
          if (label.endsWith("=absent")) continue;
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
