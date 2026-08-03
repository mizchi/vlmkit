---
name: agent-validation-loop
description: Improve a developer-facing tool (CLI, library, agent harness) by running closed-loop validation with disposable subagents, treating their friction as the deliverable, fixing the friction, and re-running. Use when the user wants to evaluate or harden a tool whose value depends on whether an agent can use it — vrt-like signal loops, agent SDKs, CLI ergonomics, prompt scaffolding, IDE integrations. The loop produces both a stronger tool and a written record (per-run reports + tracked issues) of what was learned and why.
---

# Agent validation loop

A playbook for improving a tool by letting fresh subagents try to use it
on a real task, recording where they get stuck, fixing the friction,
and running another fresh subagent to confirm. The agents' words become
the spec; their failures become the next commits.

This skill is for cases where the question "does the tool work?" can't
be answered by reading the code or running existing tests — it needs an
agent who has never seen the tool before to try to use it.

## When to use

- A tool whose UX depends on natural-language output an agent will read
  (suggestions, error messages, structured signals).
- A CLI whose ergonomics are easy to mis-design (flag naming, defaults,
  output verbosity).
- A library where you want to know whether the **abstractions** make
  sense to a fresh reader, not whether the code compiles.
- Any system where the gap between "the code works" and "the user
  succeeds" is the actual product.

## When NOT to use

- For pure algorithmic correctness — a unit test is cheaper.
- For one-off scripts with no UX surface.
- When you already know what to fix; the subagent overhead isn't worth
  it for trivial changes.

## The loop, ten steps

### 1. Pick a scenario with a measurable goal

The scenario must be **closed-loop**: the agent has a task with a
deterministic success criterion (a goal screenshot, expected output,
target API response, etc.). Without a measurable outcome the validation
turns into vibes.

```
fixtures/<scenario-name>/
  brief.md              # what the agent should build
  goal/                 # the expected output (artifacts only)
  attempts/             # one subdir per agent run
    agent-a/            # filled by the agent
    agent-b/
```

The brief and goal artifacts are visible to the agent; the **source**
of the goal (the code that produced it) is not.

### 2. Decide what the agent can and cannot read

The single most important rule. Each agent must:

- Read: the brief, the goal artifacts, the tool's CLI / docs.
- NOT read: prior agents' attempts (would bias them), the goal's
  source code (would short-circuit the test).

Put both lists in the prompt explicitly. Mention each forbidden path
by name; agents will respect path-level instructions.

### 3. Spawn the first subagent with a clear charter

```
Subagent prompt structure:
  - Goal in one sentence ("converge on the goal screenshot")
  - Files you may read (brief / goal artifacts / tool docs)
  - Files you MUST NOT read (with concrete paths)
  - Working directory (their own attempts/<name>/ subdir)
  - Workflow (N rounds budget; tool invocation per round; what to log)
  - Constraints (tokens / no-magic / etc.)
  - Deliverables (< 300 words: final metrics + rounds + what worked +
    what didn't + concrete negative feedback)
```

Run via the `Agent` tool with `subagent_type: "general-purpose"` and
`run_in_background: true` so you can do other work while they run.

### 4. Treat the agent's friction as the spec

When the agent returns, their negative feedback is more valuable than
the convergence number. Quotes like:

> "The candidate notation `A → B` looked like 'change from A to B'
> but I had B and wanted A — I went the wrong way for two rounds."

…are exactly the bug. The fix is implemented **from their words**,
not from your imagination of what they meant. File a GitHub issue (or
write a draft markdown) per friction point with the agent's quote
verbatim.

### 5. Commit per-friction-point, not per-batch

One issue, one commit. Commit message includes:

- What the agent said (a one-line quote)
- What was changed
- "closes #N"

This makes the history readable as "what the user complained about and
what we did" rather than "code churn."

### 6. Write a per-run validation report

After each agent run:

```
docs/reports/YYYY-MM-DD-<scenario-name>-vN.md
```

Sections:

- **Question** — what hypothesis is this run testing?
- **Result** — final metrics + comparison table to prior runs.
- **What worked** — direct quotes from the agent confirming what
  helped.
- **What didn't / new gaps** — direct quotes describing friction.
- **What's fixed in this commit vs deferred** — explicit boundary.

The cumulative folder becomes the curriculum the next maintainer
reads to understand "why is the tool shaped this way?"

### 7. Spawn the next agent on the SAME scenario after fixes

Re-running on the same scenario lets you compare apples-to-apples.
Each agent gets the same brief and budget; what changes is the tool.
Convergence-by-version becomes the public metric.

| agent | budget | result | what changed in vlmkit since prior |
|---|---|---|---|
| a | 5 rounds | 10.3% mobile | initial |
| d | 5 rounds | 0.2% mobile | post-#22..#29 |
| f | 3 rounds | 3.45% mobile | post-v6 fixes |

A regression (agent-g got worse than agent-f) is **information**, not
failure — record it honestly.

### 8. Tighten the budget as the tool matures

Start with a generous round budget (e.g. 5). As the tool's signal
quality improves, tighten to 3 rounds. This stress-tests whether the
loop genuinely got tighter or whether you're just giving agents more
chances. The first time agent-3-rounds beats agent-5-rounds-old, you
know the tool's signal quality has materially improved.

### 9. Stop when diminishing returns are visible

Signs the loop has converged:

- Each new agent run surfaces fewer new gaps than the last.
- The remaining variance is **agent-side initial-state**, not tool
  signal quality. ("Agent picked the wrong initial structure" is not
  something the tool can fix.)
- Per-fix commit size is shrinking — small annotations rather than
  new affordances.
