# Dashboard dogfood brief

## Pattern

Operational dashboard: dense KPI cards, filter/search form, chart region,
tabular pipeline, and secondary alerts panel.

## Contract

- Viewports: desktop 1440x900 and mobile 390x844, DPR 1.
- Source of truth: semantic data hierarchy, repeat counts, and responsive
  layout, not exact chart texture.
- Header, primary navigation, main dashboard, search/filter form, named
  regions, table, and complementary panel should be recoverable from DOM.
- KPI cards and table rows should expose repeat/content evidence.
- Table viewport may scroll horizontally on small screens.
- Mobile should collapse the dashboard grid into one column while preserving
  semantic order.

## Expected signal

`contract introspect --pattern dashboard --goal app` should recover
landmarks, content/repeat metadata, and responsive rules. `build component
--goal app` should accept practical landscape convergence without requiring
pixel-perfect chart/table rendering.
