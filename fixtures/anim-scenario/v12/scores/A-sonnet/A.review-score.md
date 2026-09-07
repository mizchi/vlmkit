# Vector clocks — visual review vs geometry

reader: answers-sonnet.json

| frame | geometry | reader | agreement |
|---|---|---|---|
| 1 | — | — | neither |
| 2 | — | — | neither |
| 3 | — | — | neither |
| 4 | — | — | neither |
| 5 | — | — | neither |
| 6 | overlap: "a" on "copied from A"; overlap: "b" on "copied from A"; overlap: "a"; overlap: "b" | overlap: the orange 'copied from A' callout box sits directly on top of the column header row (the small gray 'a'/'b' labels above column a/b are covered by the box) | both |
| 7 | overlap: "a" on "copied from A"; overlap: "b" on "copied from A"; overlap: "a"; overlap: "b" | overlap: the orange 'copied from A' callout box still sits on top of the column header row (a/b labels hidden under it) | both |
| 8 | overlap: "a" on "copied from A"; overlap: "b" on "copied from A"; overlap: "a"; overlap: "b" | overlap: the orange 'copied from A' callout box still covers the column header row (a/b labels hidden under it) | both |
| 9 | overlap: "a" on "copied from A"; overlap: "b" on "copied from A"; overlap: "0" on "ordered"; overlap: "a"; overlap: "b" | overlap: the orange 'copied from A' callout box still covers the column header row (a/b labels hidden under it); other: the 'ordered' readout near row C is crowded right against the vertical 'A | C' arrow/label and the row-C letter on the left margin, close enough that it reads as sitting on top of them | both |
| 10 | overlap: "a" on "copied from A"; overlap: "b" on "copied from A"; overlap: "0" on "ordered"; overlap: "a"; overlap: "b" | overlap: the orange 'copied from A' callout box still covers the column header row (a/b labels hidden under it); other: the 'ordered' readout near row C is crowded right against the vertical 'A | C' arrow/label and the row-C letter on the left margin, close enough that it reads as sitting on top of them | both |
| 11 | overlap: "a" on "copied from A"; overlap: "b" on "copied from A"; overlap: "0" on "ordered"; overlap: "a"; overlap: "b" | overlap: the orange 'copied from A' callout box still covers the column header row (a/b labels hidden under it); other: the 'ordered' readout near row C is crowded right against the vertical 'A | C' arrow/label and the row-C letter on the left margin, close enough that it reads as sitting on top of them | both |

11 frames · both 6 · reader only 0 · geometry only 0 · neither 5 · recall 1 (of the geometry's flagged frames, the reader saw) · precision 1 (of the reader's, the geometry agrees) · 9 reader issue(s) vs 27 geometry issue(s)

notes: Tiles are small (roughly 400x160px each in the contact sheet) so fine text is at the edge of legibility rather than clearly illegible: the rotated 'A | C' label, the small monospace code box in frames 10-11 ('on receive(v): clock = max(clock, v) / clock[self] += 1'), and the 'ordered' readout near row C in frames 9-11 are all small and close together, so I flagged the crowding as a low-confidence 'other' issue rather than a confident 'overlap' -- at this resolution I cannot be fully sure whether the 'ordered' text is truly overlapping the arrow/row-C label or just tightly adjacent to it. The clearest, high-confidence defect is the 'copied from A' callout box sitting on top of / hiding the column header row (a/b) in frames 6-11, which matches the overlap example given in the brief (label on a column header). I did not see any clipped text at tile edges, offscreen arrows/boxes, or overlap issues in frames 1-5.
