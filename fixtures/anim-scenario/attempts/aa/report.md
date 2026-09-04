# Attempt aa — array-partition (sonnet)

First attempt green: 0 errors, 0 warnings, 1 round. `check` reported 1746 B for the scene (2036 B pretty-printed on disk). `explain` produced 24 steps (22 authored + Start + End) reading as intended, e.g. "j=1: a[1]=2 vs pivot 5. 2 is smaller — swap it into position i=0." and the closing "5 is now in its final place: everything left of it is smaller, everything right is larger."

Verified via `render --at end`: reading each `cell-N` group's translate against the index-label slot positions gives the final row `2, 4, 3, 5, 9, 8, 7`; `cell-6` (value 5) sits at position 3 with fill #22c55e. All success criteria met.

What helped: the `array` table's explicit op list with exact JSON shapes made it possible to write ops by hand without seeing the source, and "Indices are 0-based positions and every pointer has its own lane" removed the biggest ambiguity — no guessing whether `swap` used original or current indices.

Guesses (all correct): (1) whether `pointers` accepts a partial update like `{"j": 1}` without repeating `i` — the only example always supplies both; it worked. (2) Whether `compare` on `array` truly moves nothing — the guide states this under `sort` and only implies it carries over. I'd add "as in `sort`, `compare` never moves anything" directly in the `array` row.

No ⚠/✗ ever appeared; the `array` section was sufficient standalone.
