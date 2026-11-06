/**
 * `vlmkit check auto <page>`: load the page once, see what it has, and run the gates that apply
 * (issue #216).
 *
 * An agent new to vlmkit has to know that a page with transitions wants `check animation`, a form
 * wants `check interactions`, a theme that follows the OS wants `--color-scheme dark`, and so on;
 * the motion-authoring A/B measured the vlmkit group at 1.5-5x the control's time, part of it spent
 * choosing and running gates one by one. Here one probe reads the page (`PROBE_PAGE`), `chooseGates`
 * picks from what it found and says why each was picked, and the gates run in parallel through the
 * batch runner. The three style gates share one page load: `scan style` captures it beside the
 * other gates, then `check design` / `composition` / `color` judge the snapshot with no browser.
 *
 * What is chosen follows the eight judgment logs of the demo sites (`examples/sites/`): every log
 * ran integrity, contrast and the three style gates; the operable pages ran interactions, focus
 * and touch; pages with width queries ran breakpoints; scrollers, scroll; animated pages,
 * animation and motion. Not chosen, because each needs an input the page cannot supply: `check
 * copy` (a manifest), `verify flow` (a spec), `check layout` (a contract), `inspect motion` (the
 * targets and what they should do). They are named in the output when the page suggests them.
 */
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isCliEntry } from "@mizchi/vlmkit-core/plugin/cli-entry.ts";
import { hasFlag, readInt } from "@mizchi/vlmkit-core/arg-reader.ts";
import { UsageError } from "@mizchi/vlmkit-core/cli-error.ts";
import { BOLD, CYAN, DIM, RESET, YELLOW } from "@mizchi/vlmkit-core/terminal-colors.ts";
import { quoteArg } from "@mizchi/vlmkit-core/motion-spec.ts";

/** What the probe read off the page. */
export interface PageFeatures {
  /** Characters of visible text. */
  text: number;
  /** Elements that take a pointer or the keyboard (links, buttons, fields, [tabindex], ARIA widgets). */
  controls: number;
  /** Media queries on width (min-width / max-width / width ranges), by their numbers. */
  widthQueries: number[];
  /** A `prefers-color-scheme: dark` query, or `color-scheme` naming dark. */
  darkScheme: boolean;
  /** A `prefers-reduced-motion` query. */
  reducedMotionQuery: boolean;
  /** Rules that set an animation, rules that set a transition, and animations running at load. */
  animationRules: number;
  transitionRules: number;
  runningAnimations: number;
  /** Elements that scroll (overflow auto / scroll with more content than box), sticky / fixed, snap. */
  scrollers: number;
  stickyOrFixed: number;
  snap: number;
  /** <canvas> and <video> elements of some size: what no DOM gate reads inside. */
  canvases: number;
  videos: number;
  /** Stylesheets neither the page nor a fetch of their text could read: their rules were not seen. */
  unreadableSheets: number;
  /** Their addresses, read again outside the page (`readSheetText`). */
  unreadableHrefs?: string[];
}

/**
 * What a stylesheet's text declares, for a sheet the page could not read through the CSSOM: a sheet
 * linked from a \`file:\` page is cross-origin in Chromium, so the CSSOM missed every width query of
 * the demo sites (their CSS is a linked file) and \`check breakpoints\` was never chosen. Read as text:
 * a count, not a parse, which is all \`chooseGates\` uses.
 */
