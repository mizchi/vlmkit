# Brief: documentation site — "Quarry" CLI docs

- **Directory**: `examples/sites/docs/`
- **Pattern**: documentation site
- **Language**: English

## What it is

The documentation for **Quarry**, a fictional command-line tool that copies data between databases
while both stay online. Three real pages sharing one stylesheet and one script:

1. `index.html` — **Getting started**: what Quarry is, install, first migration in four steps.
2. `migrations.html` — **Migrations**: how a migration runs (plan → copy → catch-up → cut-over),
   dry runs, rolling back, a short troubleshooting section.
3. `cli.html` — **CLI reference**: every command and its options, in tables.

## Layout and behaviour

- **Header**: the Quarry wordmark, a version badge `v2.4`, a search field that filters the sidebar
  as you type (client-side, over page and section titles), and a theme toggle (light / dark).
- **Sidebar**: the three pages grouped under "Guides" and "Reference", with each page's sections
  listed under it; the current page and section are marked (`aria-current`).
- **Article**: an `h1`, `h2` / `h3` sections, prose with inline code and links, code blocks with a
  **Copy** button (it copies the block and says "Copied" in a live region), callouts (Note,
  Warning), and on `cli.html` option tables. Prev / next page links at the bottom, then a footer
  with "Last updated 12 September 2026".
- **"On this page"**: a right-hand table of contents on wide screens that highlights the section in
  view as you scroll.
- **Widths**: three columns (sidebar · article · contents) from 1200px; two (no contents column)
  from 768px; below 768px one column, with the sidebar in a drawer opened by a "Menu" button.
  The drawer takes focus when it opens, closes on Escape and returns focus to the button.
- **Theme**: follows `prefers-color-scheme`, the toggle overrides it and remembers the choice in
  `localStorage`, and `?theme=light` / `?theme=dark` forces one (for gates and screenshots).
- Links in prose must be distinguishable from the text around them by more than colour.

## Visual direction

Crisp, quiet and technical — legibility first. Neutral greys, one accent colour, a comfortable
measure (about 70 characters), a monospace for code, and code blocks that read well in both themes.

## Required copy

```
Quarry moves data between databases while both stay online.
Getting started
Migrations
CLI reference
Install Quarry
Your first migration
How a migration runs
Dry runs
Rolling back a migration
Troubleshooting
On this page
Last updated 12 September 2026
A dry run changes nothing.
```

## States to show (final round)

Desktop in both themes; mobile with the drawer open; the sidebar filtered by a search term; a
"Copied" confirmation on a code block; the contents column highlighting a section other than the
first; `cli.html`'s tables at mobile width.

## Gates this brief leans on

`check composition` (three pages of heading levels), `check color` (links in prose),
`check a11y contrast` in both themes, `check interactions` (drawer, toggle, copy, search),
`check breakpoints --sweep`, `check scroll` / `scan scroll` (sticky sidebar and contents).
