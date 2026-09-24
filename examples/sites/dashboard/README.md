# Keel Analytics — Overview (vlmkit demo site)

The Overview screen of **Keel Analytics**, a fictional web-analytics product, showing the fictional
**Harbor & Pine** store. It is one static page: an app shell with a collapsible sidebar, four KPI
cards with sparklines, a daily-visitors line chart with a keyboard-operable tooltip, a top-channels
bar chart, and a sortable, paginated table of recent orders. Built as a demo for
[vlmkit](https://github.com/mizchi/vlmkit); the log of how it was judged is in `judgment/`.

Open `index.html` straight from disk or from any sub-path — there is no build step, no dependency and
no network request. All data is inline in `data.js` and fixed (it ends on Tue 22 Sep 2026), so every
render is identical.

## URL parameters

| Parameter | Effect |
|---|---|
| `?theme=dark` | Force the dark theme (also the default). |
| `?theme=light` | Force the light theme. The account menu's "Light theme" switch changes it at runtime. |

Nothing animates on load, so there is no `?animate` switch; the few transitions (sidebar width,
channel bars) are disabled under `prefers-reduced-motion: reduce`.

## Widths

- **1280px and up**: sidebar expanded (240px), labels visible.
- **768–1279px**: sidebar collapsed to icons (72px); the toggle at its foot expands it, and labels
  show as tooltips on hover and focus.
- **Below 768px**: the sidebar becomes a bottom navigation bar; the orders table scrolls sideways in
  its own container with the order ID column pinned.

The content responds to its own width (container queries), so expanding the sidebar on a tablet
reflows the cards instead of squeezing them.

## Keyboard

- Date range: arrow keys move between 7 / 30 / 90 days (a native radio group).
- Chart: Tab to the chart, then ← / → move between days, Home / End jump to the ends, Page Up /
  Page Down move a week forward / back; the tooltip follows focus. With a pointer, hover a day; on a
  touch screen, tap a day (drag sideways to scrub, and tap elsewhere to dismiss).
- Account menu: Enter, Space or ↓ opens it; ↑ / ↓ / Home / End move; Escape closes and returns focus.
- Table: every column header is a sort button (`aria-sort` on the sorted column); the pager's
  status line ("Showing 1–6 of 12 orders") is a polite live region. Column widths are measured
  from all twelve orders, so paging and sorting never shift a column.

## Files

| File | What it is |
|---|---|
| `index.html` | The page: landmarks, static copy, the shell. |
| `styles.css` | Tokens for both themes, the shell, components, the three width regimes. |
| `data.js` | 180 days of visitors / orders / revenue, channel shares per range, 12 orders. |
| `app.js` | Rendering (KPIs, chart, channels, table) and every interaction. |
| `copy.txt` | The brief's required copy, one line each, for `vlmkit check copy --manifest copy.txt`. |
| `flow.json` | A 14-step `vlmkit verify flow` script: range, chart keys, sort, pager, sidebar, menu, theme, export. |
| `judgment/` | The judging log: every gate run, screenshot, look, defect and fix. |
