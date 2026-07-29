# Interaction brief — Atlas Account page

All controls keyboard-operable with visible focus indicators. Copy is
quoted exactly; state screenshots show each open state.

1. **"Account actions"** — `button`, `aria-haspopup="menu"`,
   `aria-expanded` (starts false), `aria-controls` the menu.
   Enter/click opens the menu (`target-heavy-menu.png`):
   - focus MOVES to the first menuitem,
   - menu items (role=menuitem, top to bottom): `Export data`,
     `Transfer ownership`, `Sign out everywhere`,
   - ArrowDown/ArrowUp cycle focus through the items (wrapping),
   - Escape closes the menu AND returns focus to the trigger,
   - activating a menuitem closes the menu and returns focus.
2. **"Delete account…"** — `button`, `aria-haspopup="dialog"`.
   Enter/click opens a MODAL dialog (`target-heavy-dialog.png`):
   - title: `Delete this account?`
   - body: `All guides, corrections, and subscriptions are removed
     within 24 hours. This cannot be undone.`
   - buttons: `Cancel` (receives initial focus) and `Delete account`.
   - Tab focus is TRAPPED inside the dialog while open,
   - Escape closes the dialog AND returns focus to the trigger.
3. Page heading: `Account`. No other interactive elements. No
   animations. Rest state = `target-heavy-rest.png` (menu and dialog
   closed).
