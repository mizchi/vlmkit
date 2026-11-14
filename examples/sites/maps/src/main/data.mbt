// Port Lumen: a fictional harbour city, drawn from the data below.
// World units are metres; the city is about 4 km by 2.5 km.

///|
struct Street {
  name : String
  kind : Int // 0 major, 1 minor, 2 avenue
  vertical : Bool // runs north-south (a line of constant x)
  at : Double // the x (vertical) or y (horizontal) of the line
  route : String // route number for an avenue, "" otherwise
}

///|
struct Place {
  id : Int
  name : String
  cat : Int
  x : Double
  y : Double
  rating : Int // tenths: 46 = 4.6
  reviews : Int
  price : Int // 0 none, 1-4
  hours : Int // index into hours_table
  site : String
  blurb : String
}

///|
let cat_names : Array[String] = [
  "Restaurants", "Coffee", "Hotels", "Museums", "Parks", "Transit",
]

///|
let cat_singular : Array[String] = [
  "Restaurant", "Coffee shop", "Hotel", "Museum", "Park", "Station",
]

///|
let cat_colors : Array[String] = [
  "#c25400", "#7a4a1e", "#b0306a", "#6b3fb0", "#1f7a3a", "#1a5fb4",
]

///|
let coast_pts : Array[(Double, Double)] = [
  (-3000.0, 2480.0),
  (0.0, 2480.0),
  (400.0, 2500.0),
  (800.0, 2460.0),
  (1200.0, 2520.0),
  (1500.0, 2420.0),
  (1700.0, 2300.0),
  (2100.0, 2150.0),
  (2500.0, 2250.0),
  (2800.0, 2060.0),
  (3100.0, 1800.0),
  (3400.0, 1520.0),
  (3700.0, 1320.0),
  (4000.0, 1260.0),
  (7000.0, 1260.0),
]

///|
let river_pts : Array[(Double, Double)] = [
  (1300.0, -3000.0),
  (1300.0, 0.0),
  (1350.0, 400.0),
  (1250.0, 800.0),
  (1450.0, 1200.0),
  (1600.0, 1600.0),
  (1750.0, 2000.0),
  (1900.0, 2250.0),
  (1960.0, 2400.0),
]

///|
let rail_pts : Array[(Double, Double)] = [
  (-3000.0, 1250.0),
  (0.0, 1250.0),
  (700.0, 1250.0),
  (1200.0, 1150.0),
  (1700.0, 900.0),
  (2400.0, 700.0),
  (3300.0, 650.0),
  (3900.0, 700.0),
  (7000.0, 700.0),
]

///|
/// Lumen Avenue runs straight from the south-west to the north-east.
let diag_a : (Double, Double) = (200.0, 2160.0)

///|
let diag_b : (Double, Double) = (3200.0, 360.0)

///|
let streets : Array[Street] = [
  // north-south
  { name: "Westwall Street", kind: 0, vertical: true, at: 200.0, route: "" },
  { name: "Flint Lane", kind: 1, vertical: true, at: 360.0, route: "" },
  { name: "Ropewalk", kind: 0, vertical: true, at: 520.0, route: "" },
  { name: "Cooper Lane", kind: 1, vertical: true, at: 680.0, route: "" },
  { name: "Chandler Street", kind: 0, vertical: true, at: 840.0, route: "" },
  { name: "Sail Lane", kind: 1, vertical: true, at: 970.0, route: "" },
  { name: "Tanner Street", kind: 0, vertical: true, at: 1100.0, route: "" },
  { name: "Lamplighter Way", kind: 0, vertical: true, at: 1700.0, route: "" },
  { name: "Net Lane", kind: 1, vertical: true, at: 1850.0, route: "" },
  { name: "Quay Street", kind: 0, vertical: true, at: 2000.0, route: "" },
  { name: "Pilot Lane", kind: 1, vertical: true, at: 2150.0, route: "" },
  { name: "Crown Avenue", kind: 2, vertical: true, at: 2300.0, route: "12" },
  { name: "Anchor Lane", kind: 1, vertical: true, at: 2450.0, route: "" },
  { name: "Beacon Street", kind: 0, vertical: true, at: 2600.0, route: "" },
  { name: "Gull Lane", kind: 1, vertical: true, at: 2750.0, route: "" },
  { name: "Signal Street", kind: 0, vertical: true, at: 2900.0, route: "" },
  { name: "Tide Lane", kind: 1, vertical: true, at: 3050.0, route: "" },
  { name: "Lighthouse Road", kind: 0, vertical: true, at: 3200.0, route: "" },
  // east-west
  { name: "North Road", kind: 0, vertical: false, at: 200.0, route: "" },
  { name: "Bell Lane", kind: 1, vertical: false, at: 340.0, route: "" },
  { name: "Market Street", kind: 0, vertical: false, at: 480.0, route: "" },
  { name: "Candle Lane", kind: 1, vertical: false, at: 620.0, route: "" },
  { name: "Guild Street", kind: 0, vertical: false, at: 760.0, route: "" },
  { name: "Ink Lane", kind: 1, vertical: false, at: 900.0, route: "" },
  { name: "Harbour Avenue", kind: 2, vertical: false, at: 1040.0, route: "7" },
  { name: "Oar Lane", kind: 1, vertical: false, at: 1180.0, route: "" },
  { name: "Mill Street", kind: 0, vertical: false, at: 1320.0, route: "" },
  { name: "Kiln Lane", kind: 1, vertical: false, at: 1460.0, route: "" },
  { name: "Foundry Street", kind: 0, vertical: false, at: 1600.0, route: "" },
  { name: "Rope Lane", kind: 1, vertical: false, at: 1740.0, route: "" },
  { name: "Dock Street", kind: 0, vertical: false, at: 1880.0, route: "" },
  { name: "Wharf Street", kind: 0, vertical: false, at: 2160.0, route: "" },
]

