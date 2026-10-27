# motion-repair v12: a scroll timeline reset by a shorthand, an SVG turning about its viewBox, a label wrapping mid-widen (2026-10-27)

## Question

Round 12 added three more defects:

| page | planted defect | the brief's words |
|---|---|---|
| reading | `animation-timeline: scroll(root block); animation: grow linear both;` — the shorthand after the timeline resets it to `auto` and the duration to 0s, so the bar is full from load | "empty when the page is at the top, fills from the left as you scroll down … both ways" |
| gear | `.gear { transform-origin: center }` on an SVG `<g>`: by default `transform-box` is `view-box`, so the gear orbits the centre of the 120x48 SVG | "turns in place, clockwise, one full turn every 2 seconds" |
| label | the label is swapped at once, while the button's `width` eases from 150 to 260px, so for ~80ms the new label wraps and the button is 20px taller | "the label stays on one line and the button keeps its height" |

Six fresh agents took part, three on the default model and three on a smaller one. The setup and
the hidden oracle (`fixtures/motion-repair/oracle.mjs`) were as before. The reading oracle reads the
bar's painted width at five scroll positions and back, so a scroll listener would pass as well.

Building the round found three holes. They were fixed before any agent ran, because the reference
pages failed on them:

- `inspect motion` counted points of an SVG group's box that none of its shapes covers. The
  reference gear read `target-lost … covered by rect` 24 times: the rect is the pill behind the
  gear. A point of a group (or an `<svg>`) now counts only where one of its own shapes is.
- A target on a scroll timeline was judged on the clock. The reference bar read `snapped 0x4 →
  1126x4 in one frame` after `--scroll`. It is now judged against the scroll. The scroller is swept
  from 0 to 100% and back to 50%, and the report gives the animation's progress at each step, which
  of the target's properties change, and fails `scroll-static` or `scroll-mismatch`.
- After `--scroll`, a fixed element was compared in page coordinates. It moved by the scroll and
  read as "changed". It is now compared in the viewport as well.

## Result

| page | model | rounds | oracle | what found the defect |
|---|---|---:|---|---|
| reading | default | 1 | PASS | the CSS; `check animation` read "1 animation (evaluated 0)" and nothing else |
| reading | small | 1 | PASS | the same |
| gear | default | 3 | PASS | `inspect motion --expect-still`: `still-mismatch` and `target-lost … clipped by svg`, with the cause from the CSS |
| gear | small | 2 | PASS | the same |
| label | default | 1 | PASS | `still-mismatch` on the heading next to the button (the only line that moved), with the cause from the CSS |
| label | small | 1 | PASS | the same |

All six repairs were right. No rule named any cause. On the reading page no tool reported the defect
at all. Both label agents found it only by making a neighbour a `--selector` with `--still`, because
the button's own centre does not move.

Two agents made different repairs from the reference, and both pass. The smaller gear agent set
`transform-origin` to the gear's own centroid in view-box units. Both label agents kept the label
clipped while the button widens (`overflow: hidden`), and they said a reviewer might still call that
odd.

## What they hit, and what is fixed

- **`check animation` crashed on the repaired reading page.**

  > "NotSupportedError: Failed to set the 'currentTime' property on 'Animation': … not supported
  > for progress based animations." (reading, both)

  **Fixed:** an animation on a scroll timeline is no longer seeked. It is listed instead:
  `scroll-driven: div.progress grow on scroll(root) — its time is the scroll's, so it is not
  evaluated here: vlmkit inspect motion <page> --selector <el> sweeps the scroll`.
- **The 0s animation passed.** `check animation` read "1 animation (evaluated 0)". `inspect motion`
  said "no animation … at load".

  **Fixed:**
  - `zero-duration-animation` (suspect, now 228 rules) names the animation and says the shorthand
    resets `animation-timeline`.
  - `inspect motion` gives the same cause instead of "no animation".
- **The button's size was never measured.**

  > "It only tracks the centre, which stays at y=440.5 because the card is centred." (label,
  > default)

  **Fixed:** `size-jump` (fail): `its height steps 64 → 44px between 107ms and 137ms in one frame
  (other frames 0.5px): … text wrapping while the box is still narrow (white-space: nowrap on it)`.
  It uses the target's box in every frame, and the reference page passes. Its first version
  failed the round 9 flip card, whose box is a turned shape's bounds under perspective. Frames
  turned in 3D are left out of it, and out of `turn-off-centre`, and a turn in 3D is reported as
  `turns over 180° in 3D`, with no clockwise.
- **Turning was not described, and an orbit read "travels 0px".**

  > "'travels 0px over the frames measured, follows linear in its turn' while the centre moved up
  > to 69px." (gear, default)

  **Fixed:**
  - The line now says `(ending where it began; 69px away at most, between), turns clockwise 696°
    (180°/s, a turn every 2000ms)`.
  - `--expect-direction` also takes `clockwise` and `counterclockwise`.
  - `still-mismatch` on a target that turns says that it turns about another point. On an SVG
    element it adds: `give it transform-box: fill-box with transform-origin: center`.
  - Without `--expect-still`, `turn-off-centre` (warn) says the same.
- **Other gates on a scroll-driven page.**
  - `check motion` read "active animations: 0". It now counts an animation on a scroll timeline,
    and names its timeline.
  - `check scroll` dropped the fixed bar from its list at `scaleX(0)`. It now uses the bar's
    layout box.
  - `inspect interact` snapshots showed the bar full at every scroll position, because `animation:
    none` removed its scroll timeline. An animation on a scroll timeline is now left on in the
    snapshots. `:where` keeps the rule's specificity, so no other page changes.
- **Smaller fixes.**
  - `--expect-still .gear` printed "expected one page, got 2". It now says the flag takes no value
    and to use `--still .gear`.
  - `--out-dir` points to `--frames`.

On the 88 other animated pages of the repo (`fixtures/` and `examples/`), `zero-duration-animation`
does not fire, and `check animation` throws on none of them.

## Deferred

- `check flash` does not scroll, so a scroll-driven strobe is not judged.
- `check integrity --viewport 1280x800` still reported at 375px, which an agent did not expect.
- `check integrity` writes `.vlmkit/run-ledger.jsonl` next to the page and does not say so.
- `inspect motion --jev` with `--target` and `--selector` on the label page gave a false
  `target-hidden`: Jev did not recognise the button once its label had changed.
- The gear fixture's hub hole is drawn 3px off the gear's centre, so it wobbles on every page. Both
  gear agents noticed it, and both left it as drawn. The oracle does not judge it.
