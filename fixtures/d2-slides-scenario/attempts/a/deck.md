---
title: Diagrams that live in the repo
subtitle: A talk about D2 and TALA
date: 2026-09-14
---

# Diagrams that live in the repo

---

## The problem

- A diagram in a drawing tool goes stale the moment the code changes, and nobody notices
- It is **not in the diff**
- It is not in review
- Only one person has the file

<!-- notes: ask the room who has a diagram like this right now -->

---

## What D2 is

- D2 is a text format for diagrams
- The same three steps every time: text, a layout engine, then an image

```d2
direction: right
text: ".d2 text"
engine: "layout engine"
out: ".svg / .png / terminal"
text -> engine -> out
```

---

## What TALA is, and why its licence matters

- TALA is D2's own layout engine
- It is whiteboard-style, not a strict hierarchy
- It is open source (**MPL-2.0**) and bundled
- So a repo can commit a `.d2` file and every contributor renders the same picture with no paid component

```d2
direction: right
dagre
elk
tala_engine: tala {style.stroke: "#e67e22"}
dagre -> tala_engine: choose
elk -> tala_engine: choose
```

<!-- notes: tala is the one this talk uses -->

---

## The one thing that bites you

- A reference to an id that is not in scope does not error
- D2 **creates a new shape** — the picture silently gains boxes

```d2
api: {
  orders
}
data: {
  postgres
}
api.orders -> data.postgres
```

<!-- notes: written wrong at the root this becomes two phantom boxes -->

---

## What to do about it

- Write the text
- Format and validate it
- Read the render
- Hold the picture to a fact sheet before trusting it

---

## Closing

- Diagrams that live in the repo stay true, because the repo is what changes them
- Get D2 at d2lang.com

<!-- notes: end here, ten minutes total -->