///|
/// Parks as polygons, with their names.
let parks : Array[(String, Array[(Double, Double)])] = [
  (
    "Lantern Park",
    [(534.0, 1334.0), (826.0, 1334.0), (826.0, 1586.0), (534.0, 1586.0)],
  ),
  (
    "Ridge Gardens",
    [(2614.0, 214.0), (2886.0, 214.0), (2886.0, 466.0), (2614.0, 466.0)],
  ),
  (
    "Quay Green",
    [(1864.0, 1894.0), (2136.0, 1894.0), (2136.0, 2110.0), (1864.0, 2130.0)],
  ),
  (
    "Sable Common",
    [(1114.0, 414.0), (1300.0, 414.0), (1240.0, 746.0), (1114.0, 746.0)],
  ),
  (
    "Crown Hill Park",
    [(3064.0, 214.0), (3386.0, 214.0), (3386.0, 466.0), (3064.0, 466.0)],
  ),
]

///|
/// Districts: name and label point.
let areas : Array[(String, Double, Double)] = [
  ("Old Town", 600.0, 600.0),
  ("Millbank", 640.0, 1880.0),
  ("Riverside", 1520.0, 640.0),
  ("Harbour Quarter", 2450.0, 1665.0),
  ("Crown Hill", 2850.0, 540.0),
  ("Eastpoint", 3480.0, 1040.0),
]

///|
let hours_table : Array[Array[(Int, Int)]] = [
  // 0 coffee: 7-18, Sun 8-16
  [(420, 1080), (420, 1080), (420, 1080), (420, 1080), (420, 1080), (480, 1080), (480, 960)],
  // 1 restaurant: 11:30-22
  [(690, 1320), (690, 1320), (690, 1320), (690, 1320), (690, 1380), (690, 1380), (690, 1260)],
  // 2 dinner only, closed Monday
  [(-1, -1), (1020, 1380), (1020, 1380), (1020, 1380), (1020, 1440), (1020, 1440), (1020, 1320)],
  // 3 museum, closed Monday
  [(-1, -1), (600, 1020), (600, 1020), (600, 1020), (600, 1260), (600, 1080), (600, 1080)],
  // 4 park
  [(360, 1320), (360, 1320), (360, 1320), (360, 1320), (360, 1320), (360, 1320), (360, 1320)],
  // 5 always open
  [(0, 1440), (0, 1440), (0, 1440), (0, 1440), (0, 1440), (0, 1440), (0, 1440)],
  // 6 evening espresso bar
  [(1020, 1500), (1020, 1500), (1020, 1500), (1020, 1500), (1020, 1560), (1020, 1560), (-1, -1)],
  // 7 closed Tuesdays
  [(540, 1080), (-1, -1), (540, 1080), (540, 1080), (540, 1080), (540, 1080), (600, 960)],
  // 8 brunch
  [(480, 900), (480, 900), (480, 900), (480, 900), (480, 900), (540, 960), (540, 960)],
]

