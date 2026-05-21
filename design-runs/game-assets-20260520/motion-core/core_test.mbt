///|
test "arm rest motion gate" {
  inspect(arm_rest_motion_gate_status(None), content="unavailable")
  inspect(arm_rest_motion_gate_status(Some(14.48395)), content="blocked")
  inspect(arm_rest_motion_gate_status(Some(29.99228)), content="blocked")
  inspect(arm_rest_motion_gate_status(Some(60.0)), content="passed")
  inspect(arm_rest_motion_gate_status(Some(108.40739)), content="passed")
}

///|
test "arm rest candidate status" {
  inspect(arm_rest_candidate_status(None), content="needs-motion-evidence")
  inspect(
    arm_rest_candidate_status(Some(14.48395)),
    content="needs-motion-evidence",
  )
  inspect(arm_rest_candidate_status(Some(108.40739)), content="runnable")
}

///|
test "selection recommendation" {
  inspect(
    select_candidate_group(false, 1, 0, 0, 0, 0, 0),
    content="needs-policy",
  )
  inspect(select_candidate_group(true, 1, 0, 0, 0, 0, 0), content="accepted")
  inspect(select_candidate_group(false, 2, 0, 0, 1, 0, 0), content="promotable")
  inspect(select_candidate_group(false, 0, 1, 0, 0, 0, 0), content="rejected")
  inspect(select_candidate_group(false, 0, 0, 1, 0, 0, 0), content="rejected")
  inspect(
    select_candidate_group(false, 0, 0, 0, 0, 1, 0),
    content="missing-comparison",
  )
  inspect(
    select_candidate_group(false, 0, 0, 0, 0, 0, 1),
    content="missing-comparison",
  )
  inspect(select_candidate_group(false, 0, 0, 0, 2, 0, 0), content="neutral")
}

///|
test "root translation recommendation" {
  inspect(
    root_translation_recommendation_id("relative", None, Some(0.3), Some(0.2)),
    content="height-scale-unavailable",
  )
  inspect(
    root_translation_recommendation_id(
      "scale-to-model",
      Some(0.6),
      Some(0.4),
      Some(0.2),
    ),
    content="scale-to-model-active",
  )
  inspect(
    root_translation_recommendation_id("zero", Some(0.6), Some(0.4), Some(0.2)),
    content="root-motion-locked",
  )
  inspect(
    root_translation_recommendation_id(
      "horizontal-only",
      Some(0.6),
      Some(0.4),
      Some(0.08),
    ),
    content="vertical-motion-dropped",
  )
  inspect(
    root_translation_recommendation_id(
      "horizontal-only",
      Some(0.6),
      Some(0.4),
      Some(0.079),
    ),
    content="horizontal-only-ok",
  )
  inspect(
    root_translation_recommendation_id("keep", Some(0.6), Some(0.2), Some(0.0)),
    content="source-space-kept",
  )
  inspect(
    root_translation_recommendation_id(
      "keep",
      Some(0.6),
      Some(0.199),
      Some(0.0),
    ),
    content="keep-ok",
  )
  inspect(
    root_translation_recommendation_id(
      "relative",
      Some(0.6),
      Some(0.2),
      Some(0.08),
    ),
    content="consider-scale-to-model",
  )
  inspect(
    root_translation_recommendation_id(
      "relative",
      Some(0.6),
      Some(0.2),
      Some(0.079),
    ),
    content="relative-ok",
  )
}

///|
test "root translation candidate id" {
  inspect(
    root_translation_candidate_id("consider-scale-to-model"),
    content="root-scale-to-model",
  )
  inspect(
    root_translation_candidate_id("vertical-motion-dropped"),
    content="root-relative",
  )
  inspect(root_translation_candidate_id("relative-ok"), content="none")
  inspect(
    root_translation_candidate_id("height-scale-unavailable"),
    content="none",
  )
}

