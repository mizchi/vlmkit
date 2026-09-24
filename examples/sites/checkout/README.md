# Pantry Club checkout

The sign-up and checkout flow of **Pantry Club**, a fictional weekly meal-kit
subscription, built as a vlmkit demo. One static page walks through four steps:
Plan, Delivery, Payment and Review, then a confirmation. **It is a demo: no
payment is taken and nothing you type leaves the page.** No network requests, no
storage, no clock. Every price, date and the order number are fixed sample data.

## Try it

- Plans: 2 people · 3 meals ($59.94), 4 people · 3 meals ($107.88), 2 people · 5 meals ($94.90).
- Card: `4242 4242 4242 4242` (the number is Luhn-checked), any expiry from `10/26` on, any 3-digit CVC.
- Promo: `WELCOME10` takes 10% off the first box; any other code is rejected.
- Tax is 8% of the discounted subtotal and shipping is free. The renewal line shows the full weekly price.
- Press Continue on an empty step to see the error summary. Every field re-validates as you leave it after that.

## URL parameters

| Parameter | Effect |
|---|---|
| *(none)* | Starts at step 1. |
| `?step=2`, `?step=3`, `?step=4` | Opens that step. The earlier steps are filled in with the sample customer (Jordan Rivera, Portland OR, Tuesday delivery, test card). The later steps are left empty. |
| `?step=done` | Opens the confirmation for the sample order (PC-20417). |

The deep links exist so that a reviewer, or a vlmkit gate, can open any step
directly. The gates render a page in its default state, and that is where the
parameters come in. `flow.json` always starts at step 1 and fills everything
in itself.

## Files

| File | What it is |
|---|---|
| `index.html` | The page: all four steps, the order summary, the confirmation. |
| `styles.css` | All styling. Tokens on `:root`; one layout breakpoint at 960px (sidebar vs. collapsible summary) plus 480/560px refinements. |
| `app.js` | Step navigation, validation and the error summary, input formatting, promo code, totals, review, deep links. Classic script, works from `file://`. |
| `copy.txt` | The brief's required copy, one line per row, for `vlmkit check copy --manifest copy.txt`. |
| `flow.json` | A 34-step `vlmkit verify flow` script that completes the whole checkout. It covers validation, re-validation on leave, focus moves, the promo rejected and accepted, the billing reveal, the Edit round-trip, the terms error and the confirmation. |
| `judgment/` | The log of how the page was judged, written by `examples/sites/judge.mjs` (do not edit by hand). |

## Accessibility notes

- Each step is its own `<form>` with an `h1` that receives focus when the step changes. The step list is an `<ol>` with `aria-current="step"`.
- Validation errors go to a summary at the top of the step, which takes focus and links to each field. Each field gets `aria-invalid`, a message tied with `aria-describedby`, an icon and a thicker border, so the error never depends on colour alone.
- Radio cards and checkbox tiles are native inputs stretched over the whole card, so the focus ring and the touch target belong to the real control.
- Blur re-validation is held back while a mouse button is down and runs as the click lands. Showing or clearing an error therefore never moves a control out from under the pointer.
- One light theme (the brief asks for white and warm greys). Transitions are switched off under `prefers-reduced-motion`.
