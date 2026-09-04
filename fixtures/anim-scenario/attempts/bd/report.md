# Attempt bd — re-edit list-playlist (haiku)

First attempt: 0 ✗, 1 ⚠ (an opacity track with a constant value, unrelated to correctness). Rounds to green: 1.

Success criteria met: `explain` ends "Reverse the playlist to play it backwards: outro is now the head" → "From the new head, outro is right here: 0 hops to find it" → "List: outro → chorus → bridge → chorus → verse → ∅"; the final frame reads the same left to right. Predicted order and hop count (0) both exact; 6 ops as predicted.

What made intent readable: the `after` / `at` distinction ("right after the first node holding w"); the reverse sentence ("the arrows turn around, then the boxes trade places so the list reads head-first again") made the new head obvious; the existing captions set the style; the example showed `reverse` and `find` in context.

Ambiguous: "hops" was never formally defined — transitions, not nodes, had to be inferred. Wanted: "The hop count is the number of transitions (arrows) from the head to the target; finding a node at the head is 0 hops." The guide does not show `reverse` on a list with duplicate values; "boxes trade places" answered it.

Diagnostics: none needed; the ⚠ was a rendering artifact.
