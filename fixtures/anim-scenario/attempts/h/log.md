# Cold Reading of replication.scene.json

## Story (my words)
A distributed system where a client writes to a primary server, which replicates to a replica. The replica acknowledges, and the primary confirms to the client. Then the primary crashes and gets promoted to leader. The client retries a subsequent write against the promoted replica. This demonstrates failover behavior in a primary-replica architecture.

## Starting time: 14:30 UTC

## Things I was unsure of:

1. **How delays are specified** — The README says "acknowledge after 1200ms delay" but I don't see any `delay` field in the messages. Is this a field I need to add? How does timing work on individual messages?

2. **Caption field on messages** — I see `"caption"` used on the `"lost": true` message and on events. I assumed captions can exist on messages, but the current ack message has no caption. Do I add one?

3. **Message ordering and timing** — Looking at the messages list, they appear to be in sequence. The ack is currently message #3 (replica to primary). When I "add a beat" with a 1200ms delay, does that change the message ordering? Do I need to adjust any `at` fields?

4. **Adding a new node and message** — The nodes list has client, primary, replica. I need to add "backup". Then after the ack, I need a message from replica to backup. The README says "right after the ack" — does this mean immediately, or does it inherit the 1200ms delay?

5. **"Right after the ack"** — Does this mean the backup message should arrive at the same time as the ack, or after? The phrasing is ambiguous.

6. **Format of the delay** — Is it a `latency` field? An `at` field with absolute timing? How is absolute timing mapped to relative beats in a sequence?

## Observations:
- The scene is type "distributed" (peer-to-peer message passing)
- Nodes can have a status (leader, down)
- Messages can be marked lost or have captions
- Events happen at absolute timestamps (2500ms, 3000ms)
- Messages appear to be rendered in order, but timing is not explicit on each message
- The caption field clearly exists (used on message #5 and events)

## After running explain and reading schema:

**Time spent on cold reading: ~2 minutes**

The schema revealed:
- Messages have a `latency` field (milliseconds to travel); defaults to stepMs
- Messages have an `at` field (absolute start time); defaults to when previous message arrives
- Messages support `caption` field (explanation text)
- Events happen at absolute `at` times

The explain output showed:
```
1. [    0ms] client → primary: write x=1
2. [  600ms] primary → replica: replicate x=1
3. [ 1200ms] replica → primary: ack
4. [ 1800ms] primary → client: ok
5. [ 2400ms] primary has crashed: the write is lost
6. [ 2500ms] primary crashes
7. [ 3000ms] client retries against the promoted replica · replica is promoted
8. [ 3600ms] end
```

**Timing insight (discovered by making the edit):**
Each message starts 600ms after the previous one arrives. When I increase the ack's latency from 600ms to 1200ms, all subsequent messages shift 600ms later in the timeline. The events at 2500 and 3000 were initially in gaps but may conflict or shift relative to the messages.

**Unclear from file alone:**
- Whether "right after the ack" means the backup message gets an explicit `at` value, or relies on default sequencing
- How event timing interacts with message latency changes (events at absolute vs. relative times?)

## Edit plan:
1. Add "backup" node to the nodes array
2. Modify replica's ack message (message #3):
   - Add `"latency": 1200` (slow disk delay)
   - Add `"caption": "slow disk"`
3. Insert new message after ack:
   - `{"from": "replica", "to": "backup", "label": "send copy"}`
   - No explicit `at` or `latency` to inherit defaults (immediate after ack arrival)

## Edits completed
✓ All changes made in Round 1
✓ First `check` result: "✓ 0 error(s), 0 warning(s)" — 4980ms total, 9 steps
✓ Explained shows backup node at step 4 with "replica → backup: send copy"
✓ Step 4 at [2400ms] is right after ack (which arrives at 2400ms after 1200ms latency from 1200ms start)
✓ Rendered step 4 SVG shows backup node and the send copy message visually
