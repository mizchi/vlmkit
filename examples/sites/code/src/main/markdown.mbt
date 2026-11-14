// A small Markdown renderer for the README, the issue preview and issue bodies.

///|
fn chars_of(s : String) -> Array[Char] {
  s.iter().to_array()
}

///|
fn str_of(cs : Array[Char], from : Int, to : Int) -> String {
  if from >= to {
    ""
  } else {
    String::from_array(cs[from:to])
  }
}

///|
fn index_from(cs : Array[Char], ch : Char, from : Int) -> Int {
  let mut i = from
  while i < cs.length() {
    if cs[i] == ch {
      return i
    }
    i += 1
  }
  -1
}

///|
fn slug(text : String) -> String {
  let buf = StringBuilder::new()
  let mut dash = false
  for ch in text.to_lower() {
    if ch.is_ascii_alphabetic() || ch.is_ascii_digit() {
      buf.write_char(ch)
      dash = false
    } else if !dash && buf.to_string().length() > 0 {
      buf.write_char('-')
      dash = true
    }
  }
  let s = buf.to_string()
  if s.has_suffix("-") {
    s.substring(end=s.length() - 1)
  } else {
    s
  }
}

///|
/// Inline Markdown: `code`, **bold**, [text](href), and badge images.
fn md_inline(s : String) -> Array[DomNode] {
  let cs = chars_of(s)
  let out : Array[DomNode] = []
  let buf = StringBuilder::new()
  fn flush() {
    let v = buf.to_string()
    if v != "" {
      out.push(t(v))
      buf.reset()
    }
  }

  let mut i = 0
  while i < cs.length() {
    let ch = cs[i]
    if ch == '`' {
      let j = index_from(cs, '`', i + 1)
      if j > 0 {
        flush()
        out.push(el("code", [], [t(str_of(cs, i + 1, j))]))
        i = j + 1
        continue
      }
    }
    if ch == '*' && i + 1 < cs.length() && cs[i + 1] == '*' {
      let mut j = i + 2
      while j + 1 < cs.length() && !(cs[j] == '*' && cs[j + 1] == '*') {
        j += 1
      }
      if j + 1 < cs.length() {
        flush()
        out.push(el("strong", [], md_inline(str_of(cs, i + 2, j))))
        i = j + 2
        continue
      }
    }
    if ch == '[' && i + 1 < cs.length() && cs[i + 1] == '!' {
      // [![label: value](img)](href) — a badge
      let close = index_from(cs, ']', i + 3)
      let end = index_from(cs, ')', close + 1)
      let end2 = index_from(cs, ')', end + 1)
      if close > 0 && end > 0 && end2 > 0 {
        flush()
        out.push(badge(str_of(cs, i + 3, close)))
        i = end2 + 1
        continue
      }
    }
    if ch == '[' {
      let close = index_from(cs, ']', i + 1)
      if close > 0 && close + 1 < cs.length() && cs[close + 1] == '(' {
        let end = index_from(cs, ')', close + 2)
        if end > 0 {
          flush()
          let href = str_of(cs, close + 2, end)
          out.push(
            el("a", [a_("href", href)], md_inline(str_of(cs, i + 1, close))),
          )
          i = end + 1
          continue
        }
      }
    }
    buf.write_char(ch)
    i += 1
  }
  flush()
  out
}

///|
fn badge(alt : String) -> DomNode {
  let (label, value) = match alt.split_once(": ") {
    Some((a, b)) => (a.to_string(), b.to_string())
    None => (alt, "")
  }
  let tone = match label {
    "build" => "ok"
    "coverage" => "ok"
    "license" => "info"
    _ => "accent"
  }
  el("span", [cls("badge"), a_("role", "img"), a_("aria-label", alt)], [
    el("span", [cls("badge-l"), a_("aria-hidden", "true")], [t(label)]),
    el("span", [cls("badge-v tone-" + tone), a_("aria-hidden", "true")], [
      t(value),
    ]),
  ])
}

///|
fn table_cells(line : String) -> Array[String] {
  let trimmed = line.trim(chars=" ").to_string()
  let inner = trimmed.substring(
    start=if trimmed.has_prefix("|") { 1 } else { 0 },
    end=if trimmed.has_suffix("|") {
      trimmed.length() - 1
    } else {
      trimmed.length()
    },
  )
  inner.split("|").map(fn(c) { c.trim(chars=" ").to_string() }).to_array()
}

///|
/// Headings of a Markdown source: (level, text, id).
fn md_headings(src : String) -> Array[(Int, String, String)] {
  let out = []
  let mut fence = false
  for line in src.split("\n") {
    let l = line.to_string()
    if l.has_prefix("```") {
      fence = !fence
      continue
    }
    if fence {
      continue
    }
    let level = if l.has_prefix("### ") {
      3
    } else if l.has_prefix("## ") {
      2
    } else if l.has_prefix("# ") {
      1
    } else {
      0
    }
    if level > 0 {
      let text = l.substring(start=level + 1)
      out.push((level, text, "md-" + slug(text)))
    }
  }
  out
}

