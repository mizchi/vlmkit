# Attempt x — re-edit matrix-pivot (haiku)

First-attempt results: 0 errors, 0 warnings. Rounds to green: 1. Success criteria: all met.

Changes made: replaced the four `set` operations that cleared row 2 with a single `set` on cell [1, 0] (the middle row after the swap), value 0, caption "r0 already has 0 in column x: no elimination needed for the middle row".

Final grid, read off the end SVG by row position: top r1 → [3, 1, 0, 5] (pivot marked green); middle r0 → [0, 2, 1, 4]; bottom r2 → [1, 1, 1, 6].

Prediction vs actual: accurate. Cell reference [1, 0] targeted the middle row position after the swap; the original r0 label moved with its data, so referencing [1, 0] modified the intended row.

Made intent readable: guide line "Cell references are `[row, col]`, 0-based, **by current position** (after a swap, row 0 is whatever is now on top)" — precisely specifies that indices reference current positions, not original identities; "swap: … (labels move with them)" confirms labels track reordered rows.

Ambiguous / missing: the guide does not show an example where a `set` assigns a value already present (0 → 0). A note stating "A `set` is valid even when the current value matches the target, useful for annotating unchanged cells" would clarify. Row label behaviour could be more explicit: labels preserve the original row identifiers and move with their data.

The scene was readable enough to edit correctly on the first attempt from the guide alone.
