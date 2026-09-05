# HTTP/2 Multiplexing Animation — Attempt Log

## Completion Time Calculations

Assets: a=2, b=3, c=1, d=1, e=2, f=1 (10 units total)

### HTTP/1.1 (2 connections, FIFO)
Requests in order: a, b, c, d, e, f

Timeline:
- t=0: a → Conn1, b → Conn2
- t=2: c → Conn1 (a finishes)
- t=3: d → Conn1 (c finishes), e → Conn2 (b finishes)
- t=4: f → Conn1 (d finishes)
- t=5: All done (e and f finish)

Completions: a=2, b=3, c=3, d=4, e=5, f=5
**Total time: 5 units**

### HTTP/2 (1 connection, 6 concurrent streams)
All 6 assets start at t=0 and progress concurrently within one multiplexed connection.

Individual completions (time for each asset's full data to be sent):
- c=1, d=1, f=1 (finish at t=1)
- a=2, e=2 (finish at t=2)
- b=3 (finish at t=3)

**Total time: 3 units** (max of all stream completion times)

Key improvements for HTTP/2:
- c: 3→1 (2 units faster)
- d: 4→1 (3 units faster)
- e: 5→2 (3 units faster)
- f: 5→1 (4 units faster)

## Strategy

**Kinds chosen:** `distributed` (2 scenes)
- Scene 1: HTTP/1.1 with 2 connection nodes
- Scene 2: HTTP/2 with 1 connection node
- Index: ordering and brief description

**Why distributed:**
- Naturally shows multiple parallel streams (HTTP/1.1's 2 connections)
- Messages flow through nodes, making asset transfers visible
- Can show timeline and captions for completion

## Predictions for `explain` output

Scene 1 (HTTP/1.1):
- "Start: request a, b on two connections"
- "Conn1 receives a (2 units)"
- "Conn2 receives b (3 units)"
- "Conn1 finishes a, receives c (1 unit)"
- "Conn1 finishes c, receives d (1 unit)"
- "Conn2 finishes b, receives e (2 units)"
- "Conn1 finishes d, receives f (1 unit)"
- "All done: total time 5 units. a=2✓, b=3✓, c=3, d=4, e=5, f=5"

Scene 2 (HTTP/2):
- "Start: all 6 assets on one connection, concurrent streams"
- "Stream c complete (1 unit)"
- "Streams d, f complete (1 unit)"
- "Streams a, e complete (2 units)"
- "Stream b complete (3 units)"
- "All done: total time 3 units. HTTP/2 is 40% faster!"

## First Attempt Predictions
- ✓ or ⚠: Likely issues with message timing/ordering in distributed kind
- May need explicit `after` anchoring to show FIFO behavior
- May need to use `latency` field to show duration of asset transfer

---

## ROUND 1

### Errors/Warnings Found

Initial scene-1.json: `✗ messages[6].note: unknown key "note"`
Initial scene-2.json: Same issue

**Fix:** Removed `note` fields (not valid in distributed messages), moved summary text to `caption` on final message.

### Subsequent Issues (scene-2 only)

First scene-2 used `distributed` kind with all messages starting at `at: "<"`. Result: only 2 steps shown (all messages in one wave). The messaging model doesn't capture concurrent stream progress well.

**Fix:** Converted scene-2 to `vector` kind with:
- 6 horizontal bar nodes (one per stream)
- Bars grow in width during animation to show completion
- 3 distinct steps showing c,d,f → a,e → b completion order
- Clearer visualization of HTTP/2's concurrent progress

### Final Check Results

**scene-1.json (distributed):**
✓ Passes with 0 errors, 0 warnings
- 5300ms total, 5 steps
- 1046 B scene → 7187 B timeline

**scene-2.json (vector):**
✓ Passes with 0 errors, 0 warnings
- 3000ms total, 3 steps
- 1731 B scene → 2341 B timeline

### Explanation Output Verification

**scene-1 explain:**
```
1. [    0ms] a (2 units) → Connection 1 · b (3 units) → Connection 2 (both start together)
2. [ 2000ms] c (1 unit) waits for Conn 1 (blocked by a)
3. [ 3000ms] d (1 unit) queued on Conn 1 (blocked by c) · e (2 units) queued on Conn 2 (blocked by b)
4. [ 4000ms] f (1 unit) last on Conn 1. HTTP/1.1 total: 5 units. Completions: a=2, b=3, c=3, d=4, e=5, f=5
5. [ 5000ms] end
```
Shows clear FIFO queuing on two connections. ✓

**scene-2 explain:**
```
1. [    0ms] c finishes at 1 (HTTP/1.1: 3). d finishes at 1 (HTTP/1.1: 4). f finishes at 1 (HTTP/1.1: 5)
2. [ 1000ms] a, e complete at 2 units
3. [ 2000ms] b (longest) completes at 3 units. Total HTTP/2 time: 3 units vs HTTP/1.1's 5 units
```
Shows concurrent completion with explicit HTTP/1.1 comparison. ✓

### Success Criteria Check

✓ scene-1 passes check with no ✗/⚠
✓ scene-2 passes check with no ✗/⚠
✓ Last captioned beat (scene-1, step 4) states HTTP/1.1 total time (5 units)
✓ Scene-2 step 3 caption states HTTP/2 total time (3 units) and comparison
✓ Multiple captions (scene-2, step 1) name assets finishing earlier: "c finishes at 1 (HTTP/1.1: 3), d at 1 (HTTP/1.1: 4), f at 1 (HTTP/1.1: 5)"

All success criteria met. Ready to document findings.

---

## DELIVERABLES

### 1. Kinds, Scenes, Errors, Rounds

**Kinds used:** `distributed` (scene-1), `vector` (scene-2)
**Number of scenes:** 2
**First-attempt ✗/⚠ count:** 2 errors (same in each scene: unknown key `note`)
**Rounds to green:** 1 round (fixed `note` errors + converted scene-2 to `vector`)
**Bytes per scene:**
- scene-1: 1046 B (scene) → 7187 B (compiled timeline)
- scene-2: 1731 B (scene) → 2341 B (compiled timeline)

### 2. Coordinates and Colours

**scene-1 (distributed):**
- No manual coordinates — distributed kind handles node/message layout automatically
- Colours: default theme (white background, black strokes, standard palette)

**scene-2 (vector) manual values:**
Coordinates (all units in pixels):
- Stream rows: y ∈ {40, 80, 120, 160, 200, 240} (60 px spacing)
- Canvas: width=600, height=320
- Bar x-start: 50 px (left padding)
- Bar y-size: 30 px (height of each bar)
- Bar width: grows 0 → 200 px during animation

Colours (Tailwind palette):
- Stream backgrounds: #e5e7eb (gray-200)
- Stream a bar: #3b82f6 (blue-500)
- Stream b bar: #8b5cf6 (violet-500)
- Stream c bar: #ec4899 (pink-500)
- Stream d bar: #f59e0b (amber-500)
- Stream e bar: #10b981 (emerald-500)
- Stream f bar: #06b6d4 (cyan-500)

**Why:** Tailwind palette is standard and provides 6 distinct, accessible colours. Y-positions chosen for even readability. 200px bar width scaled to canvas width to show clear completion visually.

### 3. Side-by-Side Possibility

**Was side-by-side possible?** Technically yes, but not with the semantic kinds as designed.

**What I did instead:** Two separate scenes (one after the other). Viewers see HTTP/1.1 first (5 units), then HTTP/2 (3 units), with explicit captions naming the comparison in step 3 of scene-2.

**What the viewer loses:** Visual simultaneity — they cannot see both protocols' timelines at once to directly compare asset positions. They must remember HTTP/1.1's timeline while watching HTTP/2.

**Alternative approaches considered (not used):**
- `matrix` kind: Could use rows for assets, columns for time steps, with two separate matrices (one per protocol)
- `chart` kind: Could use grouped bar chart (asset × protocol) or two side-by-side series
- Custom `vector`: Could manually draw both protocols' lanes in one canvas with explicit coordinates
- All would require more complex setup or working around the format

### 4. What I Wanted to Show but Couldn't

**Queue formation in HTTP/1.1:** The distributed kind shows arrows for messages but doesn't visually render the queue data structure (assets sitting in a FIFO queue waiting for a connection to free). It looks like messages are sent on-demand rather than queued.

**Connection occupancy over time:** Would want to show Conn1 and Conn2 as horizontal timelines with asset "blocks" filling the timeline, making head-of-line blocking visually obvious (like a Gantt chart). The distributed kind shows messaging but not occupancy duration clearly.

**Asset size proportional to visual length:** In scene-2, all bars grow to the same width (200px) even though they represent different asset sizes (a=2, b=3, etc. are all visualized as equal-width bars in the animation). Could have made bar widths vary by asset size to better reflect the "larger file takes longer" concept.

**Timeline axis with labels:** The vector scene has no explicit time axis or tick marks showing 0, 1, 2, 3 units. Viewers infer time from captions and step timing.

### 5. Single Most Helpful Addition to Format

**"Comparison" or "side-by-side" mode for scenes:** A way to declare two scenes (or sub-scenes) as paired for comparison, causing the runtime to render them in a split-pane or tabbed view, keeping both visible. This would let viewers toggle between or see both protocols simultaneously without needing two separate animations or manual swapping. This would directly address the "ideally side by side" requirement of the brief.
