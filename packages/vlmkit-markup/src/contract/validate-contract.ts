import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import {
  summarizeUiContractLandmark,
  validateUiContract,
  type UiContract,
} from "./ui-contract.ts";
import { handleCliError } from "@mizchi/vlmkit-core/cli-error.ts";

function printHelp(): void {
  console.log("Usage: vlmkit contract validate <ui.contract.json>");
}

async function main(argv = process.argv.slice(2)) {
  const input = argv.find((arg) => !arg.startsWith("-"));
  const help = argv.includes("--help") || argv.includes("-h");
  if (help || !input) {
    printHelp();
    if (!input && !help) process.exit(1);
    return;
  }
  const contract = JSON.parse(await readFile(input, "utf-8")) as UiContract;
  const issues = validateUiContract(contract);
  for (const screen of contract.screens ?? []) {
    console.log(`Screen: ${screen.id}`);
    for (const landmark of screen.landmarks ?? []) {
      console.log(`  - ${summarizeUiContractLandmark(landmark)}`);
    }
  }
  if (issues.length === 0) {
    console.log("OK: UI Contract is valid");
    return;
  }
  console.error(`${issues.length} validation issue(s):`);
  for (const issue of issues) console.error(`- ${issue.path}: ${issue.message}`);
  process.exit(1);
}

const isCliEntry = process.env.__VRT_DISPATCHER_LEAF__ === "contract-validate"
  || (process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false);
if (isCliEntry) {
  main().catch(handleCliError);
}
