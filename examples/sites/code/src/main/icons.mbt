// Line icons drawn for this site on a 16px grid. Decorative: aria-hidden.

///|
fn icon_paths(name : String) -> Array[DomNode] {
  fn p(d : String) -> DomNode {
    svg_el("path", [a_("d", d)], [])
  }

  fn c(cx : String, cy : String, r : String) -> DomNode {
    svg_el("circle", [a_("cx", cx), a_("cy", cy), a_("r", r)], [])
  }

  match name {
    "folder" =>
      [
        svg_el(
          "path",
          [
            a_("d", "M1.5 3h4.2l1.6 1.7h7.2v8.8h-13z"),
            a_("fill", "currentColor"),
            a_("stroke", "none"),
          ],
          [],
        ),
      ]
    "file" => [p("M3.5 1.5h5.5l3.5 3.5v9.5h-9z"), p("M8.5 1.5v4h4")]
    "code" => [p("M5.5 4.5 2 8l3.5 3.5"), p("M10.5 4.5 14 8l-3.5 3.5")]
    "issue" => [c("8", "8", "6.5"), c("8", "8", "1.2")]
    "issue-closed" => [c("8", "8", "6.5"), p("M5.2 8.2 7.2 10.2 10.8 6")]
    "pr" =>
      [
        c("4", "3.5", "1.6"),
        c("4", "12.5", "1.6"),
        c("12", "12.5", "1.6"),
        p("M4 5.1v5.8"),
        p("M12 10.9V6.5c0-1.4-.8-2.2-2.2-2.2H7.5"),
        p("M9 2.8 7.5 4.3 9 5.8"),
      ]
    "play" => [c("8", "8", "6.5"), p("M6.5 5.5v5l4-2.5z")]
    "shield" => [p("M8 1.5 13.5 3.5v4c0 3.3-2.3 5.8-5.5 7-3.2-1.2-5.5-3.7-5.5-7v-4z")]
    "graph" => [p("M1.5 14.5h13"), p("M2.5 11.5 6 7.5l3 2.5 4.5-6")]
    "star" =>
      [
        p(
          "M8 1.8l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.6l-3.8 2 .7-4.3-3.1-3 4.3-.6z",
        ),
      ]
    "star-fill" =>
      [
        svg_el(
          "path",
          [
            a_(
              "d", "M8 1.8l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.6l-3.8 2 .7-4.3-3.1-3 4.3-.6z",
            ),
            a_("fill", "currentColor"),
          ],
          [],
        ),
      ]
    "eye" =>
      [p("M1.2 8C2.8 5 5.2 3.5 8 3.5S13.2 5 14.8 8c-1.6 3-4 4.5-6.8 4.5S2.8 11 1.2 8z"), c("8", "8", "2")]
    "fork" =>
      [
        c("4", "3", "1.5"),
        c("12", "3", "1.5"),
        c("8", "13", "1.5"),
        p("M4 4.5v1.2c0 1 .8 1.8 1.8 1.8h4.4c1 0 1.8-.8 1.8-1.8V4.5"),
        p("M8 7.5v4"),
      ]
    "branch" =>
      [
        c("4.5", "3", "1.5"),
        c("4.5", "13", "1.5"),
        c("11.5", "4.5", "1.5"),
        p("M4.5 4.5v7"),
        p("M11.5 6v.5c0 2-1.5 3-3.5 3H6c-.9 0-1.5.6-1.5 1.5"),
      ]
    "tag" => [p("M1.5 2.5v5l7 7 6-6-7-7h-5z"), c("5", "5", "1.1")]
    "search" => [c("7", "7", "4.8"), p("M10.5 10.5 14.5 14.5")]
    "copy" => [p("M5.5 5.5h8v8h-8z"), p("M10.5 5.5v-3h-8v8h3")]
    "check" => [p("M3 8.5 6.5 12 13 4.5")]
    "book" =>
      [p("M2 2.5h4.5c.9 0 1.5.6 1.5 1.5v10c0-.8-.7-1.5-1.5-1.5H2z"), p("M14 2.5H9.5C8.6 2.5 8 3.1 8 4v10c0-.8.7-1.5 1.5-1.5H14z")]
    "outline" => [p("M2 4h12"), p("M5 8h9"), p("M5 12h9"), p("M2 8h.5"), p("M2 12h.5")]
    "history" => [p("M2.5 8a5.5 5.5 0 1 0 1.6-3.9"), p("M2 2.5v2.8h2.8"), p("M8 5v3.2l2.2 1.4")]
    "x" => [p("M3.5 3.5l9 9"), p("M12.5 3.5l-9 9")]
    "link" => [p("M7 9a3 3 0 0 0 4.2 0l2.3-2.3a3 3 0 0 0-4.2-4.2L8.5 3.3"), p("M9 7a3 3 0 0 0-4.2 0L2.5 9.3a3 3 0 0 0 4.2 4.2l.8-.8")]
    "scale" => [p("M8 2v12"), p("M4.5 14.5h7"), p("M2.5 4.5h11"), p("M4 4.5 2 9h4z"), p("M12 4.5 10 9h4z")]
    "pulse" => [p("M1 8.5h3l2-5 3.5 9 2-4h3.5")]
    "terminal" => [p("M1.5 2.5h13v11h-13z"), p("M4 6l2.2 2L4 10"), p("M8 10.5h4")]
    "download" => [p("M8 2v8.5"), p("M4.5 7.5 8 11l3.5-3.5"), p("M2.5 13.5h11")]
    "comment" => [p("M1.5 2.5h13v8.5h-7l-3.5 3v-3h-2.5z")]
    "menu" => [p("M2 4h12"), p("M2 8h12"), p("M2 12h12")]
    "person" => [c("8", "5", "3"), p("M2.5 14.5c.5-3 2.7-4.5 5.5-4.5s5 1.5 5.5 4.5")]
    "caret" =>
      [
        svg_el(
          "path",
          [a_("d", "M4.5 6.5h7L8 10z"), a_("fill", "currentColor"), a_("stroke", "none")],
          [],
        ),
      ]
    "repo" => [p("M3 1.5h10v11H4.5a1.5 1.5 0 0 0 0 3H13"), p("M3 1.5v12.5")]
    "law" => [p("M8 2v12"), p("M2.5 4.5h11")]
    "up" => [p("M8 13V3"), p("M4 7l4-4 4 4")]
    "dots" => [c("3.5", "8", ".6"), c("8", "8", ".6"), c("12.5", "8", ".6")]
    "wrap" => [p("M2 4h12"), p("M2 8h9.5a2 2 0 0 1 0 4H8"), p("M9.5 10.5 8 12l1.5 1.5"), p("M2 12h3")]
    "file-code" => [p("M3.5 1.5h5.5l3.5 3.5v9.5h-9z"), p("M6.5 8 5 9.5 6.5 11"), p("M9.5 8 11 9.5 9.5 11")]
    _ => [c("8", "8", "6")]
  }
}