///|
test "pose mismatch warning ids" {
  inspect(
    pose_mismatch_warning_ids(
      Some(1.25),
      Some(2.0),
      Some(0.5),
      Some(1.6),
      Some(1.0),
      Some(45.0),
    ),
    content="scale-inconsistent|foot-spread-mismatch|leg-spread-mismatch|shoulder-width-mismatch|arm-rest-angle-mismatch",
  )
  inspect(
    pose_mismatch_warning_ids(
      Some(1.249),
      Some(1.999),
      Some(0.501),
      Some(1.39),
      Some(1.0),
      Some(44.9),
    ),
    content="",
  )
  inspect(
    pose_mismatch_warning_ids(None, None, None, Some(1.6), None, None),
    content="",
  )
}

///|
test "pose normalization candidate specs" {
  inspect(
    pose_normalization_candidate_specs(true, true, true, true, Some(108.40739)),
    content="arm-rest-pose-offset:runnable|stance-width-adapter:runnable|shoulder-width-adapter:review-target-rig",
  )
  inspect(
    pose_normalization_candidate_specs(
      true,
      false,
      false,
      false,
      Some(14.48395),
    ),
    content="arm-rest-pose-offset:needs-motion-evidence",
  )
  inspect(
    pose_normalization_candidate_specs(false, true, false, false, None),
    content="stance-width-adapter:runnable",
  )
  inspect(
    pose_normalization_candidate_specs(false, false, true, false, None),
    content="stance-width-adapter:runnable",
  )
  inspect(
    pose_normalization_candidate_specs(false, false, false, false, None),
    content="",
  )
}

///|
test "retarget strict verdict" {
  inspect(retarget_strict_verdict(6, 4, 0.4), content="pass")
  inspect(retarget_strict_verdict(2, 4, 0.4), content="warn")
  inspect(retarget_strict_verdict(0, 0, 0.4), content="warn")
}

///|
test "robot voxel retarget rule ids" {
  inspect(
    robot_voxel_retarget_rule_id("leftthumbproximal skipped"),
    content="finger",
  )
  inspect(robot_voxel_retarget_rule_id("right toe skipped"), content="toe")
  inspect(
    robot_voxel_retarget_rule_id("chest fallback"),
    content="upper-body-fallback",
  )
  inspect(
    robot_voxel_retarget_rule_id("neck fallback"),
    content="upper-body-fallback",
  )
  inspect(
    robot_voxel_retarget_rule_id("left shoulder fallback"),
    content="upper-body-fallback",
  )
  inspect(robot_voxel_retarget_rule_id("hips skipped"), content="required-core")
  inspect(robot_voxel_retarget_rule_id("head skipped"), content="required-core")
  inspect(
    robot_voxel_retarget_rule_id("left upperarm skipped"),
    content="required-core",
  )
  inspect(
    robot_voxel_retarget_rule_id("right hand skipped"),
    content="required-core",
  )
  inspect(robot_voxel_retarget_rule_id("antenna skipped"), content="unexpected")
}

///|
test "robot voxel retarget score and verdict" {
  inspect(robot_voxel_retarget_rule_penalty("finger"), content="0")
  inspect(robot_voxel_retarget_rule_penalty("unexpected"), content="0.5")
  inspect(robot_voxel_retarget_rule_penalty("required-core"), content="2")
  inspect(robot_voxel_retarget_rule_hard_fail("required-core"), content="true")
  inspect(robot_voxel_retarget_rule_hard_fail("unexpected"), content="false")
  inspect(robot_voxel_retarget_score(0.0), content="1")
  inspect(robot_voxel_retarget_score(0.5), content="0.75")
  inspect(robot_voxel_retarget_score(1.5), content="0.25")
  inspect(robot_voxel_retarget_verdict(0.0, 0), content="pass")
  inspect(robot_voxel_retarget_verdict(0.5, 0), content="warn")
  inspect(robot_voxel_retarget_verdict(1.5, 0), content="fail")
  inspect(robot_voxel_retarget_verdict(0.0, 1), content="fail")
}

