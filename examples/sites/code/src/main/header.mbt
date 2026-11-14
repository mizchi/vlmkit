// The global header, the command palette, and the repository header.

///|
let nav_menus : Array[(String, Array[(String, String)])] = [
  (
    "Platform",
    [
      ("Repositories", "Host code with history and review"),
      ("Pipelines", "Build and test every push"),
      ("Packages", "Publish to a private registry"),
    ],
  ),
  (
    "Developers",
    [
      ("Documentation", "Guides and the API reference"),
      ("Command line", "The fy CLI"),
      ("Changelog", "What shipped this month"),
    ],
  ),
  (
    "Teams",
    [
      ("Small teams", "Shared repositories and reviews"),
      ("Open source", "Free for public projects"),
      ("Enterprise", "Single sign-on and audit logs"),
    ],
  ),
  (
    "Resources",
    [
      ("Learning paths", "From first commit to release"),
      ("Customer stories", "How teams ship with Forgeyard"),
      ("Status", "Service health"),
    ],
  ),
]

///|
fn nav_menu(name : String, items : Array[(String, String)], prefix : String) -> DomNode {
  let key = prefix + slug(name)
  popover(
    key,
    "gh-nav-btn",
    "",
    [t(name), icon_c("caret", "ic caret")],
    "nav-pop",
    fn() {
      [
        el(
          "ul",
          [cls("nav-pop-list"), a_("aria-label", name)],
          items.map(fn(it) {
            let (title, desc) = it
            el("li", [], [
              el("a", [a_("href", "#/"), cls("nav-pop-link")], [
                el("span", [cls("nav-pop-title")], [t(title)]),
                el("span", [cls("nav-pop-desc")], [t(desc)]),
              ]),
            ])
          }),
        ),
      ]
    },
  )
}

///|
fn global_header() -> DomNode {
  el("div", [cls("gh-inner")], [
    el(
      "a",
      [
        a_("href", "#app"),
        cls("skip"),
        on("click", fn(e) {
          prevent(e)
          focus_sel("#app")
        }),
      ],
      [t("Skip to content")],
    ),
    el(
      "button",
      [
        a_("type", "button"),
        cls("gh-icon-btn gh-burger"),
        a_("id", "btn-burger"),
        a_("aria-label", "Open menu"),
        a_("aria-controls", "mobile-nav"),
        ad("aria-expanded", fn() { bool_s(mobile_nav.get()) }),
        on("click", fn(_e) { mobile_nav.update(fn(v) { !v }) }),
      ],
      [icon("menu")],
    ),
    el("a", [a_("href", "#/"), cls("gh-logo"), a_("aria-label", "Forgeyard home")], [
      logo_mark(),
      el("span", [cls("gh-word"), a_("aria-hidden", "true")], [t("Forgeyard")]),
    ]),
    el(
      "nav",
      [a_("aria-label", "Global"), cls("gh-nav")],
      [
        el(
          "ul",
          [cls("gh-nav-list")],
          nav_menus
          .map(fn(m) { el("li", [], [nav_menu(m.0, m.1, "nav-")]) }) + ([el("li", [], [el("a", [a_("href", "#/"), cls("gh-nav-btn")], [t("Pricing")])])]),
        ),
      ],
    ),
    el("div", [cls("gh-right")], [
      el(
        "button",
        [
          a_("type", "button"),
          cls("gh-search"),
          a_("id", "btn-search"),
          a_("aria-haspopup", "dialog"),
          on("click", fn(_e) { open_palette() }),
        ],
        [
          icon("search"),
          el("span", [cls("gh-search-text")], [t("Search or jump to…")]),
          el("kbd", [cls("gh-kbd"), a_("aria-label", "shortcut: slash")], [t("/")]),
        ],
      ),
      el(
        "button",
        [
          a_("type", "button"),
          cls("gh-icon-btn gh-search-icon"),
          a_("aria-label", "Search or jump to"),
          a_("aria-haspopup", "dialog"),
          on("click", fn(_e) { open_palette() }),
        ],
        [icon("search")],
      ),
      el("a", [a_("href", "#/"), cls("gh-signin")], [t("Sign in")]),
      el("a", [a_("href", "#/"), cls("gh-icon-btn gh-signin-icon"), a_("aria-label", "Sign in")], [
        icon("person"),
      ]),
      el("a", [a_("href", "#/"), cls("gh-signup")], [t("Sign up")]),
    ]),
    el(
      "div",
      [
        a_("id", "mobile-nav"),
        ad("class", fn() {
          "mobile-nav" + (if mobile_nav.get() { " is-open" } else { "" })
        }),
      ],
      [
        el(
          "nav",
          [a_("aria-label", "Global, small screens")],
          [
            el(
              "ul",
              [cls("mobile-nav-list")],
              nav_menus
              .map(fn(m) { el("li", [], [nav_menu(m.0, m.1, "mnav-")]) }) + ([
                el("li", [], [el("a", [a_("href", "#/"), cls("gh-nav-btn")], [t("Pricing")])]),
                el("li", [], [el("a", [a_("href", "#/"), cls("gh-signup mobile-signup")], [t("Sign up")])]),
              ]),
            ),
          ],
        ),
      ],
    ),
    palette(),
  ])
}

