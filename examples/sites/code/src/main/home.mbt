// The repository home: title row, toolbar, file table, README and the About column.

///|
let goto_query : @resource.Signal[String] = @resource.signal("")

///|
let branch_filter : @resource.Signal[String] = @resource.signal("")

///|
let branch_tab : @resource.Signal[String] = @resource.signal("branches")

///|
let clone_tab : @resource.Signal[String] = @resource.signal("https")

///|
fn open_count() -> Int {
  issues.get().filter(fn(i) { i.open_ }).length()
}

///|
fn star_count() -> Int {
  if starred.get() {
    4219
  } else {
    4218
  }
}

///|
fn pr_link(pr : Int) -> Array[DomNode] {
  if pr == 0 {
    []
  } else {
    [
      t(" ("),
      el("a", [a_("href", "#/pulls"), cls("pr-ref")], [t("#" + pr.to_string())]),
      t(")"),
    ]
  }
}

///|
fn commit_msg(c : Commit) -> Array[DomNode] {
  [t(c.msg)] + (pr_link(c.pr))
}

// --- title row ----------------------------------------------------------------

///|
let watch_options : Array[(String, String)] = [
  ("Participating and @mentions", "Only when you take part or are mentioned."),
  ("All activity", "Every issue, pull request and release."),
  ("Ignore", "Never, not even when mentioned."),
  ("Custom", "Pick the events: issues, pull requests, releases."),
]

///|
fn title_row() -> DomNode {
  el("div", [cls("title-row")], [
    el("h1", [cls("repo-title")], [
      icon_c("repo", "ic repo-ic"),
      el("a", [a_("href", "#/")], [t(repo_name)]),
      el("span", [cls("pill")], [t("Public")]),
    ]),
    el("div", [cls("repo-actions")], [
      popover(
        "watch",
        "btn btn-count",
        "",
        [
          icon("eye"),
          el("span", [cls("btn-text btn-text-narrow")], [t("Watch")]),
          el("span", [cls("counter")], [t("38")]),
          icon_c("caret", "ic caret"),
        ],
        "menu-pop watch-pop",
        fn() {
          [
            el("p", [cls("pop-title")], [t("Notifications")]),
            el(
              "ul",
              [cls("choice-list"), a_("aria-label", "Notifications")],
              watch_options.map(fn(o) {
                let (name, desc) = o
                el("li", [], [
                  el(
                    "button",
                    [
                      a_("type", "button"),
                      cls("choice"),
                      ad("aria-pressed", fn() { bool_s(watch_mode.get() == name) }),
                      on("click", fn(_e) {
                        watch_mode.set(name)
                        close_menu_focus()
                      }),
                    ],
                    [
                      el("span", [cls("choice-check")], [
                        @element.show(fn() { watch_mode.get() == name }, fn() { icon("check") }),
                      ]),
                      el("span", [cls("choice-body")], [
                        el("span", [cls("choice-name")], [t(name)]),
                        el("span", [cls("choice-desc")], [t(desc)]),
                      ]),
                    ],
                  ),
                ])
              }),
            ),
          ]
        },
      ),
      el(
        "button",
        [
          a_("type", "button"),
          cls("btn btn-count"),
          a_("id", "btn-fork"),
          a_("aria-haspopup", "dialog"),
          on("click", fn(_e) {
            open_menu.set("")
            show_modal("fork-dialog")
          }),
        ],
        [
          icon("fork"),
          el("span", [cls("btn-text btn-text-narrow")], [t("Fork")]),
          el("span", [cls("counter")], [td(fn() { forks.get().to_string() })]),
        ],
      ),
      el(
        "button",
        [
          a_("type", "button"),
          ad("class", fn() { "btn btn-count star-btn" + (if starred.get() { " is-starred" } else { "" }) }),
          a_("id", "btn-star"),
          ad("aria-pressed", fn() { bool_s(starred.get()) }),
          on("click", fn(_e) { starred.update(fn(v) { !v }) }),
        ],
        [
          @element.show(fn() { !starred.get() }, fn() { icon("star") }),
          @element.show(fn() { starred.get() }, fn() { icon_c("star-fill", "ic star-on") }),
          el("span", [cls("btn-text")], [td(fn() { if starred.get() { "Starred" } else { "Star" } })]),
          el("span", [cls("counter")], [td(fn() { thousands(star_count()) })]),
        ],
      ),
    ]),
    fork_dialog(),
  ])
}

