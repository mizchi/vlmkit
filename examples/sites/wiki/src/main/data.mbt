// Seeded data: the 30 titles search and previews know, the infobox, languages, history, talk.

///|
struct Title {
  title : String
  desc : String // one line, shown in search suggestions
  extract : String // two sentences, shown in page previews and on the stub
  thumb : String // drawing kind for the thumbnail
}

///|
let titles : Array[Title] = [
  { title: "Moon", desc: "Natural satellite of Earth", thumb: "moon", extract: "The Moon is Earth's only natural satellite. It orbits at an average distance of about 384,400 km and always shows the same face." },
  { title: "Earth", desc: "Third planet from the Sun", thumb: "earth", extract: "Earth is the third planet from the Sun and the only one known to hold liquid water on its surface. It is orbited by a single large moon." },
  { title: "Sun", desc: "Star at the centre of the Solar System", thumb: "sun", extract: "The Sun is the star around which Earth and the other planets orbit. Its light, reflected by the Moon, is what makes moonlight." },
  { title: "Natural satellite", desc: "Body that orbits a planet or smaller body", thumb: "orbit", extract: "A natural satellite is a body that orbits a planet, dwarf planet or asteroid. Hundreds are known in the Solar System." },
  { title: "Tide", desc: "Rise and fall of sea levels", thumb: "wave", extract: "Tides are the regular rise and fall of the sea. They are raised mainly by the Moon's gravity, and to a lesser extent by the Sun's." },
  { title: "Tidal locking", desc: "Rotation matched to an orbital period", thumb: "orbit", extract: "Tidal locking is the state in which a body turns once on its axis for every orbit. A locked moon always shows the same face to its planet." },
  { title: "Lunar phase", desc: "The Moon's changing lit shape", thumb: "phase", extract: "The lunar phase is the shape of the sunlit part of the Moon as seen from Earth. A full cycle of phases takes about 29.5 days." },
  { title: "Solar eclipse", desc: "The Moon passing in front of the Sun", thumb: "eclipse", extract: "A solar eclipse happens when the Moon passes between Earth and the Sun. In a total eclipse the Sun's faint outer atmosphere becomes visible." },
  { title: "Lunar eclipse", desc: "The Moon passing into Earth's shadow", thumb: "blood", extract: "A lunar eclipse happens when the full Moon moves into Earth's shadow. During totality the Moon glows a coppery red." },
  { title: "Impact crater", desc: "Depression made by a collision", thumb: "crater", extract: "An impact crater is a bowl-shaped hollow made when a smaller body strikes a larger one. The Moon's surface is covered in them." },
  { title: "Lunar mare", desc: "Dark basaltic plain on the Moon", thumb: "mare", extract: "A lunar mare is a broad, dark plain of solidified lava. Early observers mistook the maria for seas, and the name stuck." },
  { title: "Regolith", desc: "Loose layer of broken rock and dust", thumb: "rock", extract: "Regolith is the loose layer of dust and broken rock that covers solid bedrock. On the Moon it was made by billions of years of small impacts." },
  { title: "Giant-impact hypothesis", desc: "Leading model of the Moon's origin", thumb: "impact", extract: "The giant-impact hypothesis holds that the Moon formed from debris of a collision between the young Earth and a Mars-sized body. It explains the Moon's small core and Earth-like rocks." },
  { title: "Orbit", desc: "Curved path of one body around another", thumb: "orbit", extract: "An orbit is the curved path that one body follows around another under gravity. The Moon's orbit around Earth is a slightly stretched ellipse." },
  { title: "Lunar calendar", desc: "Calendar based on the Moon's phases", thumb: "calendar", extract: "A lunar calendar counts months by the cycle of the Moon's phases. Several religious and civil calendars still use one." },
  { title: "Apsis", desc: "Nearest or farthest point of an orbit", thumb: "orbit", extract: "An apsis is the point at which an orbiting body is nearest to or farthest from the body it orbits. For the Moon these are perigee and apogee." },
  { title: "Libration", desc: "Apparent wobble of the Moon", thumb: "moon", extract: "Libration is the slight rocking motion of the Moon as seen from Earth. It lets observers see a little more than half of the surface over time." },
  { title: "Selenography", desc: "Study of the Moon's surface features", thumb: "map", extract: "Selenography is the mapping and description of the Moon's surface. Its name comes from the Greek word for the Moon." },
  { title: "Planetary differentiation", desc: "Separation of a body into layers", thumb: "layers", extract: "Planetary differentiation is the process by which a molten body separates into layers of different density. It gave the Moon its crust, mantle and core." },
  { title: "Basalt", desc: "Fine-grained volcanic rock", thumb: "rock", extract: "Basalt is a dark, fine-grained rock formed from cooled lava. It makes up the floors of the lunar maria." },
  { title: "Anorthosite", desc: "Pale rock of the lunar highlands", thumb: "rock", extract: "Anorthosite is a pale rock made mostly of a calcium-rich mineral. It forms the bright crust of the Moon's highlands." },
  { title: "Far side of the Moon", desc: "Hemisphere never seen from Earth", thumb: "farside", extract: "The far side of the Moon is the hemisphere that always faces away from Earth. It is more heavily cratered and has very few maria." },
  { title: "Lunar south pole", desc: "Region of permanent shadow and ice", thumb: "crater", extract: "The lunar south pole is a region of deep craters whose floors never see sunlight. It is thought to hold water ice." },
  { title: "Lunar water", desc: "Ice and water bound in lunar soil", thumb: "ice", extract: "Lunar water is water present on the Moon as ice in shadowed craters and bound in the soil. It could one day supply visitors with water and fuel." },
  { title: "Exosphere", desc: "Extremely thin outer atmosphere", thumb: "moon", extract: "An exosphere is an atmosphere so thin that its atoms rarely meet. The Moon's has a total mass of only a few tonnes." },
  { title: "Earthshine", desc: "Sunlight reflected from Earth onto the Moon", thumb: "phase", extract: "Earthshine is the faint glow on the dark part of a crescent Moon. It is sunlight reflected from Earth onto the Moon and back again." },
  { title: "Telescope", desc: "Instrument for viewing distant objects", thumb: "telescope", extract: "A telescope gathers and focuses light to show distant objects in more detail. Some of the first telescopic drawings were of the Moon." },
  { title: "Space probe", desc: "Uncrewed spacecraft sent beyond Earth", thumb: "probe", extract: "A space probe is an uncrewed spacecraft sent to study other worlds. Probes were the first visitors to the Moon." },
  { title: "Lunar month", desc: "Time between two new moons", thumb: "calendar", extract: "A lunar month is the time between two successive new moons, about 29.5 days. It is the basis of the lunar calendar." },
  { title: "Moonquake", desc: "Seismic tremor on the Moon", thumb: "wave", extract: "A moonquake is a tremor in the Moon's crust. Some last far longer than earthquakes, because the dry rock rings like a bell." },
]

