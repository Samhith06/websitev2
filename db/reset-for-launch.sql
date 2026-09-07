-- Clear the testing period before the site opens to real users.
--
-- NOT a migration. It is never run by `runMigrations` — it lives here so the
-- exact statements can be read and argued with before anybody runs them, and
-- so there is a record of what was wiped and when.
--
-- THIS DESTROYS DATA AND CANNOT BE UNDONE. Take a backup first:
--
--   pg_dump "$DATABASE_URL" > backup-before-launch-reset.sql
--
-- and then run the whole thing as one transaction, so a failure part way
-- through leaves the site exactly as it was rather than half reset:
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/reset-for-launch.sql
--
-- Check the welcome amount in section 4 against WELCOME_COINS in production
-- before running. It is written out here rather than read from the
-- environment, because psql cannot see the app's environment.

BEGIN;

/* ═══════════════════════════════════════════════════════════════════════════
   1. Coins and game history
   ═══════════════════════════════════════════════════════════════════════════

   The ledger and the balance cache are wiped together. Zeroing balances while
   leaving the ledger would leave every account's history disagreeing with its
   own total, and the profile page reads both.

   Seed pairs go too. They are the fairness commitments the test rounds were
   played against, and they are recreated lazily on the next round, so
   everybody starts on a fresh commitment with nonces from zero — which is what
   makes a revealed seed mean "these are all the rounds" once it is rotated.
   Order matters: the round tables reference seed_pairs without a cascade. */

DELETE FROM blackjack_rounds;
DELETE FROM game_rounds;
DELETE FROM seed_pairs;

DELETE FROM coin_ledger;

UPDATE coin_balances
   SET balance = 0,
       lifetime_earned = 0,
       updated_at = now();

/* ═══════════════════════════════════════════════════════════════════════════
   2. Logs and counters
   ═══════════════════════════════════════════════════════════════════════════

   Admin actions taken while testing, the Kick webhook de-duplication table,
   the test stream sessions, any presence window still open, and the clip play
   counts testers ran up. `clip_plays` is zeroed rather than deleted so the
   rows stay in step with the clips they belong to. */

DELETE FROM audit_log;
DELETE FROM kick_events;
DELETE FROM stream_sessions;
DELETE FROM presence_windows;

UPDATE clip_plays
   SET plays = 0,
       last_play_at = NULL;

/* ═══════════════════════════════════════════════════════════════════════════
   3. What testers spent their coins on
   ═══════════════════════════════════════════════════════════════════════════

   Shop redemptions, raffle entries, milestone claims and earned badges. These
   were bought with coins that no longer exist, so leaving them would show
   testers holding prizes nobody can now afford — and a raffle would draw from
   entries that were never really paid for.

   Shop stock is NOT restored: nothing here records what it was before a
   redemption took an item off the shelf, so any item testers bought out needs
   its stock set by hand on the admin store page afterwards. */

DELETE FROM redemptions;
DELETE FROM raffle_entries;
DELETE FROM milestone_claims;
DELETE FROM user_badges;

/* ═══════════════════════════════════════════════════════════════════════════
   4. The same start a new signup gets
   ═══════════════════════════════════════════════════════════════════════════

   WELCOME_COINS is granted once, on the insert of a user row, so nobody who
   signed up during testing would ever receive it again — they would sit at
   zero until the next stream paid a watch tick. This hands every existing
   account the grant a new account gets today, written the way the app writes
   it: one 'adjustment' ledger row per user, `balance_after` matching, and
   `lifetime_earned` left at zero, because that figure means coins the stream
   paid out and a welcome grant is not one of them.

   ► Change 500 in BOTH places below if production's WELCOME_COINS differs.
   ► Delete this whole section to leave everybody on nothing. */

INSERT INTO coin_balances (user_id, balance, lifetime_earned, updated_at)
SELECT id, 500, 0, now() FROM users
    ON CONFLICT (user_id) DO UPDATE
   SET balance = EXCLUDED.balance,
       lifetime_earned = EXCLUDED.lifetime_earned,
       updated_at = now();

INSERT INTO coin_ledger (user_id, delta, kind, reason, balance_after)
SELECT id, 500, 'adjustment', 'Welcome coins', 500 FROM users;

COMMIT;

/* ═══════════════════════════════════════════════════════════════════════════
   What is deliberately kept
   ═══════════════════════════════════════════════════════════════════════════

   users, kick_links, razed_links, poker_links, sub_state  — who people are and
     what they have already verified. Making testers link Kick again would be a
     worse first day than starting them on a clean balance.
   user_settings          — self-exclusion lives here. Never clear it.
   razed_snapshots, razed_wagers — the wager data the leaderboard reads. The
     sync job overwrites it on its next run anyway.
   lb_periods, prize_tiers — deleting an open period takes its prize tiers with
     it. Boards are opened and closed from the admin page, not from here.
   clips, shop_items, raffles, badges, milestone_tiers, settings — the site's
     own content and configuration.

   ═══════════════════════════════════════════════════════════════════════════
   Check it landed
   ═══════════════════════════════════════════════════════════════════════════

SELECT 'coin_ledger'      AS what, count(*) FROM coin_ledger
UNION ALL SELECT 'game_rounds',      count(*) FROM game_rounds
UNION ALL SELECT 'blackjack_rounds', count(*) FROM blackjack_rounds
UNION ALL SELECT 'seed_pairs',       count(*) FROM seed_pairs
UNION ALL SELECT 'audit_log',        count(*) FROM audit_log
UNION ALL SELECT 'redemptions',      count(*) FROM redemptions
UNION ALL SELECT 'raffle_entries',   count(*) FROM raffle_entries
UNION ALL SELECT 'user_badges',      count(*) FROM user_badges
UNION ALL SELECT 'users kept',       count(*) FROM users
UNION ALL SELECT 'balances off 500', count(*) FROM coin_balances WHERE balance <> 500;
*/
