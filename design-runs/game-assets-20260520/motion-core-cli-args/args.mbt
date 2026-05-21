///|
pub fn command_args(raw : Array[String]) -> Array[String] {
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
  value == "arm-rest-gate" ||
  value == "arm-rest-candidate" ||
  value == "select-candidate-group" ||
  value == "root-translation-recommendation" ||
  value == "root-translation-candidate" ||
  value == "pose-mismatch-warning-ids" ||
  value == "pose-normalization-candidate-specs"
}
