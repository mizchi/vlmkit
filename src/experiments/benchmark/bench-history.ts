import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { PrescannerTrialSummary } from "@mizchi/vlmkit-capture/prescanner.ts";

export type BenchHistoryBackend = "chromium" | "crater" | "prescanner";

export interface BenchHistoryRecord {
  runId: string;
  fixture: string;
  backend: BenchHistoryBackend;
  trials: number;
  startSeed: number;
  elapsedMs: number;
  avgMsPerTrial: number;
  llmEnabled: boolean;
  strict: boolean;
  suggestApproval: boolean;
  approvalPath?: string;
  visualDetected: number;
  computedDetected: number;
  hoverDetected: number;
  paintTreeDetected: number;
  a11yDetected: number;
  eitherDetected: number;
  neitherDetected: number;
  detectionRate: number;
  prescanner: PrescannerTrialSummary | null;
}

export interface BenchHistoryRecordInput {
  runId: string;
  fixture: string;
  backend: BenchHistoryBackend;
  trials: number;
  startSeed: number;
  elapsedMs: number;
  llmEnabled: boolean;
  strict: boolean;
  suggestApproval: boolean;
  approvalPath?: string;
  visualDetected: number;
  computedDetected: number;
  hoverDetected: number;
  paintTreeDetected: number;
  a11yDetected: number;
  eitherDetected: number;
  neitherDetected: number;
  prescanner?: PrescannerTrialSummary | null;
}

export interface BenchBackendStats {
  count: number;
  latest: BenchHistoryRecord;
  bestAvgMsPerTrial: number;
  bestDetectionRate: number;
}

export interface ComparableBenchSpeedup {
  fixture: string;
  trials: number;
  startSeed: number;
  chromiumAvgMsPerTrial: number;
  prescannerAvgMsPerTrial: number;
  speedup: number;
  chromiumRunId: string;
  prescannerRunId: string;
}

export interface BenchHistoryStats {
  totalRuns: number;
  byBackend: Map<BenchHistoryBackend, BenchBackendStats>;
  comparableSpeedups: ComparableBenchSpeedup[];
}

export interface BenchGoalTargets {
  prescannerDetectionRate: number;
  prescannerSpeedup: number;
}

export interface BenchRateGoalProgress {
  latestRate: number;
  bestRate: number;
  targetRate: number;
  gap: number;
  passed: boolean;
  runId: string;
}

export interface BenchSpeedupGoalProgress {
  latestSpeedup: number;
  bestSpeedup: number;
  targetSpeedup: number;
  gap: number;
  passed: boolean;
  fixture: string;
  chromiumRunId: string;
  prescannerRunId: string;
}

export interface BenchGoalProgress {
  prescannerDetection?: BenchRateGoalProgress;
  prescannerSpeedup?: BenchSpeedupGoalProgress;
}

export interface BenchDetectionSeriesPoint {
  runId: string;
  createdAt: string;
  fixture: string;
  backend: BenchHistoryBackend;
  trials: number;
  detected: number;
  detectionRate: number;
  avgMsPerTrial: number;
}

export interface BenchDetectionSeries {
  total: number;
  points: BenchDetectionSeriesPoint[];
}

export interface BenchDetectionSeriesOptions {
  backend?: BenchHistoryBackend;
  fixture?: string;
  limit?: number;
}

const DEFAULT_GOAL_TARGETS: BenchGoalTargets = {
  prescannerDetectionRate: 0.8,
  prescannerSpeedup: 3,
};

function metricGap(target: number, current: number): number {
  return Number(Math.max(0, target - current).toFixed(6));
}

export function getBenchHistoryPath(): string {
  return join(import.meta.dirname!, "..", "..", "..", "data", "bench-history.jsonl");
}

export function buildBenchHistoryRecord(input: BenchHistoryRecordInput): BenchHistoryRecord {
  return {
    ...input,
    avgMsPerTrial: input.trials === 0 ? 0 : input.elapsedMs / input.trials,
    detectionRate: input.trials === 0 ? 0 : input.eitherDetected / input.trials,
    prescanner: input.prescanner ?? null,
  };
}

export function getBenchGoalProgress(
  stats: BenchHistoryStats,
  targets: BenchGoalTargets = DEFAULT_GOAL_TARGETS,
): BenchGoalProgress {
  const progress: BenchGoalProgress = {};
  const prescannerStats = stats.byBackend.get("prescanner");

  if (prescannerStats) {
    const latestRate = prescannerStats.latest.detectionRate;
    progress.prescannerDetection = {
      latestRate,
      bestRate: prescannerStats.bestDetectionRate,
      targetRate: targets.prescannerDetectionRate,
      gap: metricGap(targets.prescannerDetectionRate, latestRate),
      passed: latestRate >= targets.prescannerDetectionRate,
      runId: prescannerStats.latest.runId,
    };
  }

  const latestSpeedup = stats.comparableSpeedups[0];
  if (latestSpeedup) {
    const bestSpeedup = stats.comparableSpeedups.reduce(
      (best, speedup) => Math.max(best, speedup.speedup),
      latestSpeedup.speedup,
    );
    progress.prescannerSpeedup = {
      latestSpeedup: latestSpeedup.speedup,
      bestSpeedup,
      targetSpeedup: targets.prescannerSpeedup,
      gap: metricGap(targets.prescannerSpeedup, latestSpeedup.speedup),
      passed: latestSpeedup.speedup >= targets.prescannerSpeedup,
      fixture: latestSpeedup.fixture,
      chromiumRunId: latestSpeedup.chromiumRunId,
      prescannerRunId: latestSpeedup.prescannerRunId,
    };
  }

  return progress;
}

