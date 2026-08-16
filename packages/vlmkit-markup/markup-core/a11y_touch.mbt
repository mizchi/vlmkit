//! Touch-target size policy.
//!
//! Pure helpers used by `packages/vlmkit-markup/src/a11y-touch.ts`. The
//! Playwright capture stays in TS; this module owns the WCAG required-
//! size thresholds (44 px AAA / 24 px AA), the cluster-distance check
//! (24 px center-to-center), and the success criteria's own exceptions.
//!
//! ## Why the exceptions live here and not in TypeScript
//!
//! Reporting every sub-floor target was stricter than the criteria it cites, and
//! measurably unusable: on Bootstrap's dashboard example the gate failed 17 of 18
//! targets at its AAA default, and 37 of 38 on vite.dev. Both figures are unmodified
//! vendor defaults, so a project could not adopt either framework and pass — and a gate
//! that cannot be passed gets turned off whole, which is worse than a correct answer.
//!
//! Both criteria carry exceptions, and two of them are decidable from geometry and
//! computed style:
//!
//!   - **Inline** (2.5.5 and 2.5.8): the target is in a sentence, or its size is
//!     constrained by the line-height of the surrounding non-target text. A link inside a
//!     paragraph is the case; the author cannot grow it without breaking the prose.
//!   - **Spacing** (2.5.8, AA only): an undersized target is far enough from its
//!     neighbours that a 24 px circle centered on each does not intersect. This is the
//!     one the old `clustered` annotation half-measured and never acted on.
//!
//! The other three (Equivalent, User-agent control, Essential) need intent, not
//! measurement, and stay out — `--allow "<selector>;<reason>"` is how a project declares
//! those, which keeps a human judgement visible as a human judgement.
//!
//! The thresholds were already here, so putting the exceptions in TypeScript would have
//! split one criterion across two languages — the failure this repo keeps rediscovering.
//! `touch_policy` therefore takes the whole page at once. That also collapses what the
//! caller used to do in O(n²) boundary crossings (one `a11y_touch_in_cluster` per pair)
//! into a single call.

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

///|
/// The 24 px circle diameter WCAG 2.5.8's spacing exception measures with, and the
/// cluster-annotation distance. One constant because they are the same number in the
/// criterion: two undersized targets clear each other exactly when their 12 px-radius
/// circles do not intersect, i.e. when their centers are 24 px apart.
const TOUCH_SPACING_DIAMETER : Double = 24.0

///|
/// A rendered target box, in CSS pixels.
pub struct TouchRect {
  x : Double
  y : Double
  width : Double
  height : Double
} derive(FromJson, ToJson)

///|
/// One interactive target, reduced to what the criteria read.
pub struct TouchTargetInput {
  rect : TouchRect
  /// Computed `display`. The Inline exception needs to know the author did NOT give the
  /// box its own size — a `block` or `inline-block` control is sized by its own rules and
  /// can be grown, so it is never inline-exempt however much text surrounds it.
  display : String
  /// Whether the nearest block ancestor holds text that is not this target's own — i.e.
  /// the target really is in a sentence. A lone `<a>` in an `<li>` is a nav item, not
  /// prose, and WCAG intends those to be sized.
  in_sentence : Bool
} derive(FromJson, ToJson)

///|
pub struct TouchPolicyInput {
  level : String
  targets : Array[TouchTargetInput]
} derive(FromJson, ToJson)

///|
/// The verdict for one target, by input position.
pub struct TouchVerdictOutput {
  /// Position in the input array. Positional, not any id the element carries — see
  /// `InteractionIssueOutput.element_position` for why.
  target_position : Int
  min_side : Double
  /// Below the level's floor. True even when an exception applies: the exception decides
  /// whether it is a *finding*, and the caller lists exempted targets rather than
  /// dropping them.
  undersized : Bool
  /// `""`, `"inline"` or `"spacing"` — the criterion's own exception, when one applies.
  exception : String
  /// Another below-floor target within 24 px center-to-center. Annotation only; it never
  /// causes a finding, and it no longer suppresses one either.
  clustered : Bool
} derive(ToJson)

///|
pub struct TouchPolicyOutput {
  required : Int
  verdicts : Array[TouchVerdictOutput]
} derive(ToJson)