///|
/// Block Markdown. `copy_key` names the code blocks' copy buttons.
fn md_blocks(src : String, copy_key : String) -> Array[DomNode] {
  let lines : Array[String] = src.split("\n").map(fn(l) { l.to_owned() }).to_array()
  let out : Array[DomNode] = []
  let para : Array[String] = []
  fn flush_para() {
    if para.length() > 0 {
      out.push(el("p", [], md_inline(para.join(" "))))
      para.clear()
    }
  }

  let mut i = 0
  let mut code_n = 0
  while i < lines.length() {
    let l = lines[i]
    if l.has_prefix("```") {
      flush_para()
      let lang = l.substring(start=3)
      let body : Array[String] = []
      i += 1
      while i < lines.length() && !lines[i].has_prefix("```") {
        body.push(lines[i])
        i += 1
      }
      i += 1
      code_n += 1
      out.push(code_block(body.join("\n"), lang, copy_key + "-" + code_n.to_string()))
      continue
    }
    let level = if l.has_prefix("### ") {
      3
    } else if l.has_prefix("## ") {
      2
    } else if l.has_prefix("# ") {
      1
    } else {
      0
    }
    if level > 0 {
      flush_para()
      let text = l.substring(start=level + 1)
      out.push(
        el("h" + level.to_string(), [a_("id", "md-" + slug(text)), cls("md-h")], [
          t(text),
        ]),
      )
      i += 1
      continue
    }
    if l.has_prefix("|") {
      flush_para()
      let head = table_cells(l)
      let rows : Array[Array[String]] = []
      i += 1
      if i < lines.length() && lines[i].has_prefix("|---") {
        i += 1
      }
      while i < lines.length() && lines[i].has_prefix("|") {
        rows.push(table_cells(lines[i]))
        i += 1
      }
      out.push(
        el("div", [cls("md-table-wrap")], [
          el("table", [cls("md-table")], [
            el("thead", [], [
              el("tr", [], head.map(fn(h) { el("th", [a_("scope", "col")], md_inline(h)) })),
            ]),
            el(
              "tbody",
              [],
              rows.map(fn(r) { el("tr", [], r.map(fn(c) { el("td", [], md_inline(c)) })) }),
            ),
          ]),
        ]),
      )
      continue
    }
    if l.has_prefix("- ") {
      flush_para()
      let items : Array[String] = []
      while i < lines.length() && lines[i].has_prefix("- ") {
        items.push(lines[i].substring(start=2))
        i += 1
      }
      let is_task = items.length() > 0 && items[0].has_prefix("[")
      if is_task {
        out.push(
          el(
            "ul",
            [cls("md-tasks")],
            items.map(fn(it) {
              let done = it.has_prefix("[x]")
              let text = it.substring(start=4)
              el("li", [cls(if done { "task done" } else { "task" })], [
                el(
                  "span",
                  [
                    cls("task-box"),
                    a_("role", "img"),
                    a_("aria-label", if done { "Done:" } else { "To do:" }),
                  ],
                  if done { [icon("check")] } else { [] },
                ),
                el("span", [], md_inline(text)),
              ])
            }),
          ),
        )
      } else {
        out.push(
          el("ul", [], items.map(fn(it) { el("li", [], md_inline(it)) })),
        )
      }
      continue
    }
    if is_ordered(l) {
      flush_para()
      let items : Array[String] = []
      while i < lines.length() && is_ordered(lines[i]) {
        match lines[i].find(". ") {
          Some(at) => items.push(lines[i].substring(start=at + 2))
          None => items.push(lines[i])
        }
        i += 1
      }
      out.push(el("ol", [], items.map(fn(it) { el("li", [], md_inline(it)) })))
      continue
    }
    if l.has_prefix("> ") {
      flush_para()
      out.push(el("blockquote", [], md_inline(l.substring(start=2))))
      i += 1
      continue
    }
    if l.trim(chars=" ").to_owned() == "" {
      flush_para()
    } else {
      // a line of badges stands alone
      if l.has_prefix("[![") {
        flush_para()
        out.push(el("p", [cls("badges")], md_inline(l)))
      } else {
        para.push(l)
      }
    }
    i += 1
  }
  flush_para()
  out
}

///|
fn code_block(code : String, lang : String, key : String) -> DomNode {
  el("div", [cls("md-code")], [
    el(
      "pre",
      [a_("tabindex", "0"), a_("aria-label", "Code example")],
      [el("code", [], highlight_text(code, lang))],
    ),
    copy_button(key, code, "Copy code"),
  ])
}

///|
/// A copy button with a "Copied!" tooltip. The clipboard is written when the browser allows it.
fn copy_button(key : String, text : String, label : String) -> DomNode {
  el("span", [cls("copy-wrap")], [
    el(
      "button",
      [
        a_("type", "button"),
        cls("btn btn-icon copy-btn"),
        a_("aria-label", label),
        on("click", fn(_e) {
          copy_text(text)
          copied.set(key)
          later(1800, fn() { if copied.get() == key { copied.set("") } })
        }),
      ],
      [
        @element.show(fn() { copied.get() != key }, fn() { icon("copy") }),
        @element.show(fn() { copied.get() == key }, fn() {
          icon_c("check", "ic ic-ok")
        }),
      ],
    ),
    el("span", [cls("tooltip"), a_("role", "status")], [
      td(fn() { if copied.get() == key { "Copied!" } else { "" } }),
    ]),
  ])
}

///|
fn is_ordered(l : String) -> Bool {
  let cs = chars_of(l)
  let mut i = 0
  while i < cs.length() && cs[i].is_ascii_digit() {
    i += 1
  }
  i > 0 && i + 1 < cs.length() && cs[i] == '.' && cs[i + 1] == ' '
}
