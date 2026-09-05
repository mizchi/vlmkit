# Visual review: Batched Pandora's Box: one adaptive run (k=2, T=1/5)

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
- frame 1 (step 1), 0ms: Batched Pandora's Box: one adaptive run (k=2, T=1/5)
- frame 2 (step 2), 360ms: Classic Pandora's box: open one at a time, keep the best reward seen, pay each box's cost. Here boxes open in batches of up to k=2, plus a fixed setup cost T=1/5 per batch.
- frame 3 (step 3), 960ms: Batch 1: boxes 1 and 2 open together
- frame 4 (step 4), 1560ms: Box 1 opens: always 1/2
- frame 5 (step 5), 2160ms: Box 2 opens at the same instant: shows 1/2 (not the jackpot 99, not 0) · best so far = 0.5 · Cost so far: setup 1/5 + box1 1/5 + box2 1/5 = 3/5
- frame 6 (step 6), 2760ms: Box 2 showed 1/2, not 99 — check whether a second batch is worth it: E[gain from box 3] = 1/5·(6 − 1/2) = 1.1, batch-2 cost = 1/2 + 1/5 = 0.7. 1.1 > 0.7, so open it.
- frame 7 (step 7), 3360ms: Batch 2: box 3 alone
- frame 8 (step 8), 3960ms: Box 3 opens: shows 6 · best so far = 6 · cost so far (setup + boxes) = 1.3 (setup 0.2+0.2 + boxes 0.2+0.2+0.5)
- frame 9 (step 9), 4560ms: Final score = best (6) − total cost (1.3) = 4.7
- frame 10 (step 10), 5160ms: kept 6 > 1/2
- frame 11 (step 11), 5760ms

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
