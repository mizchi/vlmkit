// Wayfarer Maps: the layout, the sheet, the controls, and start-up.

///|
fn rail() -> @element.DomNode {
  @element.nav(class="rail", attrs=[sa("aria-label", "Wayfarer Maps")]) <| [
    @element.div(class="brand") <| [
      @element.svg(
        width="32",
        height="32",
        viewBox="0 0 32 32",
        attrs=[sa("aria-hidden", "true"), sa("focusable", "false")],
      ) <| [
        @element.svg_circle(cx="16", cy="16", r="15", fill="#1a5fb4"),
        @element.svg_path(d="M16 6l6 16-6-4-6 4Z", fill="#fff"),
      ],
      @element.span(class="brand-name") <| [@element.text("Wayfarer Maps")],
    ],
    @element.button(
      class="rail-btn",
      attrs=[sa("type", "button")],
      dyn_attrs=[da("aria-current", fn() { if panel.get() == 4 { "true" } else { "false" } })],
      on=@element.events().click(fn(_e) { open_panel(4) }),
    ) <| [@element.span(class="rail-ic") <| [icon(ic_saved, size=20)], @element.text("Saved")],
    @element.button(
      class="rail-btn",
      attrs=[sa("type", "button")],
      dyn_attrs=[da("aria-current", fn() { if panel.get() == 3 { "true" } else { "false" } })],
      on=@element.events().click(fn(_e) { open_directions(selected.get()) }),
    ) <| [@element.span(class="rail-ic") <| [directions_icon(22)], @element.text("Directions")],
  ]
}

///|
let sheet_start : Ref[(Double, Double)] = Ref((0.0, 0.0))

///|
let sheet_moved : Ref[Bool] = Ref(false)

///|
let sheet_down : Ref[Bool] = Ref(false)

///|
fn sheet_title() -> String {
  match panel.get() {
    1 => {
      let n = results().length()
      "\{query.get().label} \u{b7} \{n} " + (if n == 1 { "place" } else { "places" })
    }
    2 => {
      let s = selected.get()
      if s >= 0 {
        places[s].name
      } else {
        "Place"
      }
    }
    3 => "Directions"
    4 => "Saved"
    _ => ""
  }
}

///|
fn sheet_handle() -> @element.DomNode {
  let names = ["peek", "half", "full"]
  @element.button(
    class="sheet-handle",
    attrs=[sa("type", "button"), sa("aria-controls", "panel-scroll")],
    dyn_attrs=[
      da("aria-label", fn() {
        let next = ["expand", "expand to full height", "collapse to a peek"]
        "\{sheet_title()}: sheet at \{names[sheet.get()]}, \{next[sheet.get()]}"
      }),
    ],
    on=@element.events()
      .pointerdown(fn(e) {
        let e = ev(e)
        sheet_down.val = true
        sheet_moved.val = false
        sheet_start.val = (ev_num(e, "clientY"), sheet_height())
        let t : @js.Any = e._get("currentTarget")
        capture(t, e)
      })
      .pointermove(fn(e) {
        if !sheet_down.val {
          return
        }
        let e = ev(e)
        let (y0, h0) = sheet_start.val
        let dy = ev_num(e, "clientY") - y0
        if dy.abs() > 6.0 {
          sheet_moved.val = true
        }
        if sheet_moved.val {
          sheet_drag.set(clampd(h0 - dy, 96.0, map_h.get() - 110.0))
        }
      })
      .pointerup(fn(e) {
        if !sheet_down.val {
          return
        }
        sheet_down.val = false
        let e = ev(e)
        let t : @js.Any = e._get("currentTarget")
        release(t, e)
        if sheet_moved.val {
          let h = sheet_drag.get()
          let mut best = 0
          let mut bd = 1.0e9
          for i = 0; i < 3; i = i + 1 {
            let d = (snap_height(i) - h).abs()
            if d < bd {
              bd = d
              best = i
            }
          }
          @resource.batch(fn() {
            sheet.set(best)
            sheet_drag.set(-1.0)
          })
        }
      })
      .pointercancel(fn(_e) {
        sheet_down.val = false
        sheet_drag.set(-1.0)
      })
      .click(fn(_e) {
        if sheet_moved.val {
          sheet_moved.val = false
          return
        }
        sheet.update(fn(s) { (s + 1) % 3 })
      }),
  ) <| [
    @element.span(class="grabber", attrs=[sa("aria-hidden", "true")]) <| [],
    @element.span(class="sheet-title") <| [@element.text_dyn(sheet_title)],
  ]
}

