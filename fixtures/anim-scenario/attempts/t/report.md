# Attempt t — matrix-knapsack (sonnet)

First-attempt errors: 0. Warnings: 0. Rounds to green: 1. Scene bytes: 1824 B minified (`check`'s reported figure; the pretty-printed file on disk is 2323 B — worth knowing since the two don't match).

Success criteria: all met. `explain` line 19: `C weighs 4, worth 5: taking it (1+5=6) beats skipping (5)`; line 20: `Answer: best value with capacity 5 is 6`. Cell (3,5) is set to 6 then `mark`ed. The narration reads as a plain top-to-bottom fill; non-"beats" cells fall back to the generated `(row, col) = v (from …)` line, which is legible but doesn't say *why* (e.g. row C col 4 is a 5-vs-5 tie with no comparison stated).

What helped: the worked edit-distance example gave the `cells`/`ops`/`set`/`from`/`mark` shapes immediately, and "Cell references are `[row, col]`, 0-based, by current position" settled the coordinate convention with zero guessing.

What was missing: the guide never shows what the *generated* caption looks like for a `from` with one vs. two sources, or for a plain overwrite — I only learned the format (`(rowLabel, colLabel) = value (from …)`) by running `explain`, not from the doc. Quote: "`from` names the cells it was computed from, which flash while a token flies from each into the target" — true but silent on whether the caption also *names* them (it does). Wanted sentence: "with no caption, the default reads `(rowLabel, colLabel) = value (from (rowLabel, colLabel), …)`; write your own once two-or-more cells are compared for a reason, since the default states the inputs but not why one won."

Guesses: (1) listing both skip/take source cells in `from` whenever a real choice existed vs. one cell when the item couldn't fit — accepted silently, confirmed correct by the step-5 render (both sources animated in), but every guide example shows only single-entry `from`, so this was unconfirmed by the doc itself. (2) `mark` takes a bare `{"cell":[r,c]}` + `caption` — correct by analogy with the `T` union table. (3) label arrays index 1:1 with `cells` in given order — correct.
