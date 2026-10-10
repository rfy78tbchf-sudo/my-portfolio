# Build184 — Early home performance during initial account loading

Baseline: 885cc6b527d28173ee0415fb5c19c78febebb760 (Build183).

## User outcome

Initial account loading previously withheld selected-period summary/chart and today's account performance until all enrichment reads completed. The startup home reads now publish independently once ready, while the larger analysis bundle continues. Their responses are reused in the larger bundle without duplicate queries. When the selected period is today, its reliable-performance response is also reused for today's card.

The existing order is retained: account/holdings render first; saved-decision review starts early; cash-flow reconciliation and saved settings precede startup home performance reads. This change does not bypass cash-flow reconciliation or alter P&L formulas. Initial-enrichment completion cannot overwrite a newer same-period user query's core result. Account, auth activity, request and KST-date guards protect late publication.

Failed home reads remain distinct from unknown/zero: confirmed home data stays visible, chart failure is not labeled as zero observations, and a local “성과 다시 확인” retries only home sources. Account data, history, decisions and orders are not modified by this read retry.

## Verification

Isolated startup tests cover reconciliation ordering, saved period, early core result during blocked enrichment, no duplicate reads, today's shared gate, local failure/retry, same-period request epoch and account/day isolation. Build153/180 loading, Build182 cache and Build183 staged period regression tests pass. Mobile 390/402/430px coverage added for startup headline/chart before auxiliary completion and failed chart retry. Full CI, screenshot and deployed-file verification pending.

## Remaining limits

Actual physical-iPhone startup/resume/login timings and daily usability are not verified. Reconciliation itself still precedes performance reads; improvements to it require evidence from real query timing and must retain accounting correctness. The next priority is validating the complete ordinary daily visit, rather than adding analysis features or revisiting completed UI work.
