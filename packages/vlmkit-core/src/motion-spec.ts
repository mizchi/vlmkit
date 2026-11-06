/**
 * `{"motion": {...}}` in `vlmkit.gates.json`: what a brief asks of a page's motion, written down
 * per target, and run as `inspect motion` (issue #215).
 *
 * In every motion-authoring round the agents mapped a brief to `--expect-*` flags by hand, each
 * time, and most of the small-model round's friction was that mapping: a flag given once applied
 * to every target, `any` was missing, a per-target list had to be counted. The mapping was then
 * thrown away with the session, so CI could not check it again. Here each target carries its own
 * expectations by name, and the object is compiled to the command line `inspect motion` already
 * takes — the flags stay the one implementation, and `gates list` shows exactly what will run.
 *
 * ```json
 * { "motion": {
 *     "actions": [{ "click": ".toggle" }],
 *     "targets": [
 *       { "selector": ".menu", "origin": "top", "duration": 250, "easing": "ease-out" },
 *       { "selector": ".backdrop", "still": true }
 *     ],
 *     "baseline": ".vlmkit/motion/menu.json" } }
 * ```
 *
 * Targets are put in the order the command line measures them: `selector` targets first, then
 * `track` ones. A key it does not know is a config error naming its JSON path, as everywhere in
 * the file: a misspelt expectation that silently checked nothing is the failure this exists to end.
 *
 * Pure: an object in, a command string out.
 */

/** One expectation value given as the flag takes it: a number of ms, or a string ("280ms", "+50"). */
type TimeValue = number | string;

export interface MotionSpecTarget {
  /** The element that moves (`--selector`). */
  selector?: string;
  /** Or the region it fills in the last frame (`--track x,y,w,h`): a canvas, a recording. */
  track?: string | [number, number, number, number];
  /** Its name in the report and the baseline (`--target`). */
  name?: string;
  /** Its curve, or one per segment (`--expect-easing`). */
  easing?: string | string[];
  /** The point it scales, turns or grows about: a keyword or [x, y] in its own units. */
  origin?: string | [number, number];
  /** When its own animation begins (ms of page time, or "+N" from the last action). */
  start?: TimeValue;
  duration?: TimeValue;
  /** How many runs, or "infinite". */
  iterations?: number | "infinite";
  direction?: string;
  /** Lines its text runs to in every frame. */
  lines?: number;
  /** At rest its left and right edges are this element's (`--expect-span-of`). */
  spanOf?: string;
  /** Its centre must not move (`--still`). A `selector` target only. */
  still?: boolean;
  /** It is meant to leave (`--exit`). A `selector` target only. */
  exit?: boolean;
}

export type MotionSpecAction =
  | { click: string }
  | { hover: string }
  | { leave: true }
  | { scroll: string | number }
  | { wait: TimeValue };

export interface MotionSpec {
  targets: MotionSpecTarget[];
  actions?: MotionSpecAction[];
  /** Each target begins this long after the one before (`--expect-stagger`). */
  stagger?: TimeValue;
  /** Every target is meant to leave (`--exits`). */
  exits?: boolean;
  reducedMotion?: boolean;
  /** Every target's angle on screen stays the same (`--expect-upright`). */
  upright?: boolean;
  everyAction?: boolean;
  start?: TimeValue;
  end?: TimeValue;
  /** Instants to shoot, as `--at` takes them ("0..600/50"). */
  at?: string;
  /** "WxH". */
  viewport?: string;
  deviceScale?: number;
  /** Hold the run to an approved one (`--baseline`), relative to the config file. */
  baseline?: string;
  /** Where the frames go (`--frames`). */
  frames?: string;
}

const TARGET_KEYS = new Set([
  "selector",
  "track",
  "name",
  "easing",
  "origin",
  "start",
  "duration",
  "iterations",
  "direction",
  "lines",
  "spanOf",
  "still",
  "exit",
]);
const SPEC_KEYS = new Set([
  "targets",
  "actions",
  "stagger",
  "exits",
  "reducedMotion",
  "upright",
  "everyAction",
  "start",
  "end",
  "at",
  "viewport",
  "deviceScale",
  "baseline",
  "frames",
]);

