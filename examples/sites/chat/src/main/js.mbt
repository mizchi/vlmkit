// The few browser calls luna does not wrap: timers, querySelector, focus, the clipboard,
// the URL and media queries. All go through mizchi/js_core's Any.

///|
fn win() -> @js.Any {
  @js.global_this()
}

///|
fn doc() -> @js.Any {
  win()._get("document")
}

///|
fn set_timeout(f : () -> Unit, ms : Int32) -> Int32 {
  win()._call("setTimeout", [@js.from_fn0(f), @js.any(ms)]).cast()
}

///|
fn clear_timeout(id : Int32) -> Unit {
  win()._call("clearTimeout", [@js.any(id)]) |> ignore
}

///|
fn qs(sel : String) -> @js.Any {
  doc()._call("querySelector", [@js.any(sel)])
}

///|
fn focus_el(el : @js.Any) -> Unit {
  if !@js.is_nullish(el) {
    el._call("focus", []) |> ignore
  }
}

///|
fn focus_sel(sel : String) -> Unit {
  focus_el(qs(sel))
}

///|
/// Focus after luna has rendered what a signal change asked for.
/// luna renders a `show` synchronously when its signal changes, so focus usually moves in the same
/// task (a keyboard user and a test reading focus right after the click both see it); a target that
/// is not there yet gets a second try once the task is over.
fn later_focus(sel : String) -> Unit {
  let el = qs(sel)
  focus_el(el)
  if @js.is_nullish(el) || !@js.equal(active_el(), el) {
    set_timeout(fn() { focus_sel(sel) }, 0) |> ignore
  }
}

///|
fn[T] ev(e : T) -> @js.Any {
  @js.identity(e)
}

///|
fn[T] key_of(e : T) -> String {
  ev(e)._get("key").cast()
}

///|
fn[T] shift_of(e : T) -> Bool {
  ev(e)._get("shiftKey").cast()
}

///|
fn[T] composing(e : T) -> Bool {
  let v = ev(e)._get("isComposing")
  if @js.is_nullish(v) {
    false
  } else {
    v.cast()
  }
}

///|
fn[T] prevent(e : T) -> Unit {
  ev(e)._call("preventDefault", []) |> ignore
}

///|
fn[T] target_value(e : T) -> String {
  ev(e)._get("target")._get("value").cast()
}

///|
fn query_has(part : String) -> Bool {
  let s : String = win()._get("location")._get("search").cast()
  s.contains(part)
}

///|
fn media(q : String) -> Bool {
  let fnv = win()._get("matchMedia")
  if @js.is_nullish(fnv) {
    false
  } else {
    win()._call("matchMedia", [@js.any(q)])._get("matches").cast()
  }
}

///|
fn is_phone() -> Bool {
  media("(max-width: 767px)")
}

///|
/// Put text on the clipboard. From file:// the browser may refuse; the page never depends on it.
fn copy_text(s : String) -> Unit {
  let cb = win()._get("navigator")._get("clipboard")
  if !@js.is_nullish(cb) {
    let p = @js.try_sync(fn() { cb._call("writeText", [@js.any(s)]) }) catch {
      _ => @js.undefined()
    }
    if !@js.is_nullish(p) {
      p._call("catch", [@js.from_fn1(fn(_x : @js.Any) { () })]) |> ignore
    }
  }
}

///|
fn active_el() -> @js.Any {
  doc()._get("activeElement")
}

///|
/// Elements under a root that can take focus, in document order.
/// Only the ones that are rendered: a display:none control (the collapsed rail on a phone) matches
/// the selector but cannot take focus, and a trap that wraps to it leaves focus where it was.
fn focusables(root : @js.Any) -> Array[@js.Any] {
  @js.array_from(
    root._call("querySelectorAll", [
      @js.any(
        "button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex=\"-1\"])",
      ),
    ]),
  ).filter(fn(el) {
    let rects : Int = el._call("getClientRects", [])._get("length").cast()
    rects > 0
  })
}

///|
/// Keep Tab and Shift+Tab inside root.
fn[T] trap_tab(e : T, root : @js.Any) -> Unit {
  if key_of(e) != "Tab" || @js.is_nullish(root) {
    return
  }
  let items = focusables(root)
  if items.length() == 0 {
    return
  }
  let first = items[0]
  let last = items[items.length() - 1]
  let act = active_el()
  if shift_of(e) {
    if @js.equal(act, first) || !(root._call("contains", [act]).cast() : Bool) {
      prevent(e)
      focus_el(last)
    }
  } else if @js.equal(act, last) ||
    !(root._call("contains", [act]).cast() : Bool) {
    prevent(e)
    focus_el(first)
  }
}

///|
/// Arrow keys, Home and End move between a menu's items; Escape and Tab close it.
fn[T] menu_keys(e : T, root_sel : String, close : (Bool) -> Unit) -> Unit {
  let k = key_of(e)
  let root = qs(root_sel)
  if @js.is_nullish(root) {
    return
  }
  let items = @js.array_from(
    root._call("querySelectorAll", [@js.any("[role^=\"menuitem\"]")]),
  )
  let n = items.length()
  if n == 0 {
    return
  }
  let act = active_el()
  let mut cur = -1
  for i, it in items {
    if @js.equal(it, act) {
      cur = i
    }
  }
  if k == "ArrowDown" {
    prevent(e)
    focus_el(items[(cur + 1) % n])
  } else if k == "ArrowUp" {
    prevent(e)
    focus_el(items[if cur <= 0 { n - 1 } else { cur - 1 }])
  } else if k == "Home" {
    prevent(e)
    focus_el(items[0])
  } else if k == "End" {
    prevent(e)
    focus_el(items[n - 1])
  } else if k == "Escape" {
    prevent(e)
    close(true)
  } else if k == "Tab" {
    close(false)
  }
}

///|
fn add_listener(target : @js.Any, name : String, f : (@js.Any) -> Unit) -> Unit {
  target._call("addEventListener", [@js.any(name), @js.from_fn1(f)]) |> ignore
}

///|
fn set_inert(sel : String, on : Bool) -> Unit {
  let el = qs(sel)
  if !@js.is_nullish(el) {
    el._set("inert", @js.any(on))
  }
}
