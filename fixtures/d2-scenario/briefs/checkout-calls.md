# Brief: one checkout request, as a call-flow diagram for a PR comment

A reviewer asked "what actually happens when someone checks out?". Answer it
with a diagram they can read in the pull-request comment itself — so the
terminal render, in a fenced code block, is the deliverable, and it has to fit
a narrow column.

## The call flow, as described

Five participants, in this order across the picture: **browser**, **gateway**,
**orders**, **inventory**, **broker**.

The messages, in order:

1. `browser` → `gateway`: `POST /checkout`
2. `gateway` → `orders`: `createOrder`
3. `orders` → `inventory`: `reserve`
4. `inventory` → `orders`: `reserved` (a return, not a new call)
5. `orders` → `broker`: `order.placed` (asynchronous — `orders` does not wait)
6. `orders` → `gateway`: `201 Created` (a return)
7. `gateway` → `browser`: `order id` (a return)

The reservation in steps 3 and 4 is the part the reviewer is asking about: it is
the only synchronous call that blocks, and everything after step 5 happens
whether or not the broker has delivered anything.

## What the diagram has to show

- All five participants and all seven messages, in the order above.
- Which messages are returns and which are new calls.
- That the event to the broker does not block the reply to the browser.

## Done when

1. `d2 validate` exits 0, and `d2 fmt` leaves the file unchanged.
2. The TALA terminal render exits 0 and its widest line is **80 columns or
   fewer** (`wc -L`) — it is going in a PR comment, which wraps.
3. The render is legible as pasted: no message label broken across a line, no
   arrow whose ends you cannot tell apart.

## Deliver in your working directory

- `checkout-calls.d2`
- `checkout-calls.txt`, and the standard-ASCII variant you would actually paste
- `log.md` — one line per round: what you changed, what told you to change it,
  and the width after that round.
- The fenced block exactly as you would paste it into the PR comment.
