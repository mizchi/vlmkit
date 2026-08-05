/**
 * The built-in markup gate plugin.
 *
 * Deliberately an ordinary `definePlugin()` result with no privileges: the
 * CLI composes it with any user plugins through the same
 * `createGateRegistry([...])` call. If the contract were not sufficient for
 * these gates it would not be sufficient for a third party's either, and
 * making the built-ins its first consumer is the only way to keep that
 * honest.
 *
 * Migration state: the gates listed here are driven by the core runner. The
 * remaining ~55 commands still dispatch through `src/cli/cli.ts`'s `SPECS`
 * table to their own `main()`. Both paths coexist by design — the registry is
 * consulted first, and an unmigrated command falls through — so gates move
 * over one reviewable commit at a time instead of one 60-module rewrite.
 *
 * Adding a gate here is the whole checklist:
 *   1. `defineGate({...})` next to the measurement code it wraps.
 *   2. Add it to `gates` below.
 * The CLI help, `--json` envelope, `--advisory`, `--rule`, `vlmkit.gates.json`
 * validation, the ledger entry and the exit code all follow from the
 * definition.
 */

import { definePlugin } from "@mizchi/vlmkit-core/plugin/contract.ts";
import { breakpointsGate } from "./breakpoints.gate.ts";
import { integrityGate } from "./integrity.gate.ts";
import { layoutGate } from "./layout.gate.ts";
import { motionGate } from "./motion.gate.ts";
import { scrollGate } from "./scroll.gate.ts";

export { breakpointsGate, integrityGate, layoutGate, motionGate, scrollGate };

export const markupGatesPlugin = definePlugin({
  name: "@mizchi/vlmkit-markup",
  gates: [integrityGate, layoutGate, breakpointsGate, scrollGate, motionGate],
});

export default markupGatesPlugin;
