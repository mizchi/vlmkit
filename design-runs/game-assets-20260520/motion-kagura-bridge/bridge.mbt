///|
pub fn runtime_frame_budget(elapsed_ms : Double) -> Int {
  let state = @kagura.initial_fixed_step_state()
  let config = @kagura.new_fixed_step_config(60, 4)
  let result = @kagura.plan_fixed_updates(state, elapsed_ms, config)
  @kagura.step_result_updates(result)
}
