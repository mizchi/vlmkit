// Issues: the list with its filters, one issue, the new-issue form, pull requests, and the main router.

///|
let iq : @resource.Signal[String] = @resource.signal("is:issue is:open")

///|
let new_tab : @resource.Signal[String] = @resource.signal("write")

///|
let new_title : @resource.Signal[String] = @resource.signal("")

///|
let new_body : @resource.Signal[String] = @resource.signal("")

///|
let new_error : @resource.Signal[Bool] = @resource.signal(false)

///|
/// Split a query into tokens; `key:"two words"` stays one token.
fn q_tokens(q : String) -> Array[String] {
  let out = []
  let buf = StringBuilder::new()
  let mut quoted = false
  for ch in q {
    if ch == '"' {
      quoted = !quoted
      buf.write_char(ch)
    } else if ch == ' ' && !quoted {
      let s = buf.to_string()
      if s != "" {
        out.push(s)
      }
      buf.reset()
    } else {
      buf.write_char(ch)
    }
  }
  let s = buf.to_string()
  if s != "" {
    out.push(s)
  }
  out
}

///|
fn q_get(q : String, key : String) -> String {
  for tk in q_tokens(q) {
    if tk.has_prefix(key + ":") {
      return tk.substring(start=key.length() + 1).replace_all(old="\"", new="")
    }
  }
  ""
}

///|
fn q_set(q : String, key : String, v : String) -> String {
  let out = q_tokens(q).filter(fn(tk) { !tk.has_prefix(key + ":") || (key == "is" && tk == "is:issue") })
  if v != "" {
    out.push(key + ":" + (if v.contains(" ") { "\"" + v + "\"" } else { v }))
  }
  out.join(" ")
}

///|
fn q_text(q : String) -> String {
  q_tokens(q).filter(fn(tk) { !tk.contains(":") }).join(" ").to_lower()
}

///|
fn set_iq(q : String) -> Unit {
  iq.set(q)
  set_value("#issue-search", q)
}

///|
fn issue_matches(i : Issue, q : String, with_state : Bool) -> Bool {
  let state = q_get(q, "state")
  let is_ = q_tokens(q).filter(fn(tk) { tk == "is:open" || tk == "is:closed" })
  let want_open = if is_.length() > 0 {
    is_[0] == "is:open"
  } else {
    state != "closed"
  }
  if with_state && i.open_ != want_open {
    return false
  }
  let author = q_get(q, "author")
  if author != "" && i.author != author {
    return false
  }
  let label = q_get(q, "label")
  if label != "" && !i.labels.contains(label) {
    return false
  }
  let ms = q_get(q, "milestone")
  if ms != "" && i.milestone != ms {
    return false
  }
  let asg = q_get(q, "assignee")
  if asg != "" && i.assignee != asg {
    return false
  }
  let pj = q_get(q, "project")
  if pj != "" && i.project != pj {
    return false
  }
  let text = q_text(q)
  if text != "" && !i.title.to_lower().contains(text) {
    return false
  }
  true
}

///|
fn shown_issues() -> Array[Issue] {
  let q = iq.get()
  let out = issues.get().filter(fn(i) { issue_matches(i, q, true) })
  match q_get(q, "sort") {
    "created-asc" => out.sort_by(fn(a, b) { a.num - b.num })
    "comments-desc" => out.sort_by(fn(a, b) { if b.comments != a.comments { b.comments - a.comments } else { b.num - a.num } })
    "comments-asc" => out.sort_by(fn(a, b) { if a.comments != b.comments { a.comments - b.comments } else { b.num - a.num } })
    _ => out.sort_by(fn(a, b) { b.num - a.num })
  }
  out
}

///|
fn state_count(open_ : Bool) -> Int {
  let q = iq.get()
  issues.get().filter(fn(i) { i.open_ == open_ && issue_matches(i, q, false) }).length()
}

///|
fn is_open_q() -> Bool {
  !iq.get().contains("is:closed")
}

