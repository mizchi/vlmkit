export const commandScenarios = Object.freeze([
  {
    id: "inspect",
    label: "壊れ方を測る",
    kicker: "NO REFERENCE / 3 VIEWPORTS",
    command: "vlmkit check integrity http://localhost:3000",
    output: [
      "scan  1280 · 768 · 375",
      "pass  overflow · collision · resources · render",
      "verdict: CLEAN",
    ],
  },
  {
    id: "snapshot",
    label: "変化を追う",
    kicker: "BASELINE / PIXEL DIFF / HEATMAP",
    command: "vlmkit snapshot http://localhost:3000 --output .vlmkit/snapshots",
    output: [
      "desktop  diff 0.00%",
      "mobile   diff 0.00%",
      "verdict: UNCHANGED",
    ],
  },
  {
    id: "ship",
    label: "完了を定義する",
    kicker: "REVIEWED GATES / ONE EXIT CONTRACT",
    command: "vlmkit gates run",
    output: [
      "integrity  PASS",
      "copy       PASS",
      "layout     PASS",
      "verdict: READY TO SHIP",
    ],
  },
]);

export function findCommandScenario(id) {
  return commandScenarios.find((scenario) => scenario.id === id) ?? null;
}
