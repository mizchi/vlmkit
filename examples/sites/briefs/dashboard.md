# Brief: analytics dashboard — "Keel Analytics"

- **Directory**: `examples/sites/dashboard/`
- **Pattern**: SaaS analytics dashboard (app shell)
- **Language**: English

## What it is

The Overview screen of **Keel Analytics**, a fictional web-analytics product, for a fictional
store. One page, `index.html`, with all data inline and deterministic.

## Layout and behaviour

- **App shell**: a left sidebar (logo, Overview (current), Traffic, Conversions, Customers,
  Settings) that collapses to icons with a toggle; a top bar with the page title, a date-range
  control (7 days / 30 days / 90 days), an "Export CSV" button and a user menu button showing
  initials.
- **KPI cards**: Visitors, Conversion rate, Revenue, Average order value — each with its value, the
  change against the previous period, and an inline SVG sparkline. An increase or a decrease must
  read from an arrow and a sign in the text, not from colour alone.
- **Main chart**: an SVG line chart of daily visitors for the selected range, with axes, gridlines
  and a legend (this period solid, previous period dashed). Hovering or focusing a data point shows
  a tooltip with the date and value, and the arrow keys move between points.
- **Top channels**: a horizontal bar chart — Organic, Direct, Referral, Social, Email — with values
  and percentages.
- **Recent orders**: a table of 12 orders (order ID, customer, date, channel, status, amount) with
  sortable columns (`aria-sort`), status badges carrying text (Paid / Pending / Refunded / Failed),
  and pagination of 6 rows per page.
- The date range changes the KPI values, the chart and the channel bars (data for all three ranges
  is inline).
- **Theme**: dark by default — people keep this open all day — with a light theme; `?theme=light`
  and `?theme=dark` force one.
- **Widths**: sidebar expanded from 1280px, collapsed to icons from 768px, and below 768px a bottom
  navigation bar instead; the table scrolls sideways in its own container on phones, with the order
  ID column pinned.

## Visual direction

Dense but calm: a dark slate ground, one teal accent, semantic colours only where they mean
something, tabular figures everywhere numbers line up, a clear 8px spacing grid, cards that are
visibly the same component.

## Required copy

```
Keel Analytics
Overview
Visitors
Conversion rate
Revenue
Average order value
Last 30 days
Top channels
Recent orders
Export CSV
Showing 1–6 of 12 orders
```

## States to show (final round)

Desktop dark and light; the 90-day range selected; a chart tooltip showing; the orders table sorted
by amount; page 2 of the table; tablet with the sidebar collapsed; phone with the bottom
navigation and the table scrolled sideways.

## Gates this brief leans on

`check design` (the four KPI cards and the badges are one component each), `check color` (status
and deltas must not be colour-only), `check a11y contrast` in both themes, `scan scroll` and
`check scroll` (the table container, pinned column), `check interactions` (range control, sort,
pagination, sidebar toggle), `check breakpoints --sweep`.
