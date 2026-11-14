// The side panel (a bottom sheet on phones): results, a place, directions, saved.

///|
fn stars(r : Int) -> @element.DomNode {
  let full = (r + 5) / 10
  let kids : Array[@element.DomNode] = []
  for i = 0; i < 5; i = i + 1 {
    kids.push(
      @element.span(class=if i < full { "star on" } else { "star" }) <| [@element.text("\u{2605}")],
    )
  }
  @element.span(class="stars", attrs=[sa("aria-hidden", "true")]) <| kids
}

///|
fn status_line(p : Place) -> @element.DomNode {
  let (open, rest) = open_status(p)
  @element.span(class="status") <| [
    @element.span(class=if open { "st-open" } else { "st-closed" }) <| [
      @element.text(if open { "Open" } else { "Closed" }),
    ],
    @element.text(" \u{b7} \{rest}"),
  ]
}

///|
fn result_row(id : Int) -> @element.DomNode {
  let p = places[id]
  @element.li(class="row-item") <| [
    @element.button(
      class="row",
      id="row-\{id}",
      attrs=[sa("type", "button")],
      on=@element.events()
        .mouseenter(fn(_e) { hot.set(id) })
        .mouseleave(fn(_e) { if hot.get() == id { hot.set(-1) } })
        .focus(fn(_e) { hot.set(id) })
        .blur(fn(_e) { if hot.get() == id { hot.set(-1) } })
        .click(fn(_e) {
          hot.set(-1)
          select_place(id)
        }),
    ) <| [
      @element.span(class="row-text") <| [
        @element.span(class="row-name") <| [@element.text(p.name)],
        @element.span(class="row-rating") <| [
          @element.text(rating_str(p.rating) + " "),
          stars(p.rating),
          @element.span(class="row-count") <| [@element.text(" (\{p.reviews})")],
        ],
        @element.span(class="row-meta") <| [
          @element.text("\{cat_singular[p.cat]} \u{b7} \{place_area(p)} \u{b7} \{place_address(p)}"),
        ],
        status_line(p),
      ],
      @element.span(class="row-photo") <| [place_art(p, 84, 84, false)],
    ],
  ]
}

///|
fn results_view() -> @element.DomNode {
  @element.section(class="results", attrs=[sa("aria-labelledby", "results-h")]) <| [
    @element.div(class="results-head") <| [
      @element.h2(id="results-h") <| [@element.text("Results")],
      @element.button(
        class="link-btn",
        attrs=[sa("type", "button")],
        on=@element.events().click(fn(_e) {
          let q = query.get()
          let slug = if q.cat >= 0 { cat_names[q.cat].to_lower() } else { q.text.to_lower() }
          open_share("https://maps.wayfarer.example/search/\{slug}")
        }),
      ) <| [icon(ic_share, size=18), @element.text("Share")],
    ],
    @element.p(class="results-sub") <| [
      @element.text_dyn(fn() {
        let n = results().length()
        let what = query.get().label
        let noun = if n == 1 { "place" } else { "places" }
        "\{what} \u{b7} \{n} \{noun}" + (if follow_map.get() { " in this area" } else { "" })
      }),
    ],
    @element.ul(class="rows", attrs=[sa("aria-label", "Results")]) <| [
      @element.for_each(fn() { results() }, fn(id, _i) { result_row(id) }),
    ],
    @element.show(fn() { results().length() == 0 }, fn() {
      @element.p(class="empty") <| [
        @element.text("No results in this part of the map. Move the map or untick the box below."),
      ]
    }),
  ]
}

///|
fn round_action(
  label : String,
  ic : @element.DomNode,
  pressed : (() -> String)?,
  f : () -> Unit,
) -> @element.DomNode {
  let dattrs = match pressed {
    Some(g) => [da("aria-pressed", g)]
    None => []
  }
  @element.button(
    class="act",
    attrs=[sa("type", "button")],
    dyn_attrs=dattrs,
    on=@element.events().click(fn(_e) { f() }),
  ) <| [@element.span(class="act-circle") <| [ic], @element.span(class="act-label") <| [@element.text(label)]]
}