///|
fn side_panel() -> @element.DomNode {
  @element.fragment([
    @element.aside(
      id="panel",
      attrs=[sa("aria-label", "Side panel")],
      dyn_class=fn() {
        let mut c = "panel"
        if panel.get() == 0 {
          c = c + " none"
        }
        if collapsed.get() && !mobile.get() {
          c = c + " collapsed"
        }
        if sheet_drag.get() >= 0.0 {
          c = c + " sheet-dragging"
        }
        c + " sheet-\{["peek", "half", "full"][sheet.get()]}"
      },
      dyn_style=fn() {
        if mobile.get() {
          "height: \{fmt1(sheet_height())}px"
        } else {
          ""
        }
      },
    ) <| [
      sheet_handle(),
      @element.div(id="panel-scroll", class="panel-scroll") <| [
        @element.show(fn() { panel.get() == 1 }, results_view),
        @element.for_each(fn() { if panel.get() == 2 && selected.get() >= 0 { [selected.get()] } else { [] } }, fn(
          id,
          _i,
        ) {
          place_view(id)
        }),
        @element.show(fn() { panel.get() == 3 }, directions_view),
        @element.show(fn() { panel.get() == 4 }, saved_view),
      ],
      @element.show(fn() { panel.get() == 1 }, fn() {
        @element.div(class="panel-foot") <| [
          @element.label(class="follow") <| [
            @element.input(
              type_="checkbox",
              id="follow",
              dyn_checked=fn() { follow_map.get() },
              on=@element.events().change(fn(e) {
                let t : @js.Any = ev(e)._get("target")
                follow_map.set(t._get("checked").cast())
              }),
            ),
            @element.text("Update results when map moves"),
          ],
        ]
      }),
    ],
    @element.button(
      class="collapse-tab",
      attrs=[sa("type", "button"), sa("aria-controls", "panel")],
      dyn_attrs=[
        da("aria-expanded", fn() { (!collapsed.get()).to_string() }),
        da("aria-label", fn() {
          if collapsed.get() {
            "Expand side panel"
          } else {
            "Collapse side panel"
          }
        }),
      ],
      dyn_class=fn() {
        if panel.get() == 0 {
          "collapse-tab off"
        } else if collapsed.get() {
          "collapse-tab is-collapsed"
        } else {
          "collapse-tab"
        }
      },
      on=@element.events().click(fn(_e) { collapsed.update(fn(c) { !c }) }),
    ) <| [
      @element.span(class="tab-chev") <| [
        @element.svg(
          width="18",
          height="18",
          viewBox="0 0 24 24",
          fill="none",
          stroke="currentColor",
          attrs=[sa("aria-hidden", "true")],
        ) <| [
          @element.svg_path(
            stroke_width="2.2",
            stroke_linecap="round",
            stroke_linejoin="round",
            dyn_attrs=[da("d", fn() { if collapsed.get() { ic_chev_right } else { ic_chev_left } })],
          ),
        ],
      ],
      @element.span(class="tab-tip", attrs=[sa("aria-hidden", "true")]) <| [
        @element.text_dyn(fn() { if collapsed.get() { "Expand side panel" } else { "Collapse side panel" } }),
      ],
    ],
  ])
}

///|
fn layer_thumb(i : Int) -> @element.DomNode {
  // a tiny map in that layer's colours
  let water = ["#a9d3f2", "#a9d3f2", "#86bfe8"]
  let park = ["#c8e6bf", "#c8e6bf", "#97cf86"]
  let rail = ["#9aa0a6", "#6f42c1", "#9aa0a6"]
  @element.svg(
    width="56",
    height="56",
    viewBox="0 0 56 56",
    attrs=[sa("aria-hidden", "true"), sa("focusable", "false")],
  ) <| [
    @element.svg_rect(x="0", y="0", width="56", height="56", fill="#f3f1ec"),
    @element.svg_path(d="M0 40 Q 20 34 30 42 T 56 30 V 56 H 0 Z", fill=water[i]),
    @element.svg_rect(x="6", y="8", width="16", height="12", rx="2", fill=park[i]),
    @element.svg_path(d="M0 26 H56 M30 0 V56", stroke="#fff", stroke_width="4"),
    @element.svg_path(d="M0 14 L56 22", stroke="#f2c14e", stroke_width="4"),
    @element.svg_path(
      d="M0 34 L56 8",
      stroke=rail[i],
      stroke_width=if i == 1 { "3.5" } else { "2" },
      attrs=[sa("stroke-dasharray", "4 3")],
    ),
  ]
}

