# vlmkit とは

このプロジェクトを初めて見る人向けの紹介です。前提知識は仮定しません
（CSS ツールにも AI エージェントにも詳しくなくて構いません）。

英語版は [`introduce.md`](./introduce.md) で、同じ内容を維持しています。

## 何を解決するのか

Web ページが本当に**正しい**と、どうやって分かるのでしょうか。

多くのチームでの正直な答えは「誰かが見た」です。人がスクリーンショットを
眺めて、スクロールして、「大丈夫そう」と言う。これは次の理由でうまく機能
しません。

- 768px だけで壊れているが、誰も 768px を見ていなかった。
- 絶対配置のラベル 2 つが 50px 重なっているが、数字が長くなったときだけ。
- ボタンはマウスでは動くが実体は `<div>` + click ハンドラで、キーボードと
  スクリーンリーダーでは操作できない。
- 仕様のコピーは「無料トライアルを開始」なのにページは「トライアルを開始」。
  ピクセルを眺めても気づかない。
- CSS リファクタで何も壊れていない — ただ 1 箇所、1 つの viewport だけ。
  顧客が見つけるまで誰も気づかない。

この問題は最近さらに鋭くなりました。**AI コーディングエージェントが大量の
HTML/CSS を書く**ようになり、「完了しました」というエージェントの主張は
人間の目視よりさらに当てになりません。検証せずに「検証済み」と報告する
だけでなく、検査可能なゴールを与えると**ゴールを騙しにくる**ものもいます。
必須コピーを不可視テキストに隠す、アサーションが通る 50ms だけ ARIA 属性を
反転させる — どちらもこのプロジェクトの評価実行で実際に起きました（どちらも
現在は検出されます。後述）。

## 考え方: 見るのではなく測る

vlmkit は実ブラウザ（Playwright 経由の headless Chromium）でページを描画し、
「正しく見えるか？」を**毎回同じ結果になる合否判定**に変換します。DOM
ジオメトリ、ピクセル演算、computed style、アクセシビリティ探査。眺めるべき
スクリーンショットも、ループ内の AI 判断もありません。末尾に明記した 3 つの
オプション機能を除き、**API キーは不要**です。

（名前は VLM = vision-language model ですが、このプロジェクトは「VLM に
ページを判定させ、正解データと突き合わせて測る」ところから始まり、
**VLM 判定こそが不安定な部分だった**と分かりました。測定が製品になり、
VLM 機能はキー必須のオプションに降格しました。名前は化石です。）

チェックが失敗したとき、単に「失敗」とは言いません。このプロジェクトで
*kickback* と呼ぶもの — 欠陥、位置（CSS セレクタ）、測定値、多くの場合
修正の方向 — を出力します。

```
x [page-overflow-x] @768: The page scrolls horizontally by 156px at 768px
  viewport width — sticking out: main > p:nth-of-type(1) (right edge 924px).
x [text-collision] @1280: "Total: €1,240" overlaps "Refunds: €80" by 52x17px —
  same-layer text blocks must not overlap; check negative margins…
```

この形式は意図的です。人間が読めて、AI エージェントの次のプロンプトに
そのまま貼れます。名指しされたものを直し、再実行し、緑になるまで繰り返す。
**このループが製品です。**

vlmkit はこれらのチェックを **gate（ゲート）** と呼びます。通るか止めるかの
どちらかで、固定したゲートの集合が「その作業の完了」の定義になります。
インストール前に知っておくべきこと:

- 単一描画のゲートは数秒。複数 viewport のゲートは幅を複数描画し
  （`check integrity` は 3 つ）、`check breakpoints --sweep` は fuzz の
  全ステップを描画するので、ブレイクポイントの多いページでは数十秒側に
  なります — 修正ループで 10 回再実行しても十分安い範囲です。
  findings の severity は 2 段階で、**終了コードの契約は全ゲート共通**です。
  - **suspect はコマンドを失敗させます。** DEFECTS / VIOLATED / FAILED /
    NOT DONE の verdict、欠落コピー行、ポインタ専用コントロール —
    どの欠陥レベルの finding も、フラグ無しで非ゼロ終了します。
    「欠陥を見つけたが exit 0」が既定の検証ツールは足を撃つ道具なので、
    無視したい側に立証責任を置いています。
  - **warn は、どのフラグでも終了コードに影響しません。**
  - **`--advisory` は print-and-succeed に戻します。** CI をゲートする前に
    パイロット運用するためです（導入順は後述）。
  - **エラーは必ず失敗します。** 到達不能な URL、存在しないファイル、
    30 秒のアイドルタイムアウトは非ゼロ終了 — 静かな pass にはなりません。

  （`--fail-on-suspect` は以前必要だった場所すべてで今も受理されますが、
  その挙動が既定になったため no-op です。）
