// The seeded index. Every page, suggestion, question and number Findwell shows is written here.
// "Today" for the date filters is 14 Nov 2026; `days` counts back from it.

///|
struct Page {
  id : Int
  topic : String // moon | coffee | trail | code
  kind : String // web | news | video | map | book | shop
  site : String
  domain : String
  path : Array[String]
  title : String
  snippet : String
  date : String // shown before the snippet when not ""
  days : Int
  keys : String
  about : String
  links : Array[String]
}

///|
fn pg(
  id : Int,
  topic : String,
  kind : String,
  site : String,
  domain : String,
  path : Array[String],
  title : String,
  snippet : String,
  date~ : String = "",
  days~ : Int = 400,
  keys~ : String = "",
  about~ : String = "",
  links~ : Array[String] = [],
) -> Page {
  { id, topic, kind, site, domain, path, title, snippet, date, days, keys, about, links }
}

///|
let pages : Array[Page] = [
  // ── The Moon ────────────────────────────────────────────────
  pg(
    1, "moon", "web", "Lunar Archive", "lunar-archive.example", ["missions", "first-landing"],
    "The first crewed Moon landing: a minute-by-minute account", "On 20 July 1969 two astronauts set their lander down in the Sea of Tranquillity. This account follows the descent, the low-fuel alarms and the first steps on the lunar surface.",
    keys="moon landing lunar apollo 1969 first crewed astronaut", about="Lunar Archive is a fictional volunteer-run library of mission transcripts, photographs and timelines for every crewed and uncrewed lunar flight.",
    links=["Mission timeline", "Crew biographies", "Landing site maps", "Audio transcripts"],
  ),
  pg(
    2, "moon", "web", "Orbit Facts", "orbitfacts.example", ["moon", "landings"],
    "Every Moon landing, crewed and robotic, in one table", "Six crewed landings between 1969 and 1972, and more than twenty robotic landers since. Sort the table by date, country, landing site or how long the mission lasted on the surface.",
    keys="moon landing landings list table robotic lander lunar", about="Orbit Facts is a fictional reference site that keeps sortable tables of spaceflight records, checked against published mission reports.",
  ),
  pg(
    3, "moon", "news", "Skyline Daily", "skylinedaily.example", ["science", "2026", "south-pole-lander"],
    "Robotic lander touches down near the lunar south pole", "The uncrewed lander reached the surface after a twelve-day cruise and sent back its first panorama of the Moon's shadowed craters within an hour of landing.",
    date="Nov 9, 2026", days=5, keys="moon landing lunar south pole lander robotic news", about="Skyline Daily is a fictional science newsroom covering space, climate and astronomy, with a daily newsletter.",
  ),
  pg(
    4, "moon", "web", "Field Notes on Space", "fieldnotes-space.example", ["explainers", "why-the-flag-looks-wavy"],
    "Why the flag in the Moon landing photos looks like it is waving", "There is no wind on the Moon. The flag had a horizontal rod sewn into its top edge, and the creases from months of folding stayed in the fabric. Here is how to read the photographs.",
    keys="moon landing flag photos myth explained lunar", about="Field Notes on Space is a fictional explainer blog written by a retired planetarium educator.",
  ),
  pg(
    5, "moon", "video", "Starwatch Video", "starwatch.example", ["watch", "descent-restored"],
    "The final descent, restored from the original film (12:48)", "Frame-by-frame restoration of the landing camera's 16 mm film, synchronised with the cockpit audio. Includes the last two minutes before touchdown at full resolution.",
    date="Jul 20, 2026", days=117, keys="moon landing video film descent restored footage lunar", about="Starwatch Video is a fictional channel that restores archival spaceflight footage.",
  ),
  pg(
    6, "moon", "web", "Lunar Archive", "lunar-archive.example", ["missions", "sea-of-tranquillity"],
    "Sea of Tranquillity: where the first lander set down", "A flat basaltic plain chosen because it was smooth enough to land on. See the planned landing ellipse, where the lander actually stopped, and the footprints mapped from orbit.",
    keys="moon landing site sea of tranquillity map lunar crater", about="Lunar Archive is a fictional volunteer-run library of mission transcripts, photographs and timelines for every crewed and uncrewed lunar flight.",
  ),
  pg(
    7, "moon", "book", "Pageturn Books", "pageturn.example", ["books", "the-quiet-descent"],
    "The Quiet Descent: An Oral History of the Moon Landings", "Interviews with flight controllers, engineers and families, collected over twenty years. Paperback, 412 pages, with forty photographs from private collections.",
    keys="moon landing book oral history lunar", about="Pageturn Books is a fictional independent bookshop that ships within three days.",
  ),
  pg(
    8, "moon", "web", "Ask a Physicist", "askaphysicist.example", ["answers", "moon-gravity-walking"],
    "How did astronauts walk on the Moon with one-sixth gravity?", "They found that a loping hop was easier than walking. The suits were stiff at the knees, so most moved like kangaroos. Slow-motion video shows how they kept their balance.",
    keys="moon landing gravity walk astronauts lunar physics", about="Ask a Physicist is a fictional question-and-answer site answered by university physics students.",
  ),
  pg(
    9, "moon", "news", "Orbit Weekly", "orbitweekly.example", ["news", "crewed-return-schedule"],
    "Crewed return to the Moon: the schedule as it stands", "The next crewed landing has moved to late 2027. Engineers are still testing the lander's legs and the suits that will be worn on the surface.",
    date="Oct 28, 2026", days=17, keys="moon landing crewed return schedule news lunar", about="Orbit Weekly is a fictional magazine about spaceflight policy and industry.",
  ),
  pg(
    10, "moon", "web", "Classroom Cosmos", "classroomcosmos.example", ["lessons", "moon-landing-ages-8-11"],
    "Moon landing lesson plan for ages 8 to 11", "A one-hour lesson with a paper lander drop, a timeline to cut out and a worksheet on the Moon's phases. Printable as A4 or US Letter.",
    keys="moon landing lesson plan kids school lunar", about="Classroom Cosmos is a fictional library of free science lessons written by teachers.",
  ),
  pg(
    11, "moon", "video", "Starwatch Video", "starwatch.example", ["watch", "how-the-lander-worked"],
    "How the lunar lander worked, in six minutes (6:02)", "An animated cutaway of the two-stage lander: the descent engine, the ascent stage that left the legs behind, and why the walls were thinner than a soda can.",
    date="Mar 3, 2026", days=256, keys="moon landing lander video animation how it worked lunar", about="Starwatch Video is a fictional channel that restores archival spaceflight footage.",
  ),
  pg(
    12, "moon", "web", "Orbit Facts", "orbitfacts.example", ["moon", "rocks-brought-back"],
    "382 kilograms of Moon rock: what the samples taught us", "The rocks brought back from the landings showed the Moon is about 4.5 billion years old and once had a magma ocean. Where the samples are kept and who can study them.",
    keys="moon landing rocks samples geology lunar", about="Orbit Facts is a fictional reference site that keeps sortable tables of spaceflight records, checked against published mission reports.",
  ),
  // ── Coffee ──────────────────────────────────────────────────
  pg(
    13, "coffee", "web", "Slow Pour", "slowpour.example", ["guides", "pour-over-basics"],
    "Pour over coffee: a beginner's guide that actually works", "Start with 15 grams of coffee to 250 grams of water at 94 °C. Bloom for 40 seconds, then pour in slow circles. A full pour over should take three to four minutes.",
    keys="pour over coffee guide beginner brew ratio", about="Slow Pour is a fictional home-brewing blog run by two former baristas.",
    links=["Grind size chart", "Water temperature", "Choosing a dripper", "Troubleshooting"],
  ),
  pg(
    14, "coffee", "web", "Brew Ratio", "brewratio.example", ["calculator"],
    "Coffee to water ratio calculator for pour over and drip", "Enter the cups you want and pick a strength. The calculator gives grams of coffee, grams of water and a pour schedule you can print or keep on your phone.",
    keys="pour over coffee ratio calculator water grams", about="Brew Ratio is a fictional single-page tool for working out coffee recipes.",
  ),
  pg(
    15, "coffee", "video", "Kettle & Cup", "kettlecup.example", ["videos", "pour-over-technique"],
    "Pour over technique: the centre pour versus spirals (9:14)", "Two cups brewed side by side with the same beans and grind. We measure extraction for each and taste them blind, then explain why the difference is smaller than you think.",
    date="Sep 30, 2026", days=45, keys="pour over coffee video technique pour spiral", about="Kettle & Cup is a fictional coffee video channel with weekly brewing comparisons.",
  ),
  pg(
    16, "coffee", "web", "Slow Pour", "slowpour.example", ["guides", "grind-size"],
    "Grind size for pour over coffee, with photos at every setting", "Medium-fine, like table salt, is the usual starting point. If the brew finishes in under three minutes go finer; if it stalls past five minutes go coarser.",
    keys="pour over coffee grind size grinder setting", about="Slow Pour is a fictional home-brewing blog run by two former baristas.",
  ),
  pg(
    17, "coffee", "shop", "Ember Goods", "embergoods.example", ["drippers", "ceramic-cone"],
    "Ceramic cone dripper, size 02 — Ember Goods", "Hand-glazed ceramic cone with spiral ribs and one large hole. Fits most mugs and takes standard 02 paper filters. Available in four glazes.",
    keys="pour over coffee dripper ceramic cone shop buy", about="Ember Goods is a fictional shop for coffee equipment, shipping from a small warehouse.",
  ),
  pg(
    18, "coffee", "news", "Morning Grounds", "morninggrounds.example", ["news", "harvest-2026"],
    "Coffee harvest 2026: what the dry season means for prices", "Growers in three regions report smaller cherries after a long dry season. Roasters expect light roasts to cost more by spring.",
    date="Nov 2, 2026", days=12, keys="coffee harvest prices news beans", about="Morning Grounds is a fictional trade newsletter for coffee roasters and cafés.",
  ),
  pg(
    19, "coffee", "web", "The Bean Lab", "beanlab.example", ["experiments", "water-temperature"],
    "Does water temperature matter for pour over coffee?", "We brewed the same coffee at 85, 90, 94 and 99 °C and measured the results. Lighter roasts need hotter water; darker roasts taste harsher above 92 °C.",
    keys="pour over coffee water temperature experiment", about="The Bean Lab is a fictional blog that runs measured brewing experiments.",
  ),
  pg(
    20, "coffee", "map", "Findwell Maps", "maps.findwell.example", ["places", "pour-over-bars"],
    "Pour over bars near Harbour Street", "Three cafés within a ten-minute walk serve single-origin pour over coffee: Lantern Coffee, Northside Brew Bar and the Copper Kettle. All open from 7 am.",
    keys="pour over coffee cafe near me map bar", about="Findwell Maps lists places from the fictional city used in this demo.",
  ),
  pg(
    21, "coffee", "web", "Kettle & Cup", "kettlecup.example", ["articles", "paper-vs-metal-filters"],
    "Paper or metal filters for pour over: a side-by-side test", "Paper filters give a cleaner, brighter cup; metal filters let more oils through and a little sediment. Which you prefer depends on the beans.",
    keys="pour over coffee filter paper metal", about="Kettle & Cup is a fictional coffee video channel with weekly brewing comparisons.",
  ),
  pg(
    22, "coffee", "book", "Pageturn Books", "pageturn.example", ["books", "the-patient-cup"],
    "The Patient Cup: Brewing Coffee by Hand", "A practical book on pour over, immersion and siphon brewing, with forty recipes and a chapter on water chemistry. Hardback, 236 pages.",
    keys="pour over coffee book brewing by hand", about="Pageturn Books is a fictional independent bookshop that ships within three days.",
  ),
  pg(
    23, "coffee", "web", "Slow Pour", "slowpour.example", ["guides", "fix-a-sour-cup"],
    "Why is my pour over coffee sour? Five fixes", "A sour cup is usually under-extracted. Grind finer, use hotter water, pour more slowly, or rinse the paper filter first so it does not stall.",
    keys="pour over coffee sour bitter fix troubleshooting", about="Slow Pour is a fictional home-brewing blog run by two former baristas.",
  ),
  pg(
    24, "coffee", "shop", "Ember Goods", "embergoods.example", ["kettles", "gooseneck-kettle"],
    "Gooseneck kettle with temperature hold, 0.9 L", "A thin spout for a slow, steady pour and a base that holds the water at any temperature from 60 to 100 °C. Brushed steel or matte black.",
    keys="pour over coffee kettle gooseneck shop buy", about="Ember Goods is a fictional shop for coffee equipment, shipping from a small warehouse.",
  ),
  // ── Trail running ───────────────────────────────────────────
  pg(
    25, "trail", "web", "Ridgeline Running", "ridgeline.example", ["gear", "best-trail-shoes-2026"],
    "The best trail running shoes of 2026, tested over 900 km", "We ran six pairs on rock, mud and forest paths for three months. The winners grip on wet stone, drain quickly and still feel light after twenty kilometres.",
    date="Oct 12, 2026", days=33, keys="trail running shoes best 2026 review tested", about="Ridgeline Running is a fictional magazine for trail and mountain runners.",
    links=["Shoes for mud", "Wide fit shoes", "Waterproof or not", "How we test"],
  ),
  pg(
    26, "trail", "web", "Footpath Lab", "footpathlab.example", ["guides", "how-trail-shoes-should-fit"],
    "How trail running shoes should fit", "Leave a thumb's width in front of your longest toe for downhills. The heel should not lift, and the midfoot should feel snug without pressing on the top of your foot.",
    keys="trail running shoes fit size guide", about="Footpath Lab is a fictional site about running biomechanics, written by physiotherapists.",
  ),
  pg(
    27, "trail", "shop", "Summit Supply", "summitsupply.example", ["shoes", "grit-runner-4"],
    "Grit Runner 4 trail running shoe — Summit Supply", "A 5 mm lug outsole for mud and loose ground, a rock plate under the forefoot and a gusseted tongue that keeps grit out. Sizes 36 to 48.",
    keys="trail running shoes buy shop grit runner", about="Summit Supply is a fictional outdoor shop with stores in two cities.",
  ),
  pg(
    28, "trail", "video", "Ridgeline Running", "ridgeline.example", ["video", "lacing-for-downhill"],
    "Three lacing tricks for steep downhills (4:37)", "A heel lock, a loop to stop the tongue sliding and a way to relieve pressure on the top of the foot. Filmed on a wet descent.",
    date="Jun 2, 2026", days=165, keys="trail running shoes lacing video downhill", about="Ridgeline Running is a fictional magazine for trail and mountain runners.",
  ),
  pg(
    29, "trail", "web", "Hill & Hollow", "hillhollow.example", ["advice", "road-vs-trail-shoes"],
    "Road shoes versus trail running shoes: when you need which", "On packed gravel road shoes are fine. Once the path has roots, mud or loose stone, deeper lugs and a firmer upper keep your foot where you put it.",
    keys="trail running shoes road versus difference", about="Hill & Hollow is a fictional hiking and running blog from a family that walks every weekend.",
  ),
  pg(
    30, "trail", "news", "Trail Times", "trailtimes.example", ["news", "mountain-marathon-2026"],
    "Mountain marathon finishes in fog; winner credits her shoes' grip", "The 42 km race crossed three ridges in near-zero visibility. Most finishers said grip on wet rock mattered more than cushioning.",
    date="Nov 10, 2026", days=4, keys="trail running race news marathon shoes grip", about="Trail Times is a fictional newsroom covering trail races and outdoor events.",
  ),
  pg(
    31, "trail", "map", "Findwell Maps", "maps.findwell.example", ["places", "trailheads"],
    "Trailheads near Pinecrest", "Four marked trails start within twenty minutes of Pinecrest: Larch Loop (6 km), Ridge Path (14 km), Mill Brook (9 km) and the Summit Steps (3 km, steep).",
    keys="trail running trailheads map near hiking", about="Findwell Maps lists places from the fictional city used in this demo.",
  ),
  pg(
    32, "trail", "web", "Footpath Lab", "footpathlab.example", ["guides", "how-long-do-trail-shoes-last"],
    "How long do trail running shoes last?", "Most pairs last 500 to 800 km. Worn lugs, a flattened midsole and a torn upper near the toe are the signs to replace them, whatever the distance.",
    keys="trail running shoes how long last replace", about="Footpath Lab is a fictional site about running biomechanics, written by physiotherapists.",
  ),
  pg(
    33, "trail", "shop", "Summit Supply", "summitsupply.example", ["shoes", "mossback-wide"],
    "Mossback Wide waterproof trail shoe — Summit Supply", "A wide toe box, a waterproof membrane and a softer midsole for long days. Runs half a size small; most runners size up.",
    keys="trail running shoes wide waterproof buy shop", about="Summit Supply is a fictional outdoor shop with stores in two cities.",
  ),
  pg(
    34, "trail", "web", "Hill & Hollow", "hillhollow.example", ["advice", "cleaning-muddy-shoes"],
    "Cleaning muddy trail running shoes without ruining them", "Let the mud dry, knock it off, then wash with cold water and a soft brush. Never use a dryer: heat breaks down the glue that holds the sole on.",
    keys="trail running shoes clean mud wash care", about="Hill & Hollow is a fictional hiking and running blog from a family that walks every weekend.",
  ),
  pg(
    35, "trail", "book", "Pageturn Books", "pageturn.example", ["books", "running-the-high-paths"],
    "Running the High Paths: A Trail Runner's Handbook", "Training plans, kit lists and route-finding for runners moving from road to mountain. Paperback, 288 pages, with maps.",
    keys="trail running book handbook training shoes", about="Pageturn Books is a fictional independent bookshop that ships within three days.",
  ),
  pg(
    36, "trail", "web", "Ridgeline Running", "ridgeline.example", ["gear", "trail-shoe-glossary"],
    "Trail shoe terms explained: lugs, drop, stack and rock plates", "Lug depth sets grip, drop is the height difference from heel to toe, and stack is how much foam sits under you. What each number means on a trail.",
    keys="trail running shoes glossary drop lugs stack", about="Ridgeline Running is a fictional magazine for trail and mountain runners.",
  ),
  // ── Programming languages ───────────────────────────────────
  pg(
    37, "code", "web", "Tideline Lang", "tideline-lang.example", ["docs", "tour"],
    "A tour of Tideline, a small typed language that compiles to Wasm", "Tideline has algebraic data types, pattern matching and a fast build. This tour takes an hour and runs in the browser, with no install.",
    keys="tideline programming language wasm typed compiler tour", about="Tideline Lang is the fictional home page of a small open-source programming language.",
    links=["Language tour", "Standard library", "Package registry", "Playground"],
  ),
  pg(
    38, "code", "web", "Compiler Notes", "compilernotes.example", ["posts", "why-languages-target-wasm"],
    "Why new programming languages are choosing WebAssembly", "Wasm gives a language one portable target for browsers, servers and edge devices. We compare four young languages and how each uses it.",
    keys="programming language wasm webassembly compiler new", about="Compiler Notes is a fictional blog about building compilers and language tools.",
  ),
  pg(
    39, "code", "video", "Code Hour", "codehour.example", ["videos", "pattern-matching"],
    "Pattern matching in ten minutes (10:05)", "How match expressions replace chains of if statements, why exhaustiveness checking catches bugs, and how it looks in three typed languages.",
    date="Aug 21, 2026", days=85, keys="programming language pattern matching video typed tideline", about="Code Hour is a fictional channel of short programming lessons.",
  ),
  pg(
    40, "code", "book", "Pageturn Books", "pageturn.example", ["books", "types-for-the-curious"],
    "Types for the Curious: A Gentle Introduction", "Type systems explained with drawings instead of proofs: sum types, generics, inference and why some languages need no null. Paperback, 198 pages.",
    keys="programming language types book typed introduction", about="Pageturn Books is a fictional independent bookshop that ships within three days.",
  ),
  pg(
    41, "code", "news", "Dev Dispatch", "devdispatch.example", ["news", "tideline-1-0"],
    "Tideline reaches 1.0 with a stable standard library", "The language's first stable release freezes the standard library and the package format. Builds are 30% faster than the last preview.",
    date="Nov 5, 2026", days=9, keys="tideline programming language release news 1.0", about="Dev Dispatch is a fictional newsletter about programming tools and releases.",
  ),
  pg(
    42, "code", "web", "Compiler Notes", "compilernotes.example", ["posts", "fine-grained-reactivity"],
    "Fine-grained reactive UI in a typed language", "Signals update only the parts of the page that read them. We build a search box with suggestions in 200 lines and measure how little re-renders.",
    keys="programming language reactive ui signals typed tideline", about="Compiler Notes is a fictional blog about building compilers and language tools.",
  ),
]

