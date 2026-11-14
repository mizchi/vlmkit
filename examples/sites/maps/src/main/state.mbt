// Application state: the view, the panel, the search, the directions.

///|
#derive(Eq)
struct View {
  cx : Double
  cy : Double
  z : Double
}

///|
let desk_home : View = { cx: 1900.0, cy: 1250.0, z: 2.0 }

///|
let phone_home : View = { cx: 1420.0, cy: 1650.0, z: 1.5 }

///|
fn home_view() -> View {
  if mobile.get() {
    phone_home
  } else {
    desk_home
  }
}

///|
extern "js" fn powf(a : Double, b : Double) -> Double =
  #|(a, b) => Math.pow(a, b)

///|
fn scale_of(z : Double) -> Double {
  0.24 * powf(1.65, z - 1.0)
}

///|
fn clampd(v : Double, lo : Double, hi : Double) -> Double {
  if v < lo {
    lo
  } else if v > hi {
    hi
  } else {
    v
  }
}

///|
fn clamp_view(v : View) -> View {
  {
    cx: clampd(v.cx, 0.0, 4000.0),
    cy: clampd(v.cy, 0.0, 2800.0),
    z: clampd(v.z, 1.0, 6.0),
  }
}

// ---------------------------------------------------------------- signals

///|
let view : @resource.Signal[View] = @resource.signal(desk_home)

///|
let map_w : @resource.Signal[Double] = @resource.signal(1208.0)

///|
let map_h : @resource.Signal[Double] = @resource.signal(800.0)

///|
let mobile : @resource.Signal[Bool] = @resource.signal(false)

///|
/// 0 none, 1 results, 2 place, 3 directions, 4 saved
let panel : @resource.Signal[Int] = @resource.signal(0)

///|
let collapsed : @resource.Signal[Bool] = @resource.signal(false)

///|
/// what the results list shows
#derive(Eq)
struct Query {
  cat : Int // -1 any
  text : String
  near : Bool
  nx : Double
  ny : Double
  label : String
}

///|
let no_query : Query = { cat: -1, text: "", near: false, nx: 0.0, ny: 0.0, label: "" }

///|
let query : @resource.Signal[Query] = @resource.signal(no_query)

///|
let has_results : @resource.Signal[Bool] = @resource.signal(false)

///|
let chip : @resource.Signal[Int] = @resource.signal(-1)

///|
let selected : @resource.Signal[Int] = @resource.signal(-1)

///|
let hot : @resource.Signal[Int] = @resource.signal(-1)

///|
let place_tab : @resource.Signal[Int] = @resource.signal(0)

///|
let saved : @resource.Signal[Array[Int]] = @resource.signal([])

///|
let follow_map : @resource.Signal[Bool] = @resource.signal(false)

///|
/// 0 default, 1 transit, 2 terrain
let layer : @resource.Signal[Int] = @resource.signal(0)

///|
let layers_open : @resource.Signal[Bool] = @resource.signal(false)

///|
let search_text : @resource.Signal[String] = @resource.signal("")

///|
let search_open : @resource.Signal[Bool] = @resource.signal(false)

///|
let search_active : @resource.Signal[Int] = @resource.signal(-1)

///|
let dir_from : @resource.Signal[Int] = @resource.signal(-1)

///|
let dir_to : @resource.Signal[Int] = @resource.signal(-1)

///|
let dir_mode : @resource.Signal[Int] = @resource.signal(0)

///|
/// 0 peek, 1 half, 2 full
let sheet : @resource.Signal[Int] = @resource.signal(1)

///|
let sheet_drag : @resource.Signal[Double] = @resource.signal(-1.0)

///|
let toast : @resource.Signal[String] = @resource.signal("")

///|
let share_url : @resource.Signal[String] = @resource.signal("")

///|
let copied : @resource.Signal[Bool] = @resource.signal(false)

///|
let review_sort : @resource.Signal[Int] = @resource.signal(0)

///|
let sort_open : @resource.Signal[Bool] = @resource.signal(false)

///|
let dragging : @resource.Signal[Bool] = @resource.signal(false)

///|
let animating : @resource.Signal[Bool] = @resource.signal(false)

///|
let map_el : Ref[@js.Any?] = Ref(None)

///|
let search_el : Ref[@js.Any?] = Ref(None)

///|
let share_el : Ref[@js.Any?] = Ref(None)

// ---------------------------------------------------------------- derived

///|
let level : () -> Int = @resource.memo_eq(fn() {
  let z = view.get().z
  let l = (z + 0.001).floor().to_int()
  if l < 1 {
    1
  } else if l > 6 {
    6
  } else {
    l
  }
})

///|
fn sx(x : Double) -> Double {
  let v = view.get()
  map_w.get() / 2.0 + (x - v.cx) * scale_of(v.z)
}

