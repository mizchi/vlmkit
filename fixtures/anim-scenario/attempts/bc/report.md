# Attempt bc — list-lru (sonnet)

First attempt: 0 ✗, **2 ⚠**. The scene was never edited after round 1: the two warnings were investigated with scratch scenes and found to be a compiler artifact, not something the documented ops could route around. Scene 904 B on disk / 780 B minified.

Success criteria met: final order `d → a → c → ∅`, confirmed by `explain` and by node x positions in the end SVG; the eviction line names `b` — "but only because I wrote that caption myself; the tool's generated remove caption is generic".

What helped: the `kind: list` op table plus the caption rules were sufficient to write the whole scene from the guide alone.

Missing / confusing: "the guide never documents what happens to the arrow of a removed node. I had to reverse-engineer via scratch scenes that any `remove` followed later by any `insert` leaves exactly one dead `arr-N.opacity` track and a ⚠, independent of value, position, or spacing (`insert a; remove a` → 0 ⚠; `insert a; remove a; insert c` → 1 ⚠). Since the brief's own instructions mandate two remove-then-insert pairs, 2 ⚠ appear unavoidable using only the documented op vocabulary. Without it I couldn't tell from the guide whether the ⚠s meant my scene was wrong."

Guesses: "move to front" = remove + insert at 0 (the brief said so; the guide never mentions recency); `find` is read-only (right); eviction = `remove` of the tail (right, framed in the caption since the tool has no evict vocabulary).
