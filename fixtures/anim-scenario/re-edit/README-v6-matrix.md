# Re-edit task (v6, matrix): a different pivot row

`matrix-pivot.scene.json` shows one step of Gaussian elimination on a 3×3
system: the first row has a 0 in column x, so the scene swaps rows so that
the pivot is 3, marks it, and clears the x entry of the last row.

Change request from the author: **the pivot should be the largest entry
in column x, which is still 3 — but the row that gets cleared should be the
one that now sits in the middle (the original r0, `[0, 2, 1, 4]`), not the
bottom row.** So after the swap, clear the x entry of the *middle* row and
narrate it. The original r0 already has 0 in column x, so the caption should
say the row is already clear and its other entries do not change.

Requirements: keep the swap and the mark as they are; every `set` must
target the row you mean **after** the swap; captions must still read
correctly for the row they describe; do not change the initial `cells`.

Success: `vlmkit-anim check matrix-pivot.scene.json` exits 0 with no ✗;
`explain` reads coherently; the final frame's middle row reads
`0, 2, 1, 4` and the bottom row still reads `1, 1, 1, 6`.

Write down, before your first `check`, which `[row, col]` references you are
changing and why.
