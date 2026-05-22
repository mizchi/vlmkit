///|
pub fn component_goal_status(
  goal : String,
  pixel_diff_ratio : Double,
  landscape_diff_ratio : Double,
  pass_landscape : Double?,
  pass_pixel : Double?,
  review_landscape : Double?,
  review_pixel : Double?,
  scroll_total : Int,
  scroll_broken : Int,
  scroll_empty : Int,
  expected_total : Int,
  expected_missing : Int,
  expected_broken : Int,
  expected_empty : Int,
  landing_present : Bool,
  landing_hero_visible : Bool,
  landing_primary_cta_visible : Bool,
  landing_next_section_hint_visible : Bool,
  landing_media_slot_visible : Bool,
  canvas_count : Int,
  canvas_nonblank : Bool,
  canvas_frame_delta : Bool,
  canvas_input_responsive : Bool?,
  canvas_state_hook_present : Bool?,
  canvas_missing_state_fields : Int,
  expressive_present : Bool,
  expressive_layers : Int,
  expressive_shapes : Int,
  expressive_selected_visible : Bool,
  expressive_focusable_item_count : Int,
  expressive_semantic_menu_text : Bool,
  expressive_diagonal_evidence : Bool,
  expressive_high_contrast : Bool,
  expressive_low_contrast_item_count : Int,
  expressive_hover_changed : Bool?,
  expressive_focus_visible_changed : Bool?,
) -> String {
  let status = threshold_status(
    pixel_diff_ratio, landscape_diff_ratio, pass_landscape, pass_pixel, review_landscape,
    review_pixel,
  )
  if goal == "app-shell" {
    app_shell_status(
      status, scroll_total, scroll_broken, scroll_empty, expected_total, expected_missing,
      expected_broken, expected_empty,
    )
  } else if goal == "landing" {
    landing_status(
      status, landing_present, landing_hero_visible, landing_primary_cta_visible,
      landing_next_section_hint_visible, landing_media_slot_visible,
    )
  } else if goal == "canvas" {
    canvas_status(
      status, canvas_count, canvas_nonblank, canvas_frame_delta, canvas_input_responsive,
      canvas_state_hook_present, canvas_missing_state_fields,
    )
  } else if goal == "expressive-menu" {
    expressive_menu_status(
      status, expressive_present, expressive_layers, expressive_shapes, expressive_selected_visible,
      expressive_focusable_item_count, expressive_semantic_menu_text, expressive_diagonal_evidence,
      expressive_high_contrast, expressive_low_contrast_item_count, expressive_hover_changed,
      expressive_focus_visible_changed,
    )
  } else {
    status
  }
}

///|
fn threshold_status(
  pixel_diff_ratio : Double,
  landscape_diff_ratio : Double,
  pass_landscape : Double?,
  pass_pixel : Double?,
  review_landscape : Double?,
  review_pixel : Double?,
) -> String {
  if passes_all(
      pixel_diff_ratio, landscape_diff_ratio, pass_landscape, pass_pixel,
    ) {
    "pass"
  } else if passes_all(
      pixel_diff_ratio, landscape_diff_ratio, review_landscape, review_pixel,
    ) {
    "review"
  } else {
    "fail"
  }
}

///|
fn passes_all(
  pixel_diff_ratio : Double,
  landscape_diff_ratio : Double,
  landscape_limit : Double?,
  pixel_limit : Double?,
) -> Bool {
  optional_lte(landscape_diff_ratio, landscape_limit) &&
  optional_lte(pixel_diff_ratio, pixel_limit)
}

///|
fn optional_lte(value : Double, limit : Double?) -> Bool {
  match limit {
    None => true
    Some(max) => value <= max
  }
}

///|
fn review_if_pass(status : String) -> String {
  if status == "pass" {
    "review"
  } else {
    status
  }
}

///|
fn app_shell_status(
  status : String,
  scroll_total : Int,
  scroll_broken : Int,
  scroll_empty : Int,
  expected_total : Int,
  expected_missing : Int,
  expected_broken : Int,
  expected_empty : Int,
) -> String {
  if expected_total > 0 {
    if expected_missing > 0 || expected_broken > 0 {
      "fail"
    } else if expected_empty > 0 {
      review_if_pass(status)
    } else {
      status
    }
  } else if scroll_total == 0 {
    review_if_pass(status)
  } else if scroll_broken > 0 {
    "fail"
  } else if scroll_empty > 0 {
    review_if_pass(status)
  } else {
    status
  }
}