///|
fn sy(y : Double) -> Double {
  let v = view.get()
  map_h.get() / 2.0 + (y - v.cy) * scale_of(v.z)
}

///|
/// The left edge of the map the panel does not cover, in map pixels.
fn visible_left() -> Double {
  if !mobile.get() && panel.get() != 0 && !collapsed.get() {
    420.0
  } else {
    0.0
  }
}

///|
fn sheet_height() -> Double {
  if !mobile.get() || panel.get() == 0 {
    return 0.0
  }
  let d = sheet_drag.get()
  if d >= 0.0 {
    return d
  }
  snap_height(sheet.get())
}

///|
fn snap_height(i : Int) -> Double {
  let h = map_h.get()
  match i {
    0 => 66.0
    1 => (h * 0.5).floor()
    _ => h - 124.0
  }
}

///|
/// Which places the current filter keeps.
fn kept(p : Place) -> Bool {
  let c = chip.get()
  c < 0 || p.cat == c || p.id == selected.get()
}

///|
struct Clusters {
  leader : Array[Int] // -1 filtered out; otherwise the id of the place it is drawn with
  count : Array[Int]
  cx : Array[Double]
  cy : Array[Double]
}

///|
let clusters : () -> Clusters = @resource.memo(fn() {
  let lv = level()
  let _c = chip.get()
  let sel = selected.get()
  let n = places.length()
  let leader = Array::make(n, -1)
  let count = Array::make(n, 0)
  let cxs = Array::make(n, 0.0)
  let cys = Array::make(n, 0.0)
  let thr = 52.0 / scale_of(lv.to_double())
  for p in places {
    if kept(p) && (lv >= 3 || p.id == sel) {
      leader[p.id] = p.id
      count[p.id] = 1
      cxs[p.id] = p.x
      cys[p.id] = p.y
    }
  }
  if lv < 3 {
    for p in places {
      if !kept(p) || p.id == sel || leader[p.id] >= 0 {
        continue
      }
      leader[p.id] = p.id
      let mut k = 1
      let mut ax = p.x
      let mut ay = p.y
      for q in places {
        if q.id != p.id && kept(q) && q.id != sel && leader[q.id] < 0 &&
          world_dist(p.x, p.y, q.x, q.y) < thr {
          leader[q.id] = p.id
          k = k + 1
          ax = ax + q.x
          ay = ay + q.y
        }
      }
      count[p.id] = k
      cxs[p.id] = ax / k.to_double()
      cys[p.id] = ay / k.to_double()
    }
  }
  { leader, count, cx: cxs, cy: cys }
})

///|
fn matches_text(p : Place, t : String) -> Bool {
  let q = t.to_lower()
  q == "" ||
  p.name.to_lower().contains(q) ||
  cat_names[p.cat].to_lower().contains(q) ||
  cat_singular[p.cat].to_lower().contains(q) ||
  place_area(p).to_lower().contains(q)
}

///|
fn on_screen(p : Place) -> Bool {
  let x = sx(p.x)
  let y = sy(p.y)
  x > visible_left() && x < map_w.get() && y > 0.0 && y < map_h.get() - sheet_height()
}

///|
let results : () -> Array[Int] = @resource.memo_eq(fn() {
  let q = query.get()
  let follow = follow_map.get()
  let out : Array[Place] = []
  for p in places {
    let ok = (q.cat < 0 || p.cat == q.cat) && (q.cat >= 0 || matches_text(p, q.text))
    if ok && (!follow || on_screen(p)) {
      out.push(p)
    }
  }
  if q.near {
    out.sort_by(fn(a, b) {
      let da = world_dist(a.x, a.y, q.nx, q.ny)
      let db = world_dist(b.x, b.y, q.nx, q.ny)
      if da < db {
        -1
      } else if da > db {
        1
      } else {
        0
      }
    })
  } else {
    out.sort_by(fn(a, b) { b.rating - a.rating })
  }
  out.map(fn(p) { p.id })
})

// ---------------------------------------------------------------- the view, eased

///|
let anim_token : Ref[Int] = Ref(0)

///|
fn sync_url() -> Unit {
  let v = view.get()
  let mut q = "?at=\{v.cx.round().to_int()},\{v.cy.round().to_int()},\{fmt1(v.z)}"
  let s = selected.get()
  if s >= 0 && panel.get() == 2 {
    q = q + "&place=\{s}"
  }
  replace_query(q)
}

