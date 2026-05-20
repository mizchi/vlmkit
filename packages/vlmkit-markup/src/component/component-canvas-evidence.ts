import type { Page } from "playwright";
import type { UiCanvasContract } from "../contract/ui-contract.ts";
import type { ComponentCanvasEvidence } from "./component-goal.ts";

interface CanvasStateSnapshot {
  present: boolean;
  serialized: string | null;
  fields: string[];
}

export async function captureCanvasEvidence(
  page: Page,
  contract: UiCanvasContract | undefined,
): Promise<ComponentCanvasEvidence | undefined> {
  const first = await readCanvasFrame(page);
  if (!first || first.canvasCount === 0) return undefined;
  await page.waitForTimeout(120);
  const second = await readCanvasFrame(page);
  let inputResponsive: boolean | null = null;
  const stateHook = contract?.stateHook ?? "window.__gameState";
  const beforeState = await readCanvasState(page, stateHook);
  if (beforeState.serialized !== null) {
    await page.keyboard.press("ArrowRight").catch(() => {});
    await page.waitForTimeout(60);
    const afterState = await readCanvasState(page, stateHook);
    inputResponsive = afterState.serialized !== null ? afterState.serialized !== beforeState.serialized : null;
  }
  const requiredStateFields = contract?.requiredStateFields ?? [];
  const missingStateFields = requiredStateFields.filter((field) => !beforeState.fields.includes(field));
  const shouldReportHook = contract?.stateHook !== undefined || beforeState.present || requiredStateFields.length > 0;
  return {
    canvasCount: first.canvasCount,
    nonblank: first.nonblank,
    frameDelta: second ? first.checksum !== second.checksum : false,
    inputResponsive,
    ...(shouldReportHook ? { stateHook, stateHookPresent: beforeState.present } : {}),
    ...(requiredStateFields.length > 0 ? { requiredStateFields } : {}),
    ...(beforeState.fields.length > 0 ? { observedStateFields: beforeState.fields } : {}),
    ...(requiredStateFields.length > 0 ? { missingStateFields } : {}),
  };
}

async function readCanvasState(page: Page, stateHook: string): Promise<CanvasStateSnapshot> {
  const snapshot = await page.evaluate((hook): CanvasStateSnapshot => {
    const state = resolveHook(hook);
    if (state === undefined || state === null) return { present: false, serialized: null, fields: [] };
    const fields = state && typeof state === "object" && !Array.isArray(state)
      ? Object.keys(state as Record<string, unknown>)
      : [];
    try {
      return { present: true, serialized: JSON.stringify(state), fields };
    } catch {
      return { present: true, serialized: String(state), fields };
    }

    function resolveHook(path: string): unknown {
      const normalized = path.trim();
      const parts = normalized === "window"
        ? ["window"]
        : normalized.startsWith("window.")
          ? normalized.split(".")
          : normalized.startsWith("globalThis.")
            ? normalized.split(".")
            : ["window", normalized];
      let cursor: unknown = window;
      for (const part of parts[0] === "window" || parts[0] === "globalThis" ? parts.slice(1) : parts) {
        if (cursor === undefined || cursor === null || typeof cursor !== "object") return undefined;
        cursor = (cursor as Record<string, unknown>)[part];
      }
      return cursor;
    }
  }, stateHook).catch(() => undefined);
  return snapshot ?? { present: false, serialized: null, fields: [] };
}

async function readCanvasFrame(
  page: Page,
): Promise<{ canvasCount: number; checksum: number; nonblank: boolean } | undefined> {
  return await page.evaluate(() => {
    const canvases = Array.from(document.querySelectorAll("canvas")) as HTMLCanvasElement[];
    if (canvases.length === 0) {
      return { canvasCount: 0, checksum: 0, nonblank: false };
    }
    const canvas = canvases[0]!;
    const ctx = canvas.getContext("2d");
    if (!ctx || canvas.width <= 0 || canvas.height <= 0) {
      return { canvasCount: canvases.length, checksum: 0, nonblank: false };
    }
    const width = Math.min(canvas.width, 1280);
    const height = Math.min(canvas.height, 720);
    const data = ctx.getImageData(0, 0, width, height).data;
    let checksum = 0;
    let nonblank = false;
    for (let i = 0; i < data.length; i += 32) {
      const r = data[i] ?? 0;
      const g = data[i + 1] ?? 0;
      const b = data[i + 2] ?? 0;
      const a = data[i + 3] ?? 0;
      checksum = (checksum + r * 3 + g * 5 + b * 7 + a) >>> 0;
      if (a !== 0 && (r !== 0 || g !== 0 || b !== 0)) nonblank = true;
    }
    return { canvasCount: canvases.length, checksum, nonblank };
  }).catch(() => undefined);
}