///|
fn landing_status(
  status : String,
  present : Bool,
  hero_visible : Bool,
  primary_cta_visible : Bool,
  next_section_hint_visible : Bool,
  media_slot_visible : Bool,
) -> String {
  if !present {
    review_if_pass(status)
  } else if !primary_cta_visible || !hero_visible {
    "fail"
  } else if !next_section_hint_visible || !media_slot_visible {
    review_if_pass(status)
  } else {
    status
  }
}

///|
fn canvas_status(
  status : String,
  canvas_count : Int,
  nonblank : Bool,
  frame_delta : Bool,
  input_responsive : Bool?,
  state_hook_present : Bool?,
  missing_state_fields : Int,
) -> String {
  if canvas_count == 0 || !nonblank {
    "fail"
  } else if state_hook_present == Some(false) || missing_state_fields > 0 {
    "fail"
  } else if !frame_delta || input_responsive != Some(true) {
    review_if_pass(status)
  } else {
    status
  }
}

///|
fn expressive_menu_status(
  status : String,
  present : Bool,
  layers : Int,
  shapes : Int,
  selected_visible : Bool,
  focusable_item_count : Int,
  semantic_menu_text : Bool,
  diagonal_evidence : Bool,
  high_contrast : Bool,
  low_contrast_item_count : Int,
  hover_changed : Bool?,
  focus_visible_changed : Bool?,
) -> String {
  if !present {
    review_if_pass(status)
  } else if !selected_visible ||
    focusable_item_count < 3 ||
    !semantic_menu_text ||
    layers < 2 ||
    shapes < 2 ||
    !diagonal_evidence ||
    !high_contrast ||
    low_contrast_item_count > 0 ||
    hover_changed == Some(false) ||
    focus_visible_changed == Some(false) {
    "fail"
  } else if hover_changed == None || focus_visible_changed == None {
    review_if_pass(status)
  } else {
    status
  }
}

///|
pub fn is_forced_pseudo_state(value : String) -> Bool {
  value == "hover" ||
  value == "focus" ||
  value == "active" ||
  value == "focus-visible"
}

///|
pub fn is_component_probe_state(value : String) -> Bool {
  value == "scrolled" || is_forced_pseudo_state(value)
}

///|
pub fn component_probe_states(required_state_kinds : String) -> String {
  let states : Array[String] = []
  for state in split_list(required_state_kinds) {
    push_unique_component_probe_state(states, state)
  }
  states.join("|")
}

///|
pub fn merge_component_probe_states(
  explicit_states : String,
  injected_states : String,
) -> String {
  let states : Array[String] = []
  for state in split_list(explicit_states) {
    push_unique_component_probe_state(states, state)
  }
  for state in split_list(injected_states) {
    push_unique_component_probe_state(states, state)
  }
  states.join("|")
}

///|
pub fn component_scroll_target_source(
  required_state_kinds : String,
  explicit_scrolled_target_count : Int,
) -> String {
  if explicit_scrolled_target_count > 0 {
    "state-targets"
  } else if has_string(split_list(required_state_kinds), "scrolled") {
    "expected-scrollports"
  } else {
    "none"
  }
}

///|
pub fn semantic_drilldown_flow(layout_score : Double) -> String {
  if layout_score >= 0.08 {
    "layout"
  } else {
    "decoration"
  }
}

///|
pub fn semantic_drilldown_priority(
  flow : String,
  layout_score : Double,
  decoration_score : Double,
) -> Double {
  if flow == "layout" {
    layout_score + decoration_score * 0.25
  } else {
    decoration_score + layout_score * 0.25
  }
}

///|
pub fn semantic_drilldown_reason_id(
  flow : String,
  heatmap_kind_count : Int,
) -> String {
  if flow == "layout" {
    "coarse-landscape"
  } else if heatmap_kind_count > 0 {
    "local-kinds"
  } else {
    "local-pixel"
  }
}