///|
/// Text and background for a label chip: whichever of near-black or white reads better on it.
fn chip_style(color : String) -> String {
  let hex = chars_of(color.substring(start=1))
  fn hv(c : Char) -> Int {
    if c.is_ascii_digit() {
      c.to_int() - '0'.to_int()
    } else {
      c.to_int() - (if c.is_ascii_uppercase() { 'A' } else { 'a' }).to_int() + 10
    }
  }

  fn lin(v : Int) -> Double {
    let s = v.to_double() / 255.0
    if s <= 0.04045 {
      s / 12.92
    } else {
      ((s + 0.055) / 1.055).pow(2.4)
    }
  }

  let r = hv(hex[0]) * 16 + hv(hex[1])
  let g = hv(hex[2]) * 16 + hv(hex[3])
  let b = hv(hex[4]) * 16 + hv(hex[5])
  let l = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
  let dark_ink = (l + 0.05) / (0.0144 + 0.05) // ink #1f2328 ~ L 0.0144
  let white_ink = 1.05 / (l + 0.05)
  let ink = if dark_ink >= white_ink { "#1f2328" } else { "#ffffff" }
  "background:" + color + ";color:" + ink
}

///|
fn label_chip(name : String) -> DomNode {
  el(
    "button",
    [
      a_("type", "button"),
      cls("chip"),
      a_("style", chip_style(label_color(name))),
      a_("aria-label", "Filter by label " + name),
      on("click", fn(_e) {
        if tab_of_route(route.get()) == "issues" && route.get() == "issues" {
          set_iq(q_set(iq.get(), "label", name))
        } else {
          iq.set(q_set("is:issue is:open", "label", name))
          set_hash("#/issues")
        }
      }),
    ],
    [t(name)],
  )
}

///|
fn issue_icon(open_ : Bool) -> DomNode {
  if open_ {
    el("span", [cls("st st-open"), a_("role", "img"), a_("aria-label", "Open issue")], [icon("issue")])
  } else {
    el("span", [cls("st st-closed"), a_("role", "img"), a_("aria-label", "Closed issue")], [icon("issue-closed")])
  }
}

///|
fn issue_row(i : Issue) -> DomNode {
  el("li", [cls("issue-row")], [
    issue_icon(i.open_),
    el("div", [cls("issue-main")], [
      el("p", [cls("issue-title-line")], [
        el("a", [a_("href", "#/issues/" + i.num.to_string()), cls("issue-title")], [t(i.title)]),
        el("span", [cls("chips")], i.labels.map(label_chip)),
      ]),
      el("p", [cls("issue-meta")], [
        t(
          if i.open_ {
            "#" + i.num.to_string() + " opened " + i.ago + " by "
          } else {
            "#" + i.num.to_string() + " by "
          },
        ),
        el("a", [a_("href", "#/issues"), cls("meta-user"), on("click", fn(e) {
          prevent(e)
          set_iq(q_set(iq.get(), "author", i.author))
        })], [t(i.author)]),
        t(if i.open_ { "" } else { " was closed " + i.ago }),
        if i.milestone != "" {
          el("span", [cls("meta-ms")], [t(" · " + i.milestone)])
        } else {
          t("")
        },
      ]),
    ]),
    if i.comments > 0 {
      el("a", [a_("href", "#/issues/" + i.num.to_string()), cls("issue-comments"), a_("aria-label", plural(i.comments, "comment", "comments"))], [
        icon("comment"),
        t(i.comments.to_string()),
      ])
    } else {
      el("span", [cls("issue-comments")], [])
    },
  ])
}

///|
fn filter_menu(key : String, label : String, qkey : String, options : Array[(String, String)]) -> DomNode {
  popover(
    "f-" + key,
    "btn-bare filter-btn",
    "",
    [t(label), icon_c("caret", "ic caret")],
    "menu-pop filter-pop",
    fn() {
      [
        el("p", [cls("pop-title")], [t("Filter by " + label.to_lower())]),
        el(
          "ul",
          [cls("choice-list"), a_("aria-label", label)],
          options.map(fn(o) {
            let (v, text) = o
            el("li", [], [
              el(
                "button",
                [
                  a_("type", "button"),
                  cls("choice"),
                  ad("aria-pressed", fn() { bool_s(q_get(iq.get(), qkey) == v) }),
                  on("click", fn(_e) {
                    let cur = q_get(iq.get(), qkey)
                    set_iq(q_set(iq.get(), qkey, if cur == v && qkey != "sort" { "" } else { v }))
                    close_menu_focus()
                  }),
                ],
                [
                  el("span", [cls("choice-check")], [
                    @element.show(fn() { q_get(iq.get(), qkey) == v }, fn() { icon("check") }),
                  ]),
                  if qkey == "label" {
                    el("span", [cls("lab-dot"), a_("style", "background:" + label_color(v)), a_("aria-hidden", "true")], [])
                  } else if qkey == "author" || qkey == "assignee" {
                    avatar(v, 18)
                  } else {
                    t("")
                  },
                  el("span", [cls("choice-name")], [t(text)]),
                ],
              ),
            ])
          }),
        ),
      ]
    },
  )
}

