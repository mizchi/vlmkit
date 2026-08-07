///| UI Contract validation rules over the JSON boundary.
///
/// The twelve remaining `ui-contract-*-issue-ids` commands with swappable
/// positions, migrated together because they share one shape: named typed
/// parameters in, a pipe-joined id string out. Each handler decodes a struct and
/// calls the existing rule function unchanged — the rules are not rewritten, so a
/// differential test compares two decoders and any disagreement is a wiring bug.
///
/// ## What the typing buys here, concretely
///
/// **Six `*_present` + value pairs disappear.** `min_overflow_present` /
/// `min_overflow`, `min_change_ratio_present` / `min_change_ratio`,
/// `duration_present` / `duration_ms`, `z_present` / `z_finite`, `dpr_present` /
/// `dpr` each existed because the wire could not distinguish an absent number from
/// zero. `Double?` says it, and the pair collapses to one field. The rule functions
/// still take both, so this file reconstructs them — that reconstruction is the
/// only place the old convention survives, instead of every call site.
///
/// **Three pipe-joined lists become arrays.** `marker_kinds`,
/// `required_state_kinds`, `state_kinds` and `canvas_required_state_fields` were
/// `String` holding `"a|b|c"`, which means no element could ever contain a pipe and
/// nothing enforced that. `Array[String]` has no such hazard, and the rule
/// functions keep taking the joined form so the join happens once, here.
///
/// **Ids stop being positional.** `ui-contract-required-state-issue-ids` took
/// eight arguments of which five were `Bool` — `required`, `has_selector`,
/// `has_trigger`, `duplicate_id`, `min_change_ratio_present`. Any two of those
/// could be exchanged and still parse.

///|
pub struct ScreenIssuesInput {
  id : String
  pattern : String
  goal : String
  source_of_truth : String
} derive(FromJson, ToJson)

///|
pub fn screen_issue_ids(input : ScreenIssuesInput) -> Array[String] {
  split_issue_ids(
    ui_contract_screen_issue_ids(
      input.id, input.pattern, input.goal, input.source_of_truth,
    ),
  )
}

///|
pub struct ViewportIssuesInput {
  label : String
  duplicate_label : Bool
  width : Double
  height : Double
  /// Absent, not zero — which the positional form could not say.
  dpr : Double?
} derive(FromJson, ToJson)

///|
pub fn viewport_issue_ids(input : ViewportIssuesInput) -> Array[String] {
  split_issue_ids(
    ui_contract_viewport_issue_ids(
      input.label,
      input.duplicate_label,
      input.width,
      input.height,
      input.dpr is Some(_),
      input.dpr.unwrap_or(0.0),
    ),
  )
}

///|
pub struct LandmarkIssuesInput {
  id : String
  role : String
  name : String
  parent_id_present : Bool
  parent_known : Bool
} derive(FromJson, ToJson)

///|
pub fn landmark_issue_ids(input : LandmarkIssuesInput) -> Array[String] {
  split_issue_ids(
    ui_contract_landmark_issue_ids(
      input.id, input.role, input.name, input.parent_id_present, input.parent_known,
    ),
  )
}

///|
pub struct MarkerIssuesInput {
  kind : String
  required : Bool
  has_selector : Bool
  has_attribute : Bool
  has_target : Bool
} derive(FromJson, ToJson)

///|
pub fn marker_issue_ids(input : MarkerIssuesInput) -> Array[String] {
  split_issue_ids(
    ui_contract_marker_issue_ids(
      input.kind,
      input.required,
      input.has_selector,
      input.has_attribute,
      input.has_target,
    ),
  )
}

///|
pub struct StateIssuesInput {
  id : String
  kind : String
  required : Bool
  has_selector : Bool
  has_trigger : Bool
} derive(FromJson, ToJson)

///|
pub fn state_issue_ids(input : StateIssuesInput) -> Array[String] {
  split_issue_ids(
    ui_contract_state_issue_ids(
      input.id, input.kind, input.required, input.has_selector, input.has_trigger,
    ),
  )
}

///|
pub struct RequiredStateIssuesInput {
  id : String
  kind : String
  required : Bool
  has_selector : Bool
  has_trigger : Bool
  duplicate_id : Bool
  min_change_ratio : Double?
} derive(FromJson, ToJson)

///|
pub fn required_state_issue_ids(input : RequiredStateIssuesInput) -> Array[String] {
  split_issue_ids(
    ui_contract_required_state_issue_ids(
      input.id,
      input.kind,
      input.required,
      input.has_selector,
      input.has_trigger,
      input.duplicate_id,
      input.min_change_ratio is Some(_),
      input.min_change_ratio.unwrap_or(0.0),
    ),
  )
}

