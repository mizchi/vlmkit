# Dogfood v1: can an agent produce readable animation evidence? (2026-08-10)

## Question

`snapshot strip` and `check animation --strip` shipped earlier today. Their author
believed the per-row motion-bbox crop made the sheet legible, and recorded the
timing-dependence of `evaluated` as a known limitation with the start condition
"the flapping actually produces a wrong verdict".

This run asked a fresh agent, with no access to the source or to git history, to
satisfy a reviewer: *"Show me what the card entrance animation actually looks like
over time. One image in the comment, keep the attachment small."*

## Result

| | |
|---|---|
| Reached a single small image | yes — 1496x484, **31.8 KB** webp (69.8 KB as PNG) |
| Documents the actual fixture | **no** |
| Rounds used | 4 of 4 |

The agent produced the artifact and then disqualified its own success:

> "**It does not document the real fixture.** `probe/` is a copy with `rise`
> 250ms→2500ms and delays 60/120→600/1200ms, because the tool cannot sample the page
> as written."

That is the honest read: on the page as written the feature emits an image of the
wrong thing, and the only way through was to edit the page until the tool could see
it.

## What worked — agent-b's own words

> "`docs/cli-reference.md:923` — the only place linking the gate to an image […]
> and `:938` 'A `.webp` output extension encodes lossless WebP' — that is the whole
> size fix, free, no flag. Found in ~2 min by grepping the doc for
> `animation|filmstrip|frame`."

The extension-driven format worked exactly as intended: the reviewer's "keep it
small" was satisfied with no flag and no second thought. 31.8 KB against 69.8 KB.

## What didn't / new gaps

### G1 — the strip silently shows one animation of five, and picks the wrong one

> "**The silent drop is the real bug.** `evaluated 1` of 5 with no finding, no
> warning, no hint. The gate *lists* the three `rise` animations under
> `reducedMotion.remaining`, so it knows them."

Verified independently on the fixture as written:

```
animations: 5 (evaluated 1, infinite 1)
reduced-motion: 5 animation(s) still running
Strip: … (240x66, 1 animation(s) x 4 sample(s))
```

So the gate names five animations in one line and writes a strip of one in the next,
and the one it keeps is the 28px spinner — not the cards under review. The count is
in the output, but nothing marks it as a loss.

This is the limitation that was deferred this morning with the start condition "the
flapping actually produces a wrong verdict". **The condition is met**: the verdict
here is an image that documents the wrong element.

The agent also said it was fixable, and was right:

> "WAAPI can seek a finished animation, so this is fixable."

Measured on the fixture (pausing every animation at `animationstart` in an init
script, then reading `document.getAnimations()`):

```
without interception : spin:running
paused at start      : bump:paused rise:paused rise:paused rise:paused spin:paused
author states        : bump:running rise:running spin:running rise:running rise:running
seek moves pixels    : opacity 0ms=0 249ms=0.99997
```

All five stay alive and seekable, and the author's own play state is still
recoverable because it is read at `animationstart` before the pause — which is the
piece that was missing when this was written off as "a redesign that erases the
author-vs-us distinction in `playState`". It does not have to erase it.

### G2 — the sheet shows each animation on its own clock, so a stagger is invisible

> "each row is sampled over its *own* 0→1 progress and cropped to its own element,
> so **the 0/60/120ms stagger is invisible and the image reads as 'all three cards
> animate simultaneously'** — wrong on exactly the property under review."

This is a design error, not a rough edge. Per-animation progress is the right axis
for "does this animation have a visible effect"; it is the wrong axis for "what does
this look like over time", which is what an image for a reviewer is for. A shared
wall-clock timeline is a different sampling mode, not a different crop.

### G3 — `--help` does not say the gate can emit an image

> "**`check animation --help` never says it can emit an image.** Its one-line
> description is 'visible effect / settle / reduced-motion behavior' — it reads as a
> pass/fail gate, so I'd have opened `snapshot`/`inspect smoke --record-video` first
> (a WebM is not 'one image')."

Cheap to fix and worth fixing: the feature was findable only by grepping the docs.

### G4 — `--wait-until` looks like the lever and silently is not

> "Flags I expected and did not find: `--include-finished` / `--restart-animations` /
> `--time-scale` / `--at <ms>`, and any way to pick *which* animations enter the
> strip. `--wait-until` looked like the lever and silently wasn't."

Verified: `--strip a.png` and `--strip b.png --wait-until domcontentloaded` produce
byte-identical files (`d88f36fb3b031014faadcb39cae7d163` both). The flag is real and
honoured for navigation; it just cannot affect this, and nothing says so.

### G5 — the image carries no labels, and an unrequested row

> "no labels at all — no row selector, no time per cell; that data is terminal-only.
> […] Plus an unrequested spinner row eating 15% of the sheet. The fade is clear; the
> 10px translateY is faint."

A reviewer pastes the image, not the terminal. Whatever a row means has to travel
with it.

## Boundary

**Fixed from this report:** see the commits that quote G1, G2, G3, G4 and G5
individually.

**Not attempted:** the faintness of a 10px translateY at sheet scale. That is a
consequence of showing the element at its real size; making motion legible by
exaggerating it would be a different tool.

## Files

- `fixtures/dogfood-animation-2026-08-10/` — scenario, brief, `attempts/agent-b/`
- `packages/vlmkit-markup/src/style/animation-eval.ts`
- `packages/vlmkit-markup/src/gates/animation.gate.ts`
- `packages/vlmkit-core/src/filmstrip.ts`
