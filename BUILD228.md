# Build228 — open held contributors directly from wealth TOP3

Baseline: main f311c663fc3ec6a292f1c67f8e527eec691af4b2 (Build227). Main/branch Chromium and WebKit CI and Pages succeeded. No newer remote work branch or running workflow was found; older dirty Build222 worktrees were preserved.

## Candidates and selection

1. Wealth TOP3 to security review: current source renders inert rows. After finding a contributor, the user must switch to My holdings and find it again. Selected: a bounded navigation gap introduced with the recent wealth panel.
2. Performance contributors and return: existing direct entry, retained filters and section-specific focus are already implemented. Reuse that navigation infrastructure, do not redesign.
3. Home density and chart clearing: Builds222/223 already address these. Preserve asset → trend → composition and My holdings as the primary review entry.

## Result and acceptance

- A verified held contributor opens its existing detail in one tap, previously at least two taps (My holdings tab → matching row) plus any search/scroll. Closing or browser back returns to the same TOP3 ranking, focus and scroll without changing tabs or rerequesting the impact data.
- The entire row is keyboard/touch accessible, at least 44px high, with a visible chevron. No added default paragraph or new home queue. Amount, order, period, partial-source warning and provisional labels are unchanged.
- Resolve explicit security IDs only when consistent with the current holding and symbol. Without an ID, require exactly one unique held security for the symbol. Multiple accounts for one security are supported. Unheld, stale, mismatched and ambiguous identities remain text rather than dead or incorrect links.
- Reuse existing detail, next/previous, close, browser history and focus restoration. No financial calculation, database, authentication or AI changes. No production writes; all browser data is synthetic.

## Verification and continuation

- Existing wealth browser suite now exercises actual detail opening, touch, Enter, close and browser back at 390/402/430px and 100%/125%; asserts identity, row touch height, unchanged ranking and scroll/focus return.
- Identity regression covers duplicate accounts, ambiguous symbols, zero holdings and stale/mismatched IDs. Existing wealth arithmetic and navigation/decision regressions remain required.
- Required remote workflow runs Chromium and WebKit on the final commit before promotion. Local WebKit requires unavailable host libraries; actual iPhone Face ID/native keyboard/PWA lifecycle remain separate.
- Promotion: recheck main remains the baseline, fast-forward only; then verify main CI/Pages and deployed markers `2026-10-28-impact-detail-228` / `2026102807-228`.
- Next: inspect any new captures or reported navigation gaps. Do not repeat layout changes without evidence; follow BUILD220 Standing UI content priority.
