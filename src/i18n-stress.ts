#!/usr/bin/env node
/**
 * i18n / variable-length text stress test.
 *
 * Catches "your button is fine for English but overflows in German"
 * — a class of bug the agent can't see at design time because they
 * write CSS against the English copy.
 *
 * Approach: inflate every visible text node by a configurable factor
 * (default 1.4 — between French and German typical expansion), then
 * compare per-element layout before vs after. An element "overflows"
 * if:
 *   - its `scrollWidth > clientWidth` (horizontal overflow), or
 *   - its rendered height grew by more than a threshold (wrap into
 *     extra lines), or
 *   - its right edge extends beyond its parent's right edge.
 *
 * No translation dictionary required — the inflator is a synthetic
 * `word → word + 'X'×k` that preserves whitespace and word boundaries
 * so wrap behavior is exercised the same way real long-text would
 * exercise it.
 *
 * Usage:
 *   vrt i18n-stress <html> [--inflate 1.4]
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Page } from "playwright";
import { DIM, RESET, GREEN, RED, YELLOW, BOLD, CYAN } from "./terminal-colors.ts";

export interface I18nStressOptions {
  htmlPath: string;
  outputDir: string;
  reportPath?: string;
  /** Word-length inflation factor. Default 1.4. */
  inflateFactor?: number;
  viewport?: { width: number; height: number };
  /** Min height delta % to count as "wrap induced". Default 0.15 (15%). */
  wrapThreshold?: number;
}

export interface OverflowingElement {
  /** A short DOM path like `main>section>div.card>button`. */
  path: string;
  tag: string;
  text: string;
  /** "horizontal-overflow" | "vertical-wrap" | "extends-beyond-parent" */
  kind: "horizontal-overflow" | "vertical-wrap" | "extends-beyond-parent";
  before: { width: number; height: number; clientWidth: number; scrollWidth: number };
  after: { width: number; height: number; clientWidth: number; scrollWidth: number };
}

export interface I18nStressReport {
  html: string;
  inflateFactor: number;
  beforeScreenshot: string;
  afterScreenshot: string;
  overflowing: OverflowingElement[];
  totalInspected: number;
  reportPath: string;
}

// Browser-side text inflator. Lives as a script string so we can
// `page.evaluate` it without bundling.
const INFLATE_SCRIPT = `
(function inflateAll(factor) {
  const walk = (node) => {
    if (node.nodeType === 3) {
      const text = node.nodeValue || "";
      const out = text.split(/(\\s+)/).map((tok) => {
        if (/^\\s+$/.test(tok) || tok === "") return tok;
        const target = Math.ceil(tok.length * factor);
        const extra = Math.max(0, target - tok.length);
        return tok + "X".repeat(extra);
      }).join("");
      node.nodeValue = out;
      return;
    }
    if (node.nodeType !== 1) return;
    const el = node;
    if (el.tagName === "SCRIPT" || el.tagName === "STYLE" || el.tagName === "NOSCRIPT") return;
    for (const child of Array.from(node.childNodes)) walk(child);
  };
  walk(document.body);
})
`;

const SAMPLE_SCRIPT = `
(function sample() {
  const out = [];
  const elements = document.body.querySelectorAll("*");
  elements.forEach((el, i) => {
    if (i > 800) return; // cap
    if (el.tagName === "SCRIPT" || el.tagName === "STYLE") return;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    const text = (el.textContent || "").trim().slice(0, 60);
    if (!text) return;
    const path = (() => {
      let cur = el;
      const parts = [];
      while (cur && cur !== document.body && parts.length < 5) {
        let p = cur.tagName.toLowerCase();
        if (cur.id) p += "#" + cur.id;
        else if (cur.className && typeof cur.className === "string") {
          const cls = cur.className.trim().split(/\\s+/).slice(0, 2).join(".");
          if (cls) p += "." + cls;
        }
        parts.unshift(p);
        cur = cur.parentElement;
      }
      return parts.join(">");
    })();
    let parentRight = Infinity;
    if (el.parentElement) {
      const pr = el.parentElement.getBoundingClientRect();
      parentRight = pr.right;
    }
    out.push({
      path,
      tag: el.tagName.toLowerCase(),
      text,
      width: r.width,
      height: r.height,
      right: r.right,
      parentRight,
      clientWidth: el.clientWidth,
      scrollWidth: el.scrollWidth,
    });
  });
  return out;
})()
`;

interface ElementSample {
  path: string;
  tag: string;
  text: string;
  width: number;
  height: number;
  right: number;
  parentRight: number;
  clientWidth: number;
  scrollWidth: number;
}

function parseArgs(argv: string[]) {
  let outputDir = "";
  let report = "";
  let inflate: number | undefined;
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--output-dir") outputDir = argv[++i];
    else if (a === "--report") report = argv[++i];
    else if (a === "--inflate") inflate = parseFloat(argv[++i] ?? "1.4");
    else positional.push(a);
  }
  return { positional, outputDir, report, inflate };
}

