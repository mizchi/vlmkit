///|
fn main {
  init_theme()
  if js_url_param("animate") == "0" {
    js_set_root_class("no-anim", true)
  }
  init_global_listeners()
  if js_page_kind() == "watch" {
    watch_page()
  } else {
    home_page()
  }
}
