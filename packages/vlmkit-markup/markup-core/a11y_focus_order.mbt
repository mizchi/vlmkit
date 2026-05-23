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
fn abs(value : Double) -> Double {
  if value < 0.0 {
    -value
  } else {
    value
  }
}
