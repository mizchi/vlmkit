# Attempt bc — list-lru

## Expected list state after each access (worked out from the guide before running check)

- Start: empty list.
- `get a` (miss, insert a at 0): `a`. Head=a, tail=a.
- `get b` (miss, insert b at 0): `b, a`. Head=b, tail=a.
- `get c` (miss, insert c at 0): `c, b, a`. Head=c, tail=a. Full (capacity 3).
- `get a` (hit): `find a` walks head→c→b→a. Then `remove a`: `c, b`. Then `insert a at 0`: `a, c, b`. Head=a (MRU), tail=b (now LRU, since a and c were touched more recently than b).
- `get d` (miss): tail is `b` → evict it: `remove b`: `a, c`. Then `insert d at 0`: `d, a, c`. Head=d, tail=c.

Final expected order: `d → a → c → ∅`, matching the brief. Eviction should be named as `b`.

## Round 1

Command:
```
cd /home/user/vlmkit && pnpm exec vlmkit-anim check fixtures/anim-scenario/attempts/bc/scene.json
```