export async function runI18nStress(
  options: I18nStressOptions,
): Promise<I18nStressReport> {
  const outputDir = resolve(options.outputDir);
  await mkdir(outputDir, { recursive: true });
  const htmlPath = resolve(options.htmlPath);
  const html = await readFile(htmlPath, "utf-8");
  const inflateFactor = options.inflateFactor ?? 1.4;
  const viewport = options.viewport ?? { width: 1280, height: 900 };
  const wrapThreshold = options.wrapThreshold ?? 0.15;

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport });
    await page.setContent(html, { waitUntil: "networkidle" });
    await page.addStyleTag({
      content: `*, *::before, *::after { transition: none !important; animation: none !important; }`,
    });

    const beforeScreenshot = join(outputDir, "before.png");
    await page.screenshot({ path: beforeScreenshot, fullPage: false });
    const before = await page.evaluate(SAMPLE_SCRIPT) as ElementSample[];

    // Inflate every text node and re-sample.
    await page.evaluate(`(${INFLATE_SCRIPT})(${inflateFactor});`);
    // Allow layout to settle.
    await page.waitForLoadState("networkidle").catch(() => {});

    const afterScreenshot = join(outputDir, "after.png");
    await page.screenshot({ path: afterScreenshot, fullPage: false });
    const after = await page.evaluate(SAMPLE_SCRIPT) as ElementSample[];

    await page.close();

    // Pair before/after by path. Detect overflow / wrap.
    const beforeByPath = new Map(before.map((b) => [b.path, b]));
    const overflowing: OverflowingElement[] = [];
    for (const a of after) {
      const b = beforeByPath.get(a.path);
      if (!b) continue;

      // Horizontal overflow: content extends past the box.
      if (a.scrollWidth > a.clientWidth + 1) {
        overflowing.push({
          path: a.path,
          tag: a.tag,
          text: a.text,
          kind: "horizontal-overflow",
          before: { width: b.width, height: b.height, clientWidth: b.clientWidth, scrollWidth: b.scrollWidth },
          after: { width: a.width, height: a.height, clientWidth: a.clientWidth, scrollWidth: a.scrollWidth },
        });
        continue;
      }
      // Beyond parent right edge.
      if (a.right > a.parentRight + 1 && a.right - a.parentRight > b.right - b.parentRight + 2) {
        overflowing.push({
          path: a.path,
          tag: a.tag,
          text: a.text,
          kind: "extends-beyond-parent",
          before: { width: b.width, height: b.height, clientWidth: b.clientWidth, scrollWidth: b.scrollWidth },
          after: { width: a.width, height: a.height, clientWidth: a.clientWidth, scrollWidth: a.scrollWidth },
        });
        continue;
      }
      // Vertical wrap: height grew much more than expected. Only flag
      // when the height delta is significant in absolute terms too
      // (avoid 4px → 6px lines flagged as 50% growth).
      if (b.height > 0 && (a.height - b.height) >= 12 && a.height >= b.height * (1 + wrapThreshold)) {
        overflowing.push({
          path: a.path,
          tag: a.tag,
          text: a.text,
          kind: "vertical-wrap",
          before: { width: b.width, height: b.height, clientWidth: b.clientWidth, scrollWidth: b.scrollWidth },
          after: { width: a.width, height: a.height, clientWidth: a.clientWidth, scrollWidth: a.scrollWidth },
        });
      }
    }

    // Dedupe by parent path — the wrap usually shows up on every
    // ancestor too; we want the innermost element only.
    const seenAncestors = new Set<string>();
    const sorted = [...overflowing].sort((x, y) => x.path.length - y.path.length);
    const filtered: OverflowingElement[] = [];
    for (const o of sorted.reverse()) {
      if (seenAncestors.has(o.path)) continue;
      filtered.push(o);
      // Mark all ancestors as seen so we don't double-report wrap.
      let p = o.path;
      while (p.includes(">")) {
        p = p.slice(0, p.lastIndexOf(">"));
        seenAncestors.add(p);
      }
    }
    filtered.sort((x, y) => {
      // Most actionable first: horizontal-overflow > extends-beyond > wrap
      const rank = { "horizontal-overflow": 0, "extends-beyond-parent": 1, "vertical-wrap": 2 };
      return rank[x.kind] - rank[y.kind];
    });

    const reportPath = options.reportPath ?? join(outputDir, "report.md");
    const md = renderReport({
      html: htmlPath,
      inflateFactor,
      beforeScreenshot,
      afterScreenshot,
      overflowing: filtered,
      totalInspected: before.length,
    });
    await writeFile(reportPath, md);

    console.log(`  ${BOLD}${CYAN}vrt i18n-stress${RESET}`);
    console.log(`  ${DIM}html: ${htmlPath}  inflate: ${inflateFactor}x${RESET}`);
    const icon = filtered.length === 0 ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
    console.log(`  ${icon} ${filtered.length} overflow / wrap issue(s) across ${before.length} inspected element(s)`);
    for (const o of filtered.slice(0, 6)) {
      const detail = o.kind === "horizontal-overflow"
        ? `scrollW ${o.after.scrollWidth.toFixed(0)} > clientW ${o.after.clientWidth.toFixed(0)}`
        : o.kind === "vertical-wrap"
          ? `h ${o.before.height.toFixed(0)} → ${o.after.height.toFixed(0)}`
          : "extends beyond parent right edge";
      console.log(`    ${DIM}[${o.kind}] ${o.path} — ${detail}${RESET}`);
    }
    console.log(`  ${DIM}report: ${reportPath}${RESET}`);

    return {
      html: htmlPath,
      inflateFactor,
      beforeScreenshot,
      afterScreenshot,
      overflowing: filtered,
      totalInspected: before.length,
      reportPath,
    };
  } finally {
    await browser.close();
  }
}

