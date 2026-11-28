/**
 * `vlmkit check reset`: the page under every initial state a browser and a reset stylesheet give it,
 * rendered — the browser-measured counterpart of veriss's static `analyzeResetMatrix`.
 *
 * Each branch is one (UA × reset): the page opened in Chromium, Firefox or WebKit with one reset from
 * veriss's `veriss-resets/1` manifest (`veriss/resets/manifest.json`, the exact text a browser receives)
 * put in front of the page's own sheets by an init script — a `<style>` that is `document.styleSheets[0]`
 * before the page's first sheet is parsed, checked in every branch. At each width the page's media queries
 * make (`regimeWidths`), `check integrity`'s layout judges (`judgeIntegrityInstant`) read what is drawn.
 * `@mizchi/vlmkit-judge/reset-matrix.ts` decides what holds everywhere and what only in some branches.
 *
 * With veriss installed, the page's rendered DOM and sheets (read in Chromium with no reset, as `check css`
 * hands them over) go to `analyzeResetMatrix` at each width, over the same branches, and every box veriss
 * places is held to the browser on the one claim veriss's own e2e spec checks: a box it reports as not
 * fitting (`E_LAYOUT_ITEM_SIZE`, inline axis) sticks out past its parent's content box, and in a branch it
 * decided, a box it does not report does not.
 */
import type { Browser, Page } from "playwright";
import type { PageLoadOptions } from "@mizchi/vlmkit-core/page-load.ts";
import type { RuleView } from "@mizchi/vlmkit-core/plugin/contract.ts";
import { applyRuleTiers, hiddenByRuleNote } from "@mizchi/vlmkit-core/plugin/rule-tier.ts";
import { BOLD, CYAN, DIM, GREEN, RED, RESET, YELLOW } from "@mizchi/vlmkit-core/terminal-colors.ts";
import { regimeWidths } from "@mizchi/vlmkit-judge/inert-declaration.ts";
import {
  branchId,
  compareVerissClaims,
  judgeResetMatrix,
  mergeWidths,
  RESET_MATRIX_UAS,
  summarizeResetMatrix,
  type BranchRun,
  type BrowserBranchBoxes,
  type MatrixFinding,
  type ResetMatrixFinding,
  type ResetMatrixSummary,
  type ResetMatrixUa,
  type VerissBranchClaim,
  type VerissComparison,
} from "@mizchi/vlmkit-judge/reset-matrix.ts";
import { CssInspector } from "../stress/responsive-css.ts";
import { renderedInput, VERISS_PACKAGE } from "./veriss-bridge.ts";

export interface ResetEntry {
  id: string;
  name: string;
  version: string | null;
  license: string | null;
  url: string | null;
  css: string;
}

export interface ResetMatrixOptions extends PageLoadOptions {
  source: string;
  uas?: readonly ResetMatrixUa[];
  /** Reset ids from the manifest (default: all of them). */
  resets?: readonly string[];
  /** Widths to judge at (default: one per regime of the page's width media queries). */
  viewports?: readonly number[];
  height?: number;
  storageState?: string;
  /** Skip the veriss comparison even when veriss is installed. */
  noVeriss?: boolean;
}

export interface ResetMatrixReport {
  source: string;
  widths: number[];
  widthsFrom: "media queries" | "--viewports" | "default";
  height: number;
  /** Where the resets came from: the manifest's format and package, or why only `none` ran. */
  resetsFrom: string;
  resets: Omit<ResetEntry, "css">[];
  branches: (BranchRun & { ms: number })[];
  summary: ResetMatrixSummary;
  veriss:
    | { comparison: VerissComparison; claims: VerissBranchClaim[]; status: Record<string, string>; ms: number }
    | { skipped: string };
  redirect: string | null;
  findings: ResetMatrixFinding[];
}

