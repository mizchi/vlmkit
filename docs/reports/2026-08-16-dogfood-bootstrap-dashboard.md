# Dogfood: Bootstrap's dashboard example — a light-theme app with a data table

Date: 2026-08-16
Target: <https://getbootstrap.com/docs/5.3/examples/dashboard/>
Ask: another real page, different in kind from the last one.

## Why this page

The previous round (`2026-08-16-dogfood-vite-dev-docs-site.md`) was a dark, marketing-and-docs
VitePress site. This one differs on every axis that matters to these gates: **light theme**, a
**data table**, a **sidebar nav**, **form controls**, a **canvas chart**, and theming by
`data-bs-theme` attribute rather than a class. It is also markup thousands of projects ship
nearly verbatim, so a false positive here is a false positive everywhere.

**Mirror**: 7 files, 584 KB, served from `127.0.0.1:4400`. Chromium still has no outbound network
in this sandbox, so the page and its assets were fetched with `curl`; the one third-party
reference (`cdn.jsdelivr.net` for Chart.js) was fetched and rewritten to a local path, which is why
this mirror reports **zero failed requests** where the vite.dev one had nine. Renders faithfully:
288 elements, `data-bs-theme="light"`, 1 table, 11 inputs/buttons.

---

## Finding 1 — `check a11y contrast` reported 0 failures on a page with 11

The headline result, and it took two gates disagreeing to see it:

```
check integrity      ! [low-contrast-text] … rgb(13,110,253) on rgb(248,249,250) is contrast
                       4.27:1 — below the 4.5:1 WCAG AA floor for 14px body text. 11 element(s)
check a11y contrast  ✓ 0 contrast failure(s)      (inspected 10 text-bearing element(s))
```

Two gates in one toolkit, one page, opposite answers — and the wrong one was the gate whose entire
subject is contrast. Bootstrap's `.nav-link` colour on its `bg-body-tertiary` sidebar really is
4.27:1, so `check integrity` was right.

**Two causes, and the second is worse than the first.**

*Dedup by a lossy path.* `analyzeA11yContrastSamples` keyed its dedup on `path` alone, and
`shortPath` keeps a tag plus its first two classes per ancestor — so all twelve sidebar links
serialize to `…>li.nav-item>a.nav-link.d-flex`. Twelve samples became one, and the one kept was the
first: the `.active` link, which is `#2470dc` and lands at **exactly 4.50** — passing. Eleven
failures were dropped by a tie-break nobody chose.

| Link | Colour | Ratio | Verdict |
|---|---|---|---|
| `.active` (first in DOM) | `#2470dc` on `#f8f9fa` | 4.50 | AA — passes |
| the other eleven | `#0d6efd` on `#f8f9fa` | 4.27 | **fail** |

*The same logic in two places.* Fixing the exported `analyzeA11yContrastSamples` changed nothing
at the CLI, because `runA11yContrast` — what `check a11y contrast` actually calls — re-implemented
the dedup and the finding construction inline. The exported one is what `vlmkit diff-pr` calls. So
the CI gate and the CLI could report different WCAG results for one page, and I reproduced that
exactly by fixing one copy. This is the repo's own recorded failure pattern ("the same thing in two
places and only one gets fixed"), caught in the act.

**Fixed.** The dedup key is now the finding's identity — path plus foreground, background, font size
and weight, i.e. the inputs the verdict is computed from. Same selector with different colours is
two cases; same selector, colours and size is one, and the finding carries `elements: 11` so
"1 contrast failure" no longer reads as one link. `runA11yContrast` calls the shared function.

```
✗ 1 contrast failure(s)                       (inspected 105 text-bearing element(s))
  …>li.nav-item>a.nav-link.d-flex — 4.27:1 (need 4.5) — `#0d6efd` on `#f8f9fa` — "Orders" 11 element(s)
```

Both gates now say **11 element(s)**. The coverage line moved from 10 to 105: it had been reporting
the size of the dedup map under a label reading "text-bearing element(s)" — a 10x understatement of
what was inspected, in the reassuring direction.

An existing test asserted the old behaviour by name — `"dedupes by path — first sample wins"`, with
two different colours under one path. That test was the defect written down as intent; it is
replaced, with the reason recorded in it.

---

## Finding 2 — a `position: fixed` control read as a focus-order defect

```
✗ 1 finding(s)
  [reverse] Focus moved up by 662px (from `div.dropdown.position-fixed>button#bd-theme` at y=662
            to `header.navbar.sticky-top>a.navbar-brand` at y=0)
