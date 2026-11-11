# Build110 — Keep chart choices while browsing securities

The detail journey now carries the selected chart preset (1/3/6/12 months or all) and moving-average choices to the previous/next security. Each chart computes the preset from its own latest stored date; it never reuses another security's prices, cursor, or exact zoom window. Manual zoom/pan remains local to the current security, with the last chosen preset applied on navigation. Reset updates that preset to All.

Unavailable averages remain disabled and unchecked without deleting the user's selection, so the choice returns on a security with sufficient history. Empty/failed price responses do not overwrite the choices. Closing detail ends the journey; a new entry uses the existing All and 20/60 defaults. Performance period context is independent.

Validation: production-renderer synthetic mobile tests cover a 160-point ARM chart, a two-point LLY chart, and a 160-point RXRX chart: 3-month selection, 5/120 enabled, 20 disabled, unavailable 120 on LLY, restored 120 on RXRX, and latest-date readout. The existing navigation, form cancellation, chart gestures, and detail regression suite also runs. No owner-authenticated phone verification is claimed.
