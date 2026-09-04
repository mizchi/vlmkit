# Cold Reading Log

## My understanding of the scene (before editing):

This describes a primary-replica database replication scenario where:
1. Client writes to primary
2. Primary replicates to replica and waits for ack
3. Primary acknowledges to client
4. Primary crashes shortly after sending "ok"
5. Client's next write is lost, then retried against the replica
6. Replica gets promoted to leader when the lost write would have landed

## Things I was unsure of (resolved after reading guide):

1. **What `after` references**: `"after": "ok"` means the event fires when the message labeled "ok" lands at its destination. ✓
2. **Delay semantics**: `"delay": 100` on an event means wait 100ms after the anchored message lands before firing the event. ✓
3. **How to add replica acknowledgment delay**: Use `"latency": 1200` on the ack message to make it take 1200ms to travel. Add a caption explaining why. ✓
4. **Adding a fourth node**: Add "backup" to nodes, then add a new message from replica to backup right after the ack message. ✓
5. **Timing stability**: Events with `"after"` anchors stay tied to their message labels, so they move with the timeline. The crash and promotion will stay in sync. ✓

## Time spent before editing: ~6 minutes

Opened guide to clarify: latency vs delay, message sequencing with "after" anchors, how delay on events works. No ambiguities remain about implementation.

## Strategy:
- Ack message: add `"latency": 1200` and caption "slow disk"
- New message: replica → backup right after ack
- New node: "backup" to nodes array
- Events: should auto-adjust timing; verify crash stays ~100ms after "ok" and promotion at "write x=2"
