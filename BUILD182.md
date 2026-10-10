# Build182 — Home period revisit and independent sales loading

Baseline: 1f8e1ffdf8534c94f4cfc323d0ad1c29dded06ba (Build181).

## Observed gap and change

Home period switching previously waited for both the full period bundle and the separate realized-sale calculation before rendering. Revisiting a successfully loaded home period also repeated its entire bundle. The stock-performance tab already has its own period cache and detail-return scroll/context preservation, so those implementations are retained.

Home period data now renders as soon as its bundle is ready while realized sales complete independently. Successful bundles are reused only inside the same live account object and KST date; full account refresh/restart creates a new object. Pending requests for the same period are shared. Older period/account/day responses cannot replace the current selection. Optional query failures prevent caching so a later revisit can retry them. No calculation formulas or database state changed.

Period query failure keeps total assets visible and offers a local same-period retry. It no longer sets a whole-account failure. Subsequent data renders preserve scroll.

## Validation

Isolated tests pass for independent sales loading, successful revisit without new summary reads, midnight/account invalidation, pending deduplication, stale account response exclusion, failed optional-query exclusion and same-period retry. Existing period/sales alignment and Build180 loading and Build145 stock-period cache checks pass. Inline application scripts parse and diff whitespace checks pass.

Synthetic 390/402/430px browser coverage added for ready home while sales are deliberately held, cached period revisit and failed period retry. Full mobile CI, screenshot review and production deployment verification pending. No user account test transactions or judgments are created. No real iPhone latency or 30-second/one-minute usability claim is made.

## Remaining priority

The first uncached home period bundle still waits for its own auxiliary reads. Assess which of those are necessary for the home headline before separating them, preserving period/account and calculation consistency. Physical iPhone login/resume and actual daily comprehension remain confirmation needed.
