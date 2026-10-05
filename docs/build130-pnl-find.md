# Build130 — find securities in the performance list

The period contribution list now provides a name/ticker search and All/Domestic/Foreign/Held filters. Search includes known security aliases for consolidated corporate histories and normalizes case, whitespace and full-width characters. Domestic/foreign uses the existing row currency classification (KRW vs foreign currency); held uses positive ending quantity from the selected snapshot.

Filtering only changes row visibility. The underlying results, overall totals, reference conversion and ranking calculations remain untouched. Scope and query persist through sorting and re-rendering; the reset button restores all rows. Filtering input does not re-render the screen, preserving typing focus and Korean IME composition. Existing held-security buttons continue to open the investment review flow.

The UI shows visible/total counts, a list-only scope label and an explicit empty result. Buttons expose pressed state and hidden rows leave keyboard navigation. Tests cover normalized name/ticker/alias search, combinations with currency/held scope and browser search/filter/sort/reset behavior, unchanged headline and narrow-screen overflow.
