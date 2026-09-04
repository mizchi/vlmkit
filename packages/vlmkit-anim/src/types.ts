/**
 * The two layers of the explanatory-animation IR.
 *
 * **Layer 1 — Scene IR** (`vlmkit-anim/scene@1`): what is being explained. A
 * `kind`-tagged document — a sorting run, a state machine trace, heap
 * operations, messages between distributed nodes, a concept diagram walked
 * through in steps, or a generic vector timeline. It is the layer an agent
 * writes and a human re-reads: it carries intent (`algorithm: "bubble"`,
 * `trace: ["start", "finish"]`), not coordinates.
 *
 * **Layer 2 — Timeline IR** (`vlmkit-anim/timeline@1`): how it moves. Nodes
 * with initial attributes plus absolute-time keyframe tracks. It is what the
 * `<vlm-anim>` runtime plays through the Web Animations API and what
 * `render-svg.ts` samples headlessly. Every kind compiles to it; it can also
 * be authored directly when nothing semantic fits.
 *
 * Both layers are plain JSON. Types here are the source of truth; the
 * validator in `validate.ts` checks documents against them field by field
 * and phrases each failure for an agent to repair from.
 */

// ---------------------------------------------------------------------------
// Layer 2: Timeline IR
// ---------------------------------------------------------------------------

export const TIMELINE_FORMAT = "vlmkit-anim/timeline@1";
export const SCENE_FORMAT = "vlmkit-anim/scene@1";

export type Shape = "rect" | "circle" | "ellipse" | "text" | "line" | "arrow" | "path" | "group";

export const SHAPES: readonly Shape[] = ["rect", "circle", "ellipse", "text", "line", "arrow", "path", "group"];

/** A point as `[x, y]` in canvas pixels. */
export type Vec2 = [number, number];

export interface TimelineNode {
  id: string;
  shape: Shape;
  /** Translation of the node's local origin. Default `[0, 0]`. */
  pos?: Vec2;
  /** rect / ellipse: `[width, height]`, drawn centred on the local origin. */
  size?: Vec2;
  /** circle radius. */
  r?: number;
  /** rect corner radius. */
  rx?: number;
  /** line / arrow endpoints in local coordinates. */
  points?: [Vec2, Vec2];
  /** path data, local coordinates. */
  d?: string;
  /** text content (shape `text`) or a label centred in any other shape. */
  text?: string;
  fontSize?: number;
  /** Text anchor for shape `text`. Labels on other shapes are always centred. */
  anchor?: "start" | "middle" | "end";
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  /** 0..1 */
  opacity?: number;
  /** Stroke draw progress 0..1 (line / arrow / path). 1 = fully drawn. */
  dash?: number;
  scale?: number;
  /** degrees */
  rotate?: number;
  /** Parent `group` node id; children inherit its transform. */
  parent?: string;
  /** Text colour for a `text` shape or a label. Default: dark on light fills. */
  color?: string;
}

/** Animatable properties. `pos` and `size` take `[x, y]`; `text` is discrete. */
export type TrackProp =
  | "pos"
  | "size"
  | "r"
  | "opacity"
  | "fill"
  | "stroke"
  | "color"
  | "scale"
  | "rotate"
  | "dash"
  | "text";

export const TRACK_PROPS: readonly TrackProp[] = [
  "pos",
  "size",
  "r",
  "opacity",
  "fill",
  "stroke",
  "color",
  "scale",
  "rotate",
  "dash",
  "text",
];

export type Easing =
  | "linear"
  | "ease"
  | "ease-in"
  | "ease-out"
  | "ease-in-out"
  | "step-end"
  | "step-start"
  | `cubic-bezier(${string})`;

export const NAMED_EASINGS = ["linear", "ease", "ease-in", "ease-out", "ease-in-out", "step-end", "step-start"] as const;

export type TrackValue = number | string | Vec2;

export interface Keyframe {
  /** Absolute time in milliseconds. */
  t: number;
  value: TrackValue;
  /** Easing INTO this keyframe from the previous one. Default `ease-in-out`. */
  easing?: Easing;
}

export interface Track {
  target: string;
  prop: TrackProp;
  keyframes: Keyframe[];
}

