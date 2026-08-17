//! Focus-order classification policy.
//!
//! Pure helper used by `packages/vlmkit-markup/src/a11y-focus-order.ts`.
//! The Playwright Tab-press loop stays in TS; this module owns the
//! 4-threshold decision tree that compares a consecutive (prev, cur)
//! focus step pair and decides whether the transition is a trap, a
//! reverse jump, a row-skip, or normal forward motion.
//!
//! Thresholds (validated via subagent dogfood — see comments in the
//! original `analyzeFocusOrderSteps` for the rationale):
//!   - same bbox  : |dx| < 4 AND |dy| < 4 (paired with same path → trap)
//!   - same row   : |dy| <= 16 (used to decide if dx matters)
//!   - reverse-left : same row AND dx < -40
//!   - reverse-up   : dy < -24 (~ one button-row height)
//!   - skip-row     : dy > 200

///|
/// Classify a single (prev, cur) focus step pair.
///
/// Returns one of: "trap", "reverse-left", "reverse-up", "skip-row", "ok".
/// "ok" means the transition matches the visual L→R / T→B reading order
/// without a suspicious jump.
pub fn focus_order_classify(
  same_path : Bool,
  prev_x : Double,
  prev_y : Double,
  cur_x : Double,
  cur_y : Double,
) -> String {
  let dx_abs = abs(cur_x - prev_x)
  let dy_abs = abs(cur_y - prev_y)
  let same_bbox = dx_abs < 4.0 && dy_abs < 4.0
  if same_path && same_bbox {
    return "trap"
  }
  let dy = cur_y - prev_y
  let dx = cur_x - prev_x
  let same_row = abs(dy) <= 16.0
  if same_row && dx < -40.0 {
    return "reverse-left"
  }
  if dy < -24.0 {
    return "reverse-up"
  }
  if dy > 200.0 {
    return "skip-row"
  }
  "ok"
}


///|
/// The same classification, plus the one fact the five-argument form cannot express: how wide
/// the element focus came FROM was.
///
/// A multi-column footer tabs down column one, then jumps back to the top of column two. By
/// `dy` alone that is `reverse-up` at suspect severity, and vite.dev's front page produced four
/// of them (columns at x=113 / 245 / 391, each ending at y=696 and the next starting at y=616)
/// — exit 1 on an idiomatic layout. When the new element starts at or right of the previous
/// one's right edge, the two are in different columns and reading order says the jump is
/// forward, so this reports `column-advance` and lets the caller decide.
///
/// A jump back up in the SAME column stays `reverse-up`: on that same page, two stacked lists
/// at x=391 are tabbed lower-first, which is a real finding and must survive this.
pub fn focus_order_classify_boxes(
  same_path : Bool,
  prev_x : Double,
  prev_y : Double,
  prev_width : Double,
  cur_x : Double,
  cur_y : Double,
) -> String {
  let base = focus_order_classify(same_path, prev_x, prev_y, cur_x, cur_y)
  if base != "reverse-up" {
    return base
  }
  // `prev_width <= 0` means the caller did not measure a width (the legacy positional path, or
  // a zero-size element). Nothing can be concluded about columns then, so the verdict stands.
  if prev_width > 0.0 && cur_x >= prev_x + prev_width {
    return "column-advance"
  }
  base
}

///|
fn abs(value : Double) -> Double {
  if value < 0.0 {
    -value
  } else {
    value
  }
}
