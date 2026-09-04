# Brief: a Raft leader election, in one picture

Produce `scene.json` (kind `distributed`) showing a 3-node Raft cluster
(`n1`, `n2`, `n3`) where the leader `n1` crashes and `n2` is elected.

Story beats to show, in order:
1. `n1` is leader and sends a heartbeat to `n2` and `n3`.
2. `n1` crashes.
3. `n2` times out and requests votes from `n1` and `n3`. The request to `n1`
   is lost (it is down).
4. `n3` grants its vote.
5. `n2` becomes leader and sends a heartbeat to `n3`.

Requirements: each beat has a caption a newcomer can follow; use `status`
events for the crash and the promotion; no message should silently land on
a crashed node.

Success: `vlmkit-anim check scene.json` exits 0 with no ✗ and no ⚠ about a
message landing on a down node.
