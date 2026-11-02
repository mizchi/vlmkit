# motion-repair v9: a change of mind, a card turned over, and reduced motion that hides (2026-10-22)

## Question

Round 9 added three new kinds of defect, none of which any rule covered:

| page | planted defect | the brief's words |
|---|---|---|
| flip | a flip card's faces have no `backface-visibility: hidden`, so after the turn the question side shows mirrored over the answer | "once the card has turned past edge-on, only the answer side is seen" |
| interrupt | opening and closing are two `@keyframes` animations, so a second click while the menu unfolds starts the close from fully open | "the menu folds back up from wherever it has got to. It never first jumps to fully open" |
| reduced | `@media (prefers-reduced-motion: reduce) { .tile { animation: none } }` on tiles whose base style is `opacity: 0` | "for them the tiles are simply there from the start" |

Six fresh agents took part, three on the default model and three on a smaller one. The setup was
unchanged: they could not read the fixtures, the reports or the source, they had four rounds, and
the oracle was hidden from them. The oracle fails each broken page and passes each reference fix.

## Result

| page | model | rounds | oracle | what found the defect |
|---|---|---:|---|---|
| flip | default | 1 | PASS | `inspect motion --click .flip`: `absent-at-rest … covered by div.face`, the strip, and a Jev `--forbid` statement about mirrored text; the cause came from the CSS |
| flip | small | 1 | PASS | the CSS, then a Jev `--forbid` that failed the original and passed the fix |
| interrupt | default | 1 | PASS | the CSS. It proved the fix with a harness page of its own that clicks on timers |
| interrupt | small | 1 | PASS | the CSS, and a Playwright probe of its own |
| reduced | default | 1 | PASS | its own look at `check animation --frames-reduced-motion`, then the CSS |
| reduced | small | 1 | PASS | the same frames, then the CSS |

All six repairs were right, each in one round. No rule found any of the three defects:

- **flip:** `inspect motion` failed both the broken and the fixed page, with eleven `target-lost`
  findings on the broken one. None named the backface.
- **interrupt:** no command could click while the motion was still running.
- **reduced:** `check animation`, `check motion` and `stress media` all said the preference was
  honoured, with the page empty below its heading.

Jev was the only signal on the flip page. Two agents used a `--forbid` statement about mirrored
text, at $0.003 each.

## What they hit, and what is fixed

- **A change of mind could not be expressed.**

  > "`inspect motion --click A --click B` runs A to its end first, so it cannot express a change of
  > mind." (interrupt, small model)

  > "No command can click twice mid-motion, so I made two harness copies." (interrupt, default)

  **Fixed:** `--wait <ms>` after an action lets only that long pass before the next one, so the
  second click lands mid-motion. A target that jumps the moment it lands is `interrupt-jump`
  (fail). On the broken page, `--click .filters --wait 100 --click .filters` gives:

  > `.menu jumps the moment --click .filters lands at 133ms: 280x91 at opacity 0.56 → 280x164 at
  > 1.00 within a frame … a @keyframes animation always starts from its from, a transition
  > reverses from where it is`

  The reference page passes. `inspect interact`'s help now says that the steps before a frames
  step replay with motion off, which is why both agents' interact runs showed the menu fully open
  at 0ms, and it points to `--wait`.
- **The harness pages read "no animation on the page".** The timer search jumped to the latest
  timer, so a click at 100ms and its reversal at 200ms ran in one step. It now steps one frame at a
  time. The progress page from round 7 still begins at 100ms.
- **A turned card was misread.**
  - Facing is now measured: the z of the element's normal through every transform up the tree.
  - A face turned past edge-on with its back face drawn fails `mirrored`, with the fix named:
    `give it backface-visibility: hidden (on each face of a flip card)`.
  - A cover that faces away is named as such: `covered by div.face, which faces away from you …
    painted mirrored over the target`.
  - Frames within 15° of edge-on are not judged. A face turned away is neither lost nor `absent`
    at rest.
  - A rotation is no longer read as a scale: scale now comes from the 3D column norms, after
    "the scale grows from the line through its middle".
  - Turned frames are left out of `--expect-still`.
  - A face with no animation of its own takes its timing from the nearest animated ancestor, so
    `--expect-duration` on a face no longer prints nothing.
  - On the fixed page, `inspect motion` used to fail and now has no fail. The broken page fails
    `mirrored` on both faces.
