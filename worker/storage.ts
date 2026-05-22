export interface WorkerR2BucketLike {
  put(
    key: string,
    value: string | ArrayBuffer | Uint8Array,
    options?: {
      httpMetadata?: { contentType?: string };
      customMetadata?: Record<string, string>;
    },
  ): Promise<void>;
}

export interface WorkerKVNamespaceLike {
  put(key: string, value: string): Promise<void>;
}

export interface WorkerD1PreparedStatementLike {
  bind(...values: unknown[]): WorkerD1BoundStatementLike;
}

export interface WorkerD1BoundStatementLike {
  run(): Promise<unknown>;
  all?(): Promise<{ results?: unknown[] }>;
}

export interface WorkerD1Like {
  exec(query: string): Promise<unknown>;
  prepare(query: string): WorkerD1PreparedStatementLike;
}

export interface WorkerStorageEnv {
  VRT_ARTIFACTS?: WorkerR2BucketLike;
  VRT_INDEX?: WorkerKVNamespaceLike;
  VRT_DB?: WorkerD1Like;
}

export interface WorkerStorageCapabilities {
  r2: boolean;
  kv: boolean;
  d1: boolean;
  available: boolean;
}

export interface WorkerArtifactRecord {
  runId: string;
  runType: string;
  artifactKind: string;
  artifactPath: string;
  r2Key: string;
  kvKey: string;
  contentType: string;
  createdAt: string;
}

export interface WorkerExecutionResultRecord {
  runId: string;
  runType: string;
  latestCreatedAt: string;
  artifactCount: number;
  artifactKinds: string[];
  artifacts: WorkerArtifactRecord[];
}

export interface ListWorkerExecutionResultsInput {
  q?: string;
  runType?: string;
  artifactKind?: string;
  limit?: number;
  offset?: number;
}

export interface WorkerExecutionResultsResponse {
  total: number;
  results: WorkerExecutionResultRecord[];
}

export type WorkerVisualDiffAssetRole = "baseline" | "current" | "heatmap" | "triptych";
export type WorkerVisualDiffMode = "side-by-side" | "heatmap" | "overlay" | "triptych";

export interface WorkerVisualDiffAssets {
  baseline?: WorkerArtifactRecord;
  current?: WorkerArtifactRecord;
  heatmap?: WorkerArtifactRecord;
  triptych?: WorkerArtifactRecord;
}

export interface WorkerVisualDiffDisplayRecord {
  runId: string;
  runType: string;
  displayKey: string;
  latestCreatedAt: string;
  availableModes: WorkerVisualDiffMode[];
  assets: WorkerVisualDiffAssets;
}

export interface WorkerVisualDiffDisplaysResponse {
  total: number;
  results: WorkerVisualDiffDisplayRecord[];
}

export interface PutWorkerJsonArtifactInput {
  runId: string;
  runType: string;
  artifactKind: string;
  artifactPath: string;
  payload: unknown;
  contentType?: string;
  createdAt?: string;
}

export function detectWorkerStorageCapabilities(env: WorkerStorageEnv): WorkerStorageCapabilities {
  const r2 = Boolean(env.VRT_ARTIFACTS);
  const kv = Boolean(env.VRT_INDEX);
  const d1 = Boolean(env.VRT_DB);
  return {
    r2,
    kv,
    d1,
    available: r2 || kv || d1,
  };
}

export function normalizeWorkerArtifactPath(path: string): string {
  const segments = path
    .split("/")
    .filter(Boolean)
    .reduce<string[]>((parts, segment) => {
      if (segment === ".") return parts;
      if (segment === "..") {
        parts.pop();
        return parts;
      }
      parts.push(segment);
      return parts;
    }, []);
  return segments.join("/");
}

export function buildWorkerArtifactKey(input: {
  runId: string;
  artifactKind: string;
  artifactPath: string;
}): string {
  return [
    "runs",
    input.runId,
    input.artifactKind,
    normalizeWorkerArtifactPath(input.artifactPath),
  ].join("/");
}

export function buildWorkerArtifactIndexKey(input: {
  runId: string;
  artifactKind: string;
  artifactPath: string;
}): string {
  return [
    "artifacts",
    input.runId,
    input.artifactKind,
    normalizeWorkerArtifactPath(input.artifactPath),
  ].join(":");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function readString(record: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string") return value;
  }
  return "";
}

export function normalizeWorkerArtifactRecord(row: unknown): WorkerArtifactRecord | null {
  if (!isRecord(row)) return null;
  const runId = readString(row, "runId", "run_id");
  const runType = readString(row, "runType", "run_type");
  const artifactKind = readString(row, "artifactKind", "artifact_kind");
  const artifactPath = readString(row, "artifactPath", "artifact_path");
  const r2Key = readString(row, "r2Key", "r2_key");
  const contentType = readString(row, "contentType", "content_type");
  const createdAt = readString(row, "createdAt", "created_at");
  if (!runId || !runType || !artifactKind || !artifactPath || !r2Key || !contentType || !createdAt) {
    return null;
  }
  return {
    runId,
    runType,
    artifactKind,
    artifactPath,
    r2Key,
    kvKey: readString(row, "kvKey", "kv_key") || buildWorkerArtifactIndexKey({ runId, artifactKind, artifactPath }),
    contentType,
    createdAt,
  };
}

