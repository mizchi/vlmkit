import { exec } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export interface GateCommand {
  name?: string;
  command: string;
  cwd?: string;
  env?: Record<string, string | undefined>;
}

export interface GateResult {
  name: string;
  command: string;
  ok: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface WriteGeneratedTestOptions {
  filePath: string;
  source: string;
  overwrite?: boolean;
  dryRun?: boolean;
  gates?: GateCommand[];
  cwd?: string;
}

export interface WriteGeneratedTestResult {
  filePath: string;
  written: boolean;
  gates: GateResult[];
}

export interface WriteGeneratedTestDeps {
  runCommand?: (gate: GateCommand) => Promise<GateResult>;
}

export class GeneratedTestWriteError extends Error {
  readonly code: "EEXIST";

  constructor(
    code: "EEXIST",
    message: string,
  ) {
    super(message);
    this.name = "GeneratedTestWriteError";
    this.code = code;
  }
}

export class GeneratedTestGateError extends Error {
  readonly result: GateResult;

  constructor(result: GateResult) {
    super(`Generated test gate failed: ${result.name}`);
    this.name = "GeneratedTestGateError";
    this.result = result;
  }
}

export async function writeGeneratedTestFile(
  options: WriteGeneratedTestOptions,
  deps: WriteGeneratedTestDeps = {},
): Promise<WriteGeneratedTestResult> {
  const cwd = options.cwd ?? process.cwd();
  const filePath = resolve(cwd, options.filePath);
  const gates = options.gates ?? [];
  const runCommand = deps.runCommand ?? runShellGate;
  const previous = await readOptional(filePath);

  if (previous !== undefined && !options.overwrite) {
    throw new GeneratedTestWriteError("EEXIST", `Refusing to overwrite existing file: ${filePath}`);
  }
  if (options.dryRun) {
    return { filePath, written: false, gates: [] };
  }

  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, options.source, "utf8");

  const results: GateResult[] = [];
  try {
    for (const gate of gates) {
      const result = await runCommand({
        ...gate,
        cwd: gate.cwd ?? cwd,
        command: formatGateCommand(gate.command, filePath),
      });
      results.push(result);
      if (!result.ok) throw new GeneratedTestGateError(result);
    }
  } catch (error) {
    if (previous !== undefined) {
      await writeFile(filePath, previous, "utf8");
    } else {
      await rm(filePath, { force: true });
    }
    throw error;
  }

  return { filePath, written: true, gates: results };
}

export function buildPlaywrightListGate(): GateCommand {
  return {
    name: "playwright-list",
    command: "pnpm exec playwright test --list {testFile}",
  };
}

export function buildTypecheckGate(tsconfig?: string): GateCommand {
  return {
    name: "typecheck",
    command: tsconfig ? `pnpm exec tsc --noEmit -p ${tsconfig}` : "pnpm exec tsc --noEmit",
  };
}

async function readOptional(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return undefined;
    throw error;
  }
}

function formatGateCommand(command: string, filePath: string): string {
  return command.replaceAll("{testFile}", shellQuote(filePath));
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function runShellGate(gate: GateCommand): Promise<GateResult> {
  return new Promise((resolveResult) => {
    exec(gate.command, {
      cwd: gate.cwd,
      env: { ...process.env, ...gate.env },
    }, (error, stdout, stderr) => {
      const exitCode = typeof (error as { code?: unknown } | null)?.code === "number"
        ? (error as { code: number }).code
        : error ? 1 : 0;
      resolveResult({
        name: gate.name ?? gate.command,
        command: gate.command,
        ok: !error,
        exitCode,
        stdout,
        stderr,
      });
    });
  });
}
