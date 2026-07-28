# 2026-07-27 dynamic-markup skill + S5(動的挙動ページ)の Haiku 実証

## 目的

同日 #84 で入った動的挙動シグナルツール
(`check animation` / `scan scroll` / `check breakpoints`)を
**マークアップワークフローの検証ゲート**として組み込んだ新 skill
`dynamic-markup` を作り、auto-markup 実証(S1-S4)と同じ方法論 —
Haiku サブエージェント単独・API キーなし・エージェント自身の視覚が
VLM — で回ることを確認する。

## 提供形態

`.claude/skills/dynamic-markup/SKILL.md`(本コミット)。構成:

- **入力規約**: 静的な真実は screenshot、挙動の真実はキャリアが必要 —
  viewport ごとの screenshot / scrolled screenshot / **motion brief**
  (動き・時間・イージング・反復・reduced-motion 方針の短文仕様)。
  キャリアのない挙動は作らない(モーション brief なし = アニメ 0 本)。
- **Phase A**: 静的収束は auto-markup skill に委譲(entrance は
  `both`/`forwards` で静的レイアウトに終着させる追加規約のみ)。
- **Phase B**: 4 ゲート — `check breakpoints`(B±1 不変条件)、
  `scan scroll`(スクロール実在 + page-overflow-x)、
  `check animation`(brief と evaluated list の行単位突き合わせ)、
  `check motion`(宣言レベルの相互チェック)。
- **Phase C**: キャプチャ規律 — settleMs 待ち、infinite の `--mask` を
  B3 レポートから転記。

## S5 フィクスチャ

`fixtures/auto-markup-proof/promo/` — Pulse プロモページ。S2-S4 で
未検証だった **アニメーション要件** を初めて含む:

- hero entrance(600ms ease-out ×1、14px rise、静的レイアウトに終着)
- LIVE バッジ pulse(opacity 1↔0.55、1.2s/leg alternate、無限)
- `prefers-reduced-motion: reduce` で両方無効化
- チェンジログパネル(高さ 240px、overflow-y auto、10 行中 6 行可視)
- 768px ブレークポイント(nav 消失、3 カラム → 1 カラム)

ターゲットは rest-pose seek(`check animation` と同じポリシー:有限は
終端過ぎ、無限は 0)で決定論キャプチャした 3 枚
(desktop 1280 / mobile 375 / changelog-scrolled)+ `motion-brief.md`。
リファレンス自体のゲート出力(期待値): breakpoints clean、
scroll container 1(overflow 152px)、animations 2 / reduced-motion
honored / infinite warn 1 のみ。

## 結果(検証者の独立再計測)

Haiku は **3 ラウンド・54 tool call・231 秒・76,769 tokens**で完走
(tokens はドライバーがハーネス usage から記録 — マークアップ
エージェントランのトークン計測はこのランが初。KPI 定義は
`docs/knowledge.md` "Markup Agent KPI")。

### ゲート(4/4 通過 — 自己申告と独立再計測が一致)

| ゲート | 独立再計測 |
|---|---|
| `check breakpoints` | 768px **clean** |
| `scan scroll` | `div.changelog-list` axis=y **overflow 235px**、page-overflow-x 0(mobile も可)、dead/clipped 0 |
| `check animation` | 2 本とも **visible**(entrance 600ms×1 delta 3.39% / pulse 1200ms×∞ delta 0.16%)、**reduced-motion: honored**、warn は期待どおり infinite 1 件のみ(`--mask "div.live-badge"` 案内付き) |
| `check motion` | active 2 / running 2、reduced-motion rule **yes** |

### 静的収束

| 指標 | desktop (1280) | mobile (375) |
|---|---|---|
| `build page` | matched 6 / missing 2 / extra 2 | matched 7 / missing 1 / extra 1 |
| hero IoU | 0.79 | 0.94 |
| ピクセル diff(共通領域) | 10.4% | 7.0% |
| ピクセル diff(高さパディング込み) | 8.0% | 6.3% |

注: この環境は moon 欠落で `diff png` の分類パイプが動かないため、
pixelmatch 直叩き(threshold 0.1、サイズ不一致は白パディング +
共通領域の両方)で計測。

