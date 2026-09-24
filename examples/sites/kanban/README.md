# Sprintboard — "Website relaunch" board

A vlmkit demo site: **Sprintboard**, a fictional team task board, showing one board, *Website relaunch*.
One static page, no build step, no dependencies, no network requests. It will be served at
`https://mizchi.github.io/vlmkit/sites/kanban/`. The log of how it was built and judged lives in
[`judgment/`](judgment/). It records every gate run, every screenshot, what was seen in each, and
which problems were found by eye and which by a gate.

## What it does

- **Header**: board name, the team as avatar initials, label filter chips (All / Design / Frontend /
  Backend / Bug), a search over card titles, and **New task** (opens the Backlog's add form).
- **Columns**: Backlog, In progress, Review, Done. Each header shows its card count and a **+**.
  In progress has a work-in-progress limit of 3 ("WIP 3 / 3"). Over the limit, the column turns red
  and says so in words.
- **Cards**: labels, assignee, title, priority in text, checklist progress, due date. The board's
  "today" is fixed at Wed, Sep 23, 2026, so an overdue card always says **Overdue**.
- **Drag and drop** (HTML5): drag a card between columns or within one. A line shows where it will
  land, and the slot it left becomes a dashed placeholder.
- **Keyboard**: focus a card, **Space** picks it up, the **arrow keys** move it between columns and
  positions, **Space** drops, **Escape** cancels. Each move is announced in a live region
  ("Moved 'Hero copy' to Review, position 2 of 3"), and a hint bar shows the same to sighted keyboard
  users. **Enter** opens the card. **Shift+F10** (or the **⋯** button) opens its menu with **Move to…**.
- **Card detail**: a modal dialog with the description, labels, assignee, due date and checklist.
  Ticking an item updates the card's progress. Focus is trapped inside and returned to the card on close.
- **Add a card**: an inline form at the foot of each column (title, Add, Cancel). Enter adds, Escape cancels.
- **Phones** (≤640px): the columns become a horizontal row that snaps one column at a time, with
  a segmented switcher above it. Between 641 and 1179px the board scrolls sideways at fixed column widths.
- **Motion**: a dropped card settles in 180ms. `prefers-reduced-motion` removes it, and so does `?animate=0`.

The board lives in memory. A reload resets it to the seeded 14 cards, so every visit and every
gate run sees the same page.

## URL parameters

| Parameter | Effect |
|---|---|
| `?animate=0` | No drop settle and no transitions (the same as reduced motion). |
| `?replay=drop` | On load, drops "Hero copy" into Review at position 2, through the same code path a drop uses, so `vlmkit check animation "index.html?replay=drop"` can frame-sample the settle. Without it nothing moves on load. |

The two combine: `?replay=drop&animate=0` makes the move with no animation.

## Files

| File | Contents |
|---|---|
| `index.html` | Markup: header, the four column shells, dialog, live region. |
| `styles.css` | All styling. Every colour is a token on `:root`. Responsive and reduced-motion rules at the end. |
| `app.js` | Seed data, rendering, filters, keyboard moves, drag and drop, card menu, dialog, add form. Classic script, no modules. |
| `copy.txt` | The brief's required copy, one line each, for `vlmkit check copy --manifest copy.txt`. |
| `judgment/` | The judging log (written by `examples/sites/judge.mjs`, not by hand). |
