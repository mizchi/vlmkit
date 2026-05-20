# App shell dogfood brief

## Pattern

Discord-like sidebar UI: persistent rail, secondary sidebar, main scrollport,
right detail panel, selected state.

## Contract

- Viewport: 1440x900, DPR 1.
- Source of truth: viewport shell and independent scrollports.
- Body should not be the scrolling container.
- Rail, sidebar, main, and right panel should map to stable grid areas.
- Channel list, message list, and member list are independent scrollports.
- UI Contract `expectedScrollports` must list those scrollports with selector
  and axis.
- Active navigation and selected content state must be visible.
- UI Contract `requiredStates` must include selected state.
- UI Contract `requiredStates` should include scrolled state for each expected
  scrollport.

## Expected signal

`build component --contract ui.contract.json` should infer `--goal app-shell`,
catch broad shell drift plus named expected scrollport breakage, and capture a
`scrolled` state snapshot for expected scrollports. The dogfood script still
checks scrollport invariants separately as a pattern-specific oracle.
