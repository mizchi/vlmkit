# Re-Edit Report: Primary-Replica Failover with Slow Ack and Backup

## 1. Cold Reading & Initial Understanding

A distributed system replicates writes from client to primary to replica, with the replica acknowledging and the primary confirming the client. After a second write is lost due to primary crash, the client retries against a promoted replica.

**Guess at "causal" timing before reading guide:** Events unfold in causally consistent order (dependencies respected), not just sequential list order.

**Unclear before editing:**
- What "causal" timing does exactly (scheduler rule for messages)
- How "after" timing anchors messages
- Whether side branches (like a backup copy) would cascade delays

## 2. Time & Key Guide Sentences

**5 minutes** before editing.

Relied on:
- "A message starts when its **sender is free** — after the last message the sender received has landed and its own previous message has landed."
- "A reply waits for what it replies to; **a side branch from another node never delays it**"

## 3. First Check Result

**CLEAN** ✓ — 0 errors, 0 warnings. One round sufficient.

## 4. Diff in Words

**Added:**
- "backup" node to the nodes array
- `"latency": 1200` to ack message (slow disk: network delay now 1200ms instead of 600ms)
- `"caption": "slow disk: ack delayed"` on ack message
- New message: replica → backup with label "copy x=1", triggered `"after": "ack"`

**Why:** The latency stretches the ack round-trip, so dependent messages (client's retry) shift later. The backup message uses `after: "ack"` to run as a side branch without cascading delays to the main reply path.

## 5. Beat-by-Beat Before/After & Verdict

| Event | Before | After | Moved? | Required? |
|-------|--------|-------|--------|-----------|
| write x=1 | 0ms | 0ms | — | — |
| replicate | 600ms | 600ms | — | — |
| ack send | 1200ms | 1200ms | — | No (latency changed, not send time) |
| **ok + backup send** | **1800ms** | **2400ms** | **+600ms** | **YES** (ack now lands later) |
| write x=2 lost | 2400ms | 3000ms | +600ms | YES (client waits for ok) |
| crash | 2500ms | 3100ms | +600ms | YES (100ms after ok arrives) |
| promotion | 3000ms | 3600ms | +600ms | YES (triggers when retry lands) |

**Verdict:** All movements are **required**. Causal timing prevented the backup-to-replica from delaying the primary-to-client ok — both start at 2400ms because their senders (replica, primary) became free at the same moment.

## 6. Causal vs Sequential

**Causal is easier and should be the default.**

Concrete case: Adding backup. With sequential timing, inserting it between ack and ok would delay ok. I'd need to anchor both messages with `"after": "ack"` and fiddle with delays. With causal, one `"after": "ack"` on the backup and the primary's ok naturally starts when the primary is free (after receiving ack) — no synchronization needed. Side branches are transparent to the main path.
