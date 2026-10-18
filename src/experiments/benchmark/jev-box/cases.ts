/**
 * Ground truth for the Jev box bench, read from the DOM rather than drawn by hand.
 *
 * Grounding: each CSS-challenge fixture is captured at one viewport (DPR 1, so a CSS px is an
 * image px, inside Jev's 1568px edge limit) and the targets are elements a person would name —
 * links, buttons, headings, form fields — whose label is unique on the page, fully inside the
 * viewport and topmost at their own centre. The answer is `getBoundingClientRect()`.
 *
 * Change localisation reuses zoom-accuracy's planted cases (one digit, one seeded hue, one 1-6px
 * shift, or nothing) captured full-page at DPR 1, then cut to a window Jev accepts.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import type { Browser } from "playwright";
import { settlePage } from "@mizchi/vlmkit-core/page-open.ts";
import { cropImage, decodeImage, encodePngImage } from "@mizchi/vlmkit-ai/zoom-image.ts";
import { JEV_IMAGE_LIMITS } from "@mizchi/vlmkit-ai/jev-client.ts";
import { caseSeed } from "../zoom-accuracy/cases.ts";
import type { BuiltCase } from "../zoom-accuracy/cases.ts";
import type { PxBox } from "./score.ts";

export interface GroundTarget {
  id: string;
  fixture: string;
  /** What Jev is asked to box, in words a person would use. */
  description: string;
  role: string;
  label: string;
  box: PxBox;
  path: string;
}

export interface GroundShot {
  fixture: string;
  imagePath: string;
  width: number;
  height: number;
  targets: GroundTarget[];
}

interface Collected {
  role: string;
  label: string;
  box: PxBox;
  path: string;
}

/** Runs in the page: every nameable, unique, unobstructed element inside the viewport. */
function collectTargets(): Collected[] {
  const norm = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();
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
  const roleOf = (el: Element): string | null => {
    const tag = el.tagName;
    if (/^H[1-4]$/.test(tag)) return "heading";
    if (tag === "A") return "link";
    if (tag === "BUTTON" || el.getAttribute("role") === "button") return "button";
    if (tag === "SELECT") return "dropdown";
    if (tag === "TEXTAREA") return "text area";
    if (tag === "INPUT") {
      const t = (el as HTMLInputElement).type;
      if (t === "checkbox") return "checkbox";
      if (t === "radio") return "radio button";
      if (t === "submit" || t === "button") return "button";
      if (["text", "email", "search", "password", "tel", "url", "number", ""].includes(t)) return "text field";
    }
    return null;
  };
  const labelOf = (el: Element, role: string): string => {
    if (role === "text field" || role === "text area") {
      return norm((el as HTMLInputElement).placeholder) || norm(el.getAttribute("aria-label"));
    }
    if (el.tagName === "INPUT") return norm((el as HTMLInputElement).value);
    if (role === "checkbox" || role === "radio button") {
      const id = el.id;
      const lab = (id && document.querySelector(`label[for="${CSS.escape(id)}"]`)) || el.closest("label");
      return norm(lab?.textContent);
    }
    return norm((el as HTMLElement).innerText);
  };
  const vw = innerWidth;
  const vh = innerHeight;
  const out: Collected[] = [];
  for (const el of document.querySelectorAll("body *")) {
    const role = roleOf(el);
    if (!role) continue;
    const label = labelOf(el, role);
    if (label.length < 2 || label.length > 40) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 6 || r.height < 6 || r.left < 0 || r.top < 0 || r.right > vw || r.bottom > vh) continue;
    let faded = false;
    for (let e: Element | null = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.visibility === "hidden" || Number(cs.opacity) < 0.95 || cs.filter !== "none") faded = true;
    }
    if (faded) continue;
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    if (!hit || !(hit === el || el.contains(hit) || (hit.tagName === "LABEL" && hit.contains(el)))) continue;
    out.push({ role, label, box: { x1: r.left, y1: r.top, x2: r.right, y2: r.bottom }, path: pathOf(el) });
  }
  // A label that is written anywhere else on the page (visible text, another control) is
  // ambiguous: "Issues" in a nav and in a sidebar have two right answers, so neither is asked.
  const text = norm(document.body.innerText).toLowerCase();
  const occurrences = (s: string) => text.split(s.toLowerCase()).length - 1;
  const counts = new Map<string, number>();
  for (const c of out) counts.set(c.label.toLowerCase(), (counts.get(c.label.toLowerCase()) ?? 0) + 1);
  return out.filter((c) => {
    if (counts.get(c.label.toLowerCase())! > 1) return false;
    const inText = occurrences(c.label);
    const placeholderish = c.role === "text field" || c.role === "text area";
    return placeholderish ? inText === 0 : inText === 1;
  });
}

