# motion-repair v5: briefs that never name the flag (2026-10-19)

## Question

In round 4 the skill's example phrases ("grow out of its button", "cascade") matched the briefs almost
word for word. Round 5 used three new pages whose briefs describe the motion in their own words and
never in the flags' terms. Every agent was fresh, three on the default model and three on a smaller
one, and the setup was otherwise the same.

| page | planted defect | the brief's words | the flag it needs |
|---|---|---|---|
| tooltip | `transform-origin: bottom` on a `scaleY` drop-down | "unfold downwards, the way a window blind is pulled down: its top edge … never moves" | `--expect-origin top` |
| tiles | four delays in reverse (420 → 240ms) | "a wave travelling across the row in reading order … each neighbour to its right a beat later — 60ms" | `--expect-start 240 --expect-stagger 60` |
| chips | `animation-delay: 1200ms` on a fade with `both` fill | "as the page appears — straight away, with no wait before the fade starts" | `--expect-start 0` |

Building the round turned up one hole in the tool before any agent ran. `inspect motion` read a
`scaleY(0.2)` as scale 1, because it read the scale from the matrix's first column, so it printed
no origin at all. **Fixed first:** each axis is now measured, and a scale along one axis names the
edge that stays put. `--expect-origin top` then checks only the axis that scales.

## Result

| page | model | rounds | oracle | the flag it reached | how |
|---|---|---:|---|---|---|
| tooltip | default | 1 | PASS | `--expect-origin top` | the help's "A scale along one axis (scaleY, a drop-down) keeps an edge: top \| bottom" and the skill |
| tooltip | small | 1 | PASS | `--expect-origin top` | the help alone (it did not open the workflow) |
| tiles | default | 1 | PASS | `--expect-start 240 --expect-stagger 60` | the skill's "one `--selector` per entry in order and `--expect-stagger`" |
| tiles | small | 1 | PASS | `--expect-start 240,300,360,420 --expect-stagger 60` | the same |
| chips | default | 1 | PASS | `--expect-start 0` | the skill's "map the brief's words to the flag yourself" |
| chips | small | 1 | PASS | none: it read `begins at 1200ms` and its own frames | `--at 0,600,1100,1300,1500` and a look |

Six of six repairs passed, each in one round. Five agents translated the brief's words into the
flag themselves, and the sixth read the measured number without one. No agent needed the CSS to find
the cause, though several opened it to confirm.

## What they hit, and what is fixed

- **No default rule fires.** Every agent said it in its own words:

  > "Without an expectation, a motion the reviewer called broken passes as 'no fail'." (tooltip)

  > "Nothing notices that an entrance with a 1200ms delay and `both` fill leaves an element invisible on load." (chips)

  Two of the three defects need the brief: which corner, which order. Those stay facts until an
  expectation turns them into a fail. The third defect needs no brief: an element held unseen
  through a long delay. **Fixed:** `check animation` has a new rule, `delayed-entrance` (warn). It
  fires when the first keyframe hides the element (opacity 0 or visibility hidden), the fill is
  `backwards` or `both`, and the delay is 1000ms or more. It fires on the broken chips page and on
  no reference page, nor on any of `fixtures/motion-defects/intact/`. There are now 220 rules.
- **`inspect motion` never shot the wait:**

  > "`inspect motion` samples only '11 frames over 1200..1400ms', so no frame of its own shows the gap." (chips)

  **Fixed:** when the first segment starts 300ms or more after load, three frames are taken before
  it. The header now reads `frames over 0..1400ms (motion from 1200ms; the frames before it show the wait)`.
- **The share-seen column read as opacity:**

  > "Its frame lines read '20ms 1.00' share seen at about 20% opacity, which could be read as 'fully visible'." (chips)

  **Fixed:** the line prints `op 0.16` beside the share whenever the opacity is partial.
- **"The first fail's own frame" named the earliest fail, not the first one listed.**

  > "named `the first fail's own frame (240ms)`, while the first FAIL it listed is `.t1 … at 420ms`." (tiles)

  **Fixed:** the line now names the target and the rule: `(1200ms, .chips start-mismatch)`.
- **The skill's phrases:** it now gives the words of all three briefs as examples. "Grows from / hangs
  from / unfolds out of" maps to `--expect-origin`. "A wave across the row" and "each a beat later"
  map to `--expect-stagger`. "Straight away" and "with no wait" map to `--expect-start 0`.

## Deferred

- `diff png` labels antialiasing noise between two rest captures as `4 element-added, 1 icon-change`
  (0.03%; seen by two agents).
- `check animation` captures at 1280x720 by default and `inspect motion` at 1280x800. This was
  noted again in this round, as in every earlier one.
- The suggested strip crop can cut through a heading, and the time labels are drawn over it.
- `check integrity` at 375px reports the overflow of a 4-column grid and a 300px tooltip. That was
  already true of the originals and lies outside the briefs.

## Where the loop stands

Five rounds and nine pages:

- **Seen**: clip, stacking context, ancestor opacity. The target is never seen.
- **Timing**: fill-mode, easing, delay, stagger order.
- **Geometry**: transform-origin on both axes.

Since round 4 every repair has taken one round. Each defect is either found by a rule on its own
(target-hidden, snap-back, undefined-keyframes, delayed-entrance) or by an expectation that agents
now reliably derive from the brief.