///|
fn find_title(t : String) -> Title? {
  for it in titles {
    if it.title == t {
      return Some(it)
    }
  }
  None
}

///|
struct InfoRow {
  label : String
  value : String
}

///|
struct InfoSec {
  head : String
  rows : Array[InfoRow]
}

///|
let infobox : Array[InfoSec] = [
  {
    head: "Designations",
    rows: [
      { label: "Designation", value: "Earth I" },
      { label: "Adjectives", value: "Lunar, selenic" },
      { label: "Symbol", value: "☾" },
    ],
  },
  {
    head: "Orbital characteristics",
    rows: [
      { label: "Epoch", value: "J2000" },
      { label: "Perigee", value: "363,300 km" },
      { label: "Apogee", value: "405,500 km" },
      { label: "Semi-major axis", value: "384,399 km" },
      { label: "Eccentricity", value: "0.0549" },
      { label: "Orbital period", value: "27.32 days (sidereal)" },
      { label: "Synodic period", value: "29.53 days" },
      { label: "Inclination", value: "5.145° to the ecliptic" },
      { label: "Satellite of", value: "Earth" },
    ],
  },
  {
    head: "Physical characteristics",
    rows: [
      { label: "Mean radius", value: "1,737.4 km" },
      { label: "Surface area", value: "3.793 × 10⁷ km²" },
      { label: "Mass", value: "7.342 × 10²² kg" },
      { label: "Mean density", value: "3.344 g/cm³" },
      { label: "Surface gravity", value: "1.62 m/s² (0.165 g)" },
      { label: "Rotation period", value: "Synchronous" },
      { label: "Albedo", value: "0.12" },
      { label: "Surface temp.", value: "−173 to 127 °C" },
    ],
  },
]

