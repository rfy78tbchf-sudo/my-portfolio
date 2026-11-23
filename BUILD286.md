# Build286 — persist effective domestic holdings quantity

The domestic normalizer selected settled shares before effective shares. After a partial sale, unsettled purchase, or same-day sale and repurchase, it could store a settled quantity beside the effective position's valuation and cost. Position evidence correctly remained incomplete, but that warning did not repair the holding row.

Domestic holdings now use the existing effective quantity fields only. They never fall back to settled or orderable shares, including when the effective position is zero. Existing effective ordinary/P6 alias handling is unchanged; conflicting evidence still remains unverified. This does not certify provider field applicability, account identity, whole-account P&L, cash or FX.

Independent synthetic tests exercise pending purchases, partial sales, sale and repurchase, zero effective shares, placeholder aliases and a different orderable quantity through the actual worker and UUID SQL writer. Existing partial-response, sold-row, foreign P&L, ownership and immutable retry guards remain required.

Only subsequent normal collections apply the corrected current holding normalization. No historical balance, finalized monthly record, source payload, transaction, initial baseline or manual financial repair is changed. No new broker calls, collectors, RPCs or schema are added. Pages UI remains Build282. Exact commit CI, worker deployment/source equality and subsequent normal collection must be verified separately; physical iPhone and whole independent A/B remain incomplete.
