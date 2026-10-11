# Build195 — Retry failed home sections on quick return

Baseline: main c38e16f / Build194. The recent-load throttle suppressed a quick return even when home review or startup performance sources had failed. The user had to find each retry action despite returning after connectivity recovered.

Within the same-day three-minute fast path, retry only failed review and/or home-performance lanes. Healthy visits still perform no fetch. Confirmed account data and the full transaction history are not reloaded for partial failures. A core account failure bypasses the fast path and uses the existing full retry. Requests share the existing refresh promise; owner/target guards prevent publishing to a changed session. Existing buttons remain available. No schema, auth, financial calculation or write changes.

Regression reproduced on baseline, then passed after correction: review-only, performance-only, both, healthy, concurrent-return, retained holdings, changed-owner and hidden cases. Existing midnight, scroll-preservation and load-recovery tests passed locally. Mobile synthetic test fails review and chart, simulates quick return with network restored, verifies both recover with exactly three review REST reads and no full account load, preserves asset amount and captures home.

Mobile CI and production verification pending. No real account test writes. Physical iPhone return and daily-use timing remain unverified. Next priority remains real-device signed-in usability validation; do not infer this from synthetic automation.
