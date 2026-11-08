/**
 * `vlmkit stress data`: the page with its data pushed to the edges, judged by `check integrity`'s
 * layout judges (issue #218).
 *
 * `stress i18n` lengthens copy; real pages break more often on data. A list is empty, or has one
 * item, or ten times as many; a name is an 80-character address with nowhere to break; a count reads
 * 9,999,999; an avatar fails to load. Each of those is a variant here: the page is loaded fresh, the
 * variant applied in place, and the same judges `check integrity` runs (`judgeIntegrityInstant`)
 * read it. What a variant adds over the page as it is, is its finding — named with the variant, so
 * `--variant <id>` replays one.
 *
 * Where the data is comes from the page: a repeated group is an element with three or more children
 * of one shape (tag and first class, block-level), outside navigation, a header and a footer (their
 * text is the author's, not data), a text slot is a leaf of one of those items with
 * up to 40 characters, a count is an element whose whole text is a number of up to four digits.
 *
 * Two findings are this gate's own, because no layout judge sees them:
 *
 *   empty-collapses         the list emptied leaves nothing on screen where it was (0px tall, no
 *                           pseudo-element content): nothing in the CSS says it is empty
 *                           (`:empty::before`). A script's empty state cannot be reached by
 *                           emptying the markup, so this is a warn and says so.
 *   broken-image-collapses  an image that fails to load shrinks its slot to under half its area:
 *                           it has no width / height or aspect-ratio of its own.
 *
 * DOM mutation only: an app that re-renders from its own state undoes nothing here, and its empty or
 * error states are its own code's.
 */
import type { Page } from "playwright";
import type { IntegrityFinding } from "@mizchi/vlmkit-judge/integrity.ts";
import type { PageLoadOptions } from "@mizchi/vlmkit-core/page-load.ts";
import { BOLD, CYAN, DIM, GREEN, RED, RESET, YELLOW } from "@mizchi/vlmkit-core/terminal-colors.ts";
import { STYLE_SAMPLING_JS } from "../style/style-sampling.ts";

export interface DataStressOptions extends PageLoadOptions {
  source: string;
  /** CSS widths to judge at (default 1280 and 375). */
  viewports?: number[];
  /** Only these variant ids (`--variant`). */
  only?: string[];
  storageState?: string;
}

/** A place the page holds data, found on the page as it loads. */
export interface DataGroup {
  /** A selector that finds it again after a reload. */
  selector: string;
  /** Its name in findings (`ul.grid`). */
  name: string;
  items: number;
}

export interface DataProbe {
  groups: DataGroup[];
  /** Text slots inside the groups' items, and counts anywhere. */
  textSlots: number;
  counts: number;
  images: number;
}

export interface DataVariant {
  /** `empty:ul.grid`, `long-text`, … — what `--variant` takes. */
  id: string;
  kind: "empty" | "one" | "many" | "long-text" | "big-number" | "broken-images";
  /** What it does, for the output. */
  does: string;
  group?: DataGroup;
}

export interface DataStressFinding {
  variant: string;
  rule: string;
  severity: "fail" | "warn";
  viewport: number;
  message: string;
  selector?: string;
}

export interface DataStressReport {
  source: string;
  probe: DataProbe;
  viewports: number[];
  variants: { id: string; does: string; findings: number }[];
  findings: DataStressFinding[];
}

/** A name with nowhere to break, as real data has them: an address with no space or hyphen to wrap at for 45 characters. */
export const LONG_TOKEN = "alexandra.konstantinopoulou-featherstonehaugh@example-mail.com";
export const BIG_NUMBER = "9,999,999";

