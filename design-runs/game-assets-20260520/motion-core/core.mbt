///|
const ARM_REST_MOTION_GATE_DEG : Double = 60.0

///|
const HEIGHT_SCALE_DELTA_THRESHOLD : Double = 0.2

///|
const VERTICAL_ROOT_MOTION_SCALE_THRESHOLD : Double = 0.08

///|
const CORE_SCALE_SPREAD_WARN_RATIO : Double = 1.25

///|
const FOOT_SPREAD_POSE_WARN_RATIO : Double = 2.0

///|
const LEG_SPREAD_POSE_WARN_RATIO : Double = 2.0

///|
const SHOULDER_SCALE_MISMATCH_WARN_DELTA : Double = 0.4

///|
const ARM_REST_ANGLE_WARN_DEG : Double = 45.0

///|
const PROMOTION_MIN_COMPARED_SAMPLES : Int = 3

///|
const PROMOTION_MIN_IMPROVED_SAMPLES : Int = 2

///|
const ROBOT_VOXEL_WARN_SCORE : Double = 0.95

///|
const ROBOT_VOXEL_FAIL_SCORE : Double = 0.5

///|
const ROBOT_VOXEL_FAIL_PENALTY : Double = 2.0

///|
/// Return the arm-rest motion gate status used before running
/// `arm-rest-pose-offset`.
pub fn arm_rest_motion_gate_status(
  max_upper_arm_rotation_range_deg : Double?,
) -> String {
  match max_upper_arm_rotation_range_deg {
    None => "unavailable"
    Some(value) =>
      if value >= ARM_REST_MOTION_GATE_DEG {
        "passed"
      } else {
        "blocked"
      }
  }
}

///|
/// Return the normalization candidate status for `arm-rest-pose-offset`.
pub fn arm_rest_candidate_status(
  max_upper_arm_rotation_range_deg : Double?,
) -> String {
  match arm_rest_motion_gate_status(max_upper_arm_rotation_range_deg) {
    "passed" => "runnable"
    _ => "needs-motion-evidence"
  }
}

///|
/// Aggregate per-sample comparison decisions into a group-level
/// recommendation for a normalization candidate.
pub fn select_candidate_group(
  automatic : Bool,
  candidate_improved : Int,
  candidate_regressed : Int,
  candidate_tradeoff : Int,
  stable : Int,
  missing_comparison : Int,
  missing_sample_comparison : Int,
) -> String {
  let compared = candidate_improved + stable
  if missing_comparison > 0 || missing_sample_comparison > 0 {
    "missing-comparison"
  } else if candidate_regressed > 0 || candidate_tradeoff > 0 {
    "rejected"
  } else if candidate_improved > 0 && automatic {
    "accepted"
  } else if candidate_improved >= PROMOTION_MIN_IMPROVED_SAMPLES &&
    compared >= PROMOTION_MIN_COMPARED_SAMPLES {
    "promotable"
  } else if candidate_improved > 0 {
    "needs-policy"
  } else {
    "neutral"
  }
}

///|
/// Return the root translation normalization recommendation id.
pub fn root_translation_recommendation_id(
  mode : String,
  height_scale : Double?,
  height_scale_delta : Double?,
  vertical_delta_range : Double?,
) -> String {
  match height_scale {
    None => "height-scale-unavailable"
    Some(_) =>
      if mode == "scale-to-model" {
        "scale-to-model-active"
      } else if mode == "zero" {
        "root-motion-locked"
      } else if mode == "horizontal-only" {
        if optional_gte(
            vertical_delta_range,
            VERTICAL_ROOT_MOTION_SCALE_THRESHOLD,
          ) {
          "vertical-motion-dropped"
        } else {
          "horizontal-only-ok"
        }
      } else if mode == "keep" {
        if optional_gte(height_scale_delta, HEIGHT_SCALE_DELTA_THRESHOLD) {
          "source-space-kept"
        } else {
          "keep-ok"
        }
      } else if optional_gte(height_scale_delta, HEIGHT_SCALE_DELTA_THRESHOLD) &&
        optional_gte(vertical_delta_range, VERTICAL_ROOT_MOTION_SCALE_THRESHOLD) {
        "consider-scale-to-model"
      } else {
        "relative-ok"
      }
  }
}

///|
/// Return the runnable root translation candidate id for a recommendation.
/// "none" means the recommendation does not create a runnable candidate.
pub fn root_translation_candidate_id(recommendation_id : String) -> String {
  if recommendation_id == "consider-scale-to-model" {
    "root-scale-to-model"
  } else if recommendation_id == "vertical-motion-dropped" {
    "root-relative"
  } else {
    "none"
  }
}

///|
/// Return pipe-separated pose mismatch warning ids in stable report order.
pub fn pose_mismatch_warning_ids(
  scale_spread_ratio : Double?,
  foot_spread_scale : Double?,
  upper_leg_spread_scale : Double?,
  shoulder_width_scale : Double?,
  skeleton_height_scale : Double?,
  arm_angle_delta_deg : Double?,
) -> String {
  let ids = ""
  let ids = if optional_gte(scale_spread_ratio, CORE_SCALE_SPREAD_WARN_RATIO) {
    append_id(ids, "scale-inconsistent")
  } else {
    ids
  }
  let ids = if optional_outside_ratio(
      foot_spread_scale,
      FOOT_SPREAD_POSE_WARN_RATIO,
    ) {
    append_id(ids, "foot-spread-mismatch")
  } else {
    ids
  }
  let ids = if optional_outside_ratio(
      upper_leg_spread_scale,
      LEG_SPREAD_POSE_WARN_RATIO,
    ) {
    append_id(ids, "leg-spread-mismatch")
  } else {
    ids
  }
  let ids = if relative_scale_mismatch(
      shoulder_width_scale,
      skeleton_height_scale,
      SHOULDER_SCALE_MISMATCH_WARN_DELTA,
    ) {
    append_id(ids, "shoulder-width-mismatch")
  } else {
    ids
  }
  if optional_gte(arm_angle_delta_deg, ARM_REST_ANGLE_WARN_DEG) {
    append_id(ids, "arm-rest-angle-mismatch")
  } else {
    ids
  }
}

