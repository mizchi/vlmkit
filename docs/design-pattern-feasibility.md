# Design pattern feasibility matrix

作成日: 2026-05-20

## 目的

ブログ dogfood で得た知見を、そのまま全 UI に一般化しない。
AI mock から実装へ進む前に、対象画面のパターンを分類し、何を source of
truth にするか、どの vlmkit signal を重く見るかを決める。

同じ `diffRatio` でも、ブログ、ランディングページ、Discord のような
sidebar app、ゲーム画面では意味が違う。ピクセル一致ではなく「実用可能な
UI として収束しているか」を見るため、最初にパターン別の feasibility
contract を作る。

## Pattern classifier

| Pattern | Source of truth | 最初に固定するもの | 主に見る signal | 避ける過学習 |
|---|---|---|---|---|
| Editorial / blog | semantic document flow | typography, reading width, section order | typography rows, landmarks, landscape | 生成画像の字形や装飾 |
| Landing page | offer, hero, CTA, section hierarchy | first viewport, media slots, CTA visibility | hero geometry, section order, media crop, landscape | 背景画像や質感の完全一致 |
| Sidebar app shell | persistent viewport shell | rails, scrollports, active state, density | grid tracks, scrollport bboxes, selected rows, overflow | 本文テキストの pixel 差分 |
| Dashboard / data tool | task and data hierarchy | table/chart density, filters, empty/loading states | layout lanes, row height, control affordances | chart のランダム点や数値内容 |
| Game / canvas scene | game state and scene graph | rules, aspect ratio, HUD, input loop | canvas nonblank, frame delta, input response, overlap | screenshot の単発 pixel diff |

分類は排他的でなくてよい。たとえば SaaS landing の下に app preview がある場合、
first viewport は landing として見て、preview 内部は app shell として見る。

## Decision tree

1. 画面の中心が文章と意味的な section なら、document 系として扱う。
2. 画面の中心が offer / CTA / media impression なら、landing 系として扱う。
3. 画面の中心が常駐 navigation と作業領域なら、app shell 系として扱う。
4. 画面の中心が canvas / WebGL / 連続入力なら、game / interactive 系として扱う。
5. 混在する場合は、first viewport の主要目的と独立 scrollport の有無で分割する。

## Common analysis phase

どのパターンでも、mock 生成前に次を決める。

- target viewport と DPR
- semantic owner: DOM landmarks, app shell regions, scene graph, or mixed
- font feasibility: system font で再現するか、web font を許可するか
- layout feasibility: grid/flex/subgrid で説明できるか
- responsive policy: mobile で順序が同じ意味を保つか
- asset policy: 実画像、generated image、SVG、canvas asset のどれを使うか
- pass policy: `app`, `layout`, `pixel`, `draft` のどれを使うか、または将来 profile が必要か

この phase の出力を `brief.md` と mock prompt に入れる。AI に自由に絵を
作らせるより、実装に優しい design envelope を先に狭める。

## Editorial / blog

ブログ dogfood の結果はこのパターンに属する。

### Contract

- semantic HTML と landmark order を source of truth にする
- typography scale と line-height を早い段階で固定する
- reading width, article card height, metadata density を layout contract に含める
- decoration は palette / border / simple media slot として後段に回す

### Signals

- text row count and wrapping
- `banner`, `navigation`, `main`, `complementary`, `contentinfo`
- page-level `Landscape diff`
- landmark drilldown の layout lane
- 最後に heatmap / palette / decoration lane

### Goal

既存の `--goal app` が最も近い。初期 round は `--goal layout` で構造を寄せ、
終盤で `--goal app` を pass させる。

## Landing page

Landing は document だが、ブログより first viewport と media impression の
重みが高い。生成画像が美しくても、実装では asset replacement と CTA
視認性が source of truth になる。

### Contract

- H1 は brand / product / literal offer / category のいずれか
- first viewport に hero, primary CTA, supporting copy, next section hint を入れる
- hero media は replaceable media slot として扱う
- section order は semantic HTML に戻せる形にする
- decorative gradient や image-only text を必須条件にしない
- desktop / mobile で CTA と offer の意味が変わらないようにする

### Mock prompt constraints

```text
Create an implementable landing page mock.
The hero must expose the product/category/offer in the first viewport, include
one primary CTA, and leave a visible hint of the next section.
Use real or replaceable media slots; avoid SVG-only gradient hero art, blurred
stock-like backgrounds, and text that can only be represented as an image.
Keep all sections expressible as semantic HTML plus CSS grid/flex.
```

### Signals

- hero region bbox and first-viewport balance
- primary CTA position, size, and contrast
- next section visibility on desktop and mobile
- media aspect ratio and crop slot, not exact generated texture
- section order and landmark mapping
- decoration lane for palette and brand impression

### Goal

現在は `--goal landing` を使う。landscape と CTA/hero visibility を重く、
media texture の pixel diff を軽く見る。

## Sidebar app shell

Discord / Slack / Linear のような UI は、document flow より viewport shell が
source of truth になる。body 全体が scroll するのではなく、複数の内側
scrollport が独立して動く。

### Contract

- app root は `min-height: 100dvh` または固定 viewport shell
- rail, sidebar, main, detail panel を named grid area として扱う
- rail/sidebar は fixed or bounded width
- main/detail は fluid width と min/max constraints を持つ
- scrollport を明示する: channel list, message list, details, member list
- active / selected / unread / hover / focus-visible state を target に含める
- mobile では panel collapse, drawer, tab などの navigation policy を決める

### Mock prompt constraints

