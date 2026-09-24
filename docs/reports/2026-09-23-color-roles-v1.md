# check color v1 — what a page's colours are for, and one gate that could not see them

2026-09-23

Two questions, asked together: can the base / body / link colours be extracted
from a render deterministically, and is there anything about a palette worth
gating on? Same method as the composition rounds — probe 14 mirrored
professionally designed pages first, let the measurement pick the rules, and
write down what gets rejected.

**The round's largest finding is not a rule.** The colour parser both existing
contrast gates share understood `rgb()` only, so `vlmkit check a11y contrast`
had been inspecting **10 of 1068 elements** on tailwindcss.com/docs and calling
the page clean. That is fixed, and the fix is worth more than the gate.

## Part 1 — the gate that could not see modern colour

`getComputedStyle` does **not** normalise non-legacy colour functions to
`rgb()`. Chromium returns them verbatim, so a Tailwind v4 `oklch()` token
computes to:

```
color = lab(1.90334 0.278696 -5.48866)     (Tailwind gray-950)   x146 elements
color = lab(35.6337 -1.58697 -10.8425)                            x209
color = lab(98.1434 -0.369519 -1.05966)    (slate-50)             x71
```

`parseColor` in `CONTRAST_BACKGROUND_JS` matched `/rgba?\(([^)]+)\)/` and
returned `null` for all of them. Every caller drops a colour it cannot parse, so
`check a11y contrast` and `check integrity`'s contrast rule were blind to the
whole page:

| | before | after |
|---|---|---|
| text-bearing elements inspected | **10** | **501** |
| findings | 1 — `#ffffff` on `#ffffff` at 1.00:1 | 4, all real |

The one "failure" before the fix was an artifact of the same bug: an unreadable
background falls through to the white default. Afterwards it is gone, and what
appears instead is genuine — `#99a1af` on `#ffffff` at 2.60:1
(`text-gray-400`), `#00a6f4` on `#ffffff` at 2.71:1 (`text-sky-500`), and the
same pair inverted on a numbered badge. **The fix removed a false positive and
found four true ones.**

