// The map: static geometry in world units under one transform, and labels,
// shields, pins and clusters placed in screen pixels on top.

///|
fn pt(x : Double, y : Double) -> String {
  "\{fmt1(x)} \{fmt1(y)}"
}

///|
fn poly_d(pts : Array[(Double, Double)], close : Bool) -> String {
  let sb = StringBuilder::new()
  for i, p in pts {
    sb.write_string(if i == 0 { "M" } else { "L" })
    sb.write_string(pt(p.0, p.1))
  }
  if close {
    sb.write_string("Z")
  }
  sb.to_string()
}

///|
fn grid_xs() -> Array[Double] {
  let xs : Array[Double] = []
  for s in streets {
    if s.vertical {
      xs.push(s.at)
    }
  }
  xs.sort()
  xs
}

///|
fn grid_ys() -> Array[Double] {
  let ys : Array[Double] = []
  for s in streets {
    if !s.vertical {
      ys.push(s.at)
    }
  }
  ys.sort()
  ys
}

///|
fn block_ok(x : Double, y : Double) -> Bool {
  if y > coast_y(x) - 26.0 {
    return false
  }
  if (river_x(y) - x).abs() < 58.0 {
    return false
  }
  if line_dist(x, y, rail_pts) < 26.0 {
    return false
  }
  if seg_dist(x, y, diag_a, diag_b) < 24.0 {
    return false
  }
  for pk in parks {
    if in_poly(x, y, pk.1) {
      return false
    }
  }
  true
}

///|
/// Building blocks between the streets, as one path.
fn blocks_d() -> String {
  let xs = grid_xs()
  let ys = grid_ys()
  let rnd = seeded(2026)
  let sb = StringBuilder::new()
  let inset = 14.0
  for i = 1; i < xs.length(); i = i + 1 {
    for j = 1; j < ys.length(); j = j + 1 {
      let x0 = xs[i - 1] + inset
      let x1 = xs[i] - inset
      let y0 = ys[j - 1] + inset
      let y1 = ys[j] - inset
      // wide cells are cut by alleys
      let cols = ((x1 - x0) / 150.0).ceil().to_int()
      let cw = (x1 - x0 - (cols - 1).to_double() * 10.0) / cols.to_double()
      for c = 0; c < cols; c = c + 1 {
        let bx0 = x0 + c.to_double() * (cw + 10.0)
        let bx1 = bx0 + cw
        let split = rnd() % 3
        let rows : Array[(Double, Double)] = if split == 0 {
          [(y0, y1)]
        } else {
          let m = y0 + (y1 - y0) * (0.4 + (rnd() % 20).to_double() / 100.0)
          [(y0, m - 4.0), (m + 4.0, y1)]
        }
        for r in rows {
          let (ry0, ry1) = r
          let ok = block_ok(bx0, ry0) &&
            block_ok(bx1, ry0) &&
            block_ok(bx0, ry1) &&
            block_ok(bx1, ry1) &&
            block_ok((bx0 + bx1) / 2.0, (ry0 + ry1) / 2.0)
          if ok {
            sb.write_string(
              "M\{pt(bx0, ry0)}H\{fmt1(bx1)}V\{fmt1(ry1)}H\{fmt1(bx0)}Z",
            )
          }
        }
      }
    }
  }
  sb.to_string()
}

///|
fn street_d(s : Street) -> String {
  if s.at < 0.0 {
    return "M\{pt(diag_a.0, diag_a.1)}L\{pt(diag_b.0, diag_b.1)}"
  }
  let sb = StringBuilder::new()
  for seg in street_segments(s) {
    let (a, b) = seg
    sb.write_string("M\{pt(a.0, a.1)}L\{pt(b.0, b.1)}")
  }
  sb.to_string()
}

///|
fn all_streets() -> Array[Street] {
  [..streets, lumen_avenue]
}

