# Build199 — Keep contribution browsing context during stock review

Baseline: main 5116539 / Build198.

The largest gain/loss shortcut cleared stock search and scope before opening a held stock. Returning therefore replaced the user's filtered list with all stocks. It also relied on the browser focusing the shortcut during a tap, which touch browsers do not consistently do.

Held-stock shortcuts now retain search/scope/sort and explicitly capture focus before opening the existing period-aware detail. The shortcut says “종목 점검”; a non-held stock says “손익 내역” and retains the existing reveal-row behavior. The leaders state that their overall period ranking is separate from list search. No calculations, account data, decisions or AI calls change.

The new isolated regression fails on Build198 and passes with this patch, covering held versus non-held destinations and filter/focus behavior. The existing three-width browser return test now starts with MRNA/foreign filtering, opens ARM from the overall leaders without pre-focusing it, performs a background render, and checks exact search/scope, visible MRNA row, scroll and origin-focus restoration. Existing Build198 period transfer remains covered. CI and production verification pending; physical iPhone use remains separate.
