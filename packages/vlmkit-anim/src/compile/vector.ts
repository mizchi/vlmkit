/**
 * `vector` → the generic timeline, written as a list of tweens instead of
 * per-property keyframe tracks. Sequential by default; `at` overrides
 * (`"<"` = with the previous item, `"+200"` = 200ms after it ends, a number =
 * absolute). `x`/`y`/`w`/`h` in `to` fill the other component from the
 * current value so a one-axis move is one key.
 */

import type { Timeline, TrackProp, TrackValue, VectorScene } from "../types.ts";
import { isAnnotationOp } from "./annotate.ts";
import { Builder } from "./builder.ts";

export function compileVector(scene: VectorScene): Timeline {
  const b = new Builder(scene, { width: 640, height: 360, stepMs: 500 });
  for (const n of scene.nodes) {
    b.node({ ...n });
    b.anchor(n.id, n.id);
  }
  let prevStart = 0;
  let prevEnd = 0;
  for (const item of scene.timeline) {
    if (isAnnotationOp(item)) {
      // An annotation rides the sequence like a wait: it starts when the previous item ends.
      b.t = prevEnd;
      b.annotate(item, "timeline");
      prevStart = prevEnd;
      prevEnd = b.t;
      continue;
    }
    b.annotate(item, "timeline"); // counts the index only; a tween or wait is never an annotation
    if ("wait" in item) {
      const start = prevEnd;
      if (item.caption || item.label) b.step(item.caption, item.label, start);
      prevStart = start;
      prevEnd = start + item.wait;
      b.t = Math.max(b.t, prevEnd);
      continue;
    }
    let start = prevEnd;
    if (typeof item.at === "number") start = item.at;
    else if (item.at === "<") start = prevStart;
    else if (typeof item.at === "string") start = prevEnd + Number(item.at);
    const duration = item.duration ?? b.stepMs;
    const endT = start + duration;
    const targets = Array.isArray(item.target) ? item.target : [item.target];
    if (item.caption || item.label) b.step(item.caption, item.label, start);
    for (const id of targets) {
      const to = { ...item.to } as Record<string, TrackValue>;
      if ("x" in to || "y" in to) {
        const cur = (b.valueAt(id, "pos", start) as [number, number] | undefined) ?? [0, 0];
        to.pos = [typeof to.x === "number" ? to.x : cur[0], typeof to.y === "number" ? to.y : cur[1]];
        delete to.x;
        delete to.y;
      }
      if ("w" in to || "h" in to) {
        const cur = (b.valueAt(id, "size", start) as [number, number] | undefined) ?? [0, 0];
        to.size = [typeof to.w === "number" ? to.w : cur[0], typeof to.h === "number" ? to.h : cur[1]];
        delete to.w;
        delete to.h;
      }
      for (const [prop, value] of Object.entries(to)) {
        if (prop === "text") b.set(id, "text", value, endT);
        else if (duration <= 0) b.set(id, prop as TrackProp, value, start);
        else b.tween(id, prop as TrackProp, value, start, endT, item.easing ?? "ease-in-out");
      }
    }
    prevStart = start;
    prevEnd = Math.max(prevEnd, endT);
    b.t = Math.max(b.t, endT);
  }
  if (!b.steps.some((s) => s.t === 0)) b.step(scene.title, "start", 0);
  return b.build({ title: scene.title, kind: "vector" });
}
