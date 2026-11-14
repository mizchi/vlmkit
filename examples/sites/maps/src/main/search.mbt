// The search combobox and the category chips.

///|
enum Sugg {
  SCat(Int)
  SNear(Int, Int) // category, area index
  SPlace(Int)
  SArea(Int)
  SRecent(String)
}

///|
fn sugg_label(s : Sugg) -> (String, String) {
  match s {
    SCat(c) => (cat_names[c], "Category")
    SNear(c, a) => ("\{cat_names[c]} near \{areas[a].0}", "Category")
    SPlace(id) => (places[id].name, "\{cat_singular[places[id].cat]} \u{b7} \{place_area(places[id])}")
    SArea(a) => (areas[a].0, "Area of Port Lumen")
    SRecent(t) => (t, "")
  }
}

///|
fn sugg_icon(s : Sugg) -> String {
  match s {
    SCat(c) | SNear(c, _) => cat_icons[c]
    SPlace(id) => cat_icons[places[id].cat]
    SArea(_) => ic_pin
    SRecent(_) => ic_clock
  }
}

///|
fn area_near_view() -> Int {
  let v = view.get()
  let mut best = 0
  let mut bd = 1.0e9
  for i, a in areas {
    let d = world_dist(v.cx, v.cy, a.1, a.2)
    if d < bd {
      bd = d
      best = i
    }
  }
  best
}

///|
let suggestions : () -> Array[Sugg] = @resource.memo(fn() {
  let t = search_text.get().trim().to_string().to_lower()
  if t == "" {
    return recent_searches.map(fn(r) { SRecent(r) })
  }
  let out : Array[Sugg] = []
  for c, n in cat_names {
    let ln = n.to_lower()
    if ln.has_prefix(t) || cat_singular[c].to_lower().has_prefix(t) {
      out.push(SCat(c))
      out.push(SNear(c, area_near_view()))
    }
  }
  for i, a in areas {
    if a.0.to_lower().contains(t) {
      out.push(SArea(i))
    }
  }
  for p in places {
    if out.length() < 8 && p.name.to_lower().contains(t) {
      out.push(SPlace(p.id))
    }
  }
  out
})

///|
fn set_search_text(s : String) -> Unit {
  search_text.set(s)
  match search_el.val {
    Some(el) => set_value(el, s)
    None => ()
  }
}

///|
fn run_sugg(s : Sugg) -> Unit {
  search_open.set(false)
  search_active.set(-1)
  match s {
    SCat(c) => {
      set_search_text(cat_names[c])
      show_category(c)
    }
    SNear(c, a) => {
      let (n, x, y) = areas[a]
      set_search_text("\{cat_names[c]} near \{n}")
      chip.set(c)
      show_results({ cat: c, text: "", near: true, nx: x, ny: y, label: "\{cat_names[c]} near \{n}" })
      ease_to_point(x, y, 3.0)
    }
    SPlace(id) => {
      set_search_text(places[id].name)
      select_place(id)
    }
    SArea(a) => {
      let (n, x, y) = areas[a]
      set_search_text(n)
      ease_to_point(x, y, 3.0)
    }
    SRecent(t) => {
      set_search_text(t)
      run_text(t)
    }
  }
}

///|
/// Enter with nothing chosen: a category by name, a place by exact name, or a text search.
fn run_text(t0 : String) -> Unit {
  let t = t0.trim().to_string()
  if t == "" {
    return
  }
  let lt = t.to_lower()
  for c, n in cat_names {
    if n.to_lower() == lt || cat_singular[c].to_lower() == lt {
      show_category(c)
      return
    }
  }
  for p in places {
    if p.name.to_lower() == lt {
      select_place(p.id)
      return
    }
  }
  for a in areas {
    if a.0.to_lower() == lt {
      let (_, x, y) = a
      chip.set(-1)
      show_results({ cat: -1, text: t, near: true, nx: x, ny: y, label: t })
      ease_to_point(x, y, 3.0)
      return
    }
  }
  chip.set(-1)
  show_results({ cat: -1, text: t, near: false, nx: 0.0, ny: 0.0, label: t })
  match fit_results() {
    Some(v) => fly_to(v)
    None => ()
  }
}

///|
fn search_keydown(e : @js.Any) -> Unit {
  let k = ev_str(e, "key")
  let n = suggestions().length()
  match k {
    "ArrowDown" => {
      ev_prevent(e)
      if !search_open.get() {
        search_open.set(true)
        search_active.set(0)
      } else {
        search_active.set(if n == 0 { -1 } else { (search_active.get() + 1) % n })
      }
      scroll_into("sugg-\{search_active.get()}")
    }
    "ArrowUp" => {
      ev_prevent(e)
      search_open.set(true)
      let a = search_active.get()
      search_active.set(if n == 0 { -1 } else if a <= 0 { n - 1 } else { a - 1 })
      scroll_into("sugg-\{search_active.get()}")
    }
    "Enter" => {
      ev_prevent(e)
      let a = search_active.get()
      if search_open.get() && a >= 0 && a < n {
        run_sugg(suggestions()[a])
      } else {
        search_open.set(false)
        run_text(search_text.get())
      }
    }
    "Escape" =>
      if search_open.get() {
        search_open.set(false)
        search_active.set(-1)
      } else {
        set_search_text("")
      }
    _ => ()
  }
}