export function describe(role: string, label: string): string {
  if (role === "text field" || role === "text area") return `the ${role} whose placeholder reads "${label}"`;
  if (role === "checkbox" || role === "radio button") return `the ${role} labelled "${label}" (the control itself)`;
  return `the "${label}" ${role}`;
}

function seededShuffle<T>(xs: T[], seed: number): T[] {
  let s = seed >>> 0 || 1;
  const rand = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export interface GroundOptions {
  fixtures: readonly string[];
  seed: number;
  perFixture: number;
  viewport: { width: number; height: number };
  outDir: string;
}

export async function buildGround(browser: Browser, o: GroundOptions): Promise<GroundShot[]> {
  const shots: GroundShot[] = [];
  await mkdir(join(o.outDir, "ground"), { recursive: true });
  for (const fixture of o.fixtures) {
    const name = basename(fixture).replace(/\.html?$/, "");
    const page = await browser.newPage({ viewport: o.viewport, deviceScaleFactor: 1 });
    try {
      await page.goto(`file://${fixture}`, { waitUntil: "load" });
      await settlePage(page);
      const png = await page.screenshot({ animations: "disabled", caret: "hide" });
      const collected = await page.evaluate(collectTargets);
      const chosen = seededShuffle(collected, caseSeed(o.seed, name)).slice(0, o.perFixture);
      const imagePath = join(o.outDir, "ground", `${name}.png`);
      await writeFile(imagePath, png);
      shots.push({
        fixture: name,
        imagePath,
        ...o.viewport,
        targets: chosen.map((c, i) => ({
          id: `${name}-${i}`,
          fixture: name,
          description: describe(c.role, c.label),
          ...c,
        })),
      });
    } finally {
      await page.close();
    }
  }
  await writeFile(join(o.outDir, "ground.json"), JSON.stringify(shots, null, 2));
  return shots;
}

export interface DiffCase {
  id: string;
  fixture: string;
  kind: BuiltCase["expected"]["kind"] | "presence";
  expected: BuiltCase["expected"] | { kind: "presence" };
  baselinePath: string;
  currentPath: string;
  width: number;
  height: number;
  /** Changed pixels' bounds inside the window; null for `none`. */
  diffBox: PxBox | null;
  /** The planted element's box before the change, inside the window. */
  targetBox: PxBox | null;
  /** Where the window sits on the full-page capture. */
  windowY: number;
}

/**
 * Cut a full-page DPR-1 case to a window Jev accepts: the full width, at most `maxHeight` tall,
 * centred on the change (top of the page for `none`). Both captures get the same window.
 */
export async function windowDiffCase(c: BuiltCase, outDir: string, maxHeight = 900): Promise<DiffCase | null> {
  if (c.deviceScaleFactor !== 1) throw new Error(`${c.id}: Jev cases are captured at DPR 1`);
  const a = decodeImage(await readFile(c.baselinePath));
  const b = decodeImage(await readFile(c.currentPath));
  if (a.width !== b.width || a.height !== b.height) return null;
  const width = a.width;
  if (width > JEV_IMAGE_LIMITS.maxEdge) throw new Error(`${c.id}: ${width}px wide exceeds Jev's edge limit`);
  const h = Math.min(a.height, maxHeight, JEV_IMAGE_LIMITS.maxEdge);
  let y = 0;
  if (c.diffBox) {
    if (c.diffBox.y2 - c.diffBox.y1 > h) return null;
    const mid = (c.diffBox.y1 + c.diffBox.y2) / 2;
    y = Math.round(Math.min(Math.max(0, mid - h / 2), a.height - h));
  }
  const win = { x1: 0, y1: y, x2: width, y2: y + h };
  const dir = join(outDir, "diff", c.id);
  await mkdir(dir, { recursive: true });
  const baselinePath = join(dir, "baseline.png");
  const currentPath = join(dir, "current.png");
  await writeFile(baselinePath, encodePngImage(cropImage(a, win)));
  await writeFile(currentPath, encodePngImage(cropImage(b, win)));
  const shift = (bx: PxBox | null | undefined) => (bx ? { x1: bx.x1, y1: bx.y1 - y, x2: bx.x2, y2: bx.y2 - y } : null);
  return {
    id: c.id,
    fixture: c.fixture,
    kind: c.expected.kind,
    expected: c.expected,
    baselinePath,
    currentPath,
    width,
    height: h,
    diffBox: shift(c.diffBox),
    targetBox: shift(c.targetBox),
    windowY: y,
  };
}

/**
 * Appear / disappear cases, which zoom-accuracy does not plant: one grounding target per case
 * is hidden (`visibility: hidden`, so nothing reflows and the change is that element alone).
 * Even-numbered cases hide it in `current` (disappeared), odd ones in `baseline` (appeared).
 */
export async function buildPresenceCases(browser: Browser, o: GroundOptions, perFixture = 2): Promise<DiffCase[]> {
  const out: DiffCase[] = [];
  for (const fixture of o.fixtures) {
    const name = basename(fixture).replace(/\.html?$/, "");
    const page = await browser.newPage({ viewport: o.viewport, deviceScaleFactor: 1 });
    try {
      await page.goto(`file://${fixture}`, { waitUntil: "load" });
      await settlePage(page);
      const shot = () => page.screenshot({ animations: "disabled", caret: "hide" });
      const collected = await page.evaluate(collectTargets);
      const chosen = seededShuffle(collected, caseSeed(o.seed, `${name}-presence`)).slice(0, perFixture);
      for (const [i, c] of chosen.entries()) {
        const id = `${name}-presence${i === 0 ? "" : `-${i + 1}`}`;
        const shown = await shot();
        await page.evaluate((box) => {
          const el = document.elementFromPoint((box.x1 + box.x2) / 2, (box.y1 + box.y2) / 2);
          // The collector's hit test accepted the element or a descendant at its centre; walk
          // up to the box the target was measured as, so the whole target goes.
          let e = el as HTMLElement | null;
          while (e && e.parentElement) {
            const r = e.getBoundingClientRect();
            if (Math.abs(r.left - box.x1) < 0.5 && Math.abs(r.top - box.y1) < 0.5 && Math.abs(r.right - box.x2) < 0.5)
              break;
            e = e.parentElement;
          }
          if (e) e.style.setProperty("visibility", "hidden", "important");
          (window as unknown as { __hidden?: HTMLElement | null }).__hidden = e;
        }, c.box);
        const hidden = await shot();
        await page.evaluate(() =>
          (window as unknown as { __hidden?: HTMLElement | null }).__hidden?.style.removeProperty("visibility"),
        );
        const [base, cur] = i % 2 === 0 ? [shown, hidden] : [hidden, shown];
        const dir = join(o.outDir, "presence", id);
        await mkdir(dir, { recursive: true });
        const baselinePath = join(dir, "baseline.png");
        const currentPath = join(dir, "current.png");
        await writeFile(baselinePath, base);
        await writeFile(currentPath, cur);
        out.push({
          id,
          fixture: name,
          kind: "presence",
          expected: { kind: "presence" },
          baselinePath,
          currentPath,
          width: o.viewport.width,
          height: o.viewport.height,
          diffBox: c.box,
          targetBox: c.box,
          windowY: 0,
        });
      }
    } finally {
      await page.close();
    }
  }
  return out;
}

export const CLAIM_PLANTS = ["error-banner", "modal", "broken-image", "overlap", "loading"] as const;
export type ClaimPlant = (typeof CLAIM_PLANTS)[number];

export interface ClaimShot {
  fixture: string;
  plant: ClaimPlant | "none";
  imagePath: string;
}

/**
 * Runs in the page: plant one defect a person would notice at a glance, in the viewport, on top
 * of the fixture as it is. Each is the common shape of the defect, not a hard case: the bench asks
 * whether a claim notices it at all and, as much, whether it stays quiet on the clean pages.
 */
function plantClaimDefect(kind: string): void {
  const el = (html: string) => {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild as HTMLElement;
  };
  const font = "font: 15px/1.4 system-ui, sans-serif;";
  if (kind === "error-banner") {
    document.body.append(
      el(
        `<div style="position:fixed;top:72px;left:50%;transform:translateX(-50%);z-index:99999;${font}background:#fde8e8;color:#9b1c1c;border:1px solid #f05252;border-radius:8px;padding:12px 18px;box-shadow:0 4px 12px rgba(0,0,0,.15)">⚠ Something went wrong. We couldn't save your changes. Please try again.</div>`,
      ),
    );
  } else if (kind === "modal") {
    document.body.append(
      el(
        `<div style="position:fixed;inset:0;z-index:99999;background:rgba(17,24,39,.55);display:flex;align-items:center;justify-content:center"><div style="${font}background:#fff;color:#111;border-radius:12px;padding:24px 28px;width:380px;box-shadow:0 20px 40px rgba(0,0,0,.3)"><div style="font-weight:600;font-size:18px;margin-bottom:8px">Delete this project?</div><div style="color:#555;margin-bottom:20px">This cannot be undone.</div><div style="display:flex;gap:10px;justify-content:flex-end"><button style="${font}padding:8px 14px">Cancel</button><button style="${font}padding:8px 14px;background:#dc2626;color:#fff;border:0;border-radius:6px">Delete</button></div></div></div>`,
      ),
    );
  } else if (kind === "broken-image") {
    // A real missing file: Chromium draws its own broken-image icon and the alt text.
    document.body.append(
      el(
        `<img src="./definitely-missing-hero.png" alt="Product hero image" width="360" height="200" style="position:fixed;top:160px;left:420px;z-index:99999;border:1px solid #ccc;background:#fff">`,
      ),
    );
  } else if (kind === "overlap") {
    // Text set over the page's own text, 6px off: the classic absolute-position collision.
    const target = [...document.querySelectorAll("h1, h2, h3, p")].find((e) => {
      const r = e.getBoundingClientRect();
      return r.width > 150 && r.height > 14 && r.top > 40 && r.bottom < innerHeight - 40 && r.left >= 0;
    });
    const r = target ? target.getBoundingClientRect() : { left: 80, top: 200, width: 400 };
    document.body.append(
      el(
        `<div style="position:fixed;left:${r.left + 6}px;top:${r.top + 5}px;width:${Math.max(200, r.width)}px;z-index:99999;${font}font-size:17px;font-weight:600;color:#222">Limited offer: 30% off all annual plans this week only</div>`,
      ),
    );
  } else if (kind === "loading") {
    document.body.append(
      el(
        `<div style="position:fixed;inset:0;z-index:99999;background:rgba(255,255,255,.82);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;${font}color:#374151"><div style="width:44px;height:44px;border-radius:50%;border:5px solid #d1d5db;border-top-color:#2563eb"></div>Loading…</div>`,
      ),
    );
  }
}

export async function buildClaimShots(browser: Browser, o: GroundOptions): Promise<ClaimShot[]> {
  const out: ClaimShot[] = [];
  await mkdir(join(o.outDir, "claims"), { recursive: true });
  for (const fixture of o.fixtures) {
    const name = basename(fixture).replace(/\.html?$/, "");
    for (const plant of ["none", ...CLAIM_PLANTS] as const) {
      const page = await browser.newPage({ viewport: o.viewport, deviceScaleFactor: 1 });
      try {
        await page.goto(`file://${fixture}`, { waitUntil: "load" });
        await settlePage(page);
        if (plant !== "none") {
          await page.evaluate(plantClaimDefect, plant);
          await page.waitForTimeout(150);
        }
        const imagePath = join(o.outDir, "claims", `${name}-${plant}.png`);
        await page.screenshot({ path: imagePath, animations: "disabled", caret: "hide" });
        out.push({ fixture: name, plant, imagePath });
      } finally {
        await page.close();
      }
    }
  }
  return out;
}