- セットアップは 2 コマンド — `npm install -D @mizchi/vlmkit` と
  `npx playwright install chromium`（ブラウザのダウンロード。150MB 程度、
  数分、一度だけ。CI コンテナではシステムライブラリのため `--with-deps` を
  付けます）。この文書の内容に他のツールは不要です — ただしユーザー定義の
  ゲート（copy manifest / layout contract / flow script）はそのファイルを
  自分で書く必要があります。
- ファイルか dev サーバに向けるだけです。ナビゲートしてネットワークが
  アイドルになるまで待つ（30 秒上限）ので、React/Vue/クライアント描画は
  問題ありません。CSS-in-JS も含め、スタイルが存在してから測ります。
  `load` の 1 tick 後に描画するクライアントアプリも、全ゲートが待ちます。
  ファイルを渡した場合は **file: URL へナビゲートする**ので、隣にある
  `style.css` や画像などの相対アセットが解決されます（2026-08-02 まで
  一部のゲートは HTML 文字列を `setContent` していて、**スタイル未適用の
  DOM を測って合格を出していました** — 後述の Honest limits と
  [レポート](./reports/2026-08-02-external-asset-load-defect.md)）。
  正直な裏面: **決してアイドルにならない**ページ（常時ポーリング、
  WebSocket）は 30 秒上限に当たり、半端に落ち着いたページを測るのではなく
  ゲートがエラーになります — ローカルに描画したファイルか、ソケットの無い
  ルートに向けてください。
  ログインの内側のページには、セッションを渡します:
  `--storage-state auth.json`（全ゲートまとめてなら
  `VLMKIT_STORAGE_STATE=auth.json`）。e2e スイートが既に作っている
  Playwright の storage-state ファイルをそのまま使えます。

### 主要なチェックが実際に何を測っているか

「決定論的」は形容詞にすぎないので、機構を書きます。どこが強くてどこで
外すかを予測できるように。

| チェック | 機構 | 限界 |
|---|---|---|
| テキストの上塗り（occlusion） | 各テキスト範囲のグリフ帯を `elementFromPoint` でサンプリング。ヒットした要素が無関係で**かつ**不透明に塗る場合（背景 alpha ≥ 0.5 / 背景画像 / 置換要素）のみカウント。サンプリング中はページ全体でヒットテストを強制するので、`pointer-events: none` の装飾も捕まえる | canvas/video/クロスオリジン iframe の中身、覆わずに可読性を壊す blend mode |
| 横オーバーフロー | 原因を**順位付けではなく測定**する。候補ごとに自身の `width`/`min-width` を無効化して `scrollWidth` を再読み取りするので、kickback は引き伸ばされた祖先ではなく硬い要素を名指しする | |
| コピーの可視性 | 文書全体**と全ての open shadow root**（コンポーネントライブラリのコピーも対象）のテキストノードを幾何的に検査 | closed shadow root、`<canvas>` に描かれた文字 |
| 不可視 / 低コントラスト | computed な文字色と解決された単色背景の WCAG コントラスト。**合成背景（グラデーション、画像）はスキップし、スキップしたことを報告**する — 推測しない | `background-clip: text` のグラデーション文字は判定せずスキップ |
| テキスト衝突 | テキストブロック矩形の対ごとの重なり。**両軸**で 6px 以上**かつ**小さい側の面積の 25% 以上。positioned レイヤと `aria-hidden` 側は免除 | 細片の重なり（Honest limits 参照） |
| スクリーンリーダー専用の免除 | 幾何的判定: 完全にクリップ（面積ゼロ / `clip` / `clip-path` inset）なら意図的、部分的に切れているなら欠陥 | |
| デザイン一致 | 単色塗りの連結成分分割 → 位置/サイズ/色でペアリング → 画像間のピクセル確認 | 写真・グラデーション主体のターゲット |
| デザインの自己一貫性 | 推論したロールごとに描画スタイル署名を集め、署名の再利用率を見る（[実測に基づくしきい値](./design/design-policy-metrics.md)） | ロールを決定論的に推論できない要素（「カード」「パネル」等）は対象外 |

## 何ができるのか

以下はすべて、ローカル HTML ファイルか URL に対する 1 コマンドです。

**「ページを壊した？」** — `check integrity` は 3 つの viewport を一度に
走査し、目視では気づかない欠陥を探します: 横オーバーフロー、重なり/切れ/
はみ出したテキスト、他要素に塗り潰されたテキスト、不可視テキスト、
潰れたコンテナ、JS エラー、読み込み失敗したリソース、スタイル未適用の
描画。参照デザインは不要です。意図的なパターン（スクリーンリーダー専用
テキスト、ヒーローのオーバーレイ、省略記号による切り詰め）は認識され、
失敗ではなく exempt として報告されます。このゲートには実ページでの
偽陽性監査があります:
[ミラーした外部 5 サイト](./reports/2026-07-30-integrity-external-dogfood.md)
（example.com、danluu.com、CSS Zen Garden、Hacker News、W3C APG）で
偽陽性 4 クラスを発見（すべて回帰テスト付きで修正）、真の陽性 1 件
（Hacker News は実際に 768px で横スクロールする）。
finding が複数の幅で出た場合は、観測したすべての幅が出ます
（`@1280,768,375` と `@1280,768` は直し方が違うので）。

