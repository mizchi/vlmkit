/**
 * `vlmkit act <page> --goal "…" --expect <postcondition>…` (issue #220): a browser agent whose
 * steps are verified by gates, not by its own say-so.
 *
 *   plan a step → act → verify → keep it, or roll it back and tell the planner why
 *
 * Verify is deterministic: the step must not bring in a `check integrity` defect the page did not
 * have before it, a toggle it clicked must show what its `aria-expanded` says, and the run ends
 * `verified` only when every `--expect` postcondition holds on the page. A planner that says
 * "done" while one does not is `claimed` — the failure browser agents report as success.
 *
 * Planners: `--planner llm` (the LLM client's provider; needs its key), `--plan steps.json` (a
 * fixed list of actions: no key, and how the loop itself is tested), `--planner-cmd "<cmd>"`
 * (any program: it gets the observation as JSON on stdin and prints an action — an agent with
 * no API key can be its own planner).
 */
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { Browser, Page } from "playwright";
import { isCliEntry } from "@mizchi/vlmkit-core/plugin/cli-entry.ts";
import { hasFlag, readAll, readFlag, readInt } from "@mizchi/vlmkit-core/arg-reader.ts";
import { UsageError } from "@mizchi/vlmkit-core/cli-error.ts";
import { BOLD, CYAN, DIM, GREEN, RED, RESET, YELLOW } from "@mizchi/vlmkit-core/terminal-colors.ts";
import type { SessionTrace } from "@mizchi/vlmkit-judge/session-trace.ts";
import {
  actVerdict,
  checkAction,
  describeAction,
  describePostcondition,
  newFindings,
  parseActAction,
  parseExpectation,
  postconditionHolds,
  type ActAction,
  type ActOutcome,
  type Postcondition,
  type PostconditionReading,
  type StepFinding,
} from "@mizchi/vlmkit-judge/act.ts";

export interface Observation {
  url: string;
  title: string;
  /** Visible text, cut to a budget. */
  text: string;
  /** Controls on screen, each with an id the planner may use as a target (`e3`). */
  controls: { id: string; role: string; name: string; state?: string }[];
}

export interface ActStepRecord {
  n: number;
  action: ActAction;
  /** What the step was resolved to on the page, for replay (a selector instead of an `eN` id). */
  replay?: ActAction;
  status: "kept" | "rolled-back" | "invalid" | "done";
  problems: string[];
}

export interface PlannerContext {
  goal: string;
  expectations: string[];
  observation: Observation;
  history: { action: string; status: string; problems: string[] }[];
  /** Why the last reply could not be used, when it could not. */
  replyError?: string;
}

export interface Planner {
  name: string;
  next(ctx: PlannerContext): Promise<string | ActAction | null>;
}

export interface ActOptions {
  source: string;
  goal: string;
  expectations: Postcondition[];
  planner: Planner;
  maxSteps?: number;
  viewport?: { width: number; height: number };
  /** Leave the integrity judges out of verify (postconditions only). */
  noGates?: boolean;
  /** Record the kept steps as a session trace (`vlmkit-trace/1`) for `vlmkit export playwright`. */
  trace?: boolean;
}

export interface ActReport {
  source: string;
  goal: string;
  planner: string;
  outcome: ActOutcome;
  steps: ActStepRecord[];
  postconditions: { expect: string; holds: boolean; saw: string }[];
  rolledBack: number;
  /** With `trace`: the kept steps and what each changed. */
  trace?: SessionTrace;
}

