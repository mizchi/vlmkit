// Findwell: the home view, the results view, and the two small pages they lead to.

///|
struct Route {
  view : String // home | results | leave | info
  q : String
  tab : String
  page : Int
  go : Int
  info : String
} derive(Eq)

///|
struct S {
  route : @resource.Signal[Route]
  dark : @resource.Signal[Bool]
  theme_param : Ref[String]
  pushed : Ref[Int]
  // combobox
  typed : @resource.Signal[String]
  text : @resource.Signal[String]
  open : @resource.Signal[Bool]
  active : @resource.Signal[Int]
  input : Ref[@js.Any?]
  sugg : () -> Array[String]
  // popups: "" or the id of the open menu / panel
  popup : @resource.Signal[String]
  // results
  time : @resource.Signal[String]
  verbatim : @resource.Signal[Bool]
  tools : @resource.Signal[Bool]
  visited : @resource.Signal[Array[Int]]
  paa_open : @resource.Signal[Array[Int]]
  paa_extra : @resource.Signal[Int]
  kp_more : @resource.Signal[Bool]
  about : @resource.Signal[Int]
  status : @resource.Signal[String]
}

///|
fn at(k : String, v : String) -> (String, @element.Attr) {
  (k, @element.AttrString(v))
}

///|
fn dyn(k : String, f : () -> String) -> (String, @element.AttrValue) {
  (k, @element.attr_dynamic(f))
}

///|
fn el(
  tag : String,
  attrs : Array[(String, String)],
  kids : Array[@element.DomNode],
) -> @element.DomNode {
  @element.create_element(
    tag,
    attrs.map(fn(kv) { (kv.0, @element.attr_static(kv.1)) }),
    kids,
  )
}

///|
fn t(s : String) -> @element.DomNode {
  @element.text(s)
}

///|
fn[T] any_of(x : T) -> @js.Any {
  @js.identity(x)
}

// ── Routing ───────────────────────────────────────────────────

///|
fn parse_route() -> Route {
  let q = url_param("q")
  let go = @string.parse_int(url_param("go")) catch { _ => 0 }
  let page = @string.parse_int(url_param("page")) catch { _ => 1 }
  let info = url_param("info")
  let tab = match url_param("tab") {
    "" => "all"
    x => x
  }
  let view = if go > 0 {
    "leave"
  } else if info != "" {
    "info"
  } else if q.trim() != "" {
    "results"
  } else {
    "home"
  }
  { view, q, tab, page: if page < 1 { 1 } else { page }, go, info }
}

///|
fn route_url(s : S, r : Route) -> String {
  let parts : Array[String] = []
  match r.view {
    "results" => {
      parts.push("q=" + encode(r.q))
      if r.tab != "all" {
        parts.push("tab=" + r.tab)
      }
      if r.page > 1 {
        parts.push("page=" + r.page.to_string())
      }
    }
    "leave" => {
      if r.q != "" {
        parts.push("q=" + encode(r.q))
      }
      parts.push("go=" + r.go.to_string())
    }
    "info" => parts.push("info=" + r.info)
    _ => ()
  }
  if s.theme_param.val != "" {
    parts.push("theme=" + s.theme_param.val)
  }
  if parts.is_empty() {
    pathname()
  } else {
    "?" + parts.join("&")
  }
}

///|
fn home_route() -> Route {
  { view: "home", q: "", tab: "all", page: 1, go: 0, info: "" }
}

///|
fn results_route(q : String, tab : String, page : Int) -> Route {
  { view: "results", q, tab, page, go: 0, info: "" }
}

///|
fn sync_box(s : S, q : String) -> Unit {
  s.typed.set(q)
  s.text.set(q)
  s.open.set(false)
  s.active.set(-1)
  match s.input.val {
    Some(i) => set_value(i, q)
    None => ()
  }
}

///|
fn navigate(s : S, r : Route) -> Unit {
  push_url(route_url(s, r))
  s.pushed.val += 1
  @resource.batch(fn() {
    s.popup.set("")
    s.route.set(r)
    sync_box(s, r.q)
  })
  scroll_top()
}

///|
fn link_click(s : S, r : Route) -> @element.HandlerMap {
  @element.events().click(fn(e) {
    let ev = any_of(e)
    // Let modified clicks open a new tab as usual.
    if (ev._get("ctrlKey").cast() : Bool) ||
      (ev._get("metaKey").cast() : Bool) ||
      (ev._get("shiftKey").cast() : Bool) {
      return
    }
    prevent(ev)
    navigate(s, r)
  })
}

///|
fn go_back_or(s : S, r : Route) -> Unit {
  if s.pushed.val > 0 {
    history_back()
  } else {
    navigate(s, r)
  }
}

///|
fn do_search(s : S, raw : String) -> Unit {
  let q = raw.trim().to_string()
  if q == "" {
    s.status.set("Type something to search for.")
    match s.input.val {
      Some(i) => i._call("focus", []) |> ignore
      None => ()
    }
    return
  }
  let cur = s.route.get()
  let tab = if cur.view == "results" { cur.tab } else { "all" }
  s.status.set("")
  navigate(s, results_route(q, tab, 1))
}

///|
fn lucky(s : S) -> Unit {
  let q = match s.input.val {
    Some(i) => (i._get("value").cast() : String).trim().to_string()
    None => s.text.get()
  }
  if q == "" {
    s.status.set("Type something first, then try Feeling Lucky.")
    return
  }
  let found = search(q, false)
  if found.is_empty() {
    navigate(s, results_route(q, "all", 1))
  } else {
    navigate(s, { view: "leave", q, tab: "all", page: 1, go: found[0].id, info: "" })
  }
}

///|
/// luna's `svg(class=…)` sets `className`, which an SVG element ignores (it is an
/// SVGAnimatedString), so the class is lost. Set it as an attribute once mounted.
fn svg_class(cls : String) -> (@dom.Element) -> Unit {
  fn(node) { any_of(node)._call("setAttribute", [@js.any("class"), @js.any(cls)]) |> ignore }
}

///|
/// Like `show`, but the content stays in the DOM and is only hidden, so the id an
/// `aria-controls` names always exists. The wrapper is `display: contents` while shown.
fn keep_mounted(cond : () -> Bool, render : () -> @element.DomNode) -> @element.DomNode {
  @element.div(dyn_class=fn() { if cond() { "keep" } else { "keep closed" } }) <| [render()]
}

// ── Icons ─────────────────────────────────────────────────────

///|
fn icon(d : String, cls~ : String = "icon") -> @element.DomNode {
  @element.svg(
    viewBox="0 0 24 24",
    ref_=svg_class(cls),
    attrs=[at("aria-hidden", "true"), at("focusable", "false")],
  ) <| [@element.svg_path(d~, fill="currentColor")]
}

///|
let d_search = "M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5Zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14Z"

///|
let d_mic = "M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5.3-3a5.3 5.3 0 0 1-10.6 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-1.7Z"

///|
let d_camera = "M9 3 7.17 5H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3.17L15 3H9Zm3 15a5 5 0 1 1 0-10 5 5 0 0 1 0 10Zm0-2a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"

///|
let d_close = "M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41Z"

///|
let d_dots = "M12 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm0 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm0 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z"

///|
let d_grid = "M6 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm6 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm6 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM6 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm6 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm6 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM6 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm6 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm6 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"

///|
let d_caret = "M7 10l5 5 5-5H7Z"

///|
let d_chevron = "M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6-6-6Z"

///|
let d_back = "M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2Z"

///|
let d_tune = "M3 17v2h6v-2H3ZM3 5v2h10V5H3Zm10 16v-2h8v-2h-8v-2h-2v6h2ZM7 9v2H3v2h4v2h2V9H7Zm14 4v-2H11v2h10Zm-6-4h2V7h4V5h-4V3h-2v6Z"

// ── Wordmark ──────────────────────────────────────────────────

///|
fn wordmark(cls : String) -> @element.DomNode {
  let letters = ["F", "i", "n", "d", "w", "e", "l", "l"]
  @element.span(class="wordmark " + cls) <| letters.mapi(fn(i, c) {
    @element.span(class="wm wm\{i}", attrs=[at("aria-hidden", "true")]) <| [t(c)]
  })
}