///|
fn fork_dialog() -> DomNode {
  el(
    "dialog",
    [
      a_("id", "fork-dialog"),
      cls("modal"),
      a_("aria-labelledby", "fork-title"),
      on("click", fn(e) { if target_is(e, "fork-dialog") { close_modal("fork-dialog") } }),
      on("close", fn(_e) { focus_sel("#btn-fork") }),
    ],
    [
      el(
        "form",
        [
          a_("method", "dialog"),
          cls("modal-form"),
          on("submit", fn(e) {
            prevent(e)
            forks.update(fn(n) { n + 1 })
            close_modal("fork-dialog")
          }),
        ],
        [
          el("div", [cls("modal-head")], [
            el("h2", [a_("id", "fork-title")], [t("Create a new fork")]),
            el(
              "button",
              [
                a_("type", "button"),
                cls("btn btn-icon"),
                a_("aria-label", "Close"),
                on("click", fn(_e) { close_modal("fork-dialog") }),
              ],
              [icon("x")],
            ),
          ]),
          el("p", [cls("muted")], [
            t("A fork is a copy of tidewater/lantern under your account. Changes to it do not touch the original."),
          ]),
          el("div", [cls("field-row")], [
            el("div", [cls("field")], [
              el("span", [cls("field-label"), a_("id", "fork-owner-l")], [t("Owner")]),
              el("span", [cls("field-static"), a_("aria-labelledby", "fork-owner-l")], [t("you")]),
            ]),
            el("span", [cls("field-slash"), a_("aria-hidden", "true")], [t("/")]),
            el("div", [cls("field grow")], [
              el("label", [a_("for", "fork-name"), cls("field-label")], [t("Repository name")]),
              el("input", [a_("id", "fork-name"), a_("type", "text"), cls("input"), a_("value", "lantern"), a_("required", ""), a_("autofocus", "")], []),
            ]),
          ]),
          el("div", [cls("field")], [
            el("label", [a_("for", "fork-desc"), cls("field-label")], [t("Description (optional)")]),
            el("input", [a_("id", "fork-desc"), a_("type", "text"), cls("input"), a_("value", "A static site generator that rebuilds only what changed")], []),
          ]),
          el("label", [cls("check-row")], [
            el("input", [a_("type", "checkbox"), ("checked", AttrValue::Static("true"))], []),
            t(" Copy the main branch only"),
          ]),
          el("div", [cls("modal-foot")], [
            el(
              "button",
              [a_("type", "button"), cls("btn"), on("click", fn(_e) { close_modal("fork-dialog") })],
              [t("Cancel")],
            ),
            el("button", [a_("type", "submit"), cls("btn btn-primary")], [t("Create fork")]),
          ]),
        ],
      ),
    ],
  )
}

// --- toolbar ------------------------------------------------------------------

