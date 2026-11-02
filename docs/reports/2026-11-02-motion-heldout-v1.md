# motion-heldout v1: were the motion tools fitted to the pages they were built on? (2026-11-02)

## Question

`inspect motion` and `check animation` grew over fourteen motion-repair rounds, each adding a rule
or a threshold for the three pages it planted. Each rule was checked against those pages, and a
rule can be right for one page and wrong for the next. A threshold can come from one example (the
round 14 card drifted 20°, so "off the axis" was set at 10°). Tests on the same fixtures cannot show
that.

So this round used a new set of pages. An agent that never saw the code, the fixtures or the reports
wrote 25 pages (`fixtures/motion-heldout/`). It read only `inspect motion --help`, for flag names.

- **The ten defect classes of rounds 1-14.** Each has a broken page that shows the defect in another
  form: the Web Animations API, the individual `translate` / `rotate` / `scale` properties,
  `offset-path`, `inset-inline-start`, `[hidden]`, `CSS.registerProperty`, an unitless duration.
- **A correct page for each class, built to look like the defect.** A clip-path wipe that starts out
  unseen. An exit that `display` transitions correctly. A dot meant to arc up and over. A fixed
  snackbar that animates `bottom`. A static box that animates `left` together with `translateX`. A
  `both` fill on a property that hover does not change. A custom property registered from JS. A
  nested `@starting-style`. A pendulum about its top edge. A colour-only change. A `steps()` loader.
- **Four plain pages:** a list stagger, a drawer, a hover lift and a progress bar.

The agent verified each page in Chromium by itself. For each case, `cases.json` records the brief and
the arguments a user would pass from it.

## Result

| | first run | after the fixes |
|---|---|---|
| broken pages caught by `inspect motion` (of 10) | 7, plus 1 refused with an error | 9, plus c9 refused as a 0s animation (`check animation`: `zero-duration-animation`) |
| correct pages with a FAIL from `inspect motion` (of 15) | 2 (c8 pendulum `jump` ×4, c10 steps `easing-mismatch` + `loop-seam`) | 0 |
| correct pages with a `check animation` issue (of 15) | 2 (c4 `inert-offset-animation`, c6 `unregistered-property-transition`) | 0 |
| warnings that were wrong | 2 (c1 `target-static` naming a fill, plain-progress-width `locate-unsure` naming a model with no model asked) | 0; 2 left that are true (c8 `turn-off-centre`: it turns about its top edge; c10 `easing-unchecked`: frames too far apart to tell `steps` apart) |

Here is each case from the first run, with its cause. Each one came from fitting to the rounds' pages.

- **Only `transform` was read.** The individual `rotate`, `scale` and `translate` properties were
  never measured. c10's broken spinner, which turns by `rotate` to 330°, read "it does not turn", and
  failed for the wrong reason. Its seam was never checked. c5's hover `scale` read as no change. Every
  rounds' page used `transform`. Now the measurement composes `translate`, `rotate`, `scale` and then
  `transform`, as CSS does. This covers the scale, the turn, the facing, the translation and the
  loop-seam check. c10 now fails `loop-seam` on its 30° step.
- **The straight-path threshold came from one card.** It was 10°, from the round 14 card's 20°. c3
  drifts 48px over a 360px slide (7.6°) and passed. The threshold is now 5° with an 8px floor. On the
  rounds' pages nothing new fires.
- **A seam on `steps()` timing.** The loop-seam check compared the step across a loop with the rate
  either side. Under `steps()` that rate is 0, so every 45° step was a seam. `check animation` already
  left out steps(), and `inspect motion` now does too.
- **A mismatch claimed between curves the frames could not separate.** c10-correct, `steps(8)`
  sampled 77ms apart, fitted ease-out by 1.1x and failed "not steps". When the expected curve's error
  is within 1.5x of the best one's, it is now `easing-unchecked` (warn). The warn says to sample
  closely, and the expectation is listed as not judged.
- **A jump judged only against its two neighbours.** The pendulum, sampled 240ms apart, is slow at
  both turning points around every fast middle step. A jump now must also be 3x the segment's median
  step speed.
- **Error, not a fail, when a fill blocks a hover.** c5's WAAPI entrance filled `scale` forwards, and
  the hover changed nothing. The run ended "nothing animated … check the action reaches the control",
  exit 2. It is now `FAIL held-by-fill`, naming the animation and the property. The fill is named only
  for a property the element also transitions. Without that, c1's clip-path reveal read "still holds
  clipPath … a :hover … never applies", beside its own correct rest.
- **A clip-path wipe read as static.** A clip-path's numbers (inset edges, radii) are now a channel,
  `clip`.
- **A model's box with no model.** Without `--jev`, the sample's box is the element's own. A progress
  bar 0px wide at its start "missed" itself, which gave `locate-unsure` with the text "the model's
  shown was boxed off". An identical box is no longer compared.
- **`check animation`, two false alarms.**
  - A static box animating `left` and `translateX` together slides, so `inert-offset-animation` now
    skips an animation that also moves by `transform` / `translate`.
  - A custom property registered by `CSS.registerProperty` read as unregistered. The `@property`
    walk cannot see a registration made from a script. Registration is now probed: a property
    registered with a type computes `initial` to its initial value, and an unregistered one computes
    it to nothing. `inspect motion` uses the same probe.

What did hold, unchanged, on pages it had not seen:

- `target-hidden` on a badge trapped by a `translateZ(0)` stacking context.
- `hidden-at-once` on a WAAPI exit hidden in the same task.
- `snapped` naming `@starting-style` on a `[hidden]` menu.
- The inert offset on `inset-inline-start`.
- The unregistered custom property behind a `translate: var(--pos)`.
- The wrapper turning about its far-off centre.
- `zero-duration-animation`.
- The plain pages, and the `display` exit that Chromium leaves out of hit-testing.

## Held by tests

`packages/vlmkit-markup/src/inspect/motion-heldout.test.ts` runs every case through
`inspect motion` (exit code, and the recorded rule for a broken page). It runs them through
`runAnimationEval` too (the exact issue kinds, leaving out `reduced-motion-ignored` and
`infinite-animation`, which no brief covers): 25 of 25. The rounds' own tests still pass, with one
assertion corrected: the round 13 card's fill message now names only `transform`, the one property it
transitions, not `opacity, transform`.

## What this does not show

These pages were used to make the fixes, so they are now training data like the rounds' pages. The
next check of this kind needs a new set nobody has tuned against. The set is also one agent's idea of
"another form". It was written to the same ten classes, so a defect outside them is still untested.
