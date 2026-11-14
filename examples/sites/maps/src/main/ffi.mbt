// Browser APIs that luna does not wrap. Each is a one-line MoonBit extern.

///|
extern "js" fn raf(f : (Double) -> Unit) -> Unit =
  #|(f) => requestAnimationFrame(f)

///|
extern "js" fn reduced_motion() -> Bool =
  #|() => !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches)

///|
extern "js" fn win_w() -> Double =
  #|() => window.innerWidth

///|
extern "js" fn win_h() -> Double =
  #|() => window.innerHeight

///|
extern "js" fn on_window(name : String, f : (@js.Any) -> Unit) -> Unit =
  #|(name, f) => window.addEventListener(name, f)

///|
extern "js" fn url_param(name : String) -> String =
  #|(name) => { try { return new URLSearchParams(location.search).get(name) || ""; } catch (e) { return ""; } }

///|
extern "js" fn replace_query(q : String) -> Unit =
  #|(q) => { try { history.replaceState(null, "", location.pathname + q + location.hash); } catch (e) {} }

///|
extern "js" fn parse_num(s : String) -> Double =
  #|(s) => { const n = parseFloat(s); return isFinite(n) ? n : NaN; }

///|
extern "js" fn is_nan(d : Double) -> Bool =
  #|(d) => d !== d

///|
extern "js" fn fmt1(d : Double) -> String =
  #|(d) => String(Math.round(d * 10) / 10)

///|
extern "js" fn fmt2(d : Double) -> String =
  #|(d) => String(Math.round(d * 100) / 100)

///|
extern "js" fn ev_num(e : @js.Any, k : String) -> Double =
  #|(e, k) => +e[k] || 0

///|
extern "js" fn ev_str(e : @js.Any, k : String) -> String =
  #|(e, k) => String(e[k] == null ? "" : e[k])

///|
extern "js" fn ev_prevent(e : @js.Any) -> Unit =
  #|(e) => e.preventDefault()

///|
extern "js" fn ev_stop(e : @js.Any) -> Unit =
  #|(e) => e.stopPropagation()

///|
extern "js" fn target_in(e : @js.Any, sel : String) -> Bool =
  #|(e, sel) => !!(e.target && e.target.closest && e.target.closest(sel))

///|
extern "js" fn el_left(el : @js.Any) -> Double =
  #|(el) => el ? el.getBoundingClientRect().left : 0

///|
extern "js" fn el_top(el : @js.Any) -> Double =
  #|(el) => el ? el.getBoundingClientRect().top : 0

///|
extern "js" fn el_width(el : @js.Any) -> Double =
  #|(el) => el ? el.clientWidth : 0

///|
extern "js" fn el_height(el : @js.Any) -> Double =
  #|(el) => el ? el.clientHeight : 0

///|
extern "js" fn capture(el : @js.Any, e : @js.Any) -> Unit =
  #|(el, e) => { try { el.setPointerCapture(e.pointerId); } catch (x) {} }

///|
extern "js" fn release(el : @js.Any, e : @js.Any) -> Unit =
  #|(el, e) => { try { el.releasePointerCapture(e.pointerId); } catch (x) {} }

///|
extern "js" fn focus_el(el : @js.Any) -> Unit =
  #|(el) => { if (el && el.focus) el.focus(); }

///|
extern "js" fn focus_id(id : String) -> Unit =
  #|(id) => { const el = document.getElementById(id); if (el) el.focus(); }

///|
extern "js" fn focus_later(id : String) -> Unit =
  #|(id) => requestAnimationFrame(() => { const el = document.getElementById(id); if (el) el.focus(); })

///|
extern "js" fn set_value(el : @js.Any, v : String) -> Unit =
  #|(el, v) => { if (el) el.value = v; }

///|
extern "js" fn select_all(el : @js.Any) -> Unit =
  #|(el) => { if (el && el.select) { el.select(); el.scrollLeft = 0; } }

///|
extern "js" fn dialog_show(el : @js.Any) -> Unit =
  #|(el) => { if (el && !el.open) el.showModal(); }

///|
extern "js" fn dialog_close(el : @js.Any) -> Unit =
  #|(el) => { if (el && el.open) el.close(); }

///|
extern "js" fn on_el(el : @js.Any, name : String, f : (@js.Any) -> Unit) -> Unit =
  #|(el, name, f) => el.addEventListener(name, f, { passive: false })

///|
extern "js" fn scroll_into(id : String) -> Unit =
  #|(id) => { const el = document.getElementById(id); if (el) el.scrollIntoView({ block: "nearest" }); }

///|
extern "js" fn scroll_top(el : @js.Any) -> Unit =
  #|(el) => { if (el) el.scrollTop = 0; }

///|
fn as_any(el : @dom.Element) -> @js.Any {
  el |> @js.identity
}

///|
fn[T] ev(e : T) -> @js.Any {
  @js.identity(e)
}
