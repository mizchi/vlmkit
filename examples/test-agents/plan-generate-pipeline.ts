import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  createStructuredPlanWithRetry,
  structuredPlanToLocatorInventory,
  type UiObservation,
} from "@mizchi/vlmkit-plan";
import { generatePlaywrightTestWithRetry } from "@mizchi/vlmkit-generate";
import { writeGeneratedTestFile, type GateCommand } from "@mizchi/vlmkit-generate";

async function main() {
  const title = process.env.TITLE ?? "Generated Playwright Test";
  const request = process.env.REQUEST
    ?? (process.env.REQUEST_FILE ? await readFile(process.env.REQUEST_FILE, "utf8") : "");
  if (!request.trim()) {
    console.error("Set REQUEST or REQUEST_FILE.");
    process.exit(2);
  }

  const planPath = process.env.PLAN_OUT ?? "specs/generated-plan.md";
  const testPath = process.env.TEST_OUT ?? "tests/generated.spec.ts";
  const provider = parseProvider(process.env.PROVIDER);
  const maxAttempts = process.env.MAX_ATTEMPTS ? Number(process.env.MAX_ATTEMPTS) : 2;
  const observations = process.env.OBSERVATIONS_FILE
    ? parseObservations(await readFile(process.env.OBSERVATIONS_FILE, "utf8"))
    : undefined;
  const rulesMarkdown = process.env.RULES_FILE
    ? await readFile(process.env.RULES_FILE, "utf8")
    : undefined;

  const plan = await createStructuredPlanWithRetry({
    title,
    request,
    prd: process.env.PRD_FILE ? await readFile(process.env.PRD_FILE, "utf8") : undefined,
    observations,
    seed: process.env.SEED_TEST
      ? {
        path: process.env.SEED_TEST,
        source: process.env.SEED_SOURCE ? await readFile(process.env.SEED_SOURCE, "utf8") : undefined,
      }
      : undefined,
  }, { provider }, undefined, { maxAttempts });

  if (plan.diagnostics.length) {
    console.error(`Planner diagnostics after ${plan.attempts} attempt(s):`);
    for (const diagnostic of plan.diagnostics) console.error(`- ${diagnostic}`);
    process.exit(2);
  }

  await mkdir(dirname(planPath), { recursive: true });
  await writeFile(planPath, plan.markdown, "utf8");

  const generated = await generatePlaywrightTestWithRetry({
    planMarkdown: plan.markdown,
    rulesMarkdown,
    testFilePath: testPath,
    helperImportPath: process.env.HELPER_IMPORT ?? "../support/goto-app",
    seedTestPath: process.env.SEED_TEST,
    requireScreenshots: process.env.NO_SCREENSHOTS !== "1",
    locatorInventory: plan.plan ? structuredPlanToLocatorInventory(plan.plan) : undefined,
  }, { provider }, undefined, { maxAttempts });

  if (generated.diagnostics.length) {
    console.error(`Generator diagnostics after ${generated.attempts} attempt(s):`);
    for (const diagnostic of generated.diagnostics) console.error(`- ${diagnostic}`);
    process.exit(2);
  }

  const gates: GateCommand[] = process.env.GATE_COMMAND
    ? [{ name: "custom", command: process.env.GATE_COMMAND }]
    : [];
  await writeGeneratedTestFile({
    filePath: testPath,
    source: generated.source,
    overwrite: process.env.OVERWRITE === "1",
    gates,
  });
  console.log(`Wrote ${planPath}`);
  console.log(`Wrote ${testPath}`);
}

function parseProvider(value: string | undefined): "anthropic" | "gemini" | "openrouter" | undefined {
  if (!value) return undefined;
  if (value === "anthropic" || value === "gemini" || value === "openrouter") return value;
  throw new Error(`Invalid PROVIDER: ${value}`);
}

function parseObservations(raw: string): UiObservation[] {
  const parsed = JSON.parse(raw) as UiObservation | UiObservation[];
  return Array.isArray(parsed) ? parsed : [parsed];
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});
