---
name: markup-assist
description: General-purpose deterministic verification for any HTML/CSS work — no API key, no reference design required, no project setup. Route by task; run the matching vlmkit gate (integrity / copy / layout / breakpoints / scroll / handlers / interactions / verify markup); read the kickback; fix; re-run to green. Use whenever you wrote or edited markup and want to know if it is actually correct — broken-page defects, copy fidelity, responsive boundaries, keyboard operability, design-target match — instead of eyeballing a screenshot. Works standalone in any repo via `npx vlmkit`; this is the drop-in generalist skill, distinct from the full-workflow skills (auto-markup / mock-markup / dynamic-markup).
---

# markup-assist

Deterministic gates for markup work. Each gate renders in headless
Chromium, measures (DOM + pixel math, no VLM), and prints a
**kickback**: a next-fix list with selector attribution. Your job is
the loop: run → read kickback → fix the reported thing → re-run.

Prereqs: Node 24+, Playwright Chromium. If `vlmkit` is not installed:
`npm i -D @mizchi/vlmkit`, then use `npx vlmkit …`. Sources are file
paths or URLs. All commands support `--json` and most support
`--fail-on-suspect` (non-zero exit) for scripting.

## Route by task

**Wrote/edited a page, no reference design:**

| Question | Gate |
|---|---|
| Is anything broken? (JS errors, empty render, failed resources, text collision/clipping/protrusion, collapsed containers, overflow, invisible text, occlusion, misalignment, unstyled page — 3 viewports) | `vlmkit check integrity page.html` |
| Is the required copy present, exactly? | `vlmkit check copy page.html --manifest copy.txt` |
| Does the structure match the brief? (widths, per-row counts, order, per-viewport visibility) | `vlmkit check layout page.html --contract layout.json` |
| Tokens / theme / a11y / long-text survival | `check tokens` · `check theme` · `check a11y contrast\|touch\|focus` · `stress i18n` |
| Is the page consistent with itself? (no tokens file needed — component styles reused, spacing on its own scale) | `vlmkit check design page.html` |

**Behavior:**

| Question | Gate |
|---|---|
| Responsive boundaries exact, no overflow at any width | `vlmkit check breakpoints page.html --sweep --fail-on-suspect` |
| Scroll containers / page overflow-x inventory | `vlmkit scan scroll page.html` |
| Sticky/fixed/snap actually behave | `vlmkit check scroll page.html` |
| Animations visibly run, settle, respect reduced-motion | `vlmkit check animation page.html` |
| Everything keyboard-operable, ARIA states transition | `vlmkit check interactions page.html` |
| Clickable `<div>`s / pointer-only controls | `vlmkit scan handlers page.html` |
| A scripted flow reaches its post-conditions | `vlmkit verify flow page.html --flow flow.json` |

**Against a target design:**

| Question | Gate |
|---|---|
| Am I done? (one verdict + full kickback) | `vlmkit verify markup attempt.html --target target.png` |
| What components are missing/extra/misordered? | `vlmkit build page target.png attempt.html` |
| Converge one component crop | `vlmkit build component crop.png attempt.html` |
| Normalize a @2x/@3x mock first | `vlmkit scan mock export@2x.png` |
| Copy vs target pixels (no manifest) | `vlmkit check copy attempt.html --target target.png` → read the contact sheets with your own vision; a different reader than whoever transcribed |

**Maintain:** `vlmkit heal selector page.html ".broken"` (selector
died in a refactor) · `vlmkit diff html a.html b.html` (visual
equivalence of two pages).

## Done condition

Fix loops need a FIXED gate set decided up front. Default for a
reference-free page build:

```
check integrity → CLEAN
check copy --manifest → 0 missing, 0 placeholders
scan scroll → no page-overflow-x
scan handlers → no pointer-only suspects
check interactions → no suspects
(+ check breakpoints --sweep when responsiveness is specified)
```

Re-run only the failing gate while iterating; re-run the whole set
once before declaring done. Warns are acceptable; suspects are not.

## Rules the gates enforce (do not fight them)

- **Never hide copy to pass `check copy`.** Matching is against
  visibly rendered text; font-size:0 / opacity:0 / transparent /
  off-screen / clipped / camouflaged / sr-only matches report as
  `copy-invisible` with a reason class. If the requester wants hidden
  copy accepted (e.g. sr-only), THEY pass
  `--allow-invisible <class>` — you don't.
- **Never ship disclosures open just for the copy gate.** Closed
  `<details>` / unselected tabs / `aria-expanded=false` content is
  swept automatically and passes with provenance.
- **Don't delete required content or controls to silence a finding**
  — fix what the kickback names.
- Intentional patterns (sr-only, image replacement, hero overlays,
  ellipsis) don't false integrity — they appear under `exempted`.
- A residual is real unless the tool itself demotes it
  (near-miss / pixel-confirmed / exempted annotations).

## Reading kickbacks

Kickback lines carry: the defect class, the selector, the measured
value, and often the direction (`move it instead`, `size-delta
caveat`). Trust the measurement over your recollection of the code;
when a kickback surprises you, re-render and look — do not argue with
the gate from memory. Iteration counts are recorded in
`.vlmkit/run-ledger.jsonl`; report progress from there.

## Escalation

**If the tool itself fails to run** (unknown subcommand, missing
browser, install error), STOP and report the tool failure verbatim —
do NOT silently substitute hand-rolled screenshot scripts and then
claim the work was "verified". A hand-rolled check covers a fraction
of what the gates measure (the black-box validation run that added
this rule missed 2 of 5 seeded defects that way), and a report that
hides the fallback is worse than a report that says "the tool didn't
run". An "Unknown check subcommand" error usually means the installed
release predates these gates — say so and ask for an update.

If a gate keeps failing after 3 honest fix attempts on the same
finding, stop and report: the finding, your attempts, and your best
hypothesis — a stuck loop is information, not something to hide with
a workaround. For full-workflow builds (a mock image to reproduce, a
motion brief, page composition from scratch) use the dedicated
skills: `mock-markup`, `dynamic-markup`, `auto-markup`.
