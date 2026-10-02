/**
 * Build the zoom accuracy cases: each fixture captured full-page twice, with one change planted
 * in the second capture, and the ground truth read back from the pixels rather than assumed.
 *
 * A planted change that moves no pixel (a colour set to what it already was, a shift clipped
 * by an ancestor) is dropped here, and a `none` case whose two captures differ at all is an
 * error — a noisy render would make every "no change" answer look like a miss.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { PNG } from "pngjs";
import type { Browser } from "playwright";
import { settlePage } from "@mizchi/vlmkit-core/page-open.ts";
import type { BenchCase, CaseKind, CssBox, Expected } from "./score.ts";

export interface BuildOptions {
  fixtures: readonly string[];
  kinds: readonly CaseKind[];
  seed: number;
  /** Device pixel ratio of the captures (2 = a retina screenshot). */
  deviceScaleFactor: number;
  viewportWidth: number;
  outDir: string;
  /** Planted cases per fixture and kind, each its own seeded choice (default 1). `none` gets one per fixture. */
  variants?: number;
}

export interface BuiltCase extends BenchCase {
  baselinePath: string;
  currentPath: string;
  /** Where the planted element sat before the change, CSS px. */
  targetBox?: CssBox;
}

export interface BuildResult {
  cases: BuiltCase[];
  skipped: { id: string; reason: string }[];
}

type Planted = { expected: Expected; target: string; box: CssBox } | { skip: string };

/**
 * Runs in the page. Picks one element for `kind` with a seeded choice, changes it, and says
 * what the right answer is. Candidates are leaf elements that are visible and small — the
 * point of the bench is detail a downscaled view can lose — and unobstructed: v1 planted
 * "50+" → "00+" under a blurred modal, which no reader and no zoom could read, so it measured
 * nothing and was the one miss of every arm.
 */
