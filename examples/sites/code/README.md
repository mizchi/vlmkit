# Forgeyard — tidewater/lantern

A demo site for vlmkit: **Forgeyard**, a fictional code host, showing one fictional repository,
`tidewater/lantern` (a static site generator). Written in MoonBit with
[mizchi/luna](https://github.com/mizchi/luna.mbt); every record it shows is fixed data in `src/main/data.mbt`.

## Views (chosen by the hash)

| Hash | View |
|---|---|
| `#/` | Repository home: toolbar, file table, README, About column |
| `#/tree/<dir>` | A folder of the file table |
| `#/blob/<path>` | A file; `#/blob/<path>#L12` or `#L12-L15` highlights lines |
| `#/issues` | The issue list; `#/issues/<n>` one issue; `#/issues/new` the form |
| `#/pulls`, `#/actions`, `#/security`, `#/insights` | The other repository tabs |

## URL parameters

- `?theme=dark` / `?theme=light` force a theme; without it the page follows `prefers-color-scheme`.

Nothing animates, so there is no `?animate=0`.

## Keyboard

- `/` anywhere outside a field opens the command palette (files and issues; arrows and Enter).
- `Escape` closes any open menu and returns focus to its button.

## Files

- `index.html` — the static landmarks (`header`, `main`, `footer`) and the script tag.
- `styles.css` — all styling, both themes.
- `app.js` — built from `src/` by `node examples/sites/luna-build.mjs code`; never edited by hand.
- `src/` — the MoonBit module (`main/*.mbt`: data, routing, views, Markdown and syntax colouring).
- `copy.txt` — the required copy, for `check copy --manifest copy.txt`.
- `flows/*.json` — the `verify flow` scripts the log runs (files and lines, palette and issues, menus and tabs).
- `judgment.sqlite`, `JUDGMENT.md` — the log of how the site was judged.
