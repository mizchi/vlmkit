// The views. index.html holds the landmarks; luna renders into each of them.

///|
fn s(name : String, v : String) -> (String, @element.Attr) {
  (name, @element.AttrString(v))
}

///|
fn d(name : String, f : () -> String) -> (String, @element.AttrValue) {
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
/// luna sets `class` through `className`, which an SVG element ignores (it is an
/// SVGAnimatedString there), so SVG classes are set as attributes once mounted.
fn svg_class(cls : String) -> (@dom.Element) -> Unit {
  fn(e) {
    ev(e)._call("setAttribute", [@js.any("class"), @js.any(cls)]) |> ignore
  }
}

///|
fn icon(path : String) -> DomNode {
  @element.svg(
    width="20",
    height="20",
    viewBox="0 0 24 24",
    fill="none",
    stroke="currentColor",
    ref_=svg_class("icon"),
    attrs=[s("aria-hidden", "true"), s("focusable", "false")],
  ) <| [
    @element.svg_path(
      d=path,
      stroke_width="1.8",
      stroke_linecap="round",
      stroke_linejoin="round",
    ),
  ]
}

///|
using @element {type DomNode}

///|
fn logo(cls : String) -> DomNode {
  @element.svg(
    width="28",
    height="28",
    viewBox="0 0 32 32",
    ref_=svg_class(cls),
    attrs=[s("aria-hidden", "true"), s("focusable", "false")],
  ) <| [
    @element.svg_path(
      d="M6 5h20a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H15l-7 5v-5H6a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3Z",
      ref_=svg_class("logo-bubble"),
    ),
    @element.svg_path(
      d="M10 12h12M10 16.5h8",
      ref_=svg_class("logo-lines"),
      stroke_width="2.2",
      stroke_linecap="round",
    ),
  ]
}

///|
let i_new = "M12 20h8M16.5 3.6a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"

///|
let i_side = "M4 5h16v14H4zM9.5 5v14"

///|
let i_search = "M11 4.5a6.5 6.5 0 1 0 0 13a6.5 6.5 0 0 0 0-13ZM20 20l-4.2-4.2"

///|
let i_more = "M5.5 12h.01M12 12h.01M18.5 12h.01"

///|
let i_chev = "M7 10l5 5 5-5"

///|
let i_check = "M5 12.5l4.5 4.5L19 7.5"

///|
let i_share = "M12 15V4M7.5 8.5 12 4l4.5 4.5M5 14v5h14v-5"

///|
let i_plus = "M12 5v14M5 12h14"

///|
let i_up = "M12 19V6M6 11.5 12 5.5l6 6"

///|
let i_copy = "M9 9h10v10H9zM15 9V5H5v10h4"

///|
let i_regen = "M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4.5H15"

///|
let i_good = "M7.5 11v8.5h-3V11h3Zm0 0 3.8-6.5a1.8 1.8 0 0 1 2.2 1.9V10h5a1.8 1.8 0 0 1 1.8 2.1l-1.2 5.9a1.8 1.8 0 0 1-1.8 1.5H7.5"

///|
let i_bad = "M16.5 13V4.5h3V13h-3Zm0 0-3.8 6.5a1.8 1.8 0 0 1-2.2-1.9V14h-5a1.8 1.8 0 0 1-1.8-2.1l1.2-5.9a1.8 1.8 0 0 1 1.8-1.5h9.8"

///|
let i_speak = "M4.5 9.5v5h3.5l4.5 4V5.5L8 9.5H4.5ZM15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"

///|
let i_down = "M12 5v13M6 12.5l6 6 6-6"

///|
let i_menu = "M4 7h16M4 12h16M4 17h16"

///|
let i_close = "M6.5 6.5l11 11M17.5 6.5l-11 11"

///|
let i_rename = "M16.5 3.6a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"

///|
let i_trash = "M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 12.5h9l1-12.5"

///|
let i_archive = "M4 5h16v4H4zM5.5 9v10h13V9M10 13h4"

///|
let i_upload = "M12 15.5V4.5M7.5 9 12 4.5 16.5 9M4.5 15v4.5h15V15"

///|
let i_shot = "M4.5 8.5v-4h4M15.5 4.5h4v4M19.5 15.5v4h-4M8.5 19.5h-4v-4"

///|
fn icon_button(
  label : String,
  path : String,
  cls~ : String = "icon-btn",
  id~ : String = "",
  on~ : @element.HandlerMap = @element.events(),
  extra~ : Array[(String, @element.AttrValue)] = [],
) -> DomNode {
  let attrs = [s("type", "button"), s("aria-label", label), s("title", label)]
  if id != "" {
    attrs.push(s("id", id))
  }
  @element.button(class=cls, attrs~, dyn_attrs=extra, on~) <| [
    icon(path),
  ]
}

// ---------------------------------------------------------------------------
// Sidebar

///|
fn open_row_menu(c : Conv) -> Unit {
  if row_menu.get() == c.id {
    row_menu.set(-1)
    return
  }
  close_menus()
  let btn = qs("#more-\{c.id}")
  if !@js.is_nullish(btn) {
    let r = btn._call("getBoundingClientRect", [])
    let bottom : Double = r._get("bottom").cast()
    let top : Double = r._get("top").cast()
    let right : Double = r._get("right").cast()
    let vh : Double = win()._get("innerHeight").cast()
    let h = 150.0
    let y = if bottom + 4.0 + h > vh { top - h - 4.0 } else { bottom + 4.0 }
    let x = if right - 184.0 < 8.0 { 8.0 } else { right - 184.0 }
    row_menu_style.set("top: \{y.to_int()}px; left: \{x.to_int()}px")
  }
  row_menu.set(c.id)
  later_focus("#row-menu [role=menuitem]")
}

///|
fn close_row_menu(refocus : Bool) -> Unit {
  let id = row_menu.get()
  row_menu.set(-1)
  if refocus && id >= 0 {
    later_focus("#more-\{id}")
  }
}

///|
fn commit_rename(c : Conv, v : String) -> Unit {
  if renaming.get() != c.id {
    return
  }
  let t = v.trim().to_string()
  if t != "" {
    c.title.set(t)
    say("Renamed to " + t)
  }
  renaming.set(-1)
  later_focus("#row-\{c.id}")
}

///|
fn row_view(c : Conv, _i : Int32) -> DomNode {
  @element.li(class="row-item") <| [
    @element.div(
      dyn_class=fn() {
        let base = if current.get() == c.id { "row is-current" } else { "row" }
        if row_menu.get() == c.id {
          base + " has-menu"
        } else {
          base
        }
      },
    ) <| [
      @element.show(fn() { renaming.get() == c.id }, fn() {
        @element.input(
          type_="text",
          class="rename",
          id="rename-\{c.id}",
          value=c.title.get(),
          attrs=[s("aria-label", "Rename chat")],
          on=@element.events()
            .keydown(fn(e) {
              let k = key_of(e)
              if k == "Enter" {
                prevent(e)
                commit_rename(c, target_value(e))
              } else if k == "Escape" {
                prevent(e)
                renaming.set(-1)
                later_focus("#row-\{c.id}")
              }
            })
            .blur(fn(e) { commit_rename(c, target_value(e)) }),
        )
      }),
      @element.show(fn() { renaming.get() != c.id }, fn() {
        @element.button(
          class="row-link",
          id="row-\{c.id}",
          attrs=[s("type", "button")],
          dyn_attrs=[
            d("aria-current", fn() {
              if current.get() == c.id {
                "page"
              } else {
                "false"
              }
            }),
          ],
          on=@element.events().click(fn(_e) { open_conv(c.id) }),
        ) <| [
          @element.span(class="row-title") <| [
            @element.text_dyn(fn() { c.title.get() }),
          ],
        ]
      }),
      @element.show(fn() { renaming.get() != c.id }, fn() {
        @element.button(
          class="row-more",
          id="more-\{c.id}",
          attrs=[
            s("type", "button"),
            s("aria-haspopup", "menu"),
            s("data-menu-root", ""),
          ],
          dyn_attrs=[
            d("aria-label", fn() { "Options for " + c.title.get() }),
            d("aria-expanded", fn() { bool_s(row_menu.get() == c.id) }),
          ],
          on=@element.events().click(fn(_e) { open_row_menu(c) }),
        ) <| [
          icon(i_more),
        ]
      }),
    ],
  ]
}

///|
fn group_view(g : String) -> DomNode {
  let rows = @resource.memo(fn() {
    let q = query.get().to_lower()
    convs
    .get()
    .filter(fn(c) {
      c.group == g && (q == "" || c.title.get().to_lower().contains(q))
    })
  })
  @element.show(fn() { rows().length() > 0 }, fn() {
    @element.section(class="group", attrs=[s("aria-label", g)]) <| [
      @element.h2(class="group-title") <| [
        @element.text(g),
      ],
      @element.ul(class="rows") <| [
        @element.for_each(fn() { rows() }, row_view),
      ],
    ]
  })
}

///|
fn toggle_sidebar() -> Unit {
  if is_phone() {
    set_drawer(false)
    focus_sel("#open-drawer")
  } else {
    collapsed.update(fn(v) { !v })
    if collapsed.get() {
      later_focus("#expand")
    } else {
      later_focus("#collapse")
    }
  }
}

///|
fn sidebar_view() -> DomNode {
  let any_match = @resource.memo(fn() {
    let q = query.get().to_lower()
    convs
    .get()
    .iter()
    .any(fn(c) { q == "" || c.title.get().to_lower().contains(q) })
  })
  @element.fragment([
    @element.div(class="sb-full") <| [
      @element.div(class="sb-top") <| [
        @element.div(class="brand") <| [
          logo("brand-logo"),
          @element.span(class="brand-name") <| [
            @element.text("Parley"),
          ],
        ],
        icon_button(
          "Close sidebar",
          i_side,
          id="collapse",
          on=@element.events().click(fn(_e) { toggle_sidebar() }),
          extra=[
            d("aria-label", fn() {
              if drawer.get() {
                "Close sidebar"
              } else {
                "Collapse sidebar"
              }
            }),
            d("title", fn() {
              if drawer.get() {
                "Close sidebar"
              } else {
                "Collapse sidebar"
              }
            }),
          ],
        ),
      ],
      @element.button(
        class="new-chat",
        attrs=[s("type", "button")],
        on=@element.events().click(fn(_e) { new_chat() }),
      ) <| [
        icon(i_new),
        @element.span() <| [
          @element.text("New chat"),
        ],
      ],
      @element.div(class="search") <| [
        icon(i_search),
        @element.input(
          type_="search",
          id="search",
          placeholder="Search chats",
          attrs=[s("aria-label", "Search chats"), s("autocomplete", "off")],
          on=@element.events()
            .input(fn(e) { query.set(target_value(e)) })
            .keydown(fn(e) {
              if key_of(e) == "Escape" && query.get() != "" {
                prevent(e)
                ev(e)._get("target")._set("value", @js.any(""))
                query.set("")
              }
            }),
        ),
      ],
      @element.nav(class="history", attrs=[s("aria-label", "Chat history")]) <| [
        @element.fragment(groups.map(group_view)),
        @element.show(fn() { !any_match() }, fn() {
          @element.p(class="no-match") <| [
            @element.text_dyn(fn() {
              if convs.get().length() == 0 {
                "No chats yet."
              } else {
                "No chats match “" + query.get() + "”."
              }
            }),
          ]
        }),
      ],
      @element.div(class="sb-foot") <| [
        @element.span(class="me-avatar", attrs=[s("aria-hidden", "true")]) <| [
          @element.text("MR"),
        ],
        @element.span(class="me-text") <| [
          @element.span(class="me-name") <| [
            @element.text("Mina Rao"),
          ],
          @element.span(class="me-plan") <| [
            @element.text("Free plan"),
          ],
        ],
      ],
    ],
    @element.div(class="sb-rail") <| [
      icon_button(
        "Expand sidebar",
        i_side,
        id="expand",
        on=@element.events().click(fn(_e) { toggle_sidebar() }),
        extra=[d("aria-expanded", fn() { "false" })],
      ),
      icon_button(
        "New chat",
        i_new,
        on=@element.events().click(fn(_e) { new_chat() }),
      ),
    ],
  ])
}

// ---------------------------------------------------------------------------
// Header

///|
fn open_model_menu() -> Unit {
  if model_open.get() {
    model_open.set(false)
    return
  }
  close_menus()
  model_open.set(true)
  later_focus("#model-menu [aria-checked=true]")
}

///|
fn close_model_menu(refocus : Bool) -> Unit {
  model_open.set(false)
  if refocus {
    later_focus("#model-btn")
  }
}

///|
fn model_item(m : Model) -> DomNode {
  let pick = fn() {
    model.set(m.id)
    close_model_menu(true)
    say(m.name + " selected")
  }
  @element.li(
    class="model-item",
    attrs=[s("role", "menuitemradio"), s("tabindex", "-1")],
    dyn_attrs=[d("aria-checked", fn() { bool_s(model.get() == m.id) })],
    on=@element.events()
      .click(fn(_e) { pick() })
      .keydown(fn(e) {
        let k = key_of(e)
        if k == "Enter" || k == " " {
          prevent(e)
          pick()
        }
      }),
  ) <| [
    @element.span(class="mm-text") <| [
      @element.span(class="mm-name") <| [
        @element.text(m.name),
      ],
      @element.span(class="mm-desc") <| [
        @element.text(m.desc),
      ],
    ],
    @element.span(class="mm-check") <| [
      icon(i_check),
    ],
  ]
}

///|
fn header_view() -> DomNode {
  @element.fragment([
    icon_button(
      "Open sidebar",
      i_menu,
      cls="icon-btn open-drawer",
      id="open-drawer",
      on=@element.events().click(fn(_e) {
        set_drawer(true)
        // The drawer is always in the DOM, so focus can move in the same task.
        focus_sel(".sidebar .new-chat")
      }),
      extra=[
        d("aria-expanded", fn() { bool_s(drawer.get()) }),
        d("aria-controls", fn() { "sidebar" }),
      ],
    ),
    @element.div(class="model-picker", attrs=[s("data-menu-root", "")]) <| [
      @element.button(
        class="model-btn",
        id="model-btn",
        attrs=[s("type", "button"), s("aria-haspopup", "menu")],
        dyn_attrs=[d("aria-expanded", fn() { bool_s(model_open.get()) })],
        on=@element.events()
          .click(fn(_e) { open_model_menu() })
          .keydown(fn(e) {
            if key_of(e) == "ArrowDown" && !model_open.get() {
              prevent(e)
              open_model_menu()
            }
          }),
      ) <| [
        @element.span(class="model-label") <| [
          @element.text_dyn(model_name),
        ],
        icon(i_chev),
      ],
      @element.show(fn() { model_open.get() }, fn() {
        @element.ul(
          class="menu model-menu",
          id="model-menu",
          attrs=[s("role", "menu"), s("aria-labelledby", "model-btn")],
          on=@element.events().keydown(fn(e) {
            menu_keys(e, "#model-menu", close_model_menu)
          }),
        ) <| models.map(model_item)
      }),
    ],
    @element.h1(class="conv-title") <| [
      @element.text_dyn(current_title),
    ],
    @element.show(fn() { current.get() >= 0 }, fn() {
      @element.button(
        class="share-btn",
        id="share-btn",
        attrs=[s("type", "button"), s("aria-haspopup", "dialog")],
        dyn_attrs=[d("aria-expanded", fn() { bool_s(share_open.get()) })],
        on=@element.events().click(fn(_e) {
          close_menus()
          link_copied.set(false)
          share_open.set(true)
          later_focus("#copy-link")
        }),
      ) <| [
        icon(i_share),
        @element.span() <| [
          @element.text("Share"),
        ],
      ]
    }),
  ])
}

// ---------------------------------------------------------------------------
// Messages

///|
fn render_inline(src : String, caret : (() -> Bool)?) -> Array[DomNode] {
  let out : Array[DomNode] = parse_inline(src).map(fn(part) {
    match part {
      Plain(t) => @element.text(t)
      Bold(t) =>
        @element.strong() <| [
          @element.text(t),
        ]
      InlineCode(t) =>
        @element.code(class="ic") <| [
          @element.text(t),
        ]
    }
  })
  if caret is Some(live) {
    out.push(caret_node(live))
  }
  out
}

///|
/// The streaming caret. It stays only while `live()` holds, so the last block of a reply does not
/// keep a caret once the reply settles (the block itself is not re-rendered then).
fn caret_node(live : () -> Bool) -> DomNode {
  @element.show(live, fn() {
    @element.span(class="caret", attrs=[s("aria-hidden", "true")]) <| []
  })
}

///|
fn el(
  tag : String,
  cls : String,
  children : Array[DomNode],
  attrs~ : Array[(String, @element.AttrValue)] = [],
) -> DomNode {
  let all = [("class", @element.attr_static(cls))]
  for a in attrs {
    all.push(a)
  }
  @element.create_element(tag, all, children)
}

///|
fn code_view(
  m : Msg,
  idx : Int32,
  lang : String,
  body : String,
  caret : (() -> Bool)?,
) -> DomNode {
  let label = if lang == "" { "code" } else { lang }
  let code_children = [@element.text(body)]
  if caret is Some(live) {
    code_children.push(caret_node(live))
  }
  @element.div(class="code-block") <| [
    @element.div(class="code-head") <| [
      @element.span(class="code-lang") <| [
        @element.text(label),
      ],
      @element.button(
        class="code-copy",
        attrs=[s("type", "button")],
        dyn_attrs=[
          d("aria-label", fn() {
            if m.code_copied.get() == idx {
              "Copied"
            } else {
              "Copy code"
            }
          }),
        ],
        on=@element.events().click(fn(_e) {
          copy_text(body)
          m.code_copied.set(idx)
          say("Code copied")
          set_timeout(
            fn() { if m.code_copied.get() == idx { m.code_copied.set(-1) } },
            2000,
          )
          |> ignore
        }),
      ) <| [
        @element.show(fn() { m.code_copied.get() == idx }, fn() {
          icon(i_check)
        }),
        @element.show(fn() { m.code_copied.get() != idx }, fn() { icon(i_copy) }),
        @element.span() <| [
          @element.text_dyn(fn() {
            if m.code_copied.get() == idx {
              "Copied"
            } else {
              "Copy"
            }
          }),
        ],
      ],
    ],
    @element.pre(attrs=[s("tabindex", "0"), s("aria-label", label + " code")]) <| [
      @element.code(class="lang-" + label) <| code_children,
    ],
  ]
}

///|
fn table_view(
  head : Array[String],
  rows : Array[Array[String]],
  caret : (() -> Bool)?,
) -> DomNode {
  let thead = el("thead", "", [
    el(
      "tr",
      "",
      head.map(fn(h) {
        el("th", "", render_inline(h, None), attrs=[
          ("scope", @element.attr_static("col")),
        ])
      }),
    ),
  ])
  let body_rows = rows.mapi(fn(ri, r) {
    let last_row = ri == rows.length() - 1
    el(
      "tr",
      "",
      r.mapi(fn(ci, c) {
        el(
          "td",
          "",
          render_inline(c, when(caret, last_row && ci == r.length() - 1)),
        )
      }),
    )
  })
  @element.div(
    class="table-wrap",
    attrs=[s("tabindex", "0"), s("role", "region"), s("aria-label", "Table")],
  ) <| [
    el("table", "md-table", [thead, el("tbody", "", body_rows)]),
  ]
}

///|
fn when(caret : (() -> Bool)?, here : Bool) -> (() -> Bool)? {
  if here {
    caret
  } else {
    None
  }
}

///|
fn block_view(
  m : Msg,
  b : Block,
  idx : Int32,
  caret : (() -> Bool)?,
) -> DomNode {
  match b {
    Para(t) => @element.p() <| render_inline(t, caret)
    Heading(level, t) =>
      if level <= 2 {
        @element.h3(class="md-h") <| render_inline(t, caret)
      } else {
        @element.h4(class="md-h") <| render_inline(t, caret)
      }
    Bullets(items) =>
      @element.ul(class="md-list") <| items.mapi(fn(i, it) {
        @element.li() <| render_inline(it, when(caret, i == items.length() - 1))
      })
    Numbered(items) =>
      @element.ol(class="md-list") <| items.mapi(fn(i, it) {
        @element.li() <| render_inline(it, when(caret, i == items.length() - 1))
      })
    Code(lang, body) => code_view(m, idx, lang, body, caret)
    Table(head, rows) => table_view(head, rows, caret)
  }
}

///|
fn regenerate(m : Msg) -> Unit {
  if busy.get() {
    return
  }
  say("Regenerating")
  start_stream(m)
}

///|
fn action_button(
  label : String,
  path : String,
  click : () -> Unit,
  pressed~ : (() -> Bool)? = None,
  disabled~ : (() -> Bool)? = None,
) -> DomNode {
  let dyn : Array[(String, @element.AttrValue)] = []
  match pressed {
    Some(p) => dyn.push(d("aria-pressed", fn() { bool_s(p()) }))
    None => ()
  }
  @element.button(
    class="act",
    attrs=[s("type", "button"), s("aria-label", label), s("title", label)],
    dyn_attrs=dyn,
    dyn_disabled=match disabled {
      Some(f) => f
      None => fn() { false }
    },
    on=@element.events().click(fn(_e) { click() }),
  ) <| [
    icon(path),
  ]
}

///|
fn assistant_view(m : Msg) -> DomNode {
  let blocks = @resource.memo(fn() { parse_blocks(m.visible()) })
  @element.article(
    class="msg msg-assistant",
    attrs=[s("aria-label", "Parley said")],
  ) <| [
    @element.div(class="avatar") <| [
      logo("avatar-logo"),
    ],
    @element.div(class="msg-main") <| [
      @element.div(class="md") <| [
        @element.for_each(fn() { blocks() }, fn(b, i) {
          let caret = if m.streaming.get() && i == blocks().length() - 1 {
            Some(fn() { m.streaming.get() })
          } else {
            None
          }
          block_view(m, b, i, caret)
        }),
        @element.show(fn() { m.streaming.get() && blocks().length() == 0 }, fn() {
          @element.p(class="thinking") <| [
            caret_node(fn() { m.streaming.get() }),
          ]
        }),
      ],
      @element.show(fn() { m.stopped.get() }, fn() {
        @element.p(class="stopped-note") <| [
          @element.text("Stopped"),
        ]
      }),
      @element.show(fn() { !m.streaming.get() }, fn() {
        @element.div(
          class="msg-actions",
          attrs=[s("role", "group"), s("aria-label", "Response actions")],
        ) <| [
          @element.button(
            class="act act-copy",
            attrs=[s("type", "button")],
            dyn_attrs=[
              d("aria-label", fn() {
                if m.copied.get() {
                  "Copied"
                } else {
                  "Copy"
                }
              }),
              d("title", fn() { "Copy" }),
            ],
            on=@element.events().click(fn(_e) {
              copy_text(m.visible())
              m.copied.set(true)
              say("Copied")
              set_timeout(fn() { m.copied.set(false) }, 2000) |> ignore
            }),
          ) <| [
            @element.show(fn() { m.copied.get() }, fn() { icon(i_check) }),
            @element.show(fn() { !m.copied.get() }, fn() { icon(i_copy) }),
            @element.show(fn() { m.copied.get() }, fn() {
              @element.span(class="act-note") <| [
                @element.text("Copied"),
              ]
            }),
          ],
          action_button(
            "Regenerate",
            i_regen,
            fn() { regenerate(m) },
            disabled=Some(fn() { busy.get() }),
          ),
          action_button(
            "Good response",
            i_good,
            fn() { m.feedback.update(fn(v) { if v == 1 { 0 } else { 1 } }) },
            pressed=Some(fn() { m.feedback.get() == 1 }),
          ),
          action_button(
            "Bad response",
            i_bad,
            fn() { m.feedback.update(fn(v) { if v == -1 { 0 } else { -1 } }) },
            pressed=Some(fn() { m.feedback.get() == -1 }),
          ),
          action_button(
            "Read aloud",
            i_speak,
            fn() { m.reading.update(fn(v) { !v }) },
            pressed=Some(fn() { m.reading.get() }),
          ),
        ]
      }),
    ],
  ]
}

///|
fn resend_from(m : Msg, text : String) -> Unit {
  let t = text.trim().to_string()
  if t == "" {
    return
  }
  stop_stream()
  match current_conv() {
    None => ()
    Some(c) => {
      let ms = c.messages.get()
      let kept : Array[Msg] = []
      for x in ms {
        kept.push(x)
        if x.id == m.id {
          break
        }
      }
      m.text.set(t)
      m.shown.set(t.length())
      m.editing.set(false)
      let a = new_msg("assistant", pick_reply(t), false)
      kept.push(a)
      c.messages.set(kept)
      scroll_to_end()
      start_stream(a)
      later_focus("#prompt")
    }
  }
}

///|
fn user_view(m : Msg) -> DomNode {
  let edit_val : Ref[String] = Ref("")
  @element.article(class="msg msg-user", attrs=[s("aria-label", "You said")]) <| [
    @element.show(fn() { !m.editing.get() }, fn() {
      @element.div(class="user-wrap") <| [
        @element.div(class="bubble") <| [
          @element.text_dyn(fn() { m.text.get() }),
        ],
        @element.div(class="msg-actions user-actions") <| [
          @element.button(
            class="act",
            id="edit-\{m.id}",
            attrs=[
              s("type", "button"),
              s("aria-label", "Edit message"),
              s("title", "Edit message"),
            ],
            dyn_disabled=fn() { busy.get() },
            on=@element.events().click(fn(_e) {
              edit_val.val = m.text.get()
              m.editing.set(true)
              later_focus("#editbox-\{m.id}")
            }),
          ) <| [
            icon(i_rename),
          ],
        ],
      ]
    }),
    @element.show(fn() { m.editing.get() }, fn() {
      @element.div(class="edit-box") <| [
        @element.textarea(
          id="editbox-\{m.id}",
          class="edit-area",
          attrs=[s("aria-label", "Edit message"), s("rows", "3")],
          dyn_attrs=[d("value", fn() { m.text.get() })],
          on=@element.events()
            .input(fn(e) { edit_val.val = target_value(e) })
            .keydown(fn(e) {
              if key_of(e) == "Escape" {
                prevent(e)
                m.editing.set(false)
                later_focus("#edit-\{m.id}")
              }
            }),
        ) <| [],
        @element.div(class="edit-row") <| [
          @element.button(
            class="btn btn-quiet",
            attrs=[s("type", "button")],
            on=@element.events().click(fn(_e) {
              m.editing.set(false)
              later_focus("#edit-\{m.id}")
            }),
          ) <| [
            @element.text("Cancel"),
          ],
          @element.button(
            class="btn btn-accent",
            attrs=[s("type", "button")],
            on=@element.events().click(fn(_e) { resend_from(m, edit_val.val) }),
          ) <| [
            @element.text("Send"),
          ],
        ],
      ]
    }),
  ]
}

///|
fn msg_view(m : Msg, _i : Int32) -> DomNode {
  if m.role == "user" {
    user_view(m)
  } else {
    assistant_view(m)
  }
}

///|
fn messages_now() -> Array[Msg] {
  match current_conv() {
    Some(c) => c.messages.get()
    None => []
  }
}

// ---------------------------------------------------------------------------
// Empty state and composer

///|
fn fill_and_send(text : String) -> Unit {
  let el = prompt_el.val
  if !@js.is_nullish(el) {
    el._set("value", @js.any(text))
  }
  draft.set(text)
  send_text(text)
}

///|
fn empty_view() -> DomNode {
  @element.section(class="empty", attrs=[s("aria-labelledby", "greet")]) <| [
    logo("empty-logo"),
    @element.h2(class="greet", id="greet") <| [
      @element.text("What can I help with?"),
    ],
    @element.ul(class="suggestions") <| suggestions.map(fn(sg) {
      @element.li() <| [
        @element.button(
          class="suggestion",
          attrs=[s("type", "button")],
          on=@element.events().click(fn(_e) { fill_and_send(sg.prompt) }),
        ) <| [
          @element.span(class="sg-title") <| [
            @element.text(sg.title),
          ],
          @element.span(class="sg-detail") <| [
            @element.text(sg.detail),
          ],
        ],
      ]
    }),
  ]
}

///|
fn grow(el : @js.Any) -> Unit {
  let st = el._get("style")
  st._set("height", @js.any("auto"))
  let h : Double = el._get("scrollHeight").cast()
  let max = 216.0
  let v = if h > max { max } else { h }
  st._set("height", @js.any("\{v.to_int()}px"))
  st._set("overflowY", @js.any(if h > max { "auto" } else { "hidden" }))
}

///|
fn close_attach(refocus : Bool) -> Unit {
  attach_open.set(false)
  if refocus {
    later_focus("#attach-btn")
  }
}

///|
fn attach_item(label : String, path : String) -> DomNode {
  let pick = fn() {
    close_attach(true)
    say(label + " is not available in this demo")
  }
  @element.li(
    class="menu-item",
    attrs=[s("role", "menuitem"), s("tabindex", "-1")],
    on=@element.events()
      .click(fn(_e) { pick() })
      .keydown(fn(e) {
        let k = key_of(e)
        if k == "Enter" || k == " " {
          prevent(e)
          pick()
        }
      }),
  ) <| [
    icon(path),
    @element.span() <| [
      @element.text(label),
    ],
  ]
}

///|
fn composer_view() -> DomNode {
  let empty = @resource.memo(fn() { draft.get().trim() == "" })
  @element.div(class="dock") <| [
    @element.show(fn() { !pinned.get() && current.get() >= 0 }, fn() {
      icon_button(
        "Scroll to bottom",
        i_down,
        cls="to-bottom",
        id="to-bottom",
        on=@element.events().click(fn(_e) {
          let sc = scroller.val
          if !@js.is_nullish(sc) {
            sc._set("scrollTop", sc._get("scrollHeight"))
          }
          pinned.set(true)
          later_focus("#prompt")
        }),
      )
    }),
    @element.form(
      class="composer",
      attrs=[s("aria-label", "Message composer")],
      on=@element.events().submit(fn(e) {
        prevent(e)
        send_text(draft.get())
      }),
    ) <| [
      @element.textarea(
        id="prompt",
        placeholder="Message Parley",
        class="prompt",
        attrs=[s("rows", "1"), s("aria-label", "Message Parley")],
        ref_=fn(e) { prompt_el.val = @js.identity(e) },
        on=@element.events()
          .input(fn(e) {
            draft.set(target_value(e))
            grow(ev(e)._get("target"))
          })
          .keydown(fn(e) {
            if key_of(e) == "Enter" && !shift_of(e) && !composing(e) {
              prevent(e)
              send_text(draft.get())
            }
          }),
      ) <| [],
      @element.div(class="composer-row") <| [
        @element.div(class="attach", attrs=[s("data-menu-root", "")]) <| [
          icon_button(
            "Attach",
            i_plus,
            cls="icon-btn attach-btn",
            id="attach-btn",
            on=@element.events().click(fn(_e) {
              if attach_open.get() {
                close_attach(false)
              } else {
                close_menus()
                attach_open.set(true)
                later_focus("#attach-menu [role=menuitem]")
              }
            }),
            extra=[
              d("aria-haspopup", fn() { "menu" }),
              d("aria-expanded", fn() { bool_s(attach_open.get()) }),
            ],
          ),
          @element.show(fn() { attach_open.get() }, fn() {
            @element.ul(
              class="menu attach-menu",
              id="attach-menu",
              attrs=[s("role", "menu"), s("aria-label", "Attach")],
              on=@element.events().keydown(fn(e) {
                menu_keys(e, "#attach-menu", close_attach)
              }),
            ) <| [
              attach_item("Upload file", i_upload),
              attach_item("Take screenshot", i_shot),
            ]
          }),
        ],
        @element.show(fn() { !busy.get() }, fn() {
          @element.button(
            class="send",
            id="send",
            attrs=[
              s("type", "submit"),
              s("aria-label", "Send message"),
              s("title", "Send message"),
            ],
            dyn_disabled=fn() { empty() },
          ) <| [
            icon(i_up),
          ]
        }),
        @element.show(fn() { busy.get() }, fn() {
          @element.button(
            class="stop",
            id="stop",
            attrs=[s("type", "button")],
            on=@element.events().click(fn(_e) {
              stop_stream()
              later_focus("#prompt")
            }),
          ) <| [
            @element.span(class="stop-square", attrs=[s("aria-hidden", "true")]) <| [],
            @element.span() <| [
              @element.text("Stop generating"),
            ],
          ]
        }),
      ],
    ],
    @element.p(class="smallprint") <| [
      @element.text("Parley can make mistakes. Check important info."),
    ],
  ]
}

///|
fn conversation_view() -> DomNode {
  @element.fragment([
    @element.div(
      class="scroller",
      id="scroller",
      ref_=fn(e) { scroller.val = @js.identity(e) },
      on=@element.events().scroll(fn(_e) {
        let b = at_bottom()
        if b != pinned.get() {
          pinned.set(b)
        }
      }),
    ) <| [
      @element.div(class="thread") <| [
        @element.show(fn() { current.get() < 0 }, empty_view),
        @element.show(fn() { current.get() >= 0 }, fn() {
          @element.div(
            class="messages",
            attrs=[s("role", "log"), s("aria-label", "Conversation")],
            dyn_attrs=[d("aria-busy", fn() { bool_s(busy.get()) })],
          ) <| [
            @element.for_each(messages_now, msg_view),
          ]
        }),
      ],
    ],
    composer_view(),
    @element.p(
      class="sr-only",
      attrs=[s("role", "status"), s("aria-live", "polite")],
    ) <| [
      @element.text_dyn(fn() { status.get() }),
    ],
  ])
}

// ---------------------------------------------------------------------------
// Overlays: the history row menu and the two dialogs

///|
fn row_menu_item(
  label : String,
  path : String,
  act : (Conv) -> Unit,
  danger : Bool,
) -> DomNode {
  let run = fn() {
    match find_conv(row_menu.get()) {
      Some(c) => {
        row_menu.set(-1)
        act(c)
      }
      None => ()
    }
  }
  @element.li(
    class=if danger { "menu-item danger" } else { "menu-item" },
    attrs=[s("role", "menuitem"), s("tabindex", "-1")],
    on=@element.events()
      .click(fn(_e) { run() })
      .keydown(fn(e) {
        let k = key_of(e)
        if k == "Enter" || k == " " {
          prevent(e)
          run()
        }
      }),
  ) <| [
    icon(path),
    @element.span() <| [
      @element.text(label),
    ],
  ]
}

///|
fn dialog_frame(
  id : String,
  role : String,
  title_id : String,
  on_close : () -> Unit,
  children : Array[DomNode],
) -> DomNode {
  @element.div(class="overlay") <| [
    @element.div(
      class="backdrop",
      attrs=[s("aria-hidden", "true")],
      on=@element.events().click(fn(_e) { on_close() }),
    ) <| [],
    @element.div(
      class="dialog",
      id~,
      attrs=[
        s("role", role),
        s("aria-modal", "true"),
        s("aria-labelledby", title_id),
      ],
      on=@element.events().keydown(fn(e) {
        if key_of(e) == "Escape" {
          prevent(e)
          on_close()
        } else {
          trap_tab(e, qs("#" + id))
        }
      }),
    ) <| children,
  ]
}

///|
fn overlays_view() -> DomNode {
  let close_share = fn() {
    share_open.set(false)
    later_focus("#share-btn")
  }
  let cancel_delete = fn() {
    let id = confirm_delete.get()
    confirm_delete.set(-1)
    later_focus("#more-\{id}")
  }
  let share_url = "https://parley.example/share/lunar-night-4f7c2a"
  @element.fragment([
    @element.show(fn() { drawer.get() }, fn() {
      @element.div(
        class="drawer-scrim",
        attrs=[s("aria-hidden", "true")],
        on=@element.events().click(fn(_e) {
          set_drawer(false)
          focus_sel("#open-drawer")
        }),
      ) <| []
    }),
    @element.show(fn() { row_menu.get() >= 0 }, fn() {
      @element.ul(
        class="menu row-menu",
        id="row-menu",
        dyn_style=fn() { row_menu_style.get() },
        attrs=[
          s("role", "menu"),
          s("aria-label", "Chat options"),
          s("data-menu-root", ""),
        ],
        on=@element.events().keydown(fn(e) {
          menu_keys(e, "#row-menu", close_row_menu)
        }),
      ) <| [
        row_menu_item(
          "Rename",
          i_rename,
          fn(c) {
            renaming.set(c.id)
            set_timeout(
              fn() {
                let inp = qs("#rename-\{c.id}")
                focus_el(inp)
                if !@js.is_nullish(inp) {
                  inp._call("select", []) |> ignore
                }
              },
              0,
            )
            |> ignore
          },
          false,
        ),
        row_menu_item(
          "Archive",
          i_archive,
          fn(c) {
            let t = c.title.get()
            remove_conv(c.id)
            say("Archived “" + t + "”")
            later_focus("#search")
          },
          false,
        ),
        row_menu_item(
          "Delete",
          i_trash,
          fn(c) {
            confirm_delete.set(c.id)
            later_focus("#delete-cancel")
          },
          true,
        ),
      ]
    }),
    @element.show(fn() { share_open.get() }, fn() {
      dialog_frame("share-dialog", "dialog", "share-title", close_share, [
        @element.div(class="dialog-head") <| [
          @element.h2(id="share-title") <| [
            @element.text("Share this chat"),
          ],
          icon_button(
            "Close",
            i_close,
            on=@element.events().click(fn(_e) { close_share() }),
          ),
        ],
        @element.p(class="dialog-text") <| [
          @element.text(
            "Anyone with the link can read this conversation. Messages you send after sharing stay private.",
          ),
        ],
        @element.div(class="share-row") <| [
          @element.input(
            type_="text",
            id="share-link",
            value=share_url,
            readonly_=true,
            attrs=[s("aria-label", "Share link")],
          ),
          @element.button(
            class="btn btn-accent",
            id="copy-link",
            attrs=[s("type", "button")],
            on=@element.events().click(fn(_e) {
              copy_text(share_url)
              link_copied.set(true)
              say("Link copied")
              set_timeout(fn() { link_copied.set(false) }, 2000) |> ignore
            }),
          ) <| [
            @element.text_dyn(fn() {
              if link_copied.get() {
                "Copied"
              } else {
                "Copy link"
              }
            }),
          ],
        ],
      ])
    }),
    @element.show(fn() { confirm_delete.get() >= 0 }, fn() {
      let title = match find_conv(confirm_delete.get()) {
        Some(c) => c.title.get()
        None => ""
      }
      dialog_frame(
        "delete-dialog",
        "alertdialog",
        "delete-title",
        cancel_delete,
        [
          @element.h2(id="delete-title") <| [
            @element.text("Delete chat?"),
          ],
          @element.p(class="dialog-text") <| [
            @element.text("This deletes “"),
            @element.strong() <| [
              @element.text(title),
            ],
            @element.text("” and its messages. You can’t undo this."),
          ],
          @element.div(class="dialog-actions") <| [
            @element.button(
              class="btn btn-quiet",
              id="delete-cancel",
              attrs=[s("type", "button")],
              on=@element.events().click(fn(_e) { cancel_delete() }),
            ) <| [
              @element.text("Cancel"),
            ],
            @element.button(
              class="btn btn-danger",
              attrs=[s("type", "button")],
              on=@element.events().click(fn(_e) {
                let id = confirm_delete.get()
                confirm_delete.set(-1)
                remove_conv(id)
                say("Chat deleted")
                later_focus("#search")
              }),
            ) <| [
              @element.text("Delete"),
            ],
          ],
        ],
      )
    }),
  ])
}

// ---------------------------------------------------------------------------

///|
fn mount(id : String, node : DomNode) -> Unit {
  match @dom.document().getElementById(id) {
    Some(e) => @element.render_to(e, node)
    None => ()
  }
}

///|
fn main {
  let root = doc()._get("documentElement")
  if query_has("theme=dark") {
    root._call("setAttribute", [@js.any("data-theme"), @js.any("dark")])
    |> ignore
  } else if query_has("theme=light") {
    root._call("setAttribute", [@js.any("data-theme"), @js.any("light")])
    |> ignore
  }
  instant.val = query_has("animate=0") ||
    media("(prefers-reduced-motion: reduce)")
  if query_has("history=empty") {
    convs.set([])
  } else if !query_has("chat=new") {
    current.set(convs.get()[0].id)
  }
  mount("sidebar", sidebar_view())
  mount("topbar", header_view())
  mount("conv", conversation_view())
  mount("overlays", overlays_view())

  // The shell's state classes, and what a modal or the drawer makes inert.
  let _ = @resource.effect(fn() {
    let cls = StringBuilder::new()
    cls.write_string("shell")
    if collapsed.get() {
      cls.write_string(" is-collapsed")
    }
    if drawer.get() {
      cls.write_string(" is-drawer")
    }
    if drawer_anim.get() {
      cls.write_string(" drawer-anim")
    }
    let shell = qs("#shell")
    if !@js.is_nullish(shell) {
      shell._set("className", @js.any(cls.to_string()))
    }
  })
  let _ = @resource.effect(fn() {
    let modal = share_open.get() || confirm_delete.get() >= 0
    set_inert("#shell", modal)
    set_inert(".main-col", drawer.get())
  })

  // A click outside any menu closes it.
  add_listener(doc(), "click", fn(e) {
    let t = e._get("target")
    let inside = if @js.is_nullish(t) || @js.is_nullish(t._get("closest")) {
      false
    } else {
      !@js.is_nullish(t._call("closest", [@js.any("[data-menu-root], .menu")]))
    }
    if !inside {
      if model_open.get() || attach_open.get() || row_menu.get() >= 0 {
        close_menus()
      }
    }
  })
  // The drawer: Escape closes it, Tab stays inside it.
  add_listener(qs("#sidebar"), "keydown", fn(e) {
    if drawer.get() {
      if key_of(e) == "Escape" && row_menu.get() < 0 && renaming.get() < 0 {
        prevent(e)
        set_drawer(false)
        focus_sel("#open-drawer")
      } else {
        trap_tab(e, qs("#sidebar"))
      }
    }
  })
  add_listener(win(), "resize", fn(_e) {
    if drawer_anim.get() {
      drawer_anim.set(false)
    }
    if drawer.get() && !is_phone() {
      drawer.set(false)
    }
    if row_menu.get() >= 0 {
      row_menu.set(-1)
    }
  })
  set_timeout(fn() { scroll_to_end() }, 0) |> ignore
}