// ── Menus and popups ──────────────────────────────────────────

///|
struct MenuItem {
  id : String
  role : String // menuitem | menuitemradio | menuitemcheckbox
  label : () -> String
  checked : () -> Bool
  act : () -> Unit
}

///|
fn open_popup(s : S, id : String) -> Unit {
  s.popup.set(id)
}

///|
fn close_popup(s : S, focus_button : Bool) -> Unit {
  let id = s.popup.get()
  if id != "" {
    s.popup.set("")
    if focus_button {
      focus_id(id + "-btn")
    }
  }
}

///|
fn focus_menu(s : S, id : String, which : String) -> Unit {
  ignore(s)
  let ids = menu_item_ids(id + "-menu")
  if ids.is_empty() {
    return
  }
  let cur = active_id()
  let mut idx = -1
  for i, x in ids {
    if x == cur {
      idx = i
    }
  }
  let n = ids.length()
  let next = match which {
    "first" => 0
    "last" => n - 1
    "next" => if idx < 0 { 0 } else { (idx + 1) % n }
    "prev" => if idx <= 0 { n - 1 } else { idx - 1 }
    _ => 0
  }
  focus_id(ids[next])
}

///|
fn open_menu_focus(s : S, id : String, items : Array[MenuItem], which : String) -> Unit {
  open_popup(s, id)
  place_float_menu(id)
  // Land on the checked item, as a select would, else the first or last.
  let mut target = ""
  for it in items {
    if it.role != "menuitem" && (it.checked)() && target == "" {
      target = it.id
    }
  }
  if target != "" && which == "first" {
    focus_id(target)
  } else {
    focus_menu(s, id, which)
  }
}

///|
/// A menu inside a scrolling strip (the tabs) would be clipped by it, so it is
/// position: fixed and placed under its button when it opens.
fn place_float_menu(id : String) -> Unit {
  match (by_id(id + "-menu"), by_id(id + "-btn")) {
    (Some(menu), Some(btn)) =>
      if (menu._get("classList")._call("contains", [@js.any("float")]).cast() : Bool) {
        let r = btn._call("getBoundingClientRect", [])
        let bottom : Double = r._get("bottom").cast()
        let left : Double = r._get("left").cast()
        let vw : Double = g()._get("innerWidth").cast()
        let x = if left + 216.0 > vw { vw - 216.0 } else { left }
        let x = if x < 8.0 { 8.0 } else { x }
        let style = menu._get("style")
        style._set("top", @js.any((bottom + 4.0).to_string() + "px"))
        style._set("left", @js.any(x.to_string() + "px"))
      }
    _ => ()
  }
}

///|
fn menu_button(
  s : S,
  id : String,
  btn_class : String,
  label : () -> String,
  aria_label : String,
  items : Array[MenuItem],
  up~ : Bool = false,
  float~ : Bool = false,
) -> @element.DomNode {
  let is_open = fn() { s.popup.get() == id }
  let btn_attrs = [at("type", "button"), at("aria-haspopup", "menu"), at("aria-controls", id + "-menu")]
  if aria_label != "" {
    btn_attrs.push(at("aria-label", aria_label))
  }
  @element.div(
    class="menu-wrap" + (if up { " up" } else { "" }),
    attrs=[at("data-popup", id)],
  ) <| [
    @element.button(
      id=id + "-btn",
      class=btn_class,
      attrs=btn_attrs,
      dyn_attrs=[dyn("aria-expanded", fn() { is_open().to_string() })],
      on=@element.events()
        .click(fn(_e) {
          if is_open() {
            close_popup(s, false)
          } else {
            open_menu_focus(s, id, items, "first")
          }
        })
        .keydown(fn(e) {
          let ev = any_of(e)
          match key_of(ev) {
            "ArrowDown" => {
              prevent(ev)
              open_menu_focus(s, id, items, "first")
            }
            "ArrowUp" => {
              prevent(ev)
              open_menu_focus(s, id, items, "last")
            }
            _ => ()
          }
        }),
    ) <| [
      @element.text_dyn(label),
      icon(d_caret, cls="icon caret"),
    ],
    keep_mounted(is_open, fn() {
      @element.ul(
        id=id + "-menu",
        class=if float { "menu float" } else { "menu" },
        attrs=[at("role", "menu"), at("aria-labelledby", id + "-btn")],
        on=@element.events().keydown(fn(e) {
          let ev = any_of(e)
          match key_of(ev) {
            "ArrowDown" => {
              prevent(ev)
              focus_menu(s, id, "next")
            }
            "ArrowUp" => {
              prevent(ev)
              focus_menu(s, id, "prev")
            }
            "Home" => {
              prevent(ev)
              focus_menu(s, id, "first")
            }
            "End" => {
              prevent(ev)
              focus_menu(s, id, "last")
            }
            "Escape" => {
              prevent(ev)
              close_popup(s, true)
            }
            "Tab" => s.popup.set("")
            _ => ()
          }
        }),
      ) <| items.map(fn(it) {
        let attrs = [at("type", "button"), at("role", it.role), at("tabindex", "-1")]
        let dyns = if it.role == "menuitem" {
          []
        } else {
          [dyn("aria-checked", fn() { (it.checked)().to_string() })]
        }
        @element.li(attrs=[at("role", "none")]) <| [
          @element.button(
            id=it.id,
            class="menu-item",
            attrs~,
            dyn_attrs=dyns,
            on=@element.events().click(fn(_e) {
              close_popup(s, true)
              (it.act)()
            }),
          ) <| [
            @element.span(class="check", attrs=[at("aria-hidden", "true")]) <| [
              @element.text_dyn(fn() {
                if it.role != "menuitem" && (it.checked)() {
                  "✓"
                } else {
                  ""
                }
              }),
            ],
            @element.text_dyn(it.label),
          ],
        ]
      })
    }),
  ]
}

///|
fn toggle_theme(s : S) -> Unit {
  let d = !s.dark.get()
  s.dark.set(d)
  s.theme_param.val = if d { "dark" } else { "light" }
  replace_url(route_url(s, s.route.get()))
}

///|
fn settings_menu(s : S) -> @element.DomNode {
  menu_button(
    s,
    "settings",
    "footer-link menu-btn",
    fn() { "Settings" },
    "",
    [
      {
        id: "settings-search",
        role: "menuitem",
        label: fn() { "Search settings" },
        checked: fn() { false },
        act: fn() { navigate(s, { ..home_route(), view: "info", info: "settings" }) },
      },
      {
        id: "settings-dark",
        role: "menuitemcheckbox",
        label: fn() { if s.dark.get() { "Dark theme: On" } else { "Dark theme: Off" } },
        checked: fn() { s.dark.get() },
        act: fn() { toggle_theme(s) },
      },
      {
        id: "settings-advanced",
        role: "menuitem",
        label: fn() { "Advanced search" },
        checked: fn() { false },
        act: fn() { navigate(s, { ..home_route(), view: "info", info: "advanced" }) },
      },
    ],
    up=true,
  )
}

///|
fn info_route(slug : String) -> Route {
  { ..home_route(), view: "info", info: slug }
}

///|
fn info_link(s : S, label : String, slug : String, cls : String) -> @element.DomNode {
  @element.a(
    href=route_url(s, info_route(slug)),
    ref_=svg_class(cls),
    on=link_click(s, info_route(slug)),
  ) <| [t(label)]
}

///|
fn apps_button(s : S) -> @element.DomNode {
  let is_open = fn() { s.popup.get() == "apps" }
  @element.div(class="apps-wrap", attrs=[at("data-popup", "apps")]) <| [
    @element.button(
      id="apps-btn",
      class="icon-btn",
      attrs=[
        at("type", "button"),
        at("aria-label", "Findwell apps"),
        at("aria-controls", "apps-panel"),
      ],
      dyn_attrs=[dyn("aria-expanded", fn() { is_open().to_string() })],
      on=@element.events().click(fn(_e) {
        if is_open() {
          s.popup.set("")
        } else {
          s.popup.set("apps")
        }
      }),
    ) <| [icon(d_grid)],
    keep_mounted(is_open, fn() {
      @element.div(
        id="apps-panel",
        class="apps-panel",
        attrs=[at("role", "region"), at("aria-label", "Findwell apps")],
      ) <| [
        @element.ul(class="apps-grid") <| apps.map(fn(app) {
          @element.li() <| [
            @element.a(
              href=route_url(s, info_route(app.slug)),
              class="app",
              on=link_click(s, info_route(app.slug)),
            ) <| [
              @element.span(
                class="app-tile",
                style="background:\{app.hue}",
                attrs=[at("aria-hidden", "true")],
              ) <| [t(app.glyph)],
              @element.span(class="app-name") <| [t(app.name)],
            ],
          ]
        }),
      ]
    }),
  ]
}

