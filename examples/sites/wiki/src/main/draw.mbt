// Drawn imagery: every picture on the page is inline SVG built here.

///|
fn sv(
  tag : String,
  attrs : Array[(String, @element.AttrValue)],
  children : Array[@element.DomNode],
) -> @element.DomNode {
  // luna applies "class" through the className property, which is read-only on SVG elements
  // (an SVGAnimatedString), so the class is set as an attribute from the element ref instead.
  let kept : Array[(String, @element.AttrValue)] = []
  for x in attrs {
    match x {
      ("class", @element.AttrValue::Static(c)) =>
        kept.push(("__ref", @element.AttrValue::Handler(fn(el) { set_attr(el, "class", c) })))
      _ => kept.push(x)
    }
  }
  @element.create_element_ns(@element.svg_ns, tag, kept, children)
}

///|
fn a(name : String, value : String) -> (String, @element.AttrValue) {
  (name, @element.AttrValue::Static(value))
}

///|
fn circle(cx : String, cy : String, r : String, fill : String) -> @element.DomNode {
  sv("circle", [a("cx", cx), a("cy", cy), a("r", r), a("fill", fill)], [])
}

///|
fn ellipse(
  cx : String,
  cy : String,
  rx : String,
  ry : String,
  fill : String,
) -> @element.DomNode {
  let attrs = [a("cx", cx), a("cy", cy), a("rx", rx), a("ry", ry)]
  if fill != "" {
    attrs.push(a("fill", fill))
  }
  sv("ellipse", attrs, [])
}

///|
fn path(d : String, fill : String) -> @element.DomNode {
  if fill == "" {
    sv("path", [a("d", d)], [])
  } else {
    sv("path", [a("d", d), a("fill", fill)], [])
  }
}

///|
fn svg_root(
  view_box : String,
  label : String,
  cls : String,
  children : Array[@element.DomNode],
) -> @element.DomNode {
  let attrs = [a("viewBox", view_box), a("class", cls), a("focusable", "false")]
  if label == "" {
    attrs.push(a("aria-hidden", "true"))
  } else {
    attrs.push(a("role", "img"))
    attrs.push(a("aria-label", label))
  }
  sv("svg", attrs, children)
}

///|
/// The full Moon: grey disc, darker maria in the upper half, craters and rays below.
fn moon_art(idp : String, label : String, cls : String) -> @element.DomNode {
  let gid = idp + "-moon-shade"
  svg_root("0 0 200 200", label, cls, [
    sv("defs", [], [
      sv("radialGradient", [a("id", gid), a("cx", "42%"), a("cy", "38%"), a("r", "65%")], [
        sv("stop", [a("offset", "0%"), a("stop-color", "#f1efe9")], []),
        sv("stop", [a("offset", "70%"), a("stop-color", "#c9c5bb")], []),
        sv("stop", [a("offset", "100%"), a("stop-color", "#8f8a80")], []),
      ]),
    ]),
    sv("rect", [a("width", "200"), a("height", "200"), a("fill", "#0b0d12")], []),
    circle("100", "100", "86", "url(#" + gid + ")"),
    sv("g", [a("fill", "#6f6a61"), a("opacity", "0.5")], [
      path("M48,66 C52,50 74,44 88,52 C98,58 92,72 80,76 C70,80 64,92 54,90 C44,88 44,76 48,66 Z", ""),
      path("M92,46 C104,38 124,42 128,54 C131,64 120,70 110,68 C100,66 90,58 92,46 Z", ""),
      path("M114,72 C126,68 142,76 140,92 C138,106 126,112 118,104 C110,96 104,78 114,72 Z", ""),
      path("M78,90 C88,86 102,90 102,100 C102,110 88,112 80,106 C74,102 72,94 78,90 Z", ""),
      path("M50,98 C56,96 62,104 60,114 C58,122 50,124 46,116 C43,108 45,100 50,98 Z", ""),
    ]),
    sv("g", [a("fill", "#5f5a52"), a("opacity", "0.35")], [
      ellipse("70", "66", "12", "8", ""),
      ellipse("112", "54", "9", "6", ""),
      ellipse("126", "90", "8", "10", ""),
    ]),
    circle("118", "148", "6", "#efece5"),
    sv("g", [a("stroke", "#ece9e2"), a("stroke-width", "1"), a("opacity", "0.55")], [
      sv("line", [a("x1", "118"), a("y1", "148"), a("x2", "92"), a("y2", "124")], []),
      sv("line", [a("x1", "118"), a("y1", "148"), a("x2", "150"), a("y2", "130")], []),
      sv("line", [a("x1", "118"), a("y1", "148"), a("x2", "106"), a("y2", "176")], []),
      sv("line", [a("x1", "118"), a("y1", "148"), a("x2", "144"), a("y2", "168")], []),
    ]),
    circle("80", "150", "5", "#b3aea4"),
    circle("150", "112", "4", "#b3aea4"),
    circle("66", "132", "3", "#b8b3a9"),
    circle("100", "128", "3", "#b8b3a9"),
  ])
}

