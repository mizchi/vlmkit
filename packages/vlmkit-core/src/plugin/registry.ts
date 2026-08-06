/**
 * The gate registry — one composed catalog the CLI, the MCP server, the
 * batch runner and `vlmkit.gates.json` all read from.
 *
 * Composition is the extension point: `createGateRegistry([builtins,
 * ...userPlugins])` treats a third-party plugin exactly like the bundled
 * ones. There is no privileged built-in path, which is the only way to know
 * the plugin contract is actually sufficient — the built-ins are its first
 * consumer.
 *
 * The registry is also what makes a gate string checkable. `vlmkit.gates.json`
 * lists gates as prose (`"check copy --manifest copy.txt"`); before there was
 * a catalog to compare against, `check copyy` parsed fine and failed later as
 * a child process exiting non-zero, which reads like a page defect rather
 * than a config typo.
 */

import type { AnyGateDefinition, GateCategory, VlmkitPlugin } from "./contract.ts";
import { GATE_CATEGORY_ORDER, gateCommandString } from "./contract.ts";
import type { RuleSettings } from "./rules.ts";
import { validateGateDefinition } from "./rules.ts";

export interface RegisteredGate {
  gate: AnyGateDefinition;
  /** Plugin that supplied it — named in conflict errors and `--plugins` listings. */
  plugin: string;
}

export interface GateResolution {
  gate: AnyGateDefinition;
  /** Argv remaining after the matched command tokens. */
  rest: string[];
}

export interface GateRegistry {
  readonly plugins: readonly VlmkitPlugin[];
  /** Every gate, in registration order. */
  list(): readonly RegisteredGate[];
  byId(id: string): AnyGateDefinition | undefined;
  /** Exact command lookup: `"check integrity"` or `["check", "integrity"]`. */
  byCommand(command: string | readonly string[]): AnyGateDefinition | undefined;
  /**
   * Longest-prefix match against argv, so `["check","copy","--manifest","x"]`
   * resolves to `check copy` with the flags left in `rest`.
   */
  resolve(argv: readonly string[]): GateResolution | undefined;
  /** Command tokens grouped by first token, for help output. */
  groups(): ReadonlyMap<string, readonly RegisteredGate[]>;
  /**
   * Gates grouped by what KIND of question they answer, in adoption order,
   * with uncategorized gates last under `other`.
   *
   * Separate from `groups()`, which groups by CLI verb. A reader choosing what
   * to run wants the former; a reader typing a command wants the latter.
   */
  categories(): ReadonlyMap<GateCategory | "other", readonly RegisteredGate[]>;
  /** Near-miss command strings for a "did you mean" line. */
  suggest(command: string | readonly string[], limit?: number): string[];
}

class Registry implements GateRegistry {
  readonly plugins: readonly VlmkitPlugin[];
  private readonly gates: RegisteredGate[] = [];
  private readonly byIdMap = new Map<string, AnyGateDefinition>();
  private readonly byCommandMap = new Map<string, AnyGateDefinition>();
  /** Longest command first, so `resolve` prefers `check a11y contrast` over `check a11y`. */
  private readonly ordered: { tokens: readonly string[]; gate: AnyGateDefinition }[] = [];

  constructor(plugins: readonly VlmkitPlugin[]) {
    this.plugins = plugins;
    const problems: string[] = [];
    for (const plugin of plugins) {
      if (!plugin.name.trim()) problems.push("a plugin has no name");
      for (const gate of plugin.gates) {
        problems.push(...validateGateDefinition(gate).map((p) => `${plugin.name}: ${p}`));
        const command = gateCommandString(gate);
        const clashId = this.gates.find((g) => g.gate.id === gate.id);
        if (clashId) {
          problems.push(
            `gate id "${gate.id}" is registered by both ${clashId.plugin} and ${plugin.name}`
            + ` — ids address rule settings and ledger entries, so they must be unique`,
          );
          continue;
        }
        const clashCommand = this.gates.find((g) => gateCommandString(g.gate) === command);
        if (clashCommand) {
          problems.push(
            `command "${command}" is registered by both ${clashCommand.plugin} and ${plugin.name}`,
          );
          continue;
        }
        this.gates.push({ gate, plugin: plugin.name });
        this.byIdMap.set(gate.id, gate);
        this.byCommandMap.set(command, gate);
        this.ordered.push({ tokens: gate.command, gate });
      }
    }
    if (problems.length > 0) {
      throw new Error(`Invalid gate plugin(s):\n${problems.map((p) => `  - ${p}`).join("\n")}`);
    }
    this.ordered.sort((a, b) => b.tokens.length - a.tokens.length);
  }

  list(): readonly RegisteredGate[] {
    return this.gates;
  }

  byId(id: string): AnyGateDefinition | undefined {
    return this.byIdMap.get(id);
  }

  byCommand(command: string | readonly string[]): AnyGateDefinition | undefined {
    const key = typeof command === "string" ? command.trim().split(/\s+/).filter(Boolean).join(" ") : command.join(" ");
    return this.byCommandMap.get(key);
  }