///|
fn land_d() -> String {
  let pts = coast_pts.copy()
  pts.push((7000.0, -3000.0))
  pts.push((-3000.0, -3000.0))
  poly_d(pts, true)
}

///|
fn river_d() -> String {
  poly_d(river_pts, false)
}

///|
fn world_layer() -> @element.DomNode {
  let kids : Array[@element.DomNode] = [
    @element.svg_path(d=land_d(), attrs=[sa("data-k", "land")]),
  ]
  for pk in parks {
    kids.push(@element.svg_path(d=poly_d(pk.1, true), attrs=[sa("data-k", "park")]))
  }
  kids.push(
    @element.svg_path(
      d=river_d(),
      fill="none",
      attrs=[sa("data-k", "river"), sa("vector-effect", "non-scaling-stroke")],
    ),
  )
  kids.push(@element.svg_path(d=blocks_d(), attrs=[sa("data-k", "blocks")]))
  let ordered = all_streets()
  // casings first, minor to avenue, then the fills on top
  for pass = 0; pass < 2; pass = pass + 1 {
    for kind in [1, 0, 2] {
      for s in ordered {
        if s.kind == kind {
          let k = if kind == 1 {
            "minor"
          } else if kind == 0 {
            "major"
          } else {
            "avenue"
          }
          let role = if pass == 0 { "case" } else { "fill" }
          kids.push(
            @element.svg_path(
              d=street_d(s),
              fill="none",
              attrs=[
                sa("data-k", "\{k}-\{role}"),
                sa("vector-effect", "non-scaling-stroke"),
                sa("stroke-linecap", "round"),
              ],
            ),
          )
        }
      }
    }
  }
  kids.push(
    @element.svg_path(
      d=poly_d(rail_pts, false),
      fill="none",
      attrs=[sa("data-k", "rail-case"), sa("vector-effect", "non-scaling-stroke")],
    ),
  )
  kids.push(
    @element.svg_path(
      d=poly_d(rail_pts, false),
      fill="none",
      attrs=[sa("data-k", "rail"), sa("vector-effect", "non-scaling-stroke")],
    ),
  )
  // the route, when there is one
  kids.push(
    @element.svg_path(
      fill="none",
      attrs=[sa("data-k", "route-case"), sa("vector-effect", "non-scaling-stroke")],
      dyn_attrs=[da("d", route_d), da("display", route_display)],
    ),
  )
  kids.push(
    @element.svg_path(
      fill="none",
      attrs=[sa("vector-effect", "non-scaling-stroke")],
      dyn_attrs=[
        da("d", route_d),
        da("display", route_display),
        da("data-k", fn() {
          match route() {
            Some(r) => if r.approx { "route-approx" } else { "route" }
            None => "route"
          }
        }),
      ],
    ),
  )
  @element.svg_g(
    dyn_attrs=[
      da("transform", fn() {
        let v = view.get()
        let s = scale_of(v.z)
        "translate(\{fmt2(map_w.get() / 2.0 - v.cx * s)} \{fmt2(map_h.get() / 2.0 - v.cy * s)}) scale(\{s})"
      }),
    ],
  ) <| kids
}

///|
fn route_visible() -> Bool {
  panel.get() == 3 && route() is Some(_)
}

///|
fn route_display() -> String {
  if route_visible() {
    "inline"
  } else {
    "none"
  }
}

///|
fn route_d() -> String {
  match route() {
    Some(r) => poly_d(r.pts, false)
    None => "M0 0"
  }
}

// ---------------------------------------------------------------- labels

///|
fn nearest_mid(lines : Array[Double], v : Double, shift : Int) -> Double {
  // the midpoint between grid lines nearest to v, moved by `shift` cells
  let n = lines.length()
  let mut best = 0
  let mut bd = 1.0e9
  for i = 1; i < n; i = i + 1 {
    let m = (lines[i - 1] + lines[i]) / 2.0
    let d = (m - v).abs()
    if d < bd {
      bd = d
      best = i
    }
  }
  let k0 = best + shift
  let k = if k0 < 1 {
    1
  } else if k0 > n - 1 {
    n - 1
  } else {
    k0
  }
  (lines[k - 1] + lines[k]) / 2.0
}