- You're tempted to write tests for hypothetical cases instead of
  observed ones.

Stop, write a release-prep commit summarizing what landed (CHANGELOG +
README), and merge.

### 10. Capture the learning

After merge:

- A CHANGELOG entry per branch that lists every closed issue with a
  one-line cause.
- A docs/reports/ index card listing every validation run.
- A skill file (like this one) if the loop is generalizable to other
  projects.

## File and branch conventions

- **Branch**: `claude/<scenario-slug>-<YYYY-MM-DD>`. All loop work on
  one branch until release-prep.
- **Reports**: `docs/reports/YYYY-MM-DD-<scenario>-v<N>.md`. Versioned
  monotonically per scenario.
- **Issue drafts**: `docs/issues-drafts/<NN>-<topic>.md` when GitHub is
  unavailable; post when MCP / `gh` becomes available.
- **Scenario fixture**: `fixtures/<scenario>/{brief.md, goal/, attempts/<agent>/}`.
- **Agent letters**: a, b, c, … sequential. Letters are cheap;
  numbering by date is hard to read at-a-glance.

## Subagent prompt template

```
You are evaluating whether <TOOL> gives an agent enough signal to do
<TASK>. The friction you find is the deliverable.

# Your task
<one paragraph>

# Files you may read
- <brief>
- <goal artifacts>
- <tool docs>

# Files you MUST NOT read
- <goal source>
- <prior agents' attempts: explicit paths>

# Your working directory
<attempts/<your-letter>/>

# Workflow
Budget: N rounds. Each round:
1. Edit <output files>
2. Run <tool invocation>
3. Read output for <signals> in priority order: ...
4. Log to <attempts/<your-letter>/log.md>
5. Stop when <success criterion> or budget exhausted

# Constraints
<concrete rules: tokens-only, no peeking, media queries for divergent
deltas, etc.>

# Deliverables (< 300 words)
1. Final metrics
2. Rounds used, one-line per round
3. What helped — concrete quote-style example
4. What didn't help or was missing — be specific
5. Versus <prior agent>: better / same / worse + why
```

## Validation report template

```markdown
# <Scenario> v<N>: <one-line hypothesis> (<date>)

## Question

<what is this run testing?>

## Result

| viewport / metric | prior | this run | delta |
|---|---|---|---|
| ... |

<one-sentence honest read>

## What worked — <agent>'s own words

> "<verbatim quote>"

<short interpretation>

## What didn't / new gaps

### <Gap1> — <one-line summary>

> "<verbatim quote>"

<root cause analysis>

**Fixed in this commit:** <description>

### <Gap2> — <deferred>

> "<verbatim quote>"

<why it's deferred, what would be needed>

## Files

- <fixture paths>
- <source files changed>
```

## Anti-patterns

### Don't write the fix before reading the agent's words

Tempting to predict what the agent will say. Resist. When you read
their actual quote, the fix is usually different (and smaller) than
what you would have written.

### Don't suppress negative results

If agent-g converges WORSE than agent-f, that's data. Hiding it as
"agent picked wrong initial structure" without noting the friction
the new affordance caused (or didn't catch) loses the signal that
makes the loop valuable.

### Don't fix multiple agents' findings in one commit

Each fix should map to a specific agent's complaint. Bundling makes
the commit history harder to read and obscures what was learned where.

### Don't skip the prompt's "MUST NOT" list

Agents that read prior attempts converge faster but you learn
nothing — they're memorizing, not using the tool.

### Don't grade on the diff metric alone

A regression that surfaces a real gap (G7c: cross-suggestion overshoot
aggregation) is more valuable than a clean run that surfaces nothing.

### Don't run the same agent prompt verbatim across versions

Update the prompt to mention the new affordances. Otherwise the agent
won't know they exist. ("As of this version, `[STRUCTURAL]` now names
the specific parent property...") A fresh agent on an unchanged prompt
won't read the source to discover new tags.

### Don't ship without per-run reports

The reports ARE the spec for the next round. Skipping them means the
fix's rationale lives only in commit messages and you lose the
narrative arc.

## Honest stopping criteria

After 7-9 agent runs you'll see:

- Average improvement per fix < 1pp.
- New surfaced gaps are increasingly specific edge cases.
- Agent-side initial state explains > 50% of variance.
- The tool's signal hierarchy hasn't gained a new tag in 2 runs.

This is the moment to:

1. Tighten the CHANGELOG.
2. Stop the loop.
3. Decide whether the next investment is on this tool (e.g. faster
   iteration) or on adjacent surfaces.

## Reference run

This skill was distilled from the
`claude/design-md-scenario-2026-05-15` branch on `mizchi/vrt`:

- 9 agent runs (a → i) on a single DESIGN.md → HTML/CSS reproduction
  scenario.
- 18 GitHub issues filed and closed (#22 – #36) + 3 drafts shipped as
  CLIs (`vlmkit manifest` / `vlmkit watch` / `vlmkit diff-pr`).
- Closed-loop floor moved from 10.3% → 0.2% (5-round budget) and to
  3.45% (3-round budget).
- 38 commits, 183 tests across 32 suites.
- Validation reports under `docs/reports/2026-05-15-design-md-scenario-v{1..9}.md`.

The story arc: each report quoted the agent's friction in their own
words; the next commit implemented the fix from that language; the
next agent confirmed (or revealed a new gap). Stopping signal was
agent-g regressing on a class of bug (typographic cascade) that the
existing signal hierarchy couldn't classify — the new REFLOW tag
closed it, and post-REFLOW runs (h, i) converged within
the budget.
