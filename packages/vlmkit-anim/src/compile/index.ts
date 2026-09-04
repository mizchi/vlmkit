/**
 * Scene → Timeline. Validates first: compiling an invalid scene would throw
 * from deep inside a kind's compiler with a message about `undefined`, which
 * is exactly the kind of error the validator exists to replace.
 */

import type { Diagnostic, Scene, Timeline } from "../types.ts";
import { hasErrors, validateScene } from "../validate.ts";
import { compileArray } from "./array.ts";
import { compileChart } from "./chart.ts";
import { compileDiagram } from "./diagram.ts";
import { compileDistributed } from "./distributed.ts";
import { compileGraph } from "./graph.ts";
import { compileHeap } from "./heap.ts";
import { compileMatrix } from "./matrix.ts";
import { compileSort } from "./sort.ts";
import { compileStateMachine } from "./state-machine.ts";
import { compileTree } from "./tree.ts";
import { compileVector } from "./vector.ts";

export class SceneValidationError extends Error {
  override readonly name = "SceneValidationError";
  readonly diagnostics: Diagnostic[];
  constructor(diagnostics: Diagnostic[]) {
    super(`scene has ${diagnostics.filter((d) => d.severity === "error").length} validation error(s)`);
    this.diagnostics = diagnostics;
  }
}

export function compileScene(scene: Scene): Timeline {
  const diags = validateScene(scene);
  if (hasErrors(diags)) throw new SceneValidationError(diags);
  switch (scene.kind) {
    case "diagram": return compileDiagram(scene);
    case "state-machine": return compileStateMachine(scene);
    case "sort": return compileSort(scene);
    case "array": return compileArray(scene);
    case "heap": return compileHeap(scene);
    case "tree": return compileTree(scene);
    case "distributed": return compileDistributed(scene);
    case "matrix": return compileMatrix(scene);
    case "graph": return compileGraph(scene);
    case "chart": return compileChart(scene);
    case "vector": return compileVector(scene);
  }
}

export { compileArray, compileChart, compileDiagram, compileDistributed, compileGraph, compileHeap, compileMatrix, compileSort, compileStateMachine, compileTree, compileVector };
export { generateSortOps } from "./sort.ts";
export { generateArrayOps } from "./array.ts";
export { generateGraphOps } from "./graph.ts";
export { niceMax } from "./chart.ts";
