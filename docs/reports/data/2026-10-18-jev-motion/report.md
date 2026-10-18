14 pages (7 broken, 7 intact). Broken caught by the expected rule 7/7 (any fail 7/7); intact passed 7/7.

| case | expected | inspect motion: broken | intact | easing fit (broken / intact) | gates on broken: check animation · integrity --timeline | gates on intact |
|---|---|---|---|---|---|---|
| snap-back | snap-back | snap-back | pass | ease-in-out (18.3x) / ease-in-out (23.4x) | 0 · 1 page-overflow-x | 0 · 1 page-overflow-x |
| keyframe-gap | jump | jump | pass | linear (1.1x) / linear (25.2x) | 0 · 1 page-overflow-x | 0 · 1 page-overflow-x |
| clipped | absent-at-rest | absent-at-rest | pass | ease-in (3.4x) / ease-in-out (13.7x) | 0 · 0 clipped-content | 0 · 1 page-overflow-x |
| covered | absent-at-rest | absent-at-rest | pass | skipped / ease-out (1.0x) | 0 · 1 container-protrusion,occluded-text | 0 · 1 container-protrusion |
| overlap-rest | forbid-at-rest | forbid-at-rest | pass | ease-out (18.2x) / ease-out (48.3x) | 0 · 1 container-protrusion,text-collision | 0 · 1 container-protrusion |
| fade-reversed | absent-at-rest | absent-at-rest | pass | skipped / skipped | 0 · 0 | 0 · 0 |
| easing-wrong | easing-mismatch | easing-mismatch | pass | ease-in (39.5x) / ease-out (20.3x) | 0 · 1 page-overflow-x | 0 · 1 page-overflow-x |

With `--selector` (positions, opacity and scale measured from the page; presence and the statement still Jev's): broken caught by the expected rule 7/7, intact passed 7/7.

| case | measured: broken | measured: intact | easing (broken / intact) |
|---|---|---|---|
| snap-back | snap-back | pass | ease-in-out / ease-in-out |
| keyframe-gap | jump | pass | ease-in / linear |
| clipped | absent-at-rest | pass | ease-in-out / ease-in-out |
| covered | absent-at-rest | pass | ease-out / ease-out |
| overlap-rest | forbid-at-rest | pass | ease-out / ease-out |
| fade-reversed | absent-at-rest | pass | ease-out / ease-out |
| easing-wrong | easing-mismatch | pass | ease-in / ease-out |

The table asks `inspect motion`'s default statement ("two lines of text printed on top of each other, their letters crossing"). With the claims round's wording ("text overlapping other text so that it is hard to read") instead: broken caught by the expected rule 7/7, intact with a fail 1/7 (covered).

- Presence vs the DOM (target topmost at its centre, opacity > 0.3): 161/168 frames agree.
- Box centre vs the DOM rect's centre, frames both call shown: median 5.0px, p90 12.1px, max 51.5px (n=136).

Presence disagreements:

- clipped--broken.html @400ms: DOM hidden, Jev 0.94
- covered--intact.html @50ms: DOM hidden, Jev 0.70
- covered--broken.html @50ms: DOM hidden, Jev 0.69
- covered--broken.html @150ms: DOM visible, Jev 0.01
- overlap-rest--intact.html @70ms: DOM hidden, Jev 0.66
- overlap-rest--broken.html @70ms: DOM hidden, Jev 0.69
- fade-reversed--broken.html @360ms: DOM hidden, Jev 0.79

Cost: 478 requests, $0.0606 ($0.00433 per page).

Findings per page:

- snap-back--intact.html: none
- snap-back--broken.html: fail snap-back@1200
- keyframe-gap--intact.html: none
- keyframe-gap--broken.html: fail jump@700
- clipped--intact.html: none
- clipped--broken.html: fail absent-at-rest@1100; warn forbid@560
- covered--intact.html: fail forbid@250/300/350/400/450/499/800; warn forbid@450
- covered--broken.html: fail absent-at-rest@800
- overlap-rest--intact.html: warn forbid@140/280
- overlap-rest--broken.html: fail forbid@140/210/280/350/420/490/560/630/699/1000; fail forbid@420/490/560/630/699/1000
- fade-reversed--intact.html: none
- fade-reversed--broken.html: fail absent-at-rest@900
- easing-wrong--intact.html: none
- easing-wrong--broken.html: fail easing-mismatch@0
