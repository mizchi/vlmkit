# Markup implementation flow

作成日: 2026-05-20

## 目的

AI mock や design reference から実 HTML/CSS へ収束させるとき、vlmkit の
どの機能がどの段階で役に立つかを整理する。

重要なのは pixel perfect ではなく、実用可能な UI として次の性質を満たすこと。

- semantic HTML / landmark に戻せる
- CSS grid / flex / subgrid と min/max 制約で再編集できる
- pattern ごとの source of truth が明確
- layout と decoration を分けて直せる
- agent が report を読んで次の編集を決められる

## Flow overview

| Step | 目的 | 主な vlmkit 機能 | 出力 |
|---|---|---|---|
| 0. Analysis | 実装可能な design envelope を決める | pattern classifier docs, feasibility checklist | `brief.md`, marker / goal 方針 |
| 1. Target setup | mock / target / fixture を固定する | `scan component`, `scan breakpoints` | `target/*.png`, `current.html` |
| 2. First markup | semantic HTML と layout skeleton を作る | marker contract, UI contract IR | landmark / region / scrollport 付き HTML |
| 3. Coarse validation | 大きな構造ズレを潰す | `build component --goal <goal>` | landscape / goal / drilldown report |
| 4. Pattern drilldown | pattern 固有の壊れ方を見る | landing / app-shell / canvas evidence | CTA, scrollport, canvas state の gate |
| 5. Decoration pass | 色・余白・typography を詰める | heatmap, palette, bbox, `check tokens`, `check theme` | local fix hints |
| 6. Stress / interaction | 実利用で壊れる状態を見る | `--states`, `stress`, `inspect`, `check a11y` | hover/focus/i18n/media/input の指摘 |
| 7. Regression | 以後の変更で守る | `snapshot`, `workflow`, `diff-pr`, `manifest` | baseline / approval / CI gate |
| 8. Feedback | 次の mock / prompt / DSL に戻す | report summary, empirical prompt tuning | prompt 修正, IR 更新, follow-up |

## Step 0: analysis before mock

最初に画面の pattern を決める。ここを飛ばすと、実装後半で「画像には近いが
Web として不自然」「VRT は近いが操作できない」というズレが残る。

決めること:

- target viewport / DPR
- pattern: editorial, landing, app-shell, dashboard, canvas, or mixed
- semantic owner: DOM landmark, app shell region, scene graph, or mixed
- typography feasibility: system font で寄せるか、web font を許可するか
- layout policy: grid/flex/subgrid, min/max width, scrollport
- asset policy: real image, generated image, SVG, canvas asset
- validation goal: `app`, `layout`, `landing`, `app-shell`, `canvas`, etc.
- machine-readable markers: CTA, media slot, scrollport, game state hook

役立っている機能:

- `docs/design-pattern-feasibility.md`: pattern ごとの source of truth と
  `--goal` の選択基準。
- `docs/landmark-drilldown-design.md`: layout lane と decoration lane の分離。
- `docs/ui-contract-dsl-moonbit-renderer.md`: 将来の編集時 IR の置き場。

この段階の成果物は `brief.md` に残す。mock prompt にも同じ制約を入れる。

## Step 1: target setup

AI mock は実装の完成物ではなく visual target として固定する。実装対象は
HTML/CSS なので、target と current の対応を最初に明確にする。

推奨ディレクトリ:

```text
design-runs/<name>/
  brief.md
  target/
    desktop.png
    mobile.png
  implementation/
    page.html
    style.css
  reports/
```

役立っている機能:

- `vlmkit scan component <screenshot.png>`:
  full-page mock から大きな component / card / hero を切り出す。
- `vlmkit scan breakpoints <html-file>`:
  既存 HTML や current fixture の responsive breakpoint を把握する。
- canonical command shape:

```sh
vlmkit build component <target.png> <current.html> --goal <goal> --output-dir <dir>
```

注意:

- viewport は target PNG から推定される。
- retina target のときだけ `--dpr 2` / `--device-scale-factor 2` を使い、
  target と current render の DPR を合わせる。
- URL や framework component source を直接渡すより、まず単体で render できる
  HTML fixture に落とす方が agent の修正ループは安定する。

## Step 2: first markup

最初の HTML/CSS は完成度より構造を優先する。

作るもの:

- landmark: `header`, `nav`, `main`, `aside`, `footer`, named `section`
- region marker: `data-primary-cta`, `data-media-slot`, `data-next-section`
- scrollport marker: `data-scrollport="channel-list"` など
- canvas hook: `window.__gameState`
- grid area / minmax / max-width / overflow policy
- typography scale and line-height

