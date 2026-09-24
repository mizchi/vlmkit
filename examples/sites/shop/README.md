# 汐見窯 — product page demo

The product page of a fictional pottery studio's online shop, for one mug:
**汐見窯 マグカップ 青磁**. Japanese content (`lang="ja"`), static files only, no network
requests; every product image is inline SVG drawn once and recoloured per glaze with CSS
custom properties.

Built as a vlmkit demo from `examples/sites/briefs/shop.md`; how it was judged, round by round,
is in `judgment/` (rendered by `examples/sites/judge.mjs`).

## What works

- Gallery: four views (正面 / 側面 / 上から / 使用例) as an ARIA tablist — click, or arrow keys /
  Home / End on the thumbnails. The mug is drawn in the selected glaze.
- Options: glaze swatches (青磁 / 白磁 / 飴釉, names always shown), size (S 240ml / M 320ml),
  a quantity spinbutton (1–10; arrow keys, full-width digits accepted; above the 3 in stock it
  says the rest are made to order), カートに入れる, and an お気に入り toggle (`aria-pressed`).
- Cart drawer: a modal `<dialog>` listing each line with glaze, size and quantity, the subtotal,
  the free-shipping progress, レジに進む and a close button. It traps focus, closes on Escape or
  a backdrop click and returns focus to what opened it; the header badge shows the item count.
- Details accordion (sections open independently), a review distribution that stays beside the
  reviews on desktop, a もっと見る disclosure for three more reviews, four related items, a
  newsletter form with inline validation, and a search disclosure in the header.
- The empty cart has its own state (a picture, a line of help and 買い物を続ける).
- Phones and tablets (below 900px): the gallery goes full width and a bar pinned to the bottom
  carries the price and カートに入れる; it steps aside while the panel's own button is on screen.

## URL parameters

| Parameter | Effect |
|---|---|
| `?animate=0` | No transitions or animations (the drawer's slide-in, hover fades). `prefers-reduced-motion: reduce` does the same. |
| `?glaze=seiji\|hakuji\|ameyu` | Start with that glaze selected. |
| `?size=S\|M` | Start with that size selected. |
| `?view=front\|side\|top\|use` | Start on that gallery view. |

## Files

| File | What it is |
|---|---|
| `index.html` | The page, including the SVG drawing kit (`<defs>` at the top of `<body>`). |
| `styles.css` | All styles. Palette and glaze colours are custom properties on `:root`. |
| `app.js` | Behaviour (classic script, no dependencies). |
| `copy.txt` | The brief's required copy, one line each, for `vlmkit check copy --manifest copy.txt`. |
| `flow.json` | Cart post-conditions for `vlmkit verify flow index.html --flow flow.json` (10 steps: empty drawer, quantity, add, Escape and focus return, a second variant, remove, close). |
| `judgment/` | The judgment log: gate runs, screenshots, looks, defects and notes. |

汐見窯 is not a real studio; nothing on this page sells anything.
