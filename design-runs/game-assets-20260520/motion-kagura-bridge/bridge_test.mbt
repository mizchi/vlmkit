///|
test "published Kagura facade plans fixed updates" {
  inspect(runtime_frame_budget(0.0), content="0")
  inspect(runtime_frame_budget(20.0), content="1")
  inspect(runtime_frame_budget(1000.0), content="4")
}
