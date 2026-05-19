# AI mock to markup flow for blog design

作成日: 2026-05-19

## 目的

ブログの見た目を AI に複数案出させ、その中から選んだ mock image を
visual target として固定し、vlmkit の `build component` / `diff` /
`snapshot` で実際の HTML/CSS に収束させる。

このフローでは AI 画像を「完成物」ではなく「視覚ゴール」として扱う。
本番に入るのは HTML/CSS と VRT baseline で、生成画像は design reference
として保存する。

将来的には HTML/CSS を直接の編集対象にせず、UI Contract DSL を編集し、
そこから semantic HTML / CSS grid / subgrid / tokens を生成する。
詳細は `docs/ui-contract-dsl-moonbit-renderer.md`。

## ディレクトリ規約

```text
design-runs/blog-YYYYMMDD/
  brief.md
  ui.contract.json
  prompts/
    mock-v1.md
    mock-v2.md
    implement.md
  mocks/
    v1-desktop.png
    v1-mobile.png
    v2-desktop.png
    v2-mobile.png
  target/
    desktop.png
    mobile.png
    decision.md
  implementation/
    page.html
    style.css
  reports/
    desktop/
      report.md
      current.png
      target.png
      component_heatmap.png
    mobile/
      report.md
      current.png
      target.png
      component_heatmap.png
  snapshots/
    snapshot-report.json
```

## Phase 1: brief を固定する

`brief.md` に、AI が勝手に変えてはいけないものを書く。

```md
# Blog design brief

## Content
- Blog name: Memory Atlas
- Top page sections: header, hero, featured post, article list, newsletter
- Tone: quiet technical writing, personal notes, long-form readable
- Must support desktop and mobile

## Visual constraints
- Avoid marketing landing-page hero
- Prioritize reading, scanning, archive navigation
- Typography must be clear for Japanese and English
- Cards: only for repeated post items
- No decorative gradient blobs

## Layout contract
- Page shell: display grid, bounded by explicit min/max width
- Main content: fluid within max-width; avoid fixed desktop-only widths
- Side rail: bounded width; stack under content on mobile
- Scroll regions: name any independently scrolling panels
- Alignment: prefer CSS grid/subgrid track alignment over absolute placement

## Deliverables
- desktop mock: 1536x1024
- mobile mock: 1024x1536
```

## Phase 2: AI mock を複数回出す

Codex の `image_gen` または API の `gpt-image-2` で mock を生成する。
1 回で決めず、v1/v2/v3 のように案を残す。

### Mock prompt template

```text
Use case: ui-mockup
Asset type: blog design mock, visual target for HTML/CSS implementation
Primary request: Create a polished blog homepage mock for the brief below.
Audience: technical readers who scan archives and read long posts.
Layout: actual usable blog homepage, not a marketing landing page.
Required sections: header, hero/introduction, featured post, article list, newsletter.
Responsive target: <desktop 1536x1024 | mobile 1024x1536>.
Text: use short realistic English labels only; keep text readable; avoid tiny paragraphs.
Style: quiet editorial SaaS-like interface, strong typography, restrained palette,
clear spacing, no decorative blobs, no fake browser chrome.
Layout contract: express the page as CSS grid/subgrid-friendly regions; include
fluid containers with min/max width, fixed side rails only when bounded, and name
any independent scroll regions.
Brief:
<paste brief.md>
```

### Review rule

各案に対して `decision.md` に残す。

```md
# Mock decision

Selected: v2

Keep:
- Dense archive navigation
- Featured post hierarchy
- Narrow reading column

Change during implementation:
- Replace generated logo with text
- Use real article titles
- Simplify newsletter block

Reject:
- v1: too much landing-page composition
- v3: weak mobile navigation
```

選んだ案を `target/desktop.png` と `target/mobile.png` にコピーする。

## Phase 3: markup scaffold を作る

最初は空に近い HTML でよい。重要なのは、AI mock を直接画像として貼らず、
semantic HTML と CSS で再構成すること。

