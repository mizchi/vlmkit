# Cold reading log

Start: 2026-09-04 08:57:23 UTC

## What I think this scene depicts

A primary-replica write path with a failover, told as a sequence of messages
plus two out-of-band status events:

1. Client writes x=1 to primary.
2. Primary replicates to replica.
3. Replica acks back to primary.
4. Primary tells client "ok".
5. (event at 2500ms) primary crashes / goes "down".
6. (event at 3000ms) replica is promoted to "leader".
7. Client tries to write x=2 to primary again — this is marked `lost: true`
   with a caption explaining the primary crashed, so the write never arrives.
8. Client retries the write x=2 against replica (now the leader), which
   presumably succeeds since there's no `lost` flag on it.

So the story is: happy-path replication, then a crash, a promotion, a lost
write, and a successful retry against the new leader.

## Things I was unsure of

1. **No `at`/timing field on any message.** Only the two `events` carry an
   explicit `at` (ms). I don't know whether messages are placed at fixed/even
   intervals automatically, whether their position is purely index order, or
   whether the renderer interpolates message timing against the event
   timestamps (2500, 3000) somehow. This matters a lot for the task: I'm
   asked to add a 1200ms *delay* to an ack — but "ack" is a message, and I
   don't see any field on a message for delay/latency. Is there a `latency`
   or `at` message field I'm missing that this format supports but the
   example just doesn't use? Or is delay expressed only through `events`
   (i.e., you'd add an event with `at: 1200` and some status)?

2. **What "at" actually anchors to.** Is `at` in `events` an absolute
   timeline ms from scene start, or relative to the previous event/message?
   2500 and 3000 look like plausible absolute ms, but nothing in the file
   confirms the unit convention or a total scene duration.

3. **The relationship between `events` and `messages` ordering.** Both
   arrays are separate lists. How does the renderer decide to interleave,
   e.g., that "primary crashes" (event, at 2500) happens *after* "ok" (a
   message with no `at`) but *before* "write x=2 lost" (another message with
   no `at`)? Is it purely: play all messages in array order picking up any
   event whose `at` falls in between by wall-clock estimate of message
   duration? Or are messages assigned implicit sequential timestamps by
   array index (e.g. step 0, 1, 2...) and events use real ms that must be
   manually kept in the right numeric range to land in the right "slot"?

4. **`lost: true` semantics** — does this just style the arrow (dashed/red)
   and stop propagation, or does it also affect node state? No node
   status change accompanies the lost write, so I assume purely cosmetic +
   narrative.

5. **`caption` on events vs messages** — same field name, but unclear if
   they render the same way (e.g., overlay text vs. a side panel) or if
   there's a length/format constraint.

6. **`status` vocabulary** — I see `"leader"` (initial primary, later
   replica) and `"down"` (primary after crash). Is this a closed enum
   (leader/follower/down/...) or freeform text? The initial node list only
   marks `primary` as `{id, status: "leader"}` — `replica` and `client` have
   no status object, just bare strings. Unsure whether bare-string nodes
   default to some "normal" status, or whether status is truly optional/only
   meaningful for nodes that need a badge.

7. **How a fourth node would need to be declared** — I assume `nodes` needs
   a fourth entry, e.g. `"backup"`, added as a bare string (following the
   `client`/`replica` pattern) since the task says "a fourth node `backup`
   receives a copy" with no special status implied.

8. Where exactly a new "ack after 1200ms" message would need to sit in the
   array to render as a delay, and how to phrase a copy-message for backup
   without a delay of its own (task says "right after the ack").

Time spent reading before feeling ready to *attempt* an edit: ~6 minutes
(most of it on ambiguity #1 above, the missing timing field on messages).
I have not yet opened the guide or run `explain`.