残差の主因は 1 点に集約される: **チェンジログパネル高 400px
(リファレンス 240px)**。ページ全高が +336px 伸び、フッターが
build page 上「missing + extra」ペアとして現れる。次点は h1 の
2 行折返し(フォント幅差)。構成・コピー・パレット・バッジ・
ゼブラ行・nav のモバイル消失はすべて一致。

### motion brief 準拠

- entrance: 600ms ease-out / 14px rise / `both` 終着 — **完全一致**。
- pulse: Haiku は `0%,100% → 50%` キーフレームの 1.2s サイクル
  (= 片道 0.6s)で実装。brief の「1.2s per leg, alternating」
  (= 片道 1.2s)の **2 倍速**。

## 発見: ゲートの盲点 1 件

pulse の leg 時間の違いは `check animation` の出力では**区別不能**
だった — リファレンスも attempt も同じ `1200ms x∞` と表示される
(WAAPI の duration は 1 iteration の長さで、`alternate` の往復も
50% キーフレームの往復も 1 iteration に畳まれる)。周波数・位相・
direction はフレーム評価でも比較していない。brief との突き合わせで
「duration と iterations が一致」まではゲートで確認できるが、
**振動の周期はまだ人間(または frame strip)しか守れない**。
`check animation` に direction / 実効周期(キーフレームの折返し検出)
を出す拡張が次の課題。

## 解釈

- **動的挙動 3 要件(breakpoint / scroll / animation)は Haiku で
  1 ラウンド目から成立した**。ゲートが「何を満たすべきか」を選択子
  レベルで返すため、S1-S4 同様に小型モデルでループが回る。
  アニメーション要件は S5 が初計測で、brief → 実装 → `check animation`
  の evaluated list 照合という伝達経路が機能した。
- **motion brief パターンは「状態 screenshot を足す」パターン
  (S2 scrolled / S3 hover / S4 dark)の時間軸版**として機能する。
  静止画で伝わらない要件は brief 1 枚で小型モデルに伝わった。
- **静的収束は S2(dashboard)より浅い**: Haiku は予算 10 のうち
  3 ラウンドで「収束」を自己宣言して停止した。missing/extra が
  残った状態はゲート green とは独立の未達で、skill の
  「done = 構成収束 **かつ** 全ゲート green」の AND 条件を
  エージェントが読み飛ばした形。stopping 節の強調(gates green ≠
  done)が次の skill 文言改善点。

## 5 シナリオまとめ

| | S1 landing | S2 dashboard | S3 auth form | S4 theme | S5 promo |
|---|---|---|---|---|---|
| 難度要素 | なし | @media / scrollport | 細粒度 / :hover/:focus | light/dark | **アニメ ×2 + scroll + @media** |
| ターゲット | 1 枚 | 3 枚 | 3 枚 | 2 枚 | 3 枚 + motion brief |
| ラウンド | 4 | 10 | 6 | 4 | 3 |
| tokens | — | — | — | — | **76,769** |
| ピクセル diff | 1.40% | 6.2% | 2.6-3.3% | 5.6-6.6% | 6.3-8.0% |
| 動的ゲート | — | scroll 実測 + scan breakpoints | forcePseudoState | check theme | **4 ゲート全通過** |
| 副産物 | — | build page 背景バグ修正 | — | — | check animation の周期盲点を記録 |

## 関連

- skill: `.claude/skills/dynamic-markup/SKILL.md`
- ゲートツール実装: `docs/reports/2026-07-27-animation-eval.md`、
  `docs/reports/2026-07-27-scroll-scan-breakpoint-check.md`
- S1-S4: `docs/reports/2026-07-27-auto-markup-skill-haiku-proof.md`
- 成果物(無編集): `fixtures/auto-markup-proof/promo/attempt-haiku.html`

## 再挑戦 r2 / r3(同日追記、KPI 運用下)

v1 の敗因(gates green での早期自己宣言)を受けて skill の stopping 節を
AND 条件に強化し、KPI(rounds / tokens)運用下で 2 回再挑戦した。

### r2(失敗ラン、ツールバグ 1 件発見)

- 12 ラウンド全消費で done 未達(フッター変位 + 縦余白 ~70px)。
  7 ラウンド目に一度自己宣言 → 検証者差し戻しで再開、というループを
  経てもなお、最後は残差を「ツールの限界」と誤帰属して停止した。
