---
name: markup-decompose
description: Plan and sequence a whole-screen markup problem by decomposing it into components first, then routing each phase to the loop that fits it — outline extraction from a reference, per-component construction, and the handoff where a converged component is frozen as a story baseline so later edits are checked per component instead of per page. Use when the task is a whole screen or feature rather than one component, when a reference/mock exists and you need to decide the component boundaries before writing markup, or when converged markup needs to become maintainable. Not a build loop itself — it routes to auto-markup / mock-markup / dynamic-markup / component-vrt and defines the handoff between construction and maintenance.
metadata:
  internal: true
---

# markup-decompose

A whole screen is not one problem, it is N component problems plus a composition
problem. This skill decides that split and routes each piece; it does **not**
contain a build loop of its own.

The split is worth doing before writing markup for a measured reason, not an
aesthetic one: once a component is a story with its own baseline, checking it
costs a component-sized image instead of a page-sized one, and editing it stops
reporting its neighbours as changed. See
[the measurement](https://github.com/mizchi/vlmkit/blob/main/docs/reports/2026-08-06-component-vs-page-vrt-signal.md)
for the figures and their limits.

## Route first

| The task | Go to |
|---|---|
| One component, reference exists | `auto-markup` directly. Do not decompose a single component. |
| One component, already correct, now edited | `component-vrt` directly. |
| Raw mock / retina export, no reference HTML | `mock-markup` first (normalizes the image), then come back here. |
| Behaviour spec (breakpoints / scroll / motion) | `dynamic-markup` owns the verification; this skill decides which components carry it. |
| **Whole screen or feature to build or repair** | **stay here** |
| Edited markup, no reference, just want gates | `markup-assist`. |

## Phase 0 — Outline the reference

Get measured facts before deciding anything. Skip whatever the task did not
supply.

```bash
vlmkit contract introspect <html-or-url> --out ui.contract.json   # landmarks, composition, viewports
vlmkit scan component target.png                                  # component bboxes + crops
vlmkit check palette target.png                                   # dominant colours
vlmkit scan breakpoints <html-or-url>                             # declared media queries
```

`contract introspect` gives the landmark/composition tree and **viewports**, so
media queries are covered by the outline.

**Two things the outline will not give you, so plan for them explicitly:**

- **Keyframes.** The UI Contract IR has no field for animation. Motion has to come
  from the task's own brief, or from your reading of the reference — it cannot be
  extracted. `dynamic-markup` assumes a written brief for this reason. If the
  reference is a live URL you can at least read the declared animations out of its
  CSS by hand; if it is a screenshot, motion is unknowable from it and you should
  say so rather than invent easing.
- **Component identity.** `scan component` finds *visual* blocks, not the
  component boundaries a codebase would want. A card and its neighbour may be one
  bbox; a toolbar's three children may be three. Treat its output as a proposal.

## Phase 1 — Decide the split

This is the phase with no tool, and the one that determines everything
downstream. Write the list of components explicitly before touching markup.

**A good boundary:**

- Renders standalone. If it needs three ancestors to look right, it is not a
  component yet — either widen it or make the wrapper the component.
- Has states worth naming (default / disabled / loading / empty). Those become
  separate stories, and a state you cannot name is a state you will not test.
- Appears more than once, **or** is something you expect to edit repeatedly. A
  once-used block you will never touch again does not earn a story.

**Size matters, and it is measured** (65 trials, three page shapes, three
regression classes — [the report](https://github.com/mizchi/vlmkit/blob/main/docs/reports/2026-08-06-component-vs-page-vrt-signal.md)):

- **Small components get the full benefit**: 267x fewer image tokens than a page
  diff, 6/79 expected changes missed against the page diff's 15/79, and no false
  positives.
- **Large components get much less, and lose on precision.** 40x on cost — still
  large — but the story arm missed **6 of 12** changes on a 1258x203 hero where
  the page diff missed **0**. Splitting a large block into parts that render
  standalone is therefore a *detection* decision, not a tidiness one.
- Half of those misses are the threshold unit: a corner-radius change moves ~60
  pixels, which is over 1.6% of a button and 0.02% of that hero, so the 0.5%
  default catches one and not the other. `build gallery` derives a per-story
  threshold from a pixel budget for exactly this; if you write thresholds by hand,
  do the same arithmetic instead of reusing one number.
- The other half no threshold can fix: a pale-palette shift moved 96% of the
  hero's pixels by ≤8/255 per channel, which the pixel comparator scores as **0%
  changed**. `diff html` catches it through its computed-style diff; `check story`
  is a pixel instrument and has no equivalent.

**So do not retire the page diff.** Per-component stories are the cheap,
precise instrument for small components; a page-level `diff html` still covers
large blocks and sub-perceptual style drift. Keep both in the done conditions.

So prefer splitting a large block into its parts over keeping it whole, when the
parts render standalone. Not for tidiness — for detection.

## Phase 2 — Build each component

Route to `auto-markup` per component, smallest first. Its `build component` loop
is **construction**: converge markup toward a target you do not yet match.

Composition is its own problem and comes after the parts exist — `build page`
handles missing/extra/ordering/stacking. Do not converge composition against a
page whose components are still wrong; you will fix the same pixels twice.

For behaviour, hand the component to `dynamic-markup` once its static form is
converged.

## Phase 3 — Freeze (the handoff)

**This is the phase people skip, and it is what makes the rest durable.** A
component that converged once has no protection against the next edit unless its
correct state is recorded.

`build component` and `check story` are different tools for different phases —
construction versus maintenance. `build gallery` is the conversion between them:
point it at the page that just converged and it derives the gallery, the story
list, and a per-story threshold.

```bash
vlmkit build gallery dist/index.html --out .vlmkit/gallery
```

It captures each component's rendered markup plus the page's CSS, writes
`gallery.html` (implementing `window.mount` / `window.unmount`) and
`stories.json`, and prints the `vlmkit.gates.json` fragment and the
`check story` commands to run. Then:

1. **Read the candidate list before trusting it.** Discovery groups by class, so
   it proposes; you decide. Each candidate carries its evidence (instance count,
   size, what it contains) and rejected ones say why. `--selector .c-card`
   (repeatable) overrides discovery entirely, `--include-all` keeps the rejects.
2. **Open the gallery and check it renders what you expect.** If it warns that a
   stylesheet could not be read, stop — a baseline that looks fine and is wrong
   is worse than no baseline.
3. **Write baselines once each component is converged, not before**, using the
   printed commands (they carry the derived `--threshold`).
4. **Record the set in `vlmkit.gates.json`** so CI runs it and the story ids stop
   drifting (baselines are keyed on the id **as written**).
5. **Commit the baselines.**

A converged component with no baseline is an undone task, not a finished one.

### What the generated gallery is not

It captures markup, so the stories are frozen: `props` are accepted and ignored,
and behaviour is not exercised. It answers "did my CSS or token edit change how
this looks", which is the maintenance question. A component whose stories need to
vary by prop, or whose states only exist at runtime, wants a hand-written gallery
— `component-vrt`'s `assets/` has React / Vue / vanilla templates.

## Phase 4 — Maintain

From here on every edit goes through `component-vrt`, not through a page diff.
That is the payoff: the diff is component-sized, and changing one component does
not make its neighbours report.

## Done conditions

- The component list from Phase 1 is written down, with states named.
- Every component converged (`auto-markup`'s goal status `pass`, or a stated
  plateau).
- Composition converged: no missing/extra, no ordering violations.
- **Every component has a committed story baseline**, and
  `vlmkit check story <all> --gallery <url>` exits 0.
- Behaviour verified where the task specified it (`dynamic-markup`'s gates).
- Large components carry a derived `--threshold`, not the gate default (`build
  gallery` prints one per story).
- **A page-level `vlmkit diff html` still runs.** Measured: story baselines miss
  half the changes on a large component, and miss sub-perceptual style drift
  entirely. Story VRT narrows what the page diff has to catch; it does not
  replace it.

## What this skill does not solve

Stated so you do not go looking:

- **No keyframe extraction.** Motion cannot be read out of a reference by any tool
  here; it comes from a brief or from you.
- **No story generation from a *contract*.** `build gallery` works from a
  rendered page, so it needs markup that already exists. There is no path from a
  UI Contract IR (or a screenshot) straight to story definitions — during
  construction, before any markup, Phase 3 has nothing to read.
- **No prop or behaviour coverage in a generated gallery.** See above; a
  hand-written gallery is the answer, and templates for one are in
  `component-vrt`'s `assets/`.
