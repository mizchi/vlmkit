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
/// Unpacks the typed input and calls the positional `ui_contract_layout_issue_ids`
/// unchanged, like every other handler on this boundary. This one was originally
/// written out inline — it was the first command through, before the pattern existed
/// — and the duplicate read as equivalent while quietly breaking the property the
/// differential test depends on: with two copies of the rules, a disagreement is no
/// longer necessarily a wiring bug, and editing one rule silently changes behaviour
/// on one path only.
///
/// Returns ids rather than messages: the wording is a presentation concern and lives
/// in TypeScript, so changing it does not require rebuilding MoonBit.
pub fn layout_policy_issue_ids(input : LayoutPolicyInput) -> Array[String] {
  split_issue_ids(
    ui_contract_layout_issue_ids(
      input.width_kind,
      input.width_min is Some(_),
      input.width_max is Some(_),
      input.width_value.unwrap_or(0.0),
      input.height_kind,
      input.height_value.unwrap_or(0.0),
      input.height_max.unwrap_or(0.0),
      input.display_kind,
      input.display_columns_count,
      input.display_rows_count,
    ),
  )
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
    "goal-status" => {
      let input : GoalStatusInput = @json.from_json(json)
      goal_status(input).to_json().stringify()
    }
    "interaction-issues" => {
      let input : InteractionIssuesInput = @json.from_json(json)
      interaction_issues(input).to_json().stringify()
    }
    "screen-issue-ids" => {
      let input : ScreenIssuesInput = @json.from_json(json)
      screen_issue_ids(input).to_json().stringify()
    }
    "viewport-issue-ids" => {
      let input : ViewportIssuesInput = @json.from_json(json)
      viewport_issue_ids(input).to_json().stringify()
    }
    "landmark-issue-ids" => {
      let input : LandmarkIssuesInput = @json.from_json(json)
      landmark_issue_ids(input).to_json().stringify()
    }
    "marker-issue-ids" => {
      let input : MarkerIssuesInput = @json.from_json(json)
      marker_issue_ids(input).to_json().stringify()
    }
    "state-issue-ids" => {
      let input : StateIssuesInput = @json.from_json(json)
      state_issue_ids(input).to_json().stringify()
    }
    "required-state-issue-ids" => {
      let input : RequiredStateIssuesInput = @json.from_json(json)
      required_state_issue_ids(input).to_json().stringify()
    }
    "expected-scrollport-issue-ids" => {
      let input : ExpectedScrollportIssuesInput = @json.from_json(json)
      expected_scrollport_issue_ids(input).to_json().stringify()
    }
    "composition-layer-issue-ids" => {
      let input : CompositionLayerIssuesInput = @json.from_json(json)
      composition_layer_issue_ids(input).to_json().stringify()
    }
    "composition-shape-issue-ids" => {
      let input : CompositionShapeIssuesInput = @json.from_json(json)
      composition_shape_issue_ids(input).to_json().stringify()
    }
    "composition-motion-issue-ids" => {
      let input : CompositionMotionIssuesInput = @json.from_json(json)
      composition_motion_issue_ids(input).to_json().stringify()
    }
    "decoration-palette-issue-ids" => {
      let input : DecorationPaletteIssuesInput = @json.from_json(json)
      decoration_palette_issue_ids(input).to_json().stringify()
    }
    "pattern-evidence-issue-ids" => {
      let input : PatternEvidenceIssuesInput = @json.from_json(json)
      pattern_evidence_issue_ids(input).to_json().stringify()
    }
    _ => raise Failure("unknown markup-core JSON command: \{command}")
  }
}

///|
/// Commands `run_json` accepts, so the TypeScript side can assert the two agree
/// instead of discovering a typo at the first call.
pub fn json_commands() -> Array[String] {
  [
    "layout-policy-issue-ids",
    "interaction-issues",
    "goal-status",
    "screen-issue-ids",
    "viewport-issue-ids",
    "landmark-issue-ids",
    "marker-issue-ids",
    "state-issue-ids",
    "required-state-issue-ids",
    "expected-scrollport-issue-ids",
    "composition-layer-issue-ids",
    "composition-shape-issue-ids",
    "composition-motion-issue-ids",
    "decoration-palette-issue-ids",
    "pattern-evidence-issue-ids",
  ]
}
