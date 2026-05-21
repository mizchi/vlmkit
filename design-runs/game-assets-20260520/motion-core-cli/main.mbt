///|
fn main_err() -> Unit raise {
  let args = @cli_args.command_args(@env.args())
  match args {
    ["arm-rest-gate", value] =>
      println(@core.arm_rest_motion_gate_status(parse_optional_double(value)))
    ["arm-rest-candidate", value] =>
      println(@core.arm_rest_candidate_status(parse_optional_double(value)))
    [
      "select-candidate-group",
      automatic,
      improved,
      regressed,
      tradeoff,
      stable,
      missing,
      missing_sample,
    ] =>
      println(
        @core.select_candidate_group(
          parse_bool(automatic),
          parse_int(improved),
          parse_int(regressed),
          parse_int(tradeoff),
          parse_int(stable),
          parse_int(missing),
          parse_int(missing_sample),
        ),
      )
    [
      "root-translation-recommendation",
      mode,
      height_scale,
      height_scale_delta,
      vertical_delta_range,
    ] =>
      println(
        @core.root_translation_recommendation_id(
          mode,
          parse_optional_double(height_scale),
          parse_optional_double(height_scale_delta),
          parse_optional_double(vertical_delta_range),
        ),
      )
    ["root-translation-candidate", recommendation_id] =>
      println(@core.root_translation_candidate_id(recommendation_id))
    [
      "pose-mismatch-warning-ids",
      scale_spread_ratio,
      foot_spread_scale,
      upper_leg_spread_scale,
      shoulder_width_scale,
      skeleton_height_scale,
      arm_angle_delta_deg,
    ] =>
      println(
        @core.pose_mismatch_warning_ids(
          parse_optional_double(scale_spread_ratio),
          parse_optional_double(foot_spread_scale),
          parse_optional_double(upper_leg_spread_scale),
          parse_optional_double(shoulder_width_scale),
          parse_optional_double(skeleton_height_scale),
          parse_optional_double(arm_angle_delta_deg),
        ),
      )
    [
      "pose-normalization-candidate-specs",
      has_arm_rest_angle_mismatch,
      has_foot_spread_mismatch,
      has_leg_spread_mismatch,
      has_shoulder_width_mismatch,
      max_upper_arm_rotation_range_deg,
    ] =>
      println(
        @core.pose_normalization_candidate_specs(
          parse_bool(has_arm_rest_angle_mismatch),
          parse_bool(has_foot_spread_mismatch),
          parse_bool(has_leg_spread_mismatch),
          parse_bool(has_shoulder_width_mismatch),
          parse_optional_double(max_upper_arm_rotation_range_deg),
        ),
      )
    ["retarget-strict-verdict", track_count, skipped, threshold] =>
      println(
        @core.retarget_strict_verdict(
          parse_int(track_count),
          parse_int(skipped),
          parse_double(threshold),
        ),
      )
    ["robot-voxel-retarget-rule", normalized_text] =>
      println(@core.robot_voxel_retarget_rule_id(normalized_text))
    ["robot-voxel-retarget-score", weighted_penalty] =>
      println(@core.robot_voxel_retarget_score(parse_double(weighted_penalty)))
    ["robot-voxel-retarget-verdict", weighted_penalty, hard_failure_count] =>
      println(
        @core.robot_voxel_retarget_verdict(
          parse_double(weighted_penalty),
          parse_int(hard_failure_count),
        ),
      )
    _ => print_usage()
  }
}

///|
fn parse_optional_double(value : String) -> Double? raise {
  if value == "none" || value == "null" || value == "" {
    None
  } else {
    Some(parse_double(value))
  }
}

///|
fn parse_double(value : String) -> Double raise {
  let parsed : Double = @string.from_str(value)
  parsed
}

///|
fn parse_int(value : String) -> Int raise {
  let parsed : Int = @string.from_str(value)
  parsed
}

///|
fn parse_bool(value : String) -> Bool {
  value == "true" || value == "1" || value == "yes"
}

///|
fn print_usage() -> Unit {
  println(
    "Usage: motion-core-cli arm-rest-gate <deg|null> | arm-rest-candidate <deg|null> | select-candidate-group <automatic> <improved> <regressed> <tradeoff> <stable> <missing> <missing-sample> | root-translation-recommendation <mode> <height-scale|null> <height-scale-delta|null> <vertical-delta-range|null> | root-translation-candidate <recommendation-id> | pose-mismatch-warning-ids <scale-spread-ratio|null> <foot-spread-scale|null> <upper-leg-spread-scale|null> <shoulder-width-scale|null> <skeleton-height-scale|null> <arm-angle-delta-deg|null> | pose-normalization-candidate-specs <arm-rest?> <foot-spread?> <leg-spread?> <shoulder-width?> <upper-arm-rotation-range|null> | retarget-strict-verdict <track-count> <skipped> <threshold> | robot-voxel-retarget-rule <normalized-text> | robot-voxel-retarget-score <weighted-penalty> | robot-voxel-retarget-verdict <weighted-penalty> <hard-failure-count>",
  )
}

///|
fn main {
  main_err() catch {
    error => {
      println("motion-core-cli error: \{error}")
      panic()
    }
  }
}