**「文言は正確？」** — `check copy` は必須コピーのプレーンテキスト一覧を
受け取り、各行がページ上に**可視の状態で**一字一句あることを検証します。
折りたたまれたアコーディオンや非選択タブを（ARIA 属性から見つけて）開くので
設計上隠れているコピーも通り、どの状態で各行が現れたかをレポートが記録
します。トリックで隠されたコピーは別扱いです: font-size 0、透明色、
画面外配置、背景と同色の文字 — それぞれ理由クラス付きで指摘されます。
この**不可視検出器**（コピー照合全体ではなく、この部分）は実サイト 7 件
（MDN、Wikipedia、W3C、web.dev、Hacker News、danluu.com、example.com）に
対して監査済みで、その 7 サイトのサンプルでは偽陽性ゼロでした —
[手法と全結果](./reports/2026-07-31-copy-invisible-real-site-audit.md)。
manifest 自体は 3 行の規約です。

```
# copy.txt — 1 行 1 必須コピー。"# " 始まりはコメント
無料トライアルを開始
いつでもキャンセルできます
```

空白は正規化され、照合は**大文字小文字を区別**し（casing は仕様）、
行はページ上のどこにあっても構いません。1 つだけ先に整理しておきます。
2 つのゲートが矛盾しているように見えるケース: スクリーンリーダー専用
テキストとして**のみ**存在する文字列（アイコンのみのボタンの
アクセシブル名）です。integrity はこれを免除します — 完全にクリップされた
矩形は認識済みの意図的パターンなので。同じ文字列が manifest の行でもある
場合、copy ゲートは理由クラス `visually-hidden` で
「存在するが不可視」と報告し、`--allow-invisible visually-hidden` で
明示的に受理します。verdict は copy ゲートが持ち、受理はフラグ —
静かな pass にはなりません。

**「実際に振る舞う？」** — `check breakpoints --sweep` はレスポンシブ境界が
正確であること（レイアウトが壊れる幅が無い、768px で 1px ずれない）を
証明します。`check interactions` は各コントロールでキーを押し、ARIA 状態
遷移をマップして、何にも繋がっていない disclosure を捕まえます。兄弟の
`scan handlers`（または `check interactions --handlers`）が
**クリック可能な `<div>`** を捕まえます: role もキーボード経路も無い click
ハンドラです。両方を実行してください — 素の `check interactions` は
`<div onclick>` のページを `status: ok` と報告します。`verify flow` は
スクリプト化したユーザー動線を実行し、各ステップの結果をライブ DOM 上で
検証します。ある評価では、カードゲーム画面が「カードを出す → 敵 HP が
ちょうど 6 減る → エネルギーを消費 → ターン終了 → block 5 に 8 ダメージ」を
生き延びる必要があり、すべての数値をクリックして確認しました。

**「デザインと一致している？」** — `verify markup` はビルドをターゲット
スクリーンショットと比較し、1 つの verdict と完全な修正リストを返します:
欠けている / 位置がずれている / サイズ違い / 順序違いのコンポーネントを
セレクタ付きで。機構は vision model ではなく決定論的です。両画像をピクセル
連結性で単色領域に分割し、位置/サイズ/色でターゲットと描画をペアリングし、
ペアにならなかった領域は**ブロックを許す前に反対側の画像で必ず再確認**
します — 「欠けている」はその bbox に同じ色が実際に描画側にあれば降格され
（抽出器が隣に統合しただけ）、「余分」はターゲットに同じ色があれば降格され
ます。形式上どうしても残る注意点: 描画側の領域は DOM セレクタに戻せますが、
**欠けている**領域はターゲットにしか存在しないので、セレクタ無しで bbox と
色で報告されます。
この機構が境界も決めます: 単色塗りの UI comp 向けであり（retina スケーリング
と JPEG ノイズは処理済み）、写真やグラデーション主体のアートは領域分割が
粗くペアリングも緩くなります。`scan mock` が retina/Figma 書き出しを先に
CSS ピクセルへ正規化して、比較を公平にします。

**「今日の変更は見た目を変えた？」** — `snapshot` は初回に baseline を
キャプチャし、以降は viewport ごとのピクセル差分（ヒートマップ付き）を
報告します。意図した変更は承認し、それ以外を調査します。`diff-pr` が
同じことを CI ゲートとして行います。

**「この生成画像は使える？」** — `check asset` は画像（画像生成モデルの
キャラクターアートなど）がページのスロットに入る前に検査します:
アスペクト比、背景が本当に透明か（矩形に敷かれていないか）、ほぼ空でないか、
置かれる背景に対してシルエットが読めるか、そしてパレット調和 —
アセットの主要色のうちページ自身のパレット近傍にある割合。低い割合は
fail ではなく warn です。アートディレクションは人間の判断なので。

