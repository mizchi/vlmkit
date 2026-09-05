# Visual review: Vector clocks

The image is a contact sheet: every frame of one explanatory animation, in reading order, each
tile labelled with its frame number, step and time, with the step's caption under it.

Look at each tile and report **layout defects only** — not whether the explanation is good:

- **overlap**: two pieces of text on top of each other, or text under a filled box that is not its own
  (a label on a column header, a readout under an arrow's label, a callout box hiding a cell).
- **clipped**: text cut off at the tile's edge (a title missing its first letters, a caption running out).
- **offscreen**: an arrow, box or label that clearly continues past the edge of the frame.
- **illegible**: text too small or too crowded to read at this size.
- **other**: anything else that looks wrong in the drawing (an arrow pointing at nothing, a line through a box).

Do not report the caption under a tile (it is outside the frame), and do not report the tile borders.
Report each defect once per frame it appears in; if a defect persists across frames, list it for every
frame where it is visible.

Frames on this sheet:
- frame 1 (step 1), 0ms: Vector clocks
- frame 2 (step 2), 360ms: A: local event · A = [1,0,0]
- frame 3 (step 3), 960ms: C before
- frame 4 (step 4), 1560ms: B receives: max, then +1
- frame 5 (step 5), 2160ms: copied from A
- frame 6 (step 6), 2760ms: C: local event, no message from anyone
- frame 7 (step 7), 3360ms: A and C never exchanged a message: concurrent
- frame 8 (step 8), 3960ms: ordered
- frame 9 (step 9), 4560ms: C sends [0,0,1] to A: max(A, C), c: 0 → 1
- frame 10 (step 10), 5160ms: A increments its own slot: a: 1 → 2 · A = [2,0,1]
- frame 11 (step 11), 5760ms: C's event happened-before A's receive: C ≤ A
- frame 12 (step 12), 6360ms:   clock = max(clock, v)
- frame 13 (step 13), 6960ms

Return **only** JSON of this shape, one entry per frame (include frames with an empty issues list):

```json
{
  "frames": [
    { "frame": 1, "issues": [] },
    { "frame": 7, "issues": [ { "kind": "overlap", "what": "label 'Batch 2' sits on the column header 'box3'", "severity": "minor" } ] }
  ],
  "notes": "optional, anything you were unsure about"
}
```
