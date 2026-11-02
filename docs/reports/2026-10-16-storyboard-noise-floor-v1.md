# storyboard noise floor v1 — lossy recordings through a noise band

2026-10-16. `snapshot storyboard --lossy` compares frames decoded from a lossy codec through a
noise band instead of byte for byte. This round covers:

- how the band was chosen, on known answers;
- what two adversarial reviews and the bench found wrong with the first design, and what replaced it;
- what a second review of that redesign found, on 375 cases of its own, and what changed again;
- what a third and a fourth review found in keyframe re-reads, open GOPs and boxes, the fourth on
  432 open-GOP encodes;
- what a fifth review found in leading frames, one-spot tails and returns, on 1030 planted cases;
- what it does on real recordings with labels;
- what it still cannot see.

## Why

`scan video` (2026-10-13) made recordings readable, but the storyboard compared pixels exactly. A
codec does not give back the picture it was given: the same still screen decodes differently from
one frame to the next, most of all at sharp edges and across a keyframe. On the H.264 desktop
recordings of ServiceNow's VideoCUA, 9 of 562 consecutive frame pairs were byte-identical. So the
storyboard reported one change that began at frame 1 and never settled. The labelled-dataset survey
that came before this round found the same on every real recording it tried. So the second stage of
"scan video → storyboard → the agent reads the keyframes" could not be scored on real video at all.

```mermaid
flowchart TD
  F["decoded frame (lossy)"] --> M["3x3 means"]
  M --> A{"against the state's picture"}
  A -->|"no mean past 32"| IN["in the state<br/>(staying, a return, an earlier state)"]
  A -->|"a mean past 32"| EV["an event"]
  EV --> H{"a hold: 100 ms of means within 24<br/>of its first frame, the box's mean within 3"}
  H --> C["a change settles there"]
  K["where a GOP begins (decode order):<br/>8x8 means within 24, 16x16 within 12,<br/>no mean past 48, a quarter at most past 40"] --> R["the state's picture read again<br/>(reread)"]
  EV --> B["box: decoded pixels past 32 inside the means' box + 2 px,<br/>against the state's picture in the frame's GOP"]
```

## Known answers

`fixtures/storyboard/planted-ui.html` plants the kinds of `planted.html` on a page that looks like
an application, so a codec has something to ring around: text in three sizes, a photo-like seeded
texture, a gradient, a table. It also adds four kinds a screen recording shows:

- a 1px text-field caret blinking;
- a digit in 12px text changing (`Items 12` → `Items 13`);
- a pointer moving;
- an article scrolling 1px a frame.

Each was captured lossless on the held clock (61 frames, 640x400), and its lossless storyboard is
the answer. All eleven gave the planted events.

The 18 captures (11 on the UI page, 7 on the plain one) were encoded at 60fps with 14 encodings:

- x264 at crf 18, 23, 28, 35 and 45;
- x264 crf 28 with a keyframe every 10 frames;
- x264 crf 23 at 4:4:4;
- x265 crf 28;
- VP8 as Playwright's recordVideo writes it;
- VP9 at crf 31 and 50, each with a keyframe every 30 frames;
- AV1 (SVT) at crf 35 and 50;
- MJPEG.

Each encoding was decoded by `scan video`, giving 252 cases. Two sets were added during the round:

- 30 harsher encodes the first review made: 1s GOPs at crf 23-35 with the event at the stream's
  end; toasts and blinks at five offsets from a 10-frame GOP's keyframes; a long toast across GOPs;
  still pages at crf 28 and 35.
- 12 encodes the bench needed: six UI kinds through x264 crf 28 at one keyframe a frame
  (intra-only) and at a keyframe every two frames.

A case counts as right only when, event for event, the lossy storyboard matches the lossless one:

- the same class (a return or a change);
- beginning within 3 frames;
- ending no earlier than a frame before and no more than 12 frames after (a codec blurs a change
  in over several frames);
- the same number of states, and no extra events.

The box is scored apart, as IoU against the lossless box.

## What the noise is

Measured between decodes of frames that were byte-identical when captured:

| | raw pixel | 3x3 mean | 4x4 block mean | 8x8 block mean |
|---|---|---|---|---|
| x264 crf 18-35, still text, between keyframes | up to 64 | ~16 | ~9 | ~2-4 |
| x264 crf 28, at a keyframe every 10 frames (the largest) | 142 | 36 | 26 | 14 |
| VP9 crf 50, at a keyframe | 5 | 3 | | |
| the digit change (signal) | ~148 | 53-71 | ~21 | 4-5 |

- The ringing is high-frequency, so a 3x3 mean cancels most of it while a glyph change survives.
  An 8x8 block mean loses the glyph.
- Keyframes are where the noise is largest, and they vary. With a 10-frame GOP the steps at the six
  keyframes were 36, 18, 23, 3, 10 and 36: two of them cross the floor. The review's crf 35 with a
  1s GOP moved means by up to 90, spread over the page.
- An intra-only stream is the opposite case. MJPEG decodes a still picture byte-identically, 61
  frames of 61. x264 at one keyframe a frame re-quantizes once, between its first two frames, as
  its rate control settles.
- Single-pair statistics could not choose the band, though. After a change, VP8's realtime mode
  keeps refining the picture for several frames, and that refinement reads as noise between frames
  the capture had as identical. So the band was chosen by running the storyboard itself.

## Choosing the band

An experimental copy of the storyboard with a pluggable comparison ran every case under 96 bands:
radius 0, 1 or 2; still 4-32; floor 8-64; floor ≥ still. These rows are from that copy, and none of
them has a keyframe rule:

| Band (radius, still, floor) | Right | What it got wrong |
|---|---|---|
| 1, 12, 32 | 205/252 | 28 fades; 9 crf 45; 9 at the 10-frame GOP's keyframes; a slide that never settled at crf 35 |
| 1, 24, 32 | 207/252 | 28 fades; 7 crf 45; 9 at the 10-frame GOP's keyframes; the digit on x265 crf 28 |
| 1, 24, 48 | 208/252 | 28 fades; 6 crf 45; 9 spinners read as back after 357° (a near-return within 48); the x265 digit |
| 2, 12, 24 | 195/252 | 28 fades; 7 crf 45; 14 spinners read as back; 5 drifts at keyframes; the digit on three encodings |

A floor of 48 absorbs keyframes but reads a spinner that has nearly come round as back. So the
floor stays 32, still 24 and radius 1, and keyframes need a rule of their own.

The first design, in the repo, gave a keyframe that departs from a still state, where the step into
it moves no mean past 48, a re-read of the state. It scored 215/252: 28 fades, 9 crf 45, and 208 of
the 208 cases outside those two limits. Without its keyframe rule it scored 206.

## What the reviews and the bench found

This section is the first round, as it was; the second review (below) replaced its "spread" keyframe
rule, its dating back of returns and the smear's reach, and the numbers after it are its own.

The first adversarial review (segmentation, numerics, CLI, performance, claims) reported 31
findings: 26 confirmed by a second agent trying to refute them, 5 in part. The ones that changed
the design:

