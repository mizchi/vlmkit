---
title: How checkout talks to the rest of us
subtitle: a walkthrough for the on-call rotation
date: 2026-09-10
---

# How checkout talks to the rest of us

---

## The services on the path

- A request comes in at the **gateway**, which owns auth and nothing else.
- **checkout** holds the cart and the order, and now calls **ledger** to
  record it.
- **payments** talks to the card processor and is the only service with the key.

```d2
direction: right
gateway: API gateway
checkout
ledger
payments
gateway -> checkout: POST /orders
checkout -> payments: authorize
checkout -> ledger: write
```

<!-- notes: the gateway owning auth and nothing else is the part people forget -->

---

## Where the state lives

- `checkout` no longer writes Postgres directly — it calls `ledger`, which is
  now the only writer to the `orders` table.
- `payments` keeps no state of its own; the processor is the record.

```d2
direction: right
api: {
  checkout
}
svc: {
  ledger
}
data: {
  orders: orders (postgres)
}
api.checkout -> svc.ledger: write
svc.ledger -> data.orders: write
```

---

## The migration window

- For the next two weeks both paths are live: `checkout` **dual-writes** to
  Postgres and to `ledger`.
- Postgres is authoritative until the cutover; `ledger` becomes the source of
  truth afterward.
- Existing readers keep reading Postgres during the window; nothing else
  changes for them.

```d2
direction: right
checkout
pg: orders (postgres)
ledger
checkout -> pg: dual-write (authoritative now)
checkout -> ledger: dual-write (authoritative after cutover)
```

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

> One writer per table, and `ledger` is the only thing holding the pen for
> orders now.
