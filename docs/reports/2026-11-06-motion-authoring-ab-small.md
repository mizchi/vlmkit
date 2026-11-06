# motion-authoring A/B on a smaller model: the twelve briefs again (2026-11-06)

## Question

Rounds 1 and 2 (`2026-11-05-motion-authoring-ab-v1.md`, `-v2.md`) ended 24 of 24 on both sides with the default
model. Both reports said a difference in success rate would need a weaker model. This round gives the same twelve
briefs (`fixtures/motion-authoring/briefs/` and `v2/briefs/`) to 24 fresh agents on a smaller model, with the same
prompts, tools and rules as before:

- **The vlmkit group** got the CLI.
- **The control group** got Node, Playwright and Chromium, and nothing else.

The two hidden oracles from those rounds scored every page.

## Result

| brief | vlmkit | control |
|---|---|---|
| tabs | 13/13, 96s, 15 tool calls | 13/13, 60s, 10 |
| skeleton | 13/13, 123s, 16 | 13/13, 73s, 8 |
| bell | 10/10, 75s, 12 | 10/10, 39s, 5 |
| modal | 19/19, 94s, 11 | 19/19, 60s, 4 |
| grid | 21/21, 115s, 12 | 21/21, 45s, 5 |
| marquee | 10/10, 90s, 9 | 10/10, 42s, 4 |
| lift | 10/10, 93s, 10 | 10/10, 62s, 6 |
| badge | 10/10, 85s, 9 | 10/10, 46s, 6 |
| gauge | 8/8, 90s, 11 | 8/8, 31s, 4 |
| menu | 9/9, 151s, 14 | 9/9, 64s, 7 |
| label | **8/10**, 84s, 10 | 10/10, 51s, 9 |
| reveal | **0/3** (28/28 renamed), 131s, 12 | **0/3** (28/28 renamed), 26s, 4 |

**The smaller model also wrote the motion right on every brief, in both groups.** Every timing, curve, pivot,
cover, turn-round and reduced-motion check passed. The pages that failed broke the brief's static
instructions:

- **reveal, both groups:** the brief says `div.feature`, and both agents wrote `li.feature` inside a `ul` "so the
  markup is a real list". The oracle finds no boxes. With the tag renamed, both pages score 28/28. Both agents
  named the deviation in their report.
- **label, vlmkit group:** the brief puts the button 40px from the left and top. The agent put the card at the page
  origin "so both readings coincide", but the card has a 1px border, so the button is at (41, 41). Its Playwright
  script did not run (no `playwright` in its directory), and it read the left edge off vlmkit's output. That output
  said the box "grows 136px from its left edge, which stays put", and named only the centre (63, 63). The agent
  took "stays put" for "at 40". The line now gives the place: `which stays put at x = 41`.

So on this model too, vlmkit does not raise the success rate. The control group was 1.5-5x faster on every
brief, and its one miss was the same one the vlmkit group made.

## The oracle's own fault, found on these pages

Both modal pages first scored 18/19 and 17/19: "closing: both half faded at 75ms" read the dialog at opacity 1. Both
pages close with `@keyframes` on a class swap, which rounds 1 and 2 did not use. The oracle had paused the opening
animations through the API. In Chromium a CSS animation paused that way outlives its `animation-name`, and its
forwards fill overrode the close. The v2 oracle already cancelled such an animation for its menu. `oracle.mjs` now
does the same after Cancel (`dropStale`). The reference still passes, the mutant still fails, and round 1's two
modal pages still score 19/19.

## What the vlmkit group hit

Nothing in vlmkit misled an agent into a wrong page. What cost time:

- **Flags applied to every target.** `--expect-direction up` on a backdrop that only fades (modal), and
  `--expect-still` on a pill whose centre moves as it widens (label). Each printed a FAIL the agent then traced to
  its own flag. Same item as round 2.
- **`any` is not a time.** `--expect-duration any` is refused, though `--expect-easing any` works (skeleton).
- **No pivot in SVG units.** `--expect-origin 160,170` is refused (gauge). With `center` it failed `origin-mismatch`
  and advised `fill-box` on a needle already turning about the right point. `turn-off-centre` again suggested
  `--expect-still`.
- **Exits read as defects.** A shimmer and a skeleton that fade out with their parent, and a closed menu, print
  `FAIL absent-at-rest` until `--exits` is given.
- **`covered-edge` on a round button** (label, warn): 46% of "edge" points covered by the media behind it, which
  are the square box's corners outside the circle.
- **`--reduced-motion` with nothing animating** still errors as "nothing to sample" (reveal), from round 2's list.
- **Side effects:** `check animation` and `check integrity` writing `.vlmkit/run-ledger.jsonl`, and
  `reduced-motion-ignored` making the status "suspect" on briefs with no reduced-motion policy.
- **Asked for:** a check that a reduced-motion page rests where the animated one does, a "left edge at x" and
  "height fixed" expectation for a width transition, and a z-order line naming which card is on top.

## What this means

Three rounds, 36 briefs, two models. A coding agent writes correct CSS animation from a brief whether or not it has
vlmkit, and the smaller model's misses were in the static markup, not the motion. With the default or a smaller
model, seeking `document.getAnimations()` is enough to check these briefs. vlmkit gives an agent checks it does not
have to write, and a record of them, at 1.5-5x the time.

So the claim "with vlmkit an agent can write CSS animation" holds, and so does "without it". These rounds give no
evidence that vlmkit is what makes it possible. Briefs where the browser's own API cannot show the mistake would be
a fairer test: motion a script drives, pixels a computed style does not describe, or a recording.

Pages: `docs/reports/data/2026-11-06-motion-authoring-small/` (24 pages, scored as above).

## Fixed after this round

Every item above except the run ledger and `reduced-motion-ignored` on briefs with no policy (both
deliberate):

- **Flags given once.** An `--expect-*` given once is the moving targets', not a `--still` or
  `--exit` target's. When one fails a target beside others, it says it was given once and how to
  give one per target. Every per-target flag takes `any` (`--expect-duration 250,any`).
- **A pivot in SVG units.** `--expect-origin 160,170` holds a turn to a point in the element's own
  units, the viewBox's on SVG (2 units of tolerance). `--expect-origin center` on the needle now
  names that point as the flag to give, instead of advising `fill-box`. `turn-off-centre` names
  `--expect-origin` before `--expect-still`.
- **A width change's origin.** `--expect-origin left` on a pill that widens from its left edge is
  judged by the edge that stays: held, and `right` fails.
- **Exits.** A target whose opacity comes down over the motion's last frames and is gone at rest
  (a skeleton crossfading, a shimmer inside it, a menu closed by a second click) is a warn, taken as
  leaving. An entrance that pops back to hidden is still `absent-at-rest`.
- **`covered-edge` on a round button.** Only points inside the target's rounded corners are probed.
- **`--reduced-motion` with nothing animating** judges each target from the first frame: not shown is
  `reduced-motion-hides`, and more than 1px off where the page rests with motion is
  `reduced-motion-misplaced`. It catches v2's `reveal-hidden` mutant and passes its reference.
- **Wording.** A turned box is no longer said to grow from an edge. A settle-back "shrinks towards"
  its origin. The scale range is in frame order, with a peak said as one. A swing "stays in place".
  `check animation --out` points at `--frames`.

`motion-authoring.test.ts` holds each, on the v1 and v2 references and mutants and on
`fixtures/motion-authoring/small/round-button.html`.