- **Per pixel alone, a fade is a run of holds.** A hold was frames within `still` of its first
  frame. A fade slower than 24 levels per 100ms qualified at every frame, so one fade became
  one-frame drifts through made-up states, with shrunk boxes. A hold now also keeps the mean over
  the change's box within `holdMean` (3) of its first frame: a codec's noise cancels over a region,
  and a fade moves it. (The bench scored holdMean 2, 3 and 4 the same.)
- **A codec smears an instant change.** Steps inside `still` were dropped, so the digit, which x265
  crf 28 brings in over two frames, read as a drift. A step now reaches back `SMEAR_MS` (50ms); a
  unit test smears a change over four steps of 16.
- **The keyframe step band was wrong four ways.**
  - It swallowed real 33-48 level changes that landed on a keyframe.
  - It fired on the first frame of a fade or a fade-in toast, losing the fade or leaving a made-up
    state.
  - It never re-read a keyframe inside an event, so a transient across one became two changes.
  - x264 crf 35 with a 1s GOP stepped past 48 on a still page.

  It was replaced by a re-quantization test against the state's picture: no 8x8 block mean moved
  past 24 and no 3x3 mean past 96 (the review's crf 35 noise reaches 90). That test applies at a
  keyframe, at a return across a GOP, and at a change settling back into a state in a later GOP.
  The bench scored block 28 / pixel 112 the same as 24 / 96. Without the test the redesign scored
  199 of 208 and 12 of the review's 30.
- **A digit changing on a quiet keyframe is within the re-quantization band** (8x8 means move by
  4-5). At a keyframe the state is read again only when the noise is spread over a quarter of the
  frame's width and height, as a re-encoding's is.
- **A caret still on after a keyframe is within the band too.** A return across a GOP must be
  nearer the state than the event's own first frame, comparing 8x8 means inside the event's box.
- **Boxes and counts.** The decoded pixels were tested against the ignore mask grown for the means,
  which cut real change pixels beside an ignored box. The peak counted means while its box was
  drawn from decoded pixels.
- **`--noise` silently dropped the keyframe rule**, so `--noise 24,32` was not `--lossy`. And
  `--lossy` on a lossless capture silently raised its floor from 8 to 32. Now `--noise` carries the
  hold and keyframe bands, and `--lossy` on frames that are not lossy changes nothing and says so.
- **The look-ahead read whole frames of means.** After a small change, the 5s window computed
  full-frame means for each frame the signatures could not rule out (1042 of 1321 on a 720p
  recording). It now checks the departed box first, from the decoded pixels (`meansApartIn`).

The redesign scored 207 of 208 outside the limits and 29 of the review's 30. The bench of it then
found four more problems:

- **A run of keyframes is one GOP.** Every MJPEG frame is a keyframe; taken as GOPs, the scroll's
  first step was within the re-quantization band and spread, and read as the page re-encoded. A
  GOP now begins at a keyframe after a predicted frame. Inside a run of keyframes, a frame is read
  again only when the page then holds (x264's intra-only rate control).
- **Local keyframe noise crossing the floor.** Of the 430 GOP starts that could be measured (515
  in all; 85 had no frame of an earlier GOP byte-identical in the capture), noise that was not
  spread crossed the floor at two, each one mean at 34 (35 against a state read again). The
  smallest change a codec passed through, the digit, moved its means by 53. So a keyframe whose
  noise is not spread is still read again when no mean is past 40, the floor plus the band's own
  width.
- **A return across a GOP is found where the page holds, then dated back.** Three blinks a frame
  apart across a keyframe were one transient, because the return itself had to hold for 100ms.
  Accepting a return the page merely departs from again read a spinner 357° round as back. Now the
  return is the first frame of the GOP, after the event began, within the floor of the hold.
- **A transient spanning keyframes drew the page into its box** (IoU 0.03-0.04 on three toasts;
  a never-settling spinner on the 10-frame GOP drew 573x205 for 24x24). Every frame was measured
  against the anchor, through each keyframe's re-quantization. Now each frame is measured against
  the state's picture in its own GOP: the anchor's, or a return's that was read again. In a GOP
  with neither, it is drawn only within a block of the 8x8 blocks that moved past the keyframe
  block band, and every frame as drawn when none did. Two narrower versions failed on the bench:
  - rebasing on any return in another GOP took the codec's ghost of a caret, in the return's own
    frame, into its box (4px wide);
  - only the moved blocks themselves cut a caret across two block rows in half.

On the code after the first review:

| Set | Right | Box IoU against the lossless box |
|---|---|---|
| the 252 known answers | 214: all 208 outside the two limits | median 1.00; under 0.5 for 6 of 247 events |
| the review's 30 harsher encodes | 30 | median 1.00; none under 0.5 |
| x264 intra-only and two-frame GOPs (12) | 12 | median 0.22 |

The six weak boxes are a caret drawn 3-4px wide on VP9 crf 50 and x264 crf 35 (IoU 0.20-0.33), and
a digit on MJPEG and on the 10-frame GOP (0.38). The intra-only x264 boxes are the codec's doing.
On the frame with a change, its intra coding moves pixels well past the change: a 60x30 glitch
reads as 199x265. The two-frame GOP draws the caret 5px wide. Events and states are right on all
twelve.

## The second review

A second adversarial review read the redesign through six lenses: keyframes, boxes, holds,
performance, the docs, and parity with the lossless path. It reported 41 findings. A second agent
trying to refute each confirmed 31, 7 in part, and refuted 3, which the tree under review had already
fixed; 12 were high. Its agents also left 375 pairs of a lossless sequence and its decode, each
checked frame for frame against its source; they are a corpus the bench now runs too (below). What
changed:

- **GOPs come from the codec, in decode order.** `scan video` writes each frame's `gop`, counted in
  ffprobe's `pkt_pos` order, so:
  - an open GOP's leading B-frames, decoded after its keyframe and predicted from it, are in its GOP.
    On x264 `--open-gop` the frame shown 17ms before the keyframe stepped 42 levels on a still page,
    and the keyframe itself 18;
  - a selection keeps them. A still page thinned to every 250ms (`--at 0..1s/250ms`) skipped every
    keyframe and read as a transient; a toast thinned to 100ms drew 452x297.

  An import gets them from ffprobe's `key_frame` and `pkt_pos` columns (the `--help` recipe now
  asks for both); without them SUMMARY.md says keyframes are not known.
- **A keyframe is re-read only when the step is a re-encoding's, never because it is spread.**
  "Spread over a quarter of the frame" counted the change's own pixels: 24 counters ticking, a 1px
  scroll, a 1px text shift and a 16-level tint over a panel all read as the page re-encoded. Planted
  exactly on a forced keyframe through x264, x265, VP9 and AV1 at five qualities, a still page's
  keyframe moved means by 36 at most up to crf 28 (54 at crf 35), against a digit's 64-73, a
  caret's ~80, counters' 71-78 and a scroll's or shift's 73-94; a 16-level tint moved 16x16 blocks by
  16-20, a keyframe by 8. So a GOP start is read again when no 8x8 block mean moved past 24, no 16x16
  block mean past 12, no mean past 48, and no more than a quarter of the means past the floor are
  past 40. The last clause is measured too: x264 codes the last keyframe in a stream coarser, 41-46
  with 1-3 of 15-17 means past 40, where a digit moves 4 of its 5 past 40, to 62.
- **A return or settle across a GOP is tested only in a GOP that began during the event, and away
  from the event the frame must be the state as a keyframe re-encodes it.** Tested in any GOP but
  the anchor's, a counter that ticked while a toast was up read as the page come back: lost on
  default x264 (crf 23, keyint 250), x265, VP9 and AV1. Where the candidate was its GOP's first
  frame, nothing else looked outside the event. Inside the event's first box, a block that is
  nearer the event's first frame than the state (a count that changed with the toast) is no return.
- **A return is dated back by `still`, and read again at the frame that holds.** Dated back within
  the floor, a toast fading out across a keyframe was read again at a frame 33 levels off the page,
  and the rest of the fade read as a drift.
- **Holds reject a trend.** Any 16x16 block that moves more than 16 from the hold's first frame
  within 1s, with no sharp step, means the change is still going: a dialog whose page dimmed for
  700ms outside the dialog's box held on the dialog. At 30 and 25fps `SMEAR_MS` reached one frame
  back, so a smeared change was a drift; a step now reaches back 3 frames or 50ms, whichever is more.
  A run that ends with the frames is no hold.
- **Boxes.** Whether a GOP's frames are drawn only near the blocks that moved past re-quantization is
  asked of its keyframe against the state's picture, outside the event as drawn so far. Asked
  unconditionally, a 1px diagonal shift was cut to a 24x19 sliver; asked of the step from the frame
  before, a toast's box took in the spot the previous keyframe had pushed past the floor (452x297
  for 150x32). An event whose box is empty in every frame no longer crashes the CLI.