///|
pub fn semantic_drilldown_select_index(
  flows : Array[String],
  priority_scores : Array[Double],
  orders : Array[Int],
) -> Int {
  let limit = min_int(
    flows.length(),
    min_int(priority_scores.length(), orders.length()),
  )
  if limit <= 0 {
    -1
  } else {
    semantic_drilldown_select_loop(flows, priority_scores, orders, limit, 1, 0)
  }
}

///|
fn semantic_drilldown_select_loop(
  flows : Array[String],
  priority_scores : Array[Double],
  orders : Array[Int],
  limit : Int,
  index : Int,
  best : Int,
) -> Int {
  if index >= limit {
    best
  } else if semantic_drilldown_prefers(
      flows[index],
      priority_scores[index],
      orders[index],
      flows[best],
      priority_scores[best],
      orders[best],
    ) {
    semantic_drilldown_select_loop(
      flows,
      priority_scores,
      orders,
      limit,
      index + 1,
      index,
    )
  } else {
    semantic_drilldown_select_loop(
      flows,
      priority_scores,
      orders,
      limit,
      index + 1,
      best,
    )
  }
}

///|
fn semantic_drilldown_prefers(
  candidate_flow : String,
  candidate_priority : Double,
  candidate_order : Int,
  current_flow : String,
  current_priority : Double,
  current_order : Int,
) -> Bool {
  if candidate_flow == "layout" && current_flow != "layout" {
    true
  } else if candidate_flow != "layout" && current_flow == "layout" {
    false
  } else if candidate_priority > current_priority {
    true
  } else if candidate_priority < current_priority {
    false
  } else {
    candidate_order < current_order
  }
}

///|
fn min_int(left : Int, right : Int) -> Int {
  if left < right {
    left
  } else {
    right
  }
}

///|
pub fn ui_contract_version_issue_ids(version : Int) -> String {
  if version != 1 {
    "contract-version-unsupported"
  } else {
    ""
  }
}

///|
pub fn ui_contract_screen_issue_ids(
  id : String,
  pattern : String,
  goal : String,
  source_of_truth : String,
) -> String {
  let issues : Array[String] = []
  if id == "" {
    issues.push("screen-id-required")
  }
  if pattern != "" && !is_ui_contract_pattern(pattern) {
    issues.push("screen-pattern-unknown")
  }
  if goal != "" && !is_ui_contract_goal(goal) {
    issues.push("screen-goal-unknown")
  }
  if source_of_truth != "" && !is_ui_source_of_truth(source_of_truth) {
    issues.push("screen-source-of-truth-unknown")
  }
  issues.join("|")
}

///|
pub fn ui_contract_viewport_issue_ids(
  label : String,
  duplicate_label : Bool,
  width : Double,
  height : Double,
  dpr_present : Bool,
  dpr : Double,
) -> String {
  let issues : Array[String] = []
  if label == "" {
    issues.push("viewport-label-required")
  }
  if duplicate_label {
    issues.push("viewport-label-unique")
  }
  if width <= 0 || height <= 0 {
    issues.push("viewport-size-positive")
  }
  if dpr_present && dpr <= 0 {
    issues.push("viewport-dpr-positive")
  }
  issues.join("|")
}

///|
pub fn ui_contract_landmark_issue_ids(
  id : String,
  role : String,
  name : String,
  parent_id_present : Bool,
  parent_known : Bool,
) -> String {
  let issues : Array[String] = []
  if role == "landmark" {
    issues.push("landmark-abstract-role")
  }
  if id == "" {
    issues.push("landmark-id-required")
  }
  if (role == "region" || role == "form") && name == "" {
    issues.push("landmark-name-required")
  }
  if parent_id_present && !parent_known {
    issues.push("landmark-parent-unknown")
  }
  issues.join("|")
}

///|
pub fn ui_contract_responsive_rule_issue_ids(viewport_known : Bool) -> String {
  if !viewport_known {
    "responsive-rule-viewport-unknown"
  } else {
    ""
  }
}

