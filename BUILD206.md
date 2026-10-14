# Build206 — Persistent next action in security detail

Reuse the existing bottom return bar for a primary next action: fresh AI opinion, comparison, linked opinion, decision form and explicit save. Selection follows current comparison/analysis/form state; dirty assumptions require recalculation and an unlinked comparison requires its matching AI opinion. Existing handlers perform all computation, validation and persistence. Save only occurs after an explicit click, with missing reason/checkpoint focused first; completion returns to the list.

The bar respects the bottom safe area, gives the primary action most of the width and hides while a text/select input is focused. Closing or replacing the detail disconnects its observer/listeners. Busy source actions disable the next button. No additional network calls occur merely by opening the detail or changing the button label.

Validation: 73 targeted existing test entries passed; new next-action state checks passed. Added mobile viewport/touch-target assertions to the existing Chromium/WebKit browser workflow. Physical iPhone keyboard behavior remains to be confirmed. Runtime build and service-worker cache advanced to 206.