///|
let day_names : Array[String] = [
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
]

///|
let day_short : Array[String] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

///|
/// The fixed "now": Tuesday 14:30.
let now_day : Int = 1

///|
let now_min : Int = 870

///|
fn mk(
  id : Int,
  name : String,
  cat : Int,
  x : Double,
  y : Double,
  rating : Int,
  reviews : Int,
  price : Int,
  hours : Int,
  site : String,
  blurb : String,
) -> Place {
  { id, name, cat, x, y, rating, reviews, price, hours, site, blurb }
}

///|
let places : Array[Place] = [
  mk(0, "Saltline Kitchen", 0, 2075.0, 1670.0, 46, 812, 2, 1, "saltline.example", "Seasonal plates from the morning catch."),
  mk(1, "The Copper Kettle", 0, 600.0, 690.0, 44, 356, 2, 1, "copperkettle.example", "A corner pub kitchen in the old tannery."),
  mk(2, "Brine & Barley", 0, 2525.0, 1810.0, 45, 498, 3, 2, "brineandbarley.example", "Small plates and a long harbour-view bar."),
  mk(3, "Lantern House Grill", 0, 760.0, 1110.0, 42, 221, 2, 1, "lanternhouse.example", "Charcoal grill beside the rail arches."),
  mk(4, "Osteria Faro", 0, 2825.0, 1390.0, 47, 640, 3, 2, "osteriafaro.example", "Handmade pasta under the lighthouse beam."),
  mk(5, "Little Tide Noodle Bar", 0, 1925.0, 1250.0, 43, 289, 1, 1, "littletide.example", "Hand-pulled noodles, counter seats only."),
  mk(6, "Harbourmaster's Table", 0, 2225.0, 1950.0, 46, 733, 4, 2, "harbourmasters.example", "Tasting menu in the old customs house."),
  mk(7, "Ember & Oak", 0, 440.0, 830.0, 41, 167, 3, 2, "emberandoak.example", "Wood-fired dishes and natural wine."),
  mk(8, "Pier Nine Oysters", 0, 2675.0, 2010.0, 45, 402, 3, 1, "piernine.example", "Oysters and chowder on the quay."),
  mk(9, "Lumen Roasters", 1, 1775.0, 1110.0, 48, 905, 1, 0, "lumenroasters.example", "Single-origin coffee roasted on site."),
  mk(10, "Driftwood Coffee", 1, 2375.0, 1530.0, 46, 512, 1, 0, "driftwood.example", "Pour-overs and cardamom buns."),
  mk(11, "The Quay Cup", 1, 2075.0, 1530.0, 44, 318, 1, 8, "quaycup.example", "Brunch, flat whites and a sunny terrace."),
  mk(12, "Beacon Espresso Bar", 1, 2675.0, 830.0, 45, 276, 1, 0, "beaconespresso.example", "Standing-room espresso by the market."),
  mk(13, "Mill Street Coffee", 1, 440.0, 1390.0, 43, 198, 1, 7, "millstreetcoffee.example", "A neighbourhood cafe opposite Lantern Park."),
  mk(14, "Gull & Grind", 1, 3125.0, 1250.0, 42, 143, 1, 0, "gullandgrind.example", "Coffee for the ferry crowd."),
  mk(15, "Sable Coffee Works", 1, 1035.0, 550.0, 47, 621, 2, 0, "sablecoffee.example", "Roastery and tasting room by the common."),
  mk(16, "Night Owl Espresso", 1, 1925.0, 1810.0, 44, 260, 2, 6, "nightowl.example", "Espresso and desserts late into the night."),
  mk(17, "The Harbour Light Hotel", 2, 2525.0, 1530.0, 45, 1204, 4, 5, "harbourlight.example", "Rooms over the water, with a rooftop bar."),
  mk(18, "Crown Hill Inn", 2, 2525.0, 410.0, 43, 388, 2, 5, "crownhillinn.example", "A quiet inn on the hill above the market."),
  mk(19, "Wayside Rooms", 2, 280.0, 970.0, 40, 152, 1, 5, "waysiderooms.example", "Simple rooms at the west gate."),
  mk(20, "The Sable Grand", 2, 1520.0, 960.0, 46, 977, 4, 5, "sablegrand.example", "A grand hotel on the river bank."),
  mk(21, "Quayside Suites", 2, 2825.0, 1670.0, 44, 534, 3, 5, "quaysidesuites.example", "Apartments with harbour balconies."),
  mk(22, "Eastpoint Lodge", 2, 3300.0, 1110.0, 42, 211, 2, 5, "eastpointlodge.example", "Lodge rooms near the east station."),
  mk(23, "Port Lumen Maritime Museum", 3, 2375.0, 1950.0, 47, 1530, 1, 3, "maritime.example", "Ships, charts and the lighthouse lens."),
  mk(24, "Museum of Lamps", 3, 760.0, 410.0, 45, 640, 1, 3, "museumoflamps.example", "Three centuries of the city's lights."),
  mk(25, "Old Town Guildhall", 3, 905.0, 830.0, 44, 422, 1, 7, "guildhall.example", "The guilds' hall, with painted ceilings."),
  mk(26, "Lumen Gallery of Modern Art", 3, 2075.0, 830.0, 46, 870, 2, 3, "lumengallery.example", "Modern art in a converted power house."),
  mk(27, "Railway Heritage Hall", 3, 1250.0, 1250.0, 43, 305, 1, 3, "railheritage.example", "Engines and carriages of the harbour line."),
  mk(28, "Lantern Park", 4, 680.0, 1460.0, 46, 1880, 0, 4, "lanternpark.example", "Lawns, a bandstand and the lantern walk."),
  mk(29, "Ridge Gardens", 4, 2750.0, 340.0, 45, 760, 0, 4, "ridgegardens.example", "Terraced gardens with a view of the bay."),
  mk(30, "Quay Green", 4, 2000.0, 1990.0, 44, 512, 0, 4, "quaygreen.example", "A green by the water with a playground."),
  mk(31, "Sable Common", 4, 1190.0, 580.0, 43, 344, 0, 4, "sablecommon.example", "Meadows along the River Sable."),
  mk(32, "Crown Hill Park", 4, 3225.0, 340.0, 45, 690, 0, 4, "crownhillpark.example", "Woodland paths on the crown of the hill."),
  mk(33, "Westgate Station", 5, 350.0, 1250.0, 39, 410, 0, 5, "harbourline.example", "Harbour Line trains, every 10 minutes."),
  mk(34, "Mill Cross Station", 5, 950.0, 1200.0, 40, 265, 0, 5, "harbourline.example", "Harbour Line trains, every 10 minutes."),
  mk(35, "Lumen Central Station", 5, 1700.0, 900.0, 42, 2210, 0, 5, "harbourline.example", "The main station, with the ferry shuttle."),
  mk(36, "Crown Market Station", 5, 2450.0, 697.0, 41, 590, 0, 5, "harbourline.example", "Harbour Line trains, every 10 minutes."),
  mk(37, "Eastpoint Station", 5, 3450.0, 662.0, 40, 330, 0, 5, "harbourline.example", "End of the Harbour Line."),
  mk(38, "Harbour Ferry Terminal", 5, 2300.0, 2140.0, 43, 870, 0, 5, "lumenferries.example", "Ferries across Lumen Bay."),
  mk(39, "Bay Ferry Pier", 5, 3000.0, 1830.0, 41, 240, 0, 5, "lumenferries.example", "The east pier for the bay ferries."),
]

