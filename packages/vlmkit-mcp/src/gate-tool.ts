/**
 * Turning a gate definition into an MCP tool.
 *
 * Before this, each MCP tool re-stated four things the gate already declares:
 * its name, its input schema, how to invoke it, and how to decide whether the
 * result is a failure. That is the same duplication the CLI had — a tool could
 * accept a flag the gate had dropped, or call `runX` with an option the CLI
 * spelled differently, and nothing would notice.
 *
 * What is NOT derived is the `description`. It looks like `gate.summary` and is
 * not: it is a prompt, written for a model choosing between tools, and it
 * carries things a CLI summary never would — when to use this gate instead of
 * a neighbouring one, what it refuses to do, which silencing tricks it detects.
 * Collapsing it into `summary` would lose real work, so each tool still writes
 * its own.
 */

import { z } from "zod";
import type { AnyGateDefinition, GateInput } from "@mizchi/vlmkit-core/plugin/contract.ts";
import { runGate } from "@mizchi/vlmkit-core/plugin/runner.ts";
import type { McpTool, McpToolResult } from "./tool-result.ts";
import { toolResult } from "./tool-result.ts";

/** `check.a11y.contrast` → `check_a11y_contrast`, the MCP naming convention. */
export function gateToolName(gate: AnyGateDefinition): string {
  return gate.id.replace(/\./g, "_");
}

/** `allow-invisible` → `allowInvisible`. MCP arguments are camelCase. */
function camel(name: string): string {
  return name.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

export interface GateToolOptions {
  /** The model-facing prompt. Not derivable — see the module docstring. */
  description: string;
  /**
   * Argument names to keep stable for existing clients where the derived name
   * would differ from the published one. `check_equivalence` has taken
   * `regions` (plural) since it shipped; the gate's flag is `--region`.
   */
  aliases?: Record<string, string>;
  /** Inputs to leave out of the MCP surface (output dirs, VLM opt-ins). */
  omit?: readonly string[];
  /**
   * `--no-x` flags published as `x` with inverted meaning. A CLI says
   * `--no-fix-context` because the default is on; an MCP client sets
   * `fixContext: false`, and both must reach the same gate.
   */
  invert?: Readonly<Record<string, string>>;
}

function zodFor(input: GateInput): z.ZodTypeAny {
  const described = (schema: z.ZodTypeAny) => schema.describe(input.description);
  if (input.kind === "boolean") return described(z.boolean());
  if (input.kind === "number") return described(z.number());
  if (input.kind === "number-list") return described(z.array(z.number()).min(1));
  if (input.choices) return described(z.enum(input.choices as [string, ...string[]]));
  if (input.kind === "string-list" || input.repeatable) return described(z.array(z.string()).min(1));
  return described(z.string());
}

/**
 * Build the argv a gate's own `parse` accepts. Going through argv rather than
 * constructing the options object directly is deliberate: it means the MCP
 * path exercises the same parser and the same validation as the CLI, so a
 * malformed argument fails identically in both.
 */
export function gateToolArgv(
  gate: AnyGateDefinition,
  args: Record<string, unknown>,
  options: GateToolOptions = { description: "" },
): string[] {
  const inputs = (gate.inputs ?? []).filter((i) => !options.omit?.includes(i.name));
  const key = (input: GateInput) => options.aliases?.[input.name] ?? camel(input.name);
  const positionals = inputs
    .filter((i) => i.positional !== undefined)
    .sort((a, b) => a.positional! - b.positional!);
  const argv: string[] = [];
  for (const input of positionals) {
    const value = args[key(input)];
    if (value !== undefined) argv.push(String(value));
  }
  for (const input of inputs) {
    if (input.positional !== undefined) continue;
    const inverted = options.invert?.[input.name];
    if (inverted !== undefined) {
      // Published as the positive name: `fixContext: false` means pass
      // `--no-fix-context`; `true` or absent means pass nothing.
      if (args[inverted] === false) argv.push(`--${input.name}`);
      continue;
    }
    const value = args[key(input)];
    if (value === undefined) continue;
    if (input.kind === "boolean") {
      if (value) argv.push(`--${input.name}`);
      continue;
    }
    if (Array.isArray(value)) {
      // A repeatable flag takes one occurrence per value; a list flag takes one
      // comma-joined occurrence. Getting this backwards is exactly the kind of
      // mismatch the hand-written tools could hide.
      if (input.repeatable) for (const item of value) argv.push(`--${input.name}`, String(item));
      else argv.push(`--${input.name}`, value.map(String).join(","));
      continue;
    }
    argv.push(`--${input.name}`, String(value));
  }
  return argv;
}

/**
 * One-line verdict.
 *
 * The headline comes first when a gate declares one, because for a
 * verdict-shaped gate that is the sentence a reader wants — `verify_markup:
 * NOT DONE (1/2 targets passed, …)` says more than `3 suspect issue(s)` does,
 * and it is the prefix this tool has published since it shipped. The counts
 * follow, because they are what a client gates on.
 */
export function gateToolSummary(
  gate: AnyGateDefinition,
  outcome: { counts: { suspect: number; warn: number }; report: unknown },
): string {
  const state = outcome.counts.suspect === 0
    ? (outcome.counts.warn > 0 ? `ok (${outcome.counts.warn} warn)` : "ok")
    : `${outcome.counts.suspect} suspect issue(s)${outcome.counts.warn > 0 ? `, ${outcome.counts.warn} warn` : ""}`;
  const headline = gate.headline?.(outcome.report);
  return headline
    ? `${gateToolName(gate)}: ${headline} — ${state}`
    : `${gateToolName(gate)}: ${state}`;
}

/**
 * `structured` stays the gate's own report, not the runner's envelope. MCP
 * clients — and this package's tests — read report fields directly, and the
 * envelope's verdict is already surfaced as `failed` and in the summary line.
 */
export function gateTool(gate: AnyGateDefinition, options: GateToolOptions): McpTool {
  const inputs = (gate.inputs ?? []).filter((i) => !options.omit?.includes(i.name));
  const inputSchema: z.ZodRawShape = {};
  for (const input of inputs) {
    const inverted = options.invert?.[input.name];
    if (inverted !== undefined) {
      inputSchema[inverted] = z.boolean().optional().describe(input.description);
      continue;
    }
    const schema = zodFor(input);
    inputSchema[options.aliases?.[input.name] ?? camel(input.name)] =
      input.required === true || input.positional === 0 ? schema : schema.optional();
  }
  return {
    name: gateToolName(gate),
    description: options.description,
    inputSchema,
    run: async (args: Record<string, unknown>): Promise<McpToolResult> => {
      const outcome = await runGate(gate, gateToolArgv(gate, args, options), { ledger: false });
      return toolResult(gateToolSummary(gate, outcome), outcome.report, outcome.verdict === "fail");
    },
  };
}
