// The file view: breadcrumb, latest commit, Code / Blame, toolbar, numbered lines, symbols.

///|
let blob_tab : @resource.Signal[String] = @resource.signal("code")

///|
let blob_raw : @resource.Signal[Bool] = @resource.signal(false)

///|
let wrap_lines : @resource.Signal[Bool] = @resource.signal(false)

///|
let sel_anchor : Ref[Int] = Ref(0)

///|
fn sel_hash(path : String, a : Int, b : Int) -> String {
  if a == 0 {
    "#/blob/" + path
  } else if a == b {
    "#/blob/" + path + "#L" + a.to_string()
  } else {
    "#/blob/" + path + "#L" + a.to_string() + "-L" + b.to_string()
  }
}

///|
fn select_lines(path : String, a : Int, b : Int) -> Unit {
  let (x, y) = if a <= b { (a, b) } else { (b, a) }
  @resource.batch(fn() {
    sel_from.set(x)
    sel_to.set(y)
  })
  replace_hash(sel_hash(path, x, y))
}

///|
fn size_text(bytes : Int) -> String {
  if bytes < 1024 {
    bytes.to_string() + " Bytes"
  } else {
    let tenths = bytes * 100 / 1024
    (tenths / 100).to_string() + "." + (tenths % 100).to_string().pad_start(2, '0') + " KB"
  }
}

///|
fn line_row(path : String, n : Int, line_nodes : Array[DomNode], blame : DomNode?) -> DomNode {
  let cells : Array[DomNode] = []
  match blame {
    Some(b) => cells.push(b)
    None => ()
  }
  cells.push(
    el("td", [cls("ln")], [
      el(
        "a",
        [
          a_("href", sel_hash(path, n, n)),
          a_("id", "L" + n.to_string()),
          cls("ln-btn"),
          a_("aria-label", "Line " + n.to_string()),
          on("click", fn(e) {
            prevent(e)
            if ev_shift(e) && sel_from.get() > 0 {
              select_lines(path, sel_anchor.val, n)
            } else {
              sel_anchor.val = n
              select_lines(path, n, n)
            }
          }),
        ],
        [t(n.to_string())],
      ),
    ]),
  )
  cells.push(el("td", [cls("lc")], [el("span", [cls("lc-in")], line_nodes)]))
  el(
    "tr",
    [
      ad("class", fn() {
        let a = sel_from.get()
        let b = sel_to.get()
        if a > 0 && n >= a && n <= b {
          "line is-sel"
        } else {
          "line"
        }
      }),
    ],
    cells,
  )
}

///|
fn code_table(path : String, text : String, with_blame : Bool) -> DomNode {
  let lines : Array[String] = text.split("\n").map(fn(s) { s.to_owned() }).to_array()
  let lang = lang_of(path)
  let state = Ref(false)
  let chunks = blame_chunks(path, lines.length())
  let rows : Array[DomNode] = []
  for i, line in lines {
    let n = i + 1
    let nodes = token_nodes(tokens(line, lang, state))
    let blame : DomNode? = if with_blame {
      let mut cell : DomNode? = None
      for ch in chunks {
        let (start, len, c) = ch
        if start == n {
          cell = Some(
            el("td", [cls("blame"), a_("rowspan", len.to_string())], [
              el("div", [cls("blame-in")], [
                el("span", [cls("blame-age")], [t(c.age)]),
                el("span", [cls("blame-msg")], [
                  avatar(c.author, 16),
                  el("a", [a_("href", "#/"), cls("blame-link")], [t(c.msg)]),
                ]),
              ]),
            ]),
          )
        }
      }
      match cell {
        Some(_) => cell
        None => None
      }
    } else {
      None
    }
    rows.push(line_row(path, n, if nodes.length() == 0 { [t("\u{200b}")] } else { nodes }, blame))
  }
  el(
    "div",
    [
      ad("class", fn() { "code-scroll" + (if wrap_lines.get() { " is-wrap" } else { "" }) }),
      a_("tabindex", "0"),
      a_("role", "region"),
      a_("aria-label", "File contents"),
    ],
    [
      el(
        "table",
        [cls(if with_blame { "code with-blame" } else { "code" })],
        [
          el("caption", [cls("sr-only")], [t(basename(path))]),
          el("tbody", [], rows),
        ],
      ),
    ],
  )
}