```

Exit 1. The theme switcher is `position: fixed bottom-0 end-0` and sits eleventh in `<body>`, so Tab
reaches it **first** and the second Tab goes to the navbar. Measured: `position: fixed`,
`z-index: 1500`, DOM index 11 of 267.

One of those two `y` values is a position on screen and the other a position in the document.
Comparing them says nothing about reading order — and the pattern is the one **skip links** are
built from, so this fires on a well-known accessibility idiom.

**Fixed.** The focus sampler records whether the element (or an ancestor) is `fixed`/`sticky`, and a
`reverse` or `skip-row` across a pinned element is not reported. `trap` still is: focus stuck on one
element is a trap wherever it is painted, and a pinned dialog is a common place to get stuck. The
gate now *says* the policy applied rather than silently reporting nothing:

```
✓ 0 finding(s)
  2 focusable element(s) are viewport-pinned (fixed / sticky); jumps into or out of them are
  not read as order defects
```

`pinned` is optional on `FocusStep`, so a caller that built steps by hand — or a recorded run from
before the field existed — keeps every finding instead of silently losing all reverses.

Regression-checked against the previous round's target: vite.dev still reports its 4 findings, both
genuine reverses included.

This is the third gate in two rounds where the defect was **a geometric heuristic missing one
dimension** — collision missing clips, focus missing column boundaries, and now focus missing the
positioning context. Worth noting as a pattern to look for rather than a coincidence.

---

## Finding 3 — the theme-strategy fix is still unproven on a real app

`check theme` on this page: `94.3% delta`, `strategy: attribute — the dark render applied
data-bs-theme=dark`. Correct, and the attribute strategy is exactly what yesterday's change added.

But running the **pre-fix build** on the same page gives `94.2%`. Bootstrap ships
`color-modes.js`, which mirrors `prefers-color-scheme` onto `data-bs-theme` — so the media flip
worked here too, exactly as VitePress's inline script made it work there.

**Two real apps in a row bridge the media query.** That is worth recording as a fact about the
ecosystem, not just about these two pages: the media-only gate got the right answer by luck twice,
and the fixture (`fixtures/theme-strategy/class-only.html`, `0.0% → 89.0%`) remains the only
evidence that the fix matters. It probably matters for apps whose theme is a stored user choice with
`enableSystem: false` — which is common, but I have not yet dogfooded one.

## Gates that behaved well

- `check integrity`: `NO DEFECTS, 1 WARN` — the one warn is the real contrast defect above. No false
  failures on markup this widely shipped.
- `check interactions`: 18 controls probed, the theme dropdown's `expanded false -> true` reported
  correctly, 3 `inert-control` warns.
- `scan handlers`: found the Chart.js canvas (`mousemove, mouseout, click, touchstart, touchmove`,
  no role) and flagged `drag-without-keyboard-alternative` — a genuine finding on a chart canvas.
- `check tokens`: 8 off-scale warns (6 margin, 2 z-index), plausible for Bootstrap's utilities.

## Still open, seen twice now

`check a11y touch` reports **17 of 18** targets undersized at its AAA default. Every one is a
Bootstrap default: `.btn-sm` at 58x31, `.nav-link` at 211x37. The same shape appeared on vite.dev
(37 of 38). At AAA (44x44) this is arguably correct and completely unactionable — a project cannot
adopt Bootstrap and pass. WCAG 2.5.8's AA target is 24x24 with an inline exception, which most of
these would pass. Filed now that it has appeared twice: the gate needs an AA level and the inline
exception, not a quieter default.

## What this round changed

| | |
|---|---|
| Gates run | 8 against a light-theme app with a table, chart and form controls |
| Real defects fixed | 2 (`check a11y contrast` under-reporting, `check a11y focus` on pinned elements) |
| Findings recovered | 11 WCAG AA failures a gate had been hiding |
| Duplicated logic removed | 1 (the CLI path re-implemented the exported analysis) |
| Tests added | 9 |
| Filed after a second sighting | 1 (`check a11y touch` needs AA + the inline exception) |
| Fixes still unproven on a real app | 1 (theme strategy — two apps in a row bridge the media query) |
