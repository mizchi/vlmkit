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
  bind(...values: unknown[]): {
    run(): Promise<unknown>;
  };
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
  };
}
