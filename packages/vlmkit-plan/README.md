# @mizchi/vlmkit-plan

Planner contract for Playwright test generation. It turns a user story, seed
test, PRD, and observed UI facts into a Markdown test plan under `specs/`.

This is not a full replacement for Playwright's official planner agent. It is a
library layer for projects that want the same planner-shaped artifact without
depending on a specific agent runtime.

```ts
import { createPlan } from "@mizchi/vlmkit-plan";

async function main() {
  const plan = await createPlan({
    title: "Guest Checkout",
    request: "Plan coverage for guest checkout.",
    seed: { path: "tests/seed.spec.ts" },
    observations: [{ roles: ['button "Pay now"', 'textbox "Email"'] }],
  }, { provider: "anthropic" });

  if (plan.diagnostics.length) {
    throw new Error(`Invalid plan:\n${plan.diagnostics.join("\n")}`);
  }

  console.log(plan.markdown);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

`diagnostics` is part of the contract. Treat non-empty diagnostics as a failed
planner run and ask the model to regenerate before passing the plan to a
generator.

Use `createPlanWithRetry` when you want that regeneration loop built in:

```ts
import { createPlanWithRetry } from "@mizchi/vlmkit-plan";

const plan = await createPlanWithRetry(input, { provider: "anthropic" }, undefined, {
  maxAttempts: 2,
});
```

For stricter downstream validation, use the structured JSON contract and render
it to the same Markdown format:

```ts
import {
  createStructuredPlan,
  structuredPlanToLocatorInventory,
} from "@mizchi/vlmkit-plan";

const planned = await createStructuredPlan(input, { provider: "anthropic" });
const locatorInventory = planned.plan
  ? structuredPlanToLocatorInventory(planned.plan)
  : undefined;
```

`locatorInventory` can be passed to `@mizchi/vlmkit-generate` to detect locator
hallucinations in generated tests. The structured planner treats this inventory
as observed data only: if no `observations` are supplied, inventory entries are
diagnostics rather than trusted facts.

When `provider` is omitted, vlmkit-plan uses `VRT_LLM_PROVIDER` first, then
available API keys in this order: Anthropic, OpenRouter, Gemini. With no key
signals it falls back to OpenRouter.

## CLI

```sh
vlmkit-plan \
  --title "Guest Checkout" \
  --request-file specs/checkout.request.md \
  --observations specs/checkout.observations.json \
  --out specs/checkout.plan.md \
  --structured-out specs/checkout.plan.json \
  --locator-inventory-out specs/checkout.locators.json \
  --provider anthropic \
  --max-attempts 2
```

The CLI exits `2` and does not write `--out` when diagnostics remain after the
retry budget. Passing `--structured-out` or `--locator-inventory-out` makes the
CLI use the structured planner contract; the locator inventory file can be passed
directly to `vlmkit-generate --locator-inventory`.
