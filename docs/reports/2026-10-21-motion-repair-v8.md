# motion-repair v8: what a pointer or a scroll starts, and a placement the animation replaces (2026-10-21)

## Question

Round 8 added three new kinds of defect. Each is a common real-world bug, and each starts motion
somewhere other than at load, or breaks something other than the motion itself:

| page | planted defect | the brief's words |
|---|---|---|
| dialog | `@keyframes pop` sets `transform: scale(…)`, which replaces the dialog's own `translate(-50%, -50%)` for the whole 200ms run | "stays dead centre the whole time: only its size and its opacity change" |
| hover | `transition` declared only in `.card:hover`, so the lift animates and the drop back snaps | "when the pointer moves off, the card settles back down the same way" |
| reveal | `new IntersectionObserver(…, { threshold: 1 })`, so a 900px section on an 800px screen is never fully in view and never revealed | "every section … as it scrolls into view, fades up into place" |

Six fresh agents took part, three on the default model and three on a smaller one. The setup was
unchanged: they could not read the fixtures, the reports or the source, they had four rounds, and
the oracle (`fixtures/motion-repair/oracle.mjs`) was hidden from them. The oracle fails each broken
page and passes each reference fix.

## Result

| page | model | rounds | oracle | what found the defect |
|---|---|---:|---|---|
| dialog | default | 1 | PASS | `inspect motion --click .delete`: `FAIL jump at 517ms: jumps 223px when the motion ends`, then the centres in the frames row and the CSS |
| dialog | small | 1 | PASS | the same line and the frames row (`(840,498)` … `517ms (640,400)`) |
| hover | default | 1 | PASS | no tool: `inspect interact` hover → hover elsewhere → frames, then `diff png` of the first leave frame against rest (0.00%), then the CSS |
| hover | small | 1 | PASS | no tool: its own look at `inspect interact`'s leave frames, then the CSS |
| reveal | default | 1 | PASS | `inspect motion`'s `target-hidden … on-screen 0.20 … opacity 0.00`, then the script |
| reveal | small | 1 | PASS | the same, then a Playwright probe of its own |

All six repairs were right, each in one round. The dialog was caught by a rule whose message
named the wrong thing. The hover page was caught by nothing. The reveal page was caught at load
only, so the same `target-hidden` fired on the fixed page too.

`check animation` passed all three broken pages with `animations: 0` or `No animation issues
detected.`, because it evaluates motion from load only. One small-model agent added a
reduced-motion rule to the hover page that the brief did not ask for, after `check motion`'s
`missing-reduced-motion`.

## What they hit, and what is fixed

- **`inspect motion` could not hover or scroll.**

  > "`inspect motion` has `--click` but no `--hover` and no wait between clicks. On the held clock
  > the lift never runs before the second click. So on the fixed page it printed `FAIL
  > duration-mismatch … one run takes 27ms, not 150ms` … a false fail." (hover)

  > "After the fix, `inspect motion --selector .studio` says `FAIL target-hidden` because the studio
  > correctly stays hidden at load. That is a false fail with no way to say 'scroll first'."
  > (reveal)

  **Fixed:** `--hover <css>`, `--leave` and `--scroll <css|px>` are actions beside `--click`, and
  they run in the order given. Before each action after the first, the motion the previous one
  started runs to its end, and the motion the last one starts is what gets sampled.
  - On the broken hover page, `--hover '#c2' --leave` gives `FAIL snapped: #c2: … at (483,101) →
    … at (483,105) in one frame … a transition declared only in the :hover rule runs on the way in
    and not on the way out — declare it on the element itself`.
  - On the fixed hover page it gives `runs 150ms: travels 4px downwards …, follows ease-out exactly`.
  - On the reveal page, `--scroll .studio` keeps `target-hidden` on the broken page and passes the
    fixed one.
  - A scroll is not a change: `snapped` compares boxes in the page's coordinates. A reveal that
    began before the scroll, and is still running, is sampled rather than called a snap.
- **A dialog held off its place read as a jump at the end.**

  > "The rule is mislabelled. 'jumps … when the motion ends' is reported at the rest frame, but the
  > real defect is that every frame during the motion is off-centre." (dialog)

  **Fixed:** a target that holds still off its place for the whole motion now reads `sits 223px
  off where it rests (-200,-98) through the whole motion, and jumps there when it ends: the
  animation overrides what places the element — most often a keyframe transform that replaces the
  element's own (a translate(-50%, -50%) centring)`. `--expect-still` ("only its size and opacity
  change") fails `still-mismatch` at the frame whose centre is farthest from its place. With the same
  flags, the reference page passes.
- **Floors set for a model's boxes were applied to measured ones.**
  - "`warn target-static … moves under 6px … its animation is not applying`" fired on a correct
    4px lift. With `--selector`, an easing is now fitted from 2px, and a target counts as static
    only under 1px.
  - "`--expect-origin center` was never checked: … scale changes by less than 10%". A scale's
    fixed point is now solved from a 2% change, so a 96% → 100% dialog reads `the scale grows
    from its centre`. When the box moves as well as scales, the line says `no point of its box (it
    moves as well as it scales)` rather than "the point 1857% across".
  - "`travels 0px leftwards`": a target that does not move gets no direction.
- **`check animation` was silent on all three pages.** **Fixed in the message:** a clean result now
  says that only motion from load is evaluated, and names `inspect motion --click/--hover/--leave/--scroll`.
- **The skill** now maps "settles back when the pointer moves off" to `--hover … --leave`, "as it
  scrolls into view" to `--scroll`, and "stays dead centre" to `--expect-still`. It also says that
  `check animation` cannot see motion that waits for the user.

## Deferred

- `check integrity` reports a reveal page's below-the-fold sections as `invisible-text`, so a
  correct page cannot pass it. That is hiding by design, which the gate cannot tell apart from a
  defect without scrolling.
- `inspect interact`'s scroll transitions are all marked `✓` with no verdict. Its frames after a
  scroll were shot up to 3238ms late, so an IntersectionObserver fade had already landed by the 0ms
  frame.
- Near the bottom of a page, a scroll reveal's rise is absorbed by the scroll clamp: as the
  transform shrinks the page's overflow, the page scrolls with it. `.team` measured `travels 1px`.
  That is what the screen shows, so it is reported as is.
- The skill names Node v24; the sandbox runs v22. (Raised by one agent.)
