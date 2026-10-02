/* -------------------------------------------------------------------------- */
/* Razed wager adjustments                                                    */
/* -------------------------------------------------------------------------- */

/*
 * Wagering Razed's referral feed does not report, added by hand.
 *
 * Lifetime is rebuilt from the API on every sync and stored as a fresh
 * snapshot, so editing a snapshot row lasts only until the next sync. These
 * rows are instead folded into every lifetime rebuild, which is what makes an
 * adjustment stick. Amounts may be negative to take wagering back off.
 *
 * Append-only, like the coin ledger: a correction is another row with a
 * reason, not an edit.
 */
CREATE TABLE IF NOT EXISTS razed_wager_adjustments (
  id         bigserial     PRIMARY KEY,
  username   text          NOT NULL,
  amount     numeric(14,2) NOT NULL CHECK (amount <> 0),
  reason     text          NOT NULL,
  created_at timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS razed_wager_adjustments_username_idx
  ON razed_wager_adjustments (lower(username));

INSERT INTO razed_wager_adjustments (username, amount, reason)
VALUES ('lilw3lchytv', 27865.11, 'Lifetime wagering not reported by the Razed referral feed');
