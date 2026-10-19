# motion-repair v1: can an agent repair a broken animation and prove it with the skills? (2026-10-19)

## Question

Three fresh agents each got one page from `fixtures/motion-repair/broken/`, its brief, the
`vlmkit` skill router and the CLI's help, and nothing else (fixtures, reports, source and each
other's work forbidden by path). Each had four rounds to make the page match its brief and to
prove the repair with vlmkit. `fixtures/motion-repair/oracle.mjs`, which the agents did not see,
judges the result: it pauses every animation at chosen instants and checks visibility, position
and the shape of the easing. It fails all three pages as given and passes a reference fix of each
(`reference/`).

| page | planted defect |
|---|---|
| notify | the notification sits under its header, whose `overflow: hidden` clips all of it |
| menu | the account menu's `z-index: 50` is trapped in the nav's stacking context (`transform: translateZ(0)`), which a later `position: relative; z-index: 1` banner paints over |
| toast | the entrance has no fill-mode, so the toast is off-screen for the 2s hold, and it is `ease-in` where the brief says ease-out |

## Result

| page | rounds | oracle on the repair | what found the defect | `inspect motion` on the broken page |
|---|---:|---|---|---|
| notify | 2 of 4 | PASS | `check integrity --timeline`'s `clipped-content` (a warn) and the agent's own look at the frames | **no fail** (visible 0.00 in every frame) |
| menu | 1 of 4 | PASS | `check integrity --timeline`'s `occluded-text` | **no fail** (visible 0.00 in every frame) |
| toast | 4 of 4 | PASS | `easing-mismatch` for the easing; the agent's own look at the frames for the vanish | the easing only; with `--exits` the 2s vanish passed |

Every repair is right. The tool's proof was wrong three times out of three: the command the
skill sends an agent to for "does the motion look broken?" passed every broken page.

## What worked: the agents' own words

> "Move or shrink the covering element, or reorder the stacking so the text stays readable." (menu,
> quoting `check integrity`): "Naming `section.hero` and saying 'stacking' pointed me straight at
> the stacking contexts."

> "The `clipped-content` line above named both the element and the cause." (notify)

> "The tip 'ask for frames rather than guessing … `--at 0..600/100 --frames out/f`'. Looking at
> that strip is how I found the vanish." (toast)

## What didn't, and what is fixed

### `inspect motion` passes a target nobody can see

> "`inspect motion` gives no finding when the target is never seen. It reads 0.00 at rest and still
> passes." (menu)
>
> "It also reported `travels 24px … follows ease-out exactly` for an element nobody could see.
> Broken and fixed output read the same apart from the 0.00 / 1.00 numbers." (notify)

Every presence rule compared frames that show the target with frames that do not, so a target
shown in no frame matched none of them. **Fixed:** `target-hidden` (fail) when no frame shows it,
rest included, and no easing is fitted to it.

### Nothing named the cause

> "No tool named the real cause, the nav's `transform`. I found that by reading the CSS." (menu)

**Fixed:** measured by the page, a target that is not seen says why — the ancestor whose
`overflow` clips it (`clipped by header.topbar (overflow: hidden), which it lies outside of`), or
what covers it and the outermost stacking context around it that does not also hold the cover
(`covered by section.hero: nav makes a stacking context (a transform), so the target's own z-index
only counts inside it and nav as a whole paints below section.hero`).

### The hold between an entrance and an exit is never looked at

> "`inspect motion` samples only inside the two animations, so its frames go '659ms … 2660ms' with
> nothing in the 2s gap." (toast)
>
> "`target-lost` ('not shown between frames that show it') doesn't fire on 19 absent frames that sit
> between shown ones." (toast, with `--at 0..3300/100`)

Two causes. The planner sampled only inside segments. And `target-lost` excused any frame whose
box touched the viewport's edge as "coming in or going out" — meant for a model's boxes, it also
excused a measured box entirely off-screen. **Fixed:** three frames in every hold between segments;
the edge excuse is for a model's boxes only (the page's visible share already leaves out what is
off-screen); and a hold frame away from where the segment ended is `snap-back` (or `jump`).

### `--out`

> "`--out` is not a flag of `inspect motion` (it is `--frames`). Passing it dumps the help text and
> nothing else." (menu; the toast agent hit it too)

**Fixed:** `unknown option --out (did you mean --frames <dir>?)`.

### Deferred

- `check animation` called both hidden targets `visible`; its only clue was a motion region 8-12px
  tall for a 100-186px element. Worth a note when the region is a small part of the element.
- `check integrity`'s `occluded-text` listed three of the four hidden menu items, not Billing.
- `clipped-content` is a warn, so `check integrity` exits 0 on a fully clipped card.
- After the fix, `check integrity` at 375px reports the notification covering the mail list, which
  the brief asks for at 1280 (the skill's guidance on one-viewport briefs applies).
- `check animation`'s `reduced-motion-ignored` (suspect) on briefs that do not mention reduced
  motion: two agents left it, one added a rule.

## After the fixes

On the same pages, `inspect motion --selector` with no key now fails each broken page by the
expected rule and names the cause, and passes each reference fix. `fixtures/motion-defects/` is
unchanged: 6 of 7 broken caught by the expected rule, 7 of 7 intact pass.

Jev: two agents ran `--jev` on the broken page ($0.003 each); Jev read the targets as hidden too
(0.01-0.12) and the command still passed, the same blind spot. `target-hidden` covers Jev-only
targets as "not found in any frame".

## Next round

The same three pages and briefs for three fresh agents, plus one smaller model on the toast (the
page that took all four rounds), on the fixed tool: does `inspect motion` now lead to the cause on
the first run, and does the repair take fewer rounds?
