# Vector clocks: causality without a global clock — visual review vs geometry

reader: answers-sonnet.json

| frame | geometry | reader | agreement |
|---|---|---|---|
| 1 | — | — | neither |
| 2 | — | — | neither |
| 3 | — | — | neither |
| 4 | — | — | neither |
| 5 | — | — | neither |
| 6 | — | — | neither |
| 7 | — | — | neither |
| 8 | overlap: "[2,1,0]" on "∥" | — | geometry-only |
| 9 | overlap: "[2,1,0]" on "∥" | — | geometry-only |
| 10 | overlap: "[2,1,0]" on "≤" | — | geometry-only |
| 11 | overlap: "[2,1,0]" on "≤" | — | geometry-only |

11 frames · both 0 · reader only 0 · geometry only 4 · neither 7 · recall 0 (of the geometry's flagged frames, the reader saw) · precision 1 (of the reader's, the geometry agrees) · 0 reader issue(s) vs 4 geometry issue(s)

notes: The contact sheet renders each tile quite small (~400x250px), and the colored per-actor vector labels ('A: [2,0,0]', etc.) and the small arrow-value labels ('[2,0,0]', '[2,1,0]') are rendered at a very small font size — legible enough to transcribe values but at the edge of readability, so subtle overlaps at that scale could be missed. In frames 4 and 6, the in-flight message arrow is drawn as a filled dot on the sender's line plus a separate '>' chevron further along the path with a visible gap between them (no connecting line segment) — this reads as an intentional 'message in transit' animation state (consistent between the two frames) rather than a broken/disconnected arrow, so I did not flag it as 'arrow pointing at nothing', but I'm not fully certain that's the intended rendering versus a rendering gap. The orange 'C's local event (frozen): [0,0,1]' annotation in frames 6-11 sits close to the curved A-to-C concurrency/ordering arc and to C's box, but at this resolution I did not see it actually overlapping either.
