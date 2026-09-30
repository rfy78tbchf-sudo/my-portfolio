# Build104 — Broker-native overseas unit prices

The existing SPQM2226 request uses `std_crncy_f=2`; its average/current unit fields are KRW-sized even when the instrument currency says USD. Dividing the KRW acquisition amount by today's FX is only a reference average and differs from the broker's foreign-currency acquisition average.

Add a separate read-only SPQM2226 request with `std_crncy_f=1`, keeping `exch_r_aplc_f=2` and `fee_clsf=0`. A public transcription of the KB specification was used to locate the option (https://github.com/nkwoo/kbsec-mcp/blob/ca54ee07d8735afe2322f4bbe3ebfb37b8014801/spec/source/kbsec-openapi.postman_collection.json); the live broker response was then verified before enabling display. The official API-market page requires login.

The second request cannot replace accounting values: original KRW valuation, cost, FX, P&L and totals stay sourced from the original response. Optional native evidence is stored under `provider_payload.native_prices` and projected by PostgREST without retrieving the full payload.

Accept evidence only for a unique symbol/market/currency match with equal positive quantity, valid positive prices, acquisition amount consistent with native average × quantity, and a current-price unit-scale check against the KRW request. Duplicate lots and unmatched rows fall back. The native request times out after 12 seconds; failure does not block the balance snapshot. The frontend checks currency, quantity, source and observation-to-snapshot timing before showing native prices.

Validation: read-only live comparison, native evidence saved for six currently held foreign securities, unit tests for rejected mismatches/invalid values/scale errors/fallback and unchanged accounting, plus mobile CI rendering. No database schema or authorization changes. Worker retains existing authenticated-user or internal scheduler-key checks. The diagnostic action returns only selected price fields through those same checks.
