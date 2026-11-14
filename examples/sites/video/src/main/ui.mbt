// Shared pieces: icons, the menu button, dialogs, the toast, the masthead and
// the guide. Both pages use all of them.

///|
extern "js" fn js_encode(s : String) -> String =
  #|(s) => encodeURIComponent(s)

///|
extern "js" fn js_focus_item(selector : String, last : Bool) -> Unit =
  #|(s, last) => { const all = document.querySelectorAll(s); const el = last ? all[all.length - 1] : all[0]; if (el) el.focus(); }

///|
extern "js" fn js_set_attr(el : @js.Any, name : String, value : String) -> Unit =
  #|(el, n, v) => el.setAttribute(n, v)

///|
fn icon_paths(name : String) -> Array[(String, Bool)] {
  // (path data, filled)
  match name {
    "menu" => [("M3 6h18M3 12h18M3 18h18", false)]
    "search" => [("M10.5 4a6.5 6.5 0 1 1 0 13a6.5 6.5 0 0 1 0-13zM15.5 15.5L21 21", false)]
    "mic" => [("M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21", false)]
    "kebab" => [("M12 3.6a1.8 1.8 0 1 1 0 3.6a1.8 1.8 0 0 1 0-3.6zM12 10.2a1.8 1.8 0 1 1 0 3.6a1.8 1.8 0 0 1 0-3.6zM12 16.8a1.8 1.8 0 1 1 0 3.6a1.8 1.8 0 0 1 0-3.6z", true)]
    "user" => [("M12 3a9 9 0 1 1 0 18a9 9 0 0 1 0-18zM12 7a3 3 0 1 1 0 6a3 3 0 0 1 0-6zM6.4 18.2c1.4-2.3 3.3-3.3 5.6-3.3s4.2 1 5.6 3.3", false)]
    "home" => [("M4 11l8-7l8 7v9h-5v-6H9v6H4z", false)]
    "clips" => [("M13.5 3L6 13h5l-1.5 8L18 11h-5z", false)]
    "subs" => [("M5 4h14M4 7.5h16a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8.5a1 1 0 0 1 1-1zM10 11v6l5-3z", false)]
    "trending" => [("M12 3c1 4 5 5.5 5 10.5a5 5 0 0 1-10 0c0-2.5 1.5-4 2.5-5.5c1.2 1 2 2.2 2 3.8c1-2.5.8-6-.5-8.8z", false)]
    "music" => [("M9 18V5.5l11-2V16M9 18a2.5 2.5 0 1 1-5 0a2.5 2.5 0 0 1 5 0zM20 16a2.5 2.5 0 1 1-5 0a2.5 2.5 0 0 1 5 0z", false)]
    "gaming" => [("M7 8h10a4 4 0 0 1 4 4v2.5a2.5 2.5 0 0 1-4.6 1.4L15 14H9l-1.4 1.9A2.5 2.5 0 0 1 3 14.5V12a4 4 0 0 1 4-4zM8 10.5v3M6.5 12h3M15.5 11.5h.01M17.5 13h.01", false)]
    "news" => [("M5 4h11v16H6a2 2 0 0 1-2-2V5a1 1 0 0 1 1-1zM16 8h3a1 1 0 0 1 1 1v9a2 2 0 0 1-4 0M7.5 8h5M7.5 11.5h5M7.5 15h3", false)]
    "close" => [("M6 6l12 12M18 6L6 18", false)]
    "back" => [("M11 5l-7 7l7 7M4 12h16", false)]
    "left" => [("M15 5l-7 7l7 7", false)]
    "right" => [("M9 5l7 7l-7 7", false)]
    "down" => [("M6 9l6 6l6-6", false)]
    "play" => [("M8 5v14l11-7z", true)]
    "play-lg" => [("M6.5 3.5v17l14-8.5z", true)]
    "pause" => [("M7 5h3.5v14H7zM13.5 5H17v14h-3.5z", true)]
    "next" => [("M6 5v14l9-7zM16 5h2.5v14H16z", true)]
    "volume" => [("M4 9h4l5-4v14l-5-4H4z", true), ("M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12", false)]
    "muted" => [("M4 9h4l5-4v14l-5-4H4z", true), ("M16 9.5l5 5M21 9.5l-5 5", false)]
    "cc" => [("M4 5.5h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1zM10.5 10.2a2.2 2.2 0 1 0 0 3.6M17 10.2a2.2 2.2 0 1 0 0 3.6", false)]
    "settings" => [("M12 8.5a3.5 3.5 0 1 1 0 7a3.5 3.5 0 0 1 0-7zM12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1", false)]
    "theater" => [("M3 7h18a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z", false)]
    "fullscreen" => [("M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5", false)]
    "like" => [("M7 10v10H3.5V10zM7 10l4-7c1.6 0 2.6 1.1 2.3 2.7L12.7 9H19a2 2 0 0 1 2 2.3l-1.2 6.6A2.5 2.5 0 0 1 17.3 20H7", false)]
    "dislike" => [("M17 14V4h3.5v10zM17 14l-4 7c-1.6 0-2.6-1.1-2.3-2.7l.6-3.3H5a2 2 0 0 1-2-2.3l1.2-6.6A2.5 2.5 0 0 1 6.7 4H17", false)]
    "share" => [("M14 5l7 7l-7 7v-4c-5 0-8 1.5-11 5c1-5 4-9.5 11-10.5z", false)]
    "save" => [("M3 6h12M3 11h12M3 16h7M18 13v8M14 17h8", false)]
    "bell" => [("M6 16.5V11a6 6 0 0 1 12 0v5.5l2 2H4zM10 20.5a2 2 0 0 0 4 0", false)]
    "sort" => [("M4 7h16M7 12h10M10 17h4", false)]
    "check" => [("M5 12.5l4.5 4.5L19 7.5", false)]
    "queue" => [("M3 6h13M3 11h13M3 16h8M15 14v7l6-3.5z", false)]
    "clock" => [("M12 3a9 9 0 1 1 0 18a9 9 0 0 1 0-18zM12 7v5l3.5 2", false)]
    "hide" => [("M12 3a9 9 0 1 1 0 18a9 9 0 0 1 0-18zM5.6 5.6l12.8 12.8", false)]
    "moon" => [("M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z", false)]
    "keyboard" => [("M3 6.5h18a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zM6 10h.01M9.5 10h.01M13 10h.01M16.5 10h.01M7 14h10", false)]
    _ => []
  }
}