///|
test "quality comparison policy" {
  inspect(quality_verdict_score("pass"), content="3")
  inspect(quality_verdict_score("warn"), content="2")
  inspect(quality_verdict_score("fail"), content="1")
  inspect(quality_verdict_score("unknown"), content="0")
  inspect(
    quality_compare_metric_status(Some(1.0), Some(0.98), 0.01, "lower"),
    content="improved",
  )
  inspect(
    quality_compare_metric_status(Some(1.0), Some(1.02), 0.01, "lower"),
    content="regressed",
  )
  inspect(
    quality_compare_metric_status(Some(1.0), Some(1.005), 0.01, "lower"),
    content="stable",
  )
  inspect(
    quality_compare_metric_status(Some(2.0), Some(3.0), 0.0, "higher"),
    content="improved",
  )
  inspect(
    quality_compare_metric_status(Some(2.0), Some(1.0), 0.0, "higher"),
    content="regressed",
  )
  inspect(
    quality_compare_metric_status(None, Some(1.0), 0.0, "higher"),
    content="missing",
  )
  inspect(quality_comparison_decision(1, 0), content="candidate-improved")
  inspect(quality_comparison_decision(0, 1), content="candidate-regressed")
  inspect(quality_comparison_decision(1, 1), content="candidate-tradeoff")
  inspect(quality_comparison_decision(0, 0), content="stable")
}

///|
test "motion quality gate policy" {
  inspect(quality_summary_verdict(0, 0), content="pass")
  inspect(quality_summary_verdict(0, 1), content="warn")
  inspect(quality_summary_verdict(1, 0), content="fail")
  inspect(quality_render_verify_verdict(false, false), content="warn")
  inspect(quality_render_verify_verdict(true, false), content="fail")
  inspect(quality_render_verify_verdict(true, true), content="pass")
  inspect(quality_foreground_verdict(0.02, 0.03), content="fail")
  inspect(quality_foreground_verdict(0.03, 0.03), content="pass")
  inspect(quality_screen_coverage_min_verdict(0.014, 0.015), content="warn")
  inspect(quality_screen_coverage_min_verdict(0.015, 0.015), content="pass")
  inspect(quality_screen_coverage_max_verdict(0.76, 0.75), content="warn")
  inspect(quality_screen_coverage_max_verdict(0.75, 0.75), content="pass")
  inspect(quality_jump_verdict(0.181, 0.18), content="warn")
  inspect(quality_jump_verdict(0.18, 0.18), content="pass")
  inspect(quality_ground_verdict(None, -0.35, -2.5), content="warn")
  inspect(quality_ground_verdict(Some(-2.6), -0.35, -2.5), content="fail")
  inspect(quality_ground_verdict(Some(-0.36), -0.35, -2.5), content="warn")
  inspect(quality_ground_verdict(Some(-0.35), -0.35, -2.5), content="pass")
  inspect(quality_foot_contact_verdict(0, 0.0, -0.25, 0.65), content="warn")
  inspect(quality_foot_contact_verdict(2, -0.26, -0.25, 0.65), content="warn")
  inspect(quality_foot_contact_verdict(2, 0.66, -0.25, 0.65), content="warn")
  inspect(quality_foot_contact_verdict(2, 0.0, -0.25, 0.65), content="pass")
  inspect(quality_limb_extent_verdict(0, 0.0, 0.0, 0.45, 1.35), content="warn")
  inspect(quality_limb_extent_verdict(2, 0.46, 0.5, 0.45, 1.35), content="warn")
  inspect(quality_limb_extent_verdict(2, 0.2, 1.36, 0.45, 1.35), content="warn")
  inspect(quality_limb_extent_verdict(2, 0.2, 1.35, 0.45, 1.35), content="pass")
  inspect(quality_loop_metadata_verdict(1), content="warn")
  inspect(quality_loop_metadata_verdict(0), content="pass")
}

///|
test "kagura runtime outcome policy" {
  inspect(kagura_runtime_outcome_status(true, None), content="pass")
  inspect(
    kagura_runtime_outcome_status(false, Some(false)),
    content="environment-failed",
  )
  inspect(
    kagura_runtime_outcome_status(false, Some(true)),
    content="asset-failed",
  )
  inspect(kagura_runtime_outcome_status(false, None), content="target-failed")
  inspect(kagura_runtime_should_fail("pass", false), content="false")
  inspect(
    kagura_runtime_should_fail("environment-failed", true),
    content="false",
  )
  inspect(
    kagura_runtime_should_fail("environment-failed", false),
    content="true",
  )
  inspect(kagura_runtime_should_fail("asset-failed", true), content="true")
}
