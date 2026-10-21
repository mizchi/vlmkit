/**
 * `vlmkit inspect motion <page|url|frames.json> --target "<what moves>" --forbid "<statement>"`:
 * is a CSS animation visually broken? The page is loaded with its clock and animations held,
 * shot at instants across its motion and once at rest, and each frame is asked of Jev (TypeSafe;
 * TYPESAFEAI_API_KEY): where the target is, whether it is shown, whether a forbidden statement
 * is. The motion itself — jumps, a snap-back, a target lost mid-way, the easing — is judged here
 * from those answers (`judgeMotionPath`), never asked: named outright, Jev was at chance.
 *
 * Exit 0 nothing fails, 1 a fail, 2 usage. Advisory: a model's reading of the pixels; the
 * deterministic motion checks (`check animation`, `check integrity --timeline`) are what to gate on.
 */
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { isCliEntry } from "@mizchi/vlmkit-core/plugin/cli-entry.ts";
import { handleCliError } from "@mizchi/vlmkit-core/cli-error.ts";
import {
  EASING_NAMES,
  ORIGIN_NAMES,
  MOTION_DIRECTIONS,
  describeOrigin,
  type MotionDirection,
  type EasingName,
  type OriginName,
} from "@mizchi/vlmkit-judge/motion-path.ts";
import { frameTimeMs, parseFramesManifest, parseInstants } from "@mizchi/vlmkit-judge/frames.ts";
import type { MotionCheckReport, MotionDom, MotionFrame } from "@mizchi/vlmkit-ai/motion-check.ts";

/** Each selector's element as rendered: border box, opacity through its ancestors, transform scale. */
export async function measureTargets(
  page: import("playwright").Page,
  selectors: readonly string[],
): Promise<(MotionDom | null)[]> {
  return page.evaluate((sels) => {
    // Hit-testing skips pointer-events: none (a toast often is), so the probed element takes
    // pointer events for the measurement only.
    const probe = document.createElement("style");
    probe.textContent = "[data-vlmkit-probe],[data-vlmkit-probe] *{pointer-events:auto!important}";
    (document.head ?? document.documentElement).append(probe);
    try {
      return sels.map((sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        let opacity = getComputedStyle(el).visibility === "hidden" ? 0 : 1;
        // Which ancestor's opacity is lowest: a drawer "followed ease-out in its opacity" for its
        // parent's fade (round 4), so the fit names whose fade it is.
        let fadeBy: Element | null = null;
        let fadeLow = 0.999;
        for (let n: Element | null = el; n; n = n.parentElement) {
          const o = Number(getComputedStyle(n).opacity);
          opacity *= o;
          if (n !== el && o < fadeLow) {
            fadeLow = o;
            fadeBy = n;
          }
        }
        const ownOpacity = Number(getComputedStyle(el).opacity);
        const transform = getComputedStyle(el).transform;
        let scale = 1;
        let scaleX = 1;
        let scaleY = 1;
        if (transform && transform !== "none") {
          const m = new DOMMatrixReadOnly(transform);
          scaleX = Math.hypot(m.a, m.b);
          scaleY = Math.hypot(m.c, m.d);
          // The scale fitted is the axis that changes more: a scaleY drop-down read 1 (round 5).
          scale = Math.abs(scaleY - 1) > Math.abs(scaleX - 1) ? scaleY : scaleX;
        }
        // The element's own animation time (its delay and duration, not the page's): the longest
        // one running on it, as a 0-1 fraction of one iteration. Null when nothing animates it.
        let t: number | null = null;
        let elapsedMs: number | null = null;
        let durationMs: number | null = null;
        let iterations: number | null | undefined;
        let longest = 0;
        for (const a of el.getAnimations()) {
          const c = a.effect?.getComputedTiming();
          const d = Number(c?.duration);
          if (!c || !Number.isFinite(d) || d <= longest || c.localTime === null) continue;
          longest = d;
          const local = Number(c.localTime) - Number(c.delay ?? 0);
          t = Math.min(1, Math.max(0, local / d));
          elapsedMs = local;
          // How long one run takes and how many there are: a sheet that "crawls up" at 1400ms and a
          // badge that never stops throbbing passed every rule (motion-repair round 6).
          durationMs = d;
          iterations = Number.isFinite(Number(c.iterations)) ? Number(c.iterations) : null;
        }
        // What of it is the topmost thing painted, over a 5x5 grid of its box inside the viewport:
        // a clip (overflow: hidden), a cover (z-index) and leaving the screen all take it away.
        el.setAttribute("data-vlmkit-probe", "");
        let inView = 0;
        let hits = 0;
        let missed: { x: number; y: number; top: Element | null } | null = null;
        for (let gy = 0; gy < 5; gy++) {
          for (let gx = 0; gx < 5; gx++) {
            const x = r.x + ((gx + 0.5) / 5) * r.width;
            const y = r.y + ((gy + 0.5) / 5) * r.height;
            if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) continue;
            inView++;
            const top = document.elementFromPoint(x, y);
            if (top && el.contains(top)) hits++;
            else missed ??= { x, y, top };
          }
        }
        el.removeAttribute("data-vlmkit-probe");
        const visible = opacity < 0.05 || inView === 0 ? 0 : hits / inView;
        // Why it is not seen, named for the repair: round 1 of motion-repair found the cause by
        // reading the CSS (an ancestor's overflow, a transform's stacking context) every time.
        const name = (e: Element) =>
          e.tagName.toLowerCase() +
          (e.id
            ? `#${e.id}`
            : typeof e.className === "string" && e.className.trim()
              ? `.${e.className.trim().split(/\s+/)[0]}`
              : "");
        const stacking = (e: Element): string | null => {
          const s = getComputedStyle(e);
          if (s.position !== "static" && s.zIndex !== "auto") return `z-index: ${s.zIndex}`;
          if (s.position === "fixed" || s.position === "sticky") return `position: ${s.position}`;
          if (Number(s.opacity) < 1) return `opacity: ${s.opacity}`;
          if (s.transform !== "none") return "a transform";
          if (s.filter !== "none") return "a filter";
          if (s.isolation === "isolate") return "isolation: isolate";
          if (/transform|opacity|filter/.test(s.willChange)) return `will-change: ${s.willChange}`;
          if (/paint|strict|content/.test(s.contain)) return `contain: ${s.contain}`;
          if (s.mixBlendMode !== "normal") return `mix-blend-mode: ${s.mixBlendMode}`;
          return null;
        };
        let hiddenBy: string | undefined;
        if (opacity < 0.05) {
          // Transparent: name what makes it so. Round 3's whole page sat at an ancestor's
          // opacity 0, whose animation-name matched no @keyframes, and the line said "clipped,
          // covered, or off-screen".
          for (let a: Element | null = el; a && !hiddenBy; a = a.parentElement) {
            const s = getComputedStyle(a);
            const own = a === el ? "it" : name(a);
            if (s.visibility === "hidden" && a === el) hiddenBy = "transparent: it is visibility: hidden";
            else if (Number(s.opacity) < 0.05) {
              const running = a.getAnimations().filter((x) => x.effect?.getComputedTiming().progress !== null);
              hiddenBy = `transparent: ${own} renders at opacity ${Number(s.opacity).toFixed(2)}${
                a === el
                  ? ""
                  : running.length === 0
                    ? `, and nothing animates it (if it is meant to fade in, its animation is not running: check animation names an animation-name with no @keyframes)`
                    : ""
              }`;
            }
          }
        } else if (visible < 0.5) {
          if (inView === 0) hiddenBy = "its box is outside the viewport";
          else if (missed) {
            for (let a = el.parentElement; a && !hiddenBy; a = a.parentElement) {
              const s = getComputedStyle(a);
              if (s.overflowX === "visible" && s.overflowY === "visible") continue;
              const b = a.getBoundingClientRect();
              if (missed.x < b.left || missed.x >= b.right || missed.y < b.top || missed.y >= b.bottom) {
                hiddenBy = `clipped by ${name(a)} (overflow: ${s.overflowX === s.overflowY ? s.overflowX : `${s.overflowX} ${s.overflowY}`}), which it lies outside of`;
              }
            }
            if (!hiddenBy && missed.top) {
              const cover = missed.top;
              hiddenBy = `covered by ${name(cover)}`;
              // The trap: the outermost stacking context around the target that does not also
              // hold the cover. A z-index inside it cannot lift the target above the cover.
              let trap: Element | null = null;
              let reason: string | null = null;
              for (let a = el.parentElement; a && !a.contains(cover); a = a.parentElement) {
                const why = stacking(a);
                if (why) {
                  trap = a;
                  reason = why;
                }
              }
              if (trap) {
                hiddenBy += `: ${name(trap)} makes a stacking context (${reason}), so the target's own z-index only counts inside it and ${name(trap)} as a whole paints below ${name(cover)}`;
              }
            }
          }
        }
        return {
          box: { x: r.x, y: r.y, width: r.width, height: r.height },
          opacity,
          scale,
          ...(Math.abs(scaleX - scaleY) > 1e-6 ? { scaleX, scaleY } : {}),
          t,
          visible,
          // How much of its box is inside the viewport: a panel entering from beyond the edge read
          // "share seen 1.00" with 16% of it on screen (round 7).
          onScreen: inView / 25,
          elapsedMs,
          ...(durationMs !== null ? { durationMs, iterations: iterations ?? null } : {}),
          ownOpacity,
          ...(fadeBy ? { fadeBy: name(fadeBy) } : {}),
          ...(hiddenBy ? { hiddenBy } : {}),
        };
      });
    } finally {
      probe.remove();
    }
  }, selectors);
}