const PROBE = String.raw`(() => {
  ${STYLE_SAMPLING_JS}
  const unique = (el) => {
    const parts = [];
    for (let cur = el; cur && cur !== document.documentElement; cur = cur.parentElement) {
      if (cur.id) { parts.unshift("#" + CSS.escape(cur.id)); break; }
      const i = [...cur.parentElement.children].indexOf(cur) + 1;
      parts.unshift(cur.tagName.toLowerCase() + ":nth-child(" + i + ")");
    }
    return parts.join(" > ");
  };
  const shape = (el) => el.tagName + "." + ((typeof el.className === "string" && el.className.trim().split(/\s+/)[0]) || "");
  const groups = [];
  for (const el of document.querySelectorAll("body *")) {
    const kids = [...el.children].filter((k) => visible(k) && getComputedStyle(k).display !== "inline");
    if (kids.length < 3) continue;
    // Navigation is written by the page's author, not filled from data: a footer's link columns
    // emptied and given 62-character names was noise on every demo site.
    if (el.closest("nav, header, footer, [role=navigation]")) continue;
    const counts = new Map();
    for (const k of kids) counts.set(shape(k), (counts.get(shape(k)) || 0) + 1);
    const [top, n] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (n < 3 || n < kids.length * 0.6) continue;
    const r = el.getBoundingClientRect();
    groups.push({ selector: unique(el), name: path(el), items: n, area: r.width * r.height, el });
  }
  // A group inside another group's item is that item's detail (a card's tag list): kept, but the
  // largest four by area are what the variants empty, thin and multiply.
  groups.sort((a, b) => b.area - a.area);
  const chosen = groups.slice(0, 4);
  const items = chosen.flatMap((g) => [...g.el.children]);
  const slots = items.flatMap((it) => [it, ...it.querySelectorAll("*")]).filter((e) =>
    e.children.length === 0 && visible(e) && !/^(SCRIPT|STYLE|INPUT|TEXTAREA|SELECT|IMG|SVG)$/i.test(e.tagName) &&
    (e.textContent || "").trim().length > 0 && (e.textContent || "").trim().length <= 40 && !/^\d{1,4}$/.test((e.textContent || "").trim()));
  const counts = [...document.querySelectorAll("body *")].filter((e) =>
    e.children.length === 0 && visible(e) && /^\(?\d{1,4}\)?$/.test((e.textContent || "").trim()));
  const images = [...document.querySelectorAll("img")].filter(visible);
  return {
    groups: chosen.map(({ selector, name, items }) => ({ selector, name, items })),
    textSlots: new Set(slots).size,
    counts: counts.length,
    images: images.length,
  };
})()`;

/** The variants a probe calls for. Pure. */
export function planVariants(probe: DataProbe): DataVariant[] {
  const out: DataVariant[] = [];
  for (const g of probe.groups) {
    out.push({ id: `empty:${g.name}`, kind: "empty", group: g, does: `${g.name} with none of its ${g.items} items` });
    out.push({ id: `one:${g.name}`, kind: "one", group: g, does: `${g.name} with one item` });
    out.push({
      id: `many:${g.name}`,
      kind: "many",
      group: g,
      does: `${g.name} with ${Math.min(60, g.items * 5)} items (x${Math.min(60, g.items * 5) / g.items})`,
    });
  }
  if (probe.textSlots > 0)
    out.push({
      id: "long-text",
      kind: "long-text",
      does: `${probe.textSlots} text slot(s) in the repeated items set to a ${LONG_TOKEN.length}-character name with nowhere to break`,
    });
  if (probe.counts > 0)
    out.push({ id: "big-number", kind: "big-number", does: `${probe.counts} count(s) set to ${BIG_NUMBER}` });
  if (probe.images > 0)
    out.push({ id: "broken-images", kind: "broken-images", does: `${probe.images} image(s) failing to load` });
  return out;
}

/** Apply a variant in the page; returns what the gate's own rules read afterwards. */
const APPLY = String.raw`(({ kind, selector, token, big }) => {
  const root = selector ? document.querySelector(selector) : null;
  const before = [...document.images].map((img) => { const r = img.getBoundingClientRect(); return { w: r.width, h: r.height }; });
  if (kind === "empty" && root) { while (root.firstChild) root.firstChild.remove(); }
  if (kind === "one" && root) { const first = root.firstElementChild; [...root.children].forEach((c) => c !== first && c.remove()); }
  if (kind === "many" && root) {
    const items = [...root.children];
    const target = Math.min(60, items.length * 5);
    for (let i = items.length; i < target; i++) root.appendChild(items[i % items.length].cloneNode(true));
  }
  if (kind === "long-text") {
    const leaves = [];
    for (const g of window.__vlmkitGroups || []) {
      const el = document.querySelector(g);
      if (!el) continue;
      for (const e of el.querySelectorAll("*")) {
        const t = (e.textContent || "").trim();
        if (e.children.length === 0 && t.length > 0 && t.length <= 40 && !/^\d{1,4}$/.test(t) && !/^(SCRIPT|STYLE)$/i.test(e.tagName)) leaves.push(e);
      }
    }
    for (const e of leaves) e.textContent = token;
  }
  if (kind === "big-number") {
    for (const e of document.querySelectorAll("body *"))
      if (e.children.length === 0 && /^\(?\d{1,4}\)?$/.test((e.textContent || "").trim())) e.textContent = big;
  }
  if (kind === "broken-images") {
    for (const img of document.images) { img.removeAttribute("srcset"); img.src = "data:image/png;base64,broken"; }
  }
  return { before };
})`;

