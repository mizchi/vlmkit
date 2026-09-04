# Re-edit task (v4, arm B: the scene uses `"timing": "causal"`)

`replication-causal.scene.json` was written by someone else. Change it so that:

1. The replica **acknowledges after a 1200ms delay** (slow disk), and the
   caption on that ack says why it is slow.
2. A fourth node `backup` receives a copy from the replica right after the ack.
3. Nothing else about the story changes: the primary must still confirm to the
   client as soon as the ack reaches it, still crash just after its "ok"
   reaches the client, and the replica must still be promoted when the lost
   retry would have landed.

Success: `vlmkit-anim check replication-causal.scene.json` exits 0 with no ✗
and no ⚠; `explain` shows the new beat in the right place and every other beat
at the moment the story needs. Record how long you spent understanding the
file before editing, and anything unclear about its intent.
