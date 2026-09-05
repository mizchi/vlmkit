# Re-edit task (v11, matrix + relate): the concurrency ends

`vector-clock-relate.scene.json` is a small vector-clock walk on a 3×3
matrix (rows = processes, columns = slots). A `value` readout beside row A
shows A's vector; a `relate` line marks A and C as concurrent (`A ∥ C`)
because neither has heard from the other; a `group` outlines the ordered pair
A, B.

Change request from the author: **after the existing steps, C sends its
vector to A.** A receives `[0,0,1]`, takes the slot-wise max with its own
row, then increments its own slot. Show the receive the way the scene already
shows B's receive (a `set` with `from`), update A's readout in place, and
**retire the concurrency claim**: A and C are no longer concurrent — C's
event happened-before A's receive — so the `∥` line must be gone at the end
and an arrow from C to A whose label contains `≤` must be there instead. The
"ordered" outline around A and B stays; the code block at the end stays last
or moves — your call — but the receive must be narrated.

Requirements: row A's final cells are `2, 0, 1`; A's readout (`vA`) is
updated with the same id, not a new one; the `∥` relation is removed or
replaced (same id, or `null`) rather than left under the new arrow; the new
arrow is a `relate` from a C anchor to an A anchor.

Success: `vlmkit-anim check vector-clock-relate.scene.json` exits 0 with no ✗
and no ⚠; `explain` shows `A = [2,0,1]` and a caption containing `≤`; the
final frame reads row A as `2 0 1`, shows one relation arrow with a `≤` label
and no `∥` line.

Write down, before your first `check`, A's vector after the receive.
