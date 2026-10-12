# check flash v1 — WCAG 2.3.1 measured over a page's own time

2026-10-12. `vlmkit check flash` is the first gate that judges a frame sequence: every 60fps frame of
2-10s of page time, shot on the held clock, counted per pixel, and re-counted with motion compensated
where that fails. This round is what it measures, the known answers it was built against, what the
critiques of the design changed, and what it costs.

## Why

WCAG 2.3.1 Three Flashes or Below Threshold is Level A, and it applies whatever motion preference the
user has set: a `prefers-reduced-motion` opt-out does not satisfy it. No DOM checker looks for it — the
a11y testbed's 2.3.1 page says axe and QualWeb detected nothing — and vlmkit did not either: a
full-viewport 10 Hz strobe got only `infinite-animation` (warn) from `check animation`. A model cannot
count it: at Gemini's default 1fps sampling a 4 Hz strobe aliases to 0 transitions.

## What is measured

At each CSS pixel (device pixels averaged in linear light), on frames n at `n * 1000 / 60` ms:

| | Rule | Source |
|---|---|---|
| general transition | relative luminance moves ≥ 0.1 between a peak and a valley (a zig-zag: a reversal is confirmed 0.1 back from the extreme), the darker state < 0.80 | WCAG 2.2, Note 2 |
| red transition | u′v′ moves > 0.2 to or from a saturated red: R/(R+G+B) ≥ 0.8 on linear channels, and (R − G − B) > 20/320 | Note 3; the floor is IRIS's |
| flashing pixel | more than 6 transitions in a window (t − 1s, t] | "more than three flashes" |
| failure | the flashing pixels, closed 3x3, exceed 21,824 CSS px² inside some 341x256 field, slid over every position | G176; the Understanding text's 87,296 is the whole field |

Linearisation is color.ts's: 0.03928 and 0.04045 pick the same branch for every 8-bit value (tested).
Black takes the D65 white point. WCAG's 0.1° exception for fine balanced patterns is not applied, so a
2px inverting checkerboard is reported; the output says so.

## Known answers

Synthetic (`packages/vlmkit-judge/src/flash.test.ts`, 400x300 frames at 60fps, no browser):

| Sequence | Answer |
|---|---|
| full-field black/white at 2.5 / 3 / 3.5 / 4 / 10 Hz | pass 5 / pass 6 / fail 7 / fail 8 / fail 16+ transitions; 87,296 CSS px² |
| 144x148 / 146x146 off-grid / 148x148 / 148x148 off-grid box at 4 Hz | 21,312 pass / 21,316 pass / 21,904 fail / 21,904 fail |
| grey `#aaa`↔`#bababa` (ΔL 0.089) / `#aaa`↔`#bdbdbd` (0.107) | pass / fail |
| `#ededed`↔`#fff` at 10 Hz (darker 0.847) | pass, 0 transitions |
| red `#f00`↔`#7f7f7f` / red↔black | general pass, red fail / both fail |
| `#000`↔`#010000`, `#000`↔`#020000`, `#010000`↔`#000100`, `#050000`↔`#050505` | pass: below the red floor |
| 1px dither turning white over 200x200 | 39,998 (the region, minus the two corners its pattern leaves open), fail |
| 2px inverting checkerboard | 87,296, fail (no 0.1° exception) |
| four quadrants lit in turn, once a second each | pass, 2 transitions |

On the page (`fixtures/flash/`, `expected.json`, 400x300, a 1.5s window; `flash-check.test.ts`):
`strobe-4hz`, `box-148`, `raf-5hz` (a rAF loop), `interval` (a 125ms `setInterval`), `scale-strobe`
(`transform: scale(1)↔scale(0)`) and `ticker-strobe` fail general; `red-grey` fails red only;
`strobe-3hz`, `box-144`, `testbed-div` (the testbed's 250x250 red/white every 250ms: 4 changes, 2
flashes, a second) and `quadrants` pass; `scroll-text` is motion flicker; `still` is one frame;
`video` and `animated-gif` are not judgeable. The saved frames of `strobe-4hz` judged again give the
live answer; every other frame of them still fails; one frame in twelve is not judgeable.

## Motion, told apart

Per-pixel counting is literal: every moving high-contrast detail flickers at each pixel it crosses.
Measured at 1280x720:

| Page | Per pixel | Re-counted |
|---|---|---|
| scrolling text, 300px/s | fail 55,716 | motion: 1,706 left, every step explained |
| carousel slide (1024px in 300ms, eased) | fail 80,453 | motion: 5,910 left, 91% explained |
| solitaire deal (cards flying, turning, fading in from 0.2) | fail 31,862 | motion: 10,825 left; `div#tableau>div.slot>div.card (deal-in) animating opacity, transform` |
| `scale(1)↔scale(0)` steps at 5 Hz | fail 87,296 | flash (field mean) |
| 300x300 box teleporting 560px at 5 Hz | fail 76,800 | flash |
| background toggled every 125ms on a box translating 4px/s | fail 87,296 | flash |
| full-screen strobe at 4 / 5 / 10 Hz behind a ticker at 300px/s | fail 87,296 | flash (field mean) |
| 40px stripes inverting at 10 Hz | fail 87,296 | flash (residual) |

