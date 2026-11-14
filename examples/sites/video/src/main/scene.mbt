// The picture a video "shows": a gradient, a few shapes and a big glyph, seeded
// from the video's id. A thumbnail draws it at a fixed instant; the player
// draws the same scene at its current time.

///|
struct Rng {
  mut state : Double
}

///|
/// Park–Miller: every product stays below 2^53, so it is exact in a Double.
fn Rng::next(self : Rng) -> Double {
  self.state = self.state * 16807.0 % 2147483647.0
  self.state / 2147483647.0
}

///|
fn n1(d : Double) -> String {
  let r = @math.round(d * 10.0) / 10.0
  r.to_string()
}

///|
fn hue_a(v : Video) -> Int {
  let base = match v.topic {
    Space => 236
    Cooking => 20
    Music => 292
    Travel => 196
  }
  base + v.seed % 37 - 18
}

///|
fn scene_background(v : Video) -> String {
  let h = hue_a(v)
  match v.topic {
    Space => "background: linear-gradient(160deg, hsl(\{h} 55% 12%), hsl(\{h + 30} 50% 30%))"
    Cooking => "background: linear-gradient(160deg, hsl(\{h + 20} 80% 62%), hsl(\{h} 70% 38%))"
    Music => "background: linear-gradient(160deg, hsl(\{h} 60% 22%), hsl(\{h - 40} 70% 46%))"
    Travel => "background: linear-gradient(180deg, hsl(\{h} 70% 66%), hsl(\{h + 150} 75% 70%))"
  }
}

///|
fn glyph_of(v : Video) -> String {
  let options = match v.topic {
    Space => ["☾", "✦", "☄"]
    Cooking => ["♨", "☕\u{FE0E}", "♨"]
    Music => ["♪", "♫", "♬"]
    Travel => ["✈", "⚓\u{FE0E}", "☀"]
  }
  options[v.seed % options.length()]
}

///|
fn dyn(f : () -> String) -> @element.AttrValue {
  @element.attr_dynamic(f)
}

///|
fn stat(s : String) -> @element.Attr {
  @element.AttrString(s)
}

///|
fn space_layer(v : Video, rng : Rng, t : () -> Double) -> Array[@element.DomNode] {
  let out : Array[@element.DomNode] = []
  let stars = 14 + v.seed % 9
  for i = 0; i < stars; i = i + 1 {
    let x = rng.next() * 160.0
    let y = rng.next() * 86.0
    let r = 0.4 + rng.next() * 0.9
    let phase = rng.next() * 6.0
    let rate = 0.6 + rng.next() * 1.4
    ignore(i)
    out.push(
      @element.svg_circle(
        cx=n1(x),
        cy=n1(y),
        r=n1(r),
        fill="#fff",
        dyn_attrs=[
          ("opacity", dyn(fn() { n1(0.35 + 0.65 * @math.sin(t() * rate + phase).abs()) })),
        ],
      ),
    )
  }
  let left = v.seed % 2 == 0
  let px = if left { 40.0 + rng.next() * 30.0 } else { 96.0 + rng.next() * 34.0 }
  let py = 30.0 + rng.next() * 32.0
  let pr = 12.0 + rng.next() * 16.0
  let h2 = hue_a(v) + 120 + v.seed % 90
  let body : Array[@element.DomNode] = [
    @element.svg_circle(cx=n1(px), cy=n1(py), r=n1(pr), fill="hsl(\{h2} 32% 76%)"),
    @element.svg_circle(cx=n1(px - pr * 0.35), cy=n1(py - pr * 0.2), r=n1(pr * 0.22), fill="hsl(\{h2} 18% 60%)"),
    @element.svg_circle(cx=n1(px + pr * 0.3), cy=n1(py + pr * 0.35), r=n1(pr * 0.15), fill="hsl(\{h2} 18% 60%)"),
  ]
  if v.seed % 3 != 0 {
    body.push(
      @element.svg_ellipse(
        cx=n1(px),
        cy=n1(py),
        rx=n1(pr * 1.7),
        ry=n1(pr * 0.38),
        fill="none",
        stroke="hsl(\{h2 + 40} 70% 82% / 0.7)",
        stroke_width="1.4",
        attrs=[("transform", stat("rotate(\{-24 + v.seed % 30} \{n1(px)} \{n1(py)})"))],
      ),
    )
  } else {
    // A small moon on a slow orbit instead of a ring.
    body.push(
      @element.svg_circle(
        r=n1(pr * 0.22),
        fill="hsl(\{h2 + 60} 25% 88%)",
        dyn_attrs=[
          ("cx", dyn(fn() { n1(px + @math.cos(t() * 0.4) * pr * 1.6) })),
          ("cy", dyn(fn() { n1(py + @math.sin(t() * 0.4) * pr * 0.6) })),
        ],
      ),
    )
  }
  out.push(
    @element.svg_g(
      dyn_attrs=[
        (
          "transform",
          dyn(fn() { "translate(\{n1(@math.sin(t() * 0.08) * 10.0)} \{n1(@math.cos(t() * 0.06) * 3.0)})" }),
        ),
      ],
    ) <| body,
  )
  out
}