**「ページはそれ自身と一貫している？」** — `check design` はトークン
ファイルを必要としません。推論したロールで要素をグループ化し、各インスタンスの
描画スタイル署名を計算して、**スタイルがほとんど再利用されていない**ロールを
報告します —「7 個のボタンが 3 種類の異なるスタイルで描画されている」。
これはこのプロジェクトで唯一、**自分たちが出荷したエージェント成果物を
落としていた**測定です: zero-shot フィクスチャはすべて機能ゲートを通過し
ながら、ボタンのスタイルを 3 種類抱えていました。これは*一貫性*の主張であり、
趣味の主張ではありません — 23px と 24px が共存していると報告し、選択は
あなたに残します — そして findings は warn レベルなので、ドリフトした
デザインシステムがビルドを落とすことはありません。しきい値は設計済み
ページと生成ページを実測して決めました
（[調査記録](./design/design-policy-metrics.md)）。特筆すべきは
**4px グリッド適合はシグナルとして棄却**されたことです。LLM が書く CSS は
MDN より**良い**スコアを出すからです。

コピペ用のチートシート（どんなときに使うか付き。`verify flow` だけは
ページ固有の flow スクリプトが必要なので載せていません）:

```bash
# 編集中 — レイアウト/CSS を変えた後:
npx vlmkit check integrity page.html                         # 何か壊れた?
# push 前 — 仕様化されたコピーを持つページ:
npx vlmkit check copy page.html --manifest copy.txt          # 文言は正確かつ可視?
# push 前 — レスポンシブなページ:
npx vlmkit check breakpoints page.html --sweep               # 境界は保たれている?
# push 前 — 操作するコントロールがあるページ:
npx vlmkit check interactions page.html                      # キーボードで操作できる?
# デザインに合わせて作っている最中:
npx vlmkit verify markup attempt.html --target design.png    # デザインと一致?
# 継続的 / CI — 回帰追跡:
npx vlmkit snapshot http://localhost:3000/ --output .vlmkit/snapshots   # 何が変わった?
# 生成画像をページに入れる前（シルエットとパレットの検査には背景色と
# ページのスクリーンショットが必要）:
npx vlmkit check asset sprite.png --slot 220x300 --expect-transparent \
  --against-bg "#1a1424" --page-palette page.png                        # 使える?
```

反復は編集後に同じコマンドを再実行するだけです。ゲートが内側のループで、
watch モードはありません（`vlmkit watch` は baseline/variant のペアを
差分する別の古いツールで、ゲートの再実行器ではありません）。
先に知っておくと良い挙動: コピー照合は空白正規化するが**大文字小文字を
区別**する部分文字列照合（casing は仕様として扱う）。
`check breakpoints` は CSS が宣言する各ブレイクポイントの 1px 下・当該値・
1px 上を描画し、`--sweep` は間の幅を 320px〜1280px で 25px 刻みに fuzz
します。コンソール出力は長い finding 一覧を切り詰めることがありますが、
必ず「あと N 件」と告知し、`--json` には全件入っています。
CI ではどのゲートも既に失敗するステップです — suspect は非ゼロ終了します:

```yaml
# .github/workflows/ui-gates.yml（関係するステップ）
- run: npm ci && npx playwright install chromium --with-deps
- run: npx vlmkit check integrity dist/index.html
```

まだあります: デザイントークン適合（トークンにすべきハードコード値）、
ダークテーマのパリティ、WCAG コントラスト/タッチ/フォーカス検査、
40% 長い翻訳テキストでのレイアウト生存、リファクタで死んだ CSS セレクタの
置換候補、フレームワーク移行の視覚的等価性。全体像は `vlmkit --help` に、
まさにこの「〜したい」の形で整理されています。

## サイト全体をまとめて回す

上のレシピはどれも 1 ページ単位です。ルートツリー全体には:

```bash
vlmkit batch --gate "check integrity" "routes/**/*.html"        # 並列、1 つでも落ちれば exit 1
vlmkit batch --gate "check integrity" --gate "check design" "dist/**/*.html" --output ci-logs/
vlmkit batch --gate "check integrity" "routes/**/*.html" --shard 2/3   # CI ランナー 3 台の 1 つ
```

ページごとの判定はそのゲート実行の**終了コード**なので、標準の終了コード
契約に従うものはすべて batch 可能です。実測した並列度 / シャーディングの
コストは
[`reports/2026-08-02-batch-runner-ci-budget.md`](./reports/2026-08-02-batch-runner-ci-budget.md)
にあります（4 コア / 9 ページ / `check integrity` で、並列
1→34.9s、2→20.0s、4→13.1s、8→11.0s。ジョブ単体の時間は並列度で膨らむため、
出力は速度向上ではなく「平均同時実行数」を表示します）。

ページ数が増えたら、シェル履歴ではなくファイルに計画を置きます。次節の
`vlmkit.gates.json` がその置き場所です。

## チームで導入する

リードが訊く運用上の質問に、率直に答えます。