```bash
mkdir -p design-runs/blog-YYYYMMDD/implementation
touch design-runs/blog-YYYYMMDD/implementation/page.html
touch design-runs/blog-YYYYMMDD/implementation/style.css
```

最低限の `page.html`:

```html
<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Memory Atlas</title>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <header></header>
    <main></main>
  </body>
</html>
```

既存実装や scaffold から編集時メタデータを起こす場合:

```bash
vlmkit contract introspect \
  design-runs/blog-YYYYMMDD/implementation/page.html \
  --screen-id blog-home \
  --viewport desktop:1536x1024 \
  --viewport mobile:432x911@2 \
  --out design-runs/blog-YYYYMMDD/ui.contract.json

vlmkit contract validate design-runs/blog-YYYYMMDD/ui.contract.json
```

`ui.contract.json` は CSS の代替ではなく、agent が編集する layout contract として
保持する。`fluid unbounded` や scrollport 不明などの validation issue は、
CSS を直接直す前に design decision として解決する。

## Phase 4: target PNG に HTML/CSS を近づける

desktop と mobile を別々に回す。

```bash
vlmkit build component \
  design-runs/blog-YYYYMMDD/target/desktop.png \
  design-runs/blog-YYYYMMDD/implementation/page.html \
  --goal app \
  --output-dir design-runs/blog-YYYYMMDD/reports/desktop

vlmkit build component \
  design-runs/blog-YYYYMMDD/target/mobile.png \
  design-runs/blog-YYYYMMDD/implementation/page.html \
  --goal app \
  --output-dir design-runs/blog-YYYYMMDD/reports/mobile
```

vlmkit の repo 内で未ビルドのまま dogfood する場合は、bin がまだ存在しない
ことがある。その場合は同じ CLI を TypeScript entry から直接実行する。

```bash
node src/cli/vlmkit.ts build component \
  design-runs/blog-YYYYMMDD/target/desktop.png \
  design-runs/blog-YYYYMMDD/implementation/page.html \
  --goal app \
  --output-dir design-runs/blog-YYYYMMDD/reports/desktop
```

### `--threshold` と `--goal` を分ける

`--threshold` は pixelmatch の感度であり、成果物として何%の diff ratio を
許容するかではない。AI mock から実用可能なアプリへ収束させるときは、
`--goal` で合格基準を選ぶ。

| Goal | Primary | Pass | Review | 用途 |
|---|---|---|---|---|
| `app` | landscape | landscape <= 3%, pixel <= 25% | landscape <= 5%, pixel <= 35% | AI mock を実用可能なアプリに落とす既定値 |
| `layout` | landscape | landscape <= 3% | landscape <= 5% | レイアウト/ランドマークだけを先に合わせる |
| `pixel` | pixel | pixel <= 3%, landscape <= 1% | pixel <= 8%, landscape <= 3% | Figma export や deterministic UI の再現 |
| `draft` | landscape | landscape <= 6%, pixel <= 35% | landscape <= 8%, pixel <= 45% | 早い mock 探索 |

このフローの現実的な初期値は `--goal app`。ピクセルパーフェクトではなく、
「使える画面として成立し、主要ランドマークが近い場所にあり、過剰な空白や
大きな欠落がない」ことを pass とする。pixel diff は文字内容、生成画像の
装飾、アンチエイリアス、アイコン差分に引っ張られるので、まず primary は
`Landscape diff` に置く。

`report.md` の見る順番:

1. DPR hint: mobile mock が 2x/3x なら `--dpr` を指定する
2. Landscape diff: 大きな地形が合っているか
3. Landmark drilldown: semantic landmark ごとに layout lane と decoration lane を分ける
4. Layout contract columns: width / height / scroll / grid が意図どおりか
5. BBox deltas: block の幅・高さ・位置のズレ
6. Heatmap regions: どの領域が外れているか
7. Palette diff: 背景色、カード色、アクセント色
8. Text rows / typography: 行位置、サイズ、太さ

