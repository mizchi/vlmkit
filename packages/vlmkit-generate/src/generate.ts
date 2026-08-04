import { createUnifiedLLMClient } from "@mizchi/vlmkit-ai";
import * as ts from "typescript";
import type { GenerateDeps, GenerateInput, GenerateResult, GenerateRetryOptions, GeneratorModelOptions, LocatorInventory } from "./types.ts";

type ResolvedGeneratorModelOptions = GeneratorModelOptions & {
  provider: NonNullable<GeneratorModelOptions["provider"]>;
};

export function buildGeneratePrompt(input: GenerateInput): string {
  const helperImportPath = input.helperImportPath ?? "./_helpers";
  const requireScreenshots = input.requireScreenshots ?? true;
  return [
    "You are a Playwright Test generator.",
    "Write exactly one complete TypeScript Playwright spec file.",
    "Output only the full file inside one ```ts code block.",
    "",
    `Target file: ${input.testFilePath}`,
    input.seedTestPath ? `Seed test reference: ${input.seedTestPath}` : undefined,
    "",
    "Mandatory rules:",
    "- Import `test` and `expect` from `@playwright/test`.",
    `- Import and use \`gotoApp\` from \`${helperImportPath}\`; do not call \`page.goto\` directly.`,
    "- Prefer role, label, and test id locators. Avoid CSS and XPath unless no semantic locator exists.",
    "- For live-region roles such as `status`, `alert`, and `log`, use `getByRole(\"status\")` and assert text separately; do not pass a `name` filter.",
    "- Keep comments sparse. Do not narrate obvious Playwright actions; comment only non-obvious locator or determinism constraints.",
    "- Every visual assertion must also have semantic assertions.",
    requireScreenshots
      ? "- Include deterministic `toHaveScreenshot()` checks only for VRT states required by the plan and additional generation rules. Do not invent extra snapshots."
      : undefined,
    input.locatorInventory ? formatLocatorInventory(input.locatorInventory) : undefined,
    "",
    input.rulesMarkdown?.trim() ? `Additional generation rules:\n${input.rulesMarkdown.trim()}` : undefined,
    "",
    `Plan:\n${input.planMarkdown.trim()}`,
  ].filter((p): p is string => Boolean(p)).join("\n");
}

export function extractTypescriptSource(raw: string): string {
  let text = raw.trim();
  for (let i = 0; i < 3; i++) {
    const outer = stripOuterCodeFence(text);
    if (outer !== null) {
      text = outer;
      continue;
    }
    const fenced = text.match(/```(?:ts|typescript)?\r?\n([\s\S]*?)\r?\n```/i);
    if (!fenced) break;
    text = fenced[1]!.trim();
  }
  return text.trimEnd() + "\n";
}