///|
fn layers_control() -> @element.DomNode {
  let names = ["Default", "Transit", "Terrain"]
  let opts : Array[@element.DomNode] = []
  for i, n in names {
    opts.push(
      @element.button(
        class="layer-opt",
        attrs=[sa("type", "button")],
        dyn_attrs=[da("aria-pressed", fn() { (layer.get() == i).to_string() })],
        on=@element.events().click(fn(_e) { layer.set(i) }),
      ) <| [layer_thumb(i), @element.span() <| [@element.text(n)]],
    )
  }
  @element.div(class="layers no-drag") <| [
    @element.button(
      id="layers-btn",
      class="layers-btn",
      attrs=[sa("type", "button"), sa("aria-controls", "layers-pop")],
      dyn_attrs=[da("aria-expanded", fn() { layers_open.get().to_string() })],
      on=@element.events()
        .click(fn(_e) {
          let o = !layers_open.get()
          layers_open.set(o)
        })
        .keydown(fn(e) {
          if ev_str(ev(e), "key") == "Escape" {
            layers_open.set(false)
          }
        }),
    ) <| [
      @element.span(class="layers-thumb") <| [
        @element.for_each(fn() { [if layer.get() == 0 { 1 } else { 0 }] }, fn(i, _k) { layer_thumb(i) }),
      ],
      @element.span(class="layers-label") <| [@element.text("Layers")],
    ],
    @element.div(
      id="layers-pop",
      attrs=[sa("role", "group"), sa("aria-label", "Map layers")],
      dyn_class=fn() { if layers_open.get() { "layers-pop" } else { "layers-pop off" } },
      on=@element.events().keydown(fn(e) {
        if ev_str(ev(e), "key") == "Escape" {
          layers_open.set(false)
          focus_id("layers-btn")
        }
      }),
    ) <| opts,
  ]
}

///|
fn map_controls() -> @element.DomNode {
  @element.div(class="controls no-drag") <| [
    @element.div(class="zoom") <| [
      @element.button(
        class="zoom-btn",
        attrs=[sa("type", "button"), sa("aria-label", "Zoom in")],
        on=@element.events().click(fn(_e) { zoom_centre(1.0) }),
      ) <| [icon(ic_plus, size=22)],
      @element.span(class="zoom-sep", attrs=[sa("aria-hidden", "true")]) <| [],
      @element.button(
        class="zoom-btn",
        attrs=[sa("type", "button"), sa("aria-label", "Zoom out")],
        on=@element.events().click(fn(_e) { zoom_centre(-1.0) }),
      ) <| [icon(ic_minus, size=22)],
    ],
  ]
}

///|
fn foot_bar() -> @element.DomNode {
  @element.div(class="footbar no-drag") <| [
    @element.p(class="attrib") <| [@element.text("Port Lumen \u{b7} a fictional city drawn for Wayfarer Maps")],
    @element.div(class="scale", attrs=[sa("aria-label", "Map scale")]) <| [
      @element.span(class="scale-text") <| [@element.text_dyn(fn() { scale_bar().1 })],
      @element.span(class="scale-bar", dyn_style=fn() { "width: \{fmt1(scale_bar().0)}px" }) <| [],
    ],
  ]
}

///|
fn share_dialog() -> @element.DomNode {
  @element.create_element(
    "dialog",
    [
      ("class", @element.Static("dialog")),
      ("aria-labelledby", @element.Static("share-h")),
      ("__ref", @element.Handler(fn(el) { share_el.val = Some(el) })),
    ],
    [
      @element.h2(id="share-h") <| [@element.text("Share")],
      @element.p(class="dialog-sub") <| [@element.text("Anyone with this link sees the same place or results.")],
      @element.label(for_="share-link", class="field-label") <| [@element.text("Link")],
      @element.div(class="share-row") <| [
        @element.input(
          type_="text",
          id="share-link",
          readonly_=true,
          dyn_value=fn() { share_url.get() },
          on=@element.events().focus(fn(e) { select_all(ev(e)._get("target")) }),
        ),
        @element.button(
          class="primary-btn",
          attrs=[sa("type", "button")],
          on=@element.events().click(fn(_e) {
            copied.set(true)
            focus_id("share-link")
          }),
        ) <| [@element.text_dyn(fn() { if copied.get() { "Copied" } else { "Copy link" } })],
      ],
      @element.div(class="dialog-foot") <| [
        @element.button(
          class="text-btn",
          attrs=[sa("type", "button")],
          on=@element.events().click(fn(_e) {
            match share_el.val {
              Some(el) => dialog_close(el)
              None => ()
            }
          }),
        ) <| [@element.text("Close")],
      ],
    ],
  )
}

///|
fn toast_view() -> @element.DomNode {
  @element.div(class="toast-wrap", attrs=[sa("role", "status"), sa("aria-live", "polite")]) <| [
    @element.show(fn() { toast.get() != "" }, fn() {
      @element.div(class="toast") <| [
        @element.span() <| [@element.text_dyn(fn() { toast.get() })],
        @element.button(
          class="toast-close",
          attrs=[sa("type", "button"), sa("aria-label", "Dismiss")],
          on=@element.events().click(fn(_e) { toast.set("") }),
        ) <| [icon(ic_close, size=18)],
      ]
    }),
  ]
}