///|
fn cooking_layer(v : Video, rng : Rng, t : () -> Double) -> Array[@element.DomNode] {
  let h = hue_a(v)
  let kind = v.seed / 3 % 3
  let px = 50.0 + rng.next() * 50.0
  let dark = "hsl(\{h + 180} 20% 22%)"
  let out : Array[@element.DomNode] = [
    @element.svg_rect(x="0", y="66", width="160", height="24", fill="hsl(\{h} 45% 26%)"),
  ]
  let steam_y = match kind {
    0 => {
      // a pot with a lid
      out.push(@element.svg_rect(x=n1(px), y="44", width="48", height="24", rx="4", fill=dark))
      out.push(@element.svg_rect(x=n1(px - 6.0), y="48", width="6", height="4", rx="1", fill=dark))
      out.push(@element.svg_rect(x=n1(px + 48.0), y="48", width="6", height="4", rx="1", fill=dark))
      out.push(@element.svg_ellipse(cx=n1(px + 24.0), cy="44", rx="26", ry="4", fill="hsl(\{h + 180} 18% 34%)"))
      38.0
    }
    1 => {
      // a frying pan with a long handle
      out.push(@element.svg_ellipse(cx=n1(px + 20.0), cy="62", rx="28", ry="7", fill=dark))
      out.push(@element.svg_rect(x=n1(px + 46.0), y="58.5", width="34", height="4", rx="2", fill=dark))
      out.push(@element.svg_ellipse(cx=n1(px + 20.0), cy="60", rx="22", ry="4.5", fill="hsl(\{h + 30} 70% 70%)"))
      out.push(@element.svg_circle(cx=n1(px + 14.0), cy="59.5", r="3", fill="hsl(48 95% 70%)"))
      out.push(@element.svg_circle(cx=n1(px + 27.0), cy="60.5", r="3", fill="hsl(48 95% 70%)"))
      52.0
    }
    _ => {
      // a bowl
      out.push(@element.svg_path(d="M\{n1(px)} 48 h 50 a 25 20 0 0 1 -50 0 z", fill=dark))
      out.push(@element.svg_ellipse(cx=n1(px + 25.0), cy="48", rx="25", ry="3.5", fill="hsl(\{h + 10} 60% 74%)"))
      40.0
    }
  }
  for i = 0; i < 3; i = i + 1 {
    let sx = px + 10.0 + i.to_double() * 13.0
    let phase = i.to_double() * 4.0
    out.push(
      @element.svg_path(
        d="M\{n1(sx)} \{n1(steam_y)} q 4 -6 0 -12 q -4 -6 0 -12",
        fill="none",
        stroke="#fff",
        stroke_width="1.6",
        stroke_linecap="round",
        dyn_attrs=[
          ("transform", dyn(fn() { "translate(0 \{n1(-((t() * 3.0 + phase) % 12.0))})" })),
          ("opacity", dyn(fn() { n1(0.85 - (t() * 3.0 + phase) % 12.0 / 16.0) })),
        ],
      ),
    )
  }
  out
}

