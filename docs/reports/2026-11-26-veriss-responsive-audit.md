# veriss でレスポンシブ fixture を静的検査する

vlmkit 0.27.0 のコミット `468888c5` と veriss の `ad663b006a1a392b5c662ee796405b234d7dec32` で確認した。既知の崩れの期待値には [mutations.json](../../fixtures/responsive-patterns/mutations.json) を使った。今回の実行でブラウザやモデル API は起動していない。

## 既存の fixture をどこまで判定できたか

インラインのスタイルシートを文書順に `analyzeHTML` の `css` に渡し、幅 320–1440、高さ 360–1000 CSS px、overlay scrollbar で検査した。短縮プロパティと個別指定の併用を警告扱いにしてレイアウト検査を継続しても、元の fixture 11 組は **22/22 が Unknown** で、矩形を返したページは 0 件だった。

| fixture | 最初に止まる箇所 |
| --- | --- |
| masthead、drawer | flex item の min-content 幅 |
| card-grid、sidebar-layout | ブロック内の inline 要素 |
| data-table、form-row、media-object、pricing | テキストの自動高さに必要な寸法契約 |
| toolbar | `padding` の `1.5rem` を解決できない |
| hero | `padding` の `max(24px, calc((100vw - 1120px) / 2))` を解決できない |
| container-card | `@container (min-width: 26rem)` を解決できない |

hero の式は文字を持たない空箱の `padding-inline` でも Unknown になり、`24px` は判定できた。container-card のクエリも空箱で再現し、ルートを `font-size: 16px` に固定すると `416px` は判定でき、`26rem` は Unknown になった。どちらも veriss の対応範囲の不足として再現できる。元ページの実行時状態、ブラウザ固有の描画、拡大操作の結果は今回の検査範囲外。

## 数式に落とせた崩れ

pricing の配置を空の 3 セルに縮約すると、元のメディアクエリでは指定範囲を `verified`、タブレット側に `min-width: 769px` を加えた版は `violated` と判定した。veriss の `E_LAYOUT_TRACKS` が返す幅区間は **767 < 幅 < 769 CSS px**。vlmkit の既存 fixture が整数幅で記録していた 768px を含む。768px では 3 列 × 320px + 2 gap × 24px = 1008px が必要だが、左右 16px の padding を引いた 736px しかない。高さ 360–1000px の全域で同じ幅区間が返った。

## veriss の警告集約バグ

単独条件を対照にして確認したところ、複数条件をまとめた結果では警告が先頭の条件に依存して消えた。

| 警告 | 警告が出る単独条件 | 修正前の複数条件 |
| --- | --- | --- |
| `W_LAYOUT_VW_SCROLLBAR` | 15px の classic scrollbar と `width:100vw` | overlay を先頭にすると消える |
| `W_LAYOUT_CLIPPED` | DPR 2 のときだけ固定幅の子がコンテナからはみ出す | DPR 1 を先頭にすると消える |
| `W_A11Y_SMALL_TEXT` | DPR 2 のときだけ文字が 11px になる | DPR 1 を先頭にすると消える |

veriss のローカル修正では各条件の警告と免除を集約し、該当する scrollbar profile と DPR を行に付けた。3 件とも、修正前は失敗し、修正後は条件の両順序で通った。veriss のパッケージテストは全 1,060 件が通過した。ルートのテストでは、macOS に記録データが指定する Linux のフォントファイルがないため、フォント校正の 2 件が失敗した。

## 再実行

別途 checkout した veriss で `pnpm install --frozen-lockfile --ignore-scripts` を実行してから、vlmkit のルートで実行する。

```sh
node fixtures/responsive-patterns/check-veriss.mjs ../veriss
```

出力の `corpus` は元の 22 件の診断、`reducedPricing` は縮約した対照と反例。スクリプトは縮約した料金表の幅区間を assert する。元 fixture の Unknown は出力から追える。