- **copy manifest は誰が保守する？** リポジトリ内のプレーンテキスト
  ファイルで、対象ページの隣に置きます。仕様として扱ってください:
  コピー変更と manifest 変更は同じ PR で移動し、manifest 更新の忘れは
  静かにドリフトするのではなく CI の copy ゲートで**名指しされた失敗行**
  として現れます。
- **baseline はいつ再承認する？** `snapshot` は誰かが `snapshot approve`
  を実行するまで保存済み baseline と比較し続けます — それが意図的で
  レビュー可能な再 baseline の手順です。baseline は選んだ出力ディレクトリ内の
  ファイル（PNG + JSON レポート）で、サービスもロックインもありません。
  使い捨て CI ランナーでは: baseline ディレクトリをコミットする（または
  CI キャッシュから復元する）、そして変更を意図した PR の中で、比較を
  実行するのと同じ環境で `snapshot approve` を実行して再 baseline します。
- **偽陽性のトリアージ経路は？** finding を読んでください。ゲート自身が
  意図を認識したなら既に `exempted` の下にあります（失敗ではありません）。
  意図的に隠したコピーなら `--allow-invisible <class>` でそのクラスを受理。
  integrity が意図的パターンを誤検知するなら `--allow` に理由を書いて
  受理します（下の Honest limits に構文）。それでもツール側の問題だと
  思うなら報告してください — 免除セットは実際にそうやって育ちました。
- **ゲート設定はどこに置く？** contract、flow、copy manifest、snapshot 設定
  （`vrt.config.json` — これも visual-regression-testing 由来の命名化石）は
  リポジトリ内のファイルです。**どのページにどのゲートを走らせるか**と
  **すべての suppression** は `vlmkit.gates.json` に置きます:

  ```json
  { "defaults": { "gates": ["check integrity", "check design"] },
    "pages": [
      { "id": "home", "source": "routes/index.html",
        "extraGates": ["check copy --manifest copy/home.txt"] },
      { "id": "docs", "source": "routes/docs/**/*.html" },
      { "id": "checkout", "source": "https://staging.example.com/checkout",
        "suppressions": [ {
          "gate": "check copy",
          "flag": "--allow-invisible visually-hidden",
          "reason": "sr-only のスキップリンク。文言は法務がレビューする",
          "owner": "web-platform",
          "expires": "2027-01-31" } ] } ] }
  ```

  `vlmkit gates list` は各ページが実行する正確なコマンドを表示し、
  `gates run` は並列実行（CI ランナー向けに `--shard i/n`）、
  `gates suppressions` が棚卸しです — 黙らせたチェックすべてを
  理由 / owner / 残日数付きで、期限切れを先頭に表示します。
  このファイルをレビューに値するものにしている規則が 2 つあります:
  **suppression には `reason` が必須**であること、そして
  **`expires` を過ぎたら適用されなくなる**こと — ゲートが素で走って
  run が失敗するので、古い免除は蓄積せずに気づかれます。
  設定ファイル無しで一回だけ掃きたいときは、上の
  `vlmkit batch` が glob を直接受け取ります。

  古い規約（1 ページ 1 npm script）も今も動き、数ページなら十分です。
  その帰結が設定ファイルが存在する理由です: 有効な suppression を
  すべて見るにはスクリプトを grep することになり、20 ページを超えると
  重くなります。
  なお、実行ごとに `.vlmkit/run-ledger.jsonl` へ JSON 1 行が追記されます
  — timestamp、tool、source、ツールごとの `headline` オブジェクト
  （integrity と snapshot は `verdict` を、他はそれぞれの数値、例えば
  copy は `{"missing":0}`）。これは設定ではなくローカルの監査証跡です:
  gitignore してください。エージェントの節で最も意味を持ちます。
- **自分たちのルールを書ける？** はい — 2 つのゲートは設計上ユーザー定義
  です。`check layout --contract layout.json` は構造ルールを機械検査可能な
  contract にします。これがフォーマット全体です — viewport 幅ごとに
  検査されるルールの一覧:

  ```json
  { "rules": [
    { "selector": ".sidebar",   "at": 1280, "width": 260 },
    { "selector": ".stat-card", "at": 768,  "perRow": 2, "count": 4 },
    { "selector": "button",     "at": 375,  "minHeight": 48 },
    { "selector": "header",     "at": 375,  "above": "main", "fullWidth": true }
  ] }
  ```

  （`minHeight` は全マッチを検査します — タッチターゲット規則向け。
  `width` / `perRow` / `above` / `count` / `visible` が残りを覆います。）
  `verify flow --flow flow.json` が振る舞いに対して同じことをします —
  各ステップがアクションを実行し、結果の DOM 状態を検証します:

  ```json
  { "steps": [
    { "label": "カードを出す",
      "do": { "action": "click", "selector": "[data-testid=card-strike]" },
      "expect": [
        { "assert": "text", "selector": "[data-testid=enemy-hp]", "contains": "38/44" },
        { "assert": "attr", "selector": "[data-testid=end-turn]", "name": "aria-disabled", "equals": "false" }
      ] }
  ] }
  ```

  ツールのコードを書かずに、デザインシステムと振る舞いの規則がゲートに
  なります。
