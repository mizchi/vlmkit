# vlmkit intro page

vlmkit 自身を紹介する、依存なしの静的ページです。このページ自体を vlmkit の
markup loop、決定論的ゲート、Playwright VRT で検証します。ヘッダーから
日本語・英語と Light・Dark を切り替えられ、選択は再読み込み後も維持されます。

GitHub Pages: <https://mizchi.github.io/vlmkit/>

このリポジトリの Pages サイトは複数ページで構成されています。紹介ページが `/`、
DnD とアニメーションのドッグフード対象である Klondike solitaire が `/solitaire/`、
エージェントが作った6つのデモサイトとその一覧が `/sites/` です
(`examples/sites/`)。紹介ページ自身の視覚レビューの記録は `/judgment/` に、
各デモサイトの記録は `/sites/<name>/judgment/` に公開されます。
公開されるファイルの一覧と URL は `scripts/build-pages.mjs` の `siteSections` が唯一の定義で、
`tests/pages-site.test.mjs` が検証します。

## 判断の記録 (`judgment.sqlite`)

このページの見た目の判断は `judgment.sqlite` の1ファイルに残っています。ゲートの実行結果は全文、
スクリーンショットは1画面1枚、そのそれぞれに「何が見えたか」の記述が付き、欠陥はそれを
見つけたのが目かゲートかを必ず記録します。画像は、終わったラウンドごとに幅ごと1本のフルページ
撮影だけを残します (見たものの記述はすべて残ります)。記録の書き方は `examples/sites/PROTOCOL.md`、
ツールは `examples/sites/judge.mjs` です。`JUDGMENT.md` は同じ記録をテキストにしたもので、
公開ページ (`/judgment/`) にリンクしています。

```sh
node examples/sites/judge.mjs examples/vlmkit-intro-page status
node examples/sites/judge.mjs examples/vlmkit-intro-page render   # JUDGMENT.md と judgment/ (ページと画像、コミットしない)
```

ページを変えたら、新しいラウンドでゲートと全画面のショットを取り直し、見たものを記録してから
`done` します。`examples/sites/sites.test.mjs` は、記録が自分の完了条件を満たし、データベースが
残すべき画像とゲート出力をちょうど持ち、コミット済みの `JUDGMENT.md` が記録から再生成したものと
一致することを検証します。

まずリポジトリルートで vlmkit をビルドします。

```sh
pnpm build
```

サンプルのタスクは justfile にまとめています。

```sh
just --justfile examples/vlmkit-intro-page/justfile
just --justfile examples/vlmkit-intro-page/justfile serve
```

決定論的ゲート、ページ単体のコントラクト、日本語Light・英語Darkの
desktop/mobile VRT:

```sh
just --justfile examples/vlmkit-intro-page/justfile gates
just --justfile examples/vlmkit-intro-page/justfile test
just --justfile examples/vlmkit-intro-page/justfile pages
```

`serve` と `pages` はどちらもサイト全体を対象にします。`serve` のルーティングは
`siteSections` から生成されるので、`/solitaire/` もローカルでそのまま開けます
(以前はハードコードされた一覧に無いパスが `/` に 302 されていました)。

`gates` は `vlmkit.gates.json` に宣言した英語／日本語 × Light／Dark の4状態を
すべて `check integrity` と `check a11y contrast` で検証します。テーマ切替後だけ
発生する低コントラストも、このマトリクスを通らない限り公開できません。

`main` にサンプルまたは Pages workflow の変更を push すると、契約テストを通過した
実行時ファイルだけが GitHub Pages に自動デプロイされます。

## デモ静止画 (`demo-solitaire.png`)

「02 / PLAYABLE PROOF」セクションが載せている solitaire の静止画は手動撮影ではなく、
`capture-demo-still.mjs` が生成します。カードゲームのスクリーンショットは配りと手順で
変わるため、手で撮ると再現できません。このスクリプトは `../solitaire/solve.mjs` の
勝ち筋を探索し、その先頭 N 手をページ自身の `commit` で再生してから撮るので、
画像は (seed, 手数) の関数になります。

```sh
node examples/vlmkit-intro-page/capture-demo-still.mjs                  # seed 1, 60手, 1024x660
node examples/vlmkit-intro-page/capture-demo-still.mjs --seed 4 --plies 80
```

`index.html` の `<img>` の `width` / `height` は出力サイズと一致させてください
(ずれると読み込み中に確保される領域が変わり、セクションがずれます)。

観測済み UI から plan・Playwright テスト生成・VRT をやり直す場合は
`OPENROUTER_API_KEY` を設定して markup loop を実行します。

```sh
just --justfile examples/vlmkit-intro-page/justfile markup-loop
```
