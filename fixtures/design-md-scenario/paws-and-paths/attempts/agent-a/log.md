# agent-a log

## Setup note (CRITICAL)

`vrt compare <baseline.html> <variant.html>` with bare paths renders BOTH pages with
stylesheets effectively missing (Chromium loads them with `about:blank` base URL or
file:// schema oddities). Diff reads **0.0%** on every viewport — a false PASS:
both renderers are equally broken. Switching to `vrt compare --url file://... --current-url file://...`
gives real signal. I lost ~5 minutes of round 1 to this.

## Rounds

### Round 1 — bare paths (false signal)
- All viewports 0.0%. Heading mismatch warning: golden uses `<h2>` for "Mia Carter".
- I confirmed via `vrt snapshot file:///...page.html` that my page actually rendered correctly. So the 0% diff was a lie.

### Round 1b — `--url file://...` (real signal)
- mobile 17.2%, desktop 3.1%, wide 2.8%
- Text-band Δy: my content was at y=50 vs baseline y=74 → I was missing ~24px of top padding.
- Mobile bbox IoU 0.18 → profile card layout very different (avatar wrapping below name).
- Changed: container top padding `lg → xl`, button-row margin-top `sm → md`, "Mia Carter" -> `<h2>`.

### Round 2
- mobile 28.0% (WORSE), desktop 3.0%, wide 2.6%
- Overshot top padding (now +24 instead of -24).
- Mobile padding-xl is too much for the smaller viewport.
- Changed: mobile padding to `space-md`, kept desktop at `xl`.

### Round 3
- mobile 15.6%, desktop 1.6%, wide 1.4%
- Wide/desktop close to PASS threshold.
- Bbox table now showed buttons matched perfectly. Remaining diff at stat cards: palette diff revealed `#e4ecfc` missing / `#dce4f4` extra → my `surface-variant` should be `surface-container-high`.
- Mobile still bad: avatar wrapping.

### Round 4
- mobile 14.3%, desktop 2.0%, wide 1.8%
- Tried `padding-top: xl` + body-lg margin-bottom `sm` (was `md`). Tiny shifts.
- Confirmed stat card color fix worked (palette diff resolved).

### Round 5
- mobile 10.3%, desktop 2.2%, wide 2.0%
- Restructured profile card: avatar+text in flex row, badge separate; show/hide via media query for badge-mobile vs badge-desktop.
- Mobile dropped substantially (15.6 → 10.3%). Desktop bumped slightly because the layered display rules collided initially (badge-status was declared after badge-mobile, overriding `display: none`). Fixed selector order.

### Final
- wide 1.8% / desktop 2.0% / mobile 10.3%

## What vrt helped with
- **Text-row Δy table** is gold — it gave me literal +/- pixel offsets per row, letting me reason about vertical spacing without guessing.
- **Component bbox table with IoU** quickly flagged mobile layout as wrong-tree (IoU 0.18) vs desktop being wrong-position (IoU 0.7+, near-uniform Δ).
- **Palette diff** caught the stat-card color in one shot — `#e4ecfc` missing → `#dce4f4` extra, with the explicit hex. I could pick the correct token directly.
- **DOM equivalence warning** told me `Mia Carter` should be a heading, which I had as a `<p>`.

## Where vrt was unhelpful / misleading
- **`vrt compare` silent failure with bare paths.** Returned 0.0% diff with no warning that stylesheet loading was broken. The only hint was a "failed-resource-load" warning about Google Fonts (which is a side issue) — nothing about my local `style.css`. This made me think round 1 was perfect.
- **`--output` flag is silently ignored.** I passed `--output /tmp/agent-a-round-1` but report always went to `/home/user/vrt/test-results/migration/`. No error, no log line.
- **The PNG saved as `page-desktop.png` was NOT the rendered variant** — it appeared to be the heatmap/diff overlay rendered against a blank canvas. The visual was completely unstyled, leading me to think my CSS was broken when really only the comparison apparatus was.
- **No way to view "variant render alone" from `compare`.** I had to fall back to `vrt snapshot` separately to see what my page actually looked like.
- **"Fix Candidates: no suggestions"** every round. The fix-candidate engine is documented as for DOM-correspondence cases, but the suggested-next-step section explicitly says "wireframe / from-screenshot mode — DOM-position-diff is empty." If that's known, the tool could still propose CSS guesses (e.g. "increase margin-top of nth section by Δy") instead of being silent.
- **Heading-mismatch warning fires only on h1/h2/h3 etc.** Wasn't aware until output told me. The brief said `title-lg` (which has no semantic implication), so this was a stealth requirement.
- **Color names not back-resolved.** Palette diff reports raw hex. I knew `#e4ecfc` ≈ `#e2e8f8` = `surface-container-high` only because I have the token table memorized in scratch. Auto-mapping to nearest DESIGN.md token name would be huge.
- **No paint-tree backend.** Crater BiDi was unavailable; the entire "Paint Tree" section was dead in every report. So I had no DOM/computed-style data — only image features.

## What I wished vrt had told me
- "Stylesheet failed to load on variant" (and on baseline). A render-sanity check for `<link rel=stylesheet>` 404s, with side-by-side flagging.
- "Container top padding differs by ~24px across viewports — try increasing/decreasing one token step on `.container` or its first child."
- A "spacing-token snap" suggestion: given a baseline Δy of +12px and my margin-top of `space-sm` (12px), it could say "try `space-md` (24px)" — token-aware suggestions.
- "Color `#e4ecfc` ≈ DESIGN.md token `surface-container-high` (#e2e8f8, ΔE 2.1)". Reverse hex→token lookup from the front matter would close the loop.
- Per-element delta when both DOM trees exist (mine matched the brief structure, golden might too). DOM-correspondence-by-text or by-role even when class names differ.
- A `--render-only` or `--show-variant` mode that emits the variant's actual screenshot during compare, not just the heatmap.
- Honor `--output`, or print where the report actually went.