///|
fn app() -> @element.DomNode {
  @element.div(
    dyn_class=fn() {
      let mut c = "shell"
      if mobile.get() {
        c = c + " is-mobile"
      }
      if panel.get() != 0 && !collapsed.get() {
        c = c + " has-panel"
      }
      c + " pm-\{panel.get()} sheet-at-\{sheet.get()}"
    },
    dyn_style=fn() { "--sheet-h: \{fmt1(sheet_height())}px" },
  ) <| [
    rail(),
    @element.main_(class="map-wrap") <| [
      @element.h1(class="sr-only") <| [@element.text("Wayfarer Maps: Port Lumen")],
      map_view(),
      map_controls(),
      layers_control(),
      foot_bar(),
      toast_view(),
    ],
    side_panel(),
    @element.div(class="topbar") <| [search_box(), chips_row()],
    share_dialog(),
  ]
}

///|
fn measure() -> Unit {
  let w = win_w()
  let m = w < 768.0
  let (mw, mh) = match map_el.val {
    Some(el) => (el_width(el), el_height(el))
    None => (w - (if m { 0.0 } else { 72.0 }), win_h())
  }
  @resource.batch(fn() {
    mobile.set(m)
    map_w.set(if mw > 0.0 { mw } else { w })
    map_h.set(if mh > 0.0 { mh } else { win_h() })
  })
}

///|
fn read_url() -> Unit {
  let at = url_param("at")
  if at == "" && win_w() < 768.0 {
    view.set(phone_home)
  }
  if at != "" {
    let parts : Array[String] = at.split(",").map(fn(s) { s.to_string() }).collect()
    if parts.length() == 3 {
      let x = parse_num(parts[0])
      let y = parse_num(parts[1])
      let z = parse_num(parts[2])
      if !is_nan(x) && !is_nan(y) && !is_nan(z) {
        view.set(clamp_view({ cx: x, cy: y, z }))
      }
    }
  }
  let ly = url_param("layer")
  if ly == "transit" {
    layer.set(1)
  } else if ly == "terrain" {
    layer.set(2)
  }
  let sh = url_param("sheet")
  if sh == "peek" {
    sheet.set(0)
  } else if sh == "full" {
    sheet.set(2)
  }
  let cat = url_param("cat")
  for c, n in cat_names {
    if n.to_lower() == cat.to_lower() {
      show_category(c)
    }
  }
  let dir = url_param("dir")
  if dir != "" {
    let parts : Array[String] = dir.split("-").map(fn(s) { s.to_string() }).collect()
    if parts.length() == 2 {
      let a = parse_num(parts[0]).to_int()
      let b = parse_num(parts[1]).to_int()
      if a >= 0 && a < places.length() && b >= 0 && b < places.length() {
        dir_from.set(a)
        dir_to.set(b)
        open_panel(3)
      }
    }
  }
  let pl = url_param("place")
  if pl != "" {
    let id = parse_num(pl)
    if !is_nan(id) && id >= 0.0 && id.to_int() < places.length() {
      @resource.batch(fn() {
        selected.set(id.to_int())
        open_panel(2)
      })
      let tab = url_param("tab")
      if tab == "reviews" {
        place_tab.set(1)
      } else if tab == "about" {
        place_tab.set(2)
      }
    }
  }
}

///|
fn main {
  match @dom.document().getElementById("app") {
    Some(el) => {
      // read before read_url, which rewrites the query
      let given_at = url_param("at")
      read_url()
      @element.render_to(el, app())
      measure()
      // a place opened from the URL, with no view given, is centred in the free part of the map;
      // nothing eases on load, so any view animation read_url started is cancelled
      anim_token.val = anim_token.val + 1
      animating.set(false)
      let s = selected.get()
      if s >= 0 && given_at == "" {
        let p = places[s]
        let z = if view.get().z < 3.0 { 3.0 } else { view.get().z }
        view.set(clamp_view(point_view(p.x, p.y, z)))
      } else if panel.get() == 1 && given_at == "" {
        match fit_results() {
          Some(v) => view.set(clamp_view(v))
          None => ()
        }
      }
      sync_url()
      wire_wheel()
      on_window("resize", fn(_e) { measure() })
      on_window("pointerdown", fn(e) {
        if layers_open.get() && !target_in(e, ".layers") {
          layers_open.set(false)
        }
        if sort_open.get() && !target_in(e, ".sort") {
          sort_open.set(false)
        }
      })
      on_window("keydown", fn(e) {
        if ev_str(e, "key") == "Escape" && toast.get() != "" {
          toast.set("")
        }
      })
      match share_el.val {
        Some(d) => on_el(d, "close", fn(_e) { copied.set(false) })
        None => ()
      }
    }
    None => ()
  }
}