周回ごとの収束目標の目安:

| Round | 目標 |
|---|---|
| 1 | 大枠の layout を合わせる |
| 2 | spacing / card size / color を合わせる |
| 3 | typography / mobile wrapping を合わせる |
| 4+ | `--goal app` pass を狙う |

完全一致は目標にしない。AI mock は文字や細部が不安定なので、まず
`Landscape diff` と `Landmark drilldown` の layout lane を下げる。
layout lane ではまず `min-width` / `max-width`, scrollport, grid/subgrid track
を直す。layout lane が安定してから decoration lane の palette / media / text を詰める。
pixel diff は最後の確認用に扱い、semantic HTML として自然な範囲で一致させる。

`app` goal を pass した後も pixel diff が高い場合は、画面としての実用性を
先に確認する。以下を満たすなら、その時点で通常の実装レビューへ進めてよい。

- header / main / rail / footer などの landmark が target と同じ構造で読める
- mobile first viewport に主要 CTA と主要セクションが入る
- 余白、カードサイズ、列幅が破綻していない
- 文字が収まり、操作要素が十分なサイズである
- 装飾差分が layout lane を汚していない

## Phase 5: 通常の VRT baseline に昇格する

HTML/CSS が target に十分近づいたら、ここからは生成画像ではなく実装済み UI
を baseline として管理する。

ローカルサーバを立てるか、file URL を使って snapshot を作る。

```bash
vlmkit snapshot \
  file://$PWD/design-runs/blog-YYYYMMDD/implementation/page.html \
  --label blog-home \
  --output design-runs/blog-YYYYMMDD/snapshots
```

以後の変更は通常の regression flow に乗せる。

```bash
vlmkit snapshot \
  file://$PWD/design-runs/blog-YYYYMMDD/implementation/page.html \
  --label blog-home \
  --output design-runs/blog-YYYYMMDD/snapshots \
  --fail-on-diff \
  --max-diff-ratio 0.01

vlmkit snapshot fix-prompt \
  --output design-runs/blog-YYYYMMDD/snapshots \
  --out design-runs/blog-YYYYMMDD/reports/fix-prompt.md
```

## Agent loop

実装 agent に渡す prompt:

```text
Implement the blog homepage in implementation/page.html and implementation/style.css.
Use target/desktop.png and target/mobile.png as visual goals.
Do not paste the generated mock as an image.
Use semantic HTML, responsive CSS, and real readable text.

After each edit, run:
- vlmkit build component target/desktop.png implementation/page.html --output-dir reports/desktop
- vlmkit build component target/mobile.png implementation/page.html --output-dir reports/mobile

Read report.md, current.png, target.png, and component_heatmap.png.
Iterate until the layout is visually close enough and the remaining differences are acceptable.
```

## 将来の CLI 化案

今の既存コマンドだけでも回せるが、正式化するなら次の command group が自然。

```bash
vlmkit design init blog-home
vlmkit design mock blog-home --brief brief.md --variants 3
vlmkit design select blog-home mocks/v2-desktop.png mocks/v2-mobile.png
vlmkit design build blog-home
vlmkit design verify blog-home
vlmkit design promote blog-home
```

内部的には新しい rendering engine は不要で、既存の
`image_gen` / `build component` / `snapshot` / `fix-prompt` を束ねるだけでよい。

## 注意点

- AI mock は細かい文字やアイコンが崩れる。文字は実装時に正しい content に置き換える。
- mobile と desktop は別 target PNG にする。1 枚の desktop mock から responsive を推測しすぎない。
- mock 画像を `<img>` で貼って完成扱いにしない。
- 収束判断は pixel-perfect ではなく、layout / typography / hierarchy の一致を見る。
- 最終的な品質ゲートは `snapshot`, `check a11y`, `check tokens`, `check perf` に渡す。