Worse than wrong, it was quiet. The gate's coverage line said "inspected 10
text-bearing element(s), 1 not measurable" — the ~850 it could not read appeared
in **neither** count. That is precisely what `contrast-background.ts`'s own
header calls unacceptable ("a contrast check that silently drops the elements it
cannot read is indistinguishable from one that found them acceptable"), one
colour syntax later.

### How big is the blind spot, really

Measured across the corpus rather than asserted:

```
page             boxes   text   unreadable text colour
tailwind          1090    576   566  (98%)   color x783  lab(1.90334 …)
mdn               4735   1585     0          backgroundColor x4  oklch(0.97 0.032 155)
(the other 13)                     0
                        ------   ---
                        10066    566  (5.6%)
```

So this is **not** a broad blindness across the web today. It is a **total** one
on any page built with a current colour syntax, reported as a clean page with a
plausible coverage number — and Tailwind v4 ships `oklch()` as its default
palette, so the affected population is "sites built with current Tailwind".

### The fix, and the thing that did not work

`ctx.fillStyle` alone is **not** enough: it round-trips `lab()` as `lab()`.
Tested before relying on it, which is the only reason that is known here.

What works is rasterising one pixel and reading it back — the browser's own
conversion and gamut mapping, which is the colour on screen and the sRGB WCAG
luminance is defined on:

```
lab(1.90334 0.278696 -5.48866)  -> [3, 7, 18]        Tailwind gray-950
lab(98.1434 -0.369519 -1.05966) -> [248, 250, 252]   slate-50
oklch(0.7 0.15 250)             -> [75, 163, 247]
color-mix(in oklab, red, blue)  -> [140, 83, 162]
oklch(0.9 0.4 140)              -> [0, 255, 0]       out of gamut, mapped not dropped
not-a-color                     -> null              still a refusal
```

`rgb()`/`rgba()` keeps a fast path: exact, no canvas, no allocation per element,
and it is the overwhelming majority. Invalid values are told from valid ones with
**two** sentinels, because one would report `#010203` as rejected. Under full
opacity the rasterised bytes are premultiplied, so a second draw over opaque
black divides the alpha back out.

`contrast-background.test.ts` asserts on parsed values rather than on the source,
because the source is exactly what looked correct. The old parser returns `null`
for **8 of the 9** representative cases, so the test has teeth.

## Part 2 — the extraction

Surfaces / ink / marks, ranked by painted area, plus three named colours. Two of
the three definitions needed a measurement, and both corrections are the same
lesson:

- **The base cannot be "the largest declared background".** danluu.com declares
  **zero** backgrounds on 625 boxes and still has a base a reader sees. The
  composited page background stands in.
- **The link ink cannot be "the most-used interactive ink".** That named the
  **body** ink on **7 of the 14** pages — `#000000` for MDN, whose links are
  `#044c9f`; `#202124` for web.dev, whose links are `#1a73e8` — because
  navigation items, card titles and logos are links set in the body colour on
  purpose, marked by position rather than by hue.
- And interactive ink is counted **once per control**, not once per box inside
  it. Counting descendants let css-tricks' nav (every link wrapping a span)
  outvote the page's real link colour, 404 white to 410 blue.

After those three corrections, on the corpus:

```
page          base      body ink   link ink
a11yproject   #f7f7f7   #000000    #232d71
caniuse       #3d3527   #ffffff    #0046d1
chromedev     #ffffff   #202124    #1a73e8
csstricks     #eaeaea   #434343    #0089c7
danluu        #ffffff   #000000    #0000ee    (no declared surface at all)
hackernews    #f6f6ef   #828282    #000000    (its links really are black)
mdn           #ffffff   #000000    #044c9f
mdn-learn     #ffffff   #000000    #044c9f
nngroup       #ffffff   #000000    #385aff
smashing      #ffffff   #333333    #ffffff    (white nav links outnumber the brand red)
tailwind      #ffffff   #4a5565    #030712
w3c-apg       #f2f2f2   #000000    #002a56
webdev        #ffffff   #202124    #1a73e8
wikipedia     #ffffff   #202122    #3366cc
```

**Twelve of those fourteen name the colour a reader would name.** The two that
do not are Smashing's `#ffffff` (its white nav links on the red header outnumber
the brand red `#d33a2c` 62 to 35) and the Tailwind docs' `#030712`. Both are
literally what the definition says — the page's most numerous non-body link
colour — and chasing the brand colour instead would need a "what counts as an
accent" threshold, which is the trap Part 3 records.

> **Correction (2026-09-24).** Two rows above were measured on content that is never
> painted. The collector's visibility test read an element's size, and a closed
> `<details>` element's descendants still report one, because asking for a size forces
> layout. So the palette counted 5615 collapsed elements on css-tricks, 3372 on MDN, 554 on
> mdn-learn and 479 on a11yproject. It now asks `checkVisibility` — which reports collapsed
> content as hidden — without the `content-visibility: auto` flag, so Smashing's off-screen
> footer, which is real paint, still counts. Findings and verdicts are unchanged on all
> fifteen pages, so Part 4's eight `color-only-link` rows are the same eight, now out of
> 2627 painted links in a flow rather than 4899 (0.3%, not 0.16%). The named colours that
> moved:
>
> ```
> page          base      body ink   link ink
> csstricks     #262626   #000000    #0089c7    was #eaeaea / #434343: its collapsed comments
> a11yproject   #f7f7f7   #000000    #707070    was #232d71: every one of 147 in the collapsed checklist
> ```
>
> css-tricks is a straight correction: `#eaeaea` appears nowhere on its rendered page, which
> is a `#262626` frame round a white article. a11yproject's old `#232d71` was never on the
> initial screen, and the new value, `#707070`, is its grey nav: 18 of them outnumber the 7
> visible prose links in `#3b4bbf`. That is Smashing's case, not a reader's colour. So the count
> above is **eleven of fourteen**, not twelve, and the twelfth was only correct by counting
> links nobody can see.

## Part 3 — what was rejected

Three candidates, measured on the same 14 pages. **The first two run backwards**,
which is the third time that has happened in this project.

### base/main/accent against 70:25:5