///|
fn blob_view(path : String) -> DomNode {
  match entry_of(path) {
    None =>
      el("div", [cls("blank")], [
        el("h2", [], [t("No file at " + path)]),
        el("p", [], [el("a", [a_("href", "#/"), cls("link")], [t("Back to the repository")])]),
      ])
    Some(e) => {
      let text = file_text(path)
      let lines : Array[String] = text.split("\n").map(fn(s) { s.to_owned() }).to_array()
      let loc = lines.filter(fn(l) { l.trim(chars=" ").to_owned() != "" }).length()
      let syms = symbols_of(path, text)
      el("div", [cls("blob layout-blob")], [
        el("div", [cls("blob-main")], [
          el("div", [cls("blob-crumbs")], [
            crumbs(path, false),
            copy_button("path-" + path, path, "Copy path"),
          ]),
          el("div", [cls("blob-commit")], [
            avatar(main_head.author, 20),
            el("a", [a_("href", "#/"), cls("ft-author")], [t(if e.pr == 418 { main_head.author } else { "jun-arata" })]),
            el("span", [cls("ft-msg")], [t(e.msg)] + (pr_link(e.pr))),
            el("span", [cls("ft-meta")], [t(e.age)]),
          ]),
          el("section", [cls("filebox"), a_("aria-label", basename(path))], [
            el("div", [cls("filebox-head")], [
              tablist("bl", [("code", "Code"), ("blame", "Blame")], blob_tab, "seg-tabs"),
              el("span", [cls("file-info")], [
                t(plural(lines.length(), "line", "lines") + " (" + loc.to_string() + " loc) · " + size_text(byte_len(text))),
              ]),
              el("div", [cls("file-actions")], [
                el(
                  "button",
                  [
                    a_("type", "button"),
                    cls("btn btn-sm"),
                    ad("aria-pressed", fn() { bool_s(blob_raw.get()) }),
                    on("click", fn(_e) { blob_raw.update(fn(v) { !v }) }),
                  ],
                  [t("Raw")],
                ),
                copy_button("raw-" + path, text, "Copy raw file"),
                el(
                  "a",
                  [
                    a_("href", data_url(text)),
                    a_("download", basename(path)),
                    cls("btn btn-sm btn-icon"),
                    a_("aria-label", "Download"),
                    a_("title", "Download"),
                  ],
                  [icon("download")],
                ),
                el(
                  "button",
                  [
                    a_("type", "button"),
                    cls("btn btn-sm wrap-btn"),
                    ad("aria-pressed", fn() { bool_s(wrap_lines.get()) }),
                    on("click", fn(_e) { wrap_lines.update(fn(v) { !v }) }),
                  ],
                  [icon("wrap"), t("Wrap lines")],
                ),
              ]),
            ]),
            el(
              "div",
              [
                a_("id", "bl-panel"),
                a_("role", "tabpanel"),
                ad("aria-labelledby", fn() { "bl-tab-" + blob_tab.get() }),
              ],
              [
                keyed(
                  fn() {
                    if blob_raw.get() {
                      "raw"
                    } else {
                      blob_tab.get()
                    }
                  },
                  fn(k) {
                    if k == "raw" {
                      el(
                        "pre",
                        [ad("class", fn() { "raw" + (if wrap_lines.get() { " is-wrap" } else { "" }) }), a_("tabindex", "0"), a_("aria-label", "Raw file")],
                        [t(text)],
                      )
                    } else {
                      code_table(path, text, k == "blame")
                    }
                  },
                ),
              ],
            ),
          ]),
        ]),
        el("aside", [cls("symbols"), a_("aria-labelledby", "sym-h")], [
          el("h2", [a_("id", "sym-h"), cls("side-h")], [t("Symbols")]),
          if syms.length() == 0 {
            el("p", [cls("muted small")], [t("No symbols in this file.")])
          } else {
            el(
              "ul",
              [cls("sym-list")],
              syms.map(fn(s) {
                let (n, kind, name) = s
                el("li", [], [
                  el(
                    "a",
                    [
                      a_("href", sel_hash(path, n, n)),
                      cls("sym-link"),
                      on("click", fn(ev) {
                        prevent(ev)
                        sel_anchor.val = n
                        @resource.batch(fn() {
                          blob_raw.set(false)
                        })
                        select_lines(path, n, n)
                        later(0, fn() {
                          scroll_to("#L" + n.to_string())
                          focus_sel("#L" + n.to_string())
                        })
                      }),
                    ],
                    [
                      el("span", [cls("sym-kind sym-" + kind)], [
                        t(match kind {
                          "func" => "func"
                          "type" => "type"
                          "head" => "h"
                          _ => "key"
                        }),
                      ]),
                      el("span", [cls("sym-name")], [t(name)]),
                      el("span", [cls("sym-line")], [t("L" + n.to_string())]),
                    ],
                  ),
                ])
              }),
            )
          },
        ]),
      ])
    }
  }
}