///|
fn site_footer(s : S) -> @element.DomNode {
  @element.footer_(class="site-footer") <| [
    @element.nav(class="foot-group", attrs=[at("aria-label", "About Findwell")]) <| [
      info_link(s, "About", "about", "footer-link"),
      info_link(s, "Advertising", "advertising", "footer-link"),
      info_link(s, "Business", "business", "footer-link"),
      info_link(s, "How search works", "how", "footer-link"),
    ],
    @element.nav(class="foot-group", attrs=[at("aria-label", "Policies and settings")]) <| [
      info_link(s, "Privacy", "privacy", "footer-link"),
      info_link(s, "Terms", "terms", "footer-link"),
      settings_menu(s),
    ],
  ]
}

// ── The search box (WAI-ARIA combobox) ────────────────────────

///|
fn move_active(s : S, delta : Int) -> Unit {
  let list = (s.sugg)()
  let n = list.length()
  if n == 0 {
    return
  }
  let cur = if s.open.get() { s.active.get() } else { -1 }
  let next = if delta > 0 {
    if cur + 1 >= n { -1 } else { cur + 1 }
  } else if cur == -1 {
    n - 1
  } else {
    cur - 1
  }
  let shown = if next == -1 { s.typed.get() } else { list[next] }
  @resource.batch(fn() {
    s.open.set(true)
    s.active.set(next)
    s.text.set(shown)
  })
  match s.input.val {
    Some(i) => set_value(i, shown)
    None => ()
  }
}

///|
fn clear_box(s : S) -> Unit {
  @resource.batch(fn() {
    s.typed.set("")
    s.text.set("")
    s.open.set(false)
    s.active.set(-1)
  })
  match s.input.val {
    Some(i) => {
      set_value(i, "")
      i._call("focus", []) |> ignore
    }
    None => ()
  }
}

///|
fn search_box(s : S, compact : Bool, initial : String) -> @element.DomNode {
  let list_open = fn() { s.open.get() && !(s.sugg)().is_empty() }
  @element.form(
    class="combo" + (if compact { " compact" } else { "" }),
    attrs=[at("role", "search"), at("action", "")],
    dyn_attrs=[dyn("data-open", fn() { list_open().to_string() })],
    on=@element.events().submit(fn(e) {
      prevent(any_of(e))
      let v = match s.input.val {
        Some(i) => i._get("value").cast()
        None => s.text.get()
      }
      do_search(s, v)
    }),
  ) <| [
    @element.div(class="sbox") <| [
      icon(d_search, cls="icon lead"),
      @element.input(
        type_="text",
        id="q",
        class="q",
        value=initial,
        attrs=[
          at("role", "combobox"),
          at("aria-label", "Search"),
          at("aria-autocomplete", "list"),
          at("aria-controls", "suggestions"),
          at("autocomplete", "off"),
          at("autocapitalize", "off"),
          at("spellcheck", "false"),
          at("enterkeyhint", "search"),
          at("name", "q"),
        ],
        dyn_attrs=[dyn("aria-expanded", fn() { list_open().to_string() })],
        ref_=fn(node) { s.input.val = Some(any_of(node)) },
        on=@element.events()
          .input(fn(e) {
            let v : String = any_of(e)._get("target")._get("value").cast()
            @resource.batch(fn() {
              s.typed.set(v)
              s.text.set(v)
              s.active.set(-1)
              s.open.set(true)
              s.status.set("")
            })
          })
          .keydown(fn(e) {
            let ev = any_of(e)
            match key_of(ev) {
              "ArrowDown" => {
                prevent(ev)
                move_active(s, 1)
              }
              "ArrowUp" => {
                prevent(ev)
                move_active(s, -1)
              }
              "Escape" =>
                if list_open() {
                  prevent(ev)
                  s.open.set(false)
                  s.active.set(-1)
                } else if s.text.get() != "" {
                  prevent(ev)
                  clear_box(s)
                }
              _ => ()
            }
          })
          .blur(fn(_e) {
            s.open.set(false)
            s.active.set(-1)
          }),
      ),
      @element.show(fn() { s.text.get() != "" }, fn() {
        @element.button(
          class="icon-btn clear",
          attrs=[at("type", "button"), at("aria-label", "Clear search")],
          on=@element.events().click(fn(_e) { clear_box(s) }),
        ) <| [icon(d_close)]
      }),
      @element.span(class="sbox-rule", attrs=[at("aria-hidden", "true")]) <| [],
      @element.button(
        class="icon-btn voice",
        attrs=[at("type", "button"), at("aria-label", "Search by voice")],
        on=@element.events().click(fn(_e) {
          s.status.set("Voice search isn't part of this demo. Type your search instead.")
        }),
      ) <| [icon(d_mic)],
      @element.button(
        class="icon-btn camera",
        attrs=[at("type", "button"), at("aria-label", "Search by image")],
        on=@element.events().click(fn(_e) {
          s.status.set("Image search isn't part of this demo. Type your search instead.")
        }),
      ) <| [icon(d_camera)],
    ],
    keep_mounted(list_open, fn() {
      @element.ul(
        id="suggestions",
        class="suggestions",
        attrs=[at("role", "listbox"), at("aria-label", "Suggestions")],
      ) <| [
        // index_each, not for_each: rows are positions in the list (sugg-0 … sugg-7), and
        // for_each's index argument went stale as the list changed under typing.
        @element.index_each(fn() { (s.sugg)() }, fn(get, i) {
          let cut = fn() {
            let item = get()
            let typed = s.typed.get().to_lower().trim().to_string()
            if typed == "" {
              item.length()
            } else if item.has_prefix(typed) {
              typed.length()
            } else {
              0
            }
          }
          @element.li(
            id="sugg-\{i}",
            attrs=[at("role", "option")],
            dyn_class=fn() { if s.active.get() == i { "sugg active" } else { "sugg" } },
            dyn_attrs=[dyn("aria-selected", fn() { (s.active.get() == i).to_string() })],
            on=@element.events()
              .mousedown(fn(e) { prevent(any_of(e)) })
              .click(fn(_e) { do_search(s, get()) }),
          ) <| [
            icon(d_search, cls="icon sugg-icon"),
            @element.span(class="sugg-text") <| [
              @element.span() <| [
                @element.text_dyn(fn() { get().view(end_offset=cut()).to_string() }),
              ],
              el("b", [], [@element.text_dyn(fn() { get().view(start_offset=cut()).to_string() })]),
            ],
          ]
        }),
      ]
    }),
  ]
}

///|
fn status_line(s : S) -> @element.DomNode {
  @element.p(class="status", attrs=[at("role", "status")]) <| [
    @element.text_dyn(fn() { s.status.get() }),
  ]
}

// ── Home view ─────────────────────────────────────────────────

///|
fn topbar(s : S) -> @element.DomNode {
  @element.header_(class="topbar") <| [
    @element.nav(class="top-links", attrs=[at("aria-label", "Findwell services")]) <| [
      info_link(s, "Mail", "mail", "top-link"),
      info_link(s, "Images", "images", "top-link"),
    ],
    apps_button(s),
    info_link(s, "Sign in", "signin", "signin"),
  ]
}

///|
fn home_view(s : S) -> @element.DomNode {
  @element.div(class="view home") <| [
    topbar(s),
    @element.main_(id="main", class="home-main") <| [
      @element.h1(class="home-title") <| [
        wordmark("big"),
        @element.span(class="sr-only") <| [t("Findwell")],
      ],
      search_box(s, false, ""),
      @element.div(class="home-buttons") <| [
        @element.button(
          class="grey-btn",
          attrs=[at("type", "button")],
          on=@element.events().click(fn(_e) {
            let v = match s.input.val {
              Some(i) => i._get("value").cast()
              None => s.text.get()
            }
            do_search(s, v)
          }),
        ) <| [t("Findwell Search")],
        @element.button(
          class="grey-btn",
          attrs=[at("type", "button")],
          on=@element.events().click(fn(_e) { lucky(s) }),
        ) <| [t("Feeling Lucky")],
      ],
      status_line(s),
    ],
    site_footer(s),
  ]
}

