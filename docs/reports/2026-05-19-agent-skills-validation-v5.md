# Agent skills validation v5: cross-skill routing (2026-05-19)

## Question

Per-skill validation finished in v4 (loop declared converged). v5
asks a different question: **given all five SKILL.md files
available, can a fresh agent route a scenario to the right one
based on descriptions alone?** Two scenarios, two parallel
subagents, no "you must use skill X" hint.

## Setup

| Subagent | Scenario | Right answer |
|---|---|---|
| F | "Diff two HTML files, single CSS edit, no CI loop." | `vrt-visual-diff` |
| G | "Target PNG + blank HTML scaffold; want pixel signal per round." | `vrt-markup-synth` (build component) |

All five skills readable. Forbidden: fixture source, internals,
`.claude/CLAUDE.md`, `docs/reports/` (to avoid bias from past
runs).

## Result

| Subagent | Pick | Correct? | Friction surfaced |
|---|---|---|---|
| F | `vrt-visual-diff` | ✓ | 1 minor description over-claim + 1 deferred |
| G | `vrt-markup-synth` (build component) | ✓ | 2 minor doc bugs on the build-component sub-tool |

**Both subagents routed correctly with high confidence.** Each
named the sibling skills it had considered and rejected, with the
verbatim "When NOT to use" / precondition-gate line that
disqualified each. This is the strongest evidence so far that the
skill descriptions carry the routing weight.

## What worked

### F: every sibling was disqualified by name

> "vrt-migration-eval precondition gate: 'Before running, name the
> migration: \<from-stack\> → \<to-stack\>. … If you cannot fill in
> both sides … this is the wrong skill — stop and use
> vrt-visual-diff instead.' Scenario says 'not a framework swap' —
> gate fails."
> 
> "vrt-regression-watch 'When NOT to use': 'One-shot diff with no
> history: vrt-visual-diff.' Scenario says 'no CI loop required.'"
> 
> "vrt-css-fix-loop 'When NOT to use': 'Bulk regression triage: use
> vrt-visual-diff for one-shot reads.' Plus its fixture-bound
> precondition."
> 
> "vrt-markup-synth 'When NOT to use': 'Comparing two existing pages:
> vrt-visual-diff.'"
>     — subagent F

The v1 migration precondition gate (`9597aec`) and the cross-skill
"When NOT to use" pointers in every sibling each carried real
routing weight here. No skill needed to be re-read past its
opening few sections.

### G: image+scaffold was unambiguous

> "Recognizability: yes — 'screenshot + HTML scaffold' in the
> description was unambiguous. Nothing tried to steal me away."
>     — subagent G

vrt-visual-diff was the natural foil (both touch pixel diff), but
its description rules itself out:

> "vrt-visual-diff is the obvious foil … its description rules
> itself out: 'Compare two rendered pages (URL pairs or local
> HTML)' and 'agent just made a UI change and needs to know whether
> it altered visible output.' It assumes two pages exist, not 'an
> image plus an empty scaffold.' The cross-reference 'Component
> synthesis from screenshots: use vrt-markup-synth' sealed it."
>     — subagent G

## What didn't / new gaps

### Gap K — `vrt-visual-diff` description over-claims fix candidates (F)

> "vrt-visual-diff's description says 'heuristic fix candidates —
> `selector { property: a → b }` hints'. The actual report's 'Fix
> Candidates' row read 'after no suggestions', while heuristic Δtop
> suggestions appeared earlier as 'Wireframe fix suggestions'
> instead. Description names a section header that does not match
> the output verbatim."
>     — subagent F

**Fixed in `d1af6f7`** — appended a half-sentence noting the row may
read `no suggestions` and that wireframe-level Δtop suggestions
appear earlier in the report.

### Gap L — `build component` `--output` flag is ignored (G)

> "I passed `--output /tmp/vrt-skill-eval-g/report.md`; the tool
> still wrote to `test-results/component/report.md` […] That flag
> silently doesn't honor a file path. Mildly misleading."
>     — subagent G

The skill's Quickstart wrote `vrt build component design.png
current.html --output report.md` — that's a lie.

**Fixed in `56ec3fd`** — Quickstart drops the `--output` argument;
sub-tools table now states the fixed output path
(`test-results/component/report.md`) explicitly.

### Gap M — `build component` legacy banner (G)

The v4 fix added a `vrt design-tokens` legacy-banner caveat for
`check tokens` but missed the parallel case for `build component`
(banner prints `vrt component-from-image`).

> "stdout banner says `vrt component-from-image` while I typed
> `vrt build component`. The skill warns about this only for
> `check tokens` […] same gotcha applies to `build component` but
> isn't documented."
>     — subagent G

**Fixed in `56ec3fd`** (same commit as Gap L) — sub-tools table's
build-component row gains the same `vrt component-from-image`
caveat structure.

### Gap N — `migration-report.json` filename leak (F minor, deferred)

> "`--output` writes `migration-report.json` even on the
> non-migration path. The skill calls this out … but the filename
> still feels like a leak from `vrt-migration-eval`."
>     — subagent F

Deferred — this is a vrt-internal naming choice (the diff-html and
migration-compare paths share the same writer). Renaming requires
changes to the engine + tests + callers. Out of scope for skill PRs.

## Stop signs revisited (post-v5)

v5 didn't void the v4 stopping decision. All three signs still
hold, and v5 added the cross-skill-routing data point: **descriptions
work as a routing layer**, not just as per-skill ergonomics.

- ✓ Gaps per round: v1=4, v2=4, v3=3, v4=2, **v5=3 minor (1 deferred)**.
- ✓ Per-fix commit size: 3-4 lines each in v5.
- ✓ Remaining variance is description-decoration / vrt-internal
  naming, not skill capacity.

## Cumulative tally (5 rounds)

| Round | Agents | Bugs | Fixes |
|---|---|---|---|
| v1 | A, B | 0 | 4 |
| v2 | A2, C | 1 | 4 |
| v3 | C2, D, E | 2 | 3 |
| v4 | D2, E2 | 0 | 2 |
| v5 | F, G | 0 | 2 (1 deferred) |
| **Total** | **11 agent runs** | **3** | **15** |

## Lessons added

5. **Cross-skill routing depends on every sibling's "When NOT to
   use" pointing back to the right one.** v5 showed this in
   action: F's pick was clean because *all four* siblings had a
   verbatim quote that disqualified them. Skill ecosystems need
   to maintain this graph of cross-references — a missing arrow
   in one skill makes selection fragile.

6. **Caveats about CLI legacy names need to be systematic, not
   case-by-case.** v4 added the caveat for `check tokens`; v5
   surfaced the same need for `build component`. Future
   subcommand additions: scan for banner-name vs invoked-name
   mismatches first.

## Files

- Skills modified: `.claude/skills/vrt-markup-synth/`,
  `.claude/skills/vrt-visual-diff/`.
- Fixtures used: `fixtures/element-compare/{before,after}.html` (F),
  `fixtures/wireframe/pricing-card/{target-desktop.png,blank.html}` (G).
- Commits on `feat/agent-skills`: `56ec3fd`, `d1af6f7`.