///|
let xs_all : Array[Double] = grid_xs()

///|
let ys_all : Array[Double] = grid_ys()

///|
/// Where a street's name goes now: (shown, x, y, rotation) in map pixels.
fn street_label(s : Street, i : Int) -> (Bool, Double, Double, Double) {
  let lv = level()
  let need = if s.kind == 1 { 4 } else { 3 }
  if lv < need {
    return (false, 0.0, 0.0, 0.0)
  }
  let v = view.get()
  let shift = i % 3 - 1
  if s.at < 0.0 {
    // Lumen Avenue: the point of the diagonal nearest the centre
    let dx = diag_b.0 - diag_a.0
    let dy = diag_b.1 - diag_a.1
    let t = clampd(
      ((v.cx - diag_a.0) * dx + (v.cy - diag_a.1) * dy) / (dx * dx + dy * dy),
      0.05,
      0.95,
    )
    let x = sx(diag_a.0 + t * dx)
    let y = sy(diag_a.1 + t * dy)
    return (in_view(x, y), x, y, atan2d(dy, dx))
  }
  let segs = street_segments(s)
  if s.vertical {
    let (a, b) = segs[0]
    let y = clampd(nearest_mid(ys_all, v.cy, shift), a.1 + 60.0, b.1 - 60.0)
    let px = sx(s.at)
    let py = sy(y)
    (in_view(px, py), px, py, -90.0)
  } else {
    // the segment nearest the centre
    let mut best = segs[0]
    for sg in segs {
      if v.cx >= sg.0.0 && v.cx <= sg.1.0 {
        best = sg
      }
    }
    let (a, b) = best
    let x = clampd(nearest_mid(xs_all, v.cx, shift), a.0 + 60.0, b.0 - 60.0)
    let px = sx(x)
    let py = sy(s.at)
    (in_view(px, py), px, py, 0.0)
  }
}

///|
fn in_view(x : Double, y : Double) -> Bool {
  if !(x > 30.0 && x < map_w.get() - 30.0 && y > 20.0 && y < map_h.get() - 20.0) {
    return false
  }
  // not under the floating UI (a label's middle within 50px of it, across)
  for z in covered_rects() {
    let (x0, y0, x1, y1) = z
    if x > x0 - 50.0 && x < x1 + 50.0 && y > y0 - 8.0 && y < y1 + 8.0 {
      return false
    }
  }
  true
}

///|
fn label_text(
  txt : String,
  kind : String,
  pos : () -> (Bool, Double, Double, Double),
) -> @element.DomNode {
  @element.svg_text(
    text_anchor="middle",
    dominant_baseline="central",
    attrs=[sa("data-k", kind)],
    dyn_attrs=[
      da("display", fn() { if pos().0 { "inline" } else { "none" } }),
      da("x", fn() { fmt1(pos().1) }),
      da("y", fn() { fmt1(pos().2) }),
      da("transform", fn() {
        let (_, x, y, r) = pos()
        if r == 0.0 {
          ""
        } else {
          "rotate(\{fmt1(r)} \{fmt1(x)} \{fmt1(y)})"
        }
      }),
    ],
  ) <| [@element.text(txt)]
}

///|
fn fixed_label(
  txt : String,
  kind : String,
  x : Double,
  y : Double,
  rot : Double,
  show_fn : (Int) -> Bool,
) -> @element.DomNode {
  label_text(txt, kind, fn() {
    let px = sx(x)
    let py = sy(y)
    // keep the whole of a horizontal label inside the map: about 7px a character at most
    let half = if rot == 0.0 {
      txt.length().to_double() * (if kind == "city" { 8.0 } else { 4.6 })
    } else {
      0.0
    }
    let inside = px - half > visible_left() + 6.0 && px + half < map_w.get() - 6.0
    (show_fn(level()) && inside && in_view(px, py), px, py, rot)
  })
}

