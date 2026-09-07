# Vector clocks — visual review vs geometry

reader: answers-haiku.json

| frame | geometry | reader | agreement |
|---|---|---|---|
| 1 | — | — | neither |
| 2 | — | — | neither |
| 3 | — | — | neither |
| 4 | — | — | neither |
| 5 | overlap: "a" on "copied from A"; overlap: "b" on "copied from A"; overlap: "a"; overlap: "b" | — | geometry-only |
| 6 | overlap: "a" on "copied from A"; overlap: "b" on "copied from A"; overlap: "a"; overlap: "b" | — | geometry-only |
| 7 | overlap: "a" on "copied from A"; overlap: "b" on "copied from A"; overlap: "a"; overlap: "b" | — | geometry-only |
| 8 | overlap: "a" on "copied from A"; overlap: "b" on "copied from A"; overlap: "0" on "ordered"; overlap: "a"; overlap: "b" | — | geometry-only |
| 9 | overlap: "a" on "copied from A"; overlap: "b" on "copied from A"; overlap: "0" on "ordered"; overlap: "a"; overlap: "b" | — | geometry-only |
| 10 | overlap: "a" on "copied from A"; overlap: "b" on "copied from A"; overlap: "0" on "ordered"; overlap: "a"; overlap: "b" | — | geometry-only |
| 11 | overlap: "a" on "copied from A"; overlap: "b" on "copied from A"; overlap: "0" on "ordered"; overlap: "a"; overlap: "b" | — | geometry-only |
| 12 | overlap: "a" on "copied from A"; overlap: "b" on "copied from A"; overlap: "0" on "ordered"; overlap: "a"; overlap: "b" | — | geometry-only |
| 13 | overlap: "a" on "copied from A"; overlap: "b" on "copied from A"; overlap: "0" on "ordered"; overlap: "a"; overlap: "b" | — | geometry-only |

13 frames · both 0 · reader only 0 · geometry only 9 · neither 4 · recall 0 (of the geometry's flagged frames, the reader saw) · precision 1 (of the reader's, the geometry agrees) · 0 reader issue(s) vs 42 geometry issue(s)

notes: All frames have clean layout. Text is legible throughout. Vector clock tables, annotations, labels, arrows, and code blocks are all properly positioned with no overlaps, clipping, or offscreen elements.