///|
fn search_box() -> @element.DomNode {
  @element.div(class="search", attrs=[sa("role", "search")]) <| [
    @element.span(
      id="q-label",
      dyn_class=fn() { if search_text.get() == "" { "q-hint" } else { "q-hint off" } },
    ) <| [@element.text("Search Wayfarer Maps")],
    @element.input(
      type_="text",
      id="q",
      attrs=[
        sa("aria-labelledby", "q-label"),
        sa("role", "combobox"),
        sa("aria-autocomplete", "list"),
        sa("aria-controls", "q-list"),
        sa("autocomplete", "off"),
        sa("spellcheck", "false"),
      ],
      dyn_attrs=[
        da("aria-expanded", fn() { search_open.get().to_string() }),
        da("aria-activedescendant", fn() {
          let a = search_active.get()
          if search_open.get() && a >= 0 {
            "sugg-\{a}"
          } else {
            ""
          }
        }),
      ],
      ref_=fn(el) { search_el.val = Some(el |> @js.identity) },
      on=@element.events()
        .input(fn(e) {
          let e = ev(e)
          let t : @js.Any = e._get("target")
          search_text.set(t._get("value").cast())
          search_open.set(true)
          search_active.set(-1)
        })
        .focus(fn(_e) {
          search_open.set(true)
          layers_open.set(false)
        })
        .blur(fn(_e) { search_open.set(false) })
        .keydown(fn(e) { search_keydown(ev(e)) }),
    ),
    @element.show(fn() { search_text.get() != "" }, fn() {
      @element.button(
        class="icon-btn clear-btn",
        attrs=[sa("type", "button"), sa("aria-label", "Clear search")],
        on=@element.events().click(fn(_e) {
          set_search_text("")
          close_everything()
          focus_id("q")
        }),
      ) <| [icon(ic_close, size=20)]
    }),
    @element.button(
      class="icon-btn search-btn",
      attrs=[sa("type", "button"), sa("aria-label", "Search")],
      on=@element.events().click(fn(_e) {
        if search_text.get().trim().to_string() == "" {
          focus_id("q")
        } else {
          search_open.set(false)
          run_text(search_text.get())
        }
      }),
    ) <| [icon(ic_search, size=22)],
    @element.button(
      class="icon-btn dir-btn",
      attrs=[sa("type", "button"), sa("aria-label", "Get directions")],
      on=@element.events().click(fn(_e) {
        if panel.get() == 3 && !collapsed.get() {
          focus_id("dir-from")
        } else {
          open_directions(selected.get())
        }
      }),
    ) <| [directions_icon(26)],
    @element.div(
      class="sugg",
      dyn_class=fn() { if search_open.get() { "sugg" } else { "sugg off" } },
    ) <| [
      @element.show(fn() { search_text.get().trim().to_string() == "" }, fn() {
        @element.p(class="sugg-head", id="q-recent", attrs=[sa("aria-hidden", "true")]) <| [
          @element.text("Recent"),
        ]
      }),
      @element.ul(
        id="q-list",
        attrs=[sa("role", "listbox")],
        dyn_attrs=[
          da("aria-label", fn() {
            if search_text.get().trim().to_string() == "" {
              "Recent searches"
            } else {
              "Suggestions"
            }
          }),
        ],
      ) <| [
        @element.index_each(fn() { suggestions() }, fn(item, i) {
          @element.li(
            id="sugg-\{i}",
            attrs=[sa("role", "option")],
            dyn_attrs=[da("aria-selected", fn() { (search_active.get() == i).to_string() })],
            dyn_class=fn() { if search_active.get() == i { "opt active" } else { "opt" } },
            on=@element.events()
              .mousedown(fn(e) { ev_prevent(ev(e)) })
              .click(fn(_e) { run_sugg(item()) }),
          ) <| [
            @element.span(class="opt-icon") <| [
              @element.svg(
                width="18",
                height="18",
                viewBox="0 0 24 24",
                fill="none",
                stroke="currentColor",
                attrs=[sa("aria-hidden", "true")],
              ) <| [
                @element.svg_path(
                  stroke_width="2",
                  stroke_linecap="round",
                  stroke_linejoin="round",
                  dyn_attrs=[da("d", fn() { sugg_icon(item()) })],
                ),
              ],
            ],
            @element.span(class="opt-text") <| [
              @element.span(class="opt-main") <| [@element.text_dyn(fn() { sugg_label(item()).0 })],
              @element.span(class="opt-sub") <| [@element.text_dyn(fn() { sugg_label(item()).1 })],
            ],
          ]
        }),
      ],
      @element.show(fn() { suggestions().length() == 0 }, fn() {
        @element.p(class="sugg-empty") <| [@element.text("No matching places. Press Enter to search.")]
      }),
    ],
  ]
}

///|
fn chips_row() -> @element.DomNode {
  let btns : Array[@element.DomNode] = []
  for c, n in cat_names {
    btns.push(
      @element.button(
        class="chip",
        attrs=[sa("type", "button"), sa("data-cat", c.to_string())],
        dyn_attrs=[da("aria-pressed", fn() { (chip.get() == c).to_string() })],
        on=@element.events().click(fn(_e) { toggle_chip(c) }),
      ) <| [
        @element.span(class="chip-icon") <| [icon(cat_icons[c], size=16)],
        @element.text(n),
      ],
    )
  }
  @element.div(class="chips", attrs=[sa("role", "group"), sa("aria-label", "Show places by category")]) <| btns
}
