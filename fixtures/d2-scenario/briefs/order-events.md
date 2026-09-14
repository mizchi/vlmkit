# Brief: the order pipeline of a shop, as an architecture diagram

You are documenting a system you have been told about in a handover meeting.
Nothing about it exists in this repository — the description below is the only
source. Draw it as a D2 file and put the terminal render in the README section
you are writing.

## The system, as described

Requests arrive at an **edge** we run ourselves: a CDN in front of an API
gateway. The **browser** talks to the CDN, the CDN forwards to the gateway, and
the gateway is the only edge component that calls into the cluster.

Behind it, in our own cluster, there are four services:

- **orders** — owns the order records. The gateway calls it.
- **inventory** — reserves stock. `orders` calls it synchronously and waits.
- **billing** — takes the money. `orders` does **not** call it; it publishes an
  `order.placed` event to a **broker**, and `billing` consumes from the broker.
- **shipping** — also consumes `order.placed` from the broker, independently of
  billing.

Two stores, both ours: **postgres**, written by `orders` and read by `shipping`,
and **redis**, which `inventory` uses for its reservation counters.

One thing outside our cluster: **stripe**, which `billing` calls over HTTPS.
Nothing else talks to it, and nothing outside calls in except the browser.

## What the diagram has to show

- Every named thing above, with a label a reader who has not been in the
  meeting can understand.
- That the edge, the cluster and the outside world are three separate regions.
- Which calls are synchronous (`orders` → `inventory`) and which go through the
  broker (`billing` and `shipping` do not know about `orders`).
- That the broker fan-out is one event to two consumers, not a chain.

## From v2 on: the fact sheet is yours

`briefs/facts/order-events.expect.json` says what the diagram has to draw, in the
schema `.claude/skills/d2-diagram/assets/d2-facts.mjs` reads. Hold your picture
to it:

```sh
node .claude/skills/d2-diagram/assets/d2-facts.mjs order-events.d2 \
  --expect ../../briefs/facts/order-events.expect.json
```

The sheet wins over the picture, and over your reading of this brief: if they
disagree, the sheet is right. What it cannot see is named in its own `_note`.
(v1 withheld this sheet and scored the attempts against it afterwards; one of
four shipped a green diagram with four duplicated boxes.)

## Done when

1. `d2 validate` exits 0, and `d2 fmt --check` exits 0.
2. `d2-facts.mjs --expect` exits 0 against the sheet above.
3. The TALA terminal render (`d2 --layout=tala order-events.d2 order-events.txt`)
   exits 0 and its widest line is **100 columns or fewer** (`LC_ALL=C.UTF-8 wc -L`, or the `columns` the facts check prints). It goes in
   a README, so also produce the plain-ASCII variant.
4. You have read your own render and can say, without looking at the `.d2`, what
   calls what.

## Deliver in your working directory

- `order-events.d2`
- `order-events.txt` (Unicode box drawing) and `order-events.ascii.txt` (standard mode)
- `order-events.svg`
- `log.md` — one line per round: what you changed, what the render or the error
  told you, and the width after that round.
