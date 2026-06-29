import { createUnifiedLLMClient } from "@mizchi/vlmkit-ai";
import type {
  PlanDeps,
  PlanInput,
  PlanLocatorInventory,
  PlanResult,
  PlanRetryOptions,
  PlannerModelOptions,
  StructuredPlan,
  StructuredPlanResult,
  UiObservation,
} from "./types.ts";

type ResolvedPlannerModelOptions = PlannerModelOptions & {
  provider: NonNullable<PlannerModelOptions["provider"]>;
};

export function buildPlanPrompt(input: PlanInput): string {
  const parts = [
    "You are a Playwright Test planner.",
    "Write a human-readable Markdown test plan that a generator can turn into Playwright tests.",
    "Do not write test code. Verify real roles, labels, and test ids from the observations.",
    "",
    "Output format:",
    `# ${input.title}`,
    "",
    "## Application Overview",
    "Summarize the feature under test.",
    "",
    "## Test Scenarios",
    "For each scenario, include a numbered heading, Seed, Steps, and Expected Results.",
    "",
    "## Generation Notes",
    "List locator hints, deterministic VRT requirements, and data/setup caveats.",
    "",
    `User request:\n${input.request.trim()}`,
  ];

  if (input.seed) {
    parts.push("", `Seed test: ${input.seed.path}`);
    if (input.seed.source?.trim()) {
      parts.push("```ts", input.seed.source.trim(), "```");
    }
  } else {
    parts.push("", "Seed test: not provided");
  }

  if (input.prd?.trim()) {
    parts.push("", `Product context / PRD:\n${input.prd.trim()}`);
  }

  if (input.observations?.length) {
    parts.push("", "Observed UI:");
    for (const obs of input.observations) parts.push(formatObservation(obs));
  }

  if (input.constraints?.length) {
    parts.push("", "Constraints:");
    for (const c of input.constraints) parts.push(`- ${c}`);
  }

  parts.push(
    "",
    "Rules:",
    "- Prefer role, label, and test id locators over CSS or XPath.",
    "- Include `**Seed:** <seed path>` in every scenario when a seed test is provided.",
    "- Do not invent seed tests. If no seed test is provided, omit the Seed field.",
    "- Include enough expected results for semantic assertions; screenshots alone are not sufficient.",
    "- If a scenario needs VRT, mention both the start state and goal state screenshots.",
  );

  return parts.join("\n");
}

export function buildStructuredPlanPrompt(input: PlanInput): string {
  const parts = [
    "You are a Playwright Test planner.",
    "Return only JSON for this TypeScript contract:",
    "{",
    '  "title": string,',
    '  "applicationOverview": string,',
    '  "scenarios": [{',
    '    "title": string,',
    '    "seed"?: string,',
    '    "steps": string[],',
    '    "expectedResults": string[],',
    '    "locatorHints"?: string[],',
    '    "vrt"?: { "startState"?: string, "goalState"?: string }',
    "  }],",
    '  "generationNotes": string[],',
    '  "locatorInventory"?: { "roles"?: string[], "labels"?: string[], "testIds"?: string[], "texts"?: string[] }',
    "}",
    "",
    "Rules:",
    "- Do not write Playwright code.",
    "- Use only real observed roles, labels, and test IDs.",
    "- Populate locatorInventory only from Observed UI entries. If no Observed UI is provided, omit locatorInventory.",
    "- Do not invent seed tests. If no seed is provided, omit scenario.seed.",
    "- Include semantic expected results; screenshots alone are not enough.",
    "- If VRT is needed, set both vrt.startState and vrt.goalState.",
    "",
    `User request:\n${input.request.trim()}`,
  ];

  if (input.seed) {
    parts.push("", `Seed test: ${input.seed.path}`);
    if (input.seed.source?.trim()) parts.push("```ts", input.seed.source.trim(), "```");
  } else {
    parts.push("", "Seed test: not provided");
  }
  if (input.prd?.trim()) parts.push("", `Product context / PRD:\n${input.prd.trim()}`);
  if (input.observations?.length) {
    parts.push("", "Observed UI:");
    for (const obs of input.observations) parts.push(formatObservation(obs));
  }
  if (input.constraints?.length) {
    parts.push("", "Constraints:");
    for (const c of input.constraints) parts.push(`- ${c}`);
  }
  return parts.join("\n");
}

export function normalizePlanMarkdown(raw: string, fallbackTitle: string): string {
  let text = raw.trim();
  const fence = text.match(/^```(?:md|markdown)?\n([\s\S]*?)```$/i);
  if (fence) text = fence[1]!.trim();
  if (!text.startsWith("# ")) {
    text = `# ${fallbackTitle}\n\n${text}`;
  }
  return text.endsWith("\n") ? text : `${text}\n`;
}