export const DEFAULT_RESET_HEIGHT = 800;
const FALLBACK_WIDTHS = [1280, 375];
const NONE: ResetEntry = {
  id: "none",
  name: "No reset (the browser's UA stylesheet only)",
  version: null,
  license: null,
  url: null,
  css: "",
};

/** veriss's reset manifest (`veriss-resets/1`), or null with the reason when veriss is not installed. */
export async function loadResetManifest(): Promise<{ resets: ResetEntry[]; from: string } | { skipped: string }> {
  let path: string;
  try {
    // Resolved and read, not imported: a JSON import attribute is not handled alike by every loader (vitest's is not).
    const { createRequire } = await import("node:module");
    path = createRequire(import.meta.url).resolve(`${VERISS_PACKAGE}/resets/manifest.json`);
  } catch {
    return {
      skipped: `${VERISS_PACKAGE} 0.1.2 or later is not installed (an optional peer; its reset manifest is where the resets come from): only the UA axis (reset none) runs`,
    };
  }
  try {
    const { readFile } = await import("node:fs/promises");
    const manifest = JSON.parse(await readFile(path, "utf8")) as { format?: string; resets?: ResetEntry[] };
    if (manifest.format !== "veriss-resets/1" || !Array.isArray(manifest.resets))
      return {
        skipped: `${VERISS_PACKAGE}/resets/manifest.json is ${manifest.format ?? "of no format"}, not veriss-resets/1`,
      };
    return { resets: manifest.resets, from: `${VERISS_PACKAGE}/resets/manifest.json (veriss-resets/1)` };
  } catch (e) {
    return { skipped: `${VERISS_PACKAGE}/resets/manifest.json could not be read: ${message(e)}` };
  }
}

type AnalyzeResetMatrix = (
  input: { html: string; css?: string },
  options: Record<string, unknown>,
) => {
  branches: {
    id: string;
    status: string;
    findings: { code: string; box?: string; path?: string; axis?: string; message: string }[];
    unknowns: { code: string; message: string }[];
  }[];
};

async function loadAnalyzeResetMatrix(): Promise<AnalyzeResetMatrix | null> {
  try {
    const m = (await import(/* @vite-ignore */ `${VERISS_PACKAGE}/reset-matrix`)) as {
      analyzeResetMatrix?: AnalyzeResetMatrix;
    };
    return m.analyzeResetMatrix ?? null;
  } catch {
    return null;
  }
}

/** The init script that puts a reset in front of every sheet of the document. */
export function resetInitScript(css: string): string {
  return `(() => {
  const css = ${JSON.stringify(css)};
  const put = () => {
    const s = document.createElement("style");
    s.setAttribute("data-vlmkit-reset", "");
    s.textContent = css;
    document.documentElement.prepend(s);
  };
  if (document.documentElement) put();
  else new MutationObserver((_, o) => { if (document.documentElement) { o.disconnect(); put(); } })
    .observe(document, { childList: true });
})()`;
}

const RESET_FIRST_JS = `(() => {
  const first = document.styleSheets[0];
  return !!(first && first.ownerNode && first.ownerNode.hasAttribute && first.ownerNode.hasAttribute("data-vlmkit-reset"));
})()`;

/**
 * Every in-flow box whose border box sticks out past its parent's content box on the inline axis, keyed by veriss's
 * box path (html is `Document`; under html, head and the injected reset are not boxes; below, every element child
 * counts, as veriss's tree has them), with veriss's label (`#id`, `.class.class`, or `tag@path`). The claims' paths
 * come in so a path whose element veriss's label does not name is left out of the comparison.
 */
