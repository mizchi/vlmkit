# vlmkit current capability summary

作成日: 2026-05-20

## 要約

現在の vlmkit は、pixel perfect な画像再現ツールではなく、実用可能な UI に
収束しているかを判定するための visual / semantic / interaction signal
tool として使える段階にある。

特に強いのは、HTML/CSS として実装された画面に対して、landmark、scrollport、
responsive constraint、required state、canvas state hook などの検証可能な
根拠を重ねて、agent が次に直すべき場所を読める report にすること。

一方で、AI が生成した 1 枚絵をそのまま高精度に HTML/CSS 化する用途では、
まだ事前分析と手書きの UI Contract / marker が必要。装飾、motion、canvas の
gameplay、複雑な responsive policy は、完全自動より dogfood scenario と
contract を育てながら使うのが現実的。

## 今できること

| 領域 | できること | 信頼度 | 根拠 |
|---|---|---:|---|
| VRT / screenshot diff | PNG / HTML / URL の visual diff、heatmap、landscape diff、bbox、text row、palette を出せる | 高 | 既存 core tests と過去 dogfood |
| Semantic drilldown | visual diff を `banner`, `navigation`, `main`, named `section`, `search`, `complementary` などの landmark に投影できる | 高 | landmark drilldown tests / component reports |
| Layout-first 判定 | pixel diff が高くても、coarse layout が実用範囲かを `landscape` と goal profile で判断できる | 高 | landing / dashboard / expressive-menu dogfood |
| Agent 向け修正 report | layout lane / decoration lane / bbox / heatmap / CSS hint を Markdown に出せる | 高 | `build component` reports |
| App shell scrollport 検査 | `data-scrollport` と UI Contract の `expectedScrollports` を見て、独立スクロール領域の broken / empty / missing を検出できる | 高 | app-shell Red: visual は近いが `messages` scrollport broken を fail |
| Landing page gate | first viewport の hero / CTA / media slot / next-section hint を pass/fail にできる | 中-高 | landing dogfood pass |
| Dashboard / data UI stress | filter form、KPI repeat、table scrollport、chart region、alert density などを semantic/content evidence として見られる | 中-高 | dashboard dogfood pass |
| Responsive introspection | 複数 viewport から landmark responsive rules と content/repeat probes を抽出できる | 中 | app-shell / dashboard / responsive-stretch introspection |
| Responsive stretch check | 390 / 768 / 1440 / 1920px で横スクロール、max container、readable measure、card width、media aspect を検査できる | 中 | responsive-stretch dogfood pass |
| Expressive UI | poster/menu 的な斜め・重なりの UI を、semantic menu + composition metadata + contrast + states として扱える | 中 | expressive-menu dogfood pass |
| Canvas smoke | canvas nonblank、frame delta、keyboard input による `window.__gameState` 変化、required field を検査できる | 中 | game dogfood pass |
| Contract introspection | 既存 HTML から UI Contract draft を生成し、pattern / goal / scrollport / state / composition / canvas hook をある程度拾える | 中 | `contract introspect` tests / benchmark |
| Performance profiling | introspection の browser launch / viewport / goto / landmark / hint timing を出せる | 中 | 3-round benchmark |

## 得意な使い方

### 1. Synthetic target で tool signal を育てる

HTML target から PNG を作る synthetic dogfood は、意図的な Red を作りやすい。
App shell の `messages` scrollport broken や、responsive-stretch の tablet 幅
伸びすぎのような問題は、AI mock より deterministic に検証できる。

この層で inspector / goal / report semantics を固めてから、generated mock に
戻すのが効率的。

### 2. Pixel ではなく pattern-specific goal で見る

現在効いている goal:

- `landing`: hero / primary CTA / media slot / next-section hint。
- `app-shell`: visual layout に加えて explicit scrollport。
- `canvas`: canvas nonblank / frame delta / input state hook。
- `expressive-menu`: semantic menu / selected state / hover / focus-visible /
  contrast / composition marker。
- `app`: dashboard や通常 application の practical pass。

`diffRatio` は最終 polish の信号として使い、初期収束は landscape、landmark、
pattern gate を主語にする方が安定する。

### 3. UI Contract IR を編集時メタデータとして使う

UI Contract があると、次の情報を HTML/CSS とは別に保持できる。

- expected scrollports
- required states
- responsive viewport rules
- canvas state hook
- composition layers / shapes
- pattern / goal / pass policy

これは「実装に優しい mock」を作るためにも効いている。AI の自由な絵を後から
CSS に落とすより、最初に marker と design envelope を指定した方が、後段の
report が読みやすい。

### 4. Layout と decoration を分けて修正する

Landmark drilldown の layout lane / decoration lane は、agent の編集判断に
向いている。

- layout lane: grid tracks、section order、scrollport、container width。
- decoration lane: color、media、local text styling、palette。

この分離がないと、装飾の heatmap に引っ張られて layout を壊しやすい。

## 苦手なこと

