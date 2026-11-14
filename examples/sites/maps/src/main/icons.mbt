// Icons and the small pictures (place photos, layer thumbnails), all inline SVG.

///|
fn sa(k : String, v : String) -> (String, @element.Attr) {
  (k, @element.AttrString(v))
}

///|
fn da(k : String, f : () -> String) -> (String, @element.AttrValue) {
  (k, @element.attr_dynamic(f))
}

///|
let ic_search = "M10.5 4a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13M15.3 15.3L20 20"

///|
let ic_close = "M6 6l12 12M18 6L6 18"

///|
let ic_back = "M19 12H5M11 6l-6 6 6 6"

///|
let ic_chev_left = "M14.5 6l-6 6 6 6"

///|
let ic_chev_right = "M9.5 6l6 6-6 6"

///|
let ic_plus = "M12 5v14M5 12h14"

///|
let ic_minus = "M5 12h14"

///|
let ic_swap = "M7 4v16M3.5 7.5L7 4l3.5 3.5M17 20V4M13.5 16.5L17 20l3.5-3.5"

///|
let ic_bookmark = "M7 3.5h10v17l-5-3.6-5 3.6Z"

///|
let ic_share = "M8.6 13.3l6.8 3.9M15.4 6.8l-6.8 3.9M18 3.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5M6 9.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5M18 15.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5"

///|
let ic_phone = "M8 2.5h8a1.5 1.5 0 0 1 1.5 1.5v16a1.5 1.5 0 0 1-1.5 1.5H8A1.5 1.5 0 0 1 6.5 20V4A1.5 1.5 0 0 1 8 2.5ZM11 18h2"

///|
let ic_nearby = "M12 3v3M12 18v3M3 12h3M18 12h3M12 7a5 5 0 1 0 0 10a5 5 0 1 0 0-10M12 11a1 1 0 1 0 0 2a1 1 0 1 0 0-2"

///|
let ic_turn = "M8 15v-3.5a2 2 0 0 1 2-2h6M13 6.5l3 3-3 3"

///|
let ic_pin = "M12 21s-6.5-6.1-6.5-11a6.5 6.5 0 0 1 13 0c0 4.9-6.5 11-6.5 11ZM12 7.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5"

///|
let ic_clock = "M12 3.5a8.5 8.5 0 1 0 0 17a8.5 8.5 0 1 0 0-17M12 7.5V12l3 2"

///|
let ic_globe = "M12 3.5a8.5 8.5 0 1 0 0 17a8.5 8.5 0 1 0 0-17M3.5 12h17M12 3.5c2.5 2.4 3.5 5.3 3.5 8.5s-1 6.1-3.5 8.5c-2.5-2.4-3.5-5.3-3.5-8.5s1-6.1 3.5-8.5"

///|
let ic_sort = "M4 7h16M7 12h10M10 17h4"

///|
let ic_check = "M5 12.5l4.5 4.5L19 7.5"

///|
let ic_star = "M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8Z"

///|
let ic_saved = "M7 3.5h10v17l-5-3.6-5 3.6Z"

///|
/// Category glyphs, drawn on a 24 grid with a stroke.
let cat_icons : Array[String] = [
  "M8 3v7M5.5 3v4.5a2.5 2.5 0 0 0 5 0V3M8 10v11M16.5 3c-2 1.5-2.5 5-2.5 8h2.5v10",
  "M5 9h11v4.5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5ZM16 10.5h1.5a2.5 2.5 0 0 1 0 5H16M8 3.5v2M11 3.5v2",
  "M3 19V6M3 15h18v4M21 15v-3a3 3 0 0 0-3-3h-7v6M7 9.5a1.8 1.8 0 1 0 0 3.6a1.8 1.8 0 1 0 0-3.6",
  "M3 9.5L12 4l9 5.5M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18",
  "M12 3l5.5 7.5H14l4.5 6h-13L10 10.5H6.5ZM12 16.5V21",
  "M7.5 3.5h9a2 2 0 0 1 2 2V14a3 3 0 0 1-3 3h-7a3 3 0 0 1-3-3V5.5a2 2 0 0 1 2-2ZM5.5 10h13M8.5 20.5l2-3.5M15.5 20.5l-2-3.5",
]

