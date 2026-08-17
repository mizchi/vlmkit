/**
 * `vlmkit.gates.json` — one reviewed file that says which gates run on which
 * pages, and holds every suppression with a reason attached.
 *
 * Why this exists: the documented convention was npm scripts, one line per
 * page. Three separate reviewers landed on the same complaint — the scripts
 * stop scaling around twenty pages, and once a `--allow-invisible` or an
 * integrity exemption is inlined in a script, the only way to audit what has
 * been silenced repo-wide is `grep`. A suppression nobody can enumerate is a
 * suppression nobody revisits.
 *
 * Two decisions make the file worth reviewing rather than just worth having:
 *
 *   1. **A suppression must carry a reason.** Parsing fails without one. The
 *      flag alone records what was silenced but not why, which is exactly the
 *      state that makes a reviewer approve it again a year later.
 *   2. **An expired suppression is dropped, not applied.** It is reported
 *      loudly and the gate goes back to failing. An expiry date that keeps
 *      working after it passes is a comment, not a deadline.
 */

import { UsageError } from "./cli-error.ts";
import type { RuleSettingEntry, RuleSettings } from "./plugin/rules.ts";
import { parseAnnotatedRuleSettings } from "./plugin/rules.ts";

export interface GateSuppression {
  /**
   * Gate this applies to, as a prefix of the gate command: `check copy`
   * matches `check copy --manifest x.txt`.
   */
  gate: string;
  /** Flag(s) appended to that gate's invocation, e.g. `--allow-invisible visually-hidden`. */
  flag: string;
  /** Why this is acceptable. Required — an unexplained suppression is unauditable. */
  reason: string;
  /** Who signed off. Optional but reported, so an unowned entry is visible. */
  owner?: string;
  /** `YYYY-MM-DD`. Omitted means permanent, which the inventory counts separately. */
  expires?: string;
}

export interface GatePage {
  /** Short stable name for `--only` and reports. Defaults to the source. */
  id?: string;
  /** File path, glob, or URL handed to each gate. */
  source: string;
  /** Gate commands for this page. Falls back to `defaults.gates`. */
  gates?: string[];
  /** Extra gates for this page on top of the defaults. */
  extraGates?: string[];
  suppressions?: GateSuppression[];
  /**
   * Rule-granular settings for this page, merged over `defaults.rules`.
   *
   * The narrow instrument next to `suppressions`. A suppression appends a
   * flag the gate had to think to implement; a rule setting works on every
   * registry-driven gate uniformly and is validated against the gate's
   * declared rule table, so a typo is a config error rather than a line
   * that quietly does nothing.
   */
  rules?: RuleSettings;
  /**
   * The long-form entries from `rules`, keyed by rule reference. Kept beside the
   * flattened settings so a rule setting can carry a reason and an expiry, and go
   * through the same inventory as a suppression.
   */
  ruleAnnotations?: Readonly<Record<string, RuleSettingEntry>>;
}

/**
 * A dev server to start before the run and stop after it — Playwright's
 * `webServer`, which it has had for years and this config did not.
 *
 * v6's adopting agent got around it with a HAR, and said so: without that idea
 * you are hand-writing start / trap-kill / poll-for-ready in a shell wrapper,
 * per CI job. A config that declares which URLs to gate but cannot say how to
 * bring them up is only half committed.
 *
 * Named and shaped after Playwright's on purpose. A team that has written one
 * should not have to learn a second vocabulary to write this one.
 */
export interface GateWebServer {
  /** Shell command that starts the server. */
  command: string;
  /**
   * URL polled until it answers. Required — "started" has to mean "serving",
   * not "spawned", or the first gate races the bundler.
   */
  url: string;
  /** Milliseconds to wait for `url` before giving up. Default 60000. */
  timeout?: number;
  /**
   * Reuse a server already listening on `url` instead of starting one.
   *
   * Defaults to true locally and FALSE in CI (`process.env.CI`), matching
   * Playwright: locally you want your own `npm run dev`; in CI a listening port
   * usually means a leaked process from an earlier job, and reusing it silently
   * gates the wrong build.
   */
  reuseExistingServer?: boolean;
  /** Working directory for `command`. Relative to the config file. Default: the config's directory. */
  cwd?: string;
  /** Extra environment for the server process, on top of the current one. */
  env?: Readonly<Record<string, string>>;
}

export interface GateConfig {
  webServer?: GateWebServer;
  defaults?: {
    gates?: string[];
    suppressions?: GateSuppression[];
    rules?: RuleSettings;
    ruleAnnotations?: Readonly<Record<string, RuleSettingEntry>>;
  };
  pages: GatePage[];
}

