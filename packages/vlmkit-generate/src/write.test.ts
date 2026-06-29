import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildPlaywrightListGate,
  buildPlaywrightRuntimeGate,
  buildTypecheckGate,
  GeneratedTestGateError,
  GeneratedTestWriteError,
  writeGeneratedTestFile,
} from "./write.ts";

describe("writeGeneratedTestFile", () => {
  it("writes a new generated test file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vlmkit-write-"));
    try {
      const filePath = join(dir, "tests", "generated.spec.ts");
      const result = await writeGeneratedTestFile({
        filePath,
        source: "test('ok', async () => {});\n",
      });

      assert.equal(result.written, true);
      assert.equal(await readFile(filePath, "utf8"), "test('ok', async () => {});\n");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("refuses to overwrite unless overwrite is true", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vlmkit-write-"));
    try {
      const filePath = join(dir, "generated.spec.ts");
      await writeGeneratedTestFile({ filePath, source: "old\n" });

      await assert.rejects(
        () => writeGeneratedTestFile({ filePath, source: "new\n" }),
        (error) => error instanceof GeneratedTestWriteError && error.code === "EEXIST",
      );
      assert.equal(await readFile(filePath, "utf8"), "old\n");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("keeps the new file when gates pass", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vlmkit-write-"));
    try {
      const filePath = join(dir, "generated.spec.ts");
      const result = await writeGeneratedTestFile({
        filePath,
        source: "new\n",
        gates: [{ name: "stub", command: "check {testFile}" }],
      }, {
        runCommand: async (gate) => ({
          name: gate.name ?? gate.command,
          command: gate.command,
          ok: true,
          exitCode: 0,
          stdout: "",
          stderr: "",
        }),
      });

      assert.equal(result.gates.length, 1);
      assert.equal(await readFile(filePath, "utf8"), "new\n");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("runs a gate multiple times when runs is set", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vlmkit-write-"));
    try {
      const filePath = join(dir, "generated.spec.ts");
      const commands: string[] = [];
      const result = await writeGeneratedTestFile({
        filePath,
        source: "new\n",
        gates: [{ name: "runtime", command: "playwright test {testFile}", runs: 3 }],
      }, {
        runCommand: async (gate) => {
          commands.push(gate.command);
          return {
            name: gate.name ?? gate.command,
            command: gate.command,
            ok: true,
            exitCode: 0,
            stdout: "",
            stderr: "",
          };
        },
      });

      assert.equal(commands.length, 3);
      assert.equal(result.gates.length, 3);
      assert.equal(await readFile(filePath, "utf8"), "new\n");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("rolls back an existing file when a gate fails", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vlmkit-write-"));
    try {
      const filePath = join(dir, "generated.spec.ts");
      await writeGeneratedTestFile({ filePath, source: "old\n" });

      await assert.rejects(
        () => writeGeneratedTestFile({
          filePath,
          source: "new\n",
          overwrite: true,
          gates: [{ name: "typecheck", command: "tsc --noEmit" }],
        }, {
          runCommand: async (gate) => ({
            name: gate.name ?? gate.command,
            command: gate.command,
            ok: false,
            exitCode: 2,
            stdout: "",
            stderr: "type error",
          }),
        }),
        (error) => error instanceof GeneratedTestGateError && error.result.stderr === "type error",
      );
      assert.equal(await readFile(filePath, "utf8"), "old\n");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("removes a new file when a gate fails", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vlmkit-write-"));
    try {
      const filePath = join(dir, "generated.spec.ts");
      await assert.rejects(
        () => writeGeneratedTestFile({
          filePath,
          source: "new\n",
          gates: [{ name: "list", command: "playwright test --list {testFile}" }],
        }, {
          runCommand: async (gate) => ({
            name: gate.name ?? gate.command,
            command: gate.command,
            ok: false,
            exitCode: 1,
            stdout: "",
            stderr: "bad test",
          }),
        }),
        GeneratedTestGateError,
      );
      await assert.rejects(() => stat(filePath));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("gate builders", () => {
  it("builds Playwright --list, runtime, and TypeScript gate commands", () => {
    assert.deepEqual(buildPlaywrightListGate(), {
      name: "playwright-list",
      command: "pnpm exec playwright test --list {testFile}",
    });
    assert.deepEqual(buildPlaywrightRuntimeGate("playwright.e2e.config.ts"), {
      name: "playwright-runtime",
      command: "pnpm exec playwright test --config playwright.e2e.config.ts {testFile}",
    });
    assert.deepEqual(buildPlaywrightRuntimeGate("playwright.e2e.config.ts", 2), {
      name: "playwright-runtime",
      command: "pnpm exec playwright test --config playwright.e2e.config.ts {testFile}",
      runs: 2,
    });
    assert.deepEqual(buildTypecheckGate("tsconfig.e2e.json"), {
      name: "typecheck",
      command: "pnpm exec tsc --noEmit -p tsconfig.e2e.json",
    });
  });
});
