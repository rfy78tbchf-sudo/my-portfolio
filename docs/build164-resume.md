# Build164 — retain reading position during refresh

Refresh completion renders using the current position rather than restoring the position captured before the network call. Background preserving renders also restore expanded/collapsed details by stable ID or matching index plus summary text. A changed anonymous section is not reopened by mistake.

The HTML release marker, update checker and service-worker cache now identify Build164. Previously the HTML/checker markers still identified Build155, so intervening shell releases could fail to trigger the explicit update notice. Updates remain user-applied, not forced reloads.

Tests cover scrolling and changing tabs during a pending refresh, section identity, matching release identifiers, update notice behavior and mobile composition expansion/scroll persistence. No authentication or financial calculation changes.