///|
/// Three routes drawn along the streets; any other pair gets a straight, dashed line.
let routes : Array[(Int, Int, Array[(Double, Double)], Array[String])] = [
  (
    35,
    17,
    [(1700.0, 900.0), (1700.0, 1040.0), (2300.0, 1040.0), (2300.0, 1600.0), (2525.0, 1600.0), (2525.0, 1530.0)],
    [
      "Head south on Lamplighter Way", "Turn left onto Harbour Avenue (7)", "Turn right onto Crown Avenue (12)",
      "Turn left onto Foundry Street", "Turn left; The Harbour Light Hotel is on the right",
    ],
  ),
  (
    33,
    23,
    [
      (350.0, 1250.0),
      (360.0, 1250.0),
      (360.0, 1320.0),
      (840.0, 1320.0),
      (840.0, 1776.0),
      (1700.0, 1260.0),
      (1700.0, 1600.0),
      (2300.0, 1600.0),
      (2300.0, 1880.0),
      (2375.0, 1880.0),
      (2375.0, 1950.0),
    ],
    [
      "Head south on Flint Lane", "Turn left onto Mill Street", "Turn right onto Chandler Street",
      "Turn left onto Lumen Avenue (1) and cross the Sable Bridge", "Turn right onto Lamplighter Way",
      "Turn left onto Foundry Street", "Turn right onto Crown Avenue (12)", "Turn left onto Dock Street",
      "Turn right; Port Lumen Maritime Museum is ahead",
    ],
  ),
  (
    9,
    28,
    [(1775.0, 1110.0), (1775.0, 1040.0), (840.0, 1040.0), (840.0, 1320.0), (680.0, 1320.0), (680.0, 1360.0)],
    [
      "Head north to Harbour Avenue (7)", "Turn left onto Harbour Avenue and cross the Harbour Bridge",
      "Turn left onto Chandler Street", "Turn right onto Mill Street", "Turn left into Lantern Park",
    ],
  ),
]