///|
fn icon(d : String, size? : Int = 20, sw? : String = "2") -> @element.DomNode {
  @element.svg(
    width=size.to_string(),
    height=size.to_string(),
    viewBox="0 0 24 24",
    fill="none",
    stroke="currentColor",
    attrs=[sa("aria-hidden", "true"), sa("focusable", "false")],
  ) <| [
    @element.svg_path(d~, stroke_width=sw, stroke_linecap="round", stroke_linejoin="round"),
  ]
}

///|
fn filled_icon(d : String, size? : Int = 20) -> @element.DomNode {
  @element.svg(
    width=size.to_string(),
    height=size.to_string(),
    viewBox="0 0 24 24",
    fill="currentColor",
    attrs=[sa("aria-hidden", "true"), sa("focusable", "false")],
  ) <| [@element.svg_path(d~)]
}

///|
/// The directions glyph: a diamond with a turn arrow.
fn directions_icon(size : Int) -> @element.DomNode {
  @element.svg(
    width=size.to_string(),
    height=size.to_string(),
    viewBox="0 0 24 24",
    attrs=[sa("aria-hidden", "true"), sa("focusable", "false")],
  ) <| [
    @element.svg_rect(
      x="4.6",
      y="4.6",
      width="14.8",
      height="14.8",
      rx="2.5",
      fill="currentColor",
      attrs=[sa("transform", "rotate(45 12 12)")],
    ),
    @element.svg_path(
      d=ic_turn,
      fill="none",
      stroke="#fff",
      stroke_width="1.9",
      stroke_linecap="round",
      stroke_linejoin="round",
    ),
  ]
}

///|
/// A map pin: a teardrop in the category's colour with the glyph inside.
fn pin_svg(cat : Int) -> @element.DomNode {
  @element.svg(
    width="30",
    height="38",
    viewBox="0 0 30 38",
    attrs=[sa("aria-hidden", "true"), sa("focusable", "false"), sa("data-k", "pin")],
  ) <| [
    @element.svg_path(
      d="M15 37s-12.5-12.1-12.5-22a12.5 12.5 0 0 1 25 0c0 9.9-12.5 22-12.5 22Z",
      fill=cat_colors[cat],
      stroke="#fff",
      stroke_width="2",
      attrs=[sa("data-k", "pin-body")],
    ),
    @element.svg_g(transform="translate(7.6 7.4) scale(0.62)") <| [
      @element.svg_path(
        d=cat_icons[cat],
        fill="none",
        stroke="#fff",
        stroke_width="2.4",
        stroke_linecap="round",
        stroke_linejoin="round",
      ),
    ],
  ]
}

