# Re-edit task (v3: the scene was written with `after` anchors)

`replication-after.scene.json` was written by someone else. Change it so that:

1. The replica **acknowledges after a 1200ms delay** (slow disk), and the
   caption on that ack says why it is slow.
2. A fourth node `backup` receives a copy from the replica right after the ack.
3. Nothing else about the story changes: the primary must still crash just
   after its "ok" reaches the client, and the replica must still be promoted
   when the lost retry would have landed.

Success: `vlmkit anim check replication-after.scene.json` exits 0 with no ✗
and no ⚠; `explain` shows the new beat in the right place and the crash and
promotion still at their narrative moments. Record how long you spent
understanding the file before editing, and anything unclear about its intent.
