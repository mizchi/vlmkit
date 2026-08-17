/**
 * Which model an agent is told to use, in the four places that tell it, agreeing with the code.
 *
 * The defect: `.claude/CLAUDE.md` names benchmarked Claude models, so Claude Code reaches for
 * `claude:claude-haiku-4-5-20251001` and works. An OpenAI-based agent had **no project instructions
 * at all** — there was no `AGENTS.md` — guessed `VLMKIT_LLM_PROVIDER=openai`, got
 * `Expected: gemini | anthropic | openrouter`, and stopped. Nothing in the repo said where OpenAI
 * models live, and nothing could have caught that: a missing file has no test.
 *
 * So this pins three things that are easy to write down twice and get wrong once:
 *
 *   - `AGENTS.md` exists, and points at `.claude/CLAUDE.md` instead of restating it. Two copies of
 *     a convention drift; `tests/skill-package.test.mjs` exists because three copies of a skill
 *     did.
 *   - Every document that names the OpenAI model names the SAME id, and that id is the one the code
 *     exports. A doc that says `gpt-5.6` would send an agent into `MULTIPLE_MATCHES`.
 *   - No document tells anyone to set `VLMKIT_LLM_PROVIDER=openai`, which is not a provider, or
 *     `OPENAI_API_KEY`, which nothing reads.
 *
 * What it does NOT do: check that the model exists on OpenRouter. That is a network call against a
 * catalogue that changes without this repo, and a test that fails when a vendor renames a model is
 * a test that fails on someone else's schedule. `resolveModel` is where an unknown id is caught, at
 * the moment it is used and with the list to hand.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "vitest";
import { OPENAI_DEFAULT_MODEL } from "../packages/vlmkit-ai/src/llm-client.ts";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (path) => readFileSync(join(repoRoot, path), "utf8");

/** Every document an agent may read for the answer, and none of them may disagree. */
const INSTRUCTION_FILES = [
  "AGENTS.md",
  ".claude/CLAUDE.md",
  "docs/configuration.md",
  "docs/ja/README.md",
];

test("the code exports one OpenAI model id, in the OpenRouter catalogue's shape", () => {
  // The `openai/` prefix is the load-bearing half: it is what makes this an OpenRouter id rather
  // than an OpenAI one, and dropping it is how a reader concludes there is a direct OpenAI client.
  assert.match(OPENAI_DEFAULT_MODEL, /^openai\/[a-z0-9.\-]+$/);
});

test("every instruction file names that exact model and no other OpenAI default", () => {
  for (const file of INSTRUCTION_FILES) {
    const text = read(file);
    assert.ok(
      text.includes(OPENAI_DEFAULT_MODEL),
      `${file} must name ${OPENAI_DEFAULT_MODEL} — it is what an OpenAI-based agent is told to set`,
    );
    // Any other `openai/...` id in the same file is a second answer to one question. `:batch` and
    // the `-pro` variants are real models, so this is about consistency, not about them.
    const others = [...text.matchAll(/openai\/[a-z0-9.\-]+(?::batch)?/g)]
      .map((m) => m[0])
      .filter((id) => id !== OPENAI_DEFAULT_MODEL);
    assert.deepEqual(others, [], `${file} names a second OpenAI model: ${others.join(", ")}`);
  }
});

test("no instruction file sends an agent to a provider or key that does not exist", () => {
  for (const file of INSTRUCTION_FILES) {
    const text = read(file);
    // Mentioning the failure is the point of the docs, so what is forbidden is the INSTRUCTION:
    // an assignment. `VLMKIT_LLM_PROVIDER=openai` in prose that explains it fails is fine; the
    // regex therefore looks for the export/set form.
    assert.doesNotMatch(
      text,
      /(?:export|set)\s+VLMKIT_LLM_PROVIDER=["']?openai\b/,
      `${file} tells an agent to set a provider that does not exist`,
    );
    assert.doesNotMatch(
      text,
      /(?:export|set)\s+OPENAI_API_KEY=/,
      `${file} tells an agent to set OPENAI_API_KEY, which nothing in this repo reads`,
    );
  }
});

test("AGENTS.md defers to CLAUDE.md rather than restating it", () => {
  const agents = read("AGENTS.md");
  assert.match(agents, /\.claude\/CLAUDE\.md/, "it has to say where the conventions live");
  // A rough size ceiling, because the failure mode is a fork of CLAUDE.md rather than a pointer to
  // it. CLAUDE.md is ~250 lines; a third of that is a pointer plus the OpenAI-specific facts.
  const lines = agents.split("\n").length;
  assert.ok(lines < 120, `AGENTS.md is ${lines} lines — restating CLAUDE.md is how the two drift`);
});
