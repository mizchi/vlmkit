#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { generatePlaywrightTestWithRetry } from "./generate.ts";
import { GeneratedTestGateError, GeneratedTestWriteError, type GateCommand, writeGeneratedTestFile } from "./write.ts";
import type { GenerateDeps, GenerateInput, GeneratorModelOptions, LocatorInventory } from "./types.ts";

export interface GenerateCliArgs {
  plan: string;
  out: string;
  rules?: string;
  helperImportPath?: string;
  seedTestPath?: string;
  locatorInventory?: string;
  requireScreenshots: boolean;
  provider?: GeneratorModelOptions["provider"];
  model?: string;
  maxTokens?: number;
  maxAttempts?: number;
  overwrite: boolean;
  gateCommands: GateCommand[];
}

export function parseGenerateCliArgs(argv: string[]): GenerateCliArgs {
  const args: Partial<GenerateCliArgs> = { requireScreenshots: true, overwrite: false, gateCommands: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    const next = () => {
      const value = argv[++i];
      if (!value) throw new Error(`Missing value for ${arg}`);
      return value;
    };
    switch (arg) {
      case "--plan":
        args.plan = next();
        break;
      case "--out":
        args.out = next();
        break;
      case "--rules":
        args.rules = next();
        break;
      case "--helper-import":
        args.helperImportPath = next();
        break;
      case "--seed":
        args.seedTestPath = next();
        break;
      case "--locator-inventory":
        args.locatorInventory = next();
        break;
      case "--no-screenshots":
        args.requireScreenshots = false;
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
      case "--overwrite":
        args.overwrite = true;
        break;
      case "--gate-command":
        args.gateCommands!.push({ command: next() });
        break;
      case "--help":
      case "-h":
        throw new Error(GENERATE_USAGE);
      default:
        throw new Error(`Unknown argument: ${arg}\n\n${GENERATE_USAGE}`);
    }
  }

  if (!args.plan) throw new Error(`--plan is required\n\n${GENERATE_USAGE}`);
  if (!args.out) throw new Error(`--out is required\n\n${GENERATE_USAGE}`);
  return args as GenerateCliArgs;
}

export async function runGenerateCli(argv: string[], deps?: Partial<GenerateDeps>): Promise<number> {
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(GENERATE_USAGE);
    return 0;
  }

  let args: GenerateCliArgs;
  try {
    args = parseGenerateCliArgs(argv);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    return 1;
  }

  const input = await buildGenerateInput(args);
  const result = await generatePlaywrightTestWithRetry(input, {
    provider: args.provider,
    model: args.model,
    maxTokens: args.maxTokens,
  }, deps, { maxAttempts: args.maxAttempts });

  if (result.diagnostics.length) {
    console.error(`Invalid generated test after ${result.attempts} attempt(s):`);
    for (const diagnostic of result.diagnostics) console.error(`- ${diagnostic}`);
    return 2;
  }

  try {
    await writeGeneratedTestFile({
      filePath: args.out,
      source: result.source,
      overwrite: args.overwrite,
      gates: args.gateCommands,
    });
  } catch (error) {
    if (error instanceof GeneratedTestWriteError) {
      console.error(error.message);
      return 1;
    }
    if (error instanceof GeneratedTestGateError) {
      console.error(`Generated test gate failed: ${error.result.name}`);
      if (error.result.stdout) console.error(error.result.stdout.trimEnd());
      if (error.result.stderr) console.error(error.result.stderr.trimEnd());
      return 2;
    }
    throw error;
  }
  return 0;
}

async function buildGenerateInput(args: GenerateCliArgs): Promise<GenerateInput> {
  return {
    planMarkdown: await readFile(args.plan, "utf8"),
    rulesMarkdown: args.rules ? await readFile(args.rules, "utf8") : undefined,
    testFilePath: args.out,
    helperImportPath: args.helperImportPath,
    seedTestPath: args.seedTestPath,
    requireScreenshots: args.requireScreenshots,
    locatorInventory: args.locatorInventory ? parseLocatorInventory(await readFile(args.locatorInventory, "utf8")) : undefined,
  };
}

function parseLocatorInventory(raw: string): LocatorInventory {
  return JSON.parse(raw) as LocatorInventory;
}

function parseProvider(value: string): GeneratorModelOptions["provider"] {
  if (value === "anthropic" || value === "gemini" || value === "openrouter") return value;
  throw new Error(`Invalid --provider: ${value}`);
}

function parsePositiveInt(value: string, flag: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${flag} must be a positive integer`);
  return parsed;
}

const GENERATE_USAGE = `Usage: vlmkit-generate --plan <path> --out <path>

Options:
  --rules <path>            Additional generation rules markdown
  --helper-import <path>    Module path for gotoApp import (default: ./_helpers)
  --seed <path>             Seed test reference path
  --locator-inventory <path>
                            JSON file with roles/labels/testIds/texts
  --no-screenshots          Do not require toHaveScreenshot assertions
  --provider <name>         anthropic | gemini | openrouter
  --model <id>              Provider model id
  --max-tokens <n>          LLM output token budget
  --max-attempts <n>        Retry attempts when diagnostics remain
  --overwrite               Allow replacing an existing output file
  --gate-command <cmd>      Repeatable post-write gate; use {testFile} placeholder`;

if (isDirectRun()) {
  runGenerateCli(process.argv.slice(2)).then((code) => {
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