function plantInPage(args: { kind: CaseKind; seed: number }): Planted {
  let state = args.seed >>> 0 || 1;
  const rand = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pathOf = (el: Element): string => {
    const parts: string[] = [];
    for (let e: Element | null = el; e && e !== document.body && parts.length < 4; e = e.parentElement) {
      const cls = [...e.classList]
        .slice(0, 2)
        .map((c) => `.${c}`)
        .join("");
      parts.unshift(`${e.tagName.toLowerCase()}${e.id ? `#${e.id}` : ""}${cls}`);
    }
    return parts.join(">");
  };
  const boxOf = (el: Element) => {
    const r = el.getBoundingClientRect();
    return { x1: r.left + scrollX, y1: r.top + scrollY, x2: r.right + scrollX, y2: r.bottom + scrollY };
  };
  const visible = (el: Element) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return (
      r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && Number(cs.opacity) > 0.5
    );
  };
  // Topmost at its own centre, and no filtered or faded ancestor between it and the page.
  const unobstructed = (el: Element) => {
    for (let e: Element | null = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.filter !== "none" || Number(cs.opacity) < 0.95) return false;
    }
    el.scrollIntoView({ block: "center", inline: "center" });
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    window.scrollTo(0, 0);
    return !!hit && (hit === el || el.contains(hit));
  };
  const leaves = [...document.querySelectorAll("body *")].filter(
    (el) =>
      el.children.length === 0 &&
      (el.textContent ?? "").trim() !== "" &&
      visible(el) &&
      !["SCRIPT", "STYLE", "TITLE", "OPTION"].includes(el.tagName),
  );
  const pick = <T>(xs: T[]): T | undefined => xs[Math.floor(rand() * xs.length)];
  const hex = (rgb: string) => {
    const m = rgb
      .match(/\d+(\.\d+)?/g)
      ?.slice(0, 3)
      .map(Number) ?? [0, 0, 0];
    return `#${m.map((n) => Math.round(n).toString(16).padStart(2, "0")).join("")}`;
  };

  if (args.kind === "text") {
    const candidates = leaves
      .filter((el) => {
        const t = el.textContent!.trim();
        return parseFloat(getComputedStyle(el).fontSize) <= 13 && /\d/.test(t) && t.length <= 60;
      })
      .filter(unobstructed);
    const el = pick(candidates);
    if (!el) return { skip: "no small text with a digit" };
    const node = [...el.childNodes].find((n) => n.nodeType === Node.TEXT_NODE && /\d/.test(n.textContent ?? ""));
    if (!node) return { skip: "digit is not in a direct text node" };
    const before = node.textContent!;
    const digits = [...before.matchAll(/\d/g)].map((m) => m.index!);
    const at = digits[Math.floor(rand() * digits.length)]!;
    const after = before.slice(0, at) + String((Number(before[at]) + 5) % 10) + before.slice(at + 1);
    const tokenAt = (s: string) => {
      let a = at,
        b = at + 1;
      while (a > 0 && !/\s/.test(s[a - 1]!)) a--;
      while (b < s.length && !/\s/.test(s[b]!)) b++;
      return s.slice(a, b);
    };
    const box = boxOf(el);
    node.textContent = after;
    return {
      expected: {
        kind: "text",
        oldText: before.replace(/\s+/g, " ").trim(),
        newText: after.replace(/\s+/g, " ").trim(),
        oldToken: tokenAt(before),
        newToken: tokenAt(after),
      },
      target: pathOf(el),
      box,
    };
  }

  if (args.kind === "color") {
    const candidates = leaves
      .filter((el) => {
        const t = el.textContent!.trim();
        return parseFloat(getComputedStyle(el).fontSize) <= 16 && t.length >= 2 && t.length <= 40;
      })
      .filter(unobstructed);
    const el = pick(candidates);
    if (!el) return { skip: "no short small label" };
    const oldColor = hex(getComputedStyle(el).color);
    const channels = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const dist = (a: string, b: string) => Math.max(...channels(a).map((v, i) => Math.abs(v - channels(b)[i]!)));
    const fromHsl = (h: number, sat: number, l: number) => {
      const f = (n: number) => {
        const k = (n + h / 30) % 12;
        const c = l - sat * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
        return Math.round(c * 255)
          .toString(16)
          .padStart(2, "0");
      };
      return `#${f(0)}${f(8)}${f(4)}`;
    };
    // A seeded hue, not a palette value: v1 planted the farthest of five Tailwind 600s and
    // readers named #ea580c exactly in 14 of 18 answers, which is recall, not reading. The
    // colour must still differ visibly from the old one (>= 96 on some channel).
    let newColor = oldColor;
    for (let i = 0; i < 24 && dist(newColor, oldColor) < 96; i++)
      newColor = fromHsl(rand() * 360, 0.55 + rand() * 0.35, 0.35 + rand() * 0.25);
    if (dist(newColor, oldColor) < 96) return { skip: "no visibly different colour found" };
    const box = boxOf(el);
    (el as HTMLElement).style.setProperty("color", newColor, "important");
    return { expected: { kind: "color", oldColor, newColor }, target: pathOf(el), box };
  }

  if (args.kind === "offset") {
    const candidates = [...document.querySelectorAll("body *")]
      .filter((el) => {
        if (!visible(el)) return false;
        const r = el.getBoundingClientRect();
        return (
          r.width >= 16 && r.width <= 320 && r.height >= 12 && r.height <= 64 && (el.textContent ?? "").trim() !== ""
        );
      })
      .filter(unobstructed);
    const el = pick(candidates);
    if (!el) return { skip: "no small element to move" };
    // 1-6px in one of four directions, scored exactly: v1's four fixed shifts (±4,0 / 0,4 / 3,0)
    // with ±1px tolerance let "4 in the direction it looked" pass once a shift was noticed.
    const size = 1 + Math.floor(rand() * 6);
    const [ux, uy] = pick([
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ])!;
    const dx = ux! * size,
      dy = uy! * size;
    const box = boxOf(el);
    // `translate` moves the painted box without re-running layout, so exactly one element moves.
    (el as HTMLElement).style.setProperty("translate", `${dx}px ${dy}px`, "important");
    return { expected: { kind: "offset", dx, dy }, target: pathOf(el), box };
  }

  return { expected: { kind: "none" }, target: "", box: { x1: 0, y1: 0, x2: 0, y2: 0 } };
}

