# d2-scenario — subagent evaluation fixture for the `d2-diagram` skill

Closed-loop validation of the `d2-diagram` skill (see
`.claude/skills/agent-validation-loop`). A fresh subagent gets ONLY a brief from
`briefs/` and `.claude/skills/d2-diagram/SKILL.md`, writes a `.d2`, and renders
it with TALA until it believes the picture is right. What it stumbles on is the
deliverable.

- `briefs/<name>.md` — the task: a system described in prose and nowhere else in
  this repository, what the diagram has to show, a width budget for the terminal
  render, and the deliverables.
- `briefs/facts/<name>.expect.json` — **the scorer's truth, not given to
  writers.** D2 has no `--expect`: nothing in the toolchain checks a diagram
  against what it is supposed to say. So the round scores each attempt by hand
  against this sheet, and the error rate on attempts the writer itself called
  done is the round's main number. (This mirrors v13 → v14 of `anim-ir`, where
  five green module maps included two that were wrong and the answer was a fact
  sheet the tool could read.)
- `attempts/<agent>/` — one directory per run: the `.d2`, the renders, `log.md`,
  and the agent's deliverable. Prior attempts and the fact sheets are off-limits
  to later writers.

v1 (2026-09-14) is the first round, on the skill as merged in
[#148](https://github.com/mizchi/vlmkit/pull/148): three briefs —
`order-events` (an eleven-box architecture in three regions, a broker fan-out
that must not read as a chain, ≤ 100 columns for a README),
`shop-schema` (five `sql_table` shapes, four column-level foreign keys, no
invented relationship) and `checkout-calls` (a `sequence_diagram` of seven
messages with returns and one async, ≤ 80 columns for a PR comment). Writers
`a`–`d`, two model sizes on `order-events`.

Metrics per run: whether the writer's own done-condition was met, the fact
errors the scorer finds afterwards (missing box, missing edge, invented edge,
reversed edge, wrong region, wrong message order), rounds used, the widest line
each round, and the writer's own words on what the skill told it and what it had
to guess.

v1 result: all four writers met their own done condition; three diagrams were
factually correct (0 errors, 75 / 76 / 75 columns) and the fourth — the smaller
model, on the same brief as `a` — contained **four phantom duplicate boxes**, two
orphans and the system's entry call drawn as a floating pair, while its log said
"can trace all connections". The cause is D2's scoping rule: a reference to an id
that is not in scope creates a new shape rather than failing. The round's output
is `.claude/skills/d2-diagram/assets/d2-facts.mjs` — it reads the drawn boxes and
arrows back out of the SVG and holds them to a sheet, which is the format these
fact sheets are written in — plus six measured corrections to the skill (the
width measurement, the non-monotone width levers, seeds, the dropped connection
styles, `foreign_key`, the TALA version claim).

Scoring one attempt, for reference:

```sh
node .claude/skills/d2-diagram/assets/d2-facts.mjs \
  fixtures/d2-scenario/attempts/d/order-events.d2 \
  --expect fixtures/d2-scenario/briefs/facts/order-events.expect.json
```

Reports: `docs/reports/2026-09-14-d2-diagram-v1.md`.