// ── Results view ──────────────────────────────────────────────

///|
let tabs : Array[(String, String)] = [
  ("all", "All"),
  ("images", "Images"),
  ("news", "News"),
  ("videos", "Videos"),
  ("maps", "Maps"),
]

///|
fn tab_link(s : S, id : String, label : String) -> @element.DomNode {
  let r = fn() { results_route(s.route.get().q, id, 1) }
  @element.a(
    href=route_url(s, results_route(@resource.untracked(fn() { s.route.get().q }), id, 1)),
    class="tab",
    dyn_attrs=[
      dyn("aria-current", fn() {
        if s.route.get().tab == id {
          "page"
        } else {
          "false"
        }
      }),
      dyn("href", fn() { route_url(s, r()) }),
    ],
    on=@element.events().click(fn(e) {
      prevent(any_of(e))
      navigate(s, r())
    }),
  ) <| [t(label)]
}

///|
fn more_menu(s : S) -> @element.DomNode {
  let pick = fn(tab : String) {
    fn() { navigate(s, results_route(s.route.get().q, tab, 1)) }
  }
  menu_button(
    s,
    "more",
    "tab menu-btn",
    fn() {
      match s.route.get().tab {
        "books" => "Books"
        "shopping" => "Shopping"
        _ => "More"
      }
    },
    "",
    float=true,
    [
      {
        id: "more-books",
        role: "menuitemradio",
        label: fn() { "Books" },
        checked: fn() { s.route.get().tab == "books" },
        act: pick("books"),
      },
      {
        id: "more-shopping",
        role: "menuitemradio",
        label: fn() { "Shopping" },
        checked: fn() { s.route.get().tab == "shopping" },
        act: pick("shopping"),
      },
    ],
  )
}

///|
fn tools_row(s : S) -> @element.DomNode {
  let time_item = fn(id : String, v : String, label : String) -> MenuItem {
    {
      id: "time-" + id,
      role: "menuitemradio",
      label: fn() { label },
      checked: fn() { s.time.get() == v },
      act: fn() { s.time.set(v) },
    }
  }
  @element.div(id="tools-row", class="tools-row", attrs=[at("role", "group"), at("aria-label", "Search tools")]) <| [
    menu_button(
      s,
      "time",
      "chip-btn menu-btn",
      fn() {
        match s.time.get() {
          "week" => "Past week"
          "month" => "Past month"
          "year" => "Past year"
          _ => "Any time"
        }
      },
      "",
      [
        time_item("any", "any", "Any time"),
        time_item("week", "week", "Past week"),
        time_item("month", "month", "Past month"),
        time_item("year", "year", "Past year"),
      ],
    ),
    menu_button(
      s,
      "verb",
      "chip-btn menu-btn",
      fn() { if s.verbatim.get() { "Verbatim" } else { "All results" } },
      "",
      [
        {
          id: "verb-all",
          role: "menuitemradio",
          label: fn() { "All results" },
          checked: fn() { !s.verbatim.get() },
          act: fn() { s.verbatim.set(false) },
        },
        {
          id: "verb-exact",
          role: "menuitemradio",
          label: fn() { "Verbatim" },
          checked: fn() { s.verbatim.get() },
          act: fn() { s.verbatim.set(true) },
        },
      ],
    ),
    @element.show(fn() { s.time.get() != "any" || s.verbatim.get() }, fn() {
      @element.button(
        class="text-btn",
        attrs=[at("type", "button")],
        on=@element.events().click(fn(_e) {
          s.time.set("any")
          s.verbatim.set(false)
        }),
      ) <| [t("Clear")]
    }),
  ]
}

///|
fn crumbs(p : Page) -> String {
  ([p.domain] + p.path).join(" › ")
}

///|
fn leave_route(q : String, id : Int) -> Route {
  { view: "leave", q, tab: "all", page: 1, go: id, info: "" }
}

///|
fn snippet_nodes(text : String, q : String) -> Array[@element.DomNode] {
  let toks = tokens(q)
  bold_runs(text, toks).map(fn(r) { if r.1 { el("b", [], [t(r.0)]) } else { t(r.0) } })
}

///|
fn favicon(p : Page) -> @element.DomNode {
  let hues = ["#2f5fd0", "#0b7a45", "#b4560b", "#7442c8", "#c2185b", "#00677f"]
  let h = hues[p.domain.length() % hues.length()]
  @element.span(class="favicon", style="background:\{h}", attrs=[at("aria-hidden", "true")]) <| [
    t(p.site.view(end_offset=1).to_string()),
  ]
}

///|
fn result_item(s : S, p : Page, q : String) -> @element.DomNode {
  let go = leave_route(q, p.id)
  let visit = fn() {
    if !s.visited.get().contains(p.id) {
      s.visited.update(fn(v) { v + [p.id] })
    }
  }
  let head = @element.div(class="r-source") <| [
    favicon(p),
    @element.div(class="r-cite") <| [
      @element.span(class="r-site") <| [t(p.site)],
      el("cite", [("class", "r-url")], [t(crumbs(p))]),
    ],
    @element.button(
      class="icon-btn r-more",
      attrs=[at("type", "button"), at("aria-label", "About this result: " + p.site)],
      on=@element.events().click(fn(_e) {
        s.about.set(p.id)
        dialog_open("about-dialog")
      }),
    ) <| [icon(d_dots)],
  ]
  let snippet_kids : Array[@element.DomNode] = []
  if p.date != "" {
    snippet_kids.push(@element.span(class="r-date") <| [t(p.date + " — ")])
  }
  snippet_kids.append(snippet_nodes(p.snippet, q))
  let kids = [
    head,
    @element.h3(class="r-h") <| [
      @element.a(
        href=route_url(s, go),
        class="r-title",
        dyn_class=fn() { if s.visited.get().contains(p.id) { "r-title visited" } else { "r-title" } },
        on=@element.events().click(fn(e) {
          prevent(any_of(e))
          visit()
          navigate(s, go)
        }),
      ) <| [t(p.title)],
    ],
    @element.p(class="r-snippet") <| snippet_kids,
  ]
  if !p.links.is_empty() {
    kids.push(
      @element.ul(class="sitelinks", attrs=[at("aria-label", "More from " + p.site)]) <| p.links.map(fn(l) {
        @element.li() <| [
          @element.a(
            href=route_url(s, go),
            class="sitelink",
            on=@element.events().click(fn(e) {
              prevent(any_of(e))
              visit()
              navigate(s, go)
            }),
          ) <| [t(l)],
        ]
      }),
    )
  }
  @element.article(class="result" + (if p.links.is_empty() { "" } else { " has-links" })) <| kids
}

///|
fn paa(s : S, topic : String) -> @element.DomNode {
  let qs = questions(topic)
  let shown = fn() {
    let n = 4 + s.paa_extra.get()
    if n > qs.length() { qs.length() } else { n }
  }
  @element.section(class="paa", attrs=[at("aria-labelledby", "paa-h")]) <| [
    @element.h2(id="paa-h", class="block-h") <| [t("People also ask")],
    @element.div(class="paa-list") <| [
      @element.for_each(fn() { qs[0:shown()].to_array() }, fn(item, i) {
        let is_open = fn() { s.paa_open.get().contains(i) }
        @element.div(class="paa-item") <| [
          @element.h3(class="paa-q") <| [
            @element.button(
              id="paa-b\{i}",
              class="paa-btn",
              attrs=[at("type", "button"), at("aria-controls", "paa-a\{i}")],
              dyn_attrs=[dyn("aria-expanded", fn() { is_open().to_string() })],
              on=@element.events().click(fn(_e) {
                if is_open() {
                  s.paa_open.update(fn(v) { v.filter(fn(x) { x != i }) })
                } else {
                  @resource.batch(fn() {
                    s.paa_open.update(fn(v) { v + [i] })
                    // Each opening adds one more question, two at most.
                    if s.paa_extra.get() < 2 {
                      s.paa_extra.update(fn(n) { n + 1 })
                    }
                  })
                }
              }),
            ) <| [
              @element.span() <| [t(item.q)],
              icon(d_caret, cls="icon caret"),
            ],
          ],
          keep_mounted(is_open, fn() {
            @element.div(
              id="paa-a\{i}",
              class="paa-a",
              attrs=[at("role", "region"), at("aria-labelledby", "paa-b\{i}")],
            ) <| [@element.p() <| [t(item.a)]]
          }),
        ]
      }),
    ],
  ]
}

