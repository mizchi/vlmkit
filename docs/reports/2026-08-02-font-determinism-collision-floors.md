# Cross-OS font determinism of the `text-collision` ink floors

2026-08-02. Backlog item "クロス OS フォント決定論の実測レポート": do the
collision gate's 2px/6px floors survive a different font rendering, in both the
bundled-font and unbundled-font conditions?

**No macOS hardware was available, and this report does not pretend otherwise.**
What it delivers instead is (a) a probe that fingerprints the corpus in one
command so the macOS half is a single run plus a diff, and (b) Linux
measurements of the perturbations that *cause* the cross-OS difference, which
bound the risk without claiming to have run on macOS.

## What is actually font-dependent

```
inkInset = clamp((lineHeight - (ascent + descent)) / 2, 0, fontSize / 2)
report iff  ox >= 6  &&  oy >= 6  &&  oy >= max(2, 0.5 * min-ink-height)
```

`ascent + descent` comes from canvas `measureText`, so `inkInset` — and through
it both `oy` and the per-pair threshold — is a function of the resolved face's
metrics. Two independent things vary across OSes:

| Condition | What differs | Modelled here by |
|---|---|---|
| **Font bundled** (`@font-face`, same file everywhere) | Same face, different rasterizer/hinting | `--hinting none` (hinting, subpixel positioning, LCD text off) and `--dpr 2` |
| **Font not bundled** (`system-ui`, `sans-serif`) | The family resolves to a *different face* | Forcing DejaVu Serif / Liberation Sans / WenQuanYi Zen Hei / bundled Noto Sans onto every element |

The unbundled case is the harsher one, and the substitution conditions model it
directly: replacing the stack outright moves metrics at least as far as
`sans-serif` resolving to Helvetica instead of DejaVu Sans.

## The instrument

`src/util/font-determinism-probe.ts` (12 unit tests). It does **not**
re-implement the gate — it drives the production `COLLECT_INTEGRITY_TEXT`
script and `findTextCollisions`, then records what the gate does not expose:
every candidate pair's **distance from its own floor**.

```bash
# same command on each OS
node --experimental-strip-types src/util/font-determinism-probe.ts measure \
  "fixtures/collision-fp-corpus/*.html" --label macos-default --out macos.json
node --experimental-strip-types src/util/font-determinism-probe.ts compare linux.json macos.json
```

Two design decisions were forced by first results:

**Near-misses are kept.** The first version recorded only pairs whose ink bands
already overlapped, which found 5 candidates across 20 pages. Pairs that clear
each other by a few px are exactly what a metric shift can push into range, so
the probe now keeps anything within 8px of touching: 121 candidates.

**A flip is classified, not just counted.** The first comparison reported three
"unstable" verdicts under font substitution. Inspecting the numbers showed the
pair had not crossed its floor — it had *disappeared*. In
`sliver-true-positive.html` two absolutely-positioned labels graze because a
`ui-monospace` string is wide enough to reach the second label's `left: 168px`;
under a proportional face the string is shorter and the labels never touch.
Both verdicts are correct for their own rendering. So the tool now separates:

- **threshold flip** — pair present in both runs, reported in one. The only
  outcome that indicts the floor.
- **geometry flip** — the overlap itself appeared or vanished. The page renders
  differently; the gate is not judging differently.

Conflating the two would have produced a false alarm about the gate, from data
that actually says the gate was right twice.

## Measured

Corpus: 6 collision-FP fixtures + 9 agent-built pages + 5 mirrored real pages
(MDN, web.dev, Wikipedia, Hacker News, W3C APG) = 20 pages, **2154 text
blocks**, **121 candidate pairs**, 1 reported at baseline. `dInk` is the
per-block `inkInset` change vs the Linux default; `dMargin` is the change in
distance-to-floor for pairs present in both runs.

| condition | dInk max | dInk p95 | dMargin max | pairs in both | **threshold flips** | geometry flips |
|---|---|---|---|---|---|---|
| DejaVu Serif (substitution) | 3.00px | 1.00px | 2.00px | 80 | **0** | 0 |
| Liberation Sans (substitution) | 2.00px | 0.50px | 10.50px | 111 | **0** | 1 |
| WenQuanYi Zen Hei (substitution) | 2.00px | 1.00px | 12.00px | 80 | **0** | 1 |
| Noto Sans, bundled woff2 | 2.50px | 1.50px | 10.00px | 90 | **0** | 1 |
| hinting/subpixel/LCD off | 0.51px | 0.00px | 0.50px | 119 | **0** | 0 |
| deviceScaleFactor 2 | 1.00px | 1.00px | 1.10px | 115 | **0** | 0 |

**Zero threshold flips under every perturbation.** Margins moved by up to 12px
(`tall-metrics.html`, whose ink band changes a lot with the face) without a
single pair crossing its floor.

### Reading it per condition

- **Bundled font** (same face, different rasterizer): `inkInset` moved by at
  most **0.51px**, p95 **0.00px** — the ink measurement is essentially
  rasterizer-independent, because `measureText` returns font-unit metrics
  scaled by font size, not rasterized pixels. dpr 2 adds at most 1.00px through
  layout rounding. Both left every verdict intact. This is the condition that
  most plausibly transfers to macOS unchanged.
- **Unbundled font** (family resolves elsewhere): `inkInset` moved by up to
  **3.00px**, p95 ≤1.5px, and verdicts still held. The three differing reports
  were all geometry: the overlap stopped existing.

## The honest limit

**One pair out of 121 sits within ±2px of its floor** (an APG table cell and
its `<kbd>` child, margin −0.8px). So this corpus cannot demonstrate that the
floor is robust *in general* — it demonstrates that under six perturbations,
including ones that move ink by 3px, nothing flipped, and that the at-risk
population is tiny. The same gap the 2026-08-01 FP re-audit hit applies here:
few pairs live near the floor, so "quiet under perturbation" and "nothing was
near the floor to begin with" are hard to separate. The p95 drift (≤1.5px)
versus the at-risk margin distribution is the quantitative answer available.

What would close it properly:

1. **Run `measure` on macOS** and `compare` against the committed Linux
   fingerprint. One command each; a threshold flip exits non-zero.
2. **Fixtures deliberately placed at the floor** — pairs engineered to sit at
   margin ±0.5px, so a perturbation *must* flip them if the floor is fragile.
   That is a corpus-authoring task, not a measurement one, and it is the real
   prerequisite for a strong claim.

Until then the claim this report supports is narrow and stated as such: the ink
measurement is rasterizer-insensitive (≤0.51px), font substitution moves it by
≤3px, and no verdict in a 2154-block corpus changed as a result.