function artifactMatchesQuery(
  record: WorkerArtifactRecord,
  query: ListWorkerExecutionResultsInput,
): boolean {
  if (query.runType && record.runType !== query.runType) return false;
  if (query.artifactKind && record.artifactKind !== query.artifactKind) return false;
  const q = query.q?.trim().toLowerCase();
  if (!q) return true;
  return [
    record.runId,
    record.runType,
    record.artifactKind,
    record.artifactPath,
    record.r2Key,
  ].some((value) => value.toLowerCase().includes(q));
}

export function buildWorkerExecutionResults(
  records: WorkerArtifactRecord[],
  query: ListWorkerExecutionResultsInput = {},
): WorkerExecutionResultsResponse {
  const matchingRunIds = new Set(
    records.filter((record) => artifactMatchesQuery(record, query)).map((record) => record.runId),
  );
  const grouped = new Map<string, WorkerArtifactRecord[]>();
  for (const record of records) {
    if (!matchingRunIds.has(record.runId)) continue;
    const list = grouped.get(record.runId) ?? [];
    list.push(record);
    grouped.set(record.runId, list);
  }

  const allResults = [...grouped.entries()].map(([runId, artifacts]) => {
    const sortedArtifacts = [...artifacts].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const latest = sortedArtifacts[0]!;
    return {
      runId,
      runType: latest.runType,
      latestCreatedAt: latest.createdAt,
      artifactCount: sortedArtifacts.length,
      artifactKinds: [...new Set(sortedArtifacts.map((record) => record.artifactKind))].sort(),
      artifacts: sortedArtifacts,
    };
  }).sort((a, b) => b.latestCreatedAt.localeCompare(a.latestCreatedAt));

  const offset = Math.max(0, query.offset ?? 0);
  const limit = Math.max(1, Math.min(query.limit ?? 50, 500));
  return {
    total: allResults.length,
    results: allResults.slice(offset, offset + limit),
  };
}

function artifactPathBasename(path: string): string {
  return path.split("/").filter(Boolean).at(-1) ?? path;
}

export function inferWorkerVisualDiffAssetRole(
  record: WorkerArtifactRecord,
): WorkerVisualDiffAssetRole | null {
  const kind = record.artifactKind.toLowerCase();
  const base = artifactPathBasename(record.artifactPath).toLowerCase();
  if (kind.includes("baseline") || /(?:^|[-_.])baseline\.png$/.test(base)) return "baseline";
  if (kind.includes("current") || kind.includes("variant") || /(?:^|[-_.])(current|variant)\.png$/.test(base)) {
    return "current";
  }
  if (kind.includes("heatmap") || /(?:^|[-_.])heatmap\.png$/.test(base)) return "heatmap";
  if (kind.includes("triptych") || /(?:^|[-_.])triptych\.png$/.test(base)) return "triptych";
  return null;
}

function inferWorkerVisualDiffDisplayKey(record: WorkerArtifactRecord, role: WorkerVisualDiffAssetRole): string {
  const base = artifactPathBasename(record.artifactPath).replace(/\.[^.]+$/, "");
  switch (role) {
    case "baseline":
      return base.replace(/[-_.]?baseline$/i, "");
    case "current":
      return base.replace(/[-_.]?(current|variant)$/i, "");
    case "heatmap":
      return base.replace(/[-_.]?heatmap$/i, "");
    case "triptych":
      return base.replace(/[-_.]?triptych$/i, "");
  }
}

function visualDiffMatchesQuery(
  record: WorkerArtifactRecord,
  displayKey: string,
  query: ListWorkerExecutionResultsInput,
): boolean {
  if (query.runType && record.runType !== query.runType) return false;
  if (query.artifactKind && record.artifactKind !== query.artifactKind) return false;
  const q = query.q?.trim().toLowerCase();
  if (!q) return true;
  return [
    record.runId,
    record.runType,
    record.artifactKind,
    record.artifactPath,
    record.r2Key,
    displayKey,
  ].some((value) => value.toLowerCase().includes(q));
}