const BOX_OVERFLOW_JS = `(claims) => {
  const label = (el, path) => el.id ? "#" + el.id : el.classList.length ? [...el.classList].map((c) => "." + c).join("") : el.localName + "@" + path;
  const kids = (el) => [...el.children].filter((c) => el !== document.documentElement || (c.localName !== "head" && !c.hasAttribute("data-vlmkit-reset")));
  const overflows = [];
  const byPath = new Map();
  const walk = (el, path) => {
    byPath.set(path, el);
    if (el.namespaceURI !== "http://www.w3.org/1999/xhtml") return;
    const parent = el.parentElement;
    if (parent && parent !== document.documentElement) {
      const cs = getComputedStyle(el), ps = getComputedStyle(parent);
      const inFlow = cs.display !== "none" && cs.display !== "contents" && (cs.position === "static" || cs.position === "relative" || cs.position === "sticky")
        && !(parseFloat(cs.marginLeft) < 0) && !(parseFloat(cs.marginRight) < 0) && cs.float === "none";
      const blockParent = ps.display !== "inline" && ps.display !== "contents" && ps.display !== "none";
      if (inFlow && blockParent) {
        const r = el.getBoundingClientRect(), q = parent.getBoundingClientRect();
        if (r.width > 0 || r.height > 0) {
          const right = q.right - parseFloat(ps.paddingRight) - parseFloat(ps.borderRightWidth);
          const left = q.left + parseFloat(ps.paddingLeft) + parseFloat(ps.borderLeftWidth);
          const over = Math.max(r.right - right, left - r.left);
          if (over > 0.02) overflows.push({ path, label: label(el, path), amount: Math.round(over * 100) / 100 });
        }
      }
    }
    kids(el).forEach((c, i) => walk(c, path + "/" + i));
  };
  walk(document.documentElement, "Document");
  const unmapped = claims.filter((c) => { const el = byPath.get(c.path); return !el || label(el, c.path) !== c.label; }).map((c) => c.path);
  return { overflows, unmapped };
}`;

const settle = (page: Page) =>
  page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(() => r(), 50)))),
  );

async function judgeBranch(page: Page, width: number) {
  const ic = await import("./integrity-check.ts");
  const { judgeIntegrityInstant } = await import("./integrity-timeline.ts");
  return judgeIntegrityInstant(page, width, {
    text: ic.COLLECT_INTEGRITY_TEXT,
    clip: ic.COLLECT_CLIP_CANDIDATES,
    collapse: ic.COLLECT_COLLAPSE_CANDIDATES,
    protrusions: ic.COLLECT_PROTRUSIONS,
    contrast: ic.COLLECT_TEXT_CONTRAST,
    occlusions: ic.COLLECT_OCCLUSIONS,
  });
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e)).split("\n")[0]!.slice(0, 300);