/**
 * Asked when no `--forbid` is given. Narrower than the claims round's "text overlapping other
 * text so that it is hard to read", which fired on an open dropdown over a page and on plants
 * covering text (10 of 36); this one caught every planted overlap (9/9) with none of those
 * (0/36), measured on screenshots it was not chosen on (`docs/reports/2026-10-18-jev-motion.md`).
 */
export const DEFAULT_MOTION_FORBID = "two lines of text printed on top of each other, their letters crossing";

export const MOTION_USAGE = `Usage: vlmkit inspect motion <page.html|url> --selector <css>... [--target "<name>"]... [options]
       vlmkit inspect motion <page.html|url|frames.json> --jev --target "<what moves>"... [--selector <css>]... [--forbid "<statement>"]...

Is an animation visually broken? The page's clock is held and the motion shot at
instants and once at rest. Without --jev, no key: each --selector is measured
from the page at every frame — where it is, its opacity and scale, and how much
of it is the topmost thing painted (a clip or a cover takes that away). With
--jev, each frame is also asked of TypeSafe Jev (TYPESAFEAI_API_KEY) in one
request: where a --target described in words is, whether it is shown, whether
each forbidden statement is. vlmkit judges the motion from that:

  target-lost      not shown between frames that show it (clipped, covered, snapped off-screen)
  target-hidden    shown in no frame at all, rest included (clipped or covered from the start)
  absent-at-rest   shown in motion, gone once it stops (unless --exits says it leaves)
  snap-back        back where it started once it stops (fill-mode missing)
  jump             one step far faster than its neighbours (keyframe gap)
  easing-mismatch  the path follows another easing than --expect-easing
  target-static    shown and still from the first frame (warn: not animating?)
  origin-mismatch  a scale grows from another point than --expect-origin (transform-origin)
  start-mismatch   its animation begins at another time than --expect-start / --expect-stagger
  duration-mismatch one run takes another time than --expect-duration
  iterations-mismatch it runs another number of times than --expect-iterations
  direction-mismatch it moves another way than --expect-direction
  snapped          after --click a --selector target changed with no animation at all
  forbid           a statement seen at rest fails; only mid-motion, warns (--jev)

Frames: each span some finite animation runs in is a segment (an entrance, and
after a hold an exit, are two), shot 11 times from its start to just inside its
end (fewer each past 5 segments, 60 at most), three frames in each hold between
segments (where it must stay put), plus one frame at rest 300ms after the last.
Without --jev, a target that is not seen says why: the ancestor that clips it,
or what covers it and the stacking context that traps it. Easings are fitted, and jumps looked for, inside one segment. Positions
come from frames that surely show the target (presence 0.8+); a box cut by the
viewport's edge is put back from the target's own size. So "travels" is the
measured part of the path and can be shorter than the CSS distance; under 60px
an easing is not fitted, and an --expect-easing there is a warn, not a pass.
With --selector every frame is measured from the page, the floor is 6px, and
opacity (a change of 0.2+) and scale (0.02+) are fitted as well as position:
an easing is checked on each channel that changes.

  --selector <css>        The element that moves (repeat for each): its position, opacity, scale,
                          visible share and own animation time are measured from the page. Without
                          --jev, every target is one. With --jev, it pairs with the --target in the
                          same position and Jev only says whether it can be seen — a "seen" whose
                          box misses the element is set aside. Use it whenever the page is yours
  --target <words>        A name for the --selector in the same position (default: the selector).
                          With --jev, what moves by what only it shows: "the card labelled Users
                          showing 1,284", not "the Users card" (look-alike cards get swapped)
  --jev                   Also ask TypeSafe Jev of every frame (TYPESAFEAI_API_KEY): targets found
                          by their words, and the --forbid statements
  --forbid <statement>    No frame may show it (--jev). Default with --jev, when none is given:
                          "${DEFAULT_MOTION_FORBID}"
  --no-forbid             Ask no statement (only the targets' motion)
  --expect-easing <name>  ${EASING_NAMES.join(" | ")}. Given once, for every target; repeated,
                          paired with the --target in the same position (cards ease-out, a bar
                          ease-in-out). Comma-separated, one per segment: "ease-out,ease-in" for
                          an entrance and an exit; \`any\` leaves a segment unchecked ("ease-out,any")
  --expect-origin <name>  ${ORIGIN_NAMES.join(" | ")}: the point a scale grows
                          from (the point of its box that stays put). Once for every target, or
                          repeated per target in order. A scale along one axis (scaleY, a
                          drop-down) keeps an edge: top | bottom (left | right for scaleX).
                          Measured with --selector; every scale's point or edge is printed
                          with or without it
  --expect-start <ms>     When its own animation begins (page time). Comma-separated, one per
                          target in order: "200,280,360,440". Measured with --selector
  --expect-stagger <ms>   Each target begins this long after the one before it, in the order
                          given (from the first target's --expect-start, or its measured start)
  --expect-duration <ms>  How long one run of its own animation takes ("280ms", "1.2s").
                          Once for every target, or comma-separated per target. --selector
  --expect-direction <d>  Which way its (first) motion goes: left | right | up | down — "slides in
                          from the right edge" moves left. Once for every target, or per target
  --expect-iterations <n> How many times it runs: 3, or infinite. Once for every target, or
                          comma-separated per target. --selector
  --click <css>           Click this first, on the held page (repeat for several, in order): the
                          motion a click starts is sampled from it. Nothing animating while a
                          --selector target changes is \`snapped\` (fail)
  --exits                 The targets are meant to leave (gone at rest is their end)
  --at <instants>         Frames to shoot (default: 11 per segment + rest); the segments stay
                          the page's own spans of motion
  --start <ms> --end <ms> The motion's span (needed for frames.json): one segment
  --viewport <WxH>        Default 1280x800
  --frames <dir>          Where the frames go (default test-results/inspect-motion/<page name>, so
                          two pages, or check animation's frames, do not overwrite each other)
  --threshold <0-1>       A statement is true at or above this (default 0.5)
  --json                  Print the report as JSON

Exit: 0 nothing fails, 1 a fail, 2 usage error. With --jev, ~$0.00013 and ~0.2s per frame.
Advisory: gate on check animation / check integrity --timeline.
Measured: https://github.com/mizchi/vlmkit/blob/main/docs/reports/2026-10-18-jev-motion.md`;

