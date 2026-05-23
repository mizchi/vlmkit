//! Grid ratio inference policy.
//!
//! Pure scoring helpers used by `packages/vlmkit-markup/src/grid-ratio.ts`.
//! Width lists are exchanged as comma-separated decimals so the string-only
//! markup-core FFI surface keeps working.

///|
pub fn grid_gcd(a : Int, b : Int) -> Int {
  let aa = if a < 0 { -a } else { a }
  let bb = if b < 0 { -b } else { b }
  grid_gcd_loop(aa, bb)
}

///|
fn grid_gcd_loop(a : Int, b : Int) -> Int {
  if b == 0 {
    a
  } else {
    grid_gcd_loop(b, a % b)
  }
}

///|
pub fn grid_all_equal(widths_csv : String, tolerance : Double) -> Bool raise {
  let widths = parse_double_csv(widths_csv)
  if widths.length() < 2 {
    return true
  }
  let mut min = widths[0]
  let mut max = widths[0]
  for w in widths {
    if w < min {
      min = w
    }
    if w > max {
      max = w
    }
  }
  max - min <= tolerance
}

///|
pub fn grid_arrays_close(
  a_csv : String,
  b_csv : String,
  tolerance : Double,
) -> Bool raise {
  let a = parse_double_csv(a_csv)
  let b = parse_double_csv(b_csv)
  if a.length() != b.length() {
    return false
  }
  for i in 0..<a.length() {
    let diff = a[i] - b[i]
    let abs_diff = if diff < 0.0 { -diff } else { diff }
    if abs_diff > tolerance {
      return false
    }
  }
  true
}

///|
pub fn grid_ratios_to_decimal(widths_csv : String) -> String raise {
  let widths = parse_double_csv(widths_csv)
  if widths.length() == 0 {
    return ""
  }
  let mut min = widths[0]
  for w in widths {
    if w < min {
      min = w
    }
  }
  if min <= 0.0 {
    let parts : Array[String] = []
    for w in widths {
      parts.push(w.to_string())
    }
    return parts.join(" : ")
  }
  let parts : Array[String] = []
  for w in widths {
    parts.push(format_three_dp(w / min))
  }
  parts.join(" : ")
}

///|
/// Try to express `widths` as a low-integer fr ratio (e.g. "7fr 5fr").
/// Returns an empty string when no integer denominator within
/// `[1, max_denom]` keeps the per-child relative error below 1%.
pub fn grid_approximate_integer_fr(
  widths_csv : String,
  max_denom : Int,
) -> String raise {
  let widths = parse_double_csv(widths_csv)
  if widths.length() == 0 {
    return ""
  }
  let mut min = widths[0]
  for w in widths {
    if w < min {
      min = w
    }
  }
  if min <= 0.0 {
    return ""
  }
  let ratios : Array[Double] = []
  for w in widths {
    ratios.push(w / min)
  }
  let mut best_denoms : Array[Int] = []
  let mut best_err : Double = 0.0
  let mut found = false
  for d in 1..=max_denom {
    let ints : Array[Int] = []
    let mut has_zero = false
    for r in ratios {
      let n = (r * d.to_double()).round().to_int()
      if n <= 0 {
        has_zero = true
        break
      }
      ints.push(n)
    }
    if has_zero {
      continue
    }
    let mut err : Double = 0.0
    for i in 0..<ratios.length() {
      let approx = ints[i].to_double() / d.to_double()
      let delta = approx - ratios[i]
      let abs_delta = if delta < 0.0 { -delta } else { delta }
      err = err + abs_delta / ratios[i]
    }
    err = err / ratios.length().to_double()
    if err < 0.01 && (!found || err < best_err) {
      let mut g = ints[0]
      for n in ints {
        g = grid_gcd(g, n)
      }
      let reduced : Array[Int] = []
      for n in ints {
        reduced.push(n / g)
      }
      best_denoms = reduced
      best_err = err
      found = true
    }
  }
  if !found {
    return ""
  }
  format_fr_list(best_denoms)
}

///|
fn format_fr_list(values : Array[Int]) -> String {
  let parts : Array[String] = []
  for v in values {
    parts.push("\{v}fr")
  }
  parts.join(" ")
}

///|
fn parse_double_csv(value : String) -> Array[Double] raise {
  let out : Array[Double] = []
  if value == "" {
    return out
  }
  for part in value.split(",") {
    let s = part.to_owned().trim().to_owned()
    if s.is_empty() {
      continue
    }
    let v : Double = @string.from_str(s)
    out.push(v)
  }
  out
}

///|
/// Format a non-negative-leaning Double with exactly 3 decimal places,
/// matching JS `Number.prototype.toFixed(3)`.
fn format_three_dp(value : Double) -> String {
  let neg = value < 0.0
  let abs_val = if neg { -value } else { value }
  let scaled = (abs_val * 1000.0).round().to_int()
  let int_part = scaled / 1000
  let frac_part = scaled % 1000
  let sign = if neg { "-" } else { "" }
  let frac_str = if frac_part < 10 {
    "00\{frac_part}"
  } else if frac_part < 100 {
    "0\{frac_part}"
  } else {
    frac_part.to_string()
  }
  "\{sign}\{int_part}.\{frac_str}"
}
