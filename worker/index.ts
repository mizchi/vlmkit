import type { ExecutionContext } from "hono";
import { createApiApp } from "../src/api/api-app.ts";
import { detectWorkerStorageCapabilities, type WorkerStorageEnv } from "./storage.ts";

export type VrtWorkerEnv = WorkerStorageEnv;

export default {
  fetch(request: Request, env: VrtWorkerEnv, executionCtx: ExecutionContext) {
    const app = createApiApp({
      serverUrl: new URL(request.url).origin,
      resolveStorageStatus: () => detectWorkerStorageCapabilities(env),
    });
    return app.fetch(request, env, executionCtx);
  },
};
