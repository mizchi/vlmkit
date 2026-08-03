# Six gates were measuring a different document

2026-08-02. Found while inventorying refactor candidates: the answer to "what
else should be refactored" turned out to be a correctness bug, so the refactor
became the fix.

## The defect

A gate that takes an HTML file had two ways to load it, and they do not produce
the same document:

| Mechanism | Document base URL | `<link rel="stylesheet" href="style.css">` |
|---|---|---|
| `page.goto(pathToFileURL(file))` | the file URL | loads |
| `page.setContent(await readFile(file))` | `about:blank` | **never loads** |

Ten gates used the second form. Since almost every real project keeps its CSS
in a separate file, those gates were judging unstyled markup.

First measurement, on a page whose only defect is `p { color: #bbbbbb }`
(1.92:1 on white) in an external stylesheet:

```
check a11y contrast, external stylesheet : ✓ 0 contrast failure(s)
check a11y contrast, same CSS inlined    : ✗ 1 contrast failure(s)
check integrity (navigates to the file)  : low-contrast-text … 1.92:1
```

## Which gates, measured — not assumed

The file-list said ten. Running each gate against
`fixtures/external-assets/page.html` and against a twin with the identical CSS
inlined said **six**, and the other four were already fine:

| Gate | Before | After |
|---|---|---|
| `check a11y contrast` | 0 failures vs 1 — missed it entirely | agree |
| `check a11y touch` | **verdict inverted** (below) | agree |
| `check tokens` | 12 padding violations vs 9 | agree |
| `check theme` | differed | agree |
| `stress i18n` | card `21→86` vs `95→185` | agree |
| `stress media` | **forced-colors ✗ vs ✓** | agree |
| `check a11y focus` | already agreed | — |
| `check breakpoints` | already agreed | — |
| `check copy` | already agreed | — |
| `check design` | already agreed | — |

Two are worth spelling out, because "fewer findings" understates them:

**`check a11y touch` was inverted, not just incomplete.** With the stylesheet
missing it inspected 3 elements instead of 4 — the 20×20 tap target gets its
size from CSS, so unstyled it is a zero-size inline `<a>` and never becomes a
candidate at all. Meanwhile it reported three buttons as undersized at their
unstyled sizes (39×21, 58×21, 52×21) that are 66×42 / 80×39 / … once styled. So
it missed the one real violation and invented three.

**`stress media` flipped a pass into a fail.** It compares screenshots across
media emulations; on an unstyled document forced-colors barely changes anything,
so it reported `Δ 0.36% → fails`. With the CSS applied: `Δ 1.46% → passes`.

## The fix

`packages/vlmkit-core/src/page-open.ts` — one way to open the page under test:
`openSource` (navigate; relative assets resolve; auth state and redirect
description folded in) and `openHtml` (for gates that must rewrite the document
first). All six gates now call it.

`openHtml` needed an empirical detour. The obvious fix for mutated HTML is to
inject a `<base href="file:///dir/">`; measured on the same fixture, that does
**not** work:

```
setContent + injected <base href="file:///dir/">  ->  rgb(0, 0, 0)   (unstyled)
goto(file) then setContent                        ->  rgb(4, 5, 6)   (styled)
```

The `setContent` document has an opaque origin and Chromium blocks a `file://`
subresource from one. So `openHtml` navigates to the source first and *then*
replaces the markup: the document keeps a real base URL. The `<base>` helper was
deleted rather than shipped, since keeping it would enshrine a technique
measured as broken.

## The regression gate

`fixtures/external-assets/` declares **every** defect in `style.css` and none in
`page.html`: a contrast failure, a CSS-sized tap target, copy hidden by
`font-size: 0`, a spacing outlier, and three button styles.
`packages/vlmkit-markup/src/external-assets.test.ts` runs each gate on it and on
an inlined twin and requires the same verdict. The assertion is differential, so
a threshold change moves both numbers without breaking the test, while a gate
that stops resolving assets breaks it immediately.

Two traps hit while writing that test, both worth recording:

- Two assertions were **vacuous** — they compared `${o.selector}` on both sides
  where the field is `path`, so both sides stringified to `undefined` and
  `deepEqual` passed. `tsc` caught it; the test run did not.
- The fixture path was cwd-relative, so under `pnpm --filter` the whole suite
  errored on ENOENT **while the summary still printed `0 fail`**. A suite that
  fails to build is not a failing test in that reporter. Fixture paths are now
  resolved from `import.meta.url`.

## Scope

- Verdicts on pages with external CSS change, by design — that is the fix. A
  project that tuned thresholds against the old unstyled measurements will see
  different numbers.
- Untouched: modules that `setContent` HTML they synthesized in memory
  (`build component`, the css-challenge harnesses). They have no file whose
  siblings need resolving.
- Not yet unified: `chromium.launch` still appears at 44 sites, and
  `waitUntil` is 72 `networkidle` / 8 `load` / 1 `domcontentloaded`. Routing
  those through `openSource` is the remaining half of the refactor; this pass
  covered the gates where the load mechanism changed the verdict.