export function validatePlanMarkdown(markdown: string, input: Pick<PlanInput, "seed"> = {}): string[] {
  const diagnostics: string[] = [];
  if (!/^##\s+Application Overview\b/im.test(markdown)) {
    diagnostics.push("missing Application Overview section");
  }
  if (!/^##\s+Test Scenarios\b/im.test(markdown)) {
    diagnostics.push("missing Test Scenarios section");
  }
  if (!/^#{2,4}\s+\d+\.\s+\S/m.test(markdown)) {
    diagnostics.push("missing numbered scenario heading");
  }
  if (input.seed && !/\*\*Seed:\*\*/i.test(markdown)) {
    diagnostics.push("missing Seed reference");
  }
  if (!input.seed && /\*\*Seed:\*\*/i.test(markdown)) {
    diagnostics.push("unexpected Seed reference");
  }
  if (!/^##\s+Generation Notes\b/im.test(markdown)) {
    diagnostics.push("missing Generation Notes section");
  }
  return diagnostics;
}

export function parseStructuredPlan(raw: string, fallbackTitle: string): StructuredPlan {
  let text = raw.trim();
  const fence = text.match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/i);
  if (fence) text = fence[1]!.trim();
  const parsed = JSON.parse(text) as StructuredPlan;
  if (!parsed.title) parsed.title = fallbackTitle;
  return parsed;
}

export function validateStructuredPlan(plan: StructuredPlan, input: Pick<PlanInput, "seed" | "observations"> = {}): string[] {
  const diagnostics: string[] = [];
  if (!plan.title?.trim()) diagnostics.push("missing title");
  if (!plan.applicationOverview?.trim()) diagnostics.push("missing Application Overview");
  if (!plan.scenarios?.length) diagnostics.push("missing scenarios");
  plan.scenarios?.forEach((scenario, index) => {
    const n = index + 1;
    if (!scenario.title?.trim()) diagnostics.push(`scenario ${n} missing title`);
    if (!scenario.steps?.length) diagnostics.push(`scenario ${n} missing steps`);
    if (!scenario.expectedResults?.length) diagnostics.push(`scenario ${n} missing expected results`);
    if (input.seed && !scenario.seed) diagnostics.push(`scenario ${n} missing Seed reference`);
    if (!input.seed && scenario.seed) diagnostics.push(`scenario ${n} unexpected Seed reference`);
  });
  if (!plan.generationNotes?.length) diagnostics.push("missing Generation Notes");
  diagnostics.push(...validateStructuredLocatorInventory(plan.locatorInventory, input.observations));
  return diagnostics;
}

export function renderStructuredPlanMarkdown(plan: StructuredPlan): string {
  const lines = [
    `# ${plan.title}`,
    "",
    "## Application Overview",
    plan.applicationOverview.trim(),
    "",
    "## Test Scenarios",
    "",
  ];

  plan.scenarios.forEach((scenario, index) => {
    lines.push(`### ${index + 1}. ${scenario.title}`, "");
    if (scenario.seed) lines.push(`**Seed:** ${scenario.seed}`, "");
    lines.push("**Steps**");
    scenario.steps.forEach((step, stepIndex) => lines.push(`${stepIndex + 1}. ${step}`));
    lines.push("", "**Expected Results**");
    scenario.expectedResults.forEach((result) => lines.push(`- ${result}`));
    if (scenario.vrt?.startState || scenario.vrt?.goalState) {
      lines.push("", "**VRT**");
      if (scenario.vrt.startState) lines.push(`- Start state: ${scenario.vrt.startState}`);
      if (scenario.vrt.goalState) lines.push(`- Goal state: ${scenario.vrt.goalState}`);
    }
    if (scenario.locatorHints?.length) {
      lines.push("", "**Locator Hints**");
      scenario.locatorHints.forEach((hint) => lines.push(`- ${hint}`));
    }
    lines.push("");
  });

  lines.push("## Generation Notes");
  plan.generationNotes.forEach((note) => lines.push(`- ${note}`));
  if (plan.locatorInventory) {
    lines.push("", "## Locator Inventory");
    appendInventoryLines(lines, plan.locatorInventory);
  }
  return `${lines.join("\n").trim()}\n`;
}

export function structuredPlanToLocatorInventory(plan: StructuredPlan): PlanLocatorInventory | undefined {
  return plan.locatorInventory;
}

export async function createPlan(
  input: PlanInput,
  opts?: PlannerModelOptions,
  deps?: Partial<PlanDeps>,
): Promise<PlanResult> {
  const prompt = buildPlanPrompt(input);
  const complete = deps?.complete ?? defaultComplete(opts);
  const res = await complete(prompt);
  const markdown = normalizePlanMarkdown(res.content, input.title);
  return {
    markdown,
    diagnostics: validatePlanMarkdown(markdown, input),
    attempts: 1,
    costUsd: res.costUsd ?? 0,
    provider: res.provider,
    model: res.model,
  };
}

