// Seed data: fictional channels, videos, comments and captions. Every value a
// visitor sees is written here; nothing is drawn from a clock or an unseeded RNG.

///|
enum Topic {
  Space
  Cooking
  Music
  Travel
}

///|
fn Topic::key(self : Topic) -> String {
  match self {
    Space => "space"
    Cooking => "cooking"
    Music => "music"
    Travel => "travel"
  }
}

///|
fn Topic::label(self : Topic) -> String {
  match self {
    Space => "Space"
    Cooking => "Cooking"
    Music => "Music"
    Travel => "Travel"
  }
}

///|
struct Channel {
  name : String
  handle : String
  subs : String
  hue : Int
}

///|
struct Chapter {
  start : Int
  name : String
}

///|
struct Video {
  id : String
  title : String
  channel : Int
  views : Int
  age : String
  date : String
  duration : Int
  topic : Topic
  live : Bool
  recent : Bool
  blurb : String
  chapters : Array[Chapter]
  seed : Int
}

///|
let channels : Array[Channel] = [
  { name: "Orbit Notes", handle: "@orbitnotes", subs: "1.2M subscribers", hue: 228 },
  { name: "Lunar Field Lab", handle: "@lunarfieldlab", subs: "684K subscribers", hue: 262 },
  { name: "Small Kitchen Daily", handle: "@smallkitchen", subs: "2.1M subscribers", hue: 18 },
  { name: "Hearth & Pan", handle: "@hearthandpan", subs: "412K subscribers", hue: 38 },
  { name: "Tape Loop Club", handle: "@tapeloopclub", subs: "3.4M subscribers", hue: 300 },
  { name: "Brass Attic", handle: "@brassattic", subs: "96K subscribers", hue: 48 },
  { name: "Slow Rail Diaries", handle: "@slowrail", subs: "1.2M subscribers", hue: 172 },
  { name: "Harbour Lights Travel", handle: "@harbourlights", subs: "530K subscribers", hue: 200 },
]

///|
fn hash(s : String) -> Int {
  // FNV-style, in Double so no step overflows the 53-bit mantissa.
  let mut h = 7919.0
  for i = 0; i < s.length(); i = i + 1 {
    h = (h * 131.0 + s.code_unit_at(i).to_int().to_double()) % 2147483647.0
  }
  h.to_int()
}

///|
fn default_chapters(topic : Topic, duration : Int) -> Array[Chapter] {
  let names = match topic {
    Space => ["Intro", "What we can see", "The physics", "Field notes", "Wrap-up"]
    Cooking => ["Intro", "Ingredients", "Prep", "Cooking it", "Tasting"]
    Music => ["Intro", "The idea", "Building it up", "Full take", "Outro"]
    Travel => ["Departure", "The first stretch", "Arrival", "Wandering", "Heading home"]
  }
  let fractions = [0.0, 0.12, 0.34, 0.6, 0.86]
  let out : Array[Chapter] = []
  for i = 0; i < names.length(); i = i + 1 {
    out.push({ start: (fractions[i] * duration.to_double()).to_int(), name: names[i] })
  }
  out
}

///|
fn mk(
  id : String,
  title : String,
  channel : Int,
  views : Int,
  age : String,
  date : String,
  duration : Int,
  topic : Topic,
  blurb : String,
  live~ : Bool = false,
  recent~ : Bool = false,
  chapters~ : Array[Chapter] = [],
) -> Video {
  {
    id,
    title,
    channel,
    views,
    age,
    date,
    duration,
    topic,
    live,
    recent,
    blurb,
    chapters: if chapters.length() > 0 {
      chapters
    } else {
      default_chapters(topic, duration)
    },
    seed: hash(id),
  }
}