/** Bounding box of pixels that differ, in the PNGs' own pixels; null when identical. */
export function diffBounds(a: PNG, b: PNG): { x1: number; y1: number; x2: number; y2: number } | null {
  if (a.width !== b.width || a.height !== b.height) {
    // The page grew or shrank: everything below the change moved. Bound it by the smaller
    // capture and let the caller see a tall box.
    return { x1: 0, y1: 0, x2: Math.max(a.width, b.width), y2: Math.max(a.height, b.height) };
  }
  let x1 = Infinity,
    y1 = Infinity,
    x2 = -1,
    y2 = -1;
  for (let y = 0; y < a.height; y++) {
    for (let x = 0; x < a.width; x++) {
      const i = (y * a.width + x) * 4;
      if (a.data[i] !== b.data[i] || a.data[i + 1] !== b.data[i + 1] || a.data[i + 2] !== b.data[i + 2]) {
        if (x < x1) x1 = x;
        if (x > x2) x2 = x;
        if (y < y1) y1 = y;
        if (y > y2) y2 = y;
      }
    }
  }
  return x2 < 0 ? null : { x1, y1, x2: x2 + 1, y2: y2 + 1 };
}

/** A stable per-case seed, so adding a fixture does not change which element another one plants. */
export function caseSeed(seed: number, id: string): number {
  let h = seed >>> 0;
  for (const ch of id) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0;
  return h || 1;
}

export async function buildCases(browser: Browser, options: BuildOptions): Promise<BuildResult> {
  const cases: BuiltCase[] = [];
  const skipped: BuildResult["skipped"] = [];
  const dsf = options.deviceScaleFactor;
  for (const fixture of options.fixtures) {
    const variants = Math.max(1, options.variants ?? 1);
    for (const [kind, v] of options.kinds.flatMap((k) =>
      Array.from({ length: k === "none" ? 1 : variants }, (_, i) => [k, i] as const),
    )) {
      const id = `${basename(fixture).replace(/\.html?$/, "")}-${kind}${v === 0 ? "" : `-${v + 1}`}`;
      const page = await browser.newPage({
        viewport: { width: options.viewportWidth, height: 900 },
        deviceScaleFactor: dsf,
      });
      try {
        await page.goto(`file://${fixture}`, { waitUntil: "load" });
        await settlePage(page);
        const shot = () => page.screenshot({ fullPage: true, animations: "disabled", caret: "hide" });
        // The first full-page capture of page.html came back 2 device px shorter than every one
        // after it (the resize a full-page capture does settles the layout), which made its
        // `none` case differ everywhere. Capture until two in a row agree.
        let baseline = await shot();
        for (let i = 0; i < 4; i++) {
          const again = await shot();
          if (again.equals(baseline)) break;
          baseline = again;
        }
        const planted = await page.evaluate(plantInPage, { kind, seed: caseSeed(options.seed, id) });
        if ("skip" in planted) {
          skipped.push({ id, reason: planted.skip });
          continue;
        }
        const current = await shot();
        const a = PNG.sync.read(baseline),
          b = PNG.sync.read(current);
        const px = diffBounds(a, b);
        if (kind === "none" && px)
          throw new Error(
            `${id}: two captures of an unchanged page differ at ${JSON.stringify(px)} — the render is not deterministic, so no "none" answer could be scored`,
          );
        if (kind !== "none" && !px) {
          skipped.push({ id, reason: `the planted ${kind} change moved no pixel (${planted.target})` });
          continue;
        }
        const dir = join(options.outDir, "cases", id);
        await mkdir(dir, { recursive: true });
        const baselinePath = join(dir, "baseline.png"),
          currentPath = join(dir, "current.png");
        await writeFile(baselinePath, baseline);
        await writeFile(currentPath, current);
        cases.push({
          id,
          fixture: basename(fixture),
          expected: planted.expected,
          page: { width: Math.round(b.width / dsf), height: Math.round(b.height / dsf) },
          deviceScaleFactor: dsf,
          diffBox: px ? { x1: px.x1 / dsf, y1: px.y1 / dsf, x2: px.x2 / dsf, y2: px.y2 / dsf } : null,
          ...(kind !== "none" ? { target: planted.target, targetBox: planted.box } : {}),
          baselinePath,
          currentPath,
        });
      } finally {
        await page.close();
      }
    }
  }
  await writeFile(join(options.outDir, "cases.json"), JSON.stringify({ options, cases, skipped }, null, 2));
  return { cases, skipped };
}

export async function loadCases(outDir: string): Promise<BuildResult & { options: BuildOptions }> {
  return JSON.parse(await readFile(join(outDir, "cases.json"), "utf8"));
}