///|
fn icon(name : String, class~ : String = "icon") -> @element.DomNode {
  let paths = icon_paths(name).map(fn(p) {
    let (d, filled) = p
    if filled {
      @element.svg_path(d~, fill="currentColor", stroke="none")
    } else {
      @element.svg_path(
        d~,
        fill="none",
        stroke="currentColor",
        stroke_width="1.8",
        stroke_linecap="round",
        stroke_linejoin="round",
      )
    }
  })
  @element.svg(
    // luna sets `class` through the className property, which an SVG element
    // ignores (it is an SVGAnimatedString), so the class is set as an attribute.
    ref_=fn(el) { js_set_attr(element_any(el), "class", class) },
    viewBox="0 0 24 24",
    width="24",
    height="24",
    attrs=[("aria-hidden", stat("true")), ("focusable", stat("false"))],
  ) <| paths
}

///|
fn sattr(name : String, value : String) -> (String, @element.Attr) {
  (name, @element.AttrString(value))
}

///|
fn dattr(name : String, f : () -> String) -> (String, @element.AttrValue) {
  (name, @element.attr_dynamic(f))
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
fn later(f : () -> Unit) -> Unit {
  ignore(js_set_timeout(f, 0))
}

// ---------------------------------------------------------------- toast

///|
let toast_msg : @resource.Signal[String] = @resource.signal("")

///|
let toast_timer : Ref[Int] = { val: -1 }

///|
fn toast(msg : String) -> Unit {
  toast_msg.set(msg)
  if toast_timer.val >= 0 {
    js_clear_timeout(toast_timer.val)
  }
  toast_timer.val = js_set_timeout(fn() { toast_msg.set("") }, 4000)
}

///|
fn toast_region() -> @element.DomNode {
  @element.div(
    class="toast-wrap",
    attrs=[sattr("role", "status"), sattr("aria-live", "polite")],
  ) <| [
    @element.show(fn() { toast_msg.get() != "" }, fn() {
      @element.p(class="toast") <| [@element.text_dyn(fn() { toast_msg.get() })]
    }),
  ]
}

// ---------------------------------------------------------------- menus

///|
let open_menu : @resource.Signal[String] = @resource.signal("")

///|
struct MenuItem {
  label : String
  role : String
  icon : String
  checked : () -> Bool
  action : () -> Unit
}

///|
fn item(label : String, icon : String, action : () -> Unit) -> MenuItem {
  { label, role: "menuitem", icon, checked: fn() { false }, action }
}

///|
fn radio(label : String, checked : () -> Bool, action : () -> Unit) -> MenuItem {
  { label, role: "menuitemradio", icon: "", checked, action }
}

///|
fn checkbox(label : String, icon : String, checked : () -> Bool, action : () -> Unit) -> MenuItem {
  { label, role: "menuitemcheckbox", icon, checked, action }
}

///|
fn close_menu_to(id : String) -> Unit {
  open_menu.set("")
  later(fn() { js_focus("#\{id}-btn") })
}

///|
fn open_menu_at(id : String, last~ : Bool = false) -> Unit {
  open_menu.set(id)
  later(fn() { js_focus_item("#\{id}-menu [role^=menuitem]", last) })
}

///|
/// A menu button (APG): the trigger toggles a `role=menu` of buttons; arrows
/// move inside it, Escape and Tab close it, and focus returns to the trigger.
fn menu_button(
  id : String,
  label : String,
  trigger : Array[@element.DomNode],
  items : Array[MenuItem],
  trigger_class~ : String = "icon-btn",
  menu_class~ : String = "menu",
  heading~ : String = "",
) -> @element.DomNode {
  let is_open = fn() { open_menu.get() == id }
  let menu_items = items.map(fn(it) {
    let attrs = [sattr("role", it.role), sattr("tabindex", "-1")]
    let dyn_attrs = if it.role == "menuitem" {
      []
    } else {
      [dattr("aria-checked", fn() { bool_s((it.checked)()) })]
    }
    let lead = if it.role == "menuitem" || it.icon != "" {
      if it.icon == "" {
        @element.span(class="menu-icon") <| []
      } else {
        @element.span(class="menu-icon") <| [icon(it.icon)]
      }
    } else {
      @element.span(class="menu-icon menu-check") <| [icon("check")]
    }
    @element.button(
      class="menu-item",
      attrs~,
      dyn_attrs~,
      on=@element.events().click(fn(_e) {
        open_menu.set("")
        js_focus("#\{id}-btn")
        (it.action)()
      }),
    ) <| [lead, @element.span() <| [@element.text(it.label)]]
  })
  let head = if heading == "" {
    []
  } else {
    [@element.p(class="menu-heading", attrs=[sattr("aria-hidden", "true")]) <| [@element.text(heading)]]
  }
  @element.div(class="menu-root", attrs=[sattr("data-menu-root", "")]) <| [
    @element.button(
      id="\{id}-btn",
      class=trigger_class,
      attrs=[
        sattr("aria-label", label),
        sattr("aria-haspopup", "menu"),
        sattr("aria-controls", "\{id}-menu"),
      ],
      dyn_attrs=[dattr("aria-expanded", fn() { bool_s(is_open()) })],
      on=@element.events()
        .click(fn(_e) { if is_open() { open_menu.set("") } else { open_menu_at(id) } })
        .keydown(fn(e) {
          let k = js_key(any_of(e))
          if k == "ArrowDown" {
            js_prevent(any_of(e))
            open_menu_at(id)
          } else if k == "ArrowUp" {
            js_prevent(any_of(e))
            open_menu_at(id, last=true)
          } else if k == "Escape" && is_open() {
            js_prevent(any_of(e))
            js_stop(any_of(e))
            open_menu.set("")
          }
        }),
    ) <| trigger,
    // Always in the DOM so aria-controls resolves; a class hides it while closed
    // (luna's attr_dynamic cannot remove an attribute such as `hidden`).
    @element.div(
        id="\{id}-menu",
        dyn_class=fn() { if is_open() { menu_class } else { "\{menu_class} is-closed" } },
        attrs=[sattr("role", "menu"), sattr("aria-labelledby", "\{id}-btn")],
        on=@element.events().keydown(fn(e) {
          let a = any_of(e)
          match js_key(a) {
            "ArrowDown" => {
              js_prevent(a)
              js_move_focus(a, "[role^=menuitem]", 1)
            }
            "ArrowUp" => {
              js_prevent(a)
              js_move_focus(a, "[role^=menuitem]", -1)
            }
            "Home" => {
              js_prevent(a)
              js_move_focus(a, "[role^=menuitem]", -100)
            }
            "End" => {
              js_prevent(a)
              js_move_focus(a, "[role^=menuitem]", 100)
            }
            "Escape" => {
              js_prevent(a)
              js_stop(a)
              close_menu_to(id)
            }
            "Tab" => open_menu.set("")
            _ => ()
          }
        }),
      ) <| (head + menu_items),
  ]
}

// ---------------------------------------------------------------- dialogs

///|
fn dialog(id : String, title : String, body : Array[@element.DomNode], class~ : String = "dialog") -> @element.DomNode {
  @element.create_element(
    "dialog",
    [
      ("id", @element.AttrValue::Static(id)),
      ("class", @element.AttrValue::Static(class)),
      ("aria-labelledby", @element.AttrValue::Static("\{id}-title")),
    ],
    [
      @element.div(class="dialog-head") <| [
        @element.h2(id="\{id}-title", class="dialog-title") <| [@element.text(title)],
        @element.button(
          class="icon-btn",
          attrs=[sattr("aria-label", "Close")],
          on=@element.events().click(fn(_e) { js_close_dialog(id) }),
        ) <| [icon("close")],
      ],
      @element.div(class="dialog-body") <| body,
    ],
  )
}

// ---------------------------------------------------------------- theme

///|
let dark_theme : @resource.Signal[Bool] = @resource.signal(false)

///|
fn init_theme() -> Unit {
  let param = js_url_param("theme")
  if param == "dark" || param == "light" {
    js_set_theme(param)
    dark_theme.set(param == "dark")
  } else {
    dark_theme.set(js_matches("(prefers-color-scheme: dark)"))
  }
}

///|
fn toggle_theme() -> Unit {
  let next = !dark_theme.get()
  dark_theme.set(next)
  js_set_theme(if next { "dark" } else { "light" })
}

// ---------------------------------------------------------------- masthead

///|
let guide_open : @resource.Signal[Bool] = @resource.signal(false)

///|
let search_open : @resource.Signal[Bool] = @resource.signal(false)

///|
fn logo() -> @element.DomNode {
  @element.a(href="index.html", class="logo", attrs=[sattr("aria-label", "Reelhouse home")]) <| [
    @element.svg(
      ref_=fn(el) { js_set_attr(element_any(el), "class", "logo-mark") },
      viewBox="0 0 32 24",
      width="32",
      height="24",
      attrs=[sattr("aria-hidden", "true"), sattr("focusable", "false")],
    ) <| [
      @element.svg_rect(x="1", y="2", width="30", height="20", rx="6", fill="var(--brand)"),
      @element.svg_circle(cx="12", cy="12", r="5.5", fill="none", stroke="#fff", stroke_width="2"),
      @element.svg_circle(cx="12", cy="12", r="1.6", fill="#fff"),
      @element.svg_path(d="M19 8.5v7l5.5-3.5z", fill="#fff"),
    ],
    @element.span(class="logo-word") <| [@element.text("Reelhouse")],
  ]
}

///|
fn search_box(initial : String) -> @element.DomNode {
  let query = @resource.signal(initial)
  let list_open = @resource.signal(false)
  let active = @resource.signal(-1)
  let suggestions = @resource.memo(fn() {
    let q = lower(query.get())
    let out : Array[String] = []
    for s in recent_searches {
      let starts_word = s.has_prefix(q) || s.contains(" \{q}")
      if (q == "" || starts_word) && s != q && out.length() < 6 {
        out.push(s)
      }
    }
    out
  })
  let showing = fn() { list_open.get() && suggestions().length() > 0 }
  let choose = fn(s : String) {
    js_set_value("#q", s)
    query.set(s)
    list_open.set(false)
    js_navigate("index.html?q=\{js_encode(s)}")
  }
  @element.form(
    class="search",
    action="index.html",
    http_method="get",
    attrs=[sattr("role", "search")],
  ) <| [
    @element.button(
      class="icon-btn search-back",
      attrs=[sattr("type", "button"), sattr("aria-label", "Close search")],
      on=@element.events().click(fn(_e) {
        search_open.set(false)
        later(fn() { js_focus("#search-toggle") })
      }),
    ) <| [icon("back")],
    @element.div(class="search-field") <| [
      @element.input(
        type_="text",
        id="q",
        name="q",
        value=initial,
        placeholder="Search",
        class="search-input",
        attrs=[
          sattr("role", "combobox"),
          sattr("aria-label", "Search"),
          sattr("aria-autocomplete", "list"),
          sattr("aria-controls", "q-list"),
          sattr("autocomplete", "off"),
          sattr("spellcheck", "false"),
        ],
        dyn_attrs=[
          dattr("aria-expanded", fn() { bool_s(showing()) }),
          dattr("aria-activedescendant", fn() {
            let a = active.get()
            if showing() && a >= 0 { "q-opt-\{a}" } else { "" }
          }),
        ],
        on=@element.events()
          .input(fn(e) {
            query.set(js_target_value(any_of(e)))
            list_open.set(true)
            active.set(-1)
          })
          .focus(fn(_e) { list_open.set(true) })
          .blur(fn(_e) {
            list_open.set(false)
            active.set(-1)
          })
          .keydown(fn(e) {
            let a = any_of(e)
            let n = suggestions().length()
            match js_key(a) {
              "ArrowDown" => {
                js_prevent(a)
                list_open.set(true)
                if n > 0 {
                  active.set((active.get() + 1) % n)
                }
              }
              "ArrowUp" => {
                js_prevent(a)
                list_open.set(true)
                if n > 0 {
                  active.set(if active.get() <= 0 { n - 1 } else { active.get() - 1 })
                }
              }
              "Enter" =>
                if showing() && active.get() >= 0 {
                  js_prevent(a)
                  choose(suggestions()[active.get()])
                }
              "Escape" => {
                js_prevent(a)
                if showing() {
                  list_open.set(false)
                  active.set(-1)
                } else {
                  js_set_value("#q", "")
                  query.set("")
                }
              }
              _ => ()
            }
          }),
      ),
      @element.show(fn() { query.get() != "" }, fn() {
        @element.button(
          class="icon-btn search-clear",
          attrs=[sattr("type", "button"), sattr("aria-label", "Clear search")],
          on=@element.events().click(fn(_e) {
            js_set_value("#q", "")
            query.set("")
            active.set(-1)
            js_focus("#q")
          }),
        ) <| [icon("close")]
      }),
      (
        @element.ul(
          id="q-list",
          dyn_class=fn() { if showing() { "suggestions" } else { "suggestions is-closed" } },
          attrs=[sattr("role", "listbox"), sattr("aria-label", "Recent searches")],
        ) <| [
          @element.for_each(suggestions, fn(s, i) {
            @element.li(
              id="q-opt-\{i}",
              class="suggestion",
              attrs=[sattr("role", "option")],
              dyn_attrs=[dattr("aria-selected", fn() { bool_s(active.get() == i) })],
              on=@element.events()
                .mousedown(fn(e) { js_prevent(any_of(e)) })
                .click(fn(_e) { choose(s) }),
            ) <| [icon("clock"), @element.span() <| [@element.text(s)]]
          }),
        ]
      ),
    ],
    @element.button(
      class="search-submit",
      attrs=[sattr("type", "submit"), sattr("aria-label", "Search")],
    ) <| [icon("search")],
  ]
}

///|
fn mic_button() -> @element.DomNode {
  let tip = @resource.signal(false)
  @element.div(class="mic-wrap", attrs=[sattr("data-menu-root", "")]) <| [
    @element.button(
      id="mic-btn",
      class="icon-btn mic",
      attrs=[sattr("aria-label", "Search with your voice"), sattr("aria-describedby", "mic-tip")],
      dyn_attrs=[dattr("aria-expanded", fn() { bool_s(tip.get()) })],
      on=@element.events()
        .click(fn(_e) { tip.update(fn(v) { !v }) })
        .blur(fn(_e) { tip.set(false) })
        .keydown(fn(e) {
          if js_key(any_of(e)) == "Escape" {
            tip.set(false)
          }
        }),
    ) <| [icon("mic")],
    @element.p(
      id="mic-tip",
      class="tooltip",
      attrs=[sattr("role", "tooltip")],
      dyn_attrs=[dattr("data-shown", fn() { bool_s(tip.get()) })],
    ) <| [@element.text("Voice search isn't available")],
  ]
}

///|
fn masthead(initial_query : String) -> @element.DomNode {
  @element.div(
    class="mh",
    dyn_class=fn() { if search_open.get() { "mh search-open" } else { "mh" } },
  ) <| [
    @element.div(class="mh-start") <| [
      @element.button(
        id="guide-btn",
        class="icon-btn",
        attrs=[sattr("aria-label", "Guide"), sattr("aria-controls", "guide")],
        dyn_attrs=[dattr("aria-expanded", fn() { bool_s(guide_open.get()) })],
        on=@element.events().click(fn(_e) {
          guide_open.update(fn(v) { !v })
          if guide_open.get() && js_matches("(max-width: 1099px)") {
            later(fn() { js_focus("#guide .full a") })
          }
        }),
      ) <| [icon("menu")],
      logo(),
    ],
    @element.div(class="mh-center") <| [search_box(initial_query), mic_button()],
    @element.div(class="mh-end") <| [
      @element.button(
        id="search-toggle",
        class="icon-btn search-toggle",
        attrs=[sattr("aria-label", "Search"), sattr("aria-controls", "q")],
        dyn_attrs=[dattr("aria-expanded", fn() { bool_s(search_open.get()) })],
        on=@element.events().click(fn(_e) {
          search_open.set(true)
          later(fn() { js_focus("#q") })
        }),
      ) <| [icon("search")],
      menu_button("site", "Settings", [icon("kebab")], [
        checkbox("Dark theme", "moon", fn() { dark_theme.get() }, toggle_theme),
        item("Keyboard shortcuts", "keyboard", fn() { js_show_dialog("shortcuts") }),
      ]),
      @element.button(
        class="signin",
        on=@element.events().click(fn(_e) { js_show_dialog("signin") }),
      ) <| [icon("user"), @element.span() <| [@element.text("Sign in")]],
    ],
  ]
}

///|
fn shortcut_row(keys : String, what : String) -> @element.DomNode {
  @element.li() <| [
    @element.span(class="kbd") <| [@element.text(keys)],
    @element.span() <| [@element.text(what)],
  ]
}

///|
fn site_dialogs() -> @element.DomNode {
  @element.fragment([
    dialog("signin", "Sign in", [
      @element.p() <| [
        @element.text("Accounts are not part of this demo. Everything here works without one: subscriptions, likes and comments are kept on this page until you leave it."),
      ],
      @element.div(class="dialog-actions") <| [
        @element.button(
          class="btn btn-primary",
          on=@element.events().click(fn(_e) { js_close_dialog("signin") }),
        ) <| [@element.text("Got it")],
      ],
    ]),
    dialog("shortcuts", "Keyboard shortcuts", [
      @element.p() <| [@element.text("While the player has focus:")],
      @element.ul(class="shortcuts") <| [
        shortcut_row("Space or k", "Play or pause"),
        shortcut_row("j / l", "Back or forward 10 seconds"),
        shortcut_row("← / →", "Back or forward 5 seconds"),
        shortcut_row("m", "Mute"),
        shortcut_row("c", "Captions"),
        shortcut_row("f", "Full screen"),
        shortcut_row("t", "Theater mode"),
        shortcut_row("0–9", "Jump to 0–90%"),
      ],
    ]),
  ])
}

// ---------------------------------------------------------------- guide

///|
struct GuideLink {
  label : String
  icon : String
  href : String
}

///|
fn guide_link(l : GuideLink, current : String, class~ : String) -> @element.DomNode {
  let attrs = if l.href == current { [sattr("aria-current", "page")] } else { [] }
  @element.a(href=l.href, class~, attrs~) <| [
    icon(l.icon),
    @element.span() <| [@element.text(l.label)],
  ]
}

///|
fn guide(current : String, has_rail : Bool) -> @element.DomNode {
  let rail : Array[GuideLink] = [
    { label: "Home", icon: "home", href: "index.html" },
    { label: "Clips", icon: "clips", href: "index.html?feed=clips" },
    { label: "Subscriptions", icon: "subs", href: "index.html?feed=subscriptions" },
    { label: "You", icon: "user", href: "index.html?feed=you" },
  ]
  let main_links : Array[GuideLink] = [
    { label: "Home", icon: "home", href: "index.html" },
    { label: "Subscriptions", icon: "subs", href: "index.html?feed=subscriptions" },
    { label: "You", icon: "user", href: "index.html?feed=you" },
  ]
  let explore : Array[GuideLink] = [
    { label: "Trending", icon: "trending", href: "index.html?feed=trending" },
    { label: "Music", icon: "music", href: "index.html?c=music" },
    { label: "Gaming", icon: "gaming", href: "index.html?q=gaming" },
    { label: "News", icon: "news", href: "index.html?q=news" },
  ]
  let rail_node = if has_rail {
    [
      @element.ul(class="rail") <| rail.map(fn(l) {
        @element.li() <| [guide_link(l, current, class="rail-link")]
      }),
    ]
  } else {
    []
  }
  @element.fragment([
    @element.nav(
      id="guide",
      attrs=[sattr("aria-label", "Guide")],
      dyn_class=fn() {
        let base = if has_rail { "guide" } else { "guide no-rail" }
        if guide_open.get() { "\{base} open" } else { base }
      },
      on=@element.events().keydown(fn(e) {
        if js_key(any_of(e)) == "Escape" && js_matches("(max-width: 1099px)") {
          guide_open.set(false)
          js_focus("#guide-btn")
        }
      }),
    ) <| (rail_node + [
      @element.div(class="full") <| [
        @element.ul(class="full-list") <| main_links.map(fn(l) {
          @element.li() <| [guide_link(l, current, class="full-link")]
        }),
        @element.h2(class="full-heading") <| [@element.text("Explore")],
        @element.ul(class="full-list") <| explore.map(fn(l) {
          @element.li() <| [guide_link(l, current, class="full-link")]
        }),
        @element.p(class="full-foot") <| [
          @element.text("Reelhouse is a fictional video site, built as a demo. No video here is real."),
        ],
      ],
    ]),
    @element.show(fn() { guide_open.get() }, fn() {
      @element.button(
        class="scrim",
        attrs=[sattr("aria-label", "Close guide"), sattr("tabindex", "-1")],
        on=@element.events().click(fn(_e) {
          guide_open.set(false)
          js_focus("#guide-btn")
        }),
      ) <| []
    }),
  ])
}

///|
fn init_global_listeners() -> Unit {
  js_on_document("pointerdown", fn(e) {
    if open_menu.get() != "" && !js_closest(e._get("target"), "[data-menu-root]") {
      open_menu.set("")
    }
  })
}

///|
fn mount(id : String, node : @element.DomNode) -> Unit {
  match @dom.document().getElementById(id) {
    Some(el) => @element.render_to(el, node)
    None => ()
  }
}
