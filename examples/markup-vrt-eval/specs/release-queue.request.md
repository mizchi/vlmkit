# Release Queue VRT Smoke

Create one Playwright smoke test for the Release Queue screen.

## User intent

- Open the Release Queue screen.
- Confirm the dashboard spine and release summary are visible.
- Apply the `Blocked` release filter.
- Open `Invoice Export` details.
- Confirm the detail panel updates to `Invoice Export`.
- Capture deterministic screenshots for the initial screen and the blocked-detail goal state.

## Constraints

- Use observed accessible roles, labels, exact text, and test ids from the UI.
- Prefer semantic assertions before screenshot assertions.
- Use `gotoApp(page)` for initial navigation.
- Do not use bare `page.getByText(...)` for release names because names may appear in both the table and the detail panel.
- Use release row test ids or accessible row action buttons for candidate-row assertions and interactions.
- Do not use CSS or XPath locators.
- Keep this to one primary smoke scenario.
