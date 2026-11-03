# motion-repair v17: a keyframe that steps, a bar that is a span, a media query nobody matches (2026-11-03)

## Question

Round 17 planted three defects, none of them in the classes of rounds 1-16 or the held-out set:

| page | planted defect | the brief's words |
|---|---|---|
| stepper | the shared `@keyframes panel-in` has `from { … animation-timing-function: steps(5, end) }`: the keyframe's timing function overrides the element's `ease-out`, and the panel hops in five | "glides in … in one smooth movement that slows as it arrives" |
| meter | the bar is an empty `<span>` (inline) animating `width`: width does not apply to an inline box, so the bar is 0x0 throughout | "the blue bar … fills from the left to 72% of the track" |
| guard | the entrance sits inside `@media (prefers-reduce-motion: no-preference)`: an unknown feature, so the query is false for everyone | "People who have asked … for reduced motion see it already in place" (and everyone else sees it rise) |

Six fresh agents took part, three on the default model and three on a smaller one, with the same setup as
before. The oracle now emulates `prefers-reduced-motion: no-preference` explicitly, and it checks guard
under `reduce` too.

No hole made a reference page fail before the agents ran. On the broken pages, as given:

- **stepper:** `inspect motion` reported four `jump`s, an end jump and `easing-mismatch`, and blamed "a gap
  between keyframes, or a property changed with no transition".
- **meter:** `target-static` (warn) with "fully shown" and the wrong causes. `check animation`'s
  `no-visible-effect` fired without saying why.
- **guard:** `inspect motion` exited with "no animation or transition on the page", and listed causes that
  did not include a media query. `check animation` read `animations: 0 … No animation issues detected`.

## Result

| page | model | rounds | oracle | what found the defect |
|---|---|---:|---|---|
| stepper | default | 1 | PASS | `inspect motion`'s `jump`s and its frame line (pairs of equal centres); the cause from the CSS |
| stepper | small | 1 | PASS | the same |
| meter | default | 1 | PASS | `check animation`'s `no-visible-effect`, and `width: 0` in `motion-report.json`; the cause from the CSS |
| meter | small | 1 | PASS | `no-visible-effect`, and the frames; the cause from the CSS |
| guard | default | 1 | PASS | `inspect motion`'s "it never starts"; the typo from the CSS |
| guard | small | 3 | PASS | the same |

All six repairs were right. Two of them differ from the reference:

- **stepper, small:** it gave the panel its own keyframes and left the shared ones alone, as the brief's
  mention of other panels invited.
- **guard, small:** it moved the animation to the base rule and took it away under `reduce`. That also
  passes, because `check motion` asked for a `reduce` rule.

## What they hit, and what is fixed

- **No tool named `steps()` inside a keyframe.**

  > "No rule says that a `steps()` timing function on a keyframe overrides the element's easing … the jump
  > message's suggested causes … point the wrong way." (stepper, default)

  **Fixed:** `inspect motion` reads each keyframe's own timing function. A stepped one that overrides a smooth
  element easing becomes the cause in `jump` (the end jump included) and in `easing-mismatch`. When no fail
  quotes it, it is `keyframe-easing` (warn): `` `panel-in`'s from keyframe sets animation-timing-function:
  steps(5), which overrides the element's own ease-out from that keyframe to the next: it moves in jumps ``.

  `check animation` gains `stepped-keyframe` (warn). Only a stepped override is named, because per-keyframe
  curves are how a bounce is written.
- **A 0x0 box read as fully seen.**

  > "The frames line shows `0ms 1.00 (384,118)` for every frame, i.e. 100% seen, while the measured box is
  > 0x0." (meter, default)

  Every grid point of a zero-area box is one point, an ancestor's, and that counted as "outside its shape".
  **Fixed:** a box with no area is not seen. The cause is named: `it has no area (0x0): it is a <span> laid
  out inline (display: inline), where width and height do not apply, so animating width grows nothing —
  give it display: block`. `check animation` gains `inert-size-animation` (suspect) for the same case.
- **A bar's centre read as a slide.**

  > "`travels 184px rightwards`. That is the centre's travel, half the 369px growth. The line never says
  > 'centre'." (meter, small)

  **Fixed:** when one edge stays put while the box grows, the line says `(its centre: its box grows Npx from
  its left edge, which stays put)`. `check animation`'s motion region now includes the animation's first
  keyframe against rest. It had begun at the 25% frame, so it started 132px to the right of the bar's left
  edge.
- **Nothing read the misspelt media feature.**

  > "nothing parses media features. An unknown feature like `prefers-reduce-motion` is easy to detect and
  > caused this whole defect." (guard, default)

  Chromium keeps an unknown feature's text and evaluates it as false, so the test is behavioural: a known
  feature and value matches exactly one of `(f)` and `not (f)`, and an unknown one matches neither. **Fixed:**
  - `inspect motion`'s "no animation" error names the query, with `did you mean \`prefers-reduced-motion\``.
  - `check animation`'s new `unknown-media-feature` (suspect) does the same.
  - `check motion`'s latent message adds "or an @media that does not match".
- **A correct `no-preference` page failed `check motion` and `stress media`.**

  > "`check motion` still fails with 'x missing-reduced-motion' … Neither recognises the `no-preference`
  > opt-in pattern." (guard, default)

  **Fixed:** motion given only under `prefers-reduced-motion: no-preference` honours the preference in both.

`check animation` now has 237 rules. On the 69 other correct animated pages of the repo, none of
`stepped-keyframe`, `inert-size-animation`, `unknown-media-feature` or `held-paused-animation` fires. Those
pages are the reference pages, the intact motion-defects pages, the correct held-out pages and the example
sites.

## Two remarks, answered in the output

- **The `diff png` label.** One small agent called the `render-noise` label misleading. With a `both` fill,
  guard's 500ms frame differs from its rest frame by 290 edge pixels. The two frames are the element on a
  compositor layer and off one, so the label was right, but it did not say why. The description now names
  the case: `an element on its own compositor layer in one capture and not the other — a finished animation
  whose fill holds a transform keeps its layer, and animation-fill-mode: backwards drops it at rest`.
- **The run ledger.** Two agents noted that `.vlmkit/run-ledger.jsonl` appeared, and both quoted the
  announcement that says so. The router skill (`skills/vlmkit/SKILL.md`) now has a "Files it writes"
  section: the ledger, `--ledger` and `--no-ledger`, and where frames and reports go. It also gives the
  status line for a lone `reduced-motion-ignored`.
