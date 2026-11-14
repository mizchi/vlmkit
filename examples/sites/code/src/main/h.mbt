// Small helpers over luna's create_element, and the browser glue luna has no API for.

///|
using @element {type DomNode, type AttrValue}

///|
fn el(
  tag : String,
  attrs : Array[(String, AttrValue)],
  kids : Array[DomNode],
) -> DomNode {
  @element.create_element(tag, attrs, kids)
}

///|
fn a_(name : String, v : String) -> (String, AttrValue) {
  (name, AttrValue::Static(v))
}

///|
fn cls(v : String) -> (String, AttrValue) {
  ("class", AttrValue::Static(v))
}

///|
fn ad(name : String, f : () -> String) -> (String, AttrValue) {
  (name, AttrValue::Dynamic(f))
}

///|
fn on(name : String, f : (@js.Any) -> Unit) -> (String, AttrValue) {
  (name, AttrValue::Handler(f))
}

///|
fn t(s : String) -> DomNode {
  @element.text(s)
}

///|
fn td(f : () -> String) -> DomNode {
  @element.text_dyn(f)
}

///|
fn bool_s(b : Bool) -> String {
  if b {
    "true"
  } else {
    "false"
  }
}

///|
/// Render `render(key)` again whenever `key()` changes (for_each keys by ===).
fn keyed(key : () -> String, render : (String) -> DomNode) -> DomNode {
  @element.for_each(fn() { [key()] }, fn(k, _i) { render(k) })
}

///|
let svg_ns : String = "http://www.w3.org/2000/svg"

///|
fn svg_el(
  tag : String,
  attrs : Array[(String, AttrValue)],
  kids : Array[DomNode],
) -> DomNode {
  // luna applies a static "class" with `elem.className = v`, which an SVG element ignores
  // (its className is a read-only SVGAnimatedString). Set it as an attribute from the ref.
  let out : Array[(String, AttrValue)] = []
  for at in attrs {
    match at {
      ("class", AttrValue::Static(v)) =>
        out.push(("__ref", AttrValue::Handler(fn(e) { set_class_attr(e, v) })))
      _ => out.push(at)
    }
  }
  @element.create_element_ns(svg_ns, tag, out, kids)
}

///|
extern "js" fn set_class_attr(e : @js.Any, v : String) -> Unit =
  #|(e, v) => e.setAttribute("class", v)

// --- browser glue -------------------------------------------------------

///|
extern "js" fn get_hash() -> String =
  #|() => { const h = location.hash.slice(1); try { return decodeURIComponent(h); } catch (e) { return h; } }

///|
extern "js" fn set_hash(h : String) -> Unit =
  #|(h) => { location.hash = h; }

///|
extern "js" fn replace_hash(h : String) -> Unit =
  #|(h) => { try { history.replaceState(history.state, "", h); } catch (e) { location.hash = h; } }

///|
extern "js" fn on_window(name : String, f : (@js.Any) -> Unit) -> Unit =
  #|(name, f) => window.addEventListener(name, f)

///|
extern "js" fn on_doc(name : String, f : (@js.Any) -> Unit) -> Unit =
  #|(name, f) => document.addEventListener(name, f)

///|
extern "js" fn search_param(name : String) -> String =
  #|(name) => { try { return new URLSearchParams(location.search).get(name) || ""; } catch (e) { return ""; } }

///|
extern "js" fn set_root_attr(name : String, v : String) -> Unit =
  #|(name, v) => document.documentElement.setAttribute(name, v)

///|
extern "js" fn copy_text(s : String) -> Unit =
  #|(s) => { try { if (navigator.clipboard) navigator.clipboard.writeText(s).catch(() => {}); } catch (e) {} }

///|
extern "js" fn focus_sel(sel : String) -> Unit =
  #|(sel) => { const e = document.querySelector(sel); if (e) e.focus(); }

///|
extern "js" fn later(ms : Int, f : () -> Unit) -> Unit =
  #|(ms, f) => { setTimeout(() => f(), ms); }

///|
extern "js" fn show_modal(id : String) -> Unit =
  #|(id) => { const d = document.getElementById(id); if (d && !d.open) d.showModal(); }

///|
extern "js" fn close_modal(id : String) -> Unit =
  #|(id) => { const d = document.getElementById(id); if (d && d.open) d.close(); }

///|
extern "js" fn closest(e : @js.Any, sel : String) -> Bool =
  #|(e, sel) => { const path = e.composedPath ? e.composedPath() : [e.target]; return path.some((n) => n && n.matches && n.matches(sel)); }

///|
extern "js" fn target_is(e : @js.Any, id : String) -> Bool =
  #|(e, id) => !!(e.target && e.target.id === id)

///|
extern "js" fn editable_target(e : @js.Any) -> Bool =
  #|(e) => { const t = e.target; if (!t || !t.tagName) return false; const n = t.tagName; return n === "INPUT" || n === "TEXTAREA" || n === "SELECT" || t.isContentEditable; }

///|
extern "js" fn any_dialog_open() -> Bool =
  #|() => !!document.querySelector("dialog[open]")

///|
extern "js" fn ev_key(e : @js.Any) -> String =
  #|(e) => e.key || ""

///|
extern "js" fn ev_shift(e : @js.Any) -> Bool =
  #|(e) => !!e.shiftKey

///|
extern "js" fn ev_mod(e : @js.Any) -> Bool =
  #|(e) => !!(e.ctrlKey || e.metaKey || e.altKey)

///|
extern "js" fn prevent(e : @js.Any) -> Unit =
  #|(e) => e.preventDefault()

///|
extern "js" fn ev_value(e : @js.Any) -> String =
  #|(e) => (e.target && e.target.value) || ""

///|
extern "js" fn set_value(sel : String, v : String) -> Unit =
  #|(sel, v) => { const e = document.querySelector(sel); if (e) e.value = v; }

///|
extern "js" fn get_value(sel : String) -> String =
  #|(sel) => { const e = document.querySelector(sel); return (e && e.value) || ""; }

///|
extern "js" fn scroll_to(sel : String) -> Unit =
  #|(sel) => { const e = document.querySelector(sel); if (e) e.scrollIntoView({ block: "center" }); }

///|
extern "js" fn scroll_top() -> Unit =
  #|() => window.scrollTo(0, 0)

///|
extern "js" fn data_url(text : String) -> String =
  #|(text) => "data:text/plain;charset=utf-8," + encodeURIComponent(text)

///|
extern "js" fn byte_len(text : String) -> Int =
  #|(text) => new TextEncoder().encode(text).length

///|
extern "js" fn scroll_into_list(sel : String) -> Unit =
  #|(sel) => { const e = document.querySelector(sel); if (e) e.scrollIntoView({ block: "nearest" }); }

///|
/// A list rendered once from the current values (inside `keyed`, which re-renders it).
/// A reactive for_each nested in a keyed block that tracks the same signals left stale rows behind.
fn[T] static_list(items : () -> Array[T], render : (T, Int) -> DomNode) -> DomNode {
  @element.fragment(@resource.untracked(items).mapi(fn(i, x) { render(x, i) }))
}
