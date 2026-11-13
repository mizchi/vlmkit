/**
 * A recorded browser session (`vlmkit-trace/1`) and its compilation to an `@playwright/test` spec.
 *
 * Every session that drives a page writes the same trace: a person clicking through a headed
 * browser (`vlmkit record`) and an agent (`vlmkit act --trace`). Each step is an action on a
 * target and the expectations the recorder **observed** the step to cause: the URL it moved to,
 * the ARIA state it changed, text that appeared or changed, an element shown or gone, where focus
 * went. A target is a list of Playwright locators, each verified on the page to match exactly one
 * element when it was recorded, best first (test id, role and name, label, placeholder, text, a
 * CSS path last).
 *
 * The compiler is deterministic: the same trace gives the same spec, byte for byte, and needs no
 * model. Pure: data in, data out.
 */
import { UsageError } from "./errors.ts";

export const TRACE_FORMAT = "vlmkit-trace/1";

export type LocatorCandidate =
  | { by: "testid"; value: string }
  | { by: "role"; role: string; name: string }
  | { by: "label"; value: string }
  | { by: "placeholder"; value: string }
  | { by: "text"; value: string }
  | { by: "css"; value: string };

export interface TraceTarget {
  /** Best first; each matched exactly one element when recorded. */
  locators: LocatorCandidate[];
  /** For the comment above the step: `button "Add to cart"`. */
  describe: string;
}

export type TraceAction =
  | { action: "goto"; url: string }
  | { action: "click"; target: TraceTarget }
  | { action: "fill"; target: TraceTarget; value: string }
  | { action: "select"; target: TraceTarget; value: string }
  | { action: "check" | "uncheck"; target: TraceTarget }
  | { action: "press"; key: string; target?: TraceTarget };

/** The ARIA states a step can be held to. */
export const TRACE_STATES = ["aria-expanded", "aria-pressed", "aria-selected", "aria-checked", "aria-current"] as const;
export type TraceState = (typeof TRACE_STATES)[number];

export type TraceExpectation =
  | { kind: "url"; path: string }
  | { kind: "state"; target: TraceTarget; attr: TraceState; value: string }
  | { kind: "checked"; target: TraceTarget; value: boolean }
  | { kind: "value"; target: TraceTarget; value: string }
  | { kind: "text"; target: TraceTarget; value: string }
  | { kind: "visible"; target: TraceTarget }
  | { kind: "hidden"; target: TraceTarget }
  | { kind: "focused"; target: TraceTarget };

export interface TraceStep {
  action: TraceAction;
  expect: TraceExpectation[];
}

export interface SessionTrace {
  format: typeof TRACE_FORMAT;
  /** Who drove the page, and where. */
  source: { recordedBy: string; url: string };
  start: {
    url: string;
    viewport: { width: number; height: number };
    colorScheme?: "light" | "dark";
    reducedMotion?: "reduce" | "no-preference";
  };
  steps: TraceStep[];
}

// ---- observations: what the recorder reads before and after a step ----

/** One element as the recorder saw it. `key` follows the element across reads. */
export interface ObservedElement {
  key: string;
  /** A CSS path, for matching an element a re-render replaced. */
  css: string;
  role?: string;
  name?: string;
  text?: string;
  visible: boolean;
  /** A dialog, alert, status, menu, listbox, tab panel, live region or a panel a control controls. */
  watched: boolean;
  interactive: boolean;
  /** The key of the nearest dialog, panel or other watched element around it. */
  within?: string;
  states: Partial<Record<TraceState, string>>;
  checked?: boolean;
  value?: string;
}

export interface PageObservation {
  url: string;
  elements: ObservedElement[];
  /** The focused element's key. */
  focused?: string;
}

export type ObservedChange =
  | { kind: "url"; path: string }
  | { kind: "state"; element: ObservedElement; attr: TraceState; value: string }
  | { kind: "checked"; element: ObservedElement; value: boolean }
  | { kind: "value"; element: ObservedElement; value: string }
  | { kind: "text"; element: ObservedElement; value: string }
  | { kind: "visible" | "hidden" | "focused"; element: ObservedElement };

