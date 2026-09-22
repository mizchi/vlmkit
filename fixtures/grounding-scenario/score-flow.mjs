#!/usr/bin/env node
/**
 * Score a v3 attempt: replay its session and read the DOM the actions actually
 * produced.
 *
 * Deliberately not scored on the attempt's own account of what happened. The
 * round's whole question is whether an agent can tell that its click worked, so
 * "it says it archived the ticket" is the claim under test, not the evidence.
 *
 *   node fixtures/grounding-scenario/score-flow.mjs attempts/f/session.json
 */
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { replay } from "./act.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const sessionPath = process.argv[2];
if (!sessionPath) {
  console.error("usage: node score-flow.mjs <attempt-session.json> [--json]");
  process.exit(1);
}
const asJson = process.argv.includes("--json");

const session = JSON.parse(await readFile(resolve(sessionPath), "utf8"));
const expect = JSON.parse(await readFile(join(HERE, "briefs/answers/inbox.expect.json"), "utf8"));

const { browser, page } = await replay(session.actions, { pageName: session.page ?? "inbox" });
const state = await page.evaluate((want) => {
  const tickets = [...document.querySelectorAll(".ticket")];
  const titleOf = (t) => t.querySelector(".t")?.textContent?.trim() ?? "";
  const target = tickets.find((t) => titleOf(t) === want);
  return {
    ticketCount: tickets.length,
    archived: tickets.filter((t) => t.dataset.state === "archived").map(titleOf),
    targetPresent: !!target,
    targetArchived: target?.dataset.state === "archived",
    openTitle: document.getElementById("detail-title")?.textContent?.trim() ?? null,
  };
}, expect.goal.archivedTitle);
await browser.close();

const deleted = expect.goal.ticketCount - state.ticketCount;
const checks = [
  { name: "target archived", ok: state.targetArchived, detail: state.targetPresent ? "" : "the target ticket is gone from the list" },
  { name: "nothing deleted", ok: deleted === 0, detail: deleted > 0 ? `${deleted} ticket(s) removed` : "" },
  {
    name: "only the target archived",
    ok: state.archived.length <= 1,
    detail: state.archived.length > 1 ? `also archived: ${state.archived.filter((t) => t !== expect.goal.archivedTitle).join(", ")}` : "",
  },
];
const passed = checks.every((c) => c.ok);

if (asJson) {
  console.log(JSON.stringify({ passed, actions: session.actions.length, checks, state }, null, 2));
} else {
  for (const c of checks) console.log(`${c.ok ? "✓" : "✗"} ${c.name}${c.detail ? `  — ${c.detail}` : ""}`);
  console.log(`\nactions used: ${session.actions.length}`);
  console.log(`open in the detail panel at the end: ${state.openTitle ?? "(nothing)"}`);
  console.log(passed ? "\nGOAL REACHED." : "\nGOAL NOT REACHED.");
}
process.exit(passed ? 0 : 1);