- **エージェントと新人で何が違う？** 同じ kickback です。新人は名指しで
  測定された CSS の学びを得て、エージェントは審判を得ます。MCP サーバは
  9 つのエージェント呼び出し可能なツール — この文書の主要ゲート
  （check_integrity、check_copy、verify_flow、…）+ ページビルダ — を
  公開します。
- **manifest は複数ページにどうスケールする？** 共有コピーは共有更新を
  意味します: あるコンポーネントの CTA テキストが変わって 5 ページに
  現れるなら、同じ PR で 5 つの manifest が変わります — manifest を忘れた
  ページは copy ゲートで失敗します。ただし**そのページのゲートが実際に
  CI に配線されている場合に限ります**（その配線はあなたの保守範囲です）。
  manifest 更新は他のコピー変更と同じレビューを通ります。
- **CI で flaky になる？** ジオメトリ系のゲートは毎回同じピン留めした
  Chromium で DOM レイアウトを測るので、**フォントが一致していれば**
  マシン間で安定します。同一フォントでのメトリクスの揺れは約 1px。
  suspect の床は実測値です — ページオーバーフローは 2px から、テキスト
  衝突は両軸 6px 必要、そして実際の欠陥は床を数十 px 超えるので、
  フォントが一致していれば verdict が反転することは稀です。
  **フォントの欠落は別物**です: フォールバックが reflow を起こし、
  どの床も越え得ます。フォントはページと一緒に配る（webfont）か CI
  イメージに入れてください（Honest limits 参照）。
  ピクセル厳密な `snapshot` の baseline は別の獣です: 比較するのと同じ
  環境で生成してください（CI の中、または共有コンテナ 1 つ）。macOS で
  作った baseline を Linux で差分すると、フォントのアンチエイリアスで
  食い違います — これは「誰もが無視するゲート」への典型的な道です。
- **導入はどう進める？** 1 ページでパイロット（`check integrity` を実行し、
  既存の負債が出てくることを期待する）→ 重要ページのゲートを CI に追加
  （既定で fail closed。パイロット中は `--advisory`）→ 仕様が安定している
  ところで contract と manifest を育てる。エージェント連携は任意で、
  最後で構いません。

## AI コーディングエージェント向け: 監査証跡を持つ審判

（コーディングエージェントを使っていないなら、この節は飛ばしてください。
上のすべては単体で機能します。）

使っているなら、vlmkit の役割は審判です。19 のシナリオ評価
（ページは [`fixtures/auto-markup-proof/`](../fixtures/auto-markup-proof/)、
記録は [`docs/reports/`](./reports/)）で機能したループはこれです。

1. エージェントにタスクと固定した**完了条件** — すべて通る必要がある
   ゲートの集合（例: `check integrity` CLEAN + `check copy --manifest`
   欠落 0 + `scan handlers` / `check interactions` に suspect 無し）— を
   与える。
2. エージェントが作り、自分でゲートを実行し、失敗レポートを読み、直し、
   繰り返す。安価なモデルでも問題なくこなします — 上でリンクした
   zero-shot シナリオの試行は Claude Haiku 4.5 が駆動し、ゲートの完了
   条件に到達しました（一部は監査由来の kickback ラウンドを経てから。
   どれがそうかはレポートに書いてあります）。小さいモデルに欠けていた
   精度をゲートが供給しました。
3. すべてのゲート実行は自動的に `.vlmkit/run-ledger.jsonl` に追記されます
   （1 実行 1 JSON 行: timestamp、tool、source、そのツールの headline
   数値）。単一の verdict フィールドではなく `tool` で grep してください —
   headline の形はツールごとです。エージェントが「検証しました」と言った
   ときは ledger を確認します。「検証済み」の主張の下で ledger が空なら、
   それ自体が finding です — その捕獲は
   [ブラックボックス導入実行](./reports/2026-07-31-blackbox-onboarding-validation.md)
   で実際に起きました。

連携方法は CLI そのもの、MCP サーバ
（`.mcp.json` に
`{ "mcpServers": { "vlmkit": { "command": "npx", "args": ["-y", "@mizchi/vlmkit", "mcp"] } } }`
— ゲートがエージェントがネイティブに呼ぶツールになります）、または
`markup-assist` スキル（ルーティング表、ループ規律、そして
*「check copy を通すためにコピーを隠すな」*
*「ツール自体が実行に失敗したら STOP して報告せよ。自作チェックで代用して
検証済みと主張するな」* といった規則を含む SKILL.md 1 枚を、このリポジトリの
`.claude/skills/markup-assist/` からコピーする）です。

