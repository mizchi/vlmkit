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
| v2 | `e` (sonnet, tala-talk + two fact sheets), `f` (sonnet, re-edit + shared sheet and `--forbid`) | `docs/reports/2026-09-14-d2-slides-v2.md` |
| v3 | **readers**, not writers: `r1`–`r4` shown only PNGs of one arm each | `docs/reports/2026-09-16-d2-slides-v3.md` |

v2 answered v1's open question: `f`'s figure passed all four page gates and
failed the shared sheet (`✗ forbidden edge drawn: checkout->orders`). It also
found a builder bug that had silently hit **both** v2 writers — a bullet wrapped
over two lines became a paragraph, which renders before the list, so the second
half of a sentence appeared above its own bullet. `e` caught it by grepping its
own `copy.txt`; `f` shipped it. Both are fixed; the decks under `attempts/` are
as delivered, so `e`'s and `f`'s builds still show the pre-fix behaviour.

v3 changed the instrument. Writers have been green on the first write since v2,
so the round asked the question v2's report left open — can a reader catch what
the gates cannot — by rendering **one** deck twice and showing four readers one
arm each, blind. Both readers of the deck as delivered scored fidelity 0.70 and
had its split named; both readers of the rebuilt deck scored 1.00 with nothing
to report. Details and the frozen readings: `v3/`.

## Attempts

`attempts/<letter>/` holds that writer's `deck.md`, its build, and `log.md`
(one line per round, including the line of output that made them change what
they changed).
