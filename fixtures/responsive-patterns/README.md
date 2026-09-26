# Responsive patterns, and one way each one breaks

Eleven small pages, each implementing one classic responsive UI pattern the way it is
meant to be built, and eleven mutants — each pattern plus **one** change. Three reproduce a defect the demo-site
round found (`docs/reports/2026-09-23-demo-sites-v1.md`: magazine D30, docs D24, shop D7),
two are variants of one, one is the off-by-one the repo already had a fixture for, and the
rest are constructed breaks of the same kind; `from` in `mutations.json` says which. They are the paired-mutant set behind
`vlmkit check responsive`: every intact page must be silent at every generated viewport,
and every mutant must report its defect, shrunk to the breakpoint that bounds it, with the
declaration that causes it.

```sh
vlmkit check responsive fixtures/responsive-patterns/patterns/card-grid.html        # silent
vlmkit check responsive fixtures/responsive-patterns/mutants/card-grid--fixed-four.html
node fixtures/responsive-patterns/build.mjs            # rewrite mutants/ after editing a pattern or mutations.json
```

| pattern | what it does | mutant | the one change | reported as |
|---|---|---|---|---|
| [`masthead`](patterns/masthead.html) | stacks below 1024px, one row above (Japanese) | `masthead--row-too-early` | the row starts at 560px | `text-starved` 560–771px, starts at the 560px breakpoint; move verified to 772px; cause `flex-wrap: nowrap` |
| [`card-grid`](patterns/card-grid.html) | docs shell, cards flow by available width (`auto-fit`) | `card-grid--fixed-four` | four fixed columns from 768px | `text-starved` 768–825px; move verified; cause `grid-template-columns: repeat(4, …)` in the 768px query |
| [`sidebar-layout`](patterns/sidebar-layout.html) | column drop: nav at 768px, contents at 1200px | `sidebar-layout--rigid-article` | `min-width: 38rem` on the article from 768px | `page-overflow-x` 768–882px; move verified; cause the `min-width` |
| [`data-table`](patterns/data-table.html) | table scrolls inside its card; stacked cards below 600px | `data-table--clipped-scroller` | the scroller clips instead | `clipped-content` 600–690px; move verified; cause the table's `min-width: 640px` |
| [`form-row`](patterns/form-row.html) | field grows, button keeps its size, row wraps | `form-row--rigid-input` | `nowrap` + `min-width: 17rem` | `page-overflow-x` 320–407px, no breakpoint bounds it; cause `flex-wrap: nowrap` |
| [`media-object`](patterns/media-object.html) | thumbnail, flexible text, price | `media-object--rigid-price` | `flex-basis: 11rem` on the price | `page-overflow-x` 320–374px and `text-starved` 320–417px; cause `flex-basis: 11rem` |
| [`hero`](patterns/hero.html) | split hero whose height follows its content | `hero--fixed-height` | `height: 100vh; overflow: hidden` | `clipped-content` that **needs a short viewport** (height ≈ 578px); cause `height: 100vh` |
| [`drawer`](patterns/drawer.html) | off-canvas nav below 768px, sidebar above | `drawer--peeking` | drawer `85vw` wide, pushed out by `18rem` | `occluded-text` 498–767px, cleared at the 768px breakpoint; cause `width: 85vw` |
| [`pricing`](patterns/pricing.html) | desktop-first: 3 fixed columns, 2 below 1100px, 1 below 768px | `pricing--orphan-width` | the tablet query gains `min-width: 769px` | `page-overflow-x` at **exactly 768px**, a one-pixel regime; cause `grid-template-columns: repeat(3, 20rem)` |
| [`toolbar`](patterns/toolbar.html) | rem-sized controls that grow with the reader's text | `toolbar--fixed-height` | `height: 36px; overflow: hidden` | `text-clipped` at every width **once text is 2x** (run with `--text-scale 2`); cause `height: 36px` |
| [`container-card`](patterns/container-card.html) | cards laid out by their own width (`@container`) | `container-card--early-row` | the row layout starts at 16rem | `text-starved` in three viewport ranges, no media breakpoint bounds them; cause `grid-template-columns` in the `@container` rule |

`mutations.json` holds each mutant's change, the demo-site defect it reproduces (`from`)
and what the gate must report (`expect`); `build.mjs` writes `mutants/`, and
`packages/vlmkit-markup/src/stress/responsive-pbt.test.ts` fails when a committed mutant
is stale or a report stops matching. `responsive-patterns.test.ts` holds the intact half.
Exact interval edges are asserted only where a breakpoint pins them — the other edge
depends on the fonts' metrics. The pages name `Liberation Sans` and `IPAPGothic`, which
`playwright install --with-deps` puts on CI and which this repo's sandboxes have.

How the other gates see the same mutants, and why: `docs/reports/2026-09-26-responsive-pbt-v1.md`.
