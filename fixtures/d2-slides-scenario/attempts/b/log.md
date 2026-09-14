# Round Log

## Round 1
**Change**: Initial deck build with all 7 slides

**Errors encountered**:
1. D2 syntax: `timeline:` is not a valid D2 construct
2. D2 syntax: underscore references at root level (`_.api`) are not allowed

**Gate results**:
1. check integrity (index.html): CLEAN
2. check integrity (print.html --viewports 1280): CLEAN
3. check copy --manifest: missing 0
4. check a11y contrast: 0 failures

**Issue found**: "MPL-2.0" string was in D2 diagram but not extracted to copy.txt (markdown formatting with `**` prevented extraction)

**Quote**: The skill doc notes: "copy-invisible (reason: unknown) on a line that is plainly on the slide → a vlmkit gate limitation" — this taught me that inline markup can cause text extraction to fail, though the solution here was to move the required string to plain Markdown prose.

**Fix applied**: Moved "MPL-2.0" string to Markdown prose on the TALA slide: "TALA is **MPL-2.0** and bundled with D2."

## Round 2 (after fix)
**All gates pass**:
1. check integrity (index.html): CLEAN
2. check integrity (print.html --viewports 1280): CLEAN  
3. check copy --manifest: missing 0
4. check a11y contrast: 0 failures (67 elements inspected)

**All required strings present**:
- "Diagrams that live in the repo" ✓
- "MPL-2.0" ✓
- "not in the diff" ✓
- "creates a new shape" ✓
- "whiteboard-style" ✓

**Figures present**:
- Slide 1: Title (no figure)
- Slide 2: The problem (figure showing reasons)
- Slide 3: What D2 is (D2 process diagram)
- Slide 4: Why TALA matters (layout engines)
- Slide 5: The one thing that bites (container phantom boxes)
- Slide 6: The loop (list, no figure)
- Slide 7: Closing (no figure)

**Result**: DONE CONDITION MET. Build exits 0, all 4 gates pass.
