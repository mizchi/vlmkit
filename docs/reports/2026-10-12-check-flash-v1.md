# check flash v1 — WCAG 2.3.1 measured over a page's own time

2026-10-12. `vlmkit check flash` is the first gate that judges a frame sequence: every 60fps frame of
2-10s of page time, shot on the held clock, counted per pixel, and re-counted with motion compensated
where that fails. This round is what it measures, the known answers it was built against, what two
adversarial reviews found (50 findings in the first version, every one confirmed; 17 more in what
fixed them, of 19 raised) and what changed for each, and what it costs.

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

A red move with no saturated end leaves its starting point pending, and a later saturated frame that is
more than 0.2 from it counts the transition. Without that, a red pulse fading in from black lost every
transition into the red, because its first frame is a dark red that is not yet saturated, and the anchor
moved onto it (review blocker).

## Known answers

Synthetic (`packages/vlmkit-judge/src/flash.test.ts`, 400x300 frames at 60fps, no browser):

| Sequence | Answer |
|---|---|
| full-field black/white at 2.5 / 3 / 3.5 / 4 / 10 Hz | pass 5 / pass 6 / fail 7 / fail 8 / fail 16+ transitions; 87,296 CSS px² |
| 144x148 / 146x146 off-grid / 148x148 / 148x148 off-grid box at 4 Hz | 21,312 pass / 21,316 pass / 21,904 fail / 21,904 fail |
| grey `#aaa`↔`#bababa` (ΔL 0.089) / `#aaa`↔`#bdbdbd` (0.107) | pass / fail |
| `#ededed`↔`#fff` at 10 Hz (darker 0.847) | pass, 0 transitions |
| red `#f00`↔`#7f7f7f` / red↔black | general pass, red fail / both fail |
| a red pulse fading black → `#350000` → … → `#a00000` and back | red fail (the pending start) |
| `#000`↔`#010000`, `#000`↔`#020000`, `#010000`↔`#000100`, `#050000`↔`#050505` | pass: below the red floor |
| 1px dither turning white over 200x200 / over 147x147 | 39,998 / 21,609 (the region, closed), fail |
| two 20x20 blinkers at opposite edges of an 800px frame | 400, in a field that holds one of them (not an empty field between them) |
| 140x140 strobe beside a 150x150 unmeasured square | not passable: 42,100 together |
| 2px inverting checkerboard | 87,296, fail (no 0.1° exception) |
| four quadrants lit in turn, once a second each | pass, 2 transitions |

On the page (`fixtures/flash/`, `expected.json`, 400x300, a 1.5s window unless the page's own default
is the point; `flash-check.test.ts`), 38 pages:

