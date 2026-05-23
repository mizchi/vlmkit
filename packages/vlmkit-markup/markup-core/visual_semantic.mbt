//! Visual semantic policy.
//!
//! Pure decision tree used by `packages/vlmkit-markup/src/visual-semantic.ts`.
//! Given a diff region's geometry, density, and (optional) baseline / variant
//! color samples, decide what kind of visual change it represents.
//!
//! Region iteration and description-string formatting stay in TS — only the
//! classification + page-surface predicate live here.

///|
/// Returns "true" when the color is on a likely page surface (very light or
/// very dark, low chroma). Caller compares baseline vs variant surface state
/// to spot element add/remove transitions.
pub fn visual_is_likely_page_surface(r : Int, g : Int, b : Int) -> String {
  let max_c = if r > g {
    if r > b { r } else { b }
  } else if g > b {
    g
  } else {
    b
  }
  let min_c = if r < g {
    if r < b { r } else { b }
  } else if g < b {
    g
  } else {
    b
  }
  let chroma = max_c - min_c
  let luma = 0.299 * r.to_double() + 0.587 * g.to_double() + 0.114 * b.to_double()
  if chroma <= 12 && (luma >= 240.0 || luma <= 18.0) {
    "true"
  } else {
    "false"
  }
}

///|
/// Classify a diff region. Inputs:
///   - region_type: "shift" or "" (any other / unknown)
///   - width, height: region dims in px
///   - diff_pixel_count: hot pixels inside the region
///   - total_pixels: total diff image pixel count
///   - has_color_sample: whether baseline/variant colors are populated
///   - baseline_*, current_*: RGB ∈ [0,255] (ignored when has_color_sample == false)
///
/// Returns "<type>|<confidence>" where confidence is a number in [0, 1] and
/// type is one of:
///   layout-shift / icon-change / text-change / color-change /
///   element-added / element-removed
pub fn visual_classify_region(
  region_type : String,
  width : Int,
  height : Int,
  diff_pixel_count : Int,
  total_pixels : Int,
  has_color_sample : Bool,
  baseline_r : Int,
  baseline_g : Int,
  baseline_b : Int,
  current_r : Int,
  current_g : Int,
  current_b : Int,
) -> String {
  let area = width * height
  let safe_height = if height < 1 { 1 } else { height }
  let aspect_ratio = width.to_double() / safe_height.to_double()
  let density = if area > 0 {
    diff_pixel_count.to_double() / area.to_double()
  } else {
    0.0
  }
  let global_ratio = if total_pixels > 0 {
    diff_pixel_count.to_double() / total_pixels.to_double()
  } else {
    0.0
  }

  // Hot path: explicit shift hint always wins.
  if region_type == "shift" {
    return "layout-shift|0.8"
  }

  // Element presence change (background↔content transition).
  if has_color_sample && density >= 0.5 && area >= 1024 {
    let baseline_surface = visual_is_likely_page_surface(baseline_r, baseline_g, baseline_b) ==
      "true"
    let current_surface = visual_is_likely_page_surface(current_r, current_g, current_b) ==
      "true"
    if baseline_surface != current_surface {
      if baseline_surface {
        return "element-added|0.65"
      }
      return "element-removed|0.65"
    }
  }

  // Small square — likely icon.
  if area < 4096 && aspect_ratio > 0.5 && aspect_ratio < 2.0 {
    return "icon-change|0.7"
  }

  // Wide + sparse — text run.
  if aspect_ratio > 3.0 && density < 0.5 {
    return "text-change|0.6"
  }

  // High density, small-medium area — color change.
  if density > 0.7 && area.to_double() < total_pixels.to_double() * 0.3 {
    return "color-change|0.65"
  }

  // Large area — layout shift fallback.
  if global_ratio > 0.05 {
    return "layout-shift|0.5"
  }

  // New element (high density + medium size).
  if density > 0.5 && area > 1024 {
    return "element-added|0.4"
  }

  // Default — small unclassified change.
  "element-added|0.3"
}

///|
/// Group threshold for layout-shift coalescing — regions whose Y centers are
/// within this many pixels collapse into one layout-shift entry. Lives here
/// so the threshold is editable alongside the classifier rather than as a
/// magic number on the TS side.
pub fn visual_layout_shift_group_threshold() -> Int {
  64
}
