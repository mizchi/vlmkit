// Lexipedia: one article, "Moon", with a contents rail, previews and appearance settings.

// ---------------------------------------------------------------------------------------------
// Small helpers over luna's DOM builder

///|
fn h(
  tag : String,
  attrs : Array[(String, @element.AttrValue)],
  children : Array[@element.DomNode],
) -> @element.DomNode {
  @element.create_element(tag, attrs, children)
}

///|
fn dy(name : String, f : () -> String) -> (String, @element.AttrValue) {
  (name, @element.AttrValue::Dynamic(f))
}

///|
fn on(name : String, f : (@js.Any) -> Unit) -> (String, @element.AttrValue) {
  (name, @element.AttrValue::Handler(f))
}

///|
fn ref_to(cell : Ref[@js.Any?]) -> (String, @element.AttrValue) {
  ("__ref", @element.AttrValue::Handler(fn(el) { cell.val = Some(el) }))
}

///|
fn tx(s : String) -> @element.DomNode {
  @element.text(s)
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
fn cls_if(base : String, extra : String, cond : Bool) -> String {
  if cond {
    base + " " + extra
  } else {
    base
  }
}

///|
fn lower(s : String) -> String {
  let sb = StringBuilder()
  for c in s {
    if c >= 'A' && c <= 'Z' {
      sb.write_char(Int::unsafe_to_char(c.to_int() + 32))
    } else {
      sb.write_char(c)
    }
  }
  sb.to_string()
}

///|
fn replace_char(s : String, from : Char, to : Char) -> String {
  let sb = StringBuilder()
  for c in s {
    sb.write_char(if c == from { to } else { c })
  }
  sb.to_string()
}

///|
fn starts_with(s : String, p : String) -> Bool {
  let a = s.to_array()
  let b = p.to_array()
  if b.length() > a.length() {
    return false
  }
  for i = 0; i < b.length(); i = i + 1 {
    if a[i] != b[i] {
      return false
    }
  }
  true
}

///|
fn drop_chars(s : String, n : Int) -> String {
  let cs = s.to_array()
  let sb = StringBuilder()
  for i = n; i < cs.length(); i = i + 1 {
    sb.write_char(cs[i])
  }
  sb.to_string()
}

///|
fn wiki_href(t : String) -> String {
  "#/wiki/" + encode_uri(replace_char(t, ' ', '_'))
}

// ---------------------------------------------------------------------------------------------
// State

///|
#derive(Eq)
enum Route {
  Article
  Talk
  Source
  History
  Stub(String)
  Search(String)
}

///|
#derive(Eq)
enum PKind {
  PPage(String)
  PRef(Int)
}

///|
struct Preview {
  kind : PKind
  x : Double
  y : Double
  above : Bool // opens upwards from y (the link is near the bottom of the screen)
}

///|
let route : @signals.Signal[Route] = @resource.signal(Route::Article)

///|
let text_size : @signals.Signal[String] = @resource.signal("standard")

///|
let width_pref : @signals.Signal[String] = @resource.signal("standard")

///|
let color_pref : @signals.Signal[String] = @resource.signal("auto")

///|
let toc_hidden : @signals.Signal[Bool] = @resource.signal(false)

///|
let appearance_hidden : @signals.Signal[Bool] = @resource.signal(false)

///|
let is_phone : @signals.Signal[Bool] = @resource.signal(false)

///|
let active_id : @signals.Signal[String] = @resource.signal("top")

///|
let watched : @signals.Signal[Bool] = @resource.signal(false)

///|
let toast_msg : @signals.Signal[String] = @resource.signal("")

///|
let toast_timer : Ref[Int] = { val: -1 }

///|
let visited : @signals.Signal[Array[String]] = @resource.signal([])

///|
let preview : @signals.Signal[Preview?] = @resource.signal(None)

///|
let show_timer : Ref[Int] = { val: -1 }

///|
let hide_timer : Ref[Int] = { val: -1 }

///|
let touch_recent : Ref[Bool] = { val: false }

///|
let menu_open : @signals.Signal[Bool] = @resource.signal(false)

///|
let toc_pop_open : @signals.Signal[Bool] = @resource.signal(false)

///|
let app_menu_open : @signals.Signal[Bool] = @resource.signal(false)

///|
let phone_search_open : @signals.Signal[Bool] = @resource.signal(false)

///|
let search_q : @signals.Signal[String] = @resource.signal("")

///|
let search_expanded : @signals.Signal[Bool] = @resource.signal(false)

///|
let search_active : @signals.Signal[Int] = @resource.signal(-1)

///|
/// The empty field was opened with ArrowDown: suggest the seeded titles.
let search_browse : @signals.Signal[Bool] = @resource.signal(false)

///|
let search_input : Ref[@js.Any?] = { val: None }

///|
let lang_query : @signals.Signal[String] = @resource.signal("")

///|
let lang_dialog : Ref[@js.Any?] = { val: None }

///|
let lang_input : Ref[@js.Any?] = { val: None }

///|
let media_index : @signals.Signal[Int] = @resource.signal(0)

///|
let media_dialog : Ref[@js.Any?] = { val: None }

///|
let media_open : @signals.Signal[Bool] = @resource.signal(false)

///|
let lang_open : @signals.Signal[Bool] = @resource.signal(false)

///|
/// Per article section: 0 follows the scroll spy (open while you read inside it),
/// 1 opened by the reader, 2 closed by the reader.
let toc_open : Array[@signals.Signal[Int]] = []

///|
fn toc_expanded(i : Int) -> Bool {
  match toc_open[i].get() {
    1 => true
    2 => false
    _ => section_holds_active(i)
  }
}

///|
/// Per article section, then See also / References / External links: open on phones.
let acc_open : Array[@signals.Signal[Bool]] = []

///|
/// Back-matter section ids, after the article's own sections.
let back_ids : Array[String] = ["See_also", "References", "External_links"]

///|
let back_titles : Array[String] = ["See also", "References", "External links"]

///|
/// The section index in which reference n is first cited (-1: the lead).
let cite_section : Map[Int, Int] = Map([])

///|
/// How many times each reference has been rendered in the current article render.
let cite_count : Map[Int, Int] = Map([])

// ---------------------------------------------------------------------------------------------
// Storage and appearance

///|
fn store(key : String, v : String) -> Unit {
  storage_set("lexipedia:" + key, v)
}

///|
fn load(key : String, allowed : Array[String], fallback : String) -> String {
  let v = storage_get("lexipedia:" + key)
  if allowed.contains(v) {
    v
  } else {
    fallback
  }
}

///|
fn toast(msg : String) -> Unit {
  if toast_timer.val >= 0 {
    clear_timeout(toast_timer.val)
  }
  toast_msg.set(msg)
  toast_timer.val = set_timeout(fn() { toast_msg.set("") }, 4000)
}

// ---------------------------------------------------------------------------------------------
// Page previews

///|
fn cancel_show() -> Unit {
  if show_timer.val >= 0 {
    clear_timeout(show_timer.val)
    show_timer.val = -1
  }
}

///|
fn cancel_hide() -> Unit {
  if hide_timer.val >= 0 {
    clear_timeout(hide_timer.val)
    hide_timer.val = -1
  }
}

///|
fn hide_now() -> Unit {
  cancel_show()
  cancel_hide()
  preview.set(None)
}

///|
fn hide_soon() -> Unit {
  cancel_show()
  cancel_hide()
  hide_timer.val = set_timeout(fn() { preview.set(None) }, 300)
}

///|
fn open_preview(kind : PKind, el : @js.Any) -> Unit {
  let r = page_rect(el)
  let vw = viewport_width()
  let card_w = if vw - 32.0 < 320.0 { vw - 32.0 } else { 320.0 }
  let mut x = r[0]
  if x + card_w > vw - 16.0 {
    x = vw - 16.0 - card_w
  }
  if x < 16.0 {
    x = 16.0
  }
  // a card is at most ~230px tall; with less room than that under the link, open it above
  let above = r[4] + 240.0 > viewport_height() && r[4] > 260.0
  let y = if above { r[1] - 6.0 } else { r[2] + 6.0 }
  preview.set(Some({ kind, x, y, above }))
}

///|
fn hover_start(kind : PKind, el : @js.Any) -> Unit {
  if touch_recent.val {
    return
  }
  cancel_hide()
  cancel_show()
  match preview.get() {
    Some(p) => if p.kind == kind { return }
    None => ()
  }
  show_timer.val = set_timeout(fn() { open_preview(kind, el) }, 500)
}

///|
fn focus_start(kind : PKind, el : @js.Any) -> Unit {
  if touch_recent.val {
    return
  }
  cancel_hide()
  cancel_show()
  open_preview(kind, el)
}

///|
fn preview_handlers(kind : PKind) -> Array[(String, @element.AttrValue)] {
  [
    on("mouseenter", fn(e) { hover_start(kind, ev_current(e)) }),
    on("mouseleave", fn(_e) { hide_soon() }),
    on("focus", fn(e) { focus_start(kind, ev_current(e)) }),
    on("blur", fn(_e) { hide_soon() }),
    on("click", fn(_e) { hide_now() }),
  ]
}

///|
fn wiki_link(target : String, label : String) -> @element.DomNode {
  let attrs = [
    ("href", @element.AttrValue::Static(wiki_href(target))),
    dy("class", fn() { cls_if("wl", "visited", visited.get().contains(target)) }),
  ]
  for x in preview_handlers(PKind::PPage(target)) {
    attrs.push(x)
  }
  h("a", attrs, [tx(label)])
}

///|
fn cite(n : Int) -> @element.DomNode {
  let k = cite_count.get(n).unwrap_or(0)
  cite_count[n] = k + 1
  let id = if k == 0 { "cite_ref-\{n}" } else { "cite_ref-\{n}-\{k + 1}" }
  let attrs = [
    a("href", "#cite_note-\{n}"),
    a("aria-label", "Reference \{n}"),
  ]
  for x in preview_handlers(PKind::PRef(n)) {
    attrs.push(x)
  }
  // U+2060 WORD JOINER keeps the superscript on the line of the word it follows
  @element.fragment([
    tx("\u{2060}"),
    h("sup", [a("id", id), a("class", "ref")], [h("a", attrs, [tx("[\{n}]")])]),
  ])
}

// ---------------------------------------------------------------------------------------------
// Inline markup

///|
fn find_from(cs : Array[Char], i : Int, x : Char, y : Char) -> Int {
  let mut j = i
  while j + 1 < cs.length() {
    if cs[j] == x && cs[j + 1] == y {
      return j
    }
    j = j + 1
  }
  -1
}

///|
fn slice(cs : Array[Char], from : Int, to : Int) -> String {
  let sb = StringBuilder()
  for i = from; i < to; i = i + 1 {
    sb.write_char(cs[i])
  }
  sb.to_string()
}

///|
fn inline_nodes(src : String) -> Array[@element.DomNode] {
  let cs = src.to_array()
  let out : Array[@element.DomNode] = []
  let buf = StringBuilder()
  let flush = fn() {
    let s = buf.to_string()
    if s != "" {
      out.push(tx(s))
      buf.reset()
    }
  }
  let n = cs.length()
  let mut i = 0
  while i < n {
    let c = cs[i]
    let next = if i + 1 < n { cs[i + 1] } else { ' ' }
    if c == '[' && next == '[' {
      let end = find_from(cs, i + 2, ']', ']')
      let body = slice(cs, i + 2, end)
      flush()
      let parts = body.to_array()
      let mut bar = -1
      for k = 0; k < parts.length(); k = k + 1 {
        if parts[k] == '|' && bar < 0 {
          bar = k
        }
      }
      if bar < 0 {
        out.push(wiki_link(body, body))
      } else {
        out.push(
          wiki_link(slice(parts, 0, bar), slice(parts, bar + 1, parts.length())),
        )
      }
      i = end + 2
    } else if c == '{' {
      let mut j = i + 1
      let mut num = 0
      while j < n && cs[j] != '}' {
        num = num * 10 + (cs[j].to_int() - '0'.to_int())
        j = j + 1
      }
      flush()
      out.push(cite(num))
      i = j + 1
    } else if (c == '*' && next == '*') || (c == '/' && next == '/') {
      let end = find_from(cs, i + 2, c, c)
      flush()
      let inner = slice(cs, i + 2, end)
      if c == '*' {
        out.push(h("b", [], inline_nodes(inner)))
      } else {
        out.push(h("i", [], inline_nodes(inner)))
      }
      i = end + 2
    } else {
      buf.write_char(c)
      i = i + 1
    }
  }
  flush()
  out
}

///|
fn para(src : String) -> @element.DomNode {
  h("p", [], inline_nodes(src))
}

///|
fn scan_cites(src : String, sec : Int) -> Unit {
  let cs = src.to_array()
  for i = 0; i < cs.length(); i = i + 1 {
    if cs[i] == '{' {
      let mut j = i + 1
      let mut num = 0
      while j < cs.length() && cs[j] != '}' {
        num = num * 10 + (cs[j].to_int() - '0'.to_int())
        j = j + 1
      }
      if cite_section.get(num) is None {
        cite_section[num] = sec
      }
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Routing

///|
/// Which accordion section holds the element with this id (-1: none, it is always shown).
fn section_of(id : String) -> Int {
  for i, s in sections {
    if s.id == id {
      return i
    }
    for sub in s.subs {
      if sub.id == id {
        return i
      }
    }
  }
  for k, b in back_ids {
    if b == id {
      return sections.length() + k
    }
  }
  if starts_with(id, "cite_note-") {
    return sections.length() + 1
  }
  if starts_with(id, "cite_ref-") {
    let cs = drop_chars(id, 9).to_array()
    let mut num = 0
    for c in cs {
      if c == '-' {
        break
      }
      num = num * 10 + (c.to_int() - '0'.to_int())
    }
    return cite_section.get(num).unwrap_or(-1)
  }
  -1
}

///|
fn parse_route(h : String) -> Route {
  if starts_with(h, "#/wiki/") {
    let t = replace_char(decode_uri(drop_chars(h, 7)), '_', ' ')
    if t == "Moon" {
      Route::Article
    } else {
      Route::Stub(t)
    }
  } else if starts_with(h, "#/search/") {
    Route::Search(decode_uri(drop_chars(h, 9)))
  } else if h == "#/talk" {
    Route::Talk
  } else if h == "#/source" {
    Route::Source
  } else if h == "#/history" {
    Route::History
  } else {
    Route::Article
  }
}

///|
fn sync_route() -> Unit {
  let h = get_hash()
  hide_now()
  menu_open.set(false)
  toc_pop_open.set(false)
  app_menu_open.set(false)
  search_expanded.set(false)
  if starts_with(h, "#/") {
    let r = parse_route(h)
    route.set(r)
    match r {
      Route::Stub(t) =>
        if !visited.get().contains(t) {
          visited.update(fn(v) {
            let c = v.copy()
            c.push(t)
            c
          })
        }
      _ => ()
    }
    scroll_to_top()
    set_doc_title(
      match r {
        Route::Article => "Moon – Lexipedia"
        Route::Talk => "Talk:Moon – Lexipedia"
        Route::Source => "View source for Moon – Lexipedia"
        Route::History => "Moon: Revision history – Lexipedia"
        Route::Stub(t) => t + " – Lexipedia"
        Route::Search(q) => "Search results for " + q + " – Lexipedia"
      },
    )
  } else {
    route.set(Route::Article)
    set_doc_title("Moon – Lexipedia")
    if h.length() > 1 {
      let id = decode_uri(drop_chars(h, 1))
      let s = section_of(id)
      if s >= 0 && s < acc_open.length() {
        acc_open[s].set(true)
      }
      let _ = set_timeout(fn() { scroll_to_id(id) }, 0)
    }
  }
}

///|
fn go(h : String) -> Unit {
  if get_hash() == h {
    sync_route()
  } else {
    set_hash(h)
  }
}

// ---------------------------------------------------------------------------------------------
// Search combobox

///|
fn search_matches(q : String) -> Array[Title] {
  let lq = lower(q)
  if lq == "" {
    return []
  }
  let first : Array[Title] = []
  let rest : Array[Title] = []
  for t in titles {
    let lt = lower(t.title)
    if starts_with(lt, lq) {
      first.push(t)
    } else if lt.contains(lq) || lower(t.desc).contains(lq) {
      rest.push(t)
    }
  }
  for t in rest {
    first.push(t)
  }
  first
}

///|
fn clear_search() -> Unit {
  search_q.set("")
  search_browse.set(false)
  search_active.set(-1)
  search_expanded.set(false)
  match search_input.val {
    Some(el) => set_value(el, "")
    None => ()
  }
}

///|
fn open_title(t : String) -> Unit {
  clear_search()
  phone_search_open.set(false)
  go(wiki_href(t))
}

///|
fn submit_search() -> Unit {
  let q = search_q.get()
  let ms = if q == "" && search_browse.get() { titles } else { search_matches(q) }
  let act = search_active.get()
  let shown = if ms.length() > 8 { 8 } else { ms.length() }
  if act >= 0 && act < shown {
    open_title(ms[act].title)
    return
  }
  for t in titles {
    if lower(t.title) == lower(q) {
      open_title(t.title)
      return
    }
  }
  clear_search()
  phone_search_open.set(false)
  go("#/search/" + encode_uri(q))
}

///|
fn search_box() -> @element.DomNode {
  let visible = @resource.memo(fn() {
    let q = search_q.get()
    let ms = if q == "" && search_browse.get() { titles } else { search_matches(q) }
    if ms.length() > 8 {
      ms[0:8].to_owned()
    } else {
      ms
    }
  })
  h(
    "form",
    [
      dy("class", fn() { cls_if("search", "open", phone_search_open.get()) }),
      a("role", "search"),
      on("submit", fn(e) {
        prevent(e)
        submit_search()
      }),
    ],
    [
      h("div", [a("class", "search-field")], [
        h(
          "label",
          [
            a("for", "search-input"),
            dy("class", fn() { cls_if("search-label", "filled", search_q.get() != "") }),
          ],
          [tx("Search Lexipedia")],
        ),
        icon_search("search-icon"),
        h(
          "input",
          [
            a("id", "search-input"),
            a("type", "search"),
            a("role", "combobox"),
            a("autocomplete", "off"),
            a("aria-autocomplete", "list"),
            a("aria-controls", "search-listbox"),
            dy("aria-expanded", fn() {
              bool_s(search_expanded.get() && visible().length() > 0)
            }),
            dy("aria-activedescendant", fn() {
              let i = search_active.get()
              if i >= 0 && search_expanded.get() {
                "sugg-\{i}"
              } else {
                ""
              }
            }),
            ref_to(search_input),
            on("input", fn(e) {
              search_q.set(ev_value(e))
              search_active.set(-1)
              search_expanded.set(true)
            }),
            on("focus", fn(_e) { search_expanded.set(true) }),
            on("blur", fn(_e) {
              let _ = set_timeout(
                fn() {
                  search_expanded.set(false)
                  search_browse.set(false)
                },
                150,
              )
            }),
            on("keydown", fn(e) {
              let k = ev_key(e)
              let n = visible().length()
              if k == "ArrowDown" && n == 0 && search_q.get() == "" {
                prevent(e)
                search_browse.set(true)
                search_expanded.set(true)
                search_active.set(0)
              } else if k == "ArrowDown" && n > 0 {
                prevent(e)
                search_expanded.set(true)
                search_active.set((search_active.get() + 1) % n)
              } else if k == "ArrowUp" && n > 0 {
                prevent(e)
                let i = search_active.get()
                search_active.set(if i <= 0 { n - 1 } else { i - 1 })
              } else if k == "Escape" {
                if search_expanded.get() && n > 0 {
                  search_expanded.set(false)
                  search_active.set(-1)
                } else {
                  clear_search()
                }
              }
            }),
          ],
          [],
        ),
        h(
          "ul",
          [
            a("id", "search-listbox"),
            a("role", "listbox"),
            a("aria-label", "Search suggestions"),
            dy("class", fn() {
              cls_if(
                "suggestions",
                "open",
                search_expanded.get() && visible().length() > 0,
              )
            }),
          ],
          [
            @element.for_each(fn() { visible() }, fn(t, i) {
              h(
                "li",
                [
                  a("id", "sugg-\{i}"),
                  a("role", "option"),
                  dy("aria-selected", fn() { bool_s(search_active.get() == i) }),
                  dy("class", fn() {
                    cls_if("sugg", "active", search_active.get() == i)
                  }),
                  on("mousedown", fn(e) { prevent(e) }),
                  on("click", fn(_e) { open_title(t.title) }),
                ],
                [
                  thumb_art(t.thumb, "s\{i}"),
                  h("span", [a("class", "sugg-text")], [
                    h("span", [a("class", "sugg-title")], [tx(t.title)]),
                    h("span", [a("class", "sugg-desc")], [tx(t.desc)]),
                  ]),
                ],
              )
            }),
          ],
        ),
      ]),
      h("button", [a("type", "submit"), a("class", "btn search-btn")], [
        tx("Search"),
      ]),
    ],
  )
}

// ---------------------------------------------------------------------------------------------
// Icons

///|
fn icon(cls : String, d : String) -> @element.DomNode {
  sv(
    "svg",
    [
      a("viewBox", "0 0 20 20"),
      a("class", "icon " + cls),
      a("aria-hidden", "true"),
      a("focusable", "false"),
    ],
    [
      sv(
        "path",
        [
          a("d", d),
          a("fill", "none"),
          a("stroke", "currentColor"),
          a("stroke-width", "1.8"),
          a("stroke-linecap", "round"),
          a("stroke-linejoin", "round"),
        ],
        [],
      ),
    ],
  )
}

///|
fn icon_search(cls : String) -> @element.DomNode {
  icon(cls, "M8.5 3.5a5 5 0 1 0 0 10a5 5 0 1 0 0-10M12.2 12.2L16.5 16.5")
}

///|
fn icon_menu() -> @element.DomNode {
  icon("", "M3 5.5h14M3 10h14M3 14.5h14")
}

///|
fn icon_chevron(cls : String) -> @element.DomNode {
  icon(cls, "M7 5l5 5l-5 5")
}

///|
fn icon_down() -> @element.DomNode {
  icon("chev-down", "M5.5 8l4.5 4.5L14.5 8")
}

///|
fn icon_lang() -> @element.DomNode {
  icon(
    "",
    "M2.5 4.5h8M6.5 3v1.5M4 4.5c.6 3 2.6 5 5 6M9 4.5c-.6 3-2.6 5.4-5.5 6.5M10 17l3.5-8l3.5 8M11.2 14.2h4.6",
  )
}

///|
fn icon_toc() -> @element.DomNode {
  icon("", "M3 5h2M8 5h9M3 10h2M8 10h9M3 15h2M8 15h9")
}

///|
fn icon_close() -> @element.DomNode {
  icon("", "M5 5l10 10M15 5L5 15")
}

///|
fn icon_star() -> @element.DomNode {
  sv(
    "svg",
    [
      a("viewBox", "0 0 20 20"),
      a("class", "icon star"),
      a("aria-hidden", "true"),
      a("focusable", "false"),
    ],
    [
      sv(
        "path",
        [
          a("d", "M10 2.8l2.2 4.6l5 .7l-3.6 3.5l.9 5L10 14.2l-4.5 2.4l.9-5L2.8 8.1l5-.7z"),
          a("stroke", "currentColor"),
          a("stroke-width", "1.5"),
          a("stroke-linejoin", "round"),
        ],
        [],
      ),
    ],
  )
}

///|
fn icon_brush() -> @element.DomNode {
  icon("", "M10 3a7 7 0 1 0 0 14c1 0 1.5-.8 1-1.6c-.6-1 0-2.4 1.4-2.4H14a3 3 0 0 0 3-3c0-3.9-3.1-7-7-7M6.5 9.5h.01M9 6.5h.01M12.5 7h.01")
}

///|
fn logo() -> @element.DomNode {
  sv(
    "svg",
    [
      a("viewBox", "0 0 40 40"),
      a("class", "logo"),
      a("aria-hidden", "true"),
      a("focusable", "false"),
    ],
    [
      sv(
        "circle",
        [
          a("cx", "20"),
          a("cy", "20"),
          a("r", "17"),
          a("fill", "none"),
          a("stroke", "currentColor"),
          a("stroke-width", "2"),
        ],
        [],
      ),
      sv(
        "path",
        [
          a("d", "M23 9a11 11 0 1 0 0 22a9 9 0 0 1 0-22z"),
          a("fill", "currentColor"),
        ],
        [],
      ),
      sv(
        "path",
        [a("d", "M27 14l1 2.4l2.6.2l-2 1.7l.6 2.5l-2.2-1.4l-2.2 1.4l.6-2.5l-2-1.7l2.6-.2z"), a("fill", "currentColor")],
        [],
      ),
    ],
  )
}

// ---------------------------------------------------------------------------------------------
// Contents

///|
fn toc_item_link(id : String, label : String, on_nav : () -> Unit) -> @element.DomNode {
  h(
    "a",
    [
      a("href", "#" + id),
      dy("class", fn() { cls_if("toc-link", "active", active_id.get() == id) }),
      dy("aria-current", fn() {
        if active_id.get() == id {
          "location"
        } else {
          "false"
        }
      }),
      on("click", fn(_e) { on_nav() }),
    ],
    [tx(label)],
  )
}

///|
fn section_holds_active(i : Int) -> Bool {
  let id = active_id.get()
  let s = sections[i]
  if s.id == id {
    return true
  }
  for sub in s.subs {
    if sub.id == id {
      return true
    }
  }
  false
}

///|
fn toc_list(prefix : String, on_nav : () -> Unit) -> @element.DomNode {
  let items : Array[@element.DomNode] = [
    h("li", [a("class", "toc-item")], [toc_item_link("top", "(Top)", on_nav)]),
  ]
  for i, s in sections {
    let row : Array[@element.DomNode] = []
    if s.subs.length() > 0 {
      let list_id = prefix + "-sub-\{i}"
      row.push(
        h(
          "button",
          [
            a("type", "button"),
            a("class", "toc-toggle"),
            a("aria-controls", list_id),
            a("aria-label", "Subsections of " + s.title),
            dy("aria-expanded", fn() { bool_s(toc_expanded(i)) }),
            on("click", fn(_e) {
              toc_open[i].set(if toc_expanded(i) { 2 } else { 1 })
            }),
          ],
          [icon_chevron("chev")],
        ),
      )
      row.push(toc_item_link(s.id, s.title, on_nav))
      let subs : Array[@element.DomNode] = []
      for sub in s.subs {
        subs.push(
          h("li", [a("class", "toc-item")], [
            toc_item_link(sub.id, sub.title, on_nav),
          ]),
        )
      }
      row.push(
        h(
          "ul",
          [
            a("id", list_id),
            dy("class", fn() { cls_if("toc-sub", "open", toc_expanded(i)) }),
          ],
          subs,
        ),
      )
    } else {
      row.push(toc_item_link(s.id, s.title, on_nav))
    }
    items.push(
      h(
        "li",
        [
          dy("class", fn() {
            cls_if("toc-item toc-l1", "holds-active", section_holds_active(i))
          }),
        ],
        row,
      ),
    )
  }
  for k, b in back_ids {
    items.push(
      h("li", [a("class", "toc-item toc-l1")], [
        toc_item_link(b, back_titles[k], on_nav),
      ]),
    )
  }
  h("ul", [a("class", "toc-list")], items)
}

///|
fn toc_rail() -> @element.DomNode {
  h(
    "nav",
    [
      a("class", "rail toc-rail"),
      a("aria-labelledby", "toc-rail-h"),
    ],
    [
      h("div", [a("class", "rail-inner")], [
        h("div", [a("class", "rail-head")], [
          h("h2", [a("id", "toc-rail-h"), a("class", "rail-title")], [
            tx("Contents"),
          ]),
          h(
            "button",
            [
              a("type", "button"),
              a("class", "btn btn-small"),
              a("aria-label", "Hide contents"),
              on("click", fn(_e) {
                toc_hidden.set(true)
                store("toc", "hidden")
                focus_id("toc-pop-btn")
              }),
            ],
            [tx("hide")],
          ),
        ]),
        toc_list("rail", fn() {  }),
      ]),
    ],
  )
}

// ---------------------------------------------------------------------------------------------
// Appearance

///|
fn radio_group(
  prefix : String,
  legend : String,
  name : String,
  sig : @signals.Signal[String],
  options : Array[(String, String)],
) -> @element.DomNode {
  let kids : Array[@element.DomNode] = [h("legend", [], [tx(legend)])]
  for opt in options {
    let (value, label) = opt
    let id = prefix + "-" + name + "-" + value
    kids.push(
      h("div", [a("class", "radio")], [
        h(
          "input",
          [
            a("type", "radio"),
            a("id", id),
            a("name", prefix + "-" + name),
            a("value", value),
            dy("checked", fn() { bool_s(sig.get() == value) }),
            on("change", fn(_e) {
              sig.set(value)
              store(name, value)
            }),
          ],
          [],
        ),
        h("label", [a("for", id)], [tx(label)]),
      ]),
    )
  }
  h("fieldset", [a("class", "appearance-group")], kids)
}

///|
fn appearance_panel(prefix : String) -> @element.DomNode {
  h("div", [a("class", "appearance-panel")], [
    radio_group(prefix, "Text", "text", text_size, [
      ("small", "Small"),
      ("standard", "Standard"),
      ("large", "Large"),
    ]),
    radio_group(prefix, "Width", "width", width_pref, [
      ("standard", "Standard"),
      ("wide", "Wide"),
    ]),
    radio_group(prefix, "Color", "color", color_pref, [
      ("auto", "Automatic"),
      ("light", "Light"),
      ("dark", "Dark"),
    ]),
  ])
}

///|
fn appearance_rail() -> @element.DomNode {
  h(
    "aside",
    [a("class", "rail appearance-rail"), a("aria-labelledby", "app-rail-h")],
    [
      h("div", [a("class", "rail-inner")], [
        h("div", [a("class", "rail-head")], [
          h("h2", [a("id", "app-rail-h"), a("class", "rail-title")], [
            tx("Appearance"),
          ]),
          h(
            "button",
            [
              a("type", "button"),
              a("class", "btn btn-small"),
              a("aria-label", "Hide appearance"),
              on("click", fn(_e) {
                appearance_hidden.set(true)
                store("appearance", "hidden")
                focus_id("app-menu-btn")
              }),
            ],
            [tx("hide")],
          ),
        ]),
        appearance_panel("rail"),
      ]),
    ],
  )
}

// ---------------------------------------------------------------------------------------------
// Header

///|
fn header() -> @element.DomNode {
  let main_links : Array[(String, String)] = [
    ("Main page", "#/wiki/Main_page"),
    ("Featured articles", "#/wiki/Featured_articles"),
    ("Random article", "#/wiki/Libration"),
    ("About Lexipedia", "#/wiki/About_Lexipedia"),
    ("Help", "#/wiki/Help"),
  ]
  let menu_items : Array[@element.DomNode] = []
  for l in main_links {
    menu_items.push(h("li", [], [h("a", [a("href", l.1)], [tx(l.0)])]))
  }
  h("header", [a("class", "site-header")], [
    h("div", [a("class", "header-start")], [
      h(
        "button",
        [
          a("type", "button"),
          a("id", "menu-btn"),
          a("class", "icon-btn"),
          a("aria-label", "Main menu"),
          a("aria-controls", "main-menu"),
          dy("aria-expanded", fn() { bool_s(menu_open.get()) }),
          on("click", fn(_e) { menu_open.update(fn(v) { !v }) }),
        ],
        [icon_menu()],
      ),
      h("a", [a("class", "brand"), a("href", "#/wiki/Moon")], [
        logo(),
        h("span", [a("class", "brand-text")], [
          h("span", [a("class", "wordmark")], [tx("Lexipedia")]),
          h("span", [a("class", "tagline")], [tx("The free encyclopedia")]),
        ]),
      ]),
      fn() {
        h(
          "div",
          [
            a("id", "main-menu"),
            dy("class", fn() { cls_if("main-menu", "open", menu_open.get()) }),
            on("keydown", fn(e) {
              if ev_key(e) == "Escape" {
                menu_open.set(false)
                focus_id("menu-btn")
              }
            }),
          ],
          [
            h(
              "button",
              [
                a("type", "button"),
                a("class", "icon-btn menu-close"),
                a("aria-label", "Close menu"),
                on("click", fn(_e) {
                  menu_open.set(false)
                  focus_id("menu-btn")
                }),
              ],
              [icon_close()],
            ),
            h("nav", [a("aria-label", "Main menu")], [
              h("h2", [a("class", "menu-title")], [tx("Main menu")]),
              h("ul", [a("class", "menu-links")], menu_items),
            ]),
            @element.show(fn() { is_phone.get() }, fn() {
              h("div", [a("class", "menu-phone")], [
                h(
                  "nav",
                  [a("class", "menu-section"), a("aria-labelledby", "menu-toc-h")],
                  [
                    h("h2", [a("id", "menu-toc-h"), a("class", "menu-title")], [
                      tx("Contents"),
                    ]),
                    toc_list("menu", fn() { menu_open.set(false) }),
                  ],
                ),
                h(
                  "section",
                  [
                    a("class", "menu-section"),
                    a("aria-labelledby", "menu-app-h"),
                  ],
                  [
                    h("h2", [a("id", "menu-app-h"), a("class", "menu-title")], [
                      tx("Appearance"),
                    ]),
                    appearance_panel("menu"),
                  ],
                ),
              ])
            }),
          ],
        )
      }(),
    ]),
    search_box(),
    h("div", [a("class", "header-end")], [
      h(
        "button",
        [
          a("type", "button"),
          a("class", "icon-btn search-toggle"),
          a("aria-label", "Search"),
          a("aria-controls", "search-input"),
          dy("aria-expanded", fn() { bool_s(phone_search_open.get()) }),
          on("click", fn(_e) {
            phone_search_open.update(fn(v) { !v })
            if phone_search_open.get() {
              let _ = set_timeout(fn() { focus_id("search-input") }, 0)
            }
          }),
        ],
        [icon_search("")],
      ),
      h("nav", [a("class", "user-links"), a("aria-label", "Personal tools")], [
        h("a", [a("href", "#/wiki/Donate")], [tx("Donate")]),
        h("a", [a("href", "#/wiki/Create_account")], [tx("Create account")]),
        h("a", [a("href", "#/wiki/Log_in")], [tx("Log in")]),
      ]),
    ]),
  ])
}

// ---------------------------------------------------------------------------------------------
// Title bar, tabs and toolbar

///|
fn tab_link(label : String, href : String, current : () -> Bool) -> @element.DomNode {
  h("li", [dy("class", fn() { cls_if("tab", "selected", current()) })], [
    h(
      "a",
      [
        a("href", href),
        dy("aria-current", fn() {
          if current() {
            "page"
          } else {
            "false"
          }
        }),
      ],
      [tx(label)],
    ),
  ])
}

///|
fn title_bar() -> @element.DomNode {
  let is_article = fn() {
    match route.get() {
      Route::Talk => false
      _ => true
    }
  }
  h("div", [a("class", "title-block")], [
    h("div", [a("class", "title-row"), a("id", "top")], [
      h("div", [a("class", "toc-pop-wrap")], [
        h(
          "button",
          [
            a("type", "button"),
            a("id", "toc-pop-btn"),
            a("class", "icon-btn toc-pop-btn"),
            a("aria-label", "Contents"),
            a("aria-controls", "toc-pop"),
            dy("aria-expanded", fn() { bool_s(toc_pop_open.get()) }),
            on("click", fn(_e) { toc_pop_open.update(fn(v) { !v }) }),
          ],
          [icon_toc()],
        ),
        h(
            "div",
            [
              a("id", "toc-pop"),
              dy("class", fn() { cls_if("popover toc-pop", "open", toc_pop_open.get()) }),
              a("role", "dialog"),
              a("aria-labelledby", "toc-pop-h"),
            ],
            [
              h("div", [a("class", "rail-head")], [
                h("h2", [a("id", "toc-pop-h"), a("class", "rail-title")], [
                  tx("Contents"),
                ]),
                h(
                  "button",
                  [
                    a("type", "button"),
                    a("class", "btn btn-small toc-unhide"),
                    a("aria-label", "Move contents to the sidebar"),
                    on("click", fn(_e) {
                      toc_hidden.set(false)
                      toc_pop_open.set(false)
                      store("toc", "shown")
                    }),
                  ],
                  [tx("move to sidebar")],
                ),
              ]),
              toc_list("pop", fn() { toc_pop_open.set(false) }),
            ],
          ),
      ]),
      h("h1", [a("class", "page-title")], [
        @element.text_dyn(fn() {
          match route.get() {
            Route::Talk => "Talk:Moon"
            Route::Source => "View source for Moon"
            Route::History => "Moon: Revision history"
            _ => "Moon"
          }
        }),
      ]),
      h(
        "button",
        [
          a("type", "button"),
          a("class", "lang-btn"),
          a("aria-haspopup", "dialog"),
          dy("aria-expanded", fn() { bool_s(lang_open.get()) }),
          on("click", fn(_e) {
            lang_query.set("")
            match lang_input.val {
              Some(el) => set_value(el, "")
              None => ()
            }
            match lang_dialog.val {
              Some(d) => {
                dialog_open(d)
                lang_open.set(true)
              }
              None => ()
            }
          }),
        ],
        [
          icon_lang(),
          h("span", [], [tx("\{languages.length()} languages")]),
          icon_down(),
        ],
      ),
    ]),
    h("div", [a("class", "tabs-row")], [
      h("nav", [a("class", "tabs"), a("aria-label", "Namespaces")], [
        h("ul", [], [
          tab_link("Article", "#/wiki/Moon", is_article),
          tab_link("Talk", "#/talk", fn() { !is_article() }),
        ]),
      ]),
      h("nav", [a("class", "tabs tabs-views"), a("aria-label", "Views")], [
        h("ul", [], [
          tab_link("Read", "#/wiki/Moon", fn() {
            match route.get() {
              Route::Article | Route::Talk => true
              _ => false
            }
          }),
          tab_link("View source", "#/source", fn() {
            route.get() == Route::Source
          }),
          tab_link("View history", "#/history", fn() {
            route.get() == Route::History
          }),
        ]),
      ]),
      h("div", [a("class", "toolbar")], [
        h("div", [a("class", "app-menu-wrap")], [
          h(
            "button",
            [
              a("type", "button"),
              a("id", "app-menu-btn"),
              a("class", "icon-btn app-menu-btn"),
              a("aria-label", "Appearance"),
              a("aria-controls", "app-menu"),
              dy("aria-expanded", fn() { bool_s(app_menu_open.get()) }),
              on("click", fn(_e) { app_menu_open.update(fn(v) { !v }) }),
            ],
            [icon_brush()],
          ),
          h(
              "div",
              [
                a("id", "app-menu"),
                dy("class", fn() { cls_if("popover app-menu", "open", app_menu_open.get()) }),
                a("role", "dialog"),
                a("aria-labelledby", "app-menu-h"),
              ],
              [
                h("div", [a("class", "rail-head")], [
                  h("h2", [a("id", "app-menu-h"), a("class", "rail-title")], [
                    tx("Appearance"),
                  ]),
                  h(
                    "button",
                    [
                      a("type", "button"),
                      a("class", "btn btn-small app-unhide"),
                      a("aria-label", "Move appearance to the sidebar"),
                      on("click", fn(_e) {
                        appearance_hidden.set(false)
                        app_menu_open.set(false)
                        store("appearance", "shown")
                      }),
                    ],
                    [tx("move to sidebar")],
                  ),
                ]),
                appearance_panel("pop"),
              ],
            ),
        ]),
        h(
          "button",
          [
            a("type", "button"),
            dy("class", fn() { cls_if("icon-btn watch-btn", "on", watched.get()) }),
            dy("aria-pressed", fn() { bool_s(watched.get()) }),
            a("aria-label", "Watch this page"),
            on("click", fn(_e) {
              watched.update(fn(v) { !v })
              store("watch", bool_s(watched.get()))
              toast(
                if watched.get() {
                  "Added to your watchlist."
                } else {
                  "Removed from your watchlist."
                },
              )
            }),
          ],
          [icon_star()],
        ),
      ]),
    ]),
    h("p", [a("class", "from-line")], [
      tx("From Lexipedia, the free encyclopedia"),
    ]),
  ])
}

// ---------------------------------------------------------------------------------------------
// The article

///|
fn infobox_view() -> @element.DomNode {
  let rows : Array[@element.DomNode] = []
  for sec in infobox {
    rows.push(
      h("tr", [], [
        h("th", [a("colspan", "2"), a("scope", "colgroup"), a("class", "ib-head")], [
          tx(sec.head),
        ]),
      ]),
    )
    for r in sec.rows {
      rows.push(
        h("tr", [], [
          h("th", [a("scope", "row")], [tx(r.label)]),
          h("td", [], [tx(r.value)]),
        ]),
      )
    }
  }
  h("aside", [a("class", "infobox"), a("aria-labelledby", "ib-title")], [
    h("div", [a("class", "ib-title"), a("id", "ib-title")], [tx("Moon")]),
    // a picture, not a focus stop: inside the float a button would be focused out of
    // reading order; the media viewer still shows it after the two body figures
    h("div", [a("class", "ib-image")], [moon_art("ib", figures[2].alt, "ib-art")]),
    h("p", [a("class", "ib-caption")], [tx(figures[2].caption)]),
    h("table", [a("class", "ib-table")], [h("tbody", [], rows)]),
  ])
}

///|
fn thumb_figure(i : Int, side : String) -> @element.DomNode {
  h("figure", [a("class", "thumb " + side)], [
    h(
      "button",
      [
        a("type", "button"),
        a("class", "thumb-btn"),
        a("aria-haspopup", "dialog"),
        dy("aria-expanded", fn() { bool_s(media_open.get() && media_index.get() == i) }),
        a("aria-label", "Open image: " + figures[i].caption),
        on("click", fn(_e) { open_media(i) }),
      ],
      [figure_art(i, "fig\{i}", "fig-art fig-" + figures[i].kind)],
    ),
    h("figcaption", [], [tx(figures[i].caption)]),
  ])
}

///|
fn section_shell(
  idx : Int,
  id : String,
  title : String,
  body : Array[@element.DomNode],
) -> @element.DomNode {
  let body_id = "sec-body-\{idx}"
  h("section", [a("class", "sec"), a("aria-labelledby", id)], [
    @element.show(fn() { is_phone.get() }, fn() {
      h("h2", [a("id", id), a("class", "sec-h acc-h")], [
        h(
          "button",
          [
            a("type", "button"),
            a("class", "acc-btn"),
            a("aria-controls", body_id),
            dy("aria-expanded", fn() { bool_s(acc_open[idx].get()) }),
            on("click", fn(_e) { acc_open[idx].update(fn(v) { !v }) }),
          ],
          [icon_chevron("acc-chev"), h("span", [], [tx(title)])],
        ),
      ])
    }),
    @element.show(fn() { !is_phone.get() }, fn() {
      h("h2", [a("id", id), a("class", "sec-h")], [tx(title)])
    }),
    h(
      "div",
      [
        a("id", body_id),
        dy("class", fn() {
          cls_if("sec-body", "collapsed", is_phone.get() && !acc_open[idx].get())
        }),
      ],
      body,
    ),
  ])
}

///|
fn article_section(i : Int) -> @element.DomNode {
  let s = sections[i]
  let body : Array[@element.DomNode] = []
  if s.fig >= 0 {
    body.push(thumb_figure(s.fig, if s.fig == 0 { "tright" } else { "tleft" }))
  }
  for p in s.paras {
    body.push(para(p))
  }
  for sub in s.subs {
    body.push(h("h3", [a("id", sub.id)], [tx(sub.title)]))
    for p in sub.paras {
      body.push(para(p))
    }
  }
  section_shell(i, s.id, s.title, body)
}

///|
fn back_matter() -> Array[@element.DomNode] {
  let n = sections.length()
  let see : Array[@element.DomNode] = []
  for t in see_also {
    see.push(h("li", [], [wiki_link(t, t)]))
  }
  let refs : Array[@element.DomNode] = []
  for i, r in references {
    let num = i + 1
    let kids : Array[@element.DomNode] = [
      h(
        "a",
        [
          a("href", "#cite_ref-\{num}"),
          a("class", "backlink"),
          a("aria-label", "Back to citation \{num} in the text"),
        ],
        [tx("^")],
      ),
      tx(" "),
    ]
    for x in inline_nodes(r.text) {
      kids.push(x)
    }
    refs.push(h("li", [a("id", "cite_note-\{num}")], kids))
  }
  let ext : Array[@element.DomNode] = []
  for t in external_links {
    ext.push(h("li", [], [tx(t)]))
  }
  [
    section_shell(n, back_ids[0], back_titles[0], [
      h("ul", [a("class", "see-also")], see),
    ]),
    section_shell(n + 1, back_ids[1], back_titles[1], [
      h("ol", [a("class", "references")], refs),
    ]),
    section_shell(n + 2, back_ids[2], back_titles[2], [
      h("ul", [a("class", "external")], ext),
      h("p", [a("class", "note")], [
        tx("External links are listed as text only in this demo."),
      ]),
    ]),
  ]
}

///|
fn article_view() -> @element.DomNode {
  cite_count.clear()
  let kids : Array[@element.DomNode] = [
    h("div", [a("class", "hatnote"), a("role", "note")], [
      h("i", [], inline_nodes(hatnote)),
    ]),
    para(lead[0]),
    infobox_view(),
  ]
  for i = 1; i < lead.length(); i = i + 1 {
    kids.push(para(lead[i]))
  }
  for i = 0; i < sections.length(); i = i + 1 {
    kids.push(article_section(i))
  }
  for x in back_matter() {
    kids.push(x)
  }
  h("div", [a("class", "article-body")], kids)
}

///|
fn talk_view() -> @element.DomNode {
  let kids : Array[@element.DomNode] = [
    h("div", [a("class", "notice")], [
      tx("This is the talk page for discussing improvements to the article "),
      wiki_link("Moon", "Moon"),
      tx(". It is a stub of a talk page in this demo."),
    ]),
  ]
  for t in talk {
    kids.push(h("h2", [a("class", "sec-h")], [tx(t.topic)]))
    for p in t.posts {
      kids.push(
        h("div", [a("class", "post")], [
          h("p", [], [tx(p.1)]),
          h("p", [a("class", "post-sig")], [tx("— " + p.0)]),
        ]),
      )
    }
  }
  h("div", [a("class", "article-body plain")], kids)
}

///|
fn source_view() -> @element.DomNode {
  let sb = StringBuilder()
  sb.write_string("{{Hatnote|" + hatnote + "}}\n\n")
  for p in lead {
    sb.write_string(p + "\n\n")
  }
  for s in sections {
    sb.write_string("== " + s.title + " ==\n")
    for p in s.paras {
      sb.write_string(p + "\n\n")
    }
    for sub in s.subs {
      sb.write_string("=== " + sub.title + " ===\n")
      for p in sub.paras {
        sb.write_string(p + "\n\n")
      }
    }
  }
  h("div", [a("class", "article-body plain")], [
    h("p", [], [
      tx("This page is protected in this demo. You can view and copy its source."),
    ]),
    h("label", [a("for", "source-text"), a("class", "field-label")], [
      tx("Source of Moon"),
    ]),
    h(
      "textarea",
      [
        a("id", "source-text"),
        a("class", "source"),
        a("readonly", ""),
        a("rows", "18"),
        a("spellcheck", "false"),
      ],
      [tx(sb.to_string())],
    ),
  ])
}

///|
fn history_view() -> @element.DomNode {
  let rows : Array[@element.DomNode] = []
  for r in history {
    rows.push(
      h("tr", [], [
        h("td", [a("class", "nowrap")], [tx(r.date)]),
        h("td", [], [tx(r.user)]),
        h("td", [a("class", "num")], [tx(r.size)]),
        h(
          "td",
          [
            a(
              "class",
              cls_if("num delta", "minus", starts_with(r.delta, "−")),
            ),
          ],
          [tx(r.delta)],
        ),
        h("td", [], [tx(r.summary)]),
      ]),
    )
  }
  h("div", [a("class", "article-body plain")], [
    h("p", [], [
      tx("The ten most recent revisions of the article, newest first."),
    ]),
    h("div", [a("class", "table-scroll"), a("tabindex", "0"), a("role", "region"), a("aria-label", "Revision history table")], [
      h("table", [a("class", "history")], [
        h("caption", [], [tx("Revision history of “Moon”")]),
        h("thead", [], [
          h("tr", [], [
            h("th", [a("scope", "col")], [tx("Date")]),
            h("th", [a("scope", "col")], [tx("Editor")]),
            h("th", [a("scope", "col"), a("class", "num")], [tx("Size (bytes)")]),
            h("th", [a("scope", "col"), a("class", "num")], [tx("Change")]),
            h("th", [a("scope", "col")], [tx("Summary")]),
          ]),
        ]),
        h("tbody", [], rows),
      ]),
    ]),
  ])
}

///|
fn simple_page(title : String, body : Array[@element.DomNode]) -> @element.DomNode {
  let kids : Array[@element.DomNode] = [
    h("div", [a("class", "title-block")], [
      h("div", [a("class", "title-row"), a("id", "top")], [
        h("h1", [a("class", "page-title")], [tx(title)]),
      ]),
      h("p", [a("class", "from-line")], [
        tx("From Lexipedia, the free encyclopedia"),
      ]),
    ]),
  ]
  for b in body {
    kids.push(b)
  }
  h("div", [a("class", "simple-page")], kids)
}

///|
fn stub_view(t : String) -> @element.DomNode {
  let info = find_title(t)
  let lead_nodes : Array[@element.DomNode] = match info {
    Some(it) =>
      [
        h("div", [a("class", "stub-thumb")], [thumb_art(it.thumb, "stub")]),
        h("p", [], [tx(it.extract)]),
      ]
    None =>
      [
        h("p", [], [
          h("b", [], [tx(t)]),
          tx(" is a page of this demo encyclopedia that has not been written yet."),
        ]),
      ]
  }
  let body : Array[@element.DomNode] = [h("div", [a("class", "stub-lead")], lead_nodes)]
  body.push(
    h("div", [a("class", "stub-box"), a("role", "note")], [
      h("p", [], [
        h("b", [], [tx("This article is a stub.")]),
        tx(" You can help Lexipedia by expanding it."),
      ]),
    ]),
  )
  body.push(
    h("p", [a("class", "back-to")], [
      tx("Return to the article "),
      wiki_link("Moon", "Moon"),
      tx("."),
    ]),
  )
  simple_page(t, body)
}

///|
fn search_view(q : String) -> @element.DomNode {
  let ms = search_matches(q)
  let items : Array[@element.DomNode] = []
  for t in ms {
    items.push(
      h("li", [a("class", "result")], [
        thumb_art(t.thumb, "r"),
        h("div", [], [
          h("p", [a("class", "result-title")], [wiki_link(t.title, t.title)]),
          h("p", [a("class", "result-desc")], [tx(t.desc + ". " + t.extract)]),
        ]),
      ]),
    )
  }
  let summary = if q == "" {
    "Type a word in the search field to look for an article, such as “eclipse” or “tide”."
  } else if ms.length() == 0 {
    "There were no results matching “" + q + "”. Try a shorter word, such as “lunar”."
  } else if ms.length() == 1 {
    "1 result for “" + q + "”."
  } else {
    "\{ms.length()} results for “" + q + "”."
  }
  simple_page("Search results", [
    h("p", [a("class", "result-count"), a("role", "status")], [tx(summary)]),
    h("ul", [a("class", "results")], items),
  ])
}

///|
fn content_view(r : Route) -> @element.DomNode {
  match r {
    Route::Stub(t) => stub_view(t)
    Route::Search(q) => search_view(q)
    _ =>
      h("div", [a("class", "article-page")], [
        title_bar(),
        match r {
          Route::Talk => talk_view()
          Route::Source => source_view()
          Route::History => history_view()
          _ => article_view()
        },
      ])
  }
}

// ---------------------------------------------------------------------------------------------
// Overlays: preview card, toast, language dialog, media viewer

///|
fn preview_card(p : Preview) -> @element.DomNode {
  let body : Array[@element.DomNode] = match p.kind {
    PKind::PPage(t) =>
      match find_title(t) {
        Some(it) =>
          [
            h("div", [a("class", "pv-thumb")], [thumb_art(it.thumb, "pv")]),
            h("div", [a("class", "pv-text")], [
              h("p", [a("class", "pv-title")], [tx(it.title)]),
              h("p", [a("class", "pv-extract")], [tx(it.extract)]),
            ]),
          ]
        None =>
          [
            h("div", [a("class", "pv-text")], [
              h("p", [a("class", "pv-title")], [tx(t)]),
              h("p", [a("class", "pv-extract")], [
                tx("This page has not been written yet."),
              ]),
            ]),
          ]
      }
    PKind::PRef(n) =>
      [
        h("div", [a("class", "pv-text")], [
          h("p", [a("class", "pv-label")], [tx("Reference \{n}")]),
          h("p", [a("class", "pv-ref")], inline_nodes(references[n - 1].text)),
        ]),
      ]
  }
  let kind_cls = match p.kind {
    PKind::PPage(_) => "preview preview-page"
    PKind::PRef(_) => "preview preview-ref"
  }
  h(
    "div",
    [
      a("class", if p.above { kind_cls + " above" } else { kind_cls }),
      a("role", "tooltip"),
      a("style", "left: \{p.x}px; top: \{p.y}px;"),
      on("mouseenter", fn(_e) { cancel_hide() }),
      on("mouseleave", fn(_e) { hide_soon() }),
    ],
    body,
  )
}

///|
fn language_dialog() -> @element.DomNode {
  let filtered = @resource.memo(fn() {
    let q = lower(lang_query.get())
    languages.filter(fn(l) { q == "" || lower(l).contains(q) })
  })
  let pick = fn(l : String) {
    match lang_dialog.val {
      Some(d) => dialog_close(d)
      None => ()
    }
    toast("The " + l + " edition is not part of this demo.")
  }
  let suggested : Array[@element.DomNode] = []
  for l in suggested_languages {
    suggested.push(
      h("li", [], [
        h(
          "button",
          [a("type", "button"), a("class", "lang-item"), on("click", fn(_e) { pick(l) })],
          [tx(l)],
        ),
      ]),
    )
  }
  h(
    "dialog",
    [
      a("class", "dialog lang-dialog"),
      a("aria-labelledby", "lang-h"),
      ref_to(lang_dialog),
      on("close", fn(_e) { lang_open.set(false) }),
    ],
    [
      h("div", [a("class", "dialog-head")], [
        h("h2", [a("id", "lang-h")], [tx("Read this article in another language")]),
        h(
          "button",
          [
            a("type", "button"),
            a("class", "icon-btn"),
            a("aria-label", "Close"),
            on("click", fn(_e) {
              match lang_dialog.val {
                Some(d) => dialog_close(d)
                None => ()
              }
            }),
          ],
          [icon_close()],
        ),
      ]),
      h("label", [a("for", "lang-search"), a("class", "sr-only")], [
        tx("Search for a language"),
      ]),
      h(
        "input",
        [
          a("id", "lang-search"),
          a("type", "search"),
          a("class", "lang-search"),
          a("placeholder", "Search for a language"),
          a("autocomplete", "off"),
          a("autofocus", ""),
          ref_to(lang_input),
          on("input", fn(e) { lang_query.set(ev_value(e)) }),
        ],
        [],
      ),
      @element.show(fn() { lang_query.get() == "" }, fn() {
        h("div", [], [
          h("h3", [a("class", "lang-sub")], [tx("Suggested languages")]),
          h("ul", [a("class", "lang-grid lang-suggested")], suggested),
        ])
      }),
      h("h3", [a("class", "lang-sub")], [
        @element.text_dyn(fn() {
          let n = filtered().length()
          if lang_query.get() == "" {
            "All languages"
          } else if n == 0 {
            "No languages match “" + lang_query.get() + "”"
          } else if n == 1 {
            "1 language matches"
          } else {
            "\{n} languages match"
          }
        }),
      ]),
      h("ul", [a("class", "lang-grid")], [
        @element.for_each(fn() { filtered() }, fn(l, _i) {
          h("li", [], [
            h(
              "button",
              [a("type", "button"), a("class", "lang-item"), on("click", fn(_e) { pick(l) })],
              [tx(l)],
            ),
          ])
        }),
      ]),
    ],
  )
}

///|
fn open_media(i : Int) -> Unit {
  hide_now()
  media_index.set(i)
  match media_dialog.val {
    Some(d) => {
      dialog_open(d)
      media_open.set(true)
    }
    None => ()
  }
}

///|
fn media_step(d : Int) -> Unit {
  let n = figures.length()
  media_index.set((media_index.get() + d + n) % n)
}

///|
fn media_viewer() -> @element.DomNode {
  h(
    "dialog",
    [
      a("class", "dialog media-dialog"),
      a("aria-labelledby", "media-caption"),
      ref_to(media_dialog),
      on("close", fn(_e) { media_open.set(false) }),
      on("keydown", fn(e) {
        let k = ev_key(e)
        if k == "ArrowRight" {
          media_step(1)
        } else if k == "ArrowLeft" {
          media_step(-1)
        }
      }),
    ],
    [
      h("div", [a("class", "media-head")], [
        h("p", [a("class", "media-count")], [
          @element.text_dyn(fn() {
            "Image \{media_index.get() + 1} of \{figures.length()}"
          }),
        ]),
        h(
          "button",
          [
            a("type", "button"),
            a("class", "icon-btn media-close"),
            a("aria-label", "Close"),
            on("click", fn(_e) {
              match media_dialog.val {
                Some(d) => dialog_close(d)
                None => ()
              }
            }),
          ],
          [icon_close()],
        ),
      ]),
      h("div", [a("class", "media-stage")], [
        @element.for_each(fn() { [media_index.get()] }, fn(i, _k) {
          figure_art(i, "mv\{i}", "media-art fig-" + figures[i].kind)
        }),
      ]),
      h("p", [a("class", "media-caption"), a("id", "media-caption")], [
        @element.text_dyn(fn() { figures[media_index.get()].caption }),
      ]),
      h("div", [a("class", "media-nav")], [
        h(
          "button",
          [a("type", "button"), a("class", "btn"), on("click", fn(_e) { media_step(-1) })],
          [tx("Previous")],
        ),
        h(
          "button",
          [a("type", "button"), a("class", "btn"), on("click", fn(_e) { media_step(1) })],
          [tx("Next")],
        ),
      ]),
    ],
  )
}

// ---------------------------------------------------------------------------------------------
// Scroll spy

///|
fn spy_ids() -> Array[String] {
  let ids = ["top"]
  for s in sections {
    ids.push(s.id)
    for sub in s.subs {
      ids.push(sub.id)
    }
  }
  for b in back_ids {
    ids.push(b)
  }
  ids
}

///|
fn update_spy(ids : Array[String]) -> Unit {
  if route.get() != Route::Article {
    return
  }
  let line = 0.25 * viewport_height()
  let mut current = "top"
  for id in ids {
    if top_of_id(id) <= line {
      current = id
    }
  }
  if page_bottom_reached() {
    // the last heading may never reach the line: count it once the page ends
    for id in ids {
      let t = top_of_id(id)
      if t < viewport_height() && t > line {
        current = id
      }
    }
  }
  if active_id.get() != current {
    active_id.set(current)
  }
}

// ---------------------------------------------------------------------------------------------
// Main

///|
fn main {
  for i, s in sections {
    toc_open.push(@resource.signal(0))
    acc_open.push(@resource.signal(false))
    for p in s.paras {
      scan_cites(p, i)
    }
    for sub in s.subs {
      for p in sub.paras {
        scan_cites(p, i)
      }
    }
  }
  for _b in back_ids {
    acc_open.push(@resource.signal(false))
  }
  for p in lead {
    scan_cites(p, -1)
  }
  // settings: stored choice, then the URL
  text_size.set(load("text", ["small", "standard", "large"], "standard"))
  width_pref.set(load("width", ["standard", "wide"], "standard"))
  color_pref.set(load("color", ["auto", "light", "dark"], "auto"))
  toc_hidden.set(storage_get("lexipedia:toc") == "hidden")
  appearance_hidden.set(storage_get("lexipedia:appearance") == "hidden")
  watched.set(storage_get("lexipedia:watch") == "true")
  let forced = query_param("theme")
  if forced == "dark" || forced == "light" {
    color_pref.set(forced)
  }
  is_phone.set(watch_media("(max-width: 719px)", fn(m) { is_phone.set(m) }))
  let _ = @resource.effect(fn() {
    set_root_attr("data-text", text_size.get())
    set_root_attr("data-width", width_pref.get())
    set_root_attr("data-theme", color_pref.get())
    set_root_attr("data-toc", if toc_hidden.get() { "hidden" } else { "shown" })
    set_root_attr(
      "data-appearance",
      if appearance_hidden.get() {
        "hidden"
      } else {
        "shown"
      },
    )
  })
  let app = h("div", [a("class", "app")], [
    h("a", [a("class", "skip-link"), a("href", "#content")], [
      tx("Skip to content"),
    ]),
    header(),
    h("div", [a("class", "page")], [
      @element.show(fn() { route.get() == Route::Article }, fn() { toc_rail() }),
      h("main", [a("id", "content"), a("class", "content"), a("tabindex", "-1")], [
        @element.for_each(fn() { [route.get()] }, fn(r, _i) { content_view(r) }),
      ]),
      appearance_rail(),
    ]),
    @element.for_each(
      fn() {
        match preview.get() {
          Some(p) => [p]
          None => []
        }
      },
      fn(p, _i) { preview_card(p) },
    ),
    h(
      "div",
      [
        dy("class", fn() { cls_if("toast", "show", toast_msg.get() != "") }),
        a("role", "status"),
        a("aria-live", "polite"),
      ],
      [@element.text_dyn(fn() { toast_msg.get() })],
    ),
    language_dialog(),
    media_viewer(),
  ])
  match @dom.document().getElementById("app") {
    Some(el) => @element.render_to(el, app)
    None => ()
  }
  // global keys and presses
  on_doc_keydown(fn(k) {
    if k == "Escape" {
      if preview.get() is Some(_) {
        hide_now()
      }
      if toc_pop_open.get() {
        toc_pop_open.set(false)
        focus_id("toc-pop-btn")
      }
      if app_menu_open.get() {
        app_menu_open.set(false)
        focus_id("app-menu-btn")
      }
      if menu_open.get() {
        menu_open.set(false)
        focus_id("menu-btn")
      }
    }
  })
  on_outside_press(".toc-pop-wrap", fn() {
    if toc_pop_open.get() {
      toc_pop_open.set(false)
    }
  })
  on_outside_press(".app-menu-wrap", fn() {
    if app_menu_open.get() {
      app_menu_open.set(false)
    }
  })
  on_outside_press(".header-start", fn() {
    if menu_open.get() {
      menu_open.set(false)
    }
  })
  on_touch_press(fn() {
    touch_recent.val = true
    let _ = set_timeout(fn() { touch_recent.val = false }, 800)
  })
  let ids = spy_ids()
  on_scroll_frame(fn() { update_spy(ids) })
  on_hashchange(fn() { sync_route() })
  sync_route()
  update_spy(ids)
}
