///|
test "command args normalize moon run argv" {
  let args = command_args(["motion-core-cli", "arm-rest-gate", "14.48395"])
  inspect(args.length(), content="2")
  inspect(args[0], content="arm-rest-gate")
  inspect(args[1], content="14.48395")
}

///|
test "command args normalize direct node argv" {
  let args = command_args([
    "/opt/homebrew/bin/node", "_build/js/debug/build/motion-core-cli/motion-core-cli.js",
    "select-candidate-group", "false", "1", "0", "0", "0", "0", "0",
  ])
  inspect(args.length(), content="8")
  inspect(args[0], content="select-candidate-group")
  inspect(args[1], content="false")
  inspect(args[7], content="0")
}

///|
test "command args normalize root translation recommendation" {
  let args = command_args([
    "node", "motion-core-cli.js", "root-translation-recommendation", "relative",
    "0.6", "0.2", "0.08",
  ])
  inspect(args.length(), content="5")
  inspect(args[0], content="root-translation-recommendation")
  inspect(args[1], content="relative")
}

///|
test "command args normalize root translation candidate" {
  let args = command_args([
    "node", "motion-core-cli.js", "root-translation-candidate", "consider-scale-to-model",
  ])
  inspect(args.length(), content="2")
  inspect(args[0], content="root-translation-candidate")
  inspect(args[1], content="consider-scale-to-model")
}

///|
test "command args normalize pose mismatch warning ids" {
  let args = command_args([
    "node", "motion-core-cli.js", "pose-mismatch-warning-ids", "1.25", "2.0", "0.5",
    "1.6", "1.0", "45.0",
  ])
  inspect(args.length(), content="7")
  inspect(args[0], content="pose-mismatch-warning-ids")
  inspect(args[6], content="45.0")
}

///|
test "command args normalize pose normalization candidate specs" {
  let args = command_args([
    "node", "motion-core-cli.js", "pose-normalization-candidate-specs", "true", "true",
    "false", "true", "108.40739",
  ])
  inspect(args.length(), content="6")
  inspect(args[0], content="pose-normalization-candidate-specs")
  inspect(args[5], content="108.40739")
}
