# `scan scroll` + `check breakpoints`: existence detection & boundary quickcheck (2026-07-27)

Two gaps surfaced while reviewing dynamic-behavior coverage after the
`check animation` work:

1. **Scroll existence was annotation-gated.** `contract introspect` only
   sees scrollports carrying a `data-scrollport` attribute; nothing could
   answer "what actually scrolls on this page?" for unannotated markup.
   Adjacent blind spot: unintended page-level horizontal scroll — the
   classic mobile regression — had no detector at all.
2. **Breakpoints were discovered but never verified.** `scan breakpoints`
   extracts values statically and `diff matrix` needs pre-captured PNG
   pairs; nothing rendered *at* the boundary widths where off-by-one bugs
   live.

## `vlmkit scan scroll <html|url>`

Walks every element's computed overflow + scroll metrics (Playwright, no
VLM, no annotations):

- **Scroll containers**: selector, axis, overflow px, bbox, nesting, any
  scrollport annotation found. `--json` emits `expectedScrollports`
  entries pasteable into a UI Contract — introspection of unannotated
  pages now has a path.
- **`page-overflow-x`** (suspect): the page itself scrolls horizontally;
  the message names the elements sticking out past the right viewport
  edge (widest-first).
- **`clipped-content`** (warn): `overflow: hidden/clip` swallowing more
  than `--clip-threshold` (16px) of content — cut-off suspects.
- **Dead scrollports**: `overflow: auto/scroll` declared, content fits.
  Inventory only, no issue.
- **`nested-scroll`** (warn): same-page scroller inside a scroller.

Dogfood fixture (feed + nested inner list + x-carousel + empty scroller +
clipped teaser + 1600px banner) detected all six patterns, offender
attribution included (`div.wide-banner (right edge 1620px)`).

## `vlmkit check breakpoints <html|url>`

For every breakpoint B (collected from in-page CSSOM, so external local
stylesheets count; `--breakpoints 768,1024` overrides) the page is
resized — no reload — to **B−1, B, B+1** and discrete per-element
properties are sampled: display, position, float, flex-direction,
flex-wrap, order, text-align, and grid **track count** (the computed
`grid-template-columns` string resolves to px and changes at every width
in fluid layouts — compare counts, not strings). Continuous properties
are excluded by design; they legitimately change at every width.

Boundary invariant: **value(B) must equal value(B−1) or value(B+1)** — a
width belongs to exactly one media regime.

- `boundary-spike` (suspect): property at B matches neither neighbor
  (both regimes' rules apply, or neither's).
- `boundary-gap` (suspect): element hidden — or visible — only at
  exactly B.
- `overflow-at-boundary` (warn): horizontal overflow at a sampled width.

### The orphan-width trap

The archetypal bug — `max-width: 999px` + `min-width: 1001px` — is
*invisible* to the declared-value checks: checking B=999 samples
998/999/1000 and 999 correctly matches its lower regime; checking B=1001
samples 1000/1001/1002 and 1001 matches its upper regime. The orphan
width 1000 only ever appears as a *neighbor*, never as the point under
test. Fix: adjacent breakpoints exactly 2px apart get a **synthetic
midpoint boundary** — all three widths are already sampled, so it costs
nothing. In the dogfood fixture this pinpointed both plants:

```
x boundary-spike …div:nth-of-type(2): gridColumnCount is `1` at exactly 1000px
  but `2` below and `4` above — check for max-width: 999px vs min-width: 1001px
x boundary-gap #sidebar: visible only at exactly 1000px
```

Clean fixtures (proper `max-width: 767px` / `1023px` cascade) report
`ok` with zero false positives; a `width: 900px` element inside the
mobile regime correctly raised `overflow-at-boundary` at 766/767px.

## Implementation notes

- Both tools follow the signal-tool pattern: pure exported analyzers
  (`analyzeScrollSamples`, `analyzeBoundary`, `deriveBreakpointIssues`)
  unit-tested without Playwright (16 tests), thin browser collectors.
- Playwright gotcha: `page.evaluate(script, arg)` with a *string* script
  does not invoke a resulting function value with the arg — the string
  must be a self-invoking IIFE. `collectStylesScript(maxElements)`
  interpolates the arg instead.
- CLI: `scan scroll` (discovery family) and `check breakpoints`
  (deliberately paired with `scan breakpoints` — scan discovers, check
  verifies).

## Addendum: PR #84 review fixes (Codex, all four confirmed valid)

1. **Local files now navigate via their `file:` URL** (all page-loading
   checks incl. `check motion`): `setContent()` gave the document an
   `about:blank` base URL, so relative stylesheets/scripts/images never
   resolved and the tools analyzed an unstyled page.
2. **Cross-origin stylesheets are fetched out-of-band**: CSSOM throws on
   their `cssRules`, which previously meant CDN-hosted responsive CSS
   discovered zero breakpoints — a false pass. Unreadable sheets are now
   counted in `report.stylesheets` and called out in the text output.
   Chromium quirk found while verifying: `file:`-linked stylesheets are
   *also* cross-origin (unique file origins), and Node `fetch` can't read
   `file:` URLs — those go through the filesystem.
3. **Modern range syntax** (`(width >= 768px)`, `(48rem < width)`, double
   ranges) is parsed by a dedicated extractor and merged with the legacy
   `min-/max-width` discovery; rem/em at 16px, strict inequalities ±1px.
4. **`check animation` preserves the author-visible play state**: it was
   recorded *after* `pause()`, so everything read "paused", and an
   animation the page itself holds paused (visually static) was still
   reported as `infinite-animation`/never-settling. Now settle/infinite
   only count originally-running animations, the reduced-motion pass only
   counts running ones, and the rest pose keeps page-paused/finished
   animations at their author-chosen `currentTime`.

## Files

- `packages/vlmkit-markup/src/inspect/scroll-scan.ts` (+ test)
- `packages/vlmkit-markup/src/stress/breakpoint-check.ts` (+ test)
- `src/cli/cli.ts` wiring, README, TODO.md
