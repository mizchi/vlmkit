# motion-authoring A/B v2: six briefs built on traps, with vlmkit and without (2026-11-05)

## Question

Round 1 (`2026-11-05-motion-authoring-ab-v1.md`) ended 12/12 on both sides, and the vlmkit group spent
its extra time on false alarms. Before this round:

- **False alarms.** Every one round 1 hit was fixed, with a regression test each:
  - `size-jump` on a scale;
  - a pendulum's direction;
  - `loop-seam` on a ticker and on a clipped shimmer;
  - ancestors' animations left at rest;
  - a translucent cover;
  - the held clock ignoring `animation-play-state`;
  - `target-unchanged` on a still target;
  - occluded transparent text.
- **New flags,** for the gaps it named: `--expect-span-of`, `--reduced-motion`, `--expect-start +N` and `any`, `--still` as its own
  `--selector`, `--expect-lines`, and a turn's pivot judged by `--expect-origin` (SVG included).
- **New and widened rules,** for traps the v2 mutants showed vlmkit missed: an `interrupt-jump` the other way from
  the motion that follows, and `text-wrap`.

Round 2 then gave six new briefs (`fixtures/motion-authoring/v2/briefs/`). Each is built around a mistake that
round 1's control agents said they could not check, or one this repository's repair rounds found agents making:

| brief | the trap the brief invites |
|---|---|
| lift | three cards 8px apart, each with a tag that needs `position: relative`; the hovered card (scale 1.08) paints under the next one without a `z-index` |
| badge | a count badge half outside a round avatar; an avatar with `overflow: hidden` cuts it |
| gauge | an SVG needle that must turn about its base; `transform-origin: center` on SVG is the viewBox's centre |
| menu | a menu clicked again while it opens must turn round; `@keyframes` for open and close restart from the far end |
| label | a button widening into "Added to cart" must keep it on one line; without `nowrap` it wraps mid-widen |
| reveal | a staggered entrance that, under reduced motion, must show everything at once; `animation: none` over a base of opacity 0 hides it |

The setup was round 1's: fresh agents on the default model, one group with vlmkit and one with only Node,
Playwright and Chromium, scored by a hidden oracle (`fixtures/motion-authoring/v2/oracle.mjs`, 75 checks) that
measures with plain Playwright and the Web Animations API. The oracle was checked first: it passes each
reference and fails each trap's mutant (`v2/mutants/`). vlmkit catches every mutant too, given the matching
flag; `motion-authoring.test.ts` holds both.

Two of the oracle's own faults were found on the mutants and fixed before the agents ran:
- An edge probe read a pill's rounded ends as covered.
- A paused CSS animation outlived its `animation-name` and held a menu open.

## Result

| brief | vlmkit | control |
|---|---|---|
| lift | 10/10, 135s, 12 tool calls | 10/10, 75s, 7 |
| badge | 10/10, 68s, 6 | 10/10, 46s, 6 |
| gauge | 8/8, 104s, 9 | 8/8, 48s, 5 |
| menu | 9/9, 108s, 9 | 9/9, 60s, 5 |
| label | 10/10, 115s, 16 | 10/10, 61s, 6 |
| reveal | 28/28, 95s, 10 | 28/28, 184s, 9 |

**Both groups again wrote all twelve pages correctly. No agent fell into a trap.** The control agents avoided
them on their own:

- **lift:** a `z-index` on hover, held through the settle with `z-index 0s 200ms`.
- **badge:** no `overflow: hidden`, with `border-radius` alone shaping the gradient.
- **gauge:** `transform-origin: 160px 170px` with `transform-box: view-box`.
- **menu:** a transition, not `@keyframes`.
- **label:** `nowrap`, and the width measured.
- **reveal:** a `backwards` fill, so `animation: none` leaves the boxes shown.

The control group checked its pages the same way as in round 1: it paused `getAnimations()`, seeked and read
boxes. For the cover it also wrote its own `elementFromPoint` test along the edges.

vlmkit was faster to tell an agent when something was right. Three agents built a broken copy and got the
fail they expected:

- **lift:** `covered-edge` on a copy with no `z-index`, and again with the `z-index` dropped at once on leave.
- **menu:** `--wait` at three points of the opening.
- **gauge:** the pivot named, "about the middle of its right edge".

None of that changed a score: the control agents got the same pages right without it, in about half the time.

## What this means

Two rounds and 24 briefs give the same answer. With this model, an agent writes correct CSS animation from a
brief using what a browser already exposes. Pausing and seeking `document.getAnimations()` measures CSS
animation exactly, and the agent knew the traps. vlmkit does not raise that success rate. What it changes:

- **Time:** it costs more, 1.1-2.9x on five briefs. The exception is reveal, where the control agent took 1.9x as long.
- **Checks:** it gives checks the agent does not have to write: a cover along the edges, a jump on a second
  click, a pivot, lines of text.
- **Records:** the checks are named and repeatable (`held: …`), not a one-off script deleted afterwards. Most control
  agents deleted theirs.

So "vlmkit lets an agent write CSS animation" is not shown by these rounds. What is shown: an agent with vlmkit
writes it as correctly as one without, and its checks are on record. A difference in success rate would need:

- a weaker model, which may not write it right the first time;
- or briefs where the browser's own API cannot show the mistake: pixels a computed style does not describe, a
  page whose motion a script drives, or an animation `getAnimations()` cannot seek.

Measured, and not to forget:

- **Neither group fell into a trap known from the repair rounds.** Those rounds gave agents a broken page, and a
  page an agent writes itself carries its own habits, not a planted defect. The traps were in-sample for vlmkit:
  its rules for covers, jumps, pivots and reduced motion came from the repair rounds. So a vlmkit win here would
  have been a weak claim, and a draw is the stronger finding.
- **Some of round 1's friction was fixed and the vlmkit group still took longer.** The extra time comes from
  running several gates and reading their output, not only from false alarms.

## What the vlmkit group hit this round

These are the next fixes:

- **Expectations apply to every target.** One `--expect-*` value covers `--still` neighbours too (a two-line
  paragraph failed `--expect-lines 1`; still cards warned `origin-unchecked`), and `any` is accepted only by
  `--expect-direction` and `--expect-start`. A `--still` or `--exit` target should be left out of the other
  expectations, and every per-target flag should take `any`.
- **A scale's peak is the sampled frames' peak.** The badge's 115% read 1.14. There is no `--expect-scale`.
- **Wording.**
  - `turn-off-centre` warns, and suggests `--expect-still`, on a needle meant to turn about its base. It
    should name `--expect-origin`.
  - A rotation's line says "its box grows 104px from its bottom edge".
  - A settle-back reads "the scale grows … from 1.00 to 1.08".
  - `--reduced-motion` with nothing animating at load is an error worded as a bug.
- **Asked for:**
  - a fixed pivot in page or viewBox coordinates;
  - "shown and in place from the first frame" under reduced motion;
  - a height that must not change;
  - `check integrity` after an action;
  - `check integrity` at the brief's one viewport.

Pages and the oracle: `fixtures/motion-authoring/v2/` and `docs/reports/data/2026-11-05-motion-authoring-v2/`.
