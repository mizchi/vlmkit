//! Touch-target size policy.
//!
//! Pure helpers used by `packages/vlmkit-markup/src/a11y-touch.ts`. The
//! Playwright capture stays in TS; this module owns the WCAG required-
//! size thresholds (44 px AAA / 24 px AA) and the cluster-distance check
//! (24 px center-to-center for "with-spacing" leniency).

///|
/// Required minimum side length per WCAG level. Inputs:
///   "AAA" → 44 (WCAG 2.5.5 — Target Size: ≥ 44 px × 44 px)
///   "AA"  → 24 (WCAG 2.5.8 — Target Size (Minimum): ≥ 24 px × 24 px,
///               with spacing leniency)
/// Anything else falls back to AAA (44).
pub fn a11y_touch_required_side(level : String) -> Int {
  if level == "AA" {
    24
  } else {
    44
  }
}

///|
/// True when `min_side` (smaller of bbox.width / bbox.height) is below the
/// required size for `level`. Used by the TS loop to decide whether to
/// surface a finding for the current target.
pub fn a11y_touch_below_required(min_side : Double, level : String) -> String {
  let required = a11y_touch_required_side(level)
  if min_side < required.to_double() {
    "true"
  } else {
    "false"
  }
}

///|
/// True when two target centers are within 24 px of each other — the
/// WCAG "with spacing" leniency threshold that downgrades a sub-24 px
/// target into a non-finding when no other interactive element crowds
/// it.
pub fn a11y_touch_in_cluster(
  ax : Double,
  ay : Double,
  bx : Double,
  by : Double,
) -> String {
  let dx = bx - ax
  let dy = by - ay
  let distance_sq = dx * dx + dy * dy
  if distance_sq < 24.0 * 24.0 {
    "true"
  } else {
    "false"
  }
}