function renderReport(r: Omit<I18nStressReport, "reportPath">): string {
  const lines: string[] = [];
  lines.push("# i18n stress report");
  lines.push("");
  lines.push(`HTML: \`${r.html}\``);
  lines.push(`Inflation factor: **${r.inflateFactor}×** — each word's length scaled by this ` +
    `(equivalent to typical German/Finnish/Russian translation expansion).`);
  lines.push("");
  lines.push("- Before: `" + r.beforeScreenshot + "`");
  lines.push("- After:  `" + r.afterScreenshot + "`");
  lines.push("");
  lines.push(`Inspected **${r.totalInspected}** text-bearing elements.`);
  lines.push("");
  if (r.overflowing.length === 0) {
    lines.push("## No overflow detected");
    lines.push("");
    lines.push("Layout is robust against word-length inflation up to " + r.inflateFactor + "×. " +
      "(Real-world German typically 1.3-1.5×, Finnish/Russian up to 1.6×.) " +
      "Re-run with `--inflate 2` to stress-test further.");
  } else {
    lines.push(`## Overflow / wrap issues: ${r.overflowing.length}`);
    lines.push("");
    lines.push("Each row is the innermost element where the layout broke after " +
      "text inflation. `horizontal-overflow` = text doesn't fit inside its " +
      "box (clipped or scrolled). `extends-beyond-parent` = element spills " +
      "past its parent's right edge. `vertical-wrap` = element grew taller, " +
      "usually because text wrapped to extra lines.");
    lines.push("");
    lines.push("| Kind | Path | Text (truncated) | Before W×H | After W×H | Detail |");
    lines.push("|---|---|---|---|---|---|");
    for (const o of r.overflowing.slice(0, 20)) {
      const detail = o.kind === "horizontal-overflow"
        ? `scrollW=${o.after.scrollWidth.toFixed(0)} clientW=${o.after.clientWidth.toFixed(0)}`
        : o.kind === "vertical-wrap"
          ? `+${(o.after.height - o.before.height).toFixed(0)}px height`
          : "—";
      const bw = `${o.before.width.toFixed(0)}×${o.before.height.toFixed(0)}`;
      const aw = `${o.after.width.toFixed(0)}×${o.after.height.toFixed(0)}`;
      lines.push(`| ${o.kind} | \`${o.path}\` | \`${o.text}\` | ${bw} | ${aw} | ${detail} |`);
    }
  }
  lines.push("");
  lines.push("## Suggested next step");
  lines.push("");
  if (r.overflowing.length === 0) {
    lines.push("Layout is i18n-robust at " + r.inflateFactor + "×. Consider testing common " +
      "edge cases like a single very long word (German compound noun, URL slug).");
  } else {
    lines.push("1. Open `after.png` and locate each element listed above.");
    lines.push("2. For `horizontal-overflow` rows: the box has a fixed `width` or its " +
      "container does. Switch to `max-width` + `min-width: 0`, or allow wrapping with " +
      "`white-space: normal` / `word-break: break-word`.");
    lines.push("3. For `vertical-wrap` rows: this is usually fine (text wrapped as expected), " +
      "but verify the element's container can grow. If the container has a fixed `height` " +
      "the wrapped text will be clipped — change to `min-height`.");
    lines.push("4. For `extends-beyond-parent` rows: the element's content escapes its parent " +
      "via `position: absolute`, negative margins, or a `width: 100vw` that ignores " +
      "container constraints. Audit width-related declarations.");
    lines.push("5. Re-run `vrt i18n-stress`. The overflow list should empty out.");
  }
  lines.push("");
  return lines.join("\n");
}

async function main(argv = process.argv.slice(2)) {
  const { positional, outputDir, report, inflate } = parseArgs(argv);
  if (positional.length === 0) {
    console.log("Usage: vrt i18n-stress <html> [--inflate 1.4] [--output-dir dir]");
    console.log("Options:");
    console.log("  --inflate <N>        Word-length inflation factor. Default 1.4.");
    console.log("  --output-dir <dir>   Default: ./test-results/i18n-stress");
    console.log("  --report <path>      Markdown report path");
    process.exit(1);
  }
  await runI18nStress({
    htmlPath: positional[0]!,
    outputDir: outputDir || join(process.cwd(), "test-results", "i18n-stress"),
    reportPath: report || undefined,
    inflateFactor: inflate,
  });
}

const isCliEntry = process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;
if (isCliEntry) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
