# Generation Rules

- Use `gotoApp(page)` for initial navigation.
- Do not call `page.goto(...)` directly.
- Preserve the blocked-filter and `Invoice Export` detail scenario.
- Assert `Release Queue`, `Candidate releases`, and `blocked-count` before interaction.
- Use `getByTestId("release-row-payments-api")` and `getByTestId("release-row-invoice-export")` for release-row visibility.
- Do not use bare `page.getByText(...)` for release names; `Payments API` and `Invoice Export` can appear in more than one panel.
- Click the `Blocked` filter and assert it has `aria-pressed="true"`.
- Open `Invoice Export` details and assert `selected-service` is `Invoice Export`.
- Assert the detail summary text exactly after opening `Invoice Export`.
- Include deterministic screenshots for:
  - the initial loaded screen
  - the blocked-filtered detail goal state
- Use stable screenshot names.
- Do not add comments.
