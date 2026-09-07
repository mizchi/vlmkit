# Vector clocks: causality without a global clock — visual review vs geometry

reader: answers-haiku.json

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

notes: All frames have clean layouts. Text is readable throughout. The orange annotation labels (vector notations) in frames 7-10 are small but legible and properly contained within frame boundaries without overlapping main diagram elements. No clipping or offscreen elements detected.
