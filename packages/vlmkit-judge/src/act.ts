/**
 * The pure half of `vlmkit act` (issue #220): the postconditions a goal declares, the actions a
 * planner may take, and the verdict of a run. A browser agent that says "done" is not the
 * measure; a run is `verified` only when every declared postcondition holds on the page.
 *
 * Pure: strings and observations in, decisions out. The browser half is
 * `src/cli/commands/act-cli.ts`.
 */
import { UsageError } from "./errors.ts";

/** What must be true of the page when the goal is reached. */
export type Postcondition =
  | { kind: "url"; pattern: string }
  | { kind: "visible"; selector: string }
  | { kind: "hidden"; selector: string }
  | { kind: "text"; text: string; selector?: string }
  | { kind: "count"; selector: string; op: "=" | ">=" | "<="; n: number }
  | { kind: "value"; selector: string; value: string };

/**
 * `--expect` syntax, one postcondition per flag:
 *
 *   url:/thanks/            the page's URL matches the regex
 *   visible:#toast          an element matching the selector is on screen
 *   hidden:.modal           no element matching it is on screen
 *   text:Order placed       the page shows the text (`text:#cart-count=2` — inside a selector)
 *   count:.cart li=3        how many match (`>=3`, `<=3` too)
 *   value:#qty=2            a field's value
 */
