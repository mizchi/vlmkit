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

**That criterion is not fully satisfiable, and the flaw is the scenario's, not the
tool's.** The brief requires `.card--featured` to stay visually distinguishable; since
2026-08-10 `check drift component` judges drift from the computed style, so a
distinguishable variant *is* a style difference and `--selector .card` cannot pass. Two
attempts hit it — one reported "It also flags `.card--featured` at 95.87%, which the
brief *requires* to look different", the other got past it by moving the accent into a
property the gate did not then track, which is what put `outline-*` on the tracked list.

The tool's answer is to point the gate at the instances that are meant to match:

```
vlmkit check drift component page/index.html --selector ".card:not(.card--featured)"
# → ~ instance #1  3.37%  every property on the instance root matches …   exit 0
```

Later runs are scored on the other three gates plus that narrowed selector. The
`--selector .card` form is kept in the criterion above as the record of what two agents
were held to.

`attempts/<letter>/` holds each agent's copy and log. Reports live in
`docs/reports/2026-08-10-dogfood-animation-v*.md`.
