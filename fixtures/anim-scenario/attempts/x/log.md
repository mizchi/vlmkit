# Re-edit task: matrix-pivot

## Initial Understanding (before first check)

### What the scene does
The original scene shows Gaussian elimination on a 3×3 system:
1. Highlights column x (the pivot column)
2. Identifies that r0 has 0 in column x, so it cannot be the pivot
3. Swaps r0 and r1 so the pivot (value 3) is now in row 0
4. Marks the pivot cell [0,0]
5. Clears column x in row 2 ([1,1,1,6]) by removing 1/3 of the pivot row from it

After the swap, grid positions are:
- Row 0: [3, 1, 0, 5] (original r1, the pivot row)
- Row 1: [0, 2, 1, 4] (original r0)
- Row 2: [1, 1, 1, 6] (original r2)

### Change: which [row, col] and why
The README asks to clear the MIDDLE row (original r0) instead of the bottom row (original r2):
- **Remove ops 5-8**: `set` operations on row 2 (cells [2,0], [2,1], [2,2], [2,3])
- **Add new op**: `set` operation on row 1, cell [1,0] = 0, with caption explaining that row 1 is already clear (the x entry is already 0)

### Why this mapping
After swap:
- Row 1 is the middle row (original r0: [0, 2, 1, 4])
- It already has 0 in column x (column 0)
- The caption should explain this instead of narrating a computation

### Expected final grid (all three rows)
- Row 0: [3, 1, 0, 5] (pivot row, unchanged)
- Row 1: [0, 2, 1, 4] (marked as clear - no changes needed since x entry is already 0)
- Row 2: [1, 1, 1, 6] (unchanged)

All cells stay exactly as they were after the swap operation.

## Round 1: First Edit and Check

### First Check Output
```
✓ matrix-pivot.scene.json (matrix): 0 error(s), 0 warning(s)
  4500ms · 9 steps (7 captioned) · 24 nodes · 7 tracks / 24 keyframes
```

✓ PASSED on first attempt - no errors or warnings!

### Changes Made
- **Removed**: ops 5-8 (four `set` operations on row 2)
- **Added**: single `set` operation on cell [1, 0] with caption explaining row is already clear

### Explain Output (Step 7)
```
 7. [ 3060ms] r0 already has 0 in column x: no elimination needed for the middle row
```

Caption reads correctly, referencing the original r0 now in the middle position after swap.

### Final Grid (from SVG, top to bottom by Y coordinate):
- **Top row (Y=85)**: r1 → [3, 1, 0, 5] (pivot marked)
- **Middle row (Y=119)**: r0 → [0, 2, 1, 4] ✓
- **Bottom row (Y=153)**: r2 → [1, 1, 1, 6] ✓

## Success Criteria Met
✓ `check` exits 0 with no errors or warnings
✓ `explain` reads coherently
✓ Middle row reads [0, 2, 1, 4] as required
✓ Bottom row still reads [1, 1, 1, 6] as required
✓ Swap and mark preserved
✓ Initial cells not modified
✓ Row reference [1, 0] correctly targets middle row after swap

**Status: GREEN on first attempt**