| Pages | Answer |
|---|---|
| `strobe-4hz`, `box-148`, `raf-5hz` (a rAF loop), `interval` (a 125ms `setInterval`), `scale-strobe` (`transform: scale(1)↔scale(0)`), `ticker-strobe` (field), `teleport-drift` | general fail |
| `late-strobe` (begins 2.5s in), `timer-strobe` (a timer starts it 2.5s in) | general fail, on the window the page asks for |
| `iframe`, `shadow`, `smil`, `playback-rate` (2 Hz at rate 2), `revive` (a highlight replayed every 250ms) | general fail: each was a pass, or not judgeable, before the held clock held it |
| `waapi-chain` (a strobe begun when `await fade.finished` resolves), `reverse-rate` (a strobe at rate -1), `chain-anim` (begun on an `animationend` 2s in), `chain-timer` (a timer's timer), `iframe-late` (a delayed strobe inside an iframe) | general fail: each passed after the first review |
| `red-grey`, `faded-red` | red fail only |
| `strobe-3hz`, `box-144`, `testbed-div` (the testbed's 250x250 red/white every 250ms: 2 flashes a second), `quadrants`, `page-paused` (the page holds it) | pass |
| `scroll-text` | motion flicker |
| `navigate` (leaves for another page 500ms in) | pass, 1 navigation followed |
| `still` | one frame |
| `video`, `animated-gif`, `background-gif` (the GIF as a CSS background), `late-video` (added 1s in), `iframe-video`, `three-videos` (one style path for three), `video-beside-strobe` (each under the limit, over it together) | not judgeable |
| `blob-image`, `svg-percent` (a still image through a `blob:` URL; inline SVG with a raw `%`) | pass: both read as unreadable, so not judgeable, after the first review |

The saved frames of `strobe-4hz` judged again give the live answer; every other frame of them still
fails; one frame in twelve is not judgeable.

## Motion, told apart

Per-pixel counting is literal: every moving high-contrast detail flickers at each pixel it crosses.
So a failing run is re-counted — whole, from a second and a quarter before its first failing window
— and two tests decide; either one failing is a flash:

1. **The field's mean.** Each failing field's mean colour, from per-frame 16px block sums, judged as
   one pixel. Nothing that only moves changes a field's mean seven times a second.
2. **The tracked residual.** Each pixel's state — its zig-zag leg and its last transitions — is carried
   along its 16x16 block's motion and stepped only by what the moved previous frame does not
   reproduce (the range of the one to four pixels the motion brings it from). Where no motion is
   trusted, the state stays put and takes the whole step, and moves on with the content when its
   motion is trusted again.

Measured at 1280x720, default window, after every fix below:

| Page | Per pixel | Re-counted |
|---|---|---|
| scrolling text, 300px/s | fail 56,505 | motion: 26 left, 99% of changed steps explained, 300 px/s |
| carousel slide (1024px in 300ms, eased, resting) | fail 80,453 | motion: 1,606 left, 68% explained |
| solitaire deal (cards flying, turning, fading in from 0.2) | fail 31,862 | motion: 15,825 left, 9% explained — the translucent cards are two layers no translation matches, and what is left stays where it was stepped |
| `scale(1)↔scale(0)` steps at 5 Hz | fail 87,296 | flash |
| 300x300 box teleporting 560px at 5 Hz | fail 76,800 | flash |
| background toggled every 125ms on a box translating 4px/s | fail 87,296 | flash |
| full-screen strobe at 4 / 5 / 10 Hz behind a ticker at 300px/s | fail 87,296 | flash (at 4 Hz: the field's mean, 8 transitions in a second) |
| 40px stripes inverting at 10 Hz | fail 87,296 | flash (residual: 87,296, no step explained) |

Synthetic cases (400x300) hold the rest: text scrolling 5px and 2.5px a frame (antialiased) and an
eased carousel are motion; a textured teleport, stripes moved by half their period, a strobe beside
scrolling text, a light strobe (ΔL 0.106) and a smooth 4 Hz pulse behind 60%-ink scrolling text, a
40px teleport while drifting, a 20px shake (back and forth, or around a square), 8px stripes inverting,
a texture that inverts as it moves 6px a frame, the light strobe and the smooth pulse behind text moving
2.5 or 1.5px a frame, text that steps 4px four times a second over a 6 Hz strobe, and a stationary
strobe box under scrolling text are all flashes.

What may establish motion is narrow, because every excuse is a way to pass a strobe. A block's
displacement must reproduce it (texture, mean residual ≤ 0.04 in encoded luminance and under half of
not moving, on the part of the block whose source is in the frame), and is refused when a level change
in place explains it as well, when the opposite displacement matches too (no direction), when it
jumps more than 24px beyond how the content was moving, and when the block reverses (turns a quarter
turn or more) more than six times within a second. DOM attribution decides nothing: the three transform-only strobes above are
real flashes, so animations are only named.

### What the review changed, each measured

The first version's re-count was a 3x3 envelope test per window, a return test, and a "region" test.
The review found ten holes in it, all confirmed; the tracker replaced all three tests.

- **Small steps never added up.** An explained step reset the pixel, so a smooth pulse behind moving
  text passed. Carried state adds them: the 4 Hz sine behind scrolling text now fails.
- **Only 2s of a run, and four runs, were re-counted.** A strobe that began later in a run of motion
  flicker was excused. Whole runs now, merged where they meet, up to 1200 frames; past that a run is a
  flash (`budget`), never excused.
- **The return test was the only guard, and drift defeated it.** A teleport that also drifts never
  returns to the same pixels. The gates above replaced it: a 40px teleport while drifting, a 20px
  shake, and counterphase stripes all fail; a texture that inverts while it moves 6px a frame fails.
- **The frame's edge leaked.** A block whose source is partly outside the frame never matched, took the
  whole step, and the tracker carried those transitions across the frame: 61,757 px² left on a pure
  scroll. Blocks are now matched on the part of them whose source is in the frame (at least half): 0.
- **A carousel's entering band.** Content arriving faster than a block's width has no source in the
  frame, and its neighbours failed the jump test because the block it came from had no motion. The jump
  is now also judged against this block's own last motion, and content replaced under motion — what
  was at a pixel moved on by trusted motion, and what is there now moves on by the next frame's — starts
  a history of its own.
- **A stock is not its cards.** Steps a state takes in place belong to the place: the solitaire stock
  sees card after card appear on it, and each card that left carried the stock's transitions along its
  flight — 23,341 px², a flash. A state that motion takes on keeps only the last step it took in place:
  13,187. (A separate location layer for untrusted steps was tried and lost the drifting teleport: at a
  fixed place its returns no longer line up. The second review's place ring keeps the trimmed steps at
  the stock, measured as an area of its own: 15,825.)
- **A sum stopped at the best ties.** The coarse search left its sum at 0 once an exact match was found,
  so every later offset tied and the shortest, (0, 0), won: a carousel frame moving 64px was unmatched.
- **The reversal gate came too late.** Applied as it went, a shake was untrusted only after seven
  excused reversals, and the window ended before seven raw steps more. It is decided over the span now,
  from the jump before a cluster's first reversal; the re-count runs again only when it untrusts
  anything.
- **The reported velocity** is the trusted blocks' median only when half of all blocks that moved agree
  with it (it read 4091 px/s for a 300px/s ticker).

Known to read as flash although the eye would track it (the safe direction): two layers moving
differently inside one block (text over a patterned background, parallax), rotation of detailed
content, fine detail moving off the quarter- and third-pixel grid. Known to read as motion: a grating
moving less than half its period a frame, however fast (moving-pattern hazards are ISO 9241-391's).
And entering content has no history, so a strobe behind content that crosses the view in under about
1.75s is counted only on what has been in view a second; the synthetic light strobe scrolls 2px a
frame through 400px for that reason.

## What the held clock cannot hold, and what it now does

The review's sweep findings were about what the held clock missed. Each now holds, with a fixture:

| Was | Now |
|---|---|
| an iframe frozen at virtual 0 (a flashing iframe passed, complete, nothing unmeasured) | every frame of the page advanced and seeked |
| CSS animations in shadow roots not held (a web-component strobe: not judgeable) | open shadow roots swept and listened to |
| SMIL on its own timeline (a 5 Hz `<animate>` passed as still) | each SVG paused and put at the page time |
| seeks at rate 1 (a 2 Hz animation at rate 2 passed) | `(t − start) · playbackRate` |
| an animation the page paused moved by the seek | the page's, left alone |
| a seek revived a cancelled animation (a replayed highlight never replayed: pass) | cancelled, never seeked again |
| a `setTimeout(f, 0)` loop spun the clock's guard every frame | nested timers clamped to 4ms, as Chromium does |
| a navigation crashed the gate | followed onto the new document, up to five |
| one period of a delayed infinite strobe swept | one period past its start and a second more; two seconds past the latest pending timer; truncation at 10s reported |
| the one-frame `still` shortcut taken with `--window`, or with `vlmkit:seek` listeners | never then, nor with iframes or timers |
| animated images only as `<img>` with page-fetchable bytes | every CSS image property, both pseudo-elements, SVG `<image>`, shadow roots; cross-origin bytes through the context's request; unreadable bytes are unmeasured, a missing image is not |
| APNG / WebP trusted from the header | frames counted |
| media found once, before the sweep | searched for again every 30 frames and at the end |
| three probe shots 150ms apart (aliased with a 6.7 Hz strobe) | seven gaps with no common period over a second |
| every changed frame taken in one shot (real-time motion counted as page time: a false fail) | every 10th shot again 50ms later |
| two small unheld regions merged into one viewport-wide mask | merged only where they touch |
| unmeasured and measured flashing never added | judged together (`withUnknown`): no pass when together they exceed the limit |

Their pixels are left out of the count, written into the manifest (`source.unmeasured`, with the
sweep's own decisions in `source.sweep`) so a re-judge masks the same, and when they cover more than
the limit in one field — alone or with what flashes beside them — the verdict is `not-judgeable` with
`flash-unmeasured` as a suspect, never a pass.

## The second review

The fixes above were reviewed again the same way: four reviewers by area, each finding handed to a
skeptic told to refute it. 19 were raised; 2 were refuted (one documented behaviour, one too minor),
and 17 reproduced on the branch.

| Found | Changed |
|---|---|
| between pixels the residual was the range of the 2-4 source pixels: beside ink a strobe's step toward the darker level fell inside it, and the light strobe behind text moving 2.5 or 1.5px a frame (and the smooth pulse at 2.5) was motion | a step is checked against the forward and backward predictions the matcher uses, within 0.01; a state keeps where in its pixel its content is (`Math.round(2.5)` slid every state half a pixel a frame along what it counted). All three are flashes now; a pure blended 2.5px scroll still leaves nothing |
| dwell trimming dropped the in-place steps it trimmed: a 6 Hz strobe behind text that steps 4px four times a second left 0 | a screen-fixed place ring holds them, and level steps taken under travelling content: flash. Content and places are two areas; as one, the deal came within 3,688 px² of the limit |
| a stationary strobe box that scrolling text crosses was carried out of the box on the text | the place ring holds the box's steps: flash (with text sparse enough to see it; dense text hiding each pixel more than one step in eight is a limit, below) |
| a reversal needed a turn past 90°: a 20px shake around a square path was motion | a quarter turn or more counts: flash |
| a `<video>` inside an iframe was paused and never reported | media found in every frame, in the page's coordinates |
| three sibling videos shared one style path and were one region | told apart by element |
| unmeasured pixels under the limit alone but over it with the flashing beside them were not judgeable, and exited 0 | a suspect, as alone |
| the window was fixed at load: a strobe an `animationend` or a later timer started was never reached | reconsidered at its end with what the page began |
| an iframe's animations and timers did not count for the window | every frame's do |
| a held animation never finished, so `await anim.finished` / `onfinish` chains never ran | ended natively at its end; what the page begins from it starts at that end |
| an iframe inserted after 0 ran its first second in one step | each frame on its own offset |
| an animation real time had finished during load was frozen at its end | real time spent loading is page time 0 |
| a negative playback rate was frozen by the hold's own pause | placed from an anchor, any rate but 0 |
| every `blob:` image was unreadable; a raw `%` in a `data:` URL threw | read through the frame, and as the URL standard reads them |

## The repository's own pages

The 21 pages the design's corpus named (six dogfood-animation pages, solitaire, the landing page, the
six sites, seven integrity-timeline fixtures), 1280x720, default window, after both reviews' fixes:

| Pages | Window | Result |
|---|---|---|
| dogfood-animation: page, agents a / c / e / g, agent-b's probe | 2-3.7s from their animations | pass; at most 85 CSS px² flashing |
| solitaire | 2s | **motion flicker** (warn): 31,862 per pixel, 15,825 left after compensation (13,187 after the first review, before the place ring); the deal's cards named, none covering half the flashing box, so no selector |
| landing page; kanban, shop, docs, magazine, checkout | — | **still**: nothing can move under the held clock at load (their motion is behind interaction), one frame each, 2.6-3.3s |
| dashboard | 3s (its script) | pass, nothing flashing |
| integrity-timeline: at-rest, background-late, clean, fade-in, held, transient | 2s | pass; at most 3,051 (at-rest) |
| integrity-timeline: script | 3s | pass; 1,130 |

20 pass with nothing over the limit, the deal is the one motion flicker, and nothing is a flash — the
same verdicts as before either review, which is the point of re-running it: every hole the reviews
closed was closed without a false positive on the repository's own pages. 6 of the 21 are one frame.
The 15 that moved took 16-52s each.

## Cost

| | |
|---|---|
| capture, 1280x720 | ~40ms a shot with `optimizeForSpeed`; an unchanged frame is shot twice, and every 10th changed frame again 50ms later |
| the real-time probe | ~1s on every page |
| a still page | 2.6-3.3s |
| 2-3s window, nothing failing | 16-28s |
| 3s window, a full-field strobe | ~28s; the field test decides in under 0.1s |
| 2s window, the solitaire deal | ~43s, 16s of it the re-count |
| 3s window, the carousel | ~63s, 32s re-count |
| 5s window, full-screen scrolling text | ~95s, 40s re-count |
| the 28 fixtures at 400x300, 1.5s | 5-7s each |

The re-count costs more than the first version's did (the scroll: 22s over a 4s window then, 40s over
5s now; the deal: 11s then, 16s now). Most of what it costs is decoding each frame
a second time (a frame's luminance is 7MB at 1280x720, so the frames of a sweep are not kept) and the
per-pixel state it carries; blocks moving alike are copied as one run per row, which took the copying
from 16s to 3s on the scroll. `--window` and `--viewport` are the levers.

## Limits

- A pass is "no flash measured under these criteria", not a certification.
- A strobe behind content dense enough to hide each pixel at more than about one strobe step in
  eight flashes there fewer times than the strobe does, and can read as motion (text at one mark per
  240 px² over a 4 Hz box left 16,522 of its 32,000 px²). A shake that turns by less than a quarter
  turn a frame, as a smooth orbit does, reads as motion.
- A flash that moves between places inside one field (two spots lit alternately) passes per pixel.
- A red pulse that never reaches black (dark red ↔ red) changes no chromaticity, and is not a red flash
  under WCAG 2.2's working definition; under IRIS's (R − G − B) delta it would be.
- States behind interaction are not reached; a page's own video is not judged; absolute luminance
  (HDR) is not measured; closed shadow roots are not held; a `vlmkit:seek` listener added other than on
  `window` is not counted.
- A saved sequence's pass is only as good as its sampling: `flash-undersampled` when it is not every
  60fps frame or was cut at the cap, `flash-unjudgeable` when no second holds 7 frames. Sampling only
  removes transitions, so a failure on it stands.
