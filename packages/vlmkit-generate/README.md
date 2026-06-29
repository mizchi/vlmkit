# @mizchi/vlmkit-generate

Generator contract for Playwright tests. It turns a Markdown plan plus generation
rules into a complete Playwright spec source file.

This is not a full replacement for Playwright's official generator agent. It is
a library layer for projects that want a runtime-neutral generator artifact.

```ts
import { readFile } from "node:fs/promises";
import { generatePlaywrightTest } from "@mizchi/vlmkit-generate";

async function main() {
  const generated = await generatePlaywrightTest({
    planMarkdown: await readFile("specs/checkout.md", "utf8"),
    rulesMarkdown: await readFile("specs/_generation-rules.md", "utf8"),
    testFilePath: "tests/checkout.spec.ts",
    helperImportPath: "../support/goto-app",
  }, { provider: "anthropic" });

  if (generated.diagnostics.length) {
    throw new Error(`Invalid generated test:\n${generated.diagnostics.join("\n")}`);
  }

  console.log(generated.source);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

`diagnostics` catches common generator failures such as missing `gotoApp(...)`,
direct `page.goto(...)`, missing `expect(...)`, missing screenshots, and leaked
Markdown code fences. When `locatorInventory` is provided, diagnostics also
flag `getByRole`, `getByLabel`, `getByTestId`, and `getByText` locators that
were not observed by the planner.

Use `generatePlaywrightTestWithRetry` when you want diagnostics to drive a
regeneration loop:

```ts
import { generatePlaywrightTestWithRetry } from "@mizchi/vlmkit-generate";

const generated = await generatePlaywrightTestWithRetry(input, {
  provider: "anthropic",
}, undefined, {
  maxAttempts: 2,
});
```

Write generated files with rollback-safe gates:

```ts
import {
  buildPlaywrightListGate,
  buildTypecheckGate,
  writeGeneratedTestFile,
} from "@mizchi/vlmkit-generate";

await writeGeneratedTestFile({
  filePath: "tests/checkout.spec.ts",
  source: generated.source,
  overwrite: true,
  gates: [
    buildPlaywrightListGate(),
    buildTypecheckGate("tsconfig.json"),
  ],
});
```

If a gate fails, the helper restores the previous file or removes the new file.

When `provider` is omitted, vlmkit-generate uses `VRT_LLM_PROVIDER` first, then
available API keys in this order: Anthropic, OpenRouter, Gemini. With no key
signals it falls back to OpenRouter.

## CLI

```sh
vlmkit-generate \
  --plan specs/checkout.plan.md \
  --rules specs/_generation-rules.md \
  --locator-inventory specs/checkout.locators.json \
  --helper-import ../support/goto-app \
  --out tests/checkout.spec.ts \
  --provider anthropic \
  --max-attempts 2 \
  --overwrite \
  --gate-command "pnpm exec playwright test --list {testFile}"
```

The CLI exits `2` and does not write `--out` when diagnostics remain after the
retry budget. `--gate-command` runs after writing and rolls the file back when
the command fails.
