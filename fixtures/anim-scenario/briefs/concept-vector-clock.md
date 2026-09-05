# Brief: introduce vector clocks

Explain **vector clocks** to a programmer who has never met them, in an
animation of at most twelve beats. Three processes `A`, `B`, `C`; each keeps a
vector `[a, b, c]` of counters, one per process.

The story to tell:

1. Each process starts at `[0,0,0]`.
2. A local event increments the process's own slot (`A` does one: `[1,0,0]`).
3. A message carries the sender's vector; on receipt the receiver takes the
   element-wise **max** with its own vector and then increments its own slot.
   `A` sends to `B` after its event: `B` becomes `[1,1,0]`.
4. `C` has a local event concurrently: `[0,0,1]`.
5. `B` sends to `C`: `C` becomes `[1,1,2]`.
6. End by naming two events that **cannot be ordered** — `C`'s local event
   (`[0,0,1]`) and `A`'s (`[1,0,0]`): neither vector is ≤ the other — and one
   pair that can (`A`'s event happened before `C`'s receive).

The viewer must be able to read every vector at the moment it changes, and see
which process it belongs to. Use whichever kind or kinds say this best; if no
single kind does, write several scenes (`scene-1.json`, `scene-2.json`, …)
with an `index.md` giving their order and one line each on what each shows.

Success: every scene passes `vlmkit-anim check` with no ✗ and no ⚠; `explain`
of the last scene names the concurrent pair and the ordered pair with their
vectors.

Also record in `log.md`: which kinds you used and why; every place you had to
write a coordinate or a colour by hand; and anything you wanted to show that
you could not say in the format.
