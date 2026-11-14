// Simple syntax colouring: keywords, strings, comments, numbers.

///|
let ts_keywords : Array[String] = [
  "import", "export", "from", "const", "let", "var", "function", "return", "if",
  "else", "for", "of", "in", "while", "async", "await", "type", "interface", "new",
  "throw", "true", "false", "null", "undefined", "class", "extends", "typeof", "as",
  "default", "continue", "break", "try", "catch", "number", "string", "boolean",
  "void", "unknown",
]

///|
fn lang_of(path : String) -> String {
  if path.has_suffix(".ts") || path.has_suffix(".js") {
    "ts"
  } else if path.has_suffix(".json") {
    "json"
  } else if path.has_suffix(".yml") ||
    path.has_suffix(".yaml") ||
    path.has_suffix(".gitignore") ||
    path.has_suffix(".editorconfig") {
    "hash"
  } else if path.has_suffix(".md") {
    "md"
  } else {
    "text"
  }
}

///|
fn is_ident(ch : Char) -> Bool {
  ch.is_ascii_alphabetic() || ch.is_ascii_digit() || ch == '_' || ch == '$'
}

///|
/// Tokens of one line: (class, text). `in_block` carries a /* comment */ across lines.
fn tokens(line : String, lang : String, in_block : Ref[Bool]) -> Array[(String, String)] {
  let cs = chars_of(line)
  let out : Array[(String, String)] = []
  let n = cs.length()
  let mut i = 0
  let mut plain = 0
  fn push_plain(upto : Int) {
    if upto > plain {
      out.push(("", str_of(cs, plain, upto)))
    }
  }

  if lang == "text" {
    return [("", line)]
  }
  if lang == "md" {
    if line.has_prefix("#") {
      return [("tk-k", line)]
    }
    return [("", line)]
  }
  while i < n {
    let ch = cs[i]
    if in_block.val {
      let start = i
      while i < n && !(cs[i] == '*' && i + 1 < n && cs[i + 1] == '/') {
        i += 1
      }
      if i < n {
        i += 2
        in_block.val = false
      }
      out.push(("tk-c", str_of(cs, start, i)))
      plain = i
      continue
    }
    if lang == "ts" && ch == '/' && i + 1 < n && cs[i + 1] == '/' {
      push_plain(i)
      out.push(("tk-c", str_of(cs, i, n)))
      return out
    }
    if lang == "ts" && ch == '/' && i + 1 < n && cs[i + 1] == '*' {
      push_plain(i)
      in_block.val = true
      plain = i
      continue
    }
    if lang == "hash" && ch == '#' && (i == 0 || cs[i - 1] == ' ') {
      push_plain(i)
      out.push(("tk-c", str_of(cs, i, n)))
      return out
    }
    if ch == '"' || ch == '\'' || ch == '`' {
      push_plain(i)
      let start = i
      i += 1
      while i < n && cs[i] != ch {
        if cs[i] == '\\' {
          i += 1
        }
        i += 1
      }
      i = if i < n { i + 1 } else { n }
      out.push(("tk-s", str_of(cs, start, i)))
      plain = i
      continue
    }
    if ch.is_ascii_digit() && (i == 0 || !is_ident(cs[i - 1])) {
      push_plain(i)
      let start = i
      while i < n && (cs[i].is_ascii_digit() || cs[i] == '.') {
        i += 1
      }
      out.push(("tk-n", str_of(cs, start, i)))
      plain = i
      continue
    }
    if is_ident(ch) && (i == 0 || !is_ident(cs[i - 1])) {
      let start = i
      while i < n && is_ident(cs[i]) {
        i += 1
      }
      let word = str_of(cs, start, i)
      if lang == "ts" && ts_keywords.contains(word) {
        push_plain(start)
        out.push(("tk-k", word))
        plain = i
      } else if lang == "hash" && i < n && cs[i] == ':' && line.trim_start(chars=" -").to_owned().has_prefix(word) {
        push_plain(start)
        out.push(("tk-k", word))
        plain = i
      }
      continue
    }
    i += 1
  }
  push_plain(n)
  out
}

///|
fn token_nodes(toks : Array[(String, String)]) -> Array[DomNode] {
  toks.map(fn(tk) {
    let (k, s) = tk
    if k == "" {
      t(s)
    } else {
      el("span", [cls(k)], [t(s)])
    }
  })
}

///|
/// A whole text, coloured, with its newlines kept (for <pre> blocks).
fn highlight_text(code : String, lang : String) -> Array[DomNode] {
  let state = Ref(false)
  let l = if lang == "sh" { "hash" } else { lang }
  let out : Array[DomNode] = []
  let lines : Array[String] = code.split("\n").map(fn(s) { s.to_owned() }).to_array()
  for i, line in lines {
    for nd in token_nodes(tokens(line, l, state)) {
      out.push(nd)
    }
    if i + 1 < lines.length() {
      out.push(t("\n"))
    }
  }
  out
}

///|
/// Functions and other symbols of a file: (line, kind, name).
fn symbols_of(path : String, text : String) -> Array[(Int, String, String)] {
  let lang = lang_of(path)
  let out = []
  for i, line in text.split("\n").to_array() {
    let l = line.to_string()
    let n = i + 1
    if lang == "ts" {
      for kw in ["function ", "interface "] {
        match l.find(kw) {
          Some(at) => {
            let rest = chars_of(l.substring(start=at + kw.length()))
            let mut j = 0
            while j < rest.length() && is_ident(rest[j]) {
              j += 1
            }
            if j > 0 {
              out.push(
                (n, if kw == "function " { "func" } else { "type" }, str_of(rest, 0, j)),
              )
            }
          }
          None => ()
        }
      }
    } else if lang == "md" {
      if l.has_prefix("#") {
        out.push((n, "head", l.trim_start(chars="# ").to_string()))
      }
    } else if lang == "hash" || lang == "json" {
      // top-level keys
      let cs = chars_of(l)
      if cs.length() > 0 && cs[0] != ' ' && cs[0] != '#' && cs[0] != '{' && cs[0] != '}' {
        match l.find(":") {
          Some(at) => out.push((n, "key", l.substring(end=at).trim(chars="\" ").to_string()))
          None => ()
        }
      } else if lang == "json" && l.has_prefix("  \"") {
        match l.find(":") {
          Some(at) => out.push((n, "key", l.substring(end=at).trim(chars="\" ").to_string()))
          None => ()
        }
      }
    }
  }
  out
}
