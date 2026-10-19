# Inbox: the new-message notification

`page.html` is the inbox of a mail app. When the page loads, a notification card
("New message from Dana") should drop in from just below the dark top bar, at its
right edge: 200ms after load it moves down 24px into place and fades in over
420ms, decelerating (ease-out), and then it STAYS on screen over the page,
fully visible, until the user dismisses it (no dismiss control is needed here).

A reviewer says: "I never see the notification. The rest of the page is fine."

Fix the page so the notification behaves as described, without changing the
rest of the page's look (the top bar stays 64px tall and dark; the mail list
stays where it is). The viewport is 1280x800.
