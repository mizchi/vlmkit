// The home feed (index.html) and search results (index.html?q=).

///|
extern "js" fn js_on_window(kind : String, f : () -> Unit) -> Unit =
  #|(k, f) => window.addEventListener(k, () => f())

///|
struct Chip {
  key : String
  label : String
}

///|
let chips : Array[Chip] = [
  { key: "all", label: "All" },
  { key: "space", label: "Space" },
  { key: "cooking", label: "Cooking" },
  { key: "music", label: "Music" },
  { key: "travel", label: "Travel" },
  { key: "live", label: "Live" },
  { key: "recent", label: "Recently uploaded" },
]

///|
fn chip_matches(v : Video, key : String) -> Bool {
  match key {
    "all" => true
    "live" => v.live
    "recent" => v.recent
    k => v.topic.key() == k
  }
}

///|
fn watch_href(v : Video) -> String {
  "watch.html?v=\{v.id}"
}

///|
fn avatar(ch : Channel, class~ : String = "avatar") -> @element.DomNode {
  let initial = ch.name.view(start_offset=0, end_offset=1).to_string()
  @element.span(
    class~,
    style="background: hsl(\{ch.hue} 55% 30%)",
    attrs=[sattr("aria-hidden", "true"), sattr("data-initial", initial)],
  ) <| []
}

///|
/// Non-breaking spaces inside one phrase ("3 weeks ago"), so a line breaks at the
/// dot; a string with no spaces still wraps through overflow-wrap.
fn nbsp(s : String) -> String {
  s.replace_all(old=" ", new="\u{00A0}")
}

///|
/// "2.4M views · 3 weeks ago", breakable only at the dot.
fn meta_parts(v : Video) -> Array[@element.DomNode] {
  [
    @element.span(class="meta-part") <| [@element.text(nbsp(views_line(v)))],
    @element.text(" · "),
    @element.span(class="meta-part") <| [@element.text(nbsp(v.age))],
  ]
}

///|
fn badge(v : Video) -> @element.DomNode {
  @element.span(class=if v.live { "badge live" } else { "badge" }) <| [
    @element.text(duration_badge(v)),
  ]
}

///|
fn chip_bar(selected : @resource.Signal[String]) -> @element.DomNode {
  let state = @resource.signal(0)
  let el_ref : Ref[@js.Any?] = { val: None }
  let refresh = fn() {
    match el_ref.val {
      Some(el) => state.set(js_scroll_state(el))
      None => ()
    }
  }
  js_on_window("resize", refresh)
  @element.div(class="chipbar") <| [
    @element.show(fn() { (state.get() & 1) != 0 }, fn() {
      @element.button(
        class="chip-arrow chip-arrow-left",
        attrs=[sattr("aria-label", "Scroll topics left"), sattr("tabindex", "-1")],
        on=@element.events().click(fn(_e) { js_scroll_by("#chips", -240) }),
      ) <| [icon("left")]
    }),
    @element.div(
      id="chips",
      class="chips",
      attrs=[sattr("role", "group"), sattr("aria-label", "Filter by topic")],
      ref_=fn(el) {
        let a = element_any(el)
        el_ref.val = Some(a)
        js_on(a, "scroll", fn(_e) { refresh() })
        later(refresh)
      },
    ) <| chips.map(fn(c) {
      @element.button(
        class="chip",
        dyn_attrs=[dattr("aria-pressed", fn() { bool_s(selected.get() == c.key) })],
        on=@element.events().click(fn(_e) { selected.set(c.key) }),
      ) <| [@element.text(c.label)]
    }),
    @element.show(fn() { (state.get() & 2) != 0 }, fn() {
      @element.button(
        class="chip-arrow chip-arrow-right",
        attrs=[sattr("aria-label", "Scroll topics right"), sattr("tabindex", "-1")],
        on=@element.events().click(fn(_e) { js_scroll_by("#chips", 240) }),
      ) <| [icon("right")]
    }),
  ]
}