///|
let review_authors : Array[String] = [
  "Mara Okafor", "Tomas Lind", "Priya Raman", "Jonah Weller", "Ines Duarte", "Kenji Arai",
  "Hollis Grant", "Saoirse Byrne", "Amir Haddad", "Lena Vogt", "Rafael Moreno", "Ada Quist",
]

///|
let review_dates : Array[(String, Int)] = [
  ("Nov 9, 2026", 20261109),
  ("Nov 2, 2026", 20261102),
  ("Oct 24, 2026", 20261024),
  ("Oct 11, 2026", 20261011),
  ("Sep 28, 2026", 20260928),
  ("Sep 3, 2026", 20260903),
  ("Aug 17, 2026", 20260817),
  ("Jul 30, 2026", 20260730),
]

///|
let review_text : Array[Array[String]] = [
  [
    "The fish was perfectly cooked and the staff knew every wine on the list.",
    "Busy on a Friday, but the wait was worth it. Book ahead.",
    "Lovely room, slightly loud. The bread alone is worth the trip.",
    "Portions are generous and the desserts are excellent.",
    "Service was slow tonight, though the food made up for it.",
    "A reliable favourite; the specials change every week.",
  ],
  [
    "Best flat white in Port Lumen, and they remember your order.",
    "Bright, calm and plenty of seats in the morning.",
    "Great beans to take home. The pastries sell out by noon.",
    "A bit pricey, but the coffee is consistently good.",
    "Friendly baristas and a quiet corner to work in.",
    "Strong espresso; the oat milk options are good too.",
  ],
  [
    "Spotless room and a view straight across the harbour.",
    "Staff sorted out an early check-in without any fuss.",
    "Thin walls on our floor, otherwise a comfortable stay.",
    "Breakfast was the highlight: fresh and generous.",
    "Ideal for the station and the old town alike.",
    "Beds are comfortable and the lifts are quick.",
  ],
  [
    "Plan two hours at least. The top floor is the best part.",
    "Clear labels and a good audio guide for children.",
    "The temporary exhibition was small but very well made.",
    "Free on the first Sunday, so it gets crowded then.",
    "Friendly guides who clearly love the collection.",
    "The cafe on the ground floor is a nice place to rest.",
  ],
  [
    "Lovely in the evening, when the lanterns are lit.",
    "Plenty of benches and a clean playground.",
    "Good for a run; the loop is about two kilometres.",
    "Can be muddy after rain, so bring proper shoes.",
    "The flower beds by the gate are beautiful in spring.",
    "Quiet early in the morning, busy on weekends.",
  ],
  [
    "Trains are frequent and the platforms are easy to find.",
    "Clean station with step-free access to every platform.",
    "Ticket machines can be slow at rush hour.",
    "The ferry connection is well signposted.",
    "Helpful staff at the gate when my card failed.",
    "A bit draughty in winter, but always on time.",
  ],
]

///|
let amenities : Array[Array[String]] = [
  ["Wheelchair-accessible entrance", "Table service", "Vegetarian options", "Accepts cards"],
  ["Wheelchair-accessible entrance", "Free Wi-Fi", "Takeaway", "Outdoor seating"],
  ["Wheelchair-accessible lift", "Free Wi-Fi", "Breakfast available", "24-hour front desk"],
  ["Step-free access", "Audio guide", "Cafe", "Family friendly"],
  ["Step-free paths", "Public toilets", "Dogs allowed", "Playground"],
  ["Step-free platforms", "Ticket machines", "Bicycle parking", "Real-time departures"],
]

