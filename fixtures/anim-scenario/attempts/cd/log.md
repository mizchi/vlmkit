# Log — Batched Pandora's Box

## Storyboard (drawn by hand, before touching the tool)

Beats I would draw on paper, in order:

1. Three closed boxes in a row, cost written under each (1/5, 1/5, 1) — reward
   hidden (`?`). Caption: "k=2, setup cost T=1/5 per batch."
2. Batch 1 forms: a bracket/highlight groups box 1 and box 2. Caption: cost of
   this batch = 1/5 + 1/5 + 1/5(setup) = 3/5.
3. Both boxes pop open at once, reward numbers appear: box 1 → 1/2 (always),
   box 2 → 1/2 (this run — could have been 0 or 99).
4. A running-cost readout ticks up to 3/5. A running-best readout shows 1/2
   (tie between box 1 and box 2).
5. Branch point, drawn as a fork: "box 2 = 99?" → yes: stop, arrow to a
   "final score 99 − 3/5" box. → no (this run): arrow to "compare batch 2:
   cost 6/5, expected gain 1.9 > 1.2 → open it."
6. Box 3 pops open alone (batch 2, no partner — it's the only box left and
   k=2 just caps batch size, doesn't force it). Reward → 10.
7. Running-cost readout ticks up to 3/5 + 6/5 = 9/5. Running-best readout
   jumps to 10.
8. Final box: score = 10 − 9/5 = 8.2. Small footnote: reacting between
   batches beats any fixed menu of batches by at most 2× (proved); on this
   instance ≈1.19×.

That's 8 beats, matching the brief's "at most fourteen" with room to spare —
except beat 5 is a *fork*, not a single frame: to show the decision rule (not
just the one outcome) it has to depict both the taken branch and the road not
taken. That alone roughly doubles the beat count once it's actually drawn
beat by beat instead of gestured at with an arrow on paper.

## Which kind(s), and what each carries

Reading `docs/anim-ir.md`, no kind is "three boxes with hidden rewards and a
running score" — nothing about opening/hiding a value per box, nothing about
a cost meter. The closest generic structures:

- **`matrix`**: a small table can hold exactly the state that changes over
  time — one row per box (cost fixed, reward `null` until opened), plus an
  extra row for the running totals (cost-so-far, best-so-far). `set …from…`
  even gives me a "this number came from these" arrow, which is a decent
  stand-in for "the running cost is these costs added up." This carries
  beats 1, 2 (partially — no real "batch bracket," see below), 3, 4, 6, 7, 8.
- **`state-machine`**: the one kind with an actual branch/fork primitv
  (`goto` to play a second path after the first ends). It cannot show a
  reward or a cost number by itself, but it can carry the *shape* of the
  decision — "batch1 → (high: stop) / (low: open batch 2) → done" — with the
  numbers pushed into transition `note`s and step `caption`s. This carries
  beat 5 (the fork itself) and doubles as a table of contents for the whole
  policy.

So: two scenes, `scene-1-run.json` (matrix, the one concrete numeric run) and
`scene-2-branch.json` (state-machine, the decision structure + the paper's
closing bound). Confirms the hypothesis up front: neither kind was built for
this, and no single kind carries the whole storyboard — it's assembled from
a table-that-fills-in and a branch-that-forks, with several facts that fit
neither and have to live in captions/notes (logged below as they come up).
