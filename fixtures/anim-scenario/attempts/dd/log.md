# Batched Pandora's Box — attempt log

## Storyboard (drawn by hand, before touching the format)

Beats I would put on a whiteboard, in order:

1. Three closed boxes in a row, costs visible underneath (1/5, 1/5, 1), rewards
   hidden. Caption: the classic one-box-at-a-time problem, best reward kept
   minus opening cost.
2. Same picture, annotate: now boxes open in **batches** of up to k, a fixed
   setup cost T per batch, all rewards in a batch revealed together (nothing
   can react mid-batch).
3. The concrete instance: box 1 always 1/2; box 2 is 0 / 1/2 / 99 with given
   probabilities; box 3 is 10 / 0 with given probabilities. Costs under each.
4. Batch 1 forms: boxes 1 and 2 grouped/boxed together, cost ticks up:
   setup 1/5 + 1/5 + 1/5 = 3/5 (setup shown separately from box costs at
   least once here).
5. Both rewards pop in at once: box 1 → 1/2, box 2 → 1/2 (the run I trace;
   not the 99 branch — see below).
6. Running readouts update: best-so-far = 1/2, cost-so-far = 3/5.
7. Decision beat: a fork. If box 2 had shown 99 → stop, nothing beats that
   cheaply. Since it showed ≤ 1/2 instead → compute: opening batch 2 costs
   1 + 1/5 = 6/5, expected gain 1/5·(10 − 1/2) = 1.9 > 1.2, so open it.
   This beat needs to show BOTH arms of the fork, not just the taken one.
8. Batch 2 forms around box 3 alone; cost so far grows to 3/5 + 6/5 = 9/5.
9. Box 3 reveals: 10 (the outcome the brief asks us to show).
10. Running readouts: best-so-far = 10, cost-so-far = 9/5 = 1.8.
11. Final score: 10 − 1.8 = 8.2, stated plainly.
12. Rewind and show the OTHER arm of beat 7 for real: box 2 = 99 → stop
    immediately, score 99 − 3/5 = 98.4. (Needed so the branch is not just
    asserted in prose — the viewer should see the alternate ending exist.)
13. Takeaway: a policy that reacts between batches beats any fixed menu of
    batches, but only by a bounded factor — at most 2× in general, about
    1.19× on this instance.
14. (Budget line — brief caps the *problem* explanation at 14 beats; the
    branch replay in #12 is the one beat I'd cut first if forced to 14 flat.)

That's the by-hand version: one continuous run (1–11) plus one rewind-and-replay
of the untaken branch (12), plus the paper's punchline (13).

## Kind choice

No single kind carries all of this — boxes-with-costs-and-rewards is one
picture, "which branch and why" is a different one. Splitting into two
scenes:

- **`scene-1.json` (`kind: matrix`)** — carries beats 1, 3–6, 8–11: the boxes
  as a 2-row grid (cost row fixed, reward row starts `null` = closed, `set`
  reveals it), `group` annotations standing in for "batch" (the kind has no
  native batch concept), `value` annotations for best-so-far / cost-so-far.
  This is the concrete run, box 2 = 1/2 branch, all the way to score 8.2.
- **`scene-2.json` (`kind: state-machine`)** — carries beats 7, 12, 13: the
  decision itself as states/transitions (`start → batch1_open →
  {stop | batch2_open} → scored`), the expected-value comparison and both
  branch scores living in transition `note`s, and a `goto` to rewind and
  replay the untaken `box2=99` branch after the main path ends — this is
  exactly the guide's documented use of `goto` ("the other path").

Beat 2 (batches as a *concept*, before the concrete instance) has nowhere to
live except a `note` at the top of scene-1 — no kind has a notion of "here is
the rule, before any data." Logged as caption load below.

Neither scene needs a hand-picked coordinate or a hex colour — `matrix` and
`state-machine` both lay themselves out and use the default theme.

## Round 1

Wrote `scene-1.json` (matrix, the concrete run) and `scene-2.json`
(state-machine, the branch + takeaway). Ran `check` on both.

```
$ pnpm exec vlmkit-anim check scene-1.json
✗ ops[3].set.ms: unknown key "ms"
    → accepted keys: "cell", "value", "from"
✗ 1 error(s): fix these before the semantic checks can run
```
Bug in my own JSON, not the format: I nested `"ms": 0` *inside* the `set`
object instead of as a sibling of it. Every kind's op-level fields (`ms`,
`caption`) sit next to the verb key, not inside it — I'd absorbed the
verb's own field names from the tables and mis-nested this one. Fixed by
moving `"ms": 0` up a level, onto the op itself.

