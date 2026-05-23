//! Quality-check threshold policy.
//!
//! Pure rules used by `packages/vlmkit-markup/src/quality.ts`. PNG decoding
//! and pixel iteration stay in TS (the screenshots can be megabytes); only
//! the threshold-to-verdict decisions live here.

///|
/// Classify the error-indicator state from observed red/yellow ratios.
/// Returns one of: "error" (red ratio > 0.05), "warning" (yellow ratio > 0.1),
/// or "none".
pub fn quality_error_state_kind(
  red_ratio : Double,
  yellow_ratio : Double,
) -> String {
  if red_ratio > 0.05 {
    "error"
  } else if yellow_ratio > 0.1 {
    "warning"
  } else {
    "none"
  }
}

///|
/// Coverage gate: 80% of affected components must be covered.
pub fn quality_coverage_passed(covered : Int, total : Int) -> Bool {
  if total <= 0 {
    return true
  }
  let ratio = covered.to_double() / total.to_double()
  ratio >= 0.8
}

///|
/// Layout-shift severity from pixel diff ratio. Returns "large" when
/// >50% of pixels changed, otherwise "small".
pub fn quality_diff_severity(diff_ratio : Double) -> String {
  if diff_ratio > 0.5 {
    "large"
  } else {
    "small"
  }
}