export function validateGeneratedTestSource(
  source: string,
  input: Pick<GenerateInput, "helperImportPath" | "requireScreenshots" | "locatorInventory"> = {},
): string[] {
  const diagnostics: string[] = [];
  if (/```/.test(source)) {
    diagnostics.push("source contains markdown code fences");
  }
  if (countStandaloneCommentLines(source) >= 3) {
    diagnostics.push("generated source has excessive comments; keep only non-obvious comments");
  }
  const sourceFile = ts.createSourceFile("generated.spec.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  // parseDiagnostics is a TypeScript-internal field not in the public SourceFile type.
  const parseDiagnostics = (sourceFile as ts.SourceFile & { parseDiagnostics?: ts.DiagnosticWithLocation[] }).parseDiagnostics ?? [];
  for (const parseDiagnostic of parseDiagnostics) {
    const message = ts.flattenDiagnosticMessageText(parseDiagnostic.messageText, " ");
    diagnostics.push(`typescript syntax error: ${message}`);
  }

  const astInfo = collectGeneratedTestAstInfo(sourceFile, input.helperImportPath ?? "./_helpers");
  if (!astInfo.hasPlaywrightImport) {
    diagnostics.push("missing @playwright/test import");
  } else {
    if (!astInfo.hasTestImport) diagnostics.push("missing test import from @playwright/test");
    if (!astInfo.hasExpectImport) diagnostics.push("missing expect import from @playwright/test");
  }
  if (!astInfo.usesGotoApp) {
    diagnostics.push("missing gotoApp usage");
  }
  if (!astInfo.usesExpect) {
    diagnostics.push("missing expect assertions");
  }
  if (astInfo.usesPageGoto) {
    diagnostics.push("direct page.goto is not allowed; use gotoApp(page)");
  }
  if ((input.requireScreenshots ?? true) && !astInfo.usesToHaveScreenshot) {
    diagnostics.push("missing toHaveScreenshot assertions");
  }

  if (!astInfo.hasGotoAppImport) {
    diagnostics.push(`missing gotoApp import from ${astInfo.helperImportPath}`);
  }
  diagnostics.push(...validateRoleLocatorUsage(astInfo.locators));
  if (input.locatorInventory) {
    diagnostics.push(...validateLocatorInventory(astInfo.locators, input.locatorInventory));
  }
  return diagnostics;
}

export async function generatePlaywrightTest(
  input: GenerateInput,
  opts?: GeneratorModelOptions,
  deps?: Partial<GenerateDeps>,
): Promise<GenerateResult> {
  const prompt = buildGeneratePrompt(input);
  const complete = deps?.complete ?? defaultComplete(opts);
  const res = await complete(prompt);
  const source = extractTypescriptSource(res.content);
  return {
    source,
    diagnostics: validateGeneratedTestSource(source, input),
    attempts: 1,
    costUsd: res.costUsd ?? 0,
    provider: res.provider,
    model: res.model,
  };
}

export async function generatePlaywrightTestWithRetry(
  input: GenerateInput,
  opts?: GeneratorModelOptions,
  deps?: Partial<GenerateDeps>,
  retry?: GenerateRetryOptions,
): Promise<GenerateResult> {
  const maxAttempts = normalizeMaxAttempts(retry?.maxAttempts);
  const basePrompt = buildGeneratePrompt(input);
  const complete = deps?.complete ?? defaultComplete(opts);
  let prompt = basePrompt;
  let totalCostUsd = 0;
  let last: GenerateResult | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await complete(prompt);
    totalCostUsd += res.costUsd ?? 0;
    const source = extractTypescriptSource(res.content);
    last = {
      source,
      diagnostics: validateGeneratedTestSource(source, input),
      attempts: attempt,
      costUsd: totalCostUsd,
      provider: res.provider,
      model: res.model,
    };
    if (last.diagnostics.length === 0) return last;
    prompt = buildGenerateRepairPrompt(basePrompt, source, last.diagnostics);
  }

  return last!;
}

export function resolveGeneratorModelOptions(
  opts?: GeneratorModelOptions,
  env: Record<string, string | undefined> = process.env,
): ResolvedGeneratorModelOptions {
  const provider = opts?.provider ?? resolveDefaultProvider(env);
  const model = opts?.model ?? (provider === "openrouter" ? "openai/gpt-5-codex" : undefined);
  const maxTokens = opts?.maxTokens ?? 4096;
  return model ? { provider, model, maxTokens } : { provider, maxTokens };
}

function defaultComplete(opts?: GeneratorModelOptions): GenerateDeps["complete"] {
  const modelOptions = resolveGeneratorModelOptions(opts);
  return async (prompt) => {
    const client = createUnifiedLLMClient({
      provider: modelOptions.provider,
      model: modelOptions.model,
      vision: false,
    });
    if (!client) throw new Error("No LLM provider configured for vlmkit-generate");
    return client.completeWithImages(prompt, { maxTokens: modelOptions.maxTokens });
  };
}

function stripOuterCodeFence(source: string): string | null {
  const lines = source.trim().split(/\r?\n/);
  if (!/^```(?:ts|typescript)?\s*$/i.test(lines[0] ?? "")) return null;
  let end = lines.length - 1;
  while (end > 0 && lines[end]!.trim() === "") end--;
  if (lines[end]!.trim() !== "```") return null;
  return lines.slice(1, end).join("\n").trim();
}

function countStandaloneCommentLines(source: string): number {
  return source.split(/\r?\n/).filter((line) => {
    const trimmed = line.trim();
    return trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*");
  }).length;
}

interface GeneratedTestAstInfo {
  helperImportPath: string;
  hasPlaywrightImport: boolean;
  hasTestImport: boolean;
  hasExpectImport: boolean;
  hasGotoAppImport: boolean;
  usesGotoApp: boolean;
  usesExpect: boolean;
  usesPageGoto: boolean;
  usesToHaveScreenshot: boolean;
  locators: UsedLocator[];
}

type UsedLocator =
  | { kind: "role"; role: string; name?: string }
  | { kind: "label"; value: string }
  | { kind: "testId"; value: string }
  | { kind: "text"; value: string };

