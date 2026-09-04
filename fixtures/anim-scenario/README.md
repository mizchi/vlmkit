# anim-scenario — subagent evaluation fixture for `vlmkit anim`

Closed-loop validation of the explanatory-animation IR (see
`.claude/skills/agent-validation-loop`). A fresh subagent gets ONLY a brief
from `briefs/` and `docs/anim-ir.md`, writes a scene, and runs
`vlmkit anim check` until green. What it stumbles on is the deliverable.

- `briefs/<name>.md` — the task. Each names a deterministic success criterion
  (`check` exit 0 + a semantic condition the checker can read back).
- `attempts/<agent>/` — one directory per run: the scene(s), `log.md`, and the
  agent's deliverable. Prior attempts are off-limits to later agents.
- `re-edit/` — a second-phase task: an existing scene plus a change request,
  measuring whether intent is readable enough to edit in one round.
  `README.md` + `replication.scene.json` is the v2 variant (absolute event
  times, kept frozen because two agents' failures are recorded against it);
  `README-v3.md` + `replication-after.scene.json` is the same story written
  with `after` anchors, used from v3 on.

Metrics per run: first-attempt error count, rounds to green, scene bytes,
semantic verdict, and the agent's own words on what helped / what was missing.
Reports: `docs/reports/2026-09-04-anim-ir-v*.md`.
