# Dogfood: vite.dev — a real VitePress docs + marketing site

Date: 2026-08-16
Target: <https://vite.dev/> (front page, `/guide/`, `/guide/why`, `/config/`)
Ask: run the gates against another real app and fix what that exposes.

## Method: a local mirror, because Chromium still has no outbound network here

Measured first, because it decides everything else:

| Client | Target | Result |
|---|---|---|
| `curl` | `https://vite.dev/` | 200, 78,189 bytes |
| `curl` | `https://example.com/` | 200 |
| Chromium (`/opt/pw-browsers/chromium`) | `https://example.com/` | `ERR_CONNECTION_RESET` |
| Chromium | `https://vite.dev/` | `ERR_CONNECTION_RESET` |

Identical to the 2026-08-15 Moonlight dogfood: the shell has network, the browser does not. So
four pages and **93 files** (JS chunks, CSS, fonts, icons, images) were fetched with `curl` and
served from `127.0.0.1:4300`.

**Mirror fidelity, stated because every finding below depends on it.** The mirror was iterated
until the browser reported zero *first-party* request failures: page HTML, `style.css`,
`vp-icons.css`, all 6 font files, every route chunk the four pages prefetch. What remains
unreachable is nine **third-party runtime** dependencies — `cdn.jsdelivr.net` (a Rive wasm),
`sponsors.vite.dev`, three iconify mirrors, `cdn.carbonads.com`. Those fail on the live site too
from a sandbox, and one consequence of them is itself a finding (#4). Rendering is faithful: 581
elements and the real `<h1>` on the front page, 1,174 on `/guide/`, 6,782px tall.

Anyone with network access should re-run against the live URL. Nothing here depends on the
mirror except the ability to open a browser at all.

---

## Finding 1 — `text-collision` reported three FAILs on a correct page, because it ignored clips

`check integrity` on the front page: **`DEFECTS (3 fail, 16 warn)`**, exit 1. All three fails
were `text-collision`, and all three were false. Example:

```
x [text-collision] … > p:nth-of-type(2) x … > h3:nth-of-type(1) @375:
  "Community is amazing too." overlaps "Free & open source" by 129x7.6px
```

Both boxes really are at y=5707 with overlapping x — but only one of them is *painted* there. A
screenshot at that scroll offset shows "Free & open source" alone; the testimonial wall above it
is `height: 50rem` + `overflow: clip` + `mask-image: linear-gradient(...)`, and the cards past
the clip keep their layout boxes 57px into the next section.

The measured ancestor chain, which is what settled it:

| Element | overflow | mask | box | contains the text? |
|---|---|---|---|---|
| `div.pt-14.sm:pt-30.h-[50rem]` | `clip/clip` | `linear-gradient(#000 7…` | y=4850 h=800 | **no** (bottom 5650 < 5707) |

**The gate already knew how to do this.** `COLLECT_OCCLUSIONS`, in the same file, clamps its
sampling to every `overflow != visible` ancestor and says why: "hit-testing those points would
blame whatever happens to be painted there." `COLLECT_INTEGRITY_TEXT` never did, so two probes
in one gate disagreed about where text is.

**Fix.** The collision collector clamps each text rect to its ancestor clip, per rect — a
paragraph straddling the fade line keeps its visible half. Blocks clipped away entirely are
carried through to the Node side with their pre-clip box so the pair can be *exempted with a
stated reason* rather than silently dropped, and the exemption names the ancestor whose edge did
the cutting (the first version named the nearest clipping ancestor, which on this page was the
innermost card — the wrong element to go and look at).

```
verdict: NO DEFECTS, 16 WARN (0 fail, 16 warn, 14 exempted)
  - [text-collision] … @768: clipped away by div.pt-14.sm:pt-30.h-[50rem] (overflow is not
    visible) — its box still overlaps text below the clip, but no glyph is painted there
```

3 fails → 0, exit 1 → 0. `fixtures/collision-fp-corpus/clipped-fade-wall.html` reproduces it
(1 fail before, 0 after) and two tests pin both directions: clipped-away text is exempted, and a
run clipped only *partially* still collides on the part that is painted.

**Accepted cost, stated:** the clamp includes `overflow: auto/scroll`, matching the occlusion
collector. A genuine collision inside a scrollport, below the visible part, now goes unreported.
For a `fail`-severity rule that is the right side of the trade — a false fail on a real page is
what gets a gate turned off.

---

## Finding 2 — `check theme` flipped a knob half the web does not use

On `/guide/`, before any change: `theme pixel delta: 0.0%`, `unthemed components: 8 of 8`. On a
site with a working dark mode.

Why: `prefers-color-scheme` appears **zero** times in vite.dev's stylesheets. `.dark` appears
**47** times, including `:root.dark`. The gate only ever emulated the media query.

That is the majority strategy, not an edge case: Tailwind's `darkMode: "class"` default,
VitePress, next-themes, Docusaurus's `data-theme`.

**Fix.** The gate now reads the stylesheets before rendering and exercises whichever strategy is
there — media query, root class, or root attribute — with `--dark-selector` to override, and it
prints which one it turned:

```
✓ theme pixel delta: 95.4% (page broadly responds to `dark`)
    strategy: class — the dark render applied `dark` to the root element
```

**Where this dogfood could not settle it, and what did.** Re-running the *old* build on
`/guide/` also gives 95.4% — because VitePress ships an inline script that mirrors the media
query onto the class. On this app the media flip measured the bridge, not the theme, and got the
right answer by luck. So the defect is proven on a fixture instead:
`fixtures/theme-strategy/class-only.html` is the same pattern with no bridge, and it is the
common one (a stored user choice, `enableSystem: false`).

| | delta | unthemed |
|---|---|---|
| before (media flip) | **0.0%** | **8 of 8** |
| after (class applied) | **89.0%** | **1 of 8** |

The 1 is the deliberately hard-coded `.legacy` banner — the actual defect, which had been buried
among seven false ones. Six tests cover it, including that a media-query page is still called a
media-query page and that a page with neither strategy still reports `none` and gets the old
advice.

The front page legitimately stays at 0.0%: it is dark-by-default marketing design, both renders
dark. The strategy line is what now makes that legible instead of accusatory.

---

## Finding 3 — `check a11y focus` failed an idiomatic multi-column footer

8 findings, exit 1. Four were `[reverse] Focus moved up by 80px` between adjacent footer links.

The measured tab sequence says why:

```
23  x=113 y=616      27  x=245 y=656
24  x=113 y=656      28  x=245 y=696
25  x=113 y=696      29  x=391 y=616   <- flagged reverse
26  x=245 y=616  <- flagged reverse
```

Three columns. Tab goes down one, then to the top of the next. That is correct behaviour, and by
`dy` alone it is indistinguishable from a `tabindex` mistake — the missing fact is the width of
the element focus came *from*.

**Fix.** `focus_order_classify_boxes` in MoonBit takes `prev_width` and returns a new
`column-advance` transition when the next element starts at or right of the previous one's right
edge. The JSON boundary carries the width as an *optional* field: absent means "not measured"
and keeps the old verdict, so no caller is silently given the new behaviour.

8 findings → 4, exit 1 → 0. Both genuine reverses survive, and keeping them is what makes the
rule "strictly right of" rather than "moved right at all":

- 314px up **and left** — a real order break.
- 341px up in the **same column** (x=391) — two stacked lists tabbed lower-first.

Five tests, using the measured geometry from this page.

---

## Finding 4 — open: one blocked third-party asset becomes seven indistinguishable warns

Not fixed. Recorded with evidence because it will hit anyone running vlmkit in a
network-restricted CI, which is most CI.

The blocked Rive wasm produces:

```
! [js-error] @1280,768,375: console.error during post-load: Failed to load resource: … 404
! [js-error] … wasm streaming compile failed: TypeError: Failed to execute 'compile' …
! [js-error] … falling back to ArrayBuffer instantiation
! [js-error] … failed to asynchronously prepare wasm: both async and sync fetching failed
! [js-error] … Aborted(both async and sync fetching of the wasm failed)
! [js-error] … Failed to load resource: net::ERR_CONNECTION_RESET
! [js-error] … TypeError: Failed to fetch
```

Seven warns, one cause, and nothing says the cause was **cross-origin**. A reader cannot tell
"your app throws" from "your sandbox blocked a CDN". The fix is not a one-liner — the console
message does not carry the request URL, so it needs the `requestfailed` stream correlated with
the console stream, plus first-party/third-party attribution — which is why it is written down
here rather than half-done.

## Observations that are working as intended

- `check breakpoints` discovered 8 breakpoints from the CSS and called all 8 clean. No noise.
- `check a11y contrast`: 0 failures over 39 text elements. Correct — this site has good contrast.
- `check a11y touch` reports 37 undersized targets at AAA. Inline text links in a nav are
  arguably exempt under WCAG 2.5.8's inline exception; the gate has no notion of it. Lower value
  than the four above (it is a `--level` away from being quiet), so it is noted, not filed.
- `scan scroll`: 15 "dead scrollports" — VitePress's nav wrappers. Warn-level and accurate.

## What this round changed

| | |
|---|---|
| Gates run | 11 against a real 6,782px page, 4 pages |
| Real defects fixed | 3 (`check integrity`, `check theme`, `check a11y focus`) |
| False `fail`s removed | 3 collision + 4 focus, on correct markup |
| Findings the fixes revealed | 1 (`.legacy` hard-coded banner, previously 1-of-8 among false positives) |
| Fixtures added | `collision-fp-corpus/clipped-fade-wall.html`, `theme-strategy/class-only.html` |
| Tests added | 13 |
| Open, documented | 1 (finding 4) |

The pattern across all three fixes: **a geometric heuristic missing one dimension.** Collision
knew boxes but not clips; theme knew the media query but not the class; focus knew `dy` but not
width. Each was decidable from something the browser already had, and each produced
`fail`-severity findings on markup with nothing wrong with it.