- **Costs.** The caches are sized from the window (its frames plus 64; the 8x8 means up to 512 MB),
  each state's picture is pinned (a ticking counter cost 4665 means for 80 states at 1080p with
  them evicted), the region check skips boxes over half the frame (259ms against the full
  comparison's 109ms), and cached 8x8 means prove frames apart first.
- **Wording.** SUMMARY.md says how each frame read again was judged, names the first 12 (story.json
  has them all), says when keyframes are not known, and when a new state may be an earlier one
  re-quantized; the note on keyframes inside an event that never settles says what its box takes
  from them; BRIEF.md's no-events line counts the frames read again; `--lossy --json` on frames that
  are not lossy says so on stderr.

What the conservative re-read costs is mostly events the codec makes, reported and flagged as
beginning on a keyframe (the third review found changes it lost too: below):
- x264 re-quantizes an intra-only stream once, between its first two frames: 56 in the means and 14
  in a 16x16 block on the planted page;
- x264 at crf 35 and above re-encodes a still page past the test at most keyframes;
- a codec that refreshes its picture a band at a time (intra refresh) re-quantizes with no keyframe.

On the code after the second review:

| Set | Right | Kinds of the matched events | Box IoU against the lossless box |
|---|---|---|---|
| the 252 known answers | 215: all 208 outside the two limits | 261 of 261 | median 1.00; under 0.5 for 8 of 261 |
| the first review's 30 harsher encodes | 27 (the other 3: a crf 35 keyframe on a still page) | 44 of 44 | median 1.00; none under 0.5 |
| x264 intra-only and two-frame GOPs (12) | 6: every two-frame GOP; no intra-only one (its first frame) | 12 of 12 | median 0.22 |

The second review's own cases are harsher: fades, holds and keyframes made to break the rules, at
up to 260 frames and down to 300 kb/s. Each is scored the same way, event for event against its
lossless sequence:

| Lens the cases came from | Right | Kinds of the matched events | Box IoU median (under 0.5) |
|---|---|---|---|
| holds | 87 of 132 | 128 of 134 | 1.00 (7 of 134) |
| keyframes | 72 of 95 | 62 of 62 | 0.99 (1 of 62) |
| boxes | 32 of 48 | 42 of 43 | 0.98 (8 of 43) |
| CLI (text pages, thinned and imported frames) | 43 of 43 | 43 of 43 | 1.00 (0 of 43) |
| the first review's 30 | 27 of 30 | 44 of 44 | 1.00 (0 of 44) |
| verifiers' holds and keyframes | 27 of 27 | 27 of 27 | 1.00 (2 of 27) |
| all 375 | 288 | 346 of 353 | |

Every one of the 87 misses is a limit below, and none is another kind:
- 52 fades, each beginning late or ending early by the part of it inside the floor (two slow ones
  at 24 levels a second also cross the floor once and come back before they stay past it);
- 16 at x264 crf 35 and above, or at 300 kb/s, whose keyframes re-encode a still page past the test;
- 7 intra-only streams' first frame, 6 intra-refresh encodes, and 6 springs whose overshoot held at
  a turning point.

The kinds that differ are fades the codec decoded as jumps (a drift read as a change).

Of the 252 known answers' weak boxes, six are the first round's and two at crf 45. The 18 of the
second review's cases are documented limits too: a spinner across keyframes that never settles (its
box takes only blocks past re-quantization, 0.005, twice), a digit flashing under a 20-level row
inside the floor (0.01-0.43, six), carets and digits drawn as decoded (0.32-0.41, eight), a fade on
an intra-only stream (0.07) and a 1px jump at crf 35 (0.50).

Against the first round's code this round lost the 3 crf 35 cases and the 6 intra-only ones, each
to an extra event the codec made, flagged as beginning on a keyframe; no event of the 252 known
answers' lossless storyboards was lost.

## The third review

A third review read the second round's fixes through three lenses (re-reads and returns, boxes and
holds, GOPs and imports) and reported 8 findings, 4 of them high; each was reproduced before it was
fixed. What changed:

- **An event that begins on a keyframe comes back.** When the keyframe an event began on also
  pushed a spot of text elsewhere past the floor, that spot was "still the event" in every later
  frame of the GOP: a toast that appeared on a 10-frame GOP's keyframe at crf 28 never returned
  (two changes, three states), and a caret blinking on a keyframe became a change boxed 183x257.
  There the event's departure is now the event as drawn past re-quantization, and the rest of the
  frame is held to a keyframe's re-encoding by `reencodedOutside`, as it already was.
- **…and is boxed alone.** Whether such a keyframe is noisy was asked as "the step into it spans a
  quarter of the frame": a 100x30 badge with a spot of text re-quantized 240px above was drawn
  whole, 103x273, and a 1px shift of a 240x75 block, its own pixels the quarter, was cut to a
  sliver. It is now asked of the means past the floor: is there a cluster of them apart from the
  event's own (`noiseBesideEvent`)? Of the reviewer's 57 encodes of these cases, 40 give the
  lossless story with its box; the other 17 are limits below: a fade beside the event beginning
  late by its part inside the floor (10), and x264's last keyframe at crf 30-33 read as a change
  (7).
