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
  // The JSON boundary, checked before the positional table. Two arguments always,
  // so it cannot collide with a positional command name. The dispatch itself is in
  // `@core`, shared with the direct-JS entry point, so the two backends answer
  // identically by construction rather than by both being edited correctly.
  if args.length() == 3 && args[0] == "--json" {
    println(@core.run_json(args[1], args[2]))
    return
  }
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
    ["ui-contract-version-issue-ids", version] =>
      println(@core.ui_contract_version_issue_ids(parse_int(version)))
    ["ui-contract-screen-issue-ids", id, pattern, goal, source_of_truth] =>
      println(
        @core.ui_contract_screen_issue_ids(id, pattern, goal, source_of_truth),
      )
    [
      "ui-contract-viewport-issue-ids",
      label,
      duplicate_label,
      width,
      height,
      dpr_present,
      dpr,
    ] =>
      println(
        @core.ui_contract_viewport_issue_ids(
          label,
          parse_bool(duplicate_label),
          parse_double(width),
          parse_double(height),
          parse_bool(dpr_present),
          parse_double(dpr),
        ),
      )
    [
      "ui-contract-landmark-issue-ids",
      id,
      role,
      name,
      parent_id_present,
      parent_known,
    ] =>
      println(
        @core.ui_contract_landmark_issue_ids(
          id,
          role,
          name,
          parse_bool(parent_id_present),
          parse_bool(parent_known),
        ),
      )
    ["ui-contract-responsive-rule-issue-ids", viewport_known] =>
      println(
        @core.ui_contract_responsive_rule_issue_ids(parse_bool(viewport_known)),
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
    ["ui-contract-slot-issue-ids", id] =>
      println(@core.ui_contract_slot_issue_ids(id))
    ["ui-contract-asset-issue-ids", id] =>
      println(@core.ui_contract_asset_issue_ids(id))
    ["ui-contract-canvas-issue-ids", has_state_hook, required_state_field_count] =>
      println(
        @core.ui_contract_canvas_issue_ids(
          parse_bool(has_state_hook),
          parse_int(required_state_field_count),
        ),
      )
    ["ui-contract-canvas-input-issue-ids", action] =>
      println(@core.ui_contract_canvas_input_issue_ids(action))
    ["ui-contract-canvas-hud-issue-ids", id] =>
      println(@core.ui_contract_canvas_hud_issue_ids(id))
    ["ui-contract-composition-issue-ids", style] =>
      println(@core.ui_contract_composition_issue_ids(style))
    ["ui-contract-composition-axis-issue-ids", axis] =>
      println(@core.ui_contract_composition_axis_issue_ids(axis))
    [
      "ui-contract-composition-layer-issue-ids",
      id,
      role,
      duplicate_id,
      z_present,
      z_finite,
    ] =>
      println(
        @core.ui_contract_composition_layer_issue_ids(
          id,
          role,
          parse_bool(duplicate_id),
          parse_bool(z_present),
          parse_bool(z_finite),
        ),
      )
    ["ui-contract-composition-shape-issue-ids", id, kind, duplicate_id] =>
      println(
        @core.ui_contract_composition_shape_issue_ids(
          id,
          kind,
          parse_bool(duplicate_id),
        ),
      )
    [
      "ui-contract-composition-motion-issue-ids",
      id,
      trigger,
      effect,
      duplicate_id,
      duration_present,
      duration_ms,
    ] =>
      println(
        @core.ui_contract_composition_motion_issue_ids(
          id,
          trigger,
          effect,
          parse_bool(duplicate_id),
          parse_bool(duration_present),
          parse_double(duration_ms),
        ),
      )
    [
      "ui-contract-composition-contrast-issue-ids",
      mode,
      min_ratio_present,
      min_ratio,
    ] =>
      println(
        @core.ui_contract_composition_contrast_issue_ids(
          mode,
          parse_bool(min_ratio_present),
          parse_double(min_ratio),
        ),
      )
    [
      "ui-contract-decoration-typography-issue-ids",
      role,
      size_present,
      size,
      line_height_present,
      line_height,
    ] =>
      println(
        @core.ui_contract_decoration_typography_issue_ids(
          role,
          parse_bool(size_present),
          parse_double(size),
          parse_bool(line_height_present),
          parse_double(line_height),
        ),
      )
    ["ui-contract-decoration-palette-issue-ids", role, value] =>
      println(@core.ui_contract_decoration_palette_issue_ids(role, value))
    ["ui-contract-decoration-media-issue-ids", slot] =>
      println(@core.ui_contract_decoration_media_issue_ids(slot))
    ["ui-contract-content-items-issue-ids", exact_present, exact] =>
      println(
        @core.ui_contract_content_items_issue_ids(
          parse_bool(exact_present),
          parse_double(exact),
        ),
      )
    ["ui-contract-content-text-issue-ids", row_count_present, row_count] =>
      println(
        @core.ui_contract_content_text_issue_ids(
          parse_bool(row_count_present),
          parse_double(row_count),
        ),
      )
    ["ui-contract-composition-contrast-palette-issue-ids", value] =>
      println(@core.ui_contract_composition_contrast_palette_issue_ids(value))
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
    ["landscape-default-grid", width, height] => {
      let w = parse_int(width)
      let h = parse_int(height)
      let cols = @core.landscape_default_grid_cols(w, h)
      let rows = @core.landscape_default_grid_rows(w, h)
      println("\{cols}|\{rows}")
    }
    [
      "landscape-cell-score",
      r1,
      g1,
      b1,
      l1,
      i1,
      r2,
      g2,
      b2,
      l2,
      i2,
    ] =>
      println(
        @core.landscape_cell_score(
          parse_double(r1),
          parse_double(g1),
          parse_double(b1),
          parse_double(l1),
          parse_double(i1),
          parse_double(r2),
          parse_double(g2),
          parse_double(b2),
          parse_double(l2),
          parse_double(i2),
        ).to_string(),
      )
    ["landscape-cell-hex", r, g, b] =>
      println(
        @core.landscape_cell_hex(
          parse_double(r),
          parse_double(g),
          parse_double(b),
        ),
      )
    [
      "landscape-diff-summary",
      cols,
      rows,
      changed_threshold,
      top_n,
      baseline_stats,
      current_stats,
    ] =>
      println(
        @core.landscape_diff_summary(
          parse_int(cols),
          parse_int(rows),
          parse_double(changed_threshold),
          parse_int(top_n),
          baseline_stats,
          current_stats,
        ),
      )
    ["grid-gcd", a, b] =>
      println(@core.grid_gcd(parse_int(a), parse_int(b)).to_string())
    ["grid-all-equal", widths, tolerance] =>
      println(
        bool_to_string_cli(
          @core.grid_all_equal(widths, parse_double(tolerance)),
        ),
      )
    ["grid-arrays-close", a, b, tolerance] =>
      println(
        bool_to_string_cli(
          @core.grid_arrays_close(a, b, parse_double(tolerance)),
        ),
      )
    ["grid-ratios-to-decimal", widths] =>
      println(@core.grid_ratios_to_decimal(widths))
    ["grid-approximate-integer-fr", widths, max_denom] =>
      println(@core.grid_approximate_integer_fr(widths, parse_int(max_denom)))
    ["shift-round-delta", value] =>
      println(@core.shift_round_delta(parse_double(value)).to_string())
    ["shift-classify-suspect", abs_height_delta, abs_top_delta] =>
      println(
        @core.shift_classify_suspect(
          parse_double(abs_height_delta),
          parse_double(abs_top_delta),
        ),
      )
    ["quality-error-state-kind", red_ratio, yellow_ratio] =>
      println(
        @core.quality_error_state_kind(
          parse_double(red_ratio),
          parse_double(yellow_ratio),
        ),
      )
    ["quality-coverage-passed", covered, total] =>
      println(
        bool_to_string_cli(
          @core.quality_coverage_passed(parse_int(covered), parse_int(total)),
        ),
      )
    ["quality-diff-severity", diff_ratio] =>
      println(@core.quality_diff_severity(parse_double(diff_ratio)))
    ["visual-is-likely-page-surface", r, g, b] =>
      println(
        @core.visual_is_likely_page_surface(
          parse_int(r),
          parse_int(g),
          parse_int(b),
        ),
      )
    [
      "visual-classify-region",
      region_type,
      width,
      height,
      diff_pixel_count,
      total_pixels,
      has_color_sample,
      baseline_r,
      baseline_g,
      baseline_b,
      current_r,
      current_g,
      current_b,
    ] =>
      println(
        @core.visual_classify_region(
          region_type,
          parse_int(width),
          parse_int(height),
          parse_int(diff_pixel_count),
          parse_int(total_pixels),
          parse_bool(has_color_sample),
          parse_int(baseline_r),
          parse_int(baseline_g),
          parse_int(baseline_b),
          parse_int(current_r),
          parse_int(current_g),
          parse_int(current_b),
        ),
      )
    ["visual-layout-shift-group-threshold"] =>
      println(@core.visual_layout_shift_group_threshold().to_string())
    ["region-classify-kind", area, aspect, luma_std, color_count, stripe_rows] =>
      println(
        @core.region_classify_kind(
          parse_int(area),
          parse_double(aspect),
          parse_double(luma_std),
          parse_int(color_count),
          parse_int(stripe_rows),
        ),
      )
    [
      "a11y-contrast-evaluate",
      fr,
      fg,
      fb,
      br,
      bg,
      bb,
      font_size,
      font_weight,
    ] =>
      println(
        @core.a11y_contrast_evaluate(
          parse_int(fr),
          parse_int(fg),
          parse_int(fb),
          parse_int(br),
          parse_int(bg),
          parse_int(bb),
          parse_double(font_size),
          parse_int(font_weight),
        ),
      )
    ["focus-order-classify", same_path, prev_x, prev_y, cur_x, cur_y] =>
      println(
        @core.focus_order_classify(
          parse_bool(same_path),
          parse_double(prev_x),
          parse_double(prev_y),
          parse_double(cur_x),
          parse_double(cur_y),
        ),
      )
    ["a11y-touch-required-side", level] =>
      println(@core.a11y_touch_required_side(level).to_string())
    ["a11y-touch-below-required", min_side, level] =>
      println(@core.a11y_touch_below_required(parse_double(min_side), level))
    ["a11y-touch-in-cluster", ax, ay, bx, by] =>
      println(
        @core.a11y_touch_in_cluster(
          parse_double(ax),
          parse_double(ay),
          parse_double(bx),
          parse_double(by),
        ),
      )
    _ => print_usage()
  }
}

