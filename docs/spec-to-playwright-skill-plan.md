# spec-to-playwright Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** Author the `spec-to-playwright` Claude Code skill in vlmkit (`.claude/skills/spec-to-playwright/`), distributed via APM, packaging the spec→test→deterministic-VRT→heal pipeline proven in playwright-playground.

**Architecture:** A self-contained skill (SKILL.md + README.md + assets/) matching the existing `vrt-*` skills' style. Assets are extracted from the playwright-playground reference implementation. Heal step references `@mizchi/vlmkit-heal`.

**Tech Stack:** Markdown (agentskills.io format), TypeScript asset snippets, Playwright, APM.

---

## File Structure

- `.claude/skills/spec-to-playwright/SKILL.md` — workflow body + frontmatter
- `.claude/skills/spec-to-playwright/README.md` — overview (sibling-skill style)
- `.claude/skills/spec-to-playwright/assets/_helpers.ts` — gotoApp determinism layer
- `.claude/skills/spec-to-playwright/assets/seed.spec.ts` — generic seed template
- `.claude/skills/spec-to-playwright/assets/_generation-rules.md` — generator rules
- `.claude/skills/spec-to-playwright/assets/playwright.config.preset.ts` — deterministic config
- `.claude/skills/spec-to-playwright/assets/baseline-linux.sh` — linux baseline container script
- `.claude/skills/spec-to-playwright/assets/ci.yml` — arm64 CI template
- `README.md` (vlmkit root) — add spec-to-playwright to the Agent Skills list

---

## Task 1: assets/ (extracted from playwright-playground)

**Files:** Create the 6 asset files.

- [ ] **Step 1: assets/_helpers.ts** (verbatim from playwright-playground)

```ts
import type { Page } from "@playwright/test";

// Determinism layer for stable VRT. The planner/generator must read this to
// understand the preconditions. Open the app ONLY via gotoApp (never bare goto).
export async function gotoApp(page: Page): Promise<void> {
  await page.goto("/");
  await page.addStyleTag({
    content: `*, *::before, *::after { transition: none !important; animation: none !important; }
              * { caret-color: transparent !important; }`,
  });
  await page.evaluate(() => document.fonts.ready);
}
```

- [ ] **Step 2: assets/seed.spec.ts** (generalized template)

```ts
import { test, expect } from "@playwright/test";
import { gotoApp } from "./_helpers";

// Seed: proves the env boots to a known initial state. The planner runs this to
// understand the environment. Replace the assertions with your app's empty/initial state.
test("seed: app boots", async ({ page }) => {
  await gotoApp(page);
  await expect(page.getByRole("heading").first()).toBeVisible();
});
```

- [ ] **Step 3: assets/_generation-rules.md** (verbatim from playwright-playground)

```markdown
# Generation Rules (generator が必ず守る規約)

テストを生成するとき、以下を厳守する。これは generator agent への強制プロンプト。

## 決定論
- 各テストの冒頭で `import { gotoApp } from "./_helpers"` を使い `await gotoApp(page)` で開く。
  直接 `page.goto` しない（決定論スタイル注入と font 待ちのため）。
- 日時・ランダム・外部ネットワークに依存する検証を書かない。

## VRT (Visual Regression)
- 各シナリオの「開始直後」と「ゴール到達時」に必ず
  `await expect(page).toHaveScreenshot("<NN-step>.png")` を入れる（NN は 01, 02, ... の連番）。
- 動的・可変領域があれば `toHaveScreenshot({ mask: [locator] })` でマスクする。
- VRT は意味的検証の代替ではない。状態は必ず `expect(locator)` でも検証する
  （`toHaveCount` / `toHaveText` 等）。

## セレクタ
- role / testid / label ベースを優先する（`getByRole`, `getByTestId`, `getByLabel`）。
- CSS / xpath の直書きは避ける。

## baseline
- 生成直後に `pnpm run baseline:linux` で baseline を撮りコミットする（CI と arch 一致）。

## 再現性の定義
- 生成テストは「連続2回 green」で初めて合格とみなす（`pnpm run verify`）。
```

- [ ] **Step 4: assets/playwright.config.preset.ts** (deterministic config from playwright-playground)

```ts
import { defineConfig, devices } from "@playwright/test";

// Deterministic VRT preset. Merge into your playwright.config.ts. The webServer
// uses build→preview to avoid HMR script injection. Fixed viewport/locale/tz keep
// screenshots byte-stable across runs.
export default defineConfig({
  testDir: "tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? "blob" : "list",
  webServer: {
    command: "pnpm app:build && pnpm app:preview", // app:preview = vite preview --port 4173 --strictPort
    url: "http://localhost:4173",
    reuseExistingServer: false,
    timeout: 120_000,
  },
  use: {
    baseURL: "http://localhost:4173",
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
    colorScheme: "light",
    locale: "en-US",
    timezoneId: "UTC",
  },
  expect: {
    toHaveScreenshot: { animations: "disabled", maxDiffPixelRatio: 0.01 },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
```

- [ ] **Step 5: assets/baseline-linux.sh** (the fixed container script)