export async function createPlanWithRetry(
  input: PlanInput,
  opts?: PlannerModelOptions,
  deps?: Partial<PlanDeps>,
  retry?: PlanRetryOptions,
): Promise<PlanResult> {
  const maxAttempts = normalizeMaxAttempts(retry?.maxAttempts);
  const basePrompt = buildPlanPrompt(input);
  const complete = deps?.complete ?? defaultComplete(opts);
  let prompt = basePrompt;
  let totalCostUsd = 0;
  let last: PlanResult | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await complete(prompt);
    totalCostUsd += res.costUsd ?? 0;
    const markdown = normalizePlanMarkdown(res.content, input.title);
    last = {
      markdown,
      diagnostics: validatePlanMarkdown(markdown, input),
      attempts: attempt,
      costUsd: totalCostUsd,
      provider: res.provider,
      model: res.model,
    };
    if (last.diagnostics.length === 0) return last;
    prompt = buildPlanRepairPrompt(basePrompt, markdown, last.diagnostics);
  }

  return last!;
}

export async function createStructuredPlan(
  input: PlanInput,
  opts?: PlannerModelOptions,
  deps?: Partial<PlanDeps>,
): Promise<StructuredPlanResult> {
  const prompt = buildStructuredPlanPrompt(input);
  const complete = deps?.complete ?? defaultComplete(opts);
  const res = await complete(prompt);
  const parsed = evaluateStructuredPlanContent(res.content, input);
  return {
    ...parsed,
    attempts: 1,
    costUsd: res.costUsd ?? 0,
    provider: res.provider,
    model: res.model,
  };
}

export async function createStructuredPlanWithRetry(
  input: PlanInput,
  opts?: PlannerModelOptions,
  deps?: Partial<PlanDeps>,
  retry?: PlanRetryOptions,
): Promise<StructuredPlanResult> {
  const maxAttempts = normalizeMaxAttempts(retry?.maxAttempts);
  const basePrompt = buildStructuredPlanPrompt(input);
  const complete = deps?.complete ?? defaultComplete(opts);
  let prompt = basePrompt;
  let totalCostUsd = 0;
  let last: StructuredPlanResult | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await complete(prompt);
    totalCostUsd += res.costUsd ?? 0;
    last = {
      ...evaluateStructuredPlanContent(res.content, input),
      attempts: attempt,
      costUsd: totalCostUsd,
      provider: res.provider,
      model: res.model,
    };
    if (last.diagnostics.length === 0) return last;
    prompt = buildStructuredPlanRepairPrompt(basePrompt, res.content, last.diagnostics);
  }

  return last!;
}

export function resolvePlannerModelOptions(
  opts?: PlannerModelOptions,
  env: Record<string, string | undefined> = process.env,
): ResolvedPlannerModelOptions {
  const provider = opts?.provider ?? resolveDefaultProvider(env);
  const model = opts?.model ?? (provider === "openrouter" ? "openai/gpt-5-mini" : undefined);
  const maxTokens = opts?.maxTokens ?? 2048;
  return model ? { provider, model, maxTokens } : { provider, maxTokens };
}

function defaultComplete(opts?: PlannerModelOptions): PlanDeps["complete"] {
  const modelOptions = resolvePlannerModelOptions(opts);
  return async (prompt) => {
    const client = createUnifiedLLMClient({
      provider: modelOptions.provider,
      model: modelOptions.model,
      vision: false,
    });
    if (!client) throw new Error("No LLM provider configured for vlmkit-plan");
    return client.completeWithImages(prompt, { maxTokens: modelOptions.maxTokens });
  };
}

function formatObservation(obs: UiObservation): string {
  const lines = [
    `- ${obs.title ?? obs.url ?? "page"}`,
    ...(obs.url ? [`  - URL: ${obs.url}`] : []),
    ...(obs.roles?.length ? [`  - Roles: ${obs.roles.join(", ")}`] : []),
    ...(obs.labels?.length ? [`  - Labels: ${obs.labels.join(", ")}`] : []),
    ...(obs.testIds?.length ? [`  - Test IDs: ${obs.testIds.join(", ")}`] : []),
    ...(obs.texts?.length ? [`  - Text: ${obs.texts.join(", ")}`] : []),
    ...(obs.notes?.length ? obs.notes.map((n) => `  - Note: ${n}`) : []),
  ];
  return lines.join("\n");
}

