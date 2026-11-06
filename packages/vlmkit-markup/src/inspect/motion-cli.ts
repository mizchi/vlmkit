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
import { mkdir, readFile, writeFile } from "node:fs/promises";
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
  type OriginPoint,
} from "@mizchi/vlmkit-judge/motion-path.ts";
import { frameTimeMs, parseFramesManifest, parseInstants } from "@mizchi/vlmkit-judge/frames.ts";
import { parseTrackRegion, type TrackBox } from "@mizchi/vlmkit-judge/pixel-track.ts";
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
    // An element's whole transform: the individual translate, rotate and scale properties, then
    // transform, as CSS composes them. A spinner turned by the `rotate` property read "does not
    // turn", and a card scaled by `scale` read scale 1 (held-out set, 2026-11-02).
    const fullTransform = (e: Element): DOMMatrixReadOnly | null => {
      const cs = getComputedStyle(e);
      let m = new DOMMatrix();
      let any = false;
      const px = (v: string, size: number) => (v.endsWith("%") ? (parseFloat(v) / 100) * size : parseFloat(v) || 0);
      if (cs.translate && cs.translate !== "none") {
        const box = (e as HTMLElement).offsetWidth !== undefined ? e.getBoundingClientRect() : null;
        const [x = "0", y = "0", z = "0"] = cs.translate.split(/\s+/);
        m = m.translate(
          px(x, (e as HTMLElement).offsetWidth ?? box?.width ?? 0),
          px(y, (e as HTMLElement).offsetHeight ?? box?.height ?? 0),
          parseFloat(z) || 0,
        );
        any = true;
      }
      if (cs.rotate && cs.rotate !== "none") {
        const parts = cs.rotate.split(/\s+/);
        const angle = parts[parts.length - 1]!;
        const deg = angle.endsWith("rad")
          ? (parseFloat(angle) * 180) / Math.PI
          : angle.endsWith("turn")
            ? parseFloat(angle) * 360
            : parseFloat(angle);
        const axis = parts.slice(0, -1);
        const [ax, ay, az] =
          axis.length === 3 ? axis.map(Number) : axis[0] === "x" ? [1, 0, 0] : axis[0] === "y" ? [0, 1, 0] : [0, 0, 1];
        m = m.rotateAxisAngle(ax!, ay!, az!, deg);
        any = true;
      }
      if (cs.scale && cs.scale !== "none") {
        const [sx = "1", sy = sx, sz = "1"] = cs.scale.split(/\s+/);
        m = m.scale(parseFloat(sx), parseFloat(sy), parseFloat(sz));
        any = true;
      }
      if (cs.transform && cs.transform !== "none") {
        m = m.multiply(new DOMMatrix(cs.transform));
        any = true;
      }
      return any ? m : null;
    };
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
        const whole = fullTransform(el);
        let scale = 1;
        let scaleX = 1;
        let scaleY = 1;
        if (whole) {
          const m = whole;
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
        // One still running comes first: a card hovered after its entrance ended with a forwards
        // fill was judged by the entrance's 400ms, not the 150ms the hover ran (round 13).
        const owned = (timed ?? el).getAnimations();
        const live = owned.filter((a) => a.playState !== "finished");
        // A finished animation whose fill still holds what it animated: an animated value outranks
        // every rule, so a :hover transform under it never applies (round 13's cards).
        let heldByFill: string | undefined;
        for (const a of el.getAnimations()) {
          const fill = a.effect?.getComputedTiming().fill;
          if (a.playState !== "finished" || (fill !== "forwards" && fill !== "both")) continue;
          const kf = (a.effect as KeyframeEffect | null)?.getKeyframes?.() ?? [];
          const props = [
            ...new Set(
              kf.flatMap((k) =>
                Object.keys(k).filter((p) => !["offset", "easing", "composite", "computedOffset"].includes(p)),
              ),
            ),
          ];
          if (props.length === 0) continue;
          // Only a held property the element also transitions: that transition is the sign a hover
          // or class is meant to change it. A clip-path reveal filled forwards, with nothing else
          // setting clip-path, read "an animation ended with fill both and still holds clipPath"
          // beside its own correct rest (held-out set).
          const kebab = (p: string) => p.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
          const listed = getComputedStyle(el)
            .transitionProperty.split(",")
            .map((p) => p.trim());
          const durations = getComputedStyle(el)
            .transitionDuration.split(",")
            .map((d) => parseFloat(d) || 0);
          const contested = props.filter((p) =>
            listed.some((l, i) => (l === "all" || l === kebab(p)) && durations[i % durations.length]! > 0),
          );
          if (contested.length === 0) continue;
          props.splice(0, props.length, ...contested.map(kebab));
          const name = (a as CSSAnimation).animationName || "an animation";
          heldByFill = `\`${name}\` ended with animation-fill-mode: ${fill} and still holds ${props.join(", ")}: an animation's held value outranks every rule, so a :hover or class that sets ${props.length === 1 ? "it" : "them"} (and its transition) never applies — fill it backwards (it holds its from pose through its delay), or animate the separate translate / scale property`;
          break;
        }
        // Offsets animated on a box that is position: static do nothing: a notice meant to slide in
        // from the left animated `left` and only faded (round 14).
        let inertOffsets: string | undefined;
        if (getComputedStyle(el).position === "static")
          for (const a of el.getAnimations()) {
            const kf = (a.effect as KeyframeEffect | null)?.getKeyframes?.() ?? [];
            const props = [
              ...new Set(kf.flatMap((k) => Object.keys(k).filter((p) => /^(top|left|right|bottom|inset)/.test(p)))),
            ];
            const tp = (a as CSSTransition).transitionProperty;
            if (tp && /^(top|left|right|bottom|inset)/.test(tp)) props.push(tp);
            if (props.length === 0) continue;
            const name = (a as CSSAnimation).animationName
              ? `\`${(a as CSSAnimation).animationName}\``
              : "its transition";
            inertOffsets = `${name} animates ${props.join(", ")}, but the element is position: static, where ${props.length === 1 ? "that offset does" : "offsets do"} nothing — give it position: relative, or animate transform: translate() (or translate) instead`;
            break;
          }
        for (const a of live.length > 0 ? live : owned) {
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
            const tf = fullTransform(n);
            if (tf) M = new DOMMatrix(tf.toString()).multiply(M);
          }
          return M.m33;
        };
        const m33 = facing(el);
        // How far it is turned: its normal's angle in 3D, else its own 2D rotation.
        const turn = (e: Element): { turnDeg?: number } => {
          // Any 3D transform up the tree: the angle of its normal, 0 facing you, 180 turned over.
          let threeD = false;
          for (let n: Element | null = e; n && n !== document.documentElement && !threeD; n = n.parentElement) {
            const tf = fullTransform(n);
            if (tf && !tf.is2D) threeD = true;
          }
          if (threeD) return { turnDeg: (Math.acos(Math.max(-1, Math.min(1, m33))) * 180) / Math.PI };
          const m = fullTransform(e);
          if (!m) return {};
          const deg = (Math.atan2(m.b, m.a) * 180) / Math.PI;
          return Math.abs(deg) > 0.01 ? { turnDeg: deg } : {};
        };
        // The point of its own box a 2D turn keeps still: the fixed point of its transform about its
        // transform-origin, as a share of its laid-out box. A bell meant to swing from its top had no
        // way to say so (--expect-origin read only a scale, authoring v1).
        // How many lines its text runs to: a button widening into "Added to cart" wrapped it onto a
        // second line half way, inside a fixed height that hid the wrap from its box (authoring v2).
        const textLines = (e: Element): { lines?: number; textClipped?: boolean } => {
          const walker = document.createTreeWalker(e, NodeFilter.SHOW_TEXT);
          // Rows of each text node, the most of any: a label wrapped onto two rows is two lines, and a
          // taller "+" beside it (overlapping both rows) is not a third.
          let lines = 0;
          let seen = 0;
          for (let node = walker.nextNode(); node && seen < 40; node = walker.nextNode()) {
            if (!(node.nodeValue ?? "").trim()) continue;
            seen++;
            const range = document.createRange();
            range.selectNodeContents(node);
            const rows: [number, number][] = [];
            for (const q of range.getClientRects()) {
              if (!(q.width > 1 && q.height > 1)) continue;
              const row = rows.find(
                ([t, b]) => Math.min(b, q.bottom) - Math.max(t, q.top) >= 0.5 * Math.min(b - t, q.height),
              );
              if (!row) rows.push([q.top, q.bottom]);
            }
            lines = Math.max(lines, rows.length);
          }
          if (lines === 0) return {};
          // Lines it cuts off itself: a wrapped label inside a fixed height with overflow: hidden.
          const cs = getComputedStyle(e);
          const he = e as HTMLElement;
          const clips = cs.overflowY !== "visible" && he.scrollHeight > he.clientHeight + 1;
          return { lines, ...(clips ? { textClipped: true } : {}) };
        };
        const pivotOf = (e: Element): { pivot?: { fx: number; fy: number; ux: number; uy: number } } => {
          const m = fullTransform(e);
          if (!m || !m.is2D) return {};
          const deg = (Math.atan2(m.b, m.a) * 180) / Math.PI;
          if (Math.abs(deg) < 2) return {};
          const cs = getComputedStyle(e);
          const [ox = 0, oy = 0] = cs.transformOrigin.split(/\s+/).map(parseFloat);
          // Its box, and the origin in the same coordinates. On an SVG element both are user space:
          // the origin is from the viewBox's corner (transform-box: view-box, the default) or from
          // its own bounding box (fill-box), and a <line> has a box with no height (a gauge needle
          // read no pivot at all, authoring v2).
          let bx = 0,
            by = 0,
            w: number,
            h: number,
            orx = ox,
            ory = oy;
          if (e instanceof SVGGraphicsElement && !(e instanceof SVGSVGElement)) {
            const bb = e.getBBox();
            ({ x: bx, y: by, width: w, height: h } = bb);
            if (cs.transformBox === "fill-box") ((orx = bb.x + ox), (ory = bb.y + oy));
          } else {
            const he = e as HTMLElement;
            // Its laid-out box: an outer <svg> has no offsetWidth.
            w = he.offsetWidth ?? e.clientWidth;
            h = he.offsetHeight ?? e.clientHeight;
          }
          if (!(w > 0 || h > 0)) return {};
          // (I - A) y = t, where screen(p) = o + A (p - o) + t; the pivot is o + y.
          const a11 = 1 - m.a,
            a12 = -m.c,
            a21 = -m.b,
            a22 = 1 - m.d;
          const det = a11 * a22 - a12 * a21;
          if (Math.abs(det) < 1e-6) return {};
          const yx = (m.e * a22 - a12 * m.f) / det,
            yy = (a11 * m.f - a21 * m.e) / det;
          const px = orx + yx - bx,
            py = ory + yy - by;
          // Along an axis the box has no extent, a pivot on it is its middle.
          const frac = (v: number, size: number) => (size > 0 ? v / size : Math.abs(v) < 1 ? 0.5 : v > 0 ? 9 : -9);
          // And in its own units, as transform-origin is written: an SVG element's user space (the
          // viewBox's), else px from its box's corner.
          const svgOwn = e instanceof SVGGraphicsElement && !(e instanceof SVGSVGElement);
          return {
            pivot: {
              fx: frac(px, w),
              fy: frac(py, h),
              ux: svgOwn ? orx + yx : px,
              uy: svgOwn ? ory + yy : py,
            },
          };
        };
        // Its angle as drawn, through every transform up the tree, and the nearest ancestor that turns:
        // a label counter-rotating at 5s inside a dial turning at 4s read only its own turn, 72°/s,
        // while on screen it drifted 18°/s (round 18).
        let screenDeg: number | undefined;
        let turnedBy: string | undefined;
        {
          let M = new DOMMatrix();
          let flat = true;
          for (let n: Element | null = el; n && n !== document.documentElement; n = n.parentElement) {
            const tf = fullTransform(n);
            if (!tf) continue;
            if (!tf.is2D) flat = false;
            M = new DOMMatrix(tf.toString()).multiply(M);
            if (n !== el && !turnedBy && Math.abs(Math.atan2(tf.b, tf.a)) > 1e-4 && n.getAnimations().length > 0)
              turnedBy =
                n.tagName.toLowerCase() +
                (n.id
                  ? `#${n.id}`
                  : typeof n.className === "string" && n.className.trim()
                    ? `.${n.className.trim().split(/\s+/)[0]}`
                    : "");
          }
          if (flat) screenDeg = (Math.atan2(M.b, M.a) * 180) / Math.PI;
        }
        // A preserve-3d container draws its faces in 3D, each by its own facing: turned over, its back
        // is what a face that faces you (the answer) shows, not it mirrored. Only a face turned away
        // whose backface is visible is drawn backwards (round 16: a correct flip card read mirrored).
        const backHidden =
          getComputedStyle(el).backfaceVisibility === "hidden" ||
          (getComputedStyle(el).transformStyle === "preserve-3d" &&
            ![...el.querySelectorAll("*")].some((c) => {
              if (facing(c) >= -0.01) return false;
              const cs = getComputedStyle(c);
              if (cs.backfaceVisibility === "hidden") return false;
              // Hidden by an ancestor between it and the target.
              for (let n = c.parentElement; n && n !== el; n = n.parentElement)
                if (getComputedStyle(n).backfaceVisibility === "hidden" && facing(n) < -0.01) return false;
              return true;
            }));
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
        // Where its gradients' stops and angles are, on the same 0-255 scale (100% or a turn is 255):
        // a ring filled by a conic stop changes no colour, and read "travels 0px … target-static"
        // on its repair (round 13).
        const stops: number[] = [];
        if (/gradient\(/.test(own.backgroundImage))
          for (const m of own.backgroundImage
            .replace(/rgba?\([^)]*\)/g, "")
            .matchAll(/(-?\d*\.?\d+(?:e[-+]?\d+)?)(%|deg|turn|rad|grad|px)/g)) {
            const v = Number(m[1]);
            const unit = m[2]!;
            stops.push(
              unit === "%"
                ? v * 2.55
                : unit === "deg"
                  ? (v * 255) / 360
                  : unit === "turn"
                    ? v * 255
                    : unit === "rad"
                      ? (v * 255) / (2 * Math.PI)
                      : unit === "grad"
                        ? (v * 255) / 400
                        : v,
            );
          }
        // A conic gradient's first arc, in degrees from its start: a ring filling clockwise grows it,
        // and --expect-direction clockwise read "it does not turn" (round 13).
        let sweepDeg: number | undefined;
        const conic = /conic-gradient\((?:from [^,]+, )?(?:at [^,]+, )?rgba?\([^)]*\) (-?\d*\.?\d+)(%|deg|turn)/.exec(
          own.backgroundImage,
        );
        if (conic) {
          const v = Number(conic[1]);
          sweepDeg = conic[2] === "%" ? v * 3.6 : conic[2] === "turn" ? v * 360 : v;
        }
        // Its own transform's translation: a card that slides while it straightens carries its
        // centre by that, not by turning about another point (round 14: turn-off-centre on a
        // correct fly-in).
        const ownTf = fullTransform(el);
        const shift = ownTf ? [ownTf.e, ownTf.f] : [0, 0];
        // Its clip-path's numbers (an inset's edges, a circle's radius), on paint's scale (100% is
        // 255): a wipe that reveals a card read "target-static" (held-out set).
        const clip: number[] = [];
        if (own.clipPath && own.clipPath !== "none")
          for (const m of own.clipPath.matchAll(/(-?\d*\.?\d+(?:e[-+]?\d+)?)(%|px)/g))
            clip.push(m[2] === "%" ? Number(m[1]) * 2.55 : Number(m[1]));
        // Its filter's numbers (a blur's radius in px, a brightness or opacity as a fraction x 255):
        // a card that comes into focus read only as a fade (round 15).
        const filterVals: number[] = [];
        if (own.filter && own.filter !== "none")
          for (const m of own.filter.matchAll(/([a-z-]+)\((-?\d*\.?\d+(?:e[-+]?\d+)?)(px|deg|%)?/g))
            filterVals.push(
              m[3] === "px"
                ? Number(m[2]) * 8
                : m[3] === "%"
                  ? Number(m[2]) * 2.55
                  : m[3] === "deg"
                    ? (Number(m[2]) * 255) / 360
                    : Number(m[2]) * 255,
            );
        // What its own finished animations leave behind: a filter its fill holds at rest (a blur
        // that never ends at 0), and a @keyframes name more than one rule defines (round 15).
        let heldFilter: string | undefined;
        let dupKeyframes: string | undefined;
        let kfEasing: string | undefined;
        const kfDefs = new Map<string, string[][]>();
        const walkKf = (rules: CSSRuleList) => {
          for (const r of [...rules]) {
            if (r instanceof CSSKeyframesRule) {
              const props = new Set<string>();
              for (const k of [...r.cssRules] as CSSKeyframeRule[])
                for (let i = 0; i < k.style.length; i++) props.add(k.style[i]!);
              kfDefs.set(r.name, [...(kfDefs.get(r.name) ?? []), [...props]]);
            } else if ("cssRules" in r) walkKf((r as CSSGroupingRule).cssRules);
          }
        };
        for (const sheet of [...document.styleSheets]) {
          try {
            walkKf(sheet.cssRules);
          } catch {}
        }
        for (const a of el.getAnimations()) {
          const name = (a as CSSAnimation).animationName;
          const defs = name ? kfDefs.get(name) : undefined;
          if (
            defs &&
            defs.length > 1 &&
            !dupKeyframes &&
            // Rules that animate the same properties are a redefinition, not a lost motion.
            new Set(defs.map((d) => [...d].sort().join(","))).size > 1
          )
            dupKeyframes = `\`${name}\` is defined by ${defs.length} @keyframes rules (${defs.map((d, i) => `#${i + 1} animates ${d.join(", ") || "nothing"}`).join("; ")}): the last one in the cascade wins, so the others never run — give each its own name`;
          const fill = a.effect?.getComputedTiming().fill;
          const kf = (a.effect as KeyframeEffect | null)?.getKeyframes?.() ?? [];
          const last = kf[kf.length - 1] as Record<string, unknown> | undefined;
          // Only a filter that changes the picture: blur(0) or brightness(1) at rest is the
          // element as it is.
          const changes = (f: string) =>
            [...f.matchAll(/([a-z-]+)\(([^)]*)\)/g)].some(([, fn, arg]) => {
              const v = parseFloat(arg!);
              if (!Number.isFinite(v)) return true;
              if (/^(blur|grayscale|sepia|invert|hue-rotate)$/.test(fn!)) return Math.abs(v) > 1e-3;
              if (/^(brightness|contrast|saturate|opacity)$/.test(fn!))
                return Math.abs((arg!.includes("%") ? v / 100 : v) - 1) > 1e-3;
              return true;
            });
          if (
            a.playState === "finished" &&
            (fill === "forwards" || fill === "both") &&
            last?.filter &&
            last.filter !== "none" &&
            changes(String(last.filter)) &&
            !heldFilter
          )
            heldFilter = `\`${name || "an animation"}\` ends on filter: ${String(last.filter)} and its fill holds it at rest: a blur left there softens it for good (at 1x a blur under 1px can draw as no blur, so the frames may not show it) — end without the filter, or fill it backwards`;
          // A timing function written inside a keyframe overrides the element's own until the next
          // keyframe: a shared entrance's \`from { animation-timing-function: steps(5, end) }\` made a
          // panel hop in five, and read "jump … a gap between keyframes" (round 16-17).
          if (name && !kfEasing) {
            const names = own.animationName.split(/,\s*/);
            const fns = own.animationTimingFunction.split(/,\s*(?![^()]*\))/);
            const mine = fns[Math.max(0, names.indexOf(name)) % Math.max(1, fns.length)]?.trim() ?? "ease";
            const norm = (e: string) =>
              e.replace(/\s+/g, "").replace(/^cubic-bezier\(0\.42,0,0\.58,1\)$/, "ease-in-out");
            // Stepped only: per-keyframe curves are how a bounce is written on purpose.
            const stepFn = (e: string) => /^steps\(|^step-/.test(e);
            const odd = stepFn(mine)
              ? undefined
              : kf
                  .slice(0, -1)
                  .find((k) => typeof k.easing === "string" && stepFn(k.easing) && norm(k.easing) !== norm(mine));
            if (odd) {
              const at =
                odd.offset === 0
                  ? "from"
                  : odd.offset === 1
                    ? "to"
                    : `${Math.round(Number(odd.computedOffset ?? odd.offset) * 100)}%`;
              const stepped = /^steps\(|^step-/.test(String(odd.easing));
              kfEasing = `\`${name}\`'s ${at} keyframe sets animation-timing-function: ${odd.easing}, which overrides the element's own ${mine} from that keyframe to the next${stepped ? ": it moves in jumps, not a glide" : ""} — take the timing function out of the keyframe (a timing function inside @keyframes applies per keyframe and wins over the element's)`;
            }
          }
        }
        // One of its animations overridden by a later one on the same property: a toast's entrance
        // rose by transform, and the pulse after it in animation-name held scale(1) through its delay
        // with a both fill, so the toast only faded (round 18). The later one wins the property.
        let overriddenBy: string | undefined;
        {
          const css = el
            .getAnimations()
            .filter((a) => typeof CSSAnimation !== "undefined" && a instanceof CSSAnimation) as CSSAnimation[];
          const order = own.animationName.split(/,\s*/);
          css.sort((a, b) => order.indexOf(a.animationName) - order.indexOf(b.animationName));
          const propsOf = (a: Animation) =>
            new Set(
              (((a.effect as KeyframeEffect | null)?.getKeyframes?.() ?? []) as Record<string, unknown>[]).flatMap(
                (k) => Object.keys(k).filter((p) => !["offset", "computedOffset", "easing", "composite"].includes(p)),
              ),
            );
          for (let i = 0; i < css.length && !overriddenBy; i++) {
            const ti = css[i]!.effect?.getComputedTiming();
            if (!ti || ti.progress === null) continue;
            const pi = propsOf(css[i]!);
            for (let j = i + 1; j < css.length && !overriddenBy; j++) {
              const tj = css[j]!.effect?.getComputedTiming();
              if (!tj || tj.progress === null) continue;
              const comp = (css[j]!.effect as KeyframeEffect | null)?.composite ?? "replace";
              if (comp !== "replace") continue;
              const shared = [...propsOf(css[j]!)].filter((p) => pi.has(p) && p !== "opacity");
              if (shared.length === 0) continue;
              const inDelay = Number(tj.localTime) < Number(tj.delay ?? 0);
              overriddenBy = `\`${css[i]!.animationName}\` and \`${css[j]!.animationName}\` both animate ${shared.join(", ")}, and \`${css[j]!.animationName}\` comes later in animation-name, so its value wins${
                inDelay
                  ? `: its ${tj.fill} fill holds its first keyframe's ${shared[0]} through its ${Math.round(Number(tj.delay))}ms delay, which replaces \`${css[i]!.animationName}\`'s`
                  : `, replacing \`${css[i]!.animationName}\`'s`
              } — animate one with an individual property (translate / scale / rotate compose with transform)${inDelay ? ", or drop the backwards fill (animation-fill-mode: forwards or none)" : ""}`;
            }
          }
        }
        // Its own timing function when the CSS gives a curve no name: a drawer on the token
        // cubic-bezier(0, 0, 0.2, 1) read "follows ease (1.3x better than ease-out)" (round 18).
        let ownEasing: string | undefined;
        for (const a of el.getAnimations()) {
          const kf0 = ((a.effect as KeyframeEffect | null)?.getKeyframes?.() ?? [])[0] as
            | { easing?: string }
            | undefined;
          const e =
            typeof CSSAnimation !== "undefined" && a instanceof CSSAnimation
              ? kf0?.easing
              : a.effect?.getTiming().easing;
          if (e && /cubic-bezier|linear\(/.test(e)) {
            ownEasing = e;
            break;
          }
        }
        // Every run of its own, named: a toast with a 400ms entrance and a 1600ms pulse read only the
        // pulse, and --expect-duration 400ms failed on it (round 18).
        const runs = el
          .getAnimations()
          .map((a) => Number(a.effect?.getComputedTiming().duration))
          .filter((d) => Number.isFinite(d) && d > 0);
        // A duration token with no unit: `transition: transform var(--motion-fast)` with --motion-fast:
        // 180 is invalid at computed-value time, so the transition is none and the drawer snapped
        // (round 18, which read "height: auto … interpolate-size").
        let varDuration: string | undefined;
        if (!/[1-9]/.test(own.transitionDuration + own.animationDuration) || own.animationName === "none") {
          const found: string[] = [];
          const walkVar = (rules: CSSRuleList) => {
            for (const r of [...rules]) {
              if (found.length) return;
              if (r instanceof CSSStyleRule) {
                let hit = false;
                try {
                  hit = el.matches(r.selectorText);
                } catch {}
                if (!hit) continue;
                for (const prop of [
                  "transition",
                  "transition-duration",
                  "transition-delay",
                  "animation",
                  "animation-duration",
                  "animation-delay",
                ]) {
                  const text = r.style.getPropertyValue(prop);
                  for (const m of text.matchAll(/var\(\s*(--[\w-]+)/g)) {
                    // Inside calc() a unitless number is a multiplier (calc(var(--i) * 80ms)).
                    const before = text.slice(0, m.index);
                    const at = before.lastIndexOf("calc(");
                    if (at >= 0) {
                      let depth = 0;
                      for (const ch of before.slice(at + 4)) depth += ch === "(" ? 1 : ch === ")" ? -1 : 0;
                      if (depth > 0) continue;
                    }
                    const v = own.getPropertyValue(m[1]!).trim();
                    if (/^-?\d*\.?\d+$/.test(v))
                      found.push(
                        `${prop}: ${text} reads ${m[1]}, which is ${v} — a number with no unit, so the declaration is invalid at computed-value time and ${prop.startsWith("animation") ? "the animation" : "the transition"} is dropped: give the token a unit (${v}ms), or write calc(var(${m[1]}) * 1ms)`,
                      );
                  }
                }
              } else if ("cssRules" in r) walkVar((r as CSSGroupingRule).cssRules);
            }
          };
          for (const sheet of [...document.styleSheets]) {
            try {
              walkVar(sheet.cssRules);
            } catch {}
          }
          varDuration = found[0];
        }
        // Its shadow, as numbers (each shadow's RGBA, then its offsets, blur and spread in px): a
        // card whose shadow deepened on hover was confirmed only by eye (round 13).
        const shadow: number[] = [];
        if (own.boxShadow && own.boxShadow !== "none") {
          for (const m of own.boxShadow.matchAll(/rgba?\(([^)]*)\)/g)) {
            const c = m[1]!
              .split(/[\s,/]+/)
              .filter(Boolean)
              .map(Number);
            shadow.push(c[0] ?? 0, c[1] ?? 0, c[2] ?? 0, Math.round((c[3] ?? 1) * 255));
          }
          for (const m of own.boxShadow.replace(/rgba?\([^)]*\)/g, "").matchAll(/(-?\d*\.?\d+(?:e[-+]?\d+)?)px/g))
            shadow.push(Number(m[1]));
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
        // A cover it shows through: drawn at 60% opacity or less, or painting no more than that
        // itself (a translucent fill, no image, border or text of its own) — a dialog's wrapper over a
        // 50% backdrop dims the Delete button under it, it does not hide it (authoring v1).
        const seeThrough = (top: Element) => {
          let op = 1;
          for (let e: Element | null = top; e; e = e.parentElement) op *= Number(getComputedStyle(e).opacity);
          if (op <= 0.6) return true;
          const tcs = getComputedStyle(top);
          const m = /rgba?\(([^)]*)\)/.exec(tcs.backgroundColor);
          const parts = m ? m[1]!.split(/[\s,/]+/).filter(Boolean) : [];
          const alpha = parts.length === 4 ? Number(parts[3]) : tcs.backgroundColor === "transparent" ? 0 : 1;
          const ownText = [...top.childNodes].some((c) => c.nodeType === 3 && (c.textContent ?? "").trim());
          const bordered = ["top", "right", "bottom", "left"].some(
            (k) =>
              parseFloat(tcs.getPropertyValue(`border-${k}-width`)) > 0 &&
              tcs.getPropertyValue(`border-${k}-style`) !== "none",
          );
          return (
            !ownText &&
            !bordered &&
            tcs.backgroundImage === "none" &&
            alpha * op <= 0.6 &&
            !/^(IMG|VIDEO|CANVAS|svg|IFRAME|INPUT|BUTTON|TEXTAREA|SELECT)$/i.test(top.tagName)
          );
        };
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
            // Under a cover drawn at 60% or less: dimmed, still seen. A Delete button under its dialog's
            // 50% backdrop read hidden-at-once, "no exit is seen" (authoring v1).
            if (top && !top.contains(el) && seeThrough(top)) {
              inView++;
              hits++;
              continue;
            }
            inView++;
            missed ??= { x, y, top };
          }
        }
        el.removeAttribute("data-vlmkit-probe");
        // Leaving by a display transition (allow-discrete): Chromium draws it to the end but leaves
        // it out of hit-testing, so every point read "covered by main" and a correct close was
        // "never seen in any frame" (round 13's Share panel). What is on screen of it is seen.
        let exiting = false;
        for (let e: Element | null = el; e && !exiting; e = e.parentElement)
          exiting = e
            .getAnimations()
            .some((a) => (a as CSSTransition).transitionProperty === "display" && a.playState !== "finished");
        if (exiting && inView > 0) {
          hits = inView;
          missed = null;
        }
        // Every point outside its shape: nothing was seen covering it.
        // No area: every grid point is the same point, an ancestor's, which read "outside its shape"
        // and so "1.00 seen" for a usage bar that was a 0x0 inline <span> (round 17).
        const noArea = !geometry && shapes.length === 0 && (r.width < 0.5 || r.height < 0.5);
        const visible = opacity < 0.05 || noArea ? 0 : inView === 0 ? (outside > 0 ? 1 : 0) : hits / inView;
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
        if (noArea && opacity >= 0.05) {
          const cs0 = getComputedStyle(el);
          const sizes = [
            ...new Set(
              el
                .getAnimations()
                .flatMap((a) =>
                  ((a.effect as KeyframeEffect | null)?.getKeyframes?.() ?? []).flatMap((k) => Object.keys(k)),
                )
                .filter((p) =>
                  /^(width|height|min-width|min-height|max-width|max-height|inlineSize|blockSize)$/.test(p),
                ),
            ),
          ];
          hiddenBy = `it has no area (${Math.round(r.width)}x${Math.round(r.height)})${
            cs0.display === "inline" && !/^(img|video|canvas|svg|iframe|input)$/i.test(el.tagName)
              ? `: it is a <${el.tagName.toLowerCase()}> laid out inline (display: inline), where width and height do not apply${sizes.length > 0 ? `, so animating ${sizes.join(", ")} grows nothing` : ""} — give it display: block (or inline-block)`
              : sizes.length > 0
                ? `, though its animation sets ${sizes.join(", ")}`
                : ""
          }`;
        } else if (m33 < -0.01 && backHidden && visible < 0.5) {
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
              // Held paused by the page's CSS on a hiding keyframe: results held by a boot class a
              // script never removed read only "renders at opacity 0.00" (round 16).
              const held = a
                .getAnimations()
                .find((x) => x.playState === "paused" && /paused/.test(s.animationPlayState)) as
                | CSSAnimation
                | undefined;
              let heldBy = "";
              if (held) {
                const findRule = (rules: CSSRuleList) => {
                  for (const r of [...rules]) {
                    if (heldBy) return;
                    if (r instanceof CSSStyleRule && /paused/.test(r.style.animationPlayState)) {
                      try {
                        if (a.matches(r.selectorText)) heldBy = `${r.selectorText} { animation-play-state: paused }`;
                      } catch {}
                    } else if ("cssRules" in r) findRule((r as CSSGroupingRule).cssRules);
                  }
                };
                for (const sheet of [...document.styleSheets]) {
                  try {
                    findRule(sheet.cssRules);
                  } catch {}
                }
              }
              hiddenBy = `transparent: ${own} renders at opacity ${Number(s.opacity).toFixed(2)}${
                held
                  ? `, held paused at ${Math.round(Number(held.currentTime) || 0)}ms of its animation${held.animationName ? ` \`${held.animationName}\`` : ""} by ${heldBy || "animation-play-state: paused"}, which still matches at rest: whatever should release it (a class a script removes, a state the page reaches) has not`
                  : a === el
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
        // Its edges, which the 5x5 grid never reaches: a hovered card grown to 110% slid 9px under
        // the next card and read "1.00 seen" in every frame (round 16). Points 2px inside each
        // edge, between 10% and 90% of its length; an ancestor hit is its own shape's corner.
        let edgeCover: { share: number; message: string } | undefined;
        if (
          !hiddenBy &&
          opacity >= 0.05 &&
          !geometry &&
          shapes.length === 0 &&
          Math.abs(m33) > 0.999 &&
          r.width > 8 &&
          r.height > 8
        ) {
          el.setAttribute("data-vlmkit-probe", "");
          let n = 0;
          let covered = 0;
          let by: Element | null = null;
          const pts: [number, number][] = [];
          for (let k = 0; k < 12; k++) {
            const f = 0.1 + (0.8 * k) / 11;
            pts.push([r.x + 2, r.y + f * r.height], [r.right - 2, r.y + f * r.height]);
            pts.push([r.x + f * r.width, r.y + 2], [r.x + f * r.width, r.bottom - 2]);
          }
          // Inside its own rounded corners only: a 44px round button read "46% of its edge covered" by
          // the card behind its square box's corners (the small-model round).
          const cs = getComputedStyle(el);
          const ow = (el as HTMLElement).offsetWidth || r.width,
            oh = (el as HTMLElement).offsetHeight || r.height;
          const kx = r.width / ow,
            ky = r.height / oh;
          const radius = (v: string): [number, number] => {
            const [a = "0", b = a] = v.split(/\s+/);
            const len = (t: string, side: number) =>
              t.endsWith("%") ? (parseFloat(t) / 100) * side : parseFloat(t) || 0;
            return [len(a, ow) * kx, len(b, oh) * ky];
          };
          const [tl, tr, br, bl] = [
            radius(cs.borderTopLeftRadius),
            radius(cs.borderTopRightRadius),
            radius(cs.borderBottomRightRadius),
            radius(cs.borderBottomLeftRadius),
          ];
          // Radii that overlap are scaled down together, as CSS does.
          const fit = Math.min(
            1,
            r.width / Math.max(1e-9, tl[0] + tr[0]),
            r.width / Math.max(1e-9, bl[0] + br[0]),
            r.height / Math.max(1e-9, tl[1] + bl[1]),
            r.height / Math.max(1e-9, tr[1] + br[1]),
          );
          const inShape = (x: number, y: number) => {
            const corner = (cx: number, cy: number, [rx, ry]: [number, number], inX: boolean, inY: boolean) => {
              const ex = rx * fit,
                ey = ry * fit;
              if (ex <= 0 || ey <= 0 || !inX || !inY) return true;
              return ((x - cx) / ex) ** 2 + ((y - cy) / ey) ** 2 <= 1;
            };
            return (
              corner(r.x + tl[0] * fit, r.y + tl[1] * fit, tl, x < r.x + tl[0] * fit, y < r.y + tl[1] * fit) &&
              corner(r.right - tr[0] * fit, r.y + tr[1] * fit, tr, x > r.right - tr[0] * fit, y < r.y + tr[1] * fit) &&
              corner(
                r.right - br[0] * fit,
                r.bottom - br[1] * fit,
                br,
                x > r.right - br[0] * fit,
                y > r.bottom - br[1] * fit,
              ) &&
              corner(r.x + bl[0] * fit, r.bottom - bl[1] * fit, bl, x < r.x + bl[0] * fit, y > r.bottom - bl[1] * fit)
            );
          };
          for (const [x, y] of pts) {
            if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight || !inClips(x, y)) continue;
            if (!inShape(x, y)) continue;
            n++;
            const top = document.elementFromPoint(x, y);
            if (!top || el.contains(top) || top.contains(el) || seeThrough(top)) continue;
            covered++;
            by ??= top;
          }
          el.removeAttribute("data-vlmkit-probe");
          if (n > 0 && by && covered / n >= 0.08) {
            // The cover's own box that paints over it: the sibling (or its ancestor) that is not
            // also an ancestor of the target.
            let cover: Element = by;
            while (cover.parentElement && !cover.parentElement.contains(el)) cover = cover.parentElement;
            // A neighbour raised over it on purpose (the hovered card next to this one) is the design.
            const coverTf = fullTransform(cover);
            const coverScale = coverTf ? Math.hypot(coverTf.a, coverTf.b) : 1;
            if (coverScale > scale + 0.01) by = null;
          }
          if (n > 0 && by && covered / n >= 0.08) {
            let cover: Element = by;
            while (cover.parentElement && !cover.parentElement.contains(el)) cover = cover.parentElement;
            const mine = stacking(el);
            const theirs = stacking(cover);
            const after = !!(el.compareDocumentPosition(cover) & Node.DOCUMENT_POSITION_FOLLOWING);
            const zi = getComputedStyle(el).zIndex;
            edgeCover = {
              share: covered / n,
              message: `${Math.round((covered / n) * 100)}% of the points along its edge are covered by ${name(cover)}${
                mine && theirs && after && zi === "auto"
                  ? `: both are stacking contexts at z-index: auto (it: ${mine}; ${name(cover)}: ${theirs}), so they paint in document order and ${name(cover)}, later, paints over it — give it a z-index (z-index: 1) while it is raised`
                  : after && zi === "auto"
                    ? `, which comes later in the document and paints over it — give it a z-index (with position: relative, or as a grid / flex item) while it is raised`
                    : ""
              }`,
            };
          }
        }
        // Turned in 3D with nothing to give it depth: perspective on the element itself applies to
        // its children, not to its own turn, so a flip card read "turns over 176° in 3D" while it
        // was drawn as a flat squash (round 16).
        let flat3d: string | undefined;
        if (Math.abs(m33) < 0.999) {
          let turner: Element | null = null;
          for (let n: Element | null = el; n && n !== document.documentElement && !turner; n = n.parentElement) {
            const tf = fullTransform(n);
            if (tf && !tf.is2D) turner = n;
          }
          if (turner) {
            const tf = fullTransform(turner)!;
            const parent = turner.parentElement;
            const deep =
              Math.abs(tf.m34) > 1e-9 ||
              (parent && getComputedStyle(parent).perspective !== "none") ||
              // An ancestor further up that keeps 3D through preserve-3d and has a perspective.
              (() => {
                for (let a = parent; a && a !== document.documentElement; a = a.parentElement) {
                  if (getComputedStyle(a).transformStyle !== "preserve-3d") break;
                  if (a.parentElement && getComputedStyle(a.parentElement).perspective !== "none") return true;
                }
                return false;
              })();
            if (!deep) {
              const ownP = getComputedStyle(turner).perspective;
              flat3d = `${turner === el ? "it" : name(turner)} turns in 3D, but nothing gives the turn depth, so it is drawn flat (a squash, both edges as tall as ever)${
                ownP !== "none"
                  ? `: perspective: ${ownP} on ${name(turner)} itself gives depth to its children, not to its own turn — move it to its parent (${parent ? name(parent) : "the parent"})`
                  : `: give its parent (${parent ? name(parent) : "the parent"}) a perspective (perspective: 900px), or start its transform with perspective(900px)`
              }`;
            }
          }
        }
        return {
          ...(edgeCover ? { edgeCover } : {}),
          ...(flat3d ? { flat3d } : {}),
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
          ...pivotOf(el),
          ...textLines(el),
          ...(screenDeg !== undefined ? { screenDeg } : {}),
          ...(turnedBy ? { turnedBy } : {}),
          ...(overriddenBy ? { overriddenBy } : {}),
          ...(varDuration ? { varDuration } : {}),
          ...(ownEasing ? { ownEasing } : {}),
          ...(runs.length > 1 ? { durations: runs } : {}),
          ...(m33 < -0.01 && !backHidden ? { mirrored: true } : {}),
          ...(paint.length > 0 ? { paint } : {}),
          ...(stops.length > 0 ? { stops } : {}),
          ...(shadow.length > 0 ? { shadow } : {}),
          ...(sweepDeg !== undefined ? { sweepDeg } : {}),
          shift,
          ...(clip.length > 0 ? { clip } : {}),
          ...(filterVals.length > 0 ? { filter: filterVals } : {}),
          ...(heldFilter ? { heldFilter } : {}),
          ...(dupKeyframes ? { dupKeyframes } : {}),
          ...(kfEasing ? { kfEasing } : {}),
          ...(inertOffsets ? { inertOffsets } : {}),
          ...(heldByFill ? { heldByFill } : {}),
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
       vlmkit inspect motion <page.html|frames.json> --track <x,y,w,h>... --end <ms> [--start <ms>]   (a canvas, a recording: by its pixels)

Is an animation visually broken? The page's clock is held and the motion shot at
instants and once at rest. Without --jev, no key: each --selector is measured
from the page at every frame — where it is, its opacity and scale, and how much
of it is the topmost thing painted (a clip or a cover takes that away). With
--jev, each frame is also asked of TypeSafe Jev (TYPESAFEAI_API_KEY) in one
request: where a --target described in words is, whether it is shown, whether
each forbidden statement is. vlmkit judges the motion from that:

  target-lost      not shown between frames that show it (clipped, covered, snapped off-screen)
  target-hidden    shown in no frame at all, rest included (clipped or covered from the start)
  absent-at-rest   shown in motion, gone once it stops (unless --exits says it leaves; a warn when
                   it fades out over the motion's last frames: taken as leaving)
  snap-back        back where it started once it stops (fill-mode missing)
  jump             one step far faster than its neighbours (keyframe gap)
  easing-mismatch  the path follows another easing than --expect-easing
  target-static    shown and still from the first frame (warn: not animating?)
  origin-mismatch  a scale grows from, a turn turns about, or a width change keeps, another point
                   than --expect-origin (transform-origin)
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
  text-wrap        its text runs to more lines mid-motion than at rest (white-space: nowrap)
  lines-mismatch   its text runs to another number of lines than --expect-lines
  turn-off-centre  it turns and its centre is carried round: another transform-origin (warn)
  held-by-fill     after an action nothing changes, and its own finished animation holds what the
                   action sets (a forwards fill under :hover)
  target-unchanged nothing about the target changes while another element animates: the trigger (warn)
  reduced-motion-moves under --reduced-motion, a target that still moves (warn)
  reduced-motion-hides with --reduced-motion and nothing animating, a target not shown from the
                   first frame (animation: none over a base of opacity 0)
  reduced-motion-misplaced with --reduced-motion and nothing animating, a target more than 1px
                   off where the page rests with motion
  span-mismatch    at rest its left and right edges are not those of --expect-span-of's element
  inert-offset     its animation moves top / left on a position: static box, where they do nothing (warn)
  channel-step     a colour, gradient or shadow changes all at once between two frames (fail in
                   one frame; warn when the frames are too far apart to tell)
  replayed         after rest, as the page's timers run (up to 10s), it is replaced by a new element that
                   plays its animation again (a re-render); the same element starting again is a warn
  stroke-incomplete a stroke drawing itself ends part drawn (a dash shorter than its line)
  mirrored         a face turned past edge-on is seen backwards (backface-visibility)
  flat-3d          (warn) it turns in 3D with no perspective on its parent: drawn as a flat squash
  covered-edge     its edge is painted over by another element (fail when it is raised: scaled up)
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
  --track <x,y,w,h>       A target with no element to measure — a canvas, WebGL, a sprite a script
                          draws, a recording (repeat): the region it fills in the LAST frame
                          shot (CSS px; its rest), found in every frame by its pixels. Gives where
                          it is and how well it matches, not its size, turn or opacity. No key,
                          and saved frames.json work too. After the --selector targets in order
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
                          from, a turn turns about, or a width / height change keeps (the edge
                          a pill widens from). Or X,Y in the element's own units, as
                          transform-origin takes them: an SVG element's viewBox units (a needle
                          turning about the dial's centre: 160,170), else px from its box's
                          top-left corner — checked on a turn. Once for every target, or
                          repeated per target in order ("any" leaves one out). A scale along
                          one axis (scaleY, a drop-down) keeps an edge: top | bottom (left |
                          right for scaleX). Measured with --selector; every scale's point or
                          edge is printed with or without it
  --expect-start <ms>     When its own animation begins (page time). Comma-separated, one per
                          target in order: "200,280,360,440"; "+50ms" counts from the last
                          action instead (a close's start), and "any" leaves a target out.
                          Measured with --selector
  --expect-stagger <ms>   Each target begins this long after the one before it, in the order
                          given (from the first target's --expect-start, or its measured start)
  --expect-duration <ms>  How long one run of its own animation takes ("280ms", "1.2s").
                          Once for every target, or comma-separated per target ("any" leaves
                          one out). --selector
  --expect-direction <d>  Which way its (first) motion goes: left | right | up | down — "slides in
                          from the right edge" moves left — or which way it turns: clockwise |
                          counterclockwise — a swing by the way it turns first. Once for every
                          target, or per target ("any" leaves one out)
  --expect-iterations <n> How many times it runs: 3, or infinite. Once for every target, or
                          comma-separated per target ("any" leaves one out). --selector
  --expect-still          Its centre must not move: only its size and opacity change (a dialog
                          that stays centred while it grows in). --selector
  --expect-upright        Its angle on screen must not change, through every transform up the tree
                          (a label kept level inside a turning dial). --selector
  --click <css>           Actions on the held page before any frame, in the order given: the
  --hover <css>           motion the LAST one starts is sampled, and each one before it first
  --leave                 runs to its end. --hover puts the pointer over an element, --leave
  --scroll <css|px>       takes it off every element ("--hover .card --leave" samples the card
                          settling back), --scroll brings an element's top to the viewport's
                          top (or scrolls to a y in px) — what a scroll-triggered reveal needs.
                          Nothing animating while a --selector target changes is \`snapped\`.
                          What plays at load ends before the first --click / --hover / --leave
                          (a leading --wait says when instead)
  --every-action          With several actions, sample the motion each one starts (one run per
                          action, in order) instead of the last one's only; --exits is the last's.
                          --expect-direction / -duration / -iterations with one value per action
                          check each step against its own (left,right for an open and a close)
  --wait <ms>             After an action: let only this long pass before the next one instead
                          of its whole motion — a change of mind mid-motion. "--click .menu-btn
                          --wait 100 --click .menu-btn" lands the second click 100ms into the
                          opening; a target that jumps when it lands is \`interrupt-jump\` (fail)
  --baseline <file>       Hold this run to an approved one. With no file there, a run that passes
                          writes it (each target's start, duration, runs, travel, direction,
                          easing, origin, pivot, turn and place at rest); with one, a change past a
                          frame, 2px, 2° or 5% of a travel — or another named easing — is
                          \`baseline-mismatch\` (fail), naming what changed
                          Targets are matched by name: give a --track one a --target, so a
                          region drawn again a pixel off is still the same target
  --update-baseline       Write --baseline again from this run (it must pass): a change that is meant
  --exits                 The targets are meant to leave (gone at rest is their end)
  --still <css>           One target's centre must not move (repeat): the article a notice
                          slides over, beside the notice that moves. Measured as a --selector
                          too, so it need not be given twice. An --expect-* given once is the
                          moving targets', not a --still or --exit one's
  --expect-lines <n>      Its text runs to n lines in every frame it is shown in (a label that
                          stays on one line while its button widens). Once, or per target
                          ("any" leaves one out)
  --expect-span-of <css>  At rest its left and right edges are that element's, within 1px (a tab
                          indicator ending under its tab). Repeat: one per target ("any" skips)
  --reduced-motion        Load the page under prefers-reduced-motion: reduce. After an action, a
                          target that changes at once with no motion is what is asked, not
                          \`snapped\`; one that still moves says so (\`reduced-motion-moves\`, warn).
                          With no action and nothing animating, each target is judged from the
                          first frame: shown, and where the page rests with motion
  --exit <css>            One --selector target is meant to leave, the others are not (repeat):
                          a flip card's front face turned away, beside its back turning in
  --at <instants>         Frames to shoot (default: 11 per segment + rest); the segments stay
                          the page's own spans of motion
  --start <ms> --end <ms> The motion's span (needed for frames.json): one segment
  --viewport <WxH>        Default 1280x800
  --device-scale <n>      Device pixels per CSS px, 1-4 (default 1): a 0.6px blur draws as no blur
                          at 1x and may show at 2x. --selector targets only (not with --jev)
  --frames <dir>          (or --out) Where the frames go (default test-results/inspect-motion/<page name>, so
                          two pages, or check animation's frames, do not overwrite each other)
  --threshold <0-1>       A statement is true at or above this (default 0.5)
  --json                  Print the report as JSON

Exit: 0 nothing fails, 1 a fail, 2 usage error. With --jev, ~$0.00013 and ~0.2s per frame.
Advisory: gate on check animation / check integrity --timeline.
Measured: https://github.com/mizchi/vlmkit/blob/main/docs/reports/2026-10-18-jev-motion.md`;

export class MotionUsageError extends Error {}
/** An action's pointer is caught by another element on top of its target: a fail, not a usage error. */
export class ActionBlockedError extends Error {}
/** Nothing animates or transitions at load (and no action starts anything). */
export class NothingAnimatesError extends MotionUsageError {}

/** After --click nothing animated: the targets that changed did so in one frame. */
export class SnappedError extends Error {
  constructor(
    readonly changed: string[],
    /** Per change, the cause the page shows, when it does. */
    readonly causes: (string | undefined)[] = [],
    /** Targets nothing changed on whose own finished animation holds what the action sets. */
    readonly heldBy: { selector: string; cause: string }[] = [],
  ) {
    super("no animation or transition started after --click");
  }
}

export interface MotionCliOptions {
  source: string;
  targets: string[];
  selectors: string[];
  /** `--track` regions (CSS px, in the last frame shot): targets found by their pixels, after the selectors. */
  tracks: TrackBox[];
  forbid: string[];
  /** Each --expect-easing given, in order: one for every target, or one per target. */
  expectEasing?: EasingName[][];
  /**
   * Each --expect-origin given: one for every target, or one per target. A point is in the
   * element's own units (an SVG element's user space, else CSS px from its box's corner);
   * undefined where `any` was given.
   */
  expectOrigin?: (OriginName | OriginPoint | undefined)[];
  /** One per target, in order; undefined where `any` was given. */
  expectStartMs?: (number | undefined)[];
  /** Per entry of expectStartMs: given as `+Nms`, counted from the last action's start. */
  expectStartAfterAction?: boolean[];
  /** Load the page with prefers-reduced-motion: reduce (a click whose motion should then be gone). */
  reducedMotion?: boolean;
  /** Per target: at rest its left and right edges are those of this element (undefined: not asked). */
  expectSpanOf?: (string | undefined)[];
  expectStaggerMs?: number;
  /** How long one run of each target's own animation takes (ms), per target in order. */
  expectDurationMs?: (number | undefined)[];
  /** How many times it runs (null: infinite), per target in order. */
  expectIterations?: (number | null | undefined)[];
  /** How many lines each target's text runs to in every frame (once for all, or per target). */
  expectLines?: (number | undefined)[];
  expectDirection?: (MotionDirection | undefined)[];
  exits: boolean;
  /** --selector targets meant to leave, by selector. */
  exitSelectors: string[];
  /** --selector targets whose centre must not move (one target's --expect-still). */
  stillSelectors: string[];
  at?: number[];
  startMs?: number;
  endMs?: number;
  viewport: { width: number; height: number };
  /** Device pixels per CSS px for every page and frame (`--device-scale`). */
  deviceScale: number;
  frames: string;
  threshold: number;
  json: boolean;
  /** Sample the motion each action starts, one run per action, instead of the last one's only. */
  everyAction?: boolean;
  /** Hold the run to an approved one (`--baseline <file>`): written by the first passing run. */
  baseline?: string;
  /** Write the baseline again from this run (`--update-baseline`), when it passes. */
  updateBaseline?: boolean;
  /** One step of an --every-action run: the actions before it were sampled in their own steps. */
  inEveryAction?: boolean;
  /** Ask TypeSafe Jev. Without it every target is a --selector, measured from the page alone. */
  jev: boolean;
  /**
   * What is done on the held page before any frame is shot, in order: the motion the last one
   * starts is sampled, and each one before it is first let run to its end.
   */
  actions: MotionAction[];
  /** Each target's centre must not move (only size and opacity change). */
  expectStill: boolean;
  /** Its angle on screen must not change (`--expect-upright`). */
  expectUpright: boolean;
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
  const tracks: TrackBox[] = [];
  const forbid: string[] = [];
  let expectEasing: EasingName[][] | undefined;
  let expectOrigin: (OriginName | OriginPoint | undefined)[] | undefined;
  let expectStartMs: (number | undefined)[] | undefined;
  let expectStartAfterAction: boolean[] | undefined;
  let reducedMotion = false;
  let expectSpanOf: (string | undefined)[] | undefined;
  let expectStaggerMs: number | undefined;
  let expectDurationMs: (number | undefined)[] | undefined;
  let expectIterations: (number | null | undefined)[] | undefined;
  let expectLines: (number | undefined)[] | undefined;
  let expectDirection: (MotionDirection | undefined)[] | undefined;
  let at: number[] | undefined;
  let startMs: number | undefined;
  let endMs: number | undefined;
  let viewport = { width: 1280, height: 800 };
  let deviceScale = 1;
  let frames: string | undefined;
  let threshold = 0.5;
  let json = false;
  let exits = false;
  let everyAction = false;
  let baseline: string | undefined;
  let updateBaseline = false;
  const exitSelectors: string[] = [];
  const stillSelectors: string[] = [];
  let noForbid = false;
  let jev = false;
  const actions: MotionAction[] = [];
  let expectStill = false;
  let expectUpright = false;
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
        // All `any` is one target left out when the flag is repeated per target (a declared
        // { "motion": ... } entry writes one per target); given only once, it checks nothing, and
        // that is refused after the loop.
        if (bad.length > 0 || names.length === 0) {
          throw new MotionUsageError(
            `--expect-easing takes ${EASING_NAMES.join(", ")} (comma-separated per segment); got ${bad.join(", ")}${
              bad.some((b) => /cubic-bezier|linear\(|steps\(/.test(b))
                ? '. A custom curve is not fitted by name: the target\'s line says when the CSS gives it one ("its own timing function is cubic-bezier(…)"), and the nearest named curve is the one to expect (ease-out for cubic-bezier(0, 0, 0.2, 1))'
                : ""
            }`,
          );
        }
        (expectEasing ??= []).push(names.map((e) => (e === "any" ? undefined : e)) as EasingName[]);
        break;
      }
      case "--expect-origin": {
        const raw = value(a, argv[++i]).trim();
        // `any` leaves a target out; a point is the element's own units, as transform-origin is: a
        // gauge's needle turning about (160, 170) of its viewBox had only keywords to say it with
        // (the small-model round).
        if (raw === "any" || raw === "-") {
          (expectOrigin ??= []).push(undefined);
          break;
        }
        const pt = /^(-?\d+(?:\.\d+)?)(?:px)?\s*[, ]\s*(-?\d+(?:\.\d+)?)(?:px)?$/.exec(raw);
        if (pt) {
          (expectOrigin ??= []).push({ x: Number(pt[1]), y: Number(pt[2]) });
          break;
        }
        const v = raw
          .trim()
          .replace(/\s+/g, "-")
          .replace(/^centre$/, "center");
        // transform-origin's own word order ("left top") reads the same.
        const flip = v.split("-").reverse().join("-");
        const n = (ORIGIN_NAMES as readonly string[]).includes(v) ? v : flip;
        if (!(ORIGIN_NAMES as readonly string[]).includes(n)) {
          throw new MotionUsageError(
            `--expect-origin takes ${ORIGIN_NAMES.join(", ")}, a point X,Y in the element's own units (an SVG element's viewBox units, else px from its box's top-left corner) or any; got ${argv[i]}`,
          );
        }
        (expectOrigin ??= []).push(n as OriginName);
        break;
      }
      case "--expect-start":
        // One time per target, in the order given: parseInstants sorts and dedupes, which paired
        // "400,0" with the targets as "0,400" (round 4).
        // `any` leaves a target out; `+50ms` counts from the last action's start, so a close's start
        // can be said without knowing when its click lands (authoring v1).
        for (const x of value(a, argv[++i])
          .split(",")
          .map((v) => v.trim())) {
          (expectStartAfterAction ??= []).push(x.startsWith("+"));
          (expectStartMs ??= []).push(x === "any" || x === "-" ? undefined : one(a, x.replace(/^\+/, "")));
        }
        break;
      case "--expect-duration":
        (expectDurationMs ??= []).push(
          ...value(a, argv[++i])
            .split(",")
            .map((x) => (x.trim() === "any" || x.trim() === "-" ? undefined : one(a, x.trim()))),
        );
        break;
      case "--expect-direction":
        (expectDirection ??= []).push(
          ...value(a, argv[++i])
            .split(",")
            .map((x) => {
              const v = x.trim().replace(/wards?$/, "");
              // `any`: this target's direction is not asked (a still target beside one that moves).
              if (v === "any" || v === "-") return undefined;
              if (!(MOTION_DIRECTIONS as readonly string[]).includes(v))
                throw new MotionUsageError(`--expect-direction takes ${MOTION_DIRECTIONS.join(", ")} or any, got ${x}`);
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
              if (v === "any" || v === "-") return undefined;
              if (v === "infinite") return null;
              const n = Number(v);
              if (!Number.isInteger(n) || n < 1)
                throw new MotionUsageError(`--expect-iterations takes whole numbers, infinite or any, got ${v}`);
              return n;
            }),
        );
        break;
      case "--expect-lines":
        (expectLines ??= []).push(
          ...value(a, argv[++i])
            .split(",")
            .map((x) => {
              if (x.trim() === "any" || x.trim() === "-") return undefined;
              const n = Number(x.trim());
              if (!Number.isInteger(n) || n < 1)
                throw new MotionUsageError(`--expect-lines takes whole numbers or any, got ${x}`);
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
      case "--track": {
        const v = value(a, argv[++i]);
        const box = parseTrackRegion(v);
        if (!box)
          throw new MotionUsageError(
            `--track takes x,y,w,h in CSS px (the region the target fills in the last frame), got ${v}`,
          );
        tracks.push(box);
        break;
      }
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
      case "--expect-upright":
        expectUpright = true;
        break;
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
      case "--device-scale": {
        const v = Number(value(a, argv[++i]));
        if (!(v >= 1 && v <= 4))
          throw new MotionUsageError(`--device-scale takes a number from 1 to 4, got ${argv[i]}`);
        deviceScale = v;
        break;
      }
      case "--viewport": {
        const m = /^(\d+)x(\d+)$/.exec(value(a, argv[++i]));
        if (!m) throw new MotionUsageError(`--viewport takes WxH, got ${argv[i]}`);
        viewport = { width: Number(m[1]), height: Number(m[2]) };
        break;
      }
      // inspect motion writes no run ledger (it is not a gate); a gate's flag is taken, not refused
      // with the whole help (round 13).
      case "--no-ledger":
        break;
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
      case "--reduced-motion":
        reducedMotion = true;
        break;
      case "--expect-span-of": {
        // One per target, in order ("any" leaves one out): a tab indicator ends exactly under the
        // tab it moved to, and nothing could say so (authoring v1).
        const v = value(a, argv[++i]).trim();
        (expectSpanOf ??= []).push(v === "any" || v === "-" ? undefined : v);
        break;
      }
      case "--exits":
        exits = true;
        break;
      case "--every-action":
        everyAction = true;
        break;
      case "--baseline":
        baseline = value(a, argv[++i]);
        break;
      case "--update-baseline":
        updateBaseline = true;
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
    if (afterFlag !== undefined)
      throw new MotionUsageError(
        afterFlag === ""
          ? "--expect-still takes no value (it applies to every target), and an empty argument ('') followed it: leave the '' out"
          : `--expect-still takes no value (it applies to every target): for one target, write --still ${afterFlag}`,
      );
    // An empty argument ('') read as a second page (round 16).
    const empty = argv.findIndex((x) => x === "");
    if (empty >= 0)
      throw new MotionUsageError(
        `an empty argument ('')${empty > 0 ? ` after ${argv[empty - 1]}` : ""} was read as a page: leave it out${empty > 0 && argv[empty - 1]!.startsWith("--") ? `, or give ${argv[empty - 1]} its value` : ""}`,
      );
    throw new MotionUsageError(
      `expected one page, URL or frames.json, got ${positional.length}${positional.length > 1 ? ' (quote each description: --target "the blue square")' : ""}`,
    );
  }
  if (noForbid && forbid.length > 0) throw new MotionUsageError("--no-forbid with --forbid: pick one");
  if (/(^|\/)frames\.json$/.test(positional[0]!) && !jev && tracks.length === 0) {
    throw new MotionUsageError(
      "saved frames have no page to measure: give --track x,y,w,h to find a target by its pixels, or add --jev to ask Jev of them",
    );
  }
  if (jev && tracks.length > 0)
    throw new MotionUsageError(
      "--track finds a target by its pixels, with no model: drop --jev, or describe it with --target for Jev",
    );
  if (!jev) {
    // Without Jev nothing can read a statement or find a target by its words: the page measures
    // each --selector, and those name the targets when no --target does.
    if (forbid.length > 0) throw new MotionUsageError("--forbid is a statement Jev reads from the frames: add --jev");
    // --still / --exit name what to measure as well: `--still .delete` was refused, "names no
    // --selector" (authoring v1).
    for (const sel of [...stillSelectors, ...exitSelectors]) if (!selectors.includes(sel)) selectors.push(sel);
    if (selectors.length === 0 && tracks.length === 0) {
      throw new MotionUsageError(
        "give each target a --selector (measured from the page, no key), a --track x,y,w,h (found by its pixels: a canvas or a recording), or add --jev to find --target by its words",
      );
    }
    // A --target names the selector in its position; the rest are named by their selectors (the
    // help said so, and 3 --selector with 1 --target was refused, round 9).
    // Then each --track, named by its region.
    const measured = [...selectors, ...tracks.map((b) => `region ${b.x},${b.y} ${b.width}x${b.height}`)];
    if (targets.length < measured.length) targets.push(...measured.slice(targets.length));
    if (targets.length !== measured.length) {
      throw new MotionUsageError(
        `${measured.length} --selector / --track for ${targets.length} --target: without --jev every target is measured, so each needs one`,
      );
    }
  } else if (!noForbid && forbid.length === 0) forbid.push(DEFAULT_MOTION_FORBID);
  if (targets.length === 0 && noForbid)
    throw new MotionUsageError("nothing to check: give --target, or drop --no-forbid");
  if (expectEasing && targets.length === 0) throw new MotionUsageError("--expect-easing needs a --target to follow");
  if (expectEasing?.length === 1 && expectEasing[0]!.every((e) => e === undefined))
    throw new MotionUsageError(
      "--expect-easing any, given once, checks nothing: name the curve, or leave the flag out (`any` leaves one target out when the flag is given per target)",
    );
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
    ["--expect-lines", expectLines],
    ["--expect-direction", expectDirection],
  ] as const) {
    // With --every-action, one per action is per step: a drawer that opens leftwards and closes
    // rightwards could not say so in one run (round 18).
    const steps = actions.filter((a) => a.kind !== "wait").length;
    if (xs && xs.length > 1 && xs.length !== targets.length && !(everyAction && xs.length === steps))
      throw new MotionUsageError(
        `${xs.length} ${flag} values for ${targets.length} targets: one for all, or one per target${steps > 1 ? `; with --every-action, one per action (${steps})` : ""}`,
      );
  }
  if (deviceScale !== 1 && jev)
    throw new MotionUsageError(
      "--device-scale is for --selector targets: Jev's boxes are read in frame pixels, so leave out --jev",
    );
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
  if (updateBaseline && !baseline)
    throw new MotionUsageError("--update-baseline needs --baseline <file>: the file to write");
  if (baseline && everyAction)
    throw new MotionUsageError(
      "--baseline with --every-action: one baseline holds one sampled motion; give each action its own run with its own --baseline",
    );
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
    tracks,
    forbid,
    ...(expectEasing ? { expectEasing } : {}),
    ...(expectOrigin ? { expectOrigin } : {}),
    ...(expectStartMs ? { expectStartMs } : {}),
    ...(expectStartAfterAction?.some(Boolean) ? { expectStartAfterAction } : {}),
    ...(reducedMotion ? { reducedMotion } : {}),
    ...(expectSpanOf ? { expectSpanOf } : {}),
    ...(expectStaggerMs !== undefined ? { expectStaggerMs } : {}),
    ...(expectDurationMs ? { expectDurationMs } : {}),
    ...(expectIterations ? { expectIterations } : {}),
    ...(expectLines ? { expectLines } : {}),
    ...(expectDirection ? { expectDirection } : {}),
    exits,
    exitSelectors,
    stillSelectors,
    ...(at ? { at } : {}),
    ...(startMs !== undefined ? { startMs } : {}),
    ...(endMs !== undefined ? { endMs } : {}),
    viewport,
    deviceScale,
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
    expectUpright,
    ...(everyAction ? { everyAction } : {}),
    ...(baseline ? { baseline } : {}),
    ...(updateBaseline ? { updateBaseline } : {}),
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
  /** Device pixels per CSS px of the frames, when read back from a frames.json. */
  deviceScale?: number;
  /** --track targets (after the --selector ones), found by their pixels. */
  tracked?: number;
  startMs: number;
  endMs: number;
  segments: { startMs: number; endMs: number }[];
  /** The rest frame was moved: an animation began later than planned at load. */
  replanned?: string;
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
  /** Elements that animate and are not a target, nor around one (inside one counts). */
  elsewhere?: string[];
  /** The --selector targets just before the last action, and that action. */
  beforeLast?: { action: string; targets: (MotionDom | null)[] };
  /** The page time the last action landed at. */
  lastActionAtMs?: number;
  /** --expect-span-of, read at rest: each target's left/right against the element it should match. */
  spans?: (
    | { of: string; left: number; right: number; wantLeft: number; wantRight: number }
    | { of: string; missing: true }
    | null
  )[];
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
/** A page at the run's viewport and scale, with reduced motion emulated under --reduced-motion. */
async function openMotionPage(
  browser: import("playwright").Browser,
  o: Pick<MotionCliOptions, "viewport" | "deviceScale" | "reducedMotion">,
): Promise<import("playwright").Page> {
  const page = await browser.newPage({ viewport: o.viewport, deviceScaleFactor: o.deviceScale });
  await page.emulateMedia({ reducedMotion: o.reducedMotion ? "reduce" : "no-preference" });
  return page;
}

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
    // The pointer could not reach it: something else is on top of it where it would land. That is
    // the page's defect, not the command's (a confirm dialog's backdrop left at opacity 0 over the
    // Delete button read "error: page.click: Timeout 5000ms exceeded" and "did not run").
    if ((act.kind === "click" || act.kind === "hover") && /Timeout/.test(String(e))) {
      const cover = await page
        .evaluate((sel) => {
          const el = document.querySelector(sel);
          if (!el) return null;
          const r = el.getBoundingClientRect();
          const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          if (!top || top === el || el.contains(top)) return null;
          const name = (n: Element) =>
            n.localName + (n.id ? `#${n.id}` : "") + [...n.classList].map((c) => `.${c}`).join("");
          const cs = getComputedStyle(top);
          return { by: name(top), opacity: Number(cs.opacity), visibility: cs.visibility };
        }, act.selector)
        .catch(() => null);
      if (cover)
        throw new ActionBlockedError(
          `${describeAction(act)}: the pointer cannot reach it — ${cover.by} is on top of it at its centre${
            cover.opacity < 0.05
              ? ` (at opacity ${cover.opacity.toFixed(2)}: invisible, and it still takes the pointer)`
              : ""
          }. If ${cover.by} is meant to be gone, take it out of hit-testing too (pointer-events: none, visibility: hidden, or display: none once it has faded)`,
        );
    }
    throw new MotionUsageError(`${describeAction(act)}: ${(e as Error).message.split("\n")[0]}`);
  }
}

/**
 * Elements whose transition lists a custom property that no `@property` rule registers: such a
 * property has no type, so its transition never interpolates. Read from the stylesheets the page
 * can read (a cross-origin sheet is skipped, so a property registered there reads unregistered).
 */
async function unregisteredTransitions(
  page: import("playwright").Page,
): Promise<{ selector: string; property: string }[]> {
  return page.evaluate(() => {
    const registered = new Set<string>();
    const walk = (rules: CSSRuleList) => {
      for (const r of [...rules]) {
        if (typeof CSSPropertyRule !== "undefined" && r instanceof CSSPropertyRule) registered.add(r.name);
        else if ("cssRules" in r) walk((r as CSSGroupingRule).cssRules);
      }
    };
    for (const sheet of [...document.styleSheets]) {
      try {
        walk(sheet.cssRules);
      } catch {}
    }
    // Registered with a type anywhere (CSS.registerProperty in a script, too): it computes
    // `initial` to its initial value, an unregistered one to nothing (held-out set).
    const typed = (name: string) => {
      const probe = document.createElement("div");
      probe.style.setProperty(name, "initial");
      document.documentElement.append(probe);
      const v = getComputedStyle(probe).getPropertyValue(name).trim();
      probe.remove();
      return v !== "";
    };
    const out: { selector: string; property: string }[] = [];
    for (const el of [...document.querySelectorAll("*")]) {
      const cs = getComputedStyle(el);
      const durations = cs.transitionDuration.split(",").map((d) => parseFloat(d) || 0);
      cs.transitionProperty.split(",").forEach((raw, i) => {
        const prop = raw.trim();
        if (!prop.startsWith("--") || registered.has(prop) || typed(prop) || !(durations[i % durations.length]! > 0))
          return;
        const cls = [...el.classList].map((c) => `.${c}`).join("");
        out.push({ selector: `${el.localName}${el.id ? `#${el.id}` : ""}${cls}`, property: prop });
      });
      if (out.length >= 8) break;
    }
    return out;
  });
}

async function captureMotion(o: MotionCliOptions): Promise<Captured> {
  const { withBrowser } = await import("@mizchi/vlmkit-core/browser-launch.ts");
  const { sourceToUrl } = await import("@mizchi/vlmkit-core/page-open.ts");
  const { openHeldTimeline, captureStable, frameWriter, frameSourceFacts } =
    await import("@mizchi/vlmkit-animation-eval/frames-capture.ts");
  const url = sourceToUrl(o.source);
  return withBrowser(async (browser) => {
    let page = await openMotionPage(browser, o);
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
      let lastBefore: Captured["beforeLast"];
      // When the last action lands on the page clock: `--expect-start +50ms` counts from here.
      let lastActionAtMs: number | undefined;
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
        // What the page plays at load ends before the first pointer action, as a visitor's hover
        // comes after the cards have risen in. Hovered at 0, a card still in its delay rose under
        // the pointer and the lift read as a 12px jump on the broken page and its repair alike
        // (round 13). A leading --wait says when instead; a scroll keeps a reveal begun at load.
        if (clockNow === 0 && steps[0]!.act.kind !== "scroll") {
          const ends = held
            .filter((h) => h.iterations !== null)
            .map((h) => h.startMs + h.durationMs * (h.iterations ?? 1))
            .filter((e) => e <= 10_000);
          if (ends.length > 0) {
            clockNow = Math.max(...ends) + frameTimeMs(1);
            await timeline.at(clockNow);
          }
        }
        for (const [k, { act, waitAfter }] of steps.entries()) {
          if (k === steps.length - 1) {
            beforeClick = o.selectors.length > 0 ? await measureTargets(page, o.selectors) : [];
            lastBefore = { action: describeAction(act), targets: beforeClick };
            lastActionAtMs = clockNow;
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
            const step = (x: number[], y: number[]) =>
              x.length === y.length && x.length > 0 ? Math.max(...x.map((v, k) => Math.abs(v - y[k]!))) : 0;
            const paintStep = Math.max(step(pa, pb), step(a.stops ?? [], b.stops ?? []));
            if (!(d >= 1 || op >= 0.05 || paintStep >= 8)) return [];
            causes.push(
              b.notRendered
                ? `the action took it out of rendering (${b.hiddenBy?.replace(/^not rendered: /, "") ?? "display: none"}) in the same frame, so no exit animation can be drawn: let it leave first and hide it once it has (on animationend / transitionend), or transition display with transition-behavior: allow-discrete`
                : a.notRendered
                  ? // From display: none there is no style to transition from (round 13's Share panel
                    // read the interpolate-size causes, none of which applied).
                    `it was not rendered (${a.hiddenBy?.replace(/^not rendered: /, "") ?? "display: none"}) before the action, and a transition from display: none has no style to start from, so it appears at its end state: give the shown state a @starting-style with the values it enters from (@starting-style { .open { opacity: 0; transform: … } }), or play its entrance as a @keyframes animation`
                  : paintStep >= 8 && d < 1 && op < 0.05 && (a.discreteBg || b.discreteBg)
                    ? `only its colour changed, and its transition on background runs between two gradients, which do not interpolate (a gradient is an image: it steps at once). Build the gradient from registered colour properties (@property --c { syntax: "<color>"; … }) and transition those, or cross-fade a second gradient layer's opacity`
                    : (b.varDuration ?? a.varDuration),
            );
            return [
              d >= 1 || op >= 0.05
                ? `${sel}: ${Math.round(a.box.width)}x${Math.round(a.box.height)} at (${Math.round(a.box.x)},${Math.round(a.box.y)}) → ${Math.round(b.box.width)}x${Math.round(b.box.height)} at (${Math.round(b.box.x)},${Math.round(b.box.y)})${op >= 0.05 ? `, opacity ${a.opacity.toFixed(2)} → ${b.opacity.toFixed(2)}` : ""}`
                : `${sel}: its colour, by up to ${Math.round(paintStep)} of 255 a channel,`,
            ];
          });
          // Nothing changed, and a target's own finished animation still holds what the action sets:
          // a card whose WAAPI entrance filled `scale` forwards ignored its :hover scale, and the run
          // ended "nothing animated … check the action reaches the control" (held-out set).
          const heldBy =
            changed.length === 0
              ? o.selectors.flatMap((sel, i) =>
                  afterClick[i]?.heldByFill ? [{ selector: sel, cause: afterClick[i]!.heldByFill! }] : [],
                )
              : [];
          throw new SnappedError(changed, causes, heldBy);
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
        // Opened afresh whenever the search ran the clock: found, to shoot from 0; not found, so
        // --at's instants are not shot after the timers had already run (a ring whose step came
        // at 200ms read unchanged at every frame of --at 150..300/1f, round 13).
        if (held.length > 0 || ranTo !== null) {
          await page.close();
          page = await openMotionPage(browser, o);
          timeline = await openHeldTimeline(page, url);
        }
      }
      // What animates that is not a target, nor around one: a run on the "?" that opens
      // a bubble measured the trigger and read "travels 0px, no fail" (round 14).
      const elsewhere = await page
        .evaluate((sels: string[]) => {
          const targets = sels.flatMap((s) => [...document.querySelectorAll(s)]);
          const name = (e: Element) =>
            e.localName + (e.id ? `#${e.id}` : "") + [...e.classList].map((c) => `.${c}`).join("");
          const out = new Set<string>();
          for (const a of document.getAnimations()) {
            const el = (a.effect as KeyframeEffect | null)?.target;
            if (!(el instanceof Element)) continue;
            // An ancestor carries the target with it; a descendant is what moved instead of it.
            if (targets.some((t) => t === el || el.contains(t))) continue;
            out.add(name(el));
          }
          return [...out].slice(0, 4);
        }, o.selectors)
        .catch(() => [] as string[]);
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
      // --at alone shoots the page at those instants, as --end does: the reason given for a page
      // that animates nothing said to pass --at, and it was refused all the same (round 13).
      if (o.endMs === undefined && !o.at && plan.segments.length === 0) {
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
          // A transition on a custom property nothing registers: it has no type, so it does not
          // interpolate and the value steps at once (round 13's ring, "it's empty, then it's full").
          const unregistered = await unregisteredTransitions(page).catch(() => []);
          if (unregistered.length > 0)
            throw new MotionUsageError(
              `no animation or transition on the page${ranTo !== null ? `, at load or after its timers ran (to ${ranTo}ms)` : " at load"}: ${unregistered
                .slice(0, 3)
                .map((u) => `${u.selector} transitions ${u.property}`)
                .join(
                  ", ",
                )}, a custom property no @property registers — an unregistered custom property has no type, so it does not interpolate and steps at once. Register it (@property ${unregistered[0]!.property} { syntax: "<percentage>"; inherits: false; initial-value: 0%; }, with the syntax of its values), and the transition runs. To shoot the page as it is, give --end <ms> or --at <instants>`,
            );
          // An @media whose feature the browser does not know never matches: the entrance inside
          // @media (prefers-reduce-motion: no-preference) never played for anyone (round 17).
          const dead = await page
            .evaluate(() => {
              const out: string[] = [];
              const moves = (rules: CSSRuleList): boolean =>
                [...rules].some(
                  (r) =>
                    (r instanceof CSSStyleRule &&
                      ((r.style.animationName && r.style.animationName !== "none") ||
                        (r.style.transitionProperty &&
                          r.style.transitionDuration &&
                          r.style.transitionDuration !== "0s"))) ||
                    ("cssRules" in r && moves((r as CSSGroupingRule).cssRules)),
                );
              // An unknown feature (or value) matches neither (f) nor not (f): Chromium keeps its text.
              const unknown = (cond: string) =>
                [...cond.matchAll(/\(([^()]+)\)/g)].some(
                  (m) => !window.matchMedia(`(${m[1]})`).matches && !window.matchMedia(`not (${m[1]})`).matches,
                );
              const walk = (rules: CSSRuleList) => {
                for (const r of [...rules]) {
                  if (r instanceof CSSMediaRule && moves(r.cssRules) && unknown(r.conditionText || r.media.mediaText))
                    out.push(r.conditionText || r.media.mediaText);
                  else if ("cssRules" in r) walk((r as CSSGroupingRule).cssRules);
                }
              };
              for (const sheet of [...document.styleSheets]) {
                try {
                  walk(sheet.cssRules);
                } catch {}
              }
              return out;
            })
            .catch(() => [] as string[]);
          if (dead.length > 0) {
            const known = [
              "prefers-reduced-motion",
              "prefers-color-scheme",
              "prefers-contrast",
              "hover",
              "pointer",
              "orientation",
              "min-width",
              "max-width",
            ];
            const feature = /\(\s*([a-z-]+)\s*[:)]/i.exec(dead[0]!)?.[1] ?? "";
            const lev = (a: string, b: string) => {
              const m: number[][] = [];
              for (let i = 0; i <= a.length; i++) {
                m[i] = [i];
                for (let j = 1; j <= b.length; j++)
                  m[i]![j] =
                    i === 0
                      ? j
                      : Math.min(
                          m[i - 1]![j]! + 1,
                          m[i]![j - 1]! + 1,
                          m[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
                        );
              }
              return m[a.length]![b.length]!;
            };
            const near = known.map((k) => [k, lev(feature, k)] as const).sort((x, y) => x[1] - y[1])[0];
            throw new MotionUsageError(
              `no animation or transition on the page at load: the animation is declared inside @media ${dead[0]}, which never matches — the browser does not know the media feature${feature ? ` \`${feature}\`` : ""} (or its value), so the query is false for everyone${near && near[1] <= 3 && near[0] !== feature ? ` (did you mean \`${near[0]}\`?)` : ""}, so it applies for nobody`,
            );
          }
          throw new NothingAnimatesError(
            `no animation or transition on the page${ranTo !== null ? `, at load or after its timers ran (to ${ranTo}ms)` : " at load"}: nothing to sample. If one should run, it never starts — check animation lists what does; a misspelt transition-property or animation-name, a media query that never matches, a transition to height: auto (which needs interpolate-size: allow-keywords), or a class added in the same frame as the style it transitions from, are the usual causes. If a click starts it, give --click <css>. To shoot the page anyway, give --end <ms> (with --start, or --at for the instants)`,
          );
        }
        const s0 = Math.min(...infinite.map((a) => a.startMs));
        forever = { startMs: s0, endMs: s0 + Math.min(4000, 3 * Math.max(...infinite.map((a) => a.durationMs))) };
      }
      const atOnly = o.endMs === undefined && !!o.at && plan.segments.length === 0 && !forever;
      const given = o.endMs !== undefined || atOnly;
      let endMs = o.endMs ?? (atOnly ? Math.max(...o.at!) : (forever?.endMs ?? plan.endMs));
      const startMs = o.startMs ?? (given ? 0 : (forever?.startMs ?? plan.startMs));
      // --at chooses the frames; the segments are still the page's own spans of motion.
      const segments = given || forever ? [{ startMs, endMs }] : plan.segments.map((g) => ({ ...g }));
      const instants = (
        o.at
          ? [...new Set(o.at)].sort((a, b) => a - b)
          : given
            ? (() => {
                // A script's motion has no keyframes to plan by and a --track costs nothing a frame:
                // every frame of the span (up to 120). With 11, a 200px jump between two of them sat
                // at the jump rule's threshold.
                const n =
                  o.tracks.length > 0
                    ? Math.min(120, Math.max(11, Math.round(((endMs - startMs) * 60) / 1000)))
                    : undefined;
                const m = motionInstants(startMs, endMs, n);
                return [...m.motion, m.rest];
              })()
            : forever
              ? motionInstants(startMs, endMs, 31).motion
              : [...plan.motion, plan.rest]
      )
        // clockNow is a sum of frame times and an instant is computed from a start: the same frame can
        // differ by an ulp, and the frame a close begins on (233.33ms on CI) was dropped by it.
        .filter((t) => t >= clockNow - 1e-6);
      // What a script draws (a --track target) is the picture of the last animation frame run:
      // shot between frames, it is up to 16ms old, and a linear slide read a 17px jump into rest.
      // Each instant is put on the nearest frame, and the clock is run to it: the last one inside the
      // motion (799ms) lands on its end (800ms), drawn at its last step.
      if (o.tracks.length > 0)
        instants.splice(
          0,
          instants.length,
          ...[...new Set(instants.map((t) => frameTimeMs(Math.round((t * 60) / 1000))))].filter(
            (t) => t >= clockNow - 1e-6,
          ),
        );
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
      // The plan is made at load. An animation the page holds and releases later (a boot class lifted
      // when the fonts are in, 300ms late) is still running at the planned rest frame, which then read
      // a jump "11px off where it rests" (round 16): the rest frame waits for its real end.
      let replanned: string | undefined;
      for (let k = 0; k < instants.length; k++) {
        const atMs = instants[k]!;
        await timeline.at(atMs);
        if (atMs > endMs && !replanned && !o.at && !given && !forever && o.selectors.length > 0) {
          const late = (await measureTargets(page, o.selectors)).flatMap((d, i) => {
            if (!d || typeof d.durationMs !== "number" || typeof d.elapsedMs !== "number" || d.iterations === null)
              return [];
            const runs = d.durationMs * (d.iterations ?? 1);
            if (!Number.isFinite(runs) || d.elapsedMs <= 0 || d.elapsedMs >= runs - 1) return [];
            return [{ sel: o.selectors[i]!, end: atMs + (runs - d.elapsedMs), start: atMs - d.elapsedMs }];
          });
          if (late.length > 0) {
            const lateEnd = Math.ceil(Math.max(...late.map((x) => x.end)));
            const lateStart = Math.min(...late.map((x) => x.start));
            replanned = `${late.map((x) => x.sel).join(", ")} began later than the page's animations were timed at load (${late.map((x) => `${x.sel} at ${Math.round(x.start)}ms`).join(", ")}: something held them and released them later), so frames were added up to ${lateEnd}ms and the rest frame moved past it; the frames before ${Math.round(atMs)}ms were planned without it`;
            const last = segments[segments.length - 1];
            if (last && lateStart <= last.endMs) last.endMs = Math.max(last.endMs, lateEnd);
            else segments.push({ startMs: Math.round(lateStart), endMs: lateEnd });
            endMs = lateEnd;
            const more = motionInstants(atMs, lateEnd, 6);
            instants.splice(k, instants.length - k, ...more.motion, more.rest);
            k--;
            continue;
          }
        }
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
      // At rest (the last frame shot), each target's span against the element it should match.
      const spans = o.expectSpanOf
        ? await page
            .evaluate(
              ({ sels, of }) =>
                sels.map((sel, i) => {
                  const other = of.length === 1 ? of[0] : of[i];
                  if (!other) return null;
                  const a = document.querySelector(sel)?.getBoundingClientRect();
                  const b = document.querySelector(other)?.getBoundingClientRect();
                  return a && b
                    ? { of: other, left: a.left, right: a.right, wantLeft: b.left, wantRight: b.right }
                    : { of: other, missing: true as const };
                }),
              { sels: o.selectors, of: o.expectSpanOf },
            )
            .catch(() => [])
        : undefined;
      const delays = o.selectors.length > 0 ? await delaySources(page, o.selectors) : undefined;
      // Where a repeating run ends against where the next begins: a spinner whose keyframes end at
      // 350deg jumped 10deg forward once a second, and every frame read "follows linear in its
      // turn, no fail" (round 10). Its state a ms before the seam, at it, and a ms before that.
      const seams = await page
        .evaluate((sels) => {
          const out: { selector: string; message: string }[] = [];
          const read = (el: Element) => {
            const cs = getComputedStyle(el);
            // The individual rotate / translate / scale properties too: a spinner turned by
            // `rotate` read as never turning (held-out set).
            let m = new DOMMatrix();
            if (cs.translate && cs.translate !== "none") {
              const [x = "0", y = "0"] = cs.translate.split(/\s+/);
              m = m.translate(parseFloat(x) || 0, parseFloat(y) || 0);
            }
            if (cs.rotate && cs.rotate !== "none") {
              const parts = cs.rotate.split(/\s+/);
              const a = parts[parts.length - 1]!;
              const deg = a.endsWith("rad")
                ? (parseFloat(a) * 180) / Math.PI
                : a.endsWith("turn")
                  ? parseFloat(a) * 360
                  : parseFloat(a);
              if (parts.length === 1 || parts[0] === "z") m = m.rotate(deg);
            }
            if (cs.scale && cs.scale !== "none") {
              const [sx = "1", sy = sx] = cs.scale.split(/\s+/);
              m = m.scale(parseFloat(sx), parseFloat(sy));
            }
            if (cs.transform && cs.transform !== "none") m = m.multiply(new DOMMatrix(cs.transform));
            return {
              x: m.e,
              y: m.f,
              deg: (Math.atan2(m.b, m.a) * 180) / Math.PI,
              sx: Math.hypot(m.a, m.b),
              op: Number(cs.opacity),
            };
          };
          const turn = (a: number, b: number) => ((b - a + 540) % 360) - 180;
          // What is in view of it: its children (or itself), clipped by every ancestor that clips and
          // by the viewport, each with its content. A ticker one copy long and a shimmer whose two ends
          // are both clipped away jump in their transform and in nothing seen (authoring v1).
          const inView = (el: Element) => {
            let clip = { l: 0, t: 0, r: innerWidth, b: innerHeight };
            for (let n = el.parentElement; n; n = n.parentElement) {
              const cs = getComputedStyle(n);
              if (cs.overflowX !== "visible" || cs.overflowY !== "visible" || cs.clipPath !== "none") {
                const q = n.getBoundingClientRect();
                clip = {
                  l: Math.max(clip.l, q.left),
                  t: Math.max(clip.t, q.top),
                  r: Math.min(clip.r, q.right),
                  b: Math.min(clip.b, q.bottom),
                };
              }
            }
            const parts = el.children.length > 0 ? [...el.children] : [el];
            return parts
              .map((c) => ({
                q: c.getBoundingClientRect(),
                key: `${c.tagName}.${c.className}|${(c.textContent ?? "").trim().slice(0, 80)}`,
              }))
              .filter(
                ({ q }) =>
                  q.right > clip.l + 0.5 && q.left < clip.r - 0.5 && q.bottom > clip.t + 0.5 && q.top < clip.b - 0.5,
              )
              .map(({ q, key }) => ({ x: q.left, y: q.top, w: q.width, h: q.height, key }));
          };
          const sameView = (a: ReturnType<typeof inView>, b: ReturnType<typeof inView>) =>
            a.length === b.length &&
            a.every((p) =>
              b.some(
                (q) =>
                  q.key === p.key &&
                  Math.abs(q.x - p.x) < 1.5 &&
                  Math.abs(q.y - p.y) < 1.5 &&
                  Math.abs(q.w - p.w) < 1.5 &&
                  Math.abs(q.h - p.h) < 1.5,
              ),
            );
          for (const sel of sels) {
            const el = document.querySelector(sel);
            if (!el) continue;
            for (const a of el.getAnimations()) {
              const t = a.effect?.getComputedTiming();
              const d = Number(t?.duration);
              if (!t || !Number.isFinite(d) || d <= 4 || (t.iterations !== Infinity && Number(t.iterations) < 2))
                continue;
              if (t.direction === "alternate" || t.direction === "alternate-reverse") continue;
              // steps() jumps at every step by design, the loop's included: a 45° dot loader read
              // as a 45° seam (held-out set). check animation leaves it out for the same reason.
              const stepped =
                /steps\(|step-(start|end)/.test(String(t.easing ?? "")) ||
                (a.effect as KeyframeEffect)
                  .getKeyframes()
                  .some((k) => /steps\(|step-(start|end)/.test(String(k.easing ?? "")));
              if (stepped) continue;
              const delay = Number(t.delay) || 0;
              const was = a.currentTime;
              a.pause();
              const at = (ms: number) => {
                a.currentTime = delay + ms;
                return read(el);
              };
              const p0 = at(d - 2),
                p1 = at(d - 1);
              // The drawn view either side of the seam, a ms apart as the poses are.
              const v1 = inView(el);
              const p2 = at(d + 0.001);
              const v2 = inView(el);
              const p3 = at(d + 1);
              a.currentTime = was;
              const unseen = sameView(v1, v2);
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
                  ? ` (its keyframes run from ${String(kf[0]!.transform ?? kf[0]!.rotate ?? kf[0]!.opacity ?? "?")} to ${String(kf[kf.length - 1]!.transform ?? kf[kf.length - 1]!.rotate ?? kf[kf.length - 1]!.opacity ?? "?")})`
                  : "";
              if (jump > Math.max(1, 3 * rate)) {
                out.push({
                  selector: sel,
                  message: `${sel} \`${name}\` turns ${jump.toFixed(1)}° in one step at every loop (${rate.toFixed(2)}° a ms either side)${ends}: each run ends where the next does not begin — end it on the same pose it starts on (360deg, not 350deg)`,
                });
              } else if (move > Math.max(1, 3 * moveRate) && !unseen) {
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
        ...(replanned ? { replanned } : {}),
        manifest: written.manifest,
        files,
        viewport: o.viewport,
        textLines,
        context,
        ...(delays ? { delays } : {}),
        ...(spans ? { spans } : {}),
        ...(layoutMovers.length > 0 ? { layoutMovers } : {}),
        ...(seams.length > 0 ? { seams } : {}),
        ...(replays.length > 0 ? { replays } : {}),
        ...(forever ? { forever: true } : {}),
        ...(interrupt ? { interrupt } : {}),
        ...(lastBefore ? { beforeLast: lastBefore } : {}),
        ...(lastActionAtMs !== undefined ? { lastActionAtMs } : {}),
        ...(elsewhere.length > 0 ? { elsewhere } : {}),
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
    // A jump the other way from where its new motion then goes: a menu half open (121px) clicked
    // shut leapt to 177px and folded from there. An ease-out close's first step is large, so "more
    // than twice any step after" missed it (authoring v2).
    const last = doms[doms.length - 1]!;
    const dims = (x: MotionDom) => [
      x.box.width,
      x.box.height,
      x.box.x + x.box.width / 2,
      x.box.y + x.box.height / 2,
      x.opacity * 100,
    ];
    const [da, db, dl] = [dims(a), dims(b), dims(last)];
    const backwards = da.some((v, k) => {
      const leap = db[k]! - v,
        then = dl[k]! - db[k]!;
      return Math.abs(leap) >= 8 && Math.abs(then) >= 8 && Math.sign(leap) === -Math.sign(then);
    });
    if ((jump >= 8 && jump > 2 * step) || (opJump >= 0.2 && opJump > 2 * opStep) || backwards) {
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
  return {
    frames,
    startMs,
    endMs: o.endMs!,
    segments: [{ startMs, endMs: o.endMs! }],
    manifest: path,
    files,
    deviceScale: manifest.source.deviceScaleFactor ?? 1,
  };
}

/**
 * Each `--track` region found in every frame by its pixels (`trackRegion`), as the frame's measure
 * of that target: its box, and how well it matches as the share seen. The template is the last
 * frame shot (the rest frame on a page), where the region was given. No opacity, scale or turn is
 * measured: they stay 1, 1 and none.
 */
export async function applyTracks(
  frames: MotionFrame[],
  tracks: readonly TrackBox[],
  before: number,
  deviceScale: number,
): Promise<void> {
  if (tracks.length === 0 || frames.length === 0) return;
  const { decodePngPixels } = await import("@mizchi/vlmkit-core/png-decode.ts");
  const { trackRegion } = await import("@mizchi/vlmkit-judge/pixel-track.ts");
  const decoded = frames.map((f) => decodePngPixels(f.png));
  const k = scaleBox(deviceScale);
  for (const [j, region] of tracks.entries()) {
    const found = trackRegion(decoded, k(region));
    for (const [n, f] of frames.entries()) {
      const r = found[n]!;
      const dom = f.dom ?? Array.from({ length: before }, () => null);
      dom[before + j] = {
        box: scaleBox(1 / deviceScale)(r.box),
        opacity: 1,
        scale: 1,
        visible: r.present,
        onScreen: 1,
      };
      f.dom = dom;
    }
  }
}

const scaleBox =
  (k: number) =>
  (b: TrackBox): TrackBox => ({ x: b.x * k, y: b.y * k, width: b.width * k, height: b.height * k });

/**
 * The part of a path across its way: "travels 200px rightwards" read as a straight slide for a
 * card that came in 20° off, 68px upwards on the way (round 14).
 */
function acrossText(d: { way: string; from: { x: number; y: number }; to: { x: number; y: number } }): string {
  const horizontal = d.way === "left" || d.way === "right";
  const along = Math.abs(horizontal ? d.to.x - d.from.x : d.to.y - d.from.y);
  const across = horizontal ? d.to.y - d.from.y : d.to.x - d.from.x;
  if (Math.abs(across) < Math.max(8, along * Math.tan((5 * Math.PI) / 180))) return "";
  const side = horizontal ? (across < 0 ? "upwards" : "downwards") : across < 0 ? "leftwards" : "rightwards";
  return ` (and ${Math.round(Math.abs(across))}px ${side})`;
}

/**
 * A box that grows from one edge (a bar filling): its centre travels half its growth, and "travels
 * 184px rightwards" read as a slide of a bar that grew 369px from its left edge (round 17).
 */
function growsFromEdge(t: {
  path: { x: number; y: number; width?: number; height?: number; rest: boolean }[];
  turn?: unknown;
  swing?: unknown;
  pivot?: unknown;
}): string {
  // A turned box's bounds grow as it turns: a needle read "its box grows 104px from its bottom
  // edge" (authoring v2).
  if (t.turn || t.swing || t.pivot) return "";
  const p = t.path.filter((q) => q.width !== undefined && q.height !== undefined);
  if (p.length < 2) return "";
  const a = p[0]!;
  const b = p[p.length - 1]!;
  for (const [axis, size, lo, hi] of [
    ["x", "width", "left", "right"],
    ["y", "height", "top", "bottom"],
  ] as const) {
    const grew = b[size]! - a[size]!;
    if (Math.abs(grew) < 4) continue;
    const startA = a[axis] - a[size]! / 2;
    const startB = b[axis] - b[size]! / 2;
    const endA = a[axis] + a[size]! / 2;
    const endB = b[axis] + b[size]! / 2;
    const edge = Math.abs(startB - startA) <= 1 ? lo : Math.abs(endB - endA) <= 1 ? hi : null;
    // Where the edge stays, as a number: an agent took "stays put" for the 40px a brief asked for when
    // the box sat at 41 (a card's 1px border; motion-authoring small-model round).
    const at = edge === lo ? startA : endA;
    if (edge)
      return ` (its centre: its box ${grew > 0 ? "grows" : "shrinks"} ${Math.round(Math.abs(grew))}px from its ${edge} edge, which stays put at ${axis} = ${Math.round(at * 10) / 10})`;
  }
  return "";
}

export function formatMotionReport(
  source: string,
  captured: Captured,
  r: MotionCheckReport,
  forbid: readonly string[] = [],
  deviceScale = 1,
): string {
  const lines: string[] = [];
  const restCount = captured.frames.filter((f) => f.atMs > captured.endMs).length;
  lines.push(
    `inspect motion: ${source} — ${captured.forever ? "every animation repeats forever, so the first runs are sampled and nothing rests; " : ""}${captured.frames.length - restCount} frames over ${Math.round(Math.max(0, Math.min(captured.startMs, captured.frames[0]?.atMs ?? captured.startMs)))}..${Math.round(captured.endMs)}ms${(captured.frames[0]?.atMs ?? captured.startMs) < captured.startMs ? ` (motion from ${Math.round(captured.startMs)}ms; the frames before it show the wait)` : ""}${
      // A negative delay starts motion before the page is shown: "6 frames over -240..300ms" with the
      // first frame at 30ms (round 15).
      captured.startMs < 0
        ? ` (motion from ${Math.round(captured.startMs)}ms: some of it began before the page was shown, and only what runs from 0 is in the frames)`
        : ""
    } + ${restCount} at rest (${captured.manifest})`,
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
    // Channels that follow one curve exactly are said once: "follows ease-out exactly …; follows
    // ease-out in its opacity exactly …" read as the same claim twice (round 14).
    const exact = (f: Fit) => !Number.isFinite(f.margin) || f.margin >= 1000;
    const out: string[] = [];
    const done = new Set<Fit>();
    for (const c of channels) {
      if (done.has(c)) continue;
      const same = exact(c) ? channels.filter((d) => !done.has(d) && exact(d) && d.best === c.best) : [c];
      if (same.length < 2 || (fadeOwner && same.some((d) => d.channel === "opacity"))) {
        done.add(c);
        out.push(oneFit(c));
        continue;
      }
      for (const d of same) done.add(d);
      const names = same.map((d) =>
        !d.channel || d.channel === "position"
          ? "its path"
          : d.channel === "drawn"
            ? "its drawn length"
            : `its ${d.channel}`,
      );
      out.push(
        `follows ${c.best} exactly in ${names.slice(0, -1).join(", ")} and ${names[names.length - 1]} (measured: no other curve comes close)`,
      );
    }
    return out.join("; ");
  };
  // Where a scale grows from, and when the target's own animation begins: printed whether or
  // not they were expected, since round 3's wrong transform-origin and missing stagger each
  // passed "follows ease-out exactly" with nothing on screen that said where or when.
  // A turn's pivot, said as a point: one outside the box read "about no point of its box (it moves
  // as well as it scales)" — a scale's wording — on a needle turning about a point above it.
  const pivotText = (p: Parameters<typeof describeOrigin>[0] & { ux?: number; uy?: number }) => {
    const own =
      p.ux !== undefined && p.uy !== undefined
        ? `${Math.round(p.ux * 10) / 10},${Math.round(p.uy * 10) / 10} in its own units`
        : "";
    const d = describeOrigin(p);
    if (d.startsWith("no point")) return own ? `${own}, outside its box` : "a point outside its box";
    // A named point is enough; an unnamed one is given as a point too (the flag to hold it there).
    return own && !p.name ? `${d}, ${own}` : d;
  };
  const grows = (g: { origin?: Parameters<typeof describeOrigin>[0] }, shrinks = false) =>
    g.origin ? `; the scale ${shrinks ? "shrinks towards" : "grows from"} ${describeOrigin(g.origin)}` : "";
  const begins = (t: { startsAtMs?: number; durationMs?: number; iterations?: number | null; runs?: number[] }) =>
    (t.startsAtMs !== undefined ? `, begins at ${Math.round(t.startsAtMs)}ms` : "") +
    (t.durationMs !== undefined ? `, runs ${Math.round(t.durationMs)}ms` : "") +
    // An entrance beside a loop: "runs 1600ms and repeats forever" said nothing of the 400ms rise.
    (t.runs && t.runs.length > 1 ? ` (its animations run ${t.runs.map((d) => `${d}ms`).join(", ")})` : "") +
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
    // A swing or a turn in place: its centre stays, and "travels 0px … no easing fit" read as a
    // failure beside a bell that swung exactly as asked (authoring v2).
    const inPlace = !!(t.swing || (t.turn && !t.turn.in3d)) && t.travelPx < 2;
    const turnsInPlace = inPlace && !("best" in t.easing);
    // A shrink says so: a card settling back read "the scale grows … from 1.00 to 1.08" (authoring v2).
    const ks0 = doms.map((d) => d!.scale).filter((k): k is number => typeof k === "number" && k > 0);
    const shrinks = ks0.length >= 2 && ks0[ks0.length - 1]! < ks0[0]! - 0.005;
    if (t.segments.length <= 1) {
      lines.push(
        `  target ${JSON.stringify(t.target)}${begins(t)}: ${inPlace ? "stays in place" : `travels ${Math.round(t.travelPx)}px`}${t.segments[0]?.direction ? ` ${t.segments[0].direction.way}wards${acrossText(t.segments[0].direction)}` : ""} over the frames measured${
          // A gear orbiting back to its start read "travels 0px" (round 12).
          t.excursionPx !== undefined && t.excursionPx >= Math.max(4, t.travelPx * 2)
            ? ` (ending where it began; ${Math.round(t.excursionPx)}px away at most, between)`
            : ""
        }${growsFromEdge(t)}${
          t.turn
            ? t.turn.in3d
              ? // In 3D the turn is its face's angle, 0 facing you to 180 turned over: no way round.
                `, turns over ${Math.round(Math.abs(t.turn.deg))}° in 3D`
              : `, turns ${t.turn.deg > 0 ? "clockwise" : "counterclockwise"} ${Math.round(Math.abs(t.turn.deg))}° (${Math.round(Math.abs(t.turn.perSecond))}°/s${Math.abs(t.turn.perSecond) >= 1 ? `, a turn every ${Math.round(360000 / Math.abs(t.turn.perSecond))}ms` : ""})${t.screenTurn ? ` on its own` : ""}`
            : ""
        }${t.pivot && t.turn && !t.turn.in3d && !t.swing ? ` (about ${pivotText(t.pivot)})` : ""}${
          // Back and forth: the way it turns first and its turning points (a bell's swing).
          t.swing
            ? `, swings ${t.swing.way} first${t.pivot ? ` about ${pivotText(t.pivot)}` : ""}: ${t.swing.peaksDeg.map((d) => `${d > 0 ? "+" : ""}${Math.round(d)}°`).join(", ")}${Math.abs(t.swing.restDeg) < 1 ? ", then upright" : `, ending at ${Math.round(t.swing.restDeg)}°`} (turning points at the frames measured, clockwise +; --at a..b/10ms for exact peaks)`
            : ""
        }${
          // What is seen: an ancestor turns it too, and its own turn is a counter-rotation.
          t.screenTurn
            ? t.screenTurn.deg <= 1
              ? `; on screen, with ${t.screenTurn.by}'s turn, it stays upright (its angle changes by under 1°)`
              : `; on screen, with ${t.screenTurn.by}'s turn, its angle changes by ${Math.round(t.screenTurn.deg)}° (--expect-upright fails that)`
            : ""
        }${
          t.sweepDeg !== undefined
            ? `, its conic arc sweeps ${t.sweepDeg > 0 ? "clockwise" : "counterclockwise"} ${Math.round(Math.abs(t.sweepDeg))}°`
            : ""
        }, ${turnsInPlace ? (t.swing ? "a swing back and forth, so no single curve is fitted to it" : "its turn is not fitted to a curve (its centre does not travel)") : fitText(t.easing, broken)}${(() => {
          const e = doms.find((d) => d!.ownEasing)?.ownEasing;
          return e ? ` (its own timing function is ${e}: the curve names here are the nearest built-in ones)` : "";
        })()}${t.segments[0] ? grows(t.segments[0], shrinks) : ""}${(() => {
          // How far it scales: a pulse to 104% was only in the JSON (round 18). In frame order, so
          // a settle-back reads 1.08 to 1.00, with a peak past both ends said as one.
          const ks = ks0;
          if (ks.length < 2) return "";
          const lo = Math.min(...ks);
          const hi = Math.max(...ks);
          if (hi - lo < 0.01) return "";
          const a = ks[0]!,
            b = ks[ks.length - 1]!;
          const peak = hi > Math.max(a, b) + 0.005 ? hi : lo < Math.min(a, b) - 0.005 ? lo : undefined;
          return ` (its scale goes from ${a.toFixed(2)} to ${b.toFixed(2)}${peak !== undefined ? `, ${peak === hi ? "peaking" : "dipping"} at ${peak.toFixed(2)} in the frames measured` : ""})`;
        })()}`,
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
      r.calls === 0 && captured.tracked
        ? `${captured.tracked === r.targets.length ? "" : "the --selector targets measured from the page, "}${captured.tracked === 1 ? "the --track target" : `${captured.tracked} --track targets`} found by ${captured.tracked === 1 ? "its" : "their"} pixels — where ${captured.tracked === 1 ? "it is" : "each is"} and how well ${captured.tracked === 1 ? "it matches" : "each matches"}, not size, turn or opacity; no model asked`
        : r.calls === 0
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
    if (w > 0 && h > 0 && w * h < 0.75 * vw * vh) {
      // The strip crops frame pixels: at --device-scale 2 a CSS box is twice the size.
      const k = deviceScale;
      crop = ` --crop ${cx0 * k},${cy0 * k},${w * k},${h * k}`;
    }
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
    const page = await openMotionPage(browser, o);
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
          const sa = first.stops ?? [];
          const sb = last.stops ?? [];
          if (sa.length === sb.length && sa.some((v, k) => Math.abs(v - sb[k]!) >= 8)) changes.push("its gradient");
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

/**
 * Reduced motion with nothing animating: each target from the first frame, shown and where the
 * page rests with motion (its finite animations finished). A reveal left at opacity 0 by
 * `animation: none`, or a card left 32px below its place, fails.
 */
async function reducedRest(o: MotionCliOptions): Promise<number> {
  const { withBrowser } = await import("@mizchi/vlmkit-core/browser-launch.ts");
  const { sourceToUrl } = await import("@mizchi/vlmkit-core/page-open.ts");
  const url = sourceToUrl(o.source);
  return withBrowser(async (browser) => {
    const still = await openMotionPage(browser, o);
    const moving = await openMotionPage(browser, { ...o, reducedMotion: false });
    try {
      await still.goto(url, { waitUntil: "load" });
      await moving.goto(url, { waitUntil: "load" });
      const a = await measureTargets(still, o.selectors);
      const forever = await moving.evaluate(async (sels) => {
        for (const an of document.getAnimations()) {
          try {
            if (an.effect?.getComputedTiming().endTime !== Infinity) an.finish();
          } catch {}
        }
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        return sels.map((sel) => {
          const el = document.querySelector(sel);
          return (
            !!el && el.getAnimations({ subtree: false }).some((x) => x.effect?.getComputedTiming().endTime === Infinity)
          );
        });
      }, o.selectors);
      const b = await measureTargets(moving, o.selectors);
      const lines = [
        `inspect motion: ${o.source} — under prefers-reduced-motion: reduce nothing animates at load; each target from the first frame, against where the page rests with motion`,
      ];
      let fails = 0;
      const pos = (d: MotionDom) =>
        `${Math.round(d.box.x)},${Math.round(d.box.y)} ${Math.round(d.box.width)}x${Math.round(d.box.height)}`;
      o.targets.forEach((t, i) => {
        const r = a[i],
          m = b[i];
        if (!r) {
          lines.push(`  target ${JSON.stringify(t)}: matches nothing on the page`);
          lines.push(`    FAIL reduced-motion-hides: ${o.selectors[i]} matches no element`);
          fails++;
          return;
        }
        const seen = r.opacity >= 0.05 && (r.visible ?? 1) >= 0.5;
        lines.push(
          `  target ${JSON.stringify(t)}: ${seen ? "shown" : "not shown"} from the first frame (opacity ${r.opacity.toFixed(2)}${r.visible !== undefined ? `, ${r.visible.toFixed(2)} seen` : ""}), at ${pos(r)}${m ? `; with motion it rests at ${pos(m)}` : ""}`,
        );
        if (!seen) {
          fails++;
          lines.push(
            `    FAIL reduced-motion-hides: ${r.hiddenBy ?? `it renders at opacity ${r.opacity.toFixed(2)}`} — with no animation left to bring it in, it stays as its first keyframe or base style leaves it (animation: none over a base of opacity 0 is the usual cause: give the base its resting style, or keep the entrance with a backwards fill)`,
          );
          return;
        }
        if (m && !forever[i]) {
          const off = Math.max(
            Math.abs(r.box.x - m.box.x),
            Math.abs(r.box.y - m.box.y),
            Math.abs(r.box.width - m.box.width),
            Math.abs(r.box.height - m.box.height),
          );
          if (off > 1) {
            fails++;
            lines.push(
              `    FAIL reduced-motion-misplaced: ${Math.round(off)}px off where it rests with motion — what reduced motion leaves on screen is the base style, not the animation's end (a translate kept in the base, or a fill the reduced rule dropped)`,
            );
          }
        } else if (m && forever[i]) lines.push(`    (it animates forever with motion: its place is not compared)`);
      });
      lines.push(
        fails === 0
          ? "  no fail; measured from the page, no model asked"
          : `  ${fails} fail; measured from the page, no model asked`,
      );
      console.log(lines.join("\n"));
      return fails === 0 ? 0 : 1;
    } finally {
      await still.close();
      await moving.close();
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
  if (o.expectLines) yield "lines";
  if (o.expectDirection) yield "direction";
  if (o.expectStill) yield "still";
  if (o.expectUpright) yield "upright";
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
    // The usage lines and the error, not the whole help: 100 lines for one mistyped flag buried it
    // (round 13), and printed below them it scrolled off (round 4).
    const usage = MOTION_USAGE.split("\n\n")[0];
    console.error(`${usage}\n\nerror: ${(e as Error).message}\n(vlmkit inspect motion --help lists every option)`);
    return 2;
  }
  // Refused before a browser starts: without a key nothing could answer.
  if (o.jev && !process.env.TYPESAFEAI_API_KEY && !process.env.TYPESAFE_API_KEY) {
    console.error(
      "error: --jev asks TypeSafe Jev and needs TYPESAFEAI_API_KEY (console.typesafe.ai/keys). Without --jev, give each target a --selector.",
    );
    return 2;
  }
  // Each action's motion, one run each: "--hover .help --leave" measured only the fade-out, and the
  // fade-in took a second command (round 14). --exits is the last action's.
  const acts = o.actions.flatMap((a, k) => (a.kind === "wait" ? [] : [k]));
  if (o.everyAction && acts.length > 1) {
    let worst = 0;
    for (const [n, k] of acts.entries()) {
      const step: MotionCliOptions = {
        ...o,
        actions: o.actions.slice(0, k + 1),
        exits: n === acts.length - 1 ? o.exits : false,
        frames: join(o.frames, `action-${n + 1}`),
        everyAction: false,
        inEveryAction: true,
        // One value per action: this step's.
        ...(o.expectDirection && o.expectDirection.length === acts.length && acts.length !== o.targets.length
          ? { expectDirection: [o.expectDirection[n]!] }
          : {}),
        ...(o.expectDurationMs && o.expectDurationMs.length === acts.length && acts.length !== o.targets.length
          ? { expectDurationMs: [o.expectDurationMs[n]!] }
          : {}),
        ...(o.expectIterations && o.expectIterations.length === acts.length && acts.length !== o.targets.length
          ? { expectIterations: [o.expectIterations[n]!] }
          : {}),
      };
      console.log(`== ${n + 1}/${acts.length}: the motion ${describeAction(o.actions[k]!)} starts`);
      worst = Math.max(worst, await runMotionOptions(step, argv));
    }
    return worst;
  }
  return runMotionOptions(o, argv);
}

async function runMotionOptions(o: MotionCliOptions, argv: string[]): Promise<number> {
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
    // Under reduced motion a page that animates nothing is what was asked: judge where each target
    // is from the first frame, against where it rests with motion. "no animation … nothing to
    // sample" read as a broken page (v2 and the small-model round's reveal).
    if (e instanceof NothingAnimatesError && o.reducedMotion && o.actions.length === 0 && !o.jev) return reducedRest(o);
    // A canvas runs no animation the page can list: its span is the one thing it cannot tell.
    if (e instanceof NothingAnimatesError && o.tracks.length > 0) {
      console.error(
        "error: no CSS animation or transition runs on the page, so the motion's span cannot be read from it: a --track target drawn by a script (a canvas, requestAnimationFrame) needs --end <ms>, when its motion is over (frames run from --start, 0 by default), or --at <instants>",
      );
      return 2;
    }
    if (e instanceof SnappedError) {
      if (e.changed.length === 0 && e.heldBy.length > 0) {
        console.log(
          `inspect motion: ${o.source} — after ${o.actions.map(describeAction).join(", ")}, nothing changed and no animation or transition started`,
        );
        for (const h of e.heldBy) console.log(`    FAIL held-by-fill: ${h.selector}: ${h.cause}`);
        console.log(`  no frames written: nothing animated to shoot`);
        console.log(`  ${e.heldBy.length} fail; measured from the page, no model asked`);
        return 1;
      }
      if (e.changed.length === 0) {
        console.error(
          `error: nothing animated after ${o.actions.map(describeAction).join(", ")}, and no --selector target changed: check the action reaches the control (and that --selector names what it changes)`,
        );
        return 2;
      }
      // Under reduced motion, going at once is what is asked: a tab indicator that jumps to the new
      // tab could not be checked at all (authoring v1).
      if (o.reducedMotion) {
        console.log(
          `inspect motion: ${o.source} — under prefers-reduced-motion: reduce, after ${o.actions.map(describeAction).join(", ")}, no animation or transition started`,
        );
        for (const c of e.changed) console.log(`    ${c} at once, with no motion: what reduced motion asks for`);
        console.log(`  no fail; measured from the page, no model asked`);
        return 0;
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
    if (e instanceof ActionBlockedError) {
      console.log(`inspect motion: ${o.source} — an action could not reach its target`);
      console.log(`    FAIL action-blocked: ${e.message}`);
      console.log(`  no frames written: the motion it starts never began`);
      console.log(`  1 fail; measured from the page, no model asked`);
      return 1;
    }
    if (!(e instanceof MotionUsageError)) throw e;
    console.error(`error: ${e.message}`);
    return 2;
  }
  await applyTracks(captured.frames, o.tracks, o.selectors.length, captured.deviceScale ?? o.deviceScale);
  if (o.tracks.length > 0) captured.tracked = o.tracks.length;
  const { checkMotionFrames } = await import("@mizchi/vlmkit-ai/motion-check.ts");
  // The pointer leaving what showed a target: gone at rest is its end. A repaired help bubble failed
  // absent-at-rest after --hover .help --leave until --exits was added (round 14).
  const lastAct = o.actions.filter((a) => a.kind !== "wait").at(-1);
  const leaveExits =
    !o.exits &&
    lastAct?.kind === "leave" &&
    (captured.beforeLast?.targets ?? []).some(
      (b) => b && !b.notRendered && b.opacity >= 0.5 && (b.visible ?? 0) >= 0.5,
    );
  const r = await checkMotionFrames(captured.frames, {
    targets: o.targets,
    forbid: o.forbid,
    startMs: captured.startMs,
    endMs: captured.endMs,
    segments: captured.segments,
    threshold: o.threshold,
    exits: o.exits || leaveExits,
    ...(o.exitSelectors.length > 0 ? { exitsFor: o.selectors.map((sel) => o.exitSelectors.includes(sel)) } : {}),
    jev: o.jev,
    ...(o.deviceScale !== 1 ? { frameScale: o.deviceScale } : {}),
    ...motionEasingOptions(o.expectEasing),
    // Keywords and points apart: a point is a turn's pivot in the element's own units.
    ...(o.expectOrigin
      ? {
          expectOrigin: o.expectOrigin.map((v) => (typeof v === "string" ? v : undefined)),
          expectPivot: o.expectOrigin.map((v) => (v && typeof v === "object" ? v : undefined)),
        }
      : {}),
    ...(o.expectStartMs
      ? {
          expectStartMs: o.expectStartMs.map((v, i) =>
            v !== undefined && o.expectStartAfterAction?.[i] ? v + (captured.lastActionAtMs ?? 0) : v,
          ),
        }
      : {}),
    ...(o.expectStaggerMs !== undefined ? { expectStaggerMs: o.expectStaggerMs } : {}),
    ...(o.expectDurationMs ? { expectDurationMs: o.expectDurationMs } : {}),
    ...(o.expectIterations ? { expectIterations: o.expectIterations } : {}),
    ...(o.expectLines ? { expectLines: o.expectLines } : {}),
    ...(o.expectDirection ? { expectDirection: o.expectDirection } : {}),
    ...(o.expectStill ? { expectStill: true } : {}),
    ...(o.expectUpright ? { expectUpright: true } : {}),
    ...(o.stillSelectors.length > 0
      ? { expectStillFor: o.selectors.map((sel) => o.stillSelectors.includes(sel)) }
      : {}),
    ...(captured.layoutMovers ? { layoutMovers: captured.layoutMovers } : {}),
  });
  // Shown just before the last action and hidden from its first frame on: not "never seen". A help
  // bubble whose visibility flipped at once as the pointer left read target-hidden, "never seen
  // in any frame", while it had been on screen through the hover (round 14).
  for (const [i, t] of r.targets.entries()) {
    const before = captured.beforeLast?.targets[i];
    if (!before || before.notRendered || before.opacity < 0.5 || (before.visible ?? 0) < 0.5) continue;
    const hidden = t.findings.find((f) => f.rule === "target-hidden");
    if (!hidden) continue;
    const vis = /visibility: hidden/.test(hidden.message);
    t.findings = t.findings.map((f) =>
      f !== hidden
        ? f
        : {
            ...f,
            rule: "hidden-at-once" as typeof f.rule,
            message: `shown before ${captured.beforeLast!.action} (opacity ${before.opacity.toFixed(2)}), and hidden from the first frame after it, so no exit is seen${hidden.message.includes(" — ") ? ` — ${hidden.message.split(" — ").slice(1).join(" — ")}` : ""}${vis ? `: visibility changes at once (it is discrete) while the opacity transition runs underneath it — list it in the transition (transition: opacity 200ms, visibility 200ms) so it stays visible until the fade ends` : ""}`,
          },
    );
  }
  // Its span at rest against the element it should match (a tab indicator under its tab).
  for (const [i, t] of r.targets.entries()) {
    const sp = captured.spans?.[i];
    if (!sp) continue;
    if ("missing" in sp) {
      t.findings.push({
        rule: "span-mismatch" as (typeof t.findings)[number]["rule"],
        severity: "fail",
        atMs: captured.endMs,
        message: `--expect-span-of ${sp.of}: it or ${sp.of} is not on the page at rest`,
      });
      continue;
    }
    const dl = sp.left - sp.wantLeft,
      dr = sp.right - sp.wantRight;
    if (Math.abs(dl) > 1 || Math.abs(dr) > 1)
      t.findings.push({
        rule: "span-mismatch" as (typeof t.findings)[number]["rule"],
        severity: "fail",
        atMs: captured.endMs,
        message: `at rest it spans ${sp.left.toFixed(1)}..${sp.right.toFixed(1)}px across, and ${sp.of} spans ${sp.wantLeft.toFixed(1)}..${sp.wantRight.toFixed(1)}px: its left edge is ${dl.toFixed(1)}px and its right edge ${dr.toFixed(1)}px off${Math.abs(dl) < 1.5 && Math.abs(dr) < 1.5 ? " — whole pixels where the box has fractions (offsetLeft / offsetWidth round; getBoundingClientRect does not)" : ""}`,
      });
  }
  // Under reduced motion a target that still moves is named: what the preference asks to go at once.
  if (o.reducedMotion)
    for (const t of r.targets)
      if (t.travelPx >= 2 || "best" in t.easing)
        t.findings.push({
          rule: "reduced-motion-moves" as (typeof t.findings)[number]["rule"],
          severity: "warn",
          atMs: captured.startMs,
          message: `it still moves under prefers-reduced-motion: reduce (travels ${Math.round(t.travelPx)}px${"best" in t.easing ? `, ${t.easing.best}` : ""}): if reduced motion should make it go at once, an @media (prefers-reduced-motion: reduce) rule with transition: none (or animation: none) does that`,
        });
  // Nothing about any target changed while something else on the page animated: the target is
  // likely the trigger, not what moves.
  if (
    captured.elsewhere &&
    o.selectors.length > 0 &&
    // Asked to stay still, staying still is what was checked: the tabs under a sliding indicator
    // read "if that is what should move, give it as --selector" (authoring v1).
    !o.expectStill &&
    !o.selectors.every((sel) => o.stillSelectors.includes(sel)) &&
    r.targets.every((t) => !("best" in t.easing) && t.travelPx < 2 && t.findings.every((f) => f.severity !== "fail"))
  )
    for (const t of r.targets)
      t.findings.push({
        rule: "target-unchanged" as (typeof t.findings)[number]["rule"],
        severity: "warn",
        atMs: captured.startMs,
        message: `nothing about it changes, while ${captured.elsewhere.join(", ")} ${captured.elsewhere.length === 1 ? "animates" : "animate"}: if that is what should move, give it as --selector (the element that moves, not the one that starts it)`,
      });
  const jumps: ({ selector: string; message: string } | { selector: string; message: string; rule: string })[] = [
    ...interruptJumps(captured, o.selectors),
    ...(captured.seams ?? []).map((s) => ({ ...s, rule: "loop-seam" })),
    ...(captured.replays ?? []).filter((s) => !s.warn).map((s) => ({ ...s, rule: "replayed" })),
  ];
  const warnsAfter = (captured.replays ?? []).filter((s) => s.warn).map((s) => ({ ...s, rule: "replayed" }));
  // Held to an approved run (issue #214): what each target's line reports, against what it reported then.
  let baselineNote: string | undefined;
  let baselineJson: Record<string, unknown> | undefined;
  if (o.baseline) {
    const { summarizeMotion, compareMotionBaseline, parseMotionBaseline, MOTION_BASELINE_FORMAT } =
      await import("@mizchi/vlmkit-judge/motion-baseline.ts");
    const path = resolve(o.baseline);
    const summary = summarizeMotion(r.targets);
    const existing = await readFile(path, "utf-8").catch(() => null);
    const failing =
      !r.passed || jumps.length > 0 || r.targets.some((t) => t.findings.some((f) => f.severity === "fail"));
    if (existing === null || o.updateBaseline) {
      if (failing) {
        baselineNote = `baseline: not ${existing === null ? "written" : "rewritten"} (${path}): this run fails, and a failing run is not one to hold later runs to — fix it first`;
        baselineJson = { path, written: false };
      } else {
        // The flags as given, for whoever reads the file: a baseline does not check them again.
        const expected = argv.flatMap((x, k) =>
          x.startsWith("--expect-")
            ? [argv[k + 1] !== undefined && !argv[k + 1]!.startsWith("--") ? `${x} ${argv[k + 1]}` : x]
            : [],
        );
        await mkdir(dirname(path), { recursive: true });
        await writeFile(
          path,
          `${JSON.stringify({ format: MOTION_BASELINE_FORMAT, source: o.source, expected, targets: summary }, null, 2)}\n`,
        );
        baselineNote = `baseline: ${existing === null ? "written" : "rewritten"} to ${path} (${summary.length} target${summary.length === 1 ? "" : "s"}); a later run with --baseline ${o.baseline} is held to it`;
        baselineJson = { path, written: true };
      }
    } else {
      let base;
      try {
        base = parseMotionBaseline(existing, o.baseline);
      } catch (e) {
        console.error(`error: ${(e as Error).message}`);
        return 2;
      }
      const changes = compareMotionBaseline(base.targets, summary);
      for (const c of changes) {
        const message = `changed since the baseline (${o.baseline}): ${c.changes.join("; ")} — if the change is meant, write it again with --update-baseline`;
        const t = r.targets.find((x) => x.target === c.target);
        if (t)
          t.findings.push({
            rule: "baseline-mismatch" as (typeof t.findings)[number]["rule"],
            severity: "fail",
            atMs: captured.startMs,
            message,
          });
        else jumps.push({ selector: c.target, message: `${c.target}: ${message}`, rule: "baseline-mismatch" });
      }
      baselineNote =
        changes.length === 0
          ? `baseline: held to ${path} — nothing changed past its tolerances (a frame, 2px, 2°, 5% of a travel, a clearly fitted easing)`
          : `baseline: ${changes.length} of ${Math.max(summary.length, base.targets.length)} target${base.targets.length === 1 ? "" : "s"} changed since ${path}`;
      baselineJson = { path, changes };
    }
  }
  const json = {
    source: o.source,
    ...(baselineJson ? { baseline: baselineJson } : {}),
    ...(jumps.length > 0 ? { interruptJumps: jumps } : {}),
    ...(warnsAfter.length > 0 ? { warnings: warnsAfter } : {}),
    frames: captured.manifest,
    startMs: captured.startMs,
    endMs: captured.endMs,
    segments: captured.segments,
    passed: r.passed && jumps.length === 0 && r.targets.every((t) => t.findings.every((f) => f.severity !== "fail")),
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
    const lines = formatMotionReport(o.source, captured, r, o.forbid, o.deviceScale).split("\n");
    // Said only when one did go: lifted cards that settle back read "the pointer leaving is what
    // hides a hover-only element" (round 16).
    const restDom = captured.frames.at(-1)?.dom ?? [];
    const went = (captured.beforeLast?.targets ?? []).some((b, i) => {
      const d = restDom[i];
      return (
        b &&
        !b.notRendered &&
        b.opacity >= 0.5 &&
        (b.visible ?? 0) >= 0.5 &&
        (!d || d.opacity < 0.05 || (d.visible ?? 1) < 0.5)
      );
    });
    if (captured.replanned) lines.splice(1, 0, `  sampled again: ${captured.replanned}`);
    if (leaveExits && went)
      lines.splice(
        1,
        0,
        "  taken as leaving: it was shown before --leave, and the pointer leaving is what hides a hover-only element, so gone at rest is its end (as --exits); if it should stay after the pointer leaves, that is the defect",
      );
    // Only the last action's motion is sampled: two --click on a panel measured its close, and
    // nothing said its open had not been (round 13).
    const acts = o.actions.filter((a) => a.kind !== "wait");
    // Inside an --every-action run the earlier actions had their own steps (round 18).
    if (acts.length > 1 && !o.inEveryAction)
      lines.splice(
        1,
        0,
        `  sampled: the motion ${describeAction(acts[acts.length - 1]!)} (the last action) starts; what ${acts
          .slice(0, -1)
          .map(describeAction)
          .join(
            ", ",
          )} started ran${o.actions.some((a) => a.kind === "wait") ? " (as far as --wait let it)" : " to its end"} unsampled — --every-action measures each in turn`,
      );
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
                    : /upright/.test(flag)
                      ? "upright-mismatch"
                      : /span-of/.test(flag)
                        ? "span-mismatch"
                        : /lines/.test(flag)
                          ? "lines-mismatch"
                          : "still-mismatch";
      // A path never fitted (never seen, or under 2px of travel) checked no easing, direction or
      // origin: "held: --expect-direction up" sat under "travels 0px" on a card that never moved
      // (round 13).
      const unfitted = r.targets.every((t) => !("best" in t.easing));
      // Direction and origin are the path's: a shadow or a colour fitted moves nothing.
      const pathless = r.targets.every(
        (t) =>
          !t.swing &&
          (!("best" in t.easing) ||
            !(t.easing.channels ?? []).some((c) => ["position", "turn", "gradient"].includes(c.channel))),
      );
      // Never seen at all: nothing was checked, not even its timing ("held: --expect-duration 200ms"
      // beside "never seen in any frame", round 14).
      const unseen = r.targets.every((t) =>
        t.findings.some((f) => f.rule === "target-hidden" || (f.rule as string) === "hidden-at-once"),
      );
      // The frames could not tell the expected curve from the fitted one (easing-unchecked).
      // Per target: one row with no fit made "--expect-easing ease-out" read "not judged" beside three
      // rows that each followed ease-out (round 15). Checked on some, it is held for those and the
      // others are named.
      const easingChecked = r.targets.filter(
        (t) => "best" in t.easing && !t.findings.some((f) => f.rule === "easing-unchecked"),
      );
      const easingMissed = r.targets.filter((t) => !easingChecked.includes(t)).map((t) => t.target);
      const easingOpen = easingChecked.length === 0;
      // An origin is the scale's, not the path's: nine tiles growing in place travel nothing, and
      // "--expect-origin center" read "not judged" under lines saying "grows from its centre"
      // (authoring v1). It is judged wherever a segment has a point it scales about.
      const originRead = r.targets.some((t) => t.pivot || t.growsFrom || t.segments.some((g) => g.origin));
      const unjudged = (f: string) =>
        unseen ||
        ((unfitted || easingOpen) && /easing/.test(f)) ||
        (pathless && /direction/.test(f)) ||
        (/origin/.test(f) && !originRead);
      // --expect-easing repeated is one per target in order: each speaks for its own target, and one
      // that is all `any` asks nothing (a declared { "motion": ... } entry writes one per target, and
      // "(not checked on .delete …)" was said once per flag for one target that moves nothing).
      const perTarget = asked.filter((f) => /^--expect-easing\b/.test(f)).length > 1;
      // Each asked flag with the target it speaks for (the k-th --expect-easing, when per target).
      let easingSeen = 0;
      const askedFor = asked.map((f) => ({
        f,
        target: /^--expect-easing\b/.test(f) && perTarget ? r.targets[easingSeen++]?.target : undefined,
      }));
      const held = askedFor
        .filter(({ f }) => !failed.has(ruleOf(f)) && !unjudged(f))
        .filter(({ f }) => !(perTarget && /^--expect-easing (any,)*any$/.test(f)))
        .map(({ f, target }) => {
          if (!/easing/.test(f) || easingMissed.length === 0) return f;
          const missed = perTarget ? (target && easingMissed.includes(target) ? [target] : []) : easingMissed;
          return missed.length > 0
            ? `${f} (not checked on ${missed.map((x) => JSON.stringify(x)).join(", ")}: no curve fitted there)`
            : f;
        });
      const skipped = asked.filter((f) => !failed.has(ruleOf(f)) && unjudged(f));
      const at = lines.findIndex((l) => /^ {2}(no fail|\d+ fail)/.test(l));
      const notes = [
        ...(held.length > 0 ? [`  held: ${held.join(", ")}`] : []),
        ...(skipped.length > 0
          ? [
              `  not judged: ${skipped.join(", ")} — ${
                unseen
                  ? "the target was not seen in any frame"
                  : !unfitted && easingOpen && skipped.every((f) => /easing/.test(f))
                    ? // A curve was fitted, but the expected one fits about as well: "no path was fitted"
                      // sat under a target line that named the fit (round 18).
                      "the frames fit it about as well as the curve named on the target's line (easing-unchecked says by how much)"
                    : "no path was fitted (see the target's line)"
              }, so nothing checked ${skipped.length === 1 ? "it" : "them"}`,
            ]
          : []),
      ];
      if (notes.length > 0) lines.splice(at < 0 ? lines.length : at, 0, ...notes);
    }
    if (baselineNote) {
      const at = lines.findIndex((l) => /^ {2}(no fail|\d+ fail)/.test(l));
      lines.splice(at < 0 ? lines.length : at, 0, `  ${baselineNote}`);
    }
    console.log(`${lines.join("\n")}\n  report: ${saved}`);
  }
  // Fails added here (span-mismatch, hidden-at-once) count as the judge's do.
  const passed = r.passed && r.targets.every((t) => t.findings.every((f) => f.severity !== "fail"));
  return passed && jumps.length === 0 ? 0 : 1;
}

if (isCliEntry(import.meta.url, "motion")) {
  runMotionCli(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch(handleCliError);
}