この段階で効いているのは vlmkit の CLI そのものより、後段の inspector が
読める形に markup を置くこと。marker がないと report は pixel 差分に戻り、
agent が次の編集を決めにくくなる。

## Step 3: coarse validation

最初の比較は pixel diff ではなく、layout が大きく同じ方向に向いているかを見る。

```sh
vlmkit build component target/desktop.png implementation/page.html \
  --goal landing \
  --output-dir reports/desktop
```

役立っている report:

- `Goal evaluation`: pattern ごとの pass/review/fail。
- `Landscape diff`: 大きな領域配置と情報密度のズレ。
- `Landmark drilldown`: landscape / heatmap を DOM landmark に投影する。
- `Component bbox`: 大きな foreground component の位置と面積。
- `Heatmap regions`: 局所的にどこが違うか。
- `Typography / spacing / palette hints`: 後段の decoration 修正候補。

編集判断:

- landscape が大きい間は grid tracks, section order, width/height policy を直す。
- landmark が違うなら HTML 構造を直す。
- heatmap だけが残るなら decoration pass に進む。

## Step 4: pattern drilldown

pattern ごとに「合っている」の意味が違う。ここが実マークアップで一番効く。

### Editorial / blog

見るもの:

- reading width
- text row count / wrapping
- article card height
- section order
- `banner`, `navigation`, `main`, `complementary`, `contentinfo`

有効な goal:

- 初期: `--goal layout`
- 実用 pass: `--goal app`

### Landing

見るもの:

- first viewport に H1 / offer / CTA / media / next-section hint があるか
- `data-primary-cta`
- `data-media-slot`
- `data-next-section`
- media slot の aspect ratio / crop

有効な goal:

```sh
vlmkit build component target.png current.html --goal landing --output-dir reports/landing
```

実装判断:

- hero 内の app-shell 風 preview は、interactive でない限り media slot。
- preview 内部の channel/message/member scrollport は landing の gate にしない。

### Sidebar app shell

見るもの:

- body ではなく app root が viewport shell になっているか
- rail / sidebar / main / detail の grid area
- independent scrollport
- active / selected / unread / hover / focus-visible state

有効な goal:

```sh
vlmkit build component target.png current.html \
  --goal app-shell \
  --states hover focus-visible \
  --output-dir reports/app-shell
```

特に効いた機能:

- scrollport inspector:
  `overflow`, bbox, `clientHeight`, `scrollHeight`, `ok/broken/empty/missing`
  を出す。

これは pixel diff では見落とす。「見た目は近いが message list が body と一緒に
伸びてしまう」問題を直接指摘できる。

### Canvas / game

見るもの:

- canvas nonblank
- frame delta
- `window.__gameState`
- input response
- HUD readability / overlap
- asset visibility

有効な goal:

```sh
vlmkit build component target.png current.html --goal canvas --output-dir reports/game
```

実装判断:

- static mock は art direction。
- DOM landmark は outer shell / HUD まで。
- sprite, obstacle, parallax, collision は scene graph / state hook 側で見る。
- exact sprite texture や単一 frame の pixel match に寄せすぎない。

## Step 5: decoration pass

layout が安定してから、色・余白・typography を詰める。

役立っている機能:

- heatmap region + dominant target color:
  どの局所領域をどの色へ寄せるかが見える。
- palette diff:
  target/current の色差が raw hex で見える。
- spacing hints:
  gap / padding / bbox delta を修正候補にする。
- typography hints:
  font size, row height, wrapping のズレを見る。
- `vlmkit check tokens <html>`:
  design token / radius / spacing / shadow scale から外れた値を見る。
- `vlmkit check theme <html>`:
  dark mode / theme parity で unthemed component を見る。

編集判断:

- layout lane の fail が残っているなら decoration を触らない。
- token がある project では raw hex ではなく nearest token へ寄せる。
- AI mock の texture や generated background は、実装可能な media slot / simple
  CSS / token に正規化する。

## Step 6: stress and interaction

静止画に近づいた後、実利用で壊れる状態を見る。

役立っている機能:

- `--states hover focus-visible`:
  hover / focus-visible の state screenshot を同じ report に入れる。
- `vlmkit stress i18n <html>`:
  長い文言で overflow / wrap / clipping を見る。
- `vlmkit stress media <html>`:
  forced-colors, reduced-motion, print, RTL, 200% zoom などを見る。
- `vlmkit check motion <html|url>`:
  CSSOM の animation / transition を拾い、running / paused と
  reduced-motion 対応漏れを見る。
- `vlmkit check crater [--require]`:
  Crater BiDi backend の接続、PNG、paint tree、computed styles、
  breakpoint API を smoke する。
- `vlmkit inspect interact <html|url> --sequence <path.json>`:
  明示した操作列で UI が崩れないかを見る。
