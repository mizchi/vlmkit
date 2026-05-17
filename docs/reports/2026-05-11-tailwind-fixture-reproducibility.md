# Tailwind blind-test reproducibility — 2026-05-11

## TL;DR

The earlier 2026-04-01 claim — "Tailwind → vanilla blind test reaches
0.0% pixel-perfect across all viewports" — was real, but the **test
fixture relied on a network-fetched CDN** (`<script src="https://cdn.tailwindcss.com">`)
and silently degrades when the sandbox blocks the CDN. Today's
re-measurement initially showed 27–31% drift at below-640 viewports;
after isolating the cause and inlining the captured Tailwind output
into a reproducible `before-inlined.html` fixture, the diff returns to
**0.0% across all 13 discovered viewports**.

## Diagnostic chain

1. `vrt compare --dir fixtures/migration/tailwind-to-vanilla --baseline
   before.html --variants after.html` reports 1.78–31.06% across 13
   viewports.
2. Visual inspection of `test-results/.../before-mobile.png` shows
   `before.html` rendering with **browser-default styling** — none of
   the Tailwind utility classes are applied.
3. Verification via Playwright with verbose logging:
   ```
   [requestfailed] https://cdn.tailwindcss.com/ net::ERR_CERT_AUTHORITY_INVALID
   font: "Times New Roman"
   ```
   The sandbox can't validate the CDN's TLS cert, so the script fails
   to load and Tailwind never injects its `<style>` tag.
4. Routing the same `before.html` through a local proxy that serves a
   pre-fetched copy of the CDN bundle (no TLS) makes Tailwind apply
   correctly, producing the same rendered pixels as `after.html`.

This is purely an infrastructure issue. The CSS in `after.html` is
correct.

## Fix: inlined fixture

To make the migration fixture network-independent (and stable across
sandboxes, CI runners, GitHub Codespaces, etc.) we baked the CSS that
Tailwind v3.4.17 generates for `before.html` into a new sibling file:

```
fixtures/migration/tailwind-to-vanilla/
├── before.html              # original (Tailwind CDN script)
├── before-inlined.html      # NEW: Tailwind output inlined as <style id="tailwind-inlined">
├── after.html               # hand-written vanilla CSS (the answer)
├── after-blank.html         # blind-test starting point (preserved)
└── after-reference.html     # archived copy of after.html
```

`before-inlined.html` is identical to `before.html` aside from:
- the `<script src="https://cdn.tailwindcss.com">` line removed
- a 9 KB `<style id="tailwind-inlined">` block (the runtime CSS Tailwind
  produces for this HTML) inserted before `<style id="target-css">`

The 9 KB block was captured by serving `/tailwind.js` from disk through
a local Node HTTP server so the CDN script could run with valid TLS,
then reading `document.querySelectorAll('style')` after the script
finished. The script tag in the original `before.html` is kept for
blind-test purposes (agents read the Tailwind class names from the
source).

## Re-measurement

```bash
vrt compare --dir fixtures/migration/tailwind-to-vanilla \
  --baseline before-inlined.html --variants after.html
```

| Viewport | Diff |
|---|---|
| mobile (375) | **0.00%** |
| sample-481 | **0.00%** |
| below-640 (639) | **0.00%** |
| at-640 | **0.00%** |
| sample-662 | **0.00%** |
| below-768 (767) | **0.00%** |
| at-768 | **0.00%** |
| sample-807 | **0.00%** |
| below-1024 (1023) | **0.00%** |
| at-1024 | **0.00%** |
| desktop (1280) | **0.00%** |
| sample-1423 | **0.00%** |
| wide (1440) | **0.00%** |

Convergence: `clean (13/13)`. Fix candidates: `no suggestions`. Diff
categories: `no changes`.

**The blind-test "0.0% pixel-perfect" result is reproducible** —
the after.html answer holds across every viewport the breakpoint
discovery system finds today, not just the four tested in 2026-04.

## Lessons

1. **VRT fixtures must be hermetic.** Any network dependency (CDN,
   Google Fonts, image hosting) introduces silent drift when the
   environment changes. The new `before-inlined.html` pattern should
   probably become the default for any future migration fixture; the
   "live CDN" version stays around for blind-test agent reading only.
2. **Pixelmatch happily averages out content+whitespace.** The reason
   the desktop diff was only 1.99% even with Tailwind completely
   broken: at 1280×900 the styled content occupies ~30% of the canvas;
   the rest is white background that both `after.html` and a
   broken-Tailwind `before.html` share. Smaller viewports
   (375/481/639) pack more visible content into the same canvas, so
   they show 27–31% diff. Lesson: tiny-percentage diffs at wide
   viewports can hide huge rendering failures.
3. **`migration-compare` could detect this class of failure.** Adding
   a "baseline rendered with default browser fonts only" sanity check
   (e.g. computed `body.fontFamily` ≠ Times New Roman when the source
   declares one) would catch CDN-failed baselines before they pollute
   diff numbers. **Implemented same day** as `src/vrt/compare/render-sanity.ts` +
   `migration-compare --strict-baseline-sanity`. Re-running the broken
   fixture now surfaces:
   ```
   Baseline render sanity warnings:
     - [failed-resource-load] External asset failed to load:
       https://cdn.tailwindcss.com/ (net::ERR_CERT_AUTHORITY_INVALID)
     - [default-font-with-classes] body font-family is browser default
       ("Times New Roman") but the HTML declares external scripts and
       class attributes — the styling pipeline likely failed to apply.
   ```

## Visual flipbook

`docs/reports/data/2026-05-11/flipbooks/01-tailwind-diagnosis.html`
walks through the three rendered states in order (broken → inlined →
matching answer) — open in any browser to see the failure mode and
the fix side-by-side.

## Files touched

- `fixtures/migration/tailwind-to-vanilla/before-inlined.html` (new, 14 KB)
- `docs/reports/2026-05-11-tailwind-fixture-reproducibility.md` (this file)
- `docs/reports/2026-05-11-data-collection.md` will reference this report
- `docs/reports/data/2026-05-11/flipbooks/01-tailwind-diagnosis.html` (new, 192 KB)
- `test-results/data-collection/migration-tailwind-inlined/migration-report.json`
  (raw output — not committed)