export interface ResolvedSuppression extends GateSuppression {
  /** Page id this came from, or `defaults`. */
  scope: string;
  status: "active" | "expired" | "permanent";
  /** Days until expiry; negative when overdue, null when permanent. */
  daysLeft: number | null;
  /**
   * Which config block this came from.
   *
   * A long-form `rules` entry flows through the SAME resolved shape, the same
   * expiry rule, and the same inventory as a `suppressions` entry — otherwise
   * `rules` would need a second parallel set of all three, and the two would
   * eventually disagree about what expiry means. The discriminator keeps them
   * distinguishable to a reader; for a rule entry, `gate` is the gate the rule
   * belongs to and `flag` is the `--rule` flag the plan appends.
   */
  kind: "suppression" | "rule";
  /** Rule reference, for `kind: "rule"` only. */
  ref?: string;
}

export interface GateJob {
  pageId: string;
  source: string;
  /** Gate command with active suppression flags and rule settings appended. */
  gate: string;
  /** The gate as written in the config, before suppression flags. */
  baseGate: string;
  appliedSuppressions: ResolvedSuppression[];
  /** Rule settings in effect, defaults merged with the page's. */
  rules: RuleSettings;
}

export interface GatePlan {
  jobs: GateJob[];
  /** Every suppression the config declares, resolved against `now`. */
  suppressions: ResolvedSuppression[];
  /**
   * Suppressions past their expiry. Their flags are NOT applied — the gate
   * fails again — and callers are expected to print these before running.
   */
  expired: ResolvedSuppression[];
}

const DAY_MS = 86400000;

export const GATE_CONFIG_FILENAMES = ["vlmkit.gates.json", ".vlmkit/gates.json"];

function fail(path: string, message: string): never {
  // UsageError so `handleCliError` prints one line: the message already names
  // the JSON path and the fix, and a stack trace only buries it.
  throw new UsageError(`${path}: ${message}`);
}

function parseSuppression(raw: unknown, path: string): GateSuppression {
  if (typeof raw !== "object" || raw === null) fail(path, "must be an object");
  const s = raw as Record<string, unknown>;
  for (const key of ["gate", "flag", "reason"] as const) {
    if (typeof s[key] !== "string" || !(s[key] as string).trim()) {
      fail(path, `${key} is required and must be a non-empty string`);
    }
  }
  if (s.owner !== undefined && typeof s.owner !== "string") fail(path, "owner must be a string");
  if (s.expires !== undefined) {
    if (typeof s.expires !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s.expires)) {
      fail(path, `expires must be YYYY-MM-DD, got ${JSON.stringify(s.expires)}`);
    }
    if (Number.isNaN(Date.parse(`${s.expires}T00:00:00Z`))) {
      fail(path, `expires is not a real date: ${s.expires}`);
    }
  }
  return {
    gate: (s.gate as string).trim(),
    flag: (s.flag as string).trim(),
    reason: (s.reason as string).trim(),
    ...(s.owner ? { owner: s.owner as string } : {}),
    ...(s.expires ? { expires: s.expires as string } : {}),
  };
}

function parseGateList(raw: unknown, path: string): string[] {
  if (!Array.isArray(raw)) fail(path, "must be an array of gate command strings");
  // An empty list is almost certainly a half-finished edit, and it is the worst
  // possible outcome: `defaults: {gates: []}` used to validate and then run
  // nothing for every page that relied on the defaults.
  if (raw.length === 0) fail(path, "is empty — remove the key or list at least one gate");
  return raw.map((g, i) => {
    if (typeof g !== "string" || !g.trim()) fail(`${path}[${i}]`, "must be a non-empty string");
    return (g as string).trim();
  });
}