///|
/// A tab list with roving focus. ids: tab ids; sig: the selected index.
fn tablist(
  label : String,
  prefix : String,
  names : Array[String],
  subs : Array[() -> String],
  sig : @resource.Signal[Int],
) -> @element.DomNode {
  let n = names.length()
  let tabs : Array[@element.DomNode] = []
  for i, name in names {
    tabs.push(
      @element.button(
        id="\{prefix}-tab-\{i}",
        attrs=[
          sa("role", "tab"),
          sa("type", "button"),
          sa("aria-controls", if prefix == "mode" { "mode-panel" } else { "\{prefix}-panel-\{i}" }),
        ],
        dyn_attrs=[
          da("aria-selected", fn() { (sig.get() == i).to_string() }),
          da("tabindex", fn() { if sig.get() == i { "0" } else { "-1" } }),
        ],
        dyn_class=fn() { if sig.get() == i { "tab on" } else { "tab" } },
        on=@element.events()
          .click(fn(_e) { sig.set(i) })
          .keydown(fn(e) {
            let e = ev(e)
            let k = ev_str(e, "key")
            let next = match k {
              "ArrowRight" => (i + 1) % n
              "ArrowLeft" => (i + n - 1) % n
              "Home" => 0
              "End" => n - 1
              _ => -1
            }
            if next >= 0 {
              ev_prevent(e)
              sig.set(next)
              focus_id("\{prefix}-tab-\{next}")
            }
          }),
      ) <| [
        @element.span(class="tab-name") <| [@element.text(name)],
        @element.show(fn() { subs.length() > i }, fn() {
          @element.span(class="tab-sub") <| [@element.text_dyn(fn() { subs[i]() })]
        }),
      ],
    )
  }
  @element.div(class="tabs", attrs=[sa("role", "tablist"), sa("aria-label", label)]) <| tabs
}

///|
fn tabpanel(prefix : String, i : Int, sig : @resource.Signal[Int], kids : Array[@element.DomNode]) -> @element.DomNode {
  @element.div(
    id="\{prefix}-panel-\{i}",
    attrs=[sa("role", "tabpanel"), sa("aria-labelledby", "\{prefix}-tab-\{i}"), sa("tabindex", "0")],
    dyn_class=fn() { if sig.get() == i { "tabpanel" } else { "tabpanel off" } },
  ) <| kids
}

///|
let sort_names : Array[String] = ["Most relevant", "Newest", "Highest rating", "Lowest rating"]

///|
fn sorted_reviews(p : Place, how : Int) -> Array[Review] {
  let rs = place_reviews(p)
  match how {
    1 => rs.sort_by(fn(a, b) { b.key - a.key })
    2 => rs.sort_by(fn(a, b) { if b.stars != a.stars { b.stars - a.stars } else { a.order - b.order } })
    3 => rs.sort_by(fn(a, b) { if a.stars != b.stars { a.stars - b.stars } else { a.order - b.order } })
    _ => ()
  }
  rs
}

