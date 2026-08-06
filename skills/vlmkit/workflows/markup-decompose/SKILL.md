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

**Size matters, measurably.** The per-component loop's advantage comes from the
component being small relative to the page, and it decays as the component grows:

- A small component (button, badge, avatar) gets the full benefit — its image is a
  rounding error against a page shot.
- A **large** component (hero, wide data table) gets much less. Its own shot
  approaches a page shot, so the saving shrinks toward the page arm's.
- Worse, a *ratio* threshold gets coarse as area grows. A few hundred changed
  pixels is over a percent on a 3.5k-pixel button and about a tenth of a percent
  on a 250k-pixel hero — so the same default that catches a button regression can
  **miss** a corner-radius change on a hero. Give large components an explicit
  tighter `--threshold`, and do not assume the default protects them.

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

## Phase 3 — Freeze (the handoff, currently manual)

**This is the phase people skip, and it is what makes the rest durable.** A
component that converged once has no protection against the next edit unless its
correct state is recorded.

`build component` and `check story` are different tools for different phases —
construction versus maintenance — and nothing yet converts one into the other. Do
it by hand:

1. Make sure the project has a gallery. If not, copy one from
   `component-vrt`'s `assets/` (vanilla / React / Vue templates are there,
   because Playwright ships none).
2. Add a story per component **and per named state** from Phase 1.
3. Write the baseline once the component is converged, not before:
   ```bash
   vlmkit check story components/Button/Primary --gallery "$G"   # writes it
   vlmkit check story components/Button/Primary --gallery "$G"   # confirms clean
   ```
4. Record the set in `vlmkit.gates.json` so CI runs it and the story ids stop
   drifting (baselines are keyed on the id **as written**).
5. Commit the baselines.

A converged component with no baseline is an undone task, not a finished one.

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
- Large components carry an explicit `--threshold`, not the default.

## What this skill does not solve

Stated so you do not go looking:

- **No keyframe extraction.** Motion cannot be read out of a reference by any tool
  here; it comes from a brief or from you.
- **No automatic story generation.** Phase 3 is manual. The outline from Phase 0
  contains the information needed to emit story definitions, and closing that gap
  is the obvious next tool — but it does not exist yet, so do not look for a flag
  that does it.
- **The gallery is the project's to own.** Templates exist; a drop-in does not.