///|
/// Avenue shields: route numbers at fixed points along each avenue.
fn shields() -> Array[@element.DomNode] {
  let spots : Array[(String, Double, Double)] = [
    ("7", 520.0, 1040.0),
    ("7", 2000.0, 1040.0),
    ("7", 3400.0, 1040.0),
    ("12", 2300.0, 300.0),
    ("12", 2300.0, 1320.0),
    ("1", 420.0, 2028.0),
    ("1", 2500.0, 780.0),
  ]
  spots.map(fn(sp) {
    let (num, x, y) = sp
    let w = if num.length() > 1 { 24.0 } else { 18.0 }
    @element.svg_g(
      attrs=[sa("data-k", "shield")],
      dyn_attrs=[
        da("transform", fn() { "translate(\{fmt1(sx(x))} \{fmt1(sy(y))})" }),
        da("display", fn() { if in_view(sx(x), sy(y)) { "inline" } else { "none" } }),
      ],
    ) <| [
      @element.svg_rect(
        x=fmt1(-w / 2.0),
        y="-8",
        width=fmt1(w),
        height="16",
        rx="4",
        attrs=[sa("data-k", "shield-box")],
      ),
      @element.svg_text(
        text_anchor="middle",
        dominant_baseline="central",
        y="0.5",
        attrs=[sa("data-k", "shield-num")],
      ) <| [@element.text(num)],
    ]
  })
}

///|
fn labels_layer() -> @element.DomNode {
  let kids : Array[@element.DomNode] = []
  // water and districts first, streets over them
  kids.push(fixed_label("Lumen Bay", "water", 2950.0, 2420.0, 0.0, fn(_l) { true }))
  kids.push(fixed_label("River Sable", "water", 1336.0, 240.0, 85.0, fn(l) { l >= 2 }))
  for a in areas {
    let (n, x, y) = a
    kids.push(fixed_label(n, "area", x, y, 0.0, fn(l) { l >= 2 && l <= 3 }))
  }
  kids.push(fixed_label("Port Lumen", "city", 1180.0, 1720.0, 0.0, fn(l) { l <= 2 }))
  for pk in parks {
    let (n, poly) = pk
    let mut ax = 0.0
    let mut ay = 0.0
    for q in poly {
      ax = ax + q.0
      ay = ay + q.1
    }
    let k = poly.length().to_double()
    kids.push(
      label_text(n, "park-label", fn() {
        let px = sx(ax / k)
        let py = sy(ay / k) + 30.0
        (level() >= 3 && in_view(px, py), px, py, 0.0)
      }),
    )
  }
  for i, s in all_streets() {
    let kind = if s.kind == 2 { "avenue-label" } else { "street-label" }
    kids.push(label_text(s.name, kind, fn() { street_label(s, i) }))
  }
  // station names: always in the transit layer
  for p in places {
    if p.cat == 5 && p.id <= 37 {
      kids.push(
        @element.svg_text(
          attrs=[sa("data-k", "station-label")],
          text_anchor="middle",
          dominant_baseline="central",
          dyn_attrs=[
            da("display", fn() {
              let show = layer.get() == 1 && level() >= 2
              if show && in_view(sx(p.x), sy(p.y)) {
                "inline"
              } else {
                "none"
              }
            }),
            da("x", fn() { fmt1(sx(p.x)) }),
            da("y", fn() { fmt1(sy(p.y) - 52.0) }),
          ],
        ) <| [@element.text(p.name)],
      )
    }
  }
  for sh in shields() {
    kids.push(sh)
  }
  // the route's ends and its "Approximate" tag
  kids.push(
    @element.svg_circle(
      r="7",
      attrs=[sa("data-k", "route-start")],
      dyn_attrs=[
        da("display", route_display),
        da("cx", fn() { route_end(true).0 }),
        da("cy", fn() { route_end(true).1 }),
      ],
    ),
  )
  kids.push(
    @element.svg_g(
      dyn_attrs=[
        da("display", fn() {
          match route() {
            Some(r) => if r.approx && route_visible() { "inline" } else { "none" }
            None => "none"
          }
        }),
        da("transform", fn() {
          match route() {
            Some(r) => {
              let (a, b) = (r.pts[0], r.pts[r.pts.length() - 1])
              "translate(\{fmt1(sx((a.0 + b.0) / 2.0))} \{fmt1(sy((a.1 + b.1) / 2.0))})"
            }
            None => ""
          }
        }),
      ],
    ) <| [
      @element.svg_rect(x="-46", y="-12", width="92", height="24", rx="12", attrs=[sa("data-k", "approx-box")]),
      @element.svg_text(
        text_anchor="middle",
        dominant_baseline="central",
        y="0.5",
        attrs=[sa("data-k", "approx-text")],
      ) <| [@element.text("Approximate")],
    ],
  )
  @element.svg(
    attrs=[sa("data-k", "labels"), sa("aria-hidden", "true"), sa("focusable", "false")],
    width="100%",
    height="100%",
  ) <| kids
}