///|
/// One disc of the phases strip. `k` is 0..7 in eighths of a lunation.
fn phase_disc(cx : Int, k : Int) -> @element.DomNode {
  let r = 22
  let x = cx.to_string()
  let top = "\{cx},\{40 - r}"
  let bottom = "\{cx},\{40 + r}"
  let dark = circle(x, "40", r.to_string(), "#2a2d35")
  let rim = sv(
    "circle",
    [
      a("cx", x),
      a("cy", "40"),
      a("r", r.to_string()),
      a("fill", "none"),
      a("stroke", "#5d6270"),
      a("stroke-width", "1"),
    ],
    [],
  )
  if k == 0 {
    return sv("g", [], [dark, rim])
  }
  if k == 4 {
    return sv("g", [], [circle(x, "40", r.to_string(), "#e8e4da"), rim])
  }
  // terminator half-width: r * |cos(2πk/8)|
  let tx = if k == 2 || k == 6 { 0 } else { 16 }
  let waxing = k < 4
  let crescent = k == 1 || k == 7
  let outer_sweep = if waxing { 1 } else { 0 }
  let term_sweep = if waxing {
    if crescent {
      0
    } else {
      1
    }
  } else if crescent {
    1
  } else {
    0
  }
  let d = "M\{top} A\{r},\{r} 0 0 \{outer_sweep} \{bottom} A\{tx},\{r} 0 0 \{term_sweep} \{top} Z"
  sv("g", [], [dark, path(d, "#e8e4da"), rim])
}

///|
fn phases_art(label : String, cls : String) -> @element.DomNode {
  let discs = [sv("rect", [a("width", "440"), a("height", "80"), a("fill", "#0b0d12")], [])]
  for k = 0; k < 8; k = k + 1 {
    discs.push(phase_disc(30 + k * 54, k))
  }
  svg_root("0 0 440 80", label, cls, discs)
}

///|
fn earthrise_art(idp : String, label : String, cls : String) -> @element.DomNode {
  let gid = idp + "-earth"
  let sid = idp + "-ground"
  svg_root("0 0 320 220", label, cls, [
    sv("defs", [], [
      sv("linearGradient", [a("id", gid), a("x1", "0"), a("y1", "0"), a("x2", "1"), a("y2", "0")], [
        sv("stop", [a("offset", "0%"), a("stop-color", "#2f6fb5")], []),
        sv("stop", [a("offset", "100%"), a("stop-color", "#79b3e8")], []),
      ]),
      sv("linearGradient", [a("id", sid), a("x1", "0"), a("y1", "0"), a("x2", "0"), a("y2", "1")], [
        sv("stop", [a("offset", "0%"), a("stop-color", "#a29d93")], []),
        sv("stop", [a("offset", "100%"), a("stop-color", "#5e5a53")], []),
      ]),
    ]),
    sv("rect", [a("width", "320"), a("height", "220"), a("fill", "#05070b")], []),
    circle("40", "30", "1.2", "#cfd6e6"),
    circle("270", "24", "1", "#cfd6e6"),
    circle("230", "60", "0.8", "#cfd6e6"),
    circle("70", "90", "0.8", "#cfd6e6"),
    circle("290", "110", "1.1", "#cfd6e6"),
    circle("20", "130", "0.9", "#cfd6e6"),
    // Earth, lit from the right
    circle("160", "86", "40", "#10213a"),
    path("M160,46 A40,40 0 0 1 160,126 A14,40 0 0 1 160,46 Z", "url(#" + gid + ")"),
    ellipse("176", "72", "10", "5", "#f4f7fb"),
    ellipse("184", "98", "8", "4", "#f4f7fb"),
    ellipse("168", "88", "6", "8", "#6f9a56"),
    // lunar horizon
    path("M0,170 Q160,140 320,168 L320,220 L0,220 Z", "url(#" + sid + ")"),
    ellipse("70", "186", "22", "5", "#77736b"),
    ellipse("220", "196", "30", "6", "#6e6a63"),
    ellipse("140", "176", "12", "3", "#8a857c"),
  ])
}

