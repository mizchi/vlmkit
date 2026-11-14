# Lexipedia — "Moon"

A fictional wiki, **Lexipedia, the free encyclopedia**, showing one long article, "Moon"
(about 2,500 words in 8 sections with subsections, written for this demo), with the reading
tools of a modern encyclopedia skin: a sticky contents rail with scroll spy, an appearance rail
(text size, width, colour), page and reference previews, a search combobox, a language dialog,
a media viewer, talk / source / history views and stub pages. On phones the sections become
accordions and the rails move into the menu.

The page is written in MoonBit with [mizchi/luna](https://github.com/mizchi/luna.mbt). It works
from `file://` and makes no network requests; every picture is inline SVG.

## URL parameters and routes

| | |
|---|---|
| `?theme=dark` / `?theme=light` | force the colour scheme (otherwise the stored choice, or Automatic) |
| `#Section_id` | the article, scrolled to a section (opens its accordion on phones) |
| `#/wiki/<Title>` | a stub page (`#/wiki/Moon` is the article) |
| `#/talk`, `#/source`, `#/history` | Talk, View source, View history |
| `#/search/<query>` | search results |

Appearance choices, the hidden rails and the watchlist star are kept in `localStorage`
(`lexipedia:*`); every read and write is wrapped, so the page works without storage.

## Files

| File | What it is |
|---|---|
| `index.html` | the page: `<div id="app">`, the static footer, `<script src="app.js">` |
| `styles.css` | all styles, light and dark palettes, phone layout, print |
| `app.js` | **built** from `src/` — do not edit; run `node examples/sites/luna-build.mjs wiki` |
| `src/moon.mod`, `src/main/moon.pkg` | the MoonBit module (iife executable) |
| `src/main/main.mbt` | the UI: state, routing, header, rails, article, previews, dialogs |
| `src/main/article.mbt` | the article text, figures and references |
| `src/main/data.mbt` | 30 seeded titles, infobox rows, 41 languages, history, talk |
| `src/main/draw.mbt` | the SVG drawings (moon, phases, Earth-rise, thumbnails) |
| `src/main/ffi.mbt` | small `extern "js"` glue: storage, hash, matchMedia, timers, geometry, `<dialog>` |
| `copy.txt`, `copy-stub.txt` | required copy for `check copy` (article / stub view) |
| `JUDGMENT.md`, `judgment.sqlite` | how the page was judged |
