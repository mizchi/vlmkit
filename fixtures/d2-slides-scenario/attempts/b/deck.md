---
title: Diagrams that live in the repo
subtitle: Building and maintaining architecture diagrams with D2 and TALA
date: 2026-09-14
---

# Diagrams that live in the repo

<!-- notes: A lightning talk for backend engineers on versioning diagrams in code -->

---

## The problem

- Diagrams in a drawing tool go stale the moment the code changes
- **not in the diff** — nobody reviews picture changes
- Only one person has the file — architecture knowledge is gatekept

```d2
direction: right
problem: Diagram goes stale
reasons: {
  versioning: not in the diff
  review: nobody sees changes
  sharing: only one person has it
}
```

---

## What D2 is

D2 is a text format for diagrams.

```d2
direction: right
text: D2 text file
compile: Layout engine (TALA, Dagre, ELK)
output: SVG | PNG | Terminal
```

---

## Why TALA matters

Three layout engines, one choice. The license matters: all open source.

TALA is **MPL-2.0** and bundled with D2.

```d2
direction: down
engines: {
  dagre: Hierarchical
  elk: Complex layouts
  tala: Whiteboard-style
}
bundled: Ships with D2
```

Use **whiteboard-style** layout: no strict hierarchy, nodes flow naturally like a hand-drawn whiteboard.

---

## The one thing that bites you

Out-of-scope references don't error — they **creates a new shape** instead.

```d2
api: {
  orders: Order service
}
data: {
  postgres: PostgreSQL
}
api.orders -> data.postgres
```

---

## The loop

1. Write the `.d2` text
2. Format and validate: `d2 fmt --check` and `d2 validate`
3. Read the render — does it match your intent?
4. Hold the picture to a fact sheet before trusting it

---

## Closing

Text-based diagrams live in the diff. Your team reviews them. The code and the picture stay in sync.

Find D2: https://d2lang.com

<!-- notes: D2 is your answer to "how do we keep our architecture docs fresh" -->