///|
/// The picture for figure `i` (see `figures`).
fn figure_art(i : Int, idp : String, cls : String) -> @element.DomNode {
  let f = figures[i]
  match f.kind {
    "phases" => phases_art(f.alt, cls)
    "earthrise" => earthrise_art(idp, f.alt, cls)
    _ => moon_art(idp, f.alt, cls)
  }
}

///|
/// Small square drawing for a page preview, a search result or a stub.
fn thumb_art(kind : String, idp : String) -> @element.DomNode {
  let bg = sv("rect", [a("width", "80"), a("height", "80"), a("rx", "4"), a("fill", "#141821")], [])
  let body : Array[@element.DomNode] = match kind {
    "moon" | "farside" => {
      let dots = [circle("40", "40", "26", "#d9d5cb")]
      if kind == "moon" {
        dots.push(ellipse("33", "33", "8", "6", "#9d988e"))
        dots.push(ellipse("47", "38", "6", "8", "#9d988e"))
        dots.push(circle("44", "54", "3", "#f1eee7"))
      } else {
        dots.push(circle("30", "30", "4", "#aaa59b"))
        dots.push(circle("50", "34", "5", "#aaa59b"))
        dots.push(circle("38", "52", "6", "#aaa59b"))
        dots.push(circle("54", "52", "3", "#aaa59b"))
      }
      dots
    }
    "earth" =>
      [
        circle("40", "40", "26", "#2f6fb5"),
        ellipse("34", "34", "9", "7", "#6f9a56"),
        ellipse("50", "50", "7", "5", "#6f9a56"),
        ellipse("44", "26", "10", "3", "#f4f7fb"),
      ]
    "sun" =>
      [
        circle("40", "40", "30", "#5a3a12"),
        circle("40", "40", "22", "#f2b33d"),
        circle("40", "40", "15", "#ffd77a"),
      ]
    "orbit" =>
      [
        sv("ellipse", [a("cx", "40"), a("cy", "40"), a("rx", "30"), a("ry", "18"), a("fill", "none"), a("stroke", "#8fa3c7"), a("stroke-width", "1.5"), a("stroke-dasharray", "3 3")], []),
        circle("40", "40", "9", "#2f6fb5"),
        circle("70", "40", "4", "#d9d5cb"),
      ]
    "wave" =>
      [
        path("M0,46 Q10,36 20,46 T40,46 T60,46 T80,46 L80,80 L0,80 Z", "#2f6fb5"),
        path("M0,56 Q10,48 20,56 T40,56 T60,56 T80,56 L80,80 L0,80 Z", "#1f4f86"),
        circle("60", "20", "7", "#d9d5cb"),
      ]
    "phase" =>
      [circle("40", "40", "24", "#2a2d35"), path("M40,16 A24,24 0 0 1 40,64 A12,24 0 0 0 40,16 Z", "#e8e4da")]
    "eclipse" =>
      [circle("40", "40", "26", "#f2b33d"), circle("40", "40", "21", "#ffe9b0"), circle("40", "40", "20", "#05070b")]
    "blood" =>
      [circle("40", "40", "24", "#8c3a22"), ellipse("34", "34", "7", "5", "#6e2a18"), circle("46", "50", "4", "#a24a30")]
    "crater" | "impact" => {
      let parts = [
        path("M0,52 L80,52 L80,80 L0,80 Z", "#6e6a63"),
        ellipse("40", "54", "26", "8", "#3e3b36"),
        ellipse("40", "52", "22", "5", "#55514b"),
      ]
      if kind == "impact" {
        parts.push(circle("58", "20", "8", "#c26a3a"))
        parts.push(path("M52,26 L44,40 L48,40 Z", "#f2b33d"))
      }
      parts
    }
    "mare" =>
      [circle("40", "40", "26", "#cfcac0"), ellipse("36", "34", "14", "10", "#7f7a71"), ellipse("50", "46", "8", "7", "#837e75")]
    "rock" =>
      [
        path("M14,60 L24,36 L44,28 L62,38 L68,60 Z", "#8a857c"),
        path("M24,36 L44,28 L40,46 Z", "#a29d93"),
        path("M40,46 L62,38 L68,60 Z", "#6e6a63"),
      ]
    "calendar" =>
      [
        sv("rect", [a("x", "16"), a("y", "18"), a("width", "48"), a("height", "46"), a("rx", "3"), a("fill", "#e8e4da")], []),
        sv("rect", [a("x", "16"), a("y", "18"), a("width", "48"), a("height", "10"), a("rx", "3"), a("fill", "#3a66b0")], []),
        circle("30", "42", "5", "#2a2d35"),
        circle("50", "42", "5", "#2a2d35"),
        path("M50,37 A5,5 0 0 1 50,47 Z", "#e8e4da"),
      ]
    "map" =>
      [
        sv("rect", [a("x", "14"), a("y", "16"), a("width", "52"), a("height", "48"), a("fill", "#cfcac0")], []),
        ellipse("32", "34", "10", "7", "#8d887e"),
        ellipse("50", "48", "8", "6", "#8d887e"),
        sv("path", [a("d", "M14,40 L66,40 M40,16 L40,64"), a("stroke", "#5d6270"), a("stroke-width", "0.8"), a("fill", "none")], []),
      ]
    "layers" =>
      [circle("40", "40", "28", "#a29d93"), circle("40", "40", "20", "#c26a3a"), circle("40", "40", "9", "#f2b33d")]
    "ice" =>
      [
        path("M0,50 L80,50 L80,80 L0,80 Z", "#6e6a63"),
        ellipse("40", "54", "24", "7", "#2a2d35"),
        ellipse("40", "55", "14", "3", "#bfe3f5"),
      ]
    "telescope" =>
      [
        sv("path", [a("d", "M18,48 L58,24 L62,32 L22,56 Z"), a("fill", "#8fa3c7")], []),
        sv("path", [a("d", "M38,44 L30,66 M38,44 L48,66"), a("stroke", "#8fa3c7"), a("stroke-width", "2.5"), a("fill", "none")], []),
        circle("66", "16", "5", "#d9d5cb"),
      ]
    "probe" =>
      [
        sv("rect", [a("x", "32"), a("y", "32"), a("width", "16"), a("height", "16"), a("fill", "#c9a24a")], []),
        sv("rect", [a("x", "8"), a("y", "36"), a("width", "22"), a("height", "8"), a("fill", "#3a66b0")], []),
        sv("rect", [a("x", "50"), a("y", "36"), a("width", "22"), a("height", "8"), a("fill", "#3a66b0")], []),
        sv("path", [a("d", "M40,32 L40,20"), a("stroke", "#d9d5cb"), a("stroke-width", "1.5")], []),
      ]
    _ => [circle("40", "40", "26", "#d9d5cb")]
  }
  let _ = idp
  let children = [bg]
  for n in body {
    children.push(n)
  }
  svg_root("0 0 80 80", "", "thumb-art", children)
}