///|
fn icon(name : String) -> DomNode {
  icon_c(name, "ic")
}

///|
fn icon_c(name : String, klass : String) -> DomNode {
  svg_el(
    "svg",
    [
      a_("viewBox", "0 0 16 16"),
      a_("width", "16"),
      a_("height", "16"),
      a_("fill", "none"),
      a_("stroke", "currentColor"),
      a_("stroke-width", "1.5"),
      a_("stroke-linecap", "round"),
      a_("stroke-linejoin", "round"),
      a_("aria-hidden", "true"),
      a_("focusable", "false"),
      cls(klass),
    ],
    icon_paths(name),
  )
}

///|
/// The Forgeyard mark: an anvil under a spark, in a rounded square.
fn logo_mark() -> DomNode {
  svg_el(
    "svg",
    [
      a_("viewBox", "0 0 32 32"),
      a_("width", "32"),
      a_("height", "32"),
      a_("aria-hidden", "true"),
      a_("focusable", "false"),
      cls("logo-mark"),
    ],
    [
      svg_el(
        "rect",
        [
          a_("x", "1"),
          a_("y", "1"),
          a_("width", "30"),
          a_("height", "30"),
          a_("rx", "8"),
          a_("fill", "#f97316"),
        ],
        [],
      ),
      svg_el(
        "path",
        [
          a_("d", "M7 15h15c0 2.5-2 4-4.5 4H17l1.5 4.5h3V25H10.5v-1.5h3L15 19h-3c-2.8 0-5-1.6-5-4z"),
          a_("fill", "#ffffff"),
        ],
        [],
      ),
      svg_el(
        "path",
        [
          a_("d", "M21 5l1.2 3.3L25.5 9.5l-3.3 1.2L21 14l-1.2-3.3L16.5 9.5l3.3-1.2z"),
          a_("fill", "#ffffff"),
        ],
        [],
      ),
    ],
  )
}

///|
let avatar_colors : Array[String] = [
  "#1a5fb4", "#9a3412", "#166534", "#6d28d9", "#9d174d", "#0f766e", "#854d0e",
  "#374151",
]

///|
fn avatar(name : String, size : Int) -> DomNode {
  let mut h = 0
  for ch in name {
    h = (h * 31 + ch.to_int()) % 9973
  }
  let parts : Array[String] = name.split("-").map(fn(s) { s.to_owned() }).to_array()
  let initials = parts
    .map(fn(s) {
      match s.get_char(0) {
        Some(ch) => ch.to_string().to_upper()
        None => ""
      }
    })
    .join("")
  let ini = if initials.length() > 2 {
    initials.substring(end=2)
  } else {
    initials
  }
  el(
    "span",
    [
      cls("avatar"),
      a_("aria-hidden", "true"),
      a_(
        "style",
        "background:\{avatar_colors[h % avatar_colors.length()]};width:\{size}px;height:\{size}px;font-size:\{size * 2 / 5 + 1}px",
      ),
    ],
    [t(ini)],
  )
}