///|
let suggestions : Array[String] = [
  "moon landing", "moon landing date", "moon landing site map", "moon landing video",
  "moon landing photos", "moon landing lesson plan", "moon phases tonight", "moon rocks",
  "moon gravity", "moon lander how it worked", "pour over coffee", "pour over coffee ratio",
  "pour over coffee grind size", "pour over vs french press", "pour over kettle",
  "pour over dripper", "pour over coffee sour", "pour over water temperature",
  "trail running shoes", "trail running shoes wide", "trail running shoes waterproof",
  "trail running shoes how long do they last", "trail running for beginners", "trail running lacing",
  "trailheads near me", "tideline language", "tideline pattern matching", "tideline 1.0 release",
  "typed languages for wasm", "coffee harvest 2026", "coffee to water ratio", "coffee filters paper or metal",
]

///|
struct Question {
  q : String
  a : String
}

///|
fn questions(topic : String) -> Array[Question] {
  match topic {
    "moon" => [
      { q: "Who were the first people to land on the Moon?", a: "Two astronauts walked on the surface on 20 July 1969 while a third stayed in lunar orbit in the command module." },
      { q: "How many crewed Moon landings have there been?", a: "Six, between July 1969 and December 1972. Twelve people have walked on the Moon." },
      { q: "How long did the first moonwalk last?", a: "About two and a half hours outside the lander, within roughly 60 metres of it." },
      { q: "Can you see the landing sites with a telescope?", a: "No. The largest pieces left behind are a few metres across, far too small for any telescope on Earth. Orbiting cameras have photographed them." },
      { q: "Why did the crewed landings stop in 1972?", a: "Budgets were cut and the remaining missions were cancelled; the goal of landing first had been met." },
      { q: "Is the flag still standing on the Moon?", a: "Orbital photos show shadows at most sites, but decades of unfiltered sunlight have probably bleached the fabric white." },
    ]
    "coffee" => [
      { q: "What is the best ratio for pour over coffee?", a: "Start at 1:16, for example 15 g of coffee to 240 g of water, and adjust by taste." },
      { q: "How long should a pour over take?", a: "Three to four minutes from the first pour to the last drip for a single cup." },
      { q: "Is pour over stronger than drip coffee?", a: "Not by default. Strength depends on the ratio; pour over usually tastes cleaner because you control the pour." },
      { q: "Do you need a gooseneck kettle?", a: "It helps you pour slowly and evenly, but a steady hand with any kettle works." },
      { q: "Why rinse the paper filter?", a: "Rinsing removes papery taste and warms the dripper and cup." },
      { q: "What grind size is best for pour over?", a: "Medium-fine, about the size of table salt. Go finer if it runs fast, coarser if it stalls." },
    ]
    "trail" => [
      { q: "Do you need special shoes for trail running?", a: "On roots, mud or loose stone, yes: deeper lugs and a firmer upper keep your footing. On packed gravel road shoes are fine." },
      { q: "Should trail running shoes be a size bigger?", a: "Many runners go up half a size so their toes do not hit the front on downhills." },
      { q: "Are waterproof trail shoes worth it?", a: "In cold, wet weather yes. In summer they keep sweat in, and once water gets over the top it stays in." },
      { q: "How tight should trail shoes be?", a: "Snug at the heel and midfoot, with room to spread your toes." },
      { q: "What is a rock plate?", a: "A thin, stiff layer in the sole that spreads the force of sharp stones." },
      { q: "Can you use trail shoes on the road?", a: "Yes, but the soft lugs wear down quickly on asphalt." },
    ]
    "code" => [
      { q: "What is a typed programming language?", a: "One that checks the kind of every value before the program runs, so some mistakes are caught early." },
      { q: "Why do languages compile to WebAssembly?", a: "It runs in every browser and many servers, so one build reaches all of them." },
      { q: "What is pattern matching?", a: "A way to branch on the shape of a value, with the compiler checking every case is handled." },
      { q: "Is Tideline ready for production?", a: "Its 1.0 release froze the standard library, which is the usual signal that it is." },
      { q: "What are signals in UI programming?", a: "Values that remember who reads them, so only those readers update when they change." },
      { q: "Do I need to install anything to try Tideline?", a: "No, the tour and the playground run in the browser." },
    ]
    _ => []
  }
}