///|
fn sort_menu() -> @element.DomNode {
  let items : Array[@element.DomNode] = []
  let n = sort_names.length()
  for i, name in sort_names {
    items.push(
      @element.li(attrs=[sa("role", "none")]) <| [
        @element.button(
          id="sort-\{i}",
          class="menu-item",
          attrs=[sa("role", "menuitemradio"), sa("type", "button"), sa("tabindex", "-1")],
          dyn_attrs=[da("aria-checked", fn() { (review_sort.get() == i).to_string() })],
          on=@element.events()
            .click(fn(_e) {
              review_sort.set(i)
              sort_open.set(false)
              focus_id("sort-btn")
            })
            .keydown(fn(e) {
              let e = ev(e)
              let k = ev_str(e, "key")
              let next = match k {
                "ArrowDown" => (i + 1) % n
                "ArrowUp" => (i + n - 1) % n
                "Home" => 0
                "End" => n - 1
                _ => -1
              }
              if next >= 0 {
                ev_prevent(e)
                focus_id("sort-\{next}")
              } else if k == "Escape" || k == "Tab" {
                if k == "Escape" {
                  ev_prevent(e)
                }
                sort_open.set(false)
                focus_id("sort-btn")
              }
            }),
        ) <| [
          @element.span(class="menu-check") <| [icon(ic_check, size=16)],
          @element.text(name),
        ],
      ],
    )
  }
  @element.div(class="sort") <| [
    @element.button(
      id="sort-btn",
      class="pill-btn",
      attrs=[sa("type", "button"), sa("aria-haspopup", "menu"), sa("aria-controls", "sort-menu")],
      dyn_attrs=[da("aria-expanded", fn() { sort_open.get().to_string() })],
      on=@element.events()
        .click(fn(_e) {
          let o = !sort_open.get()
          sort_open.set(o)
          if o {
            focus_later("sort-\{review_sort.get()}")
          }
        })
        .keydown(fn(e) {
          let e = ev(e)
          if ev_str(e, "key") == "ArrowDown" {
            ev_prevent(e)
            sort_open.set(true)
            focus_later("sort-\{review_sort.get()}")
          }
        }),
    ) <| [
      icon(ic_sort, size=18),
      @element.span() <| [@element.text("Sort: ")],
      @element.span(class="pill-sub") <| [@element.text_dyn(fn() { sort_names[review_sort.get()] })],
    ],
    @element.ul(
      id="sort-menu",
      attrs=[sa("role", "menu"), sa("aria-label", "Sort reviews")],
      dyn_class=fn() { if sort_open.get() { "menu" } else { "menu off" } },
    ) <| items,
  ]
}

