///| Visual / semantic classification over the JSON boundary.
///
/// `visual-classify-region` is the argument-count worst case in this batch (12, of which
/// 10 are mutually swappable): a region descriptor followed by two RGB triples, with a
/// `has_color_sample` boolean in the middle whose job was to say whether the six numbers
/// after it meant anything. `Rgb?` says that, and the two triples become named.
///
/// `semantic-drilldown-select-index` is the interesting one. It took **three parallel
/// arrays** — `flows : Array[String]`, `priority_scores : Array[Double]`,
/// `orders : Array[Int]` — correlated by index, with nothing tying them together. A
/// caller that filtered one and not the others, or built them in different orders,
/// produces a well-typed call that silently scores the wrong candidate. One array of
/// records makes that unrepresentable, which is the same reason `interaction-issues`
/// went over as `Array[InteractionElementInput]`.

///|
pub struct ClassifyRegionInput {
  region_type : String
  width : Int
  height : Int
  diff_pixel_count : Int
  total_pixels : Int
  /// Absent when no colour was sampled. The positional form spent a boolean plus six
  /// numbers saying this.
  baseline_color : Rgb?
  current_color : Rgb?
} derive(FromJson, ToJson)

///|
pub fn classify_region(input : ClassifyRegionInput) -> String {
  // The rule takes one `has_color_sample` covering both triples, so reconstruct it as
  // "both present" — which is what every existing caller sent, since a sample is a
  // baseline/current pair or nothing.
  let has_sample = input.baseline_color is Some(_) && input.current_color is Some(_)
  let baseline = input.baseline_color.unwrap_or({ r: 0, g: 0, b: 0 })
  let current = input.current_color.unwrap_or({ r: 0, g: 0, b: 0 })
  visual_classify_region(
    input.region_type,
    input.width,
    input.height,
    input.diff_pixel_count,
    input.total_pixels,
    has_sample,
    baseline.r,
    baseline.g,
    baseline.b,
    current.r,
    current.g,
    current.b,
  )
}

///|
pub fn is_likely_page_surface(input : Rgb) -> String {
  visual_is_likely_page_surface(input.r, input.g, input.b)
}

///|
pub struct RegionKindInput {
  area : Int
  aspect : Double
  luma_std : Double
  color_count : Int
  stripe_rows : Int
} derive(FromJson, ToJson)

///|
pub fn region_kind(input : RegionKindInput) -> String {
  region_classify_kind(
    input.area,
    input.aspect,
    input.luma_std,
    input.color_count,
    input.stripe_rows,
  )
}

///|
/// One drilldown candidate. Replaces three index-correlated parallel arrays.
pub struct DrilldownCandidate {
  flow : String
  priority_score : Double
  order : Int
} derive(FromJson, ToJson)

///|
pub struct DrilldownSelectInput {
  candidates : Array[DrilldownCandidate]
} derive(FromJson, ToJson)

///|
pub fn drilldown_select_index(input : DrilldownSelectInput) -> Int {
  let flows : Array[String] = []
  let scores : Array[Double] = []
  let orders : Array[Int] = []
  for candidate in input.candidates {
    flows.push(candidate.flow)
    scores.push(candidate.priority_score)
    orders.push(candidate.order)
  }
  semantic_drilldown_select_index(flows, scores, orders)
}

///|
pub struct DrilldownPolicyInput {
  layout_score : Double
  decoration_score : Double
  heatmap_kind_count : Int
} derive(FromJson, ToJson)

///|
/// `flow|priority|reason_id` was three values in a string that TypeScript split, coerced
/// and hand-validated against two literal unions, raising three different "unexpected
/// markup-core …" errors when it did not like what it found. The types are known here.
pub struct DrilldownPolicy {
  flow : String
  priority_score : Double
  reason_id : String
} derive(ToJson)

///|
pub fn drilldown_policy(input : DrilldownPolicyInput) -> DrilldownPolicy {
  let flow = semantic_drilldown_flow(input.layout_score)
  {
    flow,
    priority_score: semantic_drilldown_priority(
      flow,
      input.layout_score,
      input.decoration_score,
    ),
    reason_id: semantic_drilldown_reason_id(flow, input.heatmap_kind_count),
  }
}

///|
/// Two pipe-joined lists in, one out. `Array[String]` in all three places.
pub struct MergeProbeStatesInput {
  explicit : Array[String]
  injected : Array[String]
} derive(FromJson, ToJson)

///|
pub fn merge_probe_states(input : MergeProbeStatesInput) -> Array[String] {
  split_issue_ids(
    merge_component_probe_states(
      join_issue_ids(input.explicit),
      join_issue_ids(input.injected),
    ),
  )
}
