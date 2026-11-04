# motion-repair v18: a fill that overrides an entrance, a token with no unit, a label that drifts (2026-11-03)

## Question

Round 18 planted three defects, none of them in the classes of rounds 1-17 or the held-out set:

| page | planted defect | the brief's words |
|---|---|---|
| combo | `animation: rise 400ms both, pulse 1600ms 400ms infinite both`. Both animate `transform`, and the pulse comes later in the list, so its `both` fill holds `scale(1)` through its delay and replaces the rise | "rises 24px into its place while it fades in … Once it is in place it pulses gently" |
| tokens | `:root { --motion-fast: 180 }` and `transition: transform var(--motion-fast) …`. The duration has no unit, so the declaration is invalid at computed-value time, and the drawer snaps | "slides a dark drawer in from the right edge over 180ms" |
| upright | the dial turns at 4s and the label counter-rotates at 5s, so on screen the word drifts 18°/s | "The word in the middle of the dial stays upright and perfectly still" |

Six fresh agents took part, three on the default model and three on a smaller one, with the same setup as
before. The tokens page first put its button where the open drawer covered it, so the second click could not
reach it. The button now sits on the left, on both pages, before any agent ran.

No hole made a reference page fail. On the broken pages, as given:

- **combo:** `travels 0px … no fail`. With `--expect-direction up`, the fail said "whatever was meant to move
  it is not applying".
- **tokens:** `snapped`, with the causes "height: auto … interpolate-size", which do not apply.
- **upright:** no fail. The label read `turns counterclockwise 278° (72°/s …)`, which is its own turn, not the
  drift seen on screen.

## Result

| page | model | rounds | oracle | what found the defect |
|---|---|---:|---|---|
| combo | default | 1 | PASS | `direction-mismatch … travels 0px`, beside "follows ease-out in its opacity"; the cause from the CSS |
| combo | small | 1 | PASS | the same |
| tokens | default | 2 | PASS | `snapped`; the unitless token from the CSS |
| tokens | small | 2 | PASS | the same |
| upright | default | 1 | PASS | the label's and the dial's periods, side by side (5000ms against 4000ms); the cause from the CSS |
| upright | small | 3 | PASS | the same, with its own pixel diff and a Jev claim |

All six repairs were right, and they were not all alike:

- **combo, default:** it dropped the pulse's backwards fill. The small agent moved the pulse to the `scale`
  property, as the reference does.
- **tokens, default:** it wrote `calc(var(--motion-fast) * 1ms)` and left the generated token alone. The
  small agent gave the token its unit.

One small agent made a remote call its brief forbade (`create_session`). It was denied, had no effect, and
the agent said so.

## What they hit, and what is fixed

- **The overridden entrance had no cause.**

  > "'whatever was meant to move it is not applying' should name the culprit: the pulse's fill holding
  > `transform` during its delay." (combo, default)

  **Fixed:** `inspect motion` finds two animations on one element that animate one property, where the
  later one is live while the earlier one runs. That pair is the cause in `direction-mismatch` and
  `target-static`: `` `rise` and `pulse` both animate transform, and `pulse` comes later in animation-name,
  so its value wins: its both fill holds its first keyframe's transform through its 400ms delay … ``. When no
  fail quotes it, it is `overridden-animation` (warn). `check animation` gains `overridden-animation`
  (suspect), measured from both animations' timing and fill.
- **`--expect-duration` saw only the loop.**

  > "`--expect-duration 400ms` failed with 'one run takes 1600ms, not 400ms (4.0x)'" (combo, default)

  **Fixed:** it holds when any of the target's own runs matches. The target line says `(its animations run
  400ms, 1600ms)`, and a scale gives its range (`its scale goes from 1.00 to 1.04`).
- **A unitless token read as an intrinsic-size problem.**

  > "`snapped` never looks at the computed `transition-duration` (0s here). It should name a `var()` that
  > resolves to a duration with no unit." (tokens, default)

  **Fixed:** `snapped` names it: `transition: transform var(--motion-fast) var(--ease-out) reads
  --motion-fast, which is 180 — a number with no unit, so the declaration is invalid at computed-value time
  and the transition is dropped: give the token a unit (180ms), or write calc(var(--motion-fast) * 1ms)`.
  `check animation` gains `unitless-duration-var` (suspect). A `var()` inside `calc()` is a multiplier
  (`calc(var(--i) * 80ms)`), and is not named. The first version flagged two correct stagger pages; the sweep
  below caught it.
- **A custom curve, and a "not judged" that contradicted the fit.**

  > "`follows ease (it fits 1.3x better …)`. Wrong: the page's curve is the custom `cubic-bezier(0,0,0.2,1)`"
  > (tokens, small)

  **Fixed:**
  - The target line names the element's own timing function when it is a curve with no name: `its own
    timing function is cubic-bezier(0, 0, 0.2, 1): the curve names here are the nearest built-in ones`.
  - `--expect-easing cubic-bezier(…)` is still refused, and the refusal says why and what to expect.
  - When a curve was fitted, `not judged` says the frames fit both curves about as well. It had said "no path
    was fitted".
  - `easing-unchecked` no longer advises closer sampling when the frames are already every 60fps frame.
- **One run per action could not take one value per action.**

  > "`--expect-direction left,right` was refused with '2 values for 1 targets'" (tokens, default)

  **Fixed:** with `--every-action`, `--expect-direction` / `-duration` / `-iterations` take one value per
  action, one for each step. Inside such a run, a step no longer prints "ran to its end unsampled".
- **A label's own turn read as what is seen.**

  > "The label's turn is reported as the element's own rotation, not what is seen on screen … Nothing
  > reports the net on-screen rotation" (upright, default)

  **Fixed:** with an ancestor that turns, the line reads `turns counterclockwise 278° … on its own; on
  screen, with div#dial's turn, its angle changes by 72°`, or, repaired, `it stays upright`. A new
  `--expect-upright` fails `upright-mismatch` when the angle on screen changes by more than 1°, through every
  transform up the tree: `div#dial turns it, and its own counter-rotation does not cancel that turn: give the
  counter-rotation the same duration, easing and delay`. `--expect-still` stays the centre's.
- **A counter-rotation was blamed on a sign.** With `--expect-direction clockwise` given for both targets, the
  label failed with `a rotate() with the wrong sign` (upright, default). **Fixed:** when an ancestor turns the
  target too, the message says its own turn is a counter-rotation against that ancestor's, and points to
  `--expect-upright`. `check animation` gains `counter-rotation-drift` (warn), measured from both rates:
  `` #label `turn-back` turns -360° per 5000ms against #dial's `turn` (360° per 4000ms), so on screen it turns
  18.0°/s clockwise ``.
- **Smaller ones:**
  - The upright dial overflowed at 375px (its turned box). Both pages now shrink it under 480px.
  - `inspect claims` gave Jev's price as ~$0.0002 a call. Measured, it is ~$0.00013.

`check animation` now has 240 rules. On the 72 other correct animated pages of the repo, none of the six
rules added in rounds 16-18 fires.

Confirmed with the user on 2026-11-04: round 18 is settled. Every point the agents raised was fixed in code,
with a test that reproduces it, and the full suite passes on the final commit (4698 tests).