const OBSERVE = `(() => {
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== "hidden" && cs.display !== "none" && Number(cs.opacity) > 0.05;
  };
  const nameOf = (el) =>
    (el.getAttribute("aria-label") || (el.labels && el.labels[0] && el.labels[0].innerText) || el.innerText ||
      el.getAttribute("placeholder") || el.getAttribute("title") || el.getAttribute("value") || "").replace(/\\s+/g, " ").trim().slice(0, 60);
  document.querySelectorAll("[data-vlmkit-act]").forEach((el) => el.removeAttribute("data-vlmkit-act"));
  const controls = [];
  let n = 0;
  for (const el of document.querySelectorAll("a[href], button, input, select, textarea, summary, [role=button], [role=tab], [role=checkbox], [role=link], [role=menuitem], [role=option], [role=switch]")) {
    if (!vis(el) || el.closest("[inert], [aria-hidden=true]") || el.disabled) continue;
    const id = "e" + n++;
    el.setAttribute("data-vlmkit-act", id);
    const role = el.getAttribute("role") || (el.tagName === "INPUT" ? "input:" + (el.type || "text") : el.tagName.toLowerCase());
    const st = [];
    for (const a of ["aria-expanded", "aria-pressed", "aria-selected", "aria-checked", "aria-current"]) if (el.hasAttribute(a)) st.push(a.slice(5) + "=" + el.getAttribute(a));
    if ("checked" in el && (el.type === "checkbox" || el.type === "radio")) st.push("checked=" + el.checked);
    if ((el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT") && el.value) st.push("value=" + JSON.stringify(el.value.slice(0, 40)));
    controls.push({ id, role, name: nameOf(el), ...(st.length ? { state: st.join(" ") } : {}) });
    if (controls.length >= 80) break;
  }
  return { url: location.href, title: document.title, text: document.body.innerText.replace(/\\n{2,}/g, "\\n").slice(0, 2000), controls };
})()`;

/** A selector that finds this element again on a fresh load. */
function uniqueSelector(el: Element): string {
  const esc = (v: string) => CSS.escape(v);
  if (el.id && document.querySelectorAll(`#${esc(el.id)}`).length === 1) return `#${esc(el.id)}`;
  const parts: string[] = [];
  for (let e: Element | null = el; e && e !== document.documentElement; e = e.parentElement) {
    if (e.id && document.querySelectorAll(`#${esc(e.id)}`).length === 1) {
      parts.unshift(`#${esc(e.id)}`);
      break;
    }
    const tag = e.tagName.toLowerCase();
    const same = e.parentElement ? [...e.parentElement.children].filter((c) => c.tagName === e!.tagName) : [e];
    parts.unshift(same.length > 1 ? `${tag}:nth-of-type(${same.indexOf(e) + 1})` : tag);
  }
  return parts.join(" > ");
}

const READ_POSTCONDITION = `(p) => {
  const shown = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== "hidden" && Number(cs.opacity) > 0.05 && !el.closest("[hidden], [inert]");
  };
  const all = p.selector ? [...document.querySelectorAll(p.selector)] : [];
  if (p.kind === "url") return { url: location.href };
  if (p.kind === "visible" || p.kind === "hidden" || p.kind === "count") return { matched: all.length, onScreen: all.filter(shown).length };
  if (p.kind === "text") return { text: p.selector ? all.filter(shown).map((e) => e.innerText).join(" ") : document.body.innerText };
  if (p.kind === "value") return { value: all[0] && "value" in all[0] ? all[0].value : null };
  return {};
}`;

const settle = async (page: Page) => {
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  await page
    .evaluate(
      () =>
        new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(() => r(), 350)))),
    )
    .catch(() => {});
};

const resolveTarget = (t: string) => (/^e\d+$/.test(t) ? `[data-vlmkit-act="${t}"]` : t);

async function readPostconditions(page: Page, expectations: Postcondition[]) {
  const out: ActReport["postconditions"] = [];
  for (const p of expectations) {
    let reading: PostconditionReading;
    try {
      reading = (await page.evaluate(`(${READ_POSTCONDITION})(${JSON.stringify(p)})`)) as PostconditionReading;
    } catch (e) {
      out.push({
        expect: describePostcondition(p),
        holds: false,
        saw: `could not be read: ${(e as Error).message.split("\n")[0]}`,
      });
      continue;
    }
    out.push({ expect: describePostcondition(p), ...postconditionHolds(p, reading) });
  }
  return out;
}