///|
fn issues_view() -> DomNode {
  let shown = @resource.memo(fn() { shown_issues() })
  let authors = people.map(fn(p) { (p, p) })
  el("div", [cls("issues")], [
    el("div", [cls("issues-head")], [
      el("h2", [cls("view-h")], [t("Issues")]),
      el("a", [a_("href", "#/issues/new"), cls("btn btn-primary")], [t("New issue")]),
    ]),
    el(
      "form",
      [
        cls("issue-search"),
        a_("role", "search"),
        on("submit", fn(e) {
          prevent(e)
          iq.set(get_value("#issue-search"))
        }),
      ],
      [
        el("label", [a_("for", "issue-search"), cls("sr-only")], [t("Search all issues")]),
        icon("search"),
        el(
          "input",
          [
            a_("id", "issue-search"),
            a_("type", "text"),
            cls("input mono-ish"),
            a_("value", iq.get()),
            a_("autocomplete", "off"),
            a_("spellcheck", "false"),
            on("input", fn(e) { iq.set(ev_value(e)) }),
          ],
          [],
        ),
        el(
          "button",
          [
            a_("type", "button"),
            cls("btn btn-icon btn-bare"),
            a_("aria-label", "Clear filters"),
            on("click", fn(_e) { set_iq("is:issue is:open") }),
          ],
          [icon("x")],
        ),
      ],
    ),
    el("div", [cls("issue-box")], [
      el("div", [cls("issue-box-head")], [
        el("div", [cls("state-toggle"), a_("role", "group"), a_("aria-label", "Issue state")], [
          el(
            "button",
            [
              a_("type", "button"),
              ad("class", fn() { "state-btn" + (if is_open_q() { " is-on" } else { "" }) }),
              ad("aria-pressed", fn() { bool_s(is_open_q()) }),
              on("click", fn(_e) { set_iq(q_set(q_set(iq.get(), "is", ""), "is", "open")) }),
            ],
            [issue_icon_plain(true), el("span", [], [td(fn() { state_count(true).to_string() })]), el("span", [], [t("Open")])],
          ),
          el(
            "button",
            [
              a_("type", "button"),
              ad("class", fn() { "state-btn" + (if !is_open_q() { " is-on" } else { "" }) }),
              ad("aria-pressed", fn() { bool_s(!is_open_q()) }),
              on("click", fn(_e) { set_iq(q_set(q_set(iq.get(), "is", ""), "is", "closed")) }),
            ],
            [issue_icon_plain(false), el("span", [], [td(fn() { state_count(false).to_string() })]), el("span", [], [t("Closed")])],
          ),
        ]),
        el("div", [cls("filters")], [
          filter_menu("author", "Author", "author", authors),
          filter_menu("label", "Label", "label", labels.map(fn(l) { (l.name, l.name) })),
          filter_menu("projects", "Projects", "project", projects.map(fn(p) { (p, p) })),
          filter_menu("milestones", "Milestones", "milestone", [("3.5.0", "3.5.0"), ("4.0.0", "4.0.0"), ("3.4.0", "3.4.0 (closed)")]),
          filter_menu("assignees", "Assignees", "assignee", authors),
          filter_menu(
            "sort",
            "Sort",
            "sort",
            [
              ("created-desc", "Newest"),
              ("created-asc", "Oldest"),
              ("comments-desc", "Most commented"),
              ("comments-asc", "Least commented"),
            ],
          ),
        ]),
      ]),
      el("ul", [cls("issue-list"), a_("aria-label", "Issues")], [
        @element.for_each(fn() { shown() }, fn(i, _k) { issue_row(i) }),
      ]),
      @element.show(fn() { shown().length() == 0 }, fn() {
        el("div", [cls("blank-in")], [
          el("p", [cls("blank-h")], [t("No issues match this search.")]),
          el(
            "button",
            [a_("type", "button"), cls("btn"), on("click", fn(_e) { set_iq("is:issue is:open") })],
            [t("Clear filters")],
          ),
        ])
      }),
    ]),
  ])
}

///|
fn issue_icon_plain(open_ : Bool) -> DomNode {
  if open_ {
    icon("issue")
  } else {
    icon("issue-closed")
  }
}

