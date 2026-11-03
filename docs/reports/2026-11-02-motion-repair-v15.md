# motion-repair v15: a blur held at rest, a @keyframes name defined twice, a stagger with negative delays (2026-11-02)

## Question

Round 15 planted three defects, none of them in the ten classes of rounds 1-14 or the held-out set:

| page | planted defect | the brief's words |
|---|---|---|
| focus | `@keyframes focus-in { … to { filter: blur(0.6px) } }` with a `both` fill: the card rests soft for good | "Once it has arrived, the card and its text are perfectly sharp" |
| fadeup | `@keyframes fade-up` is defined twice. The later one is a shared utility that only fades, and it wins over the component's rise | "each one fades in while rising 12px into place … without changing … the shared utility styles' behaviour" |
| queue | `animation-delay: calc(var(--i) * -80ms)`: each lower row starts part way through, and the fourth is 80% in at load | "the first straight away, each next one 80ms after the one above … No row is visible before its turn" |

Six fresh agents took part, three on the default model and three on a smaller one. The setup was as before. The
oracle replays each entrance from its start and keeps the animation handles, as round 14's had to.

No hole made a reference page fail before the agents ran. On the broken pages, as given:

- **focus:** no tool reported anything.
- **fadeup:** `direction-mismatch` fired, with no cause.
- **queue:** `start-mismatch` fired, naming the negative `animation-delay`. A round 3 rule found a class it was
  never built on.

## Result

| page | model | rounds | oracle | what found the defect |
|---|---|---:|---|---|
| focus | default | 1 | PASS | nothing: the CSS |
| focus | small | 2 | PASS | nothing: the CSS, then `diff png --threshold 0` against a page without the filter |
| fadeup | default | 1 | PASS | `inspect motion --expect-direction up`: `direction-mismatch … it does not move`; the duplicate from the CSS |
| fadeup | small | 1 | PASS | the same |
| queue | default | 1 | PASS | `inspect motion`: `start-mismatch … set by .row { animation-delay: calc(var(--i) * -80ms) }` |
| queue | small | 1 | PASS | the same |

All six repairs were right, and they were not all alike:

- **focus:** the default agent changed the last keyframe to `blur(0)`. The smaller one tried that first,
  found the rest frame byte-identical to the broken page's, and changed the fill to `backwards`. With that
  fill, the rest frame matched a page with no filter at all.
- **fadeup:** both agents renamed the component's keyframes, which left the utility alone, as the brief asked.

Two of the smaller agents each made one remote call their brief forbade (`interrupt_session`, a placeholder id).
It was denied, had no effect, and both said so.

## What they hit, and what is fixed

