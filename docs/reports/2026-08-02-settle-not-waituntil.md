# "Cosmetic: `waitUntil` levelling" was the wrong axis — and six gates were reading the wrong document

2026-08-02. The page-open unification left a remainder I labelled cosmetic:
44 `chromium.launch` sites, a `waitUntil` spread of 71 `networkidle` / 8 `load` /
2 `domcontentloaded`, and 6 scattered `fonts.ready` calls. Levelling the load
states looked like tidying.

The label was wrong for the second time today. Measured against a page that
renders its content 350ms after `load`:

```
check layout   (networkidle + settle)   count .card = 2            <- correct
verify flow    (load, no settle)        count .card = 0, FAIL      <- blames the markup
build page     (load, no settle)        5.3% of the settled ink    <- every component missing
scan contract  (load, no settle)        0 landmarks                <- and 4 when settled
```

Three gates, three different wrong answers about the same page at the same
instant, every one of them phrased as a defect in the markup.

## Why `waitUntil` is not the axis

`goto(load)` followed by a settle waits for network idle anyway. So the 8 `load`
and 2 `domcontentloaded` sites are equivalent to the 71 `networkidle` ones
**provided they settle**. Levelling the load states would have changed nothing;
the distinction that mattered was never in the `waitUntil` argument.

The real split is **actions versus reads**, and it is why this hid so long:

| | auto-waits? |
|---|---|
| `page.click` / `fill` / `hover` / `press` | yes — a late-rendered target is safe |
| `page.evaluate` | **no** — samples the DOM at that instant |
| `page.screenshot` | **no** |
| `getBoundingClientRect` inside evaluate | **no** |

Every gate does its measuring through the bottom three rows. A flow whose first
action clicks a late element looks fine, because Playwright waits for the click.
A flow that clicks something present at `load` and *asserts* on late content does
not.

## Fixes

Five call sites gained the settle they never had — `verify flow`,
`build page`'s `renderHtmlToPng`, `fix markup`'s computed-style read,
`heal selector`, and `region-selector-match` (which had a bare `fonts.ready`,
the one third of settling that mattered least here).

`settleAfterLoad` in `interaction-map.ts` was a byte-for-byte duplicate of
`settlePage`; it is gone, and the React-placeholder history that justified it
moved into `settlePage`'s doc comment where the other five callers can find it.

### `scan contract`: the one place the trade was real

`introspect-contract` navigated local files with `load` *deliberately*, and
`docs/landmark-drilldown-design.md` advertised it as a feature — "keeps dogfood
introspection under roughly a few hundred milliseconds". That claim was true and
the behaviour was still wrong. On a built SPA opened as a file:

```
load only  ->  0 landmarks []                                241ms
settled    ->  4 [banner, navigation, main, contentinfo]      986ms
```

Zero landmarks is not a fast answer, it is a wrong one, and it is the input every
downstream contract command reads. Settled, and the design doc now states the
measured cost instead of the old speed claim.

**A cheaper primitive was tried and rejected.** Playwright's `networkidle` is a
fixed 500ms of quiet, so settling costs ~500ms even on a static local file. So I
wrote a DOM-quiescence wait instead — MutationObserver quiet + rAF, which should
be the right question ("has the DOM stopped changing?"). It fails both ways:

```
static       settleDom  128ms  landmarks=4     <- fast, and correct
late-render  settleDom  125ms  landmarks=0     <- declares settled BEFORE the render starts
chatty-poll  settleDom 3025ms  landmarks=4     <- burns its whole cap on a 50ms interval
```

A 100ms quiet window elapses before a 350ms deferred render has emitted its first
mutation, so "nothing has changed yet" is indistinguishable from "nothing will
change". Network idle is slower and correct. Recorded so the idea is not
re-invented.

## What in the item *was* cosmetic

Two thirds of the original item, checked rather than assumed:

- **47 `chromium.launch` sites.** Exactly one file launches twice
  (`src/diff-pr.ts`, once in `pin` and once in the default run — two
  subcommands, not two launches per run). Every other site is one launch per
  gate invocation, which is the right structure for a CLI that runs one gate per
  process; `batch` already spawns subprocesses, so a shared browser singleton
  would buy nothing. Count, not waste.
- **The 10 remaining `load` / `domcontentloaded` navigations.** All settle now,
  which makes them equivalent to the `networkidle` ones. Left as they are.

Two `goto` sites still do not call `settlePage`, both deliberately:
`font-determinism-probe.ts` injects a style tag *after* navigating and so waits
for `fonts.ready` at the only point where it means anything, on static local
fixtures with no network; and the `page.goto` strings in `vlmkit-generate` are
prompt text telling the generator *not* to call it, not navigation.

## A second defect, found while writing the probe

My first probe used `{"text": {...}}` where the vocabulary is
`{"assert": "text", ...}`. `verify flow` did not tell me that. It reported:

```
apply = FAIL  [text: NO(unknown assert)]
```

A typo in the flow file, reported as an unmet post-condition — which sends the
reader to debug markup that is fine. Then the other direction turned out worse:

```
{"action":"clik"}  ->  done: true
```

`runAction`'s switch had no default, so an unrecognised action fell through
silently, the step had no post-conditions to fail, and the run came back **green**.
A flow that performed no action at all passed.

`validateFlow` now rejects both before a browser opens, names the offending step
(`step 1 ("open menu"), expect[0]`), lists the valid names, and says explicitly
that this is a flow-file error rather than a page defect — the rule
`check integrity --allow` already applies to an unknown finding kind. An empty
`steps` array is rejected too, rather than reporting `done` on zero steps.

Both vocabularies are now documented in `introduce.md` / `introduce.ja.md`; a
reader previously had to infer the assert names from one example, which is
exactly how `visble` happens.

## A doc that was ahead of the code

`introduce.md` already claimed gates handle "client-rendered apps that paint on a
tick after `load`, which every gate now waits out". That was false for six of
them until this commit. The claim is now true. Worth noting as a verification
gap: this morning's doc pass checked that every *command and flag* in
`introduce.md` existed, but not that a *behavioural* claim held — a client-rendered
page through `verify flow` would have caught it.

## Regression gate

`packages/vlmkit-markup/src/settle-consistency.test.ts` — 11 tests. The settle
half was ablated to confirm it is not vacuous: removing the `settlePage` call
from `page-compose` fails exactly the `build page` test, and removing it from
`flow-verify` fails exactly the two `verify flow` tests, with the others still
green.

The `scan contract` case is pinned by role list (`banner, navigation, main,
contentinfo`) rather than by count, because it is the fix most likely to be
reverted for being slow. One test also parses `flow-verify.ts` and asserts the
validator's name lists equal the `FlowAction` / `FlowAssert` type unions — drift
there would start rejecting a *valid* flow, which is loud but still wrong.

## Method note

Fourth defect class today from the same question — "do two paths that should
agree actually agree?" — asked of: navigate vs `setContent`, four argv parsers,
sweep order vs sweep order, printed vs stored, and now settled vs not. The
pattern in the last two is narrower and worth naming on its own: **a gate that
cannot distinguish "your page is wrong" from "I measured the wrong thing" will
always phrase the second as the first.** Every one of these shipped as a
confident, specific, wrong kickback.