export function buildBenchDetectionSeries(
  records: BenchHistoryRecord[],
  options: BenchDetectionSeriesOptions = {},
): BenchDetectionSeries {
  const filtered = records.filter((record) => {
    if (options.backend && record.backend !== options.backend) return false;
    if (options.fixture && record.fixture !== options.fixture) return false;
    return true;
  });
  const sortedLatestFirst = [...filtered].sort((a, b) => b.runId.localeCompare(a.runId));
  const limit = Math.max(1, Math.min(options.limit ?? 100, 1000));
  const selected = sortedLatestFirst
    .slice(0, limit)
    .sort((a, b) => a.runId.localeCompare(b.runId));

  return {
    total: filtered.length,
    points: selected.map((record) => ({
      runId: record.runId,
      createdAt: record.runId,
      fixture: record.fixture,
      backend: record.backend,
      trials: record.trials,
      detected: record.eitherDetected,
      detectionRate: record.detectionRate,
      avgMsPerTrial: record.avgMsPerTrial,
    })),
  };
}

export async function appendBenchHistory(
  records: BenchHistoryRecord[],
  historyPath = getBenchHistoryPath(),
): Promise<void> {
  if (records.length === 0) return;
  await mkdir(dirname(historyPath), { recursive: true });
  const lines = records.map((record) => JSON.stringify(record)).join("\n") + "\n";
  await appendFile(historyPath, lines, "utf-8");
}

export async function readBenchHistory(
  historyPath = getBenchHistoryPath(),
): Promise<BenchHistoryRecord[]> {
  let content: string;
  try {
    content = await readFile(historyPath, "utf-8");
  } catch {
    return [];
  }

  const records: BenchHistoryRecord[] = [];
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object" && typeof parsed.runId === "string") {
        records.push(parsed as BenchHistoryRecord);
      }
    } catch {
      // skip malformed lines
    }
  }
  return records;
}

export function getBenchHistoryStats(
  records: BenchHistoryRecord[],
): BenchHistoryStats {
  const byBackend = new Map<BenchHistoryBackend, BenchBackendStats>();

  for (const record of records) {
    const current = byBackend.get(record.backend);
    if (!current) {
      byBackend.set(record.backend, {
        count: 1,
        latest: record,
        bestAvgMsPerTrial: record.avgMsPerTrial,
        bestDetectionRate: record.detectionRate,
      });
      continue;
    }

    current.count += 1;
    if (record.runId > current.latest.runId) {
      current.latest = record;
    }
    current.bestAvgMsPerTrial = Math.min(current.bestAvgMsPerTrial, record.avgMsPerTrial);
    current.bestDetectionRate = Math.max(current.bestDetectionRate, record.detectionRate);
  }

  const comparable = new Map<string, { chromium?: BenchHistoryRecord; prescanner?: BenchHistoryRecord }>();
  for (const record of records) {
    if (record.backend !== "chromium" && record.backend !== "prescanner") continue;
    const key = [
      record.fixture,
      record.trials,
      record.startSeed,
      record.strict ? "strict" : "default",
      record.approvalPath ?? "",
    ].join("|");
    const entry = comparable.get(key) ?? {};
    const existing = record.backend === "chromium" ? entry.chromium : entry.prescanner;
    if (!existing || record.runId > existing.runId) {
      if (record.backend === "chromium") entry.chromium = record;
      else entry.prescanner = record;
    }
    comparable.set(key, entry);
  }

  const comparableSpeedups: ComparableBenchSpeedup[] = [...comparable.values()]
    .filter((entry): entry is { chromium: BenchHistoryRecord; prescanner: BenchHistoryRecord } =>
      !!entry.chromium && !!entry.prescanner,
    )
    .map((entry) => ({
      fixture: entry.chromium.fixture,
      trials: entry.chromium.trials,
      startSeed: entry.chromium.startSeed,
      chromiumAvgMsPerTrial: entry.chromium.avgMsPerTrial,
      prescannerAvgMsPerTrial: entry.prescanner.avgMsPerTrial,
      speedup: entry.prescanner.avgMsPerTrial === 0
        ? 0
        : entry.chromium.avgMsPerTrial / entry.prescanner.avgMsPerTrial,
      chromiumRunId: entry.chromium.runId,
      prescannerRunId: entry.prescanner.runId,
    }))
    .sort((a, b) => b.prescannerRunId.localeCompare(a.prescannerRunId));

  return {
    totalRuns: records.length,
    byBackend,
    comparableSpeedups,
  };
}
