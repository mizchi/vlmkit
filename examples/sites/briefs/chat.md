# Brief: AI assistant chat — "Parley"

- **Directory**: `examples/sites/chat/`
- **Pattern**: interactive app — conversational AI chat UI
- **Language**: English
- **Implementation**: MoonBit with `mizchi/luna`. Read [`../LUNA.md`](../LUNA.md) first.

## What it is

**Parley**, a fictional AI assistant. Its chat window follows the pattern of the big assistant
chat apps: a history sidebar, one conversation, and a composer at the bottom. The real apps sit
behind a login, so this brief describes the pattern rather than a screenshot. One page,
`index.html`, with a conversation already in progress: "Planning a lunar observation night". The
assistant's replies are canned and deterministic. A reply chosen from the prompt's keywords is
"streamed" in, a few words at a time.

## Layout and behaviour

- **Sidebar** (left, about 260px):
  - "New chat" at the top, and a search field that filters conversation titles.
  - History grouped under "Today", "Previous 7 days" and "Older", with about 12 seeded titles.
    The current conversation is marked with `aria-current`.
  - Each history row has a ⋯ menu: Rename, Delete (asks for confirmation), Archive.
  - A collapse button hides the sidebar. Collapsed, a narrow rail keeps "New chat" and "Expand".
- **Header**: a model picker, a menu button with three fictional models ("Parley Swift",
  "Parley Deep", "Parley Mini"), each with a one-line description and a check on the current one.
  Also a "Share" button that opens a small dialog with a fake link and "Copy link".
- **Conversation** (a centred column of at most 760px):
  - User messages are right-aligned bubbles. Assistant messages are full-width text with an avatar.
  - Assistant text renders a small subset of Markdown: paragraphs, **bold**, `inline code`, bulleted
    and numbered lists, a heading, a table, and fenced code blocks.
  - A code block has a language label and a "Copy" button that says "Copied" for 2s.
  - Each assistant message ends with a row of actions: Copy, Regenerate (re-streams the same canned
    reply), Good response and Bad response (toggle, pressed state), and "Read aloud" (decorative).
  - Each user message has an Edit action. It turns the bubble into a textarea with Cancel and Send.
- **Composer**, stuck to the bottom of the conversation:
  - A textarea that grows to about 8 lines, then scrolls. Placeholder: "Message Parley".
  - Enter sends. Shift+Enter inserts a newline. Send is disabled while the box is empty or only
    whitespace.
  - While a reply streams, Send becomes "Stop generating". Stopping leaves the partial reply with
    the note "Stopped".
  - An attach (+) button opens a menu: "Upload file" and "Take screenshot", both decorative.
  - Below the composer, the small print: "Parley can make mistakes. Check important info."
- **Streaming**: a reply appears a few words every 50ms, with a blinking caret, and then settles.
  `?animate=0` and `prefers-reduced-motion` render it whole at once. Keep the text and the timing
  deterministic: a fixed number of words per tick, never `Math.random`.
- **Scrolling**: when the user scrolls up from the bottom, a round "Scroll to bottom" button
  appears above the composer. New text does not yank the view down while the user is scrolled up.
- **New chat**: the empty state. A greeting ("What can I help with?") and four suggestion cards.
  Clicking a card fills the composer and sends it.
- **Theme**: light by default, dark under `prefers-color-scheme: dark` or `?theme=dark`. Both pass
  WCAG AA.
- **Phones**: the sidebar becomes an off-canvas drawer, opened from a menu button, with focus trapped
  and Escape closing it. The composer stays at the bottom, and the conversation takes the full width.

## Visual direction

Calm and roomy. Lots of white or near-black, one restrained accent colour for the send button and
focus rings, a readable 16px body at line-height 1.6, monospaced code blocks on a tinted panel, and
soft separators rather than boxes.

## Required copy

```
Parley
New chat
Today
Previous 7 days
Planning a lunar observation night
Message Parley
Parley can make mistakes. Check important info.
Stop generating
What can I help with?
Copy link
```

## States to show (final round)

- Desktop and mobile views of the in-progress conversation.
- A reply mid-stream, with "Stop generating" showing.
- A stopped reply.
- The model picker open.
- A history row's menu open.
- The share dialog.
- The empty "New chat" state with suggestions.
- The mobile drawer open.
- Dark theme.
- The "Scroll to bottom" button.

## Gates this brief leans on

- `check interactions`: menus, dialog, the Enter / Shift+Enter keyboard contract.
- `check a11y focus`: drawer and dialog focus traps.
- `check a11y contrast` in both themes.
- `check scroll` / `scan scroll`: the conversation scroller and the sticky composer.
- `check animation` / `check motion`: the streaming caret, reduced motion.
- `verify flow`: send a message, see a reply, stop one mid-stream.
- `check design`: one message component per role.
- `stress data`: long messages, empty history.
