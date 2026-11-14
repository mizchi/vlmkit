// The article "Moon", written for Lexipedia. Inline markup in paragraphs:
//   [[Title]] or [[Title|label]]  internal link (opens a stub, shows a page preview)
//   {n}                           reference n (superscript [n], shows the reference)
//   **bold**  //italic//

///|
struct Sub {
  id : String
  title : String
  paras : Array[String]
}

///|
struct Sec {
  id : String
  title : String
  paras : Array[String]
  subs : Array[Sub]
  fig : Int // index into figures, -1 for none
}

///|
let hatnote : String = "This article is about Earth's natural satellite. For moons in general, see [[Natural satellite]]. For the unit of time, see [[Lunar month]]."

///|
let lead : Array[String] = [
  "The **Moon** is [[Earth]]'s only [[Natural satellite|natural satellite]] and the fifth-largest moon in the Solar System. It circles Earth at an average distance of about 384,400 kilometres, roughly thirty times the planet's diameter, and completes one [[Orbit|orbit]] in a little over 27 days.{1} Because it turns once on its axis in the same time, the same face is always turned towards Earth, a state known as [[Tidal locking|tidal locking]].",
  "Seen from the ground, the Moon is the brightest object in the night sky. Its apparent shape changes over a [[Lunar month|lunar month]] of about 29.5 days as the half lit by the [[Sun]] turns towards or away from us, giving the familiar cycle of [[Lunar phase|phases]].{2} Dark plains of solidified lava, the [[Lunar mare|maria]], cover about a sixth of the surface and form the patterns that many cultures have read as a face, a hare or a woman carrying sticks. The rest is pale, heavily cratered highland.",
  "The Moon is thought to have formed about 4.5 billion years ago from debris thrown into orbit when a body roughly the size of Mars struck the young Earth.{3} Its gravity raises the ocean [[Tide|tides]], slowly lengthens Earth's day and steadies the tilt of Earth's axis. It is the only body beyond Earth on which people have walked, and since the 2000s it has again become a destination for robotic missions and plans for long-term crewed bases.",
]

