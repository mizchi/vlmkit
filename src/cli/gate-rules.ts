/**
 * Project-level rule settings for a direct CLI invocation.
 *
 * `vlmkit gates run` gets its settings from the plan (they are appended to
 * each job as `--rule` flags, so the child process needs no config access).
 * A human typing `vlmkit check integrity page.html` should still get the
 * project's reviewed decisions, otherwise the config and the command line
 * disagree about what a defect is — so `defaults.rules` is read here too.
 *
 * Best-effort by design: a missing or malformed config must not stop a gate
 * from running. `vlmkit gates list` is where a broken config is supposed to
 * be reported, and it does throw.
 */

import { existsSync, readFileSync } from "node:fs";
import type { RuleSettings } from "@mizchi/vlmkit-core/plugin/rules.ts";
import { GATE_CONFIG_FILENAMES, parseGateConfig } from "@mizchi/vlmkit-core/gate-config.ts";
import { resolve } from "node:path";

export function readGateRuleSettings(cwd = process.cwd()): RuleSettings {
  for (const name of GATE_CONFIG_FILENAMES) {
    const path = resolve(cwd, name);
    if (!existsSync(path)) continue;
    try {
      return parseGateConfig(readFileSync(path, "utf-8")).defaults?.rules ?? {};
    } catch {
      return {};
    }
  }
  return {};
}
