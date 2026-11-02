# motion-repair v11: a colour that steps, an entrance replayed by a re-render, an exit hidden before it plays (2026-10-27)

## Question

Round 11 added three defects. None of them moves the target's box the wrong way:

| page | planted defect | the brief's words |
|---|---|---|
| gradient | `transition: background 300ms` between two `linear-gradient()`s on `:hover`. A gradient is an image and does not interpolate, so it steps | "the gradient shifts smoothly … over 300ms, and … back the same way" |
| quote | `quote.innerHTML = …` every second, so the price is a new element each time and its 400ms entrance plays again | "the numbers change in place, and nothing fades or moves again" |
| dismiss | the Dismiss handler sets `hidden` (`display: none`) in the same task as the class that starts the exit animation | "the message fade[s] out while it sinks 16px (250ms) … nothing on the page can be clicked through it" |

Six fresh agents took part, three on the default model and three on a smaller one. The setup and
the hidden oracle (`fixtures/motion-repair/oracle.mjs`) were as before. The gradient oracle reads
colours from the pixels, so it does not care how the fade is built.

Building the round found one measurement hole. It was fixed before any agent ran, because the
reference page read wrongly. A dismissed banner at rest has no layout box. It was measured as a
box at (0,0), so the exit "travelled up", the easing fitted to it was `steps`, and the rest frame
was `locate-unsure` "the model's 'shown' was boxed off", with no model asked. A target with no
layout box is now not rendered, and the frame says by what (`not rendered: it is display: none
(the hidden attribute)`).

## Result

| page | model | rounds | oracle | what found the defect |
|---|---|---:|---|---|
| gradient | default | 1 | PASS | the CSS. `inspect motion --hover` refused with "no --selector target changed"; frames from `inspect interact` showed the snap |
| gradient | small | 1 | PASS | the same |
| quote | default | 1 | PASS | `check animation`'s `seek-ineffective` ("a framework re-render"), and the script |
| quote | small | 1 | PASS | the same |
| dismiss | default | 1 | PASS | `inspect motion --click`: `snapped … → 0x0`. The cause came from the script |
| dismiss | small | 1 | PASS | the same |

All six repairs were right, each in one round. No rule named any of the three causes. Two
defects reached a line at all, and both with the wrong cause. Neither motion tool saw the third:
`inspect motion` passed the broken quote page ("follows ease-out exactly, no fail"), because its
frames end at rest, 300ms before the first re-render.

The smaller model's quote agent called one remote session tool by mistake, though the prompt
forbids it (`list_sessions`, read only). It said so in its report. Nothing else was affected.

## What they hit, and what is fixed

- **A colour change was invisible.**

  > "'no --selector target changed' is false: the gradient changed. `inspect motion` has no colour
  > or background channel." (gradient, default)

  **Fixed:**
  - `--selector` measures every colour the target paints (its background's gradient stops, its
    text and its border), and fits them as a channel. The reference page reads `follows ease in
    its colour`, and its false `target-static` warn is gone.
  - A colour that changes in one frame is `snapped`. When the transition runs on `background` over
    a gradient, the line says why: `only its colour changed, and its transition on background runs
    between two gradients, which do not interpolate … transition registered colour properties
    (@property)`.
  - `check animation` has a new warn, `discrete-transition`: an element whose transition names
    `background` (or `background-image`) while its `background-image` is a gradient. The reference
    page, which transitions `--from` and `--to`, raises nothing. There are now 226 rules. On the
    repo's other pages, the first version also counted `transition: all`. That gave 5 findings on
    2 pages, and 4 of them were gradient buttons whose `all` is there for a hover lift. The fifth,
    a product image whose gradient changes with the selected colour, snaps, so it is a real finding.
    `all` is now left out.