///|
let videos : Array[Video] = [
  mk(
    "far5ide", "How the Moon got its far side", 0, 2_400_000, "3 weeks ago", "Oct 22, 2026",
    581, Space, "The side of the moon we never see is older, thicker and scarred in a different way. We follow the evidence from orbit to the lab bench.",
    chapters=[
      { start: 0, name: "Intro" },
      { start: 62, name: "Two faces of one moon" },
      { start: 205, name: "Tidal locking" },
      { start: 340, name: "A thicker crust" },
      { start: 470, name: "What we still don't know" },
    ],
  ),
  mk(
    "lndmap2", "Moon landing sites, mapped from orbit", 1, 860_000, "2 months ago", "Sep 9, 2026",
    845, Space, "Six landing sites, photographed from a low orbit, with the tracks the crews left still visible in the dust.",
  ),
  mk(
    "meteor3", "A night of meteors over the salt flats", 0, 412_000, "5 days ago", "Nov 9, 2026",
    1350, Space, "We set up four cameras on a dry lake bed and counted every streak between dusk and dawn.",
    recent=true,
  ),
  mk(
    "scope90", "Building a backyard telescope for $90", 1, 1_100_000, "1 year ago", "Nov 2, 2025",
    1092, Space, "Cardboard, a second-hand mirror and an afternoon: a telescope good enough to see the rings of Saturn.",
  ),
  mk(
    "moonlv5", "Live: watching the moon rise over the bay", 0, 1_300, "Live now", "Nov 14, 2026",
    3600, Space, "A slow, quiet stream from the harbour wall as the full moon comes up over the water.",
    live=true,
  ),
  mk(
    "rings06", "Why Saturn's rings won't last forever", 1, 3_900_000, "4 years ago", "Jan 18, 2022",
    708, Space, "Ice falls from the rings into the planet every second. How long they have left, and how we know.",
  ),
  mk(
    "sour3dg", "Sourdough with only three ingredients", 2, 5_100_000, "2 years ago", "Aug 4, 2024",
    980, Cooking, "Flour, water and salt, and a starter you can begin tonight. No special tools beyond a bowl and a pot with a lid.",
  ),
  mk(
    "mncake8", "Moon cakes from scratch, step by step", 3, 702_000, "1 month ago", "Oct 12, 2026",
    754, Cooking, "Lotus seed paste, a salted yolk and a wooden mould: the autumn festival pastry, made slowly at home.",
  ),
  mk(
    "lemon09", "One-pan lemon pasta in 15 minutes", 2, 1_800_000, "8 months ago", "Mar 3, 2026",
    425, Cooking, "Starchy pasta water does the work. One pan, one lemon, and dinner before the kettle boils twice.",
  ),
  mk(
    "sauce10", "Fixing a split sauce (and why it splits)", 3, 233_000, "2 days ago", "Nov 12, 2026",
    598, Cooking, "A broken hollandaise rescued three ways, with what is going on inside the emulsion each time.",
    recent=true,
  ),
  mk(
    "dmplv11", "Live: Sunday dumpling session", 3, 2_100, "Live now", "Nov 14, 2026",
    3600, Cooking, "Folding dumplings together for an hour. Bring your own filling and your questions.",
    live=true,
  ),
  mk(
    "castir12", "The cast-iron care guide nobody wrote down", 2, 940_000, "3 years ago", "May 27, 2023",
    1216, Cooking, "Seasoning, rust, soap and the myths around all three, tested on a pan from a flea market.",
  ),
  mk(
    "tapelo13", "Lo-fi tape loops for late study", 4, 12_000_000, "1 year ago", "Oct 1, 2025",
    3720, Music, "An hour of warm, wobbling tape loops recorded on a four-track machine. No lyrics, no surprises.",
  ),
  mk(
    "bluemn14", "Blue Moon on a 1962 upright piano", 5, 388_000, "6 months ago", "May 20, 2026",
    252, Music, "A standard, played slowly on an old upright with a sticky middle C and a lot of character.",
  ),
  mk(
    "kitbt15", "Making a beat from kitchen sounds", 4, 1_400_000, "3 weeks ago", "Oct 24, 2026",
    644, Music, "Pots, a whisk and a dripping tap, sampled and chopped into a beat in under eleven minutes.",
  ),
  mk(
    "brass16", "Brass quintet plays the harbour at dawn", 5, 96_000, "1 day ago", "Nov 13, 2026",
    390, Music, "Five players, one pier and the first ferry of the morning as a sixth, unplanned voice.",
    recent=true,
  ),
  mk(
    "synlv17", "Live: synth jam, request a key", 4, 4_800, "Live now", "Nov 14, 2026",
    3600, Music, "A modular synth, a looper and the chat choosing the key every ten minutes.",
    live=true,
  ),
  mk(
    "drumm18", "How a drum machine keeps time", 5, 520_000, "2 years ago", "Jun 30, 2024",
    800, Music, "Inside a 1980s drum machine: the clock, the counter and the swing setting everyone loves.",
  ),
  mk(
    "ntrain19", "Night train from the mountains to the sea", 6, 2_200_000, "1 year ago", "Sep 14, 2025",
    1690, Travel, "Eleven hours in a sleeper cabin, from snow at the station to palm trees at breakfast.",
  ),
  mk(
    "island20", "Island hopping on a $20-a-day budget", 7, 3_300_000, "7 months ago", "Apr 11, 2026",
    1185, Travel, "Ferries, guesthouses and street food across five islands, with every receipt on screen.",
  ),
  mk(
    "fullmn21", "Chasing the full moon across three deserts", 6, 640_000, "4 days ago", "Nov 10, 2026",
    1442, Travel, "Three deserts, three nights, one moon: a road trip timed to the brightest week of the month.",
    recent=true,
  ),
  mk(
    "lighth22", "A rainy week in a lighthouse town", 7, 150_000, "2 weeks ago", "Oct 31, 2026",
    930, Travel, "Grey skies, a bakery with one table and the lighthouse keeper's daily walk to the lamp.",
  ),
  mk(
    "ferrlv23", "Live: ferry deck at golden hour", 7, 900, "Live now", "Nov 14, 2026",
    3600, Travel, "A camera on the top deck of the evening ferry, with the islands going pink one by one.",
    live=true,
  ),
  mk(
    "scenic24", "The slowest scenic railway, end to end", 6, 4_700_000, "5 years ago", "Jul 8, 2021",
    3123, Travel, "Fourteen miles an hour through valleys, tunnels and a station that sells one kind of cake.",
  ),
]

