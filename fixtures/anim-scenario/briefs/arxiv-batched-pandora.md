# Brief: explain a new algorithm from this week's arXiv — Batched Pandora's Box

Paper: *Batched Pandora's Box*, Dughmi, Kalayci, Livanos, Prasad,
arXiv 2609.04059, submitted 2026-09-03. You have only this brief; do not fetch
the paper. Explain the **problem** and the **shape of the policy** to someone
who knows what an expected value is, in at most fourteen beats.

## The classic problem (Weitzman, one box at a time)

There are `n` closed boxes. Box `i` costs `c_i` to open and holds a reward
drawn from a known distribution. You open boxes one at a time, see each reward
as you open it, and may stop at any point, keeping the **best single reward**
seen. Score = best reward kept − total opening cost paid. Because you see each
reward before deciding on the next box, you can stop early when a great reward
appears.

## What the paper adds: batches

Boxes are now opened in **batches** of up to `k` boxes. Every batch costs a
fixed **setup cost `T`** on top of the boxes' own costs, and **all rewards in a
batch are revealed together**, so within a batch nothing can react to anything.
(Motivation named by the paper: parallel LLM inference — sampling several
answers at once has a per-round cost, and you only read them when the round is
done.) The paper studies two variants; explain the **non-reusable** one, where a
box, once opened, is gone.

## The instance to animate (from the paper), `k = 2`, `T = 1/5`

| box | cost | reward |
|---|---|---|
| 1 | 1/5 | always 1/2 |
| 2 | 1/5 | 0 with prob 2/5, 1/2 with prob 2/5, **99** with prob 1/5 |
| 3 | 1 | **10** with prob 1/5, 0 with prob 4/5 |

Tell one concrete run of an **adaptive** policy: batch 1 opens boxes 1 and 2
together (cost 1/5 + 1/5 + setup 1/5 = 3/5); both rewards appear at once. Then
branch on what box 2 showed:

- if 99: stop — no second batch is worth its cost; score 99 − 3/5.
- if 1/2 (or 0): a second batch with box 3 alone costs 1 + 1/5 = 6/5 and gains
  10 − 1/2 with probability 1/5, expected 1.9 > 1.2, so open it; show one
  outcome (say 10) and the final score.

The viewer must see, at every beat: which boxes are closed / open, the
rewards revealed so far, the **best so far**, the **total cost so far**
(setup and box costs separately at least once), and the decision rule at the
branch point. The paper's own point to land in the last beat: a policy that
can react between batches beats any fixed menu of batches, but only by a
bounded factor (they prove at most 2×; on this instance about 1.19×).

Use whichever kind or kinds say this best; if no single kind does, write
several scenes (`scene-1.json`, `scene-2.json`, …) with an `index.md` giving
their order and one line each on what each shows.

Success: every scene passes `vlmkit-anim check` with no ✗ and no ⚠; `explain`
carries the running best / cost figures at the reveal beats and the
expected-gain comparison (1.9 vs 1.2) at the branch.

Also record in `log.md`: which kinds you used and why; every place you had to
write a coordinate or a colour by hand; every fact you had to push into a
caption because nothing on screen could carry it; and anything you wanted to
show that you could not say in the format.