/** Parse and validate. Every error names the JSON path so the fix is obvious. */
export function parseGateConfig(raw: string): GateConfig {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    throw new UsageError(`gate config is not valid JSON: ${e instanceof Error ? e.message : e}`);
  }
  if (typeof data !== "object" || data === null) fail("config", "must be a JSON object");
  const root = data as Record<string, unknown>;
  const defaults: GateConfig["defaults"] = {};
  if (root.defaults !== undefined) {
    if (typeof root.defaults !== "object" || root.defaults === null) fail("defaults", "must be an object");
    const d = root.defaults as Record<string, unknown>;
    if (d.gates !== undefined) defaults.gates = parseGateList(d.gates, "defaults.gates");
    if (d.suppressions !== undefined) {
      if (!Array.isArray(d.suppressions)) fail("defaults.suppressions", "must be an array");
      defaults.suppressions = d.suppressions.map((s, i) => parseSuppression(s, `defaults.suppressions[${i}]`));
    }
    if (d.rules !== undefined) {
      const parsed = parseAnnotatedRuleSettings(d.rules, "defaults.rules");
      defaults.rules = parsed.settings;
      if (Object.keys(parsed.annotations).length > 0) defaults.ruleAnnotations = parsed.annotations;
    }
  }
  if (!Array.isArray(root.pages)) fail("pages", "must be an array");
  if (root.pages.length === 0) fail("pages", "is empty — nothing would run");
  const seen = new Set<string>();
  const pages = root.pages.map((raw, i) => {
    const at = `pages[${i}]`;
    if (typeof raw !== "object" || raw === null) fail(at, "must be an object");
    const p = raw as Record<string, unknown>;
    if (typeof p.source !== "string" || !p.source.trim()) fail(at, "source is required (path, glob, or URL)");
    const id = typeof p.id === "string" && p.id.trim() ? p.id.trim() : p.source.trim();
    if (seen.has(id)) fail(at, `duplicate page id "${id}" — ids must be unique so --only is unambiguous`);
    seen.add(id);
    const page: GatePage = { id, source: p.source.trim() };
    if (p.gates !== undefined) page.gates = parseGateList(p.gates, `${at}.gates`);
    if (p.extraGates !== undefined) page.extraGates = parseGateList(p.extraGates, `${at}.extraGates`);
    if (p.suppressions !== undefined) {
      if (!Array.isArray(p.suppressions)) fail(`${at}.suppressions`, "must be an array");
      page.suppressions = p.suppressions.map((s, j) => parseSuppression(s, `${at}.suppressions[${j}]`));
    }
    if (p.rules !== undefined) {
      const parsed = parseAnnotatedRuleSettings(p.rules, `${at}.rules`);
      page.rules = parsed.settings;
      if (Object.keys(parsed.annotations).length > 0) page.ruleAnnotations = parsed.annotations;
    }
    if (!page.gates && !page.extraGates && !defaults.gates) {
      fail(at, `no gates: set ${at}.gates or defaults.gates`);
    }
    return page;
  });
  return {
    ...(root.webServer !== undefined ? { webServer: parseWebServer(root.webServer) } : {}),
    ...(Object.keys(defaults).length > 0 ? { defaults } : {}),
    pages,
  };
}

function parseWebServer(raw: unknown): GateWebServer {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) fail("webServer", "must be an object");
  const w = raw as Record<string, unknown>;
  if (typeof w.command !== "string" || !w.command.trim()) fail("webServer", "command is required");
  // Required, unlike Playwright's (which accepts `port` as an alternative).
  // "Started" has to mean "serving": without a readiness probe the first gate
  // races the bundler, and a flake there is indistinguishable from a real finding.
  if (typeof w.url !== "string" || !/^https?:\/\//.test(w.url)) {
    fail("webServer", `url is required and must be http(s), got ${JSON.stringify(w.url)}`);
  }
  const server: GateWebServer = { command: w.command.trim(), url: w.url.trim() };
  if (w.timeout !== undefined) {
    if (typeof w.timeout !== "number" || !Number.isFinite(w.timeout) || w.timeout <= 0) {
      fail("webServer", `timeout must be a positive number of ms, got ${JSON.stringify(w.timeout)}`);
    }
    server.timeout = w.timeout;
  }
  if (w.reuseExistingServer !== undefined) {
    if (typeof w.reuseExistingServer !== "boolean") fail("webServer", "reuseExistingServer must be a boolean");
    server.reuseExistingServer = w.reuseExistingServer;
  }
  if (w.cwd !== undefined) {
    if (typeof w.cwd !== "string" || !w.cwd.trim()) fail("webServer", "cwd must be a non-empty string");
    server.cwd = w.cwd.trim();
  }
  if (w.env !== undefined) {
    if (typeof w.env !== "object" || w.env === null || Array.isArray(w.env)) fail("webServer.env", "must be an object");
    const env: Record<string, string> = {};
    for (const [key, value] of Object.entries(w.env as Record<string, unknown>)) {
      if (typeof value !== "string") fail(`webServer.env["${key}"]`, `must be a string, got ${JSON.stringify(value)}`);
      env[key] = value;
    }
    server.env = env;
  }
  return server;
}

