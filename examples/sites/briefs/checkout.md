# Brief: multi-step checkout — "Pantry Club" meal-kit subscription

- **Directory**: `examples/sites/checkout/`
- **Pattern**: multi-step form / checkout
- **Language**: English

## What it is

The sign-up and checkout flow of **Pantry Club**, a fictional weekly meal-kit subscription. One page,
`index.html`, walking through four steps. A notice says plainly that it is a demo and takes no
payment. Nothing is sent anywhere.

## Layout and behaviour

- **Steps**: 1 Plan · 2 Delivery · 3 Payment · 4 Review, shown as an ordered list with the current
  step marked (`aria-current="step"`). Continue and Back buttons; moving to a step puts focus on its
  heading.
- **1 Plan**: three plans as radio cards (2 people · 3 meals a week, $59.94; 4 people · 3 meals a
  week, $107.88; 2 people · 5 meals a week, $94.90), dietary preferences as checkboxes (Vegetarian,
  No pork, Dairy-free, Nut-free) and a delivery-day select.
- **2 Delivery**: full name, email, phone (optional), address line 1, address line 2 (optional),
  city, state (select), ZIP code, and delivery instructions (optional, with a 200-character
  counter). Use the right `autocomplete` values.
- **3 Payment**: card number (grouped in fours as you type), expiry MM/YY, CVC and name on card; a
  "Billing address is the same as delivery" checkbox, checked by default, whose unchecking reveals
  the billing fields; a promo code field — `WELCOME10` takes 10% off, anything else shows an error.
- **4 Review**: every choice summarised with an Edit link back to its step, a terms checkbox, and
  "Place order", which replaces the form with a confirmation: order number PC-20417 and the first
  delivery date.
- **Validation**: Continue on an invalid step shows an error summary at the top of the step with
  links to each field, marks each field (`aria-invalid`, message tied with `aria-describedby`, an
  icon and text — not colour alone) and moves focus to the summary. After the first attempt, fields
  re-validate as they are left.
- **Order summary**: a sidebar that stays in view on desktop and is a collapsible "Show order
  summary" panel on phones; it follows the plan, the promo code, free shipping, tax at 8% and the
  total.
- Also write a `flow.json` for `vlmkit verify flow` that completes the whole checkout.

## Visual direction

Trustworthy and friendly: white and warm greys, one forest-green accent, large tap targets, text
fields whose boundaries are clearly visible, strong focus states, and errors that are impossible
to miss without being alarming.

## Required copy

```
Pantry Club
Choose your plan
Delivery details
Payment
Review your order
Order summary
Continue
Place order
This is a demo. No payment is taken.
Thanks — your first box is on its way.
```

## States to show (final round)

Each of the four steps on desktop; step 2 with validation errors; the promo code accepted and
rejected; the billing fields revealed; the confirmation; step 3 on a phone with the order summary
expanded.

## Gates this brief leans on

`check color` (text-field boundaries, WCAG 1.4.11), `check a11y focus` (focus moves between steps and
to errors), `check a11y touch`, `check interactions` (radio cards, checkboxes, reveal, errors),
`verify flow` (the whole checkout), `check layout` or `check scroll` (the sticky summary).
