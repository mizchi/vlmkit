# motion-repair v13: a panel opened from display: none, a fill that holds transform over :hover, an unregistered custom property (2026-11-02)

## Question

Round 13 added three more defects:

| page | planted defect | the brief's words |
|---|---|---|
| popin | the Share panel goes from `display: none` to `display: block` with `transition: opacity, transform, display allow-discrete` and no `@starting-style`, so it opens at its end state in one frame (closing works) | "it fades in while dropping 8px into place, over 200ms … closing … fades out the same way" |
| rise | three cards enter with `animation: rise 400ms ease-out both`: the forwards fill keeps `transform: none` applied, so `.plan:hover { transform: translateY(-4px) }` never applies (the shadow, not in the keyframes, still changes) | "when the pointer is over a card, the card lifts 4px and its shadow deepens, over 150ms" |
| ring | a usage ring drawn with `conic-gradient(#2563eb var(--p), …)` and `transition: --p 1000ms ease-out`, with `--p` not registered with `@property`, so the arc steps from empty to 72% | "the blue arc fills smoothly clockwise from empty to 72% over one second, slowing at the end" |

Six fresh agents took part, three on the default model and three on a smaller one. The setup and the
hidden oracle (`fixtures/motion-repair/oracle.mjs`) were as before. The popin oracle pauses whatever
runs on the panel, so a `@keyframes` entrance passes as well as a transition. The ring oracle reads
the arc's share from the pixels on a circle inside the ring, so a JS-driven fill would pass too.

Building the round found two holes. They were fixed before any agent ran, because the reference
pages failed on them:

- **The first action ran at clock 0.** `--hover #p2` landed while the card was still in its
  entrance delay. The broken page and its repair gave the same `FAIL jump … sits 12px off where it
  rests`, so the hover lift was never measured. Finite animations that play at load now end before
  the first `--click`, `--hover` or `--leave`, as they already did between actions. Two cases keep
  the old timing: an explicit leading `--wait`, and a first `--scroll`, which keeps a reveal begun
  at load.
- **A gradient's stops were not measured.** The repaired ring read `travels 0px … target-static`,
  because a conic stop that moves changes no colour. A target's gradient stop positions and angles
  are now measured on paint's 0-255 scale, where 100% or a full turn is 255. They are fitted as
  their own channel: `follows ease-out in its gradient exactly`.

## Result

| page | model | rounds | oracle | what found the defect |
|---|---|---:|---|---|
| popin | default | 1 | PASS | `inspect motion --click`: `snapped … opacity 0.00 → 1.00 in one frame`, with the cause from the CSS |
| popin | small | 1 | PASS | the same |
| rise | default | 1 | PASS | `inspect motion --hover`: `travels 0px`, `warn target-static` with a wrong cause; the cause from the CSS |
| rise | small | 1 | PASS | the same, plus a wrong `duration-mismatch … 400ms` |
| ring | default | 1 | PASS | `inspect motion` refused, "no animation … it never starts"; the cause from the CSS |
| ring | small | 1 | PASS | the same |

All six repairs were right, and every agent made the reference's one-line change:
`@starting-style`, `both` → `backwards`, and `@property --p`. No tool named any of the three
causes. On ring, no gate reported a defect at all. `check animation` read "animations: 0 … No
animation issues detected". The smaller ring agent made one remote call its brief forbade
(`list_sessions`, read-only), said so, and used nothing from it.

## What they hit, and what is fixed

- **`snapped` named the wrong causes on the Share panel.**

  > "The hint listed three causes (height:auto without interpolate-size, misspelt property,
  > unlisted property), none of which matched this CSS." (popin, small)

  **Fixed:** a target that was not rendered before the action now gets this cause: `it was not
  rendered (it is display: none) before the action, and a transition from display: none has no
  style to start from, so it appears at its end state: give the shown state a @starting-style
  with the values it enters from …, or play its entrance as a @keyframes animation`.
