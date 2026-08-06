/**
 * The built-in markup gate plugin.
 *
 * Deliberately an ordinary `definePlugin()` result with no privileges: the
 * CLI composes it with `vlmkit-capture`'s plugin, the app-side plugin, and any
 * user plugins through the same `createGateRegistry([...])` call. If the
 * contract were not sufficient for these gates it would not be sufficient for
 * a third party's either, and making the built-ins its first consumer is the
 * only way to keep that honest.
 *
 * Adding a gate here is the whole checklist:
 *   1. `defineGate({...})` next to the measurement code it wraps.
 *   2. Add it to `gates` below.
 * The CLI help, `--json` envelope, `--advisory`, `--rule`, `vlmkit.gates.json`
 * validation, the ledger entry and the exit code all follow from the
 * definition.
 *
 * What is deliberately NOT here: `diff *`, `build *`, `contract *`, `scan
 * component`, `scan mock`, `snapshot` and friends. Those produce artifacts
 * (reports, crops, scaffolds, baselines) rather than verdicts, so they have no
 * findings to normalize and no pass/fail to gate on. Stretching the contract
 * to cover them would make `Finding` meaningless. They keep the `SPECS` path
 * in `src/cli/cli.ts`.
 */

import { definePlugin } from "@mizchi/vlmkit-core/plugin/contract.ts";
import { a11yContrastGate, a11yFocusGate, a11yTouchGate } from "./a11y.gate.ts";
import { animationGate } from "./animation.gate.ts";
import { assetGate } from "./asset.gate.ts";
import { breakpointsGate } from "./breakpoints.gate.ts";
import { copyGate } from "./copy.gate.ts";
import { designGate } from "./design.gate.ts";
import { driftComponentGate, driftPagesGate } from "./drift.gate.ts";
import { equivalenceGate } from "./equivalence.gate.ts";
import { handlersGate } from "./handlers.gate.ts";
import { integrityGate } from "./integrity.gate.ts";
import { interactionsGate } from "./interactions.gate.ts";
import { layoutGate } from "./layout.gate.ts";
import { motionGate } from "./motion.gate.ts";
import { scrollGate } from "./scroll.gate.ts";
import { storyGate } from "./story.gate.ts";
import { scrollScanGate } from "./scroll-scan.gate.ts";
import { i18nStressGate, mediaVariantsGate } from "./stress.gate.ts";
import { themeGate } from "./theme.gate.ts";
import { tokensGate } from "./tokens.gate.ts";
import { verifyFlowGate, verifyMarkupGate } from "./verify.gate.ts";

export {
  a11yContrastGate,
  a11yFocusGate,
  a11yTouchGate,
  animationGate,
  assetGate,
  breakpointsGate,
  copyGate,
  designGate,
  driftComponentGate,
  driftPagesGate,
  equivalenceGate,
  handlersGate,
  i18nStressGate,
  integrityGate,
  interactionsGate,
  layoutGate,
  mediaVariantsGate,
  motionGate,
  scrollGate,
  storyGate,
  scrollScanGate,
  themeGate,
  tokensGate,
  verifyFlowGate,
  verifyMarkupGate,
};

export const markupGatesPlugin = definePlugin({
  name: "@mizchi/vlmkit-markup",
  gates: [
    // Reference-free correctness first — the order `vlmkit rules` lists them in,
    // and roughly the order the skills recommend running them.
    integrityGate,
    layoutGate,
    copyGate,
    interactionsGate,
    a11yContrastGate,
    a11yTouchGate,
    a11yFocusGate,
    // Responsive / dynamic behavior.
    breakpointsGate,
    scrollGate,
  storyGate,
    scrollScanGate,
    handlersGate,
    motionGate,
    animationGate,
    i18nStressGate,
    mediaVariantsGate,
    // Decoration and consistency.
    tokensGate,
    designGate,
    themeGate,
    assetGate,
    driftComponentGate,
    driftPagesGate,
    // Aggregate verdicts.
    verifyMarkupGate,
    verifyFlowGate,
    equivalenceGate,
  ],
});

export default markupGatesPlugin;
