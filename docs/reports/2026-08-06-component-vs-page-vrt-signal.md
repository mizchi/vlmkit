# Component-scoped vs page-scoped VRT: signal cost and precision

Date: 2026-08-06. Harness: `src/experiments/component-vrt/ab-run.ts`
(`node --experimental-strip-types src/experiments/component-vrt/ab-run.ts`).
65 trials. Raw output: `test-results/component-vrt-ab/report.md`.

## The question

When an agent repairs **one component**, is a component-scoped VRT signal
(`vlmkit check story`) cheaper and more precise than diffing the whole page that
component lives on (`vlmkit diff html`)?

## Answer, in one line each

- **Cheaper: yes, decisively, and it holds under every cut.** 9.5x fewer signal
  bytes, **147.7x fewer image tokens** over 65 trials.
- **More precise at localizing on small components: yes.** 6/79 expected changes
  missed against the page arm's 15/79, and 0 false positives against 3.
- **On large components it is the page arm that is more precise, decisively.**
  The story arm missed **6 of 12**; the page arm missed **0**. This is the
  headline finding, and it is the opposite of the pitch for component-scoped VRT.
- **Those 6 misses have two different causes, not one**, and only one of them is
  fixable by configuration. Verified case by case below.
- **Fewer retakes / fewer output tokens: not measured.** This needs a repair agent
  in the loop. No number is offered.

The two arms are **complements, not substitutes**. That conclusion is forced by
the failure analysis, not a diplomatic reading of it.

## Setup

Eight components — `Button`, `Badge`, `Avatar`, `Card`, `Alert`, `Toolbar`, plus
the deliberately large `Hero` and `DataTable` — defined once in
`fixture/components.css` and `fixture/_markup.js`, rendered by **two hosts off
the same files**: the page files compose them into a page, `gallery.html` mounts
them as stories. Sharing the sources is the fairness condition; with a copy per
host the two arms would be measuring two different regressions.

`Toolbar` renders an Avatar, a Badge and a Button, so the corpus contains a
composite whose blast radius is larger than itself.

Three axes, crossed:

| axis | values | what it guards against |
|---|---|---|
| page composition | `flat` (many small blocks), `hero` (one dominant block), `list` (long repeated rows) | a result that only holds for one page shape |
| regression class | `delete` a declaration, change a `value`, change a `colour` | a result that only holds for layout-breaking changes |
| component size | small (6) vs large (`Hero`, `DataTable`) | **the advantage being an artefact of picking small components** |

Every page renders every component, differing in instance count and height, so
the size cut has real N on all three pages rather than only where a large
component happened to appear.

**The page arm is given its strongest signal, not a convenient one.** `diff html`
localizes by selector through its computed-style and authored-style diffs, not
merely the pixel path. That matters: on its own, the pixel path attributes a
Button padding deletion to a wrapper region on `.page`, because removing the
padding reflows everything below it. Comparing against *that* would have
manufactured the localization result.

## Cost

| metric | page-scoped | component-scoped | ratio |
|---|--:|--:|--:|
| signal bytes | 5,034,921 | 531,507 | **9.5x** |
| image tokens (approx) | 400,788 | 2,713 | **147.7x** |
| images an agent opens | 186 | 79 | 2.4x |

Image tokens use Anthropic's documented `w*h/750` approximation on the PNG
dimensions actually emitted.

Two effects compound. The obvious one is that a component's box is a fraction of
a viewport. The larger one is **selectivity**: the component arm emits an image
only for the stories that actually changed, so most components cost nothing to
look at, while a page heatmap covers everything whether it changed or not. That
is why the image count falls 2.4x but the token count falls 147.7x.

### The cost advantage grows with the page, and shrinks with the component

| slice | trials | bytes | image tokens |
|---|--:|--:|--:|
| page `flat` | 22 | 10.4x | 86.5x |
| page `hero` | 22 | 9.2x | 169.0x |
| page `list` | 21 | 8.8x | 241.8x |
| class `delete` | 24 | 12.8x | 104.7x |
| class `value` | 20 | 9.0x | 168.6x |
| class `colour` | 21 | 5.7x | 248.0x |
| **small components** | 53 | 8.7x | **266.8x** |
| **large components** | 12 | 13.0x | **40.4x** |

