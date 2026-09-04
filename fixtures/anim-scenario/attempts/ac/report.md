# Attempt ac — re-edit array-two-sum (haiku)

Attempt 1: 0 errors, 0 warnings; green immediately.

Success criteria met: `explain` lists every comparison in order ("1 + 12 = 13: less than 15, move i right" → "3 + 12 = 15: found the target"); the final frame has exactly two green cells, `cell-1-rect` (3) and `cell-6-rect` (12); the title says 15.

Prediction vs actual: perfect match — walk (0,6,13) → (1,6,15), marked pair indices 1 and 6.

Readable because: "`{"pointers": …}` creates or moves named pointers" explicitly permits reuse; the op list made the structure obvious; "a `caption` on an op replaces the generated caption for that beat" enabled narrative control.

Ambiguous: the guide does not explicitly state whether moving pointers creates a step — `ms: 0` "applies it inside the previous beat with no step of its own" implies the default creates one, but it is inferred. Wanted: "By default a `pointers` op creates a step; use `ms: 0` to move them silently inside an earlier beat." The caption pattern for comparisons (sum + direction) was inferred from the brief, not modelled in the guide's array examples.

No diagnostics fired.
