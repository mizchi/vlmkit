# Creative brief — "Alpenrad" checkout page (S17, zero-shot)

There is NO reference design. Layout, palette, and typography are
yours — but the page must satisfy every requirement below and pass
the deterministic gates. All copy is quoted verbatim in this brief;
`s17-copy-manifest.txt` carries the same lines for
`check copy --manifest`.

This is a form-dense checkout — the hard part is form semantics and
state behavior, not decoration.

## Page structure

Two columns at ≥1024px (form left, order summary right), stacked at
375px (summary first, then the form).

### Form (left)

Page title "Checkout". The form has three `<fieldset>` sections, each
with a `<legend>`:

1. **"Contact"**
   - "Email" — `type="email"`, `autocomplete="email"`, required
   - "Phone (optional)" — `type="tel"`, `autocomplete="tel"`
2. **"Shipping address"**
   - "Full name" — `autocomplete="name"`, required
   - "Street and number" — `autocomplete="street-address"`, required
   - "Postal code" — `autocomplete="postal-code"`, required
   - "City" — `autocomplete="address-level2"`, required
   - "Country" — a `<select>` whose selected default is "Germany"
     (other options are yours to choose)
3. **"Payment"** — three payment options as a radio group (one
   selected at a time, keyboard operable): "Card",
   "PayPal", "Invoice — 14 days". "Card" starts selected.

Below the fieldsets:
- A `<details>` disclosure "Add a delivery note" (**closed by
  default**) containing a labeled textarea "Note for the courier".
- A required terms checkbox with label text exactly:
  "I accept the Terms of Service and the cancellation policy."
- The submit button "Pay €1,335.89 now". It is `disabled` until the
  terms checkbox is checked (JS, must run without errors).

**Validation**: every required field has `required`. On submit with
invalid fields, the browser's native validation may handle messaging
— custom inline errors are welcome but not required. Every input,
select, and textarea MUST have an associated `<label>` (`for`/`id`
or wrapping).

### Order summary (right)

- Heading "Order summary"
- Line item: "Alpenrad Tourer X" with variant line "Glacier White · 1"
  and price "€1,299.00"
- Cost rows, exactly these four:
  - "Subtotal" → "€1,299.00"
  - "Shipping" → "€29.00"
  - "VAT (included)" → "€207.37"
  - "Total" → "€1,335.89"
  (Subtotal + Shipping = Total; VAT is informational — included in
  the total, not added on top.)
- A reassurance line "30-day returns · Free pickup".

## Hard requirements

- Self-contained single HTML file (inline CSS/JS, no external
  requests).
- No horizontal scrolling at 1280, 1024, or 375px width.
- No text may collide with or be cut off by other elements at any of
  the three widths.
- Use every copy line EXACTLY as written (spelling, casing, `·`, `€`,
  "€1,335.89").
- Every form control labeled; radios and checkbox keyboard operable;
  the submit button's disabled state is a real `disabled` attribute
  toggled by the checkbox.

## Done condition (deterministic)

- `check integrity <attempt.html>` → verdict CLEAN (default 3
  viewports).
- `check copy <attempt.html> --manifest s17-copy-manifest.txt` →
  0 missing, 0 placeholders (the delivery-note copy passes via the
  disclosure-state sweep — do NOT ship the details open).
- `scan scroll <attempt.html>` → no `page-overflow-x` suspect.
- `scan handlers <attempt.html>` → no pointer-only-control suspects.
- `check interactions <attempt.html>` → no suspect issues.
