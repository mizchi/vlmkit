# Can Jev name an animation's easing from its frames? (2026-10-18)

The question: give Jev a numbered sequence of frames of one animation, and see whether it can say
which timing function the animation uses.

**Asked directly, it cannot. 7 of 21 named from the frames and 4 of 21 from a contact sheet, where
chance is 3 of 21.** Asked where the object is in each frame (`box`), and the curve fitted to those
positions, all **21 of 21** were named. That repeats the jev-box lesson ("pixels say where, Jev says
what") for motion: Jev's positions are good enough to fit a curve, but its reading of motion is not.

```bash
node --experimental-strip-types src/experiments/benchmark/jev-easing/jev-easing.ts --md r.md   # TYPESAFEAI_API_KEY, ~$0.023
node --experimental-strip-types src/experiments/benchmark/jev-easing/jev-easing.ts --rescore --out docs/reports/data/2026-10-18-jev-easing
```

## Setup

- **Animation**: a CSS `@keyframes` translation of 480px in 1000ms, paused, seeked through the
  Web Animations API to 0, 100, … 1000ms, and shot after two rendering updates. That gives 11 frames
  per case.
- **Easings (7)**: `linear`, `ease`, `ease-in`, `ease-out`, `ease-in-out`, `steps(4, end)`, and
  overshoot `cubic-bezier(0.34, 1.56, 0.64, 1)`.
- **Objects (3)**: a blue square moving left to right (640x320 frame), a green circle moving top to
  bottom (320x640), and a red "Save" button moving right to left (640x320). That makes 21 cases.
- **Arms**:
  - `frames`: the 11 frames as 11 assets with `time_ms`, asked as one `choice`.
  - `sheet`: one image, the band the object travels through cut from each frame and stacked in time
    order with 2px rules between, asked as one `choice`.
  - `box`: one `box` per frame ("the blue square in `screenshot`"). The box centres are fitted by
    `fitEasing`, which takes the least squared error against the 7 curves on normalised progress.
  - `pixels`: no model. The object's centroid per frame, with the same fit. It checks that the frames
    carry the answer.
- **The choice wording** (`EASING_CRITERIA`) describes each easing as motion ("the distance between
  consecutive frames shrinks toward the end"), not only by its CSS name.

## Results

| arm | right | by easing (3 cases each) |
|---|---:|---|
| frames (`choice`, 11 images) | **7/21** | linear 3, ease-out 3, ease-in 1, the rest 0 |
| sheet (`choice`, 1 image) | **4/21** | linear 3, ease-out 1, the rest 0 |
| **box + fit** | **21/21** | 3 of 3 for every easing |
| pixels + fit (no model) | 21/21 | 3 of 3 for every easing |
| box + fit, every 2nd frame (6 frames) | 21/21 | |
| box + fit, every 5th frame (3 frames) | 14/21 | 0 / 500 / 1000ms cannot tell steps or overshoot apart |

- **A direct `choice` answers by a few default labels.** In the frames arm, every `ease` and every
  overshoot was named `ease-out`, `ease-in-out` went to linear (2) and ease-in (1), and `steps` was
  never named. The sheet arm named 12 of 21 linear. It is not reading the spacing between frames.
- **The `choice` confidence does not warn.** In the frames arm the median confidence was 0.30 when
  right and 0.51 when wrong. In the sheet arm it was 0.81 right and 0.61 wrong. The true easing's
  median probability was 0.11 and 0.07, at or below the uniform 1/7 = 0.14. The confidence cannot be
  used as an "uncertain" flag the way `region-kind` uses it.
- **Box positions are accurate enough for a fit, with margin.** Against the pixel centroid on the
  motion axis, the box centre was off by a median 2.6px (p90 5.9px, max 10.3px) on a 480px travel.
  The runner-up curve's error was at least **43x** the winner's (median 208x) with 11 frames, and at
  least 11.6x with 6 frames.
- **Three frames are not enough for any method.** 0, 500 and 1000ms is three points, two of them
  fixed by normalisation, so steps and overshoot fall into whatever has the same midpoint.

## Cost

| arm | requests per case | input tokens per case | $ per case | median latency per request |
|---|---:|---:|---:|---:|
| frames | 1 | 6,879 (~625 per frame) | $0.00029 | 276ms |
| sheet | 1 | 2,955 | $0.00012 | 163ms |
| box (11 frames) | 11 | 15,378 | $0.00065 | 109ms |
| box (6 frames) | 6 | ~8,400 (estimated from the 11-frame run) | ~$0.00035 | |

Requests in the box arm can run in parallel. One case is about 0.1–0.3s at a concurrency of 11.

## What this says for vlmkit

- **The deterministic way already exists and is exact.** Measuring the easing from the DOM or the
  pixels needs no model. `check animation --virtual-time` samples on the held clock, and the
  `pixels` arm here got 21/21 from centroids.
- **Jev is useful when nothing can be tracked by pixels or DOM.** Examples: a recording (`scan
  video` frames), a canvas, or an object among other moving things where a centroid has no target.
  There, `box` per frame with the fit in vlmkit works, and a direct `choice` does not.
- **Do not ask Jev for the easing name.** It is wrong at chance level with confident-looking
  probabilities.

## Limits

- One object on a plain background, with translation only. Scale, opacity, colour, and motion in
  clutter were not measured.
- Seven candidate curves. A custom `cubic-bezier` would be fitted to its nearest candidate. Fitting
  its four parameters is not built.
- One sampling grid (100ms) and its subsamples. A recording's frames at uneven times would need
  the times in the fit. `fitEasing` assumes even spacing.

Data: `docs/reports/data/2026-10-18-jev-easing/` (`answers.json`, the 21 sheets, `report.md`).
