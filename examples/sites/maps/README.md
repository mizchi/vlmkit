# Wayfarer Maps — Port Lumen

A demo of the "big map app" pattern: a pannable, zoomable street map of a fictional harbour
city, Port Lumen, with search, category chips, a results/place side panel (a bottom sheet on
phones), directions and map layers. No tiles and no network: the map is an SVG the program
draws from seeded data. Written in MoonBit with [mizchi/luna](https://github.com/mizchi/luna.mbt).

## URL parameters

| Parameter | Effect |
|---|---|
| `at=<x>,<y>,<zoom>` | The view: world metres and zoom 1-6. Kept up to date with `history.replaceState`. |
| `place=<id>` | Opens place `id` (0-39). Written back while a place is open. |
| `tab=reviews\|about` | With `place`, opens that tab. |
| `cat=<category>` | Turns a category chip on (`restaurants`, `coffee`, `hotels`, `museums`, `parks`, `transit`). |
| `dir=<from>-<to>` | Opens Directions between two place ids (`35-17`, `33-23` and `9-28` follow the streets). |
| `layer=transit\|terrain` | Map layer. |
| `sheet=peek\|full` | Phones: the bottom sheet's starting height (default half). |

Keyboard on the map: arrows pan 100px, `+` / `-` zoom, `Home` resets. Reduced motion makes pan
and zoom instant; nothing animates on load.

## Files

- `index.html`, `styles.css` — the page and its styles.
- `app.js` — built from `src/` by `node examples/sites/luna-build.mjs maps`; never edited by hand.
- `src/main/` — `data.mbt` (the city, places, hours, routes, reviews), `state.mbt` (signals, the
  eased view), `mapview.mbt` (map, labels, pins, clusters), `search.mbt`, `panel.mbt`, `main.mbt`,
  `icons.mbt`, `ffi.mbt` (browser APIs luna does not wrap).
- `copy.txt` — required copy for `check copy`. `flows/main.json` — the `verify flow` script.
- `judgment.sqlite`, `JUDGMENT.md` — how the site was judged.
