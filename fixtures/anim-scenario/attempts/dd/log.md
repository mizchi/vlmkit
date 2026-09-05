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
