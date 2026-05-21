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
    ["quality-verdict-score", verdict] =>
      println(@core.quality_verdict_score(verdict))
    ["quality-compare-metric-status", baseline, candidate, tolerance, better] =>
      println(
        @core.quality_compare_metric_status(
          parse_optional_double(baseline),
          parse_optional_double(candidate),
          parse_double(tolerance),
          better,
        ),
      )
    ["quality-comparison-decision", improved, regressed] =>
      println(
        @core.quality_comparison_decision(
          parse_int(improved),
          parse_int(regressed),
        ),
      )
    ["quality-summary-verdict", fail_count, warn_count] =>
      println(
        @core.quality_summary_verdict(
          parse_int(fail_count),
          parse_int(warn_count),
        ),
      )
    ["quality-render-verify-verdict", has_report, ok] =>
      println(
        @core.quality_render_verify_verdict(
          parse_bool(has_report),
          parse_bool(ok),
        ),
      )
    ["quality-foreground-verdict", min_foreground, threshold] =>
      println(
        @core.quality_foreground_verdict(
          parse_double(min_foreground),
          parse_double(threshold),
        ),
      )
    ["quality-screen-coverage-min-verdict", min_coverage, threshold] =>
      println(
        @core.quality_screen_coverage_min_verdict(
          parse_double(min_coverage),
          parse_double(threshold),
        ),
      )
    ["quality-screen-coverage-max-verdict", max_coverage, threshold] =>
      println(
        @core.quality_screen_coverage_max_verdict(
          parse_double(max_coverage),
          parse_double(threshold),
        ),
      )
    ["quality-jump-verdict", value, threshold] =>
      println(
        @core.quality_jump_verdict(parse_double(value), parse_double(threshold)),
      )
    ["quality-ground-verdict", min_ground, warn_threshold, fail_threshold] =>
      println(
        @core.quality_ground_verdict(
          parse_optional_double(min_ground),
          parse_double(warn_threshold),
          parse_double(fail_threshold),
        ),
      )
    [
      "quality-foot-contact-verdict",
      contact_count,
      min_foot_delta_y,
      sink_warn_threshold,
      always_floating_warn_threshold,
    ] =>
      println(
        @core.quality_foot_contact_verdict(
          parse_int(contact_count),
          parse_double(min_foot_delta_y),
          parse_double(sink_warn_threshold),
          parse_double(always_floating_warn_threshold),
        ),
      )
    [
      "quality-limb-extent-verdict",
      displacement_count,
      pelvis,
      max_tracked_node,
      max_pelvis_warn,
      max_tracked_node_warn,
    ] =>
      println(
        @core.quality_limb_extent_verdict(
          parse_int(displacement_count),
          parse_double(pelvis),
          parse_double(max_tracked_node),
          parse_double(max_pelvis_warn),
          parse_double(max_tracked_node_warn),
        ),
      )
    ["quality-loop-metadata-verdict", missing_count] =>
      println(@core.quality_loop_metadata_verdict(parse_int(missing_count)))
    ["kagura-runtime-outcome-status", target_ok, calibration_ok] =>
      println(
        @core.kagura_runtime_outcome_status(
          parse_bool(target_ok),
          parse_optional_bool(calibration_ok),
        ),
      )
    ["kagura-runtime-should-fail", outcome_status, allow_environment_failure] =>
      println(
        @core.kagura_runtime_should_fail(
          outcome_status,
          parse_bool(allow_environment_failure),
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
fn parse_optional_bool(value : String) -> Bool? {
  if value == "none" || value == "null" || value == "" {
    None
  } else {
    Some(parse_bool(value))
  }
}

///|
fn print_usage() -> Unit {
  println(
    "Usage: motion-core-cli arm-rest-gate <deg|null> | arm-rest-candidate <deg|null> | select-candidate-group <automatic> <improved> <regressed> <tradeoff> <stable> <missing> <missing-sample> | root-translation-recommendation <mode> <height-scale|null> <height-scale-delta|null> <vertical-delta-range|null> | root-translation-candidate <recommendation-id> | pose-mismatch-warning-ids <scale-spread-ratio|null> <foot-spread-scale|null> <upper-leg-spread-scale|null> <shoulder-width-scale|null> <skeleton-height-scale|null> <arm-angle-delta-deg|null> | pose-normalization-candidate-specs <arm-rest?> <foot-spread?> <leg-spread?> <shoulder-width?> <upper-arm-rotation-range|null> | retarget-strict-verdict <track-count> <skipped> <threshold> | robot-voxel-retarget-rule <normalized-text> | robot-voxel-retarget-score <weighted-penalty> | robot-voxel-retarget-verdict <weighted-penalty> <hard-failure-count> | quality-verdict-score <verdict> | quality-compare-metric-status <baseline|null> <candidate|null> <tolerance> <lower|higher> | quality-comparison-decision <improved> <regressed> | quality-summary-verdict <fail-count> <warn-count> | quality-render-verify-verdict <has-report> <ok> | quality-foreground-verdict <min> <threshold> | quality-screen-coverage-min-verdict <min> <threshold> | quality-screen-coverage-max-verdict <max> <threshold> | quality-jump-verdict <value> <threshold> | quality-ground-verdict <min|null> <warn-threshold> <fail-threshold> | quality-foot-contact-verdict <count> <min-foot-delta-y> <sink-warn> <floating-warn> | quality-limb-extent-verdict <count> <pelvis> <max-tracked-node> <max-pelvis-warn> <max-tracked-node-warn> | quality-loop-metadata-verdict <missing-count> | kagura-runtime-outcome-status <target-ok> <calibration-ok|null> | kagura-runtime-should-fail <outcome-status> <allow-environment-failure>",
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