/** One argument as `tokenizeCommand` reads it back: quoted when it holds a space or a quote. */
export function quoteArg(value: string): string {
  if (value !== "" && !/[\s'"]/.test(value)) return value;
  return value.includes("'") ? `"${value}"` : `'${value}'`;
}

/** The name `inspect motion` gives a --track target it was not given one for. */
const defaultTrackName = (track: string) => {
  const [x, y, w, h] = track.split(",").map((v) => Number(v.trim()));
  return `region ${x},${y} ${w}x${h}`;
};

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Compile a `{"motion": ...}` entry's value to the `inspect motion` command it stands for.
 * `fail(path, message)` reports a config error at a JSON path (and does not return).
 */
export function motionSpecCommand(raw: unknown, path: string, fail: (path: string, message: string) => never): string {
  if (!isObject(raw)) fail(path, 'must be an object: { "targets": [...], "actions"?: [...], ... }');
  for (const key of Object.keys(raw))
    if (!SPEC_KEYS.has(key))
      fail(`${path}.${key}`, `is not a motion expectation (known: ${[...SPEC_KEYS].join(", ")})`);
  const str = (v: unknown, at: string): string => {
    if (typeof v !== "string" || !v.trim()) fail(at, "must be a non-empty string");
    return (v as string).trim();
  };
  const time = (v: unknown, at: string): string => {
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
    if (typeof v === "string" && v.trim()) return v.trim();
    fail(at, 'must be a number of ms or a time string ("280ms", "1.2s", "+50")');
  };
  const bool = (v: unknown, at: string): boolean => {
    if (typeof v !== "boolean") fail(at, "must be true or false");
    return v as boolean;
  };

  if (!Array.isArray(raw.targets) || raw.targets.length === 0)
    fail(`${path}.targets`, "must be a non-empty array: one entry per element (or region) that moves");
  const parsed = (raw.targets as unknown[]).map((t, i) => {
    const at = `${path}.targets[${i}]`;
    if (!isObject(t)) fail(at, "must be an object");
    for (const key of Object.keys(t))
      if (!TARGET_KEYS.has(key))
        fail(`${at}.${key}`, `is not a target expectation (known: ${[...TARGET_KEYS].join(", ")})`);
    if ((t.selector === undefined) === (t.track === undefined)) fail(at, "needs exactly one of selector or track");
    let track: string | undefined;
    if (t.track !== undefined) {
      if (
        Array.isArray(t.track) &&
        t.track.length === 4 &&
        t.track.every((n) => typeof n === "number" && Number.isFinite(n))
      )
        track = t.track.join(",");
      else track = str(t.track, `${at}.track`);
      if (t.still !== undefined || t.exit !== undefined)
        fail(at, "still and exit name an element: give this target a selector, or drop them");
    }
    return { t, at, selector: t.selector === undefined ? undefined : str(t.selector, `${at}.selector`), track };
  });
  // The command line measures every --selector before every --track: per-target values follow that.
  const ordered = [...parsed.filter((p) => p.selector !== undefined), ...parsed.filter((p) => p.track !== undefined)];

  const out: string[] = ["inspect", "motion"];
  const flag = (name: string, value?: string) => out.push(name, ...(value === undefined ? [] : [quoteArg(value)]));

  if (raw.actions !== undefined && !Array.isArray(raw.actions)) fail(`${path}.actions`, "must be an array");
  for (const [k, a] of ((raw.actions as unknown[] | undefined) ?? []).entries()) {
    const at = `${path}.actions[${k}]`;
    if (!isObject(a) || Object.keys(a).length !== 1)
      fail(
        at,
        'must be one of { "click": css }, { "hover": css }, { "leave": true }, { "scroll": css | px }, { "wait": ms }',
      );
    const [kind, v] = Object.entries(a)[0]!;
    if (kind === "click" || kind === "hover") flag(`--${kind}`, str(v, `${at}.${kind}`));
    else if (kind === "leave") {
      if (v !== true) fail(`${at}.leave`, "must be true");
      flag("--leave");
    } else if (kind === "scroll") flag("--scroll", typeof v === "number" ? String(v) : str(v, `${at}.scroll`));
    else if (kind === "wait") flag("--wait", time(v, `${at}.wait`));
    else fail(`${at}.${kind}`, "is not an action (click, hover, leave, scroll, wait)");
  }

  for (const p of ordered) {
    if (p.selector !== undefined) flag("--selector", p.selector);
    else flag("--track", p.track);
  }
  if (ordered.some((p) => p.t.name !== undefined))
    for (const p of ordered)
      flag(
        "--target",
        p.t.name !== undefined ? str(p.t.name, `${p.at}.name`) : (p.selector ?? defaultTrackName(p.track!)),
      );

  const any = (key: keyof MotionSpecTarget) => ordered.some((p) => p.t[key] !== undefined);
  // Repeated per target, "any" where a target has none.
  if (any("easing"))
    for (const p of ordered) {
      const v = p.t.easing;
      if (v === undefined) flag("--expect-easing", "any");
      else if (Array.isArray(v)) flag("--expect-easing", v.map((e, j) => str(e, `${p.at}.easing[${j}]`)).join(","));
      else flag("--expect-easing", str(v, `${p.at}.easing`));
    }
  if (any("origin"))
    for (const p of ordered) {
      const v = p.t.origin;
      if (v === undefined) flag("--expect-origin", "any");
      else if (Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === "number" && Number.isFinite(n)))
        flag("--expect-origin", v.join(","));
      else flag("--expect-origin", str(v, `${p.at}.origin`));
    }
  if (any("spanOf"))
    for (const p of ordered)
      flag("--expect-span-of", p.t.spanOf === undefined ? "any" : str(p.t.spanOf, `${p.at}.spanOf`));
  // One comma-separated list, "any" where a target has none.
  const list = (key: keyof MotionSpecTarget, name: string, read: (v: unknown, at: string) => string) => {
    if (any(key))
      flag(name, ordered.map((p) => (p.t[key] === undefined ? "any" : read(p.t[key], `${p.at}.${key}`))).join(","));
  };
  list("start", "--expect-start", time);
  list("duration", "--expect-duration", time);
  list("iterations", "--expect-iterations", (v, at) =>
    v === "infinite"
      ? "infinite"
      : typeof v === "number" && Number.isInteger(v) && v > 0
        ? String(v)
        : fail(at, 'must be a whole number of runs, or "infinite"'),
  );
  list("direction", "--expect-direction", str);
  list("lines", "--expect-lines", (v, at) =>
    typeof v === "number" && Number.isInteger(v) && v > 0 ? String(v) : fail(at, "must be a whole number of lines"),
  );
  for (const p of ordered) {
    if (p.t.still !== undefined && bool(p.t.still, `${p.at}.still`)) flag("--still", p.selector);
    if (p.t.exit !== undefined && bool(p.t.exit, `${p.at}.exit`)) flag("--exit", p.selector);
  }

  if (raw.stagger !== undefined) flag("--expect-stagger", time(raw.stagger, `${path}.stagger`));
  if (raw.exits !== undefined && bool(raw.exits, `${path}.exits`)) flag("--exits");
  if (raw.reducedMotion !== undefined && bool(raw.reducedMotion, `${path}.reducedMotion`)) flag("--reduced-motion");
  if (raw.upright !== undefined && bool(raw.upright, `${path}.upright`)) flag("--expect-upright");
  if (raw.everyAction !== undefined && bool(raw.everyAction, `${path}.everyAction`)) flag("--every-action");
  if (raw.start !== undefined) flag("--start", time(raw.start, `${path}.start`));
  if (raw.end !== undefined) flag("--end", time(raw.end, `${path}.end`));
  if (raw.at !== undefined) flag("--at", str(raw.at, `${path}.at`));
  if (raw.viewport !== undefined) flag("--viewport", str(raw.viewport, `${path}.viewport`));
  if (raw.deviceScale !== undefined) {
    if (typeof raw.deviceScale !== "number" || !(raw.deviceScale > 0))
      fail(`${path}.deviceScale`, "must be a positive number");
    flag("--device-scale", String(raw.deviceScale));
  }
  if (raw.baseline !== undefined) flag("--baseline", str(raw.baseline, `${path}.baseline`));
  if (raw.frames !== undefined) flag("--frames", str(raw.frames, `${path}.frames`));
  return out.join(" ");
}