///|
fn issue_view(num : Int) -> DomNode {
  let found = issues.get().filter(fn(i) { i.num == num })
  if found.length() == 0 {
    return el("div", [cls("blank")], [
      el("h2", [], [t("No issue #" + num.to_string())]),
      el("p", [], [el("a", [a_("href", "#/issues"), cls("link")], [t("All issues")])]),
    ])
  }
  let i = found[0]
  el("div", [cls("issue-page")], [
    el("p", [], [el("a", [a_("href", "#/issues"), cls("link small")], [t("← All issues")])]),
    el("h2", [cls("issue-h")], [
      t(i.title + " "),
      el("span", [cls("muted")], [t("#" + i.num.to_string())]),
    ]),
    el("p", [cls("issue-sub")], [
      el("span", [cls(if i.open_ { "state-pill open" } else { "state-pill closed" })], [
        issue_icon_plain(i.open_),
        t(if i.open_ { " Open" } else { " Closed" }),
      ]),
      t(" "),
      el("strong", [], [t(i.author)]),
      t(" opened this issue " + i.ago + " · " + plural(i.comments, "comment", "comments")),
    ]),
    el("div", [cls("issue-layout")], [
      el("article", [cls("comment-box")], [
        el("div", [cls("comment-head")], [
          avatar(i.author, 20),
          el("strong", [], [t(i.author)]),
          el("span", [cls("muted")], [t(" commented " + i.ago)]),
        ]),
        el("div", [cls("markdown comment-body")], md_blocks(i.body, "issue")),
      ]),
      el("aside", [cls("issue-side"), a_("aria-label", "Details")], [
        el("h3", [cls("side-h3")], [t("Labels")]),
        if i.labels.length() == 0 { el("p", [cls("muted small")], [t("None yet")]) } else { el("p", [cls("chips")], i.labels.map(label_chip)) },
        el("h3", [cls("side-h3")], [t("Milestone")]),
        el("p", [cls("muted small")], [t(if i.milestone == "" { "No milestone" } else { i.milestone })]),
        el("h3", [cls("side-h3")], [t("Assignees")]),
        el("p", [cls("muted small")], [t(if i.assignee == "" { "No one assigned" } else { i.assignee })]),
      ]),
    ]),
  ])
}

///|
fn submit_issue() -> Unit {
  let title = get_value("#new-title").trim(chars=" ").to_string()
  if title == "" {
    new_error.set(true)
    focus_sel("#new-title")
    return
  }
  let body = get_value("#new-body")
  let mut top = 0
  for i in issues.get() {
    if i.num > top {
      top = i.num
    }
  }
  let issue : Issue = {
    num: top + 1,
    title,
    open_: true,
    labels: [],
    author: "you",
    ago: "just now",
    comments: 0,
    milestone: "",
    assignee: "",
    project: "",
    body: if body == "" { "No description provided." } else { body },
  }
  @resource.batch(fn() {
    issues.update(fn(arr) { [issue] + (arr) })
    new_title.set("")
    new_body.set("")
    new_tab.set("write")
    new_error.set(false)
    iq.set("is:issue is:open")
  })
  set_hash("#/issues")
}

///|
fn new_issue_view() -> DomNode {
  el("div", [cls("new-issue")], [
    el("p", [], [el("a", [a_("href", "#/issues"), cls("link small")], [t("← All issues")])]),
    el("h2", [cls("view-h")], [t("Create new issue")]),
    el(
      "form",
      [
        cls("new-form"),
        a_("novalidate", ""),
        on("submit", fn(e) {
          prevent(e)
          submit_issue()
        }),
      ],
      [
        el("div", [cls("field")], [
          el("label", [a_("for", "new-title"), cls("field-label")], [
            t("Title "),
            el("span", [cls("req"), a_("aria-hidden", "true")], [t("*")]),
          ]),
          el(
            "input",
            [
              a_("id", "new-title"),
              a_("type", "text"),
              cls("input"),
              a_("required", ""),
              a_("autocomplete", "off"),
              a_("value", new_title.get()),
              ad("aria-invalid", fn() { bool_s(new_error.get()) }),
              a_("aria-describedby", "new-title-err"),
              on("input", fn(e) {
                new_title.set(ev_value(e))
                if new_error.get() { new_error.set(false) }
              }),
            ],
            [],
          ),
          el("p", [a_("id", "new-title-err"), cls("field-err"), a_("role", "alert")], [
            td(fn() { if new_error.get() { "A title is required." } else { "" } }),
          ]),
        ]),
        el("div", [cls("field")], [
          el("span", [cls("field-label"), a_("id", "new-body-l")], [t("Add a description")]),
          el("div", [cls("editor")], [
            el("div", [cls("editor-head")], [
              tablist("nt", [("write", "Write"), ("preview", "Preview")], new_tab, "editor-tabs"),
              el("span", [cls("muted small")], [t("Markdown is supported")]),
            ]),
            el("div", [a_("id", "nt-panel"), a_("role", "tabpanel"), ad("aria-labelledby", fn() { "nt-tab-" + new_tab.get() })], [
              el(
                "textarea",
                [
                  a_("id", "new-body"),
                  ad("class", fn() { "textarea" + (if new_tab.get() == "write" { "" } else { " is-off" }) }),
                  a_("rows", "10"),
                  a_("aria-labelledby", "new-body-l"),
                  a_("placeholder", "Type your description here…"),
                  on("input", fn(e) { new_body.set(ev_value(e)) }),
                ],
                [t(new_body.get())],
              ),
              @element.show(fn() { new_tab.get() == "preview" }, fn() {
                el("div", [cls("markdown preview")], [
                  keyed(fn() { new_body.get() }, fn(b) {
                    if b.trim(chars=" \n").to_owned() == "" {
                      el("p", [cls("muted")], [t("Nothing to preview")])
                    } else {
                      el("div", [], md_blocks(b, "preview"))
                    }
                  }),
                ])
              }),
            ]),
          ]),
        ]),
        el("div", [cls("form-foot")], [
          el("a", [a_("href", "#/issues"), cls("btn")], [t("Cancel")]),
          el("button", [a_("type", "submit"), cls("btn btn-primary")], [t("Submit new issue")]),
        ]),
      ],
    ),
  ])
}