export async function runResetMatrix(options: ResetMatrixOptions): Promise<ResetMatrixReport> {
  const { launchBrowser } = await import("@mizchi/vlmkit-core/browser-launch.ts");
  const { openSource } = await import("@mizchi/vlmkit-core/page-open.ts");
  const { pickPageLoad } = await import("@mizchi/vlmkit-core/page-load.ts");
  const load = { ...pickPageLoad(options), ...(options.storageState ? { storageState: options.storageState } : {}) };
  const height = options.height ?? DEFAULT_RESET_HEIGHT;
  const uas = [...(options.uas ?? RESET_MATRIX_UAS)];

  const manifest = await loadResetManifest();
  const available = "skipped" in manifest ? [NONE] : manifest.resets;
  const wanted = options.resets ?? available.map((r) => r.id);
  for (const id of wanted)
    if (!available.some((r) => r.id === id))
      throw new Error(
        `unknown reset ${id}: ${"skipped" in manifest ? manifest.skipped : `one of ${available.map((r) => r.id).join(", ")}`}`,
      );
  const resets = wanted.map((id) => available.find((r) => r.id === id)!);
  const space = { uas, resets: resets.map((r) => r.id) };

  // The probe: the page in Chromium with no reset. Its width queries give the widths, and its rendered DOM
  // and sheets are what veriss reads (as check css hands them over).
  let widths = options.viewports ? [...options.viewports] : [];
  let widthsFrom: ResetMatrixReport["widthsFrom"] = options.viewports ? "--viewports" : "default";
  let redirect: string | null = null;
  let input: Awaited<ReturnType<typeof renderedInput>> = { skipped: "Chromium could not open the page" };
  let probeBrowser: Browser | undefined;
  try {
    probeBrowser = await launchBrowser({ engine: "chromium" });
    const opened = await openSource(probeBrowser, options.source, {
      ...load,
      viewport: { width: widths[0] ?? 1280, height },
    });
    redirect = opened.redirect;
    const inspector = await CssInspector.open(opened.page);
    if (inspector) {
      try {
        if (!options.viewports) {
          const found = regimeWidths(await inspector.mediaConditions());
          // [1280] alone is regimeWidths' answer for a page with no width query: one desktop width.
          if (found.length) {
            widths = found;
            if (found.length > 1) widthsFrom = "media queries";
          }
        }
        input = await renderedInput(opened.page, inspector);
      } finally {
        await inspector.close();
      }
    }
    await opened.page.close();
  } catch (e) {
    input = { skipped: `Chromium could not open the page: ${message(e)}` };
  } finally {
    await probeBrowser?.close().catch(() => {});
  }
  if (widths.length === 0) widths = [...FALLBACK_WIDTHS];
  widths.sort((a, b) => b - a);

  // veriss over the same branches, one analysis per width (min = max, so its boxes are the drawn ones).
  let veriss: ResetMatrixReport["veriss"] = { skipped: "" };
  let claims: VerissBranchClaim[] = [];
  const status: Record<string, string> = {};
  const analyze = options.noVeriss ? null : await loadAnalyzeResetMatrix();
  if (options.noVeriss) veriss = { skipped: "--no-veriss" };
  else if (!analyze)
    veriss = {
      skipped: `${VERISS_PACKAGE} 0.1.2 or later is not installed (an optional peer): no static comparison`,
    };
  else if ("skipped" in manifest) veriss = { skipped: manifest.skipped };
  else if ("skipped" in input) veriss = { skipped: input.skipped };
  else {
    const started = performance.now();
    try {
      for (const width of widths) {
        const m = analyze(
          { html: input.html, css: input.css },
          {
            // The root of every box path: BOX_OVERFLOW_JS names the browser's boxes from the same root.
            name: "Document",
            viewport: { min: width, max: width, height: { min: height, max: height } },
            uas,
            resets: space.resets,
            ...(Object.keys(input.images).length ? { images: input.images } : {}),
            shorthandConflicts: "warning",
          },
        );
        for (const b of m.branches) {
          status[`${b.id}@${width}`] = b.status;
          claims.push({
            id: b.id,
            width,
            status: b.status,
            decided: b.unknowns.length === 0,
            overflows: b.findings
              .filter((f) => f.code === "E_LAYOUT_ITEM_SIZE" && f.axis === "inline" && f.path)
              .map((f) => ({ path: f.path!, label: f.box ?? f.path!, message: f.message })),
          });
        }
      }
      veriss = {
        comparison: compareVerissClaims([], []),
        claims,
        status,
        ms: Math.round(performance.now() - started),
      };
    } catch (e) {
      claims = [];
      veriss = { skipped: `veriss could not read the page: ${message(e)}` };
    }
  }

  // The branches.
  const branches: ResetMatrixReport["branches"] = [];
  const boxes: BrowserBranchBoxes[] = [];
  for (const ua of uas) {
    let browser: Browser | undefined;
    let launchError: string | undefined;
    try {
      browser = await launchBrowser({ engine: ua });
    } catch (e) {
      launchError = message(e);
    }
    try {
      for (const reset of resets) {
        const id = branchId(ua, reset.id);
        const started = performance.now();
        if (!browser) {
          branches.push({ id, ua, reset: reset.id, status: "skipped", error: launchError, findings: [], ms: 0 });
          continue;
        }
        let page: Page | undefined;
        try {
          const opened = await openSource(browser, options.source, {
            ...load,
            viewport: { width: widths[0]!, height },
            ...(reset.css ? { initScripts: [resetInitScript(reset.css)] } : {}),
          });
          page = opened.page;
          if (reset.css && !(await page.evaluate(RESET_FIRST_JS)))
            throw new Error("the reset stylesheet is not the document's first sheet (the page moved or removed it)");
          const found = [];
          const branchClaims = claims.filter((c) => c.id === id).flatMap((c) => c.overflows);
          for (const width of widths) {
            if (width !== widths[0]) {
              await page.setViewportSize({ width, height });
              await settle(page);
            }
            found.push(...(await judgeBranch(page, width)));
            if (claims.length) {
              const drawn = (await page.evaluate(`(${BOX_OVERFLOW_JS})(${JSON.stringify(branchClaims)})`)) as Omit<
                BrowserBranchBoxes,
                "id" | "width"
              >;
              boxes.push({ id, width, ...drawn });
            }
          }
          branches.push({
            id,
            ua,
            reset: reset.id,
            status: "measured",
            findings: mergeWidths(found),
            ms: Math.round(performance.now() - started),
          });
        } catch (e) {
          branches.push({
            id,
            ua,
            reset: reset.id,
            status: "failed",
            error: message(e),
            findings: [],
            ms: Math.round(performance.now() - started),
          });
        } finally {
          await page?.close().catch(() => {});
        }
      }
    } finally {
      await browser?.close().catch(() => {});
    }
  }
  if (!("skipped" in veriss)) veriss.comparison = compareVerissClaims(claims, boxes);
  const summary = summarizeResetMatrix(branches, space);
  return {
    source: options.source,
    widths,
    widthsFrom,
    height,
    resetsFrom: "skipped" in manifest ? manifest.skipped : manifest.from,
    resets: resets.map(({ css: _css, ...r }) => r),
    branches,
    summary,
    veriss,
    redirect,
    findings: judgeResetMatrix({ summary, veriss: "skipped" in veriss ? null : veriss.comparison, redirect }),
  };
}

