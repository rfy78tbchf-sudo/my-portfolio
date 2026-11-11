# Build199 — Keep contribution browsing context during stock review

Baseline: main 5116539 / Build198.

The largest gain/loss shortcut cleared stock search and scope before opening a held stock. Returning therefore replaced the user's filtered list with all stocks. It also relied on the browser focusing the shortcut during a tap, which touch browsers do not consistently do.

Held-stock shortcuts now retain search/scope/sort and explicitly capture focus before opening the existing period-aware detail. The shortcut says “종목 점검”; a non-held stock says “손익 내역” and retains the existing reveal-row behavior. The leaders state that their overall period ranking is separate from list search. No calculations, account data, decisions or AI calls change.

The new isolated regression fails on Build198 and passes with this patch, covering held versus non-held destinations and filter/focus behavior. The existing three-width browser return test now starts with MRNA/foreign filtering, opens ARM from the overall leaders without pre-focusing it, performs a background render, and checks exact search/scope, visible MRNA row, scroll and origin-focus restoration. Existing Build198 period transfer remains covered. CI and production verification completed below; physical iPhone use remains separate.


## Verification completed

Commit 50a79962a09d4e6e21a2508dda4c942ff678f050. Mobile workflow 38191099804 passed the full regression suite, Chromium 390/402/430px return journey, existing WebKit navigation, and chart checks. Pages deployment 38191099501 succeeded. The new behavior is covered in Chromium and isolated tests; the existing WebKit flow remains a general navigation regression, not a physical iPhone test.

Inspected the 390px home-selected-period and contribution-filter-return captures from artifact 11720938199. The action label is readable and the return capture retains MRNA search and the foreign filter. Synthetic fixture values only; no owner decisions or account writes.

Production index.html matches local SHA256 cca869dc69425ca7ba3ddc90c91a3954f58ddc89f7d459e4cb9612a4855e33b9. Service-worker cache and PWA update marker were advanced together. Real iPhone timing remains unverified.

Next usability focus: make selecting a period and opening its stock contribution discoverable beside the home performance summary, including loading/retry states. Avoid duplicating existing analysis or altering P&L definitions.