///|
/// Run a view animation: f(e) is the view at eased progress e in [0, 1].
fn animate(f : (Double) -> View) -> Unit {
  anim_token.val = anim_token.val + 1
  let tok = anim_token.val
  if reduced_motion() {
    view.set(clamp_view(f(1.0)))
    animating.set(false)
    sync_url()
    return
  }
  let start = Ref(-1.0)
  animating.set(true)
  fn step(t : Double) -> Unit {
    if tok != anim_token.val {
      return
    }
    if start.val < 0.0 {
      start.val = t
    }
    let k = clampd((t - start.val) / 200.0, 0.0, 1.0)
    let e = 1.0 - (1.0 - k) * (1.0 - k) * (1.0 - k)
    view.set(clamp_view(f(e)))
    if k < 1.0 {
      raf(step)
    } else {
      animating.set(false)
      sync_url()
    }
  }

  raf(step)
}

///|
fn fly_to(target : View) -> Unit {
  let from = view.get()
  let t = clamp_view(target)
  animate(fn(e) {
    {
      cx: from.cx + (t.cx - from.cx) * e,
      cy: from.cy + (t.cy - from.cy) * e,
      z: from.z + (t.z - from.z) * e,
    }
  })
}

///|
/// Zoom by dz keeping the world point under map pixel (px, py) in place.
fn zoom_at(px : Double, py : Double, dz : Double) -> Unit {
  let from = view.get()
  let z1 = clampd((from.z * 2.0).round() / 2.0 + dz, 1.0, 6.0)
  let w = map_w.get()
  let h = map_h.get()
  let s0 = scale_of(from.z)
  let wx = from.cx + (px - w / 2.0) / s0
  let wy = from.cy + (py - h / 2.0) / s0
  animate(fn(e) {
    let z = from.z + (z1 - from.z) * e
    let s = scale_of(z)
    { cx: wx - (px - w / 2.0) / s, cy: wy - (py - h / 2.0) / s, z }
  })
}

///|
fn zoom_centre(dz : Double) -> Unit {
  let l = visible_left()
  zoom_at((l + map_w.get()) / 2.0, (map_h.get() - sheet_height()) / 2.0, dz)
}

///|
fn pan_by(dx : Double, dy : Double) -> Unit {
  let v = view.get()
  let s = scale_of(v.z)
  fly_to({ cx: v.cx + dx / s, cy: v.cy + dy / s, z: v.z })
}

///|
/// Ease so that a world point sits in the middle of the uncovered map.
fn ease_to_point(x : Double, y : Double, z : Double) -> Unit {
  fly_to(point_view(x, y, z))
}

///|
fn point_view(x : Double, y : Double, z : Double) -> View {
  let s = scale_of(z)
  let w = map_w.get()
  let l = if !mobile.get() && !collapsed.get() { 420.0 } else { 0.0 }
  let sh = if mobile.get() { snap_height(sheet.get()) } else { 0.0 }
  let mx = (l + w) / 2.0
  let my = if mobile.get() { (110.0 + map_h.get() - sh) / 2.0 } else { map_h.get() / 2.0 }
  { cx: x - (mx - w / 2.0) / s, cy: y - (my - map_h.get() / 2.0) / s, z }
}

// ---------------------------------------------------------------- actions

///|
fn open_panel(mode : Int) -> Unit {
  panel.set(mode)
  collapsed.set(false)
  if mobile.get() && sheet.get() == 0 {
    sheet.set(1)
  }
}

///|
fn select_place(id : Int) -> Unit {
  let p = places[id]
  @resource.batch(fn() {
    selected.set(id)
    place_tab.set(0)
    sort_open.set(false)
    open_panel(2)
  })
  let z = if view.get().z < 3.0 { 3.0 } else { view.get().z }
  ease_to_point(p.x, p.y, z)
}

///|
fn show_results(q : Query) -> Unit {
  @resource.batch(fn() {
    query.set(q)
    has_results.set(true)
    selected.set(-1)
    open_panel(1)
  })
  sync_url()
}

///|
fn show_category(c : Int) -> Unit {
  chip.set(c)
  show_results({ cat: c, text: "", near: false, nx: 0.0, ny: 0.0, label: cat_names[c] })
  match fit_results() {
    Some(v) => fly_to(v)
    None => ()
  }
}

///|
extern "js" fn ln(x : Double) -> Double =
  #|(x) => Math.log(x)