async function gateFindings(page: Page, width: number): Promise<StepFinding[]> {
  const ic = await import("@mizchi/vlmkit-markup/inspect/integrity-check.ts");
  const { judgeIntegrityInstant } = await import("@mizchi/vlmkit-markup/inspect/integrity-timeline.ts");
  const found = await judgeIntegrityInstant(page, width, {
    text: ic.COLLECT_INTEGRITY_TEXT,
    clip: ic.COLLECT_CLIP_CANDIDATES,
    collapse: ic.COLLECT_COLLAPSE_CANDIDATES,
    protrusions: ic.COLLECT_PROTRUSIONS,
    contrast: ic.COLLECT_TEXT_CONTRAST,
    occlusions: ic.COLLECT_OCCLUSIONS,
  });
  return found
    .filter((f) => f.severity === "fail")
    .map((f) => ({ kind: f.kind, message: f.message, ...(f.selector ? { selector: f.selector } : {}) }));
}

/** Run one action; the returned action is what a replay does (a selector for an `eN` id). */
async function perform(
  page: Page,
  a: ActAction,
): Promise<{ replay: ActAction; toggle?: { selector: string; was: string | null; controls: string | null } }> {
  const timeout = 5000;
  if (a.action === "goto") {
    const url = new URL(a.url, page.url()).href;
    await page.goto(url, { waitUntil: "load", timeout: 30000 });
    return { replay: { ...a, url } };
  }
  if (a.action === "done") return { replay: a };
  if (a.action === "press" && !a.target) {
    await page.keyboard.press(a.key);
    return { replay: a };
  }
  const target = (a as { target: string }).target;
  const loc = page.locator(resolveTarget(target)).first();
  if ((await loc.count()) === 0) throw new Error(`no element matches ${target}`);
  const stable = await loc.evaluate(uniqueSelector);
  const replay = { ...a, target: stable } as ActAction;
  if (a.action === "click") {
    const toggle = (await loc.evaluate((el) => ({
      was: el.getAttribute("aria-expanded"),
      controls: el.getAttribute("aria-controls"),
    }))) as { was: string | null; controls: string | null };
    await loc.click({ timeout });
    return { replay, ...(toggle.was !== null ? { toggle: { selector: stable, ...toggle } } : {}) };
  }
  if (a.action === "fill") await loc.fill(a.value, { timeout });
  else if (a.action === "select") await loc.selectOption(a.value, { timeout });
  else if (a.action === "press") await loc.press(a.key, { timeout });
  return { replay };
}

/** A toggle whose `aria-expanded` says one thing and whose panel shows another. */
async function toggleProblems(page: Page, t: { selector: string; was: string | null; controls: string | null }) {
  const now = (await page.evaluate(
    ({ selector, controls }) => {
      const el = document.querySelector(selector);
      const panel = controls ? document.getElementById(controls.split(/\s+/)[0]!) : null;
      const shown = (e: Element | null) => {
        if (!e) return null;
        const r = e.getBoundingClientRect();
        const cs = getComputedStyle(e);
        return r.width >= 1 && r.height >= 1 && cs.visibility !== "hidden" && !e.closest("[hidden]");
      };
      return { expanded: el?.getAttribute("aria-expanded") ?? null, panelShown: shown(panel) };
    },
    { selector: t.selector, controls: t.controls },
  )) as { expanded: string | null; panelShown: boolean | null };
  const problems: string[] = [];
  if (now.expanded === t.was)
    problems.push(`clicking ${t.selector} left aria-expanded="${t.was}": the control did not change state`);
  if (now.panelShown !== null && (now.expanded === "true") !== now.panelShown)
    problems.push(
      `${t.selector} says aria-expanded="${now.expanded}" but its panel #${t.controls} is ${now.panelShown ? "shown" : "not shown"}`,
    );
  return problems;
}