///|
fn route_end(start : Bool) -> (String, String) {
  match route() {
    Some(r) => {
      let p = if start { r.pts[0] } else { r.pts[r.pts.length() - 1] }
      (fmt1(sx(p.0)), fmt1(sy(p.1)))
    }
    None => ("0", "0")
  }
}

// ---------------------------------------------------------------- pins

///|
fn pin_shown(id : Int) -> Bool {
  let c = clusters()
  c.leader[id] == id && c.count[id] == 1 && on_map(places[id].x, places[id].y)
}

///|
/// Inside the part of the map nothing covers (with a margin for the pin itself).
fn on_map(x : Double, y : Double) -> Bool {
  let px = sx(x)
  let py = sy(y)
  if !(px > visible_left() + 8.0 && px < map_w.get() - 8.0 && py > 30.0 && py < map_h.get() - sheet_height() + 2.0) {
    return false
  }
  // the pin's own box: 44 wide, its tip at (px, py)
  let l = px - 22.0
  let r = px + 22.0
  let t = py - 40.0
  let b = py + 4.0
  for z in covered_rects() {
    let (x0, y0, x1, y1) = z
    if r > x0 && l < x1 && b > y0 && t < y1 {
      return false
    }
  }
  true
}

///|
/// What floats over the map, in map pixels: search and chips, zoom, layers, the foot bar.
fn covered_rects() -> Array[(Double, Double, Double, Double)] {
  let w = map_w.get()
  let h = map_h.get() - sheet_height()
  if mobile.get() {
    [(0.0, 0.0, w, 104.0), (w - 60.0, h - 168.0, w, h - 64.0), (0.0, h - 132.0, 72.0, h - 64.0), (w - 130.0, h - 44.0, w, h)]
  } else {
    let top_w = if visible_left() > 0.0 { 404.0 } else { 676.0 }
    [
      (0.0, 0.0, top_w, 116.0),
      (w - 60.0, h - 148.0, w, h - 56.0),
      (visible_left(), h - 92.0, visible_left() + 92.0, h),
      (w - 470.0, h - 44.0, w, h),
    ]
  }
}