const READ_AFTER = String.raw`(({ kind, selector }) => {
  const out = {};
  if (kind === "empty") {
    const root = selector ? document.querySelector(selector) : null;
    if (root) {
      const r = root.getBoundingClientRect();
      const pseudo = ["::before", "::after"].map((p) => getComputedStyle(root, p).content).filter((c) => c && c !== "none" && c !== "normal" && c !== '""');
      out.empty = { height: r.height, pseudo };
    }
  }
  if (kind === "broken-images")
    out.images = [...document.images].map((img) => {
      const r = img.getBoundingClientRect();
      const name = img.localName + (img.id ? "#" + img.id : "") + [...img.classList].map((c) => "." + c).join("");
      return { w: r.width, h: r.height, name, alt: img.alt || "" };
    });
  return out;
})`;

const key = (f: IntegrityFinding) => `${f.kind} ${f.selector ?? ""}`;
/**
 * The same finding as the page's own, said of a different number of elements: a grouped finding is
 * named by its first element's path with six badges and by its class with one ("6 element(s): …"
 * against "1 element(s): span.badge"), so a variant that kept one item read the page's own contrast
 * as new. Its message, without the count, the paths and the sample text, is the same.
 */
const gist = (f: IntegrityFinding) =>
  `${f.kind} ${f.message
    .replace(/\d+ element\(s\):[^.]*\./g, "")
    .replace(/First is "[^"]*"\.?/g, "")
    .replace(/\([^)]*nth-(?:of-type|child)[^)]*\)/g, "")
    .trim()}`;

async function judge(page: Page, width: number): Promise<IntegrityFinding[]> {
  const ic = await import("../inspect/integrity-check.ts");
  const { judgeIntegrityInstant } = await import("../inspect/integrity-timeline.ts");
  return judgeIntegrityInstant(page, width, {
    text: ic.COLLECT_INTEGRITY_TEXT,
    clip: ic.COLLECT_CLIP_CANDIDATES,
    collapse: ic.COLLECT_COLLAPSE_CANDIDATES,
    protrusions: ic.COLLECT_PROTRUSIONS,
    contrast: ic.COLLECT_TEXT_CONTRAST,
    occlusions: ic.COLLECT_OCCLUSIONS,
  });
}

const settle = (page: Page) =>
  page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(() => r(), 50)))),
  );

