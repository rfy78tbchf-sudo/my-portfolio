# Build153 — initial load failure isolation

Initial loading previously rejected the entire live state when any required auxiliary analysis/chart RPC timed out. These reads now resolve to unavailable independently, preserving successful account/holding/snapshot reads. No missing profit is replaced with zero, no demo fallback, and critical account reads still surface failure. The existing batch still waits for requests to settle; this change does not implement progressive first paint.

REST GET reads and an explicit list of initial read-only RPCs retry one transport failure after350ms with a20s retry deadline. Writes, sync calls, other RPCs, HTTP authorization failures and session changes are not replayed by this helper. Existing401 token refresh remains unchanged. No DB/schema/auth policy changes.

Synthetic regression tests exercise transient and persistent abort, HTTP403, logout during read, failed auxiliary RPCs with usable core state, and failed core read. Real iPhone network recovery remains to be observed by the user; tests do not prove the cause of every past abort.
