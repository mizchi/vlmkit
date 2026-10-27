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
        // Not rendered at all (display: none on it or an ancestor): no box, not a box at 0,0. A
        // dismissed banner's rest frame read as a centre at (0,0), "travels up", and the easing
        // fitted to it was "steps" (round 11).
        if (el.getClientRects().length === 0) {
          let none: Element | null = el;
          while (none && getComputedStyle(none).display !== "none") none = none.parentElement;
          const who =
            !none || none === el
              ? "it"
              : none.tagName.toLowerCase() +
                (typeof none.className === "string" && none.className.trim()
                  ? `.${none.className.trim().split(/\s+/)[0]}`
                  : "");
          return {
            box: { x: 0, y: 0, width: 0, height: 0 },
            opacity: 0,
            scale: 1,
            t: null,
            visible: 0,
            onScreen: 0,
            elapsedMs: null,
            ownOpacity: 0,
            notRendered: true,
            catches: false,
            hiddenBy: `not rendered: ${who === "it" ? "it is" : `${who} is`} display: none${el.hasAttribute("hidden") || none?.hasAttribute("hidden") ? " (the hidden attribute)" : ""}`,
          };
        }
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
          // Column norms in 3D: a card turning on rotateY has a = cos θ, and its turn read as a
          // scale ("the scale grows from the line through its middle", round 8 → 9).
          scaleX = Math.hypot(m.m11, m.m12, m.m13);
          scaleY = Math.hypot(m.m21, m.m22, m.m23);
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
        // Its own animation, or the nearest ancestor's: a flip card's faces turn with the card,
        // and --expect-duration on a face printed nothing (round 9).
        let timed: Element | null = el;
        while (timed && timed.getAnimations().length === 0) timed = timed.parentElement;
        for (const a of (timed ?? el).getAnimations()) {
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
        // Which way it faces: the z of its normal through every transform up the tree. Turned past
        // edge-on, a face shows its back — mirrored, unless backface-visibility hides it (the
        // flip card of round 9 showed its question backwards over the answer).
        const facing = (e: Element) => {
          let M = new DOMMatrix();
          for (let n: Element | null = e; n && n !== document.documentElement; n = n.parentElement) {
            const tf = getComputedStyle(n).transform;
            if (tf && tf !== "none") M = new DOMMatrix(tf).multiply(M);
          }
          return M.m33;
        };
        const m33 = facing(el);
        // How far it is turned: its normal's angle in 3D, else its own 2D rotation.
        const turn = (e: Element): { turnDeg?: number } => {
          // Any 3D transform up the tree: the angle of its normal, 0 facing you, 180 turned over.
          let threeD = false;
          for (let n: Element | null = e; n && n !== document.documentElement && !threeD; n = n.parentElement) {
            const tf = getComputedStyle(n).transform;
            if (tf && tf !== "none" && !new DOMMatrixReadOnly(tf).is2D) threeD = true;
          }
          if (threeD) return { turnDeg: (Math.acos(Math.max(-1, Math.min(1, m33))) * 180) / Math.PI };
          const tf = getComputedStyle(e).transform;
          if (!tf || tf === "none") return {};
          const m = new DOMMatrixReadOnly(tf);
          const deg = (Math.atan2(m.b, m.a) * 180) / Math.PI;
          return Math.abs(deg) > 0.01 ? { turnDeg: deg } : {};
        };
        const backHidden = getComputedStyle(el).backfaceVisibility === "hidden";
        // Its paint, as numbers: every colour in its background (a gradient's stops), its text and
        // its border. A hover gradient that faded read "travels 0px … target-static", and one that
        // snapped read "no --selector target changed" (round 11).
        const own = getComputedStyle(el);
        const paint: number[] = [];
        for (const v of [own.backgroundImage, own.backgroundColor, own.color, own.borderTopColor, own.fill, own.stroke])
          for (const m of String(v).matchAll(/rgba?\(([^)]*)\)/g)) {
            const c = m[1]!
              .split(/[\s,/]+/)
              .filter(Boolean)
              .map(Number);
            paint.push(c[0] ?? 0, c[1] ?? 0, c[2] ?? 0, Math.round((c[3] ?? 1) * 255));
          }
        // A transition on background over a gradient: a gradient does not interpolate, so it steps.
        const durations = own.transitionDuration.split(",").map((d) => parseFloat(d) || 0);
        const discreteBg =
          /gradient\(/.test(own.backgroundImage) &&
          own.transitionProperty
            .split(",")
            .map((p) => p.trim())
            .some((p, i) => /^(all|background|background-image)$/.test(p) && durations[i % durations.length]! > 0);
        // Whether it takes a click at its centre as the page is: an invisible target that still does
        // sits over whatever is behind it (a dismissed banner at opacity 0, round 11).
        const cx = r.x + r.width / 2;
        const cy = r.y + r.height / 2;
        const atCentre =
          r.width > 0 && r.height > 0 && cx >= 0 && cy >= 0 && cx < innerWidth && cy < innerHeight
            ? document.elementFromPoint(cx, cy)
            : null;
        const catches = !!atCentre && el.contains(atCentre);
        // What of it is the topmost thing painted, over a 5x5 grid of its box inside the viewport:
        // a clip (overflow: hidden), a cover (z-index) and leaving the screen all take it away.
        el.setAttribute("data-vlmkit-probe", "");
        let inView = 0;
        let hits = 0;
        let outside = 0;
        let onViewport = 0;
        let missed: { x: number; y: number; top: Element | null } | null = null;
        // A point of the box that is not of the element's own shape is not evidence: a spinner's
        // round, turned box has corners where the card behind it shows through, and a check mark's
        // stroke covers a sliver of its box (both read "covered" on correct pages, round 10). An
        // ancestor hit inside every clipping ancestor is such a point; a clip is not.
        const clips: DOMRect[] = [];
        for (let a = el.parentElement; a; a = a.parentElement) {
          const s = getComputedStyle(a);
          if (s.overflowX !== "visible" || s.overflowY !== "visible") clips.push(a.getBoundingClientRect());
        }
        const inClips = (x: number, y: number) =>
          clips.every((b) => x >= b.left && x < b.right && y >= b.top && y < b.bottom);
        const geometry = el instanceof SVGGeometryElement ? el : null;
        const ctm = geometry?.getScreenCTM()?.inverse() ?? null;
        // An SVG group (or <svg>) is its shapes: each geometry inside it, with its own inverse CTM.
        const shapes =
          !geometry && el instanceof SVGGraphicsElement
            ? [...el.querySelectorAll("path,rect,circle,ellipse,line,polyline,polygon")]
                .filter((g): g is SVGGeometryElement => g instanceof SVGGeometryElement)
                .slice(0, 64)
                .map((g) => ({ g, inv: g.getScreenCTM()?.inverse() ?? null }))
            : [];
        const inShape = (s: (typeof shapes)[number], x: number, y: number) => {
          if (!s.inv) return true;
          const q = new DOMPoint(x, y).matrixTransform(s.inv);
          return s.g.isPointInFill(q) || s.g.isPointInStroke(q);
        };
        // A dashed stroke: how much of its line is drawn, from the dash pattern itself. A check mark
        // whose dash was shorter than its line stopped half way up its long arm, and read "covered
        // by circle" (round 10). Points of the line its dashes leave undrawn are not covered.
        let drawn: number | undefined;
        let dashNote: string | undefined;
        if (geometry) {
          const cs = getComputedStyle(geometry);
          if (cs.strokeDasharray && cs.strokeDasharray !== "none") {
            const dash = cs.strokeDasharray
              .split(/[ ,]+/)
              .map(parseFloat)
              .filter((v) => Number.isFinite(v));
            const pattern = dash.length % 2 === 1 ? [...dash, ...dash] : dash;
            const period = pattern.reduce((a, b) => a + b, 0);
            const len = geometry.getTotalLength();
            const attr = Number(geometry.getAttribute("pathLength"));
            const scaleLen = Number.isFinite(attr) && attr > 0 ? attr / len : 1;
            const off = parseFloat(cs.strokeDashoffset) || 0;
            if (period > 0 && len > 0) {
              let on = 0;
              const step = len / 400;
              for (let x = step / 2; x < len; x += step) {
                let ph = (((x * scaleLen + off) % period) + period) % period;
                for (let k = 0; k < pattern.length; k++) {
                  if (ph < pattern[k]!) {
                    if (k % 2 === 0) on++;
                    break;
                  }
                  ph -= pattern[k]!;
                }
              }
              drawn = on / 400;
              dashNote = `stroke-dasharray ${cs.strokeDasharray} with stroke-dashoffset ${cs.strokeDashoffset} on a line ${(len * scaleLen).toFixed(1)} long`;
            }
          }
        }
        for (let gy = 0; gy < 5; gy++) {
          for (let gx = 0; gx < 5; gx++) {
            const x = r.x + ((gx + 0.5) / 5) * r.width;
            const y = r.y + ((gy + 0.5) / 5) * r.height;
            if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) continue;
            onViewport++;
            if (geometry && ctm) {
              const p = new DOMPoint(x, y).matrixTransform(ctm);
              if (!geometry.isPointInFill(p) && !geometry.isPointInStroke(p)) {
                outside++;
                continue;
              }
            } else if (shapes.length > 0 && !shapes.some((s) => inShape(s, x, y))) {
              // An SVG group's box is its turned shapes' bounds: a point no shape of it covers is not
              // evidence. A spinning gear group read "covered by rect" (its backdrop) 24 times (round 12).
              outside++;
              continue;
            }
            const top = document.elementFromPoint(x, y);
            if (top && el.contains(top)) {
              inView++;
              hits++;
              continue;
            }
            // On the line but not painted: its dashes leave it undrawn there, nothing covers it.
            if (drawn !== undefined) {
              outside++;
              continue;
            }
            if (top && top !== el && top.contains(el) && inClips(x, y)) {
              outside++;
              continue;
            }
            inView++;
            missed ??= { x, y, top };
          }
        }
        el.removeAttribute("data-vlmkit-probe");
        // Every point outside its shape: nothing was seen covering it.
        const visible = opacity < 0.05 ? 0 : inView === 0 ? (outside > 0 ? 1 : 0) : hits / inView;
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
        if (m33 < -0.01 && backHidden && visible < 0.5) {
          hiddenBy =
            "it faces away from you and its backface-visibility is hidden: turned over, as the far side of a flip card is";
        } else if (opacity < 0.05) {
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
          if (onViewport === 0) hiddenBy = "its box is outside the viewport";
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
              for (let c: Element | null = cover; c && c !== document.body; c = c.parentElement) {
                if (
                  facing(c) < -0.01 &&
                  getComputedStyle(c).backfaceVisibility !== "hidden" &&
                  c !== el &&
                  !c.contains(el)
                ) {
                  hiddenBy = `covered by ${name(c)}, which faces away from you (turned past edge-on) with backface-visibility: visible, so it is painted mirrored over the target: give it backface-visibility: hidden (both faces of a flip card)`;
                  break;
                }
              }
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
          onScreen: onViewport / 25,
          elapsedMs,
          ...(durationMs !== null ? { durationMs, iterations: iterations ?? null } : {}),
          ownOpacity,
          ...(fadeBy ? { fadeBy: name(fadeBy) } : {}),
          ...(hiddenBy ? { hiddenBy } : {}),
          // Turned in 3D: its box is the turned shape's bounds, and within 15° of edge-on it has
          // next to no area, so nothing is judged from it (an edge-on card read target-lost).
          ...(Math.abs(m33) < 0.999 ? { rotated3d: true } : {}),
          ...(Math.abs(m33) < 0.26 ? { edgeOn: true } : {}),
          ...(m33 < -0.01 ? { facingAway: true } : {}),
          ...(drawn !== undefined ? { drawn, ...(dashNote ? { dashNote } : {}) } : {}),
          ...turn(el),
          ...(m33 < -0.01 && !backHidden ? { mirrored: true } : {}),
          ...(paint.length > 0 ? { paint } : {}),
          ...(discreteBg ? { discreteBg: true } : {}),
          ...(el instanceof SVGElement && !(el instanceof SVGSVGElement) ? { svg: true } : {}),
          catches,
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
  still-mismatch   its centre moves though --expect-still says only size and opacity change
  snapped          after an action a --selector target changed with no animation at all
  interrupt-jump   an action cut into a motion (--wait) and the target jumped as it landed
  loop-seam        a repeating animation's run ends where the next does not begin (a 350deg spin)
  pushed           moves with no animation of its own: a layout property animated elsewhere (warn)
  invisible-blocker at rest it is transparent and still takes clicks at its centre
  size-jump        its width or height steps in one frame while it eases (its text re-wrapping)
  turn-off-centre  it turns and its centre is carried round: another transform-origin (warn)
  replayed         after rest, as the page's timers run (up to 10s), it is replaced by a new element that
                   plays its animation again (a re-render); the same element starting again is a warn
  stroke-incomplete a stroke drawing itself ends part drawn (a dash shorter than its line)
  mirrored         a face turned past edge-on is seen backwards (backface-visibility)
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
With --selector every frame is measured from the page, a jump's floor is 6px
(an easing is fitted from 2px, a target is static under 1px), and opacity (a change of 0.2+) and scale (0.02+) are fitted as well as position:
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
                          from the right edge" moves left — or which way it turns: clockwise |
                          counterclockwise. Once for every target, or per target
  --expect-iterations <n> How many times it runs: 3, or infinite. Once for every target, or
                          comma-separated per target. --selector
  --expect-still          Its centre must not move: only its size and opacity change (a dialog
                          that stays centred while it grows in). --selector
  --click <css>           Actions on the held page before any frame, in the order given: the
  --hover <css>           motion the LAST one starts is sampled, and each one before it first
  --leave                 runs to its end. --hover puts the pointer over an element, --leave
  --scroll <css|px>       takes it off every element ("--hover .card --leave" samples the card
                          settling back), --scroll brings an element's top to the viewport's
                          top (or scrolls to a y in px) — what a scroll-triggered reveal needs.
                          Nothing animating while a --selector target changes is \`snapped\`
  --wait <ms>             After an action: let only this long pass before the next one instead
                          of its whole motion — a change of mind mid-motion. "--click .menu-btn
                          --wait 100 --click .menu-btn" lands the second click 100ms into the
                          opening; a target that jumps when it lands is \`interrupt-jump\` (fail)
  --exits                 The targets are meant to leave (gone at rest is their end)
  --still <css>           One --selector target's centre must not move (repeat): the article a
                          notice slides over, beside the notice that moves
  --exit <css>            One --selector target is meant to leave, the others are not (repeat):
                          a flip card's front face turned away, beside its back turning in
  --at <instants>         Frames to shoot (default: 11 per segment + rest); the segments stay
                          the page's own spans of motion
  --start <ms> --end <ms> The motion's span (needed for frames.json): one segment
  --viewport <WxH>        Default 1280x800
  --frames <dir>          (or --out) Where the frames go (default test-results/inspect-motion/<page name>, so
                          two pages, or check animation's frames, do not overwrite each other)
  --threshold <0-1>       A statement is true at or above this (default 0.5)
  --json                  Print the report as JSON

Exit: 0 nothing fails, 1 a fail, 2 usage error. With --jev, ~$0.00013 and ~0.2s per frame.
Advisory: gate on check animation / check integrity --timeline.
Measured: https://github.com/mizchi/vlmkit/blob/main/docs/reports/2026-10-18-jev-motion.md`;

export class MotionUsageError extends Error {}

/** After --click nothing animated: the targets that changed did so in one frame. */
export class SnappedError extends Error {
  constructor(
    readonly changed: string[],
    /** Per change, the cause the page shows, when it does. */
    readonly causes: (string | undefined)[] = [],
  ) {
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
  /** --selector targets meant to leave, by selector. */
  exitSelectors: string[];
  /** --selector targets whose centre must not move (one target's --expect-still). */
  stillSelectors: string[];
  at?: number[];
  startMs?: number;
  endMs?: number;
  viewport: { width: number; height: number };
  frames: string;
  threshold: number;
  json: boolean;
  /** Ask TypeSafe Jev. Without it every target is a --selector, measured from the page alone. */
  jev: boolean;
  /**
   * What is done on the held page before any frame is shot, in order: the motion the last one
   * starts is sampled, and each one before it is first let run to its end.
   */
  actions: MotionAction[];
  /** Each target's centre must not move (only size and opacity change). */
  expectStill: boolean;
}

/** One thing done on the held page: a click, the pointer over or off an element, a scroll. */
export type MotionAction =
  | { kind: "click" | "hover"; selector: string }
  | { kind: "leave" }
  | { kind: "scroll"; selector: string }
  | { kind: "scroll"; y: number }
  | { kind: "wait"; ms: number };

export const describeAction = (a: MotionAction): string =>
  a.kind === "leave"
    ? "--leave"
    : a.kind === "wait"
      ? `--wait ${a.ms}`
      : "selector" in a
        ? `--${a.kind} ${a.selector}`
        : `--scroll ${a.y}`;

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
  const exitSelectors: string[] = [];
  const stillSelectors: string[] = [];
  let noForbid = false;
  let jev = false;
  const actions: MotionAction[] = [];
  let expectStill = false;
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
      case "--hover":
        actions.push({ kind: a === "--click" ? "click" : "hover", selector: value(a, argv[++i]).trim() });
        break;
      case "--leave":
        actions.push({ kind: "leave" });
        break;
      case "--wait":
        actions.push({ kind: "wait", ms: one(a, value(a, argv[++i])) });
        break;
      case "--scroll": {
        const v = value(a, argv[++i]).trim();
        actions.push(/^\d+(px)?$/.test(v) ? { kind: "scroll", y: parseInt(v, 10) } : { kind: "scroll", selector: v });
        break;
      }
      case "--expect-still":
        expectStill = true;
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
      // --out is what other commands call it: an agent reached for it and got "unknown option" (round 11).
      case "--frames":
      case "--out":
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
      case "--exit":
        exitSelectors.push(value(a, argv[++i]).trim());
        break;
      case "--still":
        stillSelectors.push(value(a, argv[++i]).trim());
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
            "--output": "--frames <dir>",
            "--out-dir": "--frames <dir>",
            "--key": "--jev",
          };
          throw new MotionUsageError(`unknown option ${a}${near[a] ? ` (did you mean ${near[a]}?)` : ""}`);
        }
        positional.push(a);
    }
  }
  if (positional.length !== 1) {
    // `--expect-still .gear` read ".gear" as a second page (round 12): it takes no value.
    const afterFlag = positional.find((p, k) => k > 0 && argv[argv.indexOf(p) - 1] === "--expect-still");
    if (afterFlag)
      throw new MotionUsageError(
        `--expect-still takes no value (it applies to every target): for one target, write --still ${afterFlag}`,
      );
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
    // A --target names the selector in its position; the rest are named by their selectors (the
    // help said so, and 3 --selector with 1 --target was refused, round 9).
    if (targets.length < selectors.length) targets.push(...selectors.slice(targets.length));
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
  for (const [flag, list] of [
    ["--exit", exitSelectors],
    ["--still", stillSelectors],
  ] as const)
    for (const sel of list)
      if (!selectors.includes(sel))
        throw new MotionUsageError(`${flag} ${sel} names no --selector: give the same selector to both`);
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
    exitSelectors,
    stillSelectors,
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
    actions,
    expectStill,
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
  /** A repeating animation whose run does not end where the next begins: a jump at every loop. */
  seams?: { selector: string; message: string }[];
  /** After rest, as the page's timers ran: a target replaced by a new element, or its animation begun again. */
  replays?: { selector: string; message: string; warn?: boolean }[];
  /** Animations whose keyframes move layout (margin, height, top…): what pushes its neighbours. */
  layoutMovers?: string[];
  /** Only infinite animations ran: the first runs were sampled and nothing rests. */
  forever?: boolean;
  /** The last action cut into the motion before it: the targets as they were just before it. */
  interrupt?: { atMs: number; action: string; before: (MotionDom | null)[] };
  /** The page's scroll position across the frames shot, when it moved (a clamp at the page's end). */
  scrolled?: { from: number; to: number };
  /**
   * Each target's parent box at rest, when it is at most six times the target's area: what it
   * fills or sits in (a bar's track), which the crop keeps. A crop around the bar alone cut its
   * track off at 70%, the very thing to judge (round 7).
   */
  context?: { x: number; y: number; width: number; height: number }[];
  /** Every line of text on the page at rest, so a suggested crop does not cut one in half. */
  textLines?: { x: number; y: number; width: number; height: number }[];
}