```
$ pnpm exec vlmkit-anim check scene-2.json
⚠ canvas: the canvas is 2682×360: on a 1280px-wide screen it shrinks to 48% and labels stop being legible
    → use "layout": "tb" or "circle", shorten labels, or split the scene
✓ scene-2.json (state-machine): 0 error(s), 1 warning(s)
```
Five states with `lr` (default) layout plus a `goto` rewind put everything
in one wide row. Took the hint verbatim: added `"layout": "tb"`.

## Round 2

- Fixed the `ms` nesting in `scene-1.json`.
- Added `"layout": "tb"` to `scene-2.json`.

```
$ pnpm exec vlmkit-anim check scene-1.json
✓ scene-1.json (matrix): 0 error(s), 0 warning(s)
  5400ms · 10 steps (9 captioned) · 22 nodes · 16 tracks / 36 keyframes
  scene 1520 B → timeline 6433 B (×4.2)

$ pnpm exec vlmkit-anim check scene-2.json
✓ scene-2.json (state-machine): 0 error(s), 0 warning(s)
  6650ms · 9 steps (9 captioned) · 17 nodes · 11 tracks / 40 keyframes
  scene 1071 B → timeline 5998 B (×5.6)
```

Both green. Ran `explain` on both to confirm the required figures actually
land in the narration (not just "no errors"):

`scene-1.json` step 5 (both boxes of batch 1 reveal):
> Box 2 opens at the same instant: shows 1/2 (not the jackpot 99, not 0)
> · best so far = 0.5 · Cost so far: setup 1/5 + box1 1/5 + box2 1/5 = 3/5

`scene-1.json` step 8 (box 3 reveals):
> Box 3 opens: shows 10 · best so far = 10 · cost so far (setup + boxes)
> = 1.8 (setup 0.2+0.2 + boxes 0.2+0.2+1)

`scene-2.json` step 3 (the branch taken) and step 7 (the branch replayed):
> on box2<=0.5: batch1_open → batch2_open E[gain] = 0.2×(10−0.5) = 1.9 >
> batch-2 cost 1.2: open it
> on box2=99: batch1_open → stop no second batch is worth 1.2 more;
> score = 99 − 0.6 = 98.4

Both required figures (1.9 vs 1.2, and the branch outcomes) are present in
`explain`, not only in the JSON — success criterion met. Also read the
rendered SVG for step 5 of `scene-1.json` and step 3 of `scene-2.json`
(`render --step N`) to confirm the picture actually matches the caption:
the matrix draws the cost row (0.2, 0.2, 1) and an empty reward row at
step 5's start point with `<g id="group-batch-0">` / `group-batch-1"` present
(the "Batch 1" / "Batch 2" dashed outlines from the `group` annotation);
the state-machine draws five circle nodes with `tr-0`..`tr-3` arrows carrying
the note text I wrote, laid out top-to-bottom after the fix. No stray
coordinates anywhere in either render — every `transform="translate(...)"`
in the SVG was computed by the compiler, not typed by me.

Stopped here: both scenes are green (0 ✗, 0 ⚠) and `explain` carries every
figure the brief's success criterion names. 2 rounds used of the 4-round
budget.
