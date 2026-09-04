# Brief: show what easing means

Produce `scene.json` (kind `vector`) with three circles in a row that all
travel the same distance to the right in the same 1.2 seconds, one `linear`,
one `ease-in`, one `ease-out`, each labelled with its easing name, then all
three return together. Caption the moments so a reader learns what each curve
feels like.

Success: `vlmkit anim check scene.json` exits 0 with no ✗ and no ⚠.
