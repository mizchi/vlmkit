#!/usr/bin/env node
/**
 * Verified scripted browser flow (key-free half of the "verified
 * agent"; docs/design/mcp-and-agent-expansion.md Part B).
 *
 * A flow is a list of steps: each step performs a browser action and
 * then asserts a deterministic post-condition on the live DOM. The run
 * FAILS the first time a post-condition is unmet — the difference from
 * every LLM-per-step browser agent is that "it did something" is not
 * success; "the asserted state actually holds" is. No LLM: the flow is
 * given (a planner may emit it later, but the verification engine is
 * fully deterministic).
 *
 * Assertion vocabulary (post-condition language):
 *   - attr    : an attribute of `selector` equals a value (aria-expanded=true)
 *   - visible : `selector` is displayed with non-zero box
 *   - hidden  : `selector` is absent or not displayed
 *   - focused : `selector` holds (or contains) document.activeElement
 *   - text    : `selector`'s textContent contains a substring
 *   - count   : number of `selector` matches equals a value
 *
 * CLI:
 *   vlmkit verify flow <html-or-url> --flow <flow.json> [--json]
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { Page } from "playwright";
import { handleCliError } from "@mizchi/vlmkit-core/cli-error.ts";
import { withAuthState } from "@mizchi/vlmkit-core/auth-state.ts";
import { describeRedirect } from "@mizchi/vlmkit-core/navigation-redirect.ts";
import { appendRunLedger } from "@mizchi/vlmkit-core/run-ledger.ts";
import { BOLD, CYAN, DIM, GREEN, RED, RESET } from "@mizchi/vlmkit-core/terminal-colors.ts";

export type FlowAction =
  /**
   * `force` skips Playwright's actionability wait. Needed to assert that a
   * genuinely disabled control DOES NOTHING when clicked: Playwright refuses
   * to click `aria-disabled="true"` elements, so without force the honest
   * implementation times out — and the S19 run showed an agent "fixing"
   * that by making aria-disabled transient (set for 50ms, then removed),
   * which passes the assert while lying to assistive tech. Force lets the
   * flow author click through the disabled state instead.
   */
  | { action: "click"; selector: string; force?: boolean }
  | { action: "press"; selector?: string; key: string }
  | { action: "fill"; selector: string; value: string }
  | { action: "type"; selector: string; text: string }
  | { action: "focus"; selector: string }
  | { action: "hover"; selector: string }
  | { action: "wait"; ms: number };

export type FlowAssert =
  | { assert: "attr"; selector: string; name: string; equals: string | null }
  | { assert: "visible"; selector: string }
  | { assert: "hidden"; selector: string }
  | { assert: "focused"; selector: string }
  | { assert: "text"; selector: string; contains: string }
  | { assert: "count"; selector: string; equals: number };

export interface FlowStep {
  /** Optional human label for the step. */
  label?: string;
  do: FlowAction;
  /** Post-conditions checked after the action; all must hold. */
  expect?: FlowAssert[];
}

export interface Flow {
  viewport?: { width: number; height: number };
  steps: FlowStep[];
}

export interface StepResult {
  index: number;
  label: string;
  action: string;
  actionError?: string;
  assertions: { assert: FlowAssert; passed: boolean; actual: string }[];
  passed: boolean;
}

export interface FlowVerifyReport {
  source: string;
  steps: StepResult[];
  passed: number;
  total: number;
  done: boolean;
  /**
   * Set when the URL redirected — almost always a login wall. A flow driven
   * against a sign-in page fails on "element not found" for every step, which
   * reads as a broken flow rather than a missing session.
   */
  redirected?: string;
}

function describeAction(a: FlowAction): string {
  switch (a.action) {
    case "click": return `click ${a.selector}${a.force ? " (force)" : ""}`;
    case "press": return `press ${a.key}${a.selector ? ` on ${a.selector}` : ""}`;
    case "fill": return `fill ${a.selector}`;
    case "type": return `type into ${a.selector}`;
    case "focus": return `focus ${a.selector}`;
    case "hover": return `hover ${a.selector}`;
    case "wait": return `wait ${a.ms}ms`;
  }
}

