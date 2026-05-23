//! Region content-type classifier policy.
//!
//! Pixel scan stays in TS (`packages/vlmkit-markup/src/region-classify.ts`).
//! This module owns just the decision tree: from extracted region features
//! (colorCount / lumaStd / stripeRows / aspect / area) to a kind label
//! ("text" / "filled-rect" / "icon" / "image" / "unknown") plus a
//! confidence in [0, 1].
//!
//! Thresholds calibrated against system-ui at 14-40 px on light bg —
//! anti-aliased rendering inflates colorCount well above what a naive
//! "uniform" view would suggest.

///|
/// Classify a region from extracted features. Returns "<kind>|<confidence>"
/// where confidence is rendered with 2 decimals.
pub fn region_classify_kind(
  area : Int,
  aspect : Double,
  luma_std : Double,
  color_count : Int,
  stripe_rows : Int,
) -> String {
  // Tiny region — likely icon or single character.
  if area < 2000 && aspect > 0.4 && aspect < 2.5 {
    return "icon|0.65"
  }
  // Multiple distinct dark stripes → text.
  if stripe_rows >= 2 {
    let raw = 0.55 + stripe_rows.to_double() * 0.08
    let confidence = if raw > 1.0 { 1.0 } else { raw }
    return "text|" + format_two_dp(confidence)
  }
  // Truly uniform fill (single color block, no text overlay).
  if color_count <= 8 && luma_std < 12.0 {
    return "filled-rect|0.9"
  }
  // Button/badge-like: bounded color count, narrow luma std (AA on text
  // inside a solid fill is the main source of variation).
  if color_count <= 120 && luma_std < 45.0 {
    return "filled-rect|0.65"
  }
  // Single-stripe text band — common short labels / single-line text.
  if stripe_rows == 1 {
    return "text|0.55"
  }
  // Many colors + no stripe structure → textured / image content.
  if color_count > 200 {
    return "image|0.6"
  }
  "unknown|0.5"
}

///|
/// Format a Double with 2 fractional digits, matching JS
/// `value.toFixed(2)`. Range is [0, 1] so we keep the implementation tight.
fn format_two_dp(value : Double) -> String {
  let scaled = (value * 100.0).round().to_int()
  let int_part = scaled / 100
  let frac_part = scaled % 100
  let frac_str = if frac_part < 10 {
    "0" + frac_part.to_string()
  } else {
    frac_part.to_string()
  }
  int_part.to_string() + "." + frac_str
}