///|
let recent_searches : Array[String] = ["Coffee", "Port Lumen Maritime Museum", "Harbour Quarter"]

// ---------------------------------------------------------------- geometry

///|
fn interp(pts : Array[(Double, Double)], x : Double) -> Double {
  // y on a polyline that is monotonic in x
  let n = pts.length()
  if x <= pts[0].0 {
    return pts[0].1
  }
  for i = 1; i < n; i = i + 1 {
    let (x0, y0) = pts[i - 1]
    let (x1, y1) = pts[i]
    if x <= x1 {
      return y0 + (y1 - y0) * (x - x0) / (x1 - x0)
    }
  }
  pts[n - 1].1
}

///|
fn coast_y(x : Double) -> Double {
  interp(coast_pts, x)
}

///|
fn river_x(y : Double) -> Double {
  // the river is monotonic in y
  let n = river_pts.length()
  if y <= river_pts[0].1 {
    return river_pts[0].0
  }
  for i = 1; i < n; i = i + 1 {
    let (x0, y0) = river_pts[i - 1]
    let (x1, y1) = river_pts[i]
    if y <= y1 {
      return x0 + (x1 - x0) * (y - y0) / (y1 - y0)
    }
  }
  river_pts[n - 1].0
}

///|
fn seg_dist(px : Double, py : Double, a : (Double, Double), b : (Double, Double)) -> Double {
  let dx = b.0 - a.0
  let dy = b.1 - a.1
  let l2 = dx * dx + dy * dy
  let t0 = if l2 == 0.0 { 0.0 } else { ((px - a.0) * dx + (py - a.1) * dy) / l2 }
  let t = if t0 < 0.0 { 0.0 } else if t0 > 1.0 { 1.0 } else { t0 }
  let qx = a.0 + t * dx - px
  let qy = a.1 + t * dy - py
  (qx * qx + qy * qy).sqrt()
}

///|
fn line_dist(px : Double, py : Double, pts : Array[(Double, Double)]) -> Double {
  let mut best = 1.0e9
  for i = 1; i < pts.length(); i = i + 1 {
    let d = seg_dist(px, py, pts[i - 1], pts[i])
    if d < best {
      best = d
    }
  }
  best
}