- `vlmkit inspect explore <html|url>`:
  宣言された action を探索して差分を見る。
- `vlmkit inspect smoke <html|url>`:
  a11y driven な smoke test。操作後に interactive target / landmark が全消失した場合は
  `a11y-regression` として扱う。
- `vlmkit check a11y focus <html|url>`:
  focus order と visual order を見る。

編集判断:

- hover/focus が崩れるなら component state を先に直す。
- i18n で壊れるなら min/max width, wrapping, button padding を直す。
- app-shell では scrolled / empty / loading / error state を別 fixture として
  追加する。

## Step 7: regression and approval

実装として十分近づいたら、target mock ではなく実装の current state を
baseline として守る。

役立っている機能:

- `vlmkit snapshot`:
  route / viewport ごとの screenshot capture。
- `vlmkit baseline pin|verify|post`:
  external project 向けの route / viewport baseline gate。
- `vlmkit diff-pr`:
  `baseline verify` の下層にある PR summary / CI gate。
- `vlmkit workflow init|capture|verify|approve`:
  vlmkit 自身の dogfood に使う stateful workflow。
- `vlmkit snapshot stability`:
  flake / false positive の計測。
- `vlmkit manifest`:
  既知差分や期限付き suppression の管理。

編集判断:

- AI mock target は design reference として残す。
- regression baseline は実装後の current を採用する。
- 意図した visual change は approval / expectation に残し、次回の agent が
  diff を誤読しないようにする。

## Step 8: feedback to prompt and IR

各 round の report から、次の mock prompt / brief / UI Contract IR に戻す。

戻すべき知見:

- marker 名の不足
- command shape の不足
- font feasibility の不足
- grid / scrollport / min-max 制約の不足
- pattern 分類の迷い
- pixel diff ではなく source of truth にすべき signal
- state / content / decoration / asset / canvas hook の不足

役立っている運用:

- `design-runs/*/reports/dogfood.md` に round ごとの判断を残す。
- `docs/design-pattern-feasibility.md` に pattern 固有の contract を戻す。
- `docs/landmark-drilldown-design.md` に layout / decoration の general rule を戻す。
- `ui.contract.json` に pattern / goal / marker / state / decoration / content /
  asset / canvas metadata を戻す。
- empirical prompt tuning で fresh executor に再読させ、曖昧さを潰す。

## 実装に効いている機能の優先順位

| 優先 | 機能 | 理由 |
|---:|---|---|
| 1 | `build component --goal <pattern>` | target mock と current markup の間を、pixel ではなく実用 goal で読める |
| 2 | Landmark drilldown | 大きなズレを semantic region に戻して編集できる |
| 3 | Scrollport inspector | app shell の「見た目は近いが使えない」を発見できる |
| 4 | Landing evidence | hero / CTA / media / next hint を first viewport gate にできる |
| 5 | Canvas evidence | game/canvas を DOM 再現ではなく state / frame / input で扱える |
| 6 | Heatmap + palette + spacing hints | layout 安定後の局所修正に使える |
| 7 | `--states`, `stress`, `inspect`, `check a11y` | 静止画では見えない実用 UI の壊れ方を拾える |
| 8 | Snapshot workflow | 収束後の回帰を守れる |

## まだ足りないところ

- `vlmkit design analyze-brief`: brief から pattern / goal / marker checklist を
  自動生成する。
- `vlmkit design prompt`: 実装しやすい mock prompt を pattern 別に生成する。
- ~~report JSON: Landmark drilldown / goal evidence / scrollport / canvas evidence を
  agent が markdown scraping せず読めるようにする。~~
  → 2026-07-27 実装済み: `build component` が `report.md` の隣に
  `report.json`(`ComponentFromImageReport` 全体 — semanticDrilldown /
  goalEvaluation / landmark / scrollport / canvas evidence / bbox / heatmap /
  text-rows / palette / states)を常時書き出す。
- ~~UI Contract compiler: contract から HTML/CSS skeleton を生成する。~~
  → 2026-07-27 実装済み: `vlmkit contract scaffold <ui.contract.json>` が
  landmark tree / layout policy / responsive rule / slot / marker / state を
  semantic HTML + grid/flex CSS に compile する
  (`packages/vlmkit-markup/src/contract/scaffold-contract.ts`)。
  scaffold を `contract introspect` に通すと landmark 構造が round-trip する。
- UI Contract simulator: contract の layout を Chromium / Crater / layout
  backend で比較する。
- Existing implementation introspection: 既存 DOM/CSS から state / content /
  decoration intent まで推定する。
- Browserless renderer: MoonBit / Crater / layout renderer で高速に layout を
  simulation する。
