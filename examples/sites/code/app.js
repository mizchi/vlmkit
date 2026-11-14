// Built from src/ (MoonBit, mizchi/luna) by `node examples/sites/luna-build.mjs code`. Do not edit.
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
  function _M0TP314vlmkit_2dsites4code4main5Label(param0, param1) {
    this.name = param0;
    this.color = param1;
  }
  function _M0TP314vlmkit_2dsites4code4main4Pull(param0, param1, param2, param3, param4, param5) {
    this.num = param0;
    this.title = param1;
    this.author = param2;
    this.ago = param3;
    this.labels = param4;
    this.comments = param5;
  }
  function _M0TP314vlmkit_2dsites4code4main6Commit(param0, param1, param2, param3, param4) {
    this.author = param0;
    this.msg = param1;
    this.pr = param2;
    this.sha = param3;
    this.age = param4;
  }
  function _M0TP314vlmkit_2dsites4code4main5Entry(param0, param1, param2, param3, param4) {
    this.path = param0;
    this.is_dir = param1;
    this.msg = param2;
    this.pr = param3;
    this.age = param4;
  }
  function _M0TPC16string10StringView(param0, param1, param2) {
    this.str = param0;
    this.start = param1;
    this.end = param2;
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
  function _M0TP314vlmkit_2dsites4code4main6Branch(param0, param1, param2) {
    this.name = param0;
    this.is_tag = param1;
    this.head = param2;
  }
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
  function _M0TPB8MutLocalGiE(param0) {
    this.val = param0;
  }
  function $unsafe_make_string(a, b) {
    return String.fromCodePoint(b).repeat(a);
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
  function $compare_int(a, b) {
    return (a >= b) - (a <= b);
  }
  function _M0TPB9ArrayViewGcE(param0, param1, param2) {
    this.buf = param0;
    this.start = param1;
    this.end = param2;
  }
  const _M0MPB7JSArray11set__length = (arr, len) => { arr.length = len; };
  const _M0MPB7JSArray3pop = (arr) => arr.pop();
  const _M0MPB7JSArray6splice = (arr, idx, cnt) => arr.splice(idx, cnt);
  function _M0TPB12MutArrayViewGUsRPB5ArrayGiEEE(param0, param1, param2) {
    this.buf = param0;
    this.start = param1;
    this.end = param2;
  }
  function _M0TPB9ArrayViewGsE(param0, param1, param2) {
    this.buf = param0;
    this.start = param1;
    this.end = param2;
  }
  function _M0TPC13ref3RefGRPB5ArrayGRP36mizchi4luna3dom9ItemEntryGsEEE(param0) {
    this.val = param0;
  }
  function _M0TPC13ref3RefGiE(param0) {
    this.val = param0;
  }
  function _M0TPC13ref3RefGbE(param0) {
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
  function _M0TP26mizchi7signals10CoreSignalGiE(param0, param1, param2) {
    this.node = param0;
    this.current_value = param1;
    this.pending_value = param2;
  }
  function _M0TP26mizchi7signals10CoreSignalGsE(param0, param1, param2) {
    this.node = param0;
    this.current_value = param1;
    this.pending_value = param2;
  }
  function _M0TP26mizchi7signals10CoreSignalGbE(param0, param1, param2) {
    this.node = param0;
    this.current_value = param1;
    this.pending_value = param2;
  }
  function _M0TP26mizchi7signals10CoreSignalGRPB5ArrayGRP314vlmkit_2dsites4code4main5IssueEE(param0, param1, param2) {
    this.node = param0;
    this.current_value = param1;
    this.pending_value = param2;
  }
  function _M0TP26mizchi7signals6SignalGiE(param0) {
    this.inner = param0;
  }
  function _M0TP26mizchi7signals6SignalGsE(param0) {
    this.inner = param0;
  }
  function _M0TP26mizchi7signals6SignalGbE(param0) {
    this.inner = param0;
  }
  function _M0TP26mizchi7signals6SignalGRPB5ArrayGRP314vlmkit_2dsites4code4main5IssueEE(param0) {
    this.inner = param0;
  }
  function _M0TP26mizchi7signals8ComputedGRPB5ArrayGRP314vlmkit_2dsites4code4main7PalItemEE(param0, param1, param2) {
    this.node = param0;
    this.value = param1;
    this.getter = param2;
  }
  function _M0DTPC16option6OptionGRPB5ArrayGRP314vlmkit_2dsites4code4main7PalItemEE4None() {}
  _M0DTPC16option6OptionGRPB5ArrayGRP314vlmkit_2dsites4code4main7PalItemEE4None.prototype.$tag = 0;
  const _M0DTPC16option6OptionGRPB5ArrayGRP314vlmkit_2dsites4code4main7PalItemEE4None__ = new _M0DTPC16option6OptionGRPB5ArrayGRP314vlmkit_2dsites4code4main7PalItemEE4None();
  function _M0DTPC16option6OptionGRPB5ArrayGRP314vlmkit_2dsites4code4main7PalItemEE4Some(param0) {
    this._0 = param0;
  }
  _M0DTPC16option6OptionGRPB5ArrayGRP314vlmkit_2dsites4code4main7PalItemEE4Some.prototype.$tag = 1;
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
  function _M0TP36mizchi4luna3dom9ItemEntryGsE(param0, param1, param2, param3, param4) {
    this.item = param0;
    this.dom = param1;
    this.last = param2;
    this.nodes = param3;
    this.dispose = param4;
  }
  const _M0FP314vlmkit_2dsites4code4main10copy__text = (s) => { try { if (navigator.clipboard) navigator.clipboard.writeText(s).catch(() => {}); } catch (e) {} };
  const _M0FP314vlmkit_2dsites4code4main16set__class__attr = (e, v) => e.setAttribute("class", v);
  const _M0FP314vlmkit_2dsites4code4main5later = (ms, f) => { setTimeout(() => f(), ms); };
  const _M0FP314vlmkit_2dsites4code4main10set__value = (sel, v) => { const e = document.querySelector(sel); if (e) e.value = v; };
  function _M0TP314vlmkit_2dsites4code4main5Issue(param0, param1, param2, param3, param4, param5, param6, param7, param8, param9, param10) {
    this.num = param0;
    this.title = param1;
    this.open_ = param2;
    this.labels = param3;
    this.author = param4;
    this.ago = param5;
    this.comments = param6;
    this.milestone = param7;
    this.assignee = param8;
    this.project = param9;
    this.body = param10;
  }
  const _M0FP314vlmkit_2dsites4code4main9set__hash = (h) => { location.hash = h; };
  const _M0FP314vlmkit_2dsites4code4main7prevent = (e) => e.preventDefault();
  const _M0FP314vlmkit_2dsites4code4main10focus__sel = (sel) => { const e = document.querySelector(sel); if (e) e.focus(); };
  const _M0FP314vlmkit_2dsites4code4main9ev__value = (e) => (e.target && e.target.value) || "";
  const _M0FP314vlmkit_2dsites4code4main10get__value = (sel) => { const e = document.querySelector(sel); return (e && e.value) || ""; };
  const _M0FP314vlmkit_2dsites4code4main7ev__key = (e) => e.key || "";
  const _M0FP314vlmkit_2dsites4code4main9byte__len = (text) => new TextEncoder().encode(text).length;
  const _M0FP314vlmkit_2dsites4code4main9ev__shift = (e) => !!e.shiftKey;
  const _M0FP314vlmkit_2dsites4code4main13replace__hash = (h) => { try { history.replaceState(history.state, "", h); } catch (e) { location.hash = h; } };
  const _M0FP314vlmkit_2dsites4code4main9data__url = (text) => "data:text/plain;charset=utf-8," + encodeURIComponent(text);
  const _M0FP314vlmkit_2dsites4code4main10scroll__to = (sel) => { const e = document.querySelector(sel); if (e) e.scrollIntoView({ block: "center" }); };
  function _M0DTPC16option6OptionGRPB5ArrayGiEE4None() {}
  _M0DTPC16option6OptionGRPB5ArrayGiEE4None.prototype.$tag = 0;
  const _M0DTPC16option6OptionGRPB5ArrayGiEE4None__ = new _M0DTPC16option6OptionGRPB5ArrayGiEE4None();
  function _M0DTPC16option6OptionGRPB5ArrayGiEE4Some(param0) {
    this._0 = param0;
  }
  _M0DTPC16option6OptionGRPB5ArrayGiEE4Some.prototype.$tag = 1;
  const _M0FP314vlmkit_2dsites4code4main12close__modal = (id) => { const d = document.getElementById(id); if (d && d.open) d.close(); };
  const _M0FP314vlmkit_2dsites4code4main10target__is = (e, id) => !!(e.target && e.target.id === id);
  const _M0FP314vlmkit_2dsites4code4main11show__modal = (id) => { const d = document.getElementById(id); if (d && !d.open) d.showModal(); };
  function _M0TP314vlmkit_2dsites4code4main7PalItem(param0, param1, param2, param3, param4) {
    this.kind = param0;
    this.label = param1;
    this.hint = param2;
    this.href = param3;
    this.hits = param4;
  }
  const _M0FP314vlmkit_2dsites4code4main18scroll__into__list = (sel) => { const e = document.querySelector(sel); if (e) e.scrollIntoView({ block: "nearest" }); };
  const _M0FP314vlmkit_2dsites4code4main9get__hash = () => { const h = location.hash.slice(1); try { return decodeURIComponent(h); } catch (e) { return h; } };
  const _M0FP314vlmkit_2dsites4code4main10on__window = (name, f) => window.addEventListener(name, f);
  const _M0FP314vlmkit_2dsites4code4main7on__doc = (name, f) => document.addEventListener(name, f);
  const _M0FP314vlmkit_2dsites4code4main13search__param = (name) => { try { return new URLSearchParams(location.search).get(name) || ""; } catch (e) { return ""; } };
  const _M0FP314vlmkit_2dsites4code4main15set__root__attr = (name, v) => document.documentElement.setAttribute(name, v);
  const _M0FP314vlmkit_2dsites4code4main7closest = (e, sel) => { const path = e.composedPath ? e.composedPath() : [e.target]; return path.some((n) => n && n.matches && n.matches(sel)); };
  const _M0FP314vlmkit_2dsites4code4main16editable__target = (e) => { const t = e.target; if (!t || !t.tagName) return false; const n = t.tagName; return n === "INPUT" || n === "TEXTAREA" || n === "SELECT" || t.isContentEditable; };
  const _M0FP314vlmkit_2dsites4code4main17any__dialog__open = () => !!document.querySelector("dialog[open]");
  const _M0FP314vlmkit_2dsites4code4main7ev__mod = (e) => !!(e.ctrlKey || e.metaKey || e.altKey);
  const _M0FP314vlmkit_2dsites4code4main11scroll__top = () => window.scrollTo(0, 0);
  const _M0FP092moonbitlang_2fcore_2fbuiltin_2fStringBuilder_24as_24_40moonbitlang_2fcore_2fbuiltin_2eLogger = { method_0: _M0IPB13StringBuilderPB6Logger13write__string, method_1: _M0IP016_24default__implPB6Logger16write__substringGRPB13StringBuilderE, method_2: _M0IPB13StringBuilderPB6Logger11write__view, method_3: _M0IPB13StringBuilderPB6Logger11write__char, method_4: _M0IP016_24default__implPB6Logger28write__string__interpolationGRPB13StringBuilderE, method_5: _M0IP016_24default__implPB6Logger5writeGRPB13StringBuilderE };
  const _M0MPB4Iter4nextN6constrS89GRPC16string10StringViewE = 0;
  const _M0MPB4Iter4nextN6constrS90GRPC16string10StringViewE = 0;
  const _M0MPB4Iter4nextN6constrS97GcE = 0;
  const _M0MPB4Iter4nextN6constrS98GcE = 0;
  const _M0MPB4Iter3newN6constrS115GRPC16string10StringViewE = 0;
  const _M0MPB4Iter3newN6constrS121GcE = 0;
  const _M0FP26mizchi7signals17reactive__context = new _M0TP26mizchi7signals15ReactiveContext(undefined, _M0DTPC16option6OptionGRPB5ArrayGWEuEE4None__, 0);
  const _M0FP26mizchi7signals15callback__queue = [];
  const _M0FP26mizchi7signals22callback__queue__nodes = [];
  const _M0FP314vlmkit_2dsites4code4main7svg__ns = "http://www.w3.org/2000/svg";
  const _M0FP314vlmkit_2dsites4code4main12ts__keywords = ["import", "export", "from", "const", "let", "var", "function", "return", "if", "else", "for", "of", "in", "while", "async", "await", "type", "interface", "new", "throw", "true", "false", "null", "undefined", "class", "extends", "typeof", "as", "default", "continue", "break", "try", "catch", "number", "string", "boolean", "void", "unknown"];
  const _M0FP314vlmkit_2dsites4code4main12closed__ages = ["2 weeks ago", "3 weeks ago", "last month", "2 months ago", "3 months ago", "4 months ago", "5 months ago", "6 months ago", "8 months ago", "last year"];
  const _M0FP314vlmkit_2dsites4code4main14closed__titles = ["Stream pages to disk as they finish", "Incremental rebuild skips pages whose includes changed", "README example uses an old config key", "Feed dates are not RFC 3339", "CLI prints a stack trace for an unknown command", "Sitemap should skip noindex pages", "Drafts are built by default", "Watch mode leaks file handles", "Templates escape HTML twice in titles", "Add Node 24 to CI", "Docs: explain the page graph", "Heading anchors drop non-ASCII letters", "Config typo gives no suggestion", "Dev server port is not configurable", "Windows paths in the sitemap use backslashes", "Markdown tables lose alignment", "Build summary counts skipped pages as written", "Plugin errors do not name the plugin", "Example blog has a broken tag page", "Remove the deprecated --legacy flag", "Code blocks lose their language class", "Support .mdx files", "Release notes for 3.3.0", "Cache folder is created in the wrong place", "Footnote links point to the wrong page", "Upgrade to TypeScript 5.9", "Trailing slashes in baseUrl are doubled", "Dark theme code colours are unreadable", "Speed up the graph hash", "Feed plugin ignores the site title", "Lint the test folder too", "Getting-started guide skips npm init", "Empty content folder crashes the build", "Dev server serves stale 404 pages", "Add a CONTRIBUTING section", "Front matter with tabs fails to parse", "Images with spaces in names 404", "Watch mode on network drives", "Sort pages by date in the example blog", "Parallel render ignores --out", "Unify the log format"];
  const _M0FP314vlmkit_2dsites4code4main6labelsN6recordS2438 = new _M0TP314vlmkit_2dsites4code4main5Label("bug", "#d73a4a");
  const _M0FP314vlmkit_2dsites4code4main6labelsN6recordS2439 = new _M0TP314vlmkit_2dsites4code4main5Label("enhancement", "#a2eeef");
  const _M0FP314vlmkit_2dsites4code4main6labelsN6recordS2440 = new _M0TP314vlmkit_2dsites4code4main5Label("documentation", "#0075ca");
  const _M0FP314vlmkit_2dsites4code4main6labelsN6recordS2441 = new _M0TP314vlmkit_2dsites4code4main5Label("good first issue", "#7057ff");
  const _M0FP314vlmkit_2dsites4code4main6labelsN6recordS2442 = new _M0TP314vlmkit_2dsites4code4main5Label("help wanted", "#008672");
  const _M0FP314vlmkit_2dsites4code4main6labelsN6recordS2443 = new _M0TP314vlmkit_2dsites4code4main5Label("performance", "#fbca04");
  const _M0FP314vlmkit_2dsites4code4main6labelsN6recordS2444 = new _M0TP314vlmkit_2dsites4code4main5Label("plugins", "#f9d0c4");
  const _M0FP314vlmkit_2dsites4code4main6labelsN6recordS2445 = new _M0TP314vlmkit_2dsites4code4main5Label("windows", "#5319e7");
  const _M0FP314vlmkit_2dsites4code4main6labelsN6recordS2446 = new _M0TP314vlmkit_2dsites4code4main5Label("question", "#d876e3");
  const _M0FP314vlmkit_2dsites4code4main6labelsN6recordS2447 = new _M0TP314vlmkit_2dsites4code4main5Label("needs repro", "#e4e669");
  const _M0FP314vlmkit_2dsites4code4main6labels = [_M0FP314vlmkit_2dsites4code4main6labelsN6recordS2438, _M0FP314vlmkit_2dsites4code4main6labelsN6recordS2439, _M0FP314vlmkit_2dsites4code4main6labelsN6recordS2440, _M0FP314vlmkit_2dsites4code4main6labelsN6recordS2441, _M0FP314vlmkit_2dsites4code4main6labelsN6recordS2442, _M0FP314vlmkit_2dsites4code4main6labelsN6recordS2443, _M0FP314vlmkit_2dsites4code4main6labelsN6recordS2444, _M0FP314vlmkit_2dsites4code4main6labelsN6recordS2445, _M0FP314vlmkit_2dsites4code4main6labelsN6recordS2446, _M0FP314vlmkit_2dsites4code4main6labelsN6recordS2447];
  const _M0FP314vlmkit_2dsites4code4main10milestones = ["3.5.0", "4.0.0"];
  const _M0FP314vlmkit_2dsites4code4main12open__titles = [{ _0: "Watch mode misses files renamed by an editor's atomic save", _1: ["bug", "needs repro"], _2: "pia-lund", _3: "2 hours ago", _4: 4 }, { _0: "Feed plugin: let a page opt out with feed: false", _1: ["plugins", "enhancement"], _2: "sol-varga", _3: "5 hours ago", _4: 1 }, { _0: "Build fails on Windows when the content path has a space", _1: ["bug", "windows"], _2: "arjun-mehta", _3: "yesterday", _4: 7 }, { _0: "Document how baseUrl interacts with absolute links in Markdown", _1: ["documentation", "good first issue"], _2: "ines-duarte", _3: "yesterday", _4: 2 }, { _0: "Parallel render: cap the worker pool on machines with little memory", _1: ["performance"], _2: "theo-brandt", _3: "2 days ago", _4: 5 }, { _0: "Sitemap lists pages that a redirect replaced", _1: ["bug", "plugins"], _2: "kofi-mensah", _3: "2 days ago", _4: 0 }, { _0: "Support footnotes that span more than one paragraph", _1: ["enhancement"], _2: "lena-hoff", _3: "3 days ago", _4: 3 }, { _0: "Heading anchors collide when two headings have the same text", _1: ["bug", "good first issue"], _2: "maya-chen", _3: "3 days ago", _4: 6 }, { _0: "Expose the page graph to plugins as a read-only API", _1: ["plugins", "enhancement", "help wanted"], _2: "jun-arata", _3: "4 days ago", _4: 9 }, { _0: "Dev server does not reload CSS that a template imports", _1: ["bug"], _2: "rafael-souza", _3: "5 days ago", _4: 2 }, { _0: "How do I put drafts behind a preview URL?", _1: ["question"], _2: "noor-haddad", _3: "6 days ago", _4: 1 }, { _0: "Image pipeline: responsive sizes from a single source image", _1: ["enhancement", "help wanted"], _2: "mira-okafor", _3: "last week", _4: 12 }, { _0: "Front matter dates are read in the build machine's time zone", _1: ["bug"], _2: "sol-varga", _3: "last week", _4: 4 }, { _0: "Search index plugin", _1: ["plugins", "enhancement"], _2: "ines-duarte", _3: "last week", _4: 15 }, { _0: "Error message for a missing layout should name the page", _1: ["enhancement", "good first issue"], _2: "pia-lund", _3: "2 weeks ago", _4: 0 }, { _0: "Builds are slower with more than 5,000 pages in one folder", _1: ["performance", "needs repro"], _2: "arjun-mehta", _3: "2 weeks ago", _4: 8 }, { _0: "Add a --dry-run flag that prints what would be written", _1: ["enhancement"], _2: "kofi-mensah", _3: "2 weeks ago", _4: 3 }, { _0: "Templates cannot read the site's config from a partial", _1: ["bug"], _2: "lena-hoff", _3: "3 weeks ago", _4: 2 }, { _0: "Translate the getting-started guide", _1: ["documentation", "help wanted"], _2: "maya-chen", _3: "3 weeks ago", _4: 5 }, { _0: "Syntax highlighting has no colour for TOML keys", _1: ["plugins", "good first issue"], _2: "rafael-souza", _3: "last month", _4: 1 }, { _0: "Long code blocks overflow the page on phones in the default theme", _1: ["bug"], _2: "noor-haddad", _3: "last month", _4: 6 }, { _0: "Allow a content folder outside the project root", _1: ["enhancement", "question"], _2: "theo-brandt", _3: "last month", _4: 2 }, { _0: "Plugin hooks run twice after a config reload in dev", _1: ["bug", "plugins"], _2: "jun-arata", _3: "2 months ago", _4: 11 }];
  const _M0FP314vlmkit_2dsites4code4main6people = ["mira-okafor", "jun-arata", "sol-varga", "ines-duarte", "theo-brandt", "pia-lund", "arjun-mehta", "kofi-mensah", "lena-hoff", "maya-chen", "rafael-souza", "noor-haddad"];
  const _M0FP314vlmkit_2dsites4code4main8projects = ["Roadmap 2027", "Docs refresh"];
  const _M0FP314vlmkit_2dsites4code4main14avatar__colors = ["#1a5fb4", "#9a3412", "#166534", "#6d28d9", "#9d174d", "#0f766e", "#854d0e", "#374151"];
  const _M0FP314vlmkit_2dsites4code4main5pulls = [new _M0TP314vlmkit_2dsites4code4main4Pull(421, "graph: incremental rebuild of changed pages only", "jun-arata", "40 minutes ago", ["performance"], 3), new _M0TP314vlmkit_2dsites4code4main4Pull(420, "docs: a worked plugin from hook to test", "ines-duarte", "4 days ago", ["documentation"], 5), new _M0TP314vlmkit_2dsites4code4main4Pull(419, "feed: write dates in RFC 3339 with the site's zone", "sol-varga", "3 days ago", ["bug", "plugins"], 2), new _M0TP314vlmkit_2dsites4code4main4Pull(417, "chore(deps): bump the dev group with 4 updates", "tidebot", "5 days ago", [], 0)];
  const _M0FP314vlmkit_2dsites4code4main10main__head = new _M0TP314vlmkit_2dsites4code4main6Commit("mira-okafor", "render: stream pages to disk as they finish", 418, "8c41d2e", "2 hours ago");
  const _M0FP314vlmkit_2dsites4code4main10repo__name = "lantern";
  const _M0FP314vlmkit_2dsites4code4main4treeN6recordS2453 = new _M0TP314vlmkit_2dsites4code4main5Entry(".github", true, "ci: test on Node 22 and 24", 402, "3 weeks ago");
  const _M0FP314vlmkit_2dsites4code4main4treeN6recordS2454 = new _M0TP314vlmkit_2dsites4code4main5Entry(".github/workflows", true, "ci: test on Node 22 and 24", 402, "3 weeks ago");
  const _M0FP314vlmkit_2dsites4code4main4treeN6recordS2455 = new _M0TP314vlmkit_2dsites4code4main5Entry(".github/workflows/ci.yml", false, "ci: test on Node 22 and 24", 402, "3 weeks ago");
  const _M0FP314vlmkit_2dsites4code4main4treeN6recordS2456 = new _M0TP314vlmkit_2dsites4code4main5Entry(".github/ISSUE_TEMPLATE.md", false, "Ask for the config file in bug reports", 0, "8 months ago");
  const _M0FP314vlmkit_2dsites4code4main4treeN6recordS2457 = new _M0TP314vlmkit_2dsites4code4main5Entry("docs", true, "docs: a worked plugin from hook to test", 415, "4 days ago");
  const _M0FP314vlmkit_2dsites4code4main4treeN6recordS2458 = new _M0TP314vlmkit_2dsites4code4main5Entry("docs/getting-started.md", false, "docs: shorter first run", 390, "last month");
  const _M0FP314vlmkit_2dsites4code4main4treeN6recordS2459 = new _M0TP314vlmkit_2dsites4code4main5Entry("docs/configuration.md", false, "config: document every key with its default", 377, "2 months ago");
  const _M0FP314vlmkit_2dsites4code4main4treeN6recordS2460 = new _M0TP314vlmkit_2dsites4code4main5Entry("docs/plugins.md", false, "docs: a worked plugin from hook to test", 415, "4 days ago");
  const _M0FP314vlmkit_2dsites4code4main4treeN6recordS2461 = new _M0TP314vlmkit_2dsites4code4main5Entry("examples", true, "examples: a blog with tags and a feed", 366, "3 months ago");
  const _M0FP314vlmkit_2dsites4code4main4treeN6recordS2462 = new _M0TP314vlmkit_2dsites4code4main5Entry("examples/blog", true, "examples: a blog with tags and a feed", 366, "3 months ago");
  const _M0FP314vlmkit_2dsites4code4main4treeN6recordS2463 = new _M0TP314vlmkit_2dsites4code4main5Entry("examples/blog/lantern.config.ts", false, "examples: a blog with tags and a feed", 366, "3 months ago");
  const _M0FP314vlmkit_2dsites4code4main4treeN6recordS2464 = new _M0TP314vlmkit_2dsites4code4main5Entry("examples/blog/content", true, "examples: a blog with tags and a feed", 366, "3 months ago");
  const _M0FP314vlmkit_2dsites4code4main4treeN6recordS2465 = new _M0TP314vlmkit_2dsites4code4main5Entry("examples/blog/content/hello-world.md", false, "examples: a blog with tags and a feed", 366, "3 months ago");
  const _M0FP314vlmkit_2dsites4code4main4treeN6recordS2466 = new _M0TP314vlmkit_2dsites4code4main5Entry("src", true, "render: stream pages to disk as they finish", 418, "2 hours ago");
  const _M0FP314vlmkit_2dsites4code4main4treeN6recordS2467 = new _M0TP314vlmkit_2dsites4code4main5Entry("src/cli.ts", false, "cli: --watch rebuilds only what changed", 409, "2 weeks ago");
  const _M0FP314vlmkit_2dsites4code4main4treeN6recordS2468 = new _M0TP314vlmkit_2dsites4code4main5Entry("src/config.ts", false, "config: reject unknown keys with a suggestion", 384, "last month");
  const _M0FP314vlmkit_2dsites4code4main4treeN6recordS2469 = new _M0TP314vlmkit_2dsites4code4main5Entry("src/core", true, "graph: drop pages whose source was deleted", 411, "6 days ago");
  const _M0FP314vlmkit_2dsites4code4main4treeN6recordS2470 = new _M0TP314vlmkit_2dsites4code4main5Entry("src/core/build.ts", false, "render: stream pages to disk as they finish", 418, "2 hours ago");
  const _M0FP314vlmkit_2dsites4code4main4treeN6recordS2471 = new _M0TP314vlmkit_2dsites4code4main5Entry("src/core/graph.ts", false, "graph: drop pages whose source was deleted", 411, "6 days ago");
  const _M0FP314vlmkit_2dsites4code4main4treeN6recordS2472 = new _M0TP314vlmkit_2dsites4code4main5Entry("src/render", true, "render: stream pages to disk as they finish", 418, "2 hours ago");
  const _M0FP314vlmkit_2dsites4code4main4treeN6recordS2473 = new _M0TP314vlmkit_2dsites4code4main5Entry("src/render/markdown.ts", false, "markdown: footnotes and heading anchors", 399, "3 weeks ago");
  const _M0FP314vlmkit_2dsites4code4main4treeN6recordS2474 = new _M0TP314vlmkit_2dsites4code4main5Entry("src/render/templates.ts", false, "render: stream pages to disk as they finish", 418, "2 hours ago");
  const _M0FP314vlmkit_2dsites4code4main4treeN6recordS2475 = new _M0TP314vlmkit_2dsites4code4main5Entry("src/plugins", true, "feed: write dates in RFC 3339", 406, "2 weeks ago");
  const _M0FP314vlmkit_2dsites4code4main4treeN6recordS2476 = new _M0TP314vlmkit_2dsites4code4main5Entry("src/plugins/feed.ts", false, "feed: write dates in RFC 3339", 406, "2 weeks ago");
  const _M0FP314vlmkit_2dsites4code4main4treeN6recordS2477 = new _M0TP314vlmkit_2dsites4code4main5Entry("src/plugins/sitemap.ts", false, "sitemap: skip drafts and noindex pages", 352, "4 months ago");
  const _M0FP314vlmkit_2dsites4code4main4treeN6recordS2478 = new _M0TP314vlmkit_2dsites4code4main5Entry("src/plugins/syntax-highlight-with-line-numbers-and-theme-switching.ts", false, "highlight: themes switch with the page's colour scheme", 395, "3 weeks ago");
  const _M0FP314vlmkit_2dsites4code4main4treeN6recordS2479 = new _M0TP314vlmkit_2dsites4code4main5Entry("test", true, "test: cover the streaming writer", 418, "2 hours ago");
  const _M0FP314vlmkit_2dsites4code4main4treeN6recordS2480 = new _M0TP314vlmkit_2dsites4code4main5Entry("test/build.test.ts", false, "test: cover the streaming writer", 418, "2 hours ago");
  const _M0FP314vlmkit_2dsites4code4main4treeN6recordS2481 = new _M0TP314vlmkit_2dsites4code4main5Entry(".editorconfig", false, "Initial commit", 0, "4 years ago");
  const _M0FP314vlmkit_2dsites4code4main4treeN6recordS2482 = new _M0TP314vlmkit_2dsites4code4main5Entry(".gitignore", false, "Ignore the .lantern cache", 0, "2 years ago");
  const _M0FP314vlmkit_2dsites4code4main4treeN6recordS2483 = new _M0TP314vlmkit_2dsites4code4main5Entry("CHANGELOG.md", false, "Release 3.4.0", 0, "2 weeks ago");
  const _M0FP314vlmkit_2dsites4code4main4treeN6recordS2484 = new _M0TP314vlmkit_2dsites4code4main5Entry("LICENSE", false, "Initial commit", 0, "4 years ago");
  const _M0FP314vlmkit_2dsites4code4main4treeN6recordS2485 = new _M0TP314vlmkit_2dsites4code4main5Entry("README.md", false, "readme: the five-minute tour", 413, "5 days ago");
  const _M0FP314vlmkit_2dsites4code4main4treeN6recordS2486 = new _M0TP314vlmkit_2dsites4code4main5Entry("package.json", false, "Release 3.4.0", 0, "2 weeks ago");
  const _M0FP314vlmkit_2dsites4code4main4treeN6recordS2487 = new _M0TP314vlmkit_2dsites4code4main5Entry("tsconfig.json", false, "build: target ES2023", 361, "3 months ago");
  const _M0FP314vlmkit_2dsites4code4main4tree = [_M0FP314vlmkit_2dsites4code4main4treeN6recordS2453, _M0FP314vlmkit_2dsites4code4main4treeN6recordS2454, _M0FP314vlmkit_2dsites4code4main4treeN6recordS2455, _M0FP314vlmkit_2dsites4code4main4treeN6recordS2456, _M0FP314vlmkit_2dsites4code4main4treeN6recordS2457, _M0FP314vlmkit_2dsites4code4main4treeN6recordS2458, _M0FP314vlmkit_2dsites4code4main4treeN6recordS2459, _M0FP314vlmkit_2dsites4code4main4treeN6recordS2460, _M0FP314vlmkit_2dsites4code4main4treeN6recordS2461, _M0FP314vlmkit_2dsites4code4main4treeN6recordS2462, _M0FP314vlmkit_2dsites4code4main4treeN6recordS2463, _M0FP314vlmkit_2dsites4code4main4treeN6recordS2464, _M0FP314vlmkit_2dsites4code4main4treeN6recordS2465, _M0FP314vlmkit_2dsites4code4main4treeN6recordS2466, _M0FP314vlmkit_2dsites4code4main4treeN6recordS2467, _M0FP314vlmkit_2dsites4code4main4treeN6recordS2468, _M0FP314vlmkit_2dsites4code4main4treeN6recordS2469, _M0FP314vlmkit_2dsites4code4main4treeN6recordS2470, _M0FP314vlmkit_2dsites4code4main4treeN6recordS2471, _M0FP314vlmkit_2dsites4code4main4treeN6recordS2472, _M0FP314vlmkit_2dsites4code4main4treeN6recordS2473, _M0FP314vlmkit_2dsites4code4main4treeN6recordS2474, _M0FP314vlmkit_2dsites4code4main4treeN6recordS2475, _M0FP314vlmkit_2dsites4code4main4treeN6recordS2476, _M0FP314vlmkit_2dsites4code4main4treeN6recordS2477, _M0FP314vlmkit_2dsites4code4main4treeN6recordS2478, _M0FP314vlmkit_2dsites4code4main4treeN6recordS2479, _M0FP314vlmkit_2dsites4code4main4treeN6recordS2480, _M0FP314vlmkit_2dsites4code4main4treeN6recordS2481, _M0FP314vlmkit_2dsites4code4main4treeN6recordS2482, _M0FP314vlmkit_2dsites4code4main4treeN6recordS2483, _M0FP314vlmkit_2dsites4code4main4treeN6recordS2484, _M0FP314vlmkit_2dsites4code4main4treeN6recordS2485, _M0FP314vlmkit_2dsites4code4main4treeN6recordS2486, _M0FP314vlmkit_2dsites4code4main4treeN6recordS2487];
  const _M0FP314vlmkit_2dsites4code4main9build__ts = "// Build every page in the graph and stream it to disk.\nimport { mkdir, writeFile } from \"node:fs/promises\";\nimport { dirname, join } from \"node:path\";\nimport { loadGraph, type Page } from \"./graph\";\nimport { renderPage } from \"../render/templates\";\nimport type { Config } from \"../config\";\n\nexport interface BuildResult {\n  written: number;\n  skipped: number;\n  ms: number;\n}\n\n/* A page is rebuilt when its own hash or the hash of a page it\n   includes has changed since the last build. */\nexport function isStale(page: Page, previous: Map<string, string>): boolean {\n  const before = previous.get(page.id);\n  if (before === undefined) return true;\n  return before !== page.hash || page.includes.some((dep) => previous.get(dep) !== dep);\n}\n\nasync function writePage(out: string, page: Page, html: string): Promise<void> {\n  const file = join(out, page.route, \"index.html\");\n  await mkdir(dirname(file), { recursive: true });\n  await writeFile(file, html, \"utf8\");\n}\n\nexport async function build(config: Config, previous = new Map<string, string>()): Promise<BuildResult> {\n  const started = performance.now();\n  const graph = await loadGraph(config.content);\n  let written = 0;\n  let skipped = 0;\n  for (const page of graph.pages) {\n    if (!config.drafts && page.draft) continue;\n    if (!isStale(page, previous)) {\n      skipped += 1;\n      continue;\n    }\n    const html = await renderPage(page, config);\n    await writePage(config.out, page, html); // stream: write as soon as it is ready\n    written += 1;\n  }\n  return { written, skipped, ms: Math.round(performance.now() - started) };\n}\n\nexport function summary(result: BuildResult): string {\n  return `${result.written} written, ${result.skipped} unchanged in ${result.ms}ms`;\n}";
  const _M0FP314vlmkit_2dsites4code4main7ci__yml = "# Test every push and pull request on the supported Node versions.\nname: ci\non:\n  push:\n    branches: [main]\n  pull_request:\njobs:\n  test:\n    runs-on: ubuntu-latest\n    strategy:\n      matrix:\n        node: [22, 24]\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n        with:\n          node-version: ${{ matrix.node }}\n          cache: npm\n      - run: npm ci\n      - run: npm test\n      - run: npm run lint";
  const _M0FP314vlmkit_2dsites4code4main7cli__ts = "#!/usr/bin/env node\n// lantern <init|dev|build> [--watch] [--out dir]\nimport { build, summary } from \"./core/build\";\nimport { loadConfig } from \"./config\";\n\nconst HELP = \"usage: lantern <init|dev|build> [--watch] [--out dir]\";\n\nfunction flag(args: string[], name: string): boolean {\n  return args.includes(`--${name}`);\n}\n\nfunction option(args: string[], name: string): string | undefined {\n  const at = args.indexOf(`--${name}`);\n  return at === -1 ? undefined : args[at + 1];\n}\n\nexport async function main(args: string[]): Promise<number> {\n  const [command] = args;\n  if (!command || flag(args, \"help\")) {\n    console.log(HELP);\n    return command ? 0 : 2;\n  }\n  const config = await loadConfig(process.cwd(), { out: option(args, \"out\") });\n  if (command === \"build\") {\n    console.log(summary(await build(config)));\n    return 0;\n  }\n  if (command === \"dev\" || flag(args, \"watch\")) {\n    const { watch } = await import(\"./core/graph\");\n    await watch(config, (result) => console.log(summary(result)));\n    return 0;\n  }\n  console.error(`unknown command: ${command}`);\n  return 2;\n}\n\nmain(process.argv.slice(2)).then((code) => process.exit(code));";
  const _M0FP314vlmkit_2dsites4code4main10config__ts = "// Load lantern.config.ts and fill in the defaults.\nexport interface Config {\n  content: string;\n  out: string;\n  baseUrl: string;\n  drafts: boolean;\n}\n\nexport const DEFAULTS: Config = {\n  content: \"content\",\n  out: \"dist\",\n  baseUrl: \"/\",\n  drafts: false,\n};\n\nconst KEYS = Object.keys(DEFAULTS);\n\nfunction nearest(key: string): string | undefined {\n  return KEYS.find((known) => known.startsWith(key.slice(0, 3)));\n}\n\nexport function validate(user: Record<string, unknown>): void {\n  for (const key of Object.keys(user)) {\n    if (KEYS.includes(key)) continue;\n    const hint = nearest(key);\n    throw new Error(hint ? `unknown key \"${key}\": did you mean \"${hint}\"?` : `unknown key \"${key}\"`);\n  }\n}\n\nexport async function loadConfig(root: string, overrides: Partial<Config> = {}): Promise<Config> {\n  const mod = await import(`${root}/lantern.config.ts`).catch(() => ({ default: {} }));\n  validate(mod.default);\n  return { ...DEFAULTS, ...mod.default, ...overrides };\n}";
  const _M0FP314vlmkit_2dsites4code4main12markdown__ts = "// A small Markdown renderer: headings with anchors, lists, code and footnotes.\nimport { escapeHtml } from \"./templates\";\n\nconst HEADING = /^(#{1,6})\\s+(.*)$/;\n\nexport function slug(text: string): string {\n  return text.toLowerCase().replace(/[^a-z0-9]+/g, \"-\").replace(/^-|-$/g, \"\");\n}\n\nexport function renderHeading(line: string): string | null {\n  const match = HEADING.exec(line);\n  if (!match) return null;\n  const level = match[1].length;\n  const text = match[2];\n  return `<h${level} id=\"${slug(text)}\">${escapeHtml(text)}</h${level}>`;\n}\n\nexport function renderInline(text: string): string {\n  return escapeHtml(text)\n    .replace(/`([^`]+)`/g, \"<code>$1</code>\")\n    .replace(/\\*\\*([^*]+)\\*\\*/g, \"<strong>$1</strong>\")\n    .replace(/\\[\\^(\\d+)\\]/g, '<sup><a href=\"#fn-$1\">$1</a></sup>');\n}\n\nexport function renderMarkdown(source: string): string {\n  const out: string[] = [];\n  for (const line of source.split(\"\\n\")) {\n    const heading = renderHeading(line);\n    if (heading) {\n      out.push(heading);\n    } else if (line.startsWith(\"- \")) {\n      out.push(`<li>${renderInline(line.slice(2))}</li>`);\n    } else if (line.trim() !== \"\") {\n      out.push(`<p>${renderInline(line)}</p>`);\n    }\n  }\n  return out.join(\"\\n\");\n}";
  const _M0FP314vlmkit_2dsites4code4main13package__json = "{\n  \"name\": \"@tidewater/lantern\",\n  \"version\": \"3.4.0\",\n  \"description\": \"A static site generator that rebuilds only what changed\",\n  \"license\": \"MIT\",\n  \"type\": \"module\",\n  \"bin\": { \"lantern\": \"dist/cli.js\" },\n  \"engines\": { \"node\": \">=22\" },\n  \"scripts\": {\n    \"build\": \"tsc -p .\",\n    \"test\": \"node --test test/\",\n    \"lint\": \"eslint src test\"\n  },\n  \"devDependencies\": {\n    \"typescript\": \"^5.9.0\",\n    \"eslint\": \"^9.30.0\"\n  }\n}";
  const _M0FP314vlmkit_2dsites4code4main11readme__src = "# Lantern\n\n[![build: passing](badges/build.svg)](#) [![license: MIT](badges/license.svg)](#) [![version: 3.4.0](badges/version.svg)](#) [![coverage: 94%](badges/coverage.svg)](#)\n\nLantern turns a folder of Markdown into a fast static site. It builds a graph of your pages, rebuilds only what changed, and streams each page to disk as soon as it is ready.\n\n## Install\n\nLantern needs Node 22 or later.\n\n```sh\nnpm install --save-dev @tidewater/lantern\nnpx lantern init my-site\nnpx lantern dev\n```\n\n## Configuration\n\nPut a `lantern.config.ts` next to your content. Every key is optional.\n\n| Key | Default | What it does |\n|---|---|---|\n| `content` | `\"content\"` | Folder the pages are read from |\n| `out` | `\"dist\"` | Folder the site is written to |\n| `baseUrl` | `\"/\"` | Prefix for every link, for a site under a sub-path |\n| `drafts` | `false` | Build pages marked `draft: true` |\n\n## Roadmap\n\n- [x] Incremental rebuilds from the page graph\n- [x] Streaming writer\n- [ ] Image pipeline with responsive sizes\n- [ ] Search index plugin\n\n## Contributing\n\nRead **docs/plugins.md** before writing a plugin. Found a bug? Open a [New issue](#/issues/new) with your config and the command you ran.\n\n## License\n\nMIT. See `LICENSE`.";
  const _M0FP314vlmkit_2dsites4code4main12contributors = ["mira-okafor", "jun-arata", "sol-varga", "ines-duarte", "theo-brandt", "pia-lund", "arjun-mehta", "kofi-mensah", "lena-hoff", "maya-chen", "rafael-souza", "noor-haddad", "tidebot", "eve-larsen"];
  const _M0FP314vlmkit_2dsites4code4main9languagesN5tupleS2488 = { _0: "TypeScript", _1: 71.4, _2: "#3178c6" };
  const _M0FP314vlmkit_2dsites4code4main9languagesN5tupleS2489 = { _0: "CSS", _1: 12.8, _2: "#663399" };
  const _M0FP314vlmkit_2dsites4code4main9languagesN5tupleS2490 = { _0: "HTML", _1: 8.3, _2: "#e34c26" };
  const _M0FP314vlmkit_2dsites4code4main9languagesN5tupleS2491 = { _0: "JavaScript", _1: 5.1, _2: "#f1e05a" };
  const _M0FP314vlmkit_2dsites4code4main9languagesN5tupleS2492 = { _0: "Shell", _1: 2.4, _2: "#89e051" };
  const _M0FP314vlmkit_2dsites4code4main9languages = [_M0FP314vlmkit_2dsites4code4main9languagesN5tupleS2488, _M0FP314vlmkit_2dsites4code4main9languagesN5tupleS2489, _M0FP314vlmkit_2dsites4code4main9languagesN5tupleS2490, _M0FP314vlmkit_2dsites4code4main9languagesN5tupleS2491, _M0FP314vlmkit_2dsites4code4main9languagesN5tupleS2492];
  const _M0FP314vlmkit_2dsites4code4main6topics = ["static-site-generator", "markdown", "typescript", "incremental-build", "jamstack", "blog"];
  const _M0FP314vlmkit_2dsites4code4main10clone__cli = "fy repo clone tidewater/lantern";
  const _M0FP314vlmkit_2dsites4code4main12clone__https = "https://forgeyard.example/tidewater/lantern.git";
  const _M0FP314vlmkit_2dsites4code4main5owner = "tidewater";
  const _M0FP314vlmkit_2dsites4code4main14watch__optionsN5tupleS2518 = { _0: "Participating and @mentions", _1: "Only when you take part or are mentioned." };
  const _M0FP314vlmkit_2dsites4code4main14watch__optionsN5tupleS2519 = { _0: "All activity", _1: "Every issue, pull request and release." };
  const _M0FP314vlmkit_2dsites4code4main14watch__optionsN5tupleS2520 = { _0: "Ignore", _1: "Never, not even when mentioned." };
  const _M0FP314vlmkit_2dsites4code4main14watch__optionsN5tupleS2521 = { _0: "Custom", _1: "Pick the events: issues, pull requests, releases." };
  const _M0FP314vlmkit_2dsites4code4main14watch__options = [_M0FP314vlmkit_2dsites4code4main14watch__optionsN5tupleS2518, _M0FP314vlmkit_2dsites4code4main14watch__optionsN5tupleS2519, _M0FP314vlmkit_2dsites4code4main14watch__optionsN5tupleS2520, _M0FP314vlmkit_2dsites4code4main14watch__optionsN5tupleS2521];
  const _M0FP314vlmkit_2dsites4code4main10nav__menusN5tupleS2522 = { _0: "Repositories", _1: "Host code with history and review" };
  const _M0FP314vlmkit_2dsites4code4main10nav__menusN5tupleS2523 = { _0: "Pipelines", _1: "Build and test every push" };
  const _M0FP314vlmkit_2dsites4code4main10nav__menusN5tupleS2524 = { _0: "Packages", _1: "Publish to a private registry" };
  const _M0FP314vlmkit_2dsites4code4main10nav__menusN5tupleS2525 = { _0: "Documentation", _1: "Guides and the API reference" };
  const _M0FP314vlmkit_2dsites4code4main10nav__menusN5tupleS2526 = { _0: "Command line", _1: "The fy CLI" };
  const _M0FP314vlmkit_2dsites4code4main10nav__menusN5tupleS2527 = { _0: "Changelog", _1: "What shipped this month" };
  const _M0FP314vlmkit_2dsites4code4main10nav__menusN5tupleS2528 = { _0: "Small teams", _1: "Shared repositories and reviews" };
  const _M0FP314vlmkit_2dsites4code4main10nav__menusN5tupleS2529 = { _0: "Open source", _1: "Free for public projects" };
  const _M0FP314vlmkit_2dsites4code4main10nav__menusN5tupleS2530 = { _0: "Enterprise", _1: "Single sign-on and audit logs" };
  const _M0FP314vlmkit_2dsites4code4main10nav__menusN5tupleS2531 = { _0: "Learning paths", _1: "From first commit to release" };
  const _M0FP314vlmkit_2dsites4code4main10nav__menusN5tupleS2532 = { _0: "Customer stories", _1: "How teams ship with Forgeyard" };
  const _M0FP314vlmkit_2dsites4code4main10nav__menusN5tupleS2533 = { _0: "Status", _1: "Service health" };
  const _M0FP314vlmkit_2dsites4code4main10nav__menus = [{ _0: "Platform", _1: [_M0FP314vlmkit_2dsites4code4main10nav__menusN5tupleS2522, _M0FP314vlmkit_2dsites4code4main10nav__menusN5tupleS2523, _M0FP314vlmkit_2dsites4code4main10nav__menusN5tupleS2524] }, { _0: "Developers", _1: [_M0FP314vlmkit_2dsites4code4main10nav__menusN5tupleS2525, _M0FP314vlmkit_2dsites4code4main10nav__menusN5tupleS2526, _M0FP314vlmkit_2dsites4code4main10nav__menusN5tupleS2527] }, { _0: "Teams", _1: [_M0FP314vlmkit_2dsites4code4main10nav__menusN5tupleS2528, _M0FP314vlmkit_2dsites4code4main10nav__menusN5tupleS2529, _M0FP314vlmkit_2dsites4code4main10nav__menusN5tupleS2530] }, { _0: "Resources", _1: [_M0FP314vlmkit_2dsites4code4main10nav__menusN5tupleS2531, _M0FP314vlmkit_2dsites4code4main10nav__menusN5tupleS2532, _M0FP314vlmkit_2dsites4code4main10nav__menusN5tupleS2533] }];
  const _M0FP314vlmkit_2dsites4code4main5route = _M0FP26mizchi7signals6signalGsE("home:");
  const _M0FP26mizchi7signals11active__sub = _M0MPC13ref3Ref3RefGRPB5ArrayGRP36mizchi4luna3dom9ItemEntryGsEEE(undefined);
  const _M0FP26mizchi7signals5cycle = _M0MPC13ref3Ref3RefGiE(0);
  const _M0FP26mizchi7signals23core__current__cleanups = _M0MPC13ref3Ref3RefGORPB5ArrayGWEuEE(_M0DTPC16option6OptionGRPB5ArrayGWEuEE4None__);
  const _M0MPC16string10StringView4findN6constrS288 = 0;
  const _M0FP314vlmkit_2dsites4code4main12table__cellsN6recordS2597 = new _M0TPC16string10StringView(" ", 0, 1);
  const _M0FP314vlmkit_2dsites4code4main12table__cellsN6recordS2598 = new _M0TPC16string10StringView("|", 0, 1);
  const _M0FP314vlmkit_2dsites4code4main12table__cellsN6recordS2599 = new _M0TPC16string10StringView("|", 0, 1);
  const _M0FP314vlmkit_2dsites4code4main12table__cellsN6recordS2600 = new _M0TPC16string10StringView("|", 0, 1);
  const _M0FP314vlmkit_2dsites4code4main12table__cellsN6recordS2601 = new _M0TPC16string10StringView(" ", 0, 1);
  const _M0FP314vlmkit_2dsites4code4main5badgeN6recordS2564 = new _M0TPC16string10StringView(": ", 0, 2);
  const _M0FP314vlmkit_2dsites4code4main4slugN6recordS2543 = new _M0TPC16string10StringView("-", 0, 1);
  const _M0FP314vlmkit_2dsites4code4main6copied = _M0FP26mizchi7signals6signalGsE("");
  const _M0FP26mizchi7signals19effect__id__counter = _M0MPC13ref3Ref3RefGiE(0);
  const _M0FP26mizchi7signals12batch__depth = _M0MPC13ref3Ref3RefGiE(0);
  const _M0FP26mizchi7signals6queued = _M0MPC15array5Array4makeGORP26mizchi7signals10EffectNodeE(1024, undefined);
  const _M0FP26mizchi7signals13notify__index = _M0MPC13ref3Ref3RefGiE(0);
  const _M0FP26mizchi7signals14queued__length = _M0MPC13ref3Ref3RefGiE(0);
  const _M0FP314vlmkit_2dsites4code4main6tokensN6recordS2659 = new _M0TPC16string10StringView("#", 0, 1);
  const _M0FP314vlmkit_2dsites4code4main6tokensN6recordS2660 = new _M0TPC16string10StringView(" -", 0, 2);
  const _M0FP314vlmkit_2dsites4code4main15highlight__textN6recordS2686 = new _M0TPC16string10StringView("\n", 0, 1);
  const _M0FP314vlmkit_2dsites4code4main10md__blocksN6recordS2711 = new _M0TPC16string10StringView("\n", 0, 1);
  const _M0FP314vlmkit_2dsites4code4main10md__blocksN6recordS2712 = new _M0TPC16string10StringView(" ", 0, 1);
  const _M0FP314vlmkit_2dsites4code4main10md__blocksN6recordS2713 = new _M0TPC16string10StringView("```", 0, 3);
  const _M0FP314vlmkit_2dsites4code4main10md__blocksN6recordS2714 = new _M0TPC16string10StringView("```", 0, 3);
  const _M0FP314vlmkit_2dsites4code4main10md__blocksN6recordS2715 = new _M0TPC16string10StringView("\n", 0, 1);
  const _M0FP314vlmkit_2dsites4code4main10md__blocksN6recordS2716 = new _M0TPC16string10StringView("### ", 0, 4);
  const _M0FP314vlmkit_2dsites4code4main10md__blocksN6recordS2717 = new _M0TPC16string10StringView("## ", 0, 3);
  const _M0FP314vlmkit_2dsites4code4main10md__blocksN6recordS2718 = new _M0TPC16string10StringView("# ", 0, 2);
  const _M0FP314vlmkit_2dsites4code4main10md__blocksN6recordS2719 = new _M0TPC16string10StringView("|", 0, 1);
  const _M0FP314vlmkit_2dsites4code4main10md__blocksN6recordS2720 = new _M0TPC16string10StringView("|---", 0, 4);
  const _M0FP314vlmkit_2dsites4code4main10md__blocksN6recordS2721 = new _M0TPC16string10StringView("|", 0, 1);
  const _M0FP314vlmkit_2dsites4code4main10md__blocksN6recordS2722 = new _M0TPC16string10StringView("- ", 0, 2);
  const _M0FP314vlmkit_2dsites4code4main10md__blocksN6recordS2723 = new _M0TPC16string10StringView("- ", 0, 2);
  const _M0FP314vlmkit_2dsites4code4main10md__blocksN6recordS2724 = new _M0TPC16string10StringView("[", 0, 1);
  const _M0FP314vlmkit_2dsites4code4main10md__blocksN6recordS2725 = new _M0TPC16string10StringView("[x]", 0, 3);
  const _M0FP314vlmkit_2dsites4code4main10md__blocksN6recordS2726 = new _M0TPC16string10StringView(". ", 0, 2);
  const _M0FP314vlmkit_2dsites4code4main10md__blocksN6recordS2727 = new _M0TPC16string10StringView("> ", 0, 2);
  const _M0FP314vlmkit_2dsites4code4main10md__blocksN6recordS2728 = new _M0TPC16string10StringView(" ", 0, 1);
  const _M0FP314vlmkit_2dsites4code4main10md__blocksN6recordS2729 = new _M0TPC16string10StringView("[![", 0, 3);
  const _M0FP314vlmkit_2dsites4code4main6issues = _M0FP26mizchi7signals6signalGRPB5ArrayGRP314vlmkit_2dsites4code4main5IssueEE(_M0FP314vlmkit_2dsites4code4main12seed__issues());
  const _M0FP314vlmkit_2dsites4code4main6avatarN6recordS2882 = new _M0TPC16string10StringView("-", 0, 1);
  const _M0FP314vlmkit_2dsites4code4main6avatarN6recordS2883 = new _M0TPC16string10StringView("", 0, 0);
  const _M0FP314vlmkit_2dsites4code4main6avatarN6constrS2884 = 2;
  const _M0FP314vlmkit_2dsites4code4main6q__setN6recordS2792 = new _M0TPC16string10StringView(" ", 0, 1);
  const _M0FP314vlmkit_2dsites4code4main6q__setN6recordS2793 = new _M0TPC16string10StringView(" ", 0, 1);
  const _M0FP314vlmkit_2dsites4code4main2iq = _M0FP26mizchi7signals6signalGsE("is:issue is:open");
  const _M0FP314vlmkit_2dsites4code4main14tab__of__routeN6recordS2868 = new _M0TPC16string10StringView("home:", 0, 5);
  const _M0FP314vlmkit_2dsites4code4main14tab__of__routeN6recordS2869 = new _M0TPC16string10StringView("blob:", 0, 5);
  const _M0FP314vlmkit_2dsites4code4main14tab__of__routeN6recordS2870 = new _M0TPC16string10StringView("issue:", 0, 6);
  const _M0FP314vlmkit_2dsites4code4main8lang__ofN6recordS3018 = new _M0TPC16string10StringView(".ts", 0, 3);
  const _M0FP314vlmkit_2dsites4code4main8lang__ofN6recordS3019 = new _M0TPC16string10StringView(".js", 0, 3);
  const _M0FP314vlmkit_2dsites4code4main8lang__ofN6recordS3020 = new _M0TPC16string10StringView(".json", 0, 5);
  const _M0FP314vlmkit_2dsites4code4main8lang__ofN6recordS3021 = new _M0TPC16string10StringView(".yml", 0, 4);
  const _M0FP314vlmkit_2dsites4code4main8lang__ofN6recordS3022 = new _M0TPC16string10StringView(".yaml", 0, 5);
  const _M0FP314vlmkit_2dsites4code4main8lang__ofN6recordS3023 = new _M0TPC16string10StringView(".gitignore", 0, 10);
  const _M0FP314vlmkit_2dsites4code4main8lang__ofN6recordS3024 = new _M0TPC16string10StringView(".editorconfig", 0, 13);
  const _M0FP314vlmkit_2dsites4code4main8lang__ofN6recordS3025 = new _M0TPC16string10StringView(".md", 0, 3);
  const _M0FP314vlmkit_2dsites4code4main11symbols__ofN6recordS3101 = new _M0TPC16string10StringView("\n", 0, 1);
  const _M0FP314vlmkit_2dsites4code4main11symbols__ofN6recordS3102 = new _M0TPC16string10StringView("#", 0, 1);
  const _M0FP314vlmkit_2dsites4code4main11symbols__ofN6recordS3103 = new _M0TPC16string10StringView("# ", 0, 2);
  const _M0FP314vlmkit_2dsites4code4main11symbols__ofN6recordS3104 = new _M0TPC16string10StringView(":", 0, 1);
  const _M0FP314vlmkit_2dsites4code4main11symbols__ofN6recordS3105 = new _M0TPC16string10StringView("\" ", 0, 2);
  const _M0FP314vlmkit_2dsites4code4main11symbols__ofN6recordS3106 = new _M0TPC16string10StringView("  \"", 0, 3);
  const _M0FP314vlmkit_2dsites4code4main11symbols__ofN6recordS3107 = new _M0TPC16string10StringView(":", 0, 1);
  const _M0FP314vlmkit_2dsites4code4main11symbols__ofN6recordS3108 = new _M0TPC16string10StringView("\" ", 0, 2);
  const _M0FP314vlmkit_2dsites4code4main7sel__to = _M0FP26mizchi7signals6signalGiE(0);
  const _M0FP314vlmkit_2dsites4code4main9sel__from = _M0FP26mizchi7signals6signalGiE(0);
  const _M0FP314vlmkit_2dsites4code4main11sel__anchor = _M0MPC13ref3Ref3RefGiE(0);
  const _M0FP314vlmkit_2dsites4code4main11wrap__lines = _M0FP26mizchi7signals6signalGbE(false);
  const _M0FP314vlmkit_2dsites4code4main7dirnameN6recordS3088 = new _M0TPC16string10StringView("/", 0, 1);
  const _M0FP314vlmkit_2dsites4code4main8basenameN6recordS2997 = new _M0TPC16string10StringView("/", 0, 1);
  const _M0FP314vlmkit_2dsites4code4main10file__textN6recordS3093 = new _M0TPC16string10StringView(".md", 0, 3);
  const _M0FP314vlmkit_2dsites4code4main7tablistN6recordS2965 = new _M0TPC16string10StringView(" or ", 0, 4);
  const _M0FP314vlmkit_2dsites4code4main6crumbsN6recordS3072 = new _M0TPC16string10StringView("/", 0, 1);
  const _M0FP314vlmkit_2dsites4code4main9blob__raw = _M0FP26mizchi7signals6signalGbE(false);
  const _M0FP314vlmkit_2dsites4code4main14blame__commitsN6recordS2448 = new _M0TP314vlmkit_2dsites4code4main6Commit("jun-arata", "graph: drop pages whose source was deleted", 411, "3e9b0a4", "6 days ago");
  const _M0FP314vlmkit_2dsites4code4main14blame__commitsN6recordS2449 = new _M0TP314vlmkit_2dsites4code4main6Commit("sol-varga", "build: report unchanged pages separately", 388, "77c2d91", "last month");
  const _M0FP314vlmkit_2dsites4code4main14blame__commitsN6recordS2450 = new _M0TP314vlmkit_2dsites4code4main6Commit("theo-brandt", "render: write pages with a recursive mkdir", 342, "b1f05ee", "5 months ago");
  const _M0FP314vlmkit_2dsites4code4main14blame__commitsN6recordS2451 = new _M0TP314vlmkit_2dsites4code4main6Commit("mira-okafor", "Initial commit", 0, "0a1c3f2", "4 years ago");
  const _M0FP314vlmkit_2dsites4code4main14blame__commitsN6recordS2452 = new _M0TP314vlmkit_2dsites4code4main6Commit("ines-duarte", "Explain staleness in a comment", 297, "c44e8a0", "last year");
  const _M0FP314vlmkit_2dsites4code4main14blame__commits = [_M0FP314vlmkit_2dsites4code4main10main__head, _M0FP314vlmkit_2dsites4code4main14blame__commitsN6recordS2448, _M0FP314vlmkit_2dsites4code4main14blame__commitsN6recordS2449, _M0FP314vlmkit_2dsites4code4main14blame__commitsN6recordS2450, _M0FP314vlmkit_2dsites4code4main14blame__commitsN6recordS2451, _M0FP314vlmkit_2dsites4code4main14blame__commitsN6recordS2452];
  const _M0FP314vlmkit_2dsites4code4main11code__tableN6recordS3046 = new _M0TPC16string10StringView("\n", 0, 1);
  const _M0FP314vlmkit_2dsites4code4main9blob__tab = _M0FP26mizchi7signals6signalGsE("code");
  const _M0FP314vlmkit_2dsites4code4main10blob__viewN6recordS3138 = new _M0TPC16string10StringView("\n", 0, 1);
  const _M0FP314vlmkit_2dsites4code4main10blob__viewN6recordS3139 = new _M0TPC16string10StringView(" ", 0, 1);
  const _M0FP314vlmkit_2dsites4code4main10blob__viewN5tupleS3140 = { _0: "code", _1: "Code" };
  const _M0FP314vlmkit_2dsites4code4main10blob__viewN5tupleS3141 = { _0: "blame", _1: "Blame" };
  const _M0FP314vlmkit_2dsites4code4main9new__body = _M0FP26mizchi7signals6signalGsE("");
  const _M0FP314vlmkit_2dsites4code4main10new__title = _M0FP26mizchi7signals6signalGsE("");
  const _M0FP314vlmkit_2dsites4code4main10new__error = _M0FP26mizchi7signals6signalGbE(false);
  const _M0FP314vlmkit_2dsites4code4main8new__tab = _M0FP26mizchi7signals6signalGsE("write");
  const _M0FP314vlmkit_2dsites4code4main13submit__issueN6recordS2950 = new _M0TPC16string10StringView(" ", 0, 1);
  const _M0FP314vlmkit_2dsites4code4main16new__issue__viewN5tupleS2984 = { _0: "write", _1: "Write" };
  const _M0FP314vlmkit_2dsites4code4main16new__issue__viewN5tupleS2985 = { _0: "preview", _1: "Preview" };
  const _M0FP314vlmkit_2dsites4code4main16new__issue__viewN6recordS2986 = new _M0TPC16string10StringView(" \n", 0, 2);
  const _M0FP314vlmkit_2dsites4code4main5forks = _M0FP26mizchi7signals6signalGiE(312);
  const _M0FP314vlmkit_2dsites4code4main12fork__dialogN6constrS3306 = new _M0DTP36mizchi4luna3dom9AttrValue6Static("true");
  const _M0FP314vlmkit_2dsites4code4main12fork__dialogN5tupleS3307 = { _0: "checked", _1: _M0FP314vlmkit_2dsites4code4main12fork__dialogN6constrS3306 };
  const _M0FP314vlmkit_2dsites4code4main7starred = _M0FP26mizchi7signals6signalGbE(false);
  const _M0FP314vlmkit_2dsites4code4main10open__menu = _M0FP26mizchi7signals6signalGsE("");
  const _M0FP314vlmkit_2dsites4code4main11watch__mode = _M0FP26mizchi7signals6signalGsE("Participating and @mentions");
  const _M0FP314vlmkit_2dsites4code4main6q__getN6recordS2782 = new _M0TPC16string10StringView("\"", 0, 1);
  const _M0FP314vlmkit_2dsites4code4main6q__getN6recordS2783 = new _M0TPC16string10StringView("", 0, 0);
  const _M0FP314vlmkit_2dsites4code4main7q__textN6recordS2800 = new _M0TPC16string10StringView(":", 0, 1);
  const _M0FP314vlmkit_2dsites4code4main7q__textN6recordS2801 = new _M0TPC16string10StringView(" ", 0, 1);
  const _M0FP314vlmkit_2dsites4code4main11is__open__qN6recordS2848 = new _M0TPC16string10StringView("is:closed", 0, 9);
  const _M0FP314vlmkit_2dsites4code4main12issues__viewN5tupleS2926 = { _0: "3.5.0", _1: "3.5.0" };
  const _M0FP314vlmkit_2dsites4code4main12issues__viewN5tupleS2927 = { _0: "4.0.0", _1: "4.0.0" };
  const _M0FP314vlmkit_2dsites4code4main12issues__viewN5tupleS2928 = { _0: "3.4.0", _1: "3.4.0 (closed)" };
  const _M0FP314vlmkit_2dsites4code4main12issues__viewN5tupleS2929 = { _0: "created-desc", _1: "Newest" };
  const _M0FP314vlmkit_2dsites4code4main12issues__viewN5tupleS2930 = { _0: "created-asc", _1: "Oldest" };
  const _M0FP314vlmkit_2dsites4code4main12issues__viewN5tupleS2931 = { _0: "comments-desc", _1: "Most commented" };
  const _M0FP314vlmkit_2dsites4code4main12issues__viewN5tupleS2932 = { _0: "comments-asc", _1: "Least commented" };
  const _M0FP314vlmkit_2dsites4code4main11goto__query = _M0FP26mizchi7signals6signalGsE("");
  const _M0FP314vlmkit_2dsites4code4main6branch = _M0FP26mizchi7signals6signalGiE(0);
  const _M0FP314vlmkit_2dsites4code4main8branchesN6recordS2493 = new _M0TP314vlmkit_2dsites4code4main6Branch("main", false, _M0FP314vlmkit_2dsites4code4main10main__head);
  const _M0FP314vlmkit_2dsites4code4main8branchesN6recordS2494 = new _M0TP314vlmkit_2dsites4code4main6Commit("jun-arata", "graph: incremental rebuild of changed pages only", 421, "f02b9a7", "40 minutes ago");
  const _M0FP314vlmkit_2dsites4code4main8branchesN6recordS2495 = new _M0TP314vlmkit_2dsites4code4main6Branch("next", false, _M0FP314vlmkit_2dsites4code4main8branchesN6recordS2494);
  const _M0FP314vlmkit_2dsites4code4main8branchesN6recordS2496 = new _M0TP314vlmkit_2dsites4code4main6Commit("mira-okafor", "Release 3.4.0", 0, "1d7e330", "2 weeks ago");
  const _M0FP314vlmkit_2dsites4code4main8branchesN6recordS2497 = new _M0TP314vlmkit_2dsites4code4main6Branch("release/3.x", false, _M0FP314vlmkit_2dsites4code4main8branchesN6recordS2496);
  const _M0FP314vlmkit_2dsites4code4main8branchesN6recordS2498 = new _M0TP314vlmkit_2dsites4code4main6Commit("jun-arata", "graph: hash front matter separately from the body", 0, "a93c0f1", "yesterday");
  const _M0FP314vlmkit_2dsites4code4main8branchesN6recordS2499 = new _M0TP314vlmkit_2dsites4code4main6Branch("feat/incremental-graph", false, _M0FP314vlmkit_2dsites4code4main8branchesN6recordS2498);
  const _M0FP314vlmkit_2dsites4code4main8branchesN6recordS2500 = new _M0TP314vlmkit_2dsites4code4main6Commit("sol-varga", "feed: write dates in RFC 3339 with the site's zone", 0, "5be4417", "3 days ago");
  const _M0FP314vlmkit_2dsites4code4main8branchesN6recordS2501 = new _M0TP314vlmkit_2dsites4code4main6Branch("fix/feed-dates", false, _M0FP314vlmkit_2dsites4code4main8branchesN6recordS2500);
  const _M0FP314vlmkit_2dsites4code4main8branchesN6recordS2502 = new _M0TP314vlmkit_2dsites4code4main6Commit("ines-duarte", "docs: a worked plugin from hook to test", 0, "c6610d8", "4 days ago");
  const _M0FP314vlmkit_2dsites4code4main8branchesN6recordS2503 = new _M0TP314vlmkit_2dsites4code4main6Branch("docs/plugin-guide", false, _M0FP314vlmkit_2dsites4code4main8branchesN6recordS2502);
  const _M0FP314vlmkit_2dsites4code4main8branchesN6recordS2504 = new _M0TP314vlmkit_2dsites4code4main6Commit("tidebot", "chore(deps): bump the dev group with 4 updates", 0, "07f9e2c", "5 days ago");
  const _M0FP314vlmkit_2dsites4code4main8branchesN6recordS2505 = new _M0TP314vlmkit_2dsites4code4main6Branch("chore/deps-2026-11", false, _M0FP314vlmkit_2dsites4code4main8branchesN6recordS2504);
  const _M0FP314vlmkit_2dsites4code4main8branchesN6recordS2506 = new _M0TP314vlmkit_2dsites4code4main6Commit("theo-brandt", "render: a worker pool sized to the machine", 0, "e4a1b56", "last week");
  const _M0FP314vlmkit_2dsites4code4main8branchesN6recordS2507 = new _M0TP314vlmkit_2dsites4code4main6Branch("perf/parallel-render", false, _M0FP314vlmkit_2dsites4code4main8branchesN6recordS2506);
  const _M0FP314vlmkit_2dsites4code4main8branchesN6recordS2508 = new _M0TP314vlmkit_2dsites4code4main6Commit("mira-okafor", "Release 3.4.0", 0, "1d7e330", "2 weeks ago");
  const _M0FP314vlmkit_2dsites4code4main8branchesN6recordS2509 = new _M0TP314vlmkit_2dsites4code4main6Branch("v3.4.0", true, _M0FP314vlmkit_2dsites4code4main8branchesN6recordS2508);
  const _M0FP314vlmkit_2dsites4code4main8branchesN6recordS2510 = new _M0TP314vlmkit_2dsites4code4main6Commit("sol-varga", "Release 3.3.2", 0, "9a2f61b", "last month");
  const _M0FP314vlmkit_2dsites4code4main8branchesN6recordS2511 = new _M0TP314vlmkit_2dsites4code4main6Branch("v3.3.2", true, _M0FP314vlmkit_2dsites4code4main8branchesN6recordS2510);
  const _M0FP314vlmkit_2dsites4code4main8branchesN6recordS2512 = new _M0TP314vlmkit_2dsites4code4main6Commit("sol-varga", "Release 3.3.1", 0, "34cc0e8", "2 months ago");
  const _M0FP314vlmkit_2dsites4code4main8branchesN6recordS2513 = new _M0TP314vlmkit_2dsites4code4main6Branch("v3.3.1", true, _M0FP314vlmkit_2dsites4code4main8branchesN6recordS2512);
  const _M0FP314vlmkit_2dsites4code4main8branchesN6recordS2514 = new _M0TP314vlmkit_2dsites4code4main6Commit("mira-okafor", "Release 3.3.0", 0, "b8e7d12", "3 months ago");
  const _M0FP314vlmkit_2dsites4code4main8branchesN6recordS2515 = new _M0TP314vlmkit_2dsites4code4main6Branch("v3.3.0", true, _M0FP314vlmkit_2dsites4code4main8branchesN6recordS2514);
  const _M0FP314vlmkit_2dsites4code4main8branchesN6recordS2516 = new _M0TP314vlmkit_2dsites4code4main6Commit("jun-arata", "Release 3.2.0", 0, "60fa4c9", "5 months ago");
  const _M0FP314vlmkit_2dsites4code4main8branchesN6recordS2517 = new _M0TP314vlmkit_2dsites4code4main6Branch("v3.2.0", true, _M0FP314vlmkit_2dsites4code4main8branchesN6recordS2516);
  const _M0FP314vlmkit_2dsites4code4main8branches = [_M0FP314vlmkit_2dsites4code4main8branchesN6recordS2493, _M0FP314vlmkit_2dsites4code4main8branchesN6recordS2495, _M0FP314vlmkit_2dsites4code4main8branchesN6recordS2497, _M0FP314vlmkit_2dsites4code4main8branchesN6recordS2499, _M0FP314vlmkit_2dsites4code4main8branchesN6recordS2501, _M0FP314vlmkit_2dsites4code4main8branchesN6recordS2503, _M0FP314vlmkit_2dsites4code4main8branchesN6recordS2505, _M0FP314vlmkit_2dsites4code4main8branchesN6recordS2507, _M0FP314vlmkit_2dsites4code4main8branchesN6recordS2509, _M0FP314vlmkit_2dsites4code4main8branchesN6recordS2511, _M0FP314vlmkit_2dsites4code4main8branchesN6recordS2513, _M0FP314vlmkit_2dsites4code4main8branchesN6recordS2515, _M0FP314vlmkit_2dsites4code4main8branchesN6recordS2517];
  const _M0FP314vlmkit_2dsites4code4main12md__headingsN6recordS2606 = new _M0TPC16string10StringView("\n", 0, 1);
  const _M0FP314vlmkit_2dsites4code4main12md__headingsN6recordS2607 = new _M0TPC16string10StringView("```", 0, 3);
  const _M0FP314vlmkit_2dsites4code4main12md__headingsN6recordS2608 = new _M0TPC16string10StringView("### ", 0, 4);
  const _M0FP314vlmkit_2dsites4code4main12md__headingsN6recordS2609 = new _M0TPC16string10StringView("## ", 0, 3);
  const _M0FP314vlmkit_2dsites4code4main12md__headingsN6recordS2610 = new _M0TPC16string10StringView("# ", 0, 2);
  const _M0FP314vlmkit_2dsites4code4main5aboutN6recordS3165 = new _M0TPC16string10StringView(", ", 0, 2);
  const _M0FP314vlmkit_2dsites4code4main11branch__tab = _M0FP26mizchi7signals6signalGsE("branches");
  const _M0FP314vlmkit_2dsites4code4main14branch__filter = _M0FP26mizchi7signals6signalGsE("");
  const _M0FP314vlmkit_2dsites4code4main15branch__popoverN5tupleS3258 = { _0: "branches", _1: "Branches" };
  const _M0FP314vlmkit_2dsites4code4main15branch__popoverN5tupleS3259 = { _0: "tags", _1: "Tags" };
  const _M0FP314vlmkit_2dsites4code4main10clone__tab = _M0FP26mizchi7signals6signalGsE("https");
  const _M0FP314vlmkit_2dsites4code4main10code__menuN5tupleS3280 = { _0: "https", _1: "HTTPS" };
  const _M0FP314vlmkit_2dsites4code4main10code__menuN5tupleS3281 = { _0: "cli", _1: "CLI" };
  const _M0FP314vlmkit_2dsites4code4main9app__mainN6recordS3321 = new _M0TPC16string10StringView("home:", 0, 5);
  const _M0FP314vlmkit_2dsites4code4main9app__mainN6recordS3322 = new _M0TPC16string10StringView("blob:", 0, 5);
  const _M0FP314vlmkit_2dsites4code4main9app__mainN6recordS3323 = new _M0TPC16string10StringView("issue:", 0, 6);
  const _M0FP314vlmkit_2dsites4code4main10pal__query = _M0FP26mizchi7signals6signalGsE("");
  const _M0FP314vlmkit_2dsites4code4main11pal__active = _M0FP26mizchi7signals6signalGiE(0);
  const _M0FP314vlmkit_2dsites4code4main10pal__itemsN6recordS3333 = new _M0TPC16string10StringView(" ", 0, 1);
  const _M0FP314vlmkit_2dsites4code4main10pal__itemsN6recordS3334 = new _M0TPC16string10StringView("#", 0, 1);
  const _M0FP314vlmkit_2dsites4code4main11mobile__nav = _M0FP26mizchi7signals6signalGbE(false);
  const _M0FP314vlmkit_2dsites4code4main11apply__hashN6recordS3378 = new _M0TPC16string10StringView("/blob/", 0, 6);
  const _M0FP314vlmkit_2dsites4code4main11apply__hashN6recordS3379 = new _M0TPC16string10StringView("#L", 0, 2);
  const _M0FP314vlmkit_2dsites4code4main11apply__hashN6recordS3380 = new _M0TPC16string10StringView("-L", 0, 2);
  const _M0FP314vlmkit_2dsites4code4main11apply__hashN6recordS3381 = new _M0TPC16string10StringView("/tree/", 0, 6);
  const _M0FP314vlmkit_2dsites4code4main11apply__hashN6recordS3382 = new _M0TPC16string10StringView("/issues/", 0, 8);
  function _M0MPC16string10StringView12unsafe__view(self, start, end) {
    return new _M0TPC16string10StringView(self.str, self.start + start | 0, self.start + end | 0);
  }
  function _M0MPC15array10FixedArray12unsafe__blitGRPB17UnsafeMaybeUninitGRP36mizchi4luna3dom7DomNodeEE(dst, dst_offset, src, src_offset, len) {
    if (dst === src && dst_offset < src_offset) {
      let _tmp = 0;
      while (true) {
        const i = _tmp;
        if (i < len) {
          const _tmp$2 = dst_offset + i | 0;
          const _tmp$3 = src_offset + i | 0;
          if (_tmp$2 >>> 0 < dst.length) {
            dst[_tmp$2] = _tmp$3 >>> 0 < src.length ? src[_tmp$3] : $oob();
          } else {
            $oob();
          }
          _tmp = i + 1 | 0;
          continue;
        } else {
          return;
        }
      }
    } else {
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
  }
  function _M0MPB18UninitializedArray12unsafe__blitGRP36mizchi4luna3dom7DomNodeE(dst, dst_offset, src, src_offset, len) {
    _M0MPC15array10FixedArray12unsafe__blitGRPB17UnsafeMaybeUninitGRP36mizchi4luna3dom7DomNodeEE(dst, dst_offset, src, src_offset, len);
  }
  function _M0MPB13StringBuilder13write__objectGiE(self, obj) {
    _M0IP016_24default__implPB4Show6outputGiE(obj, { self: self, method_table: _M0FP092moonbitlang_2fcore_2fbuiltin_2fStringBuilder_24as_24_40moonbitlang_2fcore_2fbuiltin_2eLogger });
  }
  function _M0MPB13StringBuilder13write__objectGsE(self, obj) {
    _M0IP016_24default__implPB4Show6outputGsE(obj, { self: self, method_table: _M0FP092moonbitlang_2fcore_2fbuiltin_2fStringBuilder_24as_24_40moonbitlang_2fcore_2fbuiltin_2eLogger });
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
  function _M0IP016_24default__implPB4Show6outputGsE(self, logger) {
    logger.method_table.method_0(logger.self, self);
  }
  function _M0IP016_24default__implPB4Show6outputGdE(self, logger) {
    logger.method_table.method_0(logger.self, _M0IPC16double6DoublePB4Show10to__string(self));
  }
  function _M0MPB4Iter4nextGRPC16string10StringViewE(self) {
    const _func = self.f;
    const result = _func();
    const _bind = self.size_hint;
    if (result === undefined) {
      self.size_hint = _M0MPB4Iter4nextN6constrS90GRPC16string10StringViewE;
    } else {
      if (_bind === undefined) {
      } else {
        const _Some = _bind;
        const _n = _Some;
        self.size_hint = _n > 0 ? _n - 1 | 0 : _M0MPB4Iter4nextN6constrS89GRPC16string10StringViewE;
      }
    }
    return result;
  }
  function _M0MPB4Iter4nextGcE(self) {
    const _func = self.f;
    const result = _func();
    const _bind = self.size_hint;
    if (result === -1) {
      self.size_hint = _M0MPB4Iter4nextN6constrS98GcE;
    } else {
      if (_bind === undefined) {
      } else {
        const _Some = _bind;
        const _n = _Some;
        self.size_hint = _n > 0 ? _n - 1 | 0 : _M0MPB4Iter4nextN6constrS97GcE;
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
      size_hint$2 = _n > 0 ? _n : _M0MPB4Iter3newN6constrS115GRPC16string10StringViewE;
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
      size_hint$2 = _n > 0 ? _n : _M0MPB4Iter3newN6constrS121GcE;
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
  function _M0MPC16string6String11from__array(chars) {
    const buf = _M0MPB13StringBuilder21StringBuilder_2einner(Math.imul(chars.end - chars.start | 0, 4) | 0);
    const _bind = chars.end - chars.start | 0;
    let _tmp = 0;
    while (true) {
      const _ = _tmp;
      if (_ < _bind) {
        const c = chars.buf[chars.start + _ | 0];
        _M0IPB13StringBuilderPB6Logger11write__char(buf, c);
        _tmp = _ + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return buf.val;
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
  function _M0FPB20unsafe__make__string(_tmp, _tmp$2) {
    return $unsafe_make_string(_tmp, _tmp$2);
  }
  function _M0MPC16string6String4make(length, value) {
    if (length >= 0) {
      if (value <= 65535) {
        return _M0FPB20unsafe__make__string(length, value);
      } else {
        const buf = _M0MPB13StringBuilder21StringBuilder_2einner(Math.imul(2, length) | 0);
        let _tmp = 0;
        while (true) {
          const _ = _tmp;
          if (_ < length) {
            _M0IPB13StringBuilderPB6Logger11write__char(buf, value);
            _tmp = _ + 1 | 0;
            continue;
          } else {
            break;
          }
        }
        return buf.val;
      }
    } else {
      console.error("invalid length");
      return $panic();
    }
  }
  function _M0MPB13StringBuilder11write__iter(self, iter) {
    while (true) {
      const _bind = _M0MPB4Iter4nextGcE(iter);
      if (_bind === -1) {
        return;
      } else {
        const _Some = _bind;
        const _ch = _Some;
        _M0IPB13StringBuilderPB6Logger11write__char(self, _ch);
        continue;
      }
    }
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
        return _M0MPC16string10StringView4findN6constrS288;
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
  function _M0MPC15array5Array4pushGUssEE(self, value) {
    _M0MPB7JSArray4push(self, value);
  }
  function _M0MPC15array5Array4pushGcE(self, value) {
    _M0MPB7JSArray4push(self, value);
  }
  function _M0MPC15array5Array4pushGiE(self, value) {
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
  function _M0MPC16string10StringView19trim__start_2einner(self, chars) {
    const _bind = _M0FPB23build__ascii__char__set(chars);
    if (_bind === undefined) {
      return _M0MPC16string10StringView24trim__start__with__chars(self, chars);
    } else {
      const _Some = _bind;
      const _x = _Some;
      const _bits0 = _x._0;
      const _bits1 = _x._1;
      const _bits2 = _x._2;
      const _bits3 = _x._3;
      const start = _M0FPB26string__trim__start__ascii(self.str, self.start, self.end, chars, _bits0, _bits1, _bits2, _bits3);
      return new _M0TPC16string10StringView(self.str, start, self.end);
    }
  }
  function _M0MPC16string6String19trim__start_2einner(self, chars) {
    return _M0MPC16string10StringView19trim__start_2einner(new _M0TPC16string10StringView(self, 0, self.length), chars);
  }
  function _M0MPC16string6String12trim_2einner(self, chars) {
    return _M0MPC16string10StringView12trim_2einner(new _M0TPC16string10StringView(self, 0, self.length), chars);
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
  function _M0MPC16string6String10pad__start(self, total_width, padding_char) {
    const len = self.length;
    if (len < total_width) {
      const padding = _M0MPC16string6String4make(total_width - len | 0, padding_char);
      const _self = _M0MPB13StringBuilder21StringBuilder_2einner(8);
      _M0MPB13StringBuilder11write__iter(_self, _M0MPC16string6String4iter(padding));
      _M0MPB13StringBuilder11write__iter(_self, _M0MPC16string6String4iter(self));
      const _p = _self;
      return _p.val;
    } else {
      return self;
    }
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
  function _M0MPC16string10StringView11split__once(self, needle) {
    const _bind = _M0MPC16string10StringView4find(self, needle);
    if (_bind === undefined) {
      return undefined;
    } else {
      const _Some = _bind;
      const _index = _Some;
      return { _0: _M0MPC16string10StringView12unsafe__view(self, 0, _index), _1: _M0MPC16string10StringView12unsafe__view(self, _index + (needle.end - needle.start | 0) | 0, self.end - self.start | 0) };
    }
  }
  function _M0MPC16string6String11split__once(self, needle) {
    return _M0MPC16string10StringView11split__once(new _M0TPC16string10StringView(self, 0, self.length), needle);
  }
  function _M0MPB4Iter9to__arrayGRPC16string10StringViewE(self) {
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
        _M0MPC15array5Array4pushGUssEE(result, _x);
        continue;
      }
    }
    return result;
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
  function _M0MPC16string6String12replace__all(self, old, new_) {
    const len = self.length;
    const buf = _M0MPB13StringBuilder21StringBuilder_2einner(len);
    const old_len = old.end - old.start | 0;
    const new$2 = _M0MPC16string10StringView9to__owned(new_);
    if (old_len === 0) {
      _M0IPB13StringBuilderPB6Logger13write__string(buf, new$2);
      const _bind = self.length;
      let _tmp = 0;
      while (true) {
        const _string_index = _tmp;
        if (_string_index < _bind) {
          let _decoded_next_string_index;
          let _decoded_char;
          _L: {
            const _bind$2 = self.charCodeAt(_string_index);
            if (_bind$2 >= 55296 && _bind$2 <= 56319 && (_string_index + 1 | 0) < _bind) {
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
          _M0IPB13StringBuilderPB6Logger11write__char(buf, _decoded_char);
          _M0IPB13StringBuilderPB6Logger13write__string(buf, new$2);
          _tmp = _decoded_next_string_index;
          continue;
        } else {
          break;
        }
      }
      return buf.val;
    } else {
      const first_end = _M0MPC16string6String4find(self, old);
      if (first_end === undefined) {
        return self;
      } else {
        const _Some = first_end;
        const _end = _Some;
        let _tmp = new _M0TPC16string10StringView(self, 0, self.length);
        let _tmp$2 = _end;
        while (true) {
          const view = _tmp;
          const end = _tmp$2;
          const seg = _M0MPC16string10StringView12unsafe__view(view, 0, end);
          _M0IP016_24default__implPB6Logger16write__substringGRPB13StringBuilderE(buf, seg.str, seg.start, seg.end - seg.start | 0);
          _M0IPB13StringBuilderPB6Logger13write__string(buf, new$2);
          if ((end + old_len | 0) <= len) {
            const next_view = _M0MPC16string10StringView12unsafe__view(view, end + old_len | 0, view.end - view.start | 0);
            const _bind = _M0MPC16string10StringView4find(next_view, old);
            if (_bind === undefined) {
              _M0IP016_24default__implPB6Logger16write__substringGRPB13StringBuilderE(buf, next_view.str, next_view.start, next_view.end - next_view.start | 0);
              break;
            } else {
              const _Some$2 = _bind;
              const _next_end = _Some$2;
              _tmp = next_view;
              _tmp$2 = _next_end;
              continue;
            }
          } else {
            break;
          }
        }
        return buf.val;
      }
    }
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
  function _M0MPC14char4Char20is__ascii__lowercase(self) {
    return self >= 97 && self <= 122;
  }
  function _M0MPC16string6String9to__upper(self) {
    const _bind = _M0MPC16string6String8find__by(self, (c) => _M0MPC14char4Char20is__ascii__lowercase(c));
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
          if (_M0MPC14char4Char20is__ascii__lowercase(_decoded_char)) {
            _M0IPB13StringBuilderPB6Logger11write__char(buf, _decoded_char - 32 | 0);
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
  function _M0MPC16string6String9get__char(self, idx) {
    if (idx >= 0 && idx < self.length) {
      const c = self.charCodeAt(idx);
      if (c >= 55296 && c <= 56319) {
        if ((idx + 1 | 0) < self.length) {
          const next = self.charCodeAt(idx + 1 | 0);
          return next >= 56320 && next <= 57343 ? _M0FPB32code__point__of__surrogate__pair(c, next) : -1;
        } else {
          return -1;
        }
      } else {
        return c >= 56320 && c <= 57343 ? -1 : c;
      }
    } else {
      return -1;
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
  function _M0IPC16string6StringPB7Compare7compare(self, other) {
    const len = self.length;
    const _bind = $compare_int(len, other.length);
    if (_bind === 0) {
      let _tmp = 0;
      while (true) {
        const i = _tmp;
        if (i < len) {
          const x = self.charCodeAt(i);
          const y = other.charCodeAt(i);
          if (x !== y) {
            return x < y ? -1 : 1;
          }
          _tmp = i + 1 | 0;
          continue;
        } else {
          break;
        }
      }
      return 0;
    } else {
      return _bind;
    }
  }
  function _M0IPC13int3IntPB4Show10to__string(self) {
    return _M0MPC13int3Int18to__string_2einner(self, 10);
  }
  function _M0MPC15array9ArrayView6searchGsE(self, value) {
    const _bind = self.end - self.start | 0;
    let _tmp = 0;
    while (true) {
      const i = _tmp;
      if (i < _bind) {
        const x = self.buf[self.start + i | 0];
        if (x === value) {
          return i;
        }
        _tmp = i + 1 | 0;
        continue;
      } else {
        return undefined;
      }
    }
  }
  function _M0MPC15array9ArrayView4joinGsE(self, separator) {
    return _M0FPB19join__string__viewsGsE(self, separator);
  }
  function _M0MPC15array5Array31unsafe__make__and__blit_2einnerGRP36mizchi4luna3dom7DomNodeE(src, allocate_len, len, src_offset, dst_offset) {
    const dst = new Array(allocate_len);
    _M0MPB18UninitializedArray12unsafe__blitGRP36mizchi4luna3dom7DomNodeE(dst, dst_offset, src, src_offset, len);
    return dst;
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
  function _M0MPC16double6Double3pow(_tmp, _tmp$2) {
    return Math.pow(_tmp, _tmp$2);
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
  function _M0MPC14char4Char21is__ascii__alphabetic(self) {
    return self >= 65 && self <= 90 ? true : self >= 97 && self <= 122;
  }
  function _M0MPC14char4Char16is__ascii__digit(self) {
    return self >= 48 && self <= 57;
  }
  function _M0MPC15array5Array44unsafe__make__and__blit__from__fixed_2einnerGRP26mizchi8js__core3AnyE(src, allocate_len, len, src_offset, dst_offset) {
    const dst = new Array(allocate_len);
    _M0MPB18UninitializedArray19unsafe__blit__fixedGRP26mizchi8js__core3AnyE(dst, dst_offset, src, src_offset, len);
    return dst;
  }
  function _M0MPC15array5Array21clamped__view_2einnerGcE(self, start, end) {
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
    return new _M0TPB9ArrayViewGcE(self, lo, hi$2);
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
  function _M0MPC15array12MutArrayView4swapGUsRPB5ArrayGiEEE(arr, i, j) {
    const temp = arr.buf[arr.start + i | 0];
    arr.buf[arr.start + i | 0] = arr.buf[arr.start + j | 0];
    arr.buf[arr.start + j | 0] = temp;
  }
  function _M0MPC15array12MutArrayView5sliceGUsRPB5ArrayGiEEE(arr, start, end) {
    const _bind = arr.end - arr.start | 0;
    if (start < 0 || (start > end || end > _bind)) {
      $panic();
    }
    return new _M0TPB12MutArrayViewGUsRPB5ArrayGiEEE(arr.buf, start + arr.start | 0, end + arr.start | 0);
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
  function _M0MPC15array5Array3setGRP36mizchi4luna3dom9ItemEntryGsEE(self, index, value) {
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
  function _M0MPC15array12MutArrayView14rev__in__placeGUsRPB5ArrayGiEEE(arr) {
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
  function _M0FPB23fixed__bubble__sort__byGUsRPB5ArrayGiEEE(arr, cmp) {
    const _bind = arr.end - arr.start | 0;
    let _tmp = 1;
    while (true) {
      const i = _tmp;
      if (i < _bind) {
        let _tmp$2 = i;
        while (true) {
          const j = _tmp$2;
          if (j > 0 && cmp(arr.buf[arr.start + (j - 1 | 0) | 0], arr.buf[arr.start + j | 0]) > 0) {
            _M0MPC15array12MutArrayView4swapGUsRPB5ArrayGiEEE(arr, j, j - 1 | 0);
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
  function _M0FPB24fixed__choose__pivot__byN7sort__2S966GUsRPB5ArrayGiEEE(_env, a, b) {
    const arr = _env._2;
    const cmp = _env._1;
    const swaps = _env._0;
    if (cmp(arr.buf[arr.start + a | 0], arr.buf[arr.start + b | 0]) > 0) {
      _M0MPC15array12MutArrayView4swapGUsRPB5ArrayGiEEE(arr, a, b);
      swaps.val = swaps.val + 1 | 0;
      return;
    } else {
      return;
    }
  }
  function _M0FPB24fixed__choose__pivot__byN7sort__3S967GUsRPB5ArrayGiEEE(_env, a, b, c) {
    _M0FPB24fixed__choose__pivot__byN7sort__2S966GUsRPB5ArrayGiEEE(_env, a, b);
    _M0FPB24fixed__choose__pivot__byN7sort__2S966GUsRPB5ArrayGiEEE(_env, b, c);
    _M0FPB24fixed__choose__pivot__byN7sort__2S966GUsRPB5ArrayGiEEE(_env, a, b);
  }
  function _M0FPB24fixed__choose__pivot__byGUsRPB5ArrayGiEEE(arr, cmp) {
    const len = arr.end - arr.start | 0;
    const swaps = new _M0TPB8MutLocalGiE(0);
    const b = Math.imul(len / 4 | 0, 2) | 0;
    if (len >= 8) {
      const a = Math.imul(len / 4 | 0, 1) | 0;
      const c = Math.imul(len / 4 | 0, 3) | 0;
      const _env = { _0: swaps, _1: cmp, _2: arr };
      if (len > 50) {
        _M0FPB24fixed__choose__pivot__byN7sort__3S967GUsRPB5ArrayGiEEE(_env, a - 1 | 0, a, a + 1 | 0);
        _M0FPB24fixed__choose__pivot__byN7sort__3S967GUsRPB5ArrayGiEEE(_env, b - 1 | 0, b, b + 1 | 0);
        _M0FPB24fixed__choose__pivot__byN7sort__3S967GUsRPB5ArrayGiEEE(_env, c - 1 | 0, c, c + 1 | 0);
      }
      _M0FPB24fixed__choose__pivot__byN7sort__3S967GUsRPB5ArrayGiEEE(_env, a, b, c);
    }
    if (swaps.val === 12) {
      _M0MPC15array12MutArrayView14rev__in__placeGUsRPB5ArrayGiEEE(arr);
      return { _0: (len - b | 0) - 1 | 0, _1: true };
    } else {
      return { _0: b, _1: swaps.val === 0 };
    }
  }
  function _M0FPB21fixed__sift__down__byGUsRPB5ArrayGiEEE(arr, index, cmp) {
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
        _M0MPC15array12MutArrayView4swapGUsRPB5ArrayGiEEE(arr, index$2, child$2);
        _tmp = child$2;
        _tmp$2 = (Math.imul(child$2, 2) | 0) + 1 | 0;
        continue;
      } else {
        return;
      }
    }
  }
  function _M0FPB21fixed__heap__sort__byGUsRPB5ArrayGiEEE(arr, cmp) {
    const len = arr.end - arr.start | 0;
    const _bind = len / 2 | 0;
    let _tmp = _bind - 1 | 0;
    let _tmp$2 = _bind > 0;
    while (true) {
      const i = _tmp;
      const _more = _tmp$2;
      if (_more) {
        _M0FPB21fixed__sift__down__byGUsRPB5ArrayGiEEE(arr, i, cmp);
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
        _M0MPC15array12MutArrayView4swapGUsRPB5ArrayGiEEE(arr, 0, i);
        _M0FPB21fixed__sift__down__byGUsRPB5ArrayGiEEE(_M0MPC15array12MutArrayView5sliceGUsRPB5ArrayGiEEE(arr, 0, i), 0, cmp);
        _tmp$3 = i - 1 | 0;
        _tmp$4 = i > 1;
        continue;
      } else {
        return;
      }
    }
  }
  function _M0FPB20fixed__partition__byGUsRPB5ArrayGiEEE(arr, cmp, pivot_index) {
    _M0MPC15array12MutArrayView4swapGUsRPB5ArrayGiEEE(arr, pivot_index, (arr.end - arr.start | 0) - 1 | 0);
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
            _M0MPC15array12MutArrayView4swapGUsRPB5ArrayGiEEE(arr, i, j);
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
        _M0MPC15array12MutArrayView4swapGUsRPB5ArrayGiEEE(arr, i, (arr.end - arr.start | 0) - 1 | 0);
        return { _0: i, _1: partitioned };
      }
    }
  }
  function _M0FPB28fixed__try__bubble__sort__byGUsRPB5ArrayGiEEE(arr, cmp) {
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
            _M0MPC15array12MutArrayView4swapGUsRPB5ArrayGiEEE(arr, j, j - 1 | 0);
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
  function _M0FPB22fixed__quick__sort__byGUsRPB5ArrayGiEEE(arr, cmp, pred, limit) {
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
          _M0FPB23fixed__bubble__sort__byGUsRPB5ArrayGiEEE(arr$2, cmp);
        }
        return undefined;
      }
      if (limit$2 === 0) {
        _M0FPB21fixed__heap__sort__byGUsRPB5ArrayGiEEE(arr$2, cmp);
        return undefined;
      }
      const _bind = _M0FPB24fixed__choose__pivot__byGUsRPB5ArrayGiEEE(arr$2, cmp);
      const _pivot_index = _bind._0;
      const _likely_sorted = _bind._1;
      if (was_partitioned && (balanced && _likely_sorted)) {
        if (_M0FPB28fixed__try__bubble__sort__byGUsRPB5ArrayGiEEE(arr$2, cmp)) {
          return undefined;
        }
      }
      const _bind$2 = _M0FPB20fixed__partition__byGUsRPB5ArrayGiEEE(arr$2, cmp, _pivot_index);
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
          _tmp$2 = _M0MPC15array12MutArrayView5sliceGUsRPB5ArrayGiEEE(arr$2, i, len);
          _tmp$4 = _partitioned;
          _tmp$5 = balanced$2;
          continue;
        }
      }
      const left = _M0MPC15array12MutArrayView5sliceGUsRPB5ArrayGiEEE(arr$2, 0, _pivot);
      const right = _M0MPC15array12MutArrayView5sliceGUsRPB5ArrayGiEEE(arr$2, _pivot + 1 | 0, len);
      if ((left.end - left.start | 0) < (right.end - right.start | 0)) {
        _M0FPB22fixed__quick__sort__byGUsRPB5ArrayGiEEE(left, cmp, pred$2, limit$3);
        _tmp = limit$3;
        _tmp$2 = right;
        _tmp$3 = arr$2.buf[arr$2.start + _pivot | 0];
        _tmp$4 = _partitioned;
        _tmp$5 = balanced$2;
        continue;
      } else {
        _M0FPB22fixed__quick__sort__byGUsRPB5ArrayGiEEE(right, cmp, arr$2.buf[arr$2.start + _pivot | 0], limit$3);
        _tmp = limit$3;
        _tmp$2 = left;
        _tmp$4 = _partitioned;
        _tmp$5 = balanced$2;
        continue;
      }
    }
  }
  function _M0MPC15array12MutArrayView8sort__byGUsRPB5ArrayGiEEE(self, cmp) {
    _M0FPB22fixed__quick__sort__byGUsRPB5ArrayGiEEE(self, cmp, undefined, _M0FPB17fixed__get__limit(self.end - self.start | 0));
  }
  function _M0MPC15array5Array8sort__byGUsRPB5ArrayGiEEE(self, cmp) {
    const _bind = self.length;
    _M0MPC15array12MutArrayView8sort__byGUsRPB5ArrayGiEEE(new _M0TPB12MutArrayViewGUsRPB5ArrayGiEEE(self, 0, _bind), cmp);
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
  function _M0IPC15array5ArrayPB3Add3addGRP36mizchi4luna3dom7DomNodeE(self, other) {
    const len_self = self.length;
    const len_other = other.length;
    if (len_self === 0) {
      return _M0MPC15array5Array31unsafe__make__and__blit_2einnerGRP36mizchi4luna3dom7DomNodeE(other, len_other, len_other, 0, 0);
    } else {
      const result = _M0MPC15array5Array31unsafe__make__and__blit_2einnerGRP36mizchi4luna3dom7DomNodeE(self, len_self + len_other | 0, len_self, 0, 0);
      _M0MPB18UninitializedArray12unsafe__blitGRP36mizchi4luna3dom7DomNodeE(result, len_self, other, 0, len_other);
      return result;
    }
  }
  function _M0MPC15array5Array5clearGRP26mizchi7signals5OwnerE(self) {
    _M0MPC15array5Array28unsafe__truncate__to__lengthGRP26mizchi7signals5OwnerE(self, 0);
  }
  function _M0MPC15array5Array8containsGsE(self, value) {
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
  function _M0MPC15array5Array6searchGsE(self, value) {
    return _M0MPC15array9ArrayView6searchGsE(new _M0TPB9ArrayViewGsE(self, 0, self.length), value);
  }
  function _M0MPC15array5Array4joinGsE(self, separator) {
    return _M0MPC15array9ArrayView4joinGsE(new _M0TPB9ArrayViewGsE(self, 0, self.length), separator);
  }
  function _M0MPC13ref3Ref3RefGRPB5ArrayGRP36mizchi4luna3dom9ItemEntryGsEEE(x) {
    return new _M0TPC13ref3RefGRPB5ArrayGRP36mizchi4luna3dom9ItemEntryGsEEE(x);
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
      _M0MPC15array5Array4pushGUssEE(_owner.disposers, disposer);
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
        _M0MPC15array5Array4pushGUssEE(_M0FP26mizchi7signals15callback__queue, _callback);
        _M0MPC15array5Array4pushGUssEE(_M0FP26mizchi7signals22callback__queue__nodes, node);
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
  function _M0MP26mizchi7signals10CoreSignal3getGRPB5ArrayGRP314vlmkit_2dsites4code4main5IssueEE(self) {
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
  function _M0MP26mizchi7signals6Signal3getGiE(self) {
    return _M0MP26mizchi7signals10CoreSignal3getGiE(self.inner);
  }
  function _M0MP26mizchi7signals6Signal3getGsE(self) {
    return _M0MP26mizchi7signals10CoreSignal3getGsE(self.inner);
  }
  function _M0MP26mizchi7signals6Signal3getGbE(self) {
    return _M0MP26mizchi7signals10CoreSignal3getGbE(self.inner);
  }
  function _M0MP26mizchi7signals6Signal3getGRPB5ArrayGRP314vlmkit_2dsites4code4main5IssueEE(self) {
    return _M0MP26mizchi7signals10CoreSignal3getGRPB5ArrayGRP314vlmkit_2dsites4code4main5IssueEE(self.inner);
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
    const link_ref = _M0MPC13ref3Ref3RefGRPB5ArrayGRP36mizchi4luna3dom9ItemEntryGsEEE(start_link);
    const next_ref = _M0MPC13ref3Ref3RefGRPB5ArrayGRP36mizchi4luna3dom9ItemEntryGsEEE(start_link.next_sub);
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
                _M0MPC15array5Array4pushGUssEE(stack, { _0: next_ref.val, _1: undefined });
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
  function _M0FP26mizchi7signals12core__signalGiE(initial) {
    return new _M0TP26mizchi7signals10CoreSignalGiE(_M0MP26mizchi7signals12ReactiveNode3new(_M0MP26mizchi7signals13ReactiveFlags7to__int(1)), initial, initial);
  }
  function _M0FP26mizchi7signals12core__signalGsE(initial) {
    return new _M0TP26mizchi7signals10CoreSignalGsE(_M0MP26mizchi7signals12ReactiveNode3new(_M0MP26mizchi7signals13ReactiveFlags7to__int(1)), initial, initial);
  }
  function _M0FP26mizchi7signals12core__signalGbE(initial) {
    return new _M0TP26mizchi7signals10CoreSignalGbE(_M0MP26mizchi7signals12ReactiveNode3new(_M0MP26mizchi7signals13ReactiveFlags7to__int(1)), initial, initial);
  }
  function _M0FP26mizchi7signals12core__signalGRPB5ArrayGRP314vlmkit_2dsites4code4main5IssueEE(initial) {
    return new _M0TP26mizchi7signals10CoreSignalGRPB5ArrayGRP314vlmkit_2dsites4code4main5IssueEE(_M0MP26mizchi7signals12ReactiveNode3new(_M0MP26mizchi7signals13ReactiveFlags7to__int(1)), initial, initial);
  }
  function _M0MP26mizchi7signals6Signal3newGiE(initial) {
    return new _M0TP26mizchi7signals6SignalGiE(_M0FP26mizchi7signals12core__signalGiE(initial));
  }
  function _M0MP26mizchi7signals6Signal3newGsE(initial) {
    return new _M0TP26mizchi7signals6SignalGsE(_M0FP26mizchi7signals12core__signalGsE(initial));
  }
  function _M0MP26mizchi7signals6Signal3newGbE(initial) {
    return new _M0TP26mizchi7signals6SignalGbE(_M0FP26mizchi7signals12core__signalGbE(initial));
  }
  function _M0MP26mizchi7signals6Signal3newGRPB5ArrayGRP314vlmkit_2dsites4code4main5IssueEE(initial) {
    return new _M0TP26mizchi7signals6SignalGRPB5ArrayGRP314vlmkit_2dsites4code4main5IssueEE(_M0FP26mizchi7signals12core__signalGRPB5ArrayGRP314vlmkit_2dsites4code4main5IssueEE(initial));
  }
  function _M0FP26mizchi7signals6signalGiE(initial) {
    return _M0MP26mizchi7signals6Signal3newGiE(initial);
  }
  function _M0FP26mizchi7signals6signalGsE(initial) {
    return _M0MP26mizchi7signals6Signal3newGsE(initial);
  }
  function _M0FP26mizchi7signals6signalGbE(initial) {
    return _M0MP26mizchi7signals6Signal3newGbE(initial);
  }
  function _M0FP26mizchi7signals6signalGRPB5ArrayGRP314vlmkit_2dsites4code4main5IssueEE(initial) {
    return _M0MP26mizchi7signals6Signal3newGRPB5ArrayGRP314vlmkit_2dsites4code4main5IssueEE(initial);
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
  function _M0MP26mizchi7signals10CoreSignal3setGRPB5ArrayGRP314vlmkit_2dsites4code4main5IssueEE(self, value) {
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
  function _M0MP26mizchi7signals6Signal3setGiE(self, new_value) {
    _M0MP26mizchi7signals10CoreSignal3setGiE(self.inner, new_value);
  }
  function _M0MP26mizchi7signals6Signal3setGsE(self, new_value) {
    _M0MP26mizchi7signals10CoreSignal3setGsE(self.inner, new_value);
  }
  function _M0MP26mizchi7signals6Signal3setGbE(self, new_value) {
    _M0MP26mizchi7signals10CoreSignal3setGbE(self.inner, new_value);
  }
  function _M0MP26mizchi7signals10CoreSignal6updateGiE(self, f) {
    _M0MP26mizchi7signals10CoreSignal3setGiE(self, f(_M0MP26mizchi7signals10CoreSignal3getGiE(self)));
  }
  function _M0MP26mizchi7signals10CoreSignal6updateGbE(self, f) {
    _M0MP26mizchi7signals10CoreSignal3setGbE(self, f(_M0MP26mizchi7signals10CoreSignal3getGbE(self)));
  }
  function _M0MP26mizchi7signals10CoreSignal6updateGRPB5ArrayGRP314vlmkit_2dsites4code4main5IssueEE(self, f) {
    _M0MP26mizchi7signals10CoreSignal3setGRPB5ArrayGRP314vlmkit_2dsites4code4main5IssueEE(self, f(_M0MP26mizchi7signals10CoreSignal3getGRPB5ArrayGRP314vlmkit_2dsites4code4main5IssueEE(self)));
  }
  function _M0MP26mizchi7signals6Signal6updateGiE(self, f) {
    _M0MP26mizchi7signals10CoreSignal6updateGiE(self.inner, f);
  }
  function _M0MP26mizchi7signals6Signal6updateGbE(self, f) {
    _M0MP26mizchi7signals10CoreSignal6updateGbE(self.inner, f);
  }
  function _M0MP26mizchi7signals6Signal6updateGRPB5ArrayGRP314vlmkit_2dsites4code4main5IssueEE(self, f) {
    _M0MP26mizchi7signals10CoreSignal6updateGRPB5ArrayGRP314vlmkit_2dsites4code4main5IssueEE(self.inner, f);
  }
  function _M0FP26mizchi7signals16create__computedGRPB5ArrayGRP314vlmkit_2dsites4code4main7PalItemEE(getter) {
    return new _M0TP26mizchi7signals8ComputedGRPB5ArrayGRP314vlmkit_2dsites4code4main7PalItemEE(_M0MP26mizchi7signals12ReactiveNode3new(_M0MP26mizchi7signals13ReactiveFlags7to__int(0)), _M0DTPC16option6OptionGRPB5ArrayGRP314vlmkit_2dsites4code4main7PalItemEE4None__, getter);
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
  function _M0FP26mizchi7signals16update__computedGRPB5ArrayGRP314vlmkit_2dsites4code4main7PalItemEE(c) {
    _M0FP26mizchi7signals10inc__cycle();
    c.node.deps_tail = undefined;
    _M0MP26mizchi7signals5Flags10set__value(c.node.flags, _M0MP26mizchi7signals13ReactiveFlags7to__int(1) | _M0MP26mizchi7signals13ReactiveFlags7to__int(4));
    const prev_sub = _M0FP26mizchi7signals16set__active__sub(c.node);
    const old_value = c.value;
    const _func = c.getter;
    const new_value = _func();
    c.value = new _M0DTPC16option6OptionGRPB5ArrayGRP314vlmkit_2dsites4code4main7PalItemEE4Some(new_value);
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
  function _M0MP26mizchi7signals8Computed3getGRPB5ArrayGRP314vlmkit_2dsites4code4main7PalItemEE(self) {
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
      if (_M0FP26mizchi7signals16update__computedGRPB5ArrayGRP314vlmkit_2dsites4code4main7PalItemEE(self)) {
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
          self.value = new _M0DTPC16option6OptionGRPB5ArrayGRP314vlmkit_2dsites4code4main7PalItemEE4Some(_func());
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
  function _M0FP26mizchi7signals4memoGRPB5ArrayGRP314vlmkit_2dsites4code4main7PalItemEE(compute) {
    const inner = _M0FP26mizchi7signals16create__computedGRPB5ArrayGRP314vlmkit_2dsites4code4main7PalItemEE(compute);
    return () => _M0MP26mizchi7signals8Computed3getGRPB5ArrayGRP314vlmkit_2dsites4code4main7PalItemEE(inner);
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
      _M0MPC15array5Array4pushGUssEE(_p.children, owner);
    }
    return owner;
  }
  function _M0FP26mizchi7signals9untrackedGRPB5ArrayGRP36mizchi11js__browser3dom4NodeEE(f) {
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
  function _M0FP36mizchi4luna3dom4showN19render__with__scopeS2026(_env) {
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
    const current_dispose = _M0MPC13ref3Ref3RefGRPB5ArrayGRP36mizchi4luna3dom9ItemEntryGsEEE(undefined);
    const _env = { _0: render_fn, _1: captured_owner, _2: current_dispose };
    const initial_show = _M0FP26mizchi7signals9untrackedGbE(() => when());
    const initial_nodes = initial_show ? _M0FP26mizchi7signals9untrackedGRPB5ArrayGRP36mizchi11js__browser3dom4NodeEE(() => _M0FP36mizchi4luna3dom4showN19render__with__scopeS2026(_env)) : [];
    const current_nodes = _M0MPC13ref3Ref3RefGRPB5ArrayGRP36mizchi4luna3dom9ItemEntryGsEEE(initial_nodes);
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
            const nodes = _M0FP26mizchi7signals9untrackedGRPB5ArrayGRP36mizchi11js__browser3dom4NodeEE(() => _M0FP36mizchi4luna3dom4showN19render__with__scopeS2026(_env));
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
          _M0MPC15array5Array4pushGUssEE(all_nodes, new _M0DTP36mizchi4luna3dom7DomNode3Raw(node));
          _tmp = _ + 1 | 0;
          continue;
        } else {
          break;
        }
      }
      _M0MPC15array5Array4pushGUssEE(all_nodes, new _M0DTP36mizchi4luna3dom7DomNode3Raw(placeholder));
      return _M0FP36mizchi4luna3dom8fragment(all_nodes);
    } else {
      return new _M0DTP36mizchi4luna3dom7DomNode3Raw(placeholder);
    }
  }
  function _M0FP36mizchi4luna3dom24build__entry__index__mapGsE(entries) {
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
  function _M0FP36mizchi4luna3dom10ref__equalGsE(a, b) {
    return _M0FP36mizchi4luna3dom15ref__equal__any(a, b);
  }
  function _M0FP36mizchi4luna3dom18find__entry__indexGsE(map, item, used_indices, old_entries) {
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
        if (!_M0MPC15array5Array2atGbE(used_indices, i) && _M0FP36mizchi4luna3dom10ref__equalGsE(entry.item, item)) {
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
  function _M0FP36mizchi4luna3dom20has__duplicate__refsGsE(items) {
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
  function _M0MP36mizchi4luna3dom9ItemEntry3newGsE(item, dom) {
    return new _M0TP36mizchi4luna3dom9ItemEntryGsE(item, dom, dom, [dom], () => {
    });
  }
  function _M0MP36mizchi4luna3dom9ItemEntry30new__with__nodes__and__disposeGsE(item, nodes, dispose) {
    const first = _M0MPC15array5Array2atGORP26mizchi7signals10EffectNodeE(nodes, 0);
    const last = _M0MPC15array5Array2atGORP26mizchi7signals10EffectNodeE(nodes, nodes.length - 1 | 0);
    return new _M0TP36mizchi4luna3dom9ItemEntryGsE(item, first, last, nodes, dispose);
  }
  function _M0FP36mizchi4luna3dom31reconcile__items__with__disposeGsE(parent, old_entries, new_items, render_item, end_marker) {
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
    if (_M0FP36mizchi4luna3dom20has__duplicate__refsGsE(new_items)) {
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
            _M0MPC15array5Array4pushGUssEE(fresh_entries, _M0MP36mizchi4luna3dom9ItemEntry30new__with__nodes__and__disposeGsE(item, [placeholder], _dispose));
          } else {
            _M0MP36mizchi11js__browser3dom4Node12insertBefore(parent, _dom, new _M0DTPC16option6OptionGRP36mizchi11js__browser3dom4NodeE4Some(end_marker));
            _M0MPC15array5Array4pushGUssEE(fresh_entries, _M0MP36mizchi4luna3dom9ItemEntry30new__with__nodes__and__disposeGsE(item, nodes, _dispose));
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
        _M0MPC15array5Array4pushGUssEE(new_entries, _M0MP36mizchi4luna3dom9ItemEntry3newGsE(_M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(new_items, 0), end_marker));
        _tmp = _ + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    const used_indices = _M0MPC15array5Array4makeGbE(old_entries.length, false);
    const index_map = _M0FP36mizchi4luna3dom24build__entry__index__mapGsE(old_entries);
    const cursor = _M0MPC13ref3Ref3RefGRPB5ArrayGRP36mizchi4luna3dom9ItemEntryGsEEE(end_marker);
    const last = n - 1 | 0;
    let _tmp$2 = last;
    let _tmp$3 = last >= 0;
    while (true) {
      const i = _tmp$2;
      const _more = _tmp$3;
      if (_more) {
        const item = _M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(new_items, i);
        const old_index = _M0FP36mizchi4luna3dom18find__entry__indexGsE(index_map, item, used_indices, old_entries);
        if (old_index >= 0) {
          const entry = _M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(old_entries, old_index);
          _M0MPC15array5Array3setGbE(used_indices, old_index, true);
          if (entry.nodes.length > 0) {
            if (!_M0FP36mizchi4luna3dom17next__sibling__is(entry.last, cursor.val)) {
              _M0FP36mizchi4luna3dom19move__nodes__before(parent, entry.nodes, cursor.val);
            }
            cursor.val = entry.dom;
          }
          _M0MPC15array5Array3setGRP36mizchi4luna3dom9ItemEntryGsEE(new_entries, i, entry);
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
            _M0MPC15array5Array3setGRP36mizchi4luna3dom9ItemEntryGsEE(new_entries, i, _M0MP36mizchi4luna3dom9ItemEntry30new__with__nodes__and__disposeGsE(item, placeholder_nodes, _dispose));
          } else {
            _M0MP36mizchi11js__browser3dom4Node12insertBefore(parent, _dom, new _M0DTPC16option6OptionGRP36mizchi11js__browser3dom4NodeE4Some(cursor.val));
            cursor.val = _M0MPC15array5Array2atGORP26mizchi7signals10EffectNodeE(nodes, 0);
            _M0MPC15array5Array3setGRP36mizchi4luna3dom9ItemEntryGsEE(new_entries, i, _M0MP36mizchi4luna3dom9ItemEntry30new__with__nodes__and__disposeGsE(item, nodes, _dispose));
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
  function _M0FP36mizchi4luna3dom35reconcile__for__each__with__disposeGsE(entries_ref, placeholder, new_items, render_item) {
    const _bind = _M0MP36mizchi11js__browser3dom4Node10parentNode(placeholder);
    if (_bind.$tag === 1) {
      const _Some = _bind;
      const _parent = _Some._0;
      entries_ref.val = _M0FP36mizchi4luna3dom31reconcile__items__with__disposeGsE(_parent, entries_ref.val, new_items, render_item, placeholder);
      return;
    } else {
      return;
    }
  }
  function _M0FP36mizchi4luna3dom9for__eachGsE(items, render_item) {
    const doc = _M0FP36mizchi11js__browser3dom8document();
    const placeholder = _M0MP36mizchi11js__browser3dom8Document13createComment(doc, "for");
    const entries = _M0MPC13ref3Ref3RefGRPB5ArrayGRP36mizchi4luna3dom9ItemEntryGsEEE([]);
    const is_first = _M0MPC13ref3Ref3RefGbE(true);
    const captured_owner = _M0FP26mizchi7signals17reactive__context.current_owner;
    const render_with_scope = (item, i) => _M0FP26mizchi7signals19with__parent__ownerGURP36mizchi11js__browser3dom4NodeWEuEE(captured_owner, () => {
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
        const _bind$2 = _M0FP26mizchi7signals9untrackedGURP36mizchi11js__browser3dom4NodeWEuEE(() => render_with_scope(item, i));
        const _dom = _bind$2._0;
        const _dispose = _bind$2._1;
        const nodes = _M0FP36mizchi4luna3dom19collect__dom__nodes(_dom);
        if (nodes.length === 0) {
          const placeholder$2 = _M0MP36mizchi11js__browser3dom8Document13createComment(doc, "empty");
          _M0MP36mizchi11js__browser3dom4Node11appendChild(fragment, placeholder$2);
          _M0MPC15array5Array4pushGUssEE(entries.val, _M0MP36mizchi4luna3dom9ItemEntry30new__with__nodes__and__disposeGsE(item, [placeholder$2], _dispose));
        } else {
          _M0MPC15array5Array4pushGUssEE(entries.val, _M0MP36mizchi4luna3dom9ItemEntry30new__with__nodes__and__disposeGsE(item, nodes, _dispose));
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
        _M0FP36mizchi4luna3dom35reconcile__for__each__with__disposeGsE(entries, placeholder, new_items, render_with_scope);
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
  function _M0FP314vlmkit_2dsites4code4main9chars__of(s) {
    return _M0MPB4Iter9to__arrayGcE(_M0MPC16string6String4iter(s));
  }
  function _M0FP314vlmkit_2dsites4code4main7str__of(cs, from, to) {
    return from >= to ? "" : _M0MPC16string6String11from__array(_M0MPC15array5Array21clamped__view_2einnerGcE(cs, from, to));
  }
  function _M0FP314vlmkit_2dsites4code4main11index__from(cs, ch, from) {
    let i = from;
    while (true) {
      if (i < cs.length) {
        if (_M0MPC15array5Array2atGcE(cs, i) === ch) {
          return i;
        }
        i = i + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return -1;
  }
  function _M0FP314vlmkit_2dsites4code4main4slug(text) {
    const buf = _M0MPB13StringBuilder21StringBuilder_2einner(8);
    let dash = false;
    const _bind = _M0MPC16string6String9to__lower(text);
    const _bind$2 = _bind.length;
    let _tmp = 0;
    while (true) {
      const _string_index = _tmp;
      if (_string_index < _bind$2) {
        let _decoded_next_string_index;
        let _decoded_char;
        _L: {
          const _bind$3 = _bind.charCodeAt(_string_index);
          if (_bind$3 >= 55296 && _bind$3 <= 56319 && (_string_index + 1 | 0) < _bind$2) {
            const _bind$4 = _bind.charCodeAt(_string_index + 1 | 0);
            if (_bind$4 >= 56320 && _bind$4 <= 57343) {
              const _tmp$2 = _string_index + 2 | 0;
              const _p = (((Math.imul(_bind$3 - 55296 | 0, 1024) | 0) + _bind$4 | 0) - 56320 | 0) + 65536 | 0;
              _decoded_next_string_index = _tmp$2;
              _decoded_char = _p;
              break _L;
            } else {
              const _tmp$2 = _string_index + 1 | 0;
              const _p = _bind$3;
              _decoded_next_string_index = _tmp$2;
              _decoded_char = _p;
              break _L;
            }
          } else {
            const _tmp$2 = _string_index + 1 | 0;
            const _p = _bind$3;
            _decoded_next_string_index = _tmp$2;
            _decoded_char = _p;
            break _L;
          }
        }
        if (_M0MPC14char4Char21is__ascii__alphabetic(_decoded_char) || _M0MPC14char4Char16is__ascii__digit(_decoded_char)) {
          _M0IPB13StringBuilderPB6Logger11write__char(buf, _decoded_char);
          dash = false;
        } else {
          if (!dash && buf.val.length > 0) {
            _M0IPB13StringBuilderPB6Logger11write__char(buf, 45);
            dash = true;
          }
        }
        _tmp = _decoded_next_string_index;
        continue;
      } else {
        break;
      }
    }
    const s = buf.val;
    return _M0MPC16string6String11has__suffix(s, _M0FP314vlmkit_2dsites4code4main4slugN6recordS2543) ? _M0MPC16string6String17substring_2einner(s, 0, s.length - 1 | 0) : s;
  }
  function _M0FP314vlmkit_2dsites4code4main3a__(name, v) {
    return { _0: name, _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(v) };
  }
  function _M0FP314vlmkit_2dsites4code4main3cls(v) {
    return { _0: "class", _1: new _M0DTP36mizchi4luna3dom9AttrValue6Static(v) };
  }
  function _M0FP314vlmkit_2dsites4code4main2el(tag, attrs, kids) {
    return _M0FP36mizchi4luna3dom15create__element(tag, attrs, kids);
  }
  function _M0FP314vlmkit_2dsites4code4main1t(s) {
    return _M0FP36mizchi4luna3dom4text(s);
  }
  function _M0FP314vlmkit_2dsites4code4main5badge(alt) {
    let label;
    let value;
    _L: {
      const _bind = _M0MPC16string6String11split__once(alt, _M0FP314vlmkit_2dsites4code4main5badgeN6recordS2564);
      if (_bind === undefined) {
        label = alt;
        value = "";
        break _L;
      } else {
        const _Some = _bind;
        const _x = _Some;
        const _a = _x._0;
        const _b = _x._1;
        label = _M0MPC16string10StringView9to__owned(_a);
        value = _M0MPC16string10StringView9to__owned(_b);
        break _L;
      }
    }
    let tone;
    switch (label) {
      case "build": {
        tone = "ok";
        break;
      }
      case "coverage": {
        tone = "ok";
        break;
      }
      case "license": {
        tone = "info";
        break;
      }
      default: {
        tone = "accent";
      }
    }
    return _M0FP314vlmkit_2dsites4code4main2el("span", [_M0FP314vlmkit_2dsites4code4main3cls("badge"), _M0FP314vlmkit_2dsites4code4main3a__("role", "img"), _M0FP314vlmkit_2dsites4code4main3a__("aria-label", alt)], [_M0FP314vlmkit_2dsites4code4main2el("span", [_M0FP314vlmkit_2dsites4code4main3cls("badge-l"), _M0FP314vlmkit_2dsites4code4main3a__("aria-hidden", "true")], [_M0FP314vlmkit_2dsites4code4main1t(label)]), _M0FP314vlmkit_2dsites4code4main2el("span", [_M0FP314vlmkit_2dsites4code4main3cls(`badge-v tone-${tone}`), _M0FP314vlmkit_2dsites4code4main3a__("aria-hidden", "true")], [_M0FP314vlmkit_2dsites4code4main1t(value)])]);
  }
  function _M0FP314vlmkit_2dsites4code4main10md__inlineN5flushS2575(_env) {
    const buf = _env._1;
    const out = _env._0;
    const v = buf.val;
    const _p = "";
    if (!(v === _p)) {
      _M0MPC15array5Array4pushGUssEE(out, _M0FP314vlmkit_2dsites4code4main1t(v));
      _M0MPB13StringBuilder13reset_2einner(buf, true);
      return;
    } else {
      return;
    }
  }
  function _M0FP314vlmkit_2dsites4code4main10md__inline(s) {
    const cs = _M0FP314vlmkit_2dsites4code4main9chars__of(s);
    const out = [];
    const buf = _M0MPB13StringBuilder21StringBuilder_2einner(8);
    const _env = { _0: out, _1: buf };
    let i = 0;
    while (true) {
      if (i < cs.length) {
        const ch = _M0MPC15array5Array2atGcE(cs, i);
        if (ch === 96) {
          const j = _M0FP314vlmkit_2dsites4code4main11index__from(cs, 96, i + 1 | 0);
          if (j > 0) {
            _M0FP314vlmkit_2dsites4code4main10md__inlineN5flushS2575(_env);
            _M0MPC15array5Array4pushGUssEE(out, _M0FP314vlmkit_2dsites4code4main2el("code", [], [_M0FP314vlmkit_2dsites4code4main1t(_M0FP314vlmkit_2dsites4code4main7str__of(cs, i + 1 | 0, j))]));
            i = j + 1 | 0;
            continue;
          }
        }
        if (ch === 42 && ((i + 1 | 0) < cs.length && _M0MPC15array5Array2atGcE(cs, i + 1 | 0) === 42)) {
          let j = i + 2 | 0;
          while (true) {
            if ((j + 1 | 0) < cs.length && !(_M0MPC15array5Array2atGcE(cs, j) === 42 && _M0MPC15array5Array2atGcE(cs, j + 1 | 0) === 42)) {
              j = j + 1 | 0;
              continue;
            } else {
              break;
            }
          }
          if ((j + 1 | 0) < cs.length) {
            _M0FP314vlmkit_2dsites4code4main10md__inlineN5flushS2575(_env);
            _M0MPC15array5Array4pushGUssEE(out, _M0FP314vlmkit_2dsites4code4main2el("strong", [], _M0FP314vlmkit_2dsites4code4main10md__inline(_M0FP314vlmkit_2dsites4code4main7str__of(cs, i + 2 | 0, j))));
            i = j + 2 | 0;
            continue;
          }
        }
        if (ch === 91 && ((i + 1 | 0) < cs.length && _M0MPC15array5Array2atGcE(cs, i + 1 | 0) === 33)) {
          const close = _M0FP314vlmkit_2dsites4code4main11index__from(cs, 93, i + 3 | 0);
          const end = _M0FP314vlmkit_2dsites4code4main11index__from(cs, 41, close + 1 | 0);
          const end2 = _M0FP314vlmkit_2dsites4code4main11index__from(cs, 41, end + 1 | 0);
          if (close > 0 && (end > 0 && end2 > 0)) {
            _M0FP314vlmkit_2dsites4code4main10md__inlineN5flushS2575(_env);
            _M0MPC15array5Array4pushGUssEE(out, _M0FP314vlmkit_2dsites4code4main5badge(_M0FP314vlmkit_2dsites4code4main7str__of(cs, i + 3 | 0, close)));
            i = end2 + 1 | 0;
            continue;
          }
        }
        if (ch === 91) {
          const close = _M0FP314vlmkit_2dsites4code4main11index__from(cs, 93, i + 1 | 0);
          if (close > 0 && ((close + 1 | 0) < cs.length && _M0MPC15array5Array2atGcE(cs, close + 1 | 0) === 40)) {
            const end = _M0FP314vlmkit_2dsites4code4main11index__from(cs, 41, close + 2 | 0);
            if (end > 0) {
              _M0FP314vlmkit_2dsites4code4main10md__inlineN5flushS2575(_env);
              const href = _M0FP314vlmkit_2dsites4code4main7str__of(cs, close + 2 | 0, end);
              _M0MPC15array5Array4pushGUssEE(out, _M0FP314vlmkit_2dsites4code4main2el("a", [_M0FP314vlmkit_2dsites4code4main3a__("href", href)], _M0FP314vlmkit_2dsites4code4main10md__inline(_M0FP314vlmkit_2dsites4code4main7str__of(cs, i + 1 | 0, close))));
              i = end + 1 | 0;
              continue;
            }
          }
        }
        _M0IPB13StringBuilderPB6Logger11write__char(buf, ch);
        i = i + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    _M0FP314vlmkit_2dsites4code4main10md__inlineN5flushS2575(_env);
    return out;
  }
  function _M0FP314vlmkit_2dsites4code4main12table__cells(line) {
    const trimmed = _M0MPC16string10StringView9to__owned(_M0MPC16string6String12trim_2einner(line, _M0FP314vlmkit_2dsites4code4main12table__cellsN6recordS2597));
    const inner = _M0MPC16string6String17substring_2einner(trimmed, _M0MPC16string6String11has__prefix(trimmed, _M0FP314vlmkit_2dsites4code4main12table__cellsN6recordS2598) ? 1 : 0, _M0MPC16string6String11has__suffix(trimmed, _M0FP314vlmkit_2dsites4code4main12table__cellsN6recordS2599) ? trimmed.length - 1 | 0 : trimmed.length);
    return _M0MPB4Iter9to__arrayGRPC16string10StringViewE(_M0MPB4Iter3mapGRPC16string10StringViewsE(_M0MPC16string6String5split(inner, _M0FP314vlmkit_2dsites4code4main12table__cellsN6recordS2600), (c) => _M0MPC16string10StringView9to__owned(_M0MPC16string10StringView12trim_2einner(c, _M0FP314vlmkit_2dsites4code4main12table__cellsN6recordS2601))));
  }
  function _M0FP314vlmkit_2dsites4code4main12md__headings(src) {
    const out = [];
    let fence = false;
    const _it = _M0MPC16string6String5split(src, _M0FP314vlmkit_2dsites4code4main12md__headingsN6recordS2606);
    while (true) {
      const _bind = _M0MPB4Iter4nextGRPC16string10StringViewE(_it);
      if (_bind === undefined) {
        break;
      } else {
        const _Some = _bind;
        const _line = _Some;
        const l = _M0MPC16string10StringView9to__owned(_line);
        if (_M0MPC16string6String11has__prefix(l, _M0FP314vlmkit_2dsites4code4main12md__headingsN6recordS2607)) {
          fence = !fence;
          continue;
        }
        if (fence) {
          continue;
        }
        const level = _M0MPC16string6String11has__prefix(l, _M0FP314vlmkit_2dsites4code4main12md__headingsN6recordS2608) ? 3 : _M0MPC16string6String11has__prefix(l, _M0FP314vlmkit_2dsites4code4main12md__headingsN6recordS2609) ? 2 : _M0MPC16string6String11has__prefix(l, _M0FP314vlmkit_2dsites4code4main12md__headingsN6recordS2610) ? 1 : 0;
        if (level > 0) {
          const text = _M0MPC16string6String17substring_2einner(l, level + 1 | 0, undefined);
          _M0MPC15array5Array4pushGUssEE(out, { _0: level, _1: text, _2: `md-${_M0FP314vlmkit_2dsites4code4main4slug(text)}` });
        }
        continue;
      }
    }
    return out;
  }
  function _M0FP314vlmkit_2dsites4code4main7svg__el(tag, attrs, kids) {
    const out = [];
    const _bind = attrs.length;
    let _tmp = 0;
    while (true) {
      const _ = _tmp;
      if (_ < _bind) {
        const at = attrs[_];
        _L: {
          _L$2: {
            const _x = at._0;
            if (_x === "class") {
              const _x$2 = at._1;
              if (_x$2.$tag === 0) {
                const _Static = _x$2;
                const _v = _Static._0;
                _M0MPC15array5Array4pushGUssEE(out, { _0: "__ref", _1: new _M0DTP36mizchi4luna3dom9AttrValue7Handler((e) => {
                  _M0FP314vlmkit_2dsites4code4main16set__class__attr(e, _v);
                }) });
              } else {
                break _L$2;
              }
            } else {
              break _L$2;
            }
            break _L;
          }
          _M0MPC15array5Array4pushGUssEE(out, at);
        }
        _tmp = _ + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return _M0FP36mizchi4luna3dom19create__element__ns(_M0FP314vlmkit_2dsites4code4main7svg__ns, tag, out, kids);
  }
  function _M0FP314vlmkit_2dsites4code4main11icon__pathsN1pS2636(d) {
    return _M0FP314vlmkit_2dsites4code4main7svg__el("path", [_M0FP314vlmkit_2dsites4code4main3a__("d", d)], []);
  }
  function _M0FP314vlmkit_2dsites4code4main11icon__pathsN1cS2637(cx, cy, r) {
    return _M0FP314vlmkit_2dsites4code4main7svg__el("circle", [_M0FP314vlmkit_2dsites4code4main3a__("cx", cx), _M0FP314vlmkit_2dsites4code4main3a__("cy", cy), _M0FP314vlmkit_2dsites4code4main3a__("r", r)], []);
  }
  function _M0FP314vlmkit_2dsites4code4main11icon__paths(name) {
    switch (name) {
      case "folder": {
        return [_M0FP314vlmkit_2dsites4code4main7svg__el("path", [_M0FP314vlmkit_2dsites4code4main3a__("d", "M1.5 3h4.2l1.6 1.7h7.2v8.8h-13z"), _M0FP314vlmkit_2dsites4code4main3a__("fill", "currentColor"), _M0FP314vlmkit_2dsites4code4main3a__("stroke", "none")], [])];
      }
      case "file": {
        return [_M0FP314vlmkit_2dsites4code4main11icon__pathsN1pS2636("M3.5 1.5h5.5l3.5 3.5v9.5h-9z"), _M0FP314vlmkit_2dsites4code4main11icon__pathsN1pS2636("M8.5 1.5v4h4")];
      }
      case "code": {
        return [_M0FP314vlmkit_2dsites4code4main11icon__pathsN1pS2636("M5.5 4.5 2 8l3.5 3.5"), _M0FP314vlmkit_2dsites4code4main11icon__pathsN1pS2636("M10.5 4.5 14 8l-3.5 3.5")];
      }
      case "issue": {
        return [_M0FP314vlmkit_2dsites4code4main11icon__pathsN1cS2637("8", "8", "6.5"), _M0FP314vlmkit_2dsites4code4main11icon__pathsN1cS2637("8", "8", "1.2")];
      }
      case "issue-closed": {
        return [_M0FP314vlmkit_2dsites4code4main11icon__pathsN1cS2637("8", "8", "6.5"), _M0FP314vlmkit_2dsites4code4main11icon__pathsN1pS2636("M5.2 8.2 7.2 10.2 10.8 6")];
      }
      case "pr": {
        return [_M0FP314vlmkit_2dsites4code4main11icon__pathsN1cS2637("4", "3.5", "1.6"), _M0FP314vlmkit_2dsites4code4main11icon__pathsN1cS2637("4", "12.5", "1.6"), _M0FP314vlmkit_2dsites4code4main11icon__pathsN1cS2637("12", "12.5", "1.6"), _M0FP314vlmkit_2dsites4code4main11icon__pathsN1pS2636("M4 5.1v5.8"), _M0FP314vlmkit_2dsites4code4main11icon__pathsN1pS2636("M12 10.9V6.5c0-1.4-.8-2.2-2.2-2.2H7.5"), _M0FP314vlmkit_2dsites4code4main11icon__pathsN1pS2636("M9 2.8 7.5 4.3 9 5.8")];
      }
      case "play": {
        return [_M0FP314vlmkit_2dsites4code4main11icon__pathsN1cS2637("8", "8", "6.5"), _M0FP314vlmkit_2dsites4code4main11icon__pathsN1pS2636("M6.5 5.5v5l4-2.5z")];
      }
      case "shield": {
        return [_M0FP314vlmkit_2dsites4code4main11icon__pathsN1pS2636("M8 1.5 13.5 3.5v4c0 3.3-2.3 5.8-5.5 7-3.2-1.2-5.5-3.7-5.5-7v-4z")];
      }
      case "graph": {
        return [_M0FP314vlmkit_2dsites4code4main11icon__pathsN1pS2636("M1.5 14.5h13"), _M0FP314vlmkit_2dsites4code4main11icon__pathsN1pS2636("M2.5 11.5 6 7.5l3 2.5 4.5-6")];
      }
      case "star": {
        return [_M0FP314vlmkit_2dsites4code4main11icon__pathsN1pS2636("M8 1.8l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.6l-3.8 2 .7-4.3-3.1-3 4.3-.6z")];
      }
      case "star-fill": {
        return [_M0FP314vlmkit_2dsites4code4main7svg__el("path", [_M0FP314vlmkit_2dsites4code4main3a__("d", "M8 1.8l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.6l-3.8 2 .7-4.3-3.1-3 4.3-.6z"), _M0FP314vlmkit_2dsites4code4main3a__("fill", "currentColor")], [])];
      }
      case "eye": {
        return [_M0FP314vlmkit_2dsites4code4main11icon__pathsN1pS2636("M1.2 8C2.8 5 5.2 3.5 8 3.5S13.2 5 14.8 8c-1.6 3-4 4.5-6.8 4.5S2.8 11 1.2 8z"), _M0FP314vlmkit_2dsites4code4main11icon__pathsN1cS2637("8", "8", "2")];
      }
      case "fork": {
        return [_M0FP314vlmkit_2dsites4code4main11icon__pathsN1cS2637("4", "3", "1.5"), _M0FP314vlmkit_2dsites4code4main11icon__pathsN1cS2637("12", "3", "1.5"), _M0FP314vlmkit_2dsites4code4main11icon__pathsN1cS2637("8", "13", "1.5"), _M0FP314vlmkit_2dsites4code4main11icon__pathsN1pS2636("M4 4.5v1.2c0 1 .8 1.8 1.8 1.8h4.4c1 0 1.8-.8 1.8-1.8V4.5"), _M0FP314vlmkit_2dsites4code4main11icon__pathsN1pS2636("M8 7.5v4")];
      }
      case "branch": {
        return [_M0FP314vlmkit_2dsites4code4main11icon__pathsN1cS2637("4.5", "3", "1.5"), _M0FP314vlmkit_2dsites4code4main11icon__pathsN1cS2637("4.5", "13", "1.5"), _M0FP314vlmkit_2dsites4code4main11icon__pathsN1cS2637("11.5", "4.5", "1.5"), _M0FP314vlmkit_2dsites4code4main11icon__pathsN1pS2636("M4.5 4.5v7"), _M0FP314vlmkit_2dsites4code4main11icon__pathsN1pS2636("M11.5 6v.5c0 2-1.5 3-3.5 3H6c-.9 0-1.5.6-1.5 1.5")];
      }
      case "tag": {
        return [_M0FP314vlmkit_2dsites4code4main11icon__pathsN1pS2636("M1.5 2.5v5l7 7 6-6-7-7h-5z"), _M0FP314vlmkit_2dsites4code4main11icon__pathsN1cS2637("5", "5", "1.1")];
      }
      case "search": {
        return [_M0FP314vlmkit_2dsites4code4main11icon__pathsN1cS2637("7", "7", "4.8"), _M0FP314vlmkit_2dsites4code4main11icon__pathsN1pS2636("M10.5 10.5 14.5 14.5")];
      }
      case "copy": {
        return [_M0FP314vlmkit_2dsites4code4main11icon__pathsN1pS2636("M5.5 5.5h8v8h-8z"), _M0FP314vlmkit_2dsites4code4main11icon__pathsN1pS2636("M10.5 5.5v-3h-8v8h3")];
      }
      case "check": {
        return [_M0FP314vlmkit_2dsites4code4main11icon__pathsN1pS2636("M3 8.5 6.5 12 13 4.5")];
      }
      case "book": {
        return [_M0FP314vlmkit_2dsites4code4main11icon__pathsN1pS2636("M2 2.5h4.5c.9 0 1.5.6 1.5 1.5v10c0-.8-.7-1.5-1.5-1.5H2z"), _M0FP314vlmkit_2dsites4code4main11icon__pathsN1pS2636("M14 2.5H9.5C8.6 2.5 8 3.1 8 4v10c0-.8.7-1.5 1.5-1.5H14z")];
      }
      case "outline": {
        return [_M0FP314vlmkit_2dsites4code4main11icon__pathsN1pS2636("M2 4h12"), _M0FP314vlmkit_2dsites4code4main11icon__pathsN1pS2636("M5 8h9"), _M0FP314vlmkit_2dsites4code4main11icon__pathsN1pS2636("M5 12h9"), _M0FP314vlmkit_2dsites4code4main11icon__pathsN1pS2636("M2 8h.5"), _M0FP314vlmkit_2dsites4code4main11icon__pathsN1pS2636("M2 12h.5")];
      }
      case "history": {
        return [_M0FP314vlmkit_2dsites4code4main11icon__pathsN1pS2636("M2.5 8a5.5 5.5 0 1 0 1.6-3.9"), _M0FP314vlmkit_2dsites4code4main11icon__pathsN1pS2636("M2 2.5v2.8h2.8"), _M0FP314vlmkit_2dsites4code4main11icon__pathsN1pS2636("M8 5v3.2l2.2 1.4")];
      }
      case "x": {
        return [_M0FP314vlmkit_2dsites4code4main11icon__pathsN1pS2636("M3.5 3.5l9 9"), _M0FP314vlmkit_2dsites4code4main11icon__pathsN1pS2636("M12.5 3.5l-9 9")];
      }
      case "link": {
        return [_M0FP314vlmkit_2dsites4code4main11icon__pathsN1pS2636("M7 9a3 3 0 0 0 4.2 0l2.3-2.3a3 3 0 0 0-4.2-4.2L8.5 3.3"), _M0FP314vlmkit_2dsites4code4main11icon__pathsN1pS2636("M9 7a3 3 0 0 0-4.2 0L2.5 9.3a3 3 0 0 0 4.2 4.2l.8-.8")];
      }
      case "scale": {
        return [_M0FP314vlmkit_2dsites4code4main11icon__pathsN1pS2636("M8 2v12"), _M0FP314vlmkit_2dsites4code4main11icon__pathsN1pS2636("M4.5 14.5h7"), _M0FP314vlmkit_2dsites4code4main11icon__pathsN1pS2636("M2.5 4.5h11"), _M0FP314vlmkit_2dsites4code4main11icon__pathsN1pS2636("M4 4.5 2 9h4z"), _M0FP314vlmkit_2dsites4code4main11icon__pathsN1pS2636("M12 4.5 10 9h4z")];
      }
      case "pulse": {
        return [_M0FP314vlmkit_2dsites4code4main11icon__pathsN1pS2636("M1 8.5h3l2-5 3.5 9 2-4h3.5")];
      }
      case "terminal": {
        return [_M0FP314vlmkit_2dsites4code4main11icon__pathsN1pS2636("M1.5 2.5h13v11h-13z"), _M0FP314vlmkit_2dsites4code4main11icon__pathsN1pS2636("M4 6l2.2 2L4 10"), _M0FP314vlmkit_2dsites4code4main11icon__pathsN1pS2636("M8 10.5h4")];
      }
      case "download": {
        return [_M0FP314vlmkit_2dsites4code4main11icon__pathsN1pS2636("M8 2v8.5"), _M0FP314vlmkit_2dsites4code4main11icon__pathsN1pS2636("M4.5 7.5 8 11l3.5-3.5"), _M0FP314vlmkit_2dsites4code4main11icon__pathsN1pS2636("M2.5 13.5h11")];
      }
      case "comment": {
        return [_M0FP314vlmkit_2dsites4code4main11icon__pathsN1pS2636("M1.5 2.5h13v8.5h-7l-3.5 3v-3h-2.5z")];
      }
      case "menu": {
        return [_M0FP314vlmkit_2dsites4code4main11icon__pathsN1pS2636("M2 4h12"), _M0FP314vlmkit_2dsites4code4main11icon__pathsN1pS2636("M2 8h12"), _M0FP314vlmkit_2dsites4code4main11icon__pathsN1pS2636("M2 12h12")];
      }
      case "person": {
        return [_M0FP314vlmkit_2dsites4code4main11icon__pathsN1cS2637("8", "5", "3"), _M0FP314vlmkit_2dsites4code4main11icon__pathsN1pS2636("M2.5 14.5c.5-3 2.7-4.5 5.5-4.5s5 1.5 5.5 4.5")];
      }
      case "caret": {
        return [_M0FP314vlmkit_2dsites4code4main7svg__el("path", [_M0FP314vlmkit_2dsites4code4main3a__("d", "M4.5 6.5h7L8 10z"), _M0FP314vlmkit_2dsites4code4main3a__("fill", "currentColor"), _M0FP314vlmkit_2dsites4code4main3a__("stroke", "none")], [])];
      }
      case "repo": {
        return [_M0FP314vlmkit_2dsites4code4main11icon__pathsN1pS2636("M3 1.5h10v11H4.5a1.5 1.5 0 0 0 0 3H13"), _M0FP314vlmkit_2dsites4code4main11icon__pathsN1pS2636("M3 1.5v12.5")];
      }
      case "law": {
        return [_M0FP314vlmkit_2dsites4code4main11icon__pathsN1pS2636("M8 2v12"), _M0FP314vlmkit_2dsites4code4main11icon__pathsN1pS2636("M2.5 4.5h11")];
      }
      case "up": {
        return [_M0FP314vlmkit_2dsites4code4main11icon__pathsN1pS2636("M8 13V3"), _M0FP314vlmkit_2dsites4code4main11icon__pathsN1pS2636("M4 7l4-4 4 4")];
      }
      case "dots": {
        return [_M0FP314vlmkit_2dsites4code4main11icon__pathsN1cS2637("3.5", "8", ".6"), _M0FP314vlmkit_2dsites4code4main11icon__pathsN1cS2637("8", "8", ".6"), _M0FP314vlmkit_2dsites4code4main11icon__pathsN1cS2637("12.5", "8", ".6")];
      }
      case "wrap": {
        return [_M0FP314vlmkit_2dsites4code4main11icon__pathsN1pS2636("M2 4h12"), _M0FP314vlmkit_2dsites4code4main11icon__pathsN1pS2636("M2 8h9.5a2 2 0 0 1 0 4H8"), _M0FP314vlmkit_2dsites4code4main11icon__pathsN1pS2636("M9.5 10.5 8 12l1.5 1.5"), _M0FP314vlmkit_2dsites4code4main11icon__pathsN1pS2636("M2 12h3")];
      }
      case "file-code": {
        return [_M0FP314vlmkit_2dsites4code4main11icon__pathsN1pS2636("M3.5 1.5h5.5l3.5 3.5v9.5h-9z"), _M0FP314vlmkit_2dsites4code4main11icon__pathsN1pS2636("M6.5 8 5 9.5 6.5 11"), _M0FP314vlmkit_2dsites4code4main11icon__pathsN1pS2636("M9.5 8 11 9.5 9.5 11")];
      }
      default: {
        return [_M0FP314vlmkit_2dsites4code4main11icon__pathsN1cS2637("8", "8", "6")];
      }
    }
  }
  function _M0FP314vlmkit_2dsites4code4main7icon__c(name, klass) {
    return _M0FP314vlmkit_2dsites4code4main7svg__el("svg", [_M0FP314vlmkit_2dsites4code4main3a__("viewBox", "0 0 16 16"), _M0FP314vlmkit_2dsites4code4main3a__("width", "16"), _M0FP314vlmkit_2dsites4code4main3a__("height", "16"), _M0FP314vlmkit_2dsites4code4main3a__("fill", "none"), _M0FP314vlmkit_2dsites4code4main3a__("stroke", "currentColor"), _M0FP314vlmkit_2dsites4code4main3a__("stroke-width", "1.5"), _M0FP314vlmkit_2dsites4code4main3a__("stroke-linecap", "round"), _M0FP314vlmkit_2dsites4code4main3a__("stroke-linejoin", "round"), _M0FP314vlmkit_2dsites4code4main3a__("aria-hidden", "true"), _M0FP314vlmkit_2dsites4code4main3a__("focusable", "false"), _M0FP314vlmkit_2dsites4code4main3cls(klass)], _M0FP314vlmkit_2dsites4code4main11icon__paths(name));
  }
  function _M0FP314vlmkit_2dsites4code4main4icon(name) {
    return _M0FP314vlmkit_2dsites4code4main7icon__c(name, "ic");
  }
  function _M0FP314vlmkit_2dsites4code4main2on(name, f) {
    return { _0: name, _1: new _M0DTP36mizchi4luna3dom9AttrValue7Handler(f) };
  }
  function _M0FP314vlmkit_2dsites4code4main2td(f) {
    return _M0FP36mizchi4luna3dom9text__dyn(f);
  }
  function _M0FP314vlmkit_2dsites4code4main12copy__button(key, text, label) {
    return _M0FP314vlmkit_2dsites4code4main2el("span", [_M0FP314vlmkit_2dsites4code4main3cls("copy-wrap")], [_M0FP314vlmkit_2dsites4code4main2el("button", [_M0FP314vlmkit_2dsites4code4main3a__("type", "button"), _M0FP314vlmkit_2dsites4code4main3cls("btn btn-icon copy-btn"), _M0FP314vlmkit_2dsites4code4main3a__("aria-label", label), _M0FP314vlmkit_2dsites4code4main2on("click", (_e) => {
      _M0FP314vlmkit_2dsites4code4main10copy__text(text);
      _M0MP26mizchi7signals6Signal3setGsE(_M0FP314vlmkit_2dsites4code4main6copied, key);
      _M0FP314vlmkit_2dsites4code4main5later(1800, () => {
        if (_M0MP26mizchi7signals6Signal3getGsE(_M0FP314vlmkit_2dsites4code4main6copied) === key) {
          _M0MP26mizchi7signals6Signal3setGsE(_M0FP314vlmkit_2dsites4code4main6copied, "");
          return;
        } else {
          return;
        }
      });
    })], [_M0FP36mizchi4luna3dom4show(() => {
      const _p = _M0MP26mizchi7signals6Signal3getGsE(_M0FP314vlmkit_2dsites4code4main6copied);
      return !(_p === key);
    }, () => _M0FP314vlmkit_2dsites4code4main4icon("copy")), _M0FP36mizchi4luna3dom4show(() => _M0MP26mizchi7signals6Signal3getGsE(_M0FP314vlmkit_2dsites4code4main6copied) === key, () => _M0FP314vlmkit_2dsites4code4main7icon__c("check", "ic ic-ok"))]), _M0FP314vlmkit_2dsites4code4main2el("span", [_M0FP314vlmkit_2dsites4code4main3cls("tooltip"), _M0FP314vlmkit_2dsites4code4main3a__("role", "status")], [_M0FP314vlmkit_2dsites4code4main2td(() => _M0MP26mizchi7signals6Signal3getGsE(_M0FP314vlmkit_2dsites4code4main6copied) === key ? "Copied!" : "")])]);
  }
  function _M0FP314vlmkit_2dsites4code4main12token__nodes(toks) {
    const _p = new Array(toks.length);
    const _p$2 = toks.length;
    let _tmp = 0;
    while (true) {
      const _p$3 = _tmp;
      if (_p$3 < _p$2) {
        const _p$4 = toks[_p$3];
        const _p$5 = _p$4._0;
        const _p$6 = _p$4._1;
        _p[_p$3] = _p$5 === "" ? _M0FP314vlmkit_2dsites4code4main1t(_p$6) : _M0FP314vlmkit_2dsites4code4main2el("span", [_M0FP314vlmkit_2dsites4code4main3cls(_p$5)], [_M0FP314vlmkit_2dsites4code4main1t(_p$6)]);
        _tmp = _p$3 + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return _p;
  }
  function _M0FP314vlmkit_2dsites4code4main9is__ident(ch) {
    return _M0MPC14char4Char21is__ascii__alphabetic(ch) || (_M0MPC14char4Char16is__ascii__digit(ch) || (ch === 95 || ch === 36));
  }
  function _M0FP314vlmkit_2dsites4code4main6tokensN11push__plainS2658(_env, upto) {
    const out = _env._2;
    const plain = _env._1;
    const cs = _env._0;
    if (upto > plain.val) {
      _M0MPC15array5Array4pushGUssEE(out, { _0: "", _1: _M0FP314vlmkit_2dsites4code4main7str__of(cs, plain.val, upto) });
      return;
    } else {
      return;
    }
  }
  function _M0FP314vlmkit_2dsites4code4main6tokens(line, lang, in_block) {
    const cs = _M0FP314vlmkit_2dsites4code4main9chars__of(line);
    const out = [];
    const n = cs.length;
    let i = 0;
    const plain = new _M0TPB8MutLocalGiE(0);
    const _env = { _0: cs, _1: plain, _2: out };
    if (lang === "text") {
      return [{ _0: "", _1: line }];
    }
    if (lang === "md") {
      if (_M0MPC16string6String11has__prefix(line, _M0FP314vlmkit_2dsites4code4main6tokensN6recordS2659)) {
        return [{ _0: "tk-k", _1: line }];
      }
      return [{ _0: "", _1: line }];
    }
    while (true) {
      if (i < n) {
        const ch = _M0MPC15array5Array2atGcE(cs, i);
        if (in_block.val) {
          const start = i;
          while (true) {
            if (i < n && !(_M0MPC15array5Array2atGcE(cs, i) === 42 && ((i + 1 | 0) < n && _M0MPC15array5Array2atGcE(cs, i + 1 | 0) === 47))) {
              i = i + 1 | 0;
              continue;
            } else {
              break;
            }
          }
          if (i < n) {
            i = i + 2 | 0;
            in_block.val = false;
          }
          _M0MPC15array5Array4pushGUssEE(out, { _0: "tk-c", _1: _M0FP314vlmkit_2dsites4code4main7str__of(cs, start, i) });
          plain.val = i;
          continue;
        }
        if (lang === "ts" && (ch === 47 && ((i + 1 | 0) < n && _M0MPC15array5Array2atGcE(cs, i + 1 | 0) === 47))) {
          _M0FP314vlmkit_2dsites4code4main6tokensN11push__plainS2658(_env, i);
          _M0MPC15array5Array4pushGUssEE(out, { _0: "tk-c", _1: _M0FP314vlmkit_2dsites4code4main7str__of(cs, i, n) });
          return out;
        }
        if (lang === "ts" && (ch === 47 && ((i + 1 | 0) < n && _M0MPC15array5Array2atGcE(cs, i + 1 | 0) === 42))) {
          _M0FP314vlmkit_2dsites4code4main6tokensN11push__plainS2658(_env, i);
          in_block.val = true;
          plain.val = i;
          continue;
        }
        if (lang === "hash" && (ch === 35 && (i === 0 || _M0MPC15array5Array2atGcE(cs, i - 1 | 0) === 32))) {
          _M0FP314vlmkit_2dsites4code4main6tokensN11push__plainS2658(_env, i);
          _M0MPC15array5Array4pushGUssEE(out, { _0: "tk-c", _1: _M0FP314vlmkit_2dsites4code4main7str__of(cs, i, n) });
          return out;
        }
        if (ch === 34 || (ch === 39 || ch === 96)) {
          _M0FP314vlmkit_2dsites4code4main6tokensN11push__plainS2658(_env, i);
          const start = i;
          i = i + 1 | 0;
          while (true) {
            if (i < n && _M0MPC15array5Array2atGcE(cs, i) !== ch) {
              if (_M0MPC15array5Array2atGcE(cs, i) === 92) {
                i = i + 1 | 0;
              }
              i = i + 1 | 0;
              continue;
            } else {
              break;
            }
          }
          i = i < n ? i + 1 | 0 : n;
          _M0MPC15array5Array4pushGUssEE(out, { _0: "tk-s", _1: _M0FP314vlmkit_2dsites4code4main7str__of(cs, start, i) });
          plain.val = i;
          continue;
        }
        if (_M0MPC14char4Char16is__ascii__digit(ch) && (i === 0 || !_M0FP314vlmkit_2dsites4code4main9is__ident(_M0MPC15array5Array2atGcE(cs, i - 1 | 0)))) {
          _M0FP314vlmkit_2dsites4code4main6tokensN11push__plainS2658(_env, i);
          const start = i;
          while (true) {
            if (i < n && (_M0MPC14char4Char16is__ascii__digit(_M0MPC15array5Array2atGcE(cs, i)) || _M0MPC15array5Array2atGcE(cs, i) === 46)) {
              i = i + 1 | 0;
              continue;
            } else {
              break;
            }
          }
          _M0MPC15array5Array4pushGUssEE(out, { _0: "tk-n", _1: _M0FP314vlmkit_2dsites4code4main7str__of(cs, start, i) });
          plain.val = i;
          continue;
        }
        if (_M0FP314vlmkit_2dsites4code4main9is__ident(ch) && (i === 0 || !_M0FP314vlmkit_2dsites4code4main9is__ident(_M0MPC15array5Array2atGcE(cs, i - 1 | 0)))) {
          const start = i;
          while (true) {
            if (i < n && _M0FP314vlmkit_2dsites4code4main9is__ident(_M0MPC15array5Array2atGcE(cs, i))) {
              i = i + 1 | 0;
              continue;
            } else {
              break;
            }
          }
          const word = _M0FP314vlmkit_2dsites4code4main7str__of(cs, start, i);
          if (lang === "ts" && _M0MPC15array5Array8containsGsE(_M0FP314vlmkit_2dsites4code4main12ts__keywords, word)) {
            _M0FP314vlmkit_2dsites4code4main6tokensN11push__plainS2658(_env, start);
            _M0MPC15array5Array4pushGUssEE(out, { _0: "tk-k", _1: word });
            plain.val = i;
          } else {
            if (lang === "hash" && (i < n && (_M0MPC15array5Array2atGcE(cs, i) === 58 && _M0MPC16string6String11has__prefix(_M0MPC16string10StringView9to__owned(_M0MPC16string6String19trim__start_2einner(line, _M0FP314vlmkit_2dsites4code4main6tokensN6recordS2660)), new _M0TPC16string10StringView(word, 0, word.length))))) {
              _M0FP314vlmkit_2dsites4code4main6tokensN11push__plainS2658(_env, start);
              _M0MPC15array5Array4pushGUssEE(out, { _0: "tk-k", _1: word });
              plain.val = i;
            }
          }
          continue;
        }
        i = i + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    _M0FP314vlmkit_2dsites4code4main6tokensN11push__plainS2658(_env, n);
    return out;
  }
  function _M0FP314vlmkit_2dsites4code4main15highlight__text(code, lang) {
    const state = _M0MPC13ref3Ref3RefGbE(false);
    const l = lang === "sh" ? "hash" : lang;
    const out = [];
    const lines = _M0MPB4Iter9to__arrayGRPC16string10StringViewE(_M0MPB4Iter3mapGRPC16string10StringViewsE(_M0MPC16string6String5split(code, _M0FP314vlmkit_2dsites4code4main15highlight__textN6recordS2686), (s) => _M0MPC16string10StringView9to__owned(s)));
    const _bind = lines.length;
    let _tmp = 0;
    while (true) {
      const i = _tmp;
      if (i < _bind) {
        const line = lines[i];
        const _bind$2 = _M0FP314vlmkit_2dsites4code4main12token__nodes(_M0FP314vlmkit_2dsites4code4main6tokens(line, l, state));
        const _bind$3 = _bind$2.length;
        let _tmp$2 = 0;
        while (true) {
          const _ = _tmp$2;
          if (_ < _bind$3) {
            const nd = _bind$2[_];
            _M0MPC15array5Array4pushGUssEE(out, nd);
            _tmp$2 = _ + 1 | 0;
            continue;
          } else {
            break;
          }
        }
        if ((i + 1 | 0) < lines.length) {
          _M0MPC15array5Array4pushGUssEE(out, _M0FP314vlmkit_2dsites4code4main1t("\n"));
        }
        _tmp = i + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return out;
  }
  function _M0FP314vlmkit_2dsites4code4main11code__block(code, lang, key) {
    return _M0FP314vlmkit_2dsites4code4main2el("div", [_M0FP314vlmkit_2dsites4code4main3cls("md-code")], [_M0FP314vlmkit_2dsites4code4main2el("pre", [_M0FP314vlmkit_2dsites4code4main3a__("tabindex", "0"), _M0FP314vlmkit_2dsites4code4main3a__("aria-label", "Code example")], [_M0FP314vlmkit_2dsites4code4main2el("code", [], _M0FP314vlmkit_2dsites4code4main15highlight__text(code, lang))]), _M0FP314vlmkit_2dsites4code4main12copy__button(key, code, "Copy code")]);
  }
  function _M0FP314vlmkit_2dsites4code4main11is__ordered(l) {
    const cs = _M0FP314vlmkit_2dsites4code4main9chars__of(l);
    let i = 0;
    while (true) {
      if (i < cs.length && _M0MPC14char4Char16is__ascii__digit(_M0MPC15array5Array2atGcE(cs, i))) {
        i = i + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return i > 0 && ((i + 1 | 0) < cs.length && (_M0MPC15array5Array2atGcE(cs, i) === 46 && _M0MPC15array5Array2atGcE(cs, i + 1 | 0) === 32));
  }
  function _M0FP314vlmkit_2dsites4code4main10md__blocksN11flush__paraS2710(_env) {
    const para = _env._1;
    const out = _env._0;
    if (para.length > 0) {
      _M0MPC15array5Array4pushGUssEE(out, _M0FP314vlmkit_2dsites4code4main2el("p", [], _M0FP314vlmkit_2dsites4code4main10md__inline(_M0MPC15array5Array4joinGsE(para, _M0FP314vlmkit_2dsites4code4main10md__blocksN6recordS2712))));
      _M0MPC15array5Array5clearGRP26mizchi7signals5OwnerE(para);
      return;
    } else {
      return;
    }
  }
  function _M0FP314vlmkit_2dsites4code4main10md__blocks(src, copy_key) {
    const lines = _M0MPB4Iter9to__arrayGRPC16string10StringViewE(_M0MPB4Iter3mapGRPC16string10StringViewsE(_M0MPC16string6String5split(src, _M0FP314vlmkit_2dsites4code4main10md__blocksN6recordS2711), (l) => _M0MPC16string10StringView9to__owned(l)));
    const out = [];
    const para = [];
    const _env = { _0: out, _1: para };
    let i = 0;
    let code_n = 0;
    while (true) {
      if (i < lines.length) {
        const l = _M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(lines, i);
        if (_M0MPC16string6String11has__prefix(l, _M0FP314vlmkit_2dsites4code4main10md__blocksN6recordS2713)) {
          _M0FP314vlmkit_2dsites4code4main10md__blocksN11flush__paraS2710(_env);
          const lang = _M0MPC16string6String17substring_2einner(l, 3, undefined);
          const body = [];
          i = i + 1 | 0;
          while (true) {
            if (i < lines.length && !_M0MPC16string6String11has__prefix(_M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(lines, i), _M0FP314vlmkit_2dsites4code4main10md__blocksN6recordS2714)) {
              _M0MPC15array5Array4pushGUssEE(body, _M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(lines, i));
              i = i + 1 | 0;
              continue;
            } else {
              break;
            }
          }
          i = i + 1 | 0;
          code_n = code_n + 1 | 0;
          _M0MPC15array5Array4pushGUssEE(out, _M0FP314vlmkit_2dsites4code4main11code__block(_M0MPC15array5Array4joinGsE(body, _M0FP314vlmkit_2dsites4code4main10md__blocksN6recordS2715), lang, `${copy_key}-${_M0MPC13int3Int18to__string_2einner(code_n, 10)}`));
          continue;
        }
        const level = _M0MPC16string6String11has__prefix(l, _M0FP314vlmkit_2dsites4code4main10md__blocksN6recordS2716) ? 3 : _M0MPC16string6String11has__prefix(l, _M0FP314vlmkit_2dsites4code4main10md__blocksN6recordS2717) ? 2 : _M0MPC16string6String11has__prefix(l, _M0FP314vlmkit_2dsites4code4main10md__blocksN6recordS2718) ? 1 : 0;
        if (level > 0) {
          _M0FP314vlmkit_2dsites4code4main10md__blocksN11flush__paraS2710(_env);
          const text = _M0MPC16string6String17substring_2einner(l, level + 1 | 0, undefined);
          _M0MPC15array5Array4pushGUssEE(out, _M0FP314vlmkit_2dsites4code4main2el(`h${_M0MPC13int3Int18to__string_2einner(level, 10)}`, [_M0FP314vlmkit_2dsites4code4main3a__("id", `md-${_M0FP314vlmkit_2dsites4code4main4slug(text)}`), _M0FP314vlmkit_2dsites4code4main3cls("md-h")], [_M0FP314vlmkit_2dsites4code4main1t(text)]));
          i = i + 1 | 0;
          continue;
        }
        if (_M0MPC16string6String11has__prefix(l, _M0FP314vlmkit_2dsites4code4main10md__blocksN6recordS2719)) {
          _M0FP314vlmkit_2dsites4code4main10md__blocksN11flush__paraS2710(_env);
          const head = _M0FP314vlmkit_2dsites4code4main12table__cells(l);
          const rows = [];
          i = i + 1 | 0;
          if (i < lines.length && _M0MPC16string6String11has__prefix(_M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(lines, i), _M0FP314vlmkit_2dsites4code4main10md__blocksN6recordS2720)) {
            i = i + 1 | 0;
          }
          while (true) {
            if (i < lines.length && _M0MPC16string6String11has__prefix(_M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(lines, i), _M0FP314vlmkit_2dsites4code4main10md__blocksN6recordS2721)) {
              _M0MPC15array5Array4pushGRP36mizchi11js__browser3dom4NodeE(rows, _M0FP314vlmkit_2dsites4code4main12table__cells(_M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(lines, i)));
              i = i + 1 | 0;
              continue;
            } else {
              break;
            }
          }
          const _tmp = [_M0FP314vlmkit_2dsites4code4main3cls("md-table-wrap")];
          const _tmp$2 = [_M0FP314vlmkit_2dsites4code4main3cls("md-table")];
          const _tmp$3 = [];
          const _tmp$4 = [];
          const _p = new Array(head.length);
          const _p$2 = head.length;
          let _tmp$5 = 0;
          while (true) {
            const _p$3 = _tmp$5;
            if (_p$3 < _p$2) {
              const _p$4 = head[_p$3];
              _p[_p$3] = _M0FP314vlmkit_2dsites4code4main2el("th", [_M0FP314vlmkit_2dsites4code4main3a__("scope", "col")], _M0FP314vlmkit_2dsites4code4main10md__inline(_p$4));
              _tmp$5 = _p$3 + 1 | 0;
              continue;
            } else {
              break;
            }
          }
          const _tmp$6 = _M0FP314vlmkit_2dsites4code4main2el("thead", _tmp$3, [_M0FP314vlmkit_2dsites4code4main2el("tr", _tmp$4, _p)]);
          const _tmp$7 = [];
          const _p$3 = new Array(rows.length);
          const _p$4 = rows.length;
          let _tmp$8 = 0;
          while (true) {
            const _p$5 = _tmp$8;
            if (_p$5 < _p$4) {
              const _p$6 = rows[_p$5];
              const _tmp$9 = [];
              const _p$7 = new Array(_p$6.length);
              const _p$8 = _p$6.length;
              let _tmp$10 = 0;
              while (true) {
                const _p$9 = _tmp$10;
                if (_p$9 < _p$8) {
                  const _p$10 = _p$6[_p$9];
                  _p$7[_p$9] = _M0FP314vlmkit_2dsites4code4main2el("td", [], _M0FP314vlmkit_2dsites4code4main10md__inline(_p$10));
                  _tmp$10 = _p$9 + 1 | 0;
                  continue;
                } else {
                  break;
                }
              }
              _p$3[_p$5] = _M0FP314vlmkit_2dsites4code4main2el("tr", _tmp$9, _p$7);
              _tmp$8 = _p$5 + 1 | 0;
              continue;
            } else {
              break;
            }
          }
          _M0MPC15array5Array4pushGUssEE(out, _M0FP314vlmkit_2dsites4code4main2el("div", _tmp, [_M0FP314vlmkit_2dsites4code4main2el("table", _tmp$2, [_tmp$6, _M0FP314vlmkit_2dsites4code4main2el("tbody", _tmp$7, _p$3)])]));
          continue;
        }
        if (_M0MPC16string6String11has__prefix(l, _M0FP314vlmkit_2dsites4code4main10md__blocksN6recordS2722)) {
          _M0FP314vlmkit_2dsites4code4main10md__blocksN11flush__paraS2710(_env);
          const items = [];
          while (true) {
            if (i < lines.length && _M0MPC16string6String11has__prefix(_M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(lines, i), _M0FP314vlmkit_2dsites4code4main10md__blocksN6recordS2723)) {
              _M0MPC15array5Array4pushGUssEE(items, _M0MPC16string6String17substring_2einner(_M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(lines, i), 2, undefined));
              i = i + 1 | 0;
              continue;
            } else {
              break;
            }
          }
          const is_task = items.length > 0 && _M0MPC16string6String11has__prefix(_M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(items, 0), _M0FP314vlmkit_2dsites4code4main10md__blocksN6recordS2724);
          if (is_task) {
            const _tmp = [_M0FP314vlmkit_2dsites4code4main3cls("md-tasks")];
            const _p = new Array(items.length);
            const _p$2 = items.length;
            let _tmp$2 = 0;
            while (true) {
              const _p$3 = _tmp$2;
              if (_p$3 < _p$2) {
                const _p$4 = items[_p$3];
                const _p$5 = _M0MPC16string6String11has__prefix(_p$4, _M0FP314vlmkit_2dsites4code4main10md__blocksN6recordS2725);
                const _p$6 = _M0MPC16string6String17substring_2einner(_p$4, 4, undefined);
                _p[_p$3] = _M0FP314vlmkit_2dsites4code4main2el("li", [_M0FP314vlmkit_2dsites4code4main3cls(_p$5 ? "task done" : "task")], [_M0FP314vlmkit_2dsites4code4main2el("span", [_M0FP314vlmkit_2dsites4code4main3cls("task-box"), _M0FP314vlmkit_2dsites4code4main3a__("role", "img"), _M0FP314vlmkit_2dsites4code4main3a__("aria-label", _p$5 ? "Done:" : "To do:")], _p$5 ? [_M0FP314vlmkit_2dsites4code4main4icon("check")] : []), _M0FP314vlmkit_2dsites4code4main2el("span", [], _M0FP314vlmkit_2dsites4code4main10md__inline(_p$6))]);
                _tmp$2 = _p$3 + 1 | 0;
                continue;
              } else {
                break;
              }
            }
            _M0MPC15array5Array4pushGUssEE(out, _M0FP314vlmkit_2dsites4code4main2el("ul", _tmp, _p));
          } else {
            const _tmp = [];
            const _p = new Array(items.length);
            const _p$2 = items.length;
            let _tmp$2 = 0;
            while (true) {
              const _p$3 = _tmp$2;
              if (_p$3 < _p$2) {
                const _p$4 = items[_p$3];
                _p[_p$3] = _M0FP314vlmkit_2dsites4code4main2el("li", [], _M0FP314vlmkit_2dsites4code4main10md__inline(_p$4));
                _tmp$2 = _p$3 + 1 | 0;
                continue;
              } else {
                break;
              }
            }
            _M0MPC15array5Array4pushGUssEE(out, _M0FP314vlmkit_2dsites4code4main2el("ul", _tmp, _p));
          }
          continue;
        }
        if (_M0FP314vlmkit_2dsites4code4main11is__ordered(l)) {
          _M0FP314vlmkit_2dsites4code4main10md__blocksN11flush__paraS2710(_env);
          const items = [];
          while (true) {
            if (i < lines.length && _M0FP314vlmkit_2dsites4code4main11is__ordered(_M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(lines, i))) {
              const _bind = _M0MPC16string6String4find(_M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(lines, i), _M0FP314vlmkit_2dsites4code4main10md__blocksN6recordS2726);
              if (_bind === undefined) {
                _M0MPC15array5Array4pushGUssEE(items, _M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(lines, i));
              } else {
                const _Some = _bind;
                const _at = _Some;
                _M0MPC15array5Array4pushGUssEE(items, _M0MPC16string6String17substring_2einner(_M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(lines, i), _at + 2 | 0, undefined));
              }
              i = i + 1 | 0;
              continue;
            } else {
              break;
            }
          }
          const _tmp = [];
          const _p = new Array(items.length);
          const _p$2 = items.length;
          let _tmp$2 = 0;
          while (true) {
            const _p$3 = _tmp$2;
            if (_p$3 < _p$2) {
              const _p$4 = items[_p$3];
              _p[_p$3] = _M0FP314vlmkit_2dsites4code4main2el("li", [], _M0FP314vlmkit_2dsites4code4main10md__inline(_p$4));
              _tmp$2 = _p$3 + 1 | 0;
              continue;
            } else {
              break;
            }
          }
          _M0MPC15array5Array4pushGUssEE(out, _M0FP314vlmkit_2dsites4code4main2el("ol", _tmp, _p));
          continue;
        }
        if (_M0MPC16string6String11has__prefix(l, _M0FP314vlmkit_2dsites4code4main10md__blocksN6recordS2727)) {
          _M0FP314vlmkit_2dsites4code4main10md__blocksN11flush__paraS2710(_env);
          _M0MPC15array5Array4pushGUssEE(out, _M0FP314vlmkit_2dsites4code4main2el("blockquote", [], _M0FP314vlmkit_2dsites4code4main10md__inline(_M0MPC16string6String17substring_2einner(l, 2, undefined))));
          i = i + 1 | 0;
          continue;
        }
        if (_M0MPC16string10StringView9to__owned(_M0MPC16string6String12trim_2einner(l, _M0FP314vlmkit_2dsites4code4main10md__blocksN6recordS2728)) === "") {
          _M0FP314vlmkit_2dsites4code4main10md__blocksN11flush__paraS2710(_env);
        } else {
          if (_M0MPC16string6String11has__prefix(l, _M0FP314vlmkit_2dsites4code4main10md__blocksN6recordS2729)) {
            _M0FP314vlmkit_2dsites4code4main10md__blocksN11flush__paraS2710(_env);
            _M0MPC15array5Array4pushGUssEE(out, _M0FP314vlmkit_2dsites4code4main2el("p", [_M0FP314vlmkit_2dsites4code4main3cls("badges")], _M0FP314vlmkit_2dsites4code4main10md__inline(l)));
          } else {
            _M0MPC15array5Array4pushGUssEE(para, l);
          }
        }
        i = i + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    _M0FP314vlmkit_2dsites4code4main10md__blocksN11flush__paraS2710(_env);
    return out;
  }
  function _M0FP314vlmkit_2dsites4code4main9q__tokens(q) {
    const out = [];
    const buf = _M0MPB13StringBuilder21StringBuilder_2einner(8);
    let quoted = false;
    const _bind = q.length;
    let _tmp = 0;
    while (true) {
      const _string_index = _tmp;
      if (_string_index < _bind) {
        let _decoded_next_string_index;
        let _decoded_char;
        _L: {
          const _bind$2 = q.charCodeAt(_string_index);
          if (_bind$2 >= 55296 && _bind$2 <= 56319 && (_string_index + 1 | 0) < _bind) {
            const _bind$3 = q.charCodeAt(_string_index + 1 | 0);
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
        if (_decoded_char === 34) {
          quoted = !quoted;
          _M0IPB13StringBuilderPB6Logger11write__char(buf, _decoded_char);
        } else {
          if (_decoded_char === 32 && !quoted) {
            const s = buf.val;
            const _p = "";
            if (!(s === _p)) {
              _M0MPC15array5Array4pushGUssEE(out, s);
            }
            _M0MPB13StringBuilder13reset_2einner(buf, true);
          } else {
            _M0IPB13StringBuilderPB6Logger11write__char(buf, _decoded_char);
          }
        }
        _tmp = _decoded_next_string_index;
        continue;
      } else {
        break;
      }
    }
    const s = buf.val;
    const _p = "";
    if (!(s === _p)) {
      _M0MPC15array5Array4pushGUssEE(out, s);
    }
    return out;
  }
  function _M0FP314vlmkit_2dsites4code4main6q__get(q, key) {
    const _bind = _M0FP314vlmkit_2dsites4code4main9q__tokens(q);
    const _bind$2 = _bind.length;
    let _tmp = 0;
    while (true) {
      const _ = _tmp;
      if (_ < _bind$2) {
        const tk = _bind[_];
        const _bind$3 = `${key}:`;
        if (_M0MPC16string6String11has__prefix(tk, new _M0TPC16string10StringView(_bind$3, 0, _bind$3.length))) {
          return _M0MPC16string6String12replace__all(_M0MPC16string6String17substring_2einner(tk, key.length + 1 | 0, undefined), _M0FP314vlmkit_2dsites4code4main6q__getN6recordS2782, _M0FP314vlmkit_2dsites4code4main6q__getN6recordS2783);
        }
        _tmp = _ + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return "";
  }
  function _M0FP314vlmkit_2dsites4code4main6q__set(q, key, v) {
    const _p = _M0FP314vlmkit_2dsites4code4main9q__tokens(q);
    const _p$2 = [];
    const _p$3 = _p.length;
    let out;
    let _tmp = 0;
    while (true) {
      const _p$4 = _tmp;
      if (_p$4 < _p$3) {
        const _p$5 = _p[_p$4];
        let _tmp$2;
        const _p$6 = `${key}:`;
        if (!_M0MPC16string6String11has__prefix(_p$5, new _M0TPC16string10StringView(_p$6, 0, _p$6.length))) {
          _tmp$2 = true;
        } else {
          _tmp$2 = key === "is" && _p$5 === "is:issue";
        }
        if (_tmp$2) {
          _M0MPC15array5Array4pushGUssEE(_p$2, _p$5);
        }
        _tmp = _p$4 + 1 | 0;
        continue;
      } else {
        out = _p$2;
        break;
      }
    }
    const _p$4 = "";
    if (!(v === _p$4)) {
      _M0MPC15array5Array4pushGUssEE(out, `${key}:${_M0MPC16string6String8contains(v, _M0FP314vlmkit_2dsites4code4main6q__setN6recordS2792) ? `\"${v}\"` : v}`);
    }
    return _M0MPC15array5Array4joinGsE(out, _M0FP314vlmkit_2dsites4code4main6q__setN6recordS2793);
  }
  function _M0FP314vlmkit_2dsites4code4main7q__text(q) {
    const _p = _M0FP314vlmkit_2dsites4code4main9q__tokens(q);
    const _p$2 = [];
    const _p$3 = _p.length;
    let _tmp;
    let _tmp$2 = 0;
    while (true) {
      const _p$4 = _tmp$2;
      if (_p$4 < _p$3) {
        const _p$5 = _p[_p$4];
        if (!_M0MPC16string6String8contains(_p$5, _M0FP314vlmkit_2dsites4code4main7q__textN6recordS2800)) {
          _M0MPC15array5Array4pushGUssEE(_p$2, _p$5);
        }
        _tmp$2 = _p$4 + 1 | 0;
        continue;
      } else {
        _tmp = _p$2;
        break;
      }
    }
    return _M0MPC16string6String9to__lower(_M0MPC15array5Array4joinGsE(_tmp, _M0FP314vlmkit_2dsites4code4main7q__textN6recordS2801));
  }
  function _M0FP314vlmkit_2dsites4code4main7set__iq(q) {
    _M0MP26mizchi7signals6Signal3setGsE(_M0FP314vlmkit_2dsites4code4main2iq, q);
    _M0FP314vlmkit_2dsites4code4main10set__value("#issue-search", q);
  }
  function _M0FP314vlmkit_2dsites4code4main14issue__matches(i, q, with_state) {
    const state = _M0FP314vlmkit_2dsites4code4main6q__get(q, "state");
    const _p = _M0FP314vlmkit_2dsites4code4main9q__tokens(q);
    const _p$2 = [];
    const _p$3 = _p.length;
    let is_;
    let _tmp = 0;
    while (true) {
      const _p$4 = _tmp;
      if (_p$4 < _p$3) {
        const _p$5 = _p[_p$4];
        if (_p$5 === "is:open" || _p$5 === "is:closed") {
          _M0MPC15array5Array4pushGUssEE(_p$2, _p$5);
        }
        _tmp = _p$4 + 1 | 0;
        continue;
      } else {
        is_ = _p$2;
        break;
      }
    }
    let want_open;
    if (is_.length > 0) {
      want_open = _M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(is_, 0) === "is:open";
    } else {
      const _p$4 = "closed";
      want_open = !(state === _p$4);
    }
    let _tmp$2;
    if (with_state) {
      const _p$4 = i.open_;
      _tmp$2 = !(_p$4 === want_open);
    } else {
      _tmp$2 = false;
    }
    if (_tmp$2) {
      return false;
    }
    const author = _M0FP314vlmkit_2dsites4code4main6q__get(q, "author");
    let _tmp$3;
    const _p$4 = "";
    if (!(author === _p$4)) {
      const _p$5 = i.author;
      _tmp$3 = !(_p$5 === author);
    } else {
      _tmp$3 = false;
    }
    if (_tmp$3) {
      return false;
    }
    const label = _M0FP314vlmkit_2dsites4code4main6q__get(q, "label");
    let _tmp$4;
    const _p$5 = "";
    if (!(label === _p$5)) {
      _tmp$4 = !_M0MPC15array5Array8containsGsE(i.labels, label);
    } else {
      _tmp$4 = false;
    }
    if (_tmp$4) {
      return false;
    }
    const ms = _M0FP314vlmkit_2dsites4code4main6q__get(q, "milestone");
    let _tmp$5;
    const _p$6 = "";
    if (!(ms === _p$6)) {
      const _p$7 = i.milestone;
      _tmp$5 = !(_p$7 === ms);
    } else {
      _tmp$5 = false;
    }
    if (_tmp$5) {
      return false;
    }
    const asg = _M0FP314vlmkit_2dsites4code4main6q__get(q, "assignee");
    let _tmp$6;
    const _p$7 = "";
    if (!(asg === _p$7)) {
      const _p$8 = i.assignee;
      _tmp$6 = !(_p$8 === asg);
    } else {
      _tmp$6 = false;
    }
    if (_tmp$6) {
      return false;
    }
    const pj = _M0FP314vlmkit_2dsites4code4main6q__get(q, "project");
    let _tmp$7;
    const _p$8 = "";
    if (!(pj === _p$8)) {
      const _p$9 = i.project;
      _tmp$7 = !(_p$9 === pj);
    } else {
      _tmp$7 = false;
    }
    if (_tmp$7) {
      return false;
    }
    const text = _M0FP314vlmkit_2dsites4code4main7q__text(q);
    let _tmp$8;
    const _p$9 = "";
    if (!(text === _p$9)) {
      _tmp$8 = !_M0MPC16string6String8contains(_M0MPC16string6String9to__lower(i.title), new _M0TPC16string10StringView(text, 0, text.length));
    } else {
      _tmp$8 = false;
    }
    if (_tmp$8) {
      return false;
    }
    return true;
  }
  function _M0FP314vlmkit_2dsites4code4main12seed__issues() {
    const out = [];
    let num = 123;
    let oi = 0;
    let ci = 0;
    let rng = 20261114;
    while (true) {
      if (oi < _M0FP314vlmkit_2dsites4code4main12open__titles.length || ci < _M0FP314vlmkit_2dsites4code4main14closed__titles.length) {
        rng = ((Math.imul(rng, 1103515245) | 0) + 12345 | 0) % 2147483647 | 0;
        if (rng < 0) {
          rng = -rng | 0;
        }
        const pick_open = oi >= _M0FP314vlmkit_2dsites4code4main12open__titles.length ? false : ci >= _M0FP314vlmkit_2dsites4code4main14closed__titles.length ? true : (Math.imul(oi, 64) | 0) <= (Math.imul(oi + ci | 0, 23) | 0);
        if (pick_open) {
          const _bind = _M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(_M0FP314vlmkit_2dsites4code4main12open__titles, oi);
          const _title = _bind._0;
          const _ls = _bind._1;
          const _author = _bind._2;
          const _ago = _bind._3;
          const _comments = _bind._4;
          _M0MPC15array5Array4pushGUssEE(out, new _M0TP314vlmkit_2dsites4code4main5Issue(num, _title, true, _ls, _author, _ago, _comments, (oi % 3 | 0) === 0 ? _M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(_M0FP314vlmkit_2dsites4code4main10milestones, 0) : (oi % 5 | 0) === 1 ? _M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(_M0FP314vlmkit_2dsites4code4main10milestones, 1) : "", (oi % 4 | 0) === 0 ? _M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(_M0FP314vlmkit_2dsites4code4main6people, (oi + 2 | 0) % _M0FP314vlmkit_2dsites4code4main6people.length | 0) : "", (oi % 2 | 0) === 0 ? _M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(_M0FP314vlmkit_2dsites4code4main8projects, (oi / 2 | 0) % 2 | 0) : "", "Seen on Lantern 3.4.0 with Node 22.\n\nSteps to reproduce are in the first comment."));
          oi = oi + 1 | 0;
        } else {
          const title = _M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(_M0FP314vlmkit_2dsites4code4main14closed__titles, ci);
          const lbl = _M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(_M0FP314vlmkit_2dsites4code4main6labels, rng % _M0FP314vlmkit_2dsites4code4main6labels.length | 0).name;
          _M0MPC15array5Array4pushGUssEE(out, new _M0TP314vlmkit_2dsites4code4main5Issue(num, title, false, [lbl], _M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(_M0FP314vlmkit_2dsites4code4main6people, ((Math.imul(ci, 5) | 0) + 3 | 0) % _M0FP314vlmkit_2dsites4code4main6people.length | 0), _M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(_M0FP314vlmkit_2dsites4code4main12closed__ages, (Math.imul(ci, _M0FP314vlmkit_2dsites4code4main12closed__ages.length) | 0) / _M0FP314vlmkit_2dsites4code4main14closed__titles.length | 0), rng % 9 | 0, (ci % 4 | 0) === 0 ? "3.4.0" : "", (ci % 3 | 0) === 0 ? _M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(_M0FP314vlmkit_2dsites4code4main6people, ci % _M0FP314vlmkit_2dsites4code4main6people.length | 0) : "", (ci % 5 | 0) === 0 ? _M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(_M0FP314vlmkit_2dsites4code4main8projects, 0) : "", "Fixed on main."));
          ci = ci + 1 | 0;
        }
        num = num - 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return out;
  }
  function _M0FP314vlmkit_2dsites4code4main13shown__issues() {
    const q = _M0MP26mizchi7signals6Signal3getGsE(_M0FP314vlmkit_2dsites4code4main2iq);
    const _p = _M0MP26mizchi7signals6Signal3getGRPB5ArrayGRP314vlmkit_2dsites4code4main5IssueEE(_M0FP314vlmkit_2dsites4code4main6issues);
    const _p$2 = [];
    const _p$3 = _p.length;
    let out;
    let _tmp = 0;
    while (true) {
      const _p$4 = _tmp;
      if (_p$4 < _p$3) {
        const _p$5 = _p[_p$4];
        if (_M0FP314vlmkit_2dsites4code4main14issue__matches(_p$5, q, true)) {
          _M0MPC15array5Array4pushGUssEE(_p$2, _p$5);
        }
        _tmp = _p$4 + 1 | 0;
        continue;
      } else {
        out = _p$2;
        break;
      }
    }
    const _bind = _M0FP314vlmkit_2dsites4code4main6q__get(q, "sort");
    switch (_bind) {
      case "created-asc": {
        _M0MPC15array5Array8sort__byGUsRPB5ArrayGiEEE(out, (a, b) => a.num - b.num | 0);
        break;
      }
      case "comments-desc": {
        _M0MPC15array5Array8sort__byGUsRPB5ArrayGiEEE(out, (a, b) => b.comments !== a.comments ? b.comments - a.comments | 0 : b.num - a.num | 0);
        break;
      }
      case "comments-asc": {
        _M0MPC15array5Array8sort__byGUsRPB5ArrayGiEEE(out, (a, b) => a.comments !== b.comments ? a.comments - b.comments | 0 : b.num - a.num | 0);
        break;
      }
      default: {
        _M0MPC15array5Array8sort__byGUsRPB5ArrayGiEEE(out, (a, b) => b.num - a.num | 0);
      }
    }
    return out;
  }
  function _M0FP314vlmkit_2dsites4code4main12state__count(open_) {
    const q = _M0MP26mizchi7signals6Signal3getGsE(_M0FP314vlmkit_2dsites4code4main2iq);
    const _p = _M0MP26mizchi7signals6Signal3getGRPB5ArrayGRP314vlmkit_2dsites4code4main5IssueEE(_M0FP314vlmkit_2dsites4code4main6issues);
    const _p$2 = [];
    const _p$3 = _p.length;
    let _tmp;
    let _tmp$2 = 0;
    while (true) {
      const _p$4 = _tmp$2;
      if (_p$4 < _p$3) {
        const _p$5 = _p[_p$4];
        if (_p$5.open_ === open_ && _M0FP314vlmkit_2dsites4code4main14issue__matches(_p$5, q, false)) {
          _M0MPC15array5Array4pushGUssEE(_p$2, _p$5);
        }
        _tmp$2 = _p$4 + 1 | 0;
        continue;
      } else {
        _tmp = _p$2;
        break;
      }
    }
    return _tmp.length;
  }
  function _M0FP314vlmkit_2dsites4code4main11is__open__q() {
    return !_M0MPC16string6String8contains(_M0MP26mizchi7signals6Signal3getGsE(_M0FP314vlmkit_2dsites4code4main2iq), _M0FP314vlmkit_2dsites4code4main11is__open__qN6recordS2848);
  }
  function _M0FP314vlmkit_2dsites4code4main11chip__styleN2hvS2849(c) {
    return _M0MPC14char4Char16is__ascii__digit(c) ? c - 48 | 0 : (c - (_M0MPC14char4Char20is__ascii__uppercase(c) ? 65 : 97) | 0) + 10 | 0;
  }
  function _M0FP314vlmkit_2dsites4code4main11chip__styleN3linS2850(v) {
    const s = (v + 0) / 255;
    return s <= 0.04045 ? s / 12.92 : _M0MPC16double6Double3pow((s + 0.055) / 1.055, 2.4);
  }
  function _M0FP314vlmkit_2dsites4code4main11chip__style(color) {
    const hex = _M0FP314vlmkit_2dsites4code4main9chars__of(_M0MPC16string6String17substring_2einner(color, 1, undefined));
    const r = (Math.imul(_M0FP314vlmkit_2dsites4code4main11chip__styleN2hvS2849(_M0MPC15array5Array2atGcE(hex, 0)), 16) | 0) + _M0FP314vlmkit_2dsites4code4main11chip__styleN2hvS2849(_M0MPC15array5Array2atGcE(hex, 1)) | 0;
    const g = (Math.imul(_M0FP314vlmkit_2dsites4code4main11chip__styleN2hvS2849(_M0MPC15array5Array2atGcE(hex, 2)), 16) | 0) + _M0FP314vlmkit_2dsites4code4main11chip__styleN2hvS2849(_M0MPC15array5Array2atGcE(hex, 3)) | 0;
    const b = (Math.imul(_M0FP314vlmkit_2dsites4code4main11chip__styleN2hvS2849(_M0MPC15array5Array2atGcE(hex, 4)), 16) | 0) + _M0FP314vlmkit_2dsites4code4main11chip__styleN2hvS2849(_M0MPC15array5Array2atGcE(hex, 5)) | 0;
    const l = 0.2126 * _M0FP314vlmkit_2dsites4code4main11chip__styleN3linS2850(r) + 0.7152 * _M0FP314vlmkit_2dsites4code4main11chip__styleN3linS2850(g) + 0.0722 * _M0FP314vlmkit_2dsites4code4main11chip__styleN3linS2850(b);
    const dark_ink = (l + 0.05) / 0.0644;
    const white_ink = 1.05 / (l + 0.05);
    const ink = dark_ink >= white_ink ? "#1f2328" : "#ffffff";
    return `background:${color};color:${ink}`;
  }
  function _M0FP314vlmkit_2dsites4code4main12label__color(name) {
    const _bind = _M0FP314vlmkit_2dsites4code4main6labels.length;
    let _tmp = 0;
    while (true) {
      const _ = _tmp;
      if (_ < _bind) {
        const l = _M0FP314vlmkit_2dsites4code4main6labels[_];
        if (l.name === name) {
          return l.color;
        }
        _tmp = _ + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return "#888888";
  }
  function _M0FP314vlmkit_2dsites4code4main14tab__of__route(r) {
    return _M0MPC16string6String11has__prefix(r, _M0FP314vlmkit_2dsites4code4main14tab__of__routeN6recordS2868) || _M0MPC16string6String11has__prefix(r, _M0FP314vlmkit_2dsites4code4main14tab__of__routeN6recordS2869) ? "code" : r === "issues" || (r === "new" || _M0MPC16string6String11has__prefix(r, _M0FP314vlmkit_2dsites4code4main14tab__of__routeN6recordS2870)) ? "issues" : r === "pulls" ? "pulls" : _M0MPC16string6String17substring_2einner(r, 4, undefined);
  }
  function _M0FP314vlmkit_2dsites4code4main11label__chip(name) {
    return _M0FP314vlmkit_2dsites4code4main2el("button", [_M0FP314vlmkit_2dsites4code4main3a__("type", "button"), _M0FP314vlmkit_2dsites4code4main3cls("chip"), _M0FP314vlmkit_2dsites4code4main3a__("style", _M0FP314vlmkit_2dsites4code4main11chip__style(_M0FP314vlmkit_2dsites4code4main12label__color(name))), _M0FP314vlmkit_2dsites4code4main3a__("aria-label", `Filter by label ${name}`), _M0FP314vlmkit_2dsites4code4main2on("click", (_e) => {
      if (_M0FP314vlmkit_2dsites4code4main14tab__of__route(_M0MP26mizchi7signals6Signal3getGsE(_M0FP314vlmkit_2dsites4code4main5route)) === "issues" && _M0MP26mizchi7signals6Signal3getGsE(_M0FP314vlmkit_2dsites4code4main5route) === "issues") {
        _M0FP314vlmkit_2dsites4code4main7set__iq(_M0FP314vlmkit_2dsites4code4main6q__set(_M0MP26mizchi7signals6Signal3getGsE(_M0FP314vlmkit_2dsites4code4main2iq), "label", name));
        return;
      } else {
        _M0MP26mizchi7signals6Signal3setGsE(_M0FP314vlmkit_2dsites4code4main2iq, _M0FP314vlmkit_2dsites4code4main6q__set("is:issue is:open", "label", name));
        _M0FP314vlmkit_2dsites4code4main9set__hash("#/issues");
        return;
      }
    })], [_M0FP314vlmkit_2dsites4code4main1t(name)]);
  }
  function _M0FP314vlmkit_2dsites4code4main11issue__icon(open_) {
    return open_ ? _M0FP314vlmkit_2dsites4code4main2el("span", [_M0FP314vlmkit_2dsites4code4main3cls("st st-open"), _M0FP314vlmkit_2dsites4code4main3a__("role", "img"), _M0FP314vlmkit_2dsites4code4main3a__("aria-label", "Open issue")], [_M0FP314vlmkit_2dsites4code4main4icon("issue")]) : _M0FP314vlmkit_2dsites4code4main2el("span", [_M0FP314vlmkit_2dsites4code4main3cls("st st-closed"), _M0FP314vlmkit_2dsites4code4main3a__("role", "img"), _M0FP314vlmkit_2dsites4code4main3a__("aria-label", "Closed issue")], [_M0FP314vlmkit_2dsites4code4main4icon("issue-closed")]);
  }
  function _M0FP314vlmkit_2dsites4code4main6plural(n, one, many) {
    return n === 1 ? `1 ${one}` : `${_M0MPC13int3Int18to__string_2einner(n, 10)} ${many}`;
  }
  function _M0FP314vlmkit_2dsites4code4main10issue__row(i) {
    const _tmp = [_M0FP314vlmkit_2dsites4code4main3cls("issue-row")];
    const _tmp$2 = _M0FP314vlmkit_2dsites4code4main11issue__icon(i.open_);
    const _tmp$3 = [_M0FP314vlmkit_2dsites4code4main3cls("issue-main")];
    const _tmp$4 = [_M0FP314vlmkit_2dsites4code4main3cls("issue-title-line")];
    const _tmp$5 = _M0FP314vlmkit_2dsites4code4main2el("a", [_M0FP314vlmkit_2dsites4code4main3a__("href", `#/issues/${_M0MPC13int3Int18to__string_2einner(i.num, 10)}`), _M0FP314vlmkit_2dsites4code4main3cls("issue-title")], [_M0FP314vlmkit_2dsites4code4main1t(i.title)]);
    const _tmp$6 = [_M0FP314vlmkit_2dsites4code4main3cls("chips")];
    const _p = i.labels;
    const _p$2 = new Array(_p.length);
    const _p$3 = _p.length;
    let _tmp$7 = 0;
    while (true) {
      const _p$4 = _tmp$7;
      if (_p$4 < _p$3) {
        const _p$5 = _p[_p$4];
        _p$2[_p$4] = _M0FP314vlmkit_2dsites4code4main11label__chip(_p$5);
        _tmp$7 = _p$4 + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    const _tmp$8 = _M0FP314vlmkit_2dsites4code4main2el("p", _tmp$4, [_tmp$5, _M0FP314vlmkit_2dsites4code4main2el("span", _tmp$6, _p$2)]);
    const _tmp$9 = [_M0FP314vlmkit_2dsites4code4main3cls("issue-meta")];
    const _tmp$10 = _M0FP314vlmkit_2dsites4code4main1t(i.open_ ? `#${_M0MPC13int3Int18to__string_2einner(i.num, 10)} opened ${i.ago} by ` : `#${_M0MPC13int3Int18to__string_2einner(i.num, 10)} by `);
    const _tmp$11 = _M0FP314vlmkit_2dsites4code4main2el("a", [_M0FP314vlmkit_2dsites4code4main3a__("href", "#/issues"), _M0FP314vlmkit_2dsites4code4main3cls("meta-user"), _M0FP314vlmkit_2dsites4code4main2on("click", (e) => {
      _M0FP314vlmkit_2dsites4code4main7prevent(e);
      _M0FP314vlmkit_2dsites4code4main7set__iq(_M0FP314vlmkit_2dsites4code4main6q__set(_M0MP26mizchi7signals6Signal3getGsE(_M0FP314vlmkit_2dsites4code4main2iq), "author", i.author));
    })], [_M0FP314vlmkit_2dsites4code4main1t(i.author)]);
    const _tmp$12 = _M0FP314vlmkit_2dsites4code4main1t(i.open_ ? "" : ` was closed ${i.ago}`);
    let _tmp$13;
    const _p$4 = i.milestone;
    const _p$5 = "";
    if (!(_p$4 === _p$5)) {
      _tmp$13 = _M0FP314vlmkit_2dsites4code4main2el("span", [_M0FP314vlmkit_2dsites4code4main3cls("meta-ms")], [_M0FP314vlmkit_2dsites4code4main1t(` · ${i.milestone}`)]);
    } else {
      _tmp$13 = _M0FP314vlmkit_2dsites4code4main1t("");
    }
    return _M0FP314vlmkit_2dsites4code4main2el("li", _tmp, [_tmp$2, _M0FP314vlmkit_2dsites4code4main2el("div", _tmp$3, [_tmp$8, _M0FP314vlmkit_2dsites4code4main2el("p", _tmp$9, [_tmp$10, _tmp$11, _tmp$12, _tmp$13])]), i.comments > 0 ? _M0FP314vlmkit_2dsites4code4main2el("a", [_M0FP314vlmkit_2dsites4code4main3a__("href", `#/issues/${_M0MPC13int3Int18to__string_2einner(i.num, 10)}`), _M0FP314vlmkit_2dsites4code4main3cls("issue-comments"), _M0FP314vlmkit_2dsites4code4main3a__("aria-label", _M0FP314vlmkit_2dsites4code4main6plural(i.comments, "comment", "comments"))], [_M0FP314vlmkit_2dsites4code4main4icon("comment"), _M0FP314vlmkit_2dsites4code4main1t(_M0MPC13int3Int18to__string_2einner(i.comments, 10))]) : _M0FP314vlmkit_2dsites4code4main2el("span", [_M0FP314vlmkit_2dsites4code4main3cls("issue-comments")], [])]);
  }
  function _M0FP314vlmkit_2dsites4code4main2ad(name, f) {
    return { _0: name, _1: new _M0DTP36mizchi4luna3dom9AttrValue7Dynamic(f) };
  }
  function _M0FP314vlmkit_2dsites4code4main6avatar(name, size) {
    let h = 0;
    const _bind = name.length;
    let _tmp = 0;
    while (true) {
      const _string_index = _tmp;
      if (_string_index < _bind) {
        let _decoded_next_string_index;
        let _decoded_char;
        _L: {
          const _bind$2 = name.charCodeAt(_string_index);
          if (_bind$2 >= 55296 && _bind$2 <= 56319 && (_string_index + 1 | 0) < _bind) {
            const _bind$3 = name.charCodeAt(_string_index + 1 | 0);
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
        h = ((Math.imul(h, 31) | 0) + _decoded_char | 0) % 9973 | 0;
        _tmp = _decoded_next_string_index;
        continue;
      } else {
        break;
      }
    }
    const parts = _M0MPB4Iter9to__arrayGRPC16string10StringViewE(_M0MPB4Iter3mapGRPC16string10StringViewsE(_M0MPC16string6String5split(name, _M0FP314vlmkit_2dsites4code4main6avatarN6recordS2882), (s) => _M0MPC16string10StringView9to__owned(s)));
    const _p = new Array(parts.length);
    const _p$2 = parts.length;
    let _tmp$2 = 0;
    while (true) {
      const _p$3 = _tmp$2;
      if (_p$3 < _p$2) {
        const _p$4 = parts[_p$3];
        const _p$5 = _M0MPC16string6String9get__char(_p$4, 0);
        let _tmp$3;
        if (_p$5 === -1) {
          _tmp$3 = "";
        } else {
          const _p$6 = _p$5;
          const _p$7 = _p$6;
          _tmp$3 = _M0MPC16string6String9to__upper(_M0IPC14char4CharPB4Show10to__string(_p$7));
        }
        _p[_p$3] = _tmp$3;
        _tmp$2 = _p$3 + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    const initials = _M0MPC15array5Array4joinGsE(_p, _M0FP314vlmkit_2dsites4code4main6avatarN6recordS2883);
    const ini = initials.length > 2 ? _M0MPC16string6String17substring_2einner(initials, 0, _M0FP314vlmkit_2dsites4code4main6avatarN6constrS2884) : initials;
    const _tmp$3 = _M0FP314vlmkit_2dsites4code4main3cls("avatar");
    const _tmp$4 = _M0FP314vlmkit_2dsites4code4main3a__("aria-hidden", "true");
    const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(43);
    _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, "background:");
    _M0MPB13StringBuilder13write__objectGsE(_string_builder, _M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(_M0FP314vlmkit_2dsites4code4main14avatar__colors, h % _M0FP314vlmkit_2dsites4code4main14avatar__colors.length | 0));
    _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, ";width:");
    _M0MPB13StringBuilder13write__objectGiE(_string_builder, size);
    _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, "px;height:");
    _M0MPB13StringBuilder13write__objectGiE(_string_builder, size);
    _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, "px;font-size:");
    _M0MPB13StringBuilder13write__objectGiE(_string_builder, ((Math.imul(size, 2) | 0) / 5 | 0) + 1 | 0);
    _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, "px");
    return _M0FP314vlmkit_2dsites4code4main2el("span", [_tmp$3, _tmp$4, _M0FP314vlmkit_2dsites4code4main3a__("style", _string_builder.val)], [_M0FP314vlmkit_2dsites4code4main1t(ini)]);
  }
  function _M0FP314vlmkit_2dsites4code4main18close__menu__focus() {
    const k = _M0MP26mizchi7signals6Signal3getGsE(_M0FP314vlmkit_2dsites4code4main10open__menu);
    const _p = "";
    if (!(k === _p)) {
      _M0MP26mizchi7signals6Signal3setGsE(_M0FP314vlmkit_2dsites4code4main10open__menu, "");
      _M0FP314vlmkit_2dsites4code4main10focus__sel(`#btn-${k}`);
      return;
    } else {
      return;
    }
  }
  function _M0FP314vlmkit_2dsites4code4main12toggle__menu(key) {
    if (_M0MP26mizchi7signals6Signal3getGsE(_M0FP314vlmkit_2dsites4code4main10open__menu) === key) {
      _M0MP26mizchi7signals6Signal3setGsE(_M0FP314vlmkit_2dsites4code4main10open__menu, "");
      return;
    } else {
      _M0MP26mizchi7signals6Signal3setGsE(_M0FP314vlmkit_2dsites4code4main10open__menu, key);
      return;
    }
  }
  function _M0FP314vlmkit_2dsites4code4main7popover(key, trigger_cls, trigger_label, trigger, panel_cls, panel) {
    const attrs = [_M0FP314vlmkit_2dsites4code4main3a__("type", "button"), _M0FP314vlmkit_2dsites4code4main3a__("id", `btn-${key}`), _M0FP314vlmkit_2dsites4code4main3cls(trigger_cls), _M0FP314vlmkit_2dsites4code4main3a__("aria-controls", `pop-${key}`), _M0FP314vlmkit_2dsites4code4main2ad("aria-expanded", () => {
      const _p = _M0MP26mizchi7signals6Signal3getGsE(_M0FP314vlmkit_2dsites4code4main10open__menu) === key;
      return _p ? "true" : "false";
    }), _M0FP314vlmkit_2dsites4code4main2on("click", (_e) => {
      _M0FP314vlmkit_2dsites4code4main12toggle__menu(key);
    })];
    const _p = "";
    if (!(trigger_label === _p)) {
      _M0MPC15array5Array4pushGUssEE(attrs, _M0FP314vlmkit_2dsites4code4main3a__("aria-label", trigger_label));
    }
    return _M0FP314vlmkit_2dsites4code4main2el("div", [_M0FP314vlmkit_2dsites4code4main3cls("pop-root"), _M0FP314vlmkit_2dsites4code4main3a__("data-pop", key)], [_M0FP314vlmkit_2dsites4code4main2el("button", attrs, trigger), _M0FP314vlmkit_2dsites4code4main2el("div", [_M0FP314vlmkit_2dsites4code4main3a__("id", `pop-${key}`), _M0FP314vlmkit_2dsites4code4main2ad("class", () => `popover ${panel_cls}${_M0MP26mizchi7signals6Signal3getGsE(_M0FP314vlmkit_2dsites4code4main10open__menu) === key ? " is-open" : ""}`)], panel())]);
  }
  function _M0FP314vlmkit_2dsites4code4main12filter__menu(key, label, qkey, options) {
    return _M0FP314vlmkit_2dsites4code4main7popover(`f-${key}`, "btn-bare filter-btn", "", [_M0FP314vlmkit_2dsites4code4main1t(label), _M0FP314vlmkit_2dsites4code4main7icon__c("caret", "ic caret")], "menu-pop filter-pop", () => {
      const _tmp = _M0FP314vlmkit_2dsites4code4main2el("p", [_M0FP314vlmkit_2dsites4code4main3cls("pop-title")], [_M0FP314vlmkit_2dsites4code4main1t(`Filter by ${_M0MPC16string6String9to__lower(label)}`)]);
      const _tmp$2 = [_M0FP314vlmkit_2dsites4code4main3cls("choice-list"), _M0FP314vlmkit_2dsites4code4main3a__("aria-label", label)];
      const _p = new Array(options.length);
      const _p$2 = options.length;
      let _tmp$3 = 0;
      while (true) {
        const _p$3 = _tmp$3;
        if (_p$3 < _p$2) {
          const _p$4 = options[_p$3];
          const _p$5 = _p$4._0;
          const _p$6 = _p$4._1;
          _p[_p$3] = _M0FP314vlmkit_2dsites4code4main2el("li", [], [_M0FP314vlmkit_2dsites4code4main2el("button", [_M0FP314vlmkit_2dsites4code4main3a__("type", "button"), _M0FP314vlmkit_2dsites4code4main3cls("choice"), _M0FP314vlmkit_2dsites4code4main2ad("aria-pressed", () => {
            const _p$7 = _M0FP314vlmkit_2dsites4code4main6q__get(_M0MP26mizchi7signals6Signal3getGsE(_M0FP314vlmkit_2dsites4code4main2iq), qkey) === _p$5;
            return _p$7 ? "true" : "false";
          }), _M0FP314vlmkit_2dsites4code4main2on("click", (_p$7) => {
            const _p$8 = _M0FP314vlmkit_2dsites4code4main6q__get(_M0MP26mizchi7signals6Signal3getGsE(_M0FP314vlmkit_2dsites4code4main2iq), qkey);
            const _tmp$4 = _M0MP26mizchi7signals6Signal3getGsE(_M0FP314vlmkit_2dsites4code4main2iq);
            let _tmp$5;
            let _tmp$6;
            if (_p$8 === _p$5) {
              const _p$9 = "sort";
              _tmp$6 = !(qkey === _p$9);
            } else {
              _tmp$6 = false;
            }
            if (_tmp$6) {
              _tmp$5 = "";
            } else {
              _tmp$5 = _p$5;
            }
            _M0FP314vlmkit_2dsites4code4main7set__iq(_M0FP314vlmkit_2dsites4code4main6q__set(_tmp$4, qkey, _tmp$5));
            _M0FP314vlmkit_2dsites4code4main18close__menu__focus();
          })], [_M0FP314vlmkit_2dsites4code4main2el("span", [_M0FP314vlmkit_2dsites4code4main3cls("choice-check")], [_M0FP36mizchi4luna3dom4show(() => _M0FP314vlmkit_2dsites4code4main6q__get(_M0MP26mizchi7signals6Signal3getGsE(_M0FP314vlmkit_2dsites4code4main2iq), qkey) === _p$5, () => _M0FP314vlmkit_2dsites4code4main4icon("check"))]), qkey === "label" ? _M0FP314vlmkit_2dsites4code4main2el("span", [_M0FP314vlmkit_2dsites4code4main3cls("lab-dot"), _M0FP314vlmkit_2dsites4code4main3a__("style", `background:${_M0FP314vlmkit_2dsites4code4main12label__color(_p$5)}`), _M0FP314vlmkit_2dsites4code4main3a__("aria-hidden", "true")], []) : qkey === "author" || qkey === "assignee" ? _M0FP314vlmkit_2dsites4code4main6avatar(_p$5, 18) : _M0FP314vlmkit_2dsites4code4main1t(""), _M0FP314vlmkit_2dsites4code4main2el("span", [_M0FP314vlmkit_2dsites4code4main3cls("choice-name")], [_M0FP314vlmkit_2dsites4code4main1t(_p$6)])])]);
          _tmp$3 = _p$3 + 1 | 0;
          continue;
        } else {
          break;
        }
      }
      return [_tmp, _M0FP314vlmkit_2dsites4code4main2el("ul", _tmp$2, _p)];
    });
  }
  function _M0FP314vlmkit_2dsites4code4main18issue__icon__plain(open_) {
    return open_ ? _M0FP314vlmkit_2dsites4code4main4icon("issue") : _M0FP314vlmkit_2dsites4code4main4icon("issue-closed");
  }
  function _M0FP314vlmkit_2dsites4code4main12issues__view() {
    const shown = _M0FP26mizchi7signals4memoGRPB5ArrayGRP314vlmkit_2dsites4code4main7PalItemEE(() => _M0FP314vlmkit_2dsites4code4main13shown__issues());
    const _p = new Array(_M0FP314vlmkit_2dsites4code4main6people.length);
    const _p$2 = _M0FP314vlmkit_2dsites4code4main6people.length;
    let _tmp = 0;
    while (true) {
      const _p$3 = _tmp;
      if (_p$3 < _p$2) {
        const _p$4 = _M0FP314vlmkit_2dsites4code4main6people[_p$3];
        _p[_p$3] = { _0: _p$4, _1: _p$4 };
        _tmp = _p$3 + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    const authors = _p;
    const _tmp$2 = [_M0FP314vlmkit_2dsites4code4main3cls("issues")];
    const _tmp$3 = _M0FP314vlmkit_2dsites4code4main2el("div", [_M0FP314vlmkit_2dsites4code4main3cls("issues-head")], [_M0FP314vlmkit_2dsites4code4main2el("h2", [_M0FP314vlmkit_2dsites4code4main3cls("view-h")], [_M0FP314vlmkit_2dsites4code4main1t("Issues")]), _M0FP314vlmkit_2dsites4code4main2el("a", [_M0FP314vlmkit_2dsites4code4main3a__("href", "#/issues/new"), _M0FP314vlmkit_2dsites4code4main3cls("btn btn-primary")], [_M0FP314vlmkit_2dsites4code4main1t("New issue")])]);
    const _tmp$4 = _M0FP314vlmkit_2dsites4code4main2el("form", [_M0FP314vlmkit_2dsites4code4main3cls("issue-search"), _M0FP314vlmkit_2dsites4code4main3a__("role", "search"), _M0FP314vlmkit_2dsites4code4main2on("submit", (e) => {
      _M0FP314vlmkit_2dsites4code4main7prevent(e);
      _M0MP26mizchi7signals6Signal3setGsE(_M0FP314vlmkit_2dsites4code4main2iq, _M0FP314vlmkit_2dsites4code4main10get__value("#issue-search"));
    })], [_M0FP314vlmkit_2dsites4code4main2el("label", [_M0FP314vlmkit_2dsites4code4main3a__("for", "issue-search"), _M0FP314vlmkit_2dsites4code4main3cls("sr-only")], [_M0FP314vlmkit_2dsites4code4main1t("Search all issues")]), _M0FP314vlmkit_2dsites4code4main4icon("search"), _M0FP314vlmkit_2dsites4code4main2el("input", [_M0FP314vlmkit_2dsites4code4main3a__("id", "issue-search"), _M0FP314vlmkit_2dsites4code4main3a__("type", "text"), _M0FP314vlmkit_2dsites4code4main3cls("input mono-ish"), _M0FP314vlmkit_2dsites4code4main3a__("value", _M0MP26mizchi7signals6Signal3getGsE(_M0FP314vlmkit_2dsites4code4main2iq)), _M0FP314vlmkit_2dsites4code4main3a__("autocomplete", "off"), _M0FP314vlmkit_2dsites4code4main3a__("spellcheck", "false"), _M0FP314vlmkit_2dsites4code4main2on("input", (e) => {
      _M0MP26mizchi7signals6Signal3setGsE(_M0FP314vlmkit_2dsites4code4main2iq, _M0FP314vlmkit_2dsites4code4main9ev__value(e));
    })], []), _M0FP314vlmkit_2dsites4code4main2el("button", [_M0FP314vlmkit_2dsites4code4main3a__("type", "button"), _M0FP314vlmkit_2dsites4code4main3cls("btn btn-icon btn-bare"), _M0FP314vlmkit_2dsites4code4main3a__("aria-label", "Clear filters"), _M0FP314vlmkit_2dsites4code4main2on("click", (_e) => {
      _M0FP314vlmkit_2dsites4code4main7set__iq("is:issue is:open");
    })], [_M0FP314vlmkit_2dsites4code4main4icon("x")])]);
    const _tmp$5 = [_M0FP314vlmkit_2dsites4code4main3cls("issue-box")];
    const _tmp$6 = [_M0FP314vlmkit_2dsites4code4main3cls("issue-box-head")];
    const _tmp$7 = _M0FP314vlmkit_2dsites4code4main2el("div", [_M0FP314vlmkit_2dsites4code4main3cls("state-toggle"), _M0FP314vlmkit_2dsites4code4main3a__("role", "group"), _M0FP314vlmkit_2dsites4code4main3a__("aria-label", "Issue state")], [_M0FP314vlmkit_2dsites4code4main2el("button", [_M0FP314vlmkit_2dsites4code4main3a__("type", "button"), _M0FP314vlmkit_2dsites4code4main2ad("class", () => `state-btn${_M0FP314vlmkit_2dsites4code4main11is__open__q() ? " is-on" : ""}`), _M0FP314vlmkit_2dsites4code4main2ad("aria-pressed", () => {
      const _p$3 = _M0FP314vlmkit_2dsites4code4main11is__open__q();
      return _p$3 ? "true" : "false";
    }), _M0FP314vlmkit_2dsites4code4main2on("click", (_e) => {
      _M0FP314vlmkit_2dsites4code4main7set__iq(_M0FP314vlmkit_2dsites4code4main6q__set(_M0FP314vlmkit_2dsites4code4main6q__set(_M0MP26mizchi7signals6Signal3getGsE(_M0FP314vlmkit_2dsites4code4main2iq), "is", ""), "is", "open"));
    })], [_M0FP314vlmkit_2dsites4code4main18issue__icon__plain(true), _M0FP314vlmkit_2dsites4code4main2el("span", [], [_M0FP314vlmkit_2dsites4code4main2td(() => _M0MPC13int3Int18to__string_2einner(_M0FP314vlmkit_2dsites4code4main12state__count(true), 10))]), _M0FP314vlmkit_2dsites4code4main2el("span", [], [_M0FP314vlmkit_2dsites4code4main1t("Open")])]), _M0FP314vlmkit_2dsites4code4main2el("button", [_M0FP314vlmkit_2dsites4code4main3a__("type", "button"), _M0FP314vlmkit_2dsites4code4main2ad("class", () => `state-btn${!_M0FP314vlmkit_2dsites4code4main11is__open__q() ? " is-on" : ""}`), _M0FP314vlmkit_2dsites4code4main2ad("aria-pressed", () => {
      const _p$3 = !_M0FP314vlmkit_2dsites4code4main11is__open__q();
      return _p$3 ? "true" : "false";
    }), _M0FP314vlmkit_2dsites4code4main2on("click", (_e) => {
      _M0FP314vlmkit_2dsites4code4main7set__iq(_M0FP314vlmkit_2dsites4code4main6q__set(_M0FP314vlmkit_2dsites4code4main6q__set(_M0MP26mizchi7signals6Signal3getGsE(_M0FP314vlmkit_2dsites4code4main2iq), "is", ""), "is", "closed"));
    })], [_M0FP314vlmkit_2dsites4code4main18issue__icon__plain(false), _M0FP314vlmkit_2dsites4code4main2el("span", [], [_M0FP314vlmkit_2dsites4code4main2td(() => _M0MPC13int3Int18to__string_2einner(_M0FP314vlmkit_2dsites4code4main12state__count(false), 10))]), _M0FP314vlmkit_2dsites4code4main2el("span", [], [_M0FP314vlmkit_2dsites4code4main1t("Closed")])])]);
    const _tmp$8 = [_M0FP314vlmkit_2dsites4code4main3cls("filters")];
    const _tmp$9 = _M0FP314vlmkit_2dsites4code4main12filter__menu("author", "Author", "author", authors);
    const _p$3 = new Array(_M0FP314vlmkit_2dsites4code4main6labels.length);
    const _p$4 = _M0FP314vlmkit_2dsites4code4main6labels.length;
    let _tmp$10 = 0;
    while (true) {
      const _p$5 = _tmp$10;
      if (_p$5 < _p$4) {
        const _p$6 = _M0FP314vlmkit_2dsites4code4main6labels[_p$5];
        _p$3[_p$5] = { _0: _p$6.name, _1: _p$6.name };
        _tmp$10 = _p$5 + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    const _tmp$11 = _M0FP314vlmkit_2dsites4code4main12filter__menu("label", "Label", "label", _p$3);
    const _p$5 = new Array(_M0FP314vlmkit_2dsites4code4main8projects.length);
    const _p$6 = _M0FP314vlmkit_2dsites4code4main8projects.length;
    let _tmp$12 = 0;
    while (true) {
      const _p$7 = _tmp$12;
      if (_p$7 < _p$6) {
        const _p$8 = _M0FP314vlmkit_2dsites4code4main8projects[_p$7];
        _p$5[_p$7] = { _0: _p$8, _1: _p$8 };
        _tmp$12 = _p$7 + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return _M0FP314vlmkit_2dsites4code4main2el("div", _tmp$2, [_tmp$3, _tmp$4, _M0FP314vlmkit_2dsites4code4main2el("div", _tmp$5, [_M0FP314vlmkit_2dsites4code4main2el("div", _tmp$6, [_tmp$7, _M0FP314vlmkit_2dsites4code4main2el("div", _tmp$8, [_tmp$9, _tmp$11, _M0FP314vlmkit_2dsites4code4main12filter__menu("projects", "Projects", "project", _p$5), _M0FP314vlmkit_2dsites4code4main12filter__menu("milestones", "Milestones", "milestone", [_M0FP314vlmkit_2dsites4code4main12issues__viewN5tupleS2926, _M0FP314vlmkit_2dsites4code4main12issues__viewN5tupleS2927, _M0FP314vlmkit_2dsites4code4main12issues__viewN5tupleS2928]), _M0FP314vlmkit_2dsites4code4main12filter__menu("assignees", "Assignees", "assignee", authors), _M0FP314vlmkit_2dsites4code4main12filter__menu("sort", "Sort", "sort", [_M0FP314vlmkit_2dsites4code4main12issues__viewN5tupleS2929, _M0FP314vlmkit_2dsites4code4main12issues__viewN5tupleS2930, _M0FP314vlmkit_2dsites4code4main12issues__viewN5tupleS2931, _M0FP314vlmkit_2dsites4code4main12issues__viewN5tupleS2932])])]), _M0FP314vlmkit_2dsites4code4main2el("ul", [_M0FP314vlmkit_2dsites4code4main3cls("issue-list"), _M0FP314vlmkit_2dsites4code4main3a__("aria-label", "Issues")], [_M0FP36mizchi4luna3dom9for__eachGsE(() => shown(), (i, _k) => _M0FP314vlmkit_2dsites4code4main10issue__row(i))]), _M0FP36mizchi4luna3dom4show(() => shown().length === 0, () => _M0FP314vlmkit_2dsites4code4main2el("div", [_M0FP314vlmkit_2dsites4code4main3cls("blank-in")], [_M0FP314vlmkit_2dsites4code4main2el("p", [_M0FP314vlmkit_2dsites4code4main3cls("blank-h")], [_M0FP314vlmkit_2dsites4code4main1t("No issues match this search.")]), _M0FP314vlmkit_2dsites4code4main2el("button", [_M0FP314vlmkit_2dsites4code4main3a__("type", "button"), _M0FP314vlmkit_2dsites4code4main3cls("btn"), _M0FP314vlmkit_2dsites4code4main2on("click", (_e) => {
      _M0FP314vlmkit_2dsites4code4main7set__iq("is:issue is:open");
    })], [_M0FP314vlmkit_2dsites4code4main1t("Clear filters")])]))])]);
  }
  function _M0FP314vlmkit_2dsites4code4main11issue__view(num) {
    const _p = _M0MP26mizchi7signals6Signal3getGRPB5ArrayGRP314vlmkit_2dsites4code4main5IssueEE(_M0FP314vlmkit_2dsites4code4main6issues);
    const _p$2 = [];
    const _p$3 = _p.length;
    let found;
    let _tmp = 0;
    while (true) {
      const _p$4 = _tmp;
      if (_p$4 < _p$3) {
        const _p$5 = _p[_p$4];
        if (_p$5.num === num) {
          _M0MPC15array5Array4pushGUssEE(_p$2, _p$5);
        }
        _tmp = _p$4 + 1 | 0;
        continue;
      } else {
        found = _p$2;
        break;
      }
    }
    if (found.length === 0) {
      return _M0FP314vlmkit_2dsites4code4main2el("div", [_M0FP314vlmkit_2dsites4code4main3cls("blank")], [_M0FP314vlmkit_2dsites4code4main2el("h2", [], [_M0FP314vlmkit_2dsites4code4main1t(`No issue #${_M0MPC13int3Int18to__string_2einner(num, 10)}`)]), _M0FP314vlmkit_2dsites4code4main2el("p", [], [_M0FP314vlmkit_2dsites4code4main2el("a", [_M0FP314vlmkit_2dsites4code4main3a__("href", "#/issues"), _M0FP314vlmkit_2dsites4code4main3cls("link")], [_M0FP314vlmkit_2dsites4code4main1t("All issues")])])]);
    }
    const i = _M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(found, 0);
    const _tmp$2 = [_M0FP314vlmkit_2dsites4code4main3cls("issue-page")];
    const _tmp$3 = _M0FP314vlmkit_2dsites4code4main2el("p", [], [_M0FP314vlmkit_2dsites4code4main2el("a", [_M0FP314vlmkit_2dsites4code4main3a__("href", "#/issues"), _M0FP314vlmkit_2dsites4code4main3cls("link small")], [_M0FP314vlmkit_2dsites4code4main1t("← All issues")])]);
    const _tmp$4 = _M0FP314vlmkit_2dsites4code4main2el("h2", [_M0FP314vlmkit_2dsites4code4main3cls("issue-h")], [_M0FP314vlmkit_2dsites4code4main1t(`${i.title} `), _M0FP314vlmkit_2dsites4code4main2el("span", [_M0FP314vlmkit_2dsites4code4main3cls("muted")], [_M0FP314vlmkit_2dsites4code4main1t(`#${_M0MPC13int3Int18to__string_2einner(i.num, 10)}`)])]);
    const _tmp$5 = _M0FP314vlmkit_2dsites4code4main2el("p", [_M0FP314vlmkit_2dsites4code4main3cls("issue-sub")], [_M0FP314vlmkit_2dsites4code4main2el("span", [_M0FP314vlmkit_2dsites4code4main3cls(i.open_ ? "state-pill open" : "state-pill closed")], [_M0FP314vlmkit_2dsites4code4main18issue__icon__plain(i.open_), _M0FP314vlmkit_2dsites4code4main1t(i.open_ ? " Open" : " Closed")]), _M0FP314vlmkit_2dsites4code4main1t(" "), _M0FP314vlmkit_2dsites4code4main2el("strong", [], [_M0FP314vlmkit_2dsites4code4main1t(i.author)]), _M0FP314vlmkit_2dsites4code4main1t(` opened this issue ${i.ago} · ${_M0FP314vlmkit_2dsites4code4main6plural(i.comments, "comment", "comments")}`)]);
    const _tmp$6 = [_M0FP314vlmkit_2dsites4code4main3cls("issue-layout")];
    const _tmp$7 = _M0FP314vlmkit_2dsites4code4main2el("article", [_M0FP314vlmkit_2dsites4code4main3cls("comment-box")], [_M0FP314vlmkit_2dsites4code4main2el("div", [_M0FP314vlmkit_2dsites4code4main3cls("comment-head")], [_M0FP314vlmkit_2dsites4code4main6avatar(i.author, 20), _M0FP314vlmkit_2dsites4code4main2el("strong", [], [_M0FP314vlmkit_2dsites4code4main1t(i.author)]), _M0FP314vlmkit_2dsites4code4main2el("span", [_M0FP314vlmkit_2dsites4code4main3cls("muted")], [_M0FP314vlmkit_2dsites4code4main1t(` commented ${i.ago}`)])]), _M0FP314vlmkit_2dsites4code4main2el("div", [_M0FP314vlmkit_2dsites4code4main3cls("markdown comment-body")], _M0FP314vlmkit_2dsites4code4main10md__blocks(i.body, "issue"))]);
    const _tmp$8 = [_M0FP314vlmkit_2dsites4code4main3cls("issue-side"), _M0FP314vlmkit_2dsites4code4main3a__("aria-label", "Details")];
    const _tmp$9 = _M0FP314vlmkit_2dsites4code4main2el("h3", [_M0FP314vlmkit_2dsites4code4main3cls("side-h3")], [_M0FP314vlmkit_2dsites4code4main1t("Labels")]);
    let _tmp$10;
    if (i.labels.length === 0) {
      _tmp$10 = _M0FP314vlmkit_2dsites4code4main2el("p", [_M0FP314vlmkit_2dsites4code4main3cls("muted small")], [_M0FP314vlmkit_2dsites4code4main1t("None yet")]);
    } else {
      const _tmp$11 = [_M0FP314vlmkit_2dsites4code4main3cls("chips")];
      const _p$4 = i.labels;
      const _p$5 = new Array(_p$4.length);
      const _p$6 = _p$4.length;
      let _tmp$12 = 0;
      while (true) {
        const _p$7 = _tmp$12;
        if (_p$7 < _p$6) {
          const _p$8 = _p$4[_p$7];
          _p$5[_p$7] = _M0FP314vlmkit_2dsites4code4main11label__chip(_p$8);
          _tmp$12 = _p$7 + 1 | 0;
          continue;
        } else {
          break;
        }
      }
      _tmp$10 = _M0FP314vlmkit_2dsites4code4main2el("p", _tmp$11, _p$5);
    }
    return _M0FP314vlmkit_2dsites4code4main2el("div", _tmp$2, [_tmp$3, _tmp$4, _tmp$5, _M0FP314vlmkit_2dsites4code4main2el("div", _tmp$6, [_tmp$7, _M0FP314vlmkit_2dsites4code4main2el("aside", _tmp$8, [_tmp$9, _tmp$10, _M0FP314vlmkit_2dsites4code4main2el("h3", [_M0FP314vlmkit_2dsites4code4main3cls("side-h3")], [_M0FP314vlmkit_2dsites4code4main1t("Milestone")]), _M0FP314vlmkit_2dsites4code4main2el("p", [_M0FP314vlmkit_2dsites4code4main3cls("muted small")], [_M0FP314vlmkit_2dsites4code4main1t(i.milestone === "" ? "No milestone" : i.milestone)]), _M0FP314vlmkit_2dsites4code4main2el("h3", [_M0FP314vlmkit_2dsites4code4main3cls("side-h3")], [_M0FP314vlmkit_2dsites4code4main1t("Assignees")]), _M0FP314vlmkit_2dsites4code4main2el("p", [_M0FP314vlmkit_2dsites4code4main3cls("muted small")], [_M0FP314vlmkit_2dsites4code4main1t(i.assignee === "" ? "No one assigned" : i.assignee)])])])]);
  }
  function _M0FP314vlmkit_2dsites4code4main13submit__issue() {
    const title = _M0MPC16string10StringView9to__owned(_M0MPC16string6String12trim_2einner(_M0FP314vlmkit_2dsites4code4main10get__value("#new-title"), _M0FP314vlmkit_2dsites4code4main13submit__issueN6recordS2950));
    if (title === "") {
      _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4code4main10new__error, true);
      _M0FP314vlmkit_2dsites4code4main10focus__sel("#new-title");
      return undefined;
    }
    const body = _M0FP314vlmkit_2dsites4code4main10get__value("#new-body");
    let top = 0;
    const _bind = _M0MP26mizchi7signals6Signal3getGRPB5ArrayGRP314vlmkit_2dsites4code4main5IssueEE(_M0FP314vlmkit_2dsites4code4main6issues);
    const _bind$2 = _bind.length;
    let _tmp = 0;
    while (true) {
      const _ = _tmp;
      if (_ < _bind$2) {
        const i = _bind[_];
        if (i.num > top) {
          top = i.num;
        }
        _tmp = _ + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    const issue = new _M0TP314vlmkit_2dsites4code4main5Issue(top + 1 | 0, title, true, [], "you", "just now", 0, "", "", "", body === "" ? "No description provided." : body);
    _M0FP26mizchi7signals5batchGuE(() => {
      _M0MP26mizchi7signals6Signal6updateGRPB5ArrayGRP314vlmkit_2dsites4code4main5IssueEE(_M0FP314vlmkit_2dsites4code4main6issues, (arr) => _M0IPC15array5ArrayPB3Add3addGRP36mizchi4luna3dom7DomNodeE([issue], arr));
      _M0MP26mizchi7signals6Signal3setGsE(_M0FP314vlmkit_2dsites4code4main10new__title, "");
      _M0MP26mizchi7signals6Signal3setGsE(_M0FP314vlmkit_2dsites4code4main9new__body, "");
      _M0MP26mizchi7signals6Signal3setGsE(_M0FP314vlmkit_2dsites4code4main8new__tab, "write");
      _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4code4main10new__error, false);
      _M0MP26mizchi7signals6Signal3setGsE(_M0FP314vlmkit_2dsites4code4main2iq, "is:issue is:open");
    });
    _M0FP314vlmkit_2dsites4code4main9set__hash("#/issues");
  }
  function _M0FP314vlmkit_2dsites4code4main5keyed(key, render) {
    return _M0FP36mizchi4luna3dom9for__eachGsE(() => [key()], (k, _i) => render(k));
  }
  function _M0FP314vlmkit_2dsites4code4main7tablist(id, tabs, sel, klass) {
    const _p = new Array(tabs.length);
    const _p$2 = tabs.length;
    let _tmp = 0;
    while (true) {
      const _p$3 = _tmp;
      if (_p$3 < _p$2) {
        const _p$4 = tabs[_p$3];
        _p[_p$3] = _p$4._0;
        _tmp = _p$3 + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    const keys = _p;
    const _tmp$2 = _M0FP314vlmkit_2dsites4code4main3a__("role", "tablist");
    const _tmp$3 = _M0FP314vlmkit_2dsites4code4main3cls(klass);
    const _p$3 = new Array(tabs.length);
    const _p$4 = tabs.length;
    let _tmp$4 = 0;
    while (true) {
      const _p$5 = _tmp$4;
      if (_p$5 < _p$4) {
        const _p$6 = tabs[_p$5];
        _p$3[_p$5] = _p$6._1;
        _tmp$4 = _p$5 + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    const _tmp$5 = [_tmp$2, _tmp$3, _M0FP314vlmkit_2dsites4code4main3a__("aria-label", _M0MPC15array5Array4joinGsE(_p$3, _M0FP314vlmkit_2dsites4code4main7tablistN6recordS2965))];
    const _p$5 = new Array(tabs.length);
    const _p$6 = tabs.length;
    let _tmp$6 = 0;
    while (true) {
      const _p$7 = _tmp$6;
      if (_p$7 < _p$6) {
        const _p$8 = tabs[_p$7];
        const _p$9 = _p$8._0;
        const _p$10 = _p$8._1;
        _p$5[_p$7] = _M0FP314vlmkit_2dsites4code4main2el("button", [_M0FP314vlmkit_2dsites4code4main3a__("type", "button"), _M0FP314vlmkit_2dsites4code4main3a__("role", "tab"), _M0FP314vlmkit_2dsites4code4main3a__("id", `${id}-tab-${_p$9}`), _M0FP314vlmkit_2dsites4code4main3a__("aria-controls", `${id}-panel`), _M0FP314vlmkit_2dsites4code4main2ad("aria-selected", () => {
          const _p$11 = _M0MP26mizchi7signals6Signal3getGsE(sel) === _p$9;
          return _p$11 ? "true" : "false";
        }), _M0FP314vlmkit_2dsites4code4main2ad("tabindex", () => _M0MP26mizchi7signals6Signal3getGsE(sel) === _p$9 ? "0" : "-1"), _M0FP314vlmkit_2dsites4code4main2ad("class", () => `tab${_M0MP26mizchi7signals6Signal3getGsE(sel) === _p$9 ? " is-selected" : ""}`), _M0FP314vlmkit_2dsites4code4main2on("click", (_p$11) => {
          _M0MP26mizchi7signals6Signal3setGsE(sel, _p$9);
        }), _M0FP314vlmkit_2dsites4code4main2on("keydown", (_p$11) => {
          const _p$12 = _M0FP314vlmkit_2dsites4code4main7ev__key(_p$11);
          const _p$13 = keys.length;
          const _p$14 = _M0MPC15array5Array6searchGsE(keys, _M0MP26mizchi7signals6Signal3getGsE(sel));
          let _p$15;
          if (_p$14 === undefined) {
            _p$15 = 0;
          } else {
            const _p$16 = _p$14;
            _p$15 = _p$16;
          }
          const _p$16 = _p$12 === "ArrowRight" ? (_p$15 + 1 | 0) % _p$13 | 0 : _p$12 === "ArrowLeft" ? ((_p$15 + _p$13 | 0) - 1 | 0) % _p$13 | 0 : _p$12 === "Home" ? 0 : _p$12 === "End" ? _p$13 - 1 | 0 : -1;
          if (_p$16 >= 0) {
            _M0FP314vlmkit_2dsites4code4main7prevent(_p$11);
            _M0MP26mizchi7signals6Signal3setGsE(sel, _M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(keys, _p$16));
            _M0FP314vlmkit_2dsites4code4main10focus__sel(`#${id}-tab-${_M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(keys, _p$16)}`);
            return;
          } else {
            return;
          }
        })], [_M0FP314vlmkit_2dsites4code4main1t(_p$10)]);
        _tmp$6 = _p$7 + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return _M0FP314vlmkit_2dsites4code4main2el("div", _tmp$5, _p$5);
  }
  function _M0FP314vlmkit_2dsites4code4main16new__issue__view() {
    return _M0FP314vlmkit_2dsites4code4main2el("div", [_M0FP314vlmkit_2dsites4code4main3cls("new-issue")], [_M0FP314vlmkit_2dsites4code4main2el("p", [], [_M0FP314vlmkit_2dsites4code4main2el("a", [_M0FP314vlmkit_2dsites4code4main3a__("href", "#/issues"), _M0FP314vlmkit_2dsites4code4main3cls("link small")], [_M0FP314vlmkit_2dsites4code4main1t("← All issues")])]), _M0FP314vlmkit_2dsites4code4main2el("h2", [_M0FP314vlmkit_2dsites4code4main3cls("view-h")], [_M0FP314vlmkit_2dsites4code4main1t("Create new issue")]), _M0FP314vlmkit_2dsites4code4main2el("form", [_M0FP314vlmkit_2dsites4code4main3cls("new-form"), _M0FP314vlmkit_2dsites4code4main3a__("novalidate", ""), _M0FP314vlmkit_2dsites4code4main2on("submit", (e) => {
      _M0FP314vlmkit_2dsites4code4main7prevent(e);
      _M0FP314vlmkit_2dsites4code4main13submit__issue();
    })], [_M0FP314vlmkit_2dsites4code4main2el("div", [_M0FP314vlmkit_2dsites4code4main3cls("field")], [_M0FP314vlmkit_2dsites4code4main2el("label", [_M0FP314vlmkit_2dsites4code4main3a__("for", "new-title"), _M0FP314vlmkit_2dsites4code4main3cls("field-label")], [_M0FP314vlmkit_2dsites4code4main1t("Title "), _M0FP314vlmkit_2dsites4code4main2el("span", [_M0FP314vlmkit_2dsites4code4main3cls("req"), _M0FP314vlmkit_2dsites4code4main3a__("aria-hidden", "true")], [_M0FP314vlmkit_2dsites4code4main1t("*")])]), _M0FP314vlmkit_2dsites4code4main2el("input", [_M0FP314vlmkit_2dsites4code4main3a__("id", "new-title"), _M0FP314vlmkit_2dsites4code4main3a__("type", "text"), _M0FP314vlmkit_2dsites4code4main3cls("input"), _M0FP314vlmkit_2dsites4code4main3a__("required", ""), _M0FP314vlmkit_2dsites4code4main3a__("autocomplete", "off"), _M0FP314vlmkit_2dsites4code4main3a__("value", _M0MP26mizchi7signals6Signal3getGsE(_M0FP314vlmkit_2dsites4code4main10new__title)), _M0FP314vlmkit_2dsites4code4main2ad("aria-invalid", () => {
      const _p = _M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4code4main10new__error);
      return _p ? "true" : "false";
    }), _M0FP314vlmkit_2dsites4code4main3a__("aria-describedby", "new-title-err"), _M0FP314vlmkit_2dsites4code4main2on("input", (e) => {
      _M0MP26mizchi7signals6Signal3setGsE(_M0FP314vlmkit_2dsites4code4main10new__title, _M0FP314vlmkit_2dsites4code4main9ev__value(e));
      if (_M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4code4main10new__error)) {
        _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4code4main10new__error, false);
        return;
      } else {
        return;
      }
    })], []), _M0FP314vlmkit_2dsites4code4main2el("p", [_M0FP314vlmkit_2dsites4code4main3a__("id", "new-title-err"), _M0FP314vlmkit_2dsites4code4main3cls("field-err"), _M0FP314vlmkit_2dsites4code4main3a__("role", "alert")], [_M0FP314vlmkit_2dsites4code4main2td(() => _M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4code4main10new__error) ? "A title is required." : "")])]), _M0FP314vlmkit_2dsites4code4main2el("div", [_M0FP314vlmkit_2dsites4code4main3cls("field")], [_M0FP314vlmkit_2dsites4code4main2el("span", [_M0FP314vlmkit_2dsites4code4main3cls("field-label"), _M0FP314vlmkit_2dsites4code4main3a__("id", "new-body-l")], [_M0FP314vlmkit_2dsites4code4main1t("Add a description")]), _M0FP314vlmkit_2dsites4code4main2el("div", [_M0FP314vlmkit_2dsites4code4main3cls("editor")], [_M0FP314vlmkit_2dsites4code4main2el("div", [_M0FP314vlmkit_2dsites4code4main3cls("editor-head")], [_M0FP314vlmkit_2dsites4code4main7tablist("nt", [_M0FP314vlmkit_2dsites4code4main16new__issue__viewN5tupleS2984, _M0FP314vlmkit_2dsites4code4main16new__issue__viewN5tupleS2985], _M0FP314vlmkit_2dsites4code4main8new__tab, "editor-tabs"), _M0FP314vlmkit_2dsites4code4main2el("span", [_M0FP314vlmkit_2dsites4code4main3cls("muted small")], [_M0FP314vlmkit_2dsites4code4main1t("Markdown is supported")])]), _M0FP314vlmkit_2dsites4code4main2el("div", [_M0FP314vlmkit_2dsites4code4main3a__("id", "nt-panel"), _M0FP314vlmkit_2dsites4code4main3a__("role", "tabpanel"), _M0FP314vlmkit_2dsites4code4main2ad("aria-labelledby", () => `nt-tab-${_M0MP26mizchi7signals6Signal3getGsE(_M0FP314vlmkit_2dsites4code4main8new__tab)}`)], [_M0FP314vlmkit_2dsites4code4main2el("textarea", [_M0FP314vlmkit_2dsites4code4main3a__("id", "new-body"), _M0FP314vlmkit_2dsites4code4main2ad("class", () => `textarea${_M0MP26mizchi7signals6Signal3getGsE(_M0FP314vlmkit_2dsites4code4main8new__tab) === "write" ? "" : " is-off"}`), _M0FP314vlmkit_2dsites4code4main3a__("rows", "10"), _M0FP314vlmkit_2dsites4code4main3a__("aria-labelledby", "new-body-l"), _M0FP314vlmkit_2dsites4code4main3a__("placeholder", "Type your description here…"), _M0FP314vlmkit_2dsites4code4main2on("input", (e) => {
      _M0MP26mizchi7signals6Signal3setGsE(_M0FP314vlmkit_2dsites4code4main9new__body, _M0FP314vlmkit_2dsites4code4main9ev__value(e));
    })], [_M0FP314vlmkit_2dsites4code4main1t(_M0MP26mizchi7signals6Signal3getGsE(_M0FP314vlmkit_2dsites4code4main9new__body))]), _M0FP36mizchi4luna3dom4show(() => _M0MP26mizchi7signals6Signal3getGsE(_M0FP314vlmkit_2dsites4code4main8new__tab) === "preview", () => _M0FP314vlmkit_2dsites4code4main2el("div", [_M0FP314vlmkit_2dsites4code4main3cls("markdown preview")], [_M0FP314vlmkit_2dsites4code4main5keyed(() => _M0MP26mizchi7signals6Signal3getGsE(_M0FP314vlmkit_2dsites4code4main9new__body), (b) => _M0MPC16string10StringView9to__owned(_M0MPC16string6String12trim_2einner(b, _M0FP314vlmkit_2dsites4code4main16new__issue__viewN6recordS2986)) === "" ? _M0FP314vlmkit_2dsites4code4main2el("p", [_M0FP314vlmkit_2dsites4code4main3cls("muted")], [_M0FP314vlmkit_2dsites4code4main1t("Nothing to preview")]) : _M0FP314vlmkit_2dsites4code4main2el("div", [], _M0FP314vlmkit_2dsites4code4main10md__blocks(b, "preview")))]))])])]), _M0FP314vlmkit_2dsites4code4main2el("div", [_M0FP314vlmkit_2dsites4code4main3cls("form-foot")], [_M0FP314vlmkit_2dsites4code4main2el("a", [_M0FP314vlmkit_2dsites4code4main3a__("href", "#/issues"), _M0FP314vlmkit_2dsites4code4main3cls("btn")], [_M0FP314vlmkit_2dsites4code4main1t("Cancel")]), _M0FP314vlmkit_2dsites4code4main2el("button", [_M0FP314vlmkit_2dsites4code4main3a__("type", "submit"), _M0FP314vlmkit_2dsites4code4main3cls("btn btn-primary")], [_M0FP314vlmkit_2dsites4code4main1t("Submit new issue")])])])]);
  }
  function _M0FP314vlmkit_2dsites4code4main11pulls__view() {
    const _tmp = [_M0FP314vlmkit_2dsites4code4main3cls("issues")];
    const _tmp$2 = _M0FP314vlmkit_2dsites4code4main2el("div", [_M0FP314vlmkit_2dsites4code4main3cls("issues-head")], [_M0FP314vlmkit_2dsites4code4main2el("h2", [_M0FP314vlmkit_2dsites4code4main3cls("view-h")], [_M0FP314vlmkit_2dsites4code4main1t("Pull requests")])]);
    const _tmp$3 = [_M0FP314vlmkit_2dsites4code4main3cls("issue-box")];
    const _tmp$4 = _M0FP314vlmkit_2dsites4code4main2el("div", [_M0FP314vlmkit_2dsites4code4main3cls("issue-box-head")], [_M0FP314vlmkit_2dsites4code4main2el("p", [_M0FP314vlmkit_2dsites4code4main3cls("state-btn is-on static")], [_M0FP314vlmkit_2dsites4code4main4icon("pr"), _M0FP314vlmkit_2dsites4code4main2el("span", [], [_M0FP314vlmkit_2dsites4code4main1t(_M0MPC13int3Int18to__string_2einner(_M0FP314vlmkit_2dsites4code4main5pulls.length, 10))]), _M0FP314vlmkit_2dsites4code4main2el("span", [], [_M0FP314vlmkit_2dsites4code4main1t("Open")])])]);
    const _tmp$5 = [_M0FP314vlmkit_2dsites4code4main3cls("issue-list"), _M0FP314vlmkit_2dsites4code4main3a__("aria-label", "Pull requests")];
    const _p = new Array(_M0FP314vlmkit_2dsites4code4main5pulls.length);
    const _p$2 = _M0FP314vlmkit_2dsites4code4main5pulls.length;
    let _tmp$6 = 0;
    while (true) {
      const _p$3 = _tmp$6;
      if (_p$3 < _p$2) {
        const _p$4 = _M0FP314vlmkit_2dsites4code4main5pulls[_p$3];
        const _tmp$7 = [_M0FP314vlmkit_2dsites4code4main3cls("issue-row")];
        const _tmp$8 = _M0FP314vlmkit_2dsites4code4main2el("span", [_M0FP314vlmkit_2dsites4code4main3cls("st st-open"), _M0FP314vlmkit_2dsites4code4main3a__("role", "img"), _M0FP314vlmkit_2dsites4code4main3a__("aria-label", "Open pull request")], [_M0FP314vlmkit_2dsites4code4main4icon("pr")]);
        const _tmp$9 = [_M0FP314vlmkit_2dsites4code4main3cls("issue-main")];
        const _tmp$10 = [_M0FP314vlmkit_2dsites4code4main3cls("issue-title-line")];
        const _tmp$11 = _M0FP314vlmkit_2dsites4code4main2el("span", [_M0FP314vlmkit_2dsites4code4main3cls("issue-title")], [_M0FP314vlmkit_2dsites4code4main1t(_p$4.title)]);
        const _tmp$12 = [_M0FP314vlmkit_2dsites4code4main3cls("chips")];
        const _p$5 = _p$4.labels;
        const _p$6 = new Array(_p$5.length);
        const _p$7 = _p$5.length;
        let _tmp$13 = 0;
        while (true) {
          const _p$8 = _tmp$13;
          if (_p$8 < _p$7) {
            const _p$9 = _p$5[_p$8];
            _p$6[_p$8] = _M0FP314vlmkit_2dsites4code4main11label__chip(_p$9);
            _tmp$13 = _p$8 + 1 | 0;
            continue;
          } else {
            break;
          }
        }
        _p[_p$3] = _M0FP314vlmkit_2dsites4code4main2el("li", _tmp$7, [_tmp$8, _M0FP314vlmkit_2dsites4code4main2el("div", _tmp$9, [_M0FP314vlmkit_2dsites4code4main2el("p", _tmp$10, [_tmp$11, _M0FP314vlmkit_2dsites4code4main2el("span", _tmp$12, _p$6)]), _M0FP314vlmkit_2dsites4code4main2el("p", [_M0FP314vlmkit_2dsites4code4main3cls("issue-meta")], [_M0FP314vlmkit_2dsites4code4main1t(`#${_M0MPC13int3Int18to__string_2einner(_p$4.num, 10)} opened ${_p$4.ago} by ${_p$4.author}`)])]), _p$4.comments > 0 ? _M0FP314vlmkit_2dsites4code4main2el("span", [_M0FP314vlmkit_2dsites4code4main3cls("issue-comments"), _M0FP314vlmkit_2dsites4code4main3a__("aria-label", _M0FP314vlmkit_2dsites4code4main6plural(_p$4.comments, "comment", "comments"))], [_M0FP314vlmkit_2dsites4code4main4icon("comment"), _M0FP314vlmkit_2dsites4code4main1t(_M0MPC13int3Int18to__string_2einner(_p$4.comments, 10))]) : _M0FP314vlmkit_2dsites4code4main2el("span", [_M0FP314vlmkit_2dsites4code4main3cls("issue-comments")], [])]);
        _tmp$6 = _p$3 + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return _M0FP314vlmkit_2dsites4code4main2el("div", _tmp, [_tmp$2, _M0FP314vlmkit_2dsites4code4main2el("div", _tmp$3, [_tmp$4, _M0FP314vlmkit_2dsites4code4main2el("ul", _tmp$5, _p)])]);
  }
  function _M0FP314vlmkit_2dsites4code4main9tab__view(name) {
    let ic;
    let h;
    let p;
    _L: {
      switch (name) {
        case "actions": {
          ic = "play";
          h = "Pipelines run on Forgeyard Actions";
          p = "The ci workflow tests every push on Node 22 and 24. Runs are not part of this demo.";
          break _L;
        }
        case "security": {
          ic = "shield";
          h = "No security advisories";
          p = "Lantern has published no advisories. Report a vulnerability privately to the maintainers.";
          break _L;
        }
        default: {
          ic = "graph";
          h = "Insights";
          p = "1,284 commits by 27 contributors since 2022. Charts are not part of this demo.";
          break _L;
        }
      }
    }
    return _M0FP314vlmkit_2dsites4code4main2el("div", [_M0FP314vlmkit_2dsites4code4main3cls("blank")], [_M0FP314vlmkit_2dsites4code4main7icon__c(ic, "ic blank-ic"), _M0FP314vlmkit_2dsites4code4main2el("h2", [_M0FP314vlmkit_2dsites4code4main3cls("blank-h")], [_M0FP314vlmkit_2dsites4code4main1t(h)]), _M0FP314vlmkit_2dsites4code4main2el("p", [_M0FP314vlmkit_2dsites4code4main3cls("muted")], [_M0FP314vlmkit_2dsites4code4main1t(p)]), _M0FP314vlmkit_2dsites4code4main2el("p", [], [_M0FP314vlmkit_2dsites4code4main2el("a", [_M0FP314vlmkit_2dsites4code4main3a__("href", "#/"), _M0FP314vlmkit_2dsites4code4main3cls("link")], [_M0FP314vlmkit_2dsites4code4main1t("Back to the code")])])]);
  }
  function _M0FP314vlmkit_2dsites4code4main8basename(path) {
    const _bind = _M0MPC16string6String9rev__find(path, _M0FP314vlmkit_2dsites4code4main8basenameN6recordS2997);
    if (_bind === undefined) {
      return path;
    } else {
      const _Some = _bind;
      const _i = _Some;
      return _M0MPC16string6String17substring_2einner(path, _i + 1 | 0, undefined);
    }
  }
  function _M0FP314vlmkit_2dsites4code4main13blame__chunks(path, lines) {
    let seed = 7;
    const _bind = path.length;
    let _tmp = 0;
    while (true) {
      const _string_index = _tmp;
      if (_string_index < _bind) {
        let _decoded_next_string_index;
        let _decoded_char;
        _L: {
          const _bind$2 = path.charCodeAt(_string_index);
          if (_bind$2 >= 55296 && _bind$2 <= 56319 && (_string_index + 1 | 0) < _bind) {
            const _bind$3 = path.charCodeAt(_string_index + 1 | 0);
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
        seed = ((Math.imul(seed, 31) | 0) + _decoded_char | 0) % 10007 | 0;
        _tmp = _decoded_next_string_index;
        continue;
      } else {
        break;
      }
    }
    const out = [];
    let at = 1;
    while (true) {
      if (at <= lines) {
        seed = ((Math.imul(seed, 7919) | 0) + 17 | 0) % 10007 | 0;
        const len = 2 + (seed % 7 | 0) | 0;
        const n = ((at + len | 0) - 1 | 0) > lines ? (lines - at | 0) + 1 | 0 : len;
        _M0MPC15array5Array4pushGUssEE(out, { _0: at, _1: n, _2: _M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(_M0FP314vlmkit_2dsites4code4main14blame__commits, (seed / 7 | 0) % _M0FP314vlmkit_2dsites4code4main14blame__commits.length | 0) });
        at = at + n | 0;
        continue;
      } else {
        break;
      }
    }
    return out;
  }
  function _M0FP314vlmkit_2dsites4code4main8lang__of(path) {
    return _M0MPC16string6String11has__suffix(path, _M0FP314vlmkit_2dsites4code4main8lang__ofN6recordS3018) || _M0MPC16string6String11has__suffix(path, _M0FP314vlmkit_2dsites4code4main8lang__ofN6recordS3019) ? "ts" : _M0MPC16string6String11has__suffix(path, _M0FP314vlmkit_2dsites4code4main8lang__ofN6recordS3020) ? "json" : _M0MPC16string6String11has__suffix(path, _M0FP314vlmkit_2dsites4code4main8lang__ofN6recordS3021) || (_M0MPC16string6String11has__suffix(path, _M0FP314vlmkit_2dsites4code4main8lang__ofN6recordS3022) || (_M0MPC16string6String11has__suffix(path, _M0FP314vlmkit_2dsites4code4main8lang__ofN6recordS3023) || _M0MPC16string6String11has__suffix(path, _M0FP314vlmkit_2dsites4code4main8lang__ofN6recordS3024))) ? "hash" : _M0MPC16string6String11has__suffix(path, _M0FP314vlmkit_2dsites4code4main8lang__ofN6recordS3025) ? "md" : "text";
  }
  function _M0FP314vlmkit_2dsites4code4main9sel__hash(path, a, b) {
    return a === 0 ? `#/blob/${path}` : a === b ? `#/blob/${path}#L${_M0MPC13int3Int18to__string_2einner(a, 10)}` : `#/blob/${path}#L${_M0MPC13int3Int18to__string_2einner(a, 10)}-L${_M0MPC13int3Int18to__string_2einner(b, 10)}`;
  }
  function _M0FP314vlmkit_2dsites4code4main13select__lines(path, a, b) {
    let x;
    let y;
    _L: {
      if (a <= b) {
        x = a;
        y = b;
        break _L;
      } else {
        x = b;
        y = a;
        break _L;
      }
    }
    _M0FP26mizchi7signals5batchGuE(() => {
      _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4code4main9sel__from, x);
      _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4code4main7sel__to, y);
    });
    _M0FP314vlmkit_2dsites4code4main13replace__hash(_M0FP314vlmkit_2dsites4code4main9sel__hash(path, x, y));
  }
  function _M0FP314vlmkit_2dsites4code4main9line__row(path, n, line_nodes, blame) {
    const cells = [];
    if (blame === undefined) {
    } else {
      const _Some = blame;
      const _b = _Some;
      _M0MPC15array5Array4pushGUssEE(cells, _b);
    }
    _M0MPC15array5Array4pushGUssEE(cells, _M0FP314vlmkit_2dsites4code4main2el("td", [_M0FP314vlmkit_2dsites4code4main3cls("ln")], [_M0FP314vlmkit_2dsites4code4main2el("a", [_M0FP314vlmkit_2dsites4code4main3a__("href", _M0FP314vlmkit_2dsites4code4main9sel__hash(path, n, n)), _M0FP314vlmkit_2dsites4code4main3a__("id", `L${_M0MPC13int3Int18to__string_2einner(n, 10)}`), _M0FP314vlmkit_2dsites4code4main3cls("ln-btn"), _M0FP314vlmkit_2dsites4code4main3a__("aria-label", `Line ${_M0MPC13int3Int18to__string_2einner(n, 10)}`), _M0FP314vlmkit_2dsites4code4main2on("click", (e) => {
      _M0FP314vlmkit_2dsites4code4main7prevent(e);
      if (_M0FP314vlmkit_2dsites4code4main9ev__shift(e) && _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4code4main9sel__from) > 0) {
        _M0FP314vlmkit_2dsites4code4main13select__lines(path, _M0FP314vlmkit_2dsites4code4main11sel__anchor.val, n);
        return;
      } else {
        _M0FP314vlmkit_2dsites4code4main11sel__anchor.val = n;
        _M0FP314vlmkit_2dsites4code4main13select__lines(path, n, n);
        return;
      }
    })], [_M0FP314vlmkit_2dsites4code4main1t(_M0MPC13int3Int18to__string_2einner(n, 10))])]));
    _M0MPC15array5Array4pushGUssEE(cells, _M0FP314vlmkit_2dsites4code4main2el("td", [_M0FP314vlmkit_2dsites4code4main3cls("lc")], [_M0FP314vlmkit_2dsites4code4main2el("span", [_M0FP314vlmkit_2dsites4code4main3cls("lc-in")], line_nodes)]));
    return _M0FP314vlmkit_2dsites4code4main2el("tr", [_M0FP314vlmkit_2dsites4code4main2ad("class", () => {
      const a = _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4code4main9sel__from);
      const b = _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4code4main7sel__to);
      return a > 0 && (n >= a && n <= b) ? "line is-sel" : "line";
    })], cells);
  }
  function _M0FP314vlmkit_2dsites4code4main11code__table(path, text, with_blame) {
    const lines = _M0MPB4Iter9to__arrayGRPC16string10StringViewE(_M0MPB4Iter3mapGRPC16string10StringViewsE(_M0MPC16string6String5split(text, _M0FP314vlmkit_2dsites4code4main11code__tableN6recordS3046), (s) => _M0MPC16string10StringView9to__owned(s)));
    const lang = _M0FP314vlmkit_2dsites4code4main8lang__of(path);
    const state = _M0MPC13ref3Ref3RefGbE(false);
    const chunks = _M0FP314vlmkit_2dsites4code4main13blame__chunks(path, lines.length);
    const rows = [];
    const _bind = lines.length;
    let _tmp = 0;
    while (true) {
      const i = _tmp;
      if (i < _bind) {
        const line = lines[i];
        const n = i + 1 | 0;
        const nodes = _M0FP314vlmkit_2dsites4code4main12token__nodes(_M0FP314vlmkit_2dsites4code4main6tokens(line, lang, state));
        let blame;
        if (with_blame) {
          let cell = undefined;
          const _bind$2 = chunks.length;
          let _tmp$2 = 0;
          while (true) {
            const _ = _tmp$2;
            if (_ < _bind$2) {
              const ch = chunks[_];
              const _start = ch._0;
              const _len = ch._1;
              const _c = ch._2;
              if (_start === n) {
                cell = _M0FP314vlmkit_2dsites4code4main2el("td", [_M0FP314vlmkit_2dsites4code4main3cls("blame"), _M0FP314vlmkit_2dsites4code4main3a__("rowspan", _M0MPC13int3Int18to__string_2einner(_len, 10))], [_M0FP314vlmkit_2dsites4code4main2el("div", [_M0FP314vlmkit_2dsites4code4main3cls("blame-in")], [_M0FP314vlmkit_2dsites4code4main2el("span", [_M0FP314vlmkit_2dsites4code4main3cls("blame-age")], [_M0FP314vlmkit_2dsites4code4main1t(_c.age)]), _M0FP314vlmkit_2dsites4code4main2el("span", [_M0FP314vlmkit_2dsites4code4main3cls("blame-msg")], [_M0FP314vlmkit_2dsites4code4main6avatar(_c.author, 16), _M0FP314vlmkit_2dsites4code4main2el("a", [_M0FP314vlmkit_2dsites4code4main3a__("href", "#/"), _M0FP314vlmkit_2dsites4code4main3cls("blame-link")], [_M0FP314vlmkit_2dsites4code4main1t(_c.msg)])])])]);
              }
              _tmp$2 = _ + 1 | 0;
              continue;
            } else {
              break;
            }
          }
          const _bind$3 = cell;
          blame = _bind$3 === undefined ? undefined : cell;
        } else {
          blame = undefined;
        }
        _M0MPC15array5Array4pushGUssEE(rows, _M0FP314vlmkit_2dsites4code4main9line__row(path, n, nodes.length === 0 ? [_M0FP314vlmkit_2dsites4code4main1t("​")] : nodes, blame));
        _tmp = i + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return _M0FP314vlmkit_2dsites4code4main2el("div", [_M0FP314vlmkit_2dsites4code4main2ad("class", () => `code-scroll${_M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4code4main11wrap__lines) ? " is-wrap" : ""}`), _M0FP314vlmkit_2dsites4code4main3a__("tabindex", "0"), _M0FP314vlmkit_2dsites4code4main3a__("role", "region"), _M0FP314vlmkit_2dsites4code4main3a__("aria-label", "File contents")], [_M0FP314vlmkit_2dsites4code4main2el("table", [_M0FP314vlmkit_2dsites4code4main3cls(with_blame ? "code with-blame" : "code")], [_M0FP314vlmkit_2dsites4code4main2el("caption", [_M0FP314vlmkit_2dsites4code4main3cls("sr-only")], [_M0FP314vlmkit_2dsites4code4main1t(_M0FP314vlmkit_2dsites4code4main8basename(path))]), _M0FP314vlmkit_2dsites4code4main2el("tbody", [], rows)])]);
  }
  function _M0FP314vlmkit_2dsites4code4main6crumbs(path, last_is_link) {
    const parts = path === "" ? [] : _M0MPB4Iter9to__arrayGRPC16string10StringViewE(_M0MPB4Iter3mapGRPC16string10StringViewsE(_M0MPC16string6String5split(path, _M0FP314vlmkit_2dsites4code4main6crumbsN6recordS3072), (s) => _M0MPC16string10StringView9to__owned(s)));
    const out = [_M0FP314vlmkit_2dsites4code4main2el("a", [_M0FP314vlmkit_2dsites4code4main3a__("href", "#/"), _M0FP314vlmkit_2dsites4code4main3cls("crumb crumb-root")], [_M0FP314vlmkit_2dsites4code4main1t(_M0FP314vlmkit_2dsites4code4main10repo__name)])];
    let acc = "";
    const _bind = parts.length;
    let _tmp = 0;
    while (true) {
      const i = _tmp;
      if (i < _bind) {
        const p = parts[i];
        acc = acc === "" ? p : `${acc}/${p}`;
        _M0MPC15array5Array4pushGUssEE(out, _M0FP314vlmkit_2dsites4code4main2el("span", [_M0FP314vlmkit_2dsites4code4main3cls("crumb-sep"), _M0FP314vlmkit_2dsites4code4main3a__("aria-hidden", "true")], [_M0FP314vlmkit_2dsites4code4main1t("/")]));
        if (i === (parts.length - 1 | 0) && !last_is_link) {
          _M0MPC15array5Array4pushGUssEE(out, _M0FP314vlmkit_2dsites4code4main2el("strong", [_M0FP314vlmkit_2dsites4code4main3cls("crumb crumb-current"), _M0FP314vlmkit_2dsites4code4main3a__("aria-current", "page")], [_M0FP314vlmkit_2dsites4code4main1t(p)]));
        } else {
          _M0MPC15array5Array4pushGUssEE(out, _M0FP314vlmkit_2dsites4code4main2el("a", [_M0FP314vlmkit_2dsites4code4main3a__("href", `#/tree/${acc}`), _M0FP314vlmkit_2dsites4code4main3cls("crumb")], [_M0FP314vlmkit_2dsites4code4main1t(p)]));
        }
        _tmp = i + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return _M0FP314vlmkit_2dsites4code4main2el("nav", [_M0FP314vlmkit_2dsites4code4main3a__("aria-label", "Breadcrumb"), _M0FP314vlmkit_2dsites4code4main3cls("crumbs")], out);
  }
  function _M0FP314vlmkit_2dsites4code4main9entry__of(path) {
    const _bind = _M0FP314vlmkit_2dsites4code4main4tree.length;
    let _tmp = 0;
    while (true) {
      const _ = _tmp;
      if (_ < _bind) {
        const e = _M0FP314vlmkit_2dsites4code4main4tree[_];
        if (e.path === path) {
          return e;
        }
        _tmp = _ + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return undefined;
  }
  function _M0FP314vlmkit_2dsites4code4main7dirname(path) {
    const _bind = _M0MPC16string6String9rev__find(path, _M0FP314vlmkit_2dsites4code4main7dirnameN6recordS3088);
    if (_bind === undefined) {
      return "";
    } else {
      const _Some = _bind;
      const _i = _Some;
      return _M0MPC16string6String17substring_2einner(path, 0, _i);
    }
  }
  function _M0FP314vlmkit_2dsites4code4main10file__text(path) {
    switch (path) {
      case "README.md": {
        return _M0FP314vlmkit_2dsites4code4main11readme__src;
      }
      case "src/core/build.ts": {
        return _M0FP314vlmkit_2dsites4code4main9build__ts;
      }
      case "src/render/markdown.ts": {
        return _M0FP314vlmkit_2dsites4code4main12markdown__ts;
      }
      case "src/cli.ts": {
        return _M0FP314vlmkit_2dsites4code4main7cli__ts;
      }
      case "src/config.ts": {
        return _M0FP314vlmkit_2dsites4code4main10config__ts;
      }
      case "package.json": {
        return _M0FP314vlmkit_2dsites4code4main13package__json;
      }
      case ".github/workflows/ci.yml": {
        return _M0FP314vlmkit_2dsites4code4main7ci__yml;
      }
      case "LICENSE": {
        return "MIT License\n\nCopyright (c) 2022 Tidewater contributors\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\nof this software, to deal in the software without restriction.";
      }
      case ".editorconfig": {
        return "root = true\n\n[*]\nindent_style = space\nindent_size = 2\nend_of_line = lf";
      }
      case ".gitignore": {
        return "node_modules/\ndist/\n.lantern/";
      }
      case "tsconfig.json": {
        return "{\n  \"compilerOptions\": { \"target\": \"ES2023\", \"module\": \"NodeNext\", \"strict\": true, \"outDir\": \"dist\" },\n  \"include\": [\"src\"]\n}";
      }
      case "CHANGELOG.md": {
        return "# Changelog\n\n## 3.4.0\n\n- Pages are written to disk as soon as they render.\n- `--watch` rebuilds only the pages whose sources changed.";
      }
      default: {
        const name = _M0FP314vlmkit_2dsites4code4main8basename(path);
        if (_M0MPC16string6String11has__suffix(path, _M0FP314vlmkit_2dsites4code4main10file__textN6recordS3093)) {
          const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(44);
          _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, "\n\nThis page is part of the Lantern ");
          _M0MPB13StringBuilder13write__objectGsE(_string_builder, _M0FP314vlmkit_2dsites4code4main7dirname(path));
          _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, " folder.\n");
          return `# ${name}${_string_builder.val}`;
        } else {
          const _string_builder = _M0MPB13StringBuilder21StringBuilder_2einner(52);
          _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, "\n// Part of Lantern's ");
          _M0MPB13StringBuilder13write__objectGsE(_string_builder, _M0FP314vlmkit_2dsites4code4main7dirname(path));
          _M0IPB13StringBuilderPB6Logger13write__string(_string_builder, " folder.\nexport const name = \"");
          return `// ${name}${_string_builder.val}${name}\";\n\nexport function describe(): string {\n  return \`${name} is loaded\`;\n}\n`;
        }
      }
    }
  }
  function _M0FP314vlmkit_2dsites4code4main8pr__link(pr) {
    return pr === 0 ? [] : [_M0FP314vlmkit_2dsites4code4main1t(" ("), _M0FP314vlmkit_2dsites4code4main2el("a", [_M0FP314vlmkit_2dsites4code4main3a__("href", "#/pulls"), _M0FP314vlmkit_2dsites4code4main3cls("pr-ref")], [_M0FP314vlmkit_2dsites4code4main1t(`#${_M0MPC13int3Int18to__string_2einner(pr, 10)}`)]), _M0FP314vlmkit_2dsites4code4main1t(")")];
  }
  function _M0FP314vlmkit_2dsites4code4main10size__text(bytes) {
    if (bytes < 1024) {
      return `${_M0MPC13int3Int18to__string_2einner(bytes, 10)} Bytes`;
    } else {
      const tenths = (Math.imul(bytes, 100) | 0) / 1024 | 0;
      return `${_M0MPC13int3Int18to__string_2einner(tenths / 100 | 0, 10)}.${_M0MPC16string6String10pad__start(_M0MPC13int3Int18to__string_2einner(tenths % 100 | 0, 10), 2, 48)} KB`;
    }
  }
  function _M0FP314vlmkit_2dsites4code4main11symbols__of(path, text) {
    const lang = _M0FP314vlmkit_2dsites4code4main8lang__of(path);
    const out = [];
    const _bind = _M0MPB4Iter9to__arrayGRPC16string10StringViewE(_M0MPC16string6String5split(text, _M0FP314vlmkit_2dsites4code4main11symbols__ofN6recordS3101));
    const _bind$2 = _bind.length;
    let _tmp = 0;
    while (true) {
      const i = _tmp;
      if (i < _bind$2) {
        const line = _bind[i];
        const l = _M0MPC16string10StringView9to__owned(line);
        const n = i + 1 | 0;
        if (lang === "ts") {
          const _bind$3 = ["function ", "interface "];
          const _bind$4 = _bind$3.length;
          let _tmp$2 = 0;
          while (true) {
            const _ = _tmp$2;
            if (_ < _bind$4) {
              const kw = _bind$3[_];
              const _bind$5 = _M0MPC16string6String4find(l, new _M0TPC16string10StringView(kw, 0, kw.length));
              if (_bind$5 === undefined) {
              } else {
                const _Some = _bind$5;
                const _at = _Some;
                const rest = _M0FP314vlmkit_2dsites4code4main9chars__of(_M0MPC16string6String17substring_2einner(l, _at + kw.length | 0, undefined));
                let j = 0;
                while (true) {
                  if (j < rest.length && _M0FP314vlmkit_2dsites4code4main9is__ident(_M0MPC15array5Array2atGcE(rest, j))) {
                    j = j + 1 | 0;
                    continue;
                  } else {
                    break;
                  }
                }
                if (j > 0) {
                  _M0MPC15array5Array4pushGUssEE(out, { _0: n, _1: kw === "function " ? "func" : "type", _2: _M0FP314vlmkit_2dsites4code4main7str__of(rest, 0, j) });
                }
              }
              _tmp$2 = _ + 1 | 0;
              continue;
            } else {
              break;
            }
          }
        } else {
          if (lang === "md") {
            if (_M0MPC16string6String11has__prefix(l, _M0FP314vlmkit_2dsites4code4main11symbols__ofN6recordS3102)) {
              _M0MPC15array5Array4pushGUssEE(out, { _0: n, _1: "head", _2: _M0MPC16string10StringView9to__owned(_M0MPC16string6String19trim__start_2einner(l, _M0FP314vlmkit_2dsites4code4main11symbols__ofN6recordS3103)) });
            }
          } else {
            if (lang === "hash" || lang === "json") {
              const cs = _M0FP314vlmkit_2dsites4code4main9chars__of(l);
              if (cs.length > 0 && (_M0MPC15array5Array2atGcE(cs, 0) !== 32 && (_M0MPC15array5Array2atGcE(cs, 0) !== 35 && (_M0MPC15array5Array2atGcE(cs, 0) !== 123 && _M0MPC15array5Array2atGcE(cs, 0) !== 125)))) {
                const _bind$3 = _M0MPC16string6String4find(l, _M0FP314vlmkit_2dsites4code4main11symbols__ofN6recordS3104);
                if (_bind$3 === undefined) {
                } else {
                  const _Some = _bind$3;
                  const _at = _Some;
                  _M0MPC15array5Array4pushGUssEE(out, { _0: n, _1: "key", _2: _M0MPC16string10StringView9to__owned(_M0MPC16string6String12trim_2einner(_M0MPC16string6String17substring_2einner(l, 0, _at), _M0FP314vlmkit_2dsites4code4main11symbols__ofN6recordS3105)) });
                }
              } else {
                if (lang === "json" && _M0MPC16string6String11has__prefix(l, _M0FP314vlmkit_2dsites4code4main11symbols__ofN6recordS3106)) {
                  const _bind$3 = _M0MPC16string6String4find(l, _M0FP314vlmkit_2dsites4code4main11symbols__ofN6recordS3107);
                  if (_bind$3 === undefined) {
                  } else {
                    const _Some = _bind$3;
                    const _at = _Some;
                    _M0MPC15array5Array4pushGUssEE(out, { _0: n, _1: "key", _2: _M0MPC16string10StringView9to__owned(_M0MPC16string6String12trim_2einner(_M0MPC16string6String17substring_2einner(l, 0, _at), _M0FP314vlmkit_2dsites4code4main11symbols__ofN6recordS3108)) });
                  }
                }
              }
            }
          }
        }
        _tmp = i + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return out;
  }
  function _M0FP314vlmkit_2dsites4code4main10blob__view(path) {
    const _bind = _M0FP314vlmkit_2dsites4code4main9entry__of(path);
    if (_bind === undefined) {
      return _M0FP314vlmkit_2dsites4code4main2el("div", [_M0FP314vlmkit_2dsites4code4main3cls("blank")], [_M0FP314vlmkit_2dsites4code4main2el("h2", [], [_M0FP314vlmkit_2dsites4code4main1t(`No file at ${path}`)]), _M0FP314vlmkit_2dsites4code4main2el("p", [], [_M0FP314vlmkit_2dsites4code4main2el("a", [_M0FP314vlmkit_2dsites4code4main3a__("href", "#/"), _M0FP314vlmkit_2dsites4code4main3cls("link")], [_M0FP314vlmkit_2dsites4code4main1t("Back to the repository")])])]);
    } else {
      const _Some = _bind;
      const _e = _Some;
      const text = _M0FP314vlmkit_2dsites4code4main10file__text(path);
      const lines = _M0MPB4Iter9to__arrayGRPC16string10StringViewE(_M0MPB4Iter3mapGRPC16string10StringViewsE(_M0MPC16string6String5split(text, _M0FP314vlmkit_2dsites4code4main10blob__viewN6recordS3138), (s) => _M0MPC16string10StringView9to__owned(s)));
      const _p = [];
      const _p$2 = lines.length;
      let _tmp;
      let _tmp$2 = 0;
      while (true) {
        const _p$3 = _tmp$2;
        if (_p$3 < _p$2) {
          const _p$4 = lines[_p$3];
          const _p$5 = _M0MPC16string10StringView9to__owned(_M0MPC16string6String12trim_2einner(_p$4, _M0FP314vlmkit_2dsites4code4main10blob__viewN6recordS3139));
          const _p$6 = "";
          if (!(_p$5 === _p$6)) {
            _M0MPC15array5Array4pushGUssEE(_p, _p$4);
          }
          _tmp$2 = _p$3 + 1 | 0;
          continue;
        } else {
          _tmp = _p;
          break;
        }
      }
      const loc = _tmp.length;
      const syms = _M0FP314vlmkit_2dsites4code4main11symbols__of(path, text);
      const _tmp$3 = [_M0FP314vlmkit_2dsites4code4main3cls("blob layout-blob")];
      const _tmp$4 = _M0FP314vlmkit_2dsites4code4main2el("div", [_M0FP314vlmkit_2dsites4code4main3cls("blob-main")], [_M0FP314vlmkit_2dsites4code4main2el("div", [_M0FP314vlmkit_2dsites4code4main3cls("blob-crumbs")], [_M0FP314vlmkit_2dsites4code4main6crumbs(path, false), _M0FP314vlmkit_2dsites4code4main12copy__button(`path-${path}`, path, "Copy path")]), _M0FP314vlmkit_2dsites4code4main2el("div", [_M0FP314vlmkit_2dsites4code4main3cls("blob-commit")], [_M0FP314vlmkit_2dsites4code4main6avatar(_M0FP314vlmkit_2dsites4code4main10main__head.author, 20), _M0FP314vlmkit_2dsites4code4main2el("a", [_M0FP314vlmkit_2dsites4code4main3a__("href", "#/"), _M0FP314vlmkit_2dsites4code4main3cls("ft-author")], [_M0FP314vlmkit_2dsites4code4main1t(_e.pr === 418 ? _M0FP314vlmkit_2dsites4code4main10main__head.author : "jun-arata")]), _M0FP314vlmkit_2dsites4code4main2el("span", [_M0FP314vlmkit_2dsites4code4main3cls("ft-msg")], _M0IPC15array5ArrayPB3Add3addGRP36mizchi4luna3dom7DomNodeE([_M0FP314vlmkit_2dsites4code4main1t(_e.msg)], _M0FP314vlmkit_2dsites4code4main8pr__link(_e.pr))), _M0FP314vlmkit_2dsites4code4main2el("span", [_M0FP314vlmkit_2dsites4code4main3cls("ft-meta")], [_M0FP314vlmkit_2dsites4code4main1t(_e.age)])]), _M0FP314vlmkit_2dsites4code4main2el("section", [_M0FP314vlmkit_2dsites4code4main3cls("filebox"), _M0FP314vlmkit_2dsites4code4main3a__("aria-label", _M0FP314vlmkit_2dsites4code4main8basename(path))], [_M0FP314vlmkit_2dsites4code4main2el("div", [_M0FP314vlmkit_2dsites4code4main3cls("filebox-head")], [_M0FP314vlmkit_2dsites4code4main7tablist("bl", [_M0FP314vlmkit_2dsites4code4main10blob__viewN5tupleS3140, _M0FP314vlmkit_2dsites4code4main10blob__viewN5tupleS3141], _M0FP314vlmkit_2dsites4code4main9blob__tab, "seg-tabs"), _M0FP314vlmkit_2dsites4code4main2el("span", [_M0FP314vlmkit_2dsites4code4main3cls("file-info")], [_M0FP314vlmkit_2dsites4code4main1t(`${_M0FP314vlmkit_2dsites4code4main6plural(lines.length, "line", "lines")} (${_M0MPC13int3Int18to__string_2einner(loc, 10)} loc) · ${_M0FP314vlmkit_2dsites4code4main10size__text(_M0FP314vlmkit_2dsites4code4main9byte__len(text))}`)]), _M0FP314vlmkit_2dsites4code4main2el("div", [_M0FP314vlmkit_2dsites4code4main3cls("file-actions")], [_M0FP314vlmkit_2dsites4code4main2el("button", [_M0FP314vlmkit_2dsites4code4main3a__("type", "button"), _M0FP314vlmkit_2dsites4code4main3cls("btn btn-sm"), _M0FP314vlmkit_2dsites4code4main2ad("aria-pressed", () => {
        const _p$3 = _M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4code4main9blob__raw);
        return _p$3 ? "true" : "false";
      }), _M0FP314vlmkit_2dsites4code4main2on("click", (_e$2) => {
        _M0MP26mizchi7signals6Signal6updateGbE(_M0FP314vlmkit_2dsites4code4main9blob__raw, (v) => !v);
      })], [_M0FP314vlmkit_2dsites4code4main1t("Raw")]), _M0FP314vlmkit_2dsites4code4main12copy__button(`raw-${path}`, text, "Copy raw file"), _M0FP314vlmkit_2dsites4code4main2el("a", [_M0FP314vlmkit_2dsites4code4main3a__("href", _M0FP314vlmkit_2dsites4code4main9data__url(text)), _M0FP314vlmkit_2dsites4code4main3a__("download", _M0FP314vlmkit_2dsites4code4main8basename(path)), _M0FP314vlmkit_2dsites4code4main3cls("btn btn-sm btn-icon"), _M0FP314vlmkit_2dsites4code4main3a__("aria-label", "Download"), _M0FP314vlmkit_2dsites4code4main3a__("title", "Download")], [_M0FP314vlmkit_2dsites4code4main4icon("download")]), _M0FP314vlmkit_2dsites4code4main2el("button", [_M0FP314vlmkit_2dsites4code4main3a__("type", "button"), _M0FP314vlmkit_2dsites4code4main3cls("btn btn-sm wrap-btn"), _M0FP314vlmkit_2dsites4code4main2ad("aria-pressed", () => {
        const _p$3 = _M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4code4main11wrap__lines);
        return _p$3 ? "true" : "false";
      }), _M0FP314vlmkit_2dsites4code4main2on("click", (_e$2) => {
        _M0MP26mizchi7signals6Signal6updateGbE(_M0FP314vlmkit_2dsites4code4main11wrap__lines, (v) => !v);
      })], [_M0FP314vlmkit_2dsites4code4main4icon("wrap"), _M0FP314vlmkit_2dsites4code4main1t("Wrap lines")])])]), _M0FP314vlmkit_2dsites4code4main2el("div", [_M0FP314vlmkit_2dsites4code4main3a__("id", "bl-panel"), _M0FP314vlmkit_2dsites4code4main3a__("role", "tabpanel"), _M0FP314vlmkit_2dsites4code4main2ad("aria-labelledby", () => `bl-tab-${_M0MP26mizchi7signals6Signal3getGsE(_M0FP314vlmkit_2dsites4code4main9blob__tab)}`)], [_M0FP314vlmkit_2dsites4code4main5keyed(() => _M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4code4main9blob__raw) ? "raw" : _M0MP26mizchi7signals6Signal3getGsE(_M0FP314vlmkit_2dsites4code4main9blob__tab), (k) => k === "raw" ? _M0FP314vlmkit_2dsites4code4main2el("pre", [_M0FP314vlmkit_2dsites4code4main2ad("class", () => `raw${_M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4code4main11wrap__lines) ? " is-wrap" : ""}`), _M0FP314vlmkit_2dsites4code4main3a__("tabindex", "0"), _M0FP314vlmkit_2dsites4code4main3a__("aria-label", "Raw file")], [_M0FP314vlmkit_2dsites4code4main1t(text)]) : _M0FP314vlmkit_2dsites4code4main11code__table(path, text, k === "blame"))])])]);
      const _tmp$5 = [_M0FP314vlmkit_2dsites4code4main3cls("symbols"), _M0FP314vlmkit_2dsites4code4main3a__("aria-labelledby", "sym-h")];
      const _tmp$6 = _M0FP314vlmkit_2dsites4code4main2el("h2", [_M0FP314vlmkit_2dsites4code4main3a__("id", "sym-h"), _M0FP314vlmkit_2dsites4code4main3cls("side-h")], [_M0FP314vlmkit_2dsites4code4main1t("Symbols")]);
      let _tmp$7;
      if (syms.length === 0) {
        _tmp$7 = _M0FP314vlmkit_2dsites4code4main2el("p", [_M0FP314vlmkit_2dsites4code4main3cls("muted small")], [_M0FP314vlmkit_2dsites4code4main1t("No symbols in this file.")]);
      } else {
        const _tmp$8 = [_M0FP314vlmkit_2dsites4code4main3cls("sym-list")];
        const _p$3 = new Array(syms.length);
        const _p$4 = syms.length;
        let _tmp$9 = 0;
        while (true) {
          const _p$5 = _tmp$9;
          if (_p$5 < _p$4) {
            const _p$6 = syms[_p$5];
            const _p$7 = _p$6._0;
            const _p$8 = _p$6._1;
            const _p$9 = _p$6._2;
            const _tmp$10 = [];
            const _tmp$11 = [_M0FP314vlmkit_2dsites4code4main3a__("href", _M0FP314vlmkit_2dsites4code4main9sel__hash(path, _p$7, _p$7)), _M0FP314vlmkit_2dsites4code4main3cls("sym-link"), _M0FP314vlmkit_2dsites4code4main2on("click", (_p$10) => {
              _M0FP314vlmkit_2dsites4code4main7prevent(_p$10);
              _M0FP314vlmkit_2dsites4code4main11sel__anchor.val = _p$7;
              _M0FP26mizchi7signals5batchGuE(() => {
                _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4code4main9blob__raw, false);
              });
              _M0FP314vlmkit_2dsites4code4main13select__lines(path, _p$7, _p$7);
              _M0FP314vlmkit_2dsites4code4main5later(0, () => {
                _M0FP314vlmkit_2dsites4code4main10scroll__to(`#L${_M0MPC13int3Int18to__string_2einner(_p$7, 10)}`);
                _M0FP314vlmkit_2dsites4code4main10focus__sel(`#L${_M0MPC13int3Int18to__string_2einner(_p$7, 10)}`);
              });
            })];
            const _tmp$12 = [_M0FP314vlmkit_2dsites4code4main3cls(`sym-kind sym-${_p$8}`)];
            let _tmp$13;
            switch (_p$8) {
              case "func": {
                _tmp$13 = "func";
                break;
              }
              case "type": {
                _tmp$13 = "type";
                break;
              }
              case "head": {
                _tmp$13 = "h";
                break;
              }
              default: {
                _tmp$13 = "key";
              }
            }
            _p$3[_p$5] = _M0FP314vlmkit_2dsites4code4main2el("li", _tmp$10, [_M0FP314vlmkit_2dsites4code4main2el("a", _tmp$11, [_M0FP314vlmkit_2dsites4code4main2el("span", _tmp$12, [_M0FP314vlmkit_2dsites4code4main1t(_tmp$13)]), _M0FP314vlmkit_2dsites4code4main2el("span", [_M0FP314vlmkit_2dsites4code4main3cls("sym-name")], [_M0FP314vlmkit_2dsites4code4main1t(_p$9)]), _M0FP314vlmkit_2dsites4code4main2el("span", [_M0FP314vlmkit_2dsites4code4main3cls("sym-line")], [_M0FP314vlmkit_2dsites4code4main1t(`L${_M0MPC13int3Int18to__string_2einner(_p$7, 10)}`)])])]);
            _tmp$9 = _p$5 + 1 | 0;
            continue;
          } else {
            break;
          }
        }
        _tmp$7 = _M0FP314vlmkit_2dsites4code4main2el("ul", _tmp$8, _p$3);
      }
      return _M0FP314vlmkit_2dsites4code4main2el("div", _tmp$3, [_tmp$4, _M0FP314vlmkit_2dsites4code4main2el("aside", _tmp$5, [_tmp$6, _tmp$7])]);
    }
  }
  function _M0FP314vlmkit_2dsites4code4main10side__link(ic, label, href) {
    return _M0FP314vlmkit_2dsites4code4main2el("li", [], [_M0FP314vlmkit_2dsites4code4main2el("a", [_M0FP314vlmkit_2dsites4code4main3a__("href", href), _M0FP314vlmkit_2dsites4code4main3cls("side-link")], [_M0FP314vlmkit_2dsites4code4main4icon(ic), _M0FP314vlmkit_2dsites4code4main1t(label)])]);
  }
  function _M0FP314vlmkit_2dsites4code4main5about() {
    const _tmp = [_M0FP314vlmkit_2dsites4code4main3cls("side")];
    const _tmp$2 = [_M0FP314vlmkit_2dsites4code4main3cls("side-sec"), _M0FP314vlmkit_2dsites4code4main3a__("aria-labelledby", "about-h")];
    const _tmp$3 = _M0FP314vlmkit_2dsites4code4main2el("h2", [_M0FP314vlmkit_2dsites4code4main3a__("id", "about-h"), _M0FP314vlmkit_2dsites4code4main3cls("side-h")], [_M0FP314vlmkit_2dsites4code4main1t("About")]);
    const _tmp$4 = _M0FP314vlmkit_2dsites4code4main2el("p", [_M0FP314vlmkit_2dsites4code4main3cls("about-desc")], [_M0FP314vlmkit_2dsites4code4main1t("A static site generator that rebuilds only what changed and streams pages to disk.")]);
    const _tmp$5 = _M0FP314vlmkit_2dsites4code4main2el("p", [_M0FP314vlmkit_2dsites4code4main3cls("about-url")], [_M0FP314vlmkit_2dsites4code4main4icon("link"), _M0FP314vlmkit_2dsites4code4main2el("a", [_M0FP314vlmkit_2dsites4code4main3a__("href", "#/"), _M0FP314vlmkit_2dsites4code4main3cls("link strong")], [_M0FP314vlmkit_2dsites4code4main1t("lantern.tidewater.example")])]);
    const _tmp$6 = [_M0FP314vlmkit_2dsites4code4main3cls("topics"), _M0FP314vlmkit_2dsites4code4main3a__("aria-label", "Topics")];
    const _p = new Array(_M0FP314vlmkit_2dsites4code4main6topics.length);
    const _p$2 = _M0FP314vlmkit_2dsites4code4main6topics.length;
    let _tmp$7 = 0;
    while (true) {
      const _p$3 = _tmp$7;
      if (_p$3 < _p$2) {
        const _p$4 = _M0FP314vlmkit_2dsites4code4main6topics[_p$3];
        _p[_p$3] = _M0FP314vlmkit_2dsites4code4main2el("li", [], [_M0FP314vlmkit_2dsites4code4main2el("a", [_M0FP314vlmkit_2dsites4code4main3a__("href", "#/"), _M0FP314vlmkit_2dsites4code4main3cls("topic")], [_M0FP314vlmkit_2dsites4code4main1t(_p$4)])]);
        _tmp$7 = _p$3 + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    const _tmp$8 = _M0FP314vlmkit_2dsites4code4main2el("section", _tmp$2, [_tmp$3, _tmp$4, _tmp$5, _M0FP314vlmkit_2dsites4code4main2el("ul", _tmp$6, _p), _M0FP314vlmkit_2dsites4code4main2el("ul", [_M0FP314vlmkit_2dsites4code4main3cls("side-links")], [_M0FP314vlmkit_2dsites4code4main10side__link("book", "Readme", "#/blob/README.md"), _M0FP314vlmkit_2dsites4code4main10side__link("scale", "MIT license", "#/blob/LICENSE"), _M0FP314vlmkit_2dsites4code4main10side__link("pulse", "Activity", "#/insights"), _M0FP314vlmkit_2dsites4code4main2el("li", [], [_M0FP314vlmkit_2dsites4code4main2el("a", [_M0FP314vlmkit_2dsites4code4main3a__("href", "#/"), _M0FP314vlmkit_2dsites4code4main3cls("side-link")], [_M0FP314vlmkit_2dsites4code4main4icon("star"), _M0FP314vlmkit_2dsites4code4main2el("strong", [], [_M0FP314vlmkit_2dsites4code4main1t("4.2k")]), _M0FP314vlmkit_2dsites4code4main1t(" stars")])]), _M0FP314vlmkit_2dsites4code4main2el("li", [], [_M0FP314vlmkit_2dsites4code4main2el("a", [_M0FP314vlmkit_2dsites4code4main3a__("href", "#/"), _M0FP314vlmkit_2dsites4code4main3cls("side-link")], [_M0FP314vlmkit_2dsites4code4main4icon("eye"), _M0FP314vlmkit_2dsites4code4main2el("strong", [], [_M0FP314vlmkit_2dsites4code4main1t("38")]), _M0FP314vlmkit_2dsites4code4main1t(" watching")])]), _M0FP314vlmkit_2dsites4code4main2el("li", [], [_M0FP314vlmkit_2dsites4code4main2el("a", [_M0FP314vlmkit_2dsites4code4main3a__("href", "#/"), _M0FP314vlmkit_2dsites4code4main3cls("side-link")], [_M0FP314vlmkit_2dsites4code4main4icon("fork"), _M0FP314vlmkit_2dsites4code4main2el("strong", [], [_M0FP314vlmkit_2dsites4code4main2td(() => _M0MPC13int3Int18to__string_2einner(_M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4code4main5forks), 10))]), _M0FP314vlmkit_2dsites4code4main1t(" forks")])])])]);
    const _tmp$9 = _M0FP314vlmkit_2dsites4code4main2el("section", [_M0FP314vlmkit_2dsites4code4main3cls("side-sec"), _M0FP314vlmkit_2dsites4code4main3a__("aria-labelledby", "rel-h")], [_M0FP314vlmkit_2dsites4code4main2el("h2", [_M0FP314vlmkit_2dsites4code4main3a__("id", "rel-h"), _M0FP314vlmkit_2dsites4code4main3cls("side-h")], [_M0FP314vlmkit_2dsites4code4main1t("Releases "), _M0FP314vlmkit_2dsites4code4main2el("span", [_M0FP314vlmkit_2dsites4code4main3cls("counter")], [_M0FP314vlmkit_2dsites4code4main1t("15")])]), _M0FP314vlmkit_2dsites4code4main2el("a", [_M0FP314vlmkit_2dsites4code4main3a__("href", "#/"), _M0FP314vlmkit_2dsites4code4main3cls("release")], [_M0FP314vlmkit_2dsites4code4main7icon__c("tag", "ic ic-ok"), _M0FP314vlmkit_2dsites4code4main2el("span", [_M0FP314vlmkit_2dsites4code4main3cls("release-body")], [_M0FP314vlmkit_2dsites4code4main2el("span", [_M0FP314vlmkit_2dsites4code4main3cls("release-name")], [_M0FP314vlmkit_2dsites4code4main2el("strong", [], [_M0FP314vlmkit_2dsites4code4main1t("v3.4.0")]), _M0FP314vlmkit_2dsites4code4main2el("span", [_M0FP314vlmkit_2dsites4code4main3cls("pill pill-ok")], [_M0FP314vlmkit_2dsites4code4main1t("Latest")])]), _M0FP314vlmkit_2dsites4code4main2el("span", [_M0FP314vlmkit_2dsites4code4main3cls("muted small")], [_M0FP314vlmkit_2dsites4code4main1t("Oct 31, 2026")])])]), _M0FP314vlmkit_2dsites4code4main2el("a", [_M0FP314vlmkit_2dsites4code4main3a__("href", "#/"), _M0FP314vlmkit_2dsites4code4main3cls("link small")], [_M0FP314vlmkit_2dsites4code4main1t("+ 14 releases")])]);
    const _tmp$10 = [_M0FP314vlmkit_2dsites4code4main3cls("side-sec"), _M0FP314vlmkit_2dsites4code4main3a__("aria-labelledby", "con-h")];
    const _tmp$11 = _M0FP314vlmkit_2dsites4code4main2el("h2", [_M0FP314vlmkit_2dsites4code4main3a__("id", "con-h"), _M0FP314vlmkit_2dsites4code4main3cls("side-h")], [_M0FP314vlmkit_2dsites4code4main1t("Contributors "), _M0FP314vlmkit_2dsites4code4main2el("span", [_M0FP314vlmkit_2dsites4code4main3cls("counter")], [_M0FP314vlmkit_2dsites4code4main1t("27")])]);
    const _tmp$12 = [_M0FP314vlmkit_2dsites4code4main3cls("avatars"), _M0FP314vlmkit_2dsites4code4main3a__("aria-label", "Contributors")];
    const _p$3 = new Array(_M0FP314vlmkit_2dsites4code4main12contributors.length);
    const _p$4 = _M0FP314vlmkit_2dsites4code4main12contributors.length;
    let _tmp$13 = 0;
    while (true) {
      const _p$5 = _tmp$13;
      if (_p$5 < _p$4) {
        const _p$6 = _M0FP314vlmkit_2dsites4code4main12contributors[_p$5];
        _p$3[_p$5] = _M0FP314vlmkit_2dsites4code4main2el("li", [], [_M0FP314vlmkit_2dsites4code4main2el("a", [_M0FP314vlmkit_2dsites4code4main3a__("href", "#/"), _M0FP314vlmkit_2dsites4code4main3a__("aria-label", _p$6), _M0FP314vlmkit_2dsites4code4main3a__("title", _p$6), _M0FP314vlmkit_2dsites4code4main3cls("avatar-link")], [_M0FP314vlmkit_2dsites4code4main6avatar(_p$6, 32)])]);
        _tmp$13 = _p$5 + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    const _tmp$14 = _M0FP314vlmkit_2dsites4code4main2el("section", _tmp$10, [_tmp$11, _M0FP314vlmkit_2dsites4code4main2el("ul", _tmp$12, _p$3), _M0FP314vlmkit_2dsites4code4main2el("a", [_M0FP314vlmkit_2dsites4code4main3a__("href", "#/"), _M0FP314vlmkit_2dsites4code4main3cls("link small")], [_M0FP314vlmkit_2dsites4code4main1t("+ 13 contributors")])]);
    const _tmp$15 = [_M0FP314vlmkit_2dsites4code4main3cls("side-sec"), _M0FP314vlmkit_2dsites4code4main3a__("aria-labelledby", "lang-h")];
    const _tmp$16 = _M0FP314vlmkit_2dsites4code4main2el("h2", [_M0FP314vlmkit_2dsites4code4main3a__("id", "lang-h"), _M0FP314vlmkit_2dsites4code4main3cls("side-h")], [_M0FP314vlmkit_2dsites4code4main1t("Languages")]);
    const _tmp$17 = _M0FP314vlmkit_2dsites4code4main3cls("lang-bar");
    const _tmp$18 = _M0FP314vlmkit_2dsites4code4main3a__("role", "img");
    const _p$5 = new Array(_M0FP314vlmkit_2dsites4code4main9languages.length);
    const _p$6 = _M0FP314vlmkit_2dsites4code4main9languages.length;
    let _tmp$19 = 0;
    while (true) {
      const _p$7 = _tmp$19;
      if (_p$7 < _p$6) {
        const _p$8 = _M0FP314vlmkit_2dsites4code4main9languages[_p$7];
        _p$5[_p$7] = `${_p$8._0} ${String(_p$8._1)}%`;
        _tmp$19 = _p$7 + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    const _tmp$20 = [_tmp$17, _tmp$18, _M0FP314vlmkit_2dsites4code4main3a__("aria-label", _M0MPC15array5Array4joinGsE(_p$5, _M0FP314vlmkit_2dsites4code4main5aboutN6recordS3165))];
    const _p$7 = new Array(_M0FP314vlmkit_2dsites4code4main9languages.length);
    const _p$8 = _M0FP314vlmkit_2dsites4code4main9languages.length;
    let _tmp$21 = 0;
    while (true) {
      const _p$9 = _tmp$21;
      if (_p$9 < _p$8) {
        const _p$10 = _M0FP314vlmkit_2dsites4code4main9languages[_p$9];
        const _p$11 = _M0MPB13StringBuilder21StringBuilder_2einner(19);
        _M0IPB13StringBuilderPB6Logger13write__string(_p$11, "width:");
        _M0MPB13StringBuilder13write__objectGdE(_p$11, _p$10._1);
        _M0IPB13StringBuilderPB6Logger13write__string(_p$11, "%;background:");
        _M0MPB13StringBuilder13write__objectGsE(_p$11, _p$10._2);
        _p$7[_p$9] = _M0FP314vlmkit_2dsites4code4main2el("span", [_M0FP314vlmkit_2dsites4code4main3a__("style", _p$11.val)], []);
        _tmp$21 = _p$9 + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    const _tmp$22 = _M0FP314vlmkit_2dsites4code4main2el("div", _tmp$20, _p$7);
    const _tmp$23 = [_M0FP314vlmkit_2dsites4code4main3cls("lang-legend")];
    const _p$9 = new Array(_M0FP314vlmkit_2dsites4code4main9languages.length);
    const _p$10 = _M0FP314vlmkit_2dsites4code4main9languages.length;
    let _tmp$24 = 0;
    while (true) {
      const _p$11 = _tmp$24;
      if (_p$11 < _p$10) {
        const _p$12 = _M0FP314vlmkit_2dsites4code4main9languages[_p$11];
        const _tmp$25 = [];
        const _tmp$26 = _M0FP314vlmkit_2dsites4code4main3cls("lang-dot");
        const _p$13 = _M0MPB13StringBuilder21StringBuilder_2einner(11);
        _M0IPB13StringBuilderPB6Logger13write__string(_p$13, "background:");
        _M0MPB13StringBuilder13write__objectGsE(_p$13, _p$12._2);
        _p$9[_p$11] = _M0FP314vlmkit_2dsites4code4main2el("li", _tmp$25, [_M0FP314vlmkit_2dsites4code4main2el("span", [_tmp$26, _M0FP314vlmkit_2dsites4code4main3a__("style", _p$13.val), _M0FP314vlmkit_2dsites4code4main3a__("aria-hidden", "true")], []), _M0FP314vlmkit_2dsites4code4main2el("strong", [], [_M0FP314vlmkit_2dsites4code4main1t(_p$12._0)]), _M0FP314vlmkit_2dsites4code4main2el("span", [_M0FP314vlmkit_2dsites4code4main3cls("muted")], [_M0FP314vlmkit_2dsites4code4main1t(` ${String(_p$12._1)}%`)])]);
        _tmp$24 = _p$11 + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return _M0FP314vlmkit_2dsites4code4main2el("div", _tmp, [_tmp$8, _tmp$9, _tmp$14, _M0FP314vlmkit_2dsites4code4main2el("section", _tmp$15, [_tmp$16, _tmp$22, _M0FP314vlmkit_2dsites4code4main2el("ul", _tmp$23, _p$9)])]);
  }
  function _M0FP314vlmkit_2dsites4code4main6bolded(text, hits) {
    const cs = _M0FP314vlmkit_2dsites4code4main9chars__of(text);
    const out = [];
    let i = 0;
    while (true) {
      if (i < cs.length) {
        const on_ = _M0MPC15array5Array8containsGiE(hits, i);
        const start = i;
        while (true) {
          if (i < cs.length && _M0MPC15array5Array8containsGiE(hits, i) === on_) {
            i = i + 1 | 0;
            continue;
          } else {
            break;
          }
        }
        const s = _M0FP314vlmkit_2dsites4code4main7str__of(cs, start, i);
        _M0MPC15array5Array4pushGUssEE(out, on_ ? _M0FP314vlmkit_2dsites4code4main2el("mark", [_M0FP314vlmkit_2dsites4code4main3cls("hit")], [_M0FP314vlmkit_2dsites4code4main1t(s)]) : _M0FP314vlmkit_2dsites4code4main1t(s));
        continue;
      } else {
        break;
      }
    }
    return out;
  }
  function _M0FP314vlmkit_2dsites4code4main12children__of(dir) {
    const _p = [];
    const _p$2 = _M0FP314vlmkit_2dsites4code4main4tree.length;
    let out;
    let _tmp = 0;
    while (true) {
      const _p$3 = _tmp;
      if (_p$3 < _p$2) {
        const _p$4 = _M0FP314vlmkit_2dsites4code4main4tree[_p$3];
        if (_M0FP314vlmkit_2dsites4code4main7dirname(_p$4.path) === dir) {
          _M0MPC15array5Array4pushGUssEE(_p, _p$4);
        }
        _tmp = _p$3 + 1 | 0;
        continue;
      } else {
        out = _p;
        break;
      }
    }
    _M0MPC15array5Array8sort__byGUsRPB5ArrayGiEEE(out, (a, b) => {
      const _p$3 = a.is_dir;
      const _p$4 = b.is_dir;
      if (!(_p$3 === _p$4)) {
        return a.is_dir ? -1 : 1;
      } else {
        return _M0IPC16string6StringPB7Compare7compare(_M0MPC16string6String9to__lower(a.path), _M0MPC16string6String9to__lower(b.path));
      }
    });
    return out;
  }
  function _M0FP314vlmkit_2dsites4code4main9file__row(e, label) {
    const href = e.is_dir ? `#/tree/${e.path}` : `#/blob/${e.path}`;
    return _M0FP314vlmkit_2dsites4code4main2el("tr", [_M0FP314vlmkit_2dsites4code4main3cls("ft-row")], [_M0FP314vlmkit_2dsites4code4main2el("td", [_M0FP314vlmkit_2dsites4code4main3cls("ft-name")], [_M0FP314vlmkit_2dsites4code4main2el("span", [_M0FP314vlmkit_2dsites4code4main3cls("ft-name-in")], [_M0FP314vlmkit_2dsites4code4main7icon__c(e.is_dir ? "folder" : "file", e.is_dir ? "ic ic-folder" : "ic ic-file"), _M0FP314vlmkit_2dsites4code4main2el("a", [_M0FP314vlmkit_2dsites4code4main3a__("href", href), _M0FP314vlmkit_2dsites4code4main3cls("ft-link")], label)])]), _M0FP314vlmkit_2dsites4code4main2el("td", [_M0FP314vlmkit_2dsites4code4main3cls("ft-cmsg")], [_M0FP314vlmkit_2dsites4code4main2el("span", [_M0FP314vlmkit_2dsites4code4main3cls("ft-cmsg-in")], _M0IPC15array5ArrayPB3Add3addGRP36mizchi4luna3dom7DomNodeE([_M0FP314vlmkit_2dsites4code4main1t(e.msg)], _M0FP314vlmkit_2dsites4code4main8pr__link(e.pr)))]), _M0FP314vlmkit_2dsites4code4main2el("td", [_M0FP314vlmkit_2dsites4code4main3cls("ft-age")], [_M0FP314vlmkit_2dsites4code4main1t(e.age)])]);
  }
  function _M0FP314vlmkit_2dsites4code4main11commit__msg(c) {
    return _M0IPC15array5ArrayPB3Add3addGRP36mizchi4luna3dom7DomNodeE([_M0FP314vlmkit_2dsites4code4main1t(c.msg)], _M0FP314vlmkit_2dsites4code4main8pr__link(c.pr));
  }
  function _M0FP314vlmkit_2dsites4code4main9thousands(n) {
    if (n < 1000) {
      return _M0MPC13int3Int18to__string_2einner(n, 10);
    } else {
      const r = n % 1000 | 0;
      return `${_M0MPC13int3Int18to__string_2einner(n / 1000 | 0, 10)},${_M0MPC16string6String10pad__start(_M0MPC13int3Int18to__string_2einner(r, 10), 3, 48)}`;
    }
  }
  function _M0FP314vlmkit_2dsites4code4main11latest__row(dir) {
    return _M0FP314vlmkit_2dsites4code4main2el("div", [_M0FP314vlmkit_2dsites4code4main3cls("ft-head")], [_M0FP314vlmkit_2dsites4code4main5keyed(() => `${_M0MPC13int3Int18to__string_2einner(_M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4code4main6branch), 10)}|${dir}`, (_k) => {
      let c;
      if (dir === "") {
        c = _M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(_M0FP314vlmkit_2dsites4code4main8branches, _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4code4main6branch)).head;
      } else {
        const _bind = _M0FP314vlmkit_2dsites4code4main9entry__of(dir);
        if (_bind === undefined) {
          c = _M0FP314vlmkit_2dsites4code4main10main__head;
        } else {
          const _Some = _bind;
          const _e = _Some;
          c = new _M0TP314vlmkit_2dsites4code4main6Commit(_M0FP314vlmkit_2dsites4code4main10main__head.author, _e.msg, _e.pr, `4f1e${_M0MPC13int3Int18to__string_2einner(_e.path.length, 10)}b2`, _e.age);
        }
      }
      const commits = _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4code4main6branch) === 0 ? 1284 : 1284 - (Math.imul(_M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4code4main6branch), 37) | 0) | 0;
      return _M0FP314vlmkit_2dsites4code4main2el("div", [_M0FP314vlmkit_2dsites4code4main3cls("ft-head-inner")], [_M0FP314vlmkit_2dsites4code4main6avatar(c.author, 20), _M0FP314vlmkit_2dsites4code4main2el("a", [_M0FP314vlmkit_2dsites4code4main3a__("href", "#/"), _M0FP314vlmkit_2dsites4code4main3cls("ft-author")], [_M0FP314vlmkit_2dsites4code4main1t(c.author)]), _M0FP314vlmkit_2dsites4code4main2el("span", [_M0FP314vlmkit_2dsites4code4main3cls("ft-msg")], _M0FP314vlmkit_2dsites4code4main11commit__msg(c)), _M0FP314vlmkit_2dsites4code4main2el("span", [_M0FP314vlmkit_2dsites4code4main3cls("ft-meta")], [_M0FP314vlmkit_2dsites4code4main2el("code", [_M0FP314vlmkit_2dsites4code4main3cls("sha")], [_M0FP314vlmkit_2dsites4code4main1t(c.sha)]), _M0FP314vlmkit_2dsites4code4main1t(` · ${c.age}`)]), _M0FP314vlmkit_2dsites4code4main2el("a", [_M0FP314vlmkit_2dsites4code4main3a__("href", "#/"), _M0FP314vlmkit_2dsites4code4main3cls("ft-commits")], [_M0FP314vlmkit_2dsites4code4main4icon("history"), _M0FP314vlmkit_2dsites4code4main2el("strong", [], [_M0FP314vlmkit_2dsites4code4main1t(_M0FP314vlmkit_2dsites4code4main9thousands(commits))]), _M0FP314vlmkit_2dsites4code4main1t(" Commits")])]);
    })]);
  }
  function _M0FP314vlmkit_2dsites4code4main11file__paths() {
    const _p = [];
    const _p$2 = _M0FP314vlmkit_2dsites4code4main4tree.length;
    let _p$3;
    let _tmp = 0;
    while (true) {
      const _p$4 = _tmp;
      if (_p$4 < _p$2) {
        const _p$5 = _M0FP314vlmkit_2dsites4code4main4tree[_p$4];
        if (!_p$5.is_dir) {
          _M0MPC15array5Array4pushGUssEE(_p, _p$5);
        }
        _tmp = _p$4 + 1 | 0;
        continue;
      } else {
        _p$3 = _p;
        break;
      }
    }
    const _p$4 = new Array(_p$3.length);
    const _p$5 = _p$3.length;
    let _tmp$2 = 0;
    while (true) {
      const _p$6 = _tmp$2;
      if (_p$6 < _p$5) {
        const _p$7 = _p$3[_p$6];
        _p$4[_p$6] = _p$7.path;
        _tmp$2 = _p$6 + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return _p$4;
  }
  function _M0FP314vlmkit_2dsites4code4main5fuzzy(hay, needle) {
    const h = _M0FP314vlmkit_2dsites4code4main9chars__of(_M0MPC16string6String9to__lower(hay));
    const n = _M0FP314vlmkit_2dsites4code4main9chars__of(_M0MPC16string6String9to__lower(needle));
    if (n.length === 0) {
      return new _M0DTPC16option6OptionGRPB5ArrayGiEE4Some([]);
    }
    const _tmp = _M0MPC16string6String9to__lower(hay);
    const _bind = _M0MPC16string6String9to__lower(needle);
    const _bind$2 = _M0MPC16string6String4find(_tmp, new _M0TPC16string10StringView(_bind, 0, _bind.length));
    if (_bind$2 === undefined) {
    } else {
      const _Some = _bind$2;
      const _at = _Some;
      const out = [];
      const _bind$3 = n.length;
      let _tmp$2 = 0;
      while (true) {
        const k = _tmp$2;
        if (k < _bind$3) {
          _M0MPC15array5Array4pushGiE(out, _at + k | 0);
          _tmp$2 = k + 1 | 0;
          continue;
        } else {
          break;
        }
      }
      return new _M0DTPC16option6OptionGRPB5ArrayGiEE4Some(out);
    }
    const out = [];
    let j = 0;
    const _bind$3 = h.length;
    let _tmp$2 = 0;
    while (true) {
      const i = _tmp$2;
      if (i < _bind$3) {
        if (j < n.length && _M0MPC15array5Array2atGcE(h, i) === _M0MPC15array5Array2atGcE(n, j)) {
          _M0MPC15array5Array4pushGiE(out, i);
          j = j + 1 | 0;
        }
        _tmp$2 = i + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return j === n.length ? new _M0DTPC16option6OptionGRPB5ArrayGiEE4Some(out) : _M0DTPC16option6OptionGRPB5ArrayGiEE4None__;
  }
  function _M0FP314vlmkit_2dsites4code4main10hit__score(hits) {
    return hits.length < 2 ? 0 : (_M0MPC15array5Array2atGiE(hits, hits.length - 1 | 0) - _M0MPC15array5Array2atGiE(hits, 0) | 0) - hits.length | 0;
  }
  function _M0FP314vlmkit_2dsites4code4main12match__files(q) {
    const out = [];
    const _bind = _M0FP314vlmkit_2dsites4code4main11file__paths();
    const _bind$2 = _bind.length;
    let _tmp = 0;
    while (true) {
      const _ = _tmp;
      if (_ < _bind$2) {
        const p = _bind[_];
        const _bind$3 = _M0FP314vlmkit_2dsites4code4main5fuzzy(p, q);
        if (_bind$3.$tag === 1) {
          const _Some = _bind$3;
          const _h = _Some._0;
          _M0MPC15array5Array4pushGUssEE(out, { _0: p, _1: _h });
        }
        _tmp = _ + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    _M0MPC15array5Array8sort__byGUsRPB5ArrayGiEEE(out, (a, b) => {
      const d = _M0FP314vlmkit_2dsites4code4main10hit__score(a._1) - _M0FP314vlmkit_2dsites4code4main10hit__score(b._1) | 0;
      return d !== 0 ? d : a._0.length - b._0.length | 0;
    });
    return out;
  }
  function _M0FP314vlmkit_2dsites4code4main11file__table(dir) {
    return _M0FP314vlmkit_2dsites4code4main2el("div", [_M0FP314vlmkit_2dsites4code4main3cls("ft")], [_M0FP314vlmkit_2dsites4code4main11latest__row(dir), _M0FP314vlmkit_2dsites4code4main2el("table", [_M0FP314vlmkit_2dsites4code4main3cls("ft-table"), _M0FP314vlmkit_2dsites4code4main3a__("id", "file-table")], [_M0FP314vlmkit_2dsites4code4main2el("caption", [_M0FP314vlmkit_2dsites4code4main3cls("sr-only")], [_M0FP314vlmkit_2dsites4code4main2td(() => {
      const _p = _M0MP26mizchi7signals6Signal3getGsE(_M0FP314vlmkit_2dsites4code4main11goto__query);
      const _p$2 = "";
      if (!(_p === _p$2)) {
        return `Files matching ${_M0MP26mizchi7signals6Signal3getGsE(_M0FP314vlmkit_2dsites4code4main11goto__query)}`;
      } else {
        return dir === "" ? "Files in lantern" : `Files in ${dir}`;
      }
    })]), _M0FP314vlmkit_2dsites4code4main2el("colgroup", [], [_M0FP314vlmkit_2dsites4code4main2el("col", [_M0FP314vlmkit_2dsites4code4main3cls("col-name")], []), _M0FP314vlmkit_2dsites4code4main2el("col", [_M0FP314vlmkit_2dsites4code4main3cls("col-msg")], []), _M0FP314vlmkit_2dsites4code4main2el("col", [_M0FP314vlmkit_2dsites4code4main3cls("col-age")], [])]), _M0FP314vlmkit_2dsites4code4main2el("thead", [_M0FP314vlmkit_2dsites4code4main3cls("sr-only")], [_M0FP314vlmkit_2dsites4code4main2el("tr", [], [_M0FP314vlmkit_2dsites4code4main2el("th", [_M0FP314vlmkit_2dsites4code4main3a__("scope", "col"), _M0FP314vlmkit_2dsites4code4main3cls("ft-name")], [_M0FP314vlmkit_2dsites4code4main1t("Name")]), _M0FP314vlmkit_2dsites4code4main2el("th", [_M0FP314vlmkit_2dsites4code4main3a__("scope", "col"), _M0FP314vlmkit_2dsites4code4main3cls("ft-cmsg")], [_M0FP314vlmkit_2dsites4code4main1t("Last commit message")]), _M0FP314vlmkit_2dsites4code4main2el("th", [_M0FP314vlmkit_2dsites4code4main3a__("scope", "col"), _M0FP314vlmkit_2dsites4code4main3cls("ft-age")], [_M0FP314vlmkit_2dsites4code4main1t("Last commit date")])])]), _M0FP314vlmkit_2dsites4code4main5keyed(() => _M0MP26mizchi7signals6Signal3getGsE(_M0FP314vlmkit_2dsites4code4main11goto__query), (q) => {
      const _p = "";
      if (!(q === _p)) {
        const found = _M0FP314vlmkit_2dsites4code4main12match__files(q);
        if (found.length === 0) {
          return _M0FP314vlmkit_2dsites4code4main2el("tbody", [], [_M0FP314vlmkit_2dsites4code4main2el("tr", [], [_M0FP314vlmkit_2dsites4code4main2el("td", [_M0FP314vlmkit_2dsites4code4main3a__("colspan", "3"), _M0FP314vlmkit_2dsites4code4main3cls("ft-empty")], [_M0FP314vlmkit_2dsites4code4main1t(`No files match “${q}”.`)])])]);
        } else {
          const _tmp = [];
          const _p$2 = new Array(found.length);
          const _p$3 = found.length;
          let _tmp$2 = 0;
          while (true) {
            const _p$4 = _tmp$2;
            if (_p$4 < _p$3) {
              const _p$5 = found[_p$4];
              const _p$6 = _M0FP314vlmkit_2dsites4code4main9entry__of(_p$5._0);
              let _tmp$3;
              if (_p$6 === undefined) {
                _tmp$3 = _M0FP314vlmkit_2dsites4code4main1t("");
              } else {
                const _p$7 = _p$6;
                const _p$8 = _p$7;
                _tmp$3 = _M0FP314vlmkit_2dsites4code4main9file__row(_p$8, _M0FP314vlmkit_2dsites4code4main6bolded(_p$5._0, _p$5._1));
              }
              _p$2[_p$4] = _tmp$3;
              _tmp$2 = _p$4 + 1 | 0;
              continue;
            } else {
              break;
            }
          }
          return _M0FP314vlmkit_2dsites4code4main2el("tbody", _tmp, _p$2);
        }
      } else {
        const rows = [];
        const _p$2 = "";
        if (!(dir === _p$2)) {
          const up = _M0FP314vlmkit_2dsites4code4main7dirname(dir);
          _M0MPC15array5Array4pushGUssEE(rows, _M0FP314vlmkit_2dsites4code4main2el("tr", [_M0FP314vlmkit_2dsites4code4main3cls("ft-row ft-up")], [_M0FP314vlmkit_2dsites4code4main2el("td", [_M0FP314vlmkit_2dsites4code4main3a__("colspan", "3"), _M0FP314vlmkit_2dsites4code4main3cls("ft-name")], [_M0FP314vlmkit_2dsites4code4main2el("span", [_M0FP314vlmkit_2dsites4code4main3cls("ft-name-in")], [_M0FP314vlmkit_2dsites4code4main7icon__c("folder", "ic ic-folder"), _M0FP314vlmkit_2dsites4code4main2el("a", [_M0FP314vlmkit_2dsites4code4main3a__("href", up === "" ? "#/" : `#/tree/${up}`), _M0FP314vlmkit_2dsites4code4main3cls("ft-link"), _M0FP314vlmkit_2dsites4code4main3a__("aria-label", "Parent folder")], [_M0FP314vlmkit_2dsites4code4main1t("..")])])])]));
        }
        const _bind = _M0FP314vlmkit_2dsites4code4main12children__of(dir);
        const _bind$2 = _bind.length;
        let _tmp = 0;
        while (true) {
          const _ = _tmp;
          if (_ < _bind$2) {
            const e = _bind[_];
            _M0MPC15array5Array4pushGUssEE(rows, _M0FP314vlmkit_2dsites4code4main9file__row(e, [_M0FP314vlmkit_2dsites4code4main1t(_M0FP314vlmkit_2dsites4code4main8basename(e.path))]));
            _tmp = _ + 1 | 0;
            continue;
          } else {
            break;
          }
        }
        return _M0FP314vlmkit_2dsites4code4main2el("tbody", [], rows);
      }
    })])]);
  }
  function _M0FP314vlmkit_2dsites4code4main11readme__box() {
    const heads = _M0FP314vlmkit_2dsites4code4main12md__headings(_M0FP314vlmkit_2dsites4code4main11readme__src);
    return _M0FP314vlmkit_2dsites4code4main2el("section", [_M0FP314vlmkit_2dsites4code4main3cls("readme"), _M0FP314vlmkit_2dsites4code4main3a__("aria-labelledby", "readme-title")], [_M0FP314vlmkit_2dsites4code4main2el("div", [_M0FP314vlmkit_2dsites4code4main3cls("readme-head")], [_M0FP314vlmkit_2dsites4code4main2el("h2", [_M0FP314vlmkit_2dsites4code4main3a__("id", "readme-title"), _M0FP314vlmkit_2dsites4code4main3cls("readme-title")], [_M0FP314vlmkit_2dsites4code4main4icon("book"), _M0FP314vlmkit_2dsites4code4main2el("a", [_M0FP314vlmkit_2dsites4code4main3a__("href", "#/blob/README.md")], [_M0FP314vlmkit_2dsites4code4main1t("README.md")])]), _M0FP314vlmkit_2dsites4code4main7popover("outline", "btn btn-icon", "Outline", [_M0FP314vlmkit_2dsites4code4main4icon("outline")], "outline-pop", () => {
      const _tmp = _M0FP314vlmkit_2dsites4code4main2el("p", [_M0FP314vlmkit_2dsites4code4main3cls("pop-title")], [_M0FP314vlmkit_2dsites4code4main1t("Outline")]);
      const _tmp$2 = [_M0FP314vlmkit_2dsites4code4main3cls("outline-list"), _M0FP314vlmkit_2dsites4code4main3a__("aria-label", "Outline")];
      const _p = new Array(heads.length);
      const _p$2 = heads.length;
      let _tmp$3 = 0;
      while (true) {
        const _p$3 = _tmp$3;
        if (_p$3 < _p$2) {
          const _p$4 = heads[_p$3];
          const _p$5 = _p$4._0;
          const _p$6 = _p$4._1;
          const _p$7 = _p$4._2;
          _p[_p$3] = _M0FP314vlmkit_2dsites4code4main2el("li", [_M0FP314vlmkit_2dsites4code4main3cls(`outline-l${_M0MPC13int3Int18to__string_2einner(_p$5, 10)}`)], [_M0FP314vlmkit_2dsites4code4main2el("a", [_M0FP314vlmkit_2dsites4code4main3a__("href", "#/"), _M0FP314vlmkit_2dsites4code4main3cls("outline-link"), _M0FP314vlmkit_2dsites4code4main2on("click", (_p$8) => {
            _M0FP314vlmkit_2dsites4code4main7prevent(_p$8);
            _M0MP26mizchi7signals6Signal3setGsE(_M0FP314vlmkit_2dsites4code4main10open__menu, "");
            _M0FP314vlmkit_2dsites4code4main10scroll__to(`#${_p$7}`);
            _M0FP314vlmkit_2dsites4code4main10focus__sel(`#${_p$7}`);
          })], [_M0FP314vlmkit_2dsites4code4main1t(_p$6)])]);
          _tmp$3 = _p$3 + 1 | 0;
          continue;
        } else {
          break;
        }
      }
      return [_tmp, _M0FP314vlmkit_2dsites4code4main2el("ul", _tmp$2, _p)];
    })]), _M0FP314vlmkit_2dsites4code4main2el("article", [_M0FP314vlmkit_2dsites4code4main3cls("markdown")], _M0FP314vlmkit_2dsites4code4main10md__blocks(_M0FP314vlmkit_2dsites4code4main11readme__src, "readme"))]);
  }
  function _M0FP314vlmkit_2dsites4code4main12static__listGiE(items, render) {
    const _p = _M0FP26mizchi7signals9untrackedGRPB5ArrayGRP36mizchi11js__browser3dom4NodeEE(items);
    let _tmp;
    let _p$2;
    _L: {
      _L$2: {
        if (_p.length === 0) {
          _p$2 = [];
          break _L$2;
        }
        const _p$3 = new Array(_p.length);
        const _p$4 = _p.length;
        let _tmp$2 = 0;
        while (true) {
          const _p$5 = _tmp$2;
          if (_p$5 < _p$4) {
            const _p$6 = _p[_p$5];
            _p$3[_p$5] = render(_p$6, _p$5);
            _tmp$2 = _p$5 + 1 | 0;
            continue;
          } else {
            break;
          }
        }
        _tmp = _p$3;
        break _L;
      }
      _tmp = _p$2;
    }
    return _M0FP36mizchi4luna3dom8fragment(_tmp);
  }
  function _M0FP314vlmkit_2dsites4code4main15branch__popover() {
    return _M0FP314vlmkit_2dsites4code4main7popover("branch", "btn branch-btn", "", [_M0FP314vlmkit_2dsites4code4main4icon("branch"), _M0FP314vlmkit_2dsites4code4main2el("span", [_M0FP314vlmkit_2dsites4code4main3cls("branch-name")], [_M0FP314vlmkit_2dsites4code4main2td(() => _M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(_M0FP314vlmkit_2dsites4code4main8branches, _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4code4main6branch)).name)]), _M0FP314vlmkit_2dsites4code4main7icon__c("caret", "ic caret")], "branch-pop", () => [_M0FP314vlmkit_2dsites4code4main2el("div", [_M0FP314vlmkit_2dsites4code4main3cls("pop-head")], [_M0FP314vlmkit_2dsites4code4main2el("p", [_M0FP314vlmkit_2dsites4code4main3cls("pop-title")], [_M0FP314vlmkit_2dsites4code4main1t("Switch branches/tags")]), _M0FP314vlmkit_2dsites4code4main2el("button", [_M0FP314vlmkit_2dsites4code4main3a__("type", "button"), _M0FP314vlmkit_2dsites4code4main3cls("btn btn-icon btn-bare"), _M0FP314vlmkit_2dsites4code4main3a__("aria-label", "Close"), _M0FP314vlmkit_2dsites4code4main2on("click", (_e) => {
      _M0FP314vlmkit_2dsites4code4main18close__menu__focus();
    })], [_M0FP314vlmkit_2dsites4code4main4icon("x")])]), _M0FP314vlmkit_2dsites4code4main2el("div", [_M0FP314vlmkit_2dsites4code4main3cls("pop-filter")], [_M0FP314vlmkit_2dsites4code4main2el("input", [_M0FP314vlmkit_2dsites4code4main3a__("type", "text"), _M0FP314vlmkit_2dsites4code4main3a__("id", "branch-filter"), _M0FP314vlmkit_2dsites4code4main3cls("input input-sm"), _M0FP314vlmkit_2dsites4code4main3a__("aria-label", "Find a branch or tag"), _M0FP314vlmkit_2dsites4code4main3a__("placeholder", "Find a branch or tag"), _M0FP314vlmkit_2dsites4code4main3a__("autocomplete", "off"), _M0FP314vlmkit_2dsites4code4main2on("input", (e) => {
      _M0MP26mizchi7signals6Signal3setGsE(_M0FP314vlmkit_2dsites4code4main14branch__filter, _M0FP314vlmkit_2dsites4code4main9ev__value(e));
    })], [])]), _M0FP314vlmkit_2dsites4code4main7tablist("bt", [_M0FP314vlmkit_2dsites4code4main15branch__popoverN5tupleS3258, _M0FP314vlmkit_2dsites4code4main15branch__popoverN5tupleS3259], _M0FP314vlmkit_2dsites4code4main11branch__tab, "seg-tabs"), _M0FP314vlmkit_2dsites4code4main2el("ul", [_M0FP314vlmkit_2dsites4code4main3cls("ref-list"), _M0FP314vlmkit_2dsites4code4main3a__("id", "bt-panel"), _M0FP314vlmkit_2dsites4code4main3a__("role", "tabpanel"), _M0FP314vlmkit_2dsites4code4main2ad("aria-labelledby", () => `bt-tab-${_M0MP26mizchi7signals6Signal3getGsE(_M0FP314vlmkit_2dsites4code4main11branch__tab)}`)], [_M0FP314vlmkit_2dsites4code4main5keyed(() => `${_M0MP26mizchi7signals6Signal3getGsE(_M0FP314vlmkit_2dsites4code4main14branch__filter)}|${_M0MP26mizchi7signals6Signal3getGsE(_M0FP314vlmkit_2dsites4code4main11branch__tab)}`, (_key) => _M0FP314vlmkit_2dsites4code4main12static__listGiE(() => {
      const want_tag = _M0MP26mizchi7signals6Signal3getGsE(_M0FP314vlmkit_2dsites4code4main11branch__tab) === "tags";
      const q = _M0MPC16string6String9to__lower(_M0MP26mizchi7signals6Signal3getGsE(_M0FP314vlmkit_2dsites4code4main14branch__filter));
      const out = [];
      const _bind = _M0FP314vlmkit_2dsites4code4main8branches.length;
      let _tmp = 0;
      while (true) {
        const i = _tmp;
        if (i < _bind) {
          const b = _M0FP314vlmkit_2dsites4code4main8branches[i];
          if (b.is_tag === want_tag && (q === "" || _M0MPC16string6String8contains(_M0MPC16string6String9to__lower(b.name), new _M0TPC16string10StringView(q, 0, q.length)))) {
            _M0MPC15array5Array4pushGiE(out, i);
          }
          _tmp = i + 1 | 0;
          continue;
        } else {
          break;
        }
      }
      return out;
    }, (i, _k) => {
      const b = _M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(_M0FP314vlmkit_2dsites4code4main8branches, i);
      const _tmp = [];
      const _tmp$2 = [_M0FP314vlmkit_2dsites4code4main3a__("type", "button"), _M0FP314vlmkit_2dsites4code4main3cls("ref-item"), _M0FP314vlmkit_2dsites4code4main2ad("aria-current", () => {
        const _p = _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4code4main6branch) === i;
        return _p ? "true" : "false";
      }), _M0FP314vlmkit_2dsites4code4main2on("click", (_e) => {
        _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4code4main6branch, i);
        _M0FP314vlmkit_2dsites4code4main18close__menu__focus();
      })];
      const _tmp$3 = _M0FP314vlmkit_2dsites4code4main2el("span", [_M0FP314vlmkit_2dsites4code4main3cls("choice-check")], [_M0FP36mizchi4luna3dom4show(() => _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4code4main6branch) === i, () => _M0FP314vlmkit_2dsites4code4main4icon("check"))]);
      const _tmp$4 = [_M0FP314vlmkit_2dsites4code4main3cls("ref-name")];
      const _tmp$5 = b.name;
      const _bind = _M0FP314vlmkit_2dsites4code4main5fuzzy(b.name, _M0MP26mizchi7signals6Signal3getGsE(_M0FP314vlmkit_2dsites4code4main14branch__filter));
      let _tmp$6;
      if (_bind.$tag === 1) {
        const _Some = _bind;
        const _h = _Some._0;
        _tmp$6 = _M0MP26mizchi7signals6Signal3getGsE(_M0FP314vlmkit_2dsites4code4main14branch__filter) === "" ? [] : _h;
      } else {
        _tmp$6 = [];
      }
      return _M0FP314vlmkit_2dsites4code4main2el("li", _tmp, [_M0FP314vlmkit_2dsites4code4main2el("button", _tmp$2, _M0IPC15array5ArrayPB3Add3addGRP36mizchi4luna3dom7DomNodeE([_tmp$3, _M0FP314vlmkit_2dsites4code4main2el("span", _tmp$4, _M0FP314vlmkit_2dsites4code4main6bolded(_tmp$5, _tmp$6))], i === 0 ? [_M0FP314vlmkit_2dsites4code4main2el("span", [_M0FP314vlmkit_2dsites4code4main3cls("pill pill-sm")], [_M0FP314vlmkit_2dsites4code4main1t("default")])] : []))]);
    }))]), _M0FP36mizchi4luna3dom4show(() => {
      const want_tag = _M0MP26mizchi7signals6Signal3getGsE(_M0FP314vlmkit_2dsites4code4main11branch__tab) === "tags";
      const q = _M0MPC16string6String9to__lower(_M0MP26mizchi7signals6Signal3getGsE(_M0FP314vlmkit_2dsites4code4main14branch__filter));
      const _p = [];
      const _p$2 = _M0FP314vlmkit_2dsites4code4main8branches.length;
      let _tmp;
      let _tmp$2 = 0;
      while (true) {
        const _p$3 = _tmp$2;
        if (_p$3 < _p$2) {
          const _p$4 = _M0FP314vlmkit_2dsites4code4main8branches[_p$3];
          if (_p$4.is_tag === want_tag && (q === "" || _M0MPC16string6String8contains(_M0MPC16string6String9to__lower(_p$4.name), new _M0TPC16string10StringView(q, 0, q.length)))) {
            _M0MPC15array5Array4pushGUssEE(_p, _p$4);
          }
          _tmp$2 = _p$3 + 1 | 0;
          continue;
        } else {
          _tmp = _p;
          break;
        }
      }
      return _tmp.length === 0;
    }, () => _M0FP314vlmkit_2dsites4code4main2el("p", [_M0FP314vlmkit_2dsites4code4main3cls("pop-empty")], [_M0FP314vlmkit_2dsites4code4main2td(() => `Nothing named “${_M0MP26mizchi7signals6Signal3getGsE(_M0FP314vlmkit_2dsites4code4main14branch__filter)}”.`)])), _M0FP314vlmkit_2dsites4code4main2el("p", [_M0FP314vlmkit_2dsites4code4main3cls("pop-foot")], [_M0FP314vlmkit_2dsites4code4main2el("a", [_M0FP314vlmkit_2dsites4code4main3a__("href", "#/"), _M0FP314vlmkit_2dsites4code4main3cls("link")], [_M0FP314vlmkit_2dsites4code4main2td(() => _M0MP26mizchi7signals6Signal3getGsE(_M0FP314vlmkit_2dsites4code4main11branch__tab) === "tags" ? "View all tags" : "View all branches")])])]);
  }
  function _M0FP314vlmkit_2dsites4code4main10code__menu() {
    return _M0FP314vlmkit_2dsites4code4main7popover("code", "btn btn-primary code-btn", "", [_M0FP314vlmkit_2dsites4code4main4icon("code"), _M0FP314vlmkit_2dsites4code4main2el("span", [], [_M0FP314vlmkit_2dsites4code4main1t("Code")]), _M0FP314vlmkit_2dsites4code4main7icon__c("caret", "ic caret")], "code-pop", () => [_M0FP314vlmkit_2dsites4code4main2el("div", [_M0FP314vlmkit_2dsites4code4main3cls("pop-head")], [_M0FP314vlmkit_2dsites4code4main2el("p", [_M0FP314vlmkit_2dsites4code4main3cls("pop-title")], [_M0FP314vlmkit_2dsites4code4main4icon("terminal"), _M0FP314vlmkit_2dsites4code4main1t(" Clone")])]), _M0FP314vlmkit_2dsites4code4main2el("div", [_M0FP314vlmkit_2dsites4code4main3cls("code-pop-body")], [_M0FP314vlmkit_2dsites4code4main7tablist("ct", [_M0FP314vlmkit_2dsites4code4main10code__menuN5tupleS3280, _M0FP314vlmkit_2dsites4code4main10code__menuN5tupleS3281], _M0FP314vlmkit_2dsites4code4main10clone__tab, "seg-tabs"), _M0FP314vlmkit_2dsites4code4main2el("div", [_M0FP314vlmkit_2dsites4code4main3a__("id", "ct-panel"), _M0FP314vlmkit_2dsites4code4main3a__("role", "tabpanel"), _M0FP314vlmkit_2dsites4code4main2ad("aria-labelledby", () => `ct-tab-${_M0MP26mizchi7signals6Signal3getGsE(_M0FP314vlmkit_2dsites4code4main10clone__tab)}`)], [_M0FP314vlmkit_2dsites4code4main5keyed(() => _M0MP26mizchi7signals6Signal3getGsE(_M0FP314vlmkit_2dsites4code4main10clone__tab), (k) => {
      const url = k === "cli" ? _M0FP314vlmkit_2dsites4code4main10clone__cli : _M0FP314vlmkit_2dsites4code4main12clone__https;
      return _M0FP314vlmkit_2dsites4code4main2el("div", [], [_M0FP314vlmkit_2dsites4code4main2el("div", [_M0FP314vlmkit_2dsites4code4main3cls("clone-row")], [_M0FP314vlmkit_2dsites4code4main2el("input", [_M0FP314vlmkit_2dsites4code4main3a__("type", "text"), _M0FP314vlmkit_2dsites4code4main3cls("input input-sm mono"), _M0FP314vlmkit_2dsites4code4main3a__("readonly", ""), _M0FP314vlmkit_2dsites4code4main3a__("value", url), _M0FP314vlmkit_2dsites4code4main3a__("aria-label", k === "cli" ? "Clone with the CLI" : "Clone URL"), _M0FP314vlmkit_2dsites4code4main2on("focus", (e) => {
        const tg = _M0MP26mizchi8js__core3Any5__get(e, "target");
        _M0MP26mizchi8js__core3Any6__call(tg, "select", $make_array_len_and_init(0, tg));
      })], []), _M0FP314vlmkit_2dsites4code4main12copy__button(`clone-${k}`, url, k === "cli" ? "Copy command" : "Copy URL")]), _M0FP314vlmkit_2dsites4code4main2el("p", [_M0FP314vlmkit_2dsites4code4main3cls("muted small")], [_M0FP314vlmkit_2dsites4code4main1t(k === "cli" ? "Use the Forgeyard command line tool." : "Clone using the web URL.")])]);
    })])]), _M0FP314vlmkit_2dsites4code4main2el("ul", [_M0FP314vlmkit_2dsites4code4main3cls("code-pop-actions")], [_M0FP314vlmkit_2dsites4code4main2el("li", [], [_M0FP314vlmkit_2dsites4code4main2el("a", [_M0FP314vlmkit_2dsites4code4main3a__("href", _M0FP314vlmkit_2dsites4code4main9data__url("Lantern 3.4.0 source archive (demo: no archive is served).\n")), _M0FP314vlmkit_2dsites4code4main3a__("download", "lantern-main.txt"), _M0FP314vlmkit_2dsites4code4main3cls("pop-action")], [_M0FP314vlmkit_2dsites4code4main4icon("download"), _M0FP314vlmkit_2dsites4code4main1t("Download ZIP")])])])]);
  }
  function _M0FP314vlmkit_2dsites4code4main7toolbar() {
    return _M0FP314vlmkit_2dsites4code4main2el("div", [_M0FP314vlmkit_2dsites4code4main3cls("toolbar")], [_M0FP314vlmkit_2dsites4code4main2el("div", [_M0FP314vlmkit_2dsites4code4main3cls("toolbar-left")], [_M0FP314vlmkit_2dsites4code4main15branch__popover(), _M0FP314vlmkit_2dsites4code4main2el("a", [_M0FP314vlmkit_2dsites4code4main3a__("href", "#/"), _M0FP314vlmkit_2dsites4code4main3cls("ref-count")], [_M0FP314vlmkit_2dsites4code4main4icon("branch"), _M0FP314vlmkit_2dsites4code4main2el("strong", [], [_M0FP314vlmkit_2dsites4code4main1t("8")]), _M0FP314vlmkit_2dsites4code4main1t(" Branches")]), _M0FP314vlmkit_2dsites4code4main2el("a", [_M0FP314vlmkit_2dsites4code4main3a__("href", "#/"), _M0FP314vlmkit_2dsites4code4main3cls("ref-count")], [_M0FP314vlmkit_2dsites4code4main4icon("tag"), _M0FP314vlmkit_2dsites4code4main2el("strong", [], [_M0FP314vlmkit_2dsites4code4main1t("5")]), _M0FP314vlmkit_2dsites4code4main1t(" Tags")])]), _M0FP314vlmkit_2dsites4code4main2el("div", [_M0FP314vlmkit_2dsites4code4main3cls("toolbar-right")], [_M0FP314vlmkit_2dsites4code4main2el("div", [_M0FP314vlmkit_2dsites4code4main3cls("goto")], [_M0FP314vlmkit_2dsites4code4main4icon("search"), _M0FP314vlmkit_2dsites4code4main2el("input", [_M0FP314vlmkit_2dsites4code4main3a__("type", "search"), _M0FP314vlmkit_2dsites4code4main3a__("id", "goto"), _M0FP314vlmkit_2dsites4code4main3cls("input goto-input"), _M0FP314vlmkit_2dsites4code4main3a__("placeholder", " "), _M0FP314vlmkit_2dsites4code4main3a__("autocomplete", "off"), _M0FP314vlmkit_2dsites4code4main3a__("aria-controls", "file-table"), _M0FP314vlmkit_2dsites4code4main2on("input", (e) => {
      _M0MP26mizchi7signals6Signal3setGsE(_M0FP314vlmkit_2dsites4code4main11goto__query, _M0FP314vlmkit_2dsites4code4main9ev__value(e));
    }), _M0FP314vlmkit_2dsites4code4main2on("keydown", (e) => {
      let _tmp;
      if (_M0FP314vlmkit_2dsites4code4main7ev__key(e) === "Escape") {
        const _p = _M0MP26mizchi7signals6Signal3getGsE(_M0FP314vlmkit_2dsites4code4main11goto__query);
        const _p$2 = "";
        _tmp = !(_p === _p$2);
      } else {
        _tmp = false;
      }
      if (_tmp) {
        _M0FP314vlmkit_2dsites4code4main7prevent(e);
        _M0MP26mizchi7signals6Signal3setGsE(_M0FP314vlmkit_2dsites4code4main11goto__query, "");
        _M0FP314vlmkit_2dsites4code4main10set__value("#goto", "");
        return;
      } else {
        return;
      }
    })], []), _M0FP314vlmkit_2dsites4code4main2el("label", [_M0FP314vlmkit_2dsites4code4main3a__("for", "goto"), _M0FP314vlmkit_2dsites4code4main3cls("goto-label")], [_M0FP314vlmkit_2dsites4code4main1t("Go to file")])]), _M0FP314vlmkit_2dsites4code4main10code__menu()])]);
  }
  function _M0FP314vlmkit_2dsites4code4main10home__view(dir) {
    const _tmp = [_M0FP314vlmkit_2dsites4code4main3cls(dir === "" ? "home layout-2" : "home layout-1")];
    const _tmp$2 = [_M0FP314vlmkit_2dsites4code4main3cls("main-col")];
    const _tmp$3 = _M0FP314vlmkit_2dsites4code4main7toolbar();
    let _tmp$4;
    const _p = "";
    if (!(dir === _p)) {
      _tmp$4 = _M0FP314vlmkit_2dsites4code4main6crumbs(dir, false);
    } else {
      _tmp$4 = _M0FP314vlmkit_2dsites4code4main1t("");
    }
    return _M0FP314vlmkit_2dsites4code4main2el("div", _tmp, [_M0FP314vlmkit_2dsites4code4main2el("div", _tmp$2, [_tmp$3, _tmp$4, _M0FP314vlmkit_2dsites4code4main11file__table(dir), dir === "" ? _M0FP314vlmkit_2dsites4code4main11readme__box() : _M0FP314vlmkit_2dsites4code4main1t("")]), dir === "" ? _M0FP314vlmkit_2dsites4code4main5about() : _M0FP314vlmkit_2dsites4code4main1t("")]);
  }
  function _M0FP314vlmkit_2dsites4code4main10parse__int(s) {
    let n = 0;
    let any = false;
    const _bind = s.length;
    let _tmp = 0;
    while (true) {
      const _string_index = _tmp;
      if (_string_index < _bind) {
        let _decoded_next_string_index;
        let _decoded_char;
        _L: {
          const _bind$2 = s.charCodeAt(_string_index);
          if (_bind$2 >= 55296 && _bind$2 <= 56319 && (_string_index + 1 | 0) < _bind) {
            const _bind$3 = s.charCodeAt(_string_index + 1 | 0);
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
        if (_M0MPC14char4Char16is__ascii__digit(_decoded_char)) {
          n = (Math.imul(n, 10) | 0) + (_decoded_char - 48 | 0) | 0;
          any = true;
        } else {
          break;
        }
        _tmp = _decoded_next_string_index;
        continue;
      } else {
        break;
      }
    }
    return any ? n : 0;
  }
  function _M0FP314vlmkit_2dsites4code4main11open__count() {
    const _p = _M0MP26mizchi7signals6Signal3getGRPB5ArrayGRP314vlmkit_2dsites4code4main5IssueEE(_M0FP314vlmkit_2dsites4code4main6issues);
    const _p$2 = [];
    const _p$3 = _p.length;
    let _tmp;
    let _tmp$2 = 0;
    while (true) {
      const _p$4 = _tmp$2;
      if (_p$4 < _p$3) {
        const _p$5 = _p[_p$4];
        if (_p$5.open_) {
          _M0MPC15array5Array4pushGUssEE(_p$2, _p$5);
        }
        _tmp$2 = _p$4 + 1 | 0;
        continue;
      } else {
        _tmp = _p$2;
        break;
      }
    }
    return _tmp.length;
  }
  function _M0FP314vlmkit_2dsites4code4main9repo__tab(key, label, ic, count, href) {
    const _tmp = [_M0FP314vlmkit_2dsites4code4main3a__("href", href), _M0FP314vlmkit_2dsites4code4main2ad("class", () => `repo-tab${_M0FP314vlmkit_2dsites4code4main14tab__of__route(_M0MP26mizchi7signals6Signal3getGsE(_M0FP314vlmkit_2dsites4code4main5route)) === key ? " is-current" : ""}`), _M0FP314vlmkit_2dsites4code4main2ad("aria-current", () => _M0FP314vlmkit_2dsites4code4main14tab__of__route(_M0MP26mizchi7signals6Signal3getGsE(_M0FP314vlmkit_2dsites4code4main5route)) === key ? "page" : "false")];
    const _tmp$2 = [_M0FP314vlmkit_2dsites4code4main4icon(ic), _M0FP314vlmkit_2dsites4code4main2el("span", [], [_M0FP314vlmkit_2dsites4code4main1t(label)])];
    let _tmp$3;
    const _p = count();
    const _p$2 = "";
    if (!(_p === _p$2)) {
      _tmp$3 = [_M0FP314vlmkit_2dsites4code4main2el("span", [_M0FP314vlmkit_2dsites4code4main3cls("counter")], [_M0FP314vlmkit_2dsites4code4main2td(count)])];
    } else {
      _tmp$3 = [];
    }
    return _M0FP314vlmkit_2dsites4code4main2el("a", _tmp, _M0IPC15array5ArrayPB3Add3addGRP36mizchi4luna3dom7DomNodeE(_tmp$2, _tmp$3));
  }
  function _M0FP314vlmkit_2dsites4code4main10repo__head() {
    return _M0FP314vlmkit_2dsites4code4main2el("div", [_M0FP314vlmkit_2dsites4code4main3cls("repohead")], [_M0FP314vlmkit_2dsites4code4main2el("div", [_M0FP314vlmkit_2dsites4code4main3cls("repohead-inner")], [_M0FP314vlmkit_2dsites4code4main2el("p", [_M0FP314vlmkit_2dsites4code4main3cls("repo-path")], [_M0FP314vlmkit_2dsites4code4main2el("a", [_M0FP314vlmkit_2dsites4code4main3a__("href", "#/"), _M0FP314vlmkit_2dsites4code4main3cls("repo-owner")], [_M0FP314vlmkit_2dsites4code4main1t(_M0FP314vlmkit_2dsites4code4main5owner)]), _M0FP314vlmkit_2dsites4code4main2el("span", [_M0FP314vlmkit_2dsites4code4main3cls("repo-sep")], [_M0FP314vlmkit_2dsites4code4main1t("/")]), _M0FP314vlmkit_2dsites4code4main2el("a", [_M0FP314vlmkit_2dsites4code4main3a__("href", "#/"), _M0FP314vlmkit_2dsites4code4main3cls("repo-name")], [_M0FP314vlmkit_2dsites4code4main1t(_M0FP314vlmkit_2dsites4code4main10repo__name)])]), _M0FP314vlmkit_2dsites4code4main2el("nav", [_M0FP314vlmkit_2dsites4code4main3a__("aria-label", "Repository"), _M0FP314vlmkit_2dsites4code4main3cls("repo-tabs")], [_M0FP314vlmkit_2dsites4code4main9repo__tab("code", "Code", "code", () => "", "#/"), _M0FP314vlmkit_2dsites4code4main9repo__tab("issues", "Issues", "issue", () => _M0MPC13int3Int18to__string_2einner(_M0FP314vlmkit_2dsites4code4main11open__count(), 10), "#/issues"), _M0FP314vlmkit_2dsites4code4main9repo__tab("pulls", "Pull requests", "pr", () => _M0MPC13int3Int18to__string_2einner(_M0FP314vlmkit_2dsites4code4main5pulls.length, 10), "#/pulls"), _M0FP314vlmkit_2dsites4code4main9repo__tab("actions", "Actions", "play", () => "", "#/actions"), _M0FP314vlmkit_2dsites4code4main9repo__tab("security", "Security", "shield", () => "", "#/security"), _M0FP314vlmkit_2dsites4code4main9repo__tab("insights", "Insights", "graph", () => "", "#/insights")])])]);
  }
  function _M0FP314vlmkit_2dsites4code4main12fork__dialog() {
    return _M0FP314vlmkit_2dsites4code4main2el("dialog", [_M0FP314vlmkit_2dsites4code4main3a__("id", "fork-dialog"), _M0FP314vlmkit_2dsites4code4main3cls("modal"), _M0FP314vlmkit_2dsites4code4main3a__("aria-labelledby", "fork-title"), _M0FP314vlmkit_2dsites4code4main2on("click", (e) => {
      if (_M0FP314vlmkit_2dsites4code4main10target__is(e, "fork-dialog")) {
        _M0FP314vlmkit_2dsites4code4main12close__modal("fork-dialog");
        return;
      } else {
        return;
      }
    }), _M0FP314vlmkit_2dsites4code4main2on("close", (_e) => {
      _M0FP314vlmkit_2dsites4code4main10focus__sel("#btn-fork");
    })], [_M0FP314vlmkit_2dsites4code4main2el("form", [_M0FP314vlmkit_2dsites4code4main3a__("method", "dialog"), _M0FP314vlmkit_2dsites4code4main3cls("modal-form"), _M0FP314vlmkit_2dsites4code4main2on("submit", (e) => {
      _M0FP314vlmkit_2dsites4code4main7prevent(e);
      _M0MP26mizchi7signals6Signal6updateGiE(_M0FP314vlmkit_2dsites4code4main5forks, (n) => n + 1 | 0);
      _M0FP314vlmkit_2dsites4code4main12close__modal("fork-dialog");
    })], [_M0FP314vlmkit_2dsites4code4main2el("div", [_M0FP314vlmkit_2dsites4code4main3cls("modal-head")], [_M0FP314vlmkit_2dsites4code4main2el("h2", [_M0FP314vlmkit_2dsites4code4main3a__("id", "fork-title")], [_M0FP314vlmkit_2dsites4code4main1t("Create a new fork")]), _M0FP314vlmkit_2dsites4code4main2el("button", [_M0FP314vlmkit_2dsites4code4main3a__("type", "button"), _M0FP314vlmkit_2dsites4code4main3cls("btn btn-icon"), _M0FP314vlmkit_2dsites4code4main3a__("aria-label", "Close"), _M0FP314vlmkit_2dsites4code4main2on("click", (_e) => {
      _M0FP314vlmkit_2dsites4code4main12close__modal("fork-dialog");
    })], [_M0FP314vlmkit_2dsites4code4main4icon("x")])]), _M0FP314vlmkit_2dsites4code4main2el("p", [_M0FP314vlmkit_2dsites4code4main3cls("muted")], [_M0FP314vlmkit_2dsites4code4main1t("A fork is a copy of tidewater/lantern under your account. Changes to it do not touch the original.")]), _M0FP314vlmkit_2dsites4code4main2el("div", [_M0FP314vlmkit_2dsites4code4main3cls("field-row")], [_M0FP314vlmkit_2dsites4code4main2el("div", [_M0FP314vlmkit_2dsites4code4main3cls("field")], [_M0FP314vlmkit_2dsites4code4main2el("span", [_M0FP314vlmkit_2dsites4code4main3cls("field-label"), _M0FP314vlmkit_2dsites4code4main3a__("id", "fork-owner-l")], [_M0FP314vlmkit_2dsites4code4main1t("Owner")]), _M0FP314vlmkit_2dsites4code4main2el("span", [_M0FP314vlmkit_2dsites4code4main3cls("field-static"), _M0FP314vlmkit_2dsites4code4main3a__("aria-labelledby", "fork-owner-l")], [_M0FP314vlmkit_2dsites4code4main1t("you")])]), _M0FP314vlmkit_2dsites4code4main2el("span", [_M0FP314vlmkit_2dsites4code4main3cls("field-slash"), _M0FP314vlmkit_2dsites4code4main3a__("aria-hidden", "true")], [_M0FP314vlmkit_2dsites4code4main1t("/")]), _M0FP314vlmkit_2dsites4code4main2el("div", [_M0FP314vlmkit_2dsites4code4main3cls("field grow")], [_M0FP314vlmkit_2dsites4code4main2el("label", [_M0FP314vlmkit_2dsites4code4main3a__("for", "fork-name"), _M0FP314vlmkit_2dsites4code4main3cls("field-label")], [_M0FP314vlmkit_2dsites4code4main1t("Repository name")]), _M0FP314vlmkit_2dsites4code4main2el("input", [_M0FP314vlmkit_2dsites4code4main3a__("id", "fork-name"), _M0FP314vlmkit_2dsites4code4main3a__("type", "text"), _M0FP314vlmkit_2dsites4code4main3cls("input"), _M0FP314vlmkit_2dsites4code4main3a__("value", "lantern"), _M0FP314vlmkit_2dsites4code4main3a__("required", ""), _M0FP314vlmkit_2dsites4code4main3a__("autofocus", "")], [])])]), _M0FP314vlmkit_2dsites4code4main2el("div", [_M0FP314vlmkit_2dsites4code4main3cls("field")], [_M0FP314vlmkit_2dsites4code4main2el("label", [_M0FP314vlmkit_2dsites4code4main3a__("for", "fork-desc"), _M0FP314vlmkit_2dsites4code4main3cls("field-label")], [_M0FP314vlmkit_2dsites4code4main1t("Description (optional)")]), _M0FP314vlmkit_2dsites4code4main2el("input", [_M0FP314vlmkit_2dsites4code4main3a__("id", "fork-desc"), _M0FP314vlmkit_2dsites4code4main3a__("type", "text"), _M0FP314vlmkit_2dsites4code4main3cls("input"), _M0FP314vlmkit_2dsites4code4main3a__("value", "A static site generator that rebuilds only what changed")], [])]), _M0FP314vlmkit_2dsites4code4main2el("label", [_M0FP314vlmkit_2dsites4code4main3cls("check-row")], [_M0FP314vlmkit_2dsites4code4main2el("input", [_M0FP314vlmkit_2dsites4code4main3a__("type", "checkbox"), _M0FP314vlmkit_2dsites4code4main12fork__dialogN5tupleS3307], []), _M0FP314vlmkit_2dsites4code4main1t(" Copy the main branch only")]), _M0FP314vlmkit_2dsites4code4main2el("div", [_M0FP314vlmkit_2dsites4code4main3cls("modal-foot")], [_M0FP314vlmkit_2dsites4code4main2el("button", [_M0FP314vlmkit_2dsites4code4main3a__("type", "button"), _M0FP314vlmkit_2dsites4code4main3cls("btn"), _M0FP314vlmkit_2dsites4code4main2on("click", (_e) => {
      _M0FP314vlmkit_2dsites4code4main12close__modal("fork-dialog");
    })], [_M0FP314vlmkit_2dsites4code4main1t("Cancel")]), _M0FP314vlmkit_2dsites4code4main2el("button", [_M0FP314vlmkit_2dsites4code4main3a__("type", "submit"), _M0FP314vlmkit_2dsites4code4main3cls("btn btn-primary")], [_M0FP314vlmkit_2dsites4code4main1t("Create fork")])])])]);
  }
  function _M0FP314vlmkit_2dsites4code4main11star__count() {
    return _M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4code4main7starred) ? 4219 : 4218;
  }
  function _M0FP314vlmkit_2dsites4code4main10title__row() {
    return _M0FP314vlmkit_2dsites4code4main2el("div", [_M0FP314vlmkit_2dsites4code4main3cls("title-row")], [_M0FP314vlmkit_2dsites4code4main2el("h1", [_M0FP314vlmkit_2dsites4code4main3cls("repo-title")], [_M0FP314vlmkit_2dsites4code4main7icon__c("repo", "ic repo-ic"), _M0FP314vlmkit_2dsites4code4main2el("a", [_M0FP314vlmkit_2dsites4code4main3a__("href", "#/")], [_M0FP314vlmkit_2dsites4code4main1t(_M0FP314vlmkit_2dsites4code4main10repo__name)]), _M0FP314vlmkit_2dsites4code4main2el("span", [_M0FP314vlmkit_2dsites4code4main3cls("pill")], [_M0FP314vlmkit_2dsites4code4main1t("Public")])]), _M0FP314vlmkit_2dsites4code4main2el("div", [_M0FP314vlmkit_2dsites4code4main3cls("repo-actions")], [_M0FP314vlmkit_2dsites4code4main7popover("watch", "btn btn-count", "", [_M0FP314vlmkit_2dsites4code4main4icon("eye"), _M0FP314vlmkit_2dsites4code4main2el("span", [_M0FP314vlmkit_2dsites4code4main3cls("btn-text btn-text-narrow")], [_M0FP314vlmkit_2dsites4code4main1t("Watch")]), _M0FP314vlmkit_2dsites4code4main2el("span", [_M0FP314vlmkit_2dsites4code4main3cls("counter")], [_M0FP314vlmkit_2dsites4code4main1t("38")]), _M0FP314vlmkit_2dsites4code4main7icon__c("caret", "ic caret")], "menu-pop watch-pop", () => {
      const _tmp = _M0FP314vlmkit_2dsites4code4main2el("p", [_M0FP314vlmkit_2dsites4code4main3cls("pop-title")], [_M0FP314vlmkit_2dsites4code4main1t("Notifications")]);
      const _tmp$2 = [_M0FP314vlmkit_2dsites4code4main3cls("choice-list"), _M0FP314vlmkit_2dsites4code4main3a__("aria-label", "Notifications")];
      const _p = new Array(_M0FP314vlmkit_2dsites4code4main14watch__options.length);
      const _p$2 = _M0FP314vlmkit_2dsites4code4main14watch__options.length;
      let _tmp$3 = 0;
      while (true) {
        const _p$3 = _tmp$3;
        if (_p$3 < _p$2) {
          const _p$4 = _M0FP314vlmkit_2dsites4code4main14watch__options[_p$3];
          const _p$5 = _p$4._0;
          const _p$6 = _p$4._1;
          _p[_p$3] = _M0FP314vlmkit_2dsites4code4main2el("li", [], [_M0FP314vlmkit_2dsites4code4main2el("button", [_M0FP314vlmkit_2dsites4code4main3a__("type", "button"), _M0FP314vlmkit_2dsites4code4main3cls("choice"), _M0FP314vlmkit_2dsites4code4main2ad("aria-pressed", () => {
            const _p$7 = _M0MP26mizchi7signals6Signal3getGsE(_M0FP314vlmkit_2dsites4code4main11watch__mode) === _p$5;
            return _p$7 ? "true" : "false";
          }), _M0FP314vlmkit_2dsites4code4main2on("click", (_p$7) => {
            _M0MP26mizchi7signals6Signal3setGsE(_M0FP314vlmkit_2dsites4code4main11watch__mode, _p$5);
            _M0FP314vlmkit_2dsites4code4main18close__menu__focus();
          })], [_M0FP314vlmkit_2dsites4code4main2el("span", [_M0FP314vlmkit_2dsites4code4main3cls("choice-check")], [_M0FP36mizchi4luna3dom4show(() => _M0MP26mizchi7signals6Signal3getGsE(_M0FP314vlmkit_2dsites4code4main11watch__mode) === _p$5, () => _M0FP314vlmkit_2dsites4code4main4icon("check"))]), _M0FP314vlmkit_2dsites4code4main2el("span", [_M0FP314vlmkit_2dsites4code4main3cls("choice-body")], [_M0FP314vlmkit_2dsites4code4main2el("span", [_M0FP314vlmkit_2dsites4code4main3cls("choice-name")], [_M0FP314vlmkit_2dsites4code4main1t(_p$5)]), _M0FP314vlmkit_2dsites4code4main2el("span", [_M0FP314vlmkit_2dsites4code4main3cls("choice-desc")], [_M0FP314vlmkit_2dsites4code4main1t(_p$6)])])])]);
          _tmp$3 = _p$3 + 1 | 0;
          continue;
        } else {
          break;
        }
      }
      return [_tmp, _M0FP314vlmkit_2dsites4code4main2el("ul", _tmp$2, _p)];
    }), _M0FP314vlmkit_2dsites4code4main2el("button", [_M0FP314vlmkit_2dsites4code4main3a__("type", "button"), _M0FP314vlmkit_2dsites4code4main3cls("btn btn-count"), _M0FP314vlmkit_2dsites4code4main3a__("id", "btn-fork"), _M0FP314vlmkit_2dsites4code4main3a__("aria-haspopup", "dialog"), _M0FP314vlmkit_2dsites4code4main2on("click", (_e) => {
      _M0MP26mizchi7signals6Signal3setGsE(_M0FP314vlmkit_2dsites4code4main10open__menu, "");
      _M0FP314vlmkit_2dsites4code4main11show__modal("fork-dialog");
    })], [_M0FP314vlmkit_2dsites4code4main4icon("fork"), _M0FP314vlmkit_2dsites4code4main2el("span", [_M0FP314vlmkit_2dsites4code4main3cls("btn-text btn-text-narrow")], [_M0FP314vlmkit_2dsites4code4main1t("Fork")]), _M0FP314vlmkit_2dsites4code4main2el("span", [_M0FP314vlmkit_2dsites4code4main3cls("counter")], [_M0FP314vlmkit_2dsites4code4main2td(() => _M0MPC13int3Int18to__string_2einner(_M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4code4main5forks), 10))])]), _M0FP314vlmkit_2dsites4code4main2el("button", [_M0FP314vlmkit_2dsites4code4main3a__("type", "button"), _M0FP314vlmkit_2dsites4code4main2ad("class", () => `btn btn-count star-btn${_M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4code4main7starred) ? " is-starred" : ""}`), _M0FP314vlmkit_2dsites4code4main3a__("id", "btn-star"), _M0FP314vlmkit_2dsites4code4main2ad("aria-pressed", () => {
      const _p = _M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4code4main7starred);
      return _p ? "true" : "false";
    }), _M0FP314vlmkit_2dsites4code4main2on("click", (_e) => {
      _M0MP26mizchi7signals6Signal6updateGbE(_M0FP314vlmkit_2dsites4code4main7starred, (v) => !v);
    })], [_M0FP36mizchi4luna3dom4show(() => !_M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4code4main7starred), () => _M0FP314vlmkit_2dsites4code4main4icon("star")), _M0FP36mizchi4luna3dom4show(() => _M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4code4main7starred), () => _M0FP314vlmkit_2dsites4code4main7icon__c("star-fill", "ic star-on")), _M0FP314vlmkit_2dsites4code4main2el("span", [_M0FP314vlmkit_2dsites4code4main3cls("btn-text")], [_M0FP314vlmkit_2dsites4code4main2td(() => _M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4code4main7starred) ? "Starred" : "Star")]), _M0FP314vlmkit_2dsites4code4main2el("span", [_M0FP314vlmkit_2dsites4code4main3cls("counter")], [_M0FP314vlmkit_2dsites4code4main2td(() => _M0FP314vlmkit_2dsites4code4main9thousands(_M0FP314vlmkit_2dsites4code4main11star__count()))])])]), _M0FP314vlmkit_2dsites4code4main12fork__dialog()]);
  }
  function _M0FP314vlmkit_2dsites4code4main9app__main() {
    return _M0FP314vlmkit_2dsites4code4main2el("div", [_M0FP314vlmkit_2dsites4code4main3cls("app")], [_M0FP314vlmkit_2dsites4code4main10repo__head(), _M0FP314vlmkit_2dsites4code4main2el("div", [_M0FP314vlmkit_2dsites4code4main3cls("container")], [_M0FP314vlmkit_2dsites4code4main10title__row(), _M0FP314vlmkit_2dsites4code4main5keyed(() => _M0MP26mizchi7signals6Signal3getGsE(_M0FP314vlmkit_2dsites4code4main5route), (r) => _M0MPC16string6String11has__prefix(r, _M0FP314vlmkit_2dsites4code4main9app__mainN6recordS3321) ? _M0FP314vlmkit_2dsites4code4main10home__view(_M0MPC16string6String17substring_2einner(r, 5, undefined)) : _M0MPC16string6String11has__prefix(r, _M0FP314vlmkit_2dsites4code4main9app__mainN6recordS3322) ? _M0FP314vlmkit_2dsites4code4main10blob__view(_M0MPC16string6String17substring_2einner(r, 5, undefined)) : r === "issues" ? _M0FP314vlmkit_2dsites4code4main12issues__view() : r === "new" ? _M0FP314vlmkit_2dsites4code4main16new__issue__view() : _M0MPC16string6String11has__prefix(r, _M0FP314vlmkit_2dsites4code4main9app__mainN6recordS3323) ? _M0FP314vlmkit_2dsites4code4main11issue__view(_M0FP314vlmkit_2dsites4code4main10parse__int(_M0MPC16string6String17substring_2einner(r, 6, undefined))) : r === "pulls" ? _M0FP314vlmkit_2dsites4code4main11pulls__view() : _M0FP314vlmkit_2dsites4code4main9tab__view(_M0MPC16string6String17substring_2einner(r, 4, undefined)))])]);
  }
  function _M0FP314vlmkit_2dsites4code4main10logo__mark() {
    return _M0FP314vlmkit_2dsites4code4main7svg__el("svg", [_M0FP314vlmkit_2dsites4code4main3a__("viewBox", "0 0 32 32"), _M0FP314vlmkit_2dsites4code4main3a__("width", "32"), _M0FP314vlmkit_2dsites4code4main3a__("height", "32"), _M0FP314vlmkit_2dsites4code4main3a__("aria-hidden", "true"), _M0FP314vlmkit_2dsites4code4main3a__("focusable", "false"), _M0FP314vlmkit_2dsites4code4main3cls("logo-mark")], [_M0FP314vlmkit_2dsites4code4main7svg__el("rect", [_M0FP314vlmkit_2dsites4code4main3a__("x", "1"), _M0FP314vlmkit_2dsites4code4main3a__("y", "1"), _M0FP314vlmkit_2dsites4code4main3a__("width", "30"), _M0FP314vlmkit_2dsites4code4main3a__("height", "30"), _M0FP314vlmkit_2dsites4code4main3a__("rx", "8"), _M0FP314vlmkit_2dsites4code4main3a__("fill", "#f97316")], []), _M0FP314vlmkit_2dsites4code4main7svg__el("path", [_M0FP314vlmkit_2dsites4code4main3a__("d", "M7 15h15c0 2.5-2 4-4.5 4H17l1.5 4.5h3V25H10.5v-1.5h3L15 19h-3c-2.8 0-5-1.6-5-4z"), _M0FP314vlmkit_2dsites4code4main3a__("fill", "#ffffff")], []), _M0FP314vlmkit_2dsites4code4main7svg__el("path", [_M0FP314vlmkit_2dsites4code4main3a__("d", "M21 5l1.2 3.3L25.5 9.5l-3.3 1.2L21 14l-1.2-3.3L16.5 9.5l3.3-1.2z"), _M0FP314vlmkit_2dsites4code4main3a__("fill", "#ffffff")], [])]);
  }
  function _M0FP314vlmkit_2dsites4code4main9nav__menu(name, items, prefix) {
    const key = `${prefix}${_M0FP314vlmkit_2dsites4code4main4slug(name)}`;
    return _M0FP314vlmkit_2dsites4code4main7popover(key, "gh-nav-btn", "", [_M0FP314vlmkit_2dsites4code4main1t(name), _M0FP314vlmkit_2dsites4code4main7icon__c("caret", "ic caret")], "nav-pop", () => {
      const _tmp = [_M0FP314vlmkit_2dsites4code4main3cls("nav-pop-list"), _M0FP314vlmkit_2dsites4code4main3a__("aria-label", name)];
      const _p = new Array(items.length);
      const _p$2 = items.length;
      let _tmp$2 = 0;
      while (true) {
        const _p$3 = _tmp$2;
        if (_p$3 < _p$2) {
          const _p$4 = items[_p$3];
          const _p$5 = _p$4._0;
          const _p$6 = _p$4._1;
          _p[_p$3] = _M0FP314vlmkit_2dsites4code4main2el("li", [], [_M0FP314vlmkit_2dsites4code4main2el("a", [_M0FP314vlmkit_2dsites4code4main3a__("href", "#/"), _M0FP314vlmkit_2dsites4code4main3cls("nav-pop-link")], [_M0FP314vlmkit_2dsites4code4main2el("span", [_M0FP314vlmkit_2dsites4code4main3cls("nav-pop-title")], [_M0FP314vlmkit_2dsites4code4main1t(_p$5)]), _M0FP314vlmkit_2dsites4code4main2el("span", [_M0FP314vlmkit_2dsites4code4main3cls("nav-pop-desc")], [_M0FP314vlmkit_2dsites4code4main1t(_p$6)])])]);
          _tmp$2 = _p$3 + 1 | 0;
          continue;
        } else {
          break;
        }
      }
      return [_M0FP314vlmkit_2dsites4code4main2el("ul", _tmp, _p)];
    });
  }
  function _M0FP314vlmkit_2dsites4code4main13open__palette() {
    _M0MP26mizchi7signals6Signal3setGsE(_M0FP314vlmkit_2dsites4code4main10pal__query, "");
    _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4code4main11pal__active, 0);
    _M0FP314vlmkit_2dsites4code4main10set__value("#palette-input", "");
    _M0MP26mizchi7signals6Signal3setGsE(_M0FP314vlmkit_2dsites4code4main10open__menu, "");
    _M0FP314vlmkit_2dsites4code4main11show__modal("palette");
  }
  function _M0FP314vlmkit_2dsites4code4main7pal__go(href) {
    _M0FP314vlmkit_2dsites4code4main12close__modal("palette");
    _M0FP314vlmkit_2dsites4code4main9set__hash(href);
  }
  function _M0FP314vlmkit_2dsites4code4main10pal__items() {
    const q = _M0MPC16string10StringView9to__owned(_M0MPC16string6String12trim_2einner(_M0MP26mizchi7signals6Signal3getGsE(_M0FP314vlmkit_2dsites4code4main10pal__query), _M0FP314vlmkit_2dsites4code4main10pal__itemsN6recordS3333));
    if (q === "") {
      return [new _M0TP314vlmkit_2dsites4code4main7PalItem("go", "Code", "tidewater/lantern", "#/", []), new _M0TP314vlmkit_2dsites4code4main7PalItem("go", "Issues", `${_M0MPC13int3Int18to__string_2einner(_M0FP314vlmkit_2dsites4code4main11open__count(), 10)} open`, "#/issues", []), new _M0TP314vlmkit_2dsites4code4main7PalItem("go", "Pull requests", "4 open", "#/pulls", []), new _M0TP314vlmkit_2dsites4code4main7PalItem("go", "New issue", "Open the form", "#/issues/new", []), new _M0TP314vlmkit_2dsites4code4main7PalItem("file", "README.md", "File", "#/blob/README.md", []), new _M0TP314vlmkit_2dsites4code4main7PalItem("file", "src/core/build.ts", "File", "#/blob/src/core/build.ts", [])];
    }
    const out = [];
    const files = _M0FP314vlmkit_2dsites4code4main12match__files(q);
    const _bind = files.length;
    let _tmp = 0;
    while (true) {
      const i = _tmp;
      if (i < _bind) {
        const f = files[i];
        if (i < 7) {
          _M0MPC15array5Array4pushGUssEE(out, new _M0TP314vlmkit_2dsites4code4main7PalItem("file", f._0, "File", `#/blob/${f._0}`, f._1));
        }
        _tmp = i + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    const qn = _M0MPC16string6String11has__prefix(q, _M0FP314vlmkit_2dsites4code4main10pal__itemsN6recordS3334) ? _M0MPC16string6String17substring_2einner(q, 1, undefined) : q;
    let n = 0;
    const _bind$2 = _M0MP26mizchi7signals6Signal3getGRPB5ArrayGRP314vlmkit_2dsites4code4main5IssueEE(_M0FP314vlmkit_2dsites4code4main6issues);
    const _bind$3 = _bind$2.length;
    let _tmp$2 = 0;
    while (true) {
      const _ = _tmp$2;
      if (_ < _bind$3) {
        const iss = _bind$2[_];
        _L: {
          if (n >= 6) {
            break;
          }
          if (_M0MPC13int3Int18to__string_2einner(iss.num, 10) === qn) {
            _M0MPC15array5Array4pushGUssEE(out, new _M0TP314vlmkit_2dsites4code4main7PalItem("issue", iss.title, `#${_M0MPC13int3Int18to__string_2einner(iss.num, 10)}`, `#/issues/${_M0MPC13int3Int18to__string_2einner(iss.num, 10)}`, []));
            n = n + 1 | 0;
            break _L;
          }
          const _tmp$3 = _M0MPC16string6String9to__lower(iss.title);
          const _bind$4 = _M0MPC16string6String9to__lower(q);
          const _bind$5 = _M0MPC16string6String4find(_tmp$3, new _M0TPC16string10StringView(_bind$4, 0, _bind$4.length));
          if (_bind$5 === undefined) {
          } else {
            const _Some = _bind$5;
            const _at = _Some;
            const hits = [];
            const _bind$6 = q.length;
            let _tmp$4 = 0;
            while (true) {
              const k = _tmp$4;
              if (k < _bind$6) {
                _M0MPC15array5Array4pushGiE(hits, _at + k | 0);
                _tmp$4 = k + 1 | 0;
                continue;
              } else {
                break;
              }
            }
            _M0MPC15array5Array4pushGUssEE(out, new _M0TP314vlmkit_2dsites4code4main7PalItem("issue", iss.title, `#${_M0MPC13int3Int18to__string_2einner(iss.num, 10)}`, `#/issues/${_M0MPC13int3Int18to__string_2einner(iss.num, 10)}`, hits));
            n = n + 1 | 0;
          }
          break _L;
        }
        _tmp$2 = _ + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return out;
  }
  function _M0FP314vlmkit_2dsites4code4main7palette() {
    const items = _M0FP26mizchi7signals4memoGRPB5ArrayGRP314vlmkit_2dsites4code4main7PalItemEE(() => _M0FP314vlmkit_2dsites4code4main10pal__items());
    return _M0FP314vlmkit_2dsites4code4main2el("dialog", [_M0FP314vlmkit_2dsites4code4main3a__("id", "palette"), _M0FP314vlmkit_2dsites4code4main3cls("palette"), _M0FP314vlmkit_2dsites4code4main3a__("aria-label", "Search or jump to"), _M0FP314vlmkit_2dsites4code4main2on("click", (e) => {
      if (_M0FP314vlmkit_2dsites4code4main10target__is(e, "palette")) {
        _M0FP314vlmkit_2dsites4code4main12close__modal("palette");
        return;
      } else {
        return;
      }
    }), _M0FP314vlmkit_2dsites4code4main2on("close", (_e) => {
      _M0FP314vlmkit_2dsites4code4main10focus__sel("#btn-search");
    })], [_M0FP314vlmkit_2dsites4code4main2el("div", [_M0FP314vlmkit_2dsites4code4main3cls("pal-head")], [_M0FP314vlmkit_2dsites4code4main4icon("search"), _M0FP314vlmkit_2dsites4code4main2el("input", [_M0FP314vlmkit_2dsites4code4main3a__("id", "palette-input"), _M0FP314vlmkit_2dsites4code4main3a__("autofocus", ""), _M0FP314vlmkit_2dsites4code4main3a__("type", "text"), _M0FP314vlmkit_2dsites4code4main3cls("pal-input"), _M0FP314vlmkit_2dsites4code4main3a__("role", "combobox"), _M0FP314vlmkit_2dsites4code4main3a__("aria-label", "Search files and issues"), _M0FP314vlmkit_2dsites4code4main3a__("aria-autocomplete", "list"), _M0FP314vlmkit_2dsites4code4main3a__("aria-controls", "palette-list"), _M0FP314vlmkit_2dsites4code4main3a__("aria-expanded", "true"), _M0FP314vlmkit_2dsites4code4main3a__("autocomplete", "off"), _M0FP314vlmkit_2dsites4code4main3a__("spellcheck", "false"), _M0FP314vlmkit_2dsites4code4main3a__("placeholder", "Search files and issues"), _M0FP314vlmkit_2dsites4code4main2ad("aria-activedescendant", () => items().length > 0 ? `pal-opt-${_M0MPC13int3Int18to__string_2einner(_M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4code4main11pal__active), 10)}` : ""), _M0FP314vlmkit_2dsites4code4main2on("input", (e) => {
      _M0FP26mizchi7signals5batchGuE(() => {
        _M0MP26mizchi7signals6Signal3setGsE(_M0FP314vlmkit_2dsites4code4main10pal__query, _M0FP314vlmkit_2dsites4code4main9ev__value(e));
        _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4code4main11pal__active, 0);
      });
    }), _M0FP314vlmkit_2dsites4code4main2on("keydown", (e) => {
      const k = _M0FP314vlmkit_2dsites4code4main7ev__key(e);
      const n = items().length;
      if (k === "ArrowDown" && n > 0) {
        _M0FP314vlmkit_2dsites4code4main7prevent(e);
        _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4code4main11pal__active, (_M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4code4main11pal__active) + 1 | 0) % n | 0);
        _M0FP314vlmkit_2dsites4code4main18scroll__into__list(`#pal-opt-${_M0MPC13int3Int18to__string_2einner(_M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4code4main11pal__active), 10)}`);
        return;
      } else {
        if (k === "ArrowUp" && n > 0) {
          _M0FP314vlmkit_2dsites4code4main7prevent(e);
          _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4code4main11pal__active, ((_M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4code4main11pal__active) + n | 0) - 1 | 0) % n | 0);
          _M0FP314vlmkit_2dsites4code4main18scroll__into__list(`#pal-opt-${_M0MPC13int3Int18to__string_2einner(_M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4code4main11pal__active), 10)}`);
          return;
        } else {
          if (k === "Enter" && n > 0) {
            _M0FP314vlmkit_2dsites4code4main7prevent(e);
            _M0FP314vlmkit_2dsites4code4main7pal__go(_M0MPC15array5Array2atGRP26mizchi7signals5OwnerE(items(), _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4code4main11pal__active)).href);
            return;
          } else {
            return;
          }
        }
      }
    })], []), _M0FP314vlmkit_2dsites4code4main2el("button", [_M0FP314vlmkit_2dsites4code4main3a__("type", "button"), _M0FP314vlmkit_2dsites4code4main3cls("btn btn-icon pal-close"), _M0FP314vlmkit_2dsites4code4main3a__("aria-label", "Close"), _M0FP314vlmkit_2dsites4code4main2on("click", (_e) => {
      _M0FP314vlmkit_2dsites4code4main12close__modal("palette");
    })], [_M0FP314vlmkit_2dsites4code4main4icon("x")])]), _M0FP314vlmkit_2dsites4code4main2el("p", [_M0FP314vlmkit_2dsites4code4main3cls("pal-section"), _M0FP314vlmkit_2dsites4code4main3a__("aria-hidden", "true")], [_M0FP314vlmkit_2dsites4code4main2td(() => _M0MP26mizchi7signals6Signal3getGsE(_M0FP314vlmkit_2dsites4code4main10pal__query) === "" ? "Jump to" : "Files and issues")]), _M0FP314vlmkit_2dsites4code4main2el("ul", [_M0FP314vlmkit_2dsites4code4main3a__("id", "palette-list"), _M0FP314vlmkit_2dsites4code4main3a__("role", "listbox"), _M0FP314vlmkit_2dsites4code4main3cls("pal-list"), _M0FP314vlmkit_2dsites4code4main3a__("aria-label", "Results")], [_M0FP36mizchi4luna3dom9for__eachGsE(() => items(), (it, i) => {
      const _tmp = [_M0FP314vlmkit_2dsites4code4main3a__("id", `pal-opt-${_M0MPC13int3Int18to__string_2einner(i, 10)}`), _M0FP314vlmkit_2dsites4code4main3a__("role", "option"), _M0FP314vlmkit_2dsites4code4main2ad("aria-selected", () => {
        const _p = _M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4code4main11pal__active) === i;
        return _p ? "true" : "false";
      }), _M0FP314vlmkit_2dsites4code4main2ad("class", () => `pal-opt${_M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4code4main11pal__active) === i ? " is-active" : ""}`), _M0FP314vlmkit_2dsites4code4main2on("click", (_e) => {
        _M0FP314vlmkit_2dsites4code4main7pal__go(it.href);
      }), _M0FP314vlmkit_2dsites4code4main2on("mousemove", (_e) => {
        if (_M0MP26mizchi7signals6Signal3getGiE(_M0FP314vlmkit_2dsites4code4main11pal__active) !== i) {
          _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4code4main11pal__active, i);
          return;
        } else {
          return;
        }
      })];
      const _bind = it.kind;
      let _tmp$2;
      switch (_bind) {
        case "file": {
          _tmp$2 = "file";
          break;
        }
        case "issue": {
          _tmp$2 = "issue";
          break;
        }
        default: {
          _tmp$2 = "up";
        }
      }
      return _M0FP314vlmkit_2dsites4code4main2el("li", _tmp, [_M0FP314vlmkit_2dsites4code4main4icon(_tmp$2), _M0FP314vlmkit_2dsites4code4main2el("span", [_M0FP314vlmkit_2dsites4code4main3cls("pal-label")], _M0FP314vlmkit_2dsites4code4main6bolded(it.label, it.hits)), _M0FP314vlmkit_2dsites4code4main2el("span", [_M0FP314vlmkit_2dsites4code4main3cls("pal-hint")], [_M0FP314vlmkit_2dsites4code4main1t(it.hint)])]);
    })]), _M0FP36mizchi4luna3dom4show(() => items().length === 0, () => _M0FP314vlmkit_2dsites4code4main2el("p", [_M0FP314vlmkit_2dsites4code4main3cls("pal-empty")], [_M0FP314vlmkit_2dsites4code4main2td(() => `Nothing matches “${_M0MP26mizchi7signals6Signal3getGsE(_M0FP314vlmkit_2dsites4code4main10pal__query)}”.`)])), _M0FP314vlmkit_2dsites4code4main2el("p", [_M0FP314vlmkit_2dsites4code4main3cls("pal-foot")], [_M0FP314vlmkit_2dsites4code4main2el("kbd", [], [_M0FP314vlmkit_2dsites4code4main1t("↑")]), _M0FP314vlmkit_2dsites4code4main2el("kbd", [], [_M0FP314vlmkit_2dsites4code4main1t("↓")]), _M0FP314vlmkit_2dsites4code4main1t(" to move, "), _M0FP314vlmkit_2dsites4code4main2el("kbd", [], [_M0FP314vlmkit_2dsites4code4main1t("Enter")]), _M0FP314vlmkit_2dsites4code4main1t(" to open, "), _M0FP314vlmkit_2dsites4code4main2el("kbd", [], [_M0FP314vlmkit_2dsites4code4main1t("Esc")]), _M0FP314vlmkit_2dsites4code4main1t(" to close")])]);
  }
  function _M0FP314vlmkit_2dsites4code4main14global__header() {
    const _tmp = [_M0FP314vlmkit_2dsites4code4main3cls("gh-inner")];
    const _tmp$2 = _M0FP314vlmkit_2dsites4code4main2el("a", [_M0FP314vlmkit_2dsites4code4main3a__("href", "#app"), _M0FP314vlmkit_2dsites4code4main3cls("skip"), _M0FP314vlmkit_2dsites4code4main2on("click", (e) => {
      _M0FP314vlmkit_2dsites4code4main7prevent(e);
      _M0FP314vlmkit_2dsites4code4main10focus__sel("#app");
    })], [_M0FP314vlmkit_2dsites4code4main1t("Skip to content")]);
    const _tmp$3 = _M0FP314vlmkit_2dsites4code4main2el("button", [_M0FP314vlmkit_2dsites4code4main3a__("type", "button"), _M0FP314vlmkit_2dsites4code4main3cls("gh-icon-btn gh-burger"), _M0FP314vlmkit_2dsites4code4main3a__("id", "btn-burger"), _M0FP314vlmkit_2dsites4code4main3a__("aria-label", "Open menu"), _M0FP314vlmkit_2dsites4code4main3a__("aria-controls", "mobile-nav"), _M0FP314vlmkit_2dsites4code4main2ad("aria-expanded", () => {
      const _p = _M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4code4main11mobile__nav);
      return _p ? "true" : "false";
    }), _M0FP314vlmkit_2dsites4code4main2on("click", (_e) => {
      _M0MP26mizchi7signals6Signal6updateGbE(_M0FP314vlmkit_2dsites4code4main11mobile__nav, (v) => !v);
    })], [_M0FP314vlmkit_2dsites4code4main4icon("menu")]);
    const _tmp$4 = _M0FP314vlmkit_2dsites4code4main2el("a", [_M0FP314vlmkit_2dsites4code4main3a__("href", "#/"), _M0FP314vlmkit_2dsites4code4main3cls("gh-logo"), _M0FP314vlmkit_2dsites4code4main3a__("aria-label", "Forgeyard home")], [_M0FP314vlmkit_2dsites4code4main10logo__mark(), _M0FP314vlmkit_2dsites4code4main2el("span", [_M0FP314vlmkit_2dsites4code4main3cls("gh-word"), _M0FP314vlmkit_2dsites4code4main3a__("aria-hidden", "true")], [_M0FP314vlmkit_2dsites4code4main1t("Forgeyard")])]);
    const _tmp$5 = [_M0FP314vlmkit_2dsites4code4main3a__("aria-label", "Global"), _M0FP314vlmkit_2dsites4code4main3cls("gh-nav")];
    const _tmp$6 = [_M0FP314vlmkit_2dsites4code4main3cls("gh-nav-list")];
    const _p = new Array(_M0FP314vlmkit_2dsites4code4main10nav__menus.length);
    const _p$2 = _M0FP314vlmkit_2dsites4code4main10nav__menus.length;
    let _tmp$7 = 0;
    while (true) {
      const _p$3 = _tmp$7;
      if (_p$3 < _p$2) {
        const _p$4 = _M0FP314vlmkit_2dsites4code4main10nav__menus[_p$3];
        _p[_p$3] = _M0FP314vlmkit_2dsites4code4main2el("li", [], [_M0FP314vlmkit_2dsites4code4main9nav__menu(_p$4._0, _p$4._1, "nav-")]);
        _tmp$7 = _p$3 + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    const _tmp$8 = _M0FP314vlmkit_2dsites4code4main2el("nav", _tmp$5, [_M0FP314vlmkit_2dsites4code4main2el("ul", _tmp$6, _M0IPC15array5ArrayPB3Add3addGRP36mizchi4luna3dom7DomNodeE(_p, [_M0FP314vlmkit_2dsites4code4main2el("li", [], [_M0FP314vlmkit_2dsites4code4main2el("a", [_M0FP314vlmkit_2dsites4code4main3a__("href", "#/"), _M0FP314vlmkit_2dsites4code4main3cls("gh-nav-btn")], [_M0FP314vlmkit_2dsites4code4main1t("Pricing")])])]))]);
    const _tmp$9 = _M0FP314vlmkit_2dsites4code4main2el("div", [_M0FP314vlmkit_2dsites4code4main3cls("gh-right")], [_M0FP314vlmkit_2dsites4code4main2el("button", [_M0FP314vlmkit_2dsites4code4main3a__("type", "button"), _M0FP314vlmkit_2dsites4code4main3cls("gh-search"), _M0FP314vlmkit_2dsites4code4main3a__("id", "btn-search"), _M0FP314vlmkit_2dsites4code4main3a__("aria-haspopup", "dialog"), _M0FP314vlmkit_2dsites4code4main2on("click", (_e) => {
      _M0FP314vlmkit_2dsites4code4main13open__palette();
    })], [_M0FP314vlmkit_2dsites4code4main4icon("search"), _M0FP314vlmkit_2dsites4code4main2el("span", [_M0FP314vlmkit_2dsites4code4main3cls("gh-search-text")], [_M0FP314vlmkit_2dsites4code4main1t("Search or jump to…")]), _M0FP314vlmkit_2dsites4code4main2el("kbd", [_M0FP314vlmkit_2dsites4code4main3cls("gh-kbd"), _M0FP314vlmkit_2dsites4code4main3a__("aria-label", "shortcut: slash")], [_M0FP314vlmkit_2dsites4code4main1t("/")])]), _M0FP314vlmkit_2dsites4code4main2el("button", [_M0FP314vlmkit_2dsites4code4main3a__("type", "button"), _M0FP314vlmkit_2dsites4code4main3cls("gh-icon-btn gh-search-icon"), _M0FP314vlmkit_2dsites4code4main3a__("aria-label", "Search or jump to"), _M0FP314vlmkit_2dsites4code4main3a__("aria-haspopup", "dialog"), _M0FP314vlmkit_2dsites4code4main2on("click", (_e) => {
      _M0FP314vlmkit_2dsites4code4main13open__palette();
    })], [_M0FP314vlmkit_2dsites4code4main4icon("search")]), _M0FP314vlmkit_2dsites4code4main2el("a", [_M0FP314vlmkit_2dsites4code4main3a__("href", "#/"), _M0FP314vlmkit_2dsites4code4main3cls("gh-signin")], [_M0FP314vlmkit_2dsites4code4main1t("Sign in")]), _M0FP314vlmkit_2dsites4code4main2el("a", [_M0FP314vlmkit_2dsites4code4main3a__("href", "#/"), _M0FP314vlmkit_2dsites4code4main3cls("gh-icon-btn gh-signin-icon"), _M0FP314vlmkit_2dsites4code4main3a__("aria-label", "Sign in")], [_M0FP314vlmkit_2dsites4code4main4icon("person")]), _M0FP314vlmkit_2dsites4code4main2el("a", [_M0FP314vlmkit_2dsites4code4main3a__("href", "#/"), _M0FP314vlmkit_2dsites4code4main3cls("gh-signup")], [_M0FP314vlmkit_2dsites4code4main1t("Sign up")])]);
    const _tmp$10 = [_M0FP314vlmkit_2dsites4code4main3a__("id", "mobile-nav"), _M0FP314vlmkit_2dsites4code4main2ad("class", () => `mobile-nav${_M0MP26mizchi7signals6Signal3getGbE(_M0FP314vlmkit_2dsites4code4main11mobile__nav) ? " is-open" : ""}`)];
    const _tmp$11 = [_M0FP314vlmkit_2dsites4code4main3a__("aria-label", "Global, small screens")];
    const _tmp$12 = [_M0FP314vlmkit_2dsites4code4main3cls("mobile-nav-list")];
    const _p$3 = new Array(_M0FP314vlmkit_2dsites4code4main10nav__menus.length);
    const _p$4 = _M0FP314vlmkit_2dsites4code4main10nav__menus.length;
    let _tmp$13 = 0;
    while (true) {
      const _p$5 = _tmp$13;
      if (_p$5 < _p$4) {
        const _p$6 = _M0FP314vlmkit_2dsites4code4main10nav__menus[_p$5];
        _p$3[_p$5] = _M0FP314vlmkit_2dsites4code4main2el("li", [], [_M0FP314vlmkit_2dsites4code4main9nav__menu(_p$6._0, _p$6._1, "mnav-")]);
        _tmp$13 = _p$5 + 1 | 0;
        continue;
      } else {
        break;
      }
    }
    return _M0FP314vlmkit_2dsites4code4main2el("div", _tmp, [_tmp$2, _tmp$3, _tmp$4, _tmp$8, _tmp$9, _M0FP314vlmkit_2dsites4code4main2el("div", _tmp$10, [_M0FP314vlmkit_2dsites4code4main2el("nav", _tmp$11, [_M0FP314vlmkit_2dsites4code4main2el("ul", _tmp$12, _M0IPC15array5ArrayPB3Add3addGRP36mizchi4luna3dom7DomNodeE(_p$3, [_M0FP314vlmkit_2dsites4code4main2el("li", [], [_M0FP314vlmkit_2dsites4code4main2el("a", [_M0FP314vlmkit_2dsites4code4main3a__("href", "#/"), _M0FP314vlmkit_2dsites4code4main3cls("gh-nav-btn")], [_M0FP314vlmkit_2dsites4code4main1t("Pricing")])]), _M0FP314vlmkit_2dsites4code4main2el("li", [], [_M0FP314vlmkit_2dsites4code4main2el("a", [_M0FP314vlmkit_2dsites4code4main3a__("href", "#/"), _M0FP314vlmkit_2dsites4code4main3cls("gh-signup mobile-signup")], [_M0FP314vlmkit_2dsites4code4main1t("Sign up")])])]))])]), _M0FP314vlmkit_2dsites4code4main7palette()]);
  }
  function _M0FP314vlmkit_2dsites4code4main11apply__hash() {
    const h = _M0FP314vlmkit_2dsites4code4main9get__hash();
    let r;
    let from;
    let to;
    _L: {
      if (_M0MPC16string6String11has__prefix(h, _M0FP314vlmkit_2dsites4code4main11apply__hashN6recordS3378)) {
        const rest = _M0MPC16string6String17substring_2einner(h, 6, undefined);
        const _bind = _M0MPC16string6String4find(rest, _M0FP314vlmkit_2dsites4code4main11apply__hashN6recordS3379);
        if (_bind === undefined) {
          r = `blob:${rest}`;
          from = 0;
          to = 0;
          break _L;
        } else {
          const _Some = _bind;
          const _at = _Some;
          const lines = _M0MPC16string6String17substring_2einner(rest, _at + 2 | 0, undefined);
          const a = _M0FP314vlmkit_2dsites4code4main10parse__int(lines);
          const _bind$2 = _M0MPC16string6String4find(lines, _M0FP314vlmkit_2dsites4code4main11apply__hashN6recordS3380);
          let b;
          if (_bind$2 === undefined) {
            b = a;
          } else {
            const _Some$2 = _bind$2;
            const _k = _Some$2;
            b = _M0FP314vlmkit_2dsites4code4main10parse__int(_M0MPC16string6String17substring_2einner(lines, _k + 2 | 0, undefined));
          }
          r = `blob:${_M0MPC16string6String17substring_2einner(rest, 0, _at)}`;
          from = a;
          to = b < a ? a : b;
          break _L;
        }
      } else {
        if (_M0MPC16string6String11has__prefix(h, _M0FP314vlmkit_2dsites4code4main11apply__hashN6recordS3381)) {
          r = `home:${_M0MPC16string6String17substring_2einner(h, 6, undefined)}`;
          from = 0;
          to = 0;
          break _L;
        } else {
          if (h === "/issues/new") {
            r = "new";
            from = 0;
            to = 0;
            break _L;
          } else {
            if (_M0MPC16string6String11has__prefix(h, _M0FP314vlmkit_2dsites4code4main11apply__hashN6recordS3382)) {
              r = `issue:${_M0MPC13int3Int18to__string_2einner(_M0FP314vlmkit_2dsites4code4main10parse__int(_M0MPC16string6String17substring_2einner(h, 8, undefined)), 10)}`;
              from = 0;
              to = 0;
              break _L;
            } else {
              if (h === "/issues") {
                r = "issues";
                from = 0;
                to = 0;
                break _L;
              } else {
                if (h === "/pulls") {
                  r = "pulls";
                  from = 0;
                  to = 0;
                  break _L;
                } else {
                  if (h === "/actions" || (h === "/security" || h === "/insights")) {
                    r = `tab:${_M0MPC16string6String17substring_2einner(h, 1, undefined)}`;
                    from = 0;
                    to = 0;
                    break _L;
                  } else {
                    r = "home:";
                    from = 0;
                    to = 0;
                    break _L;
                  }
                }
              }
            }
          }
        }
      }
    }
    const _p = _M0MP26mizchi7signals6Signal3getGsE(_M0FP314vlmkit_2dsites4code4main5route);
    const changed = !(r === _p);
    _M0FP26mizchi7signals5batchGuE(() => {
      _M0MP26mizchi7signals6Signal3setGsE(_M0FP314vlmkit_2dsites4code4main5route, r);
      _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4code4main9sel__from, from);
      _M0MP26mizchi7signals6Signal3setGiE(_M0FP314vlmkit_2dsites4code4main7sel__to, to);
      _M0MP26mizchi7signals6Signal3setGsE(_M0FP314vlmkit_2dsites4code4main10open__menu, "");
      _M0MP26mizchi7signals6Signal3setGbE(_M0FP314vlmkit_2dsites4code4main11mobile__nav, false);
    });
    if (changed) {
      _M0FP314vlmkit_2dsites4code4main11scroll__top();
    }
    if (from > 0) {
      _M0FP314vlmkit_2dsites4code4main5later(0, () => {
        _M0FP314vlmkit_2dsites4code4main10scroll__to(`#L${_M0MPC13int3Int18to__string_2einner(from, 10)}`);
      });
      return;
    } else {
      return;
    }
  }
  (() => {
    const theme = _M0FP314vlmkit_2dsites4code4main13search__param("theme");
    if (theme === "dark" || theme === "light") {
      _M0FP314vlmkit_2dsites4code4main15set__root__attr("data-theme", theme);
    }
    _M0FP314vlmkit_2dsites4code4main11apply__hash();
    _M0FP314vlmkit_2dsites4code4main10on__window("hashchange", (_e) => {
      _M0FP314vlmkit_2dsites4code4main11apply__hash();
    });
    _M0FP314vlmkit_2dsites4code4main7on__doc("click", (e) => {
      const k = _M0MP26mizchi7signals6Signal3getGsE(_M0FP314vlmkit_2dsites4code4main10open__menu);
      let _tmp;
      const _p = "";
      if (!(k === _p)) {
        _tmp = !_M0FP314vlmkit_2dsites4code4main7closest(e, `[data-pop=\"${k}\"]`);
      } else {
        _tmp = false;
      }
      if (_tmp) {
        _M0MP26mizchi7signals6Signal3setGsE(_M0FP314vlmkit_2dsites4code4main10open__menu, "");
        return;
      } else {
        return;
      }
    });
    _M0FP314vlmkit_2dsites4code4main7on__doc("keydown", (e) => {
      const key = _M0FP314vlmkit_2dsites4code4main7ev__key(e);
      let _tmp;
      if (key === "Escape") {
        let _tmp$2;
        const _p = _M0MP26mizchi7signals6Signal3getGsE(_M0FP314vlmkit_2dsites4code4main10open__menu);
        const _p$2 = "";
        if (!(_p === _p$2)) {
          _tmp$2 = !_M0FP314vlmkit_2dsites4code4main17any__dialog__open();
        } else {
          _tmp$2 = false;
        }
        _tmp = _tmp$2;
      } else {
        _tmp = false;
      }
      if (_tmp) {
        _M0FP314vlmkit_2dsites4code4main7prevent(e);
        _M0FP314vlmkit_2dsites4code4main18close__menu__focus();
        return;
      } else {
        if (key === "/" && (!_M0FP314vlmkit_2dsites4code4main16editable__target(e) && (!_M0FP314vlmkit_2dsites4code4main7ev__mod(e) && !_M0FP314vlmkit_2dsites4code4main17any__dialog__open()))) {
          _M0FP314vlmkit_2dsites4code4main7prevent(e);
          _M0FP314vlmkit_2dsites4code4main13open__palette();
          return;
        } else {
          return;
        }
      }
    });
    const _bind = _M0MP36mizchi11js__browser3dom8Document14getElementById(_M0FP36mizchi11js__browser3dom8document(), "site-header");
    if (_bind.$tag === 1) {
      const _Some = _bind;
      const _h = _Some._0;
      _M0FP36mizchi4luna3dom10render__to(_h, _M0FP314vlmkit_2dsites4code4main14global__header());
    }
    const _bind$2 = _M0MP36mizchi11js__browser3dom8Document14getElementById(_M0FP36mizchi11js__browser3dom8document(), "app");
    if (_bind$2.$tag === 1) {
      const _Some = _bind$2;
      const _m = _Some._0;
      _M0FP36mizchi4luna3dom10render__to(_m, _M0FP314vlmkit_2dsites4code4main9app__main());
      return;
    } else {
      return;
    }
  })();
})();
