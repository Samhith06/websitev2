-- 2026 revamp: Razed links, milestones, raffles, badges, poker handles.
--
-- Everything here follows the rule the ledger already established: money-shaped
-- state is append-only and idempotent, and nothing is claimable twice because a
-- unique index says so rather than because the UI disables a button.

/* ═══════════════════════════════════════════════════════════════════════════
   Razed links
   Unique on the claimed username so two site accounts can never hold the same
   Razed identity — the whole milestone ladder hangs off this one constraint.
   ═══════════════════════════════════════════════════════════════════════════ */

CREATE TABLE IF NOT EXISTS razed_links (
  user_id      bigint      PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  username     text        NOT NULL,
  -- pending | matched | approved | rejected
  status       text        NOT NULL DEFAULT 'pending',
  -- Wager total seen for this username when it was submitted, so a mod can see
  -- what they are approving without a second lookup.
  matched_wagered numeric(14,2),
  reviewed_by  text,
  reviewed_at  timestamptz,
  reject_reason text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS razed_links_username_key
  ON razed_links (lower(username));
CREATE INDEX IF NOT EXISTS razed_links_status_idx
  ON razed_links (status, created_at DESC);

/* PokerNow is a handle for seating people in community games. There is nothing
   to verify and nothing riding on it, so it is a bare row. */
CREATE TABLE IF NOT EXISTS poker_links (
  user_id    bigint      PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  handle     text        NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

/* ═══════════════════════════════════════════════════════════════════════════
   Razed snapshots
   Appended, never overwritten. A partial or malformed sync leaves the previous
   snapshot intact, so the site keeps showing the last good data with a "last
   synced" timestamp instead of a suddenly empty leaderboard.
   ═══════════════════════════════════════════════════════════════════════════ */

CREATE TABLE IF NOT EXISTS razed_snapshots (
  id          bigserial   PRIMARY KEY,
  -- 'lifetime' or a period key like '2026-09'.
  period      text        NOT NULL,
  fetched_at  timestamptz NOT NULL DEFAULT now(),
  row_count   integer     NOT NULL,
  -- The raw response, so a bad sync can be diagnosed rather than guessed at.
  payload     jsonb       NOT NULL
);

CREATE INDEX IF NOT EXISTS razed_snapshots_period_idx
  ON razed_snapshots (period, fetched_at DESC);

/* The flattened rows of a snapshot, which is what every read actually wants. */
CREATE TABLE IF NOT EXISTS razed_wagers (
  snapshot_id bigint      NOT NULL REFERENCES razed_snapshots(id) ON DELETE CASCADE,
  username    text        NOT NULL,
  wagered     numeric(14,2) NOT NULL,
  PRIMARY KEY (snapshot_id, username)
);

CREATE INDEX IF NOT EXISTS razed_wagers_username_idx
  ON razed_wagers (lower(username));

/* ═══════════════════════════════════════════════════════════════════════════
   Milestones
   Tiers are data so they can be retuned without a deploy. Claims are unique on
   (user, tier), which is what makes a tier claimable exactly once however many
   times the button is hammered.
   ═══════════════════════════════════════════════════════════════════════════ */

CREATE TABLE IF NOT EXISTS milestone_tiers (
  id         bigserial   PRIMARY KEY,
  threshold  numeric(14,2) NOT NULL,
  reward     numeric(10,2) NOT NULL,
  active     boolean     NOT NULL DEFAULT true,
  sort_order integer     NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS milestone_tiers_threshold_key
  ON milestone_tiers (threshold);

CREATE TABLE IF NOT EXISTS milestone_claims (
  id         bigserial   PRIMARY KEY,
  user_id    bigint      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tier_id    bigint      NOT NULL REFERENCES milestone_tiers(id),
  -- pending | paid | rejected
  status     text        NOT NULL DEFAULT 'pending',
  -- The wager total at the moment of claiming, frozen so a later restatement
  -- by Razed cannot make a paid claim look unearned.
  wagered_at_claim numeric(14,2) NOT NULL,
  reward     numeric(10,2) NOT NULL,
  paid_by    text,
  paid_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS milestone_claims_once
  ON milestone_claims (user_id, tier_id);
CREATE INDEX IF NOT EXISTS milestone_claims_status_idx
  ON milestone_claims (status, created_at);

/* ═══════════════════════════════════════════════════════════════════════════
   Raffles
   The draw seed is committed before entry closes and revealed after, so anyone
   can confirm the winner was fixed before the entrant list was known.
   ═══════════════════════════════════════════════════════════════════════════ */

CREATE TABLE IF NOT EXISTS raffles (
  id           bigserial   PRIMARY KEY,
  slug         text        NOT NULL UNIQUE,
  title        text        NOT NULL,
  value_label  text        NOT NULL DEFAULT '',
  description  text        NOT NULL DEFAULT '',
  image_url    text,
  symbol       text        NOT NULL DEFAULT '✦',
  -- 0 is a free raffle; the entry path is otherwise identical.
  cost         integer     NOT NULL DEFAULT 0 CHECK (cost >= 0),
  max_entries  integer     NOT NULL DEFAULT 1 CHECK (max_entries >= 1),
  -- draft | open | closed | drawn
  status       text        NOT NULL DEFAULT 'draft',
  opens_at     timestamptz NOT NULL DEFAULT now(),
  closes_at    timestamptz NOT NULL,
  -- Committed on creation, published as a hash, revealed on the draw.
  draw_seed        text    NOT NULL,
  draw_seed_hash   text    NOT NULL,
  seed_revealed_at timestamptz,
  winner_user_id   bigint  REFERENCES users(id) ON DELETE SET NULL,
  winner_entry_id  bigint,
  drawn_at     timestamptz,
  delivered_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS raffles_status_idx ON raffles (status, closes_at);

CREATE TABLE IF NOT EXISTS raffle_entries (
  id         bigserial   PRIMARY KEY,
  raffle_id  bigint      NOT NULL REFERENCES raffles(id) ON DELETE CASCADE,
  user_id    bigint      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cost       integer     NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

/* The draw hashes the committed seed against this ordering, so it must be
   stable and cheap to read back. */
CREATE INDEX IF NOT EXISTS raffle_entries_order_idx
  ON raffle_entries (raffle_id, id);
CREATE INDEX IF NOT EXISTS raffle_entries_user_idx
  ON raffle_entries (raffle_id, user_id);

/* ═══════════════════════════════════════════════════════════════════════════
   Badges
   Criteria are stored as data and evaluated by a job, so a new badge needs no
   deploy. Pinning is capped at three by the application, not the schema —
   the cap is a design decision and will change before the table does.
   ═══════════════════════════════════════════════════════════════════════════ */

CREATE TABLE IF NOT EXISTS badges (
  id          bigserial   PRIMARY KEY,
  slug        text        NOT NULL UNIQUE,
  name        text        NOT NULL,
  description text        NOT NULL,
  -- Gold badges are the wager-derived ones; the rest render blue.
  gold        boolean     NOT NULL DEFAULT false,
  -- { "kind": "lifetime_wager", "threshold": 50000 } and friends.
  criteria    jsonb       NOT NULL DEFAULT '{}'::jsonb,
  active      boolean     NOT NULL DEFAULT true,
  sort_order  integer     NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS user_badges (
  user_id   bigint      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id  bigint      NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  earned_at timestamptz NOT NULL DEFAULT now(),
  pinned    boolean     NOT NULL DEFAULT false,
  PRIMARY KEY (user_id, badge_id)
);

CREATE INDEX IF NOT EXISTS user_badges_pinned_idx
  ON user_badges (user_id) WHERE pinned;

/* ═══════════════════════════════════════════════════════════════════════════
   Profile settings
   Self-exclusion has to be server-side or it is not a feature. `games_enabled`
   is the opt-in; `excluded_until` is the one a user cannot undo early.
   ═══════════════════════════════════════════════════════════════════════════ */

CREATE TABLE IF NOT EXISTS user_settings (
  user_id             bigint      PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  games_enabled       boolean     NOT NULL DEFAULT false,
  game_sound          boolean     NOT NULL DEFAULT true,
  public_profile      boolean     NOT NULL DEFAULT true,
  stream_notifications boolean    NOT NULL DEFAULT true,
  excluded_until      timestamptz,
  updated_at          timestamptz NOT NULL DEFAULT now()
);

/* ═══════════════════════════════════════════════════════════════════════════
   Seed data
   The tiers and badges the design shows, inserted once. Values are Matty's to
   change from the admin screens afterwards.
   ═══════════════════════════════════════════════════════════════════════════ */

INSERT INTO milestone_tiers (threshold, reward, sort_order) VALUES
  (1000, 5, 1), (5000, 25, 2), (10000, 50, 3), (25000, 150, 4),
  (50000, 350, 5), (100000, 750, 6), (250000, 2000, 7)
ON CONFLICT (threshold) DO NOTHING;

INSERT INTO badges (slug, name, description, gold, criteria, sort_order) VALUES
  ('high-roller', 'High Roller', '$50,000 lifetime wagered', true,  '{"kind":"lifetime_wager","threshold":50000}',  1),
  ('vip',         'VIP',         '$40,000 in 30 days',      true,  '{"kind":"period_wager","threshold":40000,"days":30}', 2),
  ('whale',       'Whale',       '$100,000 lifetime wagered', true,'{"kind":"lifetime_wager","threshold":100000}', 3),
  ('champion',    'Champion',    'Won a monthly leaderboard', true,'{"kind":"leaderboard_rank","rank":1}',         4),
  ('podium',      'Podium',      'Top 3 on a monthly board',  true,'{"kind":"leaderboard_rank","rank":3}',         5),
  ('founder',     'Founder',     'One of the first 30 members', false, '{"kind":"manual"}',                        6),
  ('verified',    'Verified',    'Kick account linked',       false, '{"kind":"kick_linked"}',                     7),
  ('grinder',     'Grinder',     '100 hours watched',         false, '{"kind":"hours_watched","threshold":100}',   8),
  ('regular',     'Regular',     'Attended 30 streams',       false, '{"kind":"streams_attended","threshold":30}', 9),
  ('streak',      'Streak',      '14 days in a row',          false, '{"kind":"day_streak","threshold":14}',      10),
  ('lucky',       'Lucky',       'Won a raffle',              false, '{"kind":"raffle_won"}',                     11),
  ('collector',   'Collector',   'Redeemed 5 store items',    false, '{"kind":"redemptions","threshold":5}',      12),
  ('sub',         'Sub',         'Active Kick subscriber',    false, '{"kind":"kick_sub"}',                       13),
  ('poker-night', 'Poker Night', 'Played a community poker night', false, '{"kind":"manual"}',                    14)
ON CONFLICT (slug) DO NOTHING;