///|
pub fn ui_contract_pattern_evidence_issue_ids(
  pattern : String,
  marker_kinds : String,
  required_state_kinds : String,
  state_kinds : String,
  expected_scrollport_count : Int,
  has_composition : Bool,
  has_canvas_state_hook : Bool,
  canvas_required_state_fields : String,
) -> String {
  let issues : Array[String] = []
  let markers = split_list(marker_kinds)
  let required_states = split_list(required_state_kinds)
  let states = split_list(state_kinds)
  let canvas_fields = split_list(canvas_required_state_fields)
  if pattern == "landing" {
    push_missing_marker_issue(
      issues, markers, "primary-cta", "landing-marker-primary-cta",
    )
    push_missing_marker_issue(
      issues, markers, "media-slot", "landing-marker-media-slot",
    )
    push_missing_marker_issue(
      issues, markers, "next-section", "landing-marker-next-section",
    )
  }
  if pattern == "app-shell" {
    if !has_string(markers, "scrollport") {
      issues.push("app-shell-marker-scrollport")
    }
    if expected_scrollport_count <= 0 {
      issues.push("app-shell-expected-scrollports")
    }
    push_missing_required_state_issue(
      issues, required_states, "selected", "app-shell-state-selected",
    )
    push_missing_required_state_issue(
      issues, required_states, "scrolled", "app-shell-state-scrolled",
    )
  }
  if pattern == "canvas" {
    if !has_canvas_state_hook {
      issues.push("canvas-state-hook")
    }
    for field in ["mode", "frame", "playerX", "playerY", "score", "assetsReady"] {
      if !has_string(canvas_fields, field) {
        issues.push("canvas-state-field-\{field}")
      }
    }
  }
  if pattern == "expressive-menu" {
    if !has_composition {
      issues.push("expressive-menu-composition")
    }
    let has_state_evidence = has_string(required_states, "selected") ||
      has_string(required_states, "focus-visible") ||
      has_string(markers, "selected") ||
      has_string(states, "selected") ||
      has_string(states, "focus-visible")
    if !has_state_evidence {
      issues.push("expressive-menu-state-evidence")
    }
    push_missing_required_state_issue(
      issues, required_states, "selected", "expressive-menu-required-selected",
    )
    push_missing_required_state_issue(
      issues, required_states, "hover", "expressive-menu-required-hover",
    )
    push_missing_required_state_issue(
      issues, required_states, "focus-visible", "expressive-menu-required-focus-visible",
    )
  }
  issues.join("|")
}

///|
pub fn ui_contract_marker_issue_ids(
  kind : String,
  required : Bool,
  has_selector : Bool,
  has_attribute : Bool,
  has_target : Bool,
) -> String {
  let issues : Array[String] = []
  if !is_ui_marker_kind(kind) {
    issues.push("marker-kind-unknown")
  }
  if required && !has_selector && !has_attribute && !has_target {
    issues.push("marker-target-required")
  }
  issues.join("|")
}

///|
pub fn ui_contract_optional_range_issue_ids(
  min_present : Bool,
  min_value : Double,
  max_present : Bool,
  max_value : Double,
) -> String {
  let issues : Array[String] = []
  if min_present && min_value < 0 {
    issues.push("range-min-non-negative")
  }
  if max_present && max_value < 0 {
    issues.push("range-max-non-negative")
  }
  if min_present && max_present && min_value > max_value {
    issues.push("range-min-lte-max")
  }
  issues.join("|")
}

///|
pub fn ui_contract_slot_issue_ids(id : String) -> String {
  if id == "" {
    "slot-id-required"
  } else {
    ""
  }
}

///|
pub fn ui_contract_asset_issue_ids(id : String) -> String {
  if id == "" {
    "asset-id-required"
  } else {
    ""
  }
}

///|
pub fn ui_contract_canvas_issue_ids(
  has_state_hook : Bool,
  required_state_field_count : Int,
) -> String {
  if required_state_field_count > 0 && !has_state_hook {
    "canvas-state-hook-required"
  } else {
    ""
  }
}

///|
pub fn ui_contract_canvas_input_issue_ids(action : String) -> String {
  if action == "" {
    "canvas-input-action-required"
  } else {
    ""
  }
}

