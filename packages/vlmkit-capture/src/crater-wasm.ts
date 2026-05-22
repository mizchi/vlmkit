import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const CRATER_WASM_MODULE_ENV = "VLMKIT_CRATER_WASM_MODULE";

export interface CraterWasmViewport {
  width: number;
  height: number;
  label?: string;
}

export interface CraterBoxRect {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface CraterLayoutNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  margin: CraterBoxRect;
  padding: CraterBoxRect;
  border: CraterBoxRect;
  children: CraterLayoutNode[];
}

export interface CraterLayoutRootBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CraterLayoutDiagnostics {
  nodeCount: number;
  maxDepth: number;
  rootBox: CraterLayoutRootBox;
}

export interface CraterWasmRenderRequest {
  html: string;
  viewport: CraterWasmViewport;
}

export interface CraterWasmRenderResult {
  backend: "crater-wasm";
  viewport: CraterWasmViewport;
  layout: CraterLayoutNode;
  rawJson: string;
  elapsedMs: number;
  diagnostics: CraterLayoutDiagnostics;
}

export interface CraterWasmModule {
  renderHtmlToJsonForWpt(
    html: string,
    width: number,
    height: number,
  ): string | Promise<string>;
}

export interface CraterWasmLayoutBackend {
  kind: "crater-wasm-layout";
  renderLayout(request: CraterWasmRenderRequest): Promise<CraterWasmRenderResult>;
}

export interface LoadCraterWasmModuleOptions {
  modulePath?: string;
  env?: Partial<Record<typeof CRATER_WASM_MODULE_ENV | "CRATER_WASM_MODULE", string | undefined>>;
  cwd?: string;
}

export function createCraterWasmLayoutBackend(
  module: CraterWasmModule,
): CraterWasmLayoutBackend {
  assertCraterWasmModule(module);
  return {
    kind: "crater-wasm-layout",
    async renderLayout(request) {
      if (typeof request.html !== "string") {
        throw new Error("Crater WASM render request requires html");
      }
      const viewport = normalizeViewport(request.viewport);
      const started = Date.now();
      const rawJson = await module.renderHtmlToJsonForWpt(
        request.html,
        viewport.width,
        viewport.height,
      );
      if (typeof rawJson !== "string") {
        throw new Error("Crater WASM renderHtmlToJsonForWpt must return a JSON string");
      }
      const layout = normalizeCraterLayoutJson(rawJson);
      return {
        backend: "crater-wasm",
        viewport,
        layout,
        rawJson,
        elapsedMs: Date.now() - started,
        diagnostics: summarizeCraterLayout(layout),
      };
    },
  };
}

export async function loadCraterWasmModule(
  options: LoadCraterWasmModuleOptions = {},
): Promise<CraterWasmModule> {
  const modulePath = options.modulePath
    ?? options.env?.[CRATER_WASM_MODULE_ENV]
    ?? options.env?.CRATER_WASM_MODULE;
  if (!modulePath) {
    throw new Error(`${CRATER_WASM_MODULE_ENV} is required to load the Crater WASM backend`);
  }
  const loaded = await import(toImportSpecifier(modulePath, options.cwd));
  return assertCraterWasmModule(loaded);
}

export function normalizeCraterLayoutJson(raw: string | unknown): CraterLayoutNode {
  const value = typeof raw === "string" ? parseLayoutJson(raw) : raw;
  return normalizeCraterLayoutNode(value, "$");
}

export function summarizeCraterLayout(layout: CraterLayoutNode): CraterLayoutDiagnostics {
  let nodeCount = 0;
  let maxDepth = 0;

  function visit(node: CraterLayoutNode, depth: number): void {
    nodeCount += 1;
    maxDepth = Math.max(maxDepth, depth);
    for (const child of node.children) {
      visit(child, depth + 1);
    }
  }

  visit(layout, 1);
  return {
    nodeCount,
    maxDepth,
    rootBox: {
      x: layout.x,
      y: layout.y,
      width: layout.width,
      height: layout.height,
    },
  };
}

function parseLayoutJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch (error) {
    throw new Error(`Invalid Crater layout JSON: ${errorMessage(error)}`);
  }
}

function normalizeCraterLayoutNode(value: unknown, path: string): CraterLayoutNode {
  const record = asRecord(value, path);
  const children = record.children;
  if (!Array.isArray(children)) {
    throw new Error(`${path} missing children array`);
  }
  return {
    id: readString(record, "id", path),
    x: readNumber(record, "x", path),
    y: readNumber(record, "y", path),
    width: readNumber(record, "width", path),
    height: readNumber(record, "height", path),
    margin: normalizeBoxRect(record.margin, `${path}.margin`),
    padding: normalizeBoxRect(record.padding, `${path}.padding`),
    border: normalizeBoxRect(record.border, `${path}.border`),
    children: children.map((child, index) => normalizeCraterLayoutNode(child, `${path}.children[${index}]`)),
  };
}

function normalizeBoxRect(value: unknown, path: string): CraterBoxRect {
  const record = asRecord(value, path);
  return {
    top: readNumber(record, "top", path),
    right: readNumber(record, "right", path),
    bottom: readNumber(record, "bottom", path),
    left: readNumber(record, "left", path),
  };
}

function normalizeViewport(viewport: CraterWasmViewport): CraterWasmViewport {
  if (!viewport || typeof viewport !== "object") {
    throw new Error("Crater WASM render request requires viewport");
  }
  const width = Number(viewport.width);
  const height = Number(viewport.height);
  if (!Number.isFinite(width) || width <= 0) {
    throw new Error("Crater WASM viewport.width must be a positive number");
  }
  if (!Number.isFinite(height) || height <= 0) {
    throw new Error("Crater WASM viewport.height must be a positive number");
  }
  return {
    width,
    height,
    ...(typeof viewport.label === "string" ? { label: viewport.label } : {}),
  };
}

function readString(record: Record<string, unknown>, key: string, path: string): string {
  const value = record[key];
  if (typeof value !== "string") {
    throw new Error(`${path} missing string ${key}`);
  }
  return value;
}

function readNumber(record: Record<string, unknown>, key: string, path: string): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${path} missing numeric ${key}`);
  }
  return value;
}

function asRecord(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${path} must be an object`);
  }
  return value as Record<string, unknown>;
}

function assertCraterWasmModule(value: unknown): CraterWasmModule {
  const record = asRecord(value, "Crater WASM module");
  const render = record.renderHtmlToJsonForWpt;
  if (typeof render !== "function") {
    throw new Error("Crater WASM module must export renderHtmlToJsonForWpt(html, width, height)");
  }
  return {
    renderHtmlToJsonForWpt: render as CraterWasmModule["renderHtmlToJsonForWpt"],
  };
}

function toImportSpecifier(modulePath: string, cwd = process.cwd()): string {
  if (isUrlSpecifier(modulePath) || isBareSpecifier(modulePath)) {
    return modulePath;
  }
  return pathToFileURL(resolve(cwd, modulePath)).href;
}

function isUrlSpecifier(value: string): boolean {
  return /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value);
}

function isBareSpecifier(value: string): boolean {
  return !value.startsWith(".") && !value.startsWith("/") && !value.startsWith("~");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