///|
fn in_poly(px : Double, py : Double, poly : Array[(Double, Double)]) -> Bool {
  let n = poly.length()
  let mut inside = false
  let mut j = n - 1
  for i = 0; i < n; i = i + 1 {
    let (xi, yi) = poly[i]
    let (xj, yj) = poly[j]
    if (yi > py) != (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi {
      inside = !inside
    }
    j = i
  }
  inside
}

///|
/// The horizontal extent of an east-west street at y: from the west edge to where the coast comes up.
fn east_end(y : Double) -> Double {
  let mut x = 0.0
  while x < 3990.0 && coast_y(x + 10.0) > y + 30.0 {
    x = x + 10.0
  }
  if x >= 3990.0 {
    4000.0
  } else {
    x
  }
}

///|
/// Segments of a street, as world-coordinate pairs (start, end).
fn street_segments(s : Street) -> Array[((Double, Double), (Double, Double))] {
  if s.vertical {
    let x = s.at
    let bottom = coast_y(x) - 30.0
    // does the river cross this line?
    let mut cross = -1.0
    let mut y = 0.0
    while y < bottom {
      if (river_x(y) - x).abs() < 45.0 {
        cross = y
        break
      }
      y = y + 10.0
    }
    if cross < 0.0 {
      [((x, 0.0), (x, bottom))]
    } else {
      [((x, 0.0), (x, cross - 10.0))]
    }
  } else {
    let y = s.at
    let e = east_end(y)
    let rx = river_x(y)
    if s.kind == 2 || rx > e {
      [((0.0, y), (e, y))]
    } else {
      [((0.0, y), (rx - 48.0, y)), ((rx + 48.0, y), (e, y))]
    }
  }
}

///|
let lumen_avenue : Street = {
  name: "Lumen Avenue",
  kind: 2,
  vertical: false,
  at: -1.0,
  route: "1",
}

///|
fn place_area(p : Place) -> String {
  let mut best = ""
  let mut bd = 1.0e9
  for a in areas {
    let (n, ax, ay) = a
    let d = ((p.x - ax) * (p.x - ax) + (p.y - ay) * (p.y - ay)).sqrt()
    if d < bd {
      bd = d
      best = n
    }
  }
  best
}

///|
/// An address from the nearest street: number by the distance along it.
fn place_address(p : Place) -> String {
  let mut best = 1.0e9
  let mut name = ""
  let mut along = 0.0
  for s in streets {
    let d = if s.vertical { (p.x - s.at).abs() } else { (p.y - s.at).abs() }
    if d < best {
      best = d
      name = s.name
      along = if s.vertical { p.y } else { p.x }
    }
  }
  let n = (along / 20.0).to_int() + 1
  let num = if n % 2 == 0 { n + 1 } else { n }
  "\{num} \{name}"
}

///|
fn time_label(m : Int) -> String {
  let mm = m % 1440
  let h = mm / 60
  let mi = mm % 60
  if mm == 0 {
    return "Midnight"
  }
  if mm == 720 {
    return "Noon"
  }
  let ap = if h >= 12 { "PM" } else { "AM" }
  let h12 = if h % 12 == 0 { 12 } else { h % 12 }
  if mi == 0 {
    "\{h12} \{ap}"
  } else {
    let pad = if mi < 10 { "0" } else { "" }
    "\{h12}:\{pad}\{mi} \{ap}"
  }
}

///|
fn hours_label(day : (Int, Int)) -> String {
  let (o, c) = day
  if o < 0 {
    "Closed"
  } else if o == 0 && c == 1440 {
    "Open 24 hours"
  } else {
    "\{time_label(o)}\u{2013}\{time_label(c)}"
  }
}

///|
/// (open now, the rest of the status line)
fn open_status(p : Place) -> (Bool, String) {
  let h = hours_table[p.hours]
  let (o, c) = h[now_day]
  if o == 0 && c == 1440 {
    return (true, "Open 24 hours")
  }
  if o >= 0 && now_min >= o && now_min < c {
    return (true, "Closes \{time_label(c)}")
  }
  if o >= 0 && now_min < o {
    return (false, "Opens \{time_label(o)}")
  }
  // find the next day that opens
  for k = 1; k <= 7; k = k + 1 {
    let d = (now_day + k) % 7
    let (o2, _) = h[d]
    if o2 >= 0 {
      return (false, "Opens \{time_label(o2)} \{day_short[d]}")
    }
  }
  (false, "Closed")
}

///|
fn rating_str(r : Int) -> String {
  "\{r / 10}.\{r % 10}"
}

///|
fn price_str(n : Int) -> String {
  let mut s = ""
  for i = 0; i < n; i = i + 1 {
    s = s + "$"
  }
  s
}

///|
fn seeded(seed : Int) -> () -> Int {
  let st = Ref(seed * 7919 + 104729)
  fn() {
    st.val = (st.val * 1103515245 + 12345) & 0x7fffffff
    st.val / 65536
  }
}

///|
struct Review {
  author : String
  stars : Int
  date : String
  key : Int
  text : String
  order : Int
}

///|
fn place_reviews(p : Place) -> Array[Review] {
  let rnd = seeded(p.id + 3)
  let pool = review_text[p.cat]
  let out : Array[Review] = []
  let used_t : Array[Int] = []
  let used_a : Array[Int] = []
  for i = 0; i < 5; i = i + 1 {
    let mut t = rnd() % pool.length()
    while used_t.contains(t) {
      t = (t + 1) % pool.length()
    }
    used_t.push(t)
    let mut a = rnd() % review_authors.length()
    while used_a.contains(a) {
      a = (a + 1) % review_authors.length()
    }
    used_a.push(a)
    let d = rnd() % review_dates.length()
    // ratings close to the place's own
    let base = (p.rating + 5) / 10
    let wobble = rnd() % 3 - 1
    let s0 = base + wobble
    let stars = if s0 > 5 { 5 } else if s0 < 2 { 2 } else { s0 }
    let (ds, dk) = review_dates[d]
    out.push({ author: review_authors[a], stars, date: ds, key: dk, text: pool[t], order: i })
  }
  out
}

///|
fn world_dist(ax : Double, ay : Double, bx : Double, by : Double) -> Double {
  ((ax - bx) * (ax - bx) + (ay - by) * (ay - by)).sqrt()
}

///|
fn dist_label(m : Double) -> String {
  if m < 1000.0 {
    "\{((m / 10.0).round() * 10.0).to_int()} m"
  } else {
    "\{fmt1(m / 1000.0)} km"
  }
}