///|
fn pulls_view() -> DomNode {
  el("div", [cls("issues")], [
    el("div", [cls("issues-head")], [el("h2", [cls("view-h")], [t("Pull requests")])]),
    el("div", [cls("issue-box")], [
      el("div", [cls("issue-box-head")], [
        el("p", [cls("state-btn is-on static")], [icon("pr"), el("span", [], [t(pulls.length().to_string())]), el("span", [], [t("Open")])]),
      ]),
      el(
        "ul",
        [cls("issue-list"), a_("aria-label", "Pull requests")],
        pulls.map(fn(p) {
          el("li", [cls("issue-row")], [
            el("span", [cls("st st-open"), a_("role", "img"), a_("aria-label", "Open pull request")], [icon("pr")]),
            el("div", [cls("issue-main")], [
              el("p", [cls("issue-title-line")], [
                el("span", [cls("issue-title")], [t(p.title)]),
                el("span", [cls("chips")], p.labels.map(label_chip)),
              ]),
              el("p", [cls("issue-meta")], [t("#" + p.num.to_string() + " opened " + p.ago + " by " + p.author)]),
            ]),
            if p.comments > 0 {
              el("span", [cls("issue-comments"), a_("aria-label", plural(p.comments, "comment", "comments"))], [
                icon("comment"),
                t(p.comments.to_string()),
              ])
            } else {
              el("span", [cls("issue-comments")], [])
            },
          ])
        }),
      ),
    ]),
  ])
}

///|
fn tab_view(name : String) -> DomNode {
  let (ic, h, p) = match name {
    "actions" => ("play", "Pipelines run on Forgeyard Actions", "The ci workflow tests every push on Node 22 and 24. Runs are not part of this demo.")
    "security" => ("shield", "No security advisories", "Lantern has published no advisories. Report a vulnerability privately to the maintainers.")
    _ => ("graph", "Insights", "1,284 commits by 27 contributors since 2022. Charts are not part of this demo.")
  }
  el("div", [cls("blank")], [
    icon_c(ic, "ic blank-ic"),
    el("h2", [cls("blank-h")], [t(h)]),
    el("p", [cls("muted")], [t(p)]),
    el("p", [], [el("a", [a_("href", "#/"), cls("link")], [t("Back to the code")])]),
  ])
}

///|
fn app_main() -> DomNode {
  el("div", [cls("app")], [
    repo_head(),
    el("div", [cls("container")], [
      title_row(),
      keyed(fn() { route.get() }, fn(r) {
        if r.has_prefix("home:") {
          home_view(r.substring(start=5))
        } else if r.has_prefix("blob:") {
          blob_view(r.substring(start=5))
        } else if r == "issues" {
          issues_view()
        } else if r == "new" {
          new_issue_view()
        } else if r.has_prefix("issue:") {
          issue_view(parse_int(r.substring(start=6)))
        } else if r == "pulls" {
          pulls_view()
        } else {
          tab_view(r.substring(start=4))
        }
      }),
    ]),
  ])
}