// --- command palette -------------------------------------------------------

///|
let pal_query : @resource.Signal[String] = @resource.signal("")

///|
let pal_active : @resource.Signal[Int] = @resource.signal(0)

///|
struct PalItem {
  kind : String // "file" | "issue" | "go"
  label : String
  hint : String
  href : String
  hits : Array[Int]
}

///|
/// Case-insensitive subsequence match; the positions matched, or None.
fn fuzzy(hay : String, needle : String) -> Array[Int]? {
  let h = chars_of(hay.to_lower())
  let n = chars_of(needle.to_lower())
  if n.length() == 0 {
    return Some([])
  }
  // Prefer a contiguous match.
  match hay.to_lower().find(needle.to_lower()) {
    Some(at) => {
      let out = []
      for k in 0..<n.length() {
        out.push(at + k)
      }
      return Some(out)
    }
    None => ()
  }
  let out = []
  let mut j = 0
  for i in 0..<h.length() {
    if j < n.length() && h[i] == n[j] {
      out.push(i)
      j += 1
    }
  }
  if j == n.length() {
    Some(out)
  } else {
    None
  }
}

///|
fn hit_score(hits : Array[Int]) -> Int {
  if hits.length() < 2 {
    0
  } else {
    hits[hits.length() - 1] - hits[0] - hits.length()
  }
}

///|
fn bolded(text : String, hits : Array[Int]) -> Array[DomNode] {
  let cs = chars_of(text)
  let out : Array[DomNode] = []
  let mut i = 0
  while i < cs.length() {
    let on_ = hits.contains(i)
    let start = i
    while i < cs.length() && hits.contains(i) == on_ {
      i += 1
    }
    let s = str_of(cs, start, i)
    out.push(if on_ { el("mark", [cls("hit")], [t(s)]) } else { t(s) })
  }
  out
}

///|
fn file_paths() -> Array[String] {
  tree.filter(fn(e) { !e.is_dir }).map(fn(e) { e.path })
}

///|
fn match_files(q : String) -> Array[(String, Array[Int])] {
  let out = []
  for p in file_paths() {
    match fuzzy(p, q) {
      Some(h) => out.push((p, h))
      None => ()
    }
  }
  out.sort_by(fn(a, b) {
    let d = hit_score(a.1) - hit_score(b.1)
    if d != 0 {
      d
    } else {
      a.0.length() - b.0.length()
    }
  })
  out
}