export function scanCssText(
  text: string,
): Pick<PageFeatures, "widthQueries" | "darkScheme" | "reducedMotionQuery" | "animationRules" | "transitionRules"> {
  const css = text.replace(/\/\*[\s\S]*?\*\//g, "");
  const widths = new Set<number>();
  for (const m of css.matchAll(/@media[^{]*/g)) {
    for (const w of m[0].matchAll(/(?:min-|max-)?width\s*[:<>=]+\s*([\d.]+)(px|em|rem)?/g)) {
      const v = Number(w[1]) * (w[2] === "em" || w[2] === "rem" ? 16 : 1);
      if (Number.isFinite(v)) widths.add(Math.round(v));
    }
  }
  const count = (re: RegExp) => [...css.matchAll(re)].length;
  return {
    widthQueries: [...widths].sort((a, b) => a - b),
    darkScheme: /prefers-color-scheme\s*:\s*dark/.test(css) || /color-scheme\s*:[^;}]*dark/.test(css),
    reducedMotionQuery: /prefers-reduced-motion/.test(css),
    // `\s*` before the look-ahead backtracks to zero spaces and lets " none" through: no space allowed there.
    animationRules: count(/(?:^|[;{\s])animation(?:-name)?\s*:\s*(?![\s]|none\b)[^;}]+/g),
    transitionRules: count(/(?:^|[;{\s])transition(?:-property)?\s*:\s*(?![\s]|none\b)[^;}]+/g),
  };
}

/** Fold a sheet's text into what the page could read. */
export function mergeSheet(f: PageFeatures, sheet: ReturnType<typeof scanCssText>): PageFeatures {
  return {
    ...f,
    widthQueries: [...new Set([...f.widthQueries, ...sheet.widthQueries])].sort((a, b) => a - b),
    darkScheme: f.darkScheme || sheet.darkScheme,
    reducedMotionQuery: f.reducedMotionQuery || sheet.reducedMotionQuery,
    animationRules: f.animationRules + sheet.animationRules,
    transitionRules: f.transitionRules + sheet.transitionRules,
    unreadableSheets: Math.max(0, f.unreadableSheets - 1),
  };
}

export interface ChosenGate {
  gate: string;
  /** Why it was chosen, from the features. */
  why: string;
  /** Judges the shared style snapshot (`--from`), after it is captured. */
  fromSnapshot?: boolean;
}

export interface AutoPlan {
  gates: ChosenGate[];
  /** What the page suggests but cannot be run without an input of yours. */
  notes: string[];
}

/** Read in the page: everything `chooseGates` decides from. */
export const PROBE_PAGE = String.raw`(() => {
  const out = { text: 0, controls: 0, widthQueries: [], darkScheme: false, reducedMotionQuery: false,
    animationRules: 0, transitionRules: 0, runningAnimations: 0, scrollers: 0, stickyOrFixed: 0, snap: 0,
    canvases: 0, videos: 0, unreadableSheets: 0, unreadableHrefs: [] };
  const widths = new Set();
  const media = (text) => {
    for (const m of text.matchAll(/(?:min-|max-)?width\s*[:<>=]+\s*([\d.]+)(px|em|rem)?/g)) {
      const n = Number(m[1]) * (m[2] === "em" || m[2] === "rem" ? 16 : 1);
      if (Number.isFinite(n)) widths.add(Math.round(n));
    }
    if (/prefers-color-scheme\s*:\s*dark/.test(text)) out.darkScheme = true;
    if (/prefers-reduced-motion/.test(text)) out.reducedMotionQuery = true;
  };
  const walk = (rules) => {
    for (const r of rules) {
      if (r instanceof CSSStyleRule) {
        const s = r.style;
        if (s.animationName && s.animationName !== "none") out.animationRules++;
        if (s.transitionDuration && !/^0s(,\s*0s)*$/.test(s.transitionDuration) && s.transitionProperty !== "none")
          out.transitionRules++;
        if (/dark/.test(s.colorScheme || "")) out.darkScheme = true;
      }
      if (r instanceof CSSMediaRule) media(r.conditionText || r.media.mediaText);
      if ("cssRules" in r && r.cssRules) walk(r.cssRules);
    }
  };
  for (const sheet of document.styleSheets) {
    try { if (sheet.media && sheet.media.mediaText) media(sheet.media.mediaText); walk(sheet.cssRules); }
    catch { out.unreadableSheets++; if (sheet.href) out.unreadableHrefs.push(sheet.href); }
  }
  out.widthQueries = [...widths].sort((a, b) => a - b);
  out.runningAnimations = document.getAnimations().length;
  const visible = (el) => { const b = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    return b.width > 0 && b.height > 0 && cs.visibility !== "hidden" && cs.display !== "none"; };
  const CONTROLS = 'a[href],button,input:not([type=hidden]),select,textarea,summary,[tabindex]:not([tabindex="-1"]),' +
    '[role=button],[role=link],[role=tab],[role=checkbox],[role=switch],[role=menuitem],[contenteditable=""],[contenteditable=true]';
  out.controls = [...document.querySelectorAll(CONTROLS)].filter(visible).length;
  out.text = (document.body ? document.body.innerText : "").replace(/\s+/g, " ").trim().length;
  for (const el of document.querySelectorAll("body *")) {
    const cs = getComputedStyle(el);
    if (cs.position === "sticky" || cs.position === "fixed") out.stickyOrFixed++;
    if (cs.scrollSnapType && cs.scrollSnapType !== "none") out.snap++;
    const scrolls = (o) => o === "auto" || o === "scroll";
    if ((scrolls(cs.overflowY) && el.scrollHeight > el.clientHeight + 1) || (scrolls(cs.overflowX) && el.scrollWidth > el.clientWidth + 1))
      out.scrollers++;
  }
  const sized = (el) => { const b = el.getBoundingClientRect(); return b.width >= 16 && b.height >= 16; };
  out.canvases = [...document.querySelectorAll("canvas")].filter(sized).length;
  out.videos = [...document.querySelectorAll("video")].filter(sized).length;
  return out;
})()`;

const n = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

/** The gates the features call for, each with the reason. Pure: features in, a plan out. */
export function chooseGates(f: PageFeatures, snapshot = "<snapshot>"): AutoPlan {
  const gates: ChosenGate[] = [];
  const notes: string[] = [];
  const add = (gate: string, why: string, fromSnapshot = false) =>
    gates.push({ gate, why, ...(fromSnapshot ? { fromSnapshot } : {}) });
  add("check integrity", "every page: broken render, overflow, collisions, invisible text, at three widths");
  if (f.text > 0) {
    add("check a11y contrast", `${n(f.text, "character")} of text`);
    add(`scan style --out ${quoteArg(snapshot)}`, "one page load for the three style gates");
    add(`check design --from ${quoteArg(snapshot)}`, "consistency of the components the page implies", true);
    add(`check composition --from ${quoteArg(snapshot)}`, "grouping, rails and type hierarchy", true);
    add(`check color --from ${quoteArg(snapshot)}`, "the palette by role, and colour carrying meaning alone", true);
  }
  if (f.controls > 0) {
    const what = n(f.controls, "control");
    add("check interactions", `${what}: each one's keyboard behaviour`);
    add("check a11y focus", `${what}: Tab order against reading order`);
    add("check a11y touch", `${what}: target sizes`);
  }
  if (f.widthQueries.length > 0)
    add(
      "check breakpoints",
      `width media queries at ${f.widthQueries.slice(0, 6).join(", ")}${f.widthQueries.length > 6 ? ", …" : ""}px`,
    );
  const scroll = [
    f.scrollers > 0 ? n(f.scrollers, "scroll container") : "",
    f.stickyOrFixed > 0 ? `${f.stickyOrFixed} sticky / fixed` : "",
    f.snap > 0 ? n(f.snap, "snap container") : "",
  ].filter(Boolean);
  if (scroll.length > 0) add("check scroll", scroll.join(", "));
  const motion = f.animationRules + f.transitionRules + f.runningAnimations;
  if (motion > 0) {
    const what = [
      f.animationRules > 0 ? n(f.animationRules, "animation rule") : "",
      f.transitionRules > 0 ? n(f.transitionRules, "transition rule") : "",
      f.runningAnimations > 0 ? `${f.runningAnimations} running at load` : "",
    ]
      .filter(Boolean)
      .join(", ");
    // check animation measures what plays from load: a page whose only motion is hover transitions
    // gives it nothing to measure ("no animation"), and the judgment logs ran check motion on those.
    if (f.animationRules + f.runningAnimations > 0)
      add("check animation", `${what}: that each runs, settles and has a visible effect`);
    add(
      "check motion",
      `${what}: reduced-motion handling${f.reducedMotionQuery ? " (the page has a prefers-reduced-motion query)" : ""}`,
    );
    notes.push(
      'inspect motion judges whether a motion looks right (easing, direction, origin, timing): it needs the elements that move and what each should do — give them as flags, or as a { "motion": ... } entry in vlmkit.gates.json',
    );
  }
  if (f.darkScheme) {
    add("check integrity --color-scheme dark", "a dark theme by prefers-color-scheme: the same page in it");
    if (f.text > 0) add("check a11y contrast --color-scheme dark", "its contrast in the dark theme");
  }
  if (f.canvases > 0)
    notes.push(
      `${n(f.canvases, "canvas", "canvases")}: no DOM gate reads what is drawn inside; inspect motion --track x,y,w,h follows a shape on it by its pixels`,
    );
  if (f.videos > 0)
    notes.push(`${n(f.videos, "video")}: check flash judges what it shows, from a recording (scan video)`);
  if (f.unreadableSheets > 0)
    notes.push(
      `${n(f.unreadableSheets, "stylesheet")} could not be read (cross-origin): animations, width queries and a dark theme declared there were not seen`,
    );
  if (f.text > 0)
    notes.push("check copy holds the copy to a manifest of the text it should show (--manifest copy.txt)");
  return { gates, notes };
}

async function probe(source: string): Promise<PageFeatures> {
  const { withBrowser } = await import("@mizchi/vlmkit-core/browser-launch.ts");
  const { openSource } = await import("@mizchi/vlmkit-core/page-open.ts");
  const { readFile } = await import("node:fs/promises");
  const { fileURLToPath } = await import("node:url");
  return withBrowser(async (browser) => {
    const { page } = await openSource(browser, source, { viewport: { width: 1280, height: 800 } });
    let f = (await page.evaluate(PROBE_PAGE)) as PageFeatures;
    for (const href of f.unreadableHrefs ?? []) {
      const text = await (
        href.startsWith("file:")
          ? readFile(fileURLToPath(href), "utf-8")
          : page
              .context()
              .request.get(href)
              .then((r) => (r.ok() ? r.text() : Promise.reject(new Error(String(r.status())))))
      ).catch(() => null);
      if (text !== null) f = mergeSheet(f, scanCssText(text));
    }
    const { unreadableHrefs: _, ...rest } = f;
    return rest;
  });
}

const USAGE = `Usage: vlmkit check auto <page.html|url> [--plan] [--json] [--concurrency <n>] [--show-output]

Loads the page once, reads what it has (text, controls, width queries, a dark theme, animations,
scrollers, canvases), and runs the gates that apply, in parallel, with one verdict. Each chosen gate
is printed with the reason. The three style gates share one page load (scan style, then --from).

  --plan            Print what would run and why; run nothing
  --json            The probe, the plan and every gate's report as JSON
  --concurrency <n> Gates at once (default: the batch runner's)
  --show-output     Print each failing gate's whole output

Exit: 0 every gate passes, 1 one fails, 2 usage error.`;

export async function main(argv = process.argv.slice(2)): Promise<number> {
  if (argv.length === 0 || hasFlag(argv, "help") || argv.includes("-h")) {
    console.log(USAGE);
    return argv.length === 0 ? 2 : 0;
  }
  const value = new Set(["--concurrency"]);
  const positional = argv.filter((a, i) => !a.startsWith("--") && !(i > 0 && value.has(argv[i - 1]!)));
  if (positional.length !== 1) throw new UsageError(`check auto takes one page or URL, got ${positional.length}`);
  const source = positional[0]!;
  const json = hasFlag(argv, "json");
  const concurrency = readInt(argv, "concurrency", { min: 1 });

  const features = await probe(source);
  const snapshot = join(await mkdtemp(join(tmpdir(), "vlmkit-auto-")), "style.json");
  const plan = chooseGates(features, snapshot);

  if (hasFlag(argv, "plan")) {
    if (json) console.log(JSON.stringify({ source, features, ...plan }, null, 2));
    else console.log(formatPlan(source, plan));
    return 0;
  }

  const { runJobs, formatBatchSummary } = await import("./batch-cli.ts");
  const options = {
    ...(concurrency !== undefined ? { concurrency } : {}),
    quiet: json,
    ...(json ? { json: true } : {}),
  };
  // The browser gates and the snapshot together; then the style gates on the snapshot, with no browser.
  const first = plan.gates.filter((g) => !g.fromSnapshot);
  const second = plan.gates.filter((g) => g.fromSnapshot);
  if (!json) console.log(formatPlan(source, plan));
  const a = await runJobs(
    first.map((g) => ({ gate: g.gate, page: source })),
    options,
  );
  const snapOk = a.jobs.find((j) => j.gate.startsWith("scan style"))?.exitCode === 0;
  const b =
    second.length > 0 && snapOk
      ? await runJobs(
          second.map((g) => ({ gate: g.gate, page: "" })),
          options,
        )
      : undefined;
  const jobs = [...a.jobs, ...(b?.jobs ?? [])];
  const summary = {
    ...a,
    jobs,
    passed: jobs.filter((j) => j.exitCode === 0).length,
    failed: jobs.filter((j) => j.exitCode !== 0).length,
    wallMs: a.wallMs + (b?.wallMs ?? 0),
    serialMs: a.serialMs + (b?.serialMs ?? 0),
  };
  if (json) {
    console.log(
      JSON.stringify(
        {
          source,
          features,
          ...plan,
          ...summary,
          jobs: summary.jobs.map(({ output, envelope, ...rest }) => ({
            ...rest,
            ...(envelope ? { gateReport: envelope } : { unparsedOutput: output }),
          })),
        },
        null,
        2,
      ),
    );
  } else {
    if (second.length > 0 && !snapOk)
      console.log(`${YELLOW}scan style did not write its snapshot, so the three style gates were not run${RESET}`);
    console.log(formatBatchSummary(summary, { showOutput: hasFlag(argv, "show-output") }));
  }
  return summary.failed > 0 || (second.length > 0 && !snapOk) ? 1 : 0;
}

function formatPlan(source: string, plan: AutoPlan): string {
  const lines = [
    `${BOLD}${CYAN}vlmkit check auto${RESET} ${DIM}${source}${RESET}`,
    "",
    `${plan.gates.length} gate(s) chosen:`,
  ];
  const width = Math.max(...plan.gates.map((g) => g.gate.replace(/ --(from|out) .*$/, "").length));
  for (const g of plan.gates)
    lines.push(`  ${g.gate.replace(/ --(from|out) .*$/, "").padEnd(width)}  ${DIM}${g.why}${RESET}`);
  if (plan.notes.length > 0) {
    lines.push("", "Not run (each needs an input of yours):");
    for (const note of plan.notes) lines.push(`  ${DIM}- ${note}${RESET}`);
  }
  lines.push("");
  return lines.join("\n");
}

if (isCliEntry(import.meta.url, "check-auto")) {
  const { handleCliError } = await import("@mizchi/vlmkit-core/cli-error.ts");
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch(handleCliError);
}
