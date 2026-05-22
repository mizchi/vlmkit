//! Landscape diff scoring / ranking policy.
//!
//! The pure logic that used to live in
//! `packages/vlmkit-core/src/landscape-diff.ts`. Pixel sampling stays on
//! the TS side (RGBA buffer iteration); MoonBit owns the cell-score
//! formula, the default grid geometry, threshold counting, and top-N
//! ranking. The TS caller forwards an array of per-cell stats and reads
//! back a pipe-separated summary.

///|
pub fn landscape_default_grid_cols(width : Int, height : Int) -> Int {
  if width <= 0 || height <= 0 {
    return 0
  }
  let long_side : Int = 16
  if width >= height {
    long_side
  } else {
    let scaled = (long_side.to_double() * width.to_double() / height.to_double()).round().to_int()
    if scaled > 8 {
      scaled
    } else {
      8
    }
  }
}

///|
pub fn landscape_default_grid_rows(width : Int, height : Int) -> Int {
  if width <= 0 || height <= 0 {
    return 0
  }
  let long_side : Int = 16
  if width < height {
    long_side
  } else {
    let scaled = (long_side.to_double() * height.to_double() / width.to_double()).round().to_int()
    if scaled > 8 {
      scaled
    } else {
      8
    }
  }
}

///|
pub fn landscape_clamp_byte(value : Double) -> Int {
  let rounded = value.round().to_int()
  if rounded < 0 {
    0
  } else if rounded > 255 {
    255
  } else {
    rounded
  }
}

///|
pub fn landscape_cell_score(
  r1 : Double,
  g1 : Double,
  b1 : Double,
  l1 : Double,
  i1 : Double,
  r2 : Double,
  g2 : Double,
  b2 : Double,
  l2 : Double,
  i2 : Double,
) -> Double {
  let dr = (r1 - r2) / 255.0
  let dg = (g1 - g2) / 255.0
  let db = (b1 - b2) / 255.0
  let dl = (l1 - l2) / 255.0
  let di = i1 - i2
  let value = ((dr * dr + dg * dg + db * db + dl * dl + di * di) / 5.0).sqrt()
  if value < 1.0 {
    value
  } else {
    1.0
  }
}

///|
priv struct LandscapeCellStat {
  r : Double
  g : Double
  b : Double
  l : Double
  ink : Double
}

///|
fn parse_cell_stats(value : String) -> Array[LandscapeCellStat] raise {
  let cells : Array[LandscapeCellStat] = []
  if value == "" {
    return cells
  }
  for part in value.split("|") {
    let owned = part.to_owned().trim().to_owned()
    if owned.is_empty() {
      continue
    }
    let fields = owned.split(",")
    let mut r : Double = 0.0
    let mut g : Double = 0.0
    let mut b : Double = 0.0
    let mut l : Double = 0.0
    let mut ink : Double = 0.0
    let mut idx = 0
    for field in fields {
      let parsed_field = field.to_owned().trim().to_owned()
      let parsed : Double = @string.from_str(parsed_field)
      if idx == 0 {
        r = parsed
      } else if idx == 1 {
        g = parsed
      } else if idx == 2 {
        b = parsed
      } else if idx == 3 {
        l = parsed
      } else if idx == 4 {
        ink = parsed
      }
      idx = idx + 1
    }
    cells.push({ r, g, b, l, ink })
  }
  cells
}

///|
fn collect_top_indices(scores : Array[Double], top_n : Int) -> Array[Int] {
  let total = scores.length()
  let limit = if top_n < total { top_n } else { total }
  let picked : Array[Bool] = Array::make(total, false)
  let result : Array[Int] = []
  for _ in 0..<limit {
    let mut best_idx = -1
    let mut best_score = -1.0
    for i in 0..<total {
      if picked[i] {
        continue
      }
      if scores[i] > best_score {
        best_idx = i
        best_score = scores[i]
      }
    }
    if best_idx < 0 {
      break
    }
    picked[best_idx] = true
    result.push(best_idx)
  }
  result
}

///|
/// Compute the bulk landscape diff summary.
///
/// `baseline_stats` and `current_stats` are pipe-separated cell tuples,
/// each tuple comma-separated as `r,g,b,luma,ink`. Cells are stored in
/// row-major order. The output is a pipe-separated string:
///
/// ```text
/// <score>|<similarity>|<changed_cells>|<total_cells>|<idx0>:<score0>|<idx1>:<score1>|...
/// ```
///
/// `score` is the mean cell score, `similarity` = max(0, 1 - score),
/// `changed_cells` counts cells whose individual score >= changed_threshold,
/// and the trailing pairs are the top-N cells in descending score order.
pub fn landscape_diff_summary(
  cols : Int,
  rows : Int,
  changed_threshold : Double,
  top_n : Int,
  baseline_stats : String,
  current_stats : String,
) -> String raise {
  let total = rows * cols
  if total <= 0 {
    return "1|0|0|0"
  }
  let base = parse_cell_stats(baseline_stats)
  let curr = parse_cell_stats(current_stats)
  if base.length() != total || curr.length() != total {
    // Length mismatch is a caller-side encoding bug. Surface a sentinel
    // value the TS shim can detect rather than raising, so the FFI
    // surface stays string-only.
    return "mismatch|\{total}|\{base.length()}|\{curr.length()}"
  }
  let scores : Array[Double] = []
  let mut sum : Double = 0.0
  let mut changed : Int = 0
  for idx in 0..<total {
    let b = base[idx]
    let c = curr[idx]
    let score = landscape_cell_score(
      b.r,
      b.g,
      b.b,
      b.l,
      b.ink,
      c.r,
      c.g,
      c.b,
      c.l,
      c.ink,
    )
    scores.push(score)
    sum = sum + score
    if score >= changed_threshold {
      changed = changed + 1
    }
  }
  let mean = sum / total.to_double()
  let similarity = if 1.0 - mean > 0.0 { 1.0 - mean } else { 0.0 }
  let parts : Array[String] = [
    mean.to_string(),
    similarity.to_string(),
    changed.to_string(),
    total.to_string(),
  ]
  for idx in collect_top_indices(scores, top_n) {
    parts.push("\{idx}:\{scores[idx]}")
  }
  parts.join("|")
}

///|
/// Compute one cell's hex color from the rounded average channels.
pub fn landscape_cell_hex(r : Double, g : Double, b : Double) -> String {
  let rb = landscape_clamp_byte(r)
  let gb = landscape_clamp_byte(g)
  let bb = landscape_clamp_byte(b)
  "#\{hex_pair(rb)}\{hex_pair(gb)}\{hex_pair(bb)}"
}

///|
fn hex_pair(value : Int) -> String {
  let high = (value / 16) & 0xF
  let low = value & 0xF
  "\{hex_digit(high)}\{hex_digit(low)}"
}

///|
fn hex_digit(value : Int) -> String {
  if value <= 9 {
    value.to_string()
  } else if value == 10 {
    "a"
  } else if value == 11 {
    "b"
  } else if value == 12 {
    "c"
  } else if value == 13 {
    "d"
  } else if value == 14 {
    "e"
  } else {
    "f"
  }
}
