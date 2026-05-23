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
test "ui contract boundary issue policy" {
  inspect(
    ui_contract_version_issue_ids(2),
    content="contract-version-unsupported",
  )
  inspect(ui_contract_version_issue_ids(1), content="")
  inspect(
    ui_contract_screen_issue_ids("", "poster", "site", "unknown"),
    content="screen-id-required|screen-pattern-unknown|screen-goal-unknown|screen-source-of-truth-unknown",
  )
  inspect(
    ui_contract_screen_issue_ids("home", "landing", "app", "landmarks"),
    content="",
  )
  inspect(
    ui_contract_viewport_issue_ids("", true, 0, -1, true, 0),
    content="viewport-label-required|viewport-label-unique|viewport-size-positive|viewport-dpr-positive",
  )
  inspect(
    ui_contract_viewport_issue_ids("desktop", false, 1440, 900, false, 0),
    content="",
  )
  inspect(
    ui_contract_landmark_issue_ids("", "landmark", "", false, true),
    content="landmark-abstract-role|landmark-id-required",
  )
  inspect(
    ui_contract_landmark_issue_ids("filters", "region", "", true, false),
    content="landmark-name-required|landmark-parent-unknown",
  )
  inspect(
    ui_contract_responsive_rule_issue_ids(false),
    content="responsive-rule-viewport-unknown",
  )
  inspect(ui_contract_responsive_rule_issue_ids(true), content="")
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

///|
test "ui contract composition issue policy" {
  inspect(
    ui_contract_composition_issue_ids("zigzag"),
    content="composition-style-unknown",
  )
  inspect(ui_contract_composition_axis_issue_ids("diagonal"), content="")
  inspect(
    ui_contract_composition_axis_issue_ids("sideways"),
    content="composition-axis-unknown",
  )
  inspect(
    ui_contract_composition_layer_issue_ids("", "backdrop", false, true, false),
    content="composition-layer-id-required|composition-layer-role-unknown|composition-layer-z-finite",
  )
  inspect(
    ui_contract_composition_layer_issue_ids("dup", "content", true, false, true),
    content="composition-layer-id-unique",
  )
  inspect(
    ui_contract_composition_shape_issue_ids("", "triangle", false),
    content="composition-shape-id-required|composition-shape-kind-unknown",
  )
  inspect(
    ui_contract_composition_motion_issue_ids(
      "", "tap", "wiggle", false, true, -1,
    ),
    content="motion-id-required|motion-trigger-unknown|motion-effect-unknown|motion-duration-non-negative",
  )
  inspect(
    ui_contract_composition_contrast_issue_ids("extreme", true, 0),
    content="contrast-mode-unknown|contrast-min-ratio-positive",
  )
}

///|
test "ui contract decoration issue policy" {
  inspect(
    ui_contract_decoration_typography_issue_ids("", true, 0, true, -1),
    content="typography-role-required|typography-size-positive|typography-line-height-positive",
  )
  inspect(
    ui_contract_decoration_typography_issue_ids("body", false, 0, false, 0),
    content="",
  )
  inspect(
    ui_contract_decoration_palette_issue_ids("", "red"),
    content="palette-role-required|palette-value-hex",
  )
  inspect(
    ui_contract_decoration_palette_issue_ids("surface", "#abc"),
    content="",
  )
  inspect(
    ui_contract_decoration_palette_issue_ids("accent", "#aabbcc"),
    content="",
  )
  inspect(
    ui_contract_decoration_media_issue_ids(""),
    content="media-slot-required",
  )
  inspect(ui_contract_decoration_media_issue_ids("hero"), content="")
}

///|
test "ui contract remaining scalar issue policy" {
  inspect(
    ui_contract_content_items_issue_ids(true, -1),
    content="content-items-exact-non-negative",
  )
  inspect(ui_contract_content_items_issue_ids(false, 0), content="")
  inspect(
    ui_contract_content_text_issue_ids(true, -1),
    content="content-text-row-count-non-negative",
  )
  inspect(ui_contract_content_text_issue_ids(false, 0), content="")
  inspect(
    ui_contract_composition_contrast_palette_issue_ids("red"),
    content="contrast-palette-value-hex",
  )
  inspect(
    ui_contract_composition_contrast_palette_issue_ids("#abc"),
    content="",
  )
}

///|
test "landscape default grid for wide canvas" {
  inspect(landscape_default_grid_cols(320, 200), content="16")
  inspect(landscape_default_grid_rows(320, 200), content="10")
}

///|
test "landscape default grid for tall canvas" {
  inspect(landscape_default_grid_cols(200, 320), content="10")
  inspect(landscape_default_grid_rows(200, 320), content="16")
}

///|
test "landscape default grid clamps short side to 8" {
  inspect(landscape_default_grid_rows(1000, 100), content="8")
  inspect(landscape_default_grid_cols(100, 1000), content="8")
}

///|
test "landscape default grid handles non-positive sizes" {
  inspect(landscape_default_grid_cols(0, 100), content="0")
  inspect(landscape_default_grid_rows(100, 0), content="0")
}

///|
test "landscape clamp byte" {
  inspect(landscape_clamp_byte(-1.0), content="0")
  inspect(landscape_clamp_byte(0.4), content="0")
  inspect(landscape_clamp_byte(0.6), content="1")
  inspect(landscape_clamp_byte(123.5), content="124")
  inspect(landscape_clamp_byte(255.9), content="255")
  inspect(landscape_clamp_byte(999.0), content="255")
}

///|
test "landscape cell score returns zero for identical stats" {
  let s = landscape_cell_score(10, 20, 30, 25, 0.5, 10, 20, 30, 25, 0.5)
  inspect(s, content="0")
}

///|
test "landscape cell score caps at 1" {
  let s = landscape_cell_score(0, 0, 0, 0, 0, 255, 255, 255, 255, 1.0)
  inspect(s, content="1")
}

///|
test "landscape cell hex pads channels" {
  inspect(landscape_cell_hex(0, 0, 0), content="#000000")
  inspect(landscape_cell_hex(255, 255, 255), content="#ffffff")
  inspect(landscape_cell_hex(18, 52, 171), content="#1234ab")
}

///|
test "landscape diff summary detects no change" {
  let stats = "10,20,30,22,0.1|40,50,60,49,0.2"
  let summary = landscape_diff_summary(2, 1, 0.08, 4, stats, stats)
  inspect(summary, content="0|1|0|2|0:0|1:0")
}

///|
test "landscape diff summary degenerate grid" {
  let summary = landscape_diff_summary(0, 0, 0.08, 4, "", "")
  inspect(summary, content="1|0|0|0")
}

///|
test "grid_gcd basic" {
  inspect(grid_gcd(12, 8), content="4")
  inspect(grid_gcd(800, 200), content="200")
  inspect(grid_gcd(0, 5), content="5")
  inspect(grid_gcd(-12, 8), content="4")
}

///|
test "grid_all_equal honors tolerance" {
  inspect(grid_all_equal("200,200,200", 0.0), content="true")
  inspect(grid_all_equal("200,201,200", 0.5), content="false")
  inspect(grid_all_equal("200,201,200", 2.0), content="true")
  inspect(grid_all_equal("", 0.0), content="true")
  inspect(grid_all_equal("500", 0.0), content="true")
}

///|
test "grid_arrays_close compares length and per-element delta" {
  inspect(grid_arrays_close("100,200", "101,199", 2.0), content="true")
  inspect(grid_arrays_close("100,200", "104,199", 2.0), content="false")
  inspect(grid_arrays_close("100,200", "100", 0.0), content="false")
  inspect(grid_arrays_close("", "", 0.0), content="true")
}

///|
test "grid_ratios_to_decimal divides by smallest with 3-dp formatting" {
  inspect(grid_ratios_to_decimal("393,298"), content="1.319 : 1.000")
  inspect(grid_ratios_to_decimal("800,200"), content="4.000 : 1.000")
  inspect(grid_ratios_to_decimal("343,343"), content="1.000 : 1.000")
  inspect(grid_ratios_to_decimal(""), content="")
}

///|
test "grid_approximate_integer_fr returns clean integer form when one fits" {
  inspect(grid_approximate_integer_fr("800,200", 12), content="4fr 1fr")
  inspect(grid_approximate_integer_fr("600,400", 12), content="3fr 2fr")
  inspect(grid_approximate_integer_fr("250,250,500", 12), content="1fr 1fr 2fr")
}

///|
test "grid_approximate_integer_fr falls back when no <1% denom fits" {
  // 1.319 has no <1% denominator within [1,2]. Force a tighter cap
  // so the search exits without a candidate.
  inspect(grid_approximate_integer_fr("393,298", 2), content="")
}

///|
test "grid_approximate_integer_fr handles degenerate input" {
  inspect(grid_approximate_integer_fr("", 12), content="")
  inspect(grid_approximate_integer_fr("0,200", 12), content="")
}

///|
test "shift_round_delta keeps 2 decimal places" {
  inspect(shift_round_delta(1.234), content="1.23")
  inspect(shift_round_delta(1.235), content="1.24")
  // JS `Math.round(-1.235 * 100) / 100` returns -1.24 because the IEEE-754
  // product is -123.50000000000001; MoonBit matches that behavior.
  inspect(shift_round_delta(-1.235), content="-1.24")
  inspect(shift_round_delta(0.0), content="0")
  inspect(shift_round_delta(100.0), content="100")
}

///|
test "shift_classify_suspect picks height first, then top" {
  inspect(shift_classify_suspect(10.0, 0.0), content="height")
  inspect(shift_classify_suspect(0.0, 12.0), content="margin/padding-above")
  inspect(shift_classify_suspect(2.0, 2.0), content="y-position")
  inspect(shift_classify_suspect(5.0, 100.0), content="height")
  inspect(shift_classify_suspect(4.99, 5.0), content="margin/padding-above")
}
