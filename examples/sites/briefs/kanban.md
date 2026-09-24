# Brief: task board app — "Sprintboard"

- **Directory**: `examples/sites/kanban/`
- **Pattern**: interactive app — kanban board with drag and drop
- **Language**: English

## What it is

**Sprintboard**, a fictional team task board, showing the board "Website relaunch". One page,
`index.html`. The board state lives in memory and a reload resets it to the seeded board, so every
gate run sees the same page.

## Layout and behaviour

- **Header**: the board name, the team as avatar initials, filter chips (All / Design / Frontend /
  Backend / Bug), a search field over card titles, and a "New task" button.
- **Columns**: Backlog, In progress, Review, Done — each header shows its card count and an add
  button; In progress has a work-in-progress limit of 3, shown as "3 / 3", and says so in text when
  the limit is exceeded.
- **Cards**: title, label chips (colour and text), assignee initials, due date (fixed dates; an
  overdue card says "Overdue" in text), checklist progress (for example "2/5"), and priority in text.
  Seed about 14 cards.
- **Drag and drop**: HTML5 drag and drop between columns and within one, with a visible drop
  position. **Keyboard alternative**: focus a card, Space picks it up, the arrow keys move it between
  columns and positions, Space drops it, Escape cancels. Each move is announced in a live region
  ("Moved 'Hero copy' to Review, position 2 of 3"). A card menu (⋯) offers "Move to…" as well.
- **Card detail**: clicking a card or pressing Enter opens a dialog with its description, labels,
  assignee, due date and checklist; ticking an item updates the card's progress. Focus is trapped and
  returned.
- **Add a card**: an inline form at the bottom of a column (title, Add, Cancel).
- **Motion**: a dropped card settles with a short transition (200ms at most); reduced motion
  removes it. `?animate=0` removes it too.
- **Phones**: the columns become a horizontal row that scrolls one column at a time (scroll snap).

## Visual direction

Playful but tidy: a light grey canvas, white cards with soft shadows, colourful labels that stay
legible, clear column boundaries, and a board that still reads when it is full.

## Required copy

```
Sprintboard
Website relaunch
Backlog
In progress
Review
Done
New task
Overdue
Add a card
```

## States to show (final round)

Desktop and mobile full board; a card picked up with the keyboard mid-move; the In progress limit
exceeded; the card detail dialog open; a filter applied; the add-card form open; a phone snapped to
the third column.

## Gates this brief leans on

`scan handlers --probe-drag` (drag and drop that is really wired), `check interactions` (keyboard
moves, menu, dialog), `check a11y focus`, `check animation` / `check motion` (the drop transition,
reduced motion), `check scroll` and `scan scroll` (snap columns on phones), `check design` (one card
component), `check grounding` (can a pixel-driven agent act on the board?).
