# Brief: long-form magazine article — 「ほとり」 web magazine

- **Directory**: `examples/sites/magazine/`
- **Pattern**: editorial long-form article
- **Language**: Japanese (`lang="ja"`)

## What it is

One feature article in a fictional web magazine, **ほとり** (hotori — "the water's edge"):
**「海辺の町の古本屋が、夜だけ店を開ける理由」**, about a second-hand bookshop in a small seaside
town that opens only from dusk until midnight. One page, `index.html`. Write the article yourself:
about 3,000 Japanese characters of real, readable prose — not placeholder text.

## Layout and behaviour

- **Masthead**: the magazine's wordmark, section navigation (特集 / 暮らし / 旅 / 本 / インタビュー) and
  a search button. A thin reading-progress bar at the very top grows as the article is read.
- **Article header**: a large drawn illustration (inline SVG — the shop at night), the category
  label 本, the title, a lede, the byline 文・写真 三浦 灯, the date 2026年9月12日 and the reading
  time 約8分.
- **Body**: three or four `h2` sections; a pull quote; a figure with a caption; an interview passage
  with the speakers marked; two or three footnote references that jump to notes at the end, each
  note with a link back. Links in the prose must be distinguishable by more than colour.
- **After the article**: an author card, a "copy link" button that confirms 「リンクをコピーしました」
  in a live region, a 保存 toggle (`aria-pressed`), and three related articles with drawn images.
- **Footer**.
- **Motion**: the progress bar is the only motion; it respects `prefers-reduced-motion`.

## Visual direction

Editorial and quiet: an off-white page, a deep ink colour, one restrained accent, generous margins
and line spacing (around 1.9 for body text), a measure of roughly 35–40 full-width characters on
desktop, and a clear typographic hierarchy between headings, body, captions and notes. Body text
prefers a Mincho serif on real devices (this machine has none — see the protocol); headings may be
Gothic.

## Required copy

```
ほとり
海辺の町の古本屋が、夜だけ店を開ける理由
文・写真 三浦 灯
2026年9月12日
約8分
リンクをコピーしました
関連する記事
注
```

## States to show (final round)

Desktop and mobile full page; mid-article with the progress bar partly filled; the page scrolled to
a footnote after following its reference; the copy-link confirmation; the 保存 toggle pressed;
reduced motion.

## Gates this brief leans on

`check composition` (type hierarchy and grouping over a long page), `check color` (prose links),
`check copy` on Japanese, `check integrity` (Japanese line breaking, clipping), `check scroll`
(the fixed progress bar), `check motion` / `check animation` (reduced motion honoured),
`stress i18n`.
