# Projects: the account menu

`page.html` is a project dashboard. It is captured with the account menu open:
300ms after load the menu under "Sam Rivera ▾" scales up from 92% and fades in
over 240ms, easing out, anchored at its top-right corner, and then stays open.
All four items (Profile, Billing, Team settings, Sign out) must be readable at
rest, drawn over the page content below it.

A reviewer says: "The menu animation plays, but then I can only see the top of
it — the rest is behind the 'Projects' banner."

Fix it without changing how the page looks with the menu closed (the banner,
cards and nav keep their look and position). The viewport is 1280x800.