///|
let removed : @resource.Signal[Array[String]] = @resource.signal([])

///|
fn is_removed(id : String) -> Bool {
  removed.get().contains(id)
}

///|
fn card_menu(v : Video) -> @element.DomNode {
  menu_button(
    "m-\{v.id}",
    "More actions for \{v.title}",
    [icon("kebab")],
    [
      item("Add to queue", "queue", fn() { toast("Added to queue") }),
      item("Save to Watch later", "clock", fn() { toast("Saved to Watch later") }),
      item("Not interested", "hide", fn() {
        removed.update(fn(r) { r + [v.id] })
        // luna re-renders synchronously, so the row is already there.
        js_focus("#undo-\{v.id}")
      }),
      item("Share", "share", fn() { open_share(v, 0) }),
    ],
    trigger_class="icon-btn card-menu",
  )
}

///|
fn removed_row(v : Video) -> @element.DomNode {
  @element.div(class="removed") <| [
    @element.div() <| [
      @element.p(class="removed-title") <| [@element.text("Video removed")],
      @element.p(class="removed-note") <| [@element.text("You'll see fewer videos like this.")],
    ],
    @element.button(
      id="undo-\{v.id}",
      class="btn btn-tonal",
      attrs=[sattr("aria-label", "Undo: show \{v.title} again")],
      on=@element.events().click(fn(_e) {
        removed.update(fn(r) { r.filter(fn(x) { x != v.id }) })
        js_focus("#t-\{v.id}")
      }),
    ) <| [@element.text("Undo")],
  ]
}

///|
fn card(v : Video) -> @element.DomNode {
  let ch = channel_of(v)
  @element.article(
    dyn_class=fn() { if is_removed(v.id) { "card is-removed" } else { "card" } },
    attrs=[sattr("data-id", v.id)],
  ) <| [
    @element.show(fn() { is_removed(v.id) }, fn() { removed_row(v) }),
    @element.show(fn() { !is_removed(v.id) }, fn() {
      @element.fragment([
        @element.a(
          href=watch_href(v),
          class="thumb",
          attrs=[sattr("tabindex", "-1"), sattr("aria-hidden", "true")],
        ) <| [scene(v, still(v)), badge(v)],
        @element.div(class="card-body") <| [
          avatar(ch),
          @element.div(class="card-text") <| [
            @element.h3(class="card-title") <| [
              @element.a(id="t-\{v.id}", href=watch_href(v)) <| [@element.text(v.title)],
            ],
            @element.p(class="card-channel") <| [@element.text(ch.name)],
            @element.p(class="card-meta") <| meta_parts(v),
          ],
          card_menu(v),
        ],
      ])
    }),
  ]
}

///|
fn highlight(text : String, q : String) -> Array[@element.DomNode] {
  let out : Array[@element.DomNode] = []
  let ql = lower(q)
  if ql == "" {
    return [@element.text(text)]
  }
  let tl = lower(text)
  let mut pos = 0
  while pos < text.length() {
    let rest = tl.view(start_offset=pos)
    match rest.find(ql) {
      Some(i) => {
        if i > 0 {
          out.push(@element.text(text.view(start_offset=pos, end_offset=pos + i).to_string()))
        }
        out.push(
          @element.strong() <| [
            @element.text(text.view(start_offset=pos + i, end_offset=pos + i + ql.length()).to_string()),
          ],
        )
        pos = pos + i + ql.length()
      }
      None => {
        out.push(@element.text(text.view(start_offset=pos).to_string()))
        pos = text.length()
      }
    }
  }
  out
}

