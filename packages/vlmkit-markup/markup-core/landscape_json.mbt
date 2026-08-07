///| Landscape (coarse grid) diff over the JSON boundary.
///
/// `landscape-diff-summary` is the most valuable command in this batch, and not because
/// of its argument count. It carried a **second positional encoding inside a positional
/// argument**: `baseline_stats` and `current_stats` were `String`s holding
/// `"r,g,b,l,ink|r,g,b,l,ink|…"`, parsed by `parse_cell_stats` with an
/// `idx == 0 / 1 / 2 / 3 / 4` chain. Five fields per cell, positional, comma-delimited,
/// inside a pipe-delimited list, inside a tab-delimited argument list. Nothing checked
/// any level of it, and no cell value could contain a comma or a pipe.
///
/// Two more things the string-only boundary forced, both visible in the original:
///
///  - **A sentinel return.** On a cell-count mismatch it returned
///    `"mismatch|<total>|<base>|<curr>"`, with a comment saying it does that "rather
///    than raising, so the FFI surface stays string-only". A caller had to sniff the
///    first field of a success-shaped result to find out it was an error. Here it
///    raises, and the raise names the counts.
///  - **A pipe-joined result** — `mean|similarity|changed|total|idx:score|idx:score…` —
///    with the top-cell list encoded as `idx:score` pairs that TypeScript split twice.
///    `derive(ToJson)` over a record with an `Array[LandscapeTopCell]` replaces all of
///    that parsing on both sides.
///
/// `landscape_cell_score` is the other worst case: 10 `Double`s, all mutually
/// swappable, being two 5-field samples. Nesting removes the entire class.

///|
/// One grid cell's colour and ink statistics.
pub struct LandscapeCell {
  r : Double
  g : Double
  b : Double
  l : Double
  ink : Double
} derive(FromJson, ToJson)

///|
pub struct LandscapeCellScoreInput {
  baseline : LandscapeCell
  current : LandscapeCell
} derive(FromJson, ToJson)

///|
pub fn landscape_cell_score_json(input : LandscapeCellScoreInput) -> Double {
  landscape_cell_score(
    input.baseline.r,
    input.baseline.g,
    input.baseline.b,
    input.baseline.l,
    input.baseline.ink,
    input.current.r,
    input.current.g,
    input.current.b,
    input.current.l,
    input.current.ink,
  )
}

///|
pub struct LandscapeCellHexInput {
  r : Double
  g : Double
  b : Double
} derive(FromJson, ToJson)

///|
pub fn landscape_cell_hex_json(input : LandscapeCellHexInput) -> String {
  landscape_cell_hex(input.r, input.g, input.b)
}

///|
pub struct LandscapeGridInput {
  width : Int
  height : Int
} derive(FromJson, ToJson)

///|
/// `cols|rows` was two integers in a string. It is two integers.
pub struct LandscapeGrid {
  cols : Int
  rows : Int
} derive(ToJson)

///|
pub fn landscape_default_grid_json(input : LandscapeGridInput) -> LandscapeGrid {
  {
    cols: landscape_default_grid_cols(input.width, input.height),
    rows: landscape_default_grid_rows(input.width, input.height),
  }
}

///|
pub struct LandscapeDiffInput {
  cols : Int
  rows : Int
  changed_threshold : Double
  top_n : Int
  baseline : Array[LandscapeCell]
  current : Array[LandscapeCell]
} derive(FromJson, ToJson)

///|
pub struct LandscapeTopCell {
  index : Int
  score : Double
} derive(ToJson)

///|
pub struct LandscapeDiffOutput {
  mean : Double
  similarity : Double
  changed : Int
  total : Int
  top : Array[LandscapeTopCell]
} derive(ToJson)

///|
/// The rules, computed against the typed input.
///
/// This is the one handler in the batch that does NOT delegate to its positional twin,
/// and the reason is specific rather than a lapse: the twin's first act is to *parse the
/// sub-encoding this input replaces*, so delegating would mean re-serializing the cells
/// into `"r,g,b,l,ink|…"` to have them parsed straight back. The arithmetic below is the
/// same and still calls `landscape_cell_score` and `collect_top_indices` — only the
/// decoding differs, which is exactly what the differential test compares.
pub fn landscape_diff(input : LandscapeDiffInput) -> LandscapeDiffOutput raise {
  let total = input.rows * input.cols
  if total <= 0 {
    return { mean: 1.0, similarity: 0.0, changed: 0, total: 0, top: [] }
  }
  // Raised, not returned as a "mismatch" sentinel. A caller that has to inspect a
  // success-shaped result to learn it failed will eventually forget to.
  if input.baseline.length() != total || input.current.length() != total {
    raise Failure(
      "landscape cell count mismatch: expected \{total} (\{input.cols}x\{input.rows}), " +
      "baseline has \{input.baseline.length()}, current has \{input.current.length()}",
    )
  }
  let scores : Array[Double] = []
  let mut sum : Double = 0.0
  let mut changed : Int = 0
  for idx in 0..<total {
    let b = input.baseline[idx]
    let c = input.current[idx]
    let score = landscape_cell_score(b.r, b.g, b.b, b.l, b.ink, c.r, c.g, c.b, c.l, c.ink)
    scores.push(score)
    sum = sum + score
    if score >= input.changed_threshold {
      changed = changed + 1
    }
  }
  let mean = sum / total.to_double()
  let similarity = if 1.0 - mean > 0.0 { 1.0 - mean } else { 0.0 }
  let top : Array[LandscapeTopCell] = []
  for idx in collect_top_indices(scores, input.top_n) {
    top.push({ index: idx, score: scores[idx] })
  }
  { mean, similarity, changed, total, top }
}
