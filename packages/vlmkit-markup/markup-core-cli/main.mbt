///|
fn main {
  main_err() catch {
    error => {
      println("markup-core-cli error: \{error}")
      panic()
    }
  }
}

///|
fn main_err() -> Unit raise {
  let args = command_args(@env.args())
  match args {
    [
      "component-goal-status",
      goal,
      pixel_diff_ratio,
      landscape_diff_ratio,
      pass_landscape,
      pass_pixel,
      review_landscape,
      review_pixel,
      scroll_total,
      scroll_broken,
      scroll_empty,
      expected_total,
      expected_missing,
      expected_broken,
      expected_empty,
      landing_present,
      landing_hero_visible,
      landing_primary_cta_visible,
      landing_next_section_hint_visible,
      landing_media_slot_visible,
      canvas_count,
      canvas_nonblank,
      canvas_frame_delta,
      canvas_input_responsive,
      canvas_state_hook_present,
      canvas_missing_state_fields,
      expressive_present,
      expressive_layers,
      expressive_shapes,
      expressive_selected_visible,
      expressive_focusable_item_count,
      expressive_semantic_menu_text,
      expressive_diagonal_evidence,
      expressive_high_contrast,
      expressive_low_contrast_item_count,
      expressive_hover_changed,
      expressive_focus_visible_changed,
    ] =>
      println(
        @core.component_goal_status(
          goal,
          parse_double(pixel_diff_ratio),
          parse_double(landscape_diff_ratio),
          parse_optional_double(pass_landscape),
          parse_optional_double(pass_pixel),
          parse_optional_double(review_landscape),
          parse_optional_double(review_pixel),
          parse_int(scroll_total),
          parse_int(scroll_broken),
          parse_int(scroll_empty),
          parse_int(expected_total),
          parse_int(expected_missing),
          parse_int(expected_broken),
          parse_int(expected_empty),
          parse_bool(landing_present),
          parse_bool(landing_hero_visible),
          parse_bool(landing_primary_cta_visible),
          parse_bool(landing_next_section_hint_visible),
          parse_bool(landing_media_slot_visible),
          parse_int(canvas_count),
          parse_bool(canvas_nonblank),
          parse_bool(canvas_frame_delta),
          parse_optional_bool(canvas_input_responsive),
          parse_optional_bool(canvas_state_hook_present),
          parse_int(canvas_missing_state_fields),
          parse_bool(expressive_present),
          parse_int(expressive_layers),
          parse_int(expressive_shapes),
          parse_bool(expressive_selected_visible),
          parse_int(expressive_focusable_item_count),
          parse_bool(expressive_semantic_menu_text),
          parse_bool(expressive_diagonal_evidence),
          parse_bool(expressive_high_contrast),
          parse_int(expressive_low_contrast_item_count),
          parse_optional_bool(expressive_hover_changed),
          parse_optional_bool(expressive_focus_visible_changed),
        ),
      )
    ["is-component-probe-state", value] =>
      println(@core.is_component_probe_state(value))
    ["is-forced-pseudo-state", value] =>
      println(@core.is_forced_pseudo_state(value))
    ["component-probe-states", required_state_kinds] =>
      println(@core.component_probe_states(required_state_kinds))
    ["merge-component-probe-states", explicit_states, injected_states] =>
      println(
        @core.merge_component_probe_states(explicit_states, injected_states),
      )
    [
      "component-scroll-target-source",
      required_state_kinds,
      explicit_scrolled_target_count,
    ] =>
      println(
        @core.component_scroll_target_source(
          required_state_kinds,
          parse_int(explicit_scrolled_target_count),
        ),
      )
    [
      "semantic-drilldown-policy",
      layout_score,
      decoration_score,
      heatmap_kind_count,
    ] => {
      let layout = parse_double(layout_score)
      let decoration = parse_double(decoration_score)
      let flow = @core.semantic_drilldown_flow(layout)
      let priority = @core.semantic_drilldown_priority(flow, layout, decoration)
      let reason_id = @core.semantic_drilldown_reason_id(
        flow,
        parse_int(heatmap_kind_count),
      )
      println([flow, priority.to_string(), reason_id].join("|"))
    }
    ["semantic-drilldown-select-index", flows, priority_scores, orders] =>
      println(
        @core.semantic_drilldown_select_index(
          parse_string_list(flows),
          parse_double_list(priority_scores),
          parse_int_list(orders),
        ),
      )
    [
      "ui-contract-pattern-evidence-issue-ids",
      pattern,
      marker_kinds,
      required_state_kinds,
      state_kinds,
      expected_scrollport_count,
      has_composition,
      has_canvas_state_hook,
      canvas_required_state_fields,
    ] =>
      println(
        @core.ui_contract_pattern_evidence_issue_ids(
          pattern,
          marker_kinds,
          required_state_kinds,
          state_kinds,
          parse_int(expected_scrollport_count),
          parse_bool(has_composition),
          parse_bool(has_canvas_state_hook),
          canvas_required_state_fields,
        ),
      )
    [
      "ui-contract-marker-issue-ids",
      kind,
      required,
      has_selector,
      has_attribute,
      has_target,
    ] =>
      println(
        @core.ui_contract_marker_issue_ids(
          kind,
          parse_bool(required),
          parse_bool(has_selector),
          parse_bool(has_attribute),
          parse_bool(has_target),
        ),
      )
    [
      "ui-contract-optional-range-issue-ids",
      min_present,
      min_value,
      max_present,
      max_value,
    ] =>
      println(
        @core.ui_contract_optional_range_issue_ids(
          parse_bool(min_present),
          parse_double(min_value),
          parse_bool(max_present),
          parse_double(max_value),
        ),
      )
    [
      "ui-contract-layout-issue-ids",
      width_kind,
      width_min_present,
      width_max_present,
      width_value,
      height_kind,
      height_value,
      height_max,
      display_kind,
      display_columns_count,
      display_rows_count,
    ] =>
      println(
        @core.ui_contract_layout_issue_ids(
          width_kind,
          parse_bool(width_min_present),
          parse_bool(width_max_present),
          parse_double(width_value),
          height_kind,
          parse_double(height_value),
          parse_double(height_max),
          display_kind,
          parse_int(display_columns_count),
          parse_int(display_rows_count),
        ),
      )
    [
      "ui-contract-state-issue-ids",
      id,
      kind,
      required,
      has_selector,
      has_trigger,
    ] =>
      println(
        @core.ui_contract_state_issue_ids(
          id,
          kind,
          parse_bool(required),
          parse_bool(has_selector),
          parse_bool(has_trigger),
        ),
      )
    [
      "ui-contract-required-state-issue-ids",
      id,
      kind,
      required,
      has_selector,
      has_trigger,
      duplicate_id,
      min_change_ratio_present,
      min_change_ratio,
    ] =>
      println(
        @core.ui_contract_required_state_issue_ids(
          id,
          kind,
          parse_bool(required),
          parse_bool(has_selector),
          parse_bool(has_trigger),
          parse_bool(duplicate_id),
          parse_bool(min_change_ratio_present),
          parse_double(min_change_ratio),
        ),
      )
    [
      "ui-contract-expected-scrollport-issue-ids",
      id,
      axis,
      required,
      has_selector,
      has_name,
      has_landmark_id,
      duplicate_id,
      min_overflow_present,
      min_overflow,
    ] =>
      println(
        @core.ui_contract_expected_scrollport_issue_ids(
          id,
          axis,
          parse_bool(required),
          parse_bool(has_selector),
          parse_bool(has_name),
          parse_bool(has_landmark_id),
          parse_bool(duplicate_id),
          parse_bool(min_overflow_present),
          parse_double(min_overflow),
        ),
      )
    _ => print_usage()
  }
}