```text
Create an app-shell mock similar in structure to Discord, not a document page.
Use a full viewport shell with persistent left rail, secondary sidebar, main
content scrollport, and optional right panel.
Show active navigation state, unread badges, selected content row, and realistic
density. Name which panels scroll independently.
```

### Signals

- grid column widths and min/max constraints
- scrollport bbox and overflow direction
- selected row and active navigation visibility
- sticky header/footer inside scrollports
- pointer/focus target sizes
- content density and row height
- screenshots after scroll, not only initial viewport

### Goal

`--goal app-shell` を使い、visual layout と explicit scrollport evidence を
同時に見る。手動 checklist は selected / unread / scrolled state など、まだ
goal に入っていない shell invariant を補う。

`app-shell` profile では、pixel diff より次を強く評価する:

- rail/sidebar/main/detail の存在と順序
- independent scrollport の検出
- active state の存在
- overflow が viewport 外へ逃げていないこと
- desktop と mobile の navigation policy

## Dashboard / data tool

Dashboard は app shell に近いが、source of truth は「データを読めるか」と
「作業を完了できるか」になる。チャートの見た目より、filter, table,
summary, empty/loading/error state の情報密度が重要。

### Contract

- primary task: monitoring, comparison, editing, triage のどれか
- summary cards, filters, table, chart, details panel の優先順
- table row height と column policy
- chart は data slot として扱い、正確なランダム形状を要求しない
- empty/loading/error state を最低 1 つ含める

### Signals

- row height and table density
- filter/control affordance
- chart/container bbox and legend placement
- responsive collapse policy
- text overflow and numeric alignment

### Goal

現在は `--goal app`。将来的には `data-tool` profile で table density,
overflow, control state を追加 gate にする。

## Game / canvas scene

ゲームや creative canvas は CSS の慣習だけでは一般化できない。mock image は
art direction であり、DOM 再現 target ではない。source of truth は rules,
state machine, scene graph, asset pipeline, input loop に置く。

### Contract

- engine: Phaser, Pixi, Three.js, Canvas 2D, DOM hybrid など
- aspect ratio and scale policy: fit, cover, integer scale, letterbox
- game state: title, playing, paused, result
- HUD: score, timer, health, inventory, controls
- input: keyboard, pointer, touch, gamepad
- animation: at least one deterministic frame delta
- assets: generated sprites, vector primitives, tile map, or procedural art

### Mock prompt constraints

```text
Create game art direction, not a DOM layout target.
Keep the scene compatible with a browser canvas implementation.
Define the aspect ratio, HUD positions, main playable area, controls, and asset
style. Avoid visual details that require one-off raster text or impossible
physics. The final implementation may use a game engine and generated sprites.
```

### Signals

- canvas is nonblank
- canvas is correctly framed at target viewport
- frame N and frame N+1 differ when the game is running
- input changes game state
- HUD text is readable and does not overlap playfield
- assets are loaded and visible
- pointer/touch targets are usable on mobile
- screenshots cover title, playing, paused/result states

### Goal

単発 screenshot の `diffRatio` は参考値に留める。現在は `--goal canvas` で
nonblank canvas, short frame delta, optional `window.__gameState` input response
を gate にする。将来的には `build interactive` / `build canvas` に分け、
HUD overlap, asset visibility, richer state assertions, FPS/animation sanity を
追加する。

DOM landmark drilldown は outer shell までに限定する。canvas 内部の drilldown
は scene graph / object labels / collision layer から生成する。

## Implementation implications

vlmkit 側で追加したい機能:

- `vlmkit design analyze-brief`: brief から pattern を推定し、必要な contract を出す
- `vlmkit design prompt`: pattern-specific mock prompt を生成する
- `vlmkit build component --goal landing`
- `vlmkit build component --goal app-shell`
- `vlmkit build component --goal canvas`
- `vlmkit build interactive --goal canvas`: future richer interaction runner
- scrollport inspector: `overflow`, bbox, scrollHeight/clientHeight, sticky descendants
- state snapshots: hover, focus, selected, scrolled, empty/loading/error
- canvas inspector: nonblank, frame delta, asset visibility, input response

当面は、既存 `app|layout|pixel|draft` profile を使いつつ、pattern-specific
checklist を report に残す。新しい profile は dogfood の結果で gate を決める。

## Suggested dogfood matrix

| Run | Pattern | 目的 | 追加で見るもの |
|---|---|---|---|
| `landing-YYYYMMDD` | Landing page | hero/CTA/media slot の収束 | first viewport, CTA visibility |
| `app-shell-YYYYMMDD` | Sidebar app | scrollport と active state の収束 | nested scroll, selected state |
| `dashboard-YYYYMMDD` | Data tool | dense operational UI の収束 | table density, overflow |
| `game-YYYYMMDD` | Canvas game | screenshot 以外の gate 設計 | input, frame delta, HUD overlap |

ブログで得た `landscape <= 3%` は document/app-like UI の初期値としては有効だが、
landing では hero/CTA weighting、game では interaction/state gate を足さないと
実用性を表せない。

## Dogfood evidence

- `design-runs/blog-20260519/`: editorial / blog
- `design-runs/patterns-20260520/`: landing, sidebar app shell, game / canvas

2026-05-20 の non-blog dogfood では、landing と game は既存 goal で visual
pass した。一方で app-shell は `layout` pass のまま message scrollport が
壊れていた。これを受けて `build component` に explicit scrollport inspector
と `--goal app-shell` を追加した。その後、landing first-viewport gates を
`--goal landing` に昇格し、canvas nonblank / frame delta / input response を
`--goal canvas` に昇格した。次は contract から expected pattern gates を
自動注入する。