///|
fn find_video(id : String) -> Video {
  for v in videos {
    if v.id == id {
      return v
    }
  }
  videos[0]
}

///|
fn channel_of(v : Video) -> Channel {
  channels[v.channel]
}

///|
fn pad2(n : Int) -> String {
  if n < 10 {
    "0\{n}"
  } else {
    n.to_string()
  }
}

///|
fn fmt_time(secs : Int) -> String {
  let s = if secs < 0 { 0 } else { secs }
  let h = s / 3600
  let m = s % 3600 / 60
  let r = s % 60
  if h > 0 {
    "\{h}:\{pad2(m)}:\{pad2(r)}"
  } else {
    "\{m}:\{pad2(r)}"
  }
}

///|
fn one_decimal(n : Int, unit : Int, suffix : String) -> String {
  let whole = n / unit
  if whole >= 100 {
    "\{whole}\{suffix}"
  } else {
    let tenth = n % unit * 10 / unit
    if tenth == 0 {
      "\{whole}\{suffix}"
    } else {
      "\{whole}.\{tenth}\{suffix}"
    }
  }
}

///|
fn compact(n : Int) -> String {
  if n >= 1_000_000 {
    one_decimal(n, 1_000_000, "M")
  } else if n >= 1_000 {
    one_decimal(n, 1_000, "K")
  } else {
    n.to_string()
  }
}

///|
fn with_commas(n : Int) -> String {
  let s = n.to_string()
  let out = StringBuilder::new()
  let len = s.length()
  for i = 0; i < len; i = i + 1 {
    if i > 0 && (len - i) % 3 == 0 {
      out.write_char(',')
    }
    out.write_char(s.code_unit_at(i).unsafe_to_char())
  }
  out.to_string()
}

///|
fn views_line(v : Video) -> String {
  if v.live {
    "\{compact(v.views)} watching"
  } else {
    "\{compact(v.views)} views"
  }
}

///|
fn duration_badge(v : Video) -> String {
  if v.live {
    "LIVE"
  } else {
    fmt_time(v.duration)
  }
}

///|
fn description_of(v : Video) -> String {
  let ch = channel_of(v)
  let tail = match v.topic {
    Space => "Filmed with amateur gear and checked against published data. Corrections go in a pinned comment."
    Cooking => "Quantities are in the pinned comment, in grams and in cups. Cook along and tell us how it went."
    Music => "Recorded in one room with two microphones. Every track in this video was made for it."
    Travel => "No sponsors on this trip: every ticket and bed was paid for, and every price is the one we paid."
  }
  "\{v.blurb} \{tail} New uploads from \{ch.name} arrive most weeks; the chapters below jump straight to each part."
}

///|
fn caption_at(v : Video, t : Int) -> String {
  let lines = match v.topic {
    Space => [
      "So tonight the sky is finally clear.", "You can see the terminator, the line between day and night.",
      "Those dark patches are old lava plains.", "Let's zoom in on the crater rim.",
      "Notice how sharp the shadows are up here.", "Nothing softens light on an airless world.",
      "Give it a few minutes and it'll climb higher.", "That faint glow is earthshine.",
    ]
    Cooking => [
      "Okay, the pan is properly hot now.", "Don't move it yet, let it brown.",
      "A pinch more salt than you think.", "Smell that? That's when you lower the heat.",
      "Fold, don't stir, or it goes tough.", "Taste it now, before it reduces.",
      "A splash of the pasta water here.", "And it all comes together.",
    ]
    Music => [
      "[soft tape hiss]", "This loop is about four seconds long.", "[warm chord, slightly detuned]",
      "Listen to how it drifts out of time.", "I'm adding the second voice now.",
      "[a quiet drum enters]", "That wobble is the motor, not a plug-in.", "[the loop fades back in]",
    ]
    Travel => [
      "We're just pulling out of the station.", "The valley opens up right about here.",
      "Twenty minutes until the next stop.", "The conductor says it rains here daily.",
      "That's the old bridge, built in 1904.", "We'll get off at the harbour.",
      "Breakfast was bread, cheese and strong coffee.", "And there's the sea.",
    ]
  }
  let i = (t / 4 + v.seed % 5) % lines.length()
  lines[i]
}