///|
fn bool_to_string_cli(value : Bool) -> String {
  if value {
    "true"
  } else {
    "false"
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
  // `command_args` slices argv from the first token this recognises, so the JSON
  // boundary's marker has to be listed or the slice starts at the script path and
  // args[0] is never "--json".
  value == "--json" ||
  value == "component-goal-status" ||
  value == "is-component-probe-state" ||
  value == "is-forced-pseudo-state" ||
  value == "component-probe-states" ||
  value == "merge-component-probe-states" ||
  value == "component-scroll-target-source" ||
  value == "semantic-drilldown-policy" ||
  value == "semantic-drilldown-select-index" ||
  value == "ui-contract-version-issue-ids" ||
  value == "ui-contract-screen-issue-ids" ||
  value == "ui-contract-viewport-issue-ids" ||
  value == "ui-contract-landmark-issue-ids" ||
  value == "ui-contract-responsive-rule-issue-ids" ||
  value == "ui-contract-pattern-evidence-issue-ids" ||
  value == "ui-contract-marker-issue-ids" ||
  value == "ui-contract-optional-range-issue-ids" ||
  value == "ui-contract-slot-issue-ids" ||
  value == "ui-contract-asset-issue-ids" ||
  value == "ui-contract-canvas-issue-ids" ||
  value == "ui-contract-canvas-input-issue-ids" ||
  value == "ui-contract-canvas-hud-issue-ids" ||
  value == "ui-contract-composition-issue-ids" ||
  value == "ui-contract-composition-axis-issue-ids" ||
  value == "ui-contract-composition-layer-issue-ids" ||
  value == "ui-contract-composition-shape-issue-ids" ||
  value == "ui-contract-composition-motion-issue-ids" ||
  value == "ui-contract-composition-contrast-issue-ids" ||
  value == "ui-contract-decoration-typography-issue-ids" ||
  value == "ui-contract-decoration-palette-issue-ids" ||
  value == "ui-contract-decoration-media-issue-ids" ||
  value == "ui-contract-content-items-issue-ids" ||
  value == "ui-contract-content-text-issue-ids" ||
  value == "ui-contract-composition-contrast-palette-issue-ids" ||
  value == "ui-contract-layout-issue-ids" ||
  value == "ui-contract-state-issue-ids" ||
  value == "ui-contract-required-state-issue-ids" ||
  value == "ui-contract-expected-scrollport-issue-ids" ||
  value == "landscape-default-grid" ||
  value == "landscape-cell-score" ||
  value == "landscape-cell-hex" ||
  value == "landscape-diff-summary" ||
  value == "grid-gcd" ||
  value == "grid-all-equal" ||
  value == "grid-arrays-close" ||
  value == "grid-ratios-to-decimal" ||
  value == "grid-approximate-integer-fr" ||
  value == "shift-round-delta" ||
  value == "shift-classify-suspect" ||
  value == "quality-error-state-kind" ||
  value == "quality-coverage-passed" ||
  value == "quality-diff-severity" ||
  value == "visual-is-likely-page-surface" ||
  value == "visual-classify-region" ||
  value == "visual-layout-shift-group-threshold" ||
  value == "region-classify-kind" ||
  value == "a11y-contrast-evaluate" ||
  value == "focus-order-classify" ||
  value == "a11y-touch-required-side" ||
  value == "a11y-touch-below-required" ||
  value == "a11y-touch-in-cluster"
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
    "Usage: markup-core-cli component-goal-status <...> | is-component-probe-state <state> | is-forced-pseudo-state <state> | component-probe-states <kind|kind> | merge-component-probe-states <explicit|...> <injected|...> | component-scroll-target-source <kind|kind> <state-target-count> | semantic-drilldown-policy <layout-score> <decoration-score> <heatmap-kind-count> | semantic-drilldown-select-index <flow|...> <priority|...> <order|...> | ui-contract-version-issue-ids <version> | ui-contract-screen-issue-ids <id> <pattern> <goal> <source-of-truth> | ui-contract-viewport-issue-ids <label> <duplicate-label> <width> <height> <has-dpr> <dpr> | ui-contract-landmark-issue-ids <id> <role> <name> <has-parent-id> <parent-known> | ui-contract-responsive-rule-issue-ids <viewport-known> | ui-contract-pattern-evidence-issue-ids <pattern> <marker|...> <required-state|...> <state|...> <expected-scrollport-count> <has-composition> <has-canvas-state-hook> <canvas-field|...> | ui-contract-marker-issue-ids <kind> <required> <has-selector> <has-attribute> <has-target> | ui-contract-optional-range-issue-ids <has-min> <min> <has-max> <max> | ui-contract-slot-issue-ids <id> | ui-contract-asset-issue-ids <id> | ui-contract-canvas-issue-ids <has-state-hook> <required-state-field-count> | ui-contract-canvas-input-issue-ids <action> | ui-contract-canvas-hud-issue-ids <id> | ui-contract-composition-issue-ids <style> | ui-contract-composition-axis-issue-ids <axis> | ui-contract-composition-layer-issue-ids <id> <role> <duplicate-id> <has-z> <z-finite> | ui-contract-composition-shape-issue-ids <id> <kind> <duplicate-id> | ui-contract-composition-motion-issue-ids <id> <trigger> <effect> <duplicate-id> <has-duration> <duration-ms> | ui-contract-composition-contrast-issue-ids <mode> <has-min-ratio> <min-ratio> | ui-contract-composition-contrast-palette-issue-ids <value> | ui-contract-decoration-typography-issue-ids <role> <has-size> <size> <has-line-height> <line-height> | ui-contract-decoration-palette-issue-ids <role> <value> | ui-contract-decoration-media-issue-ids <slot> | ui-contract-content-items-issue-ids <has-exact> <exact> | ui-contract-content-text-issue-ids <has-row-count> <row-count> | ui-contract-layout-issue-ids <width-kind> <has-min> <has-max> <width-value> <height-kind> <height-value> <height-max> <display-kind> <columns> <rows> | ui-contract-state-issue-ids <id> <kind> <required> <has-selector> <has-trigger> | ui-contract-required-state-issue-ids <id> <kind> <required> <has-selector> <has-trigger> <duplicate-id> <has-min-change-ratio> <min-change-ratio> | ui-contract-expected-scrollport-issue-ids <id> <axis> <required> <has-selector> <has-name> <has-landmark-id> <duplicate-id> <has-min-overflow> <min-overflow>",
  )
}