///|
fn command_args(raw : Array[String]) -> Array[String] {
  if raw.length() >= 3 && is_command(raw[2]) {
    raw[2:].to_owned()
  } else if raw.length() >= 2 && is_command(raw[1]) {
    raw[1:].to_owned()
  } else if raw.length() >= 1 && is_command(raw[0]) {
    raw
  } else if raw.length() >= 1 {
    raw[1:].to_owned()
  } else {
    []
  }
}

///|
fn is_command(value : String) -> Bool {
  value == "component-goal-status" ||
  value == "is-component-probe-state" ||
  value == "is-forced-pseudo-state" ||
  value == "component-probe-states" ||
  value == "merge-component-probe-states" ||
  value == "component-scroll-target-source" ||
  value == "semantic-drilldown-policy" ||
  value == "semantic-drilldown-select-index" ||
  value == "ui-contract-pattern-evidence-issue-ids" ||
  value == "ui-contract-marker-issue-ids" ||
  value == "ui-contract-optional-range-issue-ids" ||
  value == "ui-contract-layout-issue-ids" ||
  value == "ui-contract-state-issue-ids" ||
  value == "ui-contract-required-state-issue-ids" ||
  value == "ui-contract-expected-scrollport-issue-ids"
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
fn parse_string_list(value : String) -> Array[String] {
  let values : Array[String] = []
  if value == "" {
    return values
  }
  for part in value.split("|") {
    let owned = part.to_owned().trim().to_owned()
    if !owned.is_empty() {
      values.push(owned)
    }
  }
  values
}

///|
fn parse_double_list(value : String) -> Array[Double] raise {
  let values : Array[Double] = []
  for part in parse_string_list(value) {
    values.push(parse_double(part))
  }
  values
}

///|
fn parse_int_list(value : String) -> Array[Int] raise {
  let values : Array[Int] = []
  for part in parse_string_list(value) {
    values.push(parse_int(part))
  }
  values
}

///|
fn print_usage() -> Unit {
  println(
    "Usage: markup-core-cli component-goal-status <...> | is-component-probe-state <state> | is-forced-pseudo-state <state> | component-probe-states <kind|kind> | merge-component-probe-states <explicit|...> <injected|...> | component-scroll-target-source <kind|kind> <state-target-count> | semantic-drilldown-policy <layout-score> <decoration-score> <heatmap-kind-count> | semantic-drilldown-select-index <flow|...> <priority|...> <order|...> | ui-contract-pattern-evidence-issue-ids <pattern> <marker|...> <required-state|...> <state|...> <expected-scrollport-count> <has-composition> <has-canvas-state-hook> <canvas-field|...> | ui-contract-marker-issue-ids <kind> <required> <has-selector> <has-attribute> <has-target> | ui-contract-optional-range-issue-ids <has-min> <min> <has-max> <max> | ui-contract-layout-issue-ids <width-kind> <has-min> <has-max> <width-value> <height-kind> <height-value> <height-max> <display-kind> <columns> <rows> | ui-contract-state-issue-ids <id> <kind> <required> <has-selector> <has-trigger> | ui-contract-required-state-issue-ids <id> <kind> <required> <has-selector> <has-trigger> <duplicate-id> <has-min-change-ratio> <min-change-ratio> | ui-contract-expected-scrollport-issue-ids <id> <axis> <required> <has-selector> <has-name> <has-landmark-id> <duplicate-id> <has-min-overflow> <min-overflow>",
  )
}
