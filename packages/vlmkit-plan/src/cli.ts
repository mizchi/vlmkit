#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createPlanWithRetry, createStructuredPlanWithRetry, structuredPlanToLocatorInventory } from "./plan.ts";
import type { PlanDeps, PlanInput, PlanResult, PlannerModelOptions, StructuredPlanResult, UiObservation } from "./types.ts";

export interface PlanCliArgs {
  title: string;
  request?: string;
  requestFile?: string;
  out: string;
  structuredOut?: string;
  locatorInventoryOut?: string;
  prd?: string;
  seed?: string;
  seedSource?: string;
  observations?: string;
  constraints: string[];
  provider?: PlannerModelOptions["provider"];
  model?: string;
  maxTokens?: number;
  maxAttempts?: number;
}

export function parsePlanCliArgs(argv: string[]): PlanCliArgs {
  const args: Partial<PlanCliArgs> & { constraints: string[] } = { constraints: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    const next = () => {
      const value = argv[++i];
      if (!value) throw new Error(`Missing value for ${arg}`);
      return value;
    };
    switch (arg) {
      case "--title":
        args.title = next();
        break;
      case "--request":
        args.request = next();
        break;
      case "--request-file":
        args.requestFile = next();
        break;
      case "--out":
        args.out = next();
        break;
      case "--structured-out":
        args.structuredOut = next();
        break;
      case "--locator-inventory-out":
        args.locatorInventoryOut = next();
        break;
      case "--prd":
        args.prd = next();
        break;
      case "--seed":
        args.seed = next();
        break;
      case "--seed-source":
        args.seedSource = next();
        break;
      case "--observations":
        args.observations = next();
        break;
      case "--constraint":
        args.constraints.push(next());
        break;
      case "--provider":
        args.provider = parseProvider(next());
        break;
      case "--model":
        args.model = next();
        break;
      case "--max-tokens":
        args.maxTokens = parsePositiveInt(next(), arg);
        break;
      case "--max-attempts":
        args.maxAttempts = parsePositiveInt(next(), arg);
        break;
      case "--help":
      case "-h":
        throw new Error(PLAN_USAGE);
      default:
        throw new Error(`Unknown argument: ${arg}\n\n${PLAN_USAGE}`);
    }
  }

  if (!args.title) throw new Error(`--title is required\n\n${PLAN_USAGE}`);
  if (!args.request && !args.requestFile) throw new Error(`--request or --request-file is required\n\n${PLAN_USAGE}`);
  if (!args.out) throw new Error(`--out is required\n\n${PLAN_USAGE}`);
  return args as PlanCliArgs;
}

export async function runPlanCli(argv: string[], deps?: Partial<PlanDeps>): Promise<number> {
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(PLAN_USAGE);
    return 0;
  }

  let args: PlanCliArgs;
  try {
    args = parsePlanCliArgs(argv);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    return 1;
  }

  const input = await buildPlanInput(args);
  const modelOptions = {
    provider: args.provider,
    model: args.model,
    maxTokens: args.maxTokens,
  };
  const result = shouldUseStructuredPlanner(args)
    ? await createStructuredPlanWithRetry(input, modelOptions, deps, { maxAttempts: args.maxAttempts })
    : await createPlanWithRetry(input, modelOptions, deps, { maxAttempts: args.maxAttempts });

  if (result.diagnostics.length) {
    console.error(`Invalid plan after ${result.attempts} attempt(s):`);
    for (const diagnostic of result.diagnostics) console.error(`- ${diagnostic}`);
    return 2;
  }

  await writeTextFile(args.out, result.markdown);
  if (isStructuredPlanResult(result)) {
    if (args.structuredOut) {
      await writeJsonFile(args.structuredOut, result.plan);
    }
    if (args.locatorInventoryOut) {
      await writeJsonFile(
        args.locatorInventoryOut,
        result.plan ? structuredPlanToLocatorInventory(result.plan, input.observations) ?? {} : {},
      );
    }
  }
  return 0;
}

async function buildPlanInput(args: PlanCliArgs): Promise<PlanInput> {
  const request = args.request ?? await readFile(required(args.requestFile), "utf8");
  const prd = args.prd ? await readFile(args.prd, "utf8") : undefined;
  const observations = args.observations ? parseObservations(await readFile(args.observations, "utf8")) : undefined;
  const seed = args.seed
    ? { path: args.seed, source: args.seedSource ? await readFile(args.seedSource, "utf8") : undefined }
    : undefined;
  return {
    title: args.title,
    request,
    prd,
    observations,
    seed,
    constraints: args.constraints.length ? args.constraints : undefined,
  };
}

function parseObservations(raw: string): UiObservation[] {
  const parsed = JSON.parse(raw) as UiObservation | UiObservation[];
  return Array.isArray(parsed) ? parsed : [parsed];
}

function parseProvider(value: string): PlannerModelOptions["provider"] {
  if (value === "anthropic" || value === "gemini" || value === "openrouter") return value;
  throw new Error(`Invalid --provider: ${value}`);
}

function parsePositiveInt(value: string, flag: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${flag} must be a positive integer`);
  return parsed;
}

function required(value: string | undefined): string {
  if (!value) throw new Error("Missing required value");
  return value;
}

function shouldUseStructuredPlanner(args: PlanCliArgs): boolean {
  return Boolean(args.structuredOut || args.locatorInventoryOut);
}

function isStructuredPlanResult(result: PlanResult | StructuredPlanResult): result is StructuredPlanResult {
  return "plan" in result;
}

async function writeTextFile(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, "utf8");
}

async function writeJsonFile(path: string, value: unknown): Promise<void> {
  await writeTextFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

const PLAN_USAGE = `Usage: vlmkit-plan --title <title> (--request <text> | --request-file <path>) --out <path>

Options:
  --prd <path>              PRD/context markdown file
  --seed <path>             Seed test path to reference in the plan
  --seed-source <path>      Seed test source file to embed in the prompt
  --observations <path>     JSON UiObservation or UiObservation[] file
  --structured-out <path>   Write the structured JSON plan contract
  --locator-inventory-out <path>
                            Write generator locator inventory JSON
  --constraint <text>       Repeatable planner constraint
  --provider <name>         anthropic | gemini | openrouter
  --model <id>              Provider model id
  --max-tokens <n>          LLM output token budget
  --max-attempts <n>        Retry attempts when diagnostics remain`;

if (isDirectRun()) {
  runPlanCli(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  }).catch((error) => {
    console.error(error instanceof Error ? error.stack : error);
    process.exitCode = 1;
  });
}

function isDirectRun(): boolean {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]);
  } catch {
    return false;
  }
}