///|
fn related(topic : String) -> Array[String] {
  match topic {
    "moon" => [
      "moon landing date", "moon landing site map", "moon landing video", "moon landing photos",
      "moon rocks", "moon gravity", "moon lander how it worked", "moon landing lesson plan",
    ]
    "coffee" => [
      "pour over coffee ratio", "pour over coffee grind size", "pour over kettle",
      "pour over dripper", "pour over water temperature", "pour over vs french press",
      "coffee filters paper or metal", "pour over coffee sour",
    ]
    "trail" => [
      "trail running shoes wide", "trail running shoes waterproof", "trail running lacing",
      "trail running for beginners", "trail running shoes how long do they last",
      "trailheads near me", "best trail running shoes 2026", "cleaning muddy trail shoes",
    ]
    "code" => [
      "tideline language", "tideline pattern matching", "tideline 1.0 release",
      "typed languages for wasm", "fine grained reactivity", "types for the curious",
      "webassembly compilers", "signals ui",
    ]
    _ => []
  }
}

///|
struct App {
  name : String
  slug : String
  hue : String
  glyph : String
}

///|
let apps : Array[App] = [
  { name: "Mail", slug: "mail", hue: "#2f5fd0", glyph: "M" },
  { name: "Maps", slug: "maps", hue: "#0b7a45", glyph: "P" },
  { name: "Drive", slug: "drive", hue: "#b4560b", glyph: "D" },
  { name: "Calendar", slug: "calendar", hue: "#7442c8", glyph: "C" },
  { name: "Photos", slug: "photos", hue: "#c2185b", glyph: "F" },
  { name: "News", slug: "news", hue: "#00677f", glyph: "N" },
  { name: "Translate", slug: "translate", hue: "#3d5a80", glyph: "T" },
  { name: "Notes", slug: "notes", hue: "#8a5a00", glyph: "K" },
  { name: "Meet", slug: "meet", hue: "#1b7f5b", glyph: "V" },
]