///|
let sections : Array[Sec] = [
  {
    id: "Name_and_etymology",
    title: "Name and etymology",
    fig: -1,
    paras: [
      "The English word //moon// descends from an old Germanic root shared with the word for //month//, a reminder that the two were once the same measure. Both trace back to an older word meaning 'to measure', since the Moon's cycle was among the first clocks people kept.{4}",
      "Scholarly writing uses the adjective //lunar//, from the Latin name of the Moon, and occasionally //selenic//, from the Greek. The study of the Moon's surface is accordingly called [[Selenography|selenography]], and a point in a lunar orbit closest to the Moon is a perilune. Because many planets have moons of their own, astronomers capitalise the name when they mean Earth's companion, and sometimes call it by its catalogue designation, Earth I.",
    ],
    subs: [],
  },
  {
    id: "Formation_and_evolution",
    title: "Formation and evolution",
    fig: -1,
    paras: [
      "Any account of the Moon's origin has to explain three facts: its rocks have almost the same isotopic make-up as Earth's mantle, it has a very small iron core, and the Earth–Moon pair carries an unusually large amount of angular momentum.",
    ],
    subs: [
      {
        id: "Giant_impact",
        title: "Giant impact",
        paras: [
          "The [[Giant-impact hypothesis|giant-impact hypothesis]] proposes that, a few tens of millions of years after the planets began to form, a Mars-sized body collided with Earth at a glancing angle. The impact melted and vaporised much of both bodies' outer layers, and a disc of hot rock gathered in orbit around the damaged planet.{3} Within perhaps a century the material in that disc had collected into a single moon.",
          "Computer models of the collision reproduce the Moon's small core and its share of angular momentum, but early versions predicted a Moon made mostly of the impactor, which does not match the close isotopic match with Earth. Later models favour a more energetic impact that thoroughly mixed the two bodies, or a series of smaller collisions.{5}",
        ],
      },
      {
        id: "Later_evolution",
        title: "Later evolution",
        paras: [
          "The young Moon was covered by an ocean of molten rock hundreds of kilometres deep. As it cooled, dense minerals sank and light, calcium-rich crystals floated to the top, forming the pale crust of the highlands from a rock called [[Anorthosite|anorthosite]]. This separation into layers is an example of [[Planetary differentiation|planetary differentiation]].{6}",
          "For the next several hundred million years the surface was struck repeatedly by asteroids, carving the great basins. Heat from radioactive elements later melted pockets of the interior, and lava rose through the fractured basin floors to flood them. These eruptions, which were most active between about 3.8 and 3.1 billion years ago, produced the dark [[Basalt|basalt]] of the maria. Since then the Moon has changed only through impacts and the slow grinding of its surface into dust.",
        ],
      },
    ],
  },
  {
    id: "Physical_characteristics",
    title: "Physical characteristics",
    fig: -1,
    paras: [
      "The Moon is a nearly round body with a mean radius of 1,737 kilometres, slightly more than a quarter of Earth's. Its mass is about 1.2 per cent of Earth's, so the surface gravity is only about a sixth as strong: a person who can jump half a metre on Earth could clear three metres there.{7}",
    ],
    subs: [
      {
        id: "Internal_structure",
        title: "Internal structure",
        paras: [
          "Like Earth, the Moon is divided into a crust, a mantle and a core. The crust averages roughly 40 kilometres thick and is thicker on the far side than on the near side. The mantle makes up most of the volume, and seismic readings from instruments left on the surface suggest that its lowest part may be partly molten.{8}",
          "The core is small, with a radius of perhaps 350 kilometres, and probably consists of a solid iron-rich centre wrapped in a fluid layer. The Moon has no global magnetic field today, but magnetised rocks show that it once generated one. Occasional shallow [[Moonquake|moonquakes]], some lasting for many minutes, are still recorded, caused by tidal stress and by the slow cooling and shrinking of the interior.",
        ],
      },
      {
        id: "Surface",
        title: "Surface",
        paras: [
          "Almost every part of the surface is marked by [[Impact crater|impact craters]], from basins more than 2,000 kilometres across to pits smaller than a grain of sand. With no wind or rain to erase them, craters survive for billions of years, so counting them is one of the main ways of dating a region: the more craters, the older the ground.{9}",
          "The surface is blanketed by [[Regolith|regolith]], a layer of loose, sharp-edged fragments and fine dust made by countless small impacts. It is a few metres deep on the maria and deeper in the highlands. The dust clings to everything; it scratched visors, jammed seals and caused hay-fever-like symptoms in astronauts who carried it back into their cabins.",
        ],
      },
      {
        id: "Atmosphere_and_water",
        title: "Atmosphere and water",
        paras: [
          "The Moon has no atmosphere in the everyday sense. What surrounds it is an [[Exosphere|exosphere]] so thin that its atoms rarely collide with one another; its total mass is estimated at less than ten tonnes. Without the shelter of air, the surface swings from about 127 °C in the lunar day to −173 °C at night.{10}",
          "Craters near the poles have floors that sunlight has not reached for billions of years and are among the coldest places measured in the Solar System. Several orbiting instruments have found signs that these craters hold water ice, and small amounts of water are also bound into the soil elsewhere.{11} [[Lunar water]] is valued as a possible source of drinking water, oxygen and rocket fuel for future visitors.",
        ],
      },
    ],
  },
  {
    id: "Orbit_and_rotation",
    title: "Orbit and rotation",
    fig: 0,
    paras: [
      "The Moon's orbit is slightly elliptical, bringing it as close as about 363,000 kilometres at perigee and as far as 405,000 kilometres at apogee, the two [[Apsis|apsides]] of its path. Its orbital plane is tilted by about five degrees to the plane of Earth's orbit around the Sun.{12}",
    ],
    subs: [
      {
        id: "Tidal_locking",
        title: "Tidal locking",
        paras: [
          "Earth's gravity long ago slowed the Moon's spin until one rotation took exactly as long as one orbit. As a result only one hemisphere, the near side, is ever seen from Earth. Because the orbit is not quite circular and is tilted, the Moon appears to rock slightly from side to side and up and down, an effect called [[Libration|libration]] that lets observers see about 59 per cent of the surface over time.{1}",
          "The hemisphere that always faces away, the [[Far side of the Moon|far side]], is sometimes wrongly called the dark side. It receives just as much sunlight; it is simply never visible from Earth, and it was first photographed by a spacecraft only in the middle of the twentieth century.",
        ],
      },
      {
        id: "Phases",
        title: "Phases",
        paras: [
          "Half of the Moon is always lit by the Sun, but the share of that half we can see changes as the Moon moves around Earth. At new moon the lit side faces away and the Moon is lost in the Sun's glare; it then grows through crescent, first quarter and gibbous to full, and shrinks back again.{2} A full cycle of [[Lunar phase|phases]] takes 29.5 days, two days longer than the orbit itself, because Earth has moved along its own path around the Sun in the meantime.",
          "When the Moon is a thin crescent, the unlit part is often faintly visible. This glow, called [[Earthshine|earthshine]], is sunlight reflected from Earth's clouds and oceans onto the Moon and back again.",
        ],
      },
      {
        id: "Eclipses",
        title: "Eclipses",
        paras: [
          "By coincidence, the Sun is about 400 times wider than the Moon and also about 400 times farther away, so the two appear almost exactly the same size in the sky. When the Moon passes directly between Earth and the Sun it can cover the solar disc completely, producing a total [[Solar eclipse|solar eclipse]] in which the faint outer atmosphere of the Sun becomes visible.{13}",
          "When Earth passes between the Sun and the full Moon, the Moon moves into Earth's shadow. During a total [[Lunar eclipse|lunar eclipse]] it does not vanish but turns a deep copper red, lit only by sunlight that has been bent and filtered through Earth's atmosphere. Because the lunar orbit is tilted, eclipses do not happen every month but only when a new or full moon falls near one of the two points where the orbits cross.",
        ],
      },
    ],
  },
  {
    id: "Effect_on_Earth",
    title: "Effect on Earth",
    fig: -1,
    paras: [
      "The pull of the Moon is stronger on the side of Earth facing it than on the far side, and the difference stretches the planet slightly along the line between them. The oceans respond most visibly, rising in two bulges that the rotating Earth carries each place through twice a day: the [[Tide|tides]].{14} The Sun raises tides as well, a little under half as strong; when the two pull in line, at new and full moon, the range between high and low water is greatest.",
      "Friction between the tidal bulges and the turning Earth acts as a brake. The day lengthens by about two milliseconds each century, and the angular momentum Earth loses is passed to the Moon, which drifts outward by nearly four centimetres a year. The Moon's steady pull also limits wobbles in the tilt of Earth's axis, which may have helped keep the planet's climate more stable over long periods.",
    ],
    subs: [],
  },
  {
    id: "Observation",
    title: "Observation",
    fig: -1,
    paras: [
      "The Moon is easy to observe and rewarding at every level of equipment. Its brightness varies greatly with phase: the full Moon is roughly ten times brighter than the half Moon, because at full phase the shadows between grains of soil disappear.",
    ],
    subs: [
      {
        id: "Naked-eye_features",
        title: "Naked-eye features",
        paras: [
          "Without any optical aid, the maria and the brighter highlands are plainly visible, along with the bright rays that spread from a few young craters. The Moon also looks larger near the horizon than high in the sky, although its measured size barely changes; this is an illusion of perception rather than of the atmosphere.{15}",
        ],
      },
      {
        id: "Telescopic_study",
        title: "Telescopic study",
        paras: [
          "The first drawings of the Moon made with a [[Telescope|telescope]] showed mountains and craters and helped to overturn the old belief that the heavens were made of perfect, unblemished spheres. Even a small instrument reveals thousands of craters, long valleys called rilles and the shadows of mountains at the line between day and night, where the low sunlight exaggerates every slope.",
          "Mapping and naming these features became the work of [[Selenography|selenography]]. By convention, maria carry Latin names for weather and states of mind, such as calm, rains or serenity, and craters are named after scientists, scholars and explorers.",
        ],
      },
    ],
  },
  {
    id: "Exploration",
    title: "Exploration",
    fig: 1,
    paras: [
      "The Moon was the first world beyond Earth to be reached by spacecraft. Exploration began with simple impactors and fly-bys and moved quickly to orbiters, landers and finally crewed expeditions.",
    ],
    subs: [
      {
        id: "Robotic_missions",
        title: "Robotic missions",
        paras: [
          "Early [[Space probe|space probes]] returned the first close views of the surface, the first images of the far side and the first soft landings, which showed that the ground would bear the weight of a spacecraft. Later orbiters mapped the whole globe in detail, measured its gravity field and searched for ice in the shadowed polar craters.{16}",
          "Since the 2000s several space agencies have flown orbiters, landers and small rovers, including the first landing on the far side and the first return of samples in decades. Much current interest centres on the [[Lunar south pole|lunar south pole]], where ice and near-constant sunlight on some crater rims could support a long-term outpost.",
        ],
      },
      {
        id: "Crewed_landings",
        title: "Crewed landings",
        paras: [
          "Between 1969 and 1972, twelve astronauts walked on the Moon during six landings. They set up experiments, drove electric rovers across the plains and brought back about 382 kilograms of rock and soil, which are still being studied with instruments that did not exist at the time.{8}",
          "No one has returned since, but several programmes now plan to land crews again, this time near the south pole, and to build orbiting stations and surface habitats that could be visited for weeks or months at a time.",
        ],
      },
    ],
  },
  {
    id: "In_culture",
    title: "In culture",
    fig: -1,
    paras: [
      "The Moon's regular cycle made it one of humanity's earliest timekeepers. Many societies counted months from one new moon to the next, and a [[Lunar calendar|lunar calendar]] still sets the dates of several religious festivals and new-year celebrations.{4}",
      "In myth and art the Moon has been a god and a goddess, a lantern, a mirror and a silver boat. Stories of a figure in the Moon differ from place to place: a man with a bundle of sticks in one tradition, a rabbit pounding grain in another. The Moon has long been linked with madness, with love and with the passing of time, and it remains one of the most frequent images in poetry and song.",
    ],
    subs: [],
  },
]