/** Do one action on the held page; an element it cannot reach is the user's error, named. */
async function runAction(page: import("playwright").Page, act: MotionAction): Promise<void> {
  if (act.kind === "wait") return;
  try {
    if (act.kind === "click") await page.click(act.selector, { timeout: 5000 });
    else if (act.kind === "hover") await page.hover(act.selector, { timeout: 5000 });
    // Off every element that could take :hover: the page's top-left corner is the html element.
    else if (act.kind === "leave") await page.mouse.move(0, 0);
    else if ("selector" in act) {
      const found = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        el?.scrollIntoView({ block: "start", behavior: "instant" as ScrollBehavior });
        return el !== null;
      }, act.selector);
      if (!found) throw new Error(`matches nothing on the page`);
    } else await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" as ScrollBehavior }), act.y);
  } catch (e) {
    throw new MotionUsageError(`${describeAction(act)}: ${(e as Error).message.split("\n")[0]}`);
  }
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
      // Animations held before the last action: what it starts comes after them.
      let heldBefore = held.length;
      // The last action landed while the one before was still moving: its targets just before it.
      let interrupt: Captured["interrupt"];
      if (o.actions.length > 0) {
        let beforeClick: Awaited<ReturnType<typeof measureTargets>> = [];
        const scrolled = () => page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));
        let scrollBefore = { x: 0, y: 0 };
        // Each action on the held page, in order. Before the next one, the motion it started runs
        // to its end: a hover's lift must be finished before --leave lets it settle back, and two
        // --click on one page sampled only the last with the first never run (round 8).
        // A --wait after an action cuts its motion short instead: the clock runs that long and the
        // next action lands mid-motion. A change of mind (a second click on a menu still
        // unfolding) could not be expressed at all (round 9).
        const steps: { act: MotionAction; waitAfter?: number }[] = [];
        for (const act of o.actions) {
          if (act.kind !== "wait") steps.push({ act });
          else if (steps.length > 0)
            steps[steps.length - 1]!.waitAfter = (steps[steps.length - 1]!.waitAfter ?? 0) + act.ms;
          else {
            clockNow += act.ms;
            await timeline.at(clockNow);
          }
        }
        if (steps.length === 0)
          throw new MotionUsageError("--wait needs an action to follow (--click, --hover, --leave, --scroll)");
        for (const [k, { act, waitAfter }] of steps.entries()) {
          if (k === steps.length - 1) {
            beforeClick = o.selectors.length > 0 ? await measureTargets(page, o.selectors) : [];
            scrollBefore = await scrolled();
            heldBefore = held.length;
            if (k > 0 && steps[k - 1]!.waitAfter !== undefined)
              interrupt = { atMs: clockNow, action: describeAction(act), before: beforeClick };
          }
          await runAction(page, act);
          clockNow += frameTimeMs(1);
          await timeline.at(clockNow);
          // A scroll's IntersectionObserver callbacks and a hover's style change are delivered
          // with the next rendering, which is real: let one happen, then step the clock again.
          await page.waitForTimeout(50);
          clockNow += frameTimeMs(1);
          await timeline.at(clockNow);
          held = await timeline.animations();
          if (k < steps.length - 1 && waitAfter !== undefined) {
            clockNow += waitAfter;
            await timeline.at(clockNow);
          } else if (k < steps.length - 1) {
            const ends = held
              .filter((h) => h.iterations !== null)
              .map((h) => h.startMs + h.durationMs * (h.iterations ?? 1));
            const end = Math.max(clockNow, ...ends);
            clockNow = Math.min(end, clockNow + 10_000) + frameTimeMs(1);
            await timeline.at(clockNow);
          }
        }
        // The plan's clock starts where the actions left it.
        clockNow = Math.max(0, clockNow - frameTimeMs(1));
        // Nothing new, but something earlier still runs (a reveal begun at load that a scroll
        // only brings into view): that is the motion to sample, not a snap.
        const running = held.some(
          (h) => h.iterations === null || h.startMs + h.durationMs * (h.iterations ?? 1) > clockNow,
        );
        if (held.length === heldBefore && running) heldBefore = 0;
        if (held.length === heldBefore && o.endMs === undefined) {
          // Nothing animates after the action: if a target changed, it changed in one frame.
          const afterClick = o.selectors.length > 0 ? await measureTargets(page, o.selectors) : [];
          // In the page's own coordinates: a scroll moves every box, and that is not a change.
          const after = await scrolled();
          const dx = after.x - scrollBefore.x;
          const dy = after.y - scrollBefore.y;
          const causes: (string | undefined)[] = [];
          const changed = o.selectors.flatMap((sel, i) => {
            const a = beforeClick[i];
            const b = afterClick[i];
            if (!a || !b) return [];
            const off = (sx: number, sy: number) =>
              Math.max(
                Math.abs(a.box.x - (b.box.x + sx)),
                Math.abs(a.box.y - (b.box.y + sy)),
                Math.abs(a.box.width - b.box.width),
                Math.abs(a.box.height - b.box.height),
              );
            // In the page's coordinates, or the viewport's for what the scroll does not carry (a
            // fixed progress bar read "1280x4 at (0,0) → 1280x4 at (0,0)" as a change, round 12).
            const d = Math.min(off(dx, dy), off(0, 0));
            const op = Math.abs(a.opacity - b.opacity);
            const pa = a.paint ?? [];
            const pb = b.paint ?? [];
            const paintStep =
              pa.length === pb.length && pa.length > 0 ? Math.max(...pa.map((v, k) => Math.abs(v - pb[k]!))) : 0;
            if (!(d >= 1 || op >= 0.05 || paintStep >= 8)) return [];
            causes.push(
              b.notRendered
                ? `the action took it out of rendering (${b.hiddenBy?.replace(/^not rendered: /, "") ?? "display: none"}) in the same frame, so no exit animation can be drawn: let it leave first and hide it once it has (on animationend / transitionend), or transition display with transition-behavior: allow-discrete`
                : paintStep >= 8 && d < 1 && op < 0.05 && (a.discreteBg || b.discreteBg)
                  ? `only its colour changed, and its transition on background runs between two gradients, which do not interpolate (a gradient is an image: it steps at once). Build the gradient from registered colour properties (@property --c { syntax: "<color>"; … }) and transition those, or cross-fade a second gradient layer's opacity`
                  : undefined,
            );
            return [
              d >= 1 || op >= 0.05
                ? `${sel}: ${Math.round(a.box.width)}x${Math.round(a.box.height)} at (${Math.round(a.box.x)},${Math.round(a.box.y)}) → ${Math.round(b.box.width)}x${Math.round(b.box.height)} at (${Math.round(b.box.x)},${Math.round(b.box.y)})${op >= 0.05 ? `, opacity ${a.opacity.toFixed(2)} → ${b.opacity.toFixed(2)}` : ""}`
                : `${sel}: its colour, by up to ${Math.round(paintStep)} of 255 a channel,`,
            ];
          });
          throw new SnappedError(changed, causes);
        }
      } else if (held.length === 0 && o.endMs === undefined) {
        // Frame by frame up to the latest timer: jumping straight to it ran a click at 100ms and
        // its reversal at 200ms in one step, and a transition that had run read "no animation"
        // (round 9). Each frame is the first after a timer due in it, as a page renders it.
        let n = 0;
        for (let guard = 0; guard < 20 && held.length === 0; guard++) {
          const due = await timeline.pending();
          if (due.timers === 0 || due.latestTimerMs === null || due.latestTimerMs > 10_000) break;
          const lastFrame = Math.floor((due.latestTimerMs * 60) / 1000 + 1e-6) + 1;
          if (lastFrame <= n) break;
          while (n < lastFrame && held.length === 0) {
            n++;
            await timeline.at(frameTimeMs(n));
            ranTo = Math.round(frameTimeMs(n));
            held = await timeline.animations();
          }
        }
        if (held.length > 0) {
          await page.close();
          page = await browser.newPage({ viewport: o.viewport, deviceScaleFactor: 1 });
          timeline = await openHeldTimeline(page, url);
        }
      }
      const holds = await keyframeHolds(page).catch(() => []);
      // After actions, the motion the last one started; what ran before it is not this sampling's.
      const planned = o.actions.length > 0 ? held.slice(heldBefore) : held;
      const plan = motionPlan(
        planned.map((a) => {
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
          // A 0s animation is there and runs no time: an `animation` shorthand after
          // `animation-timeline` resets both (round 12's reading bar, full from load).
          const zero = await page
            .evaluate(() =>
              document
                .getAnimations()
                .filter(
                  (a) => Number(a.effect?.getComputedTiming().duration) === 0 && (a as CSSAnimation).animationName,
                )
                .map((a) => (a as CSSAnimation).animationName),
            )
            .catch(() => [] as string[]);
          if (zero.length > 0)
            throw new MotionUsageError(
              `no animation runs any time: ${[...new Set(zero)].map((n) => `\`${n}\``).join(", ")} ${zero.length === 1 ? "has" : "have"} a duration of 0s, so ${zero.length === 1 ? "it ends" : "they end"} as ${zero.length === 1 ? "it begins" : "they begin"} and ${zero.length === 1 ? "its" : "their"} fill holds the last keyframe from load. If it is meant to follow the scroll, \`animation-timeline\` has to come after the \`animation\` shorthand, which resets it to auto (and the duration to 0s); otherwise give it a duration`,
            );
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
      const scrollYs: number[] = [];
      for (const atMs of instants) {
        await timeline.at(atMs);
        scrollYs.push(await page.evaluate(() => window.scrollY).catch(() => 0));
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
      // Where a repeating run ends against where the next begins: a spinner whose keyframes end at
      // 350deg jumped 10deg forward once a second, and every frame read "follows linear in its
      // turn, no fail" (round 10). Its state a ms before the seam, at it, and a ms before that.
      const seams = await page
        .evaluate((sels) => {
          const out: { selector: string; message: string }[] = [];
          const read = (el: Element) => {
            const cs = getComputedStyle(el);
            const m =
              cs.transform && cs.transform !== "none" ? new DOMMatrixReadOnly(cs.transform) : new DOMMatrixReadOnly();
            return {
              x: m.e,
              y: m.f,
              deg: (Math.atan2(m.b, m.a) * 180) / Math.PI,
              sx: Math.hypot(m.a, m.b),
              op: Number(cs.opacity),
            };
          };
          const turn = (a: number, b: number) => ((b - a + 540) % 360) - 180;
          for (const sel of sels) {
            const el = document.querySelector(sel);
            if (!el) continue;
            for (const a of el.getAnimations()) {
              const t = a.effect?.getComputedTiming();
              const d = Number(t?.duration);
              if (!t || !Number.isFinite(d) || d <= 4 || (t.iterations !== Infinity && Number(t.iterations) < 2))
                continue;
              if (t.direction === "alternate" || t.direction === "alternate-reverse") continue;
              const delay = Number(t.delay) || 0;
              const was = a.currentTime;
              a.pause();
              const at = (ms: number) => {
                a.currentTime = delay + ms;
                return read(el);
              };
              const p0 = at(d - 2),
                p1 = at(d - 1),
                p2 = at(d + 0.001),
                p3 = at(d + 1);
              a.currentTime = was;
              const rate = Math.max(Math.abs(turn(p0.deg, p1.deg)), Math.abs(turn(p2.deg, p3.deg)));
              const jump = Math.abs(turn(p1.deg, p2.deg));
              const moveRate = Math.max(Math.hypot(p1.x - p0.x, p1.y - p0.y), Math.hypot(p3.x - p2.x, p3.y - p2.y));
              const move = Math.hypot(p2.x - p1.x, p2.y - p1.y);
              const opJump = Math.abs(p2.op - p1.op);
              const opRate = Math.max(Math.abs(p1.op - p0.op), Math.abs(p3.op - p2.op));
              const name = (a as CSSAnimation).animationName ?? "its animation";
              const kf = (a.effect as KeyframeEffect).getKeyframes();
              const ends =
                kf.length >= 2
                  ? ` (its keyframes run from ${String(kf[0]!.transform ?? kf[0]!.opacity ?? "?")} to ${String(kf[kf.length - 1]!.transform ?? kf[kf.length - 1]!.opacity ?? "?")})`
                  : "";
              if (jump > Math.max(1, 3 * rate)) {
                out.push({
                  selector: sel,
                  message: `${sel} \`${name}\` turns ${jump.toFixed(1)}° in one step at every loop (${rate.toFixed(2)}° a ms either side)${ends}: each run ends where the next does not begin — end it on the same pose it starts on (360deg, not 350deg)`,
                });
              } else if (move > Math.max(1, 3 * moveRate)) {
                out.push({
                  selector: sel,
                  message: `${sel} \`${name}\` jumps ${move.toFixed(1)}px at every loop${ends}: each run ends where the next does not begin — make its last keyframe the first one's pose (a ticker's track one full copy long)`,
                });
              } else if (opJump > Math.max(0.05, 3 * opRate)) {
                out.push({
                  selector: sel,
                  message: `${sel} \`${name}\` jumps from opacity ${p1.op.toFixed(2)} to ${p2.op.toFixed(2)} at every loop${ends}: each run ends where the next does not begin`,
                });
              }
            }
          }
          return out;
        }, o.selectors)
        .catch(() => []);
      // Which animations change layout: an article with no animation of its own followed a
      // notice's margin-top down 56px, and the fail blamed a transform (round 10).
      const layoutMovers = await page
        .evaluate(() => {
          const layout =
            /^(margin|padding|top|bottom|left|right|inset|height|width|min-height|max-height|min-width|max-width|gap|row-gap|column-gap|flex-basis|grid-template-rows|grid-template-columns|font-size|line-height|border-width)/;
          const out: string[] = [];
          for (const a of document.getAnimations()) {
            const el = (a.effect as KeyframeEffect | null)?.target as Element | null;
            if (!el) continue;
            const props = new Set<string>();
            for (const k of (a.effect as KeyframeEffect).getKeyframes())
              for (const p of Object.keys(k))
                if (!["offset", "computedOffset", "easing", "composite"].includes(p))
                  props.add(p.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`));
            const tp = (a as CSSTransition).transitionProperty;
            if (tp) props.add(tp);
            const moving = [...props].filter((p) => layout.test(p));
            if (moving.length === 0) continue;
            const name =
              el.tagName.toLowerCase() +
              (el.id
                ? `#${el.id}`
                : typeof el.className === "string" && el.className.trim()
                  ? `.${el.className.trim().split(/\s+/)[0]}`
                  : "");
            const what = `${name} animates ${moving.join(", ")}`;
            if (!out.includes(what)) out.push(what);
          }
          return out.slice(0, 4);
        })
        .catch(() => []);
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
      // After rest, the page's own timers: a quote re-rendered by innerHTML every second replaced
      // its price with a new element whose entrance played again, and the frames, which end at
      // rest, read "no fail" (round 11). The clock runs on, up to 10s, while timers are due, and
      // each target is looked at every 100ms; it stops once every target has replayed twice.
      const replays: { selector: string; message: string; warn?: boolean }[] = [];
      const due = forever || o.selectors.length === 0 ? null : await timeline.pending().catch(() => null);
      if (due && due.timers > 0) {
        await page
          .evaluate(
            (sels) => sels.forEach((s) => document.querySelector(s)?.setAttribute("data-vlmkit-rest", "")),
            o.selectors,
          )
          .catch(() => {});
        const last = instants[instants.length - 1] ?? endMs;
        const seen = o.selectors.map(() => ({
          replaced: [] as number[],
          restarted: [] as number[],
          names: new Set<string>(),
          // Still playing from the step before: one run seen twice is not two starts.
          wasActive: false,
        }));
        for (let t = last + 100; t <= last + 10_000; t += 100) {
          if (seen.every((s) => s.replaced.length + s.restarted.length >= 2)) break;
          // Every 1s, whether anything is still due: a page whose timers are spent has said all.
          if ((t - last) % 1000 < 100) {
            const left = await timeline.pending().catch(() => null);
            if (left && left.timers === 0) break;
          }
          await timeline.at(t);
          const now = await page
            .evaluate(
              (sels) =>
                sels.map((s) => {
                  const el = document.querySelector(s);
                  if (!el) return null;
                  const active = el
                    .getAnimations()
                    .filter((a) => {
                      const c = a.effect?.getComputedTiming();
                      if (!c || Number(c.iterations) === Infinity || c.localTime === null) return false;
                      // In its active phase: a fill holds an ended one's progress at 1, which is not playing.
                      const local = Number(c.localTime) - Number(c.delay ?? 0);
                      return local >= 0 && local < Number(c.activeDuration);
                    })
                    .map(
                      (a) =>
                        (a as CSSAnimation).animationName || (a as CSSTransition).transitionProperty || "an animation",
                    );
                  const fresh = !el.hasAttribute("data-vlmkit-rest");
                  el.setAttribute("data-vlmkit-rest", "");
                  return { fresh, active };
                }),
              o.selectors,
            )
            .catch(() => []);
          now.forEach((x, i) => {
            if (!x) return;
            const s = seen[i]!;
            if (x.fresh && x.active.length > 0) s.replaced.push(t);
            else if (x.active.length > 0 && !s.wasActive) s.restarted.push(t);
            s.wasActive = x.active.length > 0;
            x.active.forEach((n) => s.names.add(n));
          });
        }
        o.selectors.forEach((sel, i) => {
          const s = seen[i]!;
          const when = (ts: number[]) =>
            ts
              .slice(0, 3)
              .map((x) => `${Math.round(x)}ms`)
              .join(", ") + (ts.length > 3 ? ", …" : "");
          const names = [...s.names].map((n) => `\`${n}\``).join(", ");
          if (s.replaced.length > 0) {
            replays.push({
              selector: sel,
              message: `${sel} after it came to rest: the page replaced it with a new element by ${when(s.replaced)} (a re-render: innerHTML, a framework re-keying the node), and the new one plays ${names} again each time. Update what it shows (textContent, an attribute) instead of re-creating it`,
            });
          } else if (s.restarted.length > 0) {
            replays.push({
              warn: true,
              selector: sel,
              message: `${sel} after it came to rest: ${names} began again at ${when(s.restarted)} (a class toggled on a timer). If it should play once, nothing should start it again`,
            });
          }
        });
      }
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
        ...(layoutMovers.length > 0 ? { layoutMovers } : {}),
        ...(seams.length > 0 ? { seams } : {}),
        ...(replays.length > 0 ? { replays } : {}),
        ...(forever ? { forever: true } : {}),
        ...(interrupt ? { interrupt } : {}),
        ...(scrollYs.length > 1 && Math.max(...scrollYs) - Math.min(...scrollYs) >= 1
          ? { scrolled: { from: scrollYs[0]!, to: scrollYs[scrollYs.length - 1]! } }
          : {}),
      };
    } finally {
      await page.close();
    }
  });
}

