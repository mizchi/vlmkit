import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  LEDGER_RELATIVE_PATH,
  VLMKIT_IGNORE_ENTRIES,
  appendRunLedger,
  isGitIgnored,
  isGitRepo,
} from "./run-ledger.ts";

const workdir = (): string => mkdtempSync(join(tmpdir(), "vlmkit-ledger-"));

const entry = { tool: "check-design", source: "page.html", headline: { verdict: "coherent" } };

describe("appendRunLedger", () => {
  it("reports the creation of the file, which is the moment the repo changed shape", () => {
    const cwd = workdir();
    const first = appendRunLedger(entry, { cwd });
    assert.equal(first?.created, true);
    assert.equal(first?.path, join(cwd, LEDGER_RELATIVE_PATH));
    // The second append is not news — a line per gate run would be noise.
    assert.equal(appendRunLedger(entry, { cwd })?.created, false);
    assert.equal(readFileSync(first!.path, "utf8").trim().split("\n").length, 2);
  });

  it("honours --ledger <path>, resolving a bare filename against the working directory", () => {
    const cwd = workdir();
    const write = appendRunLedger(entry, { cwd, path: "runs/gates.jsonl" });
    assert.equal(write?.path, join(cwd, "runs", "gates.jsonl"));
    assert.match(readFileSync(write!.path, "utf8"), /check-design/);
  });

  it("writes nothing when disabled, and says so by returning null", () => {
    const cwd = workdir();
    assert.equal(appendRunLedger(entry, { cwd, disabled: true }), null);
    assert.throws(() => readFileSync(join(cwd, LEDGER_RELATIVE_PATH), "utf8"));
  });

  it("still accepts a bare cwd string, since the call sites outnumber the churn", () => {
    const cwd = workdir();
    assert.equal(appendRunLedger(entry, cwd)?.path, join(cwd, LEDGER_RELATIVE_PATH));
  });
});

describe("isGitIgnored", () => {
  it("matches a directory entry against a path inside it", () => {
    const cwd = workdir();
    writeFileSync(join(cwd, ".gitignore"), "node_modules/\n.vlmkit/\n");
    assert.equal(isGitIgnored(cwd, join(cwd, ".vlmkit", "run-ledger.jsonl")), true);
    assert.equal(isGitIgnored(cwd, join(cwd, "test-results", "a11y", "report.md")), false);
  });

  it("ignores comments and leading slashes, which a hand-written .gitignore has", () => {
    const cwd = workdir();
    writeFileSync(join(cwd, ".gitignore"), "# artifacts\n/test-results/\n");
    assert.equal(isGitIgnored(cwd, join(cwd, "test-results", "png-diff")), true);
  });

  it("treats a missing .gitignore as not ignored rather than guessing the safe-looking way", () => {
    // Guessing "ignored" would suppress the one notice that tells an adopter the
    // tool is writing into their repo — the exact failure this exists to prevent.
    const cwd = workdir();
    assert.equal(isGitIgnored(cwd, join(cwd, ".vlmkit")), false);
  });

  it("says nothing about a path outside the working directory", () => {
    const cwd = workdir();
    assert.equal(isGitIgnored(cwd, join(tmpdir(), "elsewhere", "run.jsonl")), true);
  });
});

describe("isGitRepo", () => {
  it("is false for a plain directory, so nothing advises on .gitignore outside a repo", () => {
    const cwd = workdir();
    assert.equal(isGitRepo(cwd), false);
    mkdirSync(join(cwd, ".git"));
    assert.equal(isGitRepo(cwd), true);
  });
});

describe("VLMKIT_IGNORE_ENTRIES", () => {
  it("covers both directories a run writes, as one list the notice and gates init share", () => {
    assert.deepEqual([...VLMKIT_IGNORE_ENTRIES], [".vlmkit/", "test-results/"]);
  });
});