///|
pub struct ExpectedScrollportIssuesInput {
  id : String
  axis : String
  required : Bool
  has_selector : Bool
  has_name : Bool
  has_landmark_id : Bool
  duplicate_id : Bool
  min_overflow : Double?
} derive(FromJson, ToJson)

///|
pub fn expected_scrollport_issue_ids(
  input : ExpectedScrollportIssuesInput,
) -> Array[String] {
  split_issue_ids(
    ui_contract_expected_scrollport_issue_ids(
      input.id,
      input.axis,
      input.required,
      input.has_selector,
      input.has_name,
      input.has_landmark_id,
      input.duplicate_id,
      input.min_overflow is Some(_),
      input.min_overflow.unwrap_or(0.0),
    ),
  )
}

///|
pub struct CompositionLayerIssuesInput {
  id : String
  role : String
  duplicate_id : Bool
  /// `None` when no z was declared; `Some(false)` when one was declared and is not
  /// finite. Two positional booleans said this before.
  z_finite : Bool?
} derive(FromJson, ToJson)

///|
pub fn composition_layer_issue_ids(
  input : CompositionLayerIssuesInput,
) -> Array[String] {
  split_issue_ids(
    ui_contract_composition_layer_issue_ids(
      input.id,
      input.role,
      input.duplicate_id,
      input.z_finite is Some(_),
      input.z_finite.unwrap_or(false),
    ),
  )
}

///|
pub struct CompositionShapeIssuesInput {
  id : String
  kind : String
  duplicate_id : Bool
} derive(FromJson, ToJson)

///|
pub fn composition_shape_issue_ids(
  input : CompositionShapeIssuesInput,
) -> Array[String] {
  split_issue_ids(
    ui_contract_composition_shape_issue_ids(input.id, input.kind, input.duplicate_id),
  )
}

///|
pub struct CompositionMotionIssuesInput {
  id : String
  trigger : String
  effect : String
  duplicate_id : Bool
  duration_ms : Double?
} derive(FromJson, ToJson)

///|
pub fn composition_motion_issue_ids(
  input : CompositionMotionIssuesInput,
) -> Array[String] {
  split_issue_ids(
    ui_contract_composition_motion_issue_ids(
      input.id,
      input.trigger,
      input.effect,
      input.duplicate_id,
      input.duration_ms is Some(_),
      input.duration_ms.unwrap_or(0.0),
    ),
  )
}

///|
pub struct DecorationPaletteIssuesInput {
  role : String
  /// Absent when the palette entry declares no value at all, which the rule treats
  /// differently from an empty string.
  value : String?
} derive(FromJson, ToJson)

///|
pub fn decoration_palette_issue_ids(
  input : DecorationPaletteIssuesInput,
) -> Array[String] {
  split_issue_ids(
    ui_contract_decoration_palette_issue_ids(
      input.role, input.value.unwrap_or(""),
    ),
  )
}

///|
pub struct PatternEvidenceIssuesInput {
  pattern : String
  /// Arrays, not `"a|b|c"`. The joined form silently forbade a pipe in any element.
  marker_kinds : Array[String]
  required_state_kinds : Array[String]
  state_kinds : Array[String]
  expected_scrollport_count : Int
  has_composition : Bool
  has_canvas_state_hook : Bool
  canvas_required_state_fields : Array[String]
} derive(FromJson, ToJson)

///|
pub fn pattern_evidence_issue_ids(
  input : PatternEvidenceIssuesInput,
) -> Array[String] {
  split_issue_ids(
    ui_contract_pattern_evidence_issue_ids(
      input.pattern,
      join_issue_ids(input.marker_kinds),
      join_issue_ids(input.required_state_kinds),
      join_issue_ids(input.state_kinds),
      input.expected_scrollport_count,
      input.has_composition,
      input.has_canvas_state_hook,
      join_issue_ids(input.canvas_required_state_fields),
    ),
  )
}

///|
/// The rule functions return `"a|b|c"`, and an empty result must be an empty array
/// rather than `[""]` — the TypeScript side maps each id through a validator, so a
/// stray empty string would raise "unexpected issue id" on a clean check.
fn split_issue_ids(joined : String) -> Array[String] {
  if joined == "" {
    []
  } else {
    joined.split("|").map(fn(view) { view.to_owned() }).collect()
  }
}

///| The inverse, for the rule functions that still take a joined list.
fn join_issue_ids(values : Array[String]) -> String {
  let mut out = ""
  for i, value in values {
    out = if i == 0 { value } else { out + "|" + value }
  }
  out
}