///|
fn related_block(s : S, topic : String) -> @element.DomNode {
  @element.section(class="related", attrs=[at("aria-labelledby", "rel-h")]) <| [
    @element.h2(id="rel-h", class="block-h") <| [t("Related searches")],
    @element.ul(class="chips") <| related(topic).map(fn(r) {
      @element.li() <| [
        @element.a(
          href=route_url(s, results_route(r, "all", 1)),
          class="chip",
          on=link_click(s, results_route(r, "all", 1)),
        ) <| [icon(d_search, cls="icon chip-icon"), t(r)],
      ]
    }),
  ]
}

///|
fn pager(s : S, q : String, tab : String, page : Int) -> @element.DomNode {
  let cell = fn(n : Int) -> @element.DomNode {
    if n == page {
      @element.span(class="pg cur", attrs=[at("aria-current", "page")]) <| [
        @element.span(class="pg-l", attrs=[at("aria-hidden", "true")]) <| [t("e")],
        @element.span(class="pg-n") <| [t(n.to_string())],
      ]
    } else {
      let r = results_route(q, tab, n)
      @element.a(
        href=route_url(s, r),
        class="pg",
        attrs=[at("aria-label", "Page \{n}")],
        on=link_click(s, r),
      ) <| [
        @element.span(class="pg-l", attrs=[at("aria-hidden", "true")]) <| [t("e")],
        @element.span(class="pg-n") <| [t(n.to_string())],
      ]
    }
  }
  let kids : Array[@element.DomNode] = []
  if page > 1 {
    let r = results_route(q, tab, page - 1)
    kids.push(
      @element.a(href=route_url(s, r), class="pg-step", on=link_click(s, r)) <| [
        t("Previous"),
      ],
    )
  }
  kids.push(
    @element.span(class="pg-word") <| [
      ..["F", "i", "n", "d", "w"].mapi(fn(i, c) {
        @element.span(class="pg-fixed wm\{i}", attrs=[at("aria-hidden", "true")]) <| [t(c)]
      }),
      ..[1, 2, 3, 4, 5].map(cell),
      @element.span(class="pg-fixed wm6", attrs=[at("aria-hidden", "true")]) <| [t("l")],
      @element.span(class="pg-fixed wm7", attrs=[at("aria-hidden", "true")]) <| [t("l")],
    ],
  )
  if page < 5 {
    let r = results_route(q, tab, page + 1)
    kids.push(
      @element.a(href=route_url(s, r), class="pg-step next", on=link_click(s, r)) <| [
        t("Next"),
        icon(d_chevron, cls="icon"),
      ],
    )
  }
  @element.nav(class="pager", attrs=[at("aria-label", "Result pages")]) <| kids
}

///|
fn thumb(p : Page, cls : String) -> @element.DomNode {
  // Three drawings per topic, picked by page id, with the sky or ground tinted by id too,
  // so neighbouring tiles in the Images grid never look alike.
  let v = p.id % 3
  let tint = ["#14213d", "#1b2a4a", "#22223b", "#102a43"][p.id % 4]
  let warm = ["#e8d8c3", "#efe1cf", "#e3d3bd", "#f2e6d8"][p.id % 4]
  let leaf = ["#cfe3d6", "#d8e8cf", "#c9dfe3", "#e0e7cf"][p.id % 4]
  let shapes : Array[@element.DomNode] = match (p.topic, v) {
    ("moon", 0) => [
      @element.svg_rect(width="160", height="100", fill=tint),
      @element.svg_circle(cx="58", cy="40", r="22", fill="#e9e4d4"),
      @element.svg_circle(cx="66", cy="34", r="20", fill=tint),
      @element.svg_path(d="M0 80 Q40 66 80 78 T160 74 V100 H0Z", fill="#8d8a80"),
      @element.svg_circle(cx="120", cy="20", r="1.5", fill="#fff"),
      @element.svg_circle(cx="20", cy="14", r="1.2", fill="#fff"),
    ]
    ("moon", 1) => [
      @element.svg_rect(width="160", height="100", fill=tint),
      @element.svg_circle(cx="80", cy="50", r="36", fill="#d9d4c5"),
      @element.svg_circle(cx="66", cy="40", r="8", fill="#bdb7a6"),
      @element.svg_circle(cx="92", cy="62", r="11", fill="#bdb7a6"),
      @element.svg_circle(cx="94", cy="34", r="5", fill="#bdb7a6"),
      @element.svg_circle(cx="24", cy="22", r="1.4", fill="#fff"),
      @element.svg_circle(cx="140", cy="80", r="1.2", fill="#fff"),
    ]
    ("moon", _) => [
      @element.svg_rect(width="160", height="100", fill="#0d1321"),
      @element.svg_path(d="M0 72 Q80 60 160 70 V100 H0Z", fill="#9a978d"),
      @element.svg_path(d="M64 54 H96 L100 64 H60Z", fill="#c9a227"),
      @element.svg_rect(x="70", y="42", width="20", height="12", rx="2", fill="#d9d9d9"),
      @element.svg_path(d="M62 64 L54 76 M98 64 L106 76", stroke="#d9d9d9", stroke_width="2.5"),
      @element.svg_circle(cx="130", cy="24", r="10", fill="#3d7bd9"),
    ]
    ("coffee", 0) => [
      @element.svg_rect(width="160", height="100", fill=warm),
      @element.svg_path(d="M52 40 H108 L100 84 H60Z", fill="#6f4a2f"),
      @element.svg_path(d="M108 48 q16 2 12 16 q-4 10 -16 8", fill="none", stroke="#6f4a2f", stroke_width="5"),
      @element.svg_rect(x="44", y="84", width="72", height="6", rx="3", fill="#4a3020"),
      @element.svg_path(d="M70 30 q-6 -8 0 -16 M84 30 q-6 -8 0 -16", fill="none", stroke="#a3876d", stroke_width="3"),
    ]
    ("coffee", 1) => [
      @element.svg_rect(width="160", height="100", fill="#f4efe8"),
      @element.svg_path(d="M50 14 H110 L88 50 H72Z", fill="#e7e2da", stroke="#b9a58e", stroke_width="2"),
      @element.svg_rect(x="66", y="50", width="28", height="6", fill="#b9a58e"),
      @element.svg_path(d="M80 58 V66", stroke="#6f4a2f", stroke_width="3"),
      @element.svg_path(d="M58 68 H102 L98 92 H62Z", fill="none", stroke="#8a6a50", stroke_width="3"),
      @element.svg_rect(x="62", y="80", width="36", height="11", fill="#6f4a2f"),
    ]
    ("coffee", _) => [
      @element.svg_rect(width="160", height="100", fill="#5b3a26"),
      @element.svg_ellipse(cx="44", cy="40", rx="14", ry="10", fill="#2f1d12"),
      @element.svg_ellipse(cx="86", cy="30", rx="14", ry="10", fill="#3a2416"),
      @element.svg_ellipse(cx="120", cy="58", rx="14", ry="10", fill="#2f1d12"),
      @element.svg_ellipse(cx="64", cy="72", rx="14", ry="10", fill="#3a2416"),
      @element.svg_path(d="M34 40 Q44 34 54 40 M76 30 Q86 24 96 30 M110 58 Q120 52 130 58 M54 72 Q64 66 74 72", fill="none", stroke="#8a5a3a", stroke_width="2"),
    ]
    ("trail", 0) => [
      @element.svg_rect(width="160", height="100", fill=leaf),
      @element.svg_path(d="M0 80 L40 34 L64 58 L96 22 L160 82 V100 H0Z", fill="#3f6b4f"),
      @element.svg_path(d="M86 34 L96 22 L106 36Z", fill="#f3f3f3"),
      @element.svg_path(d="M10 98 Q60 72 90 86 T150 70", fill="none", stroke="#b78a4f", stroke_width="4"),
    ]
    ("trail", 1) => [
      @element.svg_rect(width="160", height="100", fill="#e9eef2"),
      @element.svg_path(d="M30 70 Q34 46 58 44 L82 52 Q104 56 124 62 Q136 66 134 76 H30Z", fill="#d2572d"),
      @element.svg_rect(x="28", y="76", width="108", height="8", rx="3", fill="#2f3b45"),
      @element.svg_path(d="M36 84 V88 M52 84 V88 M68 84 V88 M84 84 V88 M100 84 V88 M116 84 V88", stroke="#2f3b45", stroke_width="4"),
      @element.svg_path(d="M60 48 L70 58 M68 46 L78 56 M76 48 L86 58", stroke="#fff", stroke_width="2"),
    ]
    ("trail", _) => [
      @element.svg_rect(width="160", height="100", fill="#dce9d5"),
      @element.svg_path(d="M60 100 Q78 60 72 40 Q70 30 80 20 L86 20 Q78 32 82 44 Q90 66 76 100Z", fill="#c8a36b"),
      @element.svg_path(d="M20 70 L32 40 L44 70Z M120 76 L134 40 L148 76Z M100 50 L110 26 L120 50Z", fill="#2f6b46"),
      @element.svg_path(d="M4 60 L14 36 L24 60Z", fill="#3f7b56"),
    ]
    (_, 0) => [
      @element.svg_rect(width="160", height="100", fill="#1e2a3a"),
      @element.svg_rect(x="18", y="22", width="60", height="6", rx="3", fill="#7fb4ff"),
      @element.svg_rect(x="30", y="38", width="84", height="6", rx="3", fill="#9be2b4"),
      @element.svg_rect(x="30", y="54", width="50", height="6", rx="3", fill="#ffc98b"),
      @element.svg_rect(x="18", y="70", width="30", height="6", rx="3", fill="#7fb4ff"),
    ]
    (_, 1) => [
      @element.svg_rect(width="160", height="100", fill="#eef1f6"),
      @element.svg_path(d="M62 24 Q48 24 48 38 V44 Q48 50 40 50 Q48 50 48 56 V62 Q48 76 62 76", fill="none", stroke="#3d5a80", stroke_width="6", stroke_linecap="round"),
      @element.svg_path(d="M98 24 Q112 24 112 38 V44 Q112 50 120 50 Q112 50 112 56 V62 Q112 76 98 76", fill="none", stroke="#3d5a80", stroke_width="6", stroke_linecap="round"),
      @element.svg_circle(cx="80", cy="50", r="7", fill="#d2572d"),
    ]
    (_, _) => [
      @element.svg_rect(width="160", height="100", fill="#2b2d42"),
      @element.svg_rect(x="16", y="16", width="128", height="68", rx="6", fill="#111320"),
      @element.svg_circle(cx="26", cy="24", r="3", fill="#ff6b6b"),
      @element.svg_circle(cx="36", cy="24", r="3", fill="#ffd166"),
      @element.svg_circle(cx="46", cy="24", r="3", fill="#06d6a0"),
      @element.svg_path(d="M28 44 L38 52 L28 60", fill="none", stroke="#9be2b4", stroke_width="3"),
      @element.svg_rect(x="44", y="58", width="30", height="4", fill="#9be2b4"),
    ]
  }
  @element.svg(
    viewBox="0 0 160 100",
    ref_=svg_class(cls),
    attrs=[at("aria-hidden", "true"), at("focusable", "false"), at("preserveAspectRatio", "xMidYMid slice")],
  ) <| shapes
}

