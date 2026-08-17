import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyPatch } from "./patch.ts";

function tmp(): string {
  return mkdtempSync(join(tmpdir(), "heal-patch-"));
}

describe("applyPatch", () => {
  it("writes new content and rolls back to the original", () => {
    const dir = tmp();
    const file = join(dir, "a.spec.ts");
    writeFileSync(file, "ORIGINAL");

    const undo = applyPatch({ file, content: "PATCHED", allow: [file] });
    assert.equal(readFileSync(file, "utf8"), "PATCHED");

    undo();
    assert.equal(readFileSync(file, "utf8"), "ORIGINAL");
    assert.equal(existsSync(file + ".heal-bak"), false);
  });

  it("refuses to write a path outside the allowlist", () => {
    const dir = tmp();
    const file = join(dir, "a.spec.ts");
    writeFileSync(file, "ORIGINAL");
    const outside = join(dir, "evil.ts");

    assert.throws(() => applyPatch({ file: outside, content: "x", allow: [file] }), /not allowed/i);
  });
});
