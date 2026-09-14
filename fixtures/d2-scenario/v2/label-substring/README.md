# The label-substring match, frozen

Writer `f`'s round-1 figure from the `d2-slides` v1 round. The shared sheet
forbids `checkout->orders`; this figure draws no box called `orders`, but `pg`'s
label is "Postgres orders (authoritative until cutover)", and the checker's last
resort is a substring of an id or a label. So the row fired, and `f` read it as
a wrong figure and relabelled a box that was right:

> "the round-2 loss came entirely from not reading `d2-facts.mjs`'s `resolve()`
> closely enough up front — its header comment says matching is 'against the
> last segment of a drawn id' but doesn't mention the label-substring fallback
> that actually fired."

The generosity stays — `gw: API gateway` holding a sheet's `gateway` is why it
exists — but every message that turns on such a match now names it, so "the
figure draws a forbidden edge" and "the sheet means a different box" can be told
apart. `tests/d2-facts.test.mjs` pins the line against this render.
