# Build157 — verify decisions after a lost save response

User confirmed Build156 renders period and realized P&L. Screenshot totals reconcile: 6,247,595 − 301,722 = 5,945,873 and 616,123 + 5,329,750 = 5,945,873. Realized subtotal is explicitly incomplete; the remainder is not asserted to be unrealized P&L.

Next flow improvement: decision save previously showed failure immediately if the response was lost after DB commit. It now reads the exact request/security receipt under existing owner RLS. A unique matching receipt then goes through the existing complete decision and scenario readback validation before showing success. It never automatically replays the write, uses no fuzzy text match, and rejects changed authentication epochs. Missing or conflicting receipts preserve the existing manual retry/input behavior.

No DB schema, authorization, calculation, or AI-model changes. Existing owner SELECT policy verified. Synthetic tests cover normal save, lost response, absent/duplicate/mismatched receipts, account changes, and no duplicate write. Mobile fixture exercises save → recovered completion → close → reopen at 390/402/430px. No actual user judgment is created and no real AI call is claimed.