///|
pub fn ui_contract_canvas_hud_issue_ids(id : String) -> String {
  if id == "" {
    "canvas-hud-id-required"
  } else {
    ""
  }
}

///|
pub fn ui_contract_composition_issue_ids(style : String) -> String {
  if !is_ui_composition_style(style) {
    "composition-style-unknown"
  } else {
    ""
  }
}

///|
pub fn ui_contract_composition_axis_issue_ids(axis : String) -> String {
  if !is_ui_composition_axis(axis) {
    "composition-axis-unknown"
  } else {
    ""
  }
}

///|
pub fn ui_contract_composition_layer_issue_ids(
  id : String,
  role : String,
  duplicate_id : Bool,
  z_present : Bool,
  z_finite : Bool,
) -> String {
  let issues : Array[String] = []
  if id == "" {
    issues.push("composition-layer-id-required")
  } else if duplicate_id {
    issues.push("composition-layer-id-unique")
  }
  if !is_ui_composition_layer_role(role) {
    issues.push("composition-layer-role-unknown")
  }
  if z_present && !z_finite {
    issues.push("composition-layer-z-finite")
  }
  issues.join("|")
}

///|
pub fn ui_contract_composition_shape_issue_ids(
  id : String,
  kind : String,
  duplicate_id : Bool,
) -> String {
  let issues : Array[String] = []
  if id == "" {
    issues.push("composition-shape-id-required")
  } else if duplicate_id {
    issues.push("composition-shape-id-unique")
  }
  if !is_ui_composition_shape_kind(kind) {
    issues.push("composition-shape-kind-unknown")
  }
  issues.join("|")
}

///|
pub fn ui_contract_composition_motion_issue_ids(
  id : String,
  trigger : String,
  effect : String,
  duplicate_id : Bool,
  duration_present : Bool,
  duration_ms : Double,
) -> String {
  let issues : Array[String] = []
  if id == "" {
    issues.push("motion-id-required")
  } else if duplicate_id {
    issues.push("motion-id-unique")
  }
  if !is_ui_motion_trigger(trigger) {
    issues.push("motion-trigger-unknown")
  }
  if !is_ui_motion_effect(effect) {
    issues.push("motion-effect-unknown")
  }
  if duration_present && duration_ms < 0 {
    issues.push("motion-duration-non-negative")
  }
  issues.join("|")
}

///|
pub fn ui_contract_composition_contrast_issue_ids(
  mode : String,
  min_ratio_present : Bool,
  min_ratio : Double,
) -> String {
  let issues : Array[String] = []
  if !is_ui_contrast_mode(mode) {
    issues.push("contrast-mode-unknown")
  }
  if min_ratio_present && min_ratio <= 0 {
    issues.push("contrast-min-ratio-positive")
  }
  issues.join("|")
}

///|
pub fn ui_contract_decoration_typography_issue_ids(
  role : String,
  size_present : Bool,
  size : Double,
  line_height_present : Bool,
  line_height : Double,
) -> String {
  let issues : Array[String] = []
  if role == "" {
    issues.push("typography-role-required")
  }
  if size_present && size <= 0 {
    issues.push("typography-size-positive")
  }
  if line_height_present && line_height <= 0 {
    issues.push("typography-line-height-positive")
  }
  issues.join("|")
}

///|
pub fn ui_contract_decoration_palette_issue_ids(
  role : String,
  value : String,
) -> String {
  let issues : Array[String] = []
  if role == "" {
    issues.push("palette-role-required")
  }
  if value != "" && !is_hex_color(value) {
    issues.push("palette-value-hex")
  }
  issues.join("|")
}

///|
pub fn ui_contract_decoration_media_issue_ids(slot : String) -> String {
  if slot == "" {
    "media-slot-required"
  } else {
    ""
  }
}

///|
pub fn ui_contract_content_items_issue_ids(
  exact_present : Bool,
  exact : Double,
) -> String {
  if exact_present && exact < 0 {
    "content-items-exact-non-negative"
  } else {
    ""
  }
}

///|
pub fn ui_contract_content_text_issue_ids(
  row_count_present : Bool,
  row_count : Double,
) -> String {
  if row_count_present && row_count < 0 {
    "content-text-row-count-non-negative"
  } else {
    ""
  }
}