export function parseExpectation(raw: string): Postcondition {
  const colon = raw.indexOf(":");
  const kind = colon < 0 ? "" : raw.slice(0, colon).trim();
  const rest = colon < 0 ? "" : raw.slice(colon + 1).trim();
  const fail = (why: string) =>
    new UsageError(
      `--expect ${JSON.stringify(raw)}: ${why}. Forms: url:<regex>, visible:<css>, hidden:<css>, text:<text>, text:<css>=<text>, count:<css>=N (>=N, <=N), value:<css>=<text>`,
    );
  if (!rest) throw fail("nothing after the kind");
  switch (kind) {
    case "url":
      try {
        new RegExp(rest);
      } catch {
        throw fail("not a regular expression");
      }
      return { kind, pattern: rest };
    case "visible":
    case "hidden":
      return { kind, selector: rest };
    case "text": {
      const eq = rest.indexOf("=");
      // A selector is written starting with #, . or [ (`text:#cart-count=2`), so `text:Total=¥3,300`
      // stays text.
      if (eq > 0 && /^[#.[]/.test(rest))
        return { kind, selector: rest.slice(0, eq).trim(), text: rest.slice(eq + 1).trim() };
      return { kind, text: rest };
    }
    case "count": {
      const m = rest.match(/^(.+?)(>=|<=|=)(\d+)$/);
      if (!m) throw fail("count needs <css>=N, >=N or <=N");
      return { kind, selector: m[1]!.trim(), op: m[2] as "=" | ">=" | "<=", n: Number(m[3]) };
    }
    case "value": {
      const eq = rest.indexOf("=");
      if (eq <= 0) throw fail("value needs <css>=<text>");
      return { kind, selector: rest.slice(0, eq).trim(), value: rest.slice(eq + 1) };
    }
    default:
      throw fail(`unknown kind ${JSON.stringify(kind)}`);
  }
}

export const describePostcondition = (p: Postcondition): string => {
  switch (p.kind) {
    case "url":
      return `url matches /${p.pattern}/`;
    case "visible":
      return `${p.selector} is on screen`;
    case "hidden":
      return `${p.selector} is not on screen`;
    case "text":
      return p.selector ? `${p.selector} shows "${p.text}"` : `the page shows "${p.text}"`;
    case "count":
      return `${p.selector} count ${p.op} ${p.n}`;
    case "value":
      return `${p.selector} has value "${p.value}"`;
  }
};

/** What the browser half read for one postcondition. */
export interface PostconditionReading {
  url?: string;
  /** Elements matching the selector, and how many of them are on screen. */
  matched?: number;
  onScreen?: number;
  /** The text of the selector's elements (or the whole page's) as shown. */
  text?: string;
  value?: string | null;
}

export function postconditionHolds(p: Postcondition, r: PostconditionReading): { holds: boolean; saw: string } {
  const norm = (s: string) => s.replace(/\s+/g, " ").trim();
  switch (p.kind) {
    case "url":
      return { holds: new RegExp(p.pattern).test(r.url ?? ""), saw: `url ${r.url ?? "?"}` };
    case "visible":
      return { holds: (r.onScreen ?? 0) > 0, saw: `${r.onScreen ?? 0} of ${r.matched ?? 0} on screen` };
    case "hidden":
      return { holds: (r.onScreen ?? 0) === 0, saw: `${r.onScreen ?? 0} of ${r.matched ?? 0} on screen` };
    case "text": {
      const shown = norm(r.text ?? "");
      const holds = shown.includes(norm(p.text));
      return { holds, saw: p.selector ? `"${shown.slice(0, 80)}"` : holds ? "shown" : "not shown" };
    }
    case "count": {
      const n = r.matched ?? 0;
      const holds = p.op === "=" ? n === p.n : p.op === ">=" ? n >= p.n : n <= p.n;
      return { holds, saw: `${n}` };
    }
    case "value":
      return {
        holds: (r.value ?? null) === p.value,
        saw: r.value === null || r.value === undefined ? "no field" : `"${r.value}"`,
      };
  }
}

/** One step a planner may take. `target` is a CSS selector or an id from the observation. */
export type ActAction =
  | { action: "click"; target: string; reason?: string }
  | { action: "fill"; target: string; value: string; reason?: string }
  | { action: "select"; target: string; value: string; reason?: string }
  | { action: "press"; key: string; target?: string; reason?: string }
  | { action: "goto"; url: string; reason?: string }
  | { action: "done"; reason?: string };

export const ACT_ACTIONS = ["click", "fill", "select", "press", "goto", "done"] as const;

/**
 * Read an action from a planner's reply: the first JSON object in it, checked against the
 * schema. Anything else is an error naming what was wrong, so the planner can be told.
 */
export function parseActAction(reply: string): ActAction {
  const start = reply.indexOf("{");
  const end = reply.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("no JSON object in the reply");
  let o: Record<string, unknown>;
  try {
    o = JSON.parse(reply.slice(start, end + 1)) as Record<string, unknown>;
  } catch (e) {
    throw new Error(`the reply's JSON does not parse (${(e as Error).message})`);
  }
  return checkAction(o);
}

export function checkAction(o: Record<string, unknown>): ActAction {
  const str = (k: string) => (typeof o[k] === "string" && (o[k] as string).length > 0 ? (o[k] as string) : undefined);
  const reason = str("reason");
  const extra = reason ? { reason } : {};
  switch (o.action) {
    case "click":
      if (!str("target")) throw new Error("click needs a target");
      return { action: "click", target: str("target")!, ...extra };
    case "fill":
    case "select":
      if (!str("target")) throw new Error(`${o.action} needs a target`);
      if (typeof o.value !== "string") throw new Error(`${o.action} needs a string value`);
      return { action: o.action, target: str("target")!, value: o.value, ...extra };
    case "press":
      if (!str("key")) throw new Error("press needs a key");
      return { action: "press", key: str("key")!, ...(str("target") ? { target: str("target")! } : {}), ...extra };
    case "goto":
      if (!str("url")) throw new Error("goto needs a url");
      return { action: "goto", url: str("url")!, ...extra };
    case "done":
      return { action: "done", ...extra };
    default:
      throw new Error(`action must be one of ${ACT_ACTIONS.join(", ")}; got ${JSON.stringify(o.action)}`);
  }
}

export const describeAction = (a: ActAction): string => {
  switch (a.action) {
    case "click":
      return `click ${a.target}`;
    case "fill":
      return `fill ${a.target} with ${JSON.stringify(a.value)}`;
    case "select":
      return `select ${JSON.stringify(a.value)} in ${a.target}`;
    case "press":
      return `press ${a.key}${a.target ? ` in ${a.target}` : ""}`;
    case "goto":
      return `go to ${a.url}`;
    case "done":
      return "done";
  }
};

/**
 * How a run ended. Only `verified` is a success: the postconditions held. `claimed` is the
 * failure browser agents report as success — the planner said done and the page says otherwise.
 */
export type ActOutcome = "verified" | "claimed" | "gave-up" | "out-of-steps";

export function actVerdict(r: {
  postconditionsHold: boolean;
  plannerSaidDone: boolean;
  plannerGaveUp: boolean;
}): ActOutcome {
  if (r.postconditionsHold) return "verified";
  if (r.plannerSaidDone) return "claimed";
  if (r.plannerGaveUp) return "gave-up";
  return "out-of-steps";
}

/** A gate finding a step brought in, keyed so the page's own findings are not blamed on it. */
export interface StepFinding {
  kind: string;
  selector?: string;
  message: string;
}

/**
 * The findings a step introduced: those not present before it. Matched by kind and selector,
 * and by the message with counts and quoted text taken out (a grouped finding's selector moves
 * when its group changes size).
 */
export function newFindings(before: readonly StepFinding[], after: readonly StepFinding[]): StepFinding[] {
  const gist = (f: StepFinding) =>
    `${f.kind}|${f.message
      .replace(/\belements\b/g, "element")
      .replace(/\d+(\.\d+)?/g, "#")
      .replace(/"[^"]*"/g, '""')
      .replace(/:nth-[\w-]+\(\d+\)/g, "")}`;
  const seen = new Set([...before.map((f) => `${f.kind}|${f.selector ?? ""}`), ...before.map(gist)]);
  return after.filter((f) => !seen.has(`${f.kind}|${f.selector ?? ""}`) && !seen.has(gist(f)));
}
