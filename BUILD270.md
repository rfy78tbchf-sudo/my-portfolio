# Build270 — preserve domestic settlement quantities

Baseline main 89e97ef / worker v84 and completed main CI/Pages were freshly checked. No competing active run was found. This is a narrow collector safety change; existing whole-account definitions and UI Build266 remain unchanged.

Domestic integrated rows must contain settled/effective quantity evidence and both pending legs before any storage call. Missing, invalid or negative evidence rejects the entire response and preserves prior observations with their existing timestamps. It does not silently omit a row or create a zero. Present fractional aliases are used by the evidence writer.

Synthetic actual-worker tests: 16 malformed cases reached storage 6 times before and 0 after; six existing valid scenarios pass. A literal fractional quantity 0.5 remains 0.5 instead of evidence zero. Genuine zero, complete empty response, pending full sale and mixed holdings remain supported. The older fixture now explicitly supplies pending-buy zero; its previous omission was not valid complete settlement evidence.

Current stored domestic raw-field presence was checked read-only; no missing required field was observed. This does not prove every future broker response is complete. No broker refresh or historical financial rewrite was invoked.

Remaining: shared position/NAV response binding and complete-batch provenance, original-currency cash/FX and ISA historical openings. Foreign evidence and historical unknowns are not repaired by this domestic guard. Whole-account A/B remains unverified. Missing evidence now fails sync rather than pretending success. Exact-commit full CI and actual deployment must be checked before delivery.