- **The re-encoding tail only where the means are spread like a re-encoding's.** The tail clause
  (means to 48 when a quarter at most pass 40) was measured on x264's last keyframe, whose 15-17
  means past the floor lie in 5-8 spots across the page. A label recoloured 40-45% has a tail of its
  own from its antialiased edges (39 means past the floor, 2 to 41, all in one 64x16 region), and
  it was read as the page re-encoded at a GOP start on x264 crf 18 and 23 and AV1, and anywhere in
  an MJPEG recording, where the commit before reported it. The tail now needs three separate spots
  across a quarter of the frame's width or height, or spots whose box spans a quarter of both
  (`REENCODING_SPOTS`); without it the bound is 40. Inside a run of keyframes a frame is read again
  only spread, since a run has no re-quantization to read but rate control's. On the reviewer's 68
  recolour cases, the changes the tail had absorbed are reported again (x264, AV1, MJPEG and
  intra-only x264, at and away from keyframes): 24 of the 68 give the lossless story against
  d37e3e8b's 18, and 21 of the 47 the reviewed commit ran against its 12. None that either got
  right is lost; the rest are at the band's edge (a 40-50% recolour moves its means by 33-42), and
  no version reads them as the lossless change.
- **An open GOP's re-quantization arrives over its opening.** With GOP numbers in decode order the
  boundary is at an open GOP's first leading B-frame, part-way to the keyframe's picture (means
  22-27 against the keyframe's 34 on x264 `open-gop` crf 28). Read again only where the number
  changed, those leading frames made the GOP known within the floor, and the keyframe, past it, was
  an event at every keyframe: a still page through x264 `open-gop` or x265 (whose GOPs are open by
  default) read as a transient over 165 frames, and the reviewed commit gave the lossless number of
  events on 17 of the reviewer's 39 open-GOP encodes (36 with key flags alone). A GOP's opening is
  now its first frame through its keyframe (`opensGop`): any frame of it may be read again, each
  against the state's picture from before the opening (read again frame by frame, x265 bringing a
  digit in over three leading frames absorbed it a few levels at a time), and a GOP is known only
  from its keyframe on. SUMMARY.md's "begins on a keyframe" uses the opening too. Of the
  reviewer's 51 open-GOP encodes (x264 `open-gop` and x265, crf 23-32, keyint 12-60), 50 gave the
  lossless number and kinds of events; the other is x265's last keyframe at crf 30 (below). The
  fourth review found what that set did not plant: a change landing on an x265 keyframe (next
  section).
- **SUMMARY.md's keyframe notes** are said only of a lossy recording (a held-clock capture given
  `--noise` was told its keyframes were not known), say "every frame is a keyframe" of a run
  instead of the intra-refresh caveat MJPEG got, and say of a recording with only frame 0 marked
  that it is shorter than one GOP or refreshes without keyframes.
- **The docs** said the keyframe test was "never a step band" and its re-read "never changes
  lost". For a frame on a GOP's opening it is a band: a change whose means pass the floor by at
  most 8, with no block moved, is read as the page re-encoded — a label recoloured 40% at a
  keyframe is lost where the same change mid-GOP is reported. The limits now say so, and that the
  last keyframe of an x264 or x265 stream re-encodes a still page past the test from crf 30, not
  35: at crf 32 x264's moved 134 means past the floor, 26 of them past 40, to 60.

On the code after the third review, the sets above are unchanged:

| Set | Right | Kinds of the matched events | Box IoU against the lossless box |
|---|---|---|---|
| the 252 known answers | 215: all 208 outside the two limits | 261 of 261 | median 1.00; under 0.5 for 8 of 261 |
| the first review's 30 harsher encodes | 27 | 44 of 44 | median 1.00; none under 0.5 |
| x264 intra-only and two-frame GOPs (12) | 6 | 12 of 12 | median 0.22 |
| the second review's 375 | 288, every case as before | 346 of 353 | median 1.00; 18 under 0.5 |
| the reviewer's 51 open-GOP encodes | 50 | | |
| the reviewer's 68 recolour cases | 24 | | |

On the real recordings every one of the 136 events has the same kind and first frame as after the
second review, no keyframe is read again, and three boxes on changes that begin on keyframes are
1-4px narrower: the keyframe's noise beside them is no longer drawn in. Lossless input still gives
main's story.json and SUMMARY.md byte for byte, on 1500 random sequences and the 18 captures.

## The fourth review

A fourth review read the third round's fixes through three lenses (keyframe re-reads, returns and
boxes, docs and cost) and reported 21 findings, 3 of them high. Of the twelve a second agent tried
to refute (the first four per lens), eight reproduced as reported. The other four had been fixed by
this round's first commit before the verifier ran (the reviewers had run a build from before it),
and the narrower cases two of those verifiers found instead are fixed too: a span inside the first
GOP was called shorter than one GOP, and one sentence of this report still described the old
spread test. The rest were reproduced here before being fixed or written down as limits. The docs
lens found the lossless path unchanged (story.json and SUMMARY.md identical on 21,500 random
sequences, open and closed GOPs included) and no cost regression on 366-frame 1080p recordings.
What changed:

- **A leading frame is read again only when its keyframe is too.** x265's leading B-frames are
  predicted from the keyframe after them, so they show part of a change that lands on it: a digit
  37 off on frame 28, 71 on keyframe 30 (x265 crf 28, keyint 15). The third round let any frame of
  an opening be read again, so frame 28 became the state's picture, the rest of the digit was 34
  from it, and frame 57 at 32 read as its return: a lasting change reported as a transient. On the
  reviewer's 432 open-GOP encodes the third round lost 14 of 156 planted changes on x265, where the
  round before lost 7. Now the leading frame's pre-echo is where the change begins.
- **Past re-quantization is a block or a mean.** Judged by 8x8 means alone (past 24), a 2x2 mark
  or a digit glitch beginning on a noisy keyframe had no departure of its own and never came back
  (a change boxed 36x215 for a 7x9 digit), and a 1px rule beside a label (3x3 means 46-49, 8x8
  means 17) was cut from its box. A 3x3 mean past 48 now counts too (a still page's keyframe moves
  one by 36 at most up to crf 28), and a cluster past 40 in one spot is the event's, not the
  keyframe's noise: on six encodes the label and its rule were boxed 30x8 for 63x12.
- **A return compares the rest of the frame outside everything the event's first frame showed.**
  Where the rule was faint enough to read as noise (x264 crf 30), the keyframe still showed it
  outside the event's box and refused every return in its GOP: a toast with a rule beside it was
  two changes and three states.
- **A leading frame is asked on its own whether its GOP is noisy.** It is predicted from both
  GOPs and carried the previous one's re-quantized spot where its keyframe did not: a toast boxed
  415x240 for 150x32 on x264 open-gop keyint 6.
- **The departure is taken over the codec's smear.** x265 brings a digit in over 3-4 frames, so
  its first frame departed as one pixel and a return in a later GOP was tested only there: a
  lasting digit read as a transient on keyint 9.