///|
/// A seeded picture for a place: sky, ground and a building or scene by category.
fn place_art(p : Place, w : Int, h : Int, label : Bool) -> @element.DomNode {
  let rnd = seeded(p.id * 31 + 7)
  let skies = ["#cfe3f5", "#f6dcc4", "#dfe8d6", "#e7dcf2", "#f3e6c2", "#d7e9ef"]
  let sky = skies[(p.id + rnd() % 3) % skies.length()]
  let col = cat_colors[p.cat]
  let wd = w.to_double()
  let hd = h.to_double()
  let kids : Array[@element.DomNode] = [
    @element.svg_rect(x="0", y="0", width=w.to_string(), height=h.to_string(), fill=sky),
    @element.svg_circle(
      cx=fmt1(wd * (0.58 + (rnd() % 30).to_double() / 100.0)),
      cy=fmt1(hd * 0.26),
      r=fmt1(hd * 0.1),
      fill="#fff8e0",
      attrs=[sa("opacity", "0.9")],
    ),
  ]
  let ground_y = hd * 0.72
  match p.cat {
    4 => {
      // park: hills and trees
      kids.push(
        @element.svg_path(
          d="M0 \{fmt1(ground_y)} Q \{fmt1(wd * 0.3)} \{fmt1(hd * 0.5)} \{fmt1(wd * 0.6)} \{fmt1(ground_y - hd * 0.05)} T \{wd} \{fmt1(ground_y - hd * 0.1)} V \{hd} H 0 Z",
          fill="#9fcf8f",
        ),
      )
      for i = 0; i < 4; i = i + 1 {
        let tx = wd * (0.12 + i.to_double() * 0.24) + (rnd() % 10).to_double()
        let th = hd * (0.22 + (rnd() % 10).to_double() / 100.0)
        kids.push(
          @element.svg_rect(
            x=fmt1(tx - 2.0),
            y=fmt1(ground_y - th * 0.3),
            width="4",
            height=fmt1(th * 0.4),
            fill="#6b4f33",
          ),
        )
        kids.push(
          @element.svg_circle(
            cx=fmt1(tx),
            cy=fmt1(ground_y - th * 0.55),
            r=fmt1(th * 0.42),
            fill=if i % 2 == 0 { "#2f7d43" } else { "#3f9455" },
          ),
        )
      }
    }
    5 => {
      // a station hall with a train
      kids.push(
        @element.svg_rect(x="0", y=fmt1(ground_y), width=w.to_string(), height=fmt1(hd - ground_y), fill="#c9cdd2"),
      )
      kids.push(
        @element.svg_path(
          d="M\{fmt1(wd * 0.1)} \{fmt1(ground_y)} V \{fmt1(hd * 0.42)} Q \{fmt1(wd * 0.5)} \{fmt1(hd * 0.1)} \{fmt1(wd * 0.9)} \{fmt1(hd * 0.42)} V \{fmt1(ground_y)} Z",
          fill="#e9ecef",
          stroke="#8b939c",
          stroke_width="2",
        ),
      )
      kids.push(
        @element.svg_rect(
          x=fmt1(wd * 0.18),
          y=fmt1(ground_y - hd * 0.2),
          width=fmt1(wd * 0.64),
          height=fmt1(hd * 0.2),
          rx="6",
          fill=col,
        ),
      )
      for i = 0; i < 5; i = i + 1 {
        kids.push(
          @element.svg_rect(
            x=fmt1(wd * (0.22 + i.to_double() * 0.12)),
            y=fmt1(ground_y - hd * 0.16),
            width=fmt1(wd * 0.08),
            height=fmt1(hd * 0.07),
            rx="2",
            fill="#dbe8f7",
          ),
        )
      }
    }
    _ => {
      // a street front: neighbours and the place in its colour
      kids.push(
        @element.svg_rect(x="0", y=fmt1(ground_y), width=w.to_string(), height=fmt1(hd - ground_y), fill="#d8d2c8"),
      )
      let nb = ["#e4d6c3", "#cfd8dc", "#e8cfc4", "#d9d3e6"]
      kids.push(
        @element.svg_rect(
          x="0",
          y=fmt1(hd * 0.3),
          width=fmt1(wd * 0.26),
          height=fmt1(ground_y - hd * 0.3),
          fill=nb[rnd() % 4],
        ),
      )
      kids.push(
        @element.svg_rect(
          x=fmt1(wd * 0.74),
          y=fmt1(hd * 0.22),
          width=fmt1(wd * 0.26),
          height=fmt1(ground_y - hd * 0.22),
          fill=nb[rnd() % 4],
        ),
      )
      let fronts = ["#f4efe6", "#ead9c4", "#dde6ea", "#f0ddd2", "#e2e8d8", "#ece2f0", "#f6e7c8"]
      let front = fronts[rnd() % fronts.length()]
      let bx = wd * (0.2 + (rnd() % 12).to_double() / 100.0)
      let bw = wd * (0.46 + (rnd() % 14).to_double() / 100.0)
      let top = if p.cat == 2 {
        hd * (0.06 + (rnd() % 8).to_double() / 100.0)
      } else {
        hd * (0.22 + (rnd() % 18).to_double() / 100.0)
      }
      kids.push(
        @element.svg_rect(x=fmt1(bx), y=fmt1(top), width=fmt1(bw), height=fmt1(ground_y - top), fill=front),
      )
      // a tree or a lamp post beside it
      if rnd() % 2 == 0 {
        let tx = if rnd() % 2 == 0 { wd * 0.1 } else { wd * 0.9 }
        kids.push(@element.svg_rect(x=fmt1(tx - 1.5), y=fmt1(ground_y - hd * 0.16), width="3", height=fmt1(hd * 0.16), fill="#6b4f33"))
        kids.push(@element.svg_circle(cx=fmt1(tx), cy=fmt1(ground_y - hd * 0.2), r=fmt1(hd * 0.1), fill="#4c9a5e"))
      } else {
        let lx = if rnd() % 2 == 0 { bx - wd * 0.04 } else { bx + bw + wd * 0.04 }
        kids.push(@element.svg_rect(x=fmt1(lx - 1.0), y=fmt1(ground_y - hd * 0.3), width="2", height=fmt1(hd * 0.3), fill="#4a4f55"))
        kids.push(@element.svg_circle(cx=fmt1(lx), cy=fmt1(ground_y - hd * 0.3), r="3", fill="#ffd769"))
      }
      if p.cat == 3 {
        // a pediment and columns
        kids.push(
          @element.svg_path(
            d="M\{fmt1(bx - 4.0)} \{fmt1(top)} L \{fmt1(bx + bw / 2.0)} \{fmt1(top - hd * 0.14)} L \{fmt1(bx + bw + 4.0)} \{fmt1(top)} Z",
            fill=col,
          ),
        )
        for i = 0; i < 5; i = i + 1 {
          kids.push(
            @element.svg_rect(
              x=fmt1(bx + bw * (0.08 + i.to_double() * 0.2)),
              y=fmt1(top + hd * 0.04),
              width=fmt1(bw * 0.07),
              height=fmt1(ground_y - top - hd * 0.04),
              fill="#d9d0c1",
            ),
          )
        }
      } else {
        // windows and an awning
        let rows = if p.cat == 2 { 4 } else { 1 + rnd() % 2 }
        let cols = 2 + rnd() % 3
        for r = 0; r < rows; r = r + 1 {
          for c = 0; c < cols; c = c + 1 {
            kids.push(
              @element.svg_rect(
                x=fmt1(bx + bw * (0.1 + c.to_double() * 0.82 / cols.to_double())),
                y=fmt1(top + hd * (0.05 + r.to_double() * 0.12)),
                width=fmt1(bw * 0.5 / cols.to_double()),
                height=fmt1(hd * 0.07),
                rx="1.5",
                fill="#b9cfe0",
              ),
            )
          }
        }
        kids.push(
          @element.svg_rect(
            x=fmt1(bx - 3.0),
            y=fmt1(ground_y - hd * 0.26),
            width=fmt1(bw + 6.0),
            height=fmt1(hd * 0.07),
            fill=col,
          ),
        )
        kids.push(
          @element.svg_rect(
            x=fmt1(bx + bw * (0.2 + (rnd() % 50).to_double() / 100.0)),
            y=fmt1(ground_y - hd * 0.17),
            width=fmt1(wd * 0.12),
            height=fmt1(hd * 0.17),
            fill="#6d5a48",
          ),
        )
      }
    }
  }
  let attrs = if label {
    [sa("role", "img"), sa("aria-label", "Illustration of \{p.name}")]
  } else {
    [sa("aria-hidden", "true"), sa("focusable", "false")]
  }
  @element.svg(
    width=w.to_string(),
    height=h.to_string(),
    viewBox="0 0 \{w} \{h}",
    attrs=[..attrs, sa("preserveAspectRatio", "xMidYMid slice")],
  ) <| kids
}