///|
struct Info {
  slug : String
  title : String
  body : String
}

///|
let infos : Array[Info] = [
  { slug: "about", title: "About Findwell", body: "Findwell is a fictional search engine made for a demo. It searches a small, fixed index of 42 pages about the Moon, coffee, trail running and programming languages." },
  { slug: "advertising", title: "Advertising", body: "Findwell shows no adverts. In a real search engine this page would explain how to buy them." },
  { slug: "business", title: "Business", body: "Findwell has no business listings of its own. The places in Findwell Maps come from a made-up city." },
  { slug: "how", title: "How search works", body: "Each word you type is matched against the keywords of every page in the index. Pages that match more of your words rank higher; Verbatim asks for every word. Nothing is sent anywhere: the whole index lives in this page." },
  { slug: "privacy", title: "Privacy", body: "Findwell stores nothing. Visited links and the theme you choose last only until you close the tab." },
  { slug: "terms", title: "Terms", body: "This is a demonstration. Every site, shop and product in the results is fictional." },
  { slug: "advanced", title: "Advanced search", body: "Use the Tools row on a results page: Any time narrows results by date, and Verbatim asks for every word you typed." },
  { slug: "settings", title: "Search settings", body: "Findwell has one setting worth keeping: Dark theme, in the Settings menu at the bottom of the home page." },
  { slug: "signin", title: "Sign in", body: "There are no accounts on Findwell. Everything works without signing in." },
  { slug: "images", title: "Findwell Images", body: "Search for anything, then choose the Images tab above the results to see pictures from the pages that match." },
]