Both directions are mechanical rather than surprising, which is why they are
worth stating: the page arm's cost scales with page area and the story arm's does
not, so a taller page widens the gap (86x → 242x); and a story of a large
component approaches a page shot, so the gap narrows (267x → 40x). **40x is still
40x** — the advantage decays but does not disappear, which is what the
anti-overfitting cut was there to test.

## Precision

| slice | missed (page vs story) | false positives (page vs story) |
|---|--:|--:|
| small components | 15/79 vs **6/79** | **3** vs 0 |
| large components | **0/12** vs 6/12 | 0 vs 0 |
| all | 15/91 vs 12/91 | 3 vs 0 |

On small components the story arm is better at the **blast radius** — "what else
did I just break". The Toolbar renders a Button, so deleting the Button's padding
really does change the Toolbar; the page arm's selector-level signal misses it
because the Toolbar's *own* computed styles are unchanged and only its child
moved, while the story arm re-renders and re-diffs the Toolbar as its own story.

The aggregate row (15 vs 12) is nearly a tie and is the least informative number
in this report — it averages two opposite effects. Read the two size rows, not
the total.

## The 6 large-component misses, case by case

All 6 are `Hero`, the largest component (1258x203 = 256,632px as a story). Each
was re-run at a threshold of 1e-7 to recover the diff the default suppressed:

| trial | mutation | changed pixels | ratio | default 0.005 | derived 0.0002 |
|---|---|--:|--:|---|---|
| `hero/value` | `border-radius` → 26px | 71 / 256,632 | 0.028% | missed | **caught** |
| `list/value` | `border-radius` → 26px | 71 / 256,632 | 0.028% | missed | **caught** |
| `list/delete` | `border-radius` deleted | 52 / 256,632 | 0.020% | missed | **caught** |
| `flat/colour` | `background` gradient shift | 0 / 256,632 | 0.000% | missed | still missed |
| `hero/colour` | `background` gradient shift | 0 / 256,632 | 0.000% | missed | still missed |
| `list/colour` | `background` gradient shift | 0 / 256,632 | 0.000% | missed | still missed |

**Cause 1 (3 of 6): a ratio threshold is the wrong unit.** A corner-radius change
moves 52-71 pixels. On an 88x36 button that would be over 1.6% and fail
instantly; on a 256,632-pixel hero it is 0.02%, and `check story`'s 0.5% default
lets it through. Nothing is wrong with the measurement — the threshold is
expressed in a unit that coarsens as area grows.

This is what `vlmkit build gallery` now derives per story: a **pixel budget**
(default 24px) converted to a ratio for each component's actual area, clamped
between a renderer-noise floor (0.0002) and the gate's own default, so it can
only tighten a gate and never loosen one. At the floor value the three
border-radius trials are caught, verified above. The margin is not large — 52
pixels against a floor equivalent to 51 — so the floor, not the budget, is what
saves the smallest of the three. A project that wants headroom on components this
size should pass a smaller `--noise-pixels` and accept the flake risk knowingly.

**Cause 2 (3 of 6): the pixel comparator's perceptual threshold, which no ratio
can reach.** The gradient mutation is real —
`linear-gradient(120deg, #eef3fd, #f7f9fc)` → `(120deg, #f6ecff, #fbf7ff)`, a
blue tint to a purple one. Measured directly on the two PNGs:

- **246,914 of 256,632 pixels (96%) differ.**
- **Maximum per-channel delta: 8/255. Mean: 5.7.**

pixelmatch's perceptual threshold counts none of them as changed, so the diff
ratio is exactly 0. There is no threshold setting that catches a 0% diff. The
page arm catches all three because `diff html` reads **computed styles**, not
only pixels, and a changed `background-image` declaration is visible there
whatever the pixels do.

That is an architectural limit of component-scoped VRT as it exists, not a
tuning problem: `check story` is a pixel instrument and pale-palette drift is
below pixel sensitivity. It is also the clearest argument in this report against
treating `check story` as a replacement for `diff html`.