export function buildWorkerVisualDiffDisplays(
  records: WorkerArtifactRecord[],
  query: ListWorkerExecutionResultsInput = {},
): WorkerVisualDiffDisplaysResponse {
  const visualRecords = records.flatMap((record) => {
    const role = inferWorkerVisualDiffAssetRole(record);
    if (!role) return [];
    return [{ record, role, displayKey: inferWorkerVisualDiffDisplayKey(record, role) }];
  });
  const matchingKeys = new Set(
    visualRecords
      .filter((entry) => visualDiffMatchesQuery(entry.record, entry.displayKey, query))
      .map((entry) => `${entry.record.runId}:${entry.displayKey}`),
  );
  const grouped = new Map<string, {
    runId: string;
    runType: string;
    displayKey: string;
    records: Array<{ record: WorkerArtifactRecord; role: WorkerVisualDiffAssetRole }>;
  }>();
  for (const entry of visualRecords) {
    const key = `${entry.record.runId}:${entry.displayKey}`;
    if (!matchingKeys.has(key)) continue;
    const group = grouped.get(key) ?? {
      runId: entry.record.runId,
      runType: entry.record.runType,
      displayKey: entry.displayKey,
      records: [],
    };
    group.records.push({ record: entry.record, role: entry.role });
    grouped.set(key, group);
  }

  const allResults = [...grouped.values()].map((group) => {
    const sorted = [...group.records].sort((a, b) => b.record.createdAt.localeCompare(a.record.createdAt));
    const assets: WorkerVisualDiffAssets = {};
    for (const entry of sorted) {
      assets[entry.role] ??= entry.record;
    }
    const availableModes: WorkerVisualDiffMode[] = [];
    if (assets.heatmap) availableModes.push("heatmap");
    if (assets.current && assets.heatmap) availableModes.push("overlay");
    if (assets.baseline && assets.current) availableModes.push("side-by-side");
    if (assets.triptych) availableModes.push("triptych");
    return {
      runId: group.runId,
      runType: group.runType,
      displayKey: group.displayKey,
      latestCreatedAt: sorted[0]?.record.createdAt ?? "",
      availableModes,
      assets,
    };
  }).filter((entry) => entry.availableModes.length > 0)
    .sort((a, b) => b.latestCreatedAt.localeCompare(a.latestCreatedAt));

  const offset = Math.max(0, query.offset ?? 0);
  const limit = Math.max(1, Math.min(query.limit ?? 50, 500));
  return {
    total: allResults.length,
    results: allResults.slice(offset, offset + limit),
  };
}

async function listD1ArtifactRecords(env: WorkerStorageEnv): Promise<WorkerArtifactRecord[]> {
  if (!env.VRT_DB) return [];
  const statement = env.VRT_DB.prepare(`
    SELECT
      run_id,
      run_type,
      artifact_kind,
      artifact_path,
      r2_key,
      content_type,
      created_at
    FROM vrt_artifacts
    ORDER BY created_at DESC
    LIMIT ?
  `).bind(1000);
  const rows = await statement.all?.();
  return (rows?.results ?? [])
    .map(normalizeWorkerArtifactRecord)
    .filter((record): record is WorkerArtifactRecord => Boolean(record));
}

export function createWorkerStorage(env: WorkerStorageEnv) {
  return {
    capabilities: detectWorkerStorageCapabilities(env),
    async ensureSchema() {
      if (!env.VRT_DB) return;
      await env.VRT_DB.exec(`
        CREATE TABLE IF NOT EXISTS vrt_artifacts (
          run_id TEXT NOT NULL,
          run_type TEXT NOT NULL,
          artifact_kind TEXT NOT NULL,
          artifact_path TEXT NOT NULL,
          r2_key TEXT NOT NULL,
          content_type TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
      `);
    },
    async putJsonArtifact(input: PutWorkerJsonArtifactInput): Promise<WorkerArtifactRecord> {
      const contentType = input.contentType ?? "application/json";
      const createdAt = input.createdAt ?? new Date().toISOString();
      const artifactPath = normalizeWorkerArtifactPath(input.artifactPath);
      const r2Key = buildWorkerArtifactKey({
        runId: input.runId,
        artifactKind: input.artifactKind,
        artifactPath,
      });
      const kvKey = buildWorkerArtifactIndexKey({
        runId: input.runId,
        artifactKind: input.artifactKind,
        artifactPath,
      });
      const payloadText = JSON.stringify(input.payload, null, 2);
      const record: WorkerArtifactRecord = {
        runId: input.runId,
        runType: input.runType,
        artifactKind: input.artifactKind,
        artifactPath,
        r2Key,
        kvKey,
        contentType,
        createdAt,
      };

      if (env.VRT_ARTIFACTS) {
        await env.VRT_ARTIFACTS.put(r2Key, payloadText, {
          httpMetadata: { contentType },
          customMetadata: {
            runId: input.runId,
            runType: input.runType,
            artifactKind: input.artifactKind,
            artifactPath,
          },
        });
      }

      if (env.VRT_INDEX) {
        await env.VRT_INDEX.put(kvKey, JSON.stringify(record));
      }

      if (env.VRT_DB) {
        await env.VRT_DB.prepare(`
          INSERT INTO vrt_artifacts (
            run_id,
            run_type,
            artifact_kind,
            artifact_path,
            r2_key,
            content_type,
            created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(
          input.runId,
          input.runType,
          input.artifactKind,
          artifactPath,
          r2Key,
          contentType,
          createdAt,
        ).run();
      }

      return record;
    },
    async listExecutionResults(
      input: ListWorkerExecutionResultsInput = {},
    ): Promise<WorkerExecutionResultsResponse> {
      return buildWorkerExecutionResults(await listD1ArtifactRecords(env), input);
    },
    async listVisualDiffDisplays(
      input: ListWorkerExecutionResultsInput = {},
    ): Promise<WorkerVisualDiffDisplaysResponse> {
      return buildWorkerVisualDiffDisplays(await listD1ArtifactRecords(env), input);
    },
  };
}
