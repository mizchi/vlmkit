# Reelhouse — a fictional video site

A demo of the big-video-site pattern: a home feed with a guide, topic chips and a
card grid, search results, and a watch page with a custom player, description,
comments and an up-next column. Everything is fictional: 24 seeded videos on
space, cooking, music and travel by eight made-up channels. There are no media
files and no network requests; every thumbnail and the player's picture are SVG
scenes drawn from the video's id, and the player animates the same scene from its
own clock.

The UI is written in MoonBit with [mizchi/luna](https://github.com/mizchi/luna.mbt)
and compiled to one classic script, `app.js`.

## Pages and URL parameters

| URL | What it shows |
|---|---|
| `index.html` | Home feed |
| `index.html?q=moon` | Search results for "moon" (title, channel, description, topic) |
| `index.html?c=music` | Home feed with a chip preselected (`space`, `cooking`, `music`, `travel`, `live`, `recent`) |
| `index.html?feed=trending` | A guide feed: `subscriptions`, `you`, `trending`, `clips` |
| `watch.html?v=far5ide` | The watch page for one video (unknown ids fall back to the first) |
| `watch.html?v=far5ide&t=83` | Start the player at 1:23 (paused) |
| `?theme=dark` / `?theme=light` | Force a theme (otherwise `prefers-color-scheme`) |
| `?animate=0` | No transitions, player at 0:00, Autoplay off |

The player always starts paused. While it has keyboard focus: Space or k play /
pause, j / l seek 10s, ← / → 5s, m mute, c captions, f full screen, t theater,
0–9 jump to 0–90%. Under `prefers-reduced-motion` the picture holds still while
time still advances.

## Files

- `index.html`, `watch.html` — static landmarks (`header`, `main`) and the script tag.
- `styles.css` — all styling; light and dark tokens on `:root`.
- `app.js` — built from `src/` by `node examples/sites/luna-build.mjs video`. Do not edit.
- `src/` — the MoonBit module: `data.mbt` (seed data, formatting), `scene.mbt`
  (thumbnail / player pictures), `ui.mbt` (icons, menu button, dialogs, masthead,
  guide), `home.mbt`, `watch.mbt`, `share.mbt`, `js.mbt` (one-line browser bridges).
- `copy.txt` — the brief's required copy; `copy-home.txt` / `copy-watch.txt` split it
  by the page each line lives on, for `check copy --manifest`.
- `flow-player.json`, `flow-home.json` — `verify flow` scripts for the player's shortcuts
  and the menus, subscribe, comment, removal and search flows.
- `judgment.sqlite`, `JUDGMENT.md` — the log of how the site was judged.