async function runAction(page: Page, a: FlowAction): Promise<void> {
  switch (a.action) {
    case "click": await page.click(a.selector, { timeout: 5000, ...(a.force ? { force: true } : {}) }); return;
    case "press":
      if (a.selector) await page.press(a.selector, a.key, { timeout: 5000 });
      else await page.keyboard.press(a.key);
      return;
    case "fill": await page.fill(a.selector, a.value, { timeout: 5000 }); return;
    case "type": await page.type(a.selector, a.text, { timeout: 5000 }); return;
    case "focus": await page.focus(a.selector, { timeout: 5000 }); return;
    case "hover": await page.hover(a.selector, { timeout: 5000 }); return;
    case "wait": await page.waitForTimeout(a.ms); return;
  }
}

/** Evaluate one assertion in-page; returns [passed, actual]. */
function evalAssertion(spec: FlowAssert): (s: FlowAssert) => [boolean, string] {
  // Returned as a real function so page.evaluate(fn, spec) passes the
  // argument (a string body would be treated as an expression and never
  // receive spec). `spec` is threaded for closure-free serialization.
  void spec;
  return (s: FlowAssert): [boolean, string] => {
    const q = (sel: string) => document.querySelector(sel);
    const visible = (el: Element | null): boolean => {
      if (!el) return false;
      const st = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return st.display !== "none" && st.visibility !== "hidden" && r.width > 0 && r.height > 0;
    };
    switch (s.assert) {
      case "attr": {
        const el = q(s.selector);
        const actual = el ? el.getAttribute(s.name) : "(no element)";
        return [el != null && actual === s.equals, String(actual)];
      }
      case "visible": { const el = q(s.selector); return [visible(el), visible(el) ? "visible" : "hidden/absent"]; }
      case "hidden": { const el = q(s.selector); return [!visible(el), visible(el) ? "visible" : "hidden/absent"]; }
      case "focused": {
        const el = q(s.selector); const active = document.activeElement;
        const ok = !!el && (el === active || el.contains(active));
        return [ok, active ? (active.id ? "#" + active.id : active.tagName.toLowerCase()) : "(none)"];
      }
      case "text": {
        const el = q(s.selector); const t = el ? (el.textContent || "").replace(/\s+/g, " ").trim() : "";
        return [t.includes(s.contains), t.slice(0, 80)];
      }
      case "count": {
        const n = document.querySelectorAll(s.selector).length;
        return [n === s.equals, String(n)];
      }
      default: return [false, "unknown assert"];
    }
  };
}

export interface FlowVerifyOptions {
  /**
   * Playwright storage-state file so gates can measure pages behind a
   * login. Falls back to VLMKIT_STORAGE_STATE. See auth-state.ts.
   */
  storageState?: string;
  source: string;
  flow: Flow;
}

export async function runFlowVerify(options: FlowVerifyOptions): Promise<FlowVerifyReport> {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  const steps: StepResult[] = [];
  let redirected: string | undefined;
  try {
    const page = await browser.newPage(withAuthState({ viewport: options.flow.viewport ?? { width: 1280, height: 800 } }, options.storageState));
    const url = /^(https?|file):\/\//.test(options.source) ? options.source : pathToFileURL(resolve(options.source)).href;
    await page.goto(url, { waitUntil: "load", timeout: 30000 });
    redirected = /^https?:\/\//.test(options.source)
      ? describeRedirect(options.source, page.url()) ?? undefined
      : undefined;

    for (let i = 0; i < options.flow.steps.length; i++) {
      const step = options.flow.steps[i]!;
      const res: StepResult = {
        index: i,
        label: step.label ?? describeAction(step.do),
        action: describeAction(step.do),
        assertions: [],
        passed: true,
      };
      try {
        await runAction(page, step.do);
      } catch (e) {
        res.actionError = String(e).split("\n")[0]!.slice(0, 120);
        res.passed = false;
      }
      if (!res.actionError) {
        for (const spec of step.expect ?? []) {
          const [passed, actual] = await page.evaluate(evalAssertion(spec), spec) as [boolean, string];
          res.assertions.push({ assert: spec, passed, actual });
          if (!passed) res.passed = false;
        }
      }
      steps.push(res);
      if (!res.passed) break; // stop at the first unmet post-condition
    }
  } finally {
    await browser.close();
  }
  const passed = steps.filter((s) => s.passed).length;
  // Not `done` on a redirect: the flow ran against a page the caller did not
  // ask for, so passing steps would be a claim about the sign-in screen.
  const done = steps.length === options.flow.steps.length && steps.every((s) => s.passed) && !redirected;
  appendRunLedger({
    tool: "verify-flow",
    source: options.source,
    headline: { done, passed, total: options.flow.steps.length, ...(redirected ? { redirected: true } : {}) },
  });
  return {
    source: options.source,
    steps,
    passed,
    total: options.flow.steps.length,
    done,
    ...(redirected ? { redirected } : {}),
  };
}