- **A keyframe's tail in one spot is read again where its 8x8 means barely moved.** Requiring the
  tail to be spread made a keyframe whose only tail was one cursor (8x8 means moved by 10, against
  a recoloured label's 23) an event at crf 23, and a still page through x264 open-gop crf 32 one.
- **A selection that skipped a GOP's keyframe** made the GOP known from its first selected frame,
  a leading one part-way to the keyframe, and the next frame was an event. Such a GOP is now
  opening throughout and never known, and SUMMARY.md says so.
- **SUMMARY.md** names a leading frame read again as one (it said "a keyframe"); says "every frame
  is a keyframe" only of a real run, with x264's intra-only rate-control step in it; and says of
  frames inside one GOP that no keyframe among them is read again, not that the recording is
  short.
- **The docs** stated the band as "at most 8 past the floor"; it is 16 where spread or in one quiet
  spot, two labels recoloured at once count as spread, and in a run of keyframes a spread change
  is lost on any frame. "One region across a quarter of both" was the box of all the spots. A
  label recoloured 40% mid-GOP is reported on x264, not on VP9 crf 33, which codes it under the
  floor. Two limits are added: a change in the band made elsewhere while an event spanning a
  keyframe is up, and blinks whose off-time is at most the hold, the first on a noisy opening.

The reviewer's own sweep is the measure here: 432 open-GOP encodes (x265 and x264 `open-gop` at crf
23, 28 and 32, keyint 10, 12, 15 and 30, the nine planted UI kinds and a digit change spliced onto
nine frames around an opening), each scored against its lossless storyboard.

| Code | x265 (216) | x264 open-gop (216) |
|---|---|---|
| before the third review (44c4d23b) | 71 | 56 |
| after the third review | 186 | 145 |
| after the fourth | 177 | 145 |

Every miss but one is at crf 32 (the other: a digit x265 shows on its leading frames 4 frames
before the lossless change, at crf 28). 81 of the 110 are the last keyframe alone, coded coarser,
its opening an event and flagged as beginning on a keyframe; with the last GOP set aside, 403 of
the 432 give the lossless story. The other 29 were wrong under both earlier versions too: changes
the codec codes under the floor until a later GOP, and x264 open-gop at crf 32 keyint 15. Against
the third round, 19 x265 cases at crf 32 are now that last-keyframe event: it got them right by
reading the last GOP's opening again frame by frame, the same chain that lost the digit, and 10
others are now right. Of the planted changes through x265, one goes unreported (crf 32, keyint 30).

On the code after the fourth review, every earlier set gives the verdicts it gave after the third:

| Set | Right | Kinds of the matched events | Box IoU against the lossless box |
|---|---|---|---|
| the 252 known answers | 215: all 208 outside the two limits | 261 of 261 | median 1.00; under 0.5 for 8 of 261 |
| the first review's 30 harsher encodes | 27 | 44 of 44 | median 1.00; none under 0.5 |
| x264 intra-only and two-frame GOPs (12) | 6 | 12 of 12 | median 0.22 |
| the second review's 375 | 288, every case as before | 346 of 353 | median 1.00; 15 under 0.5 |
| the third review's 51 open-GOP encodes | 50, the same 50 | | |
| the third review's 68 recolour cases | 24, the same 24 | | |
| the fourth review's 432 open-GOP encodes | 322 (above) | | |

Every case of the 252, the 30 and the 12 has the same verdict and box IoU as after the third review.
Of the 375, five boxes moved: a digit changed beside a never-settling spinner, through x264's
10-frame GOP and through VP9, is boxed again (IoU 0 → 0.99 and 1.00), and so are the two jumps on
x264 crf 35 keyint 60 (0.50 and 0.95 → 1.00); a fade's box went from 0.79 to 0.76. On the real
recordings every one of the 136 events keeps its kind and first frame, no keyframe is read again,
and five boxes grew by 1-4px (four window changes on Conky 106687, 464-476px wide, three of them
beginning on keyframes; one on GrassGIS 46646). Lossless input still gives main's story.json and SUMMARY.md byte for byte, on 1500 random
sequences and the 18 captures with and without `--ignore`.

## The fifth review

A fifth review read the fourth round's fixes through four lenses: keyframe re-reads; returns and
boxes; a differential of 1030 planted cases against the code before the fourth round (e45dd8de);
and docs, SUMMARY.md and cost. It reported 26 findings, 5 of them high. A second agent tried to
refute twelve of them. Ten held as reported, and two held in part: in the 1080p toast below the
mechanism was not the one the reviewer named, and the quiet-cluster finding was narrower than
claimed. The other fourteen were reproduced or read against the code here, then fixed or written
down as limits. Most of the twelve are one rule seen from two sides. The fourth round read a
leading frame again only when its keyframe passed too, and that was broader than the case it was
made for. What changed:

- **A leading frame's pre-echo is held; any other leading frame that passes is read again.**
  Refusing a leading frame whose keyframe failed fixed the half-changed digit. It also made up
  events in three ways:
  - A pre-echo gone by the next leading frame was a glitch before the change. A blue focus ring
    through x265 crf 28, keyint 15, gave glitch@28→29 and then change@30. A digit landing on an
    x265 keyframe at crf 18-20 was right in 2 of 9 encodes, against 9 of 9 before.
  - A leading frame that only re-quantized a spot elsewhere began the event there. The smear
    joined that spot to a toast on the keyframe (509x363), and the toast never came back (x265
    crf 30, keyint 6).
  - A transient on an open-GOP keyframe, after a change that settled mid-GOP, became changes with
    a page-wide box.

  Now a leading frame that passes the test is held only when its keyframe moves a mean past 40
  within the 8x8 neighbourhood of where the leading frame departs (`echoes`). A held frame is
  neither read again nor an event, and the change's step is measured across the held frames, or
  the pre-echo split it into steps under the floor and it read as a drift. Any other leading
  frame that passes is read again. Two things were tried first and dropped. Merging a pre-echo
  glitch into the keyframe's change merged blinks 3 frames apart. Reading the pre-echo again when
  the keyframe was within the floor of it read the half-changed digit again.
- **A keyframe's tail is never one spot.** The fourth round admitted a tail in one spot whose 8x8
  means barely moved, to take in a cursor's tail (8x8 means 10-11). A letter changed on a keyframe
  is also one such spot: 'Customers' became 'Csstomers' in 12px dark nav text, means to 44-48,
  2-3 of them past 40, 8x8 means 7-9. It was lost on 7 of 16 encodes where the code before had
  reported it. A tail must now be spread, or in two spots or more apart whose 8x8 means barely
  moved. One spot is still accepted in two places:
  - Around an event, by a return's `reencodedOutside`: without it a toast through x264 crf 32 did
    not come back.
  - On a leading frame whose keyframe passes and shows that spot (`shownBy`): there it is the
    keyframe's re-quantization arriving early. Without this, x264 `open-gop` at crf 32, keyint
    10, brought one spot in on the frame before each keyframe (6 means past the floor, one to 42,
    8x8 means 3.4; the keyframe, four spots), and the first opening of eleven of the 432 open-GOP
    encodes was a change, where the fourth round had read it again.
- **A keyframe re-codes what prediction coded.** A glyph changed mid-GOP is coded by prediction
  until the next keyframe codes it afresh. There its means moved by 45 (x265 crf 28: 6 past the
  floor, 4 past 40, 8x8 means 7.5), and the next opening of a still state was an event
  (drift@44→45). So inside what differs past the floor from the GOP's keyframe (`predicted`, out
  to whole 8x8 blocks), means past 40 up to 56 (`recodedTop`) are admitted from the keyframe on,
  in 8x8 blocks that moved by 12 at most. The shape was measured into place:
  - Applied on leading frames too, it read a counter tick inside the last tick's box again.
  - Applied within 40 too, a red badge's re-coding (8x8 means past 12) kept a toast over it from
    coming back.