///|
let suggested_languages : Array[String] = ["Velorian", "Caldish", "Ostrene"]

///|
let languages : Array[String] = [
  "Aurenne", "Belisk", "Brannic", "Caldish", "Corvane", "Dravic", "Elunni",
  "Eskaro", "Fenmarri", "Galoric", "Harrowese", "Ilvaran", "Istrel", "Jorvic",
  "Kessane", "Lorvish", "Lumbrese", "Marrish", "Mirandese", "Nevari", "Nordavi",
  "Orlandic", "Ostrene", "Pellish", "Praxian", "Quenti", "Quillon", "Rhovan",
  "Ruvessic", "Saquenti", "Selvane", "Sorvish", "Tavenic", "Thaloric", "Tirelli",
  "Umbric", "Vashti", "Velorian", "Wendic", "Yarrovan", "Zelandic",
]

///|
struct Revision {
  date : String
  user : String
  size : String
  delta : String
  summary : String
}

///|
let history : Array[Revision] = [
  { date: "3 November 2026, 14:12", user: "Selene Arkwright", size: "61,204", delta: "+88", summary: "Copyedit of the tidal-locking subsection" },
  { date: "28 October 2026, 09:40", user: "Halvard Ostrom", size: "61,116", delta: "−312", summary: "Removed a duplicated sentence about libration" },
  { date: "21 October 2026, 22:05", user: "Mirela Duca", size: "61,428", delta: "+1,046", summary: "Expanded Robotic missions; added a reference" },
  { date: "14 October 2026, 17:31", user: "Selene Arkwright", size: "60,382", delta: "+12", summary: "Fixed a typo in the infobox" },
  { date: "2 October 2026, 08:18", user: "Tobias Wren", size: "60,370", delta: "+640", summary: "New figure: Earth over the lunar horizon" },
  { date: "19 September 2026, 13:57", user: "Ana Lisboa", size: "59,730", delta: "−58", summary: "Tidied the See also list" },
  { date: "7 September 2026, 19:22", user: "Halvard Ostrom", size: "59,788", delta: "+2,210", summary: "Rewrote Formation and evolution from newer sources" },
  { date: "30 August 2026, 11:03", user: "Ivo Petrak", size: "57,578", delta: "+3", summary: "Corrected the synodic period" },
  { date: "12 August 2026, 16:44", user: "Mirela Duca", size: "57,575", delta: "+415", summary: "Added the Eclipses subsection" },
  { date: "1 August 2026, 10:09", user: "Tobias Wren", size: "57,160", delta: "+57,160", summary: "Created the article" },
]

///|
struct Thread {
  topic : String
  posts : Array[(String, String)] // (author and date, text)
}

///|
let talk : Array[Thread] = [
  {
    topic: "Is 'dark side' worth a mention?",
    posts: [
      ("Ana Lisboa, 18 October 2026", "The Tidal locking subsection explains the far side well, but readers still search for 'dark side'. Should the phrase appear in bold?"),
      ("Selene Arkwright, 19 October 2026", "It is mentioned once already, as a common misnomer. I would keep it out of bold so the article does not appear to endorse it."),
    ],
  },
  {
    topic: "Source for the crater counts",
    posts: [
      ("Ivo Petrak, 2 November 2026", "Reference 9 is from 2011. Is there a more recent review we could cite alongside it?"),
    ],
  },
]