- **The blur could not be seen.**

  > "The broken and fixed pages' rest frames (900ms) are byte-identical … this headless Chromium at 1x scale
  > draws a 0.6px blur as no blur at all" (focus, default)

  At 1x a blur under 1px draws as nothing, so no frame of any tool can show this defect. Only the computed
  style shows it. **Fixed:**
  - `inspect motion` measures a target's `filter` as a channel: `follows ease-out exactly in its opacity and
    its filter`.
  - A finished animation whose fill holds a filter that changes the picture is `held-filter` (warn): `` `focus-in`
    ends on filter: blur(0.6px) and its fill holds it at rest … (at 1x a blur under 1px can draw as no blur, so
    the frames may not show it) ``.
  - `check animation` has the same rule. An identity filter (`blur(0)`, `brightness(1)`) is not reported, so
    the reference page passes.
- **A false `channel-step` on the repaired card.** Near its end the computed blur is written with an exponent
  (`1.2e-05px`), and the number parser read it as 5px. Every number read from a computed style now takes an
  exponent.
- **No rule for a `@keyframes` name defined twice.**

  > "Nothing names a duplicate `@keyframes` name or a later declaration overriding an earlier one." (fadeup,
  > small)

  **Fixed:** `check animation`'s `duplicate-keyframes` (suspect) lists what each rule animates: `` `fade-up`,
  which 2 @keyframes rules define (#1: opacity, transform; #2: opacity): the last one in the cascade wins ``.
  `inspect motion` gives the same as the cause of `direction-mismatch` and `target-static`.
- **A row that moved before the page was shown read "it does not move".**

  > "Row 4 had already finished before the first sampled frame at 30ms … a sampling gap presented as a
  > broken keyframe." (queue, small)

  **Fixed:** when a target's own animation began before 0ms and is at least half through at the first frame,
  the fail says so: `its own animation began 240ms before the page was shown and was 90% through at the first
  frame (30ms) … a negative animation-delay plays that part before the page is shown`. The header no longer
  reads `6 frames over -240..300ms` with the first frame at 30ms. It reads `0..300ms (motion from -240ms: some
  of it began before the page was shown …)`.

  `check animation` gains `negative-delay-entrance` (warn): a finite animation from a hidden or offset first
  keyframe with a negative delay, `starts 240ms into its 300ms run`.
- **"not judged" for every row when one had no fit.**

  > "it printed 'not judged: --expect-easing ease-out — no path was fitted' … But #r1-#r3 each 'follows
  > ease-out'" (queue, default)

  **Fixed:** an expectation checked on some targets is held, and the targets it was not checked on are named:
  `held: --expect-easing ease-out (not checked on "#r4": no curve fitted there)`.
- **`diff png` read a whole-card difference as "no changes".**

  > "Default `diff png` threshold: 'diff: 0.00% … summary: no changes' … At `--threshold 0` the same pair
  > reads 'diff: 2.57%'" (focus, small)

  **Fixed:** when nothing passes the threshold, the pixels that differ at all are counted, and the count is
  reported when it is not 0: `below: N px differ under the threshold (2.57%): too faint to count as a change
  … (--threshold 0 counts them)`. It is also in `--json` as `belowThreshold`.

`check animation` now has 233 rules. On the 72 other animated pages of the repo, none of the three new rules
fires. Those pages are the rounds' reference pages, the motion-defects pairs, the held-out set and the example
sites. The motion tests (182, the held-out 25 included) pass.

## Deferred

- On the focus page, a step that changes only the filter, at 599 → 600ms, reads `1 layout-shift` in `diff png`.
  Nothing moved.
- `check animation` prints `reduced-motion: honored` for an opacity-only animation on a page that has no
  `prefers-reduced-motion` rule at all. `check motion` on the same page says no such rule was found.
- Without an `--expect-*` flag, `inspect motion` gives no fail on a page whose rise never happens: `travels
  0px` is only a fact. Both fadeup agents needed `--expect-direction` to see a fail.
- With `--expect-start 0 --expect-stagger 80`, the fail reads `begins at -80ms, not 80ms`. It does not say
  which flag the 80ms comes from.
- `inspect motion` has no device-scale option. A 0.6px blur that draws as nothing at 1x may show on a 2x
  screen.

## Deferred, and fixed after the round

- **A filter-only step is not a layout shift.** A region with no measured translation whose pixels differ by
  at most `FAINT_CHANNEL_DELTA` (8/255) is `color-change`, described as a faint in-place change: `no pixel
  differs by more than 1/255 and nothing moved`. The focus card's 599 → 600ms step read `1 layout-shift` /
  `1 element-added` at a low threshold. At the default threshold no region is that faint, so nothing
  else changes.
- **"Nothing to reduce", not "honored".** When nothing that moves runs without the preference either
  (only opacity, colour or visibility, and no script-driven motion), `check animation` says `reduced-motion:
  nothing to reduce — no animation here moves anything …; not a sign the page has a prefers-reduced-motion
  rule`. The report carries `nothingToReduce` and `fadesUnderReduce`, and the headline says `nothing to
  reduce`. A page that takes a slide away under reduce still reads `honored`.
- **A rise that never happens is said without an `--expect-*` flag.** `inspect motion` warns
  `duplicate-keyframes` when the target's own animation is a name that rules animating different properties
  define: `` `fade-up` is defined by 2 @keyframes rules (#1 animates opacity, transform; #2 animates opacity)
  … (here it travels 0px) ``. Rules that animate the same properties are a redefinition and are not named.
  The warning is dropped when a fail already quotes it.
- **A start-mismatch names where its expected time comes from.** For example, `begins at 200ms, not 280ms
  (the first target's measured start 200ms + 1 × --expect-stagger 80)`, or `not 0ms (--expect-start 0)`.
- **`inspect motion --device-scale <n>`** (1-4) shoots every page and frame at that device scale.
  `frames.json` records it, and the strip's `--crop` hint is in frame pixels. Positions stay in CSS px. Jev's
  boxes are read in frame pixels, so the flag is refused with `--jev`. At 2x the focus card's held blur is
  named the same way.
