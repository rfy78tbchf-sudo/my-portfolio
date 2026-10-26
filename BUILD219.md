# Build219 — 기간 손익의 계산 범위 표시

Baseline: main 08594595bff407f566304b38dd6c0fa5bfd58a3b (Build218).

## Problem and resulting behavior

A partial period amount previously said 일부 미계산, but the user had to find the excluded securities in the long contribution list and enable details to learn why. The headline now says 계산된 종목 합계 when coverage is incomplete. A disclosure next to the amount identifies excluded securities and their server-provided reasons, foreign amounts awaiting KRW conversion, included provisional amounts, and unlinked transactions separately. Names include symbols when available.

Missing amounts are explicitly excluded, never treated as zero. A provisional flag on an unpriced item does not count as an included estimated amount. Fully covered provisional amounts remain provisional; fully covered settled zero amounts do not acquire a missing-data warning. Filters affect the contribution list only. The record-count line describes query scope rather than claiming that every record contributed to the total.

## Read-only source investigation

The authenticated owner's current Today, 1W, THIS_MONTH and 1M results were compared with their included item sums and calculation components. Item sums matched returned totals to floating-point precision; component differences were zero. This establishes internal arithmetic consistency for the included scope, not completeness of all broker transactions, historical FX or opening snapshots.

An excluded domestic sale has two independently blocking conditions: the provisional fallback only accepts the holdings-cutoff day, and the broker's reported realized profit differs by one KRW from sell amount minus buy amount minus reported fee and tax. A read-only candidate that widened the date window alone did not restore inclusion. Other short-window exclusions require opening-quantity reconciliation. No fee, tax, date, quantity or missing history was invented; the production function and stored data are unchanged. Private account identifiers, balances and raw broker payloads are not committed.

## Verification

- Seven focused P&L tests cover excluded/provisional/local-currency partitions, zero, escaped source text, unlinked transactions, immutable financial results and filter-independent scope.
- Chromium production startup and trend navigation tests pass with synthetic network routes. Coverage expands with a 44px touch target, named reasons and no horizontal overflow at 390/402/430px and 100%/125% sizes.
- The existing workflow runs these tests and the broader decision/mobile regression suite, including WebKit, before promotion.
- Build marker and service-worker cache advance to 219.

Financial source completeness and physical iPhone Face ID, keyboard and PWA termination/relaunch remain separate checks. This release adds no account writes, schema changes, permission changes, AI features or new startup requests.
