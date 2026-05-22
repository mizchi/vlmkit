import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  collectApprovalWarnings,
  mergeApprovalManifest,
  parseApprovalManifest,
  type ApprovalManifest,
  type ApprovalRule,
  type ApprovalWarning,
  validateApprovalManifest,
} from "./approval.ts";

export type ApprovalOperationAction = "add" | "remove";

export interface ApprovalManifestListResponse {
  path: string;
  total: number;
  rules: ApprovalRule[];
  warnings: ApprovalWarning[];
}

export type ApprovalOperationRequest =
  | {
    action: "add";
    rule: ApprovalRule;
    dryRun?: boolean;
  }
  | {
    action: "remove";
    index: number;
    dryRun?: boolean;
  };

export interface ApprovalOperationResponse extends ApprovalManifestListResponse {
  action: ApprovalOperationAction;
  dryRun: boolean;
  beforeCount: number;
  afterCount: number;
  added?: ApprovalRule;
  removed?: ApprovalRule;
}

async function readApprovalManifestOrEmpty(path: string): Promise<ApprovalManifest> {
  try {
    const raw = await readFile(path, "utf-8");
    if (!raw.trim()) return { rules: [] };
    return parseApprovalManifest(raw);
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return { rules: [] };
    }
    throw error;
  }
}

async function writeApprovalManifest(path: string, manifest: ApprovalManifest): Promise<void> {
  validateApprovalManifest(manifest);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(manifest, null, 2) + "\n", "utf-8");
}

function hasApprovalMatcher(rule: ApprovalRule): boolean {
  return Boolean(rule.kind || rule.selector || rule.property || rule.category || rule.changeType);
}

function normalizeApprovalRule(rule: ApprovalRule): ApprovalRule {
  const manifest = validateApprovalManifest({ rules: [rule] });
  const normalized = manifest.rules[0]!;
  if (!hasApprovalMatcher(normalized)) {
    throw new Error("Approval rule must have at least one matcher");
  }
  return normalized;
}

export async function listApprovalManifest(path: string): Promise<ApprovalManifestListResponse> {
  const manifest = await readApprovalManifestOrEmpty(path);
  return {
    path,
    total: manifest.rules.length,
    rules: manifest.rules,
    warnings: collectApprovalWarnings(manifest),
  };
}

export async function applyApprovalOperation(
  path: string,
  operation: ApprovalOperationRequest,
): Promise<ApprovalOperationResponse> {
  const current = await readApprovalManifestOrEmpty(path);
  const beforeCount = current.rules.length;
  const dryRun = operation.dryRun ?? false;
  let next = current;
  let added: ApprovalRule | undefined;
  let removed: ApprovalRule | undefined;

  if (operation.action === "add") {
    added = normalizeApprovalRule(operation.rule);
    next = mergeApprovalManifest(current, [added]);
  } else {
    if (operation.index < 0 || operation.index >= current.rules.length) {
      throw new Error(`No approval rule at index ${operation.index}`);
    }
    const rules = [...current.rules];
    removed = rules.splice(operation.index, 1)[0];
    next = { rules };
  }

  if (!dryRun) {
    await writeApprovalManifest(path, next);
  }

  return {
    path,
    action: operation.action,
    dryRun,
    beforeCount,
    afterCount: next.rules.length,
    added,
    removed,
    total: next.rules.length,
    rules: next.rules,
    warnings: collectApprovalWarnings(next),
  };
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return Boolean(error && typeof error === "object" && "code" in error);
}
