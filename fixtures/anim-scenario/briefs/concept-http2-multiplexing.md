# Brief: why HTTP/2 multiplexing is faster

Explain to a web developer why one HTTP/2 connection beats HTTP/1.1's several,
using a **before / after comparison** they can see.

The page needs six assets: `a.css` (2 units), `b.js` (3), `c.png` (1),
`d.png` (1), `e.js` (2), `f.woff` (1); a unit is one time step.

- **HTTP/1.1**: two connections, each a FIFO queue; an asset occupies a
  connection for its whole size and the next one waits (head-of-line
  blocking). Assets are requested in the order listed and take the first free
  connection.
- **HTTP/2**: one connection; the six assets are split into 1-unit frames and
  sent round-robin, so all six progress together and small assets finish
  early.

Show both, ideally side by side or one after the other, so the viewer sees
*when each asset completes* under each protocol and the total for each. Work
out the completion times yourself and make the captions carry them.

Use whichever kind or kinds say this best; if no single kind does, write
several scenes (`scene-1.json`, `scene-2.json`, …) with an `index.md` giving
their order and one line each on what each shows.

Success: every scene passes `vlmkit-anim check` with no ✗ and no ⚠; the last
captioned beat states the total time under each protocol, and at least one
caption names an asset that finishes earlier under HTTP/2 and by how much.

Also record in `log.md`: which kinds you used and why; every place you had to
write a coordinate or a colour by hand; whether "side by side" was possible;
and anything you wanted to show that you could not say in the format.
