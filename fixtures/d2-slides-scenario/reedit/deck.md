---
title: How checkout talks to the rest of us
subtitle: a walkthrough for the on-call rotation
date: 2026-09-10
---

# How checkout talks to the rest of us

---

## The three services on the path

- A request comes in at the **gateway**, which owns auth and nothing else.
- **checkout** holds the cart and the order, and is the only writer to its own
  tables.
- **payments** talks to the card processor and is the only service with the key.

```d2
direction: right
gateway: API gateway
checkout
payments
gateway -> checkout: POST /orders
checkout -> payments: authorize
```

<!-- notes: the gateway owning auth and nothing else is the part people forget -->

---

## Where the state lives

- `checkout` writes orders to Postgres and nothing else reads that table.
- `payments` keeps no state of its own; the processor is the record.

```d2
direction: right
api: {
  checkout
}
data: {
  orders: orders (postgres)
}
api.checkout -> data.orders: write
```

---

## What wakes you up

- A `402` from payments is the processor, not us — check its status page first.
- A `500` from checkout with no payments call in the trace is the order write.
- Latency on `POST /orders` past two seconds is almost always the card
  processor, and the dashboard shows it per-service.

---

## What to remember

> One writer per table, and payments is the only thing holding a key.