The slogan every design guide repeats. Scored against rendered area share:

```
page          base    2nd     3rd    | off by
csstricks     39.6%   26.9%   23.3%  |  51
w3c-apg       44.6%   44.0%    4.0%  |  45
caniuse       60.8%   32.2%    3.7%  |  18
nngroup       73.8%   15.0%    6.2%  |  15   ← the closest page on the corpus
mdn-learn     78.4%   14.1%    5.5%  |  20
tailwind      79.9%   10.6%    7.8%  |  27
a11yproject   90.4%    6.8%    2.7%  |  41
webdev        91.4%    2.5%    2.4%  |  47
chromedev     95.5%    1.9%    1.3%  |  52
hackernews    97.6%    2.2%    0.3%  |  55
```

**Every one of the 13 measurable pages misses it by 15 to 55 points**, with base
shares from 39.6% to 97.6%. A rule scoring against the slogan reports all of them
as wrong. Rendered area share is dominated by whichever background is largest,
which is a layout fact; the slogan is advice for a person choosing a palette, not
a property of a render. **Rejected.**

### Palette sprawl

Distinct colours per page: `3, 8, 12, 15, 17, 17, 22, 22, 23, 23, 26, 29, 31, 35`.
No clustering, and the most carefully built pages are at the top — Smashing has
20 distinct surfaces, the Tailwind docs 16 distinct inks. Designed pages use
**more** colours, exactly as they use more font sizes. Same trap the type-scale
candidates hit in `docs/design/composition-metrics.md`. **Rejected.**

### Accent role collision

The hypothesis: the interactive colour leaking into static text means a reader
cannot tell what is clickable. It fires on **13 of 15 pages**, and the collisions
are the body ink:

```
wikipedia   #202122   static=257  interactive=5
csstricks   #ffffff   static=792  interactive=406
mdn         #000000   static=32   interactive=1287
webdev      #202124   static=149  interactive=59
```

A link styled in the body colour is the **norm**, not the defect — nav items,
card titles, logos, all marked by position instead of hue. The hypothesis had the
direction backwards, and the same finding is what made `findLinkInk` need its
"not the body ink" clause. **Rejected**, and it paid for itself by fixing the
extraction.

## Part 4 — the two rules that survived

Both carry **WCAG's own 3:1** rather than a number chosen here.

### `control-boundary-invisible` (WCAG 1.4.11 Non-text Contrast)

A text control whose own boundary — fill or strongest border — is under 3:1
against the surface behind it, with no shadow or outline drawing an edge either.
`check a11y contrast` never looks at this: it measures text against its
background, and a field's boundary is not text.

The two populations do not touch, so nothing was fitted:

```
firing (all 4)                                non-firing (7 of the 11)
nngroup   #search            0     no edge    csstricks textarea#comment   15.70
nngroup   #newsletter-email  0     no edge    csstricks input#input_3_1     8.22  +shadow
chromedev book-nav filter    1.08             chromedev css-check input     5.89
smashing  #mce-EMAIL-hp      1.09             caniuse   #feat_search        4.59
                                              smashing  #js-search-input    4.76  +shadow
                                              wikipedia #searchInput        4.52  +shadow
                                              hackernews form input         4.18
```

The four remaining non-firing controls are css-tricks' comment-form fields, all
at 15.70.