///|
fn pin_button(p : Place) -> @element.DomNode {
  let (open, rest) = open_status(p)
  @element.button(
    attrs=[
      sa("type", "button"),
      sa("aria-label", p.name),
      sa("id", "pin-\{p.id}"),
      sa("data-cat", p.cat.to_string()),
    ],
    dyn_attrs=[
      da("aria-pressed", fn() { (selected.get() == p.id).to_string() }),
      da("tabindex", fn() { if pin_shown(p.id) { "0" } else { "-1" } }),
    ],
    dyn_class=fn() {
      let mut c = "pin"
      if !pin_shown(p.id) {
        c = c + " off"
      }
      if selected.get() == p.id {
        c = c + " sel"
      }
      if hot.get() == p.id {
        c = c + " hot"
      }
      c
    },
    dyn_style=fn() { "transform: translate(\{fmt1(sx(p.x) - 22.0)}px, \{fmt1(sy(p.y) - 40.0)}px)" },
    on=@element.events()
      .click(fn(_e) { select_place(p.id) }),
  ) <| [
    pin_svg(p.cat),
    @element.span(class="pin-card", attrs=[sa("aria-hidden", "true")]) <| [
      @element.span(class="pin-card-name") <| [@element.text(p.name)],
      @element.span(class="pin-card-meta") <| [
        @element.text("\{rating_str(p.rating)} \u{2605} \u{b7} \{cat_singular[p.cat]}"),
      ],
      @element.span(class=if open { "pin-card-open" } else { "pin-card-closed" }) <| [
        @element.text(if open { "Open" } else { "Closed" }),
        @element.span(class="pin-card-rest") <| [@element.text(" \u{b7} \{rest}")],
      ],
    ],
  ]
}

///|
fn cluster_button(p : Place) -> @element.DomNode {
  let shown = fn() {
    let c = clusters()
    c.leader[p.id] == p.id && c.count[p.id] > 1 && on_map(c.cx[p.id], c.cy[p.id] + 20.0)
  }
  @element.button(
    attrs=[sa("type", "button")],
    dyn_attrs=[
      da("aria-label", fn() { "\{clusters().count[p.id]} places here. Zoom in" }),
      da("tabindex", fn() { if shown() { "0" } else { "-1" } }),
    ],
    dyn_class=fn() { if shown() { "cluster" } else { "cluster off" } },
    dyn_style=fn() {
      let c = clusters()
      "transform: translate(\{fmt1(sx(c.cx[p.id]) - 22.0)}px, \{fmt1(sy(c.cy[p.id]) - 22.0)}px)"
    },
    on=@element.events().click(fn(_e) {
      let c = clusters()
      let z = (view.get().z + 0.001).floor() + 2.0
      ease_to_point(c.cx[p.id], c.cy[p.id], z)
    }),
  ) <| [
    @element.span(attrs=[sa("aria-hidden", "true")]) <| [
      @element.text_dyn(fn() { clusters().count[p.id].to_string() }),
    ],
  ]
}

// ---------------------------------------------------------------- input on the map

///|
let drag_last : Ref[(Double, Double)] = Ref((0.0, 0.0))

///|
let drag_moved : Ref[Double] = Ref(0.0)

///|
let drag_on : Ref[Bool] = Ref(false)

///|
extern "js" fn is_self(e : @js.Any) -> Bool =
  #|(e) => e.target === e.currentTarget

///|
fn map_local(e : @js.Any) -> (Double, Double) {
  match map_el.val {
    Some(el) => (ev_num(e, "clientX") - el_left(el), ev_num(e, "clientY") - el_top(el))
    None => (0.0, 0.0)
  }
}

///|
fn map_keydown(e : @js.Any) -> Unit {
  if !is_self(e) {
    return
  }
  let k = ev_str(e, "key")
  match k {
    "ArrowLeft" => pan_by(-100.0, 0.0)
    "ArrowRight" => pan_by(100.0, 0.0)
    "ArrowUp" => pan_by(0.0, -100.0)
    "ArrowDown" => pan_by(0.0, 100.0)
    "+" | "=" => zoom_centre(1.0)
    "-" | "_" => zoom_centre(-1.0)
    "Home" => fly_to(home_view())
    _ => return
  }
  ev_prevent(e)
}

