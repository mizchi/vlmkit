//! WCAG 2.1 contrast policy.
//!
//! Pure helpers used by `packages/vlmkit-markup/src/a11y-contrast.ts`.
//! The Playwright capture + per-sample iteration stay in TS; this module
//! owns the math (relative luminance, contrast ratio) and the four-tier
//! WCAG classification — exactly the part where the thresholds matter and
//! the formula is worth a single source of truth.

///|
/// Relative luminance per WCAG 2.1 formula. Inputs are 8-bit channel
/// values in [0, 255].
fn rel_luma(r : Int, g : Int, b : Int) -> Double {
  channel(r) * 0.2126 + channel(g) * 0.7152 + channel(b) * 0.0722
}

///|
fn channel(c : Int) -> Double {
  let v = c.to_double() / 255.0
  if v <= 0.03928 {
    v / 12.92
  } else {
    @math.pow((v + 0.055) / 1.055, 2.4)
  }
}

///|
/// WCAG contrast ratio between two RGB triples ∈ [0, 255]. Output is
/// `(L_lighter + 0.05) / (L_darker + 0.05)` so values range from 1 to 21.
pub fn a11y_contrast_ratio(
  fr : Int,
  fg : Int,
  fb : Int,
  br : Int,
  bg : Int,
  bb : Int,
) -> Double {
  let la = rel_luma(fr, fg, fb)
  let lb = rel_luma(br, bg, bb)
  let lighter = if la > lb { la } else { lb }
  let darker = if la < lb { la } else { lb }
  (lighter + 0.05) / (darker + 0.05)
}

///|
/// Single-call evaluation. Returns "<ratio>|<requiredAA>|<level>" where:
///   - `ratio`       — 2-decimal contrast ratio
///   - `requiredAA`  — 4.5 for body text, 3.0 for "large text"
///   - `level`       — "AAA" / "AA" / "AA-large" / "fail"
///
/// "Large text" per WCAG 2.1: font-size ≥ 18 px OR (font-size ≥ 14 px AND
/// font-weight ≥ 700).
pub fn a11y_contrast_evaluate(
  fr : Int,
  fg : Int,
  fb : Int,
  br : Int,
  bg : Int,
  bb : Int,
  font_size : Double,
  font_weight : Int,
) -> String {
  let ratio = a11y_contrast_ratio(fr, fg, fb, br, bg, bb)
  let is_large = font_size >= 18.0 ||
    (font_size >= 14.0 && font_weight >= 700)
  let required_aa = if is_large { 3.0 } else { 4.5 }
  let level = if ratio >= 7.0 {
    "AAA"
  } else if ratio >= 4.5 {
    "AA"
  } else if ratio >= 3.0 && is_large {
    "AA-large"
  } else {
    "fail"
  }
  format_two_dp_contrast(ratio) +
  "|" +
  format_one_dp(required_aa) +
  "|" +
  level
}

///|
fn format_two_dp_contrast(value : Double) -> String {
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

///|
fn format_one_dp(value : Double) -> String {
  let scaled = (value * 10.0).round().to_int()
  let int_part = scaled / 10
  let frac_part = scaled % 10
  int_part.to_string() + "." + frac_part.to_string()
}
