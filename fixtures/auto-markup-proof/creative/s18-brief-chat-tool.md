# Creative brief — "Relay" team chat tool (S18, zero-shot)

There is NO reference design. Layout, palette, and typography are
yours — but the page must satisfy every requirement below and pass
the deterministic gates. All copy is quoted verbatim in this brief;
`s18-copy-manifest.txt` carries the same lines for
`check copy --manifest`.

This is a tool-style web app (a team chat client): an app shell with
a persistent sidebar that collapses to a hamburger drawer on small
screens via a CSS media query. The responsive transformation is the
point of this scenario — it is gated by `check breakpoints`, not just
eyeballed.

## App shell

The page is an app shell: it fills the viewport height and the page
itself never scrolls. The only scrolling regions are the message list
(vertically, inside its own container) and — if the channel/DM lists
grow — the sidebar nav (vertically, inside the sidebar). The page
must never scroll horizontally at any width.

## Sidebar (desktop regime, viewport width ≥ 768px)

A persistent left sidebar, always visible, containing top to bottom:

1. Workspace header: brand "Relay" and the team name "Nordwind Team".
2. Section heading "Channels", then a nav list of channel links:
   - "# general"
   - "# design" — carries an unread badge showing "3". The badge must
     also be understandable to assistive tech (e.g. visually-hidden
     text or an `aria-label` conveying 3 unread messages).
   - "# engineering" — the current channel (`aria-current="page"`),
     visually distinguished.
   - "# random"
3. Section heading "Direct messages", then a list:
   - "Mara Lindqvist" — with an online-status dot (decorative,
     `aria-hidden` or equivalent).
   - "Jonas Weber"
   - "Aiko Tanaka"
4. A real `<button>` labeled "Invite teammates" pinned at the sidebar
   bottom.

## Mobile regime (viewport width < 768px)

The sidebar is hidden. A top header bar shows the brand "Relay" and a
real `<button>` labeled "Menu" that toggles the sidebar as a drawer:

- The button carries `aria-expanded` (**"false" by default**) and
  `aria-controls` pointing at the drawer element.
- Activating it reveals the full sidebar content (same channels, DMs,
  and "Invite teammates" as desktop) as an overlay drawer; activating
  it again closes the drawer and restores `aria-expanded="false"`.
- The drawer overlays the content — opening it must not push the page
  into horizontal overflow.
- Keyboard operable (it is a real button); JS runs without errors.

The breakpoint is exactly 768px: at 768px and above the persistent
sidebar shows and the "Menu" button is hidden; below 768px the
sidebar hides and the "Menu" button shows. Behavior at the boundary
must be well-defined — no width at which both or neither navigation
affordance is visible.

## Main pane (all widths)

Top to bottom:

1. Channel header: title "# engineering", the topic line
   "Deploy notices and build talk", and the member count
   "12 members".
2. **Message list** — scrolls vertically inside its own container;
   the newest message is visible without scrolling the page (start
   the scrollport scrolled to the bottom, or keep the list short
   enough — your call, but the composer must stay visible). Four
   messages, each with author name, a time, and body text, exactly:
   | Mara Lindqvist | 09:12 | Deploy 2026-07-31.2 is live on staging. |
   | Jonas Weber | 09:15 | Nice — smoke suite is green on my end. |
   | Aiko Tanaka | 09:24 | Heads up: the CDN purge takes about 5 minutes. |
   | Mara Lindqvist | 09:31 | Rolling to production at 15:00 UTC. |
3. **Composer** pinned below the message list: a labeled text input
   or textarea (accessible name "Message #engineering") and a real
   `<button>` labeled "Send".

## Hard requirements

- Self-contained single HTML file (inline CSS/JS, no external
  requests).
- No page-level scrolling: vertical scrolling happens only inside
  the message list (and sidebar nav if needed); horizontal scrolling
  happens nowhere, at any viewport width — including widths between
  the standard three (the breakpoint sweep will fuzz them) and with
  the mobile drawer open.
- Use every copy line EXACTLY as written (spelling, casing, "#"
  prefixes with the space, "2026-07-31.2", "15:00 UTC", "09:12"
  time format, and the em dash "—" in Jonas's message).
- All controls (channel links, DM links, "Invite teammates", "Menu",
  "Send") must be real links/buttons — reachable and operable by
  keyboard, no clickable `<div>`s.
- No text may collide with or be cut off by other elements at 1280,
  768, or 375px width.

## Done condition (deterministic)

- `check integrity <attempt.html>` → verdict CLEAN (default 3
  viewports).
- `check copy <attempt.html> --manifest s18-copy-manifest.txt` →
  0 missing, 0 placeholders.
- `scan scroll <attempt.html>` → no `page-overflow-x` suspect (the
  message-list scrollport is expected).
- `scan handlers <attempt.html>` → no pointer-only-control suspects.
- `check interactions <attempt.html>` → no suspect issues.
- `check breakpoints <attempt.html> --sweep --fail-on-suspect` →
  exit 0 (no boundary or sweep suspects).
