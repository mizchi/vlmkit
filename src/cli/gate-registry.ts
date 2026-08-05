/**
 * The app's composed gate registry: bundled plugins plus whatever
 * `vlmkit.config.json` declares under `"plugins"`.
 *
 * This is the only place the CLI decides which gates exist. `vlmkit gates`
 * validates its config against it, the dispatcher resolves commands through
 * it, and `vlmkit rules` lists it — so a gate is added in one place and
 * appears in all three.
 *
 * Loading is lazy and cached: composing the registry imports the gate
 * definition modules, which pull in the measurement modules, and a
 * `vlmkit --help` should not pay for Playwright-adjacent imports. The
 * built-in plugin module itself only imports definitions, and Playwright is
 * dynamic-imported inside each `run`, so this stays cheap in practice.
 */

import type { GateRegistry } from "@mizchi/vlmkit-core/plugin/registry.ts";
import { createGateRegistry } from "@mizchi/vlmkit-core/plugin/registry.ts";
import { loadPlugins, readPluginSpecifiers } from "@mizchi/vlmkit-core/plugin/load.ts";
import type { VlmkitPlugin } from "@mizchi/vlmkit-core/plugin/contract.ts";

let cached: GateRegistry | undefined;

export interface LoadGateRegistryOptions {
  cwd?: string;
  /** Skip `vlmkit.config.json` plugin loading (tests, `--no-plugins`). */
  builtinsOnly?: boolean;
}

export async function loadGateRegistry(options: LoadGateRegistryOptions = {}): Promise<GateRegistry> {
  if (cached && !options.cwd && !options.builtinsOnly) return cached;
  const cwd = options.cwd ?? process.cwd();
  const { markupGatesPlugin } = await import("@mizchi/vlmkit-markup/gates/index.ts");
  const plugins: VlmkitPlugin[] = [markupGatesPlugin];
  if (!options.builtinsOnly) {
    const { specifiers } = readPluginSpecifiers(cwd);
    if (specifiers.length > 0) {
      const loaded = await loadPlugins(specifiers, { baseDir: cwd });
      plugins.push(...loaded.map((l) => l.plugin));
    }
  }
  const registry = createGateRegistry(plugins);
  if (!options.cwd && !options.builtinsOnly) cached = registry;
  return registry;
}

/** Test hook — the module-level cache would otherwise leak between cases. */
export function resetGateRegistryCache(): void {
  cached = undefined;
}