///|
fn pal_items() -> Array[PalItem] {
  let q = pal_query.get().trim(chars=" ").to_string()
  if q == "" {
    return [
      { kind: "go", label: "Code", hint: "tidewater/lantern", href: "#/", hits: [] },
      { kind: "go", label: "Issues", hint: open_count().to_string() + " open", href: "#/issues", hits: [] },
      { kind: "go", label: "Pull requests", hint: "4 open", href: "#/pulls", hits: [] },
      { kind: "go", label: "New issue", hint: "Open the form", href: "#/issues/new", hits: [] },
      { kind: "file", label: "README.md", hint: "File", href: "#/blob/README.md", hits: [] },
      { kind: "file", label: "src/core/build.ts", hint: "File", href: "#/blob/src/core/build.ts", hits: [] },
    ]
  }
  let out : Array[PalItem] = []
  let files = match_files(q)
  for i, f in files {
    if i < 7 {
      out.push({ kind: "file", label: f.0, hint: "File", href: "#/blob/" + f.0, hits: f.1 })
    }
  }
  let qn = if q.has_prefix("#") { q.substring(start=1) } else { q }
  let mut n = 0
  for iss in issues.get() {
    if n >= 6 {
      break
    }
    if iss.num.to_string() == qn {
      out.push({ kind: "issue", label: iss.title, hint: "#" + iss.num.to_string(), href: "#/issues/" + iss.num.to_string(), hits: [] })
      n += 1
      continue
    }
    match iss.title.to_lower().find(q.to_lower()) {
      Some(at) => {
        let hits = []
        for k in 0..<q.length() {
          hits.push(at + k)
        }
        out.push({
          kind: "issue",
          label: iss.title,
          hint: "#" + iss.num.to_string(),
          href: "#/issues/" + iss.num.to_string(),
          hits,
        })
        n += 1
      }
      None => ()
    }
  }
  out
}

///|
fn open_palette() -> Unit {
  pal_query.set("")
  pal_active.set(0)
  set_value("#palette-input", "")
  open_menu.set("")
  show_modal("palette")
}

///|
fn pal_go(href : String) -> Unit {
  close_modal("palette")
  set_hash(href)
}