///|
fn place_view(id : Int) -> @element.DomNode {
  let p = places[id]
  let (open, rest) = open_status(p)
  let hours_rows : Array[@element.DomNode] = []
  for d = 0; d < 7; d = d + 1 {
    let today = d == now_day
    hours_rows.push(
      @element.create_element(
        "tr",
        if today {
          [("class", @element.Static("today"))]
        } else {
          []
        },
        [
          @element.create_element("th", [("scope", @element.Static("row"))], [@element.text(day_names[d])]),
          @element.create_element("td", [], [@element.text(hours_label(hours_table[p.hours][d]))]),
        ],
      ),
    )
  }
  let price = price_str(p.price)
  let cat_line = if price == "" {
    cat_singular[p.cat]
  } else {
    "\{cat_singular[p.cat]} \u{b7} \{price}"
  }
  let amen : Array[@element.DomNode] = amenities[p.cat].map(fn(a) {
    @element.li() <| [icon(ic_check, size=16), @element.text(a)]
  })
  @element.article(class="place", attrs=[sa("aria-labelledby", "place-h")]) <| [
    @element.div(class="place-hero") <| [
      place_art(p, 420, 180, true),
      @element.button(
        class="back-btn",
        attrs=[
          sa("type", "button"),
          sa("aria-label", "Back"),
        ],
        on=@element.events().click(fn(_e) { back_from_place() }),
      ) <| [icon(ic_back, size=20)],
    ],
    @element.div(class="place-head") <| [
      @element.h2(id="place-h", attrs=[sa("tabindex", "-1")]) <| [@element.text(p.name)],
      @element.p(class="place-rating") <| [
        @element.text(rating_str(p.rating) + " "),
        stars(p.rating),
        @element.span(class="row-count") <| [@element.text(" (\{p.reviews})")],
      ],
      @element.p(class="place-cat") <| [@element.text(cat_line)],
    ],
    @element.div(class="actions") <| [
      round_action("Directions", directions_icon(22), None, fn() { open_directions(id) }),
      round_action(
        "Save",
        filled_icon(ic_bookmark, size=20),
        Some(fn() { is_saved(id).to_string() }),
        fn() {
          toggle_saved(id)
          toast.set(if is_saved(id) { "Saved \{p.name}" } else { "Removed \{p.name} from Saved" })
        },
      ),
      round_action("Nearby", icon(ic_nearby, size=20), None, fn() {
        chip.set(p.cat)
        show_results({ cat: p.cat, text: "", near: true, nx: p.x, ny: p.y, label: "\{cat_names[p.cat]} near \{p.name}" })
      }),
      round_action("Share", icon(ic_share, size=20), None, fn() {
        open_share("https://maps.wayfarer.example/place/\{p.id}")
      }),
      round_action("Send to phone", icon(ic_phone, size=20), None, fn() {
        toast.set("Sent \{p.name} to your phone")
      }),
    ],
    tablist("About this place", "pt", ["Overview", "Reviews", "About"], [], place_tab),
    tabpanel("pt", 0, place_tab, [
      @element.ul(class="facts") <| [
        @element.li() <| [icon(ic_pin, size=20), @element.text(place_address(p) + ", " + place_area(p) + ", Port Lumen")],
        @element.li(class="fact-hours") <| [
          icon(ic_clock, size=20),
          @element.div() <| [
            @element.p(class="status-big") <| [
              @element.span(class=if open { "st-open" } else { "st-closed" }) <| [
                @element.text(if open { "Open" } else { "Closed" }),
              ],
              @element.text(" \u{b7} \{rest}"),
            ],
            @element.create_element("table", [("class", @element.Static("hours"))], [
              @element.create_element("caption", [("class", @element.Static("sr-only"))], [
                @element.text("Opening hours"),
              ]),
              @element.create_element("tbody", [], hours_rows),
            ]),
          ],
        ],
        @element.li() <| [
          icon(ic_globe, size=20),
          @element.a(href="https://\{p.site}/", class="site-link") <| [@element.text(p.site)],
        ],
      ],
    ]),
    tabpanel("pt", 1, place_tab, [
      @element.div(class="reviews-head") <| [
        @element.p(class="reviews-score") <| [
          @element.span(class="big-num") <| [@element.text(rating_str(p.rating))],
          stars(p.rating),
          @element.span(class="row-count") <| [@element.text("\{p.reviews} reviews")],
        ],
        sort_menu(),
      ],
      @element.ul(class="reviews") <| [
        @element.for_each(fn() { [review_sort.get()] }, fn(how, _i) {
          @element.fragment(
            sorted_reviews(p, how).map(fn(r) {
              @element.li(class="review") <| [
                @element.span(class="avatar", attrs=[sa("aria-hidden", "true")]) <| [
                  @element.text(r.author.substring(start=0, end=1)),
                ],
                @element.div() <| [
                  @element.p(class="rev-author") <| [@element.text(r.author)],
                  @element.p(class="rev-meta") <| [
                    @element.span(class="sr-only") <| [@element.text("\{r.stars} out of 5 stars, ")],
                    stars(r.stars * 10),
                    @element.text(" " + r.date),
                  ],
                  @element.p(class="rev-text") <| [@element.text(r.text)],
                ],
              ]
            }),
          )
        }),
      ],
    ]),
    tabpanel("pt", 2, place_tab, [
      @element.p(class="about-blurb") <| [@element.text(p.blurb)],
      @element.h3() <| [@element.text("Amenities")],
      @element.ul(class="amenities") <| amen,
    ]),
  ]
}

// ---------------------------------------------------------------- directions