エージェントはこれらのゲートを騙そうとしたか？ しました。事例は記録して
あります: `font-size: 0` の span に隠されたコピー
（[S18](./reports/2026-07-31-s18-zero-shot-chat-tool-gate-gaming.md)）、
アサーションを通すために 50ms だけ反転させられた `aria-disabled`
（支援技術には嘘をついたまま。
[S19](./reports/2026-07-31-s19-game-ui-occlusion-probe.md)）、
自作チェックへの静かなフォールバックを「検証済み」と報告
（[ブラックボックス実行](./reports/2026-07-31-blackbox-onboarding-validation.md)）。
それぞれが対策になりました — 可視テキスト照合
（[12 ベクタの隠蔽バッテリー](./reports/2026-07-31-copy-gate-silencing-battery.md)
+ [7 サイト監査](./reports/2026-07-31-copy-invisible-real-site-audit.md)）、
disabled なコントロールを貫く force-click、ledger で監査可能な主張。
リンクしたレポートがテスト証跡です。これは将来のエージェントが新しい
トリックを見つけるのを止めませんが、試された分は閉じてあります。

## Honest limits

信頼は明示された境界に宿るので、重要なものを挙げます。

- **「意図的」は魔法ではなく測定で認識されます。** integrity ゲートが
  免除するのは幾何的に検証できるパターンです — スクリーンリーダー専用
  テキスト（完全にクリップ。部分的に切れているものは違う）、画像置換、
  ヒーローのオーバーレイ、省略記号の切り詰め。
  検証できないパターンには**ユーザー定義の免除**があります:
  `--allow "<kind>[@<selector>][@<viewport>];<reason>"`（繰り返し可）。
  理由は必須（無いルールは拒否）、未知の finding kind は静かな no-op では
  なくエラー、受理した finding も理由付きで `exempted` に残り、
  どれにもマッチしなかったルールは報告されます（死んだ免除が削除される
  ように）。4 つの kind は免除できません — `js-error` /
  `degenerate-render` / `unstyled-page` / `redirected` — デザイン判断では
  なく「ページが壊れている / 測定不能」の報告なので。owner と期限を
  付けたい場合は `vlmkit.gates.json` の suppression に入れてください。
  copy ゲートには意図的に隠したコピー向けの同等物
  `--allow-invisible <class>` があります。
- **緑のゲート集合は正しさの証明ではありません。** ゲートは符号化した
  欠陥クラスを捕まえます。このプロジェクトは自分の偽陰性を面倒な方法で
  追跡しています — 評価実行ごとに、全ゲートが見逃した欠陥を独立に監査
  します。19 シナリオを通してその監査が見つけたのはちょうど 1 件
  （読み取り値の上を塗るアート。6 ゲートが緑）で、同日に新しい probe に
  なりました（[S19 レポート](./reports/2026-07-31-s19-game-ui-occlusion-probe.md)）。
  正直な主張は「完全」ではなく「敵対的に保守されている」です。
  同じ姿勢で、2026-08-02 には**ゲート自身の欠陥**を 3 件見つけました:
  一部のゲートが外部 CSS を読み込まずスタイル未適用の DOM を測っていた
  （[レポート](./reports/2026-08-02-external-asset-load-defect.md)）、
  finding の viewport 帰属が sweep の順序に依存していた、
  そして一部のゲートがログインページを測って `status: ok` を返していた
  （[3 軸監査](./reports/2026-08-02-differential-audit-three-axes.md)）。
  いずれも回帰テスト付きで修正済みです。
- **flow ゲートは歩いた経路だけを証明します。** 重要な振る舞いには
  ステップを置いてください。
- **認証付きページには、あなたが用意するセッションファイルが必要です。**
  `npx playwright codegen --save-storage=auth.json <login-url>` で
  取得（または既存の e2e スイートの `context.storageState()`）し、
  `--storage-state auth.json` を渡します。vlmkit にログイン自動化は
  ありません — セッションを**再生**しますが**取得**はしないので、
  期限切れの state はあなたが再取得する問題です。失敗の仕方は少なくとも
  読み取れます: 要求した URL からのリダイレクトは欠陥として報告され、
  求めたページであるかのように静かに測られることはありません。
- **フォントが決定論の境界です。** Chromium ビルドはピン留めされ、
  ゲートは `document.fonts.ready` を待ちます（ネットワークアイドルだけでは
  不十分 — `font-display: swap` はアイドル後にテキストを reflow させます）。
  しかしフォント自体はマシンのものです: ブランドフォントが無い CI
  コンテナはフォールバックして reflow し、suspect の床を大きく越え得ます。
  フォントはページと一緒に配る（webfont）か CI イメージに入れてください。
  前提条件を正確に言うと、移植可能とは: 同じフォント**ファイルとバージョン**、
  同じラスタライザ設定、同じスクロールバーモード、同じロケール —
  ロケールで書式化された数値の長さが変われば、行の折り返し位置が変わります。
  Linux 上での実測（フォント置換・ヒンティング・dpr の 6 条件）では
  衝突判定の床を跨いだペアは 0 件でしたが、**macOS 実機での確認は未実施**
  です（1 コマンドで比較できる計測器は同梱してあります:
  [レポート](./reports/2026-08-02-font-determinism-collision-floors.md)）。