// ---------------------------------------------------------------------------
// Prose

/** A UA × reset grid of one finding: x where it is, . where it is not, ? where the branch was not measured. */
function grid(f: MatrixFinding, report: ResetMatrixReport): string[] {
  const { uas, resets } = report.summary.space;
  const w = Math.max(...uas.map((u) => u.length));
  const cols = resets.map((r) => Math.max(r.length, 1));
  const head = `${" ".repeat(w + 6)}${resets.map((r, i) => r.padEnd(cols[i]!)).join("  ")}`;
  const rows = uas.map((u) => {
    const cells = resets.map((r, i) => {
      const id = `${u}:${r}`;
      const mark = f.in.includes(id)
        ? `${RED}x${RESET}`
        : f.unmeasured.includes(id)
          ? `${YELLOW}?${RESET}`
          : `${DIM}.${RESET}`;
      return mark + " ".repeat(cols[i]! - 1);
    });
    return `      ${u.padEnd(w)}  ${DIM}│${RESET}  ${cells.join("  ")}`;
  });
  return [`${DIM}${head}${RESET}`, ...rows];
}

export function formatResetMatrixReport(report: ResetMatrixReport, rules?: RuleView): string {
  const { summary } = report;
  const lines = [
    `${BOLD}${CYAN}vlmkit check reset${RESET}`,
    `${DIM}source: ${report.source}${RESET}`,
    `${DIM}branches: ${summary.space.uas.join(", ")} × ${summary.space.resets.join(", ")} = ${summary.space.total} (${summary.space.measured} measured); widths ${report.widths.join(", ")}px (${report.widthsFrom}) at ${report.height}px tall${RESET}`,
    `${DIM}resets: ${report.resetsFrom}${RESET}`,
    "",
  ];
  const { shown: rows, hiddenByRule } = applyRuleTiers(
    report.findings,
    (f) => ({ rule: f.rule, emitted: f.severity }),
    rules,
  );
  const tiered = rows.map(({ row, tier }) => ({ ...row, tier }));
  const mark = (tier: string) =>
    tier === "suspect" ? `${RED}x${RESET}` : tier === "warn" ? `${YELLOW}!${RESET}` : `${DIM}i${RESET}`;
  const shown = (rule: string) => tiered.filter((f) => f.rule === rule);
  for (const f of shown("redirected")) lines.push(`${mark(f.tier)} ${f.message}`, "");

  const every = shown("every-branch");
  lines.push(`${BOLD}In every branch${RESET} (${every.length})`);
  if (every.length === 0) lines.push(`  ${GREEN}none${RESET}`);
  for (const f of every) lines.push(`  ${mark(f.tier)} ${f.message}`);
  lines.push("");

  const only = shown("branch-defect");
  lines.push(`${BOLD}Only in some branches${RESET} (${only.length})`);
  if (only.length === 0) lines.push(`  ${GREEN}none${RESET}`);
  for (const f of only) {
    lines.push(`  ${mark(f.tier)} ${f.message}`);
    const m = summary.onlyIn.find(
      (x) => x.summary === f.evidence?.summary && x.in.join() === (f.evidence?.in as string[]).join(),
    );
    if (m) lines.push(...grid(m, report));
  }
  lines.push("");

  if (summary.equivalent.length > 1 || summary.unmeasured.length)
    lines.push(
      `${DIM}${summary.space.measured} measured branch(es) fall in ${summary.equivalent.length} group(s) with the same findings: ${summary.equivalent.map((g) => g.length).join(" + ")}${RESET}`,
    );
  for (const f of shown("branch-unmeasured")) lines.push(`${mark(f.tier)} ${f.message}`);
  if (summary.unmeasured.length) lines.push("");

  if ("skipped" in report.veriss) lines.push(`${DIM}veriss: ${report.veriss.skipped}${RESET}`);
  else {
    const c = report.veriss.comparison;
    lines.push(
      `${BOLD}veriss${RESET} ${DIM}(analyzeResetMatrix on the rendered DOM and sheets, ${report.veriss.ms}ms; E_LAYOUT_ITEM_SIZE on the inline axis against the drawn boxes)${RESET}`,
      `  ${c.decided} of ${c.pairs} branch × width pair(s) decided by veriss, ${c.agreedPairs} of them agreeing with the browser on every box; ${c.compared} box claim(s) compared, ${c.agreed} agree, ${c.disagreements.length} disagree`,
    );
    const ids = Object.keys(c.perBranch);
    const decidedIds = ids.filter((id) => c.perBranch[id]!.decided > 0);
    if (decidedIds.length)
      lines.push(
        `  ${DIM}decided (pairs agreeing / decided): ${decidedIds.map((id) => `${id} ${c.perBranch[id]!.agreedPairs}/${c.perBranch[id]!.decided}`).join(", ")}${RESET}`,
      );
    const undecided = ids.filter((id) => c.perBranch[id]!.decided === 0);
    if (undecided.length) lines.push(`  ${DIM}Unknown at every width: ${undecided.join(", ")}${RESET}`);
    for (const f of shown("veriss-disagrees")) lines.push(`  ${mark(f.tier)} ${f.message}`);
  }
  const suspects = tiered.filter((f) => f.tier === "suspect").length;
  const hidden = hiddenByRuleNote(hiddenByRule);
  if (hidden) lines.push("", `${DIM}${hidden}${RESET}`);
  lines.push(
    "",
    `${suspects} suspect, ${tiered.length - suspects} other finding(s) over ${summary.space.measured} branch(es)`,
  );
  return lines.join("\n");
}
