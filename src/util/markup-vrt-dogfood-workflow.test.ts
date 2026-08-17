import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

async function readWorkflow() {
  return readFile(resolve(import.meta.dirname!, "..", "..", ".github", "workflows", "markup-vrt-dogfood.yml"), "utf8");
}

describe("markup VRT dogfood workflow", () => {
  it("runs offline example tests and dogfood smoke without VLM handoff", async () => {
    const workflow = await readWorkflow();

    assert.match(workflow, /name:\s*Markup VRT Dogfood/);
    assert.match(workflow, /pnpm test:examples/);
    assert.match(workflow, /pnpm dogfood:markup-vrt:offline/);
    assert.match(workflow, /MARKUP_EVAL_OFFLINE:\s*"1"/);
    assert.match(workflow, /\.vrt\/markup-vrt-eval\/github-step-summary\.md/);
    assert.match(workflow, /\.vrt\/markup-vrt-eval\/guardrail-context\.md/);
    assert.doesNotMatch(workflow, /MARKUP_EVAL_VLM_REGION_DIFF:\s*"1"/);
    assert.doesNotMatch(workflow, /OPENROUTER_API_KEY|ANTHROPIC_API_KEY|GEMINI_API_KEY/);
  });
});
