# Cold Reading and Analysis

## Initial Understanding (before reading guide)

**Story in my words:**
A primary-replica replication system demonstrates write consistency and failover. The client writes to the primary, which replicates to the replica. The replica acknowledges, and the primary confirms the client. A second write is lost (primary crashes), then the client retries against the promoted replica.

**What I was unsure of:**
1. The meaning of `"timing": "causal"` - I guessed it might mean events follow causal ordering, but I didn't know exactly how it affected message timing
2. Why the timing showed replica ack at 1200ms - seemed like it might be automatic spacing
3. How messages with no explicit timing are scheduled
4. Whether "lost" was a presentation feature or semantic
5. How "after" and event timing worked exactly

**Cold guess at `"timing": "causal"`:**
Events unfold in a causally consistent way - messages respect dependencies rather than just sequential list order.

**Time spent cold reading: 3 minutes**

---

## After Reading Guide

**What I learned about `"timing": "causal"`:**
- Default is `"sequential"`: each message starts when the previous one lands
- `"causal"`: each message starts when **the sender is free** (after receiving its last message and sending its previous one)
- Replies wait for what they reply to
- Side branches never delay the main flow
- Order in list still breaks ties

This is exactly what I needed - it means I can add a backup-replication message after the ack without delaying the "ok" message, because the replica and primary are independent nodes.

**Key insight for the task:**
Since we have `"timing": "causal"`, adding the backup message will not delay the primary→client "ok" message, because causal timing ensures side branches don't affect the main critical path.

---

## Beat Times (Unmodified)

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

---

## Edits Made

**Time spent understanding before editing: ~5 minutes**

**Guide sentences relied on:**
- "`"causal"`: it starts when its **sender is free** — after the last message the sender received has landed and its own previous message has landed."
- "A reply waits for what it replies to; a side branch from another node never delays it"
- "`"after"` starts it when the earlier message with that label lands (+ `delay`)"

**Changes:**
1. Added "backup" node to the nodes array
2. Added `"latency": 1200` and `"caption": "slow disk: ack delayed"` to the ack message (making the round-trip 1200ms instead of 600ms)
3. Added new message: `{"from": "replica", "to": "backup", "label": "copy x=1", "after": "ack"}` - this creates a side branch that sends immediately after ack lands, without delaying the main path

---

## Check Result

**First check: CLEAN** ✓
- 0 errors, 0 warnings
- 4380ms, 8 steps, all captioned
- Scene 939 B → timeline 8986 B

No rounds needed beyond the first check.

---

## Beat-by-Beat Comparison

| Beat | Original Time | New Time | Movement | Required? |
|------|--|--|--|--|
| 1. write x=1 | 0ms | 0ms | — | N/A (unchanged) |
| 2. replicate x=1 | 600ms | 600ms | — | N/A (unchanged) |
| 3. ack (caption) | 1200ms | 1200ms | — | **No**: same start time; message travels 1200ms now (was 600) |
| 4. ok + backup | 1800ms | 2400ms | +600ms | **YES**: ack now lands at 2400ms, primary sends ok when free (after ack lands) |
| 5. write x=2 lost | 2400ms | 3000ms | +600ms | **YES**: ok lands at 3000ms, so client sends retry when it's free |
| 6. primary crashes | 2500ms | 3100ms | +600ms | **YES**: 100ms after ok lands (which is now 3000ms) |
| 7. retry + promotion | 3000ms | 3600ms | +600ms | **YES**: lost write lands at 3600ms, promotion at same time |
| 8. end | 3600ms | 4200ms | +600ms | **YES**: total animation longer by the 600ms extra ack latency |

**Verdict on README item 3**: All movements are **REQUIRED** by the task. Nothing moved that should have stayed put:
- The ok message timing is correct: sent when primary is free (after ack lands)
- The crash timing is correct: 100ms after ok reaches client
- The promotion timing is correct: when lost retry would land

**Causal timing prevented unintended side effects:**
- The backup message (side branch from replica) did NOT delay the primary→client ok message
- Both the backup copy and ok start at 2400ms (when replica and primary both become free) without conflict
- If this were sequential timing, adding the backup message would have delayed everything after it — but with causal, the side branch ran in parallel

---

## Final Opinion

**Causal vs Sequential — which is easier?**

**Causal is EASIER and should be the default.**

**The concrete case that decided it:**
Adding the backup message. With sequential timing, I would have needed to:
1. Anchor the backup message with `"after": "ack"` 
2. Anchor the ok message with `"after": "ack"` to prevent the backup from pushing it
3. Possibly adjust delays to interleave them correctly

With causal timing, I only had to write the backup message with `"after": "ack"`, and the timing fell into place correctly. The replica and primary are independent, so neither blocked the other. The system figured out: ok starts when primary is free (receiving ack), backup starts when replica is free (sending ack). Both happen at the same instant (2400ms) without needing explicit synchronization.

**For someone re-editing this file later**, causal timing is more forgiving: side branches can be inserted without cascading delays through the entire message list. The story logic is preserved automatically by the sender-free rule.

