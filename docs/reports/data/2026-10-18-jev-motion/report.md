14 pages (7 broken, 7 intact). Broken caught by the expected rule 7/7 (any fail 7/7); intact passed 7/7.

| case | expected | inspect motion: broken | intact | easing fit (broken / intact) | gates on broken: check animation · integrity --timeline | gates on intact |
|---|---|---|---|---|---|---|
| snap-back | snap-back | snap-back | pass | ease-in-out (7.8x) / ease-in-out (22.2x) | 0 · 1 page-overflow-x | 0 · 1 page-overflow-x |
| keyframe-gap | jump | jump | pass | linear (1.0x) / linear (14.5x) | 0 · 1 page-overflow-x | 0 · 1 page-overflow-x |
| clipped | absent-at-rest | absent-at-rest | pass | ease-in (5.4x) / ease-in-out (14.0x) | 0 · 0 clipped-content | 0 · 1 page-overflow-x |
| covered | absent-at-rest | absent-at-rest | pass | skipped / ease-out (1.1x) | 0 · 1 container-protrusion,occluded-text | 0 · 1 container-protrusion |
| overlap-rest | forbid-at-rest | forbid-at-rest | pass | ease-out (17.5x) / ease-out (38.1x) | 0 · 1 container-protrusion,text-collision | 0 · 1 container-protrusion |
| fade-reversed | absent-at-rest | absent-at-rest | pass | skipped / skipped | 0 · 0 | 0 · 0 |
| easing-wrong | easing-mismatch | easing-mismatch | pass | ease-in (108.6x) / ease-out (13.2x) | 0 · 1 page-overflow-x | 0 · 1 page-overflow-x |

The table asks `inspect motion`'s default statement ("two lines of text printed on top of each other, their letters crossing"). With the claims round's wording ("text overlapping other text so that it is hard to read") instead: broken caught by the expected rule 7/7, intact with a fail 1/7 (covered).

- Presence vs the DOM (target topmost at its centre, opacity > 0.3): 161/168 frames agree.
- Box centre vs the DOM rect's centre, frames both call shown: median 5.2px, p90 10.5px, max 48.4px (n=136).

Presence disagreements:

- clipped--broken.html @400ms: DOM hidden, Jev 0.93
- covered--intact.html @50ms: DOM hidden, Jev 0.77
- covered--broken.html @50ms: DOM hidden, Jev 0.76
- covered--broken.html @150ms: DOM visible, Jev 0.01
- overlap-rest--intact.html @70ms: DOM hidden, Jev 0.69
- overlap-rest--broken.html @70ms: DOM hidden, Jev 0.66
- fade-reversed--broken.html @360ms: DOM hidden, Jev 0.82

Cost: 310 requests, $0.0392 ($0.00280 per page).

Findings per page:

- snap-back--intact.html: none
- snap-back--broken.html: fail snap-back@1200
- keyframe-gap--intact.html: none
- keyframe-gap--broken.html: fail jump@700
- clipped--intact.html: none
- clipped--broken.html: fail absent-at-rest@1100; warn forbid@560
- covered--intact.html: fail forbid@250/300/350/400/450/499/800
- covered--broken.html: fail absent-at-rest@800
- overlap-rest--intact.html: warn forbid@140/280
- overlap-rest--broken.html: fail forbid@140/280/350/420/490/560/630/699/1000; fail forbid@420/490/560/630/699/1000
- fade-reversed--intact.html: none
- fade-reversed--broken.html: fail absent-at-rest@900
- easing-wrong--intact.html: none
- easing-wrong--broken.html: fail easing-mismatch@0