///|
fn palette() -> DomNode {
  let items = @resource.memo(fn() { pal_items() })
  el(
    "dialog",
    [
      a_("id", "palette"),
      cls("palette"),
      a_("aria-label", "Search or jump to"),
      on("click", fn(e) { if target_is(e, "palette") { close_modal("palette") } }),
      on("close", fn(_e) { focus_sel("#btn-search") }),
    ],
    [
      el("div", [cls("pal-head")], [
        icon("search"),
        el(
          "input",
          [
            a_("id", "palette-input"),
            a_("autofocus", ""),
            a_("type", "text"),
            cls("pal-input"),
            a_("role", "combobox"),
            a_("aria-label", "Search files and issues"),
            a_("aria-autocomplete", "list"),
            a_("aria-controls", "palette-list"),
            a_("aria-expanded", "true"),
            a_("autocomplete", "off"),
            a_("spellcheck", "false"),
            a_("placeholder", "Search files and issues"),
            ad("aria-activedescendant", fn() {
              if items().length() > 0 {
                "pal-opt-" + pal_active.get().to_string()
              } else {
                ""
              }
            }),
            on("input", fn(e) {
              @resource.batch(fn() {
                pal_query.set(ev_value(e))
                pal_active.set(0)
              })
            }),
            on("keydown", fn(e) {
              let k = ev_key(e)
              let n = items().length()
              if k == "ArrowDown" && n > 0 {
                prevent(e)
                pal_active.set((pal_active.get() + 1) % n)
                scroll_into_list("#pal-opt-" + pal_active.get().to_string())
              } else if k == "ArrowUp" && n > 0 {
                prevent(e)
                pal_active.set((pal_active.get() + n - 1) % n)
                scroll_into_list("#pal-opt-" + pal_active.get().to_string())
              } else if k == "Enter" && n > 0 {
                prevent(e)
                pal_go(items()[pal_active.get()].href)
              }
            }),
          ],
          [],
        ),
        el(
          "button",
          [
            a_("type", "button"),
            cls("btn btn-icon pal-close"),
            a_("aria-label", "Close"),
            on("click", fn(_e) { close_modal("palette") }),
          ],
          [icon("x")],
        ),
      ]),
      el("p", [cls("pal-section"), a_("aria-hidden", "true")], [
        td(fn() { if pal_query.get() == "" { "Jump to" } else { "Files and issues" } }),
      ]),
      el(
        "ul",
        [a_("id", "palette-list"), a_("role", "listbox"), cls("pal-list"), a_("aria-label", "Results")],
        [
          @element.for_each(fn() { items() }, fn(it, i) {
            el(
              "li",
              [
                a_("id", "pal-opt-" + i.to_string()),
                a_("role", "option"),
                ad("aria-selected", fn() { bool_s(pal_active.get() == i) }),
                ad("class", fn() {
                  "pal-opt" + (if pal_active.get() == i { " is-active" } else { "" })
                }),
                on("click", fn(_e) { pal_go(it.href) }),
                on("mousemove", fn(_e) { if pal_active.get() != i { pal_active.set(i) } }),
              ],
              [
                icon(match it.kind {
                  "file" => "file"
                  "issue" => "issue"
                  _ => "up"
                }),
                el("span", [cls("pal-label")], bolded(it.label, it.hits)),
                el("span", [cls("pal-hint")], [t(it.hint)]),
              ],
            )
          }),
        ],
      ),
      @element.show(fn() { items().length() == 0 }, fn() {
        el("p", [cls("pal-empty")], [td(fn() { "Nothing matches “" + pal_query.get() + "”." })])
      }),
      el("p", [cls("pal-foot")], [
        el("kbd", [], [t("↑")]),
        el("kbd", [], [t("↓")]),
        t(" to move, "),
        el("kbd", [], [t("Enter")]),
        t(" to open, "),
        el("kbd", [], [t("Esc")]),
        t(" to close"),
      ]),
    ],
  )
}

// --- repository header ------------------------------------------------------

///|
fn repo_tab(key : String, label : String, ic : String, count : () -> String, href : String) -> DomNode {
  el(
    "a",
    [
      a_("href", href),
      ad("class", fn() {
        "repo-tab" + (if tab_of_route(route.get()) == key { " is-current" } else { "" })
      }),
      ad("aria-current", fn() {
        if tab_of_route(route.get()) == key {
          "page"
        } else {
          "false"
        }
      }),
    ],
    [icon(ic), el("span", [], [t(label)])] + (
      if count() != "" {
        [el("span", [cls("counter")], [td(count)])]
      } else {
        []
      },
    ),
  )
}

///|
fn repo_head() -> DomNode {
  el("div", [cls("repohead")], [
    el("div", [cls("repohead-inner")], [
      el("p", [cls("repo-path")], [
        el("a", [a_("href", "#/"), cls("repo-owner")], [t(owner)]),
        el("span", [cls("repo-sep")], [t("/")]),
        el("a", [a_("href", "#/"), cls("repo-name")], [t(repo_name)]),
      ]),
      el("nav", [a_("aria-label", "Repository"), cls("repo-tabs")], [
        repo_tab("code", "Code", "code", fn() { "" }, "#/"),
        repo_tab("issues", "Issues", "issue", fn() { open_count().to_string() }, "#/issues"),
        repo_tab("pulls", "Pull requests", "pr", fn() { pulls.length().to_string() }, "#/pulls"),
        repo_tab("actions", "Actions", "play", fn() { "" }, "#/actions"),
        repo_tab("security", "Security", "shield", fn() { "" }, "#/security"),
        repo_tab("insights", "Insights", "graph", fn() { "" }, "#/insights"),
      ]),
    ]),
  ])
}
