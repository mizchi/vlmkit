# Dogfood v7: re-evaluate the three existing scenarios (2026-08-13)

## Question

v6 recorded seven findings and all seven were fixed the next day. The fixes were
written from the agent's words, verified with unit tests, and verified by hand on
the pages the words came from. None of that answers the question this round asks:

**do the recorded findings still fail to reproduce on the scenarios that produced
them, and does the tool feel different to an agent who has never seen it?**

No new scenario. Three existing ones, re-run:

| scenario | prior runs | what it exercises now |
|---|---|---|
| `dogfood-animation-2026-08-10` | v1–v4, agents a–h | regression check: v4 closed all six of its gaps in v4 itself |
| `dogfood-dataviz-2026-08-11` | v5, agents i–j | the coverage line, `--allow`, `webServer` on a page whose `/api/live` never closes |
| `dogfood-adoption-2026-08-12` | v6, agent-k | all seven v6 fixes, in the triage posture that produced them |

## Part 1 — deterministic pass (no agents)

Cheapest first, and the honest order: before spending agents on a tool, check that
the fixes hold on the pages the complaints came from.

### The seven v6 findings, re-measured on the v6 console

| v6 finding | then | now |
|---|---|---|
| 1. eight findings for three CSS colours | 8 rows | **3 rows**, and `check a11y contrast` also reports 3 — exact parity, which was the complaint |
| 2. demoting a rule demoted nothing visible | `!` + `DRIFT` under `=info` | `verdict: … 0 warn, 3 info`, rows carry `i`, `re-tuned:` still printed |
| 3. `--min-reuse` could not reach the case | no expressible fix | `--allow "button#export;…"` → `COHERENT`, `allowed: 1 button instance(s)` |
| 4. the repo was dirtied silently | nothing announced | announced on first write — **but see Part 1b, this was only half true** |
| 5. no `webServer` | HAR workaround | one committed config starts the console, runs both gates, stops it |
| 6. `skipped: 28` uninterpretable | bare count | `coverage: 4 of 32 …` + `no role: td x12, th x4, tr x4, p x2, …` |
| 7. `rules` had no `reason`/`expires` | comment key only | long form parses, appears in `gates suppressions` tagged `[rule]` |

The v6 page's three greys are `#9a9a9a` (2.81:1), `#8d8d8d` (3.32:1) and `#a0a0a0`
(2.61:1); the three table rows that used to be three separate findings are now one
row reporting `3 element(s)`. Finding 6's numbers match the report exactly — the same
28 skipped, now reported as a fraction of 32 considered.

### Part 1b — the fix for finding 4 did not cover the path it was for

Re-running the scenario the way the scenario asks — one committed config, one
command — produced `.vlmkit/run-ledger.jsonl` in the working directory and said
**nothing about it**. Which is finding 4, verbatim, after finding 4 was fixed.

The cause is that the first-write notice is printed by the gate, and under
`gates run` each gate is a **child process whose stdout the batch runner
suppresses**. So the notice works when a gate is run by hand and is invisible on
the path an adopting project actually uses — the path the config exists to create.

It also never covered `test-results/` at all: a gate prints `report: <path>` for
what it wrote, but nothing said that directory was new and untracked, and that was
half of what v6's agent found with `ls`.

**Fixed** (`2892b5b`) on the batch summary, where both halves are visible and the
report is once per run rather than once per gate:

```
This run created 2 untracked path(s):
    .vlmkit/        an append-only record of every gate run, one line each
    test-results/   the gates' own reports and screenshots
Neither is in .gitignore. `vlmkit gates init` writes those entries for you.
```

Reported only for paths *this* run brought into existence — existence is snapshotted
before the jobs start — so a project that has seen it once does not get it again.

One bug of my own caught in review of that message: the single-path branch read
`It is in .gitignore.`, the opposite of the truth, in the one line whose whole job
is to say the path is untracked. Both branches are now asserted in tests.

### The animation scenario — regression check only

All four planted defects still reproduce on today's build: `page-overflow-x` (46px
at 768px, blamed on `#publish`), focus `[reverse]`, `reduced-motion-ignored` (5
animations still running), `infinite-animation` (`settle: never`). v4's six gaps
were all fixed within v4, so this scenario has no outstanding recorded finding —
which is what v4 concluded when it recommended a different page over a tighter
budget. Nothing shipped since has regressed it.

## Part 2 — fresh agents on the same scenarios

<!-- agent-l (adoption), agent-m (dataviz) — pending -->

## Files

- `fixtures/dogfood-{animation-2026-08-10,dataviz-2026-08-11,adoption-2026-08-12}/`
- `src/cli/commands/batch-cli.ts`, `src/cli/commands/batch-cli.test.ts`