/** At most this many expectations per step, in the order below. */
export const MAX_EXPECTATIONS_PER_STEP = 6;
const PRIORITY: ObservedChange["kind"][] = ["url", "state", "checked", "visible", "hidden", "text", "value", "focused"];
/** Text longer than this is a block of copy, not a value a step changed. */
export const MAX_TEXT = 80;

/** The path, query and hash of a URL: what a test can hold to on any host. */
export function urlPath(url: string): string {
  try {
    const u = new URL(url);
    return u.protocol === "file:" ? u.pathname.split("/").pop()! + u.search + u.hash : u.pathname + u.search + u.hash;
  } catch {
    return url;
  }
}

/**
 * What a step changed, from the page before it and after it. `again` is a second read after a
 * short wait: a value that differs between the two (a clock, a counter that keeps ticking) is not
 * something the step did and is left out. `target` is the step's own element: its typed value is
 * the action itself, not an outcome, and focus landing on it says nothing.
 */
export function diffObservations(
  before: PageObservation,
  after: PageObservation,
  again: PageObservation = after,
  target?: string,
): ObservedChange[] {
  const out: ObservedChange[] = [];
  if (urlPath(before.url) !== urlPath(after.url) && urlPath(after.url) === urlPath(again.url))
    out.push({ kind: "url", path: urlPath(after.url) });

  const byKey = (o: PageObservation) => new Map(o.elements.map((e) => [e.key, e]));
  const was = byKey(before);
  const stable = byKey(again);
  // A re-render replaces elements: one gone and one new with the same path and text are one.
  const gone = new Map(
    before.elements
      .filter((e) => !after.elements.some((a) => a.key === e.key))
      .map((e) => [`${e.css}|${e.text ?? ""}`, e]),
  );
  for (const now of after.elements) {
    const check = stable.get(now.key);
    if (!check) continue; // not there on the second read: transient
    let prev = was.get(now.key);
    if (!prev) {
      const twin = gone.get(`${now.css}|${now.text ?? ""}`);
      if (twin) {
        gone.delete(`${now.css}|${now.text ?? ""}`);
        prev = twin;
      }
    }
    if (!prev) {
      if (now.visible && check.visible && (now.watched || (now.text && now.text.length <= MAX_TEXT)))
        out.push({ kind: "visible", element: now });
      continue;
    }
    if (prev.visible !== now.visible && now.visible === check.visible) {
      if (now.watched || now.interactive || (now.text && now.text.length <= MAX_TEXT))
        out.push({ kind: now.visible ? "visible" : "hidden", element: now });
      continue;
    }
    if (!now.visible) continue;
    for (const attr of TRACE_STATES) {
      const v = now.states[attr];
      if (v !== undefined && v !== prev.states[attr] && v === check.states[attr])
        out.push({ kind: "state", element: now, attr, value: v });
    }
    if (now.checked !== undefined && now.checked !== prev.checked && now.checked === check.checked)
      out.push({ kind: "checked", element: now, value: now.checked });
    if (now.key !== target && now.value !== undefined && now.value !== prev.value && now.value === check.value)
      out.push({ kind: "value", element: now, value: now.value });
    if (now.text !== undefined && now.text !== prev.text && now.text === check.text && now.text.length <= MAX_TEXT)
      out.push({ kind: "text", element: now, value: now.text });
  }
  for (const prev of gone.values()) {
    const back = again.elements.find((e) => e.key === prev.key);
    if (back) continue;
    if (prev.visible && (prev.watched || prev.interactive || (prev.text && prev.text.length <= MAX_TEXT)))
      out.push({ kind: "hidden", element: prev });
  }
  const moved = after.focused && after.focused === again.focused && after.focused !== before.focused;
  if (moved && after.focused !== target) {
    const el = after.elements.find((e) => e.key === after.focused);
    if (el) out.push({ kind: "focused", element: el });
  }
  return prune(out, before, after).sort(
    (a, b) => PRIORITY.indexOf(a.kind) - PRIORITY.indexOf(b.kind) || rank(a) - rank(b),
  );
}

