# Quarry docs (demo site)

Documentation for **Quarry**, a fictional command-line tool that moves data between
databases while both stay online. It is one of vlmkit's demo sites, built from
`examples/sites/briefs/docs.md`, and `judgment/` holds the log of how it was judged.

Static files only: no build step, no dependencies, no network requests. It works
from disk (`file://`) and from a sub-path.

## Pages

| File | Page |
|---|---|
| `index.html` | Getting started — what Quarry is, install, a first migration in four steps |
| `migrations.html` | Migrations — the four phases, dry runs, rolling back, troubleshooting |
| `cli.html` | CLI reference — every command and its options, in tables |

## URL parameters

| Parameter | Effect |
|---|---|
| `?theme=light` / `?theme=dark` | Force a theme. It wins over the saved choice and over `prefers-color-scheme`, and is not saved. |

Nothing animates when a page loads, so there is no `?animate=0`. The only motion
is the mobile drawer sliding in and out and smooth scrolling to in-page links;
both are removed under `prefers-reduced-motion: reduce`.

## Behaviour

- **Theme**: follows `prefers-color-scheme`; the header toggle overrides it and
  saves the choice in `localStorage` (`quarry-theme`).
- **Filter**: the header field (inside the drawer on phones) filters the sidebar as
  you type, over page and section titles. `/` focuses it, `Escape` clears it,
  `Enter` opens the first match.
- **Sidebar**: both groups, every page and each page's sections. The current page
  carries `aria-current="page"`, the section in view `aria-current="true"`.
- **On this page**: the right-hand contents column (from 1200px) marks the section
  in view as you scroll; a section you jump to (link or `#hash`) stays marked while
  its heading is at the top, even when its first subsection is close below it.
- **Copy**: every code block's Copy button copies the block without its `$`
  prompts and says "Copied" on the button and in a polite live region.
- **Widths**: three columns from 1200px, two from 768px, one below 768px with the
  sidebar in a drawer. The drawer takes focus when it opens, keeps Tab inside,
  closes on `Escape` or a click outside, and returns focus to the Menu button.
- **Article-width components**: the article is a CSS size container. The four
  migration phases are one row when it is at least 34rem wide, 2 x 2 below that and
  a single column below 24rem; option tables become one card per option below
  34rem. So a 768px tablet gets the same readable shapes as a phone.
- **Code that scrolls sideways** fades at the edge it continues past and becomes a
  focusable, named group so the keyboard can scroll it.

## Files

| File | Contents |
|---|---|
| `index.html`, `migrations.html`, `cli.html` | The three pages |
| `quarry.css` | The one stylesheet: colour tokens for both themes, the three layouts, components |
| `quarry.js` | The one script: theme, drawer, filter, copy, scroll-spy |
| `copy.txt` | The brief's required copy, one line each, for `vlmkit check copy --manifest` |
| `flows/*.json` | `vlmkit verify flow` scripts: `drawer` (375px: focus in, Tab wrap, Escape returns focus), `filter` (`/`, typing, no match, Escape, Enter opens the first match), `copy`, `theme`, `toc` (scroll-spy after following contents links, including sections whose first subsection sits right under the heading) |
| `judgment/` | The judging log (written by `examples/sites/judge.mjs`, not by hand) |
