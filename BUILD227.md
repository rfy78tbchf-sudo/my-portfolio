# Build227 — current-asset start, future scenarios and automatic 15th actuals

User correction: initialize from current app assets, show future amounts and arrival dates, automatically record every 15th, and allow only scenario inputs.

## Result

- Replaces manual asset/base/month entry with an automatic `wealth_auto_plan`. The initial current-app total and Korean start date are persisted once; refreshes, scenario changes and later visits never rebase it. Existing Build226 manual records remain intact under their separate keys.
- Current assets, start-relative increase/rate and this year's STD/BEST target achievement are visible. Annual goals compound from the fixed starting amount; the first year uses the remaining fraction of the year. Future projections compound from the current asset amount, with year-end amounts for ten calendar years and the next monetary milestones. These are scenario projections, not annualized extrapolation from a short realized history. No future contributions are added separately.
- Only STD/BEST annual rates can be edited (0–100%, BEST >= STD). Save failures/conflicts retain inputs. A 0% scenario has no target-increase attainment denominator and no future higher milestone date. Excessively large projection values remain unavailable instead of overflowing.
- Monthly rows use the 15th and show amount, start-relative growth amount/rate. Automatic recording runs without the app being open. First actual for the initialized 2026-10-28 plan is 2026-11-15.
- Existing on-demand YTD stock impact TOP3 and collapsed technical analysis remain available. Formula/source details stay collapsed; important missing-source status is concise.

## Persistence and scheduler

`wealth_auto_growth.sql` creates `wealth_monthly_observations` with ownership RLS and SELECT-only access for authenticated users; ordinary clients cannot insert or change actuals. Public authenticated invoker RPCs initialize/read the dashboard, read scoped as-of sources, and update scenarios with revision conflict checking. The private service-only collector sets and restores the source owner's subject, never accepts an arbitrary public user ID, and stores at most one row per owner/date.

The collector queries as-of source snapshots and manual account observations before the Korean end-of-day cutoff. The exact primary observation date must be the 15th. Future primary/ISA observations cannot leak backward. Same-day records remain provisional; the next run after the date closes finalizes them. Finalized records are immutable to later cron runs; missing dates are retried without substituting another day's balance. ISA uses the existing app account-scope source and may have an older observation date; no new ISA valuation is invented.

Server cron `wealth-monthly-15-capture` runs at minute 25 every hour UTC, using Korean dates inside the function. This keeps same-day updates and missing-data retries independent of app visits. A monthly automation also invokes/verifies the same idempotent collector on the 15th evening and stays silent on normal operation.

The migration `automatic_wealth_fifteenth_and_scenarios` was applied. After verifying exactly one active app owner without exposing identity, the user's current-app plan was initialized on 2026-10-28. The new source reader was checked against the current app total and matched. No historical amounts were fabricated. Cron is active. New schema/functions have no security-advisor findings.

## Validation

- Node arithmetic: partial first year, leap-year days, annual compounding, milestone arrival boundary, 0% scenarios, losses, date rollover and auth-state isolation passed.
- Database synthetic transaction, fully rolled back: baseline matches current app scope, immutable repeat start, scenario-only updates, conflict/idempotent retry, historical primary/manual cutoff, exact 15th capture, no duplicate actual, no stale-day substitution, write grants, two-user isolation, and scheduler subject restoration passed.
- Chromium 390/402/430 at 100%/125%: no asset inputs, automatic read, ten-year projections, scenario change/failure/retry/conflict, no baseline drift on updated current assets, unchanged 15th actuals, read retry, TOP3 and no horizontal overflow passed. Korean screenshots inspected; attainment labels use an unbroken separate line.
- 127 decision/navigation regressions passed. Full Chromium five-screen regression passed.
- The workflow tests this final source in Chromium and WebKit before main promotion. Local WebKit remains unavailable due to missing host libraries. Physical iPhone/PWA lifecycle testing is separate.

Build markers: 2026-10-28-auto-wealth-227 / 2026102806-227.
