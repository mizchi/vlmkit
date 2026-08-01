# copy-invisible real-site FP audit + per-class suppression (`--allow-invisible`) (2026-07-31)

## Question

The geometric visibility detector (silencing battery, same day) was
proven against synthetic vectors. Two follow-ups the battery can't
answer: (1) does it false-positive on REAL pages — sites full of
sr-only text, skip links, mega-menus, decorative clipped glyphs?
(2) some invisibility is deliberate — which classes are legitimately
suppressible, and how does a user control that on re-run?

## Part 1 — real-site audit: 0 false positives across 7 sites

Method: load each site in Chromium (this sandbox's proxy blocks
Chromium's own HTTPS, so requests were relayed through Playwright's
Node-side request context via `route.fulfill`; the CLI's URL mode
needs no such relay in normal environments), run
`COLLECT_TEXT_VISIBILITY`, and audit every text chunk the detector
classified invisible — is it actually not user-visible? A `dup`
cross-check marks chunks whose text also appears in the visible set
(a hidden twin of visible text has no gate effect).

| site | invisible chunks | audit |
|---|---|---|
| example.com | 0 | — |
| danluu.com | 0 | — |
| news.ycombinator.com | 0 | — |
| developer.mozilla.org | 213 | skip links (unreachable), closed mega-menu content (hidden/display:none), decorative hero glyphs `/ + { }` — all dup (visible twins counted visible) |
| w3.org/WAI/ARIA/apg/patterns | 7 | sr-only labels, hidden "No results found.", opacity-0 "Back to Top" |
| en.wikipedia.org Main_Page | 434 | 3 sr-only (visually-hidden), 430 collapsed-menu content (hidden), 1 zero-size |
| web.dev | 110 | transparent-until-focus skip link, closed dropdown content |

**Every flagged chunk is genuinely not user-visible in the default
state; nothing visible was flagged.** The audit also sharpened one
classification: `checkVisibility` now runs before the zero-rect check,
so `display:none` subtrees read `hidden` and `zero-size` is purely
rendered-but-zero (font-size:0, scale(0)).

Two structural observations:

- **Skip links land in different classes per site** — unreachable
  (MDN, off-screen), zero-size (W3C), transparent (web.dev),
  visually-hidden (Wikipedia) — because the hiding technique varies.
  They are focus-revealed a11y affordances and don't belong in a copy
  manifest; if one is put there anyway, the reported reason names the
  class to allow.
- **Closed menu content stays `missing`, not `copy-invisible`, at the
  gate level**: copy-invisible requires the text to be present in raw
  `innerText` (rendered but unseeable). `display:none` /
  `visibility:hidden` content never renders — that is disclosure-sweep
  territory, and conflating it with gaming would misfire on every
  mega-menu. The boundary is now stated in code.

## Part 2 — per-class suppression: `--allow-invisible`

The detector now attributes a **reason class** to every invisible
match instead of silently dropping text:

| reason | meaning | when suppressing is legitimate |
|---|---|---|
| `zero-size` | rendered at zero size (font-size:0, scale(0)) | rarely — classic gaming vector |
| `hidden` | visibility/opacity/content-visibility (checkVisibility) | rarely — opacity-0 overlays waiting for JS |
| `transparent` | `color` alpha ≈ 0 | transparent-until-focus affordances |
| `visually-hidden` | sr-only signature (clip:rect to ~0 / ≤2px overflow box) | **the main case** — team decides a11y-only text satisfies a line |
| `unreachable` | off-screen / clipped beyond any scroll reach | focus-revealed skip links |
| `camouflage` | color ≈ nearest solid background | deliberate low-observability text |
| `unknown` | in innerText, no bucket matched (spans classes) | investigate first |

Control surface, uniform across CLI / MCP / API:

```bash
vlmkit check copy page.html --manifest copy.txt --allow-invisible visually-hidden
```

- Unlisted classes stay `copy-invisible` suspects; each suspect's
  kickback names its reason and the exact flag to re-run with.
- Allowed lines are NOT silently passed: they are listed as
  `invisible-allowed: "line" (reason)` in the report, counted in the
  run-ledger headline (`allowedInvisible`), and returned in
  `allowedInvisibleLines` — the suppression stays auditable.
- Default remains strict (no classes allowed): suppression is an
  explicit, per-run decision, so an agent cannot self-serve it without
  the flag showing up in the invocation.

## Regression

copy-check tests 13/13 (new: reason attribution in the battery,
allow-one-class-not-another, E2E re-run flip), markup suite 465/465,
MCP 11/11, `tsc` clean, S15–S18 manifests unchanged.

## Verdict

The geometric detector survives contact with real-world hiding
patterns — 0 false positives over 7 sites including the sr-only-heavy
ones — and deliberate invisibility is now a per-class, auditable,
re-run-controllable decision instead of an all-or-nothing gate.