///|
fn branch_popover() -> DomNode {
  popover(
    "branch",
    "btn branch-btn",
    "",
    [
      icon("branch"),
      el("span", [cls("branch-name")], [td(fn() { branches[branch.get()].name })]),
      icon_c("caret", "ic caret"),
    ],
    "branch-pop",
    fn() {
      [
        el("div", [cls("pop-head")], [
          el("p", [cls("pop-title")], [t("Switch branches/tags")]),
          el(
            "button",
            [
              a_("type", "button"),
              cls("btn btn-icon btn-bare"),
              a_("aria-label", "Close"),
              on("click", fn(_e) { close_menu_focus() }),
            ],
            [icon("x")],
          ),
        ]),
        el("div", [cls("pop-filter")], [
          el(
            "input",
            [
              a_("type", "text"),
              a_("id", "branch-filter"),
              cls("input input-sm"),
              a_("aria-label", "Find a branch or tag"),
              a_("placeholder", "Find a branch or tag"),
              a_("autocomplete", "off"),
              on("input", fn(e) { branch_filter.set(ev_value(e)) }),
            ],
            [],
          ),
        ]),
        tablist(
          "bt",
          [("branches", "Branches"), ("tags", "Tags")],
          branch_tab,
          "seg-tabs",
        ),
        el(
          "ul",
          [
            cls("ref-list"),
            a_("id", "bt-panel"),
            a_("role", "tabpanel"),
            ad("aria-labelledby", fn() { "bt-tab-" + branch_tab.get() }),
          ],
          [
            keyed(fn() { branch_filter.get() + "|" + branch_tab.get() }, fn(_key) { static_list(
              fn() {
                let want_tag = branch_tab.get() == "tags"
                let q = branch_filter.get().to_lower()
                let out = []
                for i, b in branches {
                  if b.is_tag == want_tag && (q == "" || b.name.to_lower().contains(q)) {
                    out.push(i)
                  }
                }
                out
              },
              fn(i, _k) {
                let b = branches[i]
                el("li", [], [
                  el(
                    "button",
                    [
                      a_("type", "button"),
                      cls("ref-item"),
                      ad("aria-current", fn() { bool_s(branch.get() == i) }),
                      on("click", fn(_e) {
                        branch.set(i)
                        close_menu_focus()
                      }),
                    ],
                    [
                      el("span", [cls("choice-check")], [
                        @element.show(fn() { branch.get() == i }, fn() { icon("check") }),
                      ]),
                      el("span", [cls("ref-name")], bolded(b.name, match fuzzy(b.name, branch_filter.get()) {
                        Some(h) => if branch_filter.get() == "" { [] } else { h }
                        None => []
                      })),
                    ] + (if i == 0 { [el("span", [cls("pill pill-sm")], [t("default")])] } else { [] }),
                  ),
                ])
              },
            ) }),
          ],
        ),
        @element.show(
          fn() {
            let want_tag = branch_tab.get() == "tags"
            let q = branch_filter.get().to_lower()
            branches.filter(fn(b) { b.is_tag == want_tag && (q == "" || b.name.to_lower().contains(q)) }).length() == 0
          },
          fn() {
            el("p", [cls("pop-empty")], [td(fn() { "Nothing named “" + branch_filter.get() + "”." })])
          },
        ),
        el("p", [cls("pop-foot")], [
          el("a", [a_("href", "#/"), cls("link")], [
            td(fn() { if branch_tab.get() == "tags" { "View all tags" } else { "View all branches" } }),
          ]),
        ]),
      ]
    },
  )
}

///|
/// An APG tablist: arrow keys move between tabs; the panel is labelled by the selected tab.
fn tablist(
  id : String,
  tabs : Array[(String, String)],
  sel : @resource.Signal[String],
  klass : String,
) -> DomNode {
  let keys = tabs.map(fn(p) { p.0 })
  el(
    "div",
    [a_("role", "tablist"), cls(klass), a_("aria-label", tabs.map(fn(p) { p.1 }).join(" or "))],
    tabs.map(fn(p) {
      let (k, label) = p
      el(
        "button",
        [
          a_("type", "button"),
          a_("role", "tab"),
          a_("id", id + "-tab-" + k),
          a_("aria-controls", id + "-panel"),
          ad("aria-selected", fn() { bool_s(sel.get() == k) }),
          ad("tabindex", fn() { if sel.get() == k { "0" } else { "-1" } }),
          ad("class", fn() { "tab" + (if sel.get() == k { " is-selected" } else { "" }) }),
          on("click", fn(_e) { sel.set(k) }),
          on("keydown", fn(e) {
            let key = ev_key(e)
            let n = keys.length()
            let at = match keys.search(sel.get()) {
              Some(x) => x
              None => 0
            }
            let next = if key == "ArrowRight" {
              (at + 1) % n
            } else if key == "ArrowLeft" {
              (at + n - 1) % n
            } else if key == "Home" {
              0
            } else if key == "End" {
              n - 1
            } else {
              -1
            }
            if next >= 0 {
              prevent(e)
              sel.set(keys[next])
              focus_sel("#" + id + "-tab-" + keys[next])
            }
          }),
        ],
        [t(label)],
      )
    }),
  )
}

