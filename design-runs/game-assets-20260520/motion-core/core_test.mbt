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
  inspect(select_candidate_group(false, 1, 0, 0, 0, 0), content="needs-policy")
  inspect(select_candidate_group(true, 1, 0, 0, 0, 0), content="accepted")
  inspect(select_candidate_group(false, 0, 1, 0, 0, 0), content="rejected")
  inspect(select_candidate_group(false, 0, 0, 1, 0, 0), content="rejected")
  inspect(
    select_candidate_group(false, 0, 0, 0, 1, 0),
    content="missing-comparison",
  )
  inspect(
    select_candidate_group(false, 0, 0, 0, 0, 1),
    content="missing-comparison",
  )
  inspect(select_candidate_group(false, 0, 0, 0, 0, 0), content="neutral")
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
    content="arm-rest-pose-offset:runnable|stance-width-adapter:needs-implementation|shoulder-width-adapter:review-target-rig",
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
    content="stance-width-adapter:needs-implementation",
  )
  inspect(
    pose_normalization_candidate_specs(false, false, true, false, None),
    content="stance-width-adapter:needs-implementation",
  )
  inspect(
    pose_normalization_candidate_specs(false, false, false, false, None),
    content="",
  )
}