// Within a kind, a dialog or panel before the text inside it.
const rank = (c: ObservedChange) => ("element" in c && c.element.watched ? 0 : 1);
/** The document a key was given in (`<doc>-<n>`). */
const docOf = (key: string) => key.split("-")[0];

/**
 * One outcome, said once. When a dialog opens, the dialog being shown is the outcome, not each of
 * its lines; when a count inside a sentence changes, the count is, not the sentence too. And after
 * a navigation the old page's elements are not "hidden": that page is gone.
 */
function prune(changes: ObservedChange[], before: PageObservation, after: PageObservation): ObservedChange[] {
  const navigated =
    before.elements.length > 0 &&
    after.elements.length > 0 &&
    docOf(before.elements[0]!.key) !== docOf(after.elements[0]!.key);
  const shownOrGone = new Map<string, string>();
  for (const c of changes)
    if ((c.kind === "visible" || c.kind === "hidden") && c.element.watched) shownOrGone.set(c.element.key, c.kind);
  const texts = changes.filter((c): c is Extract<ObservedChange, { kind: "text" }> => c.kind === "text");
  return changes.filter((c) => {
    if (c.kind === "url") return true;
    if (navigated && c.kind === "hidden") return false;
    if (
      (c.kind === "visible" || c.kind === "hidden") &&
      c.element.within &&
      shownOrGone.get(c.element.within) === c.kind
    )
      return false;
    if (c.kind === "text" && texts.some((t) => t !== c && t.element.css.startsWith(`${c.element.css} > `)))
      return false;
    return true;
  });
}

// ---- the trace file ----

export function parseSessionTrace(text: string, path: string): SessionTrace {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new UsageError(`${path}: not JSON (${(e as Error).message})`);
  }
  const t = parsed as Partial<SessionTrace> | null;
  if (!t || t.format !== TRACE_FORMAT)
    throw new UsageError(
      `${path} is not a session trace (format ${JSON.stringify(t?.format ?? null)}; expected "${TRACE_FORMAT}")`,
    );
  if (!t.start?.url || !t.start.viewport || !Array.isArray(t.steps))
    throw new UsageError(`${path}: a trace needs start.url, start.viewport and steps[]`);
  for (const [i, s] of t.steps.entries()) {
    const a = s?.action as { action?: string; target?: TraceTarget } | undefined;
    if (!a?.action) throw new UsageError(`${path} step ${i + 1}: no action`);
    if (a.action !== "goto" && a.action !== "press" && !a.target?.locators?.length)
      throw new UsageError(`${path} step ${i + 1}: ${a.action} has no target locator`);
    if (!Array.isArray(s.expect)) throw new UsageError(`${path} step ${i + 1}: expect must be an array`);
  }
  return t as SessionTrace;
}

// ---- compiling to @playwright/test ----

const q = (s: string) => JSON.stringify(s);
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

/** The Playwright expression for a target: its best locator. */
export function locatorSource(target: TraceTarget): string {
  const best = target.locators[0];
  if (!best) throw new Error(`no locator for ${target.describe}`);
  switch (best.by) {
    case "testid":
      return `page.getByTestId(${q(best.value)})`;
    case "role":
      return best.name
        ? `page.getByRole(${q(best.role)}, { name: ${q(best.name)}, exact: true })`
        : `page.getByRole(${q(best.role)})`;
    case "label":
      return `page.getByLabel(${q(best.value)}, { exact: true })`;
    case "placeholder":
      return `page.getByPlaceholder(${q(best.value)}, { exact: true })`;
    case "text":
      return `page.getByText(${q(best.value)}, { exact: true })`;
    case "css":
      return `page.locator(${q(best.value)})`;
  }
}

function actionSource(a: TraceAction, opts: CompileOptions): string {
  switch (a.action) {
    case "goto":
      return `await page.goto(${q(gotoUrl(a.url, opts))});`;
    case "click":
      return `await ${locatorSource(a.target)}.click();`;
    case "fill":
      return `await ${locatorSource(a.target)}.fill(${q(a.value)});`;
    case "select":
      return `await ${locatorSource(a.target)}.selectOption(${q(a.value)});`;
    case "check":
      return `await ${locatorSource(a.target)}.check();`;
    case "uncheck":
      return `await ${locatorSource(a.target)}.uncheck();`;
    case "press":
      return a.target
        ? `await ${locatorSource(a.target)}.press(${q(a.key)});`
        : `await page.keyboard.press(${q(a.key)});`;
  }
}

