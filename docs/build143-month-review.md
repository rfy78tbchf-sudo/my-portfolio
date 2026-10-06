# Build143 — bounded month sync and visible due reviews

The rolling broker history window stays at most two months: current month first plus the previous month on days 1–7; current month only afterwards. November does not append September. January rolls into December of the previous year. Old completed history remains stored. In-memory success timestamps outside the active window are pruned.

Home now places saved-decision review before price-watch and holdings browsing. A review with an evidenced condition match or due date opens automatically; up to three attention items are visible and the remainder are expandable. Ordinary records remain collapsed. Existing condition evaluation, evidence-version checks and latest-decision-per-held-security filtering are unchanged.

Synthetic validation covers November 1/7/8, January rollover, leap-year March, a ten-year maximum-two-month bound, and three visible attention records with the remainder retained. Existing sync and review regression tests pass. This bounds broker month requests, not the future runtime of all database queries as history grows.