///|
fn images_grid(s : S, found : Array[Page], q : String) -> @element.DomNode {
  @element.ul(class="img-grid") <| found.map(fn(p) {
    let go = leave_route(q, p.id)
    @element.li(class="img-cell") <| [
      @element.a(
        href=route_url(s, go),
        class="img-link",
        on=@element.events().click(fn(e) {
          prevent(any_of(e))
          if !s.visited.get().contains(p.id) {
            s.visited.update(fn(v) { v + [p.id] })
          }
          navigate(s, go)
        }),
      ) <| [
        thumb(p, "img-thumb"),
        @element.span(class="img-site") <| [favicon(p), t(p.site)],
        @element.span(class="img-title") <| [t(p.title)],
      ],
    ]
  })
}

///|
fn knowledge_panel(s : S) -> @element.DomNode {
  let rows = [
    ("Date", "20 July 1969"),
    ("Landing site", "Sea of Tranquillity"),
    ("Crew", "3 (2 on the surface)"),
    ("Time on the surface", "21 hours, 36 minutes"),
    ("Moonwalk", "About 2 hours, 31 minutes"),
  ]
  @element.aside(
    dyn_class=fn() { if s.kp_more.get() { "kp kp-open" } else { "kp" } },
    attrs=[at("aria-labelledby", "kp-h")],
  ) <| [
    @element.svg(
      viewBox="0 0 360 170",
      ref_=svg_class("kp-img"),
      attrs=[at("role", "img"), at("preserveAspectRatio", "xMidYMid slice"), at("aria-label", "Drawing of a lander on the grey lunar surface under a black sky, with Earth rising")],
    ) <| [
      @element.svg_rect(width="360", height="170", fill="#0d1321"),
      @element.svg_circle(cx="296", cy="42", r="20", fill="#3d7bd9"),
      @element.svg_path(d="M284 34 q8 -6 14 2 q-6 6 -2 12 q-8 2 -12 -6Z", fill="#4f9d69"),
      @element.svg_circle(cx="40", cy="30", r="1.4", fill="#fff"),
      @element.svg_circle(cx="120", cy="18", r="1.2", fill="#fff"),
      @element.svg_circle(cx="200", cy="40", r="1", fill="#fff"),
      @element.svg_path(d="M0 128 Q90 110 180 124 T360 118 V170 H0Z", fill="#9a978d"),
      @element.svg_path(d="M0 150 Q120 138 240 150 T360 146 V170 H0Z", fill="#7c796f"),
      @element.svg_ellipse(cx="70", cy="152", rx="18", ry="4", fill="#6c695f"),
      // lander
      @element.svg_path(d="M150 96 L210 96 L216 116 L144 116Z", fill="#c9a227"),
      @element.svg_rect(x="160", y="76", width="40", height="22", rx="3", fill="#d9d9d9"),
      @element.svg_path(d="M150 116 L136 136 M210 116 L224 136 M164 116 L160 136 M196 116 L200 136", stroke="#d9d9d9", stroke_width="3"),
      @element.svg_path(d="M130 136 H142 M218 136 H230", stroke="#d9d9d9", stroke_width="3"),
      // flag
      @element.svg_line(x1="252", y1="84", x2="252", y2="134", stroke="#e6e6e6", stroke_width="2"),
      @element.svg_rect(x="253", y="84", width="26", height="16", fill="#e6e6e6"),
    ],
    @element.div(class="kp-body") <| [
      @element.h2(id="kp-h", class="kp-title") <| [t("Moon landing")],
      @element.p(class="kp-sub") <| [t("First crewed landing on the Moon, 1969")],
      // On phones the description and facts fold behind a button, so results show on the first screen.
      @element.button(
        class="kp-toggle",
        attrs=[at("type", "button"), at("aria-controls", "kp-more")],
        dyn_attrs=[dyn("aria-expanded", fn() { s.kp_more.get().to_string() })],
        on=@element.events().click(fn(_e) { s.kp_more.update(fn(v) { !v }) }),
      ) <| [
        @element.text_dyn(fn() { if s.kp_more.get() { "Show less" } else { "More about Moon landing" } }),
        icon(d_caret, cls="icon caret"),
      ],
      @element.div(id="kp-more", class="kp-more") <| [
        @element.p(class="kp-desc") <| [
          t("A Moon landing is the arrival of a spacecraft on the surface of the Moon. The first crewed landing set down in the Sea of Tranquillity, and two of its three crew walked on the surface while the third stayed in orbit."),
        ],
        el("table", [("class", "kp-facts")], [
          el("tbody", [], rows.map(fn(r) {
            el("tr", [], [el("th", [("scope", "row")], [t(r.0)]), el("td", [], [t(r.1)])])
          })),
        ]),
      ],
    ],
  ]
}

