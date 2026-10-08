# Build159 — compare consecutive saved judgments

Latest judgment and historical records show a collapsed comparison against the immediately preceding record. Choice, reason and review condition changes are labeled explicitly; identical trimmed text is reported as reconfirmation. This describes recorded intent, not executed trades or investment outcomes. Price/analysis snapshots remain in their respective records.

Comparisons require matching security IDs and strictly increasing valid timestamps. Missing, tied, reversed or invalid records are not paired. User text is escaped and existing records are not modified.

Unit tests cover chronological/security boundaries, reconfirmation and HTML escaping. Mobile workflow verifies a recovered save, collapsed comparison, previous/current reasons and reopening the stored judgment at the existing viewport sizes.
