# Brief: web search engine — "Findwell"

- **Directory**: `examples/sites/search/`
- **Pattern**: interactive app — search home with autocomplete, then a results page
- **Language**: English
- **Implementation**: MoonBit with `mizchi/luna`. Read [`../LUNA.md`](../LUNA.md) first.

## What it is

**Findwell**, a fictional web search engine. One page, `index.html`, with two views. The home view
is shown with no query; `?q=<query>` shows results. Submitting the form updates the URL with
`history.pushState`, and Back returns to the previous view. The index is a seeded, deterministic
set of about 40 fictional pages on a few topics (the Moon, coffee brewing, MoonBit-like programming
languages, hiking). The queries "moon landing", "pour over coffee" and "trail running shoes" have
full results pages. Anything else returns the matches it can, or the empty state.

## Reference study

The pattern is the minimal search home. Measured on the real thing at 1280×800:

- The search box is about 584×50px, a pill with a 1px border, a search icon on the left, and
  voice and camera icons on the right.
- The wordmark sits about 210px from the top. The page has no other content.
- Two grey buttons sit 30px below the search box.
- Top-right: two text links, an app-grid icon and a pill "Sign in" button.
- Footer: two link groups pinned to the bottom edge, one on the left and one on the right.

## Home view

- A wordmark ("Findwell") drawn as inline SVG or styled text, in a few colours, centred.
- The search box is a WAI-ARIA combobox, with the label "Search". Typing opens a suggestion
  listbox under the box:
  - up to 8 suggestions, each with a search icon, the typed prefix in normal weight and the rest
    in bold;
  - ArrowUp and ArrowDown move the active option and copy it into the box; Enter searches it;
  - Escape closes the list, and a second Escape clears the box;
  - a clear (×) button appears once there is text.
- Buttons: "Findwell Search" and "Feeling Lucky". Feeling Lucky opens the first result's
  fictional page view: a simple "You would now leave Findwell for …" interstitial with a Back link.
- Top bar: "Mail" and "Images" links, an apps button that opens a 3×3 grid panel of fictional
  apps (a popover; Escape and outside clicks close it), and "Sign in".
- Footer: About, Advertising, Business, How search works · Privacy, Terms, Settings. Settings opens
  a menu with "Search settings", "Dark theme: Off/On" (toggles it) and "Advanced search".

## Results view

- **Header**: a small wordmark (a link home), the search box with the query (its combobox still
  works), and an avatar.
- **Tabs** below: All, Images, News, Videos, Maps, a "More" menu, and "Tools".
  - Each tab filters the seeded results to that kind; Images shows a grid of drawn thumbnails.
  - The current tab is underlined and `aria-current`.
  - Tools reveals a second row of filters: "Any time" and "All results", each a menu.
- **Result stats**: "About 1,240 results (0.31 seconds)". Fixed numbers, from the seed data.
- **Each result**:
  - a favicon circle, the site name and a breadcrumb URL (`site.example › section › page`);
  - a blue title link, purple once visited during this session;
  - a 2-line snippet with the query terms in bold;
  - some results have sitelinks (4 links in two columns), and some have a date prefix;
  - a ⋮ button opens "About this result", a small dialog with the source's description.
- **"People also ask"**: four questions in an accordion. Opening one reveals an answer, and
  appends one more question below it, at most two extra.
- **Knowledge panel** (right column, desktop only): for "moon landing", a title, a subtitle, a
  drawn image, a description and a fact table. Below 1000px it moves above the results.
- **"Related searches"** at the bottom: eight chips that run a new search.
- **Pagination**: "Findwell" spelled out with page numbers under it (1–5) and "Next". Pages 2–3
  have seeded results; later pages say there is nothing more.
- **Empty state**: "Your search – … – did not match any documents.", with suggestions.

## Theme and phones

- Light by default, dark under `prefers-color-scheme: dark`, `?theme=dark` or the Settings toggle.
  Both pass WCAG AA.
- Phones: on the home view the search box takes the full width less 16px each side. On the
  results view the tabs scroll horizontally, result titles wrap, and the knowledge panel becomes a
  card at the top.

## Required copy

```
Findwell
Findwell Search
Feeling Lucky
Sign in
People also ask
Related searches
How search works
Next
```

## States to show (final round)

- The home view at desktop and mobile sizes.
- Suggestions open with an option highlighted by the keyboard.
- The apps panel open.
- The "moon landing" results at desktop and mobile, with the knowledge panel.
- A "People also ask" item expanded.
- The Images tab.
- The Tools row open.
- The empty state.
- Dark theme on results.

## Gates this brief leans on

- `check interactions`: the combobox keyboard contract, menus, popover, accordion.
- `check a11y focus` and `check a11y contrast` in both themes.
- `check copy --manifest copy.txt`.
- `check composition`: the result-item grouping and the hierarchy.
- `check design`: one result component.
- `check breakpoints --sweep`: the knowledge panel moves.
- `verify flow`: type, choose a suggestion, land on results, go Back.
- `stress data`: long titles, many results.
