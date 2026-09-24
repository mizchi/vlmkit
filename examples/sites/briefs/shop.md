# Brief: e-commerce product page — 汐見窯 (Shiomi-gama) online shop

- **Directory**: `examples/sites/shop/`
- **Pattern**: e-commerce product page
- **Language**: Japanese (`lang="ja"`)

## What it is

The product page of a fictional pottery studio's online shop, for one mug:
**汐見窯 マグカップ 青磁**. One page, `index.html`, with a working cart drawer.

## Layout and behaviour

- **Header**: the shop name as a wordmark, navigation (新作 / うつわ / 作家 / 読みもの), a search
  button, and a cart button whose badge shows the number of items in the cart.
- **Breadcrumb**: ホーム / うつわ / マグカップ.
- **Gallery**: a large product image and four thumbnails (正面 / 側面 / 上から / 使用例) that switch it.
  The images are drawn with inline SVG or CSS — a mug, in the currently selected glaze. Keyboard
  operable.
- **Product panel**: name, price, rating (4.6, 128件のレビュー), three glaze swatches (青磁 / 白磁 /
  飴釉) whose names are always visible (the colour alone must not carry the choice), a size choice
  (S 240ml / M 320ml), a quantity stepper (1–10), the primary button カートに入れる, a secondary
  お気に入り toggle, the shipping note, and the stock line.
- **Cart drawer**: カートに入れる opens a drawer (a modal dialog) listing the line item with its glaze,
  size and quantity, the subtotal, a レジに進む button and a close button. It traps focus, closes on
  Escape and returns focus; the header badge updates.
- **Details**: an accordion — 商品詳細 / サイズ・容量 / お手入れ / 配送・返品.
- **Reviews**: a distribution of ★5 to ★1 as bars with counts, three reviews (name, fixed date,
  stars, text) and a もっと見る button that reveals three more.
- **Related products**: four cards (plate, bowl, cup, teapot) with drawn images, names and prices.
- **Footer**: a newsletter sign-up (email + 登録), links, and the copyright line.
- **Phones**: the gallery goes full width, and a bar pinned to the bottom of the screen carries the
  price and カートに入れる.

## Visual direction

Calm, warm and crafted: an off-white paper ground, ink-dark text, a celadon accent, generous
whitespace, Japanese typography with room to breathe (line-height around 1.8), tabular figures
for prices.

## Required copy

```
汐見窯 マグカップ 青磁
¥4,180（税込）
128件のレビュー
青磁
白磁
飴釉
カートに入れる
5,000円以上のご注文で送料無料
在庫あり（残り3点）
商品詳細
お手入れ
配送・返品
レジに進む
© 2026 汐見窯
```

## States to show (final round)

Desktop and mobile full page; a different glaze and thumbnail selected; the cart drawer open with
two of the mug in it; one accordion section open; the extra reviews revealed; the pinned bottom
bar on a phone mid-page.

## Gates this brief leans on

`check interactions` (swatches, size, stepper, accordion, drawer), `check a11y focus` (the drawer),
`check a11y touch`, `check color` (swatches must not be colour-only), `check copy` on Japanese,
`check integrity` (Japanese line breaking), `check scroll` (the pinned bar), `check grounding`
(can an agent that only sees the screenshot find カートに入れる?).
