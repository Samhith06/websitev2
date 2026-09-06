/* -------------------------------------------------------------------------- */
/* Max wins, flagged rather than inferred                                     */
/* -------------------------------------------------------------------------- */

/*
 * A max win is a slot paying its own ceiling, and it is the rarest thing on
 * the wall — worth saying out loud beside the multiplier rather than leaving
 * somebody to recognise it from the figure.
 *
 * It cannot be derived. The ceiling is a property of the game, not of the
 * round: 5,000x is a max win on one slot and an ordinary bonus on another, and
 * nothing here knows any slot's maximum. So it is a flag somebody sets, which
 * also means a clip can be marked the moment it happens rather than waiting
 * for a table of every slot's cap to exist.
 *
 * Defaults false, so every clip already stored keeps the card it has.
 */

ALTER TABLE clips ADD COLUMN IF NOT EXISTS max_win boolean NOT NULL DEFAULT false;
