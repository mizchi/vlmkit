---
title: How checkout talks to the rest of us
subtitle: a walkthrough for the on-call rotation
date: 2026-09-10
---

# How checkout talks to the rest of us

---

## The four services on the path

- A request comes in at the **gateway**, which owns auth and nothing else.
- **checkout** holds the cart and the order.
- **checkout** no longer writes Postgres directly — it calls **ledger**,
  which is now the only writer to `orders`.
- **payments** talks to the card processor and is the only service with the key.

```d2
direction: right
gateway: API gateway
checkout
ledger
payments
gateway -> checkout: POST /orders
checkout -> ledger: write
checkout -> payments: authorize
```

<!-- notes: the gateway owning auth and nothing else is the part people forget -->

---

## Where the state lives

- `checkout` calls `ledger` to write orders; `ledger` is the only writer to
  that table now.
- `payments` keeps no state of its own; the processor is the record.

```d2
direction: right
checkout
ledger
orders: orders (postgres)
checkout -> ledger: write
ledger -> orders: write
```

---

## The migration window

- For the next two weeks, `checkout` **dual-writes** to Postgres and to
  `ledger`.
- Postgres stays authoritative until the cutover; after that, `ledger` is the
  source of truth.
- Both paths are live at once, so the two writes can disagree — that is what
  the `409` on the next slide means.

```d2
direction: right
checkout
pg: Postgres (legacy path, authoritative until cutover)
ledger: ledger (authoritative after cutover)
checkout -> pg: write
checkout -> ledger: write
```

<!-- notes: this slide goes away once the cutover happens; date it if it slips -->

---

## What wakes you up

- A `402` from payments is the processor, not us — check its status page first.
- A `500` from checkout with no payments call in the trace is the order write.
- A `409` from `ledger` means the dual-write disagreed; it is the migration,
  not the order.
- Latency on `POST /orders` past two seconds is almost always the card
  processor, and the dashboard shows it per-service.

---

## What to remember

> `ledger` writes the table now, and payments is still the only thing holding
> a key.
