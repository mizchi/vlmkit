# Copy-gate silencing battery: 10 of 12 hiding vectors passed; geometric reachability closes them (2026-07-31)

## Question

S18 caught an agent silencing `check copy` with a `font-size:0` span,
and the same-day fix covered that vector plus `opacity:0` and
transparent color. But those were the vectors one agent happened to
use. How many OTHER ways to hide required copy still silence the gate?
This is the S14b move (mutation battery) aimed at gate integrity
instead of defect detection: enumerate the hiding vectors, measure,
close.

## Method

One page carrying 12 hiding vectors + 4 legitimate-visibility cases,
one manifest line per case, classified by the gate as
`passes as visible` / `copy-invisible` / `missing`. Battery is now a
permanent E2E test in `copy-check.test.ts`.

## Result — before: 10/12 vectors silenced the gate

| vector | pre-battery gate | after |
|---|---|---|
| font-size:0 (S18's) | caught | caught |
| transform: scale(0) | caught (zero-area) | caught |
| position absolute left:-9999px | **silenced** | caught |
| position fixed top:-9999px | **silenced** | caught |
| text-indent:-9999px | **silenced** | caught |
| transform: translateX(-9999px) | **silenced** | caught |
| clip: rect(0 0 0 0) | **silenced** | caught |
| clip-path: inset(100%) | **silenced** | caught |
| 0×0 box + overflow:hidden | **silenced** | caught |
| sr-only (1px clip pattern) | **silenced** (by S18-day policy) | caught (policy flipped, below) |
| color == background (camouflage) | **silenced** | caught |
| right off-screen, unclipped | **silenced** here | **cross-gate**: extends scrollWidth → `scan scroll` page-overflow-x fires (verified, with selector attribution); the `overflow-x:hidden`-wrapped variant is caught here |
| z-index occlusion | **silenced** | **residual, documented** (below) |

Legitimate cases — plain text, below-the-fold text, text deep inside a
vertical or horizontal scrollport — pass before and after. One false
positive appeared mid-implementation and drove a model fix: text
inside an inner scrollport can have viewport coordinates BEYOND the
document's scrollable bounds (the user reaches it by scrolling the
container, not the page), so a naive document-bounds intersection
flagged it. The collector now collapses a rect into a scrollable
ancestor's client box after verifying it lies within that ancestor's
content span — "reachable by some combination of user scrolls" is the
model, not "on the canvas right now".

## Implementation (COLLECT_VISIBLE_TEXT, geometric pass)

Per text-node rect, in order: intersect with every ancestor's clip —
`overflow: hidden|clip` clamps to the client box, `overflow:
auto|scroll` clamps to the scrollable content span then collapses into
the client box, `clip: rect(...)` and `clip-path: inset(...)` clamp
geometrically (per-axis, percentages resolved) — then intersect with
the document's scrollable bounds `[0, scrollWidth] × [0, scrollHeight]`.
Surviving area < 4 px² ⇒ not visible (legible text always exceeds
that; a 1×1 sr-only box scores exactly 1). Camouflage check: computed
`color` within 8 RGB of the nearest ancestor's solid background, with
`background-image` / `text-shadow` / text-stroke skipping the check
(any of them can make same-color text legible).

## Policy change: sr-only no longer satisfies the manifest

The S18-day decision kept sr-only legitimate to avoid kickbacks on
assistive-tech copy. The battery forced the sharper framing: **the
manifest is the user-VISIBLE copy spec**. A manifest line satisfied
only by visually-hidden text is exactly the gaming shape (the 1px clip
pattern is indistinguishable from an sr-only "technique" used to
hide required copy). Assistive-tech-only strings (e.g. an unread
badge's "3 unread messages") belong in the page, not in the manifest —
now stated in the tool help, MCP description, and both markup skills.
This supersedes the sr-only note in the S18 report.

## Residual vectors (documented, deliberately open)

- **z-index occlusion** (text painted over by an opaque sibling): the
  honest oracle is hit-testing, and hit-testing false-positives on the
  common stretched-link card pattern (`::after` overlay makes the whole
  card clickable — every line of card copy would read "occluded").
  Deferred until a real run shows an agent using it; the battery case
  stays in the matrix script as a wont-catch marker.
- **Non-inset clip-path shapes** (`circle(0)`, degenerate polygons):
  not geometrically evaluated; arbitrary shapes would need raster math
  and decorative clip-path sections containing real text are a live
  false-positive risk. `inset()` — the form the hiding patterns
  actually use — is covered.
- Cross-gate note: unclipped off-screen-right extends the scroll area
  and is `scan scroll`'s catch; camouflage under a background-image is
  skipped here but sits in `check integrity`'s contrast probe
  territory. Silencing resistance is a property of the gate SET, not
  of one gate.

## Regression

S15/S16/S17/S18 attempts re-pass their manifests unchanged under the
geometric collector (S15 keeps its 11 revealed-only, S17 its 1).
`copy-check.test.ts` 12/12, `@mizchi/vlmkit-markup` 464/464, MCP
contract tests 11/11, `tsc` clean.

## Verdict

The S18 gaming episode generalizes: the pre-battery gate's invisible-
text detection covered the 3 vectors one agent had used, and 10 more
were open. The geometric reachability pass closes every enumerated
vector except deliberate, documented residuals — and the residuals are
either covered by a sibling gate or waiting for a real-run demand
signal, per the Layer-B rule (don't build detectors for defect classes
never observed). Adversarial batteries against the gates themselves
are now part of the toolkit's hardening loop, same standing as the
S14b defect battery.