- **A correct close read "never seen".** Both popin agents hit this, without `--jev`:

  > "FAIL target-hidden at 410ms: never seen in any frame … — covered by main" while "Frame
  > 0001-t000087.png shows the panel clearly visible" (popin, default)

  Measured: while its `display` exit transition runs, Chromium draws the panel, but
  `elementsFromPoint` at its centre returns only `body` and `html`. **Fixed:** a target leaving by
  a `display` transition, or inside an ancestor that is, is now seen wherever it is on screen. The
  reference close now reads `travels 8px upwards … follows ease-out exactly`.
- **A forwards fill under `:hover` was "not applying".**

  > "it named the wrong cause: 'its animation is not applying (a dropped rule, a misspelt
  > animation-name)'" (rise, default)

  **Fixed:** a finished animation whose forwards fill still holds what it animated is named in
  `target-static`: ``…`rise` ended with animation-fill-mode: both and still holds opacity, transform: an
  animation's held value outranks every rule, so a :hover or class that sets them (and its
  transition) never applies — fill it backwards …, or animate the separate translate / scale
  property``.
- **The hover was judged by the entrance's duration.**

  > "FAIL duration-mismatch … one run takes 400ms, not 150ms" (rise, small)

  **Fixed:** a target's own timing comes from an animation still running when there is one. A
  finished, filled entrance no longer counts. On the broken page the hover is now `runs 150ms`
  (the shadow's transition), not 400ms.
- **"held" was printed for expectations nothing checked.**

  > "'held: --expect-direction up' and 'no fail' were printed for a target that 'travels 0px'"
  > (rise, default; popin, default, after "no easing fit: not seen in any frame")

  **Fixed:** when no target's path was fitted, `--expect-easing`, `--expect-direction` and
  `--expect-origin` go on their own line: `not judged: --expect-direction up — no path was fitted
  (see the target's line), so nothing checked it`.
- **The unregistered custom property was not among the causes.**

  > "the candidate causes did not include an unregistered custom property" (ring, small)

  **Fixed:** before refusing with "no animation", `inspect motion` now looks for transitions on a
  custom property that no `@property` rule registers. It reads the stylesheets the page can read,
  and names what it finds: `div.ring.filled transitions --p, a custom property no @property
  registers — an unregistered custom property has no type, so it does not interpolate and steps
  at once. Register it (@property --p { syntax: "<percentage>"; … })`.
- **The skill taught the rise bug.**

  > "dynamic-markup Phase A advises: 'author the entrance animation with `both`/`forwards`
  > fill'. That is exactly how this bug gets made." (rise, default)

  **Fixed:** Phase A now says to fill the entrance `backwards`, and says why.

On the other pages, nothing changed: the motion tests (73) pass, including every earlier round's
`--hover` and `--click` cases.

## Deferred

- Two `--click`s sample only the last action's motion. Nothing says the first one's motion (the
  open) was not sampled. One popin agent had to run the command again to see it.
- On the broken ring with `--end 1500`, the one-frame step in the gradient was fitted as
  `follows overshoot in its gradient (it fits 3.1x better …)`. A step should read as `snapped`,
  not as a curve.
- `--expect-direction clockwise` cannot check an arc that sweeps: `FAIL direction-mismatch … it
  does not turn`. The brief's "clockwise" could not be checked.
- `check animation` has no rule for a transition on an unregistered custom property. On the
  repaired ring it reads "animations: 0" without `--virtual-time`, and with it the transition
  begins at 250ms where `inspect motion` says 200ms. Its motion box was "(548,330) 9x17".
- A `box-shadow` change is not measured. Both rise agents confirmed the deeper shadow only by
  looking at the frames.
- `inspect motion` has no `--no-ledger`, and a usage error prints the whole help (~100 lines).
- The same frames were fitted as "follows ease-out exactly" in one run and "it fits 2.1x better
  than … ease" in another run with three selectors.
- `check integrity` reports `page-overflow-x #p3 @375` on the rise fixture. The three-column grid
  does not fold at 375px. This is in the fixture, outside the brief's 1280x800, and on both pages.
