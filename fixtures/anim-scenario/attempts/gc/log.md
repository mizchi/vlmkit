# Animation Scene Log: modules-request-walk

## Round 1: Initial Check
```
✓ scene.json (modules): 0 error(s), 0 warning(s)
  11060ms · 17 steps (16 captioned) · 25 nodes · 11 tracks / 60 keyframes
  scene 1611 B → timeline 8289 B (×5.1)
  next: vlmkit-anim explain scene.json · vlmkit-anim render scene.json --step N · vlmkit-anim html scene.json --out page.html
```

## Layout Check
```
0 of 17 frames with layout issues · 0 overlap(s) · 0 clipped · 0 crossed
```

## Explanation (steps 1-17)
```
Request through checkout — 17 steps, 11060ms, 25 nodes
 1. [    0ms] Request through checkout
 2. [  350ms] Request enters at web
 3. [ 1050ms] Routed to checkout via gateway
 4. [ 1750ms] Reserve stock
 5. [ 2450ms] Query inventory database
 6. [ 3150ms] Stock reserved
 7. [ 3850ms] Inventory confirmed
 8. [ 4550ms] Charge the card (asynchronous)
 9. [ 5250ms] Payment queued for async processing
10. [ 5950ms] Record the order
11. [ 6650ms] Persist order
12. [ 7350ms] Order recorded
13. [ 8050ms] Queue order for async processing
14. [ 8750ms] Async hop 1: payments are eventual
15. [ 9450ms] Async hop 2: orders are queued
16. [10150ms] The checkout makes the customer experience consistent while payments and orders settle eventually
17. [10850ms] (end)
```

## Summary

**First-attempt result:** 0 ✗, 0 ⚠  
**Rounds to green:** 1 (passed on first check)  
**Layout result:** 0 issues across all 17 frames  
**Kind choice:** `kind: modules` with sequence. One scene, two uses: `vlmkit-anim still` for the static module map, `vlmkit-anim video` for the animated walk. Perfect fit for the brief.  
**Async hops marked:** Using `highlight` on edges `payments->queue` and `checkout->payments` to show both queues as eventual-consistency markers.  
**Hand-typed coordinates/colours/canvas:** 0. The `modules` kind auto-layouts all nodes by their dependency structure; the three groups (frontend, domain, platform) are positioned automatically; edges bend themselves. No manual positioning needed.  
**Friction:** None. The writing guide for `kind: modules` was clear and complete. The tool accepted the dependency graph immediately and produced the correct three-tier layout (frontend above domain above platform) with automatic edge routing. The `sequence` with `flow` and `highlight` ops walked the request path smoothly. The integration of annotations (highlight edges to mark async boundaries) worked as documented.
