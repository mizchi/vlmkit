///| Measurement policies over the JSON boundary: contrast, touch, focus order,
/// grid ratios, shift and quality thresholds.
///
/// Eight of the remaining risky positional commands. They share a shape the
/// positional form was actively bad at: **coordinate pairs and colour triples**, where
/// every position has the same type and swapping two of them still parses.
/// `a11y-contrast-evaluate` took eight arguments of which six were `Int` —
/// `fr, fg, fb, br, bg, bb` — so foreground and background could be exchanged in
/// either direction, and the contrast ratio is symmetric enough that many cases would
/// return the same answer while the ones that matter would not.
///
/// Nesting is what fixes it, not renaming: `{foreground: {r,g,b}, background: {r,g,b}}`
/// makes the swap a type error at the call site rather than a silent one inside.
///
/// The rules are not rewritten. Each handler decodes a struct and calls the existing
/// function, so `markup-core-migration.test.ts` compares two decoders over shared rule
/// code and a disagreement is a wiring bug.

///|
/// An 8-bit colour. Shared by every handler here that takes one, so a swap between
/// two colours needs the caller to name the wrong field rather than count wrong.
pub struct Rgb {
  r : Int
  g : Int
  b : Int
} derive(FromJson, ToJson)

///|
/// A point in CSS pixels. Same argument as `Rgb`: `ax, ay, bx, by` as four positional
/// `Double`s has 12 distinct wrong orderings that all parse.
pub struct Point {
  x : Double
  y : Double
} derive(FromJson, ToJson)

///|
pub struct ContrastEvaluateInput {
  foreground : Rgb
  background : Rgb
  font_size : Double
  font_weight : Int
} derive(FromJson, ToJson)

///|
/// The verdict, as a record rather than `"4.53|4.5|AA"`.
///
/// The joined form meant TypeScript split on `|`, coerced two fields to `Number`, and
/// hand-validated the third against a literal union — every one of which is a place to
/// be wrong about a value MoonBit already knew the type of.
pub struct ContrastEvaluateOutput {
  ratio : Double
  required_aa : Double
  level : String
} derive(ToJson)

///|
pub fn contrast_evaluate(input : ContrastEvaluateInput) -> ContrastEvaluateOutput raise {
  let joined = a11y_contrast_evaluate(
    input.foreground.r,
    input.foreground.g,
    input.foreground.b,
    input.background.r,
    input.background.g,
    input.background.b,
    input.font_size,
    input.font_weight,
  )
  let parts = split_issue_ids(joined)
  if parts.length() != 3 {
    raise Failure("a11y_contrast_evaluate returned \{parts.length()} fields: \{joined}")
  }
  { ratio: parse_double_field(parts[0]), required_aa: parse_double_field(parts[1]), level: parts[2] }
}

///|
pub struct TouchClusterInput {
  a : Point
  b : Point
} derive(FromJson, ToJson)

///|
pub fn touch_in_cluster(input : TouchClusterInput) -> String {
  a11y_touch_in_cluster(input.a.x, input.a.y, input.b.x, input.b.y)
}

///|
pub struct FocusOrderInput {
  same_path : Bool
  previous : Point
  current : Point
  /// Width of the element focus came from. Optional: absent means "not measured", and the
  /// classification then behaves exactly as it did before columns were understood.
  previous_width : Double?
} derive(FromJson, ToJson)

///|
pub fn focus_order_classification(input : FocusOrderInput) -> String {
  focus_order_classify_boxes(
    input.same_path,
    input.previous.x,
    input.previous.y,
    match input.previous_width {
      Some(w) => w
      None => 0.0
    },
    input.current.x,
    input.current.y,
  )
}

///|
/// `grid_arrays_close` took two **CSV strings**. Numbers are numbers here.
///
/// The CSV form had no way to carry a value containing a comma, needed a parser on this
/// side, and made "these two lists have different lengths" — which the rule treats as
/// not-close — indistinguishable from a malformed string.
pub struct GridArraysCloseInput {
  a : Array[Double]
  b : Array[Double]
  tolerance : Double
} derive(FromJson, ToJson)

///|
pub fn grid_arrays_close_json(input : GridArraysCloseInput) -> Bool {
  if input.a.length() != input.b.length() {
    return false
  }
  for i in 0..<input.a.length() {
    let diff = input.a[i] - input.b[i]
    let abs_diff = if diff < 0.0 { -diff } else { diff }
    if abs_diff > input.tolerance {
      return false
    }
  }
  true
}

///|
pub struct GridGcdInput {
  a : Int
  b : Int
} derive(FromJson, ToJson)

///|
pub fn grid_gcd_json(input : GridGcdInput) -> Int {
  grid_gcd(input.a, input.b)
}

///|
pub struct ShiftSuspectInput {
  abs_height_delta : Double
  abs_top_delta : Double
} derive(FromJson, ToJson)

///|
pub fn shift_suspect(input : ShiftSuspectInput) -> String {
  shift_classify_suspect(input.abs_height_delta, input.abs_top_delta)
}

///|
pub struct ErrorStateInput {
  red_ratio : Double
  yellow_ratio : Double
} derive(FromJson, ToJson)

///|
pub fn error_state_kind(input : ErrorStateInput) -> String {
  quality_error_state_kind(input.red_ratio, input.yellow_ratio)
}

///|
pub struct CoverageInput {
  covered : Int
  total : Int
} derive(FromJson, ToJson)

///|
pub fn coverage_passed(input : CoverageInput) -> Bool {
  quality_coverage_passed(input.covered, input.total)
}

///|
/// Parse a `Double` the rule functions formatted into a string on their way out.
///
/// Only reachable for values MoonBit itself just printed, so a failure here means the
/// formatter and this disagree — a boundary bug, which is why it raises rather than
/// defaulting to zero.
fn parse_double_field(value : String) -> Double raise {
  @string.from_str(value)
}