///|
/// Distance from a point to a rectangle — 0 when the point is inside it.
///
/// Needed because the spacing exception is not symmetric: an undersized target's circle
/// must clear another target's *bounding box* when that other target meets the floor, and
/// only clear the other *circle* when it does not. Comparing centers in both cases (what
/// the cluster check does) would let a 12 px circle overlap the edge of a wide button
/// whose center is far away.
fn point_rect_distance(px : Double, py : Double, rect : TouchRect) -> Double {
  let dx = if px < rect.x {
    rect.x - px
  } else if px > rect.x + rect.width {
    px - (rect.x + rect.width)
  } else {
    0.0
  }
  let dy = if py < rect.y {
    rect.y - py
  } else if py > rect.y + rect.height {
    py - (rect.y + rect.height)
  } else {
    0.0
  }
  (dx * dx + dy * dy).sqrt()
}

///|
/// Whether the target at `index` satisfies WCAG 2.5.8's spacing exception: a 24 px
/// diameter circle centered on its bounding box intersects neither another target's box
/// nor another undersized target's circle.
fn touch_spacing_clear(
  targets : Array[TouchTargetInput],
  undersized : Array[Bool],
  index : Int,
  radius : Double,
) -> Bool {
  let subject = targets[index]
  let cx = subject.rect.x + subject.rect.width / 2.0
  let cy = subject.rect.y + subject.rect.height / 2.0
  let diameter = radius * 2.0
  for j in 0..<targets.length() {
    if j == index {
      continue
    }
    let other = targets[j]
    if undersized[j] {
      // Circle against circle: two radii, so the centers must be a full diameter apart.
      let ox = other.rect.x + other.rect.width / 2.0
      let oy = other.rect.y + other.rect.height / 2.0
      let dx = ox - cx
      let dy = oy - cy
      if dx * dx + dy * dy < diameter * diameter {
        return false
      }
    } else if point_rect_distance(cx, cy, other.rect) < radius {
      // Circle against a compliant target's box.
      return false
    }
  }
  true
}

///|
/// Evaluate the whole page's touch targets against `level`, applying the criteria's own
/// Inline and Spacing exceptions.
///
/// Exceptions are *reported*, not silently applied: each verdict says which one excused
/// it, so a reader can disagree with the call. The Inline exception belongs to both 2.5.5
/// (AAA) and 2.5.8 (AA); the Spacing exception is 2.5.8 only, so it does not apply at AAA.
pub fn touch_policy(input : TouchPolicyInput) -> TouchPolicyOutput {
  let required = a11y_touch_required_side(input.level)
  let radius = TOUCH_SPACING_DIAMETER / 2.0
  let undersized : Array[Bool] = []
  let min_sides : Array[Double] = []
  for target in input.targets {
    let min_side = if target.rect.width < target.rect.height {
      target.rect.width
    } else {
      target.rect.height
    }
    min_sides.push(min_side)
    undersized.push(min_side < required.to_double())
  }
  let verdicts : Array[TouchVerdictOutput] = []
  for i in 0..<input.targets.length() {
    let target = input.targets[i]
    // Clustered is computed for every undersized target, including exempt ones: it
    // describes the page, and a reader auditing an exception wants to see it.
    let mut clustered = false
    if undersized[i] {
      let cx = target.rect.x + target.rect.width / 2.0
      let cy = target.rect.y + target.rect.height / 2.0
      for j in 0..<input.targets.length() {
        if j == i || !undersized[j] {
          continue
        }
        let other = input.targets[j]
        let ox = other.rect.x + other.rect.width / 2.0
        let oy = other.rect.y + other.rect.height / 2.0
        if a11y_touch_in_cluster(cx, cy, ox, oy) == "true" {
          clustered = true
          break
        }
      }
    }
    let exception = if !undersized[i] {
      ""
    } else if target.display == "inline" && target.in_sentence {
      "inline"
    } else if input.level == "AA" &&
      touch_spacing_clear(input.targets, undersized, i, radius) {
      "spacing"
    } else {
      ""
    }
    verdicts.push({
      target_position: i,
      min_side: min_sides[i],
      undersized: undersized[i],
      exception,
      clustered,
    })
  }
  { required, verdicts }
}