///|
fn music_layer(v : Video, rng : Rng, t : () -> Double) -> Array[@element.DomNode] {
  let h = hue_a(v)
  let disc_left = v.seed / 5 % 2 == 1
  let cx = if disc_left { 44.0 } else { 118.0 }
  let bars_x = if disc_left { 84.0 } else { 10.0 }
  let c = n1(cx)
  let out : Array[@element.DomNode] = [
    @element.svg_circle(cx=c, cy="44", r="30", fill="hsl(\{h} 30% 8%)"),
    @element.svg_circle(cx=c, cy="44", r="22", fill="none", stroke="hsl(\{h} 20% 24%)", stroke_width="0.8"),
    @element.svg_circle(cx=c, cy="44", r="15", fill="none", stroke="hsl(\{h} 20% 24%)", stroke_width="0.8"),
    @element.svg_g(dyn_attrs=[("transform", dyn(fn() { "rotate(\{n1(t() * 33.0 % 360.0)} \{c} 44)" }))]) <| [
      @element.svg_circle(cx=c, cy="44", r="8", fill="hsl(\{h + 60 + v.seed % 120} 80% 64%)"),
      @element.svg_circle(cx=n1(cx + 3.0), cy="40", r="1.6", fill="hsl(\{h} 30% 8%)"),
    ],
  ]
  let bar_count = 7 + v.seed % 3
  for i = 0; i < bar_count; i = i + 1 {
    let phase = rng.next() * 6.0
    let x = bars_x + i.to_double() * 8.0
    let height = fn() { 8.0 + 34.0 * @math.sin(t() * 2.2 + phase).abs() }
    out.push(
      @element.svg_rect(
        x=n1(x),
        width="5",
        rx="1.5",
        fill="hsl(\{h + 50 + i * 6} 85% 72%)",
        dyn_attrs=[("height", dyn(fn() { n1(height()) })), ("y", dyn(fn() { n1(82.0 - height()) }))],
      ),
    )
  }
  out
}

///|
fn ridge(offset : Double, base : Double, peaks : Array[Double]) -> String {
  let sb = StringBuilder::new()
  sb.write_string("\{n1(offset)},90 ")
  for i = 0; i < peaks.length(); i = i + 1 {
    let x = offset + i.to_double() * 160.0 / (peaks.length() - 1).to_double()
    sb.write_string("\{n1(x)},\{n1(base - peaks[i])} ")
  }
  sb.write_string("\{n1(offset + 160.0)},90")
  sb.to_string()
}

///|
fn waves(y : Int) -> String {
  let sb = StringBuilder::new()
  sb.write_string("M0 \{y} q5 -3 10 0")
  for i = 0; i < 18; i = i + 1 {
    ignore(i)
    sb.write_string(" t10 0")
  }
  sb.to_string()
}

