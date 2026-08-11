# Dogfood v4: has the loop converged? (2026-08-10)

## Question

Four rounds in, the interesting question stopped being "what is broken" and became
"is the friction still the tool's, or is it the scenario's?" v4 tightened once more —
repair 3 → **2** rounds, evidence 2 → **1** — and put `--allow`, shipped at the end of
v3, in front of an agent that had never been told it exists.

Same MUST-NOT list throughout: no source, no git history, no `docs/reports/`, no
scenario README, no other agents' attempts.

## Result

| | v1 | v2 | v3 | v4 |
|---|---|---|---|---|
| Evidence: rounds | 4 of 4 | 3 of 3 | 1 of 2 | **1 of 1** |
| Evidence: flags guessed wrong | several | some | some | **none** |
| Evidence: documents the real page | **no** | yes | yes | yes |
| Evidence: artifact | 1496x484, 31.8 KB | 1496x484, 25.8 KB | 1496x365, 22.4 KB | 1496x365, **22.4 KB** |
| Evidence: had to compute the window by hand | — | yes (380) | yes (370) | **no** (auto 370) |
| Repair: rounds | 3 of 5 | 3 of 4 | 3 of 3 | **2 of 2** |
| Repair: gates green | 3 of 4 | 4 of 4 | 4 of 4 | 4 of 4 |
| Repair: rounds spent editing files | 3 | 3 | 3 | **1** |
| New gaps: wrong output | 3 | 2 | 3 | **0** |
| New gaps: unhelpful output | 2 | 3 | 2 | 6 |

**The wrong-output column reached zero.** Every finding in v4 is about how a correct
measurement is presented — no gate measured the wrong thing, named the wrong element, or
drew the wrong animation. That is the first round of which that is true.

Verified independently, as in every round: agent-h's artifact is 22954 bytes, VP8L, window
370ms, columns 62/123/185/247/308/370ms. agent-g's two `--allow` declarations do take the
drift gate from exit 1 to exit 0 on its fixed page, and the failing run they started from
contained **zero** occurrences of the string `--allow`.

## What worked — the agents' own words

The evidence agent produced the deliverable in **one attempt with no flag guessed**, and
the two v3 fixes it depended on both did their job without being noticed as fixes:

> "No `--strip-window` — default is 'when the last finite animation ends' (400ms here, set
> by `h1 bump`), which already brackets the 370ms card cascade. **Did not have to compute a
> window value.**"

> "Cascade is unmistakable: row 1 is ~opaque at 62ms, row 2 is blank at 62ms, row 3 is
> blank at 62ms and 123ms."

The repair agent found `--allow` by itself, in one round, and was explicit about why:

> "`--help` on drift: `e.g. --allow \"background-color@.card--featured;variant accent\"` —
> the help's own example is verbatim this task's conflict. **That is the single reason
> round 2 was one command instead of a threshold-tuning hunt.**"

It also used the exemption the way it was designed to be used rather than as a mute:

> "the differences are still printed as `exempted ...`, so nothing is hidden."

Three fixes from earlier rounds were quoted back as the run's best messages — v3's
reduced-motion remedy ("remedy spelled out; zero guessing"), v3's overflow attribution
("best finding in the run: cause, arithmetic, and the size of the win"), and v1's
sample-every-animation fix ("I would never have suspected an animation on `z-index`"). And
`--rules`, which exists so a ruleset can be re-tuned, turned out to serve a second purpose:

> "this is what let me reason about *which* findings could actually fail a gate instead of
> chasing all of them."

## What didn't — all six, all fixed

### V1 — a status line with no rule behind it

> "`settle: never` and `reduced-motion: 5 animation(s) still running` are status lines, not
> findings. They read like the most important facts in the output but carry no rule id, no
> severity, and no remedy of their own. I had to scroll to the `Issues:` block and
> re-derive which status line mapped to which rule."

**Fixed** — each status line tags the rule carrying it. `settle: never` is the one case
where nothing does (`long-settle` compares a settle time and there is none), so it says
that outright instead of being a headline with nothing behind it.

### V2 — `infinite-animation`'s remedy named only harness changes

> "It says: mask it with `vlmkit snapshot --mask` […] or pause animations before
> screenshots. Both suggestions are *harness* changes. The brief asked me to fix the page
> […] so the finding's own advice is the one thing I was not allowed to do. It never
> mentions the CSS-level option (bound the iteration count), which is what I did."

**Fixed** — the page-side fix leads; the harness options stay for a spinner that is meant
to run forever. The severity is unchanged: an infinite animation is legitimate on most
pages, and v3's warn-notice already tells a caller a warn was let through.

### V3 — the drift percentage meant "fail" in one run and "pass" in the next

> "instance #1 read `9.15%` while instance #2 read `4.45%` — yet #1 was ✗ and #2 was ~. The
> percentage is the number the eye lands on and it is *not* what decides pass/fail […]
> After `--allow`, instance #1 still prints `9.15%` and now passes, so the same number
> means 'fail' and 'pass' in two runs."

