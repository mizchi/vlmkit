# Re-edit task (v7, array): a target that takes work

`array-two-sum.scene.json` shows the two-pointer pair search finding its
answer on the very first comparison, which teaches nothing.

Change request from the author: **change the target to 15** and write the
walk by hand (keep explicit `ops`, do not switch to `algorithm`). Every
comparison is a beat whose caption gives the sum and says which pointer
moves and why; the pair that sums to 15 is marked at the end. Keep the
opening caption's style.

Requirements: the pointers move one index at a time; no comparison is
skipped; the final `mark` is the pair that actually sums to 15; the title
says 15.

Success: `vlmkit-anim check array-two-sum.scene.json` exits 0 with no ✗ and
no ⚠; `explain` lists every comparison in order; the final frame has exactly
the two cells of the answer in the done colour.

Write down, before your first `check`, the sequence of (i, j, sum) you
expect the walk to visit.