///|
pub fn ui_contract_composition_contrast_palette_issue_ids(
  value : String,
) -> String {
  if !is_hex_color(value) {
    "contrast-palette-value-hex"
  } else {
    ""
  }
}

///|
pub fn ui_contract_layout_issue_ids(
  width_kind : String,
  width_min_present : Bool,
  width_max_present : Bool,
  width_value : Double,
  height_kind : String,
  height_value : Double,
  height_max : Double,
  display_kind : String,
  display_columns_count : Int,
  display_rows_count : Int,
) -> String {
  let issues : Array[String] = []
  if width_kind == "fluid" && !width_min_present && !width_max_present {
    issues.push("layout-width-fluid-bounds")
  }
  if width_kind == "fixed" && width_value <= 0 {
    issues.push("layout-width-fixed-positive")
  }
  if height_kind == "fixed" && height_value <= 0 {
    issues.push("layout-height-fixed-positive")
  }
  if height_kind == "scrollport" && height_max <= 0 {
    issues.push("layout-height-scrollport-max-positive")
  }
  if display_kind == "grid" {
    if display_columns_count <= 0 {
      issues.push("layout-grid-columns")
    }
    if display_rows_count <= 0 {
      issues.push("layout-grid-rows")
    }
  }
  issues.join("|")
}

///|
pub fn ui_contract_state_issue_ids(
  id : String,
  kind : String,
  required : Bool,
  has_selector : Bool,
  has_trigger : Bool,
) -> String {
  let issues : Array[String] = []
  if id == "" {
    issues.push("state-id-required")
  }
  if !is_ui_state_kind(kind) {
    issues.push("state-kind-unknown")
  }
  if required && !has_selector && !has_trigger {
    issues.push("state-target-required")
  }
  issues.join("|")
}

///|
pub fn ui_contract_required_state_issue_ids(
  id : String,
  kind : String,
  required : Bool,
  has_selector : Bool,
  has_trigger : Bool,
  duplicate_id : Bool,
  min_change_ratio_present : Bool,
  min_change_ratio : Double,
) -> String {
  let issues = split_list(
    ui_contract_state_issue_ids(id, kind, required, has_selector, has_trigger),
  )
  if duplicate_id {
    issues.push("required-state-id-unique")
  }
  if !has_selector && !has_trigger {
    push_unique_issue(issues, "state-target-required")
  }
  if min_change_ratio_present && (min_change_ratio < 0 || min_change_ratio > 1) {
    issues.push("required-state-min-change-ratio")
  }
  issues.join("|")
}

///|
pub fn ui_contract_expected_scrollport_issue_ids(
  id : String,
  axis : String,
  required : Bool,
  has_selector : Bool,
  has_name : Bool,
  has_landmark_id : Bool,
  duplicate_id : Bool,
  min_overflow_present : Bool,
  min_overflow : Double,
) -> String {
  let issues : Array[String] = []
  if id == "" {
    issues.push("expected-scrollport-id-required")
  } else if duplicate_id {
    issues.push("expected-scrollport-id-unique")
  }
  if axis != "" && !is_ui_scroll_axis(axis) {
    issues.push("expected-scrollport-axis-unknown")
  }
  if required && !has_selector && !has_name && !has_landmark_id {
    issues.push("expected-scrollport-target-required")
  }
  if min_overflow_present && min_overflow < 0 {
    issues.push("expected-scrollport-min-overflow")
  }
  issues.join("|")
}

///|
fn is_ui_contract_pattern(pattern : String) -> Bool {
  pattern == "editorial" ||
  pattern == "landing" ||
  pattern == "app-shell" ||
  pattern == "dashboard" ||
  pattern == "canvas" ||
  pattern == "expressive-menu" ||
  pattern == "mixed"
}

///|
fn is_ui_contract_goal(goal : String) -> Bool {
  goal == "app" ||
  goal == "layout" ||
  goal == "pixel" ||
  goal == "draft" ||
  goal == "app-shell" ||
  goal == "landing" ||
  goal == "canvas" ||
  goal == "expressive-menu"
}