**3:1 sits in an empty band between 1.09 and 4.18.** Three were verified by
screenshot: NN/g's newsletter field on its dark footer shows a caret and nothing
else. The fourth (Smashing's white field on a `#e7f8ff` panel, 1.09:1) is
technically a failure and visually marginal — faintly visible on a good display,
hard for a low-vision reader. Said plainly rather than counted as unambiguous.

### `color-only-link` (WCAG 1.4.1, technique G183, which names 3:1)

A link inside a flow that **also holds its own prose**, marked off from that
prose by colour alone — no underline, no weight step, no border, no fill — and
under 3:1 against it.

**8 of 4899 links in a flow, 0.16%, and every one verified** by computed style
(`text-decoration: none`, `font-weight: 400/400`, `border-bottom: 0px none`) and
two by screenshot:

```
caniuse    #0046d1 in #000000  2.80:1  71ch   "…supporting an older version of the…"
csstricks  #ff7a18 in #909090  1.22:1  32ch   "Coming back really, really soon! See past issues →"
nngroup    #385aff in #676767  1.10:1  87ch   a figure caption
webdev     #185abc in #202124  2.47:1  201ch  the content footer (x3 elements, 1 row)
wikipedia  #bf3c2c in #202122  2.99:1  24ch   a red link inside a citation
```

The caniuse screenshot is the clearest case: two blue links in black prose with
no underline, which in greyscale is uniform text.

**The "flow holds its own prose" condition is the whole rule**, the same way
`measureProximity`'s "boundary must be a preceding sibling" is. danluu.com is
**210 undecorated `#0000ee` links at 1.7:1** against its body colour and is not a
finding, because every row is a link — there is no sentence for one to hide
inside. A list of links is a list, not a trap. The 15-character floor sits in a
measured gap: danluu's rows carry 0-4 characters of own text, MDN's breadcrumb
separators 1-3, and the shortest genuine sentence-with-a-link on the corpus is
Wikipedia's 24.

### `check a11y contrast` passes all eight

This is the disjointness proof the repo asks for, and it is not a coincidence:
caniuse's `#0046d1` is **8.2:1** against its `#f2e8d5` background and **2.8:1**
against the sentence it sits in. The existing gate is right about the criterion
it measures. Nobody was measuring the other one.

## Sensitivity and false-positive rate

Paired mutants, each the intact page plus one overriding rule:

| fixture | verdict | findings |
|---|---|---|
| `colored.html` | CONSISTENT | — |
| `link-color-only-broken` | COLOR-DEPENDENT | `color-only-link` x1 |
| `control-boundary-broken` | COLOR-DEPENDENT | `control-boundary-invisible` x1 |
| `link-no-cue-broken` | COLOR-DEPENDENT | `link-no-cue` x2 |

Each mutant fires **only its own rule**; the intact page fires nothing. The
intact fixture is authored in `oklch()` on purpose, so it also exercises Part 1
end to end — `oklch(0.99 0.002 250)` resolves to `#fbfcfd`.

On the live corpus **7 of 14 pages report**, and — unlike the composition
round, where 7 of 14 flipped and every one was a false positive — these are
**true positives**: four invisible control boundaries and five colour-only link
rows, all verified above. Three of the nine are marginal against the standard's
own floor (2.80, 2.99, 2.47 against 3.0; and Smashing's 1.09 boundary), which is
said here rather than rounded away.

## Checks

- 23 unit tests on the pure judge; two caught real defects before shipping —
  `findBase` silently depended on its input being pre-sorted, and the `--allow`
  path called `applySelectorAllowRules` with the wrong signature and would have
  crashed on first use.
- 2 browser tests on `parseColor`, asserting values rather than source.
- 30 gates / 191 rules; `check color`'s formatter is rule-settings aware, which
  the registry test requires by naming any gate that is not.

## Reproducing

```bash
bash output/live-corpus/mirror.sh
python3 -m http.server 8099 --directory output/live-corpus/pages &
node output/live-corpus/color-syntax-blindspot.mjs   # Part 1, per page and property
node output/live-corpus/color-probe.mjs              # Part 2, the palette by role
node output/live-corpus/color-candidates.mjs         # Parts 3 and 4, per element
vlmkit check color fixtures/color/colored.html
```

## Still open

- **Hover and focus cues are not read.** G183 accepts a non-colour cue that
  appears on hover and focus; this measures the default state only, so a page
  that underlines on hover and clears 3:1 is already not reported, but one that
  underlines on hover and does **not** clear 3:1 is reported and is arguably
  compliant-in-spirit. Driving `:hover` needs the interaction machinery
  `check interactions` already has.
- **Non-text contrast is only measured on form controls.** WCAG 1.4.11 also
  covers icons that carry meaning, focus indicators and graphical objects. Icons
  are the obvious next round and need the pixel path, not computed style.
- **One page kind is still missing from the corpus**: everything here is
  content-led. `reactdev` exercises `nothing-judged` but is a blank SPA shell,
  not an app with rendered controls.