///|
fn travel_layer(v : Video, rng : Rng, t : () -> Double) -> Array[@element.DomNode] {
  let h = hue_a(v)
  let sx = 20.0 + rng.next() * 120.0
  let sun = @element.svg_circle(
    cx=n1(sx),
    r=n1(8.0 + rng.next() * 6.0),
    fill="hsl(44 100% 90%)",
    dyn_attrs=[("cy", dyn(fn() { n1(28.0 - @math.sin(t() * 0.05) * 6.0) }))],
  )
  if v.seed % 2 == 0 {
    let far = [0.0, 10.0, 26.0, 8.0, 30.0, 14.0, 0.0].map(fn(p) { p + rng.next() * 14.0 })
    far[far.length() - 1] = far[0]
    let near = [0.0, 18.0, 6.0, 22.0, 4.0, 0.0].map(fn(p) { p + rng.next() * 10.0 })
    near[near.length() - 1] = near[0]
    [
      sun,
      @element.svg_g(dyn_attrs=[("transform", dyn(fn() { "translate(\{n1(-(t() * 4.0 % 160.0))} 0)" }))]) <| [
        @element.svg_polygon(points=ridge(0.0, 62.0, far), fill="hsl(\{h + 20} 30% 52%)"),
        @element.svg_polygon(points=ridge(159.5, 62.0, far), fill="hsl(\{h + 20} 30% 52%)"),
      ],
      @element.svg_g(dyn_attrs=[("transform", dyn(fn() { "translate(\{n1(-(t() * 12.0 % 160.0))} 0)" }))]) <| [
        @element.svg_polygon(points=ridge(0.0, 76.0, near), fill="hsl(\{h + 40} 35% 30%)"),
        @element.svg_polygon(points=ridge(159.5, 76.0, near), fill="hsl(\{h + 40} 35% 30%)"),
      ],
      @element.svg_rect(x="0", y="80", width="160", height="10", fill="hsl(\{h + 40} 30% 18%)"),
      @element.svg_rect(x="0", y="81.5", width="160", height="1", fill="hsl(44 60% 70%)"),
    ]
  } else {
    // The sea: a horizon, waves and a small boat that bobs.
    let bx = 30.0 + rng.next() * 80.0
    [
      sun,
      @element.svg_rect(x="0", y="56", width="160", height="34", fill="hsl(\{h + 10} 60% 38%)"),
      @element.svg_g(dyn_attrs=[("transform", dyn(fn() { "translate(\{n1(-(t() * 6.0 % 20.0))} 0)" }))]) <| [
        @element.svg_path(d=waves(66), fill="none", stroke="hsl(\{h + 10} 60% 66%)", stroke_width="1.2"),
        @element.svg_path(d=waves(77), fill="none", stroke="hsl(\{h + 10} 60% 58%)", stroke_width="1.2"),
      ],
      @element.svg_g(
        dyn_attrs=[("transform", dyn(fn() { "translate(\{n1(bx)} \{n1(52.0 + @math.sin(t() * 1.3) * 1.5)})" }))],
      ) <| [
        @element.svg_path(d="M0 6 h26 l-5 6 h-16 z", fill="hsl(\{h + 180} 30% 20%)"),
        @element.svg_path(d="M12 5 v-16 l10 14 z", fill="hsl(40 60% 94%)"),
      ],
    ]
  }
}

///|
/// A scene for `v` at the instant `t()` (seconds). `extra` is drawn on top.
fn scene(v : Video, t : () -> Double, class~ : String = "scene") -> @element.DomNode {
  let rng = { state: (v.seed % 2147483646 + 1).to_double() }
  ignore(rng.next())
  let layer = match v.topic {
    Space => space_layer(v, rng, t)
    Cooking => cooking_layer(v, rng, t)
    Music => music_layer(v, rng, t)
    Travel => travel_layer(v, rng, t)
  }
  // The big glyph is part of the picture, drawn by CSS from data-glyph, so it
  // is not a text node of the page.
  @element.div(class~, style=scene_background(v), attrs=[("aria-hidden", stat("true"))]) <| [
    @element.span(class="glyph", attrs=[("data-glyph", stat(glyph_of(v)))]) <| [],
    @element.svg(
      viewBox="0 0 160 90",
      attrs=[("preserveAspectRatio", stat("xMidYMid slice")), ("focusable", stat("false"))],
    ) <| layer,
  ]
}

///|
fn still(v : Video) -> () -> Double {
  let t = (v.seed % 97).to_double() + 3.0
  fn() { t }
}
