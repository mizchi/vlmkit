# Findwell — a search home and results page, in MoonBit with luna

Findwell is a fictional web search engine. The home view is a wordmark, a search box with
suggestions and two buttons; a search opens a results page with tabs, a knowledge panel,
"People also ask", related searches and a pager. Everything it finds comes from a fixed index of
42 made-up pages about the Moon, coffee, trail running and a made-up programming language, so it
works offline from `file://` and makes no network requests.

The UI is written in MoonBit with [mizchi/luna](https://github.com/mizchi/luna.mbt). `app.js` is
built from `src/` and committed; never edit it by hand:

```sh
export PATH="$HOME/.moon/bin:$PATH"
node examples/sites/luna-build.mjs search          # src/ -> app.js
node examples/sites/luna-build.mjs search --check  # exit 1 when app.js is stale
```

## URL parameters

| Parameter | Effect |
|---|---|
| (none) | The home view |
| `q=<query>` | The results view. "moon landing", "pour over coffee" and "trail running shoes" have full pages; "moon landing" has the knowledge panel |
| `tab=images\|news\|videos\|maps\|books\|shopping` | A results tab (default: All) |
| `page=2…5` | A results page; pages 2–3 have results, 4–5 say there is nothing more |
| `go=<id>` | The "You would now leave Findwell for …" page for one result |
| `info=<slug>` | The small pages behind the footer, top-bar and app links (`about`, `how`, `privacy`, …) |
| `theme=dark\|light` | Force a theme (otherwise the OS preference; Settings → Dark theme toggles it) |

Searching pushes a history entry, so Back returns to the previous view.

## Files

| File | What it is |
|---|---|
| `index.html` | The page: a static fallback inside `#app`, `styles.css`, `app.js` |
| `styles.css` | All styling; colour tokens on `:root`, dark tokens for the OS preference and `[data-theme=dark]` |
| `app.js` | Built from `src/` by `luna-build.mjs` |
| `src/main/data.mbt` | The index: pages, suggestions, questions, related searches, apps, info pages |
| `src/main/search.mbt` | Matching, ranking, the result stats, suggestion prefixes, bold query terms |
| `src/main/main.mbt` | The views: combobox, menus, apps panel, results, dialog, leave and info pages |
| `src/main/js.mbt` | `location`, `history`, document listeners and `<dialog>` through `@js.Any` |
| `copy.txt` | The brief's required copy; `copy-home.txt` and `copy-results.txt` split it by view |
| `flow.json` | `verify flow`: type, pick a suggestion by keyboard, search, open a result, Back |
| `judgment.sqlite`, `JUDGMENT.md` | The log of how the site was judged |