function collectGeneratedTestAstInfo(sourceFile: ts.SourceFile, helperImportPath: string): GeneratedTestAstInfo {
  const info: GeneratedTestAstInfo = {
    helperImportPath,
    hasPlaywrightImport: false,
    hasTestImport: false,
    hasExpectImport: false,
    hasGotoAppImport: false,
    usesGotoApp: false,
    usesExpect: false,
    usesPageGoto: false,
    usesToHaveScreenshot: false,
    locators: [],
  };

  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteralLike(node.moduleSpecifier)) {
      const moduleName = node.moduleSpecifier.text;
      const imported = getNamedImportMap(node);
      if (moduleName === "@playwright/test") {
        info.hasPlaywrightImport = true;
        info.hasTestImport ||= imported.has("test");
        info.hasExpectImport ||= imported.has("expect");
      }
      if (moduleName === helperImportPath) {
        info.hasGotoAppImport ||= imported.get("gotoApp") === "gotoApp";
      }
    }

    if (ts.isCallExpression(node)) {
      if (ts.isIdentifier(node.expression)) {
        if (node.expression.text === "gotoApp") info.usesGotoApp = true;
        if (node.expression.text === "expect") info.usesExpect = true;
      } else if (ts.isPropertyAccessExpression(node.expression)) {
        const property = node.expression.name.text;
        if (property === "goto" && ts.isIdentifier(node.expression.expression) && node.expression.expression.text === "page") {
          info.usesPageGoto = true;
        }
        if (property === "soft" && ts.isIdentifier(node.expression.expression) && node.expression.expression.text === "expect") {
          info.usesExpect = true;
        }
        if (property === "toHaveScreenshot") {
          info.usesToHaveScreenshot = true;
        }
        const locator = extractUsedLocator(node, property);
        if (locator) info.locators.push(locator);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return info;
}

function getNamedImportMap(node: ts.ImportDeclaration): Map<string, string> {
  const imports = new Map<string, string>();
  const clause = node.importClause;
  const bindings = clause?.namedBindings;
  if (!bindings || !ts.isNamedImports(bindings)) return imports;
  for (const element of bindings.elements) {
    const importedName = element.propertyName?.text ?? element.name.text;
    imports.set(importedName, element.name.text);
  }
  return imports;
}

function extractUsedLocator(node: ts.CallExpression, property: string): UsedLocator | null {
  if (property === "getByRole") {
    const role = getStringArg(node, 0);
    if (!role) return null;
    const name = getObjectStringProperty(node.arguments[1], "name");
    return { kind: "role", role, name };
  }
  if (property === "getByLabel") {
    const value = getStringArg(node, 0);
    return value ? { kind: "label", value } : null;
  }
  if (property === "getByTestId") {
    const value = getStringArg(node, 0);
    return value ? { kind: "testId", value } : null;
  }
  if (property === "getByText") {
    const value = getStringArg(node, 0);
    return value ? { kind: "text", value } : null;
  }
  return null;
}

function getStringArg(node: ts.CallExpression, index: number): string | null {
  const arg = node.arguments[index];
  return arg && ts.isStringLiteralLike(arg) ? arg.text : null;
}

function getObjectStringProperty(node: ts.Expression | undefined, propertyName: string): string | undefined {
  if (!node || !ts.isObjectLiteralExpression(node)) return undefined;
  for (const property of node.properties) {
    if (!ts.isPropertyAssignment(property)) continue;
    const name = property.name;
    const key = ts.isIdentifier(name) || ts.isStringLiteralLike(name) ? name.text : undefined;
    if (key !== propertyName) continue;
    return ts.isStringLiteralLike(property.initializer) ? property.initializer.text : undefined;
  }
  return undefined;
}

function validateLocatorInventory(usedLocators: UsedLocator[], inventory: LocatorInventory): string[] {
  const diagnostics: string[] = [];
  const allowed = normalizeLocatorInventory(inventory);
  for (const locator of usedLocators) {
    if (locator.kind === "role" && allowed.roles.size) {
      const keys = [roleKey(locator.role, locator.name), roleKey(locator.role, undefined)];
      if (!keys.some((key) => allowed.roles.has(key)) && !isAllowedNamelessObservedRole(locator, allowed)) {
        diagnostics.push(`unknown role locator: ${locator.role}${locator.name ? ` "${locator.name}"` : ""}`);
      }
    }
    if (locator.kind === "label" && allowed.labels.size && !allowed.labels.has(locator.value)) {
      diagnostics.push(`unknown label locator: "${locator.value}"`);
    }
    if (locator.kind === "testId" && allowed.testIds.size && !allowed.testIds.has(locator.value)) {
      diagnostics.push(`unknown test id locator: "${locator.value}"`);
    }
    if (locator.kind === "text" && allowed.texts.size && !allowed.texts.has(locator.value)) {
      diagnostics.push(`unknown text locator: "${locator.value}"`);
    }
  }
  return diagnostics;
}

function validateRoleLocatorUsage(usedLocators: UsedLocator[]): string[] {
  const diagnostics: string[] = [];
  for (const locator of usedLocators) {
    if (locator.kind === "role" && locator.name && namelessObservedRoleNames.has(locator.role)) {
      diagnostics.push(`role "${locator.role}" should not use a name filter; assert text separately`);
    }
  }
  return diagnostics;
}

function normalizeLocatorInventory(inventory: LocatorInventory) {
  const roleEntries = (inventory.roles ?? []).map(parseRoleInventoryEntry);
  return {
    roles: new Set(roleEntries.map((entry) => roleKey(entry.role, entry.name))),
    observedRoleKinds: new Set(roleEntries.map((entry) => entry.role)),
    labels: new Set(inventory.labels ?? []),
    testIds: new Set(inventory.testIds ?? []),
    texts: new Set(inventory.texts ?? []),
  };
}

function isAllowedNamelessObservedRole(
  locator: UsedLocator,
  allowed: ReturnType<typeof normalizeLocatorInventory>,
): boolean {
  return locator.kind === "role"
    && !locator.name
    && namelessObservedRoleNames.has(locator.role)
    && allowed.observedRoleKinds.has(locator.role);
}

const namelessObservedRoleNames = new Set(["status", "alert", "log"]);

function parseRoleInventoryEntry(entry: string): { role: string; name?: string } {
  const quoted = entry.match(/^([^"']+?)\s*["'](.+)["']$/);
  if (quoted) return { role: quoted[1]!.trim().replace(/:$/, ""), name: quoted[2]!.trim() };
  const colon = entry.match(/^([^:]+):\s*(.+)$/);
  if (colon) return { role: colon[1]!.trim(), name: colon[2]!.trim() };
  return { role: entry.trim() };
}

function roleKey(role: string, name: string | undefined): string {
  return name ? `${role}\u0000${name}` : role;
}

function formatLocatorInventory(inventory: LocatorInventory): string {
  const lines = ["", "Allowed observed locators:"];
  if (inventory.roles?.length) lines.push(`- Roles: ${inventory.roles.join(", ")}`);
  if (inventory.labels?.length) lines.push(`- Labels: ${inventory.labels.join(", ")}`);
  if (inventory.testIds?.length) lines.push(`- Test IDs: ${inventory.testIds.join(", ")}`);
  if (inventory.texts?.length) lines.push(`- Text: ${inventory.texts.join(", ")}`);
  lines.push("- Do not invent locators outside this observed set unless the plan explicitly says to discover them first.");
  return lines.join("\n");
}

function buildGenerateRepairPrompt(basePrompt: string, source: string, diagnostics: string[]): string {
  return [
    basePrompt,
    "",
    "Previous generator diagnostics:",
    ...diagnostics.map((d) => `- ${d}`),
    "",
    "Previous generated source:",
    "```ts",
    source.trim(),
    "```",
    "",
    "Regenerate the full TypeScript Playwright spec. Fix every diagnostic. Output only one ```ts code block.",
  ].join("\n");
}

function normalizeMaxAttempts(value: number | undefined): number {
  if (!Number.isFinite(value)) return 2;
  return Math.max(1, Math.floor(value!));
}

function resolveDefaultProvider(env: Record<string, string | undefined>): NonNullable<GeneratorModelOptions["provider"]> {
  const fromEnv = env.VLMKIT_LLM_PROVIDER;
  if (fromEnv) {
    if (fromEnv === "anthropic" || fromEnv === "gemini" || fromEnv === "openrouter") return fromEnv;
    throw new Error(`Invalid VLMKIT_LLM_PROVIDER: ${fromEnv}`);
  }
  if (env.ANTHROPIC_API_KEY) return "anthropic";
  if (env.OPENROUTER_API_KEY) return "openrouter";
  if (env.GEMINI_API_KEY || env.GOOGLE_AI_API_KEY) return "gemini";
  return "openrouter";
}
