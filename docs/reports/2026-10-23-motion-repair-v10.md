# motion-repair v10: what moves something else, a seam at every loop, a stroke left unfinished (2026-10-23)

## Question

Round 10 added three new kinds of defect. In each one the target's own box never shows the defect:

| page | planted defect | the brief's words |
|---|---|---|
| push | a notice slides in by animating `margin-top` from -56px to 0, in the normal flow, so it pushes the article down | "The article itself never moves: not while the notice arrives, and not after" |
| seam | a spinner's `@keyframes spin` runs from `rotate(0deg)` to `rotate(350deg)`, so it jumps 10° once a second | "one steady speed, exactly one full turn every second … It never pauses, speeds up or jumps" |
| draw | a check mark draws with `stroke-dasharray: 40` on a 73.6-long path, so it stops half way up its long arm | "Once drawn, the whole check mark stays on screen" |

Six fresh agents took part, three on the default model and three on a smaller one. The setup was
unchanged, and the oracle (`fixtures/motion-repair/oracle.mjs`) was hidden from them.

Building the round found two measurement holes, fixed before any agent ran, because the reference
pages failed on them:

- The 5x5 hit-test counted points outside the target's own shape as covered. On the spinner these
  were the corners of a turned round box, where the card behind shows through; it read
  `target-lost` 24 times on the reference page. On the check mark it was the empty part of a stroke's
  box, which read "covered by circle". A point where an ancestor shows through, inside every
  clipping ancestor, and a point outside an SVG shape's fill and stroke, no longer count.
- A 2D turn read -180..180, so the spinner's fit was nonsense, and a target that only turned was
  "static". The turn is now unwrapped before it is fitted, and a target that turns is not static.

## Result

| page | model | rounds | oracle | what found the defect |
|---|---|---:|---|---|
| push | default | 1 | PASS* | `--selector article --expect-still`: `still-mismatch`, which blamed a transform; the cause came from the CSS |
| push | small | 1 | PASS | the same |
| seam | default | 1 | PASS | the CSS, and a `diff png` of every pair of consecutive frames it built itself (52px at the seams, at most 40px elsewhere) |
| seam | small | 1 | PASS | the CSS, and an angle-measuring script of its own |
| draw | default | 1 | PASS | `inspect motion`'s `target-hidden … covered by circle` sent it to the stroke, then its own look at a cropped strip |
| draw | small | 1 | PASS | the same |

All six repairs were right, each in one round. No rule named any of the three causes. On push, the
tools found the article moving only once an agent asked them to (`--expect-still`). On seam, nothing
told the two pages apart. On draw, the stroke was flagged with the wrong cause.

\* **The push brief was ambiguous, and the oracle was changed for it.** It says that the notice
lies "over the top of the article", and also "without changing how the top bar, the notice or the
article look once everything is still". On the broken page at rest, the notice sits above the article,
not over it. Both agents kept that rest layout and stopped the article moving, which satisfies the
brief. The oracle had required the notice to lie over the article, and failed the default model's
repair on that check. It now accepts the article under the top bar either with the notice over it
(104) or below the notice's own room (160). What it still requires is that the article never moves,
and that the notice is pinned under the bar, in front.

## What they hit, and what is fixed

- **Something else moving the article was blamed on a transform.**

  > "The article has no animation at all; it was being pushed … The clue was that the article
  > 'follows ease-out exactly', the same curve as `.notice`." (push, default)

  **Fixed:**
  - A target with no animation of its own that moves is `pushed` (warn), naming what moved it:
    `div.notice animates margin-top: an animated layout property … reflows everything after;
    animate transform (or take the element out of the flow) instead`. It is a warn because an
    accordion opening above a target also moves it, and that is meant.
  - `still-mismatch` now gives the same cause when the target has no animation of its own.
  - `--still <css>` scopes the expectation to one target, so the notice and the article are judged in
    one run.
  - `target-static` no longer warns on a target that has no animation of its own, or under
    `--expect-still`.
- **Nothing measured a loop's seam.**

  > "No gate measures rotation rate or loop closure." (seam, small)

  **Fixed:** `loop-seam` (fail). For every repeating animation of a `--selector` target, `inspect
  motion` compares the target's pose 2ms and 1ms before the end of a run with its pose at and 1ms
  after the start of the next. A step much larger than the motion either side of it is a seam. The
  broken page reads `.spinner spin turns 10.4° in one step at every loop (0.35° a ms either side)
  (its keyframes run from rotate(0deg) to rotate(350deg)) … end it on the same pose it starts on`;
  the reference page passes. The same test covers a position or opacity that does not close (a
  ticker one copy short).
- **A stroke that draws itself had no channel.**

  > "A stroke draw does not move the box, so the easing and the draw are unmeasured, and the pass is
  > not evidence of the draw." (draw, small)

  **Fixed:**
  - A dashed SVG stroke's drawn share is measured from its own dash pattern (`stroke-dasharray`,
    `stroke-dashoffset`, `pathLength`) along its length.
  - The points its dashes leave undrawn are no longer counted as covered.
  - The drawn share is fitted as a channel. The reference page reads `follows ease-out in its drawn
    length`.
  - A stroke that ends part drawn fails `stroke-incomplete`: `its stroke ends 54% drawn …
    stroke-dasharray 40px … on a line 73.6 long — a dash shorter than the line leaves the rest of it
    off`.
- **Smaller fixes.**
  - `diff png` with a page in place of a screenshot printed pngjs's "unrecognised content at end of
    stream" and a stack trace. It now says that the file is not a PNG, and names `diff html` and
    `--elements-html`.
  - The dynamic-markup skill gave a source-only invocation. It now names `npx vlmkit`, or
    `node dist/vlmkit.mjs` in a checkout.

## Deferred

- `check animation` and `check integrity --timeline` still raise nothing on a sibling's layout
  animation, a loop seam or a short dash. `inspect motion` catches each of them now, given the
  target.
- `snapshot storyboard` read every loop of the spinner as a "transient", identically on both pages.
- `check animation`'s `infinite-animation` still leads with "give it a bounded iteration count",
  which a brief for a spinner contradicts. Its message does go on to the case that is meant to run
  forever.
- `check integrity` gave `degenerate-render` on the 56px spinner card, and on the reference page
  too.
- `diff html` prints Crater's `ECONNREFUSED` when Crater is not running.