- **An entrance replayed by a re-render was invisible to both motion tools.**

  > "`inspect motion` default window: 'no fail; measured from the page' on a page that re-fades
  > every second." (quote, small)

  **Fixed:** `replayed` (fail). After the rest frame, `inspect motion` runs the page's own timers
  on for 3s and looks at each target every 100ms. If the element was replaced by a new one that
  plays an animation, it fails: `the page replaced it with a new element by 1000ms, 2000ms,
  3000ms (a re-render: innerHTML …), and the new one plays rise again each time. Update what it
  shows (textContent …) instead of re-creating it`. If the same element's animation begins again,
  it is a warn, since a highlight on each update can be meant. The first version counted an
  animation held at its end by `fill: both` as playing. Only the active phase counts now.
- **The `snapped` hint gave causes that did not fit.**

  > "The snapped hint is about transitions only … the real cause is display: none / [hidden]
  > applied in the same handler." (dismiss, default)

  **Fixed:** when the target has no layout box after the action, the line says that the action
  took it out of rendering in the same frame, so no exit can be drawn. It says to hide it on
  `animationend` instead, or to use `transition-behavior: allow-discrete`.
- **"Nothing can be clicked through it" had no check.** One agent wrote its own `elementFromPoint`
  probe. **Fixed:** `invisible-blocker` (fail). At rest a target at opacity 0 that still takes the
  click at its centre fails, and the line names the point. All four repairs hide the banner on
  `animationend` and pass. A copy of the reference without that line fails.
- **Smaller fixes.**
  - A pass listed nothing of what was asked. It now prints `held: --expect-duration 250ms,
    --expect-direction down, …` above the tally.
  - `--out` is taken as `--frames`. It had been refused with a hint.
  - A snapped run says `no frames written: nothing animated to shoot`.
  - `inspect interact` no longer reports a held animation as "cancelled or replaced mid-window"
    when the seek had already taken it to its end. A banner hidden on `animationend` removes its
    finished animation, and the line had read as a fault.

## Deferred, and fixed after the round

Every item below is fixed.

- **`check animation --virtual-time` names an entrance that a re-render replays.** While the clock
  runs, the sweep tells a new animation object from one already seen. If one begins again under a
  key it has already seen, it is `animation-replayed`. On a new element (a re-render) it is a
  suspect: `span.price rise plays again by 1000ms, 2000ms of virtual time on a new element`. On the
  same element it is a warn. There are now 227 rules.
- **A value updated in place is not motion.** The virtual clock now counts the animation-frame
  callbacks and timer runs it makes. With no frame callback, no animation begun, and timers at most
  5 a second, the sweep's change is an update: `script-driven change …: a timer updates it in place
  (2 run(s), no animation frame) — not motion`. It is no longer counted as motion still running
  under reduced motion. A `setInterval` that moves something every 16ms is still motion. On the
  reference quote page, reduced motion now names only the entrance.
- **`snapshot storyboard`**:
  - An `inspect interact` frames step now writes `before.png`, the page just before its action,
    and names it in `frames.json` (`source.before`). The storyboard compares it with frame 0. The
    snapped hover reads `Before frame 0: the page just before the action differs from frame 0 by
    7476 px — done by the first frame`. Before, it read only "No events".
  - A change that is largest near its start and ends close to where it began gets a note: `an
    entrance playing again (an element re-created, a class reset), not a move`. The broken quote's
    two re-renders get it, and the reference page's text-only updates do not.
- **`check motion`** marks a transition on `background` over a gradient in its sample line: `(over a
  gradient, which does not interpolate: it steps — check animation's discrete-transition)`.
- **`replayed` looks up to 10s past rest** while timers are due. It stops once every target has
  replayed twice, or once no timer is left. A quote that re-renders every 5s is caught at 5000ms.

## Deferred (as written after the round)

- `check animation --virtual-time` reads the replaying quote's entrance as `visible` with no
  `seek-ineffective`. It also counts the required one-second ticker as motion still running
  under reduced motion.
- `snapshot storyboard` on frames taken after a hover reads "No events" when the change lands
  before frame 0. It also reads each replayed entrance as a `change`, not as an entrance played
  again.
- `check motion` lists `transition=background 0.3s` and says nothing of the gradient.
  `check animation` names it now.
- `replayed` looks 3s past rest. A re-render on a slower timer is not seen.
