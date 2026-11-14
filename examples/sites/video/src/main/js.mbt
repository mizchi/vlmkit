// Small browser bridges the luna element API does not cover: timers, the URL,
// media queries, focus after a render, and the Fullscreen API. Each is one line
// of JavaScript behind a typed MoonBit signature.

///|
extern "js" fn js_set_timeout(f : () -> Unit, ms : Int) -> Int =
  #|(f, ms) => setTimeout(() => f(), ms)

///|
extern "js" fn js_clear_timeout(id : Int) -> Unit =
  #|(id) => clearTimeout(id)

///|
extern "js" fn js_raf(f : (Double) -> Unit) -> Int =
  #|(f) => requestAnimationFrame((t) => f(t))

///|
extern "js" fn js_cancel_raf(id : Int) -> Unit =
  #|(id) => cancelAnimationFrame(id)

///|
extern "js" fn js_url_param(name : String) -> String =
  #|(name) => { const v = new URLSearchParams(location.search).get(name); return v == null ? "" : v; }

///|
extern "js" fn js_page_kind() -> String =
  #|() => document.body.getAttribute("data-page") || "home"

///|
extern "js" fn js_media(query : String, f : (Bool) -> Unit) -> Bool =
  #|(q, f) => { const m = matchMedia(q); m.addEventListener("change", (e) => f(e.matches)); return m.matches; }

///|
extern "js" fn js_matches(query : String) -> Bool =
  #|(q) => matchMedia(q).matches

///|
extern "js" fn js_focus(selector : String) -> Unit =
  #|(s) => { const el = document.querySelector(s); if (el) el.focus(); }

///|
extern "js" fn js_navigate(href : String) -> Unit =
  #|(h) => { location.href = h; }

///|
extern "js" fn js_set_theme(theme : String) -> Unit =
  #|(t) => { if (t) document.documentElement.setAttribute("data-theme", t); else document.documentElement.removeAttribute("data-theme"); }

///|
extern "js" fn js_set_root_class(name : String, on : Bool) -> Unit =
  #|(n, on) => document.documentElement.classList.toggle(n, on)

///|
extern "js" fn js_show_dialog(id : String) -> Unit =
  #|(id) => { const d = document.getElementById(id); if (d && !d.open) d.showModal(); }

///|
extern "js" fn js_close_dialog(id : String) -> Unit =
  #|(id) => { const d = document.getElementById(id); if (d && d.open) d.close(); }

///|
extern "js" fn js_on_document(kind : String, f : (@js.Any) -> Unit) -> Unit =
  #|(k, f) => document.addEventListener(k, (e) => f(e))

///|
extern "js" fn js_on(el : @js.Any, kind : String, f : (@js.Any) -> Unit) -> Unit =
  #|(el, k, f) => el.addEventListener(k, (e) => f(e))

///|
extern "js" fn js_closest(target : @js.Any, selector : String) -> Bool =
  #|(t, s) => !!(t && t.closest && t.closest(s))

///|
extern "js" fn js_contains_focus(el : @js.Any) -> Bool =
  #|(el) => !!el && el.contains(document.activeElement)

///|
extern "js" fn js_fullscreen(el : @js.Any) -> Unit =
  #|(el) => { if (document.fullscreenElement) { document.exitFullscreen(); return; } if (document.fullscreenEnabled && el.requestFullscreen) { el.requestFullscreen().catch(() => {}); } }

///|
extern "js" fn js_rect_fraction(el : @js.Any, client_x : Double) -> Double =
  #|(el, x) => { const r = el.getBoundingClientRect(); return r.width > 0 ? Math.min(1, Math.max(0, (x - r.left) / r.width)) : 0; }

///|
extern "js" fn js_capture(el : @js.Any, pointer_id : Int) -> Unit =
  #|(el, id) => { try { el.setPointerCapture(id); } catch (e) {} }

///|
extern "js" fn js_scroll_by(selector : String, dx : Int) -> Unit =
  #|(s, dx) => { const el = document.querySelector(s); if (el) el.scrollBy({ left: dx, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); }

///|
extern "js" fn js_scroll_state(el : @js.Any) -> Int =
  #|(el) => { const max = el.scrollWidth - el.clientWidth; if (max <= 1) return 0; let s = 0; if (el.scrollLeft > 1) s |= 1; if (el.scrollLeft < max - 1) s |= 2; return s | 4; }

///|
extern "js" fn js_copy(text : String) -> Unit =
  #|(t) => { try { navigator.clipboard && navigator.clipboard.writeText(t).catch(() => {}); } catch (e) {} }

///|
extern "js" fn js_set_value(selector : String, value : String) -> Unit =
  #|(s, v) => { const el = document.querySelector(s); if (el) el.value = v; }

///|
extern "js" fn js_key(e : @js.Any) -> String =
  #|(e) => e.key || ""

///|
extern "js" fn js_target_value(e : @js.Any) -> String =
  #|(e) => (e.target && e.target.value) || ""

///|
extern "js" fn js_prevent(e : @js.Any) -> Unit =
  #|(e) => e.preventDefault()

///|
extern "js" fn js_stop(e : @js.Any) -> Unit =
  #|(e) => e.stopPropagation()

///|
extern "js" fn js_mod_key(e : @js.Any) -> Bool =
  #|(e) => !!(e.ctrlKey || e.metaKey || e.altKey)

///|
extern "js" fn js_target_tag(e : @js.Any) -> String =
  #|(e) => { const t = e.target; if (!t || !t.tagName) return ""; const r = t.getAttribute("role"); return r ? r : t.tagName.toLowerCase(); }

///|
extern "js" fn js_client_x(e : @js.Any) -> Double =
  #|(e) => e.clientX || 0

///|
extern "js" fn js_pointer_id(e : @js.Any) -> Int =
  #|(e) => e.pointerId || 0

///|
extern "js" fn js_current_target(e : @js.Any) -> @js.Any =
  #|(e) => e.currentTarget

///|
extern "js" fn js_move_focus(e : @js.Any, selector : String, step : Int) -> Unit =
  #|(e, s, step) => { const items = Array.from(e.currentTarget.querySelectorAll(s)); if (!items.length) return; let i = items.indexOf(document.activeElement); if (step === 100) i = 0; else if (step === -100) i = items.length - 1; else i = (i + step + items.length) % items.length; items[i].focus(); }

///|
fn element_any(el : @dom.Element) -> @js.Any {
  @js.identity(el)
}

///|
fn[T] any_of(x : T) -> @js.Any {
  @js.identity(x)
}
