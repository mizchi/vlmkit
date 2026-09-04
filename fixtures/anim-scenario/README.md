# anim-scenario — subagent evaluation fixture for `vlmkit-anim`

Closed-loop validation of the explanatory-animation IR (see
`.claude/skills/agent-validation-loop`). A fresh subagent gets ONLY a brief
from `briefs/` and `docs/anim-ir.md`, writes a scene, and runs
`vlmkit-anim check` until green. What it stumbles on is the deliverable.

- `briefs/<name>.md` — the task. Each names a deterministic success criterion
  (`check` exit 0 + a semantic condition the checker can read back).
- `attempts/<agent>/` — one directory per run: the scene(s), `log.md`, and the
  agent's deliverable. Prior attempts are off-limits to later agents.
- `re-edit/` — a second-phase task: an existing scene plus a change request,
  measuring whether intent is readable enough to edit in one round.
  `README.md` + `replication.scene.json` is the v2 variant (absolute event
  times, kept frozen because two agents' failures are recorded against it);
  `README-v3.md` + `replication-after.scene.json` is the same story written
  with `after` anchors, used from v3 on. `README-v4-sequential.md` and
  `README-v4-causal.md` + `replication-causal.scene.json` are v4's two arms
  (same change request, explicit "ok must not wait" criterion) that decided
  the timing default.

v5 (2026-09-04) added briefs for the three kinds that landed that day —
`matrix-knapsack`, `graph-friend-of-friend` (explicit ops),
`graph-build-critical-path` (directed Dijkstra, pinned nodes),
`chart-deploy-frequency` — run by agents `t`–`w`.

v6 re-edited one frozen scene per new kind (`README-v6-*.md`, agents `x`–`z`).
v7 added `array` and `tree`: briefs `array-partition`, `tree-bst-lesson`
and re-edit tasks `README-v7-{array,tree}.md` (agents `aa`–`ad`).
v8 added `stack`, `queue` and `list`: briefs `stack-postfix`, `queue-bfs-frontier`,
`list-lru`, and re-edit tasks `README-v8-{list,vector}.md` — the `vector` one is
the first re-edit of that kind (agents `ba`–`be`).

Metrics per run: first-attempt error count, rounds to green, scene bytes,
semantic verdict, and the agent's own words on what helped / what was missing.
Reports: `docs/reports/2026-09-04-anim-ir-v*.md`.
