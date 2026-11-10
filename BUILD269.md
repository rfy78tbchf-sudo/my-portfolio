# Build269 — bind cash to the originating snapshot request

Operational v83 and main 7a257e3 were rechecked. The old cash writer selects the latest observation, independently of the response being saved. A synthetic interleaving of B then delayed A reproduces B=100 instead of its expected 200. No production corruption is asserted.

The candidate service-only RPC resolves the exact observation using the original request timestamp, owned account and matching successful snapshot log timestamp. Missing/ambiguous bindings fail closed; no latest-row fallback. Worker passes the same request timestamp used by snapshot storage. Old RPC remains for compatibility; no historical source records are rewritten by this migration. Position evidence remains a separate unresolved contract.

Fixed literal synthetic expectations: A=100/B=200 after reversed arrival and retry. Wrong owner, missing date/binding and null cash rejected. Build268 malformed balances remain rejected before storage. Full CI is required before main/deployment. No UI/calculation definition change: Pages marker remains Build266.

Next: verify fractional/missing position evidence and shared response linkage; native cash/FX and ISA opening valuations remain incomplete. Whole-account A/B is not verified by this storage fix. Physical iPhone and real broker refresh are not represented by synthetic tests.
