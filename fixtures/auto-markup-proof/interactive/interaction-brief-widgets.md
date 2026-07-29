# Interaction brief — Atlas Shop page

All controls keyboard-operable with visible focus indicators. Copy is
quoted exactly. `target-widgets-states.png` shows: second option
selected, cart status updated.

1. **Guide listbox** — `role=listbox`, labelled `Choose a guide`,
   single tab stop (`tabindex="0"`), **aria-activedescendant style**
   (DOM focus stays on the list; the active option is referenced by
   id). Options (role=option, top to bottom, copy exact):
   `High passes of the Atlas` (initially selected), `Kii Peninsula by
   rail`, `Puglia's white towns`, `Faroe ridgelines`.
   ArrowDown/ArrowUp move BOTH aria-selected and aria-activedescendant
   (clamped at the ends, no wrap). Selected option style per states
   screenshot.
2. **Delivery week grid** — `role=grid`, aria-label `Delivery week`,
   2 rows × 4 columns of `role=gridcell` cells labelled `W1`…`W8`.
   Roving tabindex (one cell in the Tab order); ArrowRight/Left/Down/Up
   move focus between cells (no wrap past edges).
3. **"Add to cart"** — `button`. Enter/click updates the status line
   (`role=status`, a live region) from `Cart is empty.` to
   `Added “<selected option text>” to cart.` (curly quotes, exact).
4. Page heading `Shop`; section headings `Choose a guide` and
   `Pick a delivery week`.
   No other interactive elements, no animations, no other event
   handlers (no hover effects beyond CSS).
