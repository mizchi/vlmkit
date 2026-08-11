# Dogfood v2: did the v1 fixes hold, on tighter budgets? (2026-08-10)

## Question

v1 found five gaps in the strip work and two in the gates around it, all fixed. v2 put
fresh agents — no source access, no git history, no access to v1's report or attempts —
on the same scenario with **tighter budgets** (repair 5 → 4 rounds, evidence 4 → 3),
and with one requirement added to the reviewer's ask, aimed straight at v1's worst
finding:

> "And I want to be able to tell whether they come in one after another or all at once."

## Result

| | v1 | v2 |
|---|---|---|
| Evidence: rounds | 4 of 4 | **3 of 3** |
| Evidence: documents the real page | **no** — had to slow `rise` 250ms→2500ms | **yes**, untouched |
| Evidence: artifact | 1496x484, 31.8 KB | 1496x484, **25.8 KB** |
| Evidence: answers "staggered or simultaneous" | read as "all at once" | **"A staircase. Unambiguous."** |
| Evidence: how it was found | doc grep, ~2 min | doc grep ~2 min, and `--help` alone sufficient |
| Repair: rounds | 3 of 5 | 3 of 4 |
| Repair: gates green | 3 of 4 | **4 of 4** |
| Repair: page edits | `index.html` + `theme.css` | `theme.css` only, `index.html` byte-identical |
| New gaps surfaced | 5 | 5 |

Both v1 fixes that mattered are confirmed by agents who did not know they had happened.
The gap count did not fall — but the *kind* changed, from "the feature reports the wrong
thing" to "the default is unhelpful" and "the message claims more than it checked".

## What worked — the agents' own words

On the shared clock (v1's G2), asked to describe the first two columns cell by cell:

> "Col 1 (63ms): 1.4.0 half-faded and sitting low; 1.5.0 a barely-visible ghost; 1.6.0
> completely blank. Col 2 (127ms): 1.4.0 nearly solid; 1.5.0 half-faded; 1.6.0 a ghost.
> A staircase. Unambiguous."

On discoverability (v1's G3), where the fix was two lines of `--help` and a doc section:

> "One grep on `docs/cli-reference.md` found it in ~2 minutes; total wall clock under 5
> minutes […] `--help` alone was also sufficient."

On the messages that did the work in the repair run — both naming the element:

> "`[reverse] Focus moved left within the same row (from ...button#publish at x=684 to
> ...button#save at x=44)`" … "`[page-overflow-x] … caused by: #publish (130px wide;
> constraining it removes 46px of the overflow)`" — "Same root cause; one flex rewrite
> fixed both."

And the finding added in v1's `evaluated 1 → 5` fix, which v1's repair agent had
explicitly missed:

> "`animation \`bump\` (400ms) produced no visible pixel change at any sampled frame —
> dead animation` (it animated `z-index`)."

## What didn't / new gaps

### V1 — the strip's default window picked the infinite animation

> "the default `--strip-window` is actively misleading here. 'One iteration of the
> slowest animation' picks the *infinite spinner*, so the default sheet spends 75% of its
> columns on a settled page. The 900ms default is the wrong clock for the thing under
> review, and nothing in round 1's output flags the mismatch."

Verified: spinner 900ms, every finite animation done by 400ms. **Fixed** — the window is
when the last finite animation ends, falling back to one iteration of the longest only
when everything is infinite. Default became 400ms, close to the 380 the agent found by
hand.

### V2 — no way to scope the strip's rows

> "No flag to scope the strip to one animation or selector. I expected `--selector .card`
> or `--only`; neither exists. So row 4 is six 34px spinners plus a ~90px dead grey band
> […] ~20% of the sheet is noise. `--max-animations 3` is a trap: document order puts the
> dead `h1 bump` first, so it would drop card 3."

**Fixed** — `--strip-selector <css>`, matched against each animation's effect target
rather than the reported selector string. Adding it exposed a second lie: the omission
count called a selector-excluded row a `no-visible-effect`. Counted by reason now.

### V3 — `check drift component` claimed something it had not checked

> "Passing `--selector .card` while honoring the brief's 'stays visually distinguishable'
> required moving the accent to `outline` + a descendant selector — neither is tracked.
> The tool then reports `every tracked computed style matches — different content, not
> drift`, which is **false**: it is a styling difference the gate can't see."

Reproduced on their fixed copy: 12.50% pixel difference, "not drift". This is the v1 fix
overreaching — pixels were replaced by a 60-property root comparison, and then the
conclusion was stated as if the comparison were exhaustive. **Fixed** three ways:
`outline-*` tracked (the featured card now reports `outline-style: none → solid`), the
"not drift" conclusion replaced by a statement of what was checked, and the palette
signal promoted from a table column to the verdict — which the same agent had noticed
was there and ignored:

> "The passing report's summary table shows `Extra palette: 1` for the featured card —
> the tool *does* see the blue accent — while the verdict ignores that column."

A descendant-only accent now reads "2 colour(s) appear in one instance and not the other
— a styling difference on a descendant or in an untracked property".

### V4 — two runs shared one report path

> "`cat test-results/component-consistency/report.md` returned a *different* run —
> `Selector: .card:not(.card--featured)`, 2 instances, a different HTML path — while my
> terminal showed `.card`, 3 instances. A parallel agent had clobbered it. I trusted the
> terminal."

**Fixed** — the default output directory is per (source, selector).

### V5 — `check a11y focus` could only run at one width

> "`check a11y focus` has no `--viewport` flag while `check animation` does — focus order
> is only checkable at one unnamed width, even though the wrapped toolbar changes visual
> order at 375px."

**Fixed** — it takes `--viewport WxH`. Focus order is judged from each stop's x/y, so the
width was always part of the question.

### Not reproduced — "a gate crashes and exits 0"

> "`check motion` […] dies with a raw stack trace: `Error [ERR_MODULE_NOT_FOUND]: Cannot
> find module '…/dist/gates/index.mjs'`, and `echo $?` is **0**."

Tried twice — deleting `dist/gates/index.mjs`, and making a gate module throw on import
— and both exit 1. Two likelier explanations, both mine: I rebuilt `vlmkit-markup`
several times *while their run was in progress*, which leaves `dist` briefly
inconsistent; and `echo $?` after a pipeline reports the last command's status, a mistake
I made myself earlier in this same session. Recorded rather than fixed.

**Loop hygiene, learned the hard way: do not rebuild while an agent is running.** It
invalidates their environment and produces findings that cannot be reproduced.

## A flaw in the scenario, not the tool

The success criterion asks `check drift component --selector .card` to exit 0 while the
brief requires `.card--featured` to stay visually distinguishable. Since drift is judged
from computed style, those cannot both hold. Both repair agents hit it — v1 named it
("it flags `.card--featured` at 95.87%, which the brief *requires* to look different"),
v2 worked around it by finding an untracked property, which is what put `outline-*` on
the list.

The tool's answer is `--selector ".card:not(.card--featured)"`, which exits 0. Recorded
in the scenario README; later runs are scored on that.

## Files

- `fixtures/dogfood-animation-2026-08-10/` — `attempts/agent-c/`, `attempts/agent-d/`
- `packages/vlmkit-markup/src/style/animation-eval.ts`
- `packages/vlmkit-markup/src/component/component-consistency.ts`
- `packages/vlmkit-markup/src/gates/{drift,a11y,animation}.gate.ts`
