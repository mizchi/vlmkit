// Matching, ranking and the numbers shown above the results. Pure functions over data.mbt.

///|
let stop_words : Array[String] = [
  "the", "a", "an", "of", "for", "to", "in", "on", "and", "is", "how", "what", "do",
  "does", "my", "with", "vs",
]

///|
fn tokens(q : String) -> Array[String] {
  let out : Array[String] = []
  for w in q.to_lower().split(" ") {
    let t = w.to_string()
    if t.length() >= 2 && !stop_words.contains(t) && !out.contains(t) {
      out.push(t)
    }
  }
  out
}

///|
fn normalize(q : String) -> String {
  tokens_all(q).join(" ")
}

///|
fn tokens_all(q : String) -> Array[String] {
  let out : Array[String] = []
  for w in q.to_lower().split(" ") {
    let t = w.to_string()
    if t != "" {
      out.push(t)
    }
  }
  out
}

///|
fn score(p : Page, toks : Array[String]) -> Int {
  let mut n = 0
  for t in toks {
    if p.keys.contains(t) {
      n += 1
    }
  }
  n
}

///|
/// Every page that matches, best first. `verbatim` asks for every word.
fn search(q : String, verbatim : Bool) -> Array[Page] {
  let toks = tokens(q)
  if toks.is_empty() {
    return []
  }
  let scored : Array[(Int, Page)] = []
  for p in pages {
    let s = score(p, toks)
    if s > 0 && (!verbatim || s == toks.length()) {
      scored.push((s, p))
    }
  }
  scored.sort_by(fn(a, b) {
    if a.0 != b.0 {
      b.0 - a.0
    } else {
      a.1.id - b.1.id
    }
  })
  scored.map(fn(x) { x.1 })
}

///|
fn within(p : Page, time : String) -> Bool {
  match time {
    "week" => p.days <= 7
    "month" => p.days <= 31
    "year" => p.days <= 365
    _ => true
  }
}

///|
fn tab_kind(tab : String) -> String {
  match tab {
    "news" => "news"
    "videos" => "video"
    "maps" => "map"
    "books" => "book"
    "shopping" => "shop"
    _ => ""
  }
}

///|
fn group(n : Int) -> String {
  let s = n.to_string()
  if s.length() <= 3 {
    return s
  }
  let buf = StringBuilder::new()
  let len = s.length()
  for i in 0..<len {
    if i > 0 && (len - i) % 3 == 0 {
      buf.write_string(",")
    }
    buf.write_char(s[i].unsafe_to_char())
  }
  buf.to_string()
}

///|
/// "About 1,240 results (0.31 seconds)": fixed per query, derived from the seed.
fn stats_for(q : String, count : Int, page : Int) -> String {
  let (total, secs) = match normalize(q) {
    "moon landing" => (1240, "0.31")
    "pour over coffee" => (986, "0.28")
    "trail running shoes" => (2150, "0.35")
    other => {
      let n = count * 83 + other.length() * 7
      let hundredths = 20 + other.length() % 17
      (n, "0." + hundredths.to_string())
    }
  }
  if page > 1 {
    "Page \{page} of about \{group(total)} results (\{secs} seconds)"
  } else {
    "About \{group(total)} results (\{secs} seconds)"
  }
}

///|
fn suggest(typed : String) -> Array[String] {
  let t = typed.to_lower()
  let t = t.trim().to_string()
  if t == "" {
    // Nothing typed yet: ArrowDown still opens the list, with the searches that have full pages.
    return [
      "moon landing", "pour over coffee", "trail running shoes", "tideline language", "coffee harvest 2026",
    ]
  }
  let out : Array[String] = []
  for s in suggestions {
    if out.length() < 8 && s.has_prefix(t) {
      out.push(s)
    }
  }
  out
}

///|
fn is_word_char(c : Char) -> Bool {
  (c >= 'a' && c <= 'z') ||
  (c >= 'A' && c <= 'Z') ||
  (c >= '0' && c <= '9') ||
  c == '\''
}

///|
/// Split a snippet into (text, bold) runs: words that start with a query token are bold.
fn bold_runs(text : String, toks : Array[String]) -> Array[(String, Bool)] {
  let runs : Array[(String, Bool)] = []
  let cur = StringBuilder::new()
  let word = StringBuilder::new()
  let flush_word = fn() {
    let w = word.to_string()
    if w != "" {
      let lw = w.to_lower()
      let hit = toks.iter().any(fn(t) { lw.has_prefix(t) })
      if hit {
        let c = cur.to_string()
        if c != "" {
          runs.push((c, false))
        }
        cur.reset()
        runs.push((w, true))
      } else {
        cur.write_string(w)
      }
      word.reset()
    }
  }
  for c in text {
    if is_word_char(c) {
      word.write_char(c)
    } else {
      flush_word()
      cur.write_char(c)
    }
  }
  flush_word()
  let c = cur.to_string()
  if c != "" {
    runs.push((c, false))
  }
  runs
}
