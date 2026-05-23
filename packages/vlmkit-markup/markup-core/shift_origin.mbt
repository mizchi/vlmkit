//! Shift-origin diagnostic policy.
//!
//! Pure helpers used by `packages/vlmkit-markup/src/shift-origin.ts`.
//! BboxElement walking and band grouping stay in TS — moving them
//! across the string-only FFI would require encoding hundreds of
//! bboxes per call. Only the per-element classification (which axis
//! caused the shift?) and the delta-rounding policy live here.

///|
/// Round a number to 2 decimal places, matching JS
/// `Math.round(value * 100) / 100`.
pub fn shift_round_delta(value : Double) -> Double {
  (value * 100.0).round() / 100.0
}

///|
/// Classify a single shifted element's suspected CSS axis from the
/// absolute height delta (variant - baseline) and the absolute top
/// delta. The caller already passed `Math.abs`, so this function takes
/// non-negative inputs.
///
/// Returns one of "height", "margin/padding-above", "y-position".
pub fn shift_classify_suspect(
  abs_height_delta : Double,
  abs_top_delta : Double,
) -> String {
  if abs_height_delta >= 5.0 {
    "height"
  } else if abs_top_delta >= 5.0 {
    "margin/padding-above"
  } else {
    "y-position"
  }
}