export async function runDataStress(options: DataStressOptions): Promise<DataStressReport> {
  const { withBrowser } = await import("@mizchi/vlmkit-core/browser-launch.ts");
  const { openSource } = await import("@mizchi/vlmkit-core/page-open.ts");
  const { pickPageLoad } = await import("@mizchi/vlmkit-core/page-load.ts");
  const viewports = options.viewports ?? [1280, 375];
  const load = { ...pickPageLoad(options), ...(options.storageState ? { storageState: options.storageState } : {}) };
  return withBrowser(async (browser) => {
    const open = async (width: number) =>
      (await openSource(browser, options.source, { viewport: { width, height: 900 }, ...load })).page;
    const first = await open(viewports[0]!);
    const probe = (await first.evaluate(PROBE)) as DataProbe;
    await first.close();
    const variants = planVariants(probe).filter((v) => !options.only || options.only.includes(v.id));
    const findings: DataStressFinding[] = [];
    const tally = new Map(variants.map((v) => [v.id, 0]));
    for (const width of viewports) {
      const base = await open(width);
      const own = await judge(base, width);
      const baseline = new Set([...own.map(key), ...own.map(gist)]);
      await base.close();
      for (const v of variants) {
        const page = await open(width);
        await page.evaluate(
          (groups) => {
            (window as unknown as { __vlmkitGroups: string[] }).__vlmkitGroups = groups;
          },
          probe.groups.map((g) => g.selector),
        );
        const args = { kind: v.kind, selector: v.group?.selector ?? null, token: LONG_TOKEN, big: BIG_NUMBER };
        const applied = (await page.evaluate(`(${APPLY})(${JSON.stringify(args)})`)) as {
          before: { w: number; h: number }[];
        };
        await settle(page);
        if (v.kind === "broken-images") await page.waitForTimeout(100);
        const add = (f: Omit<DataStressFinding, "variant" | "viewport">) => {
          findings.push({ variant: v.id, viewport: width, ...f });
          tally.set(v.id, (tally.get(v.id) ?? 0) + 1);
        };
        for (const f of await judge(page, width)) {
          if (baseline.has(key(f)) || baseline.has(gist(f))) continue;
          // A failed image is drawn by the browser (its alt text in a broken-image box): what is
          // said of the img itself is that drawing, not the page's layout.
          if (v.kind === "broken-images" && /(^|[\s>])img(\.|:|$)/.test(f.selector ?? "")) continue;
          add({
            rule: f.kind,
            severity: f.severity,
            message: f.message,
            ...(f.selector ? { selector: f.selector } : {}),
          });
        }
        const after = (await page.evaluate(`(${READ_AFTER})(${JSON.stringify(args)})`)) as {
          empty?: { height: number; pseudo: string[] };
          images?: { w: number; h: number; name: string; alt: string }[];
        };
        if (after.empty && after.empty.height < 1 && after.empty.pseudo.length === 0)
          add({
            rule: "empty-collapses",
            severity: "warn",
            selector: v.group!.name,
            message: `with no items, ${v.group!.name} collapses to nothing and nothing says it is empty: give it an empty state (${v.group!.name}:empty::before { content: "No … yet" }, or the script's own) — a state a script renders is not seen by emptying the markup`,
          });
        for (const [i, img] of (after.images ?? []).entries()) {
          const was = applied.before[i];
          if (!was || was.w * was.h < 64) continue;
          if (img.w * img.h < 0.5 * was.w * was.h)
            add({
              rule: "broken-image-collapses",
              severity: "warn",
              selector: img.name,
              message: `when it fails to load, ${img.name} shrinks from ${Math.round(was.w)}x${Math.round(was.h)} to ${Math.round(img.w)}x${Math.round(img.h)} and the layout around it moves: give it width and height (or aspect-ratio) so its slot holds${img.alt ? "" : ", and an alt text"}`,
            });
        }
        await page.close();
      }
    }
    return {
      source: options.source,
      probe,
      viewports,
      variants: variants.map((v) => ({ id: v.id, does: v.does, findings: tally.get(v.id) ?? 0 })),
      findings,
    };
  });
}

export function formatDataStressReport(report: DataStressReport): string {
  const lines = [
    `${BOLD}${CYAN}vlmkit stress data${RESET}`,
    `${DIM}source: ${report.source}${RESET}`,
    `${DIM}found: ${report.probe.groups.length} repeated group(s)${report.probe.groups.length ? ` (${report.probe.groups.map((g) => `${g.name} x${g.items}`).join(", ")})` : ""}, ${report.probe.textSlots} text slot(s), ${report.probe.counts} count(s), ${report.probe.images} image(s); judged at ${report.viewports.join(", ")}px${RESET}`,
    "",
  ];
  if (report.variants.length === 0) {
    lines.push(`${YELLOW}No repeated items, counts or images found: nothing to stress.${RESET}`);
    return lines.join("\n");
  }
  for (const v of report.variants) {
    const mine = report.findings.filter((f) => f.variant === v.id);
    lines.push(
      `${mine.length === 0 ? `${GREEN}ok${RESET}  ` : mine.some((f) => f.severity === "fail") ? `${RED}FAIL${RESET}` : `${YELLOW}warn${RESET}`} ${v.id}  ${DIM}${v.does}${RESET}`,
    );
    for (const f of mine)
      lines.push(
        `      ${f.severity === "fail" ? `${RED}x${RESET}` : `${YELLOW}!${RESET}`} [${f.rule}] @${f.viewport}: ${f.message}`,
      );
  }
  const fails = report.findings.filter((f) => f.severity === "fail").length;
  lines.push(
    "",
    `${fails} fail, ${report.findings.length - fails} warn over ${report.variants.length} variant(s); replay one: --variant <id>`,
  );
  return lines.join("\n");
}
