///| The JSON boundary between TypeScript and markup-core.
///
/// ## Why this exists
///
/// The original boundary is tab-separated positional strings:
///
///     run_markup_core("component-goal-status", "landing\t0.041\t0.0\t...")
///
/// dispatched by `match args { ["component-goal-status", goal, ratio, ...] }`.
/// Measured before writing this: **61 commands, 233 positional arguments, worst
/// case 36 in one call, and the dispatch is duplicated across
/// `markup-core-api/main.mbt` and `markup-core-cli/main.mbt`** — 1487 lines of
/// hand-written parsing in two files that must agree, with nothing enforcing that
/// they do.
///
/// Three costs follow, and all three are structural rather than stylistic:
///
/// 1. **No type checking crosses the boundary.** Every argument is a string,
///    positional, and parsed inside. Swapping two arguments of the same type is a
///    silent behaviour change that neither compiler can see. With 36 of them, that
///    is not a hypothetical.
/// 2. **Records and arrays are inexpressible.** Anything shaped like "a list of
///    components, each with a box and some class names" has no encoding, so that
///    logic stays in TypeScript whether or not it belongs here.
/// 3. **Adding one function means editing four places** — the MoonBit function,
///    two dispatch tables, and a TypeScript encoder.
///
/// With `derive(FromJson, ToJson)` the compiler generates the codec, so a handler
/// declares a struct and the boundary is typed on this side. A missing or
/// mistyped field raises with the field's path instead of silently parsing as
/// something else.
///
/// ## Where the dispatch lives, and why here
///
/// In the shared library, not in either entry point. `markup-core-api` (direct
/// JS) and `markup-core-cli` (spawned) both already import this package as
/// `@core`, so one table serves both and the two backends cannot drift. The old
/// positional dispatch is left alone — migrating 61 arms is a separate change
/// with its own risk, and the two paths coexist without interacting.
///
/// ## Adding a command
///
/// Declare the input struct next to the logic it feeds, add one arm here, and
/// call it from TypeScript with `callMarkupCoreJson`. No encoder, no second
/// dispatch table.

///|
/// Input for `ui-contract-layout-issue-ids`.
///
/// The first command through this boundary, chosen because it shows the shape of
/// the win rather than being the most valuable: ten positional strings become one
/// record whose field names are checked. `Option` replaces the
/// "present?" + "value" argument pairs the positional form needed, so
/// "unspecified" and "zero" stop being the same wire value.
pub struct LayoutPolicyInput {
  width_kind : String
  width_min : Double?
  width_max : Double?
  width_value : Double?
  height_kind : String
  height_value : Double?
  height_max : Double?
  display_kind : String
  display_columns_count : Int
  display_rows_count : Int
} derive(FromJson, ToJson)

///|
/// Layout-policy issue ids for a UI Contract landmark.
///
/// Same rules as the positional `ui_contract_layout_issue_ids`, expressed against
/// the typed input. Returns ids rather than messages: the message wording is a
/// presentation concern and lives in TypeScript, so changing it does not require
/// rebuilding MoonBit.
pub fn layout_policy_issue_ids(input : LayoutPolicyInput) -> Array[String] {
  let issues : Array[String] = []
  if input.width_kind == "fluid" && input.width_min is None && input.width_max is None {
    issues.push("layout-width-fluid-bounds")
  }
  if input.width_kind == "fixed" && input.width_value.unwrap_or(0.0) <= 0.0 {
    issues.push("layout-width-fixed-positive")
  }
  if input.height_kind == "fixed" && input.height_value.unwrap_or(0.0) <= 0.0 {
    issues.push("layout-height-fixed-positive")
  }
  if input.height_kind == "scrollport" && input.height_max.unwrap_or(0.0) <= 0.0 {
    issues.push("layout-height-scrollport-max-positive")
  }
  if input.display_kind == "grid" {
    if input.display_columns_count <= 0 {
      issues.push("layout-grid-columns")
    }
    if input.display_rows_count <= 0 {
      issues.push("layout-grid-rows")
    }
  }
  issues
}

///|
/// The single dispatch both entry points call.
///
/// Raises on an unknown command and on a payload that does not match the
/// handler's struct. Both are boundary programming errors rather than results, so
/// they must not come back as data — a caller that cannot tell "the rule found no
/// issues" from "my payload was wrong" will read the second as the first. This is
/// the same distinction the story gate draws between `story-drift` and
/// `mount-failed`.
pub fn run_json(command : String, payload : String) -> String raise {
  let json = @json.parse(payload)
  match command {
    "layout-policy-issue-ids" => {
      let input : LayoutPolicyInput = @json.from_json(json)
      layout_policy_issue_ids(input).to_json().stringify()
    }
    _ => raise Failure("unknown markup-core JSON command: \{command}")
  }
}

///|
/// Commands `run_json` accepts, so the TypeScript side can assert the two agree
/// instead of discovering a typo at the first call.
pub fn json_commands() -> Array[String] {
  ["layout-policy-issue-ids"]
}
