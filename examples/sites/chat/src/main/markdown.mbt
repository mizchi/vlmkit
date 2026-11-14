// A small Markdown subset: paragraphs, **bold**, `inline code`, bulleted and numbered lists,
// headings, tables and fenced code blocks. It must also read a half-streamed reply: an unclosed
// fence is a code block that is still arriving, and an unclosed ** or ` is plain text.

///|
enum Block {
  Para(String)
  Heading(Int32, String)
  Bullets(Array[String])
  Numbered(Array[String])
  Code(String, String)
  Table(Array[String], Array[Array[String]])
}

///|
enum Inline {
  Plain(String)
  Bold(String)
  InlineCode(String)
}

///|
fn trim_s(s : String) -> String {
  s.trim().to_string()
}

///|
fn split_lines(s : String) -> Array[String] {
  s.split("\n").map(fn(v) { v.to_string() }).collect()
}

///|
fn is_numbered(line : String) -> Bool {
  let chars = line.iter().collect()
  let mut i = 0
  while i < chars.length() && chars[i] >= '0' && chars[i] <= '9' {
    i = i + 1
  }
  i > 0 && i + 1 < chars.length() && chars[i] == '.' && chars[i + 1] == ' '
}

///|
fn after_number(line : String) -> String {
  match line.find(". ") {
    Some(i) => line.substring(start=i + 2)
    None => line
  }
}

///|
fn table_cells(line : String) -> Array[String] {
  let t = trim_s(line)
  let inner = if t.has_prefix("|") { t.substring(start=1) } else { t }
  let inner2 = if inner.has_suffix("|") {
    inner.substring(end=inner.length() - 1)
  } else {
    inner
  }
  inner2.split("|").map(fn(c) { c.trim().to_string() }).collect()
}

///|
fn is_separator_row(line : String) -> Bool {
  let t = trim_s(line)
  t.has_prefix("|") && t.contains("---")
}

///|
fn parse_blocks(src : String) -> Array[Block] {
  let lines = split_lines(src)
  let out : Array[Block] = []
  let para : Array[String] = []
  fn flush_para() {
    if para.length() > 0 {
      out.push(Para(para.join(" ")))
      para.clear()
    }
  }

  let mut i = 0
  while i < lines.length() {
    let line = lines[i]
    let t = trim_s(line)
    if t.has_prefix("```") {
      flush_para()
      let lang = trim_s(t.substring(start=3))
      let body : Array[String] = []
      i = i + 1
      while i < lines.length() && !trim_s(lines[i]).has_prefix("```") {
        body.push(lines[i])
        i = i + 1
      }
      out.push(Code(lang, body.join("\n")))
      i = i + 1
    } else if t == "" {
      flush_para()
      i = i + 1
    } else if t.has_prefix("#") {
      flush_para()
      let mut level = 0
      for c in t {
        if c == '#' {
          level = level + 1
        } else {
          break
        }
      }
      out.push(Heading(level, trim_s(t.substring(start=level))))
      i = i + 1
    } else if t.has_prefix("- ") {
      flush_para()
      let items : Array[String] = []
      while i < lines.length() && trim_s(lines[i]).has_prefix("- ") {
        items.push(trim_s(lines[i]).substring(start=2))
        i = i + 1
      }
      out.push(Bullets(items))
    } else if is_numbered(t) {
      flush_para()
      let items : Array[String] = []
      while i < lines.length() && is_numbered(trim_s(lines[i])) {
        items.push(after_number(trim_s(lines[i])))
        i = i + 1
      }
      out.push(Numbered(items))
    } else if t.has_prefix("|") {
      flush_para()
      let head = table_cells(t)
      let rows : Array[Array[String]] = []
      i = i + 1
      while i < lines.length() && trim_s(lines[i]).has_prefix("|") {
        if !is_separator_row(lines[i]) {
          rows.push(table_cells(lines[i]))
        }
        i = i + 1
      }
      out.push(Table(head, rows))
    } else {
      para.push(t)
      i = i + 1
    }
  }
  flush_para()
  out
}

///|
/// Split a line into plain, bold and code runs. An opener with no closer stays plain text.
fn parse_inline(s : String) -> Array[Inline] {
  let chars : Array[Char] = s.iter().collect()
  let n = chars.length()
  let out : Array[Inline] = []
  let buf = StringBuilder::new()
  fn flush() {
    let v = buf.to_string()
    if v != "" {
      out.push(Plain(v))
    }
    buf.reset()
  }

  fn find_from(start : Int32, a : Char, two : Bool) -> Int32 {
    let mut j = start
    while j < n {
      if chars[j] == a && (!two || (j + 1 < n && chars[j + 1] == a)) {
        return j
      }
      j = j + 1
    }
    -1
  }

  fn slice(a : Int32, b : Int32) -> String {
    let sb = StringBuilder::new()
    for k = a; k < b; k = k + 1 {
      sb.write_char(chars[k])
    }
    sb.to_string()
  }

  let mut i = 0
  while i < n {
    let c = chars[i]
    if c == '*' && i + 1 < n && chars[i + 1] == '*' {
      let close = find_from(i + 2, '*', true)
      if close > i + 2 {
        flush()
        out.push(Bold(slice(i + 2, close)))
        i = close + 2
        continue
      }
    } else if c == '`' {
      let close = find_from(i + 1, '`', false)
      if close > i + 1 {
        flush()
        out.push(InlineCode(slice(i + 1, close)))
        i = close + 1
        continue
      }
    }
    buf.write_char(c)
    i = i + 1
  }
  flush()
  out
}

///|
/// Plain text of a reply, as "Copy" puts it on the clipboard: the Markdown source.
fn char_len(s : String) -> Int32 {
  s.length()
}
