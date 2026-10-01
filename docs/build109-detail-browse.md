# Build109 — Browse securities without closing detail

Detail now offers Previous / Next controls and a position counter when the originating visible list has multiple resolvable current holdings. The journey follows rendered order, including portfolio filters and performance sorting. Duplicate securities are included once; hidden rows, nonholdings and ambiguous symbol matches are excluded. A direct launch without a matching visible list remains a single-security view.

Performance rows carry a per-security snapshot of the currently selected performance context, so switching names does not reuse the prior security's amount. The first/last controls stop at the boundary. Existing detail request epochs reject late responses during quick navigation. The original scroll/focus return target is captured once and preserved until the modal closes.

Optional form input triggers a confirmation before discarding it on a security switch. Cancellation leaves the current form and security intact. Browsing itself does not save investment decisions, alter the selected period or write financial records.

Validation: synthetic production-renderer mobile tests at 390/402/430px cover sorted today list -> ARM -> LLY -> RXRX -> MRNA, corresponding per-security period amounts, boundaries, backwards navigation, input cancellation/acceptance and return to the Today list. Existing detail/decision and chart checks remain in CI. This does not claim an owner-authenticated phone run.
