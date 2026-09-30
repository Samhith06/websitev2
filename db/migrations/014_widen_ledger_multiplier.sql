/* -------------------------------------------------------------------------- */
/* Widen coin_ledger.multiplier                                               */
/* -------------------------------------------------------------------------- */

/*
 * coin_ledger.multiplier was numeric(4,2) — a ceiling of 99.99. Keno's own
 * paytables (keno-paytables.json) go past that at plenty of pick counts, and
 * High risk needs only 4 hits to clear it (259x). A win over the ceiling
 * threw "numeric field overflow" out of `apply()` mid-transaction, which
 * rolled the whole round back: the stake was never debited, but the player
 * saw "The round could not be completed" because the failure surfaced as a
 * thrown error rather than a normal ok:false response.
 *
 * game_rounds.multiplier is already numeric(12,2) for the same value — this
 * just brings the ledger's copy of it in line.
 */

ALTER TABLE coin_ledger ALTER COLUMN multiplier TYPE numeric(12,2);
