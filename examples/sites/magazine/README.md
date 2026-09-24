# ほとり — 海辺の町の古本屋が、夜だけ店を開ける理由

A vlmkit demo site: one long-form feature article (about 3,000 Japanese characters) in
**ほとり**, a fictional web magazine. The article visits 宵待書房, a second-hand bookshop in the
fictional seaside town of 凪浦 that opens at sunset and closes at midnight. The town, the shop,
the people and the magazine are all invented.

Served at `https://mizchi.github.io/vlmkit/sites/magazine/`. Static files only, no build step, no
network requests, no web fonts: every image is inline SVG, and the type uses system font stacks
(Mincho for the body text on devices that have one, Gothic for headings and UI).

The log of how the page was built and judged (every gate run, screenshot, defect and fix) is in
`judgment/`.

## What is on the page

- Masthead: wordmark, section navigation (特集 / 暮らし / 旅 / 本 / インタビュー), and a 検索
  button that opens a small search panel over this issue's four articles.
- A thin reading-progress bar fixed to the top edge. It tracks the article (header to notes).
- Article header with a drawn illustration of the shop at night, category 本, title, lede, byline,
  date and reading time.
- Four sections with a figure, an interview passage with the speakers marked, a pull quote and a
  shop-information box. Three footnote references jump to the notes (注), and each note links
  back. Links in the prose are underlined, not only coloured.
- After the article: リンクをコピー (the confirmation 「リンクをコピーしました」 appears in a live
  region), a 保存 toggle (`aria-pressed`), the author card, and three related articles.
- The section links, the footer links and the related-article links point at `#`: only this
  article exists.

## URL parameters

| Parameter | Effect |
|---|---|
| `?animate=0` | Turns off the easing on the progress bar, so it jumps straight to each scroll position. The same happens under `prefers-reduced-motion: reduce`. |

Nothing else animates. The bar's easing switches on at the reader's first interaction (wheel,
touch, key or pointer), so a page that opens mid-article (a `#note-2` link, a restored scroll
position) puts the bar straight at its place instead of sweeping it on load.

## Files

| File | Contents |
|---|---|
| `index.html` | The article, markup and inline SVG artwork |
| `style.css` | All styling (tokens on `:root`, breakpoints at 700px and 1000px) |
| `main.js` | Classic script: progress bar, search panel, copy link, 保存 toggle |
| `copy.txt` | The brief's required copy, one line each, for `vlmkit check copy --manifest copy.txt` |
| `flow.json` | `vlmkit verify flow index.html --flow flow.json`: the search panel (open, submit, Escape), the リンクをコピーしました confirmation, and the 保存 toggle both ways |
| `judgment/` | The judging log (written by `examples/sites/judge.mjs`, not by hand) |
