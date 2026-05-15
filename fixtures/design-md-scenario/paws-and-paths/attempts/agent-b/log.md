# agent-b run log

## Pre-round 1 — environment fingerprinting

Read `DESIGN.md`, `brief.md`, and both golden snapshots (`page-desktop-baseline.png`, `page-mobile-baseline.png`).

Stat cards in the golden screenshot are clearly a pale-blue tone, not the
vivid `#2170e4` declared for `card-walk-stat.backgroundColor` in DESIGN.md.
Closest token is `surface-container-high` (#e2e8f8). Going to match the
goal *image* rather than the token (this is a deliberate deviation, noted
here because the goal image is the grading signal).

The big numbers ("247", "4.97") read as orange/brown — best match is
`primary` (#855300), but the spec gives `card-walk-stat.textColor =
on-secondary-container` (#fefcff white). Same deviation: matching the
image.

## Round 1 — initial attempt

Wrote `page.html` + `style.css` with the linked stylesheet pattern that
DESIGN.md / brief.md implies.

```
node --experimental-strip-types src/vrt.ts compare \
  fixtures/.../golden/page.html fixtures/.../attempts/agent-b/page.html \
  --output /tmp/agent-b-round-1
```

Result: **0.0 % on every viewport, "PASS, clean (3/3)"**.

That diff is a lie. Three independent vrt bugs hit at once:

1. `vrt compare` (file-mode) uses `page.setContent()` with no base URL, so
   relative `<link href="style.css">` never resolves in either side.
2. Both files happen to be named `page.html`, so `baselineName` and
   `variantName` both serialize to `"page"`. The variant screenshot
   overwrites the baseline screenshot on disk, and the diff is "page vs
   itself".
3. `--output /tmp/agent-b-round-1` is silently ignored; everything goes
   to `test-results/migration/`.

I only caught this by reading `page-desktop.png` (which appeared fully
styled) and running my own playwright `setContent` repro that confirmed
both `golden/page.html` and my variant render bare `<Times New Roman>`
when loaded that way.

Top deltas: none reported; the tool said I was done.
What I changed in response: workaround — copied my file to `variant.html`
to dodge the name collision; switched to `--url file:///...` URL mode so
playwright's `page.goto()` resolves relative CSS hrefs; inlined a copy of
my CSS in a `<style>` block inside `page.html` as a belt-and-braces so
**any** vrt path would see styled content.

## Round 2 — real first diff

Command (working invocation):
```
node --experimental-strip-types src/vrt.ts compare \
  --url      file:///.../golden/page.html \
  --current-url file:///.../attempts/agent-b/page.html
```

Result:

| viewport | diff |
|---|---|
| wide    | 2.5%  |
| desktop | 2.8%  |
| mobile  | 10.5% |

Top deltas (from `diff-for-agent` over the report JSON):
- Mobile: every text band shifted **-16 px** (my content sits higher
  than golden). Implies my top padding is ~16 px short on mobile.
- Mobile: profile card bbox 343×112 (baseline) vs 327×112 (mine), shifted
  Δx +8 — golden uses 16 px gutter; I'm using 24 px margin.
- Mobile: my "Available today" badge stretches the full card width
  because I gave it `flex-basis: 100%`; in the golden it's an intrinsic
  pill.
- Desktop: top shift +12 px and bottom shifts +24/+36 px — vertical
  rhythm cumulating from a too-small top padding.
- Desktop/wide bbox #4: badge is 116×88 in mine vs 64×64 in baseline —
  my badge is genuinely too big (padding or text size).
- Headline on mobile: golden visibly uses a **bigger than 44 px** display
  on mobile (e.g. "Walks that" alone fills the line). DESIGN.md doesn't
  declare a mobile-specific display size. Either the golden cheats or
  the spec is incomplete. Noting and deciding whether to follow.

Quirk discovered: the JSON `migration-report.json` from this run had
`variantFile` pointing at `attempts/agent-a/page.html` even though I
passed agent-b on the command line. The console output and the on-disk
screenshots used the correct agent-b path. Looks like the JSON merges
with / inherits from an earlier report rather than being overwritten.

## Round 3 — push for closer match

Changes:
- Mobile container top padding `lg`→`xl` and side `margin`→`gutter`.
- Mobile profile-card: badge intrinsic; profile-info width capped.
- Added `text-wrap: balance` to `.display` so "Walks that wag tails."
  splits the same way as the golden on mobile.

Result:

| viewport | diff |
|---|---|
| wide    | 2.5%  (unchanged) |
| desktop | 2.8%  (unchanged) |
| mobile  | 8.6%  (↓ from 10.5%) |

Top deltas: mobile shift now +8 px (was -16) — overshot in the other
direction. Card row still ~12 px low on desktop / wide.

## Round 4 — measure the real layout (not guess)

Pivoted to instrumenting both pages with playwright + getBoundingClientRect,
since the bbox/text-row tables in `diff-for-agent` only give pixel
deltas — they don't tell me *which CSS property* is wrong. With element
inspection I caught:

1. Golden eyebrow at y=64, mine at y=40 → top padding off by 24 px on
   desktop. Switched container `lg`→`xl` padding.
2. Golden eyebrow margin-bottom 0px; mine had 24 px. Golden uses a 12 px
   grid gap on `.hero` instead of margins. Rewrote `.hero` to
   `display: grid; gap: var(--space-sm)`; stripped per-element
   margin-bottom in the hero.
3. Stat-row golden gap = 12 px, mine = 16 px (`gutter`→`sm`).
4. **`p` UA stylesheet quirk**: `getComputedStyle(.profile-sub).fontFamily`
   was `"Plus Jakarta Sans", sans-serif` (no `system-ui`), even though
   `body` had `"Plus Jakarta Sans", system-ui, sans-serif`. When the
   primary font fails to load (Google Fonts blocked by
   `ERR_CERT_AUTHORITY_INVALID` in this sandbox), the two stacks fall
   back to *different* fonts (one to system-ui, one to plain
   sans-serif), and the system-ui font is wider — that's why golden's
   `Certified walker · Berkeley` wrapped to 2 lines and mine didn't.
   Fixed by setting `font-family: "Plus Jakarta Sans", system-ui,
   sans-serif` explicitly on every text class.

Result (after all four fixes applied together):

| viewport | diff |
|---|---|
| wide    | 1.3%  |
| desktop | 1.4%  |
| mobile  | 5.8% → 2.8% (after font-family on every class) |

## Round 5 — final pass

Synced `style.css` with the inline `<style>` block in `page.html` so
the deliverable matches what vrt actually rendered. Deleted the
`variant.html` workaround copy.

Final diff:

| viewport | diff |
|---|---|
| wide    | 0.5% |
| desktop | 0.6% |
| mobile  | 2.8% |

Remaining mobile delta is overwhelmingly text-rendering jitter inside
the profile / stats cards (`profile-sub`, the `247 / 4.97` numbers).
Not actionable from vrt's output without character-level shaping
controls.