///|
fn about_dialog(s : S) -> @element.DomNode {
  let page_of = fn() {
    let id = s.about.get()
    let mut found : Page? = None
    for p in pages {
      if p.id == id {
        found = Some(p)
      }
    }
    found
  }
  @element.create_element(
    "dialog",
    [
      ("id", @element.attr_static("about-dialog")),
      ("class", @element.attr_static("about")),
      ("aria-labelledby", @element.attr_static("about-h")),
      (
        "click",
        @element.attr_handler(fn(e) {
          // A click on the backdrop lands on the dialog itself.
          let target = e._get("target")
          if (target._get("id").cast() : String) == "about-dialog" {
            dialog_close("about-dialog")
          }
        }),
      ),
    ],
    [
      @element.div(class="about-inner") <| [
        @element.h2(id="about-h", class="about-h") <| [t("About this result")],
        @element.div(class="about-src") <| [
          @element.span(class="favicon big", attrs=[at("aria-hidden", "true")]) <| [
            @element.text_dyn(fn() {
              match page_of() {
                Some(p) => p.site.view(end_offset=1).to_string()
                None => ""
              }
            }),
          ],
          @element.div() <| [
            @element.p(class="about-site") <| [
              @element.text_dyn(fn() {
                match page_of() {
                  Some(p) => p.site
                  None => ""
                }
              }),
            ],
            @element.p(class="about-domain") <| [
              @element.text_dyn(fn() {
                match page_of() {
                  Some(p) => p.domain
                  None => ""
                }
              }),
            ],
          ],
        ],
        @element.p(class="about-desc") <| [
          @element.text_dyn(fn() {
            match page_of() {
              Some(p) => p.about
              None => ""
            }
          }),
        ],
        @element.p(class="about-note") <| [
          t("Findwell found this page because it matches words in your search. Every source here is fictional."),
        ],
        @element.form(attrs=[at("method", "dialog")], class="about-actions") <| [
          @element.button(class="grey-btn", attrs=[at("type", "submit")]) <| [t("Close")],
        ],
      ],
    ],
  )
}

///|
fn results_body(s : S) -> @element.DomNode {
  let all = @resource.memo(fn() {
    let r = s.route.get()
    search(r.q, s.verbatim.get()).filter(fn(p) { within(p, s.time.get()) })
  })
  let listed = @resource.memo(fn() {
    let r = s.route.get()
    let k = tab_kind(r.tab)
    if r.tab == "all" || r.tab == "images" {
      all()
    } else {
      all().filter(fn(p) { p.kind == k })
    }
  })
  let per = 5
  let page_items = @resource.memo(fn() {
    let r = s.route.get()
    let list = listed()
    let from = (r.page - 1) * per
    if from >= list.length() {
      []
    } else {
      let to = if from + per > list.length() { list.length() } else { from + per }
      list[from:to].to_array()
    }
  })
  let topic = @resource.memo(fn() {
    let a = all()
    if a.is_empty() {
      ""
    } else {
      a[0].topic
    }
  })
  let has_kp = fn() {
    let r = s.route.get()
    normalize(r.q).has_prefix("moon land") && r.tab == "all" && r.page == 1
  }
  @element.div(class="r-layout", dyn_class=fn() { if has_kp() { "r-layout with-kp" } else { "r-layout" } }) <| [
    @element.show(has_kp, fn() { knowledge_panel(s) }),
    @element.div(class="r-main") <| [
      @element.p(class="r-stats", attrs=[at("role", "status")]) <| [
        @element.text_dyn(fn() {
          let r = s.route.get()
          if listed().is_empty() {
            ""
          } else {
            stats_for(r.q, listed().length(), r.page)
          }
        }),
      ],
      @element.show(fn() { listed().is_empty() }, fn() {
        @element.div(class="empty") <| [
          @element.p(class="empty-lead") <| [
            t("Your search – "),
            el("b", [], [@element.text_dyn(fn() { s.route.get().q })]),
            @element.text_dyn(fn() {
              let r = s.route.get()
              let what = match r.tab {
                "all" => ""
                "images" => " in Images"
                "news" => " in News"
                "videos" => " in Videos"
                "maps" => " in Maps"
                "books" => " in Books"
                _ => " in Shopping"
              }
              " – did not match any documents" + what + "."
            }),
          ],
          @element.p() <| [t("Suggestions:")],
          @element.ul(class="empty-tips") <| [
            @element.li() <| [t("Make sure that all words are spelled correctly.")],
            @element.li() <| [t("Try different keywords.")],
            @element.li() <| [t("Try more general keywords.")],
            @element.li() <| [
              @element.text_dyn(fn() {
                if s.time.get() != "any" || s.verbatim.get() {
                  "Clear the Tools filters."
                } else {
                  "Try one of these searches, which have full results:"
                }
              }),
            ],
          ],
          @element.ul(class="chips") <| ["moon landing", "pour over coffee", "trail running shoes"].map(fn(r) {
            @element.li() <| [
              @element.a(
                href=route_url(s, results_route(r, "all", 1)),
                class="chip",
                on=link_click(s, results_route(r, "all", 1)),
              ) <| [icon(d_search, cls="icon chip-icon"), t(r)],
            ]
          }),
        ]
      }),
      @element.show(fn() { !listed().is_empty() && page_items().is_empty() && s.route.get().tab != "images" }, fn() {
        @element.div(class="empty") <| [
          @element.p(class="empty-lead") <| [
            @element.text_dyn(fn() {
              "There is nothing more for “\{s.route.get().q}” on page \{s.route.get().page}."
            }),
          ],
          @element.p() <| [
            @element.a(
              class="plain-link",
              dyn_attrs=[dyn("href", fn() { route_url(s, results_route(s.route.get().q, s.route.get().tab, 1)) })],
              on=@element.events().click(fn(e) {
                prevent(any_of(e))
                let r = s.route.get()
                navigate(s, results_route(r.q, r.tab, 1))
              }),
            ) <| [t("Back to the first page of results")],
          ],
        ]
      }),
      @element.show(fn() { s.route.get().tab == "images" && !listed().is_empty() }, fn() {
        @element.div(class="img-wrap") <| [
          @element.for_each(fn() { [listed()] }, fn(list, _i) { images_grid(s, list, s.route.get().q) }),
        ]
      }),
      @element.show(fn() { s.route.get().tab != "images" && !page_items().is_empty() }, fn() {
        @element.div(class="r-list") <| [
          @element.for_each(page_items, fn(p, i) {
            let q = s.route.get().q
            let show_paa = i == 1 && s.route.get().tab == "all" && s.route.get().page == 1
            if show_paa {
              @element.fragment([result_item(s, p, q), paa(s, topic())])
            } else {
              result_item(s, p, q)
            }
          }),
        ]
      }),
      @element.show(fn() { topic() != "" && s.route.get().tab != "images" }, fn() {
        @element.for_each(fn() { [topic()] }, fn(tp, _i) { related_block(s, tp) })
      }),
      @element.show(fn() { !listed().is_empty() && s.route.get().tab != "images" }, fn() {
        @element.for_each(fn() { [s.route.get()] }, fn(r, _i) { pager(s, r.q, r.tab, r.page) })
      }),
    ],
  ]
}