- **A change inside an event's box while the event is up is something new** (`newInside`). A
  counter ticking inside a toast's or a focus ring's box (3x3 means 66-74 from both the page and
  the event, 8x8 means 4-5) passed `leftEvent` and the bands, and the state was read again at a
  frame that showed the new count. The code before the fourth round did this too. A return is now
  refused where a mean inside the box is more than 56 from both the state's picture and the
  event's.
- **A cluster is quiet as the keyframe test reads it.** `eventClusters` took a lone cluster
  peaking at 41-48 for the event, where the keyframe test reads the same spot as
  re-quantization. On x264 crf 32, keyint 6, a keyframe's own spot (41, 8x8 means 7.1) was boxed
  with a toast (508x372 for 150x32), and a digit glitch on it never came back. A cluster is now
  quiet when it peaks at:
  - 40 or less;
  - 48 or less and is spread or has 8x8 means that moved by 12 at most;
  - 56 or less, has 8x8 means that moved by 12 at most, and is spread or inside the anchor's
    predicted picture.
- **Past re-quantization takes two means around a block** (`TAIL_RUN`). On a toast at 1080p
  through x264 crf 32, a keyframe pushed two lone means far apart to 49. Taken for the event, they
  drew the box over the page (1281x806, then 1337x338): two changes for one transient, and 31%
  more time on a 366-frame recording. A block now counts only when it and its eight neighbours
  hold two means past 48. Asking for three lost a digit decoded weakly beside a spinner.
- **A line's thin side is grown to whole blocks for the hold's mean.** A 1px underline through
  x264 crf 18, keyint 10, never settled: over its 3px-tall box the mean moved past 3 at every
  keyframe. Only a line's: grown everywhere, a 16x12 ramp held a frame early, and a digit x265
  brings in over four frames settled a frame early as a drift.
- **Only keyframes shown one after another are a run** (`gopNumbers` in `scan video`). x264
  `--open-gop` with a GOP no longer than its B-frames decodes the IDR and the next keyframe back
  to back. Counted as a run, that keyframe was in GOP 0, and its re-quantization was a 55-frame
  transient that swallowed every caret blink in it.
- **SUMMARY.md** now:
  - gives the keyframe test's whole band: two spots or more, one spot before the keyframe that the
    keyframe shows too, and 56 where the state's picture had changed since its GOP's keyframe (it
    called a re-read through any of these "spread over the picture");
  - says an event that begins on a leading frame begins on the GOP's opening, before its keyframe
    (it said "on a keyframe");
  - says "no keyframe among them is read again" only when no keyframe is;
  - adds the intra-only run note only when an event begins at frame 1.
- **The docs**:
  - The last keyframe's coarser coding is reported and wrong from x265 crf 27 and x264 crf 29,
    not from crf 30.
  - x264 `open-gop` at crf 32 and a 1080p page at x264 crf 32 are added to what is reported and
    wrong; a still page's keyframes there move means past 48.
  - A settle uses neither the smear nor the start-frame mask; only a return does.
  - "One spot" is now what the code tests.
  - Three limits are added: a faint part of an event cut from its box on a keyframe that
    re-quantized nothing else; a change inside an event's box merged with the event when it
    settles within 100ms of a keyframe; and a pre-echo past the band, gone before the keyframe,
    as a glitch before the change.

Tests for the fifth round, each failing on the code before it:
- the pre-echo held (and the loud one that stays a glitch);
- a keyframe re-coding a glyph changed mid-GOP;
- a counter inside a focus ring's box;
- a 1px line that settles;
- a lone mean past the tail beside a toast;
- the letter on a keyframe, and a leading frame's one spot that its keyframe shows;
- a cursor moved mid-GOP;
- the open-GOP run in `gopNumbers`.

On the code after the fifth review:

| Set | Right | Kinds of the matched events | Box IoU against the lossless box |
|---|---|---|---|
| the 252 known answers | 215: all 208 outside the two limits | 261 of 261 | median 1.00; under 0.5 for 8 of 261 |
| the first review's 30 harsher encodes | 27 | 44 of 44 | median 1.00; none under 0.5 |
| x264 intra-only and two-frame GOPs (12) | 6 | 12 of 12 | median 0.22 |
| the second review's 375 | 290, every case as the code before this round gives on the same frames | 346 of 353 | median 1.00; 15 under 0.5 |
| the third review's 51 open-GOP encodes | 50, the same 50 | | |
| the third review's 68 recolour cases | 24, the same 24 | | |
| the fourth review's 432 open-GOP encodes | 322 (below) | | |

Every case of the 252, the 30 and the 12 has the same verdict and box IoU as before this round,
and so does every box of the 375. On the fourth review's 432 open-GOP encodes:

| Code | x265 (216) | x264 open-gop (216) |
|---|---|---|
| before the third review (44c4d23b) | 71 | 56 |
| after the third (e45dd8de) | 186 | 145 |
| after the fourth (fc680d47) | 177 | 145 |
| after the fifth | 177 | 145 |

Every miss is now at crf 32. The one the fourth round had at crf 28, a digit x265 shows on its
leading frames 4 frames before the lossless change, is right. One case at crf 32 is newly wrong: a
scroll through x265 keyint 30, whose last keyframe is now an event (drift@60), where the fourth
round read its leading frame again. With the last GOP set aside, 81 of the 110 misses give the
lossless story, as 81 of the fourth round's 110 did: 403 of the 432 either way.

The fifth review's own differential, re-scored:

| Code | 1030 planted cases | x265 (338) | x264 open-gop (208) | x264 (189) | VP9 (142) | AV1 (130) | MJPEG (23) |
|---|---|---|---|---|---|---|---|
| after the third review (e45dd8de) | 744 | 255 | 136 | 115 | 110 | 109 | 19 |
| after the fourth (fc680d47) | 737 | 244 | 139 | 116 | 110 | 109 | 19 |
| after the fifth | 749 | 253 | 141 | 116 | 111 | 109 | 19 |

One case is worse than after the fourth round. A digit changed at frame 25 through x265 crf 29,
keyint 10, now begins at frame 29, just before the next keyframe; the fourth round had it at 28,
and the third round had it as a drift at 30. Nine cases that the third round got right are still
wrong, the same nine the fourth round got wrong. They are all the last keyframe of an x265 stream
at crf 27 and 32, reported as an event beginning on a keyframe. Of the 546 open-GOP cases among
them (x265 and x264 open-gop), 394 are right. Applying the predicted allowance on leading frames
too gave 393; the fourth round's code gives 383, and the third's 391.

On the real recordings every one of the 136 events keeps its kind, first frame and box, and no
keyframe is read again. Lossless input still gives main's story.json and SUMMARY.md byte for byte,
on 1500 random sequences and the 18 captures with and without `--ignore`. On the 366-frame 1080p
recording of the cost finding (x264 crf 32, keyframes forced on its events) the story is
e45dd8de's again, with the same 836 decodes. It takes 125s against e45dd8de's 116s (two runs
each, +8%); the fourth round's misread toast had made it +31%.

## Three things the implementation needed