export class MotionUsageError extends Error {}

/** After --click nothing animated: the targets that changed did so in one frame. */
export class SnappedError extends Error {
  constructor(readonly changed: string[]) {
    super("no animation or transition started after --click");
  }
}

export interface MotionCliOptions {
  source: string;
  targets: string[];
  selectors: string[];
  forbid: string[];
  /** Each --expect-easing given, in order: one for every target, or one per target. */
  expectEasing?: EasingName[][];
  /** Each --expect-origin given: one for every target, or one per target. */
  expectOrigin?: OriginName[];
  expectStartMs?: number[];
  expectStaggerMs?: number;
  /** How long one run of each target's own animation takes (ms), per target in order. */
  expectDurationMs?: number[];
  /** How many times it runs (null: infinite), per target in order. */
  expectIterations?: (number | null)[];
  expectDirection?: MotionDirection[];
  exits: boolean;
  at?: number[];
  startMs?: number;
  endMs?: number;
  viewport: { width: number; height: number };
  frames: string;
  threshold: number;
  json: boolean;
  /** Ask TypeSafe Jev. Without it every target is a --selector, measured from the page alone. */
  jev: boolean;
  /** Elements clicked, in order, on the held page before any frame is shot. */
  clicks: string[];
}

export function parseMotionArgs(argv: string[]): MotionCliOptions {
  const positional: string[] = [];
  const targets: string[] = [];
  const selectors: string[] = [];
  const forbid: string[] = [];
  let expectEasing: EasingName[][] | undefined;
  let expectOrigin: OriginName[] | undefined;
  let expectStartMs: number[] | undefined;
  let expectStaggerMs: number | undefined;
  let expectDurationMs: number[] | undefined;
  let expectIterations: (number | null)[] | undefined;
  let expectDirection: MotionDirection[] | undefined;
  let at: number[] | undefined;
  let startMs: number | undefined;
  let endMs: number | undefined;
  let viewport = { width: 1280, height: 800 };
  let frames: string | undefined;
  let threshold = 0.5;
  let json = false;
  let exits = false;
  let noForbid = false;
  let jev = false;
  const clicks: string[] = [];
  const value = (flag: string, v: string | undefined) => {
    if (v === undefined || v.startsWith("--")) throw new MotionUsageError(`${flag} needs a value`);
    return v;
  };
  const one = (flag: string, v: string) => {
    const xs = parseInstants(v, flag);
    if (xs.length !== 1) throw new MotionUsageError(`${flag} takes one time, got ${v}`);
    return xs[0]!;
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    switch (a) {
      case "--target":
      case "--forbid": {
        const s = value(a, argv[++i]).trim();
        if (!s) throw new MotionUsageError(`${a} needs words`);
        (a === "--target" ? targets : forbid).push(s);
        break;
      }
      case "--expect-easing": {
        const names = value(a, argv[++i])
          .split(",")
          .map((x) => x.trim());
        // `any` leaves that segment unchecked: a brief that names the entrance's easing and not
        // the fade's had an agent guess `linear` and fail a correct page (round 2).
        const bad = names.filter((e) => e !== "any" && !(EASING_NAMES as string[]).includes(e));
        if (bad.length > 0 || names.length === 0 || names.every((e) => e === "any")) {
          throw new MotionUsageError(
            `--expect-easing takes ${EASING_NAMES.join(", ")} (comma-separated per segment); got ${bad.join(", ")}`,
          );
        }
        (expectEasing ??= []).push(names.map((e) => (e === "any" ? undefined : e)) as EasingName[]);
        break;
      }
      case "--expect-origin": {
        const v = value(a, argv[++i])
          .trim()
          .replace(/\s+/g, "-")
          .replace(/^centre$/, "center");
        // transform-origin's own word order ("left top") reads the same.
        const flip = v.split("-").reverse().join("-");
        const n = (ORIGIN_NAMES as readonly string[]).includes(v) ? v : flip;
        if (!(ORIGIN_NAMES as readonly string[]).includes(n)) {
          throw new MotionUsageError(`--expect-origin takes ${ORIGIN_NAMES.join(", ")}; got ${argv[i]}`);
        }
        (expectOrigin ??= []).push(n as OriginName);
        break;
      }
      case "--expect-start":
        // One time per target, in the order given: parseInstants sorts and dedupes, which paired
        // "400,0" with the targets as "0,400" (round 4).
        (expectStartMs ??= []).push(
          ...value(a, argv[++i])
            .split(",")
            .map((x) => one(a, x.trim())),
        );
        break;
      case "--expect-duration":
        (expectDurationMs ??= []).push(
          ...value(a, argv[++i])
            .split(",")
            .map((x) => one(a, x.trim())),
        );
        break;
      case "--expect-direction":
        (expectDirection ??= []).push(
          ...value(a, argv[++i])
            .split(",")
            .map((x) => {
              const v = x.trim().replace(/wards?$/, "");
              if (!(MOTION_DIRECTIONS as readonly string[]).includes(v))
                throw new MotionUsageError(`--expect-direction takes ${MOTION_DIRECTIONS.join(", ")}, got ${x}`);
              return v as MotionDirection;
            }),
        );
        break;
      case "--expect-iterations":
        (expectIterations ??= []).push(
          ...value(a, argv[++i])
            .split(",")
            .map((x) => {
              const v = x.trim();
              if (v === "infinite") return null;
              const n = Number(v);
              if (!Number.isInteger(n) || n < 1)
                throw new MotionUsageError(`--expect-iterations takes whole numbers or infinite, got ${v}`);
              return n;
            }),
        );
        break;
      case "--expect-stagger":
        expectStaggerMs = one(a, value(a, argv[++i]));
        break;
      case "--selector":
        selectors.push(value(a, argv[++i]).trim());
        break;
      case "--click":
        clicks.push(value(a, argv[++i]).trim());
        break;
      case "--at":
        at = parseInstants(value(a, argv[++i]), a);
        break;
      case "--start":
        startMs = one(a, value(a, argv[++i]));
        break;
      case "--end":
        endMs = one(a, value(a, argv[++i]));
        break;
      case "--viewport": {
        const m = /^(\d+)x(\d+)$/.exec(value(a, argv[++i]));
        if (!m) throw new MotionUsageError(`--viewport takes WxH, got ${argv[i]}`);
        viewport = { width: Number(m[1]), height: Number(m[2]) };
        break;
      }
      case "--frames":
        frames = value(a, argv[++i]);
        break;
      case "--threshold": {
        const n = Number(value(a, argv[++i]));
        if (!Number.isFinite(n) || n <= 0 || n >= 1)
          throw new MotionUsageError(`--threshold takes 0-1, got ${argv[i]}`);
        threshold = n;
        break;
      }
      case "--json":
        json = true;
        break;
      case "--exits":
        exits = true;
        break;
      case "--jev":
        jev = true;
        break;
      case "--no-forbid":
        noForbid = true;
        break;
      default:
        if (a.startsWith("--")) {
          // Two of three round-1 agents reached for --out: say where the output goes.
          const near: Record<string, string> = {
            "--out": "--frames <dir>",
            "--output": "--frames <dir>",
            "--key": "--jev",
          };
          throw new MotionUsageError(`unknown option ${a}${near[a] ? ` (did you mean ${near[a]}?)` : ""}`);
        }
        positional.push(a);
    }
  }
  if (positional.length !== 1) {
    throw new MotionUsageError(
      `expected one page, URL or frames.json, got ${positional.length}${positional.length > 1 ? ' (quote each description: --target "the blue square")' : ""}`,
    );
  }
  if (noForbid && forbid.length > 0) throw new MotionUsageError("--no-forbid with --forbid: pick one");
  if (/(^|\/)frames\.json$/.test(positional[0]!) && !jev) {
    throw new MotionUsageError("saved frames have no page to measure: add --jev to ask Jev of them");
  }
  if (!jev) {
    // Without Jev nothing can read a statement or find a target by its words: the page measures
    // each --selector, and those name the targets when no --target does.
    if (forbid.length > 0) throw new MotionUsageError("--forbid is a statement Jev reads from the frames: add --jev");
    if (selectors.length === 0) {
      throw new MotionUsageError(
        "give each target a --selector (measured from the page, no key), or add --jev to find --target by its words",
      );
    }
    if (targets.length === 0) targets.push(...selectors);
    if (targets.length !== selectors.length) {
      throw new MotionUsageError(
        `${selectors.length} --selector for ${targets.length} --target: without --jev every target is measured, so each needs one`,
      );
    }
  } else if (!noForbid && forbid.length === 0) forbid.push(DEFAULT_MOTION_FORBID);
  if (targets.length === 0 && noForbid)
    throw new MotionUsageError("nothing to check: give --target, or drop --no-forbid");
  if (expectEasing && targets.length === 0) throw new MotionUsageError("--expect-easing needs a --target to follow");
  if (expectEasing && expectEasing.length > 1 && expectEasing.length > targets.length) {
    throw new MotionUsageError(
      `${expectEasing.length} --expect-easing for ${targets.length} --target: give one for every target, or one per target in order`,
    );
  }
  if (expectOrigin && expectOrigin.length > 1 && expectOrigin.length !== targets.length) {
    throw new MotionUsageError(
      `${expectOrigin.length} --expect-origin for ${targets.length} --target: give one for every target, or one per target in order`,
    );
  }
  if (expectStartMs && expectStartMs.length > targets.length) {
    throw new MotionUsageError(
      `${expectStartMs.length} --expect-start times for ${targets.length} targets: one per target, in order`,
    );
  }
  for (const [flag, xs] of [
    ["--expect-duration", expectDurationMs],
    ["--expect-iterations", expectIterations],
    ["--expect-direction", expectDirection],
  ] as const) {
    if (xs && xs.length > 1 && xs.length !== targets.length)
      throw new MotionUsageError(
        `${xs.length} ${flag} values for ${targets.length} targets: one for all, or one per target`,
      );
  }
  if (expectStaggerMs !== undefined && targets.length < 2)
    throw new MotionUsageError("--expect-stagger compares targets: give two or more, in the order they begin");
  const fromFrames = /(^|\/)frames\.json$/.test(positional[0]!);
  if (selectors.length > targets.length) {
    throw new MotionUsageError(
      `${selectors.length} --selector for ${targets.length} --target: each selector names the target given in the same position`,
    );
  }
  if (selectors.length > 0 && fromFrames)
    throw new MotionUsageError("--selector measures a live page: give the page, not frames.json");
  // On a page the span comes from its animations, --at or not; saved frames carry none.
  if (fromFrames && endMs === undefined) {
    throw new MotionUsageError(
      "frames.json needs --end <ms>: where the motion stops, so the frames after it are its rest",
    );
  }
  return {
    source: positional[0]!,
    targets,
    selectors,
    forbid,
    ...(expectEasing ? { expectEasing } : {}),
    ...(expectOrigin ? { expectOrigin } : {}),
    ...(expectStartMs ? { expectStartMs } : {}),
    ...(expectStaggerMs !== undefined ? { expectStaggerMs } : {}),
    ...(expectDurationMs ? { expectDurationMs } : {}),
    ...(expectIterations ? { expectIterations } : {}),
    ...(expectDirection ? { expectDirection } : {}),
    exits,
    ...(at ? { at } : {}),
    ...(startMs !== undefined ? { startMs } : {}),
    ...(endMs !== undefined ? { endMs } : {}),
    viewport,
    // Named by the page: a second page, or a frames.json read back, kept its own frames apart.
    frames:
      frames ??
      join(
        "test-results/inspect-motion",
        (positional[0]!.split(/[?#]/)[0]!.replace(/\/+$/, "").split("/").pop() || "page").replace(/\.[^.]*$/, "") ||
          "page",
      ),
    threshold,
    json,
    jev,
    clicks,
  };
}

/** `n` instants from `startMs` to just inside `endMs` (an instant at the end is already past it), then rest. */
export function motionInstants(startMs: number, endMs: number, n = 11): { motion: number[]; rest: number } {
  const span = endMs - startMs;
  const motion = Array.from({ length: n }, (_, i) =>
    i === n - 1 ? endMs - 1 : startMs + Math.round((span * i) / (n - 1)),
  );
  return { motion: [...new Set(motion)].filter((t) => t >= startMs), rest: endMs + 300 };
}

/** Frames this many at most, across every segment. */
export const MOTION_MAX_FRAMES = 60;

/**
 * The spans the page's finite animations run in, overlapping ones merged (an entrance, then after
 * a hold an exit, are two), and instants across each: 11 per segment, fewer when there are many
 * (at least 5), so a 600ms entrance beside a 2s hold is not sampled by 2 of 11 frames.
 */
/**
 * A finite animation's span, with the parts its keyframes hold still cut out: one 3300ms toast
 * animation that enters (0-15%), holds (15-90%) and exits (90-100%) is two spans of motion, so
 * its 495ms entrance is not sampled by 2 of 11 frames.
 */
export interface PlannedAnimation {
  startMs: number;
  durationMs: number;
  iterations: number | null;
  /** Offsets (0-1 of one iteration) between which consecutive keyframes are equal. */
  holds?: readonly [number, number][];
}

/** The spans of one iteration that move: [0,1] less the holds. */
function movingSpans(holds: readonly [number, number][] = []): [number, number][] {
  const out: [number, number][] = [];
  let from = 0;
  for (const [a, b] of [...holds].sort((x, y) => x[0] - y[0])) {
    if (a > from + 1e-6) out.push([from, a]);
    from = Math.max(from, b);
  }
  if (from < 1 - 1e-6) out.push([from, 1]);
  return out;
}

export function motionPlan(animations: readonly PlannedAnimation[]) {
  const spans = animations
    .filter((a) => a.iterations !== null && a.durationMs > 0)
    .flatMap((a) => {
      const iterations = a.iterations ?? 1;
      // Holds are cut out of single-run animations; a repeating one keeps its whole span.
      const parts: [number, number][] = iterations === 1 ? movingSpans(a.holds) : [[0, iterations]];
      return parts.map(([f, t]) => ({ startMs: a.startMs + f * a.durationMs, endMs: a.startMs + t * a.durationMs }));
    })
    .sort((a, b) => a.startMs - b.startMs);
  const segments: { startMs: number; endMs: number }[] = [];
  for (const s of spans) {
    const last = segments[segments.length - 1];
    if (last && s.startMs <= last.endMs) last.endMs = Math.max(last.endMs, s.endMs);
    else segments.push({ ...s });
  }
  const per = Math.max(5, Math.min(11, Math.floor(MOTION_MAX_FRAMES / Math.max(1, segments.length))));
  // And three frames inside every hold between segments: a toast whose entrance has no fill-mode
  // is gone for the whole hold, and frames only inside the animations never saw it (round 1).
  const holds = segments.slice(1).flatMap((g, i) => {
    const from = segments[i]!.endMs;
    const gap = g.startMs - from;
    return gap >= 100 ? [0.25, 0.5, 0.75].map((f) => Math.round(from + gap * f)) : [];
  });
  // And three before the first, when it waits 300ms or more: chips held unseen for 1200ms were
  // only ever shot from 1200ms on, so no frame of the tool's own showed the wait (round 5).
  const first = segments[0]?.startMs ?? 0;
  const lead = first >= 300 ? [0, 1 / 3, 2 / 3].map((f) => Math.round(first * f)) : [];
  const motion = [
    ...new Set([...lead, ...segments.flatMap((g) => motionInstants(g.startMs, g.endMs, per).motion), ...holds]),
  ].sort((a, b) => a - b);
  const endMs = Math.max(...segments.map((g) => g.endMs));
  return { segments, motion, rest: endMs + 300, startMs: segments[0]?.startMs ?? 0, endMs };
}

/**
 * Each held animation's keyframe holds, read from the page: offsets between consecutive keyframes
 * whose values are equal. Matched to the held timings by start and duration.
 */
async function keyframeHolds(page: import("playwright").Page) {
  return page.evaluate(() =>
    document.getAnimations().map((a) => {
      const effect = a.effect as KeyframeEffect | null;
      const timing = effect?.getComputedTiming();
      const frames = effect?.getKeyframes() ?? [];
      const value = (k: ComputedKeyframe) =>
        JSON.stringify(
          Object.entries(k)
            .filter(([key]) => !["offset", "computedOffset", "easing", "composite"].includes(key))
            .sort(),
        );
      const holds: [number, number][] = [];
      for (let i = 1; i < frames.length; i++) {
        const a0 = frames[i - 1]!;
        const a1 = frames[i]!;
        if (value(a0) === value(a1) && a1.computedOffset > a0.computedOffset)
          holds.push([a0.computedOffset, a1.computedOffset]);
      }
      return { delayMs: Number(timing?.delay ?? 0), durationMs: Number(timing?.duration ?? 0), holds };
    }),
  );
}

/**
 * The declaration that sets each target's animation-delay, as the cascade picked it: read
 * through the DevTools protocol (a linked sheet on a file: page is cross-origin to the CSSOM).
 * `li:nth-child(2) { animation-delay: 200ms }` overriding a stagger was found by reading the
 * CSS in round 4; a start-mismatch now quotes it.
 */
async function delaySources(page: import("playwright").Page, selectors: readonly string[]): Promise<(string | null)[]> {
  type Prop = { name: string; value: string; range?: unknown; important?: boolean; disabled?: boolean };
  type Match = { rule: { origin: string; selectorList: { text: string }; style: { cssProperties: Prop[] } } };
  let session: import("playwright").CDPSession;
  try {
    session = await page.context().newCDPSession(page);
  } catch {
    return selectors.map(() => null);
  }
  try {
    await session.send("DOM.enable");
    await session.send("CSS.enable");
    const { root } = (await session.send("DOM.getDocument", { depth: 0 })) as { root: { nodeId: number } };
    const out: (string | null)[] = [];
    for (const sel of selectors) {
      try {
        const { nodeId } = (await session.send("DOM.querySelector", { nodeId: root.nodeId, selector: sel })) as {
          nodeId: number;
        };
        if (!nodeId) {
          out.push(null);
          continue;
        }
        const m = (await session.send("CSS.getMatchedStylesForNode", { nodeId })) as {
          matchedCSSRules?: Match[];
          inlineStyle?: { cssProperties: Prop[] };
        };
        // Cascade order, lowest first: the last declaration wins, an !important one over any
        // that is not. Shorthands only carry a range, so `animation: … 200ms` counts too.
        let win: { important: boolean; text: string } | null = null;
        const consider = (p: Prop, where: string) => {
          if (p.range === undefined || p.disabled) return;
          if (p.name !== "animation-delay" && p.name !== "animation") return;
          const important = p.important === true;
          if (win && win.important && !important) return;
          win = { important, text: `${where} { ${p.name}: ${p.value.trim()} }` };
        };
        for (const r of m.matchedCSSRules ?? []) {
          if (r.rule.origin !== "regular") continue;
          for (const p of r.rule.style.cssProperties) consider(p, r.rule.selectorList.text);
        }
        for (const p of m.inlineStyle?.cssProperties ?? []) consider(p, "style attribute");
        out.push(win ? (win as { text: string }).text : null);
      } catch {
        out.push(null);
      }
    }
    return out;
  } finally {
    await session.detach().catch(() => {});
  }
}

interface Captured {
  frames: MotionFrame[];
  startMs: number;
  endMs: number;
  segments: { startMs: number; endMs: number }[];
  manifest: string;
  /** Each frame's file, by its instant. */
  files?: Map<number, string>;
  /** The frames' size in CSS px, when they were shot here. */
  viewport?: { width: number; height: number };
  /** Per --selector, the declaration its animation-delay comes from. */
  delays?: (string | null)[];
  /** Only infinite animations ran: the first runs were sampled and nothing rests. */
  forever?: boolean;
  /**
   * Each target's parent box at rest, when it is at most six times the target's area: what it
   * fills or sits in (a bar's track), which the crop keeps. A crop around the bar alone cut its
   * track off at 70%, the very thing to judge (round 7).
   */
  context?: { x: number; y: number; width: number; height: number }[];
  /** Every line of text on the page at rest, so a suggested crop does not cut one in half. */
  textLines?: { x: number; y: number; width: number; height: number }[];
}

async function captureMotion(o: MotionCliOptions): Promise<Captured> {
  const { withBrowser } = await import("@mizchi/vlmkit-core/browser-launch.ts");
  const { sourceToUrl } = await import("@mizchi/vlmkit-core/page-open.ts");
  const { openHeldTimeline, captureStable, frameWriter, frameSourceFacts } =
    await import("@mizchi/vlmkit-animation-eval/frames-capture.ts");
  const url = sourceToUrl(o.source);
  return withBrowser(async (browser) => {
    let page = await browser.newPage({ viewport: o.viewport, deviceScaleFactor: 1 });
    try {
      let timeline = await openHeldTimeline(page, url);
      let held = await timeline.animations();
      // Nothing animates at load, but timers are due: run the held clock to each one and look
      // again. A bar a script marks loaded at 100ms gets its transition then, and the page read
      // "no animation on the page" (round 7). Found, the page is opened afresh to shoot from 0.
      let ranTo: number | null = null;
      // The clock's time once the --click actions ran: nothing before it can be shot again.
      let clockNow = 0;
      if (o.clicks.length > 0) {
        const beforeClick = o.selectors.length > 0 ? await measureTargets(page, o.selectors) : [];
        const heldBefore = held.length;
        // Each --click on the held page, in order, then one frame so the styles they change are
        // computed and their transitions exist. A panel opened by a click was out of reach: only
        // frames.json from inspect interact with --jev could judge it (round 7).
        for (const sel of o.clicks) {
          try {
            await page.click(sel, { timeout: 5000 });
          } catch (e) {
            throw new MotionUsageError(`--click ${sel}: ${(e as Error).message.split("\n")[0]}`);
          }
        }
        clockNow = frameTimeMs(1);
        await timeline.at(clockNow);
        held = await timeline.animations();
        if (held.length === heldBefore && o.endMs === undefined) {
          // Nothing animates after the click: if a target changed, it changed in one frame.
          const afterClick = o.selectors.length > 0 ? await measureTargets(page, o.selectors) : [];
          const changed = o.selectors.flatMap((sel, i) => {
            const a = beforeClick[i];
            const b = afterClick[i];
            if (!a || !b) return [];
            const d = Math.max(
              Math.abs(a.box.x - b.box.x),
              Math.abs(a.box.y - b.box.y),
              Math.abs(a.box.width - b.box.width),
              Math.abs(a.box.height - b.box.height),
            );
            const op = Math.abs(a.opacity - b.opacity);
            return d >= 1 || op >= 0.05
              ? [
                  `${sel}: ${Math.round(a.box.width)}x${Math.round(a.box.height)} at (${Math.round(a.box.x)},${Math.round(a.box.y)}) → ${Math.round(b.box.width)}x${Math.round(b.box.height)} at (${Math.round(b.box.x)},${Math.round(b.box.y)})${op >= 0.05 ? `, opacity ${a.opacity.toFixed(2)} → ${b.opacity.toFixed(2)}` : ""}`,
                ]
              : [];
          });
          throw new SnappedError(changed);
        }
      } else if (held.length === 0 && o.endMs === undefined) {
        for (let guard = 0; guard < 20 && held.length === 0; guard++) {
          const due = await timeline.pending();
          if (due.timers === 0 || due.latestTimerMs === null || due.latestTimerMs > 10_000) break;
          // The first frame after it is due: a transition the timer starts begins when the page
          // next renders. Jumping 20ms past it began a 100ms timer's transition at 120ms, and
          // --expect-start 100 failed a correct page (round 7).
          const next = frameTimeMs(Math.floor((due.latestTimerMs * 60) / 1000 + 1e-6) + 1);
          await timeline.at(next);
          ranTo = Math.round(next);
          held = await timeline.animations();
        }
        if (held.length > 0) {
          await page.close();
          page = await browser.newPage({ viewport: o.viewport, deviceScaleFactor: 1 });
          timeline = await openHeldTimeline(page, url);
        }
      }
      const holds = await keyframeHolds(page).catch(() => []);
      const plan = motionPlan(
        held.map((a) => {
          const k = holds.find(
            (h) =>
              Math.abs(h.durationMs - a.durationMs) < 1 && Math.abs(h.delayMs - a.startMs) < 1 && h.holds.length > 0,
          );
          return k ? { ...a, holds: k.holds } : a;
        }),
      );
      // Only infinite animations: sample their first three runs (4s at most), with no rest frame,
      // since nothing rests. It refused before, and a badge that never stops throbbing is exactly
      // what an agent brings it (round 6).
      const infinite = held.filter((a) => a.iterations === null && a.durationMs > 0);
      let forever: { startMs: number; endMs: number } | null = null;
      if (o.endMs === undefined && plan.segments.length === 0) {
        if (infinite.length === 0) {
          throw new MotionUsageError(
            `no animation or transition on the page${ranTo !== null ? `, at load or after its timers ran (to ${ranTo}ms)` : " at load"}: nothing to sample. If one should run, it never starts — check animation lists what does; a misspelt transition-property or animation-name, a transition to height: auto (which needs interpolate-size: allow-keywords), or a class added in the same frame as the style it transitions from, are the usual causes. If a click starts it, give --click <css>. To shoot the page anyway, give --end <ms> (with --start, or --at for the instants)`,
          );
        }
        const s0 = Math.min(...infinite.map((a) => a.startMs));
        forever = { startMs: s0, endMs: s0 + Math.min(4000, 3 * Math.max(...infinite.map((a) => a.durationMs))) };
      }
      const given = o.endMs !== undefined;
      const endMs = o.endMs ?? forever?.endMs ?? plan.endMs;
      const startMs = o.startMs ?? (given ? 0 : (forever?.startMs ?? plan.startMs));
      // --at chooses the frames; the segments are still the page's own spans of motion.
      const segments = given || forever ? [{ startMs, endMs }] : plan.segments;
      const instants = (
        o.at
          ? [...new Set(o.at)].sort((a, b) => a - b)
          : given
            ? (() => {
                const m = motionInstants(startMs, endMs);
                return [...m.motion, m.rest];
              })()
            : forever
              ? motionInstants(startMs, endMs, 31).motion
              : [...plan.motion, plan.rest]
      ).filter((t) => t >= clockNow);
      const writer = await frameWriter(resolve(o.frames), {
        tool: "inspect motion",
        url,
        viewport: o.viewport,
        ...(await frameSourceFacts(page)),
        clock: "held",
      });
      const files = new Map<number, string>();
      const frames: Captured["frames"] = [];
      for (const atMs of instants) {
        await timeline.at(atMs);
        const { png, stable } = await captureStable(page);
        files.set(atMs, await writer.add(png, { atMs, stable, ...(atMs > endMs ? { label: "rest" } : {}) }));
        const frame: MotionFrame = { atMs, png: new Uint8Array(png) };
        if (o.selectors.length > 0) {
          const dom = await measureTargets(page, o.selectors);
          const missing = o.selectors.filter((_, i) => dom[i] === null);
          if (frames.length === 0 && missing.length > 0) {
            throw new MotionUsageError(`--selector matches nothing on the page: ${missing.join(", ")}`);
          }
          frame.dom = [...dom, ...o.targets.slice(o.selectors.length).map(() => null)];
        }
        frames.push(frame);
      }
      const written = await writer.finish();
      const delays = o.selectors.length > 0 ? await delaySources(page, o.selectors) : undefined;
      const context = await page
        .evaluate((sels) => {
          const out: { x: number; y: number; width: number; height: number }[] = [];
          for (const sel of sels) {
            const el = document.querySelector(sel);
            const parent = el?.parentElement;
            if (!el || !parent || parent === document.body) continue;
            const a = el.getBoundingClientRect();
            const b = parent.getBoundingClientRect();
            if (b.width * b.height > 0 && b.width * b.height <= 6 * Math.max(1, a.width * a.height))
              out.push({ x: b.x, y: b.y, width: b.width, height: b.height });
          }
          return out;
        }, o.selectors)
        .catch(() => []);
      // The page is at its rest instant now (the last one shot).
      const textLines = await page
        .evaluate(() => {
          const out: { x: number; y: number; width: number; height: number }[] = [];
          const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
          for (let n = walk.nextNode(); n && out.length < 2000; n = walk.nextNode()) {
            if (!(n.nodeValue ?? "").trim()) continue;
            const range = document.createRange();
            range.selectNodeContents(n);
            for (const r of range.getClientRects()) {
              if (r.width > 0 && r.height > 0) out.push({ x: r.x, y: r.y, width: r.width, height: r.height });
            }
          }
          return out;
        })
        .catch(() => []);
      return {
        frames,
        startMs,
        endMs,
        segments,
        manifest: written.manifest,
        files,
        viewport: o.viewport,
        textLines,
        context,
        ...(delays ? { delays } : {}),
        ...(forever ? { forever: true } : {}),
      };
    } finally {
      await page.close();
    }
  });
}

async function readFrames(o: MotionCliOptions): Promise<Captured> {
  const path = resolve(o.source);
  const manifest = parseFramesManifest(await readFile(path, "utf-8"));
  const frames = await Promise.all(
    manifest.frames.map(async (f) => ({
      atMs: f.atMs,
      png: new Uint8Array(await readFile(join(dirname(path), f.file))),
    })),
  );
  const startMs = o.startMs ?? frames[0]?.atMs ?? 0;
  const files = new Map(manifest.frames.map((f) => [f.atMs, join(dirname(path), f.file)]));
  return { frames, startMs, endMs: o.endMs!, segments: [{ startMs, endMs: o.endMs! }], manifest: path, files };
}

export function formatMotionReport(
  source: string,
  captured: Captured,
  r: MotionCheckReport,
  forbid: readonly string[] = [],
): string {
  const lines: string[] = [];
  const restCount = captured.frames.filter((f) => f.atMs > captured.endMs).length;
  lines.push(
    `inspect motion: ${source} — ${captured.forever ? "every animation repeats forever, so the first runs are sampled and nothing rests; " : ""}${captured.frames.length - restCount} frames over ${Math.round(Math.min(captured.startMs, captured.frames[0]?.atMs ?? captured.startMs))}..${Math.round(captured.endMs)}ms${(captured.frames[0]?.atMs ?? captured.startMs) < captured.startMs ? ` (motion from ${Math.round(captured.startMs)}ms; the frames before it show the wait)` : ""} + ${restCount} at rest (${captured.manifest})`,
  );
  let fails = 0;
  let warns = 0;
  type Fit = { best: string; margin: number; errors: Record<string, number>; channel?: string };
  // The ancestor whose fade the target's opacity follows, when its own opacity never changes.
  let fadeOwner: string | undefined;
  const oneFit = (e: Fit) => {
    const next = Object.keys(e.errors)
      .filter((k) => k !== e.best)
      .sort((a, b) => e.errors[a]! - e.errors[b]!)[0];
    const on =
      e.channel && e.channel !== "position"
        ? ` in its ${e.channel}${e.channel === "opacity" && fadeOwner ? ` (${fadeOwner}'s fade: its own opacity does not change)` : ""}`
        : "";
    if (!Number.isFinite(e.margin) || e.margin >= 1000)
      return `follows ${e.best}${on} exactly (measured: no other curve comes close)`;
    return `follows ${e.best}${on} (it fits ${e.margin.toFixed(1)}x better than the next-best curve, ${next})`;
  };
  const fitText = (e: MotionCheckReport["targets"][number]["easing"], broken: boolean) => {
    if (!("best" in e)) return `no easing fit: ${e.skipped}`;
    if (broken) return "no easing named: the path has a jump, so no curve describes it";
    const channels = (e.channels ?? [e]) as Fit[];
    return channels.map(oneFit).join("; ");
  };
  // Where a scale grows from, and when the target's own animation begins: printed whether or
  // not they were expected, since round 3's wrong transform-origin and missing stagger each
  // passed "follows ease-out exactly" with nothing on screen that said where or when.
  const grows = (g: { origin?: Parameters<typeof describeOrigin>[0] }) =>
    g.origin ? `; the scale grows from ${describeOrigin(g.origin)}` : "";
  const begins = (t: { startsAtMs?: number; durationMs?: number; iterations?: number | null }) =>
    (t.startsAtMs !== undefined ? `, begins at ${Math.round(t.startsAtMs)}ms` : "") +
    (t.durationMs !== undefined ? `, runs ${Math.round(t.durationMs)}ms` : "") +
    (t.iterations === null
      ? " and repeats forever"
      : t.iterations !== undefined && t.iterations !== 1
        ? ` x${t.iterations}`
        : "");
  for (const [i, t] of r.targets.entries()) {
    const doms = captured.frames.map((f) => f.dom?.[i]).filter((d) => d !== null && d !== undefined);
    const own = doms.map((d) => d!.ownOpacity).filter((o): o is number => typeof o === "number");
    fadeOwner =
      own.length > 1 && Math.max(...own) - Math.min(...own) < 0.02
        ? doms.map((d) => d!.fadeBy).find((x): x is string => typeof x === "string")
        : undefined;
    // A jump or snap-back inside the motion voids its fit; one at rest (an exit not held) says
    // nothing about the curve, which read "the path has a jump" beside a clean ease-in (round 6).
    const seg0 = t.segments[0];
    const broken = t.findings.some(
      (f) =>
        (f.rule === "jump" || f.rule === "snap-back") && (!seg0 || (f.atMs >= seg0.startMs && f.atMs <= seg0.endMs)),
    );
    if (t.segments.length <= 1) {
      lines.push(
        `  target ${JSON.stringify(t.target)}${begins(t)}: travels ${Math.round(t.travelPx)}px${t.segments[0]?.direction ? ` ${t.segments[0].direction.way}wards` : ""} over the frames measured, ${fitText(t.easing, broken)}${t.segments[0] ? grows(t.segments[0]) : ""}`,
      );
    } else {
      lines.push(`  target ${JSON.stringify(t.target)}${begins(t)}: ${t.segments.length} segments`);
      for (const g of t.segments) {
        // Broken is per segment: a snap-back in the hold after an entrance says nothing about the
        // entrance's curve, and calling it "no easing named" beside an easing-mismatch that names
        // one read as a contradiction (round 2).
        const own = t.findings.some(
          (f) => (f.rule === "jump" || f.rule === "snap-back") && f.atMs >= g.startMs && f.atMs <= g.endMs,
        );
        lines.push(
          `    ${Math.round(g.startMs)}..${Math.round(g.endMs)}ms: travels ${Math.round(g.travelPx)}px${g.direction ? ` ${g.direction.way}wards` : ""}, ${fitText(g.easing, own)}${grows(g)}`,
        );
      }
    }
    // What was read per frame: presence, and the position judged (· = not shown, ~ = put back from the edge).
    const pos = new Map(t.path.map((p) => [p.atMs, p]));
    lines.push(
      `    frames (time, share of its on-screen part seen [op = opacity, on-screen = share of its box in the viewport, when partial], centre): ${r.frames
        .map((f) => {
          const p = pos.get(f.atMs);
          const pr = f.targets[i]!.present.toFixed(2);
          // The share seen is a hit-test, blind to a fade: say the opacity beside it when it is
          // partial, or "1.00" at 20% opacity read as fully visible (round 5).
          const op = captured.frames.find((c) => c.atMs === f.atMs)?.dom?.[i]?.opacity;
          const faded = op !== undefined && op < 0.95 && op >= 0.05 ? ` op ${op.toFixed(2)}` : "";
          const on = captured.frames.find((c) => c.atMs === f.atMs)?.dom?.[i]?.onScreen;
          const offScreen = on !== undefined && on < 0.95 ? ` on-screen ${on.toFixed(2)}` : "";
          return `${Math.round(f.atMs)}ms ${pr}${faded}${offScreen}${p ? ` (${Math.round(p.x)},${Math.round(p.y)})${p.edge ? "~" : ""}` : " ·"}`;
        })
        .join(", ")}`,
    );
    for (const f of t.findings) {
      if (f.severity === "fail") fails++;
      else warns++;
      const from = f.rule === "start-mismatch" ? captured.delays?.[i] : null;
      lines.push(
        `    ${f.severity === "fail" ? "FAIL" : "warn"} ${f.rule} at ${Math.round(f.atMs)}ms: ${f.message}${from ? `; set by \`${from}\`` : ""}`,
      );
    }
  }
  // Several targets: when each begins, side by side. Four entries meant to cascade that begin
  // within a frame of each other read "all at once" here, with no rule needing a brief.
  const timed = r.targets.filter((t) => t.startsAtMs !== undefined);
  if (timed.length >= 2) {
    const at = timed.map((t) => t.startsAtMs!);
    const together = Math.max(...at) - Math.min(...at) <= 17;
    lines.push(
      `  begins: ${timed.map((t) => `${t.target} ${Math.round(t.startsAtMs!)}ms`).join(", ")}${together ? " — all within one frame: they start together (a stagger is each one's own animation-delay; --expect-stagger checks it)" : ""}`,
    );
  }
  for (const f of r.forbidden) {
    if (f.severity === "fail") fails++;
    else warns++;
    const seen = f.frames
      .map((x) => `${Math.round(x.atMs)}ms ${x.noul.toFixed(2)}${x.uncertain ? "?" : ""}`)
      .join(", ");
    lines.push(
      `  ${f.severity === "fail" ? "FAIL" : "warn"} forbid ${JSON.stringify(f.statement)}: seen ${f.atRest ? "at rest" : "mid-motion only"} (${seen}${f.frames.some((x) => x.uncertain) ? "; ? = within 0.3 of the threshold, look at that frame" : ""})`,
    );
  }
  for (const statement of forbid) {
    if (!r.forbidden.some((f) => f.statement === statement)) {
      lines.push(`  ok   forbid ${JSON.stringify(statement)}: not seen in any frame`);
    }
  }
  lines.push(
    `  ${fails === 0 ? "no fail" : `${fails} fail`}${warns ? `, ${warns} warn` : ""}; ${
      r.calls === 0
        ? "measured from the page, no model asked (--jev adds Jev's reading and the --forbid statements)"
        : `${r.model}, ${r.calls} requests, $${r.costUsd.toFixed(5)} — ${captured.frames[0]?.dom?.some(Boolean) ? "positions measured from the page; whether it can be seen, and the statements, are a model's reading" : "a model's reading of the pixels, not a measurement"}`
    }`,
  );
  // Cropped to where the targets move when that is a small part of the frame: eleven 1280px
  // frames on one sheet were too small to read, and round 3's agent cropped them by hand.
  const boxes = [
    ...captured.frames.flatMap((f) => (f.dom ?? []).filter((d) => d !== null).map((d) => d!.box)),
    ...(captured.context ?? []),
  ];
  let crop = "";
  if (boxes.length > 0) {
    // Padded by a quarter of the region (48px at least): what it moves out of or next to, a
    // popover's button, is the reference a person judges it by, and 24px cut it in half (round 4).
    const bx0 = Math.min(...boxes.map((b) => b.x));
    const by0 = Math.min(...boxes.map((b) => b.y));
    const bx1 = Math.max(...boxes.map((b) => b.x + b.width));
    const by1 = Math.max(...boxes.map((b) => b.y + b.height));
    const padX = Math.max(48, (bx1 - bx0) / 4);
    const padY = Math.max(48, (by1 - by0) / 4);
    const x0 = Math.max(0, Math.floor(bx0 - padX));
    const y0 = Math.max(0, Math.floor(by0 - padY));
    const x1 = Math.ceil(bx1 + padX);
    const y1 = Math.ceil(by1 + padY);
    const vw = captured.viewport?.width ?? x1;
    const vh = captured.viewport?.height ?? y1;
    // Edges moved off any line of text they cut (a crop through "Overview" left half a heading
    // under the strip's labels, round 5), out to the line's far side, twice for lines that a
    // first move brings in.
    let [cx0, cy0, cx1, cy1] = [x0, y0, Math.min(x1, vw), Math.min(y1, vh)];
    for (let pass = 0; pass < 2; pass++) {
      for (const t of captured.textLines ?? []) {
        const across = t.x < cx1 && t.x + t.width > cx0;
        const down = t.y < cy1 && t.y + t.height > cy0;
        if (across && t.y < cy0 && t.y + t.height > cy0) cy0 = Math.max(0, Math.floor(t.y - 4));
        if (across && t.y < cy1 && t.y + t.height > cy1) cy1 = Math.min(vh, Math.ceil(t.y + t.height + 4));
        if (down && t.x < cx0 && t.x + t.width > cx0) cx0 = Math.max(0, Math.floor(t.x - 4));
        if (down && t.x < cx1 && t.x + t.width > cx1) cx1 = Math.min(vw, Math.ceil(t.x + t.width + 4));
      }
    }
    const w = cx1 - cx0;
    const h = cy1 - cy0;
    // Under three quarters of the frame: a panel sliding across the right half (556x800) got no
    // crop on the broken page and one on the fixed (round 7).
    if (w > 0 && h > 0 && w * h < 0.75 * vw * vh) crop = ` --crop ${cx0},${cy0},${w},${h}`;
  }
  lines.push(
    `  look at the frames: vlmkit snapshot strip --manifest ${captured.manifest} --max-frames 6 --columns 3${crop} --out ${join(dirname(captured.manifest), "strip.png")}`,
  );
  // A thinned strip can skip the frame a finding is about (six of a toast's frames had none in
  // its 2s hold, round 2): name that frame's own file.
  const firstFail = r.targets
    .flatMap((t) => t.findings.map((f) => ({ ...f, target: t.target })))
    .filter((f) => f.severity === "fail")
    .sort((a, b) => a.atMs - b.atMs)[0];
  const file = firstFail ? captured.files?.get(firstFail.atMs) : undefined;
  // Named by its target: the earliest fail is not always the first one listed (round 5).
  if (file)
    lines.push(
      `  the first fail's own frame (${Math.round(firstFail!.atMs)}ms, ${firstFail!.target} ${firstFail!.rule}): ${file}`,
    );
  return lines.join("\n");
}

const oneOrList = (names: EasingName[]) => (names.length === 1 ? names[0]! : names);

/** One --expect-easing is every target's; several are the targets' in order. */
export function motionEasingOptions(given: EasingName[][] | undefined) {
  if (!given) return {};
  if (given.length === 1) return { expectEasing: oneOrList(given[0]!) };
  return { targetEasing: given.map(oneOrList) };
}

export async function runMotionCli(argv: string[]): Promise<number> {
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(MOTION_USAGE);
    return 0;
  }
  let o: MotionCliOptions;
  try {
    o = parseMotionArgs(argv);
  } catch (e) {
    if (!(e instanceof MotionUsageError) && !(e instanceof Error && e.name === "UsageError")) throw e;
    // The error last: printed above an 80-line help, it scrolled off and read as "printed only
    // the help" (round 4).
    console.error(`${MOTION_USAGE}\n\nerror: ${(e as Error).message}`);
    return 2;
  }
  // Refused before a browser starts: without a key nothing could answer.
  if (o.jev && !process.env.TYPESAFEAI_API_KEY && !process.env.TYPESAFE_API_KEY) {
    console.error(
      "error: --jev asks TypeSafe Jev and needs TYPESAFEAI_API_KEY (console.typesafe.ai/keys). Without --jev, give each target a --selector.",
    );
    return 2;
  }
  let captured: Captured;
  try {
    captured = /(^|\/)frames\.json$/.test(o.source) ? await readFrames(o) : await captureMotion(o);
  } catch (e) {
    if (e instanceof SnappedError) {
      if (e.changed.length === 0) {
        console.error(
          `error: nothing animated after --click ${o.clicks.join(", ")}, and no --selector target changed: check the click reaches the control (and that --selector names what it opens)`,
        );
        return 2;
      }
      console.log(
        `inspect motion: ${o.source} — after --click ${o.clicks.join(", ")}, no animation or transition started`,
      );
      for (const c of e.changed) {
        console.log(
          `    FAIL snapped: ${c} in one frame. If it should animate, its transition never starts: a transition to or from an intrinsic size (height: auto) does not run without interpolate-size: allow-keywords (Chromium only so far; grid-template-rows 0fr → 1fr runs in every engine); a misspelt transition-property and a property the transition does not list are the other usual causes`,
        );
      }
      console.log(`  ${e.changed.length} fail; measured from the page, no model asked`);
      return 1;
    }
    if (!(e instanceof MotionUsageError)) throw e;
    console.error(`error: ${e.message}`);
    return 2;
  }
  const { checkMotionFrames } = await import("@mizchi/vlmkit-ai/motion-check.ts");
  const r = await checkMotionFrames(captured.frames, {
    targets: o.targets,
    forbid: o.forbid,
    startMs: captured.startMs,
    endMs: captured.endMs,
    segments: captured.segments,
    threshold: o.threshold,
    exits: o.exits,
    jev: o.jev,
    ...motionEasingOptions(o.expectEasing),
    ...(o.expectOrigin ? { expectOrigin: o.expectOrigin.length === 1 ? o.expectOrigin[0]! : o.expectOrigin } : {}),
    ...(o.expectStartMs ? { expectStartMs: o.expectStartMs } : {}),
    ...(o.expectStaggerMs !== undefined ? { expectStaggerMs: o.expectStaggerMs } : {}),
    ...(o.expectDurationMs ? { expectDurationMs: o.expectDurationMs } : {}),
    ...(o.expectIterations ? { expectIterations: o.expectIterations } : {}),
    ...(o.expectDirection ? { expectDirection: o.expectDirection } : {}),
  });
  const json = {
    source: o.source,
    frames: captured.manifest,
    startMs: captured.startMs,
    endMs: captured.endMs,
    segments: captured.segments,
    passed: r.passed,
    targets: r.targets,
    forbidden: r.forbidden,
    answers: r.frames,
    model: r.model,
    costUsd: r.costUsd,
  };
  // Kept beside the frames: reading the verdict again must not ask the model again.
  const saved = join(dirname(captured.manifest), "motion-report.json");
  await writeFile(saved, `${JSON.stringify(json, null, 2)}\n`);
  if (o.json) console.log(JSON.stringify(json, null, 2));
  else console.log(`${formatMotionReport(o.source, captured, r, o.forbid)}\n  report: ${saved}`);
  return r.passed ? 0 : 1;
}

if (isCliEntry(import.meta.url, "motion")) {
  runMotionCli(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch(handleCliError);
}
