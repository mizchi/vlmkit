# Brief: an LRU cache as a linked list

Produce `scene.json` (kind `list`) explaining a least-recently-used cache of
capacity 3 kept as a linked list where the **head is the most recently used**
and the **tail is the eviction candidate**.

Sequence of accesses to narrate: `get a` (miss, insert at head), `get b`
(miss), `get c` (miss — the list is now full), `get a` (hit: move `a` to the
head — show this as a remove followed by an insert at position 0, and say in
the captions that this is what "move to front" means), `get d` (miss: the
tail `b` is evicted, `d` goes to the head).

Use `find` at least once to show the lookup walk before the move.

Success: `vlmkit-anim check scene.json` exits 0 with no ✗ and no ⚠; the final
list reads `d → a → c → ∅`; `explain` names `b` as the evicted entry.
