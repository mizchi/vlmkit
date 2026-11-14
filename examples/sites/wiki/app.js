// Built from src/ (MoonBit, mizchi/luna) by `node examples/sites/luna-build.mjs wiki`. Do not edit.
(() => {
  function _M0TP26mizchi7signals15ReactiveContext(param0, param1, param2) {
    this.current_owner = param0;
    this.current_cleanups = param1;
    this.batch_depth = param2;
  }
  function _M0DTPC16option6OptionGRPB5ArrayGWEuEE4None() {}
  _M0DTPC16option6OptionGRPB5ArrayGWEuEE4None.prototype.$tag = 0;
  const _M0DTPC16option6OptionGRPB5ArrayGWEuEE4None__ = new _M0DTPC16option6OptionGRPB5ArrayGWEuEE4None();
  function _M0DTPC16option6OptionGRPB5ArrayGWEuEE4Some(param0) {
    this._0 = param0;
  }
  _M0DTPC16option6OptionGRPB5ArrayGWEuEE4Some.prototype.$tag = 1;
  function _M0TPC13ref3RefGiE(param0) {
    this.val = param0;
  }
  function _M0TPC13ref3RefGbE(param0) {
    this.val = param0;
  }
  function _M0TPC13ref3RefGORP26mizchi8js__core3AnyE(param0) {
    this.val = param0;
  }
  function _M0DTPC16option6OptionGRP26mizchi8js__core3AnyE4None() {}
  _M0DTPC16option6OptionGRP26mizchi8js__core3AnyE4None.prototype.$tag = 0;
  const _M0DTPC16option6OptionGRP26mizchi8js__core3AnyE4None__ = new _M0DTPC16option6OptionGRP26mizchi8js__core3AnyE4None();
  function _M0DTPC16option6OptionGRP26mizchi8js__core3AnyE4Some(param0) {
    this._0 = param0;
  }
  _M0DTPC16option6OptionGRP26mizchi8js__core3AnyE4Some.prototype.$tag = 1;
  function _M0TP314vlmkit_2dsites4wiki4main3Sec(param0, param1, param2, param3, param4) {
    this.id = param0;
    this.title = param1;
    this.paras = param2;
    this.subs = param3;
    this.fig = param4;
  }
  function _M0TP314vlmkit_2dsites4wiki4main3Sub(param0, param1, param2) {
    this.id = param0;
    this.title = param1;
    this.paras = param2;
  }
  function _M0TP314vlmkit_2dsites4wiki4main5Title(param0, param1, param2, param3) {
    this.title = param0;
    this.desc = param1;
    this.extract = param2;
    this.thumb = param3;
  }
  function _M0TP314vlmkit_2dsites4wiki4main6Figure(param0, param1, param2) {
    this.kind = param0;
    this.caption = param1;
    this.alt = param2;
  }
  function _M0TP314vlmkit_2dsites4wiki4main7InfoRow(param0, param1) {
    this.label = param0;
    this.value = param1;
  }
  function _M0TP314vlmkit_2dsites4wiki4main7InfoSec(param0, param1) {
    this.head = param0;
    this.rows = param1;
  }
  function _M0TP314vlmkit_2dsites4wiki4main8Citation(param0) {
    this.text = param0;
  }
  function _M0TP314vlmkit_2dsites4wiki4main6Thread(param0, param1) {
    this.topic = param0;
    this.posts = param1;
  }
  function _M0TP314vlmkit_2dsites4wiki4main8Revision(param0, param1, param2, param3, param4) {
    this.date = param0;
    this.user = param1;
    this.size = param2;
    this.delta = param3;
    this.summary = param4;
  }
  function _M0TPB9ArrayViewGUiiEE(param0, param1, param2) {
    this.buf = param0;
    this.start = param1;
    this.end = param2;
  }
  function _M0DTP314vlmkit_2dsites4wiki4main5Route7Article() {}
  _M0DTP314vlmkit_2dsites4wiki4main5Route7Article.prototype.$tag = 0;
  const _M0DTP314vlmkit_2dsites4wiki4main5Route7Article__ = new _M0DTP314vlmkit_2dsites4wiki4main5Route7Article();
  function _M0DTP314vlmkit_2dsites4wiki4main5Route4Talk() {}
  _M0DTP314vlmkit_2dsites4wiki4main5Route4Talk.prototype.$tag = 1;
  const _M0DTP314vlmkit_2dsites4wiki4main5Route4Talk__ = new _M0DTP314vlmkit_2dsites4wiki4main5Route4Talk();
  function _M0DTP314vlmkit_2dsites4wiki4main5Route6Source() {}
  _M0DTP314vlmkit_2dsites4wiki4main5Route6Source.prototype.$tag = 2;
  const _M0DTP314vlmkit_2dsites4wiki4main5Route6Source__ = new _M0DTP314vlmkit_2dsites4wiki4main5Route6Source();
  function _M0DTP314vlmkit_2dsites4wiki4main5Route7History() {}
  _M0DTP314vlmkit_2dsites4wiki4main5Route7History.prototype.$tag = 3;
  const _M0DTP314vlmkit_2dsites4wiki4main5Route7History__ = new _M0DTP314vlmkit_2dsites4wiki4main5Route7History();
  function _M0DTP314vlmkit_2dsites4wiki4main5Route4Stub(param0) {
    this._0 = param0;
  }
  _M0DTP314vlmkit_2dsites4wiki4main5Route4Stub.prototype.$tag = 4;
  function _M0DTP314vlmkit_2dsites4wiki4main5Route6Search(param0) {
    this._0 = param0;
  }
  _M0DTP314vlmkit_2dsites4wiki4main5Route6Search.prototype.$tag = 5;
  function $oob() {
    throw new Error("Index out of bounds");
  }
  function _M0TPB13StringBuilder(param0) {
    this.val = param0;
  }
  class $PanicError extends Error {}
  function $panic() {
    throw new $PanicError();
  }
  const _M0FPB12random__seed = () => {
    if (globalThis.crypto?.getRandomValues) {
      const array = new Uint32Array(1);
      globalThis.crypto.getRandomValues(array);
      return array[0] | 0; // Convert to signed 32
    } else {
      return Math.floor(Math.random() * 0x100000000) | 0; // Fallback to Math.random
    }
  };
  function _M0TPC16string10StringView(param0, param1, param2) {
    this.str = param0;
    this.start = param1;
    this.end = param2;
  }
  const _M0FPB19int__to__string__js = (x, radix) => {
    return x.toString(radix);
  };
  const _M0FPB22js__code__unit__string = (c) => String.fromCharCode(c);
  const _M0FPB13js__index__of = (s, start, end, p) => {
    if (end - start < p.length) return -1;
    if (end === s.length) return s.indexOf(p, start);
    const i = s.substring(start, end).indexOf(p);
    return i < 0 ? i : start + i;
  };
  function $make_array_len_and_init(a, b) {
    const arr = new Array(a);
    arr.fill(b);
    return arr;
  }
  const _M0FPB13js__substring = (s, start, end) => start === 0 && end === s.length ? s : s.substring(start, end);
  const _M0MPB7JSArray4push = (arr, val) => { arr.push(val); };
  function _M0TPB3MapGiiE(param0, param1, param2, param3, param4, param5, param6) {
    this.entries = param0;
    this.size = param1;
    this.capacity = param2;
    this.capacity_mask = param3;
    this.grow_at = param4;
    this.head = param5;
    this.tail = param6;
  }
  function _M0TPB5EntryGiiE(param0, param1, param2, param3, param4, param5) {
    this.prev = param0;
    this.next = param1;
    this.psl = param2;
    this.hash = param3;
    this.key = param4;
    this.value = param5;
  }
  const _M0MPB7JSArray4copy = (arr) => arr.slice(0);
  function _M0TPB9ArrayViewGRP314vlmkit_2dsites4wiki4main5TitleE(param0, param1, param2) {
    this.buf = param0;
    this.start = param1;
    this.end = param2;
  }
  const _M0MPB7JSArray11set__length = (arr, len) => { arr.length = len; };
  const _M0MPB7JSArray3pop = (arr) => arr.pop();
  const _M0MPB7JSArray6splice = (arr, idx, cnt) => arr.splice(idx, cnt);
  function _M0TPC13ref3RefGRPB5ArrayGRP36mizchi4luna3dom9ItemEntryGiEEE(param0) {
    this.val = param0;
  }
  function _M0TPC13ref3RefGORPB5ArrayGWEuEE(param0) {
    this.val = param0;
  }
  const _M0MP26mizchi8js__core3Any5__get = (obj, key) => obj[key];
  const _M0MP26mizchi8js__core3Any6__call = (obj, key, args) => obj[key](...args);
  const _M0FP26mizchi8js__core11is__nullish = (v) => v == null;
  const _M0MP26mizchi8js__core3Any5__set = (obj, key, value) => { obj[key] = value };
  const _M0FP26mizchi8js__core4null = () => null;
  const _M0FP26mizchi8js__core16ffi__array__from = (v) => Array.from(v);
  function _M0DTPC16option6OptionGRP36mizchi11js__browser3dom7ElementE4None() {}
  _M0DTPC16option6OptionGRP36mizchi11js__browser3dom7ElementE4None.prototype.$tag = 0;
  const _M0DTPC16option6OptionGRP36mizchi11js__browser3dom7ElementE4None__ = new _M0DTPC16option6OptionGRP36mizchi11js__browser3dom7ElementE4None();
  function _M0DTPC16option6OptionGRP36mizchi11js__browser3dom7ElementE4Some(param0) {
    this._0 = param0;
  }
  _M0DTPC16option6OptionGRP36mizchi11js__browser3dom7ElementE4Some.prototype.$tag = 1;
  const _M0FP36mizchi11js__browser3dom8document = () => document;
  const _M0MP36mizchi11js__browser3dom8Document13createElement = (self, tag) => self.createElement(tag);
  const _M0MP36mizchi11js__browser3dom8Document14createTextNode = (self, data) => self.createTextNode(data);
  function _M0TP26mizchi7signals4Link(param0, param1, param2, param3, param4, param5, param6) {
    this.version = param0;
    this.dep = param1;
    this.sub = param2;
    this.prev_sub = param3;
    this.next_sub = param4;
    this.prev_dep = param5;
    this.next_dep = param6;
  }
  function _M0TP26mizchi7signals5Flags(param0) {
    this.value = param0;
  }
  function _M0TP26mizchi7signals12ReactiveNode(param0, param1, param2, param3, param4, param5, param6) {
    this.deps = param0;
    this.deps_tail = param1;
    this.subs = param2;
    this.subs_tail = param3;
    this.flags = param4;
    this.last_modified_cycle = param5;
    this.effect_callback = param6;
  }
  function _M0TP26mizchi7signals10CoreSignalGRP314vlmkit_2dsites4wiki4main5RouteE(param0, param1, param2) {
    this.node = param0;
    this.current_value = param1;
    this.pending_value = param2;
  }
  function _M0TP26mizchi7signals10CoreSignalGORP314vlmkit_2dsites4wiki4main7PreviewE(param0, param1, param2) {
    this.node = param0;
    this.current_value = param1;
    this.pending_value = param2;
  }
  function _M0TP26mizchi7signals10CoreSignalGiE(param0, param1, param2) {
    this.node = param0;
    this.current_value = param1;
    this.pending_value = param2;
  }
  function _M0TP26mizchi7signals10CoreSignalGbE(param0, param1, param2) {
    this.node = param0;
    this.current_value = param1;
    this.pending_value = param2;
  }
  function _M0TP26mizchi7signals6SignalGRP314vlmkit_2dsites4wiki4main5RouteE(param0) {
    this.inner = param0;
  }
  function _M0TP26mizchi7signals6SignalGORP314vlmkit_2dsites4wiki4main7PreviewE(param0) {
    this.inner = param0;
  }
  function _M0TP26mizchi7signals6SignalGiE(param0) {
    this.inner = param0;
  }
  function _M0TP26mizchi7signals6SignalGbE(param0) {
    this.inner = param0;
  }
  const _M0FP26mizchi7signals16queue__microtask = (f) => queueMicrotask(f);
  function _M0TP26mizchi7signals8ComputedGRPB5ArrayGsEE(param0, param1, param2) {
    this.node = param0;
    this.value = param1;
    this.getter = param2;
  }
  function _M0DTPC16option6OptionGRPB5ArrayGsEE4None() {}
  _M0DTPC16option6OptionGRPB5ArrayGsEE4None.prototype.$tag = 0;
  const _M0DTPC16option6OptionGRPB5ArrayGsEE4None__ = new _M0DTPC16option6OptionGRPB5ArrayGsEE4None();
  function _M0DTPC16option6OptionGRPB5ArrayGsEE4Some(param0) {
    this._0 = param0;
  }
  _M0DTPC16option6OptionGRPB5ArrayGsEE4Some.prototype.$tag = 1;
  function _M0TP26mizchi7signals5Owner(param0, param1, param2, param3, param4, param5) {
    this.id = param0;
    this.parent = param1;
    this.children = param2;
    this.cleanups = param3;
    this.disposers = param4;
    this.disposed = param5;
  }
  function _M0DTP36mizchi4luna3dom7DomNode2El(param0) {
    this._0 = param0;
  }
  _M0DTP36mizchi4luna3dom7DomNode2El.prototype.$tag = 0;
  function _M0DTP36mizchi4luna3dom7DomNode3Txt(param0) {
    this._0 = param0;
  }
  _M0DTP36mizchi4luna3dom7DomNode3Txt.prototype.$tag = 1;
  function _M0DTP36mizchi4luna3dom7DomNode3Raw(param0) {
    this._0 = param0;
  }
  _M0DTP36mizchi4luna3dom7DomNode3Raw.prototype.$tag = 2;
  function _M0DTP36mizchi4luna3dom7DomNode6Static(param0) {
    this._0 = param0;
  }
  _M0DTP36mizchi4luna3dom7DomNode6Static.prototype.$tag = 3;
  const _M0FP36mizchi4luna3dom24create__element__ns__ffi = (ns, tag) => document.createElementNS(ns, tag);
  const _M0FP36mizchi4luna3dom21apply__event__handler = (elem, name, handler) => elem.addEventListener(name, handler);
  function _M0TP36mizchi4luna3dom10DomElement(param0) {
    this.inner = param0;
  }
  function _M0DTPC16option6OptionGRP36mizchi11js__browser3dom4NodeE4None() {}
  _M0DTPC16option6OptionGRP36mizchi11js__browser3dom4NodeE4None.prototype.$tag = 0;
  function _M0DTPC16option6OptionGRP36mizchi11js__browser3dom4NodeE4Some(param0) {
    this._0 = param0;
  }
  _M0DTPC16option6OptionGRP36mizchi11js__browser3dom4NodeE4Some.prototype.$tag = 1;
  const _M0FP36mizchi4luna3dom13ref__map__has = (map, key) => map.has(key);
  const _M0FP36mizchi4luna3dom13ref__map__new = () => new Map();
  const _M0FP36mizchi4luna3dom13ref__map__set = (map, key, value) => { map.set(key, value); };
  const _M0FP36mizchi4luna3dom15ref__equal__any = (a, b) => a === b;
  const _M0FP36mizchi4luna3dom25ref__map__get__or__minus1 = (map, key) => {
     const v = map.get(key);
     return v === undefined ? -1 : v;
   };
  const _M0FP36mizchi4luna3dom18move__before__impl = (parent, node, refNode) => {
     if (typeof parent.moveBefore === 'function') {
       try {
         parent.moveBefore(node, refNode);
         return node;
       } catch (e) {
         // moveBefore may fail on SVG elements or in certain DOM hierarchies
         // Fall back to insertBefore
         return parent.insertBefore(node, refNode);
       }
     } else {
       return parent.insertBefore(node, refNode);
     }
   };
  const _M0FP36mizchi4luna3dom24move__before__impl__null = (parent, node) => {
     if (typeof parent.moveBefore === 'function') {
       try {
         parent.moveBefore(node, null);
         return node;
       } catch (e) {
         // moveBefore may fail on SVG elements or in certain DOM hierarchies
         // Fall back to insertBefore
         return parent.insertBefore(node, null);
       }
     } else {
       return parent.insertBefore(node, null);
     }
   };
  const _M0FP36mizchi4luna3dom17next__sibling__is = (node, expected) => node.nextSibling === expected;
  const _M0FP36mizchi4luna3dom19safe__remove__child = (parent, child) => {
     try {
       // Check if the child is actually a child of this parent
       if (child.parentNode === parent) {
         parent.removeChild(child);
       } else if (child.parentNode) {
         // Node was moved to a different parent, remove from there
         child.parentNode.removeChild(child);
       }
       // If child.parentNode is null, node is already detached
     } catch (e) {
       // Ignore errors - node may already be removed or in invalid state
     }
   };
  function _M0TP36mizchi4luna3dom9ItemEntryGRP314vlmkit_2dsites4wiki4main5RouteE(param0, param1, param2, param3, param4) {
    this.item = param0;
    this.dom = param1;
    this.last = param2;
    this.nodes = param3;
    this.dispose = param4;
  }
  function _M0TP36mizchi4luna3dom9ItemEntryGiE(param0, param1, param2, param3, param4) {
    this.item = param0;
    this.dom = param1;
    this.last = param2;
    this.nodes = param3;
    this.dispose = param4;
  }
  function _M0DTP36mizchi4luna3dom9AttrValue6Static(param0) {
    this._0 = param0;
  }
  _M0DTP36mizchi4luna3dom9AttrValue6Static.prototype.$tag = 0;
  function _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(param0) {
    this._0 = param0;
  }
  _M0DTP36mizchi4luna3dom9AttrValue7Dynamic.prototype.$tag = 1;
  function _M0DTP36mizchi4luna3dom9AttrValue7Handler(param0) {
    this._0 = param0;
  }
  _M0DTP36mizchi4luna3dom9AttrValue7Handler.prototype.$tag = 2;
  const _M0FP314vlmkit_2dsites4wiki4main11encode__uri = (s) => encodeURIComponent(s);
  const _M0FP314vlmkit_2dsites4wiki4main12storage__set = (k, v) => { try { window.localStorage.setItem(k, v) } catch (e) {} };
  const _M0FP314vlmkit_2dsites4wiki4main12storage__get = (k) => { try { const v = window.localStorage.getItem(k); return v == null ? "" : v } catch (e) { return "" } };
  const _M0FP314vlmkit_2dsites4wiki4main14clear__timeout = (id) => clearTimeout(id);
  const _M0FP314vlmkit_2dsites4wiki4main12set__timeout = (cb, ms) => setTimeout(cb, ms);
  const _M0FP314vlmkit_2dsites4wiki4main10page__rect = (e) => { const r = e.getBoundingClientRect(); return [r.left + scrollX, r.top + scrollY, r.bottom + scrollY, r.width, r.bottom] };
  const _M0FP314vlmkit_2dsites4wiki4main16viewport__height = () => window.innerHeight;
  const _M0FP314vlmkit_2dsites4wiki4main15viewport__width = () => document.documentElement.clientWidth;
  function _M0TP314vlmkit_2dsites4wiki4main7Preview(param0, param1, param2, param3) {
    this.kind = param0;
    this.x = param1;
    this.y = param2;
    this.above = param3;
  }
  const _M0FP314vlmkit_2dsites4wiki4main11ev__current = (e) => e.currentTarget;
  function _M0DTP314vlmkit_2dsites4wiki4main5PKind5PPage(param0) {
    this._0 = param0;
  }
  _M0DTP314vlmkit_2dsites4wiki4main5PKind5PPage.prototype.$tag = 0;
  function _M0DTP314vlmkit_2dsites4wiki4main5PKind4PRef(param0) {
    this._0 = param0;
  }
  _M0DTP314vlmkit_2dsites4wiki4main5PKind4PRef.prototype.$tag = 1;
  const _M0FP314vlmkit_2dsites4wiki4main11decode__uri = (s) => { try { return decodeURIComponent(s) } catch (e) { return s } };
  const _M0FP314vlmkit_2dsites4wiki4main9get__hash = () => location.hash;
  const _M0FP314vlmkit_2dsites4wiki4main14scroll__to__id = (id) => { const e = document.getElementById(id); if (e) e.scrollIntoView({ block: "start" }) };
  const _M0FP314vlmkit_2dsites4wiki4main15scroll__to__top = () => window.scrollTo(0, 0);
  const _M0FP314vlmkit_2dsites4wiki4main15set__doc__title = (t) => { document.title = t };
  const _M0FP314vlmkit_2dsites4wiki4main9set__hash = (h) => { location.hash = h };
  const _M0FP314vlmkit_2dsites4wiki4main10set__value = (e, v) => { if (e) e.value = v };
  const _M0FP314vlmkit_2dsites4wiki4main7ev__key = (e) => e.key || "";
  const _M0FP314vlmkit_2dsites4wiki4main9ev__value = (e) => (e.target && e.target.value) || "";
  const _M0FP314vlmkit_2dsites4wiki4main9set__attr = (e, n, v) => e.setAttribute(n, v);
  const _M0FP314vlmkit_2dsites4wiki4main7prevent = (e) => e.preventDefault();
  const _M0FP314vlmkit_2dsites4wiki4main9focus__id = (id) => { const e = document.getElementById(id); if (e) e.focus({ preventScroll: true }) };
  const _M0FP314vlmkit_2dsites4wiki4main12dialog__open = (e) => { if (e && !e.open) { try { e.showModal() } catch (x) { e.setAttribute("open", "") } } };
  const _M0FP314vlmkit_2dsites4wiki4main13dialog__close = (e) => { if (e && e.open) e.close() };
  const _M0FP314vlmkit_2dsites4wiki4main21page__bottom__reached = () => window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
  const _M0FP314vlmkit_2dsites4wiki4main11top__of__id = (id) => { const e = document.getElementById(id); if (!e || !e.offsetParent) return 1e9; return e.getBoundingClientRect().top };
  const _M0FP314vlmkit_2dsites4wiki4main16on__doc__keydown = (cb) => { document.addEventListener("keydown", (e) => cb(e.key)) };
  const _M0FP314vlmkit_2dsites4wiki4main14on__hashchange = (cb) => { window.addEventListener("hashchange", () => cb()) };
  const _M0FP314vlmkit_2dsites4wiki4main18on__outside__press = (sel, cb) => { document.addEventListener("pointerdown", (e) => { const t = e.target; if (!(t instanceof Element) || !t.closest(sel)) cb() }) };
  const _M0FP314vlmkit_2dsites4wiki4main17on__scroll__frame = (cb) => { let q = false; const f = () => { if (q) return; q = true; requestAnimationFrame(() => { q = false; cb() }) }; window.addEventListener("scroll", f, { passive: true }); window.addEventListener("resize", f) };
  const _M0FP314vlmkit_2dsites4wiki4main16on__touch__press = (cb) => { document.addEventListener("pointerdown", (e) => { if (e.pointerType === "touch" || e.pointerType === "pen") cb() }, true) };
  const _M0FP314vlmkit_2dsites4wiki4main12query__param = (n) => { try { const v = new URLSearchParams(location.search).get(n); return v == null ? "" : v } catch (e) { return "" } };
  const _M0FP314vlmkit_2dsites4wiki4main15set__root__attr = (n, v) => { document.documentElement.setAttribute(n, v) };
  const _M0FP314vlmkit_2dsites4wiki4main12watch__media = (q, cb) => { const m = window.matchMedia(q); const f = () => cb(m.matches); if (m.addEventListener) m.addEventListener("change", f); else m.addListener(f); return m.matches };
  const _M0FP092moonbitlang_2fcore_2fbuiltin_2fStringBuilder_24as_24_40moonbitlang_2fcore_2fbuiltin_2eLogger = { method_0: _M0IPB13StringBuilderPB6Logger13write__string, method_1: _M0IP016_24default__implPB6Logger16write__substringGRPB13StringBuilderE, method_2: _M0IPB13StringBuilderPB6Logger11write__view, method_3: _M0IPB13StringBuilderPB6Logger11write__char, method_4: _M0IP016_24default__implPB6Logger28write__string__interpolationGRPB13StringBuilderE, method_5: _M0IP016_24default__implPB6Logger5writeGRPB13StringBuilderE };
  const _M0FP26mizchi7signals17reactive__context = new _M0TP26mizchi7signals15ReactiveContext(undefined, _M0DTPC16option6OptionGRPB5ArrayGWEuEE4None__, 0);
  const _M0FP26mizchi7signals15callback__queue = [];
  const _M0FP26mizchi7signals22callback__queue__nodes = [];
  const _M0FP36mizchi4luna3dom7svg__ns = "http://www.w3.org/2000/svg";
  const _M0FP314vlmkit_2dsites4wiki4main12toast__timer = new _M0TPC13ref3RefGiE(-1);
  const _M0FP314vlmkit_2dsites4wiki4main11show__timer = new _M0TPC13ref3RefGiE(-1);
  const _M0FP314vlmkit_2dsites4wiki4main11hide__timer = new _M0TPC13ref3RefGiE(-1);
  const _M0FP314vlmkit_2dsites4wiki4main13touch__recent = new _M0TPC13ref3RefGbE(false);
  const _M0FP314vlmkit_2dsites4wiki4main13search__input = new _M0TPC13ref3RefGORP26mizchi8js__core3AnyE(_M0DTPC16option6OptionGRP26mizchi8js__core3AnyE4None__);
  const _M0FP314vlmkit_2dsites4wiki4main12lang__dialog = new _M0TPC13ref3RefGORP26mizchi8js__core3AnyE(_M0DTPC16option6OptionGRP26mizchi8js__core3AnyE4None__);
  const _M0FP314vlmkit_2dsites4wiki4main11lang__input = new _M0TPC13ref3RefGORP26mizchi8js__core3AnyE(_M0DTPC16option6OptionGRP26mizchi8js__core3AnyE4None__);
  const _M0FP314vlmkit_2dsites4wiki4main13media__dialog = new _M0TPC13ref3RefGORP26mizchi8js__core3AnyE(_M0DTPC16option6OptionGRP26mizchi8js__core3AnyE4None__);
  const _M0FP314vlmkit_2dsites4wiki4main9toc__open = [];
  const _M0FP314vlmkit_2dsites4wiki4main8sectionsN7_2abindS1879 = "Name_and_etymology";
  const _M0FP314vlmkit_2dsites4wiki4main8sectionsN7_2abindS1880 = "Name and etymology";
  const _M0FP314vlmkit_2dsites4wiki4main8sectionsN7_2abindS1881 = "Formation_and_evolution";
  const _M0FP314vlmkit_2dsites4wiki4main8sectionsN7_2abindS1882 = "Formation and evolution";
  const _M0FP314vlmkit_2dsites4wiki4main8sectionsN7_2abindS1883 = "Physical_characteristics";
  const _M0FP314vlmkit_2dsites4wiki4main8sectionsN7_2abindS1884 = "Physical characteristics";
  const _M0FP314vlmkit_2dsites4wiki4main8sectionsN7_2abindS1885 = "Orbit_and_rotation";
  const _M0FP314vlmkit_2dsites4wiki4main8sectionsN7_2abindS1886 = "Orbit and rotation";
  const _M0FP314vlmkit_2dsites4wiki4main8sectionsN7_2abindS1887 = "Effect_on_Earth";
  const _M0FP314vlmkit_2dsites4wiki4main8sectionsN7_2abindS1888 = "Effect on Earth";
  const _M0FP314vlmkit_2dsites4wiki4main8sectionsN7_2abindS1889 = "Observation";
  const _M0FP314vlmkit_2dsites4wiki4main8sectionsN7_2abindS1890 = "Observation";
  const _M0FP314vlmkit_2dsites4wiki4main8sectionsN7_2abindS1891 = "Exploration";
  const _M0FP314vlmkit_2dsites4wiki4main8sectionsN7_2abindS1892 = "Exploration";
  const _M0FP314vlmkit_2dsites4wiki4main8sectionsN7_2abindS1893 = "In_culture";
  const _M0FP314vlmkit_2dsites4wiki4main8sectionsN7_2abindS1894 = "In culture";
  const _bind = ["The English word //moon// descends from an old Germanic root shared with the word for //month//, a reminder that the two were once the same measure. Both trace back to an older word meaning 'to measure', since the Moon's cycle was among the first clocks people kept.{4}", "Scholarly writing uses the adjective //lunar//, from the Latin name of the Moon, and occasionally //selenic//, from the Greek. The study of the Moon's surface is accordingly called [[Selenography|selenography]], and a point in a lunar orbit closest to the Moon is a perilune. Because many planets have moons of their own, astronomers capitalise the name when they mean Earth's companion, and sometimes call it by its catalogue designation, Earth I."];
  const _bind$2 = [];
  const _tmp = new _M0TP314vlmkit_2dsites4wiki4main3Sec(_M0FP314vlmkit_2dsites4wiki4main8sectionsN7_2abindS1879, _M0FP314vlmkit_2dsites4wiki4main8sectionsN7_2abindS1880, _bind, _bind$2, -1);
  const _bind$3 = ["Any account of the Moon's origin has to explain three facts: its rocks have almost the same isotopic make-up as Earth's mantle, it has a very small iron core, and the Earth–Moon pair carries an unusually large amount of angular momentum."];
  const _bind$4 = [new _M0TP314vlmkit_2dsites4wiki4main3Sub("Giant_impact", "Giant impact", ["The [[Giant-impact hypothesis|giant-impact hypothesis]] proposes that, a few tens of millions of years after the planets began to form, a Mars-sized body collided with Earth at a glancing angle. The impact melted and vaporised much of both bodies' outer layers, and a disc of hot rock gathered in orbit around the damaged planet.{3} Within perhaps a century the material in that disc had collected into a single moon.", "Computer models of the collision reproduce the Moon's small core and its share of angular momentum, but early versions predicted a Moon made mostly of the impactor, which does not match the close isotopic match with Earth. Later models favour a more energetic impact that thoroughly mixed the two bodies, or a series of smaller collisions.{5}"]), new _M0TP314vlmkit_2dsites4wiki4main3Sub("Later_evolution", "Later evolution", ["The young Moon was covered by an ocean of molten rock hundreds of kilometres deep. As it cooled, dense minerals sank and light, calcium-rich crystals floated to the top, forming the pale crust of the highlands from a rock called [[Anorthosite|anorthosite]]. This separation into layers is an example of [[Planetary differentiation|planetary differentiation]].{6}", "For the next several hundred million years the surface was struck repeatedly by asteroids, carving the great basins. Heat from radioactive elements later melted pockets of the interior, and lava rose through the fractured basin floors to flood them. These eruptions, which were most active between about 3.8 and 3.1 billion years ago, produced the dark [[Basalt|basalt]] of the maria. Since then the Moon has changed only through impacts and the slow grinding of its surface into dust."])];
  const _tmp$2 = new _M0TP314vlmkit_2dsites4wiki4main3Sec(_M0FP314vlmkit_2dsites4wiki4main8sectionsN7_2abindS1881, _M0FP314vlmkit_2dsites4wiki4main8sectionsN7_2abindS1882, _bind$3, _bind$4, -1);
  const _bind$5 = ["The Moon is a nearly round body with a mean radius of 1,737 kilometres, slightly more than a quarter of Earth's. Its mass is about 1.2 per cent of Earth's, so the surface gravity is only about a sixth as strong: a person who can jump half a metre on Earth could clear three metres there.{7}"];
  const _bind$6 = [new _M0TP314vlmkit_2dsites4wiki4main3Sub("Internal_structure", "Internal structure", ["Like Earth, the Moon is divided into a crust, a mantle and a core. The crust averages roughly 40 kilometres thick and is thicker on the far side than on the near side. The mantle makes up most of the volume, and seismic readings from instruments left on the surface suggest that its lowest part may be partly molten.{8}", "The core is small, with a radius of perhaps 350 kilometres, and probably consists of a solid iron-rich centre wrapped in a fluid layer. The Moon has no global magnetic field today, but magnetised rocks show that it once generated one. Occasional shallow [[Moonquake|moonquakes]], some lasting for many minutes, are still recorded, caused by tidal stress and by the slow cooling and shrinking of the interior."]), new _M0TP314vlmkit_2dsites4wiki4main3Sub("Surface", "Surface", ["Almost every part of the surface is marked by [[Impact crater|impact craters]], from basins more than 2,000 kilometres across to pits smaller than a grain of sand. With no wind or rain to erase them, craters survive for billions of years, so counting them is one of the main ways of dating a region: the more craters, the older the ground.{9}", "The surface is blanketed by [[Regolith|regolith]], a layer of loose, sharp-edged fragments and fine dust made by countless small impacts. It is a few metres deep on the maria and deeper in the highlands. The dust clings to everything; it scratched visors, jammed seals and caused hay-fever-like symptoms in astronauts who carried it back into their cabins."]), new _M0TP314vlmkit_2dsites4wiki4main3Sub("Atmosphere_and_water", "Atmosphere and water", ["The Moon has no atmosphere in the everyday sense. What surrounds it is an [[Exosphere|exosphere]] so thin that its atoms rarely collide with one another; its total mass is estimated at less than ten tonnes. Without the shelter of air, the surface swings from about 127 °C in the lunar day to −173 °C at night.{10}", "Craters near the poles have floors that sunlight has not reached for billions of years and are among the coldest places measured in the Solar System. Several orbiting instruments have found signs that these craters hold water ice, and small amounts of water are also bound into the soil elsewhere.{11} [[Lunar water]] is valued as a possible source of drinking water, oxygen and rocket fuel for future visitors."])];
  const _tmp$3 = new _M0TP314vlmkit_2dsites4wiki4main3Sec(_M0FP314vlmkit_2dsites4wiki4main8sectionsN7_2abindS1883, _M0FP314vlmkit_2dsites4wiki4main8sectionsN7_2abindS1884, _bind$5, _bind$6, -1);
  const _bind$7 = ["The Moon's orbit is slightly elliptical, bringing it as close as about 363,000 kilometres at perigee and as far as 405,000 kilometres at apogee, the two [[Apsis|apsides]] of its path. Its orbital plane is tilted by about five degrees to the plane of Earth's orbit around the Sun.{12}"];
  const _bind$8 = [new _M0TP314vlmkit_2dsites4wiki4main3Sub("Tidal_locking", "Tidal locking", ["Earth's gravity long ago slowed the Moon's spin until one rotation took exactly as long as one orbit. As a result only one hemisphere, the near side, is ever seen from Earth. Because the orbit is not quite circular and is tilted, the Moon appears to rock slightly from side to side and up and down, an effect called [[Libration|libration]] that lets observers see about 59 per cent of the surface over time.{1}", "The hemisphere that always faces away, the [[Far side of the Moon|far side]], is sometimes wrongly called the dark side. It receives just as much sunlight; it is simply never visible from Earth, and it was first photographed by a spacecraft only in the middle of the twentieth century."]), new _M0TP314vlmkit_2dsites4wiki4main3Sub("Phases", "Phases", ["Half of the Moon is always lit by the Sun, but the share of that half we can see changes as the Moon moves around Earth. At new moon the lit side faces away and the Moon is lost in the Sun's glare; it then grows through crescent, first quarter and gibbous to full, and shrinks back again.{2} A full cycle of [[Lunar phase|phases]] takes 29.5 days, two days longer than the orbit itself, because Earth has moved along its own path around the Sun in the meantime.", "When the Moon is a thin crescent, the unlit part is often faintly visible. This glow, called [[Earthshine|earthshine]], is sunlight reflected from Earth's clouds and oceans onto the Moon and back again."]), new _M0TP314vlmkit_2dsites4wiki4main3Sub("Eclipses", "Eclipses", ["By coincidence, the Sun is about 400 times wider than the Moon and also about 400 times farther away, so the two appear almost exactly the same size in the sky. When the Moon passes directly between Earth and the Sun it can cover the solar disc completely, producing a total [[Solar eclipse|solar eclipse]] in which the faint outer atmosphere of the Sun becomes visible.{13}", "When Earth passes between the Sun and the full Moon, the Moon moves into Earth's shadow. During a total [[Lunar eclipse|lunar eclipse]] it does not vanish but turns a deep copper red, lit only by sunlight that has been bent and filtered through Earth's atmosphere. Because the lunar orbit is tilted, eclipses do not happen every month but only when a new or full moon falls near one of the two points where the orbits cross."])];
  const _tmp$4 = new _M0TP314vlmkit_2dsites4wiki4main3Sec(_M0FP314vlmkit_2dsites4wiki4main8sectionsN7_2abindS1885, _M0FP314vlmkit_2dsites4wiki4main8sectionsN7_2abindS1886, _bind$7, _bind$8, 0);
  const _bind$9 = ["The pull of the Moon is stronger on the side of Earth facing it than on the far side, and the difference stretches the planet slightly along the line between them. The oceans respond most visibly, rising in two bulges that the rotating Earth carries each place through twice a day: the [[Tide|tides]].{14} The Sun raises tides as well, a little under half as strong; when the two pull in line, at new and full moon, the range between high and low water is greatest.", "Friction between the tidal bulges and the turning Earth acts as a brake. The day lengthens by about two milliseconds each century, and the angular momentum Earth loses is passed to the Moon, which drifts outward by nearly four centimetres a year. The Moon's steady pull also limits wobbles in the tilt of Earth's axis, which may have helped keep the planet's climate more stable over long periods."];
  const _bind$10 = [];
  const _tmp$5 = new _M0TP314vlmkit_2dsites4wiki4main3Sec(_M0FP314vlmkit_2dsites4wiki4main8sectionsN7_2abindS1887, _M0FP314vlmkit_2dsites4wiki4main8sectionsN7_2abindS1888, _bind$9, _bind$10, -1);
  const _bind$11 = ["The Moon is easy to observe and rewarding at every level of equipment. Its brightness varies greatly with phase: the full Moon is roughly ten times brighter than the half Moon, because at full phase the shadows between grains of soil disappear."];
  const _bind$12 = [new _M0TP314vlmkit_2dsites4wiki4main3Sub("Naked-eye_features", "Naked-eye features", ["Without any optical aid, the maria and the brighter highlands are plainly visible, along with the bright rays that spread from a few young craters. The Moon also looks larger near the horizon than high in the sky, although its measured size barely changes; this is an illusion of perception rather than of the atmosphere.{15}"]), new _M0TP314vlmkit_2dsites4wiki4main3Sub("Telescopic_study", "Telescopic study", ["The first drawings of the Moon made with a [[Telescope|telescope]] showed mountains and craters and helped to overturn the old belief that the heavens were made of perfect, unblemished spheres. Even a small instrument reveals thousands of craters, long valleys called rilles and the shadows of mountains at the line between day and night, where the low sunlight exaggerates every slope.", "Mapping and naming these features became the work of [[Selenography|selenography]]. By convention, maria carry Latin names for weather and states of mind, such as calm, rains or serenity, and craters are named after scientists, scholars and explorers."])];
  const _tmp$6 = new _M0TP314vlmkit_2dsites4wiki4main3Sec(_M0FP314vlmkit_2dsites4wiki4main8sectionsN7_2abindS1889, _M0FP314vlmkit_2dsites4wiki4main8sectionsN7_2abindS1890, _bind$11, _bind$12, -1);
  const _bind$13 = ["The Moon was the first world beyond Earth to be reached by spacecraft. Exploration began with simple impactors and fly-bys and moved quickly to orbiters, landers and finally crewed expeditions."];
  const _bind$14 = [new _M0TP314vlmkit_2dsites4wiki4main3Sub("Robotic_missions", "Robotic missions", ["Early [[Space probe|space probes]] returned the first close views of the surface, the first images of the far side and the first soft landings, which showed that the ground would bear the weight of a spacecraft. Later orbiters mapped the whole globe in detail, measured its gravity field and searched for ice in the shadowed polar craters.{16}", "Since the 2000s several space agencies have flown orbiters, landers and small rovers, including the first landing on the far side and the first return of samples in decades. Much current interest centres on the [[Lunar south pole|lunar south pole]], where ice and near-constant sunlight on some crater rims could support a long-term outpost."]), new _M0TP314vlmkit_2dsites4wiki4main3Sub("Crewed_landings", "Crewed landings", ["Between 1969 and 1972, twelve astronauts walked on the Moon during six landings. They set up experiments, drove electric rovers across the plains and brought back about 382 kilograms of rock and soil, which are still being studied with instruments that did not exist at the time.{8}", "No one has returned since, but several programmes now plan to land crews again, this time near the south pole, and to build orbiting stations and surface habitats that could be visited for weeks or months at a time."])];
  const _tmp$7 = new _M0TP314vlmkit_2dsites4wiki4main3Sec(_M0FP314vlmkit_2dsites4wiki4main8sectionsN7_2abindS1891, _M0FP314vlmkit_2dsites4wiki4main8sectionsN7_2abindS1892, _bind$13, _bind$14, 1);
  const _bind$15 = ["The Moon's regular cycle made it one of humanity's earliest timekeepers. Many societies counted months from one new moon to the next, and a [[Lunar calendar|lunar calendar]] still sets the dates of several religious festivals and new-year celebrations.{4}", "In myth and art the Moon has been a god and a goddess, a lantern, a mirror and a silver boat. Stories of a figure in the Moon differ from place to place: a man with a bundle of sticks in one tradition, a rabbit pounding grain in another. The Moon has long been linked with madness, with love and with the passing of time, and it remains one of the most frequent images in poetry and song."];
  const _bind$16 = [];
  const _M0FP314vlmkit_2dsites4wiki4main8sections = [_tmp, _tmp$2, _tmp$3, _tmp$4, _tmp$5, _tmp$6, _tmp$7, new _M0TP314vlmkit_2dsites4wiki4main3Sec(_M0FP314vlmkit_2dsites4wiki4main8sectionsN7_2abindS1893, _M0FP314vlmkit_2dsites4wiki4main8sectionsN7_2abindS1894, _bind$15, _bind$16, -1)];
  const _M0FP314vlmkit_2dsites4wiki4main9acc__open = [];
  const _M0FP314vlmkit_2dsites4wiki4main9back__ids = ["See_also", "References", "External_links"];
  const _M0FP314vlmkit_2dsites4wiki4main12back__titles = ["See also", "References", "External links"];
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1913 = "Moon";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1914 = "Natural satellite of Earth";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1915 = "moon";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1916 = "The Moon is Earth's only natural satellite. It orbits at an average distance of about 384,400 km and always shows the same face.";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1917 = "Earth";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1918 = "Third planet from the Sun";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1919 = "earth";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1920 = "Earth is the third planet from the Sun and the only one known to hold liquid water on its surface. It is orbited by a single large moon.";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1921 = "Sun";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1922 = "Star at the centre of the Solar System";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1923 = "sun";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1924 = "The Sun is the star around which Earth and the other planets orbit. Its light, reflected by the Moon, is what makes moonlight.";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1925 = "Natural satellite";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1926 = "Body that orbits a planet or smaller body";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1927 = "orbit";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1928 = "A natural satellite is a body that orbits a planet, dwarf planet or asteroid. Hundreds are known in the Solar System.";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1929 = "Tide";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1930 = "Rise and fall of sea levels";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1931 = "wave";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1932 = "Tides are the regular rise and fall of the sea. They are raised mainly by the Moon's gravity, and to a lesser extent by the Sun's.";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1933 = "Tidal locking";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1934 = "Rotation matched to an orbital period";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1935 = "orbit";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1936 = "Tidal locking is the state in which a body turns once on its axis for every orbit. A locked moon always shows the same face to its planet.";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1937 = "Lunar phase";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1938 = "The Moon's changing lit shape";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1939 = "phase";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1940 = "The lunar phase is the shape of the sunlit part of the Moon as seen from Earth. A full cycle of phases takes about 29.5 days.";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1941 = "Solar eclipse";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1942 = "The Moon passing in front of the Sun";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1943 = "eclipse";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1944 = "A solar eclipse happens when the Moon passes between Earth and the Sun. In a total eclipse the Sun's faint outer atmosphere becomes visible.";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1945 = "Lunar eclipse";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1946 = "The Moon passing into Earth's shadow";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1947 = "blood";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1948 = "A lunar eclipse happens when the full Moon moves into Earth's shadow. During totality the Moon glows a coppery red.";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1949 = "Impact crater";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1950 = "Depression made by a collision";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1951 = "crater";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1952 = "An impact crater is a bowl-shaped hollow made when a smaller body strikes a larger one. The Moon's surface is covered in them.";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1953 = "Lunar mare";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1954 = "Dark basaltic plain on the Moon";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1955 = "mare";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1956 = "A lunar mare is a broad, dark plain of solidified lava. Early observers mistook the maria for seas, and the name stuck.";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1957 = "Regolith";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1958 = "Loose layer of broken rock and dust";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1959 = "rock";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1960 = "Regolith is the loose layer of dust and broken rock that covers solid bedrock. On the Moon it was made by billions of years of small impacts.";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1961 = "Giant-impact hypothesis";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1962 = "Leading model of the Moon's origin";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1963 = "impact";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1964 = "The giant-impact hypothesis holds that the Moon formed from debris of a collision between the young Earth and a Mars-sized body. It explains the Moon's small core and Earth-like rocks.";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1965 = "Orbit";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1966 = "Curved path of one body around another";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1967 = "orbit";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1968 = "An orbit is the curved path that one body follows around another under gravity. The Moon's orbit around Earth is a slightly stretched ellipse.";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1969 = "Lunar calendar";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1970 = "Calendar based on the Moon's phases";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1971 = "calendar";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1972 = "A lunar calendar counts months by the cycle of the Moon's phases. Several religious and civil calendars still use one.";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1973 = "Apsis";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1974 = "Nearest or farthest point of an orbit";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1975 = "orbit";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1976 = "An apsis is the point at which an orbiting body is nearest to or farthest from the body it orbits. For the Moon these are perigee and apogee.";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1977 = "Libration";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1978 = "Apparent wobble of the Moon";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1979 = "moon";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1980 = "Libration is the slight rocking motion of the Moon as seen from Earth. It lets observers see a little more than half of the surface over time.";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1981 = "Selenography";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1982 = "Study of the Moon's surface features";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1983 = "map";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1984 = "Selenography is the mapping and description of the Moon's surface. Its name comes from the Greek word for the Moon.";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1985 = "Planetary differentiation";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1986 = "Separation of a body into layers";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1987 = "layers";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1988 = "Planetary differentiation is the process by which a molten body separates into layers of different density. It gave the Moon its crust, mantle and core.";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1989 = "Basalt";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1990 = "Fine-grained volcanic rock";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1991 = "rock";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1992 = "Basalt is a dark, fine-grained rock formed from cooled lava. It makes up the floors of the lunar maria.";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1993 = "Anorthosite";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1994 = "Pale rock of the lunar highlands";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1995 = "rock";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1996 = "Anorthosite is a pale rock made mostly of a calcium-rich mineral. It forms the bright crust of the Moon's highlands.";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1997 = "Far side of the Moon";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1998 = "Hemisphere never seen from Earth";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1999 = "farside";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS2000 = "The far side of the Moon is the hemisphere that always faces away from Earth. It is more heavily cratered and has very few maria.";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS2001 = "Lunar south pole";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS2002 = "Region of permanent shadow and ice";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS2003 = "crater";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS2004 = "The lunar south pole is a region of deep craters whose floors never see sunlight. It is thought to hold water ice.";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS2005 = "Lunar water";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS2006 = "Ice and water bound in lunar soil";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS2007 = "ice";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS2008 = "Lunar water is water present on the Moon as ice in shadowed craters and bound in the soil. It could one day supply visitors with water and fuel.";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS2009 = "Exosphere";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS2010 = "Extremely thin outer atmosphere";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS2011 = "moon";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS2012 = "An exosphere is an atmosphere so thin that its atoms rarely meet. The Moon's has a total mass of only a few tonnes.";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS2013 = "Earthshine";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS2014 = "Sunlight reflected from Earth onto the Moon";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS2015 = "phase";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS2016 = "Earthshine is the faint glow on the dark part of a crescent Moon. It is sunlight reflected from Earth onto the Moon and back again.";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS2017 = "Telescope";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS2018 = "Instrument for viewing distant objects";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS2019 = "telescope";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS2020 = "A telescope gathers and focuses light to show distant objects in more detail. Some of the first telescopic drawings were of the Moon.";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS2021 = "Space probe";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS2022 = "Uncrewed spacecraft sent beyond Earth";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS2023 = "probe";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS2024 = "A space probe is an uncrewed spacecraft sent to study other worlds. Probes were the first visitors to the Moon.";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS2025 = "Lunar month";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS2026 = "Time between two new moons";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS2027 = "calendar";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS2028 = "A lunar month is the time between two successive new moons, about 29.5 days. It is the basis of the lunar calendar.";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS2029 = "Moonquake";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS2030 = "Seismic tremor on the Moon";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS2031 = "wave";
  const _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS2032 = "A moonquake is a tremor in the Moon's crust. Some last far longer than earthquakes, because the dry rock rings like a bell.";
  const _M0FP314vlmkit_2dsites4wiki4main6titles = [new _M0TP314vlmkit_2dsites4wiki4main5Title(_M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1913, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1914, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1916, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1915), new _M0TP314vlmkit_2dsites4wiki4main5Title(_M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1917, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1918, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1920, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1919), new _M0TP314vlmkit_2dsites4wiki4main5Title(_M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1921, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1922, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1924, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1923), new _M0TP314vlmkit_2dsites4wiki4main5Title(_M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1925, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1926, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1928, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1927), new _M0TP314vlmkit_2dsites4wiki4main5Title(_M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1929, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1930, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1932, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1931), new _M0TP314vlmkit_2dsites4wiki4main5Title(_M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1933, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1934, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1936, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1935), new _M0TP314vlmkit_2dsites4wiki4main5Title(_M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1937, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1938, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1940, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1939), new _M0TP314vlmkit_2dsites4wiki4main5Title(_M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1941, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1942, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1944, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1943), new _M0TP314vlmkit_2dsites4wiki4main5Title(_M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1945, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1946, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1948, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1947), new _M0TP314vlmkit_2dsites4wiki4main5Title(_M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1949, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1950, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1952, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1951), new _M0TP314vlmkit_2dsites4wiki4main5Title(_M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1953, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1954, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1956, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1955), new _M0TP314vlmkit_2dsites4wiki4main5Title(_M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1957, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1958, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1960, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1959), new _M0TP314vlmkit_2dsites4wiki4main5Title(_M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1961, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1962, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1964, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1963), new _M0TP314vlmkit_2dsites4wiki4main5Title(_M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1965, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1966, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1968, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1967), new _M0TP314vlmkit_2dsites4wiki4main5Title(_M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1969, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1970, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1972, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1971), new _M0TP314vlmkit_2dsites4wiki4main5Title(_M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1973, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1974, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1976, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1975), new _M0TP314vlmkit_2dsites4wiki4main5Title(_M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1977, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1978, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1980, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1979), new _M0TP314vlmkit_2dsites4wiki4main5Title(_M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1981, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1982, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1984, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1983), new _M0TP314vlmkit_2dsites4wiki4main5Title(_M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1985, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1986, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1988, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1987), new _M0TP314vlmkit_2dsites4wiki4main5Title(_M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1989, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1990, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1992, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1991), new _M0TP314vlmkit_2dsites4wiki4main5Title(_M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1993, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1994, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1996, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1995), new _M0TP314vlmkit_2dsites4wiki4main5Title(_M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1997, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1998, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS2000, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS1999), new _M0TP314vlmkit_2dsites4wiki4main5Title(_M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS2001, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS2002, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS2004, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS2003), new _M0TP314vlmkit_2dsites4wiki4main5Title(_M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS2005, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS2006, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS2008, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS2007), new _M0TP314vlmkit_2dsites4wiki4main5Title(_M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS2009, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS2010, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS2012, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS2011), new _M0TP314vlmkit_2dsites4wiki4main5Title(_M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS2013, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS2014, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS2016, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS2015), new _M0TP314vlmkit_2dsites4wiki4main5Title(_M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS2017, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS2018, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS2020, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS2019), new _M0TP314vlmkit_2dsites4wiki4main5Title(_M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS2021, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS2022, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS2024, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS2023), new _M0TP314vlmkit_2dsites4wiki4main5Title(_M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS2025, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS2026, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS2028, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS2027), new _M0TP314vlmkit_2dsites4wiki4main5Title(_M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS2029, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS2030, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS2032, _M0FP314vlmkit_2dsites4wiki4main6titlesN7_2abindS2031)];
  const _M0FP314vlmkit_2dsites4wiki4main9languages = ["Aurenne", "Belisk", "Brannic", "Caldish", "Corvane", "Dravic", "Elunni", "Eskaro", "Fenmarri", "Galoric", "Harrowese", "Ilvaran", "Istrel", "Jorvic", "Kessane", "Lorvish", "Lumbrese", "Marrish", "Mirandese", "Nevari", "Nordavi", "Orlandic", "Ostrene", "Pellish", "Praxian", "Quenti", "Quillon", "Rhovan", "Ruvessic", "Saquenti", "Selvane", "Sorvish", "Tavenic", "Thaloric", "Tirelli", "Umbric", "Vashti", "Velorian", "Wendic", "Yarrovan", "Zelandic"];
  const _M0FP314vlmkit_2dsites4wiki4main7figuresN6recordS2033 = new _M0TP314vlmkit_2dsites4wiki4main6Figure("phases", "The Moon's phases over one lunar month, from new moon (left) through full moon to the last crescent.", "Eight discs in a row, lit from the right, growing from a thin crescent to a full disc and shrinking back");
  const _M0FP314vlmkit_2dsites4wiki4main7figuresN6recordS2034 = new _M0TP314vlmkit_2dsites4wiki4main6Figure("earthrise", "Earth rising over the lunar horizon, as a crew in orbit would see it.", "A blue and white Earth, half lit, above the grey curved horizon of the Moon against black space");
  const _M0FP314vlmkit_2dsites4wiki4main7figuresN6recordS2035 = new _M0TP314vlmkit_2dsites4wiki4main6Figure("moon", "The near side of the Moon at full phase, with the dark maria and the bright rayed highlands.", "A grey disc with darker patches on its upper half and lighter, cratered ground below");
  const _M0FP314vlmkit_2dsites4wiki4main7figures = [_M0FP314vlmkit_2dsites4wiki4main7figuresN6recordS2033, _M0FP314vlmkit_2dsites4wiki4main7figuresN6recordS2034, _M0FP314vlmkit_2dsites4wiki4main7figuresN6recordS2035];
  const _M0FP314vlmkit_2dsites4wiki4main7infoboxN6recordS2036 = new _M0TP314vlmkit_2dsites4wiki4main7InfoRow("Designation", "Earth I");
  const _M0FP314vlmkit_2dsites4wiki4main7infoboxN6recordS2037 = new _M0TP314vlmkit_2dsites4wiki4main7InfoRow("Adjectives", "Lunar, selenic");
  const _M0FP314vlmkit_2dsites4wiki4main7infoboxN6recordS2038 = new _M0TP314vlmkit_2dsites4wiki4main7InfoRow("Symbol", "☾");
  const _M0FP314vlmkit_2dsites4wiki4main7infoboxN6recordS2039 = new _M0TP314vlmkit_2dsites4wiki4main7InfoRow("Epoch", "J2000");
  const _M0FP314vlmkit_2dsites4wiki4main7infoboxN6recordS2040 = new _M0TP314vlmkit_2dsites4wiki4main7InfoRow("Perigee", "363,300 km");
  const _M0FP314vlmkit_2dsites4wiki4main7infoboxN6recordS2041 = new _M0TP314vlmkit_2dsites4wiki4main7InfoRow("Apogee", "405,500 km");
  const _M0FP314vlmkit_2dsites4wiki4main7infoboxN6recordS2042 = new _M0TP314vlmkit_2dsites4wiki4main7InfoRow("Semi-major axis", "384,399 km");
  const _M0FP314vlmkit_2dsites4wiki4main7infoboxN6recordS2043 = new _M0TP314vlmkit_2dsites4wiki4main7InfoRow("Eccentricity", "0.0549");
  const _M0FP314vlmkit_2dsites4wiki4main7infoboxN6recordS2044 = new _M0TP314vlmkit_2dsites4wiki4main7InfoRow("Orbital period", "27.32 days (sidereal)");
  const _M0FP314vlmkit_2dsites4wiki4main7infoboxN6recordS2045 = new _M0TP314vlmkit_2dsites4wiki4main7InfoRow("Synodic period", "29.53 days");
  const _M0FP314vlmkit_2dsites4wiki4main7infoboxN6recordS2046 = new _M0TP314vlmkit_2dsites4wiki4main7InfoRow("Inclination", "5.145° to the ecliptic");
  const _M0FP314vlmkit_2dsites4wiki4main7infoboxN6recordS2047 = new _M0TP314vlmkit_2dsites4wiki4main7InfoRow("Satellite of", "Earth");
  const _M0FP314vlmkit_2dsites4wiki4main7infoboxN6recordS2048 = new _M0TP314vlmkit_2dsites4wiki4main7InfoRow("Mean radius", "1,737.4 km");
  const _M0FP314vlmkit_2dsites4wiki4main7infoboxN6recordS2049 = new _M0TP314vlmkit_2dsites4wiki4main7InfoRow("Surface area", "3.793 × 10⁷ km²");
  const _M0FP314vlmkit_2dsites4wiki4main7infoboxN6recordS2050 = new _M0TP314vlmkit_2dsites4wiki4main7InfoRow("Mass", "7.342 × 10²² kg");
  const _M0FP314vlmkit_2dsites4wiki4main7infoboxN6recordS2051 = new _M0TP314vlmkit_2dsites4wiki4main7InfoRow("Mean density", "3.344 g/cm³");
  const _M0FP314vlmkit_2dsites4wiki4main7infoboxN6recordS2052 = new _M0TP314vlmkit_2dsites4wiki4main7InfoRow("Surface gravity", "1.62 m/s² (0.165 g)");
  const _M0FP314vlmkit_2dsites4wiki4main7infoboxN6recordS2053 = new _M0TP314vlmkit_2dsites4wiki4main7InfoRow("Rotation period", "Synchronous");
  const _M0FP314vlmkit_2dsites4wiki4main7infoboxN6recordS2054 = new _M0TP314vlmkit_2dsites4wiki4main7InfoRow("Albedo", "0.12");
  const _M0FP314vlmkit_2dsites4wiki4main7infoboxN6recordS2055 = new _M0TP314vlmkit_2dsites4wiki4main7InfoRow("Surface temp.", "−173 to 127 °C");
  const _M0FP314vlmkit_2dsites4wiki4main7infobox = [new _M0TP314vlmkit_2dsites4wiki4main7InfoSec("Designations", [_M0FP314vlmkit_2dsites4wiki4main7infoboxN6recordS2036, _M0FP314vlmkit_2dsites4wiki4main7infoboxN6recordS2037, _M0FP314vlmkit_2dsites4wiki4main7infoboxN6recordS2038]), new _M0TP314vlmkit_2dsites4wiki4main7InfoSec("Orbital characteristics", [_M0FP314vlmkit_2dsites4wiki4main7infoboxN6recordS2039, _M0FP314vlmkit_2dsites4wiki4main7infoboxN6recordS2040, _M0FP314vlmkit_2dsites4wiki4main7infoboxN6recordS2041, _M0FP314vlmkit_2dsites4wiki4main7infoboxN6recordS2042, _M0FP314vlmkit_2dsites4wiki4main7infoboxN6recordS2043, _M0FP314vlmkit_2dsites4wiki4main7infoboxN6recordS2044, _M0FP314vlmkit_2dsites4wiki4main7infoboxN6recordS2045, _M0FP314vlmkit_2dsites4wiki4main7infoboxN6recordS2046, _M0FP314vlmkit_2dsites4wiki4main7infoboxN6recordS2047]), new _M0TP314vlmkit_2dsites4wiki4main7InfoSec("Physical characteristics", [_M0FP314vlmkit_2dsites4wiki4main7infoboxN6recordS2048, _M0FP314vlmkit_2dsites4wiki4main7infoboxN6recordS2049, _M0FP314vlmkit_2dsites4wiki4main7infoboxN6recordS2050, _M0FP314vlmkit_2dsites4wiki4main7infoboxN6recordS2051, _M0FP314vlmkit_2dsites4wiki4main7infoboxN6recordS2052, _M0FP314vlmkit_2dsites4wiki4main7infoboxN6recordS2053, _M0FP314vlmkit_2dsites4wiki4main7infoboxN6recordS2054, _M0FP314vlmkit_2dsites4wiki4main7infoboxN6recordS2055])];
  const _M0FP314vlmkit_2dsites4wiki4main15external__links = ["Lunar Atlas Project, an interactive map of named features", "Lexipedia Commons, a gallery of Moon images", "Moon phase tables for any year, from an observatory almanac"];
  const _M0FP314vlmkit_2dsites4wiki4main10referencesN6recordS2056 = new _M0TP314vlmkit_2dsites4wiki4main8Citation("Haldane, Rosalind (2019). //Tidal Histories of the Inner Planets//. Corvane University Press. pp. 41–58.");
  const _M0FP314vlmkit_2dsites4wiki4main10referencesN6recordS2057 = new _M0TP314vlmkit_2dsites4wiki4main8Citation("Okonjo, Teodor; Lindqvist, Mara (2021). \"A primer on lunar phase and illumination\". //Journal of Amateur Astronomy// 14 (3): 112–119.");
  const _M0FP314vlmkit_2dsites4wiki4main10referencesN6recordS2058 = new _M0TP314vlmkit_2dsites4wiki4main8Citation("Varga, Ilse (2016). \"Glancing blows: simulations of a giant impact on the proto-Earth\". //Annals of Planetary Dynamics// 88: 201–233.");
  const _M0FP314vlmkit_2dsites4wiki4main10referencesN6recordS2059 = new _M0TP314vlmkit_2dsites4wiki4main8Citation("Brennan, Cormac (2008). //Counting the Months: Calendars and the Moon//. Halloway & Finch. p. 9.");
  const _M0FP314vlmkit_2dsites4wiki4main10referencesN6recordS2060 = new _M0TP314vlmkit_2dsites4wiki4main8Citation("Achterberg, Pim; Sato, Wren (2022). \"Isotopic twins: reconciling impact models with lunar samples\". //Selene Quarterly// 31 (1): 4–27.");
  const _M0FP314vlmkit_2dsites4wiki4main10referencesN6recordS2061 = new _M0TP314vlmkit_2dsites4wiki4main8Citation("Moreau, Lucien (2014). \"Crystals afloat: the lunar magma ocean revisited\". //Geochemical Letters// 52: 77–90.");
  const _M0FP314vlmkit_2dsites4wiki4main10referencesN6recordS2062 = new _M0TP314vlmkit_2dsites4wiki4main8Citation("Lexipedia Physical Data Group (2025). //Handbook of Solar System Constants// (7th ed.). Tessaly Press. Table 4.2.");
  const _M0FP314vlmkit_2dsites4wiki4main10referencesN6recordS2063 = new _M0TP314vlmkit_2dsites4wiki4main8Citation("Quist, Annelie (2018). //Listening to the Moon: Fifty Years of Lunar Seismology//. Northfold Academic. ch. 3.");
  const _M0FP314vlmkit_2dsites4wiki4main10referencesN6recordS2064 = new _M0TP314vlmkit_2dsites4wiki4main8Citation("Ferrante, Dario (2011). \"Crater counts as a clock\". //Annals of Planetary Dynamics// 63: 15–40.");
  const _M0FP314vlmkit_2dsites4wiki4main10referencesN6recordS2065 = new _M0TP314vlmkit_2dsites4wiki4main8Citation("Ibsen-Kale, Noor (2020). \"Thermal extremes on airless bodies\". //Journal of Surface Physics// 9 (2): 55–71.");
  const _M0FP314vlmkit_2dsites4wiki4main10referencesN6recordS2066 = new _M0TP314vlmkit_2dsites4wiki4main8Citation("Castellan, Rhea; Mbeki, Joss (2023). \"Ice in the cold traps: a review of orbital evidence\". //Selene Quarterly// 32 (4): 300–341.");
  const _M0FP314vlmkit_2dsites4wiki4main10referencesN6recordS2067 = new _M0TP314vlmkit_2dsites4wiki4main8Citation("Haldane, Rosalind (2019). //Tidal Histories of the Inner Planets//. Corvane University Press. pp. 12–14.");
  const _M0FP314vlmkit_2dsites4wiki4main10referencesN6recordS2068 = new _M0TP314vlmkit_2dsites4wiki4main8Citation("Orsini, Paolo (2017). //Shadows That Line Up: A Guide to Eclipses//. Halloway & Finch. pp. 3–6.");
  const _M0FP314vlmkit_2dsites4wiki4main10referencesN6recordS2069 = new _M0TP314vlmkit_2dsites4wiki4main8Citation("Whitlock, Agnes (2015). \"Why there are two tides a day\". //Coastal Science Review// 21: 88–95.");
  const _M0FP314vlmkit_2dsites4wiki4main10referencesN6recordS2070 = new _M0TP314vlmkit_2dsites4wiki4main8Citation("Danvers, Elsa (2012). \"The Moon illusion: a century of explanations\". //Perception Studies// 40 (6): 601–618.");
  const _M0FP314vlmkit_2dsites4wiki4main10referencesN6recordS2071 = new _M0TP314vlmkit_2dsites4wiki4main8Citation("Ruiz-Abara, Tomas (2024). //Robots to the Moon: An Illustrated History of Lunar Probes//. Tessaly Press. pp. 120–164.");
  const _M0FP314vlmkit_2dsites4wiki4main10references = [_M0FP314vlmkit_2dsites4wiki4main10referencesN6recordS2056, _M0FP314vlmkit_2dsites4wiki4main10referencesN6recordS2057, _M0FP314vlmkit_2dsites4wiki4main10referencesN6recordS2058, _M0FP314vlmkit_2dsites4wiki4main10referencesN6recordS2059, _M0FP314vlmkit_2dsites4wiki4main10referencesN6recordS2060, _M0FP314vlmkit_2dsites4wiki4main10referencesN6recordS2061, _M0FP314vlmkit_2dsites4wiki4main10referencesN6recordS2062, _M0FP314vlmkit_2dsites4wiki4main10referencesN6recordS2063, _M0FP314vlmkit_2dsites4wiki4main10referencesN6recordS2064, _M0FP314vlmkit_2dsites4wiki4main10referencesN6recordS2065, _M0FP314vlmkit_2dsites4wiki4main10referencesN6recordS2066, _M0FP314vlmkit_2dsites4wiki4main10referencesN6recordS2067, _M0FP314vlmkit_2dsites4wiki4main10referencesN6recordS2068, _M0FP314vlmkit_2dsites4wiki4main10referencesN6recordS2069, _M0FP314vlmkit_2dsites4wiki4main10referencesN6recordS2070, _M0FP314vlmkit_2dsites4wiki4main10referencesN6recordS2071];
  const _M0FP314vlmkit_2dsites4wiki4main9see__also = ["Natural satellite", "Lunar calendar", "Far side of the Moon", "Selenography", "Earthshine"];
  const _M0FP314vlmkit_2dsites4wiki4main7hatnote = "This article is about Earth's natural satellite. For moons in general, see [[Natural satellite]]. For the unit of time, see [[Lunar month]].";
  const _M0FP314vlmkit_2dsites4wiki4main4lead = ["The **Moon** is [[Earth]]'s only [[Natural satellite|natural satellite]] and the fifth-largest moon in the Solar System. It circles Earth at an average distance of about 384,400 kilometres, roughly thirty times the planet's diameter, and completes one [[Orbit|orbit]] in a little over 27 days.{1} Because it turns once on its axis in the same time, the same face is always turned towards Earth, a state known as [[Tidal locking|tidal locking]].", "Seen from the ground, the Moon is the brightest object in the night sky. Its apparent shape changes over a [[Lunar month|lunar month]] of about 29.5 days as the half lit by the [[Sun]] turns towards or away from us, giving the familiar cycle of [[Lunar phase|phases]].{2} Dark plains of solidified lava, the [[Lunar mare|maria]], cover about a sixth of the surface and form the patterns that many cultures have read as a face, a hare or a woman carrying sticks. The rest is pale, heavily cratered highland.", "The Moon is thought to have formed about 4.5 billion years ago from debris thrown into orbit when a body roughly the size of Mars struck the young Earth.{3} Its gravity raises the ocean [[Tide|tides]], slowly lengthens Earth's day and steadies the tilt of Earth's axis. It is the only body beyond Earth on which people have walked, and since the 2000s it has again become a destination for robotic missions and plans for long-term crewed bases."];
  const _M0FP314vlmkit_2dsites4wiki4main4talkN5tupleS2072 = { _0: "Ana Lisboa, 18 October 2026", _1: "The Tidal locking subsection explains the far side well, but readers still search for 'dark side'. Should the phrase appear in bold?" };
  const _M0FP314vlmkit_2dsites4wiki4main4talkN5tupleS2073 = { _0: "Selene Arkwright, 19 October 2026", _1: "It is mentioned once already, as a common misnomer. I would keep it out of bold so the article does not appear to endorse it." };
  const _M0FP314vlmkit_2dsites4wiki4main4talkN5tupleS2074 = { _0: "Ivo Petrak, 2 November 2026", _1: "Reference 9 is from 2011. Is there a more recent review we could cite alongside it?" };
  const _M0FP314vlmkit_2dsites4wiki4main4talk = [new _M0TP314vlmkit_2dsites4wiki4main6Thread("Is 'dark side' worth a mention?", [_M0FP314vlmkit_2dsites4wiki4main4talkN5tupleS2072, _M0FP314vlmkit_2dsites4wiki4main4talkN5tupleS2073]), new _M0TP314vlmkit_2dsites4wiki4main6Thread("Source for the crater counts", [_M0FP314vlmkit_2dsites4wiki4main4talkN5tupleS2074])];
  const _M0FP314vlmkit_2dsites4wiki4main7historyN6recordS2075 = new _M0TP314vlmkit_2dsites4wiki4main8Revision("3 November 2026, 14:12", "Selene Arkwright", "61,204", "+88", "Copyedit of the tidal-locking subsection");
  const _M0FP314vlmkit_2dsites4wiki4main7historyN6recordS2076 = new _M0TP314vlmkit_2dsites4wiki4main8Revision("28 October 2026, 09:40", "Halvard Ostrom", "61,116", "−312", "Removed a duplicated sentence about libration");
  const _M0FP314vlmkit_2dsites4wiki4main7historyN6recordS2077 = new _M0TP314vlmkit_2dsites4wiki4main8Revision("21 October 2026, 22:05", "Mirela Duca", "61,428", "+1,046", "Expanded Robotic missions; added a reference");
  const _M0FP314vlmkit_2dsites4wiki4main7historyN6recordS2078 = new _M0TP314vlmkit_2dsites4wiki4main8Revision("14 October 2026, 17:31", "Selene Arkwright", "60,382", "+12", "Fixed a typo in the infobox");
  const _M0FP314vlmkit_2dsites4wiki4main7historyN6recordS2079 = new _M0TP314vlmkit_2dsites4wiki4main8Revision("2 October 2026, 08:18", "Tobias Wren", "60,370", "+640", "New figure: Earth over the lunar horizon");
  const _M0FP314vlmkit_2dsites4wiki4main7historyN6recordS2080 = new _M0TP314vlmkit_2dsites4wiki4main8Revision("19 September 2026, 13:57", "Ana Lisboa", "59,730", "−58", "Tidied the See also list");
  const _M0FP314vlmkit_2dsites4wiki4main7historyN6recordS2081 = new _M0TP314vlmkit_2dsites4wiki4main8Revision("7 September 2026, 19:22", "Halvard Ostrom", "59,788", "+2,210", "Rewrote Formation and evolution from newer sources");
  const _M0FP314vlmkit_2dsites4wiki4main7historyN6recordS2082 = new _M0TP314vlmkit_2dsites4wiki4main8Revision("30 August 2026, 11:03", "Ivo Petrak", "57,578", "+3", "Corrected the synodic period");
  const _M0FP314vlmkit_2dsites4wiki4main7historyN6recordS2083 = new _M0TP314vlmkit_2dsites4wiki4main8Revision("12 August 2026, 16:44", "Mirela Duca", "57,575", "+415", "Added the Eclipses subsection");
  const _M0FP314vlmkit_2dsites4wiki4main7historyN6recordS2084 = new _M0TP314vlmkit_2dsites4wiki4main8Revision("1 August 2026, 10:09", "Tobias Wren", "57,160", "+57,160", "Created the article");
  const _M0FP314vlmkit_2dsites4wiki4main7history = [_M0FP314vlmkit_2dsites4wiki4main7historyN6recordS2075, _M0FP314vlmkit_2dsites4wiki4main7historyN6recordS2076, _M0FP314vlmkit_2dsites4wiki4main7historyN6recordS2077, _M0FP314vlmkit_2dsites4wiki4main7historyN6recordS2078, _M0FP314vlmkit_2dsites4wiki4main7historyN6recordS2079, _M0FP314vlmkit_2dsites4wiki4main7historyN6recordS2080, _M0FP314vlmkit_2dsites4wiki4main7historyN6recordS2081, _M0FP314vlmkit_2dsites4wiki4main7historyN6recordS2082, _M0FP314vlmkit_2dsites4wiki4main7historyN6recordS2083, _M0FP314vlmkit_2dsites4wiki4main7historyN6recordS2084];
  const _M0FP314vlmkit_2dsites4wiki4main20suggested__languages = ["Velorian", "Caldish", "Ostrene"];
  const _M0FP26mizchi7signals11active__sub = _M0MPC13ref3Ref3RefGRPB5ArrayGRP36mizchi4luna3dom9ItemEntryGiEEE(undefined);
  const _M0FP26mizchi7signals19effect__id__counter = _M0MPC13ref3Ref3RefGiE(0);
  const _M0FP26mizchi7signals5cycle = _M0MPC13ref3Ref3RefGiE(0);
  const _M0FP26mizchi7signals23core__current__cleanups = _M0MPC13ref3Ref3RefGORPB5ArrayGWEuEE(_M0DTPC16option6OptionGRPB5ArrayGWEuEE4None__);
  const _M0FP314vlmkit_2dsites4wiki4main11toc__hidden = _M0FP26mizchi7signals6signalGbE(false);
  const _M0FP314vlmkit_2dsites4wiki4main14toc__pop__open = _M0FP26mizchi7signals6signalGbE(false);
  const _M0FP314vlmkit_2dsites4wiki4main11width__pref = _M0FP26mizchi7signals6signalGRP314vlmkit_2dsites4wiki4main5RouteE("standard");
  const _M0FP314vlmkit_2dsites4wiki4main7watched = _M0FP26mizchi7signals6signalGbE(false);
  const _M0FP314vlmkit_2dsites4wiki4main15app__menu__open = _M0FP26mizchi7signals6signalGbE(false);
  const _M0FP314vlmkit_2dsites4wiki4main10toast__msg = _M0FP26mizchi7signals6signalGRP314vlmkit_2dsites4wiki4main5RouteE("");
  const _M0FP314vlmkit_2dsites4wiki4main7preview = _M0FP26mizchi7signals6signalGORP314vlmkit_2dsites4wiki4main7PreviewE(undefined);
  const _M0FP26mizchi7signals12batch__depth = _M0MPC13ref3Ref3RefGiE(0);
  const _M0FP26mizchi7signals6queued = _M0MPC15array5Array4makeGORP26mizchi7signals10EffectNodeE(1024, undefined);
  const _M0FP26mizchi7signals13notify__index = _M0MPC13ref3Ref3RefGiE(0);
  const _M0FP26mizchi7signals14queued__length = _M0MPC13ref3Ref3RefGiE(0);
  const _M0FP314vlmkit_2dsites4wiki4main10active__id = _M0FP26mizchi7signals6signalGRP314vlmkit_2dsites4wiki4main5RouteE("top");
  const _M0FPB4seed = _M0FPB12random__seed();
  const _bind$17 = [];
  const _M0FP314vlmkit_2dsites4wiki4main13cite__section = _M0MPB3Map3MapGiiE(new _M0TPB9ArrayViewGUiiEE(_bind$17, 0, 0), undefined);
  const _M0FP314vlmkit_2dsites4wiki4main11color__pref = _M0FP26mizchi7signals6signalGRP314vlmkit_2dsites4wiki4main5RouteE("auto");
  const _M0FP314vlmkit_2dsites4wiki4main10text__size = _M0FP26mizchi7signals6signalGRP314vlmkit_2dsites4wiki4main5RouteE("standard");
  const _M0FP314vlmkit_2dsites4wiki4main17appearance__panelN5tupleS2432 = { _0: "small", _1: "Small" };
  const _M0FP314vlmkit_2dsites4wiki4main17appearance__panelN5tupleS2433 = { _0: "standard", _1: "Standard" };
  const _M0FP314vlmkit_2dsites4wiki4main17appearance__panelN5tupleS2434 = { _0: "large", _1: "Large" };
  const _M0FP314vlmkit_2dsites4wiki4main17appearance__panelN5tupleS2435 = { _0: "standard", _1: "Standard" };
  const _M0FP314vlmkit_2dsites4wiki4main17appearance__panelN5tupleS2436 = { _0: "wide", _1: "Wide" };
  const _M0FP314vlmkit_2dsites4wiki4main17appearance__panelN5tupleS2437 = { _0: "auto", _1: "Automatic" };
  const _M0FP314vlmkit_2dsites4wiki4main17appearance__panelN5tupleS2438 = { _0: "light", _1: "Light" };
  const _M0FP314vlmkit_2dsites4wiki4main17appearance__panelN5tupleS2439 = { _0: "dark", _1: "Dark" };
  const _M0FP314vlmkit_2dsites4wiki4main14search__browse = _M0FP26mizchi7signals6signalGbE(false);
  const _M0FP314vlmkit_2dsites4wiki4main16search__expanded = _M0FP26mizchi7signals6signalGbE(false);
  const _M0FP314vlmkit_2dsites4wiki4main9search__q = _M0FP26mizchi7signals6signalGRP314vlmkit_2dsites4wiki4main5RouteE("");
  const _M0FP314vlmkit_2dsites4wiki4main14search__active = _M0FP26mizchi7signals6signalGiE(-1);
  const _M0FP314vlmkit_2dsites4wiki4main7visited = _M0FP26mizchi7signals6signalGORP314vlmkit_2dsites4wiki4main7PreviewE([]);
  const _M0FP314vlmkit_2dsites4wiki4main5route = _M0FP26mizchi7signals6signalGRP314vlmkit_2dsites4wiki4main5RouteE(_M0DTP314vlmkit_2dsites4wiki4main5Route7Article__);
  const _M0FP314vlmkit_2dsites4wiki4main10menu__open = _M0FP26mizchi7signals6signalGbE(false);
  const _M0FP314vlmkit_2dsites4wiki4main19phone__search__open = _M0FP26mizchi7signals6signalGbE(false);
  const _M0MPC16string10StringView4findN6constrS181 = 0;
  const _M0FP314vlmkit_2dsites4wiki4main11search__boxN6constrS2371 = 8;
  const _M0FP314vlmkit_2dsites4wiki4main9is__phone = _M0FP26mizchi7signals6signalGbE(false);
  const _M0FP314vlmkit_2dsites4wiki4main6headerN5tupleS2442 = { _0: "Main page", _1: "#/wiki/Main_page" };
  const _M0FP314vlmkit_2dsites4wiki4main6headerN5tupleS2443 = { _0: "Featured articles", _1: "#/wiki/Featured_articles" };
  const _M0FP314vlmkit_2dsites4wiki4main6headerN5tupleS2444 = { _0: "Random article", _1: "#/wiki/Libration" };
  const _M0FP314vlmkit_2dsites4wiki4main6headerN5tupleS2445 = { _0: "About Lexipedia", _1: "#/wiki/About_Lexipedia" };
  const _M0FP314vlmkit_2dsites4wiki4main6headerN5tupleS2446 = { _0: "Help", _1: "#/wiki/Help" };
  const _M0FP314vlmkit_2dsites4wiki4main11media__open = _M0FP26mizchi7signals6signalGbE(false);
  const _M0FP314vlmkit_2dsites4wiki4main12media__index = _M0FP26mizchi7signals6signalGiE(0);
  const _bind$18 = [];
  const _M0FP314vlmkit_2dsites4wiki4main11cite__count = _M0MPB3Map3MapGiiE(new _M0TPB9ArrayViewGUiiEE(_bind$18, 0, 0), undefined);
  const _M0FP314vlmkit_2dsites4wiki4main11lang__query = _M0FP26mizchi7signals6signalGRP314vlmkit_2dsites4wiki4main5RouteE("");
  const _M0FP314vlmkit_2dsites4wiki4main18appearance__hidden = _M0FP26mizchi7signals6signalGbE(false);
  const _M0FP314vlmkit_2dsites4wiki4main10lang__open = _M0FP26mizchi7signals6signalGbE(false);
  function _M0FPB13consume4__acc(acc, input) {
    const _p = (acc >>> 0) + ((Math.imul(input, -1028477379) | 0) >>> 0) | 0;
    const _p$2 = 17;
    return Math.imul(_p << _p$2 | (_p >>> (32 - _p$2 | 0) | 0), 668265263) | 0;
  }
  function _M0MPC15array10FixedArray12unsafe__blitGRPB17UnsafeMaybeUninitGRP314vlmkit_2dsites4wiki4main5TitleEE(dst, dst_offset, src, src_offset, len) {
    if (dst === src && dst_offset < src_offset) {
      let _tmp$8 = 0;
      while (true) {
        const i = _tmp$8;
        if (i < len) {
          const _tmp$9 = dst_offset + i | 0;
          const _tmp$10 = src_offset + i | 0;
          if (_tmp$9 >>> 0 < dst.length) {
            dst[_tmp$9] = _tmp$10 >>> 0 < src.length ? src[_tmp$10] : $oob();
          } else {
            $oob();
          }
          _tmp$8 = i + 1 | 0;
          continue;
        } else {
          return;
        }
      }
    } else {
      let _tmp$8 = len - 1 | 0;
      let _tmp$9 = len > 0;
      while (true) {
        const i = _tmp$8;
        const _more = _tmp$9;
        if (_more) {
          const _tmp$10 = dst_offset + i | 0;
          const _tmp$11 = src_offset + i | 0;
          if (_tmp$10 >>> 0 < dst.length) {
            dst[_tmp$10] = _tmp$11 >>> 0 < src.length ? src[_tmp$11] : $oob();
          } else {
            $oob();
          }
          _tmp$8 = i - 1 | 0;
          _tmp$9 = i > 0;
          continue;
        } else {
          return;
        }
      }
    }
  }
  function _M0MPB18UninitializedArray12unsafe__blitGRP314vlmkit_2dsites4wiki4main5TitleE(dst, dst_offset, src, src_offset, len) {
    _M0MPC15array10FixedArray12unsafe__blitGRPB17UnsafeMaybeUninitGRP314vlmkit_2dsites4wiki4main5TitleEE(dst, dst_offset, src, src_offset, len);
  }
  function _M0MPB13StringBuilder13write__objectGsE(self, obj) {
    _M0IP016_24default__implPB4Show6outputGsE(obj, { self: self, method_table: _M0FP092moonbitlang_2fcore_2fbuiltin_2fStringBuilder_24as_24_40moonbitlang_2fcore_2fbuiltin_2eLogger });
  }
  function _M0MPB13StringBuilder13write__objectGiE(self, obj) {
    _M0IP016_24default__implPB4Show6outputGiE(obj, { self: self, method_table: _M0FP092moonbitlang_2fcore_2fbuiltin_2fStringBuilder_24as_24_40moonbitlang_2fcore_2fbuiltin_2eLogger });
  }
  function _M0MPB13StringBuilder13write__objectGdE(self, obj) {
    _M0IP016_24default__implPB4Show6outputGdE(obj, { self: self, method_table: _M0FP092moonbitlang_2fcore_2fbuiltin_2fStringBuilder_24as_24_40moonbitlang_2fcore_2fbuiltin_2eLogger });
  }
  function _M0MPB13StringBuilder21StringBuilder_2einner(size_hint) {
    if (size_hint >= 0) {
      return new _M0TPB13StringBuilder("");
    } else {
      console.error("size_hint must be non-negative");
      return $panic();
    }
  }
  function _M0IPB13StringBuilderPB6Logger11write__char(self, ch) {
    self.val = `${self.val}${String.fromCodePoint(ch)}`;
  }
  function _M0IPB13StringBuilderPB6Logger13write__string(self, str) {
    self.val = `${self.val}${str}`;
  }
  function _M0IP016_24default__implPB2Eq10not__equalGRP314vlmkit_2dsites4wiki4main5RouteE(x, y) {
    return !_M0IP314vlmkit_2dsites4wiki4main5RoutePB2Eq5equal(x, y);
  }
  function _M0FPB14avalanche__acc(acc) {
    let acc$2 = acc;
    acc$2 = acc$2 ^ (acc$2 >>> 15 | 0);
    acc$2 = Math.imul(acc$2, -2048144777) | 0;
    acc$2 = acc$2 ^ (acc$2 >>> 13 | 0);
    acc$2 = Math.imul(acc$2, -1028477379) | 0;
    acc$2 = acc$2 ^ (acc$2 >>> 16 | 0);
    return acc$2;
  }
  function _M0FPB13finalize__acc(acc) {
    return _M0FPB14avalanche__acc(acc);
  }
  function _M0IP016_24default__implPB6Logger28write__string__interpolationGRPB13StringBuilderE(self, show) {
    show.method_table.method_0(show.self, { self: self, method_table: _M0FP092moonbitlang_2fcore_2fbuiltin_2fStringBuilder_24as_24_40moonbitlang_2fcore_2fbuiltin_2eLogger });
  }
  function _M0IP016_24default__implPB6Logger5writeGRPB13StringBuilderE(self, show) {
    show.method_table.method_0(show.self, { self: self, method_table: _M0FP092moonbitlang_2fcore_2fbuiltin_2fStringBuilder_24as_24_40moonbitlang_2fcore_2fbuiltin_2eLogger });
  }
  function _M0MPC16string6String21clamped__view_2einner(self, start, end) {
    const len = self.length;
    let lo;
    if (start <= 0) {
      lo = 0;
    } else {
      if (start >= len) {
        lo = len;
      } else {
        let _tmp$8;
        const _p = self.charCodeAt(start);
        if (_p >= 56320 && _p <= 57343) {
          const _p$2 = self.charCodeAt(start - 1 | 0);
          _tmp$8 = _p$2 >= 55296 && _p$2 <= 56319;
        } else {
          _tmp$8 = false;
        }
        if (_tmp$8) {
          lo = start + 1 | 0;
        } else {
          lo = start;
        }
      }
    }
    let hi;
    if (end === undefined) {
      hi = len;
    } else {
      const _Some = end;
      const _e = _Some;
      if (_e <= 0) {
        hi = 0;
      } else {
        if (_e >= len) {
          hi = len;
        } else {
          let _tmp$8;
          const _p = self.charCodeAt(_e);
          if (_p >= 56320 && _p <= 57343) {
            const _p$2 = self.charCodeAt(_e - 1 | 0);
            _tmp$8 = _p$2 >= 55296 && _p$2 <= 56319;
          } else {
            _tmp$8 = false;
          }
          if (_tmp$8) {
            hi = _e - 1 | 0;
          } else {
            hi = _e;
          }
        }
      }
    }
    return lo >= hi ? new _M0TPC16string10StringView(self, lo, lo) : new _M0TPC16string10StringView(self, lo, hi);
  }
  function _M0IP016_24default__implPB6Logger16write__substringGRPB13StringBuilderE(self, value, start, len) {
    _M0IPB13StringBuilderPB6Logger11write__view(self, _M0MPC16string6String21clamped__view_2einner(value, start, start + len | 0));
  }
  function _M0IP016_24default__implPB4Show6outputGsE(self, logger) {
    logger.method_table.method_0(logger.self, self);
  }
  function _M0IP016_24default__implPB4Show6outputGiE(self, logger) {
    logger.method_table.method_0(logger.self, _M0IPC13int3IntPB4Show10to__string(self));
  }
  function _M0IP016_24default__implPB4Show6outputGdE(self, logger) {
    logger.method_table.method_0(logger.self, _M0IPC16double6DoublePB4Show10to__string(self));
  }
  function _M0MPC13int3Int18to__string_2einner(self, radix) {
    return _M0FPB19int__to__string__js(self, radix);
  }
  function _M0MPC16string10StringView9to__owned(self) {
    return self.str.substring(self.start, self.end);
  }
  function _M0IPB13StringBuilderPB6Logger11write__view(self, str) {
    self.val = `${self.val}${_M0MPC16string10StringView9to__owned(str)}`;
  }
  function _M0MPB13StringBuilder13reset_2einner(self, keep_capacity) {
    self.val = "";
  }
  function _M0FPB24find__code__unit__scalar(data, start, end, code) {
    let _tmp$8 = start;
    while (true) {
      const pos = _tmp$8;
      if (pos < end) {
        if (data.charCodeAt(pos) === code) {
          return pos;
        }
        _tmp$8 = pos + 1 | 0;
        continue;
      } else {
        return -1;
      }
    }
  }
  function _M0FPB30find__code__unit__from__string(data, start, end, code) {
    return (end - start | 0) <= 8 ? _M0FPB24find__code__unit__scalar(data, start, end, code) : _M0FPB13js__index__of(data, start, end, _M0FPB22js__code__unit__string(code));
  }
  function _M0FPB28find__code__unit__from__view(target, start, end, code) {
    const target_start = target.start;
    const found = _M0FPB30find__code__unit__from__string(target.str, target_start + start | 0, target_start + end | 0, code);
    return found < 0 ? -1 : found - target_start | 0;
  }
  function _M0FPB19kmp__failure__table(pattern) {
    const m = pattern.end - pattern.start | 0;
    const table = $make_array_len_and_init(m, 0);
    let k = 0;
    let _tmp$8 = 1;
    while (true) {
      const i = _tmp$8;
      if (i < m) {
        const c = pattern.str.charCodeAt(pattern.start + i | 0);
        while (true) {
          if (k > 0 && c !== pattern.str.charCodeAt(pattern.start + k | 0)) {
            const _tmp$9 = k - 1 | 0;
            k = _tmp$9 >>> 0 < table.length ? table[_tmp$9] : $oob();
            continue;
          } else {
            break;
          }
        }
        if (c === pattern.str.charCodeAt(pattern.start + k | 0)) {
          k = k + 1 | 0;
        }
        if (i >>> 0 < table.length) {
          table[i] = k;
        } else {
          $oob();
        }
        _tmp$8 = i + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return table;
  }
  function _M0FPB24find__pattern__kmp__from(target, pattern, start) {
    const n = target.end - target.start | 0;
    const m = pattern.end - pattern.start | 0;
    const table = _M0FPB19kmp__failure__table(pattern);
    let k = 0;
    let _tmp$8 = start;
    while (true) {
      const i = _tmp$8;
      if (i < n) {
        const c = target.str.charCodeAt(target.start + i | 0);
        while (true) {
          if (k > 0 && c !== pattern.str.charCodeAt(pattern.start + k | 0)) {
            const _tmp$9 = k - 1 | 0;
            k = _tmp$9 >>> 0 < table.length ? table[_tmp$9] : $oob();
            continue;
          } else {
            break;
          }
        }
        if (c === pattern.str.charCodeAt(pattern.start + k | 0)) {
          k = k + 1 | 0;
        }
        if (k === m) {
          return (i - m | 0) + 1 | 0;
        }
        _tmp$8 = i + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return undefined;
  }
  function _M0FPB36find__two__anchor__candidate__scalar(data, start, candidate_end, first, last_offset, last) {
    let _tmp$8 = start;
    while (true) {
      const pos = _tmp$8;
      if (pos < candidate_end) {
        if (data.charCodeAt(pos) === first && data.charCodeAt(pos + last_offset | 0) === last) {
          return pos;
        }
        _tmp$8 = pos + 1 | 0;
        continue;
      } else {
        return -1;
      }
    }
  }
  function _M0FPB42find__two__anchor__candidate__from__string(data, start, candidate_end, first, last_offset, last) {
    return _M0FPB36find__two__anchor__candidate__scalar(data, start, candidate_end, first, last_offset, last);
  }
  function _M0FPB21string__ranges__equal(left, left_start, right, right_start, length) {
    let _tmp$8 = 0;
    while (true) {
      const i = _tmp$8;
      if (i < length) {
        if (left.charCodeAt(left_start + i | 0) !== right.charCodeAt(right_start + i | 0)) {
          return false;
        }
        _tmp$8 = i + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return true;
  }
  function _M0FPB22find__by__two__anchors(target, pattern) {
    const target_len = target.end - target.start | 0;
    const pattern_len = pattern.end - pattern.start | 0;
    const target_start = target.start;
    const pattern_start = pattern.start;
    const last_offset = pattern_len - 1 | 0;
    const candidate_end = ((target_start + target_len | 0) - pattern_len | 0) + 1 | 0;
    const first = pattern.str.charCodeAt(pattern.start);
    const last = pattern.str.charCodeAt(pattern.start + last_offset | 0);
    const middle_len = last_offset - 1 | 0;
    let _tmp$8 = target_start;
    let _tmp$9 = 0;
    while (true) {
      const pos = _tmp$8;
      const failures = _tmp$9;
      if (pos < candidate_end) {
        const found = _M0FPB42find__two__anchor__candidate__from__string(target.str, pos, candidate_end, first, last_offset, last);
        if (found < 0) {
          return undefined;
        }
        if (_M0FPB21string__ranges__equal(target.str, found + 1 | 0, pattern.str, pattern_start + 1 | 0, middle_len)) {
          return found - target_start | 0;
        }
        const failures$2 = failures + 1 | 0;
        const scanned = found - target_start | 0;
        if (failures$2 > 64 || failures$2 > (4 + (scanned / 8 | 0) | 0)) {
          return _M0FPB24find__pattern__kmp__from(target, pattern, scanned + 1 | 0);
        }
        _tmp$8 = found + 1 | 0;
        _tmp$9 = failures$2;
        continue;
      } else {
        return undefined;
      }
    }
  }
  function _M0FPB13find__pattern(target, pattern) {
    if ((pattern.end - pattern.start | 0) <= 250) {
      const target_start = target.start;
      const pattern_start = pattern.start;
      const found = _M0FPB13js__index__of(target.str, target_start, target_start + (target.end - target.start | 0) | 0, _M0FPB13js__substring(pattern.str, pattern_start, pattern_start + (pattern.end - pattern.start | 0) | 0));
      return found < 0 ? undefined : found - target_start | 0;
    } else {
      return _M0FPB22find__by__two__anchors(target, pattern);
    }
  }
  function _M0MPC16string10StringView4find(self, str) {
    const pattern_len = str.end - str.start | 0;
    switch (pattern_len) {
      case 0: {
        return _M0MPC16string10StringView4findN6constrS181;
      }
      case 1: {
        const found = _M0FPB28find__code__unit__from__view(self, 0, self.end - self.start | 0, str.str.charCodeAt(str.start));
        return found < 0 ? undefined : found;
      }
      default: {
        return pattern_len > (self.end - self.start | 0) ? undefined : _M0FPB13find__pattern(self, str);
      }
    }
  }
  function _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(self, value) {
    _M0MPB7JSArray4push(self, value);
  }
  function _M0MPC15array5Array4pushGcE(self, value) {
    _M0MPB7JSArray4push(self, value);
  }
  function _M0MPC15array5Array4pushGRP36mizchi11js__browser3dom4NodeE(self, value) {
    _M0MPB7JSArray4push(self, value);
  }
  function _M0FPB36string__contains__code__unit__scalar(str, start, end, code) {
    let _tmp$8 = start;
    while (true) {
      const i = _tmp$8;
      if (i < end) {
        if (str.charCodeAt(i) === code) {
          return true;
        }
        _tmp$8 = i + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return false;
  }
  function _M0FPB28string__contains__code__unit(str, start, end, code) {
    return _M0FPB36string__contains__code__unit__scalar(str, start, end, code);
  }
  function _M0MPC16string10StringView20contains__code__unit(self, code) {
    return _M0FPB28string__contains__code__unit(self.str, self.start, self.end, code);
  }
  function _M0MPC16string10StringView8contains(self, str) {
    const _bind$19 = str.end - str.start | 0;
    switch (_bind$19) {
      case 0: {
        return true;
      }
      case 1: {
        return _M0MPC16string10StringView20contains__code__unit(self, str.str.charCodeAt(str.start));
      }
      default: {
        const _bind$20 = _M0MPC16string10StringView4find(self, str);
        return !(_bind$20 === undefined);
      }
    }
  }
  function _M0MPC16string6String8contains(self, str) {
    return _M0MPC16string10StringView8contains(new _M0TPC16string10StringView(self, 0, self.length), str);
  }
  function _M0MPC16string6String9to__array(self) {
    const chars = [];
    const _bind$19 = self.length;
    let _tmp$8 = 0;
    while (true) {
      const _string_index = _tmp$8;
      if (_string_index < _bind$19) {
        let _decoded_next_string_index;
        let _decoded_char;
        _L: {
          const _bind$20 = self.charCodeAt(_string_index);
          if (_bind$20 >= 55296 && _bind$20 <= 56319 && (_string_index + 1 | 0) < _bind$19) {
            const _bind$21 = self.charCodeAt(_string_index + 1 | 0);
            if (_bind$21 >= 56320 && _bind$21 <= 57343) {
              const _tmp$9 = _string_index + 2 | 0;
              const _p = (((Math.imul(_bind$20 - 55296 | 0, 1024) | 0) + _bind$21 | 0) - 56320 | 0) + 65536 | 0;
              _decoded_next_string_index = _tmp$9;
              _decoded_char = _p;
              break _L;
            } else {
              const _tmp$9 = _string_index + 1 | 0;
              const _p = _bind$20;
              _decoded_next_string_index = _tmp$9;
              _decoded_char = _p;
              break _L;
            }
          } else {
            const _tmp$9 = _string_index + 1 | 0;
            const _p = _bind$20;
            _decoded_next_string_index = _tmp$9;
            _decoded_char = _p;
            break _L;
          }
        }
        _M0MPC15array5Array4pushGcE(chars, _decoded_char);
        _tmp$8 = _decoded_next_string_index;
        continue;
      } else {
        break;
      }
    }
    return chars;
  }
  function _M0IPC13int3IntPB4Show10to__string(self) {
    return _M0MPC13int3Int18to__string_2einner(self, 10);
  }
  function _M0MPC16option6Option10unwrap__orGiE(self, default_) {
    if (self === undefined) {
      return default_;
    } else {
      const _Some = self;
      const _t = _Some;
      return _t;
    }
  }
  function _M0MPC15array5Array31unsafe__make__and__blit_2einnerGRP314vlmkit_2dsites4wiki4main5TitleE(src, allocate_len, len, src_offset, dst_offset) {
    const dst = new Array(allocate_len);
    _M0MPB18UninitializedArray12unsafe__blitGRP314vlmkit_2dsites4wiki4main5TitleE(dst, dst_offset, src, src_offset, len);
    return dst;
  }
  function _M0MPC15array9ArrayView9to__ownedGRP314vlmkit_2dsites4wiki4main5TitleE(self) {
    const len = self.end - self.start | 0;
    return len === 0 ? [] : _M0MPC15array5Array31unsafe__make__and__blit_2einnerGRP314vlmkit_2dsites4wiki4main5TitleE(self.buf, len, len, self.start, 0);
  }
  function _M0FPB21calc__grow__threshold(capacity) {
    return (Math.imul(capacity / 16 | 0, 13) | 0) + ((Math.imul(capacity % 16 | 0, 13) | 0) / 16 | 0) | 0;
  }
  function _M0MPC13int3Int20next__power__of__two(self) {
    if (self >= 0) {
      if (self <= 1) {
        return 1;
      }
      if (self > 1073741824) {
        return 1073741824;
      }
      return (2147483647 >> (Math.clz32(self - 1 | 0) - 1 | 0)) + 1 | 0;
    } else {
      return $panic();
    }
  }
  function _M0FPB8new__mapGiiE(capacity) {
    const capacity$2 = _M0MPC13int3Int20next__power__of__two(capacity);
    const _bind$19 = capacity$2 - 1 | 0;
    const _bind$20 = _M0FPB21calc__grow__threshold(capacity$2);
    const _bind$21 = $make_array_len_and_init(capacity$2, undefined);
    const _bind$22 = undefined;
    return new _M0TPB3MapGiiE(_bind$21, 0, capacity$2, _bind$19, _bind$20, _bind$22, -1);
  }
  function _M0FPB21capacity__for__length(length) {
    if (length <= _M0FPB21calc__grow__threshold(1073741824)) {
      let capacity = _M0MPC13int3Int20next__power__of__two(length);
      if (length > _M0FPB21calc__grow__threshold(capacity)) {
        capacity = Math.imul(capacity, 2) | 0;
      }
      return capacity;
    } else {
      console.error("Map capacity overflow");
      return $panic();
    }
  }
  function _M0MPB3Map20add__entry__to__tailGiiE(self, idx, entry) {
    const _bind$19 = self.tail;
    if (_bind$19 === -1) {
      self.head = entry;
    } else {
      const _tmp$8 = self.entries;
      const _p = _bind$19 >>> 0 < _tmp$8.length ? _tmp$8[_bind$19] : $oob();
      let _tmp$9;
      if (_p === undefined) {
        _tmp$9 = $panic();
      } else {
        const _p$2 = _p;
        _tmp$9 = _p$2;
      }
      _tmp$9.next = entry;
    }
    self.tail = idx;
    self.entries[idx] = entry;
    self.size = self.size + 1 | 0;
  }
  function _M0MPB3Map10set__entryGiiE(self, entry, new_idx) {
    const _bind$19 = entry.next;
    if (_bind$19 === undefined) {
      self.tail = new_idx;
    } else {
      const _Some = _bind$19;
      const _next = _Some;
      _next.prev = new_idx;
    }
    self.entries[new_idx] = entry;
  }
  function _M0MPB3Map10push__awayGiiE(self, idx, entry) {
    let _tmp$8 = entry.psl + 1 | 0;
    let _tmp$9 = idx + 1 & self.capacity_mask;
    let _tmp$10 = entry;
    while (true) {
      const psl = _tmp$8;
      const idx$2 = _tmp$9;
      const entry$2 = _tmp$10;
      const _bind$19 = self.entries[idx$2];
      if (_bind$19 === undefined) {
        entry$2.psl = psl;
        _M0MPB3Map10set__entryGiiE(self, entry$2, idx$2);
        return;
      } else {
        const _Some = _bind$19;
        const _curr_entry = _Some;
        if (psl > _curr_entry.psl) {
          entry$2.psl = psl;
          _M0MPB3Map10set__entryGiiE(self, entry$2, idx$2);
          _tmp$8 = _curr_entry.psl + 1 | 0;
          _tmp$9 = idx$2 + 1 & self.capacity_mask;
          _tmp$10 = _curr_entry;
          continue;
        } else {
          _tmp$8 = psl + 1 | 0;
          _tmp$9 = idx$2 + 1 & self.capacity_mask;
          continue;
        }
      }
    }
  }
  function _M0MPB3Map20rehash__place__entryGiiE(self, outer) {
    const hash = outer.hash;
    let _tmp$8 = 0;
    let _tmp$9 = hash & self.capacity_mask;
    while (true) {
      const psl = _tmp$8;
      const idx = _tmp$9;
      const _bind$19 = self.entries[idx];
      if (_bind$19 === undefined) {
        outer.psl = psl;
        outer.prev = self.tail;
        _M0MPB3Map20add__entry__to__tailGiiE(self, idx, outer);
        return undefined;
      } else {
        const _Some = _bind$19;
        const _curr = _Some;
        if (psl > _curr.psl) {
          _M0MPB3Map10push__awayGiiE(self, idx, _curr);
          outer.psl = psl;
          outer.prev = self.tail;
          _M0MPB3Map20add__entry__to__tailGiiE(self, idx, outer);
          return undefined;
        } else {
          _tmp$8 = psl + 1 | 0;
          _tmp$9 = idx + 1 & self.capacity_mask;
          continue;
        }
      }
    }
  }
  function _M0MPB3Map4growGiiE(self) {
    const old_head = self.head;
    const new_capacity = self.capacity << 1;
    self.entries = $make_array_len_and_init(new_capacity, undefined);
    self.capacity = new_capacity;
    self.capacity_mask = new_capacity - 1 | 0;
    self.grow_at = _M0FPB21calc__grow__threshold(self.capacity);
    self.size = 0;
    self.head = undefined;
    self.tail = -1;
    let _tmp$8 = old_head;
    while (true) {
      const x = _tmp$8;
      if (x === undefined) {
        return;
      } else {
        const _Some = x;
        const _e = _Some;
        const next_in_chain = _e.next;
        _e.next = undefined;
        _M0MPB3Map20rehash__place__entryGiiE(self, _e);
        _tmp$8 = next_in_chain;
        continue;
      }
    }
  }
  function _M0MPB3Map15set__with__hashGiiE(self, key, value, hash) {
    let _tmp$8 = 0;
    let _tmp$9 = hash & self.capacity_mask;
    while (true) {
      const psl = _tmp$8;
      const idx = _tmp$9;
      const _bind$19 = self.entries[idx];
      if (_bind$19 === undefined) {
        if (self.size >= self.grow_at) {
          _M0MPB3Map4growGiiE(self);
          _tmp$8 = 0;
          _tmp$9 = hash & self.capacity_mask;
          continue;
        }
        const _bind$20 = self.tail;
        const _bind$21 = undefined;
        const entry = new _M0TPB5EntryGiiE(_bind$20, _bind$21, psl, hash, key, value);
        _M0MPB3Map20add__entry__to__tailGiiE(self, idx, entry);
        return undefined;
      } else {
        const _Some = _bind$19;
        const _curr_entry = _Some;
        if (_curr_entry.hash === hash && _curr_entry.key === key) {
          _curr_entry.value = value;
          return undefined;
        }
        if (psl > _curr_entry.psl) {
          if (self.size >= self.grow_at) {
            _M0MPB3Map4growGiiE(self);
            _tmp$8 = 0;
            _tmp$9 = hash & self.capacity_mask;
            continue;
          }
          _M0MPB3Map10push__awayGiiE(self, idx, _curr_entry);
          const _bind$20 = self.tail;
          const _bind$21 = undefined;
          const entry = new _M0TPB5EntryGiiE(_bind$20, _bind$21, psl, hash, key, value);
          _M0MPB3Map20add__entry__to__tailGiiE(self, idx, entry);
          return undefined;
        }
        _tmp$8 = psl + 1 | 0;
        _tmp$9 = idx + 1 & self.capacity_mask;
        continue;
      }
    }
  }
  function _M0MPB3Map3setGiiE(self, key, value) {
    _M0MPB3Map15set__with__hashGiiE(self, key, value, _M0IPC13int3IntPB4Hash4hash(key));
  }
  function _M0MPB3Map3MapGiiE(arr, capacity) {
    const length = arr.end - arr.start | 0;
    let capacity$2;
    if (capacity === undefined) {
      capacity$2 = length === 0 ? 8 : _M0FPB21capacity__for__length(length);
    } else {
      const _Some = capacity;
      const _capacity = _Some;
      capacity$2 = _M0FPB21capacity__for__length(_capacity > length ? _capacity : length);
    }
    const m = _M0FPB8new__mapGiiE(capacity$2);
    const _bind$19 = arr.end - arr.start | 0;
    let _tmp$8 = 0;
    while (true) {
      const _ = _tmp$8;
      if (_ < _bind$19) {
        const e = arr.buf[arr.start + _ | 0];
        _M0MPB3Map3setGiiE(m, e._0, e._1);
        _tmp$8 = _ + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return m;
  }
  function _M0MPB3Map3getGiiE(self, key) {
    const hash = _M0IPC13int3IntPB4Hash4hash(key);
    let _tmp$8 = 0;
    let _tmp$9 = hash & self.capacity_mask;
    while (true) {
      const i = _tmp$8;
      const idx = _tmp$9;
      const _bind$19 = self.entries[idx];
      if (_bind$19 === undefined) {
        return undefined;
      } else {
        const _Some = _bind$19;
        const _entry = _Some;
        if (_entry.hash === hash && _entry.key === key) {
          return _entry.value;
        }
        if (i > _entry.psl) {
          return undefined;
        }
        _tmp$8 = i + 1 | 0;
        _tmp$9 = idx + 1 & self.capacity_mask;
        continue;
      }
    }
  }
  function _M0MPC15array10FixedArray12fill_2einnerGORPB5EntryGiiEE(self, value, start, end) {
    const array_length = self.length;
    if (array_length > 0) {
      if (start >= 0 && start < array_length) {
        let length;
        if (end === undefined) {
          length = array_length - start | 0;
        } else {
          const _Some = end;
          const _e = _Some;
          length = _e >= start && _e <= array_length ? _e - start | 0 : $panic();
        }
        self.fill(value, start, start + length);
        return;
      } else {
        $panic();
        return;
      }
    } else {
      return;
    }
  }
  function _M0MPB3Map5clearGiiE(self) {
    _M0MPC15array10FixedArray12fill_2einnerGORPB5EntryGiiEE(self.entries, undefined, 0, undefined);
    self.size = 0;
    self.head = undefined;
    self.tail = -1;
  }
  function _M0IPC13int3IntPB4Hash4hash(self) {
    const acc = (((_M0FPB4seed >>> 0) + (374761393 >>> 0) | 0) >>> 0) + (4 >>> 0) | 0;
    return _M0FPB13finalize__acc(_M0FPB13consume4__acc(acc, self));
  }
  function _M0MPB18UninitializedArray19unsafe__blit__fixedGRP26mizchi8js__core3AnyE(dst, dst_offset, src, src_offset, len) {
    let _tmp$8 = len - 1 | 0;
    let _tmp$9 = len > 0;
    while (true) {
      const i = _tmp$8;
      const _more = _tmp$9;
      if (_more) {
        const _tmp$10 = dst_offset + i | 0;
        const _tmp$11 = src_offset + i | 0;
        if (_tmp$10 >>> 0 < dst.length) {
          dst[_tmp$10] = _tmp$11 >>> 0 < src.length ? src[_tmp$11] : $oob();
        } else {
          $oob();
        }
        _tmp$8 = i - 1 | 0;
        _tmp$9 = i > 0;
        continue;
      } else {
        return;
      }
    }
  }
  function _M0IPC16double6DoublePB4Show10to__string(self) {
    return String(self);
  }
  function _M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(self, index) {
    const len = self.length;
    return index >= 0 && index < len ? self[index] : $panic();
  }
  function _M0MPC15array5Array2atGORP26mizchi7signals10EffectNodeE(self, index) {
    const len = self.length;
    return index >= 0 && index < len ? self[index] : $panic();
  }
  function _M0MPC15array5Array2atGcE(self, index) {
    const len = self.length;
    return index >= 0 && index < len ? self[index] : $panic();
  }
  function _M0MPC15array5Array2atGiE(self, index) {
    const len = self.length;
    return index >= 0 && index < len ? self[index] : $panic();
  }
  function _M0MPC15array5Array2atGbE(self, index) {
    const len = self.length;
    return index >= 0 && index < len ? self[index] : $panic();
  }
  function _M0MPC15array5Array44unsafe__make__and__blit__from__fixed_2einnerGRP26mizchi8js__core3AnyE(src, allocate_len, len, src_offset, dst_offset) {
    const dst = new Array(allocate_len);
    _M0MPB18UninitializedArray19unsafe__blit__fixedGRP26mizchi8js__core3AnyE(dst, dst_offset, src, src_offset, len);
    return dst;
  }
  function _M0MPC15array5Array21clamped__view_2einnerGRP314vlmkit_2dsites4wiki4main5TitleE(self, start, end) {
    const len = self.length;
    const lo = start < 0 ? 0 : start > len ? len : start;
    let hi;
    if (end === undefined) {
      hi = len;
    } else {
      const _Some = end;
      const _end = _Some;
      hi = _end < 0 ? 0 : _end > len ? len : _end;
    }
    const hi$2 = hi > lo ? hi : lo;
    return new _M0TPB9ArrayViewGRP314vlmkit_2dsites4wiki4main5TitleE(self, lo, hi$2);
  }
  function _M0MPC15array5Array28unsafe__truncate__to__lengthGRP26mizchi7signals5OwnerE(self, new_len) {
    _M0MPB7JSArray11set__length(self, new_len);
  }
  function _M0MPC15array5Array11unsafe__popGUORP26mizchi7signals4LinkORP26mizchi7signals4LinkEE(self) {
    return _M0MPB7JSArray3pop(self);
  }
  function _M0MPC15array5Array3popGUORP26mizchi7signals4LinkORP26mizchi7signals4LinkEE(self) {
    if (self.length === 0) {
      return undefined;
    } else {
      const v = _M0MPC15array5Array11unsafe__popGUORP26mizchi7signals4LinkORP26mizchi7signals4LinkEE(self);
      return v;
    }
  }
  function _M0MPC15array5Array6removeGWEuE(self, index) {
    if (index >= 0 && index < self.length) {
      const value = index >>> 0 < self.length ? self[index] : $oob();
      _M0MPB7JSArray6splice(self, index, 1);
      return value;
    } else {
      const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(60);
      _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, "index out of bounds: the len is from 0 to ");
      _M0MPB13StringBuilder13write__objectGiE(_string_builder, self.length);
      _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, " but the index is ");
      _M0MPB13StringBuilder13write__objectGiE(_string_builder, index);
      console.error(_string_builder.val);
      return $panic();
    }
  }
  function _M0MPC15array5Array4copyGsE(self) {
    return _M0MPB7JSArray4copy(self);
  }
  function _M0MPC15array5Array3setGRP36mizchi4luna3dom9ItemEntryGRP314vlmkit_2dsites4wiki4main5RouteEE(self, index, value) {
    const len = self.length;
    if (index >= 0 && index < len) {
      self[index] = value;
      return;
    } else {
      $panic();
      return;
    }
  }
  function _M0MPC15array5Array3setGORP26mizchi7signals10EffectNodeE(self, index, value) {
    const len = self.length;
    if (index >= 0 && index < len) {
      self[index] = value;
      return;
    } else {
      $panic();
      return;
    }
  }
  function _M0MPC15array5Array3setGbE(self, index, value) {
    const len = self.length;
    if (index >= 0 && index < len) {
      self[index] = value;
      return;
    } else {
      $panic();
      return;
    }
  }
  function _M0MPC15array5Array4makeGORP26mizchi7signals10EffectNodeE(len, elem) {
    const arr = new Array(len);
    let _tmp$8 = 0;
    while (true) {
      const i = _tmp$8;
      if (i < len) {
        arr[i] = elem;
        _tmp$8 = i + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return arr;
  }
  function _M0MPC15array5Array4makeGbE(len, elem) {
    const arr = new Array(len);
    let _tmp$8 = 0;
    while (true) {
      const i = _tmp$8;
      if (i < len) {
        arr[i] = elem;
        _tmp$8 = i + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return arr;
  }
  function _M0MPC15array5Array18from__fixed__arrayGRP26mizchi8js__core3AnyE(arr) {
    const len = arr.length;
    return _M0MPC15array5Array44unsafe__make__and__blit__from__fixed_2einnerGRP26mizchi8js__core3AnyE(arr, len, len, 0, 0);
  }
  function _M0MPC15array5Array5clearGRP26mizchi7signals5OwnerE(self) {
    _M0MPC15array5Array28unsafe__truncate__to__lengthGRP26mizchi7signals5OwnerE(self, 0);
  }
  function _M0MPC15array5Array8containsGsE(self, value) {
    const _bind$19 = self.length;
    let _tmp$8 = 0;
    while (true) {
      const _ = _tmp$8;
      if (_ < _bind$19) {
        const v = self[_];
        if (v === value) {
          return true;
        }
        _tmp$8 = _ + 1 | 0;
        continue;
      } else {
        return false;
      }
    }
  }
  function _M0MPC13ref3Ref3RefGRPB5ArrayGRP36mizchi4luna3dom9ItemEntryGiEEE(x) {
    return new _M0TPC13ref3RefGRPB5ArrayGRP36mizchi4luna3dom9ItemEntryGiEEE(x);
  }
  function _M0MPC13ref3Ref3RefGiE(x) {
    return new _M0TPC13ref3RefGiE(x);
  }
  function _M0MPC13ref3Ref3RefGbE(x) {
    return new _M0TPC13ref3RefGbE(x);
  }
  function _M0MPC13ref3Ref3RefGORPB5ArrayGWEuEE(x) {
    return new _M0TPC13ref3RefGORPB5ArrayGWEuEE(x);
  }
  function _M0FP26mizchi8js__core11array__from(v) {
    return _M0MPC15array5Array18from__fixed__arrayGRP26mizchi8js__core3AnyE(_M0FP26mizchi8js__core16ffi__array__from(v));
  }
  function _M0FP26mizchi8js__core16identity__optionGRP36mizchi11js__browser3dom7ElementE(v) {
    return _M0FP26mizchi8js__core11is__nullish(v) ? _M0DTPC16option6OptionGRP36mizchi11js__browser3dom7ElementE4None__ : new _M0DTPC16option6OptionGRP36mizchi11js__browser3dom7ElementE4Some(v);
  }
  function _M0MP36mizchi11js__browser3dom4Node8nodeType(self) {
    return _M0MP26mizchi8js__core3Any5__get(self, "nodeType");
  }
  function _M0MP36mizchi11js__browser3dom4Node10parentNode(self) {
    const v = _M0MP26mizchi8js__core3Any5__get(self, "parentNode");
    return _M0FP26mizchi8js__core16identity__optionGRP36mizchi11js__browser3dom7ElementE(v);
  }
  function _M0MP36mizchi11js__browser3dom4Node10childNodes(self) {
    const arr = _M0MP26mizchi8js__core3Any5__get(self, "childNodes");
    const _p = _M0FP26mizchi8js__core11array__from(arr);
    const _p$2 = new Array(_p.length);
    const _p$3 = _p.length;
    let _tmp$8 = 0;
    while (true) {
      const _p$4 = _tmp$8;
      if (_p$4 < _p$3) {
        const _p$5 = _p[_p$4];
        _p$2[_p$4] = _p$5;
        _tmp$8 = _p$4 + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return _p$2;
  }
  function _M0MP36mizchi11js__browser3dom4Node10firstChild(self) {
    const v = _M0MP26mizchi8js__core3Any5__get(self, "firstChild");
    return _M0FP26mizchi8js__core16identity__optionGRP36mizchi11js__browser3dom7ElementE(v);
  }
  function _M0MP36mizchi11js__browser3dom4Node11appendChild(self, child) {
    return _M0MP26mizchi8js__core3Any6__call(self, "appendChild", [child]);
  }
  function _M0MP36mizchi11js__browser3dom4Node11removeChild(self, child) {
    return _M0MP26mizchi8js__core3Any6__call(self, "removeChild", [child]);
  }
  function _M0MP36mizchi11js__browser3dom4Node12insertBefore(self, new_node, ref_node) {
    if (ref_node.$tag === 1) {
      const _Some = ref_node;
      const _node = _Some._0;
      return _M0MP26mizchi8js__core3Any6__call(self, "insertBefore", [new_node, _node]);
    } else {
      return _M0MP26mizchi8js__core3Any6__call(self, "insertBefore", [new_node, _M0FP26mizchi8js__core4null()]);
    }
  }
  function _M0MP36mizchi11js__browser3dom4Node14setTextContent(self, content) {
    _M0MP26mizchi8js__core3Any5__set(self, "textContent", content);
  }
  function _M0MP36mizchi11js__browser3dom7Element12setClassName(self, class_name) {
    _M0MP26mizchi8js__core3Any5__set(self, "className", class_name);
  }
  function _M0MP36mizchi11js__browser3dom7Element12setAttribute(self, name, value) {
    _M0MP26mizchi8js__core3Any6__call(self, "setAttribute", [name, value]);
  }
  function _M0MP36mizchi11js__browser3dom7Element15removeAttribute(self, name) {
    _M0MP26mizchi8js__core3Any6__call(self, "removeAttribute", [name]);
  }
  function _M0MP36mizchi11js__browser3dom8Document14getElementById(self, id) {
    const v = _M0MP26mizchi8js__core3Any6__call(self, "getElementById", [id]);
    return _M0FP26mizchi8js__core16identity__optionGRP36mizchi11js__browser3dom7ElementE(v);
  }
  function _M0MP36mizchi11js__browser3dom8Document22createDocumentFragment(self) {
    return _M0MP26mizchi8js__core3Any6__call(self, "createDocumentFragment", []);
  }
  function _M0MP36mizchi11js__browser3dom8Document13createComment(self, data) {
    return _M0MP26mizchi8js__core3Any6__call(self, "createComment", [data]);
  }
  function _M0MP26mizchi7signals5Flags10set__value(self, v) {
    self.value = v;
  }
  function _M0MP26mizchi7signals13ReactiveFlags7to__int(self) {
    switch (self) {
      case 0: {
        return 0;
      }
      case 1: {
        return 1;
      }
      case 2: {
        return 2;
      }
      case 4: {
        return 4;
      }
      case 8: {
        return 8;
      }
      case 16: {
        return 16;
      }
      default: {
        return 32;
      }
    }
  }
  function _M0FP26mizchi7signals11purge__deps(sub) {
    const _bind$19 = sub.deps_tail;
    let current_dep;
    if (_bind$19 === undefined) {
      current_dep = sub.deps;
    } else {
      const _Some = _bind$19;
      const _dt = _Some;
      current_dep = _dt.next_dep;
    }
    while (true) {
      const _bind$20 = current_dep;
      if (_bind$20 === undefined) {
        return;
      } else {
        const _Some = _bind$20;
        const _d = _Some;
        current_dep = _M0FP26mizchi7signals6unlink(_d, sub);
        continue;
      }
    }
  }
  function _M0FP26mizchi7signals6unlink(lnk, sub) {
    const dep = lnk.dep;
    const prev_dep = lnk.prev_dep;
    const next_dep = lnk.next_dep;
    const next_sub = lnk.next_sub;
    const prev_sub = lnk.prev_sub;
    if (next_dep === undefined) {
      sub.deps_tail = prev_dep;
    } else {
      const _Some = next_dep;
      const _nd = _Some;
      _nd.prev_dep = prev_dep;
    }
    if (prev_dep === undefined) {
      sub.deps = next_dep;
    } else {
      const _Some = prev_dep;
      const _pd = _Some;
      _pd.next_dep = next_dep;
    }
    if (next_sub === undefined) {
      dep.subs_tail = prev_sub;
    } else {
      const _Some = next_sub;
      const _ns = _Some;
      _ns.prev_sub = prev_sub;
    }
    if (prev_sub === undefined) {
      dep.subs = next_sub;
      if (next_sub === undefined) {
        _M0FP26mizchi7signals9unwatched(dep);
      }
    } else {
      const _Some = prev_sub;
      const _ps = _Some;
      _ps.next_sub = next_sub;
    }
    return next_dep;
  }
  function _M0FP26mizchi7signals9unwatched(node) {
    const _p = node.flags;
    const flags = _p.value;
    const is_mutable = (flags & _M0MP26mizchi7signals13ReactiveFlags7to__int(1)) !== 0;
    if (!is_mutable) {
      _M0FP26mizchi7signals13cleanup__node(node);
      return;
    } else {
      const _bind$19 = node.deps_tail;
      if (_bind$19 === undefined) {
        return;
      } else {
        node.deps_tail = undefined;
        _M0MP26mizchi7signals5Flags10set__value(node.flags, _M0MP26mizchi7signals13ReactiveFlags7to__int(1) | _M0MP26mizchi7signals13ReactiveFlags7to__int(16));
        _M0FP26mizchi7signals11purge__deps(node);
        return;
      }
    }
  }
  function _M0FP26mizchi7signals13cleanup__node(node) {
    node.deps_tail = undefined;
    _M0MP26mizchi7signals5Flags10set__value(node.flags, _M0MP26mizchi7signals13ReactiveFlags7to__int(0));
    _M0FP26mizchi7signals11purge__deps(node);
    const _bind$19 = node.subs;
    if (_bind$19 === undefined) {
      return;
    } else {
      const _Some = _bind$19;
      const _sub = _Some;
      _M0FP26mizchi7signals6unlink(_sub, _sub.sub);
      return;
    }
  }
  function _M0FP26mizchi7signals21cleanup__effect__node(node) {
    node.deps_tail = undefined;
    _M0MP26mizchi7signals5Flags10set__value(node.flags, _M0MP26mizchi7signals13ReactiveFlags7to__int(0));
    node.effect_callback = undefined;
    _M0FP26mizchi7signals11purge__deps(node);
    const _bind$19 = node.subs;
    if (_bind$19 === undefined) {
      return;
    } else {
      const _Some = _bind$19;
      const _sub = _Some;
      _M0FP26mizchi7signals6unlink(_sub, _sub.sub);
      return;
    }
  }
  function _M0FP26mizchi7signals19core__run__cleanups(cleanups) {
    let _tmp$8 = cleanups.length - 1 | 0;
    while (true) {
      const i = _tmp$8;
      if (i >= 0) {
        const _func = _M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(cleanups, i);
        _func();
        _tmp$8 = i - 1 | 0;
        continue;
      } else {
        break;
      }
    }
    _M0MPC15array5Array5clearGRP26mizchi7signals5OwnerE(cleanups);
  }
  function _M0FP26mizchi7signals10inc__cycle() {
    _M0FP26mizchi7signals5cycle.val = _M0FP26mizchi7signals5cycle.val + 1 | 0;
  }
  function _M0FP26mizchi7signals4link(dep, sub, version) {
    const prev_dep = sub.deps_tail;
    if (prev_dep === undefined) {
    } else {
      const _Some = prev_dep;
      const _pd = _Some;
      if (_pd.dep === dep) {
        return undefined;
      }
    }
    let next_dep;
    if (prev_dep === undefined) {
      next_dep = sub.deps;
    } else {
      const _Some = prev_dep;
      const _pd = _Some;
      next_dep = _pd.next_dep;
    }
    if (next_dep === undefined) {
    } else {
      const _Some = next_dep;
      const _nd = _Some;
      if (_nd.dep === dep) {
        _nd.version = version;
        sub.deps_tail = _nd;
        return undefined;
      }
    }
    const _bind$19 = dep.subs_tail;
    if (_bind$19 === undefined) {
    } else {
      const _Some = _bind$19;
      const _ps = _Some;
      if (_ps.version === version && _ps.sub === sub) {
        return undefined;
      }
    }
    const _bind$20 = dep.subs_tail;
    const _bind$21 = undefined;
    const new_link = new _M0TP26mizchi7signals4Link(version, dep, sub, _bind$20, _bind$21, prev_dep, next_dep);
    sub.deps_tail = new_link;
    if (next_dep === undefined) {
    } else {
      const _Some = next_dep;
      const _nd = _Some;
      _nd.prev_dep = new_link;
    }
    if (prev_dep === undefined) {
      sub.deps = new_link;
    } else {
      const _Some = prev_dep;
      const _pd = _Some;
      _pd.next_dep = new_link;
    }
    const _bind$22 = new_link.prev_sub;
    if (_bind$22 === undefined) {
      dep.subs = new_link;
    } else {
      const _Some = _bind$22;
      const _ps = _Some;
      _ps.next_sub = new_link;
    }
    dep.subs_tail = new_link;
  }
  function _M0FP26mizchi7signals16set__active__sub(sub) {
    const prev = _M0FP26mizchi7signals11active__sub.val;
    _M0FP26mizchi7signals11active__sub.val = sub;
    return prev;
  }
  function _M0MP26mizchi7signals5Flags3new(initial) {
    return new _M0TP26mizchi7signals5Flags(initial);
  }
  function _M0MP26mizchi7signals12ReactiveNode3new(flags) {
    return new _M0TP26mizchi7signals12ReactiveNode(undefined, undefined, undefined, undefined, _M0MP26mizchi7signals5Flags3new(flags), 0, undefined);
  }
  function _M0FP26mizchi7signals20core__render__effect(fn_) {
    const cleanups = [];
    const node = _M0MP26mizchi7signals12ReactiveNode3new(_M0MP26mizchi7signals13ReactiveFlags7to__int(2) | _M0MP26mizchi7signals13ReactiveFlags7to__int(4));
    node.effect_callback = () => {
      const _p = node.flags;
      const flags = _p.value;
      const dirty_flag = _M0MP26mizchi7signals13ReactiveFlags7to__int(16);
      const pending_flag = _M0MP26mizchi7signals13ReactiveFlags7to__int(32);
      const should_run = (flags & dirty_flag) !== 0 || (flags & pending_flag) !== 0;
      if (should_run) {
        _M0FP26mizchi7signals10inc__cycle();
        node.deps_tail = undefined;
        _M0MP26mizchi7signals5Flags10set__value(node.flags, _M0MP26mizchi7signals13ReactiveFlags7to__int(2) | _M0MP26mizchi7signals13ReactiveFlags7to__int(4));
        _M0FP26mizchi7signals19core__run__cleanups(cleanups);
        const prev_sub = _M0FP26mizchi7signals16set__active__sub(node);
        const prev_cleanups = _M0FP26mizchi7signals23core__current__cleanups.val;
        _M0FP26mizchi7signals23core__current__cleanups.val = new _M0DTPC16option6OptionGRPB5ArrayGWEuEE4Some(cleanups);
        fn_();
        _M0FP26mizchi7signals23core__current__cleanups.val = prev_cleanups;
        _M0FP26mizchi7signals16set__active__sub(prev_sub);
        const _p$2 = node.flags;
        const current_flags = _p$2.value;
        _M0MP26mizchi7signals5Flags10set__value(node.flags, current_flags & (_M0MP26mizchi7signals13ReactiveFlags7to__int(4) ^ -1));
        _M0FP26mizchi7signals11purge__deps(node);
        return;
      } else {
        _M0MP26mizchi7signals5Flags10set__value(node.flags, _M0MP26mizchi7signals13ReactiveFlags7to__int(2));
        return;
      }
    };
    const prev_sub = _M0FP26mizchi7signals16set__active__sub(node);
    if (prev_sub === undefined) {
    } else {
      const _Some = prev_sub;
      const _ps = _Some;
      _M0FP26mizchi7signals4link(node, _ps, 0);
    }
    const prev_cleanups = _M0FP26mizchi7signals23core__current__cleanups.val;
    _M0FP26mizchi7signals23core__current__cleanups.val = new _M0DTPC16option6OptionGRPB5ArrayGWEuEE4Some(cleanups);
    fn_();
    _M0FP26mizchi7signals23core__current__cleanups.val = prev_cleanups;
    _M0FP26mizchi7signals16set__active__sub(prev_sub);
    const _p = node.flags;
    const flags = _p.value;
    _M0MP26mizchi7signals5Flags10set__value(node.flags, flags & (_M0MP26mizchi7signals13ReactiveFlags7to__int(4) ^ -1));
    return () => {
      _M0FP26mizchi7signals19core__run__cleanups(cleanups);
      _M0FP26mizchi7signals21cleanup__effect__node(node);
    };
  }
  function _M0FP26mizchi7signals18register__disposer(disposer) {
    const _bind$19 = _M0FP26mizchi7signals17reactive__context.current_owner;
    if (_bind$19 === undefined) {
      return;
    } else {
      const _Some = _bind$19;
      const _owner = _Some;
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(_owner.disposers, disposer);
      return;
    }
  }
  function _M0FP26mizchi7signals22set__current__cleanups(cleanups) {
    const prev = _M0FP26mizchi7signals17reactive__context.current_cleanups;
    _M0FP26mizchi7signals17reactive__context.current_cleanups = cleanups;
    return prev;
  }
  function _M0FP26mizchi7signals28run__with__cleanup__trackingGuE(cleanups, f) {
    const prev = _M0FP26mizchi7signals22set__current__cleanups(new _M0DTPC16option6OptionGRPB5ArrayGWEuEE4Some(cleanups));
    f();
    _M0FP26mizchi7signals17reactive__context.current_cleanups = prev;
  }
  function _M0FP26mizchi7signals14render__effect(fn_) {
    const cleanups = [];
    const wrapped_fn = () => {
      let _tmp$8 = cleanups.length - 1 | 0;
      while (true) {
        const i = _tmp$8;
        if (i >= 0) {
          const _func = _M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(cleanups, i);
          _func();
          _tmp$8 = i - 1 | 0;
          continue;
        } else {
          break;
        }
      }
      _M0MPC15array5Array5clearGRP26mizchi7signals5OwnerE(cleanups);
      _M0FP26mizchi7signals28run__with__cleanup__trackingGuE(cleanups, fn_);
    };
    const dispose = _M0FP26mizchi7signals20core__render__effect(wrapped_fn);
    const full_dispose = () => {
      let _tmp$8 = cleanups.length - 1 | 0;
      while (true) {
        const i = _tmp$8;
        if (i >= 0) {
          const _func = _M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(cleanups, i);
          _func();
          _tmp$8 = i - 1 | 0;
          continue;
        } else {
          break;
        }
      }
      _M0MPC15array5Array5clearGRP26mizchi7signals5OwnerE(cleanups);
      dispose();
    };
    _M0FP26mizchi7signals18register__disposer(full_dispose);
    return full_dispose;
  }
  function _M0MP26mizchi7signals5Flags5unset(self, flag) {
    self.value = self.value & (_M0MP26mizchi7signals13ReactiveFlags7to__int(flag) ^ -1);
  }
  function _M0FP26mizchi7signals14notify__effect(node) {
    const _bind$19 = node.effect_callback;
    if (_bind$19 === undefined) {
      return;
    } else {
      const _Some = _bind$19;
      const _callback = _Some;
      let already_queued = false;
      const _bind$20 = _M0FP26mizchi7signals22callback__queue__nodes.length;
      let _tmp$8 = 0;
      while (true) {
        const _ = _tmp$8;
        if (_ < _bind$20) {
          const n = _M0FP26mizchi7signals22callback__queue__nodes[_];
          if (n === node) {
            already_queued = true;
            break;
          }
          _tmp$8 = _ + 1 | 0;
          continue;
        } else {
          break;
        }
      }
      if (!already_queued) {
        _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(_M0FP26mizchi7signals15callback__queue, _callback);
        _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(_M0FP26mizchi7signals22callback__queue__nodes, node);
        _M0MP26mizchi7signals5Flags5unset(node.flags, 2);
        return;
      } else {
        return;
      }
    }
  }
  function _M0FP26mizchi7signals18shallow__propagate(start_link) {
    let current_link = start_link;
    while (true) {
      const _bind$19 = current_link;
      if (_bind$19 === undefined) {
        return;
      } else {
        const _Some = _bind$19;
        const _lnk = _Some;
        const sub = _lnk.sub;
        const _p = sub.flags;
        const flags = _p.value;
        const pending_flag = _M0MP26mizchi7signals13ReactiveFlags7to__int(32);
        const dirty_flag = _M0MP26mizchi7signals13ReactiveFlags7to__int(16);
        const watching_flag = _M0MP26mizchi7signals13ReactiveFlags7to__int(2);
        const recursed_check_flag = _M0MP26mizchi7signals13ReactiveFlags7to__int(4);
        if ((flags & (pending_flag | dirty_flag)) === pending_flag) {
          _M0MP26mizchi7signals5Flags10set__value(sub.flags, flags | dirty_flag);
          if ((flags & (watching_flag | recursed_check_flag)) === watching_flag) {
            _M0FP26mizchi7signals14notify__effect(sub);
          }
        }
        current_link = _lnk.next_sub;
        continue;
      }
    }
  }
  function _M0MP26mizchi7signals10CoreSignal3getGRP314vlmkit_2dsites4wiki4main5RouteE(self) {
    const _p = self.node.flags;
    const flags = _p.value;
    const dirty_flag = _M0MP26mizchi7signals13ReactiveFlags7to__int(16);
    if ((flags & dirty_flag) !== 0) {
      if (!(self.current_value === self.pending_value)) {
        self.current_value = self.pending_value;
        const _bind$19 = self.node.subs;
        if (_bind$19 === undefined) {
        } else {
          const _Some = _bind$19;
          const _subs = _Some;
          _M0FP26mizchi7signals18shallow__propagate(_subs);
        }
      }
      _M0MP26mizchi7signals5Flags10set__value(self.node.flags, _M0MP26mizchi7signals13ReactiveFlags7to__int(1));
    }
    let found_sub = _M0FP26mizchi7signals11active__sub.val;
    while (true) {
      const _bind$19 = found_sub;
      if (_bind$19 === undefined) {
        break;
      } else {
        const _Some = _bind$19;
        const _s = _Some;
        const _p$2 = _s.flags;
        const sub_flags = _p$2.value;
        const mutable_flag = _M0MP26mizchi7signals13ReactiveFlags7to__int(1);
        const watching_flag = _M0MP26mizchi7signals13ReactiveFlags7to__int(2);
        if ((sub_flags & (mutable_flag | watching_flag)) !== 0) {
          _M0FP26mizchi7signals4link(self.node, _s, _M0FP26mizchi7signals5cycle.val);
          break;
        }
        const _bind$20 = _s.subs;
        let _tmp$8;
        if (_bind$20 === undefined) {
          _tmp$8 = undefined;
        } else {
          const _Some$2 = _bind$20;
          const _subs = _Some$2;
          _tmp$8 = _subs.sub;
        }
        found_sub = _tmp$8;
        continue;
      }
    }
    return self.current_value;
  }
  function _M0MP26mizchi7signals10CoreSignal3getGiE(self) {
    const _p = self.node.flags;
    const flags = _p.value;
    const dirty_flag = _M0MP26mizchi7signals13ReactiveFlags7to__int(16);
    if ((flags & dirty_flag) !== 0) {
      if (!(self.current_value === self.pending_value)) {
        self.current_value = self.pending_value;
        const _bind$19 = self.node.subs;
        if (_bind$19 === undefined) {
        } else {
          const _Some = _bind$19;
          const _subs = _Some;
          _M0FP26mizchi7signals18shallow__propagate(_subs);
        }
      }
      _M0MP26mizchi7signals5Flags10set__value(self.node.flags, _M0MP26mizchi7signals13ReactiveFlags7to__int(1));
    }
    let found_sub = _M0FP26mizchi7signals11active__sub.val;
    while (true) {
      const _bind$19 = found_sub;
      if (_bind$19 === undefined) {
        break;
      } else {
        const _Some = _bind$19;
        const _s = _Some;
        const _p$2 = _s.flags;
        const sub_flags = _p$2.value;
        const mutable_flag = _M0MP26mizchi7signals13ReactiveFlags7to__int(1);
        const watching_flag = _M0MP26mizchi7signals13ReactiveFlags7to__int(2);
        if ((sub_flags & (mutable_flag | watching_flag)) !== 0) {
          _M0FP26mizchi7signals4link(self.node, _s, _M0FP26mizchi7signals5cycle.val);
          break;
        }
        const _bind$20 = _s.subs;
        let _tmp$8;
        if (_bind$20 === undefined) {
          _tmp$8 = undefined;
        } else {
          const _Some$2 = _bind$20;
          const _subs = _Some$2;
          _tmp$8 = _subs.sub;
        }
        found_sub = _tmp$8;
        continue;
      }
    }
    return self.current_value;
  }
  function _M0MP26mizchi7signals10CoreSignal3getGORP314vlmkit_2dsites4wiki4main7PreviewE(self) {
    const _p = self.node.flags;
    const flags = _p.value;
    const dirty_flag = _M0MP26mizchi7signals13ReactiveFlags7to__int(16);
    if ((flags & dirty_flag) !== 0) {
      if (!(self.current_value === self.pending_value)) {
        self.current_value = self.pending_value;
        const _bind$19 = self.node.subs;
        if (_bind$19 === undefined) {
        } else {
          const _Some = _bind$19;
          const _subs = _Some;
          _M0FP26mizchi7signals18shallow__propagate(_subs);
        }
      }
      _M0MP26mizchi7signals5Flags10set__value(self.node.flags, _M0MP26mizchi7signals13ReactiveFlags7to__int(1));
    }
    let found_sub = _M0FP26mizchi7signals11active__sub.val;
    while (true) {
      const _bind$19 = found_sub;
      if (_bind$19 === undefined) {
        break;
      } else {
        const _Some = _bind$19;
        const _s = _Some;
        const _p$2 = _s.flags;
        const sub_flags = _p$2.value;
        const mutable_flag = _M0MP26mizchi7signals13ReactiveFlags7to__int(1);
        const watching_flag = _M0MP26mizchi7signals13ReactiveFlags7to__int(2);
        if ((sub_flags & (mutable_flag | watching_flag)) !== 0) {
          _M0FP26mizchi7signals4link(self.node, _s, _M0FP26mizchi7signals5cycle.val);
          break;
        }
        const _bind$20 = _s.subs;
        let _tmp$8;
        if (_bind$20 === undefined) {
          _tmp$8 = undefined;
        } else {
          const _Some$2 = _bind$20;
          const _subs = _Some$2;
          _tmp$8 = _subs.sub;
        }
        found_sub = _tmp$8;
        continue;
      }
    }
    return self.current_value;
  }
  function _M0MP26mizchi7signals10CoreSignal3getGbE(self) {
    const _p = self.node.flags;
    const flags = _p.value;
    const dirty_flag = _M0MP26mizchi7signals13ReactiveFlags7to__int(16);
    if ((flags & dirty_flag) !== 0) {
      if (!(self.current_value === self.pending_value)) {
        self.current_value = self.pending_value;
        const _bind$19 = self.node.subs;
        if (_bind$19 === undefined) {
        } else {
          const _Some = _bind$19;
          const _subs = _Some;
          _M0FP26mizchi7signals18shallow__propagate(_subs);
        }
      }
      _M0MP26mizchi7signals5Flags10set__value(self.node.flags, _M0MP26mizchi7signals13ReactiveFlags7to__int(1));
    }
    let found_sub = _M0FP26mizchi7signals11active__sub.val;
    while (true) {
      const _bind$19 = found_sub;
      if (_bind$19 === undefined) {
        break;
      } else {
        const _Some = _bind$19;
        const _s = _Some;
        const _p$2 = _s.flags;
        const sub_flags = _p$2.value;
        const mutable_flag = _M0MP26mizchi7signals13ReactiveFlags7to__int(1);
        const watching_flag = _M0MP26mizchi7signals13ReactiveFlags7to__int(2);
        if ((sub_flags & (mutable_flag | watching_flag)) !== 0) {
          _M0FP26mizchi7signals4link(self.node, _s, _M0FP26mizchi7signals5cycle.val);
          break;
        }
        const _bind$20 = _s.subs;
        let _tmp$8;
        if (_bind$20 === undefined) {
          _tmp$8 = undefined;
        } else {
          const _Some$2 = _bind$20;
          const _subs = _Some$2;
          _tmp$8 = _subs.sub;
        }
        found_sub = _tmp$8;
        continue;
      }
    }
    return self.current_value;
  }
  function _M0MP26mizchi7signals6Signal3getGRP314vlmkit_2dsites4wiki4main5RouteE(self) {
    return _M0MP26mizchi7signals10CoreSignal3getGRP314vlmkit_2dsites4wiki4main5RouteE(self.inner);
  }
  function _M0MP26mizchi7signals6Signal3getGiE(self) {
    return _M0MP26mizchi7signals10CoreSignal3getGiE(self.inner);
  }
  function _M0MP26mizchi7signals6Signal3getGORP314vlmkit_2dsites4wiki4main7PreviewE(self) {
    return _M0MP26mizchi7signals10CoreSignal3getGORP314vlmkit_2dsites4wiki4main7PreviewE(self.inner);
  }
  function _M0MP26mizchi7signals6Signal3getGbE(self) {
    return _M0MP26mizchi7signals10CoreSignal3getGbE(self.inner);
  }
  function _M0FP26mizchi7signals12check__dirty(start_link, sub, update_fn) {
    let current_link = start_link;
    const dirty_flag = _M0MP26mizchi7signals13ReactiveFlags7to__int(16);
    const mutable_flag = _M0MP26mizchi7signals13ReactiveFlags7to__int(1);
    while (true) {
      const _bind$19 = current_link;
      if (_bind$19 === undefined) {
        break;
      } else {
        const _Some = _bind$19;
        const _lnk = _Some;
        const dep = _lnk.dep;
        const _p = dep.flags;
        const flags = _p.value;
        const _p$2 = sub.flags;
        if ((_p$2.value & dirty_flag) !== 0) {
          return true;
        }
        if ((flags & (mutable_flag | dirty_flag)) === (mutable_flag | dirty_flag)) {
          if (update_fn(dep)) {
            const _bind$20 = dep.subs;
            if (_bind$20 === undefined) {
            } else {
              const _Some$2 = _bind$20;
              const _subs = _Some$2;
              const _bind$21 = _subs.next_sub;
              if (_bind$21 === undefined) {
              } else {
                _M0FP26mizchi7signals18shallow__propagate(_subs);
              }
            }
            return true;
          }
        }
        current_link = _lnk.next_dep;
        continue;
      }
    }
    return false;
  }
  function _M0FP26mizchi7signals11run__effect(e) {
    const _p = e.node.flags;
    const flags = _p.value;
    const dirty_flag = _M0MP26mizchi7signals13ReactiveFlags7to__int(16);
    const pending_flag = _M0MP26mizchi7signals13ReactiveFlags7to__int(32);
    const _bind$19 = e.node.deps;
    let is_deps_dirty;
    if (_bind$19 === undefined) {
      is_deps_dirty = false;
    } else {
      const _Some = _bind$19;
      const _deps = _Some;
      is_deps_dirty = _M0FP26mizchi7signals12check__dirty(_deps, e.node, (_discard_) => false);
    }
    const should_run = (flags & dirty_flag) !== 0 || (flags & pending_flag) !== 0 && is_deps_dirty;
    if (should_run) {
      _M0FP26mizchi7signals10inc__cycle();
      e.node.deps_tail = undefined;
      _M0MP26mizchi7signals5Flags10set__value(e.node.flags, _M0MP26mizchi7signals13ReactiveFlags7to__int(2) | _M0MP26mizchi7signals13ReactiveFlags7to__int(4));
      const prev_sub = _M0FP26mizchi7signals16set__active__sub(e.node);
      const _func = e.run_fn;
      _func();
      _M0FP26mizchi7signals16set__active__sub(prev_sub);
      const _p$2 = e.node.flags;
      const current_flags = _p$2.value;
      _M0MP26mizchi7signals5Flags10set__value(e.node.flags, current_flags & (_M0MP26mizchi7signals13ReactiveFlags7to__int(4) ^ -1));
      _M0FP26mizchi7signals11purge__deps(e.node);
      return;
    } else {
      _M0MP26mizchi7signals5Flags10set__value(e.node.flags, _M0MP26mizchi7signals13ReactiveFlags7to__int(2));
      return;
    }
  }
  function _M0FP26mizchi7signals5flush() {
    while (true) {
      if (_M0FP26mizchi7signals13notify__index.val < _M0FP26mizchi7signals14queued__length.val) {
        const _bind$19 = _M0MPC15array5Array2atGORP26mizchi7signals10EffectNodeE(_M0FP26mizchi7signals6queued, _M0FP26mizchi7signals13notify__index.val);
        if (_bind$19 === undefined) {
          _M0FP26mizchi7signals13notify__index.val = _M0FP26mizchi7signals13notify__index.val + 1 | 0;
        } else {
          const _Some = _bind$19;
          const _eff = _Some;
          _M0MPC15array5Array3setGORP26mizchi7signals10EffectNodeE(_M0FP26mizchi7signals6queued, _M0FP26mizchi7signals13notify__index.val, undefined);
          _M0FP26mizchi7signals13notify__index.val = _M0FP26mizchi7signals13notify__index.val + 1 | 0;
          _M0FP26mizchi7signals11run__effect(_eff);
        }
        continue;
      } else {
        break;
      }
    }
    _M0FP26mizchi7signals13notify__index.val = 0;
    _M0FP26mizchi7signals14queued__length.val = 0;
    while (true) {
      if (_M0FP26mizchi7signals15callback__queue.length > 0) {
        const callback = _M0MPC15array5Array6removeGWEuE(_M0FP26mizchi7signals15callback__queue, 0);
        _M0MPC15array5Array6removeGWEuE(_M0FP26mizchi7signals22callback__queue__nodes, 0);
        callback();
        continue;
      } else {
        return;
      }
    }
  }
  function _M0FP26mizchi7signals15is__valid__link(check_link, sub) {
    let current_link = sub.deps_tail;
    while (true) {
      const _bind$19 = current_link;
      if (_bind$19 === undefined) {
        break;
      } else {
        const _Some = _bind$19;
        const _l = _Some;
        if (_l === check_link) {
          return true;
        }
        current_link = _l.prev_dep;
        continue;
      }
    }
    return false;
  }
  function _M0FP26mizchi7signals9propagate(start_link) {
    const link_ref = _M0MPC13ref3Ref3RefGRPB5ArrayGRP36mizchi4luna3dom9ItemEntryGiEEE(start_link);
    const next_ref = _M0MPC13ref3Ref3RefGRPB5ArrayGRP36mizchi4luna3dom9ItemEntryGiEEE(start_link.next_sub);
    const stack = [];
    let running = true;
    while (true) {
      if (running) {
        const _bind$19 = link_ref.val;
        if (_bind$19 === undefined) {
          if (stack.length > 0) {
            const _bind$20 = _M0MPC15array5Array3popGUORP26mizchi7signals4LinkORP26mizchi7signals4LinkEE(stack);
            if (_bind$20 === undefined) {
              running = false;
            } else {
              const _Some = _bind$20;
              const _x = _Some;
              const _l = _x._0;
              link_ref.val = _l;
              let _tmp$8;
              if (_l === undefined) {
                _tmp$8 = undefined;
              } else {
                const _Some$2 = _l;
                const _lnk = _Some$2;
                _tmp$8 = _lnk.next_sub;
              }
              next_ref.val = _tmp$8;
            }
          } else {
            running = false;
          }
        } else {
          const _Some = _bind$19;
          const _lnk = _Some;
          const sub = _lnk.sub;
          const _p = sub.flags;
          const flags = _p.value;
          const mutable_flag = _M0MP26mizchi7signals13ReactiveFlags7to__int(1);
          const watching_flag = _M0MP26mizchi7signals13ReactiveFlags7to__int(2);
          const recursed_check_flag = _M0MP26mizchi7signals13ReactiveFlags7to__int(4);
          const recursed_flag = _M0MP26mizchi7signals13ReactiveFlags7to__int(8);
          const dirty_flag = _M0MP26mizchi7signals13ReactiveFlags7to__int(16);
          const pending_flag = _M0MP26mizchi7signals13ReactiveFlags7to__int(32);
          let new_flags = flags;
          let should_notify = false;
          let should_propagate_subs = false;
          if ((flags & (recursed_check_flag | recursed_flag | dirty_flag | pending_flag)) === 0) {
            new_flags = flags | pending_flag;
            _M0MP26mizchi7signals5Flags10set__value(sub.flags, new_flags);
          } else {
            if ((flags & (recursed_check_flag | recursed_flag)) === 0) {
              new_flags = _M0MP26mizchi7signals13ReactiveFlags7to__int(0);
            } else {
              if ((flags & recursed_check_flag) === 0) {
                new_flags = flags & (recursed_flag ^ -1) | pending_flag;
                _M0MP26mizchi7signals5Flags10set__value(sub.flags, new_flags);
              } else {
                if ((flags & (dirty_flag | pending_flag)) === 0 && _M0FP26mizchi7signals15is__valid__link(_lnk, sub)) {
                  new_flags = flags | recursed_flag | pending_flag;
                  _M0MP26mizchi7signals5Flags10set__value(sub.flags, new_flags);
                  new_flags = new_flags & mutable_flag;
                } else {
                  new_flags = _M0MP26mizchi7signals13ReactiveFlags7to__int(0);
                }
              }
            }
          }
          if ((new_flags & watching_flag) !== 0) {
            should_notify = true;
          }
          if ((new_flags & mutable_flag) !== 0) {
            should_propagate_subs = true;
          }
          if (should_notify) {
            _M0FP26mizchi7signals14notify__effect(sub);
          }
          if (should_propagate_subs) {
            const _bind$20 = sub.subs;
            if (_bind$20 === undefined) {
              link_ref.val = next_ref.val;
              const _bind$21 = link_ref.val;
              if (_bind$21 === undefined) {
                next_ref.val = undefined;
              } else {
                const _Some$2 = _bind$21;
                const _l = _Some$2;
                next_ref.val = _l.next_sub;
              }
            } else {
              const _Some$2 = _bind$20;
              const _sub_subs = _Some$2;
              const _bind$21 = _sub_subs.next_sub;
              if (_bind$21 === undefined) {
              } else {
                _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(stack, { _0: next_ref.val, _1: undefined });
                next_ref.val = _sub_subs.next_sub;
              }
              link_ref.val = _sub_subs;
            }
          } else {
            link_ref.val = next_ref.val;
            const _bind$20 = link_ref.val;
            if (_bind$20 === undefined) {
              next_ref.val = undefined;
            } else {
              const _Some$2 = _bind$20;
              const _l = _Some$2;
              next_ref.val = _l.next_sub;
            }
          }
        }
        continue;
      } else {
        return;
      }
    }
  }
  function _M0FP26mizchi7signals12core__signalGRP314vlmkit_2dsites4wiki4main5RouteE(initial) {
    return new _M0TP26mizchi7signals10CoreSignalGRP314vlmkit_2dsites4wiki4main5RouteE(_M0MP26mizchi7signals12ReactiveNode3new(_M0MP26mizchi7signals13ReactiveFlags7to__int(1)), initial, initial);
  }
  function _M0FP26mizchi7signals12core__signalGORP314vlmkit_2dsites4wiki4main7PreviewE(initial) {
    return new _M0TP26mizchi7signals10CoreSignalGORP314vlmkit_2dsites4wiki4main7PreviewE(_M0MP26mizchi7signals12ReactiveNode3new(_M0MP26mizchi7signals13ReactiveFlags7to__int(1)), initial, initial);
  }
  function _M0FP26mizchi7signals12core__signalGiE(initial) {
    return new _M0TP26mizchi7signals10CoreSignalGiE(_M0MP26mizchi7signals12ReactiveNode3new(_M0MP26mizchi7signals13ReactiveFlags7to__int(1)), initial, initial);
  }
  function _M0FP26mizchi7signals12core__signalGbE(initial) {
    return new _M0TP26mizchi7signals10CoreSignalGbE(_M0MP26mizchi7signals12ReactiveNode3new(_M0MP26mizchi7signals13ReactiveFlags7to__int(1)), initial, initial);
  }
  function _M0MP26mizchi7signals6Signal3newGRP314vlmkit_2dsites4wiki4main5RouteE(initial) {
    return new _M0TP26mizchi7signals6SignalGRP314vlmkit_2dsites4wiki4main5RouteE(_M0FP26mizchi7signals12core__signalGRP314vlmkit_2dsites4wiki4main5RouteE(initial));
  }
  function _M0MP26mizchi7signals6Signal3newGORP314vlmkit_2dsites4wiki4main7PreviewE(initial) {
    return new _M0TP26mizchi7signals6SignalGORP314vlmkit_2dsites4wiki4main7PreviewE(_M0FP26mizchi7signals12core__signalGORP314vlmkit_2dsites4wiki4main7PreviewE(initial));
  }
  function _M0MP26mizchi7signals6Signal3newGiE(initial) {
    return new _M0TP26mizchi7signals6SignalGiE(_M0FP26mizchi7signals12core__signalGiE(initial));
  }
  function _M0MP26mizchi7signals6Signal3newGbE(initial) {
    return new _M0TP26mizchi7signals6SignalGbE(_M0FP26mizchi7signals12core__signalGbE(initial));
  }
  function _M0FP26mizchi7signals6signalGRP314vlmkit_2dsites4wiki4main5RouteE(initial) {
    return _M0MP26mizchi7signals6Signal3newGRP314vlmkit_2dsites4wiki4main5RouteE(initial);
  }
  function _M0FP26mizchi7signals6signalGORP314vlmkit_2dsites4wiki4main7PreviewE(initial) {
    return _M0MP26mizchi7signals6Signal3newGORP314vlmkit_2dsites4wiki4main7PreviewE(initial);
  }
  function _M0FP26mizchi7signals6signalGiE(initial) {
    return _M0MP26mizchi7signals6Signal3newGiE(initial);
  }
  function _M0FP26mizchi7signals6signalGbE(initial) {
    return _M0MP26mizchi7signals6Signal3newGbE(initial);
  }
  function _M0MP26mizchi7signals10CoreSignal3setGRP314vlmkit_2dsites4wiki4main5RouteE(self, value) {
    if (!(self.pending_value === value)) {
      self.pending_value = value;
      _M0FP26mizchi7signals10inc__cycle();
      self.node.last_modified_cycle = _M0FP26mizchi7signals5cycle.val;
      _M0MP26mizchi7signals5Flags10set__value(self.node.flags, _M0MP26mizchi7signals13ReactiveFlags7to__int(1) | _M0MP26mizchi7signals13ReactiveFlags7to__int(16));
      const _bind$19 = self.node.subs;
      if (_bind$19 === undefined) {
        return;
      } else {
        const _Some = _bind$19;
        const _subs = _Some;
        _M0FP26mizchi7signals9propagate(_subs);
        if (_M0FP26mizchi7signals12batch__depth.val === 0) {
          _M0FP26mizchi7signals5flush();
          return;
        } else {
          return;
        }
      }
    } else {
      return;
    }
  }
  function _M0MP26mizchi7signals10CoreSignal3setGiE(self, value) {
    if (!(self.pending_value === value)) {
      self.pending_value = value;
      _M0FP26mizchi7signals10inc__cycle();
      self.node.last_modified_cycle = _M0FP26mizchi7signals5cycle.val;
      _M0MP26mizchi7signals5Flags10set__value(self.node.flags, _M0MP26mizchi7signals13ReactiveFlags7to__int(1) | _M0MP26mizchi7signals13ReactiveFlags7to__int(16));
      const _bind$19 = self.node.subs;
      if (_bind$19 === undefined) {
        return;
      } else {
        const _Some = _bind$19;
        const _subs = _Some;
        _M0FP26mizchi7signals9propagate(_subs);
        if (_M0FP26mizchi7signals12batch__depth.val === 0) {
          _M0FP26mizchi7signals5flush();
          return;
        } else {
          return;
        }
      }
    } else {
      return;
    }
  }
  function _M0MP26mizchi7signals10CoreSignal3setGORP314vlmkit_2dsites4wiki4main7PreviewE(self, value) {
    if (!(self.pending_value === value)) {
      self.pending_value = value;
      _M0FP26mizchi7signals10inc__cycle();
      self.node.last_modified_cycle = _M0FP26mizchi7signals5cycle.val;
      _M0MP26mizchi7signals5Flags10set__value(self.node.flags, _M0MP26mizchi7signals13ReactiveFlags7to__int(1) | _M0MP26mizchi7signals13ReactiveFlags7to__int(16));
      const _bind$19 = self.node.subs;
      if (_bind$19 === undefined) {
        return;
      } else {
        const _Some = _bind$19;
        const _subs = _Some;
        _M0FP26mizchi7signals9propagate(_subs);
        if (_M0FP26mizchi7signals12batch__depth.val === 0) {
          _M0FP26mizchi7signals5flush();
          return;
        } else {
          return;
        }
      }
    } else {
      return;
    }
  }
  function _M0MP26mizchi7signals10CoreSignal3setGbE(self, value) {
    if (!(self.pending_value === value)) {
      self.pending_value = value;
      _M0FP26mizchi7signals10inc__cycle();
      self.node.last_modified_cycle = _M0FP26mizchi7signals5cycle.val;
      _M0MP26mizchi7signals5Flags10set__value(self.node.flags, _M0MP26mizchi7signals13ReactiveFlags7to__int(1) | _M0MP26mizchi7signals13ReactiveFlags7to__int(16));
      const _bind$19 = self.node.subs;
      if (_bind$19 === undefined) {
        return;
      } else {
        const _Some = _bind$19;
        const _subs = _Some;
        _M0FP26mizchi7signals9propagate(_subs);
        if (_M0FP26mizchi7signals12batch__depth.val === 0) {
          _M0FP26mizchi7signals5flush();
          return;
        } else {
          return;
        }
      }
    } else {
      return;
    }
  }
  function _M0MP26mizchi7signals6Signal3setGRP314vlmkit_2dsites4wiki4main5RouteE(self, new_value) {
    _M0MP26mizchi7signals10CoreSignal3setGRP314vlmkit_2dsites4wiki4main5RouteE(self.inner, new_value);
  }
  function _M0MP26mizchi7signals6Signal3setGiE(self, new_value) {
    _M0MP26mizchi7signals10CoreSignal3setGiE(self.inner, new_value);
  }
  function _M0MP26mizchi7signals6Signal3setGORP314vlmkit_2dsites4wiki4main7PreviewE(self, new_value) {
    _M0MP26mizchi7signals10CoreSignal3setGORP314vlmkit_2dsites4wiki4main7PreviewE(self.inner, new_value);
  }
  function _M0MP26mizchi7signals6Signal3setGbE(self, new_value) {
    _M0MP26mizchi7signals10CoreSignal3setGbE(self.inner, new_value);
  }
  function _M0FP26mizchi7signals6effect(fn_) {
    const active = _M0MPC13ref3Ref3RefGbE(true);
    const dispose_ref = _M0MPC13ref3Ref3RefGRPB5ArrayGRP36mizchi4luna3dom9ItemEntryGiEEE(undefined);
    const cleanups = [];
    const wrapped_fn = () => {
      let _tmp$8 = cleanups.length - 1 | 0;
      while (true) {
        const i = _tmp$8;
        if (i >= 0) {
          const _func = _M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(cleanups, i);
          _func();
          _tmp$8 = i - 1 | 0;
          continue;
        } else {
          break;
        }
      }
      _M0MPC15array5Array5clearGRP26mizchi7signals5OwnerE(cleanups);
      _M0FP26mizchi7signals28run__with__cleanup__trackingGuE(cleanups, fn_);
    };
    _M0FP26mizchi7signals16queue__microtask(() => {
      if (active.val) {
        dispose_ref.val = _M0FP26mizchi7signals20core__render__effect(wrapped_fn);
        return;
      } else {
        return;
      }
    });
    const dispose = () => {
      active.val = false;
      let _tmp$8 = cleanups.length - 1 | 0;
      while (true) {
        const i = _tmp$8;
        if (i >= 0) {
          const _func = _M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(cleanups, i);
          _func();
          _tmp$8 = i - 1 | 0;
          continue;
        } else {
          break;
        }
      }
      _M0MPC15array5Array5clearGRP26mizchi7signals5OwnerE(cleanups);
      const _bind$19 = dispose_ref.val;
      if (_bind$19 === undefined) {
        return;
      } else {
        const _Some = _bind$19;
        const _d = _Some;
        _d();
        return;
      }
    };
    _M0FP26mizchi7signals18register__disposer(dispose);
    return dispose;
  }
  function _M0MP26mizchi7signals10CoreSignal6updateGbE(self, f) {
    _M0MP26mizchi7signals10CoreSignal3setGbE(self, f(_M0MP26mizchi7signals10CoreSignal3getGbE(self)));
  }
  function _M0MP26mizchi7signals10CoreSignal6updateGRPB5ArrayGsEE(self, f) {
    _M0MP26mizchi7signals10CoreSignal3setGORP314vlmkit_2dsites4wiki4main7PreviewE(self, f(_M0MP26mizchi7signals10CoreSignal3getGORP314vlmkit_2dsites4wiki4main7PreviewE(self)));
  }
  function _M0MP26mizchi7signals6Signal6updateGbE(self, f) {
    _M0MP26mizchi7signals10CoreSignal6updateGbE(self.inner, f);
  }
  function _M0MP26mizchi7signals6Signal6updateGRPB5ArrayGsEE(self, f) {
    _M0MP26mizchi7signals10CoreSignal6updateGRPB5ArrayGsEE(self.inner, f);
  }
  function _M0FP26mizchi7signals16create__computedGRPB5ArrayGsEE(getter) {
    return new _M0TP26mizchi7signals8ComputedGRPB5ArrayGsEE(_M0MP26mizchi7signals12ReactiveNode3new(_M0MP26mizchi7signals13ReactiveFlags7to__int(0)), _M0DTPC16option6OptionGRPB5ArrayGsEE4None__, getter);
  }
  function _M0FP26mizchi7signals18check__deps__dirty(node) {
    const dirty_flag = _M0MP26mizchi7signals13ReactiveFlags7to__int(16);
    const pending_flag = _M0MP26mizchi7signals13ReactiveFlags7to__int(32);
    const mutable_flag = _M0MP26mizchi7signals13ReactiveFlags7to__int(1);
    let current_link = node.deps;
    while (true) {
      const _bind$19 = current_link;
      if (_bind$19 === undefined) {
        break;
      } else {
        const _Some = _bind$19;
        const _lnk = _Some;
        const dep = _lnk.dep;
        const _p = dep.flags;
        const dep_flags = _p.value;
        if ((dep_flags & mutable_flag) !== 0) {
          if (dep.last_modified_cycle > _lnk.version) {
            return true;
          }
          if ((dep_flags & (dirty_flag | pending_flag)) !== 0) {
            return true;
          }
        }
        current_link = _lnk.next_dep;
        continue;
      }
    }
    return false;
  }
  function _M0FP26mizchi7signals16update__computedGRPB5ArrayGsEE(c) {
    _M0FP26mizchi7signals10inc__cycle();
    c.node.deps_tail = undefined;
    _M0MP26mizchi7signals5Flags10set__value(c.node.flags, _M0MP26mizchi7signals13ReactiveFlags7to__int(1) | _M0MP26mizchi7signals13ReactiveFlags7to__int(4));
    const prev_sub = _M0FP26mizchi7signals16set__active__sub(c.node);
    const old_value = c.value;
    const _func = c.getter;
    const new_value = _func();
    c.value = new _M0DTPC16option6OptionGRPB5ArrayGsEE4Some(new_value);
    _M0FP26mizchi7signals16set__active__sub(prev_sub);
    const _p = c.node.flags;
    const current_flags = _p.value;
    _M0MP26mizchi7signals5Flags10set__value(c.node.flags, current_flags & (_M0MP26mizchi7signals13ReactiveFlags7to__int(4) ^ -1));
    _M0FP26mizchi7signals11purge__deps(c.node);
    if (old_value.$tag === 1) {
      const _Some = old_value;
      const _old = _Some._0;
      return !(_old === new_value);
    } else {
      return true;
    }
  }
  function _M0MP26mizchi7signals8Computed3getGRPB5ArrayGsEE(self) {
    const _p = self.node.flags;
    const flags = _p.value;
    const dirty_flag = _M0MP26mizchi7signals13ReactiveFlags7to__int(16);
    const pending_flag = _M0MP26mizchi7signals13ReactiveFlags7to__int(32);
    const mutable_flag = _M0MP26mizchi7signals13ReactiveFlags7to__int(1);
    const recursed_check_flag = _M0MP26mizchi7signals13ReactiveFlags7to__int(4);
    const is_dirty = (flags & dirty_flag) !== 0;
    const is_pending = (flags & pending_flag) !== 0;
    const deps_changed = is_pending ? _M0FP26mizchi7signals18check__deps__dirty(self.node) : false;
    if (is_dirty || deps_changed) {
      if (_M0FP26mizchi7signals16update__computedGRPB5ArrayGsEE(self)) {
        const _bind$19 = self.node.subs;
        if (_bind$19 === undefined) {
        } else {
          const _Some = _bind$19;
          const _subs = _Some;
          _M0FP26mizchi7signals18shallow__propagate(_subs);
        }
      }
    } else {
      if (is_pending) {
        _M0MP26mizchi7signals5Flags10set__value(self.node.flags, flags & (pending_flag ^ -1));
      } else {
        if (flags === _M0MP26mizchi7signals13ReactiveFlags7to__int(0)) {
          _M0MP26mizchi7signals5Flags10set__value(self.node.flags, mutable_flag | recursed_check_flag);
          const prev_sub = _M0FP26mizchi7signals16set__active__sub(self.node);
          const _func = self.getter;
          self.value = new _M0DTPC16option6OptionGRPB5ArrayGsEE4Some(_func());
          _M0FP26mizchi7signals16set__active__sub(prev_sub);
          const _p$2 = self.node.flags;
          const current_flags = _p$2.value;
          _M0MP26mizchi7signals5Flags10set__value(self.node.flags, current_flags & (recursed_check_flag ^ -1));
        }
      }
    }
    const _bind$19 = _M0FP26mizchi7signals11active__sub.val;
    if (_bind$19 === undefined) {
    } else {
      const _Some = _bind$19;
      const _sub = _Some;
      _M0FP26mizchi7signals4link(self.node, _sub, _M0FP26mizchi7signals5cycle.val);
    }
    const _bind$20 = self.value;
    if (_bind$20.$tag === 1) {
      const _Some = _bind$20;
      return _Some._0;
    } else {
      return $panic();
    }
  }
  function _M0FP26mizchi7signals4memoGRPB5ArrayGsEE(compute) {
    const inner = _M0FP26mizchi7signals16create__computedGRPB5ArrayGsEE(compute);
    return () => _M0MP26mizchi7signals8Computed3getGRPB5ArrayGsEE(inner);
  }
  function _M0FP26mizchi7signals16run__with__ownerGRPB5ArrayGRP36mizchi11js__browser3dom4NodeEE(owner, f) {
    const prev = _M0FP26mizchi7signals17reactive__context.current_owner;
    _M0FP26mizchi7signals17reactive__context.current_owner = owner;
    const result = f();
    _M0FP26mizchi7signals17reactive__context.current_owner = prev;
    return result;
  }
  function _M0FP26mizchi7signals16run__with__ownerGRP36mizchi4luna3dom7DomNodeE(owner, f) {
    const prev = _M0FP26mizchi7signals17reactive__context.current_owner;
    _M0FP26mizchi7signals17reactive__context.current_owner = owner;
    const result = f();
    _M0FP26mizchi7signals17reactive__context.current_owner = prev;
    return result;
  }
  function _M0MP26mizchi7signals5Owner7dispose(self) {
    if (self.disposed) {
      return undefined;
    }
    self.disposed = true;
    let _tmp$8 = self.children.length - 1 | 0;
    while (true) {
      const i = _tmp$8;
      if (i >= 0) {
        _M0MP26mizchi7signals5Owner7dispose(_M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(self.children, i));
        _tmp$8 = i - 1 | 0;
        continue;
      } else {
        break;
      }
    }
    let _tmp$9 = self.disposers.length - 1 | 0;
    while (true) {
      const i = _tmp$9;
      if (i >= 0) {
        const _func = _M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(self.disposers, i);
        _func();
        _tmp$9 = i - 1 | 0;
        continue;
      } else {
        break;
      }
    }
    let _tmp$10 = self.cleanups.length - 1 | 0;
    while (true) {
      const i = _tmp$10;
      if (i >= 0) {
        const _func = _M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(self.cleanups, i);
        _func();
        _tmp$10 = i - 1 | 0;
        continue;
      } else {
        break;
      }
    }
    _M0MPC15array5Array5clearGRP26mizchi7signals5OwnerE(self.children);
    _M0MPC15array5Array5clearGRP26mizchi7signals5OwnerE(self.disposers);
    _M0MPC15array5Array5clearGRP26mizchi7signals5OwnerE(self.cleanups);
    const _bind$19 = self.parent;
    if (_bind$19 === undefined) {
      return;
    } else {
      const _Some = _bind$19;
      const _p = _Some;
      const _p$2 = _p.children;
      const _p$3 = _p$2.length;
      const _p$4 = _p$2.length;
      let _p$5;
      let _tmp$11 = 0;
      let _tmp$12 = 0;
      while (true) {
        const _p$6 = _tmp$11;
        const _p$7 = _tmp$12;
        if (_p$6 < _p$4) {
          const _p$8 = _p$2[_p$6];
          if (_p$8.id !== self.id) {
            if (_p$6 !== _p$7) {
              _p$2[_p$7] = _p$8;
            }
            _tmp$11 = _p$6 + 1 | 0;
            _tmp$12 = _p$7 + 1 | 0;
            continue;
          }
          _tmp$11 = _p$6 + 1 | 0;
          continue;
        } else {
          _p$5 = _p$7;
          break;
        }
      }
      if (_p$5 !== _p$3) {
        _M0MPC15array5Array28unsafe__truncate__to__lengthGRP26mizchi7signals5OwnerE(_p$2, _p$5);
        return;
      } else {
        return;
      }
    }
  }
  function _M0FP26mizchi7signals15new__effect__id() {
    const id = _M0FP26mizchi7signals19effect__id__counter.val;
    _M0FP26mizchi7signals19effect__id__counter.val = id + 1 | 0;
    return id;
  }
  function _M0MP26mizchi7signals5Owner3new(parent) {
    const owner = new _M0TP26mizchi7signals5Owner(_M0FP26mizchi7signals15new__effect__id(), parent, [], [], [], false);
    if (parent === undefined) {
    } else {
      const _Some = parent;
      const _p = _Some;
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(_p.children, owner);
    }
    return owner;
  }
  function _M0FP26mizchi7signals9untrackedGRPB5ArrayGRP314vlmkit_2dsites4wiki4main7PreviewEE(f) {
    const prev_core = _M0FP26mizchi7signals16set__active__sub(undefined);
    const result = f();
    _M0FP26mizchi7signals16set__active__sub(prev_core);
    return result;
  }
  function _M0FP26mizchi7signals9untrackedGuE(f) {
    const prev_core = _M0FP26mizchi7signals16set__active__sub(undefined);
    f();
    _M0FP26mizchi7signals16set__active__sub(prev_core);
  }
  function _M0FP26mizchi7signals9untrackedGbE(f) {
    const prev_core = _M0FP26mizchi7signals16set__active__sub(undefined);
    const result = f();
    _M0FP26mizchi7signals16set__active__sub(prev_core);
    return result;
  }
  function _M0FP26mizchi7signals9untrackedGURP36mizchi11js__browser3dom4NodeWEuEE(f) {
    const prev_core = _M0FP26mizchi7signals16set__active__sub(undefined);
    const result = f();
    _M0FP26mizchi7signals16set__active__sub(prev_core);
    return result;
  }
  function _M0FP26mizchi7signals27create__root__with__disposeGRP36mizchi4luna3dom7DomNodeE(f) {
    const owner = _M0MP26mizchi7signals5Owner3new(_M0FP26mizchi7signals17reactive__context.current_owner);
    const dispose = () => {
      _M0MP26mizchi7signals5Owner7dispose(owner);
    };
    const result = _M0FP26mizchi7signals16run__with__ownerGRP36mizchi4luna3dom7DomNodeE(owner, f);
    return { _0: result, _1: dispose };
  }
  function _M0FP26mizchi7signals19with__parent__ownerGRPB5ArrayGRP36mizchi11js__browser3dom4NodeEE(captured_owner, f) {
    if (captured_owner === undefined) {
      return f();
    } else {
      const _Some = captured_owner;
      const _parent = _Some;
      return _M0FP26mizchi7signals16run__with__ownerGRPB5ArrayGRP36mizchi11js__browser3dom4NodeEE(_parent, f);
    }
  }
  function _M0FP26mizchi7signals19with__parent__ownerGURP36mizchi11js__browser3dom4NodeWEuEE(captured_owner, f) {
    if (captured_owner === undefined) {
      return f();
    } else {
      const _Some = captured_owner;
      const _parent = _Some;
      return _M0FP26mizchi7signals16run__with__ownerGRP36mizchi4luna3dom7DomNodeE(_parent, f);
    }
  }
  function _M0FP36mizchi4luna3dom10text__node(content) {
    const doc = _M0FP36mizchi11js__browser3dom8document();
    const initial = content();
    const node = _M0MP36mizchi11js__browser3dom8Document14createTextNode(doc, initial);
    _M0FP26mizchi7signals14render__effect(() => {
      const new_content = content();
      _M0MP36mizchi11js__browser3dom4Node14setTextContent(node, new_content);
    });
    return new _M0DTP36mizchi4luna3dom7DomNode3Txt(node);
  }
  function _M0FP36mizchi4luna3dom19apply__static__attr(elem, name, value) {
    if (name === "className" || name === "class") {
      _M0MP36mizchi11js__browser3dom7Element12setClassName(elem, value);
      return;
    } else {
      if (name === "__innerHTML") {
        _M0MP26mizchi8js__core3Any5__set(elem, "innerHTML", value);
        return;
      } else {
        if (name === "value") {
          _M0MP26mizchi8js__core3Any5__set(elem, "value", value);
          return;
        } else {
          if (name === "checked") {
            _M0MP26mizchi8js__core3Any5__set(elem, "checked", value === "true" || value === "");
            return;
          } else {
            if (name === "disabled") {
              if (value === "true" || value === "") {
                _M0MP36mizchi11js__browser3dom7Element12setAttribute(elem, "disabled", "");
                return;
              } else {
                _M0MP36mizchi11js__browser3dom7Element15removeAttribute(elem, "disabled");
                return;
              }
            } else {
              _M0MP36mizchi11js__browser3dom7Element12setAttribute(elem, name, value);
              return;
            }
          }
        }
      }
    }
  }
  function _M0FP36mizchi4luna3dom20apply__style__string(elem, style) {
    _M0MP36mizchi11js__browser3dom7Element12setAttribute(elem, "style", style);
  }
  function _M0FP36mizchi4luna3dom16apply__attribute(elem, name, value) {
    switch (value.$tag) {
      case 0: {
        const _Static = value;
        const _s = _Static._0;
        if (name === "style") {
          _M0FP36mizchi4luna3dom20apply__style__string(elem, _s);
          return;
        } else {
          _M0FP36mizchi4luna3dom19apply__static__attr(elem, name, _s);
          return;
        }
      }
      case 1: {
        const _Dynamic = value;
        const _getter = _Dynamic._0;
        _M0FP26mizchi7signals14render__effect(() => {
          const new_value = _getter();
          if (name === "style") {
            _M0FP36mizchi4luna3dom20apply__style__string(elem, new_value);
            return;
          } else {
            _M0FP36mizchi4luna3dom19apply__static__attr(elem, name, new_value);
            return;
          }
        });
        return;
      }
      default: {
        const _Handler = value;
        const _handler = _Handler._0;
        if (name === "__ref") {
          _handler(elem);
          return;
        } else {
          _M0FP36mizchi4luna3dom21apply__event__handler(elem, name, _handler);
          return;
        }
      }
    }
  }
  function _M0MP36mizchi4luna3dom10DomElement9from__dom(elem) {
    return new _M0TP36mizchi4luna3dom10DomElement(elem);
  }
  function _M0MP36mizchi4luna3dom7DomNode7to__dom(self) {
    switch (self.$tag) {
      case 0: {
        const _El = self;
        const _elem = _El._0;
        return _elem.inner;
      }
      case 1: {
        const _Txt = self;
        const _text = _Txt._0;
        return _text;
      }
      case 2: {
        const _Raw = self;
        return _Raw._0;
      }
      default: {
        const _Static = self;
        return _Static._0;
      }
    }
  }
  function _M0FP36mizchi4luna3dom19create__element__ns(ns, tag, attrs, children) {
    const elem = _M0FP36mizchi4luna3dom24create__element__ns__ffi(ns, tag);
    const _bind$19 = attrs.length;
    let _tmp$8 = 0;
    while (true) {
      const _ = _tmp$8;
      if (_ < _bind$19) {
        const attr = attrs[_];
        const _name = attr._0;
        const _value = attr._1;
        _M0FP36mizchi4luna3dom16apply__attribute(elem, _name, _value);
        _tmp$8 = _ + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    const _bind$20 = children.length;
    let _tmp$9 = 0;
    while (true) {
      const _ = _tmp$9;
      if (_ < _bind$20) {
        const child = children[_];
        _M0MP36mizchi11js__browser3dom4Node11appendChild(elem, _M0MP36mizchi4luna3dom7DomNode7to__dom(child));
        _tmp$9 = _ + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return new _M0DTP36mizchi4luna3dom7DomNode2El(_M0MP36mizchi4luna3dom10DomElement9from__dom(elem));
  }
  function _M0FP36mizchi4luna3dom15create__element(tag, attrs, children) {
    const doc = _M0FP36mizchi11js__browser3dom8document();
    const elem = _M0MP36mizchi11js__browser3dom8Document13createElement(doc, tag);
    const _bind$19 = attrs.length;
    let _tmp$8 = 0;
    while (true) {
      const _ = _tmp$8;
      if (_ < _bind$19) {
        const attr = attrs[_];
        const _name = attr._0;
        const _value = attr._1;
        _M0FP36mizchi4luna3dom16apply__attribute(elem, _name, _value);
        _tmp$8 = _ + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    const _bind$20 = children.length;
    let _tmp$9 = 0;
    while (true) {
      const _ = _tmp$9;
      if (_ < _bind$20) {
        const child = children[_];
        _M0MP36mizchi11js__browser3dom4Node11appendChild(elem, _M0MP36mizchi4luna3dom7DomNode7to__dom(child));
        _tmp$9 = _ + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return new _M0DTP36mizchi4luna3dom7DomNode2El(_M0MP36mizchi4luna3dom10DomElement9from__dom(elem));
  }
  function _M0FP36mizchi4luna3dom9mount__to(container, n) {
    _M0MP36mizchi11js__browser3dom4Node11appendChild(container, _M0MP36mizchi4luna3dom7DomNode7to__dom(n));
  }
  function _M0FP36mizchi4luna3dom12clear__jsdom(container) {
    _M0MP36mizchi11js__browser3dom4Node14setTextContent(container, "");
  }
  function _M0FP36mizchi4luna3dom10render__to(container, n) {
    _M0FP36mizchi4luna3dom12clear__jsdom(container);
    _M0FP36mizchi4luna3dom9mount__to(container, n);
  }
  function _M0FP36mizchi4luna3dom21collect__child__nodes(node) {
    if (_M0MP36mizchi11js__browser3dom4Node8nodeType(node) === 11) {
      const children = [];
      while (true) {
        const _bind$19 = _M0MP36mizchi11js__browser3dom4Node10firstChild(node);
        if (_bind$19.$tag === 1) {
          const _Some = _bind$19;
          const _child = _Some._0;
          _M0MPC15array5Array4pushGRP36mizchi11js__browser3dom4NodeE(children, _child);
          _M0MP36mizchi11js__browser3dom4Node11removeChild(node, _child);
          continue;
        } else {
          break;
        }
      }
      return children;
    } else {
      return [node];
    }
  }
  function _M0FP36mizchi4luna3dom19collect__dom__nodes(node) {
    if (_M0MP36mizchi11js__browser3dom4Node8nodeType(node) === 11) {
      const children = [];
      const child_nodes = _M0MP36mizchi11js__browser3dom4Node10childNodes(node);
      const _bind$19 = child_nodes.length;
      let _tmp$8 = 0;
      while (true) {
        const i = _tmp$8;
        if (i < _bind$19) {
          _M0MPC15array5Array4pushGRP36mizchi11js__browser3dom4NodeE(children, _M0MPC15array5Array2atGORP26mizchi7signals10EffectNodeE(child_nodes, i));
          _tmp$8 = i + 1 | 0;
          continue;
        } else {
          break;
        }
      }
      return children;
    } else {
      return [node];
    }
  }
  function _M0FP36mizchi4luna3dom8fragment(children) {
    const _bind$19 = children.length;
    switch (_bind$19) {
      case 0: {
        const doc = _M0FP36mizchi11js__browser3dom8document();
        const frag = _M0MP36mizchi11js__browser3dom8Document22createDocumentFragment(doc);
        return new _M0DTP36mizchi4luna3dom7DomNode3Raw(frag);
      }
      case 1: {
        return _M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(children, 0);
      }
      default: {
        const doc$2 = _M0FP36mizchi11js__browser3dom8document();
        const frag$2 = _M0MP36mizchi11js__browser3dom8Document22createDocumentFragment(doc$2);
        const _bind$20 = children.length;
        let _tmp$8 = 0;
        while (true) {
          const _ = _tmp$8;
          if (_ < _bind$20) {
            const child = children[_];
            _M0MP36mizchi11js__browser3dom4Node11appendChild(frag$2, _M0MP36mizchi4luna3dom7DomNode7to__dom(child));
            _tmp$8 = _ + 1 | 0;
            continue;
          } else {
            break;
          }
        }
        return new _M0DTP36mizchi4luna3dom7DomNode3Raw(frag$2);
      }
    }
  }
  function _M0FP36mizchi4luna3dom4showN19render__with__scopeS1237(_env) {
    const current_dispose = _env._2;
    const captured_owner = _env._1;
    const render_fn = _env._0;
    return _M0FP26mizchi7signals19with__parent__ownerGRPB5ArrayGRP36mizchi11js__browser3dom4NodeEE(captured_owner, () => {
      const _bind$19 = _M0FP26mizchi7signals27create__root__with__disposeGRP36mizchi4luna3dom7DomNodeE(() => render_fn());
      const _dom = _bind$19._0;
      const _dispose = _bind$19._1;
      current_dispose.val = _dispose;
      return _M0FP36mizchi4luna3dom21collect__child__nodes(_M0MP36mizchi4luna3dom7DomNode7to__dom(_dom));
    });
  }
  function _M0FP36mizchi4luna3dom4show(when, render_fn) {
    const doc = _M0FP36mizchi11js__browser3dom8document();
    const placeholder = _M0MP36mizchi11js__browser3dom8Document13createComment(doc, "show");
    const captured_owner = _M0FP26mizchi7signals17reactive__context.current_owner;
    const current_dispose = _M0MPC13ref3Ref3RefGRPB5ArrayGRP36mizchi4luna3dom9ItemEntryGiEEE(undefined);
    const _env = { _0: render_fn, _1: captured_owner, _2: current_dispose };
    const initial_show = _M0FP26mizchi7signals9untrackedGbE(() => when());
    const initial_nodes = initial_show ? _M0FP26mizchi7signals9untrackedGRPB5ArrayGRP314vlmkit_2dsites4wiki4main7PreviewEE(() => _M0FP36mizchi4luna3dom4showN19render__with__scopeS1237(_env)) : [];
    const current_nodes = _M0MPC13ref3Ref3RefGRPB5ArrayGRP36mizchi4luna3dom9ItemEntryGiEEE(initial_nodes);
    const is_first_run = _M0MPC13ref3Ref3RefGbE(true);
    _M0FP26mizchi7signals14render__effect(() => {
      const should_show = when();
      const has_nodes = current_nodes.val.length > 0;
      if (is_first_run.val) {
        is_first_run.val = false;
        return undefined;
      }
      if (should_show === true) {
        if (has_nodes === false) {
          const _bind$19 = _M0MP36mizchi11js__browser3dom4Node10parentNode(placeholder);
          if (_bind$19.$tag === 1) {
            const _Some = _bind$19;
            const _parent = _Some._0;
            const nodes = _M0FP26mizchi7signals9untrackedGRPB5ArrayGRP314vlmkit_2dsites4wiki4main7PreviewEE(() => _M0FP36mizchi4luna3dom4showN19render__with__scopeS1237(_env));
            const _bind$20 = nodes.length;
            let _tmp$8 = 0;
            while (true) {
              const _ = _tmp$8;
              if (_ < _bind$20) {
                const node = nodes[_];
                _M0MP36mizchi11js__browser3dom4Node12insertBefore(_parent, node, new _M0DTPC16option6OptionGRP36mizchi11js__browser3dom4NodeE4Some(placeholder));
                _tmp$8 = _ + 1 | 0;
                continue;
              } else {
                break;
              }
            }
            current_nodes.val = nodes;
            return;
          } else {
            return;
          }
        } else {
          return;
        }
      } else {
        if (has_nodes === true) {
          const _bind$19 = current_dispose.val;
          if (_bind$19 === undefined) {
          } else {
            const _Some = _bind$19;
            const _dispose = _Some;
            _dispose();
            current_dispose.val = undefined;
          }
          const _bind$20 = current_nodes.val;
          const _bind$21 = _bind$20.length;
          let _tmp$8 = 0;
          while (true) {
            const _ = _tmp$8;
            if (_ < _bind$21) {
              const node = _bind$20[_];
              const _bind$22 = _M0MP36mizchi11js__browser3dom4Node10parentNode(node);
              if (_bind$22.$tag === 1) {
                const _Some = _bind$22;
                const _parent = _Some._0;
                _M0MP36mizchi11js__browser3dom4Node11removeChild(_parent, node);
              }
              _tmp$8 = _ + 1 | 0;
              continue;
            } else {
              break;
            }
          }
          current_nodes.val = [];
          return;
        } else {
          return;
        }
      }
    });
    if (initial_nodes.length > 0) {
      const all_nodes = [];
      const _bind$19 = initial_nodes.length;
      let _tmp$8 = 0;
      while (true) {
        const _ = _tmp$8;
        if (_ < _bind$19) {
          const node = initial_nodes[_];
          _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(all_nodes, new _M0DTP36mizchi4luna3dom7DomNode3Raw(node));
          _tmp$8 = _ + 1 | 0;
          continue;
        } else {
          break;
        }
      }
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(all_nodes, new _M0DTP36mizchi4luna3dom7DomNode3Raw(placeholder));
      return _M0FP36mizchi4luna3dom8fragment(all_nodes);
    } else {
      return new _M0DTP36mizchi4luna3dom7DomNode3Raw(placeholder);
    }
  }
  function _M0FP36mizchi4luna3dom24build__entry__index__mapGRP314vlmkit_2dsites4wiki4main5RouteE(entries) {
    const map = _M0FP36mizchi4luna3dom13ref__map__new();
    const _bind$19 = entries.length;
    let _tmp$8 = 0;
    while (true) {
      const i = _tmp$8;
      if (i < _bind$19) {
        const entry = entries[i];
        const key = entry.item;
        if (!_M0FP36mizchi4luna3dom13ref__map__has(map, key)) {
          _M0FP36mizchi4luna3dom13ref__map__set(map, key, i);
        }
        _tmp$8 = i + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return map;
  }
  function _M0FP36mizchi4luna3dom24build__entry__index__mapGiE(entries) {
    const map = _M0FP36mizchi4luna3dom13ref__map__new();
    const _bind$19 = entries.length;
    let _tmp$8 = 0;
    while (true) {
      const i = _tmp$8;
      if (i < _bind$19) {
        const entry = entries[i];
        const key = entry.item;
        if (!_M0FP36mizchi4luna3dom13ref__map__has(map, key)) {
          _M0FP36mizchi4luna3dom13ref__map__set(map, key, i);
        }
        _tmp$8 = i + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return map;
  }
  function _M0FP36mizchi4luna3dom10ref__equalGRP314vlmkit_2dsites4wiki4main5RouteE(a, b) {
    return _M0FP36mizchi4luna3dom15ref__equal__any(a, b);
  }
  function _M0FP36mizchi4luna3dom10ref__equalGiE(a, b) {
    return _M0FP36mizchi4luna3dom15ref__equal__any(a, b);
  }
  function _M0FP36mizchi4luna3dom18find__entry__indexGRP314vlmkit_2dsites4wiki4main5RouteE(map, item, used_indices, old_entries) {
    const key = item;
    const first = _M0FP36mizchi4luna3dom25ref__map__get__or__minus1(map, key);
    if (first >= 0 && !_M0MPC15array5Array2atGbE(used_indices, first)) {
      return first;
    }
    const _bind$19 = old_entries.length;
    let _tmp$8 = 0;
    while (true) {
      const i = _tmp$8;
      if (i < _bind$19) {
        const entry = old_entries[i];
        if (!_M0MPC15array5Array2atGbE(used_indices, i) && _M0FP36mizchi4luna3dom10ref__equalGRP314vlmkit_2dsites4wiki4main5RouteE(entry.item, item)) {
          return i;
        }
        _tmp$8 = i + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return -1;
  }
  function _M0FP36mizchi4luna3dom18find__entry__indexGiE(map, item, used_indices, old_entries) {
    const key = item;
    const first = _M0FP36mizchi4luna3dom25ref__map__get__or__minus1(map, key);
    if (first >= 0 && !_M0MPC15array5Array2atGbE(used_indices, first)) {
      return first;
    }
    const _bind$19 = old_entries.length;
    let _tmp$8 = 0;
    while (true) {
      const i = _tmp$8;
      if (i < _bind$19) {
        const entry = old_entries[i];
        if (!_M0MPC15array5Array2atGbE(used_indices, i) && _M0FP36mizchi4luna3dom10ref__equalGiE(entry.item, item)) {
          return i;
        }
        _tmp$8 = i + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return -1;
  }
  function _M0FP36mizchi4luna3dom20has__duplicate__refsGRP314vlmkit_2dsites4wiki4main5RouteE(items) {
    const seen = _M0FP36mizchi4luna3dom13ref__map__new();
    const _bind$19 = items.length;
    let _tmp$8 = 0;
    while (true) {
      const _ = _tmp$8;
      if (_ < _bind$19) {
        const item = items[_];
        const key = item;
        if (_M0FP36mizchi4luna3dom13ref__map__has(seen, key)) {
          return true;
        }
        _M0FP36mizchi4luna3dom13ref__map__set(seen, key, 1);
        _tmp$8 = _ + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return false;
  }
  function _M0FP36mizchi4luna3dom20has__duplicate__refsGiE(items) {
    const seen = _M0FP36mizchi4luna3dom13ref__map__new();
    const _bind$19 = items.length;
    let _tmp$8 = 0;
    while (true) {
      const _ = _tmp$8;
      if (_ < _bind$19) {
        const item = items[_];
        const key = item;
        if (_M0FP36mizchi4luna3dom13ref__map__has(seen, key)) {
          return true;
        }
        _M0FP36mizchi4luna3dom13ref__map__set(seen, key, 1);
        _tmp$8 = _ + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return false;
  }
  function _M0FP36mizchi4luna3dom12move__before(parent, node, ref_node) {
    if (ref_node.$tag === 1) {
      const _Some = ref_node;
      const _reference = _Some._0;
      return _M0FP36mizchi4luna3dom18move__before__impl(parent, node, _reference);
    } else {
      return _M0FP36mizchi4luna3dom24move__before__impl__null(parent, node);
    }
  }
  function _M0FP36mizchi4luna3dom19move__nodes__before(parent, nodes, cursor) {
    const _bind$19 = nodes.length;
    let _tmp$8 = 0;
    while (true) {
      const _ = _tmp$8;
      if (_ < _bind$19) {
        const node = nodes[_];
        _M0FP36mizchi4luna3dom12move__before(parent, node, new _M0DTPC16option6OptionGRP36mizchi11js__browser3dom4NodeE4Some(cursor));
        _tmp$8 = _ + 1 | 0;
        continue;
      } else {
        return;
      }
    }
  }
  function _M0FP36mizchi4luna3dom19safe__remove__nodes(parent, nodes) {
    const _bind$19 = nodes.length;
    let _tmp$8 = 0;
    while (true) {
      const _ = _tmp$8;
      if (_ < _bind$19) {
        const node = nodes[_];
        _M0FP36mizchi4luna3dom19safe__remove__child(parent, node);
        _tmp$8 = _ + 1 | 0;
        continue;
      } else {
        return;
      }
    }
  }
  function _M0MP36mizchi4luna3dom9ItemEntry3newGRP314vlmkit_2dsites4wiki4main5RouteE(item, dom) {
    return new _M0TP36mizchi4luna3dom9ItemEntryGRP314vlmkit_2dsites4wiki4main5RouteE(item, dom, dom, [dom], () => {
    });
  }
  function _M0MP36mizchi4luna3dom9ItemEntry3newGiE(item, dom) {
    return new _M0TP36mizchi4luna3dom9ItemEntryGiE(item, dom, dom, [dom], () => {
    });
  }
  function _M0MP36mizchi4luna3dom9ItemEntry30new__with__nodes__and__disposeGRP314vlmkit_2dsites4wiki4main5RouteE(item, nodes, dispose) {
    const first = _M0MPC15array5Array2atGORP26mizchi7signals10EffectNodeE(nodes, 0);
    const last = _M0MPC15array5Array2atGORP26mizchi7signals10EffectNodeE(nodes, nodes.length - 1 | 0);
    return new _M0TP36mizchi4luna3dom9ItemEntryGRP314vlmkit_2dsites4wiki4main5RouteE(item, first, last, nodes, dispose);
  }
  function _M0MP36mizchi4luna3dom9ItemEntry30new__with__nodes__and__disposeGiE(item, nodes, dispose) {
    const first = _M0MPC15array5Array2atGORP26mizchi7signals10EffectNodeE(nodes, 0);
    const last = _M0MPC15array5Array2atGORP26mizchi7signals10EffectNodeE(nodes, nodes.length - 1 | 0);
    return new _M0TP36mizchi4luna3dom9ItemEntryGiE(item, first, last, nodes, dispose);
  }
  function _M0FP36mizchi4luna3dom31reconcile__items__with__disposeGRP314vlmkit_2dsites4wiki4main5RouteE(parent, old_entries, new_items, render_item, end_marker) {
    const n = new_items.length;
    if (n === 0) {
      const _bind$19 = old_entries.length;
      let _tmp$8 = 0;
      while (true) {
        const _ = _tmp$8;
        if (_ < _bind$19) {
          const entry = old_entries[_];
          const _func = entry.dispose;
          _func();
          _M0FP36mizchi4luna3dom19safe__remove__nodes(parent, entry.nodes);
          _tmp$8 = _ + 1 | 0;
          continue;
        } else {
          break;
        }
      }
      return [];
    }
    if (_M0FP36mizchi4luna3dom20has__duplicate__refsGRP314vlmkit_2dsites4wiki4main5RouteE(new_items)) {
      const _bind$19 = old_entries.length;
      let _tmp$8 = 0;
      while (true) {
        const _ = _tmp$8;
        if (_ < _bind$19) {
          const entry = old_entries[_];
          const _func = entry.dispose;
          _func();
          _M0FP36mizchi4luna3dom19safe__remove__nodes(parent, entry.nodes);
          _tmp$8 = _ + 1 | 0;
          continue;
        } else {
          break;
        }
      }
      const fresh_entries = [];
      const _bind$20 = new_items.length;
      let _tmp$9 = 0;
      while (true) {
        const i = _tmp$9;
        if (i < _bind$20) {
          const item = new_items[i];
          const _bind$21 = render_item(item, i);
          const _dom = _bind$21._0;
          const _dispose = _bind$21._1;
          const nodes = _M0FP36mizchi4luna3dom19collect__dom__nodes(_dom);
          if (nodes.length === 0) {
            const placeholder = _M0MP36mizchi11js__browser3dom8Document13createComment(_M0FP36mizchi11js__browser3dom8document(), "empty");
            _M0MP36mizchi11js__browser3dom4Node12insertBefore(parent, placeholder, new _M0DTPC16option6OptionGRP36mizchi11js__browser3dom4NodeE4Some(end_marker));
            _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(fresh_entries, _M0MP36mizchi4luna3dom9ItemEntry30new__with__nodes__and__disposeGRP314vlmkit_2dsites4wiki4main5RouteE(item, [placeholder], _dispose));
          } else {
            _M0MP36mizchi11js__browser3dom4Node12insertBefore(parent, _dom, new _M0DTPC16option6OptionGRP36mizchi11js__browser3dom4NodeE4Some(end_marker));
            _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(fresh_entries, _M0MP36mizchi4luna3dom9ItemEntry30new__with__nodes__and__disposeGRP314vlmkit_2dsites4wiki4main5RouteE(item, nodes, _dispose));
          }
          _tmp$9 = i + 1 | 0;
          continue;
        } else {
          break;
        }
      }
      return fresh_entries;
    }
    const new_entries = [];
    let _tmp$8 = 0;
    while (true) {
      const _ = _tmp$8;
      if (_ < n) {
        _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(new_entries, _M0MP36mizchi4luna3dom9ItemEntry3newGRP314vlmkit_2dsites4wiki4main5RouteE(_M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(new_items, 0), end_marker));
        _tmp$8 = _ + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    const used_indices = _M0MPC15array5Array4makeGbE(old_entries.length, false);
    const index_map = _M0FP36mizchi4luna3dom24build__entry__index__mapGRP314vlmkit_2dsites4wiki4main5RouteE(old_entries);
    const cursor = _M0MPC13ref3Ref3RefGRPB5ArrayGRP36mizchi4luna3dom9ItemEntryGiEEE(end_marker);
    const last = n - 1 | 0;
    let _tmp$9 = last;
    let _tmp$10 = last >= 0;
    while (true) {
      const i = _tmp$9;
      const _more = _tmp$10;
      if (_more) {
        const item = _M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(new_items, i);
        const old_index = _M0FP36mizchi4luna3dom18find__entry__indexGRP314vlmkit_2dsites4wiki4main5RouteE(index_map, item, used_indices, old_entries);
        if (old_index >= 0) {
          const entry = _M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(old_entries, old_index);
          _M0MPC15array5Array3setGbE(used_indices, old_index, true);
          if (entry.nodes.length > 0) {
            if (!_M0FP36mizchi4luna3dom17next__sibling__is(entry.last, cursor.val)) {
              _M0FP36mizchi4luna3dom19move__nodes__before(parent, entry.nodes, cursor.val);
            }
            cursor.val = entry.dom;
          }
          _M0MPC15array5Array3setGRP36mizchi4luna3dom9ItemEntryGRP314vlmkit_2dsites4wiki4main5RouteEE(new_entries, i, entry);
        } else {
          const _bind$19 = render_item(item, i);
          const _dom = _bind$19._0;
          const _dispose = _bind$19._1;
          const nodes = _M0FP36mizchi4luna3dom19collect__dom__nodes(_dom);
          if (nodes.length === 0) {
            const placeholder = _M0MP36mizchi11js__browser3dom8Document13createComment(_M0FP36mizchi11js__browser3dom8document(), "empty");
            _M0MP36mizchi11js__browser3dom4Node12insertBefore(parent, placeholder, new _M0DTPC16option6OptionGRP36mizchi11js__browser3dom4NodeE4Some(cursor.val));
            const placeholder_nodes = [placeholder];
            cursor.val = placeholder;
            _M0MPC15array5Array3setGRP36mizchi4luna3dom9ItemEntryGRP314vlmkit_2dsites4wiki4main5RouteEE(new_entries, i, _M0MP36mizchi4luna3dom9ItemEntry30new__with__nodes__and__disposeGRP314vlmkit_2dsites4wiki4main5RouteE(item, placeholder_nodes, _dispose));
          } else {
            _M0MP36mizchi11js__browser3dom4Node12insertBefore(parent, _dom, new _M0DTPC16option6OptionGRP36mizchi11js__browser3dom4NodeE4Some(cursor.val));
            cursor.val = _M0MPC15array5Array2atGORP26mizchi7signals10EffectNodeE(nodes, 0);
            _M0MPC15array5Array3setGRP36mizchi4luna3dom9ItemEntryGRP314vlmkit_2dsites4wiki4main5RouteEE(new_entries, i, _M0MP36mizchi4luna3dom9ItemEntry30new__with__nodes__and__disposeGRP314vlmkit_2dsites4wiki4main5RouteE(item, nodes, _dispose));
          }
        }
        _tmp$9 = i - 1 | 0;
        _tmp$10 = i > 0;
        continue;
      } else {
        break;
      }
    }
    const _bind$19 = old_entries.length;
    let _tmp$11 = 0;
    while (true) {
      const i = _tmp$11;
      if (i < _bind$19) {
        const entry = old_entries[i];
        if (!_M0MPC15array5Array2atGbE(used_indices, i)) {
          const _func = entry.dispose;
          _func();
          _M0FP36mizchi4luna3dom19safe__remove__nodes(parent, entry.nodes);
        }
        _tmp$11 = i + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return new_entries;
  }
  function _M0FP36mizchi4luna3dom31reconcile__items__with__disposeGiE(parent, old_entries, new_items, render_item, end_marker) {
    const n = new_items.length;
    if (n === 0) {
      const _bind$19 = old_entries.length;
      let _tmp$8 = 0;
      while (true) {
        const _ = _tmp$8;
        if (_ < _bind$19) {
          const entry = old_entries[_];
          const _func = entry.dispose;
          _func();
          _M0FP36mizchi4luna3dom19safe__remove__nodes(parent, entry.nodes);
          _tmp$8 = _ + 1 | 0;
          continue;
        } else {
          break;
        }
      }
      return [];
    }
    if (_M0FP36mizchi4luna3dom20has__duplicate__refsGiE(new_items)) {
      const _bind$19 = old_entries.length;
      let _tmp$8 = 0;
      while (true) {
        const _ = _tmp$8;
        if (_ < _bind$19) {
          const entry = old_entries[_];
          const _func = entry.dispose;
          _func();
          _M0FP36mizchi4luna3dom19safe__remove__nodes(parent, entry.nodes);
          _tmp$8 = _ + 1 | 0;
          continue;
        } else {
          break;
        }
      }
      const fresh_entries = [];
      const _bind$20 = new_items.length;
      let _tmp$9 = 0;
      while (true) {
        const i = _tmp$9;
        if (i < _bind$20) {
          const item = new_items[i];
          const _bind$21 = render_item(item, i);
          const _dom = _bind$21._0;
          const _dispose = _bind$21._1;
          const nodes = _M0FP36mizchi4luna3dom19collect__dom__nodes(_dom);
          if (nodes.length === 0) {
            const placeholder = _M0MP36mizchi11js__browser3dom8Document13createComment(_M0FP36mizchi11js__browser3dom8document(), "empty");
            _M0MP36mizchi11js__browser3dom4Node12insertBefore(parent, placeholder, new _M0DTPC16option6OptionGRP36mizchi11js__browser3dom4NodeE4Some(end_marker));
            _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(fresh_entries, _M0MP36mizchi4luna3dom9ItemEntry30new__with__nodes__and__disposeGiE(item, [placeholder], _dispose));
          } else {
            _M0MP36mizchi11js__browser3dom4Node12insertBefore(parent, _dom, new _M0DTPC16option6OptionGRP36mizchi11js__browser3dom4NodeE4Some(end_marker));
            _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(fresh_entries, _M0MP36mizchi4luna3dom9ItemEntry30new__with__nodes__and__disposeGiE(item, nodes, _dispose));
          }
          _tmp$9 = i + 1 | 0;
          continue;
        } else {
          break;
        }
      }
      return fresh_entries;
    }
    const new_entries = [];
    let _tmp$8 = 0;
    while (true) {
      const _ = _tmp$8;
      if (_ < n) {
        _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(new_entries, _M0MP36mizchi4luna3dom9ItemEntry3newGiE(_M0MPC15array5Array2atGiE(new_items, 0), end_marker));
        _tmp$8 = _ + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    const used_indices = _M0MPC15array5Array4makeGbE(old_entries.length, false);
    const index_map = _M0FP36mizchi4luna3dom24build__entry__index__mapGiE(old_entries);
    const cursor = _M0MPC13ref3Ref3RefGRPB5ArrayGRP36mizchi4luna3dom9ItemEntryGiEEE(end_marker);
    const last = n - 1 | 0;
    let _tmp$9 = last;
    let _tmp$10 = last >= 0;
    while (true) {
      const i = _tmp$9;
      const _more = _tmp$10;
      if (_more) {
        const item = _M0MPC15array5Array2atGiE(new_items, i);
        const old_index = _M0FP36mizchi4luna3dom18find__entry__indexGiE(index_map, item, used_indices, old_entries);
        if (old_index >= 0) {
          const entry = _M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(old_entries, old_index);
          _M0MPC15array5Array3setGbE(used_indices, old_index, true);
          if (entry.nodes.length > 0) {
            if (!_M0FP36mizchi4luna3dom17next__sibling__is(entry.last, cursor.val)) {
              _M0FP36mizchi4luna3dom19move__nodes__before(parent, entry.nodes, cursor.val);
            }
            cursor.val = entry.dom;
          }
          _M0MPC15array5Array3setGRP36mizchi4luna3dom9ItemEntryGRP314vlmkit_2dsites4wiki4main5RouteEE(new_entries, i, entry);
        } else {
          const _bind$19 = render_item(item, i);
          const _dom = _bind$19._0;
          const _dispose = _bind$19._1;
          const nodes = _M0FP36mizchi4luna3dom19collect__dom__nodes(_dom);
          if (nodes.length === 0) {
            const placeholder = _M0MP36mizchi11js__browser3dom8Document13createComment(_M0FP36mizchi11js__browser3dom8document(), "empty");
            _M0MP36mizchi11js__browser3dom4Node12insertBefore(parent, placeholder, new _M0DTPC16option6OptionGRP36mizchi11js__browser3dom4NodeE4Some(cursor.val));
            const placeholder_nodes = [placeholder];
            cursor.val = placeholder;
            _M0MPC15array5Array3setGRP36mizchi4luna3dom9ItemEntryGRP314vlmkit_2dsites4wiki4main5RouteEE(new_entries, i, _M0MP36mizchi4luna3dom9ItemEntry30new__with__nodes__and__disposeGiE(item, placeholder_nodes, _dispose));
          } else {
            _M0MP36mizchi11js__browser3dom4Node12insertBefore(parent, _dom, new _M0DTPC16option6OptionGRP36mizchi11js__browser3dom4NodeE4Some(cursor.val));
            cursor.val = _M0MPC15array5Array2atGORP26mizchi7signals10EffectNodeE(nodes, 0);
            _M0MPC15array5Array3setGRP36mizchi4luna3dom9ItemEntryGRP314vlmkit_2dsites4wiki4main5RouteEE(new_entries, i, _M0MP36mizchi4luna3dom9ItemEntry30new__with__nodes__and__disposeGiE(item, nodes, _dispose));
          }
        }
        _tmp$9 = i - 1 | 0;
        _tmp$10 = i > 0;
        continue;
      } else {
        break;
      }
    }
    const _bind$19 = old_entries.length;
    let _tmp$11 = 0;
    while (true) {
      const i = _tmp$11;
      if (i < _bind$19) {
        const entry = old_entries[i];
        if (!_M0MPC15array5Array2atGbE(used_indices, i)) {
          const _func = entry.dispose;
          _func();
          _M0FP36mizchi4luna3dom19safe__remove__nodes(parent, entry.nodes);
        }
        _tmp$11 = i + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return new_entries;
  }
  function _M0FP36mizchi4luna3dom35reconcile__for__each__with__disposeGRP314vlmkit_2dsites4wiki4main5RouteE(entries_ref, placeholder, new_items, render_item) {
    const _bind$19 = _M0MP36mizchi11js__browser3dom4Node10parentNode(placeholder);
    if (_bind$19.$tag === 1) {
      const _Some = _bind$19;
      const _parent = _Some._0;
      entries_ref.val = _M0FP36mizchi4luna3dom31reconcile__items__with__disposeGRP314vlmkit_2dsites4wiki4main5RouteE(_parent, entries_ref.val, new_items, render_item, placeholder);
      return;
    } else {
      return;
    }
  }
  function _M0FP36mizchi4luna3dom35reconcile__for__each__with__disposeGiE(entries_ref, placeholder, new_items, render_item) {
    const _bind$19 = _M0MP36mizchi11js__browser3dom4Node10parentNode(placeholder);
    if (_bind$19.$tag === 1) {
      const _Some = _bind$19;
      const _parent = _Some._0;
      entries_ref.val = _M0FP36mizchi4luna3dom31reconcile__items__with__disposeGiE(_parent, entries_ref.val, new_items, render_item, placeholder);
      return;
    } else {
      return;
    }
  }
  function _M0FP36mizchi4luna3dom9for__eachGRP314vlmkit_2dsites4wiki4main5RouteE(items, render_item) {
    const doc = _M0FP36mizchi11js__browser3dom8document();
    const placeholder = _M0MP36mizchi11js__browser3dom8Document13createComment(doc, "for");
    const entries = _M0MPC13ref3Ref3RefGRPB5ArrayGRP36mizchi4luna3dom9ItemEntryGiEEE([]);
    const is_first = _M0MPC13ref3Ref3RefGbE(true);
    const captured_owner = _M0FP26mizchi7signals17reactive__context.current_owner;
    const render_with_scope = (item, i) => _M0FP26mizchi7signals19with__parent__ownerGURP36mizchi11js__browser3dom4NodeWEuEE(captured_owner, () => {
      const _bind$19 = _M0FP26mizchi7signals27create__root__with__disposeGRP36mizchi4luna3dom7DomNodeE(() => render_item(item, i));
      const _dom = _bind$19._0;
      const _dispose = _bind$19._1;
      return { _0: _M0MP36mizchi4luna3dom7DomNode7to__dom(_dom), _1: _dispose };
    });
    const fragment = _M0MP36mizchi11js__browser3dom8Document22createDocumentFragment(doc);
    const initial_items = _M0FP26mizchi7signals9untrackedGRPB5ArrayGRP314vlmkit_2dsites4wiki4main7PreviewEE(() => items());
    const _bind$19 = initial_items.length;
    let _tmp$8 = 0;
    while (true) {
      const i = _tmp$8;
      if (i < _bind$19) {
        const item = initial_items[i];
        const _bind$20 = _M0FP26mizchi7signals9untrackedGURP36mizchi11js__browser3dom4NodeWEuEE(() => render_with_scope(item, i));
        const _dom = _bind$20._0;
        const _dispose = _bind$20._1;
        const nodes = _M0FP36mizchi4luna3dom19collect__dom__nodes(_dom);
        if (nodes.length === 0) {
          const placeholder$2 = _M0MP36mizchi11js__browser3dom8Document13createComment(doc, "empty");
          _M0MP36mizchi11js__browser3dom4Node11appendChild(fragment, placeholder$2);
          _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(entries.val, _M0MP36mizchi4luna3dom9ItemEntry30new__with__nodes__and__disposeGRP314vlmkit_2dsites4wiki4main5RouteE(item, [placeholder$2], _dispose));
        } else {
          _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(entries.val, _M0MP36mizchi4luna3dom9ItemEntry30new__with__nodes__and__disposeGRP314vlmkit_2dsites4wiki4main5RouteE(item, nodes, _dispose));
          _M0MP36mizchi11js__browser3dom4Node11appendChild(fragment, _dom);
        }
        _tmp$8 = i + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    _M0MP36mizchi11js__browser3dom4Node11appendChild(fragment, placeholder);
    _M0FP26mizchi7signals14render__effect(() => {
      const new_items = items();
      if (is_first.val) {
        is_first.val = false;
        return undefined;
      }
      _M0FP26mizchi7signals9untrackedGuE(() => {
        _M0FP36mizchi4luna3dom35reconcile__for__each__with__disposeGRP314vlmkit_2dsites4wiki4main5RouteE(entries, placeholder, new_items, render_with_scope);
      });
    });
    return new _M0DTP36mizchi4luna3dom7DomNode3Raw(fragment);
  }
  function _M0FP36mizchi4luna3dom9for__eachGiE(items, render_item) {
    const doc = _M0FP36mizchi11js__browser3dom8document();
    const placeholder = _M0MP36mizchi11js__browser3dom8Document13createComment(doc, "for");
    const entries = _M0MPC13ref3Ref3RefGRPB5ArrayGRP36mizchi4luna3dom9ItemEntryGiEEE([]);
    const is_first = _M0MPC13ref3Ref3RefGbE(true);
    const captured_owner = _M0FP26mizchi7signals17reactive__context.current_owner;
    const render_with_scope = (item, i) => _M0FP26mizchi7signals19with__parent__ownerGURP36mizchi11js__browser3dom4NodeWEuEE(captured_owner, () => {
      const _bind$19 = _M0FP26mizchi7signals27create__root__with__disposeGRP36mizchi4luna3dom7DomNodeE(() => render_item(item, i));
      const _dom = _bind$19._0;
      const _dispose = _bind$19._1;
      return { _0: _M0MP36mizchi4luna3dom7DomNode7to__dom(_dom), _1: _dispose };
    });
    const fragment = _M0MP36mizchi11js__browser3dom8Document22createDocumentFragment(doc);
    const initial_items = _M0FP26mizchi7signals9untrackedGRPB5ArrayGRP314vlmkit_2dsites4wiki4main7PreviewEE(() => items());
    const _bind$19 = initial_items.length;
    let _tmp$8 = 0;
    while (true) {
      const i = _tmp$8;
      if (i < _bind$19) {
        const item = initial_items[i];
        const _bind$20 = _M0FP26mizchi7signals9untrackedGURP36mizchi11js__browser3dom4NodeWEuEE(() => render_with_scope(item, i));
        const _dom = _bind$20._0;
        const _dispose = _bind$20._1;
        const nodes = _M0FP36mizchi4luna3dom19collect__dom__nodes(_dom);
        if (nodes.length === 0) {
          const placeholder$2 = _M0MP36mizchi11js__browser3dom8Document13createComment(doc, "empty");
          _M0MP36mizchi11js__browser3dom4Node11appendChild(fragment, placeholder$2);
          _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(entries.val, _M0MP36mizchi4luna3dom9ItemEntry30new__with__nodes__and__disposeGiE(item, [placeholder$2], _dispose));
        } else {
          _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(entries.val, _M0MP36mizchi4luna3dom9ItemEntry30new__with__nodes__and__disposeGiE(item, nodes, _dispose));
          _M0MP36mizchi11js__browser3dom4Node11appendChild(fragment, _dom);
        }
        _tmp$8 = i + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    _M0MP36mizchi11js__browser3dom4Node11appendChild(fragment, placeholder);
    _M0FP26mizchi7signals14render__effect(() => {
      const new_items = items();
      if (is_first.val) {
        is_first.val = false;
        return undefined;
      }
      _M0FP26mizchi7signals9untrackedGuE(() => {
        _M0FP36mizchi4luna3dom35reconcile__for__each__with__disposeGiE(entries, placeholder, new_items, render_with_scope);
      });
    });
    return new _M0DTP36mizchi4luna3dom7DomNode3Raw(fragment);
  }
  function _M0IPC16string6StringP36mizchi4luna3dom9ToDomNode13to__dom__node(self) {
    const doc = _M0FP36mizchi11js__browser3dom8document();
    return new _M0DTP36mizchi4luna3dom7DomNode3Txt(_M0MP36mizchi11js__browser3dom8Document14createTextNode(doc, self));
  }
  function _M0FP36mizchi4luna3dom4text(content) {
    return _M0IPC16string6StringP36mizchi4luna3dom9ToDomNode13to__dom__node(content);
  }
  function _M0FP36mizchi4luna3dom9text__dyn(content) {
    return _M0FP36mizchi4luna3dom10text__node(content);
  }
  function _M0IP314vlmkit_2dsites4wiki4main5PKindPB2Eq5equal(_x_462, _x_463) {
    if (_x_462.$tag === 0) {
      const _PPage = _x_462;
      const _$42$x0_464 = _PPage._0;
      if (_x_463.$tag === 0) {
        const _PPage$2 = _x_463;
        const _$42$y0_465 = _PPage$2._0;
        return _$42$x0_464 === _$42$y0_465;
      } else {
        return false;
      }
    } else {
      const _PRef = _x_462;
      const _$42$x0_466 = _PRef._0;
      if (_x_463.$tag === 1) {
        const _PRef$2 = _x_463;
        const _$42$y0_467 = _PRef$2._0;
        return _$42$x0_466 === _$42$y0_467;
      } else {
        return false;
      }
    }
  }
  function _M0IP314vlmkit_2dsites4wiki4main5RoutePB2Eq5equal(_x_450, _x_451) {
    switch (_x_450.$tag) {
      case 0: {
        if (_x_451.$tag === 0) {
          return true;
        } else {
          return false;
        }
      }
      case 1: {
        if (_x_451.$tag === 1) {
          return true;
        } else {
          return false;
        }
      }
      case 2: {
        if (_x_451.$tag === 2) {
          return true;
        } else {
          return false;
        }
      }
      case 3: {
        if (_x_451.$tag === 3) {
          return true;
        } else {
          return false;
        }
      }
      case 4: {
        const _Stub = _x_450;
        const _$42$x0_452 = _Stub._0;
        if (_x_451.$tag === 4) {
          const _Stub$2 = _x_451;
          const _$42$y0_453 = _Stub$2._0;
          return _$42$x0_452 === _$42$y0_453;
        } else {
          return false;
        }
      }
      default: {
        const _Search = _x_450;
        const _$42$x0_454 = _Search._0;
        if (_x_451.$tag === 5) {
          const _Search$2 = _x_451;
          const _$42$y0_455 = _Search$2._0;
          return _$42$x0_454 === _$42$y0_455;
        } else {
          return false;
        }
      }
    }
  }
  function _M0FP314vlmkit_2dsites4wiki4main1h(tag, attrs, children) {
    return _M0FP36mizchi4luna3dom15create__element(tag, attrs, children);
  }
  function _M0FP314vlmkit_2dsites4wiki4main2dy(name, f) {
    return { _0: name, _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(f) };
  }
  function _M0FP314vlmkit_2dsites4wiki4main2on(name, f) {
    return { _0: name, _1: new _M0DTP36mizchi4luna3dom9AttrValue7Handler(f) };
  }
  function _M0FP314vlmkit_2dsites4wiki4main7ref__to(cell) {
    return { _0: "__ref", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Handler((el) => {
      cell.val = new _M0DTPC16option6OptionGRP26mizchi8js__core3AnyE4Some(el);
    }) };
  }
  function _M0FP314vlmkit_2dsites4wiki4main2tx(s) {
    return _M0FP36mizchi4luna3dom4text(s);
  }
  function _M0FP314vlmkit_2dsites4wiki4main5lower(s) {
    const sb = _M0MPB13StringBuilder21StringBuilder_2einner(8);
    const _bind$19 = s.length;
    let _tmp$8 = 0;
    while (true) {
      const _string_index = _tmp$8;
      if (_string_index < _bind$19) {
        let _decoded_next_string_index;
        let _decoded_char;
        _L: {
          const _bind$20 = s.charCodeAt(_string_index);
          if (_bind$20 >= 55296 && _bind$20 <= 56319 && (_string_index + 1 | 0) < _bind$19) {
            const _bind$21 = s.charCodeAt(_string_index + 1 | 0);
            if (_bind$21 >= 56320 && _bind$21 <= 57343) {
              const _tmp$9 = _string_index + 2 | 0;
              const _p = (((Math.imul(_bind$20 - 55296 | 0, 1024) | 0) + _bind$21 | 0) - 56320 | 0) + 65536 | 0;
              _decoded_next_string_index = _tmp$9;
              _decoded_char = _p;
              break _L;
            } else {
              const _tmp$9 = _string_index + 1 | 0;
              const _p = _bind$20;
              _decoded_next_string_index = _tmp$9;
              _decoded_char = _p;
              break _L;
            }
          } else {
            const _tmp$9 = _string_index + 1 | 0;
            const _p = _bind$20;
            _decoded_next_string_index = _tmp$9;
            _decoded_char = _p;
            break _L;
          }
        }
        if (_decoded_char >= 65 && _decoded_char <= 90) {
          _M0IPB13StringBuilderPB6Logger11write__char(sb, _decoded_char + 32 | 0);
        } else {
          _M0IPB13StringBuilderPB6Logger11write__char(sb, _decoded_char);
        }
        _tmp$8 = _decoded_next_string_index;
        continue;
      } else {
        break;
      }
    }
    return sb.val;
  }
  function _M0FP314vlmkit_2dsites4wiki4main13replace__char(s, from, to) {
    const sb = _M0MPB13StringBuilder21StringBuilder_2einner(8);
    const _bind$19 = s.length;
    let _tmp$8 = 0;
    while (true) {
      const _string_index = _tmp$8;
      if (_string_index < _bind$19) {
        let _decoded_next_string_index;
        let _decoded_char;
        _L: {
          const _bind$20 = s.charCodeAt(_string_index);
          if (_bind$20 >= 55296 && _bind$20 <= 56319 && (_string_index + 1 | 0) < _bind$19) {
            const _bind$21 = s.charCodeAt(_string_index + 1 | 0);
            if (_bind$21 >= 56320 && _bind$21 <= 57343) {
              const _tmp$9 = _string_index + 2 | 0;
              const _p = (((Math.imul(_bind$20 - 55296 | 0, 1024) | 0) + _bind$21 | 0) - 56320 | 0) + 65536 | 0;
              _decoded_next_string_index = _tmp$9;
              _decoded_char = _p;
              break _L;
            } else {
              const _tmp$9 = _string_index + 1 | 0;
              const _p = _bind$20;
              _decoded_next_string_index = _tmp$9;
              _decoded_char = _p;
              break _L;
            }
          } else {
            const _tmp$9 = _string_index + 1 | 0;
            const _p = _bind$20;
            _decoded_next_string_index = _tmp$9;
            _decoded_char = _p;
            break _L;
          }
        }
        _M0IPB13StringBuilderPB6Logger11write__char(sb, _decoded_char === from ? to : _decoded_char);
        _tmp$8 = _decoded_next_string_index;
        continue;
      } else {
        break;
      }
    }
    return sb.val;
  }
  function _M0FP314vlmkit_2dsites4wiki4main12starts__with(s, p) {
    const a = _M0MPC16string6String9to__array(s);
    const b = _M0MPC16string6String9to__array(p);
    if (b.length > a.length) {
      return false;
    }
    let _tmp$8 = 0;
    while (true) {
      const i = _tmp$8;
      if (i < b.length) {
        if (_M0MPC15array5Array2atGcE(a, i) !== _M0MPC15array5Array2atGcE(b, i)) {
          return false;
        }
        _tmp$8 = i + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return true;
  }
  function _M0FP314vlmkit_2dsites4wiki4main11drop__chars(s, n) {
    const cs = _M0MPC16string6String9to__array(s);
    const sb = _M0MPB13StringBuilder21StringBuilder_2einner(8);
    let _tmp$8 = n;
    while (true) {
      const i = _tmp$8;
      if (i < cs.length) {
        _M0IPB13StringBuilderPB6Logger11write__char(sb, _M0MPC15array5Array2atGcE(cs, i));
        _tmp$8 = i + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return sb.val;
  }
  function _M0FP314vlmkit_2dsites4wiki4main10wiki__href(t) {
    return `#/wiki/${_M0FP314vlmkit_2dsites4wiki4main11encode__uri(_M0FP314vlmkit_2dsites4wiki4main13replace__char(t, 32, 95))}`;
  }
  function _M0FP314vlmkit_2dsites4wiki4main22section__holds__active(i) {
    const id = _M0MP26mizchi7signals6Signal3getGRP314vlmkit_2dsites4wiki4main5RouteE(_M0FP314vlmkit_2dsites4wiki4main10active__id);
    const s = _M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(_M0FP314vlmkit_2dsites4wiki4main8sections, i);
    if (s.id === id) {
      return true;
    }
    const _bind$19 = s.subs;
    const _bind$20 = _bind$19.length;
    let _tmp$8 = 0;
    while (true) {
      const _ = _tmp$8;
      if (_ < _bind$20) {
        const sub = _bind$19[_];
        if (sub.id === id) {
          return true;
        }
        _tmp$8 = _ + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return false;
  }
  function _M0FP314vlmkit_2dsites4wiki4main13toc__expanded(i) {
    const _bind$19 = _M0MP26mizchi7signals6Signal3getGiE(_M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(_M0FP314vlmkit_2dsites4wiki4main9toc__open, i));
    switch (_bind$19) {
      case 1: {
        return true;
      }
      case 2: {
        return false;
      }
      default: {
        return _M0FP314vlmkit_2dsites4wiki4main22section__holds__active(i);
      }
    }
  }
  function _M0FP314vlmkit_2dsites4wiki4main5store(key, v) {
    _M0FP314vlmkit_2dsites4wiki4main12storage__set(`lexipedia:${key}`, v);
  }
  function _M0FP314vlmkit_2dsites4wiki4main4load(key, allowed, fallback) {
    const v = _M0FP314vlmkit_2dsites4wiki4main12storage__get(`lexipedia:${key}`);
    return _M0MPC15array5Array8containsGsE(allowed, v) ? v : fallback;
  }
  function _M0FP314vlmkit_2dsites4wiki4main5toast(msg) {
    if (_M0FP314vlmkit_2dsites4wiki4main12toast__timer.val >= 0) {
      _M0FP314vlmkit_2dsites4wiki4main14clear__timeout(_M0FP314vlmkit_2dsites4wiki4main12toast__timer.val);
    }
    _M0MP26mizchi7signals6Signal3setGRP314vlmkit_2dsites4wiki4main5RouteE(_M0FP314vlmkit_2dsites4wiki4main10toast__msg, msg);
    _M0FP314vlmkit_2dsites4wiki4main12toast__timer.val = _M0FP314vlmkit_2dsites4wiki4main12set__timeout(() => {
      _M0MP26mizchi7signals6Signal3setGRP314vlmkit_2dsites4wiki4main5RouteE(_M0FP314vlmkit_2dsites4wiki4main10toast__msg, "");
    }, 4000);
  }
  function _M0FP314vlmkit_2dsites4wiki4main12cancel__show() {
    if (_M0FP314vlmkit_2dsites4wiki4main11show__timer.val >= 0) {
      _M0FP314vlmkit_2dsites4wiki4main14clear__timeout(_M0FP314vlmkit_2dsites4wiki4main11show__timer.val);
      _M0FP314vlmkit_2dsites4wiki4main11show__timer.val = -1;
      return;
    } else {
      return;
    }
  }
  function _M0FP314vlmkit_2dsites4wiki4main12cancel__hide() {
    if (_M0FP314vlmkit_2dsites4wiki4main11hide__timer.val >= 0) {
      _M0FP314vlmkit_2dsites4wiki4main14clear__timeout(_M0FP314vlmkit_2dsites4wiki4main11hide__timer.val);
      _M0FP314vlmkit_2dsites4wiki4main11hide__timer.val = -1;
      return;
    } else {
      return;
    }
  }
  function _M0FP314vlmkit_2dsites4wiki4main9hide__now() {
    _M0FP314vlmkit_2dsites4wiki4main12cancel__show();
    _M0FP314vlmkit_2dsites4wiki4main12cancel__hide();
    _M0MP26mizchi7signals6Signal3setGORP314vlmkit_2dsites4wiki4main7PreviewE(_M0FP314vlmkit_2dsites4wiki4main7preview, undefined);
  }
  function _M0FP314vlmkit_2dsites4wiki4main10hide__soon() {
    _M0FP314vlmkit_2dsites4wiki4main12cancel__show();
    _M0FP314vlmkit_2dsites4wiki4main12cancel__hide();
    _M0FP314vlmkit_2dsites4wiki4main11hide__timer.val = _M0FP314vlmkit_2dsites4wiki4main12set__timeout(() => {
      _M0MP26mizchi7signals6Signal3setGORP314vlmkit_2dsites4wiki4main7PreviewE(_M0FP314vlmkit_2dsites4wiki4main7preview, undefined);
    }, 300);
  }
  function _M0FP314vlmkit_2dsites4wiki4main13open__preview(kind, el) {
    const r = _M0FP314vlmkit_2dsites4wiki4main10page__rect(el);
    const vw = _M0FP314vlmkit_2dsites4wiki4main15viewport__width();
    const card_w = vw - 32 < 320 ? vw - 32 : 320;
    let x = 0 >>> 0 < r.length ? r[0] : $oob();
    if (x + card_w > vw - 16) {
      x = vw - 16 - card_w;
    }
    if (x < 16) {
      x = 16;
    }
    const above = (4 >>> 0 < r.length ? r[4] : $oob()) + 240 > _M0FP314vlmkit_2dsites4wiki4main16viewport__height() && (4 >>> 0 < r.length ? r[4] : $oob()) > 260;
    const y = above ? (1 >>> 0 < r.length ? r[1] : $oob()) - 6 : (2 >>> 0 < r.length ? r[2] : $oob()) + 6;
    _M0MP26mizchi7signals6Signal3setGORP314vlmkit_2dsites4wiki4main7PreviewE(_M0FP314vlmkit_2dsites4wiki4main7preview, new _M0TP314vlmkit_2dsites4wiki4main7Preview(kind, x, y, above));
  }
  function _M0FP314vlmkit_2dsites4wiki4main12hover__start(kind, el) {
    if (_M0FP314vlmkit_2dsites4wiki4main13touch__recent.val) {
      return undefined;
    }
    _M0FP314vlmkit_2dsites4wiki4main12cancel__hide();
    _M0FP314vlmkit_2dsites4wiki4main12cancel__show();
    const _bind$19 = _M0MP26mizchi7signals6Signal3getGORP314vlmkit_2dsites4wiki4main7PreviewE(_M0FP314vlmkit_2dsites4wiki4main7preview);
    if (_bind$19 === undefined) {
    } else {
      const _Some = _bind$19;
      const _p = _Some;
      if (_M0IP314vlmkit_2dsites4wiki4main5PKindPB2Eq5equal(_p.kind, kind)) {
        return undefined;
      }
    }
    _M0FP314vlmkit_2dsites4wiki4main11show__timer.val = _M0FP314vlmkit_2dsites4wiki4main12set__timeout(() => {
      _M0FP314vlmkit_2dsites4wiki4main13open__preview(kind, el);
    }, 500);
  }
  function _M0FP314vlmkit_2dsites4wiki4main12focus__start(kind, el) {
    if (_M0FP314vlmkit_2dsites4wiki4main13touch__recent.val) {
      return undefined;
    }
    _M0FP314vlmkit_2dsites4wiki4main12cancel__hide();
    _M0FP314vlmkit_2dsites4wiki4main12cancel__show();
    _M0FP314vlmkit_2dsites4wiki4main13open__preview(kind, el);
  }
  function _M0FP314vlmkit_2dsites4wiki4main17preview__handlers(kind) {
    return [_M0FP314vlmkit_2dsites4wiki4main2on("mouseenter", (e) => {
      _M0FP314vlmkit_2dsites4wiki4main12hover__start(kind, _M0FP314vlmkit_2dsites4wiki4main11ev__current(e));
    }), _M0FP314vlmkit_2dsites4wiki4main2on("mouseleave", (_e) => {
      _M0FP314vlmkit_2dsites4wiki4main10hide__soon();
    }), _M0FP314vlmkit_2dsites4wiki4main2on("focus", (e) => {
      _M0FP314vlmkit_2dsites4wiki4main12focus__start(kind, _M0FP314vlmkit_2dsites4wiki4main11ev__current(e));
    }), _M0FP314vlmkit_2dsites4wiki4main2on("blur", (_e) => {
      _M0FP314vlmkit_2dsites4wiki4main10hide__soon();
    }), _M0FP314vlmkit_2dsites4wiki4main2on("click", (_e) => {
      _M0FP314vlmkit_2dsites4wiki4main9hide__now();
    })];
  }
  function _M0FP314vlmkit_2dsites4wiki4main10wiki__link(target, label) {
    const attrs = [{ _0: "href", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_M0FP314vlmkit_2dsites4wiki4main10wiki__href(target)) }, _M0FP314vlmkit_2dsites4wiki4main2dy("class", () => {
      const _p = "wl";
      const _p$2 = "visited";
      const _p$3 = _M0MPC15array5Array8containsGsE(_M0MP26mizchi7signals6Signal3getGORP314vlmkit_2dsites4wiki4main7PreviewE(_M0FP314vlmkit_2dsites4wiki4main7visited), target);
      return _p$3 ? `${_p} ${_p$2}` : _p;
    })];
    const _bind$19 = _M0FP314vlmkit_2dsites4wiki4main17preview__handlers(new _M0DTP314vlmkit_2dsites4wiki4main5PKind5PPage(target));
    const _bind$20 = _bind$19.length;
    let _tmp$8 = 0;
    while (true) {
      const _ = _tmp$8;
      if (_ < _bind$20) {
        const x = _bind$19[_];
        _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(attrs, x);
        _tmp$8 = _ + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return _M0FP314vlmkit_2dsites4wiki4main1h("a", attrs, [_M0FP314vlmkit_2dsites4wiki4main2tx(label)]);
  }
  function _M0FP314vlmkit_2dsites4wiki4main1a(name, value) {
    return { _0: name, _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(value) };
  }
  function _M0FP314vlmkit_2dsites4wiki4main4cite(n) {
    const k = _M0MPC16option6Option10unwrap__orGiE(_M0MPB3Map3getGiiE(_M0FP314vlmkit_2dsites4wiki4main11cite__count, n), 0);
    _M0MPB3Map3setGiiE(_M0FP314vlmkit_2dsites4wiki4main11cite__count, n, k + 1 | 0);
    let id;
    if (k === 0) {
      const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(9);
      _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, "cite_ref-");
      _M0MPB13StringBuilder13write__objectGiE(_string_builder, n);
      id = _string_builder.val;
    } else {
      const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(10);
      _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, "cite_ref-");
      _M0MPB13StringBuilder13write__objectGiE(_string_builder, n);
      _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, "-");
      _M0MPB13StringBuilder13write__objectGiE(_string_builder, k + 1 | 0);
      id = _string_builder.val;
    }
    const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(11);
    _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, "#cite_note-");
    _M0MPB13StringBuilder13write__objectGiE(_string_builder, n);
    const _tmp$8 = _M0FP314vlmkit_2dsites4wiki4main1a("href", _string_builder.val);
    const _string_builder$2 = _M0MPB13StringBuilder21StringBuilder_2einner(10);
    _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$2, "Reference ");
    _M0MPB13StringBuilder13write__objectGiE(_string_builder$2, n);
    const attrs = [_tmp$8, _M0FP314vlmkit_2dsites4wiki4main1a("aria-label", _string_builder$2.val)];
    const _bind$19 = _M0FP314vlmkit_2dsites4wiki4main17preview__handlers(new _M0DTP314vlmkit_2dsites4wiki4main5PKind4PRef(n));
    const _bind$20 = _bind$19.length;
    let _tmp$9 = 0;
    while (true) {
      const _ = _tmp$9;
      if (_ < _bind$20) {
        const x = _bind$19[_];
        _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(attrs, x);
        _tmp$9 = _ + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    const _tmp$10 = _M0FP314vlmkit_2dsites4wiki4main2tx("⁠");
    const _tmp$11 = [_M0FP314vlmkit_2dsites4wiki4main1a("id", id), _M0FP314vlmkit_2dsites4wiki4main1a("class", "ref")];
    const _string_builder$3 = _M0MPB13StringBuilder21StringBuilder_2einner(2);
    _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$3, "[");
    _M0MPB13StringBuilder13write__objectGiE(_string_builder$3, n);
    _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$3, "]");
    return _M0FP36mizchi4luna3dom8fragment([_tmp$10, _M0FP314vlmkit_2dsites4wiki4main1h("sup", _tmp$11, [_M0FP314vlmkit_2dsites4wiki4main1h("a", attrs, [_M0FP314vlmkit_2dsites4wiki4main2tx(_string_builder$3.val)])])]);
  }
  function _M0FP314vlmkit_2dsites4wiki4main10find__from(cs, i, x, y) {
    let j = i;
    while (true) {
      if ((j + 1 | 0) < cs.length) {
        if (_M0MPC15array5Array2atGcE(cs, j) === x && _M0MPC15array5Array2atGcE(cs, j + 1 | 0) === y) {
          return j;
        }
        j = j + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return -1;
  }
  function _M0FP314vlmkit_2dsites4wiki4main5slice(cs, from, to) {
    const sb = _M0MPB13StringBuilder21StringBuilder_2einner(8);
    let _tmp$8 = from;
    while (true) {
      const i = _tmp$8;
      if (i < to) {
        _M0IPB13StringBuilderPB6Logger11write__char(sb, _M0MPC15array5Array2atGcE(cs, i));
        _tmp$8 = i + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return sb.val;
  }
  function _M0FP314vlmkit_2dsites4wiki4main13inline__nodesN5flushS2228(_env) {
    const out = _env._1;
    const buf = _env._0;
    const s = buf.val;
    const _p = "";
    if (!(s === _p)) {
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(out, _M0FP314vlmkit_2dsites4wiki4main2tx(s));
      _M0MPB13StringBuilder13reset_2einner(buf, true);
      return;
    } else {
      return;
    }
  }
  function _M0FP314vlmkit_2dsites4wiki4main13inline__nodes(src) {
    const cs = _M0MPC16string6String9to__array(src);
    const out = [];
    const buf = _M0MPB13StringBuilder21StringBuilder_2einner(8);
    const _env = { _0: buf, _1: out };
    const n = cs.length;
    let i = 0;
    while (true) {
      if (i < n) {
        const c = _M0MPC15array5Array2atGcE(cs, i);
        const next = (i + 1 | 0) < n ? _M0MPC15array5Array2atGcE(cs, i + 1 | 0) : 32;
        if (c === 91 && next === 91) {
          const end = _M0FP314vlmkit_2dsites4wiki4main10find__from(cs, i + 2 | 0, 93, 93);
          const body = _M0FP314vlmkit_2dsites4wiki4main5slice(cs, i + 2 | 0, end);
          _M0FP314vlmkit_2dsites4wiki4main13inline__nodesN5flushS2228(_env);
          const parts = _M0MPC16string6String9to__array(body);
          let bar = -1;
          let _tmp$8 = 0;
          while (true) {
            const k = _tmp$8;
            if (k < parts.length) {
              if (_M0MPC15array5Array2atGcE(parts, k) === 124 && bar < 0) {
                bar = k;
              }
              _tmp$8 = k + 1 | 0;
              continue;
            } else {
              break;
            }
          }
          if (bar < 0) {
            _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(out, _M0FP314vlmkit_2dsites4wiki4main10wiki__link(body, body));
          } else {
            _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(out, _M0FP314vlmkit_2dsites4wiki4main10wiki__link(_M0FP314vlmkit_2dsites4wiki4main5slice(parts, 0, bar), _M0FP314vlmkit_2dsites4wiki4main5slice(parts, bar + 1 | 0, parts.length)));
          }
          i = end + 2 | 0;
        } else {
          if (c === 123) {
            let j = i + 1 | 0;
            let num = 0;
            while (true) {
              if (j < n && _M0MPC15array5Array2atGcE(cs, j) !== 125) {
                num = (Math.imul(num, 10) | 0) + (_M0MPC15array5Array2atGcE(cs, j) - 48 | 0) | 0;
                j = j + 1 | 0;
                continue;
              } else {
                break;
              }
            }
            _M0FP314vlmkit_2dsites4wiki4main13inline__nodesN5flushS2228(_env);
            _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(out, _M0FP314vlmkit_2dsites4wiki4main4cite(num));
            i = j + 1 | 0;
          } else {
            if (c === 42 && next === 42 || c === 47 && next === 47) {
              const end = _M0FP314vlmkit_2dsites4wiki4main10find__from(cs, i + 2 | 0, c, c);
              _M0FP314vlmkit_2dsites4wiki4main13inline__nodesN5flushS2228(_env);
              const inner = _M0FP314vlmkit_2dsites4wiki4main5slice(cs, i + 2 | 0, end);
              if (c === 42) {
                _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(out, _M0FP314vlmkit_2dsites4wiki4main1h("b", [], _M0FP314vlmkit_2dsites4wiki4main13inline__nodes(inner)));
              } else {
                _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(out, _M0FP314vlmkit_2dsites4wiki4main1h("i", [], _M0FP314vlmkit_2dsites4wiki4main13inline__nodes(inner)));
              }
              i = end + 2 | 0;
            } else {
              _M0IPB13StringBuilderPB6Logger11write__char(buf, c);
              i = i + 1 | 0;
            }
          }
        }
        continue;
      } else {
        break;
      }
    }
    _M0FP314vlmkit_2dsites4wiki4main13inline__nodesN5flushS2228(_env);
    return out;
  }
  function _M0FP314vlmkit_2dsites4wiki4main4para(src) {
    return _M0FP314vlmkit_2dsites4wiki4main1h("p", [], _M0FP314vlmkit_2dsites4wiki4main13inline__nodes(src));
  }
  function _M0FP314vlmkit_2dsites4wiki4main11scan__cites(src, sec) {
    const cs = _M0MPC16string6String9to__array(src);
    let _tmp$8 = 0;
    while (true) {
      const i = _tmp$8;
      if (i < cs.length) {
        if (_M0MPC15array5Array2atGcE(cs, i) === 123) {
          let j = i + 1 | 0;
          let num = 0;
          while (true) {
            if (j < cs.length && _M0MPC15array5Array2atGcE(cs, j) !== 125) {
              num = (Math.imul(num, 10) | 0) + (_M0MPC15array5Array2atGcE(cs, j) - 48 | 0) | 0;
              j = j + 1 | 0;
              continue;
            } else {
              break;
            }
          }
          const _bind$19 = _M0MPB3Map3getGiiE(_M0FP314vlmkit_2dsites4wiki4main13cite__section, num);
          if (_bind$19 === undefined) {
            _M0MPB3Map3setGiiE(_M0FP314vlmkit_2dsites4wiki4main13cite__section, num, sec);
          }
        }
        _tmp$8 = i + 1 | 0;
        continue;
      } else {
        return;
      }
    }
  }
  function _M0FP314vlmkit_2dsites4wiki4main11section__of(id) {
    const _bind$19 = _M0FP314vlmkit_2dsites4wiki4main8sections.length;
    let _tmp$8 = 0;
    while (true) {
      const i = _tmp$8;
      if (i < _bind$19) {
        const s = _M0FP314vlmkit_2dsites4wiki4main8sections[i];
        if (s.id === id) {
          return i;
        }
        const _bind$20 = s.subs;
        const _bind$21 = _bind$20.length;
        let _tmp$9 = 0;
        while (true) {
          const _ = _tmp$9;
          if (_ < _bind$21) {
            const sub = _bind$20[_];
            if (sub.id === id) {
              return i;
            }
            _tmp$9 = _ + 1 | 0;
            continue;
          } else {
            break;
          }
        }
        _tmp$8 = i + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    const _bind$20 = _M0FP314vlmkit_2dsites4wiki4main9back__ids.length;
    let _tmp$9 = 0;
    while (true) {
      const k = _tmp$9;
      if (k < _bind$20) {
        const b = _M0FP314vlmkit_2dsites4wiki4main9back__ids[k];
        if (b === id) {
          return _M0FP314vlmkit_2dsites4wiki4main8sections.length + k | 0;
        }
        _tmp$9 = k + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    if (_M0FP314vlmkit_2dsites4wiki4main12starts__with(id, "cite_note-")) {
      return _M0FP314vlmkit_2dsites4wiki4main8sections.length + 1 | 0;
    }
    if (_M0FP314vlmkit_2dsites4wiki4main12starts__with(id, "cite_ref-")) {
      const cs = _M0MPC16string6String9to__array(_M0FP314vlmkit_2dsites4wiki4main11drop__chars(id, 9));
      let num = 0;
      const _bind$21 = cs.length;
      let _tmp$10 = 0;
      while (true) {
        const _ = _tmp$10;
        if (_ < _bind$21) {
          const c = cs[_];
          if (c === 45) {
            break;
          }
          num = (Math.imul(num, 10) | 0) + (c - 48 | 0) | 0;
          _tmp$10 = _ + 1 | 0;
          continue;
        } else {
          break;
        }
      }
      return _M0MPC16option6Option10unwrap__orGiE(_M0MPB3Map3getGiiE(_M0FP314vlmkit_2dsites4wiki4main13cite__section, num), -1);
    }
    return -1;
  }
  function _M0FP314vlmkit_2dsites4wiki4main12parse__route(h) {
    if (_M0FP314vlmkit_2dsites4wiki4main12starts__with(h, "#/wiki/")) {
      const t = _M0FP314vlmkit_2dsites4wiki4main13replace__char(_M0FP314vlmkit_2dsites4wiki4main11decode__uri(_M0FP314vlmkit_2dsites4wiki4main11drop__chars(h, 7)), 95, 32);
      return t === "Moon" ? _M0DTP314vlmkit_2dsites4wiki4main5Route7Article__ : new _M0DTP314vlmkit_2dsites4wiki4main5Route4Stub(t);
    } else {
      return _M0FP314vlmkit_2dsites4wiki4main12starts__with(h, "#/search/") ? new _M0DTP314vlmkit_2dsites4wiki4main5Route6Search(_M0FP314vlmkit_2dsites4wiki4main11decode__uri(_M0FP314vlmkit_2dsites4wiki4main11drop__chars(h, 9))) : h === "#/talk" ? _M0DTP314vlmkit_2dsites4wiki4main5Route4Talk__ : h === "#/source" ? _M0DTP314vlmkit_2dsites4wiki4main5Route6Source__ : h === "#/history" ? _M0DTP314vlmkit_2dsites4wiki4main5Route7History__ : _M0DTP314vlmkit_2dsites4wiki4main5Route7Article__;
    }
  }
  function _M0FP314vlmkit_2dsites4wiki4main11sync__route() {
    const h = _M0FP314vlmkit_2dsites4wiki4main9get__hash();
    _M0FP314vlmkit_2dsites4wiki4main9hide__now();
    _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4wiki4main10menu__open, false);
    _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4wiki4main14toc__pop__open, false);
    _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4wiki4main15app__menu__open, false);
    _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4wiki4main16search__expanded, false);
    if (_M0FP314vlmkit_2dsites4wiki4main12starts__with(h, "#/")) {
      const r = _M0FP314vlmkit_2dsites4wiki4main12parse__route(h);
      _M0MP26mizchi7signals6Signal3setGRP314vlmkit_2dsites4wiki4main5RouteE(_M0FP314vlmkit_2dsites4wiki4main5route, r);
      if (r.$tag === 4) {
        const _Stub = r;
        const _t = _Stub._0;
        if (!_M0MPC15array5Array8containsGsE(_M0MP26mizchi7signals6Signal3getGORP314vlmkit_2dsites4wiki4main7PreviewE(_M0FP314vlmkit_2dsites4wiki4main7visited), _t)) {
          _M0MP26mizchi7signals6Signal6updateGRPB5ArrayGsEE(_M0FP314vlmkit_2dsites4wiki4main7visited, (v) => {
            const c = _M0MPC15array5Array4copyGsE(v);
            _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(c, _t);
            return c;
          });
        }
      }
      _M0FP314vlmkit_2dsites4wiki4main15scroll__to__top();
      let _tmp$8;
      switch (r.$tag) {
        case 0: {
          _tmp$8 = "Moon – Lexipedia";
          break;
        }
        case 1: {
          _tmp$8 = "Talk:Moon – Lexipedia";
          break;
        }
        case 2: {
          _tmp$8 = "View source for Moon – Lexipedia";
          break;
        }
        case 3: {
          _tmp$8 = "Moon: Revision history – Lexipedia";
          break;
        }
        case 4: {
          const _Stub = r;
          const _t = _Stub._0;
          _tmp$8 = `${_t} – Lexipedia`;
          break;
        }
        default: {
          const _Search = r;
          const _q = _Search._0;
          _tmp$8 = `Search results for ${_q} – Lexipedia`;
        }
      }
      _M0FP314vlmkit_2dsites4wiki4main15set__doc__title(_tmp$8);
      return;
    } else {
      _M0MP26mizchi7signals6Signal3setGRP314vlmkit_2dsites4wiki4main5RouteE(_M0FP314vlmkit_2dsites4wiki4main5route, _M0DTP314vlmkit_2dsites4wiki4main5Route7Article__);
      _M0FP314vlmkit_2dsites4wiki4main15set__doc__title("Moon – Lexipedia");
      if (h.length > 1) {
        const id = _M0FP314vlmkit_2dsites4wiki4main11decode__uri(_M0FP314vlmkit_2dsites4wiki4main11drop__chars(h, 1));
        const s = _M0FP314vlmkit_2dsites4wiki4main11section__of(id);
        if (s >= 0 && s < _M0FP314vlmkit_2dsites4wiki4main9acc__open.length) {
          _M0MP26mizchi7signals6Signal3setGbE(_M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(_M0FP314vlmkit_2dsites4wiki4main9acc__open, s), true);
        }
        _M0FP314vlmkit_2dsites4wiki4main12set__timeout(() => {
          _M0FP314vlmkit_2dsites4wiki4main14scroll__to__id(id);
        }, 0);
        return;
      } else {
        return;
      }
    }
  }
  function _M0FP314vlmkit_2dsites4wiki4main2go(h) {
    if (_M0FP314vlmkit_2dsites4wiki4main9get__hash() === h) {
      _M0FP314vlmkit_2dsites4wiki4main11sync__route();
      return;
    } else {
      _M0FP314vlmkit_2dsites4wiki4main9set__hash(h);
      return;
    }
  }
  function _M0FP314vlmkit_2dsites4wiki4main15search__matches(q) {
    const lq = _M0FP314vlmkit_2dsites4wiki4main5lower(q);
    if (lq === "") {
      return [];
    }
    const first = [];
    const rest = [];
    const _bind$19 = _M0FP314vlmkit_2dsites4wiki4main6titles.length;
    let _tmp$8 = 0;
    while (true) {
      const _ = _tmp$8;
      if (_ < _bind$19) {
        const t = _M0FP314vlmkit_2dsites4wiki4main6titles[_];
        const lt = _M0FP314vlmkit_2dsites4wiki4main5lower(t.title);
        if (_M0FP314vlmkit_2dsites4wiki4main12starts__with(lt, lq)) {
          _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(first, t);
        } else {
          if (_M0MPC16string6String8contains(lt, new _M0TPC16string10StringView(lq, 0, lq.length)) || _M0MPC16string6String8contains(_M0FP314vlmkit_2dsites4wiki4main5lower(t.desc), new _M0TPC16string10StringView(lq, 0, lq.length))) {
            _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(rest, t);
          }
        }
        _tmp$8 = _ + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    const _bind$20 = rest.length;
    let _tmp$9 = 0;
    while (true) {
      const _ = _tmp$9;
      if (_ < _bind$20) {
        const t = rest[_];
        _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(first, t);
        _tmp$9 = _ + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return first;
  }
  function _M0FP314vlmkit_2dsites4wiki4main13clear__search() {
    _M0MP26mizchi7signals6Signal3setGRP314vlmkit_2dsites4wiki4main5RouteE(_M0FP314vlmkit_2dsites4wiki4main9search__q, "");
    _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4wiki4main14search__browse, false);
    _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4wiki4main14search__active, -1);
    _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4wiki4main16search__expanded, false);
    const _bind$19 = _M0FP314vlmkit_2dsites4wiki4main13search__input.val;
    if (_bind$19.$tag === 1) {
      const _Some = _bind$19;
      const _el = _Some._0;
      _M0FP314vlmkit_2dsites4wiki4main10set__value(_el, "");
      return;
    } else {
      return;
    }
  }
  function _M0FP314vlmkit_2dsites4wiki4main11open__title(t) {
    _M0FP314vlmkit_2dsites4wiki4main13clear__search();
    _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4wiki4main19phone__search__open, false);
    _M0FP314vlmkit_2dsites4wiki4main2go(_M0FP314vlmkit_2dsites4wiki4main10wiki__href(t));
  }
  function _M0FP314vlmkit_2dsites4wiki4main14submit__search() {
    const q = _M0MP26mizchi7signals6Signal3getGRP314vlmkit_2dsites4wiki4main5RouteE(_M0FP314vlmkit_2dsites4wiki4main9search__q);
    const ms = q === "" && _M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4wiki4main14search__browse) ? _M0FP314vlmkit_2dsites4wiki4main6titles : _M0FP314vlmkit_2dsites4wiki4main15search__matches(q);
    const act = _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4wiki4main14search__active);
    const shown = ms.length > 8 ? 8 : ms.length;
    if (act >= 0 && act < shown) {
      _M0FP314vlmkit_2dsites4wiki4main11open__title(_M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(ms, act).title);
      return undefined;
    }
    const _bind$19 = _M0FP314vlmkit_2dsites4wiki4main6titles.length;
    let _tmp$8 = 0;
    while (true) {
      const _ = _tmp$8;
      if (_ < _bind$19) {
        const t = _M0FP314vlmkit_2dsites4wiki4main6titles[_];
        if (_M0FP314vlmkit_2dsites4wiki4main5lower(t.title) === _M0FP314vlmkit_2dsites4wiki4main5lower(q)) {
          _M0FP314vlmkit_2dsites4wiki4main11open__title(t.title);
          return undefined;
        }
        _tmp$8 = _ + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    _M0FP314vlmkit_2dsites4wiki4main13clear__search();
    _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4wiki4main19phone__search__open, false);
    _M0FP314vlmkit_2dsites4wiki4main2go(`#/search/${_M0FP314vlmkit_2dsites4wiki4main11encode__uri(q)}`);
  }
  function _M0FP314vlmkit_2dsites4wiki4main2sv(tag, attrs, children) {
    const kept = [];
    const _bind$19 = attrs.length;
    let _tmp$8 = 0;
    while (true) {
      const _ = _tmp$8;
      if (_ < _bind$19) {
        const x = attrs[_];
        _L: {
          _L$2: {
            const _x = x._0;
            if (_x === "class") {
              const _x$2 = x._1;
              if (_x$2.$tag === 0) {
                const _Static = _x$2;
                const _c = _Static._0;
                _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(kept, { _0: "__ref", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Handler((el) => {
                  _M0FP314vlmkit_2dsites4wiki4main9set__attr(el, "class", _c);
                }) });
              } else {
                break _L$2;
              }
            } else {
              break _L$2;
            }
            break _L;
          }
          _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(kept, x);
        }
        _tmp$8 = _ + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return _M0FP36mizchi4luna3dom19create__element__ns(_M0FP36mizchi4luna3dom7svg__ns, tag, kept, children);
  }
  function _M0FP314vlmkit_2dsites4wiki4main4icon(cls, d) {
    return _M0FP314vlmkit_2dsites4wiki4main2sv("svg", [_M0FP314vlmkit_2dsites4wiki4main1a("viewBox", "0 0 20 20"), _M0FP314vlmkit_2dsites4wiki4main1a("class", `icon ${cls}`), _M0FP314vlmkit_2dsites4wiki4main1a("aria-hidden", "true"), _M0FP314vlmkit_2dsites4wiki4main1a("focusable", "false")], [_M0FP314vlmkit_2dsites4wiki4main2sv("path", [_M0FP314vlmkit_2dsites4wiki4main1a("d", d), _M0FP314vlmkit_2dsites4wiki4main1a("fill", "none"), _M0FP314vlmkit_2dsites4wiki4main1a("stroke", "currentColor"), _M0FP314vlmkit_2dsites4wiki4main1a("stroke-width", "1.8"), _M0FP314vlmkit_2dsites4wiki4main1a("stroke-linecap", "round"), _M0FP314vlmkit_2dsites4wiki4main1a("stroke-linejoin", "round")], [])]);
  }
  function _M0FP314vlmkit_2dsites4wiki4main12icon__search(cls) {
    return _M0FP314vlmkit_2dsites4wiki4main4icon(cls, "M8.5 3.5a5 5 0 1 0 0 10a5 5 0 1 0 0-10M12.2 12.2L16.5 16.5");
  }
  function _M0FP314vlmkit_2dsites4wiki4main6circle(cx, cy, r, fill) {
    return _M0FP314vlmkit_2dsites4wiki4main2sv("circle", [_M0FP314vlmkit_2dsites4wiki4main1a("cx", cx), _M0FP314vlmkit_2dsites4wiki4main1a("cy", cy), _M0FP314vlmkit_2dsites4wiki4main1a("r", r), _M0FP314vlmkit_2dsites4wiki4main1a("fill", fill)], []);
  }
  function _M0FP314vlmkit_2dsites4wiki4main7ellipse(cx, cy, rx, ry, fill) {
    const attrs = [_M0FP314vlmkit_2dsites4wiki4main1a("cx", cx), _M0FP314vlmkit_2dsites4wiki4main1a("cy", cy), _M0FP314vlmkit_2dsites4wiki4main1a("rx", rx), _M0FP314vlmkit_2dsites4wiki4main1a("ry", ry)];
    const _p = "";
    if (!(fill === _p)) {
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(attrs, _M0FP314vlmkit_2dsites4wiki4main1a("fill", fill));
    }
    return _M0FP314vlmkit_2dsites4wiki4main2sv("ellipse", attrs, []);
  }
  function _M0FP314vlmkit_2dsites4wiki4main4path(d, fill) {
    return fill === "" ? _M0FP314vlmkit_2dsites4wiki4main2sv("path", [_M0FP314vlmkit_2dsites4wiki4main1a("d", d)], []) : _M0FP314vlmkit_2dsites4wiki4main2sv("path", [_M0FP314vlmkit_2dsites4wiki4main1a("d", d), _M0FP314vlmkit_2dsites4wiki4main1a("fill", fill)], []);
  }
  function _M0FP314vlmkit_2dsites4wiki4main9svg__root(view_box, label, cls, children) {
    const attrs = [_M0FP314vlmkit_2dsites4wiki4main1a("viewBox", view_box), _M0FP314vlmkit_2dsites4wiki4main1a("class", cls), _M0FP314vlmkit_2dsites4wiki4main1a("focusable", "false")];
    if (label === "") {
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(attrs, _M0FP314vlmkit_2dsites4wiki4main1a("aria-hidden", "true"));
    } else {
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(attrs, _M0FP314vlmkit_2dsites4wiki4main1a("role", "img"));
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(attrs, _M0FP314vlmkit_2dsites4wiki4main1a("aria-label", label));
    }
    return _M0FP314vlmkit_2dsites4wiki4main2sv("svg", attrs, children);
  }
  function _M0FP314vlmkit_2dsites4wiki4main10thumb__art(kind, idp) {
    const bg = _M0FP314vlmkit_2dsites4wiki4main2sv("rect", [_M0FP314vlmkit_2dsites4wiki4main1a("width", "80"), _M0FP314vlmkit_2dsites4wiki4main1a("height", "80"), _M0FP314vlmkit_2dsites4wiki4main1a("rx", "4"), _M0FP314vlmkit_2dsites4wiki4main1a("fill", "#141821")], []);
    let body;
    _L: {
      _L$2: {
        _L$3: {
          _L$4: {
            switch (kind) {
              case "moon": {
                break _L$4;
              }
              case "farside": {
                break _L$4;
              }
              case "earth": {
                body = [_M0FP314vlmkit_2dsites4wiki4main6circle("40", "40", "26", "#2f6fb5"), _M0FP314vlmkit_2dsites4wiki4main7ellipse("34", "34", "9", "7", "#6f9a56"), _M0FP314vlmkit_2dsites4wiki4main7ellipse("50", "50", "7", "5", "#6f9a56"), _M0FP314vlmkit_2dsites4wiki4main7ellipse("44", "26", "10", "3", "#f4f7fb")];
                break;
              }
              case "sun": {
                body = [_M0FP314vlmkit_2dsites4wiki4main6circle("40", "40", "30", "#5a3a12"), _M0FP314vlmkit_2dsites4wiki4main6circle("40", "40", "22", "#f2b33d"), _M0FP314vlmkit_2dsites4wiki4main6circle("40", "40", "15", "#ffd77a")];
                break;
              }
              case "orbit": {
                body = [_M0FP314vlmkit_2dsites4wiki4main2sv("ellipse", [_M0FP314vlmkit_2dsites4wiki4main1a("cx", "40"), _M0FP314vlmkit_2dsites4wiki4main1a("cy", "40"), _M0FP314vlmkit_2dsites4wiki4main1a("rx", "30"), _M0FP314vlmkit_2dsites4wiki4main1a("ry", "18"), _M0FP314vlmkit_2dsites4wiki4main1a("fill", "none"), _M0FP314vlmkit_2dsites4wiki4main1a("stroke", "#8fa3c7"), _M0FP314vlmkit_2dsites4wiki4main1a("stroke-width", "1.5"), _M0FP314vlmkit_2dsites4wiki4main1a("stroke-dasharray", "3 3")], []), _M0FP314vlmkit_2dsites4wiki4main6circle("40", "40", "9", "#2f6fb5"), _M0FP314vlmkit_2dsites4wiki4main6circle("70", "40", "4", "#d9d5cb")];
                break;
              }
              case "wave": {
                body = [_M0FP314vlmkit_2dsites4wiki4main4path("M0,46 Q10,36 20,46 T40,46 T60,46 T80,46 L80,80 L0,80 Z", "#2f6fb5"), _M0FP314vlmkit_2dsites4wiki4main4path("M0,56 Q10,48 20,56 T40,56 T60,56 T80,56 L80,80 L0,80 Z", "#1f4f86"), _M0FP314vlmkit_2dsites4wiki4main6circle("60", "20", "7", "#d9d5cb")];
                break;
              }
              case "phase": {
                body = [_M0FP314vlmkit_2dsites4wiki4main6circle("40", "40", "24", "#2a2d35"), _M0FP314vlmkit_2dsites4wiki4main4path("M40,16 A24,24 0 0 1 40,64 A12,24 0 0 0 40,16 Z", "#e8e4da")];
                break;
              }
              case "eclipse": {
                body = [_M0FP314vlmkit_2dsites4wiki4main6circle("40", "40", "26", "#f2b33d"), _M0FP314vlmkit_2dsites4wiki4main6circle("40", "40", "21", "#ffe9b0"), _M0FP314vlmkit_2dsites4wiki4main6circle("40", "40", "20", "#05070b")];
                break;
              }
              case "blood": {
                body = [_M0FP314vlmkit_2dsites4wiki4main6circle("40", "40", "24", "#8c3a22"), _M0FP314vlmkit_2dsites4wiki4main7ellipse("34", "34", "7", "5", "#6e2a18"), _M0FP314vlmkit_2dsites4wiki4main6circle("46", "50", "4", "#a24a30")];
                break;
              }
              case "crater": {
                break _L$2;
              }
              case "impact": {
                break _L$2;
              }
              case "mare": {
                body = [_M0FP314vlmkit_2dsites4wiki4main6circle("40", "40", "26", "#cfcac0"), _M0FP314vlmkit_2dsites4wiki4main7ellipse("36", "34", "14", "10", "#7f7a71"), _M0FP314vlmkit_2dsites4wiki4main7ellipse("50", "46", "8", "7", "#837e75")];
                break;
              }
              case "rock": {
                body = [_M0FP314vlmkit_2dsites4wiki4main4path("M14,60 L24,36 L44,28 L62,38 L68,60 Z", "#8a857c"), _M0FP314vlmkit_2dsites4wiki4main4path("M24,36 L44,28 L40,46 Z", "#a29d93"), _M0FP314vlmkit_2dsites4wiki4main4path("M40,46 L62,38 L68,60 Z", "#6e6a63")];
                break;
              }
              case "calendar": {
                body = [_M0FP314vlmkit_2dsites4wiki4main2sv("rect", [_M0FP314vlmkit_2dsites4wiki4main1a("x", "16"), _M0FP314vlmkit_2dsites4wiki4main1a("y", "18"), _M0FP314vlmkit_2dsites4wiki4main1a("width", "48"), _M0FP314vlmkit_2dsites4wiki4main1a("height", "46"), _M0FP314vlmkit_2dsites4wiki4main1a("rx", "3"), _M0FP314vlmkit_2dsites4wiki4main1a("fill", "#e8e4da")], []), _M0FP314vlmkit_2dsites4wiki4main2sv("rect", [_M0FP314vlmkit_2dsites4wiki4main1a("x", "16"), _M0FP314vlmkit_2dsites4wiki4main1a("y", "18"), _M0FP314vlmkit_2dsites4wiki4main1a("width", "48"), _M0FP314vlmkit_2dsites4wiki4main1a("height", "10"), _M0FP314vlmkit_2dsites4wiki4main1a("rx", "3"), _M0FP314vlmkit_2dsites4wiki4main1a("fill", "#3a66b0")], []), _M0FP314vlmkit_2dsites4wiki4main6circle("30", "42", "5", "#2a2d35"), _M0FP314vlmkit_2dsites4wiki4main6circle("50", "42", "5", "#2a2d35"), _M0FP314vlmkit_2dsites4wiki4main4path("M50,37 A5,5 0 0 1 50,47 Z", "#e8e4da")];
                break;
              }
              case "map": {
                body = [_M0FP314vlmkit_2dsites4wiki4main2sv("rect", [_M0FP314vlmkit_2dsites4wiki4main1a("x", "14"), _M0FP314vlmkit_2dsites4wiki4main1a("y", "16"), _M0FP314vlmkit_2dsites4wiki4main1a("width", "52"), _M0FP314vlmkit_2dsites4wiki4main1a("height", "48"), _M0FP314vlmkit_2dsites4wiki4main1a("fill", "#cfcac0")], []), _M0FP314vlmkit_2dsites4wiki4main7ellipse("32", "34", "10", "7", "#8d887e"), _M0FP314vlmkit_2dsites4wiki4main7ellipse("50", "48", "8", "6", "#8d887e"), _M0FP314vlmkit_2dsites4wiki4main2sv("path", [_M0FP314vlmkit_2dsites4wiki4main1a("d", "M14,40 L66,40 M40,16 L40,64"), _M0FP314vlmkit_2dsites4wiki4main1a("stroke", "#5d6270"), _M0FP314vlmkit_2dsites4wiki4main1a("stroke-width", "0.8"), _M0FP314vlmkit_2dsites4wiki4main1a("fill", "none")], [])];
                break;
              }
              case "layers": {
                body = [_M0FP314vlmkit_2dsites4wiki4main6circle("40", "40", "28", "#a29d93"), _M0FP314vlmkit_2dsites4wiki4main6circle("40", "40", "20", "#c26a3a"), _M0FP314vlmkit_2dsites4wiki4main6circle("40", "40", "9", "#f2b33d")];
                break;
              }
              case "ice": {
                body = [_M0FP314vlmkit_2dsites4wiki4main4path("M0,50 L80,50 L80,80 L0,80 Z", "#6e6a63"), _M0FP314vlmkit_2dsites4wiki4main7ellipse("40", "54", "24", "7", "#2a2d35"), _M0FP314vlmkit_2dsites4wiki4main7ellipse("40", "55", "14", "3", "#bfe3f5")];
                break;
              }
              case "telescope": {
                body = [_M0FP314vlmkit_2dsites4wiki4main2sv("path", [_M0FP314vlmkit_2dsites4wiki4main1a("d", "M18,48 L58,24 L62,32 L22,56 Z"), _M0FP314vlmkit_2dsites4wiki4main1a("fill", "#8fa3c7")], []), _M0FP314vlmkit_2dsites4wiki4main2sv("path", [_M0FP314vlmkit_2dsites4wiki4main1a("d", "M38,44 L30,66 M38,44 L48,66"), _M0FP314vlmkit_2dsites4wiki4main1a("stroke", "#8fa3c7"), _M0FP314vlmkit_2dsites4wiki4main1a("stroke-width", "2.5"), _M0FP314vlmkit_2dsites4wiki4main1a("fill", "none")], []), _M0FP314vlmkit_2dsites4wiki4main6circle("66", "16", "5", "#d9d5cb")];
                break;
              }
              case "probe": {
                body = [_M0FP314vlmkit_2dsites4wiki4main2sv("rect", [_M0FP314vlmkit_2dsites4wiki4main1a("x", "32"), _M0FP314vlmkit_2dsites4wiki4main1a("y", "32"), _M0FP314vlmkit_2dsites4wiki4main1a("width", "16"), _M0FP314vlmkit_2dsites4wiki4main1a("height", "16"), _M0FP314vlmkit_2dsites4wiki4main1a("fill", "#c9a24a")], []), _M0FP314vlmkit_2dsites4wiki4main2sv("rect", [_M0FP314vlmkit_2dsites4wiki4main1a("x", "8"), _M0FP314vlmkit_2dsites4wiki4main1a("y", "36"), _M0FP314vlmkit_2dsites4wiki4main1a("width", "22"), _M0FP314vlmkit_2dsites4wiki4main1a("height", "8"), _M0FP314vlmkit_2dsites4wiki4main1a("fill", "#3a66b0")], []), _M0FP314vlmkit_2dsites4wiki4main2sv("rect", [_M0FP314vlmkit_2dsites4wiki4main1a("x", "50"), _M0FP314vlmkit_2dsites4wiki4main1a("y", "36"), _M0FP314vlmkit_2dsites4wiki4main1a("width", "22"), _M0FP314vlmkit_2dsites4wiki4main1a("height", "8"), _M0FP314vlmkit_2dsites4wiki4main1a("fill", "#3a66b0")], []), _M0FP314vlmkit_2dsites4wiki4main2sv("path", [_M0FP314vlmkit_2dsites4wiki4main1a("d", "M40,32 L40,20"), _M0FP314vlmkit_2dsites4wiki4main1a("stroke", "#d9d5cb"), _M0FP314vlmkit_2dsites4wiki4main1a("stroke-width", "1.5")], [])];
                break;
              }
              default: {
                body = [_M0FP314vlmkit_2dsites4wiki4main6circle("40", "40", "26", "#d9d5cb")];
              }
            }
            break _L$3;
          }
          const dots = [_M0FP314vlmkit_2dsites4wiki4main6circle("40", "40", "26", "#d9d5cb")];
          if (kind === "moon") {
            _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(dots, _M0FP314vlmkit_2dsites4wiki4main7ellipse("33", "33", "8", "6", "#9d988e"));
            _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(dots, _M0FP314vlmkit_2dsites4wiki4main7ellipse("47", "38", "6", "8", "#9d988e"));
            _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(dots, _M0FP314vlmkit_2dsites4wiki4main6circle("44", "54", "3", "#f1eee7"));
          } else {
            _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(dots, _M0FP314vlmkit_2dsites4wiki4main6circle("30", "30", "4", "#aaa59b"));
            _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(dots, _M0FP314vlmkit_2dsites4wiki4main6circle("50", "34", "5", "#aaa59b"));
            _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(dots, _M0FP314vlmkit_2dsites4wiki4main6circle("38", "52", "6", "#aaa59b"));
            _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(dots, _M0FP314vlmkit_2dsites4wiki4main6circle("54", "52", "3", "#aaa59b"));
          }
          body = dots;
        }
        break _L;
      }
      const parts = [_M0FP314vlmkit_2dsites4wiki4main4path("M0,52 L80,52 L80,80 L0,80 Z", "#6e6a63"), _M0FP314vlmkit_2dsites4wiki4main7ellipse("40", "54", "26", "8", "#3e3b36"), _M0FP314vlmkit_2dsites4wiki4main7ellipse("40", "52", "22", "5", "#55514b")];
      if (kind === "impact") {
        _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(parts, _M0FP314vlmkit_2dsites4wiki4main6circle("58", "20", "8", "#c26a3a"));
        _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(parts, _M0FP314vlmkit_2dsites4wiki4main4path("M52,26 L44,40 L48,40 Z", "#f2b33d"));
      }
      body = parts;
    }
    const children = [bg];
    const _bind$19 = body.length;
    let _tmp$8 = 0;
    while (true) {
      const _ = _tmp$8;
      if (_ < _bind$19) {
        const n = body[_];
        _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(children, n);
        _tmp$8 = _ + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return _M0FP314vlmkit_2dsites4wiki4main9svg__root("0 0 80 80", "", "thumb-art", children);
  }
  function _M0FP314vlmkit_2dsites4wiki4main11search__box() {
    const visible = _M0FP26mizchi7signals4memoGRPB5ArrayGsEE(() => {
      const q = _M0MP26mizchi7signals6Signal3getGRP314vlmkit_2dsites4wiki4main5RouteE(_M0FP314vlmkit_2dsites4wiki4main9search__q);
      const ms = q === "" && _M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4wiki4main14search__browse) ? _M0FP314vlmkit_2dsites4wiki4main6titles : _M0FP314vlmkit_2dsites4wiki4main15search__matches(q);
      return ms.length > 8 ? _M0MPC15array9ArrayView9to__ownedGRP314vlmkit_2dsites4wiki4main5TitleE(_M0MPC15array5Array21clamped__view_2einnerGRP314vlmkit_2dsites4wiki4main5TitleE(ms, 0, _M0FP314vlmkit_2dsites4wiki4main11search__boxN6constrS2371)) : ms;
    });
    return _M0FP314vlmkit_2dsites4wiki4main1h("form", [_M0FP314vlmkit_2dsites4wiki4main2dy("class", () => {
      const _p = "search";
      const _p$2 = "open";
      const _p$3 = _M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4wiki4main19phone__search__open);
      return _p$3 ? `${_p} ${_p$2}` : _p;
    }), _M0FP314vlmkit_2dsites4wiki4main1a("role", "search"), _M0FP314vlmkit_2dsites4wiki4main2on("submit", (e) => {
      _M0FP314vlmkit_2dsites4wiki4main7prevent(e);
      _M0FP314vlmkit_2dsites4wiki4main14submit__search();
    })], [_M0FP314vlmkit_2dsites4wiki4main1h("div", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "search-field")], [_M0FP314vlmkit_2dsites4wiki4main1h("label", [_M0FP314vlmkit_2dsites4wiki4main1a("for", "search-input"), _M0FP314vlmkit_2dsites4wiki4main2dy("class", () => {
      const _p = "search-label";
      const _p$2 = "filled";
      const _p$3 = _M0MP26mizchi7signals6Signal3getGRP314vlmkit_2dsites4wiki4main5RouteE(_M0FP314vlmkit_2dsites4wiki4main9search__q);
      const _p$4 = "";
      const _p$5 = !(_p$3 === _p$4);
      return _p$5 ? `${_p} ${_p$2}` : _p;
    })], [_M0FP314vlmkit_2dsites4wiki4main2tx("Search Lexipedia")]), _M0FP314vlmkit_2dsites4wiki4main12icon__search("search-icon"), _M0FP314vlmkit_2dsites4wiki4main1h("input", [_M0FP314vlmkit_2dsites4wiki4main1a("id", "search-input"), _M0FP314vlmkit_2dsites4wiki4main1a("type", "search"), _M0FP314vlmkit_2dsites4wiki4main1a("role", "combobox"), _M0FP314vlmkit_2dsites4wiki4main1a("autocomplete", "off"), _M0FP314vlmkit_2dsites4wiki4main1a("aria-autocomplete", "list"), _M0FP314vlmkit_2dsites4wiki4main1a("aria-controls", "search-listbox"), _M0FP314vlmkit_2dsites4wiki4main2dy("aria-expanded", () => {
      const _p = _M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4wiki4main16search__expanded) && visible().length > 0;
      return _p ? "true" : "false";
    }), _M0FP314vlmkit_2dsites4wiki4main2dy("aria-activedescendant", () => {
      const i = _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4wiki4main14search__active);
      if (i >= 0 && _M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4wiki4main16search__expanded)) {
        const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(5);
        _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, "sugg-");
        _M0MPB13StringBuilder13write__objectGiE(_string_builder, i);
        return _string_builder.val;
      } else {
        return "";
      }
    }), _M0FP314vlmkit_2dsites4wiki4main7ref__to(_M0FP314vlmkit_2dsites4wiki4main13search__input), _M0FP314vlmkit_2dsites4wiki4main2on("input", (e) => {
      _M0MP26mizchi7signals6Signal3setGRP314vlmkit_2dsites4wiki4main5RouteE(_M0FP314vlmkit_2dsites4wiki4main9search__q, _M0FP314vlmkit_2dsites4wiki4main9ev__value(e));
      _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4wiki4main14search__active, -1);
      _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4wiki4main16search__expanded, true);
    }), _M0FP314vlmkit_2dsites4wiki4main2on("focus", (_e) => {
      _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4wiki4main16search__expanded, true);
    }), _M0FP314vlmkit_2dsites4wiki4main2on("blur", (_e) => {
      _M0FP314vlmkit_2dsites4wiki4main12set__timeout(() => {
        _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4wiki4main16search__expanded, false);
        _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4wiki4main14search__browse, false);
      }, 150);
    }), _M0FP314vlmkit_2dsites4wiki4main2on("keydown", (e) => {
      const k = _M0FP314vlmkit_2dsites4wiki4main7ev__key(e);
      const n = visible().length;
      if (k === "ArrowDown" && (n === 0 && _M0MP26mizchi7signals6Signal3getGRP314vlmkit_2dsites4wiki4main5RouteE(_M0FP314vlmkit_2dsites4wiki4main9search__q) === "")) {
        _M0FP314vlmkit_2dsites4wiki4main7prevent(e);
        _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4wiki4main14search__browse, true);
        _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4wiki4main16search__expanded, true);
        _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4wiki4main14search__active, 0);
        return;
      } else {
        if (k === "ArrowDown" && n > 0) {
          _M0FP314vlmkit_2dsites4wiki4main7prevent(e);
          _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4wiki4main16search__expanded, true);
          _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4wiki4main14search__active, (_M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4wiki4main14search__active) + 1 | 0) % n | 0);
          return;
        } else {
          if (k === "ArrowUp" && n > 0) {
            _M0FP314vlmkit_2dsites4wiki4main7prevent(e);
            const i = _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4wiki4main14search__active);
            _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4wiki4main14search__active, i <= 0 ? n - 1 | 0 : i - 1 | 0);
            return;
          } else {
            if (k === "Escape") {
              if (_M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4wiki4main16search__expanded) && n > 0) {
                _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4wiki4main16search__expanded, false);
                _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4wiki4main14search__active, -1);
                return;
              } else {
                _M0FP314vlmkit_2dsites4wiki4main13clear__search();
                return;
              }
            } else {
              return;
            }
          }
        }
      }
    })], []), _M0FP314vlmkit_2dsites4wiki4main1h("ul", [_M0FP314vlmkit_2dsites4wiki4main1a("id", "search-listbox"), _M0FP314vlmkit_2dsites4wiki4main1a("role", "listbox"), _M0FP314vlmkit_2dsites4wiki4main1a("aria-label", "Search suggestions"), _M0FP314vlmkit_2dsites4wiki4main2dy("class", () => {
      const _p = "suggestions";
      const _p$2 = "open";
      const _p$3 = _M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4wiki4main16search__expanded) && visible().length > 0;
      return _p$3 ? `${_p} ${_p$2}` : _p;
    })], [_M0FP36mizchi4luna3dom9for__eachGRP314vlmkit_2dsites4wiki4main5RouteE(() => visible(), (t, i) => {
      const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(5);
      _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, "sugg-");
      _M0MPB13StringBuilder13write__objectGiE(_string_builder, i);
      const _tmp$8 = [_M0FP314vlmkit_2dsites4wiki4main1a("id", _string_builder.val), _M0FP314vlmkit_2dsites4wiki4main1a("role", "option"), _M0FP314vlmkit_2dsites4wiki4main2dy("aria-selected", () => {
        const _p = _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4wiki4main14search__active) === i;
        return _p ? "true" : "false";
      }), _M0FP314vlmkit_2dsites4wiki4main2dy("class", () => {
        const _p = "sugg";
        const _p$2 = "active";
        const _p$3 = _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4wiki4main14search__active) === i;
        return _p$3 ? `${_p} ${_p$2}` : _p;
      }), _M0FP314vlmkit_2dsites4wiki4main2on("mousedown", (e) => {
        _M0FP314vlmkit_2dsites4wiki4main7prevent(e);
      }), _M0FP314vlmkit_2dsites4wiki4main2on("click", (_e) => {
        _M0FP314vlmkit_2dsites4wiki4main11open__title(t.title);
      })];
      const _tmp$9 = t.thumb;
      const _string_builder$2 = _M0MPB13StringBuilder21StringBuilder_2einner(1);
      _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$2, "s");
      _M0MPB13StringBuilder13write__objectGiE(_string_builder$2, i);
      return _M0FP314vlmkit_2dsites4wiki4main1h("li", _tmp$8, [_M0FP314vlmkit_2dsites4wiki4main10thumb__art(_tmp$9, _string_builder$2.val), _M0FP314vlmkit_2dsites4wiki4main1h("span", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "sugg-text")], [_M0FP314vlmkit_2dsites4wiki4main1h("span", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "sugg-title")], [_M0FP314vlmkit_2dsites4wiki4main2tx(t.title)]), _M0FP314vlmkit_2dsites4wiki4main1h("span", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "sugg-desc")], [_M0FP314vlmkit_2dsites4wiki4main2tx(t.desc)])])]);
    })])]), _M0FP314vlmkit_2dsites4wiki4main1h("button", [_M0FP314vlmkit_2dsites4wiki4main1a("type", "submit"), _M0FP314vlmkit_2dsites4wiki4main1a("class", "btn search-btn")], [_M0FP314vlmkit_2dsites4wiki4main2tx("Search")])]);
  }
  function _M0FP314vlmkit_2dsites4wiki4main10icon__menu() {
    return _M0FP314vlmkit_2dsites4wiki4main4icon("", "M3 5.5h14M3 10h14M3 14.5h14");
  }
  function _M0FP314vlmkit_2dsites4wiki4main13icon__chevron(cls) {
    return _M0FP314vlmkit_2dsites4wiki4main4icon(cls, "M7 5l5 5l-5 5");
  }
  function _M0FP314vlmkit_2dsites4wiki4main10icon__down() {
    return _M0FP314vlmkit_2dsites4wiki4main4icon("chev-down", "M5.5 8l4.5 4.5L14.5 8");
  }
  function _M0FP314vlmkit_2dsites4wiki4main10icon__lang() {
    return _M0FP314vlmkit_2dsites4wiki4main4icon("", "M2.5 4.5h8M6.5 3v1.5M4 4.5c.6 3 2.6 5 5 6M9 4.5c-.6 3-2.6 5.4-5.5 6.5M10 17l3.5-8l3.5 8M11.2 14.2h4.6");
  }
  function _M0FP314vlmkit_2dsites4wiki4main9icon__toc() {
    return _M0FP314vlmkit_2dsites4wiki4main4icon("", "M3 5h2M8 5h9M3 10h2M8 10h9M3 15h2M8 15h9");
  }
  function _M0FP314vlmkit_2dsites4wiki4main11icon__close() {
    return _M0FP314vlmkit_2dsites4wiki4main4icon("", "M5 5l10 10M15 5L5 15");
  }
  function _M0FP314vlmkit_2dsites4wiki4main10icon__star() {
    return _M0FP314vlmkit_2dsites4wiki4main2sv("svg", [_M0FP314vlmkit_2dsites4wiki4main1a("viewBox", "0 0 20 20"), _M0FP314vlmkit_2dsites4wiki4main1a("class", "icon star"), _M0FP314vlmkit_2dsites4wiki4main1a("aria-hidden", "true"), _M0FP314vlmkit_2dsites4wiki4main1a("focusable", "false")], [_M0FP314vlmkit_2dsites4wiki4main2sv("path", [_M0FP314vlmkit_2dsites4wiki4main1a("d", "M10 2.8l2.2 4.6l5 .7l-3.6 3.5l.9 5L10 14.2l-4.5 2.4l.9-5L2.8 8.1l5-.7z"), _M0FP314vlmkit_2dsites4wiki4main1a("stroke", "currentColor"), _M0FP314vlmkit_2dsites4wiki4main1a("stroke-width", "1.5"), _M0FP314vlmkit_2dsites4wiki4main1a("stroke-linejoin", "round")], [])]);
  }
  function _M0FP314vlmkit_2dsites4wiki4main11icon__brush() {
    return _M0FP314vlmkit_2dsites4wiki4main4icon("", "M10 3a7 7 0 1 0 0 14c1 0 1.5-.8 1-1.6c-.6-1 0-2.4 1.4-2.4H14a3 3 0 0 0 3-3c0-3.9-3.1-7-7-7M6.5 9.5h.01M9 6.5h.01M12.5 7h.01");
  }
  function _M0FP314vlmkit_2dsites4wiki4main4logo() {
    return _M0FP314vlmkit_2dsites4wiki4main2sv("svg", [_M0FP314vlmkit_2dsites4wiki4main1a("viewBox", "0 0 40 40"), _M0FP314vlmkit_2dsites4wiki4main1a("class", "logo"), _M0FP314vlmkit_2dsites4wiki4main1a("aria-hidden", "true"), _M0FP314vlmkit_2dsites4wiki4main1a("focusable", "false")], [_M0FP314vlmkit_2dsites4wiki4main2sv("circle", [_M0FP314vlmkit_2dsites4wiki4main1a("cx", "20"), _M0FP314vlmkit_2dsites4wiki4main1a("cy", "20"), _M0FP314vlmkit_2dsites4wiki4main1a("r", "17"), _M0FP314vlmkit_2dsites4wiki4main1a("fill", "none"), _M0FP314vlmkit_2dsites4wiki4main1a("stroke", "currentColor"), _M0FP314vlmkit_2dsites4wiki4main1a("stroke-width", "2")], []), _M0FP314vlmkit_2dsites4wiki4main2sv("path", [_M0FP314vlmkit_2dsites4wiki4main1a("d", "M23 9a11 11 0 1 0 0 22a9 9 0 0 1 0-22z"), _M0FP314vlmkit_2dsites4wiki4main1a("fill", "currentColor")], []), _M0FP314vlmkit_2dsites4wiki4main2sv("path", [_M0FP314vlmkit_2dsites4wiki4main1a("d", "M27 14l1 2.4l2.6.2l-2 1.7l.6 2.5l-2.2-1.4l-2.2 1.4l.6-2.5l-2-1.7l2.6-.2z"), _M0FP314vlmkit_2dsites4wiki4main1a("fill", "currentColor")], [])]);
  }
  function _M0FP314vlmkit_2dsites4wiki4main15toc__item__link(id, label, on_nav) {
    return _M0FP314vlmkit_2dsites4wiki4main1h("a", [_M0FP314vlmkit_2dsites4wiki4main1a("href", `#${id}`), _M0FP314vlmkit_2dsites4wiki4main2dy("class", () => {
      const _p = "toc-link";
      const _p$2 = "active";
      const _p$3 = _M0MP26mizchi7signals6Signal3getGRP314vlmkit_2dsites4wiki4main5RouteE(_M0FP314vlmkit_2dsites4wiki4main10active__id) === id;
      return _p$3 ? `${_p} ${_p$2}` : _p;
    }), _M0FP314vlmkit_2dsites4wiki4main2dy("aria-current", () => _M0MP26mizchi7signals6Signal3getGRP314vlmkit_2dsites4wiki4main5RouteE(_M0FP314vlmkit_2dsites4wiki4main10active__id) === id ? "location" : "false"), _M0FP314vlmkit_2dsites4wiki4main2on("click", (_e) => {
      on_nav();
    })], [_M0FP314vlmkit_2dsites4wiki4main2tx(label)]);
  }
  function _M0FP314vlmkit_2dsites4wiki4main9toc__list(prefix, on_nav) {
    const items = [_M0FP314vlmkit_2dsites4wiki4main1h("li", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "toc-item")], [_M0FP314vlmkit_2dsites4wiki4main15toc__item__link("top", "(Top)", on_nav)])];
    const _bind$19 = _M0FP314vlmkit_2dsites4wiki4main8sections.length;
    let _tmp$8 = 0;
    while (true) {
      const i = _tmp$8;
      if (i < _bind$19) {
        const s = _M0FP314vlmkit_2dsites4wiki4main8sections[i];
        const row = [];
        if (s.subs.length > 0) {
          const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(5);
          _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, "-sub-");
          _M0MPB13StringBuilder13write__objectGiE(_string_builder, i);
          const list_id = `${prefix}${_string_builder.val}`;
          _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(row, _M0FP314vlmkit_2dsites4wiki4main1h("button", [_M0FP314vlmkit_2dsites4wiki4main1a("type", "button"), _M0FP314vlmkit_2dsites4wiki4main1a("class", "toc-toggle"), _M0FP314vlmkit_2dsites4wiki4main1a("aria-controls", list_id), _M0FP314vlmkit_2dsites4wiki4main1a("aria-label", `Subsections of ${s.title}`), _M0FP314vlmkit_2dsites4wiki4main2dy("aria-expanded", () => {
            const _p = _M0FP314vlmkit_2dsites4wiki4main13toc__expanded(i);
            return _p ? "true" : "false";
          }), _M0FP314vlmkit_2dsites4wiki4main2on("click", (_e) => {
            _M0MP26mizchi7signals6Signal3setGiE(_M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(_M0FP314vlmkit_2dsites4wiki4main9toc__open, i), _M0FP314vlmkit_2dsites4wiki4main13toc__expanded(i) ? 2 : 1);
          })], [_M0FP314vlmkit_2dsites4wiki4main13icon__chevron("chev")]));
          _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(row, _M0FP314vlmkit_2dsites4wiki4main15toc__item__link(s.id, s.title, on_nav));
          const subs = [];
          const _bind$20 = s.subs;
          const _bind$21 = _bind$20.length;
          let _tmp$9 = 0;
          while (true) {
            const _ = _tmp$9;
            if (_ < _bind$21) {
              const sub = _bind$20[_];
              _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(subs, _M0FP314vlmkit_2dsites4wiki4main1h("li", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "toc-item")], [_M0FP314vlmkit_2dsites4wiki4main15toc__item__link(sub.id, sub.title, on_nav)]));
              _tmp$9 = _ + 1 | 0;
              continue;
            } else {
              break;
            }
          }
          _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(row, _M0FP314vlmkit_2dsites4wiki4main1h("ul", [_M0FP314vlmkit_2dsites4wiki4main1a("id", list_id), _M0FP314vlmkit_2dsites4wiki4main2dy("class", () => {
            const _p = "toc-sub";
            const _p$2 = "open";
            const _p$3 = _M0FP314vlmkit_2dsites4wiki4main13toc__expanded(i);
            return _p$3 ? `${_p} ${_p$2}` : _p;
          })], subs));
        } else {
          _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(row, _M0FP314vlmkit_2dsites4wiki4main15toc__item__link(s.id, s.title, on_nav));
        }
        _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(items, _M0FP314vlmkit_2dsites4wiki4main1h("li", [_M0FP314vlmkit_2dsites4wiki4main2dy("class", () => {
          const _p = "toc-item toc-l1";
          const _p$2 = "holds-active";
          const _p$3 = _M0FP314vlmkit_2dsites4wiki4main22section__holds__active(i);
          return _p$3 ? `${_p} ${_p$2}` : _p;
        })], row));
        _tmp$8 = i + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    const _bind$20 = _M0FP314vlmkit_2dsites4wiki4main9back__ids.length;
    let _tmp$9 = 0;
    while (true) {
      const k = _tmp$9;
      if (k < _bind$20) {
        const b = _M0FP314vlmkit_2dsites4wiki4main9back__ids[k];
        _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(items, _M0FP314vlmkit_2dsites4wiki4main1h("li", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "toc-item toc-l1")], [_M0FP314vlmkit_2dsites4wiki4main15toc__item__link(b, _M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(_M0FP314vlmkit_2dsites4wiki4main12back__titles, k), on_nav)]));
        _tmp$9 = k + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return _M0FP314vlmkit_2dsites4wiki4main1h("ul", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "toc-list")], items);
  }
  function _M0FP314vlmkit_2dsites4wiki4main9toc__rail() {
    return _M0FP314vlmkit_2dsites4wiki4main1h("nav", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "rail toc-rail"), _M0FP314vlmkit_2dsites4wiki4main1a("aria-labelledby", "toc-rail-h")], [_M0FP314vlmkit_2dsites4wiki4main1h("div", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "rail-inner")], [_M0FP314vlmkit_2dsites4wiki4main1h("div", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "rail-head")], [_M0FP314vlmkit_2dsites4wiki4main1h("h2", [_M0FP314vlmkit_2dsites4wiki4main1a("id", "toc-rail-h"), _M0FP314vlmkit_2dsites4wiki4main1a("class", "rail-title")], [_M0FP314vlmkit_2dsites4wiki4main2tx("Contents")]), _M0FP314vlmkit_2dsites4wiki4main1h("button", [_M0FP314vlmkit_2dsites4wiki4main1a("type", "button"), _M0FP314vlmkit_2dsites4wiki4main1a("class", "btn btn-small"), _M0FP314vlmkit_2dsites4wiki4main1a("aria-label", "Hide contents"), _M0FP314vlmkit_2dsites4wiki4main2on("click", (_e) => {
      _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4wiki4main11toc__hidden, true);
      _M0FP314vlmkit_2dsites4wiki4main5store("toc", "hidden");
      _M0FP314vlmkit_2dsites4wiki4main9focus__id("toc-pop-btn");
    })], [_M0FP314vlmkit_2dsites4wiki4main2tx("hide")])]), _M0FP314vlmkit_2dsites4wiki4main9toc__list("rail", () => {
    })])]);
  }
  function _M0FP314vlmkit_2dsites4wiki4main12radio__group(prefix, legend, name, sig, options) {
    const kids = [_M0FP314vlmkit_2dsites4wiki4main1h("legend", [], [_M0FP314vlmkit_2dsites4wiki4main2tx(legend)])];
    const _bind$19 = options.length;
    let _tmp$8 = 0;
    while (true) {
      const _ = _tmp$8;
      if (_ < _bind$19) {
        const opt = options[_];
        const _value = opt._0;
        const _label = opt._1;
        const id = `${prefix}-${name}-${_value}`;
        _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(kids, _M0FP314vlmkit_2dsites4wiki4main1h("div", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "radio")], [_M0FP314vlmkit_2dsites4wiki4main1h("input", [_M0FP314vlmkit_2dsites4wiki4main1a("type", "radio"), _M0FP314vlmkit_2dsites4wiki4main1a("id", id), _M0FP314vlmkit_2dsites4wiki4main1a("name", `${prefix}-${name}`), _M0FP314vlmkit_2dsites4wiki4main1a("value", _value), _M0FP314vlmkit_2dsites4wiki4main2dy("checked", () => {
          const _p = _M0MP26mizchi7signals6Signal3getGRP314vlmkit_2dsites4wiki4main5RouteE(sig) === _value;
          return _p ? "true" : "false";
        }), _M0FP314vlmkit_2dsites4wiki4main2on("change", (_e) => {
          _M0MP26mizchi7signals6Signal3setGRP314vlmkit_2dsites4wiki4main5RouteE(sig, _value);
          _M0FP314vlmkit_2dsites4wiki4main5store(name, _value);
        })], []), _M0FP314vlmkit_2dsites4wiki4main1h("label", [_M0FP314vlmkit_2dsites4wiki4main1a("for", id)], [_M0FP314vlmkit_2dsites4wiki4main2tx(_label)])]));
        _tmp$8 = _ + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return _M0FP314vlmkit_2dsites4wiki4main1h("fieldset", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "appearance-group")], kids);
  }
  function _M0FP314vlmkit_2dsites4wiki4main17appearance__panel(prefix) {
    return _M0FP314vlmkit_2dsites4wiki4main1h("div", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "appearance-panel")], [_M0FP314vlmkit_2dsites4wiki4main12radio__group(prefix, "Text", "text", _M0FP314vlmkit_2dsites4wiki4main10text__size, [_M0FP314vlmkit_2dsites4wiki4main17appearance__panelN5tupleS2432, _M0FP314vlmkit_2dsites4wiki4main17appearance__panelN5tupleS2433, _M0FP314vlmkit_2dsites4wiki4main17appearance__panelN5tupleS2434]), _M0FP314vlmkit_2dsites4wiki4main12radio__group(prefix, "Width", "width", _M0FP314vlmkit_2dsites4wiki4main11width__pref, [_M0FP314vlmkit_2dsites4wiki4main17appearance__panelN5tupleS2435, _M0FP314vlmkit_2dsites4wiki4main17appearance__panelN5tupleS2436]), _M0FP314vlmkit_2dsites4wiki4main12radio__group(prefix, "Color", "color", _M0FP314vlmkit_2dsites4wiki4main11color__pref, [_M0FP314vlmkit_2dsites4wiki4main17appearance__panelN5tupleS2437, _M0FP314vlmkit_2dsites4wiki4main17appearance__panelN5tupleS2438, _M0FP314vlmkit_2dsites4wiki4main17appearance__panelN5tupleS2439])]);
  }
  function _M0FP314vlmkit_2dsites4wiki4main16appearance__rail() {
    return _M0FP314vlmkit_2dsites4wiki4main1h("aside", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "rail appearance-rail"), _M0FP314vlmkit_2dsites4wiki4main1a("aria-labelledby", "app-rail-h")], [_M0FP314vlmkit_2dsites4wiki4main1h("div", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "rail-inner")], [_M0FP314vlmkit_2dsites4wiki4main1h("div", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "rail-head")], [_M0FP314vlmkit_2dsites4wiki4main1h("h2", [_M0FP314vlmkit_2dsites4wiki4main1a("id", "app-rail-h"), _M0FP314vlmkit_2dsites4wiki4main1a("class", "rail-title")], [_M0FP314vlmkit_2dsites4wiki4main2tx("Appearance")]), _M0FP314vlmkit_2dsites4wiki4main1h("button", [_M0FP314vlmkit_2dsites4wiki4main1a("type", "button"), _M0FP314vlmkit_2dsites4wiki4main1a("class", "btn btn-small"), _M0FP314vlmkit_2dsites4wiki4main1a("aria-label", "Hide appearance"), _M0FP314vlmkit_2dsites4wiki4main2on("click", (_e) => {
      _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4wiki4main18appearance__hidden, true);
      _M0FP314vlmkit_2dsites4wiki4main5store("appearance", "hidden");
      _M0FP314vlmkit_2dsites4wiki4main9focus__id("app-menu-btn");
    })], [_M0FP314vlmkit_2dsites4wiki4main2tx("hide")])]), _M0FP314vlmkit_2dsites4wiki4main17appearance__panel("rail")])]);
  }
  function _M0FP314vlmkit_2dsites4wiki4main6header() {
    const main_links = [_M0FP314vlmkit_2dsites4wiki4main6headerN5tupleS2442, _M0FP314vlmkit_2dsites4wiki4main6headerN5tupleS2443, _M0FP314vlmkit_2dsites4wiki4main6headerN5tupleS2444, _M0FP314vlmkit_2dsites4wiki4main6headerN5tupleS2445, _M0FP314vlmkit_2dsites4wiki4main6headerN5tupleS2446];
    const menu_items = [];
    const _bind$19 = main_links.length;
    let _tmp$8 = 0;
    while (true) {
      const _ = _tmp$8;
      if (_ < _bind$19) {
        const l = main_links[_];
        _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(menu_items, _M0FP314vlmkit_2dsites4wiki4main1h("li", [], [_M0FP314vlmkit_2dsites4wiki4main1h("a", [_M0FP314vlmkit_2dsites4wiki4main1a("href", l._1)], [_M0FP314vlmkit_2dsites4wiki4main2tx(l._0)])]));
        _tmp$8 = _ + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return _M0FP314vlmkit_2dsites4wiki4main1h("header", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "site-header")], [_M0FP314vlmkit_2dsites4wiki4main1h("div", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "header-start")], [_M0FP314vlmkit_2dsites4wiki4main1h("button", [_M0FP314vlmkit_2dsites4wiki4main1a("type", "button"), _M0FP314vlmkit_2dsites4wiki4main1a("id", "menu-btn"), _M0FP314vlmkit_2dsites4wiki4main1a("class", "icon-btn"), _M0FP314vlmkit_2dsites4wiki4main1a("aria-label", "Main menu"), _M0FP314vlmkit_2dsites4wiki4main1a("aria-controls", "main-menu"), _M0FP314vlmkit_2dsites4wiki4main2dy("aria-expanded", () => {
      const _p = _M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4wiki4main10menu__open);
      return _p ? "true" : "false";
    }), _M0FP314vlmkit_2dsites4wiki4main2on("click", (_e) => {
      _M0MP26mizchi7signals6Signal6updateGbE(_M0FP314vlmkit_2dsites4wiki4main10menu__open, (v) => !v);
    })], [_M0FP314vlmkit_2dsites4wiki4main10icon__menu()]), _M0FP314vlmkit_2dsites4wiki4main1h("a", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "brand"), _M0FP314vlmkit_2dsites4wiki4main1a("href", "#/wiki/Moon")], [_M0FP314vlmkit_2dsites4wiki4main4logo(), _M0FP314vlmkit_2dsites4wiki4main1h("span", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "brand-text")], [_M0FP314vlmkit_2dsites4wiki4main1h("span", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "wordmark")], [_M0FP314vlmkit_2dsites4wiki4main2tx("Lexipedia")]), _M0FP314vlmkit_2dsites4wiki4main1h("span", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "tagline")], [_M0FP314vlmkit_2dsites4wiki4main2tx("The free encyclopedia")])])]), _M0FP314vlmkit_2dsites4wiki4main1h("div", [_M0FP314vlmkit_2dsites4wiki4main1a("id", "main-menu"), _M0FP314vlmkit_2dsites4wiki4main2dy("class", () => {
      const _p = "main-menu";
      const _p$2 = "open";
      const _p$3 = _M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4wiki4main10menu__open);
      return _p$3 ? `${_p} ${_p$2}` : _p;
    }), _M0FP314vlmkit_2dsites4wiki4main2on("keydown", (e) => {
      if (_M0FP314vlmkit_2dsites4wiki4main7ev__key(e) === "Escape") {
        _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4wiki4main10menu__open, false);
        _M0FP314vlmkit_2dsites4wiki4main9focus__id("menu-btn");
        return;
      } else {
        return;
      }
    })], [_M0FP314vlmkit_2dsites4wiki4main1h("button", [_M0FP314vlmkit_2dsites4wiki4main1a("type", "button"), _M0FP314vlmkit_2dsites4wiki4main1a("class", "icon-btn menu-close"), _M0FP314vlmkit_2dsites4wiki4main1a("aria-label", "Close menu"), _M0FP314vlmkit_2dsites4wiki4main2on("click", (_e) => {
      _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4wiki4main10menu__open, false);
      _M0FP314vlmkit_2dsites4wiki4main9focus__id("menu-btn");
    })], [_M0FP314vlmkit_2dsites4wiki4main11icon__close()]), _M0FP314vlmkit_2dsites4wiki4main1h("nav", [_M0FP314vlmkit_2dsites4wiki4main1a("aria-label", "Main menu")], [_M0FP314vlmkit_2dsites4wiki4main1h("h2", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "menu-title")], [_M0FP314vlmkit_2dsites4wiki4main2tx("Main menu")]), _M0FP314vlmkit_2dsites4wiki4main1h("ul", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "menu-links")], menu_items)]), _M0FP36mizchi4luna3dom4show(() => _M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4wiki4main9is__phone), () => _M0FP314vlmkit_2dsites4wiki4main1h("div", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "menu-phone")], [_M0FP314vlmkit_2dsites4wiki4main1h("nav", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "menu-section"), _M0FP314vlmkit_2dsites4wiki4main1a("aria-labelledby", "menu-toc-h")], [_M0FP314vlmkit_2dsites4wiki4main1h("h2", [_M0FP314vlmkit_2dsites4wiki4main1a("id", "menu-toc-h"), _M0FP314vlmkit_2dsites4wiki4main1a("class", "menu-title")], [_M0FP314vlmkit_2dsites4wiki4main2tx("Contents")]), _M0FP314vlmkit_2dsites4wiki4main9toc__list("menu", () => {
      _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4wiki4main10menu__open, false);
    })]), _M0FP314vlmkit_2dsites4wiki4main1h("section", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "menu-section"), _M0FP314vlmkit_2dsites4wiki4main1a("aria-labelledby", "menu-app-h")], [_M0FP314vlmkit_2dsites4wiki4main1h("h2", [_M0FP314vlmkit_2dsites4wiki4main1a("id", "menu-app-h"), _M0FP314vlmkit_2dsites4wiki4main1a("class", "menu-title")], [_M0FP314vlmkit_2dsites4wiki4main2tx("Appearance")]), _M0FP314vlmkit_2dsites4wiki4main17appearance__panel("menu")])]))])]), _M0FP314vlmkit_2dsites4wiki4main11search__box(), _M0FP314vlmkit_2dsites4wiki4main1h("div", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "header-end")], [_M0FP314vlmkit_2dsites4wiki4main1h("button", [_M0FP314vlmkit_2dsites4wiki4main1a("type", "button"), _M0FP314vlmkit_2dsites4wiki4main1a("class", "icon-btn search-toggle"), _M0FP314vlmkit_2dsites4wiki4main1a("aria-label", "Search"), _M0FP314vlmkit_2dsites4wiki4main1a("aria-controls", "search-input"), _M0FP314vlmkit_2dsites4wiki4main2dy("aria-expanded", () => {
      const _p = _M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4wiki4main19phone__search__open);
      return _p ? "true" : "false";
    }), _M0FP314vlmkit_2dsites4wiki4main2on("click", (_e) => {
      _M0MP26mizchi7signals6Signal6updateGbE(_M0FP314vlmkit_2dsites4wiki4main19phone__search__open, (v) => !v);
      if (_M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4wiki4main19phone__search__open)) {
        _M0FP314vlmkit_2dsites4wiki4main12set__timeout(() => {
          _M0FP314vlmkit_2dsites4wiki4main9focus__id("search-input");
        }, 0);
        return;
      } else {
        return;
      }
    })], [_M0FP314vlmkit_2dsites4wiki4main12icon__search("")]), _M0FP314vlmkit_2dsites4wiki4main1h("nav", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "user-links"), _M0FP314vlmkit_2dsites4wiki4main1a("aria-label", "Personal tools")], [_M0FP314vlmkit_2dsites4wiki4main1h("a", [_M0FP314vlmkit_2dsites4wiki4main1a("href", "#/wiki/Donate")], [_M0FP314vlmkit_2dsites4wiki4main2tx("Donate")]), _M0FP314vlmkit_2dsites4wiki4main1h("a", [_M0FP314vlmkit_2dsites4wiki4main1a("href", "#/wiki/Create_account")], [_M0FP314vlmkit_2dsites4wiki4main2tx("Create account")]), _M0FP314vlmkit_2dsites4wiki4main1h("a", [_M0FP314vlmkit_2dsites4wiki4main1a("href", "#/wiki/Log_in")], [_M0FP314vlmkit_2dsites4wiki4main2tx("Log in")])])])]);
  }
  function _M0FP314vlmkit_2dsites4wiki4main9tab__link(label, href, current) {
    return _M0FP314vlmkit_2dsites4wiki4main1h("li", [_M0FP314vlmkit_2dsites4wiki4main2dy("class", () => {
      const _p = "tab";
      const _p$2 = "selected";
      const _p$3 = current();
      return _p$3 ? `${_p} ${_p$2}` : _p;
    })], [_M0FP314vlmkit_2dsites4wiki4main1h("a", [_M0FP314vlmkit_2dsites4wiki4main1a("href", href), _M0FP314vlmkit_2dsites4wiki4main2dy("aria-current", () => current() ? "page" : "false")], [_M0FP314vlmkit_2dsites4wiki4main2tx(label)])]);
  }
  function _M0FP314vlmkit_2dsites4wiki4main10title__barN11is__articleS2462() {
    const _bind$19 = _M0MP26mizchi7signals6Signal3getGRP314vlmkit_2dsites4wiki4main5RouteE(_M0FP314vlmkit_2dsites4wiki4main5route);
    if (_bind$19.$tag === 1) {
      return false;
    } else {
      return true;
    }
  }
  function _M0FP314vlmkit_2dsites4wiki4main10title__bar() {
    const _tmp$8 = [_M0FP314vlmkit_2dsites4wiki4main1a("class", "title-block")];
    const _tmp$9 = [_M0FP314vlmkit_2dsites4wiki4main1a("class", "title-row"), _M0FP314vlmkit_2dsites4wiki4main1a("id", "top")];
    const _tmp$10 = _M0FP314vlmkit_2dsites4wiki4main1h("div", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "toc-pop-wrap")], [_M0FP314vlmkit_2dsites4wiki4main1h("button", [_M0FP314vlmkit_2dsites4wiki4main1a("type", "button"), _M0FP314vlmkit_2dsites4wiki4main1a("id", "toc-pop-btn"), _M0FP314vlmkit_2dsites4wiki4main1a("class", "icon-btn toc-pop-btn"), _M0FP314vlmkit_2dsites4wiki4main1a("aria-label", "Contents"), _M0FP314vlmkit_2dsites4wiki4main1a("aria-controls", "toc-pop"), _M0FP314vlmkit_2dsites4wiki4main2dy("aria-expanded", () => {
      const _p = _M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4wiki4main14toc__pop__open);
      return _p ? "true" : "false";
    }), _M0FP314vlmkit_2dsites4wiki4main2on("click", (_e) => {
      _M0MP26mizchi7signals6Signal6updateGbE(_M0FP314vlmkit_2dsites4wiki4main14toc__pop__open, (v) => !v);
    })], [_M0FP314vlmkit_2dsites4wiki4main9icon__toc()]), _M0FP314vlmkit_2dsites4wiki4main1h("div", [_M0FP314vlmkit_2dsites4wiki4main1a("id", "toc-pop"), _M0FP314vlmkit_2dsites4wiki4main2dy("class", () => {
      const _p = "popover toc-pop";
      const _p$2 = "open";
      const _p$3 = _M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4wiki4main14toc__pop__open);
      return _p$3 ? `${_p} ${_p$2}` : _p;
    }), _M0FP314vlmkit_2dsites4wiki4main1a("role", "dialog"), _M0FP314vlmkit_2dsites4wiki4main1a("aria-labelledby", "toc-pop-h")], [_M0FP314vlmkit_2dsites4wiki4main1h("div", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "rail-head")], [_M0FP314vlmkit_2dsites4wiki4main1h("h2", [_M0FP314vlmkit_2dsites4wiki4main1a("id", "toc-pop-h"), _M0FP314vlmkit_2dsites4wiki4main1a("class", "rail-title")], [_M0FP314vlmkit_2dsites4wiki4main2tx("Contents")]), _M0FP314vlmkit_2dsites4wiki4main1h("button", [_M0FP314vlmkit_2dsites4wiki4main1a("type", "button"), _M0FP314vlmkit_2dsites4wiki4main1a("class", "btn btn-small toc-unhide"), _M0FP314vlmkit_2dsites4wiki4main1a("aria-label", "Move contents to the sidebar"), _M0FP314vlmkit_2dsites4wiki4main2on("click", (_e) => {
      _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4wiki4main11toc__hidden, false);
      _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4wiki4main14toc__pop__open, false);
      _M0FP314vlmkit_2dsites4wiki4main5store("toc", "shown");
    })], [_M0FP314vlmkit_2dsites4wiki4main2tx("move to sidebar")])]), _M0FP314vlmkit_2dsites4wiki4main9toc__list("pop", () => {
      _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4wiki4main14toc__pop__open, false);
    })])]);
    const _tmp$11 = _M0FP314vlmkit_2dsites4wiki4main1h("h1", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "page-title")], [_M0FP36mizchi4luna3dom9text__dyn(() => {
      const _bind$19 = _M0MP26mizchi7signals6Signal3getGRP314vlmkit_2dsites4wiki4main5RouteE(_M0FP314vlmkit_2dsites4wiki4main5route);
      switch (_bind$19.$tag) {
        case 1: {
          return "Talk:Moon";
        }
        case 2: {
          return "View source for Moon";
        }
        case 3: {
          return "Moon: Revision history";
        }
        default: {
          return "Moon";
        }
      }
    })]);
    const _tmp$12 = [_M0FP314vlmkit_2dsites4wiki4main1a("type", "button"), _M0FP314vlmkit_2dsites4wiki4main1a("class", "lang-btn"), _M0FP314vlmkit_2dsites4wiki4main1a("aria-haspopup", "dialog"), _M0FP314vlmkit_2dsites4wiki4main2dy("aria-expanded", () => {
      const _p = _M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4wiki4main10lang__open);
      return _p ? "true" : "false";
    }), _M0FP314vlmkit_2dsites4wiki4main2on("click", (_e) => {
      _M0MP26mizchi7signals6Signal3setGRP314vlmkit_2dsites4wiki4main5RouteE(_M0FP314vlmkit_2dsites4wiki4main11lang__query, "");
      const _bind$19 = _M0FP314vlmkit_2dsites4wiki4main11lang__input.val;
      if (_bind$19.$tag === 1) {
        const _Some = _bind$19;
        const _el = _Some._0;
        _M0FP314vlmkit_2dsites4wiki4main10set__value(_el, "");
      }
      const _bind$20 = _M0FP314vlmkit_2dsites4wiki4main12lang__dialog.val;
      if (_bind$20.$tag === 1) {
        const _Some = _bind$20;
        const _d = _Some._0;
        _M0FP314vlmkit_2dsites4wiki4main12dialog__open(_d);
        _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4wiki4main10lang__open, true);
        return;
      } else {
        return;
      }
    })];
    const _tmp$13 = _M0FP314vlmkit_2dsites4wiki4main10icon__lang();
    const _tmp$14 = [];
    const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(10);
    _M0MPB13StringBuilder13write__objectGiE(_string_builder, _M0FP314vlmkit_2dsites4wiki4main9languages.length);
    _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, " languages");
    return _M0FP314vlmkit_2dsites4wiki4main1h("div", _tmp$8, [_M0FP314vlmkit_2dsites4wiki4main1h("div", _tmp$9, [_tmp$10, _tmp$11, _M0FP314vlmkit_2dsites4wiki4main1h("button", _tmp$12, [_tmp$13, _M0FP314vlmkit_2dsites4wiki4main1h("span", _tmp$14, [_M0FP314vlmkit_2dsites4wiki4main2tx(_string_builder.val)]), _M0FP314vlmkit_2dsites4wiki4main10icon__down()])]), _M0FP314vlmkit_2dsites4wiki4main1h("div", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "tabs-row")], [_M0FP314vlmkit_2dsites4wiki4main1h("nav", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "tabs"), _M0FP314vlmkit_2dsites4wiki4main1a("aria-label", "Namespaces")], [_M0FP314vlmkit_2dsites4wiki4main1h("ul", [], [_M0FP314vlmkit_2dsites4wiki4main9tab__link("Article", "#/wiki/Moon", _M0FP314vlmkit_2dsites4wiki4main10title__barN11is__articleS2462), _M0FP314vlmkit_2dsites4wiki4main9tab__link("Talk", "#/talk", () => !_M0FP314vlmkit_2dsites4wiki4main10title__barN11is__articleS2462())])]), _M0FP314vlmkit_2dsites4wiki4main1h("nav", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "tabs tabs-views"), _M0FP314vlmkit_2dsites4wiki4main1a("aria-label", "Views")], [_M0FP314vlmkit_2dsites4wiki4main1h("ul", [], [_M0FP314vlmkit_2dsites4wiki4main9tab__link("Read", "#/wiki/Moon", () => {
      const _bind$19 = _M0MP26mizchi7signals6Signal3getGRP314vlmkit_2dsites4wiki4main5RouteE(_M0FP314vlmkit_2dsites4wiki4main5route);
      switch (_bind$19.$tag) {
        case 0: {
          return true;
        }
        case 1: {
          return true;
        }
        default: {
          return false;
        }
      }
    }), _M0FP314vlmkit_2dsites4wiki4main9tab__link("View source", "#/source", () => _M0IP314vlmkit_2dsites4wiki4main5RoutePB2Eq5equal(_M0MP26mizchi7signals6Signal3getGRP314vlmkit_2dsites4wiki4main5RouteE(_M0FP314vlmkit_2dsites4wiki4main5route), _M0DTP314vlmkit_2dsites4wiki4main5Route6Source__)), _M0FP314vlmkit_2dsites4wiki4main9tab__link("View history", "#/history", () => _M0IP314vlmkit_2dsites4wiki4main5RoutePB2Eq5equal(_M0MP26mizchi7signals6Signal3getGRP314vlmkit_2dsites4wiki4main5RouteE(_M0FP314vlmkit_2dsites4wiki4main5route), _M0DTP314vlmkit_2dsites4wiki4main5Route7History__))])]), _M0FP314vlmkit_2dsites4wiki4main1h("div", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "toolbar")], [_M0FP314vlmkit_2dsites4wiki4main1h("div", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "app-menu-wrap")], [_M0FP314vlmkit_2dsites4wiki4main1h("button", [_M0FP314vlmkit_2dsites4wiki4main1a("type", "button"), _M0FP314vlmkit_2dsites4wiki4main1a("id", "app-menu-btn"), _M0FP314vlmkit_2dsites4wiki4main1a("class", "icon-btn app-menu-btn"), _M0FP314vlmkit_2dsites4wiki4main1a("aria-label", "Appearance"), _M0FP314vlmkit_2dsites4wiki4main1a("aria-controls", "app-menu"), _M0FP314vlmkit_2dsites4wiki4main2dy("aria-expanded", () => {
      const _p = _M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4wiki4main15app__menu__open);
      return _p ? "true" : "false";
    }), _M0FP314vlmkit_2dsites4wiki4main2on("click", (_e) => {
      _M0MP26mizchi7signals6Signal6updateGbE(_M0FP314vlmkit_2dsites4wiki4main15app__menu__open, (v) => !v);
    })], [_M0FP314vlmkit_2dsites4wiki4main11icon__brush()]), _M0FP314vlmkit_2dsites4wiki4main1h("div", [_M0FP314vlmkit_2dsites4wiki4main1a("id", "app-menu"), _M0FP314vlmkit_2dsites4wiki4main2dy("class", () => {
      const _p = "popover app-menu";
      const _p$2 = "open";
      const _p$3 = _M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4wiki4main15app__menu__open);
      return _p$3 ? `${_p} ${_p$2}` : _p;
    }), _M0FP314vlmkit_2dsites4wiki4main1a("role", "dialog"), _M0FP314vlmkit_2dsites4wiki4main1a("aria-labelledby", "app-menu-h")], [_M0FP314vlmkit_2dsites4wiki4main1h("div", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "rail-head")], [_M0FP314vlmkit_2dsites4wiki4main1h("h2", [_M0FP314vlmkit_2dsites4wiki4main1a("id", "app-menu-h"), _M0FP314vlmkit_2dsites4wiki4main1a("class", "rail-title")], [_M0FP314vlmkit_2dsites4wiki4main2tx("Appearance")]), _M0FP314vlmkit_2dsites4wiki4main1h("button", [_M0FP314vlmkit_2dsites4wiki4main1a("type", "button"), _M0FP314vlmkit_2dsites4wiki4main1a("class", "btn btn-small app-unhide"), _M0FP314vlmkit_2dsites4wiki4main1a("aria-label", "Move appearance to the sidebar"), _M0FP314vlmkit_2dsites4wiki4main2on("click", (_e) => {
      _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4wiki4main18appearance__hidden, false);
      _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4wiki4main15app__menu__open, false);
      _M0FP314vlmkit_2dsites4wiki4main5store("appearance", "shown");
    })], [_M0FP314vlmkit_2dsites4wiki4main2tx("move to sidebar")])]), _M0FP314vlmkit_2dsites4wiki4main17appearance__panel("pop")])]), _M0FP314vlmkit_2dsites4wiki4main1h("button", [_M0FP314vlmkit_2dsites4wiki4main1a("type", "button"), _M0FP314vlmkit_2dsites4wiki4main2dy("class", () => {
      const _p = "icon-btn watch-btn";
      const _p$2 = "on";
      const _p$3 = _M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4wiki4main7watched);
      return _p$3 ? `${_p} ${_p$2}` : _p;
    }), _M0FP314vlmkit_2dsites4wiki4main2dy("aria-pressed", () => {
      const _p = _M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4wiki4main7watched);
      return _p ? "true" : "false";
    }), _M0FP314vlmkit_2dsites4wiki4main1a("aria-label", "Watch this page"), _M0FP314vlmkit_2dsites4wiki4main2on("click", (_e) => {
      _M0MP26mizchi7signals6Signal6updateGbE(_M0FP314vlmkit_2dsites4wiki4main7watched, (v) => !v);
      const _p = _M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4wiki4main7watched);
      _M0FP314vlmkit_2dsites4wiki4main5store("watch", _p ? "true" : "false");
      _M0FP314vlmkit_2dsites4wiki4main5toast(_M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4wiki4main7watched) ? "Added to your watchlist." : "Removed from your watchlist.");
    })], [_M0FP314vlmkit_2dsites4wiki4main10icon__star()])])]), _M0FP314vlmkit_2dsites4wiki4main1h("p", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "from-line")], [_M0FP314vlmkit_2dsites4wiki4main2tx("From Lexipedia, the free encyclopedia")])]);
  }
  function _M0FP314vlmkit_2dsites4wiki4main9moon__art(idp, label, cls) {
    const gid = `${idp}-moon-shade`;
    return _M0FP314vlmkit_2dsites4wiki4main9svg__root("0 0 200 200", label, cls, [_M0FP314vlmkit_2dsites4wiki4main2sv("defs", [], [_M0FP314vlmkit_2dsites4wiki4main2sv("radialGradient", [_M0FP314vlmkit_2dsites4wiki4main1a("id", gid), _M0FP314vlmkit_2dsites4wiki4main1a("cx", "42%"), _M0FP314vlmkit_2dsites4wiki4main1a("cy", "38%"), _M0FP314vlmkit_2dsites4wiki4main1a("r", "65%")], [_M0FP314vlmkit_2dsites4wiki4main2sv("stop", [_M0FP314vlmkit_2dsites4wiki4main1a("offset", "0%"), _M0FP314vlmkit_2dsites4wiki4main1a("stop-color", "#f1efe9")], []), _M0FP314vlmkit_2dsites4wiki4main2sv("stop", [_M0FP314vlmkit_2dsites4wiki4main1a("offset", "70%"), _M0FP314vlmkit_2dsites4wiki4main1a("stop-color", "#c9c5bb")], []), _M0FP314vlmkit_2dsites4wiki4main2sv("stop", [_M0FP314vlmkit_2dsites4wiki4main1a("offset", "100%"), _M0FP314vlmkit_2dsites4wiki4main1a("stop-color", "#8f8a80")], [])])]), _M0FP314vlmkit_2dsites4wiki4main2sv("rect", [_M0FP314vlmkit_2dsites4wiki4main1a("width", "200"), _M0FP314vlmkit_2dsites4wiki4main1a("height", "200"), _M0FP314vlmkit_2dsites4wiki4main1a("fill", "#0b0d12")], []), _M0FP314vlmkit_2dsites4wiki4main6circle("100", "100", "86", `url(#${gid})`), _M0FP314vlmkit_2dsites4wiki4main2sv("g", [_M0FP314vlmkit_2dsites4wiki4main1a("fill", "#6f6a61"), _M0FP314vlmkit_2dsites4wiki4main1a("opacity", "0.5")], [_M0FP314vlmkit_2dsites4wiki4main4path("M48,66 C52,50 74,44 88,52 C98,58 92,72 80,76 C70,80 64,92 54,90 C44,88 44,76 48,66 Z", ""), _M0FP314vlmkit_2dsites4wiki4main4path("M92,46 C104,38 124,42 128,54 C131,64 120,70 110,68 C100,66 90,58 92,46 Z", ""), _M0FP314vlmkit_2dsites4wiki4main4path("M114,72 C126,68 142,76 140,92 C138,106 126,112 118,104 C110,96 104,78 114,72 Z", ""), _M0FP314vlmkit_2dsites4wiki4main4path("M78,90 C88,86 102,90 102,100 C102,110 88,112 80,106 C74,102 72,94 78,90 Z", ""), _M0FP314vlmkit_2dsites4wiki4main4path("M50,98 C56,96 62,104 60,114 C58,122 50,124 46,116 C43,108 45,100 50,98 Z", "")]), _M0FP314vlmkit_2dsites4wiki4main2sv("g", [_M0FP314vlmkit_2dsites4wiki4main1a("fill", "#5f5a52"), _M0FP314vlmkit_2dsites4wiki4main1a("opacity", "0.35")], [_M0FP314vlmkit_2dsites4wiki4main7ellipse("70", "66", "12", "8", ""), _M0FP314vlmkit_2dsites4wiki4main7ellipse("112", "54", "9", "6", ""), _M0FP314vlmkit_2dsites4wiki4main7ellipse("126", "90", "8", "10", "")]), _M0FP314vlmkit_2dsites4wiki4main6circle("118", "148", "6", "#efece5"), _M0FP314vlmkit_2dsites4wiki4main2sv("g", [_M0FP314vlmkit_2dsites4wiki4main1a("stroke", "#ece9e2"), _M0FP314vlmkit_2dsites4wiki4main1a("stroke-width", "1"), _M0FP314vlmkit_2dsites4wiki4main1a("opacity", "0.55")], [_M0FP314vlmkit_2dsites4wiki4main2sv("line", [_M0FP314vlmkit_2dsites4wiki4main1a("x1", "118"), _M0FP314vlmkit_2dsites4wiki4main1a("y1", "148"), _M0FP314vlmkit_2dsites4wiki4main1a("x2", "92"), _M0FP314vlmkit_2dsites4wiki4main1a("y2", "124")], []), _M0FP314vlmkit_2dsites4wiki4main2sv("line", [_M0FP314vlmkit_2dsites4wiki4main1a("x1", "118"), _M0FP314vlmkit_2dsites4wiki4main1a("y1", "148"), _M0FP314vlmkit_2dsites4wiki4main1a("x2", "150"), _M0FP314vlmkit_2dsites4wiki4main1a("y2", "130")], []), _M0FP314vlmkit_2dsites4wiki4main2sv("line", [_M0FP314vlmkit_2dsites4wiki4main1a("x1", "118"), _M0FP314vlmkit_2dsites4wiki4main1a("y1", "148"), _M0FP314vlmkit_2dsites4wiki4main1a("x2", "106"), _M0FP314vlmkit_2dsites4wiki4main1a("y2", "176")], []), _M0FP314vlmkit_2dsites4wiki4main2sv("line", [_M0FP314vlmkit_2dsites4wiki4main1a("x1", "118"), _M0FP314vlmkit_2dsites4wiki4main1a("y1", "148"), _M0FP314vlmkit_2dsites4wiki4main1a("x2", "144"), _M0FP314vlmkit_2dsites4wiki4main1a("y2", "168")], [])]), _M0FP314vlmkit_2dsites4wiki4main6circle("80", "150", "5", "#b3aea4"), _M0FP314vlmkit_2dsites4wiki4main6circle("150", "112", "4", "#b3aea4"), _M0FP314vlmkit_2dsites4wiki4main6circle("66", "132", "3", "#b8b3a9"), _M0FP314vlmkit_2dsites4wiki4main6circle("100", "128", "3", "#b8b3a9")]);
  }
  function _M0FP314vlmkit_2dsites4wiki4main13infobox__view() {
    const rows = [];
    const _bind$19 = _M0FP314vlmkit_2dsites4wiki4main7infobox.length;
    let _tmp$8 = 0;
    while (true) {
      const _ = _tmp$8;
      if (_ < _bind$19) {
        const sec = _M0FP314vlmkit_2dsites4wiki4main7infobox[_];
        _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(rows, _M0FP314vlmkit_2dsites4wiki4main1h("tr", [], [_M0FP314vlmkit_2dsites4wiki4main1h("th", [_M0FP314vlmkit_2dsites4wiki4main1a("colspan", "2"), _M0FP314vlmkit_2dsites4wiki4main1a("scope", "colgroup"), _M0FP314vlmkit_2dsites4wiki4main1a("class", "ib-head")], [_M0FP314vlmkit_2dsites4wiki4main2tx(sec.head)])]));
        const _bind$20 = sec.rows;
        const _bind$21 = _bind$20.length;
        let _tmp$9 = 0;
        while (true) {
          const _$2 = _tmp$9;
          if (_$2 < _bind$21) {
            const r = _bind$20[_$2];
            _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(rows, _M0FP314vlmkit_2dsites4wiki4main1h("tr", [], [_M0FP314vlmkit_2dsites4wiki4main1h("th", [_M0FP314vlmkit_2dsites4wiki4main1a("scope", "row")], [_M0FP314vlmkit_2dsites4wiki4main2tx(r.label)]), _M0FP314vlmkit_2dsites4wiki4main1h("td", [], [_M0FP314vlmkit_2dsites4wiki4main2tx(r.value)])]));
            _tmp$9 = _$2 + 1 | 0;
            continue;
          } else {
            break;
          }
        }
        _tmp$8 = _ + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return _M0FP314vlmkit_2dsites4wiki4main1h("aside", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "infobox"), _M0FP314vlmkit_2dsites4wiki4main1a("aria-labelledby", "ib-title")], [_M0FP314vlmkit_2dsites4wiki4main1h("div", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "ib-title"), _M0FP314vlmkit_2dsites4wiki4main1a("id", "ib-title")], [_M0FP314vlmkit_2dsites4wiki4main2tx("Moon")]), _M0FP314vlmkit_2dsites4wiki4main1h("div", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "ib-image")], [_M0FP314vlmkit_2dsites4wiki4main9moon__art("ib", _M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(_M0FP314vlmkit_2dsites4wiki4main7figures, 2).alt, "ib-art")]), _M0FP314vlmkit_2dsites4wiki4main1h("p", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "ib-caption")], [_M0FP314vlmkit_2dsites4wiki4main2tx(_M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(_M0FP314vlmkit_2dsites4wiki4main7figures, 2).caption)]), _M0FP314vlmkit_2dsites4wiki4main1h("table", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "ib-table")], [_M0FP314vlmkit_2dsites4wiki4main1h("tbody", [], rows)])]);
  }
  function _M0FP314vlmkit_2dsites4wiki4main14earthrise__art(idp, label, cls) {
    const gid = `${idp}-earth`;
    const sid = `${idp}-ground`;
    return _M0FP314vlmkit_2dsites4wiki4main9svg__root("0 0 320 220", label, cls, [_M0FP314vlmkit_2dsites4wiki4main2sv("defs", [], [_M0FP314vlmkit_2dsites4wiki4main2sv("linearGradient", [_M0FP314vlmkit_2dsites4wiki4main1a("id", gid), _M0FP314vlmkit_2dsites4wiki4main1a("x1", "0"), _M0FP314vlmkit_2dsites4wiki4main1a("y1", "0"), _M0FP314vlmkit_2dsites4wiki4main1a("x2", "1"), _M0FP314vlmkit_2dsites4wiki4main1a("y2", "0")], [_M0FP314vlmkit_2dsites4wiki4main2sv("stop", [_M0FP314vlmkit_2dsites4wiki4main1a("offset", "0%"), _M0FP314vlmkit_2dsites4wiki4main1a("stop-color", "#2f6fb5")], []), _M0FP314vlmkit_2dsites4wiki4main2sv("stop", [_M0FP314vlmkit_2dsites4wiki4main1a("offset", "100%"), _M0FP314vlmkit_2dsites4wiki4main1a("stop-color", "#79b3e8")], [])]), _M0FP314vlmkit_2dsites4wiki4main2sv("linearGradient", [_M0FP314vlmkit_2dsites4wiki4main1a("id", sid), _M0FP314vlmkit_2dsites4wiki4main1a("x1", "0"), _M0FP314vlmkit_2dsites4wiki4main1a("y1", "0"), _M0FP314vlmkit_2dsites4wiki4main1a("x2", "0"), _M0FP314vlmkit_2dsites4wiki4main1a("y2", "1")], [_M0FP314vlmkit_2dsites4wiki4main2sv("stop", [_M0FP314vlmkit_2dsites4wiki4main1a("offset", "0%"), _M0FP314vlmkit_2dsites4wiki4main1a("stop-color", "#a29d93")], []), _M0FP314vlmkit_2dsites4wiki4main2sv("stop", [_M0FP314vlmkit_2dsites4wiki4main1a("offset", "100%"), _M0FP314vlmkit_2dsites4wiki4main1a("stop-color", "#5e5a53")], [])])]), _M0FP314vlmkit_2dsites4wiki4main2sv("rect", [_M0FP314vlmkit_2dsites4wiki4main1a("width", "320"), _M0FP314vlmkit_2dsites4wiki4main1a("height", "220"), _M0FP314vlmkit_2dsites4wiki4main1a("fill", "#05070b")], []), _M0FP314vlmkit_2dsites4wiki4main6circle("40", "30", "1.2", "#cfd6e6"), _M0FP314vlmkit_2dsites4wiki4main6circle("270", "24", "1", "#cfd6e6"), _M0FP314vlmkit_2dsites4wiki4main6circle("230", "60", "0.8", "#cfd6e6"), _M0FP314vlmkit_2dsites4wiki4main6circle("70", "90", "0.8", "#cfd6e6"), _M0FP314vlmkit_2dsites4wiki4main6circle("290", "110", "1.1", "#cfd6e6"), _M0FP314vlmkit_2dsites4wiki4main6circle("20", "130", "0.9", "#cfd6e6"), _M0FP314vlmkit_2dsites4wiki4main6circle("160", "86", "40", "#10213a"), _M0FP314vlmkit_2dsites4wiki4main4path("M160,46 A40,40 0 0 1 160,126 A14,40 0 0 1 160,46 Z", `url(#${gid})`), _M0FP314vlmkit_2dsites4wiki4main7ellipse("176", "72", "10", "5", "#f4f7fb"), _M0FP314vlmkit_2dsites4wiki4main7ellipse("184", "98", "8", "4", "#f4f7fb"), _M0FP314vlmkit_2dsites4wiki4main7ellipse("168", "88", "6", "8", "#6f9a56"), _M0FP314vlmkit_2dsites4wiki4main4path("M0,170 Q160,140 320,168 L320,220 L0,220 Z", `url(#${sid})`), _M0FP314vlmkit_2dsites4wiki4main7ellipse("70", "186", "22", "5", "#77736b"), _M0FP314vlmkit_2dsites4wiki4main7ellipse("220", "196", "30", "6", "#6e6a63"), _M0FP314vlmkit_2dsites4wiki4main7ellipse("140", "176", "12", "3", "#8a857c")]);
  }
  function _M0FP314vlmkit_2dsites4wiki4main11phase__disc(cx, k) {
    const x = _M0MPC13int3Int18to__string_2einner(cx, 10);
    const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(1);
    _M0MPB13StringBuilder13write__objectGiE(_string_builder, cx);
    _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, ",");
    _M0MPB13StringBuilder13write__objectGiE(_string_builder, 18);
    const top = _string_builder.val;
    const _string_builder$2 = _M0MPB13StringBuilder21StringBuilder_2einner(1);
    _M0MPB13StringBuilder13write__objectGiE(_string_builder$2, cx);
    _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$2, ",");
    _M0MPB13StringBuilder13write__objectGiE(_string_builder$2, 62);
    const bottom = _string_builder$2.val;
    const dark = _M0FP314vlmkit_2dsites4wiki4main6circle(x, "40", _M0MPC13int3Int18to__string_2einner(22, 10), "#2a2d35");
    const rim = _M0FP314vlmkit_2dsites4wiki4main2sv("circle", [_M0FP314vlmkit_2dsites4wiki4main1a("cx", x), _M0FP314vlmkit_2dsites4wiki4main1a("cy", "40"), _M0FP314vlmkit_2dsites4wiki4main1a("r", _M0MPC13int3Int18to__string_2einner(22, 10)), _M0FP314vlmkit_2dsites4wiki4main1a("fill", "none"), _M0FP314vlmkit_2dsites4wiki4main1a("stroke", "#5d6270"), _M0FP314vlmkit_2dsites4wiki4main1a("stroke-width", "1")], []);
    if (k === 0) {
      return _M0FP314vlmkit_2dsites4wiki4main2sv("g", [], [dark, rim]);
    }
    if (k === 4) {
      return _M0FP314vlmkit_2dsites4wiki4main2sv("g", [], [_M0FP314vlmkit_2dsites4wiki4main6circle(x, "40", _M0MPC13int3Int18to__string_2einner(22, 10), "#e8e4da"), rim]);
    }
    const tx = k === 2 || k === 6 ? 0 : 16;
    const waxing = k < 4;
    const crescent = k === 1 || k === 7;
    const outer_sweep = waxing ? 1 : 0;
    const term_sweep = waxing ? (crescent ? 0 : 1) : crescent ? 1 : 0;
    const _string_builder$3 = _M0MPB13StringBuilder21StringBuilder_2einner(21);
    _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$3, "M");
    _M0MPB13StringBuilder13write__objectGsE(_string_builder$3, top);
    _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$3, " A");
    _M0MPB13StringBuilder13write__objectGiE(_string_builder$3, 22);
    _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$3, ",");
    _M0MPB13StringBuilder13write__objectGiE(_string_builder$3, 22);
    _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$3, " 0 0 ");
    _M0MPB13StringBuilder13write__objectGiE(_string_builder$3, outer_sweep);
    _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$3, " ");
    _M0MPB13StringBuilder13write__objectGsE(_string_builder$3, bottom);
    _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$3, " A");
    _M0MPB13StringBuilder13write__objectGiE(_string_builder$3, tx);
    _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$3, ",");
    _M0MPB13StringBuilder13write__objectGiE(_string_builder$3, 22);
    _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$3, " 0 0 ");
    _M0MPB13StringBuilder13write__objectGiE(_string_builder$3, term_sweep);
    _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$3, " ");
    _M0MPB13StringBuilder13write__objectGsE(_string_builder$3, top);
    _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$3, " Z");
    const d = _string_builder$3.val;
    return _M0FP314vlmkit_2dsites4wiki4main2sv("g", [], [dark, _M0FP314vlmkit_2dsites4wiki4main4path(d, "#e8e4da"), rim]);
  }
  function _M0FP314vlmkit_2dsites4wiki4main11phases__art(label, cls) {
    const discs = [_M0FP314vlmkit_2dsites4wiki4main2sv("rect", [_M0FP314vlmkit_2dsites4wiki4main1a("width", "440"), _M0FP314vlmkit_2dsites4wiki4main1a("height", "80"), _M0FP314vlmkit_2dsites4wiki4main1a("fill", "#0b0d12")], [])];
    let _tmp$8 = 0;
    while (true) {
      const k = _tmp$8;
      if (k < 8) {
        _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(discs, _M0FP314vlmkit_2dsites4wiki4main11phase__disc(30 + (Math.imul(k, 54) | 0) | 0, k));
        _tmp$8 = k + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return _M0FP314vlmkit_2dsites4wiki4main9svg__root("0 0 440 80", label, cls, discs);
  }
  function _M0FP314vlmkit_2dsites4wiki4main11figure__art(i, idp, cls) {
    const f = _M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(_M0FP314vlmkit_2dsites4wiki4main7figures, i);
    const _bind$19 = f.kind;
    switch (_bind$19) {
      case "phases": {
        return _M0FP314vlmkit_2dsites4wiki4main11phases__art(f.alt, cls);
      }
      case "earthrise": {
        return _M0FP314vlmkit_2dsites4wiki4main14earthrise__art(idp, f.alt, cls);
      }
      default: {
        return _M0FP314vlmkit_2dsites4wiki4main9moon__art(idp, f.alt, cls);
      }
    }
  }
  function _M0FP314vlmkit_2dsites4wiki4main11open__media(i) {
    _M0FP314vlmkit_2dsites4wiki4main9hide__now();
    _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4wiki4main12media__index, i);
    const _bind$19 = _M0FP314vlmkit_2dsites4wiki4main13media__dialog.val;
    if (_bind$19.$tag === 1) {
      const _Some = _bind$19;
      const _d = _Some._0;
      _M0FP314vlmkit_2dsites4wiki4main12dialog__open(_d);
      _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4wiki4main11media__open, true);
      return;
    } else {
      return;
    }
  }
  function _M0FP314vlmkit_2dsites4wiki4main13thumb__figure(i, side) {
    const _tmp$8 = [_M0FP314vlmkit_2dsites4wiki4main1a("class", `thumb ${side}`)];
    const _tmp$9 = [_M0FP314vlmkit_2dsites4wiki4main1a("type", "button"), _M0FP314vlmkit_2dsites4wiki4main1a("class", "thumb-btn"), _M0FP314vlmkit_2dsites4wiki4main1a("aria-haspopup", "dialog"), _M0FP314vlmkit_2dsites4wiki4main2dy("aria-expanded", () => {
      const _p = _M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4wiki4main11media__open) && _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4wiki4main12media__index) === i;
      return _p ? "true" : "false";
    }), _M0FP314vlmkit_2dsites4wiki4main1a("aria-label", `Open image: ${_M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(_M0FP314vlmkit_2dsites4wiki4main7figures, i).caption}`), _M0FP314vlmkit_2dsites4wiki4main2on("click", (_e) => {
      _M0FP314vlmkit_2dsites4wiki4main11open__media(i);
    })];
    const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(3);
    _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, "fig");
    _M0MPB13StringBuilder13write__objectGiE(_string_builder, i);
    return _M0FP314vlmkit_2dsites4wiki4main1h("figure", _tmp$8, [_M0FP314vlmkit_2dsites4wiki4main1h("button", _tmp$9, [_M0FP314vlmkit_2dsites4wiki4main11figure__art(i, _string_builder.val, `fig-art fig-${_M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(_M0FP314vlmkit_2dsites4wiki4main7figures, i).kind}`)]), _M0FP314vlmkit_2dsites4wiki4main1h("figcaption", [], [_M0FP314vlmkit_2dsites4wiki4main2tx(_M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(_M0FP314vlmkit_2dsites4wiki4main7figures, i).caption)])]);
  }
  function _M0FP314vlmkit_2dsites4wiki4main14section__shell(idx, id, title, body) {
    const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(9);
    _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, "sec-body-");
    _M0MPB13StringBuilder13write__objectGiE(_string_builder, idx);
    const body_id = _string_builder.val;
    return _M0FP314vlmkit_2dsites4wiki4main1h("section", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "sec"), _M0FP314vlmkit_2dsites4wiki4main1a("aria-labelledby", id)], [_M0FP36mizchi4luna3dom4show(() => _M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4wiki4main9is__phone), () => _M0FP314vlmkit_2dsites4wiki4main1h("h2", [_M0FP314vlmkit_2dsites4wiki4main1a("id", id), _M0FP314vlmkit_2dsites4wiki4main1a("class", "sec-h acc-h")], [_M0FP314vlmkit_2dsites4wiki4main1h("button", [_M0FP314vlmkit_2dsites4wiki4main1a("type", "button"), _M0FP314vlmkit_2dsites4wiki4main1a("class", "acc-btn"), _M0FP314vlmkit_2dsites4wiki4main1a("aria-controls", body_id), _M0FP314vlmkit_2dsites4wiki4main2dy("aria-expanded", () => {
      const _p = _M0MP26mizchi7signals6Signal3getGbE(_M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(_M0FP314vlmkit_2dsites4wiki4main9acc__open, idx));
      return _p ? "true" : "false";
    }), _M0FP314vlmkit_2dsites4wiki4main2on("click", (_e) => {
      _M0MP26mizchi7signals6Signal6updateGbE(_M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(_M0FP314vlmkit_2dsites4wiki4main9acc__open, idx), (v) => !v);
    })], [_M0FP314vlmkit_2dsites4wiki4main13icon__chevron("acc-chev"), _M0FP314vlmkit_2dsites4wiki4main1h("span", [], [_M0FP314vlmkit_2dsites4wiki4main2tx(title)])])])), _M0FP36mizchi4luna3dom4show(() => !_M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4wiki4main9is__phone), () => _M0FP314vlmkit_2dsites4wiki4main1h("h2", [_M0FP314vlmkit_2dsites4wiki4main1a("id", id), _M0FP314vlmkit_2dsites4wiki4main1a("class", "sec-h")], [_M0FP314vlmkit_2dsites4wiki4main2tx(title)])), _M0FP314vlmkit_2dsites4wiki4main1h("div", [_M0FP314vlmkit_2dsites4wiki4main1a("id", body_id), _M0FP314vlmkit_2dsites4wiki4main2dy("class", () => {
      const _p = "sec-body";
      const _p$2 = "collapsed";
      const _p$3 = _M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4wiki4main9is__phone) && !_M0MP26mizchi7signals6Signal3getGbE(_M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(_M0FP314vlmkit_2dsites4wiki4main9acc__open, idx));
      return _p$3 ? `${_p} ${_p$2}` : _p;
    })], body)]);
  }
  function _M0FP314vlmkit_2dsites4wiki4main16article__section(i) {
    const s = _M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(_M0FP314vlmkit_2dsites4wiki4main8sections, i);
    const body = [];
    if (s.fig >= 0) {
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(body, _M0FP314vlmkit_2dsites4wiki4main13thumb__figure(s.fig, s.fig === 0 ? "tright" : "tleft"));
    }
    const _bind$19 = s.paras;
    const _bind$20 = _bind$19.length;
    let _tmp$8 = 0;
    while (true) {
      const _ = _tmp$8;
      if (_ < _bind$20) {
        const p = _bind$19[_];
        _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(body, _M0FP314vlmkit_2dsites4wiki4main4para(p));
        _tmp$8 = _ + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    const _bind$21 = s.subs;
    const _bind$22 = _bind$21.length;
    let _tmp$9 = 0;
    while (true) {
      const _ = _tmp$9;
      if (_ < _bind$22) {
        const sub = _bind$21[_];
        _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(body, _M0FP314vlmkit_2dsites4wiki4main1h("h3", [_M0FP314vlmkit_2dsites4wiki4main1a("id", sub.id)], [_M0FP314vlmkit_2dsites4wiki4main2tx(sub.title)]));
        const _bind$23 = sub.paras;
        const _bind$24 = _bind$23.length;
        let _tmp$10 = 0;
        while (true) {
          const _$2 = _tmp$10;
          if (_$2 < _bind$24) {
            const p = _bind$23[_$2];
            _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(body, _M0FP314vlmkit_2dsites4wiki4main4para(p));
            _tmp$10 = _$2 + 1 | 0;
            continue;
          } else {
            break;
          }
        }
        _tmp$9 = _ + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return _M0FP314vlmkit_2dsites4wiki4main14section__shell(i, s.id, s.title, body);
  }
  function _M0FP314vlmkit_2dsites4wiki4main12back__matter() {
    const n = _M0FP314vlmkit_2dsites4wiki4main8sections.length;
    const see = [];
    const _bind$19 = _M0FP314vlmkit_2dsites4wiki4main9see__also.length;
    let _tmp$8 = 0;
    while (true) {
      const _ = _tmp$8;
      if (_ < _bind$19) {
        const t = _M0FP314vlmkit_2dsites4wiki4main9see__also[_];
        _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(see, _M0FP314vlmkit_2dsites4wiki4main1h("li", [], [_M0FP314vlmkit_2dsites4wiki4main10wiki__link(t, t)]));
        _tmp$8 = _ + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    const refs = [];
    const _bind$20 = _M0FP314vlmkit_2dsites4wiki4main10references.length;
    let _tmp$9 = 0;
    while (true) {
      const i = _tmp$9;
      if (i < _bind$20) {
        const r = _M0FP314vlmkit_2dsites4wiki4main10references[i];
        const num = i + 1 | 0;
        const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(10);
        _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, "#cite_ref-");
        _M0MPB13StringBuilder13write__objectGiE(_string_builder, num);
        const _tmp$10 = _M0FP314vlmkit_2dsites4wiki4main1a("href", _string_builder.val);
        const _tmp$11 = _M0FP314vlmkit_2dsites4wiki4main1a("class", "backlink");
        const _string_builder$2 = _M0MPB13StringBuilder21StringBuilder_2einner(29);
        _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$2, "Back to citation ");
        _M0MPB13StringBuilder13write__objectGiE(_string_builder$2, num);
        _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$2, " in the text");
        const kids = [_M0FP314vlmkit_2dsites4wiki4main1h("a", [_tmp$10, _tmp$11, _M0FP314vlmkit_2dsites4wiki4main1a("aria-label", _string_builder$2.val)], [_M0FP314vlmkit_2dsites4wiki4main2tx("^")]), _M0FP314vlmkit_2dsites4wiki4main2tx(" ")];
        const _bind$21 = _M0FP314vlmkit_2dsites4wiki4main13inline__nodes(r.text);
        const _bind$22 = _bind$21.length;
        let _tmp$12 = 0;
        while (true) {
          const _ = _tmp$12;
          if (_ < _bind$22) {
            const x = _bind$21[_];
            _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(kids, x);
            _tmp$12 = _ + 1 | 0;
            continue;
          } else {
            break;
          }
        }
        const _string_builder$3 = _M0MPB13StringBuilder21StringBuilder_2einner(10);
        _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$3, "cite_note-");
        _M0MPB13StringBuilder13write__objectGiE(_string_builder$3, num);
        _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(refs, _M0FP314vlmkit_2dsites4wiki4main1h("li", [_M0FP314vlmkit_2dsites4wiki4main1a("id", _string_builder$3.val)], kids));
        _tmp$9 = i + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    const ext = [];
    const _bind$21 = _M0FP314vlmkit_2dsites4wiki4main15external__links.length;
    let _tmp$10 = 0;
    while (true) {
      const _ = _tmp$10;
      if (_ < _bind$21) {
        const t = _M0FP314vlmkit_2dsites4wiki4main15external__links[_];
        _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(ext, _M0FP314vlmkit_2dsites4wiki4main1h("li", [], [_M0FP314vlmkit_2dsites4wiki4main2tx(t)]));
        _tmp$10 = _ + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return [_M0FP314vlmkit_2dsites4wiki4main14section__shell(n, _M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(_M0FP314vlmkit_2dsites4wiki4main9back__ids, 0), _M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(_M0FP314vlmkit_2dsites4wiki4main12back__titles, 0), [_M0FP314vlmkit_2dsites4wiki4main1h("ul", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "see-also")], see)]), _M0FP314vlmkit_2dsites4wiki4main14section__shell(n + 1 | 0, _M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(_M0FP314vlmkit_2dsites4wiki4main9back__ids, 1), _M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(_M0FP314vlmkit_2dsites4wiki4main12back__titles, 1), [_M0FP314vlmkit_2dsites4wiki4main1h("ol", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "references")], refs)]), _M0FP314vlmkit_2dsites4wiki4main14section__shell(n + 2 | 0, _M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(_M0FP314vlmkit_2dsites4wiki4main9back__ids, 2), _M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(_M0FP314vlmkit_2dsites4wiki4main12back__titles, 2), [_M0FP314vlmkit_2dsites4wiki4main1h("ul", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "external")], ext), _M0FP314vlmkit_2dsites4wiki4main1h("p", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "note")], [_M0FP314vlmkit_2dsites4wiki4main2tx("External links are listed as text only in this demo.")])])];
  }
  function _M0FP314vlmkit_2dsites4wiki4main13article__view() {
    _M0MPB3Map5clearGiiE(_M0FP314vlmkit_2dsites4wiki4main11cite__count);
    const kids = [_M0FP314vlmkit_2dsites4wiki4main1h("div", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "hatnote"), _M0FP314vlmkit_2dsites4wiki4main1a("role", "note")], [_M0FP314vlmkit_2dsites4wiki4main1h("i", [], _M0FP314vlmkit_2dsites4wiki4main13inline__nodes(_M0FP314vlmkit_2dsites4wiki4main7hatnote))]), _M0FP314vlmkit_2dsites4wiki4main4para(_M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(_M0FP314vlmkit_2dsites4wiki4main4lead, 0)), _M0FP314vlmkit_2dsites4wiki4main13infobox__view()];
    let _tmp$8 = 1;
    while (true) {
      const i = _tmp$8;
      if (i < _M0FP314vlmkit_2dsites4wiki4main4lead.length) {
        _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(kids, _M0FP314vlmkit_2dsites4wiki4main4para(_M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(_M0FP314vlmkit_2dsites4wiki4main4lead, i)));
        _tmp$8 = i + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    let _tmp$9 = 0;
    while (true) {
      const i = _tmp$9;
      if (i < _M0FP314vlmkit_2dsites4wiki4main8sections.length) {
        _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(kids, _M0FP314vlmkit_2dsites4wiki4main16article__section(i));
        _tmp$9 = i + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    const _bind$19 = _M0FP314vlmkit_2dsites4wiki4main12back__matter();
    const _bind$20 = _bind$19.length;
    let _tmp$10 = 0;
    while (true) {
      const _ = _tmp$10;
      if (_ < _bind$20) {
        const x = _bind$19[_];
        _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(kids, x);
        _tmp$10 = _ + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return _M0FP314vlmkit_2dsites4wiki4main1h("div", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "article-body")], kids);
  }
  function _M0FP314vlmkit_2dsites4wiki4main10talk__view() {
    const kids = [_M0FP314vlmkit_2dsites4wiki4main1h("div", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "notice")], [_M0FP314vlmkit_2dsites4wiki4main2tx("This is the talk page for discussing improvements to the article "), _M0FP314vlmkit_2dsites4wiki4main10wiki__link("Moon", "Moon"), _M0FP314vlmkit_2dsites4wiki4main2tx(". It is a stub of a talk page in this demo.")])];
    const _bind$19 = _M0FP314vlmkit_2dsites4wiki4main4talk.length;
    let _tmp$8 = 0;
    while (true) {
      const _ = _tmp$8;
      if (_ < _bind$19) {
        const t = _M0FP314vlmkit_2dsites4wiki4main4talk[_];
        _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(kids, _M0FP314vlmkit_2dsites4wiki4main1h("h2", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "sec-h")], [_M0FP314vlmkit_2dsites4wiki4main2tx(t.topic)]));
        const _bind$20 = t.posts;
        const _bind$21 = _bind$20.length;
        let _tmp$9 = 0;
        while (true) {
          const _$2 = _tmp$9;
          if (_$2 < _bind$21) {
            const p = _bind$20[_$2];
            _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(kids, _M0FP314vlmkit_2dsites4wiki4main1h("div", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "post")], [_M0FP314vlmkit_2dsites4wiki4main1h("p", [], [_M0FP314vlmkit_2dsites4wiki4main2tx(p._1)]), _M0FP314vlmkit_2dsites4wiki4main1h("p", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "post-sig")], [_M0FP314vlmkit_2dsites4wiki4main2tx(`— ${p._0}`)])]));
            _tmp$9 = _$2 + 1 | 0;
            continue;
          } else {
            break;
          }
        }
        _tmp$8 = _ + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return _M0FP314vlmkit_2dsites4wiki4main1h("div", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "article-body plain")], kids);
  }
  function _M0FP314vlmkit_2dsites4wiki4main12source__view() {
    const sb = _M0MPB13StringBuilder21StringBuilder_2einner(8);
    _M0IPB13StringBuilderPB6Logger13write__string(sb, `{{Hatnote|${_M0FP314vlmkit_2dsites4wiki4main7hatnote}}}\n\n`);
    const _bind$19 = _M0FP314vlmkit_2dsites4wiki4main4lead.length;
    let _tmp$8 = 0;
    while (true) {
      const _ = _tmp$8;
      if (_ < _bind$19) {
        const p = _M0FP314vlmkit_2dsites4wiki4main4lead[_];
        _M0IPB13StringBuilderPB6Logger13write__string(sb, `${p}\n\n`);
        _tmp$8 = _ + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    const _bind$20 = _M0FP314vlmkit_2dsites4wiki4main8sections.length;
    let _tmp$9 = 0;
    while (true) {
      const _ = _tmp$9;
      if (_ < _bind$20) {
        const s = _M0FP314vlmkit_2dsites4wiki4main8sections[_];
        _M0IPB13StringBuilderPB6Logger13write__string(sb, `== ${s.title} ==\n`);
        const _bind$21 = s.paras;
        const _bind$22 = _bind$21.length;
        let _tmp$10 = 0;
        while (true) {
          const _$2 = _tmp$10;
          if (_$2 < _bind$22) {
            const p = _bind$21[_$2];
            _M0IPB13StringBuilderPB6Logger13write__string(sb, `${p}\n\n`);
            _tmp$10 = _$2 + 1 | 0;
            continue;
          } else {
            break;
          }
        }
        const _bind$23 = s.subs;
        const _bind$24 = _bind$23.length;
        let _tmp$11 = 0;
        while (true) {
          const _$2 = _tmp$11;
          if (_$2 < _bind$24) {
            const sub = _bind$23[_$2];
            _M0IPB13StringBuilderPB6Logger13write__string(sb, `=== ${sub.title} ===\n`);
            const _bind$25 = sub.paras;
            const _bind$26 = _bind$25.length;
            let _tmp$12 = 0;
            while (true) {
              const _$3 = _tmp$12;
              if (_$3 < _bind$26) {
                const p = _bind$25[_$3];
                _M0IPB13StringBuilderPB6Logger13write__string(sb, `${p}\n\n`);
                _tmp$12 = _$3 + 1 | 0;
                continue;
              } else {
                break;
              }
            }
            _tmp$11 = _$2 + 1 | 0;
            continue;
          } else {
            break;
          }
        }
        _tmp$9 = _ + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return _M0FP314vlmkit_2dsites4wiki4main1h("div", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "article-body plain")], [_M0FP314vlmkit_2dsites4wiki4main1h("p", [], [_M0FP314vlmkit_2dsites4wiki4main2tx("This page is protected in this demo. You can view and copy its source.")]), _M0FP314vlmkit_2dsites4wiki4main1h("label", [_M0FP314vlmkit_2dsites4wiki4main1a("for", "source-text"), _M0FP314vlmkit_2dsites4wiki4main1a("class", "field-label")], [_M0FP314vlmkit_2dsites4wiki4main2tx("Source of Moon")]), _M0FP314vlmkit_2dsites4wiki4main1h("textarea", [_M0FP314vlmkit_2dsites4wiki4main1a("id", "source-text"), _M0FP314vlmkit_2dsites4wiki4main1a("class", "source"), _M0FP314vlmkit_2dsites4wiki4main1a("readonly", ""), _M0FP314vlmkit_2dsites4wiki4main1a("rows", "18"), _M0FP314vlmkit_2dsites4wiki4main1a("spellcheck", "false")], [_M0FP314vlmkit_2dsites4wiki4main2tx(sb.val)])]);
  }
  function _M0FP314vlmkit_2dsites4wiki4main13history__view() {
    const rows = [];
    const _bind$19 = _M0FP314vlmkit_2dsites4wiki4main7history.length;
    let _tmp$8 = 0;
    while (true) {
      const _ = _tmp$8;
      if (_ < _bind$19) {
        const r = _M0FP314vlmkit_2dsites4wiki4main7history[_];
        const _tmp$9 = [];
        const _tmp$10 = _M0FP314vlmkit_2dsites4wiki4main1h("td", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "nowrap")], [_M0FP314vlmkit_2dsites4wiki4main2tx(r.date)]);
        const _tmp$11 = _M0FP314vlmkit_2dsites4wiki4main1h("td", [], [_M0FP314vlmkit_2dsites4wiki4main2tx(r.user)]);
        const _tmp$12 = _M0FP314vlmkit_2dsites4wiki4main1h("td", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "num")], [_M0FP314vlmkit_2dsites4wiki4main2tx(r.size)]);
        const _p = "num delta";
        const _p$2 = "minus";
        const _p$3 = _M0FP314vlmkit_2dsites4wiki4main12starts__with(r.delta, "−");
        _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(rows, _M0FP314vlmkit_2dsites4wiki4main1h("tr", _tmp$9, [_tmp$10, _tmp$11, _tmp$12, _M0FP314vlmkit_2dsites4wiki4main1h("td", [_M0FP314vlmkit_2dsites4wiki4main1a("class", _p$3 ? `${_p} ${_p$2}` : _p)], [_M0FP314vlmkit_2dsites4wiki4main2tx(r.delta)]), _M0FP314vlmkit_2dsites4wiki4main1h("td", [], [_M0FP314vlmkit_2dsites4wiki4main2tx(r.summary)])]));
        _tmp$8 = _ + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return _M0FP314vlmkit_2dsites4wiki4main1h("div", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "article-body plain")], [_M0FP314vlmkit_2dsites4wiki4main1h("p", [], [_M0FP314vlmkit_2dsites4wiki4main2tx("The ten most recent revisions of the article, newest first.")]), _M0FP314vlmkit_2dsites4wiki4main1h("div", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "table-scroll"), _M0FP314vlmkit_2dsites4wiki4main1a("tabindex", "0"), _M0FP314vlmkit_2dsites4wiki4main1a("role", "region"), _M0FP314vlmkit_2dsites4wiki4main1a("aria-label", "Revision history table")], [_M0FP314vlmkit_2dsites4wiki4main1h("table", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "history")], [_M0FP314vlmkit_2dsites4wiki4main1h("caption", [], [_M0FP314vlmkit_2dsites4wiki4main2tx("Revision history of “Moon”")]), _M0FP314vlmkit_2dsites4wiki4main1h("thead", [], [_M0FP314vlmkit_2dsites4wiki4main1h("tr", [], [_M0FP314vlmkit_2dsites4wiki4main1h("th", [_M0FP314vlmkit_2dsites4wiki4main1a("scope", "col")], [_M0FP314vlmkit_2dsites4wiki4main2tx("Date")]), _M0FP314vlmkit_2dsites4wiki4main1h("th", [_M0FP314vlmkit_2dsites4wiki4main1a("scope", "col")], [_M0FP314vlmkit_2dsites4wiki4main2tx("Editor")]), _M0FP314vlmkit_2dsites4wiki4main1h("th", [_M0FP314vlmkit_2dsites4wiki4main1a("scope", "col"), _M0FP314vlmkit_2dsites4wiki4main1a("class", "num")], [_M0FP314vlmkit_2dsites4wiki4main2tx("Size (bytes)")]), _M0FP314vlmkit_2dsites4wiki4main1h("th", [_M0FP314vlmkit_2dsites4wiki4main1a("scope", "col"), _M0FP314vlmkit_2dsites4wiki4main1a("class", "num")], [_M0FP314vlmkit_2dsites4wiki4main2tx("Change")]), _M0FP314vlmkit_2dsites4wiki4main1h("th", [_M0FP314vlmkit_2dsites4wiki4main1a("scope", "col")], [_M0FP314vlmkit_2dsites4wiki4main2tx("Summary")])])]), _M0FP314vlmkit_2dsites4wiki4main1h("tbody", [], rows)])])]);
  }
  function _M0FP314vlmkit_2dsites4wiki4main12simple__page(title, body) {
    const kids = [_M0FP314vlmkit_2dsites4wiki4main1h("div", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "title-block")], [_M0FP314vlmkit_2dsites4wiki4main1h("div", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "title-row"), _M0FP314vlmkit_2dsites4wiki4main1a("id", "top")], [_M0FP314vlmkit_2dsites4wiki4main1h("h1", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "page-title")], [_M0FP314vlmkit_2dsites4wiki4main2tx(title)])]), _M0FP314vlmkit_2dsites4wiki4main1h("p", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "from-line")], [_M0FP314vlmkit_2dsites4wiki4main2tx("From Lexipedia, the free encyclopedia")])])];
    const _bind$19 = body.length;
    let _tmp$8 = 0;
    while (true) {
      const _ = _tmp$8;
      if (_ < _bind$19) {
        const b = body[_];
        _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(kids, b);
        _tmp$8 = _ + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return _M0FP314vlmkit_2dsites4wiki4main1h("div", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "simple-page")], kids);
  }
  function _M0FP314vlmkit_2dsites4wiki4main11find__title(t) {
    const _bind$19 = _M0FP314vlmkit_2dsites4wiki4main6titles.length;
    let _tmp$8 = 0;
    while (true) {
      const _ = _tmp$8;
      if (_ < _bind$19) {
        const it = _M0FP314vlmkit_2dsites4wiki4main6titles[_];
        if (it.title === t) {
          return it;
        }
        _tmp$8 = _ + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return undefined;
  }
  function _M0FP314vlmkit_2dsites4wiki4main10stub__view(t) {
    const info = _M0FP314vlmkit_2dsites4wiki4main11find__title(t);
    let lead_nodes;
    if (info === undefined) {
      lead_nodes = [_M0FP314vlmkit_2dsites4wiki4main1h("p", [], [_M0FP314vlmkit_2dsites4wiki4main1h("b", [], [_M0FP314vlmkit_2dsites4wiki4main2tx(t)]), _M0FP314vlmkit_2dsites4wiki4main2tx(" is a page of this demo encyclopedia that has not been written yet.")])];
    } else {
      const _Some = info;
      const _it = _Some;
      lead_nodes = [_M0FP314vlmkit_2dsites4wiki4main1h("div", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "stub-thumb")], [_M0FP314vlmkit_2dsites4wiki4main10thumb__art(_it.thumb, "stub")]), _M0FP314vlmkit_2dsites4wiki4main1h("p", [], [_M0FP314vlmkit_2dsites4wiki4main2tx(_it.extract)])];
    }
    const body = [_M0FP314vlmkit_2dsites4wiki4main1h("div", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "stub-lead")], lead_nodes)];
    _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(body, _M0FP314vlmkit_2dsites4wiki4main1h("div", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "stub-box"), _M0FP314vlmkit_2dsites4wiki4main1a("role", "note")], [_M0FP314vlmkit_2dsites4wiki4main1h("p", [], [_M0FP314vlmkit_2dsites4wiki4main1h("b", [], [_M0FP314vlmkit_2dsites4wiki4main2tx("This article is a stub.")]), _M0FP314vlmkit_2dsites4wiki4main2tx(" You can help Lexipedia by expanding it.")])]));
    _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(body, _M0FP314vlmkit_2dsites4wiki4main1h("p", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "back-to")], [_M0FP314vlmkit_2dsites4wiki4main2tx("Return to the article "), _M0FP314vlmkit_2dsites4wiki4main10wiki__link("Moon", "Moon"), _M0FP314vlmkit_2dsites4wiki4main2tx(".")]));
    return _M0FP314vlmkit_2dsites4wiki4main12simple__page(t, body);
  }
  function _M0FP314vlmkit_2dsites4wiki4main12search__view(q) {
    const ms = _M0FP314vlmkit_2dsites4wiki4main15search__matches(q);
    const items = [];
    const _bind$19 = ms.length;
    let _tmp$8 = 0;
    while (true) {
      const _ = _tmp$8;
      if (_ < _bind$19) {
        const t = ms[_];
        _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(items, _M0FP314vlmkit_2dsites4wiki4main1h("li", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "result")], [_M0FP314vlmkit_2dsites4wiki4main10thumb__art(t.thumb, "r"), _M0FP314vlmkit_2dsites4wiki4main1h("div", [], [_M0FP314vlmkit_2dsites4wiki4main1h("p", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "result-title")], [_M0FP314vlmkit_2dsites4wiki4main10wiki__link(t.title, t.title)]), _M0FP314vlmkit_2dsites4wiki4main1h("p", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "result-desc")], [_M0FP314vlmkit_2dsites4wiki4main2tx(`${t.desc}. ${t.extract}`)])])]));
        _tmp$8 = _ + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    let summary;
    if (q === "") {
      summary = "Type a word in the search field to look for an article, such as “eclipse” or “tide”.";
    } else {
      if (ms.length === 0) {
        summary = `There were no results matching “${q}”. Try a shorter word, such as “lunar”.`;
      } else {
        if (ms.length === 1) {
          summary = `1 result for “${q}”.`;
        } else {
          const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(16);
          _M0MPB13StringBuilder13write__objectGiE(_string_builder, ms.length);
          _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, " results for “");
          summary = `${_string_builder.val}${q}”.`;
        }
      }
    }
    return _M0FP314vlmkit_2dsites4wiki4main12simple__page("Search results", [_M0FP314vlmkit_2dsites4wiki4main1h("p", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "result-count"), _M0FP314vlmkit_2dsites4wiki4main1a("role", "status")], [_M0FP314vlmkit_2dsites4wiki4main2tx(summary)]), _M0FP314vlmkit_2dsites4wiki4main1h("ul", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "results")], items)]);
  }
  function _M0FP314vlmkit_2dsites4wiki4main13content__view(r) {
    switch (r.$tag) {
      case 4: {
        const _Stub = r;
        const _t = _Stub._0;
        return _M0FP314vlmkit_2dsites4wiki4main10stub__view(_t);
      }
      case 5: {
        const _Search = r;
        const _q = _Search._0;
        return _M0FP314vlmkit_2dsites4wiki4main12search__view(_q);
      }
      default: {
        const _tmp$8 = [_M0FP314vlmkit_2dsites4wiki4main1a("class", "article-page")];
        const _tmp$9 = _M0FP314vlmkit_2dsites4wiki4main10title__bar();
        let _tmp$10;
        switch (r.$tag) {
          case 1: {
            _tmp$10 = _M0FP314vlmkit_2dsites4wiki4main10talk__view();
            break;
          }
          case 2: {
            _tmp$10 = _M0FP314vlmkit_2dsites4wiki4main12source__view();
            break;
          }
          case 3: {
            _tmp$10 = _M0FP314vlmkit_2dsites4wiki4main13history__view();
            break;
          }
          default: {
            _tmp$10 = _M0FP314vlmkit_2dsites4wiki4main13article__view();
          }
        }
        return _M0FP314vlmkit_2dsites4wiki4main1h("div", _tmp$8, [_tmp$9, _tmp$10]);
      }
    }
  }
  function _M0FP314vlmkit_2dsites4wiki4main13preview__card(p) {
    const _bind$19 = p.kind;
    let body;
    if (_bind$19.$tag === 0) {
      const _PPage = _bind$19;
      const _t = _PPage._0;
      const _bind$20 = _M0FP314vlmkit_2dsites4wiki4main11find__title(_t);
      if (_bind$20 === undefined) {
        body = [_M0FP314vlmkit_2dsites4wiki4main1h("div", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "pv-text")], [_M0FP314vlmkit_2dsites4wiki4main1h("p", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "pv-title")], [_M0FP314vlmkit_2dsites4wiki4main2tx(_t)]), _M0FP314vlmkit_2dsites4wiki4main1h("p", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "pv-extract")], [_M0FP314vlmkit_2dsites4wiki4main2tx("This page has not been written yet.")])])];
      } else {
        const _Some = _bind$20;
        const _it = _Some;
        body = [_M0FP314vlmkit_2dsites4wiki4main1h("div", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "pv-thumb")], [_M0FP314vlmkit_2dsites4wiki4main10thumb__art(_it.thumb, "pv")]), _M0FP314vlmkit_2dsites4wiki4main1h("div", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "pv-text")], [_M0FP314vlmkit_2dsites4wiki4main1h("p", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "pv-title")], [_M0FP314vlmkit_2dsites4wiki4main2tx(_it.title)]), _M0FP314vlmkit_2dsites4wiki4main1h("p", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "pv-extract")], [_M0FP314vlmkit_2dsites4wiki4main2tx(_it.extract)])])];
      }
    } else {
      const _PRef = _bind$19;
      const _n = _PRef._0;
      const _tmp$8 = [_M0FP314vlmkit_2dsites4wiki4main1a("class", "pv-text")];
      const _tmp$9 = [_M0FP314vlmkit_2dsites4wiki4main1a("class", "pv-label")];
      const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(10);
      _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, "Reference ");
      _M0MPB13StringBuilder13write__objectGiE(_string_builder, _n);
      body = [_M0FP314vlmkit_2dsites4wiki4main1h("div", _tmp$8, [_M0FP314vlmkit_2dsites4wiki4main1h("p", _tmp$9, [_M0FP314vlmkit_2dsites4wiki4main2tx(_string_builder.val)]), _M0FP314vlmkit_2dsites4wiki4main1h("p", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "pv-ref")], _M0FP314vlmkit_2dsites4wiki4main13inline__nodes(_M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(_M0FP314vlmkit_2dsites4wiki4main10references, _n - 1 | 0).text))])];
    }
    const _bind$20 = p.kind;
    let kind_cls;
    if (_bind$20.$tag === 0) {
      kind_cls = "preview preview-page";
    } else {
      kind_cls = "preview preview-ref";
    }
    const _tmp$8 = _M0FP314vlmkit_2dsites4wiki4main1a("class", p.above ? `${kind_cls} above` : kind_cls);
    const _tmp$9 = _M0FP314vlmkit_2dsites4wiki4main1a("role", "tooltip");
    const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(18);
    _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, "left: ");
    _M0MPB13StringBuilder13write__objectGdE(_string_builder, p.x);
    _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, "px; top: ");
    _M0MPB13StringBuilder13write__objectGdE(_string_builder, p.y);
    _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, "px;");
    return _M0FP314vlmkit_2dsites4wiki4main1h("div", [_tmp$8, _tmp$9, _M0FP314vlmkit_2dsites4wiki4main1a("style", _string_builder.val), _M0FP314vlmkit_2dsites4wiki4main2on("mouseenter", (_e) => {
      _M0FP314vlmkit_2dsites4wiki4main12cancel__hide();
    }), _M0FP314vlmkit_2dsites4wiki4main2on("mouseleave", (_e) => {
      _M0FP314vlmkit_2dsites4wiki4main10hide__soon();
    })], body);
  }
  function _M0FP314vlmkit_2dsites4wiki4main16language__dialogN4pickS2684(l) {
    const _bind$19 = _M0FP314vlmkit_2dsites4wiki4main12lang__dialog.val;
    if (_bind$19.$tag === 1) {
      const _Some = _bind$19;
      const _d = _Some._0;
      _M0FP314vlmkit_2dsites4wiki4main13dialog__close(_d);
    }
    _M0FP314vlmkit_2dsites4wiki4main5toast(`The ${l} edition is not part of this demo.`);
  }
  function _M0FP314vlmkit_2dsites4wiki4main16language__dialog() {
    const filtered = _M0FP26mizchi7signals4memoGRPB5ArrayGsEE(() => {
      const q = _M0FP314vlmkit_2dsites4wiki4main5lower(_M0MP26mizchi7signals6Signal3getGRP314vlmkit_2dsites4wiki4main5RouteE(_M0FP314vlmkit_2dsites4wiki4main11lang__query));
      const _p = [];
      const _p$2 = _M0FP314vlmkit_2dsites4wiki4main9languages.length;
      let _tmp$8 = 0;
      while (true) {
        const _p$3 = _tmp$8;
        if (_p$3 < _p$2) {
          const _p$4 = _M0FP314vlmkit_2dsites4wiki4main9languages[_p$3];
          if (q === "" || _M0MPC16string6String8contains(_M0FP314vlmkit_2dsites4wiki4main5lower(_p$4), new _M0TPC16string10StringView(q, 0, q.length))) {
            _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(_p, _p$4);
          }
          _tmp$8 = _p$3 + 1 | 0;
          continue;
        } else {
          return _p;
        }
      }
    });
    const suggested = [];
    const _bind$19 = _M0FP314vlmkit_2dsites4wiki4main20suggested__languages.length;
    let _tmp$8 = 0;
    while (true) {
      const _ = _tmp$8;
      if (_ < _bind$19) {
        const l = _M0FP314vlmkit_2dsites4wiki4main20suggested__languages[_];
        _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(suggested, _M0FP314vlmkit_2dsites4wiki4main1h("li", [], [_M0FP314vlmkit_2dsites4wiki4main1h("button", [_M0FP314vlmkit_2dsites4wiki4main1a("type", "button"), _M0FP314vlmkit_2dsites4wiki4main1a("class", "lang-item"), _M0FP314vlmkit_2dsites4wiki4main2on("click", (_e) => {
          _M0FP314vlmkit_2dsites4wiki4main16language__dialogN4pickS2684(l);
        })], [_M0FP314vlmkit_2dsites4wiki4main2tx(l)])]));
        _tmp$8 = _ + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return _M0FP314vlmkit_2dsites4wiki4main1h("dialog", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "dialog lang-dialog"), _M0FP314vlmkit_2dsites4wiki4main1a("aria-labelledby", "lang-h"), _M0FP314vlmkit_2dsites4wiki4main7ref__to(_M0FP314vlmkit_2dsites4wiki4main12lang__dialog), _M0FP314vlmkit_2dsites4wiki4main2on("close", (_e) => {
      _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4wiki4main10lang__open, false);
    })], [_M0FP314vlmkit_2dsites4wiki4main1h("div", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "dialog-head")], [_M0FP314vlmkit_2dsites4wiki4main1h("h2", [_M0FP314vlmkit_2dsites4wiki4main1a("id", "lang-h")], [_M0FP314vlmkit_2dsites4wiki4main2tx("Read this article in another language")]), _M0FP314vlmkit_2dsites4wiki4main1h("button", [_M0FP314vlmkit_2dsites4wiki4main1a("type", "button"), _M0FP314vlmkit_2dsites4wiki4main1a("class", "icon-btn"), _M0FP314vlmkit_2dsites4wiki4main1a("aria-label", "Close"), _M0FP314vlmkit_2dsites4wiki4main2on("click", (_e) => {
      const _bind$20 = _M0FP314vlmkit_2dsites4wiki4main12lang__dialog.val;
      if (_bind$20.$tag === 1) {
        const _Some = _bind$20;
        const _d = _Some._0;
        _M0FP314vlmkit_2dsites4wiki4main13dialog__close(_d);
        return;
      } else {
        return;
      }
    })], [_M0FP314vlmkit_2dsites4wiki4main11icon__close()])]), _M0FP314vlmkit_2dsites4wiki4main1h("label", [_M0FP314vlmkit_2dsites4wiki4main1a("for", "lang-search"), _M0FP314vlmkit_2dsites4wiki4main1a("class", "sr-only")], [_M0FP314vlmkit_2dsites4wiki4main2tx("Search for a language")]), _M0FP314vlmkit_2dsites4wiki4main1h("input", [_M0FP314vlmkit_2dsites4wiki4main1a("id", "lang-search"), _M0FP314vlmkit_2dsites4wiki4main1a("type", "search"), _M0FP314vlmkit_2dsites4wiki4main1a("class", "lang-search"), _M0FP314vlmkit_2dsites4wiki4main1a("placeholder", "Search for a language"), _M0FP314vlmkit_2dsites4wiki4main1a("autocomplete", "off"), _M0FP314vlmkit_2dsites4wiki4main1a("autofocus", ""), _M0FP314vlmkit_2dsites4wiki4main7ref__to(_M0FP314vlmkit_2dsites4wiki4main11lang__input), _M0FP314vlmkit_2dsites4wiki4main2on("input", (e) => {
      _M0MP26mizchi7signals6Signal3setGRP314vlmkit_2dsites4wiki4main5RouteE(_M0FP314vlmkit_2dsites4wiki4main11lang__query, _M0FP314vlmkit_2dsites4wiki4main9ev__value(e));
    })], []), _M0FP36mizchi4luna3dom4show(() => _M0MP26mizchi7signals6Signal3getGRP314vlmkit_2dsites4wiki4main5RouteE(_M0FP314vlmkit_2dsites4wiki4main11lang__query) === "", () => _M0FP314vlmkit_2dsites4wiki4main1h("div", [], [_M0FP314vlmkit_2dsites4wiki4main1h("h3", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "lang-sub")], [_M0FP314vlmkit_2dsites4wiki4main2tx("Suggested languages")]), _M0FP314vlmkit_2dsites4wiki4main1h("ul", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "lang-grid lang-suggested")], suggested)])), _M0FP314vlmkit_2dsites4wiki4main1h("h3", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "lang-sub")], [_M0FP36mizchi4luna3dom9text__dyn(() => {
      const n = filtered().length;
      if (_M0MP26mizchi7signals6Signal3getGRP314vlmkit_2dsites4wiki4main5RouteE(_M0FP314vlmkit_2dsites4wiki4main11lang__query) === "") {
        return "All languages";
      } else {
        if (n === 0) {
          return `No languages match “${_M0MP26mizchi7signals6Signal3getGRP314vlmkit_2dsites4wiki4main5RouteE(_M0FP314vlmkit_2dsites4wiki4main11lang__query)}”`;
        } else {
          if (n === 1) {
            return "1 language matches";
          } else {
            const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(16);
            _M0MPB13StringBuilder13write__objectGiE(_string_builder, n);
            _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, " languages match");
            return _string_builder.val;
          }
        }
      }
    })]), _M0FP314vlmkit_2dsites4wiki4main1h("ul", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "lang-grid")], [_M0FP36mizchi4luna3dom9for__eachGRP314vlmkit_2dsites4wiki4main5RouteE(() => filtered(), (l, _i) => _M0FP314vlmkit_2dsites4wiki4main1h("li", [], [_M0FP314vlmkit_2dsites4wiki4main1h("button", [_M0FP314vlmkit_2dsites4wiki4main1a("type", "button"), _M0FP314vlmkit_2dsites4wiki4main1a("class", "lang-item"), _M0FP314vlmkit_2dsites4wiki4main2on("click", (_e) => {
      _M0FP314vlmkit_2dsites4wiki4main16language__dialogN4pickS2684(l);
    })], [_M0FP314vlmkit_2dsites4wiki4main2tx(l)])]))])]);
  }
  function _M0FP314vlmkit_2dsites4wiki4main11media__step(d) {
    const n = _M0FP314vlmkit_2dsites4wiki4main7figures.length;
    _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4wiki4main12media__index, ((_M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4wiki4main12media__index) + d | 0) + n | 0) % n | 0);
  }
  function _M0FP314vlmkit_2dsites4wiki4main13media__viewer() {
    return _M0FP314vlmkit_2dsites4wiki4main1h("dialog", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "dialog media-dialog"), _M0FP314vlmkit_2dsites4wiki4main1a("aria-labelledby", "media-caption"), _M0FP314vlmkit_2dsites4wiki4main7ref__to(_M0FP314vlmkit_2dsites4wiki4main13media__dialog), _M0FP314vlmkit_2dsites4wiki4main2on("close", (_e) => {
      _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4wiki4main11media__open, false);
    }), _M0FP314vlmkit_2dsites4wiki4main2on("keydown", (e) => {
      const k = _M0FP314vlmkit_2dsites4wiki4main7ev__key(e);
      if (k === "ArrowRight") {
        _M0FP314vlmkit_2dsites4wiki4main11media__step(1);
        return;
      } else {
        if (k === "ArrowLeft") {
          _M0FP314vlmkit_2dsites4wiki4main11media__step(-1);
          return;
        } else {
          return;
        }
      }
    })], [_M0FP314vlmkit_2dsites4wiki4main1h("div", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "media-head")], [_M0FP314vlmkit_2dsites4wiki4main1h("p", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "media-count")], [_M0FP36mizchi4luna3dom9text__dyn(() => {
      const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(10);
      _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, "Image ");
      _M0MPB13StringBuilder13write__objectGiE(_string_builder, _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4wiki4main12media__index) + 1 | 0);
      _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, " of ");
      _M0MPB13StringBuilder13write__objectGiE(_string_builder, _M0FP314vlmkit_2dsites4wiki4main7figures.length);
      return _string_builder.val;
    })]), _M0FP314vlmkit_2dsites4wiki4main1h("button", [_M0FP314vlmkit_2dsites4wiki4main1a("type", "button"), _M0FP314vlmkit_2dsites4wiki4main1a("class", "icon-btn media-close"), _M0FP314vlmkit_2dsites4wiki4main1a("aria-label", "Close"), _M0FP314vlmkit_2dsites4wiki4main2on("click", (_e) => {
      const _bind$19 = _M0FP314vlmkit_2dsites4wiki4main13media__dialog.val;
      if (_bind$19.$tag === 1) {
        const _Some = _bind$19;
        const _d = _Some._0;
        _M0FP314vlmkit_2dsites4wiki4main13dialog__close(_d);
        return;
      } else {
        return;
      }
    })], [_M0FP314vlmkit_2dsites4wiki4main11icon__close()])]), _M0FP314vlmkit_2dsites4wiki4main1h("div", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "media-stage")], [_M0FP36mizchi4luna3dom9for__eachGiE(() => [_M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4wiki4main12media__index)], (i, _k) => {
      const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(2);
      _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, "mv");
      _M0MPB13StringBuilder13write__objectGiE(_string_builder, i);
      return _M0FP314vlmkit_2dsites4wiki4main11figure__art(i, _string_builder.val, `media-art fig-${_M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(_M0FP314vlmkit_2dsites4wiki4main7figures, i).kind}`);
    })]), _M0FP314vlmkit_2dsites4wiki4main1h("p", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "media-caption"), _M0FP314vlmkit_2dsites4wiki4main1a("id", "media-caption")], [_M0FP36mizchi4luna3dom9text__dyn(() => _M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(_M0FP314vlmkit_2dsites4wiki4main7figures, _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4wiki4main12media__index)).caption)]), _M0FP314vlmkit_2dsites4wiki4main1h("div", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "media-nav")], [_M0FP314vlmkit_2dsites4wiki4main1h("button", [_M0FP314vlmkit_2dsites4wiki4main1a("type", "button"), _M0FP314vlmkit_2dsites4wiki4main1a("class", "btn"), _M0FP314vlmkit_2dsites4wiki4main2on("click", (_e) => {
      _M0FP314vlmkit_2dsites4wiki4main11media__step(-1);
    })], [_M0FP314vlmkit_2dsites4wiki4main2tx("Previous")]), _M0FP314vlmkit_2dsites4wiki4main1h("button", [_M0FP314vlmkit_2dsites4wiki4main1a("type", "button"), _M0FP314vlmkit_2dsites4wiki4main1a("class", "btn"), _M0FP314vlmkit_2dsites4wiki4main2on("click", (_e) => {
      _M0FP314vlmkit_2dsites4wiki4main11media__step(1);
    })], [_M0FP314vlmkit_2dsites4wiki4main2tx("Next")])])]);
  }
  function _M0FP314vlmkit_2dsites4wiki4main8spy__ids() {
    const ids = ["top"];
    const _bind$19 = _M0FP314vlmkit_2dsites4wiki4main8sections.length;
    let _tmp$8 = 0;
    while (true) {
      const _ = _tmp$8;
      if (_ < _bind$19) {
        const s = _M0FP314vlmkit_2dsites4wiki4main8sections[_];
        _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(ids, s.id);
        const _bind$20 = s.subs;
        const _bind$21 = _bind$20.length;
        let _tmp$9 = 0;
        while (true) {
          const _$2 = _tmp$9;
          if (_$2 < _bind$21) {
            const sub = _bind$20[_$2];
            _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(ids, sub.id);
            _tmp$9 = _$2 + 1 | 0;
            continue;
          } else {
            break;
          }
        }
        _tmp$8 = _ + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    const _bind$20 = _M0FP314vlmkit_2dsites4wiki4main9back__ids.length;
    let _tmp$9 = 0;
    while (true) {
      const _ = _tmp$9;
      if (_ < _bind$20) {
        const b = _M0FP314vlmkit_2dsites4wiki4main9back__ids[_];
        _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(ids, b);
        _tmp$9 = _ + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return ids;
  }
  function _M0FP314vlmkit_2dsites4wiki4main11update__spy(ids) {
    if (_M0IP016_24default__implPB2Eq10not__equalGRP314vlmkit_2dsites4wiki4main5RouteE(_M0MP26mizchi7signals6Signal3getGRP314vlmkit_2dsites4wiki4main5RouteE(_M0FP314vlmkit_2dsites4wiki4main5route), _M0DTP314vlmkit_2dsites4wiki4main5Route7Article__)) {
      return undefined;
    }
    const line = 0.25 * _M0FP314vlmkit_2dsites4wiki4main16viewport__height();
    let current = "top";
    const _bind$19 = ids.length;
    let _tmp$8 = 0;
    while (true) {
      const _ = _tmp$8;
      if (_ < _bind$19) {
        const id = ids[_];
        if (_M0FP314vlmkit_2dsites4wiki4main11top__of__id(id) <= line) {
          current = id;
        }
        _tmp$8 = _ + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    if (_M0FP314vlmkit_2dsites4wiki4main21page__bottom__reached()) {
      const _bind$20 = ids.length;
      let _tmp$9 = 0;
      while (true) {
        const _ = _tmp$9;
        if (_ < _bind$20) {
          const id = ids[_];
          const t = _M0FP314vlmkit_2dsites4wiki4main11top__of__id(id);
          if (t < _M0FP314vlmkit_2dsites4wiki4main16viewport__height() && t > line) {
            current = id;
          }
          _tmp$9 = _ + 1 | 0;
          continue;
        } else {
          break;
        }
      }
    }
    const _p = _M0MP26mizchi7signals6Signal3getGRP314vlmkit_2dsites4wiki4main5RouteE(_M0FP314vlmkit_2dsites4wiki4main10active__id);
    const _p$2 = current;
    if (!(_p === _p$2)) {
      _M0MP26mizchi7signals6Signal3setGRP314vlmkit_2dsites4wiki4main5RouteE(_M0FP314vlmkit_2dsites4wiki4main10active__id, current);
      return;
    } else {
      return;
    }
  }
  (() => {
    const _bind$19 = _M0FP314vlmkit_2dsites4wiki4main8sections.length;
    let _tmp$8 = 0;
    while (true) {
      const i = _tmp$8;
      if (i < _bind$19) {
        const s = _M0FP314vlmkit_2dsites4wiki4main8sections[i];
        _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(_M0FP314vlmkit_2dsites4wiki4main9toc__open, _M0FP26mizchi7signals6signalGiE(0));
        _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(_M0FP314vlmkit_2dsites4wiki4main9acc__open, _M0FP26mizchi7signals6signalGbE(false));
        const _bind$20 = s.paras;
        const _bind$21 = _bind$20.length;
        let _tmp$9 = 0;
        while (true) {
          const _ = _tmp$9;
          if (_ < _bind$21) {
            const p = _bind$20[_];
            _M0FP314vlmkit_2dsites4wiki4main11scan__cites(p, i);
            _tmp$9 = _ + 1 | 0;
            continue;
          } else {
            break;
          }
        }
        const _bind$22 = s.subs;
        const _bind$23 = _bind$22.length;
        let _tmp$10 = 0;
        while (true) {
          const _ = _tmp$10;
          if (_ < _bind$23) {
            const sub = _bind$22[_];
            const _bind$24 = sub.paras;
            const _bind$25 = _bind$24.length;
            let _tmp$11 = 0;
            while (true) {
              const _$2 = _tmp$11;
              if (_$2 < _bind$25) {
                const p = _bind$24[_$2];
                _M0FP314vlmkit_2dsites4wiki4main11scan__cites(p, i);
                _tmp$11 = _$2 + 1 | 0;
                continue;
              } else {
                break;
              }
            }
            _tmp$10 = _ + 1 | 0;
            continue;
          } else {
            break;
          }
        }
        _tmp$8 = i + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    const _bind$20 = _M0FP314vlmkit_2dsites4wiki4main9back__ids.length;
    let _tmp$9 = 0;
    while (true) {
      const _ = _tmp$9;
      if (_ < _bind$20) {
        _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(_M0FP314vlmkit_2dsites4wiki4main9acc__open, _M0FP26mizchi7signals6signalGbE(false));
        _tmp$9 = _ + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    const _bind$21 = _M0FP314vlmkit_2dsites4wiki4main4lead.length;
    let _tmp$10 = 0;
    while (true) {
      const _ = _tmp$10;
      if (_ < _bind$21) {
        const p = _M0FP314vlmkit_2dsites4wiki4main4lead[_];
        _M0FP314vlmkit_2dsites4wiki4main11scan__cites(p, -1);
        _tmp$10 = _ + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    _M0MP26mizchi7signals6Signal3setGRP314vlmkit_2dsites4wiki4main5RouteE(_M0FP314vlmkit_2dsites4wiki4main10text__size, _M0FP314vlmkit_2dsites4wiki4main4load("text", ["small", "standard", "large"], "standard"));
    _M0MP26mizchi7signals6Signal3setGRP314vlmkit_2dsites4wiki4main5RouteE(_M0FP314vlmkit_2dsites4wiki4main11width__pref, _M0FP314vlmkit_2dsites4wiki4main4load("width", ["standard", "wide"], "standard"));
    _M0MP26mizchi7signals6Signal3setGRP314vlmkit_2dsites4wiki4main5RouteE(_M0FP314vlmkit_2dsites4wiki4main11color__pref, _M0FP314vlmkit_2dsites4wiki4main4load("color", ["auto", "light", "dark"], "auto"));
    _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4wiki4main11toc__hidden, _M0FP314vlmkit_2dsites4wiki4main12storage__get("lexipedia:toc") === "hidden");
    _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4wiki4main18appearance__hidden, _M0FP314vlmkit_2dsites4wiki4main12storage__get("lexipedia:appearance") === "hidden");
    _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4wiki4main7watched, _M0FP314vlmkit_2dsites4wiki4main12storage__get("lexipedia:watch") === "true");
    const forced = _M0FP314vlmkit_2dsites4wiki4main12query__param("theme");
    if (forced === "dark" || forced === "light") {
      _M0MP26mizchi7signals6Signal3setGRP314vlmkit_2dsites4wiki4main5RouteE(_M0FP314vlmkit_2dsites4wiki4main11color__pref, forced);
    }
    _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4wiki4main9is__phone, _M0FP314vlmkit_2dsites4wiki4main12watch__media("(max-width: 719px)", (m) => {
      _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4wiki4main9is__phone, m);
    }));
    _M0FP26mizchi7signals6effect(() => {
      _M0FP314vlmkit_2dsites4wiki4main15set__root__attr("data-text", _M0MP26mizchi7signals6Signal3getGRP314vlmkit_2dsites4wiki4main5RouteE(_M0FP314vlmkit_2dsites4wiki4main10text__size));
      _M0FP314vlmkit_2dsites4wiki4main15set__root__attr("data-width", _M0MP26mizchi7signals6Signal3getGRP314vlmkit_2dsites4wiki4main5RouteE(_M0FP314vlmkit_2dsites4wiki4main11width__pref));
      _M0FP314vlmkit_2dsites4wiki4main15set__root__attr("data-theme", _M0MP26mizchi7signals6Signal3getGRP314vlmkit_2dsites4wiki4main5RouteE(_M0FP314vlmkit_2dsites4wiki4main11color__pref));
      _M0FP314vlmkit_2dsites4wiki4main15set__root__attr("data-toc", _M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4wiki4main11toc__hidden) ? "hidden" : "shown");
      _M0FP314vlmkit_2dsites4wiki4main15set__root__attr("data-appearance", _M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4wiki4main18appearance__hidden) ? "hidden" : "shown");
    });
    const app = _M0FP314vlmkit_2dsites4wiki4main1h("div", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "app")], [_M0FP314vlmkit_2dsites4wiki4main1h("a", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "skip-link"), _M0FP314vlmkit_2dsites4wiki4main1a("href", "#content")], [_M0FP314vlmkit_2dsites4wiki4main2tx("Skip to content")]), _M0FP314vlmkit_2dsites4wiki4main6header(), _M0FP314vlmkit_2dsites4wiki4main1h("div", [_M0FP314vlmkit_2dsites4wiki4main1a("class", "page")], [_M0FP36mizchi4luna3dom4show(() => _M0IP314vlmkit_2dsites4wiki4main5RoutePB2Eq5equal(_M0MP26mizchi7signals6Signal3getGRP314vlmkit_2dsites4wiki4main5RouteE(_M0FP314vlmkit_2dsites4wiki4main5route), _M0DTP314vlmkit_2dsites4wiki4main5Route7Article__), () => _M0FP314vlmkit_2dsites4wiki4main9toc__rail()), _M0FP314vlmkit_2dsites4wiki4main1h("main", [_M0FP314vlmkit_2dsites4wiki4main1a("id", "content"), _M0FP314vlmkit_2dsites4wiki4main1a("class", "content"), _M0FP314vlmkit_2dsites4wiki4main1a("tabindex", "-1")], [_M0FP36mizchi4luna3dom9for__eachGRP314vlmkit_2dsites4wiki4main5RouteE(() => [_M0MP26mizchi7signals6Signal3getGRP314vlmkit_2dsites4wiki4main5RouteE(_M0FP314vlmkit_2dsites4wiki4main5route)], (r, _i) => _M0FP314vlmkit_2dsites4wiki4main13content__view(r))]), _M0FP314vlmkit_2dsites4wiki4main16appearance__rail()]), _M0FP36mizchi4luna3dom9for__eachGRP314vlmkit_2dsites4wiki4main5RouteE(() => {
      const _bind$22 = _M0MP26mizchi7signals6Signal3getGORP314vlmkit_2dsites4wiki4main7PreviewE(_M0FP314vlmkit_2dsites4wiki4main7preview);
      if (_bind$22 === undefined) {
        return [];
      } else {
        const _Some = _bind$22;
        const _p = _Some;
        return [_p];
      }
    }, (p, _i) => _M0FP314vlmkit_2dsites4wiki4main13preview__card(p)), _M0FP314vlmkit_2dsites4wiki4main1h("div", [_M0FP314vlmkit_2dsites4wiki4main2dy("class", () => {
      const _p = "toast";
      const _p$2 = "show";
      const _p$3 = _M0MP26mizchi7signals6Signal3getGRP314vlmkit_2dsites4wiki4main5RouteE(_M0FP314vlmkit_2dsites4wiki4main10toast__msg);
      const _p$4 = "";
      const _p$5 = !(_p$3 === _p$4);
      return _p$5 ? `${_p} ${_p$2}` : _p;
    }), _M0FP314vlmkit_2dsites4wiki4main1a("role", "status"), _M0FP314vlmkit_2dsites4wiki4main1a("aria-live", "polite")], [_M0FP36mizchi4luna3dom9text__dyn(() => _M0MP26mizchi7signals6Signal3getGRP314vlmkit_2dsites4wiki4main5RouteE(_M0FP314vlmkit_2dsites4wiki4main10toast__msg))]), _M0FP314vlmkit_2dsites4wiki4main16language__dialog(), _M0FP314vlmkit_2dsites4wiki4main13media__viewer()]);
    const _bind$22 = _M0MP36mizchi11js__browser3dom8Document14getElementById(_M0FP36mizchi11js__browser3dom8document(), "app");
    if (_bind$22.$tag === 1) {
      const _Some = _bind$22;
      const _el = _Some._0;
      _M0FP36mizchi4luna3dom10render__to(_el, app);
    }
    _M0FP314vlmkit_2dsites4wiki4main16on__doc__keydown((k) => {
      if (k === "Escape") {
        const _bind$23 = _M0MP26mizchi7signals6Signal3getGORP314vlmkit_2dsites4wiki4main7PreviewE(_M0FP314vlmkit_2dsites4wiki4main7preview);
        if (_bind$23 === undefined) {
        } else {
          _M0FP314vlmkit_2dsites4wiki4main9hide__now();
        }
        if (_M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4wiki4main14toc__pop__open)) {
          _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4wiki4main14toc__pop__open, false);
          _M0FP314vlmkit_2dsites4wiki4main9focus__id("toc-pop-btn");
        }
        if (_M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4wiki4main15app__menu__open)) {
          _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4wiki4main15app__menu__open, false);
          _M0FP314vlmkit_2dsites4wiki4main9focus__id("app-menu-btn");
        }
        if (_M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4wiki4main10menu__open)) {
          _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4wiki4main10menu__open, false);
          _M0FP314vlmkit_2dsites4wiki4main9focus__id("menu-btn");
          return;
        } else {
          return;
        }
      } else {
        return;
      }
    });
    _M0FP314vlmkit_2dsites4wiki4main18on__outside__press(".toc-pop-wrap", () => {
      if (_M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4wiki4main14toc__pop__open)) {
        _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4wiki4main14toc__pop__open, false);
        return;
      } else {
        return;
      }
    });
    _M0FP314vlmkit_2dsites4wiki4main18on__outside__press(".app-menu-wrap", () => {
      if (_M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4wiki4main15app__menu__open)) {
        _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4wiki4main15app__menu__open, false);
        return;
      } else {
        return;
      }
    });
    _M0FP314vlmkit_2dsites4wiki4main18on__outside__press(".header-start", () => {
      if (_M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4wiki4main10menu__open)) {
        _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4wiki4main10menu__open, false);
        return;
      } else {
        return;
      }
    });
    _M0FP314vlmkit_2dsites4wiki4main16on__touch__press(() => {
      _M0FP314vlmkit_2dsites4wiki4main13touch__recent.val = true;
      _M0FP314vlmkit_2dsites4wiki4main12set__timeout(() => {
        _M0FP314vlmkit_2dsites4wiki4main13touch__recent.val = false;
      }, 800);
    });
    const ids = _M0FP314vlmkit_2dsites4wiki4main8spy__ids();
    _M0FP314vlmkit_2dsites4wiki4main17on__scroll__frame(() => {
      _M0FP314vlmkit_2dsites4wiki4main11update__spy(ids);
    });
    _M0FP314vlmkit_2dsites4wiki4main14on__hashchange(() => {
      _M0FP314vlmkit_2dsites4wiki4main11sync__route();
    });
    _M0FP314vlmkit_2dsites4wiki4main11sync__route();
    _M0FP314vlmkit_2dsites4wiki4main11update__spy(ids);
  })();
})();