function appendInventoryLines(lines: string[], inventory: PlanLocatorInventory): void {
  if (inventory.roles?.length) lines.push(`- Roles: ${inventory.roles.join(", ")}`);
  if (inventory.labels?.length) lines.push(`- Labels: ${inventory.labels.join(", ")}`);
  if (inventory.testIds?.length) lines.push(`- Test IDs: ${inventory.testIds.join(", ")}`);
  if (inventory.texts?.length) lines.push(`- Text: ${inventory.texts.join(", ")}`);
}

function validateStructuredLocatorInventory(
  inventory: PlanLocatorInventory | undefined,
  observations: UiObservation[] | undefined,
): string[] {
  const diagnostics: string[] = [];
  if (!hasInventoryEntries(inventory)) return diagnostics;
  if (!observations?.length) {
    diagnostics.push("unexpected locatorInventory without observed UI");
    return diagnostics;
  }

  const observed = {
    roles: new Set(observations.flatMap((obs) => obs.roles ?? [])),
    labels: new Set(observations.flatMap((obs) => obs.labels ?? [])),
    testIds: new Set(observations.flatMap((obs) => obs.testIds ?? [])),
    texts: new Set(observations.flatMap((obs) => obs.texts ?? [])),
  };
  validateInventorySubset(diagnostics, "roles", inventory?.roles, observed.roles);
  validateInventorySubset(diagnostics, "labels", inventory?.labels, observed.labels);
  validateInventorySubset(diagnostics, "testIds", inventory?.testIds, observed.testIds);
  validateInventorySubset(diagnostics, "texts", inventory?.texts, observed.texts);
  return diagnostics;
}

function hasInventoryEntries(inventory: PlanLocatorInventory | undefined): boolean {
  return Boolean(
    inventory?.roles?.length
      || inventory?.labels?.length
      || inventory?.testIds?.length
      || inventory?.texts?.length,
  );
}

function validateInventorySubset(
  diagnostics: string[],
  field: keyof PlanLocatorInventory,
  values: string[] | undefined,
  observed: Set<string>,
): void {
  if (!values?.length) return;
  for (const value of values) {
    if (!observed.has(value)) {
      diagnostics.push(`locatorInventory.${field} contains unobserved locator: ${value}`);
    }
  }
}

function buildPlanRepairPrompt(basePrompt: string, markdown: string, diagnostics: string[]): string {
  return [
    basePrompt,
    "",
    "Previous plan diagnostics:",
    ...diagnostics.map((d) => `- ${d}`),
    "",
    "Previous plan:",
    "```markdown",
    markdown.trim(),
    "```",
    "",
    "Regenerate the full Markdown plan. Fix every diagnostic. Output only Markdown.",
  ].join("\n");
}

function buildStructuredPlanRepairPrompt(basePrompt: string, previousContent: string, diagnostics: string[]): string {
  return [
    basePrompt,
    "",
    "Previous structured plan diagnostics:",
    ...diagnostics.map((d) => `- ${d}`),
    "",
    "Previous structured plan output:",
    "```",
    previousContent.trim(),
    "```",
    "",
    "Regenerate the full structured plan. Fix every diagnostic. Output only JSON.",
  ].join("\n");
}

function evaluateStructuredPlanContent(
  content: string,
  input: PlanInput,
): Pick<StructuredPlanResult, "plan" | "markdown" | "diagnostics"> {
  try {
    const plan = parseStructuredPlan(content, input.title);
    const markdown = renderStructuredPlanMarkdown(plan);
    return {
      plan,
      markdown,
      diagnostics: [
        ...validateStructuredPlan(plan, input),
        ...validatePlanMarkdown(markdown, input),
      ],
    };
  } catch (error) {
    return {
      plan: null,
      markdown: normalizePlanMarkdown(content, input.title),
      diagnostics: [`invalid structured plan JSON: ${error instanceof Error ? error.message : String(error)}`],
    };
  }
}

function normalizeMaxAttempts(value: number | undefined): number {
  if (!Number.isFinite(value)) return 2;
  return Math.max(1, Math.floor(value!));
}

function resolveDefaultProvider(env: Record<string, string | undefined>): NonNullable<PlannerModelOptions["provider"]> {
  const fromEnv = env.VRT_LLM_PROVIDER;
  if (fromEnv) {
    if (fromEnv === "anthropic" || fromEnv === "gemini" || fromEnv === "openrouter") return fromEnv;
    throw new Error(`Invalid VRT_LLM_PROVIDER: ${fromEnv}`);
  }
  if (env.ANTHROPIC_API_KEY) return "anthropic";
  if (env.OPENROUTER_API_KEY) return "openrouter";
  if (env.GEMINI_API_KEY || env.GOOGLE_AI_API_KEY) return "gemini";
  return "openrouter";
}