```sh
#!/usr/bin/env sh
# Generate VRT baselines inside the official Playwright linux container so they
# match CI. Key fixes:
#  - `-v /work/node_modules` anonymous volume: keep the host's (darwin) binaries
#    out of the linux container, else `@rollup/rollup-linux-*` is missing.
#  - `--ipc=host`: chromium shared memory.
# Native arch only (do NOT use --platform=linux/amd64 on arm64: emulated chromium SIGKILLs).
set -eu
docker run --rm --network host --ipc=host \
  -v "$PWD":/work -v /work/node_modules -w /work \
  mcr.microsoft.com/playwright:v1.61.1-noble \
  sh -c "corepack enable && pnpm install --frozen-lockfile=false && pnpm exec playwright test --update-snapshots"
```

- [ ] **Step 6: assets/ci.yml** (arm64 runner CI)

```yaml
name: ci
on: [push, pull_request]
jobs:
  e2e:
    # VRT baselines are arch-specific. baseline-linux.sh produces arm64 baselines
    # (native on Apple Silicon); use an arm64 runner so CI matches. If you author
    # baselines on amd64, switch this to ubuntu-latest and regenerate them there.
    runs-on: ubuntu-24.04-arm
    container:
      image: mcr.microsoft.com/playwright:v1.61.1-noble
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 10 }
      - uses: actions/setup-node@v4
        with: { node-version: 24, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec playwright test   # reproducibility: run 1
      - run: pnpm exec playwright test   # reproducibility: run 2
      - uses: actions/upload-artifact@v4
        if: failure()
        with: { name: playwright-report, path: playwright-report/ }
```

- [ ] **Step 7: chmod + commit**

Run: `chmod +x .claude/skills/spec-to-playwright/assets/baseline-linux.sh`
Then: `git add .claude/skills/spec-to-playwright/assets && git commit -m "feat(skill): spec-to-playwright assets from playwright-playground"`

---

## Task 2: SKILL.md

**Files:** Create `.claude/skills/spec-to-playwright/SKILL.md`

- [ ] **Step 1: write SKILL.md** with frontmatter (name, description) and the 5
  sections from the design (When to use, Setup, Run staged, Determinism, Pitfalls,
  Heal). The description triggers on "spec → Playwright test", "deterministic VRT",
  "reproduce generated tests in CI". Include the staged commands, the asset-copy
  setup, `pnpm add -D @mizchi/vlmkit-heal`, the heal() snippet, and the lived
  pitfalls (port 4173, node_modules leak, emulated chromium SIGKILL, MCP reload).
  (Full prose authored at implementation time from the design doc's "SKILL.md
  sections" + "vlmkit-heal integration" + "Pitfalls".)

- [ ] **Step 2: commit** → `git add ... && git commit -m "feat(skill): spec-to-playwright SKILL.md"`

---

## Task 3: README.md

**Files:** Create `.claude/skills/spec-to-playwright/README.md`

- [ ] **Step 1: write README.md** — one-paragraph overview, the `apm install`
  line, the asset list, and a pointer to `docs/spec-to-playwright-skill-design.md`.
  Match the tone of `.claude/skills/vrt-visual-diff/README.md`.

- [ ] **Step 2: commit**

---

## Task 4: Register in vlmkit root README

**Files:** Modify `README.md` (the "Agent Skills (APM)" section, ~line 645)

- [ ] **Step 1:** Update "ships five coding-agent skills" → "six", and add the
  `apm install mizchi/vlmkit/.claude/skills/spec-to-playwright` line + a one-line
  description to the list.

- [ ] **Step 2: commit**

---

## Task 5: Validate

- [ ] **Step 1: frontmatter + files present**

Run: `ls .claude/skills/spec-to-playwright .claude/skills/spec-to-playwright/assets && head -3 .claude/skills/spec-to-playwright/SKILL.md`
Expected: SKILL.md, README.md, assets/ (6 files); frontmatter starts with `---` + `name:`.

- [ ] **Step 2: assets parse** — `npx tsc --noEmit` is not meaningful for loose
  snippets; instead just confirm the .ts assets are syntactically copy-paste-ready
  by eye. Confirm `baseline-linux.sh` is executable (`test -x ...`).

- [ ] **Step 3: final commit if anything outstanding.**

---

## Self-Review

- Spec coverage: placement+name+distribution (Task 1-4), SKILL.md sections (Task 2),
  assets from playwright-playground (Task 1), heal integration (Task 2), README/registration
  (Task 3-4). Validation via empirical is a separate operator-triggered step (design §Validation),
  NOT part of this authoring plan — noted intentionally.
- Placeholders: Task 2 Step 1 defers full prose to authoring time but enumerates exactly
  which design sections to transcribe — acceptable for doc authoring (the content lives in the
  approved design doc), not a code placeholder.
- Consistency: asset filenames identical across plan + design; `pnpm run baseline:linux` /
  `verify` referenced consistently; image tag `v1.61.1-noble` matches in baseline-linux.sh + ci.yml.