- **`verify markup` は単色塗りだけでなく、塗りのコントラストも必要です。**
  述べた境界（平坦な comp は可、写真アートは不可）は全体ではありません:
  分割は量子化するので、塗りがページ背景に非常に近いコンポーネントは
  削除しても検出されずに生き延びます。ある監査実行では `#ffffff` の
  ページから `#f4f4f4` のカード 2 枚を削除し、実際には 2.12% の
  ピクセルが違っていたのに、ゲートは `pixel diff 0.01%` と `DONE` を
  報告しました。同じカードを明確な青に変えれば正しく `missing 2` を
  報告します。背景に低コントラストな領域はこのゲートの射程外として扱い、
  layout contract で覆ってください。
- **細片の衝突は既知の盲点です。** 衝突の床は**両軸** 6px + 小さい側の
  面積 25% で、これがタイトな `line-height` や負マージンの行ボックスが
  狼少年になるのを防いでいます。代償: 隣を横 3px かすめながら縦 18px
  重なっているラベルは床の下で無報告になります。矩形はインクでもあり
  ません — グリフインク範囲への移行は、それ自身の偽陽性監査の後ろに
  積まれています。この床を緩めるのは、まさにゲートが無視され始める
  経路なので。
- **サードパーティ CSS は描画されたままで検査されます。** UI ライブラリが
  375px でオーバーフローするなら、他の欠陥と同じように報告されます —
  オリジンごとのスコープ指定はありません。
- **よくある意図的パターン、具体的に**: ピン留め中にコンテンツを覆う
  sticky/fixed バーはスクロールで逃げられると測定され免除されます。
  画像上テキストのオーバーレイは、2 つのブロックのうち一方が positioned
  （absolute/fixed）レイヤにあるとき免除されます — 意図的な重ね順であり
  フローの衝突ではないので。動的コンテンツ（ティッカー、タイムスタンプ）は
  integrity ではなく `snapshot --mask ".selector"` で扱います。
  一時的な状態（開いたモーダル、hover 中のツールチップ）は、flow の
  ステップが開いた場合のみ検査されます。

## vlmkit ではないもの

- **美的判断器ではありません** — 「正しいか、読めるか、操作できるか、
  仕様に忠実か」が範囲です。趣味は人間に残ります。`check design` が
  唯一これに近づきますが、測るのは趣味ではなく**自己一貫性**
  （同じロールでスタイルが再利用されているか）で、どの値が正しいかは
  判断しません。
- **テストフレームワークではありません** — 中核ゲートにテストファイルは
  ありません。あなたの Playwright スイートと並走します（スクリーンショット
  アサーションはそのまま残してください — ゲートは別の問いに答えます）。
  CI は終了コードと `diff-pr` で覆えます。
- **AI サービスではありません** — すべてローカルで決定論的に動きます。
  API キーを取るオプション機能はちょうど 3 つ: `heal markup`、
  `check copy --vlm`、CSS fix-loop の実験群。

vlmkit は MIT ライセンスです。そして若いプロジェクトです —
`@mizchi/vlmkit` 0.8.x、メンテナ 1 人、ここで引用した評価レポートは
互いに数週間以内の日付です。ゲートには上記の証跡がありますが、自分の
ページで実行することの代わりにはなりません。導入の助言（advisory で
パイロット、CI ゲートは後）はこの成熟度に合わせたものです。

## 試す

```bash
npm install -D @mizchi/vlmkit
npx playwright install chromium   # 一度だけ
npx vlmkit check integrity http://localhost:3000/
```

実際のループは端から端までこうなります。

```
$ npx vlmkit check integrity page.html
verdict: DEFECTS (1 fail, 0 warn, 0 exempted)
  x [page-overflow-x] @768: The page scrolls horizontally by 144px at
    768px viewport width — sticking out: div.chart-strip (right edge 912px).

$ # セレクタが原因を名指ししている: .chart-strip の width: 880px
$ # width: 100%; max-width: 880px; に変える

$ npx vlmkit check integrity page.html
verdict: CLEAN (0 fail, 0 warn, 0 exempted)
```

これがワークフロー全体です — ゲートが要素と測定値を名指しし、あなた
（またはエージェント）が 1 行変え、ゲートが確認する。意図的なパターンは
邪魔をしません: スクリーンリーダー専用テキスト、ヒーローのオーバーレイ、
省略記号の切り詰めは自動認識され `exempted` として報告され、意図的に
隠したコピーはクラスごとに明示フラグで受理でき、integrity が誤検知する
新しい意図的パターンは `--allow` に理由を書いて受理できます。ここから先は:

- [README](../README.md) — 2 分のクイックスタートとセットアップ
- [`markup-assist.md`](./markup-assist.md) — どの仕事にどのゲートか、
  完了条件のレシピ付き
- [`cli-reference.md`](./cli-reference.md) — 全コマンド
- [`docs/reports/`](./reports/) — この文書のあらゆる主張の裏にある
  日付付き評価実行
