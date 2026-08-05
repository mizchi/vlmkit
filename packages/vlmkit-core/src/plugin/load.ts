/**
 * Loading third-party gate plugins.
 *
 * A plugin is an ordinary ES module whose default export (or named `plugin`
 * export) is a `VlmkitPlugin`. Nothing about it is privileged: the bundled
 * gates are loaded through the same `createGateRegistry` call, so a project
 * that adds a house rule gets the same CLI help, the same `--json` shape,
 * the same `vlmkit.gates.json` validation and the same exit-code contract as
 * `check integrity`.
 *
 * Declared in `vlmkit.config.json`:
 *
 *   { "plugins": ["./tools/house-gates.ts", "@acme/vlmkit-brand-gates"] }
 *
 * Relative specifiers resolve against the config's directory, not the
 * process cwd — a plugin path that only works when you happen to run from
 * the repo root is a trap in CI.
 */

import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { AnyGateDefinition, VlmkitPlugin } from "./contract.ts";
import { CONFIG_FILE } from "../project-config.ts";

export interface LoadedPlugin {
  plugin: VlmkitPlugin;
  /** Specifier as written in the config, for error messages. */
  specifier: string;
  /** What was actually imported. */
  resolved: string;
}

/** Injectable so tests do not need a module on disk. */
export type PluginImporter = (specifier: string) => Promise<unknown>;

function isGateLike(value: unknown): value is AnyGateDefinition {
  const gate = value as Partial<AnyGateDefinition> | null;
  return Boolean(
    gate
    && typeof gate.id === "string"
    && Array.isArray(gate.command)
    && typeof gate.parse === "function"
    && typeof gate.run === "function"
    && typeof gate.findings === "function"
    && typeof gate.format === "function"
    && Array.isArray(gate.rules),
  );
}

/**
 * Validate the imported shape before it reaches the registry. The registry's
 * own validation covers ids and rule tables; this covers "is this even a
 * plugin", where the useful error names the specifier and the missing member
 * rather than surfacing as `gates is not iterable` three frames deeper.
 */
export function asPlugin(moduleNamespace: unknown, specifier: string): VlmkitPlugin {
  const ns = moduleNamespace as Record<string, unknown> | null;
  const candidate = (ns?.default ?? ns?.plugin) as Partial<VlmkitPlugin> | undefined;
  if (!candidate || typeof candidate !== "object") {
    throw new Error(
      `${specifier}: expected a default export (or a named \`plugin\` export) created with definePlugin()`,
    );
  }
  if (typeof candidate.name !== "string" || !candidate.name.trim()) {
    throw new Error(`${specifier}: plugin.name is required`);
  }
  if (!Array.isArray(candidate.gates) || candidate.gates.length === 0) {
    throw new Error(`${specifier}: plugin.gates must be a non-empty array of defineGate() results`);
  }
  const bad = candidate.gates.findIndex((gate) => !isGateLike(gate));
  if (bad >= 0) {
    throw new Error(
      `${specifier}: gates[${bad}] is not a gate definition`
      + ` — it must carry id, command, rules, parse, run, findings and format (use defineGate()).`,
    );
  }
  return { name: candidate.name.trim(), ...(candidate.version ? { version: candidate.version } : {}), gates: candidate.gates };
}

export interface LoadPluginsOptions {
  /** Directory relative specifiers resolve against. Defaults to cwd. */
  baseDir?: string;
  importer?: PluginImporter;
}

export async function loadPlugins(
  specifiers: readonly string[],
  options: LoadPluginsOptions = {},
): Promise<LoadedPlugin[]> {
  const baseDir = options.baseDir ?? process.cwd();
  const importer = options.importer ?? ((spec: string) => import(spec));
  const loaded: LoadedPlugin[] = [];
  for (const specifier of specifiers) {
    const isPath = specifier.startsWith(".") || isAbsolute(specifier);
    const resolved = isPath ? pathToFileURL(resolve(baseDir, specifier)).href : specifier;
    let ns: unknown;
    try {
      ns = await importer(resolved);
    } catch (e) {
      throw new Error(
        `failed to load gate plugin "${specifier}"`
        + (isPath ? ` (resolved to ${resolved})` : "")
        + `: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
    loaded.push({ plugin: asPlugin(ns, specifier), specifier, resolved });
  }
  return loaded;
}

/**
 * Read the `plugins` array out of `vlmkit.config.json`. Absent config or
 * absent key means no plugins — a project that declares none must not pay a
 * config-file requirement.
 */
export function readPluginSpecifiers(cwd = process.cwd()): { specifiers: string[]; configPath: string | null } {
  const configPath = resolve(cwd, CONFIG_FILE);
  if (!existsSync(configPath)) return { specifiers: [], configPath: null };
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(configPath, "utf-8"));
  } catch (e) {
    throw new Error(`${CONFIG_FILE} is not valid JSON: ${e instanceof Error ? e.message : String(e)}`);
  }
  const raw = (data as Record<string, unknown> | null)?.plugins;
  if (raw === undefined) return { specifiers: [], configPath };
  if (!Array.isArray(raw) || raw.some((s) => typeof s !== "string" || !s.trim())) {
    throw new Error(`${CONFIG_FILE}: "plugins" must be an array of module specifier strings`);
  }
  return { specifiers: (raw as string[]).map((s) => s.trim()), configPath };
}