- **A hold is measured from its first frame.** A frame compared only with the one before is within
  the band of it during a ramp slower than the band, and such a ramp was one long hold. A unit test
  plants a ramp of 10 levels a frame for 12 frames. The event begins where the ramp passes the floor
  and settles where the ramp stops.
- **Boxes from the decoded pixels.** The means draw a box wrong both ways: a 1px caret comes out 3px
  wide, and of a glyph's thin strokes only the core passes the floor. The box is now the decoded
  pixels past the floor, inside the means' box grown by twice the radius. The caret is drawn 1px
  wide on 10 of the 13 encodings (crf 45 aside), and 2-4px on x264 crf 28 and 35 and VP9 crf 50.
- **Speed.** On a 1920x910 recording, the first version took over ten minutes for 563 frames:

  - each read of a frame's means cost about 200ms walking columns, and the 5s look-ahead after every
    event re-read up to 150 frames;
  - running sums in memory order and a division table brought a frame's means down to about 70ms;
  - the CLI's frame reader moved from pngjs to the repo's fast PNG decoder (47ms → 26ms);
  - each frame's 16x16 block signature is kept (for the 5s window plus 64 frames, at least 128 MB) and answers
    every comparison that only has to learn two frames are apart. That shortcut is sound: a mean of
    differences is never larger than the largest. A property test holds it, and one holds the
    look-ahead's region check to the full comparison.

  Times for cua-106644 (563 frames at 1920x910), on 4 cores:

  | Version | Alone | Three at a time |
  |---|---|---|
  | the first design | 128-138 s | 163 s |
  | the redesign, before its last fix | | 252 s |
  | the final code | 106 s | 140 s |

  The redesign's re-quantization test kept its 8x8 block means for only 32 frames. So the 5s window
  scanned after each event recomputed every frame's means, event after event: 73 of 108 s on the
  146-frame cua-106670. The 8x8 means now come from the same pass as the 16x16 signature and are
  kept for the window plus 64 frames too (up to 512 MB: 258 frames at 4K, under a 60fps window
  there), and each state's picture is pinned. A 16x16 block past the block band rules a pair out first, and
  the return scan runs its cheap tests before anything that needs a frame's means. Every storyboard
  came out the same before and after, the 11 real ones and the 294 known answers.

## Real recordings

All decoded by `scan video` and storyboarded by the CLI with `--lossy`, with no `--ignore`. The
first design and the code after the first review agreed on every count below, and on all 137
events' kinds and first frames; 12 of their boxes differed, 11 of them by at most 18 pixels a side
(the twelfth, cua-41768 E4, by 44). After the second review one count moved: on OnlyOffice 41765 a
4x9 change at frame 237 and a 108x23 one four frames later are one change now (24 events → 23).
Three small events at 30fps read as changes where they were drifts (a step now reaches back 3
frames, not one), and 10 boxes differ. The times are the first review's code, three at a time; the
second review's runs shared the machine with other work and are not comparable.

**VideoCUA (ServiceNow)** records human desktop tasks. Each task logs its actions on the video's
timeline (MIT on the dataset card, though the LICENSE file the card links to does not exist). Eight
of its tasks were run, from three of the smallest per-app zips (Conky, GrassGIS, OnlyOffice Forms).
Two larger GrassGIS tasks were left out, one of them at 60fps and 2078x1462. All are H.264 at 30fps,
at 1918x908 to 1920x1080 (two at 1366x716 and 1362x722), with keyframes every 30 to 158 frames.

| Task | Frames | Size | Time | Events | Clicks and keys followed by an event within 1s | Latency (ms) |
|---|---|---|---|---|---|---|
| Conky 106644 | 563 | 1920x910 | 140 s | 27 | 3/3 | 19, 75, 37 |
| Conky 106653 | 589 | 1920x1080 | 191 s | 21 | (moves only) | |
| Conky 106670 | 146 | 1920x912 | 44 s | 8 | (moves only) | |
| Conky 106687 | 257 | 1918x908 | 76 s | 9 | (moves only) | |
| OnlyOffice 41765 | 587 | 1920x1080 | 206 s | 23 | 3/4 (the fourth at 1033ms) | 833, 500, 433 |
| OnlyOffice 41768 | 506 | 1362x722 | 90 s | 13 | 1/1 | 467 |
| GrassGIS 45264 | 263 | 1920x1080 | 84 s | 7 | 1/1 | 33 |
| GrassGIS 46646 | 163 | 1366x716 | 29 s | 9 | 1/1 | 330 |

- **9 of the 10 logged clicks and keys are followed by an event within 1s** (the tenth after
  1033ms, an app slow to respond). That alone says little, because these recordings are dense with
  events. An event begins within that window of a random instant 74% of the time, so chance gives
  7.4 of 10, and 9 or more with P = 0.21. With the events near any logged action left out of the
  chance count (they are the ones the actions cause), chance gives 5.0, and 9 or more with
  P = 0.009. The truth lies between the two.
- **The labels are actions, not changes, so most events have none.** Only 32 of the 117 events fall
  within 1.5s of an action.
- **The unlabelled events looked at are real changes on screen:**
  - On Conky 106644 they are a terminal's block cursor blinking (12x24 transients), each typed
    character of "conky" appearing (the box stepping right about 11px a letter), the output after
    Enter, and the Conky window refreshing once a second.
  - On OnlyOffice 41768 they are a 2x21px text caret blinking (three transients a second apart), a
    toolbar button's hover and its fade, a selection, and the document view changing (read from
    its sheet).
  - None is codec noise: no whole-frame event lands on a keyframe.
- **No recording needed a keyframe read again.** These keyframes move the means by 4 to 22, inside
  the floor.

**GUI-World website/0** is a student screen recording at 1280x720 (CC BY 4.0 per the dataset README)
with three annotated hover keyframes, at frames 72, 122 and 156. It gave 11 events in 37 s:

- three begin within 15 frames of frame 72, at 59, 64 and 75;
- one begins at frame 107, where the pointer starts moving toward the second hover;
- none begins within 15 frames of 156, where the hover changes nothing visible.

**Shot-boundary datasets** were run on spans of 25fps broadcast and short-form video:

- RAI 25012: the first 40s, 1001 frames at 640x360.
- AutoShot 42728994306: 863 frames at 720x1280.

On them the storyboard is what it is designed to be, not a shot detector:

| Recording | Cuts | An event begins at | Cuts while the storyboard was in a state | Of those |
|---|---|---|---|---|
| RAI 25012, 0-40 s | 3 | 2 | 2 | 2 |
| AutoShot 42728994306 | 18 | 3 | 1 | 1 |

Every cut reached while the storyboard was in a state begins an event. But inside a shot the camera
and the people move, so a change never reaches 100ms of one picture, and it runs on through the next
cut (AutoShot: 5 events for 18 cuts). Scoring shot boundaries would need a different segmentation
(a cut detector, which `ffmpeg -vf scdet` already is); this round does not claim one.

The frames of these recordings stay local. BBC, RAI and AutoShot footage carries no license that
allows publishing it, and none of it is in this repository.

## Limits

The output does not detect these.