///|
/// Thumbnails in the body (index 0 and 1) plus the infobox picture (index 2), as shown in the
/// media viewer.
struct Figure {
  kind : String // "phases" | "earthrise" | "moon"
  caption : String
  alt : String
}

///|
let figures : Array[Figure] = [
  {
    kind: "phases",
    caption: "The Moon's phases over one lunar month, from new moon (left) through full moon to the last crescent.",
    alt: "Eight discs in a row, lit from the right, growing from a thin crescent to a full disc and shrinking back",
  },
  {
    kind: "earthrise",
    caption: "Earth rising over the lunar horizon, as a crew in orbit would see it.",
    alt: "A blue and white Earth, half lit, above the grey curved horizon of the Moon against black space",
  },
  {
    kind: "moon",
    caption: "The near side of the Moon at full phase, with the dark maria and the bright rayed highlands.",
    alt: "A grey disc with darker patches on its upper half and lighter, cratered ground below",
  },
]

///|
struct Citation {
  text : String
}

///|
let references : Array[Citation] = [
  { text: "Haldane, Rosalind (2019). //Tidal Histories of the Inner Planets//. Corvane University Press. pp. 41–58." },
  { text: "Okonjo, Teodor; Lindqvist, Mara (2021). \"A primer on lunar phase and illumination\". //Journal of Amateur Astronomy// 14 (3): 112–119." },
  { text: "Varga, Ilse (2016). \"Glancing blows: simulations of a giant impact on the proto-Earth\". //Annals of Planetary Dynamics// 88: 201–233." },
  { text: "Brennan, Cormac (2008). //Counting the Months: Calendars and the Moon//. Halloway & Finch. p. 9." },
  { text: "Achterberg, Pim; Sato, Wren (2022). \"Isotopic twins: reconciling impact models with lunar samples\". //Selene Quarterly// 31 (1): 4–27." },
  { text: "Moreau, Lucien (2014). \"Crystals afloat: the lunar magma ocean revisited\". //Geochemical Letters// 52: 77–90." },
  { text: "Lexipedia Physical Data Group (2025). //Handbook of Solar System Constants// (7th ed.). Tessaly Press. Table 4.2." },
  { text: "Quist, Annelie (2018). //Listening to the Moon: Fifty Years of Lunar Seismology//. Northfold Academic. ch. 3." },
  { text: "Ferrante, Dario (2011). \"Crater counts as a clock\". //Annals of Planetary Dynamics// 63: 15–40." },
  { text: "Ibsen-Kale, Noor (2020). \"Thermal extremes on airless bodies\". //Journal of Surface Physics// 9 (2): 55–71." },
  { text: "Castellan, Rhea; Mbeki, Joss (2023). \"Ice in the cold traps: a review of orbital evidence\". //Selene Quarterly// 32 (4): 300–341." },
  { text: "Haldane, Rosalind (2019). //Tidal Histories of the Inner Planets//. Corvane University Press. pp. 12–14." },
  { text: "Orsini, Paolo (2017). //Shadows That Line Up: A Guide to Eclipses//. Halloway & Finch. pp. 3–6." },
  { text: "Whitlock, Agnes (2015). \"Why there are two tides a day\". //Coastal Science Review// 21: 88–95." },
  { text: "Danvers, Elsa (2012). \"The Moon illusion: a century of explanations\". //Perception Studies// 40 (6): 601–618." },
  { text: "Ruiz-Abara, Tomas (2024). //Robots to the Moon: An Illustrated History of Lunar Probes//. Tessaly Press. pp. 120–164." },
]

///|
let see_also : Array[String] = [
  "Natural satellite", "Lunar calendar", "Far side of the Moon", "Selenography",
  "Earthshine",
]

///|
let external_links : Array[String] = [
  "Lunar Atlas Project, an interactive map of named features",
  "Lexipedia Commons, a gallery of Moon images",
  "Moon phase tables for any year, from an observatory almanac",
]
