# Cold Reading Log

## Story in my words
A primary-replica replication system: client sends write, primary replicates to replica, replica acks, primary confirms client, then primary crashes. Client retries against the promoted replica. This shows a failover scenario.

## Unclear before reading guide
1. **Timing model**: How does delay attach to messages? I see `"delay"` only in events, not in messages.
2. **Adding backup node**: Where does it go in nodes array? How do I express "replica sends to backup"?
3. **Replica ack delay**: Currently the ack message has no delay field. How do I add a 1200ms delay to it, and what field holds that?
4. **Message ordering and beat timing**: When I add replica→backup message, will that shift the "write x=2" event timing? Do I need to anchor messages to prevent drift?
5. **The "lost" message**: Does the lost message's position in the messages array affect when "write x=2" event fires?
6. **Caption meaning**: The task says the ack caption should explain "why it is slow" — is that a new caption field, or modifying the message somehow?

## Observations
- Format is `vlmkit-anim/scene@1` with `kind: distributed`
- Nodes can be strings or objects with `{id, status}`
- Messages have `from`, `to`, `label`, optional `lost`, optional `caption`
- Events have `after` (reference to a message or status change), `delay`, `node`, `status`, `caption`
- The current "ack" message (line 9) has no special fields — it's a simple message

## Explain output (original)
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

## Key points from guide (distributed kind)
- `"at": "<"` means start together with the previous message
- `"after": "label"` starts when that message lands, + optional delay
- Inserting a message delays everything after unless anchored with `"after"`
- Sequential model (default): messages start when previous lands
- Causal model: messages start when sender is free (no push)

## Edit plan (3 minutes before editing)
1. Add "backup" node
2. Ack: add `"after": "replicate x=1", "delay": 1200`, caption "slow disk read"
3. Copy message: `"from": "replica", "to": "backup"`, label "copy x=1", `"at": "<"` (with ack)
4. OK: add `"after": "ack"` to anchor it and prevent drift
5. Verify: explain should show beats at 0, 600, 1800 (ack), 2400 (copy, ok), crash, promoted

## Edits made
- Line 5: nodes += "backup"
- Line 9: ack += `"after": "replicate x=1", "delay": 1200, "caption": "slow disk read"`
- Line 10 (new): copy message with `"at": "<"`
- Line 11: ok += `"after": "ack"`

## Check result: PASS
✓ 0 errors, 0 warnings, 4980ms total, 8 steps

## Explain after edit
```
1. [    0ms] client → primary: write x=1
2. [  600ms] primary → replica: replicate x=1
3. [ 2400ms] slow disk read · replica → backup: copy x=1
4. [ 3000ms] primary → client: ok
5. [ 3600ms] primary has crashed: the write is lost
6. [ 3700ms] primary crashes
7. [ 4200ms] client retries against the promoted replica · replica is promoted
8. [ 4800ms] end
```