///|
fn code_menu() -> DomNode {
  popover(
    "code",
    "btn btn-primary code-btn",
    "",
    [icon("code"), el("span", [], [t("Code")]), icon_c("caret", "ic caret")],
    "code-pop",
    fn() {
      [
        el("div", [cls("pop-head")], [
          el("p", [cls("pop-title")], [icon("terminal"), t(" Clone")]),
        ]),
        el("div", [cls("code-pop-body")], [
          tablist("ct", [("https", "HTTPS"), ("cli", "CLI")], clone_tab, "seg-tabs"),
          el(
            "div",
            [
              a_("id", "ct-panel"),
              a_("role", "tabpanel"),
              ad("aria-labelledby", fn() { "ct-tab-" + clone_tab.get() }),
            ],
            [
              keyed(fn() { clone_tab.get() }, fn(k) {
                let url = if k == "cli" { clone_cli } else { clone_https }
                el("div", [], [
                  el("div", [cls("clone-row")], [
                    el(
                      "input",
                      [
                        a_("type", "text"),
                        cls("input input-sm mono"),
                        a_("readonly", ""),
                        a_("value", url),
                        a_("aria-label", if k == "cli" { "Clone with the CLI" } else { "Clone URL" }),
                        on("focus", fn(e) {
                          let tg : @js.Any = e._get("target")
                          let _ = tg._call("select", FixedArray::make(0, tg))
                        }),
                      ],
                      [],
                    ),
                    copy_button("clone-" + k, url, if k == "cli" { "Copy command" } else { "Copy URL" }),
                  ]),
                  el("p", [cls("muted small")], [
                    t(if k == "cli" {
                      "Use the Forgeyard command line tool."
                    } else {
                      "Clone using the web URL."
                    }),
                  ]),
                ])
              }),
            ],
          ),
        ]),
        el("ul", [cls("code-pop-actions")], [
          el("li", [], [
            el(
              "a",
              [
                a_("href", data_url("Lantern 3.4.0 source archive (demo: no archive is served).\n")),
                a_("download", "lantern-main.txt"),
                cls("pop-action"),
              ],
              [icon("download"), t("Download ZIP")],
            ),
          ]),
        ]),
      ]
    },
  )
}

///|
fn toolbar() -> DomNode {
  el("div", [cls("toolbar")], [
    el("div", [cls("toolbar-left")], [
      branch_popover(),
      el("a", [a_("href", "#/"), cls("ref-count")], [
        icon("branch"),
        el("strong", [], [t("8")]),
        t(" Branches"),
      ]),
      el("a", [a_("href", "#/"), cls("ref-count")], [
        icon("tag"),
        el("strong", [], [t("5")]),
        t(" Tags"),
      ]),
    ]),
    el("div", [cls("toolbar-right")], [
      el("div", [cls("goto")], [
        icon("search"),
        el(
          "input",
          [
            a_("type", "search"),
            a_("id", "goto"),
            cls("input goto-input"),
            a_("placeholder", " "),
            a_("autocomplete", "off"),
            a_("aria-controls", "file-table"),
            on("input", fn(e) { goto_query.set(ev_value(e)) }),
            on("keydown", fn(e) {
              if ev_key(e) == "Escape" && goto_query.get() != "" {
                prevent(e)
                goto_query.set("")
                set_value("#goto", "")
              }
            }),
          ],
          [],
        ),
        el("label", [a_("for", "goto"), cls("goto-label")], [t("Go to file")]),
      ]),
      code_menu(),
    ]),
  ])
}

