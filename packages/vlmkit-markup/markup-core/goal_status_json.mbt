///| `component-goal-status` over the JSON boundary.
///
/// The worst case of the positional design: **36 positional string arguments**,
/// order-dependent, with no type check on either side. Nine of them are `Int`, six
/// are `Bool`, five are `Bool?` — so a great many pairs could be swapped and still
/// parse, changing the verdict silently.
///
/// ## The rules are not touched
///
/// This adds a decoder, not logic. `component_goal_status` in `core.mbt` is
/// unchanged and is still the only place the verdict is decided; this unpacks a
/// typed record and calls it. That is what makes the migration safe enough to make
/// at all — a differential test can then compare the two decoders over the same
/// rules and any disagreement is a wiring bug, not a behaviour change to argue
/// about.
///
/// ## The shape mirrors the caller
///
/// TypeScript already holds this as nested objects (`pass`, `review`,
/// `scrollports`, `landing`, `canvas`, `expressiveMenu`) and flattened them into 36
/// arguments only because the wire could not carry structure. They arrive nested
/// now, which also deletes three arguments outright: `landing_present`,
/// `expressive_present` and the canvas hook's presence flag were each a boolean
/// saying whether the *next* arguments meant anything. `Option` says that already.

///|
pub struct GoalThresholds {
  landscape : Double?
  pixel : Double?
} derive(FromJson, ToJson)

///|
pub struct GoalExpectedScrollports {
  total : Int
  missing : Int
  broken : Int
  empty : Int
} derive(FromJson, ToJson)

///|
pub struct GoalScrollports {
  total : Int
  broken : Int
  empty : Int
  expected : GoalExpectedScrollports?
} derive(FromJson, ToJson)

///|
pub struct GoalLanding {
  hero_visible : Bool
  primary_cta_visible : Bool
  next_section_hint_visible : Bool
  media_slot_visible : Bool
} derive(FromJson, ToJson)

///|
pub struct GoalCanvas {
  canvas_count : Int
  nonblank : Bool
  frame_delta : Bool
  input_responsive : Bool?
  /// `None` when the contract declares no state hook at all, which is not the same
  /// as declaring one that is missing.
  state_hook_present : Bool?
  missing_state_fields : Int
} derive(FromJson, ToJson)

///|
pub struct GoalExpressiveMenu {
  composition_layers : Int
  composition_shapes : Int
  selected_visible : Bool
  focusable_item_count : Int
  semantic_menu_text : Bool
  diagonal_evidence : Bool
  high_contrast : Bool
  low_contrast_item_count : Int
  hover_changed : Bool?
  focus_visible_changed : Bool?
} derive(FromJson, ToJson)

///|
pub struct GoalStatusInput {
  goal : String
  pixel_diff_ratio : Double
  landscape_diff_ratio : Double
  pass : GoalThresholds
  review : GoalThresholds
  /// Absent when the goal does not involve scrollports. The positional form sent
  /// four zeros, which a rule cannot tell from "four scrollports, none broken".
  scrollports : GoalScrollports?
  landing : GoalLanding?
  canvas : GoalCanvas?
  expressive_menu : GoalExpressiveMenu?
} derive(FromJson, ToJson)

///|
/// Unpack and delegate. Every `unwrap_or` here reproduces exactly what the
/// TypeScript encoder sent for an absent value — `intArg` sent `"0"`, `boolArg`
/// sent `"false"` — so the two paths agree by construction rather than by
/// coincidence, and the differential test then proves it.
pub fn goal_status(input : GoalStatusInput) -> String {
  let scrollports = input.scrollports
  let expected = match scrollports {
    Some(s) => s.expected
    None => None
  }
  let landing = input.landing
  let canvas = input.canvas
  let menu = input.expressive_menu
  component_goal_status(
    input.goal,
    input.pixel_diff_ratio,
    input.landscape_diff_ratio,
    input.pass.landscape,
    input.pass.pixel,
    input.review.landscape,
    input.review.pixel,
    match scrollports {
      Some(s) => s.total
      None => 0
    },
    match scrollports {
      Some(s) => s.broken
      None => 0
    },
    match scrollports {
      Some(s) => s.empty
      None => 0
    },
    match expected {
      Some(e) => e.total
      None => 0
    },
    match expected {
      Some(e) => e.missing
      None => 0
    },
    match expected {
      Some(e) => e.broken
      None => 0
    },
    match expected {
      Some(e) => e.empty
      None => 0
    },
    landing is Some(_),
    match landing {
      Some(l) => l.hero_visible
      None => false
    },
    match landing {
      Some(l) => l.primary_cta_visible
      None => false
    },
    match landing {
      Some(l) => l.next_section_hint_visible
      None => false
    },
    match landing {
      Some(l) => l.media_slot_visible
      None => false
    },
    match canvas {
      Some(c) => c.canvas_count
      None => 0
    },
    match canvas {
      Some(c) => c.nonblank
      None => false
    },
    match canvas {
      Some(c) => c.frame_delta
      None => false
    },
    match canvas {
      Some(c) => c.input_responsive
      None => None
    },
    match canvas {
      Some(c) => c.state_hook_present
      None => None
    },
    match canvas {
      Some(c) => c.missing_state_fields
      None => 0
    },
    menu is Some(_),
    match menu {
      Some(m) => m.composition_layers
      None => 0
    },
    match menu {
      Some(m) => m.composition_shapes
      None => 0
    },
    match menu {
      Some(m) => m.selected_visible
      None => false
    },
    match menu {
      Some(m) => m.focusable_item_count
      None => 0
    },
    match menu {
      Some(m) => m.semantic_menu_text
      None => false
    },
    match menu {
      Some(m) => m.diagonal_evidence
      None => false
    },
    match menu {
      Some(m) => m.high_contrast
      None => false
    },
    match menu {
      Some(m) => m.low_contrast_item_count
      None => 0
    },
    match menu {
      Some(m) => m.hover_changed
      None => None
    },
    match menu {
      Some(m) => m.focus_visible_changed
      None => None
    },
  )
}
