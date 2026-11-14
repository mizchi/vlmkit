# Brief: video platform — "Reelhouse"

- **Directory**: `examples/sites/video/`
- **Pattern**: interactive app — video feed and a watch page with a custom player
- **Language**: English
- **Implementation**: MoonBit with `mizchi/luna`. Read [`../LUNA.md`](../LUNA.md) first.

## What it is

**Reelhouse**, a fictional video-sharing site. There are two pages, both built from the same luna
program, and the program reads which one it is from the page:

- `index.html`, the home feed. `?q=` shows search results.
- `watch.html?v=<id>`, the watch page.

The site has about 24 seeded fictional videos on space, cooking, music and travel. Each has a title,
a channel, views, an age written as fixed text, a duration and a chapter list.

There are no real media files and no network. A **thumbnail** is a composition drawn in CSS or SVG
(gradients, shapes and a big glyph), seeded from the video's id. The **player** draws the same
scene, animated by the player's current time.

## Reference study

The pattern is the big video site. Measured at 1280×800:

- The header is 56px tall: a hamburger, the logo, a centred search box about 540px wide joined to a
  64px search button, a round mic button, a kebab menu and an outlined "Sign in" pill.
- A 72px mini-guide rail on the left: Home, Shorts, Subscriptions and You, each an icon over a
  10px label. The hamburger swaps it for a 240px full guide.
- Search results: a chip bar (All, Shorts, Unwatched, Videos, Recently uploaded, Live) and
  "Filters" on the right.
- Each search result row: a 500×280 thumbnail with rounded corners and a duration badge at its
  bottom right. Beside it, the title, "31M · 14y ago", a channel row with an avatar, a 2-line
  snippet and a ⋮ menu.

## Home and search

- **Header**:
  - The hamburger toggles between the mini rail and the full guide. The full guide lists Home,
    Subscriptions, You, then Explore: Trending, Music, Gaming, News. On phones it is a drawer.
  - The search box shows a clear (×) button once there is text, and recent-search suggestions as a
    combobox.
  - The mic button is decorative and opens a "Voice search isn't available" tooltip.
- **Chip bar**: All, Space, Cooking, Music, Travel, Live, Recently uploaded. It filters the grid.
  It scrolls horizontally, with arrow buttons at its ends once it overflows. One chip is selected,
  and the selected chip is filled.
- **Home grid**: cards in 4, 3, 2 or 1 columns.
  - Each card: a thumbnail with a duration badge, the channel avatar, the title clamped to 2 lines,
    the channel name and "views · age".
  - A card's ⋮ menu: Add to queue, Save to Watch later, Not interested, Share.
  - "Not interested" collapses the card into a row that says "Video removed", with an Undo button.
- **Search results**: the list layout from the reference study, with 2-line snippets and the query
  in bold.

## Watch page

- **Player** (16:9, with rounded corners):
  - Controls: play/pause, next, mute with a volume slider that slides out on hover or focus, the
    time "1:23 / 9:41", a captions (CC) toggle, settings, theater mode and full screen.
  - Full screen calls `requestFullscreen` on the player when the browser allows it.
  - The scrubber shows progress plus a lighter "buffered" bar, and chapter gaps.
  - Hovering the scrubber shows a time tooltip with the chapter name. Clicking or dragging seeks.
  - Keyboard while the player has focus: Space or k plays and pauses, j and l seek 10s,
    ←/→ seek 5s, m mutes, c toggles captions, f is full screen, t is theater, and 0–9 jump to
    0–90%.
  - Captions show a seeded line for the current time.
  - Controls auto-hide 2.5s after the last pointer move while playing, and stay visible while
    paused or focused.
  - Time advances only while playing. The scene animates from the current time. Reduced motion
    keeps the scene still, but time still advances. `?animate=0` starts paused at 0:00 with no
    autoplay. The default also starts paused, and nothing changes until Play.
  - Theater mode widens the player to the full content width and moves the up-next list below it.
- **Below the player**:
  - The title, and a channel row: avatar, name, "1.2M subscribers" and a Subscribe toggle. When
    subscribed it becomes "Subscribed" with a bell menu: All, Personalized, None.
  - A like/dislike segmented pair whose counts change and whose state is pressed.
  - Share opens a dialog with a link and "Start at 1:23". Save opens a playlist checklist dialog.
- **Description box**: views, the date, the description clamped to 3 lines, and "...more" to expand
  (and "Show less"). The chapters inside are links that seek.
- **Comments**: the count, "Sort by" (Top comments / Newest first) and an "Add a comment..."
  field. Focusing the field reveals Cancel and Comment, and Comment adds your comment at the top.
  Seed about 12 comments; some have replies behind a "N replies" toggle.
- **Up next** (the right column on desktop; below the comments on narrow screens): compact rows
  with a thumbnail, title, channel and views, and an "Autoplay" switch at the top.

## Theme and phones

- Light by default, dark under `prefers-color-scheme: dark` or `?theme=dark`. Both pass AA.
- Phones: the grid is 1 column, the rail is hidden, and the header collapses search into an icon
  that expands to the full width. On the watch page the player is full width at the top, and the
  description is a sheet.

## Required copy

```
Reelhouse
Sign in
Subscribe
Subscribed
Add a comment...
Up next
Autoplay
Video removed
...more
```

## States to show (final round)

- The home grid at desktop, tablet and mobile sizes, with the full guide expanded.
- A card's ⋮ menu, and a removed card with Undo.
- Search results for "moon".
- The watch page paused, then playing with the controls showing, captions on, and the scrubber
  tooltip.
- Theater mode.
- The description expanded.
- Subscribed, with the bell menu.
- A comment being written.
- Dark theme.
- The watch page on mobile.

## Gates this brief leans on

- `check interactions`: menus, dialogs, the player's keyboard shortcuts.
- `scan handlers --probe-drag`: scrubbing.
- `check animation` / `check motion`: the auto-hiding controls, the scene, reduced motion.
- `check a11y focus`.
- `check a11y touch`: control sizes.
- `check a11y contrast` in both themes.
- `check scroll` / `scan scroll`: the chip bar.
- `check breakpoints --sweep`: the grid column changes.
- `check design`: one card component.
- `stress data`: long titles, many comments.
