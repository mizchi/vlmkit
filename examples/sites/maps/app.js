// Built from src/ (MoonBit, mizchi/luna) by `node examples/sites/luna-build.mjs maps`. Do not edit.
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
  function _M0TP314vlmkit_2dsites4maps4main4View(param0, param1, param2) {
    this.cx = param0;
    this.cy = param1;
    this.z = param2;
  }
  function _M0TP314vlmkit_2dsites4maps4main5Query(param0, param1, param2, param3, param4, param5) {
    this.cat = param0;
    this.text = param1;
    this.near = param2;
    this.nx = param3;
    this.ny = param4;
    this.label = param5;
  }
  function _M0TP314vlmkit_2dsites4maps4main6Street(param0, param1, param2, param3, param4) {
    this.name = param0;
    this.kind = param1;
    this.vertical = param2;
    this.at = param3;
    this.route = param4;
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
  function _M0DTPC16option6OptionGRP26mizchi8js__core3AnyE4None() {}
  _M0DTPC16option6OptionGRP26mizchi8js__core3AnyE4None.prototype.$tag = 0;
  const _M0DTPC16option6OptionGRP26mizchi8js__core3AnyE4None__ = new _M0DTPC16option6OptionGRP26mizchi8js__core3AnyE4None();
  function _M0DTPC16option6OptionGRP26mizchi8js__core3AnyE4Some(param0) {
    this._0 = param0;
  }
  _M0DTPC16option6OptionGRP26mizchi8js__core3AnyE4Some.prototype.$tag = 1;
  function _M0TP314vlmkit_2dsites4maps4main5Route(param0, param1, param2, param3) {
    this.pts = param0;
    this.steps = param1;
    this.approx = param2;
    this.length = param3;
  }
  function _M0TP314vlmkit_2dsites4maps4main8Clusters(param0, param1, param2, param3) {
    this.leader = param0;
    this.count = param1;
    this.cx = param2;
    this.cy = param3;
  }
  function _M0TPC16string10StringView(param0, param1, param2) {
    this.str = param0;
    this.start = param1;
    this.end = param2;
  }
  function _M0DTP314vlmkit_2dsites4maps4main4Sugg4SCat(param0) {
    this._0 = param0;
  }
  _M0DTP314vlmkit_2dsites4maps4main4Sugg4SCat.prototype.$tag = 0;
  function _M0DTP314vlmkit_2dsites4maps4main4Sugg5SNear(param0, param1) {
    this._0 = param0;
    this._1 = param1;
  }
  _M0DTP314vlmkit_2dsites4maps4main4Sugg5SNear.prototype.$tag = 1;
  function _M0DTP314vlmkit_2dsites4maps4main4Sugg6SPlace(param0) {
    this._0 = param0;
  }
  _M0DTP314vlmkit_2dsites4maps4main4Sugg6SPlace.prototype.$tag = 2;
  function _M0DTP314vlmkit_2dsites4maps4main4Sugg5SArea(param0) {
    this._0 = param0;
  }
  _M0DTP314vlmkit_2dsites4maps4main4Sugg5SArea.prototype.$tag = 3;
  function _M0DTP314vlmkit_2dsites4maps4main4Sugg7SRecent(param0) {
    this._0 = param0;
  }
  _M0DTP314vlmkit_2dsites4maps4main4Sugg7SRecent.prototype.$tag = 4;
  function _M0TPB13StringBuilder(param0) {
    this.val = param0;
  }
  class $PanicError extends Error {}
  function $panic() {
    throw new $PanicError();
  }
  const _M0FPB19int__to__string__js = (x, radix) => {
    return x.toString(radix);
  };
  function _M0TPB4IterGRPC16string10StringViewE(param0, param1) {
    this.f = param0;
    this.size_hint = param1;
  }
  function _M0TPB4IterGcE(param0, param1) {
    this.f = param0;
    this.size_hint = param1;
  }
  function _M0TPB4IterGiE(param0, param1) {
    this.f = param0;
    this.size_hint = param1;
  }
  function $oob() {
    throw new Error("Index out of bounds");
  }
  function _M0TPB8MutLocalGiE(param0) {
    this.val = param0;
  }
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
  function _M0TPB4IterGsE(param0, param1) {
    this.f = param0;
    this.size_hint = param1;
  }
  function _M0TPB8MutLocalGORPC16string10StringViewE(param0) {
    this.val = param0;
  }
  function _M0TPB9ArrayViewGUsRP36mizchi4luna3dom4AttrEE(param0, param1, param2) {
    this.buf = param0;
    this.start = param1;
    this.end = param2;
  }
  function _M0TPB9ArrayViewGiE(param0, param1, param2) {
    this.buf = param0;
    this.start = param1;
    this.end = param2;
  }
  const _M0MPB7JSArray4copy = (arr) => arr.slice(0);
  const _M0MPB7JSArray11set__length = (arr, len) => { arr.length = len; };
  const _M0MPB7JSArray3pop = (arr) => arr.pop();
  const _M0MPB7JSArray6splice = (arr, idx, cnt) => arr.splice(idx, cnt);
  function _M0TPB12MutArrayViewGRP314vlmkit_2dsites4maps4main6ReviewE(param0, param1, param2) {
    this.buf = param0;
    this.start = param1;
    this.end = param2;
  }
  function _M0TPB12MutArrayViewGdE(param0, param1, param2) {
    this.buf = param0;
    this.start = param1;
    this.end = param2;
  }
  function _M0DTPC16option6OptionGdE4None() {}
  _M0DTPC16option6OptionGdE4None.prototype.$tag = 0;
  const _M0DTPC16option6OptionGdE4None__ = new _M0DTPC16option6OptionGdE4None();
  function _M0DTPC16option6OptionGdE4Some(param0) {
    this._0 = param0;
  }
  _M0DTPC16option6OptionGdE4Some.prototype.$tag = 1;
  function _M0TPC13ref3RefGORPB5ArrayGiEE(param0) {
    this.val = param0;
  }
  function _M0TPC13ref3RefGRPB5ArrayGRP36mizchi11js__browser3dom4NodeEE(param0) {
    this.val = param0;
  }
  function _M0TPC13ref3RefGOiE(param0) {
    this.val = param0;
  }
  function _M0TPC13ref3RefGiE(param0) {
    this.val = param0;
  }
  function _M0TPC13ref3RefGdE(param0) {
    this.val = param0;
  }
  function _M0TPC13ref3RefGbE(param0) {
    this.val = param0;
  }
  const _M0MP26mizchi8js__core3Any5__get = (obj, key) => obj[key];
  const _M0MP26mizchi8js__core3Any6__call = (obj, key, args) => obj[key](...args);
  const _M0FP26mizchi8js__core11is__nullish = (v) => v == null;
  const _M0MP26mizchi8js__core3Any5__set = (obj, key, value) => { obj[key] = value };
  const _M0FP26mizchi8js__core4null = () => null;
  const _M0FP26mizchi8js__core11new__object = () => ({});
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
  function _M0DTPC16option6OptionGRPB5ArrayGiEE4None() {}
  _M0DTPC16option6OptionGRPB5ArrayGiEE4None.prototype.$tag = 0;
  const _M0DTPC16option6OptionGRPB5ArrayGiEE4None__ = new _M0DTPC16option6OptionGRPB5ArrayGiEE4None();
  function _M0DTPC16option6OptionGRPB5ArrayGiEE4Some(param0) {
    this._0 = param0;
  }
  _M0DTPC16option6OptionGRPB5ArrayGiEE4Some.prototype.$tag = 1;
  function _M0TP26mizchi7signals10CoreSignalGRP314vlmkit_2dsites4maps4main4ViewE(param0, param1, param2) {
    this.node = param0;
    this.current_value = param1;
    this.pending_value = param2;
  }
  function _M0TP26mizchi7signals10CoreSignalGiE(param0, param1, param2) {
    this.node = param0;
    this.current_value = param1;
    this.pending_value = param2;
  }
  function _M0TP26mizchi7signals10CoreSignalGdE(param0, param1, param2) {
    this.node = param0;
    this.current_value = param1;
    this.pending_value = param2;
  }
  function _M0TP26mizchi7signals10CoreSignalGbE(param0, param1, param2) {
    this.node = param0;
    this.current_value = param1;
    this.pending_value = param2;
  }
  function _M0TP26mizchi7signals10CoreSignalGRPB5ArrayGiEE(param0, param1, param2) {
    this.node = param0;
    this.current_value = param1;
    this.pending_value = param2;
  }
  function _M0TP26mizchi7signals6SignalGRP314vlmkit_2dsites4maps4main4ViewE(param0) {
    this.inner = param0;
  }
  function _M0TP26mizchi7signals6SignalGiE(param0) {
    this.inner = param0;
  }
  function _M0TP26mizchi7signals6SignalGdE(param0) {
    this.inner = param0;
  }
  function _M0TP26mizchi7signals6SignalGbE(param0) {
    this.inner = param0;
  }
  function _M0TP26mizchi7signals6SignalGRPB5ArrayGiEE(param0) {
    this.inner = param0;
  }
  function _M0TP26mizchi7signals8ComputedGORP314vlmkit_2dsites4maps4main5RouteE(param0, param1, param2) {
    this.node = param0;
    this.value = param1;
    this.getter = param2;
  }
  function _M0DTPC16option6OptionGORP314vlmkit_2dsites4maps4main5RouteE4None() {}
  _M0DTPC16option6OptionGORP314vlmkit_2dsites4maps4main5RouteE4None.prototype.$tag = 0;
  const _M0DTPC16option6OptionGORP314vlmkit_2dsites4maps4main5RouteE4None__ = new _M0DTPC16option6OptionGORP314vlmkit_2dsites4maps4main5RouteE4None();
  function _M0DTPC16option6OptionGORP314vlmkit_2dsites4maps4main5RouteE4Some(param0) {
    this._0 = param0;
  }
  _M0DTPC16option6OptionGORP314vlmkit_2dsites4maps4main5RouteE4Some.prototype.$tag = 1;
  function _M0TP26mizchi7signals8ComputedGiE(param0, param1, param2) {
    this.node = param0;
    this.value = param1;
    this.getter = param2;
  }
  function _M0TP26mizchi7signals8ComputedGRP314vlmkit_2dsites4maps4main8ClustersE(param0, param1, param2) {
    this.node = param0;
    this.value = param1;
    this.getter = param2;
  }
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
  function _M0TP36mizchi4luna3dom9ItemEntryGiE(param0, param1, param2, param3, param4) {
    this.item = param0;
    this.dom = param1;
    this.last = param2;
    this.nodes = param3;
    this.dispose = param4;
  }
  function _M0TP36mizchi4luna3dom10IndexEntry(param0, param1, param2) {
    this.node = param0;
    this.dispose = param1;
    this.disposed = param2;
  }
  const _M0MP36mizchi4luna3dom10HandlerMap5click = (m, handler) => { m.click = handler; return m; };
  const _M0MP36mizchi4luna3dom10HandlerMap8dblclick = (m, handler) => { m.dblclick = handler; return m; };
  const _M0MP36mizchi4luna3dom10HandlerMap5input = (m, handler) => { m.input = handler; return m; };
  const _M0MP36mizchi4luna3dom10HandlerMap6change = (m, handler) => { m.change = handler; return m; };
  const _M0MP36mizchi4luna3dom10HandlerMap7keydown = (m, handler) => { m.keydown = handler; return m; };
  const _M0MP36mizchi4luna3dom10HandlerMap5focus = (m, handler) => { m.focus = handler; return m; };
  const _M0MP36mizchi4luna3dom10HandlerMap4blur = (m, handler) => { m.blur = handler; return m; };
  const _M0MP36mizchi4luna3dom10HandlerMap10mouseenter = (m, handler) => { m.mouseenter = handler; return m; };
  const _M0MP36mizchi4luna3dom10HandlerMap10mouseleave = (m, handler) => { m.mouseleave = handler; return m; };
  const _M0MP36mizchi4luna3dom10HandlerMap9mousedown = (m, handler) => { m.mousedown = handler; return m; };
  const _M0MP36mizchi4luna3dom10HandlerMap11pointerdown = (m, handler) => { m.pointerdown = handler; return m; };
  const _M0MP36mizchi4luna3dom10HandlerMap11pointermove = (m, handler) => { m.pointermove = handler; return m; };
  const _M0MP36mizchi4luna3dom10HandlerMap9pointerup = (m, handler) => { m.pointerup = handler; return m; };
  const _M0MP36mizchi4luna3dom10HandlerMap13pointercancel = (m, handler) => { m.pointercancel = handler; return m; };
  const _M0MP36mizchi4luna3dom10HandlerMap9to__attrs = (m) => Object.entries(m).map(([k, v]) => ({ _0: k, _1: { $tag: 2, _0: v } }));
  const _M0FP314vlmkit_2dsites4maps4main4powf = (a, b) => Math.pow(a, b);
  function _M0TP314vlmkit_2dsites4maps4main5Place(param0, param1, param2, param3, param4, param5, param6, param7, param8, param9, param10) {
    this.id = param0;
    this.name = param1;
    this.cat = param2;
    this.x = param3;
    this.y = param4;
    this.rating = param5;
    this.reviews = param6;
    this.price = param7;
    this.hours = param8;
    this.site = param9;
    this.blurb = param10;
  }
  const _M0FP314vlmkit_2dsites4maps4main4fmt1 = (d) => String(Math.round(d * 10) / 10);
  const _M0FP314vlmkit_2dsites4maps4main14replace__query = (q) => { try { history.replaceState(null, "", location.pathname + q + location.hash); } catch (e) {} };
  const _M0FP314vlmkit_2dsites4maps4main3raf = (f) => requestAnimationFrame(f);
  const _M0FP314vlmkit_2dsites4maps4main15reduced__motion = () => !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const _M0FP314vlmkit_2dsites4maps4main2ln = (x) => Math.log(x);
  const _M0FP314vlmkit_2dsites4maps4main6atan2d = (y, x) => Math.atan2(y, x) * 180 / Math.PI;
  const _M0FP314vlmkit_2dsites4maps4main10set__value = (el, v) => { if (el) el.value = v; };
  const _M0FP314vlmkit_2dsites4maps4main11ev__prevent = (e) => e.preventDefault();
  const _M0FP314vlmkit_2dsites4maps4main7ev__str = (e, k) => String(e[k] == null ? "" : e[k]);
  const _M0FP314vlmkit_2dsites4maps4main12scroll__into = (id) => { const el = document.getElementById(id); if (el) el.scrollIntoView({ block: "nearest" }); };
  function _M0DTP36mizchi4luna3dom4Attr10AttrString(param0) {
    this._0 = param0;
  }
  _M0DTP36mizchi4luna3dom4Attr10AttrString.prototype.$tag = 0;
  function _M0DTP36mizchi4luna3dom4Attr10AttrNumber(param0) {
    this._0 = param0;
  }
  _M0DTP36mizchi4luna3dom4Attr10AttrNumber.prototype.$tag = 1;
  function _M0DTP36mizchi4luna3dom4Attr7AttrInt(param0) {
    this._0 = param0;
  }
  _M0DTP36mizchi4luna3dom4Attr7AttrInt.prototype.$tag = 2;
  function _M0DTP36mizchi4luna3dom4Attr8AttrBool(param0) {
    this._0 = param0;
  }
  _M0DTP36mizchi4luna3dom4Attr8AttrBool.prototype.$tag = 3;
  function _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None() {}
  _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None.prototype.$tag = 0;
  const _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__ = new _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None();
  function _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4Some(param0) {
    this._0 = param0;
  }
  _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4Some.prototype.$tag = 1;
  function _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None() {}
  _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None.prototype.$tag = 0;
  const _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__ = new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None();
  function _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some(param0) {
    this._0 = param0;
  }
  _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some.prototype.$tag = 1;
  function _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None() {}
  _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None.prototype.$tag = 0;
  const _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__ = new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None();
  function _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4Some(param0) {
    this._0 = param0;
  }
  _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4Some.prototype.$tag = 1;
  const _M0FP314vlmkit_2dsites4maps4main9focus__id = (id) => { const el = document.getElementById(id); if (el) el.focus(); };
  const _M0FP314vlmkit_2dsites4maps4main12dialog__show = (el) => { if (el && !el.open) el.showModal(); };
  function _M0TP314vlmkit_2dsites4maps4main6Review(param0, param1, param2, param3, param4, param5) {
    this.author = param0;
    this.stars = param1;
    this.date = param2;
    this.key = param3;
    this.text = param4;
    this.order = param5;
  }
  const _M0FP314vlmkit_2dsites4maps4main12focus__later = (id) => requestAnimationFrame(() => { const el = document.getElementById(id); if (el) el.focus(); });
  const _M0FP314vlmkit_2dsites4maps4main4fmt2 = (d) => String(Math.round(d * 100) / 100);
  function _M0TPB8MutLocalGdE(param0) {
    this.val = param0;
  }
  const _M0FP314vlmkit_2dsites4maps4main8is__self = (e) => e.target === e.currentTarget;
  const _M0FP314vlmkit_2dsites4maps4main8el__left = (el) => el ? el.getBoundingClientRect().left : 0;
  const _M0FP314vlmkit_2dsites4maps4main7el__top = (el) => el ? el.getBoundingClientRect().top : 0;
  const _M0FP314vlmkit_2dsites4maps4main7ev__num = (e, k) => +e[k] || 0;
  const _M0FP314vlmkit_2dsites4maps4main7capture = (el, e) => { try { el.setPointerCapture(e.pointerId); } catch (x) {} };
  const _M0FP314vlmkit_2dsites4maps4main7release = (el, e) => { try { el.releasePointerCapture(e.pointerId); } catch (x) {} };
  const _M0FP314vlmkit_2dsites4maps4main10target__in = (e, sel) => !!(e.target && e.target.closest && e.target.closest(sel));
  const _M0FP314vlmkit_2dsites4maps4main6on__el = (el, name, f) => el.addEventListener(name, f, { passive: false });
  const _M0FP314vlmkit_2dsites4maps4main13dialog__close = (el) => { if (el && el.open) el.close(); };
  const _M0FP314vlmkit_2dsites4maps4main11select__all = (el) => { if (el && el.select) { el.select(); el.scrollLeft = 0; } };
  const _M0FP314vlmkit_2dsites4maps4main10el__height = (el) => el ? el.clientHeight : 0;
  const _M0FP314vlmkit_2dsites4maps4main9el__width = (el) => el ? el.clientWidth : 0;
  const _M0FP314vlmkit_2dsites4maps4main6win__h = () => window.innerHeight;
  const _M0FP314vlmkit_2dsites4maps4main6win__w = () => window.innerWidth;
  const _M0FP314vlmkit_2dsites4maps4main7is__nan = (d) => d !== d;
  const _M0FP314vlmkit_2dsites4maps4main10parse__num = (s) => { const n = parseFloat(s); return isFinite(n) ? n : NaN; };
  const _M0FP314vlmkit_2dsites4maps4main10url__param = (name) => { try { return new URLSearchParams(location.search).get(name) || ""; } catch (e) { return ""; } };
  const _M0FP314vlmkit_2dsites4maps4main10on__window = (name, f) => window.addEventListener(name, f);
  const _M0FP092moonbitlang_2fcore_2fbuiltin_2fStringBuilder_24as_24_40moonbitlang_2fcore_2fbuiltin_2eLogger = { method_0: _M0IPB13StringBuilderPB6Logger13write__string, method_1: _M0IP016_24default__implPB6Logger16write__substringGRPB13StringBuilderE, method_2: _M0IPB13StringBuilderPB6Logger11write__view, method_3: _M0IPB13StringBuilderPB6Logger11write__char, method_4: _M0IP016_24default__implPB6Logger28write__string__interpolationGRPB13StringBuilderE, method_5: _M0IP016_24default__implPB6Logger5writeGRPB13StringBuilderE };
  const _M0MPB4Iter4nextN6constrS61GRPC16string10StringViewE = 0;
  const _M0MPB4Iter4nextN6constrS62GRPC16string10StringViewE = 0;
  const _M0MPB4Iter4nextN6constrS77GcE = 0;
  const _M0MPB4Iter4nextN6constrS78GcE = 0;
  const _M0MPB4Iter4nextN6constrS93GiE = 0;
  const _M0MPB4Iter4nextN6constrS94GiE = 0;
  const _M0MPB4Iter3newN6constrS119GRPC16string10StringViewE = 0;
  const _M0MPB4Iter3newN6constrS131GcE = 0;
  const _M0MPB4Iter3newN6constrS143GiE = 0;
  const _M0FP26mizchi7signals17reactive__context = new _M0TP26mizchi7signals15ReactiveContext(undefined, _M0DTPC16option6OptionGRPB5ArrayGWEuEE4None__, 0);
  const _M0FP26mizchi7signals15callback__queue = [];
  const _M0FP26mizchi7signals22callback__queue__nodes = [];
  const _M0FP36mizchi4luna3dom7svg__ns = "http://www.w3.org/2000/svg";
  const _M0FP314vlmkit_2dsites4maps4main10desk__home = new _M0TP314vlmkit_2dsites4maps4main4View(1900, 1250, 2);
  const _M0FP314vlmkit_2dsites4maps4main11phone__home = new _M0TP314vlmkit_2dsites4maps4main4View(1420, 1650, 1.5);
  const _M0FP314vlmkit_2dsites4maps4main9no__query = new _M0TP314vlmkit_2dsites4maps4main5Query(-1, "", false, 0, 0, "");
  const _M0FP314vlmkit_2dsites4maps4main10cat__names = ["Restaurants", "Coffee", "Hotels", "Museums", "Parks", "Transit"];
  const _M0FP314vlmkit_2dsites4maps4main13cat__singular = ["Restaurant", "Coffee shop", "Hotel", "Museum", "Park", "Station"];
  const _M0FP314vlmkit_2dsites4maps4main5areasN5tupleS2948 = { _0: "Old Town", _1: 600, _2: 600 };
  const _M0FP314vlmkit_2dsites4maps4main5areasN5tupleS2949 = { _0: "Millbank", _1: 640, _2: 1880 };
  const _M0FP314vlmkit_2dsites4maps4main5areasN5tupleS2950 = { _0: "Riverside", _1: 1520, _2: 640 };
  const _M0FP314vlmkit_2dsites4maps4main5areasN5tupleS2951 = { _0: "Harbour Quarter", _1: 2450, _2: 1665 };
  const _M0FP314vlmkit_2dsites4maps4main5areasN5tupleS2952 = { _0: "Crown Hill", _1: 2850, _2: 540 };
  const _M0FP314vlmkit_2dsites4maps4main5areasN5tupleS2953 = { _0: "Eastpoint", _1: 3480, _2: 1040 };
  const _M0FP314vlmkit_2dsites4maps4main5areas = [_M0FP314vlmkit_2dsites4maps4main5areasN5tupleS2948, _M0FP314vlmkit_2dsites4maps4main5areasN5tupleS2949, _M0FP314vlmkit_2dsites4maps4main5areasN5tupleS2950, _M0FP314vlmkit_2dsites4maps4main5areasN5tupleS2951, _M0FP314vlmkit_2dsites4maps4main5areasN5tupleS2952, _M0FP314vlmkit_2dsites4maps4main5areasN5tupleS2953];
  const _M0FP314vlmkit_2dsites4maps4main6routesN5tupleS2969 = { _0: 1700, _1: 900 };
  const _M0FP314vlmkit_2dsites4maps4main6routesN5tupleS2970 = { _0: 1700, _1: 1040 };
  const _M0FP314vlmkit_2dsites4maps4main6routesN5tupleS2971 = { _0: 2300, _1: 1040 };
  const _M0FP314vlmkit_2dsites4maps4main6routesN5tupleS2972 = { _0: 2300, _1: 1600 };
  const _M0FP314vlmkit_2dsites4maps4main6routesN5tupleS2973 = { _0: 2525, _1: 1600 };
  const _M0FP314vlmkit_2dsites4maps4main6routesN5tupleS2974 = { _0: 2525, _1: 1530 };
  const _M0FP314vlmkit_2dsites4maps4main6routesN5tupleS2975 = { _0: 350, _1: 1250 };
  const _M0FP314vlmkit_2dsites4maps4main6routesN5tupleS2976 = { _0: 360, _1: 1250 };
  const _M0FP314vlmkit_2dsites4maps4main6routesN5tupleS2977 = { _0: 360, _1: 1320 };
  const _M0FP314vlmkit_2dsites4maps4main6routesN5tupleS2978 = { _0: 840, _1: 1320 };
  const _M0FP314vlmkit_2dsites4maps4main6routesN5tupleS2979 = { _0: 840, _1: 1776 };
  const _M0FP314vlmkit_2dsites4maps4main6routesN5tupleS2980 = { _0: 1700, _1: 1260 };
  const _M0FP314vlmkit_2dsites4maps4main6routesN5tupleS2981 = { _0: 1700, _1: 1600 };
  const _M0FP314vlmkit_2dsites4maps4main6routesN5tupleS2982 = { _0: 2300, _1: 1600 };
  const _M0FP314vlmkit_2dsites4maps4main6routesN5tupleS2983 = { _0: 2300, _1: 1880 };
  const _M0FP314vlmkit_2dsites4maps4main6routesN5tupleS2984 = { _0: 2375, _1: 1880 };
  const _M0FP314vlmkit_2dsites4maps4main6routesN5tupleS2985 = { _0: 2375, _1: 1950 };
  const _M0FP314vlmkit_2dsites4maps4main6routesN5tupleS2986 = { _0: 1775, _1: 1110 };
  const _M0FP314vlmkit_2dsites4maps4main6routesN5tupleS2987 = { _0: 1775, _1: 1040 };
  const _M0FP314vlmkit_2dsites4maps4main6routesN5tupleS2988 = { _0: 840, _1: 1040 };
  const _M0FP314vlmkit_2dsites4maps4main6routesN5tupleS2989 = { _0: 840, _1: 1320 };
  const _M0FP314vlmkit_2dsites4maps4main6routesN5tupleS2990 = { _0: 680, _1: 1320 };
  const _M0FP314vlmkit_2dsites4maps4main6routesN5tupleS2991 = { _0: 680, _1: 1360 };
  const _M0FP314vlmkit_2dsites4maps4main6routes = [{ _0: 35, _1: 17, _2: [_M0FP314vlmkit_2dsites4maps4main6routesN5tupleS2969, _M0FP314vlmkit_2dsites4maps4main6routesN5tupleS2970, _M0FP314vlmkit_2dsites4maps4main6routesN5tupleS2971, _M0FP314vlmkit_2dsites4maps4main6routesN5tupleS2972, _M0FP314vlmkit_2dsites4maps4main6routesN5tupleS2973, _M0FP314vlmkit_2dsites4maps4main6routesN5tupleS2974], _3: ["Head south on Lamplighter Way", "Turn left onto Harbour Avenue (7)", "Turn right onto Crown Avenue (12)", "Turn left onto Foundry Street", "Turn left; The Harbour Light Hotel is on the right"] }, { _0: 33, _1: 23, _2: [_M0FP314vlmkit_2dsites4maps4main6routesN5tupleS2975, _M0FP314vlmkit_2dsites4maps4main6routesN5tupleS2976, _M0FP314vlmkit_2dsites4maps4main6routesN5tupleS2977, _M0FP314vlmkit_2dsites4maps4main6routesN5tupleS2978, _M0FP314vlmkit_2dsites4maps4main6routesN5tupleS2979, _M0FP314vlmkit_2dsites4maps4main6routesN5tupleS2980, _M0FP314vlmkit_2dsites4maps4main6routesN5tupleS2981, _M0FP314vlmkit_2dsites4maps4main6routesN5tupleS2982, _M0FP314vlmkit_2dsites4maps4main6routesN5tupleS2983, _M0FP314vlmkit_2dsites4maps4main6routesN5tupleS2984, _M0FP314vlmkit_2dsites4maps4main6routesN5tupleS2985], _3: ["Head south on Flint Lane", "Turn left onto Mill Street", "Turn right onto Chandler Street", "Turn left onto Lumen Avenue (1) and cross the Sable Bridge", "Turn right onto Lamplighter Way", "Turn left onto Foundry Street", "Turn right onto Crown Avenue (12)", "Turn left onto Dock Street", "Turn right; Port Lumen Maritime Museum is ahead"] }, { _0: 9, _1: 28, _2: [_M0FP314vlmkit_2dsites4maps4main6routesN5tupleS2986, _M0FP314vlmkit_2dsites4maps4main6routesN5tupleS2987, _M0FP314vlmkit_2dsites4maps4main6routesN5tupleS2988, _M0FP314vlmkit_2dsites4maps4main6routesN5tupleS2989, _M0FP314vlmkit_2dsites4maps4main6routesN5tupleS2990, _M0FP314vlmkit_2dsites4maps4main6routesN5tupleS2991], _3: ["Head north to Harbour Avenue (7)", "Turn left onto Harbour Avenue and cross the Harbour Bridge", "Turn left onto Chandler Street", "Turn right onto Mill Street", "Turn left into Lantern Park"] }];
  const _M0FP314vlmkit_2dsites4maps4main11mode__names = ["Drive", "Transit", "Walk", "Cycle"];
  const _M0FP314vlmkit_2dsites4maps4main10cat__icons = ["M8 3v7M5.5 3v4.5a2.5 2.5 0 0 0 5 0V3M8 10v11M16.5 3c-2 1.5-2.5 5-2.5 8h2.5v10", "M5 9h11v4.5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5ZM16 10.5h1.5a2.5 2.5 0 0 1 0 5H16M8 3.5v2M11 3.5v2", "M3 19V6M3 15h18v4M21 15v-3a3 3 0 0 0-3-3h-7v6M7 9.5a1.8 1.8 0 1 0 0 3.6a1.8 1.8 0 1 0 0-3.6", "M3 9.5L12 4l9 5.5M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18", "M12 3l5.5 7.5H14l4.5 6h-13L10 10.5H6.5ZM12 16.5V21", "M7.5 3.5h9a2 2 0 0 1 2 2V14a3 3 0 0 1-3 3h-7a3 3 0 0 1-3-3V5.5a2 2 0 0 1 2-2ZM5.5 10h13M8.5 20.5l2-3.5M15.5 20.5l-2-3.5"];
  const _M0FP314vlmkit_2dsites4maps4main9ic__clock = "M12 3.5a8.5 8.5 0 1 0 0 17a8.5 8.5 0 1 0 0-17M12 7.5V12l3 2";
  const _M0FP314vlmkit_2dsites4maps4main7ic__pin = "M12 21s-6.5-6.1-6.5-11a6.5 6.5 0 0 1 13 0c0 4.9-6.5 11-6.5 11ZM12 7.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5";
  const _M0FP314vlmkit_2dsites4maps4main16recent__searches = ["Coffee", "Port Lumen Maritime Museum", "Harbour Quarter"];
  const _M0FP314vlmkit_2dsites4maps4main8ic__turn = "M8 15v-3.5a2 2 0 0 1 2-2h6M13 6.5l3 3-3 3";
  const _M0FP314vlmkit_2dsites4maps4main9ic__close = "M6 6l12 12M18 6L6 18";
  const _M0FP314vlmkit_2dsites4maps4main10ic__search = "M10.5 4a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13M15.3 15.3L20 20";
  const _M0FP314vlmkit_2dsites4maps4main10day__short = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3028 = { _0: 420, _1: 1080 };
  const _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3029 = { _0: 420, _1: 1080 };
  const _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3030 = { _0: 420, _1: 1080 };
  const _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3031 = { _0: 420, _1: 1080 };
  const _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3032 = { _0: 420, _1: 1080 };
  const _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3033 = { _0: 480, _1: 1080 };
  const _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3034 = { _0: 480, _1: 960 };
  const _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3035 = { _0: 690, _1: 1320 };
  const _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3036 = { _0: 690, _1: 1320 };
  const _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3037 = { _0: 690, _1: 1320 };
  const _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3038 = { _0: 690, _1: 1320 };
  const _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3039 = { _0: 690, _1: 1380 };
  const _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3040 = { _0: 690, _1: 1380 };
  const _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3041 = { _0: 690, _1: 1260 };
  const _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3042 = { _0: -1, _1: -1 };
  const _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3043 = { _0: 1020, _1: 1380 };
  const _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3044 = { _0: 1020, _1: 1380 };
  const _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3045 = { _0: 1020, _1: 1380 };
  const _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3046 = { _0: 1020, _1: 1440 };
  const _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3047 = { _0: 1020, _1: 1440 };
  const _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3048 = { _0: 1020, _1: 1320 };
  const _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3049 = { _0: -1, _1: -1 };
  const _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3050 = { _0: 600, _1: 1020 };
  const _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3051 = { _0: 600, _1: 1020 };
  const _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3052 = { _0: 600, _1: 1020 };
  const _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3053 = { _0: 600, _1: 1260 };
  const _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3054 = { _0: 600, _1: 1080 };
  const _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3055 = { _0: 600, _1: 1080 };
  const _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3056 = { _0: 360, _1: 1320 };
  const _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3057 = { _0: 360, _1: 1320 };
  const _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3058 = { _0: 360, _1: 1320 };
  const _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3059 = { _0: 360, _1: 1320 };
  const _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3060 = { _0: 360, _1: 1320 };
  const _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3061 = { _0: 360, _1: 1320 };
  const _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3062 = { _0: 360, _1: 1320 };
  const _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3063 = { _0: 0, _1: 1440 };
  const _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3064 = { _0: 0, _1: 1440 };
  const _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3065 = { _0: 0, _1: 1440 };
  const _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3066 = { _0: 0, _1: 1440 };
  const _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3067 = { _0: 0, _1: 1440 };
  const _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3068 = { _0: 0, _1: 1440 };
  const _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3069 = { _0: 0, _1: 1440 };
  const _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3070 = { _0: 1020, _1: 1500 };
  const _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3071 = { _0: 1020, _1: 1500 };
  const _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3072 = { _0: 1020, _1: 1500 };
  const _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3073 = { _0: 1020, _1: 1500 };
  const _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3074 = { _0: 1020, _1: 1560 };
  const _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3075 = { _0: 1020, _1: 1560 };
  const _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3076 = { _0: -1, _1: -1 };
  const _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3077 = { _0: 540, _1: 1080 };
  const _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3078 = { _0: -1, _1: -1 };
  const _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3079 = { _0: 540, _1: 1080 };
  const _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3080 = { _0: 540, _1: 1080 };
  const _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3081 = { _0: 540, _1: 1080 };
  const _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3082 = { _0: 540, _1: 1080 };
  const _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3083 = { _0: 600, _1: 960 };
  const _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3084 = { _0: 480, _1: 900 };
  const _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3085 = { _0: 480, _1: 900 };
  const _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3086 = { _0: 480, _1: 900 };
  const _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3087 = { _0: 480, _1: 900 };
  const _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3088 = { _0: 480, _1: 900 };
  const _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3089 = { _0: 540, _1: 960 };
  const _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3090 = { _0: 540, _1: 960 };
  const _M0FP314vlmkit_2dsites4maps4main12hours__table = [[_M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3028, _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3029, _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3030, _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3031, _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3032, _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3033, _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3034], [_M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3035, _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3036, _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3037, _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3038, _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3039, _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3040, _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3041], [_M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3042, _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3043, _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3044, _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3045, _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3046, _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3047, _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3048], [_M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3049, _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3050, _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3051, _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3052, _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3053, _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3054, _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3055], [_M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3056, _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3057, _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3058, _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3059, _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3060, _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3061, _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3062], [_M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3063, _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3064, _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3065, _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3066, _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3067, _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3068, _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3069], [_M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3070, _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3071, _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3072, _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3073, _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3074, _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3075, _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3076], [_M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3077, _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3078, _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3079, _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3080, _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3081, _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3082, _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3083], [_M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3084, _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3085, _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3086, _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3087, _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3088, _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3089, _M0FP314vlmkit_2dsites4maps4main12hours__tableN5tupleS3090]];
  const _M0FP314vlmkit_2dsites4maps4main7streetsN6recordS3091 = new _M0TP314vlmkit_2dsites4maps4main6Street("Westwall Street", 0, true, 200, "");
  const _M0FP314vlmkit_2dsites4maps4main7streetsN6recordS3092 = new _M0TP314vlmkit_2dsites4maps4main6Street("Flint Lane", 1, true, 360, "");
  const _M0FP314vlmkit_2dsites4maps4main7streetsN6recordS3093 = new _M0TP314vlmkit_2dsites4maps4main6Street("Ropewalk", 0, true, 520, "");
  const _M0FP314vlmkit_2dsites4maps4main7streetsN6recordS3094 = new _M0TP314vlmkit_2dsites4maps4main6Street("Cooper Lane", 1, true, 680, "");
  const _M0FP314vlmkit_2dsites4maps4main7streetsN6recordS3095 = new _M0TP314vlmkit_2dsites4maps4main6Street("Chandler Street", 0, true, 840, "");
  const _M0FP314vlmkit_2dsites4maps4main7streetsN6recordS3096 = new _M0TP314vlmkit_2dsites4maps4main6Street("Sail Lane", 1, true, 970, "");
  const _M0FP314vlmkit_2dsites4maps4main7streetsN6recordS3097 = new _M0TP314vlmkit_2dsites4maps4main6Street("Tanner Street", 0, true, 1100, "");
  const _M0FP314vlmkit_2dsites4maps4main7streetsN6recordS3098 = new _M0TP314vlmkit_2dsites4maps4main6Street("Lamplighter Way", 0, true, 1700, "");
  const _M0FP314vlmkit_2dsites4maps4main7streetsN6recordS3099 = new _M0TP314vlmkit_2dsites4maps4main6Street("Net Lane", 1, true, 1850, "");
  const _M0FP314vlmkit_2dsites4maps4main7streetsN6recordS3100 = new _M0TP314vlmkit_2dsites4maps4main6Street("Quay Street", 0, true, 2000, "");
  const _M0FP314vlmkit_2dsites4maps4main7streetsN6recordS3101 = new _M0TP314vlmkit_2dsites4maps4main6Street("Pilot Lane", 1, true, 2150, "");
  const _M0FP314vlmkit_2dsites4maps4main7streetsN6recordS3102 = new _M0TP314vlmkit_2dsites4maps4main6Street("Crown Avenue", 2, true, 2300, "12");
  const _M0FP314vlmkit_2dsites4maps4main7streetsN6recordS3103 = new _M0TP314vlmkit_2dsites4maps4main6Street("Anchor Lane", 1, true, 2450, "");
  const _M0FP314vlmkit_2dsites4maps4main7streetsN6recordS3104 = new _M0TP314vlmkit_2dsites4maps4main6Street("Beacon Street", 0, true, 2600, "");
  const _M0FP314vlmkit_2dsites4maps4main7streetsN6recordS3105 = new _M0TP314vlmkit_2dsites4maps4main6Street("Gull Lane", 1, true, 2750, "");
  const _M0FP314vlmkit_2dsites4maps4main7streetsN6recordS3106 = new _M0TP314vlmkit_2dsites4maps4main6Street("Signal Street", 0, true, 2900, "");
  const _M0FP314vlmkit_2dsites4maps4main7streetsN6recordS3107 = new _M0TP314vlmkit_2dsites4maps4main6Street("Tide Lane", 1, true, 3050, "");
  const _M0FP314vlmkit_2dsites4maps4main7streetsN6recordS3108 = new _M0TP314vlmkit_2dsites4maps4main6Street("Lighthouse Road", 0, true, 3200, "");
  const _M0FP314vlmkit_2dsites4maps4main7streetsN6recordS3109 = new _M0TP314vlmkit_2dsites4maps4main6Street("North Road", 0, false, 200, "");
  const _M0FP314vlmkit_2dsites4maps4main7streetsN6recordS3110 = new _M0TP314vlmkit_2dsites4maps4main6Street("Bell Lane", 1, false, 340, "");
  const _M0FP314vlmkit_2dsites4maps4main7streetsN6recordS3111 = new _M0TP314vlmkit_2dsites4maps4main6Street("Market Street", 0, false, 480, "");
  const _M0FP314vlmkit_2dsites4maps4main7streetsN6recordS3112 = new _M0TP314vlmkit_2dsites4maps4main6Street("Candle Lane", 1, false, 620, "");
  const _M0FP314vlmkit_2dsites4maps4main7streetsN6recordS3113 = new _M0TP314vlmkit_2dsites4maps4main6Street("Guild Street", 0, false, 760, "");
  const _M0FP314vlmkit_2dsites4maps4main7streetsN6recordS3114 = new _M0TP314vlmkit_2dsites4maps4main6Street("Ink Lane", 1, false, 900, "");
  const _M0FP314vlmkit_2dsites4maps4main7streetsN6recordS3115 = new _M0TP314vlmkit_2dsites4maps4main6Street("Harbour Avenue", 2, false, 1040, "7");
  const _M0FP314vlmkit_2dsites4maps4main7streetsN6recordS3116 = new _M0TP314vlmkit_2dsites4maps4main6Street("Oar Lane", 1, false, 1180, "");
  const _M0FP314vlmkit_2dsites4maps4main7streetsN6recordS3117 = new _M0TP314vlmkit_2dsites4maps4main6Street("Mill Street", 0, false, 1320, "");
  const _M0FP314vlmkit_2dsites4maps4main7streetsN6recordS3118 = new _M0TP314vlmkit_2dsites4maps4main6Street("Kiln Lane", 1, false, 1460, "");
  const _M0FP314vlmkit_2dsites4maps4main7streetsN6recordS3119 = new _M0TP314vlmkit_2dsites4maps4main6Street("Foundry Street", 0, false, 1600, "");
  const _M0FP314vlmkit_2dsites4maps4main7streetsN6recordS3120 = new _M0TP314vlmkit_2dsites4maps4main6Street("Rope Lane", 1, false, 1740, "");
  const _M0FP314vlmkit_2dsites4maps4main7streetsN6recordS3121 = new _M0TP314vlmkit_2dsites4maps4main6Street("Dock Street", 0, false, 1880, "");
  const _M0FP314vlmkit_2dsites4maps4main7streetsN6recordS3122 = new _M0TP314vlmkit_2dsites4maps4main6Street("Wharf Street", 0, false, 2160, "");
  const _M0FP314vlmkit_2dsites4maps4main7streets = [_M0FP314vlmkit_2dsites4maps4main7streetsN6recordS3091, _M0FP314vlmkit_2dsites4maps4main7streetsN6recordS3092, _M0FP314vlmkit_2dsites4maps4main7streetsN6recordS3093, _M0FP314vlmkit_2dsites4maps4main7streetsN6recordS3094, _M0FP314vlmkit_2dsites4maps4main7streetsN6recordS3095, _M0FP314vlmkit_2dsites4maps4main7streetsN6recordS3096, _M0FP314vlmkit_2dsites4maps4main7streetsN6recordS3097, _M0FP314vlmkit_2dsites4maps4main7streetsN6recordS3098, _M0FP314vlmkit_2dsites4maps4main7streetsN6recordS3099, _M0FP314vlmkit_2dsites4maps4main7streetsN6recordS3100, _M0FP314vlmkit_2dsites4maps4main7streetsN6recordS3101, _M0FP314vlmkit_2dsites4maps4main7streetsN6recordS3102, _M0FP314vlmkit_2dsites4maps4main7streetsN6recordS3103, _M0FP314vlmkit_2dsites4maps4main7streetsN6recordS3104, _M0FP314vlmkit_2dsites4maps4main7streetsN6recordS3105, _M0FP314vlmkit_2dsites4maps4main7streetsN6recordS3106, _M0FP314vlmkit_2dsites4maps4main7streetsN6recordS3107, _M0FP314vlmkit_2dsites4maps4main7streetsN6recordS3108, _M0FP314vlmkit_2dsites4maps4main7streetsN6recordS3109, _M0FP314vlmkit_2dsites4maps4main7streetsN6recordS3110, _M0FP314vlmkit_2dsites4maps4main7streetsN6recordS3111, _M0FP314vlmkit_2dsites4maps4main7streetsN6recordS3112, _M0FP314vlmkit_2dsites4maps4main7streetsN6recordS3113, _M0FP314vlmkit_2dsites4maps4main7streetsN6recordS3114, _M0FP314vlmkit_2dsites4maps4main7streetsN6recordS3115, _M0FP314vlmkit_2dsites4maps4main7streetsN6recordS3116, _M0FP314vlmkit_2dsites4maps4main7streetsN6recordS3117, _M0FP314vlmkit_2dsites4maps4main7streetsN6recordS3118, _M0FP314vlmkit_2dsites4maps4main7streetsN6recordS3119, _M0FP314vlmkit_2dsites4maps4main7streetsN6recordS3120, _M0FP314vlmkit_2dsites4maps4main7streetsN6recordS3121, _M0FP314vlmkit_2dsites4maps4main7streetsN6recordS3122];
  const _M0FP314vlmkit_2dsites4maps4main11cat__colors = ["#c25400", "#7a4a1e", "#b0306a", "#6b3fb0", "#1f7a3a", "#1a5fb4"];
  const _M0FP314vlmkit_2dsites4maps4main9ic__share = "M8.6 13.3l6.8 3.9M15.4 6.8l-6.8 3.9M18 3.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5M6 9.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5M18 15.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5";
  const _M0FP314vlmkit_2dsites4maps4main11sort__names = ["Most relevant", "Newest", "Highest rating", "Lowest rating"];
  const _M0FP314vlmkit_2dsites4maps4main15review__authors = ["Mara Okafor", "Tomas Lind", "Priya Raman", "Jonah Weller", "Ines Duarte", "Kenji Arai", "Hollis Grant", "Saoirse Byrne", "Amir Haddad", "Lena Vogt", "Rafael Moreno", "Ada Quist"];
  const _M0FP314vlmkit_2dsites4maps4main13review__datesN5tupleS3123 = { _0: "Nov 9, 2026", _1: 20261109 };
  const _M0FP314vlmkit_2dsites4maps4main13review__datesN5tupleS3124 = { _0: "Nov 2, 2026", _1: 20261102 };
  const _M0FP314vlmkit_2dsites4maps4main13review__datesN5tupleS3125 = { _0: "Oct 24, 2026", _1: 20261024 };
  const _M0FP314vlmkit_2dsites4maps4main13review__datesN5tupleS3126 = { _0: "Oct 11, 2026", _1: 20261011 };
  const _M0FP314vlmkit_2dsites4maps4main13review__datesN5tupleS3127 = { _0: "Sep 28, 2026", _1: 20260928 };
  const _M0FP314vlmkit_2dsites4maps4main13review__datesN5tupleS3128 = { _0: "Sep 3, 2026", _1: 20260903 };
  const _M0FP314vlmkit_2dsites4maps4main13review__datesN5tupleS3129 = { _0: "Aug 17, 2026", _1: 20260817 };
  const _M0FP314vlmkit_2dsites4maps4main13review__datesN5tupleS3130 = { _0: "Jul 30, 2026", _1: 20260730 };
  const _M0FP314vlmkit_2dsites4maps4main13review__dates = [_M0FP314vlmkit_2dsites4maps4main13review__datesN5tupleS3123, _M0FP314vlmkit_2dsites4maps4main13review__datesN5tupleS3124, _M0FP314vlmkit_2dsites4maps4main13review__datesN5tupleS3125, _M0FP314vlmkit_2dsites4maps4main13review__datesN5tupleS3126, _M0FP314vlmkit_2dsites4maps4main13review__datesN5tupleS3127, _M0FP314vlmkit_2dsites4maps4main13review__datesN5tupleS3128, _M0FP314vlmkit_2dsites4maps4main13review__datesN5tupleS3129, _M0FP314vlmkit_2dsites4maps4main13review__datesN5tupleS3130];
  const _M0FP314vlmkit_2dsites4maps4main12review__text = [["The fish was perfectly cooked and the staff knew every wine on the list.", "Busy on a Friday, but the wait was worth it. Book ahead.", "Lovely room, slightly loud. The bread alone is worth the trip.", "Portions are generous and the desserts are excellent.", "Service was slow tonight, though the food made up for it.", "A reliable favourite; the specials change every week."], ["Best flat white in Port Lumen, and they remember your order.", "Bright, calm and plenty of seats in the morning.", "Great beans to take home. The pastries sell out by noon.", "A bit pricey, but the coffee is consistently good.", "Friendly baristas and a quiet corner to work in.", "Strong espresso; the oat milk options are good too."], ["Spotless room and a view straight across the harbour.", "Staff sorted out an early check-in without any fuss.", "Thin walls on our floor, otherwise a comfortable stay.", "Breakfast was the highlight: fresh and generous.", "Ideal for the station and the old town alike.", "Beds are comfortable and the lifts are quick."], ["Plan two hours at least. The top floor is the best part.", "Clear labels and a good audio guide for children.", "The temporary exhibition was small but very well made.", "Free on the first Sunday, so it gets crowded then.", "Friendly guides who clearly love the collection.", "The cafe on the ground floor is a nice place to rest."], ["Lovely in the evening, when the lanterns are lit.", "Plenty of benches and a clean playground.", "Good for a run; the loop is about two kilometres.", "Can be muddy after rain, so bring proper shoes.", "The flower beds by the gate are beautiful in spring.", "Quiet early in the morning, busy on weekends."], ["Trains are frequent and the platforms are easy to find.", "Clean station with step-free access to every platform.", "Ticket machines can be slow at rush hour.", "The ferry connection is well signposted.", "Helpful staff at the gate when my card failed.", "A bit draughty in winter, but always on time."]];
  const _M0FP314vlmkit_2dsites4maps4main9ic__check = "M5 12.5l4.5 4.5L19 7.5";
  const _M0FP314vlmkit_2dsites4maps4main8ic__sort = "M4 7h16M7 12h10M10 17h4";
  const _M0FP314vlmkit_2dsites4maps4main9amenities = [["Wheelchair-accessible entrance", "Table service", "Vegetarian options", "Accepts cards"], ["Wheelchair-accessible entrance", "Free Wi-Fi", "Takeaway", "Outdoor seating"], ["Wheelchair-accessible lift", "Free Wi-Fi", "Breakfast available", "24-hour front desk"], ["Step-free access", "Audio guide", "Cafe", "Family friendly"], ["Step-free paths", "Public toilets", "Dogs allowed", "Playground"], ["Step-free platforms", "Ticket machines", "Bicycle parking", "Real-time departures"]];
  const _M0FP314vlmkit_2dsites4maps4main10day__names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const _M0FP314vlmkit_2dsites4maps4main8ic__back = "M19 12H5M11 6l-6 6 6 6";
  const _M0FP314vlmkit_2dsites4maps4main12ic__bookmark = "M7 3.5h10v17l-5-3.6-5 3.6Z";
  const _M0FP314vlmkit_2dsites4maps4main9ic__globe = "M12 3.5a8.5 8.5 0 1 0 0 17a8.5 8.5 0 1 0 0-17M3.5 12h17M12 3.5c2.5 2.4 3.5 5.3 3.5 8.5s-1 6.1-3.5 8.5c-2.5-2.4-3.5-5.3-3.5-8.5s1-6.1 3.5-8.5";
  const _M0FP314vlmkit_2dsites4maps4main10ic__nearby = "M12 3v3M12 18v3M3 12h3M18 12h3M12 7a5 5 0 1 0 0 10a5 5 0 1 0 0-10M12 11a1 1 0 1 0 0 2a1 1 0 1 0 0-2";
  const _M0FP314vlmkit_2dsites4maps4main9ic__phone = "M8 2.5h8a1.5 1.5 0 0 1 1.5 1.5v16a1.5 1.5 0 0 1-1.5 1.5H8A1.5 1.5 0 0 1 6.5 20V4A1.5 1.5 0 0 1 8 2.5ZM11 18h2";
  const _M0FP314vlmkit_2dsites4maps4main8ic__swap = "M7 4v16M3.5 7.5L7 4l3.5 3.5M17 20V4M13.5 16.5L17 20l3.5-3.5";
  const _M0FP314vlmkit_2dsites4maps4main10coast__ptsN5tupleS3131 = { _0: -3000, _1: 2480 };
  const _M0FP314vlmkit_2dsites4maps4main10coast__ptsN5tupleS3132 = { _0: 0, _1: 2480 };
  const _M0FP314vlmkit_2dsites4maps4main10coast__ptsN5tupleS3133 = { _0: 400, _1: 2500 };
  const _M0FP314vlmkit_2dsites4maps4main10coast__ptsN5tupleS3134 = { _0: 800, _1: 2460 };
  const _M0FP314vlmkit_2dsites4maps4main10coast__ptsN5tupleS3135 = { _0: 1200, _1: 2520 };
  const _M0FP314vlmkit_2dsites4maps4main10coast__ptsN5tupleS3136 = { _0: 1500, _1: 2420 };
  const _M0FP314vlmkit_2dsites4maps4main10coast__ptsN5tupleS3137 = { _0: 1700, _1: 2300 };
  const _M0FP314vlmkit_2dsites4maps4main10coast__ptsN5tupleS3138 = { _0: 2100, _1: 2150 };
  const _M0FP314vlmkit_2dsites4maps4main10coast__ptsN5tupleS3139 = { _0: 2500, _1: 2250 };
  const _M0FP314vlmkit_2dsites4maps4main10coast__ptsN5tupleS3140 = { _0: 2800, _1: 2060 };
  const _M0FP314vlmkit_2dsites4maps4main10coast__ptsN5tupleS3141 = { _0: 3100, _1: 1800 };
  const _M0FP314vlmkit_2dsites4maps4main10coast__ptsN5tupleS3142 = { _0: 3400, _1: 1520 };
  const _M0FP314vlmkit_2dsites4maps4main10coast__ptsN5tupleS3143 = { _0: 3700, _1: 1320 };
  const _M0FP314vlmkit_2dsites4maps4main10coast__ptsN5tupleS3144 = { _0: 4000, _1: 1260 };
  const _M0FP314vlmkit_2dsites4maps4main10coast__ptsN5tupleS3145 = { _0: 7000, _1: 1260 };
  const _M0FP314vlmkit_2dsites4maps4main10coast__pts = [_M0FP314vlmkit_2dsites4maps4main10coast__ptsN5tupleS3131, _M0FP314vlmkit_2dsites4maps4main10coast__ptsN5tupleS3132, _M0FP314vlmkit_2dsites4maps4main10coast__ptsN5tupleS3133, _M0FP314vlmkit_2dsites4maps4main10coast__ptsN5tupleS3134, _M0FP314vlmkit_2dsites4maps4main10coast__ptsN5tupleS3135, _M0FP314vlmkit_2dsites4maps4main10coast__ptsN5tupleS3136, _M0FP314vlmkit_2dsites4maps4main10coast__ptsN5tupleS3137, _M0FP314vlmkit_2dsites4maps4main10coast__ptsN5tupleS3138, _M0FP314vlmkit_2dsites4maps4main10coast__ptsN5tupleS3139, _M0FP314vlmkit_2dsites4maps4main10coast__ptsN5tupleS3140, _M0FP314vlmkit_2dsites4maps4main10coast__ptsN5tupleS3141, _M0FP314vlmkit_2dsites4maps4main10coast__ptsN5tupleS3142, _M0FP314vlmkit_2dsites4maps4main10coast__ptsN5tupleS3143, _M0FP314vlmkit_2dsites4maps4main10coast__ptsN5tupleS3144, _M0FP314vlmkit_2dsites4maps4main10coast__ptsN5tupleS3145];
  const _M0FP314vlmkit_2dsites4maps4main7diag__a = { _0: 200, _1: 2160 };
  const _M0FP314vlmkit_2dsites4maps4main7diag__b = { _0: 3200, _1: 360 };
  const _M0FP314vlmkit_2dsites4maps4main5parksN5tupleS3146 = { _0: 534, _1: 1334 };
  const _M0FP314vlmkit_2dsites4maps4main5parksN5tupleS3147 = { _0: 826, _1: 1334 };
  const _M0FP314vlmkit_2dsites4maps4main5parksN5tupleS3148 = { _0: 826, _1: 1586 };
  const _M0FP314vlmkit_2dsites4maps4main5parksN5tupleS3149 = { _0: 534, _1: 1586 };
  const _M0FP314vlmkit_2dsites4maps4main5parksN5tupleS3150 = { _0: 2614, _1: 214 };
  const _M0FP314vlmkit_2dsites4maps4main5parksN5tupleS3151 = { _0: 2886, _1: 214 };
  const _M0FP314vlmkit_2dsites4maps4main5parksN5tupleS3152 = { _0: 2886, _1: 466 };
  const _M0FP314vlmkit_2dsites4maps4main5parksN5tupleS3153 = { _0: 2614, _1: 466 };
  const _M0FP314vlmkit_2dsites4maps4main5parksN5tupleS3154 = { _0: 1864, _1: 1894 };
  const _M0FP314vlmkit_2dsites4maps4main5parksN5tupleS3155 = { _0: 2136, _1: 1894 };
  const _M0FP314vlmkit_2dsites4maps4main5parksN5tupleS3156 = { _0: 2136, _1: 2110 };
  const _M0FP314vlmkit_2dsites4maps4main5parksN5tupleS3157 = { _0: 1864, _1: 2130 };
  const _M0FP314vlmkit_2dsites4maps4main5parksN5tupleS3158 = { _0: 1114, _1: 414 };
  const _M0FP314vlmkit_2dsites4maps4main5parksN5tupleS3159 = { _0: 1300, _1: 414 };
  const _M0FP314vlmkit_2dsites4maps4main5parksN5tupleS3160 = { _0: 1240, _1: 746 };
  const _M0FP314vlmkit_2dsites4maps4main5parksN5tupleS3161 = { _0: 1114, _1: 746 };
  const _M0FP314vlmkit_2dsites4maps4main5parksN5tupleS3162 = { _0: 3064, _1: 214 };
  const _M0FP314vlmkit_2dsites4maps4main5parksN5tupleS3163 = { _0: 3386, _1: 214 };
  const _M0FP314vlmkit_2dsites4maps4main5parksN5tupleS3164 = { _0: 3386, _1: 466 };
  const _M0FP314vlmkit_2dsites4maps4main5parksN5tupleS3165 = { _0: 3064, _1: 466 };
  const _M0FP314vlmkit_2dsites4maps4main5parks = [{ _0: "Lantern Park", _1: [_M0FP314vlmkit_2dsites4maps4main5parksN5tupleS3146, _M0FP314vlmkit_2dsites4maps4main5parksN5tupleS3147, _M0FP314vlmkit_2dsites4maps4main5parksN5tupleS3148, _M0FP314vlmkit_2dsites4maps4main5parksN5tupleS3149] }, { _0: "Ridge Gardens", _1: [_M0FP314vlmkit_2dsites4maps4main5parksN5tupleS3150, _M0FP314vlmkit_2dsites4maps4main5parksN5tupleS3151, _M0FP314vlmkit_2dsites4maps4main5parksN5tupleS3152, _M0FP314vlmkit_2dsites4maps4main5parksN5tupleS3153] }, { _0: "Quay Green", _1: [_M0FP314vlmkit_2dsites4maps4main5parksN5tupleS3154, _M0FP314vlmkit_2dsites4maps4main5parksN5tupleS3155, _M0FP314vlmkit_2dsites4maps4main5parksN5tupleS3156, _M0FP314vlmkit_2dsites4maps4main5parksN5tupleS3157] }, { _0: "Sable Common", _1: [_M0FP314vlmkit_2dsites4maps4main5parksN5tupleS3158, _M0FP314vlmkit_2dsites4maps4main5parksN5tupleS3159, _M0FP314vlmkit_2dsites4maps4main5parksN5tupleS3160, _M0FP314vlmkit_2dsites4maps4main5parksN5tupleS3161] }, { _0: "Crown Hill Park", _1: [_M0FP314vlmkit_2dsites4maps4main5parksN5tupleS3162, _M0FP314vlmkit_2dsites4maps4main5parksN5tupleS3163, _M0FP314vlmkit_2dsites4maps4main5parksN5tupleS3164, _M0FP314vlmkit_2dsites4maps4main5parksN5tupleS3165] }];
  const _M0FP314vlmkit_2dsites4maps4main9rail__ptsN5tupleS3166 = { _0: -3000, _1: 1250 };
  const _M0FP314vlmkit_2dsites4maps4main9rail__ptsN5tupleS3167 = { _0: 0, _1: 1250 };
  const _M0FP314vlmkit_2dsites4maps4main9rail__ptsN5tupleS3168 = { _0: 700, _1: 1250 };
  const _M0FP314vlmkit_2dsites4maps4main9rail__ptsN5tupleS3169 = { _0: 1200, _1: 1150 };
  const _M0FP314vlmkit_2dsites4maps4main9rail__ptsN5tupleS3170 = { _0: 1700, _1: 900 };
  const _M0FP314vlmkit_2dsites4maps4main9rail__ptsN5tupleS3171 = { _0: 2400, _1: 700 };
  const _M0FP314vlmkit_2dsites4maps4main9rail__ptsN5tupleS3172 = { _0: 3300, _1: 650 };
  const _M0FP314vlmkit_2dsites4maps4main9rail__ptsN5tupleS3173 = { _0: 3900, _1: 700 };
  const _M0FP314vlmkit_2dsites4maps4main9rail__ptsN5tupleS3174 = { _0: 7000, _1: 700 };
  const _M0FP314vlmkit_2dsites4maps4main9rail__pts = [_M0FP314vlmkit_2dsites4maps4main9rail__ptsN5tupleS3166, _M0FP314vlmkit_2dsites4maps4main9rail__ptsN5tupleS3167, _M0FP314vlmkit_2dsites4maps4main9rail__ptsN5tupleS3168, _M0FP314vlmkit_2dsites4maps4main9rail__ptsN5tupleS3169, _M0FP314vlmkit_2dsites4maps4main9rail__ptsN5tupleS3170, _M0FP314vlmkit_2dsites4maps4main9rail__ptsN5tupleS3171, _M0FP314vlmkit_2dsites4maps4main9rail__ptsN5tupleS3172, _M0FP314vlmkit_2dsites4maps4main9rail__ptsN5tupleS3173, _M0FP314vlmkit_2dsites4maps4main9rail__ptsN5tupleS3174];
  const _M0FP314vlmkit_2dsites4maps4main10river__ptsN5tupleS3175 = { _0: 1300, _1: -3000 };
  const _M0FP314vlmkit_2dsites4maps4main10river__ptsN5tupleS3176 = { _0: 1300, _1: 0 };
  const _M0FP314vlmkit_2dsites4maps4main10river__ptsN5tupleS3177 = { _0: 1350, _1: 400 };
  const _M0FP314vlmkit_2dsites4maps4main10river__ptsN5tupleS3178 = { _0: 1250, _1: 800 };
  const _M0FP314vlmkit_2dsites4maps4main10river__ptsN5tupleS3179 = { _0: 1450, _1: 1200 };
  const _M0FP314vlmkit_2dsites4maps4main10river__ptsN5tupleS3180 = { _0: 1600, _1: 1600 };
  const _M0FP314vlmkit_2dsites4maps4main10river__ptsN5tupleS3181 = { _0: 1750, _1: 2000 };
  const _M0FP314vlmkit_2dsites4maps4main10river__ptsN5tupleS3182 = { _0: 1900, _1: 2250 };
  const _M0FP314vlmkit_2dsites4maps4main10river__ptsN5tupleS3183 = { _0: 1960, _1: 2400 };
  const _M0FP314vlmkit_2dsites4maps4main10river__pts = [_M0FP314vlmkit_2dsites4maps4main10river__ptsN5tupleS3175, _M0FP314vlmkit_2dsites4maps4main10river__ptsN5tupleS3176, _M0FP314vlmkit_2dsites4maps4main10river__ptsN5tupleS3177, _M0FP314vlmkit_2dsites4maps4main10river__ptsN5tupleS3178, _M0FP314vlmkit_2dsites4maps4main10river__ptsN5tupleS3179, _M0FP314vlmkit_2dsites4maps4main10river__ptsN5tupleS3180, _M0FP314vlmkit_2dsites4maps4main10river__ptsN5tupleS3181, _M0FP314vlmkit_2dsites4maps4main10river__ptsN5tupleS3182, _M0FP314vlmkit_2dsites4maps4main10river__ptsN5tupleS3183];
  const _M0FP314vlmkit_2dsites4maps4main13lumen__avenue = new _M0TP314vlmkit_2dsites4maps4main6Street("Lumen Avenue", 2, false, -1, "1");
  const _M0FP314vlmkit_2dsites4maps4main9ic__saved = "M7 3.5h10v17l-5-3.6-5 3.6Z";
  const _M0FP314vlmkit_2dsites4maps4main14ic__chev__left = "M14.5 6l-6 6 6 6";
  const _M0FP314vlmkit_2dsites4maps4main15ic__chev__right = "M9.5 6l6 6-6 6";
  const _M0FP314vlmkit_2dsites4maps4main9ic__minus = "M5 12h14";
  const _M0FP314vlmkit_2dsites4maps4main8ic__plus = "M12 5v14M5 12h14";
  const _M0FP26mizchi7signals11active__sub = _M0MPC13ref3Ref3RefGRPB5ArrayGRP36mizchi11js__browser3dom4NodeEE(undefined);
  const _M0FP26mizchi7signals5cycle = _M0MPC13ref3Ref3RefGiE(0);
  const _M0FP314vlmkit_2dsites4maps4main12layers__open = _M0FP26mizchi7signals6signalGbE(false);
  const _M0FP314vlmkit_2dsites4maps4main5panel = _M0FP26mizchi7signals6signalGiE(0);
  const _M0FP26mizchi7signals23core__current__cleanups = _M0MPC13ref3Ref3RefGORPB5ArrayGiEE(_M0DTPC16option6OptionGRPB5ArrayGWEuEE4None__);
  const _M0FP26mizchi7signals12batch__depth = _M0MPC13ref3Ref3RefGiE(0);
  const _M0FP26mizchi7signals6queued = _M0MPC15array5Array4makeGORP26mizchi7signals10EffectNodeE(1024, undefined);
  const _M0FP26mizchi7signals13notify__index = _M0MPC13ref3Ref3RefGiE(0);
  const _M0FP26mizchi7signals14queued__length = _M0MPC13ref3Ref3RefGiE(0);
  const _M0FP314vlmkit_2dsites4maps4main6mobile = _M0FP26mizchi7signals6signalGbE(false);
  const _M0FP314vlmkit_2dsites4maps4main9collapsed = _M0FP26mizchi7signals6signalGbE(false);
  const _M0FP314vlmkit_2dsites4maps4main5sheet = _M0FP26mizchi7signals6signalGiE(1);
  const _M0FP314vlmkit_2dsites4maps4main7dir__to = _M0FP26mizchi7signals6signalGiE(-1);
  const _M0FP314vlmkit_2dsites4maps4main12icon_2einnerN6constrS3439 = "0 0 24 24";
  const _M0FP314vlmkit_2dsites4maps4main12icon_2einnerN6constrS3440 = "none";
  const _M0FP314vlmkit_2dsites4maps4main12icon_2einnerN6constrS3441 = "currentColor";
  const _M0FP314vlmkit_2dsites4maps4main12icon_2einnerN6constrS3442 = "round";
  const _M0FP314vlmkit_2dsites4maps4main12icon_2einnerN6constrS3443 = "round";
  const _M0FP314vlmkit_2dsites4maps4main16directions__iconN6constrS3420 = "0 0 24 24";
  const _M0FP314vlmkit_2dsites4maps4main16directions__iconN6constrS3421 = "4.6";
  const _M0FP314vlmkit_2dsites4maps4main16directions__iconN6constrS3422 = "4.6";
  const _M0FP314vlmkit_2dsites4maps4main16directions__iconN6constrS3423 = "14.8";
  const _M0FP314vlmkit_2dsites4maps4main16directions__iconN6constrS3424 = "14.8";
  const _M0FP314vlmkit_2dsites4maps4main16directions__iconN6constrS3425 = "2.5";
  const _M0FP314vlmkit_2dsites4maps4main16directions__iconN6constrS3426 = "currentColor";
  const _M0FP314vlmkit_2dsites4maps4main16directions__iconN6constrS3427 = "none";
  const _M0FP314vlmkit_2dsites4maps4main16directions__iconN6constrS3428 = "#fff";
  const _M0FP314vlmkit_2dsites4maps4main16directions__iconN6constrS3429 = "1.9";
  const _M0FP314vlmkit_2dsites4maps4main16directions__iconN6constrS3430 = "round";
  const _M0FP314vlmkit_2dsites4maps4main16directions__iconN6constrS3431 = "round";
  const _M0FP314vlmkit_2dsites4maps4main8selected = _M0FP26mizchi7signals6signalGiE(-1);
  const _M0FP36mizchi4luna3dom6buttonN6constrS2807 = new _M0DTP36mizchi4luna3dom9AttrValue6Static("true");
  const _M0FP36mizchi4luna3dom6buttonN5tupleS2808 = { _0: "disabled", _1: _M0FP36mizchi4luna3dom6buttonN6constrS2807 };
  const _M0FP314vlmkit_2dsites4maps4main4railN6constrS4421 = "rail";
  const _M0FP314vlmkit_2dsites4maps4main4railN6constrS4422 = "brand";
  const _M0FP314vlmkit_2dsites4maps4main4railN6constrS4423 = "32";
  const _M0FP314vlmkit_2dsites4maps4main4railN6constrS4424 = "32";
  const _M0FP314vlmkit_2dsites4maps4main4railN6constrS4425 = "0 0 32 32";
  const _M0FP314vlmkit_2dsites4maps4main4railN6constrS4426 = "16";
  const _M0FP314vlmkit_2dsites4maps4main4railN6constrS4427 = "16";
  const _M0FP314vlmkit_2dsites4maps4main4railN6constrS4428 = "15";
  const _M0FP314vlmkit_2dsites4maps4main4railN6constrS4429 = "#1a5fb4";
  const _M0FP314vlmkit_2dsites4maps4main4railN6constrS4430 = "M16 6l6 16-6-4-6 4Z";
  const _M0FP314vlmkit_2dsites4maps4main4railN6constrS4431 = "#fff";
  const _M0FP314vlmkit_2dsites4maps4main4railN6constrS4432 = "brand-name";
  const _M0FP314vlmkit_2dsites4maps4main4railN6constrS4433 = "rail-btn";
  const _M0FP314vlmkit_2dsites4maps4main4railN6constrS4434 = "rail-ic";
  const _M0FP314vlmkit_2dsites4maps4main4railN6constrS4435 = "rail-btn";
  const _M0FP314vlmkit_2dsites4maps4main4railN6constrS4436 = "rail-ic";
  const _M0FP314vlmkit_2dsites4maps4main12has__results = _M0FP26mizchi7signals6signalGbE(false);
  const _M0FP314vlmkit_2dsites4maps4main4view = _M0FP26mizchi7signals6signalGRP314vlmkit_2dsites4maps4main4ViewE(_M0FP314vlmkit_2dsites4maps4main10desk__home);
  const _M0FP314vlmkit_2dsites4maps4main5query = _M0FP26mizchi7signals6signalGRP314vlmkit_2dsites4maps4main4ViewE(_M0FP314vlmkit_2dsites4maps4main9no__query);
  const _M0FP314vlmkit_2dsites4maps4main11anim__token = _M0MPC13ref3Ref3RefGiE(0);
  const _M0FP314vlmkit_2dsites4maps4main9animating = _M0FP26mizchi7signals6signalGbE(false);
  const _M0FP314vlmkit_2dsites4maps4main6map__h = _M0FP26mizchi7signals6signalGdE(800);
  const _M0FP314vlmkit_2dsites4maps4main6places = [_M0FP314vlmkit_2dsites4maps4main2mk(0, "Saltline Kitchen", 0, 2075, 1670, 46, 812, 2, 1, "saltline.example", "Seasonal plates from the morning catch."), _M0FP314vlmkit_2dsites4maps4main2mk(1, "The Copper Kettle", 0, 600, 690, 44, 356, 2, 1, "copperkettle.example", "A corner pub kitchen in the old tannery."), _M0FP314vlmkit_2dsites4maps4main2mk(2, "Brine & Barley", 0, 2525, 1810, 45, 498, 3, 2, "brineandbarley.example", "Small plates and a long harbour-view bar."), _M0FP314vlmkit_2dsites4maps4main2mk(3, "Lantern House Grill", 0, 760, 1110, 42, 221, 2, 1, "lanternhouse.example", "Charcoal grill beside the rail arches."), _M0FP314vlmkit_2dsites4maps4main2mk(4, "Osteria Faro", 0, 2825, 1390, 47, 640, 3, 2, "osteriafaro.example", "Handmade pasta under the lighthouse beam."), _M0FP314vlmkit_2dsites4maps4main2mk(5, "Little Tide Noodle Bar", 0, 1925, 1250, 43, 289, 1, 1, "littletide.example", "Hand-pulled noodles, counter seats only."), _M0FP314vlmkit_2dsites4maps4main2mk(6, "Harbourmaster's Table", 0, 2225, 1950, 46, 733, 4, 2, "harbourmasters.example", "Tasting menu in the old customs house."), _M0FP314vlmkit_2dsites4maps4main2mk(7, "Ember & Oak", 0, 440, 830, 41, 167, 3, 2, "emberandoak.example", "Wood-fired dishes and natural wine."), _M0FP314vlmkit_2dsites4maps4main2mk(8, "Pier Nine Oysters", 0, 2675, 2010, 45, 402, 3, 1, "piernine.example", "Oysters and chowder on the quay."), _M0FP314vlmkit_2dsites4maps4main2mk(9, "Lumen Roasters", 1, 1775, 1110, 48, 905, 1, 0, "lumenroasters.example", "Single-origin coffee roasted on site."), _M0FP314vlmkit_2dsites4maps4main2mk(10, "Driftwood Coffee", 1, 2375, 1530, 46, 512, 1, 0, "driftwood.example", "Pour-overs and cardamom buns."), _M0FP314vlmkit_2dsites4maps4main2mk(11, "The Quay Cup", 1, 2075, 1530, 44, 318, 1, 8, "quaycup.example", "Brunch, flat whites and a sunny terrace."), _M0FP314vlmkit_2dsites4maps4main2mk(12, "Beacon Espresso Bar", 1, 2675, 830, 45, 276, 1, 0, "beaconespresso.example", "Standing-room espresso by the market."), _M0FP314vlmkit_2dsites4maps4main2mk(13, "Mill Street Coffee", 1, 440, 1390, 43, 198, 1, 7, "millstreetcoffee.example", "A neighbourhood cafe opposite Lantern Park."), _M0FP314vlmkit_2dsites4maps4main2mk(14, "Gull & Grind", 1, 3125, 1250, 42, 143, 1, 0, "gullandgrind.example", "Coffee for the ferry crowd."), _M0FP314vlmkit_2dsites4maps4main2mk(15, "Sable Coffee Works", 1, 1035, 550, 47, 621, 2, 0, "sablecoffee.example", "Roastery and tasting room by the common."), _M0FP314vlmkit_2dsites4maps4main2mk(16, "Night Owl Espresso", 1, 1925, 1810, 44, 260, 2, 6, "nightowl.example", "Espresso and desserts late into the night."), _M0FP314vlmkit_2dsites4maps4main2mk(17, "The Harbour Light Hotel", 2, 2525, 1530, 45, 1204, 4, 5, "harbourlight.example", "Rooms over the water, with a rooftop bar."), _M0FP314vlmkit_2dsites4maps4main2mk(18, "Crown Hill Inn", 2, 2525, 410, 43, 388, 2, 5, "crownhillinn.example", "A quiet inn on the hill above the market."), _M0FP314vlmkit_2dsites4maps4main2mk(19, "Wayside Rooms", 2, 280, 970, 40, 152, 1, 5, "waysiderooms.example", "Simple rooms at the west gate."), _M0FP314vlmkit_2dsites4maps4main2mk(20, "The Sable Grand", 2, 1520, 960, 46, 977, 4, 5, "sablegrand.example", "A grand hotel on the river bank."), _M0FP314vlmkit_2dsites4maps4main2mk(21, "Quayside Suites", 2, 2825, 1670, 44, 534, 3, 5, "quaysidesuites.example", "Apartments with harbour balconies."), _M0FP314vlmkit_2dsites4maps4main2mk(22, "Eastpoint Lodge", 2, 3300, 1110, 42, 211, 2, 5, "eastpointlodge.example", "Lodge rooms near the east station."), _M0FP314vlmkit_2dsites4maps4main2mk(23, "Port Lumen Maritime Museum", 3, 2375, 1950, 47, 1530, 1, 3, "maritime.example", "Ships, charts and the lighthouse lens."), _M0FP314vlmkit_2dsites4maps4main2mk(24, "Museum of Lamps", 3, 760, 410, 45, 640, 1, 3, "museumoflamps.example", "Three centuries of the city's lights."), _M0FP314vlmkit_2dsites4maps4main2mk(25, "Old Town Guildhall", 3, 905, 830, 44, 422, 1, 7, "guildhall.example", "The guilds' hall, with painted ceilings."), _M0FP314vlmkit_2dsites4maps4main2mk(26, "Lumen Gallery of Modern Art", 3, 2075, 830, 46, 870, 2, 3, "lumengallery.example", "Modern art in a converted power house."), _M0FP314vlmkit_2dsites4maps4main2mk(27, "Railway Heritage Hall", 3, 1250, 1250, 43, 305, 1, 3, "railheritage.example", "Engines and carriages of the harbour line."), _M0FP314vlmkit_2dsites4maps4main2mk(28, "Lantern Park", 4, 680, 1460, 46, 1880, 0, 4, "lanternpark.example", "Lawns, a bandstand and the lantern walk."), _M0FP314vlmkit_2dsites4maps4main2mk(29, "Ridge Gardens", 4, 2750, 340, 45, 760, 0, 4, "ridgegardens.example", "Terraced gardens with a view of the bay."), _M0FP314vlmkit_2dsites4maps4main2mk(30, "Quay Green", 4, 2000, 1990, 44, 512, 0, 4, "quaygreen.example", "A green by the water with a playground."), _M0FP314vlmkit_2dsites4maps4main2mk(31, "Sable Common", 4, 1190, 580, 43, 344, 0, 4, "sablecommon.example", "Meadows along the River Sable."), _M0FP314vlmkit_2dsites4maps4main2mk(32, "Crown Hill Park", 4, 3225, 340, 45, 690, 0, 4, "crownhillpark.example", "Woodland paths on the crown of the hill."), _M0FP314vlmkit_2dsites4maps4main2mk(33, "Westgate Station", 5, 350, 1250, 39, 410, 0, 5, "harbourline.example", "Harbour Line trains, every 10 minutes."), _M0FP314vlmkit_2dsites4maps4main2mk(34, "Mill Cross Station", 5, 950, 1200, 40, 265, 0, 5, "harbourline.example", "Harbour Line trains, every 10 minutes."), _M0FP314vlmkit_2dsites4maps4main2mk(35, "Lumen Central Station", 5, 1700, 900, 42, 2210, 0, 5, "harbourline.example", "The main station, with the ferry shuttle."), _M0FP314vlmkit_2dsites4maps4main2mk(36, "Crown Market Station", 5, 2450, 697, 41, 590, 0, 5, "harbourline.example", "Harbour Line trains, every 10 minutes."), _M0FP314vlmkit_2dsites4maps4main2mk(37, "Eastpoint Station", 5, 3450, 662, 40, 330, 0, 5, "harbourline.example", "End of the Harbour Line."), _M0FP314vlmkit_2dsites4maps4main2mk(38, "Harbour Ferry Terminal", 5, 2300, 2140, 43, 870, 0, 5, "lumenferries.example", "Ferries across Lumen Bay."), _M0FP314vlmkit_2dsites4maps4main2mk(39, "Bay Ferry Pier", 5, 3000, 1830, 41, 240, 0, 5, "lumenferries.example", "The east pier for the bay ferries.")];
  const _M0FP314vlmkit_2dsites4maps4main6map__w = _M0FP26mizchi7signals6signalGdE(1208);
  const _M0MPC16string10StringView4findN6constrS297 = 0;
  const _M0FP314vlmkit_2dsites4maps4main4chip = _M0FP26mizchi7signals6signalGiE(-1);
  const _M0FP314vlmkit_2dsites4maps4main10chips__rowN6constrS3488 = "chip";
  const _M0FP314vlmkit_2dsites4maps4main10chips__rowN6constrS3489 = "chip-icon";
  const _M0FP314vlmkit_2dsites4maps4main10chips__rowN6constrS3490 = "chips";
  const _M0FP314vlmkit_2dsites4maps4main10share__url = _M0FP26mizchi7signals6signalGRP314vlmkit_2dsites4maps4main4ViewE("");
  const _M0FP314vlmkit_2dsites4maps4main6copied = _M0FP26mizchi7signals6signalGbE(false);
  const _M0FP36mizchi4luna3dom5inputN6constrS2830 = new _M0DTP36mizchi4luna3dom9AttrValue6Static("true");
  const _M0FP36mizchi4luna3dom5inputN5tupleS2831 = { _0: "disabled", _1: _M0FP36mizchi4luna3dom5inputN6constrS2830 };
  const _M0FP36mizchi4luna3dom5inputN6constrS2832 = new _M0DTP36mizchi4luna3dom9AttrValue6Static("true");
  const _M0FP36mizchi4luna3dom5inputN5tupleS2833 = { _0: "readonly", _1: _M0FP36mizchi4luna3dom5inputN6constrS2832 };
  const _M0FP36mizchi4luna3dom5inputN6constrS2834 = new _M0DTP36mizchi4luna3dom9AttrValue6Static("true");
  const _M0FP36mizchi4luna3dom5inputN5tupleS2835 = { _0: "required", _1: _M0FP36mizchi4luna3dom5inputN6constrS2834 };
  const _M0FP36mizchi4luna3dom5inputN6constrS2836 = new _M0DTP36mizchi4luna3dom9AttrValue6Static("true");
  const _M0FP36mizchi4luna3dom5inputN5tupleS2837 = { _0: "checked", _1: _M0FP36mizchi4luna3dom5inputN6constrS2836 };
  const _M0FP314vlmkit_2dsites4maps4main9share__el = _M0MPC13ref3Ref3RefGORPB5ArrayGiEE(_M0DTPC16option6OptionGRP26mizchi8js__core3AnyE4None__);
  const _M0FP314vlmkit_2dsites4maps4main13share__dialogN6constrS4555 = new _M0DTP36mizchi4luna3dom9AttrValue6Static("dialog");
  const _M0FP314vlmkit_2dsites4maps4main13share__dialogN5tupleS4556 = { _0: "class", _1: _M0FP314vlmkit_2dsites4maps4main13share__dialogN6constrS4555 };
  const _M0FP314vlmkit_2dsites4maps4main13share__dialogN6constrS4557 = new _M0DTP36mizchi4luna3dom9AttrValue6Static("share-h");
  const _M0FP314vlmkit_2dsites4maps4main13share__dialogN5tupleS4558 = { _0: "aria-labelledby", _1: _M0FP314vlmkit_2dsites4maps4main13share__dialogN6constrS4557 };
  const _M0FP314vlmkit_2dsites4maps4main13share__dialogN6constrS4559 = "share-h";
  const _M0FP314vlmkit_2dsites4maps4main13share__dialogN6constrS4560 = "dialog-sub";
  const _M0FP314vlmkit_2dsites4maps4main13share__dialogN6constrS4561 = "share-link";
  const _M0FP314vlmkit_2dsites4maps4main13share__dialogN6constrS4562 = "field-label";
  const _M0FP314vlmkit_2dsites4maps4main13share__dialogN6constrS4563 = "share-row";
  const _M0FP314vlmkit_2dsites4maps4main13share__dialogN6constrS4564 = "text";
  const _M0FP314vlmkit_2dsites4maps4main13share__dialogN6constrS4565 = true;
  const _M0FP314vlmkit_2dsites4maps4main13share__dialogN6constrS4566 = "share-link";
  const _M0FP314vlmkit_2dsites4maps4main13share__dialogN6constrS4567 = "primary-btn";
  const _M0FP314vlmkit_2dsites4maps4main13share__dialogN6constrS4568 = "dialog-foot";
  const _M0FP314vlmkit_2dsites4maps4main13share__dialogN6constrS4569 = "text-btn";
  const _M0FP314vlmkit_2dsites4maps4main11sheet__drag = _M0FP26mizchi7signals6signalGdE(-1);
  const _M0FP314vlmkit_2dsites4maps4main13map__controlsN6constrS4542 = "controls no-drag";
  const _M0FP314vlmkit_2dsites4maps4main13map__controlsN6constrS4543 = "zoom";
  const _M0FP314vlmkit_2dsites4maps4main13map__controlsN6constrS4544 = "zoom-btn";
  const _M0FP314vlmkit_2dsites4maps4main13map__controlsN6constrS4545 = "zoom-sep";
  const _M0FP314vlmkit_2dsites4maps4main13map__controlsN6constrS4546 = "zoom-btn";
  const _M0FP314vlmkit_2dsites4maps4main12layer__thumbN6constrS4497 = "56";
  const _M0FP314vlmkit_2dsites4maps4main12layer__thumbN6constrS4498 = "56";
  const _M0FP314vlmkit_2dsites4maps4main12layer__thumbN6constrS4499 = "0 0 56 56";
  const _M0FP314vlmkit_2dsites4maps4main12layer__thumbN6constrS4500 = "0";
  const _M0FP314vlmkit_2dsites4maps4main12layer__thumbN6constrS4501 = "0";
  const _M0FP314vlmkit_2dsites4maps4main12layer__thumbN6constrS4502 = "56";
  const _M0FP314vlmkit_2dsites4maps4main12layer__thumbN6constrS4503 = "56";
  const _M0FP314vlmkit_2dsites4maps4main12layer__thumbN6constrS4504 = "#f3f1ec";
  const _M0FP314vlmkit_2dsites4maps4main12layer__thumbN6constrS4505 = "M0 40 Q 20 34 30 42 T 56 30 V 56 H 0 Z";
  const _M0FP314vlmkit_2dsites4maps4main12layer__thumbN6constrS4506 = "6";
  const _M0FP314vlmkit_2dsites4maps4main12layer__thumbN6constrS4507 = "8";
  const _M0FP314vlmkit_2dsites4maps4main12layer__thumbN6constrS4508 = "16";
  const _M0FP314vlmkit_2dsites4maps4main12layer__thumbN6constrS4509 = "12";
  const _M0FP314vlmkit_2dsites4maps4main12layer__thumbN6constrS4510 = "2";
  const _M0FP314vlmkit_2dsites4maps4main12layer__thumbN6constrS4511 = "M0 26 H56 M30 0 V56";
  const _M0FP314vlmkit_2dsites4maps4main12layer__thumbN6constrS4512 = "#fff";
  const _M0FP314vlmkit_2dsites4maps4main12layer__thumbN6constrS4513 = "4";
  const _M0FP314vlmkit_2dsites4maps4main12layer__thumbN6constrS4514 = "M0 14 L56 22";
  const _M0FP314vlmkit_2dsites4maps4main12layer__thumbN6constrS4515 = "#f2c14e";
  const _M0FP314vlmkit_2dsites4maps4main12layer__thumbN6constrS4516 = "4";
  const _M0FP314vlmkit_2dsites4maps4main12layer__thumbN6constrS4517 = "M0 34 L56 8";
  const _M0FP26mizchi7signals19effect__id__counter = _M0MPC13ref3Ref3RefGiE(0);
  const _M0FP314vlmkit_2dsites4maps4main5layer = _M0FP26mizchi7signals6signalGiE(0);
  const _M0FP314vlmkit_2dsites4maps4main15layers__controlN6constrS4522 = "layer-opt";
  const _M0FP314vlmkit_2dsites4maps4main15layers__controlN6constrS4523 = "layers no-drag";
  const _M0FP314vlmkit_2dsites4maps4main15layers__controlN6constrS4524 = "layers-btn";
  const _M0FP314vlmkit_2dsites4maps4main15layers__controlN6constrS4525 = "layers-btn";
  const _M0FP314vlmkit_2dsites4maps4main15layers__controlN6constrS4526 = "layers-thumb";
  const _M0FP314vlmkit_2dsites4maps4main15layers__controlN6constrS4527 = "layers-label";
  const _M0FP314vlmkit_2dsites4maps4main15layers__controlN6constrS4528 = "layers-pop";
  const _M0FP314vlmkit_2dsites4maps4main9dir__from = _M0FP26mizchi7signals6signalGiE(-1);
  const _M0FP314vlmkit_2dsites4maps4main5route = _M0FP26mizchi7signals4memoGORP314vlmkit_2dsites4maps4main5RouteE(() => {
    const a = _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4maps4main9dir__from);
    const b = _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4maps4main7dir__to);
    if (a < 0 || (b < 0 || a === b)) {
      return undefined;
    }
    const _bind = _M0FP314vlmkit_2dsites4maps4main6routes.length;
    let _tmp = 0;
    while (true) {
      const _ = _tmp;
      if (_ < _bind) {
        const r = _M0FP314vlmkit_2dsites4maps4main6routes[_];
        const _ra = r._0;
        const _rb = r._1;
        const _pts = r._2;
        const _steps = r._3;
        if (_ra === a && _rb === b) {
          return new _M0TP314vlmkit_2dsites4maps4main5Route(_pts, _steps, false, _M0FP314vlmkit_2dsites4maps4main13route__length(_pts));
        }
        if (_ra === b && _rb === a) {
          const rev = _M0MPC15array5Array4copyGUddEE(_pts);
          _M0MPC15array5Array14rev__in__placeGUddEE(rev);
          const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(14);
          _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, "Head out from ");
          _M0MPB13StringBuilder13write__objectGsE(_string_builder, _M0MPC15array5Array2atGUsiEE(_M0FP314vlmkit_2dsites4maps4main6places, a).name);
          const _tmp$2 = _string_builder.val;
          const _string_builder$2 = _M0MPB13StringBuilder21StringBuilder_2einner(10);
          _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$2, "Arrive at ");
          _M0MPB13StringBuilder13write__objectGsE(_string_builder$2, _M0MPC15array5Array2atGUsiEE(_M0FP314vlmkit_2dsites4maps4main6places, b).name);
          return new _M0TP314vlmkit_2dsites4maps4main5Route(rev, [_tmp$2, "Follow the same streets back, in reverse", _string_builder$2.val], false, _M0FP314vlmkit_2dsites4maps4main13route__length(_pts));
        }
        _tmp = _ + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    const pa = _M0MPC15array5Array2atGUsiEE(_M0FP314vlmkit_2dsites4maps4main6places, a);
    const pb = _M0MPC15array5Array2atGUsiEE(_M0FP314vlmkit_2dsites4maps4main6places, b);
    const pts = [{ _0: pa.x, _1: pa.y }, { _0: pb.x, _1: pb.y }];
    const l = _M0FP314vlmkit_2dsites4maps4main13route__length(pts);
    const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(11);
    _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, "Head ");
    _M0MPB13StringBuilder13write__objectGsE(_string_builder, _M0FP314vlmkit_2dsites4maps4main7compass(pb.x - pa.x, pb.y - pa.y));
    _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, " from ");
    _M0MPB13StringBuilder13write__objectGsE(_string_builder, pa.name);
    const _tmp$2 = _string_builder.val;
    const _string_builder$2 = _M0MPB13StringBuilder21StringBuilder_2einner(19);
    _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$2, "Continue for about ");
    _M0MPB13StringBuilder13write__objectGsE(_string_builder$2, _M0FP314vlmkit_2dsites4maps4main11dist__label(l * 1.3));
    const _tmp$3 = _string_builder$2.val;
    const _string_builder$3 = _M0MPB13StringBuilder21StringBuilder_2einner(10);
    _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$3, "Arrive at ");
    _M0MPB13StringBuilder13write__objectGsE(_string_builder$3, pb.name);
    return new _M0TP314vlmkit_2dsites4maps4main5Route(pts, [_tmp$2, _tmp$3, _string_builder$3.val], true, l * 1.3);
  });
  const _M0FP314vlmkit_2dsites4maps4main7land__dN5tupleS4089 = { _0: 7000, _1: -3000 };
  const _M0FP314vlmkit_2dsites4maps4main7land__dN5tupleS4090 = { _0: -3000, _1: -3000 };
  const _M0FP314vlmkit_2dsites4maps4main12world__layerN6constrS4096 = "none";
  const _M0FP314vlmkit_2dsites4maps4main12world__layerN6constrS4097 = "none";
  const _M0FP314vlmkit_2dsites4maps4main12world__layerN6constrS4098 = "none";
  const _M0FP314vlmkit_2dsites4maps4main12world__layerN6constrS4099 = "none";
  const _M0FP314vlmkit_2dsites4maps4main12world__layerN6constrS4100 = "none";
  const _M0FP314vlmkit_2dsites4maps4main12world__layerN6constrS4101 = "none";
  const _M0FP314vlmkit_2dsites4maps4main11drag__moved = _M0MPC13ref3Ref3RefGdE(0);
  const _M0FP314vlmkit_2dsites4maps4main5level = _M0FP46mizchi4luna2js8resource8memo__eqGiE(() => {
    const z = _M0MP26mizchi7signals6Signal3getGRP314vlmkit_2dsites4maps4main4ViewE(_M0FP314vlmkit_2dsites4maps4main4view).z;
    const l = _M0MPC16double6Double7to__int(_M0MPC16double6Double5floor(z + 0.001));
    return l < 1 ? 1 : l > 6 ? 6 : l;
  });
  const _M0FP314vlmkit_2dsites4maps4main8clusters = _M0FP26mizchi7signals4memoGRP314vlmkit_2dsites4maps4main8ClustersE(() => {
    const lv = _M0FP314vlmkit_2dsites4maps4main5level();
    _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4maps4main4chip);
    const sel = _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4maps4main8selected);
    const n = _M0FP314vlmkit_2dsites4maps4main6places.length;
    const leader = _M0MPC15array5Array4makeGiE(n, -1);
    const count = _M0MPC15array5Array4makeGiE(n, 0);
    const cxs = _M0MPC15array5Array4makeGdE(n, 0);
    const cys = _M0MPC15array5Array4makeGdE(n, 0);
    const thr = 52 / _M0FP314vlmkit_2dsites4maps4main9scale__of(lv + 0);
    const _bind = _M0FP314vlmkit_2dsites4maps4main6places.length;
    let _tmp = 0;
    while (true) {
      const _ = _tmp;
      if (_ < _bind) {
        const p = _M0FP314vlmkit_2dsites4maps4main6places[_];
        if (_M0FP314vlmkit_2dsites4maps4main4kept(p) && (lv >= 3 || p.id === sel)) {
          _M0MPC15array5Array3setGiE(leader, p.id, p.id);
          _M0MPC15array5Array3setGiE(count, p.id, 1);
          _M0MPC15array5Array3setGdE(cxs, p.id, p.x);
          _M0MPC15array5Array3setGdE(cys, p.id, p.y);
        }
        _tmp = _ + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    if (lv < 3) {
      const _bind$2 = _M0FP314vlmkit_2dsites4maps4main6places.length;
      let _tmp$2 = 0;
      while (true) {
        const _ = _tmp$2;
        if (_ < _bind$2) {
          const p = _M0FP314vlmkit_2dsites4maps4main6places[_];
          _L: {
            if (!_M0FP314vlmkit_2dsites4maps4main4kept(p) || (p.id === sel || _M0MPC15array5Array2atGiE(leader, p.id) >= 0)) {
              break _L;
            }
            _M0MPC15array5Array3setGiE(leader, p.id, p.id);
            let k = 1;
            let ax = p.x;
            let ay = p.y;
            const _bind$3 = _M0FP314vlmkit_2dsites4maps4main6places.length;
            let _tmp$3 = 0;
            while (true) {
              const _$2 = _tmp$3;
              if (_$2 < _bind$3) {
                const q = _M0FP314vlmkit_2dsites4maps4main6places[_$2];
                if (q.id !== p.id && (_M0FP314vlmkit_2dsites4maps4main4kept(q) && (q.id !== sel && (_M0MPC15array5Array2atGiE(leader, q.id) < 0 && _M0FP314vlmkit_2dsites4maps4main11world__dist(p.x, p.y, q.x, q.y) < thr)))) {
                  _M0MPC15array5Array3setGiE(leader, q.id, p.id);
                  k = k + 1 | 0;
                  ax = ax + q.x;
                  ay = ay + q.y;
                }
                _tmp$3 = _$2 + 1 | 0;
                continue;
              } else {
                break;
              }
            }
            _M0MPC15array5Array3setGiE(count, p.id, k);
            _M0MPC15array5Array3setGdE(cxs, p.id, ax / (k + 0));
            _M0MPC15array5Array3setGdE(cys, p.id, ay / (k + 0));
            break _L;
          }
          _tmp$2 = _ + 1 | 0;
          continue;
        } else {
          break;
        }
      }
    }
    return new _M0TP314vlmkit_2dsites4maps4main8Clusters(leader, count, cxs, cys);
  });
  const _M0FP314vlmkit_2dsites4maps4main7map__el = _M0MPC13ref3Ref3RefGORPB5ArrayGiEE(_M0DTPC16option6OptionGRP26mizchi8js__core3AnyE4None__);
  const _M0FP314vlmkit_2dsites4maps4main10route__endN5tupleS4224 = { _0: "0", _1: "0" };
  const _M0FP314vlmkit_2dsites4maps4main7xs__all = _M0FP314vlmkit_2dsites4maps4main8grid__xs();
  const _M0FP314vlmkit_2dsites4maps4main7ys__all = _M0FP314vlmkit_2dsites4maps4main8grid__ys();
  const _M0FP314vlmkit_2dsites4maps4main13street__labelN5tupleS4154 = { _0: false, _1: 0, _2: 0, _3: 0 };
  const _M0FP314vlmkit_2dsites4maps4main11label__textN6constrS4184 = "middle";
  const _M0FP314vlmkit_2dsites4maps4main11label__textN6constrS4185 = "central";
  const _M0FP314vlmkit_2dsites4maps4main7shieldsN5tupleS4204 = { _0: "7", _1: 520, _2: 1040 };
  const _M0FP314vlmkit_2dsites4maps4main7shieldsN5tupleS4205 = { _0: "7", _1: 2000, _2: 1040 };
  const _M0FP314vlmkit_2dsites4maps4main7shieldsN5tupleS4206 = { _0: "7", _1: 3400, _2: 1040 };
  const _M0FP314vlmkit_2dsites4maps4main7shieldsN5tupleS4207 = { _0: "12", _1: 2300, _2: 300 };
  const _M0FP314vlmkit_2dsites4maps4main7shieldsN5tupleS4208 = { _0: "12", _1: 2300, _2: 1320 };
  const _M0FP314vlmkit_2dsites4maps4main7shieldsN5tupleS4209 = { _0: "1", _1: 420, _2: 2028 };
  const _M0FP314vlmkit_2dsites4maps4main7shieldsN5tupleS4210 = { _0: "1", _1: 2500, _2: 780 };
  const _M0FP314vlmkit_2dsites4maps4main7shieldsN6constrS4211 = "-8";
  const _M0FP314vlmkit_2dsites4maps4main7shieldsN6constrS4212 = "16";
  const _M0FP314vlmkit_2dsites4maps4main7shieldsN6constrS4213 = "4";
  const _M0FP314vlmkit_2dsites4maps4main7shieldsN6constrS4214 = "0.5";
  const _M0FP314vlmkit_2dsites4maps4main7shieldsN6constrS4215 = "middle";
  const _M0FP314vlmkit_2dsites4maps4main7shieldsN6constrS4216 = "central";
  const _M0FP314vlmkit_2dsites4maps4main13labels__layerN6constrS4230 = "middle";
  const _M0FP314vlmkit_2dsites4maps4main13labels__layerN6constrS4231 = "central";
  const _M0FP314vlmkit_2dsites4maps4main13labels__layerN6constrS4232 = "7";
  const _M0FP314vlmkit_2dsites4maps4main13labels__layerN6constrS4233 = "-46";
  const _M0FP314vlmkit_2dsites4maps4main13labels__layerN6constrS4234 = "-12";
  const _M0FP314vlmkit_2dsites4maps4main13labels__layerN6constrS4235 = "92";
  const _M0FP314vlmkit_2dsites4maps4main13labels__layerN6constrS4236 = "24";
  const _M0FP314vlmkit_2dsites4maps4main13labels__layerN6constrS4237 = "12";
  const _M0FP314vlmkit_2dsites4maps4main13labels__layerN6constrS4238 = "0.5";
  const _M0FP314vlmkit_2dsites4maps4main13labels__layerN6constrS4239 = "middle";
  const _M0FP314vlmkit_2dsites4maps4main13labels__layerN6constrS4240 = "central";
  const _M0FP314vlmkit_2dsites4maps4main13labels__layerN6constrS4241 = "100%";
  const _M0FP314vlmkit_2dsites4maps4main13labels__layerN6constrS4242 = "100%";
  const _M0FP314vlmkit_2dsites4maps4main10drag__lastN5tupleS3184 = { _0: 0, _1: 0 };
  const _M0FP314vlmkit_2dsites4maps4main10drag__last = _M0MPC13ref3Ref3RefGORPB5ArrayGiEE(_M0FP314vlmkit_2dsites4maps4main10drag__lastN5tupleS3184);
  const _M0FP314vlmkit_2dsites4maps4main8dragging = _M0FP26mizchi7signals6signalGbE(false);
  const _M0FP314vlmkit_2dsites4maps4main10map__localN5tupleS4351 = { _0: 0, _1: 0 };
  const _M0FP314vlmkit_2dsites4maps4main8drag__on = _M0MPC13ref3Ref3RefGbE(false);
  const _M0FP314vlmkit_2dsites4maps4main8pin__svgN6constrS4314 = "30";
  const _M0FP314vlmkit_2dsites4maps4main8pin__svgN6constrS4315 = "38";
  const _M0FP314vlmkit_2dsites4maps4main8pin__svgN6constrS4316 = "0 0 30 38";
  const _M0FP314vlmkit_2dsites4maps4main8pin__svgN6constrS4317 = "M15 37s-12.5-12.1-12.5-22a12.5 12.5 0 0 1 25 0c0 9.9-12.5 22-12.5 22Z";
  const _M0FP314vlmkit_2dsites4maps4main8pin__svgN6constrS4318 = "#fff";
  const _M0FP314vlmkit_2dsites4maps4main8pin__svgN6constrS4319 = "2";
  const _M0FP314vlmkit_2dsites4maps4main8pin__svgN6constrS4320 = "translate(7.6 7.4) scale(0.62)";
  const _M0FP314vlmkit_2dsites4maps4main8pin__svgN6constrS4321 = "none";
  const _M0FP314vlmkit_2dsites4maps4main8pin__svgN6constrS4322 = "#fff";
  const _M0FP314vlmkit_2dsites4maps4main8pin__svgN6constrS4323 = "2.4";
  const _M0FP314vlmkit_2dsites4maps4main8pin__svgN6constrS4324 = "round";
  const _M0FP314vlmkit_2dsites4maps4main8pin__svgN6constrS4325 = "round";
  const _M0FP314vlmkit_2dsites4maps4main12open__statusN5tupleS3512 = { _0: true, _1: "Open 24 hours" };
  const _M0FP314vlmkit_2dsites4maps4main12open__statusN5tupleS3513 = { _0: false, _1: "Closed" };
  const _M0FP314vlmkit_2dsites4maps4main3hot = _M0FP26mizchi7signals6signalGiE(-1);
  const _M0FP314vlmkit_2dsites4maps4main10place__tab = _M0FP26mizchi7signals6signalGiE(0);
  const _M0FP314vlmkit_2dsites4maps4main10sort__open = _M0FP26mizchi7signals6signalGbE(false);
  const _M0FP314vlmkit_2dsites4maps4main11pin__buttonN6constrS4327 = "pin-card";
  const _M0FP314vlmkit_2dsites4maps4main11pin__buttonN6constrS4328 = "pin-card-name";
  const _M0FP314vlmkit_2dsites4maps4main11pin__buttonN6constrS4329 = "pin-card-meta";
  const _M0FP314vlmkit_2dsites4maps4main11pin__buttonN6constrS4330 = "pin-card-rest";
  const _M0FP314vlmkit_2dsites4maps4main9map__viewN6constrS4360 = "map";
  const _M0FP314vlmkit_2dsites4maps4main9map__viewN6constrS4361 = "map-help";
  const _M0FP314vlmkit_2dsites4maps4main9map__viewN6constrS4362 = "sr-only";
  const _M0FP314vlmkit_2dsites4maps4main9map__viewN6constrS4363 = "100%";
  const _M0FP314vlmkit_2dsites4maps4main9map__viewN6constrS4364 = "100%";
  const _M0FP314vlmkit_2dsites4maps4main9map__viewN6constrS4365 = "pins";
  const _M0FP314vlmkit_2dsites4maps4main9foot__barN6constrS4549 = "footbar no-drag";
  const _M0FP314vlmkit_2dsites4maps4main9foot__barN6constrS4550 = "attrib";
  const _M0FP314vlmkit_2dsites4maps4main9foot__barN6constrS4551 = "scale";
  const _M0FP314vlmkit_2dsites4maps4main9foot__barN6constrS4552 = "scale-text";
  const _M0FP314vlmkit_2dsites4maps4main9foot__barN6constrS4553 = "scale-bar";
  const _M0MPC16string6String4trimN6recordS476 = new _M0TPC16string10StringView("\t\n\r ", 0, 4);
  const _M0FP314vlmkit_2dsites4maps4main12search__text = _M0FP26mizchi7signals6signalGRP314vlmkit_2dsites4maps4main4ViewE("");
  const _M0FP314vlmkit_2dsites4maps4main14search__active = _M0FP26mizchi7signals6signalGiE(-1);
  const _M0FP314vlmkit_2dsites4maps4main12search__open = _M0FP26mizchi7signals6signalGbE(false);
  const _M0FP314vlmkit_2dsites4maps4main10search__el = _M0MPC13ref3Ref3RefGORPB5ArrayGiEE(_M0DTPC16option6OptionGRP26mizchi8js__core3AnyE4None__);
  const _M0FP314vlmkit_2dsites4maps4main11suggestions = _M0FP26mizchi7signals4memoGORP314vlmkit_2dsites4maps4main5RouteE(() => {
    const t = _M0MPC16string6String9to__lower(_M0MPC16string10StringView9to__owned(_M0MPC16string6String4trim(_M0MP26mizchi7signals6Signal3getGRP314vlmkit_2dsites4maps4main4ViewE(_M0FP314vlmkit_2dsites4maps4main12search__text), undefined)));
    if (t === "") {
      const _p = new Array(_M0FP314vlmkit_2dsites4maps4main16recent__searches.length);
      const _p$2 = _M0FP314vlmkit_2dsites4maps4main16recent__searches.length;
      let _tmp = 0;
      while (true) {
        const _p$3 = _tmp;
        if (_p$3 < _p$2) {
          const _p$4 = _M0FP314vlmkit_2dsites4maps4main16recent__searches[_p$3];
          _p[_p$3] = new _M0DTP314vlmkit_2dsites4maps4main4Sugg7SRecent(_p$4);
          _tmp = _p$3 + 1 | 0;
          continue;
        } else {
          break;
        }
      }
      return _p;
    }
    const out = [];
    const _bind = _M0FP314vlmkit_2dsites4maps4main10cat__names.length;
    let _tmp = 0;
    while (true) {
      const c = _tmp;
      if (c < _bind) {
        const n = _M0FP314vlmkit_2dsites4maps4main10cat__names[c];
        const ln = _M0MPC16string6String9to__lower(n);
        if (_M0MPC16string6String11has__prefix(ln, new _M0TPC16string10StringView(t, 0, t.length)) || _M0MPC16string6String11has__prefix(_M0MPC16string6String9to__lower(_M0MPC15array5Array2atGUsiEE(_M0FP314vlmkit_2dsites4maps4main13cat__singular, c)), new _M0TPC16string10StringView(t, 0, t.length))) {
          _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(out, new _M0DTP314vlmkit_2dsites4maps4main4Sugg4SCat(c));
          _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(out, new _M0DTP314vlmkit_2dsites4maps4main4Sugg5SNear(c, _M0FP314vlmkit_2dsites4maps4main16area__near__view()));
        }
        _tmp = c + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    const _bind$2 = _M0FP314vlmkit_2dsites4maps4main5areas.length;
    let _tmp$2 = 0;
    while (true) {
      const i = _tmp$2;
      if (i < _bind$2) {
        const a = _M0FP314vlmkit_2dsites4maps4main5areas[i];
        if (_M0MPC16string6String8contains(_M0MPC16string6String9to__lower(a._0), new _M0TPC16string10StringView(t, 0, t.length))) {
          _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(out, new _M0DTP314vlmkit_2dsites4maps4main4Sugg5SArea(i));
        }
        _tmp$2 = i + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    const _bind$3 = _M0FP314vlmkit_2dsites4maps4main6places.length;
    let _tmp$3 = 0;
    while (true) {
      const _ = _tmp$3;
      if (_ < _bind$3) {
        const p = _M0FP314vlmkit_2dsites4maps4main6places[_];
        if (out.length < 8 && _M0MPC16string6String8contains(_M0MPC16string6String9to__lower(p.name), new _M0TPC16string10StringView(t, 0, t.length))) {
          _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(out, new _M0DTP314vlmkit_2dsites4maps4main4Sugg6SPlace(p.id));
        }
        _tmp$3 = _ + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return out;
  });
  const _M0FP314vlmkit_2dsites4maps4main11search__boxN6constrS3447 = "search";
  const _M0FP314vlmkit_2dsites4maps4main11search__boxN6constrS3448 = "q-label";
  const _M0FP314vlmkit_2dsites4maps4main11search__boxN6constrS3449 = "text";
  const _M0FP314vlmkit_2dsites4maps4main11search__boxN6constrS3450 = "q";
  const _M0FP314vlmkit_2dsites4maps4main11search__boxN6constrS3451 = "icon-btn clear-btn";
  const _M0FP314vlmkit_2dsites4maps4main11search__boxN6constrS3452 = "icon-btn search-btn";
  const _M0FP314vlmkit_2dsites4maps4main11search__boxN6constrS3453 = "icon-btn dir-btn";
  const _M0FP314vlmkit_2dsites4maps4main11search__boxN6constrS3454 = "sugg";
  const _M0FP314vlmkit_2dsites4maps4main11search__boxN6constrS3455 = "q-recent";
  const _M0FP314vlmkit_2dsites4maps4main11search__boxN6constrS3456 = "sugg-head";
  const _M0FP314vlmkit_2dsites4maps4main11search__boxN6constrS3457 = "q-list";
  const _M0FP314vlmkit_2dsites4maps4main11search__boxN6constrS3458 = "opt-icon";
  const _M0FP314vlmkit_2dsites4maps4main11search__boxN6constrS3459 = "18";
  const _M0FP314vlmkit_2dsites4maps4main11search__boxN6constrS3460 = "18";
  const _M0FP314vlmkit_2dsites4maps4main11search__boxN6constrS3461 = "0 0 24 24";
  const _M0FP314vlmkit_2dsites4maps4main11search__boxN6constrS3462 = "none";
  const _M0FP314vlmkit_2dsites4maps4main11search__boxN6constrS3463 = "currentColor";
  const _M0FP314vlmkit_2dsites4maps4main11search__boxN6constrS3464 = "2";
  const _M0FP314vlmkit_2dsites4maps4main11search__boxN6constrS3465 = "round";
  const _M0FP314vlmkit_2dsites4maps4main11search__boxN6constrS3466 = "round";
  const _M0FP314vlmkit_2dsites4maps4main11search__boxN6constrS3467 = "opt-text";
  const _M0FP314vlmkit_2dsites4maps4main11search__boxN6constrS3468 = "opt-main";
  const _M0FP314vlmkit_2dsites4maps4main11search__boxN6constrS3469 = "opt-sub";
  const _M0FP314vlmkit_2dsites4maps4main11search__boxN6constrS3470 = "sugg-empty";
  const _M0FP314vlmkit_2dsites4maps4main7tablistN6constrS3669 = "tab-name";
  const _M0FP314vlmkit_2dsites4maps4main7tablistN6constrS3670 = "tab-sub";
  const _M0FP314vlmkit_2dsites4maps4main7tablistN6constrS3671 = "tabs";
  const _M0FP314vlmkit_2dsites4maps4main5saved = _M0FP26mizchi7signals6signalGRPB5ArrayGiEE([]);
  const _M0FP314vlmkit_2dsites4maps4main12review__sort = _M0FP26mizchi7signals6signalGiE(0);
  const _M0FP314vlmkit_2dsites4maps4main10place__artN6constrS3547 = "0";
  const _M0FP314vlmkit_2dsites4maps4main10place__artN6constrS3548 = "0";
  const _M0FP314vlmkit_2dsites4maps4main10place__artN6constrS3549 = "#fff8e0";
  const _M0FP314vlmkit_2dsites4maps4main10place__artN6constrS3550 = "#9fcf8f";
  const _M0FP314vlmkit_2dsites4maps4main10place__artN6constrS3551 = "4";
  const _M0FP314vlmkit_2dsites4maps4main10place__artN6constrS3552 = "#6b4f33";
  const _M0FP314vlmkit_2dsites4maps4main10place__artN6constrS3553 = "0";
  const _M0FP314vlmkit_2dsites4maps4main10place__artN6constrS3554 = "#c9cdd2";
  const _M0FP314vlmkit_2dsites4maps4main10place__artN6constrS3555 = "#e9ecef";
  const _M0FP314vlmkit_2dsites4maps4main10place__artN6constrS3556 = "#8b939c";
  const _M0FP314vlmkit_2dsites4maps4main10place__artN6constrS3557 = "2";
  const _M0FP314vlmkit_2dsites4maps4main10place__artN6constrS3558 = "6";
  const _M0FP314vlmkit_2dsites4maps4main10place__artN6constrS3559 = "2";
  const _M0FP314vlmkit_2dsites4maps4main10place__artN6constrS3560 = "#dbe8f7";
  const _M0FP314vlmkit_2dsites4maps4main10place__artN6constrS3561 = "0";
  const _M0FP314vlmkit_2dsites4maps4main10place__artN6constrS3562 = "#d8d2c8";
  const _M0FP314vlmkit_2dsites4maps4main10place__artN6constrS3563 = "0";
  const _M0FP314vlmkit_2dsites4maps4main10place__artN6constrS3564 = "3";
  const _M0FP314vlmkit_2dsites4maps4main10place__artN6constrS3565 = "#6b4f33";
  const _M0FP314vlmkit_2dsites4maps4main10place__artN6constrS3566 = "#4c9a5e";
  const _M0FP314vlmkit_2dsites4maps4main10place__artN6constrS3567 = "2";
  const _M0FP314vlmkit_2dsites4maps4main10place__artN6constrS3568 = "#4a4f55";
  const _M0FP314vlmkit_2dsites4maps4main10place__artN6constrS3569 = "3";
  const _M0FP314vlmkit_2dsites4maps4main10place__artN6constrS3570 = "#ffd769";
  const _M0FP314vlmkit_2dsites4maps4main10place__artN6constrS3571 = "#d9d0c1";
  const _M0FP314vlmkit_2dsites4maps4main10place__artN6constrS3572 = "1.5";
  const _M0FP314vlmkit_2dsites4maps4main10place__artN6constrS3573 = "#b9cfe0";
  const _M0FP314vlmkit_2dsites4maps4main10place__artN6constrS3574 = "#6d5a48";
  const _M0FP314vlmkit_2dsites4maps4main20filled__icon_2einnerN6constrS3753 = "0 0 24 24";
  const _M0FP314vlmkit_2dsites4maps4main20filled__icon_2einnerN6constrS3754 = "currentColor";
  const _M0FP314vlmkit_2dsites4maps4main5starsN6constrS3497 = "stars";
  const _M0FP314vlmkit_2dsites4maps4main5toast = _M0FP26mizchi7signals6signalGRP314vlmkit_2dsites4maps4main4ViewE("");
  const _M0FP314vlmkit_2dsites4maps4main13round__actionN6constrS3658 = "act";
  const _M0FP314vlmkit_2dsites4maps4main13round__actionN6constrS3659 = "act-circle";
  const _M0FP314vlmkit_2dsites4maps4main13round__actionN6constrS3660 = "act-label";
  const _M0FP314vlmkit_2dsites4maps4main10sort__menuN6constrS3727 = "menu-item";
  const _M0FP314vlmkit_2dsites4maps4main10sort__menuN6constrS3728 = "menu-check";
  const _M0FP314vlmkit_2dsites4maps4main10sort__menuN6constrS3729 = "sort";
  const _M0FP314vlmkit_2dsites4maps4main10sort__menuN6constrS3730 = "sort-btn";
  const _M0FP314vlmkit_2dsites4maps4main10sort__menuN6constrS3731 = "pill-btn";
  const _M0FP314vlmkit_2dsites4maps4main10sort__menuN6constrS3732 = "pill-sub";
  const _M0FP314vlmkit_2dsites4maps4main10sort__menuN6constrS3733 = "sort-menu";
  const _M0FP314vlmkit_2dsites4maps4main11place__viewN6constrS3765 = new _M0DTP36mizchi4luna3dom9AttrValue6Static("today");
  const _M0FP314vlmkit_2dsites4maps4main11place__viewN5tupleS3766 = { _0: "class", _1: _M0FP314vlmkit_2dsites4maps4main11place__viewN6constrS3765 };
  const _M0FP314vlmkit_2dsites4maps4main11place__viewN6constrS3767 = new _M0DTP36mizchi4luna3dom9AttrValue6Static("row");
  const _M0FP314vlmkit_2dsites4maps4main11place__viewN5tupleS3768 = { _0: "scope", _1: _M0FP314vlmkit_2dsites4maps4main11place__viewN6constrS3767 };
  const _M0FP314vlmkit_2dsites4maps4main11place__viewN6constrS3769 = "place";
  const _M0FP314vlmkit_2dsites4maps4main11place__viewN6constrS3770 = "place-hero";
  const _M0FP314vlmkit_2dsites4maps4main11place__viewN6constrS3771 = "back-btn";
  const _M0FP314vlmkit_2dsites4maps4main11place__viewN6constrS3772 = "place-head";
  const _M0FP314vlmkit_2dsites4maps4main11place__viewN6constrS3773 = "place-h";
  const _M0FP314vlmkit_2dsites4maps4main11place__viewN6constrS3774 = "place-rating";
  const _M0FP314vlmkit_2dsites4maps4main11place__viewN6constrS3775 = "row-count";
  const _M0FP314vlmkit_2dsites4maps4main11place__viewN6constrS3776 = "place-cat";
  const _M0FP314vlmkit_2dsites4maps4main11place__viewN6constrS3777 = "actions";
  const _M0FP314vlmkit_2dsites4maps4main11place__viewN6constrS3778 = "facts";
  const _M0FP314vlmkit_2dsites4maps4main11place__viewN6constrS3779 = "fact-hours";
  const _M0FP314vlmkit_2dsites4maps4main11place__viewN6constrS3780 = "status-big";
  const _M0FP314vlmkit_2dsites4maps4main11place__viewN6constrS3781 = new _M0DTP36mizchi4luna3dom9AttrValue6Static("hours");
  const _M0FP314vlmkit_2dsites4maps4main11place__viewN5tupleS3782 = { _0: "class", _1: _M0FP314vlmkit_2dsites4maps4main11place__viewN6constrS3781 };
  const _M0FP314vlmkit_2dsites4maps4main11place__viewN6constrS3783 = new _M0DTP36mizchi4luna3dom9AttrValue6Static("sr-only");
  const _M0FP314vlmkit_2dsites4maps4main11place__viewN5tupleS3784 = { _0: "class", _1: _M0FP314vlmkit_2dsites4maps4main11place__viewN6constrS3783 };
  const _M0FP314vlmkit_2dsites4maps4main11place__viewN6constrS3785 = "site-link";
  const _M0FP314vlmkit_2dsites4maps4main11place__viewN6constrS3786 = "reviews-head";
  const _M0FP314vlmkit_2dsites4maps4main11place__viewN6constrS3787 = "reviews-score";
  const _M0FP314vlmkit_2dsites4maps4main11place__viewN6constrS3788 = "big-num";
  const _M0FP314vlmkit_2dsites4maps4main11place__viewN6constrS3789 = "row-count";
  const _M0FP314vlmkit_2dsites4maps4main11place__viewN6constrS3790 = "reviews";
  const _M0FP314vlmkit_2dsites4maps4main11place__viewN6constrS3791 = "review";
  const _M0FP314vlmkit_2dsites4maps4main11place__viewN6constrS3792 = "avatar";
  const _M0FP314vlmkit_2dsites4maps4main11place__viewN6constrS3793 = 1;
  const _M0FP314vlmkit_2dsites4maps4main11place__viewN6constrS3794 = "rev-author";
  const _M0FP314vlmkit_2dsites4maps4main11place__viewN6constrS3795 = "rev-meta";
  const _M0FP314vlmkit_2dsites4maps4main11place__viewN6constrS3796 = "sr-only";
  const _M0FP314vlmkit_2dsites4maps4main11place__viewN6constrS3797 = "rev-text";
  const _M0FP314vlmkit_2dsites4maps4main11place__viewN6constrS3798 = "about-blurb";
  const _M0FP314vlmkit_2dsites4maps4main11place__viewN6constrS3799 = "amenities";
  const _M0FP314vlmkit_2dsites4maps4main12place__fieldN6constrS3829 = "field";
  const _M0FP314vlmkit_2dsites4maps4main12place__fieldN6constrS3830 = "field-label";
  const _M0FP314vlmkit_2dsites4maps4main12place__fieldN6constrS3831 = "text";
  const _M0FP314vlmkit_2dsites4maps4main12place__fieldN6constrS3832 = "opt-main";
  const _M0FP314vlmkit_2dsites4maps4main12place__fieldN6constrS3833 = "opt-sub";
  const _M0FP314vlmkit_2dsites4maps4main6to__el = _M0MPC13ref3Ref3RefGORPB5ArrayGiEE(_M0DTPC16option6OptionGRP26mizchi8js__core3AnyE4None__);
  const _M0FP314vlmkit_2dsites4maps4main9dir__mode = _M0FP26mizchi7signals6signalGiE(0);
  const _M0FP314vlmkit_2dsites4maps4main8from__el = _M0MPC13ref3Ref3RefGORPB5ArrayGiEE(_M0DTPC16option6OptionGRP26mizchi8js__core3AnyE4None__);
  const _M0FP314vlmkit_2dsites4maps4main16directions__viewN6constrS3891 = "dir";
  const _M0FP314vlmkit_2dsites4maps4main16directions__viewN6constrS3892 = "dir-head";
  const _M0FP314vlmkit_2dsites4maps4main16directions__viewN6constrS3893 = "dir-h";
  const _M0FP314vlmkit_2dsites4maps4main16directions__viewN6constrS3894 = "icon-btn";
  const _M0FP314vlmkit_2dsites4maps4main16directions__viewN6constrS3895 = "dir-fields";
  const _M0FP314vlmkit_2dsites4maps4main16directions__viewN6constrS3896 = "dir-inputs";
  const _M0FP314vlmkit_2dsites4maps4main16directions__viewN6constrS3897 = "icon-btn swap-btn";
  const _M0FP314vlmkit_2dsites4maps4main16directions__viewN6constrS3898 = "mode-panel";
  const _M0FP314vlmkit_2dsites4maps4main16directions__viewN6constrS3899 = "dir-hint";
  const _M0FP314vlmkit_2dsites4maps4main16directions__viewN6constrS3900 = "dir-try";
  const _M0FP314vlmkit_2dsites4maps4main16directions__viewN6constrS3901 = "dir-presets";
  const _M0FP314vlmkit_2dsites4maps4main16directions__viewN6constrS3902 = "link-btn";
  const _M0FP314vlmkit_2dsites4maps4main16directions__viewN6constrS3903 = "dir-result";
  const _M0FP314vlmkit_2dsites4maps4main16directions__viewN6constrS3904 = "dir-summary";
  const _M0FP314vlmkit_2dsites4maps4main16directions__viewN6constrS3905 = "badge";
  const _M0FP314vlmkit_2dsites4maps4main16directions__viewN6constrS3906 = "dir-note";
  const _M0FP314vlmkit_2dsites4maps4main16directions__viewN6constrS3907 = "steps";
  const _M0FP314vlmkit_2dsites4maps4main11sheet__down = _M0MPC13ref3Ref3RefGbE(false);
  const _M0FP314vlmkit_2dsites4maps4main12sheet__startN5tupleS3185 = { _0: 0, _1: 0 };
  const _M0FP314vlmkit_2dsites4maps4main12sheet__start = _M0MPC13ref3Ref3RefGORPB5ArrayGiEE(_M0FP314vlmkit_2dsites4maps4main12sheet__startN5tupleS3185);
  const _M0FP314vlmkit_2dsites4maps4main12sheet__moved = _M0MPC13ref3Ref3RefGbE(false);
  const _M0FP314vlmkit_2dsites4maps4main11follow__map = _M0FP26mizchi7signals6signalGbE(false);
  const _M0FP314vlmkit_2dsites4maps4main7results = _M0FP46mizchi4luna2js8resource8memo__eqGRPB5ArrayGiEE(() => {
    const q = _M0MP26mizchi7signals6Signal3getGRP314vlmkit_2dsites4maps4main4ViewE(_M0FP314vlmkit_2dsites4maps4main5query);
    const follow = _M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4maps4main11follow__map);
    const out = [];
    const _bind = _M0FP314vlmkit_2dsites4maps4main6places.length;
    let _tmp = 0;
    while (true) {
      const _ = _tmp;
      if (_ < _bind) {
        const p = _M0FP314vlmkit_2dsites4maps4main6places[_];
        const ok = (q.cat < 0 || p.cat === q.cat) && (q.cat >= 0 || _M0FP314vlmkit_2dsites4maps4main13matches__text(p, q.text));
        if (ok && (!follow || _M0FP314vlmkit_2dsites4maps4main10on__screen(p))) {
          _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(out, p);
        }
        _tmp = _ + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    if (q.near) {
      _M0MPC15array5Array8sort__byGRP314vlmkit_2dsites4maps4main6ReviewE(out, (a, b) => {
        const da = _M0FP314vlmkit_2dsites4maps4main11world__dist(a.x, a.y, q.nx, q.ny);
        const db = _M0FP314vlmkit_2dsites4maps4main11world__dist(b.x, b.y, q.nx, q.ny);
        return da < db ? -1 : da > db ? 1 : 0;
      });
    } else {
      _M0MPC15array5Array8sort__byGRP314vlmkit_2dsites4maps4main6ReviewE(out, (a, b) => b.rating - a.rating | 0);
    }
    const _p = new Array(out.length);
    const _p$2 = out.length;
    let _tmp$2 = 0;
    while (true) {
      const _p$3 = _tmp$2;
      if (_p$3 < _p$2) {
        const _p$4 = out[_p$3];
        _p[_p$3] = _p$4.id;
        _tmp$2 = _p$3 + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return _p;
  });
  const _M0FP314vlmkit_2dsites4maps4main13sheet__handleN6constrS4443 = "sheet-handle";
  const _M0FP314vlmkit_2dsites4maps4main13sheet__handleN6constrS4444 = "grabber";
  const _M0FP314vlmkit_2dsites4maps4main13sheet__handleN6constrS4445 = "sheet-title";
  const _M0FP314vlmkit_2dsites4maps4main12status__lineN6constrS3527 = "status";
  const _M0FP314vlmkit_2dsites4maps4main11result__rowN6constrS3619 = "row-item";
  const _M0FP314vlmkit_2dsites4maps4main11result__rowN6constrS3620 = "row";
  const _M0FP314vlmkit_2dsites4maps4main11result__rowN6constrS3621 = "row-text";
  const _M0FP314vlmkit_2dsites4maps4main11result__rowN6constrS3622 = "row-name";
  const _M0FP314vlmkit_2dsites4maps4main11result__rowN6constrS3623 = "row-rating";
  const _M0FP314vlmkit_2dsites4maps4main11result__rowN6constrS3624 = "row-count";
  const _M0FP314vlmkit_2dsites4maps4main11result__rowN6constrS3625 = "row-meta";
  const _M0FP314vlmkit_2dsites4maps4main11result__rowN6constrS3626 = "row-photo";
  const _M0FP314vlmkit_2dsites4maps4main13results__viewN6constrS3641 = "results";
  const _M0FP314vlmkit_2dsites4maps4main13results__viewN6constrS3642 = "results-head";
  const _M0FP314vlmkit_2dsites4maps4main13results__viewN6constrS3643 = "results-h";
  const _M0FP314vlmkit_2dsites4maps4main13results__viewN6constrS3644 = "link-btn";
  const _M0FP314vlmkit_2dsites4maps4main13results__viewN6constrS3645 = "results-sub";
  const _M0FP314vlmkit_2dsites4maps4main13results__viewN6constrS3646 = "rows";
  const _M0FP314vlmkit_2dsites4maps4main13results__viewN6constrS3647 = "empty";
  const _M0FP314vlmkit_2dsites4maps4main11saved__viewN6constrS3949 = "results";
  const _M0FP314vlmkit_2dsites4maps4main11saved__viewN6constrS3950 = "results-head";
  const _M0FP314vlmkit_2dsites4maps4main11saved__viewN6constrS3951 = "saved-h";
  const _M0FP314vlmkit_2dsites4maps4main11saved__viewN6constrS3952 = "empty";
  const _M0FP314vlmkit_2dsites4maps4main11saved__viewN6constrS3953 = "rows";
  const _M0FP314vlmkit_2dsites4maps4main11side__panelN6constrS4470 = "panel";
  const _M0FP314vlmkit_2dsites4maps4main11side__panelN6constrS4471 = "panel-scroll";
  const _M0FP314vlmkit_2dsites4maps4main11side__panelN6constrS4472 = "panel-scroll";
  const _M0FP314vlmkit_2dsites4maps4main11side__panelN6constrS4473 = "panel-foot";
  const _M0FP314vlmkit_2dsites4maps4main11side__panelN6constrS4474 = "follow";
  const _M0FP314vlmkit_2dsites4maps4main11side__panelN6constrS4475 = "checkbox";
  const _M0FP314vlmkit_2dsites4maps4main11side__panelN6constrS4476 = "follow";
  const _M0FP314vlmkit_2dsites4maps4main11side__panelN6constrS4477 = "collapse-tab";
  const _M0FP314vlmkit_2dsites4maps4main11side__panelN6constrS4478 = "tab-chev";
  const _M0FP314vlmkit_2dsites4maps4main11side__panelN6constrS4479 = "18";
  const _M0FP314vlmkit_2dsites4maps4main11side__panelN6constrS4480 = "18";
  const _M0FP314vlmkit_2dsites4maps4main11side__panelN6constrS4481 = "0 0 24 24";
  const _M0FP314vlmkit_2dsites4maps4main11side__panelN6constrS4482 = "none";
  const _M0FP314vlmkit_2dsites4maps4main11side__panelN6constrS4483 = "currentColor";
  const _M0FP314vlmkit_2dsites4maps4main11side__panelN6constrS4484 = "2.2";
  const _M0FP314vlmkit_2dsites4maps4main11side__panelN6constrS4485 = "round";
  const _M0FP314vlmkit_2dsites4maps4main11side__panelN6constrS4486 = "round";
  const _M0FP314vlmkit_2dsites4maps4main11side__panelN6constrS4487 = "tab-tip";
  const _M0FP314vlmkit_2dsites4maps4main11toast__viewN6constrS4577 = "toast-wrap";
  const _M0FP314vlmkit_2dsites4maps4main11toast__viewN6constrS4578 = "toast";
  const _M0FP314vlmkit_2dsites4maps4main11toast__viewN6constrS4579 = "toast-close";
  const _M0FP314vlmkit_2dsites4maps4main3appN6constrS4581 = "map-wrap";
  const _M0FP314vlmkit_2dsites4maps4main3appN6constrS4582 = "sr-only";
  const _M0FP314vlmkit_2dsites4maps4main3appN6constrS4583 = "topbar";
  const _M0FP314vlmkit_2dsites4maps4main9read__urlN6recordS4595 = new _M0TPC16string10StringView(",", 0, 1);
  const _M0FP314vlmkit_2dsites4maps4main9read__urlN6recordS4596 = new _M0TPC16string10StringView("-", 0, 1);
  function _M0MPC16string10StringView12unsafe__view(self, start, end) {
    return new _M0TPC16string10StringView(self.str, self.start + start | 0, self.start + end | 0);
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
  function _M0FPB32code__point__of__surrogate__pair(leading, trailing) {
    return (((Math.imul(leading - 55296 | 0, 1024) | 0) + trailing | 0) - 56320 | 0) + 65536 | 0;
  }
  function _M0MPC16string6String16unsafe__char__at(self, index) {
    const c1 = self.charCodeAt(index);
    if (c1 >= 55296 && c1 <= 56319) {
      const c2 = self.charCodeAt(index + 1 | 0);
      return _M0FPB32code__point__of__surrogate__pair(c1, c2);
    } else {
      return c1;
    }
  }
  function _M0IP016_24default__implPB2Eq10not__equalGRPB5ArrayGiEE(x, y) {
    return !_M0IPC15array5ArrayPB2Eq5equalGiE(x, y);
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
        let _tmp;
        const _p = self.charCodeAt(start);
        if (_p >= 56320 && _p <= 57343) {
          const _p$2 = self.charCodeAt(start - 1 | 0);
          _tmp = _p$2 >= 55296 && _p$2 <= 56319;
        } else {
          _tmp = false;
        }
        if (_tmp) {
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
          let _tmp;
          const _p = self.charCodeAt(_e);
          if (_p >= 56320 && _p <= 57343) {
            const _p$2 = self.charCodeAt(_e - 1 | 0);
            _tmp = _p$2 >= 55296 && _p$2 <= 56319;
          } else {
            _tmp = false;
          }
          if (_tmp) {
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
  function _M0IP016_24default__implPB4Show10to__stringGRP36mizchi4luna3dom4AttrE(self) {
    const logger = _M0MPB13StringBuilder21StringBuilder_2einner(8);
    _M0IP36mizchi4luna3dom4AttrPB4Show6output(self, { self: logger, method_table: _M0FP092moonbitlang_2fcore_2fbuiltin_2fStringBuilder_24as_24_40moonbitlang_2fcore_2fbuiltin_2eLogger });
    return logger.val;
  }
  function _M0MPB4Iter4nextGRPC16string10StringViewE(self) {
    const _func = self.f;
    const result = _func();
    const _bind = self.size_hint;
    if (result === undefined) {
      self.size_hint = _M0MPB4Iter4nextN6constrS62GRPC16string10StringViewE;
    } else {
      if (_bind === undefined) {
      } else {
        const _Some = _bind;
        const _n = _Some;
        self.size_hint = _n > 0 ? _n - 1 | 0 : _M0MPB4Iter4nextN6constrS61GRPC16string10StringViewE;
      }
    }
    return result;
  }
  function _M0MPB4Iter4nextGcE(self) {
    const _func = self.f;
    const result = _func();
    const _bind = self.size_hint;
    if (result === -1) {
      self.size_hint = _M0MPB4Iter4nextN6constrS78GcE;
    } else {
      if (_bind === undefined) {
      } else {
        const _Some = _bind;
        const _n = _Some;
        self.size_hint = _n > 0 ? _n - 1 | 0 : _M0MPB4Iter4nextN6constrS77GcE;
      }
    }
    return result;
  }
  function _M0MPB4Iter4nextGiE(self) {
    const _func = self.f;
    const result = _func();
    const _bind = self.size_hint;
    if (result === undefined) {
      self.size_hint = _M0MPB4Iter4nextN6constrS94GiE;
    } else {
      if (_bind === undefined) {
      } else {
        const _Some = _bind;
        const _n = _Some;
        self.size_hint = _n > 0 ? _n - 1 | 0 : _M0MPB4Iter4nextN6constrS93GiE;
      }
    }
    return result;
  }
  function _M0MPC13int3Int18to__string_2einner(self, radix) {
    return _M0FPB19int__to__string__js(self, radix);
  }
  function _M0MPB4Iter3newGRPC16string10StringViewE(f, size_hint) {
    let size_hint$2;
    if (size_hint === undefined) {
      size_hint$2 = undefined;
    } else {
      const _Some = size_hint;
      const _n = _Some;
      size_hint$2 = _n > 0 ? _n : _M0MPB4Iter3newN6constrS119GRPC16string10StringViewE;
    }
    return new _M0TPB4IterGRPC16string10StringViewE(f, size_hint$2);
  }
  function _M0MPB4Iter3newGcE(f, size_hint) {
    let size_hint$2;
    if (size_hint === undefined) {
      size_hint$2 = undefined;
    } else {
      const _Some = size_hint;
      const _n = _Some;
      size_hint$2 = _n > 0 ? _n : _M0MPB4Iter3newN6constrS131GcE;
    }
    return new _M0TPB4IterGcE(f, size_hint$2);
  }
  function _M0MPB4Iter3newGiE(f, size_hint) {
    let size_hint$2;
    if (size_hint === undefined) {
      size_hint$2 = undefined;
    } else {
      const _Some = size_hint;
      const _n = _Some;
      size_hint$2 = _n > 0 ? _n : _M0MPB4Iter3newN6constrS143GiE;
    }
    return new _M0TPB4IterGiE(f, size_hint$2);
  }
  function _M0MPC16string10StringView9to__owned(self) {
    return self.str.substring(self.start, self.end);
  }
  function _M0MPC16string10StringView4iter(self) {
    const start = self.start;
    const end = self.end;
    const index = new _M0TPB8MutLocalGiE(start);
    return _M0MPB4Iter3newGcE(() => {
      if (index.val < end) {
        const c1 = self.str.charCodeAt(index.val);
        if (c1 >= 55296 && c1 <= 56319 && (index.val + 1 | 0) < self.end) {
          const c2 = self.str.charCodeAt(index.val + 1 | 0);
          if (c2 >= 56320 && c2 <= 57343) {
            index.val = index.val + 2 | 0;
            return _M0FPB32code__point__of__surrogate__pair(c1, c2);
          }
        }
        index.val = index.val + 1 | 0;
        return c1;
      } else {
        return -1;
      }
    }, undefined);
  }
  function _M0MPC16string6String20unsafe__range__equal(self, start, other, other_start, len) {
    let _tmp = 0;
    while (true) {
      const i = _tmp;
      if (i < len) {
        if (self.charCodeAt(start + i | 0) === other.charCodeAt(other_start + i | 0)) {
        } else {
          return false;
        }
        _tmp = i + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return true;
  }
  function _M0MPC16string6String31offset__of__nth__char__backward(self, n, start_offset, end_offset) {
    let _tmp = end_offset;
    let _tmp$2 = 0;
    while (true) {
      const utf16_offset = _tmp;
      const char_count = _tmp$2;
      if ((utf16_offset - 1 | 0) >= start_offset && char_count < n) {
        const c = self.charCodeAt(utf16_offset - 1 | 0);
        if (c >= 56320 && c <= 57343) {
          _tmp = utf16_offset - 2 | 0;
          _tmp$2 = char_count + 1 | 0;
          continue;
        } else {
          _tmp = utf16_offset - 1 | 0;
          _tmp$2 = char_count + 1 | 0;
          continue;
        }
      } else {
        return char_count < n || utf16_offset < start_offset ? undefined : utf16_offset;
      }
    }
  }
  function _M0MPC16string6String30offset__of__nth__char__forward(self, n, start_offset, end_offset) {
    if (start_offset >= 0 && start_offset <= end_offset) {
      let _tmp = start_offset;
      let _tmp$2 = 0;
      while (true) {
        const utf16_offset = _tmp;
        const char_count = _tmp$2;
        if (utf16_offset < end_offset && char_count < n) {
          const c = self.charCodeAt(utf16_offset);
          if (c >= 55296 && c <= 56319) {
            _tmp = utf16_offset + 2 | 0;
            _tmp$2 = char_count + 1 | 0;
            continue;
          } else {
            _tmp = utf16_offset + 1 | 0;
            _tmp$2 = char_count + 1 | 0;
            continue;
          }
        } else {
          return char_count < n || utf16_offset >= end_offset ? undefined : utf16_offset;
        }
      }
    } else {
      console.error("Invalid start index");
      return $panic();
    }
  }
  function _M0MPC16string6String29offset__of__nth__char_2einner(self, i, start_offset, end_offset) {
    let end_offset$2;
    if (end_offset === undefined) {
      end_offset$2 = self.length;
    } else {
      const _Some = end_offset;
      end_offset$2 = _Some;
    }
    return i >= 0 ? _M0MPC16string6String30offset__of__nth__char__forward(self, i, start_offset, end_offset$2) : _M0MPC16string6String31offset__of__nth__char__backward(self, -i | 0, start_offset, end_offset$2);
  }
  function _M0IPB13StringBuilderPB6Logger11write__view(self, str) {
    self.val = `${self.val}${_M0MPC16string10StringView9to__owned(str)}`;
  }
  function _M0FPB24find__code__unit__scalar(data, start, end, code) {
    let _tmp = start;
    while (true) {
      const pos = _tmp;
      if (pos < end) {
        if (data.charCodeAt(pos) === code) {
          return pos;
        }
        _tmp = pos + 1 | 0;
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
    let _tmp = 1;
    while (true) {
      const i = _tmp;
      if (i < m) {
        const c = pattern.str.charCodeAt(pattern.start + i | 0);
        while (true) {
          if (k > 0 && c !== pattern.str.charCodeAt(pattern.start + k | 0)) {
            const _tmp$2 = k - 1 | 0;
            k = _tmp$2 >>> 0 < table.length ? table[_tmp$2] : $oob();
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
        _tmp = i + 1 | 0;
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
    let _tmp = start;
    while (true) {
      const i = _tmp;
      if (i < n) {
        const c = target.str.charCodeAt(target.start + i | 0);
        while (true) {
          if (k > 0 && c !== pattern.str.charCodeAt(pattern.start + k | 0)) {
            const _tmp$2 = k - 1 | 0;
            k = _tmp$2 >>> 0 < table.length ? table[_tmp$2] : $oob();
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
        _tmp = i + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return undefined;
  }
  function _M0FPB36find__two__anchor__candidate__scalar(data, start, candidate_end, first, last_offset, last) {
    let _tmp = start;
    while (true) {
      const pos = _tmp;
      if (pos < candidate_end) {
        if (data.charCodeAt(pos) === first && data.charCodeAt(pos + last_offset | 0) === last) {
          return pos;
        }
        _tmp = pos + 1 | 0;
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
    let _tmp = 0;
    while (true) {
      const i = _tmp;
      if (i < length) {
        if (left.charCodeAt(left_start + i | 0) !== right.charCodeAt(right_start + i | 0)) {
          return false;
        }
        _tmp = i + 1 | 0;
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
    let _tmp = target_start;
    let _tmp$2 = 0;
    while (true) {
      const pos = _tmp;
      const failures = _tmp$2;
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
        _tmp = found + 1 | 0;
        _tmp$2 = failures$2;
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
        return _M0MPC16string10StringView4findN6constrS297;
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
  function _M0MPC16string6String8find__by(self, pred) {
    const _p = new _M0TPC16string10StringView(self, 0, self.length);
    const _p$2 = _p.str;
    const _p$3 = _p.start;
    const _p$4 = _p.end;
    let _tmp = _p$3;
    let _tmp$2 = 0;
    while (true) {
      const _p$5 = _tmp;
      const _p$6 = _tmp$2;
      if (_p$5 < _p$4) {
        let _p$7;
        let _p$8;
        _L: {
          const _p$9 = _p$2.charCodeAt(_p$5);
          if (_p$9 >= 55296 && _p$9 <= 56319 && (_p$5 + 1 | 0) < _p$4) {
            const _p$10 = _p$2.charCodeAt(_p$5 + 1 | 0);
            if (_p$10 >= 56320 && _p$10 <= 57343) {
              const _tmp$3 = _p$5 + 2 | 0;
              const _p$11 = (((Math.imul(_p$9 - 55296 | 0, 1024) | 0) + _p$10 | 0) - 56320 | 0) + 65536 | 0;
              _p$7 = _tmp$3;
              _p$8 = _p$11;
              break _L;
            } else {
              const _tmp$3 = _p$5 + 1 | 0;
              const _p$11 = _p$9;
              _p$7 = _tmp$3;
              _p$8 = _p$11;
              break _L;
            }
          } else {
            const _tmp$3 = _p$5 + 1 | 0;
            const _p$10 = _p$9;
            _p$7 = _tmp$3;
            _p$8 = _p$10;
            break _L;
          }
        }
        if (pred(_p$8)) {
          return _p$6;
        }
        _tmp = _p$7;
        const _p$9 = _p$8;
        _tmp$2 = _p$6 + (_p$9 <= 65535 ? 1 : 2) | 0;
        continue;
      } else {
        return undefined;
      }
    }
  }
  function _M0MPC16string10StringView11has__prefix(self, str) {
    const str_len = str.end - str.start | 0;
    return str_len <= (self.end - self.start | 0) ? (str_len === 0 || self.str.charCodeAt(self.start) === str.str.charCodeAt(str.start) ? _M0MPC16string6String20unsafe__range__equal(self.str, self.start, str.str, str.start, str_len) : false) : false;
  }
  function _M0MPC16string6String11has__prefix(self, str) {
    return _M0MPC16string10StringView11has__prefix(new _M0TPC16string10StringView(self, 0, self.length), str);
  }
  function _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(self, value) {
    _M0MPB7JSArray4push(self, value);
  }
  function _M0MPC15array5Array4pushGiE(self, value) {
    _M0MPB7JSArray4push(self, value);
  }
  function _M0MPC15array5Array4pushGdE(self, value) {
    _M0MPB7JSArray4push(self, value);
  }
  function _M0MPC15array5Array4pushGRP36mizchi11js__browser3dom4NodeE(self, value) {
    _M0MPB7JSArray4push(self, value);
  }
  function _M0FPB36string__contains__code__unit__scalar(str, start, end, code) {
    let _tmp = start;
    while (true) {
      const i = _tmp;
      if (i < end) {
        if (str.charCodeAt(i) === code) {
          return true;
        }
        _tmp = i + 1 | 0;
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
    const _bind = str.end - str.start | 0;
    switch (_bind) {
      case 0: {
        return true;
      }
      case 1: {
        return _M0MPC16string10StringView20contains__code__unit(self, str.str.charCodeAt(str.start));
      }
      default: {
        const _bind$2 = _M0MPC16string10StringView4find(self, str);
        return !(_bind$2 === undefined);
      }
    }
  }
  function _M0MPC16string6String8contains(self, str) {
    return _M0MPC16string10StringView8contains(new _M0TPC16string10StringView(self, 0, self.length), str);
  }
  function _M0FPB23build__ascii__char__set(chars) {
    let bits0 = 0;
    let bits1 = 0;
    let bits2 = 0;
    let bits3 = 0;
    const _bind = chars.str;
    const _bind$2 = chars.start;
    const _bind$3 = chars.end;
    let _tmp = _bind$2;
    while (true) {
      const _string_index = _tmp;
      if (_string_index < _bind$3) {
        let _decoded_next_string_index;
        let _decoded_char;
        _L: {
          const _bind$4 = _bind.charCodeAt(_string_index);
          if (_bind$4 >= 55296 && _bind$4 <= 56319 && (_string_index + 1 | 0) < _bind$3) {
            const _bind$5 = _bind.charCodeAt(_string_index + 1 | 0);
            if (_bind$5 >= 56320 && _bind$5 <= 57343) {
              const _tmp$2 = _string_index + 2 | 0;
              const _p = (((Math.imul(_bind$4 - 55296 | 0, 1024) | 0) + _bind$5 | 0) - 56320 | 0) + 65536 | 0;
              _decoded_next_string_index = _tmp$2;
              _decoded_char = _p;
              break _L;
            } else {
              const _tmp$2 = _string_index + 1 | 0;
              const _p = _bind$4;
              _decoded_next_string_index = _tmp$2;
              _decoded_char = _p;
              break _L;
            }
          } else {
            const _tmp$2 = _string_index + 1 | 0;
            const _p = _bind$4;
            _decoded_next_string_index = _tmp$2;
            _decoded_char = _p;
            break _L;
          }
        }
        const code = _decoded_char;
        if (code >>> 0 < 128 >>> 0) {
          const bit = 1 << (code & 31);
          const _bind$4 = code >>> 5 | 0;
          switch (_bind$4) {
            case 0: {
              bits0 = bits0 | bit;
              break;
            }
            case 1: {
              bits1 = bits1 | bit;
              break;
            }
            case 2: {
              bits2 = bits2 | bit;
              break;
            }
            default: {
              bits3 = bits3 | bit;
            }
          }
        } else {
          return undefined;
        }
        _tmp = _decoded_next_string_index;
        continue;
      } else {
        break;
      }
    }
    return { _0: bits0, _1: bits1, _2: bits2, _3: bits3 };
  }
  function _M0FPB26ascii__char__set__contains(bits0, bits1, bits2, bits3, code) {
    if (code >>> 0 < 128 >>> 0) {
      const bit = 1 << (code & 31);
      const _bind = code >>> 5 | 0;
      switch (_bind) {
        case 0: {
          return (bits0 & bit) !== 0;
        }
        case 1: {
          return (bits1 & bit) !== 0;
        }
        case 2: {
          return (bits2 & bit) !== 0;
        }
        default: {
          return (bits3 & bit) !== 0;
        }
      }
    } else {
      return false;
    }
  }
  function _M0FPB34string__trim__start__ascii__scalar(str, start, end, bits0, bits1, bits2, bits3) {
    let _tmp = start;
    while (true) {
      const pos = _tmp;
      let _tmp$2;
      if (pos < end) {
        const _p = str.charCodeAt(pos);
        _tmp$2 = _M0FPB26ascii__char__set__contains(bits0, bits1, bits2, bits3, _p);
      } else {
        _tmp$2 = false;
      }
      if (_tmp$2) {
        _tmp = pos + 1 | 0;
        continue;
      } else {
        return pos;
      }
    }
  }
  function _M0FPB32string__trim__end__ascii__scalar(str, start, end, bits0, bits1, bits2, bits3) {
    let _tmp = end;
    while (true) {
      const pos = _tmp;
      let _tmp$2;
      if (pos > start) {
        const _p = str.charCodeAt(pos - 1 | 0);
        _tmp$2 = _M0FPB26ascii__char__set__contains(bits0, bits1, bits2, bits3, _p);
      } else {
        _tmp$2 = false;
      }
      if (_tmp$2) {
        _tmp = pos - 1 | 0;
        continue;
      } else {
        return pos;
      }
    }
  }
  function _M0FPB26string__trim__start__ascii(str, start, end, _chars, bits0, bits1, bits2, bits3) {
    return _M0FPB34string__trim__start__ascii__scalar(str, start, end, bits0, bits1, bits2, bits3);
  }
  function _M0FPB24string__trim__end__ascii(str, start, end, _chars, bits0, bits1, bits2, bits3) {
    return _M0FPB32string__trim__end__ascii__scalar(str, start, end, bits0, bits1, bits2, bits3);
  }
  function _M0MPC16string10StringView14contains__char(self, c) {
    const len = self.end - self.start | 0;
    if (len > 0) {
      const c$2 = c;
      if (c$2 >= 0 && c$2 <= 65535) {
        return _M0MPC16string10StringView20contains__code__unit(self, c$2 & 65535);
      } else {
        if (c$2 < 0) {
          return false;
        } else {
          if (len >= 2) {
            const adj = c$2 - 65536 | 0;
            const high = 55296 + (adj >> 10) | 0;
            if (high <= 65535) {
              const high$2 = high & 65535;
              const low = (56320 + (adj & 1023) | 0) & 65535;
              let _tmp = 0;
              while (true) {
                const i = _tmp;
                if (i < (len - 1 | 0)) {
                  if (self.str.charCodeAt(self.start + i | 0) === high$2) {
                    if (self.str.charCodeAt(self.start + (i + 1 | 0) | 0) === low) {
                      return true;
                    }
                    _tmp = i + 2 | 0;
                    continue;
                  }
                  _tmp = i + 1 | 0;
                  continue;
                } else {
                  break;
                }
              }
            } else {
              return false;
            }
          } else {
            return false;
          }
        }
      }
      return false;
    } else {
      return false;
    }
  }
  function _M0MPC16string10StringView24trim__start__with__chars(self, chars) {
    let _tmp = self;
    while (true) {
      const x = _tmp;
      if ((x.end - x.start | 0) === 0) {
        return x;
      } else {
        const _c = _M0MPC16string6String16unsafe__char__at(x.str, _M0MPC16string6String29offset__of__nth__char_2einner(x.str, 0, x.start, x.end));
        const _tmp$2 = x.str;
        const _bind = _M0MPC16string6String29offset__of__nth__char_2einner(x.str, 1, x.start, x.end);
        let _tmp$3;
        if (_bind === undefined) {
          _tmp$3 = x.end;
        } else {
          const _Some = _bind;
          _tmp$3 = _Some;
        }
        const _x = new _M0TPC16string10StringView(_tmp$2, _tmp$3, x.end);
        if (_M0MPC16string10StringView14contains__char(chars, _c)) {
          _tmp = _x;
          continue;
        } else {
          return x;
        }
      }
    }
  }
  function _M0MPC16string10StringView22trim__end__with__chars(self, chars) {
    let _tmp = self;
    while (true) {
      const x = _tmp;
      if ((x.end - x.start | 0) === 0) {
        return x;
      } else {
        const _c = _M0MPC16string6String16unsafe__char__at(x.str, _M0MPC16string6String29offset__of__nth__char_2einner(x.str, -1, x.start, x.end));
        const _x = new _M0TPC16string10StringView(x.str, x.start, _M0MPC16string6String29offset__of__nth__char_2einner(x.str, -1, x.start, x.end));
        if (_M0MPC16string10StringView14contains__char(chars, _c)) {
          _tmp = _x;
          continue;
        } else {
          return x;
        }
      }
    }
  }
  function _M0MPC16string10StringView12trim_2einner(self, chars) {
    const _bind = _M0FPB23build__ascii__char__set(chars);
    if (_bind === undefined) {
      return _M0MPC16string10StringView22trim__end__with__chars(_M0MPC16string10StringView24trim__start__with__chars(self, chars), chars);
    } else {
      const _Some = _bind;
      const _x = _Some;
      const _bits0 = _x._0;
      const _bits1 = _x._1;
      const _bits2 = _x._2;
      const _bits3 = _x._3;
      const start = _M0FPB26string__trim__start__ascii(self.str, self.start, self.end, chars, _bits0, _bits1, _bits2, _bits3);
      const end = _M0FPB24string__trim__end__ascii(self.str, start, self.end, chars, _bits0, _bits1, _bits2, _bits3);
      return new _M0TPC16string10StringView(self.str, start, end);
    }
  }
  function _M0MPC16string6String12trim_2einner(self, chars) {
    return _M0MPC16string10StringView12trim_2einner(new _M0TPC16string10StringView(self, 0, self.length), chars);
  }
  function _M0MPC16string6String4trim(self, chars$46$opt) {
    let chars;
    if (chars$46$opt === undefined) {
      chars = _M0MPC16string6String4trimN6recordS476;
    } else {
      const _Some = chars$46$opt;
      chars = _Some;
    }
    return _M0MPC16string6String12trim_2einner(self, chars);
  }
  function _M0MPB4Iter3mapGRPC16string10StringViewsE(self, f) {
    return new _M0TPB4IterGsE(() => {
      const _bind = _M0MPB4Iter4nextGRPC16string10StringViewE(self);
      if (_bind === undefined) {
        return undefined;
      } else {
        const _Some = _bind;
        const _x = _Some;
        return f(_x);
      }
    }, self.size_hint);
  }
  function _M0MPB4Iter3mapGcRPC16string10StringViewE(self, f) {
    return new _M0TPB4IterGRPC16string10StringViewE(() => {
      const _bind = _M0MPB4Iter4nextGcE(self);
      if (_bind === -1) {
        return undefined;
      } else {
        const _Some = _bind;
        const _x = _Some;
        return f(_x);
      }
    }, self.size_hint);
  }
  function _M0IPC14char4CharPB4Show10to__string(self) {
    return String.fromCodePoint(self);
  }
  function _M0MPC16string10StringView5split(self, sep) {
    const sep_len = sep.end - sep.start | 0;
    if (sep_len === 0) {
      return _M0MPB4Iter3mapGcRPC16string10StringViewE(_M0MPC16string10StringView4iter(self), (c) => {
        const _bind = _M0IPC14char4CharPB4Show10to__string(c);
        return new _M0TPC16string10StringView(_bind, 0, _bind.length);
      });
    }
    const remaining = new _M0TPB8MutLocalGORPC16string10StringViewE(self);
    return _M0MPB4Iter3newGRPC16string10StringViewE(() => {
      const _bind = remaining.val;
      if (_bind === undefined) {
        return undefined;
      } else {
        const _Some = _bind;
        const _view = _Some;
        const _bind$2 = _M0MPC16string10StringView4find(_view, sep);
        if (_bind$2 === undefined) {
          remaining.val = undefined;
          return _view;
        } else {
          const _Some$2 = _bind$2;
          const _end = _Some$2;
          remaining.val = _M0MPC16string10StringView12unsafe__view(_view, _end + sep_len | 0, _view.end - _view.start | 0);
          return _M0MPC16string10StringView12unsafe__view(_view, 0, _end);
        }
      }
    }, undefined);
  }
  function _M0MPC16string6String5split(self, sep) {
    return _M0MPC16string10StringView5split(new _M0TPC16string10StringView(self, 0, self.length), sep);
  }
  function _M0MPB4Iter9to__arrayGsE(self) {
    const _bind = self.size_hint;
    let result;
    if (_bind === undefined) {
      result = [];
    } else {
      result = [];
    }
    while (true) {
      const _bind$2 = _M0MPB4Iter4nextGRPC16string10StringViewE(self);
      if (_bind$2 === undefined) {
        break;
      } else {
        const _Some = _bind$2;
        const _x = _Some;
        _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(result, _x);
        continue;
      }
    }
    return result;
  }
  function _M0MPC14char4Char20is__ascii__uppercase(self) {
    return self >= 65 && self <= 90;
  }
  function _M0MPC16string6String9to__lower(self) {
    const _bind = _M0MPC16string6String8find__by(self, (c) => _M0MPC14char4Char20is__ascii__uppercase(c));
    if (_bind === undefined) {
      return self;
    } else {
      const _Some = _bind;
      const _idx = _Some;
      const buf = _M0MPB13StringBuilder21StringBuilder_2einner(self.length);
      const head = new _M0TPC16string10StringView(self, 0, _idx);
      _M0IP016_24default__implPB6Logger16write__substringGRPB13StringBuilderE(buf, head.str, head.start, _idx);
      const _bind_end = self.length;
      let _tmp = _idx;
      while (true) {
        const _string_index = _tmp;
        if (_string_index < _bind_end) {
          let _decoded_next_string_index;
          let _decoded_char;
          _L: {
            const _bind$2 = self.charCodeAt(_string_index);
            if (_bind$2 >= 55296 && _bind$2 <= 56319 && (_string_index + 1 | 0) < _bind_end) {
              const _bind$3 = self.charCodeAt(_string_index + 1 | 0);
              if (_bind$3 >= 56320 && _bind$3 <= 57343) {
                const _tmp$2 = _string_index + 2 | 0;
                const _p = (((Math.imul(_bind$2 - 55296 | 0, 1024) | 0) + _bind$3 | 0) - 56320 | 0) + 65536 | 0;
                _decoded_next_string_index = _tmp$2;
                _decoded_char = _p;
                break _L;
              } else {
                const _tmp$2 = _string_index + 1 | 0;
                const _p = _bind$2;
                _decoded_next_string_index = _tmp$2;
                _decoded_char = _p;
                break _L;
              }
            } else {
              const _tmp$2 = _string_index + 1 | 0;
              const _p = _bind$2;
              _decoded_next_string_index = _tmp$2;
              _decoded_char = _p;
              break _L;
            }
          }
          if (_M0MPC14char4Char20is__ascii__uppercase(_decoded_char)) {
            _M0IPB13StringBuilderPB6Logger11write__char(buf, _decoded_char + 32 | 0);
          } else {
            _M0IPB13StringBuilderPB6Logger11write__char(buf, _decoded_char);
          }
          _tmp = _decoded_next_string_index;
          continue;
        } else {
          break;
        }
      }
      return buf.val;
    }
  }
  function _M0MPC16string6String17substring_2einner(self, start, end) {
    const len = self.length;
    let end$2;
    if (end === undefined) {
      end$2 = len;
    } else {
      const _Some = end;
      const _end = _Some;
      end$2 = _end;
    }
    return start >= 0 && (start <= end$2 && end$2 <= len) ? self.substring(start, end$2) : $panic();
  }
  function _M0IPC13int3IntPB4Show10to__string(self) {
    return _M0MPC13int3Int18to__string_2einner(self, 10);
  }
  function _M0MPC15array9ArrayView4iterGUsRP36mizchi4luna3dom4AttrEE(self) {
    const i = new _M0TPB8MutLocalGiE(0);
    const len = self.end - self.start | 0;
    return _M0MPB4Iter3newGRPC16string10StringViewE(() => {
      if (i.val < len) {
        const elem = self.buf[self.start + i.val | 0];
        i.val = i.val + 1 | 0;
        return elem;
      } else {
        return undefined;
      }
    }, len);
  }
  function _M0MPC15array9ArrayView4iterGiE(self) {
    const i = new _M0TPB8MutLocalGiE(0);
    const len = self.end - self.start | 0;
    return _M0MPB4Iter3newGiE(() => {
      if (i.val < len) {
        const elem = self.buf[self.start + i.val | 0];
        i.val = i.val + 1 | 0;
        return elem;
      } else {
        return undefined;
      }
    }, len);
  }
  function _M0MPC15array5Array4iterGUsRP36mizchi4luna3dom4AttrEE(self) {
    return _M0MPC15array9ArrayView4iterGUsRP36mizchi4luna3dom4AttrEE(new _M0TPB9ArrayViewGUsRP36mizchi4luna3dom4AttrEE(self, 0, self.length));
  }
  function _M0MPC15array5Array4iterGiE(self) {
    return _M0MPC15array9ArrayView4iterGiE(new _M0TPB9ArrayViewGiE(self, 0, self.length));
  }
  function _M0MPB18UninitializedArray19unsafe__blit__fixedGRP26mizchi8js__core3AnyE(dst, dst_offset, src, src_offset, len) {
    let _tmp = len - 1 | 0;
    let _tmp$2 = len > 0;
    while (true) {
      const i = _tmp;
      const _more = _tmp$2;
      if (_more) {
        const _tmp$3 = dst_offset + i | 0;
        const _tmp$4 = src_offset + i | 0;
        if (_tmp$3 >>> 0 < dst.length) {
          dst[_tmp$3] = _tmp$4 >>> 0 < src.length ? src[_tmp$4] : $oob();
        } else {
          $oob();
        }
        _tmp = i - 1 | 0;
        _tmp$2 = i > 0;
        continue;
      } else {
        return;
      }
    }
  }
  function _M0MPC16double6Double7to__int(self) {
    return self !== self ? 0 : self >= 2147483647 ? 2147483647 : self <= -2147483648 ? -2147483648 : self | 0;
  }
  function _M0MPC16double6Double4ceil(_tmp) {
    return Math.ceil(_tmp);
  }
  function _M0MPC16double6Double5floor(_tmp) {
    return Math.floor(_tmp);
  }
  function _M0MPC16double6Double5round(_tmp) {
    return Math.round(_tmp);
  }
  function _M0IPC16double6DoublePB4Show10to__string(self) {
    return String(self);
  }
  function _M0MPC15array5Array2atGUsiEE(self, index) {
    const len = self.length;
    return index >= 0 && index < len ? self[index] : $panic();
  }
  function _M0MPC15array5Array2atGORP26mizchi7signals10EffectNodeE(self, index) {
    const len = self.length;
    return index >= 0 && index < len ? self[index] : $panic();
  }
  function _M0MPC15array5Array2atGiE(self, index) {
    const len = self.length;
    return index >= 0 && index < len ? self[index] : $panic();
  }
  function _M0MPC15array5Array2atGdE(self, index) {
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
  function _M0MPC15array5Array28unsafe__truncate__to__lengthGRP26mizchi7signals5OwnerE(self, new_len) {
    _M0MPB7JSArray11set__length(self, new_len);
  }
  function _M0MPC15array5Array11unsafe__popGRP36mizchi4luna3dom10IndexEntryE(self) {
    return _M0MPB7JSArray3pop(self);
  }
  function _M0MPC15array5Array3popGRP36mizchi4luna3dom10IndexEntryE(self) {
    if (self.length === 0) {
      return undefined;
    } else {
      const v = _M0MPC15array5Array11unsafe__popGRP36mizchi4luna3dom10IndexEntryE(self);
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
  function _M0MPC15array5Array4copyGUddEE(self) {
    return _M0MPB7JSArray4copy(self);
  }
  function _M0MPC15array12MutArrayView4swapGRP314vlmkit_2dsites4maps4main6ReviewE(arr, i, j) {
    const temp = arr.buf[arr.start + i | 0];
    arr.buf[arr.start + i | 0] = arr.buf[arr.start + j | 0];
    arr.buf[arr.start + j | 0] = temp;
  }
  function _M0MPC15array12MutArrayView4swapGdE(arr, i, j) {
    const temp = arr.buf[arr.start + i | 0];
    arr.buf[arr.start + i | 0] = arr.buf[arr.start + j | 0];
    arr.buf[arr.start + j | 0] = temp;
  }
  function _M0MPC15array12MutArrayView5sliceGRP314vlmkit_2dsites4maps4main6ReviewE(arr, start, end) {
    const _bind = arr.end - arr.start | 0;
    if (start < 0 || (start > end || end > _bind)) {
      $panic();
    }
    return new _M0TPB12MutArrayViewGRP314vlmkit_2dsites4maps4main6ReviewE(arr.buf, start + arr.start | 0, end + arr.start | 0);
  }
  function _M0MPC15array12MutArrayView5sliceGdE(arr, start, end) {
    const _bind = arr.end - arr.start | 0;
    if (start < 0 || (start > end || end > _bind)) {
      $panic();
    }
    return new _M0TPB12MutArrayViewGdE(arr.buf, start + arr.start | 0, end + arr.start | 0);
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
  function _M0MPC15array5Array3setGRP36mizchi4luna3dom9ItemEntryGiEE(self, index, value) {
    const len = self.length;
    if (index >= 0 && index < len) {
      self[index] = value;
      return;
    } else {
      $panic();
      return;
    }
  }
  function _M0MPC15array5Array3setGiE(self, index, value) {
    const len = self.length;
    if (index >= 0 && index < len) {
      self[index] = value;
      return;
    } else {
      $panic();
      return;
    }
  }
  function _M0MPC15array5Array3setGdE(self, index, value) {
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
  function _M0MPC15array12MutArrayView14rev__in__placeGRP314vlmkit_2dsites4maps4main6ReviewE(arr) {
    const len = arr.end - arr.start | 0;
    const mid_len = len / 2 | 0;
    let _tmp = 0;
    while (true) {
      const i = _tmp;
      if (i < mid_len) {
        const j = (len - i | 0) - 1 | 0;
        const temp = arr.buf[arr.start + i | 0];
        arr.buf[arr.start + i | 0] = arr.buf[arr.start + j | 0];
        arr.buf[arr.start + j | 0] = temp;
        _tmp = i + 1 | 0;
        continue;
      } else {
        return;
      }
    }
  }
  function _M0MPC15array12MutArrayView14rev__in__placeGdE(arr) {
    const len = arr.end - arr.start | 0;
    const mid_len = len / 2 | 0;
    let _tmp = 0;
    while (true) {
      const i = _tmp;
      if (i < mid_len) {
        const j = (len - i | 0) - 1 | 0;
        const temp = arr.buf[arr.start + i | 0];
        arr.buf[arr.start + i | 0] = arr.buf[arr.start + j | 0];
        arr.buf[arr.start + j | 0] = temp;
        _tmp = i + 1 | 0;
        continue;
      } else {
        return;
      }
    }
  }
  function _M0FPB17fixed__get__limit(len) {
    let _tmp = len;
    let _tmp$2 = 0;
    while (true) {
      const len$2 = _tmp;
      const limit = _tmp$2;
      if (len$2 > 0) {
        _tmp = len$2 / 2 | 0;
        _tmp$2 = limit + 1 | 0;
        continue;
      } else {
        return limit;
      }
    }
  }
  function _M0FPB19fixed__bubble__sortGdE(arr) {
    const _bind = arr.end - arr.start | 0;
    let _tmp = 1;
    while (true) {
      const i = _tmp;
      if (i < _bind) {
        let _tmp$2 = i;
        while (true) {
          const j = _tmp$2;
          if (j > 0 && arr.buf[arr.start + (j - 1 | 0) | 0] > arr.buf[arr.start + j | 0]) {
            _M0MPC15array12MutArrayView4swapGdE(arr, j, j - 1 | 0);
            _tmp$2 = j - 1 | 0;
            continue;
          } else {
            break;
          }
        }
        _tmp = i + 1 | 0;
        continue;
      } else {
        return;
      }
    }
  }
  function _M0FPB20fixed__choose__pivotN7sort__2S779GdE(_env, a, b) {
    const arr = _env._1;
    const swaps = _env._0;
    if (arr.buf[arr.start + a | 0] > arr.buf[arr.start + b | 0]) {
      _M0MPC15array12MutArrayView4swapGdE(arr, a, b);
      swaps.val = swaps.val + 1 | 0;
      return;
    } else {
      return;
    }
  }
  function _M0FPB20fixed__choose__pivotN7sort__3S780GdE(_env, a, b, c) {
    _M0FPB20fixed__choose__pivotN7sort__2S779GdE(_env, a, b);
    _M0FPB20fixed__choose__pivotN7sort__2S779GdE(_env, b, c);
    _M0FPB20fixed__choose__pivotN7sort__2S779GdE(_env, a, b);
  }
  function _M0FPB20fixed__choose__pivotGdE(arr) {
    const len = arr.end - arr.start | 0;
    const swaps = new _M0TPB8MutLocalGiE(0);
    const b = Math.imul(len / 4 | 0, 2) | 0;
    if (len >= 8) {
      const a = Math.imul(len / 4 | 0, 1) | 0;
      const c = Math.imul(len / 4 | 0, 3) | 0;
      const _env = { _0: swaps, _1: arr };
      if (len > 50) {
        _M0FPB20fixed__choose__pivotN7sort__3S780GdE(_env, a - 1 | 0, a, a + 1 | 0);
        _M0FPB20fixed__choose__pivotN7sort__3S780GdE(_env, b - 1 | 0, b, b + 1 | 0);
        _M0FPB20fixed__choose__pivotN7sort__3S780GdE(_env, c - 1 | 0, c, c + 1 | 0);
      }
      _M0FPB20fixed__choose__pivotN7sort__3S780GdE(_env, a, b, c);
    }
    if (swaps.val === 12) {
      _M0MPC15array12MutArrayView14rev__in__placeGdE(arr);
      return { _0: (len - b | 0) - 1 | 0, _1: true };
    } else {
      return { _0: b, _1: swaps.val === 0 };
    }
  }
  function _M0FPB17fixed__sift__downGdE(arr, index) {
    const len = arr.end - arr.start | 0;
    let _tmp = index;
    let _tmp$2 = (Math.imul(index, 2) | 0) + 1 | 0;
    while (true) {
      const index$2 = _tmp;
      const child = _tmp$2;
      if (child < len) {
        const child$2 = (child + 1 | 0) < len && arr.buf[arr.start + child | 0] < arr.buf[arr.start + (child + 1 | 0) | 0] ? child + 1 | 0 : child;
        if (arr.buf[arr.start + index$2 | 0] >= arr.buf[arr.start + child$2 | 0]) {
          return undefined;
        }
        _M0MPC15array12MutArrayView4swapGdE(arr, index$2, child$2);
        _tmp = child$2;
        _tmp$2 = (Math.imul(child$2, 2) | 0) + 1 | 0;
        continue;
      } else {
        return;
      }
    }
  }
  function _M0FPB17fixed__heap__sortGdE(arr) {
    const len = arr.end - arr.start | 0;
    const _bind = len / 2 | 0;
    let _tmp = _bind - 1 | 0;
    let _tmp$2 = _bind > 0;
    while (true) {
      const i = _tmp;
      const _more = _tmp$2;
      if (_more) {
        _M0FPB17fixed__sift__downGdE(arr, i);
        _tmp = i - 1 | 0;
        _tmp$2 = i > 0;
        continue;
      } else {
        break;
      }
    }
    let _tmp$3 = len - 1 | 0;
    let _tmp$4 = len > 1;
    while (true) {
      const i = _tmp$3;
      const _more = _tmp$4;
      if (_more) {
        _M0MPC15array12MutArrayView4swapGdE(arr, 0, i);
        _M0FPB17fixed__sift__downGdE(_M0MPC15array12MutArrayView5sliceGdE(arr, 0, i), 0);
        _tmp$3 = i - 1 | 0;
        _tmp$4 = i > 1;
        continue;
      } else {
        return;
      }
    }
  }
  function _M0FPB16fixed__partitionGdE(arr, pivot_index) {
    _M0MPC15array12MutArrayView4swapGdE(arr, pivot_index, (arr.end - arr.start | 0) - 1 | 0);
    const pivot = arr.buf[arr.start + ((arr.end - arr.start | 0) - 1 | 0) | 0];
    const _bind = (arr.end - arr.start | 0) - 1 | 0;
    let _tmp = 0;
    let _tmp$2 = 0;
    let _tmp$3 = true;
    while (true) {
      const j = _tmp;
      const i = _tmp$2;
      const partitioned = _tmp$3;
      if (j < _bind) {
        if (arr.buf[arr.start + j | 0] < pivot) {
          if (i !== j) {
            _M0MPC15array12MutArrayView4swapGdE(arr, i, j);
            _tmp = j + 1 | 0;
            _tmp$2 = i + 1 | 0;
            _tmp$3 = false;
            continue;
          } else {
            _tmp = j + 1 | 0;
            _tmp$2 = i + 1 | 0;
            continue;
          }
        } else {
          _tmp = j + 1 | 0;
          continue;
        }
      } else {
        _M0MPC15array12MutArrayView4swapGdE(arr, i, (arr.end - arr.start | 0) - 1 | 0);
        return { _0: i, _1: partitioned };
      }
    }
  }
  function _M0FPB24fixed__try__bubble__sortGdE(arr) {
    const _bind = arr.end - arr.start | 0;
    let _tmp = 1;
    let _tmp$2 = 0;
    while (true) {
      const i = _tmp;
      const tries = _tmp$2;
      if (i < _bind) {
        let sorted;
        let _tmp$3 = i;
        let _tmp$4 = true;
        while (true) {
          const j = _tmp$3;
          const sorted$2 = _tmp$4;
          if (j > 0 && arr.buf[arr.start + (j - 1 | 0) | 0] > arr.buf[arr.start + j | 0]) {
            _M0MPC15array12MutArrayView4swapGdE(arr, j, j - 1 | 0);
            _tmp$3 = j - 1 | 0;
            _tmp$4 = false;
            continue;
          } else {
            sorted = sorted$2;
            break;
          }
        }
        if (!sorted) {
          const tries$2 = tries + 1 | 0;
          if (tries$2 > 8) {
            return false;
          }
          _tmp = i + 1 | 0;
          _tmp$2 = tries$2;
          continue;
        } else {
          _tmp = i + 1 | 0;
          continue;
        }
      } else {
        return true;
      }
    }
  }
  function _M0FPB18fixed__quick__sortGdE(arr, pred, limit) {
    let _tmp = limit;
    let _tmp$2 = arr;
    let _tmp$3 = pred;
    let _tmp$4 = true;
    let _tmp$5 = true;
    while (true) {
      const limit$2 = _tmp;
      const arr$2 = _tmp$2;
      const pred$2 = _tmp$3;
      const was_partitioned = _tmp$4;
      const balanced = _tmp$5;
      const len = arr$2.end - arr$2.start | 0;
      if (len <= 16) {
        if (len >= 2) {
          _M0FPB19fixed__bubble__sortGdE(arr$2);
        }
        return undefined;
      }
      if (limit$2 === 0) {
        _M0FPB17fixed__heap__sortGdE(arr$2);
        return undefined;
      }
      const _bind = _M0FPB20fixed__choose__pivotGdE(arr$2);
      const _pivot_index = _bind._0;
      const _likely_sorted = _bind._1;
      if (was_partitioned && (balanced && _likely_sorted)) {
        if (_M0FPB24fixed__try__bubble__sortGdE(arr$2)) {
          return undefined;
        }
      }
      const _bind$2 = _M0FPB16fixed__partitionGdE(arr$2, _pivot_index);
      const _pivot = _bind$2._0;
      const _partitioned = _bind$2._1;
      const _p = len - _pivot | 0;
      const balanced$2 = (_pivot > _p ? _p : _pivot) >= (len / 8 | 0);
      const limit$3 = !balanced$2 ? limit$2 - 1 | 0 : limit$2;
      if (pred$2.$tag === 1) {
        const _Some = pred$2;
        const _p$2 = _Some._0;
        if (_p$2 === arr$2.buf[arr$2.start + _pivot | 0]) {
          let i;
          let _tmp$6 = _pivot;
          while (true) {
            const i$2 = _tmp$6;
            if (i$2 < len && _p$2 === arr$2.buf[arr$2.start + i$2 | 0]) {
              _tmp$6 = i$2 + 1 | 0;
              continue;
            } else {
              i = i$2;
              break;
            }
          }
          _tmp = limit$3;
          _tmp$2 = _M0MPC15array12MutArrayView5sliceGdE(arr$2, i, len);
          _tmp$4 = _partitioned;
          _tmp$5 = balanced$2;
          continue;
        }
      }
      const left = _M0MPC15array12MutArrayView5sliceGdE(arr$2, 0, _pivot);
      const right = _M0MPC15array12MutArrayView5sliceGdE(arr$2, _pivot + 1 | 0, len);
      if ((left.end - left.start | 0) < (right.end - right.start | 0)) {
        _M0FPB18fixed__quick__sortGdE(left, pred$2, limit$3);
        _tmp = limit$3;
        _tmp$2 = right;
        _tmp$3 = new _M0DTPC16option6OptionGdE4Some(arr$2.buf[arr$2.start + _pivot | 0]);
        _tmp$4 = _partitioned;
        _tmp$5 = balanced$2;
        continue;
      } else {
        _M0FPB18fixed__quick__sortGdE(right, new _M0DTPC16option6OptionGdE4Some(arr$2.buf[arr$2.start + _pivot | 0]), limit$3);
        _tmp = limit$3;
        _tmp$2 = left;
        _tmp$4 = _partitioned;
        _tmp$5 = balanced$2;
        continue;
      }
    }
  }
  function _M0MPC15array12MutArrayView4sortGdE(self) {
    _M0FPB18fixed__quick__sortGdE(self, _M0DTPC16option6OptionGdE4None__, _M0FPB17fixed__get__limit(self.end - self.start | 0));
  }
  function _M0FPB23fixed__bubble__sort__byGRP314vlmkit_2dsites4maps4main6ReviewE(arr, cmp) {
    const _bind = arr.end - arr.start | 0;
    let _tmp = 1;
    while (true) {
      const i = _tmp;
      if (i < _bind) {
        let _tmp$2 = i;
        while (true) {
          const j = _tmp$2;
          if (j > 0 && cmp(arr.buf[arr.start + (j - 1 | 0) | 0], arr.buf[arr.start + j | 0]) > 0) {
            _M0MPC15array12MutArrayView4swapGRP314vlmkit_2dsites4maps4main6ReviewE(arr, j, j - 1 | 0);
            _tmp$2 = j - 1 | 0;
            continue;
          } else {
            break;
          }
        }
        _tmp = i + 1 | 0;
        continue;
      } else {
        return;
      }
    }
  }
  function _M0FPB24fixed__choose__pivot__byN7sort__2S871GRP314vlmkit_2dsites4maps4main6ReviewE(_env, a, b) {
    const arr = _env._2;
    const cmp = _env._1;
    const swaps = _env._0;
    if (cmp(arr.buf[arr.start + a | 0], arr.buf[arr.start + b | 0]) > 0) {
      _M0MPC15array12MutArrayView4swapGRP314vlmkit_2dsites4maps4main6ReviewE(arr, a, b);
      swaps.val = swaps.val + 1 | 0;
      return;
    } else {
      return;
    }
  }
  function _M0FPB24fixed__choose__pivot__byN7sort__3S872GRP314vlmkit_2dsites4maps4main6ReviewE(_env, a, b, c) {
    _M0FPB24fixed__choose__pivot__byN7sort__2S871GRP314vlmkit_2dsites4maps4main6ReviewE(_env, a, b);
    _M0FPB24fixed__choose__pivot__byN7sort__2S871GRP314vlmkit_2dsites4maps4main6ReviewE(_env, b, c);
    _M0FPB24fixed__choose__pivot__byN7sort__2S871GRP314vlmkit_2dsites4maps4main6ReviewE(_env, a, b);
  }
  function _M0FPB24fixed__choose__pivot__byGRP314vlmkit_2dsites4maps4main6ReviewE(arr, cmp) {
    const len = arr.end - arr.start | 0;
    const swaps = new _M0TPB8MutLocalGiE(0);
    const b = Math.imul(len / 4 | 0, 2) | 0;
    if (len >= 8) {
      const a = Math.imul(len / 4 | 0, 1) | 0;
      const c = Math.imul(len / 4 | 0, 3) | 0;
      const _env = { _0: swaps, _1: cmp, _2: arr };
      if (len > 50) {
        _M0FPB24fixed__choose__pivot__byN7sort__3S872GRP314vlmkit_2dsites4maps4main6ReviewE(_env, a - 1 | 0, a, a + 1 | 0);
        _M0FPB24fixed__choose__pivot__byN7sort__3S872GRP314vlmkit_2dsites4maps4main6ReviewE(_env, b - 1 | 0, b, b + 1 | 0);
        _M0FPB24fixed__choose__pivot__byN7sort__3S872GRP314vlmkit_2dsites4maps4main6ReviewE(_env, c - 1 | 0, c, c + 1 | 0);
      }
      _M0FPB24fixed__choose__pivot__byN7sort__3S872GRP314vlmkit_2dsites4maps4main6ReviewE(_env, a, b, c);
    }
    if (swaps.val === 12) {
      _M0MPC15array12MutArrayView14rev__in__placeGRP314vlmkit_2dsites4maps4main6ReviewE(arr);
      return { _0: (len - b | 0) - 1 | 0, _1: true };
    } else {
      return { _0: b, _1: swaps.val === 0 };
    }
  }
  function _M0FPB21fixed__sift__down__byGRP314vlmkit_2dsites4maps4main6ReviewE(arr, index, cmp) {
    const len = arr.end - arr.start | 0;
    let _tmp = index;
    let _tmp$2 = (Math.imul(index, 2) | 0) + 1 | 0;
    while (true) {
      const index$2 = _tmp;
      const child = _tmp$2;
      if (child < len) {
        const child$2 = (child + 1 | 0) < len && cmp(arr.buf[arr.start + child | 0], arr.buf[arr.start + (child + 1 | 0) | 0]) < 0 ? child + 1 | 0 : child;
        if (cmp(arr.buf[arr.start + index$2 | 0], arr.buf[arr.start + child$2 | 0]) >= 0) {
          return undefined;
        }
        _M0MPC15array12MutArrayView4swapGRP314vlmkit_2dsites4maps4main6ReviewE(arr, index$2, child$2);
        _tmp = child$2;
        _tmp$2 = (Math.imul(child$2, 2) | 0) + 1 | 0;
        continue;
      } else {
        return;
      }
    }
  }
  function _M0FPB21fixed__heap__sort__byGRP314vlmkit_2dsites4maps4main6ReviewE(arr, cmp) {
    const len = arr.end - arr.start | 0;
    const _bind = len / 2 | 0;
    let _tmp = _bind - 1 | 0;
    let _tmp$2 = _bind > 0;
    while (true) {
      const i = _tmp;
      const _more = _tmp$2;
      if (_more) {
        _M0FPB21fixed__sift__down__byGRP314vlmkit_2dsites4maps4main6ReviewE(arr, i, cmp);
        _tmp = i - 1 | 0;
        _tmp$2 = i > 0;
        continue;
      } else {
        break;
      }
    }
    let _tmp$3 = len - 1 | 0;
    let _tmp$4 = len > 1;
    while (true) {
      const i = _tmp$3;
      const _more = _tmp$4;
      if (_more) {
        _M0MPC15array12MutArrayView4swapGRP314vlmkit_2dsites4maps4main6ReviewE(arr, 0, i);
        _M0FPB21fixed__sift__down__byGRP314vlmkit_2dsites4maps4main6ReviewE(_M0MPC15array12MutArrayView5sliceGRP314vlmkit_2dsites4maps4main6ReviewE(arr, 0, i), 0, cmp);
        _tmp$3 = i - 1 | 0;
        _tmp$4 = i > 1;
        continue;
      } else {
        return;
      }
    }
  }
  function _M0FPB20fixed__partition__byGRP314vlmkit_2dsites4maps4main6ReviewE(arr, cmp, pivot_index) {
    _M0MPC15array12MutArrayView4swapGRP314vlmkit_2dsites4maps4main6ReviewE(arr, pivot_index, (arr.end - arr.start | 0) - 1 | 0);
    const pivot = arr.buf[arr.start + ((arr.end - arr.start | 0) - 1 | 0) | 0];
    const _bind = (arr.end - arr.start | 0) - 1 | 0;
    let _tmp = 0;
    let _tmp$2 = 0;
    let _tmp$3 = true;
    while (true) {
      const j = _tmp;
      const i = _tmp$2;
      const partitioned = _tmp$3;
      if (j < _bind) {
        if (cmp(arr.buf[arr.start + j | 0], pivot) < 0) {
          if (i !== j) {
            _M0MPC15array12MutArrayView4swapGRP314vlmkit_2dsites4maps4main6ReviewE(arr, i, j);
            _tmp = j + 1 | 0;
            _tmp$2 = i + 1 | 0;
            _tmp$3 = false;
            continue;
          } else {
            _tmp = j + 1 | 0;
            _tmp$2 = i + 1 | 0;
            continue;
          }
        } else {
          _tmp = j + 1 | 0;
          continue;
        }
      } else {
        _M0MPC15array12MutArrayView4swapGRP314vlmkit_2dsites4maps4main6ReviewE(arr, i, (arr.end - arr.start | 0) - 1 | 0);
        return { _0: i, _1: partitioned };
      }
    }
  }
  function _M0FPB28fixed__try__bubble__sort__byGRP314vlmkit_2dsites4maps4main6ReviewE(arr, cmp) {
    const _bind = arr.end - arr.start | 0;
    let _tmp = 1;
    let _tmp$2 = 0;
    while (true) {
      const i = _tmp;
      const tries = _tmp$2;
      if (i < _bind) {
        let sorted;
        let _tmp$3 = i;
        let _tmp$4 = true;
        while (true) {
          const j = _tmp$3;
          const sorted$2 = _tmp$4;
          if (j > 0 && cmp(arr.buf[arr.start + (j - 1 | 0) | 0], arr.buf[arr.start + j | 0]) > 0) {
            _M0MPC15array12MutArrayView4swapGRP314vlmkit_2dsites4maps4main6ReviewE(arr, j, j - 1 | 0);
            _tmp$3 = j - 1 | 0;
            _tmp$4 = false;
            continue;
          } else {
            sorted = sorted$2;
            break;
          }
        }
        if (!sorted) {
          const tries$2 = tries + 1 | 0;
          if (tries$2 > 8) {
            return false;
          }
          _tmp = i + 1 | 0;
          _tmp$2 = tries$2;
          continue;
        } else {
          _tmp = i + 1 | 0;
          continue;
        }
      } else {
        return true;
      }
    }
  }
  function _M0FPB22fixed__quick__sort__byGRP314vlmkit_2dsites4maps4main6ReviewE(arr, cmp, pred, limit) {
    let _tmp = limit;
    let _tmp$2 = arr;
    let _tmp$3 = pred;
    let _tmp$4 = true;
    let _tmp$5 = true;
    while (true) {
      const limit$2 = _tmp;
      const arr$2 = _tmp$2;
      const pred$2 = _tmp$3;
      const was_partitioned = _tmp$4;
      const balanced = _tmp$5;
      const len = arr$2.end - arr$2.start | 0;
      if (len <= 16) {
        if (len >= 2) {
          _M0FPB23fixed__bubble__sort__byGRP314vlmkit_2dsites4maps4main6ReviewE(arr$2, cmp);
        }
        return undefined;
      }
      if (limit$2 === 0) {
        _M0FPB21fixed__heap__sort__byGRP314vlmkit_2dsites4maps4main6ReviewE(arr$2, cmp);
        return undefined;
      }
      const _bind = _M0FPB24fixed__choose__pivot__byGRP314vlmkit_2dsites4maps4main6ReviewE(arr$2, cmp);
      const _pivot_index = _bind._0;
      const _likely_sorted = _bind._1;
      if (was_partitioned && (balanced && _likely_sorted)) {
        if (_M0FPB28fixed__try__bubble__sort__byGRP314vlmkit_2dsites4maps4main6ReviewE(arr$2, cmp)) {
          return undefined;
        }
      }
      const _bind$2 = _M0FPB20fixed__partition__byGRP314vlmkit_2dsites4maps4main6ReviewE(arr$2, cmp, _pivot_index);
      const _pivot = _bind$2._0;
      const _partitioned = _bind$2._1;
      const _p = len - _pivot | 0;
      const balanced$2 = (_pivot > _p ? _p : _pivot) >= (len / 8 | 0);
      const limit$3 = !balanced$2 ? limit$2 - 1 | 0 : limit$2;
      if (pred$2 === undefined) {
      } else {
        const _Some = pred$2;
        const _p$2 = _Some;
        if (cmp(_p$2, arr$2.buf[arr$2.start + _pivot | 0]) === 0) {
          let i;
          let _tmp$6 = _pivot;
          while (true) {
            const i$2 = _tmp$6;
            if (i$2 < len && cmp(_p$2, arr$2.buf[arr$2.start + i$2 | 0]) === 0) {
              _tmp$6 = i$2 + 1 | 0;
              continue;
            } else {
              i = i$2;
              break;
            }
          }
          _tmp = limit$3;
          _tmp$2 = _M0MPC15array12MutArrayView5sliceGRP314vlmkit_2dsites4maps4main6ReviewE(arr$2, i, len);
          _tmp$4 = _partitioned;
          _tmp$5 = balanced$2;
          continue;
        }
      }
      const left = _M0MPC15array12MutArrayView5sliceGRP314vlmkit_2dsites4maps4main6ReviewE(arr$2, 0, _pivot);
      const right = _M0MPC15array12MutArrayView5sliceGRP314vlmkit_2dsites4maps4main6ReviewE(arr$2, _pivot + 1 | 0, len);
      if ((left.end - left.start | 0) < (right.end - right.start | 0)) {
        _M0FPB22fixed__quick__sort__byGRP314vlmkit_2dsites4maps4main6ReviewE(left, cmp, pred$2, limit$3);
        _tmp = limit$3;
        _tmp$2 = right;
        _tmp$3 = arr$2.buf[arr$2.start + _pivot | 0];
        _tmp$4 = _partitioned;
        _tmp$5 = balanced$2;
        continue;
      } else {
        _M0FPB22fixed__quick__sort__byGRP314vlmkit_2dsites4maps4main6ReviewE(right, cmp, arr$2.buf[arr$2.start + _pivot | 0], limit$3);
        _tmp = limit$3;
        _tmp$2 = left;
        _tmp$4 = _partitioned;
        _tmp$5 = balanced$2;
        continue;
      }
    }
  }
  function _M0MPC15array12MutArrayView8sort__byGRP314vlmkit_2dsites4maps4main6ReviewE(self, cmp) {
    _M0FPB22fixed__quick__sort__byGRP314vlmkit_2dsites4maps4main6ReviewE(self, cmp, undefined, _M0FPB17fixed__get__limit(self.end - self.start | 0));
  }
  function _M0MPC15array5Array4sortGdE(self) {
    const _bind = self.length;
    _M0MPC15array12MutArrayView4sortGdE(new _M0TPB12MutArrayViewGdE(self, 0, _bind));
  }
  function _M0MPC15array5Array8sort__byGRP314vlmkit_2dsites4maps4main6ReviewE(self, cmp) {
    const _bind = self.length;
    _M0MPC15array12MutArrayView8sort__byGRP314vlmkit_2dsites4maps4main6ReviewE(new _M0TPB12MutArrayViewGRP314vlmkit_2dsites4maps4main6ReviewE(self, 0, _bind), cmp);
  }
  function _M0MPC15array5Array4makeGORP26mizchi7signals10EffectNodeE(len, elem) {
    const arr = new Array(len);
    let _tmp = 0;
    while (true) {
      const i = _tmp;
      if (i < len) {
        arr[i] = elem;
        _tmp = i + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return arr;
  }
  function _M0MPC15array5Array4makeGiE(len, elem) {
    const arr = new Array(len);
    let _tmp = 0;
    while (true) {
      const i = _tmp;
      if (i < len) {
        arr[i] = elem;
        _tmp = i + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return arr;
  }
  function _M0MPC15array5Array4makeGdE(len, elem) {
    const arr = new Array(len);
    let _tmp = 0;
    while (true) {
      const i = _tmp;
      if (i < len) {
        arr[i] = elem;
        _tmp = i + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return arr;
  }
  function _M0MPC15array5Array4makeGbE(len, elem) {
    const arr = new Array(len);
    let _tmp = 0;
    while (true) {
      const i = _tmp;
      if (i < len) {
        arr[i] = elem;
        _tmp = i + 1 | 0;
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
  function _M0IPC15array5ArrayPB2Eq5equalGiE(self, other) {
    const self_len = self.length;
    const other_len = other.length;
    if (self_len === other_len) {
      let _tmp = 0;
      while (true) {
        const i = _tmp;
        if (i < self_len) {
          if (self[i] === other[i]) {
          } else {
            return false;
          }
          _tmp = i + 1 | 0;
          continue;
        } else {
          return true;
        }
      }
    } else {
      return false;
    }
  }
  function _M0MPC15array5Array5clearGRP26mizchi7signals5OwnerE(self) {
    _M0MPC15array5Array28unsafe__truncate__to__lengthGRP26mizchi7signals5OwnerE(self, 0);
  }
  function _M0MPC15array5Array14rev__in__placeGUddEE(self) {
    const len = self.length;
    const _bind = len / 2 | 0;
    let _tmp = 0;
    while (true) {
      const i = _tmp;
      if (i < _bind) {
        const temp = self[i];
        self[i] = self[(len - i | 0) - 1 | 0];
        self[(len - i | 0) - 1 | 0] = temp;
        _tmp = i + 1 | 0;
        continue;
      } else {
        return;
      }
    }
  }
  function _M0MPC15array5Array8containsGiE(self, value) {
    const _bind = self.length;
    let _tmp = 0;
    while (true) {
      const _ = _tmp;
      if (_ < _bind) {
        const v = self[_];
        if (v === value) {
          return true;
        }
        _tmp = _ + 1 | 0;
        continue;
      } else {
        return false;
      }
    }
  }
  function _M0MPC15array5Array10push__iterGUsRP36mizchi4luna3dom4AttrEE(self, iter) {
    const _bind = iter.size_hint;
    if (_bind === undefined) {
    }
    while (true) {
      const _bind$2 = _M0MPB4Iter4nextGRPC16string10StringViewE(iter);
      if (_bind$2 === undefined) {
        return;
      } else {
        const _Some = _bind$2;
        const _x = _Some;
        _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(self, _x);
        continue;
      }
    }
  }
  function _M0MPC15array5Array10push__iterGiE(self, iter) {
    const _bind = iter.size_hint;
    if (_bind === undefined) {
    }
    while (true) {
      const _bind$2 = _M0MPB4Iter4nextGiE(iter);
      if (_bind$2 === undefined) {
        return;
      } else {
        const _Some = _bind$2;
        const _x = _Some;
        _M0MPC15array5Array4pushGiE(self, _x);
        continue;
      }
    }
  }
  function _M0MPC13ref3Ref3RefGORPB5ArrayGiEE(x) {
    return new _M0TPC13ref3RefGORPB5ArrayGiEE(x);
  }
  function _M0MPC13ref3Ref3RefGRPB5ArrayGRP36mizchi11js__browser3dom4NodeEE(x) {
    return new _M0TPC13ref3RefGRPB5ArrayGRP36mizchi11js__browser3dom4NodeEE(x);
  }
  function _M0MPC13ref3Ref3RefGOiE(x) {
    return new _M0TPC13ref3RefGOiE(x);
  }
  function _M0MPC13ref3Ref3RefGiE(x) {
    return new _M0TPC13ref3RefGiE(x);
  }
  function _M0MPC13ref3Ref3RefGdE(x) {
    return new _M0TPC13ref3RefGdE(x);
  }
  function _M0MPC13ref3Ref3RefGbE(x) {
    return new _M0TPC13ref3RefGbE(x);
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
    let _tmp = 0;
    while (true) {
      const _p$4 = _tmp;
      if (_p$4 < _p$3) {
        const _p$5 = _p[_p$4];
        _p$2[_p$4] = _p$5;
        _tmp = _p$4 + 1 | 0;
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
    const _bind = sub.deps_tail;
    let current_dep;
    if (_bind === undefined) {
      current_dep = sub.deps;
    } else {
      const _Some = _bind;
      const _dt = _Some;
      current_dep = _dt.next_dep;
    }
    while (true) {
      const _bind$2 = current_dep;
      if (_bind$2 === undefined) {
        return;
      } else {
        const _Some = _bind$2;
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
      const _bind = node.deps_tail;
      if (_bind === undefined) {
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
    const _bind = node.subs;
    if (_bind === undefined) {
      return;
    } else {
      const _Some = _bind;
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
    const _bind = node.subs;
    if (_bind === undefined) {
      return;
    } else {
      const _Some = _bind;
      const _sub = _Some;
      _M0FP26mizchi7signals6unlink(_sub, _sub.sub);
      return;
    }
  }
  function _M0FP26mizchi7signals19core__run__cleanups(cleanups) {
    let _tmp = cleanups.length - 1 | 0;
    while (true) {
      const i = _tmp;
      if (i >= 0) {
        const _func = _M0MPC15array5Array2atGUsiEE(cleanups, i);
        _func();
        _tmp = i - 1 | 0;
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
    const _bind = dep.subs_tail;
    if (_bind === undefined) {
    } else {
      const _Some = _bind;
      const _ps = _Some;
      if (_ps.version === version && _ps.sub === sub) {
        return undefined;
      }
    }
    const _bind$2 = dep.subs_tail;
    const _bind$3 = undefined;
    const new_link = new _M0TP26mizchi7signals4Link(version, dep, sub, _bind$2, _bind$3, prev_dep, next_dep);
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
    const _bind$4 = new_link.prev_sub;
    if (_bind$4 === undefined) {
      dep.subs = new_link;
    } else {
      const _Some = _bind$4;
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
    const _bind = _M0FP26mizchi7signals17reactive__context.current_owner;
    if (_bind === undefined) {
      return;
    } else {
      const _Some = _bind;
      const _owner = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(_owner.disposers, disposer);
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
      let _tmp = cleanups.length - 1 | 0;
      while (true) {
        const i = _tmp;
        if (i >= 0) {
          const _func = _M0MPC15array5Array2atGUsiEE(cleanups, i);
          _func();
          _tmp = i - 1 | 0;
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
      let _tmp = cleanups.length - 1 | 0;
      while (true) {
        const i = _tmp;
        if (i >= 0) {
          const _func = _M0MPC15array5Array2atGUsiEE(cleanups, i);
          _func();
          _tmp = i - 1 | 0;
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
  function _M0FP26mizchi7signals5watchGiE(source, callback) {
    const prev_value = _M0MPC13ref3Ref3RefGOiE(undefined);
    return _M0FP26mizchi7signals14render__effect(() => {
      const new_value = source();
      const _bind = prev_value.val;
      if (_bind === undefined) {
        prev_value.val = new_value;
        return;
      } else {
        const _Some = _bind;
        const _old = _Some;
        if (_old !== new_value) {
          callback(new_value, _old);
          prev_value.val = new_value;
          return;
        } else {
          return;
        }
      }
    });
  }
  function _M0FP26mizchi7signals5watchGRPB5ArrayGiEE(source, callback) {
    const prev_value = _M0MPC13ref3Ref3RefGORPB5ArrayGiEE(_M0DTPC16option6OptionGRPB5ArrayGiEE4None__);
    return _M0FP26mizchi7signals14render__effect(() => {
      const new_value = source();
      const _bind = prev_value.val;
      if (_bind.$tag === 1) {
        const _Some = _bind;
        const _old = _Some._0;
        if (_M0IP016_24default__implPB2Eq10not__equalGRPB5ArrayGiEE(_old, new_value)) {
          callback(new_value, _old);
          prev_value.val = new _M0DTPC16option6OptionGRPB5ArrayGiEE4Some(new_value);
          return;
        } else {
          return;
        }
      } else {
        prev_value.val = new _M0DTPC16option6OptionGRPB5ArrayGiEE4Some(new_value);
        return;
      }
    });
  }
  function _M0MP26mizchi7signals5Flags5unset(self, flag) {
    self.value = self.value & (_M0MP26mizchi7signals13ReactiveFlags7to__int(flag) ^ -1);
  }
  function _M0FP26mizchi7signals14notify__effect(node) {
    const _bind = node.effect_callback;
    if (_bind === undefined) {
      return;
    } else {
      const _Some = _bind;
      const _callback = _Some;
      let already_queued = false;
      const _bind$2 = _M0FP26mizchi7signals22callback__queue__nodes.length;
      let _tmp = 0;
      while (true) {
        const _ = _tmp;
        if (_ < _bind$2) {
          const n = _M0FP26mizchi7signals22callback__queue__nodes[_];
          if (n === node) {
            already_queued = true;
            break;
          }
          _tmp = _ + 1 | 0;
          continue;
        } else {
          break;
        }
      }
      if (!already_queued) {
        _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(_M0FP26mizchi7signals15callback__queue, _callback);
        _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(_M0FP26mizchi7signals22callback__queue__nodes, node);
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
      const _bind = current_link;
      if (_bind === undefined) {
        return;
      } else {
        const _Some = _bind;
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
  function _M0MP26mizchi7signals10CoreSignal3getGRP314vlmkit_2dsites4maps4main4ViewE(self) {
    const _p = self.node.flags;
    const flags = _p.value;
    const dirty_flag = _M0MP26mizchi7signals13ReactiveFlags7to__int(16);
    if ((flags & dirty_flag) !== 0) {
      if (!(self.current_value === self.pending_value)) {
        self.current_value = self.pending_value;
        const _bind = self.node.subs;
        if (_bind === undefined) {
        } else {
          const _Some = _bind;
          const _subs = _Some;
          _M0FP26mizchi7signals18shallow__propagate(_subs);
        }
      }
      _M0MP26mizchi7signals5Flags10set__value(self.node.flags, _M0MP26mizchi7signals13ReactiveFlags7to__int(1));
    }
    let found_sub = _M0FP26mizchi7signals11active__sub.val;
    while (true) {
      const _bind = found_sub;
      if (_bind === undefined) {
        break;
      } else {
        const _Some = _bind;
        const _s = _Some;
        const _p$2 = _s.flags;
        const sub_flags = _p$2.value;
        const mutable_flag = _M0MP26mizchi7signals13ReactiveFlags7to__int(1);
        const watching_flag = _M0MP26mizchi7signals13ReactiveFlags7to__int(2);
        if ((sub_flags & (mutable_flag | watching_flag)) !== 0) {
          _M0FP26mizchi7signals4link(self.node, _s, _M0FP26mizchi7signals5cycle.val);
          break;
        }
        const _bind$2 = _s.subs;
        let _tmp;
        if (_bind$2 === undefined) {
          _tmp = undefined;
        } else {
          const _Some$2 = _bind$2;
          const _subs = _Some$2;
          _tmp = _subs.sub;
        }
        found_sub = _tmp;
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
        const _bind = self.node.subs;
        if (_bind === undefined) {
        } else {
          const _Some = _bind;
          const _subs = _Some;
          _M0FP26mizchi7signals18shallow__propagate(_subs);
        }
      }
      _M0MP26mizchi7signals5Flags10set__value(self.node.flags, _M0MP26mizchi7signals13ReactiveFlags7to__int(1));
    }
    let found_sub = _M0FP26mizchi7signals11active__sub.val;
    while (true) {
      const _bind = found_sub;
      if (_bind === undefined) {
        break;
      } else {
        const _Some = _bind;
        const _s = _Some;
        const _p$2 = _s.flags;
        const sub_flags = _p$2.value;
        const mutable_flag = _M0MP26mizchi7signals13ReactiveFlags7to__int(1);
        const watching_flag = _M0MP26mizchi7signals13ReactiveFlags7to__int(2);
        if ((sub_flags & (mutable_flag | watching_flag)) !== 0) {
          _M0FP26mizchi7signals4link(self.node, _s, _M0FP26mizchi7signals5cycle.val);
          break;
        }
        const _bind$2 = _s.subs;
        let _tmp;
        if (_bind$2 === undefined) {
          _tmp = undefined;
        } else {
          const _Some$2 = _bind$2;
          const _subs = _Some$2;
          _tmp = _subs.sub;
        }
        found_sub = _tmp;
        continue;
      }
    }
    return self.current_value;
  }
  function _M0MP26mizchi7signals10CoreSignal3getGdE(self) {
    const _p = self.node.flags;
    const flags = _p.value;
    const dirty_flag = _M0MP26mizchi7signals13ReactiveFlags7to__int(16);
    if ((flags & dirty_flag) !== 0) {
      if (!(self.current_value === self.pending_value)) {
        self.current_value = self.pending_value;
        const _bind = self.node.subs;
        if (_bind === undefined) {
        } else {
          const _Some = _bind;
          const _subs = _Some;
          _M0FP26mizchi7signals18shallow__propagate(_subs);
        }
      }
      _M0MP26mizchi7signals5Flags10set__value(self.node.flags, _M0MP26mizchi7signals13ReactiveFlags7to__int(1));
    }
    let found_sub = _M0FP26mizchi7signals11active__sub.val;
    while (true) {
      const _bind = found_sub;
      if (_bind === undefined) {
        break;
      } else {
        const _Some = _bind;
        const _s = _Some;
        const _p$2 = _s.flags;
        const sub_flags = _p$2.value;
        const mutable_flag = _M0MP26mizchi7signals13ReactiveFlags7to__int(1);
        const watching_flag = _M0MP26mizchi7signals13ReactiveFlags7to__int(2);
        if ((sub_flags & (mutable_flag | watching_flag)) !== 0) {
          _M0FP26mizchi7signals4link(self.node, _s, _M0FP26mizchi7signals5cycle.val);
          break;
        }
        const _bind$2 = _s.subs;
        let _tmp;
        if (_bind$2 === undefined) {
          _tmp = undefined;
        } else {
          const _Some$2 = _bind$2;
          const _subs = _Some$2;
          _tmp = _subs.sub;
        }
        found_sub = _tmp;
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
        const _bind = self.node.subs;
        if (_bind === undefined) {
        } else {
          const _Some = _bind;
          const _subs = _Some;
          _M0FP26mizchi7signals18shallow__propagate(_subs);
        }
      }
      _M0MP26mizchi7signals5Flags10set__value(self.node.flags, _M0MP26mizchi7signals13ReactiveFlags7to__int(1));
    }
    let found_sub = _M0FP26mizchi7signals11active__sub.val;
    while (true) {
      const _bind = found_sub;
      if (_bind === undefined) {
        break;
      } else {
        const _Some = _bind;
        const _s = _Some;
        const _p$2 = _s.flags;
        const sub_flags = _p$2.value;
        const mutable_flag = _M0MP26mizchi7signals13ReactiveFlags7to__int(1);
        const watching_flag = _M0MP26mizchi7signals13ReactiveFlags7to__int(2);
        if ((sub_flags & (mutable_flag | watching_flag)) !== 0) {
          _M0FP26mizchi7signals4link(self.node, _s, _M0FP26mizchi7signals5cycle.val);
          break;
        }
        const _bind$2 = _s.subs;
        let _tmp;
        if (_bind$2 === undefined) {
          _tmp = undefined;
        } else {
          const _Some$2 = _bind$2;
          const _subs = _Some$2;
          _tmp = _subs.sub;
        }
        found_sub = _tmp;
        continue;
      }
    }
    return self.current_value;
  }
  function _M0MP26mizchi7signals10CoreSignal3getGRPB5ArrayGiEE(self) {
    const _p = self.node.flags;
    const flags = _p.value;
    const dirty_flag = _M0MP26mizchi7signals13ReactiveFlags7to__int(16);
    if ((flags & dirty_flag) !== 0) {
      if (!(self.current_value === self.pending_value)) {
        self.current_value = self.pending_value;
        const _bind = self.node.subs;
        if (_bind === undefined) {
        } else {
          const _Some = _bind;
          const _subs = _Some;
          _M0FP26mizchi7signals18shallow__propagate(_subs);
        }
      }
      _M0MP26mizchi7signals5Flags10set__value(self.node.flags, _M0MP26mizchi7signals13ReactiveFlags7to__int(1));
    }
    let found_sub = _M0FP26mizchi7signals11active__sub.val;
    while (true) {
      const _bind = found_sub;
      if (_bind === undefined) {
        break;
      } else {
        const _Some = _bind;
        const _s = _Some;
        const _p$2 = _s.flags;
        const sub_flags = _p$2.value;
        const mutable_flag = _M0MP26mizchi7signals13ReactiveFlags7to__int(1);
        const watching_flag = _M0MP26mizchi7signals13ReactiveFlags7to__int(2);
        if ((sub_flags & (mutable_flag | watching_flag)) !== 0) {
          _M0FP26mizchi7signals4link(self.node, _s, _M0FP26mizchi7signals5cycle.val);
          break;
        }
        const _bind$2 = _s.subs;
        let _tmp;
        if (_bind$2 === undefined) {
          _tmp = undefined;
        } else {
          const _Some$2 = _bind$2;
          const _subs = _Some$2;
          _tmp = _subs.sub;
        }
        found_sub = _tmp;
        continue;
      }
    }
    return self.current_value;
  }
  function _M0MP26mizchi7signals6Signal3getGRP314vlmkit_2dsites4maps4main4ViewE(self) {
    return _M0MP26mizchi7signals10CoreSignal3getGRP314vlmkit_2dsites4maps4main4ViewE(self.inner);
  }
  function _M0MP26mizchi7signals6Signal3getGiE(self) {
    return _M0MP26mizchi7signals10CoreSignal3getGiE(self.inner);
  }
  function _M0MP26mizchi7signals6Signal3getGdE(self) {
    return _M0MP26mizchi7signals10CoreSignal3getGdE(self.inner);
  }
  function _M0MP26mizchi7signals6Signal3getGbE(self) {
    return _M0MP26mizchi7signals10CoreSignal3getGbE(self.inner);
  }
  function _M0MP26mizchi7signals6Signal3getGRPB5ArrayGiEE(self) {
    return _M0MP26mizchi7signals10CoreSignal3getGRPB5ArrayGiEE(self.inner);
  }
  function _M0FP26mizchi7signals12start__batch() {
    _M0FP26mizchi7signals12batch__depth.val = _M0FP26mizchi7signals12batch__depth.val + 1 | 0;
  }
  function _M0FP26mizchi7signals12check__dirty(start_link, sub, update_fn) {
    let current_link = start_link;
    const dirty_flag = _M0MP26mizchi7signals13ReactiveFlags7to__int(16);
    const mutable_flag = _M0MP26mizchi7signals13ReactiveFlags7to__int(1);
    while (true) {
      const _bind = current_link;
      if (_bind === undefined) {
        break;
      } else {
        const _Some = _bind;
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
            const _bind$2 = dep.subs;
            if (_bind$2 === undefined) {
            } else {
              const _Some$2 = _bind$2;
              const _subs = _Some$2;
              const _bind$3 = _subs.next_sub;
              if (_bind$3 === undefined) {
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
    const _bind = e.node.deps;
    let is_deps_dirty;
    if (_bind === undefined) {
      is_deps_dirty = false;
    } else {
      const _Some = _bind;
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
        const _bind = _M0MPC15array5Array2atGORP26mizchi7signals10EffectNodeE(_M0FP26mizchi7signals6queued, _M0FP26mizchi7signals13notify__index.val);
        if (_bind === undefined) {
          _M0FP26mizchi7signals13notify__index.val = _M0FP26mizchi7signals13notify__index.val + 1 | 0;
        } else {
          const _Some = _bind;
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
  function _M0FP26mizchi7signals10end__batch() {
    _M0FP26mizchi7signals12batch__depth.val = _M0FP26mizchi7signals12batch__depth.val - 1 | 0;
    if (_M0FP26mizchi7signals12batch__depth.val === 0) {
      _M0FP26mizchi7signals5flush();
      return;
    } else {
      return;
    }
  }
  function _M0FP26mizchi7signals15is__valid__link(check_link, sub) {
    let current_link = sub.deps_tail;
    while (true) {
      const _bind = current_link;
      if (_bind === undefined) {
        break;
      } else {
        const _Some = _bind;
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
    const link_ref = _M0MPC13ref3Ref3RefGRPB5ArrayGRP36mizchi11js__browser3dom4NodeEE(start_link);
    const next_ref = _M0MPC13ref3Ref3RefGRPB5ArrayGRP36mizchi11js__browser3dom4NodeEE(start_link.next_sub);
    const stack = [];
    let running = true;
    while (true) {
      if (running) {
        const _bind = link_ref.val;
        if (_bind === undefined) {
          if (stack.length > 0) {
            const _bind$2 = _M0MPC15array5Array3popGRP36mizchi4luna3dom10IndexEntryE(stack);
            if (_bind$2 === undefined) {
              running = false;
            } else {
              const _Some = _bind$2;
              const _x = _Some;
              const _l = _x._0;
              link_ref.val = _l;
              let _tmp;
              if (_l === undefined) {
                _tmp = undefined;
              } else {
                const _Some$2 = _l;
                const _lnk = _Some$2;
                _tmp = _lnk.next_sub;
              }
              next_ref.val = _tmp;
            }
          } else {
            running = false;
          }
        } else {
          const _Some = _bind;
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
            const _bind$2 = sub.subs;
            if (_bind$2 === undefined) {
              link_ref.val = next_ref.val;
              const _bind$3 = link_ref.val;
              if (_bind$3 === undefined) {
                next_ref.val = undefined;
              } else {
                const _Some$2 = _bind$3;
                const _l = _Some$2;
                next_ref.val = _l.next_sub;
              }
            } else {
              const _Some$2 = _bind$2;
              const _sub_subs = _Some$2;
              const _bind$3 = _sub_subs.next_sub;
              if (_bind$3 === undefined) {
              } else {
                _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(stack, { _0: next_ref.val, _1: undefined });
                next_ref.val = _sub_subs.next_sub;
              }
              link_ref.val = _sub_subs;
            }
          } else {
            link_ref.val = next_ref.val;
            const _bind$2 = link_ref.val;
            if (_bind$2 === undefined) {
              next_ref.val = undefined;
            } else {
              const _Some$2 = _bind$2;
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
  function _M0FP26mizchi7signals12core__signalGRP314vlmkit_2dsites4maps4main4ViewE(initial) {
    return new _M0TP26mizchi7signals10CoreSignalGRP314vlmkit_2dsites4maps4main4ViewE(_M0MP26mizchi7signals12ReactiveNode3new(_M0MP26mizchi7signals13ReactiveFlags7to__int(1)), initial, initial);
  }
  function _M0FP26mizchi7signals12core__signalGiE(initial) {
    return new _M0TP26mizchi7signals10CoreSignalGiE(_M0MP26mizchi7signals12ReactiveNode3new(_M0MP26mizchi7signals13ReactiveFlags7to__int(1)), initial, initial);
  }
  function _M0FP26mizchi7signals12core__signalGdE(initial) {
    return new _M0TP26mizchi7signals10CoreSignalGdE(_M0MP26mizchi7signals12ReactiveNode3new(_M0MP26mizchi7signals13ReactiveFlags7to__int(1)), initial, initial);
  }
  function _M0FP26mizchi7signals12core__signalGbE(initial) {
    return new _M0TP26mizchi7signals10CoreSignalGbE(_M0MP26mizchi7signals12ReactiveNode3new(_M0MP26mizchi7signals13ReactiveFlags7to__int(1)), initial, initial);
  }
  function _M0FP26mizchi7signals12core__signalGRPB5ArrayGiEE(initial) {
    return new _M0TP26mizchi7signals10CoreSignalGRPB5ArrayGiEE(_M0MP26mizchi7signals12ReactiveNode3new(_M0MP26mizchi7signals13ReactiveFlags7to__int(1)), initial, initial);
  }
  function _M0MP26mizchi7signals6Signal3newGRP314vlmkit_2dsites4maps4main4ViewE(initial) {
    return new _M0TP26mizchi7signals6SignalGRP314vlmkit_2dsites4maps4main4ViewE(_M0FP26mizchi7signals12core__signalGRP314vlmkit_2dsites4maps4main4ViewE(initial));
  }
  function _M0MP26mizchi7signals6Signal3newGiE(initial) {
    return new _M0TP26mizchi7signals6SignalGiE(_M0FP26mizchi7signals12core__signalGiE(initial));
  }
  function _M0MP26mizchi7signals6Signal3newGdE(initial) {
    return new _M0TP26mizchi7signals6SignalGdE(_M0FP26mizchi7signals12core__signalGdE(initial));
  }
  function _M0MP26mizchi7signals6Signal3newGbE(initial) {
    return new _M0TP26mizchi7signals6SignalGbE(_M0FP26mizchi7signals12core__signalGbE(initial));
  }
  function _M0MP26mizchi7signals6Signal3newGRPB5ArrayGiEE(initial) {
    return new _M0TP26mizchi7signals6SignalGRPB5ArrayGiEE(_M0FP26mizchi7signals12core__signalGRPB5ArrayGiEE(initial));
  }
  function _M0FP26mizchi7signals6signalGRP314vlmkit_2dsites4maps4main4ViewE(initial) {
    return _M0MP26mizchi7signals6Signal3newGRP314vlmkit_2dsites4maps4main4ViewE(initial);
  }
  function _M0FP26mizchi7signals6signalGiE(initial) {
    return _M0MP26mizchi7signals6Signal3newGiE(initial);
  }
  function _M0FP26mizchi7signals6signalGdE(initial) {
    return _M0MP26mizchi7signals6Signal3newGdE(initial);
  }
  function _M0FP26mizchi7signals6signalGbE(initial) {
    return _M0MP26mizchi7signals6Signal3newGbE(initial);
  }
  function _M0FP26mizchi7signals6signalGRPB5ArrayGiEE(initial) {
    return _M0MP26mizchi7signals6Signal3newGRPB5ArrayGiEE(initial);
  }
  function _M0MP26mizchi7signals10CoreSignal3setGRP314vlmkit_2dsites4maps4main4ViewE(self, value) {
    if (!(self.pending_value === value)) {
      self.pending_value = value;
      _M0FP26mizchi7signals10inc__cycle();
      self.node.last_modified_cycle = _M0FP26mizchi7signals5cycle.val;
      _M0MP26mizchi7signals5Flags10set__value(self.node.flags, _M0MP26mizchi7signals13ReactiveFlags7to__int(1) | _M0MP26mizchi7signals13ReactiveFlags7to__int(16));
      const _bind = self.node.subs;
      if (_bind === undefined) {
        return;
      } else {
        const _Some = _bind;
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
      const _bind = self.node.subs;
      if (_bind === undefined) {
        return;
      } else {
        const _Some = _bind;
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
  function _M0MP26mizchi7signals10CoreSignal3setGdE(self, value) {
    if (!(self.pending_value === value)) {
      self.pending_value = value;
      _M0FP26mizchi7signals10inc__cycle();
      self.node.last_modified_cycle = _M0FP26mizchi7signals5cycle.val;
      _M0MP26mizchi7signals5Flags10set__value(self.node.flags, _M0MP26mizchi7signals13ReactiveFlags7to__int(1) | _M0MP26mizchi7signals13ReactiveFlags7to__int(16));
      const _bind = self.node.subs;
      if (_bind === undefined) {
        return;
      } else {
        const _Some = _bind;
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
      const _bind = self.node.subs;
      if (_bind === undefined) {
        return;
      } else {
        const _Some = _bind;
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
  function _M0MP26mizchi7signals10CoreSignal3setGRPB5ArrayGiEE(self, value) {
    if (!(self.pending_value === value)) {
      self.pending_value = value;
      _M0FP26mizchi7signals10inc__cycle();
      self.node.last_modified_cycle = _M0FP26mizchi7signals5cycle.val;
      _M0MP26mizchi7signals5Flags10set__value(self.node.flags, _M0MP26mizchi7signals13ReactiveFlags7to__int(1) | _M0MP26mizchi7signals13ReactiveFlags7to__int(16));
      const _bind = self.node.subs;
      if (_bind === undefined) {
        return;
      } else {
        const _Some = _bind;
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
  function _M0MP26mizchi7signals6Signal3setGRP314vlmkit_2dsites4maps4main4ViewE(self, new_value) {
    _M0MP26mizchi7signals10CoreSignal3setGRP314vlmkit_2dsites4maps4main4ViewE(self.inner, new_value);
  }
  function _M0MP26mizchi7signals6Signal3setGiE(self, new_value) {
    _M0MP26mizchi7signals10CoreSignal3setGiE(self.inner, new_value);
  }
  function _M0MP26mizchi7signals6Signal3setGdE(self, new_value) {
    _M0MP26mizchi7signals10CoreSignal3setGdE(self.inner, new_value);
  }
  function _M0MP26mizchi7signals6Signal3setGbE(self, new_value) {
    _M0MP26mizchi7signals10CoreSignal3setGbE(self.inner, new_value);
  }
  function _M0MP26mizchi7signals6Signal3setGRPB5ArrayGiEE(self, new_value) {
    _M0MP26mizchi7signals10CoreSignal3setGRPB5ArrayGiEE(self.inner, new_value);
  }
  function _M0MP26mizchi7signals10CoreSignal6updateGiE(self, f) {
    _M0MP26mizchi7signals10CoreSignal3setGiE(self, f(_M0MP26mizchi7signals10CoreSignal3getGiE(self)));
  }
  function _M0MP26mizchi7signals10CoreSignal6updateGbE(self, f) {
    _M0MP26mizchi7signals10CoreSignal3setGbE(self, f(_M0MP26mizchi7signals10CoreSignal3getGbE(self)));
  }
  function _M0MP26mizchi7signals10CoreSignal6updateGRPB5ArrayGiEE(self, f) {
    _M0MP26mizchi7signals10CoreSignal3setGRPB5ArrayGiEE(self, f(_M0MP26mizchi7signals10CoreSignal3getGRPB5ArrayGiEE(self)));
  }
  function _M0MP26mizchi7signals6Signal6updateGiE(self, f) {
    _M0MP26mizchi7signals10CoreSignal6updateGiE(self.inner, f);
  }
  function _M0MP26mizchi7signals6Signal6updateGbE(self, f) {
    _M0MP26mizchi7signals10CoreSignal6updateGbE(self.inner, f);
  }
  function _M0MP26mizchi7signals6Signal6updateGRPB5ArrayGiEE(self, f) {
    _M0MP26mizchi7signals10CoreSignal6updateGRPB5ArrayGiEE(self.inner, f);
  }
  function _M0FP26mizchi7signals16create__computedGORP314vlmkit_2dsites4maps4main5RouteE(getter) {
    return new _M0TP26mizchi7signals8ComputedGORP314vlmkit_2dsites4maps4main5RouteE(_M0MP26mizchi7signals12ReactiveNode3new(_M0MP26mizchi7signals13ReactiveFlags7to__int(0)), _M0DTPC16option6OptionGORP314vlmkit_2dsites4maps4main5RouteE4None__, getter);
  }
  function _M0FP26mizchi7signals16create__computedGiE(getter) {
    return new _M0TP26mizchi7signals8ComputedGiE(_M0MP26mizchi7signals12ReactiveNode3new(_M0MP26mizchi7signals13ReactiveFlags7to__int(0)), undefined, getter);
  }
  function _M0FP26mizchi7signals16create__computedGRP314vlmkit_2dsites4maps4main8ClustersE(getter) {
    return new _M0TP26mizchi7signals8ComputedGRP314vlmkit_2dsites4maps4main8ClustersE(_M0MP26mizchi7signals12ReactiveNode3new(_M0MP26mizchi7signals13ReactiveFlags7to__int(0)), undefined, getter);
  }
  function _M0FP26mizchi7signals18check__deps__dirty(node) {
    const dirty_flag = _M0MP26mizchi7signals13ReactiveFlags7to__int(16);
    const pending_flag = _M0MP26mizchi7signals13ReactiveFlags7to__int(32);
    const mutable_flag = _M0MP26mizchi7signals13ReactiveFlags7to__int(1);
    let current_link = node.deps;
    while (true) {
      const _bind = current_link;
      if (_bind === undefined) {
        break;
      } else {
        const _Some = _bind;
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
  function _M0FP26mizchi7signals16update__computedGORP314vlmkit_2dsites4maps4main5RouteE(c) {
    _M0FP26mizchi7signals10inc__cycle();
    c.node.deps_tail = undefined;
    _M0MP26mizchi7signals5Flags10set__value(c.node.flags, _M0MP26mizchi7signals13ReactiveFlags7to__int(1) | _M0MP26mizchi7signals13ReactiveFlags7to__int(4));
    const prev_sub = _M0FP26mizchi7signals16set__active__sub(c.node);
    const old_value = c.value;
    const _func = c.getter;
    const new_value = _func();
    c.value = new _M0DTPC16option6OptionGORP314vlmkit_2dsites4maps4main5RouteE4Some(new_value);
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
  function _M0FP26mizchi7signals16update__computedGiE(c) {
    _M0FP26mizchi7signals10inc__cycle();
    c.node.deps_tail = undefined;
    _M0MP26mizchi7signals5Flags10set__value(c.node.flags, _M0MP26mizchi7signals13ReactiveFlags7to__int(1) | _M0MP26mizchi7signals13ReactiveFlags7to__int(4));
    const prev_sub = _M0FP26mizchi7signals16set__active__sub(c.node);
    const old_value = c.value;
    const _func = c.getter;
    const new_value = _func();
    c.value = new_value;
    _M0FP26mizchi7signals16set__active__sub(prev_sub);
    const _p = c.node.flags;
    const current_flags = _p.value;
    _M0MP26mizchi7signals5Flags10set__value(c.node.flags, current_flags & (_M0MP26mizchi7signals13ReactiveFlags7to__int(4) ^ -1));
    _M0FP26mizchi7signals11purge__deps(c.node);
    if (old_value === undefined) {
      return true;
    } else {
      const _Some = old_value;
      const _old = _Some;
      return !(_old === new_value);
    }
  }
  function _M0FP26mizchi7signals16update__computedGRP314vlmkit_2dsites4maps4main8ClustersE(c) {
    _M0FP26mizchi7signals10inc__cycle();
    c.node.deps_tail = undefined;
    _M0MP26mizchi7signals5Flags10set__value(c.node.flags, _M0MP26mizchi7signals13ReactiveFlags7to__int(1) | _M0MP26mizchi7signals13ReactiveFlags7to__int(4));
    const prev_sub = _M0FP26mizchi7signals16set__active__sub(c.node);
    const old_value = c.value;
    const _func = c.getter;
    const new_value = _func();
    c.value = new_value;
    _M0FP26mizchi7signals16set__active__sub(prev_sub);
    const _p = c.node.flags;
    const current_flags = _p.value;
    _M0MP26mizchi7signals5Flags10set__value(c.node.flags, current_flags & (_M0MP26mizchi7signals13ReactiveFlags7to__int(4) ^ -1));
    _M0FP26mizchi7signals11purge__deps(c.node);
    if (old_value === undefined) {
      return true;
    } else {
      const _Some = old_value;
      const _old = _Some;
      return !(_old === new_value);
    }
  }
  function _M0MP26mizchi7signals8Computed3getGORP314vlmkit_2dsites4maps4main5RouteE(self) {
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
      if (_M0FP26mizchi7signals16update__computedGORP314vlmkit_2dsites4maps4main5RouteE(self)) {
        const _bind = self.node.subs;
        if (_bind === undefined) {
        } else {
          const _Some = _bind;
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
          self.value = new _M0DTPC16option6OptionGORP314vlmkit_2dsites4maps4main5RouteE4Some(_func());
          _M0FP26mizchi7signals16set__active__sub(prev_sub);
          const _p$2 = self.node.flags;
          const current_flags = _p$2.value;
          _M0MP26mizchi7signals5Flags10set__value(self.node.flags, current_flags & (recursed_check_flag ^ -1));
        }
      }
    }
    const _bind = _M0FP26mizchi7signals11active__sub.val;
    if (_bind === undefined) {
    } else {
      const _Some = _bind;
      const _sub = _Some;
      _M0FP26mizchi7signals4link(self.node, _sub, _M0FP26mizchi7signals5cycle.val);
    }
    const _bind$2 = self.value;
    if (_bind$2.$tag === 1) {
      const _Some = _bind$2;
      return _Some._0;
    } else {
      return $panic();
    }
  }
  function _M0MP26mizchi7signals8Computed3getGiE(self) {
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
      if (_M0FP26mizchi7signals16update__computedGiE(self)) {
        const _bind = self.node.subs;
        if (_bind === undefined) {
        } else {
          const _Some = _bind;
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
          self.value = _func();
          _M0FP26mizchi7signals16set__active__sub(prev_sub);
          const _p$2 = self.node.flags;
          const current_flags = _p$2.value;
          _M0MP26mizchi7signals5Flags10set__value(self.node.flags, current_flags & (recursed_check_flag ^ -1));
        }
      }
    }
    const _bind = _M0FP26mizchi7signals11active__sub.val;
    if (_bind === undefined) {
    } else {
      const _Some = _bind;
      const _sub = _Some;
      _M0FP26mizchi7signals4link(self.node, _sub, _M0FP26mizchi7signals5cycle.val);
    }
    const _bind$2 = self.value;
    if (_bind$2 === undefined) {
      return $panic();
    } else {
      const _Some = _bind$2;
      return _Some;
    }
  }
  function _M0MP26mizchi7signals8Computed3getGRP314vlmkit_2dsites4maps4main8ClustersE(self) {
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
      if (_M0FP26mizchi7signals16update__computedGRP314vlmkit_2dsites4maps4main8ClustersE(self)) {
        const _bind = self.node.subs;
        if (_bind === undefined) {
        } else {
          const _Some = _bind;
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
          self.value = _func();
          _M0FP26mizchi7signals16set__active__sub(prev_sub);
          const _p$2 = self.node.flags;
          const current_flags = _p$2.value;
          _M0MP26mizchi7signals5Flags10set__value(self.node.flags, current_flags & (recursed_check_flag ^ -1));
        }
      }
    }
    const _bind = _M0FP26mizchi7signals11active__sub.val;
    if (_bind === undefined) {
    } else {
      const _Some = _bind;
      const _sub = _Some;
      _M0FP26mizchi7signals4link(self.node, _sub, _M0FP26mizchi7signals5cycle.val);
    }
    const _bind$2 = self.value;
    if (_bind$2 === undefined) {
      return $panic();
    } else {
      const _Some = _bind$2;
      return _Some;
    }
  }
  function _M0FP26mizchi7signals4memoGORP314vlmkit_2dsites4maps4main5RouteE(compute) {
    const inner = _M0FP26mizchi7signals16create__computedGORP314vlmkit_2dsites4maps4main5RouteE(compute);
    return () => _M0MP26mizchi7signals8Computed3getGORP314vlmkit_2dsites4maps4main5RouteE(inner);
  }
  function _M0FP26mizchi7signals4memoGiE(compute) {
    const inner = _M0FP26mizchi7signals16create__computedGiE(compute);
    return () => _M0MP26mizchi7signals8Computed3getGiE(inner);
  }
  function _M0FP26mizchi7signals4memoGRP314vlmkit_2dsites4maps4main8ClustersE(compute) {
    const inner = _M0FP26mizchi7signals16create__computedGRP314vlmkit_2dsites4maps4main8ClustersE(compute);
    return () => _M0MP26mizchi7signals8Computed3getGRP314vlmkit_2dsites4maps4main8ClustersE(inner);
  }
  function _M0FP26mizchi7signals10batch__end() {
    _M0FP26mizchi7signals17reactive__context.batch_depth = _M0FP26mizchi7signals17reactive__context.batch_depth - 1 | 0;
    _M0FP26mizchi7signals10end__batch();
  }
  function _M0FP26mizchi7signals12batch__start() {
    _M0FP26mizchi7signals17reactive__context.batch_depth = _M0FP26mizchi7signals17reactive__context.batch_depth + 1 | 0;
    _M0FP26mizchi7signals12start__batch();
  }
  function _M0FP26mizchi7signals5batchGuE(f) {
    _M0FP26mizchi7signals12batch__start();
    f();
    _M0FP26mizchi7signals10batch__end();
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
    let _tmp = self.children.length - 1 | 0;
    while (true) {
      const i = _tmp;
      if (i >= 0) {
        _M0MP26mizchi7signals5Owner7dispose(_M0MPC15array5Array2atGUsiEE(self.children, i));
        _tmp = i - 1 | 0;
        continue;
      } else {
        break;
      }
    }
    let _tmp$2 = self.disposers.length - 1 | 0;
    while (true) {
      const i = _tmp$2;
      if (i >= 0) {
        const _func = _M0MPC15array5Array2atGUsiEE(self.disposers, i);
        _func();
        _tmp$2 = i - 1 | 0;
        continue;
      } else {
        break;
      }
    }
    let _tmp$3 = self.cleanups.length - 1 | 0;
    while (true) {
      const i = _tmp$3;
      if (i >= 0) {
        const _func = _M0MPC15array5Array2atGUsiEE(self.cleanups, i);
        _func();
        _tmp$3 = i - 1 | 0;
        continue;
      } else {
        break;
      }
    }
    _M0MPC15array5Array5clearGRP26mizchi7signals5OwnerE(self.children);
    _M0MPC15array5Array5clearGRP26mizchi7signals5OwnerE(self.disposers);
    _M0MPC15array5Array5clearGRP26mizchi7signals5OwnerE(self.cleanups);
    const _bind = self.parent;
    if (_bind === undefined) {
      return;
    } else {
      const _Some = _bind;
      const _p = _Some;
      const _p$2 = _p.children;
      const _p$3 = _p$2.length;
      const _p$4 = _p$2.length;
      let _p$5;
      let _tmp$4 = 0;
      let _tmp$5 = 0;
      while (true) {
        const _p$6 = _tmp$4;
        const _p$7 = _tmp$5;
        if (_p$6 < _p$4) {
          const _p$8 = _p$2[_p$6];
          if (_p$8.id !== self.id) {
            if (_p$6 !== _p$7) {
              _p$2[_p$7] = _p$8;
            }
            _tmp$4 = _p$6 + 1 | 0;
            _tmp$5 = _p$7 + 1 | 0;
            continue;
          }
          _tmp$4 = _p$6 + 1 | 0;
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
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(_p.children, owner);
    }
    return owner;
  }
  function _M0FP26mizchi7signals9untrackedGRPB5ArrayGRP36mizchi11js__browser3dom4NodeEE(f) {
    const prev_core = _M0FP26mizchi7signals16set__active__sub(undefined);
    const result = f();
    _M0FP26mizchi7signals16set__active__sub(prev_core);
    return result;
  }
  function _M0FP26mizchi7signals9untrackedGRP36mizchi4luna3dom10IndexEntryE(f) {
    const prev_core = _M0FP26mizchi7signals16set__active__sub(undefined);
    const result = f();
    _M0FP26mizchi7signals16set__active__sub(prev_core);
    return result;
  }
  function _M0FP26mizchi7signals9untrackedGiE(f) {
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
  function _M0FP26mizchi7signals19with__parent__ownerGRP36mizchi4luna3dom7DomNodeE(captured_owner, f) {
    if (captured_owner === undefined) {
      return f();
    } else {
      const _Some = captured_owner;
      const _parent = _Some;
      return _M0FP26mizchi7signals16run__with__ownerGRP36mizchi4luna3dom7DomNodeE(_parent, f);
    }
  }
  function _M0FP46mizchi4luna2js8resource8memo__eqGiE(compute) {
    const inner = _M0FP26mizchi7signals4memoGiE(compute);
    const out = _M0FP26mizchi7signals6signalGiE(_M0FP26mizchi7signals9untrackedGiE(inner));
    _M0FP26mizchi7signals5watchGiE(inner, (next, _prev) => {
      _M0MP26mizchi7signals6Signal3setGiE(out, next);
    });
    return () => _M0MP26mizchi7signals6Signal3getGiE(out);
  }
  function _M0FP46mizchi4luna2js8resource8memo__eqGRPB5ArrayGiEE(compute) {
    const inner = _M0FP26mizchi7signals4memoGORP314vlmkit_2dsites4maps4main5RouteE(compute);
    const out = _M0FP26mizchi7signals6signalGRPB5ArrayGiEE(_M0FP26mizchi7signals9untrackedGRPB5ArrayGRP36mizchi11js__browser3dom4NodeEE(inner));
    _M0FP26mizchi7signals5watchGRPB5ArrayGiEE(inner, (next, _prev) => {
      _M0MP26mizchi7signals6Signal3setGRPB5ArrayGiEE(out, next);
    });
    return () => _M0MP26mizchi7signals6Signal3getGRPB5ArrayGiEE(out);
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
    const _bind = attrs.length;
    let _tmp = 0;
    while (true) {
      const _ = _tmp;
      if (_ < _bind) {
        const attr = attrs[_];
        const _name = attr._0;
        const _value = attr._1;
        _M0FP36mizchi4luna3dom16apply__attribute(elem, _name, _value);
        _tmp = _ + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    const _bind$2 = children.length;
    let _tmp$2 = 0;
    while (true) {
      const _ = _tmp$2;
      if (_ < _bind$2) {
        const child = children[_];
        _M0MP36mizchi11js__browser3dom4Node11appendChild(elem, _M0MP36mizchi4luna3dom7DomNode7to__dom(child));
        _tmp$2 = _ + 1 | 0;
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
    const _bind = attrs.length;
    let _tmp = 0;
    while (true) {
      const _ = _tmp;
      if (_ < _bind) {
        const attr = attrs[_];
        const _name = attr._0;
        const _value = attr._1;
        _M0FP36mizchi4luna3dom16apply__attribute(elem, _name, _value);
        _tmp = _ + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    const _bind$2 = children.length;
    let _tmp$2 = 0;
    while (true) {
      const _ = _tmp$2;
      if (_ < _bind$2) {
        const child = children[_];
        _M0MP36mizchi11js__browser3dom4Node11appendChild(elem, _M0MP36mizchi4luna3dom7DomNode7to__dom(child));
        _tmp$2 = _ + 1 | 0;
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
        const _bind = _M0MP36mizchi11js__browser3dom4Node10firstChild(node);
        if (_bind.$tag === 1) {
          const _Some = _bind;
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
      const _bind = child_nodes.length;
      let _tmp = 0;
      while (true) {
        const i = _tmp;
        if (i < _bind) {
          _M0MPC15array5Array4pushGRP36mizchi11js__browser3dom4NodeE(children, _M0MPC15array5Array2atGORP26mizchi7signals10EffectNodeE(child_nodes, i));
          _tmp = i + 1 | 0;
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
    const _bind = children.length;
    switch (_bind) {
      case 0: {
        const doc = _M0FP36mizchi11js__browser3dom8document();
        const frag = _M0MP36mizchi11js__browser3dom8Document22createDocumentFragment(doc);
        return new _M0DTP36mizchi4luna3dom7DomNode3Raw(frag);
      }
      case 1: {
        return _M0MPC15array5Array2atGUsiEE(children, 0);
      }
      default: {
        const doc$2 = _M0FP36mizchi11js__browser3dom8document();
        const frag$2 = _M0MP36mizchi11js__browser3dom8Document22createDocumentFragment(doc$2);
        const _bind$2 = children.length;
        let _tmp = 0;
        while (true) {
          const _ = _tmp;
          if (_ < _bind$2) {
            const child = children[_];
            _M0MP36mizchi11js__browser3dom4Node11appendChild(frag$2, _M0MP36mizchi4luna3dom7DomNode7to__dom(child));
            _tmp = _ + 1 | 0;
            continue;
          } else {
            break;
          }
        }
        return new _M0DTP36mizchi4luna3dom7DomNode3Raw(frag$2);
      }
    }
  }
  function _M0FP36mizchi4luna3dom4showN19render__with__scopeS2019(_env) {
    const current_dispose = _env._2;
    const captured_owner = _env._1;
    const render_fn = _env._0;
    return _M0FP26mizchi7signals19with__parent__ownerGRPB5ArrayGRP36mizchi11js__browser3dom4NodeEE(captured_owner, () => {
      const _bind = _M0FP26mizchi7signals27create__root__with__disposeGRP36mizchi4luna3dom7DomNodeE(() => render_fn());
      const _dom = _bind._0;
      const _dispose = _bind._1;
      current_dispose.val = _dispose;
      return _M0FP36mizchi4luna3dom21collect__child__nodes(_M0MP36mizchi4luna3dom7DomNode7to__dom(_dom));
    });
  }
  function _M0FP36mizchi4luna3dom4show(when, render_fn) {
    const doc = _M0FP36mizchi11js__browser3dom8document();
    const placeholder = _M0MP36mizchi11js__browser3dom8Document13createComment(doc, "show");
    const captured_owner = _M0FP26mizchi7signals17reactive__context.current_owner;
    const current_dispose = _M0MPC13ref3Ref3RefGRPB5ArrayGRP36mizchi11js__browser3dom4NodeEE(undefined);
    const _env = { _0: render_fn, _1: captured_owner, _2: current_dispose };
    const initial_show = _M0FP26mizchi7signals9untrackedGbE(() => when());
    const initial_nodes = initial_show ? _M0FP26mizchi7signals9untrackedGRPB5ArrayGRP36mizchi11js__browser3dom4NodeEE(() => _M0FP36mizchi4luna3dom4showN19render__with__scopeS2019(_env)) : [];
    const current_nodes = _M0MPC13ref3Ref3RefGRPB5ArrayGRP36mizchi11js__browser3dom4NodeEE(initial_nodes);
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
          const _bind = _M0MP36mizchi11js__browser3dom4Node10parentNode(placeholder);
          if (_bind.$tag === 1) {
            const _Some = _bind;
            const _parent = _Some._0;
            const nodes = _M0FP26mizchi7signals9untrackedGRPB5ArrayGRP36mizchi11js__browser3dom4NodeEE(() => _M0FP36mizchi4luna3dom4showN19render__with__scopeS2019(_env));
            const _bind$2 = nodes.length;
            let _tmp = 0;
            while (true) {
              const _ = _tmp;
              if (_ < _bind$2) {
                const node = nodes[_];
                _M0MP36mizchi11js__browser3dom4Node12insertBefore(_parent, node, new _M0DTPC16option6OptionGRP36mizchi11js__browser3dom4NodeE4Some(placeholder));
                _tmp = _ + 1 | 0;
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
          const _bind = current_dispose.val;
          if (_bind === undefined) {
          } else {
            const _Some = _bind;
            const _dispose = _Some;
            _dispose();
            current_dispose.val = undefined;
          }
          const _bind$2 = current_nodes.val;
          const _bind$3 = _bind$2.length;
          let _tmp = 0;
          while (true) {
            const _ = _tmp;
            if (_ < _bind$3) {
              const node = _bind$2[_];
              const _bind$4 = _M0MP36mizchi11js__browser3dom4Node10parentNode(node);
              if (_bind$4.$tag === 1) {
                const _Some = _bind$4;
                const _parent = _Some._0;
                _M0MP36mizchi11js__browser3dom4Node11removeChild(_parent, node);
              }
              _tmp = _ + 1 | 0;
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
      const _bind = initial_nodes.length;
      let _tmp = 0;
      while (true) {
        const _ = _tmp;
        if (_ < _bind) {
          const node = initial_nodes[_];
          _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(all_nodes, new _M0DTP36mizchi4luna3dom7DomNode3Raw(node));
          _tmp = _ + 1 | 0;
          continue;
        } else {
          break;
        }
      }
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(all_nodes, new _M0DTP36mizchi4luna3dom7DomNode3Raw(placeholder));
      return _M0FP36mizchi4luna3dom8fragment(all_nodes);
    } else {
      return new _M0DTP36mizchi4luna3dom7DomNode3Raw(placeholder);
    }
  }
  function _M0FP36mizchi4luna3dom24build__entry__index__mapGiE(entries) {
    const map = _M0FP36mizchi4luna3dom13ref__map__new();
    const _bind = entries.length;
    let _tmp = 0;
    while (true) {
      const i = _tmp;
      if (i < _bind) {
        const entry = entries[i];
        const key = entry.item;
        if (!_M0FP36mizchi4luna3dom13ref__map__has(map, key)) {
          _M0FP36mizchi4luna3dom13ref__map__set(map, key, i);
        }
        _tmp = i + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return map;
  }
  function _M0FP36mizchi4luna3dom10ref__equalGiE(a, b) {
    return _M0FP36mizchi4luna3dom15ref__equal__any(a, b);
  }
  function _M0FP36mizchi4luna3dom18find__entry__indexGiE(map, item, used_indices, old_entries) {
    const key = item;
    const first = _M0FP36mizchi4luna3dom25ref__map__get__or__minus1(map, key);
    if (first >= 0 && !_M0MPC15array5Array2atGbE(used_indices, first)) {
      return first;
    }
    const _bind = old_entries.length;
    let _tmp = 0;
    while (true) {
      const i = _tmp;
      if (i < _bind) {
        const entry = old_entries[i];
        if (!_M0MPC15array5Array2atGbE(used_indices, i) && _M0FP36mizchi4luna3dom10ref__equalGiE(entry.item, item)) {
          return i;
        }
        _tmp = i + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return -1;
  }
  function _M0FP36mizchi4luna3dom20has__duplicate__refsGiE(items) {
    const seen = _M0FP36mizchi4luna3dom13ref__map__new();
    const _bind = items.length;
    let _tmp = 0;
    while (true) {
      const _ = _tmp;
      if (_ < _bind) {
        const item = items[_];
        const key = item;
        if (_M0FP36mizchi4luna3dom13ref__map__has(seen, key)) {
          return true;
        }
        _M0FP36mizchi4luna3dom13ref__map__set(seen, key, 1);
        _tmp = _ + 1 | 0;
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
    const _bind = nodes.length;
    let _tmp = 0;
    while (true) {
      const _ = _tmp;
      if (_ < _bind) {
        const node = nodes[_];
        _M0FP36mizchi4luna3dom12move__before(parent, node, new _M0DTPC16option6OptionGRP36mizchi11js__browser3dom4NodeE4Some(cursor));
        _tmp = _ + 1 | 0;
        continue;
      } else {
        return;
      }
    }
  }
  function _M0FP36mizchi4luna3dom19safe__remove__nodes(parent, nodes) {
    const _bind = nodes.length;
    let _tmp = 0;
    while (true) {
      const _ = _tmp;
      if (_ < _bind) {
        const node = nodes[_];
        _M0FP36mizchi4luna3dom19safe__remove__child(parent, node);
        _tmp = _ + 1 | 0;
        continue;
      } else {
        return;
      }
    }
  }
  function _M0MP36mizchi4luna3dom9ItemEntry3newGiE(item, dom) {
    return new _M0TP36mizchi4luna3dom9ItemEntryGiE(item, dom, dom, [dom], () => {
    });
  }
  function _M0MP36mizchi4luna3dom9ItemEntry30new__with__nodes__and__disposeGiE(item, nodes, dispose) {
    const first = _M0MPC15array5Array2atGORP26mizchi7signals10EffectNodeE(nodes, 0);
    const last = _M0MPC15array5Array2atGORP26mizchi7signals10EffectNodeE(nodes, nodes.length - 1 | 0);
    return new _M0TP36mizchi4luna3dom9ItemEntryGiE(item, first, last, nodes, dispose);
  }
  function _M0FP36mizchi4luna3dom31reconcile__items__with__disposeGiE(parent, old_entries, new_items, render_item, end_marker) {
    const n = new_items.length;
    if (n === 0) {
      const _bind = old_entries.length;
      let _tmp = 0;
      while (true) {
        const _ = _tmp;
        if (_ < _bind) {
          const entry = old_entries[_];
          const _func = entry.dispose;
          _func();
          _M0FP36mizchi4luna3dom19safe__remove__nodes(parent, entry.nodes);
          _tmp = _ + 1 | 0;
          continue;
        } else {
          break;
        }
      }
      return [];
    }
    if (_M0FP36mizchi4luna3dom20has__duplicate__refsGiE(new_items)) {
      const _bind = old_entries.length;
      let _tmp = 0;
      while (true) {
        const _ = _tmp;
        if (_ < _bind) {
          const entry = old_entries[_];
          const _func = entry.dispose;
          _func();
          _M0FP36mizchi4luna3dom19safe__remove__nodes(parent, entry.nodes);
          _tmp = _ + 1 | 0;
          continue;
        } else {
          break;
        }
      }
      const fresh_entries = [];
      const _bind$2 = new_items.length;
      let _tmp$2 = 0;
      while (true) {
        const i = _tmp$2;
        if (i < _bind$2) {
          const item = new_items[i];
          const _bind$3 = render_item(item, i);
          const _dom = _bind$3._0;
          const _dispose = _bind$3._1;
          const nodes = _M0FP36mizchi4luna3dom19collect__dom__nodes(_dom);
          if (nodes.length === 0) {
            const placeholder = _M0MP36mizchi11js__browser3dom8Document13createComment(_M0FP36mizchi11js__browser3dom8document(), "empty");
            _M0MP36mizchi11js__browser3dom4Node12insertBefore(parent, placeholder, new _M0DTPC16option6OptionGRP36mizchi11js__browser3dom4NodeE4Some(end_marker));
            _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(fresh_entries, _M0MP36mizchi4luna3dom9ItemEntry30new__with__nodes__and__disposeGiE(item, [placeholder], _dispose));
          } else {
            _M0MP36mizchi11js__browser3dom4Node12insertBefore(parent, _dom, new _M0DTPC16option6OptionGRP36mizchi11js__browser3dom4NodeE4Some(end_marker));
            _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(fresh_entries, _M0MP36mizchi4luna3dom9ItemEntry30new__with__nodes__and__disposeGiE(item, nodes, _dispose));
          }
          _tmp$2 = i + 1 | 0;
          continue;
        } else {
          break;
        }
      }
      return fresh_entries;
    }
    const new_entries = [];
    let _tmp = 0;
    while (true) {
      const _ = _tmp;
      if (_ < n) {
        _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(new_entries, _M0MP36mizchi4luna3dom9ItemEntry3newGiE(_M0MPC15array5Array2atGiE(new_items, 0), end_marker));
        _tmp = _ + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    const used_indices = _M0MPC15array5Array4makeGbE(old_entries.length, false);
    const index_map = _M0FP36mizchi4luna3dom24build__entry__index__mapGiE(old_entries);
    const cursor = _M0MPC13ref3Ref3RefGRPB5ArrayGRP36mizchi11js__browser3dom4NodeEE(end_marker);
    const last = n - 1 | 0;
    let _tmp$2 = last;
    let _tmp$3 = last >= 0;
    while (true) {
      const i = _tmp$2;
      const _more = _tmp$3;
      if (_more) {
        const item = _M0MPC15array5Array2atGiE(new_items, i);
        const old_index = _M0FP36mizchi4luna3dom18find__entry__indexGiE(index_map, item, used_indices, old_entries);
        if (old_index >= 0) {
          const entry = _M0MPC15array5Array2atGUsiEE(old_entries, old_index);
          _M0MPC15array5Array3setGbE(used_indices, old_index, true);
          if (entry.nodes.length > 0) {
            if (!_M0FP36mizchi4luna3dom17next__sibling__is(entry.last, cursor.val)) {
              _M0FP36mizchi4luna3dom19move__nodes__before(parent, entry.nodes, cursor.val);
            }
            cursor.val = entry.dom;
          }
          _M0MPC15array5Array3setGRP36mizchi4luna3dom9ItemEntryGiEE(new_entries, i, entry);
        } else {
          const _bind = render_item(item, i);
          const _dom = _bind._0;
          const _dispose = _bind._1;
          const nodes = _M0FP36mizchi4luna3dom19collect__dom__nodes(_dom);
          if (nodes.length === 0) {
            const placeholder = _M0MP36mizchi11js__browser3dom8Document13createComment(_M0FP36mizchi11js__browser3dom8document(), "empty");
            _M0MP36mizchi11js__browser3dom4Node12insertBefore(parent, placeholder, new _M0DTPC16option6OptionGRP36mizchi11js__browser3dom4NodeE4Some(cursor.val));
            const placeholder_nodes = [placeholder];
            cursor.val = placeholder;
            _M0MPC15array5Array3setGRP36mizchi4luna3dom9ItemEntryGiEE(new_entries, i, _M0MP36mizchi4luna3dom9ItemEntry30new__with__nodes__and__disposeGiE(item, placeholder_nodes, _dispose));
          } else {
            _M0MP36mizchi11js__browser3dom4Node12insertBefore(parent, _dom, new _M0DTPC16option6OptionGRP36mizchi11js__browser3dom4NodeE4Some(cursor.val));
            cursor.val = _M0MPC15array5Array2atGORP26mizchi7signals10EffectNodeE(nodes, 0);
            _M0MPC15array5Array3setGRP36mizchi4luna3dom9ItemEntryGiEE(new_entries, i, _M0MP36mizchi4luna3dom9ItemEntry30new__with__nodes__and__disposeGiE(item, nodes, _dispose));
          }
        }
        _tmp$2 = i - 1 | 0;
        _tmp$3 = i > 0;
        continue;
      } else {
        break;
      }
    }
    const _bind = old_entries.length;
    let _tmp$4 = 0;
    while (true) {
      const i = _tmp$4;
      if (i < _bind) {
        const entry = old_entries[i];
        if (!_M0MPC15array5Array2atGbE(used_indices, i)) {
          const _func = entry.dispose;
          _func();
          _M0FP36mizchi4luna3dom19safe__remove__nodes(parent, entry.nodes);
        }
        _tmp$4 = i + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return new_entries;
  }
  function _M0FP36mizchi4luna3dom35reconcile__for__each__with__disposeGiE(entries_ref, placeholder, new_items, render_item) {
    const _bind = _M0MP36mizchi11js__browser3dom4Node10parentNode(placeholder);
    if (_bind.$tag === 1) {
      const _Some = _bind;
      const _parent = _Some._0;
      entries_ref.val = _M0FP36mizchi4luna3dom31reconcile__items__with__disposeGiE(_parent, entries_ref.val, new_items, render_item, placeholder);
      return;
    } else {
      return;
    }
  }
  function _M0FP36mizchi4luna3dom9for__eachGiE(items, render_item) {
    const doc = _M0FP36mizchi11js__browser3dom8document();
    const placeholder = _M0MP36mizchi11js__browser3dom8Document13createComment(doc, "for");
    const entries = _M0MPC13ref3Ref3RefGRPB5ArrayGRP36mizchi11js__browser3dom4NodeEE([]);
    const is_first = _M0MPC13ref3Ref3RefGbE(true);
    const captured_owner = _M0FP26mizchi7signals17reactive__context.current_owner;
    const render_with_scope = (item, i) => _M0FP26mizchi7signals19with__parent__ownerGRP36mizchi4luna3dom7DomNodeE(captured_owner, () => {
      const _bind = _M0FP26mizchi7signals27create__root__with__disposeGRP36mizchi4luna3dom7DomNodeE(() => render_item(item, i));
      const _dom = _bind._0;
      const _dispose = _bind._1;
      return { _0: _M0MP36mizchi4luna3dom7DomNode7to__dom(_dom), _1: _dispose };
    });
    const fragment = _M0MP36mizchi11js__browser3dom8Document22createDocumentFragment(doc);
    const initial_items = _M0FP26mizchi7signals9untrackedGRPB5ArrayGRP36mizchi11js__browser3dom4NodeEE(() => items());
    const _bind = initial_items.length;
    let _tmp = 0;
    while (true) {
      const i = _tmp;
      if (i < _bind) {
        const item = initial_items[i];
        const _bind$2 = _M0FP26mizchi7signals9untrackedGRP36mizchi4luna3dom10IndexEntryE(() => render_with_scope(item, i));
        const _dom = _bind$2._0;
        const _dispose = _bind$2._1;
        const nodes = _M0FP36mizchi4luna3dom19collect__dom__nodes(_dom);
        if (nodes.length === 0) {
          const placeholder$2 = _M0MP36mizchi11js__browser3dom8Document13createComment(doc, "empty");
          _M0MP36mizchi11js__browser3dom4Node11appendChild(fragment, placeholder$2);
          _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(entries.val, _M0MP36mizchi4luna3dom9ItemEntry30new__with__nodes__and__disposeGiE(item, [placeholder$2], _dispose));
        } else {
          _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(entries.val, _M0MP36mizchi4luna3dom9ItemEntry30new__with__nodes__and__disposeGiE(item, nodes, _dispose));
          _M0MP36mizchi11js__browser3dom4Node11appendChild(fragment, _dom);
        }
        _tmp = i + 1 | 0;
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
  function _M0MP36mizchi4luna3dom10IndexEntry3new(node, dispose, disposed) {
    return new _M0TP36mizchi4luna3dom10IndexEntry(node, dispose, disposed);
  }
  function _M0FP36mizchi4luna3dom11index__eachN19render__with__scopeS2200GiE(_env, index) {
    const captured_owner = _env._3;
    const doc = _env._2;
    const render_item = _env._1;
    const items = _env._0;
    const disposed = _M0MPC13ref3Ref3RefGbE(false);
    const snapshot = _M0FP26mizchi7signals9untrackedGRPB5ArrayGRP36mizchi11js__browser3dom4NodeEE(() => items());
    if (index >= snapshot.length) {
      const stale = _M0MP36mizchi11js__browser3dom8Document13createComment(doc, "index-stale");
      return _M0MP36mizchi4luna3dom10IndexEntry3new(stale, () => {
      }, disposed);
    } else {
      const initial_value = _M0MPC15array5Array2atGiE(snapshot, index);
      const cached_value = _M0MPC13ref3Ref3RefGOiE(initial_value);
      const item_getter = () => {
        const arr = items();
        const len = arr.length;
        if (disposed.val || index >= len) {
          const _bind = cached_value.val;
          if (_bind === undefined) {
            return initial_value;
          } else {
            const _Some = _bind;
            return _Some;
          }
        } else {
          const value = _M0MPC15array5Array2atGiE(arr, index);
          cached_value.val = value;
          return value;
        }
      };
      const _bind = _M0FP26mizchi7signals27create__root__with__disposeGRP36mizchi4luna3dom7DomNodeE(() => _M0FP26mizchi7signals19with__parent__ownerGRP36mizchi4luna3dom7DomNodeE(captured_owner, () => render_item(item_getter, index)));
      const _dom = _bind._0;
      const _dispose = _bind._1;
      return _M0MP36mizchi4luna3dom10IndexEntry3new(_M0MP36mizchi4luna3dom7DomNode7to__dom(_dom), _dispose, disposed);
    }
  }
  function _M0FP36mizchi4luna3dom11index__eachN19render__with__scopeS2251GRP314vlmkit_2dsites4maps4main4SuggE(_env, index) {
    const captured_owner = _env._3;
    const doc = _env._2;
    const render_item = _env._1;
    const items = _env._0;
    const disposed = _M0MPC13ref3Ref3RefGbE(false);
    const snapshot = _M0FP26mizchi7signals9untrackedGRPB5ArrayGRP36mizchi11js__browser3dom4NodeEE(() => items());
    if (index >= snapshot.length) {
      const stale = _M0MP36mizchi11js__browser3dom8Document13createComment(doc, "index-stale");
      return _M0MP36mizchi4luna3dom10IndexEntry3new(stale, () => {
      }, disposed);
    } else {
      const initial_value = _M0MPC15array5Array2atGUsiEE(snapshot, index);
      const cached_value = _M0MPC13ref3Ref3RefGRPB5ArrayGRP36mizchi11js__browser3dom4NodeEE(initial_value);
      const item_getter = () => {
        const arr = items();
        const len = arr.length;
        if (disposed.val || index >= len) {
          const _bind = cached_value.val;
          if (_bind === undefined) {
            return initial_value;
          } else {
            const _Some = _bind;
            return _Some;
          }
        } else {
          const value = _M0MPC15array5Array2atGUsiEE(arr, index);
          cached_value.val = value;
          return value;
        }
      };
      const _bind = _M0FP26mizchi7signals27create__root__with__disposeGRP36mizchi4luna3dom7DomNodeE(() => _M0FP26mizchi7signals19with__parent__ownerGRP36mizchi4luna3dom7DomNodeE(captured_owner, () => render_item(item_getter, index)));
      const _dom = _bind._0;
      const _dispose = _bind._1;
      return _M0MP36mizchi4luna3dom10IndexEntry3new(_M0MP36mizchi4luna3dom7DomNode7to__dom(_dom), _dispose, disposed);
    }
  }
  function _M0FP36mizchi4luna3dom11index__eachGiE(items, render_item) {
    const doc = _M0FP36mizchi11js__browser3dom8document();
    const placeholder = _M0MP36mizchi11js__browser3dom8Document13createComment(doc, "index");
    const entries = [];
    const is_first = _M0MPC13ref3Ref3RefGbE(true);
    const captured_owner = _M0FP26mizchi7signals17reactive__context.current_owner;
    const _env = { _0: items, _1: render_item, _2: doc, _3: captured_owner };
    const fragment = _M0MP36mizchi11js__browser3dom8Document22createDocumentFragment(doc);
    const initial_items = _M0FP26mizchi7signals9untrackedGRPB5ArrayGRP36mizchi11js__browser3dom4NodeEE(() => items());
    const _bind = initial_items.length;
    let _tmp = 0;
    while (true) {
      const i = _tmp;
      if (i < _bind) {
        const entry = _M0FP26mizchi7signals9untrackedGRP36mizchi4luna3dom10IndexEntryE(() => _M0FP36mizchi4luna3dom11index__eachN19render__with__scopeS2200GiE(_env, i));
        _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(entries, entry);
        _M0MP36mizchi11js__browser3dom4Node11appendChild(fragment, entry.node);
        _tmp = i + 1 | 0;
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
      const new_len = new_items.length;
      while (true) {
        if (entries.length > new_len) {
          const entry = _M0MPC15array5Array3popGRP36mizchi4luna3dom10IndexEntryE(entries);
          if (entry === undefined) {
          } else {
            const _Some = entry;
            const _e = _Some;
            _e.disposed.val = true;
            const _func = _e.dispose;
            _func();
            const _bind$2 = _M0MP36mizchi11js__browser3dom4Node10parentNode(_e.node);
            if (_bind$2.$tag === 1) {
              const _Some$2 = _bind$2;
              const _par = _Some$2._0;
              _M0MP36mizchi11js__browser3dom4Node11removeChild(_par, _e.node);
            }
          }
          continue;
        } else {
          break;
        }
      }
      while (true) {
        if (entries.length < new_len) {
          const i = entries.length;
          const entry = _M0FP26mizchi7signals9untrackedGRP36mizchi4luna3dom10IndexEntryE(() => _M0FP36mizchi4luna3dom11index__eachN19render__with__scopeS2200GiE(_env, i));
          _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(entries, entry);
          const _bind$2 = _M0MP36mizchi11js__browser3dom4Node10parentNode(placeholder);
          if (_bind$2.$tag === 1) {
            const _Some = _bind$2;
            const _par = _Some._0;
            _M0MP36mizchi11js__browser3dom4Node12insertBefore(_par, entry.node, new _M0DTPC16option6OptionGRP36mizchi11js__browser3dom4NodeE4Some(placeholder));
          }
          continue;
        } else {
          break;
        }
      }
    });
    return new _M0DTP36mizchi4luna3dom7DomNode3Raw(fragment);
  }
  function _M0FP36mizchi4luna3dom11index__eachGRP314vlmkit_2dsites4maps4main4SuggE(items, render_item) {
    const doc = _M0FP36mizchi11js__browser3dom8document();
    const placeholder = _M0MP36mizchi11js__browser3dom8Document13createComment(doc, "index");
    const entries = [];
    const is_first = _M0MPC13ref3Ref3RefGbE(true);
    const captured_owner = _M0FP26mizchi7signals17reactive__context.current_owner;
    const _env = { _0: items, _1: render_item, _2: doc, _3: captured_owner };
    const fragment = _M0MP36mizchi11js__browser3dom8Document22createDocumentFragment(doc);
    const initial_items = _M0FP26mizchi7signals9untrackedGRPB5ArrayGRP36mizchi11js__browser3dom4NodeEE(() => items());
    const _bind = initial_items.length;
    let _tmp = 0;
    while (true) {
      const i = _tmp;
      if (i < _bind) {
        const entry = _M0FP26mizchi7signals9untrackedGRP36mizchi4luna3dom10IndexEntryE(() => _M0FP36mizchi4luna3dom11index__eachN19render__with__scopeS2251GRP314vlmkit_2dsites4maps4main4SuggE(_env, i));
        _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(entries, entry);
        _M0MP36mizchi11js__browser3dom4Node11appendChild(fragment, entry.node);
        _tmp = i + 1 | 0;
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
      const new_len = new_items.length;
      while (true) {
        if (entries.length > new_len) {
          const entry = _M0MPC15array5Array3popGRP36mizchi4luna3dom10IndexEntryE(entries);
          if (entry === undefined) {
          } else {
            const _Some = entry;
            const _e = _Some;
            _e.disposed.val = true;
            const _func = _e.dispose;
            _func();
            const _bind$2 = _M0MP36mizchi11js__browser3dom4Node10parentNode(_e.node);
            if (_bind$2.$tag === 1) {
              const _Some$2 = _bind$2;
              const _par = _Some$2._0;
              _M0MP36mizchi11js__browser3dom4Node11removeChild(_par, _e.node);
            }
          }
          continue;
        } else {
          break;
        }
      }
      while (true) {
        if (entries.length < new_len) {
          const i = entries.length;
          const entry = _M0FP26mizchi7signals9untrackedGRP36mizchi4luna3dom10IndexEntryE(() => _M0FP36mizchi4luna3dom11index__eachN19render__with__scopeS2251GRP314vlmkit_2dsites4maps4main4SuggE(_env, i));
          _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(entries, entry);
          const _bind$2 = _M0MP36mizchi11js__browser3dom4Node10parentNode(placeholder);
          if (_bind$2.$tag === 1) {
            const _Some = _bind$2;
            const _par = _Some._0;
            _M0MP36mizchi11js__browser3dom4Node12insertBefore(_par, entry.node, new _M0DTPC16option6OptionGRP36mizchi11js__browser3dom4NodeE4Some(placeholder));
          }
          continue;
        } else {
          break;
        }
      }
    });
    return new _M0DTP36mizchi4luna3dom7DomNode3Raw(fragment);
  }
  function _M0FP36mizchi4luna3dom18double__to__string(d) {
    const any = d;
    return _M0MP26mizchi8js__core3Any6__call(any, "toString", []);
  }
  function _M0IP36mizchi4luna3dom4AttrPB4Show6output(self, logger) {
    switch (self.$tag) {
      case 0: {
        const _AttrString = self;
        const _s = _AttrString._0;
        logger.method_table.method_0(logger.self, _s);
        return;
      }
      case 1: {
        const _AttrNumber = self;
        const _d = _AttrNumber._0;
        logger.method_table.method_0(logger.self, _M0FP36mizchi4luna3dom18double__to__string(_d));
        return;
      }
      case 2: {
        const _AttrInt = self;
        const _i = _AttrInt._0;
        logger.method_table.method_0(logger.self, _M0MPC13int3Int18to__string_2einner(_i, 10));
        return;
      }
      default: {
        const _AttrBool = self;
        const _b = _AttrBool._0;
        logger.method_table.method_0(logger.self, _b ? "true" : "false");
        return;
      }
    }
  }
  function _M0MP36mizchi4luna3dom4Attr15to__attr__value(self) {
    return new _M0DTP36mizchi4luna3dom9AttrValue6Static(_M0IP016_24default__implPB4Show10to__stringGRP36mizchi4luna3dom4AttrE(self));
  }
  function _M0FP36mizchi4luna3dom6events() {
    return _M0FP26mizchi8js__core11new__object();
  }
  function _M0FP36mizchi4luna3dom20build__props_2einner(id, class_, style, on, ref_, attrs, dyn_attrs) {
    const result = [];
    if (id === undefined) {
    } else {
      const _Some = id;
      const _v = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(result, { _0: "id", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_v) });
    }
    if (class_ === undefined) {
    } else {
      const _Some = class_;
      const _v = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(result, { _0: "className", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_v) });
    }
    if (style === undefined) {
    } else {
      const _Some = style;
      const _s = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(result, { _0: "style", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_s) });
    }
    if (on.$tag === 1) {
      const _Some = on;
      const _handlers = _Some._0;
      const _bind = _M0MP36mizchi4luna3dom10HandlerMap9to__attrs(_handlers);
      const _bind$2 = _bind.length;
      let _tmp = 0;
      while (true) {
        const _ = _tmp;
        if (_ < _bind$2) {
          const attr = _bind[_];
          _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(result, attr);
          _tmp = _ + 1 | 0;
          continue;
        } else {
          break;
        }
      }
    }
    if (ref_ === undefined) {
    } else {
      const _Some = ref_;
      const _cb = _Some;
      const handler = (el) => {
        _cb(el);
      };
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(result, { _0: "__ref", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Handler(handler) });
    }
    if (attrs.$tag === 1) {
      const _Some = attrs;
      const _extra = _Some._0;
      const _bind = _extra.length;
      let _tmp = 0;
      while (true) {
        const _ = _tmp;
        if (_ < _bind) {
          const pair = _extra[_];
          _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(result, { _0: pair._0, _1: _M0MP36mizchi4luna3dom4Attr15to__attr__value(pair._1) });
          _tmp = _ + 1 | 0;
          continue;
        } else {
          break;
        }
      }
    }
    if (dyn_attrs.$tag === 1) {
      const _Some = dyn_attrs;
      const _extra = _Some._0;
      const _bind = _extra.length;
      let _tmp = 0;
      while (true) {
        const _ = _tmp;
        if (_ < _bind) {
          const pair = _extra[_];
          _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(result, pair);
          _tmp = _ + 1 | 0;
          continue;
        } else {
          break;
        }
      }
    }
    return result;
  }
  function _M0IPC16string6StringP36mizchi4luna3dom9ToDomNode13to__dom__node(self) {
    const doc = _M0FP36mizchi11js__browser3dom8document();
    return new _M0DTP36mizchi4luna3dom7DomNode3Txt(_M0MP36mizchi11js__browser3dom8Document14createTextNode(doc, self));
  }
  function _M0FP36mizchi4luna3dom3svg(width, height, viewBox, xmlns, fill, stroke, role, aria_label, aria_labelledby, aria_describedby, id, class_, style, dyn_class, dyn_style, on, ref_, attrs, dyn_attrs, children) {
    const props = _M0FP36mizchi4luna3dom20build__props_2einner(id, class_, style, on, ref_, attrs, dyn_attrs);
    if (width === undefined) {
    } else {
      const _Some = width;
      const _v = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "width", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_v) });
    }
    if (height === undefined) {
    } else {
      const _Some = height;
      const _v = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "height", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_v) });
    }
    if (viewBox === undefined) {
    } else {
      const _Some = viewBox;
      const _v = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "viewBox", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_v) });
    }
    if (xmlns === undefined) {
    } else {
      const _Some = xmlns;
      const _v = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "xmlns", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_v) });
    }
    if (fill === undefined) {
    } else {
      const _Some = fill;
      const _v = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "fill", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_v) });
    }
    if (stroke === undefined) {
    } else {
      const _Some = stroke;
      const _v = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "stroke", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_v) });
    }
    if (role === undefined) {
    } else {
      const _Some = role;
      const _v = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "role", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_v) });
    }
    if (aria_label === undefined) {
    } else {
      const _Some = aria_label;
      const _v = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "aria-label", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_v) });
    }
    if (aria_labelledby === undefined) {
    } else {
      const _Some = aria_labelledby;
      const _v = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "aria-labelledby", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_v) });
    }
    if (aria_describedby === undefined) {
    } else {
      const _Some = aria_describedby;
      const _v = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "aria-describedby", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_v) });
    }
    if (dyn_class === undefined) {
    } else {
      const _Some = dyn_class;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "className", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    if (dyn_style === undefined) {
    } else {
      const _Some = dyn_style;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "style", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    return _M0FP36mizchi4luna3dom19create__element__ns(_M0FP36mizchi4luna3dom7svg__ns, "svg", props, children);
  }
  function _M0FP36mizchi4luna3dom6svg__g(transform, fill, stroke, opacity, id, class_, style, dyn_class, dyn_style, on, ref_, attrs, dyn_attrs, children) {
    const props = _M0FP36mizchi4luna3dom20build__props_2einner(id, class_, style, on, ref_, attrs, dyn_attrs);
    if (transform === undefined) {
    } else {
      const _Some = transform;
      const _v = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "transform", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_v) });
    }
    if (fill === undefined) {
    } else {
      const _Some = fill;
      const _v = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "fill", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_v) });
    }
    if (stroke === undefined) {
    } else {
      const _Some = stroke;
      const _v = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "stroke", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_v) });
    }
    if (opacity === undefined) {
    } else {
      const _Some = opacity;
      const _v = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "opacity", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_v) });
    }
    if (dyn_class === undefined) {
    } else {
      const _Some = dyn_class;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "className", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    if (dyn_style === undefined) {
    } else {
      const _Some = dyn_style;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "style", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    return _M0FP36mizchi4luna3dom19create__element__ns(_M0FP36mizchi4luna3dom7svg__ns, "g", props, children);
  }
  function _M0FP36mizchi4luna3dom9svg__rect(x, y, width, height, rx, ry, fill, stroke, stroke_width, id, class_, style, dyn_class, dyn_style, on, ref_, attrs, dyn_attrs) {
    const props = _M0FP36mizchi4luna3dom20build__props_2einner(id, class_, style, on, ref_, attrs, dyn_attrs);
    if (x === undefined) {
    } else {
      const _Some = x;
      const _v = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "x", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_v) });
    }
    if (y === undefined) {
    } else {
      const _Some = y;
      const _v = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "y", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_v) });
    }
    if (width === undefined) {
    } else {
      const _Some = width;
      const _v = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "width", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_v) });
    }
    if (height === undefined) {
    } else {
      const _Some = height;
      const _v = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "height", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_v) });
    }
    if (rx === undefined) {
    } else {
      const _Some = rx;
      const _v = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "rx", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_v) });
    }
    if (ry === undefined) {
    } else {
      const _Some = ry;
      const _v = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "ry", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_v) });
    }
    if (fill === undefined) {
    } else {
      const _Some = fill;
      const _v = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "fill", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_v) });
    }
    if (stroke === undefined) {
    } else {
      const _Some = stroke;
      const _v = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "stroke", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_v) });
    }
    if (stroke_width === undefined) {
    } else {
      const _Some = stroke_width;
      const _v = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "stroke-width", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_v) });
    }
    if (dyn_class === undefined) {
    } else {
      const _Some = dyn_class;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "className", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    if (dyn_style === undefined) {
    } else {
      const _Some = dyn_style;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "style", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    return _M0FP36mizchi4luna3dom19create__element__ns(_M0FP36mizchi4luna3dom7svg__ns, "rect", props, []);
  }
  function _M0FP36mizchi4luna3dom11svg__circle(cx, cy, r, fill, stroke, stroke_width, id, class_, style, dyn_class, dyn_style, on, ref_, attrs, dyn_attrs) {
    const props = _M0FP36mizchi4luna3dom20build__props_2einner(id, class_, style, on, ref_, attrs, dyn_attrs);
    if (cx === undefined) {
    } else {
      const _Some = cx;
      const _v = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "cx", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_v) });
    }
    if (cy === undefined) {
    } else {
      const _Some = cy;
      const _v = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "cy", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_v) });
    }
    if (r === undefined) {
    } else {
      const _Some = r;
      const _v = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "r", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_v) });
    }
    if (fill === undefined) {
    } else {
      const _Some = fill;
      const _v = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "fill", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_v) });
    }
    if (stroke === undefined) {
    } else {
      const _Some = stroke;
      const _v = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "stroke", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_v) });
    }
    if (stroke_width === undefined) {
    } else {
      const _Some = stroke_width;
      const _v = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "stroke-width", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_v) });
    }
    if (dyn_class === undefined) {
    } else {
      const _Some = dyn_class;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "className", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    if (dyn_style === undefined) {
    } else {
      const _Some = dyn_style;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "style", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    return _M0FP36mizchi4luna3dom19create__element__ns(_M0FP36mizchi4luna3dom7svg__ns, "circle", props, []);
  }
  function _M0FP36mizchi4luna3dom9svg__path(d, fill, stroke, stroke_width, stroke_linecap, stroke_linejoin, fill_rule, id, class_, style, dyn_class, dyn_style, on, ref_, attrs, dyn_attrs) {
    const props = _M0FP36mizchi4luna3dom20build__props_2einner(id, class_, style, on, ref_, attrs, dyn_attrs);
    if (d === undefined) {
    } else {
      const _Some = d;
      const _v = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "d", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_v) });
    }
    if (fill === undefined) {
    } else {
      const _Some = fill;
      const _v = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "fill", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_v) });
    }
    if (stroke === undefined) {
    } else {
      const _Some = stroke;
      const _v = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "stroke", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_v) });
    }
    if (stroke_width === undefined) {
    } else {
      const _Some = stroke_width;
      const _v = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "stroke-width", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_v) });
    }
    if (stroke_linecap === undefined) {
    } else {
      const _Some = stroke_linecap;
      const _v = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "stroke-linecap", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_v) });
    }
    if (stroke_linejoin === undefined) {
    } else {
      const _Some = stroke_linejoin;
      const _v = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "stroke-linejoin", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_v) });
    }
    if (fill_rule === undefined) {
    } else {
      const _Some = fill_rule;
      const _v = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "fill-rule", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_v) });
    }
    if (dyn_class === undefined) {
    } else {
      const _Some = dyn_class;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "className", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    if (dyn_style === undefined) {
    } else {
      const _Some = dyn_style;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "style", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    return _M0FP36mizchi4luna3dom19create__element__ns(_M0FP36mizchi4luna3dom7svg__ns, "path", props, []);
  }
  function _M0FP36mizchi4luna3dom9svg__text(x, y, dx, dy, text_anchor, dominant_baseline, fill, font_size, font_family, id, class_, style, dyn_class, dyn_style, on, ref_, attrs, dyn_attrs, children) {
    const props = _M0FP36mizchi4luna3dom20build__props_2einner(id, class_, style, on, ref_, attrs, dyn_attrs);
    if (x === undefined) {
    } else {
      const _Some = x;
      const _v = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "x", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_v) });
    }
    if (y === undefined) {
    } else {
      const _Some = y;
      const _v = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "y", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_v) });
    }
    if (dx === undefined) {
    } else {
      const _Some = dx;
      const _v = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "dx", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_v) });
    }
    if (dy === undefined) {
    } else {
      const _Some = dy;
      const _v = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "dy", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_v) });
    }
    if (text_anchor === undefined) {
    } else {
      const _Some = text_anchor;
      const _v = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "text-anchor", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_v) });
    }
    if (dominant_baseline === undefined) {
    } else {
      const _Some = dominant_baseline;
      const _v = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "dominant-baseline", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_v) });
    }
    if (fill === undefined) {
    } else {
      const _Some = fill;
      const _v = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "fill", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_v) });
    }
    if (font_size === undefined) {
    } else {
      const _Some = font_size;
      const _v = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "font-size", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_v) });
    }
    if (font_family === undefined) {
    } else {
      const _Some = font_family;
      const _v = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "font-family", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_v) });
    }
    if (dyn_class === undefined) {
    } else {
      const _Some = dyn_class;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "className", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    if (dyn_style === undefined) {
    } else {
      const _Some = dyn_style;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "style", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    return _M0FP36mizchi4luna3dom19create__element__ns(_M0FP36mizchi4luna3dom7svg__ns, "text", props, children);
  }
  function _M0FP36mizchi4luna3dom6main__(id, class_, style, dyn_class, dyn_style, on, ref_, attrs, dyn_attrs, children) {
    const props = _M0FP36mizchi4luna3dom20build__props_2einner(id, class_, style, on, ref_, attrs, dyn_attrs);
    if (dyn_class === undefined) {
    } else {
      const _Some = dyn_class;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "className", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    if (dyn_style === undefined) {
    } else {
      const _Some = dyn_style;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "style", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    return _M0FP36mizchi4luna3dom15create__element("main", props, children);
  }
  function _M0FP36mizchi4luna3dom3nav(id, class_, style, dyn_class, dyn_style, on, ref_, attrs, dyn_attrs, children) {
    const props = _M0FP36mizchi4luna3dom20build__props_2einner(id, class_, style, on, ref_, attrs, dyn_attrs);
    if (dyn_class === undefined) {
    } else {
      const _Some = dyn_class;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "className", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    if (dyn_style === undefined) {
    } else {
      const _Some = dyn_style;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "style", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    return _M0FP36mizchi4luna3dom15create__element("nav", props, children);
  }
  function _M0FP36mizchi4luna3dom7section(id, class_, style, dyn_class, dyn_style, on, ref_, attrs, dyn_attrs, children) {
    const props = _M0FP36mizchi4luna3dom20build__props_2einner(id, class_, style, on, ref_, attrs, dyn_attrs);
    if (dyn_class === undefined) {
    } else {
      const _Some = dyn_class;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "className", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    if (dyn_style === undefined) {
    } else {
      const _Some = dyn_style;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "style", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    return _M0FP36mizchi4luna3dom15create__element("section", props, children);
  }
  function _M0FP36mizchi4luna3dom7article(id, class_, style, dyn_class, dyn_style, on, ref_, attrs, dyn_attrs, children) {
    const props = _M0FP36mizchi4luna3dom20build__props_2einner(id, class_, style, on, ref_, attrs, dyn_attrs);
    if (dyn_class === undefined) {
    } else {
      const _Some = dyn_class;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "className", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    if (dyn_style === undefined) {
    } else {
      const _Some = dyn_style;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "style", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    return _M0FP36mizchi4luna3dom15create__element("article", props, children);
  }
  function _M0FP36mizchi4luna3dom5aside(id, class_, style, dyn_class, dyn_style, on, ref_, attrs, dyn_attrs, children) {
    const props = _M0FP36mizchi4luna3dom20build__props_2einner(id, class_, style, on, ref_, attrs, dyn_attrs);
    if (dyn_class === undefined) {
    } else {
      const _Some = dyn_class;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "className", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    if (dyn_style === undefined) {
    } else {
      const _Some = dyn_style;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "style", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    return _M0FP36mizchi4luna3dom15create__element("aside", props, children);
  }
  function _M0FP36mizchi4luna3dom3div(id, class_, style, dyn_class, dyn_style, on, ref_, attrs, dyn_attrs, children) {
    const props = _M0FP36mizchi4luna3dom20build__props_2einner(id, class_, style, on, ref_, attrs, dyn_attrs);
    if (dyn_class === undefined) {
    } else {
      const _Some = dyn_class;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "className", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    if (dyn_style === undefined) {
    } else {
      const _Some = dyn_style;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "style", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    return _M0FP36mizchi4luna3dom15create__element("div", props, children);
  }
  function _M0FP36mizchi4luna3dom4span(id, class_, style, dyn_class, dyn_style, on, ref_, attrs, dyn_attrs, children) {
    const props = _M0FP36mizchi4luna3dom20build__props_2einner(id, class_, style, on, ref_, attrs, dyn_attrs);
    if (dyn_class === undefined) {
    } else {
      const _Some = dyn_class;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "className", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    if (dyn_style === undefined) {
    } else {
      const _Some = dyn_style;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "style", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    return _M0FP36mizchi4luna3dom15create__element("span", props, children);
  }
  function _M0FP36mizchi4luna3dom1p(id, class_, style, dyn_class, dyn_style, on, ref_, attrs, dyn_attrs, children) {
    const props = _M0FP36mizchi4luna3dom20build__props_2einner(id, class_, style, on, ref_, attrs, dyn_attrs);
    if (dyn_class === undefined) {
    } else {
      const _Some = dyn_class;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "className", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    if (dyn_style === undefined) {
    } else {
      const _Some = dyn_style;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "style", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    return _M0FP36mizchi4luna3dom15create__element("p", props, children);
  }
  function _M0FP36mizchi4luna3dom1a(href, target, id, class_, style, dyn_class, dyn_style, on, ref_, attrs, dyn_attrs, children) {
    const props = _M0FP36mizchi4luna3dom20build__props_2einner(id, class_, style, on, ref_, attrs, dyn_attrs);
    if (href === undefined) {
    } else {
      const _Some = href;
      const _v = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "href", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_v) });
    }
    if (target === undefined) {
    } else {
      const _Some = target;
      const _v = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "target", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_v) });
    }
    if (dyn_class === undefined) {
    } else {
      const _Some = dyn_class;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "className", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    if (dyn_style === undefined) {
    } else {
      const _Some = dyn_style;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "style", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    return _M0FP36mizchi4luna3dom15create__element("a", props, children);
  }
  function _M0FP36mizchi4luna3dom2h1(id, class_, style, dyn_class, dyn_style, on, ref_, attrs, dyn_attrs, children) {
    const props = _M0FP36mizchi4luna3dom20build__props_2einner(id, class_, style, on, ref_, attrs, dyn_attrs);
    if (dyn_class === undefined) {
    } else {
      const _Some = dyn_class;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "className", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    if (dyn_style === undefined) {
    } else {
      const _Some = dyn_style;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "style", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    return _M0FP36mizchi4luna3dom15create__element("h1", props, children);
  }
  function _M0FP36mizchi4luna3dom2h2(id, class_, style, dyn_class, dyn_style, on, ref_, attrs, dyn_attrs, children) {
    const props = _M0FP36mizchi4luna3dom20build__props_2einner(id, class_, style, on, ref_, attrs, dyn_attrs);
    if (dyn_class === undefined) {
    } else {
      const _Some = dyn_class;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "className", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    if (dyn_style === undefined) {
    } else {
      const _Some = dyn_style;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "style", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    return _M0FP36mizchi4luna3dom15create__element("h2", props, children);
  }
  function _M0FP36mizchi4luna3dom2h3(id, class_, style, dyn_class, dyn_style, on, ref_, attrs, dyn_attrs, children) {
    const props = _M0FP36mizchi4luna3dom20build__props_2einner(id, class_, style, on, ref_, attrs, dyn_attrs);
    if (dyn_class === undefined) {
    } else {
      const _Some = dyn_class;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "className", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    if (dyn_style === undefined) {
    } else {
      const _Some = dyn_style;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "style", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    return _M0FP36mizchi4luna3dom15create__element("h3", props, children);
  }
  function _M0FP36mizchi4luna3dom2ul(id, class_, style, dyn_class, dyn_style, on, ref_, attrs, dyn_attrs, children) {
    const props = _M0FP36mizchi4luna3dom20build__props_2einner(id, class_, style, on, ref_, attrs, dyn_attrs);
    if (dyn_class === undefined) {
    } else {
      const _Some = dyn_class;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "className", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    if (dyn_style === undefined) {
    } else {
      const _Some = dyn_style;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "style", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    return _M0FP36mizchi4luna3dom15create__element("ul", props, children);
  }
  function _M0FP36mizchi4luna3dom2ol(id, class_, style, dyn_class, dyn_style, on, ref_, attrs, dyn_attrs, children) {
    const props = _M0FP36mizchi4luna3dom20build__props_2einner(id, class_, style, on, ref_, attrs, dyn_attrs);
    if (dyn_class === undefined) {
    } else {
      const _Some = dyn_class;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "className", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    if (dyn_style === undefined) {
    } else {
      const _Some = dyn_style;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "style", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    return _M0FP36mizchi4luna3dom15create__element("ol", props, children);
  }
  function _M0FP36mizchi4luna3dom2li(id, class_, style, dyn_class, dyn_style, on, ref_, attrs, dyn_attrs, children) {
    const props = _M0FP36mizchi4luna3dom20build__props_2einner(id, class_, style, on, ref_, attrs, dyn_attrs);
    if (dyn_class === undefined) {
    } else {
      const _Some = dyn_class;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "className", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    if (dyn_style === undefined) {
    } else {
      const _Some = dyn_style;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "style", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    return _M0FP36mizchi4luna3dom15create__element("li", props, children);
  }
  function _M0FP36mizchi4luna3dom6button(disabled, id, class_, style, dyn_class, dyn_style, dyn_disabled, on, ref_, attrs, dyn_attrs, children) {
    const props = _M0FP36mizchi4luna3dom20build__props_2einner(id, class_, style, on, ref_, attrs, dyn_attrs);
    if (disabled === -1) {
    } else {
      const _Some = disabled;
      const _x = _Some;
      if (_x === true) {
        _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, _M0FP36mizchi4luna3dom6buttonN5tupleS2808);
      }
    }
    if (dyn_class === undefined) {
    } else {
      const _Some = dyn_class;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "className", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    if (dyn_style === undefined) {
    } else {
      const _Some = dyn_style;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "style", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    if (dyn_disabled === undefined) {
    } else {
      const _Some = dyn_disabled;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "disabled", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(() => {
        const _p = _getter();
        return _p ? "true" : "false";
      }) });
    }
    return _M0FP36mizchi4luna3dom15create__element("button", props, children);
  }
  function _M0FP36mizchi4luna3dom5input(type_, name, value, placeholder, disabled, readonly_, required, checked, id, class_, style, dyn_class, dyn_style, dyn_value, dyn_disabled, dyn_checked, on, ref_, attrs, dyn_attrs) {
    const props = _M0FP36mizchi4luna3dom20build__props_2einner(id, class_, style, on, ref_, attrs, dyn_attrs);
    if (type_ === undefined) {
    } else {
      const _Some = type_;
      const _v = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "type", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_v) });
    }
    if (name === undefined) {
    } else {
      const _Some = name;
      const _v = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "name", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_v) });
    }
    if (value === undefined) {
    } else {
      const _Some = value;
      const _v = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "value", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_v) });
    }
    if (placeholder === undefined) {
    } else {
      const _Some = placeholder;
      const _v = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "placeholder", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_v) });
    }
    if (disabled === -1) {
    } else {
      const _Some = disabled;
      const _x = _Some;
      if (_x === true) {
        _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, _M0FP36mizchi4luna3dom5inputN5tupleS2831);
      }
    }
    if (readonly_ === -1) {
    } else {
      const _Some = readonly_;
      const _x = _Some;
      if (_x === true) {
        _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, _M0FP36mizchi4luna3dom5inputN5tupleS2833);
      }
    }
    if (required === -1) {
    } else {
      const _Some = required;
      const _x = _Some;
      if (_x === true) {
        _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, _M0FP36mizchi4luna3dom5inputN5tupleS2835);
      }
    }
    if (checked === -1) {
    } else {
      const _Some = checked;
      const _x = _Some;
      if (_x === true) {
        _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, _M0FP36mizchi4luna3dom5inputN5tupleS2837);
      }
    }
    if (dyn_class === undefined) {
    } else {
      const _Some = dyn_class;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "className", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    if (dyn_style === undefined) {
    } else {
      const _Some = dyn_style;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "style", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    if (dyn_value === undefined) {
    } else {
      const _Some = dyn_value;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "value", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    if (dyn_disabled === undefined) {
    } else {
      const _Some = dyn_disabled;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "disabled", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(() => {
        const _p = _getter();
        return _p ? "true" : "false";
      }) });
    }
    if (dyn_checked === undefined) {
    } else {
      const _Some = dyn_checked;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "checked", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(() => {
        const _p = _getter();
        return _p ? "true" : "false";
      }) });
    }
    return _M0FP36mizchi4luna3dom15create__element("input", props, []);
  }
  function _M0FP36mizchi4luna3dom5label(for_, id, class_, style, dyn_class, dyn_style, on, ref_, attrs, dyn_attrs, children) {
    const props = _M0FP36mizchi4luna3dom20build__props_2einner(id, class_, style, on, ref_, attrs, dyn_attrs);
    if (for_ === undefined) {
    } else {
      const _Some = for_;
      const _v = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "for", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_v) });
    }
    if (dyn_class === undefined) {
    } else {
      const _Some = dyn_class;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "className", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    if (dyn_style === undefined) {
    } else {
      const _Some = dyn_style;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "style", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    return _M0FP36mizchi4luna3dom15create__element("label", props, children);
  }
  function _M0FP36mizchi4luna3dom6strong(id, class_, style, dyn_class, dyn_style, on, ref_, attrs, dyn_attrs, children) {
    const props = _M0FP36mizchi4luna3dom20build__props_2einner(id, class_, style, on, ref_, attrs, dyn_attrs);
    if (dyn_class === undefined) {
    } else {
      const _Some = dyn_class;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "className", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    if (dyn_style === undefined) {
    } else {
      const _Some = dyn_style;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(props, { _0: "style", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    return _M0FP36mizchi4luna3dom15create__element("strong", props, children);
  }
  function _M0FP36mizchi4luna3dom4text(content) {
    return _M0IPC16string6StringP36mizchi4luna3dom9ToDomNode13to__dom__node(content);
  }
  function _M0FP36mizchi4luna3dom9text__dyn(content) {
    return _M0FP36mizchi4luna3dom10text__node(content);
  }
  function _M0FP314vlmkit_2dsites4maps4main10home__view() {
    return _M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4maps4main6mobile) ? _M0FP314vlmkit_2dsites4maps4main11phone__home : _M0FP314vlmkit_2dsites4maps4main10desk__home;
  }
  function _M0FP314vlmkit_2dsites4maps4main9scale__of(z) {
    return 0.24 * _M0FP314vlmkit_2dsites4maps4main4powf(1.65, z - 1);
  }
  function _M0FP314vlmkit_2dsites4maps4main11clamp__view(v) {
    const _p = v.cx;
    const _p$2 = 0;
    const _p$3 = 4000;
    const _tmp = _p < _p$2 ? _p$2 : _p > _p$3 ? _p$3 : _p;
    const _p$4 = v.cy;
    const _p$5 = 0;
    const _p$6 = 2800;
    const _tmp$2 = _p$4 < _p$5 ? _p$5 : _p$4 > _p$6 ? _p$6 : _p$4;
    const _p$7 = v.z;
    const _p$8 = 1;
    const _p$9 = 6;
    return new _M0TP314vlmkit_2dsites4maps4main4View(_tmp, _tmp$2, _p$7 < _p$8 ? _p$8 : _p$7 > _p$9 ? _p$9 : _p$7);
  }
  function _M0FP314vlmkit_2dsites4maps4main2sx(x) {
    const v = _M0MP26mizchi7signals6Signal3getGRP314vlmkit_2dsites4maps4main4ViewE(_M0FP314vlmkit_2dsites4maps4main4view);
    return _M0MP26mizchi7signals6Signal3getGdE(_M0FP314vlmkit_2dsites4maps4main6map__w) / 2 + (x - v.cx) * _M0FP314vlmkit_2dsites4maps4main9scale__of(v.z);
  }
  function _M0FP314vlmkit_2dsites4maps4main2sy(y) {
    const v = _M0MP26mizchi7signals6Signal3getGRP314vlmkit_2dsites4maps4main4ViewE(_M0FP314vlmkit_2dsites4maps4main4view);
    return _M0MP26mizchi7signals6Signal3getGdE(_M0FP314vlmkit_2dsites4maps4main6map__h) / 2 + (y - v.cy) * _M0FP314vlmkit_2dsites4maps4main9scale__of(v.z);
  }
  function _M0FP314vlmkit_2dsites4maps4main13visible__left() {
    return !_M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4maps4main6mobile) && (_M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4maps4main5panel) !== 0 && !_M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4maps4main9collapsed)) ? 420 : 0;
  }
  function _M0FP314vlmkit_2dsites4maps4main12snap__height(i) {
    const h = _M0MP26mizchi7signals6Signal3getGdE(_M0FP314vlmkit_2dsites4maps4main6map__h);
    switch (i) {
      case 0: {
        return 66;
      }
      case 1: {
        return _M0MPC16double6Double5floor(h * 0.5);
      }
      default: {
        return h - 124;
      }
    }
  }
  function _M0FP314vlmkit_2dsites4maps4main13sheet__height() {
    if (!_M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4maps4main6mobile) || _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4maps4main5panel) === 0) {
      return 0;
    }
    const d = _M0MP26mizchi7signals6Signal3getGdE(_M0FP314vlmkit_2dsites4maps4main11sheet__drag);
    if (d >= 0) {
      return d;
    }
    return _M0FP314vlmkit_2dsites4maps4main12snap__height(_M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4maps4main5sheet));
  }
  function _M0FP314vlmkit_2dsites4maps4main4kept(p) {
    const c = _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4maps4main4chip);
    return c < 0 || (p.cat === c || p.id === _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4maps4main8selected));
  }
  function _M0FP314vlmkit_2dsites4maps4main2mk(id, name, cat, x, y, rating, reviews, price, hours, site, blurb) {
    return new _M0TP314vlmkit_2dsites4maps4main5Place(id, name, cat, x, y, rating, reviews, price, hours, site, blurb);
  }
  function _M0FP314vlmkit_2dsites4maps4main11world__dist(ax, ay, bx, by) {
    return Math.sqrt((ax - bx) * (ax - bx) + (ay - by) * (ay - by));
  }
  function _M0FP314vlmkit_2dsites4maps4main11place__area(p) {
    let best = "";
    let bd = 1000000000;
    const _bind = _M0FP314vlmkit_2dsites4maps4main5areas.length;
    let _tmp = 0;
    while (true) {
      const _ = _tmp;
      if (_ < _bind) {
        const a = _M0FP314vlmkit_2dsites4maps4main5areas[_];
        const _n = a._0;
        const _ax = a._1;
        const _ay = a._2;
        const d = Math.sqrt((p.x - _ax) * (p.x - _ax) + (p.y - _ay) * (p.y - _ay));
        if (d < bd) {
          bd = d;
          best = _n;
        }
        _tmp = _ + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return best;
  }
  function _M0FP314vlmkit_2dsites4maps4main13matches__text(p, t) {
    const q = _M0MPC16string6String9to__lower(t);
    return q === "" || (_M0MPC16string6String8contains(_M0MPC16string6String9to__lower(p.name), new _M0TPC16string10StringView(q, 0, q.length)) || (_M0MPC16string6String8contains(_M0MPC16string6String9to__lower(_M0MPC15array5Array2atGUsiEE(_M0FP314vlmkit_2dsites4maps4main10cat__names, p.cat)), new _M0TPC16string10StringView(q, 0, q.length)) || (_M0MPC16string6String8contains(_M0MPC16string6String9to__lower(_M0MPC15array5Array2atGUsiEE(_M0FP314vlmkit_2dsites4maps4main13cat__singular, p.cat)), new _M0TPC16string10StringView(q, 0, q.length)) || _M0MPC16string6String8contains(_M0MPC16string6String9to__lower(_M0FP314vlmkit_2dsites4maps4main11place__area(p)), new _M0TPC16string10StringView(q, 0, q.length)))));
  }
  function _M0FP314vlmkit_2dsites4maps4main10on__screen(p) {
    const x = _M0FP314vlmkit_2dsites4maps4main2sx(p.x);
    const y = _M0FP314vlmkit_2dsites4maps4main2sy(p.y);
    return x > _M0FP314vlmkit_2dsites4maps4main13visible__left() && (x < _M0MP26mizchi7signals6Signal3getGdE(_M0FP314vlmkit_2dsites4maps4main6map__w) && (y > 0 && y < _M0MP26mizchi7signals6Signal3getGdE(_M0FP314vlmkit_2dsites4maps4main6map__h) - _M0FP314vlmkit_2dsites4maps4main13sheet__height()));
  }
  function _M0FP314vlmkit_2dsites4maps4main9sync__url() {
    const v = _M0MP26mizchi7signals6Signal3getGRP314vlmkit_2dsites4maps4main4ViewE(_M0FP314vlmkit_2dsites4maps4main4view);
    const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(6);
    _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, "?at=");
    _M0MPB13StringBuilder13write__objectGiE(_string_builder, _M0MPC16double6Double7to__int(_M0MPC16double6Double5round(v.cx)));
    _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, ",");
    _M0MPB13StringBuilder13write__objectGiE(_string_builder, _M0MPC16double6Double7to__int(_M0MPC16double6Double5round(v.cy)));
    _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, ",");
    _M0MPB13StringBuilder13write__objectGsE(_string_builder, _M0FP314vlmkit_2dsites4maps4main4fmt1(v.z));
    let q = _string_builder.val;
    const s = _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4maps4main8selected);
    if (s >= 0 && _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4maps4main5panel) === 2) {
      const _tmp = q;
      const _string_builder$2 = _M0MPB13StringBuilder21StringBuilder_2einner(7);
      _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$2, "&place=");
      _M0MPB13StringBuilder13write__objectGiE(_string_builder$2, s);
      q = `${_tmp}${_string_builder$2.val}`;
    }
    _M0FP314vlmkit_2dsites4maps4main14replace__query(q);
  }
  function _M0FP314vlmkit_2dsites4maps4main7animate(f) {
    _M0FP314vlmkit_2dsites4maps4main11anim__token.val = _M0FP314vlmkit_2dsites4maps4main11anim__token.val + 1 | 0;
    const tok = _M0FP314vlmkit_2dsites4maps4main11anim__token.val;
    if (_M0FP314vlmkit_2dsites4maps4main15reduced__motion()) {
      _M0MP26mizchi7signals6Signal3setGRP314vlmkit_2dsites4maps4main4ViewE(_M0FP314vlmkit_2dsites4maps4main4view, _M0FP314vlmkit_2dsites4maps4main11clamp__view(f(1)));
      _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4maps4main9animating, false);
      _M0FP314vlmkit_2dsites4maps4main9sync__url();
      return undefined;
    }
    const start = _M0MPC13ref3Ref3RefGdE(-1);
    _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4maps4main9animating, true);
    const step = (t) => {
      if (tok !== _M0FP314vlmkit_2dsites4maps4main11anim__token.val) {
        return undefined;
      }
      if (start.val < 0) {
        start.val = t;
      }
      const _p = (t - start.val) / 200;
      const _p$2 = 0;
      const _p$3 = 1;
      const k = _p < _p$2 ? _p$2 : _p > _p$3 ? _p$3 : _p;
      const e = 1 - (1 - k) * (1 - k) * (1 - k);
      _M0MP26mizchi7signals6Signal3setGRP314vlmkit_2dsites4maps4main4ViewE(_M0FP314vlmkit_2dsites4maps4main4view, _M0FP314vlmkit_2dsites4maps4main11clamp__view(f(e)));
      if (k < 1) {
        _M0FP314vlmkit_2dsites4maps4main3raf(step);
        return;
      } else {
        _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4maps4main9animating, false);
        _M0FP314vlmkit_2dsites4maps4main9sync__url();
        return;
      }
    };
    _M0FP314vlmkit_2dsites4maps4main3raf(step);
  }
  function _M0FP314vlmkit_2dsites4maps4main7fly__to(target) {
    const from = _M0MP26mizchi7signals6Signal3getGRP314vlmkit_2dsites4maps4main4ViewE(_M0FP314vlmkit_2dsites4maps4main4view);
    const t = _M0FP314vlmkit_2dsites4maps4main11clamp__view(target);
    _M0FP314vlmkit_2dsites4maps4main7animate((e) => new _M0TP314vlmkit_2dsites4maps4main4View(from.cx + (t.cx - from.cx) * e, from.cy + (t.cy - from.cy) * e, from.z + (t.z - from.z) * e));
  }
  function _M0FP314vlmkit_2dsites4maps4main8zoom__at(px, py, dz) {
    const from = _M0MP26mizchi7signals6Signal3getGRP314vlmkit_2dsites4maps4main4ViewE(_M0FP314vlmkit_2dsites4maps4main4view);
    const _p = _M0MPC16double6Double5round(from.z * 2) / 2 + dz;
    const _p$2 = 1;
    const _p$3 = 6;
    const z1 = _p < _p$2 ? _p$2 : _p > _p$3 ? _p$3 : _p;
    const w = _M0MP26mizchi7signals6Signal3getGdE(_M0FP314vlmkit_2dsites4maps4main6map__w);
    const h = _M0MP26mizchi7signals6Signal3getGdE(_M0FP314vlmkit_2dsites4maps4main6map__h);
    const s0 = _M0FP314vlmkit_2dsites4maps4main9scale__of(from.z);
    const wx = from.cx + (px - w / 2) / s0;
    const wy = from.cy + (py - h / 2) / s0;
    _M0FP314vlmkit_2dsites4maps4main7animate((e) => {
      const z = from.z + (z1 - from.z) * e;
      const s = _M0FP314vlmkit_2dsites4maps4main9scale__of(z);
      return new _M0TP314vlmkit_2dsites4maps4main4View(wx - (px - w / 2) / s, wy - (py - h / 2) / s, z);
    });
  }
  function _M0FP314vlmkit_2dsites4maps4main12zoom__centre(dz) {
    const l = _M0FP314vlmkit_2dsites4maps4main13visible__left();
    _M0FP314vlmkit_2dsites4maps4main8zoom__at((l + _M0MP26mizchi7signals6Signal3getGdE(_M0FP314vlmkit_2dsites4maps4main6map__w)) / 2, (_M0MP26mizchi7signals6Signal3getGdE(_M0FP314vlmkit_2dsites4maps4main6map__h) - _M0FP314vlmkit_2dsites4maps4main13sheet__height()) / 2, dz);
  }
  function _M0FP314vlmkit_2dsites4maps4main7pan__by(dx, dy) {
    const v = _M0MP26mizchi7signals6Signal3getGRP314vlmkit_2dsites4maps4main4ViewE(_M0FP314vlmkit_2dsites4maps4main4view);
    const s = _M0FP314vlmkit_2dsites4maps4main9scale__of(v.z);
    _M0FP314vlmkit_2dsites4maps4main7fly__to(new _M0TP314vlmkit_2dsites4maps4main4View(v.cx + dx / s, v.cy + dy / s, v.z));
  }
  function _M0FP314vlmkit_2dsites4maps4main11point__view(x, y, z) {
    const s = _M0FP314vlmkit_2dsites4maps4main9scale__of(z);
    const w = _M0MP26mizchi7signals6Signal3getGdE(_M0FP314vlmkit_2dsites4maps4main6map__w);
    const l = !_M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4maps4main6mobile) && !_M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4maps4main9collapsed) ? 420 : 0;
    const sh = _M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4maps4main6mobile) ? _M0FP314vlmkit_2dsites4maps4main12snap__height(_M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4maps4main5sheet)) : 0;
    const mx = (l + w) / 2;
    const my = _M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4maps4main6mobile) ? (110 + _M0MP26mizchi7signals6Signal3getGdE(_M0FP314vlmkit_2dsites4maps4main6map__h) - sh) / 2 : _M0MP26mizchi7signals6Signal3getGdE(_M0FP314vlmkit_2dsites4maps4main6map__h) / 2;
    return new _M0TP314vlmkit_2dsites4maps4main4View(x - (mx - w / 2) / s, y - (my - _M0MP26mizchi7signals6Signal3getGdE(_M0FP314vlmkit_2dsites4maps4main6map__h) / 2) / s, z);
  }
  function _M0FP314vlmkit_2dsites4maps4main15ease__to__point(x, y, z) {
    _M0FP314vlmkit_2dsites4maps4main7fly__to(_M0FP314vlmkit_2dsites4maps4main11point__view(x, y, z));
  }
  function _M0FP314vlmkit_2dsites4maps4main11open__panel(mode) {
    _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4maps4main5panel, mode);
    _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4maps4main9collapsed, false);
    if (_M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4maps4main6mobile) && _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4maps4main5sheet) === 0) {
      _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4maps4main5sheet, 1);
      return;
    } else {
      return;
    }
  }
  function _M0FP314vlmkit_2dsites4maps4main13select__place(id) {
    const p = _M0MPC15array5Array2atGUsiEE(_M0FP314vlmkit_2dsites4maps4main6places, id);
    _M0FP26mizchi7signals5batchGuE(() => {
      _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4maps4main8selected, id);
      _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4maps4main10place__tab, 0);
      _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4maps4main10sort__open, false);
      _M0FP314vlmkit_2dsites4maps4main11open__panel(2);
    });
    const z = _M0MP26mizchi7signals6Signal3getGRP314vlmkit_2dsites4maps4main4ViewE(_M0FP314vlmkit_2dsites4maps4main4view).z < 3 ? 3 : _M0MP26mizchi7signals6Signal3getGRP314vlmkit_2dsites4maps4main4ViewE(_M0FP314vlmkit_2dsites4maps4main4view).z;
    _M0FP314vlmkit_2dsites4maps4main15ease__to__point(p.x, p.y, z);
  }
  function _M0FP314vlmkit_2dsites4maps4main13show__results(q) {
    _M0FP26mizchi7signals5batchGuE(() => {
      _M0MP26mizchi7signals6Signal3setGRP314vlmkit_2dsites4maps4main4ViewE(_M0FP314vlmkit_2dsites4maps4main5query, q);
      _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4maps4main12has__results, true);
      _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4maps4main8selected, -1);
      _M0FP314vlmkit_2dsites4maps4main11open__panel(1);
    });
    _M0FP314vlmkit_2dsites4maps4main9sync__url();
  }
  function _M0FP314vlmkit_2dsites4maps4main12fit__results() {
    const q = _M0MP26mizchi7signals6Signal3getGRP314vlmkit_2dsites4maps4main4ViewE(_M0FP314vlmkit_2dsites4maps4main5query);
    let x0 = 1000000000;
    let y0 = 1000000000;
    let x1 = -1000000000;
    let y1 = -1000000000;
    let n = 0;
    const _bind = _M0FP314vlmkit_2dsites4maps4main6places.length;
    let _tmp = 0;
    while (true) {
      const _ = _tmp;
      if (_ < _bind) {
        const p = _M0FP314vlmkit_2dsites4maps4main6places[_];
        if ((q.cat < 0 || p.cat === q.cat) && (q.cat >= 0 || _M0FP314vlmkit_2dsites4maps4main13matches__text(p, q.text))) {
          n = n + 1 | 0;
          x0 = p.x < x0 ? p.x : x0;
          y0 = p.y < y0 ? p.y : y0;
          x1 = p.x > x1 ? p.x : x1;
          y1 = p.y > y1 ? p.y : y1;
        }
        _tmp = _ + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    if (n === 0) {
      return undefined;
    }
    const l = !_M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4maps4main6mobile) ? 420 : 0;
    const top = _M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4maps4main6mobile) ? 110 : 60;
    const sh = _M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4maps4main6mobile) ? _M0FP314vlmkit_2dsites4maps4main12snap__height(_M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4maps4main5sheet)) : 0;
    const vw = _M0MP26mizchi7signals6Signal3getGdE(_M0FP314vlmkit_2dsites4maps4main6map__w) - l - 40;
    const vh = _M0MP26mizchi7signals6Signal3getGdE(_M0FP314vlmkit_2dsites4maps4main6map__h) - sh - top - 50;
    const a = vw / (x1 - x0 + 200);
    const b = vh / (y1 - y0 + 200);
    const s = a < b ? a : b;
    const _p = 1 + _M0FP314vlmkit_2dsites4maps4main2ln(s / 0.24) / _M0FP314vlmkit_2dsites4maps4main2ln(1.65);
    const _p$2 = 1;
    const _p$3 = 4;
    const z = _p < _p$2 ? _p$2 : _p > _p$3 ? _p$3 : _p;
    const z2 = _M0MPC16double6Double5floor(z * 2) / 2;
    const v = _M0FP314vlmkit_2dsites4maps4main11point__view((x0 + x1) / 2, (y0 + y1) / 2, z2);
    return new _M0TP314vlmkit_2dsites4maps4main4View(v.cx, v.cy - top / 2 / _M0FP314vlmkit_2dsites4maps4main9scale__of(z2), v.z);
  }
  function _M0FP314vlmkit_2dsites4maps4main14show__category(c) {
    _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4maps4main4chip, c);
    _M0FP314vlmkit_2dsites4maps4main13show__results(new _M0TP314vlmkit_2dsites4maps4main5Query(c, "", false, 0, 0, _M0MPC15array5Array2atGUsiEE(_M0FP314vlmkit_2dsites4maps4main10cat__names, c)));
    const _bind = _M0FP314vlmkit_2dsites4maps4main12fit__results();
    if (_bind === undefined) {
      return;
    } else {
      const _Some = _bind;
      const _v = _Some;
      _M0FP314vlmkit_2dsites4maps4main7fly__to(_v);
      return;
    }
  }
  function _M0FP314vlmkit_2dsites4maps4main12toggle__chip(c) {
    if (_M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4maps4main4chip) === c) {
      _M0FP26mizchi7signals5batchGuE(() => {
        _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4maps4main4chip, -1);
        if (_M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4maps4main5panel) === 1) {
          _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4maps4main5panel, 0);
          _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4maps4main12has__results, false);
          return;
        } else {
          return;
        }
      });
      return;
    } else {
      _M0FP314vlmkit_2dsites4maps4main14show__category(c);
      return;
    }
  }
  function _M0FP314vlmkit_2dsites4maps4main17back__from__place() {
    _M0FP26mizchi7signals5batchGuE(() => {
      _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4maps4main8selected, -1);
      if (_M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4maps4main12has__results)) {
        _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4maps4main5panel, 1);
        return;
      } else {
        _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4maps4main5panel, 0);
        return;
      }
    });
    _M0FP314vlmkit_2dsites4maps4main9sync__url();
  }
  function _M0FP314vlmkit_2dsites4maps4main17close__everything() {
    _M0FP26mizchi7signals5batchGuE(() => {
      _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4maps4main5panel, 0);
      _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4maps4main12has__results, false);
      _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4maps4main8selected, -1);
      _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4maps4main4chip, -1);
      _M0MP26mizchi7signals6Signal3setGRP314vlmkit_2dsites4maps4main4ViewE(_M0FP314vlmkit_2dsites4maps4main5query, _M0FP314vlmkit_2dsites4maps4main9no__query);
    });
    _M0FP314vlmkit_2dsites4maps4main9sync__url();
  }
  function _M0FP314vlmkit_2dsites4maps4main16open__directions(to) {
    _M0FP26mizchi7signals5batchGuE(() => {
      if (to >= 0) {
        _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4maps4main7dir__to, to);
      }
      _M0FP314vlmkit_2dsites4maps4main11open__panel(3);
    });
  }
  function _M0FP314vlmkit_2dsites4maps4main9is__saved(id) {
    return _M0MPC15array5Array8containsGiE(_M0MP26mizchi7signals6Signal3getGRPB5ArrayGiEE(_M0FP314vlmkit_2dsites4maps4main5saved), id);
  }
  function _M0FP314vlmkit_2dsites4maps4main13toggle__saved(id) {
    _M0MP26mizchi7signals6Signal6updateGRPB5ArrayGiEE(_M0FP314vlmkit_2dsites4maps4main5saved, (a) => {
      if (_M0MPC15array5Array8containsGiE(a, id)) {
        const _p = [];
        const _p$2 = a.length;
        let _tmp = 0;
        while (true) {
          const _p$3 = _tmp;
          if (_p$3 < _p$2) {
            const _p$4 = a[_p$3];
            if (_p$4 !== id) {
              _M0MPC15array5Array4pushGiE(_p, _p$4);
            }
            _tmp = _p$3 + 1 | 0;
            continue;
          } else {
            return _p;
          }
        }
      } else {
        const _self = [];
        _M0MPC15array5Array10push__iterGiE(_self, _M0MPC15array5Array4iterGiE(a));
        _M0MPC15array5Array4pushGiE(_self, id);
        return _self;
      }
    });
  }
  function _M0FP314vlmkit_2dsites4maps4main13route__length(pts) {
    let l = 0;
    let _tmp = 1;
    while (true) {
      const i = _tmp;
      if (i < pts.length) {
        l = l + _M0FP314vlmkit_2dsites4maps4main11world__dist(_M0MPC15array5Array2atGUsiEE(pts, i - 1 | 0)._0, _M0MPC15array5Array2atGUsiEE(pts, i - 1 | 0)._1, _M0MPC15array5Array2atGUsiEE(pts, i)._0, _M0MPC15array5Array2atGUsiEE(pts, i)._1);
        _tmp = i + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return l;
  }
  function _M0FP314vlmkit_2dsites4maps4main7compass(dx, dy) {
    const ang = _M0FP314vlmkit_2dsites4maps4main6atan2d(-dy, dx);
    const names = ["east", "north-east", "north", "north-west", "west", "south-west", "south", "south-east"];
    const i = _M0MPC16double6Double7to__int(_M0MPC16double6Double5floor((ang + 360 + 22.5) / 45)) % 8 | 0;
    return _M0MPC15array5Array2atGUsiEE(names, i);
  }
  function _M0FP314vlmkit_2dsites4maps4main11dist__label(m) {
    if (m < 1000) {
      const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(2);
      _M0MPB13StringBuilder13write__objectGiE(_string_builder, _M0MPC16double6Double7to__int(_M0MPC16double6Double5round(m / 10) * 10));
      _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, " m");
      return _string_builder.val;
    } else {
      const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(3);
      _M0MPB13StringBuilder13write__objectGsE(_string_builder, _M0FP314vlmkit_2dsites4maps4main4fmt1(m / 1000));
      _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, " km");
      return _string_builder.val;
    }
  }
  function _M0FP314vlmkit_2dsites4maps4main13mode__minutes(m, length) {
    let mins;
    switch (m) {
      case 0: {
        mins = length / 350 + 2;
        break;
      }
      case 1: {
        mins = length / 220 + 5;
        break;
      }
      case 2: {
        mins = length / 80;
        break;
      }
      default: {
        mins = length / 240;
      }
    }
    const v = _M0MPC16double6Double7to__int(_M0MPC16double6Double5round(mins));
    return v < 1 ? 1 : v;
  }
  function _M0FP314vlmkit_2dsites4maps4main11sugg__label(s) {
    switch (s.$tag) {
      case 0: {
        const _SCat = s;
        const _c = _SCat._0;
        return { _0: _M0MPC15array5Array2atGUsiEE(_M0FP314vlmkit_2dsites4maps4main10cat__names, _c), _1: "Category" };
      }
      case 1: {
        const _SNear = s;
        const _c$2 = _SNear._0;
        const _a = _SNear._1;
        const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(6);
        _M0MPB13StringBuilder13write__objectGsE(_string_builder, _M0MPC15array5Array2atGUsiEE(_M0FP314vlmkit_2dsites4maps4main10cat__names, _c$2));
        _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, " near ");
        _M0MPB13StringBuilder13write__objectGsE(_string_builder, _M0MPC15array5Array2atGUsiEE(_M0FP314vlmkit_2dsites4maps4main5areas, _a)._0);
        return { _0: _string_builder.val, _1: "Category" };
      }
      case 2: {
        const _SPlace = s;
        const _id = _SPlace._0;
        const _tmp = _M0MPC15array5Array2atGUsiEE(_M0FP314vlmkit_2dsites4maps4main6places, _id).name;
        const _string_builder$2 = _M0MPB13StringBuilder21StringBuilder_2einner(4);
        _M0MPB13StringBuilder13write__objectGsE(_string_builder$2, _M0MPC15array5Array2atGUsiEE(_M0FP314vlmkit_2dsites4maps4main13cat__singular, _M0MPC15array5Array2atGUsiEE(_M0FP314vlmkit_2dsites4maps4main6places, _id).cat));
        _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$2, " · ");
        _M0MPB13StringBuilder13write__objectGsE(_string_builder$2, _M0FP314vlmkit_2dsites4maps4main11place__area(_M0MPC15array5Array2atGUsiEE(_M0FP314vlmkit_2dsites4maps4main6places, _id)));
        return { _0: _tmp, _1: _string_builder$2.val };
      }
      case 3: {
        const _SArea = s;
        const _a$2 = _SArea._0;
        return { _0: _M0MPC15array5Array2atGUsiEE(_M0FP314vlmkit_2dsites4maps4main5areas, _a$2)._0, _1: "Area of Port Lumen" };
      }
      default: {
        const _SRecent = s;
        const _t = _SRecent._0;
        return { _0: _t, _1: "" };
      }
    }
  }
  function _M0FP314vlmkit_2dsites4maps4main10sugg__icon(s) {
    let c;
    _L: {
      switch (s.$tag) {
        case 0: {
          const _SCat = s;
          const _c = _SCat._0;
          c = _c;
          break _L;
        }
        case 1: {
          const _SNear = s;
          const _c$2 = _SNear._0;
          c = _c$2;
          break _L;
        }
        case 2: {
          const _SPlace = s;
          const _id = _SPlace._0;
          return _M0MPC15array5Array2atGUsiEE(_M0FP314vlmkit_2dsites4maps4main10cat__icons, _M0MPC15array5Array2atGUsiEE(_M0FP314vlmkit_2dsites4maps4main6places, _id).cat);
        }
        case 3: {
          return _M0FP314vlmkit_2dsites4maps4main7ic__pin;
        }
        default: {
          return _M0FP314vlmkit_2dsites4maps4main9ic__clock;
        }
      }
    }
    return _M0MPC15array5Array2atGUsiEE(_M0FP314vlmkit_2dsites4maps4main10cat__icons, c);
  }
  function _M0FP314vlmkit_2dsites4maps4main16area__near__view() {
    const v = _M0MP26mizchi7signals6Signal3getGRP314vlmkit_2dsites4maps4main4ViewE(_M0FP314vlmkit_2dsites4maps4main4view);
    let best = 0;
    let bd = 1000000000;
    const _bind = _M0FP314vlmkit_2dsites4maps4main5areas.length;
    let _tmp = 0;
    while (true) {
      const i = _tmp;
      if (i < _bind) {
        const a = _M0FP314vlmkit_2dsites4maps4main5areas[i];
        const d = _M0FP314vlmkit_2dsites4maps4main11world__dist(v.cx, v.cy, a._1, a._2);
        if (d < bd) {
          bd = d;
          best = i;
        }
        _tmp = i + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return best;
  }
  function _M0FP314vlmkit_2dsites4maps4main17set__search__text(s) {
    _M0MP26mizchi7signals6Signal3setGRP314vlmkit_2dsites4maps4main4ViewE(_M0FP314vlmkit_2dsites4maps4main12search__text, s);
    const _bind = _M0FP314vlmkit_2dsites4maps4main10search__el.val;
    if (_bind.$tag === 1) {
      const _Some = _bind;
      const _el = _Some._0;
      _M0FP314vlmkit_2dsites4maps4main10set__value(_el, s);
      return;
    } else {
      return;
    }
  }
  function _M0FP314vlmkit_2dsites4maps4main9run__text(t0) {
    const t = _M0MPC16string10StringView9to__owned(_M0MPC16string6String4trim(t0, undefined));
    if (t === "") {
      return undefined;
    }
    const lt = _M0MPC16string6String9to__lower(t);
    const _bind = _M0FP314vlmkit_2dsites4maps4main10cat__names.length;
    let _tmp = 0;
    while (true) {
      const c = _tmp;
      if (c < _bind) {
        const n = _M0FP314vlmkit_2dsites4maps4main10cat__names[c];
        if (_M0MPC16string6String9to__lower(n) === lt || _M0MPC16string6String9to__lower(_M0MPC15array5Array2atGUsiEE(_M0FP314vlmkit_2dsites4maps4main13cat__singular, c)) === lt) {
          _M0FP314vlmkit_2dsites4maps4main14show__category(c);
          return undefined;
        }
        _tmp = c + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    const _bind$2 = _M0FP314vlmkit_2dsites4maps4main6places.length;
    let _tmp$2 = 0;
    while (true) {
      const _ = _tmp$2;
      if (_ < _bind$2) {
        const p = _M0FP314vlmkit_2dsites4maps4main6places[_];
        if (_M0MPC16string6String9to__lower(p.name) === lt) {
          _M0FP314vlmkit_2dsites4maps4main13select__place(p.id);
          return undefined;
        }
        _tmp$2 = _ + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    const _bind$3 = _M0FP314vlmkit_2dsites4maps4main5areas.length;
    let _tmp$3 = 0;
    while (true) {
      const _ = _tmp$3;
      if (_ < _bind$3) {
        const a = _M0FP314vlmkit_2dsites4maps4main5areas[_];
        if (_M0MPC16string6String9to__lower(a._0) === lt) {
          const _x = a._1;
          const _y = a._2;
          _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4maps4main4chip, -1);
          _M0FP314vlmkit_2dsites4maps4main13show__results(new _M0TP314vlmkit_2dsites4maps4main5Query(-1, t, true, _x, _y, t));
          _M0FP314vlmkit_2dsites4maps4main15ease__to__point(_x, _y, 3);
          return undefined;
        }
        _tmp$3 = _ + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4maps4main4chip, -1);
    _M0FP314vlmkit_2dsites4maps4main13show__results(new _M0TP314vlmkit_2dsites4maps4main5Query(-1, t, false, 0, 0, t));
    const _bind$4 = _M0FP314vlmkit_2dsites4maps4main12fit__results();
    if (_bind$4 === undefined) {
      return;
    } else {
      const _Some = _bind$4;
      const _v = _Some;
      _M0FP314vlmkit_2dsites4maps4main7fly__to(_v);
      return;
    }
  }
  function _M0FP314vlmkit_2dsites4maps4main9run__sugg(s) {
    _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4maps4main12search__open, false);
    _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4maps4main14search__active, -1);
    switch (s.$tag) {
      case 0: {
        const _SCat = s;
        const _c = _SCat._0;
        _M0FP314vlmkit_2dsites4maps4main17set__search__text(_M0MPC15array5Array2atGUsiEE(_M0FP314vlmkit_2dsites4maps4main10cat__names, _c));
        _M0FP314vlmkit_2dsites4maps4main14show__category(_c);
        return;
      }
      case 1: {
        const _SNear = s;
        const _c$2 = _SNear._0;
        const _a = _SNear._1;
        const _bind = _M0MPC15array5Array2atGUsiEE(_M0FP314vlmkit_2dsites4maps4main5areas, _a);
        const _n = _bind._0;
        const _x = _bind._1;
        const _y = _bind._2;
        const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(6);
        _M0MPB13StringBuilder13write__objectGsE(_string_builder, _M0MPC15array5Array2atGUsiEE(_M0FP314vlmkit_2dsites4maps4main10cat__names, _c$2));
        _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, " near ");
        _M0MPB13StringBuilder13write__objectGsE(_string_builder, _n);
        _M0FP314vlmkit_2dsites4maps4main17set__search__text(_string_builder.val);
        _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4maps4main4chip, _c$2);
        const _string_builder$2 = _M0MPB13StringBuilder21StringBuilder_2einner(6);
        _M0MPB13StringBuilder13write__objectGsE(_string_builder$2, _M0MPC15array5Array2atGUsiEE(_M0FP314vlmkit_2dsites4maps4main10cat__names, _c$2));
        _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$2, " near ");
        _M0MPB13StringBuilder13write__objectGsE(_string_builder$2, _n);
        _M0FP314vlmkit_2dsites4maps4main13show__results(new _M0TP314vlmkit_2dsites4maps4main5Query(_c$2, "", true, _x, _y, _string_builder$2.val));
        _M0FP314vlmkit_2dsites4maps4main15ease__to__point(_x, _y, 3);
        return;
      }
      case 2: {
        const _SPlace = s;
        const _id = _SPlace._0;
        _M0FP314vlmkit_2dsites4maps4main17set__search__text(_M0MPC15array5Array2atGUsiEE(_M0FP314vlmkit_2dsites4maps4main6places, _id).name);
        _M0FP314vlmkit_2dsites4maps4main13select__place(_id);
        return;
      }
      case 3: {
        const _SArea = s;
        const _a$2 = _SArea._0;
        const _bind$2 = _M0MPC15array5Array2atGUsiEE(_M0FP314vlmkit_2dsites4maps4main5areas, _a$2);
        const _n$2 = _bind$2._0;
        const _x$2 = _bind$2._1;
        const _y$2 = _bind$2._2;
        _M0FP314vlmkit_2dsites4maps4main17set__search__text(_n$2);
        _M0FP314vlmkit_2dsites4maps4main15ease__to__point(_x$2, _y$2, 3);
        return;
      }
      default: {
        const _SRecent = s;
        const _t = _SRecent._0;
        _M0FP314vlmkit_2dsites4maps4main17set__search__text(_t);
        _M0FP314vlmkit_2dsites4maps4main9run__text(_t);
        return;
      }
    }
  }
  function _M0FP314vlmkit_2dsites4maps4main15search__keydown(e) {
    const k = _M0FP314vlmkit_2dsites4maps4main7ev__str(e, "key");
    const n = _M0FP314vlmkit_2dsites4maps4main11suggestions().length;
    switch (k) {
      case "ArrowDown": {
        _M0FP314vlmkit_2dsites4maps4main11ev__prevent(e);
        if (!_M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4maps4main12search__open)) {
          _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4maps4main12search__open, true);
          _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4maps4main14search__active, 0);
        } else {
          _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4maps4main14search__active, n === 0 ? -1 : (_M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4maps4main14search__active) + 1 | 0) % n | 0);
        }
        const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(5);
        _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, "sugg-");
        _M0MPB13StringBuilder13write__objectGiE(_string_builder, _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4maps4main14search__active));
        _M0FP314vlmkit_2dsites4maps4main12scroll__into(_string_builder.val);
        return;
      }
      case "ArrowUp": {
        _M0FP314vlmkit_2dsites4maps4main11ev__prevent(e);
        _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4maps4main12search__open, true);
        const a = _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4maps4main14search__active);
        _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4maps4main14search__active, n === 0 ? -1 : a <= 0 ? n - 1 | 0 : a - 1 | 0);
        const _string_builder$2 = _M0MPB13StringBuilder21StringBuilder_2einner(5);
        _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$2, "sugg-");
        _M0MPB13StringBuilder13write__objectGiE(_string_builder$2, _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4maps4main14search__active));
        _M0FP314vlmkit_2dsites4maps4main12scroll__into(_string_builder$2.val);
        return;
      }
      case "Enter": {
        _M0FP314vlmkit_2dsites4maps4main11ev__prevent(e);
        const a$2 = _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4maps4main14search__active);
        if (_M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4maps4main12search__open) && (a$2 >= 0 && a$2 < n)) {
          _M0FP314vlmkit_2dsites4maps4main9run__sugg(_M0MPC15array5Array2atGUsiEE(_M0FP314vlmkit_2dsites4maps4main11suggestions(), a$2));
          return;
        } else {
          _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4maps4main12search__open, false);
          _M0FP314vlmkit_2dsites4maps4main9run__text(_M0MP26mizchi7signals6Signal3getGRP314vlmkit_2dsites4maps4main4ViewE(_M0FP314vlmkit_2dsites4maps4main12search__text));
          return;
        }
      }
      case "Escape": {
        if (_M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4maps4main12search__open)) {
          _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4maps4main12search__open, false);
          _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4maps4main14search__active, -1);
          return;
        } else {
          _M0FP314vlmkit_2dsites4maps4main17set__search__text("");
          return;
        }
      }
      default: {
        return;
      }
    }
  }
  function _M0FP314vlmkit_2dsites4maps4main2da(k, f) {
    return { _0: k, _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(f) };
  }
  function _M0FP314vlmkit_2dsites4maps4main2sa(k, v) {
    return { _0: k, _1: new _M0DTP36mizchi4luna3dom4Attr10AttrString(v) };
  }
  function _M0FP314vlmkit_2dsites4maps4main16directions__icon(size) {
    return _M0FP36mizchi4luna3dom3svg(_M0MPC13int3Int18to__string_2einner(size, 10), _M0MPC13int3Int18to__string_2einner(size, 10), _M0FP314vlmkit_2dsites4maps4main16directions__iconN6constrS3420, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("aria-hidden", "true"), _M0FP314vlmkit_2dsites4maps4main2sa("focusable", "false")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom9svg__rect(_M0FP314vlmkit_2dsites4maps4main16directions__iconN6constrS3421, _M0FP314vlmkit_2dsites4maps4main16directions__iconN6constrS3422, _M0FP314vlmkit_2dsites4maps4main16directions__iconN6constrS3423, _M0FP314vlmkit_2dsites4maps4main16directions__iconN6constrS3424, _M0FP314vlmkit_2dsites4maps4main16directions__iconN6constrS3425, undefined, _M0FP314vlmkit_2dsites4maps4main16directions__iconN6constrS3426, undefined, undefined, undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("transform", "rotate(45 12 12)")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__), _M0FP36mizchi4luna3dom9svg__path(_M0FP314vlmkit_2dsites4maps4main8ic__turn, _M0FP314vlmkit_2dsites4maps4main16directions__iconN6constrS3427, _M0FP314vlmkit_2dsites4maps4main16directions__iconN6constrS3428, _M0FP314vlmkit_2dsites4maps4main16directions__iconN6constrS3429, _M0FP314vlmkit_2dsites4maps4main16directions__iconN6constrS3430, _M0FP314vlmkit_2dsites4maps4main16directions__iconN6constrS3431, undefined, undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__)]);
  }
  function _M0FP314vlmkit_2dsites4maps4main12icon_2einner(d, size, sw) {
    return _M0FP36mizchi4luna3dom3svg(_M0MPC13int3Int18to__string_2einner(size, 10), _M0MPC13int3Int18to__string_2einner(size, 10), _M0FP314vlmkit_2dsites4maps4main12icon_2einnerN6constrS3439, undefined, _M0FP314vlmkit_2dsites4maps4main12icon_2einnerN6constrS3440, _M0FP314vlmkit_2dsites4maps4main12icon_2einnerN6constrS3441, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("aria-hidden", "true"), _M0FP314vlmkit_2dsites4maps4main2sa("focusable", "false")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom9svg__path(d, undefined, undefined, sw, _M0FP314vlmkit_2dsites4maps4main12icon_2einnerN6constrS3442, _M0FP314vlmkit_2dsites4maps4main12icon_2einnerN6constrS3443, undefined, undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__)]);
  }
  function _M0FP314vlmkit_2dsites4maps4main11search__box() {
    return _M0FP36mizchi4luna3dom3div(undefined, _M0FP314vlmkit_2dsites4maps4main11search__boxN6constrS3447, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("role", "search")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4span(_M0FP314vlmkit_2dsites4maps4main11search__boxN6constrS3448, undefined, undefined, () => _M0MP26mizchi7signals6Signal3getGRP314vlmkit_2dsites4maps4main4ViewE(_M0FP314vlmkit_2dsites4maps4main12search__text) === "" ? "q-hint" : "q-hint off", undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4text("Search Wayfarer Maps")]), _M0FP36mizchi4luna3dom5input(_M0FP314vlmkit_2dsites4maps4main11search__boxN6constrS3449, undefined, undefined, undefined, -1, -1, -1, -1, _M0FP314vlmkit_2dsites4maps4main11search__boxN6constrS3450, undefined, undefined, undefined, undefined, undefined, undefined, undefined, new _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4Some(_M0MP36mizchi4luna3dom10HandlerMap7keydown(_M0MP36mizchi4luna3dom10HandlerMap4blur(_M0MP36mizchi4luna3dom10HandlerMap5focus(_M0MP36mizchi4luna3dom10HandlerMap5input(_M0FP36mizchi4luna3dom6events(), (e) => {
      const e$2 = e;
      const t = _M0MP26mizchi8js__core3Any5__get(e$2, "target");
      _M0MP26mizchi7signals6Signal3setGRP314vlmkit_2dsites4maps4main4ViewE(_M0FP314vlmkit_2dsites4maps4main12search__text, _M0MP26mizchi8js__core3Any5__get(t, "value"));
      _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4maps4main12search__open, true);
      _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4maps4main14search__active, -1);
    }), (_e) => {
      _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4maps4main12search__open, true);
      _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4maps4main12layers__open, false);
    }), (_e) => {
      _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4maps4main12search__open, false);
    }), (e) => {
      _M0FP314vlmkit_2dsites4maps4main15search__keydown(e);
    })), (el) => {
      _M0FP314vlmkit_2dsites4maps4main10search__el.val = new _M0DTPC16option6OptionGRP26mizchi8js__core3AnyE4Some(el);
    }, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("aria-labelledby", "q-label"), _M0FP314vlmkit_2dsites4maps4main2sa("role", "combobox"), _M0FP314vlmkit_2dsites4maps4main2sa("aria-autocomplete", "list"), _M0FP314vlmkit_2dsites4maps4main2sa("aria-controls", "q-list"), _M0FP314vlmkit_2dsites4maps4main2sa("autocomplete", "off"), _M0FP314vlmkit_2dsites4maps4main2sa("spellcheck", "false")]), new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4Some([_M0FP314vlmkit_2dsites4maps4main2da("aria-expanded", () => {
      const _p = _M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4maps4main12search__open);
      return _p ? "true" : "false";
    }), _M0FP314vlmkit_2dsites4maps4main2da("aria-activedescendant", () => {
      const a = _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4maps4main14search__active);
      if (_M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4maps4main12search__open) && a >= 0) {
        const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(5);
        _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, "sugg-");
        _M0MPB13StringBuilder13write__objectGiE(_string_builder, a);
        return _string_builder.val;
      } else {
        return "";
      }
    })])), _M0FP36mizchi4luna3dom4show(() => {
      const _p = _M0MP26mizchi7signals6Signal3getGRP314vlmkit_2dsites4maps4main4ViewE(_M0FP314vlmkit_2dsites4maps4main12search__text);
      const _p$2 = "";
      return !(_p === _p$2);
    }, () => _M0FP36mizchi4luna3dom6button(-1, undefined, _M0FP314vlmkit_2dsites4maps4main11search__boxN6constrS3451, undefined, undefined, undefined, undefined, new _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4Some(_M0MP36mizchi4luna3dom10HandlerMap5click(_M0FP36mizchi4luna3dom6events(), (_e) => {
      _M0FP314vlmkit_2dsites4maps4main17set__search__text("");
      _M0FP314vlmkit_2dsites4maps4main17close__everything();
      _M0FP314vlmkit_2dsites4maps4main9focus__id("q");
    })), undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("type", "button"), _M0FP314vlmkit_2dsites4maps4main2sa("aria-label", "Clear search")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP314vlmkit_2dsites4maps4main12icon_2einner(_M0FP314vlmkit_2dsites4maps4main9ic__close, 20, "2")])), _M0FP36mizchi4luna3dom6button(-1, undefined, _M0FP314vlmkit_2dsites4maps4main11search__boxN6constrS3452, undefined, undefined, undefined, undefined, new _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4Some(_M0MP36mizchi4luna3dom10HandlerMap5click(_M0FP36mizchi4luna3dom6events(), (_e) => {
      if (_M0MPC16string10StringView9to__owned(_M0MPC16string6String4trim(_M0MP26mizchi7signals6Signal3getGRP314vlmkit_2dsites4maps4main4ViewE(_M0FP314vlmkit_2dsites4maps4main12search__text), undefined)) === "") {
        _M0FP314vlmkit_2dsites4maps4main9focus__id("q");
        return;
      } else {
        _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4maps4main12search__open, false);
        _M0FP314vlmkit_2dsites4maps4main9run__text(_M0MP26mizchi7signals6Signal3getGRP314vlmkit_2dsites4maps4main4ViewE(_M0FP314vlmkit_2dsites4maps4main12search__text));
        return;
      }
    })), undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("type", "button"), _M0FP314vlmkit_2dsites4maps4main2sa("aria-label", "Search")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP314vlmkit_2dsites4maps4main12icon_2einner(_M0FP314vlmkit_2dsites4maps4main10ic__search, 22, "2")]), _M0FP36mizchi4luna3dom6button(-1, undefined, _M0FP314vlmkit_2dsites4maps4main11search__boxN6constrS3453, undefined, undefined, undefined, undefined, new _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4Some(_M0MP36mizchi4luna3dom10HandlerMap5click(_M0FP36mizchi4luna3dom6events(), (_e) => {
      if (_M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4maps4main5panel) === 3 && !_M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4maps4main9collapsed)) {
        _M0FP314vlmkit_2dsites4maps4main9focus__id("dir-from");
        return;
      } else {
        _M0FP314vlmkit_2dsites4maps4main16open__directions(_M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4maps4main8selected));
        return;
      }
    })), undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("type", "button"), _M0FP314vlmkit_2dsites4maps4main2sa("aria-label", "Get directions")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP314vlmkit_2dsites4maps4main16directions__icon(26)]), _M0FP36mizchi4luna3dom3div(undefined, _M0FP314vlmkit_2dsites4maps4main11search__boxN6constrS3454, undefined, () => _M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4maps4main12search__open) ? "sugg" : "sugg off", undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4show(() => _M0MPC16string10StringView9to__owned(_M0MPC16string6String4trim(_M0MP26mizchi7signals6Signal3getGRP314vlmkit_2dsites4maps4main4ViewE(_M0FP314vlmkit_2dsites4maps4main12search__text), undefined)) === "", () => _M0FP36mizchi4luna3dom1p(_M0FP314vlmkit_2dsites4maps4main11search__boxN6constrS3455, _M0FP314vlmkit_2dsites4maps4main11search__boxN6constrS3456, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("aria-hidden", "true")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4text("Recent")])), _M0FP36mizchi4luna3dom2ul(_M0FP314vlmkit_2dsites4maps4main11search__boxN6constrS3457, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("role", "listbox")]), new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4Some([_M0FP314vlmkit_2dsites4maps4main2da("aria-label", () => _M0MPC16string10StringView9to__owned(_M0MPC16string6String4trim(_M0MP26mizchi7signals6Signal3getGRP314vlmkit_2dsites4maps4main4ViewE(_M0FP314vlmkit_2dsites4maps4main12search__text), undefined)) === "" ? "Recent searches" : "Suggestions")]), [_M0FP36mizchi4luna3dom11index__eachGRP314vlmkit_2dsites4maps4main4SuggE(() => _M0FP314vlmkit_2dsites4maps4main11suggestions(), (item, i) => {
      const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(5);
      _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, "sugg-");
      _M0MPB13StringBuilder13write__objectGiE(_string_builder, i);
      return _M0FP36mizchi4luna3dom2li(_string_builder.val, undefined, undefined, () => _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4maps4main14search__active) === i ? "opt active" : "opt", undefined, new _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4Some(_M0MP36mizchi4luna3dom10HandlerMap5click(_M0MP36mizchi4luna3dom10HandlerMap9mousedown(_M0FP36mizchi4luna3dom6events(), (e) => {
        _M0FP314vlmkit_2dsites4maps4main11ev__prevent(e);
      }), (_e) => {
        _M0FP314vlmkit_2dsites4maps4main9run__sugg(item());
      })), undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("role", "option")]), new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4Some([_M0FP314vlmkit_2dsites4maps4main2da("aria-selected", () => {
        const _p = _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4maps4main14search__active) === i;
        return _p ? "true" : "false";
      })]), [_M0FP36mizchi4luna3dom4span(undefined, _M0FP314vlmkit_2dsites4maps4main11search__boxN6constrS3458, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom3svg(_M0FP314vlmkit_2dsites4maps4main11search__boxN6constrS3459, _M0FP314vlmkit_2dsites4maps4main11search__boxN6constrS3460, _M0FP314vlmkit_2dsites4maps4main11search__boxN6constrS3461, undefined, _M0FP314vlmkit_2dsites4maps4main11search__boxN6constrS3462, _M0FP314vlmkit_2dsites4maps4main11search__boxN6constrS3463, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("aria-hidden", "true")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom9svg__path(undefined, undefined, undefined, _M0FP314vlmkit_2dsites4maps4main11search__boxN6constrS3464, _M0FP314vlmkit_2dsites4maps4main11search__boxN6constrS3465, _M0FP314vlmkit_2dsites4maps4main11search__boxN6constrS3466, undefined, undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4Some([_M0FP314vlmkit_2dsites4maps4main2da("d", () => _M0FP314vlmkit_2dsites4maps4main10sugg__icon(item()))]))])]), _M0FP36mizchi4luna3dom4span(undefined, _M0FP314vlmkit_2dsites4maps4main11search__boxN6constrS3467, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4span(undefined, _M0FP314vlmkit_2dsites4maps4main11search__boxN6constrS3468, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom9text__dyn(() => _M0FP314vlmkit_2dsites4maps4main11sugg__label(item())._0)]), _M0FP36mizchi4luna3dom4span(undefined, _M0FP314vlmkit_2dsites4maps4main11search__boxN6constrS3469, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom9text__dyn(() => _M0FP314vlmkit_2dsites4maps4main11sugg__label(item())._1)])])]);
    })]), _M0FP36mizchi4luna3dom4show(() => _M0FP314vlmkit_2dsites4maps4main11suggestions().length === 0, () => _M0FP36mizchi4luna3dom1p(undefined, _M0FP314vlmkit_2dsites4maps4main11search__boxN6constrS3470, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4text("No matching places. Press Enter to search.")]))])]);
  }
  function _M0FP314vlmkit_2dsites4maps4main10chips__row() {
    const btns = [];
    const _bind = _M0FP314vlmkit_2dsites4maps4main10cat__names.length;
    let _tmp = 0;
    while (true) {
      const c = _tmp;
      if (c < _bind) {
        const n = _M0FP314vlmkit_2dsites4maps4main10cat__names[c];
        _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(btns, _M0FP36mizchi4luna3dom6button(-1, undefined, _M0FP314vlmkit_2dsites4maps4main10chips__rowN6constrS3488, undefined, undefined, undefined, undefined, new _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4Some(_M0MP36mizchi4luna3dom10HandlerMap5click(_M0FP36mizchi4luna3dom6events(), (_e) => {
          _M0FP314vlmkit_2dsites4maps4main12toggle__chip(c);
        })), undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("type", "button"), _M0FP314vlmkit_2dsites4maps4main2sa("data-cat", _M0MPC13int3Int18to__string_2einner(c, 10))]), new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4Some([_M0FP314vlmkit_2dsites4maps4main2da("aria-pressed", () => {
          const _p = _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4maps4main4chip) === c;
          return _p ? "true" : "false";
        })]), [_M0FP36mizchi4luna3dom4span(undefined, _M0FP314vlmkit_2dsites4maps4main10chips__rowN6constrS3489, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP314vlmkit_2dsites4maps4main12icon_2einner(_M0MPC15array5Array2atGUsiEE(_M0FP314vlmkit_2dsites4maps4main10cat__icons, c), 16, "2")]), _M0FP36mizchi4luna3dom4text(n)]));
        _tmp = c + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return _M0FP36mizchi4luna3dom3div(undefined, _M0FP314vlmkit_2dsites4maps4main10chips__rowN6constrS3490, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("role", "group"), _M0FP314vlmkit_2dsites4maps4main2sa("aria-label", "Show places by category")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, btns);
  }
  function _M0FP314vlmkit_2dsites4maps4main5stars(r) {
    const full = (r + 5 | 0) / 10 | 0;
    const kids = [];
    let _tmp = 0;
    while (true) {
      const i = _tmp;
      if (i < 5) {
        _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(kids, _M0FP36mizchi4luna3dom4span(undefined, i < full ? "star on" : "star", undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4text("★")]));
        _tmp = i + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return _M0FP36mizchi4luna3dom4span(undefined, _M0FP314vlmkit_2dsites4maps4main5starsN6constrS3497, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("aria-hidden", "true")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, kids);
  }
  function _M0FP314vlmkit_2dsites4maps4main11time__label(m) {
    const mm = m % 1440 | 0;
    const h = mm / 60 | 0;
    const mi = mm % 60 | 0;
    if (mm === 0) {
      return "Midnight";
    }
    if (mm === 720) {
      return "Noon";
    }
    const ap = h >= 12 ? "PM" : "AM";
    const h12 = (h % 12 | 0) === 0 ? 12 : h % 12 | 0;
    if (mi === 0) {
      const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(1);
      _M0MPB13StringBuilder13write__objectGiE(_string_builder, h12);
      _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, " ");
      _M0MPB13StringBuilder13write__objectGsE(_string_builder, ap);
      return _string_builder.val;
    } else {
      const pad = mi < 10 ? "0" : "";
      const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(2);
      _M0MPB13StringBuilder13write__objectGiE(_string_builder, h12);
      _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, ":");
      _M0MPB13StringBuilder13write__objectGsE(_string_builder, pad);
      _M0MPB13StringBuilder13write__objectGiE(_string_builder, mi);
      _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, " ");
      _M0MPB13StringBuilder13write__objectGsE(_string_builder, ap);
      return _string_builder.val;
    }
  }
  function _M0FP314vlmkit_2dsites4maps4main12open__status(p) {
    const h = _M0MPC15array5Array2atGORP26mizchi7signals10EffectNodeE(_M0FP314vlmkit_2dsites4maps4main12hours__table, p.hours);
    const _bind = _M0MPC15array5Array2atGUsiEE(h, 1);
    const _o = _bind._0;
    const _c = _bind._1;
    if (_o === 0 && _c === 1440) {
      return _M0FP314vlmkit_2dsites4maps4main12open__statusN5tupleS3512;
    }
    if (_o >= 0 && (870 >= _o && 870 < _c)) {
      const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(7);
      _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, "Closes ");
      _M0MPB13StringBuilder13write__objectGsE(_string_builder, _M0FP314vlmkit_2dsites4maps4main11time__label(_c));
      return { _0: true, _1: _string_builder.val };
    }
    if (_o >= 0 && 870 < _o) {
      const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(6);
      _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, "Opens ");
      _M0MPB13StringBuilder13write__objectGsE(_string_builder, _M0FP314vlmkit_2dsites4maps4main11time__label(_o));
      return { _0: false, _1: _string_builder.val };
    }
    let _tmp = 1;
    while (true) {
      const k = _tmp;
      if (k <= 7) {
        const d = (1 + k | 0) % 7 | 0;
        const _bind$2 = _M0MPC15array5Array2atGUsiEE(h, d);
        const _o2 = _bind$2._0;
        if (_o2 >= 0) {
          const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(7);
          _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, "Opens ");
          _M0MPB13StringBuilder13write__objectGsE(_string_builder, _M0FP314vlmkit_2dsites4maps4main11time__label(_o2));
          _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, " ");
          _M0MPB13StringBuilder13write__objectGsE(_string_builder, _M0MPC15array5Array2atGUsiEE(_M0FP314vlmkit_2dsites4maps4main10day__short, d));
          return { _0: false, _1: _string_builder.val };
        }
        _tmp = k + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return _M0FP314vlmkit_2dsites4maps4main12open__statusN5tupleS3513;
  }
  function _M0FP314vlmkit_2dsites4maps4main12status__line(p) {
    const _bind = _M0FP314vlmkit_2dsites4maps4main12open__status(p);
    const _open = _bind._0;
    const _rest = _bind._1;
    const _tmp = _M0FP36mizchi4luna3dom4span(undefined, _open ? "st-open" : "st-closed", undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4text(_open ? "Open" : "Closed")]);
    const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(4);
    _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, " · ");
    _M0MPB13StringBuilder13write__objectGsE(_string_builder, _rest);
    return _M0FP36mizchi4luna3dom4span(undefined, _M0FP314vlmkit_2dsites4maps4main12status__lineN6constrS3527, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_tmp, _M0FP36mizchi4luna3dom4text(_string_builder.val)]);
  }
  function _M0FP314vlmkit_2dsites4maps4main14place__address(p) {
    let best = 1000000000;
    let name = "";
    let along = 0;
    const _bind = _M0FP314vlmkit_2dsites4maps4main7streets.length;
    let _tmp = 0;
    while (true) {
      const _ = _tmp;
      if (_ < _bind) {
        const s = _M0FP314vlmkit_2dsites4maps4main7streets[_];
        const d = s.vertical ? Math.abs(p.x - s.at) : Math.abs(p.y - s.at);
        if (d < best) {
          best = d;
          name = s.name;
          along = s.vertical ? p.y : p.x;
        }
        _tmp = _ + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    const n = _M0MPC16double6Double7to__int(along / 20) + 1 | 0;
    const num = (n % 2 | 0) === 0 ? n + 1 | 0 : n;
    const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(1);
    _M0MPB13StringBuilder13write__objectGiE(_string_builder, num);
    _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, " ");
    _M0MPB13StringBuilder13write__objectGsE(_string_builder, name);
    return _string_builder.val;
  }
  function _M0FP314vlmkit_2dsites4maps4main6seeded(seed) {
    const st = _M0MPC13ref3Ref3RefGiE((Math.imul(seed, 7919) | 0) + 104729 | 0);
    return () => {
      st.val = (Math.imul(st.val, 1103515245) | 0) + 12345 & 2147483647;
      return st.val / 65536 | 0;
    };
  }
  function _M0FP314vlmkit_2dsites4maps4main10place__art(p, w, h, label) {
    const rnd = _M0FP314vlmkit_2dsites4maps4main6seeded((Math.imul(p.id, 31) | 0) + 7 | 0);
    const skies = ["#cfe3f5", "#f6dcc4", "#dfe8d6", "#e7dcf2", "#f3e6c2", "#d7e9ef"];
    const sky = _M0MPC15array5Array2atGUsiEE(skies, (p.id + (rnd() % 3 | 0) | 0) % skies.length | 0);
    const col = _M0MPC15array5Array2atGUsiEE(_M0FP314vlmkit_2dsites4maps4main11cat__colors, p.cat);
    const wd = w + 0;
    const hd = h + 0;
    const kids = [_M0FP36mizchi4luna3dom9svg__rect(_M0FP314vlmkit_2dsites4maps4main10place__artN6constrS3547, _M0FP314vlmkit_2dsites4maps4main10place__artN6constrS3548, _M0MPC13int3Int18to__string_2einner(w, 10), _M0MPC13int3Int18to__string_2einner(h, 10), undefined, undefined, sky, undefined, undefined, undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__), _M0FP36mizchi4luna3dom11svg__circle(_M0FP314vlmkit_2dsites4maps4main4fmt1(wd * (0.58 + ((rnd() % 30 | 0) + 0) / 100)), _M0FP314vlmkit_2dsites4maps4main4fmt1(hd * 0.26), _M0FP314vlmkit_2dsites4maps4main4fmt1(hd * 0.1), _M0FP314vlmkit_2dsites4maps4main10place__artN6constrS3549, undefined, undefined, undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("opacity", "0.9")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__)];
    const ground_y = hd * 0.72;
    const _bind = p.cat;
    switch (_bind) {
      case 4: {
        const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(22);
        _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, "M0 ");
        _M0MPB13StringBuilder13write__objectGsE(_string_builder, _M0FP314vlmkit_2dsites4maps4main4fmt1(ground_y));
        _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, " Q ");
        _M0MPB13StringBuilder13write__objectGsE(_string_builder, _M0FP314vlmkit_2dsites4maps4main4fmt1(wd * 0.3));
        _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, " ");
        _M0MPB13StringBuilder13write__objectGsE(_string_builder, _M0FP314vlmkit_2dsites4maps4main4fmt1(hd * 0.5));
        _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, " ");
        _M0MPB13StringBuilder13write__objectGsE(_string_builder, _M0FP314vlmkit_2dsites4maps4main4fmt1(wd * 0.6));
        _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, " ");
        _M0MPB13StringBuilder13write__objectGsE(_string_builder, _M0FP314vlmkit_2dsites4maps4main4fmt1(ground_y - hd * 0.05));
        _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, " T ");
        _M0MPB13StringBuilder13write__objectGdE(_string_builder, wd);
        _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, " ");
        _M0MPB13StringBuilder13write__objectGsE(_string_builder, _M0FP314vlmkit_2dsites4maps4main4fmt1(ground_y - hd * 0.1));
        _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, " V ");
        _M0MPB13StringBuilder13write__objectGdE(_string_builder, hd);
        _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, " H 0 Z");
        _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(kids, _M0FP36mizchi4luna3dom9svg__path(_string_builder.val, _M0FP314vlmkit_2dsites4maps4main10place__artN6constrS3550, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__));
        let _tmp = 0;
        while (true) {
          const i = _tmp;
          if (i < 4) {
            const tx = wd * (0.12 + (i + 0) * 0.24) + ((rnd() % 10 | 0) + 0);
            const th = hd * (0.22 + ((rnd() % 10 | 0) + 0) / 100);
            _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(kids, _M0FP36mizchi4luna3dom9svg__rect(_M0FP314vlmkit_2dsites4maps4main4fmt1(tx - 2), _M0FP314vlmkit_2dsites4maps4main4fmt1(ground_y - th * 0.3), _M0FP314vlmkit_2dsites4maps4main10place__artN6constrS3551, _M0FP314vlmkit_2dsites4maps4main4fmt1(th * 0.4), undefined, undefined, _M0FP314vlmkit_2dsites4maps4main10place__artN6constrS3552, undefined, undefined, undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__));
            _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(kids, _M0FP36mizchi4luna3dom11svg__circle(_M0FP314vlmkit_2dsites4maps4main4fmt1(tx), _M0FP314vlmkit_2dsites4maps4main4fmt1(ground_y - th * 0.55), _M0FP314vlmkit_2dsites4maps4main4fmt1(th * 0.42), (i % 2 | 0) === 0 ? "#2f7d43" : "#3f9455", undefined, undefined, undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__));
            _tmp = i + 1 | 0;
            continue;
          } else {
            break;
          }
        }
        break;
      }
      case 5: {
        _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(kids, _M0FP36mizchi4luna3dom9svg__rect(_M0FP314vlmkit_2dsites4maps4main10place__artN6constrS3553, _M0FP314vlmkit_2dsites4maps4main4fmt1(ground_y), _M0MPC13int3Int18to__string_2einner(w, 10), _M0FP314vlmkit_2dsites4maps4main4fmt1(hd - ground_y), undefined, undefined, _M0FP314vlmkit_2dsites4maps4main10place__artN6constrS3554, undefined, undefined, undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__));
        const _string_builder$2 = _M0MPB13StringBuilder21StringBuilder_2einner(16);
        _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$2, "M");
        _M0MPB13StringBuilder13write__objectGsE(_string_builder$2, _M0FP314vlmkit_2dsites4maps4main4fmt1(wd * 0.1));
        _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$2, " ");
        _M0MPB13StringBuilder13write__objectGsE(_string_builder$2, _M0FP314vlmkit_2dsites4maps4main4fmt1(ground_y));
        _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$2, " V ");
        _M0MPB13StringBuilder13write__objectGsE(_string_builder$2, _M0FP314vlmkit_2dsites4maps4main4fmt1(hd * 0.42));
        _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$2, " Q ");
        _M0MPB13StringBuilder13write__objectGsE(_string_builder$2, _M0FP314vlmkit_2dsites4maps4main4fmt1(wd * 0.5));
        _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$2, " ");
        _M0MPB13StringBuilder13write__objectGsE(_string_builder$2, _M0FP314vlmkit_2dsites4maps4main4fmt1(hd * 0.1));
        _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$2, " ");
        _M0MPB13StringBuilder13write__objectGsE(_string_builder$2, _M0FP314vlmkit_2dsites4maps4main4fmt1(wd * 0.9));
        _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$2, " ");
        _M0MPB13StringBuilder13write__objectGsE(_string_builder$2, _M0FP314vlmkit_2dsites4maps4main4fmt1(hd * 0.42));
        _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$2, " V ");
        _M0MPB13StringBuilder13write__objectGsE(_string_builder$2, _M0FP314vlmkit_2dsites4maps4main4fmt1(ground_y));
        _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$2, " Z");
        _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(kids, _M0FP36mizchi4luna3dom9svg__path(_string_builder$2.val, _M0FP314vlmkit_2dsites4maps4main10place__artN6constrS3555, _M0FP314vlmkit_2dsites4maps4main10place__artN6constrS3556, _M0FP314vlmkit_2dsites4maps4main10place__artN6constrS3557, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__));
        _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(kids, _M0FP36mizchi4luna3dom9svg__rect(_M0FP314vlmkit_2dsites4maps4main4fmt1(wd * 0.18), _M0FP314vlmkit_2dsites4maps4main4fmt1(ground_y - hd * 0.2), _M0FP314vlmkit_2dsites4maps4main4fmt1(wd * 0.64), _M0FP314vlmkit_2dsites4maps4main4fmt1(hd * 0.2), _M0FP314vlmkit_2dsites4maps4main10place__artN6constrS3558, undefined, col, undefined, undefined, undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__));
        let _tmp$2 = 0;
        while (true) {
          const i = _tmp$2;
          if (i < 5) {
            _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(kids, _M0FP36mizchi4luna3dom9svg__rect(_M0FP314vlmkit_2dsites4maps4main4fmt1(wd * (0.22 + (i + 0) * 0.12)), _M0FP314vlmkit_2dsites4maps4main4fmt1(ground_y - hd * 0.16), _M0FP314vlmkit_2dsites4maps4main4fmt1(wd * 0.08), _M0FP314vlmkit_2dsites4maps4main4fmt1(hd * 0.07), _M0FP314vlmkit_2dsites4maps4main10place__artN6constrS3559, undefined, _M0FP314vlmkit_2dsites4maps4main10place__artN6constrS3560, undefined, undefined, undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__));
            _tmp$2 = i + 1 | 0;
            continue;
          } else {
            break;
          }
        }
        break;
      }
      default: {
        _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(kids, _M0FP36mizchi4luna3dom9svg__rect(_M0FP314vlmkit_2dsites4maps4main10place__artN6constrS3561, _M0FP314vlmkit_2dsites4maps4main4fmt1(ground_y), _M0MPC13int3Int18to__string_2einner(w, 10), _M0FP314vlmkit_2dsites4maps4main4fmt1(hd - ground_y), undefined, undefined, _M0FP314vlmkit_2dsites4maps4main10place__artN6constrS3562, undefined, undefined, undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__));
        const nb = ["#e4d6c3", "#cfd8dc", "#e8cfc4", "#d9d3e6"];
        _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(kids, _M0FP36mizchi4luna3dom9svg__rect(_M0FP314vlmkit_2dsites4maps4main10place__artN6constrS3563, _M0FP314vlmkit_2dsites4maps4main4fmt1(hd * 0.3), _M0FP314vlmkit_2dsites4maps4main4fmt1(wd * 0.26), _M0FP314vlmkit_2dsites4maps4main4fmt1(ground_y - hd * 0.3), undefined, undefined, _M0MPC15array5Array2atGUsiEE(nb, rnd() % 4 | 0), undefined, undefined, undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__));
        _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(kids, _M0FP36mizchi4luna3dom9svg__rect(_M0FP314vlmkit_2dsites4maps4main4fmt1(wd * 0.74), _M0FP314vlmkit_2dsites4maps4main4fmt1(hd * 0.22), _M0FP314vlmkit_2dsites4maps4main4fmt1(wd * 0.26), _M0FP314vlmkit_2dsites4maps4main4fmt1(ground_y - hd * 0.22), undefined, undefined, _M0MPC15array5Array2atGUsiEE(nb, rnd() % 4 | 0), undefined, undefined, undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__));
        const fronts = ["#f4efe6", "#ead9c4", "#dde6ea", "#f0ddd2", "#e2e8d8", "#ece2f0", "#f6e7c8"];
        const front = _M0MPC15array5Array2atGUsiEE(fronts, rnd() % fronts.length | 0);
        const bx = wd * (0.2 + ((rnd() % 12 | 0) + 0) / 100);
        const bw = wd * (0.46 + ((rnd() % 14 | 0) + 0) / 100);
        const top = p.cat === 2 ? hd * (0.06 + ((rnd() % 8 | 0) + 0) / 100) : hd * (0.22 + ((rnd() % 18 | 0) + 0) / 100);
        _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(kids, _M0FP36mizchi4luna3dom9svg__rect(_M0FP314vlmkit_2dsites4maps4main4fmt1(bx), _M0FP314vlmkit_2dsites4maps4main4fmt1(top), _M0FP314vlmkit_2dsites4maps4main4fmt1(bw), _M0FP314vlmkit_2dsites4maps4main4fmt1(ground_y - top), undefined, undefined, front, undefined, undefined, undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__));
        if ((rnd() % 2 | 0) === 0) {
          const tx = (rnd() % 2 | 0) === 0 ? wd * 0.1 : wd * 0.9;
          _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(kids, _M0FP36mizchi4luna3dom9svg__rect(_M0FP314vlmkit_2dsites4maps4main4fmt1(tx - 1.5), _M0FP314vlmkit_2dsites4maps4main4fmt1(ground_y - hd * 0.16), _M0FP314vlmkit_2dsites4maps4main10place__artN6constrS3564, _M0FP314vlmkit_2dsites4maps4main4fmt1(hd * 0.16), undefined, undefined, _M0FP314vlmkit_2dsites4maps4main10place__artN6constrS3565, undefined, undefined, undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__));
          _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(kids, _M0FP36mizchi4luna3dom11svg__circle(_M0FP314vlmkit_2dsites4maps4main4fmt1(tx), _M0FP314vlmkit_2dsites4maps4main4fmt1(ground_y - hd * 0.2), _M0FP314vlmkit_2dsites4maps4main4fmt1(hd * 0.1), _M0FP314vlmkit_2dsites4maps4main10place__artN6constrS3566, undefined, undefined, undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__));
        } else {
          const lx = (rnd() % 2 | 0) === 0 ? bx - wd * 0.04 : bx + bw + wd * 0.04;
          _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(kids, _M0FP36mizchi4luna3dom9svg__rect(_M0FP314vlmkit_2dsites4maps4main4fmt1(lx - 1), _M0FP314vlmkit_2dsites4maps4main4fmt1(ground_y - hd * 0.3), _M0FP314vlmkit_2dsites4maps4main10place__artN6constrS3567, _M0FP314vlmkit_2dsites4maps4main4fmt1(hd * 0.3), undefined, undefined, _M0FP314vlmkit_2dsites4maps4main10place__artN6constrS3568, undefined, undefined, undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__));
          _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(kids, _M0FP36mizchi4luna3dom11svg__circle(_M0FP314vlmkit_2dsites4maps4main4fmt1(lx), _M0FP314vlmkit_2dsites4maps4main4fmt1(ground_y - hd * 0.3), _M0FP314vlmkit_2dsites4maps4main10place__artN6constrS3569, _M0FP314vlmkit_2dsites4maps4main10place__artN6constrS3570, undefined, undefined, undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__));
        }
        if (p.cat === 3) {
          const _string_builder$3 = _M0MPB13StringBuilder21StringBuilder_2einner(12);
          _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$3, "M");
          _M0MPB13StringBuilder13write__objectGsE(_string_builder$3, _M0FP314vlmkit_2dsites4maps4main4fmt1(bx - 4));
          _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$3, " ");
          _M0MPB13StringBuilder13write__objectGsE(_string_builder$3, _M0FP314vlmkit_2dsites4maps4main4fmt1(top));
          _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$3, " L ");
          _M0MPB13StringBuilder13write__objectGsE(_string_builder$3, _M0FP314vlmkit_2dsites4maps4main4fmt1(bx + bw / 2));
          _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$3, " ");
          _M0MPB13StringBuilder13write__objectGsE(_string_builder$3, _M0FP314vlmkit_2dsites4maps4main4fmt1(top - hd * 0.14));
          _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$3, " L ");
          _M0MPB13StringBuilder13write__objectGsE(_string_builder$3, _M0FP314vlmkit_2dsites4maps4main4fmt1(bx + bw + 4));
          _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$3, " ");
          _M0MPB13StringBuilder13write__objectGsE(_string_builder$3, _M0FP314vlmkit_2dsites4maps4main4fmt1(top));
          _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$3, " Z");
          _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(kids, _M0FP36mizchi4luna3dom9svg__path(_string_builder$3.val, col, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__));
          let _tmp$3 = 0;
          while (true) {
            const i = _tmp$3;
            if (i < 5) {
              _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(kids, _M0FP36mizchi4luna3dom9svg__rect(_M0FP314vlmkit_2dsites4maps4main4fmt1(bx + bw * (0.08 + (i + 0) * 0.2)), _M0FP314vlmkit_2dsites4maps4main4fmt1(top + hd * 0.04), _M0FP314vlmkit_2dsites4maps4main4fmt1(bw * 0.07), _M0FP314vlmkit_2dsites4maps4main4fmt1(ground_y - top - hd * 0.04), undefined, undefined, _M0FP314vlmkit_2dsites4maps4main10place__artN6constrS3571, undefined, undefined, undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__));
              _tmp$3 = i + 1 | 0;
              continue;
            } else {
              break;
            }
          }
        } else {
          const rows = p.cat === 2 ? 4 : 1 + (rnd() % 2 | 0) | 0;
          const cols = 2 + (rnd() % 3 | 0) | 0;
          let _tmp$3 = 0;
          while (true) {
            const r = _tmp$3;
            if (r < rows) {
              let _tmp$4 = 0;
              while (true) {
                const c = _tmp$4;
                if (c < cols) {
                  _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(kids, _M0FP36mizchi4luna3dom9svg__rect(_M0FP314vlmkit_2dsites4maps4main4fmt1(bx + bw * (0.1 + (c + 0) * 0.82 / (cols + 0))), _M0FP314vlmkit_2dsites4maps4main4fmt1(top + hd * (0.05 + (r + 0) * 0.12)), _M0FP314vlmkit_2dsites4maps4main4fmt1(bw * 0.5 / (cols + 0)), _M0FP314vlmkit_2dsites4maps4main4fmt1(hd * 0.07), _M0FP314vlmkit_2dsites4maps4main10place__artN6constrS3572, undefined, _M0FP314vlmkit_2dsites4maps4main10place__artN6constrS3573, undefined, undefined, undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__));
                  _tmp$4 = c + 1 | 0;
                  continue;
                } else {
                  break;
                }
              }
              _tmp$3 = r + 1 | 0;
              continue;
            } else {
              break;
            }
          }
          _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(kids, _M0FP36mizchi4luna3dom9svg__rect(_M0FP314vlmkit_2dsites4maps4main4fmt1(bx - 3), _M0FP314vlmkit_2dsites4maps4main4fmt1(ground_y - hd * 0.26), _M0FP314vlmkit_2dsites4maps4main4fmt1(bw + 6), _M0FP314vlmkit_2dsites4maps4main4fmt1(hd * 0.07), undefined, undefined, col, undefined, undefined, undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__));
          _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(kids, _M0FP36mizchi4luna3dom9svg__rect(_M0FP314vlmkit_2dsites4maps4main4fmt1(bx + bw * (0.2 + ((rnd() % 50 | 0) + 0) / 100)), _M0FP314vlmkit_2dsites4maps4main4fmt1(ground_y - hd * 0.17), _M0FP314vlmkit_2dsites4maps4main4fmt1(wd * 0.12), _M0FP314vlmkit_2dsites4maps4main4fmt1(hd * 0.17), undefined, undefined, _M0FP314vlmkit_2dsites4maps4main10place__artN6constrS3574, undefined, undefined, undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__));
        }
      }
    }
    let attrs;
    if (label) {
      const _tmp$3 = _M0FP314vlmkit_2dsites4maps4main2sa("role", "img");
      const _string_builder$3 = _M0MPB13StringBuilder21StringBuilder_2einner(16);
      _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$3, "Illustration of ");
      _M0MPB13StringBuilder13write__objectGsE(_string_builder$3, p.name);
      attrs = [_tmp$3, _M0FP314vlmkit_2dsites4maps4main2sa("aria-label", _string_builder$3.val)];
    } else {
      attrs = [_M0FP314vlmkit_2dsites4maps4main2sa("aria-hidden", "true"), _M0FP314vlmkit_2dsites4maps4main2sa("focusable", "false")];
    }
    const _tmp$3 = _M0MPC13int3Int18to__string_2einner(w, 10);
    const _tmp$4 = _M0MPC13int3Int18to__string_2einner(h, 10);
    const _string_builder$3 = _M0MPB13StringBuilder21StringBuilder_2einner(5);
    _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$3, "0 0 ");
    _M0MPB13StringBuilder13write__objectGiE(_string_builder$3, w);
    _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$3, " ");
    _M0MPB13StringBuilder13write__objectGiE(_string_builder$3, h);
    const _tmp$5 = _string_builder$3.val;
    const _self = [];
    _M0MPC15array5Array10push__iterGUsRP36mizchi4luna3dom4AttrEE(_self, _M0MPC15array5Array4iterGUsRP36mizchi4luna3dom4AttrEE(attrs));
    _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(_self, _M0FP314vlmkit_2dsites4maps4main2sa("preserveAspectRatio", "xMidYMid slice"));
    return _M0FP36mizchi4luna3dom3svg(_tmp$3, _tmp$4, _tmp$5, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some(_self), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, kids);
  }
  function _M0FP314vlmkit_2dsites4maps4main11rating__str(r) {
    const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(1);
    _M0MPB13StringBuilder13write__objectGiE(_string_builder, r / 10 | 0);
    _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, ".");
    _M0MPB13StringBuilder13write__objectGiE(_string_builder, r % 10 | 0);
    return _string_builder.val;
  }
  function _M0FP314vlmkit_2dsites4maps4main11result__row(id) {
    const p = _M0MPC15array5Array2atGUsiEE(_M0FP314vlmkit_2dsites4maps4main6places, id);
    const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(4);
    _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, "row-");
    _M0MPB13StringBuilder13write__objectGiE(_string_builder, id);
    const _tmp = _string_builder.val;
    const _tmp$2 = new _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4Some(_M0MP36mizchi4luna3dom10HandlerMap5click(_M0MP36mizchi4luna3dom10HandlerMap4blur(_M0MP36mizchi4luna3dom10HandlerMap5focus(_M0MP36mizchi4luna3dom10HandlerMap10mouseleave(_M0MP36mizchi4luna3dom10HandlerMap10mouseenter(_M0FP36mizchi4luna3dom6events(), (_e) => {
      _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4maps4main3hot, id);
    }), (_e) => {
      if (_M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4maps4main3hot) === id) {
        _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4maps4main3hot, -1);
        return;
      } else {
        return;
      }
    }), (_e) => {
      _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4maps4main3hot, id);
    }), (_e) => {
      if (_M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4maps4main3hot) === id) {
        _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4maps4main3hot, -1);
        return;
      } else {
        return;
      }
    }), (_e) => {
      _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4maps4main3hot, -1);
      _M0FP314vlmkit_2dsites4maps4main13select__place(id);
    }));
    const _tmp$3 = new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("type", "button")]);
    const _tmp$4 = _M0FP36mizchi4luna3dom4span(undefined, _M0FP314vlmkit_2dsites4maps4main11result__rowN6constrS3622, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4text(p.name)]);
    const _tmp$5 = _M0FP36mizchi4luna3dom4text(`${_M0FP314vlmkit_2dsites4maps4main11rating__str(p.rating)} `);
    const _tmp$6 = _M0FP314vlmkit_2dsites4maps4main5stars(p.rating);
    const _string_builder$2 = _M0MPB13StringBuilder21StringBuilder_2einner(3);
    _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$2, " (");
    _M0MPB13StringBuilder13write__objectGiE(_string_builder$2, p.reviews);
    _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$2, ")");
    const _tmp$7 = _M0FP36mizchi4luna3dom4span(undefined, _M0FP314vlmkit_2dsites4maps4main11result__rowN6constrS3623, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_tmp$5, _tmp$6, _M0FP36mizchi4luna3dom4span(undefined, _M0FP314vlmkit_2dsites4maps4main11result__rowN6constrS3624, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4text(_string_builder$2.val)])]);
    const _string_builder$3 = _M0MPB13StringBuilder21StringBuilder_2einner(8);
    _M0MPB13StringBuilder13write__objectGsE(_string_builder$3, _M0MPC15array5Array2atGUsiEE(_M0FP314vlmkit_2dsites4maps4main13cat__singular, p.cat));
    _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$3, " · ");
    _M0MPB13StringBuilder13write__objectGsE(_string_builder$3, _M0FP314vlmkit_2dsites4maps4main11place__area(p));
    _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$3, " · ");
    _M0MPB13StringBuilder13write__objectGsE(_string_builder$3, _M0FP314vlmkit_2dsites4maps4main14place__address(p));
    return _M0FP36mizchi4luna3dom2li(undefined, _M0FP314vlmkit_2dsites4maps4main11result__rowN6constrS3619, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom6button(-1, _tmp, _M0FP314vlmkit_2dsites4maps4main11result__rowN6constrS3620, undefined, undefined, undefined, undefined, _tmp$2, undefined, _tmp$3, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4span(undefined, _M0FP314vlmkit_2dsites4maps4main11result__rowN6constrS3621, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_tmp$4, _tmp$7, _M0FP36mizchi4luna3dom4span(undefined, _M0FP314vlmkit_2dsites4maps4main11result__rowN6constrS3625, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4text(_string_builder$3.val)]), _M0FP314vlmkit_2dsites4maps4main12status__line(p)]), _M0FP36mizchi4luna3dom4span(undefined, _M0FP314vlmkit_2dsites4maps4main11result__rowN6constrS3626, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP314vlmkit_2dsites4maps4main10place__art(p, 84, 84, false)])])]);
  }
  function _M0FP314vlmkit_2dsites4maps4main11open__share(url) {
    _M0MP26mizchi7signals6Signal3setGRP314vlmkit_2dsites4maps4main4ViewE(_M0FP314vlmkit_2dsites4maps4main10share__url, url);
    _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4maps4main6copied, false);
    const _bind = _M0FP314vlmkit_2dsites4maps4main9share__el.val;
    if (_bind.$tag === 1) {
      const _Some = _bind;
      const _el = _Some._0;
      _M0FP314vlmkit_2dsites4maps4main12dialog__show(_el);
      return;
    } else {
      return;
    }
  }
  function _M0FP314vlmkit_2dsites4maps4main13results__view() {
    return _M0FP36mizchi4luna3dom7section(undefined, _M0FP314vlmkit_2dsites4maps4main13results__viewN6constrS3641, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("aria-labelledby", "results-h")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom3div(undefined, _M0FP314vlmkit_2dsites4maps4main13results__viewN6constrS3642, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom2h2(_M0FP314vlmkit_2dsites4maps4main13results__viewN6constrS3643, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4text("Results")]), _M0FP36mizchi4luna3dom6button(-1, undefined, _M0FP314vlmkit_2dsites4maps4main13results__viewN6constrS3644, undefined, undefined, undefined, undefined, new _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4Some(_M0MP36mizchi4luna3dom10HandlerMap5click(_M0FP36mizchi4luna3dom6events(), (_e) => {
      const q = _M0MP26mizchi7signals6Signal3getGRP314vlmkit_2dsites4maps4main4ViewE(_M0FP314vlmkit_2dsites4maps4main5query);
      const slug = q.cat >= 0 ? _M0MPC16string6String9to__lower(_M0MPC15array5Array2atGUsiEE(_M0FP314vlmkit_2dsites4maps4main10cat__names, q.cat)) : _M0MPC16string6String9to__lower(q.text);
      const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(37);
      _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, "https://maps.wayfarer.example/search/");
      _M0MPB13StringBuilder13write__objectGsE(_string_builder, slug);
      _M0FP314vlmkit_2dsites4maps4main11open__share(_string_builder.val);
    })), undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("type", "button")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP314vlmkit_2dsites4maps4main12icon_2einner(_M0FP314vlmkit_2dsites4maps4main9ic__share, 18, "2"), _M0FP36mizchi4luna3dom4text("Share")])]), _M0FP36mizchi4luna3dom1p(undefined, _M0FP314vlmkit_2dsites4maps4main13results__viewN6constrS3645, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom9text__dyn(() => {
      const n = _M0FP314vlmkit_2dsites4maps4main7results().length;
      const what = _M0MP26mizchi7signals6Signal3getGRP314vlmkit_2dsites4maps4main4ViewE(_M0FP314vlmkit_2dsites4maps4main5query).label;
      const noun = n === 1 ? "place" : "places";
      const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(5);
      _M0MPB13StringBuilder13write__objectGsE(_string_builder, what);
      _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, " · ");
      _M0MPB13StringBuilder13write__objectGiE(_string_builder, n);
      _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, " ");
      _M0MPB13StringBuilder13write__objectGsE(_string_builder, noun);
      return `${_string_builder.val}${_M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4maps4main11follow__map) ? " in this area" : ""}`;
    })]), _M0FP36mizchi4luna3dom2ul(undefined, _M0FP314vlmkit_2dsites4maps4main13results__viewN6constrS3646, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("aria-label", "Results")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom9for__eachGiE(() => _M0FP314vlmkit_2dsites4maps4main7results(), (id, _i) => _M0FP314vlmkit_2dsites4maps4main11result__row(id))]), _M0FP36mizchi4luna3dom4show(() => _M0FP314vlmkit_2dsites4maps4main7results().length === 0, () => _M0FP36mizchi4luna3dom1p(undefined, _M0FP314vlmkit_2dsites4maps4main13results__viewN6constrS3647, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4text("No results in this part of the map. Move the map or untick the box below.")]))]);
  }
  function _M0FP314vlmkit_2dsites4maps4main13round__action(label, ic, pressed, f) {
    let dattrs;
    if (pressed === undefined) {
      dattrs = [];
    } else {
      const _Some = pressed;
      const _g = _Some;
      dattrs = [_M0FP314vlmkit_2dsites4maps4main2da("aria-pressed", _g)];
    }
    return _M0FP36mizchi4luna3dom6button(-1, undefined, _M0FP314vlmkit_2dsites4maps4main13round__actionN6constrS3658, undefined, undefined, undefined, undefined, new _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4Some(_M0MP36mizchi4luna3dom10HandlerMap5click(_M0FP36mizchi4luna3dom6events(), (_e) => {
      f();
    })), undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("type", "button")]), new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4Some(dattrs), [_M0FP36mizchi4luna3dom4span(undefined, _M0FP314vlmkit_2dsites4maps4main13round__actionN6constrS3659, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [ic]), _M0FP36mizchi4luna3dom4span(undefined, _M0FP314vlmkit_2dsites4maps4main13round__actionN6constrS3660, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4text(label)])]);
  }
  function _M0FP314vlmkit_2dsites4maps4main7tablist(label, prefix, names, subs, sig) {
    const n = names.length;
    const tabs = [];
    const _bind = names.length;
    let _tmp = 0;
    while (true) {
      const i = _tmp;
      if (i < _bind) {
        const name = names[i];
        const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(5);
        _M0MPB13StringBuilder13write__objectGsE(_string_builder, prefix);
        _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, "-tab-");
        _M0MPB13StringBuilder13write__objectGiE(_string_builder, i);
        const _tmp$2 = _string_builder.val;
        const _tmp$3 = new _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4Some(_M0MP36mizchi4luna3dom10HandlerMap7keydown(_M0MP36mizchi4luna3dom10HandlerMap5click(_M0FP36mizchi4luna3dom6events(), (_e) => {
          _M0MP26mizchi7signals6Signal3setGiE(sig, i);
        }), (e) => {
          const e$2 = e;
          const k = _M0FP314vlmkit_2dsites4maps4main7ev__str(e$2, "key");
          let next;
          switch (k) {
            case "ArrowRight": {
              next = (i + 1 | 0) % n | 0;
              break;
            }
            case "ArrowLeft": {
              next = ((i + n | 0) - 1 | 0) % n | 0;
              break;
            }
            case "Home": {
              next = 0;
              break;
            }
            case "End": {
              next = n - 1 | 0;
              break;
            }
            default: {
              next = -1;
            }
          }
          if (next >= 0) {
            _M0FP314vlmkit_2dsites4maps4main11ev__prevent(e$2);
            _M0MP26mizchi7signals6Signal3setGiE(sig, next);
            const _string_builder$2 = _M0MPB13StringBuilder21StringBuilder_2einner(5);
            _M0MPB13StringBuilder13write__objectGsE(_string_builder$2, prefix);
            _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$2, "-tab-");
            _M0MPB13StringBuilder13write__objectGiE(_string_builder$2, next);
            _M0FP314vlmkit_2dsites4maps4main9focus__id(_string_builder$2.val);
            return;
          } else {
            return;
          }
        }));
        const _tmp$4 = _M0FP314vlmkit_2dsites4maps4main2sa("role", "tab");
        const _tmp$5 = _M0FP314vlmkit_2dsites4maps4main2sa("type", "button");
        let _tmp$6;
        if (prefix === "mode") {
          _tmp$6 = "mode-panel";
        } else {
          const _string_builder$2 = _M0MPB13StringBuilder21StringBuilder_2einner(7);
          _M0MPB13StringBuilder13write__objectGsE(_string_builder$2, prefix);
          _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$2, "-panel-");
          _M0MPB13StringBuilder13write__objectGiE(_string_builder$2, i);
          _tmp$6 = _string_builder$2.val;
        }
        _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(tabs, _M0FP36mizchi4luna3dom6button(-1, _tmp$2, undefined, undefined, () => _M0MP26mizchi7signals6Signal3getGiE(sig) === i ? "tab on" : "tab", undefined, undefined, _tmp$3, undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_tmp$4, _tmp$5, _M0FP314vlmkit_2dsites4maps4main2sa("aria-controls", _tmp$6)]), new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4Some([_M0FP314vlmkit_2dsites4maps4main2da("aria-selected", () => {
          const _p = _M0MP26mizchi7signals6Signal3getGiE(sig) === i;
          return _p ? "true" : "false";
        }), _M0FP314vlmkit_2dsites4maps4main2da("tabindex", () => _M0MP26mizchi7signals6Signal3getGiE(sig) === i ? "0" : "-1")]), [_M0FP36mizchi4luna3dom4span(undefined, _M0FP314vlmkit_2dsites4maps4main7tablistN6constrS3669, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4text(name)]), _M0FP36mizchi4luna3dom4show(() => subs.length > i, () => _M0FP36mizchi4luna3dom4span(undefined, _M0FP314vlmkit_2dsites4maps4main7tablistN6constrS3670, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom9text__dyn(() => {
          const _func = _M0MPC15array5Array2atGUsiEE(subs, i);
          return _func();
        })]))]));
        _tmp = i + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return _M0FP36mizchi4luna3dom3div(undefined, _M0FP314vlmkit_2dsites4maps4main7tablistN6constrS3671, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("role", "tablist"), _M0FP314vlmkit_2dsites4maps4main2sa("aria-label", label)]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, tabs);
  }
  function _M0FP314vlmkit_2dsites4maps4main8tabpanel(prefix, i, sig, kids) {
    const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(7);
    _M0MPB13StringBuilder13write__objectGsE(_string_builder, prefix);
    _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, "-panel-");
    _M0MPB13StringBuilder13write__objectGiE(_string_builder, i);
    const _tmp = _string_builder.val;
    const _tmp$2 = _M0FP314vlmkit_2dsites4maps4main2sa("role", "tabpanel");
    const _string_builder$2 = _M0MPB13StringBuilder21StringBuilder_2einner(5);
    _M0MPB13StringBuilder13write__objectGsE(_string_builder$2, prefix);
    _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$2, "-tab-");
    _M0MPB13StringBuilder13write__objectGiE(_string_builder$2, i);
    return _M0FP36mizchi4luna3dom3div(_tmp, undefined, undefined, () => _M0MP26mizchi7signals6Signal3getGiE(sig) === i ? "tabpanel" : "tabpanel off", undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_tmp$2, _M0FP314vlmkit_2dsites4maps4main2sa("aria-labelledby", _string_builder$2.val), _M0FP314vlmkit_2dsites4maps4main2sa("tabindex", "0")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, kids);
  }
  function _M0FP314vlmkit_2dsites4maps4main14place__reviews(p) {
    const rnd = _M0FP314vlmkit_2dsites4maps4main6seeded(p.id + 3 | 0);
    const pool = _M0MPC15array5Array2atGORP26mizchi7signals10EffectNodeE(_M0FP314vlmkit_2dsites4maps4main12review__text, p.cat);
    const out = [];
    const used_t = [];
    const used_a = [];
    let _tmp = 0;
    while (true) {
      const i = _tmp;
      if (i < 5) {
        let t = rnd() % pool.length | 0;
        while (true) {
          if (_M0MPC15array5Array8containsGiE(used_t, t)) {
            t = (t + 1 | 0) % pool.length | 0;
            continue;
          } else {
            break;
          }
        }
        _M0MPC15array5Array4pushGiE(used_t, t);
        let a = rnd() % _M0FP314vlmkit_2dsites4maps4main15review__authors.length | 0;
        while (true) {
          if (_M0MPC15array5Array8containsGiE(used_a, a)) {
            a = (a + 1 | 0) % _M0FP314vlmkit_2dsites4maps4main15review__authors.length | 0;
            continue;
          } else {
            break;
          }
        }
        _M0MPC15array5Array4pushGiE(used_a, a);
        const d = rnd() % _M0FP314vlmkit_2dsites4maps4main13review__dates.length | 0;
        const base = (p.rating + 5 | 0) / 10 | 0;
        const wobble = (rnd() % 3 | 0) - 1 | 0;
        const s0 = base + wobble | 0;
        const stars = s0 > 5 ? 5 : s0 < 2 ? 2 : s0;
        const _bind = _M0MPC15array5Array2atGUsiEE(_M0FP314vlmkit_2dsites4maps4main13review__dates, d);
        const _ds = _bind._0;
        const _dk = _bind._1;
        _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(out, new _M0TP314vlmkit_2dsites4maps4main6Review(_M0MPC15array5Array2atGUsiEE(_M0FP314vlmkit_2dsites4maps4main15review__authors, a), stars, _ds, _dk, _M0MPC15array5Array2atGUsiEE(pool, t), i));
        _tmp = i + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return out;
  }
  function _M0FP314vlmkit_2dsites4maps4main15sorted__reviews(p, how) {
    const rs = _M0FP314vlmkit_2dsites4maps4main14place__reviews(p);
    switch (how) {
      case 1: {
        _M0MPC15array5Array8sort__byGRP314vlmkit_2dsites4maps4main6ReviewE(rs, (a, b) => b.key - a.key | 0);
        break;
      }
      case 2: {
        _M0MPC15array5Array8sort__byGRP314vlmkit_2dsites4maps4main6ReviewE(rs, (a, b) => b.stars !== a.stars ? b.stars - a.stars | 0 : a.order - b.order | 0);
        break;
      }
      case 3: {
        _M0MPC15array5Array8sort__byGRP314vlmkit_2dsites4maps4main6ReviewE(rs, (a, b) => a.stars !== b.stars ? a.stars - b.stars | 0 : a.order - b.order | 0);
        break;
      }
    }
    return rs;
  }
  function _M0FP314vlmkit_2dsites4maps4main10sort__menu() {
    const items = [];
    const n = _M0FP314vlmkit_2dsites4maps4main11sort__names.length;
    const _bind = _M0FP314vlmkit_2dsites4maps4main11sort__names.length;
    let _tmp = 0;
    while (true) {
      const i = _tmp;
      if (i < _bind) {
        const name = _M0FP314vlmkit_2dsites4maps4main11sort__names[i];
        const _tmp$2 = new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("role", "none")]);
        const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(5);
        _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, "sort-");
        _M0MPB13StringBuilder13write__objectGiE(_string_builder, i);
        _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(items, _M0FP36mizchi4luna3dom2li(undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _tmp$2, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom6button(-1, _string_builder.val, _M0FP314vlmkit_2dsites4maps4main10sort__menuN6constrS3727, undefined, undefined, undefined, undefined, new _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4Some(_M0MP36mizchi4luna3dom10HandlerMap7keydown(_M0MP36mizchi4luna3dom10HandlerMap5click(_M0FP36mizchi4luna3dom6events(), (_e) => {
          _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4maps4main12review__sort, i);
          _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4maps4main10sort__open, false);
          _M0FP314vlmkit_2dsites4maps4main9focus__id("sort-btn");
        }), (e) => {
          const e$2 = e;
          const k = _M0FP314vlmkit_2dsites4maps4main7ev__str(e$2, "key");
          let next;
          switch (k) {
            case "ArrowDown": {
              next = (i + 1 | 0) % n | 0;
              break;
            }
            case "ArrowUp": {
              next = ((i + n | 0) - 1 | 0) % n | 0;
              break;
            }
            case "Home": {
              next = 0;
              break;
            }
            case "End": {
              next = n - 1 | 0;
              break;
            }
            default: {
              next = -1;
            }
          }
          if (next >= 0) {
            _M0FP314vlmkit_2dsites4maps4main11ev__prevent(e$2);
            const _string_builder$2 = _M0MPB13StringBuilder21StringBuilder_2einner(5);
            _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$2, "sort-");
            _M0MPB13StringBuilder13write__objectGiE(_string_builder$2, next);
            _M0FP314vlmkit_2dsites4maps4main9focus__id(_string_builder$2.val);
            return;
          } else {
            if (k === "Escape" || k === "Tab") {
              if (k === "Escape") {
                _M0FP314vlmkit_2dsites4maps4main11ev__prevent(e$2);
              }
              _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4maps4main10sort__open, false);
              _M0FP314vlmkit_2dsites4maps4main9focus__id("sort-btn");
              return;
            } else {
              return;
            }
          }
        })), undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("role", "menuitemradio"), _M0FP314vlmkit_2dsites4maps4main2sa("type", "button"), _M0FP314vlmkit_2dsites4maps4main2sa("tabindex", "-1")]), new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4Some([_M0FP314vlmkit_2dsites4maps4main2da("aria-checked", () => {
          const _p = _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4maps4main12review__sort) === i;
          return _p ? "true" : "false";
        })]), [_M0FP36mizchi4luna3dom4span(undefined, _M0FP314vlmkit_2dsites4maps4main10sort__menuN6constrS3728, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP314vlmkit_2dsites4maps4main12icon_2einner(_M0FP314vlmkit_2dsites4maps4main9ic__check, 16, "2")]), _M0FP36mizchi4luna3dom4text(name)])]));
        _tmp = i + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return _M0FP36mizchi4luna3dom3div(undefined, _M0FP314vlmkit_2dsites4maps4main10sort__menuN6constrS3729, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom6button(-1, _M0FP314vlmkit_2dsites4maps4main10sort__menuN6constrS3730, _M0FP314vlmkit_2dsites4maps4main10sort__menuN6constrS3731, undefined, undefined, undefined, undefined, new _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4Some(_M0MP36mizchi4luna3dom10HandlerMap7keydown(_M0MP36mizchi4luna3dom10HandlerMap5click(_M0FP36mizchi4luna3dom6events(), (_e) => {
      const o = !_M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4maps4main10sort__open);
      _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4maps4main10sort__open, o);
      if (o) {
        const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(5);
        _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, "sort-");
        _M0MPB13StringBuilder13write__objectGiE(_string_builder, _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4maps4main12review__sort));
        _M0FP314vlmkit_2dsites4maps4main12focus__later(_string_builder.val);
        return;
      } else {
        return;
      }
    }), (e) => {
      const e$2 = e;
      if (_M0FP314vlmkit_2dsites4maps4main7ev__str(e$2, "key") === "ArrowDown") {
        _M0FP314vlmkit_2dsites4maps4main11ev__prevent(e$2);
        _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4maps4main10sort__open, true);
        const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(5);
        _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, "sort-");
        _M0MPB13StringBuilder13write__objectGiE(_string_builder, _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4maps4main12review__sort));
        _M0FP314vlmkit_2dsites4maps4main12focus__later(_string_builder.val);
        return;
      } else {
        return;
      }
    })), undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("type", "button"), _M0FP314vlmkit_2dsites4maps4main2sa("aria-haspopup", "menu"), _M0FP314vlmkit_2dsites4maps4main2sa("aria-controls", "sort-menu")]), new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4Some([_M0FP314vlmkit_2dsites4maps4main2da("aria-expanded", () => {
      const _p = _M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4maps4main10sort__open);
      return _p ? "true" : "false";
    })]), [_M0FP314vlmkit_2dsites4maps4main12icon_2einner(_M0FP314vlmkit_2dsites4maps4main8ic__sort, 18, "2"), _M0FP36mizchi4luna3dom4span(undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4text("Sort: ")]), _M0FP36mizchi4luna3dom4span(undefined, _M0FP314vlmkit_2dsites4maps4main10sort__menuN6constrS3732, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom9text__dyn(() => _M0MPC15array5Array2atGUsiEE(_M0FP314vlmkit_2dsites4maps4main11sort__names, _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4maps4main12review__sort)))])]), _M0FP36mizchi4luna3dom2ul(_M0FP314vlmkit_2dsites4maps4main10sort__menuN6constrS3733, undefined, undefined, () => _M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4maps4main10sort__open) ? "menu" : "menu off", undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("role", "menu"), _M0FP314vlmkit_2dsites4maps4main2sa("aria-label", "Sort reviews")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, items)]);
  }
  function _M0FP314vlmkit_2dsites4maps4main20filled__icon_2einner(d, size) {
    return _M0FP36mizchi4luna3dom3svg(_M0MPC13int3Int18to__string_2einner(size, 10), _M0MPC13int3Int18to__string_2einner(size, 10), _M0FP314vlmkit_2dsites4maps4main20filled__icon_2einnerN6constrS3753, undefined, _M0FP314vlmkit_2dsites4maps4main20filled__icon_2einnerN6constrS3754, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("aria-hidden", "true"), _M0FP314vlmkit_2dsites4maps4main2sa("focusable", "false")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom9svg__path(d, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__)]);
  }
  function _M0FP314vlmkit_2dsites4maps4main12hours__label(day) {
    const _o = day._0;
    const _c = day._1;
    if (_o < 0) {
      return "Closed";
    } else {
      if (_o === 0 && _c === 1440) {
        return "Open 24 hours";
      } else {
        const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(3);
        _M0MPB13StringBuilder13write__objectGsE(_string_builder, _M0FP314vlmkit_2dsites4maps4main11time__label(_o));
        _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, "–");
        _M0MPB13StringBuilder13write__objectGsE(_string_builder, _M0FP314vlmkit_2dsites4maps4main11time__label(_c));
        return _string_builder.val;
      }
    }
  }
  function _M0FP314vlmkit_2dsites4maps4main10price__str(n) {
    let s = "";
    let _tmp = 0;
    while (true) {
      const i = _tmp;
      if (i < n) {
        s = `${s}$`;
        _tmp = i + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return s;
  }
  function _M0FP314vlmkit_2dsites4maps4main11place__view(id) {
    const p = _M0MPC15array5Array2atGUsiEE(_M0FP314vlmkit_2dsites4maps4main6places, id);
    const _bind = _M0FP314vlmkit_2dsites4maps4main12open__status(p);
    const _open = _bind._0;
    const _rest = _bind._1;
    const hours_rows = [];
    let _tmp = 0;
    while (true) {
      const d = _tmp;
      if (d < 7) {
        const today = d === 1;
        _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(hours_rows, _M0FP36mizchi4luna3dom15create__element("tr", today ? [_M0FP314vlmkit_2dsites4maps4main11place__viewN5tupleS3766] : [], [_M0FP36mizchi4luna3dom15create__element("th", [_M0FP314vlmkit_2dsites4maps4main11place__viewN5tupleS3768], [_M0FP36mizchi4luna3dom4text(_M0MPC15array5Array2atGUsiEE(_M0FP314vlmkit_2dsites4maps4main10day__names, d))]), _M0FP36mizchi4luna3dom15create__element("td", [], [_M0FP36mizchi4luna3dom4text(_M0FP314vlmkit_2dsites4maps4main12hours__label(_M0MPC15array5Array2atGUsiEE(_M0MPC15array5Array2atGORP26mizchi7signals10EffectNodeE(_M0FP314vlmkit_2dsites4maps4main12hours__table, p.hours), d)))])]));
        _tmp = d + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    const price = _M0FP314vlmkit_2dsites4maps4main10price__str(p.price);
    let cat_line;
    if (price === "") {
      cat_line = _M0MPC15array5Array2atGUsiEE(_M0FP314vlmkit_2dsites4maps4main13cat__singular, p.cat);
    } else {
      const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(4);
      _M0MPB13StringBuilder13write__objectGsE(_string_builder, _M0MPC15array5Array2atGUsiEE(_M0FP314vlmkit_2dsites4maps4main13cat__singular, p.cat));
      _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, " · ");
      _M0MPB13StringBuilder13write__objectGsE(_string_builder, price);
      cat_line = _string_builder.val;
    }
    const _p = _M0MPC15array5Array2atGORP26mizchi7signals10EffectNodeE(_M0FP314vlmkit_2dsites4maps4main9amenities, p.cat);
    const _p$2 = new Array(_p.length);
    const _p$3 = _p.length;
    let _tmp$2 = 0;
    while (true) {
      const _p$4 = _tmp$2;
      if (_p$4 < _p$3) {
        const _p$5 = _p[_p$4];
        _p$2[_p$4] = _M0FP36mizchi4luna3dom2li(undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP314vlmkit_2dsites4maps4main12icon_2einner(_M0FP314vlmkit_2dsites4maps4main9ic__check, 16, "2"), _M0FP36mizchi4luna3dom4text(_p$5)]);
        _tmp$2 = _p$4 + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    const amen = _p$2;
    const _tmp$3 = new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("aria-labelledby", "place-h")]);
    const _tmp$4 = _M0FP36mizchi4luna3dom3div(undefined, _M0FP314vlmkit_2dsites4maps4main11place__viewN6constrS3770, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP314vlmkit_2dsites4maps4main10place__art(p, 420, 180, true), _M0FP36mizchi4luna3dom6button(-1, undefined, _M0FP314vlmkit_2dsites4maps4main11place__viewN6constrS3771, undefined, undefined, undefined, undefined, new _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4Some(_M0MP36mizchi4luna3dom10HandlerMap5click(_M0FP36mizchi4luna3dom6events(), (_e) => {
      _M0FP314vlmkit_2dsites4maps4main17back__from__place();
    })), undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("type", "button"), _M0FP314vlmkit_2dsites4maps4main2sa("aria-label", "Back")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP314vlmkit_2dsites4maps4main12icon_2einner(_M0FP314vlmkit_2dsites4maps4main8ic__back, 20, "2")])]);
    const _tmp$5 = _M0FP36mizchi4luna3dom2h2(_M0FP314vlmkit_2dsites4maps4main11place__viewN6constrS3773, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("tabindex", "-1")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4text(p.name)]);
    const _tmp$6 = _M0FP36mizchi4luna3dom4text(`${_M0FP314vlmkit_2dsites4maps4main11rating__str(p.rating)} `);
    const _tmp$7 = _M0FP314vlmkit_2dsites4maps4main5stars(p.rating);
    const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(3);
    _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, " (");
    _M0MPB13StringBuilder13write__objectGiE(_string_builder, p.reviews);
    _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, ")");
    const _tmp$8 = _M0FP36mizchi4luna3dom3div(undefined, _M0FP314vlmkit_2dsites4maps4main11place__viewN6constrS3772, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_tmp$5, _M0FP36mizchi4luna3dom1p(undefined, _M0FP314vlmkit_2dsites4maps4main11place__viewN6constrS3774, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_tmp$6, _tmp$7, _M0FP36mizchi4luna3dom4span(undefined, _M0FP314vlmkit_2dsites4maps4main11place__viewN6constrS3775, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4text(_string_builder.val)])]), _M0FP36mizchi4luna3dom1p(undefined, _M0FP314vlmkit_2dsites4maps4main11place__viewN6constrS3776, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4text(cat_line)])]);
    const _tmp$9 = _M0FP36mizchi4luna3dom3div(undefined, _M0FP314vlmkit_2dsites4maps4main11place__viewN6constrS3777, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP314vlmkit_2dsites4maps4main13round__action("Directions", _M0FP314vlmkit_2dsites4maps4main16directions__icon(22), undefined, () => {
      _M0FP314vlmkit_2dsites4maps4main16open__directions(id);
    }), _M0FP314vlmkit_2dsites4maps4main13round__action("Save", _M0FP314vlmkit_2dsites4maps4main20filled__icon_2einner(_M0FP314vlmkit_2dsites4maps4main12ic__bookmark, 20), () => {
      const _p$4 = _M0FP314vlmkit_2dsites4maps4main9is__saved(id);
      return _p$4 ? "true" : "false";
    }, () => {
      _M0FP314vlmkit_2dsites4maps4main13toggle__saved(id);
      let _tmp$10;
      if (_M0FP314vlmkit_2dsites4maps4main9is__saved(id)) {
        const _string_builder$2 = _M0MPB13StringBuilder21StringBuilder_2einner(6);
        _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$2, "Saved ");
        _M0MPB13StringBuilder13write__objectGsE(_string_builder$2, p.name);
        _tmp$10 = _string_builder$2.val;
      } else {
        const _string_builder$2 = _M0MPB13StringBuilder21StringBuilder_2einner(19);
        _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$2, "Removed ");
        _M0MPB13StringBuilder13write__objectGsE(_string_builder$2, p.name);
        _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$2, " from Saved");
        _tmp$10 = _string_builder$2.val;
      }
      _M0MP26mizchi7signals6Signal3setGRP314vlmkit_2dsites4maps4main4ViewE(_M0FP314vlmkit_2dsites4maps4main5toast, _tmp$10);
    }), _M0FP314vlmkit_2dsites4maps4main13round__action("Nearby", _M0FP314vlmkit_2dsites4maps4main12icon_2einner(_M0FP314vlmkit_2dsites4maps4main10ic__nearby, 20, "2"), undefined, () => {
      _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4maps4main4chip, p.cat);
      const _tmp$10 = p.cat;
      const _tmp$11 = p.x;
      const _tmp$12 = p.y;
      const _string_builder$2 = _M0MPB13StringBuilder21StringBuilder_2einner(6);
      _M0MPB13StringBuilder13write__objectGsE(_string_builder$2, _M0MPC15array5Array2atGUsiEE(_M0FP314vlmkit_2dsites4maps4main10cat__names, p.cat));
      _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$2, " near ");
      _M0MPB13StringBuilder13write__objectGsE(_string_builder$2, p.name);
      _M0FP314vlmkit_2dsites4maps4main13show__results(new _M0TP314vlmkit_2dsites4maps4main5Query(_tmp$10, "", true, _tmp$11, _tmp$12, _string_builder$2.val));
    }), _M0FP314vlmkit_2dsites4maps4main13round__action("Share", _M0FP314vlmkit_2dsites4maps4main12icon_2einner(_M0FP314vlmkit_2dsites4maps4main9ic__share, 20, "2"), undefined, () => {
      const _string_builder$2 = _M0MPB13StringBuilder21StringBuilder_2einner(36);
      _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$2, "https://maps.wayfarer.example/place/");
      _M0MPB13StringBuilder13write__objectGiE(_string_builder$2, p.id);
      _M0FP314vlmkit_2dsites4maps4main11open__share(_string_builder$2.val);
    }), _M0FP314vlmkit_2dsites4maps4main13round__action("Send to phone", _M0FP314vlmkit_2dsites4maps4main12icon_2einner(_M0FP314vlmkit_2dsites4maps4main9ic__phone, 20, "2"), undefined, () => {
      const _string_builder$2 = _M0MPB13StringBuilder21StringBuilder_2einner(19);
      _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$2, "Sent ");
      _M0MPB13StringBuilder13write__objectGsE(_string_builder$2, p.name);
      _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$2, " to your phone");
      _M0MP26mizchi7signals6Signal3setGRP314vlmkit_2dsites4maps4main4ViewE(_M0FP314vlmkit_2dsites4maps4main5toast, _string_builder$2.val);
    })]);
    const _tmp$10 = _M0FP314vlmkit_2dsites4maps4main7tablist("About this place", "pt", ["Overview", "Reviews", "About"], [], _M0FP314vlmkit_2dsites4maps4main10place__tab);
    const _tmp$11 = _M0FP36mizchi4luna3dom2li(undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP314vlmkit_2dsites4maps4main12icon_2einner(_M0FP314vlmkit_2dsites4maps4main7ic__pin, 20, "2"), _M0FP36mizchi4luna3dom4text(`${_M0FP314vlmkit_2dsites4maps4main14place__address(p)}, ${_M0FP314vlmkit_2dsites4maps4main11place__area(p)}, Port Lumen`)]);
    const _tmp$12 = _M0FP314vlmkit_2dsites4maps4main12icon_2einner(_M0FP314vlmkit_2dsites4maps4main9ic__clock, 20, "2");
    const _tmp$13 = _M0FP36mizchi4luna3dom4span(undefined, _open ? "st-open" : "st-closed", undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4text(_open ? "Open" : "Closed")]);
    const _string_builder$2 = _M0MPB13StringBuilder21StringBuilder_2einner(4);
    _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$2, " · ");
    _M0MPB13StringBuilder13write__objectGsE(_string_builder$2, _rest);
    const _tmp$14 = _M0FP36mizchi4luna3dom2li(undefined, _M0FP314vlmkit_2dsites4maps4main11place__viewN6constrS3779, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_tmp$12, _M0FP36mizchi4luna3dom3div(undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom1p(undefined, _M0FP314vlmkit_2dsites4maps4main11place__viewN6constrS3780, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_tmp$13, _M0FP36mizchi4luna3dom4text(_string_builder$2.val)]), _M0FP36mizchi4luna3dom15create__element("table", [_M0FP314vlmkit_2dsites4maps4main11place__viewN5tupleS3782], [_M0FP36mizchi4luna3dom15create__element("caption", [_M0FP314vlmkit_2dsites4maps4main11place__viewN5tupleS3784], [_M0FP36mizchi4luna3dom4text("Opening hours")]), _M0FP36mizchi4luna3dom15create__element("tbody", [], hours_rows)])])]);
    const _tmp$15 = _M0FP314vlmkit_2dsites4maps4main12icon_2einner(_M0FP314vlmkit_2dsites4maps4main9ic__globe, 20, "2");
    const _string_builder$3 = _M0MPB13StringBuilder21StringBuilder_2einner(9);
    _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$3, "https://");
    _M0MPB13StringBuilder13write__objectGsE(_string_builder$3, p.site);
    _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$3, "/");
    const _tmp$16 = _M0FP314vlmkit_2dsites4maps4main8tabpanel("pt", 0, _M0FP314vlmkit_2dsites4maps4main10place__tab, [_M0FP36mizchi4luna3dom2ul(undefined, _M0FP314vlmkit_2dsites4maps4main11place__viewN6constrS3778, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_tmp$11, _tmp$14, _M0FP36mizchi4luna3dom2li(undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_tmp$15, _M0FP36mizchi4luna3dom1a(_string_builder$3.val, undefined, undefined, _M0FP314vlmkit_2dsites4maps4main11place__viewN6constrS3785, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4text(p.site)])])])]);
    const _tmp$17 = _M0FP36mizchi4luna3dom4span(undefined, _M0FP314vlmkit_2dsites4maps4main11place__viewN6constrS3788, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4text(_M0FP314vlmkit_2dsites4maps4main11rating__str(p.rating))]);
    const _tmp$18 = _M0FP314vlmkit_2dsites4maps4main5stars(p.rating);
    const _string_builder$4 = _M0MPB13StringBuilder21StringBuilder_2einner(8);
    _M0MPB13StringBuilder13write__objectGiE(_string_builder$4, p.reviews);
    _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$4, " reviews");
    return _M0FP36mizchi4luna3dom7article(undefined, _M0FP314vlmkit_2dsites4maps4main11place__viewN6constrS3769, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _tmp$3, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_tmp$4, _tmp$8, _tmp$9, _tmp$10, _tmp$16, _M0FP314vlmkit_2dsites4maps4main8tabpanel("pt", 1, _M0FP314vlmkit_2dsites4maps4main10place__tab, [_M0FP36mizchi4luna3dom3div(undefined, _M0FP314vlmkit_2dsites4maps4main11place__viewN6constrS3786, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom1p(undefined, _M0FP314vlmkit_2dsites4maps4main11place__viewN6constrS3787, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_tmp$17, _tmp$18, _M0FP36mizchi4luna3dom4span(undefined, _M0FP314vlmkit_2dsites4maps4main11place__viewN6constrS3789, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4text(_string_builder$4.val)])]), _M0FP314vlmkit_2dsites4maps4main10sort__menu()]), _M0FP36mizchi4luna3dom2ul(undefined, _M0FP314vlmkit_2dsites4maps4main11place__viewN6constrS3790, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom9for__eachGiE(() => [_M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4maps4main12review__sort)], (how, _i) => {
      const _p$4 = _M0FP314vlmkit_2dsites4maps4main15sorted__reviews(p, how);
      const _p$5 = new Array(_p$4.length);
      const _p$6 = _p$4.length;
      let _tmp$19 = 0;
      while (true) {
        const _p$7 = _tmp$19;
        if (_p$7 < _p$6) {
          const _p$8 = _p$4[_p$7];
          const _tmp$20 = _M0FP36mizchi4luna3dom4span(undefined, _M0FP314vlmkit_2dsites4maps4main11place__viewN6constrS3792, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("aria-hidden", "true")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4text(_M0MPC16string6String17substring_2einner(_p$8.author, 0, _M0FP314vlmkit_2dsites4maps4main11place__viewN6constrS3793))]);
          const _tmp$21 = _M0FP36mizchi4luna3dom1p(undefined, _M0FP314vlmkit_2dsites4maps4main11place__viewN6constrS3794, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4text(_p$8.author)]);
          const _p$9 = _M0MPB13StringBuilder21StringBuilder_2einner(17);
          _M0MPB13StringBuilder13write__objectGiE(_p$9, _p$8.stars);
          _M0IPB13StringBuilderPB6Logger13write__string(_p$9, " out of 5 stars, ");
          _p$5[_p$7] = _M0FP36mizchi4luna3dom2li(undefined, _M0FP314vlmkit_2dsites4maps4main11place__viewN6constrS3791, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_tmp$20, _M0FP36mizchi4luna3dom3div(undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_tmp$21, _M0FP36mizchi4luna3dom1p(undefined, _M0FP314vlmkit_2dsites4maps4main11place__viewN6constrS3795, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4span(undefined, _M0FP314vlmkit_2dsites4maps4main11place__viewN6constrS3796, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4text(_p$9.val)]), _M0FP314vlmkit_2dsites4maps4main5stars(Math.imul(_p$8.stars, 10) | 0), _M0FP36mizchi4luna3dom4text(` ${_p$8.date}`)]), _M0FP36mizchi4luna3dom1p(undefined, _M0FP314vlmkit_2dsites4maps4main11place__viewN6constrS3797, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4text(_p$8.text)])])]);
          _tmp$19 = _p$7 + 1 | 0;
          continue;
        } else {
          break;
        }
      }
      return _M0FP36mizchi4luna3dom8fragment(_p$5);
    })])]), _M0FP314vlmkit_2dsites4maps4main8tabpanel("pt", 2, _M0FP314vlmkit_2dsites4maps4main10place__tab, [_M0FP36mizchi4luna3dom1p(undefined, _M0FP314vlmkit_2dsites4maps4main11place__viewN6constrS3798, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4text(p.blurb)]), _M0FP36mizchi4luna3dom2h3(undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4text("Amenities")]), _M0FP36mizchi4luna3dom2ul(undefined, _M0FP314vlmkit_2dsites4maps4main11place__viewN6constrS3799, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, amen)])]);
  }
  function _M0FP314vlmkit_2dsites4maps4main12place__fieldN6chooseS3828(_env, id) {
    const sig = _env._5;
    const holder = _env._4;
    const open = _env._3;
    const active = _env._2;
    const text = _env._1;
    const key = _env._0;
    _M0MP26mizchi7signals6Signal3setGiE(sig, id);
    _M0MP26mizchi7signals6Signal3setGRP314vlmkit_2dsites4maps4main4ViewE(text, _M0MPC15array5Array2atGUsiEE(_M0FP314vlmkit_2dsites4maps4main6places, id).name);
    const _bind = holder.val;
    if (_bind.$tag === 1) {
      const _Some = _bind;
      const _el = _Some._0;
      _M0FP314vlmkit_2dsites4maps4main10set__value(_el, _M0MPC15array5Array2atGUsiEE(_M0FP314vlmkit_2dsites4maps4main6places, id).name);
    }
    _M0MP26mizchi7signals6Signal3setGbE(open, false);
    _M0MP26mizchi7signals6Signal3setGiE(active, -1);
    const p = _M0MPC15array5Array2atGUsiEE(_M0FP314vlmkit_2dsites4maps4main6places, id);
    const other = key === "from" ? _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4maps4main7dir__to) : _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4maps4main9dir__from);
    if (other >= 0) {
      const q = _M0MPC15array5Array2atGUsiEE(_M0FP314vlmkit_2dsites4maps4main6places, other);
      const mx = (p.x + q.x) / 2;
      const my = (p.y + q.y) / 2;
      const span = _M0FP314vlmkit_2dsites4maps4main11world__dist(p.x, p.y, q.x, q.y);
      const z = span > 1800 ? 2 : span > 900 ? 2.5 : 3;
      _M0FP314vlmkit_2dsites4maps4main15ease__to__point(mx, my, z);
      return;
    } else {
      return;
    }
  }
  function _M0FP314vlmkit_2dsites4maps4main12place__field(label, key, sig, holder) {
    const text = _M0FP26mizchi7signals6signalGRP314vlmkit_2dsites4maps4main4ViewE("");
    const open = _M0FP26mizchi7signals6signalGbE(false);
    const active = _M0FP26mizchi7signals6signalGiE(-1);
    const opts = _M0FP26mizchi7signals4memoGORP314vlmkit_2dsites4maps4main5RouteE(() => {
      const t = _M0MPC16string6String9to__lower(_M0MPC16string10StringView9to__owned(_M0MPC16string6String4trim(_M0MP26mizchi7signals6Signal3getGRP314vlmkit_2dsites4maps4main4ViewE(text), undefined)));
      const out = [];
      const _bind = _M0FP314vlmkit_2dsites4maps4main6places.length;
      let _tmp = 0;
      while (true) {
        const _ = _tmp;
        if (_ < _bind) {
          const p = _M0FP314vlmkit_2dsites4maps4main6places[_];
          if (out.length < 6 && (t === "" || _M0MPC16string6String8contains(_M0MPC16string6String9to__lower(p.name), new _M0TPC16string10StringView(t, 0, t.length)))) {
            _M0MPC15array5Array4pushGiE(out, p.id);
          }
          _tmp = _ + 1 | 0;
          continue;
        } else {
          break;
        }
      }
      return out;
    });
    const _env = { _0: key, _1: text, _2: active, _3: open, _4: holder, _5: sig };
    const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(4);
    _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, "dir-");
    _M0MPB13StringBuilder13write__objectGsE(_string_builder, key);
    const _tmp = _M0FP36mizchi4luna3dom5label(_string_builder.val, undefined, _M0FP314vlmkit_2dsites4maps4main12place__fieldN6constrS3830, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4text(label)]);
    const _tmp$2 = key === "from" ? "Choose starting point" : "Choose destination";
    const _string_builder$2 = _M0MPB13StringBuilder21StringBuilder_2einner(4);
    _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$2, "dir-");
    _M0MPB13StringBuilder13write__objectGsE(_string_builder$2, key);
    const _tmp$3 = _string_builder$2.val;
    const _tmp$4 = new _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4Some(_M0MP36mizchi4luna3dom10HandlerMap7keydown(_M0MP36mizchi4luna3dom10HandlerMap4blur(_M0MP36mizchi4luna3dom10HandlerMap5focus(_M0MP36mizchi4luna3dom10HandlerMap5input(_M0FP36mizchi4luna3dom6events(), (e) => {
      const t = _M0MP26mizchi8js__core3Any5__get(e, "target");
      _M0MP26mizchi7signals6Signal3setGRP314vlmkit_2dsites4maps4main4ViewE(text, _M0MP26mizchi8js__core3Any5__get(t, "value"));
      _M0MP26mizchi7signals6Signal3setGbE(open, true);
      _M0MP26mizchi7signals6Signal3setGiE(active, -1);
    }), (_e) => {
      _M0MP26mizchi7signals6Signal3setGbE(open, true);
    }), (_e) => {
      _M0MP26mizchi7signals6Signal3setGbE(open, false);
    }), (e) => {
      const e$2 = e;
      const k = _M0FP314vlmkit_2dsites4maps4main7ev__str(e$2, "key");
      const n = opts().length;
      switch (k) {
        case "ArrowDown": {
          _M0FP314vlmkit_2dsites4maps4main11ev__prevent(e$2);
          _M0MP26mizchi7signals6Signal3setGbE(open, true);
          _M0MP26mizchi7signals6Signal3setGiE(active, n === 0 ? -1 : (_M0MP26mizchi7signals6Signal3getGiE(active) + 1 | 0) % n | 0);
          return;
        }
        case "ArrowUp": {
          _M0FP314vlmkit_2dsites4maps4main11ev__prevent(e$2);
          _M0MP26mizchi7signals6Signal3setGbE(open, true);
          const a = _M0MP26mizchi7signals6Signal3getGiE(active);
          _M0MP26mizchi7signals6Signal3setGiE(active, n === 0 ? -1 : a <= 0 ? n - 1 | 0 : a - 1 | 0);
          return;
        }
        case "Enter": {
          _M0FP314vlmkit_2dsites4maps4main11ev__prevent(e$2);
          const a$2 = _M0MP26mizchi7signals6Signal3getGiE(active);
          if (a$2 >= 0 && a$2 < n) {
            _M0FP314vlmkit_2dsites4maps4main12place__fieldN6chooseS3828(_env, _M0MPC15array5Array2atGiE(opts(), a$2));
            return;
          } else {
            if (n > 0) {
              _M0FP314vlmkit_2dsites4maps4main12place__fieldN6chooseS3828(_env, _M0MPC15array5Array2atGiE(opts(), 0));
              return;
            } else {
              return;
            }
          }
        }
        case "Escape": {
          _M0MP26mizchi7signals6Signal3setGbE(open, false);
          return;
        }
        default: {
          return;
        }
      }
    }));
    const _tmp$5 = _M0FP314vlmkit_2dsites4maps4main2sa("role", "combobox");
    const _tmp$6 = _M0FP314vlmkit_2dsites4maps4main2sa("aria-autocomplete", "list");
    const _string_builder$3 = _M0MPB13StringBuilder21StringBuilder_2einner(9);
    _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$3, "dir-");
    _M0MPB13StringBuilder13write__objectGsE(_string_builder$3, key);
    _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$3, "-list");
    const _tmp$7 = _M0FP36mizchi4luna3dom5input(_M0FP314vlmkit_2dsites4maps4main12place__fieldN6constrS3831, undefined, undefined, _tmp$2, -1, -1, -1, -1, _tmp$3, undefined, undefined, undefined, undefined, undefined, undefined, undefined, _tmp$4, (el) => {
      const a = el;
      holder.val = new _M0DTPC16option6OptionGRP26mizchi8js__core3AnyE4Some(a);
      const s = _M0MP26mizchi7signals6Signal3getGiE(sig);
      if (s >= 0) {
        _M0FP314vlmkit_2dsites4maps4main10set__value(a, _M0MPC15array5Array2atGUsiEE(_M0FP314vlmkit_2dsites4maps4main6places, s).name);
        _M0MP26mizchi7signals6Signal3setGRP314vlmkit_2dsites4maps4main4ViewE(text, _M0MPC15array5Array2atGUsiEE(_M0FP314vlmkit_2dsites4maps4main6places, s).name);
        return;
      } else {
        return;
      }
    }, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_tmp$5, _tmp$6, _M0FP314vlmkit_2dsites4maps4main2sa("aria-controls", _string_builder$3.val), _M0FP314vlmkit_2dsites4maps4main2sa("autocomplete", "off")]), new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4Some([_M0FP314vlmkit_2dsites4maps4main2da("aria-expanded", () => {
      const _p = _M0MP26mizchi7signals6Signal3getGbE(open);
      return _p ? "true" : "false";
    }), _M0FP314vlmkit_2dsites4maps4main2da("aria-activedescendant", () => {
      if (_M0MP26mizchi7signals6Signal3getGbE(open) && _M0MP26mizchi7signals6Signal3getGiE(active) >= 0) {
        const _string_builder$4 = _M0MPB13StringBuilder21StringBuilder_2einner(9);
        _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$4, "dir-");
        _M0MPB13StringBuilder13write__objectGsE(_string_builder$4, key);
        _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$4, "-opt-");
        _M0MPB13StringBuilder13write__objectGiE(_string_builder$4, _M0MP26mizchi7signals6Signal3getGiE(active));
        return _string_builder$4.val;
      } else {
        return "";
      }
    })]));
    const _string_builder$4 = _M0MPB13StringBuilder21StringBuilder_2einner(9);
    _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$4, "dir-");
    _M0MPB13StringBuilder13write__objectGsE(_string_builder$4, key);
    _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$4, "-list");
    const _tmp$8 = _string_builder$4.val;
    const _tmp$9 = _M0FP314vlmkit_2dsites4maps4main2sa("role", "listbox");
    const _string_builder$5 = _M0MPB13StringBuilder21StringBuilder_2einner(12);
    _M0MPB13StringBuilder13write__objectGsE(_string_builder$5, label);
    _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$5, " suggestions");
    return _M0FP36mizchi4luna3dom3div(undefined, _M0FP314vlmkit_2dsites4maps4main12place__fieldN6constrS3829, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_tmp, _tmp$7, _M0FP36mizchi4luna3dom2ul(_tmp$8, undefined, undefined, () => _M0MP26mizchi7signals6Signal3getGbE(open) ? "field-list" : "field-list off", undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_tmp$9, _M0FP314vlmkit_2dsites4maps4main2sa("aria-label", _string_builder$5.val)]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom11index__eachGiE(() => opts(), (item, i) => {
      const _string_builder$6 = _M0MPB13StringBuilder21StringBuilder_2einner(9);
      _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$6, "dir-");
      _M0MPB13StringBuilder13write__objectGsE(_string_builder$6, key);
      _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$6, "-opt-");
      _M0MPB13StringBuilder13write__objectGiE(_string_builder$6, i);
      return _M0FP36mizchi4luna3dom2li(_string_builder$6.val, undefined, undefined, () => _M0MP26mizchi7signals6Signal3getGiE(active) === i ? "opt active" : "opt", undefined, new _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4Some(_M0MP36mizchi4luna3dom10HandlerMap5click(_M0MP36mizchi4luna3dom10HandlerMap9mousedown(_M0FP36mizchi4luna3dom6events(), (e) => {
        _M0FP314vlmkit_2dsites4maps4main11ev__prevent(e);
      }), (_e) => {
        _M0FP314vlmkit_2dsites4maps4main12place__fieldN6chooseS3828(_env, item());
      })), undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("role", "option")]), new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4Some([_M0FP314vlmkit_2dsites4maps4main2da("aria-selected", () => {
        const _p = _M0MP26mizchi7signals6Signal3getGiE(active) === i;
        return _p ? "true" : "false";
      })]), [_M0FP36mizchi4luna3dom4span(undefined, _M0FP314vlmkit_2dsites4maps4main12place__fieldN6constrS3832, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom9text__dyn(() => _M0MPC15array5Array2atGUsiEE(_M0FP314vlmkit_2dsites4maps4main6places, item()).name)]), _M0FP36mizchi4luna3dom4span(undefined, _M0FP314vlmkit_2dsites4maps4main12place__fieldN6constrS3833, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom9text__dyn(() => _M0FP314vlmkit_2dsites4maps4main11place__area(_M0MPC15array5Array2atGUsiEE(_M0FP314vlmkit_2dsites4maps4main6places, item())))])]);
    })])]);
  }
  function _M0FP314vlmkit_2dsites4maps4main16directions__view() {
    const _p = [0, 1, 2, 3];
    const _p$2 = new Array(_p.length);
    const _p$3 = _p.length;
    let _tmp = 0;
    while (true) {
      const _p$4 = _tmp;
      if (_p$4 < _p$3) {
        const _p$5 = _p[_p$4];
        _p$2[_p$4] = () => {
          const _p$6 = _M0FP314vlmkit_2dsites4maps4main5route();
          if (_p$6 === undefined) {
            return "–";
          } else {
            const _p$7 = _p$6;
            const _p$8 = _p$7;
            const _p$9 = _M0MPB13StringBuilder21StringBuilder_2einner(4);
            _M0MPB13StringBuilder13write__objectGiE(_p$9, _M0FP314vlmkit_2dsites4maps4main13mode__minutes(_p$5, _p$8.length));
            _M0IPB13StringBuilderPB6Logger13write__string(_p$9, " min");
            return _p$9.val;
          }
        };
        _tmp = _p$4 + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    const subs = _p$2;
    return _M0FP36mizchi4luna3dom7section(undefined, _M0FP314vlmkit_2dsites4maps4main16directions__viewN6constrS3891, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("aria-labelledby", "dir-h")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom3div(undefined, _M0FP314vlmkit_2dsites4maps4main16directions__viewN6constrS3892, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom2h2(_M0FP314vlmkit_2dsites4maps4main16directions__viewN6constrS3893, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4text("Directions")]), _M0FP36mizchi4luna3dom6button(-1, undefined, _M0FP314vlmkit_2dsites4maps4main16directions__viewN6constrS3894, undefined, undefined, undefined, undefined, new _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4Some(_M0MP36mizchi4luna3dom10HandlerMap5click(_M0FP36mizchi4luna3dom6events(), (_e) => {
      if (_M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4maps4main8selected) >= 0) {
        _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4maps4main5panel, 2);
        return;
      } else {
        if (_M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4maps4main12has__results)) {
          _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4maps4main5panel, 1);
          return;
        } else {
          _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4maps4main5panel, 0);
          return;
        }
      }
    })), undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("type", "button"), _M0FP314vlmkit_2dsites4maps4main2sa("aria-label", "Close directions")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP314vlmkit_2dsites4maps4main12icon_2einner(_M0FP314vlmkit_2dsites4maps4main9ic__close, 20, "2")])]), _M0FP314vlmkit_2dsites4maps4main7tablist("Travel mode", "mode", _M0FP314vlmkit_2dsites4maps4main11mode__names, subs, _M0FP314vlmkit_2dsites4maps4main9dir__mode), _M0FP36mizchi4luna3dom3div(undefined, _M0FP314vlmkit_2dsites4maps4main16directions__viewN6constrS3895, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom3div(undefined, _M0FP314vlmkit_2dsites4maps4main16directions__viewN6constrS3896, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP314vlmkit_2dsites4maps4main12place__field("From", "from", _M0FP314vlmkit_2dsites4maps4main9dir__from, _M0FP314vlmkit_2dsites4maps4main8from__el), _M0FP314vlmkit_2dsites4maps4main12place__field("To", "to", _M0FP314vlmkit_2dsites4maps4main7dir__to, _M0FP314vlmkit_2dsites4maps4main6to__el)]), _M0FP36mizchi4luna3dom6button(-1, undefined, _M0FP314vlmkit_2dsites4maps4main16directions__viewN6constrS3897, undefined, undefined, undefined, undefined, new _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4Some(_M0MP36mizchi4luna3dom10HandlerMap5click(_M0FP36mizchi4luna3dom6events(), (_e) => {
      const a = _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4maps4main9dir__from);
      const b = _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4maps4main7dir__to);
      _M0FP26mizchi7signals5batchGuE(() => {
        _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4maps4main9dir__from, b);
        _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4maps4main7dir__to, a);
      });
      const _bind = _M0FP314vlmkit_2dsites4maps4main8from__el.val;
      if (_bind.$tag === 1) {
        const _Some = _bind;
        const _el = _Some._0;
        _M0FP314vlmkit_2dsites4maps4main10set__value(_el, b >= 0 ? _M0MPC15array5Array2atGUsiEE(_M0FP314vlmkit_2dsites4maps4main6places, b).name : "");
      }
      const _bind$2 = _M0FP314vlmkit_2dsites4maps4main6to__el.val;
      if (_bind$2.$tag === 1) {
        const _Some = _bind$2;
        const _el = _Some._0;
        _M0FP314vlmkit_2dsites4maps4main10set__value(_el, a >= 0 ? _M0MPC15array5Array2atGUsiEE(_M0FP314vlmkit_2dsites4maps4main6places, a).name : "");
        return;
      } else {
        return;
      }
    })), undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("type", "button"), _M0FP314vlmkit_2dsites4maps4main2sa("aria-label", "Swap start and destination")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP314vlmkit_2dsites4maps4main12icon_2einner(_M0FP314vlmkit_2dsites4maps4main8ic__swap, 20, "2")])]), _M0FP36mizchi4luna3dom3div(_M0FP314vlmkit_2dsites4maps4main16directions__viewN6constrS3898, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("role", "tabpanel")]), new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4Some([_M0FP314vlmkit_2dsites4maps4main2da("aria-labelledby", () => {
      const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(9);
      _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, "mode-tab-");
      _M0MPB13StringBuilder13write__objectGiE(_string_builder, _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4maps4main9dir__mode));
      return _string_builder.val;
    })]), [_M0FP36mizchi4luna3dom4show(() => {
      const _bind = _M0FP314vlmkit_2dsites4maps4main5route();
      return _bind === undefined;
    }, () => {
      const _tmp$2 = _M0FP36mizchi4luna3dom1p(undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4text("Choose a start and a destination to see the route.")]);
      const _tmp$3 = _M0FP36mizchi4luna3dom1p(undefined, _M0FP314vlmkit_2dsites4maps4main16directions__viewN6constrS3900, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4text("Try one of these:")]);
      const _self = [];
      const _p$4 = new Array(_M0FP314vlmkit_2dsites4maps4main6routes.length);
      const _p$5 = _M0FP314vlmkit_2dsites4maps4main6routes.length;
      let _tmp$4 = 0;
      while (true) {
        const _p$6 = _tmp$4;
        if (_p$6 < _p$5) {
          const _p$7 = _M0FP314vlmkit_2dsites4maps4main6routes[_p$6];
          const _p$8 = _p$7._0;
          const _p$9 = _p$7._1;
          const _tmp$5 = new _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4Some(_M0MP36mizchi4luna3dom10HandlerMap5click(_M0FP36mizchi4luna3dom6events(), (_p$10) => {
            _M0FP26mizchi7signals5batchGuE(() => {
              _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4maps4main9dir__from, _p$8);
              _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4maps4main7dir__to, _p$9);
            });
            const _p$11 = _M0FP314vlmkit_2dsites4maps4main8from__el.val;
            if (_p$11.$tag === 1) {
              const _p$12 = _p$11;
              const _p$13 = _p$12._0;
              _M0FP314vlmkit_2dsites4maps4main10set__value(_p$13, _M0MPC15array5Array2atGUsiEE(_M0FP314vlmkit_2dsites4maps4main6places, _p$8).name);
            }
            const _p$12 = _M0FP314vlmkit_2dsites4maps4main6to__el.val;
            if (_p$12.$tag === 1) {
              const _p$13 = _p$12;
              const _p$14 = _p$13._0;
              _M0FP314vlmkit_2dsites4maps4main10set__value(_p$14, _M0MPC15array5Array2atGUsiEE(_M0FP314vlmkit_2dsites4maps4main6places, _p$9).name);
            }
            const _p$13 = _M0MPC15array5Array2atGUsiEE(_M0FP314vlmkit_2dsites4maps4main6places, _p$8);
            const _p$14 = _M0MPC15array5Array2atGUsiEE(_M0FP314vlmkit_2dsites4maps4main6places, _p$9);
            _M0FP314vlmkit_2dsites4maps4main15ease__to__point((_p$13.x + _p$14.x) / 2, (_p$13.y + _p$14.y) / 2, 2.5);
          }));
          const _tmp$6 = new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("type", "button")]);
          const _p$10 = _M0MPB13StringBuilder21StringBuilder_2einner(4);
          _M0MPB13StringBuilder13write__objectGsE(_p$10, _M0MPC15array5Array2atGUsiEE(_M0FP314vlmkit_2dsites4maps4main6places, _p$8).name);
          _M0IPB13StringBuilderPB6Logger13write__string(_p$10, " to ");
          _M0MPB13StringBuilder13write__objectGsE(_p$10, _M0MPC15array5Array2atGUsiEE(_M0FP314vlmkit_2dsites4maps4main6places, _p$9).name);
          _p$4[_p$6] = _M0FP36mizchi4luna3dom2li(undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom6button(-1, undefined, _M0FP314vlmkit_2dsites4maps4main16directions__viewN6constrS3902, undefined, undefined, undefined, undefined, _tmp$5, undefined, _tmp$6, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4text(_p$10.val)])]);
          _tmp$4 = _p$6 + 1 | 0;
          continue;
        } else {
          break;
        }
      }
      _M0MPC15array5Array10push__iterGUsRP36mizchi4luna3dom4AttrEE(_self, _M0MPC15array5Array4iterGUsRP36mizchi4luna3dom4AttrEE(_p$4));
      return _M0FP36mizchi4luna3dom3div(undefined, _M0FP314vlmkit_2dsites4maps4main16directions__viewN6constrS3899, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_tmp$2, _tmp$3, _M0FP36mizchi4luna3dom2ul(undefined, _M0FP314vlmkit_2dsites4maps4main16directions__viewN6constrS3901, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, _self)]);
    }), _M0FP36mizchi4luna3dom9for__eachGiE(() => {
      const _bind = _M0FP314vlmkit_2dsites4maps4main5route();
      return _bind === undefined ? [] : [(Math.imul(_M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4maps4main9dir__from), 100) | 0) + _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4maps4main7dir__to) | 0];
    }, (_k, _i) => {
      const _bind = _M0FP314vlmkit_2dsites4maps4main5route();
      if (_bind === undefined) {
        return _M0FP36mizchi4luna3dom8fragment([]);
      } else {
        const _Some = _bind;
        const _r = _Some;
        const _tmp$2 = _M0FP36mizchi4luna3dom6strong(undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom9text__dyn(() => {
          const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(4);
          _M0MPB13StringBuilder13write__objectGiE(_string_builder, _M0FP314vlmkit_2dsites4maps4main13mode__minutes(_M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4maps4main9dir__mode), _r.length));
          _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, " min");
          return _string_builder.val;
        })]);
        const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(3);
        _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, " (");
        _M0MPB13StringBuilder13write__objectGsE(_string_builder, _M0FP314vlmkit_2dsites4maps4main11dist__label(_r.length));
        _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, ")");
        const _tmp$3 = _M0FP36mizchi4luna3dom1p(undefined, _M0FP314vlmkit_2dsites4maps4main16directions__viewN6constrS3904, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_tmp$2, _M0FP36mizchi4luna3dom4text(_string_builder.val), _M0FP36mizchi4luna3dom4show(() => _r.approx, () => _M0FP36mizchi4luna3dom4span(undefined, _M0FP314vlmkit_2dsites4maps4main16directions__viewN6constrS3905, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4text("Approximate")]))]);
        const _tmp$4 = _M0FP36mizchi4luna3dom1p(undefined, _M0FP314vlmkit_2dsites4maps4main16directions__viewN6constrS3906, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4text(_r.approx ? "Straight-line estimate: there is no street route for this pair yet." : "Along the streets, via the fastest route.")]);
        const _p$4 = _r.steps;
        const _p$5 = new Array(_p$4.length);
        const _p$6 = _p$4.length;
        let _tmp$5 = 0;
        while (true) {
          const _p$7 = _tmp$5;
          if (_p$7 < _p$6) {
            const _p$8 = _p$4[_p$7];
            _p$5[_p$7] = _M0FP36mizchi4luna3dom2li(undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4text(_p$8)]);
            _tmp$5 = _p$7 + 1 | 0;
            continue;
          } else {
            break;
          }
        }
        return _M0FP36mizchi4luna3dom3div(undefined, _M0FP314vlmkit_2dsites4maps4main16directions__viewN6constrS3903, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_tmp$3, _tmp$4, _M0FP36mizchi4luna3dom2ol(undefined, _M0FP314vlmkit_2dsites4maps4main16directions__viewN6constrS3907, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, _p$5)]);
      }
    })])]);
  }
  function _M0FP314vlmkit_2dsites4maps4main11saved__view() {
    return _M0FP36mizchi4luna3dom7section(undefined, _M0FP314vlmkit_2dsites4maps4main11saved__viewN6constrS3949, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("aria-labelledby", "saved-h")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom3div(undefined, _M0FP314vlmkit_2dsites4maps4main11saved__viewN6constrS3950, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom2h2(_M0FP314vlmkit_2dsites4maps4main11saved__viewN6constrS3951, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4text("Saved")])]), _M0FP36mizchi4luna3dom4show(() => _M0MP26mizchi7signals6Signal3getGRPB5ArrayGiEE(_M0FP314vlmkit_2dsites4maps4main5saved).length === 0, () => _M0FP36mizchi4luna3dom1p(undefined, _M0FP314vlmkit_2dsites4maps4main11saved__viewN6constrS3952, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4text("Nothing saved yet. Open a place and choose Save.")])), _M0FP36mizchi4luna3dom2ul(undefined, _M0FP314vlmkit_2dsites4maps4main11saved__viewN6constrS3953, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("aria-label", "Saved places")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom9for__eachGiE(() => _M0MP26mizchi7signals6Signal3getGRPB5ArrayGiEE(_M0FP314vlmkit_2dsites4maps4main5saved), (id, _i) => _M0FP314vlmkit_2dsites4maps4main11result__row(id))])]);
  }
  function _M0FP314vlmkit_2dsites4maps4main2pt(x, y) {
    const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(1);
    _M0MPB13StringBuilder13write__objectGsE(_string_builder, _M0FP314vlmkit_2dsites4maps4main4fmt1(x));
    _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, " ");
    _M0MPB13StringBuilder13write__objectGsE(_string_builder, _M0FP314vlmkit_2dsites4maps4main4fmt1(y));
    return _string_builder.val;
  }
  function _M0FP314vlmkit_2dsites4maps4main7poly__d(pts, close) {
    const sb = _M0MPB13StringBuilder21StringBuilder_2einner(8);
    const _bind = pts.length;
    let _tmp = 0;
    while (true) {
      const i = _tmp;
      if (i < _bind) {
        const p = pts[i];
        _M0IPB13StringBuilderPB6Logger13write__string(sb, i === 0 ? "M" : "L");
        _M0IPB13StringBuilderPB6Logger13write__string(sb, _M0FP314vlmkit_2dsites4maps4main2pt(p._0, p._1));
        _tmp = i + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    if (close) {
      _M0IPB13StringBuilderPB6Logger13write__string(sb, "Z");
    }
    return sb.val;
  }
  function _M0FP314vlmkit_2dsites4maps4main8grid__xs() {
    const xs = [];
    const _bind = _M0FP314vlmkit_2dsites4maps4main7streets.length;
    let _tmp = 0;
    while (true) {
      const _ = _tmp;
      if (_ < _bind) {
        const s = _M0FP314vlmkit_2dsites4maps4main7streets[_];
        if (s.vertical) {
          _M0MPC15array5Array4pushGdE(xs, s.at);
        }
        _tmp = _ + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    _M0MPC15array5Array4sortGdE(xs);
    return xs;
  }
  function _M0FP314vlmkit_2dsites4maps4main8grid__ys() {
    const ys = [];
    const _bind = _M0FP314vlmkit_2dsites4maps4main7streets.length;
    let _tmp = 0;
    while (true) {
      const _ = _tmp;
      if (_ < _bind) {
        const s = _M0FP314vlmkit_2dsites4maps4main7streets[_];
        if (!s.vertical) {
          _M0MPC15array5Array4pushGdE(ys, s.at);
        }
        _tmp = _ + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    _M0MPC15array5Array4sortGdE(ys);
    return ys;
  }
  function _M0FP314vlmkit_2dsites4maps4main6interp(pts, x) {
    const n = pts.length;
    if (x <= _M0MPC15array5Array2atGUsiEE(pts, 0)._0) {
      return _M0MPC15array5Array2atGUsiEE(pts, 0)._1;
    }
    let _tmp = 1;
    while (true) {
      const i = _tmp;
      if (i < n) {
        const _bind = _M0MPC15array5Array2atGUsiEE(pts, i - 1 | 0);
        const _x0 = _bind._0;
        const _y0 = _bind._1;
        const _bind$2 = _M0MPC15array5Array2atGUsiEE(pts, i);
        const _x1 = _bind$2._0;
        const _y1 = _bind$2._1;
        if (x <= _x1) {
          return _y0 + (_y1 - _y0) * (x - _x0) / (_x1 - _x0);
        }
        _tmp = i + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return _M0MPC15array5Array2atGUsiEE(pts, n - 1 | 0)._1;
  }
  function _M0FP314vlmkit_2dsites4maps4main8coast__y(x) {
    return _M0FP314vlmkit_2dsites4maps4main6interp(_M0FP314vlmkit_2dsites4maps4main10coast__pts, x);
  }
  function _M0FP314vlmkit_2dsites4maps4main8in__poly(px, py, poly) {
    const n = poly.length;
    let inside = false;
    let j = n - 1 | 0;
    let _tmp = 0;
    while (true) {
      const i = _tmp;
      if (i < n) {
        const _bind = _M0MPC15array5Array2atGUsiEE(poly, i);
        const _xi = _bind._0;
        const _yi = _bind._1;
        const _bind$2 = _M0MPC15array5Array2atGUsiEE(poly, j);
        const _xj = _bind$2._0;
        const _yj = _bind$2._1;
        let _tmp$2;
        const _p = _yi > py;
        const _p$2 = _yj > py;
        if (!(_p === _p$2)) {
          _tmp$2 = px < (_xj - _xi) * (py - _yi) / (_yj - _yi) + _xi;
        } else {
          _tmp$2 = false;
        }
        if (_tmp$2) {
          inside = !inside;
        }
        j = i;
        _tmp = i + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return inside;
  }
  function _M0FP314vlmkit_2dsites4maps4main9seg__dist(px, py, a, b) {
    const dx = b._0 - a._0;
    const dy = b._1 - a._1;
    const l2 = dx * dx + dy * dy;
    const t0 = l2 === 0 ? 0 : ((px - a._0) * dx + (py - a._1) * dy) / l2;
    const t = t0 < 0 ? 0 : t0 > 1 ? 1 : t0;
    const qx = a._0 + t * dx - px;
    const qy = a._1 + t * dy - py;
    return Math.sqrt(qx * qx + qy * qy);
  }
  function _M0FP314vlmkit_2dsites4maps4main10line__dist(px, py, pts) {
    let best = 1000000000;
    let _tmp = 1;
    while (true) {
      const i = _tmp;
      if (i < pts.length) {
        const d = _M0FP314vlmkit_2dsites4maps4main9seg__dist(px, py, _M0MPC15array5Array2atGUsiEE(pts, i - 1 | 0), _M0MPC15array5Array2atGUsiEE(pts, i));
        if (d < best) {
          best = d;
        }
        _tmp = i + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return best;
  }
  function _M0FP314vlmkit_2dsites4maps4main8river__x(y) {
    const n = _M0FP314vlmkit_2dsites4maps4main10river__pts.length;
    if (y <= _M0MPC15array5Array2atGUsiEE(_M0FP314vlmkit_2dsites4maps4main10river__pts, 0)._1) {
      return _M0MPC15array5Array2atGUsiEE(_M0FP314vlmkit_2dsites4maps4main10river__pts, 0)._0;
    }
    let _tmp = 1;
    while (true) {
      const i = _tmp;
      if (i < n) {
        const _bind = _M0MPC15array5Array2atGUsiEE(_M0FP314vlmkit_2dsites4maps4main10river__pts, i - 1 | 0);
        const _x0 = _bind._0;
        const _y0 = _bind._1;
        const _bind$2 = _M0MPC15array5Array2atGUsiEE(_M0FP314vlmkit_2dsites4maps4main10river__pts, i);
        const _x1 = _bind$2._0;
        const _y1 = _bind$2._1;
        if (y <= _y1) {
          return _x0 + (_x1 - _x0) * (y - _y0) / (_y1 - _y0);
        }
        _tmp = i + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return _M0MPC15array5Array2atGUsiEE(_M0FP314vlmkit_2dsites4maps4main10river__pts, n - 1 | 0)._0;
  }
  function _M0FP314vlmkit_2dsites4maps4main9block__ok(x, y) {
    if (y > _M0FP314vlmkit_2dsites4maps4main8coast__y(x) - 26) {
      return false;
    }
    if (Math.abs(_M0FP314vlmkit_2dsites4maps4main8river__x(y) - x) < 58) {
      return false;
    }
    if (_M0FP314vlmkit_2dsites4maps4main10line__dist(x, y, _M0FP314vlmkit_2dsites4maps4main9rail__pts) < 26) {
      return false;
    }
    if (_M0FP314vlmkit_2dsites4maps4main9seg__dist(x, y, _M0FP314vlmkit_2dsites4maps4main7diag__a, _M0FP314vlmkit_2dsites4maps4main7diag__b) < 24) {
      return false;
    }
    const _bind = _M0FP314vlmkit_2dsites4maps4main5parks.length;
    let _tmp = 0;
    while (true) {
      const _ = _tmp;
      if (_ < _bind) {
        const pk = _M0FP314vlmkit_2dsites4maps4main5parks[_];
        if (_M0FP314vlmkit_2dsites4maps4main8in__poly(x, y, pk._1)) {
          return false;
        }
        _tmp = _ + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return true;
  }
  function _M0FP314vlmkit_2dsites4maps4main9blocks__d() {
    const xs = _M0FP314vlmkit_2dsites4maps4main8grid__xs();
    const ys = _M0FP314vlmkit_2dsites4maps4main8grid__ys();
    const rnd = _M0FP314vlmkit_2dsites4maps4main6seeded(2026);
    const sb = _M0MPB13StringBuilder21StringBuilder_2einner(8);
    let _tmp = 1;
    while (true) {
      const i = _tmp;
      if (i < xs.length) {
        let _tmp$2 = 1;
        while (true) {
          const j = _tmp$2;
          if (j < ys.length) {
            const x0 = _M0MPC15array5Array2atGdE(xs, i - 1 | 0) + 14;
            const x1 = _M0MPC15array5Array2atGdE(xs, i) - 14;
            const y0 = _M0MPC15array5Array2atGdE(ys, j - 1 | 0) + 14;
            const y1 = _M0MPC15array5Array2atGdE(ys, j) - 14;
            const cols = _M0MPC16double6Double7to__int(_M0MPC16double6Double4ceil((x1 - x0) / 150));
            const cw = (x1 - x0 - ((cols - 1 | 0) + 0) * 10) / (cols + 0);
            let _tmp$3 = 0;
            while (true) {
              const c = _tmp$3;
              if (c < cols) {
                const bx0 = x0 + (c + 0) * (cw + 10);
                const bx1 = bx0 + cw;
                const split = rnd() % 3 | 0;
                let rows;
                if (split === 0) {
                  rows = [{ _0: y0, _1: y1 }];
                } else {
                  const m = y0 + (y1 - y0) * (0.4 + ((rnd() % 20 | 0) + 0) / 100);
                  rows = [{ _0: y0, _1: m - 4 }, { _0: m + 4, _1: y1 }];
                }
                const _bind = rows.length;
                let _tmp$4 = 0;
                while (true) {
                  const _ = _tmp$4;
                  if (_ < _bind) {
                    const r = rows[_];
                    const _ry0 = r._0;
                    const _ry1 = r._1;
                    const ok = _M0FP314vlmkit_2dsites4maps4main9block__ok(bx0, _ry0) && (_M0FP314vlmkit_2dsites4maps4main9block__ok(bx1, _ry0) && (_M0FP314vlmkit_2dsites4maps4main9block__ok(bx0, _ry1) && (_M0FP314vlmkit_2dsites4maps4main9block__ok(bx1, _ry1) && _M0FP314vlmkit_2dsites4maps4main9block__ok((bx0 + bx1) / 2, (_ry0 + _ry1) / 2))));
                    if (ok) {
                      const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(5);
                      _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, "M");
                      _M0MPB13StringBuilder13write__objectGsE(_string_builder, _M0FP314vlmkit_2dsites4maps4main2pt(bx0, _ry0));
                      _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, "H");
                      _M0MPB13StringBuilder13write__objectGsE(_string_builder, _M0FP314vlmkit_2dsites4maps4main4fmt1(bx1));
                      _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, "V");
                      _M0MPB13StringBuilder13write__objectGsE(_string_builder, _M0FP314vlmkit_2dsites4maps4main4fmt1(_ry1));
                      _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, "H");
                      _M0MPB13StringBuilder13write__objectGsE(_string_builder, _M0FP314vlmkit_2dsites4maps4main4fmt1(bx0));
                      _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, "Z");
                      _M0IPB13StringBuilderPB6Logger13write__string(sb, _string_builder.val);
                    }
                    _tmp$4 = _ + 1 | 0;
                    continue;
                  } else {
                    break;
                  }
                }
                _tmp$3 = c + 1 | 0;
                continue;
              } else {
                break;
              }
            }
            _tmp$2 = j + 1 | 0;
            continue;
          } else {
            break;
          }
        }
        _tmp = i + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return sb.val;
  }
  function _M0FP314vlmkit_2dsites4maps4main9east__end(y) {
    let x = 0;
    while (true) {
      if (x < 3990 && _M0FP314vlmkit_2dsites4maps4main8coast__y(x + 10) > y + 30) {
        x = x + 10;
        continue;
      } else {
        break;
      }
    }
    return x >= 3990 ? 4000 : x;
  }
  function _M0FP314vlmkit_2dsites4maps4main16street__segments(s) {
    if (s.vertical) {
      const x = s.at;
      const bottom = _M0FP314vlmkit_2dsites4maps4main8coast__y(x) - 30;
      let cross = -1;
      let y = 0;
      while (true) {
        if (y < bottom) {
          if (Math.abs(_M0FP314vlmkit_2dsites4maps4main8river__x(y) - x) < 45) {
            cross = y;
            break;
          }
          y = y + 10;
          continue;
        } else {
          break;
        }
      }
      return cross < 0 ? [{ _0: { _0: x, _1: 0 }, _1: { _0: x, _1: bottom } }] : [{ _0: { _0: x, _1: 0 }, _1: { _0: x, _1: cross - 10 } }];
    } else {
      const y = s.at;
      const e = _M0FP314vlmkit_2dsites4maps4main9east__end(y);
      const rx = _M0FP314vlmkit_2dsites4maps4main8river__x(y);
      return s.kind === 2 || rx > e ? [{ _0: { _0: 0, _1: y }, _1: { _0: e, _1: y } }] : [{ _0: { _0: 0, _1: y }, _1: { _0: rx - 48, _1: y } }, { _0: { _0: rx + 48, _1: y }, _1: { _0: e, _1: y } }];
    }
  }
  function _M0FP314vlmkit_2dsites4maps4main9street__d(s) {
    if (s.at < 0) {
      const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(2);
      _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, "M");
      _M0MPB13StringBuilder13write__objectGsE(_string_builder, _M0FP314vlmkit_2dsites4maps4main2pt(_M0FP314vlmkit_2dsites4maps4main7diag__a._0, _M0FP314vlmkit_2dsites4maps4main7diag__a._1));
      _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, "L");
      _M0MPB13StringBuilder13write__objectGsE(_string_builder, _M0FP314vlmkit_2dsites4maps4main2pt(_M0FP314vlmkit_2dsites4maps4main7diag__b._0, _M0FP314vlmkit_2dsites4maps4main7diag__b._1));
      return _string_builder.val;
    }
    const sb = _M0MPB13StringBuilder21StringBuilder_2einner(8);
    const _bind = _M0FP314vlmkit_2dsites4maps4main16street__segments(s);
    const _bind$2 = _bind.length;
    let _tmp = 0;
    while (true) {
      const _ = _tmp;
      if (_ < _bind$2) {
        const seg = _bind[_];
        const _a = seg._0;
        const _b = seg._1;
        const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(2);
        _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, "M");
        _M0MPB13StringBuilder13write__objectGsE(_string_builder, _M0FP314vlmkit_2dsites4maps4main2pt(_a._0, _a._1));
        _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, "L");
        _M0MPB13StringBuilder13write__objectGsE(_string_builder, _M0FP314vlmkit_2dsites4maps4main2pt(_b._0, _b._1));
        _M0IPB13StringBuilderPB6Logger13write__string(sb, _string_builder.val);
        _tmp = _ + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return sb.val;
  }
  function _M0FP314vlmkit_2dsites4maps4main12all__streets() {
    const _self = [];
    _M0MPC15array5Array10push__iterGUsRP36mizchi4luna3dom4AttrEE(_self, _M0MPC15array5Array4iterGUsRP36mizchi4luna3dom4AttrEE(_M0FP314vlmkit_2dsites4maps4main7streets));
    _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(_self, _M0FP314vlmkit_2dsites4maps4main13lumen__avenue);
    return _self;
  }
  function _M0FP314vlmkit_2dsites4maps4main7land__d() {
    const pts = _M0MPC15array5Array4copyGUddEE(_M0FP314vlmkit_2dsites4maps4main10coast__pts);
    _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(pts, _M0FP314vlmkit_2dsites4maps4main7land__dN5tupleS4089);
    _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(pts, _M0FP314vlmkit_2dsites4maps4main7land__dN5tupleS4090);
    return _M0FP314vlmkit_2dsites4maps4main7poly__d(pts, true);
  }
  function _M0FP314vlmkit_2dsites4maps4main8river__d() {
    return _M0FP314vlmkit_2dsites4maps4main7poly__d(_M0FP314vlmkit_2dsites4maps4main10river__pts, false);
  }
  function _M0FP314vlmkit_2dsites4maps4main8route__d() {
    const _bind = _M0FP314vlmkit_2dsites4maps4main5route();
    if (_bind === undefined) {
      return "M0 0";
    } else {
      const _Some = _bind;
      const _r = _Some;
      return _M0FP314vlmkit_2dsites4maps4main7poly__d(_r.pts, false);
    }
  }
  function _M0FP314vlmkit_2dsites4maps4main14route__visible() {
    if (_M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4maps4main5panel) === 3) {
      const _bind = _M0FP314vlmkit_2dsites4maps4main5route();
      return !(_bind === undefined);
    } else {
      return false;
    }
  }
  function _M0FP314vlmkit_2dsites4maps4main14route__display() {
    return _M0FP314vlmkit_2dsites4maps4main14route__visible() ? "inline" : "none";
  }
  function _M0FP314vlmkit_2dsites4maps4main12world__layer() {
    const kids = [_M0FP36mizchi4luna3dom9svg__path(_M0FP314vlmkit_2dsites4maps4main7land__d(), undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("data-k", "land")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__)];
    const _bind = _M0FP314vlmkit_2dsites4maps4main5parks.length;
    let _tmp = 0;
    while (true) {
      const _ = _tmp;
      if (_ < _bind) {
        const pk = _M0FP314vlmkit_2dsites4maps4main5parks[_];
        _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(kids, _M0FP36mizchi4luna3dom9svg__path(_M0FP314vlmkit_2dsites4maps4main7poly__d(pk._1, true), undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("data-k", "park")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__));
        _tmp = _ + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(kids, _M0FP36mizchi4luna3dom9svg__path(_M0FP314vlmkit_2dsites4maps4main8river__d(), _M0FP314vlmkit_2dsites4maps4main12world__layerN6constrS4096, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("data-k", "river"), _M0FP314vlmkit_2dsites4maps4main2sa("vector-effect", "non-scaling-stroke")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__));
    _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(kids, _M0FP36mizchi4luna3dom9svg__path(_M0FP314vlmkit_2dsites4maps4main9blocks__d(), undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("data-k", "blocks")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__));
    const ordered = _M0FP314vlmkit_2dsites4maps4main12all__streets();
    let _tmp$2 = 0;
    while (true) {
      const pass = _tmp$2;
      if (pass < 2) {
        const _bind$2 = [1, 0, 2];
        const _bind$3 = _bind$2.length;
        let _tmp$3 = 0;
        while (true) {
          const _ = _tmp$3;
          if (_ < _bind$3) {
            const kind = _bind$2[_];
            const _bind$4 = ordered.length;
            let _tmp$4 = 0;
            while (true) {
              const _$2 = _tmp$4;
              if (_$2 < _bind$4) {
                const s = ordered[_$2];
                if (s.kind === kind) {
                  const k = kind === 1 ? "minor" : kind === 0 ? "major" : "avenue";
                  const role = pass === 0 ? "case" : "fill";
                  const _tmp$5 = _M0FP314vlmkit_2dsites4maps4main9street__d(s);
                  const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(1);
                  _M0MPB13StringBuilder13write__objectGsE(_string_builder, k);
                  _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, "-");
                  _M0MPB13StringBuilder13write__objectGsE(_string_builder, role);
                  _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(kids, _M0FP36mizchi4luna3dom9svg__path(_tmp$5, _M0FP314vlmkit_2dsites4maps4main12world__layerN6constrS4097, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("data-k", _string_builder.val), _M0FP314vlmkit_2dsites4maps4main2sa("vector-effect", "non-scaling-stroke"), _M0FP314vlmkit_2dsites4maps4main2sa("stroke-linecap", "round")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__));
                }
                _tmp$4 = _$2 + 1 | 0;
                continue;
              } else {
                break;
              }
            }
            _tmp$3 = _ + 1 | 0;
            continue;
          } else {
            break;
          }
        }
        _tmp$2 = pass + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(kids, _M0FP36mizchi4luna3dom9svg__path(_M0FP314vlmkit_2dsites4maps4main7poly__d(_M0FP314vlmkit_2dsites4maps4main9rail__pts, false), _M0FP314vlmkit_2dsites4maps4main12world__layerN6constrS4098, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("data-k", "rail-case"), _M0FP314vlmkit_2dsites4maps4main2sa("vector-effect", "non-scaling-stroke")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__));
    _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(kids, _M0FP36mizchi4luna3dom9svg__path(_M0FP314vlmkit_2dsites4maps4main7poly__d(_M0FP314vlmkit_2dsites4maps4main9rail__pts, false), _M0FP314vlmkit_2dsites4maps4main12world__layerN6constrS4099, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("data-k", "rail"), _M0FP314vlmkit_2dsites4maps4main2sa("vector-effect", "non-scaling-stroke")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__));
    _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(kids, _M0FP36mizchi4luna3dom9svg__path(undefined, _M0FP314vlmkit_2dsites4maps4main12world__layerN6constrS4100, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("data-k", "route-case"), _M0FP314vlmkit_2dsites4maps4main2sa("vector-effect", "non-scaling-stroke")]), new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4Some([_M0FP314vlmkit_2dsites4maps4main2da("d", _M0FP314vlmkit_2dsites4maps4main8route__d), _M0FP314vlmkit_2dsites4maps4main2da("display", _M0FP314vlmkit_2dsites4maps4main14route__display)])));
    _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(kids, _M0FP36mizchi4luna3dom9svg__path(undefined, _M0FP314vlmkit_2dsites4maps4main12world__layerN6constrS4101, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("vector-effect", "non-scaling-stroke")]), new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4Some([_M0FP314vlmkit_2dsites4maps4main2da("d", _M0FP314vlmkit_2dsites4maps4main8route__d), _M0FP314vlmkit_2dsites4maps4main2da("display", _M0FP314vlmkit_2dsites4maps4main14route__display), _M0FP314vlmkit_2dsites4maps4main2da("data-k", () => {
      const _bind$2 = _M0FP314vlmkit_2dsites4maps4main5route();
      if (_bind$2 === undefined) {
        return "route";
      } else {
        const _Some = _bind$2;
        const _r = _Some;
        return _r.approx ? "route-approx" : "route";
      }
    })])));
    return _M0FP36mizchi4luna3dom6svg__g(undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4Some([_M0FP314vlmkit_2dsites4maps4main2da("transform", () => {
      const v = _M0MP26mizchi7signals6Signal3getGRP314vlmkit_2dsites4maps4main4ViewE(_M0FP314vlmkit_2dsites4maps4main4view);
      const s = _M0FP314vlmkit_2dsites4maps4main9scale__of(v.z);
      const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(20);
      _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, "translate(");
      _M0MPB13StringBuilder13write__objectGsE(_string_builder, _M0FP314vlmkit_2dsites4maps4main4fmt2(_M0MP26mizchi7signals6Signal3getGdE(_M0FP314vlmkit_2dsites4maps4main6map__w) / 2 - v.cx * s));
      _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, " ");
      _M0MPB13StringBuilder13write__objectGsE(_string_builder, _M0FP314vlmkit_2dsites4maps4main4fmt2(_M0MP26mizchi7signals6Signal3getGdE(_M0FP314vlmkit_2dsites4maps4main6map__h) / 2 - v.cy * s));
      _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, ") scale(");
      _M0MPB13StringBuilder13write__objectGdE(_string_builder, s);
      _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, ")");
      return _string_builder.val;
    })]), kids);
  }
  function _M0FP314vlmkit_2dsites4maps4main12nearest__mid(lines, v, shift) {
    const n = lines.length;
    let best = 0;
    let bd = 1000000000;
    let _tmp = 1;
    while (true) {
      const i = _tmp;
      if (i < n) {
        const m = (_M0MPC15array5Array2atGdE(lines, i - 1 | 0) + _M0MPC15array5Array2atGdE(lines, i)) / 2;
        const d = Math.abs(m - v);
        if (d < bd) {
          bd = d;
          best = i;
        }
        _tmp = i + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    const k0 = best + shift | 0;
    const k = k0 < 1 ? 1 : k0 > (n - 1 | 0) ? n - 1 | 0 : k0;
    return (_M0MPC15array5Array2atGdE(lines, k - 1 | 0) + _M0MPC15array5Array2atGdE(lines, k)) / 2;
  }
  function _M0FP314vlmkit_2dsites4maps4main14covered__rects() {
    const w = _M0MP26mizchi7signals6Signal3getGdE(_M0FP314vlmkit_2dsites4maps4main6map__w);
    const h = _M0MP26mizchi7signals6Signal3getGdE(_M0FP314vlmkit_2dsites4maps4main6map__h) - _M0FP314vlmkit_2dsites4maps4main13sheet__height();
    if (_M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4maps4main6mobile)) {
      return [{ _0: 0, _1: 0, _2: w, _3: 104 }, { _0: w - 60, _1: h - 168, _2: w, _3: h - 64 }, { _0: 0, _1: h - 132, _2: 72, _3: h - 64 }, { _0: w - 130, _1: h - 44, _2: w, _3: h }];
    } else {
      const top_w = _M0FP314vlmkit_2dsites4maps4main13visible__left() > 0 ? 404 : 676;
      return [{ _0: 0, _1: 0, _2: top_w, _3: 116 }, { _0: w - 60, _1: h - 148, _2: w, _3: h - 56 }, { _0: _M0FP314vlmkit_2dsites4maps4main13visible__left(), _1: h - 92, _2: _M0FP314vlmkit_2dsites4maps4main13visible__left() + 92, _3: h }, { _0: w - 470, _1: h - 44, _2: w, _3: h }];
    }
  }
  function _M0FP314vlmkit_2dsites4maps4main8in__view(x, y) {
    if (!(x > 30 && (x < _M0MP26mizchi7signals6Signal3getGdE(_M0FP314vlmkit_2dsites4maps4main6map__w) - 30 && (y > 20 && y < _M0MP26mizchi7signals6Signal3getGdE(_M0FP314vlmkit_2dsites4maps4main6map__h) - 20)))) {
      return false;
    }
    const _bind = _M0FP314vlmkit_2dsites4maps4main14covered__rects();
    const _bind$2 = _bind.length;
    let _tmp = 0;
    while (true) {
      const _ = _tmp;
      if (_ < _bind$2) {
        const z = _bind[_];
        const _x0 = z._0;
        const _y0 = z._1;
        const _x1 = z._2;
        const _y1 = z._3;
        if (x > _x0 - 50 && (x < _x1 + 50 && (y > _y0 - 8 && y < _y1 + 8))) {
          return false;
        }
        _tmp = _ + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return true;
  }
  function _M0FP314vlmkit_2dsites4maps4main13street__label(s, i) {
    const lv = _M0FP314vlmkit_2dsites4maps4main5level();
    const need = s.kind === 1 ? 4 : 3;
    if (lv < need) {
      return _M0FP314vlmkit_2dsites4maps4main13street__labelN5tupleS4154;
    }
    const v = _M0MP26mizchi7signals6Signal3getGRP314vlmkit_2dsites4maps4main4ViewE(_M0FP314vlmkit_2dsites4maps4main4view);
    const shift = (i % 3 | 0) - 1 | 0;
    if (s.at < 0) {
      const dx = _M0FP314vlmkit_2dsites4maps4main7diag__b._0 - _M0FP314vlmkit_2dsites4maps4main7diag__a._0;
      const dy = _M0FP314vlmkit_2dsites4maps4main7diag__b._1 - _M0FP314vlmkit_2dsites4maps4main7diag__a._1;
      const _p = ((v.cx - _M0FP314vlmkit_2dsites4maps4main7diag__a._0) * dx + (v.cy - _M0FP314vlmkit_2dsites4maps4main7diag__a._1) * dy) / (dx * dx + dy * dy);
      const _p$2 = 0.05;
      const _p$3 = 0.95;
      const t = _p < _p$2 ? _p$2 : _p > _p$3 ? _p$3 : _p;
      const x = _M0FP314vlmkit_2dsites4maps4main2sx(_M0FP314vlmkit_2dsites4maps4main7diag__a._0 + t * dx);
      const y = _M0FP314vlmkit_2dsites4maps4main2sy(_M0FP314vlmkit_2dsites4maps4main7diag__a._1 + t * dy);
      return { _0: _M0FP314vlmkit_2dsites4maps4main8in__view(x, y), _1: x, _2: y, _3: _M0FP314vlmkit_2dsites4maps4main6atan2d(dy, dx) };
    }
    const segs = _M0FP314vlmkit_2dsites4maps4main16street__segments(s);
    if (s.vertical) {
      const _bind = _M0MPC15array5Array2atGUsiEE(segs, 0);
      const _a = _bind._0;
      const _b = _bind._1;
      const _p = _M0FP314vlmkit_2dsites4maps4main12nearest__mid(_M0FP314vlmkit_2dsites4maps4main7ys__all, v.cy, shift);
      const _p$2 = _a._1 + 60;
      const _p$3 = _b._1 - 60;
      const y = _p < _p$2 ? _p$2 : _p > _p$3 ? _p$3 : _p;
      const px = _M0FP314vlmkit_2dsites4maps4main2sx(s.at);
      const py = _M0FP314vlmkit_2dsites4maps4main2sy(y);
      return { _0: _M0FP314vlmkit_2dsites4maps4main8in__view(px, py), _1: px, _2: py, _3: -90 };
    } else {
      let best = _M0MPC15array5Array2atGUsiEE(segs, 0);
      const _bind = segs.length;
      let _tmp = 0;
      while (true) {
        const _ = _tmp;
        if (_ < _bind) {
          const sg = segs[_];
          if (v.cx >= sg._0._0 && v.cx <= sg._1._0) {
            best = sg;
          }
          _tmp = _ + 1 | 0;
          continue;
        } else {
          break;
        }
      }
      const _bind$2 = best;
      const _a = _bind$2._0;
      const _b = _bind$2._1;
      const _p = _M0FP314vlmkit_2dsites4maps4main12nearest__mid(_M0FP314vlmkit_2dsites4maps4main7xs__all, v.cx, shift);
      const _p$2 = _a._0 + 60;
      const _p$3 = _b._0 - 60;
      const x = _p < _p$2 ? _p$2 : _p > _p$3 ? _p$3 : _p;
      const px = _M0FP314vlmkit_2dsites4maps4main2sx(x);
      const py = _M0FP314vlmkit_2dsites4maps4main2sy(s.at);
      return { _0: _M0FP314vlmkit_2dsites4maps4main8in__view(px, py), _1: px, _2: py, _3: 0 };
    }
  }
  function _M0FP314vlmkit_2dsites4maps4main11label__text(txt, kind, pos) {
    return _M0FP36mizchi4luna3dom9svg__text(undefined, undefined, undefined, undefined, _M0FP314vlmkit_2dsites4maps4main11label__textN6constrS4184, _M0FP314vlmkit_2dsites4maps4main11label__textN6constrS4185, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("data-k", kind)]), new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4Some([_M0FP314vlmkit_2dsites4maps4main2da("display", () => pos()._0 ? "inline" : "none"), _M0FP314vlmkit_2dsites4maps4main2da("x", () => _M0FP314vlmkit_2dsites4maps4main4fmt1(pos()._1)), _M0FP314vlmkit_2dsites4maps4main2da("y", () => _M0FP314vlmkit_2dsites4maps4main4fmt1(pos()._2)), _M0FP314vlmkit_2dsites4maps4main2da("transform", () => {
      const _bind = pos();
      const _x = _bind._1;
      const _y = _bind._2;
      const _r = _bind._3;
      if (_r === 0) {
        return "";
      } else {
        const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(10);
        _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, "rotate(");
        _M0MPB13StringBuilder13write__objectGsE(_string_builder, _M0FP314vlmkit_2dsites4maps4main4fmt1(_r));
        _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, " ");
        _M0MPB13StringBuilder13write__objectGsE(_string_builder, _M0FP314vlmkit_2dsites4maps4main4fmt1(_x));
        _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, " ");
        _M0MPB13StringBuilder13write__objectGsE(_string_builder, _M0FP314vlmkit_2dsites4maps4main4fmt1(_y));
        _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, ")");
        return _string_builder.val;
      }
    })]), [_M0FP36mizchi4luna3dom4text(txt)]);
  }
  function _M0FP314vlmkit_2dsites4maps4main12fixed__label(txt, kind, x, y, rot, show_fn) {
    return _M0FP314vlmkit_2dsites4maps4main11label__text(txt, kind, () => {
      const px = _M0FP314vlmkit_2dsites4maps4main2sx(x);
      const py = _M0FP314vlmkit_2dsites4maps4main2sy(y);
      const half = rot === 0 ? (txt.length + 0) * (kind === "city" ? 8 : 4.6) : 0;
      const inside = px - half > _M0FP314vlmkit_2dsites4maps4main13visible__left() + 6 && px + half < _M0MP26mizchi7signals6Signal3getGdE(_M0FP314vlmkit_2dsites4maps4main6map__w) - 6;
      return { _0: show_fn(_M0FP314vlmkit_2dsites4maps4main5level()) && (inside && _M0FP314vlmkit_2dsites4maps4main8in__view(px, py)), _1: px, _2: py, _3: rot };
    });
  }
  function _M0FP314vlmkit_2dsites4maps4main7shields() {
    const spots = [_M0FP314vlmkit_2dsites4maps4main7shieldsN5tupleS4204, _M0FP314vlmkit_2dsites4maps4main7shieldsN5tupleS4205, _M0FP314vlmkit_2dsites4maps4main7shieldsN5tupleS4206, _M0FP314vlmkit_2dsites4maps4main7shieldsN5tupleS4207, _M0FP314vlmkit_2dsites4maps4main7shieldsN5tupleS4208, _M0FP314vlmkit_2dsites4maps4main7shieldsN5tupleS4209, _M0FP314vlmkit_2dsites4maps4main7shieldsN5tupleS4210];
    const _p = new Array(spots.length);
    const _p$2 = spots.length;
    let _tmp = 0;
    while (true) {
      const _p$3 = _tmp;
      if (_p$3 < _p$2) {
        const _p$4 = spots[_p$3];
        const _p$5 = _p$4._0;
        const _p$6 = _p$4._1;
        const _p$7 = _p$4._2;
        const _p$8 = _p$5.length > 1 ? 24 : 18;
        _p[_p$3] = _M0FP36mizchi4luna3dom6svg__g(undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("data-k", "shield")]), new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4Some([_M0FP314vlmkit_2dsites4maps4main2da("transform", () => {
          const _p$9 = _M0MPB13StringBuilder21StringBuilder_2einner(12);
          _M0IPB13StringBuilderPB6Logger13write__string(_p$9, "translate(");
          _M0MPB13StringBuilder13write__objectGsE(_p$9, _M0FP314vlmkit_2dsites4maps4main4fmt1(_M0FP314vlmkit_2dsites4maps4main2sx(_p$6)));
          _M0IPB13StringBuilderPB6Logger13write__string(_p$9, " ");
          _M0MPB13StringBuilder13write__objectGsE(_p$9, _M0FP314vlmkit_2dsites4maps4main4fmt1(_M0FP314vlmkit_2dsites4maps4main2sy(_p$7)));
          _M0IPB13StringBuilderPB6Logger13write__string(_p$9, ")");
          return _p$9.val;
        }), _M0FP314vlmkit_2dsites4maps4main2da("display", () => _M0FP314vlmkit_2dsites4maps4main8in__view(_M0FP314vlmkit_2dsites4maps4main2sx(_p$6), _M0FP314vlmkit_2dsites4maps4main2sy(_p$7)) ? "inline" : "none")]), [_M0FP36mizchi4luna3dom9svg__rect(_M0FP314vlmkit_2dsites4maps4main4fmt1(-_p$8 / 2), _M0FP314vlmkit_2dsites4maps4main7shieldsN6constrS4211, _M0FP314vlmkit_2dsites4maps4main4fmt1(_p$8), _M0FP314vlmkit_2dsites4maps4main7shieldsN6constrS4212, _M0FP314vlmkit_2dsites4maps4main7shieldsN6constrS4213, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("data-k", "shield-box")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__), _M0FP36mizchi4luna3dom9svg__text(undefined, _M0FP314vlmkit_2dsites4maps4main7shieldsN6constrS4214, undefined, undefined, _M0FP314vlmkit_2dsites4maps4main7shieldsN6constrS4215, _M0FP314vlmkit_2dsites4maps4main7shieldsN6constrS4216, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("data-k", "shield-num")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4text(_p$5)])]);
        _tmp = _p$3 + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return _p;
  }
  function _M0FP314vlmkit_2dsites4maps4main10route__end(start) {
    const _bind = _M0FP314vlmkit_2dsites4maps4main5route();
    if (_bind === undefined) {
      return _M0FP314vlmkit_2dsites4maps4main10route__endN5tupleS4224;
    } else {
      const _Some = _bind;
      const _r = _Some;
      const p = start ? _M0MPC15array5Array2atGUsiEE(_r.pts, 0) : _M0MPC15array5Array2atGUsiEE(_r.pts, _r.pts.length - 1 | 0);
      return { _0: _M0FP314vlmkit_2dsites4maps4main4fmt1(_M0FP314vlmkit_2dsites4maps4main2sx(p._0)), _1: _M0FP314vlmkit_2dsites4maps4main4fmt1(_M0FP314vlmkit_2dsites4maps4main2sy(p._1)) };
    }
  }
  function _M0FP314vlmkit_2dsites4maps4main13labels__layer() {
    const kids = [];
    _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(kids, _M0FP314vlmkit_2dsites4maps4main12fixed__label("Lumen Bay", "water", 2950, 2420, 0, (_l) => true));
    _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(kids, _M0FP314vlmkit_2dsites4maps4main12fixed__label("River Sable", "water", 1336, 240, 85, (l) => l >= 2));
    const _bind = _M0FP314vlmkit_2dsites4maps4main5areas.length;
    let _tmp = 0;
    while (true) {
      const _ = _tmp;
      if (_ < _bind) {
        const a = _M0FP314vlmkit_2dsites4maps4main5areas[_];
        const _n = a._0;
        const _x = a._1;
        const _y = a._2;
        _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(kids, _M0FP314vlmkit_2dsites4maps4main12fixed__label(_n, "area", _x, _y, 0, (l) => l >= 2 && l <= 3));
        _tmp = _ + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(kids, _M0FP314vlmkit_2dsites4maps4main12fixed__label("Port Lumen", "city", 1180, 1720, 0, (l) => l <= 2));
    const _bind$2 = _M0FP314vlmkit_2dsites4maps4main5parks.length;
    let _tmp$2 = 0;
    while (true) {
      const _ = _tmp$2;
      if (_ < _bind$2) {
        const pk = _M0FP314vlmkit_2dsites4maps4main5parks[_];
        const _n = pk._0;
        const _poly = pk._1;
        const ax = new _M0TPB8MutLocalGdE(0);
        const ay = new _M0TPB8MutLocalGdE(0);
        const _bind$3 = _poly.length;
        let _tmp$3 = 0;
        while (true) {
          const _$2 = _tmp$3;
          if (_$2 < _bind$3) {
            const q = _poly[_$2];
            ax.val = ax.val + q._0;
            ay.val = ay.val + q._1;
            _tmp$3 = _$2 + 1 | 0;
            continue;
          } else {
            break;
          }
        }
        const k = _poly.length + 0;
        _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(kids, _M0FP314vlmkit_2dsites4maps4main11label__text(_n, "park-label", () => {
          const px = _M0FP314vlmkit_2dsites4maps4main2sx(ax.val / k);
          const py = _M0FP314vlmkit_2dsites4maps4main2sy(ay.val / k) + 30;
          return { _0: _M0FP314vlmkit_2dsites4maps4main5level() >= 3 && _M0FP314vlmkit_2dsites4maps4main8in__view(px, py), _1: px, _2: py, _3: 0 };
        }));
        _tmp$2 = _ + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    const _bind$3 = _M0FP314vlmkit_2dsites4maps4main12all__streets();
    const _bind$4 = _bind$3.length;
    let _tmp$3 = 0;
    while (true) {
      const i = _tmp$3;
      if (i < _bind$4) {
        const s = _bind$3[i];
        const kind = s.kind === 2 ? "avenue-label" : "street-label";
        _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(kids, _M0FP314vlmkit_2dsites4maps4main11label__text(s.name, kind, () => _M0FP314vlmkit_2dsites4maps4main13street__label(s, i)));
        _tmp$3 = i + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    const _bind$5 = _M0FP314vlmkit_2dsites4maps4main6places.length;
    let _tmp$4 = 0;
    while (true) {
      const _ = _tmp$4;
      if (_ < _bind$5) {
        const p = _M0FP314vlmkit_2dsites4maps4main6places[_];
        if (p.cat === 5 && p.id <= 37) {
          _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(kids, _M0FP36mizchi4luna3dom9svg__text(undefined, undefined, undefined, undefined, _M0FP314vlmkit_2dsites4maps4main13labels__layerN6constrS4230, _M0FP314vlmkit_2dsites4maps4main13labels__layerN6constrS4231, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("data-k", "station-label")]), new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4Some([_M0FP314vlmkit_2dsites4maps4main2da("display", () => {
            const show = _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4maps4main5layer) === 1 && _M0FP314vlmkit_2dsites4maps4main5level() >= 2;
            return show && _M0FP314vlmkit_2dsites4maps4main8in__view(_M0FP314vlmkit_2dsites4maps4main2sx(p.x), _M0FP314vlmkit_2dsites4maps4main2sy(p.y)) ? "inline" : "none";
          }), _M0FP314vlmkit_2dsites4maps4main2da("x", () => _M0FP314vlmkit_2dsites4maps4main4fmt1(_M0FP314vlmkit_2dsites4maps4main2sx(p.x))), _M0FP314vlmkit_2dsites4maps4main2da("y", () => _M0FP314vlmkit_2dsites4maps4main4fmt1(_M0FP314vlmkit_2dsites4maps4main2sy(p.y) - 52))]), [_M0FP36mizchi4luna3dom4text(p.name)]));
        }
        _tmp$4 = _ + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    const _bind$6 = _M0FP314vlmkit_2dsites4maps4main7shields();
    const _bind$7 = _bind$6.length;
    let _tmp$5 = 0;
    while (true) {
      const _ = _tmp$5;
      if (_ < _bind$7) {
        const sh = _bind$6[_];
        _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(kids, sh);
        _tmp$5 = _ + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(kids, _M0FP36mizchi4luna3dom11svg__circle(undefined, undefined, _M0FP314vlmkit_2dsites4maps4main13labels__layerN6constrS4232, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("data-k", "route-start")]), new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4Some([_M0FP314vlmkit_2dsites4maps4main2da("display", _M0FP314vlmkit_2dsites4maps4main14route__display), _M0FP314vlmkit_2dsites4maps4main2da("cx", () => _M0FP314vlmkit_2dsites4maps4main10route__end(true)._0), _M0FP314vlmkit_2dsites4maps4main2da("cy", () => _M0FP314vlmkit_2dsites4maps4main10route__end(true)._1)])));
    _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(kids, _M0FP36mizchi4luna3dom6svg__g(undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4Some([_M0FP314vlmkit_2dsites4maps4main2da("display", () => {
      const _bind$8 = _M0FP314vlmkit_2dsites4maps4main5route();
      if (_bind$8 === undefined) {
        return "none";
      } else {
        const _Some = _bind$8;
        const _r = _Some;
        return _r.approx && _M0FP314vlmkit_2dsites4maps4main14route__visible() ? "inline" : "none";
      }
    }), _M0FP314vlmkit_2dsites4maps4main2da("transform", () => {
      const _bind$8 = _M0FP314vlmkit_2dsites4maps4main5route();
      if (_bind$8 === undefined) {
        return "";
      } else {
        const _Some = _bind$8;
        const _r = _Some;
        const a = _M0MPC15array5Array2atGUsiEE(_r.pts, 0);
        const b = _M0MPC15array5Array2atGUsiEE(_r.pts, _r.pts.length - 1 | 0);
        const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(12);
        _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, "translate(");
        _M0MPB13StringBuilder13write__objectGsE(_string_builder, _M0FP314vlmkit_2dsites4maps4main4fmt1(_M0FP314vlmkit_2dsites4maps4main2sx((a._0 + b._0) / 2)));
        _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, " ");
        _M0MPB13StringBuilder13write__objectGsE(_string_builder, _M0FP314vlmkit_2dsites4maps4main4fmt1(_M0FP314vlmkit_2dsites4maps4main2sy((a._1 + b._1) / 2)));
        _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, ")");
        return _string_builder.val;
      }
    })]), [_M0FP36mizchi4luna3dom9svg__rect(_M0FP314vlmkit_2dsites4maps4main13labels__layerN6constrS4233, _M0FP314vlmkit_2dsites4maps4main13labels__layerN6constrS4234, _M0FP314vlmkit_2dsites4maps4main13labels__layerN6constrS4235, _M0FP314vlmkit_2dsites4maps4main13labels__layerN6constrS4236, _M0FP314vlmkit_2dsites4maps4main13labels__layerN6constrS4237, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("data-k", "approx-box")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__), _M0FP36mizchi4luna3dom9svg__text(undefined, _M0FP314vlmkit_2dsites4maps4main13labels__layerN6constrS4238, undefined, undefined, _M0FP314vlmkit_2dsites4maps4main13labels__layerN6constrS4239, _M0FP314vlmkit_2dsites4maps4main13labels__layerN6constrS4240, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("data-k", "approx-text")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4text("Approximate")])]));
    return _M0FP36mizchi4luna3dom3svg(_M0FP314vlmkit_2dsites4maps4main13labels__layerN6constrS4241, _M0FP314vlmkit_2dsites4maps4main13labels__layerN6constrS4242, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("data-k", "labels"), _M0FP314vlmkit_2dsites4maps4main2sa("aria-hidden", "true"), _M0FP314vlmkit_2dsites4maps4main2sa("focusable", "false")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, kids);
  }
  function _M0FP314vlmkit_2dsites4maps4main7on__map(x, y) {
    const px = _M0FP314vlmkit_2dsites4maps4main2sx(x);
    const py = _M0FP314vlmkit_2dsites4maps4main2sy(y);
    if (!(px > _M0FP314vlmkit_2dsites4maps4main13visible__left() + 8 && (px < _M0MP26mizchi7signals6Signal3getGdE(_M0FP314vlmkit_2dsites4maps4main6map__w) - 8 && (py > 30 && py < _M0MP26mizchi7signals6Signal3getGdE(_M0FP314vlmkit_2dsites4maps4main6map__h) - _M0FP314vlmkit_2dsites4maps4main13sheet__height() + 2)))) {
      return false;
    }
    const l = px - 22;
    const r = px + 22;
    const t = py - 40;
    const b = py + 4;
    const _bind = _M0FP314vlmkit_2dsites4maps4main14covered__rects();
    const _bind$2 = _bind.length;
    let _tmp = 0;
    while (true) {
      const _ = _tmp;
      if (_ < _bind$2) {
        const z = _bind[_];
        const _x0 = z._0;
        const _y0 = z._1;
        const _x1 = z._2;
        const _y1 = z._3;
        if (r > _x0 && (l < _x1 && (b > _y0 && t < _y1))) {
          return false;
        }
        _tmp = _ + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return true;
  }
  function _M0FP314vlmkit_2dsites4maps4main10pin__shown(id) {
    const c = _M0FP314vlmkit_2dsites4maps4main8clusters();
    return _M0MPC15array5Array2atGiE(c.leader, id) === id && (_M0MPC15array5Array2atGiE(c.count, id) === 1 && _M0FP314vlmkit_2dsites4maps4main7on__map(_M0MPC15array5Array2atGUsiEE(_M0FP314vlmkit_2dsites4maps4main6places, id).x, _M0MPC15array5Array2atGUsiEE(_M0FP314vlmkit_2dsites4maps4main6places, id).y));
  }
  function _M0FP314vlmkit_2dsites4maps4main8pin__svg(cat) {
    return _M0FP36mizchi4luna3dom3svg(_M0FP314vlmkit_2dsites4maps4main8pin__svgN6constrS4314, _M0FP314vlmkit_2dsites4maps4main8pin__svgN6constrS4315, _M0FP314vlmkit_2dsites4maps4main8pin__svgN6constrS4316, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("aria-hidden", "true"), _M0FP314vlmkit_2dsites4maps4main2sa("focusable", "false"), _M0FP314vlmkit_2dsites4maps4main2sa("data-k", "pin")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom9svg__path(_M0FP314vlmkit_2dsites4maps4main8pin__svgN6constrS4317, _M0MPC15array5Array2atGUsiEE(_M0FP314vlmkit_2dsites4maps4main11cat__colors, cat), _M0FP314vlmkit_2dsites4maps4main8pin__svgN6constrS4318, _M0FP314vlmkit_2dsites4maps4main8pin__svgN6constrS4319, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("data-k", "pin-body")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__), _M0FP36mizchi4luna3dom6svg__g(_M0FP314vlmkit_2dsites4maps4main8pin__svgN6constrS4320, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom9svg__path(_M0MPC15array5Array2atGUsiEE(_M0FP314vlmkit_2dsites4maps4main10cat__icons, cat), _M0FP314vlmkit_2dsites4maps4main8pin__svgN6constrS4321, _M0FP314vlmkit_2dsites4maps4main8pin__svgN6constrS4322, _M0FP314vlmkit_2dsites4maps4main8pin__svgN6constrS4323, _M0FP314vlmkit_2dsites4maps4main8pin__svgN6constrS4324, _M0FP314vlmkit_2dsites4maps4main8pin__svgN6constrS4325, undefined, undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__)])]);
  }
  function _M0FP314vlmkit_2dsites4maps4main11pin__button(p) {
    const _bind = _M0FP314vlmkit_2dsites4maps4main12open__status(p);
    const _open = _bind._0;
    const _rest = _bind._1;
    const _tmp = new _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4Some(_M0MP36mizchi4luna3dom10HandlerMap5click(_M0FP36mizchi4luna3dom6events(), (_e) => {
      _M0FP314vlmkit_2dsites4maps4main13select__place(p.id);
    }));
    const _tmp$2 = _M0FP314vlmkit_2dsites4maps4main2sa("type", "button");
    const _tmp$3 = _M0FP314vlmkit_2dsites4maps4main2sa("aria-label", p.name);
    const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(4);
    _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, "pin-");
    _M0MPB13StringBuilder13write__objectGiE(_string_builder, p.id);
    const _tmp$4 = new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_tmp$2, _tmp$3, _M0FP314vlmkit_2dsites4maps4main2sa("id", _string_builder.val), _M0FP314vlmkit_2dsites4maps4main2sa("data-cat", _M0MPC13int3Int18to__string_2einner(p.cat, 10))]);
    const _tmp$5 = new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4Some([_M0FP314vlmkit_2dsites4maps4main2da("aria-pressed", () => {
      const _p = _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4maps4main8selected) === p.id;
      return _p ? "true" : "false";
    }), _M0FP314vlmkit_2dsites4maps4main2da("tabindex", () => _M0FP314vlmkit_2dsites4maps4main10pin__shown(p.id) ? "0" : "-1")]);
    const _tmp$6 = _M0FP314vlmkit_2dsites4maps4main8pin__svg(p.cat);
    const _tmp$7 = new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("aria-hidden", "true")]);
    const _tmp$8 = _M0FP36mizchi4luna3dom4span(undefined, _M0FP314vlmkit_2dsites4maps4main11pin__buttonN6constrS4328, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4text(p.name)]);
    const _string_builder$2 = _M0MPB13StringBuilder21StringBuilder_2einner(8);
    _M0MPB13StringBuilder13write__objectGsE(_string_builder$2, _M0FP314vlmkit_2dsites4maps4main11rating__str(p.rating));
    _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$2, " ★ · ");
    _M0MPB13StringBuilder13write__objectGsE(_string_builder$2, _M0MPC15array5Array2atGUsiEE(_M0FP314vlmkit_2dsites4maps4main13cat__singular, p.cat));
    const _tmp$9 = _M0FP36mizchi4luna3dom4span(undefined, _M0FP314vlmkit_2dsites4maps4main11pin__buttonN6constrS4329, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4text(_string_builder$2.val)]);
    const _tmp$10 = _open ? "pin-card-open" : "pin-card-closed";
    const _tmp$11 = _M0FP36mizchi4luna3dom4text(_open ? "Open" : "Closed");
    const _string_builder$3 = _M0MPB13StringBuilder21StringBuilder_2einner(4);
    _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$3, " · ");
    _M0MPB13StringBuilder13write__objectGsE(_string_builder$3, _rest);
    return _M0FP36mizchi4luna3dom6button(-1, undefined, undefined, undefined, () => {
      let c = "pin";
      if (!_M0FP314vlmkit_2dsites4maps4main10pin__shown(p.id)) {
        c = `${c} off`;
      }
      if (_M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4maps4main8selected) === p.id) {
        c = `${c} sel`;
      }
      if (_M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4maps4main3hot) === p.id) {
        c = `${c} hot`;
      }
      return c;
    }, () => {
      const _string_builder$4 = _M0MPB13StringBuilder21StringBuilder_2einner(28);
      _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$4, "transform: translate(");
      _M0MPB13StringBuilder13write__objectGsE(_string_builder$4, _M0FP314vlmkit_2dsites4maps4main4fmt1(_M0FP314vlmkit_2dsites4maps4main2sx(p.x) - 22));
      _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$4, "px, ");
      _M0MPB13StringBuilder13write__objectGsE(_string_builder$4, _M0FP314vlmkit_2dsites4maps4main4fmt1(_M0FP314vlmkit_2dsites4maps4main2sy(p.y) - 40));
      _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$4, "px)");
      return _string_builder$4.val;
    }, undefined, _tmp, undefined, _tmp$4, _tmp$5, [_tmp$6, _M0FP36mizchi4luna3dom4span(undefined, _M0FP314vlmkit_2dsites4maps4main11pin__buttonN6constrS4327, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _tmp$7, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_tmp$8, _tmp$9, _M0FP36mizchi4luna3dom4span(undefined, _tmp$10, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_tmp$11, _M0FP36mizchi4luna3dom4span(undefined, _M0FP314vlmkit_2dsites4maps4main11pin__buttonN6constrS4330, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4text(_string_builder$3.val)])])])]);
  }
  function _M0FP314vlmkit_2dsites4maps4main15cluster__buttonN5shownS4341(p) {
    const c = _M0FP314vlmkit_2dsites4maps4main8clusters();
    return _M0MPC15array5Array2atGiE(c.leader, p.id) === p.id && (_M0MPC15array5Array2atGiE(c.count, p.id) > 1 && _M0FP314vlmkit_2dsites4maps4main7on__map(_M0MPC15array5Array2atGdE(c.cx, p.id), _M0MPC15array5Array2atGdE(c.cy, p.id) + 20));
  }
  function _M0FP314vlmkit_2dsites4maps4main15cluster__button(p) {
    return _M0FP36mizchi4luna3dom6button(-1, undefined, undefined, undefined, () => _M0FP314vlmkit_2dsites4maps4main15cluster__buttonN5shownS4341(p) ? "cluster" : "cluster off", () => {
      const c = _M0FP314vlmkit_2dsites4maps4main8clusters();
      const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(28);
      _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, "transform: translate(");
      _M0MPB13StringBuilder13write__objectGsE(_string_builder, _M0FP314vlmkit_2dsites4maps4main4fmt1(_M0FP314vlmkit_2dsites4maps4main2sx(_M0MPC15array5Array2atGdE(c.cx, p.id)) - 22));
      _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, "px, ");
      _M0MPB13StringBuilder13write__objectGsE(_string_builder, _M0FP314vlmkit_2dsites4maps4main4fmt1(_M0FP314vlmkit_2dsites4maps4main2sy(_M0MPC15array5Array2atGdE(c.cy, p.id)) - 22));
      _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, "px)");
      return _string_builder.val;
    }, undefined, new _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4Some(_M0MP36mizchi4luna3dom10HandlerMap5click(_M0FP36mizchi4luna3dom6events(), (_e) => {
      const c = _M0FP314vlmkit_2dsites4maps4main8clusters();
      const z = _M0MPC16double6Double5floor(_M0MP26mizchi7signals6Signal3getGRP314vlmkit_2dsites4maps4main4ViewE(_M0FP314vlmkit_2dsites4maps4main4view).z + 0.001) + 2;
      _M0FP314vlmkit_2dsites4maps4main15ease__to__point(_M0MPC15array5Array2atGdE(c.cx, p.id), _M0MPC15array5Array2atGdE(c.cy, p.id), z);
    })), undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("type", "button")]), new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4Some([_M0FP314vlmkit_2dsites4maps4main2da("aria-label", () => {
      const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(21);
      _M0MPB13StringBuilder13write__objectGiE(_string_builder, _M0MPC15array5Array2atGiE(_M0FP314vlmkit_2dsites4maps4main8clusters().count, p.id));
      _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, " places here. Zoom in");
      return _string_builder.val;
    }), _M0FP314vlmkit_2dsites4maps4main2da("tabindex", () => _M0FP314vlmkit_2dsites4maps4main15cluster__buttonN5shownS4341(p) ? "0" : "-1")]), [_M0FP36mizchi4luna3dom4span(undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("aria-hidden", "true")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom9text__dyn(() => _M0MPC13int3Int18to__string_2einner(_M0MPC15array5Array2atGiE(_M0FP314vlmkit_2dsites4maps4main8clusters().count, p.id), 10))])]);
  }
  function _M0FP314vlmkit_2dsites4maps4main10map__local(e) {
    const _bind = _M0FP314vlmkit_2dsites4maps4main7map__el.val;
    if (_bind.$tag === 1) {
      const _Some = _bind;
      const _el = _Some._0;
      return { _0: _M0FP314vlmkit_2dsites4maps4main7ev__num(e, "clientX") - _M0FP314vlmkit_2dsites4maps4main8el__left(_el), _1: _M0FP314vlmkit_2dsites4maps4main7ev__num(e, "clientY") - _M0FP314vlmkit_2dsites4maps4main7el__top(_el) };
    } else {
      return _M0FP314vlmkit_2dsites4maps4main10map__localN5tupleS4351;
    }
  }
  function _M0FP314vlmkit_2dsites4maps4main12map__keydown(e) {
    if (!_M0FP314vlmkit_2dsites4maps4main8is__self(e)) {
      return undefined;
    }
    const k = _M0FP314vlmkit_2dsites4maps4main7ev__str(e, "key");
    _L: {
      _L$2: {
        _L$3: {
          _L$4: {
            switch (k) {
              case "ArrowLeft": {
                _M0FP314vlmkit_2dsites4maps4main7pan__by(-100, 0);
                break;
              }
              case "ArrowRight": {
                _M0FP314vlmkit_2dsites4maps4main7pan__by(100, 0);
                break;
              }
              case "ArrowUp": {
                _M0FP314vlmkit_2dsites4maps4main7pan__by(0, -100);
                break;
              }
              case "ArrowDown": {
                _M0FP314vlmkit_2dsites4maps4main7pan__by(0, 100);
                break;
              }
              case "+": {
                break _L$4;
              }
              case "=": {
                break _L$4;
              }
              case "-": {
                break _L$2;
              }
              case "_": {
                break _L$2;
              }
              case "Home": {
                _M0FP314vlmkit_2dsites4maps4main7fly__to(_M0FP314vlmkit_2dsites4maps4main10home__view());
                break;
              }
              default: {
                return undefined;
              }
            }
            break _L$3;
          }
          _M0FP314vlmkit_2dsites4maps4main12zoom__centre(1);
        }
        break _L;
      }
      _M0FP314vlmkit_2dsites4maps4main12zoom__centre(-1);
    }
    _M0FP314vlmkit_2dsites4maps4main11ev__prevent(e);
  }
  function _M0FP314vlmkit_2dsites4maps4main9map__view() {
    const pins = [];
    const _bind = _M0FP314vlmkit_2dsites4maps4main6places.length;
    let _tmp = 0;
    while (true) {
      const _ = _tmp;
      if (_ < _bind) {
        const p = _M0FP314vlmkit_2dsites4maps4main6places[_];
        _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(pins, _M0FP314vlmkit_2dsites4maps4main15cluster__button(p));
        _tmp = _ + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    const _bind$2 = _M0FP314vlmkit_2dsites4maps4main6places.length;
    let _tmp$2 = 0;
    while (true) {
      const _ = _tmp$2;
      if (_ < _bind$2) {
        const p = _M0FP314vlmkit_2dsites4maps4main6places[_];
        _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(pins, _M0FP314vlmkit_2dsites4maps4main11pin__button(p));
        _tmp$2 = _ + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return _M0FP36mizchi4luna3dom3div(_M0FP314vlmkit_2dsites4maps4main9map__viewN6constrS4360, undefined, undefined, () => {
      const l = ["default", "transit", "terrain"];
      const d = _M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4maps4main8dragging) ? " dragging" : "";
      const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(15);
      _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, "map lvl-");
      _M0MPB13StringBuilder13write__objectGiE(_string_builder, _M0FP314vlmkit_2dsites4maps4main5level());
      _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, " layer-");
      _M0MPB13StringBuilder13write__objectGsE(_string_builder, _M0MPC15array5Array2atGUsiEE(l, _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4maps4main5layer)));
      _M0MPB13StringBuilder13write__objectGsE(_string_builder, d);
      return _string_builder.val;
    }, () => {
      const s = _M0FP314vlmkit_2dsites4maps4main9scale__of(_M0MP26mizchi7signals6Signal3getGRP314vlmkit_2dsites4maps4main4ViewE(_M0FP314vlmkit_2dsites4maps4main4view).z);
      const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(5);
      _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, "--k: ");
      _M0MPB13StringBuilder13write__objectGsE(_string_builder, _M0FP314vlmkit_2dsites4maps4main4fmt2(s));
      return _string_builder.val;
    }, new _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4Some(_M0MP36mizchi4luna3dom10HandlerMap7keydown(_M0MP36mizchi4luna3dom10HandlerMap8dblclick(_M0MP36mizchi4luna3dom10HandlerMap13pointercancel(_M0MP36mizchi4luna3dom10HandlerMap9pointerup(_M0MP36mizchi4luna3dom10HandlerMap11pointermove(_M0MP36mizchi4luna3dom10HandlerMap11pointerdown(_M0FP36mizchi4luna3dom6events(), (e) => {
      const e$2 = e;
      if (_M0FP314vlmkit_2dsites4maps4main10target__in(e$2, "button, a, input, .no-drag") || _M0FP314vlmkit_2dsites4maps4main7ev__num(e$2, "button") !== 0) {
        return undefined;
      }
      _M0FP314vlmkit_2dsites4maps4main8drag__on.val = true;
      _M0FP314vlmkit_2dsites4maps4main11drag__moved.val = 0;
      _M0FP314vlmkit_2dsites4maps4main10drag__last.val = { _0: _M0FP314vlmkit_2dsites4maps4main7ev__num(e$2, "clientX"), _1: _M0FP314vlmkit_2dsites4maps4main7ev__num(e$2, "clientY") };
      const _bind$3 = _M0FP314vlmkit_2dsites4maps4main7map__el.val;
      if (_bind$3.$tag === 1) {
        const _Some = _bind$3;
        const _el = _Some._0;
        _M0FP314vlmkit_2dsites4maps4main7capture(_el, e$2);
      }
      _M0FP314vlmkit_2dsites4maps4main11anim__token.val = _M0FP314vlmkit_2dsites4maps4main11anim__token.val + 1 | 0;
      _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4maps4main12layers__open, false);
    }), (e) => {
      if (!_M0FP314vlmkit_2dsites4maps4main8drag__on.val) {
        return undefined;
      }
      const e$2 = e;
      const x = _M0FP314vlmkit_2dsites4maps4main7ev__num(e$2, "clientX");
      const y = _M0FP314vlmkit_2dsites4maps4main7ev__num(e$2, "clientY");
      const _bind$3 = _M0FP314vlmkit_2dsites4maps4main10drag__last.val;
      const _lx = _bind$3._0;
      const _ly = _bind$3._1;
      _M0FP314vlmkit_2dsites4maps4main10drag__last.val = { _0: x, _1: y };
      _M0FP314vlmkit_2dsites4maps4main11drag__moved.val = _M0FP314vlmkit_2dsites4maps4main11drag__moved.val + Math.abs(x - _lx) + Math.abs(y - _ly);
      if (_M0FP314vlmkit_2dsites4maps4main11drag__moved.val > 3) {
        _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4maps4main8dragging, true);
      }
      const v = _M0MP26mizchi7signals6Signal3getGRP314vlmkit_2dsites4maps4main4ViewE(_M0FP314vlmkit_2dsites4maps4main4view);
      const s = _M0FP314vlmkit_2dsites4maps4main9scale__of(v.z);
      _M0MP26mizchi7signals6Signal3setGRP314vlmkit_2dsites4maps4main4ViewE(_M0FP314vlmkit_2dsites4maps4main4view, _M0FP314vlmkit_2dsites4maps4main11clamp__view(new _M0TP314vlmkit_2dsites4maps4main4View(v.cx - (x - _lx) / s, v.cy - (y - _ly) / s, v.z)));
    }), (e) => {
      if (!_M0FP314vlmkit_2dsites4maps4main8drag__on.val) {
        return undefined;
      }
      _M0FP314vlmkit_2dsites4maps4main8drag__on.val = false;
      _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4maps4main8dragging, false);
      const _bind$3 = _M0FP314vlmkit_2dsites4maps4main7map__el.val;
      if (_bind$3.$tag === 1) {
        const _Some = _bind$3;
        const _el = _Some._0;
        _M0FP314vlmkit_2dsites4maps4main7release(_el, e);
      }
      _M0FP314vlmkit_2dsites4maps4main9sync__url();
    }), (_e) => {
      _M0FP314vlmkit_2dsites4maps4main8drag__on.val = false;
      _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4maps4main8dragging, false);
    }), (e) => {
      const e$2 = e;
      if (_M0FP314vlmkit_2dsites4maps4main10target__in(e$2, "button, a, input, .no-drag")) {
        return undefined;
      }
      const _bind$3 = _M0FP314vlmkit_2dsites4maps4main10map__local(e$2);
      const _x = _bind$3._0;
      const _y = _bind$3._1;
      _M0FP314vlmkit_2dsites4maps4main8zoom__at(_x, _y, 1);
    }), (e) => {
      _M0FP314vlmkit_2dsites4maps4main12map__keydown(e);
    })), (el) => {
      _M0FP314vlmkit_2dsites4maps4main7map__el.val = new _M0DTPC16option6OptionGRP26mizchi8js__core3AnyE4Some(el);
    }, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("role", "region"), _M0FP314vlmkit_2dsites4maps4main2sa("aria-label", "Map of Port Lumen"), _M0FP314vlmkit_2dsites4maps4main2sa("aria-describedby", "map-help"), _M0FP314vlmkit_2dsites4maps4main2sa("tabindex", "0")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom1p(_M0FP314vlmkit_2dsites4maps4main9map__viewN6constrS4361, _M0FP314vlmkit_2dsites4maps4main9map__viewN6constrS4362, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4text("Use the arrow keys to pan, plus and minus to zoom, and Home to reset the view. Drag to pan; scroll or double-click to zoom. Tab moves to the places on the map.")]), _M0FP36mizchi4luna3dom3svg(_M0FP314vlmkit_2dsites4maps4main9map__viewN6constrS4363, _M0FP314vlmkit_2dsites4maps4main9map__viewN6constrS4364, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("data-k", "world"), _M0FP314vlmkit_2dsites4maps4main2sa("aria-hidden", "true"), _M0FP314vlmkit_2dsites4maps4main2sa("focusable", "false")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP314vlmkit_2dsites4maps4main12world__layer()]), _M0FP314vlmkit_2dsites4maps4main13labels__layer(), _M0FP36mizchi4luna3dom3div(undefined, _M0FP314vlmkit_2dsites4maps4main9map__viewN6constrS4365, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, pins)]);
  }
  function _M0FP314vlmkit_2dsites4maps4main11wire__wheel() {
    const _bind = _M0FP314vlmkit_2dsites4maps4main7map__el.val;
    if (_bind.$tag === 1) {
      const _Some = _bind;
      const _el = _Some._0;
      _M0FP314vlmkit_2dsites4maps4main6on__el(_el, "wheel", (e) => {
        _M0FP314vlmkit_2dsites4maps4main11ev__prevent(e);
        const dy = _M0FP314vlmkit_2dsites4maps4main7ev__num(e, "deltaY");
        if (dy === 0) {
          return undefined;
        }
        const _bind$2 = _M0FP314vlmkit_2dsites4maps4main10map__local(e);
        const _x = _bind$2._0;
        const _y = _bind$2._1;
        _M0FP314vlmkit_2dsites4maps4main8zoom__at(_x, _y, dy < 0 ? 0.5 : -0.5);
      });
      return;
    } else {
      return;
    }
  }
  function _M0FP314vlmkit_2dsites4maps4main10scale__bar() {
    const s = _M0FP314vlmkit_2dsites4maps4main9scale__of(_M0MP26mizchi7signals6Signal3getGRP314vlmkit_2dsites4maps4main4ViewE(_M0FP314vlmkit_2dsites4maps4main4view).z);
    const steps = [20, 50, 100, 200, 500, 1000, 2000];
    let pick = _M0MPC15array5Array2atGdE(steps, 0);
    const _bind = steps.length;
    let _tmp = 0;
    while (true) {
      const _ = _tmp;
      if (_ < _bind) {
        const d = steps[_];
        if (d * s <= 110) {
          pick = d;
        }
        _tmp = _ + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return { _0: pick * s, _1: _M0FP314vlmkit_2dsites4maps4main11dist__label(pick) };
  }
  function _M0FP314vlmkit_2dsites4maps4main4rail() {
    return _M0FP36mizchi4luna3dom3nav(undefined, _M0FP314vlmkit_2dsites4maps4main4railN6constrS4421, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("aria-label", "Wayfarer Maps")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom3div(undefined, _M0FP314vlmkit_2dsites4maps4main4railN6constrS4422, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom3svg(_M0FP314vlmkit_2dsites4maps4main4railN6constrS4423, _M0FP314vlmkit_2dsites4maps4main4railN6constrS4424, _M0FP314vlmkit_2dsites4maps4main4railN6constrS4425, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("aria-hidden", "true"), _M0FP314vlmkit_2dsites4maps4main2sa("focusable", "false")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom11svg__circle(_M0FP314vlmkit_2dsites4maps4main4railN6constrS4426, _M0FP314vlmkit_2dsites4maps4main4railN6constrS4427, _M0FP314vlmkit_2dsites4maps4main4railN6constrS4428, _M0FP314vlmkit_2dsites4maps4main4railN6constrS4429, undefined, undefined, undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__), _M0FP36mizchi4luna3dom9svg__path(_M0FP314vlmkit_2dsites4maps4main4railN6constrS4430, _M0FP314vlmkit_2dsites4maps4main4railN6constrS4431, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__)]), _M0FP36mizchi4luna3dom4span(undefined, _M0FP314vlmkit_2dsites4maps4main4railN6constrS4432, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4text("Wayfarer Maps")])]), _M0FP36mizchi4luna3dom6button(-1, undefined, _M0FP314vlmkit_2dsites4maps4main4railN6constrS4433, undefined, undefined, undefined, undefined, new _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4Some(_M0MP36mizchi4luna3dom10HandlerMap5click(_M0FP36mizchi4luna3dom6events(), (_e) => {
      _M0FP314vlmkit_2dsites4maps4main11open__panel(4);
    })), undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("type", "button")]), new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4Some([_M0FP314vlmkit_2dsites4maps4main2da("aria-current", () => _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4maps4main5panel) === 4 ? "true" : "false")]), [_M0FP36mizchi4luna3dom4span(undefined, _M0FP314vlmkit_2dsites4maps4main4railN6constrS4434, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP314vlmkit_2dsites4maps4main12icon_2einner(_M0FP314vlmkit_2dsites4maps4main9ic__saved, 20, "2")]), _M0FP36mizchi4luna3dom4text("Saved")]), _M0FP36mizchi4luna3dom6button(-1, undefined, _M0FP314vlmkit_2dsites4maps4main4railN6constrS4435, undefined, undefined, undefined, undefined, new _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4Some(_M0MP36mizchi4luna3dom10HandlerMap5click(_M0FP36mizchi4luna3dom6events(), (_e) => {
      _M0FP314vlmkit_2dsites4maps4main16open__directions(_M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4maps4main8selected));
    })), undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("type", "button")]), new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4Some([_M0FP314vlmkit_2dsites4maps4main2da("aria-current", () => _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4maps4main5panel) === 3 ? "true" : "false")]), [_M0FP36mizchi4luna3dom4span(undefined, _M0FP314vlmkit_2dsites4maps4main4railN6constrS4436, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP314vlmkit_2dsites4maps4main16directions__icon(22)]), _M0FP36mizchi4luna3dom4text("Directions")])]);
  }
  function _M0FP314vlmkit_2dsites4maps4main12sheet__title() {
    const _bind = _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4maps4main5panel);
    switch (_bind) {
      case 1: {
        const n = _M0FP314vlmkit_2dsites4maps4main7results().length;
        const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(5);
        _M0MPB13StringBuilder13write__objectGsE(_string_builder, _M0MP26mizchi7signals6Signal3getGRP314vlmkit_2dsites4maps4main4ViewE(_M0FP314vlmkit_2dsites4maps4main5query).label);
        _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, " · ");
        _M0MPB13StringBuilder13write__objectGiE(_string_builder, n);
        _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, " ");
        return `${_string_builder.val}${n === 1 ? "place" : "places"}`;
      }
      case 2: {
        const s = _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4maps4main8selected);
        return s >= 0 ? _M0MPC15array5Array2atGUsiEE(_M0FP314vlmkit_2dsites4maps4main6places, s).name : "Place";
      }
      case 3: {
        return "Directions";
      }
      case 4: {
        return "Saved";
      }
      default: {
        return "";
      }
    }
  }
  function _M0FP314vlmkit_2dsites4maps4main13sheet__handle() {
    const names = ["peek", "half", "full"];
    return _M0FP36mizchi4luna3dom6button(-1, undefined, _M0FP314vlmkit_2dsites4maps4main13sheet__handleN6constrS4443, undefined, undefined, undefined, undefined, new _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4Some(_M0MP36mizchi4luna3dom10HandlerMap5click(_M0MP36mizchi4luna3dom10HandlerMap13pointercancel(_M0MP36mizchi4luna3dom10HandlerMap9pointerup(_M0MP36mizchi4luna3dom10HandlerMap11pointermove(_M0MP36mizchi4luna3dom10HandlerMap11pointerdown(_M0FP36mizchi4luna3dom6events(), (e) => {
      const e$2 = e;
      _M0FP314vlmkit_2dsites4maps4main11sheet__down.val = true;
      _M0FP314vlmkit_2dsites4maps4main12sheet__moved.val = false;
      _M0FP314vlmkit_2dsites4maps4main12sheet__start.val = { _0: _M0FP314vlmkit_2dsites4maps4main7ev__num(e$2, "clientY"), _1: _M0FP314vlmkit_2dsites4maps4main13sheet__height() };
      const t = _M0MP26mizchi8js__core3Any5__get(e$2, "currentTarget");
      _M0FP314vlmkit_2dsites4maps4main7capture(t, e$2);
    }), (e) => {
      if (!_M0FP314vlmkit_2dsites4maps4main11sheet__down.val) {
        return undefined;
      }
      const e$2 = e;
      const _bind = _M0FP314vlmkit_2dsites4maps4main12sheet__start.val;
      const _y0 = _bind._0;
      const _h0 = _bind._1;
      const dy = _M0FP314vlmkit_2dsites4maps4main7ev__num(e$2, "clientY") - _y0;
      if (Math.abs(dy) > 6) {
        _M0FP314vlmkit_2dsites4maps4main12sheet__moved.val = true;
      }
      if (_M0FP314vlmkit_2dsites4maps4main12sheet__moved.val) {
        const _p = _h0 - dy;
        const _p$2 = 96;
        const _p$3 = _M0MP26mizchi7signals6Signal3getGdE(_M0FP314vlmkit_2dsites4maps4main6map__h) - 110;
        _M0MP26mizchi7signals6Signal3setGdE(_M0FP314vlmkit_2dsites4maps4main11sheet__drag, _p < _p$2 ? _p$2 : _p > _p$3 ? _p$3 : _p);
        return;
      } else {
        return;
      }
    }), (e) => {
      if (!_M0FP314vlmkit_2dsites4maps4main11sheet__down.val) {
        return undefined;
      }
      _M0FP314vlmkit_2dsites4maps4main11sheet__down.val = false;
      const e$2 = e;
      const t = _M0MP26mizchi8js__core3Any5__get(e$2, "currentTarget");
      _M0FP314vlmkit_2dsites4maps4main7release(t, e$2);
      if (_M0FP314vlmkit_2dsites4maps4main12sheet__moved.val) {
        const h = _M0MP26mizchi7signals6Signal3getGdE(_M0FP314vlmkit_2dsites4maps4main11sheet__drag);
        const best = new _M0TPB8MutLocalGiE(0);
        let bd = 1000000000;
        let _tmp = 0;
        while (true) {
          const i = _tmp;
          if (i < 3) {
            const d = Math.abs(_M0FP314vlmkit_2dsites4maps4main12snap__height(i) - h);
            if (d < bd) {
              bd = d;
              best.val = i;
            }
            _tmp = i + 1 | 0;
            continue;
          } else {
            break;
          }
        }
        _M0FP26mizchi7signals5batchGuE(() => {
          _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4maps4main5sheet, best.val);
          _M0MP26mizchi7signals6Signal3setGdE(_M0FP314vlmkit_2dsites4maps4main11sheet__drag, -1);
        });
        return;
      } else {
        return;
      }
    }), (_e) => {
      _M0FP314vlmkit_2dsites4maps4main11sheet__down.val = false;
      _M0MP26mizchi7signals6Signal3setGdE(_M0FP314vlmkit_2dsites4maps4main11sheet__drag, -1);
    }), (_e) => {
      if (_M0FP314vlmkit_2dsites4maps4main12sheet__moved.val) {
        _M0FP314vlmkit_2dsites4maps4main12sheet__moved.val = false;
        return undefined;
      }
      _M0MP26mizchi7signals6Signal6updateGiE(_M0FP314vlmkit_2dsites4maps4main5sheet, (s) => (s + 1 | 0) % 3 | 0);
    })), undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("type", "button"), _M0FP314vlmkit_2dsites4maps4main2sa("aria-controls", "panel-scroll")]), new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4Some([_M0FP314vlmkit_2dsites4maps4main2da("aria-label", () => {
      const next = ["expand", "expand to full height", "collapse to a peek"];
      const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(13);
      _M0MPB13StringBuilder13write__objectGsE(_string_builder, _M0FP314vlmkit_2dsites4maps4main12sheet__title());
      _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, ": sheet at ");
      _M0MPB13StringBuilder13write__objectGsE(_string_builder, _M0MPC15array5Array2atGUsiEE(names, _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4maps4main5sheet)));
      _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, ", ");
      _M0MPB13StringBuilder13write__objectGsE(_string_builder, _M0MPC15array5Array2atGUsiEE(next, _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4maps4main5sheet)));
      return _string_builder.val;
    })]), [_M0FP36mizchi4luna3dom4span(undefined, _M0FP314vlmkit_2dsites4maps4main13sheet__handleN6constrS4444, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("aria-hidden", "true")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, []), _M0FP36mizchi4luna3dom4span(undefined, _M0FP314vlmkit_2dsites4maps4main13sheet__handleN6constrS4445, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom9text__dyn(_M0FP314vlmkit_2dsites4maps4main12sheet__title)])]);
  }
  function _M0FP314vlmkit_2dsites4maps4main11side__panel() {
    return _M0FP36mizchi4luna3dom8fragment([_M0FP36mizchi4luna3dom5aside(_M0FP314vlmkit_2dsites4maps4main11side__panelN6constrS4470, undefined, undefined, () => {
      let c = "panel";
      if (_M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4maps4main5panel) === 0) {
        c = `${c} none`;
      }
      if (_M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4maps4main9collapsed) && !_M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4maps4main6mobile)) {
        c = `${c} collapsed`;
      }
      if (_M0MP26mizchi7signals6Signal3getGdE(_M0FP314vlmkit_2dsites4maps4main11sheet__drag) >= 0) {
        c = `${c} sheet-dragging`;
      }
      const _tmp = c;
      const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(7);
      _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, " sheet-");
      _M0MPB13StringBuilder13write__objectGsE(_string_builder, _M0MPC15array5Array2atGUsiEE(["peek", "half", "full"], _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4maps4main5sheet)));
      return `${_tmp}${_string_builder.val}`;
    }, () => {
      if (_M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4maps4main6mobile)) {
        const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(10);
        _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, "height: ");
        _M0MPB13StringBuilder13write__objectGsE(_string_builder, _M0FP314vlmkit_2dsites4maps4main4fmt1(_M0FP314vlmkit_2dsites4maps4main13sheet__height()));
        _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, "px");
        return _string_builder.val;
      } else {
        return "";
      }
    }, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("aria-label", "Side panel")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP314vlmkit_2dsites4maps4main13sheet__handle(), _M0FP36mizchi4luna3dom3div(_M0FP314vlmkit_2dsites4maps4main11side__panelN6constrS4471, _M0FP314vlmkit_2dsites4maps4main11side__panelN6constrS4472, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4show(() => _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4maps4main5panel) === 1, _M0FP314vlmkit_2dsites4maps4main13results__view), _M0FP36mizchi4luna3dom9for__eachGiE(() => _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4maps4main5panel) === 2 && _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4maps4main8selected) >= 0 ? [_M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4maps4main8selected)] : [], (id, _i) => _M0FP314vlmkit_2dsites4maps4main11place__view(id)), _M0FP36mizchi4luna3dom4show(() => _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4maps4main5panel) === 3, _M0FP314vlmkit_2dsites4maps4main16directions__view), _M0FP36mizchi4luna3dom4show(() => _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4maps4main5panel) === 4, _M0FP314vlmkit_2dsites4maps4main11saved__view)]), _M0FP36mizchi4luna3dom4show(() => _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4maps4main5panel) === 1, () => _M0FP36mizchi4luna3dom3div(undefined, _M0FP314vlmkit_2dsites4maps4main11side__panelN6constrS4473, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom5label(undefined, undefined, _M0FP314vlmkit_2dsites4maps4main11side__panelN6constrS4474, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom5input(_M0FP314vlmkit_2dsites4maps4main11side__panelN6constrS4475, undefined, undefined, undefined, -1, -1, -1, -1, _M0FP314vlmkit_2dsites4maps4main11side__panelN6constrS4476, undefined, undefined, undefined, undefined, undefined, undefined, () => _M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4maps4main11follow__map), new _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4Some(_M0MP36mizchi4luna3dom10HandlerMap6change(_M0FP36mizchi4luna3dom6events(), (e) => {
      const t = _M0MP26mizchi8js__core3Any5__get(e, "target");
      _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4maps4main11follow__map, _M0MP26mizchi8js__core3Any5__get(t, "checked"));
    })), undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__), _M0FP36mizchi4luna3dom4text("Update results when map moves")])]))]), _M0FP36mizchi4luna3dom6button(-1, undefined, _M0FP314vlmkit_2dsites4maps4main11side__panelN6constrS4477, undefined, () => _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4maps4main5panel) === 0 ? "collapse-tab off" : _M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4maps4main9collapsed) ? "collapse-tab is-collapsed" : "collapse-tab", undefined, undefined, new _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4Some(_M0MP36mizchi4luna3dom10HandlerMap5click(_M0FP36mizchi4luna3dom6events(), (_e) => {
      _M0MP26mizchi7signals6Signal6updateGbE(_M0FP314vlmkit_2dsites4maps4main9collapsed, (c) => !c);
    })), undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("type", "button"), _M0FP314vlmkit_2dsites4maps4main2sa("aria-controls", "panel")]), new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4Some([_M0FP314vlmkit_2dsites4maps4main2da("aria-expanded", () => {
      const _p = !_M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4maps4main9collapsed);
      return _p ? "true" : "false";
    }), _M0FP314vlmkit_2dsites4maps4main2da("aria-label", () => _M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4maps4main9collapsed) ? "Expand side panel" : "Collapse side panel")]), [_M0FP36mizchi4luna3dom4span(undefined, _M0FP314vlmkit_2dsites4maps4main11side__panelN6constrS4478, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom3svg(_M0FP314vlmkit_2dsites4maps4main11side__panelN6constrS4479, _M0FP314vlmkit_2dsites4maps4main11side__panelN6constrS4480, _M0FP314vlmkit_2dsites4maps4main11side__panelN6constrS4481, undefined, _M0FP314vlmkit_2dsites4maps4main11side__panelN6constrS4482, _M0FP314vlmkit_2dsites4maps4main11side__panelN6constrS4483, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("aria-hidden", "true")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom9svg__path(undefined, undefined, undefined, _M0FP314vlmkit_2dsites4maps4main11side__panelN6constrS4484, _M0FP314vlmkit_2dsites4maps4main11side__panelN6constrS4485, _M0FP314vlmkit_2dsites4maps4main11side__panelN6constrS4486, undefined, undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4Some([_M0FP314vlmkit_2dsites4maps4main2da("d", () => _M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4maps4main9collapsed) ? _M0FP314vlmkit_2dsites4maps4main15ic__chev__right : _M0FP314vlmkit_2dsites4maps4main14ic__chev__left)]))])]), _M0FP36mizchi4luna3dom4span(undefined, _M0FP314vlmkit_2dsites4maps4main11side__panelN6constrS4487, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("aria-hidden", "true")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom9text__dyn(() => _M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4maps4main9collapsed) ? "Expand side panel" : "Collapse side panel")])])]);
  }
  function _M0FP314vlmkit_2dsites4maps4main12layer__thumb(i) {
    const water = ["#a9d3f2", "#a9d3f2", "#86bfe8"];
    const park = ["#c8e6bf", "#c8e6bf", "#97cf86"];
    const rail = ["#9aa0a6", "#6f42c1", "#9aa0a6"];
    return _M0FP36mizchi4luna3dom3svg(_M0FP314vlmkit_2dsites4maps4main12layer__thumbN6constrS4497, _M0FP314vlmkit_2dsites4maps4main12layer__thumbN6constrS4498, _M0FP314vlmkit_2dsites4maps4main12layer__thumbN6constrS4499, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("aria-hidden", "true"), _M0FP314vlmkit_2dsites4maps4main2sa("focusable", "false")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom9svg__rect(_M0FP314vlmkit_2dsites4maps4main12layer__thumbN6constrS4500, _M0FP314vlmkit_2dsites4maps4main12layer__thumbN6constrS4501, _M0FP314vlmkit_2dsites4maps4main12layer__thumbN6constrS4502, _M0FP314vlmkit_2dsites4maps4main12layer__thumbN6constrS4503, undefined, undefined, _M0FP314vlmkit_2dsites4maps4main12layer__thumbN6constrS4504, undefined, undefined, undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__), _M0FP36mizchi4luna3dom9svg__path(_M0FP314vlmkit_2dsites4maps4main12layer__thumbN6constrS4505, _M0MPC15array5Array2atGUsiEE(water, i), undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__), _M0FP36mizchi4luna3dom9svg__rect(_M0FP314vlmkit_2dsites4maps4main12layer__thumbN6constrS4506, _M0FP314vlmkit_2dsites4maps4main12layer__thumbN6constrS4507, _M0FP314vlmkit_2dsites4maps4main12layer__thumbN6constrS4508, _M0FP314vlmkit_2dsites4maps4main12layer__thumbN6constrS4509, _M0FP314vlmkit_2dsites4maps4main12layer__thumbN6constrS4510, undefined, _M0MPC15array5Array2atGUsiEE(park, i), undefined, undefined, undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__), _M0FP36mizchi4luna3dom9svg__path(_M0FP314vlmkit_2dsites4maps4main12layer__thumbN6constrS4511, undefined, _M0FP314vlmkit_2dsites4maps4main12layer__thumbN6constrS4512, _M0FP314vlmkit_2dsites4maps4main12layer__thumbN6constrS4513, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__), _M0FP36mizchi4luna3dom9svg__path(_M0FP314vlmkit_2dsites4maps4main12layer__thumbN6constrS4514, undefined, _M0FP314vlmkit_2dsites4maps4main12layer__thumbN6constrS4515, _M0FP314vlmkit_2dsites4maps4main12layer__thumbN6constrS4516, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__), _M0FP36mizchi4luna3dom9svg__path(_M0FP314vlmkit_2dsites4maps4main12layer__thumbN6constrS4517, undefined, _M0MPC15array5Array2atGUsiEE(rail, i), i === 1 ? "3.5" : "2", undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("stroke-dasharray", "4 3")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__)]);
  }
  function _M0FP314vlmkit_2dsites4maps4main15layers__control() {
    const names = ["Default", "Transit", "Terrain"];
    const opts = [];
    const _bind = names.length;
    let _tmp = 0;
    while (true) {
      const i = _tmp;
      if (i < _bind) {
        const n = names[i];
        _M0MPC15array5Array4pushGRP314vlmkit_2dsites4maps4main6ReviewE(opts, _M0FP36mizchi4luna3dom6button(-1, undefined, _M0FP314vlmkit_2dsites4maps4main15layers__controlN6constrS4522, undefined, undefined, undefined, undefined, new _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4Some(_M0MP36mizchi4luna3dom10HandlerMap5click(_M0FP36mizchi4luna3dom6events(), (_e) => {
          _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4maps4main5layer, i);
        })), undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("type", "button")]), new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4Some([_M0FP314vlmkit_2dsites4maps4main2da("aria-pressed", () => {
          const _p = _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4maps4main5layer) === i;
          return _p ? "true" : "false";
        })]), [_M0FP314vlmkit_2dsites4maps4main12layer__thumb(i), _M0FP36mizchi4luna3dom4span(undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4text(n)])]));
        _tmp = i + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return _M0FP36mizchi4luna3dom3div(undefined, _M0FP314vlmkit_2dsites4maps4main15layers__controlN6constrS4523, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom6button(-1, _M0FP314vlmkit_2dsites4maps4main15layers__controlN6constrS4524, _M0FP314vlmkit_2dsites4maps4main15layers__controlN6constrS4525, undefined, undefined, undefined, undefined, new _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4Some(_M0MP36mizchi4luna3dom10HandlerMap7keydown(_M0MP36mizchi4luna3dom10HandlerMap5click(_M0FP36mizchi4luna3dom6events(), (_e) => {
      const o = !_M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4maps4main12layers__open);
      _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4maps4main12layers__open, o);
    }), (e) => {
      if (_M0FP314vlmkit_2dsites4maps4main7ev__str(e, "key") === "Escape") {
        _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4maps4main12layers__open, false);
        return;
      } else {
        return;
      }
    })), undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("type", "button"), _M0FP314vlmkit_2dsites4maps4main2sa("aria-controls", "layers-pop")]), new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4Some([_M0FP314vlmkit_2dsites4maps4main2da("aria-expanded", () => {
      const _p = _M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4maps4main12layers__open);
      return _p ? "true" : "false";
    })]), [_M0FP36mizchi4luna3dom4span(undefined, _M0FP314vlmkit_2dsites4maps4main15layers__controlN6constrS4526, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom9for__eachGiE(() => [_M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4maps4main5layer) === 0 ? 1 : 0], (i, _k) => _M0FP314vlmkit_2dsites4maps4main12layer__thumb(i))]), _M0FP36mizchi4luna3dom4span(undefined, _M0FP314vlmkit_2dsites4maps4main15layers__controlN6constrS4527, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4text("Layers")])]), _M0FP36mizchi4luna3dom3div(_M0FP314vlmkit_2dsites4maps4main15layers__controlN6constrS4528, undefined, undefined, () => _M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4maps4main12layers__open) ? "layers-pop" : "layers-pop off", undefined, new _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4Some(_M0MP36mizchi4luna3dom10HandlerMap7keydown(_M0FP36mizchi4luna3dom6events(), (e) => {
      if (_M0FP314vlmkit_2dsites4maps4main7ev__str(e, "key") === "Escape") {
        _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4maps4main12layers__open, false);
        _M0FP314vlmkit_2dsites4maps4main9focus__id("layers-btn");
        return;
      } else {
        return;
      }
    })), undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("role", "group"), _M0FP314vlmkit_2dsites4maps4main2sa("aria-label", "Map layers")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, opts)]);
  }
  function _M0FP314vlmkit_2dsites4maps4main13map__controls() {
    return _M0FP36mizchi4luna3dom3div(undefined, _M0FP314vlmkit_2dsites4maps4main13map__controlsN6constrS4542, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom3div(undefined, _M0FP314vlmkit_2dsites4maps4main13map__controlsN6constrS4543, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom6button(-1, undefined, _M0FP314vlmkit_2dsites4maps4main13map__controlsN6constrS4544, undefined, undefined, undefined, undefined, new _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4Some(_M0MP36mizchi4luna3dom10HandlerMap5click(_M0FP36mizchi4luna3dom6events(), (_e) => {
      _M0FP314vlmkit_2dsites4maps4main12zoom__centre(1);
    })), undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("type", "button"), _M0FP314vlmkit_2dsites4maps4main2sa("aria-label", "Zoom in")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP314vlmkit_2dsites4maps4main12icon_2einner(_M0FP314vlmkit_2dsites4maps4main8ic__plus, 22, "2")]), _M0FP36mizchi4luna3dom4span(undefined, _M0FP314vlmkit_2dsites4maps4main13map__controlsN6constrS4545, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("aria-hidden", "true")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, []), _M0FP36mizchi4luna3dom6button(-1, undefined, _M0FP314vlmkit_2dsites4maps4main13map__controlsN6constrS4546, undefined, undefined, undefined, undefined, new _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4Some(_M0MP36mizchi4luna3dom10HandlerMap5click(_M0FP36mizchi4luna3dom6events(), (_e) => {
      _M0FP314vlmkit_2dsites4maps4main12zoom__centre(-1);
    })), undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("type", "button"), _M0FP314vlmkit_2dsites4maps4main2sa("aria-label", "Zoom out")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP314vlmkit_2dsites4maps4main12icon_2einner(_M0FP314vlmkit_2dsites4maps4main9ic__minus, 22, "2")])])]);
  }
  function _M0FP314vlmkit_2dsites4maps4main9foot__bar() {
    return _M0FP36mizchi4luna3dom3div(undefined, _M0FP314vlmkit_2dsites4maps4main9foot__barN6constrS4549, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom1p(undefined, _M0FP314vlmkit_2dsites4maps4main9foot__barN6constrS4550, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4text("Port Lumen · a fictional city drawn for Wayfarer Maps")]), _M0FP36mizchi4luna3dom3div(undefined, _M0FP314vlmkit_2dsites4maps4main9foot__barN6constrS4551, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("aria-label", "Map scale")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4span(undefined, _M0FP314vlmkit_2dsites4maps4main9foot__barN6constrS4552, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom9text__dyn(() => _M0FP314vlmkit_2dsites4maps4main10scale__bar()._1)]), _M0FP36mizchi4luna3dom4span(undefined, _M0FP314vlmkit_2dsites4maps4main9foot__barN6constrS4553, undefined, undefined, () => {
      const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(9);
      _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, "width: ");
      _M0MPB13StringBuilder13write__objectGsE(_string_builder, _M0FP314vlmkit_2dsites4maps4main4fmt1(_M0FP314vlmkit_2dsites4maps4main10scale__bar()._0));
      _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, "px");
      return _string_builder.val;
    }, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [])])]);
  }
  function _M0FP314vlmkit_2dsites4maps4main13share__dialog() {
    return _M0FP36mizchi4luna3dom15create__element("dialog", [_M0FP314vlmkit_2dsites4maps4main13share__dialogN5tupleS4556, _M0FP314vlmkit_2dsites4maps4main13share__dialogN5tupleS4558, { _0: "__ref", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Handler((el) => {
      _M0FP314vlmkit_2dsites4maps4main9share__el.val = new _M0DTPC16option6OptionGRP26mizchi8js__core3AnyE4Some(el);
    }) }], [_M0FP36mizchi4luna3dom2h2(_M0FP314vlmkit_2dsites4maps4main13share__dialogN6constrS4559, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4text("Share")]), _M0FP36mizchi4luna3dom1p(undefined, _M0FP314vlmkit_2dsites4maps4main13share__dialogN6constrS4560, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4text("Anyone with this link sees the same place or results.")]), _M0FP36mizchi4luna3dom5label(_M0FP314vlmkit_2dsites4maps4main13share__dialogN6constrS4561, undefined, _M0FP314vlmkit_2dsites4maps4main13share__dialogN6constrS4562, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4text("Link")]), _M0FP36mizchi4luna3dom3div(undefined, _M0FP314vlmkit_2dsites4maps4main13share__dialogN6constrS4563, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom5input(_M0FP314vlmkit_2dsites4maps4main13share__dialogN6constrS4564, undefined, undefined, undefined, -1, _M0FP314vlmkit_2dsites4maps4main13share__dialogN6constrS4565, -1, -1, _M0FP314vlmkit_2dsites4maps4main13share__dialogN6constrS4566, undefined, undefined, undefined, undefined, () => _M0MP26mizchi7signals6Signal3getGRP314vlmkit_2dsites4maps4main4ViewE(_M0FP314vlmkit_2dsites4maps4main10share__url), undefined, undefined, new _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4Some(_M0MP36mizchi4luna3dom10HandlerMap5focus(_M0FP36mizchi4luna3dom6events(), (e) => {
      _M0FP314vlmkit_2dsites4maps4main11select__all(_M0MP26mizchi8js__core3Any5__get(e, "target"));
    })), undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__), _M0FP36mizchi4luna3dom6button(-1, undefined, _M0FP314vlmkit_2dsites4maps4main13share__dialogN6constrS4567, undefined, undefined, undefined, undefined, new _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4Some(_M0MP36mizchi4luna3dom10HandlerMap5click(_M0FP36mizchi4luna3dom6events(), (_e) => {
      _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4maps4main6copied, true);
      _M0FP314vlmkit_2dsites4maps4main9focus__id("share-link");
    })), undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("type", "button")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom9text__dyn(() => _M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4maps4main6copied) ? "Copied" : "Copy link")])]), _M0FP36mizchi4luna3dom3div(undefined, _M0FP314vlmkit_2dsites4maps4main13share__dialogN6constrS4568, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom6button(-1, undefined, _M0FP314vlmkit_2dsites4maps4main13share__dialogN6constrS4569, undefined, undefined, undefined, undefined, new _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4Some(_M0MP36mizchi4luna3dom10HandlerMap5click(_M0FP36mizchi4luna3dom6events(), (_e) => {
      const _bind = _M0FP314vlmkit_2dsites4maps4main9share__el.val;
      if (_bind.$tag === 1) {
        const _Some = _bind;
        const _el = _Some._0;
        _M0FP314vlmkit_2dsites4maps4main13dialog__close(_el);
        return;
      } else {
        return;
      }
    })), undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("type", "button")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4text("Close")])])]);
  }
  function _M0FP314vlmkit_2dsites4maps4main11toast__view() {
    return _M0FP36mizchi4luna3dom3div(undefined, _M0FP314vlmkit_2dsites4maps4main11toast__viewN6constrS4577, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("role", "status"), _M0FP314vlmkit_2dsites4maps4main2sa("aria-live", "polite")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4show(() => {
      const _p = _M0MP26mizchi7signals6Signal3getGRP314vlmkit_2dsites4maps4main4ViewE(_M0FP314vlmkit_2dsites4maps4main5toast);
      const _p$2 = "";
      return !(_p === _p$2);
    }, () => _M0FP36mizchi4luna3dom3div(undefined, _M0FP314vlmkit_2dsites4maps4main11toast__viewN6constrS4578, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4span(undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom9text__dyn(() => _M0MP26mizchi7signals6Signal3getGRP314vlmkit_2dsites4maps4main4ViewE(_M0FP314vlmkit_2dsites4maps4main5toast))]), _M0FP36mizchi4luna3dom6button(-1, undefined, _M0FP314vlmkit_2dsites4maps4main11toast__viewN6constrS4579, undefined, undefined, undefined, undefined, new _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4Some(_M0MP36mizchi4luna3dom10HandlerMap5click(_M0FP36mizchi4luna3dom6events(), (_e) => {
      _M0MP26mizchi7signals6Signal3setGRP314vlmkit_2dsites4maps4main4ViewE(_M0FP314vlmkit_2dsites4maps4main5toast, "");
    })), undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4maps4main2sa("type", "button"), _M0FP314vlmkit_2dsites4maps4main2sa("aria-label", "Dismiss")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP314vlmkit_2dsites4maps4main12icon_2einner(_M0FP314vlmkit_2dsites4maps4main9ic__close, 18, "2")])]))]);
  }
  function _M0FP314vlmkit_2dsites4maps4main3app() {
    return _M0FP36mizchi4luna3dom3div(undefined, undefined, undefined, () => {
      let c = "shell";
      if (_M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4maps4main6mobile)) {
        c = `${c} is-mobile`;
      }
      if (_M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4maps4main5panel) !== 0 && !_M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4maps4main9collapsed)) {
        c = `${c} has-panel`;
      }
      const _tmp = c;
      const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(14);
      _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, " pm-");
      _M0MPB13StringBuilder13write__objectGiE(_string_builder, _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4maps4main5panel));
      _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, " sheet-at-");
      _M0MPB13StringBuilder13write__objectGiE(_string_builder, _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4maps4main5sheet));
      return `${_tmp}${_string_builder.val}`;
    }, () => {
      const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(13);
      _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, "--sheet-h: ");
      _M0MPB13StringBuilder13write__objectGsE(_string_builder, _M0FP314vlmkit_2dsites4maps4main4fmt1(_M0FP314vlmkit_2dsites4maps4main13sheet__height()));
      _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, "px");
      return _string_builder.val;
    }, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP314vlmkit_2dsites4maps4main4rail(), _M0FP36mizchi4luna3dom6main__(undefined, _M0FP314vlmkit_2dsites4maps4main3appN6constrS4581, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom2h1(undefined, _M0FP314vlmkit_2dsites4maps4main3appN6constrS4582, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4text("Wayfarer Maps: Port Lumen")]), _M0FP314vlmkit_2dsites4maps4main9map__view(), _M0FP314vlmkit_2dsites4maps4main13map__controls(), _M0FP314vlmkit_2dsites4maps4main15layers__control(), _M0FP314vlmkit_2dsites4maps4main9foot__bar(), _M0FP314vlmkit_2dsites4maps4main11toast__view()]), _M0FP314vlmkit_2dsites4maps4main11side__panel(), _M0FP36mizchi4luna3dom3div(undefined, _M0FP314vlmkit_2dsites4maps4main3appN6constrS4583, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP314vlmkit_2dsites4maps4main11search__box(), _M0FP314vlmkit_2dsites4maps4main10chips__row()]), _M0FP314vlmkit_2dsites4maps4main13share__dialog()]);
  }
  function _M0FP314vlmkit_2dsites4maps4main7measure() {
    const w = _M0FP314vlmkit_2dsites4maps4main6win__w();
    const m = w < 768;
    let mw;
    let mh;
    _L: {
      const _bind = _M0FP314vlmkit_2dsites4maps4main7map__el.val;
      if (_bind.$tag === 1) {
        const _Some = _bind;
        const _el = _Some._0;
        mw = _M0FP314vlmkit_2dsites4maps4main9el__width(_el);
        mh = _M0FP314vlmkit_2dsites4maps4main10el__height(_el);
        break _L;
      } else {
        mw = w - (m ? 0 : 72);
        mh = _M0FP314vlmkit_2dsites4maps4main6win__h();
        break _L;
      }
    }
    _M0FP26mizchi7signals5batchGuE(() => {
      _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4maps4main6mobile, m);
      _M0MP26mizchi7signals6Signal3setGdE(_M0FP314vlmkit_2dsites4maps4main6map__w, mw > 0 ? mw : w);
      _M0MP26mizchi7signals6Signal3setGdE(_M0FP314vlmkit_2dsites4maps4main6map__h, mh > 0 ? mh : _M0FP314vlmkit_2dsites4maps4main6win__h());
    });
  }
  function _M0FP314vlmkit_2dsites4maps4main9read__url() {
    const at = _M0FP314vlmkit_2dsites4maps4main10url__param("at");
    if (at === "" && _M0FP314vlmkit_2dsites4maps4main6win__w() < 768) {
      _M0MP26mizchi7signals6Signal3setGRP314vlmkit_2dsites4maps4main4ViewE(_M0FP314vlmkit_2dsites4maps4main4view, _M0FP314vlmkit_2dsites4maps4main11phone__home);
    }
    const _p = "";
    if (!(at === _p)) {
      const parts = _M0MPB4Iter9to__arrayGsE(_M0MPB4Iter3mapGRPC16string10StringViewsE(_M0MPC16string6String5split(at, _M0FP314vlmkit_2dsites4maps4main9read__urlN6recordS4595), (s) => _M0MPC16string10StringView9to__owned(s)));
      if (parts.length === 3) {
        const x = _M0FP314vlmkit_2dsites4maps4main10parse__num(_M0MPC15array5Array2atGUsiEE(parts, 0));
        const y = _M0FP314vlmkit_2dsites4maps4main10parse__num(_M0MPC15array5Array2atGUsiEE(parts, 1));
        const z = _M0FP314vlmkit_2dsites4maps4main10parse__num(_M0MPC15array5Array2atGUsiEE(parts, 2));
        if (!_M0FP314vlmkit_2dsites4maps4main7is__nan(x) && (!_M0FP314vlmkit_2dsites4maps4main7is__nan(y) && !_M0FP314vlmkit_2dsites4maps4main7is__nan(z))) {
          _M0MP26mizchi7signals6Signal3setGRP314vlmkit_2dsites4maps4main4ViewE(_M0FP314vlmkit_2dsites4maps4main4view, _M0FP314vlmkit_2dsites4maps4main11clamp__view(new _M0TP314vlmkit_2dsites4maps4main4View(x, y, z)));
        }
      }
    }
    const ly = _M0FP314vlmkit_2dsites4maps4main10url__param("layer");
    if (ly === "transit") {
      _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4maps4main5layer, 1);
    } else {
      if (ly === "terrain") {
        _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4maps4main5layer, 2);
      }
    }
    const sh = _M0FP314vlmkit_2dsites4maps4main10url__param("sheet");
    if (sh === "peek") {
      _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4maps4main5sheet, 0);
    } else {
      if (sh === "full") {
        _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4maps4main5sheet, 2);
      }
    }
    const cat = _M0FP314vlmkit_2dsites4maps4main10url__param("cat");
    const _bind = _M0FP314vlmkit_2dsites4maps4main10cat__names.length;
    let _tmp = 0;
    while (true) {
      const c = _tmp;
      if (c < _bind) {
        const n = _M0FP314vlmkit_2dsites4maps4main10cat__names[c];
        if (_M0MPC16string6String9to__lower(n) === _M0MPC16string6String9to__lower(cat)) {
          _M0FP314vlmkit_2dsites4maps4main14show__category(c);
        }
        _tmp = c + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    const dir = _M0FP314vlmkit_2dsites4maps4main10url__param("dir");
    const _p$2 = "";
    if (!(dir === _p$2)) {
      const parts = _M0MPB4Iter9to__arrayGsE(_M0MPB4Iter3mapGRPC16string10StringViewsE(_M0MPC16string6String5split(dir, _M0FP314vlmkit_2dsites4maps4main9read__urlN6recordS4596), (s) => _M0MPC16string10StringView9to__owned(s)));
      if (parts.length === 2) {
        const a = _M0MPC16double6Double7to__int(_M0FP314vlmkit_2dsites4maps4main10parse__num(_M0MPC15array5Array2atGUsiEE(parts, 0)));
        const b = _M0MPC16double6Double7to__int(_M0FP314vlmkit_2dsites4maps4main10parse__num(_M0MPC15array5Array2atGUsiEE(parts, 1)));
        if (a >= 0 && (a < _M0FP314vlmkit_2dsites4maps4main6places.length && (b >= 0 && b < _M0FP314vlmkit_2dsites4maps4main6places.length))) {
          _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4maps4main9dir__from, a);
          _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4maps4main7dir__to, b);
          _M0FP314vlmkit_2dsites4maps4main11open__panel(3);
        }
      }
    }
    const pl = _M0FP314vlmkit_2dsites4maps4main10url__param("place");
    const _p$3 = "";
    if (!(pl === _p$3)) {
      const id = _M0FP314vlmkit_2dsites4maps4main10parse__num(pl);
      if (!_M0FP314vlmkit_2dsites4maps4main7is__nan(id) && (id >= 0 && _M0MPC16double6Double7to__int(id) < _M0FP314vlmkit_2dsites4maps4main6places.length)) {
        _M0FP26mizchi7signals5batchGuE(() => {
          _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4maps4main8selected, _M0MPC16double6Double7to__int(id));
          _M0FP314vlmkit_2dsites4maps4main11open__panel(2);
        });
        const tab = _M0FP314vlmkit_2dsites4maps4main10url__param("tab");
        if (tab === "reviews") {
          _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4maps4main10place__tab, 1);
          return;
        } else {
          if (tab === "about") {
            _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4maps4main10place__tab, 2);
            return;
          } else {
            return;
          }
        }
      } else {
        return;
      }
    } else {
      return;
    }
  }
  (() => {
    const _bind = _M0MP36mizchi11js__browser3dom8Document14getElementById(_M0FP36mizchi11js__browser3dom8document(), "app");
    if (_bind.$tag === 1) {
      const _Some = _bind;
      const _el = _Some._0;
      const given_at = _M0FP314vlmkit_2dsites4maps4main10url__param("at");
      _M0FP314vlmkit_2dsites4maps4main9read__url();
      _M0FP36mizchi4luna3dom10render__to(_el, _M0FP314vlmkit_2dsites4maps4main3app());
      _M0FP314vlmkit_2dsites4maps4main7measure();
      _M0FP314vlmkit_2dsites4maps4main11anim__token.val = _M0FP314vlmkit_2dsites4maps4main11anim__token.val + 1 | 0;
      _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4maps4main9animating, false);
      const s = _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4maps4main8selected);
      if (s >= 0 && given_at === "") {
        const p = _M0MPC15array5Array2atGUsiEE(_M0FP314vlmkit_2dsites4maps4main6places, s);
        const z = _M0MP26mizchi7signals6Signal3getGRP314vlmkit_2dsites4maps4main4ViewE(_M0FP314vlmkit_2dsites4maps4main4view).z < 3 ? 3 : _M0MP26mizchi7signals6Signal3getGRP314vlmkit_2dsites4maps4main4ViewE(_M0FP314vlmkit_2dsites4maps4main4view).z;
        _M0MP26mizchi7signals6Signal3setGRP314vlmkit_2dsites4maps4main4ViewE(_M0FP314vlmkit_2dsites4maps4main4view, _M0FP314vlmkit_2dsites4maps4main11clamp__view(_M0FP314vlmkit_2dsites4maps4main11point__view(p.x, p.y, z)));
      } else {
        if (_M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4maps4main5panel) === 1 && given_at === "") {
          const _bind$2 = _M0FP314vlmkit_2dsites4maps4main12fit__results();
          if (_bind$2 === undefined) {
          } else {
            const _Some$2 = _bind$2;
            const _v = _Some$2;
            _M0MP26mizchi7signals6Signal3setGRP314vlmkit_2dsites4maps4main4ViewE(_M0FP314vlmkit_2dsites4maps4main4view, _M0FP314vlmkit_2dsites4maps4main11clamp__view(_v));
          }
        }
      }
      _M0FP314vlmkit_2dsites4maps4main9sync__url();
      _M0FP314vlmkit_2dsites4maps4main11wire__wheel();
      _M0FP314vlmkit_2dsites4maps4main10on__window("resize", (_e) => {
        _M0FP314vlmkit_2dsites4maps4main7measure();
      });
      _M0FP314vlmkit_2dsites4maps4main10on__window("pointerdown", (e) => {
        if (_M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4maps4main12layers__open) && !_M0FP314vlmkit_2dsites4maps4main10target__in(e, ".layers")) {
          _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4maps4main12layers__open, false);
        }
        if (_M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4maps4main10sort__open) && !_M0FP314vlmkit_2dsites4maps4main10target__in(e, ".sort")) {
          _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4maps4main10sort__open, false);
          return;
        } else {
          return;
        }
      });
      _M0FP314vlmkit_2dsites4maps4main10on__window("keydown", (e) => {
        let _tmp;
        if (_M0FP314vlmkit_2dsites4maps4main7ev__str(e, "key") === "Escape") {
          const _p = _M0MP26mizchi7signals6Signal3getGRP314vlmkit_2dsites4maps4main4ViewE(_M0FP314vlmkit_2dsites4maps4main5toast);
          const _p$2 = "";
          _tmp = !(_p === _p$2);
        } else {
          _tmp = false;
        }
        if (_tmp) {
          _M0MP26mizchi7signals6Signal3setGRP314vlmkit_2dsites4maps4main4ViewE(_M0FP314vlmkit_2dsites4maps4main5toast, "");
          return;
        } else {
          return;
        }
      });
      const _bind$2 = _M0FP314vlmkit_2dsites4maps4main9share__el.val;
      if (_bind$2.$tag === 1) {
        const _Some$2 = _bind$2;
        const _d = _Some$2._0;
        _M0FP314vlmkit_2dsites4maps4main6on__el(_d, "close", (_e) => {
          _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4maps4main6copied, false);
        });
        return;
      } else {
        return;
      }
    } else {
      return;
    }
  })();
})();
