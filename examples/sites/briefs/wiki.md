# Brief: encyclopedia article — "Lexipedia"

- **Directory**: `examples/sites/wiki/`
- **Pattern**: content site with reading tools — a long article with a contents rail, previews
  and appearance settings
- **Language**: English
- **Implementation**: MoonBit with `mizchi/luna`. Read [`../LUNA.md`](../LUNA.md) first.

## What it is

**Lexipedia, the free encyclopedia**: a fictional wiki. It shows one long article, "Moon",
written for this site in an encyclopedic register. About 2,500 words in 8 sections with
subsections, all seeded in the program; do not copy any existing article. One page, `index.html`.
Internal links point to a stub view (`#/wiki/<Title>`), which shows a short stub and "This article
is a stub." The article link returns.

## Reference study

The pattern is the big wiki's current skin. Measured at 1280×800:

- **Header**: a hamburger, the wordmark with a tagline under it, a search field about 400px wide
  with a "Search" button, and "Donate / Create account / Log in" on the right.
- **Three columns**: a "Contents" rail of about 165px with a "hide" button; the article column of
  about 750px, starting at x≈264; and an "Appearance" rail of about 165px with its own "hide".
- **Title area**: the title in a serif face, large, with "295 languages" and an icon on the right.
  Then tabs: Article / Talk on the left; Read / View source / View history and a bookmark on the
  right. Then the sub-line "From Wikipedia, the free encyclopedia".
- An italic hatnote, indented.
- The **lead** text wraps around an **infobox** on the right: about 300px, a bold title, an image,
  a caption, and data rows with coloured section header bars.
- **Contents rail**: "(Top)" and then the sections. A section with subsections has a disclosure
  chevron. The rail is sticky.
- **Appearance rail**: radio groups for Text (Small / Standard / Large), Width (Standard / Wide)
  and Color (Automatic / Light / Dark).

## Layout and behaviour

- **Search**: a combobox, labelled "Search Lexipedia".
  - Suggestions show a title and a one-line description, from 30 seeded titles.
  - Enter on a title opens its stub. Anything else shows a "Search results" view listing matches.
- **Contents rail**:
  - A sticky rail.
  - Subsections expand and collapse.
  - The section you are reading is highlighted (scroll spy).
  - "hide" moves the contents into a "Contents" button by the title, which opens a popover.
  - Below 1000px the rail is hidden, and only the button remains.
- **Appearance**:
  - Text size changes the article's font size: 14 / 16 / 20px.
  - Width toggles the content width cap.
  - Color sets light or dark, and Automatic follows `prefers-color-scheme`.
  - The choice is kept in `localStorage`. Wrap every read and write in try/catch, and the page must
    still work with storage unavailable.
  - "hide" moves Appearance into a toolbar menu.
  - `?theme=dark` forces dark.
- **Title bar**:
  - "N languages" opens a dialog: a search field, "Suggested languages", and a filtered grid of
    about 40 fictional language names.
  - The tabs change the view. Talk shows a talk-page stub; View history shows a revision table of
    10 seeded rows.
  - The bookmark toggles "Added to your watchlist", shown in a toast.
- **Page previews**:
  - Hovering an internal link for 500ms, or focusing it, shows a card with the target's title, a
    drawn thumbnail and a 2-sentence extract.
  - Moving the pointer onto the card keeps it open. Leaving it or pressing Escape closes it.
  - Reference superscripts `[12]` show the reference's text in the same way. Clicking one scrolls
    to it in "References" and briefly highlights it; the "^" back-link returns.
- **Infobox**: a drawn SVG Moon, the caption, and data rows: designations, orbital
  characteristics and physical characteristics. Each section has a header bar.
- **Images**: two thumbnails in the article body, floated, with captions. Clicking one opens a
  media viewer: a dialog with the image, its caption, and "Next" and "Previous" when there are
  several. Escape closes it.
- **Footnotes and references**: a numbered references list in two columns on desktop, and "See
  also" and "External links" sections. External links are text only, with no navigation.
- **Phones**:
  - Sections after the lead collapse into accordions, with headings that toggle and an arrow.
  - The header becomes a hamburger, the wordmark and a search icon.
  - Contents and Appearance live in the menu.
  - The infobox fills the width, after the first paragraph.
  - Tapping a link does not show a preview.
- **Print**: `@media print` hides the chrome.

## Visual direction

The reading experience comes first: a serif for headings, a sans-serif for the body, about 70
characters per line at Standard width, hairline rules under the headings, blue links (purple once
visited in this session), and plenty of whitespace. Dark mode is a true dark palette that keeps
the link colours distinguishable.

## Required copy

```
Lexipedia
The free encyclopedia
Moon
Contents
Appearance
Search Lexipedia
From Lexipedia, the free encyclopedia
References
See also
This article is a stub.
```

## States to show (final round)

- The article at desktop, tablet and mobile sizes.
- A link preview open.
- A reference preview open.
- The language dialog filtered.
- The text size set to Large, and the width set to Wide.
- Dark colour.
- The contents rail hidden and opened as a popover.
- The scroll-spy highlight midway down the page.
- The media viewer.
- The mobile accordion with one section open.
- A stub page.
- View history.

## Gates this brief leans on

- `check composition`: the heading hierarchy, and the infobox and lead grouping.
- `check integrity` at every width.
- `check a11y contrast` in light and dark.
- `check a11y focus`: previews on focus, the dialogs.
- `check interactions`: the combobox, disclosures, radio groups.
- `check scroll`: the sticky contents rail, the scroll spy.
- `stress media`: print, 200% zoom, forced colours.
- `stress i18n`: longer translations of the chrome.
- `check breakpoints --sweep`: the rails come and go.
- `check copy`.