///|
fn map_view() -> @element.DomNode {
  let pins : Array[@element.DomNode] = []
  for p in places {
    pins.push(cluster_button(p))
  }
  for p in places {
    pins.push(pin_button(p))
  }
  @element.div(
    id="map",
    attrs=[
      sa("role", "region"),
      sa("aria-label", "Map of Port Lumen"),
      sa("aria-describedby", "map-help"),
      sa("tabindex", "0"),
    ],
    dyn_class=fn() {
      let l = ["default", "transit", "terrain"]
      let d = if dragging.get() { " dragging" } else { "" }
      "map lvl-\{level()} layer-\{l[layer.get()]}\{d}"
    },
    dyn_style=fn() {
      let s = scale_of(view.get().z)
      "--k: \{fmt2(s)}"
    },
    ref_=fn(el) { map_el.val = Some(el |> @js.identity) },
    on=@element.events()
      .pointerdown(fn(e) {
        let e = ev(e)
        if target_in(e, "button, a, input, .no-drag") || ev_num(e, "button") != 0.0 {
          return
        }
        drag_on.val = true
        drag_moved.val = 0.0
        drag_last.val = (ev_num(e, "clientX"), ev_num(e, "clientY"))
        match map_el.val {
          Some(el) => capture(el, e)
          None => ()
        }
        anim_token.val = anim_token.val + 1
        layers_open.set(false)
      })
      .pointermove(fn(e) {
        if !drag_on.val {
          return
        }
        let e = ev(e)
        let x = ev_num(e, "clientX")
        let y = ev_num(e, "clientY")
        let (lx, ly) = drag_last.val
        drag_last.val = (x, y)
        drag_moved.val = drag_moved.val + (x - lx).abs() + (y - ly).abs()
        if drag_moved.val > 3.0 {
          dragging.set(true)
        }
        let v = view.get()
        let s = scale_of(v.z)
        view.set(clamp_view({ cx: v.cx - (x - lx) / s, cy: v.cy - (y - ly) / s, z: v.z }))
      })
      .pointerup(fn(e) {
        if !drag_on.val {
          return
        }
        drag_on.val = false
        dragging.set(false)
        match map_el.val {
          Some(el) => release(el, ev(e))
          None => ()
        }
        sync_url()
      })
      .pointercancel(fn(_e) {
        drag_on.val = false
        dragging.set(false)
      })
      .dblclick(fn(e) {
        let e = ev(e)
        if target_in(e, "button, a, input, .no-drag") {
          return
        }
        let (x, y) = map_local(e)
        zoom_at(x, y, 1.0)
      })
      .keydown(fn(e) { map_keydown(ev(e)) }),
  ) <| [
    @element.p(id="map-help", class="sr-only") <| [
      @element.text(
        "Use the arrow keys to pan, plus and minus to zoom, and Home to reset the view. Drag to pan; scroll or double-click to zoom. Tab moves to the places on the map.",
      ),
    ],
    @element.svg(
      attrs=[sa("data-k", "world"), sa("aria-hidden", "true"), sa("focusable", "false")],
      width="100%",
      height="100%",
    ) <| [world_layer()],
    labels_layer(),
    @element.div(class="pins") <| pins,
  ]
}

///|
fn wire_wheel() -> Unit {
  match map_el.val {
    Some(el) =>
      on_el(el, "wheel", fn(e) {
        ev_prevent(e)
        let dy = ev_num(e, "deltaY")
        if dy == 0.0 {
          return
        }
        let (x, y) = map_local(e)
        zoom_at(x, y, if dy < 0.0 { 0.5 } else { -0.5 })
      })
    None => ()
  }
}

// ---------------------------------------------------------------- scale bar

///|
fn scale_bar() -> (Double, String) {
  let s = scale_of(view.get().z)
  let steps = [20.0, 50.0, 100.0, 200.0, 500.0, 1000.0, 2000.0]
  let mut pick = steps[0]
  for d in steps {
    if d * s <= 110.0 {
      pick = d
    }
  }
  (pick * s, dist_label(pick))
}