///|
fn is_ui_source_of_truth(source_of_truth : String) -> Bool {
  source_of_truth == "semantic-dom" ||
  source_of_truth == "landmarks" ||
  source_of_truth == "viewport-shell" ||
  source_of_truth == "data-hierarchy" ||
  source_of_truth == "scene-graph" ||
  source_of_truth == "mixed"
}

///|
fn is_ui_state_kind(kind : String) -> Bool {
  kind == "hover" ||
  kind == "focus-visible" ||
  kind == "selected" ||
  kind == "scrolled" ||
  kind == "empty" ||
  kind == "loading" ||
  kind == "error" ||
  kind == "playing" ||
  kind == "paused" ||
  kind == "result"
}

///|
fn is_ui_marker_kind(kind : String) -> Bool {
  kind == "primary-cta" ||
  kind == "next-section" ||
  kind == "media-slot" ||
  kind == "hero-title" ||
  kind == "scrollport" ||
  kind == "selected" ||
  kind == "unread" ||
  kind == "game-state" ||
  kind == "custom"
}

///|
fn is_ui_scroll_axis(axis : String) -> Bool {
  axis == "x" || axis == "y" || axis == "both"
}

///|
fn is_ui_composition_style(style : String) -> Bool {
  style == "regular" ||
  style == "asymmetric" ||
  style == "poster" ||
  style == "collage" ||
  style == "radial" ||
  style == "layered"
}

///|
fn is_ui_composition_axis(axis : String) -> Bool {
  axis == "orthogonal" ||
  axis == "diagonal" ||
  axis == "radial" ||
  axis == "freeform" ||
  axis == "layered"
}

///|
fn is_ui_composition_layer_role(role : String) -> Bool {
  role == "background" ||
  role == "content" ||
  role == "accent" ||
  role == "foreground" ||
  role == "scrim"
}

///|
fn is_ui_composition_shape_kind(kind : String) -> Bool {
  kind == "slash-panel" ||
  kind == "sticker" ||
  kind == "burst" ||
  kind == "cutout" ||
  kind == "mask" ||
  kind == "frame" ||
  kind == "ribbon"
}

///|
fn is_ui_motion_trigger(trigger : String) -> Bool {
  trigger == "hover" ||
  trigger == "focus" ||
  trigger == "selected" ||
  trigger == "route" ||
  trigger == "load"
}

///|
fn is_ui_motion_effect(effect : String) -> Bool {
  effect == "slam" ||
  effect == "pulse" ||
  effect == "slide" ||
  effect == "scale" ||
  effect == "flash" ||
  effect == "none"
}

///|
fn is_ui_contrast_mode(mode : String) -> Bool {
  mode == "normal" || mode == "high"
}

///|
fn is_hex_color(value : String) -> Bool {
  match
    @string.Regex::unsafe_from_string("^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$").execute(
      value,
    ) {
    Some(_) => true
    None => false
  }
}

///|
fn push_unique_issue(issues : Array[String], issue_id : String) -> Unit {
  if !has_string(issues, issue_id) {
    issues.push(issue_id)
  }
}

///|
fn push_missing_marker_issue(
  issues : Array[String],
  markers : Array[String],
  marker : String,
  issue_id : String,
) -> Unit {
  if !has_string(markers, marker) {
    issues.push(issue_id)
  }
}

///|
fn push_missing_required_state_issue(
  issues : Array[String],
  required_states : Array[String],
  state : String,
  issue_id : String,
) -> Unit {
  if !has_string(required_states, state) {
    issues.push(issue_id)
  }
}

///|
fn split_list(value : String) -> Array[String] {
  let parts : Array[String] = []
  if value == "" {
    return parts
  }
  for part in value.split("|") {
    let owned = part.to_owned().trim().to_owned()
    if !owned.is_empty() {
      parts.push(owned)
    }
  }
  parts
}

///|
fn has_string(values : Array[String], value : String) -> Bool {
  for item in values {
    if item == value {
      return true
    }
  }
  false
}

///|
fn push_unique_component_probe_state(
  states : Array[String],
  state : String,
) -> Unit {
  if is_component_probe_state(state) && !has_string(states, state) {
    states.push(state)
  }
}
