// A scene written in TypeScript: `vlmkit-anim check fixtures/sort-insertion.scene.ts`.
// The constructor fills in `format` and `kind`; the editor completes the rest.
import { scene } from "@mizchi/vlmkit-anim";

export default scene.sort({
  title: "Insertion sort",
  algorithm: "insertion",
  values: [5, 3, 8, 1, 4],
});
