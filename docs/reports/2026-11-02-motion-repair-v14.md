# motion-repair v14: a fade-out hidden by visibility, a rotate before its translate, an offset on a static box (2026-11-02)

## Question

Round 14 added three more defects:

| page | planted defect | the brief's words |
|---|---|---|
| hint | a help bubble with `transition: opacity 200ms` and `visibility: hidden` at rest: leaving the "?" flips `visibility` at once, so the fade-out is never seen (the fade-in works) | "when the pointer moves off, the bubble fades out the same way, over the same 200ms" |
| ticket | `from { transform: rotate(-20deg) translateX(-200px) }`: a transform list applies right to left, so the 200px runs along the tilted axis and the card swoops up 68px | "it slides straight across to its place … It travels horizontally the whole way" |
| nudge | `@keyframes nudge-in { from { left: -360px } }` on a notice with no `position`: offsets do nothing on a static box, so it only fades | "slides in from the left, from 360px left of its place, fading in as it comes" |

Six fresh agents took part, three on the default model and three on a smaller one. The setup and the hidden
oracle (`fixtures/motion-repair/oracle.mjs`) were as before, and the agents' brief now forbids read-only remote
tools as well. The oracle reads the bubble's computed visibility and opacity, the card's centre and angle, and
the notice's box, so a `translate` repair of the notice passes as well as `position: relative`.

Building the round found one hole, fixed before any agent ran. The reference card read `warn turn-off-centre
… it turns about a point that is not its own centre`. It slides 200px while it straightens, and the warning
counted the slide as an orbit. A target's own translation is now measured, and the warning leaves out a centre
that its translation explains. The round 12 gear, which turns about its SVG's centre, still gets it.

During the round the oracle itself was wrong once. The smaller ticket agent also filled the entrance
`backwards`, as the dynamic-markup skill now says to. Once a `backwards`-filled animation ends, it is off its
element and out of `getAnimations()`, so the oracle found nothing to pause and failed a correct repair. The
ticket and nudge oracles now play the entrance again from its start and keep the animation's handle. With that,
both ticket repairs pass, and the broken pages still fail.

## Result

| page | model | rounds | oracle | what found the defect |
|---|---|---:|---|---|
| hint | default | 2 | PASS | `inspect motion --hover --leave`: `target-hidden … never seen … it is visibility: hidden`, a misleading rule; the cause from the CSS |
| hint | small | 2 | PASS | the same |
| ticket | default | 1 | PASS | nothing: `--expect-direction right` held; the y column of the frames line, then the CSS |
| ticket | small | 1 | PASS (after the oracle fix) | the same |
| nudge | default | 2 | PASS | `travels 0px` and every centre at `(640,73)`; `--expect-direction right` "not judged"; the cause from the CSS |
| nudge | small | 2 | PASS | the same |

All six repairs were right. No tool named any of the three causes, and on ticket and nudge no rule failed at
all. The two default agents repaired the bubble differently: one transitioned `visibility 200ms`, as the
reference does, and the other used `visibility 0s linear 200ms` with a `0s` delay on hover. The default nudge
agent animated `transform` instead of adding `position`. Four of the six agents also changed a `both` fill to
`backwards`, citing the skill line round 13 added.

## What they hit, and what is fixed

- **`target-hidden` on a bubble that had been shown.**

  > "the rule name and text are misleading: the bubble was visible during the hover, and the leave frames start
  > at 250ms when it is already gone" (hint, small)

  **Fixed:** the targets are measured just before the last action. A target that was shown then, and is hidden
  from the first frame after it, is now `hidden-at-once` (fail), not "never seen": `shown before --leave
  (opacity 1.00), and hidden from the first frame after it, so no exit is seen — transparent: it is visibility:
  hidden: visibility changes at once (it is discrete) while the opacity transition runs underneath it — list it
  in the transition (transition: opacity 200ms, visibility 200ms)`.
- **"held" beside "never seen".**

  > "The failing run also printed 'held: --expect-duration 200ms' while saying the target was never seen."
  > (hint, default)

  **Fixed:** when no target was seen, every `--expect-*` is `not judged: … — the target was not seen in any
  frame`.
- **`--expect-direction right` passed a path 20° off.**

  > "'travels 200px rightwards … no fail'. Its 200 is the straight-line chord … The 68px upward drift appears
  > nowhere in the text output." (ticket, small)

  **Fixed:** the target's line now gives the part of the path across its way: `travels 200px rightwards (and
  68px upwards)`. `--expect-direction` now also fails a path more than 10° off its axis. When the target turns
  too, the fail names the transform order: `FAIL direction-mismatch … it moves rightwards, and 68px upwards on
  the way (… 20° off horizontal) … a transform list applies right to left: a rotate() written before the
  translate() turns the translation with it — put the translate first`.
- **A direction expected and no motion was "not judged".**

  > "An expectation the brief states plainly ('slides in from the left') came out as 'not judged' rather than a
  > fail, when the target moved 0px." (nudge, default)

  **Fixed:** a target that is seen and expected to go a way, but does not move, now fails `direction-mismatch:
  it does not move (travels 0px), so it does not go rightwards`. The message adds the cause when one is
  measured. Round 13's broken cards now fail here too, and their message names the fill that holds their
  transform.
- **An offset on a static box was named nowhere.**

  > "No output said '`left` has no effect: the element has no position'" (nudge, default)

  **Fixed:** `inspect motion` measures an own animation that moves `top` / `left` / `right` / `bottom` / `inset`
  on a `position: static` box. Without `--expect-direction` it is `warn inert-offset`. In a `direction-mismatch`
  or `target-static` it is the cause: ``…`nudge-in` animates left, but the element is position: static, where
  that offset does nothing — give it position: relative, or animate transform: translate()``. `check
  animation` gets the same as `inert-offset-animation` (suspect, now 230 rules). It had read the notice as
  "visible" because the fade moves pixels. On 43 other animated pages of the repo, neither this rule nor round
  13's `unregistered-property-transition` fires.
- **The skill.** The dynamic-markup skill now says that `--expect-direction` fails a path more than 10° off its
  axis, and a target that is expected to move and does not.

## Deferred

- After `--hover .help --leave` without `--exits`, the repaired bubble fails `absent-at-rest`. The message
  points to `--exits`, but a hover-only element that leaves when the pointer does is the usual case.
- `--leave` is measured only from its own start, and the hover before it is unsampled. The output says so, but
  the fade-in and the fade-out cannot be judged in one run.
- On the nudge, `diff html` labelled a 0.2% anti-aliasing difference `[shift +221px → 26.3%]` with "0
  explanation(s)". The "shift" came from the computed-style change (`position: relative`), not from the pixels.
- `inspect motion` gives the easing twice in one line, for the path and for the opacity. Read as one sentence,
  it repeats itself.
- The first measured target is the trigger (`.help`) as often as the thing that moves: "travels 0px, no fail".
  Nothing says the target did not change at all while something else on the page did.
- `vlmkit --version` prints `linux-x64 node-v22.22.0`, where the skill's example line has `darwin-arm64
  node-v24.14.1`. Two agents remarked on it.
