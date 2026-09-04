# Brief: 0/1 knapsack, the table filling in

Produce `scene.json` (kind `matrix`) that explains the 0/1 knapsack DP table
for three items and capacity 5:

| item | weight | value |
|---|---|---|
| A | 1 | 1 |
| B | 3 | 4 |
| C | 4 | 5 |

Rows are "items considered so far" (`none`, `A`, `B`, `C`), columns are
capacities `0..5`. The `none` row is all zeros and is given up front; the
other three rows start empty and fill in cell by cell, left to right.

Story beats: for each cell, show where the value came from — the cell above
(item skipped) or the cell above-and-left plus the item's value (item taken).
Caption the cells where taking the item beats skipping it; the rest can keep
the generated caption. Finish by marking the answer cell.

Success: `vlmkit-anim check scene.json` exits 0 with no ✗ and no ⚠, the
bottom-right cell reads **6** at the end and is marked, and
`vlmkit-anim explain scene.json` reads as a narration a newcomer can follow.