///|
fn chapter_index(v : Video, t : Int) -> Int {
  let mut idx = 0
  for i = 0; i < v.chapters.length(); i = i + 1 {
    if v.chapters[i].start <= t {
      idx = i
    }
  }
  idx
}

///|
struct Comment {
  id : Int
  author : String
  age : String
  order : Int
  text : String
  likes : Int
  replies : Array[(String, String, String)]
}

///|
fn seed_comments(v : Video) -> Array[Comment] {
  let base : Array[Comment] = [
    { id: 1, author: "@quietcomet", age: "2 weeks ago", order: 9, text: "The pacing on this is perfect. I watched it twice and noticed new things the second time.", likes: 1840, replies: [
        ("@marigold.k", "2 weeks ago", "Same here. The second half lands better once you know where it's going."),
        ("@orbitnotes", "2 weeks ago", "Thank you! That second half took the longest to edit."),
      ] },
    { id: 2, author: "@paperlantern", age: "3 weeks ago", order: 11, text: "Chapters made this so easy to come back to. More creators should do this.", likes: 1210, replies: [] },
    { id: 3, author: "@ferris.wheel", age: "1 week ago", order: 7, text: "I put this on in the background and ended up just watching the whole thing.", likes: 932, replies: [
        ("@lowtide", "6 days ago", "That's how it always goes."),
      ] },
    { id: 4, author: "@sunday_baker", age: "5 days ago", order: 5, text: "Small correction: the number on screen at about the four minute mark is off by one. Still a great video.", likes: 611, replies: [
        ("@quietcomet", "5 days ago", "Good catch, I thought I misheard."),
        ("@deltawing", "4 days ago", "It's in the pinned comment now."),
        ("@pebble.road", "4 days ago", "Love that they actually fix these."),
      ] },
    { id: 5, author: "@nightowl.radio", age: "4 days ago", order: 4, text: "The sound design is so calm. What microphone was this recorded with?", likes: 420, replies: [] },
    { id: 6, author: "@marigold.k", age: "3 days ago", order: 3, text: "Watching this on the train home. Perfect length for one journey.", likes: 318, replies: [] },
    { id: 7, author: "@lowtide", age: "1 month ago", order: 12, text: "Been following since the early uploads. The quality just keeps going up.", likes: 277, replies: [
        ("@paperlantern", "1 month ago", "The early ones have their own charm though."),
      ] },
    { id: 8, author: "@deltawing", age: "2 days ago", order: 2, text: "Can you do a follow-up on the part you skipped near the end?", likes: 190, replies: [] },
    { id: 9, author: "@pebble.road", age: "1 day ago", order: 1, text: "Showed this to my kids and now they want to try it this weekend.", likes: 156, replies: [] },
    { id: 10, author: "@greenkettle", age: "3 weeks ago", order: 10, text: "The thumbnail undersold this. Way better than I expected.", likes: 98, replies: [] },
    { id: 11, author: "@tinycompass", age: "12 hours ago", order: 0, text: "First time here. Subscribed after the intro.", likes: 64, replies: [] },
    { id: 12, author: "@slate.and.chalk", age: "1 week ago", order: 6, text: "Saving this for the weekend when I can give it proper attention.", likes: 41, replies: [] },
  ]
  // Rotate the likes a little per video so two watch pages do not read as one.
  let shift = v.seed % 7
  base.map(fn(c) { { ..c, likes: c.likes + shift * 13 } })
}

///|
let recent_searches : Array[String] = [
  "moon landing", "sourdough starter", "lo-fi tape loops", "night train", "telescope for beginners",
  "lemon pasta",
]

///|
fn lower(s : String) -> String {
  s.to_lower()
}

///|
fn matches_query(v : Video, q : String) -> Bool {
  let ql = lower(q)
  if ql == "" {
    return true
  }
  lower(v.title).contains(ql) ||
  lower(channel_of(v).name).contains(ql) ||
  lower(v.blurb).contains(ql) ||
  v.topic.key().contains(ql)
}