///|
fn results_view(s : S) -> @element.DomNode {
  let initial = @resource.untracked(fn() { s.route.get().q })
  @element.div(class="view results") <| [
    @element.header_(class="r-header") <| [
      @element.a(
        href=route_url(s, home_route()),
        class="home-link",
        attrs=[at("aria-label", "Findwell home")],
        on=link_click(s, home_route()),
      ) <| [wordmark("small")],
      search_box(s, true, initial),
      @element.a(
        href=route_url(s, info_route("signin")),
        class="avatar",
        attrs=[at("aria-label", "Your account")],
        on=link_click(s, info_route("signin")),
      ) <| [@element.span(attrs=[at("aria-hidden", "true")]) <| [t("R")]],
    ],
    @element.nav(class="tabs", attrs=[at("aria-label", "Result types")]) <| [
      @element.div(class="tabs-scroll") <| [
        ..tabs.map(fn(x) { tab_link(s, x.0, x.1) }),
        more_menu(s),
        @element.button(
          class="tab tools-btn",
          attrs=[at("type", "button"), at("aria-controls", "tools-row")],
          dyn_attrs=[dyn("aria-expanded", fn() { s.tools.get().to_string() })],
          on=@element.events().click(fn(_e) { s.tools.update(fn(v) { !v }) }),
        ) <| [icon(d_tune, cls="icon"), t("Tools")],
      ],
    ],
    keep_mounted(fn() { s.tools.get() }, fn() { tools_row(s) }),
    status_line(s),
    @element.main_(id="main", class="r-page") <| [
      @element.h1(class="sr-only") <| [
        @element.text_dyn(fn() { "Search results for " + s.route.get().q }),
      ],
      results_body(s),
    ],
    about_dialog(s),
    site_footer(s),
  ]
}

// ── Leave and info pages ──────────────────────────────────────

///|
fn back_bar(s : S, label : String, fallback : Route) -> @element.DomNode {
  @element.a(
    href=route_url(s, fallback),
    class="back-link",
    on=@element.events().click(fn(e) {
      prevent(any_of(e))
      go_back_or(s, fallback)
    }),
  ) <| [icon(d_back, cls="icon"), t(label)]
}

///|
fn leave_view(s : S) -> @element.DomNode {
  let r = @resource.untracked(fn() { s.route.get() })
  let mut target : Page? = None
  for p in pages {
    if p.id == r.go {
      target = Some(p)
    }
  }
  let fallback = if r.q != "" { results_route(r.q, "all", 1) } else { home_route() }
  @element.div(class="view simple") <| [
    @element.header_(class="simple-header") <| [
      @element.a(
        href=route_url(s, home_route()),
        class="home-link",
        attrs=[at("aria-label", "Findwell home")],
        on=link_click(s, home_route()),
      ) <| [wordmark("small")],
    ],
    @element.main_(id="main", class="simple-main") <| [
      match target {
        Some(p) => @element.div(class="leave") <| [
          favicon(p),
          @element.h1(class="leave-h") <| [
            t("You would now leave Findwell for "),
            @element.span(class="nowrap") <| [t(p.domain)],
          ],
          @element.p(class="leave-title") <| [t(p.title)],
          @element.p(class="leave-note") <| [
            t("Every site in Findwell's index is fictional, so this is as far as the link goes."),
          ],
          back_bar(s, "Back", fallback),
        ]
        None => @element.div(class="leave") <| [
          @element.h1(class="leave-h") <| [t("That page is not in Findwell's index")],
          back_bar(s, "Back", fallback),
        ]
      },
    ],
  ]
}

///|
fn info_view(s : S) -> @element.DomNode {
  let r = @resource.untracked(fn() { s.route.get() })
  let mut title = ""
  let mut body = ""
  for i in infos {
    if i.slug == r.info {
      title = i.title
      body = i.body
    }
  }
  for a in apps {
    if a.slug == r.info && title == "" {
      title = "Findwell " + a.name
      body = "Findwell " + a.name + " is one of the fictional apps in this demo. It has no page of its own."
    }
  }
  if title == "" {
    title = "Not found"
    body = "There is no page here."
  }
  @element.div(class="view simple") <| [
    @element.header_(class="simple-header") <| [
      @element.a(
        href=route_url(s, home_route()),
        class="home-link",
        attrs=[at("aria-label", "Findwell home")],
        on=link_click(s, home_route()),
      ) <| [wordmark("small")],
    ],
    @element.main_(id="main", class="simple-main") <| [
      @element.div(class="leave") <| [
        @element.h1(class="leave-h") <| [t(title)],
        @element.p(class="leave-note") <| [t(body)],
        back_bar(s, "Back", home_route()),
      ],
    ],
  ]
}

// ── Mount ─────────────────────────────────────────────────────

///|
fn main {
  let theme = url_param("theme")
  let start_dark = theme == "dark" || (theme != "light" && prefers_dark())
  let typed = @resource.signal("")
  let s : S = {
    route: @resource.signal(parse_route()),
    dark: @resource.signal(start_dark),
    theme_param: { val: if theme == "dark" || theme == "light" { theme } else { "" } },
    pushed: { val: 0 },
    typed,
    text: @resource.signal(""),
    open: @resource.signal(false),
    active: @resource.signal(-1),
    input: { val: None },
    sugg: @resource.memo(fn() { suggest(typed.get()) }),
    popup: @resource.signal(""),
    time: @resource.signal("any"),
    verbatim: @resource.signal(false),
    tools: @resource.signal(false),
    visited: @resource.signal([]),
    paa_open: @resource.signal([]),
    paa_extra: @resource.signal(0),
    kp_more: @resource.signal(false),
    about: @resource.signal(0),
    status: @resource.signal(""),
  }
  let q0 = s.route.get().q
  s.typed.set(q0)
  s.text.set(q0)
  // Theme on the root element, so the CSS tokens follow it.
  let _ = @resource.effect(fn() { set_root_theme(s.dark.get()) })
  // Document title per view.
  let _ = @resource.effect(fn() {
    let r = s.route.get()
    set_title(
      match r.view {
        "results" => r.q + " – Findwell Search"
        "leave" => "Leaving Findwell"
        "info" => "Findwell"
        _ => "Findwell"
      },
    )
  })
  // aria-activedescendant names the highlighted option, and is removed when there is none
  // (a luna dynamic attribute can only set a value, never remove the attribute).
  let _ = @resource.effect(fn() {
    let a = s.active.get()
    let o = s.open.get()
    match s.input.val {
      Some(i) => set_or_remove_attr(i, "aria-activedescendant", if o && a >= 0 { "sugg-\{a}" } else { "" })
      None => ()
    }
  })
  // A new query starts the accordion and the extra questions afresh.
  let _ = @resource.effect(fn() {
    let _ = s.route.get().q
    @resource.untracked(fn() {
      s.paa_open.set([])
      s.paa_extra.set(0)
    })
  })
  listen(g(), "popstate", fn(_e) {
    let r = parse_route()
    s.pushed.val = if s.pushed.val > 0 { s.pushed.val - 1 } else { 0 }
    @resource.batch(fn() {
      s.popup.set("")
      s.route.set(r)
      sync_box(s, r.q)
    })
  })
  // Outside clicks close the open menu or panel.
  listen(doc(), "click", fn(e) {
    let open = s.popup.get()
    if open != "" && popup_root_of(e._get("target")) != open {
      s.popup.set("")
    }
  })
  // A fixed (float) menu would drift from its button when the page moves: close it.
  let close_float = fn(_e : @js.Any) {
    let open = s.popup.get()
    if open != "" {
      match by_id(open + "-menu") {
        Some(m) =>
          if (m._get("classList")._call("contains", [@js.any("float")]).cast() : Bool) {
            s.popup.set("")
          }
        None => ()
      }
    }
  }
  listen(g(), "scroll", close_float)
  listen(g(), "resize", close_float)
  // Escape closes it and hands focus back to its button.
  listen(doc(), "keydown", fn(e) {
    if key_of(e) == "Escape" && s.popup.get() != "" {
      close_popup(s, true)
    }
  })
  // Focus leaving a menu or panel closes it.
  listen(doc(), "focusin", fn(e) {
    let open = s.popup.get()
    if open != "" && popup_root_of(e._get("target")) != open {
      s.popup.set("")
    }
  })
  let view = fn(name : String) { fn() { s.route.get().view == name } }
  let app = @element.div(class="shell") <| [
    @element.show(view("home"), fn() { home_view(s) }),
    @element.show(view("results"), fn() { results_view(s) }),
    @element.show(view("leave"), fn() {
      @element.for_each(fn() { [s.route.get()] }, fn(_r, _i) { leave_view(s) })
    }),
    @element.show(view("info"), fn() {
      @element.for_each(fn() { [s.route.get()] }, fn(_r, _i) { info_view(s) })
    }),
  ]
  match @dom.document().getElementById("app") {
    Some(root) => @element.render_to(root, app)
    None => ()
  }
}
