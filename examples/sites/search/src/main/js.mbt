// Thin wrappers over the browser objects luna does not cover (location, history, document-level
// listeners, focus by id, <dialog>). All of it goes through @js.Any: no hand-written JavaScript.

///|
fn g() -> @js.Any {
  @js.global_this()
}

///|
fn doc() -> @js.Any {
  g()._get("document")
}

///|
fn by_id(id : String) -> @js.Any? {
  let el = doc()._call("getElementById", [@js.any(id)])
  if @js.is_nullish(el) {
    None
  } else {
    Some(el)
  }
}

///|
fn focus_id(id : String) -> Unit {
  match by_id(id) {
    Some(el) => {
      let opts = @js.new_object()
      opts._set("preventScroll", @js.any(true))
      el._call("focus", [opts]) |> ignore
    }
    None => ()
  }
}

///|
fn active_id() -> String {
  let el = doc()._get("activeElement")
  if @js.is_nullish(el) {
    ""
  } else {
    el._get("id").cast()
  }
}

///|
fn str_or(v : @js.Any, d : String) -> String {
  if @js.is_nullish(v) {
    d
  } else {
    v.cast()
  }
}

///|
fn url_param(name : String) -> String {
  let search : String = g()._get("location")._get("search").cast()
  let params = @js.new(g()._get("URLSearchParams"), [@js.any(search)])
  str_or(params._call("get", [@js.any(name)]), "")
}

///|
fn encode(s : String) -> String {
  let e : String = g()._call("encodeURIComponent", [@js.any(s)]).cast()
  e.replace_all(old="%20", new="+")
}

///|
fn push_url(url : String) -> Unit {
  g()._get("history")._call("pushState", [@js.null(), @js.any(""), @js.any(url)])
  |> ignore
}

///|
fn replace_url(url : String) -> Unit {
  g()._get("history")._call("replaceState", [@js.null(), @js.any(""), @js.any(url)])
  |> ignore
}

///|
fn history_back() -> Unit {
  g()._get("history")._call("back", []) |> ignore
}

///|
fn pathname() -> String {
  g()._get("location")._get("pathname").cast()
}

///|
fn scroll_top() -> Unit {
  g()._call("scrollTo", [@js.any(0), @js.any(0)]) |> ignore
}

///|
fn set_title(t : String) -> Unit {
  doc()._set("title", @js.any(t))
}

///|
fn prefers_dark() -> Bool {
  let mq = g()._call("matchMedia", [@js.any("(prefers-color-scheme: dark)")])
  mq._get("matches").cast()
}

///|
fn set_root_theme(dark : Bool) -> Unit {
  let root = doc()._get("documentElement")
  root._call("setAttribute", [
    @js.any("data-theme"),
    @js.any(if dark { "dark" } else { "light" }),
  ])
  |> ignore
}

///|
fn listen(target : @js.Any, name : String, f : (@js.Any) -> Unit) -> Unit {
  target._call("addEventListener", [@js.any(name), @js.from_fn1(f)]) |> ignore
}

///|
fn key_of(e : @js.Any) -> String {
  e._get("key").cast()
}

///|
fn prevent(e : @js.Any) -> Unit {
  e._call("preventDefault", []) |> ignore
}

///|
/// The `data-popup` of the nearest popup root around an event target, or "".
fn popup_root_of(target : @js.Any) -> String {
  if @js.is_nullish(target) || @js.is_nullish(target._get("closest")) {
    return ""
  }
  let root = target._call("closest", [@js.any("[data-popup]")])
  if @js.is_nullish(root) {
    ""
  } else {
    str_or(root._call("getAttribute", [@js.any("data-popup")]), "")
  }
}

///|
fn set_value(el : @js.Any, v : String) -> Unit {
  el._set("value", @js.any(v))
}

///|
fn set_or_remove_attr(el : @js.Any, name : String, v : String) -> Unit {
  if v == "" {
    el._call("removeAttribute", [@js.any(name)]) |> ignore
  } else {
    el._call("setAttribute", [@js.any(name), @js.any(v)]) |> ignore
  }
}

///|
/// Ids of the menu items inside a menu, in order.
fn menu_item_ids(menu_id : String) -> Array[String] {
  match by_id(menu_id) {
    None => []
    Some(m) => {
      let list = @js.array_from(
        m._call("querySelectorAll", [@js.any("[role^=menuitem]")]),
      )
      list.map(fn(x) { x._get("id").cast() })
    }
  }
}

///|
fn dialog_open(id : String) -> Unit {
  match by_id(id) {
    Some(d) => if !(d._get("open").cast() : Bool) { d._call("showModal", []) |> ignore }
    None => ()
  }
}

///|
fn dialog_close(id : String) -> Unit {
  match by_id(id) {
    Some(d) => d._call("close", []) |> ignore
    None => ()
  }
}
