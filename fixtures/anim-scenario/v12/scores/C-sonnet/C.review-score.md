# Batched Pandora's Box: one adaptive run (k=2, T=1/5) — visual review vs geometry

reader: answers-sonnet.json

| frame | geometry | reader | agreement |
|---|---|---|---|
| 1 | — | — | neither |
| 2 | — | — | neither |
| 3 | — | — | neither |
| 4 | — | — | neither |
| 5 | overlap: "Batch 1" on "best so far:" | — | geometry-only |
| 6 | overlap: "Batch 1" on "best so far:" | — | geometry-only |
| 7 | — | — | neither |
| 8 | — | — | neither |
| 9 | — | — | neither |
| 10 | overlap: "box2" on "kept 6 > 1/2" | — | geometry-only |
| 11 | overlap: "box2" on "kept 6 > 1/2" | — | geometry-only |

11 frames · both 0 · reader only 0 · geometry only 4 · neither 7 · recall 0 (of the geometry's flagged frames, the reader saw) · precision 1 (of the reader's, the geometry agrees) · 0 reader issue(s) vs 4 geometry issue(s)

notes: The contact sheet tiles are small (roughly 370x140px each), so the colored side annotations (e.g. the 'setup 0.2+0.2 + boxes ...' cost readouts and 'best so far' readouts in frames 5-11, and the small 'Box=2'/batch labels near the box grid in frames 3, 4, 7, 10, 11) render at very small font size. I could not fully confirm at this resolution whether any of that small text is clipped at its own edge or slightly overlapping the box grid outlines versus just sitting close to them with clear whitespace. Based on what I could resolve, none of it appeared to be cut off at a tile border or sitting on top of another element, but I'd treat that read as low-confidence rather than a clean bill of health -- a higher-resolution crop of frames 5, 6, 8, 9, and 11 (the ones with the most side annotation text) would be needed to be fully certain there is no overlap or clipping. No clear overlap, clipped text, offscreen elements, or stray arrows/lines were identified within any frame at the resolution available.
