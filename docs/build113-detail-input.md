# Build113 — Guard detail closing and track saved input scopes

The close button, backdrop close, and return-to-list action now share the same confirmation when optional detail inputs have been edited. Cancelling does not invalidate requests, clear the form, change security, or change the return target. Confirming closes normally. The existing previous/next confirmation remains.

Edits are counted separately for thesis, decision, and other optional controls. Verified decision readback clears only the decision edit scope; successful thesis readback clears only the thesis scope. A version mismatch leaves the dirty flag active. Failed saves do not clear it. This is navigation protection, not persistent draft storage or a guarantee against browser/app termination. Calculation controls remain protected as current inputs even though they do not constitute a saved investment record.

Validation: helper checks cover scoped clears, cancellation preserving the request epoch, and accepting close. Production-renderer mobile tests verify cancel-close preserves the entered reason, followed by existing cancel/accept security navigation. Detail regression also passes at 390/402/430px. Tests explicitly accept incidental discard confirmations in unrelated flows; focused cancellation assertions remain explicit.