///|
fn place_field(
  label : String,
  key : String,
  sig : @resource.Signal[Int],
  holder : Ref[@js.Any?],
) -> @element.DomNode {
  let text = @resource.signal("")
  let open = @resource.signal(false)
  let active = @resource.signal(-1)
  let opts = @resource.memo(fn() {
    let t = text.get().trim().to_string().to_lower()
    let out : Array[Int] = []
    for p in places {
      if out.length() < 6 && (t == "" || p.name.to_lower().contains(t)) {
        out.push(p.id)
      }
    }
    out
  })
  let choose = fn(id : Int) {
    sig.set(id)
    text.set(places[id].name)
    match holder.val {
      Some(el) => set_value(el, places[id].name)
      None => ()
    }
    open.set(false)
    active.set(-1)
    let p = places[id]
    let other = if key == "from" { dir_to.get() } else { dir_from.get() }
    if other >= 0 {
      let q = places[other]
      let mx = (p.x + q.x) / 2.0
      let my = (p.y + q.y) / 2.0
      let span = world_dist(p.x, p.y, q.x, q.y)
      let z = if span > 1800.0 { 2.0 } else if span > 900.0 { 2.5 } else { 3.0 }
      ease_to_point(mx, my, z)
    }
  }
  @element.div(class="field") <| [
    @element.label(for_="dir-\{key}", class="field-label") <| [@element.text(label)],
    @element.input(
      type_="text",
      id="dir-\{key}",
      placeholder=if key == "from" { "Choose starting point" } else { "Choose destination" },
      attrs=[
        sa("role", "combobox"),
        sa("aria-autocomplete", "list"),
        sa("aria-controls", "dir-\{key}-list"),
        sa("autocomplete", "off"),
      ],
      dyn_attrs=[
        da("aria-expanded", fn() { open.get().to_string() }),
        da("aria-activedescendant", fn() {
          if open.get() && active.get() >= 0 {
            "dir-\{key}-opt-\{active.get()}"
          } else {
            ""
          }
        }),
      ],
      ref_=fn(el) {
        let a : @js.Any = el |> @js.identity
        holder.val = Some(a)
        let s = sig.get()
        if s >= 0 {
          set_value(a, places[s].name)
          text.set(places[s].name)
        }
      },
      on=@element.events()
        .input(fn(e) {
          let t : @js.Any = ev(e)._get("target")
          text.set(t._get("value").cast())
          open.set(true)
          active.set(-1)
        })
        .focus(fn(_e) { open.set(true) })
        .blur(fn(_e) { open.set(false) })
        .keydown(fn(e) {
          let e = ev(e)
          let k = ev_str(e, "key")
          let n = opts().length()
          match k {
            "ArrowDown" => {
              ev_prevent(e)
              open.set(true)
              active.set(if n == 0 { -1 } else { (active.get() + 1) % n })
            }
            "ArrowUp" => {
              ev_prevent(e)
              open.set(true)
              let a = active.get()
              active.set(if n == 0 { -1 } else if a <= 0 { n - 1 } else { a - 1 })
            }
            "Enter" => {
              ev_prevent(e)
              let a = active.get()
              if a >= 0 && a < n {
                choose(opts()[a])
              } else if n > 0 {
                choose(opts()[0])
              }
            }
            "Escape" => open.set(false)
            _ => ()
          }
        }),
    ),
    @element.ul(
      id="dir-\{key}-list",
      attrs=[sa("role", "listbox"), sa("aria-label", "\{label} suggestions")],
      dyn_class=fn() { if open.get() { "field-list" } else { "field-list off" } },
    ) <| [
      @element.index_each(fn() { opts() }, fn(item, i) {
        @element.li(
          id="dir-\{key}-opt-\{i}",
          attrs=[sa("role", "option")],
          dyn_attrs=[da("aria-selected", fn() { (active.get() == i).to_string() })],
          dyn_class=fn() { if active.get() == i { "opt active" } else { "opt" } },
          on=@element.events()
            .mousedown(fn(e) { ev_prevent(ev(e)) })
            .click(fn(_e) { choose(item()) }),
        ) <| [
          @element.span(class="opt-main") <| [@element.text_dyn(fn() { places[item()].name })],
          @element.span(class="opt-sub") <| [@element.text_dyn(fn() { place_area(places[item()]) })],
        ]
      }),
    ],
  ]
}

///|
let from_el : Ref[@js.Any?] = Ref(None)

///|
let to_el : Ref[@js.Any?] = Ref(None)

