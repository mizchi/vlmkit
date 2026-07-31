# S17 — zero-shot checkout + synthesis of the real-world-pattern axis (2026-07-31)

Third and final planned leg of the zero-shot real-world-pattern axis
(S15 product page, S16 dashboard). Same protocol: Haiku, brief-only,
five key-free gates, independent verification by a second reader.

## Scenario

`fixtures/auto-markup-proof/creative/s17-brief-checkout.md` —
"Alpenrad" checkout. Pattern payload: three `fieldset`/`legend`
sections, typed inputs with `autocomplete` tokens, radio payment
group, a closed `<details>` delivery note (state-sweep continuity),
a terms checkbox gating a genuinely `disabled` submit button, native
`required` validation, and an order summary with four exact cost
rows. 31 manifest lines.

## Result — DONE, independently verified

| KPI | value |
|---|---|
| Write rounds (ledger-audited) | 2 (draft: integrity 2 fails; fix → clean) |
| Tokens | 59,654 |
| Wall time | 301 s |
| Tool calls | 29 |
| Final gates | integrity CLEAN (0/0/3) · copy 0 missing (1 revealed-only) · scroll ok · handlers ok · interactions 0 suspects |

Verifier probes, all pass:

- **Consent gate is real**: submit `disabled` on load; Space on the
  terms checkbox flips it to enabled. Real attribute, not styling.
- **Form semantics**: 0 unlabeled controls (checked `for`/`id`,
  wrapping, aria); `autocomplete` present on all six specified
  fields (`email,tel,name,street-address,postal-code,address-level2`);
  `form.checkValidity()` false while required fields are empty —
  native validation is armed.
- **States**: delivery-note details closed (its textarea label passes
  as the run's 1 revealed-only line — the sweep again), payment radio
  group has exactly one checked.
- **Layout**: two-column at 1280, summary-first stacking at 375,
  disabled button correctly grayed. Screenshots read at both widths.

## Finding — the arithmetic hole, and a false verification claim

The brief carried an authoring bug: it demanded exact copy
"Subtotal €1,299.00", "Shipping €29.00", "Total €1,335.89" while
also asserting "Subtotal + Shipping = Total" — but 1,299 + 29 =
1,328.00, a €7.89 mismatch (leftover from an earlier draft of the
brief's VAT treatment).

Two observations, one per party:

1. **The agent silently satisfied the contradiction and then claimed
   to have verified it** — its final report states "4 cost rows with
   verified arithmetic (€1,299 + €29 + VAT €207.37 = €1,335.89)",
   an equation that is false on its face (and double-counts VAT the
   brief marked as included). Copy-exactness won over numeric sanity,
   and the verification claim was fabricated. Consistent with the
   S16 lesson (wrong rationale about probe internals) and the
   standing rationalization series: **agent self-verification
   language is not evidence.** Recomputation by the verifier is.
2. **No gate can catch this class**: numeric consistency between
   copy lines is semantic, not structural. The correct fix is at
   authoring time (brief numbers must be generated from one source
   of truth), not a new gate — same category as the S11 carrier
   omission (作問ミス). Recorded as a brief-authoring checklist
   item, not a tooling gap.

## Axis synthesis — S15 + S16 + S17

| Leg | Patterns | Rounds (write) | Tokens | Wall | Verdict |
|---|---|---|---|---|---|
| S15 product page | breadcrumb, sale price, radios, stepper, tabs, closed FAQ, sticky bar, table | ~2 (5 integrity iter) | 49.7k | 188s | DONE, verified |
| S16 dashboard | drawer nav, aria-pressed filters, sortable table, container scroll, disabled pagination | 2 | 56.2k | 266s | DONE, verified |
| S17 checkout | fieldsets, autocomplete, radio group, consent-gated submit, native validation, summary | 2 | 59.7k | 301s | DONE, verified |

Conclusions for the axis:

1. **Zero-shot real-world patterns are inside Haiku's range** across
   all three page archetypes — commerce detail, admin table, dense
   form — at ~50-60k tokens and ≤5 minutes each, with at most one
   substantive fix round. The 1px-endgame wall that blocks Haiku on
   pixel-target scenarios never appears when the referee is a gate
   suite instead of a screenshot.
2. **The five-gate done condition held without modification** for
   all three archetypes; no scenario needed a new gate to be
   meaningful. Behavioral truth (sorting, filtering, consent gating)
   still needs verifier probes — the gates check operability, not
   application semantics.
3. **The disclosure-state sweep is now proven across all three legs**
   (11, 1, and 1 revealed-only lines): collapsed-by-default UI ships
   collapsed. The S14a incentive bug stays dead.
4. **Gate-silent visual defects: 0 across six consecutive
   verification passes.** The Layer B (VLM advisory) demand gate
   remains unmet — the freeze holds.
5. **Recurring risk is narrative, not markup**: each leg produced one
   wrong or fabricated agent claim (S15 round undercount, S16 wrong
   probe rationale, S17 false arithmetic verification). The
   ledger-plus-reprobe verification protocol caught all three at
   trivial cost; treat it as mandatory, not optional.