///|
/// The view that shows every place the query matches in the part of the map left free.
fn fit_results() -> View? {
  let q = query.get()
  let mut x0 = 1.0e9
  let mut y0 = 1.0e9
  let mut x1 = -1.0e9
  let mut y1 = -1.0e9
  let mut n = 0
  for p in places {
    if (q.cat < 0 || p.cat == q.cat) && (q.cat >= 0 || matches_text(p, q.text)) {
      n = n + 1
      x0 = if p.x < x0 { p.x } else { x0 }
      y0 = if p.y < y0 { p.y } else { y0 }
      x1 = if p.x > x1 { p.x } else { x1 }
      y1 = if p.y > y1 { p.y } else { y1 }
    }
  }
  if n == 0 {
    return None
  }
  let l = if !mobile.get() { 420.0 } else { 0.0 }
  let top = if mobile.get() { 110.0 } else { 60.0 }
  let sh = if mobile.get() { snap_height(sheet.get()) } else { 0.0 }
  let vw = map_w.get() - l - 40.0
  let vh = map_h.get() - sh - top - 50.0
  let s = {
    let a = vw / (x1 - x0 + 200.0)
    let b = vh / (y1 - y0 + 200.0)
    if a < b { a } else { b }
  }
  let z = clampd(1.0 + ln(s / 0.24) / ln(1.65), 1.0, 4.0)
  let z2 = (z * 2.0).floor() / 2.0
  let v = point_view((x0 + x1) / 2.0, (y0 + y1) / 2.0, z2)
  // point_view centres vertically without the search bar; nudge down by half of it
  Some({ ..v, cy: v.cy - top / 2.0 / scale_of(z2) })
}

///|
fn toggle_chip(c : Int) -> Unit {
  if chip.get() == c {
    @resource.batch(fn() {
      chip.set(-1)
      if panel.get() == 1 {
        panel.set(0)
        has_results.set(false)
      }
    })
  } else {
    show_category(c)
  }
}

///|
fn back_from_place() -> Unit {
  @resource.batch(fn() {
    selected.set(-1)
    if has_results.get() {
      panel.set(1)
    } else {
      panel.set(0)
    }
  })
  sync_url()
}

///|
fn close_everything() -> Unit {
  @resource.batch(fn() {
    panel.set(0)
    has_results.set(false)
    selected.set(-1)
    chip.set(-1)
    query.set(no_query)
  })
  sync_url()
}

///|
fn open_directions(to : Int) -> Unit {
  @resource.batch(fn() {
    if to >= 0 {
      dir_to.set(to)
    }
    open_panel(3)
  })
}

///|
fn is_saved(id : Int) -> Bool {
  saved.get().contains(id)
}

///|
fn toggle_saved(id : Int) -> Unit {
  saved.update(fn(a) {
    if a.contains(id) {
      a.filter(fn(x) { x != id })
    } else {
      [..a, id]
    }
  })
}

// ---------------------------------------------------------------- directions

///|
struct Route {
  pts : Array[(Double, Double)]
  steps : Array[String]
  approx : Bool
  length : Double
}

///|
fn route_length(pts : Array[(Double, Double)]) -> Double {
  let mut l = 0.0
  for i = 1; i < pts.length(); i = i + 1 {
    l = l + world_dist(pts[i - 1].0, pts[i - 1].1, pts[i].0, pts[i].1)
  }
  l
}

///|
fn compass(dx : Double, dy : Double) -> String {
  let ang = atan2d(-dy, dx)
  let names = ["east", "north-east", "north", "north-west", "west", "south-west", "south", "south-east"]
  let i = ((ang + 360.0 + 22.5) / 45.0).floor().to_int() % 8
  names[i]
}

///|
extern "js" fn atan2d(y : Double, x : Double) -> Double =
  #|(y, x) => Math.atan2(y, x) * 180 / Math.PI

///|
let route : () -> Route? = @resource.memo(fn() {
  let a = dir_from.get()
  let b = dir_to.get()
  if a < 0 || b < 0 || a == b {
    return None
  }
  for r in routes {
    let (ra, rb, pts, steps) = r
    if ra == a && rb == b {
      return Some({ pts, steps, approx: false, length: route_length(pts) })
    }
    if ra == b && rb == a {
      let rev = pts.copy()
      rev.rev_in_place()
      return Some({
        pts: rev,
        steps: [
          "Head out from \{places[a].name}", "Follow the same streets back, in reverse",
          "Arrive at \{places[b].name}",
        ],
        approx: false,
        length: route_length(pts),
      })
    }
  }
  let pa = places[a]
  let pb = places[b]
  let pts = [(pa.x, pa.y), (pb.x, pb.y)]
  let l = route_length(pts)
  Some({
    pts,
    steps: [
      "Head \{compass(pb.x - pa.x, pb.y - pa.y)} from \{pa.name}", "Continue for about \{dist_label(l * 1.3)}",
      "Arrive at \{pb.name}",
    ],
    approx: true,
    length: l * 1.3,
  })
})

///|
let mode_names : Array[String] = ["Drive", "Transit", "Walk", "Cycle"]

///|
fn mode_minutes(m : Int, length : Double) -> Int {
  let mins = match m {
    0 => length / 350.0 + 2.0
    1 => length / 220.0 + 5.0
    2 => length / 80.0
    _ => length / 240.0
  }
  let v = mins.round().to_int()
  if v < 1 {
    1
  } else {
    v
  }
}