///|
fn directions_view() -> @element.DomNode {
  let subs : Array[() -> String] = [0, 1, 2, 3].map(fn(m) {
    fn() {
      match route() {
        Some(r) => "\{mode_minutes(m, r.length)} min"
        None => "\u{2013}"
      }
    }
  })
  @element.section(class="dir", attrs=[sa("aria-labelledby", "dir-h")]) <| [
    @element.div(class="dir-head") <| [
      @element.h2(id="dir-h") <| [@element.text("Directions")],
      @element.button(
        class="icon-btn",
        attrs=[sa("type", "button"), sa("aria-label", "Close directions")],
        on=@element.events().click(fn(_e) {
          if selected.get() >= 0 {
            panel.set(2)
          } else if has_results.get() {
            panel.set(1)
          } else {
            panel.set(0)
          }
        }),
      ) <| [icon(ic_close, size=20)],
    ],
    tablist("Travel mode", "mode", mode_names, subs, dir_mode),
    @element.div(class="dir-fields") <| [
      @element.div(class="dir-inputs") <| [
        place_field("From", "from", dir_from, from_el),
        place_field("To", "to", dir_to, to_el),
      ],
      @element.button(
        class="icon-btn swap-btn",
        attrs=[sa("type", "button"), sa("aria-label", "Swap start and destination")],
        on=@element.events().click(fn(_e) {
          let a = dir_from.get()
          let b = dir_to.get()
          @resource.batch(fn() {
            dir_from.set(b)
            dir_to.set(a)
          })
          match from_el.val {
            Some(el) => set_value(el, if b >= 0 { places[b].name } else { "" })
            None => ()
          }
          match to_el.val {
            Some(el) => set_value(el, if a >= 0 { places[a].name } else { "" })
            None => ()
          }
        }),
      ) <| [icon(ic_swap, size=20)],
    ],
    @element.div(
      id="mode-panel",
      attrs=[sa("role", "tabpanel")],
      dyn_attrs=[da("aria-labelledby", fn() { "mode-tab-\{dir_mode.get()}" })],
    ) <| [
    @element.show(fn() { route() is None }, fn() {
      @element.div(class="dir-hint") <| [
        @element.p() <| [@element.text("Choose a start and a destination to see the route.")],
        @element.p(class="dir-try") <| [@element.text("Try one of these:")],
        @element.ul(class="dir-presets") <| [
          ..routes.map(fn(r) {
            let (a, b, _, _) = r
            @element.li() <| [
              @element.button(
                class="link-btn",
                attrs=[sa("type", "button")],
                on=@element.events().click(fn(_e) {
                  @resource.batch(fn() {
                    dir_from.set(a)
                    dir_to.set(b)
                  })
                  match from_el.val {
                    Some(el) => set_value(el, places[a].name)
                    None => ()
                  }
                  match to_el.val {
                    Some(el) => set_value(el, places[b].name)
                    None => ()
                  }
                  let pa = places[a]
                  let pb = places[b]
                  ease_to_point((pa.x + pb.x) / 2.0, (pa.y + pb.y) / 2.0, 2.5)
                }),
              ) <| [@element.text("\{places[a].name} to \{places[b].name}")],
            ]
          }),
        ],
      ]
    }),
    @element.for_each(fn() { if route() is Some(_) { [dir_from.get() * 100 + dir_to.get()] } else { [] } }, fn(_k, _i) {
      match route() {
        Some(r) =>
          @element.div(class="dir-result") <| [
            @element.p(class="dir-summary") <| [
              @element.strong() <| [@element.text_dyn(fn() { "\{mode_minutes(dir_mode.get(), r.length)} min" })],
              @element.text(" (\{dist_label(r.length)})"),
              @element.show(fn() { r.approx }, fn() {
                @element.span(class="badge") <| [@element.text("Approximate")]
              }),
            ],
            @element.p(class="dir-note") <| [
              @element.text(
                if r.approx {
                  "Straight-line estimate: there is no street route for this pair yet."
                } else {
                  "Along the streets, via the fastest route."
                },
              ),
            ],
            @element.ol(class="steps") <| r.steps.map(fn(s) { @element.li() <| [@element.text(s)] }),
          ]
        None => @element.fragment([])
      }
    }),
    ],
  ]
}

///|
fn saved_view() -> @element.DomNode {
  @element.section(class="results", attrs=[sa("aria-labelledby", "saved-h")]) <| [
    @element.div(class="results-head") <| [@element.h2(id="saved-h") <| [@element.text("Saved")]],
    @element.show(fn() { saved.get().length() == 0 }, fn() {
      @element.p(class="empty") <| [@element.text("Nothing saved yet. Open a place and choose Save.")]
    }),
    @element.ul(class="rows", attrs=[sa("aria-label", "Saved places")]) <| [
      @element.for_each(fn() { saved.get() }, fn(id, _i) { result_row(id) }),
    ],
  ]
}

///|
fn open_share(url : String) -> Unit {
  share_url.set(url)
  copied.set(false)
  match share_el.val {
    Some(el) => dialog_show(el)
    None => ()
  }
}
