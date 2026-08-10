# Dogfood scenario — release-notes page (2026-08-10)

Closed-loop scenario for the `agent-validation-loop` skill, built to test this
session's work with agents who have never seen it: the base-URL navigation fixes,
`check animation`'s reduced-motion detection, and the strip/webp outputs.

**Every defect's cause lives in `page/theme.css`, never in `page/index.html`.** That
is the point — a gate that loads the markup without resolving the stylesheet
measures a different document and reports the page clean. Same construction as
`fixtures/external-assets/`, one level up: here the defects have to be *found from a
user complaint*, not from a list.

| Reported as | Actually | Gate that should catch it |
|---|---|---|
| "the toolbar jumps around when I tab" | `#publish` at x=660, `#save` at x=20, `#discard` at x=340 against DOM order publish/save/discard | `check a11y focus` — `reverse` |
| "the page still moves when I turn motion off" | `.card { animation: rise 250ms }` with no `prefers-reduced-motion` rule anywhere | `check animation` — `reduced-motion-ignored` |
| "one card doesn't match the others" | `.card--featured { padding: 30px }` against `.card`'s 16px | `check drift component --selector .card` |
| "never holds still long enough to screenshot" | `.spinner { animation: spin 900ms linear infinite }` | `check animation` — `infinite-animation` |

The 250ms entrance animation is the interesting one: it is shorter than the page-load
settle, so before 2026-08-10 the reduced-motion check could not see it at all and this
page passed.

Success criterion for an attempt: `check animation`, `check a11y focus` and
`check drift component --selector .card` all exit 0 on the attempt's copy, with
`check integrity` still CLEAN and the brief's constraints intact.

`attempts/<letter>/` holds each agent's copy and log. Reports live in
`docs/reports/2026-08-10-dogfood-animation-v*.md`.