// --- file table ---------------------------------------------------------------

///|
fn children_of(dir : String) -> Array[Entry] {
  let out = tree.filter(fn(e) { dirname(e.path) == dir })
  out.sort_by(fn(a, b) {
    if a.is_dir != b.is_dir {
      if a.is_dir {
        -1
      } else {
        1
      }
    } else {
      a.path.to_lower().compare(b.path.to_lower())
    }
  })
  out
}

///|
fn entry_of(path : String) -> Entry? {
  for e in tree {
    if e.path == path {
      return Some(e)
    }
  }
  None
}

///|
fn latest_row(dir : String) -> DomNode {
  el("div", [cls("ft-head")], [
    keyed(fn() { branch.get().to_string() + "|" + dir }, fn(_k) {
      let c = if dir == "" {
        branches[branch.get()].head
      } else {
        match entry_of(dir) {
          Some(e) => { author: main_head.author, msg: e.msg, pr: e.pr, sha: "4f1e" + e.path.length().to_string() + "b2", age: e.age }
          None => main_head
        }
      }
      let commits = if branch.get() == 0 { 1284 } else { 1284 - branch.get() * 37 }
      el("div", [cls("ft-head-inner")], [
        avatar(c.author, 20),
        el("a", [a_("href", "#/"), cls("ft-author")], [t(c.author)]),
        el("span", [cls("ft-msg")], commit_msg(c)),
        el("span", [cls("ft-meta")], [
          el("code", [cls("sha")], [t(c.sha)]),
          t(" · " + c.age),
        ]),
        el("a", [a_("href", "#/"), cls("ft-commits")], [
          icon("history"),
          el("strong", [], [t(thousands(commits))]),
          t(" Commits"),
        ]),
      ])
    }),
  ])
}

///|
fn file_row(e : Entry, label : Array[DomNode]) -> DomNode {
  let href = if e.is_dir { "#/tree/" + e.path } else { "#/blob/" + e.path }
  el("tr", [cls("ft-row")], [
    el("td", [cls("ft-name")], [
      el("span", [cls("ft-name-in")], [
        icon_c(if e.is_dir { "folder" } else { "file" }, if e.is_dir { "ic ic-folder" } else { "ic ic-file" }),
        el("a", [a_("href", href), cls("ft-link")], label),
      ]),
    ]),
    el("td", [cls("ft-cmsg")], [el("span", [cls("ft-cmsg-in")], [t(e.msg)] + (pr_link(e.pr)))]),
    el("td", [cls("ft-age")], [t(e.age)]),
  ])
}

///|
fn crumbs(path : String, last_is_link : Bool) -> DomNode {
  let parts : Array[String] = if path == "" {
    []
  } else {
    path.split("/").map(fn(s) { s.to_owned() }).to_array()
  }
  let out : Array[DomNode] = [el("a", [a_("href", "#/"), cls("crumb crumb-root")], [t(repo_name)])]
  let mut acc = ""
  for i, p in parts {
    acc = if acc == "" { p } else { acc + "/" + p }
    out.push(el("span", [cls("crumb-sep"), a_("aria-hidden", "true")], [t("/")]))
    if i == parts.length() - 1 && !last_is_link {
      out.push(el("strong", [cls("crumb crumb-current"), a_("aria-current", "page")], [t(p)]))
    } else {
      out.push(el("a", [a_("href", "#/tree/" + acc), cls("crumb")], [t(p)]))
    }
  }
  el("nav", [a_("aria-label", "Breadcrumb"), cls("crumbs")], out)
}

