# Dogfood v3: tighter budgets, and a warn that passed a gate (2026-08-10)

## Question

v2 confirmed both v1 fixes and surfaced five more, all fixed. v3 tightened the budgets
again — repair 4 → **3** rounds, evidence 3 → **2** — and scored the repair agent on the
scenario flaw v2 uncovered: `--selector ".card:not(.card--featured)"` is the spelling
that can pass, and the README now says so.

Fresh agents, same MUST-NOT list: no source, no git history, no reports, no other
attempts.

## Result

| | v1 | v2 | v3 |
|---|---|---|---|
| Evidence: rounds | 4 of 4 | 3 of 3 | **1 of 2** for all four requirements |
| Evidence: documents the real page | **no** | yes | yes |
| Evidence: artifact | 1496x484, 31.8 KB | 1496x484, 25.8 KB | 1496x365, **22.4 KB** |
| Evidence: wrote the reviewer's comment | no | no | **yes** |
| Repair: rounds | 3 of 5 | 3 of 4 | 3 of 3 |
| Repair: gates green | 3 of 4 | 4 of 4 | 4 of 4 |
| New gaps surfaced | 5 | 5 | 5 |

The evidence agent (agent-f) met every requirement **on its first command** and spent
round 2 on a rough edge it chose not to accept. The repair agent (agent-e) took all four
gates green and then kept going on a bug the gates had stopped reporting — which is the
run that produced the sharpest finding of the loop so far.

## What worked — the agents' own words

The strip needed no flag-hunting at all:

> "All four met on the first command. […] `--strip-selector '.card'` dropped the spinner
> row and the dead `h1 bump` row (the '2 outside' in the output)."

And v2's shared-clock work reads correctly to someone who was never told what to look for:

> "the cells form a clear diagonal: at column 1 card 3 is still blank while card 1 is
> already half-opaque."

On the repair side, three of the four findings named the element and the fix collapsed
into one edit:

> "`.toolbar` from `position: relative` + three absolute `left:` offsets to `display:
> flex` […] DOM order (Publish, Save, Discard) now *is* the visual L-to-R order, which
> fixes the reverse tab jump. It also removes the `left: 660px` that caused the 46px
> horizontal overflow."

## What didn't / new gaps

### V1 — a warn passed a gate that had been sent to find it

The single most valuable finding in the loop to date:

> "`check animation` exits 0 while printing `settle: never (infinite animation)`. That is
> verbatim the reported bug ('never holds still long enough to screenshot'), demoted to
> `warn`. **Had I trusted the success criterion I'd have shipped it broken.** There is
> `--fail-on-suspect` (documented as `Accepted no-op`) but no `--fail-on-warn`."

agent-e fixed the spinner anyway — "the brief's 'never holds still long enough to
screenshot' was still true even though the gate exited 0, so I fixed it anyway" — which
is the behaviour you want and cannot rely on.

The escalation existed the whole time (`--rule infinite-animation=suspect` exits 1,
verified) and was findable only in the rule-settings docs. An infinite spinner is
legitimate on most pages, so the severity is right; what was missing was any sign that a
warn had been let through. **Fixed** — a passing run with warns now prints `N warn(s) did
not fail this command. To gate on one: --rule <id>=suspect`, silent under `--json`.

### V2 — `check integrity` named the wrong cause

> "`caused by: #publish (130px wide; constraining it removes 46px of the overflow)`. The
> cause was `left: 660px`, not the width. Shrinking the button as instructed would have
> 'fixed' integrity and left the tab order broken."

Arithmetically true, diagnostically wrong, and it points away from a defect another gate
was reporting at the same time. **Fixed** — `extends to x=814px: starts at 684px, 130px
wide; shrinking or moving it removes 46px`: both terms, no prescription of the one that
is usually not the fix.

### V3 — a **dead** animation set the strip's window

v2 stopped an *infinite* animation from setting the timebase. This is the same mistake one
level in: the gate printed ``h1 `bump` (400ms) produced no visible pixel change`` and then
used that 400ms for a sheet whose rows all ended at 370ms.

> "I computed 370 ms myself from `animation-delay: 120ms` + `250ms` in the CSS. The tool
> already printed every duration and knows the delays […] 'Window = when the last
> *selected, visible* animation ends' is information it has and did not use."

**Fixed** — the window is derived from the rows the sheet actually shows, so it resolves
to 370ms, and `--strip-selector` narrows it too.

### V4 — `reduced-motion-ignored` named one arbitrary element and no remedy

> "attributed to an arbitrary element (`h1:nth-of-type(1)`, 'e.g.') for a page-wide
> problem, and never says what would satisfy it — I guessed a global media query."

**Fixed** — up to four offenders listed, and the remedy stated with the duration floor it
measures against. In v4 this was quoted back as the run's clearest message: "remedy
spelled out; zero guessing."

### V5 — no way to bless an intentional variant

Three agents had now hit the same wall in three different ways: v1 named it ("it flags
`.card--featured` at 95.87%, which the brief *requires* to look different"), v2 got past it
by moving the accent into an untracked property, and v3 said what was missing outright:

> "drift lists intentional (colour) and unintentional (geometry) drift in one
> undifferentiated list — I found no way to bless expected properties."

**Fixed** — `check drift component --allow "<property>[@<selector>];<reason>"`, modelled on
`check integrity --allow` down to the two properties that keep it reviewable: an exempted
delta is still listed, and a rule that matched nothing is reported. The unit is a
*property* rather than a finding kind, because "this variant may differ in its background
and border" is the shape of the real permission and a whole-instance exemption would hide
the geometry mistake sitting next to the intentional colour.

agent-e had, independently, arrived at exactly that distinction by hand:

> "the featured card differed in two independent ways: colour […] and geometry (`padding
> 16px → 30px`). The brief requires it to stay *visually distinguishable*, not to be a
> different size, so I removed `padding: 30px` and kept the colours."

## Rough edges the agents chose not to accept

agent-f spent its whole second round on the window, and agent-f's other note stands as a
known limitation rather than a fix:

> "without `--advisory` the command exits **1** […] even though the strip was written
> successfully. Documented, but it means 'make me an attachment' is a failing command by
> default."

Left as is. Writing an image is not a reason to stop reporting a page's defects, and
`--advisory` says so in one word; v4's evidence agent reached for it unprompted from the
docs.

## Files

- `fixtures/dogfood-animation-2026-08-10/attempts/agent-e/`, `attempts/agent-f/`
- `packages/vlmkit-core/src/plugin/runner.ts`
- `packages/vlmkit-markup/src/inspect/scroll-scan.ts`
- `packages/vlmkit-markup/src/style/animation-eval.ts`
- `packages/vlmkit-markup/src/component/{component-consistency,drift-exemption}.ts`