/**
 * Whether to reuse a server already listening. Playwright's default, and for
 * Playwright's reason: locally the listening port is your own `npm run dev`; in
 * CI it is usually a leaked process from an earlier job, and reusing it gates a
 * build nobody asked about.
 */
export function shouldReuseExistingServer(server: GateWebServer, env = process.env): boolean {
  return server.reuseExistingServer ?? !env.CI;
}

/** UTC midnight, so "expires today" behaves the same in every timezone. */
function utcDay(date: Date): number {
  return Math.floor(date.getTime() / DAY_MS);
}

export function resolveSuppression(s: GateSuppression, scope: string, now: Date): ResolvedSuppression {
  const base = { ...s, scope, kind: "suppression" as const };
  if (!s.expires) return { ...base, status: "permanent", daysLeft: null };
  const daysLeft = utcDay(new Date(`${s.expires}T00:00:00Z`)) - utcDay(now);
  // Expiry day itself is still valid; the day after is not.
  return { ...base, status: daysLeft < 0 ? "expired" : "active", daysLeft };
}

/**
 * Resolve one long-form `rules` entry onto the same shape as a suppression, so
 * the inventory, the expiry notice and `--require-expiry` cover both.
 *
 * `gate` is the gate portion of the reference (`check.integrity/text-collision`
 * -> `check.integrity`), which is what a reader scanning the inventory wants to
 * see; a bare rule id has no gate to name and reports as `*`.
 */
export function resolveRuleSetting(
  ref: string,
  entry: RuleSettingEntry,
  scope: string,
  now: Date,
): ResolvedSuppression {
  const slash = ref.indexOf("/");
  const base = {
    gate: slash > 0 ? ref.slice(0, slash) : ref.includes(".") ? ref : "*",
    flag: `--rule ${ref}=${entry.setting}`,
    reason: entry.reason,
    ...(entry.owner ? { owner: entry.owner } : {}),
    ...(entry.expires ? { expires: entry.expires } : {}),
    scope,
    kind: "rule" as const,
    ref,
  };
  if (!entry.expires) return { ...base, status: "permanent", daysLeft: null };
  const daysLeft = utcDay(new Date(`${entry.expires}T00:00:00Z`)) - utcDay(now);
  return { ...base, status: daysLeft < 0 ? "expired" : "active", daysLeft };
}

export interface ResolveOptions {
  now?: Date;
  /**
   * Which of the resolved rule settings belong on THIS gate's command line.
   *
   * Every setting used to be appended to every gate, so a `check copy` invocation
   * carried `--rule check.a11y.touch/target-undersized=off` and a single typo'd key
   * printed the same config error once per gate. v7's agent-l and agent-m reported
   * it independently.
   *
   * A callback rather than logic here, because deciding it needs the gate registry
   * (which rules a gate declares) and this module deliberately does not depend on
   * it. Omitted keeps the old behaviour, which is what a library caller with no
   * registry should get: over-passing is harmless to the gate, since a `--rule`
   * naming another gate is accepted and ignored by design.
   */
  rulesForGate?: (baseGate: string, rules: RuleSettings) => RuleSettings;
  /** Page ids or sources to keep. Substring match, so `admin` selects a subtree. */
  only?: string[];
}

/**
 * Turn the config into the exact list of gate invocations to run.
 *
 * Suppression flags are appended to matching gates only when active. An
 * expired one is surfaced in `plan.expired` and deliberately left off the
 * command line: the gate returns to failing, which is what an expiry date is
 * supposed to mean.
 */
