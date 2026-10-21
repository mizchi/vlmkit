# motion-repair v7: which way, a transition that never runs, and a click (2026-10-21)

## Question

Round 7 added three new kinds of defect:

- motion that goes the wrong way;
- a script-started transition that never runs, because its property is misspelt;
- a click-triggered transition to `height: auto`, which a browser does not animate.

The briefs avoid the flags' wording, as in rounds 5 and 6. Six fresh agents took part, three on
the default model and three on a smaller one, and they were told to use only the shell and file
tools.

| page | planted defect |
|---|---|
| slidein | a right-docked panel that must enter from beyond the right edge starts at `translateX(-100%)`, so it comes from mid-page |
| progress | a script marks the page loaded at 100ms, and the bar's `transition: widht 600ms` never runs, so it jumps to 70% |
| accordion | a click toggles `height: 0` → `height: auto` with `transition: height 250ms`, so it snaps open |

Building the round turned up two holes, both fixed before the agents ran:

- `inspect motion` found no animation on the reference progress page, because its transition is
  started by a timer. It now runs the held clock to each due timer and reopens the page.
- `inspect interact` died in a `TypeError` on a sequence written as a bare array of steps. It now
  accepts the array and names the schema for anything else.

## Result

| page | model | rounds | oracle | what found the defect |
|---|---|---:|---|---|
| slidein | default | 1 | PASS | the centre column of the `frames` row, rising `(798,400)` → `(1100,400)`, then the agent's own look |
| slidein | small | 1 | PASS | its own look at the 314ms frame |
| progress | default | 1 | PASS | `inspect motion`'s "a misspelt transition-property … are the usual causes", and `check motion`'s `transition=widht 0.6s` |
| progress | small | 1 | PASS | the same hint, plus `jump at 100ms` with `--start/--end` |
| accordion | default | 1 | PASS | the CSS. The tools gave indirect signs only: the storyboard's "No events", frame 0 already open in `inspect interact`, and Jev's `target-static` warn |
| accordion | small | 1 | PASS | the CSS |

All six repairs were right, each in one round. No rule fired on any of the three defects.

## What they hit, and what is fixed

- **No direction.**

  > "'travels 360px' gives no sign or direction, so the summary sentence reads the same for the
  > broken and the fixed page." (slidein)

  **Fixed:** every segment now says which way it goes (`travels 360px rightwards`).
  `--expect-direction left` fails the broken page with `direction-mismatch: it moves rightwards
  (centre 740,400 → 1100,400), not leftwards`.
- **"Share seen 1.00" for a box that is mostly off screen.** **Fixed:** the frames row adds
  `on-screen 0.16` whenever only part of the box is inside the viewport. The `~` mark is now used
  only for a model's boxes that were put back from the edge.
- **A transition that never runs.**

  > "`check animation` on the broken page reports `No animation issues detected.` and exits 0."
  > (progress)

  **Fixed:** a new rule, `unknown-transition-property` (suspect), says `div.bar transitions
  \`widht\`, which is no CSS property`. There are now 221 rules.
- **The start of a timer-started transition depended on the sampling.**

  > "With its default sampling, `inspect motion` gave a false fail on the fixed page: 'begins at
  > 120ms, not 100ms'." (progress)

  **Fixed:** the clock is now run to the first frame after the timer is due, which is when the
  page renders. The transition begins at 117ms and passes `--expect-start 100` within a frame.
- **Clicks were out of reach.**

  > "`inspect motion --selector` cannot click first, so it can't reach a transition that starts on
  > a click. I had to use the paid Jev route on frames.json." (accordion)

  **Fixed:** `--click <css>` clicks on the held page before any frame is shot, and the motion the
  click starts is sampled. On the reference page that motion reads `runs 250ms … follows ease-out
  exactly`. When nothing animates after the click but a `--selector` target changed, that is a
  fail: `snapped: .panel: 592x0 … → 592x116 … in one frame`. The message names `height: auto` and
  `interpolate-size`.
- **Wording.**
  - The no-animation error now names `height: auto`, `--click` and the right flags (`--end`, with
    `--start` or `--at`).
  - `jump` no longer blames "the keyframes" when a property simply changed with no transition.
  - `cli-reference` stops calling `inspect motion` advisory.
- **The crop.**
  - It now keeps the target's parent when the parent is at most six times the target's size, so a
    bar's crop includes its track.
  - It is offered for anything under three quarters of the frame.
- **Jev on a fading target.** A model's "not shown" on a frame that the page measures as mid-fade
  and on screen now counts as unknown. Before, a correct page failed `target-lost` at opacity 0.45.

## Deferred

- `check animation --virtual-time` labels a timer-started CSS transition "script-driven motion".
- The storyboard's change box missed white on #f7f7f8, which is under its floor of 8.
- `inspect interact`'s frames are on the wall clock, and the output does not say how far their
  times can be trusted.
- `interpolate-size` is Chromium-only. Both accordion agents said so, and neither could test
  another engine.

## The deferred items, fixed

- **A timer-started transition is named.** While `--virtual-time` advances the held clock, every
  CSS transition or animation that appears is recorded with its element and the instant it began.
  On the progress reference page, the clock line is now followed by `not a requestAnimationFrame
  loop: a timer started transition \`width\` on div.bar (begun at 250ms)`.
  `reduced-motion-ignored` names `div.bar (a transition a timer started at 250ms) \`width\``, and
  its remedy adds "`transition: none` on it in that rule reduces it too". A real rAF loop still
  reads `requestAnimationFrame / timers`. The broken page's misspelt `widht` starts no transition,
  so its motion keeps that label.
- **The storyboard's floor is an option.** `snapshot storyboard --floor N` (0-254, default 8). A
  panel going from white to #f7f7f8 moves each channel by 8: at the default it is no event, and
  with `--floor 2` it is a `change`. When a sequence has no events, SUMMARY.md now says that a
  change between near colours can sit under the floor, and that `--floor 2` sees it.
- **`inspect interact` says how far its frames can be trusted.** Each frames step reports the
  longest lag of a shot after its offset: "CSS motion is seeked, so exact; a timer's or a script's
  work runs on the real clock, and these frames were shot up to Nms after their offsets". The
  value is `maxLagMs` in the report's JSON.
- **`interpolate-size` is Chromium-only**, and the `snapped` message and the skill now say so. They
  name `grid-template-rows: 0fr → 1fr` as the form that runs in every engine.

`reduced-motion-ignored` is still a suspect: the project decides that.

