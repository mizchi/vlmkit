///|
test "component goal thresholds" {
  inspect(
    component_goal_status(
      "app",
      0.2257,
      0.0252,
      Some(0.03),
      Some(0.25),
      Some(0.05),
      Some(0.35),
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      false,
      false,
      false,
      false,
      false,
      0,
      false,
      false,
      None,
      None,
      0,
      false,
      0,
      0,
      false,
      0,
      false,
      false,
      false,
      0,
      None,
      None,
    ),
    content="pass",
  )
  inspect(
    component_goal_status(
      "app",
      0.31,
      0.041,
      Some(0.03),
      Some(0.25),
      Some(0.05),
      Some(0.35),
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      false,
      false,
      false,
      false,
      false,
      0,
      false,
      false,
      None,
      None,
      0,
      false,
      0,
      0,
      false,
      0,
      false,
      false,
      false,
      0,
      None,
      None,
    ),
    content="review",
  )
}

///|
test "component goal app shell gates" {
  inspect(
    component_goal_status(
      "app-shell",
      0.02,
      0.001,
      Some(0.03),
      None,
      Some(0.05),
      None,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      false,
      false,
      false,
      false,
      false,
      0,
      false,
      false,
      None,
      None,
      0,
      false,
      0,
      0,
      false,
      0,
      false,
      false,
      false,
      0,
      None,
      None,
    ),
    content="review",
  )
  inspect(
    component_goal_status(
      "app-shell",
      0.04,
      0.0014,
      Some(0.03),
      None,
      Some(0.05),
      None,
      3,
      1,
      0,
      0,
      0,
      0,
      0,
      false,
      false,
      false,
      false,
      false,
      0,
      false,
      false,
      None,
      None,
      0,
      false,
      0,
      0,
      false,
      0,
      false,
      false,
      false,
      0,
      None,
      None,
    ),
    content="fail",
  )
}

///|
test "component goal pattern gates" {
  inspect(
    component_goal_status(
      "landing",
      0.08,
      0.0112,
      Some(0.03),
      Some(0.30),
      Some(0.05),
      Some(0.40),
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      true,
      true,
      true,
      true,
      true,
      0,
      false,
      false,
      None,
      None,
      0,
      false,
      0,
      0,
      false,
      0,
      false,
      false,
      false,
      0,
      None,
      None,
    ),
    content="pass",
  )
  inspect(
    component_goal_status(
      "canvas",
      0.0095,
      0.0002,
      Some(0.06),
      Some(0.35),
      Some(0.08),
      Some(0.45),
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      false,
      false,
      false,
      false,
      false,
      1,
      true,
      true,
      Some(true),
      Some(true),
      3,
      false,
      0,
      0,
      false,
      0,
      false,
      false,
      false,
      0,
      None,
      None,
    ),
    content="fail",
  )
  inspect(
    component_goal_status(
      "expressive-menu",
      0.31,
      0.034,
      Some(0.05),
      None,
      Some(0.08),
      None,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      false,
      false,
      false,
      false,
      false,
      0,
      false,
      false,
      None,
      None,
      0,
      true,
      3,
      3,
      true,
      5,
      true,
      true,
      true,
      0,
      Some(true),
      Some(true),
    ),
    content="pass",
  )
}

///|
test "component contract probe state policy" {
  inspect(is_component_probe_state("hover"), content="true")
  inspect(is_component_probe_state("focus-visible"), content="true")
  inspect(is_component_probe_state("selected"), content="false")
  inspect(is_forced_pseudo_state("scrolled"), content="false")
  inspect(
    component_probe_states("hover|selected|focus-visible|hover|scrolled"),
    content="hover|focus-visible|scrolled",
  )
  inspect(
    merge_component_probe_states("hover|scrolled", "hover|focus-visible"),
    content="hover|scrolled|focus-visible",
  )
  inspect(merge_component_probe_states("", ""), content="")
}

///|
test "component contract scroll target source policy" {
  inspect(
    component_scroll_target_source("hover|scrolled", 1),
    content="state-targets",
  )
  inspect(
    component_scroll_target_source("hover|scrolled", 0),
    content="expected-scrollports",
  )
  inspect(
    component_scroll_target_source("hover|focus-visible", 0),
    content="none",
  )
}

///|
test "semantic drilldown flow and priority policy" {
  inspect(semantic_drilldown_flow(0.08), content="layout")
  inspect(semantic_drilldown_flow(0.079), content="decoration")
  inspect(semantic_drilldown_reason_id("layout", 0), content="coarse-landscape")
  inspect(semantic_drilldown_reason_id("decoration", 2), content="local-kinds")
  inspect(semantic_drilldown_reason_id("decoration", 0), content="local-pixel")
  inspect(
    semantic_drilldown_priority("layout", 0.1, 0.8) > 0.29,
    content="true",
  )
  inspect(
    semantic_drilldown_priority("decoration", 0.1, 0.8) > 0.82,
    content="true",
  )
}