/** What the recorder needs to describe an act step before it runs. */
function traceStep(page: Page, a: ActAction) {
  const target = "target" in a && a.target ? page.locator(resolveTarget(a.target)).first() : undefined;
  switch (a.action) {
    case "goto":
      return { type: "goto" as const, url: new URL(a.url, page.url()).href };
    case "press":
      return { type: "press" as const, key: a.key, ...(target ? { locator: target } : {}) };
    case "fill":
    case "select":
      return { type: a.action, value: a.value, ...(target ? { locator: target } : {}) };
    default:
      return { type: "click" as const, ...(target ? { locator: target } : {}) };
  }
}

export async function runAct(options: ActOptions, browser: Browser): Promise<ActReport> {
  const { openSource } = await import("@mizchi/vlmkit-core/page-open.ts");
  const viewport = options.viewport ?? { width: 1280, height: 800 };
  const maxSteps = options.maxSteps ?? 12;
  const open = async (kept: ActAction[]) => {
    const page = (await openSource(browser, options.source, { viewport })).page;
    for (const a of kept) {
      await perform(page, a);
      await settle(page);
    }
    return page;
  };
  const steps: ActStepRecord[] = [];
  const kept: ActAction[] = [];
  let page = await open([]);
  let saidDone = false;
  let gaveUp = false;
  let replyError: string | undefined;
  let rolledBack = 0;
  const recorder = options.trace
    ? new (await import("@mizchi/vlmkit-markup/record/trace-recorder.ts")).TraceRecorder(page, {
        recordedBy: "vlmkit act",
      })
    : null;
  await recorder?.start();
  let post = await readPostconditions(page, options.expectations);
  for (let n = 1; n <= maxSteps && !post.every((p) => p.holds); n++) {
    const observation = (await page.evaluate(OBSERVE)) as Observation;
    const ctx: PlannerContext = {
      goal: options.goal,
      expectations: options.expectations.map(describePostcondition),
      observation,
      history: steps.map((s) => ({ action: describeAction(s.action), status: s.status, problems: s.problems })),
      ...(replyError ? { replyError } : {}),
    };
    replyError = undefined;
    const reply = await options.planner.next(ctx);
    if (reply === null) {
      gaveUp = true;
      break;
    }
    let action: ActAction;
    try {
      action = typeof reply === "string" ? parseActAction(reply) : checkAction(reply as Record<string, unknown>);
    } catch (e) {
      replyError = (e as Error).message;
      steps.push({
        n,
        action: { action: "done", reason: "unusable reply" },
        status: "invalid",
        problems: [replyError],
      });
      continue;
    }
    if (action.action === "done") {
      saidDone = true;
      steps.push({ n, action, status: "done", problems: [] });
      break;
    }
    const before = options.noGates ? [] : await gateFindings(page, viewport.width);
    const problems: string[] = [];
    let replay: ActAction | undefined;
    try {
      let done!: Awaited<ReturnType<typeof perform>>;
      const run = async () => {
        done = await perform(page, action);
      };
      if (recorder) await recorder.step(run, traceStep(page, action));
      else await run();
      replay = done.replay;
      await settle(page);
      if (done.toggle) problems.push(...(await toggleProblems(page, done.toggle)));
      if (!options.noGates)
        for (const f of newFindings(before, await gateFindings(page, viewport.width)))
          problems.push(`check integrity: [${f.kind}] ${f.message}`);
    } catch (e) {
      problems.push(`the action failed: ${(e as Error).message.split("\n")[0]}`);
    }
    if (problems.length === 0 && replay) {
      kept.push(replay);
      steps.push({ n, action, replay, status: "kept", problems });
    } else {
      steps.push({ n, action, ...(replay ? { replay } : {}), status: "rolled-back", problems });
      rolledBack++;
      await page.close();
      page = await open(kept);
      if (recorder) {
        recorder.discardLast();
        await recorder.rebind(page);
      }
    }
    post = await readPostconditions(page, options.expectations);
  }
  const trace = recorder ? await recorder.stop() : undefined;
  await page.close();
  return {
    source: options.source,
    goal: options.goal,
    planner: options.planner.name,
    outcome: actVerdict({
      postconditionsHold: post.every((p) => p.holds),
      plannerSaidDone: saidDone,
      plannerGaveUp: gaveUp,
    }),
    steps,
    postconditions: post,
    rolledBack,
    ...(trace ? { trace } : {}),
  };
}