export function resolveGatePlan(config: GateConfig, options: ResolveOptions = {}): GatePlan {
  const now = options.now ?? new Date();
  const only = options.only?.filter((s) => s.trim()) ?? [];
  const defaultGates = config.defaults?.gates ?? [];
  const defaultSuppressions = (config.defaults?.suppressions ?? [])
    .map((s) => resolveSuppression(s, "defaults", now));
  // Resolved once, like `defaultSuppressions` — resolving inside the page loop
  // would list every default entry once per page in the inventory.
  const defaultRuleSettings = Object.entries(config.defaults?.ruleAnnotations ?? {})
    .map(([ref, entry]) => resolveRuleSetting(ref, entry, "defaults", now));

  const jobs: GateJob[] = [];
  const suppressions: ResolvedSuppression[] = [...defaultSuppressions, ...defaultRuleSettings];

  for (const page of config.pages) {
    const pageId = page.id ?? page.source;
    const pageSuppressions = (page.suppressions ?? []).map((s) => resolveSuppression(s, pageId, now));
    suppressions.push(...pageSuppressions);
    const pageRuleSettings = Object.entries(page.ruleAnnotations ?? {})
      .map(([ref, entry]) => resolveRuleSetting(ref, entry, pageId, now));
    suppressions.push(...pageRuleSettings);
    if (only.length > 0 && !only.some((o) => pageId.includes(o) || page.source.includes(o))) continue;
    const gates = [...(page.gates ?? defaultGates), ...(page.extraGates ?? [])];
    if (gates.length === 0) {
      throw new UsageError(
        `Page "${pageId}" resolved to zero gates — set its \`gates\` or \`defaults.gates\`.`
        + ` A page that silently runs nothing is worse than a config error.`,
      );
    }
    const candidates = [...defaultSuppressions, ...pageSuppressions];
    // Page settings win over defaults, key by key — the same precedence a
    // page's `gates` has over `defaults.gates`.
    const merged: Record<string, RuleSettings[string]> = { ...config.defaults?.rules, ...page.rules };
    // An expired rule setting is DROPPED, exactly as an expired suppression is:
    // the rule bites again and the expiry is reported. An expiry date that keeps
    // working after it passes is a comment, not a deadline — and before this,
    // `rules` had no way to express either one.
    //
    // A page entry shadows the default for the same ref, so an expired default
    // renewed on this page stays in effect, and a page entry that has itself
    // expired drops even when the default is still live.
    const shadowed = new Set(Object.keys(page.ruleAnnotations ?? {}));
    for (const resolved of defaultRuleSettings) {
      if (resolved.status === "expired" && !shadowed.has(resolved.ref!)) delete merged[resolved.ref!];
    }
    for (const resolved of pageRuleSettings) {
      if (resolved.status === "expired") delete merged[resolved.ref!];
    }
    const rules: RuleSettings = merged;
    for (const baseGate of gates) {
      const applied = candidates.filter((s) => s.status !== "expired" && gateMatches(baseGate, s.gate));
      jobs.push({
        pageId,
        source: page.source,
        baseGate,
        // Rule settings travel as `--rule` flags so the spawned gate needs no
        // config access of its own: whatever the plan says is exactly what
        // the child receives, and `gates list` shows the real command line.
        gate: [
          baseGate,
          ...applied.map((s) => s.flag),
          ...ruleFlags(options.rulesForGate ? options.rulesForGate(baseGate, rules) : rules),
        ].join(" "),
        appliedSuppressions: applied,
        rules,
      });
    }
  }
  return { jobs, suppressions, expired: suppressions.filter((s) => s.status === "expired") };
}

/** `{ "check.integrity/text-collision": "off" }` → `["--rule", "check.integrity/text-collision=off"]`. */
export function ruleFlags(rules: RuleSettings): string[] {
  return Object.entries(rules).flatMap(([ref, setting]) => ["--rule", `${ref}=${setting}`]);
}

/**
 * Token-wise prefix match: `check copy` matches `check copy --manifest x.txt`
 * but not `check copyright`, and `check` matches every check gate.
 */
export function gateMatches(gate: string, pattern: string): boolean {
  const g = gate.split(/\s+/).filter(Boolean);
  const p = pattern.split(/\s+/).filter(Boolean);
  if (p.length > g.length) return false;
  return p.every((token, i) => token === g[i]);
}

export interface SuppressionSummary {
  rows: ResolvedSuppression[];
  active: number;
  expired: number;
  permanent: number;
  /** Active entries with no owner — visible rather than tolerated silently. */
  unowned: number;
  /** Active entries expiring within `soonDays`. */
  expiringSoon: number;
}

export function summarizeSuppressions(
  suppressions: ResolvedSuppression[],
  soonDays = 30,
): SuppressionSummary {
  const rows = [...suppressions].sort((a, b) => {
    const rank = (s: ResolvedSuppression) => (s.status === "expired" ? 0 : s.status === "active" ? 1 : 2);
    return rank(a) - rank(b) || (a.daysLeft ?? Infinity) - (b.daysLeft ?? Infinity);
  });
  return {
    rows,
    active: rows.filter((s) => s.status === "active").length,
    expired: rows.filter((s) => s.status === "expired").length,
    permanent: rows.filter((s) => s.status === "permanent").length,
    unowned: rows.filter((s) => s.status !== "expired" && !s.owner).length,
    expiringSoon: rows.filter((s) => s.status === "active" && (s.daysLeft ?? Infinity) <= soonDays).length,
  };
}
