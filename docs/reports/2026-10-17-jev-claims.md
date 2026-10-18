# `inspect claims`: advisory yes/no checks of what a screenshot shows (2026-10-17)

This builds item 3 of `2026-10-16-jev-box-bench.md`. A statement a page must not, or must, make
visible ("an error message", "a modal dialog open over the page", "a login form") is asked of a
screenshot as one Jev `noul`, which is the probability that the statement is true. No prose is
parsed.

```bash
vlmkit inspect claims page.html --forbid "an error message or error banner" \
  --forbid "a modal dialog open over the page" --expect "a navigation bar or tabs"   # TYPESAFEAI_API_KEY
vlmkit inspect claims shot.png --claims claims.json --json
```

- All statements share one request and one image. Jev reads the image once, and each further
  question adds about 20 tokens: 5 claims on a 1280x800 screenshot came to 3,047 input tokens,
  $0.00013, with a median latency of 185ms.
- A page (an HTML file or URL) is screenshotted at the viewport first (default 1280x800).
  `--save` keeps that screenshot.
- The exit code is 0 when every claim holds, 1 when one does not, and 2 on a usage error.
- An answer within 0.3 of the threshold is printed as `uncertain: look at it`.

It is an `inspect` leaf, not a gate. It is a model's reading of the pixels, so it never gates
anything, and the gate registry stays deterministic. Core: `checkClaims` in
`@mizchi/vlmkit-ai/claims.ts`.

## Measured

`jev-box.ts --only claims` covers the 9 CSS-challenge fixtures at 1280x800. Each is captured
clean, and then with each of five defects planted in the viewport:

| plant | what it is |
|---|---|
| error-banner | a red banner: "⚠ Something went wrong. We couldn't save your changes." |
| modal | a dimmed overlay with a "Delete this project?" dialog |
| broken-image | an `<img>` with a missing file: Chromium draws its broken icon and the alt text |
| overlap | a line of text set 6px off the page's own heading or paragraph |
| loading | a white veil with a spinner and "Loading…" |

That makes 54 screenshots. Each was asked all five statements, as `--forbid` asks them. A claim is
counted true on its own plant, and also on a clean fixture that natively shows what it describes.
Two did. Both were first scored as false alarms, then looked at, and the claim was right:

- **form-app** shows "Username must be at least 3 characters." under a red-bordered field.
- **stacking-context** has a "Confirm Purchase" dialog open over a blurred page.

Data: `docs/reports/data/2026-10-17-jev-claims/` (`--rescore` reproduces it with no key).

| statement | caught | false alarm, clean pages | false alarm, other plants | AUROC |
|---|---:|---:|---:|---:|
| an error message or error banner | **14/14** | 0/8 | 0/32 | 1.00 |
| a modal dialog open over the page | **14/14** | 0/8 | 2/32 | 1.00 |
| a broken or missing image | **9/9** | 0/9 | 1/36 | 1.00 |
| text overlapping other text so that it is hard to read | **9/9** | 0/9 | 8/36 | 0.99 |
| a loading spinner or loading indicator covering the page | **8/9** | 0/9 | 0/36 | 1.00 |

- **54/55 caught. The miss** is one loading overlay on landing-product, at 0.49, just under 0.5.
- **0 false alarms on 43 clean-page cases**, counting the two native cases above as true.
- **The cross-plant alarms (11/172) come from plants that cover page content.** 8 are `overlap`:
  the broken-image box and the loading veil are drawn over the page's text, so "text overlapping
  other text" is partly true of them. 3 are a floating blank image box read as a modal (2) or a
  loading veil read as a broken image (1). No alarm fired on the error-banner plant, which covers
  less of the page.
- **The `uncertain` band works as a "look first" flag.** Of 270 answers, 12 were wrong, and 10 of
  those were within 0.3 of the threshold. Outside the band, 236 answers were right and 2 wrong.
  Inside it, 22 were right and 10 wrong.

## By hand, on the real fixtures

```
fixtures/css-challenge/page.html             all 4 hold                          exit 0
fixtures/css-challenge/stacking-context.html must not show a modal — 0.99 FAIL   exit 1
                                             must show navigation   — 0.58 (uncertain: it is blurred behind the modal)
fixtures/css-challenge/form-app.html         must not show an error — 0.99 FAIL  exit 1
```

## What it is for, and not

- **For**: a cheap "did the page end up in a state a person would call broken" sweep after a
  change, over screenshots that are already being taken. Examples are an error state, a modal
  left open, a spinner that never cleared, a broken image, and text collisions. A run of 10
  claims over 100 screenshots costs about $0.015.
- **Not for**: deciding anything a gate measures. `check integrity` measures overlap, clipping and
  offscreen content from the DOM. `check a11y` measures contrast from the pixels. A claim
  restates such a defect in words, and its answer is a model's.
- Statements are not interchangeable. All five were measured in the exact wording shown, and
  different wording is unmeasured. The usage text says so and points here.

## Limits

- The plants are the common, obvious shape of each defect, on 9 synthetic fixtures at one
  viewport. Subtle states, such as a faint inline error or a half-loaded skeleton, were not
  measured.
- One threshold (0.5) and one band (0.3) were measured. Both are options.