/** A named moment: chapter marker for stepping, caption for narration. */
export interface Step {
  t: number;
  label?: string;
  caption?: string;
}

export interface Timeline {
  format: typeof TIMELINE_FORMAT;
  canvas: { width: number; height: number; background?: string };
  /** Total length in ms. Computed from the last keyframe / step when omitted. */
  duration?: number;
  nodes: TimelineNode[];
  tracks: Track[];
  steps?: Step[];
  meta?: { title?: string; kind?: string; [k: string]: unknown };
}

// ---------------------------------------------------------------------------
// Layer 1: Scene IR
// ---------------------------------------------------------------------------

export type SceneKind = "diagram" | "state-machine" | "sort" | "heap" | "distributed" | "vector";

export const SCENE_KINDS: readonly SceneKind[] = ["diagram", "state-machine", "sort", "heap", "distributed", "vector"];

interface SceneBase {
  format: typeof SCENE_FORMAT;
  kind: SceneKind;
  title?: string;
  /** Milliseconds per step. Kinds default to 600. */
  stepMs?: number;
  canvas?: { width?: number; height?: number; background?: string };
  theme?: Partial<Theme>;
}

export interface Theme {
  node: string;
  nodeStroke: string;
  text: string;
  accent: string;
  muted: string;
  ok: string;
  bad: string;
  background: string;
  fontSize: number;
}

// ---- diagram --------------------------------------------------------------

export interface DiagramNode {
  id: string;
  label?: string;
  shape?: "rect" | "circle" | "ellipse";
  /** Explicit position overrides the layout. */
  pos?: Vec2;
  fill?: string;
  /** Hidden until a `show` step reveals it. Default: visible from t=0. */
  hidden?: boolean;
}

export interface DiagramEdge {
  from: string;
  to: string;
  label?: string;
  /** `arrow` (default) or plain `line`. */
  style?: "arrow" | "line";
  hidden?: boolean;
}

/** One narrated beat of a diagram. Exactly one action key per step. */
export type DiagramStep =
  | { show: string | string[]; caption?: string; ms?: number }
  | { hide: string | string[]; caption?: string; ms?: number }
  | { highlight: string | string[]; caption?: string; ms?: number }
  | { unhighlight: string | string[]; caption?: string; ms?: number }
  /** `"a->b"` or `["a","b"]`: a token travels along the edge. */
  | { flow: string | [string, string]; caption?: string; ms?: number }
  | { note: string; ms?: number }
  | { relabel: { id: string; text: string }; caption?: string; ms?: number };

export interface DiagramScene extends SceneBase {
  kind: "diagram";
  nodes: DiagramNode[];
  edges?: DiagramEdge[];
  /** `lr` (default), `tb`, `grid`, `circle`. Ignored for nodes with `pos`. */
  layout?: "lr" | "tb" | "grid" | "circle";
  sequence?: DiagramStep[];
}

// ---- state-machine --------------------------------------------------------

export interface StateDef {
  id: string;
  label?: string;
  /** Drawn with a double ring. */
  final?: boolean;
  /** Pin this state; unpinned states are laid out around it. */
  pos?: Vec2;
}

export interface Transition {
  from: string;
  to: string;
  /** Event name; the arrow label. */
  on: string;
  /** Optional guard / action text appended to the label. */
  note?: string;
}

/**
 * One item of a trace: an event name, an event with its own caption, a
 * captioned pause, or a jump — the token moves to `goto` without a
 * transition, which is how a second path is shown after the first has ended.
 */
export type TraceItem = string | { on: string; caption?: string } | { note: string } | { goto: string; caption?: string };

export interface StateMachineScene extends SceneBase {
  kind: "state-machine";
  states: (string | StateDef)[];
  initial: string;
  transitions: Transition[];
  /** Fired in order; each event must be a legal transition from the current state. */
  trace: TraceItem[];
  layout?: "lr" | "tb" | "circle";
}

// ---- sort -----------------------------------------------------------------