## The 3 page-arm false positives, and why they may not be errors

All three are the same shape: changing `Badge`'s `letter-spacing` makes the page
arm implicate `Avatar`, which the harness's blast-radius definition
(`{Badge, Toolbar}`) does not include.

The Avatar sits next to the Badge inside the Toolbar, so widening the Badge's
text really does move it. The page arm reports a component that **moved**; the
story arm reports that the Avatar itself is **unchanged**, which it is — mounted
standalone it cannot move. Both are correct about different questions, and which
one you want depends on whether "did I break the Avatar" means its own rendering
or its position on the page.

Counted strictly against the declared ground truth these are false positives, and
they are reported that way above rather than quietly reclassified. But a reader
should not take "3 vs 0" as evidence that the page arm hallucinates.

## Two earlier runs of this bench were void. Their numbers appear nowhere here

Recorded because a benchmark's credibility depends on its failures being visible:

1. **Seeder bug.** `applySeed` located declarations by whole-file `indexOf`, and
   `body { background: #fff }` precedes `.c-card`, so a Card mutation repainted
   the page background and produced 15 unearned false positives. Fixed with
   block-scoped replacement plus a regression test.
2. **Fairness bug.** `page-flat` did not render `Hero`, so the page arm was
   scored as missing changes it could not observe. Fixed with a
   comparability check; the fixture now renders every component on every page.
3. **Insufficient N on the cut that mattered.** The large-component slice had 4
   trials. It now has 12.
4. **A broken environment scored as data.** In the fourth run both tools failed
   for the last 19 of 65 trials, and each such trial recorded 0 bytes and a miss
   for *both* arms — so the run produced a table that read as complete. The cause
   was operator error: rebuilding `vlmkit-markup` (whose build wipes `dist`)
   while the harness shelled out to a CLI that loads the gate registry from it.
   The harness now aborts the run, writes no report, and names the cause; a trial
   where the tool did not run is not a trial where the tool missed something.

The numbers in this document come from a single clean run of 65 trials, 7 skipped
and listed, 0 trials with a non-reporting arm.

## Limits, stated plainly

- **Retake counts and output tokens are not measured, and not estimated.** Both
  require a real repair agent or the VLM/LLM fix loop. No API key is available in
  this environment (`OPENROUTER_API_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`
  all unset), so the loop could not make a call. The harness produces exactly the
  inputs that arm would consume, so it can be added without changing anything
  else.
- **One fixture, one machine, one renderer.** Three page shapes and three
  regression classes establish that the direction is not an artefact of a single
  layout; they do not make it a statistical claim.
- **The comparator is pixelmatch at its default sensitivity in both arms.** The
  perceptual-threshold finding above is a property of that configuration. A
  different comparator would move those three trials.
- **Both arms are deterministic here.** No claim is made about how a model
  *behaves* given either signal; only about what each signal costs and contains.
- **The story arm requires a gallery.** `vlmkit build gallery` reduces that setup
  cost but does not remove it, and none of it is amortized into these numbers.

## What would settle the two open questions

1. **Retakes.** One controlled agent A/B, same shape as
   `2026-06-06-ab-external-synthesis.md`: fresh disposable agents, fixed round
   budget, same seeds, one arm given the page signal and one the story signal,
   scoring rounds-to-green and wrong-edit count.
2. **The perceptual blind spot — addressed, not closed.** `check story` now
   measures magnitude alongside the ratio and raises `sub-perceptual-drift` when
   most of a component's pixels moved by less than the comparator counts
   (coverage ≥50%, max channel delta ≥2 — coverage is the discriminator, because
   antialiasing moves edges and a recolour moves everything). Verified end to end
   on a pale recolour of the example gallery's card: 99% of pixels moved by at
   most 9/255, diff ratio 0.00%, and the row now says so instead of reading as a
   clean pass.

   It is a **warn**, so the verdict is unchanged: the comparator still decides
   pass/fail, and a project that treats tint drift as a regression promotes the
   rule in `vlmkit.gates.json`. That makes the case *legible*; it does not make
   `check story` catch what `diff html`'s computed-style diff catches. The
   complement conclusion above stands.
