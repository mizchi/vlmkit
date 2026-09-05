# Visual review: Vector clocks: causality without a global clock

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
- frame 1 (step 1), 0ms: Start: A, B and C each hold a vector [a,b,c] of counters, all zero · A = [0,0,0] · B = [0,0,0] · C = [0,0,0]
- frame 2 (step 2), 540ms: A has a local event: it increments its own slot · A: [0,0,0] -> [1,0,0]
- frame 3 (step 3), 1080ms: A has a second local event before sending: it increments its own slot again · A: [1,0,0] -> [2,0,0]
- frame 4 (step 4), 1620ms: A sends its vector to B · B receives [2,0,0]: max([0,0,0],[2,0,0])=[2,0,0], then +1 own slot -> [2,1,0]
- frame 5 (step 5), 2220ms: Meanwhile, C has a local event of its own: it increments its own slot · C: [0,0,0] -> [0,0,1] · C's local event (frozen) = [0,0,1]
- frame 6 (step 6), 2760ms: B sends its vector to C · C receives [2,1,0]: max([0,0,1],[2,1,0])=[2,1,1], then +1 own slot -> [2,1,2]
- frame 7 (step 7), 3360ms: Concurrent: A's vector when it sent to B [2,0,0] and C's local event [0,0,1] - neither is <= the other
- frame 8 (step 8), 3900ms: A ∥ C: concurrent
- frame 9 (step 9), 4440ms: Ordered: A's vector [2,0,0] <= C's final vector [2,1,2] in every slot - A's send happened-before C's receive
- frame 10 (step 10), 4980ms: A ≤ C: ordered
- frame 11 (step 11), 5520ms: end

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