export function formatFlowReport(report: FlowVerifyReport): string {
  const lines: string[] = [];
  lines.push(`${BOLD}${CYAN}vlmkit verify flow${RESET}`);
  lines.push(`${DIM}source: ${report.source}${RESET}`);
  if (report.redirected) {
    lines.push(`${RED}x ${report.redirected}${RESET}`);
    lines.push(`${DIM}  Every step below ran against that page.${RESET}`);
  }
  lines.push("");
  lines.push(`verdict: ${report.done ? `${GREEN}DONE${RESET}` : `${RED}FAILED${RESET}`} (${report.passed}/${report.total} steps)`);
  lines.push("");
  for (const s of report.steps) {
    const mark = s.passed ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
    lines.push(`${mark} step ${s.index + 1}: ${s.label}`);
    if (s.actionError) lines.push(`    ${RED}action failed:${RESET} ${s.actionError}`);
    for (const a of s.assertions) {
      const m = a.passed ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
      const spec = a.assert;
      const want = spec.assert === "attr"
        ? `${spec.name}=${spec.equals}`
        : spec.assert === "text"
        ? `text~"${spec.contains}"`
        : spec.assert === "count"
        ? `count=${spec.equals}`
        : spec.assert;
      lines.push(`    ${m} ${"selector" in spec ? spec.selector : ""} ${want} ${a.passed ? "" : `${RED}(got: ${a.actual})${RESET}`}`);
    }
  }
  return lines.join("\n");
}

function printUsage(exitCode: number): never {
  console.log(`Usage: vlmkit verify flow <html-or-url> --flow <flow.json> [--json]

Verified scripted browser flow: each step performs an action and
asserts a deterministic post-condition on the live DOM. FAILS at the
first unmet post-condition — "it did something" is not success. No LLM.

flow.json: { "viewport"?, "steps": [ { "label"?, "do": <action>, "expect": [<assert>...] } ] }
  action:  {action:"click", selector, force?} | {action:"focus"|"hover", selector}
           | {action:"press", key, selector?}
           | {action:"fill"|"type", selector, value|text} | {action:"wait", ms}
           (force skips actionability — use it to click a disabled control
            and assert that nothing changes)
  assert:  {assert:"attr", selector, name, equals} | {assert:"visible"|"hidden"|"focused", selector}
           | {assert:"text", selector, contains} | {assert:"count", selector, equals}

Options:
  --flow <file>   Flow JSON (required)
  --json          Print JSON report`);
  process.exit(exitCode);
}

async function main(argv = process.argv.slice(2)): Promise<void> {
  if (argv.includes("--help") || argv.includes("-h")) printUsage(0);
  let flowPath: string | undefined;
  let json = false;
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--flow") flowPath = argv[++i]!;
    else if (arg === "--json") json = true;
    else if (!arg.startsWith("-")) positional.push(arg);
  }
  const source = positional[0];
  if (!source || !flowPath) printUsage(1);
  const flow = JSON.parse(await readFile(flowPath, "utf8")) as Flow;
  const report = await runFlowVerify({ source, flow });
  if (json) console.log(JSON.stringify(report, null, 2));
  else console.log(formatFlowReport(report));
  if (!report.done) process.exit(1);
}

const isCliEntry = process.env.__VRT_DISPATCHER_LEAF__ === "flow-verify" ||
  (process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false);
if (isCliEntry) {
  main().catch(handleCliError);
}
