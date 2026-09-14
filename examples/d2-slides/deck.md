---
title: Nothing tells you the picture is wrong
subtitle: D2, TALA, and two rounds of measuring whether an agent can draw
author: vlmkit
date: 2026-09-14
lang: en
---

# Nothing tells you the picture is wrong

<!-- notes: This deck is the worked example for the d2-slides skill. Every figure in it is a ```d2 fence laid out by TALA; the deck itself is checked with vlmkit's page gates. -->

---

## A D2 diagram is a drawing

- `d2 validate` reads **syntax**. The renderers draw whatever the file says.
- There is no `--expect`, no layout report, and no collision check.
- Worst: a reference to an id **not in scope creates a new shape**.

```d2
direction: right
edge: edge {
  cdn
  gateway
}
cluster: cluster {
  orders
}
phantom: "gateway -> orders, written at the root" {
  gw2: gateway {style.stroke-dash: 3}
  or2: orders {style.stroke-dash: 3}
  gw2 -> or2
}
edge.cdn -> edge.gateway
```

<!-- notes: The dashed pair is what D2 adds silently. The real gateway and orders keep no arrow between them. -->

---

## One writer shipped exactly that

- `d2 validate` 0, `d2 fmt` clean, 94 columns.
- Its own log: *"can trace all connections."*
- The render had **four duplicated boxes**, two orphans, and the entry call drawn as a floating pair outside every region.

> A green check on a wrong picture is the failure the fact sheet exists for.

<!-- notes: v1, the smaller model, on the eleven-box architecture brief. -->

---

## What the render gives back

```d2
direction: right
d2file: arch.d2
svg: arch.svg {
  ids: "every shape and connection id"
  geom: "x / y / width / height"
  labels: "the text a reader sees"
}
txt: arch.txt {
  cols: "columns, wcwidth-aware"
}
facts: d2-facts.mjs {
  shape: hexagon
}
sheet: arch.facts.json
d2file -> svg: d2 --layout=tala
d2file -> txt: d2 --layout=tala
svg -> facts
txt -> facts
sheet -> facts: expected
facts -> verdict: missing / reversed / invented / duplicated {
  style.bold: true
}
```

<!-- notes: d2 writes fully-qualified ids into the SVG as base64 class attributes. That is the whole trick: the drawn picture is readable back. -->

---

## Two rounds

- **v1** — the sheet withheld. Three of four diagrams correct; the fourth green and wrong.
- **v2** — the sheet handed over. **No wrong picture**, and the small model went 14 errors → 0 in two rounds.
- Of fifteen v2 rounds, **one** was about a fact. The rest were width and legibility.

```d2
direction: right
v1: v1 — no sheet {
  a: a ✓; b: b ✓; c: c ✓
  d: d ✗ 14 errors {style.fill: "#ffe6e6"}
}
v2: v2 — sheet in hand {
  e: e ✓; f: f width only; g: g ✓
  h: h ✓ 2 rounds {style.fill: "#e8f6ec"}
}
v1 -> v2: d2-facts + six corrections
```

---

## The failure moved, it did not vanish

- A `top` / `left` pin pushed three of five tables **off the ascii canvas**.
- `d2` exited 0. The width fell 113 → 71. The 71 measured a fragment.
- The checker read boxes from the SVG and columns from the text and never compared them.

```d2
direction: right
pin: "top / left pin" {shape: hexagon}
svg2: "SVG grows (x=1893)"
txt2: "text render: 2 of 5 tables" {style.fill: "#ffe6e6"}
cols: "71 columns — a fragment" {style.fill: "#ffe6e6"}
verdict: "d2-facts: ✓ 0 errors" {style.stroke-dash: 3}
pin -> svg2
pin -> txt2
txt2 -> cols
cols -> verdict: believed
```

<!-- notes: Fixed by comparing the two: every box in the SVG must be findable in the text render. -->

---

## The loop, as it stands

```d2
direction: right
sheet: write the sheet
write: write the .d2
syntax: fmt --check / validate
facts: d2-facts --expect
png: read the .png
txt: the terminal render
sheet -> write
write -> syntax
syntax -> facts
facts -> png
png -> txt
txt -> write: one change per round {
  style.stroke-dash: 3
}
```

- Five rounds at most. Each step answers a different question.
- Compiles → says what I meant → reads → fits where it is going.

---

## Where it runs

- `tests/d2-facts.test.mjs` drives the checker over **committed renders**, so CI gates it with no `d2` installed.
- This deck is a page: `vlmkit check integrity`, `check copy --manifest`, `check a11y contrast` read it like any other.
- The deck source is Markdown; every figure is a ```d2 fence laid out by TALA.

```
node .claude/skills/d2-slides/assets/build-deck.mjs examples/d2-slides/deck.md --out dist
node dist/vlmkit.mjs check integrity dist/index.html
```

<!-- notes: Built and checked by the d2-slides skill; the figures are the same TALA layouts the d2-diagram skill writes. -->
