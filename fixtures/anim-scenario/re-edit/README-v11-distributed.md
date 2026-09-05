# Re-edit task (v11, distributed + values): one more event upstream

`vector-clock-values.scene.json` explains vector clocks with three processes.
Every vector on screen is a `value` annotation anchored at its process; the
narration's arithmetic is in the captions.

Change request from the author: **A has a second local event before it sends
to B.** Everything downstream of that has to follow: A's vector when it sends,
what B receives and computes, what B forwards, what C computes when B's
vector lands. The frozen readout of C's own local event must stay exactly as
it is — that is the point of freezing it.

Then **put the two closing claims on the picture instead of only in the
notes**: draw the concurrency claim as a plain line between A and C labelled
with `∥` (or the word "concurrent"), and afterwards the ordered claim as an
arrow from A to C whose label contains `≤`. The arrow replaces the line —
one should be visible at a time. Keep the two closing notes; shorten them if
you like, but the captions must still state both claims.

Requirements: exactly one new local event for A (a `value` update on `vecA`,
in the existing style, with a caption in the existing style); every vector
literal in a message label, a `value` text or a caption is consistent with
that event; `eventC` (the frozen readout) is not edited; the two claims use
`relate`.

Success: `vlmkit-anim check vector-clock-values.scene.json` exits 0 with no ✗
and no ⚠; `explain` shows B's vector ending `[2,1,0]` and C's ending `[2,1,2]`
and the frozen readout still `[0,0,1]`; the final frame shows the `≤` arrow
between A and C and not the `∥` line.

Write down, before your first `check`, A's vector when it sends, B's vector
after it receives, and C's final vector.
