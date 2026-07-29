# Interaction brief — Atlas Preferences page

All controls are keyboard-operable with visible focus indicators
(`:focus-visible` outline). Expected event → state transitions:

1. **"Shipping options"** — `button`, `aria-expanded` (starts false),
   `aria-controls` the shipping panel. Enter/click toggles
   `aria-expanded` and shows/hides the panel. `target-states.png`
   shows the open state.
2. **Notification channel tabs** — `tablist` "Notification channels"
   with three `tab`s: Email (initially selected), Push, Digest.
   Roving tabindex: exactly ONE tab is in the Tab order at a time.
   ArrowRight/ArrowLeft move selection AND focus (selection follows
   focus); `aria-selected` updates on all tabs; each tab's
   `aria-controls` panel shows only for the selected tab.
   `target-states.png` shows Push selected.
3. **"Marketing emails"** — `switch` (role=switch, `aria-checked`,
   labelled by the row text). Space/Enter/click toggles
   `aria-checked`. `target-states.png` shows it on.
4. **"Privacy policy"** — plain link, focusable, no state.

No other interactive elements. No animations.