- **実ツールバグ発見**: `build page` のキャプチャが entrance
  アニメーションの途中(opacity < 1)を撮っており、hero が
  `#121b2f → #e6e7e9`(d348)/ IoU 0.91 という幻のデルタを報告して
  いた(アニメ剥がしコピーでは fill ok / IoU 0.96)。エージェント自身も
  ラウンド 10 で手動アニメ剥がしという回避行動を取っており、幻デルタが
  ラウンドを浪費させた。→ Playwright `animations: "disabled"`
  (有限は終端へ fast-forward、無限は初期状態 = rest-pose 意味論)を
  `build page` / `build component` の両キャプチャに適用して修正。
- v1 の盲点だった pulse leg 時間は r2 では brief どおり
  (1.2s alternate)に実装された。

### r3(修正済みツール、**初の done 条件達成ラン**)

- 幻デルタ消滅の効果は明確: hero はラウンド 1 で IoU 0.99 / fill ok。
- ただし自己宣言問題は 3 たび再発 — ラウンド 4・6 で 2 度
  「完了」を宣言し、いずれも検証者差し戻しが必要だった。決め手は
  **校正ラン**(リファレンス HTML 自身を build page にかける →
  8/8 matched / missing 0 / extra 0)で「0/0 は達成可能、残差は実物」
  と示せたこと。
- ラウンド 8 で **両 viewport とも missing 0 / extra 0** に到達。
  独立再計測での最終値:

| 指標 | desktop (1280) | mobile (375) |
|---|---|---|
| `build page` | **8/8、missing 0、extra 0** | **8/8、missing 0、extra 0**(1px 線ペアの交差 1 件 — 実質ノイズ) |
| rest-pose ピクセル diff | **2.65%** | **7.51%** |
| ページ全高 | 1108(+17px) | 1347(+12px) |

- 4 ゲート独立再実行: breakpoints ok / scroll ok(1 container)/
  animation warn=infinite のみ・reduced-motion honored /
  motion running 2・rule yes。pulse は 1.2s alternate(brief 準拠)。
- 観察: entrance を `.hero` セクション全体に付けており(リファレンスは
  内側ブロック)、rest 状態は同一だが motion region が band 全体
  (1280x355、peak 49%)になる。brief の文言上は許容内。

### KPI 記録(3 ラン)

| Run | rounds | tokens(セグメント計) | done | 備考 |
|---|---:|---:|---|---|
| v1 | 3 | 76,769 | ✗ | 早期自己宣言 |
| r2 | 12 | 221,686 (98,094+123,592) | ✗ | 幻デルタ + 誤帰属。ツールバグ発見が成果 |
| r3 | 8 | 375,941 (107,592+126,634+141,715) | **✓** | 差し戻し 2 回。校正ランが決め手 |

- **tokens の注意**: 差し戻しは SendMessage による resume で、
  セグメントごとにトランスクリプト再投入分を再課金される。
  r3 の後半 2 セグメントは tool 21-22 回に対し 12-14 万 tokens と
  入力再投入が支配的。**差し戻し前提なら resume より
  「検証者サマリを持たせた新規エージェント」の方が安い可能性が高い**
  — 次の計測課題。
- 初期ターゲット(複数ターゲット ≤12 rounds / ≤150k tokens)に対し、
  done 達成ランは 8 rounds / 375.9k。rounds は達成、tokens は
  resume 課金込みで 2.5 倍超過 — ターゲットは「初回セグメントのみ
  ≤150k、差し戻し込み ≤400k」に改訂するか、handoff 方式の実測後に
  再設定する。

### 早期自己宣言の対策として効いたもの / 効かなかったもの

- 効かなかった: skill の AND 条件強調、プロンプトでの done 条件明示
  (3 ラン全てで自己宣言が発生)
- 効いた: **検証者による差し戻し**(具体的な missing の正体と修正部位の
  名指し)、**校正ラン**(0/0 の達成可能性の証明で「ツールノイズ」への
  誤帰属を遮断)
- 帰結: dynamic-markup skill は「エージェント + 検証者」の 2 役構成を
  前提とするのが現実的。skill にドライバー向けの検証者プロトコル
  (校正ラン → 差し戻し文面)を追記するのが次の改善。