/**
 * After an action that cut into a motion: did each target jump the moment it landed? Compared
 * with how far it moves between any two frames after, a jump to its other end is a new motion
 * starting from its own first keyframe instead of from where the interrupted one had got to —
 * the menu of round 9 went from 49% open to fully open on its second click.
 */
export function interruptJumps(
  captured: Pick<Captured, "interrupt" | "frames" | "endMs">,
  selectors: readonly string[],
): { selector: string; message: string }[] {
  const it = captured.interrupt;
  if (!it) return [];
  const motion = captured.frames.filter((f) => f.atMs <= captured.endMs);
  const out: { selector: string; message: string }[] = [];
  selectors.forEach((sel, i) => {
    const a = it.before[i];
    const doms = motion.map((f) => f.dom?.[i]).filter((d): d is MotionDom => !!d);
    const b = doms[0];
    if (!a || !b) return;
    const geo = (x: MotionDom, y: MotionDom) =>
      Math.max(
        Math.abs(x.box.width - y.box.width),
        Math.abs(x.box.height - y.box.height),
        Math.abs(x.box.x + x.box.width / 2 - (y.box.x + y.box.width / 2)),
        Math.abs(x.box.y + x.box.height / 2 - (y.box.y + y.box.height / 2)),
      );
    let step = 0;
    let opStep = 0;
    for (let k = 1; k < doms.length; k++) {
      step = Math.max(step, geo(doms[k - 1]!, doms[k]!));
      opStep = Math.max(opStep, Math.abs(doms[k - 1]!.opacity - doms[k]!.opacity));
    }
    const jump = geo(a, b);
    const opJump = Math.abs(a.opacity - b.opacity);
    if ((jump >= 8 && jump > 2 * step) || (opJump >= 0.2 && opJump > 2 * opStep)) {
      out.push({
        selector: sel,
        message: `${sel} jumps the moment ${it.action} lands at ${Math.round(it.atMs)}ms: ${Math.round(a.box.width)}x${Math.round(a.box.height)}${opJump >= 0.05 ? ` at opacity ${a.opacity.toFixed(2)}` : ""} → ${Math.round(b.box.width)}x${Math.round(b.box.height)}${opJump >= 0.05 ? ` at ${b.opacity.toFixed(2)}` : ""} within a frame, more than it moves in any frame after (${Math.round(step)}px). Its new motion starts from its own first keyframe, not from where the one it cut into had got to: a @keyframes animation always starts from its \`from\`, a transition reverses from where it is — move the two states into one transition`,
      });
    }
  });
  return out;
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
  // Near a page's end the scroll is clamped, and it moves as a reveal's transform shrinks the
  // overflow: a 16px rise read "travels 1px" with nothing to say why (round 8).
  if (captured.scrolled)
    lines.push(
      `  the page scrolled from y=${Math.round(captured.scrolled.from)} to y=${Math.round(captured.scrolled.to)} while the frames were shot (at the end of a page the scroll is clamped, and follows its overflow): positions are on screen, so a path moved with the scroll reads shorter`,
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
        ? ` in its ${e.channel === "drawn" ? "drawn length" : e.channel}${e.channel === "opacity" && fadeOwner ? ` (${fadeOwner}'s fade: its own opacity does not change)` : ""}`
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
        `  target ${JSON.stringify(t.target)}${begins(t)}: travels ${Math.round(t.travelPx)}px${t.segments[0]?.direction ? ` ${t.segments[0].direction.way}wards` : ""} over the frames measured${
          // A gear orbiting back to its start read "travels 0px" (round 12).
          t.excursionPx !== undefined && t.excursionPx >= Math.max(4, t.travelPx * 2)
            ? ` (ending where it began; ${Math.round(t.excursionPx)}px away at most, between)`
            : ""
        }${
          t.turn
            ? t.turn.in3d
              ? // In 3D the turn is its face's angle, 0 facing you to 180 turned over: no way round.
                `, turns over ${Math.round(Math.abs(t.turn.deg))}° in 3D`
              : `, turns ${t.turn.deg > 0 ? "clockwise" : "counterclockwise"} ${Math.round(Math.abs(t.turn.deg))}° (${Math.round(Math.abs(t.turn.perSecond))}°/s${Math.abs(t.turn.perSecond) >= 1 ? `, a turn every ${Math.round(360000 / Math.abs(t.turn.perSecond))}ms` : ""})`
            : ""
        }, ${fitText(t.easing, broken)}${t.segments[0] ? grows(t.segments[0]) : ""}`,
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

/**
 * A target whose animation runs on a scroll timeline (`animation-timeline: scroll()` / `view()`)
 * is judged against the scroll, not the clock: the scroller is swept 0..100% and back to 50%, and
 * each target's animation progress and its box, scale, opacity and colour are read at each step.
 * On the clock such a bar read "snapped 0x4 → 1126x4 in one frame" for a scroll jump (round 12).
 * Null when no target is driven by a scroll timeline: the caller samples time as before.
 */
async function scrollSweep(o: MotionCliOptions): Promise<number | null> {
  const { withBrowser } = await import("@mizchi/vlmkit-core/browser-launch.ts");
  const { sourceToUrl } = await import("@mizchi/vlmkit-core/page-open.ts");
  const { captureStable, frameWriter, frameSourceFacts } =
    await import("@mizchi/vlmkit-animation-eval/frames-capture.ts");
  const url = sourceToUrl(o.source);
  return withBrowser(async (browser) => {
    const page = await browser.newPage({ viewport: o.viewport, deviceScaleFactor: 1 });
    try {
      await page.goto(url, { waitUntil: "load" });
      const driven = await page.evaluate((sels) => {
        const out: { i: number; name: string; timeline: string; root: boolean }[] = [];
        for (const a of document.getAnimations()) {
          const tl = a.timeline as (AnimationTimeline & { source?: Element | null }) | null;
          if (!tl || tl instanceof DocumentTimeline) continue;
          const el = (a.effect as KeyframeEffect | null)?.target as Element | null;
          if (!el) continue;
          const i = sels.findIndex((s) => {
            const t = document.querySelector(s);
            return !!t && (t === el || t.contains(el) || el.contains(t));
          });
          if (i < 0) continue;
          const src = tl.source ?? null;
          const root =
            !src || src === document.scrollingElement || src === document.documentElement || src === document.body;
          if (!root) src!.setAttribute("data-vlmkit-scroller", "");
          out.push({
            i,
            name: (a as CSSAnimation).animationName || "an animation",
            timeline: getComputedStyle(el).animationTimeline,
            root,
          });
        }
        return out;
      }, o.selectors);
      if (driven.length === 0) return null;
      const root = driven.every((d) => d.root);
      const range = await page.evaluate((root) => {
        const sc = root ? document.scrollingElement! : document.querySelector("[data-vlmkit-scroller]")!;
        return sc.scrollHeight - sc.clientHeight;
      }, root);
      const steps = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 0.5, 0];
      const writer = await frameWriter(resolve(o.frames), {
        tool: "inspect motion",
        url,
        viewport: o.viewport,
        ...(await frameSourceFacts(page)),
        clock: "wall",
      });
      const rows: { f: number; dom: (MotionDom | null)[]; progress: (number | null)[] }[] = [];
      for (const [k, f] of steps.entries()) {
        await page.evaluate(
          ([root, y]) => {
            const sc = root ? document.scrollingElement! : document.querySelector("[data-vlmkit-scroller]")!;
            sc.scrollTop = y as number;
          },
          [root, Math.round(f * range)] as const,
        );
        await page.evaluate(
          () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
        );
        const dom = await measureTargets(page, o.selectors);
        const progress = await page.evaluate(
          (sels) =>
            sels.map((s) => {
              const t = document.querySelector(s);
              if (!t) return null;
              const a = [...document.getAnimations()].find((x) => {
                const el = (x.effect as KeyframeEffect | null)?.target as Element | null;
                return (
                  !!el && !(x.timeline instanceof DocumentTimeline) && (el === t || t.contains(el) || el.contains(t))
                );
              });
              const p = a?.effect?.getComputedTiming().progress;
              return typeof p === "number" ? p : null;
            }),
          o.selectors,
        );
        const { png, stable } = await captureStable(page);
        await writer.add(png, { atMs: k * 100, stable, label: `scroll ${Math.round(f * 100)}%` });
        rows.push({ f, dom, progress });
      }
      const written = await writer.finish();
      let fails = 0;
      const lines = [
        `inspect motion: ${o.source} — driven by the scroll: ${steps.length} frames, the ${root ? "page" : "scroller"} swept 0..100% (${range}px) and back to 50% (${written.manifest})`,
      ];
      o.selectors.forEach((sel, i) => {
        const d = driven.find((x) => x.i === i);
        if (!d) {
          lines.push(
            `  target "${sel}": no scroll-driven animation on it (judged by the clock, run without the others)`,
          );
          return;
        }
        const fwd = rows.slice(0, 11);
        const at = (f: number) => fwd.find((r) => Math.abs(r.f - f) < 1e-9)!;
        const pr = (r: (typeof rows)[number]) => r.progress[i];
        const fmt = (v: number | null) => (v === null ? "–" : v.toFixed(2));
        const first = fwd[0]!.dom[i];
        const last = fwd[fwd.length - 1]!.dom[i];
        const changes: string[] = [];
        if (first && last) {
          const sx = (x: MotionDom) => x.scaleX ?? x.scale;
          const sy = (x: MotionDom) => x.scaleY ?? x.scale;
          if (Math.abs(sx(first) - sx(last)) > 0.02)
            changes.push(`scaleX ${sx(first).toFixed(2)} → ${sx(last).toFixed(2)}`);
          if (Math.abs(sy(first) - sy(last)) > 0.02 && Math.abs(sy(first) - sx(first)) > 1e-6)
            changes.push(`scaleY ${sy(first).toFixed(2)} → ${sy(last).toFixed(2)}`);
          if (Math.abs(first.opacity - last.opacity) > 0.05)
            changes.push(`opacity ${first.opacity.toFixed(2)} → ${last.opacity.toFixed(2)}`);
          const cx = (x: MotionDom) => [x.box.x + x.box.width / 2, x.box.y + x.box.height / 2] as const;
          const [ax, ay] = cx(first);
          const [bx, by] = cx(last);
          if (Math.hypot(bx - ax, by - ay) >= 2)
            changes.push(`centre (${Math.round(ax)},${Math.round(ay)}) → (${Math.round(bx)},${Math.round(by)})`);
          const pa = first.paint ?? [];
          const pb = last.paint ?? [];
          if (pa.length === pb.length && pa.some((v, k) => Math.abs(v - pb[k]!) >= 8)) changes.push("its colour");
        }
        lines.push(
          `  target "${sel}" follows the scroll (\`${d.name}\` on ${d.timeline}): progress ${[0, 0.25, 0.5, 0.75, 1].map((f) => `${fmt(pr(at(f === 0.25 ? 0.2 : f === 0.75 ? 0.8 : f)))} at ${Math.round((f === 0.25 ? 0.2 : f === 0.75 ? 0.8 : f) * 100)}%`).join(", ")}; back at 50% ${fmt(pr(rows[11]!))}, at 0% ${fmt(pr(rows[12]!))}${changes.length > 0 ? `; ${changes.join(", ")}` : ""}`,
        );
        const ps = fwd.map(pr).filter((v): v is number => v !== null);
        const monotonic =
          ps.every((v, k) => k === 0 || v >= ps[k - 1]! - 1e-3) ||
          ps.every((v, k) => k === 0 || v <= ps[k - 1]! + 1e-3);
        const back = pr(rows[11]!);
        const mid = pr(at(0.5));
        if (changes.length === 0) {
          fails++;
          lines.push(
            `    FAIL scroll-static: its animation runs with the scroll, but nothing of it changes on screen from the top to the end (box, scale, opacity, colour)`,
          );
        } else if (!monotonic || (back !== null && mid !== null && Math.abs(back - mid) > 0.02)) {
          fails++;
          lines.push(
            `    FAIL scroll-mismatch: its progress does not follow the scroll one way (${ps.map((v) => v.toFixed(2)).join(" ")}), or differs at 50% on the way back (${fmt(back)} against ${fmt(mid)})`,
          );
        }
      });
      if ([...argvExpects(o)].length > 0)
        lines.push(
          `  --expect-* are times and curves of motion in time; a scroll-driven animation is judged against the scroll here`,
        );
      lines.push(
        fails === 0
          ? "  no fail; measured from the page, no model asked"
          : `  ${fails} fail; measured from the page, no model asked`,
      );
      console.log(lines.join("\n"));
      return fails === 0 ? 0 : 1;
    } finally {
      await page.close();
    }
  });
}

/** The --expect-* the options carry, by name. */
function* argvExpects(o: MotionCliOptions): Generator<string> {
  if (o.expectEasing) yield "easing";
  if (o.expectOrigin) yield "origin";
  if (o.expectStartMs) yield "start";
  if (o.expectDurationMs) yield "duration";
  if (o.expectIterations) yield "iterations";
  if (o.expectDirection) yield "direction";
  if (o.expectStill) yield "still";
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
  // A target on a scroll timeline is judged against the scroll (round 12).
  if (
    !/(^|\/)frames\.json$/.test(o.source) &&
    !o.jev &&
    o.selectors.length > 0 &&
    o.endMs === undefined &&
    o.actions.every((a) => a.kind === "scroll")
  ) {
    const swept = await scrollSweep(o);
    if (swept !== null) return swept;
  }
  let captured: Captured;
  try {
    captured = /(^|\/)frames\.json$/.test(o.source) ? await readFrames(o) : await captureMotion(o);
  } catch (e) {
    if (e instanceof SnappedError) {
      if (e.changed.length === 0) {
        console.error(
          `error: nothing animated after ${o.actions.map(describeAction).join(", ")}, and no --selector target changed: check the action reaches the control (and that --selector names what it changes)`,
        );
        return 2;
      }
      console.log(
        `inspect motion: ${o.source} — after ${o.actions.map(describeAction).join(", ")}, no animation or transition started`,
      );
      const last = o.actions[o.actions.length - 1]!;
      // The pointer leaving: the transition in force is the element's own, not the :hover rule's.
      const pointer =
        last.kind === "leave" ||
        (last.kind === "hover" && o.actions.some((a, k) => k < o.actions.length - 1 && a.kind === "hover"))
          ? "a transition declared only in the :hover rule runs on the way in and not on the way out — declare it on the element itself; "
          : "";
      for (const [k, c] of e.changed.entries()) {
        const cause = e.causes[k];
        console.log(
          cause
            ? `    FAIL snapped: ${c} in one frame: ${cause}`
            : `    FAIL snapped: ${c} in one frame. If it should animate, its transition never starts: ${pointer}a transition to or from an intrinsic size (height: auto) does not run without interpolate-size: allow-keywords (Chromium only so far; grid-template-rows 0fr → 1fr runs in every engine); a misspelt transition-property and a property the transition does not list are the other usual causes`,
        );
      }
      console.log(`  no frames written: nothing animated to shoot`);
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
    ...(o.exitSelectors.length > 0 ? { exitsFor: o.selectors.map((sel) => o.exitSelectors.includes(sel)) } : {}),
    jev: o.jev,
    ...motionEasingOptions(o.expectEasing),
    ...(o.expectOrigin ? { expectOrigin: o.expectOrigin.length === 1 ? o.expectOrigin[0]! : o.expectOrigin } : {}),
    ...(o.expectStartMs ? { expectStartMs: o.expectStartMs } : {}),
    ...(o.expectStaggerMs !== undefined ? { expectStaggerMs: o.expectStaggerMs } : {}),
    ...(o.expectDurationMs ? { expectDurationMs: o.expectDurationMs } : {}),
    ...(o.expectIterations ? { expectIterations: o.expectIterations } : {}),
    ...(o.expectDirection ? { expectDirection: o.expectDirection } : {}),
    ...(o.expectStill ? { expectStill: true } : {}),
    ...(o.stillSelectors.length > 0
      ? { expectStillFor: o.selectors.map((sel) => o.stillSelectors.includes(sel)) }
      : {}),
    ...(captured.layoutMovers ? { layoutMovers: captured.layoutMovers } : {}),
  });
  const jumps = [
    ...interruptJumps(captured, o.selectors),
    ...(captured.seams ?? []).map((s) => ({ ...s, rule: "loop-seam" })),
    ...(captured.replays ?? []).filter((s) => !s.warn).map((s) => ({ ...s, rule: "replayed" })),
  ];
  const warnsAfter = (captured.replays ?? []).filter((s) => s.warn).map((s) => ({ ...s, rule: "replayed" }));
  const json = {
    source: o.source,
    ...(jumps.length > 0 ? { interruptJumps: jumps } : {}),
    ...(warnsAfter.length > 0 ? { warnings: warnsAfter } : {}),
    frames: captured.manifest,
    startMs: captured.startMs,
    endMs: captured.endMs,
    segments: captured.segments,
    passed: r.passed && jumps.length === 0,
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
  else {
    const lines = formatMotionReport(o.source, captured, r, o.forbid).split("\n");
    if (jumps.length > 0 || warnsAfter.length > 0) {
      // Into the report, above its tally, and counted in it: "no fail" printed above a FAIL line.
      const at = lines.findIndex((l) => /^ {2}(no fail|\d+ fail)/.test(l));
      const extra = [
        ...jumps.map((j) => `    FAIL ${"rule" in j ? j.rule : "interrupt-jump"}: ${j.message}`),
        ...warnsAfter.map((j) => `    warn ${j.rule}: ${j.message}`),
      ];
      if (at < 0) lines.push(...extra);
      else {
        const tally = lines[at]!;
        const fails = /^ {2}no fail/.test(tally) ? 0 : Number(/^ {2}(\d+) fail/.exec(tally)![1]);
        if (jumps.length > 0) lines[at] = tally.replace(/^ {2}(no fail|\d+ fail)/, `  ${fails + jumps.length} fail`);
        lines.splice(at, 0, ...extra);
      }
    }
    // A pass said nothing of what was asked: an agent could not tell an expectation met from one
    // never checked (round 11). Each flag given, and whether a line above failed it.
    const asked: string[] = [];
    for (let k = 0; k < argv.length; k++) {
      if (!argv[k]!.startsWith("--expect-")) continue;
      asked.push(argv[k + 1] !== undefined && !argv[k + 1]!.startsWith("--") ? `${argv[k]} ${argv[k + 1]}` : argv[k]!);
    }
    if (asked.length > 0) {
      const failed = new Set(
        r.targets.flatMap((t) => t.findings.filter((f) => f.severity === "fail").map((f) => f.rule as string)),
      );
      const ruleOf = (flag: string) =>
        /easing/.test(flag)
          ? "easing-mismatch"
          : /origin/.test(flag)
            ? "origin-mismatch"
            : /start|stagger/.test(flag)
              ? "start-mismatch"
              : /duration/.test(flag)
                ? "duration-mismatch"
                : /iterations/.test(flag)
                  ? "iterations-mismatch"
                  : /direction/.test(flag)
                    ? "direction-mismatch"
                    : "still-mismatch";
      const held = asked.filter((f) => !failed.has(ruleOf(f)));
      const at = lines.findIndex((l) => /^ {2}(no fail|\d+ fail)/.test(l));
      if (held.length > 0) lines.splice(at < 0 ? lines.length : at, 0, `  held: ${held.join(", ")}`);
    }
    console.log(`${lines.join("\n")}\n  report: ${saved}`);
  }
  return r.passed && jumps.length === 0 ? 0 : 1;
}

if (isCliEntry(import.meta.url, "motion")) {
  runMotionCli(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch(handleCliError);
}