///|
fn result_row(v : Video, q : String) -> @element.DomNode {
  let ch = channel_of(v)
  @element.article(
    dyn_class=fn() { if is_removed(v.id) { "result is-removed" } else { "result" } },
    attrs=[sattr("data-id", v.id)],
  ) <| [
    @element.show(fn() { is_removed(v.id) }, fn() { removed_row(v) }),
    @element.show(fn() { !is_removed(v.id) }, fn() {
      @element.fragment([
        @element.a(
          href=watch_href(v),
          class="thumb result-thumb",
          attrs=[sattr("tabindex", "-1"), sattr("aria-hidden", "true")],
        ) <| [scene(v, still(v)), badge(v)],
        @element.div(class="result-body") <| [
          @element.h3(class="result-title") <| [
            @element.a(id="t-\{v.id}", href=watch_href(v)) <| highlight(v.title, q),
          ],
          @element.p(class="result-meta") <| meta_parts(v),
          @element.p(class="result-channel") <| [
            avatar(ch, class="avatar avatar-sm"),
            @element.span() <| [@element.text(ch.name)],
          ],
          @element.p(class="result-snippet") <| highlight(description_of(v), q),
        ],
        card_menu(v),
      ])
    }),
  ]
}

///|
fn feed_videos(feed : String) -> Array[Video] {
  match feed {
    "subscriptions" => videos.filter(fn(v) { v.channel % 2 == 0 })
    "you" =>
      ["far5ide", "lemon09", "tapelo13", "ntrain19", "kitbt15", "lighth22"].map(find_video)
    "trending" => {
      let sorted = videos.filter(fn(v) { !v.live })
      sorted.sort_by(fn(a, b) { b.views.compare(a.views) })
      sorted
    }
    "clips" => videos.filter(fn(v) { !v.live && v.duration <= 600 })
    _ => videos
  }
}

///|
fn feed_title(feed : String) -> String {
  match feed {
    "subscriptions" => "Subscriptions"
    "you" => "Watched recently"
    "trending" => "Trending"
    "clips" => "Clips: under ten minutes"
    _ => "Home"
  }
}

///|
fn feed_href(feed : String, chip : String, q : String) -> String {
  if q != "" {
    ""
  } else if feed != "" {
    "index.html?feed=\{feed}"
  } else if chip == "music" {
    "index.html?c=music"
  } else {
    "index.html"
  }
}

///|
fn home_page() -> Unit {
  let q = js_url_param("q")
  let feed = js_url_param("feed")
  let c0 = js_url_param("c")
  let initial_chip = if chips.iter().any(fn(c) { c.key == c0 }) { c0 } else { "all" }
  let chip = @resource.signal(initial_chip)
  let base = feed_videos(feed)
  let visible = @resource.memo(fn() {
    let k = chip.get()
    base.filter(fn(v) { matches_query(v, q) && chip_matches(v, k) })
  })
  // On a results page a phone shows the query in an open search bar.
  search_open.set(q != "")
  mount("masthead", masthead(q))
  mount("guide-root", guide(feed_href(feed, initial_chip, q), true))
  let heading = if q != "" {
    @element.h1(class="page-title") <| [@element.text("Results for “\{q}”")]
  } else if feed != "" {
    @element.h1(class="page-title") <| [@element.text(feed_title(feed))]
  } else {
    @element.h1(class="sr-only") <| [@element.text("Home")]
  }
  let empty = @element.show(fn() { visible().length() == 0 }, fn() {
    @element.div(class="empty") <| [
      @element.p(class="empty-title") <| [
        @element.text(if q != "" { "No videos match “\{q}” yet." } else { "Nothing here under this topic yet." }),
      ],
      @element.p() <| [
        @element.text("Try another topic, or "),
        @element.a(href="index.html") <| [@element.text("go back to Home")],
        @element.text("."),
      ],
    ]
  })
  let body = if q != "" {
    @element.div(class="results") <| [
      @element.for_each(fn() { visible() }, fn(v, _i) { result_row(v, q) }),
    ]
  } else {
    @element.div(class="grid") <| [
      @element.for_each(fn() { visible() }, fn(v, _i) { card(v) }),
    ]
  }
  let page_class = if q != "" { "feed is-search" } else { "feed" }
  mount("app", @element.div(class=page_class) <| [
    heading,
    chip_bar(chip),
    body,
    empty,
    toast_region(),
    site_dialogs(),
    share_dialog(),
  ])
}
