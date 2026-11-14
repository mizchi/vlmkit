// Built from src/ (MoonBit, mizchi/luna) by `node examples/sites/luna-build.mjs chat`. Do not edit.
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
  function _M0TP314vlmkit_2dsites4chat4main5Model(param0, param1, param2) {
    this.id = param0;
    this.name = param1;
    this.desc = param2;
  }
  function _M0TP314vlmkit_2dsites4chat4main10Suggestion(param0, param1, param2) {
    this.title = param0;
    this.detail = param1;
    this.prompt = param2;
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
  function _M0TPC16string10StringView(param0, param1, param2) {
    this.str = param0;
    this.start = param1;
    this.end = param2;
  }
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
  const _M0FPB19js__last__index__of = (s, start, end, p) => {
    if (end - start < p.length) return -1;
    if (start === 0) return s.lastIndexOf(p, end - p.length);
    const i = s.substring(start, end).lastIndexOf(p);
    return i < 0 ? i : start + i;
  };
  const _M0MPB7JSArray4push = (arr, val) => { arr.push(val); };
  function _M0TPB4IterGsE(param0, param1) {
    this.f = param0;
    this.size_hint = param1;
  }
  function _M0TPB8MutLocalGORPC16string10StringViewE(param0) {
    this.val = param0;
  }
  function _M0TPB9ArrayViewGRP314vlmkit_2dsites4chat4main4ConvE(param0, param1, param2) {
    this.buf = param0;
    this.start = param1;
    this.end = param2;
  }
  const _M0MPB7JSArray4copy = (arr) => arr.slice(0);
  const _M0MPB7JSArray11set__length = (arr, len) => { arr.length = len; };
  const _M0MPB7JSArray3pop = (arr) => arr.pop();
  const _M0MPB7JSArray6splice = (arr, idx, cnt) => arr.splice(idx, cnt);
  function _M0TPB9ArrayViewGsE(param0, param1, param2) {
    this.buf = param0;
    this.start = param1;
    this.end = param2;
  }
  function _M0TPC13ref3RefGRPB5ArrayGRP36mizchi11js__browser3dom4NodeEE(param0) {
    this.val = param0;
  }
  function _M0TPC13ref3RefGiE(param0) {
    this.val = param0;
  }
  function _M0TPC13ref3RefGsE(param0) {
    this.val = param0;
  }
  function _M0TPC13ref3RefGbE(param0) {
    this.val = param0;
  }
  const _M0FP26mizchi8js__core9undefined = () => undefined;
  const _M0MP26mizchi8js__core3Any5__get = (obj, key) => obj[key];
  const _M0MP26mizchi8js__core3Any6__call = (obj, key, args) => obj[key](...args);
  const _M0FP26mizchi8js__core11is__nullish = (v) => v == null;
  const _M0FP26mizchi8js__core15ffi__wrap__sync = (op, on_ok, on_error) => { try { on_ok(op()); } catch (e) { on_error(e); } };
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
  function _M0TPC13ref3RefGOsE(param0) {
    this.val = param0;
  }
  function _M0DTPC16result6ResultGRP26mizchi8js__core3AnyRP26mizchi8js__core7JsErrorE3Err(param0) {
    this._0 = param0;
  }
  _M0DTPC16result6ResultGRP26mizchi8js__core3AnyRP26mizchi8js__core7JsErrorE3Err.prototype.$tag = 0;
  function _M0DTPC16result6ResultGRP26mizchi8js__core3AnyRP26mizchi8js__core7JsErrorE2Ok(param0) {
    this._0 = param0;
  }
  _M0DTPC16result6ResultGRP26mizchi8js__core3AnyRP26mizchi8js__core7JsErrorE2Ok.prototype.$tag = 1;
  function _M0DTPC15error5Error37mizchi_2fjs__core_2eJsError_2eJsError(param0) {
    this._0 = param0;
  }
  _M0DTPC15error5Error37mizchi_2fjs__core_2eJsError_2eJsError.prototype.$tag = 0;
  const _M0MP26mizchi8js__core3Any5__set = (obj, key, value) => { obj[key] = value };
  const _M0FP26mizchi8js__core12global__this = () => globalThis;
  const _M0FP26mizchi8js__core4null = () => null;
  const _M0FP26mizchi8js__core5equal = (a, b) => a === b;
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
  function _M0TP26mizchi7signals10CoreSignalGRPB5ArrayGRP314vlmkit_2dsites4chat4main4ConvEE(param0, param1, param2) {
    this.node = param0;
    this.current_value = param1;
    this.pending_value = param2;
  }
  function _M0TP26mizchi7signals10CoreSignalGsE(param0, param1, param2) {
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
  function _M0TP26mizchi7signals6SignalGRPB5ArrayGRP314vlmkit_2dsites4chat4main4ConvEE(param0) {
    this.inner = param0;
  }
  function _M0TP26mizchi7signals6SignalGsE(param0) {
    this.inner = param0;
  }
  function _M0TP26mizchi7signals6SignalGiE(param0) {
    this.inner = param0;
  }
  function _M0TP26mizchi7signals6SignalGbE(param0) {
    this.inner = param0;
  }
  const _M0FP26mizchi7signals16queue__microtask = (f) => queueMicrotask(f);
  function _M0TP26mizchi7signals8ComputedGRPB5ArrayGRP314vlmkit_2dsites4chat4main5BlockEE(param0, param1, param2) {
    this.node = param0;
    this.value = param1;
    this.getter = param2;
  }
  function _M0DTPC16option6OptionGRPB5ArrayGRP314vlmkit_2dsites4chat4main5BlockEE4None() {}
  _M0DTPC16option6OptionGRPB5ArrayGRP314vlmkit_2dsites4chat4main5BlockEE4None.prototype.$tag = 0;
  const _M0DTPC16option6OptionGRPB5ArrayGRP314vlmkit_2dsites4chat4main5BlockEE4None__ = new _M0DTPC16option6OptionGRPB5ArrayGRP314vlmkit_2dsites4chat4main5BlockEE4None();
  function _M0DTPC16option6OptionGRPB5ArrayGRP314vlmkit_2dsites4chat4main5BlockEE4Some(param0) {
    this._0 = param0;
  }
  _M0DTPC16option6OptionGRPB5ArrayGRP314vlmkit_2dsites4chat4main5BlockEE4Some.prototype.$tag = 1;
  function _M0TP26mizchi7signals8ComputedGbE(param0, param1, param2) {
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
  function _M0TP36mizchi4luna3dom9ItemEntryGRP314vlmkit_2dsites4chat4main3MsgE(param0, param1, param2, param3, param4) {
    this.item = param0;
    this.dom = param1;
    this.last = param2;
    this.nodes = param3;
    this.dispose = param4;
  }
  const _M0MP36mizchi4luna3dom10HandlerMap5click = (m, handler) => { m.click = handler; return m; };
  const _M0MP36mizchi4luna3dom10HandlerMap5input = (m, handler) => { m.input = handler; return m; };
  const _M0MP36mizchi4luna3dom10HandlerMap6submit = (m, handler) => { m.submit = handler; return m; };
  const _M0MP36mizchi4luna3dom10HandlerMap7keydown = (m, handler) => { m.keydown = handler; return m; };
  const _M0MP36mizchi4luna3dom10HandlerMap4blur = (m, handler) => { m.blur = handler; return m; };
  const _M0MP36mizchi4luna3dom10HandlerMap6scroll = (m, handler) => { m.scroll = handler; return m; };
  const _M0MP36mizchi4luna3dom10HandlerMap9to__attrs = (m) => Object.entries(m).map(([k, v]) => ({ _0: k, _1: { $tag: 2, _0: v } }));
  function _M0TP314vlmkit_2dsites4chat4main3Msg(param0, param1, param2, param3, param4, param5, param6, param7, param8, param9, param10) {
    this.id = param0;
    this.role = param1;
    this.text = param2;
    this.shown = param3;
    this.streaming = param4;
    this.stopped = param5;
    this.feedback = param6;
    this.reading = param7;
    this.editing = param8;
    this.copied = param9;
    this.code_copied = param10;
  }
  function _M0TP314vlmkit_2dsites4chat4main4Conv(param0, param1, param2, param3) {
    this.id = param0;
    this.title = param1;
    this.group = param2;
    this.messages = param3;
  }
  function _M0DTP314vlmkit_2dsites4chat4main5Block4Para(param0) {
    this._0 = param0;
  }
  _M0DTP314vlmkit_2dsites4chat4main5Block4Para.prototype.$tag = 0;
  function _M0DTP314vlmkit_2dsites4chat4main5Block7Heading(param0, param1) {
    this._0 = param0;
    this._1 = param1;
  }
  _M0DTP314vlmkit_2dsites4chat4main5Block7Heading.prototype.$tag = 1;
  function _M0DTP314vlmkit_2dsites4chat4main5Block7Bullets(param0) {
    this._0 = param0;
  }
  _M0DTP314vlmkit_2dsites4chat4main5Block7Bullets.prototype.$tag = 2;
  function _M0DTP314vlmkit_2dsites4chat4main5Block8Numbered(param0) {
    this._0 = param0;
  }
  _M0DTP314vlmkit_2dsites4chat4main5Block8Numbered.prototype.$tag = 3;
  function _M0DTP314vlmkit_2dsites4chat4main5Block4Code(param0, param1) {
    this._0 = param0;
    this._1 = param1;
  }
  _M0DTP314vlmkit_2dsites4chat4main5Block4Code.prototype.$tag = 4;
  function _M0DTP314vlmkit_2dsites4chat4main5Block5Table(param0, param1) {
    this._0 = param0;
    this._1 = param1;
  }
  _M0DTP314vlmkit_2dsites4chat4main5Block5Table.prototype.$tag = 5;
  function _M0DTP314vlmkit_2dsites4chat4main6Inline5Plain(param0) {
    this._0 = param0;
  }
  _M0DTP314vlmkit_2dsites4chat4main6Inline5Plain.prototype.$tag = 0;
  function _M0DTP314vlmkit_2dsites4chat4main6Inline4Bold(param0) {
    this._0 = param0;
  }
  _M0DTP314vlmkit_2dsites4chat4main6Inline4Bold.prototype.$tag = 1;
  function _M0DTP314vlmkit_2dsites4chat4main6Inline10InlineCode(param0) {
    this._0 = param0;
  }
  _M0DTP314vlmkit_2dsites4chat4main6Inline10InlineCode.prototype.$tag = 2;
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
  function _M0DTPC16option6OptionGOWEbE4None() {}
  _M0DTPC16option6OptionGOWEbE4None.prototype.$tag = 0;
  const _M0DTPC16option6OptionGOWEbE4None__ = new _M0DTPC16option6OptionGOWEbE4None();
  function _M0DTPC16option6OptionGOWEbE4Some(param0) {
    this._0 = param0;
  }
  _M0DTPC16option6OptionGOWEbE4Some.prototype.$tag = 1;
  const _M0FP092moonbitlang_2fcore_2fbuiltin_2fStringBuilder_24as_24_40moonbitlang_2fcore_2fbuiltin_2eLogger = { method_0: _M0IPB13StringBuilderPB6Logger13write__string, method_1: _M0IP016_24default__implPB6Logger16write__substringGRPB13StringBuilderE, method_2: _M0IPB13StringBuilderPB6Logger11write__view, method_3: _M0IPB13StringBuilderPB6Logger11write__char, method_4: _M0IP016_24default__implPB6Logger28write__string__interpolationGRPB13StringBuilderE, method_5: _M0IP016_24default__implPB6Logger5writeGRPB13StringBuilderE };
  const _M0MPB4Iter4nextN6constrS51GRPC16string10StringViewE = 0;
  const _M0MPB4Iter4nextN6constrS52GRPC16string10StringViewE = 0;
  const _M0MPB4Iter4nextN6constrS59GcE = 0;
  const _M0MPB4Iter4nextN6constrS60GcE = 0;
  const _M0MPB4Iter3newN6constrS85GRPC16string10StringViewE = 0;
  const _M0MPB4Iter3newN6constrS91GcE = 0;
  const _M0FP26mizchi7signals17reactive__context = new _M0TP26mizchi7signals15ReactiveContext(undefined, _M0DTPC16option6OptionGRPB5ArrayGWEuEE4None__, 0);
  const _M0FP26mizchi7signals15callback__queue = [];
  const _M0FP26mizchi7signals22callback__queue__nodes = [];
  const _M0FP36mizchi4luna3dom7svg__ns = "http://www.w3.org/2000/svg";
  const _M0FP314vlmkit_2dsites4chat4main9lunar__a1 = "Good choice of date: on the 14th the Moon is a **waxing gibbous**, about 78% lit, so it is up from mid-afternoon until well after midnight. That is ideal for a crowd. You want the terminator, the line between day and night, running across interesting terrain, because that is where craters throw long shadows.\n\n## A plan for the evening\n\n1. **Scout the park in daylight.** Find a spot with a clear view to the south-east and no street lights pointing at you.\n2. **Set up 45 minutes before dusk.** Telescopes need time to cool to the night air, or the image shimmers.\n3. **Start with the naked eye.** Point out the dark seas, the maria, before anyone looks through an eyepiece.\n4. **Run three stations.** One target per telescope, and rotate the groups every 15 minutes.\n\n## What to bring\n\n- Red-light torches, so nobody loses their night vision\n- A folding table for the eyepiece case and star charts\n- Warm drinks: a clear sky gets cold quickly\n- A printed Moon map with **Copernicus**, **Tycho** and **Plato** marked\n\nIf it clouds over, keep a backup: a short talk on why we always see the same face of the Moon goes down well with every age.";
  const _M0FP314vlmkit_2dsites4chat4main9lunar__a2 = "Here is how the three compare for lunar work. For the Moon, **magnification and steadiness** matter more than light grasp, since the target is bright.\n\n| Telescope | Aperture | Best for | Station |\n|---|---|---|---|\n| 8\" Dobsonian | 203 mm | Crater detail at 150x | Copernicus |\n| 102 mm refractor | 102 mm | Sharp, wide views | The terminator |\n| 70 mm travel scope | 70 mm | Kids, quick looks | Whole disc |\n\nThe Dobsonian is the crowd-pleaser, so give it the most interesting crater. Set the refractor on the terminator with a low-power eyepiece, and keep the small scope at the whole disc so younger visitors can find the Moon themselves.\n\nFor the schedule, this prints a rotation for any number of groups. Save it as `stations.py` and run it with Python 3:\n\n```python\nstations = [\"Copernicus\", \"The terminator\", \"Whole disc\"]\ngroups = [\"Red\", \"Blue\", \"Green\"]\nstart = 20 * 60 + 15  # 20:15, in minutes\n\nfor slot in range(len(stations)):\n    time = start + slot * 15\n    print(f\"{time // 60:02d}:{time % 60:02d}\")\n    for i, group in enumerate(groups):\n        station = stations[(i + slot) % len(stations)]\n        print(f\"  {group:<6} -> {station}\")\n```\n\nEvery group sees all three stations in 45 minutes, and nobody waits in a queue.";
  const _M0FP314vlmkit_2dsites4chat4main9lunar__q1 = "I'm hosting a lunar observation night for our astronomy club on the 14th. About 20 people, three telescopes, and a park on the edge of town. Where do I start?";
  const _M0FP314vlmkit_2dsites4chat4main9lunar__q2 = "Can you compare our three telescopes, and give me a quick script that prints a schedule for the stations?";
  const _M0FP314vlmkit_2dsites4chat4main12seed__titlesN5tupleS2437 = { _0: "Planning a lunar observation night", _1: "Today" };
  const _M0FP314vlmkit_2dsites4chat4main12seed__titlesN5tupleS2438 = { _0: "Sourdough starter schedule", _1: "Today" };
  const _M0FP314vlmkit_2dsites4chat4main12seed__titlesN5tupleS2439 = { _0: "Rewrite my cover letter intro", _1: "Today" };
  const _M0FP314vlmkit_2dsites4chat4main12seed__titlesN5tupleS2440 = { _0: "Explain CSS container queries", _1: "Previous 7 days" };
  const _M0FP314vlmkit_2dsites4chat4main12seed__titlesN5tupleS2441 = { _0: "Weekend hike packing list", _1: "Previous 7 days" };
  const _M0FP314vlmkit_2dsites4chat4main12seed__titlesN5tupleS2442 = { _0: "Python script to rename photos", _1: "Previous 7 days" };
  const _M0FP314vlmkit_2dsites4chat4main12seed__titlesN5tupleS2443 = { _0: "Gift ideas for a retired teacher", _1: "Previous 7 days" };
  const _M0FP314vlmkit_2dsites4chat4main12seed__titlesN5tupleS2444 = { _0: "Summarize the board meeting notes", _1: "Previous 7 days" };
  const _M0FP314vlmkit_2dsites4chat4main12seed__titlesN5tupleS2445 = { _0: "Learning Portuguese: first 30 days", _1: "Older" };
  const _M0FP314vlmkit_2dsites4chat4main12seed__titlesN5tupleS2446 = { _0: "Fix a leaking kitchen tap", _1: "Older" };
  const _M0FP314vlmkit_2dsites4chat4main12seed__titlesN5tupleS2447 = { _0: "Compare two used bike listings", _1: "Older" };
  const _M0FP314vlmkit_2dsites4chat4main12seed__titlesN5tupleS2448 = { _0: "Birthday party playlist", _1: "Older" };
  const _M0FP314vlmkit_2dsites4chat4main12seed__titles = [_M0FP314vlmkit_2dsites4chat4main12seed__titlesN5tupleS2437, _M0FP314vlmkit_2dsites4chat4main12seed__titlesN5tupleS2438, _M0FP314vlmkit_2dsites4chat4main12seed__titlesN5tupleS2439, _M0FP314vlmkit_2dsites4chat4main12seed__titlesN5tupleS2440, _M0FP314vlmkit_2dsites4chat4main12seed__titlesN5tupleS2441, _M0FP314vlmkit_2dsites4chat4main12seed__titlesN5tupleS2442, _M0FP314vlmkit_2dsites4chat4main12seed__titlesN5tupleS2443, _M0FP314vlmkit_2dsites4chat4main12seed__titlesN5tupleS2444, _M0FP314vlmkit_2dsites4chat4main12seed__titlesN5tupleS2445, _M0FP314vlmkit_2dsites4chat4main12seed__titlesN5tupleS2446, _M0FP314vlmkit_2dsites4chat4main12seed__titlesN5tupleS2447, _M0FP314vlmkit_2dsites4chat4main12seed__titlesN5tupleS2448];
  const _M0FP314vlmkit_2dsites4chat4main6modelsN6recordS2449 = new _M0TP314vlmkit_2dsites4chat4main5Model("swift", "Parley Swift", "Fast answers for everyday questions");
  const _M0FP314vlmkit_2dsites4chat4main6modelsN6recordS2450 = new _M0TP314vlmkit_2dsites4chat4main5Model("deep", "Parley Deep", "Slower, for harder problems");
  const _M0FP314vlmkit_2dsites4chat4main6modelsN6recordS2451 = new _M0TP314vlmkit_2dsites4chat4main5Model("mini", "Parley Mini", "Lightweight, for short drafts and edits");
  const _M0FP314vlmkit_2dsites4chat4main6models = [_M0FP314vlmkit_2dsites4chat4main6modelsN6recordS2449, _M0FP314vlmkit_2dsites4chat4main6modelsN6recordS2450, _M0FP314vlmkit_2dsites4chat4main6modelsN6recordS2451];
  const _M0FP314vlmkit_2dsites4chat4main11reply__code = "Here is a small, readable starting point. It keeps the data separate from the logic, so it is easy to extend later.\n\n```javascript\nconst stations = [\"Copernicus\", \"Tycho\", \"Plato\"];\n\nfunction rotation(groups, minutes = 15) {\n  return stations.map((station, slot) => ({\n    at: slot * minutes,\n    order: groups.map((g, i) => [g, stations[(i + slot) % stations.length]]),\n  }));\n}\n\nconsole.log(rotation([\"Red\", \"Blue\", \"Green\"]));\n```\n\nCall `rotation` with your own group names. The `minutes` argument sets how long each slot lasts.";
  const _M0FP314vlmkit_2dsites4chat4main14reply__default = "Happy to help with that. Here is how I would approach it:\n\n- **Start with the goal.** Write one sentence that says what a good result looks like.\n- **List what you already have**, and what is missing.\n- **Take the smallest next step**, then check it against the goal.\n\nIf you share a little more detail, such as who it is for and when it is due, I can make this much more specific.";
  const _M0FP314vlmkit_2dsites4chat4main11reply__list = "Here is a checklist you can work through in order:\n\n1. **Pick the date** and a backup date in case of cloud.\n2. **Book the space** and check whether you need a permit for an evening event.\n3. **Send the invitation** two weeks ahead, with what to wear and what to bring.\n4. **Confirm the equipment** the week before: telescopes, eyepieces, torches.\n5. **Check the forecast** on the morning, and post a go or no-go message by noon.\n\nKeep the list somewhere everyone helping can see it, and tick items off as they are done.";
  const _M0FP314vlmkit_2dsites4chat4main11reply__moon = "The Moon rewards patience more than equipment. A few things make the biggest difference on the night:\n\n- **Look along the terminator.** Shadows are longest there, so crater walls and mountain ranges stand out.\n- **Use low power first.** Find the target at 40x, then step up to 100x or more once it is centred.\n- **Let the eye rest.** Ask each visitor to look for a full minute; detail appears as the eye adapts.\n\nA good first target for beginners is **Copernicus**, a 93 km crater with terraced walls and a central peak.";
  const _M0FP314vlmkit_2dsites4chat4main12reply__table = "Here is a side-by-side view of the options:\n\n| Option | Strength | Trade-off |\n|---|---|---|\n| Parley Swift | Quick answers | Less depth on hard problems |\n| Parley Deep | Careful reasoning | Takes longer to reply |\n| Parley Mini | Light and short | Best for small edits |\n\nIf you are not sure, start with **Parley Swift** and switch when a question needs more thought.";
  const _M0FP314vlmkit_2dsites4chat4main6i__new = "M12 20h8M16.5 3.6a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z";
  const _M0FP314vlmkit_2dsites4chat4main7i__side = "M4 5h16v14H4zM9.5 5v14";
  const _M0FP314vlmkit_2dsites4chat4main9i__search = "M11 4.5a6.5 6.5 0 1 0 0 13a6.5 6.5 0 0 0 0-13ZM20 20l-4.2-4.2";
  const _M0FP314vlmkit_2dsites4chat4main7i__more = "M5.5 12h.01M12 12h.01M18.5 12h.01";
  const _M0FP314vlmkit_2dsites4chat4main7i__chev = "M7 10l5 5 5-5";
  const _M0FP314vlmkit_2dsites4chat4main8i__check = "M5 12.5l4.5 4.5L19 7.5";
  const _M0FP314vlmkit_2dsites4chat4main8i__share = "M12 15V4M7.5 8.5 12 4l4.5 4.5M5 14v5h14v-5";
  const _M0FP314vlmkit_2dsites4chat4main7i__plus = "M12 5v14M5 12h14";
  const _M0FP314vlmkit_2dsites4chat4main5i__up = "M12 19V6M6 11.5 12 5.5l6 6";
  const _M0FP314vlmkit_2dsites4chat4main7i__copy = "M9 9h10v10H9zM15 9V5H5v10h4";
  const _M0FP314vlmkit_2dsites4chat4main8i__regen = "M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4.5H15";
  const _M0FP314vlmkit_2dsites4chat4main7i__good = "M7.5 11v8.5h-3V11h3Zm0 0 3.8-6.5a1.8 1.8 0 0 1 2.2 1.9V10h5a1.8 1.8 0 0 1 1.8 2.1l-1.2 5.9a1.8 1.8 0 0 1-1.8 1.5H7.5";
  const _M0FP314vlmkit_2dsites4chat4main6i__bad = "M16.5 13V4.5h3V13h-3Zm0 0-3.8 6.5a1.8 1.8 0 0 1-2.2-1.9V14h-5a1.8 1.8 0 0 1-1.8-2.1l1.2-5.9a1.8 1.8 0 0 1 1.8-1.5h9.8";
  const _M0FP314vlmkit_2dsites4chat4main8i__speak = "M4.5 9.5v5h3.5l4.5 4V5.5L8 9.5H4.5ZM15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11";
  const _M0FP314vlmkit_2dsites4chat4main7i__down = "M12 5v13M6 12.5l6 6 6-6";
  const _M0FP314vlmkit_2dsites4chat4main7i__menu = "M4 7h16M4 12h16M4 17h16";
  const _M0FP314vlmkit_2dsites4chat4main8i__close = "M6.5 6.5l11 11M17.5 6.5l-11 11";
  const _M0FP314vlmkit_2dsites4chat4main9i__rename = "M16.5 3.6a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z";
  const _M0FP314vlmkit_2dsites4chat4main8i__trash = "M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 12.5h9l1-12.5";
  const _M0FP314vlmkit_2dsites4chat4main10i__archive = "M4 5h16v4H4zM5.5 9v10h13V9M10 13h4";
  const _M0FP314vlmkit_2dsites4chat4main9i__upload = "M12 15.5V4.5M7.5 9 12 4.5 16.5 9M4.5 15v4.5h15V15";
  const _M0FP314vlmkit_2dsites4chat4main7i__shot = "M4.5 8.5v-4h4M15.5 4.5h4v4M19.5 15.5v4h-4M8.5 19.5h-4v-4";
  const _M0FP314vlmkit_2dsites4chat4main6groups = ["Today", "Previous 7 days", "Older"];
  const _M0FP314vlmkit_2dsites4chat4main11suggestionsN6recordS2452 = new _M0TP314vlmkit_2dsites4chat4main10Suggestion("Plan a star party", "a checklist for 20 guests", "Plan a star party for 20 guests and give me a checklist");
  const _M0FP314vlmkit_2dsites4chat4main11suggestionsN6recordS2453 = new _M0TP314vlmkit_2dsites4chat4main10Suggestion("Write a script", "that rotates groups between stations", "Write a JavaScript function that rotates groups between stations");
  const _M0FP314vlmkit_2dsites4chat4main11suggestionsN6recordS2454 = new _M0TP314vlmkit_2dsites4chat4main10Suggestion("Compare the models", "Swift, Deep and Mini side by side", "Compare the Parley models in a table");
  const _M0FP314vlmkit_2dsites4chat4main11suggestionsN6recordS2455 = new _M0TP314vlmkit_2dsites4chat4main10Suggestion("Explain the terminator", "and why craters look sharper there", "Why do lunar craters look sharper near the terminator?");
  const _M0FP314vlmkit_2dsites4chat4main11suggestions = [_M0FP314vlmkit_2dsites4chat4main11suggestionsN6recordS2452, _M0FP314vlmkit_2dsites4chat4main11suggestionsN6recordS2453, _M0FP314vlmkit_2dsites4chat4main11suggestionsN6recordS2454, _M0FP314vlmkit_2dsites4chat4main11suggestionsN6recordS2455];
  const _M0FP314vlmkit_2dsites4chat4main6pinned = _M0FP26mizchi7signals6signalGbE(true);
  const _M0FP314vlmkit_2dsites4chat4main8scroller = _M0MPC13ref3Ref3RefGRPB5ArrayGRP36mizchi11js__browser3dom4NodeEE(_M0FP26mizchi8js__core9undefined());
  const _M0FP26mizchi7signals12batch__depth = _M0MPC13ref3Ref3RefGiE(0);
  const _M0FP26mizchi7signals6queued = _M0MPC15array5Array4makeGORP26mizchi7signals10EffectNodeE(1024, undefined);
  const _M0FP26mizchi7signals11active__sub = _M0MPC13ref3Ref3RefGRPB5ArrayGRP36mizchi11js__browser3dom4NodeEE(undefined);
  const _M0FP26mizchi7signals5cycle = _M0MPC13ref3Ref3RefGiE(0);
  const _M0FP26mizchi7signals13notify__index = _M0MPC13ref3Ref3RefGiE(0);
  const _M0FP26mizchi7signals14queued__length = _M0MPC13ref3Ref3RefGiE(0);
  const _M0FP26mizchi7signals23core__current__cleanups = _M0MPC13ref3Ref3RefGsE(_M0DTPC16option6OptionGRPB5ArrayGWEuEE4None__);
  const _M0FP36mizchi4luna3dom6buttonN6constrS2263 = new _M0DTP36mizchi4luna3dom9AttrValue6Static("true");
  const _M0FP36mizchi4luna3dom6buttonN5tupleS2264 = { _0: "disabled", _1: _M0FP36mizchi4luna3dom6buttonN6constrS2263 };
  const _M0FP314vlmkit_2dsites4chat4main10prompt__el = _M0MPC13ref3Ref3RefGRPB5ArrayGRP36mizchi11js__browser3dom4NodeEE(_M0FP26mizchi8js__core9undefined());
  const _M0MPC16string6String4trimN6recordS513 = new _M0TPC16string10StringView("\t\n\r ", 0, 4);
  const _M0MPC16string10StringView4findN6constrS250 = 0;
  const _M0FP314vlmkit_2dsites4chat4main11pick__replyN6recordS2524 = new _M0TPC16string10StringView("compare", 0, 7);
  const _M0FP314vlmkit_2dsites4chat4main11pick__replyN6recordS2525 = new _M0TPC16string10StringView("table", 0, 5);
  const _M0FP314vlmkit_2dsites4chat4main11pick__replyN6recordS2526 = new _M0TPC16string10StringView("versus", 0, 6);
  const _M0FP314vlmkit_2dsites4chat4main11pick__replyN6recordS2527 = new _M0TPC16string10StringView("code", 0, 4);
  const _M0FP314vlmkit_2dsites4chat4main11pick__replyN6recordS2528 = new _M0TPC16string10StringView("script", 0, 6);
  const _M0FP314vlmkit_2dsites4chat4main11pick__replyN6recordS2529 = new _M0TPC16string10StringView("function", 0, 8);
  const _M0FP314vlmkit_2dsites4chat4main11pick__replyN6recordS2530 = new _M0TPC16string10StringView("javascript", 0, 10);
  const _M0FP314vlmkit_2dsites4chat4main11pick__replyN6recordS2531 = new _M0TPC16string10StringView("plan", 0, 4);
  const _M0FP314vlmkit_2dsites4chat4main11pick__replyN6recordS2532 = new _M0TPC16string10StringView("list", 0, 4);
  const _M0FP314vlmkit_2dsites4chat4main11pick__replyN6recordS2533 = new _M0TPC16string10StringView("checklist", 0, 9);
  const _M0FP314vlmkit_2dsites4chat4main11pick__replyN6recordS2534 = new _M0TPC16string10StringView("steps", 0, 5);
  const _M0FP314vlmkit_2dsites4chat4main11pick__replyN6recordS2535 = new _M0TPC16string10StringView("moon", 0, 4);
  const _M0FP314vlmkit_2dsites4chat4main11pick__replyN6recordS2536 = new _M0TPC16string10StringView("lunar", 0, 5);
  const _M0FP314vlmkit_2dsites4chat4main11pick__replyN6recordS2537 = new _M0TPC16string10StringView("telescope", 0, 9);
  const _M0FP314vlmkit_2dsites4chat4main11pick__replyN6recordS2538 = new _M0TPC16string10StringView("crater", 0, 6);
  const _M0FP314vlmkit_2dsites4chat4main8next__id = _M0MPC13ref3Ref3RefGiE(1);
  const _M0FP314vlmkit_2dsites4chat4main5convs = _M0FP26mizchi7signals6signalGRPB5ArrayGRP314vlmkit_2dsites4chat4main4ConvEE(_M0FP314vlmkit_2dsites4chat4main11seed__convs());
  const _M0FP314vlmkit_2dsites4chat4main7current = _M0FP26mizchi7signals6signalGiE(-1);
  const _M0FP314vlmkit_2dsites4chat4main4busy = _M0FP26mizchi7signals6signalGbE(false);
  const _M0FP314vlmkit_2dsites4chat4main5timer = _M0MPC13ref3Ref3RefGiE(-1);
  const _M0FP314vlmkit_2dsites4chat4main6active = _M0MPC13ref3Ref3RefGRPB5ArrayGRP36mizchi11js__browser3dom4NodeEE(undefined);
  const _M0FP314vlmkit_2dsites4chat4main7instant = _M0MPC13ref3Ref3RefGbE(false);
  const _M0FP314vlmkit_2dsites4chat4main5draft = _M0FP26mizchi7signals6signalGsE("");
  const _M0FP314vlmkit_2dsites4chat4main12short__titleN6constrS2515 = 42;
  const _M0FP314vlmkit_2dsites4chat4main12short__titleN6recordS2516 = new _M0TPC16string10StringView(" ", 0, 1);
  const _M0FP314vlmkit_2dsites4chat4main10send__textN7_2abindS2541 = "Today";
  const _M0FP314vlmkit_2dsites4chat4main4logoN6constrS2690 = "28";
  const _M0FP314vlmkit_2dsites4chat4main4logoN6constrS2691 = "28";
  const _M0FP314vlmkit_2dsites4chat4main4logoN6constrS2692 = "0 0 32 32";
  const _M0FP314vlmkit_2dsites4chat4main4logoN6constrS2693 = "M6 5h20a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H15l-7 5v-5H6a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3Z";
  const _M0FP314vlmkit_2dsites4chat4main4logoN6constrS2694 = "M10 12h12M10 16.5h8";
  const _M0FP314vlmkit_2dsites4chat4main4logoN6constrS2695 = "2.2";
  const _M0FP314vlmkit_2dsites4chat4main4logoN6constrS2696 = "round";
  const _M0FP314vlmkit_2dsites4chat4main11empty__viewN6constrS3010 = "empty";
  const _M0FP314vlmkit_2dsites4chat4main11empty__viewN6constrS3011 = "greet";
  const _M0FP314vlmkit_2dsites4chat4main11empty__viewN6constrS3012 = "greet";
  const _M0FP314vlmkit_2dsites4chat4main11empty__viewN6constrS3013 = "suggestions";
  const _M0FP314vlmkit_2dsites4chat4main11empty__viewN6constrS3014 = "suggestion";
  const _M0FP314vlmkit_2dsites4chat4main11empty__viewN6constrS3015 = "sg-title";
  const _M0FP314vlmkit_2dsites4chat4main11empty__viewN6constrS3016 = "sg-detail";
  const _M0FP314vlmkit_2dsites4chat4main4iconN6constrS2681 = "20";
  const _M0FP314vlmkit_2dsites4chat4main4iconN6constrS2682 = "20";
  const _M0FP314vlmkit_2dsites4chat4main4iconN6constrS2683 = "0 0 24 24";
  const _M0FP314vlmkit_2dsites4chat4main4iconN6constrS2684 = "none";
  const _M0FP314vlmkit_2dsites4chat4main4iconN6constrS2685 = "currentColor";
  const _M0FP314vlmkit_2dsites4chat4main4iconN6constrS2686 = "1.8";
  const _M0FP314vlmkit_2dsites4chat4main4iconN6constrS2687 = "round";
  const _M0FP314vlmkit_2dsites4chat4main4iconN6constrS2688 = "round";
  const _M0FP314vlmkit_2dsites4chat4main9row__menu = _M0FP26mizchi7signals6signalGiE(-1);
  const _M0FP314vlmkit_2dsites4chat4main11model__open = _M0FP26mizchi7signals6signalGbE(false);
  const _M0FP314vlmkit_2dsites4chat4main12attach__open = _M0FP26mizchi7signals6signalGbE(false);
  const _M0FP36mizchi4luna3dom8textareaN6constrS2341 = new _M0DTP36mizchi4luna3dom9AttrValue6Static("true");
  const _M0FP36mizchi4luna3dom8textareaN5tupleS2342 = { _0: "disabled", _1: _M0FP36mizchi4luna3dom8textareaN6constrS2341 };
  const _M0FP314vlmkit_2dsites4chat4main6status = _M0FP26mizchi7signals6signalGsE("");
  const _M0FP314vlmkit_2dsites4chat4main12attach__itemN6constrS3026 = "menu-item";
  const _M0FP26mizchi7signals19effect__id__counter = _M0MPC13ref3Ref3RefGiE(0);
  const _M0FP314vlmkit_2dsites4chat4main14composer__viewN6recordS3037 = new _M0TPC16string10StringView("", 0, 0);
  const _M0FP314vlmkit_2dsites4chat4main14composer__viewN6constrS3038 = "dock";
  const _M0FP314vlmkit_2dsites4chat4main14composer__viewN6constrS3039 = "to-bottom";
  const _M0FP314vlmkit_2dsites4chat4main14composer__viewN6constrS3040 = "to-bottom";
  const _M0FP314vlmkit_2dsites4chat4main14composer__viewN6constrS3041 = "composer";
  const _M0FP314vlmkit_2dsites4chat4main14composer__viewN6constrS3042 = "Message Parley";
  const _M0FP314vlmkit_2dsites4chat4main14composer__viewN6constrS3043 = "prompt";
  const _M0FP314vlmkit_2dsites4chat4main14composer__viewN6constrS3044 = "prompt";
  const _M0FP314vlmkit_2dsites4chat4main14composer__viewN6constrS3045 = "composer-row";
  const _M0FP314vlmkit_2dsites4chat4main14composer__viewN6constrS3046 = "attach";
  const _M0FP314vlmkit_2dsites4chat4main14composer__viewN6constrS3047 = "attach-menu";
  const _M0FP314vlmkit_2dsites4chat4main14composer__viewN6constrS3048 = "menu attach-menu";
  const _M0FP314vlmkit_2dsites4chat4main14composer__viewN6constrS3049 = "send";
  const _M0FP314vlmkit_2dsites4chat4main14composer__viewN6constrS3050 = "send";
  const _M0FP314vlmkit_2dsites4chat4main14composer__viewN6constrS3051 = "stop";
  const _M0FP314vlmkit_2dsites4chat4main14composer__viewN6constrS3052 = "stop";
  const _M0FP314vlmkit_2dsites4chat4main14composer__viewN6constrS3053 = "stop-square";
  const _M0FP314vlmkit_2dsites4chat4main14composer__viewN6constrS3054 = "smallprint";
  const _M0FP314vlmkit_2dsites4chat4main11caret__nodeN6constrS2838 = "caret";
  const _M0FP314vlmkit_2dsites4chat4main14render__inlineN6constrS2840 = "ic";
  const _M0FP314vlmkit_2dsites4chat4main11table__viewN6constrS2890 = "table-wrap";
  const _M0FP314vlmkit_2dsites4chat4main10code__viewN6constrS2874 = "code-block";
  const _M0FP314vlmkit_2dsites4chat4main10code__viewN6constrS2875 = "code-head";
  const _M0FP314vlmkit_2dsites4chat4main10code__viewN6constrS2876 = "code-lang";
  const _M0FP314vlmkit_2dsites4chat4main10code__viewN6constrS2877 = "code-copy";
  const _M0FP314vlmkit_2dsites4chat4main11block__viewN6constrS2902 = "md-h";
  const _M0FP314vlmkit_2dsites4chat4main11block__viewN6constrS2903 = "md-h";
  const _M0FP314vlmkit_2dsites4chat4main11block__viewN6constrS2904 = "md-list";
  const _M0FP314vlmkit_2dsites4chat4main11block__viewN6constrS2905 = "md-list";
  const _M0FP314vlmkit_2dsites4chat4main18is__separator__rowN6recordS2590 = new _M0TPC16string10StringView("|", 0, 1);
  const _M0FP314vlmkit_2dsites4chat4main18is__separator__rowN6recordS2591 = new _M0TPC16string10StringView("---", 0, 3);
  const _M0FP314vlmkit_2dsites4chat4main13after__numberN6recordS2577 = new _M0TPC16string10StringView(". ", 0, 2);
  const _M0MPC16string10StringView4trimN6recordS506 = new _M0TPC16string10StringView("\t\n\r ", 0, 4);
  const _M0FP314vlmkit_2dsites4chat4main12table__cellsN6recordS2582 = new _M0TPC16string10StringView("|", 0, 1);
  const _M0FP314vlmkit_2dsites4chat4main12table__cellsN6recordS2583 = new _M0TPC16string10StringView("|", 0, 1);
  const _M0FP314vlmkit_2dsites4chat4main12table__cellsN6recordS2584 = new _M0TPC16string10StringView("|", 0, 1);
  const _M0FP314vlmkit_2dsites4chat4main12split__linesN6recordS2570 = new _M0TPC16string10StringView("\n", 0, 1);
  const _M0FP314vlmkit_2dsites4chat4main13parse__blocksN6recordS2595 = new _M0TPC16string10StringView(" ", 0, 1);
  const _M0FP314vlmkit_2dsites4chat4main13parse__blocksN6recordS2596 = new _M0TPC16string10StringView("```", 0, 3);
  const _M0FP314vlmkit_2dsites4chat4main13parse__blocksN6recordS2597 = new _M0TPC16string10StringView("```", 0, 3);
  const _M0FP314vlmkit_2dsites4chat4main13parse__blocksN6recordS2598 = new _M0TPC16string10StringView("\n", 0, 1);
  const _M0FP314vlmkit_2dsites4chat4main13parse__blocksN6recordS2599 = new _M0TPC16string10StringView("#", 0, 1);
  const _M0FP314vlmkit_2dsites4chat4main13parse__blocksN6recordS2600 = new _M0TPC16string10StringView("- ", 0, 2);
  const _M0FP314vlmkit_2dsites4chat4main13parse__blocksN6recordS2601 = new _M0TPC16string10StringView("- ", 0, 2);
  const _M0FP314vlmkit_2dsites4chat4main13parse__blocksN6recordS2602 = new _M0TPC16string10StringView("|", 0, 1);
  const _M0FP314vlmkit_2dsites4chat4main13parse__blocksN6recordS2603 = new _M0TPC16string10StringView("|", 0, 1);
  const _M0FP314vlmkit_2dsites4chat4main22action__button_2einnerN6constrS2930 = "act";
  const _M0FP314vlmkit_2dsites4chat4main15assistant__viewN6constrS2950 = "msg msg-assistant";
  const _M0FP314vlmkit_2dsites4chat4main15assistant__viewN6constrS2951 = "avatar";
  const _M0FP314vlmkit_2dsites4chat4main15assistant__viewN6constrS2952 = "msg-main";
  const _M0FP314vlmkit_2dsites4chat4main15assistant__viewN6constrS2953 = "md";
  const _M0FP314vlmkit_2dsites4chat4main15assistant__viewN6constrS2954 = "thinking";
  const _M0FP314vlmkit_2dsites4chat4main15assistant__viewN6constrS2955 = "stopped-note";
  const _M0FP314vlmkit_2dsites4chat4main15assistant__viewN6constrS2956 = "msg-actions";
  const _M0FP314vlmkit_2dsites4chat4main15assistant__viewN6constrS2957 = "act act-copy";
  const _M0FP314vlmkit_2dsites4chat4main15assistant__viewN6constrS2958 = "act-note";
  const _M0FP314vlmkit_2dsites4chat4main10user__viewN6constrS2981 = "msg msg-user";
  const _M0FP314vlmkit_2dsites4chat4main10user__viewN6constrS2982 = "user-wrap";
  const _M0FP314vlmkit_2dsites4chat4main10user__viewN6constrS2983 = "bubble";
  const _M0FP314vlmkit_2dsites4chat4main10user__viewN6constrS2984 = "msg-actions user-actions";
  const _M0FP314vlmkit_2dsites4chat4main10user__viewN6constrS2985 = "act";
  const _M0FP314vlmkit_2dsites4chat4main10user__viewN6constrS2986 = "edit-box";
  const _M0FP314vlmkit_2dsites4chat4main10user__viewN6constrS2987 = "edit-area";
  const _M0FP314vlmkit_2dsites4chat4main10user__viewN6constrS2988 = "edit-row";
  const _M0FP314vlmkit_2dsites4chat4main10user__viewN6constrS2989 = "btn btn-quiet";
  const _M0FP314vlmkit_2dsites4chat4main10user__viewN6constrS2990 = "btn btn-accent";
  const _M0FP314vlmkit_2dsites4chat4main18conversation__viewN6constrS3065 = "scroller";
  const _M0FP314vlmkit_2dsites4chat4main18conversation__viewN6constrS3066 = "scroller";
  const _M0FP314vlmkit_2dsites4chat4main18conversation__viewN6constrS3067 = "thread";
  const _M0FP314vlmkit_2dsites4chat4main18conversation__viewN6constrS3068 = "messages";
  const _M0FP314vlmkit_2dsites4chat4main18conversation__viewN6constrS3069 = "sr-only";
  const _M0FP314vlmkit_2dsites4chat4main8renaming = _M0FP26mizchi7signals6signalGiE(-1);
  const _M0FP314vlmkit_2dsites4chat4main15confirm__delete = _M0FP26mizchi7signals6signalGiE(-1);
  const _M0FP314vlmkit_2dsites4chat4main6drawer = _M0FP26mizchi7signals6signalGbE(false);
  const _M0FP314vlmkit_2dsites4chat4main12drawer__anim = _M0FP26mizchi7signals6signalGbE(false);
  const _M0FP314vlmkit_2dsites4chat4main9collapsed = _M0FP26mizchi7signals6signalGbE(false);
  const _M0FP314vlmkit_2dsites4chat4main5query = _M0FP26mizchi7signals6signalGsE("");
  const _M0FP36mizchi4luna3dom5inputN6constrS2286 = new _M0DTP36mizchi4luna3dom9AttrValue6Static("true");
  const _M0FP36mizchi4luna3dom5inputN5tupleS2287 = { _0: "disabled", _1: _M0FP36mizchi4luna3dom5inputN6constrS2286 };
  const _M0FP36mizchi4luna3dom5inputN6constrS2288 = new _M0DTP36mizchi4luna3dom9AttrValue6Static("true");
  const _M0FP36mizchi4luna3dom5inputN5tupleS2289 = { _0: "readonly", _1: _M0FP36mizchi4luna3dom5inputN6constrS2288 };
  const _M0FP36mizchi4luna3dom5inputN6constrS2290 = new _M0DTP36mizchi4luna3dom9AttrValue6Static("true");
  const _M0FP36mizchi4luna3dom5inputN5tupleS2291 = { _0: "required", _1: _M0FP36mizchi4luna3dom5inputN6constrS2290 };
  const _M0FP36mizchi4luna3dom5inputN6constrS2292 = new _M0DTP36mizchi4luna3dom9AttrValue6Static("true");
  const _M0FP36mizchi4luna3dom5inputN5tupleS2293 = { _0: "checked", _1: _M0FP36mizchi4luna3dom5inputN6constrS2292 };
  const _M0FP314vlmkit_2dsites4chat4main16row__menu__style = _M0FP26mizchi7signals6signalGsE("");
  const _M0FP314vlmkit_2dsites4chat4main9row__viewN6constrS2745 = "row-item";
  const _M0FP314vlmkit_2dsites4chat4main9row__viewN6constrS2746 = "text";
  const _M0FP314vlmkit_2dsites4chat4main9row__viewN6constrS2747 = "rename";
  const _M0FP314vlmkit_2dsites4chat4main9row__viewN6constrS2748 = "row-link";
  const _M0FP314vlmkit_2dsites4chat4main9row__viewN6constrS2749 = "row-title";
  const _M0FP314vlmkit_2dsites4chat4main9row__viewN6constrS2750 = "row-more";
  const _M0FP314vlmkit_2dsites4chat4main11group__viewN6constrS2763 = "group";
  const _M0FP314vlmkit_2dsites4chat4main11group__viewN6constrS2764 = "group-title";
  const _M0FP314vlmkit_2dsites4chat4main11group__viewN6constrS2765 = "rows";
  const _M0FP314vlmkit_2dsites4chat4main13sidebar__viewN6constrS2773 = "sb-full";
  const _M0FP314vlmkit_2dsites4chat4main13sidebar__viewN6constrS2774 = "sb-top";
  const _M0FP314vlmkit_2dsites4chat4main13sidebar__viewN6constrS2775 = "brand";
  const _M0FP314vlmkit_2dsites4chat4main13sidebar__viewN6constrS2776 = "brand-name";
  const _M0FP314vlmkit_2dsites4chat4main13sidebar__viewN6constrS2777 = "new-chat";
  const _M0FP314vlmkit_2dsites4chat4main13sidebar__viewN6constrS2778 = "search";
  const _M0FP314vlmkit_2dsites4chat4main13sidebar__viewN6constrS2779 = "search";
  const _M0FP314vlmkit_2dsites4chat4main13sidebar__viewN6constrS2780 = "Search chats";
  const _M0FP314vlmkit_2dsites4chat4main13sidebar__viewN6constrS2781 = "search";
  const _M0FP314vlmkit_2dsites4chat4main13sidebar__viewN6constrS2782 = "history";
  const _M0FP314vlmkit_2dsites4chat4main13sidebar__viewN6constrS2783 = "no-match";
  const _M0FP314vlmkit_2dsites4chat4main13sidebar__viewN6constrS2784 = "sb-foot";
  const _M0FP314vlmkit_2dsites4chat4main13sidebar__viewN6constrS2785 = "me-avatar";
  const _M0FP314vlmkit_2dsites4chat4main13sidebar__viewN6constrS2786 = "me-text";
  const _M0FP314vlmkit_2dsites4chat4main13sidebar__viewN6constrS2787 = "me-name";
  const _M0FP314vlmkit_2dsites4chat4main13sidebar__viewN6constrS2788 = "me-plan";
  const _M0FP314vlmkit_2dsites4chat4main13sidebar__viewN6constrS2789 = "sb-rail";
  const _M0FP314vlmkit_2dsites4chat4main12link__copied = _M0FP26mizchi7signals6signalGbE(false);
  const _M0FP314vlmkit_2dsites4chat4main13dialog__frameN6constrS3100 = "overlay";
  const _M0FP314vlmkit_2dsites4chat4main13dialog__frameN6constrS3101 = "backdrop";
  const _M0FP314vlmkit_2dsites4chat4main13dialog__frameN6constrS3102 = "dialog";
  const _M0FP314vlmkit_2dsites4chat4main11share__open = _M0FP26mizchi7signals6signalGbE(false);
  const _M0FP314vlmkit_2dsites4chat4main14overlays__viewN6constrS3112 = "drawer-scrim";
  const _M0FP314vlmkit_2dsites4chat4main14overlays__viewN6constrS3113 = "row-menu";
  const _M0FP314vlmkit_2dsites4chat4main14overlays__viewN6constrS3114 = "menu row-menu";
  const _M0FP314vlmkit_2dsites4chat4main14overlays__viewN6constrS3115 = "dialog-head";
  const _M0FP314vlmkit_2dsites4chat4main14overlays__viewN6constrS3116 = "share-title";
  const _M0FP314vlmkit_2dsites4chat4main14overlays__viewN6constrS3117 = "dialog-text";
  const _M0FP314vlmkit_2dsites4chat4main14overlays__viewN6constrS3118 = "share-row";
  const _M0FP314vlmkit_2dsites4chat4main14overlays__viewN6constrS3119 = "text";
  const _M0FP314vlmkit_2dsites4chat4main14overlays__viewN6constrS3120 = true;
  const _M0FP314vlmkit_2dsites4chat4main14overlays__viewN6constrS3121 = "share-link";
  const _M0FP314vlmkit_2dsites4chat4main14overlays__viewN6constrS3122 = "copy-link";
  const _M0FP314vlmkit_2dsites4chat4main14overlays__viewN6constrS3123 = "btn btn-accent";
  const _M0FP314vlmkit_2dsites4chat4main14overlays__viewN6constrS3124 = "delete-title";
  const _M0FP314vlmkit_2dsites4chat4main14overlays__viewN6constrS3125 = "dialog-text";
  const _M0FP314vlmkit_2dsites4chat4main14overlays__viewN6constrS3126 = "dialog-actions";
  const _M0FP314vlmkit_2dsites4chat4main14overlays__viewN6constrS3127 = "delete-cancel";
  const _M0FP314vlmkit_2dsites4chat4main14overlays__viewN6constrS3128 = "btn btn-quiet";
  const _M0FP314vlmkit_2dsites4chat4main14overlays__viewN6constrS3129 = "btn btn-danger";
  const _M0FP314vlmkit_2dsites4chat4main14overlays__viewN10share__urlS3130 = "https://parley.example/share/lunar-night-4f7c2a";
  const _M0FP314vlmkit_2dsites4chat4main5model = _M0FP26mizchi7signals6signalGsE("swift");
  const _M0FP314vlmkit_2dsites4chat4main11model__itemN6constrS2801 = "model-item";
  const _M0FP314vlmkit_2dsites4chat4main11model__itemN6constrS2802 = "mm-text";
  const _M0FP314vlmkit_2dsites4chat4main11model__itemN6constrS2803 = "mm-name";
  const _M0FP314vlmkit_2dsites4chat4main11model__itemN6constrS2804 = "mm-desc";
  const _M0FP314vlmkit_2dsites4chat4main11model__itemN6constrS2805 = "mm-check";
  const _M0FP314vlmkit_2dsites4chat4main12header__viewN6constrS2824 = "model-picker";
  const _M0FP314vlmkit_2dsites4chat4main12header__viewN6constrS2825 = "model-btn";
  const _M0FP314vlmkit_2dsites4chat4main12header__viewN6constrS2826 = "model-btn";
  const _M0FP314vlmkit_2dsites4chat4main12header__viewN6constrS2827 = "model-label";
  const _M0FP314vlmkit_2dsites4chat4main12header__viewN6constrS2828 = "model-menu";
  const _M0FP314vlmkit_2dsites4chat4main12header__viewN6constrS2829 = "menu model-menu";
  const _M0FP314vlmkit_2dsites4chat4main12header__viewN6constrS2830 = "conv-title";
  const _M0FP314vlmkit_2dsites4chat4main12header__viewN6constrS2831 = "share-btn";
  const _M0FP314vlmkit_2dsites4chat4main12header__viewN6constrS2832 = "share-btn";
  function _M0MPC16string10StringView12unsafe__view(self, start, end) {
    return new _M0TPC16string10StringView(self.str, self.start + start | 0, self.start + end | 0);
  }
  function _M0MPB13StringBuilder13write__objectGiE(self, obj) {
    _M0IP016_24default__implPB4Show6outputGiE(obj, { self: self, method_table: _M0FP092moonbitlang_2fcore_2fbuiltin_2fStringBuilder_24as_24_40moonbitlang_2fcore_2fbuiltin_2eLogger });
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
  function _M0IP016_24default__implPB4Show6outputGiE(self, logger) {
    logger.method_table.method_0(logger.self, _M0IPC13int3IntPB4Show10to__string(self));
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
      self.size_hint = _M0MPB4Iter4nextN6constrS52GRPC16string10StringViewE;
    } else {
      if (_bind === undefined) {
      } else {
        const _Some = _bind;
        const _n = _Some;
        self.size_hint = _n > 0 ? _n - 1 | 0 : _M0MPB4Iter4nextN6constrS51GRPC16string10StringViewE;
      }
    }
    return result;
  }
  function _M0MPB4Iter4nextGcE(self) {
    const _func = self.f;
    const result = _func();
    const _bind = self.size_hint;
    if (result === -1) {
      self.size_hint = _M0MPB4Iter4nextN6constrS60GcE;
    } else {
      if (_bind === undefined) {
      } else {
        const _Some = _bind;
        const _n = _Some;
        self.size_hint = _n > 0 ? _n - 1 | 0 : _M0MPB4Iter4nextN6constrS59GcE;
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
      size_hint$2 = _n > 0 ? _n : _M0MPB4Iter3newN6constrS85GRPC16string10StringViewE;
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
      size_hint$2 = _n > 0 ? _n : _M0MPB4Iter3newN6constrS91GcE;
    }
    return new _M0TPB4IterGcE(f, size_hint$2);
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
  function _M0IPC16string10StringViewPB2Eq5equal(self, other) {
    const len = self.end - self.start | 0;
    if (len === (other.end - other.start | 0)) {
      if (self.str === other.str && self.start === other.start) {
        return true;
      }
      return _M0MPC16string6String20unsafe__range__equal(self.str, self.start, other.str, other.start, len);
    } else {
      return false;
    }
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
  function _M0MPB13StringBuilder13reset_2einner(self, keep_capacity) {
    self.val = "";
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
        return _M0MPC16string10StringView4findN6constrS250;
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
  function _M0MPC16string6String4find(self, str) {
    return _M0MPC16string10StringView4find(new _M0TPC16string10StringView(self, 0, self.length), str);
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
  function _M0FPB31rev__find__pattern__kmp__before(target, pattern, candidate_end) {
    if (candidate_end > 0) {
      const m = pattern.end - pattern.start | 0;
      const table = _M0FPB19kmp__failure__table(pattern);
      const scan_end = (candidate_end + m | 0) - 1 | 0;
      let k = 0;
      let best = -1;
      let _tmp = 0;
      while (true) {
        const i = _tmp;
        if (i < scan_end) {
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
            best = (i - m | 0) + 1 | 0;
            const _tmp$2 = k - 1 | 0;
            k = _tmp$2 >>> 0 < table.length ? table[_tmp$2] : $oob();
          }
          _tmp = i + 1 | 0;
          continue;
        } else {
          break;
        }
      }
      return best >= 0 ? best : undefined;
    } else {
      return undefined;
    }
  }
  function _M0FPB41rev__find__two__anchor__candidate__scalar(data, start, candidate_end, first, last_offset, last) {
    let _tmp = candidate_end - 1 | 0;
    let _tmp$2 = candidate_end > start;
    while (true) {
      const pos = _tmp;
      const _more = _tmp$2;
      if (_more) {
        if (data.charCodeAt(pos) === first && data.charCodeAt(pos + last_offset | 0) === last) {
          return pos;
        }
        _tmp = pos - 1 | 0;
        _tmp$2 = pos > start;
        continue;
      } else {
        return -1;
      }
    }
  }
  function _M0FPB47rev__find__two__anchor__candidate__from__string(data, start, candidate_end, first, last_offset, last) {
    return _M0FPB41rev__find__two__anchor__candidate__scalar(data, start, candidate_end, first, last_offset, last);
  }
  function _M0FPB27rev__find__by__two__anchors(target, pattern) {
    const target_len = target.end - target.start | 0;
    const pattern_len = pattern.end - pattern.start | 0;
    const target_start = target.start;
    const pattern_start = pattern.start;
    const last_offset = pattern_len - 1 | 0;
    const first = pattern.str.charCodeAt(pattern.start);
    const last = pattern.str.charCodeAt(pattern.start + last_offset | 0);
    const middle_len = last_offset - 1 | 0;
    const last_candidate = target_len - pattern_len | 0;
    let _tmp = (target_start + last_candidate | 0) + 1 | 0;
    let _tmp$2 = 0;
    while (true) {
      const candidate_end = _tmp;
      const failures = _tmp$2;
      if (candidate_end > target_start) {
        const found = _M0FPB47rev__find__two__anchor__candidate__from__string(target.str, target_start, candidate_end, first, last_offset, last);
        if (found < 0) {
          return undefined;
        }
        if (_M0FPB21string__ranges__equal(target.str, found + 1 | 0, pattern.str, pattern_start + 1 | 0, middle_len)) {
          return found - target_start | 0;
        }
        const candidate = found - target_start | 0;
        const failures$2 = failures + 1 | 0;
        const scanned = last_candidate - candidate | 0;
        if (failures$2 > 64 || failures$2 > (4 + (scanned / 8 | 0) | 0)) {
          return _M0FPB31rev__find__pattern__kmp__before(target, pattern, candidate);
        }
        _tmp = found;
        _tmp$2 = failures$2;
        continue;
      } else {
        return undefined;
      }
    }
  }
  function _M0FPB29rev__find__code__unit__scalar(data, start, end, code) {
    let _tmp = end - 1 | 0;
    let _tmp$2 = end > start;
    while (true) {
      const pos = _tmp;
      const _more = _tmp$2;
      if (_more) {
        if (data.charCodeAt(pos) === code) {
          return pos;
        }
        _tmp = pos - 1 | 0;
        _tmp$2 = pos > start;
        continue;
      } else {
        return -1;
      }
    }
  }
  function _M0FPB35rev__find__code__unit__from__string(data, start, end, code) {
    return (end - start | 0) <= 8 ? _M0FPB29rev__find__code__unit__scalar(data, start, end, code) : _M0FPB19js__last__index__of(data, start, end, _M0FPB22js__code__unit__string(code));
  }
  function _M0FPB33rev__find__code__unit__from__view(target, start, end, code) {
    const target_start = target.start;
    const found = _M0FPB35rev__find__code__unit__from__string(target.str, target_start + start | 0, target_start + end | 0, code);
    return found < 0 ? -1 : found - target_start | 0;
  }
  function _M0MPC16string10StringView9rev__find(self, str) {
    const pattern_len = str.end - str.start | 0;
    switch (pattern_len) {
      case 0: {
        return self.end - self.start | 0;
      }
      case 1: {
        const found = _M0FPB33rev__find__code__unit__from__view(self, 0, self.end - self.start | 0, str.str.charCodeAt(str.start));
        return found < 0 ? undefined : found;
      }
      default: {
        return pattern_len > (self.end - self.start | 0) ? undefined : _M0FPB27rev__find__by__two__anchors(self, str);
      }
    }
  }
  function _M0MPC16string6String9rev__find(self, str) {
    return _M0MPC16string10StringView9rev__find(new _M0TPC16string10StringView(self, 0, self.length), str);
  }
  function _M0MPC16string10StringView11has__suffix(self, str) {
    const self_len = self.end - self.start | 0;
    const str_len = str.end - str.start | 0;
    if (str_len <= self_len) {
      const start = self_len - str_len | 0;
      return str_len === 0 || self.str.charCodeAt(self.start + start | 0) === str.str.charCodeAt(str.start) ? _M0MPC16string6String20unsafe__range__equal(self.str, self.start + start | 0, str.str, str.start, str_len) : false;
    } else {
      return false;
    }
  }
  function _M0MPC16string6String11has__suffix(self, str) {
    return _M0MPC16string10StringView11has__suffix(new _M0TPC16string10StringView(self, 0, self.length), str);
  }
  function _M0MPC16string10StringView11has__prefix(self, str) {
    const str_len = str.end - str.start | 0;
    return str_len <= (self.end - self.start | 0) ? (str_len === 0 || self.str.charCodeAt(self.start) === str.str.charCodeAt(str.start) ? _M0MPC16string6String20unsafe__range__equal(self.str, self.start, str.str, str.start, str_len) : false) : false;
  }
  function _M0MPC16string6String11has__prefix(self, str) {
    return _M0MPC16string10StringView11has__prefix(new _M0TPC16string10StringView(self, 0, self.length), str);
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
  function _M0MPC16string10StringView4trim(self, chars$46$opt) {
    let chars;
    if (chars$46$opt === undefined) {
      chars = _M0MPC16string10StringView4trimN6recordS506;
    } else {
      const _Some = chars$46$opt;
      chars = _Some;
    }
    return _M0MPC16string10StringView12trim_2einner(self, chars);
  }
  function _M0MPC16string6String12trim_2einner(self, chars) {
    return _M0MPC16string10StringView12trim_2einner(new _M0TPC16string10StringView(self, 0, self.length), chars);
  }
  function _M0MPC16string6String4trim(self, chars$46$opt) {
    let chars;
    if (chars$46$opt === undefined) {
      chars = _M0MPC16string6String4trimN6recordS513;
    } else {
      const _Some = chars$46$opt;
      chars = _Some;
    }
    return _M0MPC16string6String12trim_2einner(self, chars);
  }
  function _M0MPC16string6String4iter(self) {
    const len = self.length;
    const index = new _M0TPB8MutLocalGiE(0);
    return _M0MPB4Iter3newGcE(() => {
      if (index.val < len) {
        const c1 = self.charCodeAt(index.val);
        if (c1 >= 55296 && c1 <= 56319 && (index.val + 1 | 0) < len) {
          const c2 = self.charCodeAt(index.val + 1 | 0);
          if (c2 >= 56320 && c2 <= 57343) {
            const c = _M0FPB32code__point__of__surrogate__pair(c1, c2);
            index.val = index.val + 2 | 0;
            return c;
          }
        }
        index.val = index.val + 1 | 0;
        return c1;
      } else {
        return -1;
      }
    }, undefined);
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
  function _M0MPB4Iter9to__arrayGcE(self) {
    const _bind = self.size_hint;
    let result;
    if (_bind === undefined) {
      result = [];
    } else {
      result = [];
    }
    while (true) {
      const _bind$2 = _M0MPB4Iter4nextGcE(self);
      if (_bind$2 === -1) {
        break;
      } else {
        const _Some = _bind$2;
        const _x = _Some;
        _M0MPC15array5Array4pushGcE(result, _x);
        continue;
      }
    }
    return result;
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
        _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(result, _x);
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
  function _M0IPC16string6StringPB12ToStringView16to__string__view(self) {
    return new _M0TPC16string10StringView(self, 0, self.length);
  }
  function _M0FPB19join__string__viewsGsE(parts, separator) {
    if ((parts.end - parts.start | 0) === 0) {
      return "";
    } else {
      if ((parts.end - parts.start | 0) === 1) {
        const _one = parts.buf[parts.start];
        return _M0MPC16string10StringView9to__owned(_M0IPC16string6StringPB12ToStringView16to__string__view(_one));
      } else {
        const _first = parts.buf[parts.start];
        const _x_buf = parts.buf;
        const _x_start = 1 + parts.start | 0;
        const _x_end = parts.end;
        const separator$2 = _M0MPC16string10StringView9to__owned(separator);
        let result = _M0MPC16string10StringView9to__owned(_M0IPC16string6StringPB12ToStringView16to__string__view(_first));
        const _bind = _x_end - _x_start | 0;
        let _tmp = 0;
        while (true) {
          const _ = _tmp;
          if (_ < _bind) {
            const part = _x_buf[_x_start + _ | 0];
            result = `${result}${separator$2}`;
            result = `${result}${_M0MPC16string10StringView9to__owned(_M0IPC16string6StringPB12ToStringView16to__string__view(part))}`;
            _tmp = _ + 1 | 0;
            continue;
          } else {
            break;
          }
        }
        return result;
      }
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
  function _M0MPC15array9ArrayView4iterGRP314vlmkit_2dsites4chat4main4ConvE(self) {
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
  function _M0MPC15array5Array4iterGRP314vlmkit_2dsites4chat4main4ConvE(self) {
    return _M0MPC15array9ArrayView4iterGRP314vlmkit_2dsites4chat4main4ConvE(new _M0TPB9ArrayViewGRP314vlmkit_2dsites4chat4main4ConvE(self, 0, self.length));
  }
  function _M0MPC15array9ArrayView4joinGsE(self, separator) {
    return _M0FPB19join__string__viewsGsE(self, separator);
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
  function _M0MPC15array5Array4copyGRP314vlmkit_2dsites4chat4main3MsgE(self) {
    return _M0MPB7JSArray4copy(self);
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
  function _M0MPC15array5Array3setGRP36mizchi4luna3dom9ItemEntryGRP314vlmkit_2dsites4chat4main3MsgEE(self, index, value) {
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
  function _M0MPC15array5Array5clearGRP26mizchi7signals5OwnerE(self) {
    _M0MPC15array5Array28unsafe__truncate__to__lengthGRP26mizchi7signals5OwnerE(self, 0);
  }
  function _M0MPC15array5Array4joinGsE(self, separator) {
    return _M0MPC15array9ArrayView4joinGsE(new _M0TPB9ArrayViewGsE(self, 0, self.length), separator);
  }
  function _M0MPC13ref3Ref3RefGRPB5ArrayGRP36mizchi11js__browser3dom4NodeEE(x) {
    return new _M0TPC13ref3RefGRPB5ArrayGRP36mizchi11js__browser3dom4NodeEE(x);
  }
  function _M0MPC13ref3Ref3RefGiE(x) {
    return new _M0TPC13ref3RefGiE(x);
  }
  function _M0MPC13ref3Ref3RefGsE(x) {
    return new _M0TPC13ref3RefGsE(x);
  }
  function _M0MPC13ref3Ref3RefGbE(x) {
    return new _M0TPC13ref3RefGbE(x);
  }
  function _M0FP26mizchi8js__core9try__sync(op) {
    const result = new _M0TPC13ref3RefGORP26mizchi8js__core3AnyE(_M0DTPC16option6OptionGRP26mizchi8js__core3AnyE4None__);
    const error = new _M0TPC13ref3RefGOsE(undefined);
    _M0FP26mizchi8js__core15ffi__wrap__sync(op, (v) => {
      result.val = new _M0DTPC16option6OptionGRP26mizchi8js__core3AnyE4Some(v);
    }, (e) => {
      const msg = _M0MP26mizchi8js__core3Any5__get(e, "message");
      error.val = msg;
    });
    const _bind = error.val;
    if (_bind === undefined) {
      const _bind$2 = result.val;
      if (_bind$2.$tag === 1) {
        const _Some = _bind$2;
        const _v = _Some._0;
        return new _M0DTPC16result6ResultGRP26mizchi8js__core3AnyRP26mizchi8js__core7JsErrorE2Ok(_v);
      } else {
        return new _M0DTPC16result6ResultGRP26mizchi8js__core3AnyRP26mizchi8js__core7JsErrorE3Err(new _M0DTPC15error5Error37mizchi_2fjs__core_2eJsError_2eJsError("No result"));
      }
    } else {
      const _Some = _bind;
      const _msg = _Some;
      return new _M0DTPC16result6ResultGRP26mizchi8js__core3AnyRP26mizchi8js__core7JsErrorE3Err(new _M0DTPC15error5Error37mizchi_2fjs__core_2eJsError_2eJsError(_msg));
    }
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
        const _func = _M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(cleanups, i);
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
      let _tmp = cleanups.length - 1 | 0;
      while (true) {
        const i = _tmp;
        if (i >= 0) {
          const _func = _M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(cleanups, i);
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
          const _func = _M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(cleanups, i);
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
  function _M0MP26mizchi7signals10CoreSignal3getGRPB5ArrayGRP314vlmkit_2dsites4chat4main4ConvEE(self) {
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
  function _M0MP26mizchi7signals10CoreSignal3getGsE(self) {
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
  function _M0MP26mizchi7signals6Signal3getGRPB5ArrayGRP314vlmkit_2dsites4chat4main4ConvEE(self) {
    return _M0MP26mizchi7signals10CoreSignal3getGRPB5ArrayGRP314vlmkit_2dsites4chat4main4ConvEE(self.inner);
  }
  function _M0MP26mizchi7signals6Signal3getGsE(self) {
    return _M0MP26mizchi7signals10CoreSignal3getGsE(self.inner);
  }
  function _M0MP26mizchi7signals6Signal3getGiE(self) {
    return _M0MP26mizchi7signals10CoreSignal3getGiE(self.inner);
  }
  function _M0MP26mizchi7signals6Signal3getGbE(self) {
    return _M0MP26mizchi7signals10CoreSignal3getGbE(self.inner);
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
            const _bind$2 = _M0MPC15array5Array3popGUORP26mizchi7signals4LinkORP26mizchi7signals4LinkEE(stack);
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
                _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(stack, { _0: next_ref.val, _1: undefined });
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
  function _M0FP26mizchi7signals12core__signalGRPB5ArrayGRP314vlmkit_2dsites4chat4main4ConvEE(initial) {
    return new _M0TP26mizchi7signals10CoreSignalGRPB5ArrayGRP314vlmkit_2dsites4chat4main4ConvEE(_M0MP26mizchi7signals12ReactiveNode3new(_M0MP26mizchi7signals13ReactiveFlags7to__int(1)), initial, initial);
  }
  function _M0FP26mizchi7signals12core__signalGsE(initial) {
    return new _M0TP26mizchi7signals10CoreSignalGsE(_M0MP26mizchi7signals12ReactiveNode3new(_M0MP26mizchi7signals13ReactiveFlags7to__int(1)), initial, initial);
  }
  function _M0FP26mizchi7signals12core__signalGiE(initial) {
    return new _M0TP26mizchi7signals10CoreSignalGiE(_M0MP26mizchi7signals12ReactiveNode3new(_M0MP26mizchi7signals13ReactiveFlags7to__int(1)), initial, initial);
  }
  function _M0FP26mizchi7signals12core__signalGbE(initial) {
    return new _M0TP26mizchi7signals10CoreSignalGbE(_M0MP26mizchi7signals12ReactiveNode3new(_M0MP26mizchi7signals13ReactiveFlags7to__int(1)), initial, initial);
  }
  function _M0MP26mizchi7signals6Signal3newGRPB5ArrayGRP314vlmkit_2dsites4chat4main4ConvEE(initial) {
    return new _M0TP26mizchi7signals6SignalGRPB5ArrayGRP314vlmkit_2dsites4chat4main4ConvEE(_M0FP26mizchi7signals12core__signalGRPB5ArrayGRP314vlmkit_2dsites4chat4main4ConvEE(initial));
  }
  function _M0MP26mizchi7signals6Signal3newGsE(initial) {
    return new _M0TP26mizchi7signals6SignalGsE(_M0FP26mizchi7signals12core__signalGsE(initial));
  }
  function _M0MP26mizchi7signals6Signal3newGiE(initial) {
    return new _M0TP26mizchi7signals6SignalGiE(_M0FP26mizchi7signals12core__signalGiE(initial));
  }
  function _M0MP26mizchi7signals6Signal3newGbE(initial) {
    return new _M0TP26mizchi7signals6SignalGbE(_M0FP26mizchi7signals12core__signalGbE(initial));
  }
  function _M0FP26mizchi7signals6signalGRPB5ArrayGRP314vlmkit_2dsites4chat4main4ConvEE(initial) {
    return _M0MP26mizchi7signals6Signal3newGRPB5ArrayGRP314vlmkit_2dsites4chat4main4ConvEE(initial);
  }
  function _M0FP26mizchi7signals6signalGsE(initial) {
    return _M0MP26mizchi7signals6Signal3newGsE(initial);
  }
  function _M0FP26mizchi7signals6signalGiE(initial) {
    return _M0MP26mizchi7signals6Signal3newGiE(initial);
  }
  function _M0FP26mizchi7signals6signalGbE(initial) {
    return _M0MP26mizchi7signals6Signal3newGbE(initial);
  }
  function _M0MP26mizchi7signals10CoreSignal3setGRPB5ArrayGRP314vlmkit_2dsites4chat4main4ConvEE(self, value) {
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
  function _M0MP26mizchi7signals10CoreSignal3setGsE(self, value) {
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
  function _M0MP26mizchi7signals6Signal3setGRPB5ArrayGRP314vlmkit_2dsites4chat4main4ConvEE(self, new_value) {
    _M0MP26mizchi7signals10CoreSignal3setGRPB5ArrayGRP314vlmkit_2dsites4chat4main4ConvEE(self.inner, new_value);
  }
  function _M0MP26mizchi7signals6Signal3setGsE(self, new_value) {
    _M0MP26mizchi7signals10CoreSignal3setGsE(self.inner, new_value);
  }
  function _M0MP26mizchi7signals6Signal3setGiE(self, new_value) {
    _M0MP26mizchi7signals10CoreSignal3setGiE(self.inner, new_value);
  }
  function _M0MP26mizchi7signals6Signal3setGbE(self, new_value) {
    _M0MP26mizchi7signals10CoreSignal3setGbE(self.inner, new_value);
  }
  function _M0FP26mizchi7signals6effect(fn_) {
    const active = _M0MPC13ref3Ref3RefGbE(true);
    const dispose_ref = _M0MPC13ref3Ref3RefGRPB5ArrayGRP36mizchi11js__browser3dom4NodeEE(undefined);
    const cleanups = [];
    const wrapped_fn = () => {
      let _tmp = cleanups.length - 1 | 0;
      while (true) {
        const i = _tmp;
        if (i >= 0) {
          const _func = _M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(cleanups, i);
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
      let _tmp = cleanups.length - 1 | 0;
      while (true) {
        const i = _tmp;
        if (i >= 0) {
          const _func = _M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(cleanups, i);
          _func();
          _tmp = i - 1 | 0;
          continue;
        } else {
          break;
        }
      }
      _M0MPC15array5Array5clearGRP26mizchi7signals5OwnerE(cleanups);
      const _bind = dispose_ref.val;
      if (_bind === undefined) {
        return;
      } else {
        const _Some = _bind;
        const _d = _Some;
        _d();
        return;
      }
    };
    _M0FP26mizchi7signals18register__disposer(dispose);
    return dispose;
  }
  function _M0MP26mizchi7signals10CoreSignal6updateGiE(self, f) {
    _M0MP26mizchi7signals10CoreSignal3setGiE(self, f(_M0MP26mizchi7signals10CoreSignal3getGiE(self)));
  }
  function _M0MP26mizchi7signals10CoreSignal6updateGbE(self, f) {
    _M0MP26mizchi7signals10CoreSignal3setGbE(self, f(_M0MP26mizchi7signals10CoreSignal3getGbE(self)));
  }
  function _M0MP26mizchi7signals10CoreSignal6updateGRPB5ArrayGRP314vlmkit_2dsites4chat4main3MsgEE(self, f) {
    _M0MP26mizchi7signals10CoreSignal3setGRPB5ArrayGRP314vlmkit_2dsites4chat4main4ConvEE(self, f(_M0MP26mizchi7signals10CoreSignal3getGRPB5ArrayGRP314vlmkit_2dsites4chat4main4ConvEE(self)));
  }
  function _M0MP26mizchi7signals6Signal6updateGiE(self, f) {
    _M0MP26mizchi7signals10CoreSignal6updateGiE(self.inner, f);
  }
  function _M0MP26mizchi7signals6Signal6updateGbE(self, f) {
    _M0MP26mizchi7signals10CoreSignal6updateGbE(self.inner, f);
  }
  function _M0MP26mizchi7signals6Signal6updateGRPB5ArrayGRP314vlmkit_2dsites4chat4main3MsgEE(self, f) {
    _M0MP26mizchi7signals10CoreSignal6updateGRPB5ArrayGRP314vlmkit_2dsites4chat4main3MsgEE(self.inner, f);
  }
  function _M0FP26mizchi7signals16create__computedGRPB5ArrayGRP314vlmkit_2dsites4chat4main5BlockEE(getter) {
    return new _M0TP26mizchi7signals8ComputedGRPB5ArrayGRP314vlmkit_2dsites4chat4main5BlockEE(_M0MP26mizchi7signals12ReactiveNode3new(_M0MP26mizchi7signals13ReactiveFlags7to__int(0)), _M0DTPC16option6OptionGRPB5ArrayGRP314vlmkit_2dsites4chat4main5BlockEE4None__, getter);
  }
  function _M0FP26mizchi7signals16create__computedGbE(getter) {
    return new _M0TP26mizchi7signals8ComputedGbE(_M0MP26mizchi7signals12ReactiveNode3new(_M0MP26mizchi7signals13ReactiveFlags7to__int(0)), -1, getter);
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
  function _M0FP26mizchi7signals16update__computedGRPB5ArrayGRP314vlmkit_2dsites4chat4main5BlockEE(c) {
    _M0FP26mizchi7signals10inc__cycle();
    c.node.deps_tail = undefined;
    _M0MP26mizchi7signals5Flags10set__value(c.node.flags, _M0MP26mizchi7signals13ReactiveFlags7to__int(1) | _M0MP26mizchi7signals13ReactiveFlags7to__int(4));
    const prev_sub = _M0FP26mizchi7signals16set__active__sub(c.node);
    const old_value = c.value;
    const _func = c.getter;
    const new_value = _func();
    c.value = new _M0DTPC16option6OptionGRPB5ArrayGRP314vlmkit_2dsites4chat4main5BlockEE4Some(new_value);
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
  function _M0FP26mizchi7signals16update__computedGbE(c) {
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
    if (old_value === -1) {
      return true;
    } else {
      const _Some = old_value;
      const _old = _Some;
      return !(_old === new_value);
    }
  }
  function _M0MP26mizchi7signals8Computed3getGRPB5ArrayGRP314vlmkit_2dsites4chat4main5BlockEE(self) {
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
      if (_M0FP26mizchi7signals16update__computedGRPB5ArrayGRP314vlmkit_2dsites4chat4main5BlockEE(self)) {
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
          self.value = new _M0DTPC16option6OptionGRPB5ArrayGRP314vlmkit_2dsites4chat4main5BlockEE4Some(_func());
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
  function _M0MP26mizchi7signals8Computed3getGbE(self) {
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
      if (_M0FP26mizchi7signals16update__computedGbE(self)) {
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
    return _bind$2 === -1 ? $panic() : _bind$2;
  }
  function _M0FP26mizchi7signals4memoGRPB5ArrayGRP314vlmkit_2dsites4chat4main5BlockEE(compute) {
    const inner = _M0FP26mizchi7signals16create__computedGRPB5ArrayGRP314vlmkit_2dsites4chat4main5BlockEE(compute);
    return () => _M0MP26mizchi7signals8Computed3getGRPB5ArrayGRP314vlmkit_2dsites4chat4main5BlockEE(inner);
  }
  function _M0FP26mizchi7signals4memoGbE(compute) {
    const inner = _M0FP26mizchi7signals16create__computedGbE(compute);
    return () => _M0MP26mizchi7signals8Computed3getGbE(inner);
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
        _M0MP26mizchi7signals5Owner7dispose(_M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(self.children, i));
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
        const _func = _M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(self.disposers, i);
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
        const _func = _M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(self.cleanups, i);
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
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(_p.children, owner);
    }
    return owner;
  }
  function _M0FP26mizchi7signals9untrackedGRPB5ArrayGRP314vlmkit_2dsites4chat4main5BlockEE(f) {
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
        return _M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(children, 0);
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
  function _M0FP36mizchi4luna3dom4showN19render__with__scopeS1528(_env) {
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
    const initial_nodes = initial_show ? _M0FP26mizchi7signals9untrackedGRPB5ArrayGRP314vlmkit_2dsites4chat4main5BlockEE(() => _M0FP36mizchi4luna3dom4showN19render__with__scopeS1528(_env)) : [];
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
            const nodes = _M0FP26mizchi7signals9untrackedGRPB5ArrayGRP314vlmkit_2dsites4chat4main5BlockEE(() => _M0FP36mizchi4luna3dom4showN19render__with__scopeS1528(_env));
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
          _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(all_nodes, new _M0DTP36mizchi4luna3dom7DomNode3Raw(node));
          _tmp = _ + 1 | 0;
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
  function _M0FP36mizchi4luna3dom24build__entry__index__mapGRP314vlmkit_2dsites4chat4main3MsgE(entries) {
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
  function _M0FP36mizchi4luna3dom10ref__equalGRP314vlmkit_2dsites4chat4main3MsgE(a, b) {
    return _M0FP36mizchi4luna3dom15ref__equal__any(a, b);
  }
  function _M0FP36mizchi4luna3dom18find__entry__indexGRP314vlmkit_2dsites4chat4main3MsgE(map, item, used_indices, old_entries) {
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
        if (!_M0MPC15array5Array2atGbE(used_indices, i) && _M0FP36mizchi4luna3dom10ref__equalGRP314vlmkit_2dsites4chat4main3MsgE(entry.item, item)) {
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
  function _M0FP36mizchi4luna3dom20has__duplicate__refsGRP314vlmkit_2dsites4chat4main3MsgE(items) {
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
  function _M0MP36mizchi4luna3dom9ItemEntry3newGRP314vlmkit_2dsites4chat4main3MsgE(item, dom) {
    return new _M0TP36mizchi4luna3dom9ItemEntryGRP314vlmkit_2dsites4chat4main3MsgE(item, dom, dom, [dom], () => {
    });
  }
  function _M0MP36mizchi4luna3dom9ItemEntry30new__with__nodes__and__disposeGRP314vlmkit_2dsites4chat4main3MsgE(item, nodes, dispose) {
    const first = _M0MPC15array5Array2atGORP26mizchi7signals10EffectNodeE(nodes, 0);
    const last = _M0MPC15array5Array2atGORP26mizchi7signals10EffectNodeE(nodes, nodes.length - 1 | 0);
    return new _M0TP36mizchi4luna3dom9ItemEntryGRP314vlmkit_2dsites4chat4main3MsgE(item, first, last, nodes, dispose);
  }
  function _M0FP36mizchi4luna3dom31reconcile__items__with__disposeGRP314vlmkit_2dsites4chat4main3MsgE(parent, old_entries, new_items, render_item, end_marker) {
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
    if (_M0FP36mizchi4luna3dom20has__duplicate__refsGRP314vlmkit_2dsites4chat4main3MsgE(new_items)) {
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
            _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(fresh_entries, _M0MP36mizchi4luna3dom9ItemEntry30new__with__nodes__and__disposeGRP314vlmkit_2dsites4chat4main3MsgE(item, [placeholder], _dispose));
          } else {
            _M0MP36mizchi11js__browser3dom4Node12insertBefore(parent, _dom, new _M0DTPC16option6OptionGRP36mizchi11js__browser3dom4NodeE4Some(end_marker));
            _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(fresh_entries, _M0MP36mizchi4luna3dom9ItemEntry30new__with__nodes__and__disposeGRP314vlmkit_2dsites4chat4main3MsgE(item, nodes, _dispose));
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
        _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(new_entries, _M0MP36mizchi4luna3dom9ItemEntry3newGRP314vlmkit_2dsites4chat4main3MsgE(_M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(new_items, 0), end_marker));
        _tmp = _ + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    const used_indices = _M0MPC15array5Array4makeGbE(old_entries.length, false);
    const index_map = _M0FP36mizchi4luna3dom24build__entry__index__mapGRP314vlmkit_2dsites4chat4main3MsgE(old_entries);
    const cursor = _M0MPC13ref3Ref3RefGRPB5ArrayGRP36mizchi11js__browser3dom4NodeEE(end_marker);
    const last = n - 1 | 0;
    let _tmp$2 = last;
    let _tmp$3 = last >= 0;
    while (true) {
      const i = _tmp$2;
      const _more = _tmp$3;
      if (_more) {
        const item = _M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(new_items, i);
        const old_index = _M0FP36mizchi4luna3dom18find__entry__indexGRP314vlmkit_2dsites4chat4main3MsgE(index_map, item, used_indices, old_entries);
        if (old_index >= 0) {
          const entry = _M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(old_entries, old_index);
          _M0MPC15array5Array3setGbE(used_indices, old_index, true);
          if (entry.nodes.length > 0) {
            if (!_M0FP36mizchi4luna3dom17next__sibling__is(entry.last, cursor.val)) {
              _M0FP36mizchi4luna3dom19move__nodes__before(parent, entry.nodes, cursor.val);
            }
            cursor.val = entry.dom;
          }
          _M0MPC15array5Array3setGRP36mizchi4luna3dom9ItemEntryGRP314vlmkit_2dsites4chat4main3MsgEE(new_entries, i, entry);
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
            _M0MPC15array5Array3setGRP36mizchi4luna3dom9ItemEntryGRP314vlmkit_2dsites4chat4main3MsgEE(new_entries, i, _M0MP36mizchi4luna3dom9ItemEntry30new__with__nodes__and__disposeGRP314vlmkit_2dsites4chat4main3MsgE(item, placeholder_nodes, _dispose));
          } else {
            _M0MP36mizchi11js__browser3dom4Node12insertBefore(parent, _dom, new _M0DTPC16option6OptionGRP36mizchi11js__browser3dom4NodeE4Some(cursor.val));
            cursor.val = _M0MPC15array5Array2atGORP26mizchi7signals10EffectNodeE(nodes, 0);
            _M0MPC15array5Array3setGRP36mizchi4luna3dom9ItemEntryGRP314vlmkit_2dsites4chat4main3MsgEE(new_entries, i, _M0MP36mizchi4luna3dom9ItemEntry30new__with__nodes__and__disposeGRP314vlmkit_2dsites4chat4main3MsgE(item, nodes, _dispose));
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
  function _M0FP36mizchi4luna3dom35reconcile__for__each__with__disposeGRP314vlmkit_2dsites4chat4main3MsgE(entries_ref, placeholder, new_items, render_item) {
    const _bind = _M0MP36mizchi11js__browser3dom4Node10parentNode(placeholder);
    if (_bind.$tag === 1) {
      const _Some = _bind;
      const _parent = _Some._0;
      entries_ref.val = _M0FP36mizchi4luna3dom31reconcile__items__with__disposeGRP314vlmkit_2dsites4chat4main3MsgE(_parent, entries_ref.val, new_items, render_item, placeholder);
      return;
    } else {
      return;
    }
  }
  function _M0FP36mizchi4luna3dom9for__eachGRP314vlmkit_2dsites4chat4main3MsgE(items, render_item) {
    const doc = _M0FP36mizchi11js__browser3dom8document();
    const placeholder = _M0MP36mizchi11js__browser3dom8Document13createComment(doc, "for");
    const entries = _M0MPC13ref3Ref3RefGRPB5ArrayGRP36mizchi11js__browser3dom4NodeEE([]);
    const is_first = _M0MPC13ref3Ref3RefGbE(true);
    const captured_owner = _M0FP26mizchi7signals17reactive__context.current_owner;
    const render_with_scope = (item, i) => _M0FP26mizchi7signals19with__parent__ownerGURP36mizchi11js__browser3dom4NodeWEuEE(captured_owner, () => {
      const _bind = _M0FP26mizchi7signals27create__root__with__disposeGRP36mizchi4luna3dom7DomNodeE(() => render_item(item, i));
      const _dom = _bind._0;
      const _dispose = _bind._1;
      return { _0: _M0MP36mizchi4luna3dom7DomNode7to__dom(_dom), _1: _dispose };
    });
    const fragment = _M0MP36mizchi11js__browser3dom8Document22createDocumentFragment(doc);
    const initial_items = _M0FP26mizchi7signals9untrackedGRPB5ArrayGRP314vlmkit_2dsites4chat4main5BlockEE(() => items());
    const _bind = initial_items.length;
    let _tmp = 0;
    while (true) {
      const i = _tmp;
      if (i < _bind) {
        const item = initial_items[i];
        const _bind$2 = _M0FP26mizchi7signals9untrackedGURP36mizchi11js__browser3dom4NodeWEuEE(() => render_with_scope(item, i));
        const _dom = _bind$2._0;
        const _dispose = _bind$2._1;
        const nodes = _M0FP36mizchi4luna3dom19collect__dom__nodes(_dom);
        if (nodes.length === 0) {
          const placeholder$2 = _M0MP36mizchi11js__browser3dom8Document13createComment(doc, "empty");
          _M0MP36mizchi11js__browser3dom4Node11appendChild(fragment, placeholder$2);
          _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(entries.val, _M0MP36mizchi4luna3dom9ItemEntry30new__with__nodes__and__disposeGRP314vlmkit_2dsites4chat4main3MsgE(item, [placeholder$2], _dispose));
        } else {
          _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(entries.val, _M0MP36mizchi4luna3dom9ItemEntry30new__with__nodes__and__disposeGRP314vlmkit_2dsites4chat4main3MsgE(item, nodes, _dispose));
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
        _M0FP36mizchi4luna3dom35reconcile__for__each__with__disposeGRP314vlmkit_2dsites4chat4main3MsgE(entries, placeholder, new_items, render_with_scope);
      });
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
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(result, { _0: "id", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_v) });
    }
    if (class_ === undefined) {
    } else {
      const _Some = class_;
      const _v = _Some;
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(result, { _0: "className", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_v) });
    }
    if (style === undefined) {
    } else {
      const _Some = style;
      const _s = _Some;
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(result, { _0: "style", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_s) });
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
          _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(result, attr);
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
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(result, { _0: "__ref", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Handler(handler) });
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
          _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(result, { _0: pair._0, _1: _M0MP36mizchi4luna3dom4Attr15to__attr__value(pair._1) });
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
          _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(result, pair);
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
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(props, { _0: "width", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_v) });
    }
    if (height === undefined) {
    } else {
      const _Some = height;
      const _v = _Some;
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(props, { _0: "height", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_v) });
    }
    if (viewBox === undefined) {
    } else {
      const _Some = viewBox;
      const _v = _Some;
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(props, { _0: "viewBox", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_v) });
    }
    if (xmlns === undefined) {
    } else {
      const _Some = xmlns;
      const _v = _Some;
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(props, { _0: "xmlns", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_v) });
    }
    if (fill === undefined) {
    } else {
      const _Some = fill;
      const _v = _Some;
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(props, { _0: "fill", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_v) });
    }
    if (stroke === undefined) {
    } else {
      const _Some = stroke;
      const _v = _Some;
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(props, { _0: "stroke", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_v) });
    }
    if (role === undefined) {
    } else {
      const _Some = role;
      const _v = _Some;
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(props, { _0: "role", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_v) });
    }
    if (aria_label === undefined) {
    } else {
      const _Some = aria_label;
      const _v = _Some;
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(props, { _0: "aria-label", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_v) });
    }
    if (aria_labelledby === undefined) {
    } else {
      const _Some = aria_labelledby;
      const _v = _Some;
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(props, { _0: "aria-labelledby", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_v) });
    }
    if (aria_describedby === undefined) {
    } else {
      const _Some = aria_describedby;
      const _v = _Some;
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(props, { _0: "aria-describedby", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_v) });
    }
    if (dyn_class === undefined) {
    } else {
      const _Some = dyn_class;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(props, { _0: "className", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    if (dyn_style === undefined) {
    } else {
      const _Some = dyn_style;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(props, { _0: "style", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    return _M0FP36mizchi4luna3dom19create__element__ns(_M0FP36mizchi4luna3dom7svg__ns, "svg", props, children);
  }
  function _M0FP36mizchi4luna3dom9svg__path(d, fill, stroke, stroke_width, stroke_linecap, stroke_linejoin, fill_rule, id, class_, style, dyn_class, dyn_style, on, ref_, attrs, dyn_attrs) {
    const props = _M0FP36mizchi4luna3dom20build__props_2einner(id, class_, style, on, ref_, attrs, dyn_attrs);
    if (d === undefined) {
    } else {
      const _Some = d;
      const _v = _Some;
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(props, { _0: "d", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_v) });
    }
    if (fill === undefined) {
    } else {
      const _Some = fill;
      const _v = _Some;
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(props, { _0: "fill", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_v) });
    }
    if (stroke === undefined) {
    } else {
      const _Some = stroke;
      const _v = _Some;
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(props, { _0: "stroke", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_v) });
    }
    if (stroke_width === undefined) {
    } else {
      const _Some = stroke_width;
      const _v = _Some;
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(props, { _0: "stroke-width", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_v) });
    }
    if (stroke_linecap === undefined) {
    } else {
      const _Some = stroke_linecap;
      const _v = _Some;
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(props, { _0: "stroke-linecap", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_v) });
    }
    if (stroke_linejoin === undefined) {
    } else {
      const _Some = stroke_linejoin;
      const _v = _Some;
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(props, { _0: "stroke-linejoin", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_v) });
    }
    if (fill_rule === undefined) {
    } else {
      const _Some = fill_rule;
      const _v = _Some;
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(props, { _0: "fill-rule", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_v) });
    }
    if (dyn_class === undefined) {
    } else {
      const _Some = dyn_class;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(props, { _0: "className", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    if (dyn_style === undefined) {
    } else {
      const _Some = dyn_style;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(props, { _0: "style", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    return _M0FP36mizchi4luna3dom19create__element__ns(_M0FP36mizchi4luna3dom7svg__ns, "path", props, []);
  }
  function _M0FP36mizchi4luna3dom3nav(id, class_, style, dyn_class, dyn_style, on, ref_, attrs, dyn_attrs, children) {
    const props = _M0FP36mizchi4luna3dom20build__props_2einner(id, class_, style, on, ref_, attrs, dyn_attrs);
    if (dyn_class === undefined) {
    } else {
      const _Some = dyn_class;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(props, { _0: "className", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    if (dyn_style === undefined) {
    } else {
      const _Some = dyn_style;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(props, { _0: "style", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    return _M0FP36mizchi4luna3dom15create__element("nav", props, children);
  }
  function _M0FP36mizchi4luna3dom7section(id, class_, style, dyn_class, dyn_style, on, ref_, attrs, dyn_attrs, children) {
    const props = _M0FP36mizchi4luna3dom20build__props_2einner(id, class_, style, on, ref_, attrs, dyn_attrs);
    if (dyn_class === undefined) {
    } else {
      const _Some = dyn_class;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(props, { _0: "className", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    if (dyn_style === undefined) {
    } else {
      const _Some = dyn_style;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(props, { _0: "style", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    return _M0FP36mizchi4luna3dom15create__element("section", props, children);
  }
  function _M0FP36mizchi4luna3dom7article(id, class_, style, dyn_class, dyn_style, on, ref_, attrs, dyn_attrs, children) {
    const props = _M0FP36mizchi4luna3dom20build__props_2einner(id, class_, style, on, ref_, attrs, dyn_attrs);
    if (dyn_class === undefined) {
    } else {
      const _Some = dyn_class;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(props, { _0: "className", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    if (dyn_style === undefined) {
    } else {
      const _Some = dyn_style;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(props, { _0: "style", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    return _M0FP36mizchi4luna3dom15create__element("article", props, children);
  }
  function _M0FP36mizchi4luna3dom3div(id, class_, style, dyn_class, dyn_style, on, ref_, attrs, dyn_attrs, children) {
    const props = _M0FP36mizchi4luna3dom20build__props_2einner(id, class_, style, on, ref_, attrs, dyn_attrs);
    if (dyn_class === undefined) {
    } else {
      const _Some = dyn_class;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(props, { _0: "className", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    if (dyn_style === undefined) {
    } else {
      const _Some = dyn_style;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(props, { _0: "style", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    return _M0FP36mizchi4luna3dom15create__element("div", props, children);
  }
  function _M0FP36mizchi4luna3dom4span(id, class_, style, dyn_class, dyn_style, on, ref_, attrs, dyn_attrs, children) {
    const props = _M0FP36mizchi4luna3dom20build__props_2einner(id, class_, style, on, ref_, attrs, dyn_attrs);
    if (dyn_class === undefined) {
    } else {
      const _Some = dyn_class;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(props, { _0: "className", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    if (dyn_style === undefined) {
    } else {
      const _Some = dyn_style;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(props, { _0: "style", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    return _M0FP36mizchi4luna3dom15create__element("span", props, children);
  }
  function _M0FP36mizchi4luna3dom1p(id, class_, style, dyn_class, dyn_style, on, ref_, attrs, dyn_attrs, children) {
    const props = _M0FP36mizchi4luna3dom20build__props_2einner(id, class_, style, on, ref_, attrs, dyn_attrs);
    if (dyn_class === undefined) {
    } else {
      const _Some = dyn_class;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(props, { _0: "className", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    if (dyn_style === undefined) {
    } else {
      const _Some = dyn_style;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(props, { _0: "style", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    return _M0FP36mizchi4luna3dom15create__element("p", props, children);
  }
  function _M0FP36mizchi4luna3dom2h1(id, class_, style, dyn_class, dyn_style, on, ref_, attrs, dyn_attrs, children) {
    const props = _M0FP36mizchi4luna3dom20build__props_2einner(id, class_, style, on, ref_, attrs, dyn_attrs);
    if (dyn_class === undefined) {
    } else {
      const _Some = dyn_class;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(props, { _0: "className", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    if (dyn_style === undefined) {
    } else {
      const _Some = dyn_style;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(props, { _0: "style", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    return _M0FP36mizchi4luna3dom15create__element("h1", props, children);
  }
  function _M0FP36mizchi4luna3dom2h2(id, class_, style, dyn_class, dyn_style, on, ref_, attrs, dyn_attrs, children) {
    const props = _M0FP36mizchi4luna3dom20build__props_2einner(id, class_, style, on, ref_, attrs, dyn_attrs);
    if (dyn_class === undefined) {
    } else {
      const _Some = dyn_class;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(props, { _0: "className", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    if (dyn_style === undefined) {
    } else {
      const _Some = dyn_style;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(props, { _0: "style", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    return _M0FP36mizchi4luna3dom15create__element("h2", props, children);
  }
  function _M0FP36mizchi4luna3dom2h3(id, class_, style, dyn_class, dyn_style, on, ref_, attrs, dyn_attrs, children) {
    const props = _M0FP36mizchi4luna3dom20build__props_2einner(id, class_, style, on, ref_, attrs, dyn_attrs);
    if (dyn_class === undefined) {
    } else {
      const _Some = dyn_class;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(props, { _0: "className", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    if (dyn_style === undefined) {
    } else {
      const _Some = dyn_style;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(props, { _0: "style", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    return _M0FP36mizchi4luna3dom15create__element("h3", props, children);
  }
  function _M0FP36mizchi4luna3dom2h4(id, class_, style, dyn_class, dyn_style, on, ref_, attrs, dyn_attrs, children) {
    const props = _M0FP36mizchi4luna3dom20build__props_2einner(id, class_, style, on, ref_, attrs, dyn_attrs);
    if (dyn_class === undefined) {
    } else {
      const _Some = dyn_class;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(props, { _0: "className", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    if (dyn_style === undefined) {
    } else {
      const _Some = dyn_style;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(props, { _0: "style", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    return _M0FP36mizchi4luna3dom15create__element("h4", props, children);
  }
  function _M0FP36mizchi4luna3dom2ul(id, class_, style, dyn_class, dyn_style, on, ref_, attrs, dyn_attrs, children) {
    const props = _M0FP36mizchi4luna3dom20build__props_2einner(id, class_, style, on, ref_, attrs, dyn_attrs);
    if (dyn_class === undefined) {
    } else {
      const _Some = dyn_class;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(props, { _0: "className", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    if (dyn_style === undefined) {
    } else {
      const _Some = dyn_style;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(props, { _0: "style", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    return _M0FP36mizchi4luna3dom15create__element("ul", props, children);
  }
  function _M0FP36mizchi4luna3dom2ol(id, class_, style, dyn_class, dyn_style, on, ref_, attrs, dyn_attrs, children) {
    const props = _M0FP36mizchi4luna3dom20build__props_2einner(id, class_, style, on, ref_, attrs, dyn_attrs);
    if (dyn_class === undefined) {
    } else {
      const _Some = dyn_class;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(props, { _0: "className", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    if (dyn_style === undefined) {
    } else {
      const _Some = dyn_style;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(props, { _0: "style", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    return _M0FP36mizchi4luna3dom15create__element("ol", props, children);
  }
  function _M0FP36mizchi4luna3dom2li(id, class_, style, dyn_class, dyn_style, on, ref_, attrs, dyn_attrs, children) {
    const props = _M0FP36mizchi4luna3dom20build__props_2einner(id, class_, style, on, ref_, attrs, dyn_attrs);
    if (dyn_class === undefined) {
    } else {
      const _Some = dyn_class;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(props, { _0: "className", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    if (dyn_style === undefined) {
    } else {
      const _Some = dyn_style;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(props, { _0: "style", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
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
        _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(props, _M0FP36mizchi4luna3dom6buttonN5tupleS2264);
      }
    }
    if (dyn_class === undefined) {
    } else {
      const _Some = dyn_class;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(props, { _0: "className", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    if (dyn_style === undefined) {
    } else {
      const _Some = dyn_style;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(props, { _0: "style", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    if (dyn_disabled === undefined) {
    } else {
      const _Some = dyn_disabled;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(props, { _0: "disabled", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(() => {
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
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(props, { _0: "type", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_v) });
    }
    if (name === undefined) {
    } else {
      const _Some = name;
      const _v = _Some;
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(props, { _0: "name", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_v) });
    }
    if (value === undefined) {
    } else {
      const _Some = value;
      const _v = _Some;
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(props, { _0: "value", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_v) });
    }
    if (placeholder === undefined) {
    } else {
      const _Some = placeholder;
      const _v = _Some;
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(props, { _0: "placeholder", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_v) });
    }
    if (disabled === -1) {
    } else {
      const _Some = disabled;
      const _x = _Some;
      if (_x === true) {
        _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(props, _M0FP36mizchi4luna3dom5inputN5tupleS2287);
      }
    }
    if (readonly_ === -1) {
    } else {
      const _Some = readonly_;
      const _x = _Some;
      if (_x === true) {
        _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(props, _M0FP36mizchi4luna3dom5inputN5tupleS2289);
      }
    }
    if (required === -1) {
    } else {
      const _Some = required;
      const _x = _Some;
      if (_x === true) {
        _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(props, _M0FP36mizchi4luna3dom5inputN5tupleS2291);
      }
    }
    if (checked === -1) {
    } else {
      const _Some = checked;
      const _x = _Some;
      if (_x === true) {
        _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(props, _M0FP36mizchi4luna3dom5inputN5tupleS2293);
      }
    }
    if (dyn_class === undefined) {
    } else {
      const _Some = dyn_class;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(props, { _0: "className", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    if (dyn_style === undefined) {
    } else {
      const _Some = dyn_style;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(props, { _0: "style", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    if (dyn_value === undefined) {
    } else {
      const _Some = dyn_value;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(props, { _0: "value", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    if (dyn_disabled === undefined) {
    } else {
      const _Some = dyn_disabled;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(props, { _0: "disabled", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(() => {
        const _p = _getter();
        return _p ? "true" : "false";
      }) });
    }
    if (dyn_checked === undefined) {
    } else {
      const _Some = dyn_checked;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(props, { _0: "checked", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(() => {
        const _p = _getter();
        return _p ? "true" : "false";
      }) });
    }
    return _M0FP36mizchi4luna3dom15create__element("input", props, []);
  }
  function _M0FP36mizchi4luna3dom8textarea(name, placeholder, disabled, id, class_, style, dyn_class, dyn_style, on, ref_, attrs, dyn_attrs, children) {
    const props = _M0FP36mizchi4luna3dom20build__props_2einner(id, class_, style, on, ref_, attrs, dyn_attrs);
    if (name === undefined) {
    } else {
      const _Some = name;
      const _v = _Some;
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(props, { _0: "name", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_v) });
    }
    if (placeholder === undefined) {
    } else {
      const _Some = placeholder;
      const _v = _Some;
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(props, { _0: "placeholder", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_v) });
    }
    if (disabled === -1) {
    } else {
      const _Some = disabled;
      const _x = _Some;
      if (_x === true) {
        _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(props, _M0FP36mizchi4luna3dom8textareaN5tupleS2342);
      }
    }
    if (dyn_class === undefined) {
    } else {
      const _Some = dyn_class;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(props, { _0: "className", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    if (dyn_style === undefined) {
    } else {
      const _Some = dyn_style;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(props, { _0: "style", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    return _M0FP36mizchi4luna3dom15create__element("textarea", props, children);
  }
  function _M0FP36mizchi4luna3dom4form(action, http_method, id, class_, style, dyn_class, dyn_style, on, ref_, attrs, dyn_attrs, children) {
    const props = _M0FP36mizchi4luna3dom20build__props_2einner(id, class_, style, on, ref_, attrs, dyn_attrs);
    if (action === undefined) {
    } else {
      const _Some = action;
      const _v = _Some;
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(props, { _0: "action", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_v) });
    }
    if (http_method === undefined) {
    } else {
      const _Some = http_method;
      const _v = _Some;
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(props, { _0: "method", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_v) });
    }
    if (dyn_class === undefined) {
    } else {
      const _Some = dyn_class;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(props, { _0: "className", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    if (dyn_style === undefined) {
    } else {
      const _Some = dyn_style;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(props, { _0: "style", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    return _M0FP36mizchi4luna3dom15create__element("form", props, children);
  }
  function _M0FP36mizchi4luna3dom6strong(id, class_, style, dyn_class, dyn_style, on, ref_, attrs, dyn_attrs, children) {
    const props = _M0FP36mizchi4luna3dom20build__props_2einner(id, class_, style, on, ref_, attrs, dyn_attrs);
    if (dyn_class === undefined) {
    } else {
      const _Some = dyn_class;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(props, { _0: "className", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    if (dyn_style === undefined) {
    } else {
      const _Some = dyn_style;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(props, { _0: "style", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    return _M0FP36mizchi4luna3dom15create__element("strong", props, children);
  }
  function _M0FP36mizchi4luna3dom4code(id, class_, style, dyn_class, dyn_style, on, ref_, attrs, dyn_attrs, children) {
    const props = _M0FP36mizchi4luna3dom20build__props_2einner(id, class_, style, on, ref_, attrs, dyn_attrs);
    if (dyn_class === undefined) {
    } else {
      const _Some = dyn_class;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(props, { _0: "className", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    if (dyn_style === undefined) {
    } else {
      const _Some = dyn_style;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(props, { _0: "style", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    return _M0FP36mizchi4luna3dom15create__element("code", props, children);
  }
  function _M0FP36mizchi4luna3dom3pre(id, class_, style, dyn_class, dyn_style, on, ref_, attrs, dyn_attrs, children) {
    const props = _M0FP36mizchi4luna3dom20build__props_2einner(id, class_, style, on, ref_, attrs, dyn_attrs);
    if (dyn_class === undefined) {
    } else {
      const _Some = dyn_class;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(props, { _0: "className", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    if (dyn_style === undefined) {
    } else {
      const _Some = dyn_style;
      const _getter = _Some;
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(props, { _0: "style", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(_getter) });
    }
    return _M0FP36mizchi4luna3dom15create__element("pre", props, children);
  }
  function _M0FP36mizchi4luna3dom4text(content) {
    return _M0IPC16string6StringP36mizchi4luna3dom9ToDomNode13to__dom__node(content);
  }
  function _M0FP36mizchi4luna3dom9text__dyn(content) {
    return _M0FP36mizchi4luna3dom10text__node(content);
  }
  function _M0FP314vlmkit_2dsites4chat4main9fresh__id() {
    const v = _M0FP314vlmkit_2dsites4chat4main8next__id.val;
    _M0FP314vlmkit_2dsites4chat4main8next__id.val = v + 1 | 0;
    return v;
  }
  function _M0FP314vlmkit_2dsites4chat4main8new__msg(role, text, complete) {
    return new _M0TP314vlmkit_2dsites4chat4main3Msg(_M0FP314vlmkit_2dsites4chat4main9fresh__id(), role, _M0FP26mizchi7signals6signalGsE(text), _M0FP26mizchi7signals6signalGiE(complete ? text.length : 0), _M0FP26mizchi7signals6signalGbE(!complete), _M0FP26mizchi7signals6signalGbE(false), _M0FP26mizchi7signals6signalGiE(0), _M0FP26mizchi7signals6signalGbE(false), _M0FP26mizchi7signals6signalGbE(false), _M0FP26mizchi7signals6signalGbE(false), _M0FP26mizchi7signals6signalGiE(-1));
  }
  function _M0MP314vlmkit_2dsites4chat4main3Msg7visible(self) {
    const t = _M0MP26mizchi7signals6Signal3getGsE(self.text);
    const n = _M0MP26mizchi7signals6Signal3getGiE(self.shown);
    return n >= t.length ? t : _M0MPC16string6String17substring_2einner(t, 0, n);
  }
  function _M0FP314vlmkit_2dsites4chat4main11seed__convs() {
    if (_M0FP314vlmkit_2dsites4chat4main12seed__titles.length === 0) {
      return [];
    }
    const _p = new Array(_M0FP314vlmkit_2dsites4chat4main12seed__titles.length);
    const _p$2 = _M0FP314vlmkit_2dsites4chat4main12seed__titles.length;
    let _tmp = 0;
    while (true) {
      const _p$3 = _tmp;
      if (_p$3 < _p$2) {
        const _p$4 = _M0FP314vlmkit_2dsites4chat4main12seed__titles[_p$3];
        const _p$5 = _p$4._0;
        const _p$6 = _p$4._1;
        const _p$7 = _p$3 === 0 ? [_M0FP314vlmkit_2dsites4chat4main8new__msg("user", _M0FP314vlmkit_2dsites4chat4main9lunar__q1, true), _M0FP314vlmkit_2dsites4chat4main8new__msg("assistant", _M0FP314vlmkit_2dsites4chat4main9lunar__a1, true), _M0FP314vlmkit_2dsites4chat4main8new__msg("user", _M0FP314vlmkit_2dsites4chat4main9lunar__q2, true), _M0FP314vlmkit_2dsites4chat4main8new__msg("assistant", _M0FP314vlmkit_2dsites4chat4main9lunar__a2, true)] : [_M0FP314vlmkit_2dsites4chat4main8new__msg("user", _p$5, true), _M0FP314vlmkit_2dsites4chat4main8new__msg("assistant", `Picking up where we left off on **${_p$5}**. Last time we agreed on the main points, and I said I would keep the next step short.\n\nTell me what has changed since then, or ask me to summarize the thread so far, and I will take it from there.`, true)];
        _p[_p$3] = new _M0TP314vlmkit_2dsites4chat4main4Conv(_M0FP314vlmkit_2dsites4chat4main9fresh__id(), _M0FP26mizchi7signals6signalGsE(_p$5), _p$6, _M0FP26mizchi7signals6signalGRPB5ArrayGRP314vlmkit_2dsites4chat4main4ConvEE(_p$7));
        _tmp = _p$3 + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return _p;
  }
  function _M0FP314vlmkit_2dsites4chat4main11set__drawer(open) {
    _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4chat4main12drawer__anim, true);
    _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4chat4main6drawer, open);
  }
  function _M0FP314vlmkit_2dsites4chat4main10find__conv(id) {
    const _bind = _M0MP26mizchi7signals6Signal3getGRPB5ArrayGRP314vlmkit_2dsites4chat4main4ConvEE(_M0FP314vlmkit_2dsites4chat4main5convs);
    const _bind$2 = _bind.length;
    let _tmp = 0;
    while (true) {
      const _ = _tmp;
      if (_ < _bind$2) {
        const c = _bind[_];
        if (c.id === id) {
          return c;
        }
        _tmp = _ + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return undefined;
  }
  function _M0FP314vlmkit_2dsites4chat4main13current__conv() {
    return _M0FP314vlmkit_2dsites4chat4main10find__conv(_M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4chat4main7current));
  }
  function _M0FP314vlmkit_2dsites4chat4main14current__title() {
    const _bind = _M0FP314vlmkit_2dsites4chat4main13current__conv();
    if (_bind === undefined) {
      return "New chat";
    } else {
      const _Some = _bind;
      const _c = _Some;
      return _M0MP26mizchi7signals6Signal3getGsE(_c.title);
    }
  }
  function _M0FP314vlmkit_2dsites4chat4main11model__name() {
    const id = _M0MP26mizchi7signals6Signal3getGsE(_M0FP314vlmkit_2dsites4chat4main5model);
    const _bind = _M0FP314vlmkit_2dsites4chat4main6models.length;
    let _tmp = 0;
    while (true) {
      const _ = _tmp;
      if (_ < _bind) {
        const m = _M0FP314vlmkit_2dsites4chat4main6models[_];
        if (m.id === id) {
          return m.name;
        }
        _tmp = _ + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return "Parley Swift";
  }
  function _M0FP314vlmkit_2dsites4chat4main3say(s) {
    _M0MP26mizchi7signals6Signal3setGsE(_M0FP314vlmkit_2dsites4chat4main6status, s);
  }
  function _M0FP314vlmkit_2dsites4chat4main10at__bottom() {
    const sc = _M0FP314vlmkit_2dsites4chat4main8scroller.val;
    if (_M0FP26mizchi8js__core11is__nullish(sc)) {
      return true;
    }
    const top = _M0MP26mizchi8js__core3Any5__get(sc, "scrollTop");
    const h = _M0MP26mizchi8js__core3Any5__get(sc, "scrollHeight");
    const ch = _M0MP26mizchi8js__core3Any5__get(sc, "clientHeight");
    return h - top - ch < 48;
  }
  function _M0FP314vlmkit_2dsites4chat4main15scroll__to__end() {
    const sc = _M0FP314vlmkit_2dsites4chat4main8scroller.val;
    if (!_M0FP26mizchi8js__core11is__nullish(sc)) {
      _M0MP26mizchi8js__core3Any5__set(sc, "scrollTop", _M0MP26mizchi8js__core3Any5__get(sc, "scrollHeight"));
    }
    _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4chat4main6pinned, true);
  }
  function _M0FP314vlmkit_2dsites4chat4main6follow() {
    if (_M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4chat4main6pinned)) {
      const sc = _M0FP314vlmkit_2dsites4chat4main8scroller.val;
      if (!_M0FP26mizchi8js__core11is__nullish(sc)) {
        _M0MP26mizchi8js__core3Any5__set(sc, "scrollTop", _M0MP26mizchi8js__core3Any5__get(sc, "scrollHeight"));
        return;
      } else {
        return;
      }
    } else {
      return;
    }
  }
  function _M0FP314vlmkit_2dsites4chat4main9next__cut(t, from, words) {
    const cs = _M0MPB4Iter9to__arrayGcE(_M0MPC16string6String4iter(t));
    const n = cs.length;
    let i = from;
    let w = 0;
    while (true) {
      if (w < words && i < n) {
        while (true) {
          let _tmp;
          if (i < n) {
            const _p = _M0MPC15array5Array2atGcE(cs, i);
            _tmp = _p === 32 || (_p === 10 || _p === 9);
          } else {
            _tmp = false;
          }
          if (_tmp) {
            i = i + 1 | 0;
            continue;
          } else {
            break;
          }
        }
        while (true) {
          let _tmp;
          if (i < n) {
            const _p = _M0MPC15array5Array2atGcE(cs, i);
            _tmp = !(_p === 32 || (_p === 10 || _p === 9));
          } else {
            _tmp = false;
          }
          if (_tmp) {
            i = i + 1 | 0;
            continue;
          } else {
            break;
          }
        }
        w = w + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return i;
  }
  function _M0FP314vlmkit_2dsites4chat4main6finish(m) {
    _M0MP26mizchi7signals6Signal3setGbE(m.streaming, false);
    _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4chat4main4busy, false);
    _M0FP314vlmkit_2dsites4chat4main6active.val = undefined;
    _M0FP314vlmkit_2dsites4chat4main5timer.val = -1;
    _M0FP314vlmkit_2dsites4chat4main6follow();
  }
  function _M0FP314vlmkit_2dsites4chat4main3win() {
    return _M0FP26mizchi8js__core12global__this();
  }
  function _M0FP314vlmkit_2dsites4chat4main12set__timeout(f, ms) {
    return _M0MP26mizchi8js__core3Any6__call(_M0FP314vlmkit_2dsites4chat4main3win(), "setTimeout", [f, ms]);
  }
  function _M0FP314vlmkit_2dsites4chat4main4tick() {
    const _bind = _M0FP314vlmkit_2dsites4chat4main6active.val;
    if (_bind === undefined) {
      return;
    } else {
      const _Some = _bind;
      const _m = _Some;
      const t = _M0MP26mizchi7signals6Signal3getGsE(_m.text);
      const cut = _M0FP314vlmkit_2dsites4chat4main9next__cut(t, _M0MP26mizchi7signals6Signal3getGiE(_m.shown), 3);
      _M0MP26mizchi7signals6Signal3setGiE(_m.shown, cut);
      _M0FP314vlmkit_2dsites4chat4main6follow();
      if (cut >= t.length) {
        _M0FP314vlmkit_2dsites4chat4main6finish(_m);
        return;
      } else {
        _M0FP314vlmkit_2dsites4chat4main5timer.val = _M0FP314vlmkit_2dsites4chat4main12set__timeout(_M0FP314vlmkit_2dsites4chat4main4tick, 50);
        return;
      }
    }
  }
  function _M0FP314vlmkit_2dsites4chat4main13start__stream(m) {
    _M0FP26mizchi7signals5batchGuE(() => {
      _M0MP26mizchi7signals6Signal3setGbE(m.stopped, false);
      _M0MP26mizchi7signals6Signal3setGiE(m.feedback, 0);
      _M0MP26mizchi7signals6Signal3setGbE(m.streaming, true);
      _M0MP26mizchi7signals6Signal3setGiE(m.shown, 0);
      _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4chat4main4busy, true);
    });
    _M0FP314vlmkit_2dsites4chat4main6active.val = m;
    if (_M0FP314vlmkit_2dsites4chat4main7instant.val) {
      _M0MP26mizchi7signals6Signal3setGiE(m.shown, _M0MP26mizchi7signals6Signal3getGsE(m.text).length);
      _M0FP314vlmkit_2dsites4chat4main6finish(m);
      return;
    } else {
      _M0FP314vlmkit_2dsites4chat4main5timer.val = _M0FP314vlmkit_2dsites4chat4main12set__timeout(_M0FP314vlmkit_2dsites4chat4main4tick, 50);
      return;
    }
  }
  function _M0FP314vlmkit_2dsites4chat4main14clear__timeout(id) {
    _M0MP26mizchi8js__core3Any6__call(_M0FP314vlmkit_2dsites4chat4main3win(), "clearTimeout", [id]);
  }
  function _M0FP314vlmkit_2dsites4chat4main12stop__stream() {
    const _bind = _M0FP314vlmkit_2dsites4chat4main6active.val;
    if (_bind === undefined) {
      return;
    } else {
      const _Some = _bind;
      const _m = _Some;
      if (_M0FP314vlmkit_2dsites4chat4main5timer.val >= 0) {
        _M0FP314vlmkit_2dsites4chat4main14clear__timeout(_M0FP314vlmkit_2dsites4chat4main5timer.val);
      }
      _M0FP314vlmkit_2dsites4chat4main5timer.val = -1;
      _M0FP314vlmkit_2dsites4chat4main6active.val = undefined;
      _M0FP26mizchi7signals5batchGuE(() => {
        _M0MP26mizchi7signals6Signal3setGbE(_m.streaming, false);
        _M0MP26mizchi7signals6Signal3setGbE(_m.stopped, true);
        _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4chat4main4busy, false);
      });
      _M0FP314vlmkit_2dsites4chat4main6follow();
      _M0FP314vlmkit_2dsites4chat4main3say("Stopped");
      return;
    }
  }
  function _M0FP314vlmkit_2dsites4chat4main12short__title(text) {
    if (text.length <= 42) {
      return text;
    }
    const cut = _M0MPC16string6String17substring_2einner(text, 0, _M0FP314vlmkit_2dsites4chat4main12short__titleN6constrS2515);
    _L: {
      const _bind = _M0MPC16string6String9rev__find(cut, _M0FP314vlmkit_2dsites4chat4main12short__titleN6recordS2516);
      if (_bind === undefined) {
        break _L;
      } else {
        const _Some = _bind;
        const _i = _Some;
        if (_i > 20) {
          return `${_M0MPC16string6String17substring_2einner(cut, 0, _i)}…`;
        } else {
          break _L;
        }
      }
    }
    return `${cut}…`;
  }
  function _M0FP314vlmkit_2dsites4chat4main13clear__prompt() {
    _M0MP26mizchi7signals6Signal3setGsE(_M0FP314vlmkit_2dsites4chat4main5draft, "");
    const el = _M0FP314vlmkit_2dsites4chat4main10prompt__el.val;
    if (!_M0FP26mizchi8js__core11is__nullish(el)) {
      _M0MP26mizchi8js__core3Any5__set(el, "value", "");
      _M0MP26mizchi8js__core3Any5__set(_M0MP26mizchi8js__core3Any5__get(el, "style"), "height", "");
      return;
    } else {
      return;
    }
  }
  function _M0FP314vlmkit_2dsites4chat4main11pick__reply(prompt) {
    const p = _M0MPC16string6String9to__lower(prompt);
    return _M0MPC16string6String8contains(p, _M0FP314vlmkit_2dsites4chat4main11pick__replyN6recordS2524) || (_M0MPC16string6String8contains(p, _M0FP314vlmkit_2dsites4chat4main11pick__replyN6recordS2525) || _M0MPC16string6String8contains(p, _M0FP314vlmkit_2dsites4chat4main11pick__replyN6recordS2526)) ? _M0FP314vlmkit_2dsites4chat4main12reply__table : _M0MPC16string6String8contains(p, _M0FP314vlmkit_2dsites4chat4main11pick__replyN6recordS2527) || (_M0MPC16string6String8contains(p, _M0FP314vlmkit_2dsites4chat4main11pick__replyN6recordS2528) || (_M0MPC16string6String8contains(p, _M0FP314vlmkit_2dsites4chat4main11pick__replyN6recordS2529) || _M0MPC16string6String8contains(p, _M0FP314vlmkit_2dsites4chat4main11pick__replyN6recordS2530))) ? _M0FP314vlmkit_2dsites4chat4main11reply__code : _M0MPC16string6String8contains(p, _M0FP314vlmkit_2dsites4chat4main11pick__replyN6recordS2531) || (_M0MPC16string6String8contains(p, _M0FP314vlmkit_2dsites4chat4main11pick__replyN6recordS2532) || (_M0MPC16string6String8contains(p, _M0FP314vlmkit_2dsites4chat4main11pick__replyN6recordS2533) || _M0MPC16string6String8contains(p, _M0FP314vlmkit_2dsites4chat4main11pick__replyN6recordS2534))) ? _M0FP314vlmkit_2dsites4chat4main11reply__list : _M0MPC16string6String8contains(p, _M0FP314vlmkit_2dsites4chat4main11pick__replyN6recordS2535) || (_M0MPC16string6String8contains(p, _M0FP314vlmkit_2dsites4chat4main11pick__replyN6recordS2536) || (_M0MPC16string6String8contains(p, _M0FP314vlmkit_2dsites4chat4main11pick__replyN6recordS2537) || _M0MPC16string6String8contains(p, _M0FP314vlmkit_2dsites4chat4main11pick__replyN6recordS2538))) ? _M0FP314vlmkit_2dsites4chat4main11reply__moon : _M0FP314vlmkit_2dsites4chat4main14reply__default;
  }
  function _M0FP314vlmkit_2dsites4chat4main10send__text(raw) {
    const text = _M0MPC16string10StringView9to__owned(_M0MPC16string6String4trim(raw, undefined));
    if (text === "" || _M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4chat4main4busy)) {
      return undefined;
    }
    const _bind = _M0FP314vlmkit_2dsites4chat4main13current__conv();
    let conv;
    if (_bind === undefined) {
      const _bind$2 = _M0FP314vlmkit_2dsites4chat4main9fresh__id();
      const _bind$3 = _M0FP26mizchi7signals6signalGsE(_M0FP314vlmkit_2dsites4chat4main12short__title(text));
      const _bind$4 = _M0FP26mizchi7signals6signalGRPB5ArrayGRP314vlmkit_2dsites4chat4main4ConvEE([]);
      const c = new _M0TP314vlmkit_2dsites4chat4main4Conv(_bind$2, _bind$3, _M0FP314vlmkit_2dsites4chat4main10send__textN7_2abindS2541, _bind$4);
      const list = [c];
      const _bind$5 = _M0MP26mizchi7signals6Signal3getGRPB5ArrayGRP314vlmkit_2dsites4chat4main4ConvEE(_M0FP314vlmkit_2dsites4chat4main5convs);
      const _bind$6 = _bind$5.length;
      let _tmp = 0;
      while (true) {
        const _ = _tmp;
        if (_ < _bind$6) {
          const o = _bind$5[_];
          _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(list, o);
          _tmp = _ + 1 | 0;
          continue;
        } else {
          break;
        }
      }
      _M0MP26mizchi7signals6Signal3setGRPB5ArrayGRP314vlmkit_2dsites4chat4main4ConvEE(_M0FP314vlmkit_2dsites4chat4main5convs, list);
      _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4chat4main7current, _bind$2);
      conv = c;
    } else {
      const _Some = _bind;
      conv = _Some;
    }
    const u = _M0FP314vlmkit_2dsites4chat4main8new__msg("user", text, true);
    const a = _M0FP314vlmkit_2dsites4chat4main8new__msg("assistant", _M0FP314vlmkit_2dsites4chat4main11pick__reply(text), false);
    _M0MP26mizchi7signals6Signal6updateGRPB5ArrayGRP314vlmkit_2dsites4chat4main3MsgEE(conv.messages, (ms) => {
      const n = _M0MPC15array5Array4copyGRP314vlmkit_2dsites4chat4main3MsgE(ms);
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(n, u);
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(n, a);
      return n;
    });
    _M0FP314vlmkit_2dsites4chat4main13clear__prompt();
    _M0FP314vlmkit_2dsites4chat4main15scroll__to__end();
    _M0FP314vlmkit_2dsites4chat4main13start__stream(a);
  }
  function _M0FP314vlmkit_2dsites4chat4main10open__conv(id) {
    _M0FP314vlmkit_2dsites4chat4main12stop__stream();
    _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4chat4main7current, id);
    _M0FP314vlmkit_2dsites4chat4main11set__drawer(false);
    _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4chat4main9row__menu, -1);
    _M0FP314vlmkit_2dsites4chat4main12set__timeout(() => {
      _M0FP314vlmkit_2dsites4chat4main15scroll__to__end();
    }, 0);
  }
  function _M0FP314vlmkit_2dsites4chat4main3doc() {
    return _M0MP26mizchi8js__core3Any5__get(_M0FP314vlmkit_2dsites4chat4main3win(), "document");
  }
  function _M0FP314vlmkit_2dsites4chat4main10active__el() {
    return _M0MP26mizchi8js__core3Any5__get(_M0FP314vlmkit_2dsites4chat4main3doc(), "activeElement");
  }
  function _M0FP314vlmkit_2dsites4chat4main9focus__el(el) {
    if (!_M0FP26mizchi8js__core11is__nullish(el)) {
      _M0MP26mizchi8js__core3Any6__call(el, "focus", []);
      return;
    } else {
      return;
    }
  }
  function _M0FP314vlmkit_2dsites4chat4main2qs(sel) {
    return _M0MP26mizchi8js__core3Any6__call(_M0FP314vlmkit_2dsites4chat4main3doc(), "querySelector", [sel]);
  }
  function _M0FP314vlmkit_2dsites4chat4main10focus__sel(sel) {
    _M0FP314vlmkit_2dsites4chat4main9focus__el(_M0FP314vlmkit_2dsites4chat4main2qs(sel));
  }
  function _M0FP314vlmkit_2dsites4chat4main12later__focus(sel) {
    const el = _M0FP314vlmkit_2dsites4chat4main2qs(sel);
    _M0FP314vlmkit_2dsites4chat4main9focus__el(el);
    if (_M0FP26mizchi8js__core11is__nullish(el) || !_M0FP26mizchi8js__core5equal(_M0FP314vlmkit_2dsites4chat4main10active__el(), el)) {
      _M0FP314vlmkit_2dsites4chat4main12set__timeout(() => {
        _M0FP314vlmkit_2dsites4chat4main10focus__sel(sel);
      }, 0);
      return;
    } else {
      return;
    }
  }
  function _M0FP314vlmkit_2dsites4chat4main9new__chat() {
    _M0FP314vlmkit_2dsites4chat4main12stop__stream();
    _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4chat4main7current, -1);
    _M0FP314vlmkit_2dsites4chat4main11set__drawer(false);
    _M0FP314vlmkit_2dsites4chat4main13clear__prompt();
    _M0FP314vlmkit_2dsites4chat4main12later__focus("#prompt");
  }
  function _M0FP314vlmkit_2dsites4chat4main12close__menus() {
    _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4chat4main11model__open, false);
    _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4chat4main12attach__open, false);
    _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4chat4main9row__menu, -1);
  }
  function _M0FP314vlmkit_2dsites4chat4main12remove__conv(id) {
    const _p = _M0MP26mizchi7signals6Signal3getGRPB5ArrayGRP314vlmkit_2dsites4chat4main4ConvEE(_M0FP314vlmkit_2dsites4chat4main5convs);
    const _p$2 = [];
    const _p$3 = _p.length;
    let _tmp;
    let _tmp$2 = 0;
    while (true) {
      const _p$4 = _tmp$2;
      if (_p$4 < _p$3) {
        const _p$5 = _p[_p$4];
        if (_p$5.id !== id) {
          _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(_p$2, _p$5);
        }
        _tmp$2 = _p$4 + 1 | 0;
        continue;
      } else {
        _tmp = _p$2;
        break;
      }
    }
    _M0MP26mizchi7signals6Signal3setGRPB5ArrayGRP314vlmkit_2dsites4chat4main4ConvEE(_M0FP314vlmkit_2dsites4chat4main5convs, _tmp);
    if (_M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4chat4main7current) === id) {
      _M0FP314vlmkit_2dsites4chat4main9new__chat();
      return;
    } else {
      return;
    }
  }
  function _M0FP314vlmkit_2dsites4chat4main7trim__s(s) {
    return _M0MPC16string10StringView9to__owned(_M0MPC16string6String4trim(s, undefined));
  }
  function _M0FP314vlmkit_2dsites4chat4main12split__lines(s) {
    return _M0MPB4Iter9to__arrayGsE(_M0MPB4Iter3mapGRPC16string10StringViewsE(_M0MPC16string6String5split(s, _M0FP314vlmkit_2dsites4chat4main12split__linesN6recordS2570), (v) => _M0MPC16string10StringView9to__owned(v)));
  }
  function _M0FP314vlmkit_2dsites4chat4main12is__numbered(line) {
    const chars = _M0MPB4Iter9to__arrayGcE(_M0MPC16string6String4iter(line));
    let i = 0;
    while (true) {
      if (i < chars.length && (_M0MPC15array5Array2atGcE(chars, i) >= 48 && _M0MPC15array5Array2atGcE(chars, i) <= 57)) {
        i = i + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return i > 0 && ((i + 1 | 0) < chars.length && (_M0MPC15array5Array2atGcE(chars, i) === 46 && _M0MPC15array5Array2atGcE(chars, i + 1 | 0) === 32));
  }
  function _M0FP314vlmkit_2dsites4chat4main13after__number(line) {
    const _bind = _M0MPC16string6String4find(line, _M0FP314vlmkit_2dsites4chat4main13after__numberN6recordS2577);
    if (_bind === undefined) {
      return line;
    } else {
      const _Some = _bind;
      const _i = _Some;
      return _M0MPC16string6String17substring_2einner(line, _i + 2 | 0, undefined);
    }
  }
  function _M0FP314vlmkit_2dsites4chat4main12table__cells(line) {
    const t = _M0FP314vlmkit_2dsites4chat4main7trim__s(line);
    const inner = _M0MPC16string6String11has__prefix(t, _M0FP314vlmkit_2dsites4chat4main12table__cellsN6recordS2582) ? _M0MPC16string6String17substring_2einner(t, 1, undefined) : t;
    const inner2 = _M0MPC16string6String11has__suffix(inner, _M0FP314vlmkit_2dsites4chat4main12table__cellsN6recordS2583) ? _M0MPC16string6String17substring_2einner(inner, 0, inner.length - 1 | 0) : inner;
    return _M0MPB4Iter9to__arrayGsE(_M0MPB4Iter3mapGRPC16string10StringViewsE(_M0MPC16string6String5split(inner2, _M0FP314vlmkit_2dsites4chat4main12table__cellsN6recordS2584), (c) => _M0MPC16string10StringView9to__owned(_M0MPC16string10StringView4trim(c, undefined))));
  }
  function _M0FP314vlmkit_2dsites4chat4main18is__separator__row(line) {
    const t = _M0FP314vlmkit_2dsites4chat4main7trim__s(line);
    return _M0MPC16string6String11has__prefix(t, _M0FP314vlmkit_2dsites4chat4main18is__separator__rowN6recordS2590) && _M0MPC16string6String8contains(t, _M0FP314vlmkit_2dsites4chat4main18is__separator__rowN6recordS2591);
  }
  function _M0FP314vlmkit_2dsites4chat4main13parse__blocksN11flush__paraS2594(_env) {
    const para = _env._1;
    const out = _env._0;
    if (para.length > 0) {
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(out, new _M0DTP314vlmkit_2dsites4chat4main5Block4Para(_M0MPC15array5Array4joinGsE(para, _M0FP314vlmkit_2dsites4chat4main13parse__blocksN6recordS2595)));
      _M0MPC15array5Array5clearGRP26mizchi7signals5OwnerE(para);
      return;
    } else {
      return;
    }
  }
  function _M0FP314vlmkit_2dsites4chat4main13parse__blocks(src) {
    const lines = _M0FP314vlmkit_2dsites4chat4main12split__lines(src);
    const out = [];
    const para = [];
    const _env = { _0: out, _1: para };
    let i = 0;
    while (true) {
      if (i < lines.length) {
        const line = _M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(lines, i);
        const t = _M0FP314vlmkit_2dsites4chat4main7trim__s(line);
        if (_M0MPC16string6String11has__prefix(t, _M0FP314vlmkit_2dsites4chat4main13parse__blocksN6recordS2596)) {
          _M0FP314vlmkit_2dsites4chat4main13parse__blocksN11flush__paraS2594(_env);
          const lang = _M0FP314vlmkit_2dsites4chat4main7trim__s(_M0MPC16string6String17substring_2einner(t, 3, undefined));
          const body = [];
          i = i + 1 | 0;
          while (true) {
            if (i < lines.length && !_M0MPC16string6String11has__prefix(_M0FP314vlmkit_2dsites4chat4main7trim__s(_M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(lines, i)), _M0FP314vlmkit_2dsites4chat4main13parse__blocksN6recordS2597)) {
              _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(body, _M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(lines, i));
              i = i + 1 | 0;
              continue;
            } else {
              break;
            }
          }
          _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(out, new _M0DTP314vlmkit_2dsites4chat4main5Block4Code(lang, _M0MPC15array5Array4joinGsE(body, _M0FP314vlmkit_2dsites4chat4main13parse__blocksN6recordS2598)));
          i = i + 1 | 0;
        } else {
          if (t === "") {
            _M0FP314vlmkit_2dsites4chat4main13parse__blocksN11flush__paraS2594(_env);
            i = i + 1 | 0;
          } else {
            if (_M0MPC16string6String11has__prefix(t, _M0FP314vlmkit_2dsites4chat4main13parse__blocksN6recordS2599)) {
              _M0FP314vlmkit_2dsites4chat4main13parse__blocksN11flush__paraS2594(_env);
              let level = 0;
              const _bind = t.length;
              let _tmp = 0;
              while (true) {
                const _string_index = _tmp;
                if (_string_index < _bind) {
                  let _decoded_next_string_index;
                  let _decoded_char;
                  _L: {
                    const _bind$2 = t.charCodeAt(_string_index);
                    if (_bind$2 >= 55296 && _bind$2 <= 56319 && (_string_index + 1 | 0) < _bind) {
                      const _bind$3 = t.charCodeAt(_string_index + 1 | 0);
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
                  if (_decoded_char === 35) {
                    level = level + 1 | 0;
                  } else {
                    break;
                  }
                  _tmp = _decoded_next_string_index;
                  continue;
                } else {
                  break;
                }
              }
              _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(out, new _M0DTP314vlmkit_2dsites4chat4main5Block7Heading(level, _M0FP314vlmkit_2dsites4chat4main7trim__s(_M0MPC16string6String17substring_2einner(t, level, undefined))));
              i = i + 1 | 0;
            } else {
              if (_M0MPC16string6String11has__prefix(t, _M0FP314vlmkit_2dsites4chat4main13parse__blocksN6recordS2600)) {
                _M0FP314vlmkit_2dsites4chat4main13parse__blocksN11flush__paraS2594(_env);
                const items = [];
                while (true) {
                  if (i < lines.length && _M0MPC16string6String11has__prefix(_M0FP314vlmkit_2dsites4chat4main7trim__s(_M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(lines, i)), _M0FP314vlmkit_2dsites4chat4main13parse__blocksN6recordS2601)) {
                    _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(items, _M0MPC16string6String17substring_2einner(_M0FP314vlmkit_2dsites4chat4main7trim__s(_M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(lines, i)), 2, undefined));
                    i = i + 1 | 0;
                    continue;
                  } else {
                    break;
                  }
                }
                _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(out, new _M0DTP314vlmkit_2dsites4chat4main5Block7Bullets(items));
              } else {
                if (_M0FP314vlmkit_2dsites4chat4main12is__numbered(t)) {
                  _M0FP314vlmkit_2dsites4chat4main13parse__blocksN11flush__paraS2594(_env);
                  const items = [];
                  while (true) {
                    if (i < lines.length && _M0FP314vlmkit_2dsites4chat4main12is__numbered(_M0FP314vlmkit_2dsites4chat4main7trim__s(_M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(lines, i)))) {
                      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(items, _M0FP314vlmkit_2dsites4chat4main13after__number(_M0FP314vlmkit_2dsites4chat4main7trim__s(_M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(lines, i))));
                      i = i + 1 | 0;
                      continue;
                    } else {
                      break;
                    }
                  }
                  _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(out, new _M0DTP314vlmkit_2dsites4chat4main5Block8Numbered(items));
                } else {
                  if (_M0MPC16string6String11has__prefix(t, _M0FP314vlmkit_2dsites4chat4main13parse__blocksN6recordS2602)) {
                    _M0FP314vlmkit_2dsites4chat4main13parse__blocksN11flush__paraS2594(_env);
                    const head = _M0FP314vlmkit_2dsites4chat4main12table__cells(t);
                    const rows = [];
                    i = i + 1 | 0;
                    while (true) {
                      if (i < lines.length && _M0MPC16string6String11has__prefix(_M0FP314vlmkit_2dsites4chat4main7trim__s(_M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(lines, i)), _M0FP314vlmkit_2dsites4chat4main13parse__blocksN6recordS2603)) {
                        if (!_M0FP314vlmkit_2dsites4chat4main18is__separator__row(_M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(lines, i))) {
                          _M0MPC15array5Array4pushGRP36mizchi11js__browser3dom4NodeE(rows, _M0FP314vlmkit_2dsites4chat4main12table__cells(_M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(lines, i)));
                        }
                        i = i + 1 | 0;
                        continue;
                      } else {
                        break;
                      }
                    }
                    _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(out, new _M0DTP314vlmkit_2dsites4chat4main5Block5Table(head, rows));
                  } else {
                    _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(para, t);
                    i = i + 1 | 0;
                  }
                }
              }
            }
          }
        }
        continue;
      } else {
        break;
      }
    }
    _M0FP314vlmkit_2dsites4chat4main13parse__blocksN11flush__paraS2594(_env);
    return out;
  }
  function _M0FP314vlmkit_2dsites4chat4main13parse__inlineN5flushS2635(_env) {
    const buf = _env._1;
    const out = _env._0;
    const v = buf.val;
    const _p = "";
    if (!(v === _p)) {
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(out, new _M0DTP314vlmkit_2dsites4chat4main6Inline5Plain(v));
    }
    _M0MPB13StringBuilder13reset_2einner(buf, true);
  }
  function _M0FP314vlmkit_2dsites4chat4main13parse__inlineN10find__fromS2636(_env, start, a, two) {
    const n = _env._1;
    const chars = _env._0;
    let j = start;
    while (true) {
      if (j < n) {
        if (_M0MPC15array5Array2atGcE(chars, j) === a && (!two || (j + 1 | 0) < n && _M0MPC15array5Array2atGcE(chars, j + 1 | 0) === a)) {
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
  function _M0FP314vlmkit_2dsites4chat4main13parse__inlineN5sliceS2637(chars, a, b) {
    const sb = _M0MPB13StringBuilder21StringBuilder_2einner(8);
    let _tmp = a;
    while (true) {
      const k = _tmp;
      if (k < b) {
        _M0IPB13StringBuilderPB6Logger11write__char(sb, _M0MPC15array5Array2atGcE(chars, k));
        _tmp = k + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return sb.val;
  }
  function _M0FP314vlmkit_2dsites4chat4main13parse__inline(s) {
    const chars = _M0MPB4Iter9to__arrayGcE(_M0MPC16string6String4iter(s));
    const n = chars.length;
    const out = [];
    const buf = _M0MPB13StringBuilder21StringBuilder_2einner(8);
    const _env = { _0: out, _1: buf };
    const _env$2 = { _0: chars, _1: n };
    let i = 0;
    while (true) {
      if (i < n) {
        const c = _M0MPC15array5Array2atGcE(chars, i);
        if (c === 42 && ((i + 1 | 0) < n && _M0MPC15array5Array2atGcE(chars, i + 1 | 0) === 42)) {
          const close = _M0FP314vlmkit_2dsites4chat4main13parse__inlineN10find__fromS2636(_env$2, i + 2 | 0, 42, true);
          if (close > (i + 2 | 0)) {
            _M0FP314vlmkit_2dsites4chat4main13parse__inlineN5flushS2635(_env);
            _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(out, new _M0DTP314vlmkit_2dsites4chat4main6Inline4Bold(_M0FP314vlmkit_2dsites4chat4main13parse__inlineN5sliceS2637(chars, i + 2 | 0, close)));
            i = close + 2 | 0;
            continue;
          }
        } else {
          if (c === 96) {
            const close = _M0FP314vlmkit_2dsites4chat4main13parse__inlineN10find__fromS2636(_env$2, i + 1 | 0, 96, false);
            if (close > (i + 1 | 0)) {
              _M0FP314vlmkit_2dsites4chat4main13parse__inlineN5flushS2635(_env);
              _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(out, new _M0DTP314vlmkit_2dsites4chat4main6Inline10InlineCode(_M0FP314vlmkit_2dsites4chat4main13parse__inlineN5sliceS2637(chars, i + 1 | 0, close)));
              i = close + 1 | 0;
              continue;
            }
          }
        }
        _M0IPB13StringBuilderPB6Logger11write__char(buf, c);
        i = i + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    _M0FP314vlmkit_2dsites4chat4main13parse__inlineN5flushS2635(_env);
    return out;
  }
  function _M0FP314vlmkit_2dsites4chat4main1s(name, v) {
    return { _0: name, _1: new _M0DTP36mizchi4luna3dom4Attr10AttrString(v) };
  }
  function _M0FP314vlmkit_2dsites4chat4main1d(name, f) {
    return { _0: name, _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(f) };
  }
  function _M0FP314vlmkit_2dsites4chat4main10svg__class(cls) {
    return (e) => {
      _M0MP26mizchi8js__core3Any6__call(e, "setAttribute", ["class", cls]);
    };
  }
  function _M0FP314vlmkit_2dsites4chat4main4icon(path) {
    return _M0FP36mizchi4luna3dom3svg(_M0FP314vlmkit_2dsites4chat4main4iconN6constrS2681, _M0FP314vlmkit_2dsites4chat4main4iconN6constrS2682, _M0FP314vlmkit_2dsites4chat4main4iconN6constrS2683, undefined, _M0FP314vlmkit_2dsites4chat4main4iconN6constrS2684, _M0FP314vlmkit_2dsites4chat4main4iconN6constrS2685, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, _M0FP314vlmkit_2dsites4chat4main10svg__class("icon"), new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4chat4main1s("aria-hidden", "true"), _M0FP314vlmkit_2dsites4chat4main1s("focusable", "false")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom9svg__path(path, undefined, undefined, _M0FP314vlmkit_2dsites4chat4main4iconN6constrS2686, _M0FP314vlmkit_2dsites4chat4main4iconN6constrS2687, _M0FP314vlmkit_2dsites4chat4main4iconN6constrS2688, undefined, undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__)]);
  }
  function _M0FP314vlmkit_2dsites4chat4main4logo(cls) {
    return _M0FP36mizchi4luna3dom3svg(_M0FP314vlmkit_2dsites4chat4main4logoN6constrS2690, _M0FP314vlmkit_2dsites4chat4main4logoN6constrS2691, _M0FP314vlmkit_2dsites4chat4main4logoN6constrS2692, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, _M0FP314vlmkit_2dsites4chat4main10svg__class(cls), new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4chat4main1s("aria-hidden", "true"), _M0FP314vlmkit_2dsites4chat4main1s("focusable", "false")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom9svg__path(_M0FP314vlmkit_2dsites4chat4main4logoN6constrS2693, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, _M0FP314vlmkit_2dsites4chat4main10svg__class("logo-bubble"), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__), _M0FP36mizchi4luna3dom9svg__path(_M0FP314vlmkit_2dsites4chat4main4logoN6constrS2694, undefined, undefined, _M0FP314vlmkit_2dsites4chat4main4logoN6constrS2695, _M0FP314vlmkit_2dsites4chat4main4logoN6constrS2696, undefined, undefined, undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, _M0FP314vlmkit_2dsites4chat4main10svg__class("logo-lines"), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__)]);
  }
  function _M0FP314vlmkit_2dsites4chat4main20icon__button_2einner(label, path, cls, id, on, extra) {
    const attrs = [_M0FP314vlmkit_2dsites4chat4main1s("type", "button"), _M0FP314vlmkit_2dsites4chat4main1s("aria-label", label), _M0FP314vlmkit_2dsites4chat4main1s("title", label)];
    const _p = "";
    if (!(id === _p)) {
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(attrs, _M0FP314vlmkit_2dsites4chat4main1s("id", id));
    }
    return _M0FP36mizchi4luna3dom6button(-1, undefined, cls, undefined, undefined, undefined, undefined, new _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4Some(on), undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some(attrs), new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4Some(extra), [_M0FP314vlmkit_2dsites4chat4main4icon(path)]);
  }
  function _M0FP314vlmkit_2dsites4chat4main12icon__button(label, path, cls$46$opt, id$46$opt, on$46$opt, extra$46$opt) {
    let cls;
    if (cls$46$opt === undefined) {
      cls = "icon-btn";
    } else {
      const _Some = cls$46$opt;
      cls = _Some;
    }
    let id;
    if (id$46$opt === undefined) {
      id = "";
    } else {
      const _Some = id$46$opt;
      id = _Some;
    }
    let on;
    if (on$46$opt.$tag === 1) {
      const _Some = on$46$opt;
      on = _Some._0;
    } else {
      on = _M0FP36mizchi4luna3dom6events();
    }
    let extra;
    if (extra$46$opt.$tag === 1) {
      const _Some = extra$46$opt;
      extra = _Some._0;
    } else {
      extra = [];
    }
    return _M0FP314vlmkit_2dsites4chat4main20icon__button_2einner(label, path, cls, id, on, extra);
  }
  function _M0FP314vlmkit_2dsites4chat4main15open__row__menu(c) {
    if (_M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4chat4main9row__menu) === c.id) {
      _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4chat4main9row__menu, -1);
      return undefined;
    }
    _M0FP314vlmkit_2dsites4chat4main12close__menus();
    const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(6);
    _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, "#more-");
    _M0MPB13StringBuilder13write__objectGiE(_string_builder, c.id);
    const btn = _M0FP314vlmkit_2dsites4chat4main2qs(_string_builder.val);
    if (!_M0FP26mizchi8js__core11is__nullish(btn)) {
      const r = _M0MP26mizchi8js__core3Any6__call(btn, "getBoundingClientRect", []);
      const bottom = _M0MP26mizchi8js__core3Any5__get(r, "bottom");
      const top = _M0MP26mizchi8js__core3Any5__get(r, "top");
      const right = _M0MP26mizchi8js__core3Any5__get(r, "right");
      const vh = _M0MP26mizchi8js__core3Any5__get(_M0FP314vlmkit_2dsites4chat4main3win(), "innerHeight");
      const y = bottom + 4 + 150 > vh ? top - 150 - 4 : bottom + 4;
      const x = right - 184 < 8 ? 8 : right - 184;
      const _string_builder$2 = _M0MPB13StringBuilder21StringBuilder_2einner(17);
      _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$2, "top: ");
      _M0MPB13StringBuilder13write__objectGiE(_string_builder$2, _M0MPC16double6Double7to__int(y));
      _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$2, "px; left: ");
      _M0MPB13StringBuilder13write__objectGiE(_string_builder$2, _M0MPC16double6Double7to__int(x));
      _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$2, "px");
      _M0MP26mizchi7signals6Signal3setGsE(_M0FP314vlmkit_2dsites4chat4main16row__menu__style, _string_builder$2.val);
    }
    _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4chat4main9row__menu, c.id);
    _M0FP314vlmkit_2dsites4chat4main12later__focus("#row-menu [role=menuitem]");
  }
  function _M0FP314vlmkit_2dsites4chat4main16close__row__menu(refocus) {
    const id = _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4chat4main9row__menu);
    _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4chat4main9row__menu, -1);
    if (refocus && id >= 0) {
      const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(6);
      _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, "#more-");
      _M0MPB13StringBuilder13write__objectGiE(_string_builder, id);
      _M0FP314vlmkit_2dsites4chat4main12later__focus(_string_builder.val);
      return;
    } else {
      return;
    }
  }
  function _M0FP314vlmkit_2dsites4chat4main14commit__rename(c, v) {
    if (_M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4chat4main8renaming) !== c.id) {
      return undefined;
    }
    const t = _M0MPC16string10StringView9to__owned(_M0MPC16string6String4trim(v, undefined));
    const _p = "";
    if (!(t === _p)) {
      _M0MP26mizchi7signals6Signal3setGsE(c.title, t);
      _M0FP314vlmkit_2dsites4chat4main3say(`Renamed to ${t}`);
    }
    _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4chat4main8renaming, -1);
    const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(5);
    _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, "#row-");
    _M0MPB13StringBuilder13write__objectGiE(_string_builder, c.id);
    _M0FP314vlmkit_2dsites4chat4main12later__focus(_string_builder.val);
  }
  function _M0FP314vlmkit_2dsites4chat4main7key__ofGRP36mizchi11js__browser3dom13KeyboardEventE(e) {
    return _M0MP26mizchi8js__core3Any5__get(e, "key");
  }
  function _M0FP314vlmkit_2dsites4chat4main7key__ofGRP26mizchi8js__core3AnyE(e) {
    return _M0MP26mizchi8js__core3Any5__get(e, "key");
  }
  function _M0FP314vlmkit_2dsites4chat4main7preventGRP36mizchi11js__browser3dom13KeyboardEventE(e) {
    _M0MP26mizchi8js__core3Any6__call(e, "preventDefault", []);
  }
  function _M0FP314vlmkit_2dsites4chat4main7preventGRP26mizchi8js__core3AnyE(e) {
    _M0MP26mizchi8js__core3Any6__call(e, "preventDefault", []);
  }
  function _M0FP314vlmkit_2dsites4chat4main13target__valueGRP36mizchi11js__browser3dom13KeyboardEventE(e) {
    return _M0MP26mizchi8js__core3Any5__get(_M0MP26mizchi8js__core3Any5__get(e, "target"), "value");
  }
  function _M0FP314vlmkit_2dsites4chat4main13target__valueGRP36mizchi11js__browser3dom10FocusEventE(e) {
    return _M0MP26mizchi8js__core3Any5__get(_M0MP26mizchi8js__core3Any5__get(e, "target"), "value");
  }
  function _M0FP314vlmkit_2dsites4chat4main9row__view(c, _i) {
    return _M0FP36mizchi4luna3dom2li(undefined, _M0FP314vlmkit_2dsites4chat4main9row__viewN6constrS2745, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom3div(undefined, undefined, undefined, () => {
      const base = _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4chat4main7current) === c.id ? "row is-current" : "row";
      return _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4chat4main9row__menu) === c.id ? `${base} has-menu` : base;
    }, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4show(() => _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4chat4main8renaming) === c.id, () => {
      const _tmp = _M0MP26mizchi7signals6Signal3getGsE(c.title);
      const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(7);
      _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, "rename-");
      _M0MPB13StringBuilder13write__objectGiE(_string_builder, c.id);
      return _M0FP36mizchi4luna3dom5input(_M0FP314vlmkit_2dsites4chat4main9row__viewN6constrS2746, undefined, _tmp, undefined, -1, -1, -1, -1, _string_builder.val, _M0FP314vlmkit_2dsites4chat4main9row__viewN6constrS2747, undefined, undefined, undefined, undefined, undefined, undefined, new _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4Some(_M0MP36mizchi4luna3dom10HandlerMap4blur(_M0MP36mizchi4luna3dom10HandlerMap7keydown(_M0FP36mizchi4luna3dom6events(), (e) => {
        const k = _M0FP314vlmkit_2dsites4chat4main7key__ofGRP36mizchi11js__browser3dom13KeyboardEventE(e);
        if (k === "Enter") {
          _M0FP314vlmkit_2dsites4chat4main7preventGRP36mizchi11js__browser3dom13KeyboardEventE(e);
          _M0FP314vlmkit_2dsites4chat4main14commit__rename(c, _M0FP314vlmkit_2dsites4chat4main13target__valueGRP36mizchi11js__browser3dom13KeyboardEventE(e));
          return;
        } else {
          if (k === "Escape") {
            _M0FP314vlmkit_2dsites4chat4main7preventGRP36mizchi11js__browser3dom13KeyboardEventE(e);
            _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4chat4main8renaming, -1);
            const _string_builder$2 = _M0MPB13StringBuilder21StringBuilder_2einner(5);
            _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$2, "#row-");
            _M0MPB13StringBuilder13write__objectGiE(_string_builder$2, c.id);
            _M0FP314vlmkit_2dsites4chat4main12later__focus(_string_builder$2.val);
            return;
          } else {
            return;
          }
        }
      }), (e) => {
        _M0FP314vlmkit_2dsites4chat4main14commit__rename(c, _M0FP314vlmkit_2dsites4chat4main13target__valueGRP36mizchi11js__browser3dom10FocusEventE(e));
      })), undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4chat4main1s("aria-label", "Rename chat")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__);
    }), _M0FP36mizchi4luna3dom4show(() => _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4chat4main8renaming) !== c.id, () => {
      const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(4);
      _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, "row-");
      _M0MPB13StringBuilder13write__objectGiE(_string_builder, c.id);
      return _M0FP36mizchi4luna3dom6button(-1, _string_builder.val, _M0FP314vlmkit_2dsites4chat4main9row__viewN6constrS2748, undefined, undefined, undefined, undefined, new _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4Some(_M0MP36mizchi4luna3dom10HandlerMap5click(_M0FP36mizchi4luna3dom6events(), (_e) => {
        _M0FP314vlmkit_2dsites4chat4main10open__conv(c.id);
      })), undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4chat4main1s("type", "button")]), new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4Some([_M0FP314vlmkit_2dsites4chat4main1d("aria-current", () => _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4chat4main7current) === c.id ? "page" : "false")]), [_M0FP36mizchi4luna3dom4span(undefined, _M0FP314vlmkit_2dsites4chat4main9row__viewN6constrS2749, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom9text__dyn(() => _M0MP26mizchi7signals6Signal3getGsE(c.title))])]);
    }), _M0FP36mizchi4luna3dom4show(() => _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4chat4main8renaming) !== c.id, () => {
      const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(5);
      _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, "more-");
      _M0MPB13StringBuilder13write__objectGiE(_string_builder, c.id);
      return _M0FP36mizchi4luna3dom6button(-1, _string_builder.val, _M0FP314vlmkit_2dsites4chat4main9row__viewN6constrS2750, undefined, undefined, undefined, undefined, new _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4Some(_M0MP36mizchi4luna3dom10HandlerMap5click(_M0FP36mizchi4luna3dom6events(), (_e) => {
        _M0FP314vlmkit_2dsites4chat4main15open__row__menu(c);
      })), undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4chat4main1s("type", "button"), _M0FP314vlmkit_2dsites4chat4main1s("aria-haspopup", "menu"), _M0FP314vlmkit_2dsites4chat4main1s("data-menu-root", "")]), new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4Some([_M0FP314vlmkit_2dsites4chat4main1d("aria-label", () => `Options for ${_M0MP26mizchi7signals6Signal3getGsE(c.title)}`), _M0FP314vlmkit_2dsites4chat4main1d("aria-expanded", () => {
        const _p = _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4chat4main9row__menu) === c.id;
        return _p ? "true" : "false";
      })]), [_M0FP314vlmkit_2dsites4chat4main4icon(_M0FP314vlmkit_2dsites4chat4main7i__more)]);
    })])]);
  }
  function _M0FP314vlmkit_2dsites4chat4main11group__view(g) {
    const rows = _M0FP26mizchi7signals4memoGRPB5ArrayGRP314vlmkit_2dsites4chat4main5BlockEE(() => {
      const q = _M0MPC16string6String9to__lower(_M0MP26mizchi7signals6Signal3getGsE(_M0FP314vlmkit_2dsites4chat4main5query));
      const _p = _M0MP26mizchi7signals6Signal3getGRPB5ArrayGRP314vlmkit_2dsites4chat4main4ConvEE(_M0FP314vlmkit_2dsites4chat4main5convs);
      const _p$2 = [];
      const _p$3 = _p.length;
      let _tmp = 0;
      while (true) {
        const _p$4 = _tmp;
        if (_p$4 < _p$3) {
          const _p$5 = _p[_p$4];
          if (_p$5.group === g && (q === "" || _M0MPC16string6String8contains(_M0MPC16string6String9to__lower(_M0MP26mizchi7signals6Signal3getGsE(_p$5.title)), new _M0TPC16string10StringView(q, 0, q.length)))) {
            _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(_p$2, _p$5);
          }
          _tmp = _p$4 + 1 | 0;
          continue;
        } else {
          return _p$2;
        }
      }
    });
    return _M0FP36mizchi4luna3dom4show(() => rows().length > 0, () => _M0FP36mizchi4luna3dom7section(undefined, _M0FP314vlmkit_2dsites4chat4main11group__viewN6constrS2763, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4chat4main1s("aria-label", g)]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom2h2(undefined, _M0FP314vlmkit_2dsites4chat4main11group__viewN6constrS2764, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4text(g)]), _M0FP36mizchi4luna3dom2ul(undefined, _M0FP314vlmkit_2dsites4chat4main11group__viewN6constrS2765, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom9for__eachGRP314vlmkit_2dsites4chat4main3MsgE(() => rows(), _M0FP314vlmkit_2dsites4chat4main9row__view)])]));
  }
  function _M0FP314vlmkit_2dsites4chat4main5media(q) {
    const fnv = _M0MP26mizchi8js__core3Any5__get(_M0FP314vlmkit_2dsites4chat4main3win(), "matchMedia");
    return _M0FP26mizchi8js__core11is__nullish(fnv) ? false : _M0MP26mizchi8js__core3Any5__get(_M0MP26mizchi8js__core3Any6__call(_M0FP314vlmkit_2dsites4chat4main3win(), "matchMedia", [q]), "matches");
  }
  function _M0FP314vlmkit_2dsites4chat4main9is__phone() {
    return _M0FP314vlmkit_2dsites4chat4main5media("(max-width: 767px)");
  }
  function _M0FP314vlmkit_2dsites4chat4main15toggle__sidebar() {
    if (_M0FP314vlmkit_2dsites4chat4main9is__phone()) {
      _M0FP314vlmkit_2dsites4chat4main11set__drawer(false);
      _M0FP314vlmkit_2dsites4chat4main10focus__sel("#open-drawer");
      return;
    } else {
      _M0MP26mizchi7signals6Signal6updateGbE(_M0FP314vlmkit_2dsites4chat4main9collapsed, (v) => !v);
      if (_M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4chat4main9collapsed)) {
        _M0FP314vlmkit_2dsites4chat4main12later__focus("#expand");
        return;
      } else {
        _M0FP314vlmkit_2dsites4chat4main12later__focus("#collapse");
        return;
      }
    }
  }
  function _M0FP314vlmkit_2dsites4chat4main13sidebar__view() {
    const any_match = _M0FP26mizchi7signals4memoGbE(() => {
      const q = _M0MPC16string6String9to__lower(_M0MP26mizchi7signals6Signal3getGsE(_M0FP314vlmkit_2dsites4chat4main5query));
      const _p = _M0MPC15array5Array4iterGRP314vlmkit_2dsites4chat4main4ConvE(_M0MP26mizchi7signals6Signal3getGRPB5ArrayGRP314vlmkit_2dsites4chat4main4ConvEE(_M0FP314vlmkit_2dsites4chat4main5convs));
      while (true) {
        const _p$2 = _M0MPB4Iter4nextGRPC16string10StringViewE(_p);
        if (_p$2 === undefined) {
          return false;
        } else {
          const _p$3 = _p$2;
          const _p$4 = _p$3;
          if (q === "" || _M0MPC16string6String8contains(_M0MPC16string6String9to__lower(_M0MP26mizchi7signals6Signal3getGsE(_p$4.title)), new _M0TPC16string10StringView(q, 0, q.length))) {
            return true;
          }
          continue;
        }
      }
    });
    const _tmp = _M0FP36mizchi4luna3dom3div(undefined, _M0FP314vlmkit_2dsites4chat4main13sidebar__viewN6constrS2774, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom3div(undefined, _M0FP314vlmkit_2dsites4chat4main13sidebar__viewN6constrS2775, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP314vlmkit_2dsites4chat4main4logo("brand-logo"), _M0FP36mizchi4luna3dom4span(undefined, _M0FP314vlmkit_2dsites4chat4main13sidebar__viewN6constrS2776, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4text("Parley")])]), _M0FP314vlmkit_2dsites4chat4main20icon__button_2einner("Close sidebar", _M0FP314vlmkit_2dsites4chat4main7i__side, "icon-btn", "collapse", _M0MP36mizchi4luna3dom10HandlerMap5click(_M0FP36mizchi4luna3dom6events(), (_e) => {
      _M0FP314vlmkit_2dsites4chat4main15toggle__sidebar();
    }), [_M0FP314vlmkit_2dsites4chat4main1d("aria-label", () => _M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4chat4main6drawer) ? "Close sidebar" : "Collapse sidebar"), _M0FP314vlmkit_2dsites4chat4main1d("title", () => _M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4chat4main6drawer) ? "Close sidebar" : "Collapse sidebar")])]);
    const _tmp$2 = _M0FP36mizchi4luna3dom6button(-1, undefined, _M0FP314vlmkit_2dsites4chat4main13sidebar__viewN6constrS2777, undefined, undefined, undefined, undefined, new _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4Some(_M0MP36mizchi4luna3dom10HandlerMap5click(_M0FP36mizchi4luna3dom6events(), (_e) => {
      _M0FP314vlmkit_2dsites4chat4main9new__chat();
    })), undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4chat4main1s("type", "button")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP314vlmkit_2dsites4chat4main4icon(_M0FP314vlmkit_2dsites4chat4main6i__new), _M0FP36mizchi4luna3dom4span(undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4text("New chat")])]);
    const _tmp$3 = _M0FP36mizchi4luna3dom3div(undefined, _M0FP314vlmkit_2dsites4chat4main13sidebar__viewN6constrS2778, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP314vlmkit_2dsites4chat4main4icon(_M0FP314vlmkit_2dsites4chat4main9i__search), _M0FP36mizchi4luna3dom5input(_M0FP314vlmkit_2dsites4chat4main13sidebar__viewN6constrS2779, undefined, undefined, _M0FP314vlmkit_2dsites4chat4main13sidebar__viewN6constrS2780, -1, -1, -1, -1, _M0FP314vlmkit_2dsites4chat4main13sidebar__viewN6constrS2781, undefined, undefined, undefined, undefined, undefined, undefined, undefined, new _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4Some(_M0MP36mizchi4luna3dom10HandlerMap7keydown(_M0MP36mizchi4luna3dom10HandlerMap5input(_M0FP36mizchi4luna3dom6events(), (e) => {
      _M0MP26mizchi7signals6Signal3setGsE(_M0FP314vlmkit_2dsites4chat4main5query, _M0FP314vlmkit_2dsites4chat4main13target__valueGRP36mizchi11js__browser3dom13KeyboardEventE(e));
    }), (e) => {
      let _tmp$4;
      if (_M0FP314vlmkit_2dsites4chat4main7key__ofGRP36mizchi11js__browser3dom13KeyboardEventE(e) === "Escape") {
        const _p = _M0MP26mizchi7signals6Signal3getGsE(_M0FP314vlmkit_2dsites4chat4main5query);
        const _p$2 = "";
        _tmp$4 = !(_p === _p$2);
      } else {
        _tmp$4 = false;
      }
      if (_tmp$4) {
        _M0FP314vlmkit_2dsites4chat4main7preventGRP36mizchi11js__browser3dom13KeyboardEventE(e);
        _M0MP26mizchi8js__core3Any5__set(_M0MP26mizchi8js__core3Any5__get(e, "target"), "value", "");
        _M0MP26mizchi7signals6Signal3setGsE(_M0FP314vlmkit_2dsites4chat4main5query, "");
        return;
      } else {
        return;
      }
    })), undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4chat4main1s("aria-label", "Search chats"), _M0FP314vlmkit_2dsites4chat4main1s("autocomplete", "off")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__)]);
    const _tmp$4 = new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4chat4main1s("aria-label", "Chat history")]);
    const _p = new Array(_M0FP314vlmkit_2dsites4chat4main6groups.length);
    const _p$2 = _M0FP314vlmkit_2dsites4chat4main6groups.length;
    let _tmp$5 = 0;
    while (true) {
      const _p$3 = _tmp$5;
      if (_p$3 < _p$2) {
        const _p$4 = _M0FP314vlmkit_2dsites4chat4main6groups[_p$3];
        _p[_p$3] = _M0FP314vlmkit_2dsites4chat4main11group__view(_p$4);
        _tmp$5 = _p$3 + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return _M0FP36mizchi4luna3dom8fragment([_M0FP36mizchi4luna3dom3div(undefined, _M0FP314vlmkit_2dsites4chat4main13sidebar__viewN6constrS2773, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_tmp, _tmp$2, _tmp$3, _M0FP36mizchi4luna3dom3nav(undefined, _M0FP314vlmkit_2dsites4chat4main13sidebar__viewN6constrS2782, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _tmp$4, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom8fragment(_p), _M0FP36mizchi4luna3dom4show(() => !any_match(), () => _M0FP36mizchi4luna3dom1p(undefined, _M0FP314vlmkit_2dsites4chat4main13sidebar__viewN6constrS2783, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom9text__dyn(() => _M0MP26mizchi7signals6Signal3getGRPB5ArrayGRP314vlmkit_2dsites4chat4main4ConvEE(_M0FP314vlmkit_2dsites4chat4main5convs).length === 0 ? "No chats yet." : `No chats match “${_M0MP26mizchi7signals6Signal3getGsE(_M0FP314vlmkit_2dsites4chat4main5query)}”.`)]))]), _M0FP36mizchi4luna3dom3div(undefined, _M0FP314vlmkit_2dsites4chat4main13sidebar__viewN6constrS2784, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4span(undefined, _M0FP314vlmkit_2dsites4chat4main13sidebar__viewN6constrS2785, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4chat4main1s("aria-hidden", "true")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4text("MR")]), _M0FP36mizchi4luna3dom4span(undefined, _M0FP314vlmkit_2dsites4chat4main13sidebar__viewN6constrS2786, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4span(undefined, _M0FP314vlmkit_2dsites4chat4main13sidebar__viewN6constrS2787, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4text("Mina Rao")]), _M0FP36mizchi4luna3dom4span(undefined, _M0FP314vlmkit_2dsites4chat4main13sidebar__viewN6constrS2788, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4text("Free plan")])])])]), _M0FP36mizchi4luna3dom3div(undefined, _M0FP314vlmkit_2dsites4chat4main13sidebar__viewN6constrS2789, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP314vlmkit_2dsites4chat4main20icon__button_2einner("Expand sidebar", _M0FP314vlmkit_2dsites4chat4main7i__side, "icon-btn", "expand", _M0MP36mizchi4luna3dom10HandlerMap5click(_M0FP36mizchi4luna3dom6events(), (_e) => {
      _M0FP314vlmkit_2dsites4chat4main15toggle__sidebar();
    }), [_M0FP314vlmkit_2dsites4chat4main1d("aria-expanded", () => "false")]), _M0FP314vlmkit_2dsites4chat4main12icon__button("New chat", _M0FP314vlmkit_2dsites4chat4main6i__new, undefined, undefined, new _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4Some(_M0MP36mizchi4luna3dom10HandlerMap5click(_M0FP36mizchi4luna3dom6events(), (_e) => {
      _M0FP314vlmkit_2dsites4chat4main9new__chat();
    })), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__)])]);
  }
  function _M0FP314vlmkit_2dsites4chat4main17open__model__menu() {
    if (_M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4chat4main11model__open)) {
      _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4chat4main11model__open, false);
      return undefined;
    }
    _M0FP314vlmkit_2dsites4chat4main12close__menus();
    _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4chat4main11model__open, true);
    _M0FP314vlmkit_2dsites4chat4main12later__focus("#model-menu [aria-checked=true]");
  }
  function _M0FP314vlmkit_2dsites4chat4main18close__model__menu(refocus) {
    _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4chat4main11model__open, false);
    if (refocus) {
      _M0FP314vlmkit_2dsites4chat4main12later__focus("#model-btn");
      return;
    } else {
      return;
    }
  }
  function _M0FP314vlmkit_2dsites4chat4main11model__itemN4pickS2800(m) {
    _M0MP26mizchi7signals6Signal3setGsE(_M0FP314vlmkit_2dsites4chat4main5model, m.id);
    _M0FP314vlmkit_2dsites4chat4main18close__model__menu(true);
    _M0FP314vlmkit_2dsites4chat4main3say(`${m.name} selected`);
  }
  function _M0FP314vlmkit_2dsites4chat4main11model__item(m) {
    return _M0FP36mizchi4luna3dom2li(undefined, _M0FP314vlmkit_2dsites4chat4main11model__itemN6constrS2801, undefined, undefined, undefined, new _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4Some(_M0MP36mizchi4luna3dom10HandlerMap7keydown(_M0MP36mizchi4luna3dom10HandlerMap5click(_M0FP36mizchi4luna3dom6events(), (_e) => {
      _M0FP314vlmkit_2dsites4chat4main11model__itemN4pickS2800(m);
    }), (e) => {
      const k = _M0FP314vlmkit_2dsites4chat4main7key__ofGRP36mizchi11js__browser3dom13KeyboardEventE(e);
      if (k === "Enter" || k === " ") {
        _M0FP314vlmkit_2dsites4chat4main7preventGRP36mizchi11js__browser3dom13KeyboardEventE(e);
        _M0FP314vlmkit_2dsites4chat4main11model__itemN4pickS2800(m);
        return;
      } else {
        return;
      }
    })), undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4chat4main1s("role", "menuitemradio"), _M0FP314vlmkit_2dsites4chat4main1s("tabindex", "-1")]), new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4Some([_M0FP314vlmkit_2dsites4chat4main1d("aria-checked", () => {
      const _p = _M0MP26mizchi7signals6Signal3getGsE(_M0FP314vlmkit_2dsites4chat4main5model) === m.id;
      return _p ? "true" : "false";
    })]), [_M0FP36mizchi4luna3dom4span(undefined, _M0FP314vlmkit_2dsites4chat4main11model__itemN6constrS2802, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4span(undefined, _M0FP314vlmkit_2dsites4chat4main11model__itemN6constrS2803, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4text(m.name)]), _M0FP36mizchi4luna3dom4span(undefined, _M0FP314vlmkit_2dsites4chat4main11model__itemN6constrS2804, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4text(m.desc)])]), _M0FP36mizchi4luna3dom4span(undefined, _M0FP314vlmkit_2dsites4chat4main11model__itemN6constrS2805, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP314vlmkit_2dsites4chat4main4icon(_M0FP314vlmkit_2dsites4chat4main8i__check)])]);
  }
  function _M0FP314vlmkit_2dsites4chat4main10menu__keysGRP36mizchi11js__browser3dom13KeyboardEventE(e, root_sel, close) {
    const k = _M0FP314vlmkit_2dsites4chat4main7key__ofGRP36mizchi11js__browser3dom13KeyboardEventE(e);
    const root = _M0FP314vlmkit_2dsites4chat4main2qs(root_sel);
    if (_M0FP26mizchi8js__core11is__nullish(root)) {
      return undefined;
    }
    const items = _M0FP26mizchi8js__core11array__from(_M0MP26mizchi8js__core3Any6__call(root, "querySelectorAll", ["[role^=\"menuitem\"]"]));
    const n = items.length;
    if (n === 0) {
      return undefined;
    }
    const act = _M0FP314vlmkit_2dsites4chat4main10active__el();
    let cur = -1;
    const _bind = items.length;
    let _tmp = 0;
    while (true) {
      const i = _tmp;
      if (i < _bind) {
        const it = items[i];
        if (_M0FP26mizchi8js__core5equal(it, act)) {
          cur = i;
        }
        _tmp = i + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    if (k === "ArrowDown") {
      _M0FP314vlmkit_2dsites4chat4main7preventGRP36mizchi11js__browser3dom13KeyboardEventE(e);
      _M0FP314vlmkit_2dsites4chat4main9focus__el(_M0MPC15array5Array2atGORP26mizchi7signals10EffectNodeE(items, (cur + 1 | 0) % n | 0));
      return;
    } else {
      if (k === "ArrowUp") {
        _M0FP314vlmkit_2dsites4chat4main7preventGRP36mizchi11js__browser3dom13KeyboardEventE(e);
        _M0FP314vlmkit_2dsites4chat4main9focus__el(_M0MPC15array5Array2atGORP26mizchi7signals10EffectNodeE(items, cur <= 0 ? n - 1 | 0 : cur - 1 | 0));
        return;
      } else {
        if (k === "Home") {
          _M0FP314vlmkit_2dsites4chat4main7preventGRP36mizchi11js__browser3dom13KeyboardEventE(e);
          _M0FP314vlmkit_2dsites4chat4main9focus__el(_M0MPC15array5Array2atGORP26mizchi7signals10EffectNodeE(items, 0));
          return;
        } else {
          if (k === "End") {
            _M0FP314vlmkit_2dsites4chat4main7preventGRP36mizchi11js__browser3dom13KeyboardEventE(e);
            _M0FP314vlmkit_2dsites4chat4main9focus__el(_M0MPC15array5Array2atGORP26mizchi7signals10EffectNodeE(items, n - 1 | 0));
            return;
          } else {
            if (k === "Escape") {
              _M0FP314vlmkit_2dsites4chat4main7preventGRP36mizchi11js__browser3dom13KeyboardEventE(e);
              close(true);
              return;
            } else {
              if (k === "Tab") {
                close(false);
                return;
              } else {
                return;
              }
            }
          }
        }
      }
    }
  }
  function _M0FP314vlmkit_2dsites4chat4main12header__view() {
    return _M0FP36mizchi4luna3dom8fragment([_M0FP314vlmkit_2dsites4chat4main20icon__button_2einner("Open sidebar", _M0FP314vlmkit_2dsites4chat4main7i__menu, "icon-btn open-drawer", "open-drawer", _M0MP36mizchi4luna3dom10HandlerMap5click(_M0FP36mizchi4luna3dom6events(), (_e) => {
      _M0FP314vlmkit_2dsites4chat4main11set__drawer(true);
      _M0FP314vlmkit_2dsites4chat4main10focus__sel(".sidebar .new-chat");
    }), [_M0FP314vlmkit_2dsites4chat4main1d("aria-expanded", () => {
      const _p = _M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4chat4main6drawer);
      return _p ? "true" : "false";
    }), _M0FP314vlmkit_2dsites4chat4main1d("aria-controls", () => "sidebar")]), _M0FP36mizchi4luna3dom3div(undefined, _M0FP314vlmkit_2dsites4chat4main12header__viewN6constrS2824, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4chat4main1s("data-menu-root", "")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom6button(-1, _M0FP314vlmkit_2dsites4chat4main12header__viewN6constrS2825, _M0FP314vlmkit_2dsites4chat4main12header__viewN6constrS2826, undefined, undefined, undefined, undefined, new _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4Some(_M0MP36mizchi4luna3dom10HandlerMap7keydown(_M0MP36mizchi4luna3dom10HandlerMap5click(_M0FP36mizchi4luna3dom6events(), (_e) => {
      _M0FP314vlmkit_2dsites4chat4main17open__model__menu();
    }), (e) => {
      if (_M0FP314vlmkit_2dsites4chat4main7key__ofGRP36mizchi11js__browser3dom13KeyboardEventE(e) === "ArrowDown" && !_M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4chat4main11model__open)) {
        _M0FP314vlmkit_2dsites4chat4main7preventGRP36mizchi11js__browser3dom13KeyboardEventE(e);
        _M0FP314vlmkit_2dsites4chat4main17open__model__menu();
        return;
      } else {
        return;
      }
    })), undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4chat4main1s("type", "button"), _M0FP314vlmkit_2dsites4chat4main1s("aria-haspopup", "menu")]), new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4Some([_M0FP314vlmkit_2dsites4chat4main1d("aria-expanded", () => {
      const _p = _M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4chat4main11model__open);
      return _p ? "true" : "false";
    })]), [_M0FP36mizchi4luna3dom4span(undefined, _M0FP314vlmkit_2dsites4chat4main12header__viewN6constrS2827, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom9text__dyn(_M0FP314vlmkit_2dsites4chat4main11model__name)]), _M0FP314vlmkit_2dsites4chat4main4icon(_M0FP314vlmkit_2dsites4chat4main7i__chev)]), _M0FP36mizchi4luna3dom4show(() => _M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4chat4main11model__open), () => {
      const _tmp = new _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4Some(_M0MP36mizchi4luna3dom10HandlerMap7keydown(_M0FP36mizchi4luna3dom6events(), (e) => {
        _M0FP314vlmkit_2dsites4chat4main10menu__keysGRP36mizchi11js__browser3dom13KeyboardEventE(e, "#model-menu", _M0FP314vlmkit_2dsites4chat4main18close__model__menu);
      }));
      const _tmp$2 = new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4chat4main1s("role", "menu"), _M0FP314vlmkit_2dsites4chat4main1s("aria-labelledby", "model-btn")]);
      const _p = new Array(_M0FP314vlmkit_2dsites4chat4main6models.length);
      const _p$2 = _M0FP314vlmkit_2dsites4chat4main6models.length;
      let _tmp$3 = 0;
      while (true) {
        const _p$3 = _tmp$3;
        if (_p$3 < _p$2) {
          const _p$4 = _M0FP314vlmkit_2dsites4chat4main6models[_p$3];
          _p[_p$3] = _M0FP314vlmkit_2dsites4chat4main11model__item(_p$4);
          _tmp$3 = _p$3 + 1 | 0;
          continue;
        } else {
          break;
        }
      }
      return _M0FP36mizchi4luna3dom2ul(_M0FP314vlmkit_2dsites4chat4main12header__viewN6constrS2828, _M0FP314vlmkit_2dsites4chat4main12header__viewN6constrS2829, undefined, undefined, undefined, _tmp, undefined, _tmp$2, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, _p);
    })]), _M0FP36mizchi4luna3dom2h1(undefined, _M0FP314vlmkit_2dsites4chat4main12header__viewN6constrS2830, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom9text__dyn(_M0FP314vlmkit_2dsites4chat4main14current__title)]), _M0FP36mizchi4luna3dom4show(() => _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4chat4main7current) >= 0, () => _M0FP36mizchi4luna3dom6button(-1, _M0FP314vlmkit_2dsites4chat4main12header__viewN6constrS2831, _M0FP314vlmkit_2dsites4chat4main12header__viewN6constrS2832, undefined, undefined, undefined, undefined, new _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4Some(_M0MP36mizchi4luna3dom10HandlerMap5click(_M0FP36mizchi4luna3dom6events(), (_e) => {
      _M0FP314vlmkit_2dsites4chat4main12close__menus();
      _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4chat4main12link__copied, false);
      _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4chat4main11share__open, true);
      _M0FP314vlmkit_2dsites4chat4main12later__focus("#copy-link");
    })), undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4chat4main1s("type", "button"), _M0FP314vlmkit_2dsites4chat4main1s("aria-haspopup", "dialog")]), new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4Some([_M0FP314vlmkit_2dsites4chat4main1d("aria-expanded", () => {
      const _p = _M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4chat4main11share__open);
      return _p ? "true" : "false";
    })]), [_M0FP314vlmkit_2dsites4chat4main4icon(_M0FP314vlmkit_2dsites4chat4main8i__share), _M0FP36mizchi4luna3dom4span(undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4text("Share")])]))]);
  }
  function _M0FP314vlmkit_2dsites4chat4main11caret__node(live) {
    return _M0FP36mizchi4luna3dom4show(live, () => _M0FP36mizchi4luna3dom4span(undefined, _M0FP314vlmkit_2dsites4chat4main11caret__nodeN6constrS2838, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4chat4main1s("aria-hidden", "true")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, []));
  }
  function _M0FP314vlmkit_2dsites4chat4main14render__inline(src, caret) {
    const _p = _M0FP314vlmkit_2dsites4chat4main13parse__inline(src);
    const _p$2 = new Array(_p.length);
    const _p$3 = _p.length;
    let _tmp = 0;
    while (true) {
      const _p$4 = _tmp;
      if (_p$4 < _p$3) {
        const _p$5 = _p[_p$4];
        let _tmp$2;
        switch (_p$5.$tag) {
          case 0: {
            const _p$6 = _p$5;
            const _p$7 = _p$6._0;
            _tmp$2 = _M0FP36mizchi4luna3dom4text(_p$7);
            break;
          }
          case 1: {
            const _p$8 = _p$5;
            const _p$9 = _p$8._0;
            _tmp$2 = _M0FP36mizchi4luna3dom6strong(undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4text(_p$9)]);
            break;
          }
          default: {
            const _p$10 = _p$5;
            const _p$11 = _p$10._0;
            _tmp$2 = _M0FP36mizchi4luna3dom4code(undefined, _M0FP314vlmkit_2dsites4chat4main14render__inlineN6constrS2840, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4text(_p$11)]);
          }
        }
        _p$2[_p$4] = _tmp$2;
        _tmp = _p$4 + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    const out = _p$2;
    if (caret === undefined) {
    } else {
      const _Some = caret;
      const _live = _Some;
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(out, _M0FP314vlmkit_2dsites4chat4main11caret__node(_live));
    }
    return out;
  }
  function _M0FP314vlmkit_2dsites4chat4main10el_2einner(tag, cls, children, attrs) {
    const all = [{ _0: "class", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(cls) }];
    const _bind = attrs.length;
    let _tmp = 0;
    while (true) {
      const _ = _tmp;
      if (_ < _bind) {
        const a = attrs[_];
        _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(all, a);
        _tmp = _ + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return _M0FP36mizchi4luna3dom15create__element(tag, all, children);
  }
  function _M0FP314vlmkit_2dsites4chat4main2el(tag, cls, children, attrs$46$opt) {
    let attrs;
    if (attrs$46$opt.$tag === 1) {
      const _Some = attrs$46$opt;
      attrs = _Some._0;
    } else {
      attrs = [];
    }
    return _M0FP314vlmkit_2dsites4chat4main10el_2einner(tag, cls, children, attrs);
  }
  function _M0FP314vlmkit_2dsites4chat4main10copy__text(s) {
    const cb = _M0MP26mizchi8js__core3Any5__get(_M0MP26mizchi8js__core3Any5__get(_M0FP314vlmkit_2dsites4chat4main3win(), "navigator"), "clipboard");
    if (!_M0FP26mizchi8js__core11is__nullish(cb)) {
      let p;
      let _try_err;
      _L: {
        _L$2: {
          const _bind = _M0FP26mizchi8js__core9try__sync(() => _M0MP26mizchi8js__core3Any6__call(cb, "writeText", [s]));
          if (_bind.$tag === 1) {
            const _ok = _bind;
            p = _ok._0;
          } else {
            const _err = _bind;
            _try_err = _err._0;
            break _L$2;
          }
          break _L;
        }
        p = _M0FP26mizchi8js__core9undefined();
      }
      if (!_M0FP26mizchi8js__core11is__nullish(p)) {
        _M0MP26mizchi8js__core3Any6__call(p, "catch", [(_x) => {
        }]);
        return;
      } else {
        return;
      }
    } else {
      return;
    }
  }
  function _M0FP314vlmkit_2dsites4chat4main10code__view(m, idx, lang, body, caret) {
    const label = lang === "" ? "code" : lang;
    const code_children = [_M0FP36mizchi4luna3dom4text(body)];
    if (caret === undefined) {
    } else {
      const _Some = caret;
      const _live = _Some;
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(code_children, _M0FP314vlmkit_2dsites4chat4main11caret__node(_live));
    }
    return _M0FP36mizchi4luna3dom3div(undefined, _M0FP314vlmkit_2dsites4chat4main10code__viewN6constrS2874, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom3div(undefined, _M0FP314vlmkit_2dsites4chat4main10code__viewN6constrS2875, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4span(undefined, _M0FP314vlmkit_2dsites4chat4main10code__viewN6constrS2876, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4text(label)]), _M0FP36mizchi4luna3dom6button(-1, undefined, _M0FP314vlmkit_2dsites4chat4main10code__viewN6constrS2877, undefined, undefined, undefined, undefined, new _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4Some(_M0MP36mizchi4luna3dom10HandlerMap5click(_M0FP36mizchi4luna3dom6events(), (_e) => {
      _M0FP314vlmkit_2dsites4chat4main10copy__text(body);
      _M0MP26mizchi7signals6Signal3setGiE(m.code_copied, idx);
      _M0FP314vlmkit_2dsites4chat4main3say("Code copied");
      _M0FP314vlmkit_2dsites4chat4main12set__timeout(() => {
        if (_M0MP26mizchi7signals6Signal3getGiE(m.code_copied) === idx) {
          _M0MP26mizchi7signals6Signal3setGiE(m.code_copied, -1);
          return;
        } else {
          return;
        }
      }, 2000);
    })), undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4chat4main1s("type", "button")]), new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4Some([_M0FP314vlmkit_2dsites4chat4main1d("aria-label", () => _M0MP26mizchi7signals6Signal3getGiE(m.code_copied) === idx ? "Copied" : "Copy code")]), [_M0FP36mizchi4luna3dom4show(() => _M0MP26mizchi7signals6Signal3getGiE(m.code_copied) === idx, () => _M0FP314vlmkit_2dsites4chat4main4icon(_M0FP314vlmkit_2dsites4chat4main8i__check)), _M0FP36mizchi4luna3dom4show(() => _M0MP26mizchi7signals6Signal3getGiE(m.code_copied) !== idx, () => _M0FP314vlmkit_2dsites4chat4main4icon(_M0FP314vlmkit_2dsites4chat4main7i__copy)), _M0FP36mizchi4luna3dom4span(undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom9text__dyn(() => _M0MP26mizchi7signals6Signal3getGiE(m.code_copied) === idx ? "Copied" : "Copy")])])]), _M0FP36mizchi4luna3dom3pre(undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4chat4main1s("tabindex", "0"), _M0FP314vlmkit_2dsites4chat4main1s("aria-label", `${label} code`)]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4code(undefined, `lang-${label}`, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, code_children)])]);
  }
  function _M0FP314vlmkit_2dsites4chat4main11table__view(head, rows, caret) {
    const _p = new Array(head.length);
    const _p$2 = head.length;
    let _tmp = 0;
    while (true) {
      const _p$3 = _tmp;
      if (_p$3 < _p$2) {
        const _p$4 = head[_p$3];
        const _tmp$2 = _M0FP314vlmkit_2dsites4chat4main14render__inline(_p$4, undefined);
        const _p$5 = "col";
        _p[_p$3] = _M0FP314vlmkit_2dsites4chat4main10el_2einner("th", "", _tmp$2, [{ _0: "scope", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(_p$5) }]);
        _tmp = _p$3 + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    const thead = _M0FP314vlmkit_2dsites4chat4main2el("thead", "", [_M0FP314vlmkit_2dsites4chat4main2el("tr", "", _p, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__)], _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__);
    let body_rows;
    let _p$3;
    _L: {
      _L$2: {
        if (rows.length === 0) {
          _p$3 = [];
          break _L$2;
        }
        const _p$4 = new Array(rows.length);
        const _p$5 = rows.length;
        let _tmp$2 = 0;
        while (true) {
          const _p$6 = _tmp$2;
          if (_p$6 < _p$5) {
            const _p$7 = rows[_p$6];
            const _p$8 = _p$6 === (rows.length - 1 | 0);
            let _tmp$3;
            let _p$9;
            _L$3: {
              _L$4: {
                if (_p$7.length === 0) {
                  _p$9 = [];
                  break _L$4;
                }
                const _p$10 = new Array(_p$7.length);
                const _p$11 = _p$7.length;
                let _tmp$4 = 0;
                while (true) {
                  const _p$12 = _tmp$4;
                  if (_p$12 < _p$11) {
                    const _p$13 = _p$7[_p$12];
                    const _p$14 = _p$8 && _p$12 === (_p$7.length - 1 | 0);
                    _p$10[_p$12] = _M0FP314vlmkit_2dsites4chat4main2el("td", "", _M0FP314vlmkit_2dsites4chat4main14render__inline(_p$13, _p$14 ? caret : undefined), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__);
                    _tmp$4 = _p$12 + 1 | 0;
                    continue;
                  } else {
                    break;
                  }
                }
                _tmp$3 = _p$10;
                break _L$3;
              }
              _tmp$3 = _p$9;
            }
            _p$4[_p$6] = _M0FP314vlmkit_2dsites4chat4main2el("tr", "", _tmp$3, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__);
            _tmp$2 = _p$6 + 1 | 0;
            continue;
          } else {
            break;
          }
        }
        body_rows = _p$4;
        break _L;
      }
      body_rows = _p$3;
    }
    return _M0FP36mizchi4luna3dom3div(undefined, _M0FP314vlmkit_2dsites4chat4main11table__viewN6constrS2890, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4chat4main1s("tabindex", "0"), _M0FP314vlmkit_2dsites4chat4main1s("role", "region"), _M0FP314vlmkit_2dsites4chat4main1s("aria-label", "Table")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP314vlmkit_2dsites4chat4main2el("table", "md-table", [thead, _M0FP314vlmkit_2dsites4chat4main2el("tbody", "", body_rows, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__)], _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__)]);
  }
  function _M0FP314vlmkit_2dsites4chat4main11block__view(m, b, idx, caret) {
    switch (b.$tag) {
      case 0: {
        const _Para = b;
        const _t = _Para._0;
        return _M0FP36mizchi4luna3dom1p(undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, _M0FP314vlmkit_2dsites4chat4main14render__inline(_t, caret));
      }
      case 1: {
        const _Heading = b;
        const _level = _Heading._0;
        const _t$2 = _Heading._1;
        return _level <= 2 ? _M0FP36mizchi4luna3dom2h3(undefined, _M0FP314vlmkit_2dsites4chat4main11block__viewN6constrS2902, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, _M0FP314vlmkit_2dsites4chat4main14render__inline(_t$2, caret)) : _M0FP36mizchi4luna3dom2h4(undefined, _M0FP314vlmkit_2dsites4chat4main11block__viewN6constrS2903, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, _M0FP314vlmkit_2dsites4chat4main14render__inline(_t$2, caret));
      }
      case 2: {
        const _Bullets = b;
        const _items = _Bullets._0;
        let _tmp;
        let _p;
        _L: {
          _L$2: {
            if (_items.length === 0) {
              _p = [];
              break _L$2;
            }
            const _p$2 = new Array(_items.length);
            const _p$3 = _items.length;
            let _tmp$2 = 0;
            while (true) {
              const _p$4 = _tmp$2;
              if (_p$4 < _p$3) {
                const _p$5 = _items[_p$4];
                const _p$6 = _p$4 === (_items.length - 1 | 0);
                _p$2[_p$4] = _M0FP36mizchi4luna3dom2li(undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, _M0FP314vlmkit_2dsites4chat4main14render__inline(_p$5, _p$6 ? caret : undefined));
                _tmp$2 = _p$4 + 1 | 0;
                continue;
              } else {
                break;
              }
            }
            _tmp = _p$2;
            break _L;
          }
          _tmp = _p;
        }
        return _M0FP36mizchi4luna3dom2ul(undefined, _M0FP314vlmkit_2dsites4chat4main11block__viewN6constrS2904, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, _tmp);
      }
      case 3: {
        const _Numbered = b;
        const _items$2 = _Numbered._0;
        let _tmp$2;
        let _p$2;
        _L$2: {
          _L$3: {
            if (_items$2.length === 0) {
              _p$2 = [];
              break _L$3;
            }
            const _p$3 = new Array(_items$2.length);
            const _p$4 = _items$2.length;
            let _tmp$3 = 0;
            while (true) {
              const _p$5 = _tmp$3;
              if (_p$5 < _p$4) {
                const _p$6 = _items$2[_p$5];
                const _p$7 = _p$5 === (_items$2.length - 1 | 0);
                _p$3[_p$5] = _M0FP36mizchi4luna3dom2li(undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, _M0FP314vlmkit_2dsites4chat4main14render__inline(_p$6, _p$7 ? caret : undefined));
                _tmp$3 = _p$5 + 1 | 0;
                continue;
              } else {
                break;
              }
            }
            _tmp$2 = _p$3;
            break _L$2;
          }
          _tmp$2 = _p$2;
        }
        return _M0FP36mizchi4luna3dom2ol(undefined, _M0FP314vlmkit_2dsites4chat4main11block__viewN6constrS2905, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, _tmp$2);
      }
      case 4: {
        const _Code = b;
        const _lang = _Code._0;
        const _body = _Code._1;
        return _M0FP314vlmkit_2dsites4chat4main10code__view(m, idx, _lang, _body, caret);
      }
      default: {
        const _Table = b;
        const _head = _Table._0;
        const _rows = _Table._1;
        return _M0FP314vlmkit_2dsites4chat4main11table__view(_head, _rows, caret);
      }
    }
  }
  function _M0FP314vlmkit_2dsites4chat4main10regenerate(m) {
    if (_M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4chat4main4busy)) {
      return undefined;
    }
    _M0FP314vlmkit_2dsites4chat4main3say("Regenerating");
    _M0FP314vlmkit_2dsites4chat4main13start__stream(m);
  }
  function _M0FP314vlmkit_2dsites4chat4main22action__button_2einner(label, path, click, pressed, disabled) {
    const dyn = [];
    if (pressed === undefined) {
    } else {
      const _Some = pressed;
      const _p = _Some;
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(dyn, _M0FP314vlmkit_2dsites4chat4main1d("aria-pressed", () => {
        const _p$2 = _p();
        return _p$2 ? "true" : "false";
      }));
    }
    let _tmp;
    if (disabled === undefined) {
      _tmp = () => false;
    } else {
      const _Some = disabled;
      _tmp = _Some;
    }
    return _M0FP36mizchi4luna3dom6button(-1, undefined, _M0FP314vlmkit_2dsites4chat4main22action__button_2einnerN6constrS2930, undefined, undefined, undefined, _tmp, new _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4Some(_M0MP36mizchi4luna3dom10HandlerMap5click(_M0FP36mizchi4luna3dom6events(), (_e) => {
      click();
    })), undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4chat4main1s("type", "button"), _M0FP314vlmkit_2dsites4chat4main1s("aria-label", label), _M0FP314vlmkit_2dsites4chat4main1s("title", label)]), new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4Some(dyn), [_M0FP314vlmkit_2dsites4chat4main4icon(path)]);
  }
  function _M0FP314vlmkit_2dsites4chat4main14action__button(label, path, click, pressed$46$opt, disabled$46$opt) {
    let pressed;
    if (pressed$46$opt.$tag === 1) {
      const _Some = pressed$46$opt;
      pressed = _Some._0;
    } else {
      pressed = undefined;
    }
    let disabled;
    if (disabled$46$opt.$tag === 1) {
      const _Some = disabled$46$opt;
      disabled = _Some._0;
    } else {
      disabled = undefined;
    }
    return _M0FP314vlmkit_2dsites4chat4main22action__button_2einner(label, path, click, pressed, disabled);
  }
  function _M0FP314vlmkit_2dsites4chat4main15assistant__view(m) {
    const blocks = _M0FP26mizchi7signals4memoGRPB5ArrayGRP314vlmkit_2dsites4chat4main5BlockEE(() => _M0FP314vlmkit_2dsites4chat4main13parse__blocks(_M0MP314vlmkit_2dsites4chat4main3Msg7visible(m)));
    return _M0FP36mizchi4luna3dom7article(undefined, _M0FP314vlmkit_2dsites4chat4main15assistant__viewN6constrS2950, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4chat4main1s("aria-label", "Parley said")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom3div(undefined, _M0FP314vlmkit_2dsites4chat4main15assistant__viewN6constrS2951, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP314vlmkit_2dsites4chat4main4logo("avatar-logo")]), _M0FP36mizchi4luna3dom3div(undefined, _M0FP314vlmkit_2dsites4chat4main15assistant__viewN6constrS2952, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom3div(undefined, _M0FP314vlmkit_2dsites4chat4main15assistant__viewN6constrS2953, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom9for__eachGRP314vlmkit_2dsites4chat4main3MsgE(() => blocks(), (b, i) => {
      const caret = _M0MP26mizchi7signals6Signal3getGbE(m.streaming) && i === (blocks().length - 1 | 0) ? (() => _M0MP26mizchi7signals6Signal3getGbE(m.streaming)) : undefined;
      return _M0FP314vlmkit_2dsites4chat4main11block__view(m, b, i, caret);
    }), _M0FP36mizchi4luna3dom4show(() => _M0MP26mizchi7signals6Signal3getGbE(m.streaming) && blocks().length === 0, () => _M0FP36mizchi4luna3dom1p(undefined, _M0FP314vlmkit_2dsites4chat4main15assistant__viewN6constrS2954, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP314vlmkit_2dsites4chat4main11caret__node(() => _M0MP26mizchi7signals6Signal3getGbE(m.streaming))]))]), _M0FP36mizchi4luna3dom4show(() => _M0MP26mizchi7signals6Signal3getGbE(m.stopped), () => _M0FP36mizchi4luna3dom1p(undefined, _M0FP314vlmkit_2dsites4chat4main15assistant__viewN6constrS2955, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4text("Stopped")])), _M0FP36mizchi4luna3dom4show(() => !_M0MP26mizchi7signals6Signal3getGbE(m.streaming), () => _M0FP36mizchi4luna3dom3div(undefined, _M0FP314vlmkit_2dsites4chat4main15assistant__viewN6constrS2956, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4chat4main1s("role", "group"), _M0FP314vlmkit_2dsites4chat4main1s("aria-label", "Response actions")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom6button(-1, undefined, _M0FP314vlmkit_2dsites4chat4main15assistant__viewN6constrS2957, undefined, undefined, undefined, undefined, new _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4Some(_M0MP36mizchi4luna3dom10HandlerMap5click(_M0FP36mizchi4luna3dom6events(), (_e) => {
      _M0FP314vlmkit_2dsites4chat4main10copy__text(_M0MP314vlmkit_2dsites4chat4main3Msg7visible(m));
      _M0MP26mizchi7signals6Signal3setGbE(m.copied, true);
      _M0FP314vlmkit_2dsites4chat4main3say("Copied");
      _M0FP314vlmkit_2dsites4chat4main12set__timeout(() => {
        _M0MP26mizchi7signals6Signal3setGbE(m.copied, false);
      }, 2000);
    })), undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4chat4main1s("type", "button")]), new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4Some([_M0FP314vlmkit_2dsites4chat4main1d("aria-label", () => _M0MP26mizchi7signals6Signal3getGbE(m.copied) ? "Copied" : "Copy"), _M0FP314vlmkit_2dsites4chat4main1d("title", () => "Copy")]), [_M0FP36mizchi4luna3dom4show(() => _M0MP26mizchi7signals6Signal3getGbE(m.copied), () => _M0FP314vlmkit_2dsites4chat4main4icon(_M0FP314vlmkit_2dsites4chat4main8i__check)), _M0FP36mizchi4luna3dom4show(() => !_M0MP26mizchi7signals6Signal3getGbE(m.copied), () => _M0FP314vlmkit_2dsites4chat4main4icon(_M0FP314vlmkit_2dsites4chat4main7i__copy)), _M0FP36mizchi4luna3dom4show(() => _M0MP26mizchi7signals6Signal3getGbE(m.copied), () => _M0FP36mizchi4luna3dom4span(undefined, _M0FP314vlmkit_2dsites4chat4main15assistant__viewN6constrS2958, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4text("Copied")]))]), _M0FP314vlmkit_2dsites4chat4main14action__button("Regenerate", _M0FP314vlmkit_2dsites4chat4main8i__regen, () => {
      _M0FP314vlmkit_2dsites4chat4main10regenerate(m);
    }, _M0DTPC16option6OptionGOWEbE4None__, new _M0DTPC16option6OptionGOWEbE4Some(() => _M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4chat4main4busy))), _M0FP314vlmkit_2dsites4chat4main14action__button("Good response", _M0FP314vlmkit_2dsites4chat4main7i__good, () => {
      _M0MP26mizchi7signals6Signal6updateGiE(m.feedback, (v) => v === 1 ? 0 : 1);
    }, new _M0DTPC16option6OptionGOWEbE4Some(() => _M0MP26mizchi7signals6Signal3getGiE(m.feedback) === 1), _M0DTPC16option6OptionGOWEbE4None__), _M0FP314vlmkit_2dsites4chat4main14action__button("Bad response", _M0FP314vlmkit_2dsites4chat4main6i__bad, () => {
      _M0MP26mizchi7signals6Signal6updateGiE(m.feedback, (v) => v === -1 ? 0 : -1);
    }, new _M0DTPC16option6OptionGOWEbE4Some(() => _M0MP26mizchi7signals6Signal3getGiE(m.feedback) === -1), _M0DTPC16option6OptionGOWEbE4None__), _M0FP314vlmkit_2dsites4chat4main14action__button("Read aloud", _M0FP314vlmkit_2dsites4chat4main8i__speak, () => {
      _M0MP26mizchi7signals6Signal6updateGbE(m.reading, (v) => !v);
    }, new _M0DTPC16option6OptionGOWEbE4Some(() => _M0MP26mizchi7signals6Signal3getGbE(m.reading)), _M0DTPC16option6OptionGOWEbE4None__)]))])]);
  }
  function _M0FP314vlmkit_2dsites4chat4main12resend__from(m, text) {
    const t = _M0MPC16string10StringView9to__owned(_M0MPC16string6String4trim(text, undefined));
    if (t === "") {
      return undefined;
    }
    _M0FP314vlmkit_2dsites4chat4main12stop__stream();
    const _bind = _M0FP314vlmkit_2dsites4chat4main13current__conv();
    if (_bind === undefined) {
      return;
    } else {
      const _Some = _bind;
      const _c = _Some;
      const ms = _M0MP26mizchi7signals6Signal3getGRPB5ArrayGRP314vlmkit_2dsites4chat4main4ConvEE(_c.messages);
      const kept = [];
      const _bind$2 = ms.length;
      let _tmp = 0;
      while (true) {
        const _ = _tmp;
        if (_ < _bind$2) {
          const x = ms[_];
          _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(kept, x);
          if (x.id === m.id) {
            break;
          }
          _tmp = _ + 1 | 0;
          continue;
        } else {
          break;
        }
      }
      _M0MP26mizchi7signals6Signal3setGsE(m.text, t);
      _M0MP26mizchi7signals6Signal3setGiE(m.shown, t.length);
      _M0MP26mizchi7signals6Signal3setGbE(m.editing, false);
      const a = _M0FP314vlmkit_2dsites4chat4main8new__msg("assistant", _M0FP314vlmkit_2dsites4chat4main11pick__reply(t), false);
      _M0MPC15array5Array4pushGRP26mizchi7signals5OwnerE(kept, a);
      _M0MP26mizchi7signals6Signal3setGRPB5ArrayGRP314vlmkit_2dsites4chat4main4ConvEE(_c.messages, kept);
      _M0FP314vlmkit_2dsites4chat4main15scroll__to__end();
      _M0FP314vlmkit_2dsites4chat4main13start__stream(a);
      _M0FP314vlmkit_2dsites4chat4main12later__focus("#prompt");
      return;
    }
  }
  function _M0FP314vlmkit_2dsites4chat4main10user__view(m) {
    const edit_val = _M0MPC13ref3Ref3RefGsE("");
    return _M0FP36mizchi4luna3dom7article(undefined, _M0FP314vlmkit_2dsites4chat4main10user__viewN6constrS2981, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4chat4main1s("aria-label", "You said")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4show(() => !_M0MP26mizchi7signals6Signal3getGbE(m.editing), () => {
      const _tmp = _M0FP36mizchi4luna3dom3div(undefined, _M0FP314vlmkit_2dsites4chat4main10user__viewN6constrS2983, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom9text__dyn(() => _M0MP26mizchi7signals6Signal3getGsE(m.text))]);
      const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(5);
      _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, "edit-");
      _M0MPB13StringBuilder13write__objectGiE(_string_builder, m.id);
      return _M0FP36mizchi4luna3dom3div(undefined, _M0FP314vlmkit_2dsites4chat4main10user__viewN6constrS2982, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_tmp, _M0FP36mizchi4luna3dom3div(undefined, _M0FP314vlmkit_2dsites4chat4main10user__viewN6constrS2984, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom6button(-1, _string_builder.val, _M0FP314vlmkit_2dsites4chat4main10user__viewN6constrS2985, undefined, undefined, undefined, () => _M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4chat4main4busy), new _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4Some(_M0MP36mizchi4luna3dom10HandlerMap5click(_M0FP36mizchi4luna3dom6events(), (_e) => {
        edit_val.val = _M0MP26mizchi7signals6Signal3getGsE(m.text);
        _M0MP26mizchi7signals6Signal3setGbE(m.editing, true);
        const _string_builder$2 = _M0MPB13StringBuilder21StringBuilder_2einner(9);
        _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$2, "#editbox-");
        _M0MPB13StringBuilder13write__objectGiE(_string_builder$2, m.id);
        _M0FP314vlmkit_2dsites4chat4main12later__focus(_string_builder$2.val);
      })), undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4chat4main1s("type", "button"), _M0FP314vlmkit_2dsites4chat4main1s("aria-label", "Edit message"), _M0FP314vlmkit_2dsites4chat4main1s("title", "Edit message")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP314vlmkit_2dsites4chat4main4icon(_M0FP314vlmkit_2dsites4chat4main9i__rename)])])]);
    }), _M0FP36mizchi4luna3dom4show(() => _M0MP26mizchi7signals6Signal3getGbE(m.editing), () => {
      const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(8);
      _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, "editbox-");
      _M0MPB13StringBuilder13write__objectGiE(_string_builder, m.id);
      return _M0FP36mizchi4luna3dom3div(undefined, _M0FP314vlmkit_2dsites4chat4main10user__viewN6constrS2986, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom8textarea(undefined, undefined, -1, _string_builder.val, _M0FP314vlmkit_2dsites4chat4main10user__viewN6constrS2987, undefined, undefined, undefined, new _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4Some(_M0MP36mizchi4luna3dom10HandlerMap7keydown(_M0MP36mizchi4luna3dom10HandlerMap5input(_M0FP36mizchi4luna3dom6events(), (e) => {
        edit_val.val = _M0FP314vlmkit_2dsites4chat4main13target__valueGRP36mizchi11js__browser3dom13KeyboardEventE(e);
      }), (e) => {
        if (_M0FP314vlmkit_2dsites4chat4main7key__ofGRP36mizchi11js__browser3dom13KeyboardEventE(e) === "Escape") {
          _M0FP314vlmkit_2dsites4chat4main7preventGRP36mizchi11js__browser3dom13KeyboardEventE(e);
          _M0MP26mizchi7signals6Signal3setGbE(m.editing, false);
          const _string_builder$2 = _M0MPB13StringBuilder21StringBuilder_2einner(6);
          _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$2, "#edit-");
          _M0MPB13StringBuilder13write__objectGiE(_string_builder$2, m.id);
          _M0FP314vlmkit_2dsites4chat4main12later__focus(_string_builder$2.val);
          return;
        } else {
          return;
        }
      })), undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4chat4main1s("aria-label", "Edit message"), _M0FP314vlmkit_2dsites4chat4main1s("rows", "3")]), new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4Some([_M0FP314vlmkit_2dsites4chat4main1d("value", () => _M0MP26mizchi7signals6Signal3getGsE(m.text))]), []), _M0FP36mizchi4luna3dom3div(undefined, _M0FP314vlmkit_2dsites4chat4main10user__viewN6constrS2988, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom6button(-1, undefined, _M0FP314vlmkit_2dsites4chat4main10user__viewN6constrS2989, undefined, undefined, undefined, undefined, new _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4Some(_M0MP36mizchi4luna3dom10HandlerMap5click(_M0FP36mizchi4luna3dom6events(), (_e) => {
        _M0MP26mizchi7signals6Signal3setGbE(m.editing, false);
        const _string_builder$2 = _M0MPB13StringBuilder21StringBuilder_2einner(6);
        _M0IPB13StringBuilderPB6Logger13write__string(_string_builder$2, "#edit-");
        _M0MPB13StringBuilder13write__objectGiE(_string_builder$2, m.id);
        _M0FP314vlmkit_2dsites4chat4main12later__focus(_string_builder$2.val);
      })), undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4chat4main1s("type", "button")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4text("Cancel")]), _M0FP36mizchi4luna3dom6button(-1, undefined, _M0FP314vlmkit_2dsites4chat4main10user__viewN6constrS2990, undefined, undefined, undefined, undefined, new _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4Some(_M0MP36mizchi4luna3dom10HandlerMap5click(_M0FP36mizchi4luna3dom6events(), (_e) => {
        _M0FP314vlmkit_2dsites4chat4main12resend__from(m, edit_val.val);
      })), undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4chat4main1s("type", "button")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4text("Send")])])]);
    })]);
  }
  function _M0FP314vlmkit_2dsites4chat4main9msg__view(m, _i) {
    return m.role === "user" ? _M0FP314vlmkit_2dsites4chat4main10user__view(m) : _M0FP314vlmkit_2dsites4chat4main15assistant__view(m);
  }
  function _M0FP314vlmkit_2dsites4chat4main13messages__now() {
    const _bind = _M0FP314vlmkit_2dsites4chat4main13current__conv();
    if (_bind === undefined) {
      return [];
    } else {
      const _Some = _bind;
      const _c = _Some;
      return _M0MP26mizchi7signals6Signal3getGRPB5ArrayGRP314vlmkit_2dsites4chat4main4ConvEE(_c.messages);
    }
  }
  function _M0FP314vlmkit_2dsites4chat4main15fill__and__send(text) {
    const el = _M0FP314vlmkit_2dsites4chat4main10prompt__el.val;
    if (!_M0FP26mizchi8js__core11is__nullish(el)) {
      _M0MP26mizchi8js__core3Any5__set(el, "value", text);
    }
    _M0MP26mizchi7signals6Signal3setGsE(_M0FP314vlmkit_2dsites4chat4main5draft, text);
    _M0FP314vlmkit_2dsites4chat4main10send__text(text);
  }
  function _M0FP314vlmkit_2dsites4chat4main11empty__view() {
    const _tmp = new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4chat4main1s("aria-labelledby", "greet")]);
    const _tmp$2 = _M0FP314vlmkit_2dsites4chat4main4logo("empty-logo");
    const _tmp$3 = _M0FP36mizchi4luna3dom2h2(_M0FP314vlmkit_2dsites4chat4main11empty__viewN6constrS3011, _M0FP314vlmkit_2dsites4chat4main11empty__viewN6constrS3012, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4text("What can I help with?")]);
    const _p = new Array(_M0FP314vlmkit_2dsites4chat4main11suggestions.length);
    const _p$2 = _M0FP314vlmkit_2dsites4chat4main11suggestions.length;
    let _tmp$4 = 0;
    while (true) {
      const _p$3 = _tmp$4;
      if (_p$3 < _p$2) {
        const _p$4 = _M0FP314vlmkit_2dsites4chat4main11suggestions[_p$3];
        _p[_p$3] = _M0FP36mizchi4luna3dom2li(undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom6button(-1, undefined, _M0FP314vlmkit_2dsites4chat4main11empty__viewN6constrS3014, undefined, undefined, undefined, undefined, new _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4Some(_M0MP36mizchi4luna3dom10HandlerMap5click(_M0FP36mizchi4luna3dom6events(), (_p$5) => {
          _M0FP314vlmkit_2dsites4chat4main15fill__and__send(_p$4.prompt);
        })), undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4chat4main1s("type", "button")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4span(undefined, _M0FP314vlmkit_2dsites4chat4main11empty__viewN6constrS3015, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4text(_p$4.title)]), _M0FP36mizchi4luna3dom4span(undefined, _M0FP314vlmkit_2dsites4chat4main11empty__viewN6constrS3016, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4text(_p$4.detail)])])]);
        _tmp$4 = _p$3 + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return _M0FP36mizchi4luna3dom7section(undefined, _M0FP314vlmkit_2dsites4chat4main11empty__viewN6constrS3010, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _tmp, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_tmp$2, _tmp$3, _M0FP36mizchi4luna3dom2ul(undefined, _M0FP314vlmkit_2dsites4chat4main11empty__viewN6constrS3013, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, _p)]);
  }
  function _M0FP314vlmkit_2dsites4chat4main4grow(el) {
    const st = _M0MP26mizchi8js__core3Any5__get(el, "style");
    _M0MP26mizchi8js__core3Any5__set(st, "height", "auto");
    const h = _M0MP26mizchi8js__core3Any5__get(el, "scrollHeight");
    const v = h > 216 ? 216 : h;
    const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(2);
    _M0MPB13StringBuilder13write__objectGiE(_string_builder, _M0MPC16double6Double7to__int(v));
    _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, "px");
    _M0MP26mizchi8js__core3Any5__set(st, "height", _string_builder.val);
    _M0MP26mizchi8js__core3Any5__set(st, "overflowY", h > 216 ? "auto" : "hidden");
  }
  function _M0FP314vlmkit_2dsites4chat4main13close__attach(refocus) {
    _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4chat4main12attach__open, false);
    if (refocus) {
      _M0FP314vlmkit_2dsites4chat4main12later__focus("#attach-btn");
      return;
    } else {
      return;
    }
  }
  function _M0FP314vlmkit_2dsites4chat4main12attach__itemN4pickS3025(label) {
    _M0FP314vlmkit_2dsites4chat4main13close__attach(true);
    _M0FP314vlmkit_2dsites4chat4main3say(`${label} is not available in this demo`);
  }
  function _M0FP314vlmkit_2dsites4chat4main12attach__item(label, path) {
    return _M0FP36mizchi4luna3dom2li(undefined, _M0FP314vlmkit_2dsites4chat4main12attach__itemN6constrS3026, undefined, undefined, undefined, new _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4Some(_M0MP36mizchi4luna3dom10HandlerMap7keydown(_M0MP36mizchi4luna3dom10HandlerMap5click(_M0FP36mizchi4luna3dom6events(), (_e) => {
      _M0FP314vlmkit_2dsites4chat4main12attach__itemN4pickS3025(label);
    }), (e) => {
      const k = _M0FP314vlmkit_2dsites4chat4main7key__ofGRP36mizchi11js__browser3dom13KeyboardEventE(e);
      if (k === "Enter" || k === " ") {
        _M0FP314vlmkit_2dsites4chat4main7preventGRP36mizchi11js__browser3dom13KeyboardEventE(e);
        _M0FP314vlmkit_2dsites4chat4main12attach__itemN4pickS3025(label);
        return;
      } else {
        return;
      }
    })), undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4chat4main1s("role", "menuitem"), _M0FP314vlmkit_2dsites4chat4main1s("tabindex", "-1")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP314vlmkit_2dsites4chat4main4icon(path), _M0FP36mizchi4luna3dom4span(undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4text(label)])]);
  }
  function _M0FP314vlmkit_2dsites4chat4main9composingGRP36mizchi11js__browser3dom13KeyboardEventE(e) {
    const v = _M0MP26mizchi8js__core3Any5__get(e, "isComposing");
    return _M0FP26mizchi8js__core11is__nullish(v) ? false : v;
  }
  function _M0FP314vlmkit_2dsites4chat4main9shift__ofGRP36mizchi11js__browser3dom13KeyboardEventE(e) {
    return _M0MP26mizchi8js__core3Any5__get(e, "shiftKey");
  }
  function _M0FP314vlmkit_2dsites4chat4main9shift__ofGRP26mizchi8js__core3AnyE(e) {
    return _M0MP26mizchi8js__core3Any5__get(e, "shiftKey");
  }
  function _M0FP314vlmkit_2dsites4chat4main14composer__view() {
    const empty = _M0FP26mizchi7signals4memoGbE(() => _M0IPC16string10StringViewPB2Eq5equal(_M0MPC16string6String4trim(_M0MP26mizchi7signals6Signal3getGsE(_M0FP314vlmkit_2dsites4chat4main5draft), undefined), _M0FP314vlmkit_2dsites4chat4main14composer__viewN6recordS3037));
    return _M0FP36mizchi4luna3dom3div(undefined, _M0FP314vlmkit_2dsites4chat4main14composer__viewN6constrS3038, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4show(() => !_M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4chat4main6pinned) && _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4chat4main7current) >= 0, () => _M0FP314vlmkit_2dsites4chat4main12icon__button("Scroll to bottom", _M0FP314vlmkit_2dsites4chat4main7i__down, _M0FP314vlmkit_2dsites4chat4main14composer__viewN6constrS3039, _M0FP314vlmkit_2dsites4chat4main14composer__viewN6constrS3040, new _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4Some(_M0MP36mizchi4luna3dom10HandlerMap5click(_M0FP36mizchi4luna3dom6events(), (_e) => {
      const sc = _M0FP314vlmkit_2dsites4chat4main8scroller.val;
      if (!_M0FP26mizchi8js__core11is__nullish(sc)) {
        _M0MP26mizchi8js__core3Any5__set(sc, "scrollTop", _M0MP26mizchi8js__core3Any5__get(sc, "scrollHeight"));
      }
      _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4chat4main6pinned, true);
      _M0FP314vlmkit_2dsites4chat4main12later__focus("#prompt");
    })), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__)), _M0FP36mizchi4luna3dom4form(undefined, undefined, undefined, _M0FP314vlmkit_2dsites4chat4main14composer__viewN6constrS3041, undefined, undefined, undefined, new _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4Some(_M0MP36mizchi4luna3dom10HandlerMap6submit(_M0FP36mizchi4luna3dom6events(), (e) => {
      _M0FP314vlmkit_2dsites4chat4main7preventGRP36mizchi11js__browser3dom13KeyboardEventE(e);
      _M0FP314vlmkit_2dsites4chat4main10send__text(_M0MP26mizchi7signals6Signal3getGsE(_M0FP314vlmkit_2dsites4chat4main5draft));
    })), undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4chat4main1s("aria-label", "Message composer")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom8textarea(undefined, _M0FP314vlmkit_2dsites4chat4main14composer__viewN6constrS3042, -1, _M0FP314vlmkit_2dsites4chat4main14composer__viewN6constrS3043, _M0FP314vlmkit_2dsites4chat4main14composer__viewN6constrS3044, undefined, undefined, undefined, new _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4Some(_M0MP36mizchi4luna3dom10HandlerMap7keydown(_M0MP36mizchi4luna3dom10HandlerMap5input(_M0FP36mizchi4luna3dom6events(), (e) => {
      _M0MP26mizchi7signals6Signal3setGsE(_M0FP314vlmkit_2dsites4chat4main5draft, _M0FP314vlmkit_2dsites4chat4main13target__valueGRP36mizchi11js__browser3dom13KeyboardEventE(e));
      _M0FP314vlmkit_2dsites4chat4main4grow(_M0MP26mizchi8js__core3Any5__get(e, "target"));
    }), (e) => {
      if (_M0FP314vlmkit_2dsites4chat4main7key__ofGRP36mizchi11js__browser3dom13KeyboardEventE(e) === "Enter" && (!_M0FP314vlmkit_2dsites4chat4main9shift__ofGRP36mizchi11js__browser3dom13KeyboardEventE(e) && !_M0FP314vlmkit_2dsites4chat4main9composingGRP36mizchi11js__browser3dom13KeyboardEventE(e))) {
        _M0FP314vlmkit_2dsites4chat4main7preventGRP36mizchi11js__browser3dom13KeyboardEventE(e);
        _M0FP314vlmkit_2dsites4chat4main10send__text(_M0MP26mizchi7signals6Signal3getGsE(_M0FP314vlmkit_2dsites4chat4main5draft));
        return;
      } else {
        return;
      }
    })), (e) => {
      _M0FP314vlmkit_2dsites4chat4main10prompt__el.val = e;
    }, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4chat4main1s("rows", "1"), _M0FP314vlmkit_2dsites4chat4main1s("aria-label", "Message Parley")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, []), _M0FP36mizchi4luna3dom3div(undefined, _M0FP314vlmkit_2dsites4chat4main14composer__viewN6constrS3045, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom3div(undefined, _M0FP314vlmkit_2dsites4chat4main14composer__viewN6constrS3046, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4chat4main1s("data-menu-root", "")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP314vlmkit_2dsites4chat4main20icon__button_2einner("Attach", _M0FP314vlmkit_2dsites4chat4main7i__plus, "icon-btn attach-btn", "attach-btn", _M0MP36mizchi4luna3dom10HandlerMap5click(_M0FP36mizchi4luna3dom6events(), (_e) => {
      if (_M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4chat4main12attach__open)) {
        _M0FP314vlmkit_2dsites4chat4main13close__attach(false);
        return;
      } else {
        _M0FP314vlmkit_2dsites4chat4main12close__menus();
        _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4chat4main12attach__open, true);
        _M0FP314vlmkit_2dsites4chat4main12later__focus("#attach-menu [role=menuitem]");
        return;
      }
    }), [_M0FP314vlmkit_2dsites4chat4main1d("aria-haspopup", () => "menu"), _M0FP314vlmkit_2dsites4chat4main1d("aria-expanded", () => {
      const _p = _M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4chat4main12attach__open);
      return _p ? "true" : "false";
    })]), _M0FP36mizchi4luna3dom4show(() => _M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4chat4main12attach__open), () => _M0FP36mizchi4luna3dom2ul(_M0FP314vlmkit_2dsites4chat4main14composer__viewN6constrS3047, _M0FP314vlmkit_2dsites4chat4main14composer__viewN6constrS3048, undefined, undefined, undefined, new _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4Some(_M0MP36mizchi4luna3dom10HandlerMap7keydown(_M0FP36mizchi4luna3dom6events(), (e) => {
      _M0FP314vlmkit_2dsites4chat4main10menu__keysGRP36mizchi11js__browser3dom13KeyboardEventE(e, "#attach-menu", _M0FP314vlmkit_2dsites4chat4main13close__attach);
    })), undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4chat4main1s("role", "menu"), _M0FP314vlmkit_2dsites4chat4main1s("aria-label", "Attach")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP314vlmkit_2dsites4chat4main12attach__item("Upload file", _M0FP314vlmkit_2dsites4chat4main9i__upload), _M0FP314vlmkit_2dsites4chat4main12attach__item("Take screenshot", _M0FP314vlmkit_2dsites4chat4main7i__shot)]))]), _M0FP36mizchi4luna3dom4show(() => !_M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4chat4main4busy), () => _M0FP36mizchi4luna3dom6button(-1, _M0FP314vlmkit_2dsites4chat4main14composer__viewN6constrS3049, _M0FP314vlmkit_2dsites4chat4main14composer__viewN6constrS3050, undefined, undefined, undefined, () => empty(), _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4chat4main1s("type", "submit"), _M0FP314vlmkit_2dsites4chat4main1s("aria-label", "Send message"), _M0FP314vlmkit_2dsites4chat4main1s("title", "Send message")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP314vlmkit_2dsites4chat4main4icon(_M0FP314vlmkit_2dsites4chat4main5i__up)])), _M0FP36mizchi4luna3dom4show(() => _M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4chat4main4busy), () => _M0FP36mizchi4luna3dom6button(-1, _M0FP314vlmkit_2dsites4chat4main14composer__viewN6constrS3051, _M0FP314vlmkit_2dsites4chat4main14composer__viewN6constrS3052, undefined, undefined, undefined, undefined, new _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4Some(_M0MP36mizchi4luna3dom10HandlerMap5click(_M0FP36mizchi4luna3dom6events(), (_e) => {
      _M0FP314vlmkit_2dsites4chat4main12stop__stream();
      _M0FP314vlmkit_2dsites4chat4main12later__focus("#prompt");
    })), undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4chat4main1s("type", "button")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4span(undefined, _M0FP314vlmkit_2dsites4chat4main14composer__viewN6constrS3053, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4chat4main1s("aria-hidden", "true")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, []), _M0FP36mizchi4luna3dom4span(undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4text("Stop generating")])]))])]), _M0FP36mizchi4luna3dom1p(undefined, _M0FP314vlmkit_2dsites4chat4main14composer__viewN6constrS3054, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4text("Parley can make mistakes. Check important info.")])]);
  }
  function _M0FP314vlmkit_2dsites4chat4main18conversation__view() {
    return _M0FP36mizchi4luna3dom8fragment([_M0FP36mizchi4luna3dom3div(_M0FP314vlmkit_2dsites4chat4main18conversation__viewN6constrS3065, _M0FP314vlmkit_2dsites4chat4main18conversation__viewN6constrS3066, undefined, undefined, undefined, new _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4Some(_M0MP36mizchi4luna3dom10HandlerMap6scroll(_M0FP36mizchi4luna3dom6events(), (_e) => {
      const b = _M0FP314vlmkit_2dsites4chat4main10at__bottom();
      const _p = _M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4chat4main6pinned);
      if (!(b === _p)) {
        _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4chat4main6pinned, b);
        return;
      } else {
        return;
      }
    })), (e) => {
      _M0FP314vlmkit_2dsites4chat4main8scroller.val = e;
    }, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom3div(undefined, _M0FP314vlmkit_2dsites4chat4main18conversation__viewN6constrS3067, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4show(() => _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4chat4main7current) < 0, _M0FP314vlmkit_2dsites4chat4main11empty__view), _M0FP36mizchi4luna3dom4show(() => _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4chat4main7current) >= 0, () => _M0FP36mizchi4luna3dom3div(undefined, _M0FP314vlmkit_2dsites4chat4main18conversation__viewN6constrS3068, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4chat4main1s("role", "log"), _M0FP314vlmkit_2dsites4chat4main1s("aria-label", "Conversation")]), new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4Some([_M0FP314vlmkit_2dsites4chat4main1d("aria-busy", () => {
      const _p = _M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4chat4main4busy);
      return _p ? "true" : "false";
    })]), [_M0FP36mizchi4luna3dom9for__eachGRP314vlmkit_2dsites4chat4main3MsgE(_M0FP314vlmkit_2dsites4chat4main13messages__now, _M0FP314vlmkit_2dsites4chat4main9msg__view)]))])]), _M0FP314vlmkit_2dsites4chat4main14composer__view(), _M0FP36mizchi4luna3dom1p(undefined, _M0FP314vlmkit_2dsites4chat4main18conversation__viewN6constrS3069, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4chat4main1s("role", "status"), _M0FP314vlmkit_2dsites4chat4main1s("aria-live", "polite")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom9text__dyn(() => _M0MP26mizchi7signals6Signal3getGsE(_M0FP314vlmkit_2dsites4chat4main6status))])]);
  }
  function _M0FP314vlmkit_2dsites4chat4main15row__menu__itemN3runS3073(act) {
    const _bind = _M0FP314vlmkit_2dsites4chat4main10find__conv(_M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4chat4main9row__menu));
    if (_bind === undefined) {
      return;
    } else {
      const _Some = _bind;
      const _c = _Some;
      _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4chat4main9row__menu, -1);
      act(_c);
      return;
    }
  }
  function _M0FP314vlmkit_2dsites4chat4main15row__menu__item(label, path, act, danger) {
    return _M0FP36mizchi4luna3dom2li(undefined, danger ? "menu-item danger" : "menu-item", undefined, undefined, undefined, new _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4Some(_M0MP36mizchi4luna3dom10HandlerMap7keydown(_M0MP36mizchi4luna3dom10HandlerMap5click(_M0FP36mizchi4luna3dom6events(), (_e) => {
      _M0FP314vlmkit_2dsites4chat4main15row__menu__itemN3runS3073(act);
    }), (e) => {
      const k = _M0FP314vlmkit_2dsites4chat4main7key__ofGRP36mizchi11js__browser3dom13KeyboardEventE(e);
      if (k === "Enter" || k === " ") {
        _M0FP314vlmkit_2dsites4chat4main7preventGRP36mizchi11js__browser3dom13KeyboardEventE(e);
        _M0FP314vlmkit_2dsites4chat4main15row__menu__itemN3runS3073(act);
        return;
      } else {
        return;
      }
    })), undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4chat4main1s("role", "menuitem"), _M0FP314vlmkit_2dsites4chat4main1s("tabindex", "-1")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP314vlmkit_2dsites4chat4main4icon(path), _M0FP36mizchi4luna3dom4span(undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4text(label)])]);
  }
  function _M0FP314vlmkit_2dsites4chat4main10focusables(root) {
    const _p = _M0FP26mizchi8js__core11array__from(_M0MP26mizchi8js__core3Any6__call(root, "querySelectorAll", ["button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex=\"-1\"])"]));
    const _p$2 = [];
    const _p$3 = _p.length;
    let _tmp = 0;
    while (true) {
      const _p$4 = _tmp;
      if (_p$4 < _p$3) {
        const _p$5 = _p[_p$4];
        const _p$6 = _M0MP26mizchi8js__core3Any5__get(_M0MP26mizchi8js__core3Any6__call(_p$5, "getClientRects", []), "length");
        if (_p$6 > 0) {
          _M0MPC15array5Array4pushGRP36mizchi11js__browser3dom4NodeE(_p$2, _p$5);
        }
        _tmp = _p$4 + 1 | 0;
        continue;
      } else {
        return _p$2;
      }
    }
  }
  function _M0FP314vlmkit_2dsites4chat4main9trap__tabGRP36mizchi11js__browser3dom13KeyboardEventE(e, root) {
    let _tmp;
    const _p = _M0FP314vlmkit_2dsites4chat4main7key__ofGRP36mizchi11js__browser3dom13KeyboardEventE(e);
    const _p$2 = "Tab";
    if (!(_p === _p$2)) {
      _tmp = true;
    } else {
      _tmp = _M0FP26mizchi8js__core11is__nullish(root);
    }
    if (_tmp) {
      return undefined;
    }
    const items = _M0FP314vlmkit_2dsites4chat4main10focusables(root);
    if (items.length === 0) {
      return undefined;
    }
    const first = _M0MPC15array5Array2atGORP26mizchi7signals10EffectNodeE(items, 0);
    const last = _M0MPC15array5Array2atGORP26mizchi7signals10EffectNodeE(items, items.length - 1 | 0);
    const act = _M0FP314vlmkit_2dsites4chat4main10active__el();
    if (_M0FP314vlmkit_2dsites4chat4main9shift__ofGRP36mizchi11js__browser3dom13KeyboardEventE(e)) {
      if (_M0FP26mizchi8js__core5equal(act, first) || !_M0MP26mizchi8js__core3Any6__call(root, "contains", [act])) {
        _M0FP314vlmkit_2dsites4chat4main7preventGRP36mizchi11js__browser3dom13KeyboardEventE(e);
        _M0FP314vlmkit_2dsites4chat4main9focus__el(last);
        return;
      } else {
        return;
      }
    } else {
      if (_M0FP26mizchi8js__core5equal(act, last) || !_M0MP26mizchi8js__core3Any6__call(root, "contains", [act])) {
        _M0FP314vlmkit_2dsites4chat4main7preventGRP36mizchi11js__browser3dom13KeyboardEventE(e);
        _M0FP314vlmkit_2dsites4chat4main9focus__el(first);
        return;
      } else {
        return;
      }
    }
  }
  function _M0FP314vlmkit_2dsites4chat4main9trap__tabGRP26mizchi8js__core3AnyE(e, root) {
    let _tmp;
    const _p = _M0FP314vlmkit_2dsites4chat4main7key__ofGRP26mizchi8js__core3AnyE(e);
    const _p$2 = "Tab";
    if (!(_p === _p$2)) {
      _tmp = true;
    } else {
      _tmp = _M0FP26mizchi8js__core11is__nullish(root);
    }
    if (_tmp) {
      return undefined;
    }
    const items = _M0FP314vlmkit_2dsites4chat4main10focusables(root);
    if (items.length === 0) {
      return undefined;
    }
    const first = _M0MPC15array5Array2atGORP26mizchi7signals10EffectNodeE(items, 0);
    const last = _M0MPC15array5Array2atGORP26mizchi7signals10EffectNodeE(items, items.length - 1 | 0);
    const act = _M0FP314vlmkit_2dsites4chat4main10active__el();
    if (_M0FP314vlmkit_2dsites4chat4main9shift__ofGRP26mizchi8js__core3AnyE(e)) {
      if (_M0FP26mizchi8js__core5equal(act, first) || !_M0MP26mizchi8js__core3Any6__call(root, "contains", [act])) {
        _M0FP314vlmkit_2dsites4chat4main7preventGRP26mizchi8js__core3AnyE(e);
        _M0FP314vlmkit_2dsites4chat4main9focus__el(last);
        return;
      } else {
        return;
      }
    } else {
      if (_M0FP26mizchi8js__core5equal(act, last) || !_M0MP26mizchi8js__core3Any6__call(root, "contains", [act])) {
        _M0FP314vlmkit_2dsites4chat4main7preventGRP26mizchi8js__core3AnyE(e);
        _M0FP314vlmkit_2dsites4chat4main9focus__el(first);
        return;
      } else {
        return;
      }
    }
  }
  function _M0FP314vlmkit_2dsites4chat4main13dialog__frame(id, role, title_id, on_close, children) {
    return _M0FP36mizchi4luna3dom3div(undefined, _M0FP314vlmkit_2dsites4chat4main13dialog__frameN6constrS3100, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom3div(undefined, _M0FP314vlmkit_2dsites4chat4main13dialog__frameN6constrS3101, undefined, undefined, undefined, new _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4Some(_M0MP36mizchi4luna3dom10HandlerMap5click(_M0FP36mizchi4luna3dom6events(), (_e) => {
      on_close();
    })), undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4chat4main1s("aria-hidden", "true")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, []), _M0FP36mizchi4luna3dom3div(id, _M0FP314vlmkit_2dsites4chat4main13dialog__frameN6constrS3102, undefined, undefined, undefined, new _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4Some(_M0MP36mizchi4luna3dom10HandlerMap7keydown(_M0FP36mizchi4luna3dom6events(), (e) => {
      if (_M0FP314vlmkit_2dsites4chat4main7key__ofGRP36mizchi11js__browser3dom13KeyboardEventE(e) === "Escape") {
        _M0FP314vlmkit_2dsites4chat4main7preventGRP36mizchi11js__browser3dom13KeyboardEventE(e);
        on_close();
        return;
      } else {
        _M0FP314vlmkit_2dsites4chat4main9trap__tabGRP36mizchi11js__browser3dom13KeyboardEventE(e, _M0FP314vlmkit_2dsites4chat4main2qs(`#${id}`));
        return;
      }
    })), undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4chat4main1s("role", role), _M0FP314vlmkit_2dsites4chat4main1s("aria-modal", "true"), _M0FP314vlmkit_2dsites4chat4main1s("aria-labelledby", title_id)]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, children)]);
  }
  function _M0FP314vlmkit_2dsites4chat4main14overlays__viewN12close__shareS3110() {
    _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4chat4main11share__open, false);
    _M0FP314vlmkit_2dsites4chat4main12later__focus("#share-btn");
  }
  function _M0FP314vlmkit_2dsites4chat4main14overlays__viewN14cancel__deleteS3111() {
    const id = _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4chat4main15confirm__delete);
    _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4chat4main15confirm__delete, -1);
    const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(6);
    _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, "#more-");
    _M0MPB13StringBuilder13write__objectGiE(_string_builder, id);
    _M0FP314vlmkit_2dsites4chat4main12later__focus(_string_builder.val);
  }
  function _M0FP314vlmkit_2dsites4chat4main14overlays__view() {
    return _M0FP36mizchi4luna3dom8fragment([_M0FP36mizchi4luna3dom4show(() => _M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4chat4main6drawer), () => _M0FP36mizchi4luna3dom3div(undefined, _M0FP314vlmkit_2dsites4chat4main14overlays__viewN6constrS3112, undefined, undefined, undefined, new _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4Some(_M0MP36mizchi4luna3dom10HandlerMap5click(_M0FP36mizchi4luna3dom6events(), (_e) => {
      _M0FP314vlmkit_2dsites4chat4main11set__drawer(false);
      _M0FP314vlmkit_2dsites4chat4main10focus__sel("#open-drawer");
    })), undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4chat4main1s("aria-hidden", "true")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [])), _M0FP36mizchi4luna3dom4show(() => _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4chat4main9row__menu) >= 0, () => _M0FP36mizchi4luna3dom2ul(_M0FP314vlmkit_2dsites4chat4main14overlays__viewN6constrS3113, _M0FP314vlmkit_2dsites4chat4main14overlays__viewN6constrS3114, undefined, undefined, () => _M0MP26mizchi7signals6Signal3getGsE(_M0FP314vlmkit_2dsites4chat4main16row__menu__style), new _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4Some(_M0MP36mizchi4luna3dom10HandlerMap7keydown(_M0FP36mizchi4luna3dom6events(), (e) => {
      _M0FP314vlmkit_2dsites4chat4main10menu__keysGRP36mizchi11js__browser3dom13KeyboardEventE(e, "#row-menu", _M0FP314vlmkit_2dsites4chat4main16close__row__menu);
    })), undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4chat4main1s("role", "menu"), _M0FP314vlmkit_2dsites4chat4main1s("aria-label", "Chat options"), _M0FP314vlmkit_2dsites4chat4main1s("data-menu-root", "")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP314vlmkit_2dsites4chat4main15row__menu__item("Rename", _M0FP314vlmkit_2dsites4chat4main9i__rename, (c) => {
      _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4chat4main8renaming, c.id);
      _M0FP314vlmkit_2dsites4chat4main12set__timeout(() => {
        const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(8);
        _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, "#rename-");
        _M0MPB13StringBuilder13write__objectGiE(_string_builder, c.id);
        const inp = _M0FP314vlmkit_2dsites4chat4main2qs(_string_builder.val);
        _M0FP314vlmkit_2dsites4chat4main9focus__el(inp);
        if (!_M0FP26mizchi8js__core11is__nullish(inp)) {
          _M0MP26mizchi8js__core3Any6__call(inp, "select", []);
          return;
        } else {
          return;
        }
      }, 0);
    }, false), _M0FP314vlmkit_2dsites4chat4main15row__menu__item("Archive", _M0FP314vlmkit_2dsites4chat4main10i__archive, (c) => {
      const t = _M0MP26mizchi7signals6Signal3getGsE(c.title);
      _M0FP314vlmkit_2dsites4chat4main12remove__conv(c.id);
      _M0FP314vlmkit_2dsites4chat4main3say(`Archived “${t}”`);
      _M0FP314vlmkit_2dsites4chat4main12later__focus("#search");
    }, false), _M0FP314vlmkit_2dsites4chat4main15row__menu__item("Delete", _M0FP314vlmkit_2dsites4chat4main8i__trash, (c) => {
      _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4chat4main15confirm__delete, c.id);
      _M0FP314vlmkit_2dsites4chat4main12later__focus("#delete-cancel");
    }, true)])), _M0FP36mizchi4luna3dom4show(() => _M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4chat4main11share__open), () => _M0FP314vlmkit_2dsites4chat4main13dialog__frame("share-dialog", "dialog", "share-title", _M0FP314vlmkit_2dsites4chat4main14overlays__viewN12close__shareS3110, [_M0FP36mizchi4luna3dom3div(undefined, _M0FP314vlmkit_2dsites4chat4main14overlays__viewN6constrS3115, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom2h2(_M0FP314vlmkit_2dsites4chat4main14overlays__viewN6constrS3116, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4text("Share this chat")]), _M0FP314vlmkit_2dsites4chat4main12icon__button("Close", _M0FP314vlmkit_2dsites4chat4main8i__close, undefined, undefined, new _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4Some(_M0MP36mizchi4luna3dom10HandlerMap5click(_M0FP36mizchi4luna3dom6events(), (_e) => {
      _M0FP314vlmkit_2dsites4chat4main14overlays__viewN12close__shareS3110();
    })), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__)]), _M0FP36mizchi4luna3dom1p(undefined, _M0FP314vlmkit_2dsites4chat4main14overlays__viewN6constrS3117, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4text("Anyone with the link can read this conversation. Messages you send after sharing stay private.")]), _M0FP36mizchi4luna3dom3div(undefined, _M0FP314vlmkit_2dsites4chat4main14overlays__viewN6constrS3118, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom5input(_M0FP314vlmkit_2dsites4chat4main14overlays__viewN6constrS3119, undefined, _M0FP314vlmkit_2dsites4chat4main14overlays__viewN10share__urlS3130, undefined, -1, _M0FP314vlmkit_2dsites4chat4main14overlays__viewN6constrS3120, -1, -1, _M0FP314vlmkit_2dsites4chat4main14overlays__viewN6constrS3121, undefined, undefined, undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4chat4main1s("aria-label", "Share link")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__), _M0FP36mizchi4luna3dom6button(-1, _M0FP314vlmkit_2dsites4chat4main14overlays__viewN6constrS3122, _M0FP314vlmkit_2dsites4chat4main14overlays__viewN6constrS3123, undefined, undefined, undefined, undefined, new _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4Some(_M0MP36mizchi4luna3dom10HandlerMap5click(_M0FP36mizchi4luna3dom6events(), (_e) => {
      _M0FP314vlmkit_2dsites4chat4main10copy__text(_M0FP314vlmkit_2dsites4chat4main14overlays__viewN10share__urlS3130);
      _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4chat4main12link__copied, true);
      _M0FP314vlmkit_2dsites4chat4main3say("Link copied");
      _M0FP314vlmkit_2dsites4chat4main12set__timeout(() => {
        _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4chat4main12link__copied, false);
      }, 2000);
    })), undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4chat4main1s("type", "button")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom9text__dyn(() => _M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4chat4main12link__copied) ? "Copied" : "Copy link")])])])), _M0FP36mizchi4luna3dom4show(() => _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4chat4main15confirm__delete) >= 0, () => {
      const _bind = _M0FP314vlmkit_2dsites4chat4main10find__conv(_M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4chat4main15confirm__delete));
      let title;
      if (_bind === undefined) {
        title = "";
      } else {
        const _Some = _bind;
        const _c = _Some;
        title = _M0MP26mizchi7signals6Signal3getGsE(_c.title);
      }
      return _M0FP314vlmkit_2dsites4chat4main13dialog__frame("delete-dialog", "alertdialog", "delete-title", _M0FP314vlmkit_2dsites4chat4main14overlays__viewN14cancel__deleteS3111, [_M0FP36mizchi4luna3dom2h2(_M0FP314vlmkit_2dsites4chat4main14overlays__viewN6constrS3124, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4text("Delete chat?")]), _M0FP36mizchi4luna3dom1p(undefined, _M0FP314vlmkit_2dsites4chat4main14overlays__viewN6constrS3125, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4text("This deletes “"), _M0FP36mizchi4luna3dom6strong(undefined, undefined, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4text(title)]), _M0FP36mizchi4luna3dom4text("” and its messages. You can’t undo this.")]), _M0FP36mizchi4luna3dom3div(undefined, _M0FP314vlmkit_2dsites4chat4main14overlays__viewN6constrS3126, undefined, undefined, undefined, _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4None__, undefined, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4None__, _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom6button(-1, _M0FP314vlmkit_2dsites4chat4main14overlays__viewN6constrS3127, _M0FP314vlmkit_2dsites4chat4main14overlays__viewN6constrS3128, undefined, undefined, undefined, undefined, new _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4Some(_M0MP36mizchi4luna3dom10HandlerMap5click(_M0FP36mizchi4luna3dom6events(), (_e) => {
        _M0FP314vlmkit_2dsites4chat4main14overlays__viewN14cancel__deleteS3111();
      })), undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4chat4main1s("type", "button")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4text("Cancel")]), _M0FP36mizchi4luna3dom6button(-1, undefined, _M0FP314vlmkit_2dsites4chat4main14overlays__viewN6constrS3129, undefined, undefined, undefined, undefined, new _M0DTPC16option6OptionGRP36mizchi4luna3dom10HandlerMapE4Some(_M0MP36mizchi4luna3dom10HandlerMap5click(_M0FP36mizchi4luna3dom6events(), (_e) => {
        const id = _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4chat4main15confirm__delete);
        _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4chat4main15confirm__delete, -1);
        _M0FP314vlmkit_2dsites4chat4main12remove__conv(id);
        _M0FP314vlmkit_2dsites4chat4main3say("Chat deleted");
        _M0FP314vlmkit_2dsites4chat4main12later__focus("#search");
      })), undefined, new _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom4AttrEEE4Some([_M0FP314vlmkit_2dsites4chat4main1s("type", "button")]), _M0DTPC16option6OptionGRPB5ArrayGUsRP36mizchi4luna3dom9AttrValueEEE4None__, [_M0FP36mizchi4luna3dom4text("Delete")])])]);
    })]);
  }
  function _M0FP314vlmkit_2dsites4chat4main5mount(id, node) {
    const _bind = _M0MP36mizchi11js__browser3dom8Document14getElementById(_M0FP36mizchi11js__browser3dom8document(), id);
    if (_bind.$tag === 1) {
      const _Some = _bind;
      const _e = _Some._0;
      _M0FP36mizchi4luna3dom10render__to(_e, node);
      return;
    } else {
      return;
    }
  }
  function _M0FP314vlmkit_2dsites4chat4main13add__listener(target, name, f) {
    _M0MP26mizchi8js__core3Any6__call(target, "addEventListener", [name, f]);
  }
  function _M0FP314vlmkit_2dsites4chat4main10query__has(part) {
    const s = _M0MP26mizchi8js__core3Any5__get(_M0MP26mizchi8js__core3Any5__get(_M0FP314vlmkit_2dsites4chat4main3win(), "location"), "search");
    return _M0MPC16string6String8contains(s, new _M0TPC16string10StringView(part, 0, part.length));
  }
  function _M0FP314vlmkit_2dsites4chat4main10set__inert(sel, on) {
    const el = _M0FP314vlmkit_2dsites4chat4main2qs(sel);
    if (!_M0FP26mizchi8js__core11is__nullish(el)) {
      _M0MP26mizchi8js__core3Any5__set(el, "inert", on);
      return;
    } else {
      return;
    }
  }
  (() => {
    const root = _M0MP26mizchi8js__core3Any5__get(_M0FP314vlmkit_2dsites4chat4main3doc(), "documentElement");
    if (_M0FP314vlmkit_2dsites4chat4main10query__has("theme=dark")) {
      _M0MP26mizchi8js__core3Any6__call(root, "setAttribute", ["data-theme", "dark"]);
    } else {
      if (_M0FP314vlmkit_2dsites4chat4main10query__has("theme=light")) {
        _M0MP26mizchi8js__core3Any6__call(root, "setAttribute", ["data-theme", "light"]);
      }
    }
    _M0FP314vlmkit_2dsites4chat4main7instant.val = _M0FP314vlmkit_2dsites4chat4main10query__has("animate=0") || _M0FP314vlmkit_2dsites4chat4main5media("(prefers-reduced-motion: reduce)");
    if (_M0FP314vlmkit_2dsites4chat4main10query__has("history=empty")) {
      _M0MP26mizchi7signals6Signal3setGRPB5ArrayGRP314vlmkit_2dsites4chat4main4ConvEE(_M0FP314vlmkit_2dsites4chat4main5convs, []);
    } else {
      if (!_M0FP314vlmkit_2dsites4chat4main10query__has("chat=new")) {
        _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4chat4main7current, _M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(_M0MP26mizchi7signals6Signal3getGRPB5ArrayGRP314vlmkit_2dsites4chat4main4ConvEE(_M0FP314vlmkit_2dsites4chat4main5convs), 0).id);
      }
    }
    _M0FP314vlmkit_2dsites4chat4main5mount("sidebar", _M0FP314vlmkit_2dsites4chat4main13sidebar__view());
    _M0FP314vlmkit_2dsites4chat4main5mount("topbar", _M0FP314vlmkit_2dsites4chat4main12header__view());
    _M0FP314vlmkit_2dsites4chat4main5mount("conv", _M0FP314vlmkit_2dsites4chat4main18conversation__view());
    _M0FP314vlmkit_2dsites4chat4main5mount("overlays", _M0FP314vlmkit_2dsites4chat4main14overlays__view());
    _M0FP26mizchi7signals6effect(() => {
      const cls = _M0MPB13StringBuilder21StringBuilder_2einner(8);
      _M0IPB13StringBuilderPB6Logger13write__string(cls, "shell");
      if (_M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4chat4main9collapsed)) {
        _M0IPB13StringBuilderPB6Logger13write__string(cls, " is-collapsed");
      }
      if (_M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4chat4main6drawer)) {
        _M0IPB13StringBuilderPB6Logger13write__string(cls, " is-drawer");
      }
      if (_M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4chat4main12drawer__anim)) {
        _M0IPB13StringBuilderPB6Logger13write__string(cls, " drawer-anim");
      }
      const shell = _M0FP314vlmkit_2dsites4chat4main2qs("#shell");
      if (!_M0FP26mizchi8js__core11is__nullish(shell)) {
        _M0MP26mizchi8js__core3Any5__set(shell, "className", cls.val);
        return;
      } else {
        return;
      }
    });
    _M0FP26mizchi7signals6effect(() => {
      const modal = _M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4chat4main11share__open) || _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4chat4main15confirm__delete) >= 0;
      _M0FP314vlmkit_2dsites4chat4main10set__inert("#shell", modal);
      _M0FP314vlmkit_2dsites4chat4main10set__inert(".main-col", _M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4chat4main6drawer));
    });
    _M0FP314vlmkit_2dsites4chat4main13add__listener(_M0FP314vlmkit_2dsites4chat4main3doc(), "click", (e) => {
      const t = _M0MP26mizchi8js__core3Any5__get(e, "target");
      const inside = _M0FP26mizchi8js__core11is__nullish(t) || _M0FP26mizchi8js__core11is__nullish(_M0MP26mizchi8js__core3Any5__get(t, "closest")) ? false : !_M0FP26mizchi8js__core11is__nullish(_M0MP26mizchi8js__core3Any6__call(t, "closest", ["[data-menu-root], .menu"]));
      if (!inside) {
        if (_M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4chat4main11model__open) || (_M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4chat4main12attach__open) || _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4chat4main9row__menu) >= 0)) {
          _M0FP314vlmkit_2dsites4chat4main12close__menus();
          return;
        } else {
          return;
        }
      } else {
        return;
      }
    });
    _M0FP314vlmkit_2dsites4chat4main13add__listener(_M0FP314vlmkit_2dsites4chat4main2qs("#sidebar"), "keydown", (e) => {
      if (_M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4chat4main6drawer)) {
        if (_M0FP314vlmkit_2dsites4chat4main7key__ofGRP26mizchi8js__core3AnyE(e) === "Escape" && (_M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4chat4main9row__menu) < 0 && _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4chat4main8renaming) < 0)) {
          _M0FP314vlmkit_2dsites4chat4main7preventGRP26mizchi8js__core3AnyE(e);
          _M0FP314vlmkit_2dsites4chat4main11set__drawer(false);
          _M0FP314vlmkit_2dsites4chat4main10focus__sel("#open-drawer");
          return;
        } else {
          _M0FP314vlmkit_2dsites4chat4main9trap__tabGRP26mizchi8js__core3AnyE(e, _M0FP314vlmkit_2dsites4chat4main2qs("#sidebar"));
          return;
        }
      } else {
        return;
      }
    });
    _M0FP314vlmkit_2dsites4chat4main13add__listener(_M0FP314vlmkit_2dsites4chat4main3win(), "resize", (_e) => {
      if (_M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4chat4main12drawer__anim)) {
        _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4chat4main12drawer__anim, false);
      }
      if (_M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4chat4main6drawer) && !_M0FP314vlmkit_2dsites4chat4main9is__phone()) {
        _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4chat4main6drawer, false);
      }
      if (_M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4chat4main9row__menu) >= 0) {
        _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4chat4main9row__menu, -1);
        return;
      } else {
        return;
      }
    });
    _M0FP314vlmkit_2dsites4chat4main12set__timeout(() => {
      _M0FP314vlmkit_2dsites4chat4main15scroll__to__end();
    }, 0);
  })();
})();