///|
fn file_table(dir : String) -> DomNode {
  el("div", [cls("ft")], [
    latest_row(dir),
    el("table", [cls("ft-table"), a_("id", "file-table")], [
      el("caption", [cls("sr-only")], [
        td(fn() {
          if goto_query.get() != "" {
            "Files matching " + goto_query.get()
          } else if dir == "" {
            "Files in lantern"
          } else {
            "Files in " + dir
          }
        }),
      ]),
      el("colgroup", [], [
        el("col", [cls("col-name")], []),
        el("col", [cls("col-msg")], []),
        el("col", [cls("col-age")], []),
      ]),
      el("thead", [cls("sr-only")], [
        el("tr", [], [
          el("th", [a_("scope", "col"), cls("ft-name")], [t("Name")]),
          el("th", [a_("scope", "col"), cls("ft-cmsg")], [t("Last commit message")]),
          el("th", [a_("scope", "col"), cls("ft-age")], [t("Last commit date")]),
        ]),
      ]),
      keyed(fn() { goto_query.get() }, fn(q) {
        if q != "" {
          let found = match_files(q)
          if found.length() == 0 {
            el("tbody", [], [
              el("tr", [], [
                el("td", [a_("colspan", "3"), cls("ft-empty")], [t("No files match “" + q + "”.")]),
              ]),
            ])
          } else {
            el(
              "tbody",
              [],
              found.map(fn(f) {
                match entry_of(f.0) {
                  Some(e) => file_row(e, bolded(f.0, f.1))
                  None => t("")
                }
              }),
            )
          }
        } else {
          let rows : Array[DomNode] = []
          if dir != "" {
            let up = dirname(dir)
            rows.push(
              el("tr", [cls("ft-row ft-up")], [
                el("td", [a_("colspan", "3"), cls("ft-name")], [
                  el("span", [cls("ft-name-in")], [
                    icon_c("folder", "ic ic-folder"),
                    el(
                      "a",
                      [
                        a_("href", if up == "" { "#/" } else { "#/tree/" + up }),
                        cls("ft-link"),
                        a_("aria-label", "Parent folder"),
                      ],
                      [t("..")],
                    ),
                  ]),
                ]),
              ]),
            )
          }
          for e in children_of(dir) {
            rows.push(file_row(e, [t(basename(e.path))]))
          }
          el("tbody", [], rows)
        }
      }),
    ]),
  ])
}

///|
fn readme_box() -> DomNode {
  let heads = md_headings(readme_src)
  el("section", [cls("readme"), a_("aria-labelledby", "readme-title")], [
    el("div", [cls("readme-head")], [
      el("h2", [a_("id", "readme-title"), cls("readme-title")], [
        icon("book"),
        el("a", [a_("href", "#/blob/README.md")], [t("README.md")]),
      ]),
      popover(
        "outline",
        "btn btn-icon",
        "Outline",
        [icon("outline")],
        "outline-pop",
        fn() {
          [
            el("p", [cls("pop-title")], [t("Outline")]),
            el(
              "ul",
              [cls("outline-list"), a_("aria-label", "Outline")],
              heads.map(fn(h) {
                let (level, text, id) = h
                el("li", [cls("outline-l" + level.to_string())], [
                  el(
                    "a",
                    [
                      a_("href", "#/"),
                      cls("outline-link"),
                      on("click", fn(e) {
                        prevent(e)
                        open_menu.set("")
                        scroll_to("#" + id)
                        focus_sel("#" + id)
                      }),
                    ],
                    [t(text)],
                  ),
                ])
              }),
            ),
          ]
        },
      ),
    ]),
    el("article", [cls("markdown")], md_blocks(readme_src, "readme")),
  ])
}

// --- side column ----------------------------------------------------------------

///|
fn side_link(ic : String, label : String, href : String) -> DomNode {
  el("li", [], [el("a", [a_("href", href), cls("side-link")], [icon(ic), t(label)])])
}

