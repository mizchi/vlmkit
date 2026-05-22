import type { ExecutionContext } from "hono";
import { createApiApp } from "../src/api/api-app.ts";
import { createWorkerStorage, detectWorkerStorageCapabilities, type WorkerStorageEnv } from "./storage.ts";

export type VrtWorkerEnv = WorkerStorageEnv;

export default {
  fetch(request: Request, env: VrtWorkerEnv, executionCtx: ExecutionContext) {
    const storage = createWorkerStorage(env);
    const app = createApiApp({
      serverUrl: new URL(request.url).origin,
      resolveStorageStatus: () => detectWorkerStorageCapabilities(env),
      listExecutionResults: env.VRT_DB ? (query) => storage.listExecutionResults(query) : undefined,
      listVisualDiffDisplays: env.VRT_DB ? (query) => storage.listVisualDiffDisplays(query) : undefined,
    });
    return app.fetch(request, env, executionCtx);
  },
};