///|
test "semantic drilldown selection prefers layout before decoration" {
  inspect(
    semantic_drilldown_select_index(
      ["decoration", "layout", "layout"],
      [0.9, 0.2, 0.2],
      [0, 2, 1],
    ),
    content="2",
  )
  inspect(
    semantic_drilldown_select_index(["decoration", "decoration"], [0.4, 0.5], [
      0, 1,
    ]),
    content="1",
  )
  inspect(semantic_drilldown_select_index([], [], []), content="-1")
}

///|
test "ui contract pattern evidence issue policy" {
  inspect(
    ui_contract_pattern_evidence_issue_ids(
      "landing", "primary-cta", "", "", 0, false, false, "",
    ),
    content="landing-marker-media-slot|landing-marker-next-section",
  )
  inspect(
    ui_contract_pattern_evidence_issue_ids(
      "app-shell", "", "selected", "", 0, false, false, "",
    ),
    content="app-shell-marker-scrollport|app-shell-expected-scrollports|app-shell-state-scrolled",
  )
  inspect(
    ui_contract_pattern_evidence_issue_ids(
      "canvas", "", "", "", 0, false, true, "mode|frame|score",
    ),
    content="canvas-state-field-playerX|canvas-state-field-playerY|canvas-state-field-assetsReady",
  )
  inspect(
    ui_contract_pattern_evidence_issue_ids(
      "expressive-menu", "selected", "selected", "selected", 0, false, false, "",
    ),
    content="expressive-menu-composition|expressive-menu-required-hover|expressive-menu-required-focus-visible",
  )
}

///|
test "ui contract layout issue policy" {
  inspect(
    ui_contract_layout_issue_ids(
      "fluid", false, false, 0, "scrollport", 0, 0, "grid", 0, 2,
    ),
    content="layout-width-fluid-bounds|layout-height-scrollport-max-positive|layout-grid-columns",
  )
  inspect(
    ui_contract_layout_issue_ids(
      "fixed", false, false, 0, "fixed", 0, 0, "grid", 2, 0,
    ),
    content="layout-width-fixed-positive|layout-height-fixed-positive|layout-grid-rows",
  )
  inspect(
    ui_contract_layout_issue_ids(
      "fluid", true, false, 0, "content", 0, 0, "subgrid", 0, 0,
    ),
    content="",
  )
}

///|
test "ui contract state and scrollport issue policy" {
  inspect(
    ui_contract_state_issue_ids("", "pressed", true, false, false),
    content="state-id-required|state-kind-unknown|state-target-required",
  )
  inspect(
    ui_contract_required_state_issue_ids(
      "dup", "hover", false, false, false, true, true, 2,
    ),
    content="required-state-id-unique|state-target-required|required-state-min-change-ratio",
  )
  inspect(
    ui_contract_expected_scrollport_issue_ids(
      "", "vertical", true, false, false, false, false, true, -1,
    ),
    content="expected-scrollport-id-required|expected-scrollport-axis-unknown|expected-scrollport-target-required|expected-scrollport-min-overflow",
  )
  inspect(
    ui_contract_expected_scrollport_issue_ids(
      "dup", "y", false, true, false, false, true, false, 0,
    ),
    content="expected-scrollport-id-unique",
  )
}

///|
test "ui contract marker issue policy" {
  inspect(
    ui_contract_marker_issue_ids("primary-cta", true, false, false, false),
    content="marker-target-required",
  )
  inspect(
    ui_contract_marker_issue_ids("unknown", false, false, false, false),
    content="marker-kind-unknown",
  )
  inspect(
    ui_contract_marker_issue_ids("scrollport", true, true, false, false),
    content="",
  )
}

///|
test "ui contract optional range issue policy" {
  inspect(
    ui_contract_optional_range_issue_ids(true, -1, true, -2),
    content="range-min-non-negative|range-max-non-negative|range-min-lte-max",
  )
  inspect(
    ui_contract_optional_range_issue_ids(true, 4, true, 2),
    content="range-min-lte-max",
  )
  inspect(ui_contract_optional_range_issue_ids(false, 0, true, 2), content="")
}

///|
test "ui contract metadata presence issue policy" {
  inspect(ui_contract_slot_issue_ids(""), content="slot-id-required")
  inspect(ui_contract_slot_issue_ids("hero"), content="")
  inspect(ui_contract_asset_issue_ids(""), content="asset-id-required")
  inspect(ui_contract_asset_issue_ids("hero-image"), content="")
  inspect(
    ui_contract_canvas_issue_ids(false, 2),
    content="canvas-state-hook-required",
  )
  inspect(ui_contract_canvas_issue_ids(false, 0), content="")
  inspect(
    ui_contract_canvas_input_issue_ids(""),
    content="canvas-input-action-required",
  )
  inspect(ui_contract_canvas_input_issue_ids("jump"), content="")
  inspect(
    ui_contract_canvas_hud_issue_ids(""),
    content="canvas-hud-id-required",
  )
  inspect(ui_contract_canvas_hud_issue_ids("score"), content="")
}