function expectSource(e: TraceExpectation): string {
  switch (e.kind) {
    case "url":
      return `await expect(page).toHaveURL(/${escapeRegExp(e.path)}$/);`;
    case "state":
      return `await expect(${locatorSource(e.target)}).toHaveAttribute(${q(e.attr)}, ${q(e.value)});`;
    case "checked":
      return e.value
        ? `await expect(${locatorSource(e.target)}).toBeChecked();`
        : `await expect(${locatorSource(e.target)}).not.toBeChecked();`;
    case "value":
      return `await expect(${locatorSource(e.target)}).toHaveValue(${q(e.value)});`;
    case "text":
      return `await expect(${locatorSource(e.target)}).toHaveText(${q(e.value)});`;
    case "visible":
      return `await expect(${locatorSource(e.target)}).toBeVisible();`;
    case "hidden":
      return `await expect(${locatorSource(e.target)}).toBeHidden();`;
    case "focused":
      return `await expect(${locatorSource(e.target)}).toBeFocused();`;
  }
}

export const describeAction = (a: TraceAction): string => {
  switch (a.action) {
    case "goto":
      return `go to ${a.url}`;
    case "click":
      return `click ${a.target.describe}`;
    case "fill":
      return `fill ${a.target.describe} with ${q(a.value)}`;
    case "select":
      return `select ${q(a.value)} in ${a.target.describe}`;
    case "check":
    case "uncheck":
      return `${a.action} ${a.target.describe}`;
    case "press":
      return `press ${a.key}${a.target ? ` in ${a.target.describe}` : ""}`;
  }
};

export interface CompileOptions {
  /** The test's title. */
  title?: string;
  /**
   * An origin the recording was made on (`http://localhost:3000`): URLs under it are written as
   * paths, for the project's own `use.baseURL`.
   */
  baseUrl?: string;
  /** Where the trace came from, for the header comment. */
  tracePath?: string;
}

function gotoUrl(url: string, opts: CompileOptions): string {
  if (!opts.baseUrl) return url;
  const base = opts.baseUrl.replace(/\/$/, "");
  return url.startsWith(`${base}/`) || url === base ? url.slice(base.length) || "/" : url;
}

/** The trace as an `@playwright/test` spec. */
export function compileTrace(trace: SessionTrace, opts: CompileOptions = {}): string {
  const title = opts.title ?? `recorded session on ${urlPath(trace.start.url) || trace.start.url}`;
  const use = [
    `viewport: { width: ${trace.start.viewport.width}, height: ${trace.start.viewport.height} }`,
    ...(trace.start.colorScheme ? [`colorScheme: ${q(trace.start.colorScheme)}`] : []),
    ...(trace.start.reducedMotion ? [`reducedMotion: ${q(trace.start.reducedMotion)}`] : []),
  ];
  const lines = [
    `// Generated by \`vlmkit export playwright\`${opts.tracePath ? ` from ${opts.tracePath}` : ""} (${TRACE_FORMAT}).`,
    `// Recorded by ${trace.source.recordedBy} on ${trace.source.url}. Each expect is what the step was`,
    `// observed to change; edit freely, and re-record when the flow changes.`,
    `import { expect, test } from "@playwright/test";`,
    "",
    `test.use({ ${use.join(", ")} });`,
    "",
    `test(${q(title)}, async ({ page }) => {`,
    `  await page.goto(${q(gotoUrl(trace.start.url, opts))});`,
  ];
  for (const [i, step] of trace.steps.entries()) {
    lines.push("", `  // ${i + 1}. ${describeAction(step.action)}`, `  ${actionSource(step.action, opts)}`);
    for (const e of step.expect) lines.push(`  ${expectSource(e)}`);
  }
  lines.push("});", "");
  return lines.join("\n");
}
