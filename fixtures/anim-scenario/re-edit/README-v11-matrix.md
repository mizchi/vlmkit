# Re-edit task (v11, matrix + group / value): a cheaper third box

`pandora-batched.scene.json` walks one adaptive run of Batched Pandora's Box
(k=2, setup cost T=1/5 per batch): two boxes open in batch 1, then the run
decides whether a second batch for box 3 is worth it. The running "best so
far" and "cost so far" are `value` annotations; the batches are `group`
outlines; the arithmetic is in the captions.

Change request from the author: **box 3 is cheaper and less lucrative — its
cost is 1/2 instead of 1, and when opened it shows 6 instead of 10.** Every
number that depends on box 3 has to follow: the cost row, the decision
caption (expected gain versus the cost of a second batch — the decision still
comes out "open it"), both readouts after box 3 opens, and the final score.
Nothing about batch 1 changes.

Then **relate the two rewards that competed for "best"**: at the end, draw an
arrow from box 1's reward cell to box 3's reward cell labelled with what was
kept (something like `kept 6 > 1/2`). The scene already has a `mark` on the
final cell; keep it.

Requirements: the cost row's third cell is `0.5`; box 3's reward cell is set
to `6`; every literal that depended on the old 1 / 10 is updated (search the
captions — there are several); the closing relation uses `relate` between two
cell anchors (`"r,c"`), not a `group`.

Success: `vlmkit-anim check pandora-batched.scene.json` exits 0 with no ✗ and
no ⚠; `explain` shows `best so far = 6`, a cost-so-far readout ending at
`1.3`, and a final score of `4.7`; the final frame shows the arrow between the
two reward cells with its label.

Write down, before your first `check`, the expected-gain comparison for the
second batch and the final score.
