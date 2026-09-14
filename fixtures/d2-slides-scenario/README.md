# d2-slides scenario

The `d2-slides` skill is judged on one thing: **a fresh agent, given one brief
and `SKILL.md` alone, produces a deck that passes the page gates and still says
what the brief asked for.** Not "the builder runs" — that is
`tests/d2-slides.test.mjs`'s job.

Procedure is the `agent-validation-loop` skill. Each writer gets one brief, the
`d2-slides` skill file (and `d2-diagram`, which it routes figure problems to),
and nothing else: the builder source, the worked example under
`examples/d2-slides/`, the tests, the workflow, the reports and other attempts
are forbidden by path in the prompt. A writer who reads the builder is
measuring their own reading, not the skill.

## Briefs

| brief | what it stresses |
|---|---|
| `briefs/tala-talk.md` | the core path: 7 slides, 3 figures, required phrases, all four gates |
| `briefs/vrt-gate-ja.md` | the same in Japanese — the skill claims CJK is fine in SVG |
| `briefs/checkout-reedit.md` | re-editing somebody else's deck (`reedit/deck.md`): two figures change, a slide is added, the closing quote is now wrong |

Every brief carries its own **required content** list (strings that must appear
in the built `copy.txt`) beside the gate runs. A deck that is green and lost
half the brief is the failure mode a green check cannot see — the same lesson
`fixtures/anim-scenario/` learned in its round 13.

## Rounds

| round | writers | report |
|---|---|---|
| v1 | `a` (sonnet, tala-talk), `b` (haiku, tala-talk), `c` (sonnet, ja), `d` (sonnet, re-edit) | `docs/reports/2026-09-14-d2-slides-v1.md` |

## Attempts

`attempts/<letter>/` holds that writer's `deck.md`, its build, and `log.md`
(one line per round, including the line of output that made them change what
they changed).
