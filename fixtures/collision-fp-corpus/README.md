# text-collision false-positive corpus

The gate for the **ink-extents collision upgrade** (TODO.md backlog).

## Why this exists

`findTextCollisions` compares text-block *bounding boxes*: a pair is a
collision when they overlap by ≥ 6px on **both** axes and by ≥ 25% of the
smaller block's area. The 2026-08-01 round-10 review correctly pointed out
that boxes are not ink — a 3px×18px sliver that looks broken is below the
floor, and the fix is to compare glyph ink extents
(`Range.getClientRects()` / `measureText().actualBoundingBox*`).

That change is deliberately **not** made yet, because loosening this floor
is the textbook way a gate starts crying wolf. The 2026-08-01 FP re-audit
(`docs/reports/2026-08-01-fp-reaudit.md`) tried to serve as its gate and
could not: the 8-page real-site corpus produced exactly **one**
`text-collision` finding, which cannot distinguish "looser floor, still
quiet" from "nothing was near the floor."

These fixtures are the missing corpus: layouts where box overlap is large
and legitimate, so a naive ink-extents switch would light them up.

## The pages

Every page here is **correct markup that must stay CLEAN**. Each isolates
one construct where line boxes overlap without glyphs touching:

| File | Construct | Why boxes overlap but ink does not |
|---|---|---|
| `tight-leading.html` | `line-height: 0.8` display type | line boxes overlap vertically by ~20% of font size |
| `negative-margin-heading.html` | `h1 { margin-bottom: -0.15em }` | the classic kicker/heading pull-up |
| `tall-metrics.html` | font stack whose ascent+descent > 1em at `line-height: 1` | line boxes overlap by construction |
| `vertical-writing.html` | `writing-mode: vertical-rl` columns | axis-aligned boxes of vertical text overlap horizontally |
| `rotated-labels.html` | `transform: rotate(-45deg)` chart labels | AABBs of rotated text intersect heavily |
| `sliver-true-positive.html` | a genuine 3px×18px graze | the one page that SHOULD become a finding after the upgrade |

The last file is the counterpart: it is currently a **false negative**
(below the floor, unreported), and a successful ink-extents upgrade is
expected to start reporting it *while the other five stay clean*.

## How to use it as a gate

```bash
# baseline, current floor (expected: 5 clean, 1 missed graze)
for f in fixtures/collision-fp-corpus/*.html; do
  echo "== $f"
  vlmkit check integrity "$f" --viewports 1280 --json \
    | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
        const r=JSON.parse(s);
        console.log(r.findings.filter(f=>f.kind==="text-collision").length,"collision finding(s)")})'
done
```

## Status (2026-08-01): half the upgrade shipped, half still gated

Building this corpus immediately found a **live false positive**:
`negative-margin-heading.html` reported a collision with the shipped gate.
Measured ground truth (each string rendered in isolation, darkest-pixel
rows compared): kicker ink ends at row 51, `h1` ink starts at row 54 — a
**2px clear gap**, while the line boxes overlapped 7px. The gate was
reporting an idiomatic kicker/heading pull-up as a defect.

That split the "ink extents" idea into two independent halves:

- **(a) ink confirmation as a filter — SHIPPED.** Blocks are shrunk to
  their measured ink band (canvas `actualBoundingBoxAscent/Descent` vs the
  line box) before the overlap test. This can only *remove* findings, so
  it carries none of the cry-wolf risk. All six pages here are now clean
  and a genuine 133×8.8px overlap still fails.
- **(b) lowering the floor to catch slivers — STILL GATED.** This is the
  half that adds findings, and it is what `sliver-true-positive.html`
  measures. That page is a documented false negative today (0 collisions).

Note the ratio bug (a) surfaced on the way: measuring overlap on the ink
band while dividing by the *box* area silently tightened the gate — a real
collision fell from 0.32 to 0.19 of the smaller area and disappeared. Both
sides of the ratio must use the same units.

### Half (b) SHIPPED too (2026-08-01, later the same day)

Measuring this corpus showed the blocker was never the 6px floor — it was
the **overlap-area ratio**. The graze scored 0.172 of the smaller block's
area against a 0.25 gate, while a legitimate `line-height: 1` stack scored
0.077 and the pull-up 0.137: overlapping populations, so area cannot
separate them. By **vertical ink-overlap fraction** the same three are
**1.000 / 0.077 / 0.137** — a 7x gap. The gate now requires
`oy >= max(2px, 0.5 x the shorter block's ink height)`; the area ratio is
retired (`minOverlapRatio` accepted and ignored, `minInkOverlapFraction`
added).

Gate criterion, met exactly: five legitimate pages **0**,
`sliver-true-positive.html` **1**.

Real-page A/B (8 mirrored pages x 3 viewports, pre-session revision vs
current): **0 new collisions, 16 disappeared.** The 16 were all
pre-existing false positives that the area ratio had been *masking* rather
than avoiding:

- **MDN 14 -> 0** — items inside a CLOSED `<details>` keep layout boxes
  (measured 184x56 at y=9137, `checkVisibility() === false`) and stack
  perfectly, so they scored a 1.0 ink fraction. The text-block collector
  checked self `visibility`/`display`/`opacity`, none of which express
  content-visibility skipping. Now filtered with `checkVisibility()`.
- **APG 2 -> 0** — `li x li > kbd` pairs: an element paired with its own
  inline descendant, never a collision.

So the loosening added zero false positives on real markup and removed 16.

### Gate for any future change here

The upgrade passes only if:

1. the five legitimate-overlap pages still report **0** collisions, and
2. `sliver-true-positive.html` reports **1**.

Use `src/util/ab-arm-setup.sh` to run it as a proper A/B against the
pre-change revision — and heed its warning: prove the arms differ before
reading any result.

### Font-metric fingerprint (`fingerprints/linux-default.json`)

The floors are functions of the resolved font's metrics, so the same page can
in principle be judged differently on another OS. `fingerprints/` holds this
corpus's baseline — every candidate pair's distance from its own floor, as
measured on Linux with Playwright's bundled Chromium.

To check another platform:

```bash
node --experimental-strip-types src/util/font-determinism-probe.ts measure \
  "fixtures/collision-fp-corpus/*.html" "fixtures/auto-markup-proof/creative/*.html" \
  --label macos-default --out macos.json
node --experimental-strip-types src/util/font-determinism-probe.ts compare \
  fixtures/collision-fp-corpus/fingerprints/linux-default.json macos.json
```

`compare` exits non-zero only on a **threshold flip** — the same overlap judged
differently. A pair that stops overlapping entirely (font substitution changes
text width, so absolutely-positioned labels can clear each other) is reported
separately as a geometry difference, because both verdicts are then correct for
their own rendering.

Linux perturbation results — 6 font/rasterizer conditions, 0 threshold flips,
ink drift ≤0.51px for a bundled face and ≤3px under whole-stack substitution:
`docs/reports/2026-08-02-font-determinism-collision-floors.md`. That report is
also explicit about what is still missing: only 1 of 121 pairs sits within 2px
of its floor, so fixtures deliberately placed *at* the floor are the real
prerequisite for a strong robustness claim.