// ---- planners ----

export function scriptPlanner(actions: ActAction[]): Planner {
  let i = 0;
  return { name: "script", next: async () => actions[i++] ?? { action: "done", reason: "the plan is used up" } };
}

const PLANNER_PROMPT = (
  ctx: PlannerContext,
) => `You operate a web page to reach a goal. Reply with ONE JSON object and nothing else:
{"action": "click"|"fill"|"select"|"press"|"goto"|"done", "target": "<control id like e3, or a CSS selector>", "value": "<for fill/select>", "key": "<for press>", "url": "<for goto>", "reason": "<one short sentence>"}
Say "done" only when the goal is reached. Each step is checked: a step that breaks the page's layout, or a toggle that does not show what it says, is rolled back and you are told why.

Goal: ${ctx.goal}
It is reached when: ${ctx.expectations.join("; ")}
${ctx.replyError ? `\nYour last reply could not be used: ${ctx.replyError}\n` : ""}
Steps so far:
${ctx.history.length ? ctx.history.map((h, i) => `${i + 1}. ${h.action} — ${h.status}${h.problems.length ? `: ${h.problems.join("; ")}` : ""}`).join("\n") : "(none)"}

Page: ${ctx.observation.title} (${ctx.observation.url})
Controls on screen:
${ctx.observation.controls.map((c) => `${c.id} ${c.role} "${c.name}"${c.state ? ` [${c.state}]` : ""}`).join("\n")}

Text on screen:
${ctx.observation.text}`;

export async function llmPlanner(): Promise<Planner> {
  const { createUnifiedLLMClient } = await import("@mizchi/vlmkit-ai/llm-client.ts");
  let client: ReturnType<typeof createUnifiedLLMClient>;
  try {
    client = createUnifiedLLMClient({});
  } catch (e) {
    throw new UsageError(
      `--planner llm needs an LLM key: ${(e as Error).message} With no key, give the steps (--plan steps.json) or a program to plan them (--planner-cmd "<cmd>").`,
    );
  }
  return { name: "llm", next: async (ctx) => (await client!.complete(PLANNER_PROMPT(ctx))) || null };
}

/** Any program as the planner: the context as JSON on stdin, an action as JSON on stdout. */
export function commandPlanner(command: string): Planner {
  return {
    name: `cmd: ${command}`,
    next: (ctx) =>
      new Promise((resolveReply, reject) => {
        const child = spawn(command, { shell: true, stdio: ["pipe", "pipe", "inherit"] });
        let out = "";
        child.stdout.on("data", (d) => (out += d));
        child.on("error", reject);
        child.on("close", (code) => {
          if (code !== 0) reject(new Error(`--planner-cmd exited ${code}`));
          else resolveReply(out.trim() ? out : null);
        });
        child.stdin.end(JSON.stringify({ ...ctx, prompt: PLANNER_PROMPT(ctx) }));
      }),
  };
}

// ---- output ----