/** Every op may carry `caption` (overrides the generated one) and `ms` (this beat's length). */
export type SortOp =
  | { compare: [number, number]; caption?: string; ms?: number }
  | { swap: [number, number]; caption?: string; ms?: number }
  /** Mark index as in its final place. */
  | { done: number | number[]; caption?: string; ms?: number }
  /** Overwrite the value at an index (insertion sort shifts). */
  | { set: { index: number; value: number }; caption?: string; ms?: number }
  /** A captioned pause: the string is the caption. */
  | { note: string; ms?: number };

export interface SortScene extends SceneBase {
  kind: "sort";
  values: number[];
  /** Generate `ops` by running this algorithm. Ignored when `ops` is given. */
  algorithm?: "bubble" | "insertion" | "selection";
  ops?: SortOp[];
  /** Compare / swap captions on by default. */
  captions?: boolean;
}

// ---- heap -----------------------------------------------------------------

export type HeapOp = { push: number; caption?: string } | { pop: true; caption?: string } | { note: string };

export interface HeapScene extends SceneBase {
  kind: "heap";
  /** `min` (default) or `max`. */
  type?: "min" | "max";
  /** Values present before the first op. Heapified as given (must already satisfy the heap property). */
  initial?: number[];
  ops: HeapOp[];
}

// ---- distributed ----------------------------------------------------------

export interface DistNode {
  id: string;
  label?: string;
  /** Initial status, colours the box: `up` (default) `down` `leader` `busy`. */
  status?: "up" | "down" | "leader" | "busy";
}

export interface DistMessage {
  from: string;
  to: string;
  label?: string;
  /** Start time in ms, or `"<"` to start together with the previous message. Default: right after the previous message lands. */
  at?: number | "<";
  /** Start when the earlier message with this `label` lands (plus `delay`). Alternative to `at`. */
  after?: string;
  /** Extra ms after the `after` message lands. Default 0. */
  delay?: number;
  /** Travel time in ms. Default `stepMs`. */
  latency?: number;
  /** Drop the message: it fades mid-way and never lands. */
  lost?: boolean;
  caption?: string;
}

export interface DistEvent {
  /** Absolute ms. Fragile when message timing shifts; prefer `after`. */
  at?: number;
  /** Fire when the message with this `label` lands (plus `delay`). */
  after?: string;
  delay?: number;
  node: string;
  status: "up" | "down" | "leader" | "busy";
  caption?: string;
}

export interface DistributedScene extends SceneBase {
  kind: "distributed";
  nodes: (string | DistNode)[];
  messages: DistMessage[];
  events?: DistEvent[];
  /**
   * When a message with no `at` / `after` starts.
   * `sequential` (default): when the previous message in the list lands.
   * `causal`: when its sender is free — the later of the last message the
   * sender received landing and the sender's own previous message landing;
   * messages from senders with nothing to wait for start at 0.
   */
  timing?: "sequential" | "causal";
}

// ---- vector (generic) -----------------------------------------------------

/**
 * A tween in author-friendly form. `to` lists the properties reached by the
 * end of the tween; `x` / `y` / `w` / `h` are accepted as shorthand for the
 * components of `pos` / `size`.
 */
export interface VectorTween {
  target: string | string[];
  to: Record<string, TrackValue>;
  /** Default 500. */
  duration?: number;
  easing?: Easing;
  /**
   * Start time. A number is absolute ms. `"<"` starts with the previous item.
   * `"+200"` / `"-100"` offsets from the previous item's end. Default: after the
   * previous item.
   */
  at?: number | string;
  caption?: string;
  label?: string;
}

/** A pause of `wait` ms, optionally captioned. */
export interface VectorWait {
  wait: number;
  caption?: string;
  label?: string;
}

export interface VectorScene extends SceneBase {
  kind: "vector";
  nodes: TimelineNode[];
  timeline: (VectorTween | VectorWait)[];
}

export type Scene = DiagramScene | StateMachineScene | SortScene | HeapScene | DistributedScene | VectorScene;

// ---------------------------------------------------------------------------
// Diagnostics
// ---------------------------------------------------------------------------

export type Severity = "error" | "warn";

export interface Diagnostic {
  severity: Severity;
  /** JSON path, e.g. `nodes[2].shape`. */
  path: string;
  message: string;
  /** How to repair, when the validator can tell. */
  hint?: string;
}