///|
fn about() -> DomNode {
  el("div", [cls("side")], [
    el("section", [cls("side-sec"), a_("aria-labelledby", "about-h")], [
      el("h2", [a_("id", "about-h"), cls("side-h")], [t("About")]),
      el("p", [cls("about-desc")], [
        t("A static site generator that rebuilds only what changed and streams pages to disk."),
      ]),
      el("p", [cls("about-url")], [
        icon("link"),
        el("a", [a_("href", "#/"), cls("link strong")], [t("lantern.tidewater.example")]),
      ]),
      el(
        "ul",
        [cls("topics"), a_("aria-label", "Topics")],
        topics.map(fn(tp) { el("li", [], [el("a", [a_("href", "#/"), cls("topic")], [t(tp)])]) }),
      ),
      el("ul", [cls("side-links")], [
        side_link("book", "Readme", "#/blob/README.md"),
        side_link("scale", "MIT license", "#/blob/LICENSE"),
        side_link("pulse", "Activity", "#/insights"),
        el("li", [], [
          el("a", [a_("href", "#/"), cls("side-link")], [
            icon("star"),
            el("strong", [], [t("4.2k")]),
            t(" stars"),
          ]),
        ]),
        el("li", [], [
          el("a", [a_("href", "#/"), cls("side-link")], [icon("eye"), el("strong", [], [t("38")]), t(" watching")]),
        ]),
        el("li", [], [
          el("a", [a_("href", "#/"), cls("side-link")], [
            icon("fork"),
            el("strong", [], [td(fn() { forks.get().to_string() })]),
            t(" forks"),
          ]),
        ]),
      ]),
    ]),
    el("section", [cls("side-sec"), a_("aria-labelledby", "rel-h")], [
      el("h2", [a_("id", "rel-h"), cls("side-h")], [
        t("Releases "),
        el("span", [cls("counter")], [t("15")]),
      ]),
      el("a", [a_("href", "#/"), cls("release")], [
        icon_c("tag", "ic ic-ok"),
        el("span", [cls("release-body")], [
          el("span", [cls("release-name")], [
            el("strong", [], [t("v3.4.0")]),
            el("span", [cls("pill pill-ok")], [t("Latest")]),
          ]),
          el("span", [cls("muted small")], [t("Oct 31, 2026")]),
        ]),
      ]),
      el("a", [a_("href", "#/"), cls("link small")], [t("+ 14 releases")]),
    ]),
    el("section", [cls("side-sec"), a_("aria-labelledby", "con-h")], [
      el("h2", [a_("id", "con-h"), cls("side-h")], [
        t("Contributors "),
        el("span", [cls("counter")], [t("27")]),
      ]),
      el(
        "ul",
        [cls("avatars"), a_("aria-label", "Contributors")],
        contributors.map(fn(p) {
          el("li", [], [el("a", [a_("href", "#/"), a_("aria-label", p), a_("title", p), cls("avatar-link")], [avatar(p, 32)])])
        }),
      ),
      el("a", [a_("href", "#/"), cls("link small")], [t("+ 13 contributors")]),
    ]),
    el("section", [cls("side-sec"), a_("aria-labelledby", "lang-h")], [
      el("h2", [a_("id", "lang-h"), cls("side-h")], [t("Languages")]),
      el(
        "div",
        [cls("lang-bar"), a_("role", "img"), a_("aria-label", languages.map(fn(l) { l.0 + " " + l.1.to_string() + "%" }).join(", "))],
        languages.map(fn(l) {
          el("span", [a_("style", "width:\{l.1}%;background:\{l.2}")], [])
        }),
      ),
      el(
        "ul",
        [cls("lang-legend")],
        languages.map(fn(l) {
          el("li", [], [
            el("span", [cls("lang-dot"), a_("style", "background:\{l.2}"), a_("aria-hidden", "true")], []),
            el("strong", [], [t(l.0)]),
            el("span", [cls("muted")], [t(" " + l.1.to_string() + "%")]),
          ])
        }),
      ),
    ]),
  ])
}

///|
fn home_view(dir : String) -> DomNode {
  el("div", [cls(if dir == "" { "home layout-2" } else { "home layout-1" })], [
    el("div", [cls("main-col")], [
      toolbar(),
      if dir != "" { crumbs(dir, false) } else { t("") },
      file_table(dir),
      if dir == "" { readme_box() } else { t("") },
    ]),
    if dir == "" { about() } else { t("") },
  ])
}
