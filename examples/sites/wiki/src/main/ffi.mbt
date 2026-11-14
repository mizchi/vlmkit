// Browser glue luna does not cover: storage, the URL, media queries, timers, scrolling,
// geometry and native <dialog>. Every storage call is wrapped in try/catch.

///|
extern "js" fn storage_get(key : String) -> String =
  #|(k) => { try { const v = window.localStorage.getItem(k); return v == null ? "" : v } catch (e) { return "" } }

///|
extern "js" fn storage_set(key : String, value : String) -> Unit =
  #|(k, v) => { try { window.localStorage.setItem(k, v) } catch (e) {} }

///|
extern "js" fn query_param(name : String) -> String =
  #|(n) => { try { const v = new URLSearchParams(location.search).get(n); return v == null ? "" : v } catch (e) { return "" } }

///|
extern "js" fn set_root_attr(name : String, value : String) -> Unit =
  #|(n, v) => { document.documentElement.setAttribute(n, v) }

///|
extern "js" fn watch_media(query : String, cb : (Bool) -> Unit) -> Bool =
  #|(q, cb) => { const m = window.matchMedia(q); const f = () => cb(m.matches); if (m.addEventListener) m.addEventListener("change", f); else m.addListener(f); return m.matches }

///|
extern "js" fn get_hash() -> String =
  #|() => location.hash

///|
extern "js" fn set_hash(h : String) -> Unit =
  #|(h) => { location.hash = h }

///|
extern "js" fn on_hashchange(cb : () -> Unit) -> Unit =
  #|(cb) => { window.addEventListener("hashchange", () => cb()) }

///|
extern "js" fn decode_uri(s : String) -> String =
  #|(s) => { try { return decodeURIComponent(s) } catch (e) { return s } }

///|
extern "js" fn encode_uri(s : String) -> String =
  #|(s) => encodeURIComponent(s)

///|
extern "js" fn on_scroll_frame(cb : () -> Unit) -> Unit =
  #|(cb) => { let q = false; const f = () => { if (q) return; q = true; requestAnimationFrame(() => { q = false; cb() }) }; window.addEventListener("scroll", f, { passive: true }); window.addEventListener("resize", f) }

///|
/// Top of the element with this id relative to the viewport; a large number when it is missing
/// or not rendered.
extern "js" fn top_of_id(id : String) -> Double =
  #|(id) => { const e = document.getElementById(id); if (!e || !e.offsetParent) return 1e9; return e.getBoundingClientRect().top }

///|
extern "js" fn viewport_height() -> Double =
  #|() => window.innerHeight

///|
extern "js" fn viewport_width() -> Double =
  #|() => document.documentElement.clientWidth

///|
extern "js" fn page_bottom_reached() -> Bool =
  #|() => window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4

///|
extern "js" fn set_timeout(cb : () -> Unit, ms : Int) -> Int =
  #|(cb, ms) => setTimeout(cb, ms)

///|
extern "js" fn clear_timeout(id : Int) -> Unit =
  #|(id) => clearTimeout(id)

///|
extern "js" fn scroll_to_id(id : String) -> Unit =
  #|(id) => { const e = document.getElementById(id); if (e) e.scrollIntoView({ block: "start" }) }

///|
extern "js" fn scroll_to_top() -> Unit =
  #|() => window.scrollTo(0, 0)

///|
extern "js" fn focus_id(id : String) -> Unit =
  #|(id) => { const e = document.getElementById(id); if (e) e.focus({ preventScroll: true }) }

///|
/// [left, top, bottom, width] of the element in page coordinates, then its bottom in the viewport.
extern "js" fn page_rect(el : @js.Any) -> FixedArray[Double] =
  #|(e) => { const r = e.getBoundingClientRect(); return [r.left + scrollX, r.top + scrollY, r.bottom + scrollY, r.width, r.bottom] }

///|
extern "js" fn dialog_open(el : @js.Any) -> Unit =
  #|(e) => { if (e && !e.open) { try { e.showModal() } catch (x) { e.setAttribute("open", "") } } }

///|
extern "js" fn dialog_close(el : @js.Any) -> Unit =
  #|(e) => { if (e && e.open) e.close() }

///|
extern "js" fn on_doc_keydown(cb : (String) -> Unit) -> Unit =
  #|(cb) => { document.addEventListener("keydown", (e) => cb(e.key)) }

///|
/// Calls cb with true when a pointer press lands outside every element matching `sel`.
extern "js" fn on_outside_press(sel : String, cb : () -> Unit) -> Unit =
  #|(sel, cb) => { document.addEventListener("pointerdown", (e) => { const t = e.target; if (!(t instanceof Element) || !t.closest(sel)) cb() }) }

///|
extern "js" fn on_touch_press(cb : () -> Unit) -> Unit =
  #|(cb) => { document.addEventListener("pointerdown", (e) => { if (e.pointerType === "touch" || e.pointerType === "pen") cb() }, true) }

///|
extern "js" fn prevent(e : @js.Any) -> Unit =
  #|(e) => e.preventDefault()

///|
extern "js" fn ev_key(e : @js.Any) -> String =
  #|(e) => e.key || ""

///|
extern "js" fn ev_value(e : @js.Any) -> String =
  #|(e) => (e.target && e.target.value) || ""

///|
extern "js" fn set_value(el : @js.Any, v : String) -> Unit =
  #|(e, v) => { if (e) e.value = v }

///|
extern "js" fn ev_current(e : @js.Any) -> @js.Any =
  #|(e) => e.currentTarget

///|
extern "js" fn set_doc_title(t : String) -> Unit =
  #|(t) => { document.title = t }

///|
extern "js" fn set_attr(el : @js.Any, name : String, value : String) -> Unit =
  #|(e, n, v) => e.setAttribute(n, v)
