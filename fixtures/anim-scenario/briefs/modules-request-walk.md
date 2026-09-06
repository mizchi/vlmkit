# Brief: a request through the layers — one figure, then walked

Produce `scene.json` explaining how a **checkout request** moves through an
online shop's modules, for a new hire's first day. Two uses of the same file:
the still (`vlmkit-anim still`) goes in the onboarding doc as the module map;
the animation walks one request through it.

Modules: `web` (the storefront), `gateway` (API gateway), `checkout`,
`inventory`, `payments`, `orders`, and two shared ones, `db` and `queue`.
Dependencies: web → gateway; gateway → checkout; checkout → inventory,
payments, orders; inventory → db; orders → db, queue; payments → queue.
Group them as the org does: **frontend** (web, gateway), **domain**
(checkout, inventory, payments, orders), **platform** (db, queue).

The walk: the request enters at web, reaches checkout, which reserves stock
(inventory → db), charges the card (payments → queue, asynchronously), and
records the order (orders → db, then queue). End on the module map with the
two asynchronous hops pointed out as the ones that make checkout eventually
consistent.

Deliver `scene.json`, `map.svg` (the still), `walk.gif` (the animation, via
`vlmkit-anim video`) and `log.md`.

The facts above are also written as a fact sheet,
`facts/modules-request-walk.expect.json`, in the shape `check --expect` reads:
use its module and group ids as written, and highlight the two asynchronous
hops it names in the final frame.

Success: `vlmkit-anim check scene.json --expect facts/modules-request-walk.expect.json`
exits 0 with no ✗ and no ⚠; `vlmkit-anim layout scene.json` reports no issue;
`explain` reads as the walk described above.

Also record in `log.md`: whether one `kind` carried both uses or you wanted
two files; every coordinate, colour or canvas size you wrote by hand and why;
anything you wanted in the figure and could not express.
