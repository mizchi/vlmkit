# Brief: one Lomuto partition step

Produce `scene.json` (kind `array`) that explains **one partition pass** of
quicksort (Lomuto scheme) on `[7, 2, 9, 4, 3, 8, 5]` with the last element,
`5`, as the pivot.

Write the ops **by hand** (no `algorithm` fits this): two named pointers,
`i` (the boundary of the "smaller than pivot" region, starting before the
array is fine as `i = 0` meaning "next slot to fill") and `j` (the scanning
pointer). For each `j` from 0 to 5: compare `a[j]` with the pivot; when it is
smaller, swap it into position `i` and advance `i`. Finally swap the pivot
into position `i` and mark it as being in its final place. Every beat needs a
caption that says what is being compared and why the swap does or does not
happen; use `window` or `highlight` if it helps show the "smaller" region.

Success: `vlmkit-anim check scene.json` exits 0 with no ✗ and no ⚠; the final
row reads `2, 4, 3, 5, 7, 8, 9` (or any order with every value left of 5
smaller and every value right of 5 larger, with 5 marked), and
`vlmkit-anim explain scene.json` reads as a lesson on partitioning.
