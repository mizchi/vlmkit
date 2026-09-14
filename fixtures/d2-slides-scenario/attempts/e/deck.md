---
title: Diagrams that live in the repo
subtitle: A lightning talk about D2 and TALA
date: 2026-09-14
---

# Diagrams that live in the repo

---

## The diagram in the drawing tool goes stale

- The moment the code changes, the picture is wrong — and nobody notices
- It is not in the diff, so a reviewer never sees it move
- It is not in review either: nobody signs off on a picture that isn't there
- Only one person has the file, so only they can open it, let alone fix it

<!-- notes: pause after "nobody notices" -- let the room feel the recognition -->

---

## What D2 is

- D2 is a text format for diagrams: the picture is a render of a file, not a drawing you dragged
- Anyone can edit the text; anyone can re-render it

```d2
d2text: .d2 text
engine: layout engine
render: .svg / .png / terminal
d2text -> engine -> render
```

---

## What TALA is, and why its licence matters

- TALA is D2's own layout engine — whiteboard-style, not a strict top-to-bottom hierarchy
- It is open source under **MPL-2.0** and bundled with D2, so a repo can commit a `.d2` file and every contributor renders the same picture with no paid component

```d2
dagre: dagre
elk: elk
tala: tala {style.stroke-width: 4}
```

<!-- notes: point at the tala box -- that's the one this talk uses -->

---

## The one thing that bites you

- A reference to an id that is not in scope does not error — D2 creates a new shape, so the picture silently gains boxes
- The fix is always a full path from the root

```d2
api: {
  orders
}
data: {
  postgres
}
api.orders -> data.postgres
```

---

## What to do about it

1. Write the text
2. Format and validate it
3. Read the render
4. Hold the picture to a fact sheet before trusting it

---

## Closing

> A diagram that lives in the repo is a diagram someone will actually keep true.

- Get D2 at `d2lang.com` — MPL-2.0, bundled TALA, no paid component

<!-- notes: end on the quote, then point at the URL -->
