import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  analyzeResponsiveSnapshot,
  countUnknownContrastFailures,
  isActionableResponsiveIssue,
  isRecord,
  isResponsiveIssueLike,
  isResponsiveSnapshotLike,
} from "./spec-checks.ts";

export interface ContrastSidecarSummary {
  sampleCount: number;
  failureCount: number;
}

export interface ResponsiveSidecarSummary {
  snapshotCount: number;
  issueCount: number;
}

export async function readContrastSidecars(
  snapshotDir: string,
  entries: string[]
): Promise<Map<string, ContrastSidecarSummary>> {
  const summaries = new Map<string, ContrastSidecarSummary>();
  for (const file of entries.filter((f) => f.endsWith(".contrast.json"))) {
    const testId = file.replace(/\.contrast\.json$/, "");
    const raw = JSON.parse(await readFile(join(snapshotDir, file), "utf-8"));
    const summary = parseContrastSidecar(raw);
    if (summary) summaries.set(testId, summary);
  }
  return summaries;
}

function parseContrastSidecar(raw: unknown): ContrastSidecarSummary | undefined {
  if (Array.isArray(raw)) {
    return { sampleCount: raw.length, failureCount: countUnknownContrastFailures(raw, true) };
  }
  if (!isRecord(raw)) return undefined;

  const failures = Array.isArray(raw.failures) ? raw.failures : undefined;
  const samples = Array.isArray(raw.samples)
    ? raw.samples
    : Array.isArray(raw.contrastSamples)
      ? raw.contrastSamples
      : undefined;
  const totalText = typeof raw.totalText === "number" ? raw.totalText : undefined;
  if (failures === undefined && samples === undefined && totalText === undefined) {
    return undefined;
  }

  return {
    sampleCount: totalText ?? samples?.length ?? failures?.length ?? 0,
    failureCount: failures?.length ?? countUnknownContrastFailures(samples ?? [], false),
  };
}

export async function readResponsiveSidecars(
  snapshotDir: string,
  entries: string[]
): Promise<Map<string, ResponsiveSidecarSummary>> {
  const summaries = new Map<string, ResponsiveSidecarSummary>();
  for (const file of entries.filter((f) => f.endsWith(".responsive.json"))) {
    const testId = file.replace(/\.responsive\.json$/, "");
    const raw = JSON.parse(await readFile(join(snapshotDir, file), "utf-8"));
    const summary = parseResponsiveSidecar(raw);
    if (summary) summaries.set(testId, summary);
  }
  return summaries;
}

function parseResponsiveSidecar(raw: unknown): ResponsiveSidecarSummary | undefined {
  const snapshots = normalizeResponsiveSnapshots(raw);
  const findings = normalizeResponsiveFindings(raw);
  if (snapshots.length === 0 && findings.length === 0) {
    return undefined;
  }
  const detectedIssues = snapshots.flatMap(analyzeResponsiveSnapshot);
  return {
    snapshotCount: snapshots.length,
    issueCount: findings.filter(isActionableResponsiveIssue).length
      + detectedIssues.filter(isActionableResponsiveIssue).length,
  };
}

function normalizeResponsiveSnapshots(raw: unknown) {
  const values = Array.isArray(raw)
    ? raw
    : isRecord(raw) && Array.isArray(raw.snapshots)
      ? raw.snapshots
      : isRecord(raw) && Array.isArray(raw.viewports)
        ? raw.viewports
        : [];
  return values.filter(isResponsiveSnapshotLike);
}

function normalizeResponsiveFindings(raw: unknown) {
  const values = isRecord(raw) && Array.isArray(raw.findings)
    ? raw.findings
    : isRecord(raw) && Array.isArray(raw.issues)
      ? raw.issues
      : [];
  return values.filter(isResponsiveIssueLike);
}
