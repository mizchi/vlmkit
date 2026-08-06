/**
 * The plugin this example directory registers — both worked gates in one
 * module.
 *
 * A plugin is the unit of *distribution*: one module, one `definePlugin`, any
 * number of gates. That is what a real house plugin looks like, so it is what
 * `examples/gate-plugin/vlmkit.config.json` points at:
 *
 *   { "plugins": ["./index.ts"] }
 *
 * `house-gates.ts` also default-exports a plugin of its own, holding just the
 * one gate. It is the smaller thing to point a first config at, and the docs
 * use it for exactly that. Do not declare both in the same config — they share
 * `check.house-brand`, and the registry refuses duplicate gate ids rather than
 * silently letting one win.
 */

import { definePlugin } from "@mizchi/vlmkit-core/plugin/contract.ts";
import { domBudgetGate } from "./dom-budget.gate.ts";
import { houseBrandGate } from "./house-gates.ts";

export { domBudgetGate, houseBrandGate };

export default definePlugin({
  name: "house-gates",
  version: "1.0.0",
  gates: [houseBrandGate, domBudgetGate],
});