  resolve(argv: readonly string[]): GateResolution | undefined {
    for (const { tokens, gate } of this.ordered) {
      if (tokens.length > argv.length) continue;
      if (tokens.every((token, i) => token === argv[i])) {
        return { gate, rest: argv.slice(tokens.length) };
      }
    }
    return undefined;
  }

  groups(): ReadonlyMap<string, readonly RegisteredGate[]> {
    const out = new Map<string, RegisteredGate[]>();
    for (const entry of this.gates) {
      const group = entry.gate.command[0]!;
      const bucket = out.get(group);
      if (bucket) bucket.push(entry);
      else out.set(group, [entry]);
    }
    return out;
  }

  categories(): ReadonlyMap<GateCategory | "other", readonly RegisteredGate[]> {
    const out = new Map<GateCategory | "other", RegisteredGate[]>();
    // Seeded in declaration order so the map iterates in adoption order rather
    // than in whichever order gates happened to register.
    for (const category of GATE_CATEGORY_ORDER) {
      const members = this.gates.filter((entry) => entry.gate.category === category);
      if (members.length > 0) out.set(category, members);
    }
    const uncategorized = this.gates.filter((entry) => entry.gate.category === undefined);
    if (uncategorized.length > 0) out.set("other", uncategorized);
    return out;
  }

  suggest(command: string | readonly string[], limit = 3): string[] {
    const query = (typeof command === "string" ? command.trim().split(/\s+/) : [...command])
      .filter((t) => Boolean(t) && !t.startsWith("-"))
      .join(" ");
    if (!query) return [];
    return [...this.byCommandMap.keys()]
      .map((candidate) => ({ candidate, distance: editDistance(query, candidate) }))
      // Two edits, not a proportional budget. A budget scaled to command
      // length made `check design` — a real gate that simply has not migrated
      // to the registry yet — "did you mean check motion?", so `vlmkit gates`
      // warned about a working config. A did-you-mean that fires on unrelated
      // commands is worse than one that stays quiet.
      .filter(({ distance }) => distance <= 2)
      .sort((a, b) => a.distance - b.distance || a.candidate.localeCompare(b.candidate))
      .slice(0, limit)
      .map(({ candidate }) => candidate);
  }
}

export function createGateRegistry(plugins: readonly VlmkitPlugin[]): GateRegistry {
  return new Registry(plugins);
}

/** Levenshtein, iterative single-row — only ever run on a failed lookup. */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) {
      next[j] = Math.min(
        row[j]! + 1,
        next[j - 1]! + 1,
        row[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    row = next;
  }
  return row[b.length]!;
}

export interface GateCommandProblem {
  command: string;
  message: string;
}

/**
 * Validate the gate strings a config declares. Returns one problem per bad
 * entry rather than throwing on the first, so a reviewer fixes the whole
 * config in one pass.
 */
export function validateGateCommands(
  registry: GateRegistry,
  commands: readonly string[],
): GateCommandProblem[] {
  const problems: GateCommandProblem[] = [];
  for (const command of commands) {
    const tokens = command.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) {
      problems.push({ command, message: "empty gate command" });
      continue;
    }
    if (registry.resolve(tokens)) continue;
    const suggestions = registry.suggest(tokens);
    problems.push({
      command,
      message: `unknown gate "${command}"`
        + (suggestions.length > 0 ? ` — did you mean ${suggestions.map((s) => `"${s}"`).join(", ")}?` : ""),
    });
  }
  return problems;
}

/**
 * Validate rule references. A bare `<ruleId>` key is only resolvable inside
 * a gate-scoped block, so this checks the qualified forms and reports a bare
 * key as needing a scope rather than guessing which gate it meant.
 */
export function validateRuleSettings(
  registry: GateRegistry,
  settings: RuleSettings,
  scope?: AnyGateDefinition,
): string[] {
  const problems: string[] = [];
  for (const key of Object.keys(settings)) {
    if (!key.includes("/")) {
      if (scope) {
        if (!scope.rules.some((r) => r.id === key)) {
          problems.push(
            `"${key}" is not a rule of ${scope.id}`
            + ` (known: ${scope.rules.map((r) => r.id).join(", ")})`,
          );
        }
        continue;
      }
      if (registry.byId(key)) continue; // whole-gate setting
      problems.push(`"${key}" is neither a gate id nor a rule reference (<gateId>/<ruleId>)`);
      continue;
    }
    const [gateId, ruleId] = [key.slice(0, key.indexOf("/")), key.slice(key.indexOf("/") + 1)];
    const gate = registry.byId(gateId);
    if (!gate) {
      problems.push(`"${key}": unknown gate id "${gateId}"`);
      continue;
    }
    if (ruleId === "*") continue;
    if (!gate.rules.some((r) => r.id === ruleId)) {
      problems.push(
        `"${key}": ${gateId} has no rule "${ruleId}"`
        + ` (known: ${gate.rules.map((r) => r.id).join(", ")})`,
      );
    }
  }
  return problems;
}
