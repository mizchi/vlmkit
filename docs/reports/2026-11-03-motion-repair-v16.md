# motion-repair v16: a lifted card under its neighbour, a flip without perspective, entrances held by a boot class (2026-11-03)

## Question

Round 16 planted three defects, none of them in the classes of rounds 1-15 or the held-out set:

| page | planted defect | the brief's words |
|---|---|---|
| lift | every card has `transform: translateY(0)`, so each is a stacking context at `z-index: auto`; the hovered card (`scale(1.1)`) paints under the next one | "A lifted card is on top … no part of it is covered by anything" |
| turn | `perspective: 900px` is on the card that turns, not on its parent: it gives depth to the card's children, and the turn is drawn as a flat squash | "a real turn in depth … The edge swinging toward you grows taller than the card" |
| boot | `.is-booting * { animation-play-state: paused !important }`, released by a script that removes `booting`, not `is-booting`: the results stay at opacity 0 | "the four results come in one after another … The page uses a shared boot utility … That behaviour has to stay" |

Six fresh agents took part, three on the default model and three on a smaller one, with the same setup as
before.

**Two holes made reference pages fail, and both were fixed before the agents ran:**

- **`mirrored` on a correct flip card.** The target was a `preserve-3d` container, and its faces carry
  `backface-visibility: hidden`. A container like that draws each face by that face's own facing, so it is
  mirrored only when a face that is turned away and has a visible backface sits inside it.
- **`target-static` on the first result.** The hold leaves an animation the page paused to the page. An
  animation released by CSS (`animation-play-state`) calls no `play()` that the hold could see, so the first
  result ran out on the real clock before the first frame. Now, when the clock is still at 0, an animation the
  page paused that its CSS has since released is held from where it was paused.

After those fixes, on the broken pages as given:

- **lift:** nothing was reported. The visible share read `1.00` in every frame, because the 5x5 grid never
  reaches an edge.
- **turn:** nothing was reported: `turns over 176° in 3D … no fail`.
- **boot:** `target-hidden` fired with `transparent: it renders at opacity 0.00`, and no cause. `check
  animation` read `No animation issues detected … reduced-motion: honored`.

## Result

| page | model | rounds | oracle | what found the defect |
|---|---|---:|---|---|
| lift | default | 3 | PASS | the frames, by eye; the cause from the CSS |
| lift | small | 1 | PASS | a screenshot from `inspect interact`; the cause from the CSS |
| turn | default | 2 | PASS | the strip, by eye; a Jev claim to confirm; the cause from the CSS |
| turn | small | 1 | PASS | its own pixel measurement of the frames; the cause from the CSS |
| boot | default | 2 | PASS | `inspect motion`'s `target-hidden` and `check integrity`'s `invisible-text`; the cause from the script |
| boot | small | 1 | PASS | the same |

All six repairs were right. On lift, both agents went beyond the reference: `z-index: 1` on `:hover`, plus a
`z-index 0s linear 200ms` transition, so the card stays on top while it settles back. The reference dropped
`z-index` at once, and the card slid under its neighbour for the first part of the leave. So the reference and
the oracle now hold that too: at 40ms after the pointer leaves, the card is still not covered.

The boot agents noticed that the brief contradicted its own timings: it said "by half a second", while 240ms +
400ms is 640ms. The brief now says "about two thirds of a second". One smaller agent made a remote call its
brief forbade (`create_session`). It was denied, had no effect, and the agent said so.

## What they hit, and what is fixed

- **A covered edge read as fully seen.**

  > "The skill says 'a 5x5 hit-test of its box … is what sees a clip or a cover'. It doesn't see a cover of
  > about 9px on a card about 330px wide." (lift, default)

  **Fixed:** `inspect motion` also probes 48 points, 2px inside the target's edges. A target whose edge another
  element paints over is `covered-edge`. It is a fail when the target is raised (scaled up), and a warn
  otherwise. The finding names the cover and why it is on top: `raised (scale 1.10) and covered at its edge …
  by section#p3: both are stacking contexts at z-index: auto (it: a transform; section#p3: a transform), so they
  paint in document order … give it a z-index (z-index: 1) while it is raised`. A neighbour that is raised over
  the target on purpose (scaled up more than the target) is not reported.
- **A 3D turn without perspective read as a turn in 3D.**

  > "`turn` is byte-identical on the broken and fixed pages … 'turns over 176° in 3D' is read from the
  > transform matrix, not from what is drawn" (turn, default)

  **Fixed:** `flat-3d` (warn) fires when the turning element has no perspective, from its parent or from a
  `perspective()` in its transform: `perspective: 900px on div#card itself gives depth to its children, not to
  its own turn — move it to its parent (div.scene)`.
- **A paused entrance was transparent, with no cause.**

  > "`target-hidden` explains a transparent target but doesn't check whether its animation is paused at rest
  > by a play-state rule." (boot, default)

  **Fixed:** the cause is named: `held paused at 0ms of its animation \`result-in\` by .is-booting * {
  animation-play-state: paused }, which still matches at rest: whatever should release it … has not`.
- **`check animation` passed animations paused for good.**

  > "`check animation` ignores the page's own pause. It reports the four animations as `visible` with a
  > motion delta, while the frame taken in the same run shows nothing." (boot, small)

  **Fixed:** a new rule, `held-paused-animation` (suspect), fires on an animation the page holds paused at rest
  while its element is at opacity 0, and names the rule that holds it. The reduced-motion line reads `not judged
  — 4 animation(s) are held paused by the page and never run` instead of `honored`.
- **"taken as leaving" on a card that never leaves.** The note is printed now only when a target shown before
  `--leave` is gone at rest.
- **The lift page failed `check integrity` at 375px** (`page-overflow-x`, three columns). Both of its pages
  now fold to one column under 720px.
- **`--expect-still ''`** read the `''` as a second page. An empty argument is now named, along with the flag
  before it.

`check animation` now has 234 rules. On the 66 other correct animated pages of the repo,
`held-paused-animation` does not fire. Those pages are the reference pages, the intact motion-defects pages,
the correct held-out pages and the example sites.

## Deferred, and fixed after the round

- **A rest frame planned before a late release.** The plan is made at load. When an agent's probe page released
  the boot hold 300ms late, the rest frame fell mid-animation and a false `jump` named a transform cause. Now,
  if a measured target's own animation is still in its active phase when the rest frame comes, frames are added
  up to its real end, the rest frame moves past it, and the output says so: `sampled again: .result:nth-child(4)
  began later than the page's animations were timed at load (… at 560ms: something held them and released them
  later)`.
- **`motion-report.json` path entries carry `width` and `height`**: the box as drawn, measured from the page
  when it was. A 3D turn's foreshortening shows in the height. An agent had measured it from the PNGs.

- **A repaired page exits 1 on reduced motion alone.** After the repair, `check animation` exits 1 on boot by
  default (`reduced-motion-ignored`, for a brief with no reduced-motion policy), and the agents turned the rule
  off to find that nothing else failed. The rule stays a suspect and the exit code stays 1, as decided before.
  When it is the only suspect, the status line now says so: `status: suspect — only reduced-motion-ignored
  (WCAG 2.3.3, AAA): no other rule fails. If the brief sets no reduced-motion policy, the motion passed;
  --rule reduced-motion-ignored=off exits 0`. Confirmed with the user on 2026-11-03: the suspect and its exit
  code stay as they are, and the status line is the fix.
