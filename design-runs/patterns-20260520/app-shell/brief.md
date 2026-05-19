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
- Active navigation and selected content state must be visible.

## Expected signal

`--goal layout` should catch broad shell drift, but it cannot yet prove nested
scroll behavior. The dogfood script checks scrollport invariants separately.

