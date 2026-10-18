14 pages (7 broken, 7 intact). Broken caught by the expected rule 7/7 (any fail 7/7); intact passed 6/7.

| case | expected | inspect motion: broken | intact | easing fit (broken / intact) | gates on broken: check animation · integrity --timeline | gates on intact |
|---|---|---|---|---|---|---|
| snap-back | snap-back | snap-back | pass | ease-in-out (43.3x) / ease-in-out (48.0x) | 0 · 1 page-overflow-x | 0 · 1 page-overflow-x |
| keyframe-gap | jump | jump | pass | ease-in (1.0x) / linear (14.9x) | 0 · 1 page-overflow-x | 0 · 1 page-overflow-x |
| clipped | absent-at-rest | absent-at-rest | pass | ease-in (5.6x) / ease-in-out (65.9x) | 0 · 0 clipped-content | 0 · 1 page-overflow-x |
| covered | absent-at-rest | absent-at-rest | forbid-at-rest | skipped / ease-out (1.5x) | 0 · 1 container-protrusion,occluded-text | 0 · 1 container-protrusion |
| overlap-rest | forbid-at-rest | forbid-at-rest | pass | ease-out (7.3x) / ease-out (7.5x) | 0 · 1 container-protrusion,text-collision | 0 · 1 container-protrusion |
| fade-reversed | absent-at-rest | absent-at-rest | pass | skipped / skipped | 0 · 0 | 0 · 0 |
| easing-wrong | easing-mismatch | easing-mismatch | pass | ease-in (70.6x) / ease-out (89.1x) | 0 · 1 page-overflow-x | 0 · 1 page-overflow-x |

With the narrower overlap wording ("two lines of text printed on top of each other, their letters crossing") in place of the measured one: broken caught by the expected rule 7/7, intact with a fail 0/7.

- Presence vs the DOM (target topmost at its centre, opacity > 0.3): 161/168 frames agree.
- Box centre vs the DOM rect's centre, frames both call shown: median 7.4px, p90 14.4px, max 40.2px (n=136).

Presence disagreements:

- clipped--broken.html @400ms: DOM hidden, Jev 0.95
- covered--intact.html @50ms: DOM hidden, Jev 0.77
- covered--broken.html @50ms: DOM hidden, Jev 0.73
- covered--broken.html @150ms: DOM visible, Jev 0.01
- overlap-rest--intact.html @70ms: DOM hidden, Jev 0.64
- overlap-rest--broken.html @70ms: DOM hidden, Jev 0.63
- fade-reversed--broken.html @360ms: DOM hidden, Jev 0.83

Cost: 168 requests, $0.0214 ($0.00153 per page).

Findings per page:

- snap-back--intact.html: none
- snap-back--broken.html: fail snap-back@1200
- keyframe-gap--intact.html: none
- keyframe-gap--broken.html: fail jump@700
- clipped--intact.html: none
- clipped--broken.html: fail absent-at-rest@1100
- covered--intact.html: fail forbid@250/300/350/400/450/499/800; warn forbid@450
- covered--broken.html: fail absent-at-rest@800
- overlap-rest--intact.html: warn forbid@140/280
- overlap-rest--broken.html: fail forbid@140/280/350/420/490/560/630/699/1000; fail forbid@420/490/560/630/699/1000
- fade-reversed--intact.html: none
- fade-reversed--broken.html: fail absent-at-rest@900
- easing-wrong--intact.html: none
- easing-wrong--broken.html: fail easing-mismatch@0