- **`check integrity` called the answer face "painted over" by the question.**
  - A face turned away with its back hidden is not painted, so it is no longer checked.
  - A face turned away with its back drawn is now described as the far side of a flip card, with
    the backface fix. The old advice was "reorder the stacking", which would have shown it
    mirrored.
- **"reduced-motion: honored" on an empty page.**

  > "'reduced-motion: honored' printed the same way on the broken page and the fixed one. It only
  > means the motion stopped, not that the content can still be seen." (reduced, default)

  **Fixed:** a new rule, `reduced-motion-hides` (suspect; there are now 222 rules). It compares
  where every animated element rests, with every finite animation finished, with and without the
  preference. An element that is seen without the preference and sits at opacity 0, or 8px or more
  from its place, with it fails. The broken page gives:

  > `reduced-motion: honored — but 3 element(s) rest hidden or out of place under it`
  > `ul.tiles > li:nth-of-type(1) rests at opacity 0.00 under prefers-reduced-motion: reduce, and at 1.00
  > without it: the reduce rule took its animation away, and with it the fill that showed it`

  The reference page passes. None of the 21 reference pages in `fixtures/motion-repair/`, the 7 intact pages in
  `fixtures/motion-defects/`, the 8 pages in `fixtures/integrity-timeline/` or the landing page
  fires it.
- **Smaller fixes.**
  - A step out of an unseen delay is no longer a `jump`. A tile at opacity 0 "jumped" 10px into its
    rise.
  - `--target` now names only the `--selector` in its own position. Before, three `--selector` with
    one `--target` were refused.
  - A timer-started animation is listed with its own duration. It read "shrink 500ms" for a 300ms
    animation.

## Deferred

- `stress media`'s reduced-motion variant still passes on the stylesheet declaring the media
  query, with a 0.40% delta on a page whose content vanished. Its viewport is still 1280x720.
- `check motion` reports only motion that is active at load.
- `--exits` applies to every target, so a flip card needs one run per face.
- `inspect motion` fits no easing to the turn itself: the face's centre does not move, and the
  angle is not a channel it fits.
- `check integrity --timeline` cannot emulate reduced motion either. `reduced-motion-hides` is
  `check animation`'s.

## The deferred items, fixed

- **`stress media`'s reduced-motion variant looks at what is left on screen.** It lists every
  element with text of its own, or an image, after every finite animation has finished, once with
  the preference and once without. Elements seen without it and invisible with it make the variant
  `suspect`, whatever the stylesheet declares. On the broken page that reads `Under reduced motion
  6 element(s) seen at rest without it rest invisible (ul.tiles > li:nth-of-type(1) > h2 …)`; the
  reference page is still `ok` at 0.06%. Its default viewport is now 1280x800, as the motion gates'.
- **`check motion` counts motion declared but not active at load.** The stylesheet may declare
  `@keyframes`, or an animation or transition, that only a class, `:hover` or a script applies.
  With no reduce rule, that is now `missing-reduced-motion` too: "none active at load (a class,
  :hover or a script applies them)". The broken interrupt page had read "No motion issues
  detected".
- **`--exit <css>` marks one target as leaving.** A flip card's front face turning away and its
  back turning in are now judged in one run (`--selector .back --selector .front --exit .front`).
  An `--exit` that names no `--selector` is refused.
- **The turn is a channel.** Each frame now measures how far the target is turned. In 3D that is
  the angle of its normal through every transform; otherwise it is its own 2D rotation. The turn
  is fitted beside position, opacity and scale. On the reference flip page both faces read
  `follows ease-in-out in its turn exactly`, and `--expect-easing linear` fails `the turn follows
  ease-in-out … not linear`.
- **`check integrity --reduced-motion`** loads every page, and every instant of `--timeline`, with
  the preference emulated. The broken reduced page fails its tiles' text there as `invisible-text`
  and names the transparent tile. The reference page is clean.

