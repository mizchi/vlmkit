# Modules Diff Figure — Writer Log

## What I Read

1. **Brief** (`briefs/modules-diff-figure.md`): Create an `after.json` module map showing changes from the input map:
   - Add new module `search`
   - Add dependencies: `api → search`, `search → db`
   - Remove module `cache` and dependency `api → cache`
   - Move `auth` from `core` container to new `identity` container
   - Relabel `logging` label from "logging" to "logs" (id stays `logging`)
   - Success: diff passes fact sheet check, after.json validates cleanly, SVG shows search/identity in accent color and cache dashed grey

2. **Input map** (`inputs/modules-diff-before.json`): Six modules in three groups; structure to apply changes to

3. **Fact sheet** (`facts/modules-diff-figure.expect.json`): Expected changes with added/removed/moved/relabeled fields

4. **Writing guide** (`docs/anim-ir.md`): 
   - Modules kind uses `modules`, `deps`, `groups`, optional `sequence`
   - Modules can have `label` different from `id`
   - Groups container modules; a module is in at most one group
   - Module can have `tone: "accent"` for highlighting
   - Dependencies use `["from", "to"]` shorthand or object with `style`, `label`, `tone`
   - Dependencies rendered as arrows or lines; `"style": "line"` removes arrowhead

5. **CLI schemas**: 
   - `schema --kind modules`: Shows structure and fields
   - `schema --kind expect`: Shows fact sheet format (modules, deps, forbidden, highlighted, groups)
   - `schema --kind diff`: Shows diff sheet format (added, removed, moved, relabelled)

## Round 1: Initial `after.json` and Diff Validation

**Command:**
```bash
pnpm exec vlmkit-anim diff fixtures/anim-scenario/briefs/inputs/modules-diff-before.json fixtures/anim-scenario/attempts/ob/after.json --out fixtures/anim-scenario/attempts/ob/change.svg
```

**Output:**
```
+1 module (search) · +2 deps (api->search, search->db) · +1 group (identity) · −1 module (cache) · −1 dep (api->cache) · 1 moved (auth: core → identity) · 1 relabelled (logging: "logging" → "logs")
wrote fixtures/anim-scenario/attempts/ob/change.svg
```

**Result:** Diff generated successfully. Output shows all expected changes.

---

**Command:**
```bash
pnpm exec vlmkit-anim check fixtures/anim-scenario/attempts/ob/after.json
```

**Output:**
```
✓ after.json (modules): 0 error(s), 0 warning(s)
  560ms · 2 steps (1 captioned) · 24 nodes · 0 tracks / 0 keyframes
  scene 578 B (minified) → timeline 3768 B (×6.5)
```

**Result:** Scene validates with no errors or warnings. ✓

---

**Command:**
```bash
pnpm exec vlmkit-anim diff fixtures/anim-scenario/briefs/inputs/modules-diff-before.json fixtures/anim-scenario/attempts/ob/after.json --expect fixtures/anim-scenario/briefs/facts/modules-diff-figure.expect.json
```

**Output:**
```
+1 module (search) · +2 deps (api->search, search->db) · +1 group (identity) · −1 module (cache) · −1 dep (api->cache) · 1 moved (auth: core → identity) · 1 relabelled (logging: "logging" → "logs")
✓ the change is what modules-diff-figure.expect.json says
```

**Result:** Diff matches fact sheet exactly. ✓

---

## Brief's Success Condition Verification

**1. `diff --expect` exits 0:** ✓ Verified above.

**2. `check after.json` exits 0 with no ✗ and no ⚠:** ✓ Verified above.

**3. Visual appearance in `change.svg`:**

Examined SVG line by line:
- **search module** (line 24): `fill="#f59e0b"` — accent (orange) color ✓
- **identity group** (lines 11-12): `stroke="#f59e0b"` — accent (orange) border ✓
- **cache module** (line 28): `stroke="#9ca3af"` — grey color ✓
- **cache dependency edge** (line 21): `stroke-dasharray="6 4"` — dashed ✓
- **cache placement**: Within infrastructure container (positioned at y=403, same as other infra items db and logging) ✓

**Change notation text** (lines 32-40 in SVG): The figure displays on the right side:
- "+1 module · +2 deps · +1 group"
- "−1 module · −1 dep"
- "1 moved · 1 relabelled"
- "accent: added or moved"
- "dashed grey: removed"

This notation correctly explains the visual encoding. ✓

---

## Key Findings

**Printed change line from diff command:**
```
+1 module (search) · +2 deps (api->search, search->db) · +1 group (identity) · −1 module (cache) · −1 dep (api->cache) · 1 moved (auth: core → identity) · 1 relabelled (logging: "logging" → "logs")
```

**Did it match what I meant?** Yes. This line exactly corresponds to the changes requested in the brief:
- Added: search module, two edges (api→search, search→db), identity group
- Removed: cache module, one edge (api→cache)
- Moved: auth from core to identity
- Relabeled: logging's label from "logging" to "logs"

**SVG visual confirmation:**
- `search` and `identity` both in accent color (orange #f59e0b) as required
- `cache` drawn with grey stroke and dashed edge as required
- All dependencies correctly positioned (api→search→db connections visible)
- `auth` visually in the new `identity` container (positioned on the left separately from core)
- `logging` now displays as "logs" in the infrastructure group

**What was expressible in the scene format:**
The modules kind fully supports what the brief required:
- Module with custom label: `{"id": "auth", "label": "auth service"}`
- Relabeled module: `{"id": "logging", "label": "logs"}`
- New group: `{"id": "identity", "label": "identity", "modules": ["auth"]}`
- Simplified dependency syntax: `["web", "api"]` for basic arrows
- Styled dependency: `{"from": "api", "to": "logging", "style": "line", "label": "emits"}`

No limitations encountered; all intent expressed directly.

---

## Friction

**None.** The writing guide `docs/anim-ir.md` was sufficient:

1. The modules kind schema showed all required fields clearly (modules, deps, groups, layout, sequence)
2. The fact sheet schema showed what changes `diff` checks for (added, removed, moved, relabelled)
3. The diff example in the schema README section (`vlmkit-anim diff before.json after.json --out d.svg`) was exactly what I needed
4. The object/array dual syntax for dependencies was shown: both `["a", "b"]` shorthand and `{"from": "a", "to": "b", "style": "…"}` detailed form
5. Group nesting and module-to-group assignment was clear
6. Custom labels (different from id) were shown in the input example
7. The relabel in the fact sheet was self-explanatory: `[{"id": "logging", "from": "logging", "to": "logs"}]`

No guessing was needed. No examples outside the guide were consulted. The schema outputs for `modules`, `expect`, and `diff` were exactly what was referenced in the guide and contained all necessary information.

The guide's organization—starting with "The loop", then "Two layers", then each kind with schema boxes and examples—made it easy to find what I needed quickly without reading the entire 28k-token document.
