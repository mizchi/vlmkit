/**
 * The typed authoring surface produces exactly the JSON documents the format
 * defines — nothing more — and the CLI accepts a module in place of a file.
 */
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { defineScene, scene, sceneFromModule, sceneJson } from "./author.ts";
import { compileScene } from "./compile/index.ts";
import { EXAMPLES } from "./schema-sheet.ts";
import { SCENE_FORMAT, SCENE_KINDS, type Scene } from "./types.ts";
import { hasErrors, validateScene } from "./validate.ts";

const constructorFor = (kind: Scene["kind"]) => (kind === "state-machine" ? scene.stateMachine : scene[kind as Exclude<Scene["kind"], "state-machine">]);

describe("scene.<kind>()", () => {
  it("has one constructor per kind, each filling format + kind and passing the body through", () => {
    assert.equal(Object.keys(scene).length, SCENE_KINDS.length);
    for (const kind of SCENE_KINDS) {
      const example = EXAMPLES[kind] as Scene;
      const { format: _f, kind: _k, ...body } = example;
      const built = (constructorFor(kind) as (b: unknown) => Scene)(body);
      assert.deepEqual(built, example, kind);
      assert.equal(built.format, SCENE_FORMAT);
      assert.ok(!hasErrors(validateScene(built)), kind);
      compileScene(built);
    }
  });

  it("defineScene is the identity, sceneJson is the file check reads, keys in authoring order", () => {
    const s = defineScene({ format: SCENE_FORMAT, kind: "sort", algorithm: "bubble", values: [2, 1] });
    assert.equal(sceneJson(s), '{\n  "format": "vlmkit-anim/scene@1",\n  "kind": "sort",\n  "algorithm": "bubble",\n  "values": [\n    2,\n    1\n  ]\n}\n');
    assert.deepEqual(JSON.parse(sceneJson(scene.sort({ algorithm: "bubble", values: [2, 1] }))), s);
  });

  it("sceneFromModule takes the default export, then a named `scene`, and names the fix otherwise", () => {
    const s = scene.stack({ ops: [{ push: 1 }] });
    assert.deepEqual(sceneFromModule({ default: s }), { scene: s });
    assert.deepEqual(sceneFromModule({ scene: s }), { scene: s });
    const missing = sceneFromModule({ other: 1 });
    assert.ok("error" in missing && /export default scene\.<kind>/.test(missing.error));
  });
});
