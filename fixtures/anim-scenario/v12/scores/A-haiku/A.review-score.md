# Vector clocks — visual review vs geometry

reader: answers-haiku.json

| frame | geometry | reader | agreement |
|---|---|---|---|
| 1 | — | — | neither |
| 2 | — | — | neither |
| 3 | — | — | neither |
| 4 | — | — | neither |
| 5 | — | — | neither |
| 6 | overlap: "a" on "copied from A"; overlap: "b" on "copied from A"; overlap: "a"; overlap: "b" | — | geometry-only |
| 7 | overlap: "a" on "copied from A"; overlap: "b" on "copied from A"; overlap: "a"; overlap: "b" | — | geometry-only |
| 8 | overlap: "a" on "copied from A"; overlap: "b" on "copied from A"; overlap: "a"; overlap: "b" | — | geometry-only |
| 9 | overlap: "a" on "copied from A"; overlap: "b" on "copied from A"; overlap: "0" on "ordered"; overlap: "a"; overlap: "b" | — | geometry-only |
| 10 | overlap: "a" on "copied from A"; overlap: "b" on "copied from A"; overlap: "0" on "ordered"; overlap: "a"; overlap: "b" | — | geometry-only |
| 11 | overlap: "a" on "copied from A"; overlap: "b" on "copied from A"; overlap: "0" on "ordered"; overlap: "a"; overlap: "b" | — | geometry-only |

11 frames · both 0 · reader only 0 · geometry only 6 · neither 5 · recall 0 (of the geometry's flagged frames, the reader saw) · precision 1 (of the reader's, the geometry agrees) · 0 reader issue(s) vs 27 geometry issue(s)

notes: All frames displayed cleanly with readable text, proper spacing between elements, no overlaps, no clipping, and no offscreen elements. The contact sheet tiles are at sufficient size for legibility. Code box in frames 10-11 is positioned clearly on the right side without obscuring the grid or captions.