///|
/// Return pipe-separated `candidate-id:status` specs for pose normalization.
pub fn pose_normalization_candidate_specs(
  has_arm_rest_angle_mismatch : Bool,
  has_foot_spread_mismatch : Bool,
  has_leg_spread_mismatch : Bool,
  has_shoulder_width_mismatch : Bool,
  max_upper_arm_rotation_range_deg : Double?,
) -> String {
  let specs = ""
  let specs = if has_arm_rest_angle_mismatch {
    append_id(
      specs,
      "arm-rest-pose-offset:" +
      arm_rest_candidate_status(max_upper_arm_rotation_range_deg),
    )
  } else {
    specs
  }
  let specs = if has_foot_spread_mismatch || has_leg_spread_mismatch {
    append_id(specs, "stance-width-adapter:runnable")
  } else {
    specs
  }
  if has_shoulder_width_mismatch {
    append_id(specs, "shoulder-width-adapter:review-target-rig")
  } else {
    specs
  }
}

///|
/// Return the strict retarget retained-ratio verdict.
pub fn retarget_strict_verdict(
  track_count : Int,
  skipped : Int,
  min_retained_ratio_warn : Double,
) -> String {
  let total = track_count + skipped
  let retained_ratio = if total > 0 {
    track_count.to_double() / total.to_double()
  } else {
    0.0
  }
  if retained_ratio < min_retained_ratio_warn {
    "warn"
  } else {
    "pass"
  }
}

///|
/// Return the `robot-voxel` rule id for a normalized lowercase warning text.
pub fn robot_voxel_retarget_rule_id(normalized_text : String) -> String {
  if normalized_text.contains("thumb") ||
    normalized_text.contains("index") ||
    normalized_text.contains("middle") ||
    normalized_text.contains("ring") ||
    normalized_text.contains("little") ||
    normalized_text.contains("finger") {
    "finger"
  } else if normalized_text.contains("toe") {
    "toe"
  } else if normalized_text.contains("chest") ||
    normalized_text.contains("neck") ||
    normalized_text.contains("shoulder") {
    "upper-body-fallback"
  } else if normalized_text.contains("hips") ||
    normalized_text.contains("spine") ||
    normalized_text.contains("head") ||
    normalized_text.contains("upperarm") ||
    normalized_text.contains("lowerarm") ||
    normalized_text.contains("hand") ||
    normalized_text.contains("upperleg") ||
    normalized_text.contains("lowerleg") ||
    normalized_text.contains("foot") {
    "required-core"
  } else {
    "unexpected"
  }
}

///|
/// Return the weighted penalty for a `robot-voxel` retarget rule id.
pub fn robot_voxel_retarget_rule_penalty(rule_id : String) -> Double {
  if rule_id == "required-core" {
    2.0
  } else if rule_id == "unexpected" {
    0.5
  } else {
    0.0
  }
}

///|
/// Return whether a `robot-voxel` retarget rule is a hard failure.
pub fn robot_voxel_retarget_rule_hard_fail(rule_id : String) -> Bool {
  rule_id == "required-core"
}

///|
/// Return the rounded `robot-voxel` score for a weighted penalty.
pub fn robot_voxel_retarget_score(weighted_penalty : Double) -> Double {
  let ratio = weighted_penalty / ROBOT_VOXEL_FAIL_PENALTY
  let clipped = if ratio < 0.0 {
    0.0
  } else if ratio > 1.0 {
    1.0
  } else {
    ratio
  }
  round4(1.0 - clipped)
}

///|
/// Return the `robot-voxel` verdict for aggregate retarget penalties.
pub fn robot_voxel_retarget_verdict(
  weighted_penalty : Double,
  hard_failure_count : Int,
) -> String {
  let score = robot_voxel_retarget_score(weighted_penalty)
  if hard_failure_count > 0 || score < ROBOT_VOXEL_FAIL_SCORE {
    "fail"
  } else if score < ROBOT_VOXEL_WARN_SCORE {
    "warn"
  } else {
    "pass"
  }
}

///|
fn optional_gte(value : Double?, threshold : Double) -> Bool {
  match value {
    None => false
    Some(value) => value >= threshold
  }
}

///|
fn optional_outside_ratio(value : Double?, threshold : Double) -> Bool {
  match value {
    None => false
    Some(value) => value >= threshold || value <= 1.0 / threshold
  }
}

///|
fn relative_scale_mismatch(
  scale : Double?,
  reference_scale : Double?,
  threshold : Double,
) -> Bool {
  match (scale, reference_scale) {
    (Some(scale), Some(reference_scale)) =>
      if abs(reference_scale) <= 0.0001 {
        false
      } else {
        abs(scale / reference_scale - 1.0) >= threshold
      }
    _ => false
  }
}

///|
fn append_id(ids : String, id : String) -> String {
  if ids == "" {
    id
  } else {
    ids + "|" + id
  }
}

///|
fn round4(value : Double) -> Double {
  @math.floor(value * 10000.0 + 0.5) / 10000.0
}

///|
fn abs(value : Double) -> Double {
  if value < 0.0 {
    0.0 - value
  } else {
    value
  }
}
