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
- `toHaveScreenshot` を含むテストは baseline が無いと落ちる。
- **baseline は CI が source of truth**（Docker は使わない）。push して `update-baselines`
  workflow を回すと CI 環境で baseline を生成してコミットする。
- ローカルで `pnpm exec playwright test --update-snapshots` は確認用に撮って良いが、
  ローカル(例: -darwin)スナップショットは**コミットしない**（CI と一致しない）。

## 再現性の定義
- 生成テストは「連続2回 green」で初めて合格とみなす（`pnpm run verify`）。
