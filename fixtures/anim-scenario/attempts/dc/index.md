# Intro: vlmkit-anim

Two scenes, played in order.

1. **`scene-1.json`** (`kind: diagram`) — the pipeline: a scene file compiles
   to a timeline, which plays in the browser, renders to frames, encodes to
   a GIF, and is read back and checked.
2. **`scene-2.json`** (`kind: state-machine`) — the loop that pipeline runs
   in: write → check → (fail) read the hint → edit → check → (pass) done,
   closing on the one-line pitch.