export function formatActReport(r: ActReport): string {
  const tag =
    r.outcome === "verified"
      ? `${GREEN}VERIFIED${RESET}`
      : r.outcome === "claimed"
        ? `${RED}CLAIMED, NOT VERIFIED${RESET}`
        : `${RED}${r.outcome.toUpperCase()}${RESET}`;
  const lines = [
    `${BOLD}${CYAN}vlmkit act${RESET}  ${DIM}${r.source} · planner ${r.planner}${RESET}`,
    `goal: ${r.goal}`,
    "",
  ];
  for (const s of r.steps) {
    const mark =
      s.status === "kept"
        ? `${GREEN}ok${RESET}  `
        : s.status === "done"
          ? `${DIM}done${RESET}`
          : `${YELLOW}${s.status === "invalid" ? "bad " : "undo"}${RESET}`;
    lines.push(
      `${String(s.n).padStart(2)}. ${mark} ${describeAction(s.action)}${s.action.reason ? `  ${DIM}— ${s.action.reason}${RESET}` : ""}`,
    );
    for (const p of s.problems) lines.push(`        ${YELLOW}!${RESET} ${p}`);
  }
  lines.push("", "postconditions:");
  for (const p of r.postconditions)
    lines.push(`  ${p.holds ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`} ${p.expect}  ${DIM}(${p.saw})${RESET}`);
  lines.push(
    "",
    `${tag}  ${r.steps.filter((s) => s.status === "kept").length} step(s) kept, ${r.rolledBack} rolled back`,
  );
  return lines.join("\n");
}

const USAGE = `vlmkit act <html-or-url> --goal "<what to do>" --expect <postcondition> [--expect …]

A browser agent whose steps are verified. Each step is planned, done, then checked: a step that
brings in a check integrity defect, fails to run, or clicks a toggle whose aria-expanded and panel
disagree is rolled back (the page is reloaded and the kept steps replayed) and the planner is told
why. The run is VERIFIED only when every --expect holds; a planner that says done before that is
CLAIMED, NOT VERIFIED. Exit 0 only when verified.

Postconditions (--expect, repeatable, all must hold):
  url:<regex>   visible:<css>   hidden:<css>   text:<text>   text:<css>=<text>
  count:<css>=N (or >=N, <=N)   value:<css>=<text>

Planner (one):
  --planner llm           the LLM client (VLMKIT_LLM_PROVIDER and its key); default
  --plan <steps.json>     a fixed list of actions ({"action":"click","target":"#add"} …); no key
  --planner-cmd "<cmd>"   any program: context JSON on stdin, one action JSON on stdout

Options:
  --max-steps <n>         default 12
  --runs <n>              repeat the run; prints the verified success rate
  --viewport WxH          default 1280x800
  --no-gates              postconditions only (no integrity judges in verify)
  --trace <file>          record the kept steps as a session trace (vlmkit export playwright <file>)
  --out <dir>             write act-report.json
  --json`;

export async function main(argv = process.argv.slice(2)): Promise<number> {
  if (argv.length === 0 || hasFlag(argv, "help") || argv.includes("-h")) {
    console.log(USAGE);
    return argv.length === 0 ? 2 : 0;
  }
  const valueFlags = new Set([
    "--goal",
    "--expect",
    "--plan",
    "--planner",
    "--planner-cmd",
    "--max-steps",
    "--runs",
    "--viewport",
    "--out",
    "--trace",
  ]);
  const positional = argv.filter((a, i) => !a.startsWith("--") && !(i > 0 && valueFlags.has(argv[i - 1]!)));
  if (positional.length !== 1) throw new UsageError(`act takes one page or URL, got ${positional.length}`);
  const goal = readFlag(argv, "goal");
  if (!goal) throw new UsageError(`--goal "<what to do>" is required`);
  const expectations = readAll(argv, "expect").map(parseExpectation);
  if (expectations.length === 0)
    throw new UsageError("at least one --expect is required: without a postcondition nothing can be verified");
  const planFile = readFlag(argv, "plan");
  const cmd = readFlag(argv, "planner-cmd");
  const plannerName = readFlag(argv, "planner") ?? (planFile ? "script" : cmd ? "cmd" : "llm");
  if ([planFile, cmd, readFlag(argv, "planner")].filter(Boolean).length > 1)
    throw new UsageError("give one of --planner, --plan, --planner-cmd");
  const vp = readFlag(argv, "viewport");
  const viewport = vp
    ? (() => {
        const m = vp.match(/^(\d+)x(\d+)$/);
        if (!m) throw new UsageError(`--viewport expects WxH, got ${vp}`);
        return { width: Number(m[1]), height: Number(m[2]) };
      })()
    : undefined;
  const maxSteps = readInt(argv, "max-steps", { min: 1 });
  const runs = readInt(argv, "runs", { min: 1 }) ?? 1;
  let plan: ActAction[] | undefined;
  if (planFile) {
    const parsed = JSON.parse(await readFile(planFile, "utf8")) as unknown;
    const list = Array.isArray(parsed) ? parsed : (parsed as { steps?: unknown }).steps;
    if (!Array.isArray(list))
      throw new UsageError(`--plan ${planFile}: expected an array of actions (or {"steps": […]})`);
    plan = list.map((a, i) => {
      try {
        return checkAction(a as Record<string, unknown>);
      } catch (e) {
        throw new UsageError(`--plan ${planFile} step ${i + 1}: ${(e as Error).message}`);
      }
    });
  }
  const makePlanner = async (): Promise<Planner> =>
    plannerName === "script"
      ? scriptPlanner(plan ?? [])
      : plannerName === "cmd"
        ? commandPlanner(cmd!)
        : plannerName === "llm"
          ? llmPlanner()
          : (() => {
              throw new UsageError(`--planner takes llm; got ${plannerName} (or use --plan / --planner-cmd)`);
            })();
  // Refused before the browser starts when the LLM has no key.
  await makePlanner();

  const { withBrowser } = await import("@mizchi/vlmkit-core/browser-launch.ts");
  const reports = await withBrowser(async (browser) => {
    const out: ActReport[] = [];
    for (let i = 0; i < runs; i++)
      out.push(
        await runAct(
          {
            source: positional[0]!,
            goal,
            expectations,
            planner: await makePlanner(),
            ...(maxSteps ? { maxSteps } : {}),
            ...(viewport ? { viewport } : {}),
            ...(hasFlag(argv, "no-gates") ? { noGates: true } : {}),
            ...(readFlag(argv, "trace") ? { trace: true } : {}),
          },
          browser,
        ),
      );
    return out;
  });
  const verified = reports.filter((r) => r.outcome === "verified").length;
  const summary = {
    runs: reports.length,
    verified,
    claimed: reports.filter((r) => r.outcome === "claimed").length,
    rate: verified / reports.length,
  };
  const tracePath = readFlag(argv, "trace");
  if (tracePath) {
    const { writeTrace } = await import("./record-cli.ts");
    // One trace per run; with --runs, the run's number before the extension.
    for (const [i, r] of reports.entries()) {
      if (!r.trace) continue;
      const path = reports.length > 1 ? tracePath.replace(/(\.json)?$/, `-${i + 1}$1`) : tracePath;
      await writeTrace(r.trace, resolve(path));
    }
  }
  const outDir = readFlag(argv, "out");
  if (outDir) {
    await mkdir(resolve(outDir), { recursive: true });
    await writeFile(join(resolve(outDir), "act-report.json"), JSON.stringify({ summary, reports }, null, 2));
  }
  if (hasFlag(argv, "json")) console.log(JSON.stringify({ summary, reports }, null, 2));
  else {
    for (const r of reports) console.log(formatActReport(r) + "\n");
    if (reports.length > 1)
      console.log(
        `verified ${verified}/${reports.length} (${Math.round(summary.rate * 100)}%); claimed done but not verified: ${summary.claimed}`,
      );
  }
  return verified === reports.length ? 0 : 1;
}

if (isCliEntry(import.meta.url, "act-cli")) {
  const { handleCliError } = await import("@mizchi/vlmkit-core/cli-error.ts");
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch(handleCliError);
}
