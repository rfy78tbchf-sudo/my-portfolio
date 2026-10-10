# Build184 — Early home performance during initial account loading

Baseline: 885cc6b527d28173ee0415fb5c19c78febebb760 (Build183).

## User outcome

Initial account loading previously withheld selected-period summary/chart and today's account performance until all enrichment reads completed. The startup home reads now publish independently once ready, while the larger analysis bundle continues. Their responses are reused in the larger bundle without duplicate queries. When the selected period is today, its reliable-performance response is also reused for today's card.

The existing order is retained: account/holdings render first; saved-decision review starts early; cash-flow reconciliation and saved settings precede startup home performance reads. This change does not bypass cash-flow reconciliation or alter P&L formulas. Initial-enrichment completion cannot overwrite a newer same-period user query's core result. Account, auth activity, request and KST-date guards protect late publication.

Failed home reads remain distinct from unknown/zero: confirmed home data stays visible, chart failure is not labeled as zero observations, and a local “성과 다시 확인” retries only home sources. Account data, history, decisions and orders are not modified by this read retry.

## Verification

Isolated startup tests cover reconciliation ordering, saved period, early core result during blocked enrichment, no duplicate reads, today's shared gate, local failure/retry, same-period request epoch and account/day isolation. Build153/180 loading, Build182 cache and Build183 staged period regression tests pass. Full mobile CI run 38059916455 (job 114235891450) passed, including 390/402/430px startup headline/chart before auxiliary completion and failed chart retry. Artifact 11673245584. Visually reviewed the full-page 390px ready and 430px retry captures: total, period/today performance and chart are readable; failed chart is distinguished from zero observations with a visible retry. Earlier captures preserved mid-page scroll, so a test-only follow-up captured from the top for proper visual review.

Implementation commit 8fafb3d58b4568af6993a1716ae343ae8a7c576f; screenshot-only follow-up 84ce4f2a69ca6ec1c10f1976e271d7bbf765d57a. Pages run 38059915542 succeeded. Retrieved production index.html matches the implementation exactly: SHA-256 4876db39d47a486fde0c979f96eb22bdbc2b21225a708ec1728cf5715ebd97f6. No user-account test transactions or judgments were written. Automated, synthetic-mobile and deployed-source checks are complete; physical-iPhone daily use remains confirmation needed.

Controlled comparison ran the baseline and new startup functions in separate VM contexts with identical synthetic conditions: three-read queue, 40ms ordinary reads, 350ms reconciliation and 600ms benchmark. Initial account display was 125ms before / 124ms after; home performance 1321ms before / 597ms after; all details 1361ms before / 1398ms after. This demonstrates earlier useful content, not faster database calculations or physical-iPhone timing. Existing Build180 tests separately cover first open, refresh, full reopen, short resume and period switch.

Follow-up isolation test verifies an obsolete period's failed startup read cannot leave an error on a newer selected period. Successful period reload clears the resolved period warning while retaining a separate today-read failure when relevant.

## Remaining limits

Actual physical-iPhone startup/resume/login timings and daily usability are not verified. Reconciliation itself still precedes performance reads; improvements to it require evidence from real query timing and must retain accounting correctness. The next priority is validating the complete ordinary daily visit, rather than adding analysis features or revisiting completed UI work.