| 領域 | 苦手なこと | 現実的な扱い |
|---|---|---|
| AI mock からの完全再現 | 生成画像の字形、質感、非標準フォント、装飾の完全一致 | 最初に font feasibility と asset policy を決める。pixel perfect を goal にしない |
| Decoration introspection | motion、blur、mask、複雑な重なり、装飾 layer の意味づけ | 当面は `data-composition-layer` / `data-shape` など手書き metadata を使う |
| Responsive policy の自動推定 | collapse、drawer、tab 化、reorder の「意図」までは推定しきれない | multi-viewport contract と scenario-specific checks を書く |
| Canvas / game | gameplay rules、collision、asset visibility、multi-input、HUD overlap の十分な検査 | `build canvas` / `build interactive` 相当の別 command family が必要 |
| App preview inside landing | hero 内の app-shell 風 media を interactive app と誤解しやすい | interactive でない preview は `data-media-slot` として扱う |
| Dashboard の chart / table 詳細 | chart のランダム点、数値内容、セル単位の意味差分 | density / region / row count / scrollport を見る。数値内容は別検査に分ける |
| Aesthetic judgment | 「おしゃれ」「違和感がない」の主観判断 | contrast、composition、boundedness、density など proxy 指標に分解する |
| Existing implementation introspection | 既存 HTML から十分な contract を完全自動生成すること | draft 生成までは可能。最終 contract は人間/agent が補う |
| Batch performance | 複数ページ・複数 viewport で browser launch cost が目立つ | browser reuse が必要 |

## まだ強く自動化しない方がいいこと

- 生成画像から CSS を直接復元すること。
- `diffRatio` だけで pass/fail を決めること。
- font choice を後回しにして mock だけ先に作ること。
- responsive collapse の意図を introspector に任せること。
- canvas/game を単一 screenshot diff で判定すること。
- 装飾 layer や motion metadata を introspection で上書きすること。

## 現在の実測値

2026-05-20 の non-blog dogfood では、次の synthetic scenarios を通した。

| Pattern | Goal result | Metrics | Check summary |
|---|---|---|---|
| landing | pass | pixel 8.00%, landscape 1.12% | CTA / next-section hint / media slot pass |
| app-shell | fail as intended | pixel 4.00%, landscape 0.14% | `messages` scrollport broken を検出 |
| dashboard | pass | pixel 17.53%, landscape 1.06% | shell / filter / KPI / rows / chart / alerts pass |
| responsive-stretch | pass | pixel 7.41%, landscape 0.67% | no horizontal scroll / bounded width / measure / card / media pass |
| game | pass | pixel 0.95%, landscape 0.02% | canvas / frame / input / state hook pass |
| expressive-menu | pass | pixel 7.30%, landscape 2.54% | semantic menu / selected / contrast / composition pass |

3-round introspection benchmark:

| Case | Avg total | p95 | Avg browser launch | Avg viewport work | Avg landmark |
|---|---:|---:|---:|---:|---:|
| app-shell | 263ms | 423ms | 155ms | 97ms | 29ms |
| expressive-menu | 182ms | 197ms | 83ms | 89ms | 24ms |
| dashboard | 194ms | 202ms | 80ms | 104ms | 11ms |
| responsive-stretch | 280ms | 291ms | 78ms | 190ms | 60ms |
| canvas | 127ms | 132ms | 79ms | 41ms | 3ms |

## 判断基準

| やりたいこと | 今の vlmkit での扱い |
|---|---|
| Blog / editorial mock を HTML 化したい | 可能。先に typography / reading width / semantic section を固定する |
| Landing page を作りたい | 可能。CTA / hero / media / next-section を marker 化する |
| SaaS dashboard を作りたい | 可能。forms / KPI repeats / table scrollport / chart region を contract に入れる |
| Discord-like app shell を作りたい | 可能。scrollport と selected state を必ず明示する |
| Responsive で伸ばした時の違和感を見たい | 可能。ただし現状は dogfood script 側の scenario check。goal 昇格が必要 |
| Persona 5 風などの expressive UI を作りたい | 可能。semantic menu と composition lane を分ける |
| CSS 慣習に乗らない game UI を作りたい | smoke は可能。gameplay validation は未成熟 |
| 既存画面から contract を完全自動生成したい | draft は可能。編集時 IR として補完が必要 |
| 画像生成から production markup まで全自動にしたい | まだ早い。analysis phase と prompt constraints が必須 |

## 次に実装すべきこと

1. `responsive-stretch` を reusable goal / contract に昇格する。
   - `maxContainerWidth`
   - `readableMeasureMax`
   - `noHorizontalScroll`
   - `repeatItemMaxWidth`
   - `mediaAspectRange`
2. `build canvas` または `build interactive` を分ける。
   - input delta contract
   - HUD overlap
   - asset visibility
   - multi-state screenshot
3. Contract に expected input delta を追加する。
   - 例: `ArrowRight` で `playerX` が増える。
4. Batch introspection で browser reuse する。
5. Existing implementation introspection を強化する。
   - marker suggestion
   - missing contract field warning
   - responsive collapse policy draft
6. Decoration / motion metadata の introspection を追加する。
   - ただし hand-authored metadata を上書きしない merge policy が必要。

## 結論

今の vlmkit は、実装済み HTML/CSS を「実用可能な UI へ収束させる」用途には
かなり使える。特に、agent が report を読んで layout / behavior / decoration を
分けて直す loop には向いている。

苦手なのは、生成画像に含まれる暗黙の美的判断や、CSS/DOM では表現しづらい
装飾・motion・gameplay を自動で正解化すること。ここは UI Contract IR、
pattern-specific goal、dogfood scenario を増やして、判断軸を少しずつ明示化する
のが現実的。