- **A change smaller than the floor, over a 3x3 mean, is not seen.** A 6% fade (15 levels) was a
  drift in every lossless capture and is not seen in any lossy one. On VP9 crf 50 a 2x3px codec
  artefact inside it surfaces as a drift instead; on x264 crf 45 the change at frame 3 is the codec
  refining its first picture.
  `storyboard-lossy.test.ts` holds the fade's absence.
- **A fade is seen only past the floor.** It begins late and ends early by the part of it inside
  the floor: a toast fading out over a second ends 6 frames before the lossless one does, a fade-out
  over 1.5s 9 frames before.
- **A change the keyframe test admits, landing on a GOP's opening, is absorbed**: no 8x8 block
  mean past 24, no 16x16 block mean past 12 and no mean past 40 (to 48 only where the means past
  the floor are spread like a re-encoding's or lie in two spots or more apart whose 8x8 means
  barely moved, a quarter at most past 40; to 56 inside what changed since the GOP's keyframe, in
  8x8 blocks that barely moved). That is a band, not only what is under the floor: a label recoloured
  40% at a 30-frame GOP's keyframe is lost on x264, VP9 and AV1, where the same change mid-GOP is
  reported on x264 (VP9 at crf 33 codes it under the floor mid-GOP too). Changes made at once in
  several places count as spread: two labels recoloured 45% on a keyframe are lost. In a run of
  keyframes a spread change is lost on any frame. A 12px digit moves its means by 62 or more at
  crf 28; a lighter one may not. SUMMARY.md names the first 12 frames read again and story.json
  all of them.
- **Inside what changed since the GOP's keyframe, a change to 56 whose 8x8 means barely moved**,
  landing on the next keyframe, is read as that keyframe re-coding the predicted picture.
- **A change made elsewhere while an event that spans a keyframe is up**, inside the re-encoding
  band (a label blended 30% toward white under a toast), is admitted by the return across the GOP.
- **Blinks whose off-time is at most the 100ms hold merge** when the first begins on a noisy
  opening: its return across the GOP needs the page to hold. So does a change inside an event's
  box that settles within 100ms of a keyframe, which breaks the hold: it merges with the event.
- **A faint part of an event is cut from its box** (a 2px underline far from a toast, means 39)
  where it looks like a keyframe's re-encoding on the keyframe the event began on.
- **An oscillation can hold at a turning point.** A spring's overshoot slows enough near each turn
  for 100ms within the band, so it settles there and its next swing is a second event (a drift).
- **x264 at crf 45 destroys the content.** The digit change never appears, and frame 1 departs from
  frame 0 as the codec refines its first picture.
- **On an intra-only x264 stream, boxes are the codec's.** A frame with a change is coded at another
  quality around it, and its box takes that in.

These it reports, and they are wrong; each is flagged as beginning on a keyframe:
- x264's intra-only re-quantization between its first two frames;
- x264 at crf 35 and above, whose keyframes re-encode a still page past the test;
- x264 `open-gop` at crf 32, and a 1080p page at x264 crf 32, whose still keyframes move means
  past 48;
- the last keyframe of an x264 or x265 stream, coded coarser, from x265 crf 27 and x264 crf 29
  (x264 crf 32: 134 means past the floor, 26 of them past 40, to 60);
- a pre-echo past the band on an x265 leading frame that is gone before the keyframe, as a
  glitch before the change;
- intra refresh, which re-quantizes a band at a time with no keyframe (SUMMARY.md says when only
  frame 0 is marked a keyframe: shorter than one GOP, or intra refresh).

For a lossy recording SUMMARY.md also says when no frame is marked a keyframe, when a selection has
no GOP numbers and when every frame is one.
For an event that never settles it says when keyframes fell inside it: from those GOPs its box takes
only the blocks that moved past re-quantization, so a keyframe that moved a block further is in it
(`--ignore` what never settles, as on a lossless capture).

Two costs are known and left: a box searched back over a long visit with many new boxes is
quadratic in the visit (`lastSameInBox`), and a change that never settles reads its frames' means
three times.

## Held by tests

- `packages/vlmkit-judge/src/storyboard.test.ts`, the noise-band tests:
  - the mean;
  - `still` in `frameDelta`;
  - the grown ignore mask;
  - noise as no event;
  - planted events under noise, with their boxes;
  - the ramp and the slow fades, a fade at 20 levels a second, and a change still moving at the end;
  - the smeared step at 60, 30 and 25fps;
  - holds that creep (a dialog over a dimming page);
  - keyframes read again, the tail test, and changes on a keyframe that stay changes;
  - a re-encoding is spread: a label recoloured with a tail of its own on a keyframe, and a
    localized step inside a run of keyframes, are changes;
  - a run of keyframes (MJPEG; x264 intra-only's one re-quantization; a fade a level a frame);
  - GOP numbers (`beginsGop`) and an open GOP's opening (`opensGop`): a still page re-quantized over
    its leading frames and keyframe is read again, a change brought in over them is a change, and a
    leading frame's pre-echo of a change on its keyframe is the change's start;
  - the fifth round's: a pre-echo held (and one past the band that stays a glitch), a keyframe
    re-coding a glyph changed mid-GOP, a counter inside a focus ring's box, a 1px line that
    settles, a lone mean past the tail beside a toast, a letter on a keyframe, a leading frame's
    one spot that its keyframe shows, a cursor moved mid-GOP;
  - an event that begins on a keyframe that re-quantizes text elsewhere: a toast returns, a badge
    stays, each boxed alone;
  - returns across GOPs (a transient, blinks, a caret that is no return, a toast fading out across
    a keyframe, a counter that ticks while a toast is up);
  - a transient's box across two keyframes;
  - settling in a later GOP;
  - refused bands;
  - property tests for the region check and the signatures;
  - SUMMARY.md's sentences, and its notes where keyframes are not known (only for a lossy
    recording), for a run of keyframes and for a recording with only frame 0 marked.
- `packages/vlmkit-core`: `gopNumbers` (decode order, an open GOP, a run of keyframes, and an
  open GOP no longer than its B-frames, whose keyframes are not shown one after another),
  `parseFrameTable`'s `pkt_pos`, the timestamp file's `key_frame` and `pkt_pos` columns, and through
  ffmpeg an open-GOP encode whose leading B-frames are counted in the next GOP, a selection that
  skips every keyframe and keeps them, and an import that gets the same keyframes and GOPs as a scan.
  `frames.ts` refuses a `gop` that is not a whole number or goes back.
- `src/cli/commands/storyboard-lossy.test.ts` runs eight planted kinds through five encodings:
  - x264 crf 23;
  - x264 crf 28 with a keyframe every 10 frames;
  - VP8 as Playwright records;
  - VP9 crf 50 with a keyframe every 30;
  - AV1 crf 50.

  Each must give the lossless story. It also holds the fade limit, a digit on a keyframe, open
  GOPs (a still page, a toast, a caret and a digit through x264 `open-gop` and x265, keyint 12: the
  lossless story, with the GOP number changing on a leading frame), and the CLI path: refusal
  without `--lossy`, the band in story.json, keyframes read again.
- The lossless path is unchanged. The existing storyboard tests pass. On 1500 random sequences (half
  with keyframe flags) and the 18 lossless captures, story.json and SUMMARY.md equal origin/main's
  byte for byte.
