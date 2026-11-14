// Global state and routing.

///|
/// The view, from the hash: "home:<dir>", "blob:<path>", "issues", "issue:<n>", "new", "pulls", "tab:<name>".
let route : @resource.Signal[String] = @resource.signal("home:")

///|
/// Selected lines in the blob view (0 = none).
let sel_from : @resource.Signal[Int] = @resource.signal(0)

///|
let sel_to : @resource.Signal[Int] = @resource.signal(0)

///|
/// Which popover is open ("" = none).
let open_menu : @resource.Signal[String] = @resource.signal("")

///|
let copied : @resource.Signal[String] = @resource.signal("")

///|
let starred : @resource.Signal[Bool] = @resource.signal(false)

///|
let forks : @resource.Signal[Int] = @resource.signal(312)

///|
let watch_mode : @resource.Signal[String] = @resource.signal("Participating and @mentions")

///|
let branch : @resource.Signal[Int] = @resource.signal(0)

///|
let issues : @resource.Signal[Array[Issue]] = @resource.signal(seed_issues())

///|
let mobile_nav : @resource.Signal[Bool] = @resource.signal(false)

///|
fn parse_int(s : String) -> Int {
  let mut n = 0
  let mut any = false
  for ch in s {
    if ch.is_ascii_digit() {
      n = n * 10 + (ch.to_int() - '0'.to_int())
      any = true
    } else {
      break
    }
  }
  if any {
    n
  } else {
    0
  }
}

///|
fn apply_hash() -> Unit {
  let h = get_hash()
  let (r, from, to) = if h.has_prefix("/blob/") {
    let rest = h.substring(start=6)
    match rest.find("#L") {
      Some(at) => {
        let lines = rest.substring(start=at + 2)
        let a = parse_int(lines)
        let b = match lines.find("-L") {
          Some(k) => parse_int(lines.substring(start=k + 2))
          None => a
        }
        ("blob:" + rest.substring(end=at), a, if b < a { a } else { b })
      }
      None => ("blob:" + rest, 0, 0)
    }
  } else if h.has_prefix("/tree/") {
    ("home:" + h.substring(start=6), 0, 0)
  } else if h == "/issues/new" {
    ("new", 0, 0)
  } else if h.has_prefix("/issues/") {
    ("issue:" + parse_int(h.substring(start=8)).to_string(), 0, 0)
  } else if h == "/issues" {
    ("issues", 0, 0)
  } else if h == "/pulls" {
    ("pulls", 0, 0)
  } else if h == "/actions" || h == "/security" || h == "/insights" {
    ("tab:" + h.substring(start=1), 0, 0)
  } else {
    ("home:", 0, 0)
  }
  let changed = r != route.get()
  @resource.batch(fn() {
    route.set(r)
    sel_from.set(from)
    sel_to.set(to)
    open_menu.set("")
    mobile_nav.set(false)
  })
  if changed {
    scroll_top()
  }
  if from > 0 {
    later(0, fn() { scroll_to("#L" + from.to_string()) })
  }
}

///|
fn tab_of_route(r : String) -> String {
  if r.has_prefix("home:") || r.has_prefix("blob:") {
    "code"
  } else if r == "issues" || r == "new" || r.has_prefix("issue:") {
    "issues"
  } else if r == "pulls" {
    "pulls"
  } else {
    r.substring(start=4)
  }
}

///|
fn toggle_menu(key : String) -> Unit {
  if open_menu.get() == key {
    open_menu.set("")
  } else {
    open_menu.set(key)
  }
}

///|
fn close_menu_focus() -> Unit {
  let k = open_menu.get()
  if k != "" {
    open_menu.set("")
    focus_sel("#btn-" + k)
  }
}

///|
fn plural(n : Int, one : String, many : String) -> String {
  if n == 1 {
    "1 " + one
  } else {
    n.to_string() + " " + many
  }
}

///|
fn thousands(n : Int) -> String {
  if n < 1000 {
    n.to_string()
  } else {
    let r = n % 1000
    (n / 1000).to_string() + "," + r.to_string().pad_start(3, '0')
  }
}

///|
/// A disclosure popover: a trigger button and a panel, both inside one root so outside clicks close it.
fn popover(
  key : String,
  trigger_cls : String,
  trigger_label : String,
  trigger : Array[DomNode],
  panel_cls : String,
  panel : () -> Array[DomNode],
) -> DomNode {
  let attrs = [
    a_("type", "button"),
    a_("id", "btn-" + key),
    cls(trigger_cls),
    a_("aria-controls", "pop-" + key),
    ad("aria-expanded", fn() { bool_s(open_menu.get() == key) }),
    on("click", fn(_e) { toggle_menu(key) }),
  ]
  if trigger_label != "" {
    attrs.push(a_("aria-label", trigger_label))
  }
  el("div", [cls("pop-root"), a_("data-pop", key)], [
    el("button", attrs, trigger),
    el(
      "div",
      [
        a_("id", "pop-" + key),
        ad("class", fn() {
          "popover " +
          panel_cls +
          (if open_menu.get() == key { " is-open" } else { "" })
        }),
      ],
      panel(),
    ),
  ])
}

///|
fn main {
  let theme = search_param("theme")
  if theme == "dark" || theme == "light" {
    set_root_attr("data-theme", theme)
  }
  apply_hash()
  on_window("hashchange", fn(_e) { apply_hash() })
  on_doc("click", fn(e) {
    let k = open_menu.get()
    if k != "" && !closest(e, "[data-pop=\"" + k + "\"]") {
      open_menu.set("")
    }
  })
  on_doc("keydown", fn(e) {
    let key = ev_key(e)
    if key == "Escape" && open_menu.get() != "" && !any_dialog_open() {
      prevent(e)
      close_menu_focus()
    } else if key == "/" && !editable_target(e) && !ev_mod(e) && !any_dialog_open() {
      prevent(e)
      open_palette()
    }
  })
  match @dom.document().getElementById("site-header") {
    Some(h) => @element.render_to(h, global_header())
    None => ()
  }
  match @dom.document().getElementById("app") {
    Some(m) => @element.render_to(m, app_main())
    None => ()
  }
}