Synthetic cases hold the rest: 2.5px/frame antialiased text (motion), a textured panel teleporting
40px (flash: it returns), stripes scrolling half their period a frame (flash), a strobe beside
scrolling text (flash), and a light strobe (ΔL 0.106, darker 0.70) behind 60%-ink scrolling text
(flash, by the region test — see below).

What the critiques of the design changed, each measured:

- **DOM attribution decides nothing.** The design excused a candidate when every animation over it
  animated only `transform`. The three transform-only strobes above are real flashes, so animations
  are only named; block matching on pixels decides.
- **The field's mean is a test of its own.** A 1-D shift estimate is mean-subtracted, so a uniform
  strobe cancelled out of it and a ticker over a full-screen strobe read as motion.
- **A third test: region transitions.** With 60% ink, text crosses each background pixel between the
  strobe's steps and restarts it, and the falling step (0.807 → 0.701) lies between ink and background,
  which the 3x3 envelope accepts as a blend: the light strobe read as motion. Each frame now collects,
  by direction, the transitions motion does not account for — unexplained ones, and every stepping
  pixel of a block that moved AND shifted level — and seven alternating ones over the limit in a
  second fail.
- **Sub-pixel motion blurs one way.** At 2.5px a frame every other frame is blurred; interpolating a
  blurred frame never gives the sharp one, and only 50% of steps were explained. Blocks are matched in
  gamma-encoded luminance, to a quarter pixel, in both directions: 93%.
- **A run, not a window.** Re-counting only the first failing window excused the textured teleport:
  its first jump is a real one-off move, and 6 transitions are left. Each run of failing windows is
  re-counted for up to 2s of window ends.
- **The match limit is 0.04, not 0.03,** because a card fading in as it flies changes ~0.025 a frame on
  top of its rotation: the deal's residual was 16,807 of the 21,824 limit at 0.03, a margin a newer
  Chromium could erase; 10,825 at 0.04, 8,458 at 0.05. Every strobe above still fails at 0.04.

## The repository's own pages

The 21 pages the design's corpus named (six dogfood-animation pages, solitaire, the landing page, the
six sites, seven integrity-timeline fixtures), 1280x720, default window:

| Pages | Window | Result |
|---|---|---|
| dogfood-animation: page, agents a / c / e / g, agent-b's probe | 2-3.7s from their animations | pass; at most 75 CSS px² flashing |
| solitaire | 2s | **motion flicker** (warn): 31,862 per pixel, 10,825 left after compensation, the deal named |
| landing page; kanban, shop, docs, magazine, checkout | — | **still**: nothing can move under the held clock at load (their motion is behind interaction), one frame each, 1.3-1.5s |
| dashboard | 3s (its script) | pass, nothing flashing |
| integrity-timeline: at-rest, background-late, clean, fade-in, held, transient | 2s | pass; at most 3,028 (at-rest) |
| integrity-timeline: script | 3s | pass; 783 |

20 pass with nothing over the limit, the deal is the one motion flicker, and nothing is a flash: the
false-positive bound the design asked for, with the deal resolved the way its critique required (by
pixels, not by its animation's properties). 6 of the 21 pages are one frame. The 15 that moved took
14-36s each.

## What the held clock cannot hold

A `<video>` is paused at load; an animated image (GIF with a second image, APNG with `acTL` before
`IDAT`, WebP with the VP8X animation flag, AVIF with the `avis` brand) runs on the browser's clock; and
three probe shots 150ms apart in real time catch what else moves with the clock held. Their pixels are
painted out of every frame, written into the manifest (`source.unmeasured`) so a re-judge masks the
same, and when they cover more than the limit in one field the verdict is `not-judgeable` with
`flash-unmeasured` as a suspect — never a pass. The probe is real time, so an animated image's
`uncontrolled` row can come and go between runs; the `animated-image` row cannot.

## Cost

| | |
|---|---|
| capture, 1280x720 | ~40ms a shot with `optimizeForSpeed` (93ms through `page.screenshot`); unchanged frames are shot twice |
| decode | ~17ms (pngjs's was 19 of 24s for 181 frames) |
| 3s window, nothing failing | 20-26s |
| 3s window, a full-field strobe | ~25s; the field test decides it in 0.05s |
| 2s window, the solitaire deal | ~36s, 11s of it the motion re-count |
| 4s window, full-screen scrolling text | ~65s, 22s re-count |
| 1.5s window at 400x300 (the fixtures) | 4-8s |

That makes it one of the expensive gates. `--window` and `--viewport` are the levers; a page where
nothing can move under the held clock is one frame (1-1.5s).

## Limits

- A pass is "no flash measured under these criteria", not a certification.
- A flash that moves between places inside one field (two spots lit alternately) passes per pixel; the
  region test catches it only where it is part of a failing run.
- States behind interaction are not reached; a page's own video is not judged; absolute luminance
  (HDR) is not measured.
- A saved sequence's pass is only as good as its sampling: `flash-undersampled` when it is not every
  60fps frame, `flash-unjudgeable` when no second holds 7 frames. Sampling only removes transitions,
  so a failure on it stands.