Reproduced exactly. **Fixed** — each row states its own verdict (`5 tracked properties
differ`, `all 5 difference(s) exempted`, `no tracked property differs`) with the ratio
demoted to a dim `9.15% px`, and one line at the top says which of the two the verdict
reads.

### V4 — nothing in a failing run pointed at `--allow`

> "Nothing in the four gates' default output hints that an intentional-variant escape hatch
> exists. I found it only by opening `--help`. The failing output itself says nothing like
> 'if this difference is intentional, declare it with `--allow`' — which is where an agent
> would actually read it."

Also mis-aimed: `instance-drift`'s docs led with `--threshold`, a pass line on the pixel
ratio, which cannot answer a rule that reads computed style. "`--threshold` would have been
a blunt fudge; `--allow` was the correct, reviewable one."

**Fixed** — a failing run with no exemptions prints a ready-made rule, scoped to the class
that makes the instance a variant. On the scenario it emits `--allow
"border-top-color@.card--featured;<why>"` — the rule this agent eventually wrote by hand.
`--allow` now leads the rule's docs.

### V5 — no signal that `--allow` could be committed

> "my fix lives in a shell command that a CI job would have to duplicate. I do not know
> whether an exemption can be committed alongside the page, and the output does not say."

It can, and always could: a `vlmkit.gates.json` `"gates"` entry is a full command, tokenized
quote-aware. Verified end to end — `gates run` passes with both exemptions in the config.
Every gate's help explained how to persist a *rule setting* and nothing about the flags
above it. **Fixed** — the missing footer, on every gate.

### V6 — integrity's cause looked exhaustive and was not

> "I could not tell from the output whether integrity had *analysed and cleared* the cards
> row or simply attributed all overflow to the single worst offender and stopped. I had to
> reason about flex-shrink myself to trust the fix."

Adding the cleared count exposed something worse. At 375px the gate reports **439px** of
overflow and the named cause relieves **77px**; the other elements past the edge are rigid
siblings in one row, and since each is probed alone, neutralizing either leaves the other
overflowing — so both measure 0 and no single element can be blamed. The report was naming
18% of the problem in a sentence that read as all of it.

**Fixed** — the note leads with the remainder and the shape of cause that produces it:
"fixing that leaves 362px, which no single element relieves — look for siblings that are
each rigid (a fixed-width row, a min-width grid track)". Where the named cause does account
for everything (46 of 46 at 768px) nothing is added.

## The oldest finding, finally fixed

v1's G5 was "no labels at all — no row selector, no time per cell; that data is
terminal-only". It was deferred on the grounds that drawing text makes output depend on
font rendering, which is exactly the class of platform-dependent pixel this toolkit exists
to catch. agent-h raised it again and dismantled the rationale in one sentence:

> "The rationale (font rendering is platform-dependent pixels) is sound for VRT baselines,
> but this artifact is *not* a baseline — it is an attachment whose whole job is to be read
> by a human out of context."

That is right, and it had been wrong for four rounds. Nothing pixel-compares a strip, and
both agents that produced one had to hand-copy the caption into the comment. **Fixed** with
a 5x7 bitmap font drawn in-repo: identical bytes on every platform, no fontconfig, no web
font to race a screenshot. The sheet now carries its sample times across the top and
`selector animation-name` above each row.

Its second note is **not** fixed and is recorded as a limitation:

> "Cells are cropped per-row to each card's own motion bbox, so the sheet loses the fact
> that the three cards sit *side by side*. Rows read as 'three states of one column'."

True, and it is the crop doing its job — without it each cell is the whole viewport and a
small element yields six near-identical screenshots. Keeping both facts in one sheet is a
different layout, not a bug fix.

## Has it converged?

Not yet, but the trend is unambiguous. Each round still yields work, and the *kind* has
moved steadily:

- **v1** — the feature reported the wrong thing (strip drew 1 of 5 animations, on the
  wrong clock).
- **v2** — messages claimed more than they had checked; defaults were unhelpful.
- **v3** — a warn passed a gate that had been sent to find it; a cause was named wrongly.
- **v4** — every measurement was right; six findings about how it reads.

Four rounds, one artifact requirement, and the evidence agent went 4 rounds → 1 attempt
with no flag guessed. The repair agent went 3 editing rounds → 1, with round 2 spent
declaring a variant deliberate rather than hunting a threshold. The remaining friction is
presentational, which is where a loop like this is supposed to end up — and a fifth round
would now be measuring the scenario more than the tool: all six v4 findings come from the
*same four gates on the same page*, and the scenario has stopped producing new kinds of
defect.

The next round worth running is a **different page**, not a tighter budget on this one.

## Files

- `fixtures/dogfood-animation-2026-08-10/attempts/agent-g/`, `attempts/agent-h/`
- `packages/vlmkit-core/src/bitmap-font.ts` (new), `src/filmstrip.ts`, `src/plugin/runner.ts`
- `packages/vlmkit-markup/src/style/animation-eval.ts`
- `packages/vlmkit-markup/src/component/component-consistency.ts`
- `packages/vlmkit-markup/src/inspect/scroll-scan.ts`
- `packages/vlmkit-markup/src/gates/drift.gate.ts`
- `src/cli/commands/strip-cli.ts`
