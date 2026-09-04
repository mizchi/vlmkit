# Re-edit task

`replication.scene.json` was written by someone else. Change it so that:

1. The replica **acknowledges after a 1200ms delay** (slow disk), and the
   caption on that ack says why it is slow.
2. A fourth node `backup` receives a copy from the replica right after the ack.
3. Nothing else about the story changes.

Success: `vlmkit-anim check replication.scene.json` exits 0; `explain` shows
the new beat in the right place. Record how long you spent understanding the
file before editing, and anything that was unclear about its intent.
