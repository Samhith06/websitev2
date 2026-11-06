/* -------------------------------------------------------------------------- */
/* Monthly milestones, with a hand-kept lifetime list                         */
/* -------------------------------------------------------------------------- */

/*
 * The ladder now resets every calendar month (UTC). Progress is that month's
 * wager, and each tier can be claimed once per month.
 *
 * The exceptions are chosen by hand. Being on this list keeps someone on the
 * original terms: progress is their lifetime total and each tier is claimable
 * once, ever. A row here is what makes those terms apply, so removing one puts
 * the member straight back on the monthly ladder, and adding it again restores
 * them. Their claims are untouched either way.
 */
CREATE TABLE IF NOT EXISTS milestone_lifetime_members (
  user_id    bigint      PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  added_by   text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

/*
 * Which ladder a claim was made on: 'YYYY-MM', or 'lifetime' for the list above.
 *
 * Existing claims are filed under the month they were made in. A claim made
 * earlier this month therefore still spends that tier for this month, so nobody
 * is paid twice for the same tier in the month this ships. Claims from before
 * that stop blocking the monthly ladder but still count for a lifetime member,
 * who has spent a tier if they hold a live claim on it in any cycle.
 *
 * No default on purpose: every writer has to say which ladder it means.
 */
ALTER TABLE milestone_claims
  ADD COLUMN IF NOT EXISTS cycle text;

UPDATE milestone_claims
   SET cycle = to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM')
 WHERE cycle IS NULL;

ALTER TABLE milestone_claims
  ALTER COLUMN cycle SET NOT NULL;

/* Once per cycle now, rather than once ever. Still enforced by the index, so a
   double-tap stays one claim however the button behaves. */
DROP INDEX IF EXISTS milestone_claims_once;
CREATE UNIQUE INDEX milestone_claims_once
  ON milestone_claims (user_id, tier_id, cycle);
