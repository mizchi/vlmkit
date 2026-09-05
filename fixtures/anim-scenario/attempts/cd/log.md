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

## Round 1 — first `check`

```
$ pnpm exec vlmkit-anim check fixtures/anim-scenario/attempts/cd/scene-1-run.json
✓ scene-1-run.json (matrix): 0 error(s), 0 warning(s)
  5400ms · 10 steps (9 captioned) · 21 nodes · 17 tracks / 85 keyframes
  scene 1518 B → timeline 8489 B (×5.6)

$ pnpm exec vlmkit-anim check fixtures/anim-scenario/attempts/cd/scene-2-branch.json
✓ scene-2-branch.json (state-machine): 0 error(s), 0 warning(s)
  5390ms · 7 steps (7 captioned) · 17 nodes · 11 tracks / 40 keyframes
  scene 1006 B → timeline 5758 B (×5.7)
```

Both green, 0 ✗ / 0 ⚠, first try. But `check` only validates structure (final
grid correct, every (from,on) transition legal, every state reachable) — it
does not know what the brief actually needs said out loud. So before calling
it done I ran `explain` on both and read every line against the brief's
checklist (best-so-far, running cost, the 1.9-vs-1.2 comparison, the branch).

`explain scene-1-run.json` was fine — every fact landed (see final version
below, unchanged from round 1). `explain scene-2-branch.json` was not:

```
1. [    0ms] Start in "start"
2. [  560ms] on open-batch-1: start → batch1-open
3. [ 1540ms] on box2-shows-low: batch1-open → open-batch2
4. [ 2520ms] on box3-revealed: open-batch2 → done
5. [ 3500ms] The branch not taken this run — replaying from the same point: what if box 2 had shown 99 instead?
6. [ 4060ms] on box2-shows-99: batch1-open → stop-99
7. [ 5040ms] End in final state "stop-99"
```

**Finding**: a transition's `note` field (`"/ pay 1/5+1/5+setup 1/5 = 3/5, …"`,
"/ expected gain 1.9 > 1.2 …", etc.) does **not** appear in the auto-generated
step caption, which is just `on <event>: a → b`. All the numbers I had put in
`note` — the whole point of the scene — were invisible to `explain`. The
guide's own door example never runs `explain` on a transition carrying a
`note`, so nothing in the guide flagged this; I only caught it by actually
reading the narration output against the brief's checklist rather than
trusting a green `check`. `render`ing a frame later showed *why* `note` felt
safe to use: it IS drawn on screen, permanently, as the edge's label next to
the arrow — so the number is not lost from the *picture*, only from the
*narration track* (`explain` / the caption shown per-step). Two different
channels carry different content and nothing in `check` cross-references them.

## Round 2 — fix

Moved every fact out of `note` and into an explicit `caption` on the
corresponding `trace` item (`{"on": "box2-shows-low", "caption": "…1.9 > 1.2…"}`),
per the guide's "`{"on": "ev", "caption": "…"}` to narrate that step yourself."
Kept `note` on the `transitions` block too (harmless, and it still gives the
static diagram its own labels independent of which trace is played).

```
$ pnpm exec vlmkit-anim check fixtures/anim-scenario/attempts/cd/scene-2-branch.json
✓ scene-2-branch.json (state-machine): 0 error(s), 0 warning(s)
  5390ms · 7 steps (7 captioned) · 17 nodes · 11 tracks / 40 keyframes
  scene 1462 B → timeline 5971 B (×4.1)

$ pnpm exec vlmkit-anim explain fixtures/anim-scenario/attempts/cd/scene-2-branch.json
The decision rule at the branch point — 7 steps, 5390ms, 17 nodes
 1. [    0ms] Start in "start"
 2. [  560ms] Batch 1 opens box 1 and box 2 together: pay 1/5 + 1/5 + setup 1/5 = 3/5.
 3. [ 1540ms] Box 2 shows 1/2 or 0 (not 99): a second batch (box 3 alone) costs 1 + 1/5 = 6/5 and gains 10 − 1/2 with probability 1/5, expected 1.9 > 1.2 — worth it, continue.
 4. [ 2520ms] Box 3 opens, shows 10: final score 10 − 9/5 = 8.2.
 5. [ 3500ms] The branch not taken this run — replaying from the same point: what if box 2 had shown 99 instead?
 6. [ 4060ms] Box 2 shows 99: stop now — no second batch beats keeping it. Score 99 − 3/5 = 98.4.
 7. [ 5040ms] End in final state "stop-99"
```

Every figure the brief's success criterion asks for (best-so-far, running
cost split into setup/box parts at least once, the 1.9-vs-1.2 comparison at
the branch) now shows up in `explain`. Green on `check`, and now correct on
`explain` too. Confirmed with `render --step N` that the table (scene 1) and
the fork diagram (scene 2) actually draw what the captions claim — see next
section for what render showed and did not show.

## Round 3 — verifying render output

```
$ pnpm exec vlmkit-anim render scene-1-run.json --step 5   # "best so far: 1/2, compare 1.9>1.2"
```
The matrix at step 5 shows a 4×2 grid with box costs (0.2, 0.2, 1), the two
revealed rewards (0.5, 0.5) and the running row (0.6, 0.5) as plain numbers —
no fractions, no "1/5" or "3/5", because `matrix` cells are `number | string |
null` and the compiler renders the JS number (`0.6`, not `3/5`). The fraction
form the brief writes the whole problem in (`1/5`, `3/5`, `9/5`) only exists
in the captions, never in the picture. `render` on `scene-2-branch.json` at
step 3 confirmed the edge-label / caption split described above, and also
showed the diagram's default `layout: "lr"` for 5 states with long labels
produces a **4266px-wide** canvas (viewBox `0 0 4266 360`) — legible arrow by
arrow, but not as one glance; no warning is raised because nothing is
off-canvas or missing a caption, which is all `check` looks for.

Both scenes were green (0 ✗ / 0 ⚠) since round 1; round 2 fixed a
narration-correctness gap `check` cannot see. No round 4 was needed.

