# Dogfood: the six probe families against pages that were not written for them

Date: 2026-08-15
Subject: `scan handlers --probe drag,wheel,hover,menu,touch,input`
Question: do these rules fire on real pages, and do they fire on the wrong ones?

The fixtures for each family exist to prove the rule can separate a defect from its control. They
say nothing about how often the rule is wrong on a page that never heard of it. This is that
measurement.

## Corpus 1 — ten pages in this repo, written for other gates

`--probe all` on each. Every one exits 0 for the new rules; **zero findings from the six new
families across all ten**.

That number is only meaningful with the second column, because "no findings" and "nothing measured"
print the same way:

| page | what the probes actually measured |
|---|---|
| `css-challenge/form-app.html` | 4 text fields typed into 3× each, **10 hover triggers** hovered and focused |
| `css-challenge/page.html` | 12 handler rows; hover triggers from its stylesheet |
| `css-challenge/dashboard.html`, `ecommerce-catalog.html`, `blog-magazine.html` | same shape |
| `auto-markup-proof/interactive/reference-widgets.html` | 10 handler rows, keyboard-wired widgets |
| `forced-state-demo/page.html`, `multi-state/hover-button/*.html` | hover triggers |
| `examples/story-gallery/index.html` | no targets — reported as such, not as clean |

The interesting column is `form-app.html`: **ten elements matched by `:hover` selectors**, every one
of them reporting `hover reveals nothing, focus reveals nothing`. Those are hover *styling* — a
background change on a tab, a border on an input — and the rule is about hover *revealing*. Ten
chances to be wrong, taken zero times. The same page's four text fields kept both the ASCII and the
Japanese sample, so `text-input-rejects-non-ascii` stayed silent on real form markup.

## Corpus 2 — a real application

<https://moonlight.mizchi.workers.dev/>, an SVG editor, mirrored locally (Chromium still has no
outbound network in this sandbox; `curl` does, so the shell and both JS assets are served from
`127.0.0.1`). 64 registrations across 21 elements.

### One new true positive: every toolbar tooltip is mouse-only

```
suspect [hover-only-reveal] div>div>div>button "1" reveals #tooltip-1 on hover and nothing on
focus … 17 elements on this page derive the same path, so this is the pattern rather than one
control — the probe drove the first of them.
```

Verified by hand rather than trusted, because a `:focus-visible` reveal would look identical to the
probe from the outside:

- 17 tooltips exist in the DOM (`Rectangle`, `Circle`, `Ellipse`, `Line`, `Arrow`, `Text`,
  `Free Draw`, `Undo`, `Redo`, `Zoom Out`, `Zoom In`, `Fit to Canvas`, `Grid Snap`, `Download SVG`,
  `Copy SVG`, `Import SVG`, `View on GitHub`), all hidden at rest.
- Hovering the first button shows `tooltip-1`.
- **Tabbing through eight buttons shows none of them.**

So a sighted keyboard user tabs through seventeen icon-only buttons and is told what none of them
does. Screen-reader users are fine — every button carries an `aria-label` — which is exactly the gap
WCAG 1.4.13 names, and exactly the gap a contrast or a label check cannot see.

The `:focus-visible` worry was measured and dismissed separately: a reveal wired to
`:focus-visible` **does** respond to the probe's programmatic `focus()` in Chromium, after mouse
movement and after a click. Had it not, this rule would have a false-positive class.

### Three correct silences on the same app

| family | what it measured | why nothing is reported |
|---|---|---|
| `menu` | right-click on the canvas: 4 handler calls, browser menu cancelled, revealed `div, button, span` | a correct custom context menu |
| `wheel` | `a 200px wheel moved 0px (nothing scrolled, though something here could — the handler consumed it)` | the canvas zooms on wheel; evidence, never graded |
| `input` | 4 text fields, both samples kept | no filter to trip over |

The wheel line is the case the rule was deliberately written not to grade, appearing in the wild on
the first real app it met.

## Two defects in the tooling, both found by this exercise

**`check interactions --handlers` could not emit five of the rules it declares.** It enabled the
`drag` family alone, so `hover-only-reveal`, both `contextmenu-*` rules,
`touch-handlers-not-invoked` and `text-input-rejects-non-ascii` were tunable through that gate and
unreachable through it. The mirror image of the undeclared-rule error the runner already catches —
and invisible to that check, because declaring more than you emit is not an error. It now drives
every family, which is consistent with a gate that already fires keys at every control, and the
tooltip finding above appears through it.

**A finding named one button where seventeen share the blame.** `describe()` derives the same path
for every icon-only button in that toolbar (no `id`, no `class`), so the probe visits the first and
the message read as though that button alone were at fault. It now says how many elements derive the
same path, which turns "this button" into "this pattern".

## Reproducing

```bash
mkdir -p /tmp/moonlight/assets && cd /tmp/moonlight
curl -sS https://moonlight.mizchi.workers.dev/ -o index.html
for a in $(grep -oE '/assets/[A-Za-z0-9._-]+' index.html | sort -u); do curl -sS "https://moonlight.mizchi.workers.dev$a" -o ".$a"; done
python3 -m http.server 4931 &

vlmkit scan handlers http://127.0.0.1:4931/ --probe all
vlmkit check interactions http://127.0.0.1:4931/ --handlers
```

The asset filenames are content-hashed and change with each deploy; read them out of `index.html`
rather than copying them from here.
